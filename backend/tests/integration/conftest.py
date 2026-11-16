from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
import pytest
from sqlalchemy import text

from app.clients.llm import LLMEvent, get_llm
from app.core.config import Settings, get_settings
from app.core.db import get_engine, get_sessionmaker
from app.core.rate_limit import limiter
from app.main import app, sync_topics
from app.models import Base
from app.modules.auth.models import Identity
from app.modules.auth.providers import Profile, ProviderError
from app.modules.auth.router import get_clock, get_providers
from app.modules.auth.tokens import create_access_token
from app.modules.users.models import User


class FakeLLM:
    """Stands in for Claude in tests. Set `.events` to control what it streams."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.events: list[LLMEvent] = []

    async def stream(
        self, system: list[dict[str, Any]], messages: list[dict[str, Any]]
    ) -> AsyncIterator[LLMEvent]:
        self.calls.append({"system": system, "messages": messages})
        for e in self.events:
            yield e


@pytest.fixture(scope="session", autouse=True)
async def database() -> AsyncIterator[None]:
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await sync_topics()
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
def fresh_rate_limits() -> None:
    limiter.reset()  # each test starts with empty request counts


@pytest.fixture(autouse=True)
async def clean_user_data() -> AsyncIterator[None]:
    yield
    async with get_engine().begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE users, progress, activity_events, solved_problems, chat_sessions, "
                "chat_messages, submissions, flashcards, card_reviews, notes, prep_plans, "
                "applications, job_profiles, question_notes, identities, oauth_states, "
                "login_codes, refresh_tokens "
                "RESTART IDENTITY CASCADE"
            )
        )


@pytest.fixture
def fake_llm() -> AsyncIterator[FakeLLM]:
    fake = FakeLLM()
    app.dependency_overrides[get_llm] = lambda: fake
    yield fake  # type: ignore[misc]
    app.dependency_overrides.pop(get_llm, None)


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class FakeProvider:
    """Stands in for GitHub or Google. Set `.profile` (or `.fail`) before the callback."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.profile = Profile(name, "1", None, False, "Test Person", None)
        self.fail = False
        self.calls: list[dict[str, str]] = []

    def authorize_url(self, state: str, challenge: str, redirect_uri: str) -> str:
        query = urlencode(
            {"state": state, "code_challenge": challenge, "redirect_uri": redirect_uri}
        )
        return f"https://{self.name}.provider.test/authorize?{query}"

    async def fetch_profile(
        self, code: str, verifier: str, redirect_uri: str, client: httpx.AsyncClient
    ) -> Profile:
        self.calls.append({"code": code, "verifier": verifier, "redirect_uri": redirect_uri})
        if self.fail:
            raise ProviderError()
        return self.profile


class Clock:
    """A clock the test moves by hand."""

    def __init__(self) -> None:
        self.now = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += timedelta(seconds=seconds)


INVITED_EMAIL = "invited@x.com"
TEST_JWT_SECRET = "test-only-secret-0123456789abcdef"  # 33 bytes, not a real secret


@pytest.fixture
def auth_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[Settings]:
    """jwt mode with GitHub configured; restores dev mode afterwards."""
    for name, value in {
        "AUTH_MODE": "jwt",
        "JWT_SECRET": TEST_JWT_SECRET,
        "FRONTEND_URL": "http://web.test",
        "GITHUB_CLIENT_ID": "test-github-id",
        "GITHUB_CLIENT_SECRET": "test-github-secret",
        "GOOGLE_CLIENT_ID": "",
        "GOOGLE_CLIENT_SECRET": "",
        "TUTOR_INVITED_EMAILS": INVITED_EMAIL.upper(),
    }.items():
        monkeypatch.setenv(name, value)
    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()


@pytest.fixture
def clock(auth_settings: Settings) -> Iterator[Clock]:
    c = Clock()
    app.dependency_overrides[get_clock] = lambda: c
    yield c
    app.dependency_overrides.pop(get_clock, None)


@pytest.fixture
def providers(auth_settings: Settings) -> Iterator[dict[str, FakeProvider]]:
    fakes = {"github": FakeProvider("github"), "google": FakeProvider("google")}
    app.dependency_overrides[get_providers] = lambda: fakes
    yield fakes
    app.dependency_overrides.pop(get_providers, None)


SignedIn = Callable[..., Awaitable[dict[str, str]]]


@pytest.fixture
def signed_in(clock: Clock) -> SignedIn:
    """Create a user (with one identity) and return their bearer headers."""

    async def make(
        email: str | None = "a@x.com", verified: bool = True, name: str = "Test Person"
    ) -> dict[str, str]:
        async with get_sessionmaker()() as db:
            user = User(display_name=name, email=email)
            db.add(user)
            await db.flush()
            db.add(
                Identity(
                    user_id=user.id,
                    provider="github",
                    provider_user_id=str(user.id),
                    email=email,
                    email_verified=verified,
                )
            )
            await db.commit()
            token = create_access_token(user.id, TEST_JWT_SECRET, clock())
        return {"Authorization": f"Bearer {token}"}

    return make
