# Deploy sign-in

Do these in order. Never paste secret values into git or chat.

1. **GitHub OAuth App.** GitHub > Settings > Developer settings > OAuth Apps > New.
   - Homepage URL: the Cloudflare site URL.
   - Authorization callback URL: `<site URL>/api/v1/auth/github/callback`.
   - Copy the client ID and generate a client secret.
   - For local testing, make a second app with `http://localhost:4200` and
     `http://localhost:4200/api/v1/auth/github/callback`.
2. **Render environment variables** (API service):
   - `AUTH_MODE=jwt`
   - `JWT_SECRET`: run `python -c "import secrets; print(secrets.token_urlsafe(48))"`
   - `FRONTEND_URL`: the Cloudflare site, no trailing slash
   - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
   - `TUTOR_INVITED_EMAILS`: comma-separated emails allowed to use the tutor
   - Google later: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (redirect URI
     `<site URL>/api/v1/auth/google/callback`)
3. **Migrate the database.** Run `alembic upgrade head` from `backend/`, either as Render's
   pre-deploy command or once in the Render shell. The API refuses to start in jwt mode without
   `JWT_SECRET` (at least 32 bytes), `FRONTEND_URL` and one full provider.
4. **Old data is not migrated.** The shared "dev user" data is left behind; the live site
   starts empty.
5. **Deploy the frontend:** `cd frontend && npx ng build && npx wrangler deploy`.
6. **Verify.** Open the site, sign in with GitHub, create a note, sign out, sign back in and see
   it. Open a private window, sign in as someone else (or not at all) and confirm the note is
   not visible.

## Notes

- Uvicorn's access log prints the OAuth callback query (provider code and state). It is single
  use and useless without the client secret and PKCE verifier, but consider `--no-access-log`
  in the Render start command.
- Render free-tier cold starts can exceed the frontend's 8-second timeout, so the first visit
  may show "Can't reach Cortex" with a Try again button.
