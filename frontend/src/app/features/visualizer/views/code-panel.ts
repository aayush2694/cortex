import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-code-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <span class="label">Python</span>
      <span class="faint">line {{ line() }}</span>
    </div>
    <pre><code>@for (src of source(); track $index) {<span class="line" [class.on]="$index + 1 === line()"><span class="no">{{ $index + 1 }}</span>{{ src || ' ' }}
</span>}</code></pre>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      min-width: 0;
    }
    .head {
      display: flex;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
    }
    pre {
      margin: 0;
      padding: 10px 0;
      overflow: auto;
      line-height: 1.75;
      color: var(--text-2);
    }
    .line {
      display: block;
      padding: 0 14px 0 0;
      border-left: 3px solid transparent;
      transition: background-color 0.12s, color 0.12s;
      &.on {
        background: var(--accent-soft);
        border-left-color: var(--accent);
        color: var(--text);
      }
    }
    .no {
      display: inline-block;
      width: 34px;
      padding-right: 12px;
      text-align: right;
      color: var(--text-3);
      user-select: none;
    }
  `,
})
export class CodePanel {
  readonly source = input.required<string[]>();
  readonly line = input(0);
}
