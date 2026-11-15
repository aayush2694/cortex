import { TestBed } from '@angular/core/testing';

import { provideRouter, Router } from '@angular/router';

import { Api } from '../../core/api/api';
import { Auth } from '../../core/auth/auth';
import { Settings } from './settings';

describe('Settings export', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads your data as cortex-data.json and frees the object URL', async () => {
    const blob = new Blob(['{}']);
    const downloadExport = vi.fn(async () => blob);
    TestBed.configureTestingModule({ providers: [{ provide: Api, useValue: { downloadExport, plan: () => ({ value: () => undefined }) } }] });
    const create = vi.fn(() => 'blob:cortex');
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    let saved = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved = this.download;
    });

    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Download my data'),
    ) as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:cortex'));
    expect(create).toHaveBeenCalledWith(blob);
    expect(saved).toBe('cortex-data.json');
  });

  it('shows a message and saves nothing when the download fails', async () => {
    const downloadExport = vi.fn(async () => {
      throw { error: { error: { message: 'Sign in again' } } };
    });
    TestBed.configureTestingModule({
      providers: [{ provide: Api, useValue: { downloadExport, plan: () => ({ value: () => undefined }) } }],
    });
    const create = vi.fn(() => 'blob:cortex');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Download my data'),
    ) as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('Sign in again');
    });
    expect(create).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
  });
});

describe('Settings delete account', () => {
  const setup = async (mode: 'dev' | 'jwt') => {
    const deleteAccount = vi.fn(async () => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Api, useValue: { plan: () => ({ value: () => undefined }) } },
        { provide: Auth, useValue: { mode: () => mode, deleteAccount } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, deleteAccount, navigate };
  };
  const button = (el: HTMLElement) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Delete my account')) as
      | HTMLButtonElement
      | undefined;

  it('is hidden in dev mode', async () => {
    const { el } = await setup('dev');
    expect(button(el)).toBeUndefined();
  });

  it('enables the button only when you type delete, then deletes and goes to /signin', async () => {
    const { fixture, el, deleteAccount, navigate } = await setup('jwt');
    const input = el.querySelector('input.confirm') as HTMLInputElement;
    expect(button(el)!.disabled).toBe(true);
    input.value = 'delet';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button(el)!.disabled).toBe(true);
    input.value = 'delete';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button(el)!.disabled).toBe(false);
    button(el)!.click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/signin'));
    expect(deleteAccount).toHaveBeenCalled();
  });

  it.each(['Delete', ' delete ', 'DELETE'])('accepts %j as the confirmation', async (typed) => {
    const { fixture, el } = await setup('jwt');
    const input = el.querySelector('input.confirm') as HTMLInputElement;
    input.value = typed;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button(el)!.disabled).toBe(false);
    expect(input.getAttribute('autocapitalize')).toBe('off');
    expect(input.getAttribute('spellcheck')).toBe('false');
  });
});
