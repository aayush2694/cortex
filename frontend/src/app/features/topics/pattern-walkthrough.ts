import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { TopicDetail } from '../../core/api/models';
import { LearningStore } from '../../core/learning-store';
import { TracePlayer } from '../visualizer/player/trace-player';

/** A pattern's animated walkthrough, when to use it, and its code template. */
@Component({
  selector: 'app-pattern-walkthrough',
  imports: [TracePlayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (topic().pattern; as pat) {
      <span class="group-label first">Watch it work · {{ pat.walkthrough }}</span>
      @if (algorithm(); as algo) {
        <app-trace-player [algorithm]="algo" layout="compact" (completed)="onWalkthroughDone()" />
      } @else {
        <div class="skeleton" style="height: 300px"></div>
      }

      <div class="pattern-cols">
        <div>
          <span class="group-label">When to use it</span>
          <ul class="list signals">
            @for (s of pat.signals; track s) {
              <li class="list-row compact"><i class="ti ti-check sig" aria-hidden="true"></i><span class="row-main"><span>{{ s }}</span></span></li>
            }
          </ul>
        </div>
        <div>
          <span class="group-label row-label">
            Template
            <button class="btn ghost copy" (click)="copy(pat.template)">
              <i class="ti" [class.ti-copy]="!copied()" [class.ti-check]="copied()"></i>{{ copied() ? 'Copied' : 'Copy' }}
            </button>
          </span>
          <pre class="card template"><code>{{ pat.template }}</code></pre>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .group-label {
      margin-top: 24px;
    }
    .group-label.first {
      margin-top: 0;
    }
    .pattern-cols {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 16px;
    }
    .signals {
      margin: 0;
      padding: 0;
      list-style: none;
      .sig {
        color: var(--text-2);
        font-size: 16px;
      }
      .list-row::after {
        left: 44px;
      }
    }
    .list-row.compact {
      min-height: 44px;
    }
    .row-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      .copy {
        height: 26px;
        font-size: 12.5px;
      }
    }
    .template {
      margin: 0;
      padding: 14px 16px;
      overflow-x: auto;
      line-height: 1.7;
      color: var(--text);
    }
    @media (max-width: 640px) {
      .pattern-cols {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class PatternWalkthrough {
  readonly topic = input.required<TopicDetail>();

  private readonly store = inject(LearningStore);
  protected readonly copied = signal(false);
  protected readonly algorithm = computed(() => {
    const key = this.topic().visualizer;
    return key ? this.store.algorithmByKey().get(key) : undefined;
  });

  protected onWalkthroughDone(): void {
    this.store.markVisualizerDone(this.topic().id).catch(() => {});
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard blocked: nothing to do, the code is still selectable.
    }
  }
}
