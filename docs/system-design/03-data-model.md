# 03 — Data Model

One **PostgreSQL** database holds everything. When RAG arrives (Phase 3, not built yet), the **pgvector** extension will add a `vector` column type for embeddings, so search runs in the same database as everything else.

## Entity overview

```mermaid
erDiagram
    USERS ||--o{ PROGRESS : has
    USERS ||--o{ ACTIVITY_EVENTS : logs
    USERS ||--o{ CHAT_SESSIONS : owns
    CHAT_SESSIONS ||--o{ CHAT_MESSAGES : contains
    TOPICS ||--o{ TOPIC_EDGES : "prerequisite of"
    TOPICS ||--o{ PROGRESS : "tracked in"
    TOPICS ||--o{ CHAT_SESSIONS : "about (optional)"
    USERS ||--o{ NOTES : writes
    NOTES ||--o{ NOTE_CHUNKS : "split into"
    USERS ||--o{ REVIEW_CARDS : studies
    TOPICS ||--o{ REVIEW_CARDS : "about"
    USERS ||--o{ JOB_TARGETS : sets
    JOB_TARGETS ||--o{ SKILL_GAPS : produces
    USERS ||--o{ INTERVIEWS : takes
```

## Tables by phase

### Phase 1 — core

**`users`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `external_id` | text unique | Subject ID from Entra ID (null for the dev user) |
| `display_name` | text | |
| `created_at` | timestamptz | |

**`topics`** — the knowledge-map nodes. Loaded from `content/*.yaml` at startup (content lives in git; the table is a cache for querying).
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | Slug, e.g. `binary-search` |
| `track` | text | `dsa` · `languages` · `frameworks` · `ai` · `system-design` |
| `title` | text | |
| `summary` | text | One or two sentences |
| `difficulty` | smallint | 1–5 |
| `visualizer` | text null | Tracer key if the topic has a visualizer, e.g. `binary_search` |
| `phase` | smallint | Roadmap phase where the topic's interactive content ships |
| `resources` | jsonb | Links to official docs, e.g. `[{"label": "Models", "url": "https://docs.djangoproject.com/..."}]` |
| `concepts` | jsonb | Key ideas to learn, one sentence each; also sent to the tutor as context |
| `pattern` | jsonb null | For problem-solving patterns: group, signals, template, walkthrough, LeetCode problems |

**`topic_edges`** — prerequisites (a directed acyclic graph).
| Column | Type | Notes |
|---|---|---|
| `from_topic` | text FK → topics | The prerequisite |
| `to_topic` | text FK → topics | The topic that needs it |
| PK | (`from_topic`, `to_topic`) | |

**`progress`** — one row per user per topic.
| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid FK | |
| `topic_id` | text FK | |
| `status` | text | `not_started` · `learning` · `confident` |
| `mastery` | real | 0.0–1.0, computed by the learning engine |
| `last_activity_at` | timestamptz | |
| PK | (`user_id`, `topic_id`) | |

**`solved_problems`**: LeetCode practice problems you've marked solved (`user_id`, `slug` as the key, `topic_id`, `solved_at`). Each solved problem adds to that pattern's mastery.

**`submissions`**: each time you submit code for a Cortex coding problem (`user_id`, `topic_id`, `problem_id`, `code`, `passed`, `total`, `runtime_ms`, `created_at`). The browser runs the tests in Pyodide and reports the result; a problem counts as solved once one submission passes every case. The problems themselves live in `content/practice.yaml`, not the database.

**`activity_events`** — append-only log; mastery is computed from it.
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `user_id`, `topic_id` | | |
| `kind` | text | `visualizer_completed`, `status_set`, `quiz_answered`, `tutor_question`, ... |
| `payload` | jsonb | Event-specific data (e.g. quiz grade) |
| `created_at` | timestamptz | Indexed with `user_id` |

**`chat_sessions`** / **`chat_messages`**
| Column | Type | Notes |
|---|---|---|
| `chat_sessions.id` | uuid PK | |
| `chat_sessions.user_id` | uuid FK | |
| `chat_sessions.topic_id` | text FK null | Topic the chat was opened from |
| `chat_messages.id` | uuid PK | |
| `chat_messages.session_id` | uuid FK | Indexed |
| `chat_messages.role` | text | `user` · `assistant` |
| `chat_messages.content` | jsonb | Full content blocks as returned by the API (needed to replay history correctly) |
| `chat_messages.input_tokens`, `output_tokens` | int | For cost tracking |
| `chat_messages.created_at` | timestamptz | |

### Phase 3 — notes, RAG, reviews

**`notes`** — Markdown notes written by the user (`id`, `user_id`, `topic_id` null, `title`, `body`, `updated_at`).

**`note_chunks`** — notes split into ~400-token pieces for retrieval.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `note_id` | uuid FK (cascade delete) | |
| `user_id` | uuid | Denormalised so every vector query filters by user cheaply |
| `chunk_index` | int | |
| `text` | text | |
| `embedding` | vector(N) | N depends on the embedding model (see doc 06) |
| `tsv` | tsvector | For keyword search (hybrid retrieval) |

Indexes: HNSW index on `embedding` (cosine), GIN index on `tsv`, b-tree on `user_id`.

**`review_cards`** — spaced-repetition flashcards (`id`, `user_id`, `topic_id`, `front`, `back`, `source` (`generated` · `manual`), `stability`, `difficulty`, `due_at`, `last_review_at`, `reps`, `lapses`). The scheduling fields follow the FSRS algorithm (doc 07).

> **As built** (study tools, before RAG): the tables are simpler than planned above.
>
> - **`flashcards`**: `id`, `user_id`, `topic_id` (null for your own cards), `kind` (`ideas` · `signals` · `template` · `custom`), `front`, `back`, `ease`, `interval_days`, `reps`, `lapses`, `due_at`, `last_reviewed_at`, `created_at`. Scheduling is a simplified SM-2 (doc 07). A partial unique index allows one generated card of each kind per topic.
> - **`card_reviews`**: every grade you gave (`card_id`, `grade`, `reviewed_at`); feeds the heatmap and today's progress.
> - **`notes`**: one Markdown note per topic, keyed by (`user_id`, `topic_id`), with `body` and `updated_at`. No chunks or embeddings yet.
> - **`prep_plans`**: your interview target date and daily goals (`target_date`, `daily_problems`, `daily_cards`).

### Phase 4 — career

**`job_targets`** — a pasted job description and its parsed form (`id`, `user_id`, `title`, `company`, `raw_text`, `parsed` jsonb, `created_at`).

**`skill_gaps`** — one row per required skill per job target (`job_target_id`, `skill`, `topic_ids` text[], `required_level`, `current_level`, `priority`).

**`interviews`** — mock interview sessions (`id`, `user_id`, `kind` (`dsa` · `system_design` · `behavioral`), `transcript` jsonb, `scores` jsonb, `feedback` text, `created_at`).

> **As built** (career tools): `job_targets`, `skill_gaps` and `interviews` are not built yet. What exists:
>
> - **`applications`**: the job board (`company`, `role`, `status` (`wishlist` · `applied` · `interview` · `offer` · `rejected`), `position` within its column, `location`, `url`, `source`, `notes`, `applied_on`, `next_step`, `next_step_on`, and offer pay in lakhs per year: `fixed`, `variable`, `joining_bonus`, `stock_per_year`).
> - **`job_profiles`**: your current CTC, for offer hikes.
> - **`question_notes`**: per interview question, whether you practised it and your own answer. The questions live in `content/interview_questions.yaml`.
> - The resume match stores nothing: it compares two texts against `content/skills.yaml` and returns the result.

## Design notes

- **Content in git, not the database.** Topics are authored as YAML so they are reviewable in pull requests and versioned. On startup the backend syncs YAML → `topics`/`topic_edges`.
- **Event log + derived state.** `activity_events` is the source of truth; `progress.mastery` is a cached result. If the mastery formula changes, recompute it from events.
- **Every user-owned table has `user_id`.** Every query filters by it — this is the main data-isolation guarantee.
- **UUIDs for user-facing IDs** so IDs can't be guessed or counted.
- **Migrations** with Alembic; every schema change is a reviewed migration file.
