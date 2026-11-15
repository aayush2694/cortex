import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router, UrlTree, provideRouter } from '@angular/router';

import { routes } from '../../app.routes';
import { Auth } from './auth';
import { authGuard, signedOutGuard } from './auth-guard';

describe('authGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  const run = () =>
    TestBed.runInInjectionContext(() => (authGuard as CanActivateFn)({} as never, {} as never));

  it('allows everything in dev mode', async () => {
    const ctrl = TestBed.inject(HttpTestingController);
    const result = run();
    (await vi.waitFor(() => ctrl.expectOne('/api/v1/auth/providers'))).flush({ mode: 'dev', providers: [] });
    expect(await result).toBe(true);
  });

  it('redirects to /signin in jwt mode when signed out', async () => {
    const ctrl = TestBed.inject(HttpTestingController);
    const result = run();
    (await vi.waitFor(() => ctrl.expectOne('/api/v1/auth/providers'))).flush({
      mode: 'jwt',
      providers: ['github'],
    });
    const out = (await result) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(out)).toBe('/signin');
  });
});

describe('authGuard when the API is unreachable', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });
  const run = () =>
    TestBed.runInInjectionContext(() => (authGuard as CanActivateFn)({} as never, {} as never));

  it('does not redirect to /signin when the API is down; status is offline', async () => {
    const ctrl = TestBed.inject(HttpTestingController);
    const result = run();
    (await vi.waitFor(() => ctrl.expectOne('/api/v1/auth/providers'))).flush('x', {
      status: 503,
      statusText: 'down',
    });
    expect(await result).toBe(true);
    expect(TestBed.inject(Auth).status()).toBe('offline');
  });

  it('stays offline, not signed out, when the stored refresh token could not be checked', async () => {
    localStorage.setItem('cortex.refresh', 'r1');
    const ctrl = TestBed.inject(HttpTestingController);
    const result = run();
    (await vi.waitFor(() => ctrl.expectOne('/api/v1/auth/providers'))).flush({ mode: 'jwt', providers: [] });
    (await vi.waitFor(() => ctrl.expectOne('/api/v1/auth/refresh'))).flush('x', {
      status: 503,
      statusText: 'down',
    });
    expect(await result).toBe(true);
    expect(TestBed.inject(Auth).status()).toBe('offline');
    expect(localStorage.getItem('cortex.refresh')).toBe('r1');
  });

  it('retry() asks the API again and becomes ready', async () => {
    const ctrl = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(Auth);
    const first = auth.init();
    (await vi.waitFor(() => ctrl.expectOne('/api/v1/auth/providers'))).flush('x', {
      status: 503,
      statusText: 'down',
    });
    await first;
    const again = auth.init();
    (await vi.waitFor(() => ctrl.expectOne('/api/v1/auth/providers'))).flush({ mode: 'dev', providers: [] });
    await again;
    expect(auth.status()).toBe('ready');
    expect(auth.mode()).toBe('dev');
  });
});

describe('Auth timeouts', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });
  afterEach(() => vi.useRealTimers());

  it('waits out a 60 s cold start before going offline when /auth/providers never answers', async () => {
    const ctrl = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(Auth);
    const done = auth.init();
    ctrl.expectOne('/api/v1/auth/providers');
    await vi.advanceTimersByTimeAsync(8000);
    expect(auth.status()).toBe('loading');
    await vi.advanceTimersByTimeAsync(52000);
    await done;
    expect(auth.status()).toBe('offline');
    expect(auth.waking()).toBe(false);
  });

  it('is waking after 3 s of loading, and not once the API answers', async () => {
    const ctrl = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(Auth);
    const done = auth.init();
    const probe = ctrl.expectOne('/api/v1/auth/providers');
    await vi.advanceTimersByTimeAsync(2999);
    expect(auth.waking()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(auth.waking()).toBe(true);
    probe.flush({ mode: 'dev', providers: [] });
    await done;
    expect(auth.waking()).toBe(false);
    expect(auth.status()).toBe('ready');
  });

  it('a slow answer within 60 s still signs you in', async () => {
    const ctrl = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(Auth);
    const done = auth.init();
    const probe = ctrl.expectOne('/api/v1/auth/providers');
    await vi.advanceTimersByTimeAsync(45000);
    probe.flush({ mode: 'dev', providers: [] });
    await done;
    expect(auth.status()).toBe('ready');
  });

  it('goes offline, keeping the token, when /auth/refresh never answers', async () => {
    localStorage.setItem('cortex.refresh', 'r1');
    const ctrl = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(Auth);
    const done = auth.init();
    ctrl.expectOne('/api/v1/auth/providers').flush({ mode: 'jwt', providers: [] });
    await vi.advanceTimersByTimeAsync(0);
    ctrl.expectOne('/api/v1/auth/refresh');
    await vi.advanceTimersByTimeAsync(8000);
    expect(auth.status()).toBe('loading'); // a rotation may still land: do not give up yet
    await vi.advanceTimersByTimeAsync(52000);
    await done;
    expect(auth.status()).toBe('offline');
    expect(localStorage.getItem('cortex.refresh')).toBe('r1');
  });
});

describe('signedOutGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });
  afterEach(() => localStorage.clear());
  const run = () =>
    TestBed.runInInjectionContext(() => (signedOutGuard as CanActivateFn)({} as never, {} as never));

  it('sends a signed-in user from /signin to the app', async () => {
    localStorage.setItem('cortex.refresh', 'r1');
    const ctrl = TestBed.inject(HttpTestingController);
    const result = run();
    (await vi.waitFor(() => ctrl.expectOne('/api/v1/auth/providers'))).flush({ mode: 'jwt', providers: ['github'] });
    (await vi.waitFor(() => ctrl.expectOne('/api/v1/auth/refresh'))).flush({
      access_token: 'a',
      refresh_token: 'r2',
      expires_in: 900,
    });
    (await vi.waitFor(() => ctrl.expectOne('/api/v1/me'))).flush({ id: 'u' });
    const out = (await result) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(out)).toBe('/');
  });

  it('guards the /signin route', () => {
    expect(routes.find((r) => r.path === 'signin')?.canActivate).toEqual([signedOutGuard]);
  });

  it('shows /signin to a signed-out user', async () => {
    const ctrl = TestBed.inject(HttpTestingController);
    const result = run();
    (await vi.waitFor(() => ctrl.expectOne('/api/v1/auth/providers'))).flush({ mode: 'jwt', providers: ['github'] });
    expect(await result).toBe(true);
  });
});
