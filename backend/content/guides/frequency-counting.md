## In short

Many problems become fast once you **remember what you have seen** in a hash map (Python `dict`,
`set`, `Counter`). Looking something up then costs O(1) on average instead of an O(n) scan, so a
nested-loop O(n²) solution often turns into a single O(n) pass, at the cost of O(n) memory. The two
everyday forms are **lookup** ("have I seen the complement of this?", as in two sum) and
**counting** ("how many times does each value appear?", as in anagrams and most frequent items).

## The idea

If someone reads you a list of numbers and asks "did any two add up to 10?", you can keep a mental
note of every number you have heard. When you hear 7, you check your notes for 3. You never go back
and re-read the list. A hash map is that note: you trade a little memory for not repeating work.

Counting is the same idea applied to frequencies. Two words are anagrams exactly when every letter
appears the same number of times in both. Instead of sorting or comparing letter by letter, count
the letters and compare the counts.

The interesting design choice is often the **key**. To group anagrams, you need a key that is the
same for every anagram of a word: its sorted letters (`"aet"` for eat, tea, ate) or a tuple of 26
letter counts. To find the longest run of consecutive numbers, put all numbers in a set and only
start counting from numbers whose predecessor is missing; each run is then walked once.

## How it works

Two sum: find indexes of two numbers adding to 9 in `[2, 7, 11, 15]`.

1. See 2. Need 7. The map is empty, so store `{2: 0}`.
2. See 7. Need 2. The map has 2 at index 0, so the answer is `(0, 1)`.

Checking before storing matters: it stops a number from pairing with itself (for example target 4
with a single 2), while still allowing two equal numbers at different indexes (`[3, 3]` with
target 6).

Group anagrams for `["eat", "tea", "tan", "ate", "nat", "bat"]`: compute each word's key
(`"aet"`, `"aet"`, `"ant"`, `"aet"`, `"ant"`, `"abt"`) and append the word to a list in a map under
that key. The map's values are the groups: three groups in one pass.

Top k frequent elements combines this with a heap or with **bucket sort** by frequency: counts are at
most n, so put each value into bucket number `count` and read buckets from high to low, which gives
O(n) overall.

## Code

```python run
from collections import Counter, defaultdict


def two_sum(nums: list[int], target: int) -> tuple[int, int] | None:
    seen: dict[int, int] = {}                     # value -> index
    for i, x in enumerate(nums):
        if target - x in seen:                    # check before storing
            return seen[target - x], i
        seen[x] = i
    return None


def is_anagram(a: str, b: str) -> bool:
    return Counter(a) == Counter(b)


def group_anagrams(words: list[str]) -> list[list[str]]:
    groups: defaultdict[str, list[str]] = defaultdict(list)
    for w in words:
        groups["".join(sorted(w))].append(w)
    return list(groups.values())


def longest_consecutive(nums: list[int]) -> int:
    """O(n): only start counting at the beginning of a run."""
    values = set(nums)
    best = 0
    for x in values:
        if x - 1 not in values:
            length = 1
            while x + length in values:
                length += 1
            best = max(best, length)
    return best


assert two_sum([2, 7, 11, 15], 9) == (0, 1)
assert two_sum([3, 3], 6) == (0, 1)
assert two_sum([2], 4) is None
assert is_anagram("listen", "silent") and not is_anagram("rat", "car")
assert sorted(map(sorted, group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"]))) == [
    ["ate", "eat", "tea"], ["bat"], ["nat", "tan"]]
assert longest_consecutive([100, 4, 200, 1, 3, 2]) == 4
```

## Common mistakes

- **Storing before checking** in two sum, so an element pairs with itself.
- **Using a list for membership** (`x in some_list` is O(n)) instead of a set or dict.
- **Mutable keys**: lists cannot be dict keys; convert to a tuple or string.
- **Forgetting the memory cost**: O(n) extra space. Mention it, and the sorted two-pointer
  alternative if memory is tight.
- **Assuming O(1) always**: hash lookups are O(1) on average; adversarial inputs can degrade them.

## In interviews

This is the most common first improvement over brute force. Signals: "find a pair", "seen before",
"duplicates", "anagram", "most frequent", "first unique character", "group by". Problems: two sum,
valid anagram, group anagrams, contains duplicate, top k frequent elements, longest consecutive
sequence, isomorphic strings. Say what the key and value are, and state the time and space
trade-off explicitly.

Likely follow-up questions:

- What if the input is sorted? (Two pointers with O(1) space.)
- What is the worst case of a hash map lookup, and why?
- How would you group anagrams without sorting each word? (A tuple of 26 counts.)
- How do you get the top k without sorting all counts? (Heap or bucket sort.)
