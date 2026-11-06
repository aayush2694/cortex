import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api } from '../../core/api/api';
import { TRACK_LABELS } from '../../core/api/models';
import { LearningStore } from '../../core/learning-store';
import { StatusPill } from '../../shared/status-pill';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <h1>{{ greeting() }}</h1>
          <p>
            {{ store.knownCount() }} of {{ store.topics().length }} topics known ·
            {{ store.learningCount() }} in progress
          </p>
        </div>
        <a class="btn primary" routerLink="/map"><i class="ti ti-topology-star-3"></i>Open map</a>
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

      <section>
        <div class="section-head">
          <h2>Up next</h2>
          <span class="faint">Picked from what you already know</span>
        </div>
        <div class="grid next">
          @if (next.isLoading() && !next.hasValue()) {
            @for (i of [1, 2, 3]; track i) {
              <div class="skeleton" style="height: 128px"></div>
            }
          }
          @for (rec of next.value()?.items ?? []; track rec.topic.id) {
            <a class="card next-card" [routerLink]="['/topics', rec.topic.id]">
              <div class="row">
                <span class="pill">{{ trackLabel[rec.topic.track] }}</span>
                @if (rec.topic.visualizer) {
                  <span class="pill accent"><i class="ti ti-chart-bar"></i>Visual</span>
                }
              </div>
              <h3>{{ rec.topic.title }}</h3>
              <p class="muted reason">{{ rec.reason }}</p>
              <span class="go">Start <i class="ti ti-arrow-right"></i></span>
            </a>
          }
        </div>
      </section>

      <div class="split">
        <section class="card">
          <div class="section-head">
            <h2>Mastery by track</h2>
          </div>
          <div class="tracks">
            @for (t of store.trackStats(); track t.track) {
              <div class="track">
                <span>{{ t.label }}</span>
                <div class="bar" role="progressbar" [attr.aria-valuenow]="t.percent" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="t.label + ' mastery'">
                  <div [style.width.%]="t.percent"></div>
                </div>
                <span class="faint num">{{ t.percent }}%</span>
                <span class="faint num">{{ t.known }}/{{ t.total }}</span>
              </div>
            }
          </div>
        </section>

        <section class="card">
          <div class="section-head">
            <h2>Jump back in</h2>
          </div>
          <div class="links">
            <a routerLink="/visualizer" class="link">
              <i class="ti ti-chart-bar"></i>
              <span><strong>Visualizer</strong><span class="faint">Watch 7 algorithms step by step</span></span>
            </a>
            <a routerLink="/tutor" class="link">
              <i class="ti ti-message-circle"></i>
              <span><strong>Ask the tutor</strong><span class="faint">Hints first, answers when you want them</span></span>
            </a>
            <a routerLink="/roadmap" class="link">
              <i class="ti ti-map-2"></i>
              <span><strong>Roadmap</strong><span class="faint">What's coming in Cortex</span></span>
            </a>
          </div>
        </section>
      </div>

      @if (inProgress().length) {
        <section>
          <div class="section-head"><h2>In progress</h2></div>
          <div class="card list">
            @for (t of inProgress(); track t.id) {
              <a class="list-row" [routerLink]="['/topics', t.id]">
                <span>{{ t.title }}</span>
                <span class="faint">{{ trackLabel[t.track] }}</span>
                <app-status-pill status="learning" />
              </a>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    section {
      margin-bottom: 28px;
    }
    .section-head {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 12px;
    }
    .offline {
      display: flex;
      gap: 14px;
      align-items: center;
      margin-bottom: 24px;
      border-color: var(--bad);
      > i {
        font-size: 24px;
        color: var(--bad);
      }
    }
    .grid.next {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
    }
    .next-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: var(--text);
      transition: border-color 0.15s, transform 0.15s var(--ease);
      &:hover {
        border-color: var(--accent);
        transform: translateY(-2px);
        .go {
          color: var(--accent-text);
        }
      }
    }
    .row {
      display: flex;
      gap: 6px;
    }
    .reason {
      font-size: 13px;
      flex: 1;
    }
    .go {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--text-2);
    }
    .split {
      display: grid;
      grid-template-columns: 3fr 2fr;
      gap: 12px;
      margin-bottom: 28px;
      section {
        margin: 0;
      }
    }
    .tracks {
      display: grid;
      gap: 14px;
    }
    .track {
      display: grid;
      grid-template-columns: 110px 1fr 40px 40px;
      align-items: center;
      gap: 12px;
      font-size: 13px;
    }
    .num {
      text-align: right;
    }
    .bar {
      height: 6px;
      border-radius: 3px;
      background: var(--raised);
      overflow: hidden;
      div {
        height: 100%;
        min-width: 2px;
        border-radius: 3px;
        background: var(--accent);
        transition: width 0.6s var(--ease);
      }
    }
    .links {
      display: grid;
      gap: 4px;
    }
    .link {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 10px;
      margin: 0 -10px;
      border-radius: var(--radius);
      color: var(--text);
      i {
        font-size: 20px;
        color: var(--accent);
      }
      > span {
        display: flex;
        flex-direction: column;
      }
      strong {
        font-weight: 500;
      }
      &:hover {
        background: var(--hover);
      }
    }
    .list {
      padding: 6px;
    }
    .list-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 16px;
      align-items: center;
      padding: 10px;
      border-radius: var(--radius);
      color: var(--text);
      &:hover {
        background: var(--hover);
      }
    }
    @media (max-width: 900px) {
      .split {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Dashboard {
  protected readonly store = inject(LearningStore);
  protected readonly next = inject(Api).nextTopics(3);
  protected readonly trackLabel = TRACK_LABELS;

  protected readonly inProgress = computed(() =>
    this.store.topics().filter((t) => this.store.progressOf(t.id)?.status === 'learning'),
  );

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 5) return 'Studying late';
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  });
}
