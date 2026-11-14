## In short

Big-O describes how the work an algorithm does **grows** as its input grows, ignoring constant
factors and small terms. O(1) stays flat, O(log n) grows very slowly, O(n) grows in step with the
input, O(n log n) is the cost of good sorting, O(n²) blows up quickly and O(2ⁿ) is only usable for
tiny inputs. It is used for both time and extra memory, and by convention it describes the worst
case unless you say otherwise.

## The idea

Timing code with a stopwatch tells you how fast it ran on one machine, with one input, today. Big-O
answers a more useful question: if the input becomes ten times bigger, what happens to the work?

Picture finding a name in a phone book. Reading every page is O(n): a book twice as thick takes
twice as long. Opening the middle and halving each time is O(log n): doubling the book adds just
one more step. Comparing every person with every other person to find two with the same birthday is
O(n²): double the people and the work quadruples.

Big-O keeps only the part that dominates for large inputs. An algorithm doing `3n² + 10n + 50`
steps is O(n²), because for big n the `n²` term swamps the rest and constant factors depend on the
machine anyway. This is what makes it a shared language: "this is quadratic" means the same thing
in any language and on any hardware.

## How it works

To find the Big-O of code, count how many times the innermost work runs as a function of n.

1. **Single statements** and arithmetic are O(1).
2. **A loop over n items** doing O(1) work is O(n).
3. **Nested loops** multiply: a loop over n inside a loop over n is O(n²). A loop over n inside a
   loop over m is O(n · m), not O(n²).
4. **Sequential blocks** add, and you keep the biggest: O(n) followed by O(n²) is O(n²).
5. **Halving the problem** each step gives O(log n): binary search, a balanced tree lookup.
6. **Recursion**: count calls × work per call. Recursive Fibonacci makes about 2ⁿ calls; merge sort
   does O(n) work on each of log n levels, so O(n log n).

Rough guide for a modern machine doing around 10⁸ simple steps per second: n up to about 10⁸ is
fine for O(n), 10⁶ for O(n log n), 10⁴ for O(n²), and about 25 for O(2ⁿ). These limits are how you
read the constraints in a coding problem and guess the intended complexity.

Space complexity works the same way but counts **extra** memory: a new list of n items is O(n);
a recursion that goes n levels deep uses O(n) stack.

Two refinements come up often. **Amortized** cost averages over a sequence: appending to a Python
list is O(1) amortized, because the occasional resize that copies everything is rare enough to
spread out. **Average vs worst case** matters for hash maps (O(1) average, O(n) worst) and quick
sort (O(n log n) average, O(n²) worst).

## Code

```python run
def has_duplicate_quadratic(nums: list[int]) -> bool:
    """O(n^2) time, O(1) extra space: compare every pair."""
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] == nums[j]:
                return True
    return False


def has_duplicate_linear(nums: list[int]) -> bool:
    """O(n) time, O(n) extra space: remember what we've seen."""
    seen: set[int] = set()
    for x in nums:
        if x in seen:              # set lookup is O(1) on average
            return True
        seen.add(x)
    return False


def count_steps(n: int) -> int:
    """How many times does the inner line run? Halving -> about log2(n)."""
    steps = 0
    while n > 1:
        n //= 2
        steps += 1
    return steps


for data in ([1, 2, 3, 4], [5, 1, 5], []):
    assert has_duplicate_quadratic(data) == has_duplicate_linear(data)
assert count_steps(1_000_000) == 19
assert count_steps(1_000_000_000) == 29
```

The two duplicate checks return the same answers, but on a million items the quadratic one does
about 5 × 10¹¹ comparisons while the linear one does a million set lookups. That trade (more memory
for less time) is one of the most common moves in interviews.

## Common mistakes

- **Calling nested loops O(n²) automatically.** If the inner loop runs a fixed 26 times (letters),
  the total is O(26n) = O(n). Count what actually runs.
- **Ignoring hidden costs.** `x in some_list` is O(n), string concatenation in a loop can be O(n²),
  slicing copies, and `sorted()` is O(n log n). Library calls are not free.
- **Mixing up variables.** A grid of r rows and c columns is O(r · c), not O(n²).
- **Forgetting space.** Recursion depth, copies of the input and hash maps all count.
- **Treating Big-O as speed.** An O(n) algorithm with a huge constant can lose to O(n log n) on
  real inputs. Big-O is about growth, not about which is faster at n = 100.

## In interviews

You are expected to state the time and space complexity of every solution without being asked, and
to explain *why* in one sentence ("each element is pushed and popped at most once, so O(n)"). A
common flow: give a brute-force solution with its complexity, then improve it and say what changed.
Reading the input limits is a strong signal: n ≤ 10⁵ usually rules out O(n²).

Likely follow-up questions:

- What is the difference between O, Θ and Ω? (Upper bound, tight bound, lower bound; interviews
  usually say O when they mean the tight bound.)
- Why is appending to a dynamic array O(1) amortized?
- What is the space complexity of a recursive solution?
- Can you trade memory for time here?
