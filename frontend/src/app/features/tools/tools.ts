import { ChangeDetectionStrategy, Component, computed, effect, signal } from '@angular/core';

import {
  decodeJwt,
  formatJson,
  fromBase64,
  highlight,
  parseTime,
  runRegex,
  sha,
  toBase64,
  urlDecode,
} from './tools-logic';

type ToolId = 'json' | 'regex' | 'jwt' | 'base64' | 'time' | 'hash';

const TOOLS: { id: ToolId; name: string; icon: string; blurb: string }[] = [
  { id: 'json', name: 'JSON formatter', icon: 'ti-braces', blurb: 'Validate, pretty-print or minify JSON.' },
  { id: 'regex', name: 'Regex tester', icon: 'ti-regex', blurb: 'Try a JavaScript regular expression on some text.' },
  { id: 'jwt', name: 'JWT decoder', icon: 'ti-key', blurb: 'Read a token’s header and claims. The signature is not checked.' },
  { id: 'base64', name: 'Base64 & URL', icon: 'ti-transform', blurb: 'Encode and decode Base64 and URL text.' },
  { id: 'time', name: 'Timestamps', icon: 'ti-clock', blurb: 'Convert Unix time and dates.' },
  { id: 'hash', name: 'Hash & UUID', icon: 'ti-fingerprint', blurb: 'SHA hashes of some text, and random UUIDs.' },
];

/** Small developer utilities. Everything runs in your browser; nothing is sent anywhere. */
@Component({
  selector: 'app-tools',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <div class="eyebrow">Reference</div>
          <h1>Developer tools</h1>
          <p>Handy utilities that run entirely in your browser. Nothing you paste leaves this page.</p>
        </div>
      </header>

      <div class="layout">
        <nav class="list" aria-label="Tools">
          @for (t of tools; track t.id) {
            <button class="list-row" [class.on]="tool() === t.id" [attr.aria-current]="tool() === t.id" (click)="tool.set(t.id)">
              <span class="tile"><i class="ti {{ t.icon }}" aria-hidden="true"></i></span>{{ t.name }}
            </button>
          }
        </nav>

        <section class="card panel">
          <h2>{{ current().name }}</h2>
          <p class="faint">{{ current().blurb }}</p>

          @switch (tool()) {
            @case ('json') {
              <textarea class="input" rows="8" aria-label="JSON input" placeholder='{"name": "Cortex"}' [value]="text()" (input)="text.set(val($event))"></textarea>
              <div class="segmented">
                <button [class.on]="indent() === 2" (click)="indent.set(2)">Pretty</button>
                <button [class.on]="indent() === 0" (click)="indent.set(0)">Minify</button>
              </div>
              @if (json(); as r) {
                @if (r.ok) {
                  <pre class="output">{{ r.value }}</pre>
                } @else if (text().trim()) {
                  <p class="error">{{ r.error }}</p>
                }
              }
            }

            @case ('regex') {
              <div class="row">
                <input class="input mono grow" name="pattern" aria-label="Pattern" placeholder="\\d+" [value]="pattern()" (input)="pattern.set(val($event))" />
                <input class="input mono flags" name="flags" aria-label="Flags" placeholder="gi" [value]="flags()" (input)="flags.set(val($event))" />
              </div>
              <textarea class="input" rows="6" aria-label="Test text" placeholder="Text to search" [value]="text()" (input)="text.set(val($event))"></textarea>
              @if (regex(); as r) {
                @if (r.ok) {
                  <p class="faint">{{ r.value.length }} {{ r.value.length === 1 ? 'match' : 'matches' }}</p>
                  <pre class="output">@for (p of pieces(); track $index) {@if (p.hit) {<mark>{{ p.text }}</mark>} @else {{{ p.text }}}}</pre>
                  @for (m of r.value.slice(0, 20); track $index) {
                    @if (m.groups.length) {
                      <p class="mono small">#{{ $index + 1 }} at {{ m.index }}: {{ m.groups.join(' · ') }}</p>
                    }
                  }
                } @else {
                  <p class="error">{{ r.error }}</p>
                }
              }
            }

            @case ('jwt') {
              <textarea class="input mono" rows="4" aria-label="Token" placeholder="eyJhbGciOi…" [value]="text()" (input)="text.set(val($event))"></textarea>
              @if (text().trim()) {
                @if (jwt(); as r) {
                  @if (r.ok) {
                    <span class="label">Header</span>
                    <pre class="output">{{ pretty(r.value.header) }}</pre>
                    <span class="label">Payload</span>
                    <pre class="output">{{ pretty(r.value.payload) }}</pre>
                    @for (t of r.value.times; track t.claim) {
                      <p class="small"><span class="mono">{{ t.claim }}</span> {{ t.date }} @if (t.note) { <span class="pill">{{ t.note }}</span> }</p>
                    }
                  } @else {
                    <p class="error">{{ r.error }}</p>
                  }
                }
              }
            }

            @case ('base64') {
              <textarea class="input" rows="5" aria-label="Text" placeholder="Text or Base64" [value]="text()" (input)="text.set(val($event))"></textarea>
              <dl>
                <dt>Base64 encoded</dt><dd class="mono">{{ text() ? b64() : '—' }}</dd>
                <dt>Base64 decoded</dt><dd class="mono">{{ show(b64Decoded()) }}</dd>
                <dt>URL encoded</dt><dd class="mono">{{ text() ? urlEncoded() : '—' }}</dd>
                <dt>URL decoded</dt><dd class="mono">{{ show(urlDecoded()) }}</dd>
              </dl>
            }

            @case ('time') {
              <div class="row">
                <input class="input mono grow" aria-label="Timestamp or date" placeholder="1700000000 or 2026-11-13T10:00:00Z" [value]="text()" (input)="text.set(val($event))" />
                <button class="btn" (click)="text.set(nowSeconds())">Now</button>
              </div>
              @if (time(); as r) {
                @if (r.ok) {
                  <dl>
                    <dt>Your time</dt><dd>{{ r.value.toLocaleString() }}</dd>
                    <dt>UTC (ISO)</dt><dd class="mono">{{ r.value.toISOString() }}</dd>
                    <dt>Unix seconds</dt><dd class="mono">{{ seconds(r.value) }}</dd>
                    <dt>Unix ms</dt><dd class="mono">{{ r.value.getTime() }}</dd>
                  </dl>
                } @else if (text().trim()) {
                  <p class="error">{{ r.error }}</p>
                }
              }
            }

            @case ('hash') {
              <textarea class="input" rows="4" aria-label="Text to hash" placeholder="Text to hash" [value]="text()" (input)="text.set(val($event))"></textarea>
              <dl>
                @for (h of hashes(); track h.name) {
                  <dt>{{ h.name }}</dt><dd class="mono">{{ h.value || '—' }}</dd>
                }
              </dl>
              <div class="row">
                <button class="btn" (click)="newUuid()"><i class="ti ti-refresh" aria-hidden="true"></i>New UUID</button>
                <span class="mono">{{ uuid() }}</span>
              </div>
            }
          }
        </section>
      </div>
    </div>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    nav button {
      width: 100%;
      border: 0;
      background: transparent;
      font: inherit;
      text-align: left;
      cursor: pointer;
      &.on {
        background: var(--selected);
      }
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }
    textarea {
      height: auto;
      resize: vertical;
      padding: 10px 12px;
      line-height: 1.5;
      font-family: var(--mono);
      font-size: 12.5px;
    }
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .grow {
      flex: 1;
    }
    .flags {
      width: 80px;
    }
    .output {
      margin: 0;
      padding: 12px;
      border-radius: var(--radius);
      background: var(--raised);
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 420px;
      overflow: auto;
    }
    mark {
      background: var(--text);
      color: var(--bg);
      border-radius: 3px;
    }
    .error {
      font-family: var(--mono);
      font-size: 12.5px;
      padding: 10px 12px;
      border-radius: var(--radius);
      box-shadow: inset 0 0 0 1px var(--border-strong);
    }
    .small {
      font-size: 12.5px;
    }
    dl {
      display: grid;
      grid-template-columns: 140px minmax(0, 1fr);
      gap: 8px 12px;
      margin: 0;
    }
    dt {
      color: var(--text-2);
      font-size: 12.5px;
    }
    dd {
      margin: 0;
      word-break: break-all;
    }
    @media (max-width: 760px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Tools {
  protected readonly tools = TOOLS;
  protected readonly tool = signal<ToolId>('json');
  protected readonly current = computed(() => TOOLS.find((t) => t.id === this.tool())!);

  /** One input box per tool would lose text when switching; one shared box keeps it simple. */
  protected readonly text = signal('');
  protected readonly indent = signal(2);
  protected readonly pattern = signal('');
  protected readonly flags = signal('g');
  protected readonly uuid = signal(crypto.randomUUID());
  private readonly hashValues = signal<Record<string, string>>({});

  protected readonly json = computed(() => formatJson(this.text(), this.indent()));
  protected readonly regex = computed(() => runRegex(this.pattern(), this.flags(), this.text()));
  protected readonly pieces = computed(() => {
    const r = this.regex();
    return r.ok ? highlight(this.text(), r.value) : [];
  });
  protected readonly jwt = computed(() => decodeJwt(this.text()));
  protected readonly b64 = computed(() => toBase64(this.text()));
  protected readonly b64Decoded = computed(() => fromBase64(this.text()));
  protected readonly urlEncoded = computed(() => encodeURIComponent(this.text()));
  protected readonly urlDecoded = computed(() => urlDecode(this.text()));
  protected readonly time = computed(() => parseTime(this.text()));
  protected readonly hashes = computed(() =>
    (['SHA-1', 'SHA-256', 'SHA-512'] as const).map((name) => ({ name, value: this.hashValues()[name] ?? '' })),
  );

  constructor() {
    // Hashing is async (Web Crypto), so it updates a signal when ready.
    effect(() => {
      const text = this.text();
      if (this.tool() !== 'hash') return;
      if (!text) {
        this.hashValues.set({});
        return;
      }
      void Promise.all((['SHA-1', 'SHA-256', 'SHA-512'] as const).map((a) => sha(a, text))).then(([a, b, c]) => {
        if (this.text() === text) this.hashValues.set({ 'SHA-1': a, 'SHA-256': b, 'SHA-512': c });
      });
    });
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected pretty(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  protected show(r: { ok: true; value: string } | { ok: false; error: string }): string {
    if (!this.text()) return '—';
    return r.ok ? r.value : r.error;
  }

  protected seconds(d: Date): number {
    return Math.floor(d.getTime() / 1000);
  }

  protected nowSeconds(): string {
    return String(Math.floor(Date.now() / 1000));
  }

  protected newUuid(): void {
    this.uuid.set(crypto.randomUUID());
  }
}
