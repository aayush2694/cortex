import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, utcnow


class Flashcard(Base):
    """A card to review with spaced repetition: made from a topic, or written by you."""

    __tablename__ = "flashcards"
    __table_args__ = (
        Index("ix_flashcards_user_due", "user_id", "due_at"),
        # One generated card of each kind per topic; your own cards can repeat freely.
        Index(
            "uq_flashcards_generated",
            "user_id",
            "topic_id",
            "kind",
            unique=True,
            postgresql_where=text("kind <> 'custom'"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    topic_id: Mapped[str | None] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20))  # ideas | signals | template | custom
    front: Mapped[str] = mapped_column(Text)
    back: Mapped[str] = mapped_column(Text)
    ease: Mapped[float] = mapped_column(Float, default=2.5)
    interval_days: Mapped[float] = mapped_column(Float, default=0.0)
    reps: Mapped[int] = mapped_column(Integer, default=0)
    lapses: Mapped[int] = mapped_column(Integer, default=0)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CardReview(Base):
    """Every review you did: feeds the activity heatmap and today's progress."""

    __tablename__ = "card_reviews"
    __table_args__ = (Index("ix_card_reviews_user_time", "user_id", "reviewed_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    card_id: Mapped[int] = mapped_column(ForeignKey("flashcards.id", ondelete="CASCADE"))
    grade: Mapped[str] = mapped_column(String(10))
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Note(Base):
    """Your own notes on a topic, in Markdown."""

    __tablename__ = "notes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    topic_id: Mapped[str] = mapped_column(
        ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True
    )
    body: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PrepPlan(Base):
    """Your interview prep goal: a target date and daily targets."""

    __tablename__ = "prep_plans"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    target_date: Mapped[date | None] = mapped_column(Date)
    daily_problems: Mapped[int] = mapped_column(SmallInteger, default=1)
    daily_cards: Mapped[int] = mapped_column(SmallInteger, default=10)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
