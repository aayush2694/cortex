import { formatInterval, localDay } from './format';

describe('formatInterval', () => {
  it('uses the largest sensible unit', () => {
    expect(formatInterval(10 / 1440)).toBe('10m');
    expect(formatInterval(0.25)).toBe('6h');
    expect(formatInterval(1)).toBe('1d');
    expect(formatInterval(25)).toBe('25d');
    expect(formatInterval(60)).toBe('2mo');
    expect(formatInterval(64)).toBe('2.1mo');
    expect(formatInterval(400)).toBe('1.1y');
  });
});

describe('localDay', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(localDay(new Date(2026, 10, 5, 23, 30))).toBe('2026-11-05');
  });
});
