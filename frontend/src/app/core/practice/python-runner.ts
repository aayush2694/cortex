import { Injectable, inject, signal } from '@angular/core';

import { Api, errorMessage } from '../api/api';
import { TestCase } from '../api/models';

export type RunnerState = 'idle' | 'loading' | 'ready' | 'running' | 'failed';

export interface CaseResult {
  passed: boolean;
  output: unknown;
  error: string | null;
  stdout: string;
  ms: number;
}

export interface RunResult {
  compile_error: string | null;
  stdout: string;
  results: CaseResult[];
  /** True when the code ran past the time limit and the worker was stopped. */
  timedOut?: boolean;
}

/** Longest a single run may take before we stop it (an endless loop, say). */
export const RUN_TIMEOUT_MS = 5000;

/**
 * Runs Python solutions in the browser. Pyodide lives in a Web Worker (public/pyodide-worker.js)
 * and judges code with the same harness the backend tests use, fetched from the API.
 * A run that takes too long terminates the worker; the next run starts a fresh one.
 */
@Injectable({ providedIn: 'root' })
export class PythonRunner {
  private readonly api = inject(Api);

  readonly state = signal<RunnerState>('idle');
  readonly version = signal('');
  readonly loadError = signal<string | null>(null);

  private worker: Worker | null = null;
  private starting: Promise<Worker> | null = null;
  private harness: string | null = null;
  private seq = 0;

  /** Start downloading Python early, so the first Run is quick. Safe to call many times. */
  warmUp(): void {
    this.start().catch(() => undefined);
  }

  async run(code: string, fn: string, cases: TestCase[], compare: string): Promise<RunResult> {
    const worker = await this.start();
    const id = ++this.seq;
    this.state.set('running');
    const payload = JSON.stringify({
      code,
      function: fn,
      compare,
      cases: cases.map((c) => ({ args: c.args, expected: c.expected })),
    });
    try {
      return await new Promise<RunResult>((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          this.stop();
          resolve({ compile_error: null, stdout: '', results: [], timedOut: true });
        }, RUN_TIMEOUT_MS);
        const onMessage = (e: MessageEvent) => {
          if (e.data.id !== id) return;
          cleanup();
          if (e.data.type === 'result') resolve(JSON.parse(e.data.result) as RunResult);
          else reject(new Error(e.data.message));
        };
        const cleanup = () => {
          clearTimeout(timer);
          worker.removeEventListener('message', onMessage);
        };
        worker.addEventListener('message', onMessage);
        worker.postMessage({ type: 'run', id, payload });
      });
    } finally {
      if (this.state() === 'running') this.state.set(this.worker ? 'ready' : 'idle');
    }
  }

  private start(): Promise<Worker> {
    this.starting ??= this.boot().catch((err: unknown) => {
      this.stop();
      this.state.set('failed');
      this.loadError.set(
        err instanceof Error ? err.message : errorMessage(err, "Couldn't load Python"),
      );
      throw err;
    });
    return this.starting;
  }

  private async boot(): Promise<Worker> {
    this.state.set('loading');
    this.loadError.set(null);
    this.harness ??= await this.api.practiceRuntime();
    const worker = new Worker('/pyodide-worker.js', { type: 'module' });
    this.worker = worker;
    await new Promise<void>((resolve, reject) => {
      const onMessage = (e: MessageEvent) => {
        if (e.data.type === 'ready') {
          this.version.set(e.data.version);
          cleanup();
          resolve();
        } else if (e.data.type === 'error') {
          cleanup();
          reject(new Error(e.data.message));
        }
      };
      const onError = (e: ErrorEvent) => {
        cleanup();
        reject(new Error(e.message || "Couldn't start Python. Check your connection."));
      };
      const cleanup = () => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
      };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage({ type: 'init', harness: this.harness });
    });
    this.state.set('ready');
    return worker;
  }

  private stop(): void {
    this.worker?.terminate();
    this.worker = null;
    this.starting = null;
    this.state.set('idle');
  }
}
