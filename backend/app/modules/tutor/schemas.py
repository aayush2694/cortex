import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SessionCreateIn(BaseModel):
    topic_id: str | None = None


class SessionOut(BaseModel):
    id: uuid.UUID
    topic_id: str | None
    title: str
    created_at: datetime
    updated_at: datetime


class SessionListOut(BaseModel):
    items: list[SessionOut]


class MessageOut(BaseModel):
    id: uuid.UUID
    role: str
    text: str
    created_at: datetime


class SessionDetailOut(SessionOut):
    messages: list[MessageOut]


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
