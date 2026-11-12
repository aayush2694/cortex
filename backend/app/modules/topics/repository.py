from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.topics.catalog import Catalog
from app.modules.topics.models import Topic, TopicEdge


class TopicRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_topics(self) -> Sequence[Topic]:
        return (await self.session.scalars(select(Topic).order_by(Topic.position))).all()

    async def list_edges(self) -> Sequence[TopicEdge]:
        return (await self.session.scalars(select(TopicEdge))).all()

    async def get(self, topic_id: str) -> Topic | None:
        return await self.session.get(Topic, topic_id)

    async def sync_from_catalog(self, catalog: Catalog) -> None:
        """Make the topics tables match the YAML catalogue exactly."""
        ids = [t.id for t in catalog.topics]
        if catalog.topics:
            rows = [
                {
                    "id": t.id,
                    "track": t.track,
                    "title": t.title,
                    "summary": t.summary,
                    "difficulty": t.difficulty,
                    "phase": t.phase,
                    "visualizer": t.visualizer,
                    "position": i,
                    "resources": [r.model_dump(mode="json") for r in t.resources],
                    "concepts": t.concepts,
                    "pattern": t.pattern.model_dump(mode="json") if t.pattern else None,
                }
                for i, t in enumerate(catalog.topics)
            ]
            stmt = insert(Topic).values(rows)
            stmt = stmt.on_conflict_do_update(
                index_elements=[Topic.id],
                set_={c: stmt.excluded[c] for c in rows[0] if c != "id"},
            )
            await self.session.execute(stmt)

        await self.session.execute(delete(Topic).where(Topic.id.not_in(ids)))
        await self.session.execute(delete(TopicEdge))
        edges = [{"from_topic": r, "to_topic": t.id} for t in catalog.topics for r in t.requires]
        if edges:
            await self.session.execute(insert(TopicEdge).values(edges))
