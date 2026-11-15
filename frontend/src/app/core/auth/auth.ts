import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';

import { API } from '../api/api';
import { Me } from '../api/models';

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** 'offline': the API could not be reached, so we do not know if you are signed in. */
export type AuthStatus = 'loading' | 'ready' | 'offline';

export type RefreshResult = 'ok' | 'rejected' | 'unavailable';

/**
 * How long to wait for the API before treating it as unreachable. Render free-tier cold starts
 * take 30-60 s; giving up sooner would show "Can't reach Cortex" to most first visitors, and a
 * refresh abandoned early may still rotate on the server, leaving this tab with a used token.
 */
const API_TIMEOUT_MS = 60_000;

/** After this long still loading, say the server is waking up rather than showing nothing. */
const WAKING_AFTER_MS = 3000;

const REFRESH_KEY = 'cortex.refresh';

/** Leaves the app for the provider's sign-in page. A token so tests can replace it. */
export const NAVIGATE_TO = new InjectionToken<(url: string) => void>('NAVIGATE_TO', {
  providedIn: 'root',
  factory: () => (url: string) => location.assign(url),
});

/** The error code in the API's `{"error": {"code"}}` body, from an HttpErrorResponse. */
export function errorCode(err: unknown): string | undefined {
  return (err as { error?: { error?: { code?: string } } })?.error?.error?.code;
}

/**
 * Sign-in state. The access token lives only in memory; the refresh token is in localStorage
 * so a reload keeps you signed in. In `dev` mode the API needs no token at all.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly navigateTo = inject(NAVIGATE_TO);

  private readonly modeSignal = signal<'dev' | 'jwt' | null>(null);
  private readonly userSignal = signal<Me | null>(null);
  private readonly statusSignal = signal<AuthStatus>('loading');
  private readonly providersSignal = signal<string[]>([]);
  private readonly token = signal<string | null>(null);
  private inflightRefresh: Promise<RefreshResult> | null = null;
  private initPromise: Promise<void> | null = null;

  readonly mode = this.modeSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly providers = this.providersSignal.asReadonly();
  private readonly wakingSignal = signal(false);
  readonly signedIn = computed(() => this.token() !== null);
  /** True while init has been loading for over 3 s (a cold start); never an error. */
  readonly waking = this.wakingSignal.asReadonly();

  accessToken(): string | null {
    return this.token();
  }

  /** Learn the auth mode; in jwt mode, restore the session from a stored refresh token. */
  init(): Promise<void> {
    this.initPromise ??= this.loadWithWakingNotice();
    return this.initPromise;
  }

  private async loadWithWakingNotice(): Promise<void> {
    const timer = setTimeout(() => this.wakingSignal.set(true), WAKING_AFTER_MS);
    try {
      await this.load();
    } finally {
      clearTimeout(timer);
      this.wakingSignal.set(false);
    }
  }

  private async load(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http
          .get<{ mode: 'dev' | 'jwt'; providers: string[] }>(`${API}/auth/providers`)
          .pipe(timeout(API_TIMEOUT_MS)),
      );
      this.modeSignal.set(res.mode);
      this.providersSignal.set(res.providers);
    } catch {
      this.initPromise = null; // API unreachable: allow a later retry
      this.statusSignal.set('offline');
      return;
    }
    if (this.modeSignal() === 'jwt' && this.readRefresh()) {
      const result = await this.refresh();
      if (result === 'ok') await this.loadMe();
      if (result === 'unavailable') {
        this.initPromise = null;
        this.statusSignal.set('offline');
        return;
      }
    }
    this.statusSignal.set('ready');
  }

  signIn(provider: 'github' | 'google'): void {
    this.navigateTo(`${API}/auth/${provider}/start`);
  }

  async completeSignIn(code: string): Promise<void> {
    // Same-origin credentials carry the HttpOnly nonce cookie that /start set on this browser.
    const pair = await firstValueFrom(
      this.http.post<TokenPair>(`${API}/auth/token`, { code }, { credentials: 'same-origin' }),
    );
    this.store(pair);
    await this.loadMe();
  }

  /**
   * Swap the refresh token for a new pair. Concurrent callers share one request.
   * 'rejected' means the token is no good (sign out); 'unavailable' means the server could not
   * be reached or failed (keep the session and try again later).
   */
  refresh(): Promise<RefreshResult> {
    this.inflightRefresh ??= this.doRefresh().finally(() => (this.inflightRefresh = null));
    return this.inflightRefresh;
  }

  private async doRefresh(): Promise<RefreshResult> {
    const refreshToken = this.readRefresh(); // read now: another tab may have rotated it
    if (!refreshToken) return 'rejected';
    try {
      const pair = await firstValueFrom(
        this.http
          .post<TokenPair>(`${API}/auth/refresh`, { refresh_token: refreshToken })
          .pipe(timeout(API_TIMEOUT_MS)),
      );
      this.store(pair);
      return 'ok';
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 400 || status === 401) {
        this.clear();
        return 'rejected';
      }
      return 'unavailable';
    }
  }

  async signOut(): Promise<void> {
    const refreshToken = this.readRefresh();
    this.clear();
    if (!refreshToken) return;
    try {
      await firstValueFrom(this.http.post(`${API}/auth/logout`, { refresh_token: refreshToken }));
    } catch {
      // already signed out locally; the server copy expires on its own
    }
  }

  async deleteAccount(): Promise<void> {
    await firstValueFrom(this.http.delete(`${API}/me`));
    this.clear();
  }

  /** `fetch` with the bearer token; refreshes once on an expired token and retries once. */
  async fetchWithAuth(input: string, init: RequestInit): Promise<Response> {
    const send = () => {
      const headers = new Headers(init.headers);
      const token = this.token();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    };
    const res = await send();
    if (res.status !== 401) return res;
    const code = await res
      .clone()
      .json()
      .then((b) => b?.error?.code as string | undefined)
      .catch(() => undefined);
    if (code !== 'token_expired') return res;
    const result = await this.refresh();
    if (result === 'ok') return send();
    if (result === 'rejected') await this.signOut();
    return res;
  }

  private async loadMe(): Promise<void> {
    try {
      this.userSignal.set(await firstValueFrom(this.http.get<Me>(`${API}/me`)));
    } catch {
      // signed in but the profile did not load; the next page load tries again
    }
  }

  private store(pair: TokenPair): void {
    this.token.set(pair.access_token);
    try {
      localStorage.setItem(REFRESH_KEY, pair.refresh_token);
    } catch {
      // storage blocked: you stay signed in until the page reloads
    }
  }

  private clear(): void {
    this.token.set(null);
    this.userSignal.set(null);
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      // storage blocked
    }
  }

  private readRefresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  }
}
