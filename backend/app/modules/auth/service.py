"""Sign-in: OAuth start and callback, one-time login codes, token pairs, rotation, linking."""

import hmac
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta
from urllib.parse import urlsplit

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthNotConfigured
from app.core.config import Settings
from app.core.errors import AppError
from app.modules.auth.models import Identity, LoginCode, OAuthState, RefreshToken
from app.modules.auth.providers import OAuthProvider, Profile, ProviderError
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import TokenPair
from app.modules.auth.tokens import (
    ACCESS_TOKEN_MINUTES,
    create_access_token,
    hash_secret,
    new_secret,
    pkce_challenge,
)
from app.modules.users.models import User

STATE_TTL = timedelta(minutes=10)
LOGIN_CODE_TTL = timedelta(seconds=60)
# Two tabs may refresh with the same token at once; within this window both get a pair.
REFRESH_GRACE = timedelta(seconds=10)
DEFAULT_NAME = "Cortex user"
MAX_STATE_LENGTH = 100
# A random nonce in an HttpOnly cookie ties the sign-in to the browser that started it, so a
# callback URL or login code made by someone else cannot sign this browser in (login CSRF).
NONCE_COOKIE = "cortex_login"
NONCE_COOKIE_PATH = "/api/v1/auth"


def nonce_cookie_secure(frontend_url: str) -> bool:
    """Secure everywhere except plain-http localhost, where local development runs."""
    parts = urlsplit(frontend_url)
    return not (parts.scheme == "http" and parts.hostname == "localhost")


def _same_secret(value: str | None, expected_hash: str) -> bool:
    return value is not None and hmac.compare_digest(hash_secret(value), expected_hash)


class LoginExpired(AppError):
    status_code = 400
    code = "login_expired"


class RefreshInvalid(AppError):
    status_code = 401
    code = "refresh_invalid"


class ProviderNotAvailable(AppError):
    status_code = 404
    code = "provider_not_available"


def tutor_allowed(user: User, verified_emails: set[str], settings: Settings) -> bool:
    """May this user chat with the AI tutor? Dev mode: always. jwt mode: invite-only.

    `verified_emails` come from the user's identities (not `user.email`, which may be stale).
    """
    if settings.auth_mode == "dev":
        return True
    invited = set(settings.tutor_invited_emails)
    return any(email.lower() in invited for email in verified_emails)


class AuthService:
    def __init__(
        self, session: AsyncSession, settings: Settings, clock: Callable[[], datetime]
    ) -> None:
        self.session = session
        self.repo = AuthRepository(session)
        self.settings = settings
        self.clock = clock

    # ------------------------------------------------------------ urls (only FRONTEND_URL)

    def _frontend(self, path: str) -> str:
        return f"{self.settings.frontend_url.rstrip('/')}{path}"

    def redirect_uri(self, provider: str) -> str:
        return self._frontend(f"/api/v1/auth/{provider}/callback")

    def _signin_error(self, reason: str) -> str:
        return self._frontend(f"/signin?error={reason}")

    # ------------------------------------------------------------ oauth

    async def start(self, provider: str, providers: dict[str, OAuthProvider]) -> tuple[str, str]:
        """The provider's authorize URL and the nonce to set as this browser's cookie."""
        oauth = providers.get(provider)
        if oauth is None:
            raise ProviderNotAvailable("This sign-in method is not available")
        now = self.clock()
        await self.repo.delete_expired(now)  # anonymous calls must not pile up rows
        state, verifier, nonce = new_secret(), new_secret(), new_secret()
        self.session.add(
            OAuthState(
                state=state,
                provider=provider,
                code_verifier=verifier,
                nonce_hash=hash_secret(nonce),
                expires_at=now + STATE_TTL,
            )
        )
        url = oauth.authorize_url(state, pkce_challenge(verifier), self.redirect_uri(provider))
        return url, nonce

    async def callback(
        self,
        provider: str,
        code: str | None,
        state: str | None,
        error: str | None,
        nonce: str | None,
        providers: dict[str, OAuthProvider],
        client: httpx.AsyncClient,
    ) -> str:
        """Finish sign-in and return where to send the browser. Never raises for bad input."""
        pending = None
        if state and len(state) <= MAX_STATE_LENGTH:
            pending = await self.repo.take_state(state)  # consumed whatever happens next
        if error:
            return self._signin_error("cancelled")
        if (
            pending is None
            or not code
            or pending.provider != provider
            or pending.expires_at <= self.clock()
            or not _same_secret(nonce, pending.nonce_hash)
        ):
            return self._signin_error("expired")
        oauth = providers.get(provider)
        if oauth is None:
            return self._signin_error("failed")
        try:
            profile = await oauth.fetch_profile(
                code, pending.code_verifier, self.redirect_uri(provider), client
            )
        except ProviderError:
            return self._signin_error("failed")
        user = await self.sign_in(profile)
        login_code = new_secret()
        self.session.add(
            LoginCode(
                code_hash=hash_secret(login_code),
                user_id=user.id,
                nonce_hash=pending.nonce_hash,
                expires_at=self.clock() + LOGIN_CODE_TTL,
            )
        )
        return self._frontend(f"/auth/done#code={login_code}")

    # ------------------------------------------------------------ linking

    async def sign_in(self, profile: Profile) -> User:
        """Find or create the user for a provider profile, then refresh their details.

        A new identity joins an existing user only when its email is verified and equals
        (ignoring case) the email of an existing verified identity.
        """
        email = profile.email if profile.email and len(profile.email) <= 320 else None
        verified_email = email if profile.email_verified else None
        identity = await self.repo.identity(profile.provider, profile.provider_user_id)
        user: User | None = None
        if identity is not None:
            user = await self.session.get(User, identity.user_id)
            identity.email, identity.email_verified = email, verified_email is not None
        else:
            if verified_email is not None:
                match = await self.repo.verified_identity_by_email(verified_email)
                if match is not None:
                    user = await self.session.get(User, match.user_id)
            if user is None:
                user = User(display_name=DEFAULT_NAME, email=verified_email)
                self.session.add(user)
                await self.session.flush()
            self.session.add(
                Identity(
                    user_id=user.id,
                    provider=profile.provider,
                    provider_user_id=profile.provider_user_id,
                    email=email,
                    email_verified=verified_email is not None,
                )
            )
        assert user is not None  # identities cascade with their user
        user.display_name = profile.name.strip()[:120] or DEFAULT_NAME
        avatar = profile.avatar_url
        user.avatar_url = avatar if avatar and len(avatar) <= 500 else None
        user.last_login_at = self.clock()
        await self.session.flush()
        return user

    # ------------------------------------------------------------ tokens

    async def exchange_code(self, code: str, nonce: str | None) -> TokenPair:
        """Swap a login code for tokens; only the browser that started sign-in may do it."""
        user_id = None
        if nonce is not None:
            user_id = await self.repo.use_login_code(
                hash_secret(code), hash_secret(nonce), self.clock()
            )
        if user_id is None:
            raise LoginExpired("Sign-in expired. Please sign in again.")
        pair, _ = self._issue(user_id, uuid.uuid4())
        return pair

    async def refresh(self, token: str) -> TokenPair:
        now = self.clock()
        row = await self.repo.refresh_token(hash_secret(token))
        if row is None or row.revoked_at is not None or row.expires_at <= now:
            raise RefreshInvalid("Session expired. Please sign in again.")
        if row.used_at is None:
            pair, successor_id = self._issue(row.user_id, row.family_id)
            row.used_at, row.replaced_by_id = now, successor_id
            return pair
        if now - row.used_at <= REFRESH_GRACE:
            # Only hashes are stored, so give this tab a new sibling in the same family.
            pair, _ = self._issue(row.user_id, row.family_id)
            return pair
        # A rotated token came back after the grace window: treat it as stolen.
        await self.repo.revoke_family(row.family_id, now)
        await self.session.commit()  # keep the revocation; the request fails below
        raise RefreshInvalid("Session expired. Please sign in again.")

    async def logout(self, token: str) -> None:
        row = await self.repo.refresh_token(hash_secret(token))
        if row is not None:
            await self.repo.revoke_family(row.family_id, self.clock())

    def _issue(self, user_id: uuid.UUID, family_id: uuid.UUID) -> tuple[TokenPair, uuid.UUID]:
        """A new access token and refresh token; returns the pair and the refresh row's id."""
        secret = self.settings.jwt_secret
        if not secret:
            raise AuthNotConfigured("Sign-in is not configured")
        now = self.clock()
        refresh_token = new_secret()
        row = RefreshToken(
            id=uuid.uuid4(),
            user_id=user_id,
            family_id=family_id,
            token_hash=hash_secret(refresh_token),
            expires_at=now + timedelta(days=self.settings.refresh_token_days),
        )
        self.session.add(row)
        pair = TokenPair(
            access_token=create_access_token(user_id, secret, now),
            refresh_token=refresh_token,
            expires_in=ACCESS_TOKEN_MINUTES * 60,
        )
        return pair, row.id
