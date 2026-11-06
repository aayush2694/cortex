import { ChangeDetectionStrategy, Component } from '@angular/core';

type PhaseStatus = 'done' | 'active' | 'next';

interface Phase {
  n: number;
  name: string;
  outcome: string;
  status: PhaseStatus;
  items: string[];
}

// Mirrors https://github.com/aayush2694/cortex-roadmap
const PHASES: Phase[] = [
  {
    n: 0,
    name: 'Foundations',
    outcome: 'Design docs, dev setup, project structure',
    status: 'done',
    items: ['System design docs', 'Dev tools installed', 'Local PostgreSQL'],
  },
  {
    n: 1,
    name: 'MVP',
    outcome: 'Knowledge map, DSA visualizer, AI tutor',
    status: 'active',
    items: ['FastAPI backend', '7 algorithm visualizers', 'Streaming AI tutor', 'Angular app with themes'],
  },
  {
    n: 2,
    name: 'Go live on Azure',
    outcome: 'Public URL, CI/CD, login, monitoring',
    status: 'next',
    items: ['Static Web Apps + Container Apps', 'PostgreSQL on Azure', 'Entra ID sign-in', 'Bicep + GitHub Actions'],
  },
  {
    n: 3,
    name: 'Practice',
    outcome: 'Notes + RAG, spaced repetition, code sandbox',
    status: 'next',
    items: ['Notes with hybrid search', 'FSRS flashcards', 'Python in the browser', 'System design playground'],
  },
  {
    n: 4,
    name: 'Job switch',
    outcome: 'Gap analysis, mock interviews, readiness',
    status: 'next',
    items: ['Job description analysis', 'Personal study plan', 'AI mock interviewer', 'Readiness score'],
  },
  {
    n: 5,
    name: 'AI lab + MCP',
    outcome: 'Interactive AI explainers, MCP server',
    status: 'next',
    items: ['Tokens, embeddings, attention', 'MCP server for Claude Desktop'],
  },
  {
    n: 6,
    name: 'Polish and launch',
    outcome: 'Demo, performance, accessibility, v1.0',
    status: 'next',
    items: ['Demo GIFs + live link', 'Performance pass', 'v1.0 release'],
  },
];

@Component({
  selector: 'app-roadmap',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page narrow">
      <header class="page-head">
        <div>
          <h1>Roadmap</h1>
          <p>How Cortex grows, one shippable phase at a time.</p>
        </div>
        <a class="btn" href="https://github.com/aayush2694/cortex-roadmap" target="_blank" rel="noopener">
          <i class="ti ti-brand-github"></i>On GitHub
        </a>
      </header>
      <ol class="timeline">
        @for (p of phases; track p.n) {
          <li class="phase {{ p.status }}">
            <span class="node" aria-hidden="true">
              @if (p.status === 'done') { <i class="ti ti-check"></i> } @else { {{ p.n }} }
            </span>
            <div class="card">
              <div class="top">
                <h2>Phase {{ p.n }} · {{ p.name }}</h2>
                <span class="pill" [class.strong]="p.status === 'done'" [class.outline]="p.status === 'active'">
                  {{ p.status === 'done' ? 'Done' : p.status === 'active' ? 'In progress' : 'Planned' }}
                </span>
              </div>
              <p class="muted">{{ p.outcome }}</p>
              <ul>
                @for (item of p.items; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            </div>
          </li>
        }
      </ol>
    </div>
  `,
  styles: `
    .narrow {
      max-width: 820px;
    }
    .timeline {
      list-style: none;
      margin: 0;
      padding: 0;
      position: relative;
      &::before {
        content: '';
        position: absolute;
        left: 15px;
        top: 8px;
        bottom: 8px;
        width: 2px;
        background: var(--raised);
      }
    }
    .phase {
      position: relative;
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
      .card {
        flex: 1;
      }
    }
    .node {
      position: relative;
      z-index: 1;
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border-radius: 50%;
      border: 2px solid var(--border-strong);
      background: var(--bg);
      color: var(--text-2);
      font: 600 13px var(--font);
    }
    .done .node {
      border-color: var(--text);
      background: var(--text);
      color: var(--bg);
    }
    .active .node {
      border-color: var(--text);
      color: var(--text);
    }
    .active .card {
      box-shadow: inset 0 0 0 1.5px var(--text);
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 4px;
    }
    ul {
      margin: 10px 0 0;
      padding-left: 18px;
      color: var(--text-2);
      font-size: 13px;
      li {
        margin: 2px 0;
      }
    }
  `,
})
export class Roadmap {
  protected readonly phases = PHASES;
}
