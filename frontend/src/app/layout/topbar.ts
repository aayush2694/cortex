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
      <span>Search</span>
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
      height: 52px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 24px;
      border-bottom: 0.5px solid var(--separator);
      background: var(--material);
      backdrop-filter: saturate(180%) blur(20px);
      -webkit-backdrop-filter: saturate(180%) blur(20px);
    }
    .search {
      display: flex;
      align-items: center;
      gap: 10px;
      width: min(360px, 100%);
      height: 32px;
      padding: 0 8px 0 10px;
      border-radius: 9px;
      border: 0;
      background: var(--raised);
      color: var(--text-2);
      font: 13.5px var(--font);
      cursor: pointer;
      transition: filter 0.15s;
      span {
        flex: 1;
        text-align: left;
      }
      &:hover {
        filter: brightness(1.1);
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
