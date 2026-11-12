import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Api, errorMessage } from '../../core/api/api';
import { Flashcard, Grade } from '../../core/api/models';
import { LearningStore } from '../../core/learning-store';
import { formatInterval } from '../../shared/format';
import { CardManager } from './card-manager';

const GRADES: { grade: Grade; label: string; key: string }[] = [
  { grade: 'again', label: 'Again', key: '1' },
  { grade: 'hard', label: 'Hard', key: '2' },
  { grade: 'good', label: 'Good', key: '3' },
  { grade: 'easy', label: 'Easy', key: '4' },
];

/** A card's answer, split into bullet points, code, or plain paragraphs. */
export function answerParts(card: Pick<Flashcard, 'kind' | 'back'>):
  | { type: 'code'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'text'; paragraphs: string[] } {
  if (card.kind === 'template') return { type: 'code', text: card.back };
  const lines = card.back.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length && lines.every((l) => l.startsWith('- '))) {
    return { type: 'bullets', items: lines.map((l) => l.slice(2)) };
  }
  return { type: 'text', paragraphs: card.back.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) };
}

/** Spaced-repetition review: flip a card, grade how well you remembered, repeat. */
@Component({
  selector: 'app-review',
  imports: [RouterLink, FormsModule, CardManager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <div class="eyebrow">Learn</div>
          <h1>Review</h1>
          <p>Cards come back just before you'd forget them. A few minutes a day is enough.</p>
        </div>
      </header>

      <div class="layout">
        <section aria-label="Review session">
          @if (due.isLoading() && !due.hasValue()) {
            <div class="skeleton" style="height: 320px"></div>
          } @else if (current(); as card) {
            <div class="progress faint">
              <span>{{ reviewed() }} reviewed · {{ queue().length - index() }} left</span>
              <span class="bar"><span [style.width.%]="percent()"></span></span>
            </div>

            <div class="card flash" [class.flipped]="flipped()">
              <div class="meta">
                <span class="pill">{{ topicTitle(card.topic_id) }}</span>
                @if (card.lapses) {
                  <span class="faint">forgotten {{ card.lapses }}×</span>
                }
              </div>
              <h2 class="front">{{ card.front }}</h2>

              @if (flipped()) {
                @let a = answer();
                <div class="back">
                  @switch (a.type) {
                    @case ('code') {
                      <pre>{{ a.text }}</pre>
                    }
                    @case ('bullets') {
                      <ul>
                        @for (item of a.items; track $index) {
                          <li>{{ item }}</li>
                        }
                      </ul>
                    }
                    @default {
                      @for (p of a.paragraphs; track $index) {
                        <p>{{ p }}</p>
                      }
                    }
                  }
                </div>
                <div class="grades" role="group" aria-label="How well did you remember?">
                  @for (g of grades; track g.grade) {
                    <button class="btn grade" [class.primary]="g.grade === 'good'" (click)="grade(g.grade)" [disabled]="saving()">
                      <span>{{ g.label }}</span>
                      <span class="when">{{ interval(card.next[g.grade]) }}</span>
                    </button>
                  }
                </div>
                <p class="faint keys">Keys <kbd>1</kbd>–<kbd>4</kbd></p>
              } @else {
                <p class="faint hint">Say the answer out loud or in your head first.</p>
                <button class="btn primary show" (click)="flipped.set(true)">
                  Show answer <kbd>Space</kbd>
                </button>
              }
            </div>
            @if (error()) {
              <p class="error"><i class="ti ti-alert-circle" aria-hidden="true"></i> {{ error() }}</p>
            }
          } @else {
            <div class="card done">
              <span class="big"><i class="ti ti-circle-check" aria-hidden="true"></i></span>
              <h2>{{ reviewed() ? 'All caught up' : 'Nothing to review right now' }}</h2>
              <p class="muted">
                @if (reviewed()) {
                  You reviewed {{ reviewed() }} {{ reviewed() === 1 ? 'card' : 'cards' }}. Come back tomorrow.
                } @else {
                  Open a topic and choose "Add to review", or write your own card.
                }
              </p>
              <a class="btn" routerLink="/patterns">Browse patterns</a>
            </div>
          }
        </section>

        <aside>
          <span class="group-label">Write a card</span>
          <form class="card add" (submit)="addCard($event)">
            <label>
              <span class="label">Topic (optional)</span>
              <select class="input" name="topic" [(ngModel)]="newTopic">
                <option value="">None</option>
                @for (t of store.topics(); track t.id) {
                  <option [value]="t.id">{{ t.title }}</option>
                }
              </select>
            </label>
            <label>
              <span class="label">Question</span>
              <textarea class="input" name="front" rows="2" [(ngModel)]="newFront" placeholder="What does the GIL protect?"></textarea>
            </label>
            <label>
              <span class="label">Answer</span>
              <textarea class="input" name="back" rows="3" [(ngModel)]="newBack" placeholder="CPython's object memory, by letting one thread run Python bytecode at a time."></textarea>
            </label>
            <button class="btn primary" type="submit" [disabled]="!newFront().trim() || !newBack().trim() || adding()">
              <i class="ti ti-plus" aria-hidden="true"></i>Add card
            </button>
            @if (added()) {
              <span class="faint">Added. It's due now.</span>
            }
          </form>

          <span class="group-label">Your cards</span>
          <div class="list">
            <div class="list-row plain"><span class="row-main"><span>Total</span></span><span class="muted">{{ all.value()?.items?.length ?? 0 }}</span></div>
            <div class="list-row plain"><span class="row-main"><span>Due now</span></span><span class="muted">{{ queue().length - index() }}</span></div>
            <div class="list-row plain"><span class="row-main"><span>Learned (3+ reviews)</span></span><span class="muted">{{ mature() }}</span></div>
          </div>

          <details class="manage">
            <summary class="group-label">Manage cards</summary>
            <app-card-manager [cards]="all.value()?.items ?? []" (edited)="onEdited($event)" (deleted)="onDeleted($event)" />
          </details>

          @if (notes.value()?.items?.length) {
            <span class="group-label">Your notes</span>
            <div class="list">
              @for (n of notes.value()!.items; track n.topic_id) {
                <a class="list-row" [routerLink]="['/topics', n.topic_id]" fragment="notes">
                  <span class="tile"><i class="ti ti-notes" aria-hidden="true"></i></span>
                  <span class="row-main">
                    <span>{{ topicTitle(n.topic_id) }}</span>
                    <span class="faint">{{ n.preview }}</span>
                  </span>
                  <i class="ti ti-chevron-right chev" aria-hidden="true"></i>
                </a>
              }
            </div>
          }
        </aside>
      </div>
    </div>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
      gap: 24px;
      align-items: start;
    }
    .progress {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      .bar {
        flex: 1;
        height: 4px;
        border-radius: 2px;
        background: var(--raised);
        overflow: hidden;
        span {
          display: block;
          height: 100%;
          background: var(--text);
          transition: width 0.4s var(--ease);
        }
      }
    }
    .flash {
      padding: 28px;
      min-height: 300px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      animation: enter 0.35s var(--ease);
    }
    .meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .front {
      font-size: 22px;
      line-height: 1.35;
    }
    .back {
      border-top: 0.5px solid var(--separator);
      padding-top: 16px;
      animation: enter 0.3s var(--ease);
      ul {
        margin: 0;
        padding-left: 20px;
        line-height: 1.7;
      }
      p {
        line-height: 1.7;
        margin-bottom: 8px;
      }
      pre {
        margin: 0;
        padding: 12px;
        border-radius: var(--radius);
        background: var(--raised);
        white-space: pre-wrap;
        line-height: 1.6;
      }
    }
    .hint {
      flex: 1;
    }
    .show {
      align-self: center;
      height: 40px;
      padding: 0 22px;
      kbd {
        margin-left: 6px;
        opacity: 0.7;
      }
    }
    .grades {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-top: auto;
    }
    .grade {
      height: auto;
      padding: 10px 6px;
      flex-direction: column;
      gap: 2px;
      .when {
        font-size: 12px;
        opacity: 0.7;
      }
    }
    .keys {
      text-align: center;
    }
    .done {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 10px;
      padding: 48px 24px;
      .big {
        font-size: 44px;
      }
    }
    .add {
      display: flex;
      flex-direction: column;
      gap: 12px;
      label {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      textarea {
        resize: vertical;
        min-height: 0;
        height: auto;
        padding: 8px 10px;
        line-height: 1.5;
      }
      button {
        align-self: flex-start;
      }
    }
    .manage summary {
      cursor: pointer;
      margin-top: 20px;
    }
    aside .group-label {
      margin-top: 20px;
      &:first-child {
        margin-top: 0;
      }
    }
    .error {
      margin-top: 10px;
      color: var(--text-2);
    }
    @keyframes enter {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 520px) {
      .grades {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class Review {
  private readonly api = inject(Api);
  protected readonly store = inject(LearningStore);

  protected readonly due = this.api.dueCards();
  protected readonly all = this.api.allCards();
  protected readonly notes = this.api.notes();
  protected readonly grades = GRADES;

  /** The session's cards. "Again" puts a card back at the end. */
  protected readonly queue = signal<Flashcard[]>([]);
  protected readonly index = signal(0);
  protected readonly flipped = signal(false);
  protected readonly reviewed = signal(0);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected readonly newTopic = signal('');
  protected readonly newFront = signal('');
  protected readonly newBack = signal('');
  protected readonly adding = signal(false);
  protected readonly added = signal(false);

  protected readonly current = computed(() => this.queue()[this.index()] ?? null);
  protected readonly answer = computed(() => answerParts(this.current()!));
  protected readonly percent = computed(() => {
    const total = this.queue().length;
    return total ? (this.index() / total) * 100 : 0;
  });
  protected readonly mature = computed(
    () => (this.all.value()?.items ?? []).filter((c) => c.reps >= 3).length,
  );
  protected readonly interval = formatInterval;

  constructor() {
    // Start a session whenever the due list (re)loads and we're not mid-session.
    effect(() => {
      const items = this.due.value()?.items;
      if (!items) return;
      untracked(() => {
        if (this.current() === null) {
          this.queue.set(items);
          this.index.set(0);
          this.flipped.set(false);
        }
      });
    });
  }

  protected topicTitle(id: string | null): string {
    if (!id) return 'Your card';
    return this.store.topicById().get(id)?.title ?? id;
  }

  protected async grade(g: Grade): Promise<void> {
    const card = this.current();
    if (!card || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const updated = await this.api.reviewCard(card.id, g);
      if (g === 'again') this.queue.update((q) => [...q, updated]);
      this.reviewed.update((n) => n + 1);
      this.index.update((i) => i + 1);
      this.flipped.set(false);
      if (this.current() === null) this.all.reload();
    } catch (err) {
      this.error.set(errorMessage(err, "Couldn't save that review. Try again."));
    } finally {
      this.saving.set(false);
    }
  }

  protected async addCard(event: Event): Promise<void> {
    event.preventDefault();
    const front = this.newFront().trim();
    const back = this.newBack().trim();
    if (!front || !back) return;
    this.adding.set(true);
    try {
      const card = await this.api.addCard({ topic_id: this.newTopic() || null, front, back });
      this.newFront.set('');
      this.newBack.set('');
      this.added.set(true);
      setTimeout(() => this.added.set(false), 2500);
      this.queue.update((q) => [...q, card]);
      this.all.reload();
    } catch (err) {
      this.error.set(errorMessage(err, "Couldn't add the card"));
    } finally {
      this.adding.set(false);
    }
  }

  protected onEdited(card: Flashcard): void {
    this.queue.update((q) => q.map((c) => (c.id === card.id ? card : c)));
  }

  /** Drop a deleted card from the session without skipping the card you're on. */
  protected onDeleted(id: number): void {
    const q = this.queue();
    const before = q.slice(0, this.index()).filter((c) => c.id === id).length;
    this.queue.set(q.filter((c) => c.id !== id));
    this.index.update((i) => i - before);
    this.all.reload();
  }

  protected onKey(e: KeyboardEvent): void {
    const target = e.target as Element | null;
    if (target?.closest?.('input, textarea, select, [contenteditable]')) return;
    if (e.metaKey || e.ctrlKey || e.altKey || !this.current()) return;
    if (!this.flipped() && (e.key === ' ' || e.key === 'Enter')) {
      if (target?.closest?.('button, a')) return;
      e.preventDefault();
      this.flipped.set(true);
      return;
    }
    const g = GRADES.find((x) => x.key === e.key);
    if (this.flipped() && g) {
      e.preventDefault();
      void this.grade(g.grade);
    }
  }
}
