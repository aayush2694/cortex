from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.modules.topics.schemas import TopicOut

Status = Literal["not_started", "learning", "confident"]


class ProgressItem(BaseModel):
    topic_id: str
    status: Status
    mastery: float
    last_activity_at: datetime | None


class ProgressOut(BaseModel):
    items: list[ProgressItem]


class SetStatusIn(BaseModel):
    status: Status


class EventIn(BaseModel):
    kind: Literal["visualizer_completed"]


class RecommendationOut(BaseModel):
    topic: TopicOut
    priority: float
    reason: str


class NextOut(BaseModel):
    items: list[RecommendationOut]
