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
import { Problem, Status, TRACK_LABELS, leetcodeUrl } from '../../core/api/models';
import { LearningStore } from '../../core/learning-store';
import { StatusDot } from '../../shared/status-dot';
import { TracePlayer } from '../visualizer/player/trace-player';
import { TopicNotes } from './topic-notes';

const STATUSES: { value: Status; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'learning', label: 'Learning' },
  { value: 'confident', label: 'I know this' },
];

@Component({
  selector: 'app-topic-page',
  imports: [RouterLink, StatusDot, TracePlayer, TopicNotes],
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
            @if (t.concepts.length || t.pattern) {
              <button class="btn" (click)="addToReview(t.id)" [disabled]="reviewState() === 'adding'">
                <i class="ti" [class.ti-cards]="reviewState() !== 'done'" [class.ti-check]="reviewState() === 'done'" aria-hidden="true"></i>
                {{ reviewLabel() }}
              </button>
            }
          </div>
        </header>

        @if (t.pattern; as pat) {
          <span class="group-label first">Watch it work · {{ pat.walkthrough }}</span>
          @if (algorithmFor(t.visualizer); as algo) {
            <app-trace-player [algorithm]="algo" layout="compact" (completed)="onWalkthroughDone()" />
          } @else {
            <div class="skeleton" style="height: 300px"></div>
          }

          <div class="pattern-cols">
            <div>
              <span class="group-label">When to use it</span>
              <ul class="list signals">
                @for (s of pat.signals; track s) {
                  <li class="list-row compact"><i class="ti ti-check sig" aria-hidden="true"></i><span class="row-main"><span>{{ s }}</span></span></li>
                }
              </ul>
            </div>
            <div>
              <span class="group-label row-label">
                Template
                <button class="btn ghost copy" (click)="copy(pat.template)">
                  <i class="ti" [class.ti-copy]="!copied()" [class.ti-check]="copied()"></i>{{ copied() ? 'Copied' : 'Copy' }}
                </button>
              </span>
              <pre class="card template"><code>{{ pat.template }}</code></pre>
            </div>
          </div>
        }

        @if (t.concepts.length) {
          <span class="group-label" [class.first]="!t.pattern">Key ideas</span>
          <ol class="list ideas">
            @for (c of t.concepts; track $index) {
              <li class="list-row idea">
                <span class="num" aria-hidden="true">{{ $index + 1 }}</span>
                <span class="row-main"><span>{{ c }}</span></span>
              </li>
            }
          </ol>
        }

        @if (codingProblems().length) {
          <span class="group-label">Practice in Cortex · write and run Python here</span>
          <div class="list problems">
            @for (cp of codingProblems(); track cp.id) {
              <a class="list-row problem" [class.solved]="cp.solved" [routerLink]="['/practice', cp.id]">
                <span class="tick" aria-hidden="true">
                  <i class="ti" [class.ti-circle-check]="cp.solved" [class.ti-code]="!cp.solved"></i>
                </span>
                <span class="row-main"><span>{{ cp.title }}</span></span>
                <span class="pill diff" [class.strong]="cp.difficulty === 'hard'" [class.outline]="cp.difficulty === 'medium'">{{ cp.difficulty }}</span>
                <i class="ti ti-chevron-right chev" aria-hidden="true"></i>
              </a>
            }
          </div>
        }

        @if (t.pattern; as pat) {
          <span class="group-label">
            Practice on LeetCode · {{ solvedIn(pat.problems) }} of {{ pat.problems.length }} solved
          </span>
          <div class="list problems">
            @for (p of pat.problems; track p.slug) {
              @let done = store.solved().has(p.slug);
              <div class="list-row problem" [class.solved]="done">
                <button
                  class="tick"
                  [attr.aria-pressed]="done"
                  [attr.aria-label]="(done ? 'Mark as not solved: ' : 'Mark as solved: ') + p.title"
                  (click)="toggleSolved(t.id, p.slug, !done)"
                >
                  <i class="ti" [class.ti-circle-check]="done" [class.ti-circle]="!done"></i>
                </button>
                <a class="row-main link" [href]="leetcode(p.slug)" target="_blank" rel="noopener noreferrer">
                  <span>{{ p.title }}</span>
                  <span class="sr-only">(opens LeetCode in a new tab)</span>
                </a>
                <span class="pill diff" [class.strong]="p.difficulty === 'hard'" [class.outline]="p.difficulty === 'medium'">{{ p.difficulty }}</span>
                <a class="open" [href]="leetcode(p.slug)" target="_blank" rel="noopener noreferrer" [attr.aria-label]="'Open ' + p.title + ' on LeetCode'">
                  <i class="ti ti-arrow-up-right chev" aria-hidden="true"></i>
                </a>
              </div>
            }
          </div>
          @if (solveError()) {
            <p class="error"><i class="ti ti-alert-circle"></i> {{ solveError() }}</p>
          }
        }

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

        <app-topic-notes [topicId]="t.id" />

        @if (t.resources.length) {
          <span class="group-label">Docs & references</span>
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
    .group-label.first {
      margin-top: 0;
    }
    .pattern-cols {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 16px;
    }
    .signals {
      margin: 0;
      padding: 0;
      list-style: none;
      .sig {
        color: var(--text-2);
        font-size: 16px;
      }
      .list-row::after {
        left: 44px;
      }
    }
    .row-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      .copy {
        height: 26px;
        font-size: 12.5px;
      }
    }
    .template {
      margin: 0;
      padding: 14px 16px;
      overflow-x: auto;
      line-height: 1.7;
      color: var(--text);
    }
    .problem {
      gap: 10px;
      &::after {
        left: 52px;
      }
      &.solved .link span:first-child {
        color: var(--text-2);
        text-decoration: line-through;
        text-decoration-color: var(--text-3);
      }
    }
    .tick {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--text-3);
      font-size: 20px;
      cursor: pointer;
      transition:
        color 0.2s,
        transform 0.25s var(--ease);
      &:hover {
        color: var(--text);
      }
      &:active {
        transform: scale(0.85);
      }
      &[aria-pressed='true'] {
        color: var(--text);
        animation: pop 0.35s var(--ease);
      }
    }
    @keyframes pop {
      50% {
        transform: scale(1.25);
      }
    }
    .link {
      color: var(--text);
      &:hover span:first-child {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    .diff {
      text-transform: capitalize;
    }
    .open {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      &:hover {
        background: var(--hover);
      }
    }
    .ideas {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .idea {
      align-items: flex-start;
      padding-top: 12px;
      padding-bottom: 12px;
      &:hover {
        background: transparent;
      }
      &::after {
        left: 52px;
      }
      .row-main span {
        font-size: 15px;
        line-height: 1.5;
      }
    }
    .num {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--raised);
      font: 600 12px var(--font);
      color: var(--text-2);
      margin-top: 1px;
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
      .relations,
      .pattern-cols {
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
  private readonly practiceRes = this.api.practiceProblems();
  /** Cortex coding problems for this topic (patterns only, for now). */
  protected readonly codingProblems = computed(() =>
    (this.practiceRes.value()?.items ?? []).filter((p) => p.topic_id === this.id()),
  );
  protected readonly statuses = STATUSES;
  protected readonly trackLabel = TRACK_LABELS;
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');

  protected readonly status = computed(() => this.statusOf(this.id()));
  protected readonly masteryPercent = computed(() =>
    Math.round((this.store.progressOf(this.id())?.mastery ?? 0) * 100),
  );

  constructor() {
    effect(() => {
      this.id();
      this.reviewState.set('idle');
    });

    // Keep the browser tab title in sync with the topic.
    effect(() => {
      const title = this.topic.value()?.title;
      if (title) this.titleService.setTitle(`${title} · Cortex`);
    });
  }

  protected readonly copied = signal(false);
  protected readonly solveError = signal('');

  protected readonly reviewState = signal<'idle' | 'adding' | 'done' | 'error'>('idle');
  private readonly reviewAdded = signal(0);
  protected readonly reviewLabel = computed(() => {
    switch (this.reviewState()) {
      case 'adding':
        return 'Adding…';
      case 'done':
        return this.reviewAdded()
          ? `Added ${this.reviewAdded()} ${this.reviewAdded() === 1 ? 'card' : 'cards'}`
          : 'Already in review';
      case 'error':
        return "Couldn't add. Retry";
      default:
        return 'Add to review';
    }
  });

  protected async addToReview(topicId: string): Promise<void> {
    this.reviewState.set('adding');
    try {
      this.reviewAdded.set((await this.api.addTopicCards(topicId)).added);
      this.reviewState.set('done');
    } catch {
      this.reviewState.set('error');
    }
  }

  protected algorithmFor(key: string | null) {
    return key ? this.store.algorithmByKey().get(key) : undefined;
  }

  protected leetcode(slug: string): string {
    return leetcodeUrl(slug);
  }

  protected solvedIn(problems: Problem[]): number {
    const solved = this.store.solved();
    return problems.filter((p) => solved.has(p.slug)).length;
  }

  protected async toggleSolved(topicId: string, slug: string, solved: boolean): Promise<void> {
    this.solveError.set('');
    try {
      await this.store.setSolved(topicId, slug, solved);
    } catch (err) {
      this.solveError.set(errorMessage(err, "Couldn't save that. Try again."));
    }
  }

  protected onWalkthroughDone(): void {
    this.store.markVisualizerDone(this.id()).catch(() => {});
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard blocked: nothing to do, the code is still selectable.
    }
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
