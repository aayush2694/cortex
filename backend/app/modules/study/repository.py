import uuid
from collections.abc import Sequence
from datetime import date, datetime

from sqlalchemy import func, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.practice.models import Submission
from app.modules.progress.models import ActivityEvent
from app.modules.study.models import CardReview, Flashcard, Note, PrepPlan


class StudyRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------ cards

    async def cards(self, user_id: uuid.UUID, topic_id: str | None = None) -> Sequence[Flashcard]:
        stmt = select(Flashcard).where(Flashcard.user_id == user_id)
        if topic_id is not None:
            stmt = stmt.where(Flashcard.topic_id == topic_id)
        return (await self.session.scalars(stmt.order_by(Flashcard.due_at, Flashcard.id))).all()

    async def due(self, user_id: uuid.UUID, now: datetime, limit: int) -> Sequence[Flashcard]:
        stmt = (
            select(Flashcard)
            .where(Flashcard.user_id == user_id, Flashcard.due_at <= now)
            .order_by(Flashcard.due_at, Flashcard.id)
            .limit(limit)
        )
        return (await self.session.scalars(stmt)).all()

    async def count_due(self, user_id: uuid.UUID, now: datetime) -> int:
        stmt = select(func.count()).where(Flashcard.user_id == user_id, Flashcard.due_at <= now)
        return int(await self.session.scalar(stmt) or 0)

    async def card(self, user_id: uuid.UUID, card_id: int) -> Flashcard | None:
        card = await self.session.get(Flashcard, card_id)
        return card if card is not None and card.user_id == user_id else None

    async def kinds_for_topic(self, user_id: uuid.UUID, topic_id: str) -> set[str]:
        stmt = select(Flashcard.kind).where(
            Flashcard.user_id == user_id, Flashcard.topic_id == topic_id
        )
        return set((await self.session.scalars(stmt)).all())

    async def add(self, card: Flashcard) -> Flashcard:
        self.session.add(card)
        await self.session.flush()
        return card

    async def delete(self, card: Flashcard) -> None:
        await self.session.delete(card)
        await self.session.flush()

    async def log_review(self, user_id: uuid.UUID, card_id: int, grade: str, at: datetime) -> None:
        self.session.add(CardReview(user_id=user_id, card_id=card_id, grade=grade, reviewed_at=at))
        await self.session.flush()

    async def reviews_between(self, user_id: uuid.UUID, start: datetime, end: datetime) -> int:
        stmt = select(func.count()).where(
            CardReview.user_id == user_id,
            CardReview.reviewed_at >= start,
            CardReview.reviewed_at < end,
        )
        return int(await self.session.scalar(stmt) or 0)

    # ------------------------------------------------------------ notes

    async def note(self, user_id: uuid.UUID, topic_id: str) -> Note | None:
        return await self.session.get(Note, (user_id, topic_id))

    async def notes(self, user_id: uuid.UUID) -> Sequence[Note]:
        stmt = select(Note).where(Note.user_id == user_id).order_by(Note.updated_at.desc())
        return (await self.session.scalars(stmt)).all()

    async def save_note(self, user_id: uuid.UUID, topic_id: str, body: str, at: datetime) -> Note:
        note = await self.note(user_id, topic_id)
        if note is None:
            note = Note(user_id=user_id, topic_id=topic_id, body=body, updated_at=at)
            self.session.add(note)
        else:
            note.body, note.updated_at = body, at
        await self.session.flush()
        return note

    async def delete_note(self, note: Note) -> None:
        await self.session.delete(note)
        await self.session.flush()

    # ------------------------------------------------------------ plan

    async def plan(self, user_id: uuid.UUID) -> PrepPlan | None:
        return await self.session.get(PrepPlan, user_id)

    async def save_plan(
        self,
        user_id: uuid.UUID,
        target_date: date | None,
        daily_problems: int,
        daily_cards: int,
        at: datetime,
    ) -> PrepPlan:
        plan = await self.plan(user_id)
        if plan is None:
            plan = PrepPlan(user_id=user_id)
            self.session.add(plan)
        plan.target_date = target_date
        plan.daily_problems = daily_problems
        plan.daily_cards = daily_cards
        plan.updated_at = at
        await self.session.flush()
        return plan

    # ------------------------------------------------------------ activity

    async def activity(
        self, user_id: uuid.UUID, tz: str, since: datetime
    ) -> list[tuple[date, int]]:
        """Actions per local calendar day: progress events, code submissions and card reviews."""
        moments = union_all(
            select(ActivityEvent.created_at.label("ts")).where(
                ActivityEvent.user_id == user_id, ActivityEvent.created_at >= since
            ),
            select(Submission.created_at.label("ts")).where(
                Submission.user_id == user_id, Submission.created_at >= since
            ),
            select(CardReview.reviewed_at.label("ts")).where(
                CardReview.user_id == user_id, CardReview.reviewed_at >= since
            ),
        ).subquery()
        day = func.date(func.timezone(tz, moments.c.ts)).label("day")
        rows = await self.session.execute(select(day, func.count()).group_by(day).order_by(day))
        return [(d, int(n)) for d, n in rows.all()]

    async def solved_between(self, user_id: uuid.UUID, start: datetime, end: datetime) -> set[str]:
        """Coding problems with a fully passing submission in [start, end)."""
        stmt = select(Submission.problem_id).where(
            Submission.user_id == user_id,
            Submission.passed == Submission.total,
            Submission.created_at >= start,
            Submission.created_at < end,
        )
        return set((await self.session.scalars(stmt)).all())
