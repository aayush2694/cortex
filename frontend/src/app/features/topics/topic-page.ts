import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { Api, errorMessage } from '../../core/api/api';
import { Status, TRACK_LABELS } from '../../core/api/models';
import { LearningStore } from '../../core/learning-store';

const STATUSES: { value: Status; label: string; icon: string }[] = [
  { value: 'not_started', label: 'Not started', icon: 'ti-circle' },
  { value: 'learning', label: 'Learning', icon: 'ti-progress' },
  { value: 'confident', label: 'I know this', icon: 'ti-circle-check' },
];

@Component({
  selector: 'app-topic-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page narrow">
      <a routerLink="/map" class="back faint"><i class="ti ti-arrow-left"></i> Knowledge map</a>

      @if (topic.error()) {
        <div class="card"><h2>Topic not found</h2><p class="muted">It may have been renamed.</p></div>
      } @else if (topic.value(); as t) {
        <header class="head">
          <div class="meta">
            <span class="pill">{{ trackLabel[t.track] }}</span>
            <span class="pill" [attr.aria-label]="'Difficulty ' + t.difficulty + ' of 5'">
              @for (d of [1, 2, 3, 4, 5]; track d) {
                <span class="dot" [class.on]="d <= t.difficulty"></span>
              }
            </span>
            @if (mastery() > 0) {
              <span class="pill accent">{{ masteryPercent() }}% mastery</span>
            }
          </div>
          <h1>{{ t.title }}</h1>
          <p class="summary">{{ t.summary }}</p>
          <div class="actions">
            @if (t.visualizer) {
              <a class="btn primary" [routerLink]="['/visualizer', t.visualizer]">
                <i class="ti ti-player-play"></i>Visualize it
              </a>
            }
            <a class="btn" routerLink="/tutor" [queryParams]="{ topic: t.id }">
              <i class="ti ti-message-circle"></i>Ask the tutor
            </a>
          </div>
        </header>

        <section class="card">
          <h2>How well do you know it?</h2>
          <div class="segmented" role="radiogroup" aria-label="Your status">
            @for (s of statuses; track s.value) {
              <button
                role="radio"
                [attr.aria-checked]="status() === s.value"
                [class.selected]="status() === s.value"
                [disabled]="saving()"
                (click)="setStatus(s.value)"
              >
                <i class="ti {{ s.icon }}" aria-hidden="true"></i>{{ s.label }}
              </button>
            }
          </div>
          @if (saveError()) {
            <p class="error">{{ saveError() }}</p>
          }
        </section>

        @if (t.resources.length) {
          <section class="card">
            <h2>Official docs</h2>
            <div class="docs">
              @for (r of t.resources; track r.url) {
                <a class="doc" [href]="r.url" target="_blank" rel="noopener noreferrer">
                  <i class="ti ti-book" aria-hidden="true"></i>
                  <span class="doc-text">
                    <span>{{ r.label }}</span>
                    <span class="faint">{{ host(r.url) }}</span>
                  </span>
                  <i class="ti ti-external-link" aria-hidden="true"></i>
                  <span class="sr-only">(opens in a new tab)</span>
                </a>
              }
            </div>
          </section>
        }

        <div class="relations">
          <section class="card">
            <h2>Learn first</h2>
            @for (r of t.requires; track r.id) {
              <a class="rel" [routerLink]="['/topics', r.id]">
                <span class="tone {{ toneOf(r.id) }}"></span>{{ r.title }}
                <i class="ti ti-chevron-right"></i>
              </a>
            } @empty {
              <p class="muted">Nothing. This is a starting point.</p>
            }
          </section>
          <section class="card">
            <h2>Unlocks</h2>
            @for (r of t.unlocks; track r.id) {
              <a class="rel" [routerLink]="['/topics', r.id]">
                <span class="tone {{ toneOf(r.id) }}"></span>{{ r.title }}
                <i class="ti ti-chevron-right"></i>
              </a>
            } @empty {
              <p class="muted">Nothing yet. More topics are coming.</p>
            }
          </section>
        </div>
      } @else {
        <div class="skeleton" style="height: 220px"></div>
      }
    </div>
  `,
  styles: `
    .narrow {
      max-width: 820px;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 20px;
      &:hover {
        color: var(--text);
      }
    }
    .head {
      margin-bottom: 24px;
    }
    .meta {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--border-strong);
      &.on {
        background: var(--text-2);
      }
    }
    h1 {
      font-size: 28px;
    }
    .summary {
      font-size: 15px;
      color: var(--text-2);
      margin: 8px 0 18px;
      max-width: 60ch;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    section {
      margin-bottom: 12px;
      h2 {
        margin-bottom: 12px;
      }
    }
    .segmented {
      display: inline-flex;
      padding: 3px;
      gap: 3px;
      border-radius: 10px;
      background: var(--bg);
      border: 1px solid var(--border);
      flex-wrap: wrap;
      button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding: 0 14px;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: var(--text-2);
        font: 500 13px var(--font);
        cursor: pointer;
        &:hover {
          color: var(--text);
        }
        &.selected {
          background: var(--raised);
          color: var(--text);
          i {
            color: var(--accent);
          }
        }
      }
    }
    .error {
      color: var(--bad);
      font-size: 13px;
      margin-top: 8px;
    }
    .docs {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 8px;
    }
    .doc {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      color: var(--text);
      transition: border-color 0.15s, background-color 0.15s;
      > i:first-child {
        font-size: 18px;
        color: var(--accent);
      }
      > i:last-of-type {
        color: var(--text-3);
      }
      &:hover {
        border-color: var(--accent);
        background: var(--hover);
      }
    }
    .doc-text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      span:first-child {
        font-weight: 500;
        font-size: 13.5px;
      }
    }
    .relations {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .rel {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      margin: 0 -10px;
      border-radius: var(--radius);
      color: var(--text);
      i {
        margin-left: auto;
        color: var(--text-3);
      }
      &:hover {
        background: var(--hover);
      }
    }
    .tone {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--border-strong);
      &.ok {
        background: var(--ok);
      }
      &.warn {
        background: var(--warn);
      }
    }
    @media (max-width: 640px) {
      .relations {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class TopicPage {
  /** Bound from the route param `:id` (withComponentInputBinding). */
  readonly id = input.required<string>();

  private readonly api = inject(Api);
  private readonly titleService = inject(Title);
  protected readonly store = inject(LearningStore);

  protected readonly topic = this.api.topic(this.id);
  protected readonly statuses = STATUSES;
  protected readonly trackLabel = TRACK_LABELS;
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');

  protected readonly status = computed(() => this.store.progressOf(this.id())?.status ?? 'not_started');
  protected readonly mastery = computed(() => this.store.progressOf(this.id())?.mastery ?? 0);
  protected readonly masteryPercent = computed(() => Math.round(this.mastery() * 100));

  constructor() {
    // Keep the browser tab title in sync with the topic.
    effect(() => {
      const title = this.topic.value()?.title;
      if (title) this.titleService.setTitle(`${title} · Cortex`);
    });
  }

  protected host(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  protected toneOf(topicId: string): string {
    const s = this.store.progressOf(topicId)?.status;
    return s === 'confident' ? 'ok' : s === 'learning' ? 'warn' : '';
  }

  protected async setStatus(status: Status): Promise<void> {
    this.saving.set(true);
    this.saveError.set('');
    try {
      await this.store.setStatus(this.id(), status);
    } catch (err) {
      this.saveError.set(errorMessage(err, "Couldn't save. Try again."));
    } finally {
      this.saving.set(false);
    }
  }
}
