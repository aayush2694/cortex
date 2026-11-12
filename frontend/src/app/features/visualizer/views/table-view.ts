import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Frame } from '../../../core/api/models';
import { Var, stateOf } from './view-state';

interface TableState {
  table: (string | number)[][];
  tones: string[][];
  row_labels: string[];
  col_labels: string[];
  active: [number, number] | null;
  vars: Var[];
}

/**
 * A dynamic-programming table. The cell being computed is bright, the cells it reads from are
 * outlined, unfilled cells are faint, and the final traceback path is highlighted.
 */
@Component({
  selector: 'app-table-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <table [attr.aria-label]="'DP table'">
        <thead>
          <tr>
            <th></th>
            @for (c of colLabels(); track $index) {
              <th [class.hot]="activeCol() === $index">{{ c }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of table(); track ri; let ri = $index) {
            <tr>
              <th [class.hot]="activeRow() === ri">{{ rowLabels()[ri] }}</th>
              @for (cell of row; track ci; let ci = $index) {
                <td class="{{ tones()[ri]?.[ci] }}">
                  <span>{{ cell }}</span>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
    <div class="legend faint">
      <span><i class="sw active"></i>Computing</span>
      <span><i class="sw dep"></i>Reads from</span>
      <span><i class="sw path"></i>Answer path</span>
    </div>
    <div class="vars">
      @for (v of vars(); track v.name) {
        <span class="var"><span class="vname">{{ v.name }}</span><span class="v">{{ v.value }}</span></span>
      }
    </div>
  `,
  styles: `
    .wrap {
      overflow-x: auto;
      display: flex;
      justify-content: center;
      padding: 6px 0;
    }
    table {
      border-collapse: separate;
      border-spacing: 4px;
    }
    th {
      width: 34px;
      height: 26px;
      font: 600 13px var(--mono);
      color: var(--text-2);
      transition: color 0.2s;
      &.hot {
        color: var(--text);
      }
    }
    td {
      width: 38px;
      height: 38px;
      text-align: center;
      border-radius: 9px;
      background: var(--raised);
      font: 600 14px var(--mono);
      transition:
        background-color 0.25s var(--ease),
        box-shadow 0.25s var(--ease),
        color 0.25s;
      span {
        display: inline-block;
      }
      &.empty {
        background: transparent;
        box-shadow: inset 0 0 0 1px var(--tone-5);
      }
      &.active {
        background: var(--tone-1);
        color: var(--on-accent);
        span {
          animation: pop 0.35s var(--ease);
        }
      }
      &.dep {
        box-shadow: inset 0 0 0 2px var(--tone-1);
      }
      &.path {
        background: var(--tone-1);
        color: var(--on-accent);
        box-shadow: 0 0 0 2px var(--surface), 0 0 0 3.5px var(--tone-2);
      }
    }
    @keyframes pop {
      from {
        transform: scale(0.4);
        opacity: 0;
      }
    }
    .legend {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 8px;
      span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }
    .sw {
      width: 11px;
      height: 11px;
      border-radius: 3px;
      &.active,
      &.path {
        background: var(--tone-1);
      }
      &.dep {
        box-shadow: inset 0 0 0 2px var(--tone-1);
      }
    }
    .vars {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
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
  `,
})
export class TableView {
  readonly frame = input.required<Frame>();

  private readonly st = computed(() => stateOf<TableState>(this.frame()));
  protected readonly table = computed(() => this.st().table ?? []);
  protected readonly tones = computed(() => this.st().tones ?? []);
  protected readonly rowLabels = computed(() => this.st().row_labels ?? []);
  protected readonly colLabels = computed(() => this.st().col_labels ?? []);
  protected readonly activeRow = computed(() => this.st().active?.[0] ?? -1);
  protected readonly activeCol = computed(() => this.st().active?.[1] ?? -1);
  protected readonly vars = computed(() => this.st().vars ?? []);
}
