## In short

A heap is a binary tree with one rule: every parent is smaller than or equal to its children (a
**min-heap**) or larger than or equal to them (a **max-heap**). So the smallest (or largest) item
is always at the root, readable in O(1). Inserting and removing the root take O(log n), and turning
an unsorted list into a heap ("heapify") takes O(n). A heap is the usual way to build a **priority
queue**. In Python, `heapq` provides a min-heap over a plain list; for a max-heap, store negated
values.

## The idea

Think of a hospital emergency room. Patients are not seen in arrival order but by urgency, and new
patients keep arriving. You do not need the full waiting list sorted at every moment; you only need
to know who is most urgent right now, and to update that quickly when someone arrives or is treated.
A heap is exactly that: a structure that is only "sorted enough" to always know the top item.

That partial order is why heaps are cheaper than keeping everything sorted. A sorted array gives the
minimum in O(1) but insertion costs O(n) to shift items. A heap pays O(log n) for both insert and
remove, which is far better when you do many of each.

Although a heap is a tree, it is stored in a plain array with no pointers. The tree is always
**complete** (filled level by level, left to right), so the children of index `i` are at `2i + 1` and
`2i + 2`, and its parent is at `(i - 1) // 2`. That makes heaps compact and fast.

## How it works

Push 1 into the min-heap `[2, 4, 3, 7, 5]`:

1. Append at the end: `[2, 4, 3, 7, 5, 1]`. The new item is at index 5; its parent is index 2 (3).
2. **Sift up**: 1 < 3, so swap: `[2, 4, 1, 7, 5, 3]`. Its new parent is index 0 (2). 1 < 2, swap:
   `[1, 4, 2, 7, 5, 3]`. It is the root now, so stop. At most one swap per level: O(log n).

Pop the minimum:

1. Take the root (1). Move the last item (3) to the root: `[3, 4, 2, 7, 5]`.
2. **Sift down**: compare 3 with its children 4 and 2, swap with the smaller (2): `[2, 4, 3, 7, 5]`.
   3 now has no children smaller than it, so stop. Again O(log n).

Heapify builds a heap from an array by sifting down every non-leaf node from the last one up to the
root. Most nodes are near the bottom and move very little, so the total is O(n), not O(n log n).
Repeatedly popping from a heap gives sorted order: that is **heap sort**, O(n log n) and in place.

## Code

```python run
import heapq


nums = [5, 7, 2, 4, 3]
heapq.heapify(nums)                          # O(n); nums is now a valid min-heap
assert nums[0] == 2                          # smallest is always at index 0
heapq.heappush(nums, 1)
assert [heapq.heappop(nums) for _ in range(3)] == [1, 2, 3]

# Max-heap: store negated values.
max_heap: list[int] = []
for x in [3, 9, 4]:
    heapq.heappush(max_heap, -x)
assert -max_heap[0] == 9

# Priority queue of tasks: (priority, order, name); order breaks ties without comparing names.
tasks: list[tuple[int, int, str]] = []
for order, (priority, name) in enumerate([(2, "email"), (1, "deploy fix"), (2, "review")]):
    heapq.heappush(tasks, (priority, order, name))
assert [heapq.heappop(tasks)[2] for _ in range(3)] == ["deploy fix", "email", "review"]


def merge_sorted(lists: list[list[int]]) -> list[int]:
    """Merge k sorted lists in O(N log k) with a heap of the current front items."""
    heap = [(lst[0], i, 0) for i, lst in enumerate(lists) if lst]
    heapq.heapify(heap)
    out = []
    while heap:
        val, i, j = heapq.heappop(heap)
        out.append(val)
        if j + 1 < len(lists[i]):
            heapq.heappush(heap, (lists[i][j + 1], i, j + 1))
    return out


assert merge_sorted([[1, 4, 5], [1, 3, 4], [2, 6]]) == [1, 1, 2, 3, 4, 4, 5, 6]
assert heapq.nsmallest(2, [5, 1, 4, 2]) == [1, 2]
```

## Trade-offs

Use a heap when you repeatedly need the current smallest or largest item while items keep arriving:
scheduling, Dijkstra's shortest paths, merging sorted streams, top k, running median (two heaps). If
you need the minimum only once, a single O(n) scan is simpler. If you need to search for arbitrary
items or iterate in sorted order, a heap does not help: use a sorted structure or a balanced tree.
Removing or updating an arbitrary item in a binary heap is O(n) to find it; the common workaround is
"lazy deletion": push the new version and skip stale entries when they are popped.

## Common mistakes

- **Assuming the heap list is sorted.** Only index 0 is guaranteed; `heap[1]` is not the second smallest.
- **Forgetting Python's heap is a min-heap**; negate values for a max-heap.
- **Pushing tuples whose later fields cannot be compared** (dicts, custom objects); add a counter as a
  tie-breaker.
- **Calling heapify O(n log n)**; it is O(n).
- **Using `sorted()` when only the top few are needed**, which wastes O(n log n).

## In interviews

Problems: kth largest element, top k frequent elements, k closest points, merge k sorted lists, find
median from a data stream (a max-heap for the lower half and a min-heap for the upper half), task
scheduler, meeting rooms II, Dijkstra. Explain why a heap of size k gives O(n log k), and which heap
type you need: for the k **largest**, keep a **min**-heap of size k so the weakest member sits on top.

Likely follow-up questions:

- Why is heapify O(n)?
- How is a heap stored in an array?
- How would you keep a running median?
- How do you update an item's priority? (Lazy deletion, or an indexed heap.)
