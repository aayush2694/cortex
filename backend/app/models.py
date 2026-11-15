"""Import every table model so SQLAlchemy (and Alembic) know about all of them."""

from app.core.db import Base
from app.modules.auth.models import Identity, LoginCode, OAuthState, RefreshToken
from app.modules.jobs.models import Application, JobProfile, QuestionNote
from app.modules.practice.models import Submission
from app.modules.progress.models import ActivityEvent, Progress, SolvedProblem
from app.modules.study.models import CardReview, Flashcard, Note, PrepPlan
from app.modules.topics.models import Topic, TopicEdge
from app.modules.tutor.models import ChatMessage, ChatSession
from app.modules.users.models import User

__all__ = [
    "ActivityEvent",
    "Application",
    "Base",
    "CardReview",
    "ChatMessage",
    "ChatSession",
    "Flashcard",
    "Identity",
    "JobProfile",
    "LoginCode",
    "Note",
    "OAuthState",
    "PrepPlan",
    "QuestionNote",
    "Progress",
    "RefreshToken",
    "SolvedProblem",
    "Submission",
    "Topic",
    "TopicEdge",
    "User",
]
