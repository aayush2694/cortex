from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from app.core.auth import CurrentUser, DbSession
from app.modules.practice import harness
from app.modules.practice.schemas import (
    ProblemDetail,
    ProblemList,
    SolutionOut,
    SubmissionIn,
    SubmissionList,
    SubmissionOut,
)
from app.modules.practice.service import PracticeService

router = APIRouter(prefix="/practice", tags=["practice"])

HARNESS_SOURCE = Path(harness.__file__).read_text(encoding="utf-8")


@router.get(
    "/runtime",
    response_class=PlainTextResponse,
    summary="The Python test harness the browser runs in Pyodide",
)
async def runtime() -> str:
    return HARNESS_SOURCE


@router.get("/problems", response_model=ProblemList, summary="Coding problems, with your status")
async def list_problems(
    user: CurrentUser, session: DbSession, topic_id: str | None = None
) -> ProblemList:
    return await PracticeService(session).list(user, topic_id)


@router.get("/problems/{problem_id}", response_model=ProblemDetail, summary="One coding problem")
async def get_problem(problem_id: str, user: CurrentUser, session: DbSession) -> ProblemDetail:
    return await PracticeService(session).detail(user, problem_id)


@router.get(
    "/problems/{problem_id}/solution", response_model=SolutionOut, summary="Reference solution"
)
async def get_solution(problem_id: str, session: DbSession) -> SolutionOut:
    return PracticeService(session).solution(problem_id)


@router.post(
    "/problems/{problem_id}/submissions",
    response_model=SubmissionOut,
    status_code=201,
    summary="Save a run of your code against every test case",
)
async def submit(
    problem_id: str, body: SubmissionIn, user: CurrentUser, session: DbSession
) -> SubmissionOut:
    return await PracticeService(session).submit(user, problem_id, body)


@router.get(
    "/problems/{problem_id}/submissions",
    response_model=SubmissionList,
    summary="Your recent submissions for a problem",
)
async def history(problem_id: str, user: CurrentUser, session: DbSession) -> SubmissionList:
    return await PracticeService(session).history(user, problem_id)
