import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Algorithm } from '../../core/api/models';
import { LearningStore } from '../../core/learning-store';
import { TracePlayer } from './player/trace-player';

@Component({
  selector: 'app-visualizer',
  imports: [RouterLink, TracePlayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './visualizer.html',
  styleUrl: './visualizer.scss',
})
export class Visualizer {
  /** Route param `:key` (optional). Defaults to the first algorithm. */
  readonly key = input<string>();

  private readonly store = inject(LearningStore);

  protected readonly all = computed(() => this.store.algorithmsRes.value()?.items ?? []);
  /** Tabs show the classic algorithms; pattern walkthroughs live on their pattern pages. */
  protected readonly list = computed(() => this.all().filter((a) => a.kind === 'algorithm'));
  protected readonly selected = computed<Algorithm | undefined>(
    () => this.all().find((a) => a.key === this.key()) ?? this.list()[0],
  );

  /** The input the algorithm runs on. Resets to the example whenever you switch algorithm. */
  protected readonly traceInput = linkedSignal<Algorithm | undefined, Record<string, any> | null>({
    source: this.selected,
    computation: (algo) => (algo ? structuredClone(algo.example) : null),
  });

  // Simple editor for array algorithms
  protected readonly arrayText = linkedSignal<string>(() =>
    ((this.traceInput()?.['array'] ?? []) as number[]).join(', '),
  );
  protected readonly targetText = linkedSignal<string>(() =>
    String(this.traceInput()?.['target'] ?? ''),
  );
  // JSON editor for everything else
  protected readonly jsonText = linkedSignal<string>(() =>
    JSON.stringify(this.traceInput() ?? {}, null, 1),
  );
  protected readonly inputError = signal('');

  protected onCompleted(algo: Algorithm): void {
    this.store.markVisualizerDone(algo.topic_id).catch(() => {});
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
    this.traceInput.set(next);
  }

  protected applyJson(): void {
    try {
      const value = JSON.parse(this.jsonText());
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      this.inputError.set('');
      this.traceInput.set(value);
    } catch {
      this.inputError.set('That isn\'t valid JSON. Check the brackets and quotes.');
    }
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
    this.traceInput.set({ ...inp, walls: nextWalls });
  }
}
