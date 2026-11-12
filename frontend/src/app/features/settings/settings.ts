import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { Api } from '../../core/api/api';
import { APPEARANCES, ThemeService } from '../../core/theme/theme';
import { PlanSettings } from './plan-settings';

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['⌘', 'K'], action: 'Search topics, pages and settings' },
  { keys: ['Space'], action: 'Play or pause the visualizer' },
  { keys: ['←', '→'], action: 'Step backward or forward' },
  { keys: ['R'], action: 'Restart the visualizer' },
  { keys: ['Enter'], action: 'Send a message to the tutor' },
  { keys: ['Shift', 'Enter'], action: 'New line in a tutor message' },
];

@Component({
  selector: 'app-settings',
  imports: [PlanSettings],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page narrow">
      <header class="page-head">
        <h1>Settings</h1>
      </header>

      <span class="group-label">Appearance</span>
      <div class="card appearance" role="radiogroup" aria-label="Appearance">
        @for (a of appearances; track a.id) {
          <button
            class="option"
            role="radio"
            [attr.aria-checked]="theme.appearance() === a.id"
            [class.on]="theme.appearance() === a.id"
            (click)="theme.set(a.id)"
          >
            <span class="preview {{ a.id }}" aria-hidden="true">
              <span class="win">
                <span class="bar"></span>
                <span class="line"></span>
                <span class="line short"></span>
              </span>
            </span>
            <span class="name">{{ a.name }}</span>
            <span class="faint">{{ a.description }}</span>
          </button>
        }
      </div>

      <app-plan-settings />

      <span class="group-label">Keyboard shortcuts</span>
      <div class="list">
        @for (s of shortcuts; track s.action) {
          <div class="list-row plain">
            <span class="row-main"><span>{{ s.action }}</span></span>
            <span class="keys">
              @for (k of s.keys; track k) {
                <kbd>{{ k }}</kbd>
              }
            </span>
          </div>
        }
      </div>

      <span class="group-label">Your data</span>
      <div class="list">
        <a class="list-row plain" [href]="exportUrl" download>
          <span class="row-main">
            <span>Download my data</span>
            <span class="faint">Progress, practice, flashcards, notes, job search and tutor chats as JSON</span>
          </span>
          <i class="ti ti-download chev" aria-hidden="true"></i>
        </a>
      </div>

      <span class="group-label">About</span>
      <div class="list">
        <div class="list-row plain"><span class="row-main"><span>Version</span></span><span class="muted">0.2 · before Azure deployment</span></div>
        <a class="list-row plain" href="https://github.com/aayush2694/cortex" target="_blank" rel="noopener">
          <span class="row-main"><span>Source code</span></span>
          <span class="muted">GitHub</span><i class="ti ti-arrow-up-right chev" aria-hidden="true"></i>
        </a>
        <a class="list-row plain" href="https://github.com/aayush2694/cortex-roadmap" target="_blank" rel="noopener">
          <span class="row-main"><span>Roadmap</span></span>
          <span class="muted">GitHub</span><i class="ti ti-arrow-up-right chev" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  `,
  styles: `
    .narrow {
      max-width: 720px;
    }
    .group-label {
      margin-top: 24px;
    }
    .list-row.plain::after {
      left: 16px;
    }
    .appearance {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .option {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px;
      border: 0;
      border-radius: 12px;
      background: transparent;
      color: var(--text);
      font: 500 13.5px var(--font);
      cursor: pointer;
      &:hover .preview {
        transform: translateY(-2px);
      }
      &.on .preview {
        box-shadow: 0 0 0 3px var(--text);
      }
      .faint {
        font-weight: 400;
        text-align: center;
      }
    }
    .name {
      margin-top: 6px;
    }
    .preview {
      width: 100%;
      max-width: 150px;
      aspect-ratio: 16 / 10;
      border-radius: 10px;
      padding: 12px;
      display: grid;
      box-shadow: 0 0 0 1px var(--border-strong);
      transition: transform 0.25s var(--ease), box-shadow 0.2s;
      &.light {
        background: #f5f5f7;
        --w: #ffffff;
        --l: #d2d2d7;
      }
      &.dark {
        background: #000;
        --w: #1c1c1e;
        --l: #48484a;
      }
      &.auto {
        background: linear-gradient(90deg, #f5f5f7 50%, #000 50%);
        --w: #8e8e93;
        --l: #d2d2d7;
      }
    }
    .win {
      border-radius: 6px;
      background: var(--w);
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .bar {
      width: 40%;
      height: 6px;
      border-radius: 3px;
      background: var(--l);
    }
    .line {
      height: 4px;
      border-radius: 2px;
      background: var(--l);
      opacity: 0.7;
      &.short {
        width: 60%;
      }
    }
    .keys {
      display: inline-flex;
      gap: 4px;
    }
    @media (max-width: 560px) {
      .appearance {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Settings {
  protected readonly theme = inject(ThemeService);
  protected readonly exportUrl = inject(Api).exportUrl();
  protected readonly appearances = APPEARANCES;
  protected readonly shortcuts = SHORTCUTS;
}
