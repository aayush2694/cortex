import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api, errorMessage } from '../../core/api/api';
import { Algorithm } from '../../core/api/models';
import { LearningStore } from '../../core/learning-store';
import { ArrayView } from './views/array-view';
import { CodePanel } from './views/code-panel';
import { GraphView } from './views/graph-view';
import { GridView } from './views/grid-view';

const SPEEDS = [0.5, 1, 2, 4];
const BASE_DELAY_MS = 650;

@Component({
  selector: 'app-visualizer',
  imports: [RouterLink, ArrayView, GridView, GraphView, CodePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  templateUrl: './visualizer.html',
  styleUrl: './visualizer.scss',
})
export class Visualizer {
  /** Route param `:key` (optional). Defaults to the first algorithm. */
  readonly key = input<string>();

  private readonly api = inject(Api);
  private readonly store = inject(LearningStore);

  protected readonly algorithms = this.api.algorithms();
  protected readonly list = computed(() => this.algorithms.value()?.items ?? []);
  protected readonly selected = computed<Algorithm | undefined>(
    () => this.list().find((a) => a.key === this.key()) ?? this.list()[0],
  );

  /** The input the algorithm runs on. Resets to the example whenever you switch algorithm. */
  protected readonly traceInput = linkedSignal<Algorithm | undefined, Record<string, any> | null>({
    source: this.selected,
    computation: (algo) => (algo ? structuredClone(algo.example) : null),
  });

  protected readonly trace = resource({
    params: () => {
      const algo = this.selected();
      const inp = this.traceInput();
      return algo && inp ? { key: algo.key, input: inp } : undefined;
    },
    loader: ({ params }) => this.api.trace(params.key, params.input),
  });

  protected readonly frames = computed(() => this.trace.value()?.frames ?? []);
  protected readonly index = linkedSignal({ source: this.frames, computation: () => 0 });
  protected readonly frame = computed(() => this.frames()[this.index()]);
  protected readonly atEnd = computed(() => this.index() >= this.frames().length - 1);
  protected readonly counters = computed(() => Object.entries(this.frame()?.counters ?? {}));

  protected readonly playing = signal(false);
  protected readonly speed = signal(1);
  protected readonly speeds = SPEEDS;

  // Array editor
  protected readonly arrayText = linkedSignal<string>(() =>
    ((this.traceInput()?.['array'] ?? []) as number[]).join(', '),
  );
  protected readonly targetText = linkedSignal<string>(() =>
    String(this.traceInput()?.['target'] ?? ''),
  );
  protected readonly inputError = signal('');

  private completedFor = '';

  constructor() {
    // Playback loop: runs only while playing; restarts when the speed changes.
    effect((onCleanup) => {
      if (!this.playing()) return;
      const id = setInterval(() => this.step(1), BASE_DELAY_MS / this.speed());
      onCleanup(() => clearInterval(id));
    });

    // Reaching the last frame counts as "completed the visualizer" for that topic (once).
    effect(() => {
      const algo = this.selected();
      if (algo && this.frames().length && this.atEnd() && this.completedFor !== algo.key) {
        this.completedFor = algo.key;
        this.store.markVisualizerDone(algo.topic_id).catch(() => {});
      }
    });
  }

  protected errorText(): string {
    return errorMessage(this.trace.error(), "Couldn't run this input");
  }

  protected step(delta: number): void {
    const last = this.frames().length - 1;
    const next = Math.min(last, Math.max(0, this.index() + delta));
    this.index.set(next);
    if (next >= last) this.playing.set(false);
  }

  protected togglePlay(): void {
    if (this.atEnd()) this.index.set(0);
    this.playing.update((p) => !p);
  }

  protected restart(): void {
    this.playing.set(false);
    this.index.set(0);
  }

  protected seek(value: string): void {
    this.playing.set(false);
    this.index.set(Number(value));
  }

  protected cycleSpeed(): void {
    const i = SPEEDS.indexOf(this.speed());
    this.speed.set(SPEEDS[(i + 1) % SPEEDS.length]);
  }

  protected applyArray(): void {
    const parts = this.arrayText().split(/[\s,]+/).filter(Boolean);
    const nums = parts.map(Number);
    if (!nums.length || nums.some((n) => !Number.isInteger(n))) {
      this.inputError.set('Enter whole numbers separated by commas.');
      return;
    }
    if (nums.length > 32 || nums.some((n) => Math.abs(n) > 999)) {
      this.inputError.set('Use up to 32 numbers between -999 and 999.');
      return;
    }
    const next: Record<string, unknown> = { array: nums };
    if (this.selected()?.key === 'binary_search') {
      const target = Number(this.targetText());
      if (!Number.isInteger(target)) {
        this.inputError.set('Enter a whole number to search for.');
        return;
      }
      next['target'] = target;
    }
    this.inputError.set('');
    this.playing.set(false);
    this.traceInput.set(next);
  }

  protected shuffle(): void {
    const n = 8 + Math.floor(Math.random() * 5);
    const nums = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 99));
    const next: Record<string, unknown> = { array: nums };
    if (this.selected()?.key === 'binary_search') {
      nums.sort((a, b) => a - b);
      next['target'] = nums[Math.floor(Math.random() * n)];
    }
    this.inputError.set('');
    this.playing.set(false);
    this.traceInput.set(next);
  }

  protected resetInput(): void {
    const algo = this.selected();
    if (algo) this.traceInput.set(structuredClone(algo.example));
    this.inputError.set('');
  }

  protected toggleWall(cell: [number, number]): void {
    const inp = this.traceInput();
    if (!inp) return;
    const same = (c: number[]) => c[0] === cell[0] && c[1] === cell[1];
    if (same(inp['start']) || same(inp['end'])) return;
    const walls: number[][] = inp['walls'] ?? [];
    const nextWalls = walls.some(same) ? walls.filter((w) => !same(w)) : [...walls, cell];
    this.playing.set(false);
    this.traceInput.set({ ...inp, walls: nextWalls });
  }

  protected onKey(event: KeyboardEvent): void {
    const target = event.target as Element | null;
    if (target?.closest?.('input, textarea, select, [contenteditable]')) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    // A focused button already "clicks" on Space; don't toggle twice.
    if (event.key === ' ' && target?.closest?.('button, a')) return;
    if (event.key === ' ') {
      event.preventDefault();
      this.togglePlay();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.playing.set(false);
      this.step(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.playing.set(false);
      this.step(-1);
    } else if (event.key.toLowerCase() === 'r') {
      this.restart();
    }
  }

  protected label(name: string): string {
    return name.replace(/_/g, ' ');
  }
}
