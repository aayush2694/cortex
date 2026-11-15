import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { Auth } from '../../core/auth/auth';

const ERRORS: Record<string, string> = {
  cancelled: 'Sign-in was cancelled.',
  expired: 'That sign-in link expired. Try again.',
  failed: 'Sign-in failed. Try again.',
};

@Component({
  selector: 'app-sign-in',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card box">
      <span class="logo" aria-hidden="true"><i class="ti ti-brain"></i></span>
      <h1>Sign in to Cortex</h1>
      <p class="muted">
        New here? Signing in creates your account. Your progress, notes and job tracker stay
        private to you.
      </p>
      @if (message()) {
        <p class="error" role="alert">{{ message() }}</p>
      }
      @if (has('github')) {
        <button type="button" class="btn primary" (click)="auth.signIn('github')">
          <i class="ti ti-brand-github" aria-hidden="true"></i>Continue with GitHub
        </button>
      }
      @if (has('google')) {
        <button type="button" class="btn" (click)="auth.signIn('google')">
          <i class="ti ti-brand-google" aria-hidden="true"></i>Continue with Google
        </button>
      }
      <p class="faint">
        The AI tutor is invite-only for now. We only read your name, email and avatar.
      </p>
    </section>
  `,
  styles: `
    :host {
      flex: 1;
      min-width: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .box {
      width: 100%;
      max-width: 380px;
      padding: 32px 28px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
      text-align: center;
    }
    .logo {
      align-self: center;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: var(--accent);
      color: var(--on-accent);
      font-size: 26px;
    }
    h1 {
      margin: 8px 0 0;
      font: 600 22px var(--font-display);
      letter-spacing: -0.02em;
    }
    p {
      margin: 0;
    }
    .error {
      font-size: 13.5px;
      font-weight: 500;
    }
    .btn {
      height: 40px;
      justify-content: center;
    }
    .faint {
      margin-top: 4px;
    }
  `,
})
export class SignIn {
  protected readonly auth = inject(Auth);
  /** `?error=` from the callback redirect, bound from the route. */
  readonly error = input<string>();
  protected readonly message = computed(() => ERRORS[this.error() ?? '']);

  protected has(provider: string): boolean {
    return this.auth.providers().includes(provider);
  }
}
