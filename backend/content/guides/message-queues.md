## In short

A message queue lets one part of a system (the **producer**) hand work or information to another part
(the **consumer**) without waiting for it, through a broker that stores messages until they are
processed. Queues **decouple** services, **level load** (absorb spikes and let consumers catch up), and
make slow or unreliable work asynchronous. Most deliver **at least once**, so consumers must be
**idempotent**. Failing messages go to a **dead-letter queue** after a few retries. Classic queues
(RabbitMQ, SQS) delete messages once processed; **logs** (Kafka, Kinesis) keep them for replay by many
consumers.

## The idea

A restaurant does not make the waiter cook. The waiter puts an order ticket on the rail and goes back to
customers; cooks take tickets at their own pace. If twenty orders arrive at once, tickets pile up for a few
minutes, but nobody is turned away and the waiter stays fast. If a cook goes home, the tickets wait for the
next one.

That is what a queue gives software:

- **Responsiveness**: the API returns as soon as the message is stored, not when the email is sent or
  the video is encoded.
- **Load levelling**: a flash sale's burst of orders waits in the queue instead of overwhelming the
  payment or warehouse services.
- **Resilience**: if consumers are down, messages wait; nothing is lost.
- **Decoupling**: the producer doesn't know or care which service processes the message, or how many.

**Delivery guarantees** matter. **At most once** may lose messages. **At least once** never loses them
but may deliver duplicates: a consumer can process a message and crash before acknowledging it, so it is
redelivered. **Exactly once** end to end is very hard; in practice you build at-least-once delivery plus
**idempotent consumers** (processing twice has the same effect as once, for example by recording processed
message IDs or using unique constraints).

**Ordering**: most queues don't guarantee global order. Kafka guarantees order within a **partition**, so
messages with the same key (for example the same order ID) go to the same partition and stay in order.

## How it works

Order processing with a queue:

1. The checkout API saves the order and publishes `{"type": "OrderPlaced", "order_id": 981}`.
2. The broker stores it durably. The API returns `202 Accepted` to the user.
3. A consumer **receives** the message; the broker hides it from other consumers for a **visibility
   timeout** (SQS) or until it is acknowledged (RabbitMQ).
4. The consumer charges the card using the order ID as the idempotency key, then **acknowledges**
   (deletes) the message.
5. If processing throws, the message becomes visible again and is retried, ideally with backoff. After,
   say, 5 failures it moves to a **dead-letter queue**, so one poisoned message doesn't block the rest and
   someone can inspect it.
6. A problem remains: what if the order is saved but the publish fails? The **transactional outbox**
   pattern writes the message into an `outbox` table in the same database transaction as the order, and a
   relay publishes rows from that table.

## Trade-offs

Queues add a broker to run and monitor, eventual consistency (work happens later), harder debugging
across asynchronous hops, and the need for idempotency everywhere. Classic queues suit task distribution
(each message handled once by one worker). Logs suit event streams read by many independent consumers,
replay, and very high throughput, at the cost of more operational complexity. For simple background jobs
inside one app, a job library on Redis or the database (Celery, RQ, Sidekiq) is often enough.

## Common mistakes

- **Non-idempotent consumers** that double-charge or double-email on redelivery.
- **Acknowledging before processing**, which loses messages on crash.
- **No dead-letter queue**, so one bad message is retried forever and blocks or floods the system.
- **Publishing outside the database transaction** (dual write), so orders and messages disagree.
- **Unbounded queues without monitoring**: a growing backlog is an early warning; alert on queue depth
  and message age.
- **Huge messages**; send an ID or a storage reference instead of the whole payload.

## In interviews

Queues appear in most designs with slow or bursty work: order processing, notifications, video encoding,
feeds. Expect: why use a queue here, at-least-once versus exactly-once, idempotency, ordering and
partitions, retries with backoff and dead letters, back pressure, the outbox pattern, and Kafka versus
RabbitMQ versus SQS. Concrete examples help: "we moved invoice generation to a queue and the checkout API
dropped from 2 s to 150 ms".

Likely follow-up questions:

- What happens if a consumer crashes halfway through a message?
- How do you avoid processing a message twice?
- How do you keep messages in order for one customer?
- How do you make sure the database write and the message publish both happen?
