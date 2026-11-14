## In short

To find the k largest (or smallest, or most frequent) items, you do not need to sort everything.
Keep a **heap of size k**: for the k largest, a **min-heap** whose root is the weakest member of the
current top k. Each new item either beats that root (replace it) or is ignored. That costs
O(n log k) time and O(k) memory, which beats sorting's O(n log n) when k is much smaller than n, and
it works on a stream where items arrive one at a time. Alternatives: quickselect (O(n) average) and
bucket sort for frequencies (O(n)).

## The idea

Imagine choosing the 3 tallest people from a crowd walking past you one by one. You keep three spots.
Fill them with the first three people. After that, compare each newcomer only with the **shortest** of
your three. If the newcomer is taller, they replace that person; otherwise they walk on. You never
need to remember anyone else, and you never compare with all three, just with the weakest.

A min-heap gives you "the weakest of my current top k" in O(1) and lets you replace it in O(log k).
That is why the k **largest** use a **min**-heap, which feels backwards at first. The mirror holds
too: for the k smallest, keep a max-heap of size k (in Python, push negated values).

The same idea extends to anything with a score: the k closest points (score = distance), the k most
frequent words (score = count, then alphabetical order as a tie-breaker), the k-th largest element in
a stream (the root of the size-k heap is the answer at every moment).

When all the data is already in memory and you only need the k-th value, **quickselect** finds it in
O(n) on average by partitioning like quick sort but recursing into one side only. When scores are
small integers, such as frequencies bounded by n, **bucket sort** groups items by score and reads the
buckets from the top in O(n).

## How it works

Third largest in `[3, 2, 1, 5, 6, 4]`:

1. Push 3, 2, 1. Heap (smallest on top): `[1, 2, 3]`. Size is k = 3.
2. 5 > 1 (the root), so pop 1 and push 5: `[2, 3, 5]`.
3. 6 > 2: replace. `[3, 5, 6]`.
4. 4 > 3: replace. `[4, 5, 6]`.
5. The root, 4, is the third largest. The heap holds the top three: 4, 5, 6.

Top 2 frequent in `[1, 1, 1, 2, 2, 3]`: count first (`{1: 3, 2: 2, 3: 1}`), then run the same size-k
heap over `(count, value)` pairs. The answer is `[1, 2]`.

## Code

```python run
import heapq
from collections import Counter


def kth_largest(nums: list[int], k: int) -> int:
    heap: list[int] = []
    for x in nums:
        if len(heap) < k:
            heapq.heappush(heap, x)
        elif x > heap[0]:                       # beats the weakest of the top k
            heapq.heapreplace(heap, x)          # pop root and push x in one step
    return heap[0]


def top_k_frequent(nums: list[int], k: int) -> list[int]:
    """Bucket sort by frequency: O(n)."""
    buckets: list[list[int]] = [[] for _ in range(len(nums) + 1)]
    for value, count in Counter(nums).items():
        buckets[count].append(value)
    out: list[int] = []
    for count in range(len(buckets) - 1, 0, -1):
        for value in buckets[count]:
            out.append(value)
            if len(out) == k:
                return out
    return out


def k_closest(points: list[tuple[int, int]], k: int) -> list[tuple[int, int]]:
    return heapq.nsmallest(k, points, key=lambda p: p[0] ** 2 + p[1] ** 2)


class KthLargestStream:
    def __init__(self, k: int, nums: list[int]) -> None:
        self.k, self.heap = k, []
        for x in nums:
            self.add(x)

    def add(self, x: int) -> int:
        heapq.heappush(self.heap, x)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)
        return self.heap[0]


assert kth_largest([3, 2, 1, 5, 6, 4], 3) == 4
assert kth_largest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4) == 4
assert sorted(top_k_frequent([1, 1, 1, 2, 2, 3], 2)) == [1, 2]
assert k_closest([(1, 3), (-2, 2), (5, 8)], 1) == [(-2, 2)]
stream = KthLargestStream(3, [4, 5, 8, 2])
assert [stream.add(x) for x in (3, 5, 10, 9, 4)] == [4, 5, 5, 8, 8]
```

## Common mistakes

- **Using a max-heap of all n items** for the k largest: O(n + k log n) works but uses O(n) memory and
  misses the point of the pattern.
- **Wrong heap direction**: k largest → min-heap of size k; k smallest → max-heap of size k.
- **Letting the heap grow beyond k** (forgetting to pop).
- **Ties in tuples**: when scores tie, Python compares the next field; make sure it is comparable or
  add a tie-breaker.
- **Sorting everything** when k is small and n is large.

## In interviews

Problems: kth largest element in an array, kth largest in a stream, top k frequent elements, top k
frequent words, k closest points to origin, find k closest elements, reorganize string, task
scheduler, find median from a data stream. Mention the three options (heap O(n log k), quickselect
O(n) average, sort O(n log n)) and pick based on whether data streams in, whether k is small, and
whether you may modify the input.

Likely follow-up questions:

- Why a min-heap for the k largest?
- What is the complexity, and when is it better than sorting?
- How would you do it in O(n) on average? (Quickselect.)
- What if the data is a stream too large to store?
