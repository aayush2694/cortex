from sqlalchemy import ForeignKey, SmallInteger, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Topic(Base):
    """A node in the knowledge map. Source of truth is content/topics.yaml."""

    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    track: Mapped[str] = mapped_column(String(30), index=True)
    title: Mapped[str] = mapped_column(String(120))
    summary: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[int] = mapped_column(SmallInteger)
    phase: Mapped[int] = mapped_column(SmallInteger)
    visualizer: Mapped[str | None] = mapped_column(String(60))
    position: Mapped[int] = mapped_column(SmallInteger, default=0)
    # [{"label": "...", "url": "..."}] links to official docs
    resources: Mapped[list[dict[str, str]]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb")
    )


class TopicEdge(Base):
    """from_topic must be learned before to_topic."""

    __tablename__ = "topic_edges"

    from_topic: Mapped[str] = mapped_column(
        ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True
    )
    to_topic: Mapped[str] = mapped_column(
        ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True
    )
