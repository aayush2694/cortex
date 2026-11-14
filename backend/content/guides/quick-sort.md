## In short

Quick sort picks a **pivot**, rearranges the array so smaller items are on its left and larger
items on its right (the **partition** step), then sorts each side recursively. It is O(n log n) on
average and O(n²) in the worst case, when the pivot keeps landing at an end. It sorts in place with
O(log n) stack space on average, and it is not stable. A random pivot makes the worst case very
unlikely. Its partition step also powers **quickselect**, which finds the k-th smallest item in O(n)
on average.

## The idea

Imagine sorting a class by height. Pick one student as the pivot and say "everyone shorter, stand
on the left; everyone taller, stand on the right". That one instruction does not sort anyone, but it
puts the pivot student exactly where they belong, and it splits the problem into two smaller,
independent problems. Repeat on each side and you are done.

Unlike merge sort, the hard work happens **before** the recursion (partitioning), and nothing needs
to be combined afterwards: once both sides are sorted, the whole array is sorted.

Speed depends on the pivot. If it splits the array roughly in half, you get log n levels of O(n)
partitioning, so O(n log n). If it is always the smallest or largest item (for example, choosing
the first item of an already sorted array), one side is empty and the other has n − 1 items. Then
there are n levels and the total is O(n²). Choosing the pivot at random, or the median of the first,
middle and last items, avoids this in practice.

## How it works

The **Lomuto** partition is the easiest to get right. Use the last item as the pivot and keep a
boundary `i`: everything before `i` is smaller than the pivot.

Partition `[7, 2, 1, 6, 8, 5, 3, 4]` with pivot 4:

1. Scan 7 (bigger, leave it), 2 (smaller: swap to the boundary, `i = 1`), 1 (smaller, `i = 2`),
   6 and 8 (bigger), 5 (bigger), 3 (smaller, `i = 3`).
2. Now the array is `[2, 1, 3, 6, 8, 5, 7, 4]`. Swap the pivot into position `i = 3`:
   `[2, 1, 3, 4, 8, 5, 7, 6]`.
3. 4 is in its final place. Recurse on `[2, 1, 3]` and `[8, 5, 7, 6]`.

The **Hoare** partition moves two pointers towards each other and does fewer swaps, but its
boundaries are trickier. Arrays with many equal items are a known weak spot: a basic partition
puts all equal items on one side, which can go quadratic. **Three-way partitioning** (less than,
equal to, greater than the pivot) fixes that, and is the idea behind the "Dutch national flag" or
"sort colors" problem.

## Code

```python run
import random


def partition(a: list[int], lo: int, hi: int) -> int:
    """Lomuto: random pivot moved to a[hi]; returns the pivot's final index."""
    p = random.randint(lo, hi)
    a[p], a[hi] = a[hi], a[p]
    pivot, i = a[hi], lo
    for j in range(lo, hi):
        if a[j] < pivot:
            a[i], a[j] = a[j], a[i]
            i += 1
    a[i], a[hi] = a[hi], a[i]
    return i


def quick_sort(a: list[int], lo: int = 0, hi: int | None = None) -> list[int]:
    """Sort in place; O(n log n) average, O(n^2) worst; not stable."""
    if hi is None:
        hi = len(a) - 1
    if lo < hi:
        p = partition(a, lo, hi)
        quick_sort(a, lo, p - 1)
        quick_sort(a, p + 1, hi)
    return a


def kth_smallest(a: list[int], k: int) -> int:
    """Quickselect: recurse into one side only, O(n) on average."""
    a, lo, hi = list(a), 0, len(a) - 1
    while True:
        p = partition(a, lo, hi)
        if p == k - 1:
            return a[p]
        if p < k - 1:
            lo = p + 1
        else:
            hi = p - 1


data = [7, 2, 1, 6, 8, 5, 3, 4]
assert quick_sort(list(data)) == sorted(data)
assert quick_sort([]) == []
assert quick_sort([5, 5, 5, 1]) == [1, 5, 5, 5]
assert kth_smallest(data, 3) == 3
```

## Trade-offs

Quick sort is usually the fastest general-purpose in-memory sort: it works in place and walks the
array sequentially, which caches love. Merge sort wins when you need stability, a guaranteed
O(n log n), or are sorting linked lists. Production libraries combine them: C++ `std::sort` uses
introsort (quick sort that switches to heap sort if recursion gets too deep, and insertion sort for
small pieces). Java sorts primitive arrays with a dual-pivot quick sort and objects with Timsort.

## Common mistakes

- **Always picking the first or last item** as pivot, which is O(n²) on sorted input.
- **Off-by-one in recursion**: recursing on `p` instead of `p - 1` / `p + 1` can loop forever.
- **Many duplicates** making a two-way partition quadratic; use three-way partitioning.
- **Deep recursion**: worst case depth is n. Recurse into the smaller side first and loop on the
  larger to keep the stack O(log n).
- **Calling it stable**: partitioning moves equal items past each other.

## In interviews

Expect "kth largest element in an array" (quickselect or a heap), "sort colors" (three-way
partition), and comparisons with merge sort. Explain why the average is O(n log n), what input
causes the worst case, and how randomization avoids it. Mentioning introsort shows you know how real
libraries handle the worst case.

Likely follow-up questions:

- What input makes it O(n²), and how do you prevent that?
- Why is quickselect O(n) on average and not O(n log n)?
- How would you handle an array with many repeated values?
- Quick sort or merge sort: which would you choose for a linked list, and why?
