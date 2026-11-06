# Cortex — Backend

FastAPI + PostgreSQL. Design: [`../docs/system-design/02-backend-architecture.md`](../docs/system-design/02-backend-architecture.md).

## Run it

```bash
brew services start postgresql@18   # database (once per boot)
cp .env.example .env                # then fill in your values
uv sync                             # install dependencies
uv run alembic upgrade head         # create/update tables
uv run fastapi dev app/main.py      # http://localhost:8000/docs
```

Add `ANTHROPIC_API_KEY=...` to `.env` to turn on the AI tutor.

## Check it

```bash
uv run pytest            # tests (uses the cortex_test database)
uv run ruff check .      # lint
uv run ruff format .     # format
uv run mypy app          # type check
```

## Layout

```
app/
  core/        config, database, errors, logging, auth
  clients/     llm.py — the only code that calls Claude
  modules/     topics · progress · visualizer · tutor
               (each: router → service → repository → models)
content/       topics.yaml — the knowledge map
alembic/       database migrations
tests/         unit/ (no I/O) · integration/ (real DB, fake AI)
```

## Add an algorithm to the visualizer

1. Write `SOURCE` (clean code) and `run_<name>(inp, t)` in `app/modules/visualizer/tracers/`, calling `t.frame(...)` at each step.
2. `register(AlgorithmSpec(...))` it and point a topic in `content/topics.yaml` at it with `visualizer: <key>`.
3. Add a correctness test in `tests/unit/test_tracers.py`.
