## In short

Observability is how well you can understand what your system is doing in production from the data it emits.
The three main signals: **logs** (timestamped records of events, ideally structured as JSON), **metrics**
(numbers aggregated over time, such as request rate or p99 latency), and **traces** (the path of one request
across services, broken into timed spans). Teams watch the **four golden signals** (latency, traffic, errors,
saturation), set **SLOs** (reliability targets users care about) with an **error budget**, and alert on symptoms
users feel. OpenTelemetry is the open standard for producing all three signals.

## The idea

Monitoring answers questions you predicted ("is CPU above 90%?"). Observability lets you answer questions you
didn't predict ("why are checkout requests from Android in India slow since 14:00?"). That needs rich,
connected data.

Each signal has a job:

- **Metrics** are cheap to store and fast to query, perfect for dashboards and alerts: request rate, error
  rate, latency percentiles, queue depth, CPU and memory. They tell you **that** something is wrong.
- **Traces** follow one request through the load balancer, API, database and other services, showing where the
  time went. They tell you **where**.
- **Logs** hold the detailed context of individual events: inputs, decisions, error messages. They tell you
  **why**.

Linking them is what makes them powerful: every log line carries the **trace ID**, so from a slow trace you
jump to its logs, and from an error log you open the full trace.

**SLIs, SLOs and error budgets** turn reliability into a number. An SLI (indicator) is something measured,
such as the share of requests that succeed in under 300 ms. An SLO (objective) is the target: 99.9% over 30
days. The remaining 0.1% is the **error budget**: while it lasts, the team ships features freely; when it is
spent, reliability work comes first. This replaces arguments about "is it reliable enough?" with data.

**Alert on symptoms, not causes.** Page someone when users are affected (error rate up, latency SLO burning
fast), not every time a CPU spikes. Noisy alerts get ignored, and ignored alerts miss real incidents.

## How it works

Instrumenting an API service:

1. **Logs**: emit JSON with fields like `timestamp`, `level`, `message`, `trace_id`, `user_id`, `route`,
   `status`, `duration_ms`. Never log passwords, tokens or full card numbers; mask personal data where
   regulations (such as GDPR) require it.
2. **Metrics**: a counter of requests by route and status, a **histogram** of request duration (so you can
   compute p50/p95/p99), and gauges for things like queue depth and connection pool usage.
3. **Traces**: the OpenTelemetry SDK creates a span per request and child spans for database queries and
   outgoing calls, passing the trace context to other services in HTTP headers (`traceparent`).
4. **Dashboards** show the golden signals per service; **alerts** fire when the SLO's error budget is burning
   too fast (for example 2% of the monthly budget in one hour).
5. During an incident: the alert shows **that** checkout errors rose, the trace shows **where** (the payment
   call times out), and the logs show **why** (a new certificate on the provider side was rejected).

## Trade-offs

More data means better answers but higher cost: logs at high volume are expensive to store and search, so use
log levels, sampling and retention limits. Metrics are cheap but lose detail, and labels with unbounded
values (user IDs) can explode storage. Traces are usually **sampled** (keep 1–10%, plus all errors and slow
requests). Vendor platforms (Datadog, New Relic, Azure Monitor) are quick to adopt but costly at scale;
open-source stacks (Prometheus, Grafana, Loki, Tempo, Jaeger) need operating. OpenTelemetry keeps you free to
switch backends.

## Common mistakes

- **Unstructured logs** (`print("error happened")`) that can't be searched or aggregated.
- **Logging secrets or personal data.**
- **Averages instead of percentiles**, hiding the slow tail.
- **High-cardinality metric labels** such as user or request IDs.
- **Alerting on every cause**, producing noise and alert fatigue.
- **No correlation IDs**, so a request can't be followed across services.

## In interviews

Expect: logs versus metrics versus traces, the golden signals, SLI/SLO/SLA and error budgets, what you would
put on a dashboard for this design, what you would alert on, how distributed tracing works, and how you
debugged a real production incident. Concrete stories score highly, such as "we added GDPR-compliant structured
logging with trace IDs, which cut investigation time from hours to minutes".

Likely follow-up questions:

- What would you alert on for this service, and what would you only put on a dashboard?
- What is the difference between an SLO and an SLA?
- How does a trace follow a request across services?
- How do you keep logging costs under control?
