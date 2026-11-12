import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Frame } from '../../../core/api/models';
import { Panel, Var, stateOf } from './view-state';

interface SeqRow {
  label: string;
  cells: (string | number)[];
  tones: string[];
  pointers: Record<string, number>;
  window: [number, number] | null;
}

const CELL = 42; // px, keep in sync with .cell width
const GAP = 6;

/**
 * Rows of cells with named pointers (L, R, mid...), a sliding window outline and a variables
 * panel. Used by the problem-solving pattern walkthroughs.
 */
interface SequenceState {
  rows: SeqRow[];
  vars: Var[];
  stack: Panel | null;
}

@Component({
  selector: 'app-sequence-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rows">
      @for (r of rows(); track r.label) {
        <div class="row">
          <span class="row-label">{{ r.label }}</span>
          <div class="track" [style.width.px]="trackWidth(r)">
            @if (r.window; as w) {
              <span
                class="window"
                [style.left.px]="w[0] * step - 4"
                [style.width.px]="(w[1] - w[0] + 1) * step - gap + 8"
              ></span>
            }
            @for (c of r.cells; track $index) {
              <span class="cell {{ r.tones[$index] }}" [style.left.px]="$index * step">
                <span class="value">{{ c }}</span>
              </span>
            }
            @for (p of pointerList(r); track p.name) {
              <span class="pointer" [style.left.px]="p.index * step">{{ p.name }}</span>
            }
          </div>
        </div>
      }
    </div>
    @if (stack(); as st) {
      <div class="stack">
        <span class="stack-label">{{ st.label }}</span>
        <div class="stack-items" aria-live="polite">
          <span class="bottom" aria-hidden="true"></span>
          @for (item of st.items; track $index) {
            <span class="stack-item" [class.top]="$last">{{ item }}</span>
          } @empty {
            <span class="faint">empty</span>
          }
        </div>
      </div>
    }
    @if (vars().length) {
      <div class="vars">
        @for (v of vars(); track v.name) {
          <span class="var"><span class="name">{{ v.name }}</span><span class="val">{{ v.value }}</span></span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .rows {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 18px 0 8px;
      overflow-x: auto;
    }
    .row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .row-label {
      width: 52px;
      padding-top: 12px;
      text-align: right;
      font: 500 12px var(--mono);
      color: var(--text-2);
      flex-shrink: 0;
    }
    .track {
      position: relative;
      height: 72px;
      flex-shrink: 0;
    }
    .cell {
      position: absolute;
      top: 0;
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      background: var(--raised);
      font: 600 15px var(--mono);
      transition:
        background-color 0.25s var(--ease),
        color 0.25s var(--ease),
        box-shadow 0.25s var(--ease),
        opacity 0.25s var(--ease),
        transform 0.3s var(--ease);
      &.active {
        background: var(--tone-1);
        color: var(--on-accent);
        transform: translateY(-3px);
      }
      &.found {
        background: var(--tone-1);
        color: var(--on-accent);
        box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--tone-1);
      }
      &.done {
        background: var(--tone-3);
        color: var(--on-accent);
      }
      &.outline {
        background: transparent;
        box-shadow: inset 0 0 0 2px var(--tone-1);
      }
      &.dim {
        opacity: 0.28;
      }
    }
    .window {
      position: absolute;
      top: -4px;
      height: 50px;
      border-radius: 13px;
      background: var(--selected);
      box-shadow: inset 0 0 0 1.5px var(--tone-2);
      transition:
        left 0.35s var(--ease),
        width 0.35s var(--ease);
    }
    .pointer {
      position: absolute;
      top: 50px;
      width: 42px;
      text-align: center;
      font: 600 12px var(--mono);
      color: var(--text);
      transition: left 0.35s var(--ease);
      &::before {
        content: '▲';
        display: block;
        font-size: 8px;
        line-height: 10px;
        color: var(--text-2);
      }
    }
    .stack {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin: 6px 0 4px;
    }
    .stack-label {
      font: 500 12px var(--mono);
      color: var(--text-2);
    }
    .stack-items {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 42px;
      padding: 4px 10px 4px 6px;
      border-radius: 12px;
      box-shadow: inset 0 0 0 1px var(--tone-4);
    }
    .bottom {
      width: 3px;
      height: 28px;
      border-radius: 2px;
      background: var(--tone-3);
    }
    .stack-item {
      min-width: 36px;
      height: 32px;
      padding: 0 8px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: var(--raised);
      font: 600 13px var(--mono);
      animation: push 0.35s var(--ease);
      &.top {
        box-shadow: inset 0 0 0 2px var(--tone-1);
      }
    }
    @keyframes push {
      from {
        opacity: 0;
        transform: translateX(16px) scale(0.85);
      }
    }
    .vars {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
    }
    .var {
      display: inline-flex;
      align-items: baseline;
      gap: 8px;
      padding: 5px 12px;
      border-radius: 999px;
      background: var(--raised);
      .name {
        font-size: 12px;
        color: var(--text-2);
      }
      .val {
        font: 600 13px var(--mono);
      }
    }
  `,
})
export class SequenceView {
  readonly frame = input.required<Frame>();

  protected readonly step = CELL + GAP;
  protected readonly gap = GAP;
  private readonly st = computed(() => stateOf<SequenceState>(this.frame()));
  protected readonly rows = computed(() => this.st().rows ?? []);
  protected readonly vars = computed(() => this.st().vars ?? []);
  protected readonly stack = computed(() => this.st().stack ?? null);

  protected trackWidth(r: SeqRow): number {
    return Math.max(0, r.cells.length * this.step - GAP);
  }

  /** Pointers on the same cell are merged into one label ("L R"). */
  protected pointerList(r: SeqRow): { name: string; index: number }[] {
    const byIndex = new Map<number, string[]>();
    for (const [name, index] of Object.entries(r.pointers)) {
      byIndex.set(index, [...(byIndex.get(index) ?? []), name]);
    }
    return [...byIndex.entries()].map(([index, names]) => ({ index, name: names.join(' ') }));
  }
}
