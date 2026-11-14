## In short

A join combines rows from two tables using a condition, usually a foreign key matching a primary
key (`orders.customer_id = customers.id`). **INNER JOIN** keeps only rows that match on both sides.
**LEFT JOIN** keeps every row from the left table and fills the right side with NULL when nothing
matches. A **self-join** joins a table to itself (employees and their managers). An **anti-join**
finds rows with no match (`LEFT JOIN … WHERE right.id IS NULL`, or `NOT EXISTS`). `RIGHT JOIN` and
`FULL OUTER JOIN` exist too, and `CROSS JOIN` pairs every row with every row.

## The idea

Relational databases split data into tables so each fact is stored once: a customer's email lives in
`customers`, not copied into every order. That avoids inconsistent copies, but it means answering
"which customer placed each order?" requires putting the tables back together. Joins do that.

Think of a join as matching two lists by a shared ID. For each order, look up the customer whose `id`
equals the order's `customer_id`. If the condition matches several rows, you get one output row per
match; that is how one customer with three orders appears three times.

The choice between INNER and LEFT is a question about **missing matches**:

- "Show orders with their customer names" → INNER JOIN: an order without a customer is bad data
  anyway.
- "Show every customer and their order count, including zero" → LEFT JOIN from customers, because
  customers with no orders must still appear.

A frequent trap: putting a condition on the right table in `WHERE` after a LEFT JOIN. Rows with no
match have NULL there, `WHERE` rejects them, and the LEFT JOIN quietly behaves like an INNER JOIN. To
filter the right side while keeping unmatched left rows, put the condition in the `ON` clause.

## How it works

Customers: Asha (1), Ben (2), Chen (3). Orders: #10 by Asha for 50, #11 by Asha for 20, #12 by Ben for
70.

1. `customers INNER JOIN orders ON orders.customer_id = customers.id` gives three rows: Asha #10,
   Asha #11, Ben #12. Chen has no orders, so Chen disappears.
2. `customers LEFT JOIN orders …` gives four rows: the same three, plus Chen with NULL order columns.
3. Adding `WHERE orders.id IS NULL` to the LEFT JOIN keeps only Chen: customers who never ordered.
   That is an **anti-join**.
4. `GROUP BY customers.id` on the LEFT JOIN with `COUNT(orders.id)` gives Asha 2, Ben 1, Chen 0.
   `COUNT(orders.id)` counts only non-NULL values, which is why Chen gets 0 and not 1.

For the self-join, alias the table twice: `employees e JOIN employees m ON e.manager_id = m.id` pairs
each employee with their manager's row.

## Code

```sql run
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  amount INTEGER NOT NULL
);
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, manager_id INTEGER);

INSERT INTO customers VALUES (1, 'Asha'), (2, 'Ben'), (3, 'Chen');
INSERT INTO orders VALUES (10, 1, 50), (11, 1, 20), (12, 2, 70);
INSERT INTO employees VALUES (1, 'Asha', NULL), (2, 'Ben', 1), (3, 'Chen', 1);

-- Every customer with their order count, including customers with none.
SELECT c.name, COUNT(o.id) AS orders, COALESCE(SUM(o.amount), 0) AS spent
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;                     -- Asha 2 70, Ben 1 70, Chen 0 0

-- Anti-join: customers who never ordered.
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;                  -- Chen

-- Same question with NOT EXISTS (safe with NULLs, often the clearest).
SELECT name FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);   -- Chen

-- Filter the right side in ON to keep unmatched left rows.
SELECT c.name, o.amount
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.amount >= 50
ORDER BY c.name;                     -- Asha 50, Ben 70, Chen NULL

-- Self-join: each employee with their manager (LEFT keeps the CEO).
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id
ORDER BY e.id;                       -- Asha NULL, Ben Asha, Chen Asha
```

## Common mistakes

- **Filtering the right table in WHERE after a LEFT JOIN**, which silently drops unmatched rows.
- **`COUNT(*)` with a LEFT JOIN**, which counts the NULL-filled row as 1; use `COUNT(right.id)`.
- **`NOT IN (subquery)`** when the subquery can return NULL: the whole condition becomes unknown and no
  rows come back. Use `NOT EXISTS`.
- **Row explosion**: joining two one-to-many tables at once (orders and payments per customer)
  multiplies rows and inflates sums. Aggregate each side first, then join.
- **Missing join condition**, which produces a cross join of every row with every row.
- **No index on the foreign key column**, which makes joins on large tables slow.

## In interviews

Joins are the most tested SQL topic. Typical tasks: customers who never ordered, employees earning
more than their managers (self-join), each department's employee count including empty departments,
duplicate emails, and "explain INNER versus LEFT JOIN". Be ready to draw small example tables and
show the result rows. Mention indexes on join columns and the row-explosion problem for senior roles.

Likely follow-up questions:

- What is the difference between putting a condition in ON versus WHERE for a LEFT JOIN?
- How would you find rows in A that have no match in B? Give two ways.
- Why can NOT IN return no rows at all?
- How does the database execute a join? (Nested loop, hash join, merge join.)
