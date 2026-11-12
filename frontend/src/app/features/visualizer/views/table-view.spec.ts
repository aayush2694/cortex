import { TestBed } from '@angular/core/testing';

import { Frame } from '../../../core/api/models';
import { TableView } from './table-view';

const frame = (state: Record<string, unknown>): Frame => ({
  line: 1,
  action: 'compare',
  message: '',
  state,
  highlight: [],
  counters: {},
});

describe('TableView (DP table)', () => {
  it('renders labels, values and the tone of each cell', async () => {
    const fixture = TestBed.createComponent(TableView);
    fixture.componentRef.setInput(
      'frame',
      frame({
        table: [
          [0, 0],
          [0, 1],
        ],
        row_labels: ['∅', 'a'],
        col_labels: ['∅', 'a'],
        tones: [
          ['dep', ''],
          ['', 'active'],
        ],
        active: [1, 1],
        vars: [{ name: 'lcs length', value: '1' }],
      }),
    );
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;

    const cells = [...el.querySelectorAll('td')];
    expect(cells.map((c) => c.textContent?.trim())).toEqual(['0', '0', '0', '1']);
    expect(cells[3].classList).toContain('active');
    expect(cells[0].classList).toContain('dep');
    // The active row and column headers light up.
    expect(el.querySelectorAll('th.hot').length).toBe(2);
    expect(el.querySelector('.var')?.textContent).toContain('lcs length');
  });
});
