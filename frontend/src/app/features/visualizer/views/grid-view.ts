import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Frame } from '../../../core/api/models';

type Cell = [number, number];
const key = (c: Cell | null | undefined) => (c ? `${c[0]},${c[1]}` : '');

/** BFS on a grid. Click a cell to add or remove a wall. */
@Component({
  selector: 'app-grid-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (matrix(); as m) {
      <div
        class="grid"
        [style.grid-template-columns]="'repeat(' + m[0].length + ', 1fr)'"
        [style.max-width.px]="m[0].length * 54"
        role="img"
        aria-label="Grid of land and water"
      >
        @for (row of m; track ri; let ri = $index) {
          @for (tone of row; track ci; let ci = $index) {
            <span class="cell m-{{ tone }}">{{ matrixLabels()[ri]?.[ci] }}</span>
          }
        }
      </div>
      <div class="legend faint">
        <span><i class="cell m-water"></i>Water</span>
        <span><i class="cell m-land"></i>Land</span>
        <span><i class="cell m-island"></i>Island (numbered)</span>
        <span><i class="cell m-frontier"></i>In queue</span>
      </div>
      <div class="vars">
        @for (v of vars(); track v.name) {
          <span class="var"><span class="vname">{{ v.name }}</span><span class="v">{{ v.value }}</span></span>
        }
      </div>
    } @else {
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
    }
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
      border-radius: 5px;
      background: transparent;
      box-shadow: inset 0 0 0 1px var(--tone-5);
      color: var(--on-accent);
      cursor: pointer;
      display: grid;
      place-items: center;
      font-size: 12px;
      transition: background-color 0.15s, transform 0.15s var(--ease);
      &:hover {
        outline: 1px solid var(--border-strong);
      }
      /* Brightness scale: path brightest, then current, queue, visited; walls are hatched. */
      &.wall {
        background: repeating-linear-gradient(
          45deg,
          var(--tone-3) 0 2px,
          transparent 2px 5px
        );
        box-shadow: inset 0 0 0 1px var(--tone-3);
      }
      &.visited {
        background: var(--tone-4);
      }
      &.frontier {
        background: var(--tone-3);
      }
      &.current {
        background: var(--tone-2);
        transform: scale(1.1);
      }
      &.path {
        background: var(--tone-1);
      }
      &.start,
      &.end {
        background: var(--tone-1);
        color: var(--on-accent);
        box-shadow: 0 0 0 2px var(--surface), 0 0 0 3.5px var(--tone-1);
      }
    }
    /* Matrix mode (islands) */
    .cell.m-water {
      background: transparent;
      cursor: default;
    }
    .cell.m-land {
      background: var(--tone-3);
      cursor: default;
    }
    .cell.m-island {
      background: var(--tone-1);
      color: var(--on-accent);
      font: 600 12px var(--mono);
      cursor: default;
      animation: fill 0.35s var(--ease);
    }
    .cell.m-frontier {
      background: var(--tone-1);
      color: var(--on-accent);
      font: 600 12px var(--mono);
      box-shadow: 0 0 0 2px var(--surface), 0 0 0 3.5px var(--tone-2);
      cursor: default;
    }
    .cell.m-current {
      background: var(--tone-1);
      color: var(--on-accent);
      font: 600 12px var(--mono);
      transform: scale(1.12);
      box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--tone-1);
      cursor: default;
    }
    @keyframes fill {
      from {
        transform: scale(0.6);
      }
    }
    .vars {
      display: flex;
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
      .vname {
        font-size: 12px;
        color: var(--text-2);
      }
      .v {
        font: 600 13px var(--mono);
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
  readonly input = input<{ rows: number; cols: number; walls: Cell[]; start: Cell; end: Cell } | null>(null);
  readonly toggleWall = output<Cell>();

  protected readonly matrix = computed<string[][] | null>(() => this.frame().state['matrix'] ?? null);
  protected readonly matrixLabels = computed<string[][]>(() => this.frame().state['labels'] ?? []);
  protected readonly vars = computed<{ name: string; value: string }[]>(
    () => this.frame().state['vars'] ?? [],
  );

  protected readonly cols = computed(() => this.input()?.cols ?? 0);

  protected readonly cells = computed(() => {
    const inp = this.input();
    if (!inp) return [];
    const { rows, cols, walls, start, end } = inp;
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
