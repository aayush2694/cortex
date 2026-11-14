## In short

Three tools make a Django app feel fast. **Caching** stores expensive results (a query, a rendered
fragment, a whole page) in Redis or Memcached so repeat requests skip the work. **Background jobs**
(Celery, RQ, Dramatiq, or a backend for Django 6.0's new tasks API) move slow work such as emails, reports,
image processing and third-party API calls out of the request, so the user gets a response immediately.
**Async views** (`async def` under an ASGI server) let one process wait on many slow I/O calls at once.
Each solves a different problem: caching avoids repeated work, background jobs avoid waiting for slow
work, and async avoids idle waiting on I/O.

## The idea

When a user clicks "Export my orders", generating a 50,000-row CSV might take 40 seconds. Doing it
inside the request ties up a worker process, risks hitting the server timeout, and leaves the user
staring at a spinner. Instead, the view puts a job on a **queue** and returns "We'll email you when it's
ready". A separate **worker** process picks up the job and does the work. The request takes 50 ms.

The queue lives in a **broker** (Redis or RabbitMQ). Workers can run on other machines and scale
independently of the web servers. Because jobs run later and elsewhere, they must be designed carefully:

- Pass **IDs, not objects**: the row may have changed by the time the job runs.
- Make jobs **idempotent**: brokers deliver "at least once", so a job may run twice. Sending the same
  email twice should be prevented (for example by recording that it was sent).
- **Retry** temporary failures with backoff, but not forever.
- **Enqueue after the transaction commits** (`transaction.on_commit`), or the worker may look for a row
  that does not exist yet.

Caching follows a different rule: it is only safe if you know when the data changes. The usual pattern is
**cache-aside**: read from the cache, and on a miss compute the value, store it with a timeout, and
return it. When the underlying data changes, delete the key (or let it expire if slightly stale data is
acceptable). Django offers per-view caching, template fragment caching, and the low-level `cache` API.

Async views help when a request mostly waits, for example calling three external APIs: with
`asyncio.gather` the three calls overlap. They do not help CPU work, and the ORM's async methods
(`aget`, `acount`, async iteration) still talk to the database through a thread pool internally.

## How it works

The export flow with Celery:

1. The view validates the request, then calls `transaction.on_commit(lambda:
   export_orders.delay(user.id))` and returns 202 Accepted.
2. Celery serializes the call (task name and arguments) and pushes it to Redis.
3. A worker pops it, runs `export_orders(user_id)`, builds the file, stores it (for example in S3), and
   emails a link.
4. If the email provider times out, the task retries with exponential backoff, up to a limit. After that
   it is logged as failed for someone to look at.
5. **Celery beat** schedules recurring jobs, such as a nightly clean-up, from the same codebase.

## Code

```python
# orders/tasks.py
from celery import shared_task
from django.core.cache import cache


@shared_task(bind=True, autoretry_for=(ConnectionError,), retry_backoff=True, max_retries=5)
def export_orders(self, user_id: int) -> None:
    if cache.get(f"export-sent:{self.request.id}"):        # idempotency guard
        return
    path = build_csv_for(user_id)                           # slow work happens here
    send_download_link(user_id, path)
    cache.set(f"export-sent:{self.request.id}", True, timeout=86400)


# orders/views.py
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.cache import cache_page


def start_export(request):
    transaction.on_commit(lambda: export_orders.delay(request.user.id))
    return JsonResponse({"status": "queued"}, status=202)


@cache_page(60)                                             # whole response cached for 60 s
def public_stats(request):
    return JsonResponse(compute_stats())


def product_count(category_id: int) -> int:
    # Cache-aside with the low-level API.
    return cache.get_or_set(
        f"product-count:{category_id}",
        lambda: Product.objects.filter(category_id=category_id).count(),
        timeout=300,
    )


# An async view: three slow API calls overlap instead of running one after another.
import asyncio
import httpx


async def dashboard(request):
    async with httpx.AsyncClient(timeout=5) as client:
        weather, rates, news = await asyncio.gather(
            client.get(WEATHER_URL), client.get(RATES_URL), client.get(NEWS_URL)
        )
    return JsonResponse({"weather": weather.json(), "rates": rates.json(), "news": news.json()})
```

## Trade-offs

Background jobs add infrastructure (a broker, workers, monitoring with Flower or your APM) and make
failures harder to see, but they are the right answer for anything slow or unreliable. For small needs,
simpler options exist, such as RQ. Django 6.0 added a standard tasks API (`@task`, `.enqueue()`), but it
deliberately ships no worker: you still pick a backend package that actually runs the tasks. Caching brings stale
data and invalidation bugs; cache only what is expensive and read often. Async views help I/O-heavy
endpoints but require an ASGI server and async-safe libraries; most Django apps remain mostly synchronous,
with async used where it pays off.

## Common mistakes

- **Passing model instances to tasks** instead of IDs.
- **Enqueuing inside a transaction** before it commits, so the worker cannot find the row.
- **Non-idempotent tasks** that charge a card or send an email twice on retry.
- **Caching per-user data under a shared key**, leaking one user's data to another.
- **No cache invalidation plan**, leading to stale pages after edits.
- **Calling the sync ORM or `requests` inside `async def`** views, which blocks the event loop
  (Django raises `SynchronousOnlyOperation` for the ORM).

## In interviews

Expect: when to move work to a background job, how Celery works (broker, workers, results, beat),
at-least-once delivery and idempotency, retries and dead-letter handling, `on_commit`, cache-aside and
invalidation, cache stampedes, what to cache and for how long, and WSGI versus ASGI with async views.
Concrete stories score well: "we moved PDF generation to Celery and cut p95 response time from 8 s to
200 ms".

Likely follow-up questions:

- What happens if a worker crashes halfway through a task?
- How do you make a task safe to run twice?
- How would you invalidate a cached product page when a price changes?
- When does an async view actually help?
