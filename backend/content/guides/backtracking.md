## In short

Backtracking builds a solution one choice at a time and, whenever a choice leads to a dead end,
**undoes it and tries the next option**. The calls form a decision tree; each root-to-leaf path is one
candidate. It generates all subsets, permutations and combinations, and solves puzzles like
N-Queens, Sudoku and word search. The running time is usually exponential (for example O(2ⁿ · n) for
subsets, O(n! · n) for permutations), so **pruning** (stopping early on hopeless branches) is what
makes it practical. Extra memory is O(n) for the current path, plus the output.

## The idea

Solving a maze by hand: at each fork you pick a corridor. If it dead-ends, you walk back to the fork
and try the next corridor. You never need a map of the whole maze, only the path you are on and which
corridors you have already tried at each fork.

In code, the pattern has three steps around a recursive call:

1. **Choose**: add an option to the current path.
2. **Explore**: recurse to make the next choice.
3. **Un-choose**: remove that option, restoring the state for the next option.

The un-choose step is what makes it backtracking rather than plain recursion: one shared path list is
reused for the whole search, instead of copying state at every step. When the path is complete (or
every step is a valid partial answer, as in subsets), record a **copy** of it.

Recognising which tree you are building avoids duplicates:

- **Subsets**: for each element, include it or not; pass a start index so you only look forward.
- **Combinations**: like subsets, but stop at size k (or when the sum reaches the target).
- **Permutations**: every unused element can come next; track which are used.

**Pruning** cuts branches that cannot succeed: if the remaining sum is negative, stop; if a queen is
attacked, do not place it; if the next letter does not match, turn back. Sorting the input often
enables pruning and makes skipping duplicates easy.

## How it works

All subsets of `[1, 2, 3]`, using a start index:

1. Path `[]` is recorded. From index 0, choose 1 → path `[1]`, recorded.
2. From index 1, choose 2 → `[1, 2]`, recorded. Choose 3 → `[1, 2, 3]`, recorded. Undo 3, undo 2.
3. Back in `[1]`, choose 3 → `[1, 3]`, recorded. Undo. Undo 1.
4. Back at `[]`, choose 2 → `[2]`, then `[2, 3]`. Then choose 3 → `[3]`.
5. Eight subsets in total: 2³, because each element is in or out.

For **combination sum** (reuse allowed) with candidates `[2, 3, 6, 7]` and target 7, sorting lets you
stop the loop as soon as a candidate is bigger than the remaining target, and passing the same index
again allows reuse. The answers are `[2, 2, 3]` and `[7]`.

## Code

```python run
def subsets(nums: list[int]) -> list[list[int]]:
    out: list[list[int]] = []
    path: list[int] = []

    def go(start: int) -> None:
        out.append(path[:])                       # record a copy
        for i in range(start, len(nums)):
            path.append(nums[i])                  # choose
            go(i + 1)                             # explore
            path.pop()                            # un-choose

    go(0)
    return out


def permutations(nums: list[int]) -> list[list[int]]:
    out: list[list[int]] = []
    path: list[int] = []
    used = [False] * len(nums)

    def go() -> None:
        if len(path) == len(nums):
            out.append(path[:])
            return
        for i, x in enumerate(nums):
            if not used[i]:
                used[i] = True; path.append(x)
                go()
                used[i] = False; path.pop()

    go()
    return out


def combination_sum(candidates: list[int], target: int) -> list[list[int]]:
    out: list[list[int]] = []
    path: list[int] = []
    candidates = sorted(candidates)

    def go(start: int, remaining: int) -> None:
        if remaining == 0:
            out.append(path[:])
            return
        for i in range(start, len(candidates)):
            if candidates[i] > remaining:         # prune: sorted, so the rest are too big
                break
            path.append(candidates[i])
            go(i, remaining - candidates[i])      # i, not i + 1: reuse allowed
            path.pop()

    go(0, target)
    return out


assert sorted(subsets([1, 2, 3])) == [[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]]
assert len(permutations([1, 2, 3])) == 6
assert combination_sum([2, 3, 6, 7], 7) == [[2, 2, 3], [7]]
```

## Common mistakes

- **Appending `path` instead of `path[:]`**: every recorded answer then points to the same list, which
  ends up empty.
- **Forgetting to undo** a choice (the `pop`, or resetting `used`), which leaks state into sibling
  branches.
- **Duplicates**: with repeated input values, sort and skip `nums[i] == nums[i - 1]` at the same depth.
- **Wrong start index**: `i + 1` for no reuse, `i` for reuse, `0` (plus a used array) for permutations.
- **No pruning**, so a solution that could finish quickly explores the whole tree.

## In interviews

Problems: subsets I and II, permutations I and II, combinations, combination sum I and II, letter
combinations of a phone number, generate parentheses, palindrome partitioning, word search, N-Queens,
Sudoku solver. Draw the first two levels of the decision tree, state what one node represents, how
you avoid duplicates and what you prune. Give the complexity in terms of the number of leaves times the
cost of copying each answer.

Likely follow-up questions:

- What is the time complexity, and why is it exponential?
- How do you avoid duplicate results when the input has repeats?
- Where can you prune in this problem?
- How is backtracking different from dynamic programming?
