import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';

import { Api } from '../../core/api/api';
import { JobApplication, Stage } from '../../core/api/models';
import { JobEditor } from './job-editor';
import { APPLIED_STAGES, STAGES, daysSince, lpa, relativeDay, todayLocal } from './jobs-format';

const APPLIED = APPLIED_STAGES;

/** A board of every job you're tracking, from wishlist to offer. Drag cards between stages. */
@Component({
  selector: 'app-job-board',
  imports: [JobEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page wide">
      <header class="page-head">
        <div>
          <div class="eyebrow">Career</div>
          <h1>Job tracker</h1>
          <p>Every application in one place. Drag a card to move it to the next stage.</p>
        </div>
        <button class="btn primary" (click)="openNew('wishlist')"><i class="ti ti-plus" aria-hidden="true"></i>Add a job</button>
      </header>

      <div class="stats">
        @for (s of stats(); track s.label) {
          <div class="card stat"><span class="label">{{ s.label }}</span><span class="value">{{ s.value }}</span></div>
        }
      </div>

      @if (upcoming().length) {
        <span class="group-label">Coming up</span>
        <div class="list upcoming">
          @for (a of upcoming(); track a.id) {
            <button class="list-row" (click)="edit(a)">
              <span class="tile"><i class="ti ti-calendar-event" aria-hidden="true"></i></span>
              <span class="row-main">
                <span>{{ a.next_step }}</span>
                <span class="faint">{{ a.company }} · {{ a.role }}</span>
              </span>
              <span class="pill" [class.strong]="isSoon(a)">{{ when(a.next_step_on!) }}</span>
            </button>
          }
        </div>
      }

      @if (res.isLoading() && !res.hasValue()) {
        <div class="skeleton" style="height: 320px; margin-top: 24px"></div>
      } @else {
        <div class="board" role="list" aria-label="Job stages">
          @for (col of columns(); track col.id) {
            <section
              class="column"
              role="listitem"
              [attr.aria-label]="col.label"
              [class.over]="dropTarget() === col.id"
              (dragover)="$event.preventDefault(); dropTarget.set(col.id)"
              (dragleave)="dropTarget.set(null)"
              (drop)="drop($event, col.id)"
            >
              <div class="col-head">
                <span>{{ col.label }}</span>
                <span class="faint">{{ col.items.length }}</span>
              </div>
              @for (a of col.items; track a.id) {
                <button
                  class="job"
                  draggable="true"
                  [class.dragging]="dragging() === a.id"
                  (dragstart)="dragStart($event, a)"
                  (dragend)="dragging.set(null); dropTarget.set(null)"
                  (click)="edit(a)"
                >
                  <span class="company">{{ a.company }}</span>
                  <span class="role">{{ a.role }}</span>
                  @if (a.status === 'offer' && a.fixed) {
                    <span class="pill strong">{{ money(a.fixed) }} fixed</span>
                  }
                  @if (a.next_step && a.status !== 'rejected') {
                    <span class="next faint"><i class="ti ti-arrow-right" aria-hidden="true"></i>{{ a.next_step }}@if (a.next_step_on) { · {{ when(a.next_step_on) }} }</span>
                  }
                  <span class="meta faint">
                    @if (a.source) { {{ a.source }} }
                    @if (a.source && a.applied_on) { · }
                    @if (a.applied_on) { applied {{ ago(a.applied_on) }} }
                  </span>
                </button>
              } @empty {
                <p class="empty faint">Drop a card here</p>
              }
              <button class="btn ghost add" (click)="openNew(col.id)"><i class="ti ti-plus" aria-hidden="true"></i>Add</button>
            </section>
          }
        </div>
      }
    </div>

    @if (editing(); as e) {
      <app-job-editor
        [job]="e.job"
        [stage]="e.stage"
        (saved)="onSaved($event)"
        (deleted)="onDeleted($event)"
        (closed)="editing.set(null)"
      />
    }
  `,
  styles: `
    .wide {
      max-width: 1400px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .value {
      font: 600 26px var(--font-display);
      letter-spacing: -0.03em;
    }
    .upcoming {
      margin-bottom: 24px;
      button {
        width: 100%;
        border: 0;
        background: transparent;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
    }
    .board {
      display: grid;
      grid-template-columns: repeat(5, minmax(220px, 1fr));
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 8px;
    }
    .column {
      background: var(--surface);
      border-radius: var(--radius-lg);
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 220px;
      transition: box-shadow 0.15s;
      &.over {
        box-shadow: inset 0 0 0 2px var(--text);
      }
    }
    .col-head {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      font-size: 13px;
      padding: 2px 4px 4px;
    }
    .job {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
      padding: 10px 12px;
      border: 0;
      border-radius: var(--radius);
      background: var(--raised);
      color: var(--text);
      font: inherit;
      text-align: left;
      cursor: grab;
      animation: rise 0.3s var(--ease) both;
      transition: transform 0.15s var(--ease), opacity 0.15s;
      &:hover {
        transform: translateY(-1px);
      }
      &.dragging {
        opacity: 0.4;
      }
    }
    .company {
      font-weight: 600;
    }
    .role {
      font-size: 13px;
    }
    .next {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--text);
    }
    .empty {
      text-align: center;
      padding: 16px 0;
    }
    .add {
      align-self: flex-start;
      margin-top: auto;
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }
  `,
})
export class JobBoard {
  private readonly api = inject(Api);
  protected readonly res = this.api.applications();

  /** Local copy so a dragged card moves instantly, before the server answers. */
  protected readonly jobs = linkedSignal(() => this.res.value()?.items ?? []);
  protected readonly editing = signal<{ job: JobApplication | null; stage: Stage } | null>(null);
  protected readonly dragging = signal<number | null>(null);
  protected readonly dropTarget = signal<Stage | null>(null);

  protected readonly columns = computed(() =>
    STAGES.map((s) => ({
      ...s,
      items: this.jobs()
        .filter((a) => a.status === s.id)
        .sort((a, b) => a.position - b.position),
    })),
  );

  protected readonly stats = computed(() => {
    const all = this.jobs();
    const applied = all.filter((a) => APPLIED.includes(a.status)).length;
    const heard = all.filter((a) => a.status === 'interview' || a.status === 'offer').length;
    return [
      { label: 'Tracking', value: String(all.length) },
      { label: 'Applied', value: String(applied) },
      { label: 'Interviewing', value: String(all.filter((a) => a.status === 'interview').length) },
      { label: 'Offers', value: String(all.filter((a) => a.status === 'offer').length) },
      { label: 'Response rate', value: applied ? `${Math.round((heard / applied) * 100)}%` : '—' },
    ];
  });

  /** Next steps due in the coming two weeks (or overdue), soonest first. */
  protected readonly upcoming = computed(() =>
    this.jobs()
      .filter((a) => a.next_step && a.next_step_on && a.status !== 'rejected' && -daysSince(a.next_step_on) <= 14)
      .sort((a, b) => a.next_step_on!.localeCompare(b.next_step_on!))
      .slice(0, 5),
  );

  protected readonly when = relativeDay;
  protected readonly money = lpa;

  protected ago(iso: string): string {
    const d = daysSince(iso);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
  }

  protected isSoon(a: JobApplication): boolean {
    return !!a.next_step_on && -daysSince(a.next_step_on) <= 2;
  }

  protected openNew(stage: Stage): void {
    this.editing.set({ job: null, stage });
  }

  protected edit(job: JobApplication): void {
    this.editing.set({ job, stage: job.status });
  }

  protected dragStart(event: DragEvent, job: JobApplication): void {
    this.dragging.set(job.id);
    event.dataTransfer?.setData('text/plain', String(job.id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected async drop(event: DragEvent, stage: Stage): Promise<void> {
    event.preventDefault();
    this.dropTarget.set(null);
    const id = Number(event.dataTransfer?.getData('text/plain') || this.dragging());
    const job = this.jobs().find((a) => a.id === id);
    if (!job || job.status === stage) return;
    const last = Math.max(0, ...this.jobs().filter((a) => a.status === stage).map((a) => a.position));
    this.jobs.update((all) => all.map((a) => (a.id === id ? { ...a, status: stage, position: last + 1 } : a)));
    try {
      // Send your local date so "applied on" matches your calendar, not the server's.
      const stamp = APPLIED.includes(stage) && !job.applied_on ? { applied_on: todayLocal() } : {};
      const saved = await this.api.updateApplication(id, { status: stage, ...stamp });
      this.onSaved(saved, false);
    } catch {
      this.res.reload(); // put it back where the server says it is
    }
  }

  protected onSaved(job: JobApplication, close = true): void {
    this.jobs.update((all) =>
      all.some((a) => a.id === job.id) ? all.map((a) => (a.id === job.id ? job : a)) : [...all, job],
    );
    if (close) this.editing.set(null);
  }

  protected onDeleted(id: number): void {
    this.jobs.update((all) => all.filter((a) => a.id !== id));
    this.editing.set(null);
  }
}
