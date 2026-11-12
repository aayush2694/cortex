import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.progress.models import ActivityEvent, Progress, SolvedProblem


class ProgressRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_for_user(self, user_id: uuid.UUID) -> Sequence[Progress]:
        return (
            await self.session.scalars(select(Progress).where(Progress.user_id == user_id))
        ).all()

    async def get(self, user_id: uuid.UUID, topic_id: str) -> Progress | None:
        return await self.session.get(Progress, (user_id, topic_id))

    async def get_or_create(self, user_id: uuid.UUID, topic_id: str) -> Progress:
        row = await self.get(user_id, topic_id)
        if row is None:
            row = Progress(user_id=user_id, topic_id=topic_id, status="not_started", mastery=0.0)
            self.session.add(row)
        return row

    async def add_event(
        self, user_id: uuid.UUID, topic_id: str, kind: str, payload: dict[str, Any]
    ) -> None:
        self.session.add(
            ActivityEvent(user_id=user_id, topic_id=topic_id, kind=kind, payload=payload)
        )
        await self.session.flush()

    async def solved(self, user_id: uuid.UUID) -> Sequence[SolvedProblem]:
        stmt = select(SolvedProblem).where(SolvedProblem.user_id == user_id)
        return (await self.session.scalars(stmt.order_by(SolvedProblem.solved_at))).all()

    async def set_solved(self, user_id: uuid.UUID, topic_id: str, slug: str, solved: bool) -> None:
        row = await self.session.get(SolvedProblem, (user_id, slug))
        if solved and row is None:
            self.session.add(SolvedProblem(user_id=user_id, topic_id=topic_id, slug=slug))
        elif not solved and row is not None:
            await self.session.delete(row)
        await self.session.flush()

    async def topics_with_event(self, user_id: uuid.UUID, kind: str) -> set[str]:
        stmt = (
            select(ActivityEvent.topic_id)
            .where(ActivityEvent.user_id == user_id, ActivityEvent.kind == kind)
            .distinct()
        )
        return set((await self.session.scalars(stmt)).all())

    async def has_event(self, user_id: uuid.UUID, topic_id: str, kind: str) -> bool:
        stmt = select(
            exists().where(
                ActivityEvent.user_id == user_id,
                ActivityEvent.topic_id == topic_id,
                ActivityEvent.kind == kind,
            )
        )
        return bool(await self.session.scalar(stmt))
