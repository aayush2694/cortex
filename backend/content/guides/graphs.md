## In short

A graph is a set of **nodes** (vertices) connected by **edges**. Edges can be **directed** (one-way,
like following someone) or **undirected** (two-way, like friendship), and **weighted** (with a cost,
like road distance) or not. Graphs can contain cycles, and parts can be disconnected. You usually
store them as an **adjacency list** (each node maps to its neighbours), which uses O(V + E) memory.
Most graph problems are solved with breadth-first search, depth-first search, topological sort,
union-find or a shortest-path algorithm, all built on the same "visit, mark, explore neighbours" loop.

## The idea

Trees are a special case of graphs: connected, no cycles, one parent each. Real networks are messier.
A road map has loops, one-way streets and distances. A course catalogue has prerequisites pointing
one way. A social network has millions of people and many separate friend groups. Graphs model all
of these with the same two ingredients.

The first decision is **how to store** the graph:

1. **Adjacency list**: `{node: [neighbours]}`. Memory O(V + E), and listing a node's neighbours is
   fast. This is the default for interview problems, where graphs are usually sparse.
2. **Adjacency matrix**: a V × V grid where `matrix[u][v]` says whether an edge exists. O(1) to check
   one edge, but O(V²) memory even for few edges. Good for small, dense graphs.
3. **Edge list**: just `[(u, v, weight), …]`. Natural input for Kruskal's algorithm and union-find.

The second ingredient is **visited tracking**. Because graphs can have cycles, any traversal must
remember which nodes it has already seen, or it will loop forever. Trees never needed that.

## How it works

Count connected components given `n = 5` and edges `[(0, 1), (1, 2), (3, 4)]`:

1. Build the adjacency list: `0: [1]`, `1: [0, 2]`, `2: [1]`, `3: [4]`, `4: [3]`. For an undirected
   graph, add each edge in both directions.
2. Loop over every node. Node 0 is unvisited, so start a traversal: visit 0, 1, 2 and mark them.
   That is component 1.
3. Nodes 1 and 2 are already visited, so skip them. Node 3 is new: visit 3 and 4. Component 2.
4. Answer: 2 components. Each node and each edge is handled a constant number of times: O(V + E).

The outer loop over all nodes matters: a single traversal from one node only reaches its own
component.

Which algorithm for which question:

- **Reachability, components, cycle detection**: DFS or BFS.
- **Shortest path with unweighted edges**: BFS.
- **Shortest path with non-negative weights**: Dijkstra.
- **Ordering with dependencies**: topological sort (directed acyclic graphs only).
- **Connecting groups as edges arrive**: union-find.

## Code

```python run
from collections import defaultdict


def build(edges: list[tuple[int, int]], directed: bool = False) -> dict[int, list[int]]:
    graph: defaultdict[int, list[int]] = defaultdict(list)
    for u, v in edges:
        graph[u].append(v)
        if not directed:
            graph[v].append(u)
    return graph


def count_components(n: int, edges: list[tuple[int, int]]) -> int:
    graph, seen, count = build(edges), set(), 0
    for start in range(n):
        if start in seen:
            continue
        count += 1
        stack = [start]
        seen.add(start)
        while stack:                                   # iterative DFS
            node = stack.pop()
            for nxt in graph[node]:
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
    return count


def has_cycle_directed(n: int, edges: list[tuple[int, int]]) -> bool:
    """DFS with three colours: 0 = unvisited, 1 = on the current path, 2 = done."""
    graph = build(edges, directed=True)
    colour = [0] * n

    def visit(u: int) -> bool:
        colour[u] = 1
        for v in graph[u]:
            if colour[v] == 1 or (colour[v] == 0 and visit(v)):
                return True                            # back edge: a cycle
        colour[u] = 2
        return False

    return any(colour[u] == 0 and visit(u) for u in range(n))


assert count_components(5, [(0, 1), (1, 2), (3, 4)]) == 2
assert count_components(3, []) == 3
assert has_cycle_directed(3, [(0, 1), (1, 2), (2, 0)])
assert not has_cycle_directed(3, [(0, 1), (1, 2), (0, 2)])
```

## Trade-offs

Adjacency lists are the right default; matrices only pay off for small dense graphs or when you need
constant-time edge checks. DFS is short to write and good for exploring everything, detecting cycles
and ordering; BFS is the choice whenever "fewest steps" matters. Recursive DFS is elegant but can
exceed Python's recursion limit on large graphs; an explicit stack avoids that. For connectivity
questions where edges arrive one at a time, union-find is simpler and faster than rerunning a
traversal.

## Common mistakes

- **No visited set**, which loops forever on cycles.
- **Adding undirected edges in one direction only.**
- **Starting from a single node** and missing disconnected components.
- **Marking visited too late** in BFS (when popping instead of pushing), which adds nodes many times.
- **Using the undirected cycle check on a directed graph**: directed graphs need the "on current
  path" state, not just "seen".

## In interviews

Graph problems often hide inside other wording: islands in a grid, course prerequisites, word ladder,
clone graph, accounts merge, network delay time, number of provinces. First say what the nodes and
edges are, whether the graph is directed or weighted, and which algorithm fits. Then build the
adjacency list and state O(V + E).

Likely follow-up questions:

- Adjacency list or matrix: which would you use here, and why?
- How do you detect a cycle in a directed graph versus an undirected one?
- BFS or DFS for this problem?
- How would you handle a graph too large for recursion?
