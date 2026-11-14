## In short

Django is a "batteries included" Python web framework: it ships with an ORM, migrations, an admin
site, authentication, forms, templates, caching and strong security defaults. A **project** is the
whole site (settings, root URLs, WSGI/ASGI entry points); it contains several **apps**, each a
focused package with its own models, views and URLs. Every request flows through **middleware** to the
**URL resolver**, which picks a **view**; the view uses **models** for data and returns an
**HttpResponse**, often by rendering a **template**. `manage.py` is the command-line tool for running,
migrating and testing it all.

## The idea

Most web apps need the same plumbing: map URLs to code, read and write a database, check who the user
is, validate forms, escape HTML to prevent XSS, protect against CSRF, and give staff a way to edit
data. Django's bet is that you should not rebuild or choose each of those pieces yourself. It gives you
one consistent, well-documented set of tools, so you spend your time on your actual product.

Django follows a pattern it calls **MTV** (Model, Template, View), which is MVC with different names:

- **Model**: Python classes describing your data; the ORM turns them into tables and queries.
- **View**: a function or class that receives a request and returns a response. It holds the logic.
- **Template**: HTML with placeholders, rendered by the view. (For JSON APIs, you return data instead,
  usually through Django REST Framework.)

Apps are Django's unit of organisation. A shop might have `catalog`, `orders` and `accounts` apps.
Each app is listed in `INSTALLED_APPS`, which is how Django discovers its models, admin registrations,
templates and migrations. Keeping apps focused makes a large project easier to navigate and lets you
reuse an app in another project.

**Settings** live in a Python module (`settings.py`). Production values such as `SECRET_KEY`,
`DEBUG`, `ALLOWED_HOSTS` and database credentials should come from environment variables, never from
code committed to git.

## How it works

Follow a request to `GET /books/42/`:

1. The web server (Gunicorn or Uvicorn) passes it to Django's WSGI or ASGI handler, which builds an
   `HttpRequest` object.
2. **Middleware** runs in order on the way in: security headers, sessions, CSRF checks,
   authentication (which attaches `request.user`).
3. The **URL resolver** walks `ROOT_URLCONF`. The pattern `path("books/<int:pk>/", views.book_detail)`
   matches and captures `pk=42`, converted to an integer.
4. The **view** `book_detail(request, pk=42)` runs. It calls `get_object_or_404(Book, pk=pk)`, which
   runs a SQL query or raises a 404.
5. The view calls `render(request, "books/detail.html", {"book": book})`. The template engine fills in
   the HTML, auto-escaping any user data.
6. Middleware runs again in reverse order on the way out, and the response goes back to the client.

You start a project with `django-admin startproject mysite`, add apps with
`python manage.py startapp books`, and run the development server with `python manage.py runserver`.

## Code

```python
# mysite/settings.py (excerpt): secrets from the environment, apps registered.
import os

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = os.environ.get("DJANGO_DEBUG") == "1"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",")
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "books",                                    # our app
]

# mysite/urls.py: the root URL configuration includes each app's URLs.
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("books/", include("books.urls")),
]

# books/views.py
from django.shortcuts import get_object_or_404, render
from .models import Book

def book_detail(request, pk: int):
    book = get_object_or_404(Book, pk=pk)
    return render(request, "books/detail.html", {"book": book})
```

## Trade-offs

Django is a strong fit for data-heavy products with users, forms and an admin: SaaS back offices,
content sites, marketplaces, internal tools. Its conventions make teams productive quickly, and its
security defaults are excellent. The costs: it is opinionated, so fighting its structure is painful; it
is heavier than micro-frameworks; and its async support, while real, is newer than its synchronous
core. FastAPI suits small, typed, async-first JSON APIs; Flask suits small apps where you want to
choose each piece yourself. Many teams use Django plus Django REST Framework for both the admin and a
JSON API from one codebase.

## Common mistakes

- **Committing `SECRET_KEY` or running with `DEBUG = True` in production**, which leaks stack traces
  and settings.
- **Putting everything in one giant app**, or splitting into dozens of tiny apps with circular imports.
- **Business logic in views or templates** instead of in models or a service layer that can be tested.
- **Forgetting to add an app to `INSTALLED_APPS`**, so its models and migrations are ignored.
- **Editing migrations or the database by hand** instead of changing models and generating migrations.

## In interviews

For Python backend roles, expect: "walk me through a request in Django", the role of middleware,
project versus app, MTV versus MVC, how settings should differ per environment, what `manage.py` does,
and how Django protects against CSRF, XSS, SQL injection and clickjacking. Concrete experience counts:
mention apps you split, middleware you wrote, or how you configured settings for staging and production.

Likely follow-up questions:

- What happens between the request arriving and your view running?
- What is middleware, and when would you write your own?
- How do you manage settings for different environments?
- What is the difference between WSGI and ASGI?
