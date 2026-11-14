## In short

A topological sort orders the nodes of a **directed acyclic graph** (DAG) so that every edge `u → v`
puts `u` before `v`: every task comes after all of its prerequisites. **Kahn's algorithm** repeatedly
takes nodes with no remaining prerequisites (in-degree 0) from a queue. If some nodes are never
taken, the graph has a cycle and no valid order exists. A DFS version adds each node after all its
descendants and reverses the result. Both run in O(V + E). Build systems, package managers, course
planners and spreadsheet recalculation all rely on it.

## The idea

Getting dressed has dependencies: socks before shoes, shirt before tie, trousers before belt. Any
order that respects those rules works, and there are usually several. A topological sort finds one.

Kahn's algorithm is how you would do it by hand: look for something with no unmet requirements, do
it, cross it off everyone's list of requirements, and repeat. The number of unmet requirements of a
node is its **in-degree**. Nodes with in-degree 0 are ready. Finishing a node lowers the in-degree of
each node that depended on it; any that reach 0 become ready.

If you get stuck with tasks left but none ready, every remaining task is waiting for another
remaining task: that is a **cycle** (A needs B, B needs C, C needs A). So the same algorithm both
orders tasks and detects impossible schedules. "Course schedule" (can you finish all courses?) is
exactly that check.

The DFS approach uses a different insight: a node can only be placed after everything reachable from
it. If you append each node to a list **when its DFS finishes**, the list is in reverse topological
order. A node seen again while it is still on the current DFS path means a cycle.

## How it works

Courses 0–3. Prerequisites: 0 before 1, 0 before 2, 1 before 3, 2 before 3.

1. In-degrees: 0 → 0, 1 → 1, 2 → 1, 3 → 2. Queue the ready node: `[0]`.
2. Take 0. Order `[0]`. Lower 1 and 2 to 0; queue `[1, 2]`.
3. Take 1. Order `[0, 1]`. Lower 3 to 1.
4. Take 2. Order `[0, 1, 2]`. Lower 3 to 0; queue `[3]`.
5. Take 3. Order `[0, 1, 2, 3]`. All four placed, so a valid order exists.

Add an edge 3 before 0 and nothing ever starts with in-degree 0 (every node waits on another), so the
order has fewer nodes than the graph: a cycle.

Kahn's algorithm also tells you how many "rounds" are needed if independent tasks run in parallel:
process the queue level by level, like BFS. "Parallel courses" asks exactly that.

## Code

```python run
from collections import deque


def topo_order(n: int, edges: list[tuple[int, int]]) -> list[int] | None:
    """Kahn's algorithm. edges are (before, after). None if there is a cycle."""
    graph: list[list[int]] = [[] for _ in range(n)]
    indegree = [0] * n
    for before, after in edges:
        graph[before].append(after)
        indegree[after] += 1
    queue = deque(i for i in range(n) if indegree[i] == 0)
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nxt in graph[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    return order if len(order) == n else None


def topo_dfs(n: int, edges: list[tuple[int, int]]) -> list[int] | None:
    graph: list[list[int]] = [[] for _ in range(n)]
    for before, after in edges:
        graph[before].append(after)
    state = [0] * n                       # 0 new, 1 on current path, 2 finished
    out: list[int] = []

    def visit(u: int) -> bool:
        state[u] = 1
        for v in graph[u]:
            if state[v] == 1 or (state[v] == 0 and not visit(v)):
                return False              # cycle
        state[u] = 2
        out.append(u)                     # after all descendants
        return True

    for u in range(n):
        if state[u] == 0 and not visit(u):
            return None
    return out[::-1]


edges = [(0, 1), (0, 2), (1, 3), (2, 3)]
assert topo_order(4, edges) == [0, 1, 2, 3]
order = topo_dfs(4, edges)
assert order is not None
assert all(order.index(a) < order.index(b) for a, b in edges)
assert topo_order(4, edges + [(3, 0)]) is None
assert topo_dfs(2, [(0, 1), (1, 0)]) is None
```

## Common mistakes

- **Reversing edge direction**: "1 requires 0" is the edge `0 → 1`. Getting this backwards produces a
  reversed order.
- **Forgetting the cycle check** (`len(order) == n`).
- **Starting DFS from one node only**; loop over all nodes, since the graph may be disconnected.
- **Using a plain visited set in the DFS version**, which cannot tell a cycle from a node finished
  earlier on another branch. You need the "on current path" state.
- **Expecting a unique answer**: many orders can be valid; tests should check the rule, not one list.

## In interviews

Problems: course schedule I and II, alien dictionary (build edges from the first differing letter of
adjacent words), find eventual safe states, minimum height trees (peel leaves layer by layer),
parallel courses, sequence reconstruction. Signals: "prerequisites", "dependencies", "must come
before", "build order". State how you build the edges, which algorithm you use and why, and how you
detect a cycle. Complexity O(V + E).

Likely follow-up questions:

- How do you detect that no valid order exists?
- Is the order unique? How would you check? (Unique if the queue never holds more than one node.)
- How many semesters are needed if courses can run in parallel?
- Kahn's or DFS: which would you choose, and why?
