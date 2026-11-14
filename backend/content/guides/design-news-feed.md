## In short

A news feed shows each user recent posts from the people and pages they follow, usually ranked. The central
choice is **when** to assemble feeds. **Fan-out on write** (push) inserts each new post into every follower's
precomputed feed: reads are instant, but a post by someone with 50 million followers means 50 million writes.
**Fan-out on read** (pull) gathers posts from everyone you follow when you open the app: posting is cheap, reads
are slow. Large systems use a **hybrid**: push for normal accounts, pull for celebrities, merged at read time.
Feeds are stored in a cache as **lists of post IDs**, and post details are loaded separately.

## The idea

Opening the app must feel instant, and people read feeds far more than they post. That argues for doing work
**ahead of time**: when Asha posts, put the post ID at the top of each follower's feed list. When Ben opens the
app, read his list (a single cache lookup) and load the posts.

The problem is skew. Most accounts have hundreds of followers, but some have tens of millions. Pushing a
celebrity's post into 50 million feeds takes a long time and enormous write capacity, and most of those feeds
belong to people who won't open the app today.

The **hybrid** handles both. Accounts above a follower threshold are marked as celebrities and are **not**
fanned out. When Ben opens his feed, the service reads his precomputed list (posts from normal accounts) and
also fetches recent posts from the few celebrities he follows, then merges them. Precomputed feeds can also be
limited to **active users**, rebuilding others' feeds on demand when they return.

**Storing IDs, not posts** keeps feed lists small (a few hundred IDs per user in Redis) and means edits or
deletions only change the post itself. A **hydration** step loads post content, author info and counters in
batches from caches.

**Ranking** turns a chronological list into a "what you'll find most interesting" list, using signals such as
recency, how often you interact with the author, engagement on the post, and content type. Typically a cheap
step picks a few hundred candidates and a more expensive model orders them.

## How it works

Asha (2,000 followers) posts a photo:

1. The post service stores the post (database plus object storage for the image) and publishes `PostCreated`.
2. **Fan-out workers** consume the event, load Asha's follower IDs in batches, and push the post ID to the front
   of each follower's feed list in Redis, trimming each list to, say, the latest 800 IDs.
3. Ben opens the app. The feed service reads the first 50 IDs from his list, adds recent posts from the 3
   celebrities he follows, ranks the candidates, and hydrates them (post text, image URL from the CDN, author
   name, like count) using batched cache reads.
4. The response includes a **cursor** for the next page, so scrolling continues from where it stopped even as new
   posts arrive.
5. If Asha deletes the post, it is marked deleted; hydration skips it, so no fan-out is needed to remove it.

## Trade-offs

Push gives the fastest reads but heavy, skewed writes and wasted work for inactive users. Pull keeps writes
cheap but makes every feed load query many authors. Hybrid balances both at the cost of complexity and two code
paths. Ranked feeds increase engagement but are harder to debug and explain than chronological ones. Strong
consistency is not needed: a post appearing in followers' feeds a few seconds late is acceptable, which allows
asynchronous fan-out through queues.

## Common mistakes

- **Pure fan-out on write** with no special handling for accounts with millions of followers.
- **Storing full post content** in every feed instead of IDs.
- **Offset pagination** on a feed that changes constantly, causing duplicates and gaps; use cursors.
- **Synchronous fan-out** inside the "create post" request.
- **Unbounded feed lists** that grow forever; trim to a fixed length.
- **Hydrating posts one by one** (N+1) instead of batching cache lookups.

## In interviews

"Design the Twitter/Instagram/Facebook news feed" is a classic. Cover requirements (chronological or ranked,
media, scale), estimates (daily active users, posts per day, feed reads per second, follower distribution),
fan-out on write versus read and the hybrid, feed storage in a cache, hydration, pagination with cursors, ranking
at a high level, and how media is delivered through object storage and a CDN.

Likely follow-up questions:

- What happens when an account with 50 million followers posts?
- How would you paginate a feed that keeps changing?
- How would you rank posts instead of showing them by time?
- How do you handle a user who hasn't opened the app in months?
