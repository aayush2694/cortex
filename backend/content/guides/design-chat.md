## In short

A chat system delivers messages between users in real time, for one-to-one and group conversations, with
history, delivery and read receipts, presence (online/offline) and notifications for offline users. Online
clients keep a **persistent WebSocket** to a **gateway** server so messages can be pushed instantly. Because
sender and receiver may be connected to different gateways, messages are routed through a **pub/sub** layer
(Redis, Kafka, NATS). Messages are stored durably, ordered **per conversation** with sequence numbers, and
offline users get **push notifications** and **sync** missed messages when they reconnect.

## The idea

HTTP is request and response: the client asks, the server answers. Chat needs the opposite as well: the
server must push a message the instant it arrives. Polling every few seconds wastes requests and adds delay.
A **WebSocket** keeps one long-lived, two-way connection per device, so the server can push at any time.

Millions of open connections don't fit on one server, so a fleet of **gateway** servers holds them. When Asha
(connected to gateway 3) messages Ben (connected to gateway 7), gateway 3 can't reach Ben directly. Two common
approaches:

1. A **presence/session registry** (in Redis) records which gateway holds each user's connections; the message
   is sent to that gateway.
2. Each gateway **subscribes** to channels for the users or conversations it serves; the chat service
   **publishes** each message to the conversation's channel, and every gateway with a member connected receives
   it.

**Ordering** matters: messages in a conversation must appear in the same order for everyone. Device clocks
can't be trusted, so the server assigns each message a **sequence number per conversation** (or a time-ordered
ID). Clients sort by it, detect gaps, and request what they missed.

**Delivery guarantees**: networks drop connections constantly on mobile. The client sends each message with a
**client-generated ID**, so a retried send is deduplicated. The server stores the message first, then
acknowledges, then fans it out. Each device tracks the last sequence it has seen and **syncs** from there after
reconnecting.

## How it works

Asha sends "On my way" to a group of five:

1. Her app sends `{client_msg_id, conversation_id, text}` over its WebSocket to gateway 3.
2. The chat service checks she is a member, assigns `seq = 1042`, and writes the message to the message store,
   partitioned by `conversation_id` (Cassandra, ScyllaDB or sharded PostgreSQL suit this append-heavy, recent-first
   access pattern).
3. It acknowledges to Asha (her app shows one tick) and publishes the message to the conversation's channel.
4. Gateways with online members push it over their WebSockets. Each recipient device acknowledges, which updates
   delivery receipts (two ticks).
5. For members with no active connection, a notification service sends a push through APNs or FCM.
6. When Ben opens the app later, it reconnects and asks "messages in this conversation after seq 1037", getting
   everything he missed.
7. **Presence** comes from connection heartbeats stored with short TTLs; it is only shown to contacts and updated
   lazily, since broadcasting every status change to everyone is expensive.

## Trade-offs

WebSockets give instant delivery but stateful servers, which complicates load balancing and deploys (clients
must reconnect and resync). Server-sent events or long polling are simpler fallbacks. Routing via a central
registry is precise but adds a lookup; broadcasting via pub/sub is simpler but sends messages to gateways that
may not need them. Very large groups (thousands of members) often switch from pushing every message to having
clients pull. End-to-end encryption protects privacy but means the server cannot search, moderate or index
message content.

## Common mistakes

- **Ordering by client timestamps**, which differ across devices.
- **Acknowledging before storing**, which loses messages if the server crashes.
- **No deduplication** of retried sends, producing double messages.
- **Assuming the receiver is on the same server** as the sender.
- **Broadcasting presence** for every user to every contact in real time.
- **Ignoring reconnect storms**: after a gateway deploy, thousands of clients reconnect at once; add jitter.

## In interviews

"Design WhatsApp / Slack / Messenger" is a classic. Clarify scope (one-to-one and groups, group size, media,
receipts, presence, encryption), estimate (connections, messages per second, storage), then cover WebSocket
gateways, routing between gateways, message storage and partitioning, ordering with sequence numbers, delivery
guarantees with client IDs and acknowledgements, offline sync and push notifications, presence, and media through
object storage and a CDN.

Likely follow-up questions:

- How does a message reach a user connected to a different server?
- How do you guarantee message order within a group?
- What happens if the receiver is offline for a week?
- How would you store billions of messages, and how would you partition them?
