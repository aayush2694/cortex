## In short

A prefix sum array stores running totals: `prefix[i]` is the sum of the first `i` numbers. After
O(n) setup, the sum of any range `i..j` is one subtraction, `prefix[j + 1] - prefix[i]`, so range
queries become O(1). Paired with a hash map of prefix sums seen so far, it counts subarrays with a
target sum in one pass, even with negative numbers, where sliding windows fail. The same idea
extends to 2D tables, products, and running counts or XORs.

## The idea

Think of a car's odometer. To know how far you drove between Monday and Thursday, you do not add
up each day's trips: you subtract Monday's reading from Thursday's. A prefix sum is an odometer for
an array. Once you have recorded the running total at every position, the distance between any two
positions is a single subtraction.

The second, more powerful idea is to flip the question. A subarray ending at position `j` sums to
`k` exactly when some earlier running total equals `current_total - k`. So as you walk the array,
keep a hash map counting how many times each running total has appeared. At each position, look up
`current_total - k` in the map: that count is the number of valid subarrays ending here. Nothing in
this argument needs the numbers to be positive, which is why it works where a sliding window does
not.

The empty prefix (total 0, seen once before you start) is the detail that makes subarrays starting at
index 0 count correctly.

## How it works

Range sums for `nums = [3, 1, 4, 1, 5]`:

1. Build `prefix = [0, 3, 4, 8, 9, 14]` (one longer than `nums`; `prefix[0] = 0`).
2. Sum of `nums[1..3]` (1 + 4 + 1) is `prefix[4] - prefix[1] = 9 - 3 = 6`.

Count subarrays summing to `k = 2` in `[1, 1, 1]`:

1. Start with `seen = {0: 1}`, total 0.
2. Add 1: total 1. Look up 1 − 2 = −1: none. Record total 1.
3. Add 1: total 2. Look up 0: seen once, so one subarray (`[1, 1]` at the start). Record 2.
4. Add 1: total 3. Look up 1: seen once, so one more (`[1, 1]` at the end). Total answer 2.

In 2D, `P[r][c]` stores the sum of the rectangle from the top-left corner to `(r - 1, c - 1)`. Any
rectangle sum is then four lookups combined by inclusion and exclusion. Variants include
"product of array except self", which uses prefix and suffix products instead of sums, and
"continuous subarray sum", which stores prefix sums modulo k.

## Code

```python run
from itertools import accumulate


def build_prefix(nums: list[int]) -> list[int]:
    return [0, *accumulate(nums)]                 # prefix[i] = sum(nums[:i])


def range_sum(prefix: list[int], i: int, j: int) -> int:
    """Sum of nums[i..j] inclusive, O(1)."""
    return prefix[j + 1] - prefix[i]


def count_subarrays(nums: list[int], k: int) -> int:
    """Subarrays summing to k. Works with negatives. O(n) time, O(n) space."""
    seen = {0: 1}                                 # the empty prefix
    total = count = 0
    for x in nums:
        total += x
        count += seen.get(total - k, 0)
        seen[total] = seen.get(total, 0) + 1
    return count


def pivot_index(nums: list[int]) -> int:
    """First index where the sum on the left equals the sum on the right."""
    total, left = sum(nums), 0
    for i, x in enumerate(nums):
        if left == total - left - x:
            return i
        left += x
    return -1


p = build_prefix([3, 1, 4, 1, 5])
assert p == [0, 3, 4, 8, 9, 14]
assert range_sum(p, 1, 3) == 6
assert count_subarrays([1, 1, 1], 2) == 2
assert count_subarrays([1, -1, 0], 0) == 3
assert pivot_index([1, 7, 3, 6, 5, 6]) == 3
```

## Common mistakes

- **Off-by-one indexing**: decide whether `prefix` has a leading 0 (recommended) and stick to it.
  With the leading 0, the sum of `i..j` is `prefix[j + 1] - prefix[i]`.
- **Forgetting `seen = {0: 1}`**, which misses every subarray that starts at index 0.
- **Recording the current total before looking it up**, which counts the empty subarray when k = 0.
- **Using a sliding window** for sums with negative numbers.
- **Integer overflow** in fixed-width languages for long arrays of large values.

## In interviews

Signals: many range-sum queries, "number of subarrays with sum k", "equal left and right sums",
"subarray divisible by k", or anything about balancing counts (turn 0/1 into −1/+1 and look for a
total of zero). Common problems: subarray sum equals K, range sum query, find pivot index, product
of array except self, contiguous array, continuous subarray sum. Explain the "earlier total equals
current minus k" idea out loud; it is the step most candidates cannot justify.

Likely follow-up questions:

- Why does this work with negative numbers when a sliding window does not?
- How would you answer rectangle-sum queries on a 2D matrix?
- How do you find the longest subarray with sum k instead of the count? (Store first index per total.)
- What if the array changes between queries? (A Fenwick tree or segment tree.)
