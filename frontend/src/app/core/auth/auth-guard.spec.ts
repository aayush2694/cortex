import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router, UrlTree, provideRouter } from '@angular/router';

import { authGuard } from './auth-guard';

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
