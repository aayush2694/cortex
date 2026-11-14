## In short

The Django admin is an automatic back office: register a model and staff users get pages to list,
search, filter, create, edit and delete its rows, with permissions and a change history. A
`ModelAdmin` class customises it: `list_display` (columns), `list_filter` and `search_fields`,
`ordering`, `readonly_fields`, `fieldsets`, `inlines` (edit related rows on the same page), custom
**actions** for bulk operations, and `list_select_related` to avoid slow pages. It is meant for trusted
internal users, not as the product's public interface.

## The idea

Every product needs a way for the team to look at and fix data: approve a seller, refund an order,
correct a typo in a product title. Building those screens by hand takes weeks. Django's admin reads
your model definitions and generates them in minutes, including forms with validation, foreign-key
pickers, pagination and audit history.

Every change made through the admin is recorded in a `LogEntry` table (who changed which object, and
when), shown as each object's "History". It is a basic audit trail, not a full one: it misses changes
made through code, the shell or `queryset.update()`.

Because the admin is generated from models, good model definitions make a good admin: `__str__` decides
how each row is shown, `verbose_name` sets labels, `choices` become dropdowns, and `blank`/`null` decide
which fields are required.

Access is controlled by Django's auth system. A user needs `is_staff = True` to log in to the admin at
all, and then the standard **view/add/change/delete** permissions per model (or `is_superuser`, which
has everything). Groups make this manageable: a "Support" group might view orders and change their
status, but not delete them.

The admin is powerful precisely because it touches the database directly, so treat it like production
access: strong passwords or SSO, two-factor authentication through a package, limited superusers, and
ideally a non-obvious URL or IP restriction.

## How it works

Customising the list page for orders:

1. `@admin.register(Order)` attaches an `OrderAdmin` class to the model.
2. `list_display = ["id", "customer", "status", "total", "created_at"]` chooses the columns. A method
   name can be used too, for computed columns.
3. `list_filter = ["status", "created_at"]` adds a sidebar of filters; `search_fields =
   ["customer__email", "id"]` adds a search box that queries across a relation.
4. `list_select_related = ["customer"]` makes the list page fetch customers with a JOIN. Without it,
   showing `customer` in each row runs one query per row: a classic N+1 in the admin.
5. `inlines = [OrderItemInline]` lets staff edit an order's line items on the order page.
6. `actions = ["mark_shipped"]` adds a bulk action: select rows, choose the action, and one method
   updates them all.

## Code

```python
# orders/admin.py
from django.contrib import admin, messages
from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0                                      # no empty extra rows
    autocomplete_fields = ["product"]              # search instead of a huge dropdown


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["id", "customer", "status", "total", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["id", "customer__email"]
    list_select_related = ["customer"]             # avoid one query per row
    readonly_fields = ["created_at", "total"]
    date_hierarchy = "created_at"
    inlines = [OrderItemInline]
    actions = ["mark_shipped"]

    @admin.action(description="Mark selected orders as shipped")
    def mark_shipped(self, request, queryset):
        updated = queryset.filter(status="paid").update(status="shipped")
        self.message_user(request, f"{updated} orders marked as shipped.", messages.SUCCESS)

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser           # only superusers may delete orders
```

## Trade-offs

The admin is unbeatable for internal CRUD with little effort. It becomes a poor fit for complex
workflows (multi-step approvals, dashboards, heavy custom UI) or for customers: customising it deeply
means fighting its templates and structure, and it is not designed for public users. At that point,
build dedicated internal pages or a separate internal tool, and keep the admin for raw data access.

## Common mistakes

- **Slow list pages** from foreign keys in `list_display` without `list_select_related`, or huge
  dropdowns without `autocomplete_fields` or `raw_id_fields`.
- **Giving staff superuser** instead of specific permissions through groups.
- **Bulk actions using `queryset.update()`** and expecting model `save()` logic and signals to run;
  `update()` skips them.
- **Exposing the admin to the public internet** at `/admin/` with weak passwords and no extra protection.
- **Editable fields that should be read-only**, such as totals computed by code.

## In interviews

Admin questions are usually practical: how you made admin pages fast (select related, autocomplete,
`show_full_result_count = False` on huge tables), how you restricted what different staff can do
(groups, `has_change_permission`, `get_queryset` filtering), how you added bulk actions, and when you
would stop using the admin. Concrete examples from real work carry a lot of weight here.

Likely follow-up questions:

- How would you speed up an admin list page with 10 million rows?
- How do you restrict which rows a staff user can see?
- What is the difference between `is_staff` and `is_superuser`?
- When is the admin the wrong tool?
