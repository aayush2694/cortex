## In short

A recursive function solves a problem by calling itself on a smaller version of the same problem,
until it reaches a **base case** small enough to answer directly. Every call waits on the **call
stack** until the smaller call returns, so recursion uses memory proportional to its depth. It is
the natural fit for trees, nested structures, divide and conquer (merge sort, quick sort) and
backtracking. Python limits depth to about 1,000 calls by default.

## The idea

Imagine standing in a long queue and wanting to know your position. You ask the person in front of
you, "what's your position?" They ask the person in front of them, and so on, until the first person
says "1". Each answer comes back one step at a time: "2", "3"... until it reaches you. Nobody needed
to see the whole queue; each person only did one small step and trusted the answer from in front.

That trust is the key to writing recursion. You do not trace every call in your head. You assume
the function already works for smaller inputs (sometimes called the "leap of faith") and only
answer two questions:

1. **Base case**: what is the smallest input, and what is its answer?
2. **Recursive step**: how do I build the answer for this input from the answer to a smaller one?

If every call moves closer to a base case, the recursion ends. If not, it runs until the stack
overflows.

Some languages optimise **tail calls** (a recursive call that is the very last thing a function does),
so deep tail recursion uses no extra stack. Python deliberately does not, which is why deep recursion in
Python needs a loop instead, even when the recursive version looks cleaner.

## How it works

Take `factorial(3)`, where `factorial(n) = n × factorial(n - 1)` and `factorial(0) = 1`.

1. `factorial(3)` needs `factorial(2)`, so it pauses. Its frame (with `n = 3`) stays on the stack.
2. `factorial(2)` pauses on `factorial(1)`, which pauses on `factorial(0)`.
3. `factorial(0)` hits the base case and returns 1. The stack now **unwinds**:
   `factorial(1)` returns 1 × 1 = 1, `factorial(2)` returns 2 × 1 = 2, `factorial(3)` returns 3 × 2 = 6.

At the deepest point four frames were on the stack, so the space cost is O(n).

Some functions call themselves more than once. Naive Fibonacci, `fib(n) = fib(n-1) + fib(n-2)`,
forms a tree of calls that roughly doubles at each level, so it is about O(2ⁿ). Many of those calls
repeat the same work: `fib(3)` is computed again and again. Caching results (**memoization**) turns
it into O(n), and that idea is the doorway to dynamic programming.

Any recursion can be rewritten with a loop and your own stack. That is worth doing when the depth
can be large, because the language's stack is limited.

## Code

```python run
from functools import cache


def total(nested: list) -> int:
    """Sum numbers in arbitrarily nested lists: a natural recursive shape."""
    result = 0
    for item in nested:
        if isinstance(item, list):
            result += total(item)       # trust it works for the smaller list
        else:
            result += item
    return result


@cache
def fib(n: int) -> int:
    """Memoized: each n is computed once, so O(n) instead of O(2^n)."""
    if n < 2:                           # base cases: fib(0) = 0, fib(1) = 1
        return n
    return fib(n - 1) + fib(n - 2)


def power(base: float, exp: int) -> float:
    """Fast power by halving: O(log exp) calls."""
    if exp == 0:
        return 1
    half = power(base, exp // 2)
    return half * half if exp % 2 == 0 else half * half * base


assert total([1, [2, [3, 4]], [], 5]) == 15
assert fib(50) == 12586269025
assert power(2, 10) == 1024
```

## Common mistakes

- **Missing or wrong base case**, which causes infinite recursion and a `RecursionError`.
- **Not shrinking the input**: calling `f(n)` from `f(n)`, or slicing in a way that never gets
  smaller.
- **Exponential repeats**: two recursive calls on overlapping inputs without a cache.
- **Ignoring stack depth**: recursion over a 100,000-node linked list or a skewed tree will hit
  Python's limit. Use iteration, or raise the limit only when you know the depth is bounded.
- **Expensive arguments**: passing `nums[1:]` copies the list on every call, turning O(n) into
  O(n²). Pass an index instead.
- **Forgetting to return** the recursive call's result.

## In interviews

Recursion appears directly (reverse a linked list recursively, generate all subsets, flatten nested
lists) and underneath many patterns: tree DFS, backtracking, divide and conquer, memoized DP. State
the base case first, then the recursive step, then the time (number of calls × work per call) and
space (maximum depth). If the depth might be large, mention the iterative version.

Likely follow-up questions:

- What happens on the call stack when this runs?
- What is the space complexity, and why is it not O(1)?
- How would you remove the repeated work? (Memoization.)
- Can you write it iteratively?
