## In short

Tree BFS visits a tree **level by level** with a queue: the root, then all its children, then all
grandchildren, and so on. The key trick is to read the queue's length at the start of each level and
process exactly that many nodes, so you always know where one level ends and the next begins. It
takes O(n) time and O(w) memory, where w is the widest level (up to about n/2 for a full tree). It
answers level order, right side view, zigzag order, level averages and minimum depth.

## The idea

Imagine a family tree printed generation by generation: grandparents on the first line, parents on
the second, children on the third. Reading it line by line is exactly a level order traversal.

A queue makes this natural. You put the root in. Each time you take a node out, you put its children
at the back. Because children always join behind everyone already waiting, a whole level comes out
before any node of the next level.

Use `collections.deque` for the queue. A Python list works, but `list.pop(0)` shifts every remaining
item, which turns an O(n) traversal into O(n²) on wide trees; `deque.popleft()` is O(1).

The "snapshot the length" detail turns a flat stream of nodes into grouped levels. At the start of a
round, the queue holds exactly one complete level. Read `len(queue)`, pop that many nodes, and
everything you pushed during the round is the next level.

Once you have levels, many questions become one-liners: the right side view is the last node of each
level; zigzag order reverses every other level; the average per level is sum ÷ count. And for
**minimum depth**, BFS can stop at the first leaf it meets, while DFS would have to explore the whole
tree to be sure.

## How it works

Level order of:

```text
        3
       / \
      9   20
         /  \
        15   7
```

1. Queue `[3]`. Level size 1: pop 3, push 9 and 20. Level `[3]`.
2. Queue `[9, 20]`. Level size 2: pop 9 (no children), pop 20 and push 15 and 7. Level `[9, 20]`.
3. Queue `[15, 7]`. Level size 2: pop both, no children. Level `[15, 7]`.
4. Queue empty. Result `[[3], [9, 20], [15, 7]]`. Right side view: `[3, 20, 7]`. Minimum depth: 2,
   because 9 is a leaf on level 2 and BFS reaches it before anything deeper.

Each node is pushed and popped once, so the time is O(n). The queue holds at most one level plus part
of the next, which is why the space depends on the tree's width, not its height. That is the opposite
of DFS, whose memory depends on height: choose BFS for wide-but-shallow questions and when you need
the shallowest answer first.

## Code

```python run
from __future__ import annotations

from collections import deque
from dataclasses import dataclass


@dataclass
class TreeNode:
    val: int
    left: TreeNode | None = None
    right: TreeNode | None = None


def levels(root: TreeNode | None) -> list[list[int]]:
    out: list[list[int]] = []
    queue = deque([root] if root else [])
    while queue:
        level = []
        for _ in range(len(queue)):               # exactly one level
            node = queue.popleft()
            level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        out.append(level)
    return out


def right_side_view(root: TreeNode | None) -> list[int]:
    return [level[-1] for level in levels(root)]


def zigzag(root: TreeNode | None) -> list[list[int]]:
    return [lvl if i % 2 == 0 else lvl[::-1] for i, lvl in enumerate(levels(root))]


def min_depth(root: TreeNode | None) -> int:
    if not root:
        return 0
    queue = deque([(root, 1)])
    while queue:
        node, depth = queue.popleft()
        if not node.left and not node.right:      # first leaf found is the shallowest
            return depth
        for child in (node.left, node.right):
            if child:
                queue.append((child, depth + 1))
    return 0


tree = TreeNode(3, TreeNode(9), TreeNode(20, TreeNode(15), TreeNode(7)))
assert levels(tree) == [[3], [9, 20], [15, 7]]
assert right_side_view(tree) == [3, 20, 7]
assert zigzag(tree) == [[3], [20, 9], [15, 7]]
assert min_depth(tree) == 2
assert levels(None) == [] and min_depth(None) == 0
```

## Common mistakes

- **Not snapshotting `len(queue)`**, so levels blend together.
- **Using `len(queue)` inside the loop condition directly** (`while i < len(queue)`), which changes as
  you push children.
- **Pushing `None` children** and then crashing on `node.val`; check before pushing.
- **Right side view by always taking right children**: a left child can be the rightmost node on its
  level when the right side is shorter.
- **Minimum depth counting a node with one child as a leaf**: a leaf has no children at all.

## In interviews

Problems: binary tree level order traversal (I and II), zigzag level order, right side view, average
of levels, minimum depth, maximum width, populating next right pointers, cousins in a binary tree.
Explain the length snapshot, and compare with DFS: BFS uses O(width) memory and finds the shallowest
answer first; DFS uses O(height) and suits path and subtree questions.

Likely follow-up questions:

- How would you do level order with DFS instead? (Pass the depth and append to `result[depth]`.)
- Why is BFS better than DFS for minimum depth?
- What is the worst-case memory of BFS on a tree?
- How would you find the maximum width, counting gaps? (Track position indexes per node.)
