# Deploy sign-in

Do these in order. Never paste secret values into git or chat.

1. **GitHub OAuth App.** GitHub > Settings > Developer settings > OAuth Apps > New.
   - Homepage URL: the Cloudflare site URL.
   - Authorization callback URL: `<site URL>/api/v1/auth/github/callback`.
   - Copy the client ID and generate a client secret.
   - For local testing, make a second app with `http://localhost:4200` and
     `http://localhost:4200/api/v1/auth/github/callback`.
2. **Render environment variables** (API service):
   - `ENVIRONMENT=prod`: the API then refuses to start unless `AUTH_MODE=jwt`
   - `AUTH_MODE=jwt`
   - `JWT_SECRET`: run `python -c "import secrets; print(secrets.token_urlsafe(48))"`
   - `FRONTEND_URL`: the Cloudflare site, no trailing slash
   - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
   - `TUTOR_INVITED_EMAILS`: comma-separated emails allowed to use the tutor
   - Google later: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (redirect URI
     `<site URL>/api/v1/auth/google/callback`)
3. **Migrate the database.** Run `alembic upgrade head` from `backend/`, either as Render's
   pre-deploy command or once in the Render shell. The API refuses to start in jwt mode without
   `JWT_SECRET` (at least 32 bytes), `FRONTEND_URL` and one full provider, and with
   `ENVIRONMENT=prod` it refuses `AUTH_MODE=dev`.
4. **Old data is not migrated.** The shared "dev user" data is left behind; the live site
   starts empty.
5. **Deploy the frontend:** `cd frontend && npx ng build && npx wrangler deploy`.
6. **Verify.** Open the site, sign in with GitHub, create a note, sign out, sign back in and see
   it. Open a private window, sign in as someone else (or not at all) and confirm the note is
   not visible.

## Rate limits and the proxy secret (recommended)

The API limits requests per minute (120 general, 20 sign-in per IP, 10 tutor messages per user).
**Per-IP limits stay off without the proxy secret.** Every visitor through the Worker reaches the
API from the same address, so one shared bucket would let a single client lock everyone out;
instead, without the secret, anonymous requests and all sign-in routes are not limited at all
(signed-in users are still limited elsewhere), and the API logs a warning at startup. To turn
per-IP limits on, set one random value in both places:

- Render: `PROXY_SHARED_SECRET` (e.g. `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
- Cloudflare: `cd frontend && npx wrangler secret put PROXY_SHARED_SECRET`

With the secret set, the API keys requests from the Worker by the visitor's address and
requests that skip the Worker by the address Render saw. Without it, the API ignores the
Worker's `X-Client-IP` header.

## Notes

- Uvicorn's access log prints the OAuth callback query (provider code and state). It is single
  use and useless without the client secret and PKCE verifier, but consider `--no-access-log`
  in the Render start command.
- Render free-tier cold starts take about 30-60 seconds. After 3 seconds the app shows
  "Waking up the server…"; it waits up to 60 seconds before showing "Can't reach Cortex" with a
  Try again button.
- Sign-in sets a short-lived `cortex_login` cookie (HttpOnly, path `/api/v1/auth`) that ties the
  sign-in to the browser that started it. This needs the site and API on one origin, which the
  Cloudflare Worker's `/api/*` forwarding provides.
