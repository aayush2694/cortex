import { tutorPrompt } from './tutor-prompt';

const problem = { title: 'Pair with target sum', language: 'python' as const };

describe('tutorPrompt (the message the "Ask the tutor" button starts)', () => {
  it('includes the problem, the failing case and the code, and asks for a hint', () => {
    const msg = tutorPrompt(problem, 'def f(nums, target):\n    return []', {
      input: 'nums = [1, 3], target = 4',
      expected: '[0, 1]',
      got: '[]',
    });
    expect(msg).toContain('"Pair with target sum"');
    expect(msg).toContain('nums = [1, 3], target = 4');
    expect(msg).toContain('Expected: [0, 1]');
    expect(msg).toContain('Got: []');
    expect(msg).toContain('```python\ndef f(nums, target):');
    expect(msg).toMatch(/hint/i);
  });

  it('works without a failing case and for SQL', () => {
    const msg = tutorPrompt({ title: 'Running total', language: 'sql' }, 'SELECT 1', null);
    expect(msg).toContain('```sql\nSELECT 1');
    expect(msg).not.toContain('Expected:');
  });

  it('shows errors instead of output', () => {
    const msg = tutorPrompt(problem, 'x', { input: 'a', expected: '1', error: 'IndexError (line 2)' });
    expect(msg).toContain('Error: IndexError (line 2)');
    expect(msg).not.toContain('Got:');
  });

  it('cuts very long code so the link stays short', () => {
    const msg = tutorPrompt(problem, 'x'.repeat(5000), null);
    expect(msg.length).toBeLessThan(3000);
    expect(msg).toContain('(cut)');
  });
});
