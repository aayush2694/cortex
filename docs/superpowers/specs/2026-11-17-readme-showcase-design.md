# README showcase: demo GIF, full-stack summary, gallery

Approved by Aayush on 2026-11-17 (option A).

## Why

Recruiters skim the GitHub page for under a minute. They should see at once that Aayush built
every layer of a working app: interface, API, database, deployment and tests.

## Approaches considered

- **A (chosen):** a short demo GIF at the top, a five-line "full stack at a glance" block,
  proof of the backend (API docs screenshot and the existing diagram), and a folded gallery.
- B: every page and long feature sections in the README. Too long; buries the live link.
- C: a separate showcase site. Most work, and recruiters mostly stay on GitHub.

## Design

- **Demo GIF** (`docs/screenshots/demo.gif`): about 15 seconds, dark mode, about 960 px wide,
  under 5 MB. Journey: knowledge map → Two Pointers topic → scroll the guide → a practice
  problem → type the solution → run → passes. Pyodide's first load is sped up or cut so it
  never looks stuck. Recorded by script against the local dev-mode stack (no sign-in), not
  the live site. Re-record with `npm run e2e:demo`.
- **Top of the README:** title, pitch, badges, live link, then the GIF, then "Full stack at a
  glance": Frontend, Backend, Data, Infrastructure, Tests (verified counts), one line each.
- **Backend proof:** a screenshot of the API docs page (`/docs`) next to the architecture
  diagram.
- **Gallery:** about 8 main pages in a collapsible `<details>` section, each with a one-line
  caption: dashboard, knowledge map, topic guide, pattern walkthrough, visualizer, practice,
  flashcards, job board (plus the existing sign-in image).
- Screenshots come from `frontend/e2e/screenshots.spec.ts` (`npm run e2e:screenshots`), dark,
  1280×800, against `cortex_e2e` only, with neutral sample data and nothing personal.
- The rest of the README (highlights, stack, quality, run, structure) stays; trim if needed.

## Not included

A separate showcase site, light-mode images, mobile screenshots.
