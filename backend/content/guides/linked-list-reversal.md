## In short

In-place reversal flips the direction of a linked list's `next` pointers by walking it once with
three pointers: `prev`, `curr` and `next`. It takes O(n) time and O(1) extra memory, because it only
re-points existing links instead of creating new nodes. The same move, applied to a section of the
list, solves "reverse between positions m and n", "swap nodes in pairs", "reverse in groups of k",
and the second half of "palindrome linked list" and "reorder list".

## The idea

Picture people in a line, each with a hand on the shoulder of the person in front. To reverse the
line without anyone leaving their spot, go along it and have each person switch their hand to the
person **behind** them instead. The danger is the moment of switching: once a person lets go of the
shoulder in front, you must already remember who that was, or the rest of the line is lost.

That is exactly why the algorithm uses three pointers:

- `curr` is the node being re-pointed.
- `prev` is the node it should now point to (the already reversed part).
- `next` saves `curr.next` before it is overwritten, so we can continue.

At every step the list is split into two clean pieces: a reversed part starting at `prev`, and the
untouched rest starting at `curr`. When `curr` becomes `None`, everything is reversed and `prev` is the
new head.

Reversing a **section** needs two extra references: the node just before the section (so it can be
connected to the new section head) and the first node of the section (which becomes the section's
tail and must connect to whatever comes after). A dummy node in front of the head removes the special
case where the section starts at the head.

## How it works

Reverse `1 → 2 → 3`.

1. Start: `prev = None`, `curr = 1`.
2. Save `next = 2`. Point `1 → None`. Move: `prev = 1`, `curr = 2`.
3. Save `next = 3`. Point `2 → 1`. Move: `prev = 2`, `curr = 3`.
4. Save `next = None`. Point `3 → 2`. Move: `prev = 3`, `curr = None`.
5. Stop. The new head is `prev`: `3 → 2 → 1 → None`.

Reverse positions 2 to 4 in `1 → 2 → 3 → 4 → 5`:

1. Walk a pointer `before` to node 1 (position 1, just before the section).
2. Reverse three nodes starting at 2 with the same loop; you get `4 → 3 → 2`, and `curr` ends on 5.
3. Reconnect: `before.next = 4` and node 2 (the old section head, now its tail) points to 5.
   Result: `1 → 4 → 3 → 2 → 5`.

Reverse in groups of k repeats that reconnect step for each full group of k nodes, leaving a final
group shorter than k as it is.

## Code

```python run
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Node:
    val: int
    next: Node | None = None


def build(values: list[int]) -> Node | None:
    head = None
    for v in reversed(values):
        head = Node(v, head)
    return head


def to_list(head: Node | None) -> list[int]:
    out = []
    while head:
        out.append(head.val)
        head = head.next
    return out


def reverse(head: Node | None) -> Node | None:
    prev, curr = None, head
    while curr:
        nxt = curr.next          # save before overwriting
        curr.next = prev         # flip the link
        prev, curr = curr, nxt   # move both forward
    return prev


def reverse_between(head: Node | None, left: int, right: int) -> Node | None:
    dummy = Node(0, head)
    before = dummy
    for _ in range(left - 1):
        before = before.next     # type: ignore[assignment]
    section_tail = curr = before.next
    prev = None
    for _ in range(right - left + 1):
        nxt = curr.next          # type: ignore[union-attr]
        curr.next = prev         # type: ignore[union-attr]
        prev, curr = curr, nxt
    before.next = prev           # connect to the new section head
    section_tail.next = curr     # type: ignore[union-attr]
    return dummy.next


assert to_list(reverse(build([1, 2, 3]))) == [3, 2, 1]
assert to_list(reverse(None)) == []
assert to_list(reverse_between(build([1, 2, 3, 4, 5]), 2, 4)) == [1, 4, 3, 2, 5]
assert to_list(reverse_between(build([1, 2]), 1, 2)) == [2, 1]
```

## Common mistakes

- **Overwriting `curr.next` before saving it**, which loses the rest of the list.
- **Returning `head` instead of `prev`**: after reversal the old head is the tail.
- **Forgetting to reconnect both ends** of a reversed section.
- **Special-casing the head** instead of using a dummy node, which leads to bugs when `left == 1`.
- **Recursion on long lists**: the recursive version uses O(n) stack and can hit recursion limits.

## In interviews

Reverse linked list is one of the most asked warm-up questions; follow-ups make it harder: reverse
between two positions, swap nodes in pairs, reverse nodes in k-group, rotate list, palindrome linked
list, reorder list (`L0 → Ln → L1 → Ln-1 …`: find the middle, reverse the second half, then
interleave). Talk through the three pointers and draw the links at each step. Be ready to write
both the iterative and the recursive version and to compare their space use.

Likely follow-up questions:

- Can you do it recursively? What is the space cost?
- How would you reverse only part of the list?
- How would you reverse in groups of k, leaving the last partial group unchanged?
- How do you check whether a list is a palindrome using reversal?
