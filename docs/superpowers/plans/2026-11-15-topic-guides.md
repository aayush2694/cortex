# Topic Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a layered written guide (about 1.5 pages) to every one of the 86 topics, fill in
missing key ideas and trusted links, and show the guide on the topic page.

**Architecture:** One Markdown file per topic in `backend/content/guides/`, parsed and validated
at startup by a pure module (`topics/guides.py`), cached, and returned as `guide` on
`GET /topics/{id}`. The frontend splits it into sections and renders each with the existing
`MarkdownPipe` in a new `TopicGuide` component. Content is written in five reviewed batches.

**Tech Stack:** FastAPI, Pydantic v2, pytest; Angular 22 (signals, OnPush), `marked` (already
installed), Vitest; GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-14-topic-guides-design.md`

## Global Constraints

- Sections, in this order: `In short`, `The idea`, `How it works`, `Code`, `Trade-offs`,
  `Common mistakes`, `In interviews`. Required per track exactly as the spec's table says.
- Length: aim for 700–900 words; minimum 600, checked by a test (prose only, code blocks excluded).
- ` ```python run ` blocks run as-is and contain at least one `assert`; ` ```sql run ` blocks run on
  an empty in-memory SQLite database. Every DSA guide has ≥1 python run block; every `sql-*` topic
  has ≥1 sql run block.
- Links live in `topics.yaml` `resources`, 2–4 per topic, hosts only from the allowlist. New hosts
  must be the official docs of a tool the topic covers and are listed in that batch's review.
- Everything in our own words: no text copied from docs or other sites. No filler.
- No database migration: guides are read from files.
- Repo rules from `CLAUDE.md` apply: ruff line 100, mypy strict, 90% coverage floor, OnPush +
  signals, component style budget 6 kB. Commit only when Aayush says so; never push without asking;
  never stage Aayush's `frontend/angular.json` analytics change.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A Python comment like `## step 2` inside a fenced code block must not be read as a section
   heading (backend parser and frontend splitter). Tests in Tasks 1 and 5.
2. A heading with the wrong case or spacing (`## In Short`, `##  Code`) fails startup with an error
   naming the file and the heading, not a silent extra section. Test in Task 1.
3. A run block that never ends (infinite loop) fails its test after 10 s instead of hanging CI.
   Test in Task 4.
4. Raw HTML in a guide (`<script>`, `onerror=`) is not executed on the page. Test in Task 5.
5. Word count ignores code, so a guide padded with a long code block still fails the 600-word
   minimum. Test in Task 1.

---

### Task 1: Guide parser and validator

**Files:**
- Create: `backend/app/modules/topics/guides.py`
- Test: `backend/tests/unit/test_guides.py`

**Interfaces:**
- Produces:
  - `SECTIONS: tuple[str, ...]` (the seven titles, in order)
  - `REQUIRED: dict[Track, frozenset[str]]` (from the spec's table)
  - `MIN_WORDS = 600`
  - `@dataclass(frozen=True) class CodeBlock: lang: str; run: bool; code: str`
  - `@dataclass(frozen=True) class Guide: topic_id: str; markdown: str; sections: tuple[str, ...]; words: int; blocks: tuple[CodeBlock, ...]`
  - `class GuideError(ValueError)`
  - `parse_guide(topic_id: str, text: str) -> Guide`
  - `validate_guide(guide: Guide, track: Track) -> None` (raises `GuideError`; SQL rule applies when `topic_id` starts with `sql-`)

- [ ] **Step 1: Write the failing tests** in `test_guides.py`, using a helper
  `doc(sections: dict[str, str]) -> str` that builds `## Title\n\nbody` text and a `PROSE` string of
  650 words:
  - `test_parses_sections_in_order`: `parse_guide("x", doc(...)).sections == ("In short", "The idea")`
  - `test_hash_comment_in_code_block_is_not_a_heading`: a ` ```python run ` block containing
    `## step 2` → `sections` does not contain `"step 2"`; `blocks[0].run is True`, `lang == "python"`
  - `test_wrong_case_heading_is_rejected`: `## In Short` → `pytest.raises(GuideError, match="x.md.*In Short")`
  - `test_out_of_order_rejected`, `test_duplicate_rejected`, `test_missing_required_for_track`
    (`system-design` guide without `Trade-offs` → error naming `Trade-offs`; the same guide on
    `dsa` without `Trade-offs` passes)
  - `test_words_exclude_code`: 100 words of prose + a 1,000-word code block → `words == 100` and
    `validate_guide` raises `match="600"`
  - `test_dsa_needs_a_python_run_block`, `test_sql_topic_needs_a_sql_run_block` (id `sql-joins`)
  - `test_text_before_first_heading_rejected`

- [ ] **Step 2: Run** `uv run pytest tests/unit/test_guides.py -q`. Expected: FAIL (import error).

- [ ] **Step 3: Implement `guides.py`.** Walk the lines tracking whether you're inside a ``` fence;
  only `## ` lines outside a fence are headings. The fence info string is `lang` plus an optional
  `run` word. Words = whitespace-split tokens outside fences, not counting heading lines.

- [ ] **Step 4: Run** the same command. Expected: PASS. Then `uv run ruff check app tests && uv run mypy app`.

- [ ] **Step 5: Commit** (when Aayush says so): `feat: parse and validate topic guides`.

### Task 2: Link allowlist

**Files:**
- Create: `backend/app/modules/topics/links.py`
- Test: `backend/tests/unit/test_guides.py` (append)

**Interfaces:**
- Produces: `ALLOWED_HOSTS: frozenset[str]` (hosts without `www.`, the spec's list) and
  `is_allowed(url: str) -> bool` (exact host or subdomain match, `www.` stripped).

- [ ] **Step 1: Write the failing tests:** `is_allowed("https://www.postgresql.org/docs/")` is True;
  `is_allowed("https://evil-postgresql.org/")` is False; `is_allowed("https://medium.com/x")` is False;
  `test_every_catalog_link_is_allowed` loads `load_catalog("content")` and asserts every
  `resource.url` passes, printing the offenders.
- [ ] **Step 2: Run**, expect FAIL (import error).
- [ ] **Step 3: Implement `links.py`.**
- [ ] **Step 4: Run**, expect PASS.
- [ ] **Step 5: Commit:** `feat: allowlist hosts for topic links`.

### Task 3: Load guides at startup and serve them

**Files:**
- Modify: `backend/app/modules/topics/guides.py` (add loader)
- Modify: `backend/app/main.py:32-41` (`sync_topics`)
- Modify: `backend/app/modules/topics/schemas.py` (`TopicDetailOut`)
- Modify: `backend/app/modules/topics/service.py` (`detail`)
- Test: `backend/tests/unit/test_guides.py`, `backend/tests/integration/test_api.py`

**Interfaces:**
- Consumes: Task 1's `parse_guide`, `validate_guide`, `GuideError`.
- Produces:
  - `load_guides(content_dir: str | Path, tracks: dict[str, Track]) -> dict[str, Guide]` (reads
    `guides/*.md`; a file whose stem is not in `tracks` raises `GuideError("Unknown topic ...")`;
    missing folder → `{}`)
  - `get_guides() -> dict[str, Guide]` (`@lru_cache`, built from `get_settings().content_dir` and
    the catalog)
  - `TopicDetailOut.guide: str | None = None`

- [ ] **Step 1: Write the failing tests:**
  - unit `test_orphan_guide_file_rejected` (tmp dir with `guides/nope.md`)
  - unit `test_load_guides_without_folder_returns_empty`
  - integration `test_topic_detail_includes_guide`: monkeypatch `get_guides` in the service module
    to return a guide for `binary-search`; `GET /topics/binary-search` → `guide` starts with `## In short`;
    `GET /topics/arrays` → `guide is None`
  - integration: `GET /topics` response topics have no `guide` key
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement.** `sync_topics` calls `get_guides()` after the catalog loads so a bad
  guide stops startup. `detail` sets `guide=get_guides().get(topic_id).markdown` when present.
- [ ] **Step 4: Run** `uv run pytest -q --cov --cov-fail-under=90`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: serve topic guides on the topic detail endpoint`.

### Task 4: Run-block tests and the two sample guides

**Files:**
- Create: `backend/tests/unit/test_guide_content.py`
- Create: `backend/content/guides/binary-search.md`, `backend/content/guides/django-models-orm.md`
- Modify: `backend/content/topics.yaml` (concepts and 2–4 links for these two if missing)

**Interfaces:**
- Consumes: `get_guides()`, `CodeBlock`.
- Produces: `run_python(code: str, timeout: float = 10) -> None` and `run_sql(code: str) -> None`
  test helpers in `test_guide_content.py`.

- [ ] **Step 1: Write the failing tests:**
  - `test_run_python_times_out`: `run_python("while True: pass", timeout=1)` raises `subprocess.TimeoutExpired`
  - `test_run_python_reports_failed_assert`: `run_python("assert 1 == 2")` raises with stderr in the message
  - `test_guide_blocks_run`, parametrized over every `(topic_id, block)` with `block.run`:
    python → `run_python`, sql → `run_sql`; python blocks must contain `"assert"`
  - `test_two_sample_guides_exist`: `{"binary-search", "django-models-orm"} <= set(get_guides())`
- [ ] **Step 2: Run** `uv run pytest tests/unit/test_guide_content.py -q`. Expected: FAIL (helpers and guides missing).
- [ ] **Step 3: Implement the helpers.** `run_python` runs `[sys.executable, "-I", "-c", code]`
  with `timeout`, `capture_output=True`, and fails on a non-zero exit. `run_sql` uses
  `sqlite3.connect(":memory:").executescript(code)`.
- [ ] **Step 4: Write the two guides** to the spec's sections and length (700–900 words). Binary
  Search includes a `python run` block with asserts. Django uses display-only `python` blocks and has
  a `Trade-offs` section.
- [ ] **Step 5: Run** the full backend check from `CLAUDE.md`. Expected: all PASS.
- [ ] **Step 6: Commit:** `content: add sample guides for binary search and Django models`.

### Task 5: Topic guide on the page

**Files:**
- Create: `frontend/src/app/features/topics/guide-format.ts`, `guide-format.spec.ts`
- Create: `frontend/src/app/features/topics/topic-guide.ts`, `topic-guide.spec.ts`
- Modify: `frontend/src/app/core/api/models.ts` (`TopicDetail.guide: string | null`)
- Modify: `frontend/src/app/features/topics/topic-page.ts` (insert `<app-topic-guide>` after the
  header; rename "Docs & references" to "Read more"; the "Key ideas" label is `first` only when
  there is neither a pattern nor a guide)

**Interfaces:**
- Produces:
  - `interface GuideSection { id: string; title: string; body: string }`
  - `splitGuide(markdown: string): GuideSection[]` (`id` = `guide-` + slug of title, e.g.
    `guide-common-mistakes`; `## ` inside fences ignored)
  - `TopicGuide` component, selector `app-topic-guide`, `input.required<string>()` named `guide`

- [ ] **Step 1: Write the failing tests:**
  - `splitGuide('## In short\n\nA\n\n## Code\n\n```python\n## not a heading\n```')` → two
    sections, ids `guide-in-short` and `guide-code`, second body contains `## not a heading`
  - `TopicGuide` renders an "On this page" nav with one link per section (`href="#guide-in-short"`),
    an `h2` per section with the matching id, and the body as HTML (`<code>` present)
  - `TopicGuide` with body `<img src=x onerror="window.__x=1"><script>window.__y=1</script>`:
    no `script` element in the DOM and no `onerror` attribute
- [ ] **Step 2: Run** `npx ng test --watch=false`. Expected: FAIL.
- [ ] **Step 3: Implement.** `TopicGuide` uses `computed(() => splitGuide(this.guide()))` and binds
  each body with `[innerHTML]="s.body | markdown"`. Styles: headings and spacing from the existing
  type tokens; `pre` with `var(--mono)` and `var(--raised)` background; nav as a single wrapping row
  of small links. Keep under the 6 kB style budget.
- [ ] **Step 4: Run** `npx ng test --watch=false && npx ng build`. Expected: PASS, no budget warning.
- [ ] **Step 5: Check it in the browser:** start `cortex-api` and `cortex-web`, open
  `/topics/binary-search` and `/topics/django-models-orm` in light and dark, click an "On this page"
  link, take screenshots. Open `/topics/arrays` and confirm it looks as before.
- [ ] **Step 6: Commit:** `feat: show topic guides on the topic page`.
- [ ] **Step 7: STOP. Aayush reviews the two samples on the real page.** Apply his changes to the
  look and to the writing style before Task 7. Stop the servers.

### Task 6: Link checker and weekly workflow

**Files:**
- Create: `backend/scripts/check_links.py`
- Create: `.github/workflows/links.yml`
- Modify: `CLAUDE.md` (add the command to the commands list)

**Interfaces:**
- Produces: `uv run python scripts/check_links.py` → prints each failing `topic_id  status  url`,
  exits 1 if any fail, 0 otherwise.

- [ ] **Step 1: Implement the script** with `httpx` (already a dependency; check with
  `uv tree | grep httpx`, add as a dev dependency if missing): GET with redirects followed, 15 s
  timeout, a generic `User-Agent: cortex-link-check`, up to 8 requests at once. Status 200 after
  redirects passes; anything else, or a timeout, fails.
- [ ] **Step 2: Run it** from `backend/`. Expected: exit 0, or a short list of real broken links to
  fix in `topics.yaml` in this task.
- [ ] **Step 3: Add `links.yml`:** `on: schedule: cron "0 6 * * 1"` plus `workflow_dispatch`;
  `permissions: contents: read`; same pinned `setup-uv` commit as `ci.yml`; runs the script.
- [ ] **Step 4: Run** `uvx pre-commit run --all-files`. Expected: PASS.
- [ ] **Step 5: Commit:** `ci: check topic links weekly`.

### Tasks 7–11: Content batches

One task per batch, in this order: **7 DSA (35), 8 Languages (9), 9 Frameworks (13), 10 System
design (23), 11 AI (6).** Each batch is the same steps.

**Files:** `backend/content/guides/<id>.md` for every topic in the track; `backend/content/topics.yaml`
(fill `concepts` where empty and bring `resources` to 2–4 allowed links);
`backend/app/modules/topics/links.py` only if a new official host is needed.

- [ ] **Step 1: Write the guides** for the track. Check each against the topic's existing summary,
  concepts, pattern template and practice problems so they agree. Mark any fact you are unsure of and
  check it against the official docs before keeping it.
- [ ] **Step 2: Fill `concepts` and `resources`** for the track's topics.
- [ ] **Step 3: Run** the full backend check (guides validate, every run block passes, links are
  allowed) and `uv run python scripts/check_links.py`. Expected: all PASS, exit 0.
- [ ] **Step 4: STOP. Aayush reviews the batch.** Give him: the list of guides, word counts, any new
  allowed hosts, and anything you were unsure of. Apply his changes.
- [ ] **Step 5: Commit:** `content: add <track> topic guides`.

### Task 12: Every topic has a guide

**Files:**
- Modify: `backend/tests/unit/test_guide_content.py`
- Modify: `README.md`, `CLAUDE.md` (content counts and the guides folder in the folder map)

- [ ] **Step 1: Write the test** `test_every_topic_has_a_guide`: the set of catalog ids equals
  `set(get_guides())`; and `test_every_topic_has_links`: each topic has 2–4 resources and ≥1 concept.
- [ ] **Step 2: Run the full check** from `CLAUDE.md` (backend, frontend, pre-commit). Expected: all PASS.
- [ ] **Step 3: Commit:** `test: require a guide and links for every topic`.
