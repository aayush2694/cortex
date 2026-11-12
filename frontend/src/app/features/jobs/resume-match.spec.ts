import { byCategory } from './resume-match';

describe('byCategory', () => {
  it('groups skills by category in order and keeps whether each is required', () => {
    expect(
      byCategory([
        { name: 'Python', category: 'Languages', required: true },
        { name: 'React', category: 'Frontend', required: false },
        { name: 'SQL', category: 'Languages', required: true },
      ]),
    ).toEqual([
      { category: 'Languages', items: [{ name: 'Python', required: true }, { name: 'SQL', required: true }] },
      { category: 'Frontend', items: [{ name: 'React', required: false }] },
    ]);
  });
});
