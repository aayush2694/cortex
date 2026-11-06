"""The only place that talks to the Claude API.

Services call `LLMClient.stream(...)` and get simple events back:
    delta   -> a piece of the reply text
    done    -> the reply finished (with content blocks + token usage)
    refused -> the model declined; the UI shows a polite message
    error   -> something went wrong (code + message)
"""

import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

import anthropic

from app.core.config import Settings, get_settings

log = logging.getLogger(__name__)

EventType = Literal["delta", "done", "refused", "error"]

# Server-side fallback: if a safety classifier declines a harmless request (rare false
# positive), the API retries it on a recommended fallback model inside the same call.
FALLBACK_BETA = "server-side-fallback-2026-07-01"

NOT_CONFIGURED = "The AI tutor isn't set up yet: add ANTHROPIC_API_KEY to backend/.env"


@dataclass
class LLMEvent:
    type: EventType
    text: str = ""
    data: dict[str, Any] = field(default_factory=dict)


class LLMClient(Protocol):
    def stream(
        self, system: list[dict[str, Any]], messages: list[dict[str, Any]]
    ) -> AsyncIterator[LLMEvent]: ...


class ClaudeClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: anthropic.AsyncAnthropic | None = None

    def _get_client(self) -> anthropic.AsyncAnthropic:
        if self._client is None:
            # Key from settings (.env / environment); if unset, the SDK finds its own.
            key = self.settings.anthropic_api_key or None
            self._client = (
                anthropic.AsyncAnthropic(api_key=key) if key else anthropic.AsyncAnthropic()
            )
        return self._client

    async def stream(
        self, system: list[dict[str, Any]], messages: list[dict[str, Any]]
    ) -> AsyncIterator[LLMEvent]:
        try:
            client = self._get_client()
            async with client.beta.messages.stream(
                model=self.settings.tutor_model,
                max_tokens=self.settings.tutor_max_tokens,
                system=system,  # type: ignore[arg-type]
                messages=messages,  # type: ignore[arg-type]
                thinking={"type": "adaptive"},
                output_config={"effort": self.settings.tutor_effort},
                betas=[FALLBACK_BETA],
                fallbacks="default",
            ) as stream:
                async for text in stream.text_stream:
                    yield LLMEvent("delta", text)
                final = await stream.get_final_message()
        except anthropic.AuthenticationError:
            yield _error("ai_not_configured", NOT_CONFIGURED)
            return
        except anthropic.PermissionDeniedError:
            yield _error("ai_not_configured", "This API key can't use the tutor model")
            return
        except anthropic.RateLimitError:
            yield _error("ai_rate_limited", "The AI tutor is busy. Try again in a minute.")
            return
        except (anthropic.APIConnectionError, anthropic.InternalServerError):
            yield _error("ai_unavailable", "Couldn't reach the AI tutor. Try again shortly.")
            return
        except anthropic.APIStatusError as exc:
            log.warning("Claude API error %s: %s", exc.status_code, exc.message)
            yield _error("ai_error", "The AI tutor hit an error answering that.")
            return
        except anthropic.AnthropicError as exc:
            log.warning("Claude client error: %s", exc)
            yield _error("ai_error", "The AI tutor hit an error answering that.")
            return
        except TypeError as exc:
            # The SDK raises TypeError when it finds no credentials at all.
            if "authentication" not in str(exc).lower():
                raise
            yield _error("ai_not_configured", NOT_CONFIGURED)
            return

        if final.stop_reason == "refusal":
            # Discard any partial text; the UI replaces it with a polite message.
            yield LLMEvent(
                "refused",
                data={
                    "message": "I can't help with that one. "
                    "Try rephrasing, or ask about something else."
                },
            )
            return

        yield LLMEvent(
            "done",
            data={
                "content": [b.model_dump(mode="json", exclude_none=True) for b in final.content],
                "stop_reason": final.stop_reason,
                "model": final.model,
                "input_tokens": final.usage.input_tokens,
                "output_tokens": final.usage.output_tokens,
            },
        )


def _error(code: str, message: str) -> LLMEvent:
    return LLMEvent("error", data={"code": code, "message": message})


_llm: LLMClient | None = None


def get_llm() -> LLMClient:
    """FastAPI dependency. Tests override this with a fake client."""
    global _llm
    if _llm is None:
        _llm = ClaudeClient(get_settings())
    return _llm
