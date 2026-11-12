"""Problem-solving patterns on linked lists, stacks and intervals, traced step by step.

"list" view state:
    {"values": [...], "next": [...], "pointers": {"slow": 0}, "tones": [...]}
  next[i] is the index node i points to; -1 means a "null" on the left, n means "null" on
  the right. Pointers use the same convention, so prev = None is drawn at the left null.

"intervals" view state:
    {"intervals": [[s, e], ...], "merged": [[s, e], ...], "current": i | None,
     "tones": [...], "axis": [lo, hi]}
"""

from typing import Any

from app.modules.visualizer.inputs import IntervalsInput, LinkedListInput, ListInput, TempsInput
from app.modules.visualizer.tracer import AlgorithmSpec, Tracer, register
from app.modules.visualizer.tracers.patterns_arrays import row, vars_

# ---------------------------------------------------------------- fast and slow pointers

FAST_SLOW_SOURCE = """
def detect_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            break
    else:
        return None
    slow = head
    while slow is not fast:
        slow = slow.next
        fast = fast.next
    return slow
"""


def run_fast_slow(inp: LinkedListInput, t: Tracer) -> dict[str, Any]:
    values = inp.values
    n = len(values)
    nxt = [i + 1 for i in range(n)]  # n = null on the right
    if inp.cycle_at >= 0:
        nxt[-1] = inp.cycle_at

    def step(i: int) -> int:
        return nxt[i] if 0 <= i < n else n

    def state(slow: int, fast: int, tones: dict[int, str] | None = None) -> dict[str, Any]:
        tt = tones or {}
        return {
            "values": values,
            "next": list(nxt),
            "pointers": {"slow": slow, "fast": fast},
            "tones": [tt.get(i, "") for i in range(n)],
        }

    slow = fast = 0
    t.frame(
        "slow = fast = head",
        "start",
        "Both pointers start at the head",
        state(slow, fast, {0: "active"}),
    )
    met = False
    while fast < n and step(fast) < n:
        slow = step(slow)
        fast = step(step(fast))
        t.count("moves")
        fast_label = str(values[fast]) if fast < n else "null"
        t.frame(
            "fast = fast.next.next",
            "move",
            f"slow takes 1 step to {values[slow]}, fast takes 2 steps to {fast_label}",
            state(
                slow, fast, {slow: "active", fast: "outline"} if slow != fast else {slow: "found"}
            ),
        )
        if slow == fast:
            met = True
            t.frame(
                "if slow is fast:",
                "found",
                "They met, so there is a cycle: fast lapped slow inside the loop",
                state(slow, fast, {slow: "found"}),
                [slow],
            )
            break
    if not met:
        t.frame(
            "return None",
            "done",
            "fast reached the end (null): there is no cycle",
            state(slow, fast),
        )
        return {"cycle_start": None}

    slow = 0
    t.frame(
        "slow = head",
        "reset",
        "Phase 2: move slow back to the head. Both now step once at a time.",
        state(slow, fast, {slow: "active", fast: "outline"}),
    )
    while slow != fast:
        slow, fast = step(slow), step(fast)
        t.count("moves")
        t.frame(
            "fast = fast.next",
            "move",
            f"Both take one step: slow at {values[slow]}, fast at {values[fast]}",
            state(
                slow, fast, {slow: "active", fast: "outline"} if slow != fast else {slow: "found"}
            ),
        )
    t.frame(
        "return slow",
        "found",
        f"They meet at {values[slow]} (index {slow}): that's where the cycle starts",
        state(slow, fast, {slow: "found"}),
        [slow],
    )
    return {"cycle_start": slow}


register(
    AlgorithmSpec(
        key="fast_slow_pointers",
        title="Fast & Slow Pointers: find where a cycle starts",
        topic_id="fast-slow-pointers",
        view="list",
        kind="pattern",
        description="Move one pointer one step and another two steps. If there's a loop, the "
        "fast one laps the slow one; resetting slow to the head then finds the loop's start.",
        complexity="Time O(n) · Space O(1)",
        source=FAST_SLOW_SOURCE,
        input_model=LinkedListInput,
        example={"values": [3, 8, 5, 1, 9, 6, 4], "cycle_at": 2},
        run=run_fast_slow,
    )
)

# ---------------------------------------------------------------- in-place reversal

REVERSE_SOURCE = """
def reverse_list(head):
    prev, curr = None, head
    while curr:
        nxt = curr.next
        curr.next = prev
        prev = curr
        curr = nxt
    return prev
"""


def run_reversal(inp: ListInput, t: Tracer) -> dict[str, Any]:
    values = inp.values
    n = len(values)
    nxt = [i + 1 for i in range(n)]
    reversed_upto = -1

    def state(prev: int, curr: int, after: int | None = None) -> dict[str, Any]:
        ptrs = {"prev": prev, "curr": curr}
        if after is not None:
            ptrs["next"] = after
        tones = ["done" if i <= reversed_upto else "" for i in range(n)]
        if 0 <= curr < n:
            tones[curr] = "active"
        return {"values": values, "next": list(nxt), "pointers": ptrs, "tones": tones}

    prev, curr = -1, 0
    t.frame(
        "prev, curr = None, head",
        "start",
        "prev starts at null, curr at the head",
        state(prev, curr),
    )
    while curr < n:
        after = nxt[curr]
        t.frame(
            "nxt = curr.next",
            "save",
            f"Remember the node after {values[curr]} before we cut its link",
            state(prev, curr, after),
        )
        nxt[curr] = prev
        reversed_upto = curr
        t.count("relinks")
        target = "null" if prev == -1 else str(values[prev])
        t.frame(
            "curr.next = prev",
            "relink",
            f"Point {values[curr]} back to {target}",
            state(prev, curr, after),
            [curr],
        )
        prev, curr = curr, after
        t.frame("curr = nxt", "move", "Move prev and curr one step forward", state(prev, curr))
    t.frame(
        "return prev",
        "done",
        f"curr fell off the end; prev ({values[prev]}) is the new head",
        {"values": values, "next": list(nxt), "pointers": {"head": prev}, "tones": ["done"] * n},
    )
    order, i = [], prev
    while 0 <= i < n:
        order.append(values[i])
        i = nxt[i]
    return {"values": order}


register(
    AlgorithmSpec(
        key="linked_list_reversal",
        title="In-place Reversal: reverse a linked list",
        topic_id="linked-list-reversal",
        view="list",
        kind="pattern",
        description="Walk the list once with three pointers (prev, curr, next) and flip each link "
        "to point backwards. No extra list is needed.",
        complexity="Time O(n) · Space O(1)",
        source=REVERSE_SOURCE,
        input_model=ListInput,
        example={"values": [1, 2, 3, 4, 5, 6]},
        run=run_reversal,
    )
)

# ---------------------------------------------------------------- monotonic stack

MONO_SOURCE = """
def daily_temperatures(temps):
    answer = [0] * len(temps)
    stack = []
    for i, t in enumerate(temps):
        while stack and temps[stack[-1]] < t:
            j = stack.pop()
            answer[j] = i - j
        stack.append(i)
    return answer
"""


def run_monotonic_stack(inp: TempsInput, t: Tracer) -> dict[str, Any]:
    temps = inp.array
    answer: list[Any] = [0] * len(temps)
    resolved: set[int] = set()
    stack: list[int] = []

    def state(i: int, tones: dict[int, str] | None = None) -> dict[str, Any]:
        tt = {j: "dim" for j in resolved}
        tt.update({j: "outline" for j in stack})
        tt.update(tones or {})
        return {
            "rows": [
                row("temps", temps, tt, {"i": i} if i >= 0 else {}),
                row("days", answer, {j: "done" for j in resolved}),
            ],
            "stack": {"label": "stack (waiting)", "items": [temps[j] for j in stack]},
            "vars": vars_(),
        }

    t.frame(
        "stack = []",
        "start",
        "The stack holds days still waiting for a warmer day; it stays in decreasing order",
        state(-1),
    )
    for i, temp in enumerate(temps):
        t.frame(
            "for i, t in enumerate(temps):",
            "visit",
            f"Day {i}: {temp}°",
            state(i, {i: "active"}),
            [i],
        )
        while stack and temps[stack[-1]] < temp:
            j = stack.pop()
            answer[j] = i - j
            resolved.add(j)
            t.count("pops")
            t.frame(
                "answer[j] = i - j",
                "pop",
                f"{temp}° is warmer than day {j} ({temps[j]}°): pop it, it waited {i - j} day(s)",
                state(i, {i: "active", j: "found"}),
                [j],
            )
        stack.append(i)
        t.count("pushes")
        t.frame(
            "stack.append(i)",
            "push",
            f"Push day {i}: it now waits for something warmer than {temp}°",
            state(i, {i: "outline"}),
        )
    t.frame(
        "return answer",
        "done",
        "Days left on the stack never get warmer, so their answer stays 0",
        state(-1),
    )
    return {"answer": answer}


register(
    AlgorithmSpec(
        key="monotonic_stack",
        title="Monotonic Stack: days until a warmer temperature",
        topic_id="monotonic-stack",
        view="sequence",
        kind="pattern",
        description="Keep a stack in sorted order. Each new item pops everything it 'beats', "
        "answering their question in one go. Every item is pushed and popped once.",
        complexity="Time O(n) · Space O(n)",
        source=MONO_SOURCE,
        input_model=TempsInput,
        example={"array": [73, 74, 75, 71, 69, 72, 76, 73]},
        run=run_monotonic_stack,
    )
)

# ---------------------------------------------------------------- merge intervals

MERGE_SOURCE = """
def merge(intervals):
    intervals.sort(key=lambda iv: iv[0])
    merged = []
    for start, end in intervals:
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged
"""


def run_merge_intervals(inp: IntervalsInput, t: Tracer) -> dict[str, Any]:
    ivs = sorted([list(iv) for iv in inp.intervals], key=lambda iv: iv[0])
    lo = min(s for s, _ in ivs)
    hi = max(e for _, e in ivs)
    merged: list[list[int]] = []

    def state(current: int | None, tones: dict[int, str] | None = None) -> dict[str, Any]:
        tt = tones or {}
        return {
            "intervals": ivs,
            "merged": [list(m) for m in merged],
            "current": current,
            "tones": [tt.get(i, "") for i in range(len(ivs))],
            "axis": [lo, hi],
        }

    t.frame(
        "intervals.sort(key=lambda iv: iv[0])",
        "sort",
        "Sort the intervals by start time",
        state(None),
    )
    for i, (start, end) in enumerate(ivs):
        done = {j: "done" for j in range(i)}
        if merged and start <= merged[-1][1]:
            t.count("merges")
            t.frame(
                "if merged and start <= merged[-1][1]:",
                "compare",
                f"[{start}, {end}] starts before the last merged interval ends "
                f"({merged[-1][1]}): they overlap",
                state(i, {**done, i: "active"}),
                [i],
            )
            merged[-1][1] = max(merged[-1][1], end)
            t.frame(
                "merged[-1][1] = max(merged[-1][1], end)",
                "merge",
                f"Extend it to [{merged[-1][0]}, {merged[-1][1]}]",
                state(i, {**done, i: "found"}),
                [i],
            )
        else:
            reason = (
                "Nothing merged yet"
                if not merged
                else f"[{start}, {end}] starts after {merged[-1][1]}: no overlap"
            )
            t.frame(
                "if merged and start <= merged[-1][1]:",
                "compare",
                reason,
                state(i, {**done, i: "active"}),
                [i],
            )
            merged.append([start, end])
            t.frame(
                "merged.append([start, end])",
                "add",
                f"Start a new merged interval [{start}, {end}]",
                state(i, {**done, i: "found"}),
                [i],
            )
    t.frame(
        "return merged",
        "done",
        f"{len(ivs)} intervals became {len(merged)}",
        state(None, {j: "done" for j in range(len(ivs))}),
    )
    return {"merged": merged}


register(
    AlgorithmSpec(
        key="merge_intervals",
        title="Merge Intervals: combine overlapping ranges",
        topic_id="merge-intervals",
        view="intervals",
        kind="pattern",
        description="Sort by start time. Then each interval either overlaps the last merged one "
        "(extend it) or starts a new one. Sorting makes a single pass enough.",
        complexity="Time O(n log n) · Space O(n)",
        source=MERGE_SOURCE,
        input_model=IntervalsInput,
        example={"intervals": [[1, 3], [8, 10], [2, 6], [9, 12], [15, 18], [17, 20]]},
        run=run_merge_intervals,
    )
)
