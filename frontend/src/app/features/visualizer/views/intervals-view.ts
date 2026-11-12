import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Frame } from '../../../core/api/models';
import { stateOf } from './view-state';

interface IntervalsState {
  intervals: number[][];
  merged: number[][];
  tones: string[];
  current: number | null;
  axis: [number, number];
}

/** Intervals as bars on a shared timeline, with the merged result growing on its own lane. */
@Component({
  selector: 'app-intervals-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="timeline">
      <div class="axis">
        @for (tick of ticks(); track tick) {
          <span class="tick" [style.left.%]="pos(tick)">{{ tick }}</span>
        }
      </div>
      @for (iv of intervals(); track $index) {
        <div class="lane">
          <span class="lane-label mono">[{{ iv[0] }}, {{ iv[1] }}]</span>
          <div class="track">
            <span
              class="bar {{ tones()[$index] }}"
              [class.current]="$index === current()"
              [style.left.%]="pos(iv[0])"
              [style.width.%]="span(iv[0], iv[1])"
            ></span>
          </div>
        </div>
      }
      <div class="lane merged-lane">
        <span class="lane-label">merged</span>
        <div class="track">
          @for (m of merged(); track $index) {
            <span class="bar merged" [style.left.%]="pos(m[0])" [style.width.%]="span(m[0], m[1])">
              <span class="mono">{{ m[0] }}–{{ m[1] }}</span>
            </span>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .timeline {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 4px;
    }
    .axis {
      position: relative;
      height: 18px;
      margin-left: 76px;
      border-bottom: 0.5px solid var(--separator);
    }
    .tick {
      position: absolute;
      transform: translateX(-50%);
      font: 500 11px var(--mono);
      color: var(--text-3);
    }
    .lane {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .lane-label {
      width: 68px;
      flex-shrink: 0;
      text-align: right;
      font-size: 11.5px;
      color: var(--text-2);
    }
    .track {
      position: relative;
      flex: 1;
      height: 22px;
    }
    .bar {
      position: absolute;
      top: 3px;
      height: 16px;
      min-width: 6px;
      border-radius: 8px;
      background: var(--tone-4);
      transition:
        background-color 0.25s var(--ease),
        transform 0.3s var(--ease),
        box-shadow 0.25s;
      &.active,
      &.found {
        background: var(--tone-1);
      }
      &.current {
        transform: scaleY(1.25);
      }
      &.done {
        background: var(--tone-3);
        opacity: 0.6;
      }
    }
    .merged-lane {
      margin-top: 8px;
      padding-top: 10px;
      border-top: 0.5px solid var(--separator);
      .track {
        height: 28px;
      }
      .lane-label {
        font-weight: 600;
        color: var(--text);
      }
    }
    .bar.merged {
      top: 2px;
      height: 24px;
      display: grid;
      place-items: center;
      background: transparent;
      box-shadow: inset 0 0 0 2px var(--tone-1);
      transition:
        width 0.45s var(--ease),
        left 0.45s var(--ease);
      animation: grow 0.4s var(--ease);
      span {
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
      }
    }
    @keyframes grow {
      from {
        transform: scaleX(0.3);
        opacity: 0;
      }
    }
  `,
})
export class IntervalsView {
  readonly frame = input.required<Frame>();

  private readonly st = computed(() => stateOf<IntervalsState>(this.frame()));
  protected readonly intervals = computed(() => this.st().intervals ?? []);
  protected readonly merged = computed(() => this.st().merged ?? []);
  protected readonly tones = computed(() => this.st().tones ?? []);
  protected readonly current = computed(() => this.st().current ?? null);
  private readonly axis = computed<[number, number]>(() => {
    const [lo, hi] = this.st().axis ?? [0, 10];
    return [Math.max(0, lo - 1), hi + 1];
  });

  protected readonly ticks = computed(() => {
    const [lo, hi] = this.axis();
    const step = Math.max(1, Math.ceil((hi - lo) / 10));
    const out: number[] = [];
    for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(t);
    return out;
  });

  protected pos(x: number): number {
    const [lo, hi] = this.axis();
    return ((x - lo) / (hi - lo || 1)) * 100;
  }

  protected span(a: number, b: number): number {
    return this.pos(b) - this.pos(a);
  }
}
