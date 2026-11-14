## In short

Migrations are Django's version control for your database schema. When you change a model,
`python manage.py makemigrations` compares the models with the state recorded in existing migration
files and writes a new file describing the difference (add a field, create an index, rename a model).
`python manage.py migrate` applies unapplied migrations in dependency order and records each one in the
`django_migrations` table. Migrations are committed to git, reviewed like code, and run on every
environment, so all databases end up with the same schema. Data migrations (`RunPython`) change data,
not just structure.

## The idea

Without migrations, every schema change is a SQL script someone must remember to run on every laptop,
the test database, staging and production, in the right order. Forget one and the code crashes with
"column does not exist". Migrations make schema changes part of the codebase: each change is a file,
files depend on earlier files, and the database remembers which ones it has already applied.

Django builds migrations from a **historical model state**, not from the live database. That is why you
should never change the database schema by hand: Django would not know, and the next generated
migration would be wrong.

Each migration has `dependencies` (usually the previous migration in its app, sometimes another app's
migration for foreign keys) and `operations` (`CreateModel`, `AddField`, `AlterField`, `RenameField`,
`AddIndex`, `RunPython`, `RunSQL`). When two developers create migrations on separate branches, you get
two "leaf" migrations; `makemigrations --merge` creates a merge migration that depends on both.

The hard part is **production safety**. A migration runs against a real database with real traffic,
often while the old version of the code is still serving requests. Some operations lock tables for a
long time on large tables, and some changes break the old code that is still running. Safe schema
changes are done in small, backward-compatible steps.

## How it works

Adding a required `isbn` field to a `Book` table with existing rows:

1. Add `isbn = models.CharField(max_length=13)` to the model and run `makemigrations`. Django asks for a
   default, because existing rows need a value for a NOT NULL column.
2. A safer route on a busy production table is three deploys:
   - Add the field as `null=True`. Deploy. Old code ignores it; new code starts writing it.
   - A data migration (`RunPython`) or a background job fills `isbn` for old rows, in batches.
   - Change the field to `null=False`. Deploy.
3. `python manage.py sqlmigrate books 0005` prints the SQL a migration will run, so you can check for
   expensive operations before it hits production.
4. `python manage.py showmigrations` lists what is applied, and `migrate books 0004` rolls back to an
   earlier migration, if every operation in between is reversible.

Renaming or dropping a column follows the same "expand, then contract" idea: first deploy code that no
longer uses the old column, then remove it in a later migration.

## Code

```python
# books/migrations/0006_fill_isbn.py: a data migration
from django.db import migrations


def fill_isbn(apps, schema_editor):
    # Use the historical model from `apps`, not an import of books.models.Book:
    # the migration must work with the schema as it was at this point in history.
    Book = apps.get_model("books", "Book")
    for book in Book.objects.filter(isbn__isnull=True).iterator(chunk_size=1000):
        book.isbn = f"TMP{book.pk:010d}"
        book.save(update_fields=["isbn"])


class Migration(migrations.Migration):
    dependencies = [("books", "0005_book_isbn")]
    operations = [
        migrations.RunPython(fill_isbn, reverse_code=migrations.RunPython.noop),
    ]
```

```text
python manage.py makemigrations          # write migration files from model changes
python manage.py sqlmigrate books 0006   # show the SQL before running it
python manage.py migrate                 # apply everything not yet applied
python manage.py makemigrations --check  # CI: fail if models and migrations differ
```

## Trade-offs

Auto-generated migrations are fast and accurate for most changes, but they do not know your table sizes
or your deploy process. For large tables, you may need `AddIndex` with PostgreSQL's
`AddIndexConcurrently`, separate schema and data steps, or hand-written `RunSQL`. Squashing old
migrations (`squashmigrations`) speeds up test runs but needs care with data migrations. Alembic, used
with SQLAlchemy and FastAPI, follows the same model; its autogenerate is similar but less complete.

## Common mistakes

- **Importing models directly in a data migration** instead of `apps.get_model`, which breaks once the
  model changes later.
- **Editing or deleting migrations that have already run** on shared databases.
- **Adding a NOT NULL column with a default to a huge table** in one step and locking it.
- **Dropping or renaming a column** while old code still reads it during a rolling deploy.
- **Forgetting `reverse_code`**, which makes the migration impossible to roll back.
- **Not committing migration files**, so other environments never get the change.

## In interviews

Expect: how Django knows which migrations to run, how to resolve conflicting migrations from two
branches, writing a data migration, and above all how to make a schema change on a large production
table with zero downtime. A strong answer walks through expand and contract (add nullable, backfill in
batches, enforce the constraint, remove the old field later) and mentions checking the SQL with
`sqlmigrate` and running `makemigrations --check` in CI.

Likely follow-up questions:

- How would you add a required column to a table with 50 million rows?
- How do you resolve two conflicting migrations?
- Why must data migrations use `apps.get_model`?
- How do you roll back a bad migration?
