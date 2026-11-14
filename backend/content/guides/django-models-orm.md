## In short

A Django **model** is a Python class that describes one database table: each attribute is a column,
each instance is a row. The **ORM** (object-relational mapper) turns Python calls such as
`Book.objects.filter(year__gte=2020)` into SQL and turns the rows that come back into objects. You
get one place to define your data, migrations generated from it, and queries that work on
PostgreSQL, MySQL or SQLite. The price is that you must know which SQL your code produces, or you
will write slow pages without noticing.

## The idea

Without an ORM every feature needs hand-written SQL strings, manual conversion of rows to objects,
and care to avoid SQL injection. Django lets you describe the data once, as classes, and then ask
questions in Python. Relationships become attributes: `book.author` follows a foreign key,
`author.book_set.all()` goes the other way.

The key mental model is the **QuerySet**. `Book.objects.filter(...)` does not touch the database. It
builds a description of a query. You can keep chaining `.filter()`, `.exclude()`, `.order_by()` and
it is still just a description. The SQL runs only when you need results: when you loop over it,
call `list()`, `len()`, slice it with a step, or check it in an `if`. This laziness is what lets you
build queries in pieces, and it is also why one innocent-looking loop can run hundreds of queries.

## How it works

Take a small library app. An author writes many books; each book belongs to one author.

1. You declare `Author` and `Book` classes in `models.py`, with a `ForeignKey` from `Book` to
   `Author`.
2. `python manage.py makemigrations` compares your classes with the last migration and writes a new
   migration file. `migrate` runs it and creates the tables, including an index on the foreign key.
3. In a view you write `Book.objects.filter(author__name="Le Guin").order_by("-year")`. The double
   underscore follows the relationship, so Django adds a JOIN to the author table and a `WHERE`
   on its `name` column.
4. When the template loops over the result, Django runs one `SELECT`, builds a `Book` object per
   row and caches the list on the QuerySet, so looping again does not query again.
5. Inside that loop, `book.author.name` is a problem: each access to `book.author` runs another
   query, because the author was not loaded. Ten books mean eleven queries. This is the **N+1
   problem**, and `select_related("author")` fixes it by loading authors in the same JOIN.

## Code

```python
from django.db import models
from django.db.models import Count, F, Q


class Author(models.Model):
    name = models.CharField(max_length=200, unique=True)


class Book(models.Model):
    author = models.ForeignKey(Author, on_delete=models.CASCADE, related_name="books")
    title = models.CharField(max_length=300)
    year = models.PositiveIntegerField()
    stock = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=["year"])]
        ordering = ["title"]


# One query with a JOIN instead of 1 + N queries.
recent = Book.objects.filter(year__gte=2020).select_related("author")

# Many-side relations: one extra query for all books, not one per author.
authors = Author.objects.prefetch_related("books")

# OR conditions and comparisons between columns.
Book.objects.filter(Q(year__lt=1950) | Q(stock=0))

# Update in the database without reading rows first (no race between read and write).
Book.objects.filter(pk=7).update(stock=F("stock") - 1)

# Aggregate in SQL instead of counting in Python.
Author.objects.annotate(n_books=Count("books")).filter(n_books__gte=3)
```

`select_related` follows foreign keys and one-to-one fields with a JOIN. `prefetch_related` handles
the "many" side (reverse foreign keys, many-to-many) with a second query and joins the results in
Python.

## Trade-offs

Use the ORM for almost all everyday work: it is safe against SQL injection by default, readable,
portable across databases and integrated with migrations, forms, the admin and Django REST
Framework serializers.

Reach for something else when the ORM gets in the way. Complex reports with window functions or
recursive queries can be clearer with `raw()` or a database view. Bulk loads of millions of rows are
faster with `bulk_create` in batches or PostgreSQL's `COPY`. Compared with SQLAlchemy, Django's ORM
is simpler and tied to Django; SQLAlchemy gives finer control over SQL and works outside any web
framework.

## Common mistakes

- **N+1 queries** from accessing relations in a loop. Use `select_related` or `prefetch_related`,
  and watch query counts with Django Debug Toolbar or `assertNumQueries` in tests.
- **Counting with `len(qs)`** loads every row. Use `qs.count()`, or `qs.exists()` for "is there
  any".
- **Read-modify-write races**: `book.stock -= 1; book.save()` loses updates under concurrency. Use
  `F()` expressions or `select_for_update()` inside `transaction.atomic()`.
- **Expecting `update()` or `bulk_create()` to call `save()`**: they skip custom `save()` methods
  and signals.
- **`get()` without handling errors**: it raises `DoesNotExist` or `MultipleObjectsReturned`. Use
  `get_object_or_404` in views.
- **Forgetting indexes** on columns you filter or sort by often.

## In interviews

Expect "what is the N+1 problem and how do you fix it in Django?", "difference between
`select_related` and `prefetch_related`", "when is a QuerySet evaluated?" and "how do you avoid race
conditions when updating a counter?". A strong answer names the SQL each call produces and mentions
how you would measure it, not just the method names. If you have tuned a slow page, describe the
query count before and after.

Likely follow-up questions:

- How would you see the SQL a QuerySet runs? (`str(qs.query)`, `connection.queries`, Debug Toolbar.)
- What do `only()` and `defer()` do, and when do they help?
- What happens to related rows when you delete an author with `on_delete=CASCADE`?
- When would you drop down to raw SQL?
