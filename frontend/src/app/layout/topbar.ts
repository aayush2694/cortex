import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { ThemePicker } from './theme-picker';

@Component({
  selector: 'app-topbar',
  imports: [ThemePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="btn ghost icon menu" aria-label="Open navigation" (click)="toggleNav.emit()">
      <i class="ti ti-menu-2"></i>
    </button>
    <button class="search" (click)="openSearch.emit()">
      <i class="ti ti-search" aria-hidden="true"></i>
      <span>Search topics, pages, themes</span>
      <kbd>⌘K</kbd>
    </button>
    <div class="spacer"></div>
    <app-theme-picker />
  `,
  styles: `
    :host {
      position: sticky;
      top: 0;
      z-index: 10;
      height: 56px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 24px;
      border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--bg) 85%, transparent);
      backdrop-filter: blur(8px);
    }
    .search {
      display: flex;
      align-items: center;
      gap: 10px;
      width: min(360px, 100%);
      height: 34px;
      padding: 0 8px 0 12px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-3);
      font: 13px var(--font);
      cursor: pointer;
      transition: border-color 0.15s;
      span {
        flex: 1;
        text-align: left;
      }
      &:hover {
        border-color: var(--border-strong);
      }
    }
    .spacer {
      flex: 1;
    }
    .menu {
      display: none;
    }
    @media (max-width: 900px) {
      :host {
        padding: 0 12px;
      }
      .menu {
        display: inline-flex;
      }
    }
  `,
})
export class Topbar {
  readonly openSearch = output();
  readonly toggleNav = output();
}
