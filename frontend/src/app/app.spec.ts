import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { App } from './app';
import { Auth } from './core/auth/auth';

@Component({ template: 'page' })
class Page {}

const routes = [
  { path: '', component: Page },
  { path: 'signin', component: Page },
  { path: 'auth/done', component: Page },
];

async function setup() {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
  });
  const ctrl = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  const fixture = TestBed.createComponent(App);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { ctrl, router, fixture, el, settle, auth: TestBed.inject(Auth) };
}

describe('App shell', () => {
  it('shows the offline screen when the API is down, and Try again re-runs init', async () => {
    const { ctrl, el, settle, auth } = await setup();
    ctrl.expectOne('/api/v1/auth/providers').flush('x', { status: 503, statusText: 'down' });
    await vi.waitFor(() => expect(auth.status()).toBe('offline'));
    await settle();
    expect(el.textContent).toContain("Can't reach Cortex right now.");
    expect(el.querySelector('app-sidebar')).not.toBeNull();
    const retry = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Try again'))!;
    retry.click();
    ctrl.expectOne('/api/v1/auth/providers').flush({ mode: 'dev', providers: [] });
    await vi.waitFor(() => expect(auth.status()).toBe('ready'));
    await settle();
    expect(el.textContent).not.toContain("Can't reach Cortex");
  });

  it('retry goes to /signin when the API answers in jwt mode with no session', async () => {
    const { ctrl, router, el, settle, auth } = await setup();
    ctrl.expectOne('/api/v1/auth/providers').flush('x', { status: 503, statusText: 'down' });
    await vi.waitFor(() => expect(auth.status()).toBe('offline'));
    await settle();
    const nav = vi.spyOn(router, 'navigateByUrl');
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Try again'))!.click();
    ctrl.expectOne('/api/v1/auth/providers').flush({ mode: 'jwt', providers: ['github'] });
    await vi.waitFor(() => expect(nav).toHaveBeenCalledWith('/signin'));
  });

  it('never shows the offline screen in dev mode when the API answers', async () => {
    const { ctrl, router, el, settle } = await setup();
    ctrl.expectOne('/api/v1/auth/providers').flush({ mode: 'dev', providers: [] });
    await router.navigateByUrl('/');
    await settle();
    expect(el.textContent).not.toContain("Can't reach Cortex");
    expect(el.querySelector('app-sidebar')).not.toBeNull();
  });

  it.each(['/signin', '/auth/done'])('hides sidebar and topbar on %s', async (url) => {
    const { ctrl, router, el, settle } = await setup();
    ctrl.expectOne('/api/v1/auth/providers').flush({ mode: 'dev', providers: [] });
    await router.navigateByUrl(url);
    await settle();
    expect(el.querySelector('app-sidebar')).toBeNull();
    expect(el.querySelector('app-topbar')).toBeNull();
  });
});
