import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';

import { Api, errorMessage } from '../../core/api/api';
import { InterviewQuestion } from '../../core/api/models';
import { MarkdownPipe } from '../tutor/markdown';

type Filter = 'all' | 'todo' | 'done';

/** Interview questions for your stack. Answer out loud, then compare with the key points. */
@Component({
  selector: 'app-interview-prep',
  imports: [MarkdownPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <div class="eyebrow">Career</div>
          <h1>Interview prep</h1>
          <p>Answer out loud first, then compare with the key points. Mark it practised when you'd be happy saying it in an interview.</p>
        </div>
        <button class="btn primary" (click)="random()" [disabled]="!visible().length">
          <i class="ti ti-arrows-shuffle" aria-hidden="true"></i>Random question
        </button>
      </header>

      <div class="card progress">
        <div class="line">
          <span><strong>{{ practised() }}</strong> of {{ items().length }} practised</span>
          <span class="faint">{{ percent() }}%</span>
        </div>
        <span class="bar"><span [style.width.%]="percent()"></span></span>
      </div>

      <div class="toolbar">
        <div class="segmented" role="tablist" aria-label="Category">
          <button role="tab" [class.on]="category() === 'all'" [attr.aria-selected]="category() === 'all'" (click)="category.set('all')">All</button>
          @for (c of bank.value()?.categories ?? []; track c.id) {
            <button role="tab" [class.on]="category() === c.id" [attr.aria-selected]="category() === c.id" (click)="category.set(c.id)">
              {{ c.label }} <span class="count">{{ doneIn(c.id) }}/{{ countIn(c.id) }}</span>
            </button>
          }
        </div>
        <div class="filters">
          <select class="input" aria-label="Show" [value]="filter()" (change)="filter.set($any($event.target).value)">
            <option value="all">All questions</option>
            <option value="todo">Still to practise</option>
            <option value="done">Practised</option>
          </select>
          <input class="input search" type="search" placeholder="Search" aria-label="Search questions" [value]="query()" (input)="query.set($any($event.target).value)" />
        </div>
      </div>

      @if (bank.isLoading() && !bank.hasValue()) {
        <div class="skeleton" style="height: 300px"></div>
      }

      <div class="questions">
        @for (q of visible(); track q.id) {
          <article class="card q" [class.open]="openId() === q.id" [id]="'q-' + q.id">
            <div class="q-head">
              <button
                class="check"
                [class.done]="q.practised"
                [attr.aria-pressed]="q.practised"
                [attr.aria-label]="(q.practised ? 'Mark as not practised: ' : 'Mark as practised: ') + q.question"
                (click)="togglePractised(q)"
              >
                <i class="ti" [class.ti-check]="q.practised" aria-hidden="true"></i>
              </button>
              <button class="title" [attr.aria-expanded]="openId() === q.id" (click)="toggle(q.id)">
                <span>{{ q.question }}</span>
                <span class="tags">
                  @if (category() === 'all') { <span class="pill">{{ label(q.category) }}</span> }
                  <span class="pill" [class.outline]="q.difficulty !== 'easy'" [class.strong]="q.difficulty === 'hard'">{{ q.difficulty }}</span>
                </span>
              </button>
            </div>

            @if (openId() === q.id) {
              <div class="body">
                <label class="answer">
                  <span class="label">Your answer</span>
                  <textarea
                    class="input"
                    rows="4"
                    placeholder="Write the answer you'd give, in your own words. It saves when you click away."
                    [value]="q.my_answer"
                    (blur)="saveAnswer(q, $any($event.target).value)"
                  ></textarea>
                </label>
                @if (revealed().has(q.id)) {
                  <div class="key">
                    <span class="label">Key points</span>
                    <div class="md" [innerHTML]="q.answer | markdown"></div>
                  </div>
                } @else {
                  <button class="btn" (click)="reveal(q.id)"><i class="ti ti-eye" aria-hidden="true"></i>Show key points</button>
                }
                <p class="faint status" aria-live="polite">{{ status() }}</p>
              </div>
            }
          </article>
        } @empty {
          @if (bank.hasValue()) {
            <p class="muted">No questions match. Try another filter.</p>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .progress {
      margin-bottom: 16px;
      .line {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
      }
    }
    .bar {
      display: block;
      height: 6px;
      border-radius: 3px;
      background: var(--raised);
      overflow: hidden;
      span {
        display: block;
        height: 100%;
        background: var(--text);
        transition: width 0.6s var(--ease);
      }
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 14px;
    }
    .count {
      opacity: 0.6;
      margin-left: 2px;
      font-variant-numeric: tabular-nums;
    }
    .filters {
      display: flex;
      gap: 8px;
    }
    .search {
      width: 180px;
    }
    .questions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .q {
      padding: 0;
      scroll-margin-top: 80px;
      transition: box-shadow 0.2s;
      &.open {
        box-shadow: 0 0 0 1px var(--border-strong);
      }
    }
    .q-head {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 6px 4px 14px;
    }
    .check {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1.5px var(--border-strong);
      background: transparent;
      color: var(--on-accent);
      cursor: pointer;
      &.done {
        background: var(--accent);
        box-shadow: none;
      }
    }
    .title {
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px 8px;
      border: 0;
      background: transparent;
      color: var(--text);
      font: 500 14.5px var(--font);
      text-align: left;
      cursor: pointer;
    }
    .tags {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
      .pill {
        text-transform: capitalize;
      }
    }
    .body {
      padding: 0 16px 16px 50px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      animation: open 0.25s var(--ease);
    }
    .answer {
      display: flex;
      flex-direction: column;
      gap: 4px;
      textarea {
        height: auto;
        resize: vertical;
        padding: 8px 10px;
        line-height: 1.55;
        font-family: var(--font);
      }
    }
    .key .md {
      margin-top: 4px;
      line-height: 1.65;
      animation: open 0.25s var(--ease);
    }
    .btn {
      align-self: flex-start;
    }
    @keyframes open {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
    @media (max-width: 640px) {
      .body {
        padding-left: 16px;
      }
      .tags {
        display: none;
      }
    }
  `,
})
export class InterviewPrep {
  private readonly api = inject(Api);
  protected readonly bank = this.api.questionBank();
  protected readonly items = linkedSignal(() => this.bank.value()?.items ?? []);

  protected readonly category = signal('all');
  protected readonly filter = signal<Filter>('all');
  protected readonly query = signal('');
  protected readonly openId = signal<string | null>(null);
  protected readonly revealed = signal(new Set<string>());
  protected readonly status = signal('');

  protected readonly practised = computed(() => this.items().filter((q) => q.practised).length);
  protected readonly percent = computed(() =>
    this.items().length ? Math.round((this.practised() / this.items().length) * 100) : 0,
  );

  protected readonly visible = computed(() => {
    const cat = this.category();
    const f = this.filter();
    const q = this.query().trim().toLowerCase();
    return this.items().filter(
      (item) =>
        (cat === 'all' || item.category === cat) &&
        (f === 'all' || (f === 'done') === item.practised) &&
        (!q || item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q)),
    );
  });

  protected label(id: string): string {
    return this.bank.value()?.categories.find((c) => c.id === id)?.label ?? id;
  }

  protected countIn(id: string): number {
    return this.items().filter((q) => q.category === id).length;
  }

  protected doneIn(id: string): number {
    return this.items().filter((q) => q.category === id && q.practised).length;
  }

  protected toggle(id: string): void {
    this.status.set('');
    this.openId.update((open) => (open === id ? null : id));
  }

  protected reveal(id: string): void {
    this.revealed.update((s) => new Set(s).add(id));
  }

  /** Open a random question you haven't practised yet (from what's on screen). */
  protected random(): void {
    const pool = this.visible().filter((q) => !q.practised);
    const list = pool.length ? pool : this.visible();
    const pick = list[Math.floor(Math.random() * list.length)];
    if (!pick) return;
    this.openId.set(pick.id);
    setTimeout(() => document.getElementById(`q-${pick.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  protected async togglePractised(q: InterviewQuestion): Promise<void> {
    this.replace({ ...q, practised: !q.practised });
    try {
      this.replace(await this.api.saveQuestion(q.id, { practised: !q.practised }));
    } catch (err) {
      this.replace(q);
      this.status.set(errorMessage(err, "Couldn't save. Try again."));
    }
  }

  protected async saveAnswer(q: InterviewQuestion, text: string): Promise<void> {
    if (text === q.my_answer) return;
    this.status.set('Saving…');
    try {
      this.replace(await this.api.saveQuestion(q.id, { my_answer: text }));
      this.status.set('Answer saved');
    } catch (err) {
      this.status.set(errorMessage(err, "Couldn't save your answer"));
    }
  }

  private replace(q: InterviewQuestion): void {
    this.items.update((all) => all.map((x) => (x.id === q.id ? q : x)));
  }
}
