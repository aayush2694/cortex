## In short

A sliding window keeps track of a contiguous range of an array or string (the window) and updates
it as it moves, instead of recomputing every subarray from scratch. A **fixed-size** window moves
both ends together; a **variable-size** window grows on the right and shrinks on the left whenever
it breaks a rule. Each element enters and leaves the window at most once, so the total work is O(n),
plus whatever memory you need to describe the window's contents (often a hash map or counter).

## The idea

Imagine looking at a long street through a train window. As the train moves one house forward, a
new house appears on the right and one disappears on the left. You do not re-look at every house in
view; you just note who arrived and who left.

For "largest sum of any 3 consecutive numbers", the brute force adds up every group of three: about
3n additions, and for windows of size k it becomes O(n·k). With a window you add the new number and
subtract the one that fell out: O(1) per step.

Variable windows answer "longest" or "shortest" questions with a rule. For "longest substring with
no repeated letter", keep extending the right edge. As soon as the window contains a repeat, the
window is broken, so shrink from the left until it is valid again. The window is always the best
valid range ending at the current right edge, so tracking the largest one seen gives the answer.

The pattern works when the rule is **monotonic**: if a window is invalid, every bigger window that
contains it is invalid too (or the mirror for "shortest" questions). That is why it fails for sums
with negative numbers, where adding an element can make the sum go either way; prefix sums handle
those.

## How it works

Longest substring without repeating characters in `"abcabcbb"`:

1. Grow the window to `"abc"` (right = 2). Best length 3. A map remembers each letter's last index.
2. Right = 3 brings in `a`, already in the window at index 0. Move `left` to 1. Window `"bca"`, still 3.
3. Right = 4 brings `b` (last seen at 1, inside the window): left = 2, window `"cab"`.
4. Continue to the end. The best length stays 3.

For the **minimum size subarray with sum ≥ target**, flip the logic: grow until the window is
valid, then shrink from the left as long as it stays valid, recording the smallest length each time.

The window's state must be updatable in O(1): a running sum, a count of distinct letters, a counter
of characters still needed. Choosing that state is most of the work.

## Code

```python run
def max_sum_k(nums: list[int], k: int) -> int:
    """Fixed window: best sum of k consecutive numbers. O(n)."""
    window = sum(nums[:k])
    best = window
    for right in range(k, len(nums)):
        window += nums[right] - nums[right - k]     # one in, one out
        best = max(best, window)
    return best


def longest_unique(s: str) -> int:
    """Variable window: longest substring without repeats. O(n) time, O(alphabet) space."""
    last: dict[str, int] = {}
    left = best = 0
    for right, ch in enumerate(s):
        if ch in last and last[ch] >= left:          # repeat inside the window
            left = last[ch] + 1                      # jump past the earlier copy
        last[ch] = right
        best = max(best, right - left + 1)
    return best


def min_len_at_least(nums: list[int], target: int) -> int:
    """Shortest subarray with sum >= target (positive numbers). 0 if none."""
    left = total = 0
    best = len(nums) + 1
    for right, x in enumerate(nums):
        total += x
        while total >= target:                       # valid: try to shrink
            best = min(best, right - left + 1)
            total -= nums[left]
            left += 1
    return 0 if best > len(nums) else best


assert max_sum_k([2, 1, 5, 1, 3, 2], 3) == 9
assert longest_unique("abcabcbb") == 3
assert longest_unique("pwwkew") == 3
assert longest_unique("") == 0
assert min_len_at_least([2, 3, 1, 2, 4, 3], 7) == 2
assert min_len_at_least([1, 1], 5) == 0
```

## Common mistakes

- **Using it with negative numbers** for sum targets; the shrink rule stops being valid. Use prefix
  sums with a hash map.
- **Jumping `left` backwards**: in the repeat case the last index may be before `left`; check
  `last[ch] >= left` (or use `max`).
- **Off-by-one window length**: it is `right - left + 1`.
- **Recomputing the window's state** (calling `sum()` or `len(set(...))` inside the loop), which
  silently brings back O(n·k).
- **Shrinking with `if` instead of `while`** when one new element can require several removals.

## In interviews

Signals: "contiguous subarray" or "substring", together with "longest", "shortest", "maximum",
"at most k distinct" or "contains all characters of". Common problems: longest substring without
repeating characters, minimum window substring, permutation in string, longest repeating character
replacement, maximum average subarray, fruit into baskets. Explain what the window represents, what
makes it invalid, and why the total is O(n) even with a nested `while`: each index moves forward
only.

Likely follow-up questions:

- Why is it O(n) with a loop inside a loop?
- What changes if the array contains negative numbers?
- How would you find the maximum of every window of size k? (A monotonic deque.)
- How do you count subarrays with exactly k distinct values? (At most k minus at most k − 1.)
