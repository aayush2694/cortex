import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api } from '../../core/api/api';
import { TRACK_LABELS, Track } from '../../core/api/models';
import { LearningStore } from '../../core/learning-store';
import { StatusDot } from '../../shared/status-dot';
import { TodayPanel } from './today-panel';

const TRACK_ICONS: Record<Track, string> = {
  dsa: 'ti-binary-tree',
  languages: 'ti-code',
  frameworks: 'ti-stack-2',
  ai: 'ti-sparkles',
  'system-design': 'ti-server-2',
};

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, StatusDot, TodayPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <div class="eyebrow">{{ today }}</div>
          <h1>{{ greeting() }}</h1>
        </div>
        <a class="btn primary" routerLink="/map"><i class="ti ti-topology-star-3"></i>Knowledge map</a>
      </header>

      @if (store.error()) {
        <div class="card offline">
          <i class="ti ti-plug-connected-x" aria-hidden="true"></i>
          <div>
            <h3>Can't reach the Cortex API</h3>
            <p class="muted">Start the backend (<code>uv run fastapi dev app/main.py</code>), then reload.</p>
          </div>
        </div>
      }

      <div class="stats">
        <div class="card stat">
          <span class="label">Known</span>
          <span class="value">{{ store.knownCount() }}<small> of {{ store.topics().length }}</small></span>
        </div>
        <div class="card stat">
          <span class="label">Learning</span>
          <span class="value">{{ store.learningCount() }}</span>
        </div>
        <div class="card stat">
          <span class="label">Overall mastery</span>
          <span class="value">{{ overall() }}<small>%</small></span>
        </div>
      </div>

      <app-today-panel />

      <div class="columns">
        <section>
          <span class="group-label">Up next</span>
          <div class="list">
            @if (next.isLoading() && !next.hasValue()) {
              @for (i of [1, 2, 3]; track i) {
                <div class="list-row"><span class="skeleton" style="height: 30px; width: 100%"></span></div>
              }
            }
            @for (rec of next.value()?.items ?? []; track rec.topic.id) {
              <a class="list-row" [routerLink]="['/topics', rec.topic.id]">
                <span class="tile"><i class="ti {{ icon[rec.topic.track] }}" aria-hidden="true"></i></span>
                <span class="row-main">
                  <span>{{ rec.topic.title }}</span>
                  <span class="faint">{{ trackLabel[rec.topic.track] }} · {{ rec.reason }}</span>
                </span>
                @if (rec.topic.visualizer) {
                  <span class="pill">Visual</span>
                }
                <i class="ti ti-chevron-right chev" aria-hidden="true"></i>
              </a>
            }
          </div>

          @if (inProgress().length) {
            <span class="group-label spaced">In progress</span>
            <div class="list">
              @for (t of inProgress(); track t.id) {
                <a class="list-row" [routerLink]="['/topics', t.id]">
                  <span class="tile"><i class="ti {{ icon[t.track] }}" aria-hidden="true"></i></span>
                  <span class="row-main">
                    <span>{{ t.title }}</span>
                    <span class="faint">{{ trackLabel[t.track] }}</span>
                  </span>
                  <app-status-dot status="learning" />
                  <i class="ti ti-chevron-right chev" aria-hidden="true"></i>
                </a>
              }
            </div>
          }
        </section>

        <section>
          <span class="group-label">Mastery by track</span>
          <div class="list">
            @for (t of store.trackStats(); track t.track) {
              <a class="list-row" routerLink="/map">
                <span class="tile"><i class="ti {{ icon[t.track] }}" aria-hidden="true"></i></span>
                <span class="row-main">
                  <span class="track-line">{{ t.label }}<span class="faint">{{ t.known }}/{{ t.total }}</span></span>
                  <span class="bar" role="progressbar" [attr.aria-valuenow]="t.percent" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="t.label + ' mastery'">
                    <span [style.width.%]="t.percent"></span>
                  </span>
                </span>
              </a>
            }
          </div>

          <span class="group-label spaced">Jump back in</span>
          <div class="list">
            <a routerLink="/visualizer" class="list-row">
              <span class="tile"><i class="ti ti-chart-bar" aria-hidden="true"></i></span>
              <span class="row-main"><span>Visualizer</span><span class="faint">7 algorithms, step by step</span></span>
              <i class="ti ti-chevron-right chev" aria-hidden="true"></i>
            </a>
            <a routerLink="/tutor" class="list-row">
              <span class="tile"><i class="ti ti-message-circle" aria-hidden="true"></i></span>
              <span class="row-main"><span>Ask the tutor</span><span class="faint">Hints first, answers when you want them</span></span>
              <i class="ti ti-chevron-right chev" aria-hidden="true"></i>
            </a>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: `
    .offline {
      display: flex;
      gap: 14px;
      align-items: center;
      margin-bottom: 24px;
      > i {
        font-size: 26px;
      }
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .value {
      font: 600 30px var(--font-display);
      letter-spacing: -0.03em;
      small {
        font-size: 15px;
        font-weight: 500;
        color: var(--text-2);
        letter-spacing: 0;
      }
    }
    .columns {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      gap: 24px;
      align-items: start;
    }
    .spaced {
      margin-top: 24px;
    }
    .track-line {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .bar {
      display: block;
      height: 4px;
      border-radius: 2px;
      background: var(--raised);
      overflow: hidden;
      span {
        display: block;
        height: 100%;
        min-width: 2px;
        border-radius: 2px;
        background: var(--text);
        transition: width 0.8s var(--ease);
      }
    }
    @media (max-width: 900px) {
      .columns {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 560px) {
      .stats {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Dashboard {
  protected readonly store = inject(LearningStore);
  protected readonly next = inject(Api).nextTopics(4);
  protected readonly trackLabel = TRACK_LABELS;
  protected readonly icon = TRACK_ICONS;
  protected readonly today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  protected readonly inProgress = computed(() =>
    this.store.topics().filter((t) => this.store.progressOf(t.id)?.status === 'learning'),
  );

  protected readonly overall = computed(() => {
    const topics = this.store.topics();
    if (!topics.length) return 0;
    const sum = topics.reduce((s, t) => s + (this.store.progressOf(t.id)?.mastery ?? 0), 0);
    return Math.round((sum / topics.length) * 100);
  });

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 5) return 'Studying late';
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  });
}
