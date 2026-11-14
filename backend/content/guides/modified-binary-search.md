## In short

Binary search does not need a perfectly sorted array. It needs a **rule that tells you which half
cannot contain the answer**. With that rule you can search rotated sorted arrays, find a peak,
find the first or last position of a value, or search over possible answers ("the smallest speed
that finishes on time"). Each step still halves the search space, so the cost stays O(log n) for an
array, or O(log(range) × cost of one check) when searching over answers.

## The idea

Plain binary search compares the middle value with the target. Modified binary search replaces
that comparison with any test that splits the remaining candidates into "might hold the answer" and
"definitely does not". As long as such a test exists, you can halve the problem every step.

Three families cover almost every interview question:

1. **Rotated arrays.** `[4, 5, 6, 7, 0, 1, 2]` is a sorted array rotated at some point. Pick the
   middle. One of the two halves is always sorted normally, and you can tell which by comparing its
   ends. If the target lies inside the sorted half's range, search there; otherwise search the other
   half.
2. **Boundaries.** "First position of x", "first bad version", "minimum in a rotated array" all ask
   for the first index where some condition becomes true. The condition must flip from false to true
   exactly once; binary search finds that flip.
3. **Search on the answer.** If you can check a guessed answer quickly ("can Koko finish all bananas
   at speed s within h hours?") and bigger guesses are always at least as feasible as smaller ones,
   binary search over the guesses instead of over an array.

The common thread is **monotonicity**: somewhere there is a line with "no" on one side and "yes" on
the other, and you are looking for the line.

## How it works

Search for 0 in `[4, 5, 6, 7, 0, 1, 2]`:

1. `lo = 0`, `hi = 6`, `mid = 3` (7). Left half `[4..7]` is sorted (4 ≤ 7). 0 is not between 4 and 7,
   so go right: `lo = 4`.
2. `mid = 5` (1). Left half `[0, 1]` (indexes 4..5) is sorted. 0 is in it, so `hi = 5`.
3. `mid = 4` (0). Found at index 4.

Search on the answer for Koko: piles `[3, 6, 7, 11]`, h = 8. Speeds range from 1 to 11 (the biggest
pile). Hours at speed s is the sum of `ceil(pile / s)`. Speed 4 takes 1 + 2 + 2 + 3 = 8 hours: OK.
Speed 3 takes 1 + 2 + 3 + 4 = 10: too slow. So the answer is 4, found with about log₂ 11 ≈ 4 checks,
each costing O(n).

## Code

```python run
from math import ceil


def search_rotated(nums: list[int], target: int) -> int:
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[lo] <= nums[mid]:                  # left half is sorted
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:                                       # right half is sorted
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
            else:
                hi = mid - 1
    return -1


def find_min_rotated(nums: list[int]) -> int:
    lo, hi = 0, len(nums) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] > nums[hi]:                    # minimum is to the right of mid
            lo = mid + 1
        else:
            hi = mid                                # mid may be the minimum
    return nums[lo]


def min_eating_speed(piles: list[int], h: int) -> int:
    """Smallest speed that finishes within h hours: binary search on the answer."""
    def ok(speed: int) -> bool:
        return sum(ceil(p / speed) for p in piles) <= h

    lo, hi = 1, max(piles)
    while lo < hi:
        mid = (lo + hi) // 2
        if ok(mid):
            hi = mid                                # mid works; maybe smaller works too
        else:
            lo = mid + 1
    return lo


assert search_rotated([4, 5, 6, 7, 0, 1, 2], 0) == 4
assert search_rotated([4, 5, 6, 7, 0, 1, 2], 3) == -1
assert search_rotated([1], 1) == 0
assert find_min_rotated([3, 4, 5, 1, 2]) == 1
assert find_min_rotated([1, 2, 3]) == 1
assert min_eating_speed([3, 6, 7, 11], 8) == 4
```

## Common mistakes

- **Using `<` where `<=` is needed** in the "left half is sorted" check; with two items left,
  `nums[lo] == nums[mid]` and the wrong branch is taken.
- **Mixing loop templates**: `while lo < hi` with `hi = mid`, or `while lo <= hi` with
  `hi = mid - 1`. Mixing them loops forever or skips the answer.
- **Wrong search range** on the answer: the lower bound must be feasible-or-not and the upper bound
  must be feasible (here, max pile).
- **A non-monotonic check**: binary search on the answer only works if "works at x" implies "works
  at every larger x".
- **Duplicates in rotated arrays** break the "which half is sorted" test; the worst case becomes O(n).

## In interviews

Common problems: search in rotated sorted array, find minimum in rotated sorted array, find first and
last position, search a 2D matrix, find peak element, Koko eating bananas, capacity to ship packages
within D days, split array largest sum, median of two sorted arrays (hard). Strong candidates
first say what is monotonic and what the search space is, then pick a template and state the
invariant ("the answer is always within lo..hi"). For search on the answer, give the complexity as
O(n log(max value)), not just O(log n).

Likely follow-up questions:

- How does the solution change if the rotated array has duplicates?
- How do you know the check is monotonic?
- What is the complexity of binary search on the answer?
- How would you find a peak in an array with no sorted order at all?
