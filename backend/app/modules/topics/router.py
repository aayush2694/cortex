from typing import Literal

from fastapi import APIRouter

from app.core.auth import DbSession
from app.modules.topics.schemas import KnowledgeMapOut, TopicDetailOut
from app.modules.topics.service import TopicService

router = APIRouter(prefix="/topics", tags=["topics"])


@router.get("", response_model=KnowledgeMapOut, summary="The knowledge map: all topics and edges")
async def get_knowledge_map(
    session: DbSession,
    track: Literal["dsa", "languages", "frameworks", "ai", "system-design"] | None = None,
) -> KnowledgeMapOut:
    return await TopicService(session).knowledge_map(track)


@router.get("/{topic_id}", response_model=TopicDetailOut, summary="One topic with its neighbours")
async def get_topic(topic_id: str, session: DbSession) -> TopicDetailOut:
    return await TopicService(session).detail(topic_id)
