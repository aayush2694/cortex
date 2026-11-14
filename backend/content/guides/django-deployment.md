## In short

Deploying Django means running it with production settings behind a real application server. Typical
setup: **Gunicorn** (WSGI) or **Uvicorn** (ASGI) runs several worker processes; **Nginx** or a cloud load
balancer in front terminates HTTPS and serves static files (or **WhiteNoise** serves them from Django);
**PostgreSQL** holds data; secrets come from **environment variables**; `collectstatic` gathers static
files; and `migrate` runs on each release. `python manage.py check --deploy` lists missing security
settings. Containers (Docker) and platforms like Azure App Service, AWS or Render package this into
repeatable releases.

## The idea

`runserver` is for development only: it is single-process, not hardened, and reloads code on change.
Production needs a process manager that keeps several workers alive, restarts crashed ones, and shuts
down cleanly during deploys. Gunicorn does that for WSGI. A common starting point is around `2 × CPU
cores + 1` workers, adjusted after load testing.

Production settings differ in ways that matter for security:

- `DEBUG = False`. With `DEBUG = True`, error pages show settings and stack traces to anyone.
- `SECRET_KEY` from the environment, never in git. It signs sessions and password reset links.
- `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` set to your real domains.
- HTTPS everywhere: `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, and HSTS
  (`SECURE_HSTS_SECONDS`) once you are sure HTTPS works. Behind a proxy, set `SECURE_PROXY_SSL_HEADER`
  so Django knows the original request was HTTPS.

**Static files** (CSS, JS, images that ship with the code) are collected into one folder by
`collectstatic` and served by Nginx, a CDN, or WhiteNoise, never by Django views. **Media files**
(user uploads) go to object storage such as S3 or Azure Blob Storage, because containers are disposable
and several servers must see the same files.

A release should be **repeatable and reversible**: build an image once, run tests, run migrations, then
switch traffic. Migrations must be backward compatible with the code still running during the switch.

## How it works

A typical container-based release:

1. CI builds a Docker image: install dependencies from the lock file, copy code, run `collectstatic`.
2. CI runs tests and `python manage.py check --deploy` against production-like settings.
3. The deploy step runs `python manage.py migrate` once (as a release job, not in every container).
4. New containers start `gunicorn mysite.wsgi --workers 5 --timeout 30` and pass a **health check**
   endpoint before receiving traffic.
5. The load balancer shifts traffic to the new containers; the old ones finish in-flight requests and
   stop.
6. Logs go to stdout and into a log service; errors go to Sentry or similar; metrics and traces go to an
   APM. If error rates jump, roll back to the previous image.

## Code

```python
# settings/production.py
import os
from .base import *  # noqa: F401,F403

DEBUG = False
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
ALLOWED_HOSTS = os.environ["DJANGO_ALLOWED_HOSTS"].split(",")
CSRF_TRUSTED_ORIGINS = [f"https://{h}" for h in ALLOWED_HOSTS]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["DB_NAME"],
        "USER": os.environ["DB_USER"],
        "PASSWORD": os.environ["DB_PASSWORD"],
        "HOST": os.environ["DB_HOST"],
        "CONN_MAX_AGE": 60,                     # reuse connections between requests
    }
}

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "storages.backends.s3.S3Storage"},             # user uploads
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

LOGGING = {
    "version": 1,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
```

```text
python manage.py check --deploy --settings=mysite.settings.production
python manage.py collectstatic --noinput
python manage.py migrate --noinput
gunicorn mysite.wsgi:application --bind 0.0.0.0:8000 --workers 5 --timeout 30
```

## Trade-offs

A platform service (Azure App Service, Render, Heroku-style hosts) removes server management at a
higher price per unit and less control. Containers on Kubernetes or ECS give full control and scale but
need more operations knowledge. A single VM with Nginx, Gunicorn and systemd is cheap and simple for small
projects but makes zero-downtime deploys and scaling your job. WSGI with Gunicorn suits most sites; ASGI
with Uvicorn is needed for WebSockets and async views. Whatever the platform, keep the same principles:
immutable builds, secrets in the environment, managed PostgreSQL with backups, and monitoring.

## Common mistakes

- **`DEBUG = True` in production**, or a hard-coded `SECRET_KEY` in git.
- **Running `runserver` in production.**
- **Storing uploads on the container's disk**, where they vanish on redeploy.
- **Running migrations in every container at start-up**, causing races between replicas.
- **Missing `SECURE_PROXY_SSL_HEADER` behind a proxy**, which causes redirect loops or insecure cookies.
- **No health checks, logs or error tracking**, so problems are found by users first.
- **Breaking migrations** that drop columns the old code still uses during a rolling deploy.

## In interviews

Expect: how you deploy a Django app end to end, Gunicorn versus Uvicorn, WSGI versus ASGI, static versus
media files, which settings change in production and why, zero-downtime deploys and migrations, scaling
(more workers, more instances, caching, read replicas), and monitoring. Real experience is valuable here:
describe your Nginx and Gunicorn setup, how secrets were managed, and how you rolled back a bad release.

Likely follow-up questions:

- What does `check --deploy` look for?
- How many Gunicorn workers would you start with, and how would you tune it?
- Where do user-uploaded files go in a multi-server setup?
- How do you deploy a migration that removes a column without downtime?
