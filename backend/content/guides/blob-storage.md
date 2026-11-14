## In short

Images, videos, PDFs and other large files belong in **object storage** (Amazon S3, Azure Blob Storage, Google
Cloud Storage), not in your database or on your servers' disks. Object storage is cheap, extremely durable,
scales without limits and serves files over HTTP. The database keeps only **metadata**: who owns the file, its
key, size, type and status. Clients upload **directly** to storage with short-lived **signed (pre-signed) URLs**,
so large files never pass through your application servers. Popular files are served through a **CDN**, and
processing (thumbnails, virus scans, video transcoding) runs in the background.

## The idea

Storing files as blobs in a relational database bloats it, slows backups and replication, and uses expensive
database storage for data that is never queried by content. Storing them on an application server's disk
breaks as soon as you run two servers (the file is on one of them) or redeploy containers (the disk is
gone). Object storage solves both: it is a separate, managed service built just for this.

Object storage is a flat namespace of **buckets** (containers) holding **objects** addressed by a **key**
such as `users/42/avatars/9f3c.jpg`. It is not a file system: you put, get and delete whole objects, list by
prefix, and attach metadata. Providers replicate objects across devices and zones for very high durability.
Storage **tiers** (hot, cool, archive) trade retrieval speed for cost, and **lifecycle rules** move or delete
old objects automatically.

**Signed URLs** are the key security tool. Buckets stay **private**. When a user wants to upload, your API
checks permissions and returns a URL signed with your credentials that allows exactly one action (for example
`PUT` of one key) for a few minutes, optionally limited by content type and size. The browser uploads straight
to storage. Downloads of private files work the same way with a signed `GET` URL. Your servers never handle
the bytes, so they don't need the bandwidth or memory.

## How it works

Profile photo upload:

1. The app asks the API: "I want to upload `photo.jpg`, image/jpeg, 2.4 MB".
2. The API checks the user, file type and size limits, creates a metadata row with status `pending`, and
   returns a signed upload URL for the key `uploads/42/7c1e.jpg`, valid for 5 minutes.
3. The browser `PUT`s the file directly to object storage.
4. Storage emits an "object created" event (S3 event notification, Azure Event Grid) onto a queue.
5. A worker validates the real file type (don't trust the extension), scans it for malware, strips EXIF
   location data, generates thumbnails in a few sizes, and marks the row `ready`.
6. Pages show the images through a CDN in front of the bucket, with long cache lifetimes, since each key's
   content never changes.

For very large files, **multipart upload** sends the file in chunks that can be retried individually and
uploaded in parallel.

## Trade-offs

Object storage is cheap per GB and nearly infinitely scalable, but each request has latency (tens of
milliseconds) and a small cost, so it is not a database or a low-latency file system. Direct uploads with
signed URLs remove load from your servers but need extra steps to validate files after upload and to clean up
abandoned uploads. Public buckets are simple but dangerous; private buckets with signed URLs or a CDN with
origin access are safer. Provider-specific features (events, tiers) create some lock-in.

## Common mistakes

- **Storing files in the database** or on local server disks.
- **Public buckets** holding private documents, a common cause of data leaks.
- **Proxying every upload through the API server**, which ties up workers and memory.
- **Trusting the client's file name or type**; validate content and generate your own keys.
- **Signed URLs with long expiry** or no size and type limits.
- **No lifecycle rules**, so abandoned uploads and old versions grow costs forever.

## In interviews

File handling appears in many designs: image sharing, video platforms, document storage, chat attachments.
Explain why files go to object storage with metadata in the database, the signed URL upload flow, background
processing with a queue, CDN delivery, security (private buckets, short-lived URLs, scanning), and large-file
uploads (multipart, resumable). For video, add transcoding into several resolutions and streaming in small
segments.

Likely follow-up questions:

- Why not store uploaded files in the database?
- How do signed URLs keep private files secure?
- How would you generate thumbnails without slowing down the upload?
- How would you support uploading a 5 GB video on a flaky connection?
