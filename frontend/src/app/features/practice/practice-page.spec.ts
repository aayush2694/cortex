import { paragraphs, show } from './practice-page';

describe('show (values printed the way Python would)', () => {
  it('formats Python literals', () => {
    expect(show(null)).toBe('None');
    expect(show(true)).toBe('True');
    expect(show(false)).toBe('False');
    expect(show(undefined)).toBe('—');
  });

  it('formats numbers, strings and nested lists', () => {
    expect(show(14.5)).toBe('14.5');
    expect(show('abba')).toBe('"abba"');
    expect(show([[1, 2], [3, null]])).toBe('[[1, 2], [3, None]]');
  });

  it('formats objects with a space after each colon', () => {
    expect(show({ values: [3, 2], pos: 1 })).toBe('{"values": [3, 2], "pos": 1}');
  });
});

describe('paragraphs (problem statement parsing)', () => {
  it('splits on blank lines and joins wrapped lines', () => {
    const out = paragraphs('First line\nsame paragraph.\n\nSecond.');
    expect(out.length).toBe(2);
    expect(out[0]).toEqual([{ code: false, text: 'First line same paragraph.' }]);
  });

  it('marks `backtick` pieces as code', () => {
    const [para] = paragraphs('Return `[]` if `nums` is empty.');
    expect(para.filter((p) => p.code).map((p) => p.text)).toEqual(['[]', 'nums']);
    expect(para.map((p) => p.text).join('')).toBe('Return [] if nums is empty.');
  });
});
