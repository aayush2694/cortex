## In short

System design is deciding how the parts of a software system (servers, databases, caches, queues)
fit together to meet its requirements at the expected scale. The core vocabulary: **latency** (how
long one request takes), **throughput** (requests handled per second), **availability** (the share of
time the system works, counted in "nines"), **scalability** (handling more load by adding resources),
and **consistency** (whether everyone sees the same data). Every design is a set of trade-offs between
these, cost and simplicity. In interviews, a clear process matters more than a perfect diagram.

## The idea

A to-do app for 100 users runs happily on one small server with one database. The same app for
10 million users needs more: several application servers behind a load balancer, a cache in front of
the database, read replicas, maybe background workers. System design is the skill of knowing which of
those pieces a given problem actually needs, and why.

**Latency versus throughput.** A highway's speed limit is latency; the number of lanes is throughput.
Adding lanes (servers) raises throughput but does not make one car faster. Latency is reported as
percentiles: p50 is the typical request, p99 is the slowest 1%, and the p99 is what your heaviest users
feel.

**Availability** is usually measured over a year:

- 99% allows about 3.65 days of downtime.
- 99.9% allows about 8.8 hours.
- 99.99% allows about 53 minutes.

Each extra nine costs much more: redundancy across machines, then data centres, then regions, plus
automated failover and careful deploys.

**Scaling** comes in two flavours. **Vertical** scaling buys a bigger machine: simple, no code changes,
but with a ceiling and a single point of failure. **Horizontal** scaling adds more machines: no hard
ceiling, but servers must be stateless and data must be shared, replicated or split.

**Back-of-the-envelope estimates** turn vague requirements into numbers. 10 million daily users each
making 20 requests is 200 million requests a day, about 2,300 per second on average, maybe 5–10 times that
at peak. Those numbers tell you whether one database is enough.

## How it works

A reliable structure for a design discussion:

1. **Clarify requirements.** Functional (what users can do) and non-functional (scale, latency,
   availability, consistency). Ask who the users are and which features matter most.
2. **Estimate.** Requests per second, read/write ratio, storage per year, bandwidth.
3. **Define the API.** The main endpoints or operations and their inputs and outputs.
4. **Sketch the data model.** Main entities, how they are accessed, and which database fits.
5. **Draw the high-level design.** Client → load balancer → stateless app servers → cache → database,
   plus queues and workers where work can be asynchronous.
6. **Deep-dive** into the hardest parts: the hot path, the bottleneck, the component the interviewer
   cares about.
7. **Discuss trade-offs and failure modes.** What breaks first, how it degrades, what you would monitor.

## Trade-offs

Almost every decision trades one good property for another:

- **Consistency versus availability and latency**: strongly consistent systems wait for agreement;
  eventually consistent ones answer faster but may be briefly stale.
- **Simplicity versus scalability**: a single database is easy to reason about; sharding scales further
  but complicates every query and transaction.
- **Cost versus reliability**: every extra region and replica costs money.
- **Build versus buy**: a managed queue or database saves operations work but adds cost and lock-in.

Good designers say these trade-offs out loud and choose based on the requirements, not on fashion.

## Common mistakes

- **Jumping to a diagram** before clarifying requirements and scale.
- **Over-engineering**: microservices, Kafka and sharding for a system that fits on one database.
- **Ignoring numbers**: no estimates, so no way to justify any component.
- **Single points of failure** left unaddressed (one database, one load balancer).
- **Talking only about the happy path**, with nothing on failures, monitoring or deploys.
- **Treating averages as enough**: p99 latency is what users complain about.

## In interviews

System design rounds are open-ended on purpose. Interviewers look for structure, communication and
judgement: do you clarify, estimate, start simple, then evolve the design as requirements grow? For a
mid-level role, a clean high-level design with sound choices and clear trade-offs beats a complicated
design you cannot justify. Use real experience where you can ("we added a read replica when reports
slowed down checkout").

Likely follow-up questions:

- How many requests per second will this handle, and where is the bottleneck?
- What happens if this component goes down?
- How would the design change at 10 times the traffic?
- Which parts need strong consistency, and which can be eventually consistent?
