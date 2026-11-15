import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { Auth } from '../core/auth/auth';
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
    @if (auth.mode() === 'jwt' && auth.user(); as user) {
      <div class="account">
        @if (user.avatar_url) {
          <img [src]="user.avatar_url" alt="" width="24" height="24" referrerpolicy="no-referrer" />
        } @else {
          <span class="initials" aria-hidden="true">{{ initials() }}</span>
        }
        <span class="who">{{ user.display_name || user.email }}</span>
        <button type="button" class="btn ghost" (click)="signOut()">Sign out</button>
      </div>
    }
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
      font-size: 12px;
      font-weight: 600;
      color: var(--text-2);
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
    .account {
      margin-top: auto;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 6px 0;
      border-top: 0.5px solid var(--separator);
      img,
      .initials {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .initials {
        display: grid;
        place-items: center;
        background: var(--raised);
        font-size: 12px;
        font-weight: 600;
      }
      .who {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 13px;
      }
      .btn {
        padding: 0 10px;
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
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly initials = computed(() => {
    const u = this.auth.user();
    const name = (u?.display_name || u?.email || '?').trim();
    const parts = name.split(/\s+/);
    return ((parts[0][0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  });

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/signin');
  }
}
