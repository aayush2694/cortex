## In short

Django REST Framework (DRF) is the standard toolkit for building JSON APIs on Django. **Serializers**
convert model instances to JSON and validate incoming JSON back into Python data (like forms for
APIs). **Views** come at three levels: `APIView` (full control), **generic views** such as
`ListCreateAPIView`, and **ViewSets** that bundle list, retrieve, create, update and delete, wired to URLs
by a **router**. DRF adds pluggable **authentication** (session, token, JWT through packages),
**permissions**, **throttling**, **pagination**, filtering, and a browsable API for development.

## The idea

A JSON API repeats the same chores for every resource: parse the request body, validate it, turn model
objects into JSON, choose the right status code, check who is calling and what they may do, paginate long
lists. DRF turns each chore into a reusable, configurable class, so an endpoint is mostly declarations.

The **serializer** is the centre. A `ModelSerializer` reads field definitions from a model, just like a
ModelForm. It works in two directions:

- **Output**: `BookSerializer(book).data` produces a dict ready for JSON.
- **Input**: `BookSerializer(data=request.data)` then `is_valid()` runs field validation,
  `validate_<field>()` and `validate()`, and `save()` calls `create()` or `update()`.

Fields marked `read_only` appear in output but are ignored on input (IDs, timestamps, computed values);
`write_only` fields such as passwords are accepted but never returned. Nested serializers show related
objects, but each nested level can trigger queries, so pair them with `select_related` and
`prefetch_related` in the view's queryset.

**ViewSets and routers** remove routing boilerplate: a `ModelViewSet` plus
`router.register("books", BookViewSet)` creates `GET/POST /books/` and `GET/PUT/PATCH/DELETE
/books/{id}/`. Custom endpoints such as `POST /books/{id}/borrow/` are added with the `@action`
decorator.

**Permissions** run before the handler. `IsAuthenticated` checks the user; custom classes implement
`has_permission` (whole endpoint) and `has_object_permission` (one object, called by `get_object()`). Note
that object permissions are not applied to list endpoints, so lists must also be filtered in
`get_queryset()`.

## How it works

`POST /api/books/` with JSON `{"title": "Dune", "isbn": "9780441013593"}`:

1. The router sends it to `BookViewSet.create()`.
2. **Authentication** classes identify the user from the session or `Authorization` header.
3. **Permission** classes run; an anonymous user gets 401 or 403.
4. **Throttling** checks the rate limit; too many requests get 429.
5. The view builds `BookSerializer(data=request.data)`; `is_valid(raise_exception=True)` returns a 400
   response with per-field errors if validation fails.
6. `perform_create(serializer)` calls `serializer.save(owner=request.user)`, passing values the client must
   not control.
7. The response is the serialized new book with status 201 Created.

## Code

```python
# books/serializers.py
from rest_framework import serializers
from .models import Book


class BookSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.name", read_only=True)

    class Meta:
        model = Book
        fields = ["id", "title", "isbn", "author", "author_name", "owner", "created_at"]
        read_only_fields = ["owner", "created_at"]

    def validate_isbn(self, value: str) -> str:
        if len(value) != 13 or not value.isdigit():
            raise serializers.ValidationError("ISBN must have 13 digits.")
        return value


# books/permissions.py
from rest_framework import permissions


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.method in permissions.SAFE_METHODS or obj.owner == request.user


# books/views.py
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response


class BookViewSet(viewsets.ModelViewSet):
    serializer_class = BookSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        return Book.objects.select_related("author").order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def borrow(self, request, pk=None):
        book = self.get_object()                # runs object permissions
        book.borrow(request.user)
        return Response({"status": "borrowed"})


# urls.py
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register("books", BookViewSet, basename="book")
urlpatterns = router.urls
```

## Trade-offs

DRF is mature, flexible and integrates with Django's ORM, auth and admin, which makes it the default for
APIs inside Django projects. It is heavier and slower than lean alternatives, and deep nesting of
serializers can hide expensive queries. **Django Ninja** offers a FastAPI-like, type-hint-driven style on
Django. **FastAPI** is a separate framework with async-first design and Pydantic validation, a good fit for
new standalone services. Within DRF, use `ModelViewSet` for plain CRUD and `APIView` or generic views when
endpoints don't map cleanly to resources.

## Common mistakes

- **N+1 queries from nested serializers** without `select_related`/`prefetch_related` in `get_queryset`.
- **`fields = "__all__"`**, which exposes and accepts fields that should be hidden or read-only.
- **Relying on object permissions for list endpoints**; filter the queryset by user instead.
- **Setting the owner from request data** instead of `serializer.save(owner=request.user)`.
- **No pagination** on list endpoints, which eventually returns huge responses.
- **Inconsistent error formats**; customise the exception handler once for the whole API.

## In interviews

Expect: serializer versus ModelSerializer, the validation hooks, read-only and write-only fields,
APIView versus generic views versus ViewSets, routers, how authentication, permissions and throttling run,
object-level permissions, pagination styles (page number, limit/offset, cursor), API versioning, and
fixing N+1 queries in serializers. Being able to describe a real API you built with DRF, including how you
secured and optimized it, is the strongest answer.

Likely follow-up questions:

- How do you make sure users only see and edit their own objects?
- What is the difference between `has_permission` and `has_object_permission`?
- How would you find and fix slow serializer queries?
- When would you choose cursor pagination?
