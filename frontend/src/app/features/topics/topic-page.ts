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
import { StatusDot } from '../../shared/status-dot';

const STATUSES: { value: Status; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'learning', label: 'Learning' },
  { value: 'confident', label: 'I know this' },
];

@Component({
  selector: 'app-topic-page',
  imports: [RouterLink, StatusDot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page narrow">
      <a routerLink="/map" class="back"><i class="ti ti-chevron-left"></i>Knowledge map</a>

      @if (topic.error()) {
        <div class="card"><h2>Topic not found</h2><p class="muted">It may have been renamed.</p></div>
      } @else if (topic.value(); as t) {
        <header class="head">
          <div class="eyebrow">{{ trackLabel[t.track] }} · {{ difficultyLabel(t.difficulty) }}</div>
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

        <span class="group-label">Your progress</span>
        <div class="card progress">
          <div class="segmented" role="radiogroup" aria-label="Your status">
            @for (s of statuses; track s.value) {
              <button
                role="radio"
                [attr.aria-checked]="status() === s.value"
                [class.on]="status() === s.value"
                [disabled]="saving()"
                (click)="setStatus(s.value)"
              >
                <app-status-dot [status]="s.value" />{{ s.label }}
              </button>
            }
          </div>
          <div class="mastery">
            <span class="label">Mastery</span>
            <span class="meter"><span [style.width.%]="masteryPercent()"></span></span>
            <span class="mono">{{ masteryPercent() }}%</span>
          </div>
          @if (saveError()) {
            <p class="error"><i class="ti ti-alert-circle"></i> {{ saveError() }}</p>
          }
        </div>

        @if (t.resources.length) {
          <span class="group-label">Official docs</span>
          <div class="list">
            @for (r of t.resources; track r.url) {
              <a class="list-row" [href]="r.url" target="_blank" rel="noopener noreferrer">
                <span class="tile"><i class="ti ti-book" aria-hidden="true"></i></span>
                <span class="row-main">
                  <span>{{ r.label }}</span>
                  <span class="faint">{{ host(r.url) }}</span>
                </span>
                <i class="ti ti-arrow-up-right chev" aria-hidden="true"></i>
                <span class="sr-only">(opens in a new tab)</span>
              </a>
            }
          </div>
        }

        <div class="relations">
          <div>
            <span class="group-label">Learn first</span>
            <div class="list">
              @for (r of t.requires; track r.id) {
                <a class="list-row compact" [routerLink]="['/topics', r.id]">
                  <app-status-dot [status]="statusOf(r.id)" />
                  <span class="row-main"><span>{{ r.title }}</span></span>
                  <i class="ti ti-chevron-right chev" aria-hidden="true"></i>
                </a>
              } @empty {
                <div class="list-row compact"><span class="muted">Nothing. This is a starting point.</span></div>
              }
            </div>
          </div>
          <div>
            <span class="group-label">Unlocks</span>
            <div class="list">
              @for (r of t.unlocks; track r.id) {
                <a class="list-row compact" [routerLink]="['/topics', r.id]">
                  <app-status-dot [status]="statusOf(r.id)" />
                  <span class="row-main"><span>{{ r.title }}</span></span>
                  <i class="ti ti-chevron-right chev" aria-hidden="true"></i>
                </a>
              } @empty {
                <div class="list-row compact"><span class="muted">Nothing yet. More topics are coming.</span></div>
              }
            </div>
          </div>
        </div>
      } @else {
        <div class="skeleton" style="height: 260px"></div>
      }
    </div>
  `,
  styles: `
    .narrow {
      max-width: 800px;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      margin: 0 0 18px -4px;
      font-size: 14px;
      color: var(--text-2);
      &:hover {
        color: var(--text);
      }
    }
    .head {
      margin-bottom: 28px;
    }
    .eyebrow {
      font-size: 13px;
      color: var(--text-2);
      margin-bottom: 4px;
    }
    h1 {
      font-size: 36px;
    }
    .summary {
      font-size: 17px;
      line-height: 1.45;
      color: var(--text-2);
      margin: 10px 0 20px;
      max-width: 58ch;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .group-label {
      margin-top: 24px;
    }
    .progress {
      display: flex;
      flex-direction: column;
      gap: 14px;
      app-status-dot {
        margin-right: 2px;
      }
    }
    .mastery {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 12px;
    }
    .meter {
      height: 4px;
      border-radius: 2px;
      background: var(--raised);
      overflow: hidden;
      span {
        display: block;
        height: 100%;
        background: var(--text);
        transition: width 0.6s var(--ease);
      }
    }
    .error {
      font-size: 13px;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .relations {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .list-row.compact {
      min-height: 44px;
      &::after {
        left: 40px;
      }
    }
    @media (max-width: 640px) {
      .relations {
        grid-template-columns: 1fr;
      }
      h1 {
        font-size: 30px;
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

  protected readonly status = computed(() => this.statusOf(this.id()));
  protected readonly masteryPercent = computed(() =>
    Math.round((this.store.progressOf(this.id())?.mastery ?? 0) * 100),
  );

  constructor() {
    // Keep the browser tab title in sync with the topic.
    effect(() => {
      const title = this.topic.value()?.title;
      if (title) this.titleService.setTitle(`${title} · Cortex`);
    });
  }

  protected statusOf(topicId: string): Status {
    return this.store.progressOf(topicId)?.status ?? 'not_started';
  }

  protected difficultyLabel(d: number): string {
    return ['', 'Beginner', 'Easy', 'Intermediate', 'Advanced', 'Expert'][d] ?? '';
  }

  protected host(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
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
