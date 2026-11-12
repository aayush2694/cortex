import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Api, errorMessage } from '../../core/api/api';

/** Your interview target date and daily goals; the dashboard's Today panel uses them. */
@Component({
  selector: 'app-plan-settings',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="group-label" id="plan">Interview plan</span>
    <form class="card plan" (submit)="save($event)">
      <label>
        <span class="row-main"><span>Target date</span><span class="faint">Your first interview, or the day you want to be ready</span></span>
        <input class="input" type="date" name="target" [(ngModel)]="target" />
      </label>
      <label>
        <span class="row-main"><span>Problems a day</span><span class="faint">Coding problems to solve each day</span></span>
        <input class="input num" type="number" name="problems" min="0" max="20" [(ngModel)]="problems" />
      </label>
      <label>
        <span class="row-main"><span>Cards a day</span><span class="faint">Flashcards to review each day</span></span>
        <input class="input num" type="number" name="cards" min="0" max="200" [(ngModel)]="cards" />
      </label>
      <div class="actions">
        @if (status()) {
          <span class="faint" aria-live="polite">{{ status() }}</span>
        }
        @if (target()) {
          <button class="btn ghost" type="button" (click)="target.set('')">Clear date</button>
        }
        <button class="btn primary" type="submit" [disabled]="saving()">Save plan</button>
      </div>
    </form>
  `,
  styles: `
    .group-label {
      margin-top: 24px;
      scroll-margin-top: 80px;
    }
    .plan {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    label {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .input {
      width: 170px;
    }
    .num {
      width: 90px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
    }
  `,
})
export class PlanSettings {
  private readonly api = inject(Api);
  private readonly plan = this.api.plan();

  protected readonly target = signal('');
  protected readonly problems = signal(1);
  protected readonly cards = signal(10);
  protected readonly saving = signal(false);
  protected readonly status = signal('');

  constructor() {
    effect(() => {
      const p = this.plan.value();
      if (!p) return;
      this.target.set(p.target_date ?? '');
      this.problems.set(p.daily_problems);
      this.cards.set(p.daily_cards);
    });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.saving.set(true);
    this.status.set('');
    try {
      await this.api.savePlan({
        target_date: this.target() || null,
        daily_problems: Math.min(20, Math.max(0, Number(this.problems()) || 0)),
        daily_cards: Math.min(200, Math.max(0, Number(this.cards()) || 0)),
      });
      this.status.set('Saved');
    } catch (err) {
      this.status.set(errorMessage(err, "Couldn't save the plan"));
    } finally {
      this.saving.set(false);
    }
  }
}
