from typing import Any

import pytest

from app.modules.progress.engine import compute_mastery, recommend_next
from app.modules.topics.catalog import Catalog, CatalogError, load_catalog, validate_catalog
from app.modules.tutor.prompts import to_api_messages
from app.modules.visualizer.tracer import REGISTRY


def make(topics: list[dict[str, Any]]) -> Catalog:
    base = {"track": "dsa", "title": "T", "summary": "S", "difficulty": 1, "phase": 1}
    return Catalog.model_validate({"topics": [{**base, **t} for t in topics]})


# ---------------------------------------------------------------- catalogue


def test_real_catalog_is_valid() -> None:
    catalog = load_catalog("content")
    assert len(catalog.topics) >= 30
    # Every visualizer referenced by a topic exists, and every algorithm has a topic.
    visualizers = {t.visualizer for t in catalog.topics if t.visualizer}
    assert visualizers == set(REGISTRY)
    ids = {t.id for t in catalog.topics}
    assert {spec.topic_id for spec in REGISTRY.values()} <= ids


def test_cycle_detected() -> None:
    with pytest.raises(CatalogError, match="cycle"):
        validate_catalog(make([{"id": "a", "requires": ["b"]}, {"id": "b", "requires": ["a"]}]))


def test_unknown_prerequisite_detected() -> None:
    with pytest.raises(CatalogError, match="unknown"):
        validate_catalog(make([{"id": "a", "requires": ["missing"]}]))


def test_duplicate_id_detected() -> None:
    with pytest.raises(CatalogError, match="Duplicate"):
        validate_catalog(make([{"id": "a"}, {"id": "a"}]))


# ---------------------------------------------------------------- mastery


def test_mastery_levels() -> None:
    assert compute_mastery("not_started", False, 0) == 0.0
    assert compute_mastery("learning", False, 0) == 0.3
    assert compute_mastery("confident", True, 0) == 0.8
    assert compute_mastery("confident", True, 10) == 0.8  # within the grace period


def test_mastery_decays_but_has_a_floor() -> None:
    fresh = compute_mastery("confident", False, 0)
    assert compute_mastery("confident", False, 60) < fresh
    assert compute_mastery("confident", False, 10_000) == pytest.approx(fresh * 0.5)


# ---------------------------------------------------------------- recommendations

IDS = ["arrays", "sorting", "merge", "graphs"]
TITLES = {"arrays": "Arrays", "sorting": "Sorting", "merge": "Merge sort", "graphs": "Graphs"}
REQUIRES = {"sorting": ["arrays"], "merge": ["sorting"]}


def test_recommends_unlocked_topics_first() -> None:
    recs = recommend_next(IDS, TITLES, REQUIRES, mastery={})
    assert [r.topic_id for r in recs] == ["arrays", "graphs"]
    assert recs[0].reason == "Unlocks Sorting"


def test_known_prerequisite_unlocks_next_topic() -> None:
    recs = recommend_next(IDS, TITLES, REQUIRES, mastery={"arrays": 0.8})
    ids = [r.topic_id for r in recs]
    assert "sorting" in ids and "arrays" not in ids and "merge" not in ids


def test_in_progress_topic_gets_reason() -> None:
    recs = recommend_next(IDS, TITLES, REQUIRES, mastery={"graphs": 0.3})
    assert next(r for r in recs if r.topic_id == "graphs").reason.startswith("You've started")


# ---------------------------------------------------------------- tutor prompts


def test_api_messages_keep_text_and_merge_roles() -> None:
    history = [
        ("assistant", [{"type": "text", "text": "orphan"}]),  # leading assistant is dropped
        ("user", [{"type": "text", "text": "q1"}]),
        (
            "assistant",
            [
                {"type": "thinking", "thinking": "", "signature": "x"},
                {"type": "text", "text": "a1"},
            ],
        ),
        ("user", [{"type": "text", "text": "q2"}]),
        ("user", [{"type": "text", "text": "q3"}]),  # previous reply failed
    ]
    assert to_api_messages(history) == [
        {"role": "user", "content": [{"type": "text", "text": "q1"}]},
        {"role": "assistant", "content": [{"type": "text", "text": "a1"}]},
        {
            "role": "user",
            "content": [{"type": "text", "text": "q2"}, {"type": "text", "text": "q3"}],
        },
    ]


def test_django_track_and_doc_links() -> None:
    catalog = load_catalog("content")
    django = [t for t in catalog.topics if t.track == "frameworks"]
    assert len(django) >= 10
    assert all(t.resources for t in django), "every Django topic links to official docs"
    for t in catalog.topics:
        for r in t.resources:
            assert r.url.scheme == "https"
