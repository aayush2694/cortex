# Sign-in design

Status: approved by Aayush on 2026-11-15, including the sign-in page mockup shown in chat.

## Decisions

| Question | Decision |
|---|---|
| Who uses the live site | Aayush and other people |
| How people sign in | GitHub and Google (OAuth) only |
| Who can sign up | Anyone; the AI tutor is invite-only |
| Existing local data | Not migrated; the live site starts empty |
| Session approach | The API issues its own tokens (option B) |
| Server-side checking of practice results | Not needed: no leaderboards or public profiles |
| Launch order | GitHub live first; Google built and tested, enabled once its client exists |
| Hosting | Frontend on Cloudflare Workers; a Worker forwards `/api/*` to the API on Render, so the site and API share one origin |

### Hosting notes

- `FRONTEND_URL` is the Cloudflare site. OAuth callbacks are
  `{FRONTEND_URL}/api/v1/auth/{provider}/callback`; the Worker forwards them to Render, so
  provider settings only ever name the public site.
- A provider whose client ID and secret are not configured is reported as unavailable by
  `GET /api/v1/auth/providers`, and the sign-in page hides its button. The API starts in
  `AUTH_MODE=jwt` with at least one provider configured.

### Sign-in page

One centred card: the Cortex logo, "Sign in to Cortex", one line explaining that signing in
creates the account and keeps data private, "Continue with GitHub" (primary) and "Continue with
Google" buttons, and a small note that the tutor is invite-only and which profile fields are read.
After sign-in, the sidebar footer shows the user's avatar or initials, name, and "Sign out".

## 1. Flow

1. `GET /api/v1/auth/{provider}/start` creates an `oauth_states` row (random `state`, PKCE
   verifier where the provider supports PKCE, expires in 10 minutes) and redirects to the
   provider's authorize URL.
2. `GET /api/v1/auth/{provider}/callback` checks and consumes the state, exchanges the code for
   the provider's token using the client secret, reads the profile (provider user id, email,
   whether the email is verified, name, avatar), then finds or creates the user (rules in 2).
3. The API creates a `login_codes` row (random, single use, expires in 60 seconds) and
   redirects to `{FRONTEND_URL}/auth/done#code=...`. Tokens never appear in a URL.
4. Angular posts the code to `POST /api/v1/auth/token` and receives:
   - an access token: JWT, HS256 with `JWT_SECRET`, 15 minutes, claims `sub` (user id), `iat`,
     `exp`, `iss`, `aud`; kept in memory only
   - a refresh token: random, 30 days; stored in `localStorage`; the server stores only its
     SHA-256 hash
5. Every request sends `Authorization: Bearer <access token>`. `current_user` verifies
   signature, expiry, issuer and audience, rejects unsigned tokens, and loads the user.
6. `POST /api/v1/auth/refresh` exchanges a refresh token for a new pair and marks the old one
   used (rotation). A token reused after rotation revokes its whole family, except within a
   10-second grace window, where it returns the same successor (two tabs refreshing at once).
7. `POST /api/v1/auth/logout` revokes the refresh token's family.
8. `AUTH_MODE=dev` keeps working exactly as today. `AUTH_MODE=jwt` turns sign-in on; the API
   refuses to start in that mode without a `JWT_SECRET` of at least 32 bytes and provider
   credentials.

## 2. Data

- `users`: add `email` (nullable), `avatar_url`, `last_login_at`. `external_id` is replaced by:
- `identities`: `provider` (`github` · `google`), `provider_user_id`, `user_id`, `email`,
  `email_verified`, `created_at`; unique on (`provider`, `provider_user_id`).
- Linking: a new identity joins an existing user only when both emails are verified and equal.
  Otherwise it creates a new user. GitHub needs the `user:email` scope to read verified emails.
- `oauth_states`: `state` (PK), `provider`, `code_verifier`, `expires_at`.
- `login_codes`: `code_hash` (PK), `user_id`, `expires_at`, `used_at`.
- `refresh_tokens`: `id`, `user_id`, `family_id`, `token_hash` (unique), `expires_at`,
  `used_at`, `replaced_by_id`, `revoked_at`, `created_at`.
- Tutor invites: setting `TUTOR_INVITED_EMAILS` (comma separated). Access requires a verified
  email in the list. `GET /me` returns `tutor_access`. Tutor endpoints return
  `403 tutor_not_invited` before saving or calling Claude. The daily limit still applies.
- `DELETE /api/v1/me` deletes the account; every user table cascades. Settings asks you to
  type "delete" first.

## 3. Errors, security and testing

Errors (one JSON error shape, as today):

- Cancelled at the provider: back to `/signin?error=cancelled`.
- Expired, unknown or reused state or login code: one generic "sign-in expired" message.
- Expired access token: `401 token_expired`. Angular refreshes once (one shared in-flight
  refresh) and retries; if refresh fails it clears tokens and opens `/signin`.

Security:

- Redirects only to the configured `FRONTEND_URL`.
- Content-Security-Policy on the frontend: the main defence for tokens in `localStorage`.
- CORS limited to `FRONTEND_URL`.
- Secrets only in environment variables.

Testing (test-first):

- Unit: JWT create/verify (expired, tampered, wrong audience, `alg: none`), refresh rotation,
  reuse detection and grace window, linking rules, invite check.
- Integration with a fake provider: start → callback → code → token → `/me`; person B cannot
  read or change person A's chats, cards, notes, applications or submissions; uninvited users
  are refused by the tutor; account deletion removes everything.
- Frontend: interceptor attaches the token, shares one refresh, signs out when refresh fails;
  sign-in page states.
- Manual, before deploying: real sign-in on localhost. Aayush creates a GitHub OAuth App and a
  Google OAuth client and puts their IDs and secrets in `backend/.env`.

## Out of scope

Admin screens, email/password accounts, profiles, leaderboards, server-side practice judging.
