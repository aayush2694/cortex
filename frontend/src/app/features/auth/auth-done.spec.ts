import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthDone } from './auth-done';

describe('AuthDone', () => {
  let ctrl: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    ctrl = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    history.replaceState(null, '', '/auth/done#code=abc123');
  });
  afterEach(() => history.replaceState(null, '', '/'));

  it('exchanges the code, clears the fragment and goes home', async () => {
    const fixture = TestBed.createComponent(AuthDone);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Signing you in');
    const req = await vi.waitFor(() => ctrl.expectOne('/api/v1/auth/token'));
    expect(req.request.body).toEqual({ code: 'abc123' });
    expect(location.hash).toBe('');
    req.flush({ access_token: 'a', refresh_token: 'r', expires_in: 900 });
    await vi.waitFor(() => ctrl.expectOne('/api/v1/me').flush({ id: 'u' }));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
  });

  it('goes to /signin?error=expired when the code is rejected', async () => {
    TestBed.createComponent(AuthDone);
    const req = await vi.waitFor(() => ctrl.expectOne('/api/v1/auth/token'));
    req.flush({ error: { code: 'invalid_code' } }, { status: 400, statusText: 'Bad' });
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/signin?error=expired'));
  });

  it('goes to /signin?error=expired when there is no code', async () => {
    history.replaceState(null, '', '/auth/done');
    TestBed.createComponent(AuthDone);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/signin?error=expired'));
    ctrl.expectNone('/api/v1/auth/token');
  });
});
