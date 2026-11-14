## In short

A window function computes a value across a set of rows related to the current row, **without
collapsing them** the way `GROUP BY` does. You write `function() OVER (PARTITION BY … ORDER BY …)`.
`PARTITION BY` splits rows into groups that are calculated separately; `ORDER BY` inside `OVER` sets
the order within each group. The common ones: `ROW_NUMBER`, `RANK` and `DENSE_RANK` for rankings,
`LAG` and `LEAD` for the previous and next rows, and `SUM`/`AVG`/`COUNT … OVER` for running totals,
moving averages and shares of a total. They are supported by PostgreSQL, SQLite 3.25+, MySQL 8+ and
SQL Server.

## The idea

`GROUP BY` answers "what is each department's total?" but loses the individual rows. Often you want
both: every employee **and** their department's total, or every sale **and** the running total so far,
or every row **and** its rank within its group. Before window functions that meant self-joins or
correlated subqueries. A window function simply adds a column computed over a "window" of related
rows, and every original row stays in the result.

Read `OVER (PARTITION BY dept ORDER BY salary DESC)` as: "split rows by department; inside each
department, line them up by salary, highest first; now compute the function for each row in that
lineup."

The three ranking functions differ only in how they treat ties:

- `ROW_NUMBER()`: 1, 2, 3, 4. Always unique; ties are broken arbitrarily unless you add a tie-breaker.
- `RANK()`: 1, 2, 2, 4. Ties share a rank, then a gap.
- `DENSE_RANK()`: 1, 2, 2, 3. Ties share a rank, no gap.

For aggregates with `ORDER BY` inside `OVER`, the default **frame** is "from the start of the partition
up to the current row" (including rows tied with it), which is what makes `SUM(x) OVER (ORDER BY day)` a
running total. You can set the frame explicitly, for example `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW`
for a 3-day moving average.

Window functions are computed after `WHERE`, `GROUP BY` and `HAVING`, so you cannot filter on them in
`WHERE`. Wrap the query in a CTE or subquery and filter outside: that is the standard "top N per group"
pattern.

## How it works

Daily revenue: day 1 = 100, day 2 = 150, day 3 = 120, day 4 = 200.

1. `SUM(revenue) OVER (ORDER BY day)` gives the running total: 100, 250, 370, 570.
2. `LAG(revenue) OVER (ORDER BY day)` gives the previous day's value: NULL, 100, 150, 120. Subtracting
   it gives the day-over-day change: NULL, +50, −30, +80.
3. `AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)` gives a 2-day moving
   average: 100, 125, 135, 160.

Top 2 earners per department: number rows with `ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary
DESC)` in a CTE, then keep rows where the number is 1 or 2. Use `DENSE_RANK` instead if tied salaries
should all be included.

## Code

```sql run
CREATE TABLE employees (name TEXT, dept TEXT, salary INTEGER);
INSERT INTO employees VALUES
  ('Asha', 'Eng', 200), ('Ben', 'Eng', 150), ('Chen', 'Eng', 150), ('Dev', 'Eng', 100),
  ('Dana', 'Sales', 90), ('Eli', 'Sales', 70);

CREATE TABLE revenue (day INTEGER, amount INTEGER);
INSERT INTO revenue VALUES (1, 100), (2, 150), (3, 120), (4, 200);

-- Rankings within each department; every row is kept.
SELECT name, dept, salary,
       ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC, name) AS row_num,
       RANK()       OVER w AS rnk,
       DENSE_RANK() OVER w AS dense
FROM employees
WINDOW w AS (PARTITION BY dept ORDER BY salary DESC)
ORDER BY dept, salary DESC, name;
-- Eng: Asha 1 1 1, Ben 2 2 2, Chen 3 2 2, Dev 4 4 3; Sales: Dana 1 1 1, Eli 2 2 2

-- Top 2 per department: filter the window result in an outer query.
WITH ranked AS (
  SELECT name, dept,
         ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC, name) AS rn
  FROM employees
)
SELECT dept, name FROM ranked WHERE rn <= 2 ORDER BY dept, rn;
                                -- Eng Asha, Eng Ben, Sales Dana, Sales Eli

-- Running total, change from the previous day, 2-day moving average.
SELECT day, amount,
       SUM(amount) OVER (ORDER BY day)       AS running_total,
       amount - LAG(amount) OVER (ORDER BY day) AS change,
       AVG(amount) OVER (ORDER BY day ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS moving_avg
FROM revenue
ORDER BY day;
-- 1 100 100 NULL 100.0, 2 150 250 50 125.0, 3 120 370 -30 135.0, 4 200 570 80 160.0

-- Share of the department total, next to each row.
SELECT name, dept, ROUND(100.0 * salary / SUM(salary) OVER (PARTITION BY dept), 1) AS pct
FROM employees
ORDER BY dept, name;
-- Asha 33.3, Ben 25.0, Chen 25.0, Dev 16.7, Dana 56.3, Eli 43.8
```

Notice that in the ranking query Ben and Chen tie at 150. `RANK` and `DENSE_RANK` order by salary
only, so both give them 2. `ROW_NUMBER` must break the tie, so its own window adds `name` to make the
result predictable. Adding `name` to the shared window would have broken the tie for all three
functions, and `RANK` would no longer show the tie.

## Common mistakes

- **Filtering on a window function in WHERE**; filter in an outer query or CTE.
- **`ROW_NUMBER` without a tie-breaker**, which makes results change between runs.
- **Picking the wrong ranking function** for ties ("top 3 salaries" usually means `DENSE_RANK`).
- **Forgetting the default frame**: with `ORDER BY`, `SUM … OVER` is a running total, not the partition
  total; drop `ORDER BY` (or use an explicit frame) for the full total.
- **Using `RANGE` frames with duplicate order values** and getting surprising running totals, since tied
  rows are included together; use `ROWS` when you mean physical rows.
- **Expecting `LAG` to skip gaps in dates**: it reads the previous row, not the previous calendar day.

## In interviews

Window functions separate strong SQL candidates from average ones. Typical tasks: top N per group,
the Nth highest salary (`DENSE_RANK`), running totals, month-over-month growth (`LAG`), consecutive
login streaks (the "gaps and islands" trick: `day - ROW_NUMBER()` is constant within a streak),
removing duplicates while keeping the newest row, and each row's share of its group. Explain the
difference between window functions and `GROUP BY`, and the three ranking functions with a tie example.

Likely follow-up questions:

- What is the difference between ROW_NUMBER, RANK and DENSE_RANK?
- Why can't you use a window function in WHERE?
- How would you compute a 7-day moving average?
- How would you find users who logged in on 3 consecutive days?
