## In short

Back-of-the-envelope estimation is quick, rough maths that tells you whether a design can work before
you build it: how many requests per second, how much storage per year, how much bandwidth, and how
long each step takes. You aim for the right **order of magnitude** (is it 100, 10,000 or 1,000,000 per
second?), round freely, and say your assumptions out loud. Three tools cover most of it: a day has
about **86,400 seconds**, **powers of two** (2^10 ≈ a thousand, 2^20 ≈ a million, 2^30 ≈ a billion),
and the **latency numbers** every engineer should know (memory ~100 ns, SSD read ~0.1 ms, a round
trip across continents ~150 ms).

## The idea

"Should this go in one PostgreSQL database or be sharded?" has no answer until you know the numbers.
50 writes per second is nothing for one database; 50,000 is a different system. Estimation turns a
vague requirement ("lots of users") into a number you can compare with what one machine can do.

Precision is not the point. If the answer is "about 2,000 requests per second at peak", it doesn't
matter whether the real figure is 1,700 or 2,400: either way a few application servers and one
well-indexed database will cope. What matters is not being off by a factor of 1,000.

The numbers you most need to remember:

- **~100 ns:** read from main memory
- **~100 µs:** random read from an SSD
- **~0.5 ms:** round trip inside one data centre
- **~1 ms:** read 1 MB sequentially from an SSD
- **~10 ms:** disk (HDD) seek
- **~150 ms:** round trip from India to the US and back

These are classic ballpark figures; exact values change with hardware, but the **ratios** stay useful.
Memory is about a thousand times faster than an SSD read, which is why caches help so much. A request
inside a data centre costs half a millisecond, so a page making 40 sequential internal calls has spent
20 ms on network alone. And a user far from your servers pays ~150 ms per round trip whatever you do,
which is why CDNs exist.

Powers of two convert sizes quickly: a thousand items of 1 KB is about 1 MB, a million is about 1 GB,
a billion is about 1 TB.

## How it works

Estimate a photo-sharing app with 20 million daily active users. Assumptions, stated first:

1. Each user views 5 pages and uploads 0.5 photos a day (one photo every two days).
2. Peak traffic is 3 times the average.
3. Each photo is about 500 KB, plus 1 KB of metadata in the database.
4. Photos are kept forever; plan for 5 years.

Then the maths:

1. Requests per day: 20M × (5 + 0.5) = 110M. Per second on average: 110M ÷ 86,400 ≈ **1,300**. Peak
   ≈ **3,800 per second**: a handful of app servers behind a load balancer, plus caching for the
   read-heavy pages.
2. Uploads: 20M × 0.5 = 10M photos a day, about 115 per second on average. Easy for a database to
   record; the photos themselves go to object storage.
3. Bandwidth: 115 uploads a second × 500 KB ≈ 58 MB/s. Network bandwidth is quoted in bits, so
   multiply by 8: about **460 Mbit/s** of inbound traffic on average, several times that at peak.
4. Storage: 10M × 501 KB ≈ 5 TB per day, about **1.8 PB per year**, about **9 PB in 5 years**. That
   rules out storing photos in the database or on app servers, and says object storage plus a CDN.
5. Metadata: 10M × 1 KB = 10 GB per day, ~3.7 TB per year. One database could hold the first year or
   two; plan for partitioning later.

Each number points to a design decision. That is the real purpose of the exercise.

## Code

```python run
SECONDS_PER_DAY = 86_400
KB, MB, GB, TB, PB = 10**3, 10**6, 10**9, 10**12, 10**15   # decimal units, fine for estimates


def per_second(per_day: float) -> float:
    return per_day / SECONDS_PER_DAY


daily_users = 20_000_000
views_per_user, uploads_per_user = 5, 0.5
peak_factor = 3
photo_bytes, metadata_bytes = 500 * KB, 1 * KB

requests_per_day = daily_users * (views_per_user + uploads_per_user)
average_qps = per_second(requests_per_day)
peak_qps = average_qps * peak_factor

uploads_per_day = daily_users * uploads_per_user
storage_per_day = uploads_per_day * (photo_bytes + metadata_bytes)
storage_per_year = storage_per_day * 365

assert requests_per_day == 110_000_000
assert 1_250 < average_qps < 1_300          # about 1,300 requests per second
assert 3_750 < peak_qps < 3_850             # about 3,800 at peak
uploads_per_second = uploads_per_day / SECONDS_PER_DAY
upload_bits_per_second = uploads_per_second * photo_bytes * 8   # bandwidth is quoted in bits
assert 450 * 10**6 < upload_bits_per_second < 470 * 10**6   # about 460 Mbit/s
assert 4.9 * TB < storage_per_day < 5.1 * TB
assert 1.8 * PB < storage_per_year < 1.9 * PB
assert 9 * PB < storage_per_year * 5 < 9.5 * PB

# Latency ratio: memory is roughly a thousand times faster than an SSD random read.
memory_ns, ssd_read_ns = 100, 100_000
assert ssd_read_ns / memory_ns == 1_000
```

## Trade-offs

Rough estimates are fast and good enough to choose an architecture, but they can mislead when an
assumption is wrong by a lot (users far more active than expected, or a viral spike far above "3 times
average"). That's why you state assumptions explicitly and pick the ones that change the design. More
precise capacity planning uses measured data from load tests and production metrics; estimation is for
the early design stage and interviews, not for buying hardware. Decimal units (1 KB = 1,000 bytes) are
easier for mental maths. Memory is sized in binary units while disks are sold in decimal; the gap grows
from about 2% at KB to about 10% at TB, still within an estimate's error.

## Common mistakes

- **Skipping assumptions** and jumping to numbers nobody can check.
- **Designing for the average** instead of the peak.
- **False precision**: "1,273.15 requests per second" suggests accuracy the inputs don't have.
- **Unit slips**: confusing bits and bytes (network speeds are in bits), or KB and MB, which is a factor
  of 8 or 1,000.
- **Forgetting replication and growth**: three replicas triple the storage, and data grows every year.
- **Not using the result**: an estimate that doesn't lead to a design decision is wasted effort.

## In interviews

Most system design interviews expect a quick estimate right after the requirements: daily users,
requests per second (average and peak), read/write ratio, storage per year, and bandwidth. Do the
maths out loud, round aggressively, and state what each number implies ("1.8 PB a year, so photos go to
object storage behind a CDN"). Knowing the latency numbers lets you justify caching, CDNs and avoiding
chatty internal calls.

Likely follow-up questions:

- How many servers would you need for this peak load, and why?
- How much bandwidth do photo views need per second?
- What happens to your numbers if usage grows ten times?
- Why is reading from memory so much faster than from disk, and how does that shape your design?
