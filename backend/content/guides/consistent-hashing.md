## In short

Consistent hashing decides which server stores each key so that **adding or removing a server moves only
a small share of keys** (about 1/N of them), instead of reshuffling almost everything. Servers and keys
are hashed onto the same circle (the "ring"); each key belongs to the first server found by walking
clockwise from the key's position. **Virtual nodes** (many points per server) even out the load. It is
used by distributed caches, Dynamo-style databases such as Cassandra and Riak, CDNs and load
balancers that need "sticky" placement.

## The idea

The obvious way to spread keys over N cache servers is `server = hash(key) % N`. It balances well, until N
changes. Go from 4 servers to 5 and the result of `% N` changes for about 80% of keys. For a cache, that
means most cached data is suddenly on the "wrong" server: a near-total cache miss storm hits the database
exactly when you were adding capacity.

Consistent hashing removes the dependence on N. Picture a clock face numbered 0 to 2³²−1. Hash each server
name to a point on it, and hash each key to a point too. A key is owned by the next server clockwise.
Now add a server: it lands somewhere on the circle and takes over only the keys between its position and
the previous server's position. Every other key stays where it was. Remove a server and only its keys move,
to its clockwise neighbour.

With only a few servers, the points land unevenly, so one server may own a huge arc. **Virtual nodes** fix
this: each server is placed on the ring many times (say 100–200 points, by hashing "serverA#1",
"serverA#2", …). Each server then owns many small arcs, which averages out to an even share, and when a
server leaves, its load spreads across many others instead of all landing on one neighbour. Giving a
bigger machine more virtual nodes gives it a proportionally bigger share.

Replication fits naturally: store each key on the next R distinct servers clockwise, so data survives the
loss of a server.

## How it works

Ring positions (simplified to 0–99): servers A at 10, B at 45, C at 80.

1. Key "user:7" hashes to 30. Walking clockwise, the first server is B (45). B owns it.
2. Key "cart:9" hashes to 90. Past C (80) the ring wraps around to A (10). A owns it.
3. Add server D at 60. Only keys between 45 and 60, which used to belong to C, move to D. Keys owned by A
   and B don't move at all.
4. Remove B. Keys from 10 to 45 move to the next server clockwise, which is D at 60. Nothing else changes.

Lookups use a sorted list of ring positions and binary search, so finding a key's server is O(log V) for
V virtual nodes.

## Code

```python run
import bisect
import hashlib


def h(value: str) -> int:
    return int(hashlib.md5(value.encode()).hexdigest(), 16)   # stable across runs, unlike hash()


class HashRing:
    def __init__(self, servers: list[str], vnodes: int = 100) -> None:
        self.vnodes = vnodes
        self.ring: list[tuple[int, str]] = []
        for s in servers:
            self.add(s)

    def add(self, server: str) -> None:
        for i in range(self.vnodes):
            bisect.insort(self.ring, (h(f"{server}#{i}"), server))

    def remove(self, server: str) -> None:
        self.ring = [(pos, s) for pos, s in self.ring if s != server]

    def owner(self, key: str) -> str:
        i = bisect.bisect(self.ring, (h(key), ""))
        return self.ring[i % len(self.ring)][1]                # wrap around the circle


keys = [f"key{i}" for i in range(10_000)]
ring = HashRing(["a", "b", "c", "d"])
before = {k: ring.owner(k) for k in keys}
ring.add("e")
moved = sum(before[k] != ring.owner(k) for k in keys)
assert moved < 0.3 * len(keys)                 # about 1/5 move, not ~80%

modulo_moved = sum(h(k) % 4 != h(k) % 5 for k in keys)
assert modulo_moved > 0.7 * len(keys)          # plain modulo reshuffles most keys
```

## Trade-offs

Consistent hashing gives minimal data movement and decentralised placement (any client with the server
list can compute the owner), which suits caches and peer-to-peer stores. The costs are uneven load without
enough virtual nodes, more complex rebalancing logic, and no ordering, so range queries are impossible.
Alternatives: a **directory** or lookup service mapping keys or ranges to servers gives precise control and
easy moves but is another component to keep available; **rendezvous (highest random weight) hashing** gives
similar stability with a simpler implementation for small server counts; **range partitioning** keeps
order for range scans.

## Common mistakes

- **Using `hash(key) % N`** for anything whose N changes, such as cache clusters.
- **Too few virtual nodes**, leading to badly unbalanced servers.
- **Using a hash that changes between processes** (Python's `hash()` for strings is randomised per run).
- **Hot keys**: consistent hashing spreads keys, not traffic. One celebrity key still overloads its server;
  replicate or split hot keys.
- **Forgetting that moved keys must actually be migrated** (for databases) or will simply miss (for caches).

## In interviews

Consistent hashing comes up in "design a distributed cache", "design a key-value store" and sharding
discussions. Explain why modulo hashing fails when servers change, draw the ring, show what moves when a
node is added, and explain virtual nodes and replication along the ring. Mention where it is used in
practice (Amazon's Dynamo paper, Cassandra, Riak, Memcached clients) and its limit with hot keys.

Likely follow-up questions:

- What fraction of keys move when you add a server?
- Why do we need virtual nodes?
- How would you replicate data with consistent hashing?
- How do you handle a single extremely hot key?
