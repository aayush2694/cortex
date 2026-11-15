import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API } from '../api/api';
import { Me } from '../api/models';

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

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
  private readonly token = signal<string | null>(null);
  private inflightRefresh: Promise<boolean> | null = null;
  private initPromise: Promise<void> | null = null;

  readonly mode = this.modeSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly signedIn = computed(() => this.token() !== null);

  accessToken(): string | null {
    return this.token();
  }

  /** Learn the auth mode; in jwt mode, restore the session from a stored refresh token. */
  init(): Promise<void> {
    this.initPromise ??= this.load();
    return this.initPromise;
  }

  private async load(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ mode: 'dev' | 'jwt'; providers: string[] }>(`${API}/auth/providers`),
      );
      this.modeSignal.set(res.mode);
    } catch {
      this.initPromise = null; // API unreachable: allow a later retry
      return;
    }
    if (this.modeSignal() === 'jwt' && this.readRefresh()) {
      if (await this.refresh()) await this.loadMe();
    }
  }

  signIn(provider: 'github' | 'google'): void {
    this.navigateTo(`${API}/auth/${provider}/start`);
  }

  async completeSignIn(code: string): Promise<void> {
    const pair = await firstValueFrom(this.http.post<TokenPair>(`${API}/auth/token`, { code }));
    this.store(pair);
    await this.loadMe();
  }

  /** Swap the refresh token for a new pair. Concurrent callers share one request. */
  refresh(): Promise<boolean> {
    this.inflightRefresh ??= this.doRefresh().finally(() => (this.inflightRefresh = null));
    return this.inflightRefresh;
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken = this.readRefresh(); // read now: another tab may have rotated it
    if (!refreshToken) return false;
    try {
      const pair = await firstValueFrom(
        this.http.post<TokenPair>(`${API}/auth/refresh`, { refresh_token: refreshToken }),
      );
      this.store(pair);
      return true;
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 400 || status === 401) this.clear(); // rejected for good
      return false;
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
    if (await this.refresh()) return send();
    await this.signOut();
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
