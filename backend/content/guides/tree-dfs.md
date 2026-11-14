## In short

Tree DFS goes as deep as possible down one branch before backing up and trying the next, usually
with recursion. It comes in two styles: **top-down**, where you pass information down to children
(the remaining sum, the current path, allowed value range), and **bottom-up**, where each call returns
an answer that its parent combines (height, size, "is balanced", best path through this node). It
visits every node once, so O(n) time, and uses O(h) stack space, where h is the tree's height.

## The idea

Exploring a cave system, you follow one tunnel to its dead end, walk back to the last fork, and take
the next tunnel. You only need to remember the path back to the entrance, not every tunnel at once.
Recursion gives you that memory for free: the call stack *is* the path from the root to the current
node, and returning from a call is the walk back.

Most tree problems become simple once you decide which direction information flows:

1. **Top-down** asks "what does this node need to know from above?" For path sum, each node needs the
   remaining target; at a leaf, check whether it is zero. For validating a BST, each node needs the
   range its value must fall in.
2. **Bottom-up** asks "what should this node report to its parent?" For height, each node reports
   `1 + max(left, right)`. For a balanced check, it reports its height or a "not balanced" signal.

Many harder problems use both: the function **returns** one thing to the parent while **updating** a
separate best answer. Diameter of a binary tree is the classic: each node returns its height, but the
longest path through that node is `left_height + right_height`, which updates a global maximum.

## How it works

Root-to-leaf path sum: is there a path summing to 22 in this tree?

```text
          5
         / \
        4   8
       /   / \
      11  13  4
     /  \      \
    7    2      1
```

1. At 5, remaining 22 − 5 = 17. Go left to 4: remaining 13. Go to 11: remaining 2.
2. Go to 7: remaining −5 at a leaf. Not zero; return False.
3. Back at 11, try 2: remaining 0 at a leaf. Return True, and the True passes all the way up.

The right subtree is never explored, because the left side already succeeded. That early return is
common in DFS.

Lowest common ancestor shows bottom-up thinking: each call returns the target node if it found one in
its subtree. If a node gets a non-empty answer from **both** children, the two targets are on
different sides, so this node is their lowest common ancestor.

## Code

```python run
from __future__ import annotations

from dataclasses import dataclass


@dataclass(eq=False)
class TreeNode:
    val: int
    left: TreeNode | None = None
    right: TreeNode | None = None


def has_path_sum(root: TreeNode | None, target: int) -> bool:
    """Top-down: pass the remaining sum to the children."""
    if not root:
        return False
    remaining = target - root.val
    if not root.left and not root.right:
        return remaining == 0
    return has_path_sum(root.left, remaining) or has_path_sum(root.right, remaining)


def diameter(root: TreeNode | None) -> int:
    """Bottom-up: return height, update the longest path (in edges) on the side."""
    best = 0

    def height(node: TreeNode | None) -> int:
        nonlocal best
        if not node:
            return 0
        left, right = height(node.left), height(node.right)
        best = max(best, left + right)            # longest path through this node
        return 1 + max(left, right)

    height(root)
    return best


def lca(root: TreeNode | None, p: TreeNode, q: TreeNode) -> TreeNode | None:
    if root is None or root is p or root is q:
        return root
    left, right = lca(root.left, p, q), lca(root.right, p, q)
    if left and right:                            # one target on each side
        return root
    return left or right


seven, two = TreeNode(7), TreeNode(2)
eleven = TreeNode(11, seven, two)
tree = TreeNode(5, TreeNode(4, eleven),
                TreeNode(8, TreeNode(13), TreeNode(4, None, TreeNode(1))))
assert has_path_sum(tree, 22)
assert not has_path_sum(tree, 100)
assert not has_path_sum(None, 0)
assert diameter(tree) == 6                       # 7 -> 11 -> 4 -> 5 -> 8 -> 4 -> 1
assert lca(tree, seven, two) is eleven
assert lca(tree, seven, tree) is tree
```

## Common mistakes

- **Treating a node with one child as a leaf** in path problems; a leaf has no children.
- **Returning the wrong thing**: in diameter, return the height, not the diameter.
- **Forgetting the `None` base case**, or checking `root.left.val` without checking `root.left`.
- **Using a mutable path list without undoing**: if you append before recursing, pop after, or pass a
  new list.
- **Recursion depth** on very deep (skewed) trees; an explicit stack avoids `RecursionError`.

## In interviews

DFS is the most common tree technique. Problems: maximum depth, invert binary tree, same tree,
symmetric tree, path sum I/II/III, diameter, balanced binary tree, lowest common ancestor, binary
tree maximum path sum, validate BST, kth smallest in a BST (in-order DFS), serialize and deserialize.
Before coding, say whether it is top-down or bottom-up, what each call returns, and what the base case
returns. State O(n) time and O(h) space, which is O(n) in the worst case for a skewed tree.

Likely follow-up questions:

- What does your recursive function return, and what does it update?
- What is the space complexity, and when is it O(n)?
- Can you write it iteratively with a stack?
- How would you return all root-to-leaf paths that sum to the target?
