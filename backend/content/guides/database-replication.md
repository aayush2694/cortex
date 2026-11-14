## In short

Replication keeps copies of the same data on several machines. It serves three goals: **availability**
(if one machine dies, another has the data), **read scaling** (spread reads across replicas), and
**latency** (a replica near users). The common setup is **leader-follower**: one leader accepts writes
and streams changes to read-only followers. Replication can be **synchronous** (safer, slower) or
**asynchronous** (faster, but recent writes can be lost on failover, and followers **lag**). Lag causes
"I saved it but I can't see it" bugs, so designs need **read-your-writes** consistency where it matters.

## The idea

One database server is a single point of failure: hardware dies, disks fill, a region has an outage.
Keeping live copies elsewhere means you can switch over in seconds instead of restoring a backup for
hours. Backups are still needed (replication happily copies a mistaken `DELETE` too), but replicas keep
the service running.

In leader-follower replication, the leader writes every change to its log (PostgreSQL's write-ahead
log, MySQL's binlog) and followers replay that log. Because every follower applies the same changes in
the same order, they end up with the same data, just slightly later.

**Synchronous versus asynchronous** is the key choice. With synchronous replication, the leader waits
until at least one follower confirms each write before telling the client "committed". No committed
write is lost if the leader dies, but every write is slower, and a slow follower slows everyone. With
asynchronous replication, the leader confirms immediately; it is fast, but if the leader crashes, the
last few writes that had not reached a follower are gone. Many systems use one synchronous follower and
the rest asynchronous (semi-synchronous).

**Replication lag** is the delay before a follower has a write, usually milliseconds, sometimes seconds
under load. It creates anomalies:

- **Read-your-writes**: a user updates their profile, the next page reads from a lagging replica, and the
  old profile appears. Fix: read the user's own data from the leader for a short time after they write, or
  track the write's log position and wait for a replica that has it.
- **Monotonic reads**: two reads hit different replicas and data appears to go back in time. Fix: pin a
  user to one replica.

**Multi-leader** and **leaderless** (Dynamo-style, quorum-based) replication accept writes in several
places, which helps multi-region writes and availability but brings write conflicts that must be resolved.

## How it works

Failover in a leader-follower PostgreSQL cluster:

1. Health checks notice the leader is not responding for, say, 30 seconds.
2. The orchestrator (Patroni, a managed cloud service) picks the most up-to-date follower.
3. It **fences** the old leader (makes sure it can no longer accept writes, for example by revoking its
   access or shutting it down) to avoid **split brain**, where two leaders accept different writes.
4. It promotes the follower to leader, points the other followers at it, and updates the DNS name or
   proxy that applications connect to.
5. With asynchronous replication, writes the old leader had not shipped are lost; the team must decide
   whether that is acceptable for this data.

## Trade-offs

Read replicas scale reads cheaply but do nothing for write throughput (every write still hits the
leader and every replica). Synchronous replication protects data at the cost of write latency and
availability. Automatic failover reduces downtime but risks split brain and false failovers on brief
network blips; manual failover is safer but slower. Cross-region replicas help disaster recovery and
local reads but add lag. When writes outgrow one leader, the next step is sharding.

## Common mistakes

- **Treating replicas as backups**: a dropped table is replicated instantly. Keep real backups and test
  restores.
- **Reading critical data from replicas** without handling lag (balances, just-saved settings).
- **Ignoring lag monitoring**; alert when a replica falls too far behind.
- **No fencing**, which allows two leaders after a failover.
- **Never testing failover**, so the first real one fails.
- **Sending all reads to replicas** blindly, including reads inside write transactions.

## In interviews

Replication appears whenever a design needs high availability or heavy reads. Expect: leader-follower
versus multi-leader versus leaderless, sync versus async and what each loses, replication lag and
read-your-writes, failover and split brain, and how replicas differ from backups and sharding. Tie it to
numbers: "reads are 90% of traffic, so three read replicas take most load off the leader".

Likely follow-up questions:

- What data can be lost with asynchronous replication, and when?
- How do you make sure a user sees their own write immediately?
- What is split brain and how do you prevent it?
- When are read replicas not enough?
