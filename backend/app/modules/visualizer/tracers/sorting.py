"""Sorting algorithms with step recording.

Each algorithm has two parts:
- SOURCE: the clean textbook code the learner reads (shown in the UI, line by line).
- run_*: the same algorithm, plus `t.frame(...)` calls pointing at lines of SOURCE.
"""

from typing import Any

from app.modules.visualizer.inputs import ArrayInput
from app.modules.visualizer.tracer import AlgorithmSpec, Tracer, register

EXAMPLE = {"array": [38, 27, 43, 3, 9, 82, 10, 19]}

# ---------------------------------------------------------------- bubble sort

BUBBLE_SOURCE = """
def bubble_sort(arr):
    n = len(arr)
    for i in range(n - 1):
        swapped = False
        for j in range(n - 1 - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break
    return arr
"""


def run_bubble_sort(inp: ArrayInput, t: Tracer) -> dict[str, Any]:
    arr = list(inp.array)
    n = len(arr)
    done: set[int] = set()

    def state() -> dict[str, Any]:
        return {"array": arr[:], "sorted": sorted(done)}

    t.frame("n = len(arr)", "start", f"Start with {n} items", state())
    for i in range(n - 1):
        swapped = False
        for j in range(n - 1 - i):
            t.count("comparisons")
            t.frame(
                "if arr[j] > arr[j + 1]:",
                "compare",
                f"Compare {arr[j]} and {arr[j + 1]}",
                state(),
                [j, j + 1],
            )
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
                t.count("swaps")
                t.frame(
                    "arr[j], arr[j + 1] = ",
                    "swap",
                    f"{arr[j + 1]} is bigger, so swap",
                    state(),
                    [j, j + 1],
                )
        done.add(n - 1 - i)
        if not swapped:
            done.update(range(n))
            t.frame("break", "done", "No swaps in this pass, so the array is sorted", state())
            break
        t.frame(
            "if not swapped:",
            "mark",
            f"{arr[n - 1 - i]} has bubbled up to its final place",
            state(),
            [n - 1 - i],
        )
    done.update(range(n))
    t.frame("return arr", "done", "Sorted!", state())
    return {"array": arr}


register(
    AlgorithmSpec(
        key="bubble_sort",
        title="Bubble Sort",
        topic_id="bubble-sort",
        view="array",
        description="Walk through the array swapping neighbours that are out of order. "
        "After each pass the largest remaining item has 'bubbled' to the end.",
        complexity="Time O(n²) · Space O(1)",
        source=BUBBLE_SOURCE,
        input_model=ArrayInput,
        example=EXAMPLE,
        run=run_bubble_sort,
    )
)

# ---------------------------------------------------------------- insertion sort

INSERTION_SOURCE = """
def insertion_sort(arr):
    for i in range(1, len(arr)):
        key = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key
    return arr
"""


def run_insertion_sort(inp: ArrayInput, t: Tracer) -> dict[str, Any]:
    arr = list(inp.array)

    def state(sorted_until: int, key: int | None = None, hole: int | None = None) -> dict[str, Any]:
        return {"array": arr[:], "sorted_until": sorted_until, "key": key, "hole": hole}

    for i in range(1, len(arr)):
        key = arr[i]
        t.frame("key = arr[i]", "pick", f"Take {key} and find its place", state(i, key, i), [i])
        j = i - 1
        while j >= 0:
            t.count("comparisons")
            t.frame(
                "while j >= 0 and arr[j] > key:",
                "compare",
                f"Is {arr[j]} bigger than {key}?",
                state(i, key, j + 1),
                [j],
            )
            if arr[j] <= key:
                break
            arr[j + 1] = arr[j]
            t.count("shifts")
            t.frame(
                "arr[j + 1] = arr[j]",
                "shift",
                f"Yes, shift {arr[j]} one place right",
                state(i, key, j),
                [j + 1],
            )
            j -= 1
        arr[j + 1] = key
        t.frame("arr[j + 1] = key", "set", f"Insert {key} at index {j + 1}", state(i + 1), [j + 1])
    t.frame("return arr", "done", "Sorted!", state(len(arr)))
    return {"array": arr}


register(
    AlgorithmSpec(
        key="insertion_sort",
        title="Insertion Sort",
        topic_id="insertion-sort",
        view="array",
        description="Keep a sorted part on the left. Take the next item and shift bigger "
        "items right until there's a gap for it — like sorting playing cards in your hand.",
        complexity="Time O(n²), O(n) if nearly sorted · Space O(1)",
        source=INSERTION_SOURCE,
        input_model=ArrayInput,
        example=EXAMPLE,
        run=run_insertion_sort,
    )
)

# ---------------------------------------------------------------- merge sort

MERGE_SOURCE = """
def merge_sort(arr, lo=0, hi=None):
    if hi is None:
        hi = len(arr) - 1
    if lo >= hi:
        return arr
    mid = (lo + hi) // 2
    merge_sort(arr, lo, mid)
    merge_sort(arr, mid + 1, hi)
    merge(arr, lo, mid, hi)
    return arr

def merge(arr, lo, mid, hi):
    left = arr[lo:mid + 1]
    right = arr[mid + 1:hi + 1]
    i = j = 0
    k = lo
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            arr[k] = left[i]
            i += 1
        else:
            arr[k] = right[j]
            j += 1
        k += 1
    while i < len(left):
        arr[k] = left[i]
        i += 1
        k += 1
    while j < len(right):
        arr[k] = right[j]
        j += 1
        k += 1
"""


def run_merge_sort(inp: ArrayInput, t: Tracer) -> dict[str, Any]:
    arr = list(inp.array)

    def state(lo: int, hi: int, depth: int, mid: int | None = None) -> dict[str, Any]:
        return {"array": arr[:], "range": [lo, hi], "mid": mid, "depth": depth}

    def sort(lo: int, hi: int, depth: int) -> None:
        if lo >= hi:
            t.frame(
                "if lo >= hi:",
                "base",
                f"One item ({arr[lo]}) is already sorted",
                state(lo, hi, depth),
                [lo],
            )
            return
        mid = (lo + hi) // 2
        t.frame(
            "mid = (lo + hi) // 2",
            "split",
            f"Split [{lo}..{hi}] into [{lo}..{mid}] and [{mid + 1}..{hi}]",
            state(lo, hi, depth, mid),
        )
        sort(lo, mid, depth + 1)
        sort(mid + 1, hi, depth + 1)
        merge(lo, mid, hi, depth)

    def merge(lo: int, mid: int, hi: int, depth: int) -> None:
        left = arr[lo : mid + 1]
        right = arr[mid + 1 : hi + 1]
        t.frame(
            "merge(arr, lo, mid, hi)",
            "merge-start",
            f"Merge sorted halves {left} and {right}",
            state(lo, hi, depth, mid),
        )
        i = j = 0
        k = lo
        while i < len(left) and j < len(right):
            t.count("comparisons")
            t.frame(
                "if left[i] <= right[j]:",
                "compare",
                f"Compare {left[i]} and {right[j]}",
                state(lo, hi, depth, mid),
                [k],
            )
            if left[i] <= right[j]:
                arr[k] = left[i]
                t.frame(
                    "arr[k] = left[i]",
                    "set",
                    f"{left[i]} is smaller, write it",
                    state(lo, hi, depth, mid),
                    [k],
                )
                i += 1
            else:
                arr[k] = right[j]
                t.frame(
                    "arr[k] = right[j]",
                    "set",
                    f"{right[j]} is smaller, write it",
                    state(lo, hi, depth, mid),
                    [k],
                )
                j += 1
            t.count("writes")
            k += 1
        while i < len(left):
            arr[k] = left[i]
            t.count("writes")
            t.frame(
                "arr[k] = left[i]",
                "set",
                f"Copy leftover {left[i]}",
                state(lo, hi, depth, mid),
                [k],
                occurrence=2,
            )
            i += 1
            k += 1
        while j < len(right):
            arr[k] = right[j]
            t.count("writes")
            t.frame(
                "arr[k] = right[j]",
                "set",
                f"Copy leftover {right[j]}",
                state(lo, hi, depth, mid),
                [k],
                occurrence=2,
            )
            j += 1
            k += 1

    sort(0, len(arr) - 1, 0)
    t.frame("return arr", "done", "Sorted!", state(0, len(arr) - 1, 0))
    return {"array": arr}


register(
    AlgorithmSpec(
        key="merge_sort",
        title="Merge Sort",
        topic_id="merge-sort",
        view="array",
        description="Divide the array in half until each piece has one item, then merge "
        "the pieces back together in order.",
        complexity="Time O(n log n) · Space O(n)",
        source=MERGE_SOURCE,
        input_model=ArrayInput,
        example=EXAMPLE,
        run=run_merge_sort,
    )
)

# ---------------------------------------------------------------- quick sort

QUICK_SOURCE = """
def quick_sort(arr, lo=0, hi=None):
    if hi is None:
        hi = len(arr) - 1
    if lo < hi:
        p = partition(arr, lo, hi)
        quick_sort(arr, lo, p - 1)
        quick_sort(arr, p + 1, hi)
    return arr

def partition(arr, lo, hi):
    pivot = arr[hi]
    i = lo
    for j in range(lo, hi):
        if arr[j] < pivot:
            arr[i], arr[j] = arr[j], arr[i]
            i += 1
    arr[i], arr[hi] = arr[hi], arr[i]
    return i
"""


def run_quick_sort(inp: ArrayInput, t: Tracer) -> dict[str, Any]:
    arr = list(inp.array)
    placed: set[int] = set()

    def state(
        lo: int, hi: int, pivot: int | None = None, i: int | None = None, j: int | None = None
    ) -> dict[str, Any]:
        return {
            "array": arr[:],
            "range": [lo, hi],
            "pivot": pivot,
            "i": i,
            "j": j,
            "sorted": sorted(placed),
        }

    def sort(lo: int, hi: int) -> None:
        if lo < hi:
            p = partition(lo, hi)
            sort(lo, p - 1)
            sort(p + 1, hi)
        elif lo == hi:
            placed.add(lo)
            t.frame(
                "if lo < hi:", "mark", f"{arr[lo]} alone is in its final place", state(lo, hi), [lo]
            )

    def partition(lo: int, hi: int) -> int:
        pivot = arr[hi]
        t.frame(
            "pivot = arr[hi]",
            "pivot",
            f"Pick the last item, {pivot}, as the pivot",
            state(lo, hi, hi, lo),
            [hi],
        )
        i = lo
        for j in range(lo, hi):
            t.count("comparisons")
            t.frame(
                "if arr[j] < pivot:",
                "compare",
                f"Is {arr[j]} smaller than {pivot}?",
                state(lo, hi, hi, i, j),
                [j],
            )
            if arr[j] < pivot:
                arr[i], arr[j] = arr[j], arr[i]
                t.count("swaps")
                t.frame(
                    "arr[i], arr[j] = arr[j], arr[i]",
                    "swap",
                    f"Yes, move {arr[i]} into the 'smaller' side",
                    state(lo, hi, hi, i, j),
                    [i, j],
                )
                i += 1
        arr[i], arr[hi] = arr[hi], arr[i]
        t.count("swaps")
        placed.add(i)
        t.frame(
            "arr[i], arr[hi] = arr[hi], arr[i]",
            "placed",
            f"Put pivot {pivot} between the two sides; it's now in its final place",
            state(lo, hi, i, i),
            [i],
        )
        return i

    sort(0, len(arr) - 1)
    placed.update(range(len(arr)))
    t.frame("return arr", "done", "Sorted!", state(0, len(arr) - 1))
    return {"array": arr}


register(
    AlgorithmSpec(
        key="quick_sort",
        title="Quick Sort",
        topic_id="quick-sort",
        view="array",
        description="Pick a pivot, move smaller items to its left and bigger items to its "
        "right, then sort each side the same way. Uses the Lomuto partition scheme.",
        complexity="Time O(n log n) average, O(n²) worst · Space O(log n)",
        source=QUICK_SOURCE,
        input_model=ArrayInput,
        example=EXAMPLE,
        run=run_quick_sort,
    )
)
