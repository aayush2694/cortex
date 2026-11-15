"""Sign-in flow: OAuth state + PKCE, one-time login codes, tokens, rotation and linking."""

import uuid
from urllib.parse import parse_qs, urlsplit

import httpx
from sqlalchemy import func, select

from app.core.config import Settings
from app.core.db import get_sessionmaker
from app.main import app
from app.modules.auth.models import Identity, LoginCode, OAuthState, RefreshToken
from app.modules.auth.providers import Profile
from app.modules.auth.tokens import decode_access_token, hash_secret, pkce_challenge
from app.modules.users.models import User
from tests.integration.conftest import TEST_JWT_SECRET, Clock, FakeProvider

AUTH = "/api/v1/auth"
GITHUB = Profile("github", "gh-1", "a@x.com", True, "Ada GitHub", "https://img.test/a.png")


async def start(client: httpx.AsyncClient, provider: str = "github") -> dict[str, str]:
    r = await client.get(f"{AUTH}/{provider}/start")
    assert r.status_code == 302
    query = parse_qs(urlsplit(r.headers["location"]).query)
    return {k: v[0] for k, v in query.items()}


async def callback(
    client: httpx.AsyncClient, provider: str = "github", **params: str
) -> httpx.Response:
    r = await client.get(f"{AUTH}/{provider}/callback", params=params)
    assert r.status_code == 302
    return r


async def login_code(client: httpx.AsyncClient, provider: str = "github") -> str:
    state = (await start(client, provider))["state"]
    location = (await callback(client, provider, code="pcode", state=state)).headers["location"]
    head, _, fragment = location.partition("#")
    assert head == "http://web.test/auth/done"
    assert fragment.startswith("code=")
    return fragment.removeprefix("code=")


async def sign_in(client: httpx.AsyncClient, provider: str = "github") -> dict[str, str]:
    r = await client.post(f"{AUTH}/token", json={"code": await login_code(client, provider)})
    assert r.status_code == 200, r.text
    return dict(r.json())


async def refresh(client: httpx.AsyncClient, token: str) -> httpx.Response:
    return await client.post(f"{AUTH}/refresh", json={"refresh_token": token})


def user_id_of(tokens: dict[str, str], clock: Clock) -> uuid.UUID:
    return decode_access_token(tokens["access_token"], TEST_JWT_SECRET, clock())


# ---------------------------------------------------------------- the whole flow


async def test_full_flow(
    client: httpx.AsyncClient, providers: dict[str, FakeProvider], clock: Clock
) -> None:
    providers["github"].profile = GITHUB
    listed = (await client.get(f"{AUTH}/providers")).json()
    assert listed["mode"] == "jwt" and "github" in listed["providers"]

    query = await start(client)
    assert query["state"]
    assert query["redirect_uri"] == "http://web.test/api/v1/auth/github/callback"

    location = (await callback(client, code="pcode", state=query["state"])).headers["location"]
    head, _, fragment = location.partition("#")
    assert head == "http://web.test/auth/done" and fragment.startswith("code=")
    r = await client.post(f"{AUTH}/token", json={"code": fragment.removeprefix("code=")})
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    tokens = r.json()
    assert set(tokens) == {"access_token", "refresh_token", "expires_in"}
    assert tokens["expires_in"] == 900

    # PKCE: the verifier sent to the provider matches the challenge in the authorize URL.
    call = providers["github"].calls[-1]
    assert call["code"] == "pcode"
    assert call["redirect_uri"] == "http://web.test/api/v1/auth/github/callback"
    assert pkce_challenge(call["verifier"]) == query["code_challenge"]

    async with get_sessionmaker()() as session:
        identity = await session.scalar(select(Identity).where(Identity.provider_user_id == "gh-1"))
        assert identity is not None
        user = await session.get(User, identity.user_id)
        assert user is not None
        assert user_id_of(tokens, clock) == user.id
        assert user.display_name == "Ada GitHub"
        assert user.email == "a@x.com" and user.avatar_url == "https://img.test/a.png"
        assert user.last_login_at == clock()
        # Only hashes are stored.
        stored = (await session.scalars(select(RefreshToken.token_hash))).all()
        assert stored == [hash_secret(tokens["refresh_token"])]


async def test_providers_in_dev_mode(client: httpx.AsyncClient) -> None:
    listed = (await client.get(f"{AUTH}/providers")).json()
    assert listed == {"mode": "dev", "providers": []}


async def test_unknown_provider_is_404(
    client: httpx.AsyncClient, providers: dict[str, FakeProvider]
) -> None:
    del providers["google"]
    for name in ("google", "nope"):
        r = await client.get(f"{AUTH}/{name}/start")
        assert r.status_code == 404
        assert r.json()["error"]["code"] == "provider_not_available"


# ---------------------------------------------------------------- state and login codes


async def test_state_is_single_use_and_expires(
    client: httpx.AsyncClient, providers: dict[str, FakeProvider], clock: Clock
) -> None:
    state = (await start(client))["state"]
    first = await callback(client, code="c", state=state)
    assert first.headers["location"].startswith("http://web.test/auth/done#code=")
    replay = await callback(client, code="c", state=state)
    assert replay.headers["location"] == "http://web.test/signin?error=expired"

    old = (await start(client))["state"]
    clock.advance(10 * 60 + 1)
    late = await callback(client, code="c", state=old)
    assert late.headers["location"] == "http://web.test/signin?error=expired"

    unknown = await callback(client, code="c", state="made-up")
    assert unknown.headers["location"] == "http://web.test/signin?error=expired"
    missing = await callback(client, code="c")
    assert missing.headers["location"] == "http://web.test/signin?error=expired"

    # A state issued for GitHub cannot finish a Google sign-in.
    gh_state = (await start(client, "github"))["state"]
    crossed = await callback(client, "google", code="c", state=gh_state)
    assert crossed.headers["location"] == "http://web.test/signin?error=expired"

    async with get_sessionmaker()() as session:
        # Every state was consumed (even the expired and mismatched ones): none are left.
        assert await session.scalar(select(func.count()).select_from(OAuthState)) == 0


async def test_cancel_at_provider(
    client: httpx.AsyncClient, providers: dict[str, FakeProvider]
) -> None:
    state = (await start(client))["state"]
    r = await callback(client, error="access_denied", state=state)
    assert r.headers["location"] == "http://web.test/signin?error=cancelled"
    assert providers["github"].calls == []


async def test_provider_failure_redirects(
    client: httpx.AsyncClient, providers: dict[str, FakeProvider]
) -> None:
    providers["github"].fail = True
    state = (await start(client))["state"]
    r = await callback(client, code="c", state=state)
    assert r.headers["location"] == "http://web.test/signin?error=failed"


async def test_login_code_single_use_and_60s(
    client: httpx.AsyncClient, providers: dict[str, FakeProvider], clock: Clock
) -> None:
    code = await login_code(client)
    assert (await client.post(f"{AUTH}/token", json={"code": code})).status_code == 200
    again = await client.post(f"{AUTH}/token", json={"code": code})
    assert again.status_code == 400
    assert again.json()["error"]["code"] == "login_expired"

    late = await login_code(client)
    clock.advance(61)
    r = await client.post(f"{AUTH}/token", json={"code": late})
    assert r.status_code == 400 and r.json()["error"]["code"] == "login_expired"

    bogus = await client.post(f"{AUTH}/token", json={"code": "not-a-code"})
    assert bogus.status_code == 400 and bogus.json()["error"]["code"] == "login_expired"

    async with get_sessionmaker()() as session:
        hashes = (await session.scalars(select(LoginCode.code_hash))).all()
        assert hash_secret(code) in hashes and code not in hashes


# ---------------------------------------------------------------- refresh tokens


async def test_refresh_rotates(
    client: httpx.AsyncClient, providers: dict[str, FakeProvider], clock: Clock
) -> None:
    first = await sign_in(client)
    r = await refresh(client, first["refresh_token"])
    assert r.status_code == 200
    second = r.json()
    assert second["refresh_token"] != first["refresh_token"]
    assert user_id_of(second, clock) == user_id_of(first, clock)

    clock.advance(11)
    reused = await refresh(client, first["refresh_token"])
    assert reused.status_code == 401
    assert reused.json()["error"]["code"] == "refresh_invalid"
    # The whole family is revoked, including the token from the first refresh.
    after = await refresh(client, second["refresh_token"])
    assert after.status_code == 401
    async with get_sessionmaker()() as session:
        revoked = (await session.scalars(select(RefreshToken.revoked_at))).all()
        assert revoked and all(t is not None for t in revoked)


async def test_refresh_rejects_unknown_and_expired(
    client: httpx.AsyncClient, providers: dict[str, FakeProvider], clock: Clock
) -> None:
    assert (await refresh(client, "nope")).status_code == 401
    tokens = await sign_in(client)
    clock.advance(30 * 24 * 3600 + 1)
    r = await refresh(client, tokens["refresh_token"])
    assert r.status_code == 401 and r.json()["error"]["code"] == "refresh_invalid"


async def test_two_tabs_refresh_within_grace(
    client: httpx.AsyncClient, providers: dict[str, FakeProvider], clock: Clock
) -> None:
    first = await sign_in(client)
    tab_a = await refresh(client, first["refresh_token"])
    clock.advance(5)
    tab_b = await refresh(client, first["refresh_token"])
    assert tab_a.status_code == 200 and tab_b.status_code == 200
    a, b = tab_a.json(), tab_b.json()
    assert a["refresh_token"] != b["refresh_token"]
    assert user_id_of(a, clock) == user_id_of(b, clock) == user_id_of(first, clock)

    async with get_sessionmaker()() as session:
        families = set(
            (
                await session.scalars(
                    select(RefreshToken.family_id).where(
                        RefreshToken.token_hash.in_(
                            [hash_secret(t["refresh_token"]) for t in (first, a, b)]
                        )
                    )
                )
            ).all()
        )
        assert len(families) == 1

    # Each new refresh token works once.
    assert (await refresh(client, a["refresh_token"])).status_code == 200
    assert (await refresh(client, b["refresh_token"])).status_code == 200
    clock.advance(11)
    assert (await refresh(client, a["refresh_token"])).status_code == 401


async def test_logout_revokes_family(
    client: httpx.AsyncClient, providers: dict[str, FakeProvider], clock: Clock
) -> None:
    first = await sign_in(client)
    second = (await refresh(client, first["refresh_token"])).json()
    other_session = await sign_in(client)

    r = await client.post(f"{AUTH}/logout", json={"refresh_token": second["refresh_token"]})
    assert r.status_code == 204
    assert (await refresh(client, second["refresh_token"])).status_code == 401
    # Another sign-in (another family) is untouched.
    assert (await refresh(client, other_session["refresh_token"])).status_code == 200
    unknown = await client.post(f"{AUTH}/logout", json={"refresh_token": "nope"})
    assert unknown.status_code == 204


# ---------------------------------------------------------------- linking


async def test_linking_requires_both_verified(
    client: httpx.AsyncClient, providers: dict[str, FakeProvider], clock: Clock
) -> None:
    providers["github"].profile = GITHUB
    gh = user_id_of(await sign_in(client, "github"), clock)

    providers["google"].profile = Profile("google", "g-1", "A@X.com", True, "Ada G", None)
    assert user_id_of(await sign_in(client, "google"), clock) == gh

    providers["google"].profile = Profile("google", "g-2", "a@x.com", False, "Ada U", None)
    unverified = user_id_of(await sign_in(client, "google"), clock)
    assert unverified != gh

    providers["github"].profile = Profile("github", "gh-2", None, False, "", None)
    no_email = user_id_of(await sign_in(client, "github"), clock)
    assert no_email not in (gh, unverified)
    # Signing in again with the same identity returns the same user.
    assert user_id_of(await sign_in(client, "github"), clock) == no_email

    async with get_sessionmaker()() as session:
        linked = await session.get(User, gh)
        assert linked is not None and linked.display_name == "Ada G"  # updated on each sign-in
        loner = await session.get(User, no_email)
        assert loner is not None
        assert loner.display_name == "Cortex user" and loner.email is None
        unverified_user = await session.get(User, unverified)
        assert unverified_user is not None and unverified_user.email is None
        count = await session.scalar(select(func.count()).select_from(User))
        assert count == 3


async def test_unverified_identity_is_never_a_link_target(
    client: httpx.AsyncClient, providers: dict[str, FakeProvider], clock: Clock
) -> None:
    providers["google"].profile = Profile("google", "g-1", "b@x.com", False, "B", None)
    unverified = user_id_of(await sign_in(client, "google"), clock)
    providers["github"].profile = Profile("github", "gh-9", "b@x.com", True, "B", None)
    assert user_id_of(await sign_in(client, "github"), clock) != unverified


# ---------------------------------------------------------------- redirects


async def test_redirects_only_to_frontend_url(
    client: httpx.AsyncClient, providers: dict[str, FakeProvider], auth_settings: Settings
) -> None:
    evil = "https://evil.test/steal"
    r = await client.get(
        f"{AUTH}/github/start",
        params={"redirect_uri": evil, "next": evil, "return_to": evil},
    )
    query = parse_qs(urlsplit(r.headers["location"]).query)
    assert query["redirect_uri"] == ["http://web.test/api/v1/auth/github/callback"]

    state = query["state"][0]
    for params in (
        {"code": "c", "state": state, "next": evil, "redirect_uri": evil},
        {"error": "access_denied", "next": evil},
        {"code": "c", "state": "bad", "return_to": evil},
    ):
        location = (await callback(client, **params)).headers["location"]
        assert location.startswith("http://web.test/")
        assert "evil" not in location

    # No auth endpoint takes a redirect target at all.
    allowed = {"provider", "code", "state", "error"}
    for path, ops in app.openapi()["paths"].items():
        if path.startswith(AUTH):
            for op in ops.values():
                names = {p["name"] for p in op.get("parameters", [])}
                assert names <= allowed, (path, names)
