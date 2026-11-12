/** Reference data for the Big-O cheat sheet. Average case unless a column says otherwise. */

export interface DsRow {
  name: string;
  access: string;
  search: string;
  insert: string;
  remove: string;
  space: string;
  note: string;
}

export const DATA_STRUCTURES: DsRow[] = [
  { name: 'Array (Python list)', access: 'O(1)', search: 'O(n)', insert: 'O(1)*', remove: 'O(n)', space: 'O(n)', note: '* append is amortised O(1); insert/delete in the middle shifts items' },
  { name: 'Linked list', access: 'O(n)', search: 'O(n)', insert: 'O(1)', remove: 'O(1)', space: 'O(n)', note: 'O(1) once you hold the node; finding it is O(n)' },
  { name: 'Stack / queue (deque)', access: 'O(n)', search: 'O(n)', insert: 'O(1)', remove: 'O(1)', space: 'O(n)', note: 'collections.deque: O(1) at both ends' },
  { name: 'Hash map / set', access: '—', search: 'O(1)', insert: 'O(1)', remove: 'O(1)', space: 'O(n)', note: 'Worst case O(n) with many collisions' },
  { name: 'Binary heap', access: 'O(1)', search: 'O(n)', insert: 'O(log n)', remove: 'O(log n)', space: 'O(n)', note: 'Access = peek at min (heapq); heapify is O(n)' },
  { name: 'Balanced BST', access: 'O(log n)', search: 'O(log n)', insert: 'O(log n)', remove: 'O(log n)', space: 'O(n)', note: 'Unbalanced BST degrades to O(n)' },
  { name: 'Trie', access: '—', search: 'O(k)', insert: 'O(k)', remove: 'O(k)', space: 'O(total chars)', note: 'k = length of the word' },
  { name: 'Graph (adjacency list)', access: '—', search: 'O(V + E)', insert: 'O(1)', remove: 'O(E)', space: 'O(V + E)', note: 'BFS / DFS visit every vertex and edge once' },
];

export interface SortRow {
  name: string;
  best: string;
  average: string;
  worst: string;
  space: string;
  stable: boolean;
}

export const SORTS: SortRow[] = [
  { name: 'Bubble sort', best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true },
  { name: 'Insertion sort', best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true },
  { name: 'Selection sort', best: 'O(n²)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: false },
  { name: 'Merge sort', best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: true },
  { name: 'Quick sort', best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)', stable: false },
  { name: 'Heap sort', best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)', stable: false },
  { name: 'Counting sort', best: 'O(n + k)', average: 'O(n + k)', worst: 'O(n + k)', space: 'O(k)', stable: true },
  { name: 'Timsort (Python sorted)', best: 'O(n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: true },
];

/** Roughly 10^8 simple operations a second: what input size each complexity can handle. */
export const LIMITS: { n: string; complexity: string; example: string }[] = [
  { n: 'n ≤ 10', complexity: 'O(n!)', example: 'All permutations' },
  { n: 'n ≤ 20', complexity: 'O(2ⁿ)', example: 'All subsets, bitmask DP' },
  { n: 'n ≤ 500', complexity: 'O(n³)', example: 'Three nested loops, Floyd–Warshall' },
  { n: 'n ≤ 10⁴', complexity: 'O(n²)', example: 'Two nested loops, 2D DP' },
  { n: 'n ≤ 10⁶', complexity: 'O(n log n)', example: 'Sorting, heaps, binary search per item' },
  { n: 'n ≤ 10⁸', complexity: 'O(n)', example: 'One pass, two pointers, sliding window' },
  { n: 'larger', complexity: 'O(log n) or O(1)', example: 'Binary search, maths' },
];

export const PYTHON_OPS: { op: string; cost: string; tip?: string }[] = [
  { op: 'list.append(x), list.pop()', cost: 'O(1)' },
  { op: 'list.insert(0, x), list.pop(0)', cost: 'O(n)', tip: 'Use collections.deque' },
  { op: 'x in list', cost: 'O(n)', tip: 'Use a set for repeated lookups' },
  { op: 'x in set, d[key], d.get(key)', cost: 'O(1)' },
  { op: 'list[a:b] (slicing)', cost: 'O(b − a)', tip: 'Copies; avoid inside loops' },
  { op: 'sorted(xs), xs.sort()', cost: 'O(n log n)' },
  { op: 'heapq.heappush / heappop', cost: 'O(log n)' },
  { op: 'heapq.heapify(xs)', cost: 'O(n)' },
  { op: 'deque.appendleft / popleft', cost: 'O(1)' },
  { op: 's += "x" in a loop', cost: 'O(n²) total', tip: 'Collect parts, then "".join(parts)' },
  { op: 'Counter(xs), set(xs), dict(pairs)', cost: 'O(n)' },
  { op: 'min(xs), max(xs), sum(xs)', cost: 'O(n)' },
];

/** Shapes for the growth chart: name, function and how the line is drawn. */
export const CURVES: { label: string; f: (n: number) => number; dash: string; width: number }[] = [
  { label: 'O(1)', f: () => 1, dash: '', width: 2 },
  { label: 'O(log n)', f: (n) => Math.log2(n), dash: '', width: 2 },
  { label: 'O(n)', f: (n) => n, dash: '6 4', width: 2 },
  { label: 'O(n log n)', f: (n) => n * Math.log2(n), dash: '2 3', width: 2 },
  { label: 'O(n²)', f: (n) => n * n, dash: '', width: 3 },
  { label: 'O(2ⁿ)', f: (n) => 2 ** n, dash: '10 4', width: 3 },
];

/** How fast a complexity grows: 0 constant, 1 logarithmic, 2 linear, 3 n log n, 4 polynomial, 5 exponential. */
export function costRank(complexity: string): number {
  const c = complexity.replace(/\s/g, '');
  if (/n!|2ⁿ/.test(c)) return 5;
  if (/n²|n³/.test(c)) return 4;
  if (c.includes('nlogn')) return 3;
  if (c.includes('logn')) return 1;
  if (c.startsWith('O(1)')) return 0;
  return 2;
}
