import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Frame } from '../../../core/api/models';

interface GraphInput {
  nodes: string[];
  edges: { source: string; target: string; weight: number }[];
  start: string;
}

const W = 560;
const H = 340;
const R = 22;

/** Dijkstra: nodes on a circle, distances under each node, the edge being checked lit up. */
@Component({
  selector: 'app-graph-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" aria-label="Weighted graph">
      @for (e of edges(); track $index) {
        <g class="edge {{ e.tone }}">
          <line [attr.x1]="e.x1" [attr.y1]="e.y1" [attr.x2]="e.x2" [attr.y2]="e.y2" />
          <rect [attr.x]="e.mx - 11" [attr.y]="e.my - 9" width="22" height="18" rx="5" />
          <text [attr.x]="e.mx" [attr.y]="e.my + 4">{{ e.weight }}</text>
        </g>
      }
      @for (n of nodes(); track n.id) {
        <g class="node {{ n.tone }}" [attr.transform]="'translate(' + n.x + ',' + n.y + ')'">
          <circle [attr.r]="r" />
          <text class="name" y="5">{{ n.id }}</text>
          <text class="dist" [attr.y]="r + 18">{{ n.dist }}</text>
        </g>
      }
    </svg>
    <div class="queue">
      <span class="label">Priority queue</span>
      @for (item of heap(); track $index) {
        <span class="pill">{{ item[1] }}: {{ item[0] }}</span>
      } @empty {
        <span class="faint">empty</span>
      }
    </div>
  `,
  styles: `
    svg {
      display: block;
      width: 100%;
      max-height: 340px;
    }
    .edge {
      line {
        stroke: var(--border-strong);
        stroke-width: 2;
        transition: stroke 0.15s;
      }
      rect {
        fill: var(--surface);
        stroke: var(--border-strong);
      }
      text {
        fill: var(--text-2);
        font: 500 11px var(--mono);
        text-anchor: middle;
      }
      &.tree line {
        stroke: color-mix(in srgb, var(--ok) 70%, transparent);
        stroke-width: 3;
      }
      &.lit line {
        stroke: var(--warn);
        stroke-width: 3;
      }
      &.lit rect {
        stroke: var(--warn);
      }
    }
    .node {
      circle {
        fill: var(--raised);
        stroke: var(--border-strong);
        stroke-width: 2;
        transition: fill 0.2s, stroke 0.2s;
      }
      .name {
        fill: var(--text);
        font: 600 13px var(--font);
        text-anchor: middle;
      }
      .dist {
        fill: var(--text-2);
        font: 500 12px var(--mono);
        text-anchor: middle;
      }
      &.done circle {
        fill: var(--ok-soft);
        stroke: var(--ok);
      }
      &.current circle {
        fill: var(--accent);
        stroke: var(--accent);
      }
      &.current .name {
        fill: var(--on-accent);
      }
    }
    .queue {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 8px;
      .label {
        margin-right: 4px;
      }
    }
  `,
})
export class GraphView {
  readonly frame = input.required<Frame>();
  readonly input = input.required<GraphInput>();

  protected readonly w = W;
  protected readonly h = H;
  protected readonly r = R;

  private readonly positions = computed(() => {
    const ids = this.input().nodes;
    const cx = W / 2;
    const cy = H / 2 - 6;
    const rx = W / 2 - 60;
    const ry = H / 2 - 50;
    return new Map(
      ids.map((id, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / ids.length;
        return [id, { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }];
      }),
    );
  });

  protected readonly nodes = computed(() => {
    const s = this.frame().state;
    const done = new Set<string>(s['done'] ?? []);
    return this.input().nodes.map((id) => {
      const p = this.positions().get(id)!;
      const d = s['dist']?.[id];
      return {
        id,
        ...p,
        dist: d === null || d === undefined ? '∞' : String(d),
        tone: id === s['current'] ? 'current' : done.has(id) ? 'done' : '',
      };
    });
  });

  protected readonly edges = computed(() => {
    const s = this.frame().state;
    const lit: string[] | null = s['edge'];
    const prev: Record<string, string | null> = s['prev'] ?? {};
    return this.input().edges.map((e) => {
      const a = this.positions().get(e.source)!;
      const b = this.positions().get(e.target)!;
      const isLit = !!lit && ((lit[0] === e.source && lit[1] === e.target) || (lit[0] === e.target && lit[1] === e.source));
      const inTree = prev[e.target] === e.source || prev[e.source] === e.target;
      return {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        weight: e.weight,
        tone: isLit ? 'lit' : inTree ? 'tree' : '',
      };
    });
  });

  protected readonly heap = computed<[number, string][]>(() => this.frame().state['heap'] ?? []);
}
