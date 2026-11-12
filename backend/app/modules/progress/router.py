from typing import Annotated

from fastapi import APIRouter, Query

from app.core.auth import CurrentUser, DbSession
from app.modules.progress.schemas import (
    EventIn,
    NextOut,
    ProgressItem,
    ProgressOut,
    SetStatusIn,
    SolvedIn,
    SolvedOut,
)
from app.modules.progress.service import ProgressService

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("", response_model=ProgressOut, summary="Your status and mastery for every topic")
async def get_progress(user: CurrentUser, session: DbSession) -> ProgressOut:
    return await ProgressService(session).overview(user)


@router.get("/next", response_model=NextOut, summary="Recommended topics to study next")
async def get_next(
    user: CurrentUser, session: DbSession, limit: Annotated[int, Query(ge=1, le=10)] = 3
) -> NextOut:
    return await ProgressService(session).next_topics(user, limit)


@router.put("/{topic_id}", response_model=ProgressItem, summary="Set your status for a topic")
async def set_status(
    topic_id: str, body: SetStatusIn, user: CurrentUser, session: DbSession
) -> ProgressItem:
    return await ProgressService(session).set_status(user, topic_id, body.status)


@router.post("/{topic_id}/events", response_model=ProgressItem, summary="Record learning activity")
async def record_event(
    topic_id: str, body: EventIn, user: CurrentUser, session: DbSession
) -> ProgressItem:
    return await ProgressService(session).record_event(user, topic_id, body.kind)


@router.get("/problems", response_model=SolvedOut, summary="Practice problems you've solved")
async def get_solved(user: CurrentUser, session: DbSession) -> SolvedOut:
    return await ProgressService(session).solved_problems(user)


@router.put(
    "/{topic_id}/problems/{slug}",
    response_model=ProgressItem,
    summary="Mark a pattern's practice problem as solved (or not)",
)
async def set_solved(
    topic_id: str, slug: str, body: SolvedIn, user: CurrentUser, session: DbSession
) -> ProgressItem:
    return await ProgressService(session).set_solved(user, topic_id, slug, body.solved)
