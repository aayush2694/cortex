# Cortex

[![CI](https://github.com/aayush2694/cortex/actions/workflows/ci.yml/badge.svg)](https://github.com/aayush2694/cortex/actions/workflows/ci.yml)
[![CodeQL](https://github.com/aayush2694/cortex/actions/workflows/codeql.yml/badge.svg)](https://github.com/aayush2694/cortex/actions/workflows/codeql.yml)

An interactive learning platform for switching jobs in tech: DSA, programming languages,
frameworks (Django), AI and system design. Every concept is something you can play with, and
an AI tutor knows what you've learned.

**Stack:** Angular 22 · Python FastAPI · PostgreSQL + pgvector · Claude API · (Azure, Phase 2)

## What's in Phase 1

- **Knowledge map:** 46 topics across 5 tracks, linked by prerequisites, coloured by your mastery
- **DSA visualizer:** 7 algorithms run as real Python and play back step by step, with the
  current code line highlighted
- **AI tutor:** streaming chat that knows the topic and your progress, hints first
- **5 themes:** Midnight, Graphite, Ocean, Ember, Daylight · ⌘K search everywhere

## Repo layout

```
backend/    FastAPI app, tests, migrations, topic catalogue  → backend/README.md
frontend/   Angular app                                       → frontend/README.md
docs/       system design documents                           → docs/system-design/README.md
```

## Run locally

```bash
brew services start postgresql@18
cd backend && cp .env.example .env && uv sync && uv run alembic upgrade head
uv run fastapi dev app/main.py           # API on :8000
cd ../frontend && npm install && npx ng serve   # app on :4200
```

## Quality checks

- **CI** runs lint, types, backend tests (coverage must stay at or above 90%), frontend unit
  tests and a production build on every push and pull request.
- **CodeQL** scans the Python and TypeScript code for security issues every week.
- **Dependabot** opens grouped pull requests for dependency updates every Monday.
- **Pre-commit hooks** run ruff, secret scanning (gitleaks) and file checks before each commit:

```bash
uvx pre-commit install          # once
cd frontend && npx ng test      # frontend unit tests
cd backend && uv run pytest --cov   # backend tests with coverage
```

Roadmap: [aayush2694/cortex-roadmap](https://github.com/aayush2694/cortex-roadmap)
