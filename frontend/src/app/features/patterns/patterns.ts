import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Topic } from '../../core/api/models';
import { LearningStore } from '../../core/learning-store';
import { StatusDot } from '../../shared/status-dot';

/** Patterns still being built, shown so you can see what's coming. Empty when all are done. */
const COMING: { group: string; names: string[] }[] = [];

@Component({
  selector: 'app-patterns',
  imports: [RouterLink, StatusDot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <div class="eyebrow">DSA</div>
          <h1>Patterns</h1>
          <p>The handful of ideas behind most coding interview questions. Watch each one work, then practise it on LeetCode.</p>
        </div>
      </header>

      <div class="stats">
        <div class="card stat">
          <span class="label">Patterns</span>
          <span class="value">{{ patterns().length }}</span>
        </div>
        <div class="card stat">
          <span class="label">Problems solved</span>
          <span class="value">{{ solvedTotal() }}<small> of {{ problemTotal() }}</small></span>
        </div>
        <div class="card stat">
          <span class="label">Patterns started</span>
          <span class="value">{{ started() }}<small> of {{ patterns().length }}</small></span>
        </div>
      </div>

      @if (store.loading() && !patterns().length) {
        <div class="grid">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="skeleton" style="height: 150px"></div>
          }
        </div>
      }

      @for (g of groups(); track g.name) {
        <span class="group-label">{{ g.name }}</span>
        <div class="grid">
          @for (t of g.topics; track t.id; let i = $index) {
            <a class="card pattern" [routerLink]="['/topics', t.id]" [style.--i]="i">
              <div class="top">
                <app-status-dot [status]="statusOf(t)" />
                <span class="pill mono">{{ t.pattern!.complexity }}</span>
              </div>
              <h2>{{ t.title }}</h2>
              <p class="faint walk"><i class="ti ti-player-play" aria-hidden="true"></i>{{ t.pattern!.walkthrough }}</p>
              <div class="practice">
                <span class="meter"><span [style.width.%]="percent(t)"></span></span>
                <span class="faint">{{ store.solvedCount(t) }}/{{ t.pattern!.problems.length }} solved</span>
              </div>
            </a>
          }
        </div>
      }

      @if (patterns().length && coming.length) {
        <span class="group-label">Coming next</span>
        <div class="coming">
          @for (c of coming; track c.group) {
            <div class="card soon">
              <span class="label">{{ c.group }}</span>
              <div class="names">
                @for (n of c.names; track n) {
                  <span class="pill">{{ n }}</span>
                }
              </div>
            </div>
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
      margin-bottom: 8px;
    }
    .group-label {
      margin-top: 28px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .pattern {
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: var(--text);
      transition:
        transform 0.3s var(--ease),
        box-shadow 0.3s var(--ease);
      animation: rise 0.45s var(--ease) both;
      animation-delay: calc(var(--i, 0) * 40ms);
      &:hover {
        transform: translateY(-3px);
        box-shadow: var(--shadow);
        .walk i {
          transform: scale(1.2);
        }
      }
      h2 {
        font-size: 18px;
      }
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .walk {
      display: flex;
      gap: 6px;
      align-items: flex-start;
      flex: 1;
      i {
        margin-top: 2px;
        transition: transform 0.2s var(--ease);
      }
    }
    .practice {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 4px;
    }
    .meter {
      flex: 1;
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
    .coming {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .soon {
      opacity: 0.7;
      .names {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
    }
    @media (max-width: 560px) {
      .stats {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Patterns {
  protected readonly store = inject(LearningStore);
  protected readonly coming = COMING;

  protected readonly patterns = this.store.patterns;

  protected readonly groups = computed(() => {
    const map = new Map<string, Topic[]>();
    for (const t of this.patterns()) {
      const g = t.pattern!.group;
      map.set(g, [...(map.get(g) ?? []), t]);
    }
    return [...map.entries()].map(([name, topics]) => ({ name, topics }));
  });

  protected readonly problemTotal = computed(() =>
    this.patterns().reduce((n, t) => n + t.pattern!.problems.length, 0),
  );
  protected readonly solvedTotal = computed(() =>
    this.patterns().reduce((n, t) => n + this.store.solvedCount(t), 0),
  );
  protected readonly started = computed(
    () => this.patterns().filter((t) => this.statusOf(t) !== 'not_started').length,
  );

  protected statusOf(t: Topic) {
    return this.store.progressOf(t.id)?.status ?? 'not_started';
  }

  protected percent(t: Topic): number {
    const total = t.pattern?.problems.length ?? 0;
    return total ? (this.store.solvedCount(t) / total) * 100 : 0;
  }
}
