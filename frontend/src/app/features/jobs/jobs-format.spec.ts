import { daysSince, firstYear, hike, lpa, recurring, relativeDay } from './jobs-format';

const offer = { fixed: 16, variable: 2, joining_bonus: 1.5, stock_per_year: 1 };

describe('offer maths', () => {
  it('adds up recurring and first-year pay', () => {
    expect(recurring(offer)).toBe(19);
    expect(firstYear(offer)).toBe(20.5);
    expect(recurring({ fixed: null, variable: null, joining_bonus: null, stock_per_year: null })).toBe(0);
  });

  it('computes the hike against current pay', () => {
    expect(hike(16, 11)).toBe(45);
    expect(hike(9, 10)).toBe(-10);
    expect(hike(16, null)).toBeNull();
    expect(hike(0, 11)).toBeNull();
  });

  it('formats lakhs', () => {
    expect(lpa(16)).toBe('₹16 L');
    expect(lpa(16.456)).toBe('₹16.46 L');
    expect(lpa(null)).toBe('—');
  });
});

describe('dates', () => {
  const today = new Date(2026, 10, 12, 15, 0);
  it('counts days and describes them', () => {
    expect(daysSince('2026-11-10', today)).toBe(2);
    expect(relativeDay('2026-11-12', today)).toBe('today');
    expect(relativeDay('2026-11-13', today)).toBe('tomorrow');
    expect(relativeDay('2026-11-15', today)).toBe('in 3 days');
    expect(relativeDay('2026-11-09', today)).toBe('3 days ago');
  });
});
