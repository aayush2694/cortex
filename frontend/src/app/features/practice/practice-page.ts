import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api, errorMessage } from '../../core/api/api';
import { Solution, TestCase } from '../../core/api/models';
import { LearningStore } from '../../core/learning-store';
import { PythonRunner, RUN_TIMEOUT_MS, RunResult } from '../../core/practice/python-runner';
import { CodeEditor } from './code-editor';

type Mode = 'run' | 'submit';

interface Outcome {
  mode: Mode;
  run: RunResult;
  cases: TestCase[];
  passed: number;
  /** Index of the first failing case, opened by default. */
  firstFail: number;
}

const DRAFT_KEY = (id: string) => `cortex.practice.${id}`;

function readDraft(id: string): string | null {
  try {
    return localStorage.getItem(DRAFT_KEY(id));
  } catch {
    return null;
  }
}

function writeDraft(id: string, code: string | null): void {
  try {
    if (code === null) localStorage.removeItem(DRAFT_KEY(id));
    else localStorage.setItem(DRAFT_KEY(id), code);
  } catch {
    // Storage can be blocked (private window); drafts are only a convenience.
  }
}

/** Show a value the way Python would print it: [1, 2], "abc", True, None, {"a": 1}. */
export function show(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (Array.isArray(value)) return `[${value.map(show).join(', ')}]`;
  if (typeof value === 'object') {
    const items = Object.entries(value as Record<string, unknown>);
    return `{${items.map(([k, v]) => `${JSON.stringify(k)}: ${show(v)}`).join(', ')}}`;
  }
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

/** Split a statement into paragraphs, and each paragraph into text and `code` pieces. */
export function paragraphs(text: string): { code: boolean; text: string }[][] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((para) =>
      para
        .replace(/\s*\n\s*/g, ' ')
        .split('`')
        .map((piece, i) => ({ code: i % 2 === 1, text: piece }))
        .filter((p) => p.text),
    );
}

@Component({
  selector: 'app-practice-page',
  imports: [RouterLink, CodeEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './practice-page.html',
  styleUrl: './practice-page.scss',
})
export class PracticePage {
  private readonly api = inject(Api);
  private readonly store = inject(LearningStore);
  protected readonly runner = inject(PythonRunner);

  /** Route param :id (bound by withComponentInputBinding). */
  readonly id = input<string>();

  protected readonly res = this.api.practiceProblem(this.id);
  protected readonly historyRes = this.api.submissions(this.id);
  protected readonly problem = computed(() => this.res.value());
  protected readonly topic = computed(() => {
    const p = this.problem();
    return p ? this.store.topicById().get(p.topic_id) : undefined;
  });
  protected readonly statement = computed(() => paragraphs(this.problem()?.statement ?? ''));
  protected readonly examples = computed(() => (this.problem()?.cases ?? []).filter((c) => !c.hidden));
  /** How linked lists and trees are written in the examples, when the problem uses them. */
  protected readonly notation = computed(() => {
    const p = this.problem();
    const kinds = new Set([...(p?.arg_types ?? []), p?.returns ?? 'plain']);
    const notes: string[] = [];
    if (kinds.has('list') || kinds.has('cycle_list')) {
      notes.push('A linked list is shown as its values in order; your code gets the head ListNode (.val, .next).');
    }
    if (kinds.has('cycle_list')) {
      notes.push('pos is the index the last node links back to, or -1 if the list ends.');
    }
    if (kinds.has('tree')) {
      notes.push('A tree is shown level by level, with None for a missing child; your code gets the root TreeNode (.val, .left, .right).');
    }
    return notes;
  });
  protected readonly history = computed(() => (this.historyRes.value()?.items ?? []).slice(0, 5));

  /** Your code: the saved draft if there is one, otherwise the starter. */
  protected readonly code = linkedSignal(() => {
    const p = this.problem();
    return p ? (readDraft(p.id) ?? p.starter) : '';
  });

  protected readonly busy = signal<Mode | null>(null);
  protected readonly outcome = signal<Outcome | null>(null);
  protected readonly runError = signal<string | null>(null);
  protected readonly hintsShown = signal(0);
  protected readonly solution = signal<Solution | null>(null);
  protected readonly confirmSolution = signal(false);
  protected readonly justSolved = signal(false);

  protected readonly show = show;
  protected readonly timeoutSeconds = RUN_TIMEOUT_MS / 1000;

  constructor() {
    this.runner.warmUp();

    // Keep a draft of your code per problem; drop it when it matches the starter again.
    effect(() => {
      const p = this.problem();
      const code = this.code();
      if (p) writeDraft(p.id, code === p.starter ? null : code);
    });

    // A different problem starts with a clean slate.
    effect(() => {
      this.id();
      this.outcome.set(null);
      this.runError.set(null);
      this.hintsShown.set(0);
      this.solution.set(null);
      this.confirmSolution.set(false);
      this.justSolved.set(false);
    });
  }

  protected args(c: TestCase): string {
    const names = this.problem()?.params ?? [];
    return c.args.map((a, i) => `${names[i] ?? `arg${i + 1}`} = ${show(a)}`).join(', ');
  }

  protected resetCode(): void {
    const p = this.problem();
    if (p) this.code.set(p.starter);
  }

  protected async execute(mode: Mode): Promise<void> {
    const p = this.problem();
    if (!p || this.busy()) return;
    const cases = mode === 'run' ? this.examples() : p.cases;
    this.busy.set(mode);
    this.runError.set(null);
    this.justSolved.set(false);
    try {
      const run = await this.runner.run(this.code(), p.function, cases, p.compare, p);
      const passed = run.results.filter((r) => r.passed).length;
      const firstFail = run.results.findIndex((r) => !r.passed);
      this.outcome.set({ mode, run, cases, passed, firstFail });

      if (mode === 'submit') {
        const runtime = run.results.reduce((sum, r) => sum + r.ms, 0);
        const sub = await this.api.submit(p.id, {
          code: this.code(),
          passed,
          total: cases.length,
          runtime_ms: Math.round(runtime * 100) / 100,
        });
        if (sub.accepted && !p.solved) this.justSolved.set(true);
        this.historyRes.reload();
        this.res.reload();
        this.store.progressRes.reload();
      }
    } catch (err) {
      this.runError.set(
        err instanceof Error ? err.message : errorMessage(err, "Couldn't save your submission"),
      );
    } finally {
      this.busy.set(null);
    }
  }

  protected revealHint(): void {
    this.hintsShown.update((n) => n + 1);
  }

  protected async showSolution(): Promise<void> {
    const p = this.problem();
    if (!p) return;
    if (!this.confirmSolution() && !p.solved) {
      this.confirmSolution.set(true);
      return;
    }
    this.solution.set(await this.api.practiceSolution(p.id));
  }

  protected ago(iso: string): string {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return new Date(iso).toLocaleDateString();
  }
}
