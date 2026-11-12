import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.practice.models import Submission


class SubmissionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, submission: Submission) -> Submission:
        self.session.add(submission)
        await self.session.flush()
        return submission

    async def recent(
        self, user_id: uuid.UUID, problem_id: str, limit: int = 20
    ) -> Sequence[Submission]:
        stmt = (
            select(Submission)
            .where(Submission.user_id == user_id, Submission.problem_id == problem_id)
            .order_by(Submission.created_at.desc(), Submission.id.desc())
            .limit(limit)
        )
        return (await self.session.scalars(stmt)).all()

    async def attempts(self, user_id: uuid.UUID) -> dict[str, int]:
        stmt = (
            select(Submission.problem_id, func.count())
            .where(Submission.user_id == user_id)
            .group_by(Submission.problem_id)
        )
        return {pid: n for pid, n in (await self.session.execute(stmt)).all()}

    async def solved(self, user_id: uuid.UUID) -> set[tuple[str, str]]:
        """(topic_id, problem_id) for every problem with at least one fully passing run."""
        stmt = (
            select(Submission.topic_id, Submission.problem_id)
            .where(Submission.user_id == user_id, Submission.passed == Submission.total)
            .distinct()
        )
        return {(t, p) for t, p in (await self.session.execute(stmt)).all()}
