import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api, errorMessage } from '../../core/api/api';
import { Problem, TopicDetail, leetcodeUrl } from '../../core/api/models';
import { LearningStore } from '../../core/learning-store';

/** Practice for a topic: Cortex coding problems, then (for patterns) LeetCode problems. */
@Component({
  selector: 'app-topic-practice',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (codingProblems().length) {
      <span class="group-label">Practice in Cortex · write and run code here</span>
      <div class="list problems">
        @for (cp of codingProblems(); track cp.id) {
          <a class="list-row problem" [class.solved]="cp.solved" [routerLink]="['/practice', cp.id]">
            <span class="tick" aria-hidden="true">
              <i class="ti" [class.ti-circle-check]="cp.solved" [class.ti-code]="!cp.solved"></i>
            </span>
            <span class="row-main"><span>{{ cp.title }}</span></span>
            <span class="pill diff" [class.strong]="cp.difficulty === 'hard'" [class.outline]="cp.difficulty === 'medium'">{{ cp.difficulty }}</span>
            <i class="ti ti-chevron-right chev" aria-hidden="true"></i>
          </a>
        }
      </div>
    }

    @if (topic().pattern; as pat) {
      <span class="group-label">
        Practice on LeetCode · {{ solvedIn(pat.problems) }} of {{ pat.problems.length }} solved
      </span>
      <div class="list problems">
        @for (p of pat.problems; track p.slug) {
          @let done = store.solved().has(p.slug);
          <div class="list-row problem" [class.solved]="done">
            <button
              class="tick"
              [attr.aria-pressed]="done"
              [attr.aria-label]="(done ? 'Mark as not solved: ' : 'Mark as solved: ') + p.title"
              (click)="toggleSolved(p.slug, !done)"
            >
              <i class="ti" [class.ti-circle-check]="done" [class.ti-circle]="!done"></i>
            </button>
            <a class="row-main link" [href]="leetcode(p.slug)" target="_blank" rel="noopener noreferrer">
              <span>{{ p.title }}</span>
              <span class="sr-only">(opens LeetCode in a new tab)</span>
            </a>
            <span class="pill diff" [class.strong]="p.difficulty === 'hard'" [class.outline]="p.difficulty === 'medium'">{{ p.difficulty }}</span>
            <a class="open" [href]="leetcode(p.slug)" target="_blank" rel="noopener noreferrer" [attr.aria-label]="'Open ' + p.title + ' on LeetCode'">
              <i class="ti ti-arrow-up-right chev" aria-hidden="true"></i>
            </a>
          </div>
        }
      </div>
      @if (solveError()) {
        <p class="error"><i class="ti ti-alert-circle"></i> {{ solveError() }}</p>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .group-label {
      margin-top: 24px;
    }
    .problem {
      gap: 10px;
      &::after {
        left: 52px;
      }
      &.solved .link span:first-child {
        color: var(--text-2);
        text-decoration: line-through;
        text-decoration-color: var(--text-3);
      }
    }
    .tick {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--text-3);
      font-size: 20px;
      cursor: pointer;
      transition:
        color 0.2s,
        transform 0.25s var(--ease);
      &:hover {
        color: var(--text);
      }
      &:active {
        transform: scale(0.85);
      }
      &[aria-pressed='true'] {
        color: var(--text);
        animation: pop 0.35s var(--ease);
      }
    }
    @keyframes pop {
      50% {
        transform: scale(1.25);
      }
    }
    .link {
      color: var(--text);
      &:hover span:first-child {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    .diff {
      text-transform: capitalize;
    }
    .open {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      &:hover {
        background: var(--hover);
      }
    }
    .error {
      font-size: 13px;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 6px;
    }
  `,
})
export class TopicPractice {
  readonly topic = input.required<TopicDetail>();

  private readonly api = inject(Api);
  protected readonly store = inject(LearningStore);
  private readonly practiceRes = this.api.practiceProblems();
  protected readonly solveError = signal('');

  protected readonly codingProblems = computed(() =>
    (this.practiceRes.value()?.items ?? []).filter((p) => p.topic_id === this.topic().id),
  );

  protected leetcode(slug: string): string {
    return leetcodeUrl(slug);
  }

  protected solvedIn(problems: Problem[]): number {
    const solved = this.store.solved();
    return problems.filter((p) => solved.has(p.slug)).length;
  }

  protected async toggleSolved(slug: string, solved: boolean): Promise<void> {
    this.solveError.set('');
    try {
      await this.store.setSolved(this.topic().id, slug, solved);
    } catch (err) {
      this.solveError.set(errorMessage(err, "Couldn't save that. Try again."));
    }
  }
}
