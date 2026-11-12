import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearningStore } from '../../core/learning-store';
import { CURVES, DATA_STRUCTURES, LIMITS, PYTHON_OPS, SORTS, costRank } from './cheatsheet-data';

const W = 560;
const H = 260;
const PAD = { l: 34, r: 92, t: 12, b: 28 };
const MAX_N = 16;
const MAX_Y = 64;

/** One page with the complexities you're expected to know cold in an interview. */
@Component({
  selector: 'app-cheatsheet',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <div class="eyebrow">Reference</div>
          <h1>Big-O cheat sheet</h1>
          <p>The costs interviewers expect you to know without thinking.</p>
        </div>
      </header>

      <div class="legend faint" aria-hidden="true">
        <span class="pill strong">fast</span> constant or logarithmic
        <span class="pill">fine</span> linear or n log n
        <span class="pill outline">slow</span> quadratic or worse
      </div>

      <div class="two">
        <section class="card">
          <h2>How they grow</h2>
          <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" aria-label="Growth of common complexities as n increases">
            <line class="axis" [attr.x1]="pad.l" [attr.y1]="h - pad.b" [attr.x2]="w - pad.r" [attr.y2]="h - pad.b" />
            <line class="axis" [attr.x1]="pad.l" [attr.y1]="pad.t" [attr.x2]="pad.l" [attr.y2]="h - pad.b" />
            <text class="tick" [attr.x]="w - pad.r" [attr.y]="h - 8" text-anchor="end">n →</text>
            <text class="tick" x="6" [attr.y]="pad.t + 8">ops</text>
            @for (c of curves(); track c.label; let i = $index) {
              <polyline [attr.points]="c.points" [attr.stroke-dasharray]="c.dash" [attr.stroke-width]="c.width" [style.--i]="i" />
              <text class="lbl" [attr.x]="c.lx + 6" [attr.y]="c.ly + 4">{{ c.label }}</text>
            }
          </svg>
        </section>

        <section class="card">
          <h2>What input size fits?</h2>
          <p class="faint">About 10⁸ simple steps a second. Read the limits in the problem, then pick an approach.</p>
          <table>
            <tbody>
              @for (l of limits; track l.n) {
                <tr>
                  <td class="mono">{{ l.n }}</td>
                  <td><span class="pill" [class]="pill(l.complexity)">{{ l.complexity }}</span></td>
                  <td class="faint">{{ l.example }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      </div>

      <section class="card wide">
        <h2>Data structures</h2>
        <div class="scroll">
          <table>
            <thead>
              <tr><th>Structure</th><th>Access</th><th>Search</th><th>Insert</th><th>Delete</th><th>Space</th><th>Note</th></tr>
            </thead>
            <tbody>
              @for (r of structures; track r.name) {
                <tr>
                  <td>{{ r.name }}</td>
                  @for (v of [r.access, r.search, r.insert, r.remove, r.space]; track $index) {
                    <td><span class="pill" [class]="pill(v)">{{ v }}</span></td>
                  }
                  <td class="faint note">{{ r.note }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <div class="two">
        <section class="card">
          <h2>Sorting</h2>
          <div class="scroll">
            <table>
              <thead><tr><th>Algorithm</th><th>Best</th><th>Average</th><th>Worst</th><th>Space</th><th>Stable</th></tr></thead>
              <tbody>
                @for (s of sorts; track s.name) {
                  <tr>
                    <td>{{ s.name }}</td>
                    @for (v of [s.best, s.average, s.worst, s.space]; track $index) {
                      <td><span class="pill" [class]="pill(v)">{{ v }}</span></td>
                    }
                    <td>{{ s.stable ? 'Yes' : 'No' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <h2>Python operations</h2>
          <table>
            <tbody>
              @for (o of python; track o.op) {
                <tr>
                  <td class="mono">{{ o.op }}</td>
                  <td><span class="pill" [class]="pill(o.cost)">{{ o.cost }}</span></td>
                  <td class="faint">{{ o.tip ?? '' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      </div>

      @if (store.patterns().length) {
        <section class="card wide">
          <h2>Patterns</h2>
          <div class="patterns">
            @for (p of store.patterns(); track p.id) {
              <a class="list-row compact" [routerLink]="['/topics', p.id]">
                <span class="row-main"><span>{{ p.title }}</span><span class="faint mono">{{ p.pattern!.complexity }}</span></span>
                <i class="ti ti-chevron-right chev" aria-hidden="true"></i>
              </a>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .legend {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 16px;
      .pill:not(:first-child) {
        margin-left: 10px;
      }
    }
    .two {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
      margin-bottom: 12px;
    }
    .wide {
      margin-bottom: 12px;
    }
    h2 {
      margin-bottom: 10px;
    }
    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      text-align: left;
      font-weight: 500;
      color: var(--text-2);
      font-size: 12px;
      padding: 0 8px 6px 0;
    }
    td {
      padding: 6px 8px 6px 0;
      border-top: 0.5px solid var(--separator);
      vertical-align: middle;
      white-space: nowrap;
    }
    td.note,
    td.faint {
      white-space: normal;
    }
    .pill {
      font-family: var(--mono);
    }
    svg {
      width: 100%;
      height: auto;
      display: block;
    }
    .axis {
      stroke: var(--border-strong);
    }
    .tick,
    .lbl {
      fill: var(--text-2);
      font: 500 12px var(--mono);
    }
    .lbl {
      fill: var(--text);
    }
    polyline {
      fill: none;
      stroke: var(--text);
      stroke-linejoin: round;
      stroke-dashoffset: 0;
      animation: draw 1.2s var(--ease) both;
      animation-delay: calc(var(--i) * 120ms);
    }
    @keyframes draw {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }
    .patterns {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      column-gap: 16px;
      .list-row {
        margin: 0 -16px;
      }
    }
    @media (max-width: 1000px) {
      .two {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Cheatsheet {
  protected readonly store = inject(LearningStore);
  protected readonly structures = DATA_STRUCTURES;
  protected readonly sorts = SORTS;
  protected readonly limits = LIMITS;
  protected readonly python = PYTHON_OPS;
  protected readonly w = W;
  protected readonly h = H;
  protected readonly pad = PAD;

  protected readonly curves = computed(() => {
    const x = (n: number) => PAD.l + ((n - 1) / (MAX_N - 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) => H - PAD.b - (Math.min(v, MAX_Y) / MAX_Y) * (H - PAD.t - PAD.b);
    const lines = CURVES.map((c) => {
      const pts: [number, number][] = [];
      for (let n = 1; n <= MAX_N; n += 0.25) {
        const v = c.f(n);
        pts.push([x(n), y(v)]);
        if (v >= MAX_Y) break; // leaves the chart at the top
      }
      const [lx, ly] = pts[pts.length - 1];
      return {
        ...c,
        points: pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' '),
        lx,
        ly: Math.max(PAD.t + 8, ly),
      };
    });
    // Labels that end on the right edge can collide (O(1) and O(log n)): keep 13px apart.
    const right = lines.filter((l) => l.lx > W - PAD.r - 1).sort((a, b) => b.ly - a.ly);
    for (let i = 1; i < right.length; i++) {
      right[i].ly = Math.min(right[i].ly, right[i - 1].ly - 13);
    }
    return lines;
  });

  protected pill(complexity: string): string {
    const rank = costRank(complexity);
    return rank <= 1 ? 'strong' : rank >= 4 ? 'outline' : '';
  }
}
