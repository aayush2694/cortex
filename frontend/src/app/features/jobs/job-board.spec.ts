import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Api } from '../../core/api/api';
import { JobApplication } from '../../core/api/models';
import { JobBoard } from './job-board';

const job = (id: number, company: string, status: JobApplication['status']): JobApplication => ({
  id,
  company,
  role: 'SDE',
  status,
  position: 1,
  location: null,
  url: null,
  source: null,
  notes: '',
  applied_on: '2026-11-10',
  next_step: null,
  next_step_on: null,
  fixed: null,
  variable: null,
  joining_bonus: null,
  stock_per_year: null,
  created_at: '',
  updated_at: '',
});

describe('JobBoard keyboard moves', () => {
  const updates: unknown[][] = [];

  async function render() {
    updates.length = 0;
    const fakeApi = {
      applications: () => ({
        value: signal({ items: [job(1, 'Zoho', 'applied')] }),
        isLoading: signal(false),
        hasValue: () => true,
        reload: () => undefined,
      }),
      updateApplication: async (id: number, patch: Partial<JobApplication>) => {
        updates.push([id, patch]);
        return { ...job(id, 'Zoho', 'applied'), ...patch };
      },
    };
    TestBed.configureTestingModule({ providers: [{ provide: Api, useValue: fakeApi }] });
    const fixture = TestBed.createComponent(JobBoard);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const columnOf = (el: HTMLElement, company: string) =>
    [...el.querySelectorAll('.column')].find((c) => c.textContent?.includes(company))?.getAttribute('aria-label');

  const press = (card: Element, key: string) =>
    card.dispatchEvent(new KeyboardEvent('keydown', { key, altKey: true, bubbles: true }));

  it('moves a focused card to the next and previous stage with Alt + arrows', async () => {
    const { fixture, el } = await render();
    press(el.querySelector('.job')!, 'ArrowRight');
    await fixture.whenStable();
    expect(columnOf(el, 'Zoho')).toBe('Interview');
    expect(updates).toEqual([[1, { status: 'interview' }]]);

    press(el.querySelector('.job')!, 'ArrowLeft');
    await fixture.whenStable();
    expect(columnOf(el, 'Zoho')).toBe('Applied');
  });

  it('tells screen readers about the shortcut', async () => {
    const { el } = await render();
    expect(el.querySelector('.job')?.getAttribute('aria-keyshortcuts')).toBe('Alt+ArrowLeft Alt+ArrowRight');
  });
});
