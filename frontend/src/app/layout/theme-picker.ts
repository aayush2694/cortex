import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { APPEARANCES, ThemeService } from '../core/theme/theme';

/** Compact Light / Dark / Auto switch for the top bar. */
@Component({
  selector: 'app-theme-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="segmented compact" role="radiogroup" aria-label="Appearance">
      @for (a of options; track a.id) {
        <button
          role="radio"
          [attr.aria-checked]="theme.appearance() === a.id"
          [attr.aria-label]="a.name"
          [attr.title]="a.name"
          [class.on]="theme.appearance() === a.id"
          (click)="theme.set(a.id)"
        >
          <i class="ti {{ a.icon }}" aria-hidden="true"></i>
        </button>
      }
    </div>
  `,
  styles: `
    .compact button {
      width: 32px;
      height: 26px;
      padding: 0;
      justify-content: center;
      i {
        font-size: 15px;
      }
    }
  `,
})
export class ThemePicker {
  protected readonly theme = inject(ThemeService);
  protected readonly options = APPEARANCES;
}
