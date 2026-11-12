import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';

import { Api, errorMessage } from '../../core/api/api';
import { MatchedSkill, SkillMatch } from '../../core/api/models';

const RESUME_KEY = 'cortex.resume';

function readResume(): string {
  try {
    return localStorage.getItem(RESUME_KEY) ?? '';
  } catch {
    return '';
  }
}

type SkillItem = { name: string; required: boolean };

/** Group skills by category, keeping the order they arrive in. */
export function byCategory(skills: MatchedSkill[]): { category: string; items: SkillItem[] }[] {
  const groups = new Map<string, SkillItem[]>();
  for (const s of skills) {
    groups.set(s.category, [...(groups.get(s.category) ?? []), { name: s.name, required: s.required }]);
  }
  return [...groups].map(([category, items]) => ({ category, items }));
}

/** How much of a job description your resume covers, skill by skill. */
@Component({
  selector: 'app-resume-match',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <div class="eyebrow">Career</div>
          <h1>Resume match</h1>
          <p>Paste your resume and a job description to see which skills you cover and which are missing.</p>
        </div>
      </header>

      <div class="inputs">
        <label class="card">
          <span class="label">Your resume <span class="faint">(kept in this browser)</span></span>
          <textarea class="input" rows="12" [value]="resume()" (input)="resume.set($any($event.target).value)" placeholder="Paste the text of your resume"></textarea>
        </label>
        <label class="card">
          <span class="label">Job description</span>
          <textarea class="input" rows="12" [value]="job()" (input)="job.set($any($event.target).value)" placeholder="Paste the job description"></textarea>
        </label>
      </div>
      <div class="actions">
        <span class="faint">Compared on your own Cortex server; nothing is saved there.</span>
        <button class="btn primary" (click)="compare()" [disabled]="busy() || !resume().trim() || !job().trim()">
          <i class="ti ti-file-search" aria-hidden="true"></i>{{ busy() ? 'Comparing…' : 'Compare' }}
        </button>
      </div>
      @if (error()) {
        <p class="muted"><i class="ti ti-alert-circle" aria-hidden="true"></i> {{ error() }}</p>
      }

      @if (result(); as r) {
        <section class="card result" aria-live="polite">
          <div class="score">
            <svg viewBox="0 0 120 120" role="img" [attr.aria-label]="r.score + '% match'">
              <circle class="track" cx="60" cy="60" r="52" />
              <circle class="fill" cx="60" cy="60" r="52" [style.stroke-dashoffset]="dash(r.score)" />
            </svg>
            <div class="num"><strong>{{ r.score }}%</strong><span class="faint">match</span></div>
          </div>
          <div class="summary">
            <h2>{{ headline(r) }}</h2>
            <p class="muted">
              The job requires {{ requiredCount(r) }} skills Cortex recognises, and your resume mentions
              {{ requiredMatched(r) }} of them. Nice-to-haves don't lower the score. If you have a missing skill,
              say so in your resume with a concrete example.
            </p>
          </div>
        </section>

        <div class="groups">
          @for (g of sections(); track g.title) {
            <section class="card">
              <h3>{{ g.title }} <span class="faint">{{ g.count }}</span></h3>
              <p class="faint">{{ g.hint }}</p>
              @for (c of g.groups; track c.category) {
                <div class="cat">
                  <span class="label">{{ c.category }}</span>
                  <div class="pills">
                    @for (n of c.items; track n.name) {
                      <span class="pill" [class.strong]="g.style === 'strong'" [class.outline]="g.style === 'outline' && n.required">
                        {{ n.name }}@if (g.title === 'Missing' && !n.required) { · nice to have }
                      </span>
                    }
                  </div>
                </div>
              } @empty {
                <p class="muted">None</p>
              }
            </section>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .inputs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      label {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      textarea {
        height: auto;
        resize: vertical;
        padding: 10px 12px;
        line-height: 1.5;
        font-family: var(--font);
      }
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      margin: 12px 0 20px;
    }
    .result {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 12px;
      animation: rise 0.4s var(--ease);
    }
    .score {
      position: relative;
      width: 120px;
      height: 120px;
      flex-shrink: 0;
      svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }
      circle {
        fill: none;
        stroke-width: 10;
      }
      .track {
        stroke: var(--raised);
      }
      .fill {
        stroke: var(--text);
        stroke-linecap: round;
        stroke-dasharray: 326.7;
        transition: stroke-dashoffset 0.9s var(--ease);
      }
      .num {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        text-align: center;
        strong {
          font: 600 26px var(--font-display);
        }
      }
    }
    .summary h2 {
      margin-bottom: 6px;
    }
    .groups {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      h3 {
        margin-bottom: 2px;
      }
      p {
        margin-bottom: 10px;
      }
    }
    .cat {
      margin-bottom: 10px;
    }
    .pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }
    @media (max-width: 900px) {
      .inputs,
      .groups {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ResumeMatch {
  private readonly api = inject(Api);
  protected readonly resume = signal(readResume());
  protected readonly job = signal('');
  protected readonly result = signal<SkillMatch | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly sections = computed(() => {
    const r = this.result();
    if (!r) return [];
    return [
      { title: 'Missing', count: r.missing.length, style: 'outline', hint: 'Asked for, not in your resume', groups: byCategory(r.missing) },
      { title: 'Matched', count: r.matched.length, style: 'strong', hint: 'Asked for and in your resume', groups: byCategory(r.matched) },
      { title: 'Your extras', count: r.extra.length, style: '', hint: 'In your resume, not asked for', groups: byCategory(r.extra) },
    ];
  });

  constructor() {
    // Remember the resume in this browser so you only paste it once.
    effect(() => {
      try {
        localStorage.setItem(RESUME_KEY, this.resume());
      } catch {
        // storage blocked: nothing to do
      }
    });
  }

  protected requiredCount(r: SkillMatch): number {
    return [...r.matched, ...r.missing].filter((s) => s.required).length;
  }

  protected requiredMatched(r: SkillMatch): number {
    return r.matched.filter((s) => s.required).length;
  }

  protected dash(score: number): number {
    return 326.7 * (1 - score / 100);
  }

  protected headline(r: SkillMatch): string {
    if (!r.matched.length && !r.missing.length) return 'No recognised skills in this job description';
    if (r.score >= 80) return 'Strong match';
    if (r.score >= 50) return 'Decent match, with a few gaps';
    return 'Big gaps for this role';
  }

  protected async compare(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      this.result.set(await this.api.matchResume(this.resume(), this.job()));
    } catch (err) {
      this.error.set(errorMessage(err, "Couldn't compare. Is the API running?"));
    } finally {
      this.busy.set(false);
    }
  }
}
