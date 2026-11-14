## In short

Every dependency (a database, another service, a payment provider) will eventually be slow or down.
Resilience patterns keep your service working, or failing gracefully, when that happens. **Timeouts** stop
waiting forever. **Retries with exponential backoff and jitter** recover from brief glitches without
overwhelming the dependency. **Circuit breakers** stop calling a failing dependency for a while.
**Bulkheads** isolate resources so one failure can't consume everything. **Fallbacks** serve cached,
default or partial results. **Load shedding** rejects some work early to protect the rest.

## The idea

The most dangerous failure is often not a dead dependency but a **slow** one. If a payment provider takes 30
seconds to answer instead of 300 ms, every request waiting on it holds a thread or connection. Soon the
whole pool is busy waiting, and your service stops responding to everything, including pages that never
needed payments. One slow dependency has become a full outage: a **cascading failure**.

The patterns break that chain:

- **Timeout**: decide how long a call may take (based on its normal p99), and give up after that. A fast
  error is far better than a slow one.
- **Retry** only failures that are likely temporary (timeouts, connection resets, 503) and only for
  operations that are safe to repeat (idempotent, or protected by an idempotency key). Use **exponential
  backoff** (wait 100 ms, 200 ms, 400 ms…) with **jitter** (random variation), so thousands of clients don't
  retry in lockstep. Cap the number of attempts.
- **Circuit breaker**: track recent failures. When they cross a threshold, **open** the circuit and fail
  immediately without calling the dependency, giving it room to recover. After a cool-down, go **half-open**
  and let a few trial calls through; close again if they succeed.
- **Bulkhead**: like watertight compartments in a ship. Give each dependency its own connection pool or
  concurrency limit, so a slow recommendation service can use at most 10 workers, not all 200.
- **Fallback**: show cached prices, hide the recommendations widget, queue the email for later. Decide per
  feature what "degraded" means.

## How it works

A product page that calls the recommendations service:

1. The call has a 300 ms timeout and one retry with jittered backoff.
2. A concurrency limit of 20 in-flight calls acts as a bulkhead.
3. The recommendations service starts timing out. After 50% of calls fail within 30 seconds, the circuit
   breaker opens.
4. While open, the page skips the call entirely and renders without recommendations (the fallback). Page
   latency returns to normal instead of everyone waiting 300 ms × 2.
5. After 30 seconds, the breaker lets a few calls through. They succeed, so it closes and recommendations
   return.
6. Metrics and alerts show the breaker opening, so the team knows something degraded even though users barely
   noticed.

## Code

```python run
import random


def backoff_delays(attempts: int, base: float = 0.1, cap: float = 5.0) -> list[float]:
    """Exponential backoff with full jitter: a random wait up to base * 2^n, capped."""
    return [random.uniform(0, min(cap, base * 2**n)) for n in range(attempts)]


class CircuitBreaker:
    def __init__(self, threshold: int, cooldown: float) -> None:
        self.threshold, self.cooldown = threshold, cooldown
        self.failures, self.opened_at = 0, None

    def allow(self, now: float) -> bool:
        if self.opened_at is None:
            return True                                   # closed: calls flow
        return now - self.opened_at >= self.cooldown      # half-open after the cool-down

    def record(self, ok: bool, now: float) -> None:
        if ok:
            self.failures, self.opened_at = 0, None       # success closes the circuit
        else:
            self.failures += 1
            if self.failures >= self.threshold:
                self.opened_at = now                      # open (or re-open)


delays = backoff_delays(5)
assert all(0 <= d <= min(5.0, 0.1 * 2**n) for n, d in enumerate(delays))

cb = CircuitBreaker(threshold=3, cooldown=30)
for t in (0, 1, 2):
    cb.record(ok=False, now=t)
assert not cb.allow(now=10)          # open: fail fast, don't call the dependency
assert cb.allow(now=33)              # half-open: let a trial call through
cb.record(ok=True, now=33)
assert cb.allow(now=34)              # closed again
```

## Trade-offs

Every pattern has a cost. Short timeouts cut off legitimately slow requests; long ones allow pile-ups.
Retries add load exactly when a dependency is struggling and can multiply across layers (three layers each
retrying three times means 27 calls). Circuit breakers need tuning and can flap. Fallbacks can show stale or
incomplete data, which is unacceptable for some features (account balances). Service meshes (Istio,
Linkerd) and libraries (resilience4j, Polly, tenacity) provide these patterns, but you still choose the
values and the fallback behaviour.

## Common mistakes

- **No timeouts at all**, or library defaults of minutes.
- **Retrying non-idempotent operations**, creating duplicate orders or charges.
- **Retries without backoff and jitter**, causing retry storms.
- **Retrying at every layer**, multiplying traffic.
- **One shared pool for everything**, so one slow dependency exhausts it.
- **Fallbacks that are never tested**, which fail when finally needed.

## In interviews

Expect: what happens to your design when service X is slow, how you choose timeout values, when retries are
safe, exponential backoff and jitter, circuit breaker states, bulkheads, graceful degradation, and how these
show up in monitoring. Strong answers follow one failing dependency through the whole system and show where
each pattern stops the damage from spreading.

Likely follow-up questions:

- Why can a slow dependency be worse than a dead one?
- How do you stop retries from making an outage worse?
- What are the three states of a circuit breaker?
- What would you show users if the recommendations service is down?
