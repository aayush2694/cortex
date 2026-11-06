import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  swatch: [bg: string, accent: string];
}

export type ThemeId = 'midnight' | 'graphite' | 'ocean' | 'ember' | 'daylight';

export const THEMES: readonly ThemeOption[] = [
  { id: 'midnight', name: 'Midnight', description: 'Deep black with indigo', swatch: ['#0b0d10', '#7c8cff'] },
  { id: 'graphite', name: 'Graphite', description: 'Neutral grey with teal', swatch: ['#0e0e0f', '#2dd4bf'] },
  { id: 'ocean', name: 'Ocean', description: 'Navy with sky blue', swatch: ['#080d18', '#38bdf8'] },
  { id: 'ember', name: 'Ember', description: 'Warm dark with coral', swatch: ['#0f0c0a', '#ff7a59'] },
  { id: 'daylight', name: 'Daylight', description: 'Light, for bright rooms', swatch: ['#f6f6f4', '#4f5bd5'] },
];

const STORAGE_KEY = 'cortex.theme';

/** Holds the current theme and applies it to <html data-theme="...">. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly current = signal<ThemeId>(this.load());

  constructor() {
    effect(() => {
      const id = this.current();
      this.document.documentElement.dataset['theme'] = id;
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // Private mode or blocked storage: the theme still works for this visit.
      }
    });
  }

  set(id: ThemeId): void {
    this.current.set(id);
  }

  private load(): ThemeId {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (THEMES.some((t) => t.id === saved)) return saved as ThemeId;
    } catch {
      // ignore
    }
    return 'midnight';
  }
}
