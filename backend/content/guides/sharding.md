## In short

Sharding (horizontal partitioning) splits one big dataset across several databases, each holding a
subset of the rows, so storage and write load are spread over many machines. A **shard key** decides
where each row lives: by **range** (customers A–M on shard 1), by **hash** of the key (even spread, no
order), or through a **directory** that maps keys to shards. A good shard key spreads load evenly and keeps
data that is read together on the same shard. The costs are real: cross-shard queries, joins and
transactions become slow or impossible, and **resharding** live data is hard. Shard only when simpler
options are exhausted.

## The idea

A single database server eventually hits limits: the data no longer fits on its disks, writes exceed what
one machine can handle, or indexes no longer fit in memory. Read replicas do not help with writes (every
replica applies every write). Sharding does: each shard handles only its own slice of writes and data.

Before sharding, use the cheaper steps: better indexes and queries, caching, read replicas, a bigger
machine, archiving old data, and **vertical partitioning** (moving some tables or features to their own
database). Many large products run for years on one well-tuned primary.

Choosing the **shard key** is the decision that matters most:

- It should have **high cardinality** and **even distribution**, so no shard gets most of the traffic.
- Most queries should include it, so they go to **one** shard instead of all of them.
- Data that is used together should share it. For a multi-tenant SaaS, `tenant_id` is often ideal: every
  query is per tenant, and a tenant's data lives on one shard.

**Range sharding** keeps keys in order, so range scans are efficient, but sequential keys (timestamps,
auto-increment IDs) send all new writes to the last shard: a **hot spot**. **Hash sharding** spreads
writes evenly but scatters ranges across all shards. A **directory** (a lookup table from key to shard) is
the most flexible and lets you move individual tenants, but must itself be fast and highly available.

## How it works

Sharding a SaaS app by `tenant_id` into 4 shards with a directory:

1. A small, replicated **directory** table maps each tenant to a shard: tenant 17 → shard 2.
2. Every request already knows its tenant. The app looks up the shard (cached in memory) and uses that
   shard's connection.
3. Queries like "orders for tenant 17" hit one shard. A global report ("revenue across all tenants") must
   **scatter-gather**: query every shard and combine the results, or use a separate analytics warehouse fed
   from all shards.
4. A huge tenant outgrows its shard: copy its data to a new shard, catch up with ongoing changes, briefly
   pause writes for that tenant, switch the directory entry, then resume.
5. Unique IDs can no longer come from one database sequence, so use UUIDs or a distributed ID generator
   (for example Snowflake-style IDs combining a timestamp, a machine ID and a counter).

## Trade-offs

Sharding buys near-unlimited write and storage scale. It costs cross-shard joins and transactions (often
replaced by denormalisation, sagas or accepting eventual consistency), harder operations (backups, schema
migrations and monitoring on every shard), uneven load from a poor key, and painful resharding. Managed
distributed databases (Citus for PostgreSQL, Vitess for MySQL, CockroachDB, Spanner, DynamoDB) hide some
of this work, at a price in cost, flexibility or lock-in.

## Common mistakes

- **Sharding too early**, before trying indexes, caching, replicas and vertical scaling.
- **A shard key with poor distribution** (country, status, a timestamp), creating hot shards.
- **A shard key that most queries don't include**, so every query fans out to every shard.
- **Auto-increment IDs per shard** that collide across shards.
- **No plan for resharding**, so the first rebalance becomes an emergency.
- **Cross-shard transactions** used casually, causing complex failure handling.

## In interviews

Sharding shows up in any design that grows past one database: chat history, social feeds, URL shorteners,
multi-tenant SaaS. Explain when you would shard (and what you would try first), how you choose a shard
key and why, range versus hash versus directory, how queries are routed, what happens to cross-shard
queries and transactions, how you generate unique IDs, and how you would reshard.

Likely follow-up questions:

- Which shard key would you choose here, and what are the risks?
- How do you handle a query that needs data from all shards?
- How would you move data when one shard gets too big?
- How do you generate unique IDs across shards?
