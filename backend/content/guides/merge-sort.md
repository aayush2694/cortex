## In short

Merge sort splits the array in half, sorts each half recursively, then **merges** the two sorted
halves by repeatedly taking the smaller front item. It is O(n log n) in the best, average and worst
case, uses O(n) extra memory for merging, and is stable. It is the textbook example of divide and
conquer and the algorithm of choice for sorting linked lists and data too big for memory
(external sorting). Python's built-in Timsort is a refined merge sort.

## The idea

Merging two sorted piles is easy. If you have two stacks of exam papers, each already sorted by
name, you can produce one sorted stack by looking only at the top paper of each pile and taking the
one that comes first, again and again. You never look deeper than the two tops. That takes one step
per paper: linear time.

Merge sort turns sorting into lots of merging. Keep splitting the array in half until every piece
has one item (a single item is already sorted). Then merge pieces back together in pairs: ones into
twos, twos into fours, and so on, until one sorted array remains.

Why O(n log n)? Splitting in half repeatedly gives log₂ n levels. At every level, all the merges
together touch each item once, so each level costs O(n). That is O(n) work times log n levels. The
best feature is that this never changes: unlike quick sort, there is no bad input. The price is the
temporary space for merging.

## How it works

Sort `[38, 27, 43, 3, 9, 82, 10]`.

1. **Split**: `[38, 27, 43]` and `[3, 9, 82, 10]`, then `[38]`, `[27, 43]`, `[3, 9]`, `[82, 10]`, down
   to single items.
2. **Merge pairs**: `[27, 43]`, `[3, 9]`, `[10, 82]`; then `[38]` with `[27, 43]` gives
   `[27, 38, 43]`.
3. **Merge** `[3, 9]` with `[10, 82]`: compare 3 and 10, take 3; 9 and 10, take 9; left is empty, so
   copy the rest: `[3, 9, 10, 82]`.
4. **Final merge** of `[27, 38, 43]` and `[3, 9, 10, 82]`: take 3, 9, 10, 27, 38, 43, then copy 82.

Stability comes from one detail in the merge: when the two fronts are equal, take from the **left**
half first. Then equal items keep their original order.

The same merge step solves other problems. Counting inversions (pairs out of order) is merge sort
plus a counter: whenever you take from the right half, every item still waiting in the left half
forms an inversion with it. "Merge k sorted lists" and "sort a linked list" are also merge sort in
disguise.

## Code

```python run
def merge(left: list[int], right: list[int]) -> list[int]:
    """Merge two sorted lists in O(len(left) + len(right))."""
    out: list[int] = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:                # <= takes left first: stable
            out.append(left[i])
            i += 1
        else:
            out.append(right[j])
            j += 1
    out.extend(left[i:])                        # one side is empty; copy the rest
    out.extend(right[j:])
    return out


def merge_sort(nums: list[int]) -> list[int]:
    """Return a new sorted list. O(n log n) time, O(n) extra space."""
    if len(nums) <= 1:
        return nums
    mid = len(nums) // 2
    return merge(merge_sort(nums[:mid]), merge_sort(nums[mid:]))


def count_inversions(nums: list[int]) -> int:
    """Pairs i < j with nums[i] > nums[j], counted while merging."""
    def sort(a: list[int]) -> tuple[list[int], int]:
        if len(a) <= 1:
            return a, 0
        mid = len(a) // 2
        left, x = sort(a[:mid])
        right, y = sort(a[mid:])
        out, i, j, inv = [], 0, 0, x + y
        while i < len(left) and j < len(right):
            if left[i] <= right[j]:
                out.append(left[i]); i += 1
            else:
                out.append(right[j]); j += 1
                inv += len(left) - i            # all remaining left items are bigger
        return out + left[i:] + right[j:], inv
    return sort(nums)[1]


assert merge_sort([38, 27, 43, 3, 9, 82, 10]) == [3, 9, 10, 27, 38, 43, 82]
assert merge_sort([]) == []
assert count_inversions([2, 4, 1, 3, 5]) == 3
```

## Trade-offs

Pick merge sort when you need guaranteed O(n log n), stability, or when the data is a linked list
(merging lists needs no extra array) or lives on disk. Quick sort is usually faster in memory
because it works in place and is cache-friendly, but it has an O(n²) worst case and is not stable.
Heap sort is in place and O(n log n) but not stable and slower in practice. In everyday code, call
the built-in sort.

## Common mistakes

- **Using `<` instead of `<=`** in the merge, which breaks stability.
- **Forgetting the leftovers**: after the loop one half still has items to copy.
- **Wrong base case**: `len(nums) == 0` alone loops forever on one item.
- **Claiming O(1) space**: array merge sort needs O(n) for merging, plus O(log n) recursion stack.
- **Slicing costs**: `nums[:mid]` copies; fine for clarity, but an index-based version avoids it.

## In interviews

Classic uses: sort a linked list in O(n log n), merge two or k sorted lists, count inversions, and
"why is merge sort stable?" Be ready to derive O(n log n) from the recursion tree (log n levels × n
per level) and to compare it with quick sort on worst case, memory, stability and speed in practice.

Likely follow-up questions:

- Why is the worst case still O(n log n)?
- How much extra memory does it use, and can you avoid it for linked lists?
- How would you merge k sorted lists efficiently? (Heap, or merging in pairs.)
- Merge sort or quick sort for a huge file that does not fit in memory?
