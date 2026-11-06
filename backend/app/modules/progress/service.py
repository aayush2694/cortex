from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import utcnow
from app.core.errors import NotFound
from app.modules.progress.engine import compute_mastery, recommend_next
from app.modules.progress.models import Progress
from app.modules.progress.repository import ProgressRepository
from app.modules.progress.schemas import (
    NextOut,
    ProgressItem,
    ProgressOut,
    RecommendationOut,
    Status,
)
from app.modules.topics.repository import TopicRepository
from app.modules.topics.schemas import TopicOut
from app.modules.users.models import User


def _days_since(ts: datetime | None, now: datetime) -> float:
    return 0.0 if ts is None else (now - ts).total_seconds() / 86400


class ProgressService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = ProgressRepository(session)
        self.topics = TopicRepository(session)

    async def overview(self, user: User) -> ProgressOut:
        """Every topic with your status; untouched topics show as not_started."""
        rows = {p.topic_id: p for p in await self.repo.list_for_user(user.id)}
        visualized = await self.repo.topics_with_event(user.id, "visualizer_completed")
        now = utcnow()
        items = []
        for t in await self.topics.list_topics():
            p = rows.get(t.id)
            if p is None:
                items.append(
                    ProgressItem(
                        topic_id=t.id, status="not_started", mastery=0.0, last_activity_at=None
                    )
                )
                continue
            # Apply time decay on read so scores fade if you stop practising.
            mastery = compute_mastery(
                p.status, t.id in visualized, _days_since(p.last_activity_at, now)
            )
            items.append(
                ProgressItem(
                    topic_id=t.id,
                    status=p.status,  # type: ignore[arg-type]
                    mastery=mastery,
                    last_activity_at=p.last_activity_at,
                )
            )
        return ProgressOut(items=items)

    async def set_status(self, user: User, topic_id: str, status: Status) -> ProgressItem:
        await self._require_topic(topic_id)
        row = await self.repo.get_or_create(user.id, topic_id)
        row.status = status
        await self.repo.add_event(user.id, topic_id, "status_set", {"status": status})
        return await self._refresh(user, row)

    async def record_event(self, user: User, topic_id: str, kind: str) -> ProgressItem:
        await self._require_topic(topic_id)
        row = await self.repo.get_or_create(user.id, topic_id)
        if kind == "visualizer_completed" and row.status == "not_started":
            row.status = "learning"
        await self.repo.add_event(user.id, topic_id, kind, {})
        return await self._refresh(user, row)

    async def next_topics(self, user: User, limit: int = 3) -> NextOut:
        topics = list(await self.topics.list_topics())
        requires: dict[str, list[str]] = {}
        for e in await self.topics.list_edges():
            requires.setdefault(e.to_topic, []).append(e.from_topic)
        mastery = {i.topic_id: i.mastery for i in (await self.overview(user)).items}
        recs = recommend_next(
            topic_ids=[t.id for t in topics],
            titles={t.id: t.title for t in topics},
            requires=requires,
            mastery=mastery,
            limit=limit,
        )
        by_id = {t.id: t for t in topics}
        return NextOut(
            items=[
                RecommendationOut(
                    topic=TopicOut.model_validate(by_id[r.topic_id]),
                    priority=r.priority,
                    reason=r.reason,
                )
                for r in recs
            ]
        )

    async def _refresh(self, user: User, row: Progress) -> ProgressItem:
        row.last_activity_at = utcnow()
        visualizer_done = await self.repo.has_event(user.id, row.topic_id, "visualizer_completed")
        row.mastery = compute_mastery(row.status, visualizer_done, 0.0)
        return ProgressItem(
            topic_id=row.topic_id,
            status=row.status,  # type: ignore[arg-type]
            mastery=row.mastery,
            last_activity_at=row.last_activity_at,
        )

    async def _require_topic(self, topic_id: str) -> None:
        if await self.topics.get(topic_id) is None:
            raise NotFound(f"No topic with id '{topic_id}'", code="topic_not_found")
