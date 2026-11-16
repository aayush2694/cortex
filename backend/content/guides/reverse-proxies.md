## In short

A **reverse proxy** is a server that sits in front of your application servers and receives every
request first. Clients only ever talk to the proxy; it forwards each request to an app server and
sends the answer back. On the way it can terminate HTTPS, compress responses, cache them, serve
static files, add security headers, limit request sizes and hide your internal servers. Nginx,
HAProxy, Caddy, Envoy and cloud services such as Cloudflare play this role. An **API gateway** is a
reverse proxy specialised for APIs: it adds authentication, rate limiting, request routing to many
services and API keys in one place.

## The idea

Think of a hotel reception desk. Guests never walk straight to the kitchen or the laundry; they ask
reception, which knows where everything is, checks who they are, and passes requests to the right
department. The departments can be moved, replaced or doubled without guests noticing.

A web application benefits in the same way. Your Python or Java process is good at running business
logic but poor at the generic work every request needs: decrypting TLS, gzipping large responses,
handling thousands of slow mobile connections, sending the same logo file a million times. A reverse
proxy built for this job does that work, and your app only sees clean, already-decrypted
requests on a private network.

The words get mixed up, so it helps to separate them:

- A **forward proxy** acts for clients (a company proxy that employees' browsers go through). The
  website sees the proxy, not the employee.
- A **reverse proxy** acts for servers. The client sees the proxy, not your servers.
- A **layer 7 load balancer** is a reverse proxy whose main job is spreading requests over several servers.
  A reverse proxy is useful even with a single server, for TLS, caching and protection.
- An **API gateway** is a reverse proxy with API-specific features. In a microservices system it is
  the single front door: `/orders/*` goes to the order service, `/users/*` to the user service, and
  authentication and rate limits are checked once at the edge instead of in every service.

## How it works

A request to `https://shop.example.com/api/orders/42` through Nginx in front of a Django app:

1. The browser opens a TLS connection to the proxy. The proxy holds the certificate and decrypts the
   request (TLS termination), so the app servers don't need certificates.
2. The proxy checks simple rules: request body under 10 MB, the client is not over its rate limit,
   the path is allowed.
3. Static paths such as `/static/` are answered straight from disk or the proxy cache, never reaching
   the app.
4. `/api/` requests are forwarded to an upstream app server over plain HTTP on the private network.
   The proxy adds headers such as `X-Forwarded-For` (the client's real IP) and `X-Forwarded-Proto`
   (the original scheme), so the app can log the real client and build correct links.
5. Slow clients are buffered: the proxy reads the whole request from a slow phone, sends it to the
   app in one go, and later trickles the response back. The app worker is freed in milliseconds
   instead of being tied up for seconds.
6. The response is compressed, security headers are added, and it is returned to the client.

The app must trust the forwarded headers **only** from the proxy. Otherwise a client can send its
own `X-Forwarded-For` and pretend to be someone else, which breaks IP-based rate limits and logs.
The proxy's `$proxy_add_x_forwarded_for` appends the client address to whatever the client sent, so a
spoofed value still arrives as the leftmost entry. The app should read the rightmost entry added by
its own proxy, never the first.

## Code

```text
# nginx.conf (excerpt): TLS at the edge, static files, API forwarded to the app
server {
    listen 443 ssl;
    server_name shop.example.com;
    ssl_certificate     /etc/ssl/shop.pem;
    ssl_certificate_key /etc/ssl/shop.key;
    client_max_body_size 10m;
    gzip on;
    gzip_types application/json text/css application/javascript;

    location /static/ {
        root /srv/shop;                      # served without touching the app
        expires 30d;
    }

    location /api/ {
        proxy_pass http://app_servers;        # upstream group on the private network
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

upstream app_servers {
    server 10.0.1.11:8000;
    server 10.0.1.12:8000;                    # two servers: now it also load balances
}
```

## Trade-offs

A reverse proxy adds one more hop and one more component to run, monitor and keep highly available;
if it is a single box, it is a single point of failure, so production setups run at least two or use
a managed edge (Cloudflare, AWS ALB, Azure Front Door). In exchange you get security, speed and
flexibility almost for free. API gateways centralise cross-cutting rules, which keeps services simple,
but a gateway that grows business logic becomes a bottleneck every team has to change; keep it to
routing, authentication, limits and observability. Managed gateways save operations work but cost
more and tie you to a provider; self-hosted Nginx or Envoy is cheap and flexible but yours to run.

## Common mistakes

- **Trusting `X-Forwarded-For` from anyone**, which lets clients fake their IP.
- **Forgetting `X-Forwarded-Proto`**, so the app thinks requests are plain HTTP and builds `http://`
  redirect loops.
- **A single proxy instance** in front of everything.
- **Caching personalised responses** at the proxy, serving one user's page to another.
- **Business logic in the gateway**, turning it into a shared monolith.
- **Timeouts that don't match**: the proxy giving up at 30 s while the app keeps working for 60 s.

## In interviews

Expect "what is a reverse proxy, and how is it different from a load balancer?", "what would you put
at the edge of this system?", and "how do services behind a gateway authenticate users?". A strong
answer lists the concrete jobs (TLS termination, compression, caching, buffering slow clients,
hiding servers, rate limiting), explains forward versus reverse proxies, and mentions real setups,
such as Nginx in front of Gunicorn for a Django app.

Likely follow-up questions:

- How does the app learn the client's real IP address, and how do you stop it being spoofed?
- When would you use an API gateway instead of calling services directly?
- What happens if the reverse proxy goes down?
- Where would you terminate TLS, and is traffic behind the proxy safe unencrypted?
