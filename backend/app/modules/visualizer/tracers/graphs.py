import heapq
from collections import deque
from typing import Any

from app.modules.visualizer.inputs import Cell, GraphInput, GridInput
from app.modules.visualizer.tracer import AlgorithmSpec, Tracer, register

# ---------------------------------------------------------------- BFS on a grid

BFS_SOURCE = """
from collections import deque

def bfs(grid, start, end):
    queue = deque([start])
    came_from = {start: None}
    while queue:
        cell = queue.popleft()
        if cell == end:
            return build_path(came_from, end)
        for nxt in neighbours(grid, cell):
            if nxt not in came_from:
                came_from[nxt] = cell
                queue.append(nxt)
    return None
"""

DIRECTIONS = ((-1, 0), (0, 1), (1, 0), (0, -1))  # up, right, down, left


def run_bfs_grid(inp: GridInput, t: Tracer) -> dict[str, Any]:
    walls = set(inp.walls)
    start, end = inp.start, inp.end
    queue: deque[Cell] = deque([start])
    came_from: dict[Cell, Cell | None] = {start: None}
    visited: list[Cell] = []

    def state(current: Cell | None = None, path: list[Cell] | None = None) -> dict[str, Any]:
        return {
            "visited": [list(c) for c in visited],
            "frontier": [list(c) for c in queue],
            "current": list(current) if current else None,
            "path": [list(c) for c in path] if path else [],
        }

    t.frame("queue = deque([start])", "start", "Put the start cell in the queue", state())
    while queue:
        cell = queue.popleft()
        visited.append(cell)
        t.count("visited")
        if cell == end:
            path: list[Cell] = []
            node: Cell | None = cell
            while node is not None:
                path.append(node)
                node = came_from[node]
            path.reverse()
            t.frame(
                "return build_path(came_from, end)",
                "found",
                f"Reached the end! Shortest path has {len(path) - 1} steps",
                state(cell, path),
                [list(cell)],
            )
            return {"found": True, "path": [list(c) for c in path], "length": len(path) - 1}
        added = 0
        r, c = cell
        for dr, dc in DIRECTIONS:
            nxt = (r + dr, c + dc)
            inside = 0 <= nxt[0] < inp.rows and 0 <= nxt[1] < inp.cols
            if inside and nxt not in walls and nxt not in came_from:
                came_from[nxt] = cell
                queue.append(nxt)
                added += 1
        t.frame(
            "for nxt in neighbours(grid, cell):",
            "visit",
            f"Visit {list(cell)}; add {added} new neighbour{'s' if added != 1 else ''} "
            "to the queue",
            state(cell),
            [list(cell)],
        )
    t.frame("return None", "done", "The queue is empty: there is no path", state())
    return {"found": False, "path": [], "length": None}


register(
    AlgorithmSpec(
        key="bfs_grid",
        title="Breadth-First Search (grid)",
        topic_id="bfs",
        view="grid",
        description="Explore outward from the start one 'ring' at a time using a queue. "
        "The first time BFS reaches the end, it has found a shortest path.",
        complexity="Time O(rows × cols) · Space O(rows × cols)",
        source=BFS_SOURCE,
        input_model=GridInput,
        example={
            "rows": 8,
            "cols": 12,
            "start": [1, 1],
            "end": [6, 10],
            "walls": [
                [0, 4],
                [1, 4],
                [2, 4],
                [3, 4],
                [4, 4],
                [6, 7],
                [5, 7],
                [4, 7],
                [3, 7],
                [2, 7],
                [2, 8],
                [2, 9],
            ],
        },
        run=run_bfs_grid,
    )
)

# ---------------------------------------------------------------- Dijkstra

DIJKSTRA_SOURCE = """
import heapq

def dijkstra(graph, start):
    dist = {node: float("inf") for node in graph}
    dist[start] = 0
    heap = [(0, start)]
    done = set()
    while heap:
        d, node = heapq.heappop(heap)
        if node in done:
            continue
        done.add(node)
        for nxt, weight in graph[node]:
            new_dist = d + weight
            if new_dist < dist[nxt]:
                dist[nxt] = new_dist
                heapq.heappush(heap, (new_dist, nxt))
    return dist
"""


def run_dijkstra(inp: GraphInput, t: Tracer) -> dict[str, Any]:
    graph: dict[str, list[tuple[str, int]]] = {n: [] for n in inp.nodes}
    for e in inp.edges:
        graph[e.source].append((e.target, e.weight))
        if not inp.directed:
            graph[e.target].append((e.source, e.weight))

    inf = float("inf")
    dist: dict[str, float] = {n: inf for n in inp.nodes}
    prev: dict[str, str | None] = {n: None for n in inp.nodes}
    dist[inp.start] = 0
    heap: list[tuple[float, str]] = [(0, inp.start)]
    done: set[str] = set()

    def state(current: str | None = None, edge: list[str] | None = None) -> dict[str, Any]:
        return {
            "dist": {n: (None if d == inf else d) for n, d in dist.items()},
            "prev": dict(prev),
            "done": sorted(done, key=inp.nodes.index),
            "heap": [[d, n] for d, n in sorted(heap)],
            "current": current,
            "edge": edge,
        }

    t.frame(
        "dist[start] = 0", "start", f"Distance to {inp.start} is 0; everything else is ∞", state()
    )
    while heap:
        d, node = heapq.heappop(heap)
        if node in done:
            t.frame(
                "continue",
                "skip",
                f"{node} is already final, skip this old entry",
                state(node),
                [node],
            )
            continue
        done.add(node)
        t.count("nodes_finalised")
        t.frame(
            "done.add(node)",
            "visit",
            f"{node} has the smallest distance ({d:g}), so it's final",
            state(node),
            [node],
        )
        for nxt, weight in graph[node]:
            if nxt in done:
                continue
            new_dist = d + weight
            t.count("edges_checked")
            if new_dist < dist[nxt]:
                old = "∞" if dist[nxt] == inf else f"{dist[nxt]:g}"
                dist[nxt] = new_dist
                prev[nxt] = node
                heapq.heappush(heap, (new_dist, nxt))
                t.frame(
                    "dist[nxt] = new_dist",
                    "relax",
                    f"Going via {node} reaches {nxt} in {new_dist:g} (was {old})",
                    state(node, [node, nxt]),
                    [node, nxt],
                )
            else:
                t.frame(
                    "if new_dist < dist[nxt]:",
                    "compare",
                    f"Via {node}, {nxt} would cost {new_dist:g}, not better than {dist[nxt]:g}",
                    state(node, [node, nxt]),
                    [node, nxt],
                )
    t.frame("return dist", "done", "All reachable nodes have their shortest distance", state())
    return {
        "dist": {n: (None if d == inf else d) for n, d in dist.items()},
        "prev": prev,
    }


register(
    AlgorithmSpec(
        key="dijkstra",
        title="Dijkstra's Shortest Paths",
        topic_id="dijkstra",
        view="graph",
        description="Always finalise the closest unfinished node, then try to improve its "
        "neighbours' distances through it. Works when no edge weight is negative.",
        complexity="Time O((V + E) log V) · Space O(V)",
        source=DIJKSTRA_SOURCE,
        input_model=GraphInput,
        example={
            "nodes": ["A", "B", "C", "D", "E", "F"],
            "edges": [
                {"source": "A", "target": "B", "weight": 4},
                {"source": "A", "target": "C", "weight": 2},
                {"source": "B", "target": "C", "weight": 1},
                {"source": "B", "target": "D", "weight": 5},
                {"source": "C", "target": "D", "weight": 8},
                {"source": "C", "target": "E", "weight": 10},
                {"source": "D", "target": "E", "weight": 2},
                {"source": "D", "target": "F", "weight": 6},
                {"source": "E", "target": "F", "weight": 3},
            ],
            "start": "A",
        },
        run=run_dijkstra,
    )
)
