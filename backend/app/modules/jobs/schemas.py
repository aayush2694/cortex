from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

Stage = Literal["wishlist", "applied", "interview", "offer", "rejected"]
Lpa = float  # lakhs per annum


class ApplicationFields(BaseModel):
    location: str | None = Field(default=None, max_length=120)
    url: str | None = Field(default=None, max_length=2000)
    source: str | None = Field(default=None, max_length=60)
    notes: str = Field(default="", max_length=20_000)
    applied_on: date | None = None
    next_step: str | None = Field(default=None, max_length=200)
    next_step_on: date | None = None
    fixed: Lpa | None = Field(default=None, ge=0, le=10_000)
    variable: Lpa | None = Field(default=None, ge=0, le=10_000)
    joining_bonus: Lpa | None = Field(default=None, ge=0, le=10_000)
    stock_per_year: Lpa | None = Field(default=None, ge=0, le=10_000)


class ApplicationIn(ApplicationFields):
    company: str = Field(min_length=1, max_length=120)
    role: str = Field(min_length=1, max_length=120)
    status: Stage = "wishlist"


class ApplicationPatch(ApplicationFields):
    """Send only the fields you want to change. `null` clears an optional field."""

    company: str | None = Field(default=None, min_length=1, max_length=120)
    role: str | None = Field(default=None, min_length=1, max_length=120)
    status: Stage | None = None
    position: float | None = None
    notes: str | None = Field(default=None, max_length=20_000)  # type: ignore[assignment]


class ApplicationOut(ApplicationFields):
    id: int
    company: str
    role: str
    status: Stage
    position: float
    created_at: datetime
    updated_at: datetime


class ApplicationList(BaseModel):
    items: list[ApplicationOut]


class ProfileIn(BaseModel):
    current_ctc: Lpa | None = Field(default=None, ge=0, le=10_000)


class ProfileOut(ProfileIn):
    updated_at: datetime | None = None


class MatchIn(BaseModel):
    resume: str = Field(min_length=1, max_length=50_000)
    job: str = Field(min_length=1, max_length=50_000)


class SkillOut(BaseModel):
    name: str
    category: str
    required: bool  # False when the job lists it as nice to have


class MatchOut(BaseModel):
    score: int
    matched: list[SkillOut]
    missing: list[SkillOut]
    extra: list[SkillOut]


class CategoryOut(BaseModel):
    id: str
    label: str


class QuestionOut(BaseModel):
    id: str
    category: str
    difficulty: str
    question: str
    answer: str
    practised: bool
    my_answer: str
    updated_at: datetime | None


class QuestionBankOut(BaseModel):
    categories: list[CategoryOut]
    items: list[QuestionOut]


class QuestionNoteIn(BaseModel):
    practised: bool | None = None
    my_answer: str | None = Field(default=None, max_length=20_000)
