"""GitHub and Google OAuth providers (authorization code flow with PKCE).

The caller passes the `httpx.AsyncClient`, so timeouts are its choice. Errors never include
the authorization code, tokens or secrets.
"""

from dataclasses import dataclass
from typing import Any, Protocol
from urllib.parse import urlencode

import httpx

from app.core.config import Settings
from app.core.errors import AppError


class ProviderError(AppError):
    status_code = 502
    code = "provider_error"

    def __init__(self, message: str = "Sign-in with the provider failed") -> None:
        super().__init__(message)


@dataclass(frozen=True)
class Profile:
    provider: str
    provider_user_id: str
    email: str | None
    email_verified: bool
    name: str
    avatar_url: str | None


class OAuthProvider(Protocol):
    name: str

    def authorize_url(self, state: str, challenge: str, redirect_uri: str) -> str: ...

    async def fetch_profile(
        self, code: str, verifier: str, redirect_uri: str, client: httpx.AsyncClient
    ) -> Profile: ...


def _authorize_url(
    base: str, client_id: str, scope: str, state: str, challenge: str, redirect_uri: str
) -> str:
    query = urlencode(
        {
            "response_type": "code",  # required by Google; GitHub accepts it
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": scope,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    )
    return f"{base}?{query}"


async def _request_json(client: httpx.AsyncClient, method: str, url: str, **kwargs: Any) -> Any:
    try:
        response = await client.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ProviderError() from exc


class GitHubProvider:
    name = "github"

    def __init__(self, client_id: str, client_secret: str) -> None:
        self._id = client_id
        self._secret = client_secret

    def authorize_url(self, state: str, challenge: str, redirect_uri: str) -> str:
        return _authorize_url(
            "https://github.com/login/oauth/authorize",
            self._id,
            "read:user user:email",
            state,
            challenge,
            redirect_uri,
        )

    async def fetch_profile(
        self, code: str, verifier: str, redirect_uri: str, client: httpx.AsyncClient
    ) -> Profile:
        token_data = await _request_json(
            client,
            "POST",
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": self._id,
                "client_secret": self._secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "code_verifier": verifier,
            },
            headers={"Accept": "application/json"},
        )
        token = token_data.get("access_token") if isinstance(token_data, dict) else None
        if not isinstance(token, str) or not token or "error" in token_data:
            raise ProviderError()
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
        user = await _request_json(client, "GET", "https://api.github.com/user", headers=headers)
        emails = await _request_json(
            client, "GET", "https://api.github.com/user/emails", headers=headers
        )
        if not isinstance(user, dict) or user.get("id") is None:
            raise ProviderError()
        email = (
            next(
                (
                    e["email"]
                    for e in emails
                    if isinstance(e, dict)
                    and e.get("primary")
                    and e.get("verified")
                    and e.get("email")
                ),
                None,
            )
            if isinstance(emails, list)
            else None
        )
        return Profile(
            provider=self.name,
            provider_user_id=str(user["id"]),
            email=email,
            email_verified=email is not None,
            name=user.get("name") or user.get("login") or "",
            avatar_url=user.get("avatar_url"),
        )


class GoogleProvider:
    name = "google"

    def __init__(self, client_id: str, client_secret: str) -> None:
        self._id = client_id
        self._secret = client_secret

    def authorize_url(self, state: str, challenge: str, redirect_uri: str) -> str:
        return _authorize_url(
            "https://accounts.google.com/o/oauth2/v2/auth",
            self._id,
            "openid email profile",
            state,
            challenge,
            redirect_uri,
        )

    async def fetch_profile(
        self, code: str, verifier: str, redirect_uri: str, client: httpx.AsyncClient
    ) -> Profile:
        token_data = await _request_json(
            client,
            "POST",
            "https://oauth2.googleapis.com/token",
            data={
                "grant_type": "authorization_code",
                "client_id": self._id,
                "client_secret": self._secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "code_verifier": verifier,
            },
        )
        token = token_data.get("access_token") if isinstance(token_data, dict) else None
        if not isinstance(token, str) or not token:
            raise ProviderError()
        info = await _request_json(
            client,
            "GET",
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {token}"},
        )
        if not isinstance(info, dict) or not info.get("sub"):
            raise ProviderError()
        email = info.get("email")
        verified = info.get("email_verified") in (True, "true")
        return Profile(
            provider=self.name,
            provider_user_id=str(info["sub"]),
            email=email,
            email_verified=bool(email) and verified,
            name=info.get("name") or email or "",
            avatar_url=info.get("picture"),
        )


def configured_providers(s: Settings) -> dict[str, OAuthProvider]:
    providers: dict[str, OAuthProvider] = {}
    if s.github_client_id and s.github_client_secret:
        providers["github"] = GitHubProvider(s.github_client_id, s.github_client_secret)
    if s.google_client_id and s.google_client_secret:
        providers["google"] = GoogleProvider(s.google_client_id, s.google_client_secret)
    return providers
