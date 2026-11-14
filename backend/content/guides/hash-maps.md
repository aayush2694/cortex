## In short

A hash map stores key-value pairs and finds a value by key in **O(1) on average**. It works by
running the key through a hash function that turns it into a number, then using that number to pick
a slot (a "bucket") in an array. Two keys can land in the same slot (a **collision**), so the map
needs a way to handle that, and it grows its array when it gets too full (the **load factor**).
Insert, lookup and delete are O(1) average and O(n) in the worst case. Python's `dict` and `set`,
Java's `HashMap` and JavaScript's `Map` are hash maps.

## The idea

A library could keep books in one long shelf and search it from the start: O(n). Or it could use a
rule like "the shelf number is the first letter of the author's surname", and go straight to the
right shelf. A hash function is a much better version of that rule: it takes any key (a string, a
number, a tuple) and quickly produces a number that looks random but is always the same for the
same key. Taking that number modulo the array size gives the slot.

Because many keys share few slots, collisions are unavoidable. Two common fixes:

1. **Separate chaining**: each slot holds a small list of entries; colliding keys go into the same
   list (Java's `HashMap` does this, switching long chains into trees).
2. **Open addressing**: if a slot is taken, probe other slots in a fixed order until a free one is
   found (Python's `dict` does this).

Either way, if the table is mostly empty, each slot has very few entries and operations stay O(1).
So the map tracks its **load factor** (entries ÷ slots). When it passes a threshold, the map
allocates a bigger array and re-inserts everything. That resize is O(n), but like a dynamic
array's growth it happens rarely, so the average cost per insert stays O(1).

The worst case is O(n): if many keys hash to the same slot, a lookup must compare against all of
them. A good hash function and randomization (Python randomizes string hashes per process) make
that unlikely in practice.

## How it works

A toy map with 8 slots and chaining. Suppose `hash("cat") % 8 == 3` and
`hash("dog") % 8 == 3` too.

1. Insert `"cat" → 1`: slot 3 gets the entry `("cat", 1)`.
2. Insert `"dog" → 2`: slot 3 already has an entry, so append: `[("cat", 1), ("dog", 2)]`.
3. Look up `"dog"`: compute slot 3, walk its short list comparing keys with `==`, return 2.
4. After enough inserts the load factor passes 0.75, so the map doubles to 16 slots and moves each
   entry to its new slot `hash(key) % 16`.

This is why keys must be **hashable and immutable**. If a key changed after insertion, its hash would
change and the map would look in the wrong slot. In Python, lists cannot be keys; tuples and strings
can. Objects used as keys need `__hash__` and `__eq__` that agree: equal objects must have equal
hashes.

## Code

```python run
class ChainedMap:
    """A minimal hash map with separate chaining and resizing, for illustration."""

    def __init__(self, capacity: int = 8) -> None:
        self.buckets: list[list[tuple[object, object]]] = [[] for _ in range(capacity)]
        self.size = 0

    def _bucket(self, key: object) -> list[tuple[object, object]]:
        return self.buckets[hash(key) % len(self.buckets)]

    def put(self, key: object, value: object) -> None:
        bucket = self._bucket(key)
        for i, (k, _) in enumerate(bucket):
            if k == key:
                bucket[i] = (key, value)           # replace existing key
                return
        bucket.append((key, value))
        self.size += 1
        if self.size / len(self.buckets) > 0.75:   # load factor too high: grow
            old = [pair for b in self.buckets for pair in b]
            self.buckets = [[] for _ in range(2 * len(self.buckets))]
            self.size = 0
            for k, v in old:
                self.put(k, v)

    def get(self, key: object, default: object = None) -> object:
        for k, v in self._bucket(key):
            if k == key:
                return v
        return default


m = ChainedMap()
for i in range(100):
    m.put(f"key{i}", i)
m.put("key5", "updated")
assert m.get("key42") == 42
assert m.get("key5") == "updated"
assert m.get("missing") is None
assert m.size == 100 and len(m.buckets) >= 128
```

## Trade-offs

Hash maps give the fastest average lookups but keep no useful order (Python dicts keep insertion
order, but not sorted order). If you need sorted keys, range queries ("all keys between 10 and 20")
or the smallest key, use a balanced binary search tree (Java `TreeMap`, C++ `std::map`): O(log n)
per operation. For small fixed key ranges, a plain array indexed by the key is faster and simpler
than any map. Hash maps also use more memory than arrays because of empty slots.

## Common mistakes

- **Using mutable objects as keys**, or changing an object after using it as a key.
- **Defining `__eq__` without a matching `__hash__`** on custom classes.
- **Assuming sorted iteration order**.
- **Calling every lookup O(1)** without saying "on average"; interviewers often ask about the worst case.
- **Checking `if map[key]`** when the value can be 0 or empty; use `key in map`.

## In interviews

Hash maps are the most common tool for turning O(n²) into O(n): two sum, anagrams, LRU cache (hash
map plus doubly linked list), subarray sums with prefix sums, graph adjacency lists, memoization.
You may also be asked to design one: describe hashing, buckets, collision handling, load factor and
resizing.

Likely follow-up questions:

- What happens on a collision? Compare chaining with open addressing.
- Why is resizing still O(1) amortized?
- What is the worst case, and how can it happen?
- When would you use a tree map instead of a hash map?
