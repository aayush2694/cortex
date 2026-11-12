import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Frame } from '../../../core/api/models';

interface TreeNode {
  id: number;
  val: number | string;
  left: number | null;
  right: number | null;
}

const X_STEP = 56;
const Y_STEP = 72;
const R = 20;
const PAD = 32;

/**
 * A binary tree (or a heap drawn as one). Nodes are placed by in-order position and depth,
 * and glide to new positions when the tree changes. A side panel shows a queue, stack or path.
 */
@Component({
  selector: 'app-tree-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (layout().nodes.length) {
      <svg
        [attr.viewBox]="'0 0 ' + layout().width + ' ' + layout().height"
        [style.width.px]="layout().width"
        role="img"
        aria-label="Tree"
      >
        @for (e of layout().edges; track e.key) {
          <line class="edge" [class.lit]="e.lit" [attr.x1]="e.x1" [attr.y1]="e.y1" [attr.x2]="e.x2" [attr.y2]="e.y2" />
        }
        @for (n of layout().nodes; track n.id) {
          <g class="node {{ n.tone }}" [style.transform]="'translate(' + n.x + 'px,' + n.y + 'px)'">
            <circle [attr.r]="r" />
            <text class="val" y="5">{{ n.val }}</text>
            @if (n.label) {
              <text class="lab" [attr.y]="r + 14">{{ n.label }}</text>
            }
          </g>
        }
      </svg>
    } @else {
      <p class="empty muted">The heap is empty</p>
    }
    <div class="extras">
      @if (panel(); as p) {
        <div class="panel">
          <span class="panel-label">{{ p.label }}</span>
          <div class="items">
            @for (item of p.items; track $index) {
              <span class="item" [class.front]="$first">{{ item }}</span>
            } @empty {
              <span class="faint">empty</span>
            }
          </div>
        </div>
      }
      @for (v of vars(); track v.name) {
        <span class="var"><span class="name">{{ v.name }}</span><span class="v">{{ v.value }}</span></span>
      }
    </div>
  `,
  styles: `
    svg {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 0 auto;
      overflow: visible;
    }
    .edge {
      stroke: var(--tone-4);
      stroke-width: 2;
      transition: stroke 0.25s;
      &.lit {
        stroke: var(--tone-1);
        stroke-width: 2.5;
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
          stroke 0.25s,
          opacity 0.25s;
      }
      .val {
        fill: var(--text);
        font: 600 13px var(--mono);
        text-anchor: middle;
      }
      .lab {
        fill: var(--text-2);
        font: 500 10.5px var(--mono);
        text-anchor: middle;
      }
      &.active circle,
      &.found circle {
        fill: var(--tone-1);
        stroke: var(--tone-1);
      }
      &.active .val,
      &.found .val {
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
      &.done .val {
        fill: var(--on-accent);
      }
      &.dim {
        opacity: 0.35;
      }
    }
    .empty {
      text-align: center;
      padding: 40px 0;
    }
    .extras {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
    }
    .panel {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-right: 6px;
    }
    .panel-label {
      font: 500 12px var(--mono);
      color: var(--text-2);
    }
    .items {
      display: flex;
      gap: 5px;
      min-height: 36px;
      align-items: center;
      padding: 3px 8px;
      border-radius: 10px;
      box-shadow: inset 0 0 0 1px var(--tone-4);
    }
    .item {
      min-width: 30px;
      height: 28px;
      padding: 0 7px;
      display: grid;
      place-items: center;
      border-radius: 7px;
      background: var(--raised);
      font: 600 12.5px var(--mono);
      animation: enter 0.3s var(--ease);
      &.front {
        box-shadow: inset 0 0 0 2px var(--tone-1);
      }
    }
    @keyframes enter {
      from {
        opacity: 0;
        transform: translateX(10px);
      }
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
      .v {
        font: 600 13px var(--mono);
      }
    }
  `,
})
export class TreeView {
  readonly frame = input.required<Frame>();

  protected readonly r = R;

  protected readonly panel = computed<{ label: string; items: (string | number)[] } | null>(
    () => this.frame().state['panel'] ?? null,
  );
  protected readonly vars = computed<{ name: string; value: string }[]>(
    () => this.frame().state['vars'] ?? [],
  );

  protected readonly layout = computed(() => {
    const st = this.frame().state;
    const nodes: TreeNode[] = st['nodes'] ?? [];
    const tones: string[] = st['tones'] ?? [];
    const labels: string[] = st['labels'] ?? [];
    const hot = new Set(this.frame().highlight as number[]);
    const root: number | null = st['root'] ?? null;
    const byId = new Map(nodes.map((n) => [n.id, n]));

    // In-order index gives x, depth gives y: a tidy, non-overlapping binary tree layout.
    const pos = new Map<number, { x: number; y: number }>();
    let order = 0;
    let maxDepth = 0;
    const walk = (id: number | null, depth: number) => {
      if (id === null || !byId.has(id)) return;
      const n = byId.get(id)!;
      walk(n.left, depth + 1);
      pos.set(id, { x: PAD + order++ * X_STEP, y: PAD + depth * Y_STEP });
      maxDepth = Math.max(maxDepth, depth);
      walk(n.right, depth + 1);
    };
    walk(root, 0);

    const placed = nodes
      .filter((n) => pos.has(n.id))
      .map((n) => ({ ...n, ...pos.get(n.id)!, tone: tones[n.id] ?? '', label: labels[n.id] ?? '' }));
    const edges = nodes.flatMap((n) =>
      [n.left, n.right]
        .filter((c): c is number => c !== null && pos.has(c) && pos.has(n.id))
        .map((c) => {
          const a = pos.get(n.id)!;
          const b = pos.get(c)!;
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          const ux = (b.x - a.x) / len;
          const uy = (b.y - a.y) / len;
          return {
            key: `${n.id}-${c}`,
            x1: a.x + ux * R,
            y1: a.y + uy * R,
            x2: b.x - ux * R,
            y2: b.y - uy * R,
            lit: hot.has(c) && (tones[c] === 'active' || tones[c] === 'found'),
          };
        }),
    );
    return {
      nodes: placed,
      edges,
      width: Math.max(PAD * 2 + (order - 1) * X_STEP, 120),
      height: PAD * 2 + maxDepth * Y_STEP + 16,
    };
  });
}
