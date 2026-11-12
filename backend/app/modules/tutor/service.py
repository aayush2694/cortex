import json
import logging
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, time, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.llm import LLMClient
from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.core.errors import NotFound, TooManyRequests
from app.modules.progress.service import ProgressService
from app.modules.topics.service import TopicService
from app.modules.tutor.models import ChatMessage, ChatSession
from app.modules.tutor.prompts import build_system, session_context, to_api_messages
from app.modules.tutor.repository import TutorRepository
from app.modules.tutor.schemas import MessageOut, SessionDetailOut, SessionOut
from app.modules.users.models import User

log = logging.getLogger(__name__)


def _text_of(blocks: list[dict[str, Any]]) -> str:
    return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")


def _session_out(chat: ChatSession) -> SessionOut:
    return SessionOut(
        id=chat.id,
        topic_id=chat.topic_id,
        title=chat.title,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
    )


def _message_out(m: ChatMessage) -> MessageOut:
    return MessageOut(id=m.id, role=m.role, text=_text_of(m.content), created_at=m.created_at)


def sse(event: str, data: dict[str, Any]) -> str:
    """Format one Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


class TutorService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TutorRepository(session)
        self.topics = TopicService(session)
        self.progress = ProgressService(session)

    async def _check_daily_limit(self, user: User) -> None:
        """Refuse before anything is saved or sent once today's (UTC) allowance is used."""
        limit = get_settings().tutor_daily_limit
        day_start = datetime.combine(datetime.now(UTC).date(), time.min, tzinfo=UTC)
        if await self.repo.user_messages_since(user.id, day_start) >= limit:
            raise TooManyRequests(
                f"You've used today's {limit} tutor {'message' if limit == 1 else 'messages'}. "
                "The limit resets at midnight UTC.",
                code="tutor_limit_reached",
                details={"limit": limit, "reset_at": (day_start + timedelta(days=1)).isoformat()},
            )

    async def create_session(self, user: User, topic_id: str | None) -> SessionOut:
        title = "General question"
        if topic_id is not None:
            title = (await self.topics.detail(topic_id)).title  # raises NotFound if unknown
        chat = await self.repo.create_session(user.id, topic_id, title)
        return _session_out(chat)

    async def list_sessions(self, user: User) -> list[SessionOut]:
        return [_session_out(c) for c in await self.repo.list_sessions(user.id)]

    async def get_session(self, user: User, session_id: uuid.UUID) -> SessionDetailOut:
        chat = await self._owned(user, session_id)
        messages = [_message_out(m) for m in await self.repo.messages(chat.id)]
        return SessionDetailOut(**_session_out(chat).model_dump(), messages=messages)

    async def prepare_turn(
        self, user: User, session_id: uuid.UUID, text: str
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Save the user's message and build the system prompt + messages for the model."""
        chat = await self._owned(user, session_id)
        await self._check_daily_limit(user)
        await self.repo.add_message(chat, "user", [{"type": "text", "text": text}])

        topic: dict[str, Any] | None = None
        if chat.topic_id:
            detail = await self.topics.detail(chat.topic_id)
            topic = {
                "title": detail.title,
                "track": detail.track,
                "summary": detail.summary,
                "requires": [t.title for t in detail.requires],
                "concepts": detail.concepts,
            }
        titles = {t.id: t.title for t in (await self.topics.knowledge_map()).topics}
        items = (await self.progress.overview(user)).items
        confident = [titles[i.topic_id] for i in items if i.status == "confident"]
        learning = [titles[i.topic_id] for i in items if i.status == "learning"]
        system = build_system(session_context(topic, confident, learning))

        history = [(m.role, m.content) for m in await self.repo.messages(chat.id)]
        limit = get_settings().tutor_history_turns * 2
        return system, to_api_messages(history[-limit:])

    async def _owned(self, user: User, session_id: uuid.UUID) -> ChatSession:
        chat = await self.repo.get_session(user.id, session_id)
        if chat is None:
            raise NotFound("Chat session not found", code="session_not_found")
        return chat


async def stream_reply(
    llm: LLMClient,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    system: list[dict[str, Any]],
    messages: list[dict[str, Any]],
) -> AsyncIterator[str]:
    """Stream the model's reply as SSE, then save it. Uses its own DB session because
    the request's session is already closed while the response is streaming.

    The stream always ends with exactly one of: done, refused, error.
    """
    try:
        async for event in llm.stream(system, messages):
            if event.type == "delta":
                yield sse("delta", {"text": event.text})
            elif event.type in ("refused", "error"):
                yield sse(event.type, event.data)
            elif event.type == "done":
                message_id = await _save_reply(user_id, session_id, event.data)
                if message_id is None:  # chat deleted mid-stream
                    yield sse("error", {"code": "session_not_found", "message": "Chat is gone"})
                else:
                    yield sse(
                        "done",
                        {"message_id": str(message_id), "stop_reason": event.data["stop_reason"]},
                    )
    except Exception:
        log.exception("Tutor stream failed")
        yield sse("error", {"code": "internal_error", "message": "Something went wrong"})


async def _save_reply(
    user_id: uuid.UUID, session_id: uuid.UUID, data: dict[str, Any]
) -> uuid.UUID | None:
    async with get_sessionmaker()() as db:
        repo = TutorRepository(db)
        chat = await repo.get_session(user_id, session_id)
        if chat is None:
            return None
        msg = await repo.add_message(
            chat,
            "assistant",
            data["content"],
            model=data.get("model"),
            input_tokens=data.get("input_tokens"),
            output_tokens=data.get("output_tokens"),
        )
        await db.commit()
        return msg.id
