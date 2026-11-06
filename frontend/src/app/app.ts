import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

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
    <app-sidebar [open]="navOpen()" (navigate)="navOpen.set(false)" />
    <div class="main">
      <app-topbar (openSearch)="paletteOpen.set(true)" (toggleNav)="navOpen.update((v) => !v)" />
      <main>
        <router-outlet />
      </main>
    </div>
    @if (paletteOpen()) {
      <app-command-palette (close)="paletteOpen.set(false)" />
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
  `,
})
export class App {
  protected readonly paletteOpen = signal(false);
  protected readonly navOpen = signal(false);

  protected onKey(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.paletteOpen.update((open) => !open);
    }
  }
}
