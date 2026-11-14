## In short

Rate limiting caps how many requests a client (a user, API key or IP address) can make in a period,
protecting services from overload, abuse, brute-force login attempts, scraping and runaway scripts. Common
algorithms: **token bucket** (allows short bursts, then a steady rate), **leaky bucket** (smooths output to
a fixed rate), **fixed window** (simple counters per minute, but bursts at window edges), and **sliding
window** (more accurate). In a multi-server system, counters live in a shared fast store such as Redis.
Rejected requests get **HTTP 429 Too Many Requests** with a **Retry-After** header.

## The idea

A popular API with no limits is fragile: one buggy client in a retry loop, one scraper or one attacker can
use all the capacity and take the service down for everyone. Rate limits make capacity fair and
predictable, and they are often part of a product's pricing ("1,000 requests per hour on the free plan").

**Token bucket**, the most common algorithm: each client has a bucket holding up to `capacity` tokens,
refilled at `rate` tokens per second. Each request spends one token; with no tokens left, the request is
rejected. A full bucket allows a burst of `capacity` requests, after which the client is held to the refill
rate. It is cheap to store (a token count and a timestamp) and matches how real traffic arrives.

**Fixed window** counts requests per clock window (for example per minute) and resets at the boundary. It
is easy to implement with one counter and a TTL, but a client can send the full limit at 12:00:59 and again
at 12:01:00: twice the limit in two seconds. **Sliding window log** stores timestamps of recent requests and
counts those within the last 60 seconds: accurate, but memory-heavy. **Sliding window counter** blends the
current and previous window's counts by how far into the current window you are: cheap and accurate enough.

**Where to limit**: at the API gateway or load balancer (protects everything, coarse), in the application
(knows the user and plan, fine-grained), and per downstream dependency (protects a fragile partner API).
Limits often stack: per IP for login, per API key for the public API, global caps for expensive endpoints.

## How it works

Token bucket with capacity 5 and refill of 1 token per second, for one API key:

1. The client sends 5 requests instantly: all allowed, the bucket is empty.
2. A sixth request in the same second: rejected with `429` and `Retry-After: 1`.
3. After 2 seconds, 2 tokens have refilled: 2 more requests pass.
4. With many servers, each server runs the check against Redis. A small **Lua script** reads the token
   count and timestamp, computes the refill, decides, and writes back **atomically**, so two servers cannot
   both spend the last token.
5. Responses can include headers like `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` so
   clients can slow down before hitting the limit.

## Code

```python run
class TokenBucket:
    """capacity = burst size, rate = tokens added per second. Time is passed in for testability."""

    def __init__(self, capacity: float, rate: float, now: float = 0.0) -> None:
        self.capacity, self.rate = capacity, rate
        self.tokens, self.updated = capacity, now

    def allow(self, now: float) -> bool:
        elapsed = now - self.updated
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)   # refill
        self.updated = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False


bucket = TokenBucket(capacity=5, rate=1)
assert [bucket.allow(now=0.0) for _ in range(6)] == [True] * 5 + [False]   # burst of 5, then 429
assert bucket.allow(now=0.5) is False                                       # only half a token back
assert [bucket.allow(now=2.0) for _ in range(3)] == [True, True, False]     # 2 tokens after 2 s
assert bucket.allow(now=100.0) and bucket.tokens == 4                       # refill is capped at 5


def fixed_window_allow(counts: dict[int, int], now: float, limit: int, window: int = 60) -> bool:
    key = int(now // window)
    counts[key] = counts.get(key, 0) + 1
    return counts[key] <= limit


counts: dict[int, int] = {}
edge = [fixed_window_allow(counts, t, limit=3) for t in (59, 59, 59, 60, 60, 60)]
assert edge == [True] * 6          # 6 requests in ~1 second all pass: the window-edge burst
```

## Trade-offs

Token bucket allows bursts (good for interactive clients) while enforcing an average; leaky bucket gives
the smoothest output for protecting a fragile backend. Fixed windows are cheapest but leak bursts; sliding
windows cost more memory or computation. A central Redis counter is accurate but adds a network call and a
dependency to every request; local in-memory limits are fast but only approximate across servers. Decide
what happens if the limiter's store is down: **fail open** (allow traffic, risk overload) or **fail closed**
(reject traffic, risk an outage).

## Common mistakes

- **Limiting only by IP**, which punishes users behind shared networks and is easy for attackers to rotate.
- **Non-atomic check-then-increment** across servers, which lets bursts through.
- **No `Retry-After`**, so clients retry immediately and make things worse.
- **Clients retrying 429s without backoff**, turning a limit into a storm.
- **The same limit for every endpoint**, when login, search and cheap reads need very different limits.
- **Forgetting internal callers**, so a batch job takes down a service its own team owns.

## In interviews

"Design a rate limiter" is a classic question. Cover requirements (per user or per key, limits per window,
distributed or not), the algorithms and their trade-offs, where the limiter sits, how counters are stored
atomically in Redis, response codes and headers, and failure behaviour. Writing a token bucket in a few
lines, with time passed in so it can be tested, is a strong signal.

Likely follow-up questions:

- What is the difference between token bucket and fixed window, and when does it matter?
- How do you enforce one limit across 20 servers?
- What happens if Redis is unavailable?
- How would you set different limits for free and paid plans?
