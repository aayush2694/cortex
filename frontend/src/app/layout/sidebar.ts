import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { NAV_SECTIONS } from './nav';

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
      @for (section of sections; track section.title) {
        <div class="section">{{ section.title }}</div>
        @for (item of section.items; track item.path) {
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
      }
    </nav>
  `,
  styles: `
    :host {
      width: 232px;
      flex-shrink: 0;
      position: sticky;
      top: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 18px 10px;
      background: var(--sidebar);
      border-right: 0.5px solid var(--separator);
      z-index: 20;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 2px 10px 14px;
      font: 600 16px var(--font-display);
      letter-spacing: -0.02em;
    }
    .logo {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: var(--accent);
      color: var(--on-accent);
      font-size: 17px;
    }
    nav {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .section {
      padding: 14px 10px 5px;
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-3);
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 32px;
      padding: 0 10px;
      border-radius: 8px;
      color: var(--text);
      font-size: 13.5px;
      transition: background-color 0.15s;
      i {
        font-size: 17px;
        color: var(--text-2);
      }
      &:hover {
        background: var(--hover);
      }
      &.active {
        background: var(--accent);
        color: var(--on-accent);
        font-weight: 500;
        i {
          color: var(--on-accent);
        }
      }
    }
    @media (max-width: 900px) {
      :host {
        position: fixed;
        left: 0;
        transform: translateX(-100%);
        transition: transform 0.35s var(--ease);
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
  protected readonly sections = NAV_SECTIONS;
}
