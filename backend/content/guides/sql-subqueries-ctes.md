## In short

A **subquery** is a query inside another query. It can return one value (a scalar subquery, used like
a number), a list (used with `IN` or `EXISTS`), or a whole table (used in `FROM`). A **correlated**
subquery refers to the current outer row and is logically evaluated once per row. A **CTE** (common
table expression) uses `WITH name AS (…)` to give an intermediate result a name, so a long query reads
as a series of steps. **Recursive CTEs** walk hierarchies like org charts and category trees.

## The idea

Some questions need an answer to another question first. "Which employees earn more than the
average?" needs the average before you can compare. A subquery computes it inline:
`WHERE salary > (SELECT AVG(salary) FROM employees)`.

When the inner question depends on each outer row, the subquery becomes **correlated**. "Employees
who earn more than their own department's average" needs a different average per row:
`WHERE salary > (SELECT AVG(salary) FROM employees e2 WHERE e2.dept = e.dept)`. Logically it runs once
per outer row; good optimizers often rewrite it into a join, but on large tables it can still be slow,
and a join to a pre-aggregated table is a common rewrite.

CTEs exist for readability. Instead of nesting three subqueries inside each other, you write:

```text
WITH dept_avg AS (...),
     high_earners AS (... uses dept_avg ...)
SELECT ... FROM high_earners;
```

Each step has a name and can be read top to bottom, like variables in a program. In PostgreSQL 12 and
later, a CTE referenced once is usually inlined into the main query, so it costs nothing extra; you can
force one behaviour with `MATERIALIZED` or `NOT MATERIALIZED`.

`EXISTS (subquery)` asks "is there at least one matching row?". It can stop at the first match, and it
handles NULLs safely, which makes `NOT EXISTS` the safest way to find rows with no match. `NOT IN`
with a subquery that returns any NULL yields no rows at all, because "x is not in a list containing an
unknown value" is itself unknown.

## How it works

Employees with a manager column. Find everyone below Asha in the org chart with a recursive CTE:

1. The **anchor** part selects Asha herself (level 0).
2. The **recursive** part joins employees whose `manager_id` is an id already in the result, adding 1
   to the level. First Ben and Chen join (level 1), then Dana, who reports to Ben (level 2).
3. Recursion stops when a step adds no new rows.
4. The final `SELECT` reads the accumulated result.

Always make sure a recursive CTE ends: if the data has a cycle (A manages B, B manages A), it would
loop forever. Guard with a depth limit or by tracking visited ids.

## Code

```sql run
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept TEXT, salary INTEGER,
                        manager_id INTEGER);
INSERT INTO employees VALUES
  (1, 'Asha', 'Eng',   200, NULL),
  (2, 'Ben',  'Eng',   120, 1),
  (3, 'Chen', 'Eng',   100, 1),
  (4, 'Dana', 'Sales',  90, 2),
  (5, 'Eli',  'Sales',  70, 4);

-- Scalar subquery: compared with one value.
SELECT name FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees)
ORDER BY name;                         -- Asha, Ben

-- Correlated subquery: above their own department's average.
SELECT name FROM employees e
WHERE salary > (SELECT AVG(salary) FROM employees e2 WHERE e2.dept = e.dept)
ORDER BY name;                         -- Asha, Dana

-- The same with a CTE and a join: each step has a name.
WITH dept_avg AS (
  SELECT dept, AVG(salary) AS avg_salary FROM employees GROUP BY dept
)
SELECT e.name, d.avg_salary
FROM employees e JOIN dept_avg d ON d.dept = e.dept
WHERE e.salary > d.avg_salary
ORDER BY e.name;                       -- Asha 140.0, Dana 80.0

-- EXISTS: people who manage someone.
SELECT name FROM employees m
WHERE EXISTS (SELECT 1 FROM employees e WHERE e.manager_id = m.id)
ORDER BY name;                         -- Asha, Ben, Dana

-- Recursive CTE: everyone under Asha, with their depth.
WITH RECURSIVE reports(id, name, level) AS (
  SELECT id, name, 0 FROM employees WHERE name = 'Asha'
  UNION ALL
  SELECT e.id, e.name, r.level + 1
  FROM employees e JOIN reports r ON e.manager_id = r.id
  WHERE r.level < 10                    -- guard against cycles in bad data
)
SELECT name, level FROM reports ORDER BY level, name;
                                       -- Asha 0, Ben 1, Chen 1, Dana 2, Eli 3
```

## Common mistakes

- **A scalar subquery returning more than one row**, which is an error in PostgreSQL. Aggregate it or
  add a condition that guarantees one row.
- **Forgetting that a scalar subquery with no rows gives NULL**, which then makes comparisons unknown.
- **`NOT IN` with a subquery that can contain NULL**; use `NOT EXISTS`.
- **Slow correlated subqueries** on large tables; rewrite as a join to a grouped CTE and check `EXPLAIN`.
- **Recursive CTEs without an end condition** on data that may contain cycles.
- **Using `UNION` when `UNION ALL` is meant**: `UNION` removes duplicates, which costs a sort or hash.

## In interviews

Typical tasks: employees earning above their department average, the second highest salary
(`SELECT MAX(salary) FROM t WHERE salary < (SELECT MAX(salary) FROM t)`), customers who bought every
product, departments with no employees, and walking a manager hierarchy. Interviewers like to see a
messy nested query refactored into readable CTE steps, and an explanation of correlated versus
uncorrelated subqueries and of `EXISTS` versus `IN`.

Likely follow-up questions:

- What is a correlated subquery, and how might you rewrite it?
- When would you use a CTE instead of a subquery?
- Why is NOT EXISTS safer than NOT IN?
- How does a recursive CTE know when to stop?
