import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Frame } from '../../../core/api/models';
import { stateOf } from './view-state';

const STEP = 78; // distance between nodes
const R = 22; // node radius
const Y = 70; // node centre line
const LEFT = 56; // x of the left "null" slot

interface ListState {
  values: number[];
  tones: string[];
  /** next[i] is the index node i points to; -1 is the null on the left, n the null on the right. */
  next: number[];
  pointers: Record<string, number>;
}

interface Arrow {
  key: string;
  d: string;
  tone: string;
}

/**
 * A linked list drawn as circles joined by arrows. When a link changes (reversal) the arrow
 * morphs to its new shape; a cycle is drawn as an arc bending back underneath.
 */
@Component({
  selector: 'app-list-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + width() + ' 170'" role="img" aria-label="Linked list">
      <defs>
        <marker id="list-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" class="head" />
        </marker>
      </defs>

      <g class="null">
        <text [attr.x]="left" [attr.y]="y + 5">null</text>
        <text [attr.x]="xOf(n())" [attr.y]="y + 5">null</text>
      </g>

      <!-- Tracked by key + shape: when a link changes, its arrow is re-created and draws itself in. -->
      @for (a of arrows(); track a.key + a.d) {
        <path class="arrow {{ a.tone }}" [attr.d]="a.d" pathLength="1" marker-end="url(#list-arrow)" />
      }

      @for (v of values(); track $index) {
        <g class="node {{ tones()[$index] }}" [style.transform]="'translate(' + xOf($index) + 'px,' + y + 'px)'">
          <circle [attr.r]="r" />
          <text y="5">{{ v }}</text>
        </g>
      }

      @for (p of pointers(); track p.name) {
        <g class="ptr" [style.transform]="'translate(' + xOf(p.index) + 'px,' + (y - r - 16 - p.slot * 15) + 'px)'">
          <text>{{ p.name }}</text>
        </g>
      }
    </svg>
  `,
  styles: `
    svg {
      display: block;
      width: 100%;
      max-height: 230px;
      overflow: visible;
    }
    .head {
      fill: var(--tone-2);
    }
    .arrow {
      fill: none;
      stroke: var(--tone-2);
      stroke-width: 1.75;
      stroke-dasharray: 1;
      animation: draw 0.5s var(--ease) both;
      &.hot {
        stroke: var(--tone-1);
        stroke-width: 2.5;
      }
      &.cycle {
        stroke-dasharray: 0.04 0.03;
        animation: none;
      }
    }
    @keyframes draw {
      from {
        stroke-dashoffset: 1;
      }
      to {
        stroke-dashoffset: 0;
      }
    }
    .node {
      transition: transform 0.45s var(--ease);
      circle {
        fill: var(--raised);
        stroke: var(--tone-4);
        stroke-width: 1.5;
        transition:
          fill 0.25s,
          stroke 0.25s;
      }
      text {
        fill: var(--text);
        font: 600 14px var(--mono);
        text-anchor: middle;
      }
      &.active circle,
      &.found circle {
        fill: var(--tone-1);
        stroke: var(--tone-1);
      }
      &.active text,
      &.found text {
        fill: var(--on-accent);
      }
      &.found circle {
        stroke: var(--text-2);
        stroke-width: 4;
      }
      &.outline circle {
        fill: transparent;
        stroke: var(--tone-1);
        stroke-width: 2.5;
      }
      &.done circle {
        fill: var(--tone-3);
        stroke: var(--tone-3);
      }
      &.done text {
        fill: var(--on-accent);
      }
    }
    .null text {
      fill: var(--text-3);
      font: 500 12px var(--mono);
      text-anchor: middle;
    }
    .ptr {
      transition: transform 0.45s var(--ease);
      text {
        fill: var(--text);
        font: 600 12px var(--mono);
        text-anchor: middle;
      }
    }
  `,
})
export class ListView {
  readonly frame = input.required<Frame>();

  protected readonly r = R;
  protected readonly y = Y;
  protected readonly left = LEFT;

  private readonly st = computed(() => stateOf<ListState>(this.frame()));
  protected readonly values = computed(() => this.st().values ?? []);
  protected readonly n = computed(() => this.values().length);
  protected readonly width = computed(() => this.xOf(this.n()) + LEFT);
  protected readonly tones = computed(() => this.st().tones ?? []);

  /** x of node i; -1 is the left null slot and n the right one. */
  protected xOf(i: number): number {
    return LEFT + (i + 1) * STEP;
  }

  protected readonly arrows = computed<Arrow[]>(() => {
    const next = this.st().next ?? [];
    const n = this.n();
    const hot = new Set(this.frame().highlight as number[]);
    return next.map((to, from) => {
      const x1 = this.xOf(from);
      const x2 = this.xOf(to);
      let d: string;
      let tone = hot.has(from) ? 'hot' : '';
      if (to === from + 1 || (to === n && from === n - 1)) {
        d = `M${x1 + R + 2},${Y} L${x2 - R - 3},${Y}`;
      } else if (to === from - 1 || (to === -1 && from === 0)) {
        // Reversed links run along a lower lane so you can see them flip.
        d = `M${x1 - R + 2},${Y + 10} Q${(x1 + x2) / 2},${Y + 30} ${x2 + R - 1},${Y + 10}`;
      } else if (to < from) {
        // A cycle: arc underneath, back to an earlier node.
        const dip = 60 + (from - to) * 4;
        d = `M${x1},${Y + R + 2} C${x1},${Y + dip} ${x2},${Y + dip} ${x2},${Y + R + 4}`;
        tone += ' cycle';
      } else {
        d = `M${x1 + R},${Y} C${x1 + R + 20},${Y - 40} ${x2 - R - 20},${Y - 40} ${x2 - R - 2},${Y}`;
      }
      return { key: String(from), d, tone };
    });
  });

  /** Pointers on the same node stack upwards. */
  protected readonly pointers = computed(() => {
    const ptrs = this.st().pointers ?? {};
    const used = new Map<number, number>();
    return Object.entries(ptrs).map(([name, index]) => {
      const slot = used.get(index) ?? 0;
      used.set(index, slot + 1);
      return { name, index, slot };
    });
  });
}
