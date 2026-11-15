import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { Auth } from '../../core/auth/auth';

/** The landing page after the provider: swaps the one-time code in the URL fragment for a session. */
@Component({
  selector: 'app-auth-done',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="muted">Signing you in…</p>`,
  styles: `
    :host {
      flex: 1;
      min-width: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
    }
  `,
})
export class AuthDone {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  constructor() {
    void this.finish();
  }

  private async finish(): Promise<void> {
    const code = new URLSearchParams(location.hash.slice(1)).get('code');
    // Keep the code out of the address bar and history right away.
    history.replaceState(null, '', location.pathname + location.search);
    if (!code) {
      await this.router.navigateByUrl('/signin?error=expired');
      return;
    }
    try {
      await this.auth.completeSignIn(code);
    } catch {
      await this.router.navigateByUrl('/signin?error=expired');
      return;
    }
    await this.router.navigateByUrl('/');
  }
}
