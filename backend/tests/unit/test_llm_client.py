from typing import Any

import pytest

from app.clients import llm as llm_module
from app.clients.llm import ClaudeClient, LLMEvent
from app.core.config import Settings


async def collect(client: ClaudeClient) -> list[LLMEvent]:
    return [e async for e in client.stream([], [{"role": "user", "content": "hi"}])]


async def test_missing_credentials_becomes_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def no_credentials(*_: Any, **__: Any) -> None:
        raise TypeError('"Could not resolve authentication method. Expected one of api_key"')

    monkeypatch.setattr(llm_module.anthropic, "AsyncAnthropic", no_credentials)
    events = await collect(ClaudeClient(Settings(anthropic_api_key=None)))
    assert [(e.type, e.data["code"]) for e in events] == [("error", "ai_not_configured")]


async def test_unrelated_type_error_is_not_hidden(monkeypatch: pytest.MonkeyPatch) -> None:
    def broken(*_: Any, **__: Any) -> None:
        raise TypeError("some bug")

    monkeypatch.setattr(llm_module.anthropic, "AsyncAnthropic", broken)
    with pytest.raises(TypeError, match="some bug"):
        await collect(ClaudeClient(Settings()))
