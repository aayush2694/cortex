"""The learning engine: mastery scores and "what next?" (pure functions, easy to test)."""

from dataclasses import dataclass
from typing import Literal

Status = Literal["not_started", "learning", "confident"]

STATUS_BASE: dict[str, float] = {"not_started": 0.0, "learning": 0.3, "confident": 0.7}
VISUALIZER_BONUS = 0.1
PRACTICE_BONUS = 0.2  # reached when every practice problem of a pattern is solved
DECAY_GRACE_DAYS = 30  # no decay for the first month without activity
DECAY_PER_DAY = 0.005  # then lose 0.5% of the score per idle day...
DECAY_FLOOR = 0.5  # ...but never more than half of it
UNLOCK_THRESHOLD = 0.6  # a prerequisite counts as "known" from this mastery
DONE_THRESHOLD = 0.7  # topics at or above this are not recommended again


def compute_mastery(
    status: str, visualizer_done: bool, days_inactive: float, solved_ratio: float = 0.0
) -> float:
    score = STATUS_BASE.get(status, 0.0)
    if visualizer_done:
        score += VISUALIZER_BONUS
    score += PRACTICE_BONUS * min(1.0, max(0.0, solved_ratio))
    idle = max(0.0, days_inactive - DECAY_GRACE_DAYS)
    score *= max(DECAY_FLOOR, 1.0 - DECAY_PER_DAY * idle)
    return round(min(1.0, max(0.0, score)), 3)


@dataclass(frozen=True)
class Recommendation:
    topic_id: str
    priority: float
    reason: str


def recommend_next(
    topic_ids: list[str],
    titles: dict[str, str],
    requires: dict[str, list[str]],
    mastery: dict[str, float],
    limit: int = 3,
) -> list[Recommendation]:
    """Recommend unlocked topics you don't know yet, preferring ones that unlock many others."""
    unlocks: dict[str, list[str]] = {t: [] for t in topic_ids}
    for topic, reqs in requires.items():
        for r in reqs:
            unlocks.setdefault(r, []).append(topic)

    recs: list[Recommendation] = []
    for t in topic_ids:
        m = mastery.get(t, 0.0)
        if m >= DONE_THRESHOLD:
            continue
        reqs = requires.get(t, [])
        if any(mastery.get(r, 0.0) < UNLOCK_THRESHOLD for r in reqs):
            continue
        n_unlocks = len(unlocks.get(t, []))
        priority = round((1.0 - m) + 0.05 * n_unlocks, 3)
        if m > 0:
            reason = "You've started this one; finish it off"
        elif n_unlocks:
            names = ", ".join(titles.get(u, u) for u in unlocks[t][:2])
            more = f" and {n_unlocks - 2} more" if n_unlocks > 2 else ""
            reason = f"Unlocks {names}{more}"
        elif reqs:
            reason = "You've covered all its prerequisites"
        else:
            reason = "A good starting point"
        recs.append(Recommendation(topic_id=t, priority=priority, reason=reason))

    # Stable order: highest priority first, then catalogue order.
    order = {t: i for i, t in enumerate(topic_ids)}
    recs.sort(key=lambda r: (-r.priority, order[r.topic_id]))
    return recs[:limit]
