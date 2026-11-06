import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Frame } from '../../../core/api/models';

type Cell = [number, number];
const key = (c: Cell | null | undefined) => (c ? `${c[0]},${c[1]}` : '');

/** BFS on a grid. Click a cell to add or remove a wall. */
@Component({
  selector: 'app-grid-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="grid"
      [style.grid-template-columns]="'repeat(' + cols() + ', 1fr)'"
      role="grid"
      aria-label="Grid. Click a cell to toggle a wall."
    >
      @for (c of cells(); track c.k) {
        <button
          class="cell {{ c.tone }}"
          [attr.aria-label]="'Row ' + c.r + ', column ' + c.c + (c.tone ? ', ' + c.tone : '')"
          (click)="toggleWall.emit([c.r, c.c])"
        >
          @if (c.tone === 'start') { <i class="ti ti-player-play"></i> }
          @if (c.tone === 'end') { <i class="ti ti-flag"></i> }
        </button>
      }
    </div>
    <div class="legend faint">
      <span><i class="cell visited"></i>Visited</span>
      <span><i class="cell frontier"></i>In queue</span>
      <span><i class="cell current"></i>Current</span>
      <span><i class="cell path"></i>Shortest path</span>
      <span><i class="cell wall"></i>Wall</span>
    </div>
    <p class="faint hint">Click cells to draw walls, then watch BFS find a way around them.</p>
  `,
  styles: `
    .grid {
      display: grid;
      gap: 3px;
      max-width: 620px;
      margin: 0 auto;
    }
    .cell {
      aspect-ratio: 1;
      border: 0;
      padding: 0;
      border-radius: 4px;
      background: var(--raised);
      color: var(--on-accent);
      cursor: pointer;
      display: grid;
      place-items: center;
      font-size: 12px;
      transition: background-color 0.15s, transform 0.15s var(--ease);
      &:hover {
        outline: 1px solid var(--border-strong);
      }
      &.wall {
        background: var(--text-3);
      }
      &.visited {
        background: color-mix(in srgb, var(--accent) 28%, var(--raised));
      }
      &.frontier {
        background: color-mix(in srgb, var(--warn) 60%, var(--raised));
      }
      &.current {
        background: var(--warn);
        transform: scale(1.08);
      }
      &.path {
        background: var(--ok);
      }
      &.start,
      &.end {
        background: var(--accent);
      }
    }
    .hint {
      text-align: center;
      margin-top: 4px;
    }
    .legend {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 12px;
      span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .cell {
        width: 12px;
        height: 12px;
        aspect-ratio: auto;
        transform: none;
        cursor: default;
      }
    }
  `,
})
export class GridView {
  readonly frame = input.required<Frame>();
  readonly input = input.required<{ rows: number; cols: number; walls: Cell[]; start: Cell; end: Cell }>();
  readonly toggleWall = output<Cell>();

  protected readonly cols = computed(() => this.input().cols);

  protected readonly cells = computed(() => {
    const { rows, cols, walls, start, end } = this.input();
    const s = this.frame().state;
    const wallSet = new Set(walls.map(key));
    const visited = new Set((s['visited'] ?? []).map(key));
    const frontier = new Set((s['frontier'] ?? []).map(key));
    const path = new Set((s['path'] ?? []).map(key));
    const current = key(s['current']);
    const out: { k: string; r: number; c: number; tone: string }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = `${r},${c}`;
        const tone =
          k === key(start) ? 'start'
          : k === key(end) ? 'end'
          : wallSet.has(k) ? 'wall'
          : path.has(k) ? 'path'
          : k === current ? 'current'
          : frontier.has(k) ? 'frontier'
          : visited.has(k) ? 'visited'
          : '';
        out.push({ k, r, c, tone });
      }
    }
    return out;
  });
}
