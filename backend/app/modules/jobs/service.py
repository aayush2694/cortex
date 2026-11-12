from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import utcnow
from app.core.errors import NotFound
from app.modules.jobs.content import QuestionBank, SkillBook, get_questions, get_skills
from app.modules.jobs.matcher import match
from app.modules.jobs.models import Application, JobProfile, QuestionNote
from app.modules.jobs.repository import JobsRepository
from app.modules.jobs.schemas import (
    ApplicationIn,
    ApplicationList,
    ApplicationOut,
    ApplicationPatch,
    CategoryOut,
    MatchOut,
    ProfileIn,
    ProfileOut,
    QuestionBankOut,
    QuestionNoteIn,
    QuestionOut,
    SkillOut,
)
from app.modules.users.models import User

# Moving to any of these stages means you have applied.
APPLIED_STAGES = {"applied", "interview", "offer", "rejected"}


def _out(app: Application) -> ApplicationOut:
    return ApplicationOut.model_validate(app, from_attributes=True)


class JobsService:
    def __init__(
        self,
        session: AsyncSession,
        skills: SkillBook | None = None,
        questions: QuestionBank | None = None,
    ) -> None:
        self.repo = JobsRepository(session)
        self.skills = skills or get_skills()
        self.questions = questions or get_questions()

    # ------------------------------------------------------------ applications

    async def applications(self, user: User) -> ApplicationList:
        return ApplicationList(items=[_out(a) for a in await self.repo.applications(user.id)])

    async def create(self, user: User, body: ApplicationIn) -> ApplicationOut:
        now = utcnow()
        app = Application(
            user_id=user.id,
            **body.model_dump(),
            position=await self.repo.last_position(user.id, body.status) + 1,
            created_at=now,
            updated_at=now,
        )
        if app.status in APPLIED_STAGES and app.applied_on is None:
            app.applied_on = now.date()
        return _out(await self.repo.add(app))

    async def update(self, user: User, app_id: int, body: ApplicationPatch) -> ApplicationOut:
        app = await self._get(user, app_id)
        changes = body.model_dump(exclude_unset=True)
        # Required fields can't be cleared.
        for required in ("company", "role", "status", "position", "notes"):
            if changes.get(required, "") is None:
                changes.pop(required)
        moved = "status" in changes and changes["status"] != app.status
        if moved and "position" not in changes:
            # Look up the target column before this card counts as part of it.
            changes["position"] = await self.repo.last_position(user.id, changes["status"]) + 1
        for field, value in changes.items():
            setattr(app, field, value)
        if app.status in APPLIED_STAGES and app.applied_on is None:
            app.applied_on = utcnow().date()
        app.updated_at = utcnow()
        return _out(app)

    async def delete(self, user: User, app_id: int) -> None:
        await self.repo.delete(await self._get(user, app_id))

    async def _get(self, user: User, app_id: int) -> Application:
        app = await self.repo.application(user.id, app_id)
        if app is None:
            raise NotFound(f"No application with id {app_id}", code="application_not_found")
        return app

    # ------------------------------------------------------------ profile

    async def profile(self, user: User) -> ProfileOut:
        p = await self.repo.profile(user.id)
        return ProfileOut(current_ctc=p.current_ctc, updated_at=p.updated_at) if p else ProfileOut()

    async def save_profile(self, user: User, body: ProfileIn) -> ProfileOut:
        p = await self.repo.profile(user.id) or JobProfile(user_id=user.id)
        p.current_ctc = body.current_ctc
        p.updated_at = utcnow()
        await self.repo.save_profile(p)
        return ProfileOut(current_ctc=p.current_ctc, updated_at=p.updated_at)

    # ------------------------------------------------------------ resume match

    def match(self, resume: str, job: str) -> MatchOut:
        result = match(resume, job, self.skills)

        def out(skills: list) -> list[SkillOut]:  # type: ignore[type-arg]
            return [SkillOut(name=s.name, category=s.category) for s in skills]

        return MatchOut(
            score=result.score,
            matched=out(result.matched),
            missing=out(result.missing),
            extra=out(result.extra),
        )

    # ------------------------------------------------------------ interview questions

    async def question_bank(self, user: User) -> QuestionBankOut:
        notes = await self.repo.notes(user.id)
        return QuestionBankOut(
            categories=[CategoryOut(id=c.id, label=c.label) for c in self.questions.categories],
            items=[self._question(q.id, notes.get(q.id)) for q in self.questions.questions],
        )

    async def save_question_note(
        self, user: User, question_id: str, body: QuestionNoteIn
    ) -> QuestionOut:
        if not any(q.id == question_id for q in self.questions.questions):
            raise NotFound(f"No question with id '{question_id}'", code="question_not_found")
        note = await self.repo.note(user.id, question_id) or QuestionNote(
            user_id=user.id, question_id=question_id, practised=False, answer=""
        )
        if body.practised is not None:
            note.practised = body.practised
        if body.my_answer is not None:
            note.answer = body.my_answer
        note.updated_at = utcnow()
        await self.repo.save_note(note)
        return self._question(question_id, note)

    def _question(self, question_id: str, note: QuestionNote | None) -> QuestionOut:
        q = next(q for q in self.questions.questions if q.id == question_id)
        return QuestionOut(
            id=q.id,
            category=q.category,
            difficulty=q.difficulty,
            question=q.question,
            answer=q.answer,
            practised=bool(note and note.practised),
            my_answer=note.answer if note else "",
            updated_at=note.updated_at if note else None,
        )
