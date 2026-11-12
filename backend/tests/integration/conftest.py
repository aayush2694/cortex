from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
from sqlalchemy import text

from app.clients.llm import LLMEvent, get_llm
from app.core.db import get_engine
from app.main import app, sync_topics
from app.models import Base


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
async def clean_user_data() -> AsyncIterator[None]:
    yield
    async with get_engine().begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE users, progress, activity_events, solved_problems, chat_sessions, "
                "chat_messages, submissions, flashcards, card_reviews, notes, prep_plans, "
                "applications, job_profiles, question_notes "
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
