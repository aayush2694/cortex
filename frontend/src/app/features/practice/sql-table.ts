import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { show } from './practice-format';

/** A small read-only table: a SQL input table, the expected rows, or what your query returned. */
@Component({
  selector: 'app-sql-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (caption()) {
      <span class="cap faint">{{ caption() }}</span>
    }
    <div class="scroll">
      <table>
        <thead>
          <tr>
            @for (c of columns(); track $index) {
              <th>{{ c }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track $index) {
            <tr>
              @for (v of row; track $index) {
                <td [class.null]="v === null">{{ v === null ? 'NULL' : cell(v) }}</td>
              }
            </tr>
          } @empty {
            <tr><td class="empty" [attr.colspan]="columns().length || 1">no rows</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .cap {
      display: block;
      font-family: var(--mono);
      margin-bottom: 4px;
    }
    .scroll {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      font: 12px var(--mono);
    }
    th {
      text-align: left;
      font-weight: 600;
      color: var(--text-2);
      padding: 3px 12px 3px 0;
      border-bottom: 0.5px solid var(--border-strong);
    }
    td {
      padding: 3px 12px 3px 0;
      white-space: nowrap;
    }
    .null,
    .empty {
      color: var(--text-2);
      font-style: italic;
    }
  `,
})
export class SqlTable {
  readonly columns = input<string[]>([]);
  readonly rows = input<unknown[][]>([]);
  readonly caption = input('');

  protected cell(v: unknown): string {
    return typeof v === 'string' ? v : show(v);
  }
}
