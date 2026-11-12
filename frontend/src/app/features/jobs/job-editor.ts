import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Api, errorMessage } from '../../core/api/api';
import { JobApplication, Stage } from '../../core/api/models';
import { APPLIED_STAGES, SOURCES, STAGES, todayLocal } from './jobs-format';

type Draft = Omit<JobApplication, 'id' | 'position' | 'created_at' | 'updated_at'>;

const EMPTY: Draft = {
  company: '',
  role: '',
  status: 'wishlist',
  location: null,
  url: null,
  source: null,
  notes: '',
  applied_on: null,
  next_step: null,
  next_step_on: null,
  fixed: null,
  variable: null,
  joining_bonus: null,
  stock_per_year: null,
};

/** Add or edit one job. Opens as a panel over the board. */
@Component({
  selector: 'app-job-editor',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="scrim" (click)="closed.emit()" aria-hidden="true"></div>
    <form class="panel" role="dialog" aria-modal="true" [attr.aria-label]="isNew() ? 'Add a job' : 'Edit job'" (submit)="save($event)">
      <header>
        <h2>{{ isNew() ? 'Add a job' : draft().company }}</h2>
        <button type="button" class="btn ghost icon" aria-label="Close" (click)="closed.emit()"><i class="ti ti-x"></i></button>
      </header>

      <div class="fields">
        <label><span class="label">Company</span>
          <input class="input" name="company" required [ngModel]="draft().company" (ngModelChange)="set('company', $event)" placeholder="Razorpay" />
        </label>
        <label><span class="label">Role</span>
          <input class="input" name="role" required [ngModel]="draft().role" (ngModelChange)="set('role', $event)" placeholder="Backend Engineer" />
        </label>
        <label><span class="label">Stage</span>
          <select class="input" name="status" [ngModel]="draft().status" (ngModelChange)="set('status', $event)">
            @for (s of stages; track s.id) { <option [value]="s.id">{{ s.label }}</option> }
          </select>
        </label>
        <label><span class="label">Source</span>
          <select class="input" name="source" [ngModel]="draft().source ?? ''" (ngModelChange)="set('source', $event || null)">
            <option value="">—</option>
            @for (s of sources; track s) { <option [value]="s">{{ s }}</option> }
          </select>
        </label>
        <label><span class="label">Location</span>
          <input class="input" name="location" [ngModel]="draft().location ?? ''" (ngModelChange)="set('location', $event || null)" placeholder="Ahmedabad · Remote" />
        </label>
        <label><span class="label">Applied on</span>
          <input class="input" type="date" name="applied" [ngModel]="draft().applied_on ?? ''" (ngModelChange)="set('applied_on', $event || null)" />
        </label>
        <label class="wide"><span class="label">Job link</span>
          <input class="input" type="url" name="url" [ngModel]="draft().url ?? ''" (ngModelChange)="set('url', $event || null)" placeholder="https://…" />
        </label>
        <label class="wide"><span class="label">Next step</span>
          <input class="input" name="next" [ngModel]="draft().next_step ?? ''" (ngModelChange)="set('next_step', $event || null)" placeholder="Round 2 with the hiring manager" />
        </label>
        <label><span class="label">Next step on</span>
          <input class="input" type="date" name="nextOn" [ngModel]="draft().next_step_on ?? ''" (ngModelChange)="set('next_step_on', $event || null)" />
        </label>
      </div>

      @if (draft().status === 'offer') {
        <span class="group-label">Offer (lakhs per year)</span>
        <div class="fields money">
          @for (f of moneyFields; track f.key) {
            <label><span class="label">{{ f.label }}</span>
              <input class="input" type="number" min="0" step="0.1" [name]="f.key" [ngModel]="draft()[f.key]" (ngModelChange)="setMoney(f.key, $event)" />
            </label>
          }
        </div>
      }

      <label class="notes"><span class="label">Notes</span>
        <textarea class="input" name="notes" rows="4" [ngModel]="draft().notes" (ngModelChange)="set('notes', $event)" placeholder="Who you spoke to, what they asked, salary discussed…"></textarea>
      </label>

      @if (error()) {
        <p class="error"><i class="ti ti-alert-circle" aria-hidden="true"></i> {{ error() }}</p>
      }

      <footer>
        @if (!isNew()) {
          <button type="button" class="btn ghost" (click)="remove()">{{ confirmDelete() ? 'Delete for good?' : 'Delete' }}</button>
        }
        <span class="spacer"></span>
        <button type="button" class="btn" (click)="closed.emit()">Cancel</button>
        <button type="submit" class="btn primary" [disabled]="saving() || !draft().company.trim() || !draft().role.trim()">
          {{ isNew() ? 'Add job' : 'Save' }}
        </button>
      </footer>
    </form>
  `,
  styles: `
    .scrim {
      position: fixed;
      inset: 0;
      background: rgb(0 0 0 / 0.45);
      z-index: 40;
      animation: fade 0.2s;
    }
    .panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(480px, 100vw);
      z-index: 41;
      overflow-y: auto;
      background: var(--surface);
      box-shadow: var(--shadow);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      animation: slide 0.3s var(--ease);
    }
    header,
    footer {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    header {
      justify-content: space-between;
    }
    .spacer {
      flex: 1;
    }
    .fields {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .wide {
      grid-column: 1 / -1;
    }
    .group-label {
      padding: 0;
    }
    textarea {
      height: auto;
      resize: vertical;
      padding: 8px 10px;
      line-height: 1.5;
    }
    .error {
      color: var(--text-2);
    }
    @keyframes slide {
      from {
        transform: translateX(40px);
        opacity: 0;
      }
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
  `,
})
export class JobEditor {
  /** The job to edit, or null to add a new one (optionally starting in `stage`). */
  readonly job = input<JobApplication | null>(null);
  readonly stage = input<Stage>('wishlist');
  readonly saved = output<JobApplication>();
  readonly deleted = output<number>();
  readonly closed = output<void>();

  private readonly api = inject(Api);
  protected readonly stages = STAGES;
  protected readonly sources = SOURCES;
  protected readonly moneyFields: { key: 'fixed' | 'variable' | 'joining_bonus' | 'stock_per_year'; label: string }[] = [
    { key: 'fixed', label: 'Fixed' },
    { key: 'variable', label: 'Variable / bonus' },
    { key: 'joining_bonus', label: 'Joining bonus (once)' },
    { key: 'stock_per_year', label: 'Stock per year' },
  ];

  protected readonly isNew = computed(() => this.job() === null);
  protected readonly draft = linkedSignal<Draft>(() => {
    const j = this.job();
    if (!j) return { ...EMPTY, status: this.stage() };
    const { id: _id, position: _p, created_at: _c, updated_at: _u, ...rest } = j;
    return rest;
  });
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly confirmDelete = signal(false);

  protected set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected setMoney(key: 'fixed' | 'variable' | 'joining_bonus' | 'stock_per_year', value: unknown): void {
    const n = value === '' || value === null ? null : Number(value);
    this.set(key, n === null || Number.isNaN(n) ? null : n);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const d = this.draft();
    if (!d.company.trim() || !d.role.trim()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const body = { ...d, company: d.company.trim(), role: d.role.trim() };
      if (APPLIED_STAGES.includes(body.status) && !body.applied_on) body.applied_on = todayLocal();
      const job = this.job();
      this.saved.emit(
        job ? await this.api.updateApplication(job.id, body) : await this.api.createApplication(body),
      );
    } catch (err) {
      this.error.set(errorMessage(err, "Couldn't save. Check the fields and try again."));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const job = this.job();
    if (!job) return;
    if (!this.confirmDelete()) {
      this.confirmDelete.set(true);
      return;
    }
    try {
      await this.api.deleteApplication(job.id);
      this.deleted.emit(job.id);
    } catch (err) {
      this.error.set(errorMessage(err, "Couldn't delete"));
    }
  }
}
