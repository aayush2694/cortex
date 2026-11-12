"""Load and validate the coding problems from content/practice.yaml (no database)."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal

import yaml
from pydantic import BaseModel, Field

from app.core.config import get_settings

Compare = Literal["exact", "unordered", "unordered_nested"]
ArgType = Literal["plain", "list", "cycle_list", "tree"]  # see harness.py
ReturnType = Literal["plain", "list", "tree"]


class Case(BaseModel):
    args: list[Any]
    expected: Any
    hidden: bool = False


class CodingProblem(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=80)
    topic_id: str
    title: str = Field(max_length=120)
    difficulty: Literal["easy", "medium", "hard"]
    statement: str
    function: str = Field(pattern=r"^[a-z_][a-z0-9_]*$")
    params: list[str] = Field(min_length=1)
    starter: str
    compare: Compare = "exact"
    # How each argument is built (linked lists and trees arrive as plain JSON lists).
    arg_types: list[ArgType] | None = None
    returns: ReturnType = "plain"
    cases: list[Case] = Field(min_length=3)
    hints: list[Annotated[str, Field(max_length=240)]] = []
    solution: str
    explanation: str
    complexity: str = Field(max_length=80)


class PracticeCatalog(BaseModel):
    problems: list[CodingProblem]

    def get(self, problem_id: str) -> CodingProblem | None:
        return next((p for p in self.problems if p.id == problem_id), None)

    def count_by_topic(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for p in self.problems:
            counts[p.topic_id] = counts.get(p.topic_id, 0) + 1
        return counts


class PracticeCatalogError(ValueError):
    pass


def validate_practice(catalog: PracticeCatalog, topic_ids: set[str] | None = None) -> None:
    seen: set[str] = set()
    for p in catalog.problems:
        if p.id in seen:
            raise PracticeCatalogError(f"Duplicate problem id: {p.id}")
        seen.add(p.id)
        if topic_ids is not None and p.topic_id not in topic_ids:
            raise PracticeCatalogError(f"Problem '{p.id}' points at unknown topic '{p.topic_id}'")
        if f"def {p.function}(" not in p.starter:
            raise PracticeCatalogError(f"Starter code for '{p.id}' must define {p.function}()")
        if not any(not c.hidden for c in p.cases) or not any(c.hidden for c in p.cases):
            raise PracticeCatalogError(f"'{p.id}' needs both visible and hidden test cases")
        if p.arg_types is not None and len(p.arg_types) != len(p.params):
            raise PracticeCatalogError(f"'{p.id}' needs one arg type per parameter")
        for c in p.cases:
            if len(c.args) != len(p.params):
                raise PracticeCatalogError(
                    f"A case in '{p.id}' has {len(c.args)} args, expected {len(p.params)}"
                )


def load_practice(content_dir: str | Path, topic_ids: set[str] | None = None) -> PracticeCatalog:
    raw = yaml.safe_load((Path(content_dir) / "practice.yaml").read_text(encoding="utf-8"))
    catalog = PracticeCatalog.model_validate(raw)
    validate_practice(catalog, topic_ids)
    return catalog


@lru_cache
def get_practice() -> PracticeCatalog:
    return load_practice(get_settings().content_dir)
