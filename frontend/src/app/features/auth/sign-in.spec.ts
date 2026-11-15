import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Auth, NAVIGATE_TO } from '../../core/auth/auth';
import { SignIn } from './sign-in';

async function render(providers: string[], error?: string) {
  const navigated: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: NAVIGATE_TO, useValue: (u: string) => navigated.push(u) },
    ],
  });
  const ctrl = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(SignIn);
  if (error) fixture.componentRef.setInput('error', error);
  const init = TestBed.inject(Auth).init();
  ctrl.expectOne('/api/v1/auth/providers').flush({ mode: 'jwt', providers });
  await init;
  await fixture.whenStable();
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, navigated };
}

const labels = (el: HTMLElement) => [...el.querySelectorAll('button')].map((b) => b.textContent?.trim());

describe('SignIn', () => {
  beforeEach(() => localStorage.clear());

  it('shows only the providers the API lists', async () => {
    const { el } = await render(['github']);
    expect(labels(el)).toEqual(['Continue with GitHub']);
    expect(el.textContent).toContain('Sign in to Cortex');
  });

  it('shows both buttons and starts the provider flow', async () => {
    const { el, navigated } = await render(['github', 'google']);
    expect(labels(el)).toEqual(['Continue with GitHub', 'Continue with Google']);
    (el.querySelectorAll('button')[1] as HTMLButtonElement).click();
    expect(navigated).toEqual(['/api/v1/auth/google/start']);
  });

  it.each([
    ['cancelled', 'Sign-in was cancelled.'],
    ['expired', 'That sign-in link expired. Try again.'],
    ['failed', 'Sign-in failed. Try again.'],
  ])('shows the %s error', async (code, text) => {
    const { el } = await render(['github'], code);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(text);
  });

  it('shows no error line without an error', async () => {
    const { el } = await render(['github']);
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });
});
