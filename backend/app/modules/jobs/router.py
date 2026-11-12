from fastapi import APIRouter, Response

from app.core.auth import CurrentUser, DbSession
from app.modules.jobs.schemas import (
    ApplicationIn,
    ApplicationList,
    ApplicationOut,
    ApplicationPatch,
    MatchIn,
    MatchOut,
    ProfileIn,
    ProfileOut,
    QuestionBankOut,
    QuestionNoteIn,
    QuestionOut,
)
from app.modules.jobs.service import JobsService

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/applications", response_model=ApplicationList, summary="Your job applications")
async def applications(user: CurrentUser, session: DbSession) -> ApplicationList:
    return await JobsService(session).applications(user)


@router.post("/applications", response_model=ApplicationOut, status_code=201, summary="Track a job")
async def create(body: ApplicationIn, user: CurrentUser, session: DbSession) -> ApplicationOut:
    return await JobsService(session).create(user, body)


@router.patch(
    "/applications/{app_id}", response_model=ApplicationOut, summary="Update or move a job"
)
async def update(
    app_id: int, body: ApplicationPatch, user: CurrentUser, session: DbSession
) -> ApplicationOut:
    return await JobsService(session).update(user, app_id, body)


@router.delete("/applications/{app_id}", status_code=204, summary="Stop tracking a job")
async def delete(app_id: int, user: CurrentUser, session: DbSession) -> Response:
    await JobsService(session).delete(user, app_id)
    return Response(status_code=204)


@router.get("/profile", response_model=ProfileOut, summary="Your current pay")
async def profile(user: CurrentUser, session: DbSession) -> ProfileOut:
    return await JobsService(session).profile(user)


@router.put("/profile", response_model=ProfileOut, summary="Set your current pay")
async def save_profile(body: ProfileIn, user: CurrentUser, session: DbSession) -> ProfileOut:
    return await JobsService(session).save_profile(user, body)


@router.post(
    "/match",
    response_model=MatchOut,
    summary="Compare a resume with a job description",
    description="Nothing is stored: the texts are only used to compute the match.",
)
async def resume_match(body: MatchIn, session: DbSession) -> MatchOut:
    return JobsService(session).match(body.resume, body.job)


@router.get("/questions", response_model=QuestionBankOut, summary="Interview question bank")
async def questions(user: CurrentUser, session: DbSession) -> QuestionBankOut:
    return await JobsService(session).question_bank(user)


@router.put(
    "/questions/{question_id}",
    response_model=QuestionOut,
    summary="Mark a question practised or save your answer",
)
async def save_question(
    question_id: str, body: QuestionNoteIn, user: CurrentUser, session: DbSession
) -> QuestionOut:
    return await JobsService(session).save_question_note(user, question_id, body)
