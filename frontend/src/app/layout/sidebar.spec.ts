import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Me } from '../core/api/models';
import { Auth } from '../core/auth/auth';
import { Sidebar } from './sidebar';

const me = (over: Partial<Me> = {}): Me => ({
  id: 'u',
  display_name: 'Ada Lovelace',
  email: 'ada@x.dev',
  avatar_url: null,
  tutor_access: false,
  ...over,
});

function setup(mode: 'dev' | 'jwt', user: Me | null) {
  const signOut = vi.fn(async () => undefined);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Auth, useValue: { mode: signal(mode), user: signal(user), signOut } },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(Sidebar);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, signOut, navigate };
}

describe('Sidebar account footer', () => {
  it('is hidden in dev mode', () => {
    expect(setup('dev', me()).el.querySelector('.account')).toBeNull();
  });

  it('shows initials and the name when there is no avatar', () => {
    const { el } = setup('jwt', me());
    expect(el.querySelector('.account img')).toBeNull();
    expect(el.querySelector('.initials')?.textContent).toBe('AL');
    expect(el.querySelector('.who')?.textContent).toBe('Ada Lovelace');
  });

  it('shows a 24px avatar with empty alt when there is one', () => {
    const { el } = setup('jwt', me({ avatar_url: 'https://a.test/p.png' }));
    const img = el.querySelector('.account img') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('width')).toBe('24');
    expect(el.querySelector('.initials')).toBeNull();
  });

  it('Sign out signs out and goes to /signin', async () => {
    const { el, signOut, navigate } = setup('jwt', me());
    const btn = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Sign out'))!;
    btn.click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/signin'));
    expect(signOut).toHaveBeenCalled();
  });
});
