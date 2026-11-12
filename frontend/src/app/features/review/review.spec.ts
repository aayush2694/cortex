import { answerParts } from './review';
import { levelFor } from '../../shared/activity-heatmap';

describe('answerParts (how a card answer is shown)', () => {
  it('shows a template as code', () => {
    expect(answerParts({ kind: 'template', back: 'def f():\n    pass' })).toEqual({
      type: 'code',
      text: 'def f():\n    pass',
    });
  });

  it('turns "- " lines into bullets', () => {
    expect(answerParts({ kind: 'ideas', back: '- one\n- two' })).toEqual({
      type: 'bullets',
      items: ['one', 'two'],
    });
  });

  it('keeps anything else as paragraphs', () => {
    expect(answerParts({ kind: 'custom', back: 'First.\n\nSecond.' })).toEqual({
      type: 'text',
      paragraphs: ['First.', 'Second.'],
    });
  });
});

describe('levelFor (heatmap brightness)', () => {
  it('buckets daily activity', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 10, 50].map(levelFor)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});
