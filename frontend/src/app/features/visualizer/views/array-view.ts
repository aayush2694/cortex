import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Frame } from '../../../core/api/models';

type Tone = '' | 'cmp' | 'act' | 'done' | 'pivot' | 'out' | 'found';

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
              @if ($index === state()['lo']) { <span class="ptr">lo</span> }
              @if ($index === state()['mid']) { <span class="ptr accent">mid</span> }
              @if ($index === state()['hi']) { <span class="ptr">hi</span> }
            </div>
          </div>
        }
      </div>
      <p class="aside muted">Looking for <strong>{{ state()['target'] }}</strong></p>
    } @else {
      <div class="bars">
        @for (v of values(); track $index) {
          <div class="bar-col">
            <div class="bar {{ tones()[$index] }}" [style.height.%]="heights()[$index]"></div>
            <span class="val">{{ v }}</span>
          </div>
        }
      </div>
      @if (state()['key'] !== undefined && state()['key'] !== null) {
        <p class="aside muted">Holding <strong>key = {{ state()['key'] }}</strong></p>
      }
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
      border-radius: 5px 5px 2px 2px;
      background: var(--bar);
      transition: height 0.25s var(--ease), background-color 0.15s, opacity 0.15s;
    }
    .val {
      font: 500 11px var(--mono);
      color: var(--text-2);
    }
    .cmp {
      background: var(--warn) !important;
    }
    .act {
      background: var(--bad) !important;
    }
    .done {
      background: var(--ok) !important;
    }
    .found {
      background: var(--ok) !important;
      color: var(--bg) !important;
    }
    .pivot {
      background: var(--accent) !important;
    }
    .out {
      opacity: 0.3;
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
      border-radius: 8px;
      border: 1px solid var(--border-strong);
      background: var(--raised);
      font: 500 14px var(--mono);
      transition: background-color 0.15s, opacity 0.15s;
      &.cmp {
        color: var(--bg);
      }
    }
    .ptrs {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-height: 38px;
    }
    .ptr {
      font: 500 11px var(--mono);
      color: var(--text-2);
      text-align: center;
      &.accent {
        color: var(--accent-text);
      }
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

  protected readonly state = computed(() => this.frame().state);
  protected readonly values = computed<number[]>(() => this.state()['array'] ?? []);

  protected readonly heights = computed(() => {
    const vals = this.values();
    const min = Math.min(...vals);
    const span = Math.max(...vals) - min || 1;
    return vals.map((v) => 12 + (88 * (v - min)) / span);
  });

  protected readonly tones = computed<Tone[]>(() => {
    const { state, highlight, action } = this.frame();
    const n = this.values().length;
    if (action === 'done') return Array(n).fill('done');

    const sorted = new Set<number>(state['sorted'] ?? []);
    const range: [number, number] | undefined = state['range'];
    const lo: number | undefined = state['lo'];
    const hi: number | undefined = state['hi'];
    const hl = new Set<number>(highlight);

    return Array.from({ length: n }, (_, i): Tone => {
      if (hl.has(i)) return ACTION_TONE[action] ?? 'cmp';
      if (i === state['pivot']) return 'pivot';
      if (sorted.has(i)) return 'done';
      if (state['sorted_until'] !== undefined && i < state['sorted_until'] && i !== state['hole'])
        return 'done';
      if (range && (i < range[0] || i > range[1])) return 'out';
      if (lo !== undefined && hi !== undefined && (i < lo || i > hi)) return 'out';
      return '';
    });
  });
}
