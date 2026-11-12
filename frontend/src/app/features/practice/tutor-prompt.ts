const MAX_CODE = 2000; // keeps the /tutor?ask=… link a reasonable length

export interface FailingCase {
  input: string;
  expected: string;
  got?: string;
  error?: string;
}

/** The message "Ask the tutor" starts with: the problem, a failing case and your code. */
export function tutorPrompt(
  problem: { title: string; language: 'python' | 'sql' },
  code: string,
  failing: FailingCase | null,
): string {
  const lines = [`I'm working on the practice problem "${problem.title}".`];
  if (failing) {
    lines.push(
      '',
      'This case fails:',
      `Input: ${failing.input}`,
      `Expected: ${failing.expected}`,
      failing.error ? `Error: ${failing.error}` : `Got: ${failing.got ?? ''}`,
    );
  }
  const body = code.length > MAX_CODE ? `${code.slice(0, MAX_CODE)}\n… (cut)` : code;
  lines.push('', 'My code:', '```' + problem.language, body.trimEnd(), '```', '', 'Give me a hint, not the full solution.');
  return lines.join('\n');
}
