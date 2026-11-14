## In short

Many dynamic programming problems use a 2D table: either a real grid (count or price the paths from
the top-left to the bottom-right) or two sequences compared position by position (longest common
subsequence, edit distance). Each cell `dp[i][j]` stores the answer for a smaller subproblem and is
computed from a few neighbouring cells, usually the one above, the one to the left, and the diagonal.
Filling the table costs O(n · m) time and memory; since each row usually needs only the row above,
memory can often drop to O(m).

## The idea

Picture walking through a city grid from the top-left corner to the bottom-right, only moving right or
down. How many different routes are there? Every route into a corner arrives either from the corner
above or the corner to the left. So the number of routes to a corner is the sum of the routes to those
two corners. Fill the first row and column with 1 (only one way to walk a straight edge), then fill the
rest left to right, top to bottom. The bottom-right cell holds the answer.

That is the whole shape of grid DP: each cell's answer depends only on cells you have already filled.

Two-string problems use the same table with a different meaning. For two words `a` and `b`, let
`dp[i][j]` describe the first i letters of `a` and the first j letters of `b`. Then look at the **last
letters** of those prefixes:

- **Longest common subsequence**: if the last letters match, they extend the best answer for the
  shorter prefixes: `dp[i - 1][j - 1] + 1`. If not, drop one last letter or the other and take the
  better: `max(dp[i - 1][j], dp[i][j - 1])`.
- **Edit distance** (insert, delete, replace): if the last letters match, no cost:
  `dp[i - 1][j - 1]`. Otherwise `1 + min(insert, delete, replace)`, which are the cells to the left,
  above and diagonal.

Row 0 and column 0 represent an empty prefix, which gives the base cases (an empty word has LCS 0 with
anything, and edit distance j from a word of length j).

## How it works

LCS of `"abcde"` and `"ace"`:

1. Make a 6 × 4 table (one extra row and column for empty prefixes), filled with 0.
2. Row `a`: matches `a` at column 1, so `dp[1][1] = dp[0][0] + 1 = 1`; the rest of the row carries 1
   to the right.
3. Row `b`: no matches; each cell takes the max of above and left, so the row stays 1.
4. Row `c`: matches `c` at column 2: `dp[3][2] = dp[2][1] + 1 = 2`.
5. Row `e` (the last) matches `e` at column 3: `dp[5][3] = dp[4][2] + 1 = 3`.
6. The answer is `dp[5][3] = 3` ("ace"). Walking back through the table from that cell recovers the
   actual subsequence.

Time and space are O(n · m). Because each row reads only the previous row, you can keep two rows (or
one row plus a saved diagonal value) and use O(m) memory.

## Code

```python run
def unique_paths(rows: int, cols: int) -> int:
    row = [1] * cols                                 # one row reused: O(cols) memory
    for _ in range(1, rows):
        for c in range(1, cols):
            row[c] += row[c - 1]                     # from above (old row[c]) + from the left
    return row[-1]


def min_path_sum(grid: list[list[int]]) -> int:
    rows, cols = len(grid), len(grid[0])
    dp = [[0] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            if r == 0 and c == 0:
                dp[r][c] = grid[r][c]
            else:
                above = dp[r - 1][c] if r else float("inf")
                left = dp[r][c - 1] if c else float("inf")
                dp[r][c] = grid[r][c] + int(min(above, left))
    return dp[-1][-1]


def lcs(a: str, b: str) -> int:
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[-1][-1]


def edit_distance(a: str, b: str) -> int:
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        dp[i][0] = i                                 # delete everything
    for j in range(len(b) + 1):
        dp[0][j] = j                                 # insert everything
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return dp[-1][-1]


assert unique_paths(3, 7) == 28
assert min_path_sum([[1, 3, 1], [1, 5, 1], [4, 2, 1]]) == 7
assert lcs("abcde", "ace") == 3 and lcs("abc", "def") == 0
assert edit_distance("horse", "ros") == 3
assert edit_distance("", "abc") == 3
```

## Common mistakes

- **Off-by-one between string index and table index**: `dp[i][j]` uses `a[i - 1]` and `b[j - 1]`.
- **Skipping the empty-prefix row and column**, which makes base cases messy and buggy.
- **Wrong fill order**, so a cell reads a value that has not been computed.
- **Shared rows**: `[[0] * m] * n` makes every row the same list.
- **Overwriting the diagonal** too early when compressing to one row; save it in a variable first.

## In interviews

Problems: unique paths I and II (with obstacles), minimum path sum, maximal square, longest common
subsequence, edit distance, longest palindromic subsequence (LCS of a string and its reverse),
interleaving string, distinct subsequences. Say what `dp[i][j]` means in words, which neighbours it
reads, the base row and column, the fill order, and the complexity. Offering the O(m) memory version
is a common follow-up.

Likely follow-up questions:

- What exactly does `dp[i][j]` represent?
- Can you reduce memory to one row?
- How would you reconstruct the actual subsequence or the list of edits?
- How do obstacles change unique paths?
