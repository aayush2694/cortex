import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, utcnow


class Progress(Base):
    """Your current status and mastery for one topic (derived from activity_events)."""

    __tablename__ = "progress"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    topic_id: Mapped[str] = mapped_column(
        ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True
    )
    status: Mapped[str] = mapped_column(String(20), default="not_started")
    mastery: Mapped[float] = mapped_column(Float, default=0.0)
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SolvedProblem(Base):
    """A LeetCode practice problem you've marked as solved."""

    __tablename__ = "solved_problems"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    slug: Mapped[str] = mapped_column(String(120), primary_key=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    solved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ActivityEvent(Base):
    """Append-only log of everything you did. Mastery can always be recomputed from it."""

    __tablename__ = "activity_events"
    __table_args__ = (Index("ix_activity_events_user_topic", "user_id", "topic_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
