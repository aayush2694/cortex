import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { Auth } from './core/auth/auth';

import { CommandPalette } from './layout/command-palette';
import { Sidebar } from './layout/sidebar';
import { Topbar } from './layout/topbar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, Topbar, CommandPalette],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKey($event)',
  },
  template: `
    @if (bare()) {
      <router-outlet />
    } @else {
      <app-sidebar [open]="navOpen()" (navigate)="navOpen.set(false)" />
      <div class="main">
        <app-topbar (openSearch)="paletteOpen.set(true)" (toggleNav)="navOpen.update((v) => !v)" />
        <main>
          @if (auth.status() === 'offline') {
            <div class="offline" role="alert">
              <p>Can't reach Cortex right now.</p>
              <button type="button" class="btn primary" (click)="retry()">Try again</button>
            </div>
          } @else {
            <router-outlet />
          }
        </main>
      </div>
      @if (paletteOpen()) {
        <app-command-palette (close)="paletteOpen.set(false)" />
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      min-height: 100vh;
    }
    .main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    main {
      flex: 1;
    }
    .offline {
      min-height: 60vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }
    .offline p {
      margin: 0;
    }
  `,
})
export class App {
  protected readonly paletteOpen = signal(false);
  protected readonly navOpen = signal(false);
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);

  // The sign-in pages are full-screen: no sidebar or topbar.
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: location.pathname },
  );
  protected readonly bare = computed(() => /^\/(signin|auth\/done)(\/|\?|#|$)/.test(this.url()));

  constructor() {
    void this.auth.init();
  }

  /** Ask the API again; if it answers and you are signed out, go to the sign-in page. */
  protected async retry(): Promise<void> {
    await this.auth.init();
    if (this.auth.status() === 'ready' && this.auth.mode() === 'jwt' && !this.auth.signedIn()) {
      await this.router.navigateByUrl('/signin');
    }
  }

  protected onKey(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.paletteOpen.update((open) => !open);
    }
  }
}
