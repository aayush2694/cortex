import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Frame } from '../../../core/api/models';
import { Panel, Var, stateOf } from './view-state';

interface GraphData {
  nodes: string[];
  edges: { source: string; target: string; label: string }[];
  directed: boolean;
}

/** Dijkstra's input: the graph comes from here, not from the frames. */
interface DijkstraInput {
  nodes: string[];
  edges: { source: string; target: string; weight: number }[];
  directed?: boolean;
}

interface GraphState {
  graph: GraphData;
  done: string[];
  labels: Record<string, string>;
  dist: Record<string, number | null>;
  current: string;
  edge: string[] | null;
  prev: Record<string, string | null>;
  tree_edges: string[][];
  queue: Panel | null;
  heap: [number, string][];
  vars: Var[];
}

const W = 600;
const H = 340;
const R = 22;

/**
 * Graph walkthroughs. Two sources of truth:
 * - Dijkstra: the graph comes from the input; distances, prev and the heap from the frame.
 * - Patterns (topological sort, union-find): the frame carries the whole graph, labels,
 *   union "tree" edges and a queue panel.
 * Directed graphs are laid out left to right by prerequisite depth; others on a circle.
 */
@Component({
  selector: 'app-graph-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" aria-label="Graph">
      <defs>
        <marker id="graph-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" class="head" />
        </marker>
      </defs>
      @for (e of edges(); track e.key) {
        <g class="edge {{ e.tone }}">
          <line
            [attr.x1]="e.x1"
            [attr.y1]="e.y1"
            [attr.x2]="e.x2"
            [attr.y2]="e.y2"
            [attr.marker-end]="graph().directed ? 'url(#graph-arrow)' : null"
          />
          @if (e.label !== '') {
            <rect [attr.x]="e.mx - 11" [attr.y]="e.my - 9" width="22" height="18" rx="5" />
            <text [attr.x]="e.mx" [attr.y]="e.my + 4">{{ e.label }}</text>
          }
        </g>
      }
      @for (n of nodes(); track n.id) {
        <g class="node {{ n.tone }}" [style.transform]="'translate(' + n.x + 'px,' + n.y + 'px)'">
          <circle [attr.r]="r" />
          <text class="name" y="5">{{ n.short }}</text>
          @if (n.label) {
            <text class="dist" [attr.y]="r + 17">{{ n.label }}</text>
          }
        </g>
      }
    </svg>
    <div class="extras">
      @if (queue(); as q) {
        <div class="queue">
          <span class="label">{{ q.label }}</span>
          @for (item of q.items; track $index) {
            <span class="pill">{{ item }}</span>
          } @empty {
            <span class="faint">empty</span>
          }
        </div>
      }
      @for (v of vars(); track v.name) {
        <span class="var"><span class="vname">{{ v.name }}</span><span class="v">{{ v.value }}</span></span>
      }
    </div>
  `,
  styles: `
    svg {
      display: block;
      width: 100%;
      max-height: 340px;
    }
    .head {
      fill: var(--tone-2);
    }
    .edge {
      line {
        stroke: var(--tone-4);
        stroke-width: 2;
        transition: stroke 0.2s;
      }
      rect {
        fill: var(--surface);
        stroke: var(--tone-4);
      }
      text {
        fill: var(--text-2);
        font: 500 11px var(--mono);
        text-anchor: middle;
      }
      &.tree line {
        stroke: var(--tone-2);
        stroke-width: 3.5;
      }
      &.lit line {
        stroke: var(--tone-1);
        stroke-width: 3;
        stroke-dasharray: 6 4;
        animation: march 0.6s linear infinite;
      }
      &.lit rect {
        stroke: var(--tone-1);
      }
      &.lit text {
        fill: var(--text);
      }
      &.fresh line {
        animation: appear 0.4s var(--ease);
      }
    }
    @keyframes march {
      to {
        stroke-dashoffset: -10;
      }
    }
    @keyframes appear {
      from {
        opacity: 0;
      }
    }
    .node {
      transition: transform 0.45s var(--ease);
      circle {
        fill: var(--raised);
        stroke: var(--tone-4);
        stroke-width: 2;
        transition:
          fill 0.2s,
          stroke 0.2s;
      }
      .name {
        fill: var(--text);
        font: 600 12px var(--font);
        text-anchor: middle;
      }
      .dist {
        fill: var(--text-2);
        font: 500 11.5px var(--mono);
        text-anchor: middle;
      }
      &.done circle {
        fill: var(--tone-3);
        stroke: var(--tone-3);
      }
      &.done .name {
        fill: var(--on-accent);
      }
      &.current circle {
        fill: var(--tone-1);
        stroke: var(--tone-1);
      }
      &.current .name {
        fill: var(--on-accent);
      }
    }
    .extras {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
    }
    .queue {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      .label {
        margin-right: 4px;
      }
      .pill {
        animation: appear 0.3s var(--ease);
      }
    }
    .var {
      display: inline-flex;
      align-items: baseline;
      gap: 8px;
      padding: 5px 12px;
      border-radius: 999px;
      background: var(--raised);
      .vname {
        font-size: 12px;
        color: var(--text-2);
      }
      .v {
        font: 600 13px var(--mono);
      }
    }
  `,
})
export class GraphView {
  readonly frame = input.required<Frame>();
  /** Only used by Dijkstra, whose frames don't carry the graph itself. */
  readonly input = input<DijkstraInput | null>(null);

  protected readonly w = W;
  protected readonly h = H;
  protected readonly r = R;

  private readonly st = computed(() => stateOf<GraphState>(this.frame()));

  protected readonly graph = computed<GraphData>(() => {
    const fromFrame = this.st().graph;
    if (fromFrame) return fromFrame;
    const inp = this.input() ?? { nodes: [], edges: [] };
    return {
      nodes: inp.nodes,
      edges: inp.edges.map((e) => ({ source: e.source, target: e.target, label: String(e.weight) })),
      directed: !!inp.directed,
    };
  });

  private readonly positions = computed(() => {
    const { nodes, edges, directed } = this.graph();
    return directed ? layered(nodes, edges) : circle(nodes);
  });

  protected readonly nodes = computed(() => {
    const s = this.st();
    const done = new Set(s.done ?? []);
    const labels = s.labels;
    return this.graph().nodes.map((id) => {
      const p = this.positions().get(id)!;
      let label = labels?.[id] ?? '';
      if (!labels && s.dist) {
        const d = s.dist[id];
        label = d === null || d === undefined ? '∞' : String(d);
      }
      return {
        id,
        short: id.length > 6 ? id.slice(0, 5) + '…' : id,
        ...p,
        label,
        tone: id === s.current ? 'current' : done.has(id) ? 'done' : '',
      };
    });
  });

  protected readonly edges = computed(() => {
    const s = this.st();
    const lit = s.edge ?? null;
    const prev = s.prev ?? {};
    const tree = s.tree_edges ?? [];
    const { edges, directed } = this.graph();
    const same = (a: string[], b: string, c: string) =>
      (a[0] === b && a[1] === c) || (!directed && a[0] === c && a[1] === b);
    return edges.map((e, i) => {
      const a = this.positions().get(e.source)!;
      const b = this.positions().get(e.target)!;
      // Stop lines at the circle's edge so arrowheads are visible.
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      const isLit = !!lit && same(lit, e.source, e.target);
      const inTree =
        tree.some((t) => same(t, e.source, e.target)) ||
        prev[e.target] === e.source ||
        prev[e.source] === e.target;
      return {
        key: `${e.source}>${e.target}#${i}`,
        x1: a.x + ux * R,
        y1: a.y + uy * R,
        x2: b.x - ux * (R + 2),
        y2: b.y - uy * (R + 2),
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        label: e.label ?? '',
        tone: isLit ? 'lit' : inTree ? 'tree' : '',
      };
    });
  });

  protected readonly queue = computed<{ label: string; items: (string | number)[] } | null>(() => {
    const s = this.st();
    if (s.queue !== undefined) return s.queue;
    if (s.heap) {
      return { label: 'Priority queue', items: s.heap.map(([d, n]) => `${n}: ${d}`) };
    }
    return null;
  });

  protected readonly vars = computed<{ name: string; value: string }[]>(
    () => this.st().vars ?? [],
  );
}

function circle(ids: string[]): Map<string, { x: number; y: number }> {
  const cx = W / 2;
  const cy = H / 2 - 6;
  const rx = W / 2 - 70;
  const ry = H / 2 - 50;
  return new Map(
    ids.map((id, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(ids.length, 1);
      return [id, { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }];
    }),
  );
}

/** Columns by longest path from a source, so arrows point left to right. */
function layered(
  ids: string[],
  edges: { source: string; target: string }[],
): Map<string, { x: number; y: number }> {
  const depth = new Map(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass++) {
    let changed = false;
    for (const e of edges) {
      const d = (depth.get(e.source) ?? 0) + 1;
      if (d > (depth.get(e.target) ?? 0) && d < ids.length) {
        depth.set(e.target, d);
        changed = true;
      }
    }
    if (!changed) break; // cycles stop growing after ids.length passes
  }
  const columns = new Map<number, string[]>();
  for (const id of ids) columns.set(depth.get(id)!, [...(columns.get(depth.get(id)!) ?? []), id]);
  const maxCol = Math.max(0, ...columns.keys());
  const pos = new Map<string, { x: number; y: number }>();
  for (const [col, members] of columns) {
    members.forEach((id, i) => {
      pos.set(id, {
        x: 50 + (maxCol ? (col / maxCol) * (W - 100) : (W - 100) / 2),
        y: (H - 40) * ((i + 1) / (members.length + 1)),
      });
    });
  }
  return pos;
}
