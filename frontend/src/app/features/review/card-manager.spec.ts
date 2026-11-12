import { TestBed } from '@angular/core/testing';

import { Api } from '../../core/api/api';
import { Flashcard } from '../../core/api/models';
import { CardManager } from './card-manager';

const card = (id: number, front: string): Flashcard => ({
  id,
  topic_id: null,
  kind: 'custom',
  front,
  back: 'answer',
  reps: 0,
  lapses: 0,
  interval_days: 0,
  due_at: new Date().toISOString(),
  last_reviewed_at: null,
  next: { again: 0.007, hard: 0.5, good: 1, easy: 4 },
});

describe('CardManager', () => {
  const calls: unknown[][] = [];
  const fakeApi = {
    editCard: async (id: number, body: { front: string; back: string }) => {
      calls.push(['edit', id, body]);
      return { ...card(id, body.front), back: body.back };
    },
    deleteCard: async (id: number) => {
      calls.push(['delete', id]);
    },
  };

  async function render(cards: Flashcard[]) {
    calls.length = 0;
    TestBed.configureTestingModule({ providers: [{ provide: Api, useValue: fakeApi }] });
    const fixture = TestBed.createComponent(CardManager);
    fixture.componentRef.setInput('cards', cards);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const button = (el: HTMLElement, label: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;

  it('lists your cards', async () => {
    const { el } = await render([card(1, 'What is a GIL?'), card(2, 'What is MVCC?')]);
    expect([...el.querySelectorAll('.front')].map((f) => f.textContent?.trim())).toEqual([
      'What is a GIL?',
      'What is MVCC?',
    ]);
  });

  it('edits a card in place', async () => {
    const { fixture, el } = await render([card(1, 'Old question')]);
    button(el, 'Edit').click();
    await fixture.whenStable();
    const front = el.querySelector<HTMLTextAreaElement>('textarea[name=front]')!;
    front.value = 'New question';
    front.dispatchEvent(new Event('input'));
    button(el, 'Save').click();
    await fixture.whenStable();
    expect(calls).toEqual([['edit', 1, { front: 'New question', back: 'answer' }]]);
    expect(el.querySelector('.front')?.textContent?.trim()).toBe('New question');
  });

  it('asks before deleting', async () => {
    const { fixture, el } = await render([card(1, 'Q')]);
    button(el, 'Delete').click();
    await fixture.whenStable();
    expect(calls).toEqual([]);
    button(el, 'Delete for good?').click();
    await fixture.whenStable();
    expect(calls).toEqual([['delete', 1]]);
    expect(el.querySelectorAll('.front').length).toBe(0);
  });
});
