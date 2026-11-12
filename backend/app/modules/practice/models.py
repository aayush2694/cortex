import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, utcnow


class Submission(Base):
    """One time you ran your code against every test case of a coding problem."""

    __tablename__ = "submissions"
    __table_args__ = (Index("ix_submissions_user_problem", "user_id", "problem_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    problem_id: Mapped[str] = mapped_column(String(80))
    code: Mapped[str] = mapped_column(Text)
    passed: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    runtime_ms: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
