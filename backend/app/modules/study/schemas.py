from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

Grade = Literal["again", "hard", "good", "easy"]


class CardOut(BaseModel):
    id: int
    topic_id: str | None
    kind: str
    front: str
    back: str
    reps: int
    lapses: int
    interval_days: float
    due_at: datetime
    last_reviewed_at: datetime | None
    # Days until the card comes back for each grade, shown on the review buttons.
    next: dict[str, float]


class CardList(BaseModel):
    items: list[CardOut]


class CardIn(BaseModel):
    topic_id: str | None = None
    front: str = Field(min_length=1, max_length=2000)
    back: str = Field(min_length=1, max_length=5000)


class CardPatch(BaseModel):
    """Change a card's wording. Its review schedule is kept."""

    front: str | None = Field(default=None, min_length=1, max_length=2000)
    back: str | None = Field(default=None, min_length=1, max_length=5000)


class AddedCards(BaseModel):
    added: int
    items: list[CardOut]


class ReviewIn(BaseModel):
    grade: Grade


class NoteIn(BaseModel):
    body: str = Field(max_length=50_000)


class NoteOut(BaseModel):
    topic_id: str
    body: str
    updated_at: datetime | None


class NoteSummary(BaseModel):
    topic_id: str
    preview: str
    updated_at: datetime


class NoteList(BaseModel):
    items: list[NoteSummary]


class ActivityDay(BaseModel):
    date: date
    count: int


class ActivityOut(BaseModel):
    days: list[ActivityDay]
    streak: int
    longest_streak: int
    active_days: int
    total: int


class PlanIn(BaseModel):
    target_date: date | None = None
    daily_problems: int = Field(default=1, ge=0, le=20)
    daily_cards: int = Field(default=10, ge=0, le=200)


class PlanOut(PlanIn):
    updated_at: datetime | None = None


class TodayProblem(BaseModel):
    id: str
    title: str
    topic_id: str
    topic_title: str
    difficulty: str
    reason: str


class Focus(BaseModel):
    topic_id: str
    title: str
    reason: str


class TodayOut(BaseModel):
    date: date
    problem: TodayProblem | None
    solved_today: int
    cards_due: int
    reviewed_today: int
    plan: PlanOut
    days_left: int | None
    remaining_problems: int
    # Problems a day needed to finish every coding problem by the target date.
    pace: int | None
    focus: Focus | None
