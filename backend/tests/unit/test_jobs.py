"""The resume matcher and the job-search content files."""

import pytest
from pydantic import ValidationError

from app.core.config import get_settings
from app.modules.jobs.content import QuestionBank, load_questions, load_skills
from app.modules.jobs.matcher import find_skills, match

BOOK = load_skills(get_settings().content_dir)


def names(skills) -> list[str]:  # type: ignore[no-untyped-def]
    return [s.name for s in skills]


def test_aliases_match_whole_words_and_symbols() -> None:
    text = "Built REST APIs with Django REST Framework, C#, .NET Core and CI/CD on GitHub Actions"
    found = names(find_skills(text, BOOK))
    for skill in ["Django", "Django REST Framework", "C#", ".NET", "CI/CD", "REST APIs", "Git"]:
        assert skill in found, skill


def test_common_words_are_not_skills() -> None:
    text = "The rest of the team has a solid understanding of the go-to-market plan in spring."
    assert names(find_skills(text, BOOK)) == []
    # "java" must not match inside "javascript".
    assert names(find_skills("javascript", BOOK)) == ["JavaScript"]


def test_match_scores_the_job_skills_you_cover() -> None:
    resume = "Python, Django, PostgreSQL, Angular, Docker"
    job = "We need Python, Django, PostgreSQL, Redis and Kubernetes experience."
    result = match(resume, job, BOOK)
    assert names(result.matched) == ["Python", "Django", "PostgreSQL"]
    assert names(result.missing) == ["Redis", "Kubernetes"]
    assert names(result.extra) == ["Angular", "Docker"]
    assert result.score == 60


def test_match_with_no_recognised_job_skills_scores_zero() -> None:
    assert match("Python", "We value kindness.", BOOK).score == 0


def test_question_bank_is_valid() -> None:
    bank = load_questions(get_settings().content_dir)
    assert len(bank.questions) >= 40
    by_cat = {c.id: 0 for c in bank.categories}
    for q in bank.questions:
        by_cat[q.category] += 1
    assert all(n >= 5 for n in by_cat.values()), by_cat


def test_question_bank_rejects_unknown_categories_and_duplicates() -> None:
    q = {"id": "a", "category": "x", "difficulty": "easy", "question": "?", "answer": "!"}
    with pytest.raises(ValidationError, match="unknown category"):
        QuestionBank.model_validate({"categories": [{"id": "y", "label": "Y"}], "questions": [q]})
    with pytest.raises(ValidationError, match="Duplicate"):
        QuestionBank.model_validate(
            {"categories": [{"id": "x", "label": "X"}], "questions": [q, q]}
        )


def test_nice_to_have_skills_dont_lower_the_score() -> None:
    resume = "Python, Django, PostgreSQL"
    job = "Must have: Python, Django, PostgreSQL.\nNice to have: Kubernetes, React."
    result = match(resume, job, BOOK)
    assert result.score == 100  # every must-have is covered
    assert names(result.missing) == ["React", "Kubernetes"]
    assert not any(result.is_required(s) for s in result.missing)


def test_a_skill_named_in_both_parts_is_required() -> None:
    result = match("Python", "Python and Docker required. Bonus: Docker Swarm, AWS.", BOOK)
    assert result.is_required(next(s for s in result.missing if s.name == "Docker"))
    assert not result.is_required(next(s for s in result.missing if s.name == "AWS"))
    assert result.score == 50  # Python of Python + Docker


def test_without_a_nice_to_have_section_every_skill_counts() -> None:
    assert match("Python", "Python, Redis", BOOK).score == 50
