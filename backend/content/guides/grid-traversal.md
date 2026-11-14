## In short

Many problems hand you a 2D grid (a map, an image, a board) and ask about regions, paths or
spreading. Treat each cell as a graph node connected to its 4 neighbours (up, down, left, right;
sometimes 8 with diagonals), then run DFS or BFS. Flood fill and counting islands use DFS or BFS to
mark connected regions; shortest paths and "minutes until everything spreads" use BFS. Every cell is
visited once, so the cost is O(rows × cols) time and up to O(rows × cols) memory for the visited
marks and the queue or stack.

## The idea

A paint bucket tool in an image editor is grid traversal: click a pixel, and the colour spreads to
every connected pixel of the same colour, stopping at different colours and at the image edge. That
is DFS or BFS on a grid, where the "edges" are simply "the cell next to me has the same colour".

You never need to build an adjacency list. The neighbours of `(r, c)` are computed on the fly from a
small list of directions: `(1, 0), (-1, 0), (0, 1), (0, -1)`. The only extra work compared with an
ordinary graph is the **bounds check**: a neighbour might be outside the grid.

Three questions decide the approach:

1. **Do I need connected regions?** (islands, provinces, enclosed areas) Either DFS or BFS works;
   loop over every cell and start a new traversal from each unvisited land cell.
2. **Do I need the fewest steps?** Use BFS, because it reaches cells in order of distance.
3. **Are there many sources spreading at once?** (rotting oranges, distance to the nearest exit) Put
   all sources in the queue at the start: **multi-source BFS**. Running a separate BFS from each
   source would be much slower.

A useful reversal trick: "which cells can reach the ocean?" is easier as "which cells can the ocean
reach going uphill?", starting from the border. Pacific Atlantic water flow and surrounded regions
both work this way.

## How it works

Count islands (`1` = land) in:

```text
1 1 0 0
1 0 0 1
0 0 1 1
```

1. Scan row by row. `(0, 0)` is unvisited land: count = 1. Flood from it, marking `(0, 0)`, `(0, 1)`
   and `(1, 0)`.
2. Keep scanning. `(1, 3)` is unvisited land: count = 2. Flood marks `(1, 3)`, `(2, 3)`, `(2, 2)`.
3. No other unvisited land remains. Answer: 2.

Marking can be done in a separate `visited` set, or by overwriting the grid cell (for example
turning `1` into `0`). Overwriting saves memory but changes the input; say so, and ask whether that
is allowed.

For BFS, mark a cell visited when you **push** it, not when you pop it. Otherwise the same cell can
be added to the queue by several neighbours.

## Code

```python run
from collections import deque

DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))


def count_islands(grid: list[list[int]]) -> int:
    rows, cols = len(grid), len(grid[0]) if grid else 0
    seen: set[tuple[int, int]] = set()
    islands = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 1 and (r, c) not in seen:
                islands += 1
                stack = [(r, c)]
                seen.add((r, c))
                while stack:                                  # iterative DFS
                    cr, cc = stack.pop()
                    for dr, dc in DIRS:
                        nr, nc = cr + dr, cc + dc
                        if (0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1
                                and (nr, nc) not in seen):
                            seen.add((nr, nc))
                            stack.append((nr, nc))
    return islands


def shortest_clear_path(grid: list[list[int]]) -> int:
    """BFS from top-left to bottom-right through 0-cells, 4 directions. -1 if blocked."""
    rows, cols = len(grid), len(grid[0])
    if grid[0][0] or grid[-1][-1]:
        return -1
    queue = deque([(0, 0, 1)])
    seen = {(0, 0)}
    while queue:
        r, c, dist = queue.popleft()
        if (r, c) == (rows - 1, cols - 1):
            return dist
        for dr, dc in DIRS:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and not grid[nr][nc] and (nr, nc) not in seen:
                seen.add((nr, nc))                            # mark on push
                queue.append((nr, nc, dist + 1))
    return -1


grid = [[1, 1, 0, 0],
        [1, 0, 0, 1],
        [0, 0, 1, 1]]
assert count_islands(grid) == 2
assert count_islands([[0]]) == 0
assert shortest_clear_path([[0, 0, 0], [1, 1, 0], [1, 1, 0]]) == 5
assert shortest_clear_path([[0, 1], [1, 0]]) == -1
```

## Common mistakes

- **Missing bounds checks**, or checking them after reading `grid[nr][nc]`. In Python a negative index
  silently wraps around to the other side instead of failing.
- **Swapping rows and columns** (`grid[c][r]`) on non-square grids.
- **Marking visited too late** in BFS, which floods the queue with duplicates.
- **Recursive DFS on large grids**: a 1000 × 1000 region can exceed the recursion limit; use an
  explicit stack or BFS.
- **Running BFS from every source separately** when one multi-source BFS would do.

## In interviews

Problems: number of islands, flood fill, max area of island, rotting oranges, walls and gates, 01
matrix, shortest path in a binary matrix, surrounded regions, Pacific Atlantic water flow, word search
(DFS with backtracking). Say the state (row, column, plus anything else like keys or remaining
obstacles), the neighbours, how you mark visited, and whether you may modify the grid. Give the
complexity as O(rows × cols).

Likely follow-up questions:

- BFS or DFS here, and why?
- Can you avoid modifying the input grid?
- What changes with 8 directions?
- How would you count islands if land arrives one cell at a time? (Union-find.)
