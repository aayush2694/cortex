## In short

An array stores items side by side in one block of memory, so reading or writing item `i` is O(1):
the address is just `start + i × item_size`. Appending to the end of a dynamic array (Python
`list`, Java `ArrayList`, JavaScript arrays) is O(1) amortized. Inserting or deleting anywhere else
is O(n), because every later item must shift. Searching an unsorted array is O(n). Arrays are the
base of most interview problems and of many other structures: stacks, heaps, hash tables.

## The idea

Think of a row of numbered lockers. If you know the number, you walk straight to it: no searching.
That is random access, and it is the array's superpower. The price shows up when you want to put a
new locker in the middle: everyone after it has to move one place to the right.

A **static** array has a fixed size chosen at creation (C arrays, Java `int[]`). A **dynamic**
array grows on demand. Under the hood it keeps spare capacity; when it fills up, it allocates a
bigger block (often about 1.5× or 2× larger) and copies everything over. That copy costs O(n), but it
happens so rarely that the average cost per append stays O(1). This is called amortized O(1).

Because items sit next to each other, arrays are also very cache-friendly: the CPU loads nearby
memory together, so looping through an array is much faster in practice than following pointers in a
linked list, even when both are O(n).

## How it works

Start with `a = [3, 8, 1]` with capacity 4.

1. `a[1]` reads the slot at offset 1: 8. One step, whatever the length.
2. `a.append(5)` writes into the spare slot: `[3, 8, 1, 5]`. Now full.
3. `a.append(9)`: no room, so the array allocates a bigger block, copies four items, then writes 9.
   This one append costs O(n); the next few are cheap again.
4. `a.insert(0, 7)` must shift 3, 8, 1, 5 and 9 one place right before writing 7 at the front: O(n).
5. `a.pop()` removes the last item: O(1). `a.pop(0)` removes the first and shifts everything left:
   O(n). If you need fast removal from the front, use a deque.

Many array techniques in interviews avoid these shifts: write results into a second index instead
of deleting (the read/write two-pointer trick), swap the item to delete with the last one when order
does not matter, or build a new array in one pass.

## Code

```python run
def remove_value(nums: list[int], val: int) -> int:
    """Remove every `val` in place, keep the order of the rest, return the new length.
    O(n) time, O(1) extra space: one pointer reads, one writes."""
    write = 0
    for read in range(len(nums)):
        if nums[read] != val:
            nums[write] = nums[read]
            write += 1
    return write


def rotate_right(nums: list[int], k: int) -> None:
    """Rotate in place by k using three reversals. O(n) time, O(1) space."""
    def reverse(lo: int, hi: int) -> None:
        while lo < hi:
            nums[lo], nums[hi] = nums[hi], nums[lo]
            lo, hi = lo + 1, hi - 1

    n = len(nums)
    if n == 0:
        return
    k %= n
    reverse(0, n - 1)
    reverse(0, k - 1)
    reverse(k, n - 1)


a = [3, 2, 2, 3, 4]
length = remove_value(a, 3)
assert a[:length] == [2, 2, 4]

b = [1, 2, 3, 4, 5, 6, 7]
rotate_right(b, 3)
assert b == [5, 6, 7, 1, 2, 3, 4]
```

The rotation trick reverses the whole array, then reverses each of the two parts back. It is a good
example of solving an array problem with no extra memory.

## Common mistakes

- **Off-by-one errors** with `range(len(a))`, `a[len(a)]` (out of range) and inclusive versus
  exclusive end indexes in slices.
- **Deleting while looping forward** over the same list skips items. Loop backwards, build a new
  list, or use the read/write pointer pattern.
- **Hidden O(n) operations** inside a loop: `insert(0, x)`, `pop(0)`, `x in lst`, `lst.index(x)`
  and slicing all copy or scan.
- **Aliasing**: `grid = [[0] * 3] * 3` creates three references to the *same* row. Use
  `[[0] * 3 for _ in range(3)]`.
- **Forgetting empty arrays** and single-item arrays in edge cases.

## In interviews

Arrays are the setting for most easy and medium problems: two sum, best time to buy and sell stock,
move zeroes, product of array except self, rotate array, maximum subarray. Interviewers look for
whether you can avoid O(n²) by using a hash map, prefix sums, two pointers or a sliding window, and
whether you can work in place when memory is limited. Always state whether you modify the input and
ask whether that is allowed.

Likely follow-up questions:

- Why is indexing O(1) but inserting at the front O(n)?
- How does a dynamic array grow, and why is append still O(1) on average?
- Can you do it in place with O(1) extra memory?
- Arrays or linked lists: when would you pick each?
