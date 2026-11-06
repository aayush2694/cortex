"""Load and validate the topic catalogue from YAML (pure Python, no database)."""

from collections import deque
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, HttpUrl

Track = Literal["dsa", "languages", "frameworks", "ai", "system-design"]


class Resource(BaseModel):
    """A link to official documentation or a good reference."""

    label: str = Field(max_length=120)
    url: HttpUrl


class TopicSpec(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=80)
    track: Track
    title: str = Field(max_length=120)
    summary: str
    difficulty: int = Field(ge=1, le=5)
    phase: int = Field(ge=0, le=6)
    visualizer: str | None = None
    requires: list[str] = []
    resources: list[Resource] = []


class Catalog(BaseModel):
    topics: list[TopicSpec]


class CatalogError(ValueError):
    pass


def validate_catalog(catalog: Catalog) -> None:
    """Fail on duplicate ids, unknown prerequisites, or prerequisite cycles."""
    ids = [t.id for t in catalog.topics]
    seen: set[str] = set()
    for topic_id in ids:
        if topic_id in seen:
            raise CatalogError(f"Duplicate topic id: {topic_id}")
        seen.add(topic_id)

    for t in catalog.topics:
        for req in t.requires:
            if req not in seen:
                raise CatalogError(f"Topic '{t.id}' requires unknown topic '{req}'")
            if req == t.id:
                raise CatalogError(f"Topic '{t.id}' requires itself")

    order = topological_order(catalog)
    if len(order) != len(ids):
        stuck = sorted(set(ids) - set(order))
        raise CatalogError(f"Prerequisite cycle involving: {', '.join(stuck)}")


def topological_order(catalog: Catalog) -> list[str]:
    """Kahn's algorithm. Returns fewer ids than topics if there is a cycle."""
    indegree = {t.id: 0 for t in catalog.topics}
    unlocks: dict[str, list[str]] = {t.id: [] for t in catalog.topics}
    for t in catalog.topics:
        for req in t.requires:
            if req in unlocks:
                unlocks[req].append(t.id)
                indegree[t.id] += 1

    queue = deque(t.id for t in catalog.topics if indegree[t.id] == 0)
    order: list[str] = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nxt in unlocks[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    return order


def load_catalog(content_dir: str | Path) -> Catalog:
    path = Path(content_dir) / "topics.yaml"
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    catalog = Catalog.model_validate(raw)
    validate_catalog(catalog)
    return catalog
