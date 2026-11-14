## In short

A **monolith** is one application deployed as a unit; **microservices** split a system into small services,
each owning one business capability and its own data, deployed independently and talking over the network.
Microservices let many teams ship and scale parts independently, at the cost of network calls, partial
failures, distributed data, and much more operational work. For most products and small teams, a
**well-structured modular monolith** is the right start; split out services when a clear reason appears
(team independence, very different scaling needs, isolation of risky parts).

## The idea

A monolith is not a bad word. One codebase, one deploy, one database: function calls instead of network
calls, real transactions, simple debugging and easy refactoring. Its problems appear with size: many teams
stepping on each other in one codebase, slow test suites and deploys, and the whole app scaled or redeployed
for a change in one corner.

Microservices answer those **organisational** problems. Each service is owned by one team, has its own
repository or folder, its own database, and its own deploy pipeline. The checkout team can ship five times
a day without coordinating with the search team. A CPU-heavy service can scale separately from a light one.
A failure in recommendations need not break checkout.

The cost is that everything that was easy becomes distributed:

- A function call becomes a network call that can be slow, fail, or succeed without you knowing.
- A database transaction across two services is no longer available; you need sagas and eventual
  consistency.
- Debugging needs distributed tracing; deploying needs service discovery, contracts and versioned APIs.
- You need platform work: CI/CD per service, containers, orchestration, monitoring, secrets.

The key design rule is **split along business capabilities with their own data** (orders, payments,
catalogue, users), not technical layers (a "database service", a "validation service"). Services sharing one
database are a **distributed monolith**: all the costs of distribution and none of the independence.

A **modular monolith** is the middle path: one deployable application, but internally divided into modules
with clear boundaries, separate data ownership, and no reaching into each other's tables. If one module
later needs to become a service, the seam already exists.

## How it works

Extracting a notifications service from a monolith (the "strangler fig" approach):

1. Inside the monolith, put all notification code behind one interface (`notify(user_id, template, data)`).
2. Build the new service with its own database for templates and delivery logs, consuming events or
   exposing an API.
3. Route a small share of notifications to the new service behind a feature flag; compare results.
4. Move traffic gradually to 100%, then delete the old code.
5. Add timeouts, retries and a queue between them, so a slow email provider can no longer slow down the
   main app.

## Trade-offs

Monoliths win on simplicity, performance (no network hops), consistency (real transactions) and speed of
change for small teams. Microservices win on team autonomy, independent deploys and scaling, technology
choice per service, and fault isolation, but only once the organisation is big enough to benefit and has the
platform maturity to run them. The cost of getting boundaries wrong is high: chatty services with many
synchronous calls per request are slower and less reliable than the monolith they replaced.

## Common mistakes

- **Starting with microservices** for a new product with one small team.
- **Splitting by technical layer** instead of business capability.
- **Shared databases** between services.
- **Long chains of synchronous calls**, where availability multiplies down: five services at 99.9% each
  give about 99.5%.
- **No timeouts, retries or circuit breakers** between services.
- **No tracing or central logging**, making failures impossible to follow.

## In interviews

Expect "monolith or microservices for this system, and why?", how to choose service boundaries, how
services communicate (REST, gRPC, events), how to handle data and transactions across services (database per
service, sagas, outbox), how to migrate a monolith gradually, and what platform pieces you need. Balanced
answers win: describe the conditions under which you would split, not a belief that one style is always
better.

Likely follow-up questions:

- When would you split a monolith, and how would you do it safely?
- How do you keep data consistent across services without distributed transactions?
- What is a distributed monolith?
- How do services find and call each other?
