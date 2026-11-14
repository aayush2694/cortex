## In short

A monotonic stack is an ordinary stack that you keep in sorted order (always increasing or always
decreasing) by popping anything that would break the order before you push. It answers "for each
element, what is the next (or previous) greater or smaller element?" for the whole array in O(n)
time, where the obvious solution checks every pair in O(n²). Each element is pushed once and popped
at most once. The same idea solves daily temperatures, stock span, largest rectangle in a histogram
and trapping rain water.

## The idea

Imagine people standing in a line facing right, and each wants to know who is the first taller
person in front of them. Walk the line from left to right, keeping a stack of people who are still
waiting for an answer. When a new person arrives, everyone on the stack who is shorter has just
found their answer: it is the new person. Pop them and record it. Then the new person joins the stack
and waits too.

Notice what the stack looks like: the people still waiting are always in decreasing height order
from bottom to top, because any shorter person behind a taller one would already have been popped.
That is the "monotonic" part, and it is a consequence of the popping rule, not something you sort.

Two choices define every variant:

1. **Increasing or decreasing stack.** Looking for the next **greater** element: keep a decreasing
   stack and pop smaller items. Looking for the next **smaller**: keep an increasing stack and pop
   larger items.
2. **What to store.** Store **indexes**, not values. With an index you can read the value and also
   compute distances ("how many days until warmer?").

## How it works

Daily temperatures `[73, 74, 75, 71, 69, 72, 76, 73]`: for each day, how many days until a warmer one?

1. Day 0 (73): stack empty, push 0.
2. Day 1 (74): 74 > 73, so day 0 waited 1 day. Pop 0, push 1.
3. Day 2 (75): pops day 1 (1 day). Push 2.
4. Days 3 (71) and 4 (69) are colder; push both. Stack holds days 2, 3, 4 (75, 71, 69).
5. Day 5 (72): pops day 4 (1 day) and day 3 (2 days); 75 is warmer, so stop. Push 5.
6. Day 6 (76): pops day 5 (1 day) and day 2 (4 days). Push 6.
7. Day 7 (73): colder, push. Days 6 and 7 never find a warmer day; their answer stays 0.

Result: `[1, 1, 4, 2, 1, 1, 0, 0]`.

Largest rectangle in a histogram uses an increasing stack: when a bar is popped because a shorter bar
arrived, that popped bar's rectangle can extend left to the new top of the stack and right to the
current index, so its best area is known at that moment.

## Code

```python run
def daily_temperatures(temps: list[int]) -> list[int]:
    answer = [0] * len(temps)
    stack: list[int] = []                         # indexes, temperatures decreasing
    for i, t in enumerate(temps):
        while stack and temps[stack[-1]] < t:     # t is the answer for these days
            j = stack.pop()
            answer[j] = i - j
        stack.append(i)
    return answer


def next_greater(nums: list[int]) -> list[int]:
    """Next greater value to the right, or -1."""
    result = [-1] * len(nums)
    stack: list[int] = []
    for i, x in enumerate(nums):
        while stack and nums[stack[-1]] < x:
            result[stack.pop()] = x
        stack.append(i)
    return result


def largest_rectangle(heights: list[int]) -> int:
    stack: list[int] = []                         # indexes, heights increasing
    best = 0
    for i, h in enumerate([*heights, 0]):         # sentinel 0 flushes the stack
        while stack and heights[stack[-1]] > h:
            height = heights[stack.pop()]
            left = stack[-1] if stack else -1
            best = max(best, height * (i - left - 1))
        stack.append(i)
    return best


assert daily_temperatures([73, 74, 75, 71, 69, 72, 76, 73]) == [1, 1, 4, 2, 1, 1, 0, 0]
assert next_greater([2, 1, 2, 4, 3]) == [4, 2, 4, -1, -1]
assert largest_rectangle([2, 1, 5, 6, 2, 3]) == 10
assert largest_rectangle([]) == 0
```

## Common mistakes

- **Storing values instead of indexes**, which makes distances impossible to compute.
- **Picking the wrong direction**: decreasing stack for next greater, increasing for next smaller.
- **`<` versus `<=`** when equal values exist: decide whether an equal value counts as "greater" and
  test it.
- **Forgetting leftover items**: elements still on the stack at the end have no answer; set a default
  (0 or −1) or flush with a sentinel.
- **Calling it O(n²)** because of the nested loop. Each index is pushed and popped at most once, so
  the total is O(n).

## In interviews

Signals: "next greater", "next smaller", "previous greater", "how many days until", "span", or
anything where each element needs the nearest element on one side satisfying a comparison. Problems:
next greater element I and II (circular: loop twice over the array), daily temperatures, online stock
span, remove k digits, largest rectangle in histogram, trapping rain water, sum of subarray minimums.
Sliding window maximum uses the deque version of the same idea.

Likely follow-up questions:

- Why is the total work O(n)?
- How do you handle a circular array?
- How would you find the previous smaller element instead?
- How does this solve the largest rectangle in a histogram?
