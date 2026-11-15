import { TestBed } from '@angular/core/testing';

import { Api } from '../../core/api/api';
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
});
