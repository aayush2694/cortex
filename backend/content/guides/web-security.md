## In short

Web security is about stopping attackers from reading or changing data they shouldn't. The basics
every backend needs: **HTTPS** everywhere; **authentication** (who are you?) and **authorisation**
(may you do this?) on every request; **parameterised queries** to stop injection; **output escaping**
and a Content-Security-Policy to stop cross-site scripting (XSS); **CSRF** protection for cookie-based
sessions; checking **object ownership** so changing an ID in a URL can't expose someone else's data;
blocking server-side request forgery (**SSRF**); keeping **secrets** out of code and logs; and **rate
limits** on login and expensive endpoints. The OWASP Top 10 is the standard list of the most common
risks.

## The idea

Every value that comes from outside your server (form fields, URLs, headers, cookies, uploaded files,
JSON bodies, even data from another service) is controlled by someone who may be hostile. Most attacks
work by getting your system to treat that **data as instructions**: as SQL to run, HTML and script to
render, a URL to fetch, or an ID to trust.

The defences follow one rule: **keep data and code apart, and check permissions on the server**.

- **Injection** (SQL, shell, LDAP): never build a query by joining strings with user input. Use
  parameters, so the database receives the value separately and never runs it as SQL. ORMs do this by
  default; raw SQL must too.
- **XSS**: if a comment containing `<script>` is inserted into a page as HTML, it runs in every
  visitor's browser and can steal tokens. Escape output (Django and Angular templates do by default),
  avoid inserting raw HTML, and add a Content-Security-Policy that blocks inline scripts.
- **CSRF**: with cookie-based sessions, another site can make the user's browser submit a form to your
  site, and the browser attaches the cookie. CSRF tokens and `SameSite` cookies stop it. APIs using
  `Authorization: Bearer` headers are not affected, because browsers never add those automatically.
- **Broken access control (IDOR)**: `GET /api/invoices/1043` must check that invoice 1043 belongs to
  the signed-in user. It's the most common serious bug in real APIs, and the top item in the OWASP
  Top 10. Filter every query by the current user, and return 404 rather than 403 so IDs don't leak.
- **SSRF**: a feature like "import from URL" can be tricked into fetching internal addresses
  (`http://169.254.169.254/` cloud metadata, `http://localhost:6379`). Allow-list destinations, block
  private IP ranges, and don't follow redirects blindly.
- **Secrets**: API keys and passwords live in environment variables or a secrets manager, never in git,
  logs, error messages or URLs. Passwords are stored as slow, salted hashes (Argon2, bcrypt, PBKDF2).

## How it works

Hardening one endpoint, `PATCH /api/notes/{id}`, step by step:

1. **Transport:** the request only arrives over HTTPS; HSTS tells browsers, after the first visit, never to use plain HTTP.
2. **Authentication:** the API verifies the access token's signature, expiry and audience. No valid
   token → 401.
3. **Rate limit:** too many requests from this user or IP → 429.
4. **Input validation:** the body is parsed with a schema (Pydantic, DRF serializer): the note text is
   a string under 10,000 characters; unknown fields are ignored (or rejected with Pydantic's `extra="forbid"`), so a client can't set
   `owner_id`.
5. **Authorisation:** the query is `UPDATE notes SET body = :body WHERE id = :id AND owner_id = :me`. If
   no row matches, return 404, whether the note doesn't exist or belongs to someone else.
6. **Output:** the frontend renders the note as text (escaped), so `<script>` in a note is shown, not run.
7. **Logging:** the action is logged with the user ID and request ID, never the token or the note's
   private content.

## Code

```python
# Injection: the first query is exploitable, the second is safe.
cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")         # NEVER
cursor.execute("SELECT * FROM users WHERE email = %s", [email])         # parameterised

# Access control: always scope by the current user.
note = Note.objects.filter(pk=note_id, owner=request.user).first()
if note is None:
    raise Http404                     # same answer for "missing" and "not yours"
```

## Trade-offs

Every defence has a cost in effort or friction: strict CSPs need care with third-party scripts, rate
limits can block legitimate heavy users, and strong password rules annoy people (long passphrases and
multi-factor sign-in work better than complex rules). Frameworks such as Django and Angular give strong
defaults (escaping, CSRF protection, parameterised ORM queries), so the biggest risks come from bypassing
them: raw SQL, `|safe`, `innerHTML`, `@csrf_exempt`. Using an identity provider (Google, GitHub, Okta)
removes password storage entirely but adds a dependency. Security is layered: assume one layer will
fail and make sure another catches it.

## Common mistakes

- **Checking only that a user is signed in**, not that they own the object.
- **Trusting the frontend** to hide buttons or validate input; attackers call the API directly.
- **Building SQL or shell commands with string formatting.**
- **Marking user content as safe HTML**, or turning off CSRF protection to silence an error.
- **Secrets in code, logs or URLs**, including API keys committed to git once and "deleted" later.
- **Detailed error messages** (stack traces, SQL) shown to users in production.
- **No rate limit on login or password reset**, allowing guessing.

## In interviews

Backend interviews ask: "how do you prevent SQL injection?", "what is XSS and how do you stop it?",
"what is CSRF, and does it affect a token-based API?", "how do you store passwords?", "how would you
make sure users only see their own data?", and "what is the difference between authentication and
authorisation?". Strong answers name the concrete defence and where it lives in your stack, and
mention the OWASP Top 10. Real experience helps, such as GDPR-compliant logging that keeps personal data
out of logs.

Likely follow-up questions:

- Why should a missing object and someone else's object both return 404?
- When do you need CSRF tokens, and when don't you?
- How would you protect an "import from URL" feature?
- Where would you store an API key for a third-party service?
