import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';

import { THEMES, ThemeService } from '../core/theme/theme';

@Component({
  selector: 'app-theme-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
  template: `
    <button
      class="btn ghost"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      (click)="open.update((v) => !v)"
    >
      <i class="ti ti-palette" aria-hidden="true"></i>
      <span class="name">{{ currentName() }}</span>
      <i class="ti ti-chevron-down" aria-hidden="true"></i>
    </button>
    @if (open()) {
      <div class="menu" role="menu">
        <div class="label head">Theme</div>
        @for (t of themes; track t.id) {
          <button
            class="option"
            role="menuitemradio"
            [attr.aria-checked]="theme.current() === t.id"
            [class.selected]="theme.current() === t.id"
            (click)="pick(t.id)"
          >
            <span class="swatch" [style.background]="t.swatch[0]">
              <span [style.background]="t.swatch[1]"></span>
            </span>
            <span class="text">
              <span>{{ t.name }}</span>
              <span class="faint">{{ t.description }}</span>
            </span>
            @if (theme.current() === t.id) {
              <i class="ti ti-check" aria-hidden="true"></i>
            }
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
    }
    .menu {
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      width: 260px;
      padding: 6px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-strong);
      background: var(--surface);
      box-shadow: var(--shadow);
      animation: pop 0.14s var(--ease);
    }
    .head {
      padding: 6px 8px;
    }
    .option {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border: 0;
      border-radius: var(--radius);
      background: transparent;
      color: var(--text);
      font: 13px var(--font);
      text-align: left;
      cursor: pointer;
      &:hover,
      &.selected {
        background: var(--hover);
      }
      i {
        color: var(--accent);
      }
    }
    .swatch {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      border: 1px solid var(--border-strong);
      display: grid;
      place-items: center;
      span {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
    }
    .text {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    @keyframes pop {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
    @media (max-width: 600px) {
      .name {
        display: none;
      }
    }
  `,
})
export class ThemePicker {
  protected readonly theme = inject(ThemeService);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly themes = THEMES;
  protected readonly open = signal(false);

  protected currentName(): string {
    return THEMES.find((t) => t.id === this.theme.current())?.name ?? '';
  }

  protected pick(id: (typeof THEMES)[number]['id']): void {
    this.theme.set(id);
    this.open.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
