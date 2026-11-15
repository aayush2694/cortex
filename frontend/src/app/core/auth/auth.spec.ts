import { HttpClient } from '@angular/common/http';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api } from '../api/api';
import { Me } from '../api/models';
import { Auth, NAVIGATE_TO } from './auth';
import { authInterceptor } from './auth-interceptor';

const me: Me = { id: 'u1', display_name: 'A', email: 'a@x.dev', avatar_url: null, tutor_access: false };
const pair = (n: number) => ({ access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: 900 });
const expired = { error: { code: 'token_expired', message: 'Your session timed out' } };

describe('Auth', () => {
  let ctrl: HttpTestingController;
  let auth: Auth;
  let http: HttpClient;
  let navigated: string[];
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    navigated = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: NAVIGATE_TO, useValue: (u: string) => navigated.push(u) },
      ],
    });
    ctrl = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(Auth);
    http = TestBed.inject(HttpClient);
    router = TestBed.inject(Router);
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const req = (url: string) => vi.waitFor(() => ctrl.expectOne(url));

  async function signedIn() {
    const done = auth.completeSignIn('code');
    (await req('/api/v1/auth/token')).flush(pair(1));
    (await req('/api/v1/me')).flush(me);
    await done;
  }

  it('sends the sign-in nonce cookie with the login code (same-origin credentials)', async () => {
    const done = auth.completeSignIn('code');
    const token = await req('/api/v1/auth/token');
    expect(token.request.credentials).toBe('same-origin');
    expect(token.request.withCredentials).toBe(false);
    token.flush(pair(1));
    (await req('/api/v1/me')).flush(me);
    await done;
  });

  it('signs in with a login code and keeps only the refresh token in storage', async () => {
    await signedIn();
    expect(auth.signedIn()).toBe(true);
    expect(auth.user()).toEqual(me);
    expect(auth.accessToken()).toBe('access-1');
    expect(localStorage.getItem('cortex.refresh')).toBe('refresh-1');
  });

  it('init in dev mode needs no sign-in', async () => {
    const done = auth.init();
    (await req('/api/v1/auth/providers')).flush({ mode: 'dev', providers: [] });
    await done;
    expect(auth.mode()).toBe('dev');
  });

  it('init in jwt mode refreshes a stored token', async () => {
    localStorage.setItem('cortex.refresh', 'refresh-0');
    const done = auth.init();
    (await req('/api/v1/auth/providers')).flush({ mode: 'jwt', providers: ['github'] });
    const r = await req('/api/v1/auth/refresh');
    expect(r.request.body).toEqual({ refresh_token: 'refresh-0' });
    r.flush(pair(1));
    (await req('/api/v1/me')).flush(me);
    await done;
    expect(auth.signedIn()).toBe(true);
  });

  it('signIn goes to the provider start URL', () => {
    auth.signIn('github');
    expect(navigated).toEqual(['/api/v1/auth/github/start']);
  });

  it('two parallel 401s trigger exactly one refresh and both retries succeed', async () => {
    await signedIn();
    const a = firstValueFrom(http.get('/api/v1/topics'));
    const b = firstValueFrom(http.get('/api/v1/progress'));
    (await req('/api/v1/topics')).flush(expired, { status: 401, statusText: 'Unauthorized' });
    (await req('/api/v1/progress')).flush(expired, { status: 401, statusText: 'Unauthorized' });
    const refresh = await req('/api/v1/auth/refresh');
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(pair(2));
    const retryA = await req('/api/v1/topics');
    const retryB = await req('/api/v1/progress');
    expect(retryA.request.headers.get('Authorization')).toBe('Bearer access-2');
    expect(retryB.request.headers.get('Authorization')).toBe('Bearer access-2');
    retryA.flush({ ok: 'a' });
    retryB.flush({ ok: 'b' });
    expect(await a).toEqual({ ok: 'a' });
    expect(await b).toEqual({ ok: 'b' });
    ctrl.verify();
    expect(localStorage.getItem('cortex.refresh')).toBe('refresh-2');
  });

  it('a failed refresh clears the refresh token and goes to /signin', async () => {
    await signedIn();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const failed = firstValueFrom(http.get('/api/v1/topics')).catch((e) => e);
    (await req('/api/v1/topics')).flush(expired, { status: 401, statusText: 'Unauthorized' });
    (await req('/api/v1/auth/refresh')).flush(
      { error: { code: 'refresh_invalid', message: 'Sign in again' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    await failed;
    expect(localStorage.getItem('cortex.refresh')).toBeNull();
    expect(auth.signedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/signin']);
    ctrl.verify();
  });

  describe.each([
    ['503', (r: TestRequest) =>
      r.flush(null, { status: 503, statusText: 'Unavailable' })],
    ['a network error', (r: TestRequest) =>
      r.error(new ProgressEvent('error'))],
  ])('when the refresh is unavailable (%s)', (_name, fail) => {
    it('keeps the session and fails only the interceptor request', async () => {
      await signedIn();
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const failed = firstValueFrom(http.get('/api/v1/topics')).catch((e) => e);
      (await req('/api/v1/topics')).flush(expired, { status: 401, statusText: 'Unauthorized' });
      fail(await req('/api/v1/auth/refresh'));
      const err = await failed;
      expect(err.status).toBe(401);
      expect(localStorage.getItem('cortex.refresh')).toBe('refresh-1');
      expect(navigate).not.toHaveBeenCalled();
      ctrl.expectNone('/api/v1/auth/logout');
      ctrl.verify();
    });

    it('keeps the session and returns the original response from fetchWithAuth', async () => {
      await signedIn();
      vi.stubGlobal('fetch', async () => new Response(JSON.stringify(expired), { status: 401 }));
      const p = auth.fetchWithAuth('/api/v1/tutor/x', {});
      fail(await req('/api/v1/auth/refresh'));
      const res = await p;
      vi.unstubAllGlobals();
      expect(res.status).toBe(401);
      expect(localStorage.getItem('cortex.refresh')).toBe('refresh-1');
      ctrl.expectNone('/api/v1/auth/logout');
      ctrl.verify();
    });
  });

  it('a token_invalid answer signs out and goes to /signin', async () => {
    await signedIn();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const failed = firstValueFrom(http.get('/api/v1/topics')).catch((e) => e);
    (await req('/api/v1/topics')).flush(
      { error: { code: 'token_invalid', message: 'bad' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    (await req('/api/v1/auth/logout')).flush(null, { status: 204, statusText: 'No Content' });
    await failed;
    expect(auth.signedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/signin']);
  });

  it('auth requests carry no Authorization header, others do', async () => {
    await signedIn();
    firstValueFrom(http.post('/api/v1/auth/refresh', {})).catch(() => undefined);
    const r = await req('/api/v1/auth/refresh');
    expect(r.request.headers.has('Authorization')).toBe(false);
    r.flush(pair(2));
    firstValueFrom(http.get('/api/v1/topics'));
    const t = await req('/api/v1/topics');
    expect(t.request.headers.get('Authorization')).toBe('Bearer access-1');
    t.flush({});
    firstValueFrom(http.get('/other/thing'));
    expect((await req('/other/thing')).request.headers.has('Authorization')).toBe(false);
  });

  it('fetchWithAuth retries once after a 401 token_expired', async () => {
    await signedIn();
    const seen: (string | null)[] = [];
    const calls = vi.fn(async (_u: string, init: RequestInit) => {
      seen.push(new Headers(init.headers).get('Authorization'));
      return seen.length === 1
        ? new Response(JSON.stringify(expired), { status: 401 })
        : new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', calls);
    const p = auth.fetchWithAuth('/api/v1/tutor/x', { method: 'POST' });
    (await req('/api/v1/auth/refresh')).flush(pair(2));
    const res = await p;
    vi.unstubAllGlobals();
    expect(res.status).toBe(200);
    expect(seen).toEqual(['Bearer access-1', 'Bearer access-2']);
  });

  it('fetchWithAuth does not retry a second time', async () => {
    await signedIn();
    const calls = vi.fn(async () => new Response(JSON.stringify(expired), { status: 401 }));
    vi.stubGlobal('fetch', calls);
    const p = auth.fetchWithAuth('/api/v1/tutor/x', {});
    (await req('/api/v1/auth/refresh')).flush(pair(2));
    expect((await p).status).toBe(401);
    vi.unstubAllGlobals();
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it('downloads the export with the bearer token as a blob', async () => {
    await signedIn();
    const api = TestBed.inject(Api);
    const blobPromise = api.downloadExport();
    const r = await req('/api/v1/me/export');
    expect(r.request.responseType).toBe('blob');
    expect(r.request.headers.get('Authorization')).toBe('Bearer access-1');
    r.flush(new Blob(['{}']));
    expect(await (await blobPromise).text()).toBe('{}');
  });

  it('signOut revokes the refresh token and clears everything', async () => {
    await signedIn();
    const done = auth.signOut();
    const r = await req('/api/v1/auth/logout');
    expect(r.request.body).toEqual({ refresh_token: 'refresh-1' });
    r.flush(null, { status: 204, statusText: 'No Content' });
    await done;
    expect(auth.user()).toBeNull();
    expect(auth.accessToken()).toBeNull();
    expect(localStorage.getItem('cortex.refresh')).toBeNull();
  });

  it('deleteAccount deletes the user and clears the session', async () => {
    await signedIn();
    const done = auth.deleteAccount();
    (await req('/api/v1/me')).flush(null, { status: 204, statusText: 'No Content' });
    await done;
    expect(auth.signedIn()).toBe(false);
    expect(localStorage.getItem('cortex.refresh')).toBeNull();
  });
});
