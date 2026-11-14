## In short

A URL shortener turns a long link into a short one (`sho.rt/aZ3k9Q`) and redirects visitors to the
original. It is **read-heavy** (redirects outnumber new links by around 100 to 1), so the design centres on a
fast lookup from short code to long URL, served mostly from a cache. Short codes come from **base62 encoding**
(0–9, a–z, A–Z) of a unique number or of random bytes; 7 characters give 62⁷ ≈ 3.5 trillion codes. The redirect
uses **301** (permanent, cacheable by browsers) or **302** (temporary, so every click reaches you and can be
counted). Click analytics go through a queue, never on the redirect's critical path.

## The idea

The core is a key-value lookup: `code → long_url`. Everything else is about doing that lookup at scale, keeping
codes unique, and not letting extras slow down redirects.

**Estimates** (an example to calibrate): 100 million new links a month is about 40 writes per second; at 100
reads per write, about 4,000 redirects per second on average, perhaps 20,000 at peak. Each record is roughly
500 bytes, so 100 million links a month is about 50 GB a month, 600 GB a year. One well-indexed database could
store this; the redirect traffic is what needs caching and horizontal scaling.

**Generating codes**, three common options:

1. **Counter + base62**: a unique number (from a database sequence, or ranges handed out to each server so they
   don't coordinate per request) is encoded in base62. Codes are short and never collide, but sequential codes
   are guessable.
2. **Random**: generate 7 random base62 characters; on the rare collision (check with a unique constraint),
   retry. Not guessable, but needs the collision check.
3. **Hash of the URL** (truncated): the same URL always gets the same code, which deduplicates, but
   collisions between different URLs must still be handled.

**301 versus 302**: a 301 lets browsers remember the redirect and skip your servers next time, saving load but
losing click counts and the ability to change the destination. Most commercial shorteners use 302 (or 307) to
keep analytics and control.

## How it works

1. **Create**: `POST /api/links {"url": "https://…"}`. The service validates the URL (scheme, length, blocklist
   of malicious domains), gets a code, stores `(code, long_url, owner, created_at, expires_at)`, and returns the
   short link.
2. **Redirect**: `GET /aZ3k9Q` hits a stateless redirect service behind a load balancer. It checks Redis first;
   most traffic goes to a small set of popular links, so the hit rate is very high. On a miss it reads the
   database and caches the result.
3. It responds `302 Location: https://…` immediately, and publishes a click event (code, time, country, referrer)
   to a queue.
4. **Analytics** workers consume click events and aggregate counts per link, per day and per country into an
   analytics store.
5. **Storage**: a key-value store (DynamoDB, Cassandra) or PostgreSQL with the code as primary key both work; at
   very large scale, shard by code.
6. Unknown codes return 404; expired links return 410 Gone.

## Code

```python run
import secrets

ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"


def encode(n: int) -> str:
    """Base62-encode a non-negative integer."""
    if n == 0:
        return ALPHABET[0]
    out = []
    while n:
        n, r = divmod(n, 62)
        out.append(ALPHABET[r])
    return "".join(reversed(out))


def decode(code: str) -> int:
    n = 0
    for ch in code:
        n = n * 62 + ALPHABET.index(ch)
    return n


def random_code(length: int = 7) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


assert encode(0) == "0" and encode(61) == "Z" and encode(62) == "10"
assert decode(encode(125_000_000_000)) == 125_000_000_000
assert len(encode(62**7 - 1)) == 7                 # 7 characters cover ~3.5 trillion IDs
assert len(random_code()) == 7 and set(random_code()) <= set(ALPHABET)
```

## Trade-offs

Counter-based codes never collide and stay short, but reveal volume and are enumerable; random codes are
private but need a uniqueness check. 302 keeps analytics and lets links be edited; 301 saves load. A relational
database is simple and fine up to billions of rows with good indexing; a distributed key-value store scales
writes and storage further with less operational tuning. Custom aliases ("sho.rt/sale") need a uniqueness check
against the same namespace.

## Common mistakes

- **Writing analytics synchronously** in the redirect path, slowing every click.
- **No caching**, leaving the database to serve thousands of identical reads per second.
- **Guessable sequential codes** for links that may be private.
- **No URL validation or abuse protection**, turning the service into a phishing tool; rate limit creation and
  check blocklists.
- **Ignoring collisions** for random or hashed codes.
- **Using 301** when the business needs click counts.

## In interviews

This is one of the most common system design questions. Walk through requirements (custom aliases? expiry?
analytics?), estimates, the API, code generation options with their trade-offs, data model, the read path with
caching, 301 versus 302, analytics through a queue, scaling (stateless redirect servers, sharding by code,
replicas) and abuse prevention.

Likely follow-up questions:

- How do you guarantee unique codes across many servers?
- Would you use 301 or 302, and why?
- How would you count clicks without slowing redirects?
- How would you handle a link that suddenly gets millions of clicks?
