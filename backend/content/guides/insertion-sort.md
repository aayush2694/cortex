## In short

Insertion sort keeps a sorted part at the start of the array and grows it one item at a time: take
the next item and slide it left past every larger item until it fits. It is O(n²) in the worst and
average case, but O(n) when the input is already sorted and close to O(n) when it is nearly sorted.
It sorts in place with O(1) extra memory and is stable. Despite the O(n²) bound it is genuinely
used: real sorting libraries switch to it for small pieces of the array because it is so fast on
tiny inputs.

## The idea

Think of sorting playing cards in your hand as you pick them up. Your hand is always in order. When
you pick up a new card you slide it in from the right, past every bigger card, and drop it into the
gap. You never re-sort the whole hand; you only insert one card into an already sorted hand.

That gives the **invariant**: before step i, the first i items are sorted (among themselves, not yet
in their final positions). Each step extends the sorted prefix by one, so after n steps everything
is sorted.

The amount of work depends on how far each item has to travel. In a reversed array every item goes
all the way to the front, so the work is 1 + 2 + … + (n − 1) ≈ n²/2 shifts. In a sorted array no
item moves, so it is one comparison per item, O(n). More precisely the cost is O(n + inversions),
where an inversion is a pair of items in the wrong order. That is why insertion sort shines on data
that is "almost sorted", such as a list that was sorted and then had a few new items appended.

## How it works

Sort `[4, 2, 5, 1]`.

1. The sorted prefix is `[4]`. Take 2: it is smaller than 4, so shift 4 right and drop 2 in front:
   `[2, 4, 5, 1]`.
2. Take 5: it is larger than 4, so it already fits. Nothing moves: `[2, 4, 5, 1]`.
3. Take 1: shift 5, then 4, then 2 one place right, and drop 1 at the front: `[1, 2, 4, 5]`.

Notice the shifting, not swapping: we hold the item being inserted in a variable, move larger items
one place right, then write it once into the gap. That does about half the writes of repeated swaps.

Because insertion is a search for the right position in a sorted prefix, you could find the spot
with binary search. That cuts comparisons to O(n log n) but not the shifting, so the total stays
O(n²) for arrays.

## Code

```python run
def insertion_sort(nums: list[int]) -> list[int]:
    """Sort in place and return nums. Stable; O(n^2) worst, O(n) on sorted input."""
    for i in range(1, len(nums)):
        item = nums[i]
        j = i - 1
        while j >= 0 and nums[j] > item:       # strictly greater keeps it stable
            nums[j + 1] = nums[j]              # shift right to open a gap
            j -= 1
        nums[j + 1] = item                     # drop the item into the gap
    return nums


def count_shifts(nums: list[int]) -> int:
    """Number of shifts insertion sort makes = number of inversions."""
    shifts = 0
    a = list(nums)
    for i in range(1, len(a)):
        item, j = a[i], i - 1
        while j >= 0 and a[j] > item:
            a[j + 1] = a[j]
            j -= 1
            shifts += 1
        a[j + 1] = item
    return shifts


assert insertion_sort([4, 2, 5, 1]) == [1, 2, 4, 5]
assert insertion_sort([1]) == [1]
assert count_shifts([1, 2, 3, 4]) == 0          # sorted: no work
assert count_shifts([4, 3, 2, 1]) == 6          # reversed: n(n-1)/2
```

## Trade-offs

Among the simple O(n²) sorts, insertion sort is the one worth knowing: it beats bubble and selection
sort in practice, it is adaptive (fast on nearly sorted data), stable and **online**, meaning it can
sort items as they arrive. Python's Timsort and many quick sort implementations use it for small
runs (tens of items) because the constant factors are tiny. For general data of any real size,
use the built-in sort.

## Common mistakes

- **Writing `nums[j] >= item`**, which moves equal items past each other and breaks stability.
- **Forgetting to save the item** before shifting, then overwriting it.
- **Off-by-one on the final write**: after the loop the gap is at `j + 1`, not `j`.
- **Checking `nums[j]` before `j >= 0`**: in Python `nums[-1]` silently reads the last item instead
  of failing.
- **Calling it O(n log n) with binary search**: comparisons drop, shifts do not.

## In interviews

Expect it as a comparison question ("which O(n²) sort would you use and why?"), as part of
explaining hybrid sorts like Timsort or introsort, or in "insertion sort list" (sorting a linked
list, where inserting is cheap but finding the position is O(n)). Show that you know its best case,
its stability, and the connection between its running time and the number of inversions.

Likely follow-up questions:

- Why is it fast on nearly sorted data?
- Why do production sorts use it for small subarrays?
- Does binary search make it O(n log n)?
- How would you sort a linked list with it?
