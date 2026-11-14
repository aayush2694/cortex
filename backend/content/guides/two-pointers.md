## In short

Two pointers means walking through an array or string with two indexes instead of one, so a
problem that looks like it needs every pair (O(n²)) can be solved in a single pass (O(n)) with O(1)
extra memory. There are two main shapes: **opposite ends** moving toward each other, which needs
sorted data or a symmetric question (pair sums, palindromes, container with most water), and
**same direction**, where a fast pointer reads and a slow one writes (removing duplicates,
partitioning in place).

## The idea

Suppose you have a sorted list of prices and want two items that add up exactly to your budget.
Checking every pair works but takes about n²/2 checks. Instead, put one finger on the cheapest item
and one on the most expensive. If their sum is too high, the expensive item cannot be part of any
answer with anything cheaper on the left, so move the right finger left. If the sum is too low, the
cheap item is useless with anything on the right, so move the left finger right. Each move throws
away one item **for good**, so after at most n moves you either find the pair or know there is none.

That "each step rules out one element permanently" argument is what makes two pointers correct and
O(n). Whenever you can say why moving a pointer cannot skip an answer, the pattern applies.

The same-direction version is a different idea: one pointer explores, the other marks where the
next "kept" item should go. It lets you filter or compact an array in place without creating a new
one, which matters when the problem says O(1) extra space.

## How it works

Find two numbers summing to 9 in `[1, 2, 4, 5, 7, 11]`.

1. `left = 0` (1), `right = 5` (11). Sum 12 > 9, so move right: `right = 4` (7).
2. 1 + 7 = 8 < 9, so move left: `left = 1` (2).
3. 2 + 7 = 9. Found indexes 1 and 4.

For **remove duplicates from a sorted array** `[1, 1, 2, 2, 3]`, the slow pointer `write` marks the end
of the unique prefix. The fast pointer `read` scans; whenever `nums[read]` differs from the last
kept value, copy it to `nums[write]` and advance `write`. The result is `[1, 2, 3, …]` with length 3.

**3Sum** shows how the pattern scales: sort the array, fix each number in turn, and run the pair
search on the rest of the array. That is O(n²) instead of O(n³). Skipping equal neighbours avoids
duplicate triplets.

**Container with most water** uses the same opposite-ends move with a different rule: the area is
limited by the shorter line, so moving the taller line inward can never help; always move the
shorter one.

## Code

```python run
def pair_with_sum(nums: list[int], target: int) -> tuple[int, int] | None:
    """Sorted input. O(n) time, O(1) space."""
    left, right = 0, len(nums) - 1
    while left < right:
        s = nums[left] + nums[right]
        if s == target:
            return left, right
        if s < target:
            left += 1          # nums[left] is too small for every remaining right
        else:
            right -= 1         # nums[right] is too big for every remaining left
    return None


def remove_duplicates(nums: list[int]) -> int:
    """Sorted input, in place. Returns the length of the unique prefix."""
    write = 0
    for read in range(len(nums)):
        if read == 0 or nums[read] != nums[write - 1]:
            nums[write] = nums[read]
            write += 1
    return write


def is_palindrome(s: str) -> bool:
    """Ignore case and non-alphanumeric characters."""
    i, j = 0, len(s) - 1
    while i < j:
        if not s[i].isalnum():
            i += 1
        elif not s[j].isalnum():
            j -= 1
        elif s[i].lower() != s[j].lower():
            return False
        else:
            i, j = i + 1, j - 1
    return True


assert pair_with_sum([1, 2, 4, 5, 7, 11], 9) == (1, 4)
assert pair_with_sum([1, 2], 10) is None
a = [1, 1, 2, 2, 3]
assert a[: remove_duplicates(a)] == [1, 2, 3]
assert is_palindrome("A man, a plan, a canal: Panama")
assert not is_palindrome("race a car")
```

## Common mistakes

- **Using opposite-end pointers on unsorted data** for a sum problem. Sort first (O(n log n)) or use
  a hash map instead.
- **`while left <= right`** in pair problems, which pairs an element with itself.
- **Duplicate answers in 3Sum** from not skipping equal values after a match and for the fixed number.
- **Forgetting to move a pointer** in some branch, which loops forever.
- **Returning indexes from a sorted copy** when the question wants original indexes; sorting loses
  them unless you sort pairs of (value, index).

## In interviews

Typical problems: valid palindrome, two sum II (sorted), 3Sum, container with most water, remove
duplicates, move zeroes, sort colors, trapping rain water. The signals are a sorted array or string,
a question about pairs or triplets, or a requirement to work in place. Always explain the reason
it is safe to move a pointer; that sentence is what interviewers listen for, because it is the proof
that the O(n) answer is correct.

Likely follow-up questions:

- Why can moving the pointer never skip the correct pair?
- What if the array is not sorted? (Sort it, or use a hash map: O(n) time, O(n) space.)
- How do you avoid duplicate triplets in 3Sum?
- Can you extend it to 4Sum? What is the complexity?
