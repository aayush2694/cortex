## In short

Most products should start with a **relational database** (PostgreSQL, MySQL): tables with a schema,
SQL with joins, and **ACID transactions** that keep data correct when many users write at once.
**NoSQL** stores (key-value like Redis or DynamoDB, document like MongoDB, wide-column like Cassandra)
trade query flexibility or strict consistency for a simpler model or easier horizontal scale. An
**index** is a sorted lookup structure, usually a B-tree, that turns full table scans into fast lookups,
at the cost of slower writes and extra storage. **Isolation levels** decide what concurrent transactions
can see.

## The idea

**ACID** describes what a transaction guarantees:

- **Atomicity**: all of its changes happen or none do (no half-transferred money).
- **Consistency**: constraints (foreign keys, uniqueness, checks) hold before and after.
- **Isolation**: concurrent transactions don't see each other's half-done work.
- **Durability**: once committed, data survives a crash (written to a log on disk).

**Indexes** are like a book's index. Without one, finding every row where `email = 'a@x.com'` means
reading the whole table (a sequential scan). A B-tree index keeps the email values sorted with pointers
to rows, so the lookup takes a few page reads, O(log n). A **composite index** on `(user_id, created_at)`
serves queries filtering on `user_id` and sorting by `created_at`, but not queries filtering only on
`created_at`: column order matters (the leftmost-prefix rule). Every index must be updated on each insert
and update, so index what you query, not everything.

**Isolation levels** trade correctness for concurrency. Read Committed (PostgreSQL's default) never shows
uncommitted data, but two reads in one transaction may see different values. Repeatable Read gives a
stable snapshot. Serializable makes transactions behave as if run one at a time, retrying when they
conflict. Many bugs come from "read, then write" logic under Read Committed: two requests both read
stock = 1, both sell it. Fix with `SELECT … FOR UPDATE`, an atomic `UPDATE … SET stock = stock - 1 WHERE
stock > 0`, or a stricter level.

**Normalisation** stores each fact once (customer email lives only in `customers`), which avoids
inconsistent copies. **Denormalisation** copies data deliberately (an order stores the price at purchase
time; a post stores its comment count) to make hot reads cheap, at the cost of keeping copies in sync.

## How it works

A slow query: `SELECT * FROM orders WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 20`.

1. `EXPLAIN ANALYZE` shows a sequential scan over 30 million rows, then a sort: 1.8 seconds.
2. Add `CREATE INDEX CONCURRENTLY orders_customer_created ON orders (customer_id, created_at DESC);`
   (`CONCURRENTLY` avoids locking writes on PostgreSQL).
3. The plan becomes an index scan that reads just the 20 newest rows for that customer: under 1 ms.
4. Selecting only needed columns, or a covering index that includes them, can avoid touching the table
   rows at all.

## Trade-offs

Relational databases give flexible queries, joins, constraints and transactions, and a single
well-tuned PostgreSQL instance handles far more than most products need. Their weak spot is scaling
writes beyond one machine. NoSQL databases scale out more easily and fit specific access patterns (a
key-value cache, a document per user, time series), but push joins, constraints and often consistency
into your application. Choose by **access patterns**: how data is written, read, and how much of it
there is. Many systems use both: PostgreSQL as the source of truth, plus Redis, a search engine or a
warehouse for specific jobs.

## Common mistakes

- **Choosing NoSQL "for scale"** before having a scale problem, then rebuilding joins and transactions
  in code.
- **Missing indexes** on foreign keys and common filters, or **too many** indexes on write-heavy tables.
- **Wrong composite index order** for the queries you run.
- **Read-modify-write races** under the default isolation level.
- **Long transactions** that hold locks while calling external services.
- **Storing money in floats**; use integer cents or `NUMERIC`.

## In interviews

Expect: SQL versus NoSQL for a given design, ACID, how a B-tree index works and when it is not used
(functions on the column, leading wildcards, low selectivity), composite index order, isolation levels
and anomalies (dirty reads, non-repeatable reads, phantoms, lost updates), normalisation, and reading a
query plan. Concrete tuning stories, such as cutting a page's load time by fixing queries and indexes,
are strong evidence.

Likely follow-up questions:

- Why might the database ignore an index you created?
- How would you stop two users buying the last item in stock?
- When would you denormalise?
- Which database would you choose for this design, and why?
