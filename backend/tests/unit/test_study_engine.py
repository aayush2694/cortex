"""Spaced repetition scheduling and streaks."""

from datetime import UTC, date, datetime, timedelta

import pytest

from app.modules.study.engine import CardState, preview_intervals, schedule, streaks

NOW = datetime(2026, 11, 12, 9, 0, tzinfo=UTC)


def days(due: datetime) -> float:
    return round((due - NOW).total_seconds() / 86400, 3)


def test_good_grows_one_three_then_by_ease() -> None:
    s = CardState()
    s, due = schedule(s, "good", NOW)
    assert days(due) == 1 and s.reps == 1
    s, due = schedule(s, "good", NOW)
    assert days(due) == 3 and s.reps == 2
    s, due = schedule(s, "good", NOW)
    assert days(due) == pytest.approx(3 * 2.5)
    assert s.ease == 2.5  # good never changes ease


def test_again_resets_and_comes_back_in_minutes() -> None:
    s = CardState(ease=2.5, interval_days=10, reps=4, lapses=0)
    s, due = schedule(s, "again", NOW)
    assert due - NOW == timedelta(minutes=10)
    assert (s.reps, s.lapses, s.interval_days) == (0, 1, 0.0)
    assert s.ease == pytest.approx(2.3)


def test_ease_never_drops_below_floor() -> None:
    s = CardState(ease=1.35)
    for _ in range(5):
        s, _ = schedule(s, "again", NOW)
    assert s.ease == 1.3


def test_easy_beats_good_beats_hard() -> None:
    s = CardState(ease=2.5, interval_days=10, reps=3)
    nxt = preview_intervals(s, NOW)
    assert nxt["again"] < nxt["hard"] < nxt["good"] < nxt["easy"]
    assert nxt["good"] == 25 and nxt["easy"] == pytest.approx(32.5)


def test_streaks() -> None:
    today = date(2026, 11, 12)
    d = lambda n: today - timedelta(days=n)  # noqa: E731
    assert streaks(set(), today) == (0, 0)
    # Active today and the 2 days before; an older run of 4 is the longest.
    active = {d(0), d(1), d(2), d(10), d(11), d(12), d(13)}
    assert streaks(active, today) == (3, 4)
    # Nothing yet today: yesterday's streak still counts.
    assert streaks({d(1), d(2)}, today) == (2, 2)
    # A gap of a day breaks it.
    assert streaks({d(2), d(3)}, today) == (0, 2)


def test_new_card_buttons_all_differ() -> None:
    nxt = preview_intervals(CardState(), NOW)
    assert (nxt["hard"], nxt["good"], nxt["easy"]) == (0.5, 1, 4)
