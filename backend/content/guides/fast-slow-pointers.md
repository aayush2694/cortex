## In short

Fast and slow pointers (also called Floyd's tortoise and hare) move two pointers through a linked
list or sequence at different speeds, usually one step and two steps at a time. If there is a cycle,
the fast pointer eventually laps the slow one and they meet; if there is no cycle, the fast pointer
reaches the end. When the fast pointer reaches the end of a list, the slow one is exactly at the
middle. Both answers take O(n) time and O(1) extra memory, which is the whole point: a hash set
could also detect a cycle, but it would need O(n) memory.

## The idea

Two runners on a circular track, one twice as fast as the other, will always meet again: each lap,
the faster one gains ground until it catches up. On a straight road, the faster runner simply
reaches the finish line first. That is the entire cycle-detection idea.

Why must they meet, and not jump over each other? Once both are inside the loop, the gap between
them shrinks by exactly one node per move (fast moves 2, slow moves 1). A gap that shrinks by one
each step must reach zero, so they land on the same node.

The middle-of-list trick follows from the same speeds: when fast has walked the whole list, slow has
walked half of it.

The pattern also works on things that are not literally linked lists, as long as each value leads to
exactly one next value. "Happy number" repeatedly replaces a number by the sum of the squares of its
digits; either it reaches 1 or it loops forever. "Find the duplicate number" treats each value as a
pointer to an index, which makes the duplicate the entrance of a cycle.

## How it works

Finding where the cycle starts takes two phases.

1. **Meet**: move slow by 1 and fast by 2 until they meet somewhere inside the cycle.
2. **Find the entrance**: put one pointer back at the head and leave the other at the meeting point.
   Move both one step at a time. They meet exactly at the start of the cycle.

Why phase 2 works: say the distance from the head to the cycle start is `a`, and the meeting point is
`b` steps into the cycle, whose length is `c`. Slow has walked `a + b`; fast has walked twice that,
`2(a + b)`, and the extra `a + b` must be a whole number of laps. So `a + b` is a multiple of `c`,
which means walking `a` more steps from the meeting point lands exactly on the cycle start. That is
the same `a` steps the other pointer needs from the head.

For the middle of `1 → 2 → 3 → 4 → 5`: slow goes 1, 2, 3 while fast goes 1, 3, 5. Fast cannot move
again, so the middle is 3. With six nodes the loop condition below returns the second of the two
middles, which is what most problems ask for.

## Code

```python run
from __future__ import annotations

from dataclasses import dataclass


@dataclass(eq=False)
class Node:
    val: int
    next: Node | None = None


def build(values: list[int], cycle_to: int | None = None) -> Node | None:
    nodes = [Node(v) for v in values]
    for a, b in zip(nodes, nodes[1:]):
        a.next = b
    if cycle_to is not None and nodes:
        nodes[-1].next = nodes[cycle_to]
    return nodes[0] if nodes else None


def middle(head: Node | None) -> Node | None:
    slow = fast = head
    while fast and fast.next:
        slow, fast = slow.next, fast.next.next   # type: ignore[union-attr]
    return slow


def cycle_start(head: Node | None) -> Node | None:
    slow = fast = head
    while fast and fast.next:
        slow, fast = slow.next, fast.next.next   # type: ignore[union-attr]
        if slow is fast:                          # phase 1: they met inside the cycle
            slow = head
            while slow is not fast:              # phase 2: walk to the entrance
                slow, fast = slow.next, fast.next  # type: ignore[union-attr]
            return slow
    return None


def is_happy(n: int) -> bool:
    def step(x: int) -> int:
        return sum(int(d) ** 2 for d in str(x))
    slow, fast = n, step(n)
    while fast != 1 and slow != fast:
        slow, fast = step(slow), step(step(fast))
    return fast == 1


assert middle(build([1, 2, 3, 4, 5])).val == 3          # type: ignore[union-attr]
assert middle(build([1, 2, 3, 4, 5, 6])).val == 4       # type: ignore[union-attr]
assert cycle_start(build([3, 2, 0, -4], cycle_to=1)).val == 2  # type: ignore[union-attr]
assert cycle_start(build([1, 2, 3])) is None
assert cycle_start(None) is None
assert is_happy(19) and not is_happy(2)
```

## Common mistakes

- **Checking only `fast.next`** and not `fast`, which crashes on lists with an even number of nodes
  or on an empty list.
- **Comparing values instead of nodes**: two different nodes can hold the same value. Compare
  identity (`is`).
- **Moving both pointers from the meeting point** in phase 2; one must restart at the head.
- **Off-by-one for the middle**: decide whether you want the first or second middle of an even list
  and pick the loop condition that matches.
- **Using a hash set** when the question asks for O(1) extra memory.

## In interviews

Typical problems: linked list cycle (I and II), middle of the linked list, happy number, palindrome
linked list (find the middle, reverse the second half, compare), reorder list, find the duplicate
number. Interviewers care about two things: that you handle the null checks cleanly, and that you
can explain why the pointers must meet and why phase 2 finds the cycle start. Draw the list with its
loop and label the distances `a`, `b`, `c`.

Likely follow-up questions:

- Why can the fast pointer never skip over the slow one?
- How do you find the length of the cycle? (After meeting, walk one pointer around until it returns.)
- How would you check if a linked list is a palindrome in O(1) space?
- Why does "find the duplicate number" turn into cycle detection?
