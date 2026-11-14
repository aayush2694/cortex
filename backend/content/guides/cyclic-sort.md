## In short

When an array holds numbers from a known small range, usually 1..n (or 0..n), every value has a
"home" index: value `x` belongs at index `x - 1`. Cyclic sort walks the array and swaps each value
into its home until every position holds its own value or a value that cannot go anywhere. Then one
more scan reveals missing numbers (positions that hold the wrong value) and duplicates (the values
sitting there). It runs in O(n) time with O(1) extra space, which is exactly what these problems
usually demand.

## The idea

Imagine a hotel with rooms 1 to n and a group of guests holding room keys, standing in the wrong
rooms. Walk into room 1 and look at the guest there. If their key says 4, send them to room 4 and
bring room 4's guest back to room 1. Keep doing that in room 1 until its guest actually belongs
there, then move on to room 2. Every swap puts at least one guest in their final room, so there are
at most n swaps in total, even though there is a loop inside the loop.

Now suppose two guests had copies of the same key and one key was missing. After the shuffle, one
room is held by a guest who could not get into their own room (it was already taken by their twin).
That room number is the **missing** value, and the guest standing in it holds the **duplicate**.

The pattern relies on the values being usable as indexes. It does not apply to arbitrary numbers;
that is the signal to look for: "array of n integers in the range [1, n]" or "[0, n]".

Many of these problems can also be solved with a hash set in O(n) space, or with a math trick (sum
of 1..n minus the actual sum gives a single missing number). Cyclic sort is the general tool when
there may be several missing values or duplicates and memory must stay O(1).

## How it works

Find all missing numbers in `[4, 3, 2, 7, 8, 2, 3, 1]` (values 1..8).

1. Index 0 holds 4; home is index 3, which holds 7. Swap: `[7, 3, 2, 4, 8, 2, 3, 1]`.
2. Index 0 holds 7; home index 6 holds 3. Swap: `[3, 3, 2, 4, 8, 2, 7, 1]`.
3. Index 0 holds 3; home index 2 holds 2. Swap: `[2, 3, 3, 4, 8, 2, 7, 1]`.
4. Index 0 holds 2; home index 1 holds 3. Swap: `[3, 2, 3, 4, 8, 2, 7, 1]`.
5. Index 0 holds 3; home index 2 already holds 3: a duplicate. Stop and move on.
6. Continue through the array the same way. The end state is `[1, 2, 3, 4, 3, 2, 7, 8]`.
7. Scan: index 4 holds 3 (should be 5) and index 5 holds 2 (should be 6). Missing: 5 and 6.
   Duplicates: 3 and 2.

The stop condition "the home already holds the same value" is what prevents an infinite swap loop
when duplicates exist.

## Code

```python run
def cyclic_sort(nums: list[int]) -> None:
    """Values in 1..n (duplicates allowed). Put each value at index value - 1 where possible."""
    i = 0
    while i < len(nums):
        home = nums[i] - 1
        if 0 <= home < len(nums) and nums[home] != nums[i]:
            nums[i], nums[home] = nums[home], nums[i]   # don't advance: check the new value
        else:
            i += 1


def missing_numbers(nums: list[int]) -> list[int]:
    a = list(nums)
    cyclic_sort(a)
    return [i + 1 for i, x in enumerate(a) if x != i + 1]


def duplicates(nums: list[int]) -> list[int]:
    a = list(nums)
    cyclic_sort(a)
    return sorted({x for i, x in enumerate(a) if x != i + 1})


def first_missing_positive(nums: list[int]) -> int:
    """Ignore values outside 1..n, then the first wrong slot is the answer."""
    a = list(nums)
    cyclic_sort(a)
    for i, x in enumerate(a):
        if x != i + 1:
            return i + 1
    return len(a) + 1


data = [4, 3, 2, 7, 8, 2, 3, 1]
assert missing_numbers(data) == [5, 6]
assert duplicates(data) == [2, 3]
assert first_missing_positive([3, 4, -1, 1]) == 2
assert first_missing_positive([1, 2, 0]) == 3
assert first_missing_positive([7, 8, 9]) == 1
```

## Common mistakes

- **Advancing `i` after a swap.** The value just swapped in may also be out of place; only advance
  when the current slot is settled.
- **Swapping when the home already holds the same value**, which loops forever on duplicates.
- **Off-by-one homes**: for 1..n the home is `x - 1`; for 0..n it is `x`, and the value n has no home.
- **Not guarding the range** for problems like first missing positive, where values can be negative or
  larger than n.
- **Forgetting that it mutates the input**; copy it if the caller needs the original.

## In interviews

Signals: "n integers in the range [1, n]" or "[0, n]", plus "find the missing / duplicate / first
missing positive", with a request for O(n) time and O(1) extra space. Problems: missing number,
find all numbers disappeared in an array, find the duplicate number, find all duplicates, first
missing positive, set mismatch. Explain why the nested loop is still O(n) (each swap fixes a value)
and mention the alternatives: a hash set (O(n) space), the sum formula for one missing number, or
marking visited indexes by negating values.

Likely follow-up questions:

- Why is this O(n) when there is a while loop that may swap several times at one index?
- Can you solve "missing number" without modifying the array? (Sum or XOR.)
- How would you find the duplicate without modifying the array? (Fast and slow pointers.)
- How do you handle values outside the range?
