# 04 — API Design

REST over HTTPS, JSON bodies, versioned under `/api/v1`. FastAPI generates an OpenAPI spec automatically; the Angular app generates its TypeScript client from that spec, so frontend and backend types never drift.

## Conventions

| Rule | Example |
|---|---|
| Plural nouns for collections | `/topics`, `/notes` |
| IDs in the path | `/topics/binary-search` |
| Filters as query params | `/topics?track=dsa` |
| `GET` reads, `POST` creates or runs, `PUT` replaces, `PATCH` updates part, `DELETE` removes | |
| Timestamps in ISO 8601 UTC | `2026-11-06T10:15:00Z` |
| Errors use one shape | `{"error": {"code", "message", "request_id"}}` |
| Pagination via cursor | `?limit=20&cursor=...` → `{"items": [...], "next_cursor": "..."}` |

## Endpoints

### Phase 1

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check (no auth) |
| `GET` | `/api/v1/me` | Current user |
| `GET` | `/api/v1/topics` | All topics + edges (the knowledge map) |
| `GET` | `/api/v1/topics/{id}` | One topic with prerequisites and next topics |
| `GET` | `/api/v1/progress` | Your status + mastery for every topic |
| `PUT` | `/api/v1/progress/{topic_id}` | Set your status for a topic |
| `GET` | `/api/v1/progress/next` | Recommended next topics |
| `POST` | `/api/v1/progress/{topic_id}/events` | Record activity (e.g. `visualizer_completed`) |
| `GET` | `/api/v1/tutor/sessions` | Your recent chats |
| `GET` | `/api/v1/visualizer/algorithms` | Available algorithms + their source code |
| `POST` | `/api/v1/visualizer/{algorithm}/trace` | Run an algorithm on given input, return frames |
| `POST` | `/api/v1/tutor/sessions` | Start a chat (optionally about a topic) |
| `GET` | `/api/v1/tutor/sessions/{id}` | Chat history |
| `POST` | `/api/v1/tutor/sessions/{id}/messages` | Send a message — **streams** the reply (SSE) |

### Phase 3

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/api/v1/notes` | List / create notes |
| `GET/PUT/DELETE` | `/api/v1/notes/{id}` | Read / update / delete a note |
| `POST` | `/api/v1/search` | Search your notes (hybrid retrieval) |
| `GET` | `/api/v1/reviews/due` | Cards due now |
| `POST` | `/api/v1/reviews/{card_id}/grade` | Grade a card (again / hard / good / easy) |
| `POST` | `/api/v1/reviews/generate` | Generate cards for a topic with AI |
| `POST` | `/api/v1/simulator/run` | Simulate a system design under load |
| `POST` | `/api/v1/simulator/review` | AI review of a design |

### Phase 4

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/career/targets` | Paste a job description → parsed target |
| `GET` | `/api/v1/career/targets/{id}/gaps` | Gap analysis vs your mastery |
| `GET` | `/api/v1/career/targets/{id}/plan` | Personal study plan |
| `POST` | `/api/v1/interviews` | Start a mock interview |
| `POST` | `/api/v1/interviews/{id}/messages` | Answer — streams the interviewer (SSE) |
| `POST` | `/api/v1/interviews/{id}/finish` | End and get a scored report |
| `GET` | `/api/v1/career/readiness` | Readiness score per target role |

## Example: trace an algorithm

```http
POST /api/v1/visualizer/binary_search/trace
Content-Type: application/json

{ "input": { "array": [2, 5, 8, 12, 16, 23, 38], "target": 23 } }
```

```json
{
  "algorithm": "binary_search",
  "view": "array",
  "source": ["def binary_search(arr, target):", "    lo, hi = 0, len(arr) - 1", "..."],
  "frames": [
    { "line": 1, "state": { "array": [2,5,8,12,16,23,38], "lo": 0, "hi": 6 }, "highlight": [], "message": "Search the whole array" },
    { "line": 3, "state": { "array": [2,5,8,12,16,23,38], "lo": 0, "hi": 6, "mid": 3 }, "highlight": [3], "message": "Middle is 12" },
    { "line": 6, "state": { "array": [2,5,8,12,16,23,38], "lo": 4, "hi": 6 }, "highlight": [], "message": "23 > 12, search the right half" }
  ],
  "result": { "found": true, "index": 5 },
  "stats": { "comparisons": 2, "steps": 6 }
}
```

## Example: tutor message (streamed)

```http
POST /api/v1/tutor/sessions/7f2c.../messages
Content-Type: application/json
Accept: text/event-stream

{ "text": "Why is binary search O(log n)?" }
```

```
event: delta
data: {"text": "Good question. What happens to the size of the range"}

event: delta
data: {"text": " after each comparison?"}

event: done
data: {"message_id": "a91e...", "stop_reason": "end_turn"}
```

Possible terminal events: `done`, `refused` (the model declined; the UI shows a polite message), `error` (with the standard error object).

## Status codes

| Code | When |
|---|---|
| 200 / 201 | Success / created |
| 400 | Malformed input |
| 401 | Not signed in |
| 403 | Signed in, but not your resource |
| 404 | Resource doesn't exist (or isn't yours — we don't reveal which) |
| 409 | Conflict (e.g. duplicate) |
| 422 | Valid JSON but fails validation (FastAPI default) |
| 429 | Rate limit hit — `Retry-After` header included |
| 503 | AI provider unavailable — retry later |

## Rate limits

AI endpoints cost money, so they have per-user limits (e.g. 30 tutor messages/hour for demo users, higher for the owner). Limits are enforced in the backend with a token bucket stored in Postgres (Phase 2), moving to Redis only if needed.
