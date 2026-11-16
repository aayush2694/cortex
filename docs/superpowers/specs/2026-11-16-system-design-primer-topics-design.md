# System Design Primer topics — design

Status: approved by Aayush on 2026-11-16 (in chat).

## Why

Aayush compared Cortex's System design section with the System Design Primer
(github.com/donnemartin/system-design-primer) and wants the section to be complete. Cortex already
covers most of the primer; these are the topics it lacks.

## What

Four new `system-design` topics, each a full guide following the existing guide rules
(`docs/superpowers/specs/2026-11-14-topic-guides-design.md`): required sections for the track,
at least 600 prose words (aim 700–900), key ideas (4–5), 2–4 links from the allowlist.

| id | Title | Covers | requires | difficulty |
|---|---|---|---|---|
| `reverse-proxies` | Reverse Proxies & API Gateways | what a reverse proxy does (TLS termination, compression, caching, hiding servers), Nginx-style setup, API gateways (auth, rate limits, routing), reverse proxy vs load balancer | `load-balancing`, `networking-basics` | 2 |
| `service-discovery` | Service Discovery | how services find each other: DNS, registries (Consul, etcd), health checks, client-side vs server-side discovery, Kubernetes services | `microservices`, `load-balancing` | 3 |
| `back-of-envelope` | Back-of-the-Envelope Estimation | latency numbers every engineer should know, powers of two, worked traffic / storage / bandwidth estimates, a runnable Python estimate | `sd-fundamentals` | 2 |
| `web-security` | Web Security Basics | HTTPS, authentication vs authorisation, the 6–7 interview-relevant risks (injection, XSS, CSRF, SSRF, broken access control, secrets, missing rate limits), linking OWASP for the rest | `api-design`, `networking-basics` | 3 |

All `phase: 3`, like the other system design topics.

Changes to existing content:

- **Message Queues guide:** add task queues (scheduled and delayed jobs, priorities) and back
  pressure (bounded queues, rejecting or slowing producers) to the existing sections; add a key
  idea about back pressure.
- **System Design Fundamentals guide:** shorten its back-of-the-envelope paragraph to one or two
  lines pointing to the new topic, so the maths is not explained twice. Keep it above 600 words.

## Approaches

| | Approach | Decision |
|---|---|---|
| A | 4 new topics + extend Message Queues | **Chosen**: no duplication; task queues are already covered by Message Queues and Django background jobs |
| B | 5 new topics including "Task Queues & Back Pressure" | Rejected: a third place explaining the same job-queue ideas |
| C | Only add primer links to existing topics | Rejected: Aayush wants the section complete |

## Rules

- Written in our own words; the primer is a link, not a source to copy (it is CC BY 4.0, but the
  guides policy is original text with tested examples).
- `back-of-envelope` has a ```python run block (estimates checked with asserts). Others may use
  display-only code or none.
- Web Security stays focused; if it cannot fit well in about 1.5 pages, stop and propose a split
  into "Web Security Basics" and "Auth & Sessions" instead of cramming.
- Links: the primer plus official docs. New allowlist hosts, if needed, are the official sites of
  the tools named (e.g. `nginx.org`, `owasp.org`, `kubernetes.io`, `developer.hashicorp.com`) and
  are listed for Aayush in the review.
- All existing checks pass, including the live link check.

## Out of scope

Primer case studies (web crawler, Twitter search, Mint, social graph, KV store, sales rank, AWS
scaling) and object-oriented design questions: possible later, separately.

## Review

Aayush reviews the four new guides and the two edited guides before anything is pushed.
