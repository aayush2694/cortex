## In short

A cache keeps a copy of data somewhere faster to read than its source: memory instead of disk, a nearby
server instead of a distant one, a precomputed result instead of an expensive query. Caches exist at
every level (browser, CDN, application memory, Redis or Memcached, the database's own buffer). The main
patterns are **cache-aside** (the app checks the cache, then the database), **write-through** and
**write-back**. A full cache evicts entries with a policy such as **LRU** (least recently used), and
**TTLs** expire stale data. The hard parts are **invalidation** and **stampedes**.

## The idea

Reading a value from memory takes around 100 nanoseconds; a query that hits disk or a network round trip
takes milliseconds, tens of thousands of times longer. If the same data is read far more often than it
changes (product pages, user profiles, configuration, rendered fragments), keeping a copy close by
removes most of that cost and most of the database load.

A cache only helps if requests repeat. The **hit ratio** (share of reads served from the cache) is the
number to watch: 95% hits means the database sees only one read in twenty.

The write patterns differ in who updates what:

- **Cache-aside** (lazy loading): on a read miss, load from the database and put the result in the cache;
  on a write, update the database and delete the cache key. Simple, and the cache holds only data that is
  actually read. The most common choice.
- **Write-through**: every write goes to the cache and the database together. Reads are always warm, but
  every write pays twice, and rarely read data fills the cache.
- **Write-back** (write-behind): writes go to the cache and are flushed to the database later. Very fast
  writes, but data is lost if the cache dies before flushing.

**Invalidation** is famously hard because the cache and the database are two copies that can disagree.
Decide per kind of data how stale it may be. A product description can be five minutes old; a bank
balance cannot be cached naively at all.

A **stampede** (thundering herd) happens when a popular key expires and thousands of requests miss at
once, all hitting the database. Fixes: let one request rebuild the value while others wait or get the
stale value, add random jitter to TTLs so keys don't expire together, or refresh hot keys before they
expire.

## How it works

Cache-aside for a product page:

1. Request for product 42. The app calls `GET product:42` in Redis.
2. **Hit**: return the cached JSON. About 1 ms.
3. **Miss**: query the database (say 20 ms), store the result with `SET product:42 … EX 300`, and return it.
4. When an admin edits product 42, the app updates the database, then deletes `product:42`. The next read
   repopulates it.
5. When Redis is full, it evicts keys according to its policy (for example `allkeys-lru`), dropping the
   ones read least recently.

The order in step 4 matters: update the database first, then delete the key. Deleting first leaves a
window where another request can re-cache the old value.

## Code

```python run
from collections import OrderedDict


class LRUCache:
    """Fixed-capacity cache that evicts the least recently used key. O(1) get and put."""

    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self.data: OrderedDict[str, object] = OrderedDict()

    def get(self, key: str) -> object | None:
        if key not in self.data:
            return None
        self.data.move_to_end(key)                 # mark as most recently used
        return self.data[key]

    def put(self, key: str, value: object) -> None:
        self.data[key] = value
        self.data.move_to_end(key)
        if len(self.data) > self.capacity:
            self.data.popitem(last=False)          # evict the least recently used


db_reads = []


def load_product(pid: str) -> dict:
    db_reads.append(pid)                           # stands in for a slow database query
    return {"id": pid}


cache = LRUCache(capacity=2)


def get_product(pid: str) -> dict:
    """Cache-aside: try the cache, fall back to the database, then fill the cache."""
    hit = cache.get(pid)
    if hit is not None:
        return hit                                 # type: ignore[return-value]
    value = load_product(pid)
    cache.put(pid, value)
    return value


for pid in ["a", "b", "a", "c", "b", "a"]:
    get_product(pid)
# "a" hit once; "c" evicted "b" (least recently used), so "b" and then "a" were reloaded.
assert db_reads == ["a", "b", "c", "b", "a"]
```

## Trade-offs

Caching trades **freshness** and **complexity** for speed and lower load. Local in-process caches are the
fastest but each server has its own copy, so invalidation is harder and memory is duplicated; a shared
Redis is slightly slower but consistent across servers and survives deploys. Longer TTLs mean more hits
and staler data. Caching also hides problems: if the cache is lost, can the database survive the full
load? Plan for a cold cache.

## Common mistakes

- **Caching without an invalidation plan**, then serving stale prices or permissions.
- **Deleting the key before updating the database**, which allows stale values back in.
- **Caching per-user or sensitive data under shared keys**, leaking it to other users.
- **Same TTL for everything**, so many keys expire at once and cause a stampede.
- **Unbounded caches** that grow until memory runs out; always set a size limit or eviction policy.
- **Caching data that is rarely read twice**, which adds work and gives no benefit.

## In interviews

Caching appears in almost every design. Expect: where you would add caches and what you would cache,
cache-aside versus write-through versus write-back, eviction policies (LRU, LFU, TTL), invalidation
strategies, stampede protection, Redis versus Memcached, and "design an LRU cache" as a coding problem
(a hash map plus a doubly linked list, or `OrderedDict` in Python). Give numbers: hit ratio, latency
saved, database load removed.

Likely follow-up questions:

- How do you keep the cache consistent with the database?
- What happens when a hot key expires?
- What would you do if Redis went down?
- How would you implement an LRU cache with O(1) operations?
