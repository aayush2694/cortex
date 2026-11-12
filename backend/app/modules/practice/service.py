from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound, ValidationFailed
from app.modules.practice.catalog import CodingProblem, PracticeCatalog, get_practice
from app.modules.practice.models import Submission
from app.modules.practice.repository import SubmissionRepository
from app.modules.practice.schemas import (
    CaseOut,
    ProblemDetail,
    ProblemList,
    ProblemSummary,
    SolutionOut,
    SubmissionIn,
    SubmissionList,
    SubmissionOut,
)
from app.modules.progress.service import ProgressService
from app.modules.users.models import User


def _out(s: Submission) -> SubmissionOut:
    return SubmissionOut(
        id=s.id,
        problem_id=s.problem_id,
        passed=s.passed,
        total=s.total,
        runtime_ms=s.runtime_ms,
        accepted=s.passed == s.total,
        created_at=s.created_at,
    )


class PracticeService:
    def __init__(self, session: AsyncSession, catalog: PracticeCatalog | None = None) -> None:
        self.session = session
        self.repo = SubmissionRepository(session)
        self.catalog = catalog or get_practice()

    def _problem(self, problem_id: str) -> CodingProblem:
        problem = self.catalog.get(problem_id)
        if problem is None:
            raise NotFound(f"No coding problem with id '{problem_id}'", code="problem_not_found")
        return problem

    async def list(self, user: User, topic_id: str | None = None) -> ProblemList:
        solved = {pid for _, pid in await self.repo.solved(user.id)}
        attempts = await self.repo.attempts(user.id)
        return ProblemList(
            items=[
                ProblemSummary(
                    id=p.id,
                    topic_id=p.topic_id,
                    title=p.title,
                    difficulty=p.difficulty,
                    solved=p.id in solved,
                    attempts=attempts.get(p.id, 0),
                )
                for p in self.catalog.problems
                if topic_id is None or p.topic_id == topic_id
            ]
        )

    async def detail(self, user: User, problem_id: str) -> ProblemDetail:
        p = self._problem(problem_id)
        solved = (p.topic_id, p.id) in await self.repo.solved(user.id)
        return ProblemDetail(
            id=p.id,
            topic_id=p.topic_id,
            title=p.title,
            difficulty=p.difficulty,
            solved=solved,
            attempts=(await self.repo.attempts(user.id)).get(p.id, 0),
            language=p.language,
            statement=p.statement,
            function=p.function,
            params=p.params,
            starter=p.starter,
            compare=p.compare,
            arg_types=list(p.arg_types) if p.arg_types else None,
            returns=p.returns,
            cases=[CaseOut(args=c.args, expected=c.expected, hidden=c.hidden) for c in p.cases],
            setup=p.setup,
            tables=p.tables,
            output_columns=p.output_columns,
            hints=p.hints,
            complexity=p.complexity,
        )

    def solution(self, problem_id: str) -> SolutionOut:
        p = self._problem(problem_id)
        return SolutionOut(code=p.solution, explanation=p.explanation, complexity=p.complexity)

    async def submit(self, user: User, problem_id: str, body: SubmissionIn) -> SubmissionOut:
        p = self._problem(problem_id)
        if body.total != len(p.cases):
            raise ValidationFailed(
                f"'{p.title}' has {len(p.cases)} test cases, but {body.total} were reported",
                code="wrong_case_count",
            )
        if body.passed > body.total:
            raise ValidationFailed("passed can't be more than total", code="bad_result")
        already = (p.topic_id, p.id) in await self.repo.solved(user.id)
        sub = await self.repo.add(
            Submission(
                user_id=user.id,
                topic_id=p.topic_id,
                problem_id=p.id,
                code=body.code,
                passed=body.passed,
                total=body.total,
                runtime_ms=body.runtime_ms,
            )
        )
        if body.passed == body.total and not already:
            await ProgressService(self.session).record_practice_solved(user, p.topic_id, p.id)
        return _out(sub)

    async def history(self, user: User, problem_id: str) -> SubmissionList:
        self._problem(problem_id)
        return SubmissionList(items=[_out(s) for s in await self.repo.recent(user.id, problem_id)])
