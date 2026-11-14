## In short

Bubble sort walks through the array again and again, swapping each pair of neighbours that are in
the wrong order. After each pass the largest remaining item has "bubbled" to the end, so the
sorted part grows from the right. It is O(n²) time in the average and worst case, O(n) on an
already sorted array if you stop when a pass makes no swaps, and O(1) extra memory. It is stable.
Nobody uses it in production; it is taught because it makes sorting, swaps and loop invariants
easy to see.

## The idea

Picture people standing in a line, sorting themselves by height with one rule: you may only swap
with the person right next to you. Starting from the left, each pair compares heights and swaps if
the taller one is in front. The tallest person keeps winning comparisons and keeps moving right,
so after one full walk down the line they are at the end. Repeat the walk, ignoring the last
person, and the second tallest reaches its place. After n − 1 walks everyone is in order.

Two words come up with every sorting algorithm, and bubble sort is the easiest place to learn them.
**In place** means it sorts inside the original array with only a few extra variables. **Stable**
means equal items keep their original order: bubble sort only swaps when the left item is strictly
bigger, so two equal items never jump over each other. Stability matters when you sort records by
one field after already sorting them by another, for example sorting orders by date and then by
customer.

The useful **invariant** (a fact that stays true after every pass) is: after pass k, the last k
items are the k largest, in their final places. Being able to state an invariant like this is a
skill interviewers value far more than bubble sort itself.

## How it works

Sort `[5, 1, 4, 2, 8]`.

1. Pass 1 compares (5,1) → swap → `[1, 5, 4, 2, 8]`; (5,4) → swap → `[1, 4, 5, 2, 8]`;
   (5,2) → swap → `[1, 4, 2, 5, 8]`; (5,8) → no swap. 8 is now fixed at the end.
2. Pass 2 over the first four: (1,4) ok; (4,2) → swap → `[1, 2, 4, 5, 8]`; (4,5) ok.
3. Pass 3 makes no swaps at all, so the array is sorted and we stop early.

Without the early exit the algorithm would still do every pass. Counting comparisons gives
(n − 1) + (n − 2) + … + 1 = n(n − 1)/2, which is O(n²). The early exit only helps when the input
is already sorted or nearly so; one small item at the far right end (a "turtle") still needs many
passes, because it moves left only one place per pass.

## Code

```python run
def bubble_sort(nums: list[int]) -> list[int]:
    """Sort in place and return nums. Stable; O(n^2) time, O(1) extra space."""
    n = len(nums)
    for end in range(n - 1, 0, -1):          # after each pass, nums[end] is final
        swapped = False
        for i in range(end):
            if nums[i] > nums[i + 1]:          # strictly greater keeps it stable
                nums[i], nums[i + 1] = nums[i + 1], nums[i]
                swapped = True
        if not swapped:                        # no swaps: already sorted
            break
    return nums


assert bubble_sort([5, 1, 4, 2, 8]) == [1, 2, 4, 5, 8]
assert bubble_sort([]) == []
assert bubble_sort([3, 3, 1]) == [1, 3, 3]

# Stability: equal keys keep their original order.
pairs = [(2, "a"), (1, "b"), (2, "c")]
for end in range(len(pairs) - 1, 0, -1):
    for i in range(end):
        if pairs[i][0] > pairs[i + 1][0]:
            pairs[i], pairs[i + 1] = pairs[i + 1], pairs[i]
assert pairs == [(1, "b"), (2, "a"), (2, "c")]
```

## Trade-offs

Compared with insertion sort, which has the same O(n²) bound, bubble sort does more swaps and is
slower in practice, so insertion sort is the better choice for tiny or nearly sorted arrays. For
anything real use the language's built-in sort (Timsort in Python and Java for objects), which is
O(n log n) and stable. The only places bubble sort shows up are teaching and the occasional
"sort with only adjacent swaps" puzzle, where the number of swaps it makes equals the number of
inversions (pairs that are out of order).

## Common mistakes

- **Comparing with `>=`**, which swaps equal items and breaks stability.
- **Running the inner loop to `n - 1` every time** instead of shrinking it: still correct but does
  wasted comparisons against the already sorted tail.
- **Index out of range** from comparing `nums[i]` with `nums[i + 1]` when `i` reaches the last index.
- **Forgetting the early exit**, then claiming O(n) on sorted input.
- **Using it for real data**: O(n²) on 100,000 items is about five billion comparisons.

## In interviews

You will rarely be asked to code bubble sort itself. It comes up as a warm-up ("which simple sorts
do you know, and what are their complexities?") or as a building block: counting inversions,
explaining stability, or reasoning about how many adjacent swaps are needed to sort an array. Be
ready to state its best, average and worst cases, to say why it is stable, and to explain why you
would choose insertion sort or the built-in sort instead.

Likely follow-up questions:

- What is its best case, and what makes that possible?
- Is it stable? What breaks stability?
- How many swaps does it make? (Exactly the number of inversions.)
- Why do real libraries never use it?
