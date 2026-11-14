## In short

SQL (Structured Query Language) asks a relational database for data. You describe **what** you
want, not how to get it, and the database's query planner decides the how. The core of reading data
is `SELECT columns FROM table WHERE condition ORDER BY column LIMIT n`. Two facts prevent most
beginner bugs: the clauses run in a different order than you write them (FROM, WHERE, GROUP BY,
HAVING, SELECT, ORDER BY, LIMIT), and `NULL` means "unknown", so it never equals anything, not even
another `NULL`. The same SQL basics work in PostgreSQL, MySQL, SQLite and SQL Server, with small
dialect differences.

## The idea

A table is like a spreadsheet with strict rules: every row has the same columns, and each column has
one type. A query is a request: "from the `employees` table, give me the name and salary of people in
the Sales department, highest paid first, top five." SQL reads close to that sentence.

Because SQL is **declarative**, you never write loops. The database might scan the whole table or jump
straight to matching rows with an index; your query stays the same either way. That is why the same
query can be fast or slow depending on indexes, and why `EXPLAIN` exists to show the chosen plan.

The **logical order** of a query explains several rules that otherwise seem arbitrary:

1. `FROM` picks the table (and joins).
2. `WHERE` filters individual rows.
3. `GROUP BY` and `HAVING` form and filter groups.
4. `SELECT` computes the output columns and aliases.
5. `ORDER BY` sorts, then `LIMIT`/`OFFSET` cut.

Since `WHERE` runs before `SELECT`, you cannot use a column alias from `SELECT` inside `WHERE`. Since
`ORDER BY` runs after, you can sort by that alias.

**NULL** is SQL's "unknown". Any comparison with it (`= NULL`, `<> NULL`, `> NULL`) is neither true nor
false but unknown, and `WHERE` keeps only rows where the condition is true. So `WHERE manager_id = NULL`
returns nothing; you must write `WHERE manager_id IS NULL`. `COALESCE(x, default)` replaces NULL with a
value.

## How it works

Given an `employees` table, find the three highest-paid people in Engineering:

1. `FROM employees` reads all rows.
2. `WHERE dept = 'Engineering'` keeps only Engineering rows.
3. `SELECT name, salary` keeps two columns.
4. `ORDER BY salary DESC` sorts from highest to lowest; add a tie-breaker such as `name` so equal
   salaries come out in a predictable order.
5. `LIMIT 3` keeps the first three.

Without `ORDER BY`, the database may return rows in any order, and that order can change between runs
or after an update. "Top N" without `ORDER BY` is a bug, even if it seems to work.

Use `DISTINCT` to remove duplicate result rows, `IN (...)` for a list of allowed values, `BETWEEN` for
inclusive ranges, and `LIKE 'A%'` for simple text patterns (`%` matches any run of characters, `_`
matches one).

## Code

```sql run
CREATE TABLE employees (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  dept       TEXT NOT NULL,
  salary     INTEGER NOT NULL,
  manager_id INTEGER,              -- NULL for the CEO
  hired_on   TEXT NOT NULL         -- ISO dates sort correctly as text
);

INSERT INTO employees VALUES
  (1, 'Asha',  'Engineering', 180000, NULL, '2019-04-01'),
  (2, 'Ben',   'Engineering', 120000, 1,    '2021-06-15'),
  (3, 'Chen',  'Engineering', 120000, 1,    '2022-01-10'),
  (4, 'Dana',  'Sales',        90000, 1,    '2020-09-30'),
  (5, 'Eli',   'Sales',        95000, 4,    '2023-03-01');

-- Top 3 in Engineering; name breaks the salary tie.
SELECT name, salary
FROM employees
WHERE dept = 'Engineering'
ORDER BY salary DESC, name
LIMIT 3;                            -- Asha 180000, Ben 120000, Chen 120000

-- NULL needs IS NULL: "= NULL" matches nothing.
SELECT name FROM employees WHERE manager_id = NULL;   -- no rows
SELECT name FROM employees WHERE manager_id IS NULL;  -- Asha

-- An alias can be used in ORDER BY but not in WHERE.
SELECT name, salary / 12 AS monthly
FROM employees
WHERE salary / 12 > 9000
ORDER BY monthly DESC;              -- Asha 15000, Ben 10000, Chen 10000

-- Ranges, lists and patterns.
SELECT name FROM employees
WHERE hired_on BETWEEN '2021-01-01' AND '2022-12-31'
  AND dept IN ('Engineering', 'Sales')
  AND name LIKE '_e%';              -- Ben
```

## Common mistakes

- **`= NULL` instead of `IS NULL`**, and forgetting that `NOT IN` with a NULL in the list returns no rows.
- **Relying on row order** without `ORDER BY`.
- **Using a SELECT alias in WHERE**; repeat the expression or use a subquery.
- **`SELECT *` in application code**: it fetches columns you don't need and breaks when columns change.
- **Building queries by string concatenation** with user input, which allows SQL injection. Always use
  parameters (`WHERE id = %s` / `?` with values passed separately).
- **Comparing dates stored in non-ISO text formats** (`'03/01/2026'`), which sort wrongly.

## In interviews

SQL rounds for backend roles start here: filter, sort, limit, handle NULLs, and explain the logical
order of a query. Expect "find the second highest salary" (handle ties and the case with no second
value), "employees without a manager", and "why does this query return nothing?" (usually `= NULL`).
Also be ready to explain SQL injection and parameterized queries, and what an index does for a `WHERE`
clause.

Likely follow-up questions:

- In what order are the clauses of a query evaluated?
- Why does `WHERE col = NULL` return no rows?
- How would you get the second highest distinct salary?
- How do parameterized queries prevent SQL injection?
