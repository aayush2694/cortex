## In short

Interval problems deal with ranges like meetings `[start, end]`. The core trick is to **sort by
start time** first; then any interval can only overlap the one you merged most recently, so one
pass is enough. Sorting costs O(n log n) and the pass is O(n). Variants: merge overlapping
intervals, insert a new interval, find intersections of two lists, count rooms needed for meetings
(sort starts and ends, or use a heap), and remove the fewest intervals to stop overlaps (sort by
**end** time and pick greedily).

## The idea

Imagine a calendar with meetings written in random order, and you want to know when you are busy.
If you first lay the meetings out in order of start time, you can sweep from left to right holding
one "current busy block". Each new meeting either starts before that block ends, so it overlaps and
you stretch the block, or it starts after, so the block is finished and a new one begins.

Why does sorting make one pass enough? After sorting, every later interval starts at or after the
current one. If the next interval does not overlap the current merged block, nothing after it can
reach back into that block either, because they all start even later. So each finished block is
final.

Two intervals `[a, b]` and `[c, d]` with `a ≤ c` overlap exactly when `c ≤ b`. Whether touching
endpoints (`[1, 2]` and `[2, 3]`) count as overlapping depends on the problem; read it carefully,
because it changes `<=` to `<`.

**Greedy by end time** answers a different question: "what is the largest set of intervals with no
overlaps?" (equivalently, the fewest to remove). Always keep the interval that ends earliest, since
it leaves the most room for the rest. This is the classic activity selection argument, and it is why
non-overlapping intervals and minimum arrows to burst balloons sort by end, not by start.

## How it works

Merge `[[1, 3], [8, 10], [2, 6], [15, 18]]`:

1. Sort by start: `[1, 3], [2, 6], [8, 10], [15, 18]`.
2. Start with `[1, 3]`. Next `[2, 6]`: 2 ≤ 3, so overlap; extend the end to max(3, 6) = 6.
3. Next `[8, 10]`: 8 > 6, so no overlap. Close `[1, 6]` and start `[8, 10]`.
4. Next `[15, 18]`: no overlap. Result: `[1, 6], [8, 10], [15, 18]`.

The `max` in step 2 matters: merging `[1, 10]` with `[2, 3]` must keep 10, not shrink to 3.

Meeting rooms needed for `[[0, 30], [5, 10], [15, 20]]`: sort start times `0, 5, 15` and end times
`10, 20, 30` separately. Walk the starts; each start needs a room, but if the earliest unfinished end
is at or before this start, that room has been freed. Here meeting `[0, 30]` and `[5, 10]` overlap,
so the answer is 2.

## Code

```python run
def merge(intervals: list[list[int]]) -> list[list[int]]:
    merged: list[list[int]] = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:            # overlaps the last block
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged


def insert(intervals: list[list[int]], new: list[int]) -> list[list[int]]:
    """intervals are sorted and non-overlapping."""
    out, i, n = [], 0, len(intervals)
    while i < n and intervals[i][1] < new[0]:            # entirely before
        out.append(intervals[i]); i += 1
    start, end = new
    while i < n and intervals[i][0] <= end:              # overlapping: absorb
        start, end = min(start, intervals[i][0]), max(end, intervals[i][1]); i += 1
    out.append([start, end])
    return out + intervals[i:]


def min_rooms(meetings: list[list[int]]) -> int:
    starts = sorted(s for s, _ in meetings)
    ends = sorted(e for _, e in meetings)
    rooms = j = 0
    for s in starts:
        if s >= ends[j]:
            j += 1                                       # a room was freed
        else:
            rooms += 1
    return rooms


def erase_overlaps(intervals: list[list[int]]) -> int:
    """Fewest intervals to remove so the rest don't overlap: greedy by end time."""
    removed, last_end = 0, float("-inf")
    for start, end in sorted(intervals, key=lambda iv: iv[1]):
        if start >= last_end:
            last_end = end
        else:
            removed += 1
    return removed


assert merge([[1, 3], [8, 10], [2, 6], [15, 18]]) == [[1, 6], [8, 10], [15, 18]]
assert merge([[1, 10], [2, 3]]) == [[1, 10]]
assert insert([[1, 2], [3, 5], [6, 7], [8, 10]], [4, 8]) == [[1, 2], [3, 10]]
assert min_rooms([[0, 30], [5, 10], [15, 20]]) == 2
assert erase_overlaps([[1, 2], [2, 3], [3, 4], [1, 3]]) == 1
```

## Common mistakes

- **Forgetting to sort** (or sorting by the wrong key for the greedy variants).
- **Replacing the end instead of taking the max**, which shrinks a block when a short interval sits
  inside a long one.
- **Getting touching intervals wrong**: decide whether `[1, 2]` and `[2, 3]` overlap for this problem.
- **Mutating the input** while also using it later; copy if needed.
- **Comparing every pair** (O(n²)) instead of only the last merged block.

## In interviews

Problems: merge intervals, insert interval, non-overlapping intervals, meeting rooms I and II,
interval list intersections, minimum number of arrows to burst balloons, employee free time, car
pooling. Say the sort key out loud and why it is the right one, state the overlap condition, and
handle empty input. For meeting rooms II, mention both the two-sorted-arrays approach and the min-heap
of end times; both are O(n log n).

Likely follow-up questions:

- Why does sorting by start let you merge in one pass?
- Why sort by end time for the "fewest to remove" question?
- How many rooms are needed for these meetings? Can you do it with a heap?
- How would you find the intersection of two sorted interval lists? (Two pointers.)
