import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Frame } from '../../../core/api/models';
import { stateOf } from './view-state';

type Tone = '' | 'cmp' | 'act' | 'done' | 'pivot' | 'out' | 'found';

/** What sorting and searching frames carry (fields vary by algorithm). */
interface ArrayState {
  array: number[];
  sorted: number[];
  range: [number, number];
  lo: number;
  mid: number;
  hi: number;
  pivot: number;
  sorted_until: number;
  hole: number;
  target: number;
  key: number | null;
}

const ACTION_TONE: Record<string, Tone> = {
  compare: 'cmp',
  swap: 'act',
  shift: 'act',
  set: 'act',
  pick: 'act',
  pivot: 'pivot',
  placed: 'done',
  mark: 'done',
  found: 'found',
};

/** Bars for sorting algorithms; boxes with lo/mid/hi pointers for binary search. */
@Component({
  selector: 'app-array-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (boxes()) {
      <div class="boxes">
        @for (v of values(); track $index) {
          <div class="box-col">
            <div class="box {{ tones()[$index] }}">{{ v }}</div>
            <div class="idx faint">{{ $index }}</div>
            <div class="ptrs">
              @if ($index === state().lo) { <span class="ptr">lo</span> }
              @if ($index === state().mid) { <span class="ptr accent">mid</span> }
              @if ($index === state().hi) { <span class="ptr">hi</span> }
            </div>
          </div>
        }
      </div>
      <p class="aside muted">Looking for <strong>{{ state().target }}</strong></p>
    } @else {
      <div class="bars">
        @for (v of values(); track $index) {
          <div class="bar-col">
            <div class="bar {{ tones()[$index] }}" [style.height.%]="heights()[$index]"></div>
            <span class="val">{{ v }}</span>
          </div>
        }
      </div>
      @if (state().key !== undefined && state().key !== null) {
        <p class="aside muted">Holding <strong>key = {{ state().key }}</strong></p>
      }
      <div class="legend faint">
        <span><i class="sw cmp"></i>Active</span>
        <span><i class="sw pivot"></i>Pivot</span>
        <span><i class="sw done"></i>In final place</span>
        <span><i class="sw out"></i>Out of range</span>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .bars {
      display: flex;
      align-items: flex-end;
      gap: clamp(2px, 1vw, 8px);
      height: 240px;
      padding: 0 4px;
    }
    .bar-col {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .bar {
      width: 100%;
      border-radius: 6px;
      background: var(--bar);
      transition: height 0.25s var(--ease), background-color 0.15s, opacity 0.15s;
    }
    .val {
      font: 500 12px var(--mono);
      color: var(--text-2);
    }
    /* Monochrome states: brightness and outline instead of colour. */
    .cmp,
    .act,
    .found {
      background: var(--tone-1) !important;
      color: var(--on-accent) !important;
    }
    .done {
      background: var(--tone-3) !important;
    }
    .pivot {
      background: transparent !important;
      box-shadow: inset 0 0 0 2px var(--tone-1);
    }
    .out {
      opacity: 0.25;
    }
    .boxes {
      display: flex;
      gap: 6px;
      justify-content: center;
      flex-wrap: wrap;
      padding: 40px 0 8px;
    }
    .box-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      width: 46px;
    }
    .box {
      width: 46px;
      height: 46px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      border: 0;
      background: var(--raised);
      font: 500 14px var(--mono);
      transition: background-color 0.15s, opacity 0.15s;
      &.found {
        box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px var(--tone-1);
      }
    }
    .ptrs {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-height: 38px;
    }
    .ptr {
      font: 500 12px var(--mono);
      color: var(--text-2);
      text-align: center;
      &.accent {
        color: var(--text);
        font-weight: 700;
      }
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 14px;
      span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }
    .sw {
      width: 11px;
      height: 11px;
      border-radius: 3px;
      background: var(--bar);
    }
    .aside {
      margin-top: 12px;
      font-size: 13px;
      strong {
        color: var(--text);
        font-weight: 600;
      }
    }
  `,
})
export class ArrayView {
  readonly frame = input.required<Frame>();
  readonly boxes = input(false);

  protected readonly state = computed(() => stateOf<ArrayState>(this.frame()));
  protected readonly values = computed(() => this.state().array ?? []);

  protected readonly heights = computed(() => {
    const vals = this.values();
    const min = Math.min(...vals);
    const span = Math.max(...vals) - min || 1;
    return vals.map((v) => 12 + (88 * (v - min)) / span);
  });

  protected readonly tones = computed<Tone[]>(() => {
    const { highlight, action } = this.frame();
    const state = this.state();
    const n = this.values().length;
    if (action === 'done') return Array(n).fill('done');

    const sorted = new Set(state.sorted ?? []);
    const { range, lo, hi } = state;
    const hl = new Set(highlight as number[]);

    return Array.from({ length: n }, (_, i): Tone => {
      if (hl.has(i)) return ACTION_TONE[action] ?? 'cmp';
      if (i === state.pivot) return 'pivot';
      if (sorted.has(i)) return 'done';
      if (state.sorted_until !== undefined && i < state.sorted_until && i !== state.hole)
        return 'done';
      if (range && (i < range[0] || i > range[1])) return 'out';
      if (lo !== undefined && hi !== undefined && (i < lo || i > hi)) return 'out';
      return '';
    });
  });
}
