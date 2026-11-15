import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { Router } from '@angular/router';

import { Api, errorMessage } from '../../core/api/api';
import { Auth } from '../../core/auth/auth';
import { saveBlob } from '../../core/api/save-file';
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
        <button type="button" class="list-row plain" [disabled]="downloading()" (click)="download()">
          <span class="row-main">
            <span>Download my data</span>
            <span class="faint">Progress, practice, flashcards, notes, job search and tutor chats as JSON</span>
          </span>
          <i class="ti ti-download chev" aria-hidden="true"></i>
        </button>
      </div>
      @if (downloadError()) {
        <p class="faint" role="alert">{{ downloadError() }}</p>
      }

      @if (auth.mode() === 'jwt') {
        <span class="group-label">Delete account</span>
        <div class="card danger">
          <p>
            This permanently deletes your account and everything in it. Type
            <strong>delete</strong> to confirm.
          </p>
          <div class="row">
            <input
              class="confirm"
              type="text"
              autocomplete="off"
              aria-label="Type delete to confirm"
              [value]="confirm()"
              (input)="confirm.set($any($event.target).value)"
            />
            <button
              type="button"
              class="btn primary"
              [disabled]="confirm() !== 'delete' || deleting()"
              (click)="deleteAccount()"
            >
              Delete my account
            </button>
          </div>
          @if (deleteError()) {
            <p class="faint" role="alert">{{ deleteError() }}</p>
          }
        </div>
      }

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
    button.list-row {
      width: 100%;
      text-align: left;
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
    .danger {
      border: 1px solid var(--border-strong);
      p {
        margin: 0 0 12px;
      }
    }
    .row {
      display: flex;
      gap: 8px;
    }
    .confirm {
      flex: 1;
      min-width: 0;
      height: 32px;
      padding: 0 12px;
      border-radius: 8px;
      border: 1px solid var(--border-strong);
      background: var(--bg);
      color: var(--text);
      font: 13.5px var(--font);
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
  private readonly api = inject(Api);
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal('');
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly confirm = signal('');
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal('');
  protected readonly appearances = APPEARANCES;
  protected readonly shortcuts = SHORTCUTS;

  protected async download(): Promise<void> {
    this.downloading.set(true);
    this.downloadError.set('');
    try {
      saveBlob(await this.api.downloadExport(), 'cortex-data.json');
    } catch (err) {
      this.downloadError.set(errorMessage(err, "Couldn't download your data. Try again."));
    } finally {
      this.downloading.set(false);
    }
  }

  protected async deleteAccount(): Promise<void> {
    this.deleting.set(true);
    this.deleteError.set('');
    try {
      await this.auth.deleteAccount();
      await this.router.navigateByUrl('/signin');
    } catch (err) {
      this.deleteError.set(errorMessage(err, "Couldn't delete your account. Try again."));
    } finally {
      this.deleting.set(false);
    }
  }
}
