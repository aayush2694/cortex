import { DOCUMENT, DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

export type Appearance = 'light' | 'dark' | 'auto';
export type Mode = 'light' | 'dark';

export interface AppearanceOption {
  id: Appearance;
  name: string;
  icon: string;
  description: string;
}

export const APPEARANCES: readonly AppearanceOption[] = [
  { id: 'light', name: 'Light', icon: 'ti-sun', description: 'Soft white and grey' },
  { id: 'dark', name: 'Dark', icon: 'ti-moon', description: 'Pure black, easy on the eyes' },
  { id: 'auto', name: 'Auto', icon: 'ti-device-desktop', description: 'Follows your system' },
];

const STORAGE_KEY = 'cortex.appearance';

/** Light / Dark / Auto, like macOS. Applies the resolved mode to <html data-theme="...">. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly appearance = signal<Appearance>(this.load());
  private readonly systemPrefersLight = signal(this.query()?.matches ?? false);

  /** The mode actually shown: Auto resolves to the system setting. */
  readonly mode = computed<Mode>(() => {
    const a = this.appearance();
    if (a === 'auto') return this.systemPrefersLight() ? 'light' : 'dark';
    return a;
  });

  constructor() {
    // Keep Auto in sync when the system switches between light and dark.
    const mq = this.query();
    if (mq) {
      const onChange = (e: MediaQueryListEvent) => this.systemPrefersLight.set(e.matches);
      mq.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));
    }

    effect(() => {
      this.document.documentElement.dataset['theme'] = this.mode();
    });
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, this.appearance());
      } catch {
        // Private mode or blocked storage: the choice still applies for this visit.
      }
    });
  }

  set(appearance: Appearance): void {
    this.appearance.set(appearance);
  }

  private query(): MediaQueryList | null {
    return typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
  }

  private load(): Appearance {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
    } catch {
      // ignore
    }
    return 'auto';
  }
}
