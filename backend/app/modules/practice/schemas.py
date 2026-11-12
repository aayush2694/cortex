from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Difficulty = Literal["easy", "medium", "hard"]


class ProblemSummary(BaseModel):
    id: str
    topic_id: str
    title: str
    difficulty: Difficulty
    solved: bool
    attempts: int


class ProblemList(BaseModel):
    items: list[ProblemSummary]


class CaseOut(BaseModel):
    args: list[Any]
    expected: Any
    hidden: bool


class ProblemDetail(ProblemSummary):
    statement: str
    function: str
    params: list[str]
    starter: str
    compare: str
    cases: list[CaseOut]
    hints: list[str]
    complexity: str


class SolutionOut(BaseModel):
    code: str
    explanation: str
    complexity: str


class SubmissionIn(BaseModel):
    # The browser runs the tests (in Pyodide) and reports the result. This is a learning app
    # for yourself, so the server trusts the report but checks that it is consistent.
    code: str = Field(max_length=20_000)
    passed: int = Field(ge=0)
    total: int = Field(ge=1)
    runtime_ms: float = Field(ge=0)


class SubmissionOut(BaseModel):
    id: int
    problem_id: str
    passed: int
    total: int
    runtime_ms: float
    accepted: bool
    created_at: datetime


class SubmissionList(BaseModel):
    items: list[SubmissionOut]
