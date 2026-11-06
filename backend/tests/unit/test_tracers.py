import heapq
import random
from collections import deque
from typing import Any

import pytest

from app.core.errors import ValidationFailed
from app.modules.visualizer import service
from app.modules.visualizer.tracer import REGISTRY

SORTS = ["bubble_sort", "insertion_sort", "merge_sort", "quick_sort"]
FRAME_KEYS = {"line", "action", "message", "state", "highlight", "counters"}


def check_frames(out: Any) -> None:
    assert out.frames, "every run should produce frames"
    n_lines = len(out.source)
    for f in out.frames:
        assert set(f.model_dump()) == FRAME_KEYS
        assert 1 <= f.line <= n_lines
        assert f.message
    assert out.stats["steps"] == len(out.frames)


def test_all_algorithms_registered() -> None:
    assert set(REGISTRY) == {*SORTS, "binary_search", "bfs_grid", "dijkstra"}


@pytest.mark.parametrize("key", list(REGISTRY))
def test_example_runs(key: str) -> None:
    out = service.trace(key, REGISTRY[key].example)
    check_frames(out)
    assert out.frames[-1].action in {"done", "found"}


@pytest.mark.parametrize("key", SORTS)
@pytest.mark.parametrize(
    "array",
    [[1], [2, 1], [1, 2, 3, 4], [4, 3, 2, 1], [5, 5, 5], [3, -1, 3, 0, -1], list(range(32, 0, -1))],
)
def test_sorts_edge_cases(key: str, array: list[int]) -> None:
    out = service.trace(key, {"array": array})
    assert out.result["array"] == sorted(array)
    assert out.frames[-1].state["array"] == sorted(array)
    check_frames(out)


@pytest.mark.parametrize("key", SORTS)
def test_sorts_random(key: str) -> None:
    rng = random.Random(42)
    for _ in range(50):
        array = [rng.randint(-50, 50) for _ in range(rng.randint(1, 32))]
        assert service.trace(key, {"array": array}).result["array"] == sorted(array)


def test_binary_search_matches_reference() -> None:
    rng = random.Random(7)
    for _ in range(100):
        array = sorted(set(rng.randint(0, 99) for _ in range(rng.randint(1, 32))))
        target = rng.randint(0, 99)
        out = service.trace("binary_search", {"array": array, "target": target})
        assert out.result["found"] == (target in array)
        if out.result["found"]:
            assert array[out.result["index"]] == target


def test_binary_search_sorts_unsorted_input() -> None:
    out = service.trace("binary_search", {"array": [9, 1, 5], "target": 5})
    assert out.input["array"] == [9, 1, 5]
    assert out.frames[0].state["array"] == [1, 5, 9]
    assert out.result == {"found": True, "index": 1}


def reference_bfs(
    rows: int, cols: int, walls: set[tuple[int, int]], start: tuple[int, int], end: tuple[int, int]
) -> int | None:
    dist = {start: 0}
    q = deque([start])
    while q:
        r, c = q.popleft()
        if (r, c) == end:
            return dist[(r, c)]
        for dr, dc in ((-1, 0), (0, 1), (1, 0), (0, -1)):
            n = (r + dr, c + dc)
            if 0 <= n[0] < rows and 0 <= n[1] < cols and n not in walls and n not in dist:
                dist[n] = dist[(r, c)] + 1
                q.append(n)
    return None


def test_bfs_matches_reference() -> None:
    rng = random.Random(3)
    for _ in range(40):
        rows, cols = rng.randint(2, 12), rng.randint(2, 12)
        start, end = (0, 0), (rows - 1, cols - 1)
        walls = {(rng.randrange(rows), rng.randrange(cols)) for _ in range(rows * cols // 4)}
        walls -= {start, end}
        out = service.trace(
            "bfs_grid",
            {"rows": rows, "cols": cols, "start": start, "end": end, "walls": sorted(walls)},
        )
        expected = reference_bfs(rows, cols, walls, start, end)
        assert out.result["length"] == expected
        if expected is not None:
            path = [tuple(p) for p in out.result["path"]]
            assert path[0] == start and path[-1] == end
            assert not set(path) & walls
            for a, b in zip(path, path[1:], strict=False):  # each step moves one cell
                assert abs(a[0] - b[0]) + abs(a[1] - b[1]) == 1


def reference_dijkstra(
    nodes: list[str], edges: list[dict[str, Any]], start: str
) -> dict[str, float | None]:
    graph: dict[str, list[tuple[str, int]]] = {n: [] for n in nodes}
    for e in edges:
        graph[e["source"]].append((e["target"], e["weight"]))
        graph[e["target"]].append((e["source"], e["weight"]))
    dist: dict[str, float] = {start: 0}
    heap = [(0, start)]
    while heap:
        d, n = heapq.heappop(heap)
        if d > dist.get(n, float("inf")):
            continue
        for m, w in graph[n]:
            if d + w < dist.get(m, float("inf")):
                dist[m] = d + w
                heapq.heappush(heap, (d + w, m))
    return {n: dist.get(n) for n in nodes}


def test_dijkstra_matches_reference() -> None:
    rng = random.Random(11)
    for _ in range(40):
        nodes = [f"N{i}" for i in range(rng.randint(2, 15))]
        edges = [
            {"source": rng.choice(nodes), "target": rng.choice(nodes), "weight": rng.randint(0, 20)}
            for _ in range(rng.randint(0, 30))
        ]
        out = service.trace("dijkstra", {"nodes": nodes, "edges": edges, "start": nodes[0]})
        assert out.result["dist"] == reference_dijkstra(nodes, edges, nodes[0])


@pytest.mark.parametrize(
    ("key", "bad_input"),
    [
        ("bubble_sort", {"array": []}),
        ("bubble_sort", {"array": list(range(33))}),
        ("bubble_sort", {"array": [1000]}),
        ("binary_search", {"array": [1, 2]}),
        ("bfs_grid", {"rows": 3, "cols": 3, "start": [0, 0], "end": [5, 5]}),
        ("bfs_grid", {"rows": 3, "cols": 3, "start": [0, 0], "end": [2, 2], "walls": [[0, 0]]}),
        ("dijkstra", {"nodes": ["A", "B"], "edges": [], "start": "Z"}),
        ("dijkstra", {"nodes": ["A", "A"], "edges": [], "start": "A"}),
        (
            "dijkstra",
            {
                "nodes": ["A", "B"],
                "edges": [{"source": "A", "target": "B", "weight": -1}],
                "start": "A",
            },
        ),
    ],
)
def test_invalid_input_rejected(key: str, bad_input: dict[str, Any]) -> None:
    with pytest.raises(ValidationFailed):
        service.trace(key, bad_input)
