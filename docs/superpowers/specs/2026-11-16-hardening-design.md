# Hardening: rate limits, error logs, end-to-end tests, README

Approved by Aayush on 2026-11-16. He chose error logs over a Sentry dashboard.

## Why

Cortex is live with real sign-ins. Nothing stops a client from hammering the API, an error
in production is easy to miss, no test walks a full user journey, and the README does not
show the product.

## Approaches considered

- **Rate limiting:** `slowapi` (extra dependency, awkward with our async user lookup and
  injected clock) versus a small in-process limiter of our own. Chosen: our own. One Render
  instance, so in-memory counters are correct; they reset on restart and are not shared
  between instances, which is acceptable now.
- **Error tracking:** Sentry versus logs. Chosen: logs only, read in Render.
- **End-to-end tests:** Playwright against the local app in dev mode (no sign-in) versus
  against the live site. Chosen: local, so CI needs no secrets and touches no real data.

## Rate limiting

- A FastAPI dependency in `app/core/rate_limit.py`, using the existing clock dependency.
- Key: the signed-in user's id (not on sign-in routes, which always key by IP); otherwise the
  client IP. IPv6 addresses are keyed on their /64 network; an address that does not parse is
  used as it is.
- **Per-IP limits apply only when `PROXY_SHARED_SECRET` is set.** Without it, every visitor
  through the Cloudflare Worker has the same peer address, so one shared bucket would let a
  single client lock everyone out of sign-in. So without the secret, requests that would be
  keyed by IP are not limited at all; signed-in users are still limited on other routes. The
  API logs one WARNING at startup while the secret is missing.
- Limits (settings, per minute): default 120; sign-in routes (`/api/v1/auth/*` except
  `GET /api/v1/auth/providers`, a config read in the default group) 20 per IP; tutor message
  routes 10 per user. `/health` is not limited.
- Fixed one-minute windows: a client can send up to about twice the limit in a burst that
  spans the end of one window and the start of the next.
- Over the limit: `429`, code `rate_limited`, the standard error envelope, `Retry-After`.
- Client IP (with the secret set): the API is behind the Cloudflare Worker and Render's
  proxy. A request carrying `X-Proxy-Secret` equal to `PROXY_SHARED_SECRET` (constant-time
  compare) is keyed by the Worker's `X-Client-IP`. A request without it (someone calling
  Render directly) is keyed by the peer address Render reports (the rightmost
  `X-Forwarded-For` entry), never a client-supplied value.
- `frontend/worker.js` forwards `CF-Connecting-IP` as `X-Client-IP` (and removes a
  client-sent one), adds the secret when the Worker has one, strips a client-sent secret, and
  never follows redirects (`redirect: 'manual'`), so the secret cannot reach another host.
- The secret is recommended: per-IP limits stay off without it.
- Old buckets are dropped so memory stays bounded.

## Error logs

- Every unhandled exception is logged once at ERROR with traceback, request id, method,
  path, status and user id (when known). The response keeps the existing envelope with the
  request id, so a user report can be matched to a log line.
- 4xx responses log at WARNING without traceback; `429` includes which limit was hit.
- Never log tokens, cookies, emails, request bodies or query strings. The database engine
  uses `hide_parameters=True`, so a database error never shows statement values.
- A client's `x-request-id` is kept only if it matches `[A-Za-z0-9-]{1,64}`; otherwise the
  API makes its own.

## End-to-end tests

- Playwright in `frontend/e2e/`, Chromium only.
- Journey (dev mode): the map loads, a topic opens and shows its guide, a practice question
  can be answered and gets feedback, progress reflects it.
- Sign-in mode: the app redirects to the sign-in page and the API answers 401 without a
  token. Real GitHub sign-in is not automated.
- A new `e2e` job in `.github/workflows/ci.yml` starts Postgres, the API and the built
  frontend, then runs the tests.

## README

- Live link at the top, three or four screenshots in `docs/screenshots/` taken with
  Playwright from the local app, and a line each on rate limiting and end-to-end tests.
  Keep it short.

## Not included

Sentry, frontend error reporting, a shared (Redis) limiter, Google or LinkedIn sign-in.
