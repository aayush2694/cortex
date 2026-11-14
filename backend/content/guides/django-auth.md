## In short

`django.contrib.auth` handles **authentication** (who are you?) and **authorization** (what may you
do?). It provides a `User` model, password hashing (PBKDF2 by default, Argon2 or bcrypt optional),
login and logout with session cookies, groups, per-model permissions, and decorators and mixins such
as `@login_required` and `PermissionRequiredMixin`. Authentication middleware attaches `request.user`
to every request (an `AnonymousUser` if nobody is logged in). For a new project, define a **custom user
model** from day one; changing it later is painful.

## The idea

Authentication answers "is this really Asha?". Django never stores passwords: it stores a **slow,
salted hash**. When Asha logs in, Django hashes what she typed with the same salt and compares. The
hashing is deliberately slow (hundreds of thousands of iterations), so a stolen database cannot be
cracked quickly, and the salt makes identical passwords produce different hashes. The stored string
also records the algorithm, so Django can upgrade hashes when a user next logs in.

After a successful login, Django creates a **session**: a random ID in a cookie, mapped on the server to
the user. Every later request sends the cookie, and the middleware turns it back into `request.user`.
Logging in rotates the session ID (to stop session fixation), and logging out deletes the session.

Authorization answers "may Asha do this?". Django's built-in permissions are per model: `add`, `change`,
`delete` and `view` for each model, assigned to users directly or, better, through **groups** ("Editors",
"Support"). You check them with `user.has_perm("books.change_book")`, the `@permission_required`
decorator, or `PermissionRequiredMixin`. They do not cover **object-level** rules such as "authors may
edit only their own books"; you write those yourself (filter querysets by owner, or check in the view),
or use a package like django-guardian.

## How it works

A login with Django's built-in views:

1. Include `django.contrib.auth.urls` to get `login/`, `logout/`, `password_change/` and
   `password_reset/` views. You provide the templates.
2. The login form POSTs a username and password. `authenticate()` asks each configured authentication
   backend whether the credentials are valid; the default backend checks the hash.
3. `login(request, user)` stores the user ID in a new session and sets the cookie.
4. A view decorated with `@login_required` redirects anonymous users to `LOGIN_URL?next=/original/path/`.
5. Logout must be a **POST** in current Django versions, so a malicious link or image cannot log users
   out.

For APIs used by mobile apps or separate frontends, sessions are often replaced by tokens (Django REST
Framework's token auth, or JWT), and social logins are added through packages such as django-allauth.

## Code

```python
# accounts/models.py: a custom user model, created before the first migration.
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)
    is_author = models.BooleanField(default=False)


# settings.py
AUTH_USER_MODEL = "accounts.User"
LOGIN_URL = "login"
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",   # needs argon2-cffi
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",   # still verifies older hashes
]


# books/views.py: model permission plus an object-level rule.
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.views.generic import UpdateView
from .models import Book


class EditBook(LoginRequiredMixin, PermissionRequiredMixin, UpdateView):
    permission_required = "books.change_book"
    model = Book
    fields = ["title", "summary"]

    def get_queryset(self):
        # Authors only see (and can only edit) their own books: others get a 404.
        return super().get_queryset().filter(author=self.request.user)
```

Elsewhere, always refer to the user model with `settings.AUTH_USER_MODEL` (in foreign keys) or
`get_user_model()` (in code), never by importing `django.contrib.auth.models.User` directly.

## Trade-offs

Sessions with cookies are simple and secure for server-rendered sites and same-site frontends: the
server can revoke them instantly. Token-based auth suits mobile apps and third-party API clients, but
tokens need careful storage and expiry. Django's model permissions are coarse; object-level rules add
code or a package. Outsourcing authentication to an identity provider (Google, Microsoft Entra, Okta)
removes password handling entirely, at the cost of a dependency.

## Common mistakes

- **Starting with the default `User`** and needing to switch to a custom model mid-project.
- **Checking only `is_authenticated`** when the real rule is ownership; users can then edit each other's
  data by changing an ID in the URL (an IDOR vulnerability).
- **Rolling your own password hashing**, or storing reset tokens in plain text.
- **Logout via GET**, or disabling CSRF on login forms.
- **Insecure cookies in production**: set `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` and HTTPS.
- **No rate limiting on login**, which allows password guessing; add throttling or lockouts.

## In interviews

Expect: how Django stores passwords and why hashing must be slow and salted, how sessions identify a
user, authentication versus authorization, model permissions versus object-level permissions, custom
user models, sessions versus tokens versus JWT, and how to prevent users accessing each other's data.
Security-minded answers (IDOR, CSRF, cookie flags, rate limiting) stand out.

Likely follow-up questions:

- Why use a slow hash like PBKDF2 or Argon2 instead of SHA-256?
- How would you let users edit only their own records?
- Sessions or JWT for a single-page app? What are the trade-offs?
- Why should you create a custom user model at the start?
