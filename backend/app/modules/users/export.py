"""Everything a user has saved, as one JSON document they can download and keep."""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, DbSession
from app.core.db import Base
from app.modules.jobs.models import Application, JobProfile, QuestionNote
from app.modules.practice.models import Submission
from app.modules.progress.models import Progress, SolvedProblem
from app.modules.study.models import Flashcard, Note, PrepPlan
from app.modules.tutor.models import ChatMessage, ChatSession
from app.modules.users.models import User

router = APIRouter(prefix="/me", tags=["meta"])

# Section name -> table. Each table has a user_id column; it's left out of the export.
SECTIONS: dict[str, type[Base]] = {
    "progress": Progress,
    "solved_problems": SolvedProblem,
    "submissions": Submission,
    "flashcards": Flashcard,
    "notes": Note,
    "applications": Application,
    "question_notes": QuestionNote,
}


def _row(obj: Base, skip: tuple[str, ...] = ("user_id",)) -> dict[str, Any]:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns if c.name not in skip}


async def build_export(session: AsyncSession, user: User) -> dict[str, Any]:
    data: dict[str, Any] = {
        "format": "cortex-export-v1",
        "exported_at": datetime.now(UTC),
        "user": {"id": user.id, "display_name": user.display_name},
    }
    for name, model in SECTIONS.items():
        rows = await session.scalars(select(model).where(model.user_id == user.id))  # type: ignore[attr-defined]
        data[name] = [_row(r) for r in rows]

    plan = await session.get(PrepPlan, user.id)
    data["plan"] = _row(plan) if plan else None
    profile = await session.get(JobProfile, user.id)
    data["job_profile"] = _row(profile) if profile else None

    chats = await session.scalars(select(ChatSession).where(ChatSession.user_id == user.id))
    data["chats"] = []
    for chat in chats:
        messages = await session.scalars(
            select(ChatMessage)
            .where(ChatMessage.session_id == chat.id)
            .order_by(ChatMessage.created_at, ChatMessage.id)
        )
        data["chats"].append({**_row(chat), "messages": [_row(m, ()) for m in messages]})
    return data


@router.get(
    "/export",
    summary="Download everything you've saved",
    description="Progress, practice, flashcards, notes, job search and tutor chats as JSON.",
)
async def export(user: CurrentUser, session: DbSession) -> JSONResponse:
    stamp = datetime.now(UTC).strftime("%Y-%m-%d")
    return JSONResponse(
        jsonable_encoder(await build_export(session, user)),
        headers={"Content-Disposition": f'attachment; filename="cortex-export-{stamp}.json"'},
    )
