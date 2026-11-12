"""Import every table model so SQLAlchemy (and Alembic) know about all of them."""

from app.core.db import Base
from app.modules.practice.models import Submission
from app.modules.progress.models import ActivityEvent, Progress, SolvedProblem
from app.modules.topics.models import Topic, TopicEdge
from app.modules.tutor.models import ChatMessage, ChatSession
from app.modules.users.models import User

__all__ = [
    "ActivityEvent",
    "Base",
    "ChatMessage",
    "ChatSession",
    "Progress",
    "SolvedProblem",
    "Submission",
    "Topic",
    "TopicEdge",
    "User",
]
