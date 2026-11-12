"""Compare a resume with a job description by the skills each one mentions (pure, no I/O)."""

import re
from dataclasses import dataclass
from functools import lru_cache

from app.modules.jobs.content import Skill, SkillBook


@dataclass(frozen=True)
class MatchResult:
    score: int  # % of the job's skills that your resume mentions
    matched: list[Skill]
    missing: list[Skill]  # in the job description, not in your resume
    extra: list[Skill]  # in your resume, not asked for


@lru_cache(maxsize=512)
def _pattern(alias: str) -> re.Pattern[str]:
    # Whole words only, but allow symbols inside aliases like "c#", ".net" and "ci/cd".
    return re.compile(rf"(?<![a-z0-9]){re.escape(alias.lower())}(?![a-z0-9])")


def find_skills(text: str, book: SkillBook) -> list[Skill]:
    lowered = text.lower()
    return [s for s in book.skills if any(_pattern(a).search(lowered) for a in s.aliases)]


def match(resume: str, job: str, book: SkillBook) -> MatchResult:
    wanted = find_skills(job, book)
    have = {s.name for s in find_skills(resume, book)}
    wanted_names = {s.name for s in wanted}
    matched = [s for s in wanted if s.name in have]
    missing = [s for s in wanted if s.name not in have]
    extra = [s for s in book.skills if s.name in have and s.name not in wanted_names]
    score = round(100 * len(matched) / len(wanted)) if wanted else 0
    return MatchResult(score=score, matched=matched, missing=missing, extra=extra)
