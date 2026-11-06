from typing import Any

from app.modules.visualizer.inputs import SearchInput
from app.modules.visualizer.tracer import AlgorithmSpec, Tracer, register

BINARY_SOURCE = """
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
"""


def run_binary_search(inp: SearchInput, t: Tracer) -> dict[str, Any]:
    arr = sorted(inp.array)  # binary search needs sorted input
    target = inp.target

    def state(lo: int, hi: int, mid: int | None = None) -> dict[str, Any]:
        return {"array": arr, "target": target, "lo": lo, "hi": hi, "mid": mid}

    lo, hi = 0, len(arr) - 1
    note = "" if arr == inp.array else " (sorted first, since binary search needs sorted data)"
    t.frame(
        "lo, hi = 0, len(arr) - 1",
        "start",
        f"Look for {target} in the whole array{note}",
        state(lo, hi),
    )
    while lo <= hi:
        mid = (lo + hi) // 2
        t.count("comparisons")
        t.frame(
            "mid = (lo + hi) // 2",
            "compare",
            f"Check the middle item: {arr[mid]}",
            state(lo, hi, mid),
            [mid],
        )
        if arr[mid] == target:
            t.frame(
                "return mid", "found", f"Found {target} at index {mid}", state(lo, hi, mid), [mid]
            )
            return {"found": True, "index": mid}
        if arr[mid] < target:
            lo = mid + 1
            t.frame(
                "lo = mid + 1",
                "discard",
                f"{arr[mid]} < {target}, so throw away the left half",
                state(lo, hi),
            )
        else:
            hi = mid - 1
            t.frame(
                "hi = mid - 1",
                "discard",
                f"{arr[mid]} > {target}, so throw away the right half",
                state(lo, hi),
            )
    t.frame(
        "return -1", "done", f"The range is empty, so {target} isn't in the array", state(lo, hi)
    )
    return {"found": False, "index": -1}


register(
    AlgorithmSpec(
        key="binary_search",
        title="Binary Search",
        topic_id="binary-search",
        view="array",
        description="Compare the target with the middle of a sorted array and throw away "
        "the half where it can't be. Each step halves the remaining range.",
        complexity="Time O(log n) · Space O(1)",
        source=BINARY_SOURCE,
        input_model=SearchInput,
        example={"array": [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], "target": 23},
        run=run_binary_search,
    )
)
