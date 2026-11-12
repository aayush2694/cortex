import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('defaults to Auto', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.appearance()).toBe('auto');
  });

  it('applies the chosen mode to <html> and remembers it', () => {
    const theme = TestBed.inject(ThemeService);
    theme.set('light');
    TestBed.tick(); // run effects
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem('cortex.appearance')).toBe('light');
  });

  it('restores a saved choice and ignores junk', () => {
    localStorage.setItem('cortex.appearance', 'dark');
    expect(TestBed.inject(ThemeService).appearance()).toBe('dark');

    TestBed.resetTestingModule();
    localStorage.setItem('cortex.appearance', 'purple');
    expect(TestBed.inject(ThemeService).appearance()).toBe('auto');
  });
});
