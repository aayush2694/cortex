## In short

In Django, `urls.py` maps URL patterns to **views**, and a view is any callable that takes an
`HttpRequest` and returns an `HttpResponse`. `path("books/<int:pk>/", view, name="book-detail")`
captures parts of the URL with converters (`int`, `str`, `slug`, `uuid`, `path`) and passes them as
arguments. Views come in two styles: **function-based views** (plain functions, explicit and easy to
read) and **class-based views** (classes with a method per HTTP verb, plus generic views such as
`ListView` and `DetailView` that remove boilerplate). Name every URL and build links with `reverse()`
or the `{% url %}` tag instead of hard-coding paths.

## The idea

A URL configuration is a routing table: "requests for this address go to that code". Keeping it
separate from the views means you can change URLs without touching logic, and Django can build URLs
backwards from names. If `book-detail` moves from `/books/42/` to `/library/42/`, every
`reverse("book-detail", args=[42])` follows automatically.

Each app usually has its own `urls.py`, included from the project's root with a prefix:
`path("books/", include("books.urls"))`. Setting `app_name = "books"` in the app's URL module creates a
**namespace**, so names are written `books:detail` and cannot clash with another app's `detail`.

Views are where request handling happens: read the request (method, query string, body, user), do the
work, and return a response. Django gives helpers for the common cases: `render()` for templates,
`redirect()`, `JsonResponse`, `get_object_or_404()`, and decorators like `@login_required` and
`@require_POST`.

**Function or class?** A function-based view is the clearest way to express custom logic: you can read
it top to bottom. Class-based views shine for standard patterns. A `ListView` already knows how to
query, paginate and render a list; you set `model`, `template_name` and `paginate_by` and override only
what differs, such as `get_queryset()`. The cost is indirection: behaviour is spread across mixins and
parent classes, so you need to know the method resolution order to see what runs.

## How it works

For `GET /books/?page=2` handled by a `ListView`:

1. The resolver matches `path("", BookListView.as_view(), name="list")` in `books/urls.py`.
2. `as_view()` creates a function that instantiates the class per request and calls `dispatch()`.
3. `dispatch()` looks at the HTTP method and calls `get()`.
4. `get()` calls `get_queryset()` (by default `Book.objects.all()`, or your override), paginates it
   using `?page=2`, builds the context with `get_context_data()`, and renders the template.
5. A `POST` to the same view returns 405 Method Not Allowed, because `ListView` defines no `post()`.

For forms, the classic flow is **POST/Redirect/GET**: on a valid POST, save and `redirect()` to another
page, so refreshing the browser does not resubmit the form.

## Code

```python
# books/urls.py
from django.urls import path
from . import views

app_name = "books"
urlpatterns = [
    path("", views.BookListView.as_view(), name="list"),
    path("<int:pk>/", views.book_detail, name="detail"),
    path("<int:pk>/borrow/", views.borrow, name="borrow"),
]

# books/views.py
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST
from django.views.generic import ListView
from .models import Book


class BookListView(ListView):
    model = Book
    paginate_by = 20
    template_name = "books/list.html"

    def get_queryset(self):
        qs = super().get_queryset().select_related("author")
        if q := self.request.GET.get("q"):
            qs = qs.filter(title__icontains=q)
        return qs


def book_detail(request, pk: int):
    book = get_object_or_404(Book, pk=pk)
    if request.headers.get("Accept") == "application/json":
        return JsonResponse({"id": book.pk, "title": book.title})
    return render(request, "books/detail.html", {"book": book})


@login_required
@require_POST                                   # state changes only via POST
def borrow(request, pk: int):
    book = get_object_or_404(Book, pk=pk, available=True)
    book.borrow(request.user)
    return redirect("books:detail", pk=pk)      # POST/Redirect/GET
```

## Trade-offs

Function-based views are explicit and easy for newcomers; class-based generic views save code for
standard list, detail and form pages but hide control flow. Many teams use functions for custom logic
and generic classes for plain CRUD pages. For JSON APIs, Django REST Framework's views and viewsets add
serialization, content negotiation and permissions on top of the same ideas.

## Common mistakes

- **Hard-coding URLs** in templates and redirects instead of using names.
- **Changing data on GET requests**; use POST (or PUT/PATCH/DELETE) and protect it with CSRF.
- **Pattern order bugs**: a broad pattern such as `<str:slug>/` placed before `new/` captures it first.
- **Forgetting `.as_view()`** when routing to a class-based view.
- **Overriding `get()` on a generic view** when overriding `get_queryset()` or `get_context_data()`
  was enough.
- **Missing trailing slashes** in patterns, which interacts with `APPEND_SLASH` redirects.

## In interviews

Expect questions on function versus class-based views, how `as_view()` and `dispatch()` work, URL
converters and namespaces, `reverse()`, the POST/Redirect/GET pattern, and restricting views with
decorators or mixins (`LoginRequiredMixin`, `PermissionRequiredMixin`). You may be asked to sketch the
URLs and views for a small CRUD feature, or to explain where you would put validation and business
logic.

Likely follow-up questions:

- When would you choose a class-based view over a function-based view?
- What does `as_view()` return?
- Why should state-changing actions not use GET?
- How do URL namespaces prevent name clashes?
