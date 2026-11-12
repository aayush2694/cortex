/** Show a value the way Python would print it: [1, 2], "abc", True, None, {"a": 1}. */
export function show(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (Array.isArray(value)) return `[${value.map(show).join(', ')}]`;
  if (typeof value === 'object') {
    const items = Object.entries(value as Record<string, unknown>);
    return `{${items.map(([k, v]) => `${JSON.stringify(k)}: ${show(v)}`).join(', ')}}`;
  }
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

/** Split a statement into paragraphs, and each paragraph into text and `code` pieces. */
export function paragraphs(text: string): { code: boolean; text: string }[][] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((para) =>
      para
        .replace(/\s*\n\s*/g, ' ')
        .split('`')
        .map((piece, i) => ({ code: i % 2 === 1, text: piece }))
        .filter((p) => p.text),
    );
}
