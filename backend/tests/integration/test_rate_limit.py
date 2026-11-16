"""Per-minute request limits: keys, separate limits per route group, Retry-After, cleanup."""

import logging
import uuid
from collections.abc import Callable, Iterator
from datetime import timedelta

import httpx
import pytest

from app.clients.llm import LLMEvent
from app.core.auth import get_clock
from app.core.config import Settings, get_settings
from app.core.rate_limit import limiter
from app.main import app
from app.modules.auth.tokens import create_access_token
from tests.integration.conftest import INVITED_EMAIL, TEST_JWT_SECRET, Clock, FakeLLM, SignedIn

API = "/api/v1"
DONE = LLMEvent(
    "done",
    data={
        "content": [{"type": "text", "text": "Hi"}],
        "stop_reason": "end_turn",
        "model": "fake",
        "input_tokens": 1,
        "output_tokens": 1,
    },
)

Limits = Callable[..., None]
PROXY_SECRET = "test-proxy-secret"  # not a real secret
REFRESH = f"{API}/auth/refresh"  # a sign-in route; a made-up token gets a 4xx, never a 429


async def sign_in_hit(client: httpx.AsyncClient, headers: dict[str, str] | None = None) -> int:
    body = {"refresh_token": "not-a-real-token"}
    return (await client.post(REFRESH, json=body, headers=headers)).status_code


def limited(codes: list[int]) -> list[bool]:
    return [c == 429 for c in codes]


@pytest.fixture
def limits(monkeypatch: pytest.MonkeyPatch) -> Iterator[Limits]:
    """Set the per-minute limits and the proxy secret for one test.

    Per-IP limits apply only with the secret, so it is set unless a test passes `secret=None`.
    """

    def set_limits(
        default: int = 120, auth: int = 20, tutor: int = 10, secret: str | None = PROXY_SECRET
    ) -> None:
        monkeypatch.setenv("RATE_LIMIT_DEFAULT_PER_MINUTE", str(default))
        monkeypatch.setenv("RATE_LIMIT_AUTH_PER_MINUTE", str(auth))
        monkeypatch.setenv("RATE_LIMIT_TUTOR_PER_MINUTE", str(tutor))
        if secret is None:
            monkeypatch.delenv("PROXY_SHARED_SECRET", raising=False)
        else:
            monkeypatch.setenv("PROXY_SHARED_SECRET", secret)
        get_settings.cache_clear()

    yield set_limits
    monkeypatch.undo()
    get_settings.cache_clear()


@pytest.fixture
def dev_clock() -> Iterator[Clock]:
    """A hand-moved clock in dev mode (the shared `clock` fixture switches to jwt mode)."""
    c = Clock()
    app.dependency_overrides[get_clock] = lambda: c
    yield c
    app.dependency_overrides.pop(get_clock, None)


async def test_request_over_the_limit_is_429_with_retry_after(
    client: httpx.AsyncClient, limits: Limits, dev_clock: Clock
) -> None:
    limits(default=2)
    for _ in range(2):
        assert (await client.get(f"{API}/me")).status_code == 200

    r = await client.get(f"{API}/me", headers={"x-request-id": "req-429"})
    assert r.status_code == 429
    assert r.json() == {
        "error": {
            "code": "rate_limited",
            "message": "Too many requests. Try again in 60 seconds.",
            "request_id": "req-429",
        }
    }
    assert r.headers["retry-after"] == "60"

    dev_clock.advance(45)
    r = await client.get(f"{API}/me")
    assert r.status_code == 429 and r.headers["retry-after"] == "15"


async def test_requests_pass_again_after_the_window(
    client: httpx.AsyncClient, limits: Limits, dev_clock: Clock
) -> None:
    limits(default=2)
    for _ in range(2):
        assert (await client.get(f"{API}/me")).status_code == 200
    assert (await client.get(f"{API}/me")).status_code == 429

    dev_clock.advance(60)
    for _ in range(2):
        assert (await client.get(f"{API}/me")).status_code == 200
    assert (await client.get(f"{API}/me")).status_code == 429


async def test_signed_in_users_are_keyed_by_user_id(
    client: httpx.AsyncClient, limits: Limits, signed_in: SignedIn
) -> None:
    limits(default=2)
    a, b = await signed_in(email="a@x.com"), await signed_in(email="b@x.com")

    # One user from two addresses shares one bucket.
    assert (await client.get(f"{API}/me", headers={**a, "x-forwarded-for": "1.1.1.1"})).is_success
    assert (await client.get(f"{API}/me", headers={**a, "x-forwarded-for": "2.2.2.2"})).is_success
    r = await client.get(f"{API}/me", headers={**a, "x-forwarded-for": "3.3.3.3"})
    assert r.status_code == 429

    # Another user from the same address has a bucket of their own.
    for _ in range(2):
        r = await client.get(f"{API}/me", headers={**b, "x-forwarded-for": "1.1.1.1"})
        assert r.status_code == 200


async def test_anonymous_key_is_the_proxy_peer_not_client_headers(
    client: httpx.AsyncClient, limits: Limits, dev_clock: Clock
) -> None:
    limits(default=2)
    # Render appends the address it saw (rightmost); everything left of it came from the client.
    spoofs = [
        {"x-forwarded-for": "6.6.6.6, 10.0.0.1"},
        {"x-forwarded-for": "7.7.7.7, 10.0.0.1", "x-client-ip": "8.8.8.8"},
        {"x-forwarded-for": "9.9.9.9, 10.0.0.1", "x-client-ip": "5.5.5.5", "x-proxy-secret": "x"},
    ]
    codes = [(await client.get(f"{API}/me", headers=h)).status_code for h in spoofs]
    assert codes == [200, 200, 429]

    # A different real peer has its own bucket.
    r = await client.get(f"{API}/me", headers={"x-forwarded-for": "6.6.6.6, 10.0.0.2"})
    assert r.status_code == 200


async def test_worker_client_ip_is_trusted_only_with_the_shared_secret(
    client: httpx.AsyncClient, limits: Limits, dev_clock: Clock
) -> None:
    limits(default=2)

    def via_worker(ip: str, secret: str = PROXY_SECRET) -> dict[str, str]:
        return {"x-client-ip": ip, "x-proxy-secret": secret}

    codes = [(await client.get(f"{API}/me", headers=via_worker("1.1.1.1"))).status_code]
    codes += [(await client.get(f"{API}/me", headers=via_worker("1.1.1.1"))).status_code]
    codes += [(await client.get(f"{API}/me", headers=via_worker("1.1.1.1"))).status_code]
    assert codes == [200, 200, 429]
    assert (await client.get(f"{API}/me", headers=via_worker("2.2.2.2"))).status_code == 200

    # A wrong secret means the header is ignored: these share the peer's bucket.
    wrong = [via_worker(ip, "wrong-secret") for ip in ("3.3.3.3", "4.4.4.4", "5.5.5.5")]
    codes = [(await client.get(f"{API}/me", headers=h)).status_code for h in wrong]
    assert codes == [200, 200, 429]


async def test_sign_in_routes_have_a_stricter_limit_per_ip_via_worker_and_direct(
    client: httpx.AsyncClient, limits: Limits, dev_clock: Clock
) -> None:
    limits(default=100, auth=2)
    worker = {"x-client-ip": "203.0.113.7", "x-proxy-secret": PROXY_SECRET}
    assert limited([await sign_in_hit(client, worker) for _ in "abc"]) == [False, False, True]
    other_visitor = {**worker, "x-client-ip": "203.0.113.8"}
    assert await sign_in_hit(client, other_visitor) != 429

    # Someone calling the API directly is keyed by the proxy peer address.
    peer = {"x-forwarded-for": "10.0.0.1"}
    assert limited([await sign_in_hit(client, peer) for _ in "abc"]) == [False, False, True]
    assert (await client.get(f"{API}/me", headers=peer)).status_code == 200  # other routes
    assert await sign_in_hit(client, {"x-forwarded-for": "10.0.0.2"}) != 429


async def test_without_the_secret_anonymous_requests_are_not_limited(
    client: httpx.AsyncClient, limits: Limits, dev_clock: Clock
) -> None:
    # Every visitor through the Worker has the same peer address, so a shared IP bucket would
    # let one client lock everyone out. Without the secret, per-IP limits are off.
    limits(secret=None)
    codes = [await sign_in_hit(client) for _ in range(200)]
    assert not any(limited(codes))
    assert len(limiter) == 0


async def test_without_the_secret_signed_in_users_are_still_limited(
    client: httpx.AsyncClient, limits: Limits, signed_in: SignedIn
) -> None:
    a = await signed_in()
    limits(default=2, secret=None)
    codes = [(await client.get(f"{API}/me", headers=a)).status_code for _ in "abc"]
    assert codes == [200, 200, 429]


async def test_providers_is_a_config_read_in_the_default_group(
    client: httpx.AsyncClient, limits: Limits, dev_clock: Clock
) -> None:
    limits(default=100, auth=1)
    codes = [(await client.get(f"{API}/auth/providers")).status_code for _ in range(5)]
    assert codes == [200] * 5


async def test_startup_warns_once_when_per_ip_limits_are_off(
    limits: Limits, caplog: pytest.LogCaptureFixture
) -> None:
    def warnings() -> list[str]:
        return [
            r.getMessage()
            for r in caplog.records
            if r.levelno == logging.WARNING and "PROXY_SHARED_SECRET" in r.getMessage()
        ]

    limits(secret=None)
    caplog.set_level(logging.INFO)
    async with app.router.lifespan_context(app):
        pass
    [message] = warnings()
    assert "per-IP" in message

    caplog.clear()
    limits()
    async with app.router.lifespan_context(app):
        pass
    assert warnings() == []


async def test_forged_token_is_keyed_by_address_not_its_sub(
    client: httpx.AsyncClient, limits: Limits, clock: Clock
) -> None:
    limits(default=2)
    forged_secret = "forged-secret-0123456789abcdef-xyz"  # not the API's secret
    tokens = [create_access_token(uuid.uuid4(), forged_secret, clock()) for _ in "abc"]
    peer = {"x-forwarded-for": "10.0.0.1"}
    codes = [
        (await client.get(f"{API}/me", headers={**peer, "Authorization": f"Bearer {t}"}))
        for t in tokens
    ]
    assert [r.status_code for r in codes] == [401, 401, 429]


async def test_expired_token_is_keyed_by_address_not_its_sub(
    client: httpx.AsyncClient, limits: Limits, clock: Clock
) -> None:
    limits(default=2)
    old = clock() - timedelta(minutes=30)
    tokens = [create_access_token(uuid.uuid4(), TEST_JWT_SECRET, old) for _ in "abc"]
    peer = {"x-forwarded-for": "10.0.0.1"}
    codes = [
        (await client.get(f"{API}/me", headers={**peer, "Authorization": f"Bearer {t}"}))
        for t in tokens
    ]
    assert [r.status_code for r in codes] == [401, 401, 429]


async def test_sign_in_routes_ignore_a_valid_token_for_keying(
    client: httpx.AsyncClient, limits: Limits, signed_in: SignedIn
) -> None:
    users = [await signed_in(email=f"{n}@x.com") for n in "abc"]  # three different users
    limits(auth=2)
    peer = {"x-forwarded-for": "10.0.0.1"}
    codes = [await sign_in_hit(client, {**peer, **h}) for h in users]
    assert limited(codes) == [False, False, True]


async def test_ipv6_clients_are_keyed_by_their_64_network(
    client: httpx.AsyncClient, limits: Limits, dev_clock: Clock
) -> None:
    limits(default=2)

    def from_(ip: str) -> dict[str, str]:
        return {"x-forwarded-for": ip}

    same_64 = ["2001:db8:1:2::1", "2001:db8:1:2:aaaa::9", "2001:db8:1:2:ffff:ffff:ffff:ffff"]
    codes = [(await client.get(f"{API}/me", headers=from_(ip))).status_code for ip in same_64]
    assert codes == [200, 200, 429]
    assert (await client.get(f"{API}/me", headers=from_("2001:db8:1:3::1"))).status_code == 200


async def test_tutor_messages_have_their_own_limit_per_user(
    client: httpx.AsyncClient, limits: Limits, signed_in: SignedIn, fake_llm: FakeLLM
) -> None:
    fake_llm.events = [DONE]
    a, b = await signed_in(email=INVITED_EMAIL), await signed_in(email=INVITED_EMAIL)
    limits(default=100, tutor=2)

    async def send(headers: dict[str, str]) -> int:
        chat = (await client.post(f"{API}/tutor/sessions", json={}, headers=headers)).json()
        url = f"{API}/tutor/sessions/{chat['id']}/messages"
        return (await client.post(url, json={"text": "hi"}, headers=headers)).status_code

    assert [await send(a) for _ in range(3)] == [200, 200, 429]
    assert (await client.get(f"{API}/tutor/sessions", headers=a)).status_code == 200
    assert await send(b) == 200


async def test_health_is_never_limited(
    client: httpx.AsyncClient, limits: Limits, dev_clock: Clock
) -> None:
    limits(default=1, auth=1, tutor=1)
    for _ in range(5):
        assert (await client.get("/health")).status_code == 200


def test_limits_default_to_120_20_and_10_per_minute(monkeypatch: pytest.MonkeyPatch) -> None:
    for group in ("DEFAULT", "AUTH", "TUTOR"):
        monkeypatch.delenv(f"RATE_LIMIT_{group}_PER_MINUTE", raising=False)
    monkeypatch.delenv("PROXY_SHARED_SECRET", raising=False)
    s = Settings(_env_file=None)  # type: ignore[call-arg]
    assert (
        s.rate_limit_default_per_minute,
        s.rate_limit_auth_per_minute,
        s.rate_limit_tutor_per_minute,
    ) == (120, 20, 10)
    assert s.proxy_shared_secret is None


async def test_stale_buckets_are_dropped(
    client: httpx.AsyncClient, limits: Limits, dev_clock: Clock
) -> None:
    limits(default=100)
    for i in range(5):
        await client.get(f"{API}/me", headers={"x-forwarded-for": f"10.0.0.{i}"})
    assert len(limiter) == 5

    dev_clock.advance(61)
    await client.get(f"{API}/me", headers={"x-forwarded-for": "10.0.0.9"})
    assert len(limiter) == 1


async def test_429_is_logged_as_a_warning_naming_the_limit(
    client: httpx.AsyncClient,
    limits: Limits,
    dev_clock: Clock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    limits(auth=1)
    await sign_in_hit(client)
    caplog.clear()
    caplog.set_level(logging.INFO, logger="cortex.access")
    assert await sign_in_hit(client) == 429

    [record] = [r for r in caplog.records if r.name == "cortex.access"]
    assert record.levelno == logging.WARNING and not record.exc_info
    assert "429" in record.getMessage() and "limit=auth" in record.getMessage()
