"""Problem-solving patterns on arrays and strings, traced step by step.

They all use the "sequence" view. Each frame's state looks like:
    {
      "rows": [{"label": "nums", "cells": [...], "tones": [...], "pointers": {"L": 0},
                "window": [l, r] | None}],
      "vars": [{"name": "best", "value": "3"}],
    }
Tones (one per cell): "" | "active" | "done" | "dim" | "outline" | "found".
"""

from typing import Any

from app.modules.visualizer.inputs import (
    OneToNInput,
    RotatedInput,
    SumInput,
    TargetInput,
    TextInput,
)
from app.modules.visualizer.tracer import AlgorithmSpec, Tracer, register


def row(
    label: str,
    cells: list[Any],
    tones: dict[int, str] | None = None,
    pointers: dict[str, int] | None = None,
    window: tuple[int, int] | None = None,
) -> dict[str, Any]:
    t = tones or {}
    return {
        "label": label,
        "cells": list(cells),
        "tones": [t.get(i, "") for i in range(len(cells))],
        "pointers": {k: v for k, v in (pointers or {}).items() if 0 <= v < len(cells)},
        "window": list(window) if window and window[0] <= window[1] else None,
    }


def vars_(**values: Any) -> list[dict[str, str]]:
    return [{"name": k.replace("_", " "), "value": str(v)} for k, v in values.items()]


# ---------------------------------------------------------------- two pointers

TWO_POINTERS_SOURCE = """
def two_sum_sorted(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return [left, right]
        if total < target:
            left += 1
        else:
            right -= 1
    return []
"""


def run_two_pointers(inp: TargetInput, t: Tracer) -> dict[str, Any]:
    nums = sorted(inp.array)
    target = inp.target
    left, right = 0, len(nums) - 1

    def state(tones: dict[int, str] | None = None, total: Any = "-") -> dict[str, Any]:
        return {
            "rows": [row("nums", nums, tones, {"L": left, "R": right}, (left, right))],
            "vars": vars_(target=target, sum=total),
        }

    note = "" if nums == inp.array else " (sorted first)"
    t.frame(
        "left, right = 0, len(nums) - 1",
        "start",
        f"Put one pointer at each end of the sorted array{note}",
        state(),
    )
    while left < right:
        total = nums[left] + nums[right]
        t.count("checks")
        t.frame(
            "total = nums[left] + nums[right]",
            "compare",
            f"{nums[left]} + {nums[right]} = {total}",
            state({left: "active", right: "active"}, total),
            [left, right],
        )
        if total == target:
            t.frame(
                "return [left, right]",
                "found",
                f"{total} equals the target {target}: found it",
                state({left: "found", right: "found"}, total),
                [left, right],
            )
            return {"found": True, "indices": [left, right]}
        if total < target:
            t.frame(
                "left += 1",
                "move",
                f"{total} is too small, so move left to a bigger number",
                state({left: "dim"}, total),
            )
            left += 1
        else:
            t.frame(
                "right -= 1",
                "move",
                f"{total} is too big, so move right to a smaller number",
                state({right: "dim"}, total),
            )
            right -= 1
    t.frame("return []", "done", "The pointers met: no pair adds up to the target", state())
    return {"found": False, "indices": []}


register(
    AlgorithmSpec(
        key="two_pointers",
        title="Two Pointers: pair with target sum",
        topic_id="two-pointers",
        view="sequence",
        kind="pattern",
        description="In a sorted array, start at both ends. If the sum is too small move the left "
        "pointer right; if too big move the right pointer left.",
        complexity="Time O(n) · Space O(1)",
        source=TWO_POINTERS_SOURCE,
        input_model=TargetInput,
        example={"array": [1, 3, 4, 6, 8, 11, 15], "target": 14},
        run=run_two_pointers,
    )
)

# ---------------------------------------------------------------- sliding window

SLIDING_SOURCE = """
def longest_unique_substring(s):
    last_seen = {}
    left = best = 0
    for right, ch in enumerate(s):
        if last_seen.get(ch, -1) >= left:
            left = last_seen[ch] + 1
        last_seen[ch] = right
        best = max(best, right - left + 1)
    return best
"""


def run_sliding_window(inp: TextInput, t: Tracer) -> dict[str, Any]:
    s = list(inp.text)
    last_seen: dict[str, int] = {}
    left = best = 0
    best_range: tuple[int, int] | None = None

    def state(right: int, tones: dict[int, str] | None = None) -> dict[str, Any]:
        window = s[left : right + 1] if right >= left else []
        return {
            "rows": [
                row(
                    "s",
                    s,
                    tones,
                    {"L": left, "R": right} if right >= 0 else {},
                    (left, right) if right >= left else None,
                )
            ],
            "vars": vars_(window="".join(window) or "-", length=len(window), best=best),
        }

    t.frame("left = best = 0", "start", "Start with an empty window", state(-1))
    for right, ch in enumerate(s):
        if last_seen.get(ch, -1) >= left:
            dup = last_seen[ch]
            t.frame(
                "if last_seen.get(ch, -1) >= left:",
                "compare",
                f"'{ch}' is already in the window at index {dup}",
                state(right, {right: "active", dup: "outline"}),
                [dup, right],
            )
            left = dup + 1
            t.frame(
                "left = last_seen[ch] + 1",
                "shrink",
                f"Move left past the old '{ch}' so the window has no repeats",
                state(right, {right: "active"}),
            )
        last_seen[ch] = right
        if right - left + 1 > best:
            best = right - left + 1
            best_range = (left, right)
        t.count("steps")
        t.frame(
            "best = max(best, right - left + 1)",
            "grow",
            f"Add '{ch}': the window has {right - left + 1} unique characters",
            state(right, {right: "active"}),
        )
    tones = {i: "found" for i in range(best_range[0], best_range[1] + 1)} if best_range else {}
    t.frame(
        "return best",
        "done",
        f"The longest window without repeats has {best} characters",
        state(len(s) - 1, tones),
    )
    return {"best": best}


register(
    AlgorithmSpec(
        key="sliding_window",
        title="Sliding Window: longest substring without repeats",
        topic_id="sliding-window",
        view="sequence",
        kind="pattern",
        description="Grow the window on the right; when it breaks the rule (a repeated character), "
        "shrink it from the left. Each character enters and leaves at most once.",
        complexity="Time O(n) · Space O(k)",
        source=SLIDING_SOURCE,
        input_model=TextInput,
        example={"text": "abcabcbb"},
        run=run_sliding_window,
    )
)

# ---------------------------------------------------------------- prefix sum

PREFIX_SOURCE = """
def subarray_sum(nums, k):
    count = prefix = 0
    seen = {0: 1}
    for x in nums:
        prefix += x
        count += seen.get(prefix - k, 0)
        seen[prefix] = seen.get(prefix, 0) + 1
    return count
"""


def run_prefix_sum(inp: SumInput, t: Tracer) -> dict[str, Any]:
    nums, k = inp.array, inp.k
    count = prefix = 0
    seen: dict[int, int] = {0: 1}
    ends_at: dict[int, list[int]] = {0: [-1]}  # prefix value -> indices where it occurred
    prefixes: list[Any] = ["" for _ in nums]

    def state(
        i: int, tones: dict[int, str] | None = None, window: tuple[int, int] | None = None
    ) -> dict[str, Any]:
        return {
            "rows": [
                row("nums", nums, tones, {"i": i} if i >= 0 else {}, window),
                row("prefix", prefixes, {i: "active"} if i >= 0 else {}),
            ],
            "vars": vars_(k=k, count=count, seen=", ".join(f"{p}:{c}" for p, c in seen.items())),
        }

    t.frame("seen = {0: 1}", "start", "An empty prefix (sum 0) has been seen once", state(-1))
    for i, x in enumerate(nums):
        prefix += x
        prefixes[i] = prefix
        t.frame(
            "prefix += x", "add", f"Running sum after {x} is {prefix}", state(i, {i: "active"}), [i]
        )
        matches = seen.get(prefix - k, 0)
        t.count("lookups")
        if matches:
            count += matches
            start = ends_at[prefix - k][-1] + 1
            t.frame(
                "count += seen.get(prefix - k, 0)",
                "found",
                f"{prefix} - {k} = {prefix - k} was seen {matches}x, so {matches} subarray(s) "
                f"ending here sum to {k}",
                state(i, {j: "found" for j in range(start, i + 1)}, (start, i)),
                [i],
            )
        else:
            t.frame(
                "count += seen.get(prefix - k, 0)",
                "compare",
                f"No earlier prefix equals {prefix} - {k} = {prefix - k}",
                state(i, {i: "active"}),
            )
        seen[prefix] = seen.get(prefix, 0) + 1
        ends_at.setdefault(prefix, []).append(i)
    t.frame("return count", "done", f"{count} subarray(s) sum to {k}", state(-1))
    return {"count": count}


register(
    AlgorithmSpec(
        key="prefix_sum",
        title="Prefix Sum: subarrays that sum to k",
        topic_id="prefix-sum",
        view="sequence",
        kind="pattern",
        description="Keep a running sum. A subarray sums to k exactly when an earlier running sum "
        "equals the current one minus k, so count earlier sums in a hash map.",
        complexity="Time O(n) · Space O(n)",
        source=PREFIX_SOURCE,
        input_model=SumInput,
        example={"array": [3, 4, 7, 2, -3, 1, 4, 2], "k": 7},
        run=run_prefix_sum,
    )
)

# ---------------------------------------------------------------- frequency counting (hash map)

TWO_SUM_SOURCE = """
def two_sum(nums, target):
    index_of = {}
    for i, x in enumerate(nums):
        need = target - x
        if need in index_of:
            return [index_of[need], i]
        index_of[x] = i
    return []
"""


def run_frequency_counting(inp: TargetInput, t: Tracer) -> dict[str, Any]:
    nums, target = inp.array, inp.target
    index_of: dict[int, int] = {}

    def state(i: int, tones: dict[int, str] | None = None, need: Any = "-") -> dict[str, Any]:
        return {
            "rows": [row("nums", nums, tones, {"i": i} if i >= 0 else {})],
            "vars": vars_(
                target=target,
                need=need,
                index_of="{" + ", ".join(f"{v}:{j}" for v, j in index_of.items()) + "}",
            ),
        }

    t.frame(
        "index_of = {}", "start", "Walk once, remembering where each number was seen", state(-1)
    )
    for i, x in enumerate(nums):
        need = target - x
        t.count("lookups")
        t.frame(
            "need = target - x",
            "compare",
            f"For {x}, we need {target} - {x} = {need}",
            state(i, {i: "active"}, need),
            [i],
        )
        if need in index_of:
            j = index_of[need]
            t.frame(
                "return [index_of[need], i]",
                "found",
                f"{need} was seen at index {j}: {need} + {x} = {target}",
                state(i, {i: "found", j: "found"}, need),
                [j, i],
            )
            return {"found": True, "indices": [j, i]}
        index_of[x] = i
        t.frame(
            "index_of[x] = i",
            "add",
            f"{need} not seen yet; remember {x} at index {i}",
            state(i, {i: "done"}, need),
        )
    t.frame("return []", "done", "No two numbers add up to the target", state(-1))
    return {"found": False, "indices": []}


register(
    AlgorithmSpec(
        key="frequency_counting",
        title="Hash Map: two sum in one pass",
        topic_id="frequency-counting",
        view="sequence",
        kind="pattern",
        description="Trade memory for speed: store what you've seen in a hash map so each "
        "lookup is O(1), turning an O(n²) pair search into one pass.",
        complexity="Time O(n) · Space O(n)",
        source=TWO_SUM_SOURCE,
        input_model=TargetInput,
        example={"array": [8, 3, 11, 5, 7, 2], "target": 9},
        run=run_frequency_counting,
    )
)

# ---------------------------------------------------------------- modified binary search

ROTATED_SOURCE = """
def search_rotated(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[lo] <= nums[mid]:
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
            else:
                hi = mid - 1
    return -1
"""


def run_modified_binary_search(inp: RotatedInput, t: Tracer) -> dict[str, Any]:
    nums, target = inp.array, inp.target
    lo, hi = 0, len(nums) - 1

    def state(
        mid: int | None = None, sorted_half: tuple[int, int] | None = None, found: bool = False
    ) -> dict[str, Any]:
        tones = {i: "dim" for i in range(len(nums)) if i < lo or i > hi}
        if sorted_half:
            tones.update({i: "outline" for i in range(sorted_half[0], sorted_half[1] + 1)})
        if mid is not None:
            tones[mid] = "found" if found else "active"
        ptrs = {"lo": lo, "hi": hi}
        if mid is not None:
            ptrs["mid"] = mid
        return {
            "rows": [row("nums", nums, tones, ptrs, (lo, hi) if lo <= hi else None)],
            "vars": vars_(target=target),
        }

    t.frame(
        "lo, hi = 0, len(nums) - 1",
        "start",
        f"Look for {target} in the whole rotated array",
        state(),
    )
    while lo <= hi:
        mid = (lo + hi) // 2
        t.count("checks")
        t.frame("mid = (lo + hi) // 2", "compare", f"Middle is {nums[mid]}", state(mid), [mid])
        if nums[mid] == target:
            t.frame(
                "return mid",
                "found",
                f"Found {target} at index {mid}",
                state(mid, found=True),
                [mid],
            )
            return {"index": mid}
        if nums[lo] <= nums[mid]:
            t.frame(
                "if nums[lo] <= nums[mid]:",
                "split",
                f"Left half {nums[lo]}..{nums[mid]} is sorted",
                state(mid, (lo, mid)),
            )
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1
                t.frame(
                    "hi = mid - 1",
                    "discard",
                    f"{target} lies in the sorted left half: keep it",
                    state(),
                    occurrence=1,
                )
            else:
                lo = mid + 1
                t.frame(
                    "lo = mid + 1",
                    "discard",
                    f"{target} is not in the sorted left half: go right",
                    state(),
                    occurrence=1,
                )
        else:
            t.frame(
                "if nums[lo] <= nums[mid]:",
                "split",
                f"Right half {nums[mid]}..{nums[hi]} is sorted",
                state(mid, (mid, hi)),
            )
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
                t.frame(
                    "lo = mid + 1",
                    "discard",
                    f"{target} lies in the sorted right half: keep it",
                    state(),
                    occurrence=2,
                )
            else:
                hi = mid - 1
                t.frame(
                    "hi = mid - 1",
                    "discard",
                    f"{target} is not in the sorted right half: go left",
                    state(),
                    occurrence=2,
                )
    t.frame("return -1", "done", f"{target} is not in the array", state())
    return {"index": -1}


register(
    AlgorithmSpec(
        key="modified_binary_search",
        title="Modified Binary Search: rotated sorted array",
        topic_id="modified-binary-search",
        view="sequence",
        kind="pattern",
        description="Even when the array is rotated, one half around mid is always sorted. "
        "Check if the target falls in that sorted half, and throw away the other half.",
        complexity="Time O(log n) · Space O(1)",
        source=ROTATED_SOURCE,
        input_model=RotatedInput,
        example={"array": [15, 18, 22, 27, 3, 6, 9, 11], "target": 6},
        run=run_modified_binary_search,
    )
)

# ---------------------------------------------------------------- cyclic sort

CYCLIC_SOURCE = """
def find_disappeared(nums):
    i = 0
    while i < len(nums):
        home = nums[i] - 1
        if nums[i] != nums[home]:
            nums[i], nums[home] = nums[home], nums[i]
        else:
            i += 1
    return [i + 1 for i, x in enumerate(nums) if x != i + 1]
"""


def run_cyclic_sort(inp: OneToNInput, t: Tracer) -> dict[str, Any]:
    nums = list(inp.array)
    i = 0

    def state(
        tones: dict[int, str] | None = None, ptrs: dict[str, int] | None = None
    ) -> dict[str, Any]:
        placed = {j: "done" for j, x in enumerate(nums) if x == j + 1}
        placed.update(tones or {})
        return {
            "rows": [row("nums", nums, placed, ptrs), row("slot", list(range(1, len(nums) + 1)))],
            "vars": vars_(i=i),
        }

    t.frame("i = 0", "start", "Each number x belongs in slot x. Place them by swapping.", state())
    while i < len(nums):
        home = nums[i] - 1
        if nums[i] != nums[home]:
            t.count("swaps")
            t.frame(
                "if nums[i] != nums[home]:",
                "compare",
                f"{nums[i]} belongs in slot {home + 1}, which holds {nums[home]}",
                state({i: "active", home: "outline"}, {"i": i, "home": home}),
                [i, home],
            )
            nums[i], nums[home] = nums[home], nums[i]
            t.frame(
                "nums[i], nums[home] = nums[home], nums[i]",
                "swap",
                f"Swap: {nums[home]} is now home",
                state({home: "found"}, {"i": i, "home": home}),
                [i, home],
            )
        else:
            msg = (
                f"{nums[i]} is already in its slot"
                if home == i
                else f"{nums[i]} is a duplicate: its slot already has one"
            )
            t.frame("i += 1", "move", msg + ", move on", state({i: "active"}, {"i": i}))
            i += 1
    missing = [j + 1 for j, x in enumerate(nums) if x != j + 1]
    tones = {j: "outline" for j, x in enumerate(nums) if x != j + 1}
    t.frame(
        "return [i + 1 for i, x in enumerate(nums) if x != i + 1]",
        "done",
        f"Slots that don't hold their own number reveal the missing: {missing or 'none'}",
        state(tones),
    )
    return {"missing": missing}


register(
    AlgorithmSpec(
        key="cyclic_sort",
        title="Cyclic Sort: find the missing numbers",
        topic_id="cyclic-sort",
        view="sequence",
        kind="pattern",
        description="When values are 1..n, each value has a home index. Swap every value into its "
        "home; afterwards any slot holding the wrong value reveals a missing number.",
        complexity="Time O(n) · Space O(1)",
        source=CYCLIC_SOURCE,
        input_model=OneToNInput,
        example={"array": [4, 3, 2, 7, 8, 2, 3, 1]},
        run=run_cyclic_sort,
    )
)
