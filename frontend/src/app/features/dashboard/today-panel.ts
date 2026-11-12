import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api } from '../../core/api/api';
import { ActivityHeatmap } from '../../shared/activity-heatmap';

/** The top of the dashboard: what to do today, your plan, and your activity heatmap. */
@Component({
  selector: 'app-today-panel',
  imports: [RouterLink, ActivityHeatmap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="today-grid">
      <section class="card today" aria-label="Today">
        <div class="head">
          <h2>Today</h2>
          @if (t(); as t) {
            @if (t.days_left !== null && t.days_left >= 0) {
              <span class="pill strong">{{ t.days_left === 0 ? 'Interview day' : t.days_left + ' days to go' }}</span>
            } @else {
              <a class="faint link" routerLink="/settings" fragment="plan">Set a target date</a>
            }
          }
        </div>

        @if (today.isLoading() && !t()) {
          <div class="skeleton" style="height: 120px"></div>
        } @else if (t(); as t) {
          <div class="tasks">
            <a class="task" [routerLink]="t.problem ? ['/practice', t.problem.id] : '/practice'">
              <span class="check" [class.done]="problemsDone()">
                <i class="ti" [class.ti-check]="problemsDone()" [class.ti-code]="!problemsDone()" aria-hidden="true"></i>
              </span>
              <span class="row-main">
                @if (t.problem) {
                  <span>{{ problemsDone() ? 'Up next: ' : 'Solve ' }}{{ t.problem.title }}</span>
                  <span class="faint">{{ t.problem.topic_title }} · {{ t.problem.reason }}</span>
                } @else {
                  <span>Every coding problem solved</span>
                  <span class="faint">Revisit one you found hard</span>
                }
              </span>
              <span class="count faint">{{ t.solved_today }}/{{ t.plan.daily_problems }}</span>
            </a>

            <a class="task" routerLink="/review">
              <span class="check" [class.done]="cardsDone()">
                <i class="ti" [class.ti-check]="cardsDone()" [class.ti-cards]="!cardsDone()" aria-hidden="true"></i>
              </span>
              <span class="row-main">
                <span>
                  @if (t.cards_due) { Review {{ t.cards_due }} {{ t.cards_due === 1 ? 'card' : 'cards' }} } @else { No cards due }
                </span>
                <span class="faint">
                  @if (t.cards_due || t.reviewed_today) { Spaced repetition keeps ideas fresh } @else { Add a topic's key ideas from its page }
                </span>
              </span>
              <span class="count faint">{{ t.reviewed_today }}/{{ t.plan.daily_cards }}</span>
            </a>

            @if (t.focus; as f) {
              <a class="task" [routerLink]="['/topics', f.topic_id]">
                <span class="check"><i class="ti ti-book" aria-hidden="true"></i></span>
                <span class="row-main">
                  <span>Learn {{ f.title }}</span>
                  <span class="faint">{{ f.reason }}</span>
                </span>
              </a>
            }
          </div>

          @if (t.pace !== null) {
            <p class="faint pace">
              {{ t.remaining_problems }} coding problems left · about {{ t.pace }} a day to finish them by {{ targetLabel() }}
            </p>
          }
        } @else {
          <p class="muted">Couldn't load today's plan.</p>
        }
      </section>

      <section class="card activity" aria-label="Activity">
        <div class="head">
          <h2>Activity</h2>
          @if (activity.value(); as a) {
            <span class="streak">
              <i class="ti ti-flame" aria-hidden="true"></i>{{ a.streak }}-day streak
            </span>
          }
        </div>
        @if (activity.value(); as a) {
          <app-activity-heatmap [activity]="a" />
          <p class="faint">{{ a.active_days }} active days · best streak {{ a.longest_streak }}</p>
        } @else {
          <div class="skeleton" style="height: 120px"></div>
        }
      </section>
    </div>
  `,
  styles: `
    .today-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
      margin-bottom: 28px;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .link:hover {
      color: var(--text);
    }
    .tasks {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .task {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      margin: 0 -8px;
      border-radius: var(--radius);
      color: var(--text);
      transition: background-color 0.15s;
      &:hover {
        background: var(--hover);
      }
    }
    .check {
      width: 30px;
      height: 30px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1.5px var(--border-strong);
      font-size: 15px;
      transition: background-color 0.3s var(--ease);
      &.done {
        background: var(--accent);
        color: var(--on-accent);
        box-shadow: none;
      }
    }
    .count {
      font-variant-numeric: tabular-nums;
    }
    .pace {
      margin-top: 10px;
    }
    .streak {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 600;
      font-size: 13px;
    }
    .activity p {
      margin-top: 6px;
    }
    @media (max-width: 900px) {
      .today-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class TodayPanel {
  private readonly api = inject(Api);
  protected readonly today = this.api.today();
  protected readonly activity = this.api.activity();

  protected readonly t = computed(() => this.today.value());
  protected readonly problemsDone = computed(() => {
    const t = this.t();
    return !!t && t.plan.daily_problems > 0 && t.solved_today >= t.plan.daily_problems;
  });
  protected readonly cardsDone = computed(() => {
    const t = this.t();
    return !!t && t.cards_due === 0 && t.reviewed_today > 0;
  });
  protected readonly targetLabel = computed(() => {
    const d = this.t()?.plan.target_date;
    return d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
  });
}
