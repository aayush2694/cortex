# System Design Primer Topics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four system design topics with guides (Reverse Proxies & API Gateways, Service
Discovery, Back-of-the-Envelope Estimation, Web Security Basics), extend the Message Queues guide
with task queues and back pressure, and trim the estimation paragraph in Fundamentals.

**Architecture:** Content only: new entries in `backend/content/topics.yaml`, new Markdown guides in
`backend/content/guides/`, and possibly new hosts in `backend/app/modules/topics/links.py`. The
existing guide checks (startup validation, `test_guide_content.py`) and the link checker verify it.

**Tech Stack:** YAML, Markdown, Python tests (pytest), `scripts/check_links.py`.

**Spec:** `docs/superpowers/specs/2026-11-16-system-design-primer-topics-design.md`

## Global Constraints

- Guide rules from `docs/superpowers/specs/2026-11-14-topic-guides-design.md`: system-design
  sections In short, The idea, How it works, Trade-offs, Common mistakes, In interviews required;
  Code optional; at least 600 prose words, aim 700–900; no filler.
- Each new topic: `track: system-design`, `phase: 3`, 4–5 `concepts` (each ≤ 240 chars), 2–4
  `resources`, ids and `requires` exactly as in the spec table.
- Written in our own words; the System Design Primer is a link, never copied text.
- Every factual claim checked; every claimed number in a `python run` block asserted.
- New allowlist hosts only for official docs of tools named in a guide; list them for Aayush.
- Do not touch or stage `frontend/angular.json` (Aayush's analytics line). Commit only after
  Aayush's review; commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Latency numbers drift between sources: use one widely cited set (order-of-magnitude values,
   labelled as approximate) and keep the runnable example's assertions consistent with the table.
   Test: the `back-of-envelope` run block asserts its computed QPS and storage figures.
2. Web Security overflowing 1.5 pages: if it exceeds ~1,100 prose words, stop and report instead
   of cramming (spec rule).
3. Fundamentals dropping below 600 words after the trim: the guide validator fails startup.
   Test: existing `test_guide_content` / gcheck after the edit.
4. A new topic's `requires` pointing at a wrong id or forming a cycle: `load_catalog` fails.
   Test: `test_real_catalog_is_valid`.
5. A new link that 404s or a host not on the allowlist. Test: `test_every_catalog_link_is_allowed`
   and `uv run python -m scripts.check_links`.

---

### Task 1: Reverse Proxies & API Gateways, and Service Discovery

**Files:**
- Modify: `backend/content/topics.yaml` (two entries after `load-balancing`'s block or at the end of
  the system-design section)
- Create: `backend/content/guides/reverse-proxies.md`, `backend/content/guides/service-discovery.md`
- Modify (if needed): `backend/app/modules/topics/links.py`

- [ ] **Step 1:** Add both topic entries (summary one sentence, concepts, links) without guides.
- [ ] **Step 2: Run** `cd backend && uv run pytest -q tests/unit/test_guide_content.py -k every_topic`.
  Expected: FAIL listing `reverse-proxies` and `service-discovery` as missing guides.
- [ ] **Step 3:** Write both guides per the spec's "Covers" column.
- [ ] **Step 4: Run** the backend check from `CLAUDE.md` plus `uv run python -m scripts.check_links`.
  Expected: all PASS, all links work.

### Task 2: Back-of-the-Envelope Estimation, and Web Security Basics

**Files:**
- Modify: `backend/content/topics.yaml`
- Create: `backend/content/guides/back-of-envelope.md`, `backend/content/guides/web-security.md`
- Modify (if needed): `backend/app/modules/topics/links.py`

- [ ] **Step 1:** Add both topic entries without guides.
- [ ] **Step 2: Run** the same `every_topic` test. Expected: FAIL listing the two ids.
- [ ] **Step 3:** Write both guides. `back-of-envelope` includes a ```python run block computing
  average and peak QPS and yearly storage for one worked scenario, with asserts on each figure.
  `web-security` covers HTTPS, authn vs authz, injection, XSS, CSRF, SSRF, broken access control,
  secrets, rate limiting, and links OWASP Top 10 for the rest.
- [ ] **Step 4: Run** the backend check and the link checker. Expected: all PASS.

### Task 3: Message Queues and Fundamentals edits, counts, docs

**Files:**
- Modify: `backend/content/guides/message-queues.md` (task queues: scheduled/delayed jobs,
  priorities; back pressure: bounded queues, rejecting or slowing producers, 429s), its
  `concepts` in `topics.yaml` (add one key idea about back pressure, keep ≤ 5)
- Modify: `backend/content/guides/sd-fundamentals.md` (shorten the back-of-the-envelope paragraph
  to 1–2 lines pointing to the new topic; keep ≥ 600 words)
- Modify: `README.md` and `CLAUDE.md` topic counts (86 → 90)

- [ ] **Step 1:** Edit both guides and counts.
- [ ] **Step 2: Run** the full check from `CLAUDE.md` (backend, frontend, pre-commit) and the link
  checker. Expected: all PASS; both edited guides still ≥ 600 words.
- [ ] **Step 3:** Browser check: the four new topics appear on the knowledge map under System design,
  linked to their prerequisites, and each guide page renders.
- [ ] **Step 4: STOP for Aayush's review** of the four new and two edited guides, the new allowlist
  hosts, and word counts. Commit after approval.
