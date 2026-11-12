"""Load the skills dictionary and the interview question bank from YAML (no database)."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, model_validator

from app.core.config import get_settings


class Skill(BaseModel):
    name: str
    category: str
    aliases: list[str] = Field(min_length=1)


class SkillBook(BaseModel):
    skills: list[Skill]


class Category(BaseModel):
    id: str
    label: str


class Question(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=80)
    category: str
    difficulty: Literal["easy", "medium", "hard"]
    question: str
    answer: str


class QuestionBank(BaseModel):
    categories: list[Category]
    questions: list[Question]

    @model_validator(mode="after")
    def _check(self) -> "QuestionBank":
        known = {c.id for c in self.categories}
        seen: set[str] = set()
        for q in self.questions:
            if q.id in seen:
                raise ValueError(f"Duplicate question id: {q.id}")
            seen.add(q.id)
            if q.category not in known:
                raise ValueError(f"Question '{q.id}' has unknown category '{q.category}'")
        return self


def _read(content_dir: str | Path, name: str) -> object:
    return yaml.safe_load((Path(content_dir) / name).read_text(encoding="utf-8"))


def load_skills(content_dir: str | Path) -> SkillBook:
    return SkillBook.model_validate(_read(content_dir, "skills.yaml"))


def load_questions(content_dir: str | Path) -> QuestionBank:
    return QuestionBank.model_validate(_read(content_dir, "interview_questions.yaml"))


@lru_cache
def get_skills() -> SkillBook:
    return load_skills(get_settings().content_dir)


@lru_cache
def get_questions() -> QuestionBank:
    return load_questions(get_settings().content_dir)
