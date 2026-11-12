import { DATA_STRUCTURES, SORTS, costRank } from './cheatsheet-data';

describe('costRank', () => {
  it('orders complexities from cheapest to most expensive', () => {
    const order = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)'].map(costRank);
    expect(order).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('handles the variants used in the tables', () => {
    expect(costRank('O(1)*')).toBe(0);
    expect(costRank('O(n + k)')).toBe(2);
    expect(costRank('O(V + E)')).toBe(2);
    expect(costRank('O(n!)')).toBe(5);
    expect(costRank('O(n²) total')).toBe(4);
  });

  it('is defined for every cell in the tables', () => {
    for (const row of DATA_STRUCTURES) expect(costRank(row.search)).toBeGreaterThanOrEqual(0);
    for (const row of SORTS) expect(costRank(row.worst)).toBeGreaterThanOrEqual(0);
  });
});
