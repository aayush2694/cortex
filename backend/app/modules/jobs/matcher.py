"""Compare a resume with a job description by the skills each one mentions (pure, no I/O)."""

import re
from dataclasses import dataclass
from functools import lru_cache

from app.modules.jobs.content import Skill, SkillBook

# Where a job description starts listing optional skills ("Nice to have: ...").
OPTIONAL_MARKER = re.compile(
    r"nice[- ]to[- ]have|good[- ]to[- ]have|preferred|bonus|(?:is|are|would be) a plus|desirable",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class MatchResult:
    score: int  # % of the job's required skills that your resume mentions
    matched: list[Skill]
    missing: list[Skill]  # in the job description, not in your resume
    extra: list[Skill]  # in your resume, not asked for
    required: frozenset[str] = frozenset()  # names of must-have skills

    def is_required(self, skill: Skill) -> bool:
        return skill.name in self.required


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

    # Skills before the first "nice to have"-style phrase are required; skills that only
    # appear after it are optional. Without such a phrase, everything is required.
    marker = OPTIONAL_MARKER.search(job)
    required_part = job[: marker.start()] if marker else job
    required = {s.name for s in find_skills(required_part, book)} or wanted_names

    matched = [s for s in wanted if s.name in have]
    # Required gaps first: they matter most.
    missing = sorted(
        (s for s in wanted if s.name not in have), key=lambda s: s.name not in required
    )
    extra = [s for s in book.skills if s.name in have and s.name not in wanted_names]
    covered = sum(1 for s in matched if s.name in required)
    score = round(100 * covered / len(required)) if required else 0
    return MatchResult(
        score=score, matched=matched, missing=missing, extra=extra, required=frozenset(required)
    )
