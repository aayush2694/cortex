## In short

When you open a web page, the browser **resolves the name** with DNS, opens a **TCP** connection (or
QUIC over UDP for HTTP/3), performs a **TLS handshake** to encrypt it, sends an **HTTP** request, and
receives a response. Each step adds round trips, and round trips across the internet are slow: tens to
hundreds of milliseconds each. Much of web performance is about avoiding them: DNS caching, keep-alive
connections, HTTP/2 multiplexing, TLS session resumption, CDNs that put servers close to users, and
fewer, larger requests.

## The idea

The internet is built in layers, each solving one problem so the layer above can ignore it:

- **IP** moves packets from one address to another, with no guarantees: packets can be lost, duplicated
  or arrive out of order.
- **TCP** builds a reliable, ordered byte stream on top of IP: it numbers bytes, acknowledges them,
  retransmits lost ones, and slows down when the network is congested.
- **UDP** is a thin layer over IP with no reliability: faster and simpler, used for DNS queries, video
  calls and games, where a late packet is useless anyway.
- **TLS** encrypts and authenticates a connection, so nobody in between can read or alter it, and you
  know you are talking to the real server (thanks to its certificate).
- **HTTP** is the request/response language on top: methods, paths, headers, status codes, bodies.

**DNS** is the internet's phone book. Your computer asks a resolver for `example.com`; the resolver asks
the root servers, then the `.com` servers, then example.com's own name servers, and caches the answer
for its **TTL**. Most lookups are answered from a cache in milliseconds.

**HTTP versions** differ mainly in how they use connections. HTTP/1.1 handles one request at a time per
connection, so browsers open several. HTTP/2 multiplexes many requests over one TCP connection. HTTP/3
runs over QUIC (on UDP), which avoids TCP's head-of-line blocking, where one lost packet stalls every
stream, and makes connection setup faster.

## How it works

Typing `https://shop.example.com/cart` into a browser:

1. **DNS**: the browser checks its cache, then the OS, then the resolver, and gets an IP address.
2. **TCP handshake**: SYN, SYN-ACK, ACK. One round trip before any data flows.
3. **TLS 1.3 handshake**: client and server agree on keys and the server proves its identity with a
   certificate. One more round trip (TLS 1.2 needed two).
4. **HTTP request**: `GET /cart` with headers such as `Host`, `Cookie` and `Accept-Encoding`.
5. **Server work**: load balancer, application, database. Often the only part developers look at.
6. **Response**: status `200`, headers like `Content-Type` and `Cache-Control`, and a (usually
   compressed) body. The browser then fetches CSS, JavaScript and images, reusing the open connection.

With a 100 ms round trip, steps 2–4 cost about 300 ms before the server even starts working. That is why
connection reuse, CDNs (shorter round trips) and HTTP/3 (fewer of them) matter so much.

## Trade-offs

TCP gives reliability at the cost of latency and head-of-line blocking; UDP gives speed but leaves
reliability to the application. HTTP/2 and HTTP/3 reduce connection overhead but are more complex to
debug. Long DNS TTLs reduce lookups but slow down failover when an IP changes; short TTLs do the opposite.
REST over HTTP is universal and cacheable; WebSockets keep a connection open for real-time pushes but are
harder to scale and load balance; gRPC uses HTTP/2 for fast, typed service-to-service calls.

## Common mistakes

- **Opening a new connection per request** in services that call each other, instead of using a
  connection pool with keep-alive.
- **Chatty APIs** that need many sequential round trips for one screen.
- **Forgetting DNS TTLs** during migrations, so clients keep hitting the old servers.
- **Ignoring status code meaning**: 4xx means the client should change the request; 5xx means the
  server failed and a retry may help.
- **No compression or caching headers** on large text responses.
- **Assuming the network is reliable** and not setting timeouts.

## In interviews

The classic question is "what happens when you type a URL into a browser and press Enter?". A strong
answer walks the layers in order (DNS, TCP, TLS, HTTP, server, rendering) and mentions caching at each
step. Expect follow-ups on TCP versus UDP, HTTP status codes, HTTP/1.1 versus 2 versus 3, how TLS
certificates prove identity, and how cookies and headers work.

Likely follow-up questions:

- What is the difference between TCP and UDP, and when would you use each?
- Why is HTTP/2 faster than HTTP/1.1 for a page with many assets?
- What does the TLS handshake achieve?
- How does DNS caching affect a server migration?
