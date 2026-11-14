## In short

Advanced Python is about the features that make code lazy, reusable and safe: **generators**
(`yield`) produce values one at a time instead of building whole lists; **decorators** wrap a
function to add behaviour such as caching, timing or access checks; **context managers** (`with`)
guarantee cleanup; **type hints** let tools catch bugs before running; and **async/await** lets one
thread handle many waiting I/O operations. Under them sit a few core ideas: functions are objects,
iteration follows a protocol, and special "dunder" methods (`__iter__`, `__enter__`, `__eq__`) let
your classes plug into the language.

## The idea

**Generators** solve memory. Reading a 10 GB log file into a list would exhaust memory, but a
generator hands out one line at a time and pauses between them. Calling a generator function does not
run its body; it returns an object that runs until the next `yield` each time you ask for a value.
Generator expressions, `(x * x for x in nums)`, are the lazy cousin of list comprehensions.

**Decorators** solve repetition. If many functions need logging, retry or caching, write that once as
a function that takes a function and returns a wrapped one. `@cache` above a function is just
`f = cache(f)`. Use `functools.wraps` so the wrapper keeps the original name and docstring.

**Context managers** solve cleanup. Files, locks, database transactions and network connections must
be released even if an error happens halfway. `with` calls `__enter__` at the start and `__exit__` at
the end, no matter how the block exits. `contextlib.contextmanager` lets you write one as a generator:
setup before `yield`, cleanup after.

**Type hints** (`list[int]`, `str | None`, `Protocol`, `TypedDict`) are ignored at run time but checked
by mypy or pyright, and they make code self-documenting. FastAPI and Pydantic go further and use them
at run time to validate data.

**async/await** solves waiting. A web server spends most of its time waiting for databases and
networks. With `async def` and `await`, a single thread switches to other work while one task waits.
It does not make CPU-heavy code faster.

## How it works

A decorator step by step:

```python
def logged(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        print("calling", func.__name__)
        return func(*args, **kwargs)
    return wrapper

@logged
def add(a, b): return a + b
```

1. Python defines `add`, then immediately runs `add = logged(add)`.
2. `logged` returns `wrapper`, a closure that remembers `func`.
3. Calling `add(2, 3)` actually calls `wrapper(2, 3)`, which prints and then calls the original.
4. `*args, **kwargs` forward any arguments, so the decorator works on any function.

A generator pipeline: `lines = (l for l in open(path))`, `errors = (l for l in lines if "ERROR" in l)`,
`first_10 = itertools.islice(errors, 10)`. Nothing is read until you loop over `first_10`, and then
only as many lines as needed are read.

## Code

```python run
import asyncio
import time
from contextlib import contextmanager
from functools import wraps
from itertools import islice


def fibonacci():
    """Infinite generator: values are produced only when asked for."""
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b


assert list(islice(fibonacci(), 8)) == [0, 1, 1, 2, 3, 5, 8, 13]


def retry(times: int):
    """Decorator factory: @retry(3) re-runs a function that raises."""
    def decorate(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(times):
                try:
                    return func(*args, **kwargs)
                except ConnectionError:
                    if attempt == times - 1:
                        raise
        return wrapper
    return decorate


calls = {"n": 0}

@retry(3)
def flaky() -> str:
    calls["n"] += 1
    if calls["n"] < 3:
        raise ConnectionError
    return "ok"

assert flaky() == "ok" and calls["n"] == 3
assert flaky.__name__ == "flaky"              # @wraps kept the name


@contextmanager
def timer(results: list[float]):
    start = time.perf_counter()
    try:
        yield
    finally:                                  # runs even if the block raises
        results.append(time.perf_counter() - start)


times: list[float] = []
with timer(times):
    sum(range(1000))
assert len(times) == 1


async def fetch(delay: float, value: int) -> int:
    await asyncio.sleep(delay)                # waiting, not working: other tasks run meanwhile
    return value


async def main() -> list[int]:
    return await asyncio.gather(fetch(0.1, 1), fetch(0.1, 2), fetch(0.1, 3))

start = time.perf_counter()
assert asyncio.run(main()) == [1, 2, 3]
assert time.perf_counter() - start < 0.25     # concurrent: about 0.1 s, not 0.3 s
```

## Common mistakes

- **Iterating a generator twice**: it is exhausted after the first pass.
- **Forgetting `@wraps`**, which breaks names, docstrings and tools that inspect functions.
- **Cleanup outside `finally`** in a context manager, so it is skipped on errors.
- **Calling a blocking function** (`time.sleep`, `requests.get`) inside `async` code, which freezes
  every other task. Use async libraries or `asyncio.to_thread`.
- **Forgetting `await`**: calling an `async def` function returns a coroutine object and does nothing.
- **Treating type hints as runtime checks**; plain Python does not enforce them.

## In interviews

Backend interviews ask you to write a simple decorator (timing, retry, cache), explain generators
versus lists and when to use each, write a context manager, and explain the GIL and async versus
threads. Expect "what does `yield` do?", "how does `with` work?", "what is a closure?", "what are
`*args` and `**kwargs`?", and questions about `__eq__`/`__hash__`, `@property`, `@staticmethod`
versus `@classmethod`, and dataclasses.

Likely follow-up questions:

- How would you write a decorator that takes arguments?
- What is the difference between a generator and an iterator?
- When does async/await help, and when does it not?
- What do `__enter__` and `__exit__` receive when an exception happens?
