## In short

In a system of many services, instances start, stop, crash and move to new machines all the time, so
their addresses keep changing. **Service discovery** lets a service find the current, healthy
instances of another service by **name** ("orders") instead of a hard-coded IP address. A
**registry** (Consul, etcd, ZooKeeper, or the Kubernetes API) holds the list of instances; **health
checks** keep it accurate. Callers either ask the registry themselves and pick an instance
(**client-side discovery**) or send requests to a load balancer or DNS name that does it for them
(**server-side discovery**).

## The idea

A phone book works when people never move. Picture a company where people change desks every few
minutes: writing "Asha, desk 14" on a note is useless an hour later. You need a reception desk that
always knows where Asha currently sits, and that stops directing visitors to people who went home.

With a single monolith on two servers, you can put two IP addresses in a config file and forget about
it. With twenty services, each running between two and fifty instances in containers that are
replaced on every deploy and every autoscale event, a config file is out of date within minutes.
Hard-coded addresses mean failed calls to instances that no longer exist and new instances that
receive no traffic.

Discovery has three parts:

1. **Registration:** when an instance starts, it (or the platform) records "orders is at
   10.0.3.7:8000" in the registry.
2. **Health checking:** the registry or an agent regularly checks each instance (an HTTP `/healthz`
   call, a TCP connect, or the instance renewing a lease). Instances that stop answering are removed.
3. **Lookup:** callers resolve "orders" to the current list of healthy instances.

Where the lookup happens is the main design choice. In **client-side discovery**, the calling service
asks the registry and chooses an instance itself, often with a client library that caches the list
and balances requests. In **server-side discovery**, the caller just calls a stable name such as
`orders.internal`; a load balancer or the platform's networking resolves it. Kubernetes does this: a
**Service** gets a stable DNS name and virtual IP, and traffic is spread over the healthy pods behind
it.

## How it works

Calling the orders service from the checkout service in Kubernetes:

1. Three `orders` pods start. Kubernetes records them as endpoints of the `orders` Service once their
   **readiness probes** pass.
2. Checkout calls `http://orders.shop.svc.cluster.local/api/orders/42`. Cluster DNS resolves the name
   to the Service's stable virtual IP.
3. The node's networking forwards the connection to one of the ready pods.
4. One pod starts failing its readiness probe. Kubernetes removes it from the endpoints after a few
   failed probes (about 30 seconds with default settings), so new requests stop going to it, without anyone changing checkout's configuration.
5. A deploy replaces all three pods with new ones on different IPs. Checkout keeps using the same
   name throughout.

Outside Kubernetes, the same flow uses Consul: each instance registers with a local Consul agent that
runs its health check, and callers query Consul (through its DNS interface or HTTP API) for healthy
instances of `orders`.

DNS-based discovery has one classic trap: **caching**. Clients and resolvers keep DNS answers for
their TTL, and some runtimes cache them much longer, so a caller can keep sending traffic to an
instance that has already been removed. Short TTLs, connection timeouts and retries limit the damage.

## Trade-offs

Server-side discovery keeps callers simple and language-agnostic (any client that can do DNS and
HTTP works) at the cost of an extra hop and a component that must be highly available. Client-side
discovery avoids the hop and allows smarter balancing, but every language needs a client library and
logic is duplicated across services. A service mesh (Istio, Linkerd) moves discovery, retries and
mutual TLS into a sidecar proxy next to each instance, which removes the library problem but adds a
lot of moving parts. For a handful of services on a platform such as Kubernetes, Render or a cloud
load balancer, the platform's built-in discovery is almost always enough; running Consul yourself
pays off only for large or mixed environments.

## Common mistakes

- **Hard-coding IP addresses** in configuration for services that autoscale or redeploy.
- **Shallow health checks** that return OK while the service cannot reach its database, or **deep
  ones** that mark every instance unhealthy when one dependency blips.
- **Ignoring DNS caching**, so traffic keeps hitting removed instances.
- **No timeouts or retries** on calls to discovered instances, so one dead instance still causes errors.
- **The registry as a single point of failure**; registries such as Consul and etcd run as 3- or
  5-node clusters for this reason.

## In interviews

Service discovery comes up in microservices designs: "how does the payment service find the order
service?", "what happens when an instance dies?", "how do you deploy without dropping requests?".
Explain registration, health checks and lookup, compare client-side and server-side discovery, and
name a real implementation (Kubernetes Services and readiness probes, Consul, AWS Cloud Map). Link it
to load balancing and graceful shutdown for a complete answer.

Likely follow-up questions:

- What is the difference between client-side and server-side discovery?
- How quickly is a crashed instance removed, and what happens to requests in the meantime?
- Why can DNS-based discovery send traffic to instances that are gone?
- How does Kubernetes know a pod is ready to receive traffic?
