## In short

Binary search finds a value in a **sorted** array by checking the middle element and throwing away
the half that cannot contain the answer. Each step halves the range, so it needs at most about
log₂(n) steps: around 20 checks for a million items, 30 for a billion. Time is O(log n), extra
memory is O(1) for the loop version. It only works when the data is sorted, or more generally when
a yes/no question about each position flips from "no" to "yes" exactly once.

## The idea

Think of guessing a number between 1 and 100 when someone tells you "higher" or "lower" after each
guess. Guessing 1, 2, 3 in order could take 100 tries. Guessing 50 first removes half the numbers
whatever the answer is. Then 25 or 75, and so on. Seven guesses are always enough.

A sorted array gives you the same "higher or lower" signal for free. If the middle value is smaller
than the target, everything to its left is smaller too, so the target can only be on the right.
You never need to look at the discarded half again.

The real skill is not the loop itself but keeping track of **what the current range means**. Most
bugs come from forgetting whether the range includes its right end, or from moving a boundary to
`mid` when it should move past it.

## How it works

Search for 23 in `[2, 5, 8, 12, 16, 23, 38, 56, 72, 91]` (indexes 0 to 9). Keep two pointers,
`lo` and `hi`, around the part of the array that might still hold the target.

1. `lo = 0`, `hi = 9`. Middle index is 4, value 16. 16 < 23, so the target is to the right:
   `lo = 5`.
2. `lo = 5`, `hi = 9`. Middle is 7, value 56. 56 > 23, so it is to the left: `hi = 6`.
3. `lo = 5`, `hi = 6`. Middle is 5, value 23. Found at index 5.

Three checks instead of six for a straight scan. If the value is missing, the pointers cross
(`lo > hi`) and the loop stops: there is nothing left to search.

A second, very common form asks for a **boundary** instead of an exact match: "the first index
whose value is at least x". This is what Python's `bisect_left` returns, and it is also where x
would be inserted to keep the array sorted. The same idea solves many problems that do not look
like searching at all: the smallest speed that finishes on time, the first bad version, the minimum
capacity that ships everything in d days. Whenever the answer space is ordered and you can check a
guess as "too small" or "big enough", you can binary search over the answers.

## Code

```python run
def binary_search(nums: list[int], target: int) -> int:
    """Index of target in sorted nums, or -1."""
    lo, hi = 0, len(nums) - 1          # search the closed range [lo, hi]
    while lo <= hi:                    # stop when the range is empty
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1               # mid is too small: skip it
        else:
            hi = mid - 1               # mid is too big: skip it
    return -1


def first_at_least(nums: list[int], x: int) -> int:
    """First index i with nums[i] >= x (len(nums) if none). Same as bisect_left."""
    lo, hi = 0, len(nums)              # half-open range [lo, hi)
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] < x:
            lo = mid + 1
        else:
            hi = mid                   # mid may be the answer: keep it
    return lo


nums = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
assert binary_search(nums, 23) == 5
assert binary_search(nums, 4) == -1
assert binary_search([], 1) == -1

from bisect import bisect_left
for x in [0, 2, 3, 23, 91, 100]:
    assert first_at_least(nums, x) == bisect_left(nums, x)
```

The two templates differ in one choice: whether `hi` points at the last candidate (closed range,
`while lo <= hi`, `hi = mid - 1`) or one past it (half-open range, `while lo < hi`, `hi = mid`). Pick
one per problem and keep every line consistent with it. In Python, `(lo + hi) // 2` cannot overflow;
in Java or C++ write `lo + (hi - lo) / 2`.

## Common mistakes

- **Unsorted input.** Binary search on unsorted data returns wrong answers without any error. Sort
  first (O(n log n)) or use a hash set if you only need membership.
- **Mixing the two templates.** Using `while lo <= hi` with `hi = mid` can loop forever when
  `lo == hi`. Decide whether `hi` is inclusive and follow it everywhere.
- **Off-by-one at the start.** For a closed range `hi` starts at `len(nums) - 1`; for a half-open
  range it starts at `len(nums)`.
- **Moving a pointer to `mid` instead of past it.** If `mid` has been ruled out, move to `mid + 1`
  or `mid - 1`; otherwise the range may stop shrinking.
- **Returning the wrong thing for duplicates.** Exact-match search returns *some* matching index.
  If you need the first or last one, use the boundary form.
- **Integer overflow** in languages with fixed-size integers when computing `(lo + hi) / 2`.

## In interviews

Interviewers rarely ask for plain binary search on its own. They hide it in problems such as
"search in a rotated sorted array", "find the first and last position of an element", "find a peak
element", "Koko eating bananas" or "capacity to ship packages within D days". The signal is a sorted
input, or a question shaped like "the minimum value that works".

A strong answer says out loud what the range means ("`lo` to `hi` inclusive, the answer is always
inside it"), states why the loop ends, and tests the edge cases: an empty array, one element, the
target at either end, and a missing target. Mention that it is O(log n) because the range halves
each step.

Likely follow-up questions:

- How would you find the first occurrence when there are duplicates?
- Why does `lo + (hi - lo) / 2` matter in Java but not in Python?
- How would you search a sorted array whose length you don't know?
- Can you binary search on the answer instead of on an index? Give an example.
