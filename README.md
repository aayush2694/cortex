# Cortex

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

Roadmap: [aayush2694/cortex-roadmap](https://github.com/aayush2694/cortex-roadmap)
