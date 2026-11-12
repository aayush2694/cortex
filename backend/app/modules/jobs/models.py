import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, utcnow


class Application(Base):
    """A job you're interested in or applied to, tracked through the stages of a board.

    Money is in lakhs per annum (LPA). The offer fields are filled in once an offer arrives.
    """

    __tablename__ = "applications"
    __table_args__ = (Index("ix_applications_user_status", "user_id", "status"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    company: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="wishlist")
    position: Mapped[float] = mapped_column(Float, default=0.0)  # order within a column
    location: Mapped[str | None] = mapped_column(String(120))
    url: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(60))
    notes: Mapped[str] = mapped_column(Text, default="")
    applied_on: Mapped[date | None] = mapped_column(Date)
    next_step: Mapped[str | None] = mapped_column(String(200))
    next_step_on: Mapped[date | None] = mapped_column(Date)
    fixed: Mapped[float | None] = mapped_column(Float)
    variable: Mapped[float | None] = mapped_column(Float)
    joining_bonus: Mapped[float | None] = mapped_column(Float)
    stock_per_year: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class JobProfile(Base):
    """Your current pay, used to work out the hike each offer gives you."""

    __tablename__ = "job_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    current_ctc: Mapped[float | None] = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class QuestionNote(Base):
    """Your progress on an interview question: practised or not, and your own answer."""

    __tablename__ = "question_notes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    question_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    practised: Mapped[bool] = mapped_column(Boolean, default=False)
    answer: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
