## In short

A load balancer sits in front of a group of servers and spreads incoming requests across them, so no
single server is overwhelmed and the failure of one server does not take the service down. It removes
unhealthy servers using **health checks**, and it lets you add or remove servers without clients
noticing. **Layer 4** balancers route by IP address and port; **layer 7** balancers understand HTTP and
can route by path, header or cookie, terminate TLS, and retry. Common algorithms are round robin, least
connections and hashing. For it to work well, application servers should be **stateless**.

## The idea

A supermarket with ten checkouts and one queue manager is the picture: the manager sends each customer
to a free till, closes a till when its cashier leaves, and opens new ones at rush hour. Customers just
see "the checkout".

Load balancers give three things at once:

1. **Scale**: add servers to handle more traffic.
2. **Availability**: if a server dies, health checks notice within seconds and traffic goes elsewhere.
3. **Easy operations**: deploy by taking servers out one at a time (rolling deploys), or send a
   small share of traffic to a new version (canary releases).

Choosing the **algorithm**:

- **Round robin** sends requests to servers in turn. Simple and fine when requests are similar and
  servers are identical. Weighted round robin sends more to bigger servers.
- **Least connections** sends each request to the server with the fewest active connections, which
  copes better when some requests are slow.
- **Hashing** on a client IP or key sends the same client to the same server, useful for caches local to
  a server. Consistent hashing keeps most assignments stable when servers change.

**Statelessness** is what makes this work. If a user's session lives in one server's memory, every
request from that user must go back to that server ("sticky sessions"), which spreads load unevenly and
loses sessions when the server dies. Storing sessions in Redis or the database, or using signed tokens,
lets any server handle any request.

## How it works

A typical web setup:

1. DNS for `api.example.com` points to the load balancer, which itself runs as a redundant pair or a
   managed cloud service (AWS ALB, Azure Application Gateway, GCP Load Balancing).
2. The balancer terminates TLS, so app servers receive plain HTTP on the private network.
3. Every few seconds it calls `GET /healthz` on each server. After a few failures, the server is removed
   from rotation; after a few successes, it returns.
4. A layer 7 rule sends `/api/*` to the API servers and `/static/*` to a storage bucket or CDN.
5. During a deploy, each old server is **drained**: it stops receiving new requests, finishes the ones in
   progress, then shuts down while new servers take over.

A health check should test that the server can do its job (for example that it can reach the database),
but it must be cheap and must not fail just because one optional dependency is down; otherwise every
server is removed at once.

## Trade-offs

Layer 4 balancing is faster and protocol-agnostic but cannot route on content. Layer 7 is more flexible
(path routing, header-based canaries, retries, TLS termination) but does more work per request. Managed
cloud balancers remove operational work and scale automatically, while self-run Nginx or HAProxy gives
full control at the cost of maintaining it. Sticky sessions are a quick fix for stateful apps but undermine
even load and failover; making the app stateless is the better long-term answer.

## Common mistakes

- **A single load balancer** with no redundancy, which becomes the new single point of failure.
- **Health checks that are too shallow** (always return 200) or **too deep** (fail when an optional
  service is down, removing every server).
- **Stateful servers** that keep sessions or uploads on local disk.
- **No connection draining**, so deploys cut off in-flight requests.
- **Retrying non-idempotent requests** at the balancer, which can duplicate side effects.
- **Forgetting the original client IP** behind the balancer (use `X-Forwarded-For` safely).

## In interviews

Load balancers appear in almost every design diagram, so be ready to justify them: where they sit, how
health checks work, which algorithm fits, layer 4 versus layer 7, how sessions are handled, how to avoid
the balancer being a single point of failure, and how rolling and canary deploys use it. Mention global
load balancing (GeoDNS or anycast) for multi-region designs.

Likely follow-up questions:

- Round robin or least connections: which would you choose here, and why?
- How do you handle user sessions behind a load balancer?
- What should a health check endpoint verify?
- How would you route 5% of traffic to a new version?
