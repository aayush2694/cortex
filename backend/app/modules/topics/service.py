from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.modules.topics.repository import TopicRepository
from app.modules.topics.schemas import EdgeOut, KnowledgeMapOut, TopicDetailOut, TopicOut


class TopicService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = TopicRepository(session)

    async def knowledge_map(self, track: str | None = None) -> KnowledgeMapOut:
        topics = [t for t in await self.repo.list_topics() if track is None or t.track == track]
        ids = {t.id for t in topics}
        edges = [
            EdgeOut(source=e.from_topic, target=e.to_topic)
            for e in await self.repo.list_edges()
            if e.from_topic in ids and e.to_topic in ids
        ]
        return KnowledgeMapOut(topics=[TopicOut.model_validate(t) for t in topics], edges=edges)

    async def detail(self, topic_id: str) -> TopicDetailOut:
        topic = await self.repo.get(topic_id)
        if topic is None:
            raise NotFound(f"No topic with id '{topic_id}'", code="topic_not_found")
        by_id = {t.id: t for t in await self.repo.list_topics()}
        edges = await self.repo.list_edges()
        requires = [by_id[e.from_topic] for e in edges if e.to_topic == topic_id]
        unlocks = [by_id[e.to_topic] for e in edges if e.from_topic == topic_id]
        return TopicDetailOut(
            **TopicOut.model_validate(topic).model_dump(),
            requires=[TopicOut.model_validate(t) for t in requires],
            unlocks=[TopicOut.model_validate(t) for t in unlocks],
        )
