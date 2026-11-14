# Topic guides design

Status: awaiting approval before planning.

## Why

Every one of the 86 topics has only a one-line summary. 39 topics have no key ideas and 45 have
no links. Aayush wants every topic explained in detail, with only relevant content, plus trusted
"read more" links. The site is for everyone: a fresher should be able to learn a topic from
scratch, and an experienced developer should be able to revise it fast and explain it well in an
interview.

## Goals

- A written guide for all 86 topics, layered from easy to deep, so each reader stops where they
  want.
- Key ideas (`concepts`) for the 39 topics that have none, so every topic can feed flashcards.
- 2–4 trusted links for every topic.
- After a topic, a fresher understands it and can solve an easy problem on it; an experienced
  reader can explain it to an interviewer and avoid the common traps.

## Non-goals

- Separate pages for beginners and experts.
- AI-generated explanations at read time.
- Videos, images or diagrams beyond what fits in Markdown (the visualizer already exists).
- Feeding guides to the tutor (a possible later step).

## Anti-goals (a failure even if it works)

- Wrong facts or code that does not run.
- Text copied from documentation or other sites. Everything is written in our own words.
- Padding: generic filler, repeated content, sections forced onto topics where they do not fit.
- Links to blogs, SEO farms, paywalls or pages that may disappear.

## Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | One Markdown file per topic | Easy to write, review and test; needs Markdown rendering (already in the app) | **Chosen** |
| B | A long text field in `topics.yaml` | No new files, but ~70,000 words in one YAML file is hard to edit and YAML quoting has caused bugs before | Rejected |
| C | Tutor writes explanations on demand | No writing up front, but can be wrong, costs money per view, tutor is invite-only | Rejected |

## Content

### Files

- `backend/content/guides/<topic-id>.md`, one per topic. The file name must match a topic id.
- Links stay in `topics.yaml` under `resources` (already validated as URLs and shown on the
  page). Key ideas stay in `concepts`. The guide holds only the prose.

### Sections

Each guide uses these `##` headings, in this order. Required sections depend on the track.

| Section | Purpose | dsa | languages | frameworks | system-design | ai |
|---|---|---|---|---|---|---|
| In short | 3–5 lines: what, when, cost. The two-minute revision. | req | req | req | req | req |
| The idea | Plain words and an everyday picture, no code. Fresher starts here. | req | req | req | req | req |
| How it works | One small worked example, step by step. | req | req | req | req | req |
| Code | A clean, commented example. | req | req | req | opt | opt |
| Trade-offs | When to use it and when not to, compared with alternatives. | opt | opt | req | req | req |
| Common mistakes | 3–6 real traps and how to avoid them. | req | req | req | req | req |
| In interviews | How it is usually asked, what a strong answer covers, 2–4 likely follow-up questions. | req | req | req | req | req |

Length: about 1.5 pages, so aim for 700–900 words per guide, minimum 600 (checked by a test).
Simple topics go deeper (comparisons, a fuller worked example) rather than adding filler; a
topic that is still a little short stays short. Pattern topics already have a template
and walkthrough on the page, so their Code section explains the template rather than repeating
it.

### Code examples

- A block fenced as ` ```python run ` must run as-is under the backend's Python and contain at
  least one `assert` showing the result. A test runs every such block.
- Other blocks (` ```python `, ` ```ts `, ` ```sql `, ` ```text `) are shown only. Use these for
  Django, FastAPI, Angular and other code that needs a framework or server.
- SQL blocks fenced as ` ```sql run ` run against an empty in-memory SQLite database and must not
  fail, so they create their own tables.
- Every DSA guide has at least one ` ```python run ` block, and every SQL topic at least one
  ` ```sql run ` block (checked by a test). Elsewhere runnable blocks are optional.

### Links

- Only from an allowlist of official or long-trusted hosts, kept in one place in the backend. It
  starts with the hosts already used (docs.djangoproject.com, learn.microsoft.com,
  postgresql.org, developer.mozilla.org, django-rest-framework.org, martinfowler.com, sre.google,
  sqlite.org, allthingsdistributed.com, docs.celeryq.dev, grpc.io, docs.stripe.com,
  kafka.apache.org, aws.amazon.com, opentelemetry.io, jepsen.io, raft.github.io, github.com for
  official repositories) and adds docs.python.org, peps.python.org, typescriptlang.org,
  angular.dev, fastapi.tiangolo.com, docs.sqlalchemy.org, cp-algorithms.com, docs.anthropic.com,
  and the official docs of any other tool a topic covers.
- The builder may add the official docs site of a tool a topic covers. Each batch's review lists
  any hosts it added, so Aayush can reject one.
- A unit test fails if any link's host is not on the allowlist.
- `backend/scripts/check_links.py` opens every link and reports any that do not return 200 after
  redirects. It runs once before each batch is committed and weekly in a new scheduled CI
  workflow (read-only permissions, which opens no issues and only fails the run).

## How it is served

- Loaded from disk at startup and cached, like the other content files. Startup fails on a guide
  whose name matches no topic, a missing required section, an unknown section, or sections out of
  order.
- `GET /api/v1/topics/{id}` gains `guide: str | null` (the Markdown). The knowledge map response
  does not include it, so the map stays small.
- No database change: guides are read from files, not synced into Postgres.

## Topic page

The guide appears right after the header, before the pattern walkthrough. Order of the page:

```
← Knowledge map
DSA · Easy
Binary Search
One-line summary
[Visualize it] [Ask the tutor] [Add to review]

On this page: In short · The idea · How it works · Code · Common mistakes · In interviews

## In short          (Markdown, rendered with the existing MarkdownPipe)
## The idea
...
## In interviews

Pattern walkthrough (if any) · Key ideas · Practice · Your progress · Notes
Read more            (the existing "Docs & references" list, renamed)
Learn first · Unlocks
```

- Uses the existing monochrome typography; headings get ids so the "On this page" links scroll to
  them (anchor scrolling is already on).
- Code blocks get the mono font and a raised background. No syntax highlighting in this project.
- Topics without a guide yet show the page as today.

## Batches and review

Written in five batches, each its own commit after Aayush reviews it:

1. DSA (35)
2. Languages (9, incl. 5 SQL)
3. Frameworks (13)
4. System design (23)
5. AI (6)

One plan covers everything, with a stop for Aayush's review after the samples and after each
batch.

The serving code and page change come first with 2 sample guides (Binary Search and one Django
topic). These samples on the real page are the mockup: Aayush approves the look before the other
84 are written. `topic-page.ts` is already 372 lines, so the guide goes in its own component. A test listing topics without a guide becomes "every topic has a
guide" after batch 5.

## Testing

- Unit: guide parser (headings, order, required per track, word count), `run` block extraction
  and execution, link allowlist, orphan guide files.
- Integration: `/topics/{id}` returns `guide` for a topic with one and `null` without.
- Frontend: topic page renders the guide and the "On this page" links; topic without a guide
  renders as today.
- Manual: Aayush reads each batch before it is committed.

## Left to the builder

- Parser details (Markdown library or simple heading split), exact CSS, how `run` blocks are
  isolated (subprocess with timeout is fine).
