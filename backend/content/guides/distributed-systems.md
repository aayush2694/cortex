## In short

A distributed system is a set of machines that work together and communicate over a network. The network is
unreliable: messages can be lost, delayed, duplicated or reordered, machines crash and restart, and clocks
drift apart. **Consistency models** describe what readers may see: **strong consistency** (every read sees the
latest write) versus **eventual consistency** (replicas converge later). The **CAP theorem** says that during a
network **partition** a system must choose between consistency and availability. **Quorums** (W + R > N) give
consistent reads in replicated stores, and **idempotency** makes retries safe.

## The idea

On one machine, a function call either returns or throws. Across a network, a third outcome appears: **you
don't know**. A request that times out may have failed, may have succeeded with the reply lost, or may still be
running. Every distributed design has to handle that uncertainty, and it is why retries, idempotency keys and
deduplication show up everywhere.

**Clocks** are another trap. Two servers' clocks can differ by milliseconds or more, so "last write wins" by
timestamp can silently throw away the newer write. Systems use sequence numbers, version vectors, or a single
leader to order events instead of trusting wall clocks.

**CAP** in plain words: imagine two data centres that lose their connection (a partition). A write arrives at
one. The system can either refuse writes or reads until the link returns (staying **consistent**, losing
**availability**), or accept them on both sides and reconcile later (staying **available**, accepting
temporary inconsistency). It cannot have both during the partition. When there is no partition, the real
trade-off is between **consistency and latency** (the PACELC extension): waiting for replicas to agree takes
time.

**Consistency models** come in a range:

- **Linearizable (strong)**: the system behaves like one copy; any read after a completed write sees it.
- **Read-your-writes, monotonic reads**: weaker guarantees that fix the most visible user anomalies.
- **Eventual**: if writes stop, replicas eventually agree; meanwhile reads can be stale.

**Quorums** in leaderless replication: with N replicas, a write waits for W acknowledgements and a read asks R
replicas. If W + R > N, every read set overlaps every write set, so at least one replica in each read has the
latest value. N = 3, W = 2, R = 2 is a common choice. This is not a perfect guarantee: concurrent writes,
a write that fails after reaching some replicas, or "sloppy" quorums that accept writes on stand-in
nodes during failures can still return stale or conflicting values, so quorums alone are not
linearizable.

## How it works

A shopping cart in a Dynamo-style store with N = 3, W = 2, R = 2:

1. Asha adds a book. The coordinator sends the write to replicas A, B and C, and reports success after A and B
   acknowledge. C is slow and misses it for now.
2. Asha reloads her cart. The read asks two replicas, say B and C. B has the new version, C the old one. The
   coordinator returns the newest (by version number) and repairs C in the background (**read repair**).
3. If a partition splits A from B and C, a write with W = 2 can still succeed on B and C, but A will serve
   stale data to any client that can only reach it (if R = 1 were allowed). Higher W and R mean more
   consistency and less availability.
4. Concurrent edits on different sides of a partition produce conflicting versions that must be merged; for a
   cart, taking the union of items is a reasonable rule.

## Trade-offs

Strong consistency is simplest to program against but costs latency (coordination) and availability during
partitions. Eventual consistency is fast and available but pushes conflict handling into the application and
can confuse users. Most real systems mix them: strongly consistent for money, inventory and uniqueness
(usernames), eventually consistent for feeds, counters, recommendations and search. The design skill is
choosing per piece of data.

## Common mistakes

- **Assuming the network is reliable** and calls either succeed or fail clearly.
- **Ordering events by wall-clock timestamps** from different machines.
- **Retrying non-idempotent operations** after a timeout.
- **Misquoting CAP** as "pick two of three" at all times; the choice only bites during partitions.
- **Strong consistency everywhere**, paying latency and availability for data that doesn't need it.
- **Ignoring partial failure**: one slow node can stall a whole request path.

## In interviews

Expect: explain CAP with an example, strong versus eventual consistency and where each fits in the design,
quorums and why W + R > N works, how to handle timeouts and duplicate messages, clock problems, and failure
scenarios ("what happens if this node is cut off?"). Use concrete data examples: "the account balance must be
strongly consistent; the like count can be eventually consistent".

Likely follow-up questions:

- What does the CAP theorem actually say?
- Why does W + R > N give consistent reads?
- What can go wrong if you order events by timestamps from different servers?
- Which data in this design needs strong consistency?
