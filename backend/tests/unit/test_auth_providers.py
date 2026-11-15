from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from app.core.config import Settings
from app.modules.auth.providers import (
    GitHubProvider,
    GoogleProvider,
    ProviderError,
    configured_providers,
)

REDIRECT = "https://api.example.com/api/v1/auth/github/callback"


def _client(handler: httpx.MockTransport) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=handler)


def _github_handler(
    emails: list[dict[str, object]], token: dict[str, object] | None = None
) -> httpx.MockTransport:
    def handle(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url == "https://github.com/login/oauth/access_token":
            form = parse_qs(request.content.decode())
            assert request.headers["Accept"] == "application/json"
            assert form["code_verifier"] == ["ver"]
            assert form["redirect_uri"] == [REDIRECT]
            assert form["client_secret"] == ["sec"]
            return httpx.Response(200, json=token or {"access_token": "tok"})
        assert request.headers["Authorization"] == "Bearer tok"
        if url == "https://api.github.com/user":
            return httpx.Response(
                200, json={"id": 42, "login": "octo", "name": None, "avatar_url": "http://a/p.png"}
            )
        if url == "https://api.github.com/user/emails":
            return httpx.Response(200, json=emails)
        return httpx.Response(404)

    return httpx.MockTransport(handle)


async def test_github_verified_primary_email() -> None:
    emails = [
        {"email": "other@x.com", "primary": False, "verified": True},
        {"email": "me@x.com", "primary": True, "verified": True},
    ]
    async with _client(_github_handler(emails)) as client:
        p = await GitHubProvider("cid", "sec").fetch_profile("code", "ver", REDIRECT, client)
    assert p.provider == "github"
    assert p.provider_user_id == "42"
    assert p.email == "me@x.com"
    assert p.email_verified is True
    assert p.name == "octo"
    assert p.avatar_url == "http://a/p.png"


async def test_github_unverified_emails_give_none() -> None:
    emails = [{"email": "me@x.com", "primary": True, "verified": False}]
    async with _client(_github_handler(emails)) as client:
        p = await GitHubProvider("cid", "sec").fetch_profile("code", "ver", REDIRECT, client)
    assert p.email is None
    assert p.email_verified is False


async def test_github_token_error_raises_without_leaking() -> None:
    handler = _github_handler([], token={"error": "bad_verification_code"})
    async with _client(handler) as client:
        with pytest.raises(ProviderError) as exc:
            await GitHubProvider("cid", "sec").fetch_profile("secretcode", "ver", REDIRECT, client)
    assert "secretcode" not in exc.value.message
    assert exc.value.status_code == 502
    assert exc.value.code == "provider_error"


async def test_github_api_failure_raises() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if "access_token" in str(request.url):
            return httpx.Response(200, json={"access_token": "tok"})
        return httpx.Response(500)

    async with _client(httpx.MockTransport(handle)) as client:
        with pytest.raises(ProviderError):
            await GitHubProvider("cid", "sec").fetch_profile("c", "ver", REDIRECT, client)


async def test_github_missing_id_raises() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if "access_token" in str(request.url):
            return httpx.Response(200, json={"access_token": "tok"})
        return httpx.Response(200, json={"login": "x"})

    async with _client(httpx.MockTransport(handle)) as client:
        with pytest.raises(ProviderError):
            await GitHubProvider("cid", "sec").fetch_profile("c", "ver", REDIRECT, client)


def _google_handler(userinfo: dict[str, object], token_status: int = 200) -> httpx.MockTransport:
    def handle(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "https://oauth2.googleapis.com/token":
            form = parse_qs(request.content.decode())
            assert form["grant_type"] == ["authorization_code"]
            assert form["code_verifier"] == ["ver"]
            assert form["redirect_uri"] == [REDIRECT]
            return httpx.Response(token_status, json={"access_token": "tok"})
        assert str(request.url) == "https://openidconnect.googleapis.com/v1/userinfo"
        assert request.headers["Authorization"] == "Bearer tok"
        return httpx.Response(200, json=userinfo)

    return httpx.MockTransport(handle)


@pytest.mark.parametrize("flag", [True, "true"])
async def test_google_maps_profile(flag: object) -> None:
    info = {
        "sub": "g-1",
        "email": "me@x.com",
        "email_verified": flag,
        "name": "Me",
        "picture": "http://pic",
    }
    async with _client(_google_handler(info)) as client:
        p = await GoogleProvider("cid", "sec").fetch_profile("c", "ver", REDIRECT, client)
    assert (p.provider, p.provider_user_id, p.email) == ("google", "g-1", "me@x.com")
    assert p.email_verified is True
    assert p.avatar_url == "http://pic"
    assert p.name == "Me"


async def test_google_token_failure_raises() -> None:
    async with _client(_google_handler({}, token_status=400)) as client:
        with pytest.raises(ProviderError):
            await GoogleProvider("cid", "sec").fetch_profile("c", "ver", REDIRECT, client)


async def test_google_missing_sub_raises() -> None:
    async with _client(_google_handler({"email": "a@b.c"})) as client:
        with pytest.raises(ProviderError):
            await GoogleProvider("cid", "sec").fetch_profile("c", "ver", REDIRECT, client)


@pytest.mark.parametrize(
    ("provider", "base", "scope"),
    [
        (
            GitHubProvider("cid", "sec"),
            "https://github.com/login/oauth/authorize",
            "read:user user:email",
        ),
        (
            GoogleProvider("cid", "sec"),
            "https://accounts.google.com/o/oauth2/v2/auth",
            "openid email profile",
        ),
    ],
)
def test_authorize_url(provider: GitHubProvider | GoogleProvider, base: str, scope: str) -> None:
    url = urlparse(provider.authorize_url("st", "chal", REDIRECT))
    q = parse_qs(url.query)
    assert f"{url.scheme}://{url.netloc}{url.path}" == base
    assert q["state"] == ["st"]
    assert q["code_challenge"] == ["chal"]
    assert q["code_challenge_method"] == ["S256"]
    assert q["redirect_uri"] == [REDIRECT]
    assert q["client_id"] == ["cid"]
    assert q["scope"] == [scope]
    assert q["response_type"] == ["code"]  # Google rejects the request without it


def test_configured_providers_only_with_id_and_secret() -> None:
    s = Settings(
        github_client_id="a",
        github_client_secret="b",
        google_client_id="c",
        google_client_secret=None,
    )
    assert list(configured_providers(s)) == ["github"]
    both = Settings(
        github_client_id="a",
        github_client_secret="b",
        google_client_id="c",
        google_client_secret="d",
    )
    assert set(configured_providers(both)) == {"github", "google"}
