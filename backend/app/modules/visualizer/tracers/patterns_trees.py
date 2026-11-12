"""Problem-solving patterns on trees, graphs and heaps, traced step by step.

"tree" view state:
    {"nodes": [{"id": 0, "val": 3, "left": 1, "right": 2}, ...], "root": 0,
     "tones": [...one per node...], "labels": [...one per node...],
     "panel": {"label": "queue", "items": [...]} | None, "vars": [...]}

"grid" view, matrix mode (Grid Traversal):
    {"matrix": [["water" | "land" | "island" | "frontier" | "current", ...], ...],
     "labels": [[island number or "", ...], ...], "vars": [...]}

"graph" view, generic mode (Topological Sort, Union-Find):
    {"graph": {"nodes": [...], "edges": [{"source", "target", "label"}], "directed": bool},
     "labels": {node: text}, "done": [...], "current": node | None, "edge": [a, b] | None,
     "tree_edges": [[a, b], ...], "queue": {"label", "items"} | None, "vars": [...]}
"""

import heapq
from collections import deque
from typing import Any

from app.modules.visualizer.inputs import (
    DirectedGraphInput,
    MatrixInput,
    PathSumInput,
    TopKInput,
    TreeInput,
    UndirectedGraphInput,
)
from app.modules.visualizer.tracer import AlgorithmSpec, Tracer, register
from app.modules.visualizer.tracers.patterns_arrays import vars_

# ---------------------------------------------------------------- tree helpers


def build_tree(values: list[int | None]) -> list[dict[str, Any]]:
    """LeetCode level order -> list of nodes with left/right child ids."""
    nodes: list[dict[str, Any]] = [{"id": 0, "val": values[0], "left": None, "right": None}]
    queue = deque([0])
    i = 1
    while queue and i < len(values):
        parent = queue.popleft()
        for side in ("left", "right"):
            if i < len(values) and values[i] is not None:
                nid = len(nodes)
                nodes.append({"id": nid, "val": values[i], "left": None, "right": None})
                nodes[parent][side] = nid
                queue.append(nid)
            i += 1
    return nodes


def tree_state(
    nodes: list[dict[str, Any]],
    tones: dict[int, str] | None = None,
    labels: dict[int, str] | None = None,
    panel: tuple[str, list[Any]] | None = None,
    **vs: Any,
) -> dict[str, Any]:
    t, lab = tones or {}, labels or {}
    return {
        "nodes": [dict(n) for n in nodes],
        "root": 0 if nodes else None,
        "tones": [t.get(n["id"], "") for n in nodes],
        "labels": [lab.get(n["id"], "") for n in nodes],
        "panel": {"label": panel[0], "items": list(panel[1])} if panel else None,
        "vars": vars_(**vs),
    }


# ---------------------------------------------------------------- tree BFS

TREE_BFS_SOURCE = """
def level_order(root):
    levels, queue = [], deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)
            for child in (node.left, node.right):
                if child:
                    queue.append(child)
        levels.append(level)
    return levels
"""


def run_tree_bfs(inp: TreeInput, t: Tracer) -> dict[str, Any]:
    nodes = build_tree(inp.tree)
    queue: deque[int] = deque([0])
    levels: list[list[int]] = []
    done: set[int] = set()
    depth_of: dict[int, str] = {}

    def state(tones: dict[int, str] | None = None) -> dict[str, Any]:
        tt = {i: "done" for i in done}
        tt.update({i: "outline" for i in queue})
        tt.update(tones or {})
        return tree_state(
            nodes,
            tt,
            depth_of,
            ("queue", [nodes[i]["val"] for i in queue]),
            levels=" ".join(str(lv) for lv in levels) or "-",
        )

    t.frame("levels, queue = [], deque([root])", "start", "Put the root in the queue", state())
    while queue:
        level: list[int] = []
        width = len(queue)
        t.frame(
            "for _ in range(len(queue)):",
            "level",
            f"Level {len(levels)}: the {width} node(s) now in the queue make up this level",
            state(),
        )
        for _ in range(width):
            i = queue.popleft()
            level.append(nodes[i]["val"])
            depth_of[i] = f"L{len(levels)}"
            kids = [c for c in (nodes[i]["left"], nodes[i]["right"]) if c is not None]
            queue.extend(kids)
            done.add(i)
            t.count("visited")
            msg = f"Visit {nodes[i]['val']}"
            if kids:
                msg += ", queue its children " + " and ".join(str(nodes[c]["val"]) for c in kids)
            t.frame("level.append(node.val)", "visit", msg, state({i: "active"}), [i])
        levels.append(level)
        t.frame("levels.append(level)", "add", f"Level {len(levels) - 1} is {level}", state())
    t.frame("return levels", "done", f"{len(levels)} levels: {levels}", state())
    return {"levels": levels}


register(
    AlgorithmSpec(
        key="tree_bfs",
        title="Tree BFS: level order traversal",
        topic_id="tree-bfs",
        view="tree",
        kind="pattern",
        description="Use a queue to visit the tree level by level. Taking exactly len(queue) nodes "
        "at a time keeps each level together.",
        complexity="Time O(n) · Space O(w), w = widest level",
        source=TREE_BFS_SOURCE,
        input_model=TreeInput,
        example={"tree": [3, 9, 20, 4, None, 15, 7, None, 8]},
        run=run_tree_bfs,
    )
)

# ---------------------------------------------------------------- tree DFS

TREE_DFS_SOURCE = """
def has_path_sum(node, target):
    if not node:
        return False
    target -= node.val
    if not node.left and not node.right:
        return target == 0
    return (has_path_sum(node.left, target)
            or has_path_sum(node.right, target))
"""


def run_tree_dfs(inp: PathSumInput, t: Tracer) -> dict[str, Any]:
    nodes = build_tree(inp.tree)
    path: list[int] = []
    seen: set[int] = set()
    found: list[int] = []

    def state(tones: dict[int, str] | None = None, remaining: Any = "-") -> dict[str, Any]:
        tt = {i: "dim" for i in seen}
        tt.update({i: "outline" for i in path})
        tt.update(tones or {})
        return tree_state(
            nodes,
            tt,
            None,
            ("path (call stack)", [nodes[i]["val"] for i in path]),
            target=inp.target,
            remaining=remaining,
        )

    def dfs(i: int | None, remaining: int) -> bool:
        if i is None:
            return False
        path.append(i)
        seen.add(i)
        remaining -= nodes[i]["val"]
        t.count("visited")
        t.frame(
            "target -= node.val",
            "visit",
            f"Go down to {nodes[i]['val']}: {remaining} left to reach the target",
            state({i: "active"}, remaining),
            [i],
        )
        if nodes[i]["left"] is None and nodes[i]["right"] is None:
            if remaining == 0:
                found.extend(path)
                t.frame(
                    "return target == 0",
                    "found",
                    f"Leaf {nodes[i]['val']} and nothing left: "
                    f"path {[nodes[j]['val'] for j in path]} works",
                    state({j: "found" for j in path}, remaining),
                    [i],
                )
                return True
            t.frame(
                "return target == 0",
                "backtrack",
                f"Leaf {nodes[i]['val']} but {remaining} still left: back up",
                state({i: "active"}, remaining),
            )
            path.pop()
            return False
        if dfs(nodes[i]["left"], remaining) or dfs(nodes[i]["right"], remaining):
            return True
        path.pop()
        t.frame(
            "or has_path_sum(node.right, target))",
            "backtrack",
            f"Neither child of {nodes[i]['val']} works: back up",
            state({}, remaining),
        )
        return False

    t.frame(
        "def has_path_sum(node, target):",
        "start",
        f"Look for a root-to-leaf path that adds up to {inp.target}",
        state(),
    )
    ok = dfs(0, inp.target)
    if not ok:
        t.frame("return False", "done", f"No root-to-leaf path adds up to {inp.target}", state())
    return {"found": ok, "path": [nodes[i]["val"] for i in found]}


register(
    AlgorithmSpec(
        key="tree_dfs",
        title="Tree DFS: root-to-leaf path sum",
        topic_id="tree-dfs",
        view="tree",
        kind="pattern",
        description="Go as deep as possible down one branch before trying the next. The recursion "
        "(call stack) remembers the path, and you back up when a branch fails.",
        complexity="Time O(n) · Space O(h), h = tree height",
        source=TREE_DFS_SOURCE,
        input_model=PathSumInput,
        example={"tree": [5, 4, 8, 11, None, 13, 4, 7, 2, None, None, None, 1], "target": 22},
        run=run_tree_dfs,
    )
)

# ---------------------------------------------------------------- grid traversal (islands)

ISLANDS_SOURCE = """
def num_islands(grid):
    count = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 1:
                count += 1
                sink(grid, r, c)
    return count

def sink(grid, r, c):
    queue = deque([(r, c)])
    grid[r][c] = 0
    while queue:
        r, c = queue.popleft()
        for nr, nc in neighbours(r, c):
            if grid[nr][nc] == 1:
                grid[nr][nc] = 0
                queue.append((nr, nc))
"""


def run_grid_traversal(inp: MatrixInput, t: Tracer) -> dict[str, Any]:
    g = [row[:] for row in inp.grid]
    rows, cols = len(g), len(g[0])
    island: dict[tuple[int, int], int] = {}
    count = 0

    def state(
        current: tuple[int, int] | None = None, frontier: set[tuple[int, int]] | None = None
    ) -> dict[str, Any]:
        fr = frontier or set()
        matrix, labels = [], []
        for r in range(rows):
            mrow, lrow = [], []
            for c in range(cols):
                if (r, c) == current:
                    tone = "current"
                elif (r, c) in fr:
                    tone = "frontier"
                elif (r, c) in island:
                    tone = "island"
                elif inp.grid[r][c] == 1:
                    tone = "land"
                else:
                    tone = "water"
                mrow.append(tone)
                lrow.append(str(island[(r, c)]) if (r, c) in island else "")
            matrix.append(mrow)
            labels.append(lrow)
        return {"matrix": matrix, "labels": labels, "vars": vars_(islands=count)}

    t.frame(
        "count = 0",
        "start",
        "Scan every cell; each unvisited piece of land starts a new island",
        state(),
    )
    for r in range(rows):
        for c in range(cols):
            if g[r][c] != 1:
                continue
            count += 1
            t.count("islands")
            g[r][c] = 0
            island[(r, c)] = count
            queue = deque([(r, c)])
            t.frame(
                "count += 1",
                "found",
                f"Land at ({r}, {c}) not yet visited: island #{count}",
                state((r, c), set(queue)),
            )
            while queue:
                cr, cc = queue.popleft()
                added = 0
                for dr, dc in ((-1, 0), (0, 1), (1, 0), (0, -1)):
                    nr, nc = cr + dr, cc + dc
                    if 0 <= nr < rows and 0 <= nc < cols and g[nr][nc] == 1:
                        g[nr][nc] = 0
                        island[(nr, nc)] = count
                        queue.append((nr, nc))
                        added += 1
                t.count("cells")
                t.frame(
                    "for nr, nc in neighbours(r, c):",
                    "visit",
                    f"Flood from ({cr}, {cc}): {added} more land cell(s) join island #{count}",
                    state((cr, cc), set(queue)),
                )
    t.frame("return count", "done", f"{count} island(s) in total", state())
    return {"count": count}


register(
    AlgorithmSpec(
        key="grid_traversal",
        title="Grid Traversal: count the islands",
        topic_id="grid-traversal",
        view="grid",
        kind="pattern",
        description="Treat the grid as a graph where each cell links to its 4 neighbours. Scan the "
        "cells; each new piece of land starts a flood fill that marks its whole island.",
        complexity="Time O(rows × cols) · Space O(rows × cols)",
        source=ISLANDS_SOURCE,
        input_model=MatrixInput,
        example={
            "grid": [
                [1, 1, 0, 0, 0, 1, 1],
                [1, 1, 0, 0, 0, 1, 0],
                [0, 0, 1, 0, 0, 0, 0],
                [0, 0, 1, 1, 0, 1, 1],
                [1, 0, 0, 0, 0, 1, 1],
            ]
        },
        run=run_grid_traversal,
    )
)

# ---------------------------------------------------------------- topological sort

TOPO_SOURCE = """
def topo_sort(graph):
    indegree = {v: 0 for v in graph}
    for v in graph:
        for w in graph[v]:
            indegree[w] += 1
    queue = deque(v for v in graph if indegree[v] == 0)
    order = []
    while queue:
        v = queue.popleft()
        order.append(v)
        for w in graph[v]:
            indegree[w] -= 1
            if indegree[w] == 0:
                queue.append(w)
    return order if len(order) == len(graph) else None
"""


def graph_state(
    nodes: list[str],
    edges: list[tuple[str, str]],
    directed: bool,
    labels: dict[str, str],
    done: list[str],
    current: str | None = None,
    edge: tuple[str, str] | None = None,
    tree_edges: list[tuple[str, str]] | None = None,
    queue: tuple[str, list[Any]] | None = None,
    **vs: Any,
) -> dict[str, Any]:
    return {
        "graph": {
            "nodes": nodes,
            "edges": [{"source": a, "target": b, "label": ""} for a, b in edges],
            "directed": directed,
        },
        "labels": dict(labels),
        "done": list(done),
        "current": current,
        "edge": list(edge) if edge else None,
        "tree_edges": [list(e) for e in (tree_edges or [])],
        "queue": {"label": queue[0], "items": list(queue[1])} if queue else None,
        "vars": vars_(**vs),
    }


def run_topological_sort(inp: DirectedGraphInput, t: Tracer) -> dict[str, Any]:
    nodes, edges = inp.nodes, inp.edges
    graph: dict[str, list[str]] = {v: [] for v in nodes}
    for a, b in edges:
        graph[a].append(b)
    indegree = {v: 0 for v in nodes}
    for _, b in edges:
        indegree[b] += 1
    queue = deque(v for v in nodes if indegree[v] == 0)
    order: list[str] = []

    def state(current: str | None = None, edge: tuple[str, str] | None = None) -> dict[str, Any]:
        labels = {v: f"in {indegree[v]}" for v in nodes if v not in order}
        return graph_state(
            nodes,
            edges,
            True,
            labels,
            order,
            current,
            edge,
            None,
            ("ready", list(queue)),
            order=" → ".join(order) or "-",
        )

    t.frame(
        "queue = deque(v for v in graph if indegree[v] == 0)",
        "start",
        "Count incoming edges; tasks with none can start right away",
        state(),
    )
    while queue:
        v = queue.popleft()
        order.append(v)
        t.count("placed")
        t.frame(
            "order.append(v)", "visit", f"Take {v}: nothing it depends on is left", state(v), [v]
        )
        for w in graph[v]:
            indegree[w] -= 1
            if indegree[w] == 0:
                queue.append(w)
                t.frame(
                    "queue.append(w)",
                    "relax",
                    f"{v} done, so {w} has no prerequisites left: it's ready",
                    state(v, (v, w)),
                    [w],
                )
            else:
                t.frame(
                    "indegree[w] -= 1",
                    "relax",
                    f"{v} done: {w} still waits on {indegree[w]} more",
                    state(v, (v, w)),
                )
    if len(order) < len(nodes):
        stuck = [v for v in nodes if v not in order]
        t.frame(
            "return order if len(order) == len(graph) else None",
            "done",
            f"{', '.join(stuck)} never became ready: the graph has a cycle",
            state(),
        )
        return {"order": None}
    t.frame(
        "return order if len(order) == len(graph) else None",
        "done",
        "Every task placed: " + " → ".join(order),
        state(),
    )
    return {"order": order}


register(
    AlgorithmSpec(
        key="topological_sort",
        title="Topological Sort: order tasks by their prerequisites",
        topic_id="topological-sort",
        view="graph",
        kind="pattern",
        description="Kahn's algorithm: repeatedly take a task with no remaining prerequisites, "
        "then remove its outgoing edges. If tasks remain stuck, there's a cycle.",
        complexity="Time O(V + E) · Space O(V + E)",
        source=TOPO_SOURCE,
        input_model=DirectedGraphInput,
        example={
            "nodes": ["Python", "Arrays", "Recursion", "Sorting", "Trees", "Graphs", "DP"],
            "edges": [
                ["Python", "Arrays"],
                ["Python", "Recursion"],
                ["Arrays", "Sorting"],
                ["Recursion", "Sorting"],
                ["Recursion", "Trees"],
                ["Trees", "Graphs"],
                ["Sorting", "DP"],
                ["Recursion", "DP"],
            ],
        },
        run=run_topological_sort,
    )
)

# ---------------------------------------------------------------- union-find

UNION_FIND_SOURCE = """
def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x

def union(a, b):
    ra, rb = find(a), find(b)
    if ra == rb:
        return False
    parent[rb] = ra
    return True
"""


def run_union_find(inp: UndirectedGraphInput, t: Tracer) -> dict[str, Any]:
    nodes, edges = inp.nodes, inp.edges
    parent = {v: v for v in nodes}
    joined: list[tuple[str, str]] = []
    redundant: list[list[str]] = []
    processed: list[tuple[str, str]] = []

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def components() -> int:
        return len({find(v) for v in nodes})

    def state(current: str | None = None, edge: tuple[str, str] | None = None) -> dict[str, Any]:
        roots = [v for v in nodes if parent[v] == v]
        labels = {v: ("root" if parent[v] == v else f"→ {parent[v]}") for v in nodes}
        return graph_state(
            nodes,
            list(processed),
            False,
            labels,
            roots,
            current,
            edge,
            joined,
            None,
            groups=components(),
            redundant=", ".join(f"{a}–{b}" for a, b in redundant) or "-",
        )

    t.frame("def find(x):", "start", "Every node starts as its own group (its own root)", state())
    for a, b in edges:
        processed.append((a, b))
        ra, rb = find(a), find(b)
        t.count("edges")
        t.frame(
            "ra, rb = find(a), find(b)",
            "compare",
            f"Edge {a}–{b}: {a}'s root is {ra}, {b}'s root is {rb}",
            state(a, (a, b)),
            [a, b],
        )
        if ra == rb:
            redundant.append([a, b])
            t.frame(
                "return False",
                "cycle",
                f"Same root: {a} and {b} are already connected, so this edge makes a cycle",
                state(a, (a, b)),
                [a, b],
            )
            continue
        parent[rb] = ra
        joined.append((a, b))
        t.frame(
            "parent[rb] = ra",
            "union",
            f"Different roots: attach {rb}'s group under {ra}. {components()} group(s) left",
            state(b, (a, b)),
            [a, b],
        )
    t.frame(
        "return True",
        "done",
        f"{components()} connected group(s); redundant edges: {redundant or 'none'}",
        state(),
    )
    return {"groups": components(), "redundant": redundant}


register(
    AlgorithmSpec(
        key="union_find",
        title="Union-Find: connect groups and spot cycles",
        topic_id="union-find",
        view="graph",
        kind="pattern",
        description="Each group has a root. find() walks up to the root (flattening the path as it "
        "goes); union() joins two roots. Two nodes with the same root are already connected.",
        complexity="Time ~O(1) per operation (amortised) · Space O(n)",
        source=UNION_FIND_SOURCE,
        input_model=UndirectedGraphInput,
        example={
            "nodes": ["A", "B", "C", "D", "E", "F", "G"],
            "edges": [
                ["A", "B"],
                ["C", "D"],
                ["B", "C"],
                ["E", "F"],
                ["A", "D"],
                ["F", "G"],
                ["G", "E"],
            ],
        },
        run=run_union_find,
    )
)

# ---------------------------------------------------------------- top K (heap)

TOP_K_SOURCE = """
def kth_largest(nums, k):
    heap = []
    for x in nums:
        heapq.heappush(heap, x)
        if len(heap) > k:
            heapq.heappop(heap)
    return heap[0]
"""


def ordinal(n: int) -> str:
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def heap_nodes(heap: list[int]) -> list[dict[str, Any]]:
    return [
        {
            "id": i,
            "val": v,
            "left": 2 * i + 1 if 2 * i + 1 < len(heap) else None,
            "right": 2 * i + 2 if 2 * i + 2 < len(heap) else None,
        }
        for i, v in enumerate(heap)
    ]


def run_top_k(inp: TopKInput, t: Tracer) -> dict[str, Any]:
    nums, k = inp.array, inp.k
    heap: list[int] = []

    def state(i: int, tones: dict[int, str] | None = None) -> dict[str, Any]:
        tt = {0: "outline"} if heap else {}
        tt.update(tones or {})
        rest = [str(x) for x in nums[i + 1 :]]
        return tree_state(
            heap_nodes(heap),
            tt,
            None,
            ("still to come", rest),
            k=k,
            heap_size=len(heap),
            smallest_kept=heap[0] if heap else "-",
        )

    t.frame(
        "heap = []", "start", f"Keep a min-heap of the {k} largest numbers seen so far", state(-1)
    )
    for i, x in enumerate(nums):
        heapq.heappush(heap, x)
        t.count("pushes")
        pos = heap.index(x)
        t.frame(
            "heapq.heappush(heap, x)",
            "push",
            f"Push {x}; it bubbles up to its place",
            state(i, {pos: "active"}),
            [pos],
        )
        if len(heap) > k:
            smallest = heapq.heappop(heap)
            t.count("pops")
            t.frame(
                "heapq.heappop(heap)",
                "pop",
                f"The heap has {k + 1} items: drop the smallest ({smallest}), "
                f"it can't be in the top {k}",
                state(i),
            )
    t.frame(
        "return heap[0]",
        "found",
        f"The top of the heap, {heap[0]}, is the {ordinal(k)} largest",
        state(len(nums) - 1, {0: "found"}),
        [0],
    )
    return {"kth": heap[0], "top_k": sorted(heap, reverse=True)}


register(
    AlgorithmSpec(
        key="top_k_elements",
        title="Top K Elements: kth largest with a min-heap",
        topic_id="top-k-elements",
        view="tree",
        kind="pattern",
        description="Keep a min-heap of size k. Each new number goes in; if the heap gets too "
        "big, the smallest comes out. What's left is the top k; the root is the kth largest.",
        complexity="Time O(n log k) · Space O(k)",
        source=TOP_K_SOURCE,
        input_model=TopKInput,
        example={"array": [3, 2, 1, 5, 6, 4, 9, 7], "k": 3},
        run=run_top_k,
    )
)
