import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { NAV_ITEMS } from './nav';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.open]': 'open()' },
  template: `
    <a class="brand" routerLink="/" (click)="navigate.emit()">
      <span class="logo" aria-hidden="true"><i class="ti ti-brain"></i></span>
      <span>Cortex</span>
    </a>
    <nav aria-label="Main">
      @for (item of items; track item.path) {
        <a
          class="nav-item"
          [routerLink]="item.path"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: !!item.exact }"
          (click)="navigate.emit()"
        >
          <i class="ti {{ item.icon }}" aria-hidden="true"></i>
          {{ item.label }}
        </a>
      }
    </nav>
    <div class="foot faint">Phase 1 · v0.1</div>
  `,
  styles: `
    :host {
      width: 220px;
      flex-shrink: 0;
      position: sticky;
      top: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 16px 12px;
      border-right: 1px solid var(--border);
      background: var(--bg);
      z-index: 20;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 8px 20px;
      color: var(--text);
      font-weight: 600;
      font-size: 15px;
    }
    .logo {
      width: 26px;
      height: 26px;
      border-radius: 7px;
      display: grid;
      place-items: center;
      background: var(--accent);
      color: var(--on-accent);
      font-size: 16px;
    }
    nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: var(--radius);
      color: var(--text-2);
      font-weight: 500;
      font-size: 13.5px;
      transition: background-color 0.15s, color 0.15s;
      i {
        font-size: 18px;
      }
      &:hover {
        background: var(--hover);
        color: var(--text);
      }
      &.active {
        background: var(--raised);
        color: var(--text);
        i {
          color: var(--accent);
        }
      }
    }
    .foot {
      margin-top: auto;
      padding: 0 10px;
    }
    @media (max-width: 900px) {
      :host {
        position: fixed;
        left: 0;
        transform: translateX(-100%);
        transition: transform 0.2s var(--ease);
        box-shadow: var(--shadow);
      }
      :host(.open) {
        transform: none;
      }
    }
  `,
})
export class Sidebar {
  readonly open = input(false);
  readonly navigate = output();
  protected readonly items = NAV_ITEMS;
}
