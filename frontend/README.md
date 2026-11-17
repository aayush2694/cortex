# Cortex — Frontend

Angular 22 (standalone components, signals, zoneless, `httpResource`, lazy routes).

## Run it

Start the backend first (see `../backend/README.md`), then:

```bash
npm install
npx ng serve        # http://localhost:4200 — /api calls are proxied to :8000
```

## Layout

```
src/app/
  core/       api (typed client + streaming tutor), theme service, learning store
  layout/     sidebar, top bar, theme picker, ⌘K command palette
  shared/     small reusable pieces
  features/   one folder per page (dashboard, knowledge-map, topics, patterns, visualizer,
              practice, review, tutor, jobs, tools, cheatsheet, roadmap, settings, auth)
src/styles.scss   design tokens + the light and dark themes
```

## Themes

Every colour is a CSS variable. `src/styles.scss` defines a `[data-theme='light']` and a
`[data-theme='dark']` block; `core/theme/theme.ts` offers Light, Dark and Auto (follows the
system setting).

## Shortcuts

`⌘K` search · Visualizer: `Space` play/pause, `←` `→` step, `R` restart
