## In short

Dijkstra's algorithm finds the shortest distance from one start node to every other node in a graph
whose edge weights are **non-negative**. It repeatedly takes the unfinished node with the smallest
known distance (using a min-heap), marks it final, and tries to improve its neighbours' distances
through it ("relaxation"). With a binary heap it runs in O((V + E) log V). It is the basis of route
planning and network routing. Negative weights break it; use Bellman-Ford for those.

## The idea

BFS finds shortest paths when every edge costs 1, because it expands nodes in order of distance.
Dijkstra keeps that "closest first" idea but lets edges have different costs, so "closest" now means
smallest total weight, and a heap replaces the plain queue.

Picture water flowing out from the start through pipes of different lengths. It reaches nearby
junctions first; whenever it reaches a junction, the time it took is final, because any other route
would have to pass through junctions the water has not reached yet, and those are all farther away.
That argument is exactly why weights must be non-negative: a negative edge could make a longer-looking
route suddenly cheaper after a node was already declared final.

The core operation is **relaxation**: if going to `u` and then along the edge `u → v` is cheaper than
the best known way to reach `v`, update `v`'s distance and remember `u` as its parent. Dijkstra just
performs relaxations in the right order.

## How it works

Start at A. Edges: `A→B 4`, `A→C 1`, `C→B 2`, `B→D 1`, `C→D 5`.

1. Distances: A = 0, all others ∞. Heap: `(0, A)`.
2. Pop A (0). Relax: B = 4, C = 1. Heap: `(1, C), (4, B)`.
3. Pop C (1). Relax: B via C is 1 + 2 = 3 < 4, so B = 3. D via C is 1 + 5 = 6. Heap has `(3, B)`,
   `(4, B)`, `(6, D)`.
4. Pop B (3). Relax: D via B is 3 + 1 = 4 < 6, so D = 4.
5. Pop the old `(4, B)` entry: B is already final with 3, so skip it ("lazy deletion").
6. Pop D (4). Done: A = 0, C = 1, B = 3, D = 4.

Python's `heapq` has no "decrease key", so instead of updating an entry we push a new one and skip
stale entries when they come out (step 5). This keeps the code short and the complexity the same.

If you only need the distance to one target, you can stop as soon as the target is popped: its
distance is final at that point.

## Code

```python run
import heapq


def dijkstra(graph: dict[str, list[tuple[str, int]]], start: str) -> dict[str, int]:
    dist = {start: 0}
    heap = [(0, start)]
    done: set[str] = set()
    while heap:
        d, u = heapq.heappop(heap)
        if u in done:                              # stale entry: a shorter one was used
            continue
        done.add(u)
        for v, w in graph.get(u, []):
            nd = d + w
            if nd < dist.get(v, float("inf")):     # relaxation
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    return dist


def network_delay(times: list[tuple[int, int, int]], n: int, k: int) -> int:
    """Time for a signal from k to reach all n nodes, or -1."""
    graph: dict[int, list[tuple[int, int]]] = {}
    for u, v, w in times:
        graph.setdefault(u, []).append((v, w))
    dist = dijkstra(graph, k)                      # type: ignore[arg-type]
    return max(dist.values()) if len(dist) == n else -1


g = {"A": [("B", 4), ("C", 1)], "C": [("B", 2), ("D", 5)], "B": [("D", 1)]}
assert dijkstra(g, "A") == {"A": 0, "B": 3, "C": 1, "D": 4}
assert network_delay([(2, 1, 1), (2, 3, 1), (3, 4, 1)], 4, 2) == 2
assert network_delay([(1, 2, 1)], 2, 2) == -1
```

## Trade-offs

Use BFS when all edges have the same weight: it is simpler and O(V + E). Use Dijkstra for
non-negative weights. Use **Bellman-Ford** (O(V·E)) when weights can be negative or you need to
detect negative cycles, or when the number of edges in the path is limited ("cheapest flights within
k stops"). For all-pairs shortest paths on small graphs, **Floyd-Warshall** is O(V³). **A\*** adds a
heuristic estimate of the remaining distance and is what maps and games use to search toward a known
goal faster.

## Common mistakes

- **Running it with negative weights**: results are silently wrong.
- **Not skipping stale heap entries**, which re-processes nodes and can change complexity.
- **Marking a node final when it is pushed** instead of when it is popped; only the pop is final.
- **Heap entries with the node first**: `(node, dist)` sorts by node name. Put the distance first.
- **Forgetting unreachable nodes**: they never get a distance; handle that case (return −1 or ∞).

## In interviews

Problems: network delay time, path with minimum effort, cheapest flights within k stops (a variant
needing the stop count in the state), swim in rising water, path with maximum probability (maximize a
product instead of minimizing a sum). Say why BFS is not enough (weights), why weights must be
non-negative, and give the complexity O((V + E) log V). Often the trick is defining the right state:
for example `(cost, node, stops_used)`.

Likely follow-up questions:

- Why does Dijkstra fail with negative edges?
- How do you rebuild the actual path? (Store each node's parent on relaxation.)
- What is the complexity with a binary heap, and why?
- When would you choose Bellman-Ford or A\* instead?
