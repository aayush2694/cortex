import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { TRACK_LABELS, Track } from '../../core/api/models';
import { LearningStore } from '../../core/learning-store';
import { NODE_H, NODE_W, layoutGraph } from './layout';

type Filter = Track | 'all';

@Component({
  selector: 'app-knowledge-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page wide">
      <header class="page-head">
        <div>
          <h1>Knowledge map</h1>
          <p>Lines point from what to learn first to what it unlocks. Click a topic to open it.</p>
        </div>
        <div class="legend">
          <span><i class="sw ok"></i>Known</span>
          <span><i class="sw warn"></i>Learning</span>
          <span><i class="sw"></i>Not started</span>
        </div>
      </header>

      <div class="filters" role="tablist" aria-label="Filter by track">
        @for (f of filters; track f.value) {
          <button
            role="tab"
            [attr.aria-selected]="filter() === f.value"
            [class.on]="filter() === f.value"
            (click)="filter.set(f.value)"
          >
            {{ f.label }}
          </button>
        }
      </div>

      <div class="canvas card">
        @if (store.loading() && !layout().nodes.length) {
          <div class="skeleton" style="height: 480px"></div>
        } @else {
          <svg
            [attr.width]="layout().width"
            [attr.height]="layout().height"
            [attr.viewBox]="'0 0 ' + layout().width + ' ' + layout().height"
            role="img"
            aria-label="Graph of topics and their prerequisites"
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" class="arrowhead" />
              </marker>
            </defs>
            @for (e of layout().edges; track e.source + e.target) {
              <path
                class="edge"
                [class.lit]="isLitEdge(e.source, e.target)"
                [class.dim]="isDimmed(e.source) || isDimmed(e.target)"
                [attr.d]="e.path"
                marker-end="url(#arrow)"
              />
            }
            @for (n of layout().nodes; track n.topic.id) {
              <g
                class="node {{ tone(n.topic.id) }}"
                [class.dim]="isDimmed(n.topic.id)"
                [class.lit]="hovered() === n.topic.id"
                [attr.transform]="'translate(' + n.x + ',' + n.y + ')'"
                tabindex="0"
                role="link"
                [attr.aria-label]="n.topic.title"
                (mouseenter)="hovered.set(n.topic.id)"
                (mouseleave)="hovered.set(null)"
                (focus)="hovered.set(n.topic.id)"
                (blur)="hovered.set(null)"
                (click)="open(n.topic.id)"
                (keydown.enter)="open(n.topic.id)"
              >
                <rect [attr.width]="nodeW" [attr.height]="nodeH" rx="9" />
                <circle cx="16" [attr.cy]="nodeH / 2" r="4" class="status" />
                <title>{{ n.topic.title }}</title>
                <text x="28" [attr.y]="nodeH / 2 + 4.5">{{ short(n.topic.title) }}</text>
                @if (n.topic.visualizer) {
                  <g class="viz-mark" [attr.transform]="'translate(' + (nodeW - 24) + ',' + (nodeH / 2 - 6) + ')'">
                    <title>Has a visualizer</title>
                    <rect x="0" y="6" width="3" height="6" rx="1" />
                    <rect x="5" y="2" width="3" height="10" rx="1" />
                    <rect x="10" y="4" width="3" height="8" rx="1" />
                  </g>
                }
              </g>
            }
          </svg>
        }
      </div>
    </div>
  `,
  styles: `
    .wide {
      max-width: none;
    }
    .legend {
      display: flex;
      gap: 16px;
      font-size: 12.5px;
      color: var(--text-2);
      span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }
    .sw {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--border-strong);
      &.ok {
        background: var(--ok);
      }
      &.warn {
        background: var(--warn);
      }
    }
    .filters {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
      flex-wrap: wrap;
      button {
        height: 30px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: transparent;
        color: var(--text-2);
        font: 500 12.5px var(--font);
        cursor: pointer;
        &:hover {
          color: var(--text);
        }
        &.on {
          background: var(--accent-soft);
          border-color: transparent;
          color: var(--accent-text);
        }
      }
    }
    .canvas {
      overflow: auto;
      padding: 8px;
      background:
        radial-gradient(circle, var(--border) 1px, transparent 1px) 0 0 / 22px 22px,
        var(--surface);
    }
    svg {
      display: block;
      margin: 0 auto;
    }
    .edge {
      fill: none;
      stroke: var(--border-strong);
      stroke-width: 1.4;
      transition: stroke 0.15s, opacity 0.15s;
      &.lit {
        stroke: var(--accent);
        stroke-width: 2;
      }
      &.dim {
        opacity: 0.15;
      }
    }
    .arrowhead {
      fill: var(--border-strong);
    }
    .node {
      cursor: pointer;
      outline: none;
      transition: opacity 0.15s;
      > rect {
        fill: var(--raised);
        stroke: var(--border-strong);
        stroke-width: 1;
        transition: stroke 0.15s, fill 0.15s;
      }
      text {
        fill: var(--text);
        font: 500 12.5px var(--font);
      }
      .viz-mark rect {
        fill: var(--accent-text);
        stroke: none;
      }
      .status {
        fill: var(--text-3);
      }
      &.ok .status {
        fill: var(--ok);
      }
      &.warn .status {
        fill: var(--warn);
      }
      &.ok > rect {
        stroke: color-mix(in srgb, var(--ok) 45%, var(--border-strong));
      }
      &.lit > rect,
      &:focus-visible > rect {
        stroke: var(--accent);
        fill: var(--hover);
      }
      &.dim {
        opacity: 0.25;
      }
    }
  `,
})
export class KnowledgeMapPage {
  protected readonly store = inject(LearningStore);
  private readonly router = inject(Router);

  protected readonly nodeW = NODE_W;
  protected readonly nodeH = NODE_H;
  protected readonly filter = signal<Filter>('all');
  protected readonly hovered = signal<string | null>(null);
  protected readonly filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All tracks' },
    ...(Object.entries(TRACK_LABELS) as [Track, string][]).map(([value, label]) => ({ value, label })),
  ];

  /** Re-lay out the graph with only the chosen track, so each track reads cleanly on its own. */
  protected readonly layout = computed(() => {
    const f = this.filter();
    const topics = this.store.topics().filter((t) => f === 'all' || t.track === f);
    const ids = new Set(topics.map((t) => t.id));
    const edges = this.store.edges().filter((e) => ids.has(e.source) && ids.has(e.target));
    return layoutGraph(topics, edges);
  });

  /** Topics directly connected to the hovered one (its prerequisites and what it unlocks). */
  private readonly neighbours = computed(() => {
    const h = this.hovered();
    const set = new Set<string>();
    if (!h) return set;
    set.add(h);
    for (const e of this.store.edges()) {
      if (e.source === h) set.add(e.target);
      if (e.target === h) set.add(e.source);
    }
    return set;
  });

  protected isDimmed(id: string): boolean {
    const n = this.neighbours();
    return n.size > 0 && !n.has(id);
  }

  protected isLitEdge(source: string, target: string): boolean {
    const h = this.hovered();
    return h === source || h === target;
  }

  /** Keep labels inside their box; the full title shows on hover. */
  protected short(title: string): string {
    return title.length > 24 ? `${title.slice(0, 23).trimEnd()}…` : title;
  }

  protected tone(id: string): string {
    const s = this.store.progressOf(id)?.status;
    return s === 'confident' ? 'ok' : s === 'learning' ? 'warn' : '';
  }

  protected open(id: string): void {
    this.router.navigate(['/topics', id]);
  }
}
