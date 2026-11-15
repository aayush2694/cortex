import uuid
from datetime import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import Identity, LoginCode, OAuthState, RefreshToken


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------ oauth states

    async def take_state(self, state: str) -> OAuthState | None:
        """Delete and return the state in one statement, so it can be used only once."""
        return await self.session.scalar(
            delete(OAuthState).where(OAuthState.state == state).returning(OAuthState)
        )

    # ------------------------------------------------------------ identities

    async def identity(self, provider: str, provider_user_id: str) -> Identity | None:
        return await self.session.scalar(
            select(Identity).where(
                Identity.provider == provider, Identity.provider_user_id == provider_user_id
            )
        )

    async def verified_identity_by_email(self, email: str) -> Identity | None:
        return await self.session.scalar(
            select(Identity)
            .where(Identity.email_verified, func.lower(Identity.email) == email.lower())
            .order_by(Identity.created_at, Identity.id)
            .limit(1)
        )

    # ------------------------------------------------------------ login codes

    async def use_login_code(self, code_hash: str, now: datetime) -> uuid.UUID | None:
        """Mark an unused, unexpired code used and return its user, atomically."""
        return await self.session.scalar(
            update(LoginCode)
            .where(
                LoginCode.code_hash == code_hash,
                LoginCode.used_at.is_(None),
                LoginCode.expires_at > now,
            )
            .values(used_at=now)
            .returning(LoginCode.user_id)
        )

    # ------------------------------------------------------------ refresh tokens

    async def refresh_token(self, token_hash: str) -> RefreshToken | None:
        """The row, locked until commit so two refreshes of one token run one after another."""
        return await self.session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update()
        )

    async def revoke_family(self, family_id: uuid.UUID, now: datetime) -> None:
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
