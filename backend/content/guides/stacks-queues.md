## In short

A **stack** is last in, first out (LIFO): you push onto the top and pop from the top, like a pile of
plates. A **queue** is first in, first out (FIFO): you add at the back and remove from the front,
like a line at a ticket counter. Both do their main operations in O(1). Stacks show up in undo
history, the call stack, matching brackets, expression evaluation and depth-first search. Queues show
up in task scheduling, buffering, and breadth-first search. In Python use a `list` as a stack and
`collections.deque` as a queue.

## The idea

The two structures are defined by **which item comes out next**, not by how they are stored.

A stack remembers things in reverse order of arrival, which is exactly what you need when the most
recent thing must be dealt with first. Your browser's back button is a stack: the page you visited
last is the first one you return to. When a function calls another function, the computer pushes
the caller's state onto the call stack and pops it when the callee returns. Any time a problem has
"open something, then close the most recently opened thing", such as nested brackets or HTML tags,
think stack.

A queue keeps arrival order, which is what fairness and level-by-level processing need. A printer
prints jobs in the order they arrived. Breadth-first search explores everything one step away before
anything two steps away, and a queue gives it that order for free.

A **deque** (double-ended queue) allows O(1) adds and removes at both ends, so it can act as either.
A **priority queue** is a different thing despite the name: it always removes the smallest (or
largest) item, and it is built with a heap, not a plain queue.

## How it works

Valid parentheses: check that `"{[()]}"` is balanced.

1. `{` opens: push. Stack: `{`. Then `[` and `(`: stack `{ [ (`.
2. `)` closes: the top is `(`, which matches, so pop. Then `]` matches `[`, pop. Then `}` matches `{`.
3. The string ended and the stack is empty, so it is balanced. For `"(]"`, the top `(` would not match
   `]`, so it fails immediately. For `"(("`, the stack is not empty at the end, so it fails.

A queue processing tasks: enqueue A, B, C. Dequeue gives A first. Enqueue D. Dequeue gives B. The
order out always matches the order in.

Why not use a Python list as a queue? `list.pop(0)` shifts every remaining item left, so it is O(n).
`deque.popleft()` is O(1). Another classic exercise builds a queue from **two stacks**: push onto an
"in" stack; to dequeue, if the "out" stack is empty, pour everything from "in" into "out" (which
reverses the order), then pop from "out". Each item moves at most twice, so every operation is O(1)
amortized.

## Code

```python run
from collections import deque


def is_valid(s: str) -> bool:
    pairs = {")": "(", "]": "[", "}": "{"}
    stack: list[str] = []
    for ch in s:
        if ch in "([{":
            stack.append(ch)
        elif not stack or stack.pop() != pairs[ch]:
            return False
    return not stack                         # leftovers mean unclosed brackets


def eval_rpn(tokens: list[str]) -> int:
    """Reverse Polish notation, e.g. ["2", "1", "+", "3", "*"] = (2 + 1) * 3."""
    stack: list[int] = []
    for t in tokens:
        if t in "+-*/":
            b, a = stack.pop(), stack.pop()  # order matters for - and /
            stack.append({"+": a + b, "-": a - b, "*": a * b, "/": int(a / b)}[t])
        else:
            stack.append(int(t))
    return stack[0]


class QueueFromStacks:
    def __init__(self) -> None:
        self.inbox: list[int] = []
        self.outbox: list[int] = []

    def push(self, x: int) -> None:
        self.inbox.append(x)

    def pop(self) -> int:
        if not self.outbox:
            while self.inbox:
                self.outbox.append(self.inbox.pop())
        return self.outbox.pop()


assert is_valid("{[()]}") and not is_valid("(]") and not is_valid("((")
assert eval_rpn(["2", "1", "+", "3", "*"]) == 9
assert eval_rpn(["4", "13", "5", "/", "+"]) == 6

q = QueueFromStacks()
for x in (1, 2, 3):
    q.push(x)
assert q.pop() == 1
q.push(4)
assert [q.pop(), q.pop(), q.pop()] == [2, 3, 4]

d = deque([1, 2, 3])
d.appendleft(0)
d.append(4)
assert d.popleft() == 0 and d.pop() == 4
```

## Common mistakes

- **Popping from an empty stack**: check `if not stack` first, especially when the input starts
  with a closing bracket.
- **Forgetting the final emptiness check** in bracket matching.
- **Using `list.pop(0)` as a queue**, which is O(n) per call; use `deque.popleft()`.
- **Operand order** when evaluating expressions: the first pop is the right operand.
- **Confusing a queue with a priority queue**: if you need "smallest first", you need a heap.

## In interviews

Stack problems: valid parentheses, min stack (keep a second stack of running minimums), evaluate
reverse Polish notation, decode string, simplify path, daily temperatures and other "next greater"
questions (monotonic stack). Queue problems: implement a queue with stacks, moving average from a
data stream, number of recent calls, and anything solved with breadth-first search. Interviewers
often ask you to implement one structure using the other, or to add an operation (get the minimum)
in O(1).

Likely follow-up questions:

- How would you get the minimum of a stack in O(1)?
- Why is the two-stack queue O(1) amortized?
- When would you use a deque instead of a list?
- Which traversal uses a stack and which uses a queue?
