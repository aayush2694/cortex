## In short

In an event-driven architecture, services announce **events** (facts that already happened, such as
`OrderPlaced` or `PaymentFailed`) instead of calling each other directly, and any interested service
reacts. **Publish/subscribe** delivers each event to every subscriber, so new features can be added
without touching the publisher. **Event sourcing** stores every change as an event and rebuilds state by
replaying them. **CQRS** separates the model used for writes from the models used for reads. **Sagas**
coordinate multi-step business processes across services. The price is **eventual consistency** and
harder debugging.

## The idea

In a request-driven design, the order service calls inventory, then payment, then email, then
analytics. It must know all of them, wait for all of them, and fail if any is down. Every new feature
("also notify the warehouse") means changing the order service.

Event-driven design inverts this. The order service publishes `OrderPlaced` and is done. Inventory,
payment, email and analytics each subscribe and react on their own schedule. Adding the warehouse means
adding a new subscriber; the order service doesn't change. Services become loosely coupled in time (they
don't need to be up at the same moment) and in knowledge (they don't need to know each other).

It helps to separate **events** from **commands**. A command (`ChargeCard`) asks one specific service to do
something and can be refused. An event (`CardCharged`) states a fact; anyone may listen and nobody can
refuse it. Name events in the past tense.

**Event sourcing** goes further: instead of storing the current balance, store every `Deposited` and
`Withdrawn` event and compute the balance by replaying them. You get a complete audit trail and can
rebuild state or create new views from history, but queries need projections, and changing event formats
over time takes care.

**CQRS** (command query responsibility segregation) pairs well with it: writes go to a model built for
validation and consistency; events update one or more **read models** shaped for specific screens
(a denormalised order summary, a search index). Reads are fast, but they lag slightly behind writes.

## How it works

Checkout as a **choreographed saga**:

1. Order service saves the order as `PENDING` and publishes `OrderPlaced`.
2. Payment service hears it, charges the card, and publishes `PaymentSucceeded` or `PaymentFailed`.
3. Inventory service hears `PaymentSucceeded`, reserves stock, and publishes `StockReserved` or
   `OutOfStock`.
4. Order service marks the order `CONFIRMED` on `StockReserved`. On `OutOfStock` it publishes
   `OrderCancelled`, and payment reacts with a **compensating action**: a refund.
5. There is no distributed transaction: each step commits locally, and failures are undone by
   compensations.

An **orchestrated saga** instead has one coordinator that sends commands and tracks progress. It is easier
to follow and change for complex flows, at the cost of a central component.

## Trade-offs

Events give loose coupling, independent scaling, resilience to temporary outages, and a natural audit log.
They cost **eventual consistency** (the user may see "processing" for a moment), harder debugging (a flow
is spread over many services; you need correlation IDs and tracing), duplicate and out-of-order events,
and schema evolution of events that many teams depend on. For a small system or a simple workflow, direct
calls inside a monolith are simpler and perfectly fine. Use events where decoupling or fan-out pays for
the complexity.

## Common mistakes

- **Events that are really commands** ("SendEmail"), which recreates tight coupling.
- **Huge events carrying entire records**, or tiny ones that force every consumer to call back for details;
  include what consumers commonly need, plus IDs.
- **Assuming exactly-once, in-order delivery**; consumers must be idempotent and tolerate reordering.
- **No schema versioning**, so changing an event breaks unknown consumers.
- **Publishing outside the database transaction**; use the outbox pattern.
- **Event sourcing everything**, including simple CRUD data that gains nothing from it.

## In interviews

Expect: when to choose events over direct calls, pub/sub versus queues, events versus commands, the
outbox pattern, sagas with compensation versus distributed transactions, choreography versus
orchestration, eventual consistency in the user experience, and event sourcing and CQRS with their costs.
Interviewers value candidates who know when **not** to use these patterns.

Likely follow-up questions:

- How would you handle a payment that succeeds when stock then runs out?
- How do you trace one order's journey across five services?
- How do you change an event's format without breaking consumers?
- When is event sourcing worth its complexity?
