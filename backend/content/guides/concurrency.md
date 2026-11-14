## In short

Concurrency means making progress on several tasks in overlapping time; parallelism means literally
running them at the same moment on different CPU cores. There are three main tools. **Threads**
share memory and suit work that waits on I/O. **Processes** have separate memory and give real
parallelism for CPU-heavy work. An **async event loop** runs many tasks on one thread, switching
whenever a task waits, which scales to thousands of network connections. In CPython the **GIL**
(global interpreter lock) lets only one thread run Python code at a time, so threads speed up waiting
but not computing. Python 3.13 added an optional free-threaded build without the GIL, officially
supported since 3.14, though the standard build still has it.

## The idea

A cook preparing dinner is concurrent: while the rice simmers, they chop vegetables. Nothing happens
faster, but no time is wasted standing by the pot. Two cooks in the kitchen is parallelism: two pairs
of hands working at once.

The first question for any slow program is **what it is waiting for**:

- **I/O-bound** work (HTTP calls, database queries, reading files) spends most of its time waiting.
  Threads or async help a lot, because while one task waits another can run.
- **CPU-bound** work (image processing, number crunching, parsing huge files) keeps the processor busy.
  Only real parallelism helps: multiple processes, or code that releases the GIL, such as NumPy.

Shared memory is both the convenience and the danger of threads. Two threads doing `count += 1` can
interleave their read and write steps and lose updates: a **race condition**. Locks fix that but bring
their own risks: a **deadlock** happens when two threads each hold a lock the other needs. Processes
avoid shared state by default and communicate by passing messages, which is safer but costs more to
start and to send data between.

Async takes a third route: tasks give up control only at `await` points, so between two awaits your
code cannot be interrupted. That removes most race conditions inside one event loop, but one blocking
call (a CPU loop or a non-async library) stalls every task.

## How it works

Fetching 100 URLs that each take 1 second to respond:

1. **Sequentially**: about 100 seconds, almost all spent waiting.
2. **A thread pool of 20**: about 5 seconds. Each thread waits on its own request; the GIL is released
   while waiting on the network.
3. **asyncio with an HTTP client like httpx**: about 1 second if all requests run at once, on a single
   thread. In practice you limit concurrency with a semaphore so you don't overload the server.

Resizing 100 images, each 1 second of pure computation, on an 8-core machine:

1. **Threads**: still about 100 seconds in standard CPython, because only one thread runs Python code
   at a time.
2. **A process pool of 8**: about 13 seconds, since eight processes really run in parallel.

That is the whole decision in two examples: threads or async for waiting, processes for computing.

## Code

```python run
import asyncio
import threading
import time
from concurrent.futures import ThreadPoolExecutor


def slow_io(n: int) -> int:
    time.sleep(0.05)                           # stands in for a network call
    return n * 2


start = time.perf_counter()
with ThreadPoolExecutor(max_workers=10) as pool:
    results = list(pool.map(slow_io, range(10)))
assert results == [n * 2 for n in range(10)]
assert time.perf_counter() - start < 0.4       # overlapping waits, not 10 x 0.05 s in a row


# A race condition and its fix.
counter = 0
lock = threading.Lock()


def increment(times: int) -> None:
    global counter
    for _ in range(times):
        with lock:                             # without the lock, updates can be lost
            counter += 1


threads = [threading.Thread(target=increment, args=(10_000,)) for _ in range(4)]
for t in threads:
    t.start()
for t in threads:
    t.join()
assert counter == 40_000


async def worker(name: str, delay: float, log: list[str]) -> None:
    await asyncio.sleep(delay)                 # yields control to the event loop
    log.append(name)


async def main() -> list[str]:
    log: list[str] = []
    limit = asyncio.Semaphore(2)               # at most two tasks at a time

    async def limited(name: str, delay: float) -> None:
        async with limit:
            await worker(name, delay, log)

    await asyncio.gather(limited("slow", 0.15), limited("fast", 0.01), limited("mid", 0.05))
    return log

assert asyncio.run(main()) == ["fast", "mid", "slow"]
```

In the async example only two tasks may run at once. "slow" and "fast" start together; "mid" waits for
a free slot. "fast" finishes at 0.01 s and frees its slot, so "mid" starts then and finishes at 0.06 s,
still before "slow" at 0.15 s. Finishing order depends on waiting time, not on start order.

## Trade-offs

Threads are easy to add to existing blocking code but need locks around shared data. Processes give
real CPU parallelism and isolation but cost memory, start-up time and serialization of data between
them. Async handles the most simultaneous connections with the least memory, but the whole call chain
must be async, and one blocking call hurts everyone. Web frameworks reflect this: Django and Flask
traditionally use threads or worker processes per request; FastAPI and Node.js are built around an
event loop. Background job queues (Celery, RQ) move slow work out of the request entirely.

## Common mistakes

- **Using threads for CPU-bound Python** and expecting a speed-up.
- **Blocking the event loop** with `time.sleep`, `requests` or heavy computation inside `async def`.
- **Unprotected shared state**: `x += 1` is not atomic across threads.
- **Deadlocks** from taking two locks in different orders in different threads.
- **Unbounded concurrency**: starting 10,000 requests at once can exhaust sockets or get you rate-limited.
- **Forgetting that processes do not share memory**: changing a global in a child process does not
  change the parent's copy.

## In interviews

Backend interviews ask: concurrency versus parallelism, the GIL and what it means for threads, when to
use threading, multiprocessing or asyncio, what a race condition and a deadlock are and how to prevent
them, and how a web server handles many requests at once. You may be asked to make a list of API calls
concurrent with a limit, or to fix a race condition with a lock. Mention real numbers: "these are
I/O-bound, so 20 threads cut 100 seconds to about 5".

Likely follow-up questions:

- Why doesn't threading speed up CPU-bound Python code?
- What is a race condition? How would you prevent one?
- What happens if you call a blocking function in async code?
- How does a single-threaded event loop serve thousands of connections?
