## In short

Breadth-first search explores a graph **level by level**: first the start node, then every node one
edge away, then every node two edges away, and so on. It uses a **queue** and a **visited** set. In
an unweighted graph, the first time BFS reaches a node is along a shortest path, so it is the
standard way to find the fewest steps between two points. It runs in O(V + E) time and uses O(V)
memory for the queue and visited set.

## The idea

Drop a stone in a pond: the ripple reaches everything one metre away before anything two metres
away. BFS spreads through a graph the same way. Because it finishes all nodes at distance d before
touching any node at distance d + 1, the first time it reaches a node is guaranteed to be the
shortest way there, as long as every edge counts as one step.

The queue is what produces that order. New neighbours join the back of the queue, so everything
already waiting (closer to the start) is processed first. Swap the queue for a stack and you get
depth-first search, which dives down one path and gives no shortest-path guarantee.

Many problems are BFS in disguise once you name the nodes and edges:

- **Word ladder**: nodes are words; an edge joins two words that differ by one letter.
- **Minimum moves on a board or lock**: nodes are states; edges are single moves.
- **Rotting oranges / walls and gates**: start BFS from **all** sources at once (multi-source BFS) to
  model things spreading in parallel.

BFS does not handle weighted edges: a path with more edges might be cheaper. For non-negative weights
use Dijkstra; for weights of only 0 and 1, a deque-based "0-1 BFS" works.

## How it works

Shortest path from A to F in this graph: `A–B, A–C, B–D, C–D, D–E, E–F`.

1. Queue `[A]`, distance A = 0, visited {A}.
2. Pop A; push its unvisited neighbours B and C with distance 1. Queue `[B, C]`.
3. Pop B; push D (distance 2). Pop C; D is already visited, so skip it. Queue `[D]`.
4. Pop D; push E (distance 3). Pop E; push F (distance 4). F is reached: the answer is 4 edges.
5. To print the actual path, store each node's parent when you first push it, then walk back from F:
   F ← E ← D ← B ← A.

The key detail is in step 3: mark a node visited **when you push it**, not when you pop it.
Otherwise D could be pushed twice (from B and from C), and in dense graphs the queue can blow up.

To process one level at a time (for example to count steps or minutes), read `len(queue)` at the
start of each round and pop exactly that many nodes.

## Code

```python run
from collections import deque


def shortest_path(graph: dict[str, list[str]], start: str, goal: str) -> list[str] | None:
    parent: dict[str, str | None] = {start: None}       # doubles as the visited set
    queue = deque([start])
    while queue:
        node = queue.popleft()
        if node == goal:
            path = []
            while node is not None:
                path.append(node)
                node = parent[node]
            return path[::-1]
        for nxt in graph.get(node, []):
            if nxt not in parent:                       # mark when pushing
                parent[nxt] = node
                queue.append(nxt)
    return None


def minutes_to_rot(grid: list[list[int]]) -> int:
    """Multi-source BFS: 2 = rotten, 1 = fresh, 0 = empty. -1 if some never rot."""
    rows, cols = len(grid), len(grid[0])
    queue = deque((r, c) for r in range(rows) for c in range(cols) if grid[r][c] == 2)
    fresh = sum(row.count(1) for row in grid)
    minutes = 0
    while queue and fresh:
        for _ in range(len(queue)):                     # one level = one minute
            r, c = queue.popleft()
            for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1:
                    grid[nr][nc] = 2
                    fresh -= 1
                    queue.append((nr, nc))
        minutes += 1
    return -1 if fresh else minutes


g = {"A": ["B", "C"], "B": ["A", "D"], "C": ["A", "D"], "D": ["B", "C", "E"],
     "E": ["D", "F"], "F": ["E"]}
assert shortest_path(g, "A", "F") == ["A", "B", "D", "E", "F"]
assert shortest_path(g, "A", "Z") is None
assert minutes_to_rot([[2, 1, 1], [1, 1, 0], [0, 1, 1]]) == 4
assert minutes_to_rot([[2, 1, 1], [0, 1, 1], [1, 0, 1]]) == -1
```

## Common mistakes

- **Marking visited on pop instead of on push**, which enqueues the same node many times.
- **Using a list with `pop(0)`** as the queue, which is O(n) per pop; use `collections.deque`.
- **Using BFS on weighted graphs** and calling the result a shortest path.
- **Running BFS once per source** in spreading problems, instead of one multi-source BFS.
- **Off-by-one in level counting**: decide whether the start counts as step 0 and stop the loop when
  nothing is left to spread to.

## In interviews

Signals: "minimum number of steps / moves / minutes", "shortest path" in an unweighted graph or grid,
"nearest", or "level". Problems: binary tree level order, rotting oranges, word ladder, open the lock,
shortest path in a binary matrix, 01 matrix, walls and gates, minimum genetic mutation. Define the
state (node, or (row, col), or a tuple like (position, keys collected)), the neighbours, the visited
rule, and when to stop. State O(V + E), or O(rows × cols) for grids.

Likely follow-up questions:

- Why does BFS give the shortest path in an unweighted graph?
- How would you reconstruct the path, not just its length?
- What changes if edges have weights?
- Could you search from both ends at once? (Bidirectional BFS, useful in word ladder.)
