import { splitGuide } from './guide-format';

describe('splitGuide', () => {
  it('splits on section headings and makes ids from titles', () => {
    const sections = splitGuide('## In short\n\nA\n\n## Common mistakes\n\nB\n');
    expect(sections.map((s) => s.id)).toEqual(['guide-in-short', 'guide-common-mistakes']);
    expect(sections.map((s) => s.title)).toEqual(['In short', 'Common mistakes']);
    expect(sections[0].body.trim()).toBe('A');
  });

  it('ignores ## lines inside code blocks', () => {
    const sections = splitGuide(
      '## In short\n\nA\n\n## Code\n\n```python\n## not a heading\n```\n',
    );
    expect(sections.length).toBe(2);
    expect(sections[1].body).toContain('## not a heading');
  });

  it('handles Trade-offs in the id', () => {
    expect(splitGuide('## Trade-offs\n\nx')[0].id).toBe('guide-trade-offs');
  });
});
