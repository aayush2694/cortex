import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.jobs.models import Application, JobProfile, QuestionNote


class JobsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def applications(self, user_id: uuid.UUID) -> Sequence[Application]:
        stmt = (
            select(Application)
            .where(Application.user_id == user_id)
            .order_by(Application.status, Application.position, Application.id)
        )
        return (await self.session.scalars(stmt)).all()

    async def application(self, user_id: uuid.UUID, app_id: int) -> Application | None:
        app = await self.session.get(Application, app_id)
        return app if app is not None and app.user_id == user_id else None

    async def last_position(self, user_id: uuid.UUID, status: str) -> float:
        stmt = select(func.max(Application.position)).where(
            Application.user_id == user_id, Application.status == status
        )
        return float(await self.session.scalar(stmt) or 0.0)

    async def add(self, app: Application) -> Application:
        self.session.add(app)
        await self.session.flush()
        return app

    async def delete(self, app: Application) -> None:
        await self.session.delete(app)
        await self.session.flush()

    async def profile(self, user_id: uuid.UUID) -> JobProfile | None:
        return await self.session.get(JobProfile, user_id)

    async def save_profile(self, profile: JobProfile) -> JobProfile:
        self.session.add(profile)
        await self.session.flush()
        return profile

    async def notes(self, user_id: uuid.UUID) -> dict[str, QuestionNote]:
        stmt = select(QuestionNote).where(QuestionNote.user_id == user_id)
        return {n.question_id: n for n in (await self.session.scalars(stmt)).all()}

    async def note(self, user_id: uuid.UUID, question_id: str) -> QuestionNote | None:
        return await self.session.get(QuestionNote, (user_id, question_id))

    async def save_note(self, note: QuestionNote) -> QuestionNote:
        self.session.add(note)
        await self.session.flush()
        return note
