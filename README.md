# Cortex

[![CI](https://github.com/aayush2694/cortex/actions/workflows/ci.yml/badge.svg)](https://github.com/aayush2694/cortex/actions/workflows/ci.yml)
[![CodeQL](https://github.com/aayush2694/cortex/actions/workflows/codeql.yml/badge.svg)](https://github.com/aayush2694/cortex/actions/workflows/codeql.yml)

An interactive learning platform for switching jobs in tech: DSA, programming languages,
frameworks (Django), AI and system design. Every concept is something you can play with, and
an AI tutor knows what you've learned.

**Stack:** Angular 22 · Python FastAPI · PostgreSQL 18 · Claude API · (Azure, Phase 2)

## What's in it

- **Knowledge map:** 86 topics across 5 tracks (DSA, languages incl. SQL, Django, AI, system
  design), linked by prerequisites and shaded by your mastery
- **DSA patterns:** 18 patterns, each with an animated walkthrough, a template and 95 LeetCode
  problems to tick off; plus 7 classic algorithms in the step-by-step visualizer
- **Practice:** 50 coding problems (36 Python, 14 SQL) that run in your browser via Pyodide,
  with hidden tests, hints and solutions
- **Study tools:** a daily plan, spaced-repetition flashcards, notes on every topic, an
  activity heatmap and a Big-O cheat sheet
- **Career tools:** a job application board, 54 interview questions for a Python/Django/Angular
  role, a resume-to-job match and an offer comparison
- **AI tutor:** streaming chat that knows the topic and your progress, hints first, with a
  daily message limit
- **Developer tools:** JSON, regex, JWT, Base64/URL, timestamps and hashes, all in the browser
- Monochrome Light / Dark / Auto design · ⌘K search everywhere · download all your data

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
