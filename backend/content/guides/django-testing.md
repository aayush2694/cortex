## In short

Django's test runner is built on Python's `unittest`, and many teams run it through **pytest** with the
pytest-django plugin. Every test gets a clean database: `TestCase` wraps each test in a transaction that is
rolled back afterwards, which makes tests isolated and fast. The **test client** sends fake requests to
your views without a server; `APIClient` does the same for DRF. Build test data with factories (factory_boy)
or `setUpTestData`, check database load with `assertNumQueries`, and mock only true externals such as
payment providers and email.

## The idea

Tests let you change code without fear. A good suite tells you within minutes whether a change broke
login, checkout or permissions, so you can refactor and upgrade Django with confidence.

Django makes database tests practical. It creates a separate **test database**, runs migrations once, and
then gives each test a clean slate by rolling back its transaction. You get the realism of a real
database without tests leaking data into each other. `TransactionTestCase` truncates tables instead,
which is slower but needed to test code that depends on real commits (for example
`transaction.on_commit` callbacks, though `TestCase.captureOnCommitCallbacks` covers most cases).

A useful mental model is the **testing pyramid**:

- **Many unit tests** for pure logic: price calculations, validators, model methods. Fast and precise.
- **A good number of integration tests** through the test client: a request goes through URLs,
  middleware, views, forms or serializers and the database. They catch wiring mistakes that unit tests
  miss, such as a missing permission check.
- **A few end-to-end tests** in a real browser (Playwright) for the most important user journeys.

Test **behaviour**, not implementation: "an anonymous user is redirected to login", "a seller cannot edit
another seller's product", "the order page runs at most 3 queries". Those tests survive refactoring.

## How it works

Testing that only the owner can edit a book:

1. **Arrange**: create two users and a book owned by the first, ideally with factories so each test sets
   only the fields it cares about.
2. **Act**: log in as the second user with `client.force_login(user)` (skips the password hashing, which
   keeps tests fast) and POST to the edit URL built with `reverse()`.
3. **Assert**: the response is 404 or 403, and reloading the book from the database shows the title is
   unchanged (`book.refresh_from_db()`).
4. Repeat as the owner: expect a redirect and the new title.

For speed: use `setUpTestData` for data shared by every test in a class (created once, rolled back to that
point for each test), a fast password hasher in test settings (`MD5PasswordHasher`, acceptable only in
tests), and `pytest -n auto` (pytest-xdist) to run tests in parallel.

## Code

```python
# books/tests/test_views.py (pytest + pytest-django)
import pytest
from django.urls import reverse

from books.models import Book


@pytest.fixture
def owner(django_user_model):
    return django_user_model.objects.create_user("asha", password="unused")


@pytest.fixture
def book(owner):
    return Book.objects.create(title="Dune", isbn="9780441013593", owner=owner)


@pytest.mark.django_db
def test_anonymous_user_is_sent_to_login(client, book):
    response = client.get(reverse("books:edit", args=[book.pk]))
    assert response.status_code == 302
    assert reverse("login") in response["Location"]


@pytest.mark.django_db
def test_other_user_cannot_edit(client, django_user_model, book):
    other = django_user_model.objects.create_user("ben", password="unused")
    client.force_login(other)
    response = client.post(reverse("books:edit", args=[book.pk]), {"title": "Hacked"})
    assert response.status_code == 404
    book.refresh_from_db()
    assert book.title == "Dune"


@pytest.mark.django_db
def test_list_page_query_count(client, django_assert_max_num_queries, book):
    with django_assert_max_num_queries(3):            # guards against N+1 regressions
        client.get(reverse("books:list"))


def test_send_receipt_calls_provider(mocker):
    send = mocker.patch("books.services.email_client.send")   # mock only the external call
    from books.services import send_receipt
    send_receipt("asha@example.com", order_id=7)
    send.assert_called_once()
```

## Trade-offs

Django's `TestCase` and pytest-django both work well; pytest offers fixtures, parametrization and
better output, and is the common choice in new projects. Tests against a real PostgreSQL catch issues
SQLite misses (constraints, JSON fields, case sensitivity), so CI should use the same database as
production. Mocking makes tests fast but can hide integration bugs; mock at the boundary (HTTP clients,
email, payment) and let your own code run for real. Fixtures in JSON files are brittle; factories are
easier to maintain.

## Common mistakes

- **Testing implementation details** (which private method was called) instead of behaviour.
- **Shared mutable test data** that makes tests pass or fail depending on order.
- **Hitting real external services** from tests, which makes them slow and flaky.
- **Logging in with real password hashing** in every test instead of `force_login`.
- **Only testing the happy path**; permission failures, invalid input and empty states find most bugs.
- **Running tests on SQLite while production uses PostgreSQL.**

## In interviews

Expect: how Django isolates tests (transactions and the test database), `TestCase` versus
`TransactionTestCase`, the test client, factories versus fixtures, what and how much to mock, testing
permissions and query counts, coverage and its limits, and running tests in CI. Mentioning that you test
permission boundaries and N+1 regressions shows real-world maturity.

Likely follow-up questions:

- How does Django keep tests from affecting each other?
- What would you mock in a test for a checkout flow, and what would you not?
- How do you keep a large test suite fast?
- Is 100% coverage a good goal? Why or why not?
