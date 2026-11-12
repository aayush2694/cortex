import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Activity } from '../core/api/models';
import { localDay } from './format';

interface Cell {
  key: string;
  level: number;
  label: string;
  future: boolean;
}

const WEEKS = 26;

/** Darkness by how much you did that day: 1-2, 3-5, 6-9, 10+ actions. */
export function levelFor(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

/** GitHub-style grid of the last 26 weeks: one square per day, brighter = more activity. */
@Component({
  selector: 'app-activity-heatmap',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="months" aria-hidden="true">
        @for (m of months(); track m.col) {
          <span [style.grid-column]="m.col + 1">{{ m.name }}</span>
        }
      </div>
      <div class="grid" role="img" [attr.aria-label]="summary()">
        @for (c of cells(); track c.key) {
          <i class="l{{ c.level }}" [class.future]="c.future" [title]="c.label"></i>
        }
      </div>
      <div class="legend faint" aria-hidden="true">
        Less <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> More
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      overflow-x: auto;
    }
    .wrap {
      width: fit-content;
    }
    .months,
    .grid {
      display: grid;
      gap: 3px;
      grid-auto-columns: 13px;
    }
    .months {
      grid-auto-flow: column;
      grid-template-columns: repeat(26, 13px);
      font-size: 11px;
      color: var(--text-2);
      margin-bottom: 4px;
      height: 14px;
      span {
        white-space: nowrap;
      }
    }
    .grid {
      grid-template-rows: repeat(7, 13px);
      grid-auto-flow: column;
    }
    i {
      display: block;
      border-radius: 3px;
      background: var(--raised);
      animation: in 0.4s var(--ease) both;
    }
    .l1 {
      background: var(--tone-4);
    }
    .l2 {
      background: var(--tone-3);
    }
    .l3 {
      background: var(--tone-2);
    }
    .l4 {
      background: var(--tone-1);
    }
    .future {
      visibility: hidden;
    }
    .legend {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 3px;
      margin-top: 8px;
      font-size: 11px;
      i {
        width: 10px;
        height: 10px;
        animation: none;
      }
    }
    @keyframes in {
      from {
        opacity: 0;
      }
    }
  `,
})
export class ActivityHeatmap {
  readonly activity = input.required<Activity>();
  readonly weeks = WEEKS;

  /** Sunday-started weeks ending with the current week; days after today are hidden. */
  private readonly days = computed(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - today.getDay() - (WEEKS - 1) * 7);
    const out: Date[] = [];
    for (let i = 0; i < WEEKS * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return { out, today: localDay(today) };
  });

  protected readonly cells = computed<Cell[]>(() => {
    const counts = new Map(this.activity().days.map((d) => [d.date, d.count]));
    const { out, today } = this.days();
    return out.map((d) => {
      const key = localDay(d);
      const n = counts.get(key) ?? 0;
      const when = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      return {
        key,
        level: levelFor(n),
        future: key > today,
        label: `${n === 0 ? 'No' : n} ${n === 1 ? 'action' : 'actions'} on ${when}`,
      };
    });
  });

  protected readonly months = computed(() => {
    const { out } = this.days();
    const labels: { col: number; name: string }[] = [];
    let last = -1;
    for (let w = 0; w < WEEKS; w++) {
      const m = out[w * 7].getMonth();
      if (m !== last) {
        const name = out[w * 7].toLocaleDateString(undefined, { month: 'short' });
        // Two labels closer than 3 columns overlap: keep the newer one.
        if (labels.length && w - labels[labels.length - 1].col < 3) labels.pop();
        labels.push({ col: w, name });
        last = m;
      }
    }
    return labels;
  });

  protected readonly summary = computed(() => {
    const a = this.activity();
    return `${a.active_days} active days in the last 26 weeks, current streak ${a.streak} days`;
  });
}
