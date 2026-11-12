import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { Api } from '../core/api/api';
import { TRACK_LABELS } from '../core/api/models';
import { APPEARANCES, ThemeService } from '../core/theme/theme';
import { NAV_ITEMS } from './nav';

interface Command {
  id: string;
  group: 'Pages' | 'Topics' | 'Appearance';
  label: string;
  hint: string;
  icon: string;
  run: () => void;
}

@Component({
  selector: 'app-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'close.emit()' },
  template: `
    <div class="backdrop" (click)="close.emit()"></div>
    <div class="panel" role="dialog" aria-label="Search">
      <div class="field">
        <i class="ti ti-search" aria-hidden="true"></i>
        <input
          #search
          [value]="query()"
          (input)="setQuery($any($event.target).value)"
          (keydown)="onKey($event)"
          placeholder="Search topics, pages and settings"
          aria-label="Search"
        />
        <kbd>esc</kbd>
      </div>
      <div class="results" role="listbox">
        @for (cmd of results(); track cmd.id; let i = $index) {
          @if (i === 0 || results()[i - 1].group !== cmd.group) {
            <div class="group label">{{ cmd.group }}</div>
          }
          <button
            class="item"
            role="option"
            [attr.aria-selected]="i === active()"
            [class.active]="i === active()"
            (mouseenter)="active.set(i)"
            (click)="runAt(i)"
          >
            <i class="ti {{ cmd.icon }}" aria-hidden="true"></i>
            <span class="text">{{ cmd.label }}</span>
            <span class="faint">{{ cmd.hint }}</span>
          </button>
        } @empty {
          <p class="empty muted">No matches for “{{ query() }}”</p>
        }
      </div>
      <div class="foot faint">
        <span><kbd>↑</kbd> <kbd>↓</kbd> move</span>
        <span><kbd>↵</kbd> open</span>
      </div>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding-top: 12vh;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgb(0 0 0 / 0.35);
      animation: fade 0.12s;
    }
    .panel {
      position: relative;
      width: min(600px, calc(100vw - 32px));
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      border: 0;
      background: var(--material);
      backdrop-filter: saturate(180%) blur(30px);
      -webkit-backdrop-filter: saturate(180%) blur(30px);
      box-shadow: var(--shadow);
      overflow: hidden;
      animation: rise 0.16s var(--ease);
    }
    .field {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 16px;
      border-bottom: 1px solid var(--border);
      i {
        color: var(--text-3);
        font-size: 18px;
      }
      input {
        flex: 1;
        height: 52px;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--text);
        font: 15px var(--font);
        &::placeholder {
          color: var(--text-2);
        }
      }
    }
    .results {
      overflow-y: auto;
      padding: 6px;
    }
    .group {
      padding: 10px 10px 4px;
    }
    .item {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border: 0;
      border-radius: var(--radius);
      background: transparent;
      color: var(--text);
      font: 13.5px var(--font);
      text-align: left;
      cursor: pointer;
      i {
        color: var(--text-2);
        font-size: 17px;
      }
      &.active {
        background: var(--accent);
        color: var(--on-accent);
        i,
        .faint {
          color: var(--on-accent);
        }
      }
    }
    .text {
      flex: 1;
    }
    .empty {
      padding: 24px;
      text-align: center;
    }
    .foot {
      display: flex;
      gap: 16px;
      padding: 8px 16px;
      border-top: 1px solid var(--border);
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }
    }
  `,
})
export class CommandPalette {
  readonly close = output();

  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly map = inject(Api).knowledgeMap();
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');

  protected readonly query = signal('');
  protected readonly active = signal(0);

  private readonly commands = computed<Command[]>(() => {
    const pages: Command[] = NAV_ITEMS.map((n) => ({
      id: `page:${n.path}`,
      group: 'Pages',
      label: n.label,
      hint: 'Go to page',
      icon: n.icon,
      run: () => this.router.navigateByUrl(n.path),
    }));
    const topics: Command[] = (this.map.value()?.topics ?? []).map((t) => ({
      id: `topic:${t.id}`,
      group: 'Topics',
      label: t.title,
      hint: TRACK_LABELS[t.track],
      icon: t.visualizer ? 'ti-chart-bar' : 'ti-book-2',
      run: () => this.router.navigate(['/topics', t.id]),
    }));
    const themes: Command[] = APPEARANCES.map((a) => ({
      id: `appearance:${a.id}`,
      group: 'Appearance',
      label: `${a.name} appearance`,
      hint: a.description,
      icon: a.icon,
      run: () => this.theme.set(a.id),
    }));
    return [...pages, ...topics, ...themes];
  });

  protected readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.commands();
    if (!q) return all.filter((c) => c.group !== 'Topics').concat(all.filter((c) => c.group === 'Topics').slice(0, 6));
    return all.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q)).slice(0, 30);
  });

  constructor() {
    afterNextRender(() => this.searchInput().nativeElement.focus());
  }

  protected setQuery(value: string): void {
    this.query.set(value);
    this.active.set(0);
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.active.update((i) => (i + 1) % Math.max(count, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.active.update((i) => (i - 1 + count) % Math.max(count, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.runAt(this.active());
    }
  }

  protected runAt(index: number): void {
    const cmd = this.results()[index];
    if (!cmd) return;
    cmd.run();
    this.close.emit();
  }
}
