## In short

Django forms turn untrusted input into clean, validated Python values. A `Form` declares fields
(`CharField`, `EmailField`, `IntegerField`, `ChoiceField`…); calling `form.is_valid()` runs each
field's checks, then `clean_<field>()` methods, then `clean()` for rules that involve several fields,
and fills `form.cleaned_data` or `form.errors`. A **ModelForm** builds its fields from a model and can
`save()` directly. Forms also render HTML inputs and error messages. For POST forms, Django's **CSRF**
protection requires `{% csrf_token %}` in the template.

## The idea

Every value from a browser is a string, and none of it can be trusted. A quantity might be "abc", an
email might be missing its `@`, a date might be February 30th, and a malicious user might send fields
your page never showed. Writing those checks by hand in every view is repetitive and easy to get wrong.

A form class is a single place for the rules about one piece of input. Its job has three parts:

1. **Convert** strings to Python types (`"42"` → `42`, `"2026-03-01"` → `date`).
2. **Validate**: required fields, lengths, formats, ranges, custom business rules.
3. **Report** errors per field, in a way the template can show next to each input.

Validation runs in a fixed order, which tells you where each rule belongs. Each field's `clean()`
(built-in type and validator checks) runs first, then your `clean_<fieldname>()` for rules about that
one field, then the form's `clean()` for rules involving several fields ("end date must be after start
date"). Raising `ValidationError` at any stage records an error and the form is invalid.

**ModelForms** remove duplication: a `BookForm` with `Meta.model = Book` and `fields = [...]` creates
fields from the model's field definitions, including max lengths and choices, and `form.save()` creates
or updates the row. Always list `fields` explicitly; `fields = "__all__"` silently exposes any field
added to the model later, which is a mass-assignment vulnerability.

**CSRF** (cross-site request forgery) is when another site tricks a logged-in user's browser into
submitting a form to your site. Django's middleware rejects POSTs that do not carry a secret token that
only your pages know; `{% csrf_token %}` puts it in the form.

## How it works

The standard view for a create page:

1. `GET`: build an empty form, `form = BookForm()`, and render it.
2. `POST`: bind the submitted data, `form = BookForm(request.POST)`.
3. `form.is_valid()` runs the validation chain. If it fails, render the same template with the bound
   form: it remembers the user's input and shows each field's errors.
4. If it passes, `book = form.save()` (for a ModelForm) or use `form.cleaned_data`, then redirect
   (POST/Redirect/GET) so a page refresh does not submit again.
5. To set fields the user must not control (the owner, a timestamp), use `form.save(commit=False)`,
   set them in code, then call `book.save()`.

## Code

```python
# books/forms.py
from django import forms
from .models import Book


class BookForm(forms.ModelForm):
    class Meta:
        model = Book
        fields = ["title", "isbn", "published", "copies"]     # never "__all__"

    def clean_isbn(self):
        isbn = self.cleaned_data["isbn"].replace("-", "")
        if len(isbn) != 13 or not isbn.isdigit():
            raise forms.ValidationError("ISBN must have 13 digits.")
        return isbn                                           # return the cleaned value


class LoanForm(forms.Form):
    start = forms.DateField()
    end = forms.DateField()

    def clean(self):
        data = super().clean()
        if data.get("start") and data.get("end") and data["end"] <= data["start"]:
            raise forms.ValidationError("The end date must be after the start date.")
        return data


# books/views.py
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render


@login_required
def create_book(request):
    form = BookForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        book = form.save(commit=False)
        book.added_by = request.user                          # not editable by the user
        book.save()
        return redirect("books:detail", pk=book.pk)
    return render(request, "books/form.html", {"form": form})
```

```html
<form method="post">
  {% csrf_token %}
  {{ form.as_div }}
  <button type="submit">Save</button>
</form>
```

## Trade-offs

Django forms are ideal for server-rendered pages and the admin. For JSON APIs, Django REST Framework
**serializers** play the same role (parse, validate, save) with the same field-level and object-level
validation hooks. Validation in forms or serializers checks input; constraints that must always hold
belong in the database too (`unique`, `CheckConstraint`, NOT NULL), because data can also arrive through
scripts, the shell or other services. Client-side validation improves the experience but never replaces
server-side checks.

## Common mistakes

- **`fields = "__all__"`** on a ModelForm, exposing fields users should never set.
- **Reading `request.POST` directly** after validation instead of `form.cleaned_data`.
- **Forgetting to return the value** from `clean_<field>()`, which sets the field to `None`.
- **Putting cross-field checks in a field cleaner**, where the other field may not be cleaned yet.
- **Missing `{% csrf_token %}`**, or disabling CSRF with `@csrf_exempt` to "fix" a 403.
- **Not redirecting after a successful POST**, which causes duplicate submissions on refresh.

## In interviews

Expect: the order of validation methods, `clean_<field>` versus `clean()`, Form versus ModelForm,
`commit=False`, how CSRF protection works and why APIs using token authentication often skip it, and
mass assignment. For DRF roles, the same questions apply to serializers (`validate_<field>`,
`validate()`), so connect the two.

Likely follow-up questions:

- Where would you validate that one field depends on another?
- What does `save(commit=False)` let you do?
- How does Django's CSRF protection work?
- Why should validation also exist as database constraints?
