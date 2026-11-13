# Cortex

Instructions for any AI model working in this repository. Read all of it before your first edit.

## What this is

Cortex is Aayush's interactive learning and job-switch platform, built as a resume project:
a knowledge map of topics (DSA, languages incl. SQL, Django, AI, system design), animated
algorithm and pattern walkthroughs, coding practice that runs in the browser, study tools
(flashcards, notes, a daily plan), career tools (job board, interview questions, resume match,
offers), an AI tutor, and small developer tools.

It runs locally today. Sign-in and the Azure deployment are not built yet.

## How it's built

- **Backend:** Python 3.13, FastAPI, SQLAlchemy 2 (async, asyncpg), Alembic, Pydantic v2,
  managed with `uv`. A modular monolith: each module is `router → service → repository → models`
  with `schemas.py` for request/response shapes. Pure logic lives in its own file with no I/O
  (`engine.py`, `matcher.py`, `harness.py`, `catalog.py`).
- **Frontend:** Angular 22, zoneless, standalone components, signals. Vitest for unit tests.
- **Database:** PostgreSQL 18 (Homebrew service). Tests use a separate `cortex_test` database.
- **Content is YAML in git**, not database rows: `backend/content/*.yaml`. Topics sync to the
  database on startup; problems, questions and skills are loaded into memory and validated.
- **Code practice runs in the browser.** `frontend/public/pyodide-worker.js` loads Pyodide
  (Python 3.14 in WebAssembly) in a module Web Worker. It judges code with
  `backend/app/modules/practice/harness.py`, served at `GET /api/v1/practice/runtime`. The
  backend tests import that same file to check every reference solution. The server never
  runs user code.
- **AI tutor:** `backend/app/clients/llm.py` is the only code that calls Claude (streaming,
  `claude-opus-5-5`, adaptive thinking, server-side refusal fallback). Each user message is one
  paid call, capped per day.
- **Auth:** `AUTH_MODE=dev` means one local user and no login. Every user-owned table has
  `user_id` and every query filters by it.

## Folder map

```
backend/
  app/
    main.py            app factory, router registration, startup content checks
    models.py          imports every table so Alembic sees them
    core/              config, db session, errors (one JSON error shape), logging, auth
    clients/llm.py     the only Claude caller
    modules/
      topics/          knowledge map, YAML catalogue sync
      progress/        status, mastery engine, recommendations
      visualizer/      tracer.py + tracers/*.py (one frame per step), inputs.py
      practice/        coding problems, harness.py (shared with the browser), submissions
      study/           flashcards (SM-2 engine), notes, daily plan, activity
      jobs/            applications board, question bank, resume matcher
      tutor/           chat sessions, prompts, SSE streaming, daily limit
      users/           user model, data export
  content/             topics.yaml, practice.yaml, interview_questions.yaml, skills.yaml
  alembic/versions/    migrations (auto-generated, not linted)
  tests/unit/          pure logic, no I/O
  tests/integration/   real database, fake Claude (conftest.py has the FakeLLM)
frontend/
  public/pyodide-worker.js
  src/styles.scss      design tokens and shared building blocks
  src/app/
    app.routes.ts      every page is a lazy route
    core/api/          api.ts (all HTTP), models.ts (all API types), tutor-stream.ts
    core/              learning-store.ts, practice/python-runner.ts, theme/
    layout/            sidebar, topbar, nav.ts (the nav list), command palette
    shared/            small reusable pieces
    features/<page>/   one folder per page
docs/system-design/    design docs; "As built" notes mark where the code differs
.github/               ci.yml, codeql.yml, dependabot.yml
```

## Commands

The project path contains a folder named `learnings ` with a **trailing space**. Always quote
paths: `cd "/Users/aayush/Documents/learnings /projects/cortex"`.

One-time setup:

```bash
brew services start postgresql@18
createdb cortex && createdb cortex_test
cd backend && cp .env.example .env && uv sync && uv run alembic upgrade head
cd ../frontend && npm install
```

Run (two terminals; the web app proxies `/api` to port 8000):

```bash
cd backend && uv run fastapi dev app/main.py     # http://localhost:8000/docs
cd frontend && npx ng serve                      # http://localhost:4200
```

Check (these are exactly what CI runs; all must pass):

```bash
cd backend
uv run pytest -q --cov --cov-fail-under=90
uv run ruff check app tests          # not "ruff check ." — alembic/ is auto-generated
uv run ruff format --check app tests
uv run mypy app
uv run alembic check                 # models and migrations agree

cd ../frontend
npx ng test --watch=false
npx ng build                         # must finish with no errors and no warnings

cd .. && uvx pre-commit run --all-files
```

After changing a model: `uv run alembic revision --autogenerate -m "what changed"`, read the
generated file, then `uv run alembic upgrade head`.

## How Aayush wants you to work

- **Ask before UI work, and show a mockup first.** New pages and layout changes need his OK.
- **Explain backend architecture before writing backend code** for anything new.
- **New features get a short design he approves first.** Small, clearly described fixes can
  go ahead. If a request is ambiguous, ask one focused question instead of guessing.
- **Commit or push only when he asks.** Commits go straight to `main`; say what you committed.
- **Never commit his `frontend/angular.json` analytics line.** That file usually has his
  uncommitted `"analytics": ...` change. If you must change `angular.json`, stage only your
  lines and confirm with `git diff --cached frontend/angular.json` before committing.
- **Never put an API key or secret in code.** Keys live only in `backend/.env` (gitignored).
  He adds them himself.
- **Stop the servers and Postgres when you finish** (`brew services stop postgresql@18`),
  unless he asked you to leave them running.
- **Keep docs short.** Report in plain language: outcome first, then what you checked, then
  what you did not check.

## Coding rules

Backend:

- Follow the layers. Routers only parse, call a service and return. Services hold the logic.
  Repositories hold the SQL. Nothing but `clients/llm.py` talks to Claude.
- Raise `AppError` subclasses from `core/errors.py` with a `code`; never return ad hoc error
  JSON. Every error looks like `{"error": {"code", "message", "request_id", "details"?}}`.
- Type everything; `mypy --strict` must pass. Lines are 100 characters at most.
- Adding a module means four registrations: the router in `app/main.py`, the models in
  `app/models.py`, the tables in the `TRUNCATE` list in `tests/integration/conftest.py`, and
  (for user data) the table in `SECTIONS` in `modules/users/export.py`.
- `practice/harness.py` uses the standard library only and imports nothing from `app`. It
  also runs in Pyodide, whose SQLite is 3.39: no SQL features newer than that.
- Visualizer frames are snapshots. Copy every mutable value you put into `t.frame(...)`.

Frontend:

- Standalone components, `ChangeDetectionStrategy.OnPush`, signals, `input()` / `output()` /
  `model()`, `inject()`, `@if` / `@for`. Don't write NgModules (importing Angular's own
  `FormsModule` into a component is fine) and don't use constructor injection.
- Reads use `httpResource` in `core/api/api.ts`; writes use `HttpClient` wrapped in
  `firstValueFrom`. Components never call `fetch` or build URLs themselves.
- All API types live in `core/api/models.ts` and mirror the backend schemas.
- No `any`. Visualizer views declare a state interface and read it through `stateOf<T>()`
  in `features/visualizer/views/view-state.ts`.
- A new page needs a lazy route in `app.routes.ts` and an entry in `layout/nav.ts` (the
  command palette reads the nav list).
- Put pure logic in a plain `.ts` file next to the component and test that file.
- When a component grows past roughly 300 lines, split a self-contained section into its own
  component, as `features/topics/` does.

Tests:

- Write the failing test first, watch it fail for the right reason, then write the code.
  A test that passes on its first run has proved nothing: break the assertion once to check.
- Every content item is checked by tests: each practice problem's reference solution must pass
  every case and its starter must fail at least one.
- Integration tests use the real database and `FakeLLM`. Never call the real Claude API in tests.

## Design rules

- **Monochrome, Apple-style.** Black, white and greys only. Meaning comes from brightness and
  shape, never hue. Light, Dark and Auto must all work.
- **Use the tokens in `src/styles.scss`**, never raw hex values in components: `--bg`,
  `--surface`, `--raised`, `--text`, `--text-2`, `--tone-1..5`, `--heat-1..4`, `--radius`,
  `--ease`.
- **`--text-3` is for decoration only** (chevrons, rules). Words use `--text` or `--text-2`.
  Text needs 4.5:1 contrast and meaningful graphics 3:1, in both themes. Measure it.
- **No text below 12px.**
- **Reuse the building blocks** in `styles.scss`: `.page`, `.page-head`, `.card`, `.list`,
  `.list-row`, `.tile`, `.btn`, `.pill`, `.segmented`, `.input`, `.group-label`, `.stat`,
  `.skeleton`, and the shared `rise` animation. Add a shared class there before copying
  styles into a second component.
- **No inline `style="..."`** except skeleton heights. Component styles stay under the 6 kB
  warning; if you hit it, share styles or split the component. Do not dodge it.
- Every page has a loading state (skeleton), an empty state that says what to do next, and a
  readable error. Icon-only buttons have an `aria-label`. Everything works with the keyboard
  and shows focus. Nothing scrolls sideways at 375px.
- Destructive actions use a second click to confirm ("Delete" then "Delete for good?").
- Copy is sentence case, plain and short. Say what happened and what to do; never show raw
  exception text.

## Mistakes a weaker model makes here, and how to avoid each

1. **Unquoted project path.** The trailing space in `learnings ` breaks commands. Quote it.
2. **Trusting a hidden exit code.** `cmd | tail -1` and `cmd | grep ...` report the pipe's
   status, not the command's. When the exit code matters, run the command without a pipe.
3. **`ruff check .`** fails on generated migrations. Use `ruff check app tests`.
4. **Unquoted globs in zsh.** Write `grep --include='*.ts'`, with quotes.
5. **GNU `sed -i`.** This is macOS: `sed -i '' ...`. Prefer a short Python script for
   multi-line edits, and assert the old text exists before replacing it.
6. **YAML plain strings containing `: `.** `- Compare with: x` becomes a mapping. Quote any
   hint, question or title that has a colon followed by a space.
7. **Hand-written expected values.** Do not type expected outputs from memory. Compute them
   from the reference solution, read each one, and let the tests confirm.
8. **Copying LeetCode text.** Problem statements must be original. LeetCode problems are only
   linked by slug.
9. **Shared mutable state in visualizer frames.** Frames then all show the final state. Copy.
10. **Loading Pyodide with `importScripts`.** It fails; the worker must be a module worker that
    uses `import()`.
11. **Server dates for "today".** The server is UTC and Aayush is in India. Send the browser's
    local date (`todayLocal()`) or time zone (`tz` query parameter) for anything about days.
12. **Reading a row after changing it in the same request.** SQLAlchemy autoflushes, so a
    "max position in the target column" query counts the row you just moved. Query first.
13. **Coverage looks low on async code.** Keep `concurrency = ["greenlet", "thread"]`.
14. **Forgetting a registration** when adding a table or page (see Coding rules). Symptoms:
    Alembic sees no change, tests leak data between cases, or the page 404s.
15. **Stale docs treated as truth.** `docs/system-design` describes the target; "As built"
    notes and the code win. `backend/README.md` still says `ruff check .`; trust this file.
16. **Claude API from memory.** `claude-opus-5-5` cannot disable thinking and rejects
    `budget_tokens`; `max_tokens` includes thinking, so do not lower it to save money. Never
    quote prices or model details from memory. Model choice is Aayush's decision.
17. **Checking the tutor limit after calling Claude.** The limit counts user messages and is
    checked before anything is saved or sent.
18. **Circular imports between a component and its child.** Move shared helpers to their own
    file (see `features/practice/practice-format.ts`).
19. **Browser tests fighting the dev server.** `ng serve` reloads the page when you edit a
    file, cutting off a running check. Finish edits, then test. Use a background tab, remove
    any data you created, and never leave your test values in his database or `localStorage`.
20. **`gh run list --commit`** needs the full SHA, not the short one.
21. **Building more than was asked.** No speculative options, abstractions or extra features.
    Every changed line should trace to the request. Mention unrelated problems; do not fix
    them unasked.
22. **Saying "done" without evidence.** See the checklist.

## Before you say a task is done

- [ ] The request is fully covered. Re-read it and list anything you skipped.
- [ ] New behaviour has a test that you watched fail first.
- [ ] Backend: `pytest` with coverage, `ruff check app tests`, `ruff format --check app tests`,
      `mypy app`, and `alembic check` all pass, run fresh after your last edit.
- [ ] Frontend: `ng test --watch=false` passes and `ng build` shows no errors or warnings.
- [ ] `uvx pre-commit run --all-files` exits 0.
- [ ] A model changed? There is a migration, and it was applied.
- [ ] UI changed? You used it in the browser in dark and light mode and at phone width, or you
      say plainly that you did not.
- [ ] Colours or sizes changed? Contrast measured; nothing below 12px.
- [ ] Test data you created is deleted. Servers and Postgres are stopped unless he wants them.
- [ ] `git status` shows only files that belong to this task, and `frontend/angular.json`'s
      analytics line is not staged.
- [ ] Nothing is committed or pushed unless he asked. If he did, CI and CodeQL passed.
- [ ] Your report states what changed, how you checked it, and what you did not verify.

## Open work (as of 2026-11-13)

- **Sign-in:** design in progress, not built. Decided so far: GitHub and Google, anyone can
  sign up, the AI tutor is invite-only, the API issues its own access and refresh tokens, and
  the live site starts with empty data. It needs a written spec and his approval before code.
- **Azure deployment:** waiting for his Azure account.
- **Design cleanup:** a type scale, fewer corner radii and breakpoints, a shorter sidebar.
