## In short

Python is a dynamically typed, interpreted language that reads almost like pseudocode. The
essentials are: the built-in types (`int`, `float`, `str`, `bool`, `None`, and the containers
`list`, `tuple`, `dict`, `set`), control flow (`if`, `for`, `while`), functions with default and
keyword arguments, comprehensions, exceptions, and modules. Everything is an object, variables are
names that point to objects, and the big standard library ("batteries included") covers most daily
needs before you install anything.

## The idea

Python's design goal is readability. Indentation is part of the syntax, so code that looks nested is
nested. There are few ways to do each thing, and the idiomatic one is usually the shortest:
`for item in items` instead of index loops, `with open(path) as f` instead of manual closing,
comprehensions instead of building lists with `append`.

Two ideas explain most surprises for newcomers:

1. **Names, not boxes.** `a = [1, 2]; b = a` does not copy the list; both names point to the same
   object. Changing it through `b` changes what `a` sees. Assignment never copies; call `list(a)`,
   `a.copy()` or `copy.deepcopy(a)` when you need a copy.
2. **Mutable versus immutable.** Lists, dicts and sets can change in place. Numbers, strings and
   tuples cannot: "changing" a string creates a new one. Only immutable (hashable) values can be dict
   keys or set members.

Two habits make code look like Python rather than translated Java. First, **truthiness**: empty
containers, `0`, `""` and `None` count as false, so `if items:` means "if the list is not empty".
Second, **"easier to ask forgiveness than permission"** (EAFP): instead of checking every condition
before acting (`if key in d: value = d[key]`), Python code often just tries the operation and catches
the specific exception, or uses a helper like `dict.get` that already handles the missing case. It
reads more directly and avoids a race between the check and the action.

Python is dynamically typed: a name can point to any type, and errors appear at run time. Modern
Python adds optional **type hints** (`def area(r: float) -> float`) that tools like mypy check before
running, without changing how the code runs.

## How it works

Follow what happens when this function runs:

```python
def word_counts(text: str, min_len: int = 1) -> dict[str, int]:
    counts: dict[str, int] = {}
    for word in text.lower().split():
        if len(word) >= min_len:
            counts[word] = counts.get(word, 0) + 1
    return counts
```

1. `text.lower()` returns a **new** string (strings are immutable); `.split()` splits on any
   whitespace into a list.
2. The `for` loop iterates directly over the words, no index needed.
3. `counts.get(word, 0)` returns 0 for unseen words instead of raising `KeyError`.
4. `min_len` has a default, so callers may write `word_counts(s)` or `word_counts(s, min_len=3)`.
5. The function returns the dict; without `return` it would return `None`.

The standard library already has this exact tool: `collections.Counter(text.lower().split())`.
Knowing the standard library (`collections`, `itertools`, `functools`, `pathlib`, `datetime`, `json`,
`re`) is a large part of writing good Python.

## Code

```python run
from collections import Counter


# Comprehensions: build containers in one readable expression.
squares = [n * n for n in range(6) if n % 2 == 0]
lengths = {word: len(word) for word in ["ant", "bee", "wasp"]}
assert squares == [0, 4, 16]
assert lengths["wasp"] == 4

# Unpacking and multiple assignment.
first, *rest = [1, 2, 3, 4]
a, b = 1, 2
a, b = b, a                                   # swap without a temp variable
assert (first, rest, a, b) == (1, [2, 3, 4], 2, 1)

# Names point to objects: assignment does not copy.
x = [1, 2]
y = x
y.append(3)
assert x == [1, 2, 3]
z = x.copy()
z.append(4)
assert x == [1, 2, 3]


# The mutable default argument trap, and the fix.
def add_bad(item, bucket=[]):                 # one list shared by every call
    bucket.append(item)
    return bucket


def add_good(item, bucket=None):
    bucket = [] if bucket is None else bucket
    bucket.append(item)
    return bucket


add_bad(1)
assert add_bad(2) == [1, 2]                   # surprise: remembers the earlier call
add_good(1)
assert add_good(2) == [2]

# Exceptions: handle the specific error you expect.
def parse_age(text: str) -> int | None:
    try:
        return int(text)
    except ValueError:
        return None

assert parse_age("42") == 42 and parse_age("forty") is None

# enumerate and zip instead of index loops; Counter for counting.
pairs = [f"{i}:{name}" for i, name in enumerate(["a", "b"], start=1)]
assert pairs == ["1:a", "2:b"]
assert dict(zip(["x", "y"], [1, 2])) == {"x": 1, "y": 2}
assert Counter("banana").most_common(1) == [("a", 3)]
```

## Common mistakes

- **Mutable default arguments** (`def f(x=[])`): the default is created once and shared. Use `None`.
- **Assuming assignment copies** lists or dicts; nested structures also need `deepcopy`.
- **`is` versus `==`**: `is` checks identity. Use `is` only for `None`, `True` and `False`.
- **Modifying a list while iterating over it**, which skips items.
- **Bare `except:`**, which hides real bugs and even catches Ctrl+C. Catch specific exceptions.
- **Integer division confusion**: `7 / 2` is `3.5`; `7 // 2` is `3`.
- **Late binding in closures**: lambdas created in a loop all see the loop variable's final value.

## In interviews

Python is the most common interview language, so fluency matters: comprehensions, slicing,
`enumerate`, `zip`, `sorted` with `key=`, `collections` (`Counter`, `defaultdict`, `deque`), `heapq`,
`bisect`, and knowing the cost of each operation (`in` on a list is O(n), on a set O(1)). Backend
interviews also ask about mutability, how arguments are passed (by object reference), the difference
between lists and tuples, and why the default-argument bug happens.

Likely follow-up questions:

- What is the difference between a list and a tuple, and when would you use each?
- Why can a list not be a dictionary key?
- How are arguments passed to functions in Python?
- What does `if __name__ == "__main__":` do?
