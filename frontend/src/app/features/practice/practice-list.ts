import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api } from '../../core/api/api';
import { CodingProblemSummary } from '../../core/api/models';
import { LearningStore } from '../../core/learning-store';
import { PythonRunner } from '../../core/practice/python-runner';

interface PatternGroup {
  topicId: string;
  title: string;
  group: string;
  isPattern: boolean;
  problems: CodingProblemSummary[];
}

/** Every Cortex coding problem, grouped by the pattern it practises. */
@Component({
  selector: 'app-practice-list',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <div class="eyebrow">DSA</div>
          <h1>Practice</h1>
          <p>Write Python or SQL, run it against test cases, and see what passes. Everything runs in your browser.</p>
        </div>
      </header>

      <div class="stats">
        <div class="card stat">
          <span class="label">Solved</span>
          <span class="value">{{ solved() }}<small> of {{ problems().length }}</small></span>
        </div>
        <div class="card stat">
          <span class="label">Attempted</span>
          <span class="value">{{ attempted() }}</span>
        </div>
        <div class="card stat">
          <span class="label">Patterns covered</span>
          <span class="value">{{ groups().length }}</span>
        </div>
      </div>

      @if (res.isLoading() && !problems().length) {
        <div class="skeleton" style="height: 260px; margin-top: 28px"></div>
      } @else if (res.error()) {
        <p class="muted error">Couldn't load the problems. Check that the API is running.</p>
      }

      @for (g of groups(); track g.topicId; let gi = $index) {
        <div class="group-head">
          <span class="group-label">{{ g.group }} · {{ g.title }}</span>
          <a class="faint watch" [routerLink]="['/topics', g.topicId]">
            <i class="ti" [class.ti-player-play]="g.isPattern" [class.ti-book]="!g.isPattern" aria-hidden="true"></i>{{ g.isPattern ? 'Watch the pattern' : 'Read the topic' }}
          </a>
        </div>
        <div class="list" [style.--i]="gi">
          @for (p of g.problems; track p.id) {
            <a class="list-row" [routerLink]="['/practice', p.id]">
              <span class="tile" [class.done]="p.solved">
                <i class="ti" [class.ti-check]="p.solved" [class.ti-code]="!p.solved" aria-hidden="true"></i>
              </span>
              <span class="row-main">
                <span>{{ p.title }}</span>
                <span class="faint">
                  @if (p.solved) { Solved } @else if (p.attempts) { {{ p.attempts }} {{ p.attempts === 1 ? 'attempt' : 'attempts' }} } @else { Not tried yet }
                </span>
              </span>
              <span class="pill" [class.outline]="p.difficulty !== 'easy'" [class.strong]="p.difficulty === 'hard'">{{ p.difficulty }}</span>
              <i class="ti ti-chevron-right chev" aria-hidden="true"></i>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .value {
      font: 600 30px var(--font-display);
      letter-spacing: -0.03em;
      small {
        font-size: 15px;
        font-weight: 500;
        color: var(--text-2);
        letter-spacing: 0;
      }
    }
    .group-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-top: 28px;
    }
    .watch {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding-right: 16px;
      &:hover {
        color: var(--text);
      }
    }
    .list {
      animation: rise 0.4s var(--ease) both;
      animation-delay: calc(var(--i, 0) * 40ms);
    }
    .tile.done {
      background: var(--accent);
      color: var(--on-accent);
    }
    .pill {
      text-transform: capitalize;
    }
    .error {
      margin-top: 28px;
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
    @media (max-width: 640px) {
      .stats {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class PracticeList {
  private readonly api = inject(Api);
  private readonly store = inject(LearningStore);
  protected readonly res = this.api.practiceProblems();

  protected readonly problems = computed(() => this.res.value()?.items ?? []);
  protected readonly solved = computed(() => this.problems().filter((p) => p.solved).length);
  protected readonly attempted = computed(() => this.problems().filter((p) => p.attempts).length);

  protected readonly groups = computed<PatternGroup[]>(() => {
    const byTopic = new Map<string, PatternGroup>();
    for (const p of this.problems()) {
      const topic = this.store.topicById().get(p.topic_id);
      let g = byTopic.get(p.topic_id);
      if (!g) {
        g = {
          topicId: p.topic_id,
          title: topic?.title ?? p.topic_id,
          group: topic?.pattern?.group ?? (p.topic_id.startsWith('sql-') ? 'SQL' : 'Practice'),
          isPattern: !!topic?.pattern,
          problems: [],
        };
        byTopic.set(p.topic_id, g);
      }
      g.problems.push(p);
    }
    return [...byTopic.values()];
  });

  constructor() {
    // Most visitors open a problem next; start fetching Python in the background.
    inject(PythonRunner).warmUp();
  }
}
