## In short

An API is a contract between a service and its clients, and good APIs are **predictable, consistent and
hard to misuse**. **REST** models data as resources (`/users/42/orders`) and uses HTTP methods (`GET`,
`POST`, `PUT`, `PATCH`, `DELETE`) and status codes for actions and outcomes. **gRPC** uses typed
Protocol Buffers over HTTP/2 for fast service-to-service calls. **GraphQL** lets clients ask for exactly
the fields they need. Whatever the style: paginate lists (preferably with cursors), make retries safe with
**idempotency keys**, return clear errors, version carefully, and never break existing clients silently.

## The idea

Once other people or teams depend on your API, changing it becomes expensive: mobile apps in users'
pockets may run old versions for years. So API design is mostly about choices that are easy to keep
stable.

**REST conventions** make an API guessable:

- Nouns for resources, plural: `GET /orders`, `GET /orders/42`, `POST /orders`.
- Methods for actions: `GET` reads, `POST` creates, `PUT` replaces, `PATCH` updates part, `DELETE`
  removes.
- Status codes for outcomes: 200 OK, 201 Created, 204 No Content, 400 bad input, 401 not
  authenticated, 403 not allowed, 404 not found, 409 conflict, 422 validation failed, 429 too many
  requests, 5xx server errors.

**Idempotency** means doing something twice has the same effect as doing it once. `GET`, `PUT` and
`DELETE` are idempotent by definition; `POST` is not. Networks fail in the worst place: the client sent a
payment request, the server charged the card, and the response was lost. The client retries. Without
protection, the customer pays twice. With an **idempotency key** (a unique ID the client sends with the
request), the server stores the result of the first request and returns it again for any retry with the
same key.

**Pagination** stops one request from returning a million rows. Offset pagination (`?page=3`) is simple,
but deep pages get slow and items shift between pages when data changes. **Cursor** pagination returns an
opaque `next_cursor` (for example, the last seen ID and timestamp), so the next page continues exactly
where the last one stopped.

**Versioning**: add fields freely (clients ignore what they don't know), but treat removing or renaming
fields and changing meanings as breaking. Breaking changes go into a new version (`/v2/` or a header)
with a deprecation period for the old one.

## How it works

Designing the "create order" endpoint:

1. `POST /v1/orders` with `Idempotency-Key: 7f3c…` and a JSON body of items and an address.
2. The server validates the body. On failure: `422` with a consistent error shape, for example
   `{"error": {"code": "invalid_quantity", "message": "...", "field": "items[0].quantity"}}`.
3. The server checks the idempotency key. If it has seen it, it returns the stored response.
4. Otherwise it creates the order in a transaction, stores the response under the key, and returns
   `201 Created` with the order and a `Location: /v1/orders/981` header.
5. `GET /v1/orders?status=paid&limit=20&cursor=...` lists orders, returning `items` and `next_cursor`.

## Trade-offs

REST is universal, cacheable and easy to debug with any HTTP tool; it can need several requests for one
screen. GraphQL gives clients flexible queries in one round trip but makes caching, rate limiting and
performance (deeply nested queries) harder. gRPC is fast with strict types and streaming, ideal between
internal services, but browsers need a proxy and payloads are not human-readable. Many systems use REST
or GraphQL at the edge and gRPC inside.

## Common mistakes

- **Verbs in URLs** (`/getOrder`, `/createUser`) and inconsistent naming across endpoints.
- **Returning 200 for errors** with an error message in the body.
- **No pagination**, or offset pagination on huge, fast-changing lists.
- **Unsafe retries** on POST endpoints that move money or create records.
- **Breaking changes without a new version**: renaming a field breaks every old client.
- **Leaking internals**: database IDs, column names, stack traces in error responses.
- **Inconsistent error formats** across endpoints.

## In interviews

API design appears in system design rounds ("define the API first") and in backend interviews directly.
Expect: REST principles, which status code fits a situation, PUT versus PATCH, idempotency and how you
would implement idempotency keys, cursor versus offset pagination, versioning strategy, authentication
(API keys, OAuth, JWT), rate limiting, and REST versus gRPC versus GraphQL. Mention concrete experience,
such as designing payment endpoints where duplicate charges had to be impossible.

Likely follow-up questions:

- How would you make a payment endpoint safe to retry?
- Why can offset pagination return duplicates or skip items?
- What counts as a breaking change, and how do you roll one out?
- When would you choose gRPC over REST?
