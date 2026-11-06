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
  features/   dashboard · knowledge-map · topics · visualizer · tutor · roadmap
src/styles.scss   design tokens + the 5 themes
```

## Themes

Every colour is a CSS variable. Themes live in `src/styles.scss` as `[data-theme='…']` blocks
(Midnight, Graphite, Ocean, Ember, Daylight). To add one: copy a block, change the values, and
add it to `THEMES` in `core/theme/theme.ts`.

## Shortcuts

`⌘K` search · Visualizer: `Space` play/pause, `←` `→` step, `R` restart
