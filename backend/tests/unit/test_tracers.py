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


PATTERNS = {
    "two_pointers",
    "sliding_window",
    "prefix_sum",
    "frequency_counting",
    "modified_binary_search",
    "cyclic_sort",
    "fast_slow_pointers",
    "linked_list_reversal",
    "monotonic_stack",
    "merge_intervals",
    "tree_bfs",
    "tree_dfs",
    "grid_traversal",
    "topological_sort",
    "union_find",
    "top_k_elements",
    "backtracking",
    "dp_grid",
}


def test_all_algorithms_registered() -> None:
    algorithms = {k for k, v in REGISTRY.items() if v.kind == "algorithm"}
    patterns = {k for k, v in REGISTRY.items() if v.kind == "pattern"}
    assert algorithms == {*SORTS, "binary_search", "bfs_grid", "dijkstra"}
    assert patterns >= PATTERNS


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


# ---------------------------------------------------------------- patterns (vs brute force)


def check_sequence_frames(out: Any) -> None:
    check_frames(out)
    for f in out.frames:
        for r in f.state["rows"]:
            assert len(r["tones"]) == len(r["cells"])
            assert all(0 <= i < len(r["cells"]) for i in r["pointers"].values())


def test_two_pointers_matches_brute_force() -> None:
    rng = random.Random(21)
    for _ in range(150):
        arr = [rng.randint(-20, 20) for _ in range(rng.randint(2, 12))]
        target = rng.randint(-30, 30)
        out = service.trace("two_pointers", {"array": arr, "target": target})
        nums = sorted(arr)
        exists = any(
            nums[i] + nums[j] == target for i in range(len(nums)) for j in range(i + 1, len(nums))
        )
        assert out.result["found"] == exists
        if exists:
            i, j = out.result["indices"]
            assert i < j and nums[i] + nums[j] == target
        check_sequence_frames(out)


def test_sliding_window_matches_brute_force() -> None:
    rng = random.Random(22)
    for _ in range(150):
        text = "".join(rng.choice("abcd") for _ in range(rng.randint(1, 16)))
        best = max(
            j - i
            for i in range(len(text))
            for j in range(i + 1, len(text) + 1)
            if len(set(text[i:j])) == j - i
        )
        out = service.trace("sliding_window", {"text": text})
        assert out.result["best"] == best
        check_sequence_frames(out)


def test_prefix_sum_matches_brute_force() -> None:
    rng = random.Random(23)
    for _ in range(150):
        arr = [rng.randint(-5, 5) for _ in range(rng.randint(1, 12))]
        k = rng.randint(-6, 6)
        brute = sum(
            1 for i in range(len(arr)) for j in range(i + 1, len(arr) + 1) if sum(arr[i:j]) == k
        )
        out = service.trace("prefix_sum", {"array": arr, "k": k})
        assert out.result["count"] == brute
        check_sequence_frames(out)


def test_two_sum_hash_map() -> None:
    rng = random.Random(24)
    for _ in range(150):
        arr = [rng.randint(-15, 15) for _ in range(rng.randint(2, 12))]
        target = rng.randint(-20, 20)
        out = service.trace("frequency_counting", {"array": arr, "target": target})
        exists = any(
            arr[i] + arr[j] == target for i in range(len(arr)) for j in range(i + 1, len(arr))
        )
        assert out.result["found"] == exists
        if exists:
            i, j = out.result["indices"]
            assert i < j and arr[i] + arr[j] == target


def test_rotated_search_matches_index() -> None:
    rng = random.Random(25)
    for _ in range(150):
        base = sorted(rng.sample(range(-50, 50), rng.randint(1, 14)))
        cut = rng.randrange(len(base))
        arr = base[cut:] + base[:cut]
        target = rng.choice(arr) if rng.random() < 0.7 else rng.randint(-60, 60)
        out = service.trace("modified_binary_search", {"array": arr, "target": target})
        assert out.result["index"] == (arr.index(target) if target in arr else -1)
        check_sequence_frames(out)


def test_rotated_input_must_be_a_rotation() -> None:
    with pytest.raises(ValidationFailed):
        service.trace("modified_binary_search", {"array": [3, 1, 2, 0], "target": 1})


def test_cyclic_sort_finds_missing_numbers() -> None:
    rng = random.Random(26)
    for _ in range(150):
        n = rng.randint(1, 14)
        arr = [rng.randint(1, n) for _ in range(n)]
        out = service.trace("cyclic_sort", {"array": arr})
        assert out.result["missing"] == sorted(set(range(1, n + 1)) - set(arr))
        check_sequence_frames(out)


def check_list_frames(out: Any, n: int) -> None:
    check_frames(out)
    for f in out.frames:
        st = f.state
        assert len(st["values"]) == n and len(st["next"]) == n and len(st["tones"]) == n
        assert all(-1 <= x <= n for x in st["next"])
        assert all(-1 <= x <= n for x in st["pointers"].values())


def test_fast_slow_finds_cycle_start() -> None:
    rng = random.Random(31)
    for _ in range(200):
        n = rng.randint(1, 10)
        values = [rng.randint(-9, 9) for _ in range(n)]
        cycle_at = rng.choice([-1, *range(n)])
        out = service.trace("fast_slow_pointers", {"values": values, "cycle_at": cycle_at})
        assert out.result["cycle_start"] == (None if cycle_at == -1 else cycle_at)
        check_list_frames(out, n)


def test_reversal_reverses() -> None:
    rng = random.Random(32)
    for _ in range(100):
        values = [rng.randint(-9, 9) for _ in range(rng.randint(1, 10))]
        out = service.trace("linked_list_reversal", {"values": values})
        assert out.result["values"] == values[::-1]
        check_list_frames(out, len(values))


def test_monotonic_stack_matches_brute_force() -> None:
    rng = random.Random(33)
    for _ in range(150):
        temps = [rng.randint(30, 40) for _ in range(rng.randint(1, 14))]
        brute = [
            next((j - i for j in range(i + 1, len(temps)) if temps[j] > temps[i]), 0)
            for i in range(len(temps))
        ]
        out = service.trace("monotonic_stack", {"array": temps})
        assert out.result["answer"] == brute
        check_sequence_frames(out)
        assert all("stack" in f.state for f in out.frames)


def test_merge_intervals_matches_reference() -> None:
    rng = random.Random(34)
    for _ in range(150):
        ivs = []
        for _ in range(rng.randint(1, 12)):
            s = rng.randint(0, 50)
            ivs.append([s, s + rng.randint(0, 10)])
        covered = sorted(ivs)
        ref: list[list[int]] = []
        for s, e in covered:
            if ref and s <= ref[-1][1]:
                ref[-1][1] = max(ref[-1][1], e)
            else:
                ref.append([s, e])
        out = service.trace("merge_intervals", {"intervals": ivs})
        assert out.result["merged"] == ref
        check_frames(out)


@pytest.mark.parametrize(
    ("key", "bad_input"),
    [
        ("fast_slow_pointers", {"values": [1, 2], "cycle_at": 2}),
        ("linked_list_reversal", {"values": []}),
        ("merge_intervals", {"intervals": [[5, 1]]}),
        ("merge_intervals", {"intervals": [[0, 61]]}),
    ],
)
def test_batch2_invalid_input(key: str, bad_input: dict[str, Any]) -> None:
    with pytest.raises(ValidationFailed):
        service.trace(key, bad_input)


def test_frames_are_snapshots_not_shared_references() -> None:
    """Each frame must keep its own copy of the state; later steps must not rewrite earlier ones."""
    out = service.trace("linked_list_reversal", {"values": [1, 2, 3, 4]})
    assert out.frames[0].state["next"] == [1, 2, 3, 4]
    assert out.frames[-1].state["next"] == [-1, 0, 1, 2]
    for key, spec in REGISTRY.items():
        frames = service.trace(key, spec.example).frames
        dumped = [f.model_dump_json() for f in frames]
        assert len(set(dumped)) > 1, f"{key}: every frame looks the same"


# ---------------------------------------------------------------- batch 3: trees, graphs, heaps


def random_tree(rng: random.Random) -> list[int | None]:
    """A random binary tree in LeetCode level order."""
    values: list[int | None] = [rng.randint(-9, 9)]
    open_slots, nodes = 2, 1
    while open_slots and nodes < 12:
        if rng.random() < 0.7:
            values.append(rng.randint(-9, 9))
            nodes += 1
            open_slots += 1
        else:
            values.append(None)
            open_slots -= 1
    return values


def tree_from(values: list[int | None]) -> dict[int, tuple[int, int | None, int | None]]:
    from app.modules.visualizer.tracers.patterns_trees import build_tree

    return {n["id"]: (n["val"], n["left"], n["right"]) for n in build_tree(values)}


def test_tree_bfs_levels() -> None:
    rng = random.Random(41)
    for _ in range(150):
        values = random_tree(rng)
        t = tree_from(values)
        levels, frontier = [], [0]
        while frontier:
            levels.append([t[i][0] for i in frontier])
            frontier = [c for i in frontier for c in (t[i][1], t[i][2]) if c is not None]
        out = service.trace("tree_bfs", {"tree": values})
        assert out.result["levels"] == levels
        check_frames(out)


def test_tree_dfs_path_sum() -> None:
    rng = random.Random(42)
    for _ in range(200):
        values = random_tree(rng)
        t = tree_from(values)
        sums: list[int] = []

        def walk(i: int, acc: int, t: Any = t, sums: list[int] = sums) -> None:
            val, left, right = t[i]
            acc += val
            if left is None and right is None:
                sums.append(acc)
            for c in (left, right):
                if c is not None:
                    walk(c, acc)

        walk(0, 0)
        target = rng.choice(sums) if rng.random() < 0.6 else rng.randint(-30, 30)
        out = service.trace("tree_dfs", {"tree": values, "target": target})
        assert out.result["found"] == (target in sums)
        if out.result["found"]:
            assert sum(out.result["path"]) == target
        check_frames(out)


def test_grid_traversal_counts_islands() -> None:
    rng = random.Random(43)
    for _ in range(150):
        rows, cols = rng.randint(1, 8), rng.randint(1, 10)
        grid = [[1 if rng.random() < 0.45 else 0 for _ in range(cols)] for _ in range(rows)]
        seen, count = set(), 0
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] and (r, c) not in seen:
                    count += 1
                    stack = [(r, c)]
                    seen.add((r, c))
                    while stack:
                        a, b = stack.pop()
                        for na, nb in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                            if (
                                0 <= na < rows
                                and 0 <= nb < cols
                                and grid[na][nb]
                                and (na, nb) not in seen
                            ):
                                seen.add((na, nb))
                                stack.append((na, nb))
        out = service.trace("grid_traversal", {"grid": grid})
        assert out.result["count"] == count
        check_frames(out)


def test_topological_sort_is_valid_or_detects_cycle() -> None:
    rng = random.Random(44)
    for _ in range(200):
        nodes = [f"T{i}" for i in range(rng.randint(1, 9))]
        edges = list({(rng.choice(nodes), rng.choice(nodes)) for _ in range(rng.randint(0, 14))})
        edges = [e for e in edges if e[0] != e[1]]
        out = service.trace("topological_sort", {"nodes": nodes, "edges": edges})
        order = out.result["order"]
        # Brute force: a cycle exists iff repeatedly removing sources can't empty the graph.
        remaining, es = set(nodes), set(edges)
        while True:
            sources = [v for v in remaining if not any(b == v and a in remaining for a, b in es)]
            if not sources:
                break
            remaining -= set(sources)
        if remaining:
            assert order is None
        else:
            pos = {v: i for i, v in enumerate(order)}
            assert sorted(order) == sorted(nodes)
            assert all(pos[a] < pos[b] for a, b in edges)
        check_frames(out)


def test_union_find_groups_and_cycles() -> None:
    rng = random.Random(45)
    for _ in range(200):
        nodes = [f"N{i}" for i in range(rng.randint(1, 9))]
        edges = [(rng.choice(nodes), rng.choice(nodes)) for _ in range(rng.randint(0, 12))]
        edges = [e for e in edges if e[0] != e[1]]
        out = service.trace("union_find", {"nodes": nodes, "edges": edges})
        # Brute force: grow components one edge at a time.
        comp = {v: {v} for v in nodes}
        redundant = []
        for a, b in edges:
            if comp[a] is comp[b]:
                redundant.append([a, b])
                continue
            merged = comp[a] | comp[b]
            for v in merged:
                comp[v] = merged
        groups = len({id(s) for s in comp.values()})
        assert out.result["groups"] == groups
        assert out.result["redundant"] == redundant
        check_frames(out)


def test_top_k_matches_sorting() -> None:
    rng = random.Random(46)
    for _ in range(150):
        arr = [rng.randint(-20, 20) for _ in range(rng.randint(1, 12))]
        k = rng.randint(1, len(arr))
        out = service.trace("top_k_elements", {"array": arr, "k": k})
        assert out.result["kth"] == sorted(arr, reverse=True)[k - 1]
        assert out.result["top_k"] == sorted(arr, reverse=True)[:k]
        check_frames(out)


@pytest.mark.parametrize(
    ("key", "bad_input"),
    [
        ("tree_bfs", {"tree": [None, 1]}),
        ("tree_bfs", {"tree": list(range(16))}),
        ("grid_traversal", {"grid": [[1, 0], [1]]}),
        ("grid_traversal", {"grid": [[2]]}),
        ("topological_sort", {"nodes": ["A"], "edges": [["A", "B"]]}),
        ("topological_sort", {"nodes": ["A"], "edges": [["A", "A"]]}),
        ("top_k_elements", {"array": [1, 2], "k": 3}),
    ],
)
def test_batch3_invalid_input(key: str, bad_input: dict[str, Any]) -> None:
    with pytest.raises(ValidationFailed):
        service.trace(key, bad_input)


# ---------------------------------------------------------------- batch 4: recursion


def test_backtracking_generates_every_subset() -> None:
    from itertools import combinations

    rng = random.Random(51)
    for _ in range(60):
        arr = rng.sample(range(-9, 30), rng.randint(1, 4))
        expected = {tuple(c) for r in range(len(arr) + 1) for c in combinations(arr, r)}
        out = service.trace("backtracking", {"array": arr})
        got = [tuple(s) for s in out.result["subsets"]]
        assert len(got) == 2 ** len(arr) and set(got) == expected
        check_frames(out)
        # The decision tree has one node per call: 2^(n+1) - 1.
        assert len(out.frames[-1].state["nodes"]) == 2 ** (len(arr) + 1) - 1


def test_dp_grid_matches_recursive_lcs() -> None:
    from functools import cache

    rng = random.Random(52)
    for _ in range(150):
        a = "".join(rng.choice("abcd") for _ in range(rng.randint(1, 8)))
        b = "".join(rng.choice("abcd") for _ in range(rng.randint(1, 8)))

        @cache
        def lcs(i: int, j: int, a: str = a, b: str = b) -> int:
            if i == len(a) or j == len(b):
                return 0
            if a[i] == b[j]:
                return 1 + lcs(i + 1, j + 1)
            return max(lcs(i + 1, j), lcs(i, j + 1))

        out = service.trace("dp_grid", {"a": a, "b": b})
        word = out.result["subsequence"]
        assert out.result["length"] == lcs(0, 0) == len(word)
        # The recovered word really is a subsequence of both strings.
        for s_ in (a, b):
            it = iter(s_)
            assert all(ch in it for ch in word)
        check_frames(out)
        table = out.frames[-1].state["table"]
        assert len(table) == len(a) + 1 and len(table[0]) == len(b) + 1


@pytest.mark.parametrize(
    ("key", "bad_input"),
    [
        ("backtracking", {"array": [1, 1]}),
        ("backtracking", {"array": [1, 2, 3, 4, 5]}),
        ("dp_grid", {"a": "ABC", "b": "abc"}),
        ("dp_grid", {"a": "abcdefghi", "b": "a"}),
    ],
)
def test_batch4_invalid_input(key: str, bad_input: dict[str, Any]) -> None:
    with pytest.raises(ValidationFailed):
        service.trace(key, bad_input)
