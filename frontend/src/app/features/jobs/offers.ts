import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api, errorMessage } from '../../core/api/api';
import { JobApplication } from '../../core/api/models';
import { firstYear, hike, lpa, recurring, todayLocal } from './jobs-format';

type MoneyKey = 'fixed' | 'variable' | 'joining_bonus' | 'stock_per_year';

const COLUMNS: { key: MoneyKey; label: string }[] = [
  { key: 'fixed', label: 'Fixed' },
  { key: 'variable', label: 'Variable' },
  { key: 'joining_bonus', label: 'Joining bonus' },
  { key: 'stock_per_year', label: 'Stock / year' },
];

/** Every offer side by side, with the hike each one gives over your current pay. */
@Component({
  selector: 'app-offers',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <div class="eyebrow">Career</div>
          <h1>Offers</h1>
          <p>Compare offers on what you'll actually earn, not just the headline CTC. All amounts in lakhs per year.</p>
        </div>
      </header>

      <div class="card current">
        <label>
          <span class="row-main"><span>Your current CTC</span><span class="faint">Used to work out each hike</span></span>
          <span class="money-input"><span class="faint">₹</span>
            <input class="input" type="number" min="0" step="0.1" aria-label="Current CTC in lakhs" [value]="current() ?? ''" (change)="saveCurrent($any($event.target).value)" />
            <span class="faint">L</span>
          </span>
        </label>
      </div>

      @if (offers().length) {
        <div class="card table-card">
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  @for (c of columns; track c.key) { <th class="num">{{ c.label }}</th> }
                  <th class="num">Every year</th>
                  <th class="num">First year</th>
                  <th class="num">Hike</th>
                </tr>
              </thead>
              <tbody>
                @for (o of offers(); track o.id) {
                  <tr [class.best]="o.id === bestId()">
                    <td>
                      <strong>{{ o.company }}</strong>
                      <span class="faint role">{{ o.role }}</span>
                      @if (o.id === bestId()) { <span class="pill strong">Best yearly pay</span> }
                    </td>
                    @for (c of columns; track c.key) {
                      <td class="num">
                        <input class="cell" type="number" min="0" step="0.1" [attr.aria-label]="c.label + ' for ' + o.company" [value]="o[c.key] ?? ''" (change)="setMoney(o, c.key, $any($event.target).value)" />
                      </td>
                    }
                    <td class="num strong">{{ money(yearly(o)) }}</td>
                    <td class="num">{{ money(first(o)) }}</td>
                    <td class="num">
                      @if (hikeOf(o); as h) { <span class="pill" [class.strong]="h >= 30" [class.outline]="h < 0">{{ h > 0 ? '+' : '' }}{{ h }}%</span> } @else { — }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="faint foot">
            "Every year" is fixed + variable + stock. "First year" adds the joining bonus. The hike compares "every year" with your current CTC.
            Variable pay is often not guaranteed: ask how much was actually paid out last year.
          </p>
        </div>
      } @else if (!apps.isLoading()) {
        <div class="card empty">
          <h2>No offers yet</h2>
          <p class="muted">Add one below, or move a job to the Offer column on the tracker.</p>
        </div>
      }

      <span class="group-label">Add an offer</span>
      <form class="card add" (submit)="add($event)">
        <input class="input" name="company" placeholder="Company" aria-label="Company" [value]="newCompany()" (input)="newCompany.set($any($event.target).value)" />
        <input class="input" name="role" placeholder="Role" aria-label="Role" [value]="newRole()" (input)="newRole.set($any($event.target).value)" />
        <input class="input small" type="number" min="0" step="0.1" name="fixed" placeholder="Fixed (L)" aria-label="Fixed pay in lakhs" [value]="newFixed()" (input)="newFixed.set($any($event.target).value)" />
        <button class="btn primary" type="submit" [disabled]="!newCompany().trim() || !newRole().trim()">Add</button>
        <a class="btn ghost" routerLink="/jobs">Open tracker</a>
      </form>
      @if (error()) {
        <p class="muted"><i class="ti ti-alert-circle" aria-hidden="true"></i> {{ error() }}</p>
      }
    </div>
  `,
  styles: `
    .current label {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .money-input {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      .input {
        width: 110px;
      }
    }
    .table-card {
      margin-top: 16px;
    }
    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    th {
      text-align: left;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-2);
      padding: 0 10px 8px 0;
      white-space: nowrap;
    }
    td {
      padding: 10px 10px 10px 0;
      border-top: 0.5px solid var(--separator);
      vertical-align: middle;
      white-space: nowrap;
    }
    .num {
      text-align: right;
    }
    .strong {
      font-weight: 600;
    }
    .role {
      display: block;
    }
    tr.best td:first-child .pill {
      margin-top: 4px;
    }
    .cell {
      width: 80px;
      height: 30px;
      text-align: right;
      border: 0;
      border-radius: 7px;
      background: var(--raised);
      color: var(--text);
      font: inherit;
      padding: 0 8px;
      font-variant-numeric: tabular-nums;
    }
    .foot {
      margin-top: 10px;
      line-height: 1.5;
      white-space: normal;
    }
    .empty {
      margin-top: 16px;
      text-align: center;
      padding: 32px;
    }
    .group-label {
      margin-top: 24px;
    }
    .add {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      .input {
        flex: 1;
        min-width: 140px;
      }
      .small {
        flex: 0 0 120px;
        min-width: 0;
      }
    }
  `,
})
export class Offers {
  private readonly api = inject(Api);
  protected readonly apps = this.api.applications();
  private readonly profile = this.api.jobProfile();
  protected readonly columns = COLUMNS;

  private readonly all = linkedSignal(() => this.apps.value()?.items ?? []);
  protected readonly offers = computed(() => this.all().filter((a) => a.status === 'offer'));
  protected readonly current = signal<number | null>(null);
  protected readonly error = signal('');
  protected readonly newCompany = signal('');
  protected readonly newRole = signal('');
  protected readonly newFixed = signal('');

  protected readonly bestId = computed(() => {
    const list = this.offers().filter((o) => recurring(o) > 0);
    if (list.length < 2) return null;
    return list.reduce((best, o) => (recurring(o) > recurring(best) ? o : best)).id;
  });

  protected readonly yearly = recurring;
  protected readonly first = firstYear;
  protected readonly money = lpa;

  constructor() {
    effect(() => {
      const p = this.profile.value();
      if (p) this.current.set(p.current_ctc);
    });
  }

  protected hikeOf(o: JobApplication): number | null {
    return hike(recurring(o), this.current());
  }

  protected async saveCurrent(raw: string): Promise<void> {
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (Number.isNaN(value) || value < 0)) return;
    this.current.set(value);
    try {
      await this.api.saveJobProfile(value);
    } catch (err) {
      this.error.set(errorMessage(err, "Couldn't save your current CTC"));
    }
  }

  protected async setMoney(o: JobApplication, key: MoneyKey, raw: string): Promise<void> {
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (Number.isNaN(value) || value < 0)) return;
    this.replace({ ...o, [key]: value });
    try {
      this.replace(await this.api.updateApplication(o.id, { [key]: value }));
    } catch (err) {
      this.replace(o);
      this.error.set(errorMessage(err, "Couldn't save that number"));
    }
  }

  protected async add(event: Event): Promise<void> {
    event.preventDefault();
    const fixed = this.newFixed() === '' ? null : Number(this.newFixed());
    try {
      const created = await this.api.createApplication({
        company: this.newCompany().trim(),
        role: this.newRole().trim(),
        status: 'offer',
        applied_on: todayLocal(),
        fixed: fixed !== null && !Number.isNaN(fixed) ? fixed : null,
      });
      this.all.update((list) => [...list, created]);
      this.newCompany.set('');
      this.newRole.set('');
      this.newFixed.set('');
    } catch (err) {
      this.error.set(errorMessage(err, "Couldn't add the offer"));
    }
  }

  private replace(job: JobApplication): void {
    this.all.update((list) => list.map((a) => (a.id === job.id ? job : a)));
  }
}
