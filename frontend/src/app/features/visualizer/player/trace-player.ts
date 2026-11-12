import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
} from '@angular/core';

import { Api, errorMessage } from '../../../core/api/api';
import { Algorithm } from '../../../core/api/models';
import { ArrayView } from '../views/array-view';
import { CodePanel } from '../views/code-panel';
import { GraphView } from '../views/graph-view';
import { GridView } from '../views/grid-view';
import { IntervalsView } from '../views/intervals-view';
import { ListView } from '../views/list-view';
import { SequenceView } from '../views/sequence-view';
import { TableView } from '../views/table-view';
import { TreeView } from '../views/tree-view';

const SPEEDS = [0.5, 1, 2, 4];
const BASE_DELAY_MS = 750;

/**
 * Runs an algorithm on the backend and plays its frames back as an animation:
 * the right view for the algorithm, a plain-English narration, playback controls,
 * keyboard shortcuts and the source code with the current line highlighted.
 *
 * Used by the Visualizer page (layout "full") and by pattern pages (layout "compact").
 */
@Component({
  selector: 'app-trace-player',
  imports: [ArrayView, GridView, GraphView, SequenceView, ListView, IntervalsView, TreeView, TableView, CodePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKey($event)',
    '[class.compact]': "layout() === 'compact'",
  },
  templateUrl: './trace-player.html',
  styleUrl: './trace-player.scss',
})
export class TracePlayer {
  readonly algorithm = input.required<Algorithm>();
  /** Input to run on; defaults to the algorithm's example. */
  readonly data = input<Record<string, any> | null>(null);
  readonly layout = input<'full' | 'compact'>('full');
  readonly keyboard = input(true);

  /** Fires once when playback reaches the last frame. */
  readonly completed = output<Algorithm>();
  readonly toggleWall = output<[number, number]>();
  readonly resetInput = output();

  private readonly api = inject(Api);

  protected readonly runInput = computed(
    () => this.data() ?? structuredClone(this.algorithm().example),
  );

  protected readonly trace = resource({
    params: () => ({ key: this.algorithm().key, input: this.runInput() }),
    loader: ({ params }) => this.api.trace(params.key, params.input),
  });

  protected readonly frames = computed(() => this.trace.value()?.frames ?? []);
  protected readonly index = linkedSignal({ source: this.frames, computation: () => 0 });
  protected readonly frame = computed(() => this.frames()[this.index()]);
  protected readonly atEnd = computed(() => this.index() >= this.frames().length - 1);
  protected readonly counters = computed(() => Object.entries(this.frame()?.counters ?? {}));
  protected readonly progress = computed(() => {
    const n = this.frames().length;
    return n > 1 ? (this.index() / (n - 1)) * 100 : 0;
  });

  protected readonly playing = signal(false);
  protected readonly speed = signal(1);
  protected readonly showCode = signal(false);

  private completedFor = '';

  constructor() {
    // Playback loop: runs only while playing; restarts when the speed changes.
    effect((onCleanup) => {
      if (!this.playing()) return;
      const id = setInterval(() => this.step(1), BASE_DELAY_MS / this.speed());
      onCleanup(() => clearInterval(id));
    });

    // Stop playing when a new trace loads.
    effect(() => {
      this.frames();
      this.playing.set(false);
    });

    effect(() => {
      const algo = this.algorithm();
      if (this.frames().length > 1 && this.atEnd() && this.completedFor !== algo.key) {
        this.completedFor = algo.key;
        this.completed.emit(algo);
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

  protected onKey(event: KeyboardEvent): void {
    if (!this.keyboard()) return;
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
