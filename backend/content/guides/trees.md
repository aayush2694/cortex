## In short

A tree is a hierarchy of nodes: one **root**, and every other node has exactly one parent and any
number of children. Nodes with no children are **leaves**. A **binary tree** allows at most two
children (left and right). A **binary search tree** (BST) adds an ordering rule: everything in a
node's left subtree is smaller and everything in its right subtree is larger, so search, insert and
delete take O(h), where h is the height: O(log n) when balanced, O(n) when it degenerates into a
line. You visit trees with depth-first traversals (pre-, in- and post-order) or breadth-first (level
order).

## The idea

Folders on your computer are a tree: each folder sits inside exactly one parent folder, and can hold
many files and folders. A company org chart is a tree. The HTML of a web page is a tree. Trees model
anything where each item belongs to exactly one "parent" and there are no loops.

Trees are recursive by nature: a tree is a root plus some smaller trees (its subtrees). That is why
most tree code is short and recursive: "the answer for this node is built from the answers for its
children". The height of a tree is 1 + the larger height of its two subtrees; the number of nodes is
1 + the sizes of both subtrees.

A BST makes searching fast by throwing away half the tree at each step, like binary search. To find
42, compare with the root: if 42 is smaller go left, if larger go right. But this only helps if the
tree is balanced. Inserting already sorted values into a plain BST produces a "tree" that is really
a linked list, with height n. Self-balancing trees (AVL, red-black) rotate nodes to keep the height
O(log n); they power Java's `TreeMap` and C++'s `std::map`.

## How it works

The four traversals of this tree:

```text
        4
      /   \
     2     6
    / \     \
   1   3     7
```

1. **Pre-order** (node, left, right): 4, 2, 1, 3, 6, 7. Useful for copying or serializing a tree.
2. **In-order** (left, node, right): 1, 2, 3, 4, 6, 7. On a BST this gives sorted order, which is
   the standard way to check that a tree is a valid BST.
3. **Post-order** (left, right, node): 1, 3, 2, 7, 6, 4. Children are finished before their parent,
   so it fits computing heights, sizes or deleting a tree.
4. **Level order** (breadth-first): 4, then 2, 6, then 1, 3, 7. Uses a queue.

Height here is 3 (counting nodes on the longest root-to-leaf path; some definitions count edges and
get 2, so say which you use). The tree is balanced: at every node, the two subtree heights differ by
at most one.

The first three traversals visit each node once, so they are O(n) time. Recursion uses O(h) stack
space: O(log n) for balanced trees, O(n) for skewed ones.

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


def inorder(root: TreeNode | None) -> list[int]:
    return inorder(root.left) + [root.val] + inorder(root.right) if root else []


def preorder(root: TreeNode | None) -> list[int]:
    return [root.val] + preorder(root.left) + preorder(root.right) if root else []


def level_order(root: TreeNode | None) -> list[list[int]]:
    levels, queue = [], deque([root] if root else [])
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)
            queue.extend(child for child in (node.left, node.right) if child)
        levels.append(level)
    return levels


def height(root: TreeNode | None) -> int:
    return 1 + max(height(root.left), height(root.right)) if root else 0


def bst_insert(root: TreeNode | None, val: int) -> TreeNode:
    if root is None:
        return TreeNode(val)
    if val < root.val:
        root.left = bst_insert(root.left, val)
    else:
        root.right = bst_insert(root.right, val)
    return root


root = None
for v in [4, 2, 6, 1, 3, 7]:
    root = bst_insert(root, v)
assert inorder(root) == [1, 2, 3, 4, 6, 7]            # sorted: it's a valid BST
assert preorder(root) == [4, 2, 1, 3, 6, 7]
assert level_order(root) == [[4], [2, 6], [1, 3, 7]]
assert height(root) == 3

line = None
for v in range(1, 6):
    line = bst_insert(line, v)                         # sorted inserts: degenerate tree
assert height(line) == 5
```

## Common mistakes

- **Validating a BST by checking only each node's direct children.** A node deep in the left subtree
  must be smaller than every ancestor it sits left of. Pass down a (low, high) range or check that the
  in-order traversal is strictly increasing.
- **Forgetting the empty tree** (`root is None`) as a base case.
- **Assuming O(log n)** for an unbalanced BST.
- **Mixing up height definitions** (nodes versus edges).
- **Deep recursion** on skewed trees hitting the recursion limit; use an explicit stack.

## In interviews

Trees are one of the most common interview areas. Problems: maximum depth, invert binary tree, same
tree, symmetric tree, validate BST, lowest common ancestor, kth smallest in a BST, serialize and
deserialize, binary tree level order traversal, diameter of a binary tree. Decide first whether you
need DFS (paths, subtree answers) or BFS (levels, shortest depth), then state the time (usually O(n))
and space (O(h) for DFS, O(width) for BFS).

Likely follow-up questions:

- Which traversal gives sorted output for a BST, and why?
- How do you check that a tree is a valid BST?
- What is the height of a balanced tree versus a skewed one?
- How would you traverse without recursion?
