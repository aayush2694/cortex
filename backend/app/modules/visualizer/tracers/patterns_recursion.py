"""Recursion patterns, traced step by step: backtracking and dynamic programming on a grid.

Backtracking uses the "tree" view: the decision tree grows as choices are made.

"table" view state (DP):
    {"table": [[...]], "row_labels": [...], "col_labels": [...],
     "tones": [[...]], "active": [i, j] | None, "vars": [...]}
Tones: "" (filled) | "empty" | "active" | "dep" | "path".
"""

from typing import Any

from app.modules.visualizer.inputs import SubsetsInput, TwoStringsInput
from app.modules.visualizer.tracer import AlgorithmSpec, Tracer, register
from app.modules.visualizer.tracers.patterns_arrays import vars_
from app.modules.visualizer.tracers.patterns_trees import tree_state

# ---------------------------------------------------------------- backtracking

SUBSETS_SOURCE = """
def subsets(nums):
    result, path = [], []
    def backtrack(i):
        if i == len(nums):
            result.append(path[:])
            return
        path.append(nums[i])
        backtrack(i + 1)
        path.pop()
        backtrack(i + 1)
    backtrack(0)
    return result
"""


def run_backtracking(inp: SubsetsInput, t: Tracer) -> dict[str, Any]:
    nums = inp.array
    nodes: list[dict[str, Any]] = []
    labels: dict[int, str] = {}
    result: list[list[int]] = []
    leaves: set[int] = set()
    path: list[int] = []
    on_path: list[int] = []  # node ids from the root to the current node

    def fmt(p: list[int]) -> str:
        return "{" + ",".join(str(x) for x in p) + "}"

    def add_node(val: str, parent: int | None, side: str | None) -> int:
        nid = len(nodes)
        nodes.append({"id": nid, "val": val, "left": None, "right": None})
        if parent is not None and side:
            nodes[parent][side] = nid
        labels[nid] = fmt(path)
        return nid

    def state(current: int) -> dict[str, Any]:
        tones = {i: "dim" for i in range(len(nodes))}
        tones.update({i: "done" for i in leaves})
        tones.update({i: "outline" for i in on_path})
        tones[current] = "active"
        return tree_state(
            nodes, tones, labels, ("subsets found", [fmt(r) for r in result]), path=fmt(path)
        )

    def backtrack(i: int, nid: int) -> None:
        on_path.append(nid)
        if i == len(nums):
            result.append(path[:])
            leaves.add(nid)
            t.count("subsets")
            t.frame(
                "result.append(path[:])",
                "found",
                f"No numbers left to decide: record {fmt(path)}",
                state(nid),
                [nid],
            )
            on_path.pop()
            return
        path.append(nums[i])
        child = add_node(f"+{nums[i]}", nid, "left")
        t.count("choices")
        t.frame(
            "path.append(nums[i])",
            "choose",
            f"Choose {nums[i]}: path is now {fmt(path)}",
            state(child),
            [child],
        )
        backtrack(i + 1, child)
        path.pop()
        t.frame(
            "path.pop()",
            "undo",
            f"Undo: take {nums[i]} back out, path is {fmt(path)} again",
            state(nid),
            [nid],
        )
        child = add_node(f"−{nums[i]}", nid, "right")
        t.frame("backtrack(i + 1)", "skip", f"Now try skipping {nums[i]}", state(child), [child])
        backtrack(i + 1, child)
        on_path.pop()

    root = add_node("∅", None, None)
    t.frame(
        "result, path = [], []",
        "start",
        "For each number, branch twice: once with it, once without it",
        state(root),
    )
    backtrack(0, root)
    t.frame("return result", "done", f"Every branch explored: {len(result)} subsets", state(root))
    return {"subsets": result}


register(
    AlgorithmSpec(
        key="backtracking",
        title="Backtracking: generate every subset",
        topic_id="backtracking",
        view="tree",
        kind="pattern",
        description="Build a solution one choice at a time. After exploring a choice, undo it "
        "and try the next one. The choices form a decision tree you walk depth-first.",
        complexity="Time O(n · 2ⁿ) · Space O(n)",
        source=SUBSETS_SOURCE,
        input_model=SubsetsInput,
        example={"array": [1, 2, 3]},
        run=run_backtracking,
    )
)

# ---------------------------------------------------------------- DP on a grid

LCS_SOURCE = """
def lcs(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[len(a)][len(b)]
"""


def run_dp_grid(inp: TwoStringsInput, t: Tracer) -> dict[str, Any]:
    a, b = inp.a, inp.b
    n, m = len(a), len(b)
    dp: list[list[Any]] = [[0] * (m + 1) for _ in range(n + 1)]
    filled = [[i == 0 or j == 0 for j in range(m + 1)] for i in range(n + 1)]

    def state(
        active: tuple[int, int] | None = None,
        deps: list[tuple[int, int]] | None = None,
        path: list[tuple[int, int]] | None = None,
    ) -> dict[str, Any]:
        tones = [["" if filled[i][j] else "empty" for j in range(m + 1)] for i in range(n + 1)]
        for i, j in deps or []:
            tones[i][j] = "dep"
        for i, j in path or []:
            tones[i][j] = "path"
        if active:
            tones[active[0]][active[1]] = "active"
        return {
            "table": [
                [dp[i][j] if filled[i][j] else "" for j in range(m + 1)] for i in range(n + 1)
            ],
            "row_labels": ["∅", *a],
            "col_labels": ["∅", *b],
            "tones": tones,
            "active": list(active) if active else None,
            "vars": vars_(a=a, b=b, lcs_length=dp[n][m] if filled[n][m] else "-"),
        }

    t.frame(
        "dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]",
        "start",
        "dp[i][j] = longest common subsequence of a[:i] and b[:j]. "
        "Row and column 0 (empty string) are 0.",
        state(),
    )
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            t.count("cells")
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
                filled[i][j] = True
                t.frame(
                    "dp[i][j] = dp[i - 1][j - 1] + 1",
                    "match",
                    f"'{a[i - 1]}' = '{b[j - 1]}': extend the diagonal, "
                    f"{dp[i - 1][j - 1]} + 1 = {dp[i][j]}",
                    state((i, j), [(i - 1, j - 1)]),
                    [i, j],
                )
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
                filled[i][j] = True
                t.frame(
                    "dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])",
                    "compare",
                    f"'{a[i - 1]}' ≠ '{b[j - 1]}': best of above ({dp[i - 1][j]}) "
                    f"and left ({dp[i][j - 1]})",
                    state((i, j), [(i - 1, j), (i, j - 1)]),
                    [i, j],
                )

    # Walk back from the corner to recover one longest common subsequence.
    i, j, path, letters = n, m, [], []
    while i > 0 and j > 0:
        path.append((i, j))
        if a[i - 1] == b[j - 1]:
            letters.append(a[i - 1])
            i, j = i - 1, j - 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            i -= 1
        else:
            j -= 1
    word = "".join(reversed(letters))
    t.frame(
        "return dp[len(a)][len(b)]",
        "done",
        f"The answer is in the corner: {dp[n][m]}. Walking back along matches spells '{word}'",
        state(None, None, path),
    )
    return {"length": dp[n][m], "subsequence": word}


register(
    AlgorithmSpec(
        key="dp_grid",
        title="DP on a Grid: longest common subsequence",
        topic_id="dp-grid",
        view="table",
        kind="pattern",
        description="Each cell answers a smaller version of the problem, built only from cells "
        "already filled: the one diagonally up-left, above, or to the left.",
        complexity="Time O(n · m) · Space O(n · m)",
        source=LCS_SOURCE,
        input_model=TwoStringsInput,
        example={"a": "abcbdab", "b": "bdcaba"},
        run=run_dp_grid,
    )
)
