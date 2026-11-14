## In short

Consensus is how a group of machines agrees on a value, such as who the leader is or the order of writes in a
log, even when some machines crash or messages are lost. **Raft** and **Paxos** are the classic algorithms.
They need a **majority** (quorum): a cluster of 2f + 1 nodes survives f failures, which is why clusters have 3
or 5 nodes. A **leader** handles requests and replicates a log to followers; **terms** (epochs) stop an old
leader from acting after a new one is elected. Most teams don't implement consensus; they use systems built
on it, such as **etcd**, **ZooKeeper** or **Consul**, for leader election, locks and configuration.

## The idea

Many problems quietly need agreement. Exactly one database node must be the leader. Exactly one scheduler
should run tonight's billing job. A distributed lock must be held by only one process. A configuration change
must be seen in the same order everywhere. Doing this naively ("the first node to write its name in a shared
file wins") breaks with crashes, slow networks and two nodes acting at once.

The key insight is the **majority**. Any two majorities of a group overlap in at least one member. If every
decision needs a majority, two conflicting decisions can never both be made, because some node would have to
vote for both, and the algorithm forbids that. With 5 nodes, decisions need 3; the cluster keeps working with 2
nodes down. With 4 nodes you still need 3, so a 4-node cluster tolerates only 1 failure, the same as 3 nodes.
That's why clusters use odd sizes.

**Raft** splits the problem into understandable parts:

- **Leader election**: nodes start as followers. If a follower hears nothing from a leader for a randomised
  timeout, it becomes a candidate, increments the **term**, and asks for votes. A candidate with votes from a
  majority becomes leader for that term. Randomised timeouts make split votes rare.
- **Log replication**: clients send writes to the leader, which appends them to its log and sends them to
  followers. Once a majority has stored an entry, it is **committed** and applied to the state machine.
- **Safety**: a node only votes for candidates whose log is at least as up to date as its own, so a new leader
  always has every committed entry.

Terms act as **fencing tokens**: if an old leader wakes up after a pause and tries to act, other nodes reject
it because its term is out of date.

## How it works

A 5-node Raft cluster (A is leader in term 3):

1. A client writes `x = 7` to A. A appends it to its log and sends it to B, C, D and E.
2. B and C confirm. With A that's 3 of 5, a majority, so the entry is committed and A replies to the client.
3. A crashes. B, C, D and E stop receiving heartbeats. D's timeout fires first: it becomes a candidate for
   term 4 and asks for votes.
4. D's log doesn't contain `x = 7`, so B and C refuse to vote for it (their logs are more up to date). C times
   out next, asks for term 5, and wins with votes from B, D and itself. C already has `x = 7`, so no committed
   data is lost.
5. A restarts, sees the higher term, and becomes a follower. Its stale view of the world can no longer cause
   damage.

## Trade-offs

Consensus gives strong consistency and automatic failover, but every write needs a majority round trip, so
throughput and latency are limited, and the cluster stops accepting writes if a majority is unreachable. Bigger
clusters tolerate more failures but make each decision slower. That is why consensus systems are used for
**small, critical metadata** (who is leader, configuration, locks, cluster membership), while bulk data uses
cheaper replication. Running your own etcd or ZooKeeper cluster also requires operational care; managed
services and databases with built-in consensus (CockroachDB, Spanner, Kafka with KRaft) hide it.

## Common mistakes

- **Even-sized clusters**, which add cost without adding fault tolerance.
- **Distributed locks without fencing tokens**: a paused process may wake up believing it still holds the lock.
- **Using a single Redis instance as a "lock service"** for correctness-critical work.
- **Spreading a cluster across two data centres**, where losing one may lose the majority; use three locations.
- **Putting large, high-volume data through the consensus log.**
- **Implementing consensus yourself** instead of using a proven system.

## In interviews

Consensus rarely needs to be implemented in an interview, but you should explain why majorities work, how
leader election and log replication work at a high level, why clusters have 3 or 5 nodes, what split brain is
and how terms or fencing tokens prevent it, and when you would use etcd or ZooKeeper (leader election for a
scheduler, distributed locks, service discovery, configuration).

Likely follow-up questions:

- Why does a 5-node cluster survive 2 failures but a 4-node cluster only 1?
- How does Raft prevent two leaders from accepting writes?
- How would you make sure only one instance runs a nightly job?
- What is a fencing token, and why do locks need one?
