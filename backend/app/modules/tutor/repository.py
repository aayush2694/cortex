import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import utcnow
from app.modules.tutor.models import ChatMessage, ChatSession


class TutorRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_session(
        self, user_id: uuid.UUID, topic_id: str | None, title: str
    ) -> ChatSession:
        chat = ChatSession(user_id=user_id, topic_id=topic_id, title=title)
        self.session.add(chat)
        await self.session.flush()
        return chat

    async def get_session(self, user_id: uuid.UUID, session_id: uuid.UUID) -> ChatSession | None:
        return await self.session.scalar(
            select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
        )

    async def list_sessions(self, user_id: uuid.UUID, limit: int = 50) -> Sequence[ChatSession]:
        stmt = (
            select(ChatSession)
            .where(ChatSession.user_id == user_id)
            .order_by(ChatSession.updated_at.desc())
            .limit(limit)
        )
        return (await self.session.scalars(stmt)).all()

    async def messages(self, session_id: uuid.UUID) -> Sequence[ChatMessage]:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at, ChatMessage.id)
        )
        return (await self.session.scalars(stmt)).all()

    async def add_message(
        self,
        chat: ChatSession,
        role: str,
        content: list[dict[str, Any]],
        model: str | None = None,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
    ) -> ChatMessage:
        msg = ChatMessage(
            session_id=chat.id,
            role=role,
            content=content,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
        chat.updated_at = utcnow()
        self.session.add(msg)
        await self.session.flush()
        return msg
