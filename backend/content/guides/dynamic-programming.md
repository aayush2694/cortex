## In short

Dynamic programming (DP) solves a problem by breaking it into smaller **overlapping subproblems**,
solving each one **once**, and reusing the stored answers. It applies when the problem has an
**optimal substructure** (the best answer is built from best answers to subproblems) and the same
subproblems come up again and again. You can write it **top-down** (recursion plus a cache, called
memoization) or **bottom-up** (filling a table in order, called tabulation). Time is usually the number
of states times the work per state.

## The idea

Ask someone to compute 1 + 1 + 1 + 1 + 1 and they count five. Add "+ 1" at the end and they answer six
instantly, because they remembered the previous total instead of recounting. That memory is DP.

Plain recursion often recomputes the same thing many times. Counting the ways to climb n stairs taking
1 or 2 steps at a time follows `ways(n) = ways(n - 1) + ways(n - 2)`. Written naively, `ways(5)` calls
`ways(3)` twice and `ways(2)` three times; the call tree grows exponentially. But there are only n
different questions. Answer each once, store it, and the whole thing is O(n).

The hard part of DP is not the code; it is defining the **state**. A reliable recipe:

1. **Define the state in words.** "`dp[i]` = the most money I can rob from the first i houses."
2. **Write the recurrence** by thinking about the last decision. For house i: either skip it
   (`dp[i - 1]`) or rob it (`dp[i - 2] + money[i]`). Take the better one.
3. **Set the base cases**: `dp[0] = 0`, `dp[1] = money[0]`.
4. **Pick an order** in which every state's inputs are computed before it (here, increasing i).
5. **Find the answer** in the table (`dp[n]`), then see whether you can **shrink memory**: here only the
   last two values are needed, so O(1) space.

## How it works

Coin change: the fewest coins from `[1, 2, 5]` that make 11.

1. State: `dp[a]` = fewest coins that make amount a. Base case `dp[0] = 0`; everything else starts at
   infinity.
2. Recurrence: for each coin c ≤ a, `dp[a] = min(dp[a], dp[a - c] + 1)`: use coin c last, plus the best
   way to make the rest.
3. Fill a = 1..11: `dp[1] = 1`, `dp[2] = 1`, `dp[3] = 2`, `dp[4] = 2`, `dp[5] = 1`, … `dp[10] = 2`,
   `dp[11] = dp[10] + 1 = 3` (5 + 5 + 1).
4. Time O(amount × coins), space O(amount).

A greedy "always take the biggest coin" fails for coins `[1, 3, 4]` and amount 6: greedy gives
4 + 1 + 1 (three coins), DP finds 3 + 3 (two). That is the usual reason a problem needs DP instead of
greedy: local best choices do not add up to the global best.

Common families worth recognising: **1D sequences** (climbing stairs, house robber, decode ways),
**knapsack** (choose items under a capacity: partition equal subset sum, coin change, target sum),
**subsequences** (longest increasing subsequence), **two strings or grids** (edit distance, LCS: see DP
on grids), and **intervals** (burst balloons, palindromic substrings).

## Code

```python run
from functools import cache


def rob(money: list[int]) -> int:
    """Bottom-up with O(1) space: only the last two answers are kept."""
    prev, curr = 0, 0                       # dp[i-2], dp[i-1]
    for m in money:
        prev, curr = curr, max(curr, prev + m)
    return curr


def coin_change(coins: list[int], amount: int) -> int:
    INF = amount + 1
    dp = [0] + [INF] * amount
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a:
                dp[a] = min(dp[a], dp[a - c] + 1)
    return dp[amount] if dp[amount] < INF else -1


def length_of_lis(nums: list[int]) -> int:
    """Top-down: best(i) = longest increasing subsequence starting at i."""
    @cache
    def best(i: int) -> int:
        return 1 + max((best(j) for j in range(i + 1, len(nums)) if nums[j] > nums[i]),
                       default=0)
    return max((best(i) for i in range(len(nums))), default=0)


assert rob([2, 7, 9, 3, 1]) == 12
assert rob([]) == 0
assert coin_change([1, 2, 5], 11) == 3
assert coin_change([1, 3, 4], 6) == 2          # greedy would say 3
assert coin_change([2], 3) == -1
assert length_of_lis([10, 9, 2, 5, 3, 7, 101, 18]) == 4
```

## Common mistakes

- **Starting from code instead of a state definition.** If you cannot say what `dp[i]` means in one
  sentence, the recurrence will be wrong.
- **Wrong base cases or table size** (off by one between "first i items" and "item i").
- **Filling the table in the wrong order**, so a cell reads values not computed yet.
- **Using greedy** where choices interact.
- **Memoizing on mutable or unhashable arguments** (lists); pass indexes instead.
- **Forgetting the "impossible" case** (return −1 when no answer exists).

## In interviews

DP is often the hardest topic in a coding round. Problems: climbing stairs, house robber I and II,
coin change, longest increasing subsequence, word break, decode ways, partition equal subset sum,
unique paths, longest common subsequence, edit distance. Talk through the recipe: state, recurrence,
base cases, order, answer, then complexity. Starting with the recursive brute force and adding a cache
is a perfectly good path; converting to bottom-up and reducing memory are strong follow-ups.

Likely follow-up questions:

- What are the overlapping subproblems here?
- Top-down or bottom-up: what are the trade-offs?
- Can you reduce the space?
- Why doesn't a greedy approach work for this problem?
