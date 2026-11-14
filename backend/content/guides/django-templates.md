## In short

The Django template language turns HTML files with placeholders into pages. `{{ variable }}` prints a
value (auto-escaped, so user input cannot inject HTML or scripts), `{% tag %}` runs logic such as
`{% if %}`, `{% for %}`, `{% url %}` and `{% csrf_token %}`, and `|filter` transforms a value
(`{{ name|title }}`, `{{ created|date:"j M Y" }}`). **Template inheritance** lets a `base.html` define
the page skeleton with `{% block %}` sections that child templates fill in with `{% extends %}`. The
language is deliberately limited, so logic stays in Python.

## The idea

A web page mixes a fixed layout (header, navigation, footer) with changing data (this user's name,
this list of books). Templates keep the layout in HTML files and leave named holes for the data. The
view decides **what** to show; the template decides **how** it looks.

Django's template language is intentionally not full Python. You cannot run arbitrary code or call
functions with arguments inside a template. That restriction is a design choice: designers can edit
templates safely, and business logic is pushed into views, models and custom template tags where it
can be tested.

**Auto-escaping** is the most important safety feature. If a user's name is
`<script>alert(1)</script>`, `{{ user.name }}` outputs it as harmless text (`&lt;script&gt;…`). You only
turn escaping off with `|safe` or `{% autoescape off %}` for HTML you generated yourself and trust.
Marking user input as safe opens a cross-site scripting (XSS) hole.

**Inheritance** removes duplication. `base.html` contains the full HTML skeleton and a few blocks
(`title`, `content`, `scripts`). Each page template says `{% extends "base.html" %}` and overrides only
the blocks it needs; `{{ block.super }}` keeps the parent's content and adds to it. **Includes**
(`{% include "partials/book_card.html" %}`) reuse smaller fragments.

## How it works

Rendering `books/list.html` with `{"books": [...], "query": "dune"}`:

1. The template loader finds the file in an app's `templates/` folder (or a folder listed in
   `TEMPLATES["DIRS"]`).
2. `{% extends "base.html" %}` loads the parent; the child's blocks replace the parent's blocks.
3. `{% for book in books %}` loops; `{% empty %}` handles an empty list without an extra `if`.
4. `{{ book.author.name }}` is resolved with **dot lookup**: Django tries a dict key, then an attribute,
   then a list index. If the value is a method with no arguments, Django calls it.
5. Missing variables render as an empty string instead of raising an error, which is convenient but can
   hide typos; set `string_if_invalid` in development to spot them.
6. **Context processors** add common variables to every template, such as `request`, `user` and
   `messages`.

Note step 4: if `book.author` is a foreign key that was not loaded with `select_related`, every loop
iteration triggers a database query. Templates are a common place for hidden N+1 queries.

## Code

```html
<!-- templates/base.html -->
<!doctype html>
<html lang="en">
<head><title>{% block title %}Library{% endblock %}</title></head>
<body>
  <nav><a href="{% url 'books:list' %}">Books</a>
    {% if user.is_authenticated %}Hi, {{ user.first_name|default:user.username }}{% endif %}
  </nav>
  <main>{% block content %}{% endblock %}</main>
</body>
</html>

<!-- books/templates/books/list.html -->
{% extends "base.html" %}
{% block title %}Books · {{ block.super }}{% endblock %}
{% block content %}
  <form method="get"><input name="q" value="{{ query }}"></form>
  <ul>
    {% for book in books %}
      <li>
        <a href="{% url 'books:detail' book.pk %}">{{ book.title }}</a>
        by {{ book.author.name }} · {{ book.published|date:"Y" }}
      </li>
    {% empty %}
      <li>No books match "{{ query }}".</li>
    {% endfor %}
  </ul>
{% endblock %}
```

```python
# books/templatetags/money.py: a custom filter keeps formatting logic in Python.
from django import template

register = template.Library()

@register.filter
def rupees(amount: int) -> str:
    return f"₹{amount:,}"           # usage: {% load money %} {{ price|rupees }}
```

## Trade-offs

Server-rendered templates are simple, fast to build, good for SEO and need no JavaScript build step.
They suit content sites, admin-style tools and forms-heavy apps; adding htmx gives partial page updates
without a full frontend framework. Highly interactive interfaces are usually better as a separate
frontend (Angular, React) talking to a JSON API, at the cost of a second codebase. Django can also use
Jinja2, which is faster and allows more expressions, if the template language feels too restrictive.

## Common mistakes

- **Using `|safe` on user input**, which creates XSS vulnerabilities.
- **Hidden N+1 queries** from following relations inside `{% for %}` loops.
- **Logic-heavy templates**: move calculations into the view, the model or a custom tag.
- **Hard-coded URLs** instead of `{% url %}`.
- **Forgetting `{% csrf_token %}`** inside POST forms, which causes 403 errors.
- **Silent typos**: a misspelled variable renders as empty instead of failing.

## In interviews

Expect questions on how auto-escaping prevents XSS and when `|safe` is acceptable, template inheritance
with blocks and `block.super`, context processors, writing a custom filter or tag, and spotting N+1
queries caused by templates. In full-stack interviews, you may be asked to compare server-side templates
with a single-page app and say when you would choose each.

Likely follow-up questions:

- How does Django protect templates against XSS?
- What is the difference between `{% include %}` and `{% extends %}`?
- How would you find queries triggered from inside a template?
- When would you move from templates to a separate frontend?
