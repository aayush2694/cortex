"""Spaced repetition and streaks: pure functions, easy to test."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal

Grade = Literal["again", "hard", "good", "easy"]

MIN_EASE = 1.3
START_EASE = 2.5
AGAIN_MINUTES = 10  # a forgotten card comes back in the same session


@dataclass(frozen=True)
class CardState:
    ease: float = START_EASE
    interval_days: float = 0.0
    reps: int = 0  # successful reviews in a row
    lapses: int = 0  # times forgotten


def schedule(state: CardState, grade: Grade, now: datetime) -> tuple[CardState, datetime]:
    """A simplified SM-2 (the algorithm behind Anki). Returns the new state and when it's due.

    again: forgotten, see it again in 10 minutes and start over
    hard:  remembered with effort: 12 hours for a new card, else grow the interval a little
    good:  1 day, then 3 days, then interval x ease
    easy:  4 days for a new card, else 30% longer than good; the card gets easier
    """
    if grade == "again":
        new = CardState(
            ease=max(MIN_EASE, state.ease - 0.2),
            interval_days=0.0,
            reps=0,
            lapses=state.lapses + 1,
        )
        return new, now + timedelta(minutes=AGAIN_MINUTES)

    if grade == "hard":
        # A new card you barely got comes back later today; otherwise grow it a little.
        interval = 0.5 if state.reps == 0 else max(1.0, state.interval_days * 1.2)
        ease = max(MIN_EASE, state.ease - 0.15)
    else:
        if state.reps == 0:
            interval = 4.0 if grade == "easy" else 1.0
        elif state.reps == 1:
            interval = 3.0
        else:
            interval = state.interval_days * state.ease
        ease = state.ease
        if grade == "easy":
            if state.reps > 0:
                interval *= 1.3
            ease += 0.15
    interval = round(interval, 2)
    new = CardState(
        ease=round(ease, 2), interval_days=interval, reps=state.reps + 1, lapses=state.lapses
    )
    return new, now + timedelta(days=interval)


def preview_intervals(state: CardState, now: datetime) -> dict[str, float]:
    """Days until the card comes back for each grade (shown on the buttons)."""
    return {
        g: round((schedule(state, g, now)[1] - now).total_seconds() / 86400, 3)
        for g in ("again", "hard", "good", "easy")
    }


def streaks(active_days: set[date], today: date) -> tuple[int, int]:
    """(current streak, longest streak). Today without activity yet doesn't break a streak."""
    if not active_days:
        return 0, 0
    longest = run = 0
    prev: date | None = None
    for d in sorted(active_days):
        run = run + 1 if prev is not None and d - prev == timedelta(days=1) else 1
        longest = max(longest, run)
        prev = d

    day = today if today in active_days else today - timedelta(days=1)
    current = 0
    while day in active_days:
        current += 1
        day -= timedelta(days=1)
    return current, longest
