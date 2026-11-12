"""The step recorder behind every visualization.

An algorithm runs as normal Python and calls `t.frame(...)` at each interesting moment.
Each frame is a full snapshot, so the browser can jump to any step (forwards or backwards).
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel

View = Literal["array", "grid", "graph", "sequence", "list", "tree", "intervals", "table"]
Kind = Literal["algorithm", "pattern"]
MAX_FRAMES = 5000


class FrameLimitExceeded(Exception):
    pass


class Tracer:
    def __init__(self, source: str, max_frames: int = MAX_FRAMES) -> None:
        self.source_lines = source.strip("\n").splitlines()
        self.max_frames = max_frames
        self.frames: list[dict[str, Any]] = []
        self.counters: dict[str, int] = {}
        self._line_cache: dict[tuple[str, int], int] = {}

    def line_of(self, snippet: str, occurrence: int = 1) -> int:
        """1-based line number of the n-th source line containing `snippet`."""
        key = (snippet, occurrence)
        if key not in self._line_cache:
            hits = [i + 1 for i, line in enumerate(self.source_lines) if snippet in line]
            if len(hits) < occurrence:
                raise ValueError(f"Source has no occurrence #{occurrence} of {snippet!r}")
            self._line_cache[key] = hits[occurrence - 1]
        return self._line_cache[key]

    def count(self, name: str, by: int = 1) -> None:
        self.counters[name] = self.counters.get(name, 0) + by

    def frame(
        self,
        at: str,
        action: str,
        message: str,
        state: dict[str, Any],
        highlight: Sequence[Any] = (),
        occurrence: int = 1,
    ) -> None:
        if len(self.frames) >= self.max_frames:
            raise FrameLimitExceeded(f"More than {self.max_frames} steps; try a smaller input")
        self.frames.append(
            {
                "line": self.line_of(at, occurrence),
                "action": action,
                "message": message,
                "state": state,
                "highlight": list(highlight),
                "counters": dict(self.counters),
            }
        )


RunFn = Callable[[Any, Tracer], dict[str, Any]]


@dataclass(frozen=True)
class AlgorithmSpec:
    key: str
    title: str
    topic_id: str
    view: View
    description: str
    complexity: str
    source: str
    input_model: type[BaseModel]
    example: dict[str, Any]
    run: RunFn
    kind: Kind = "algorithm"


REGISTRY: dict[str, AlgorithmSpec] = {}


def register(spec: AlgorithmSpec) -> AlgorithmSpec:
    if spec.key in REGISTRY:
        raise ValueError(f"Algorithm '{spec.key}' registered twice")
    REGISTRY[spec.key] = spec
    return spec
