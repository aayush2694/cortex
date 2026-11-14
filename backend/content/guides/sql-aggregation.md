## In short

Aggregation collapses many rows into summary values. Aggregate functions (`COUNT`, `SUM`, `AVG`,
`MIN`, `MAX`) work over a set of rows; `GROUP BY` splits rows into groups and produces **one output
row per group**. `WHERE` filters rows **before** grouping, `HAVING` filters groups **after**. Every
column in the `SELECT` list must either be in `GROUP BY` or wrapped in an aggregate. Aggregates skip
NULLs (except `COUNT(*)`, which counts rows), which changes averages and counts in ways that surprise
people.

## The idea

Imagine a pile of receipts. "Total spent" is an aggregate over the whole pile. "Total spent per
shop" means sorting the receipts into one pile per shop, then totalling each pile. `GROUP BY shop` is
the sorting into piles; `SUM(amount)` is the totalling.

Once rows are grouped, individual rows are gone from the output: each group is one row. That is why
selecting a non-grouped column is an error in PostgreSQL and most databases. If you group by shop and
ask for `receipt_date`, which of the pile's many dates should appear? (MySQL in older modes and SQLite
will pick one arbitrarily instead of failing, which hides bugs.)

The WHERE/HAVING split follows from the order in which a query runs: `FROM` → `WHERE` → `GROUP BY` →
`HAVING` → `SELECT` → `ORDER BY`. `WHERE` cannot see `SUM(amount)` because the sums do not exist yet;
`HAVING` runs after grouping, so it can. Filtering rows early with `WHERE` is also faster, because
fewer rows reach the grouping step.

NULL handling is worth memorising:

- `COUNT(*)` counts rows; `COUNT(col)` counts rows where `col` is not NULL; `COUNT(DISTINCT col)` counts
  different non-NULL values.
- `SUM`, `AVG`, `MIN` and `MAX` ignore NULLs. `AVG` of 10 and NULL is 10, not 5. If NULL should mean
  zero, write `AVG(COALESCE(col, 0))`.
- The `SUM` of no rows (or only NULLs) is NULL, not 0. Wrap it in `COALESCE(SUM(x), 0)` when you need a
  number.

## How it works

Sales rows: (North, Asha, 100), (North, Ben, 300), (South, Chen, 200), (South, Chen, NULL),
(East, Dana, 50).

Query: total and average per region, only regions with total above 150, largest first.

1. `WHERE` is absent, so all five rows go to grouping.
2. `GROUP BY region` makes three piles: North (100, 300), South (200, NULL), East (50).
3. Aggregates per pile: North sum 400, avg 200; South sum 200, avg 200 (the NULL is skipped), count of
   amounts 1 but `COUNT(*)` 2; East sum 50.
4. `HAVING SUM(amount) > 150` drops East.
5. `ORDER BY total DESC` gives North 400, then South 200.

Conditional aggregation answers several questions in one pass: `SUM(CASE WHEN status = 'paid' THEN
amount ELSE 0 END)` totals only paid orders while the same query also totals everything. PostgreSQL
also supports the tidier `SUM(amount) FILTER (WHERE status = 'paid')`.

## Code

```sql run
CREATE TABLE sales (region TEXT, rep TEXT, amount INTEGER, status TEXT);
INSERT INTO sales VALUES
  ('North', 'Asha', 100, 'paid'),
  ('North', 'Ben',  300, 'refunded'),
  ('South', 'Chen', 200, 'paid'),
  ('South', 'Chen', NULL, 'pending'),
  ('East',  'Dana',  50, 'paid');

-- One row per region; HAVING filters groups after aggregation.
SELECT region,
       COUNT(*)      AS row_count,
       COUNT(amount) AS amounts,
       SUM(amount)   AS total,
       AVG(amount)   AS average
FROM sales
GROUP BY region
HAVING SUM(amount) > 150
ORDER BY total DESC;            -- North 2 2 400 200.0, South 2 1 200 200.0

-- WHERE filters rows before grouping: only paid sales are counted.
SELECT region, SUM(amount) AS paid_total
FROM sales
WHERE status = 'paid'
GROUP BY region
ORDER BY region;                -- East 50, North 100, South 200

-- Conditional aggregation: several totals in one pass.
SELECT SUM(amount) AS everything,
       SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid,
       COUNT(DISTINCT rep) AS reps
FROM sales;                     -- 650 350 4

-- SUM over no rows is NULL; COALESCE turns it into 0.
SELECT COALESCE(SUM(amount), 0) FROM sales WHERE region = 'West';   -- 0

-- Duplicates: values that appear more than once.
SELECT rep, COUNT(*) AS n FROM sales GROUP BY rep HAVING COUNT(*) > 1;   -- Chen 2
```

## Common mistakes

- **Selecting a column that is neither grouped nor aggregated.**
- **Putting aggregate conditions in WHERE** (`WHERE SUM(x) > 10` is an error); use HAVING.
- **Using HAVING for row filters** that belong in WHERE, which works but groups more rows than needed.
- **`COUNT(*)` after a LEFT JOIN**, which counts the NULL-filled row; count a column from the right table.
- **Averages that skip NULLs** when NULL should mean zero.
- **Integer division**: in PostgreSQL and SQLite `SUM(int) / COUNT(*)` is integer division. Cast first
  (`SUM(x) * 1.0 / COUNT(*)`) or use `AVG`.

## In interviews

Typical tasks: count orders per customer, departments with more than five employees, find duplicate
emails, total revenue per month, the category with the highest sales, and percentages of a total
(conditional aggregation or a window function). Explain WHERE versus HAVING using the query order,
and mention how NULLs affect `COUNT` and `AVG`. For "per month", group by a truncated date
(`date_trunc('month', created_at)` in PostgreSQL, `strftime('%Y-%m', created_at)` in SQLite).

Likely follow-up questions:

- What is the difference between WHERE and HAVING?
- What is the difference between COUNT(*), COUNT(col) and COUNT(DISTINCT col)?
- How would you find duplicate rows?
- How would you show each group's share of the total? (A window function: `SUM(x) OVER ()`.)
