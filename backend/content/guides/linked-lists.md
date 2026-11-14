## In short

A linked list is a chain of nodes, each holding a value and a pointer to the next node (and in a
**doubly** linked list, to the previous one too). Inserting or deleting at a node you already have
is O(1), because you only re-point a couple of links; nothing shifts. But there is no indexing:
reaching the i-th item means walking from the head, O(n). Linked lists back queues, LRU caches and
hash map buckets, and they are a favourite interview topic because they test careful pointer work.

## The idea

Think of a treasure hunt where each clue tells you where the next clue is hidden. To add a new clue
in the middle you only change one note ("go to the new clue") and write the new clue so it points
to the old next one. Nothing else moves. Compare that with an array, which is like a row of
numbered lockers: adding one in the middle means shifting every locker after it.

The price is that you cannot jump to clue number 50; you must follow 49 notes to get there. And each
node lives somewhere different in memory, so walking a linked list is slower in practice than
walking an array, even though both are O(n).

Most linked list problems come down to a few techniques:

1. **A dummy (sentinel) node** placed before the head, so inserting or deleting at the front works
   exactly like anywhere else. Return `dummy.next` at the end.
2. **Two pointers at different speeds** (fast and slow) to find the middle or detect a cycle.
3. **Saving `next` before re-pointing** when reversing or rearranging, so you never lose the rest of
   the list.
4. **Recursion**, which fits naturally because a list is "a node followed by a smaller list".

## How it works

Merge two sorted lists `1 → 3 → 5` and `2 → 4`:

1. Create a dummy node and a `tail` pointer at it.
2. Compare 1 and 2: attach 1, move `tail` to it, advance the first list. Then attach 2, 3, 4 the same
   way.
3. The second list is empty, so attach the rest of the first (`5`) in one step.
4. Return `dummy.next`: `1 → 2 → 3 → 4 → 5`. No new nodes were created; only links changed.

Remove the n-th node from the end in one pass: move a `fast` pointer n steps ahead, then move `fast`
and `slow` together until `fast` reaches the last node. `slow` is now just before the node to remove,
so set `slow.next = slow.next.next`. Starting both from a dummy node handles removing the head.

## Code

```python run
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Node:
    val: int
    next: Node | None = None


def from_list(values: list[int]) -> Node | None:
    dummy = tail = Node(0)
    for v in values:
        tail.next = Node(v)
        tail = tail.next
    return dummy.next


def to_list(head: Node | None) -> list[int]:
    out = []
    while head:
        out.append(head.val)
        head = head.next
    return out


def merge(a: Node | None, b: Node | None) -> Node | None:
    dummy = tail = Node(0)
    while a and b:
        if a.val <= b.val:
            tail.next, a = a, a.next
        else:
            tail.next, b = b, b.next
        tail = tail.next
    tail.next = a or b                     # attach whatever is left
    return dummy.next


def remove_nth_from_end(head: Node | None, n: int) -> Node | None:
    dummy = Node(0, head)
    fast = slow = dummy
    for _ in range(n):
        fast = fast.next                   # type: ignore[assignment]
    while fast.next:
        fast, slow = fast.next, slow.next  # type: ignore[assignment]
    slow.next = slow.next.next             # type: ignore[union-attr]
    return dummy.next


assert to_list(merge(from_list([1, 3, 5]), from_list([2, 4]))) == [1, 2, 3, 4, 5]
assert to_list(merge(None, from_list([1]))) == [1]
assert to_list(remove_nth_from_end(from_list([1, 2, 3, 4, 5]), 2)) == [1, 2, 3, 5]
assert to_list(remove_nth_from_end(from_list([1]), 1)) == []
```

## Trade-offs

Use an array (Python list) by default: it has O(1) indexing and is cache-friendly. Linked lists win
when you insert and delete in the middle often **and already hold a reference to the node**, as in
an LRU cache (hash map from key to node, plus a doubly linked list for recency order). For a queue,
Python's `collections.deque` gives O(1) at both ends without you managing nodes. Singly linked
lists use less memory; doubly linked lists can delete a node in O(1) given only that node.

## Common mistakes

- **Losing the rest of the list** by overwriting `node.next` before saving it.
- **Not handling the head**: deleting or inserting at the front needs special code unless you use a
  dummy node.
- **Null pointer errors**: check `node` and `node.next` before reading `node.next.next`.
- **Infinite loops** from accidentally creating a cycle while re-linking.
- **Assuming you can index**: `get(i)` is O(n); doing it inside a loop gives O(n²).

## In interviews

Common problems: reverse a linked list, merge two sorted lists, remove the n-th node from the end,
detect a cycle, find the middle, palindrome linked list, reorder list, add two numbers, copy a list
with random pointers, LRU cache. Draw the nodes and arrows before coding, say which pointers change
in each step, and test with an empty list, one node, and two nodes.

Likely follow-up questions:

- Why use a dummy node?
- How would you find the middle in one pass?
- What does a doubly linked list give you that a singly linked list doesn't?
- How would you design an LRU cache with O(1) get and put?
