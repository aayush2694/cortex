## In short

Union-find (also called disjoint set union, DSU) keeps track of which items belong to the same
group while groups are merged. It supports two operations: `find(x)` returns the group's
representative (its **root**), and `union(a, b)` merges two groups. With **path compression** and
**union by size or rank**, each operation takes nearly constant time (O(α(n)), where α grows so
slowly it is below 5 for any realistic n). It answers "are these connected?", counts components,
detects the edge that creates a cycle, and powers Kruskal's minimum spanning tree.

## The idea

Think of companies merging. Each company has a CEO. To know whether two employees work for the same
company, ask each for their CEO and compare. When two companies merge, one CEO starts reporting to
the other, and everyone in the smaller company now ends up at the same top boss.

That is the whole structure: each group is a tree, each item points to a parent, and the root is the
group's name. `find` follows parent pointers to the root. `union` finds both roots and, if they differ,
makes one root point to the other.

Two optimizations keep the trees flat:

1. **Path compression**: during `find`, make every node on the path point directly to the root (or
   to its grandparent). The next lookup is almost instant.
2. **Union by size (or rank)**: attach the smaller tree under the larger one, so trees cannot grow
   tall chains.

Either alone already helps a lot; together they give the near-constant bound.

Union-find shines when connections **arrive over time**. Running BFS again after every new edge would
cost O(V + E) each time; union-find handles each edge in about O(1). It cannot easily **split**
groups, though: removing edges is not supported.

## How it works

Five computers, 0 to 4, cables added in this order: (0, 1), (1, 2), (3, 4), (2, 0).

1. Start: every node is its own root. Components = 5.
2. Union(0, 1): roots 0 and 1 differ; attach 1 under 0. Components = 4.
3. Union(1, 2): find(1) = 0, find(2) = 2; attach 2 under 0 (the larger group). Components = 3.
4. Union(3, 4): attach 4 under 3. Components = 2.
5. Union(2, 0): find(2) = 0 and find(0) = 0, the same root. These two were already connected, so this
   cable creates a **cycle**: it is the redundant connection.

Final groups: {0, 1, 2} and {3, 4}. To ask "are 1 and 2 connected?", compare `find(1)` and `find(2)`.

## Code

```python run
class UnionFind:
    def __init__(self, n: int) -> None:
        self.parent = list(range(n))
        self.size = [1] * n
        self.components = n

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]   # path compression (halving)
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> bool:
        """Merge the groups of a and b. False if they were already together."""
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        if self.size[ra] < self.size[rb]:                  # union by size
            ra, rb = rb, ra
        self.parent[rb] = ra
        self.size[ra] += self.size[rb]
        self.components -= 1
        return True


def redundant_connection(edges: list[tuple[int, int]]) -> tuple[int, int] | None:
    uf = UnionFind(max(max(e) for e in edges) + 1)
    for a, b in edges:
        if not uf.union(a, b):
            return a, b
    return None


uf = UnionFind(5)
for a, b in [(0, 1), (1, 2), (3, 4)]:
    uf.union(a, b)
assert uf.components == 2
assert uf.find(1) == uf.find(2) and uf.find(0) != uf.find(4)
assert not uf.union(2, 0)                                  # already connected
assert redundant_connection([(1, 2), (1, 3), (2, 3)]) == (2, 3)
```

## Trade-offs

Use union-find for connectivity with edges arriving over time, for counting groups, for cycle
detection in **undirected** graphs, and for Kruskal's algorithm. Use BFS or DFS when you need actual
paths or distances, when the graph is directed (union-find ignores direction, so it cannot detect
directed cycles), or when edges are removed. For a single static question ("how many components?"),
both are O(V + E) in practice; pick whichever you can write correctly fastest.

## Common mistakes

- **Comparing parents instead of roots**: `parent[a] == parent[b]` is not "same group"; compare
  `find(a) == find(b)`.
- **Uniting the nodes instead of their roots** (`parent[a] = b`), which breaks trees.
- **Skipping both optimizations**, which allows O(n) chains.
- **Using it for directed cycle detection**; it only works for undirected graphs.
- **Mapping non-integer items** (emails, names) without first assigning each an index or using a dict
  for `parent`.

## In interviews

Problems: number of provinces, redundant connection, number of operations to make a network
connected, accounts merge (union emails that appear in the same account), most stones removed, number
of islands II (land added over time), graph valid tree (n − 1 edges and no cycle), satisfiability of
equality equations, and Kruskal's minimum spanning tree. Explain both optimizations and say the
complexity as "nearly O(1) per operation, amortized".

Likely follow-up questions:

- What do path compression and union by rank each fix?
- How do you count the remaining groups?
- Why can't union-find detect cycles in a directed graph?
- When would you choose union-find over BFS or DFS?
