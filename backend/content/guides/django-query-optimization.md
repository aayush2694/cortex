## In short

Most slow Django pages are slow because of the database, and most of that comes from a few causes:
**too many queries** (N+1 from following relations in loops), **too much data** (loading every column
and row when you need a few), **missing indexes**, and **work done in Python** that the database could
do. The fixes are `select_related` and `prefetch_related`, `only()`/`defer()`/`values()`, `exists()` and
`count()`, aggregation with `annotate()`, `bulk_create`/`bulk_update`, `F()` expressions, and indexes
checked with `EXPLAIN`. Measure first: count queries and time them before changing anything.

## The idea

The ORM makes database access feel like using Python objects, which hides its cost. `order.customer.name`
looks like reading an attribute but may be a network round trip to the database. A page that loops over
100 orders and prints each customer's name can run 101 queries. Each might take only 1 ms, but together
they add 100 ms, and under load they compete for database connections.

The process is the same every time:

1. **Measure.** Use Django Debug Toolbar or django-silk locally, `connection.queries` in a shell, or
   your APM in production. Look at the number of queries and the slowest ones.
2. **Find the pattern.** Many similar queries means N+1. One slow query means a missing index, a huge
   result or an expensive join.
3. **Fix the cause** with the right tool, and lock it in with a test using `assertNumQueries`.

Choosing the tool:

- **N+1 on a foreign key or one-to-one** → `select_related("customer")`: one JOIN.
- **N+1 on a reverse foreign key or many-to-many** → `prefetch_related("items")`: one extra query for all
  of them, matched in Python. Use `Prefetch("items", queryset=…)` to filter or order the prefetched rows.
- **Wide rows** → `only("id", "title")` or `values_list("id", flat=True)` to fetch fewer columns.
- **Counting or checking** → `qs.count()` and `qs.exists()` instead of `len(qs)` and `if qs:`.
- **Totals per row** → `annotate(n=Count("items"))` lets the database aggregate.
- **Many writes** → `bulk_create`, `bulk_update`, or `queryset.update()` instead of saving in a loop.
- **Slow filter or sort** → an index on the filtered columns, confirmed with `qs.explain()`.

## How it works

An order list page: 50 orders, each showing the customer's name and the number of items.

1. Before: `Order.objects.all()[:50]`, then `order.customer.name` and `order.items.count()` in the
   template. That is 1 + 50 + 50 = **101 queries**.
2. Add `select_related("customer")`: customers come in the same JOIN. Now 51 queries.
3. Replace `order.items.count()` with `annotate(item_count=Count("items"))` and use `order.item_count`:
   the count is computed in the same query. Now **1 query**.
4. The query filters by `status` and sorts by `created_at`. `explain()` shows a sequential scan, so add
   `models.Index(fields=["status", "-created_at"])`. The plan switches to an index scan.
5. Add a test with `self.assertNumQueries(1)` around rendering the page so a future change cannot
   bring the N+1 back unnoticed.

## Code

```python
from django.db.models import Count, F, Prefetch, Q, Sum
from .models import Order, OrderItem

# One query: JOIN for the customer, COUNT computed by the database.
orders = (
    Order.objects
    .filter(status="paid")
    .select_related("customer")
    .annotate(item_count=Count("items"))
    .order_by("-created_at")[:50]
)

# Two queries total: orders, then all their expensive items in one go.
orders_with_items = Order.objects.prefetch_related(
    Prefetch("items", queryset=OrderItem.objects.filter(price__gte=1000), to_attr="big_items")
)

# Fetch only what you need.
ids = list(Order.objects.filter(status="paid").values_list("id", flat=True))
has_refunds = Order.objects.filter(status="refunded").exists()

# Aggregate in SQL, not in Python.
totals = Order.objects.aggregate(
    revenue=Sum("total", filter=Q(status="paid")),
    refunded=Sum("total", filter=Q(status="refunded")),
)

# Write in bulk; update without reading rows into Python.
OrderItem.objects.bulk_create([OrderItem(order_id=1, product_id=p, price=10) for p in range(100)],
                              batch_size=500)
Order.objects.filter(status="paid", created_at__year=2024).update(status="archived")
Order.objects.filter(pk=7).update(views=F("views") + 1)

print(Order.objects.filter(status="paid").explain())   # check the query plan


# In tests: fail if the page ever goes back to N+1.
# with self.assertNumQueries(1):
#     self.client.get("/orders/")
```

## Trade-offs

Every optimization has a cost. `select_related` on many relations creates wide joins; `prefetch_related`
holds related rows in memory; `only()` triggers an extra query if code later touches a deferred field;
indexes speed reads but slow writes and use disk. Caching (per view, per fragment, or with
`cache.get_or_set`) can remove queries entirely but brings invalidation problems. Raw SQL is fine for a
few complex reports, but keep it rare and tested. Optimize the pages that matter, guided by measurements.

## Common mistakes

- **Guessing instead of measuring**, and optimizing pages that were never slow.
- **`select_related` on a many-relation** (it does not work there) or `prefetch_related` then filtering
  the related manager again (`order.items.filter(...)`), which ignores the prefetch.
- **`len(queryset)` or `if queryset:`** just to count or check existence.
- **Saving in a loop** instead of bulk operations.
- **`only()` then touching a deferred field** in a loop, which creates a new N+1.
- **Indexing every column**, which slows inserts and updates.

## In interviews

This is a favourite topic for Django roles, and real numbers impress: "the order page went from 300
queries and 2.1 s to 3 queries and 180 ms after select_related, annotate and one composite index". Expect
to explain N+1, `select_related` versus `prefetch_related`, when QuerySets are evaluated, how to read an
`EXPLAIN` plan at a basic level, and how you stop regressions (`assertNumQueries`).

Likely follow-up questions:

- What is the difference between `select_related` and `prefetch_related`?
- How did you find the slow queries?
- When does adding an index hurt?
- How would you speed up a page that shows aggregated numbers for many rows?
