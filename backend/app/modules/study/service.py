import math
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import utcnow
from app.core.errors import NotFound, ValidationFailed
from app.modules.practice.catalog import PracticeCatalog, get_practice
from app.modules.practice.repository import SubmissionRepository
from app.modules.progress.schemas import ProgressOut
from app.modules.progress.service import ProgressService
from app.modules.study.engine import CardState, Grade, preview_intervals, schedule, streaks
from app.modules.study.models import Flashcard, Note
from app.modules.study.repository import StudyRepository
from app.modules.study.schemas import (
    ActivityDay,
    ActivityOut,
    AddedCards,
    CardIn,
    CardList,
    CardOut,
    CardPatch,
    Focus,
    NoteList,
    NoteOut,
    NoteSummary,
    PlanIn,
    PlanOut,
    TodayOut,
    TodayProblem,
)
from app.modules.topics.models import Topic
from app.modules.topics.repository import TopicRepository
from app.modules.users.models import User

DIFFICULTY_ORDER = {"easy": 0, "medium": 1, "hard": 2}


def zone(tz: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValidationFailed(f"Unknown time zone '{tz}'", code="bad_time_zone") from exc


def day_bounds(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=tz)
    return start, start + timedelta(days=1)


def card_out(card: Flashcard, now: datetime) -> CardOut:
    state = CardState(card.ease, card.interval_days, card.reps, card.lapses)
    return CardOut(
        id=card.id,
        topic_id=card.topic_id,
        kind=card.kind,
        front=card.front,
        back=card.back,
        reps=card.reps,
        lapses=card.lapses,
        interval_days=card.interval_days,
        due_at=card.due_at,
        last_reviewed_at=card.last_reviewed_at,
        next=preview_intervals(state, now),
    )


def topic_cards(topic: Topic) -> list[tuple[str, str, str]]:
    """(kind, front, back) for the cards a topic can generate."""
    out = []
    if topic.concepts:
        out.append(
            (
                "ideas",
                f"What are the key ideas of {topic.title}?",
                "\n".join(f"- {c}" for c in topic.concepts),
            )
        )
    pattern = topic.pattern or {}
    if pattern.get("signals"):
        out.append(
            (
                "signals",
                f"When should you reach for {topic.title}?",
                "\n".join(f"- {s}" for s in pattern["signals"]),
            )
        )
    if pattern.get("template"):
        out.append(
            ("template", f"Write the {topic.title} template from memory.", pattern["template"])
        )
    return out


class StudyService:
    def __init__(self, session: AsyncSession, catalog: PracticeCatalog | None = None) -> None:
        self.repo = StudyRepository(session)
        self.topics = TopicRepository(session)
        self.progress = ProgressService(session)
        self.submissions = SubmissionRepository(session)
        self.practice = catalog or get_practice()

    # ------------------------------------------------------------ flashcards

    async def cards(self, user: User, topic_id: str | None) -> CardList:
        now = utcnow()
        return CardList(items=[card_out(c, now) for c in await self.repo.cards(user.id, topic_id)])

    async def due(self, user: User, limit: int) -> CardList:
        now = utcnow()
        return CardList(items=[card_out(c, now) for c in await self.repo.due(user.id, now, limit)])

    async def add_card(self, user: User, body: CardIn) -> CardOut:
        if body.topic_id is not None:
            await self._topic(body.topic_id)
        card = await self.repo.add(
            Flashcard(
                user_id=user.id,
                topic_id=body.topic_id,
                kind="custom",
                front=body.front.strip(),
                back=body.back.strip(),
                due_at=utcnow(),
            )
        )
        return card_out(card, utcnow())

    async def add_topic_cards(self, user: User, topic_id: str) -> AddedCards:
        topic = await self._topic(topic_id)
        options = topic_cards(topic)
        if not options:
            raise ValidationFailed(
                f"{topic.title} has no key ideas to review yet", code="nothing_to_review"
            )
        have = await self.repo.kinds_for_topic(user.id, topic_id)
        now = utcnow()
        added = []
        for kind, front, back in options:
            if kind in have:
                continue
            added.append(
                await self.repo.add(
                    Flashcard(
                        user_id=user.id,
                        topic_id=topic_id,
                        kind=kind,
                        front=front,
                        back=back,
                        due_at=now,
                    )
                )
            )
        return AddedCards(added=len(added), items=[card_out(c, now) for c in added])

    async def review(self, user: User, card_id: int, grade: Grade) -> CardOut:
        card = await self._card(user, card_id)
        now = utcnow()
        state, due = schedule(
            CardState(card.ease, card.interval_days, card.reps, card.lapses), grade, now
        )
        card.ease, card.interval_days = state.ease, state.interval_days
        card.reps, card.lapses = state.reps, state.lapses
        card.due_at, card.last_reviewed_at = due, now
        await self.repo.log_review(user.id, card.id, grade, now)
        return card_out(card, now)

    async def edit_card(self, user: User, card_id: int, body: CardPatch) -> CardOut:
        card = await self._card(user, card_id)
        if body.front is not None:
            card.front = body.front.strip()
        if body.back is not None:
            card.back = body.back.strip()
        return card_out(card, utcnow())

    async def delete_card(self, user: User, card_id: int) -> None:
        await self.repo.delete(await self._card(user, card_id))

    # ------------------------------------------------------------ notes

    async def note(self, user: User, topic_id: str) -> NoteOut:
        await self._topic(topic_id)
        note = await self.repo.note(user.id, topic_id)
        return NoteOut(
            topic_id=topic_id,
            body=note.body if note else "",
            updated_at=note.updated_at if note else None,
        )

    async def save_note(self, user: User, topic_id: str, body: str) -> NoteOut:
        await self._topic(topic_id)
        if not body.strip():
            existing = await self.repo.note(user.id, topic_id)
            if existing is not None:
                await self.repo.delete_note(existing)
            return NoteOut(topic_id=topic_id, body="", updated_at=None)
        note = await self.repo.save_note(user.id, topic_id, body, utcnow())
        return NoteOut(topic_id=topic_id, body=note.body, updated_at=note.updated_at)

    async def notes(self, user: User) -> NoteList:
        return NoteList(items=[_summary(n) for n in await self.repo.notes(user.id)])

    # ------------------------------------------------------------ activity

    async def activity(self, user: User, days: int, tz: str) -> ActivityOut:
        z = zone(tz)
        today = utcnow().astimezone(z).date()
        since, _ = day_bounds(today - timedelta(days=days - 1), z)
        rows = await self.repo.activity(user.id, tz, since)
        current, longest = streaks({d for d, n in rows if n}, today)
        return ActivityOut(
            days=[ActivityDay(date=d, count=n) for d, n in rows],
            streak=current,
            longest_streak=longest,
            active_days=len(rows),
            total=sum(n for _, n in rows),
        )

    # ------------------------------------------------------------ plan and today

    async def plan(self, user: User) -> PlanOut:
        plan = await self.repo.plan(user.id)
        if plan is None:
            return PlanOut()
        return PlanOut(
            target_date=plan.target_date,
            daily_problems=plan.daily_problems,
            daily_cards=plan.daily_cards,
            updated_at=plan.updated_at,
        )

    async def save_plan(self, user: User, body: PlanIn) -> PlanOut:
        await self.repo.save_plan(
            user.id, body.target_date, body.daily_problems, body.daily_cards, utcnow()
        )
        return await self.plan(user)

    async def today(self, user: User, tz: str) -> TodayOut:
        z = zone(tz)
        now = utcnow()
        local_today = now.astimezone(z).date()
        start, end = day_bounds(local_today, z)

        solved = {pid for _, pid in await self.submissions.solved(user.id)}
        remaining = sum(1 for p in self.practice.problems if p.id not in solved)
        plan = await self.plan(user)
        days_left = (plan.target_date - local_today).days if plan.target_date else None
        pace = (
            math.ceil(remaining / max(days_left, 1))
            if days_left is not None and days_left >= 0
            else None
        )

        overview = await self.progress.overview(user)  # shared by both picks below
        next_up = await self.progress.next_topics(user, 1, overview)
        focus = (
            Focus(
                topic_id=next_up.items[0].topic.id,
                title=next_up.items[0].topic.title,
                reason=next_up.items[0].reason,
            )
            if next_up.items
            else None
        )
        return TodayOut(
            date=local_today,
            problem=await self._pick_problem(overview, solved),
            solved_today=len(await self.repo.solved_between(user.id, start, end)),
            cards_due=await self.repo.count_due(user.id, now),
            reviewed_today=await self.repo.reviews_between(user.id, start, end),
            plan=plan,
            days_left=days_left,
            remaining_problems=remaining,
            pace=pace,
            focus=focus,
        )

    async def _pick_problem(self, overview: ProgressOut, solved: set[str]) -> TodayProblem | None:
        """The easiest unsolved problem in your weakest started topic (or the next new one)."""
        progress = {p.topic_id: p for p in overview.items}
        topics = {t.id: t for t in await self.topics.list_topics()}
        open_by_topic: dict[str, list[str]] = {}
        for p in self.practice.problems:
            if p.id not in solved and p.topic_id in topics:
                open_by_topic.setdefault(p.topic_id, []).append(p.id)
        if not open_by_topic:
            return None

        def rank(topic_id: str) -> tuple[int, float, int]:
            item = progress.get(topic_id)
            started = item is not None and item.status != "not_started"
            return (0 if started else 1, item.mastery if item else 0.0, topics[topic_id].position)

        topic_id = min(open_by_topic, key=rank)
        problems = [p for p in self.practice.problems if p.id in open_by_topic[topic_id]]
        pick = min(problems, key=lambda p: DIFFICULTY_ORDER[p.difficulty])
        item = progress.get(topic_id)
        if item is not None and item.status != "not_started":
            reason = f"Your weakest topic in progress ({round(item.mastery * 100)}% mastery)"
        else:
            reason = "The next topic you haven't started"
        return TodayProblem(
            id=pick.id,
            title=pick.title,
            topic_id=topic_id,
            topic_title=topics[topic_id].title,
            difficulty=pick.difficulty,
            reason=reason,
        )

    # ------------------------------------------------------------ helpers

    async def _topic(self, topic_id: str) -> Topic:
        topic = await self.topics.get(topic_id)
        if topic is None:
            raise NotFound(f"No topic with id '{topic_id}'", code="topic_not_found")
        return topic

    async def _card(self, user: User, card_id: int) -> Flashcard:
        card = await self.repo.card(user.id, card_id)
        if card is None:
            raise NotFound(f"No card with id {card_id}", code="card_not_found")
        return card


def _summary(note: Note) -> NoteSummary:
    first = next((line.strip() for line in note.body.splitlines() if line.strip()), "")
    return NoteSummary(
        topic_id=note.topic_id, preview=first.lstrip("#- ")[:140], updated_at=note.updated_at
    )
