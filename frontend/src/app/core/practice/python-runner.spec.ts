import { TestBed } from '@angular/core/testing';

import { Api } from '../api/api';
import { PythonRunner, RUN_TIMEOUT_MS } from './python-runner';

/** Stands in for public/pyodide-worker.js so tests never download Python. */
class FakeWorker extends EventTarget {
  static last: FakeWorker;
  /** What the "worker" does with a run message; `null` means hang forever. */
  static reply: ((msg: { id: number; payload: string }) => unknown) | null = () => ({
    compile_error: null,
    stdout: '',
    results: [{ passed: true, output: 3, error: null, stdout: '', ms: 0.1 }],
  });
  terminated = false;
  sent: { type: string; payload?: string }[] = [];

  constructor() {
    super();
    FakeWorker.last = this;
  }

  postMessage(msg: { type: string; id: number; payload: string }): void {
    this.sent.push(msg);
    queueMicrotask(() => {
      if (msg.type === 'init') this.emit({ type: 'ready', version: '3.14' });
      if (msg.type === 'run' && FakeWorker.reply) {
        this.emit({ type: 'result', id: msg.id, result: JSON.stringify(FakeWorker.reply(msg)) });
      }
    });
  }

  terminate(): void {
    this.terminated = true;
  }

  private emit(data: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}

describe('PythonRunner', () => {
  let runner: PythonRunner;
  const cases = [{ args: [1, 2], expected: 3, hidden: false }];

  beforeEach(() => {
    vi.stubGlobal('Worker', FakeWorker);
    TestBed.configureTestingModule({
      providers: [{ provide: Api, useValue: { practiceRuntime: async () => '# harness' } }],
    });
    runner = TestBed.inject(PythonRunner);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('boots the worker with the harness, then runs code', async () => {
    const result = await runner.run('def f(a, b): return a + b', 'f', cases, 'exact', {
      arg_types: ['plain', 'plain'],
      returns: 'plain',
    });

    expect(result.results[0].passed).toBe(true);
    expect(runner.version()).toBe('3.14');
    expect(runner.state()).toBe('ready');
    const [init, run] = FakeWorker.last.sent;
    expect(init.type).toBe('init');
    expect(JSON.parse(run.payload!)).toMatchObject({
      function: 'f',
      arg_types: ['plain', 'plain'],
      cases: [{ args: [1, 2], expected: 3 }], // the hidden flag never reaches Python
    });
  });

  it('stops code that runs too long and starts a fresh worker next time', async () => {
    await runner.run('x', 'f', cases, 'exact'); // boot normally first
    const first = FakeWorker.last;

    vi.useFakeTimers();
    FakeWorker.reply = null; // hang
    const pending = runner.run('while True: pass', 'f', cases, 'exact');
    await vi.advanceTimersByTimeAsync(RUN_TIMEOUT_MS + 1);
    const result = await pending;

    expect(result.timedOut).toBe(true);
    expect(first.terminated).toBe(true);
    expect(runner.state()).toBe('idle');

    vi.useRealTimers();
    FakeWorker.reply = () => ({ compile_error: null, stdout: '', results: [] });
    await runner.run('x', 'f', cases, 'exact');
    expect(FakeWorker.last).not.toBe(first);
  });
});
