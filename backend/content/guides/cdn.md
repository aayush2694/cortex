## In short

A content delivery network (CDN) is a worldwide network of **edge servers** that keep copies of your
content close to users. A user in Mumbai downloads your JavaScript bundle from a nearby edge instead of
your origin server in Virginia, cutting each round trip from ~200 ms to ~20 ms and taking that traffic
off your servers. CDNs are ideal for static assets (images, video, CSS, JavaScript, fonts) and can also
cache API responses and whole pages. **Cache-Control** headers decide what is cached and for how long;
**fingerprinted file names** let you cache assets "forever" yet ship updates instantly.

## The idea

Light in fibre still needs time to cross the planet, and each request may need several round trips.
No amount of server optimization fixes distance. A CDN fixes it by moving the content.

The first user near an edge triggers a **cache miss**: the edge fetches the file from your **origin**
(your server or storage bucket), stores it, and serves it. Every later user near that edge gets a
**hit**, served locally. Popular assets end up cached at hundreds of locations.

Two header ideas control almost everything:

1. **`Cache-Control`** on the response: `public, max-age=31536000, immutable` means "anyone may cache this
   for a year and it will never change". `no-store` means never cache (private data). `s-maxage` sets a
   separate lifetime for shared caches like CDNs.
2. **Cache keys**: the edge stores one copy per URL (plus anything else you configure, such as certain
   headers or query parameters). If the key includes a parameter that varies per user, the hit ratio
   collapses.

**Fingerprinting** solves the "cache forever versus ship updates" dilemma. Build tools name files after
a hash of their content: `app.3f9a1c.js`. The HTML references that exact name. When the code changes, the
hash and the name change, so browsers and CDNs fetch the new file, while the old file can stay cached
forever. Only the small HTML page needs a short cache lifetime.

Modern CDNs also run code at the edge (redirects, authentication checks, A/B tests), terminate TLS close
to users, absorb DDoS attacks, and offer a web application firewall.

## How it works

Shipping a frontend release:

1. The build outputs `index.html` plus fingerprinted assets like `main.8c1e2f.js` and `styles.a90b.css`.
2. Assets are uploaded to object storage behind the CDN with `Cache-Control: public, max-age=31536000,
   immutable`.
3. `index.html` is served with `Cache-Control: no-cache` (or a short `max-age`), so every visit checks
   for a new version. With `no-cache` the browser revalidates using an `ETag`, and gets a tiny
   `304 Not Modified` if nothing changed.
4. After deploying, the new `index.html` references new asset names. Old cached assets are simply no
   longer requested. No purge is needed.
5. For an urgent fix to something that isn't fingerprinted, you **purge** (invalidate) that URL at the
   CDN, which takes seconds to minutes to reach all edges.

## Trade-offs

CDNs dramatically improve latency and offload traffic, but add cost (per GB and per request), another
moving part, and caching surprises: a wrong header can serve one user's private page to another, or
keep a broken file cached. Caching dynamic API responses at the edge gives huge wins for public,
identical responses (product listings, articles) but is risky for anything personalised. Purging is
never instant everywhere, so design to avoid needing it.

## Common mistakes

- **Caching personalised or authenticated responses** as `public`, leaking data between users.
- **Long cache lifetimes on non-fingerprinted files**, so users get stale JavaScript after a deploy.
- **Query strings or cookies in the cache key** that make every request unique and ruin the hit ratio.
- **Relying on purges** as part of every deploy instead of fingerprinting.
- **Forgetting CORS headers** for fonts and scripts served from a different domain.
- **Exposing the origin** directly, letting attackers bypass the CDN's protection.

## In interviews

CDNs come up whenever a design serves media or a global audience: image hosting, video streaming,
news sites, e-commerce. Explain push versus pull CDNs (upload ahead of time versus fetch on first
request), cache headers, fingerprinting, invalidation, and what should and should not be cached at the
edge. For video, mention that files are split into small segments served by the CDN with adaptive
bitrate.

Likely follow-up questions:

- How do you deploy a new frontend version without users getting stale files?
- What should never be cached at a CDN?
- What is the difference between `no-cache` and `no-store`?
- How would you serve user-uploaded images globally?
