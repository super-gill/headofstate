# Head of State

A single-file browser game: monthly turn-based simulation as the head of state of one of 196 countries. Economy, politics, cabinet advisers, diplomacy, wars, nukes, an interactive 2D world map.

**Play it:** https://super-gill.github.io/headofstate/ (once GitHub Pages is enabled on this repo, see below)

## Structure

- `src/` — the game source, split into small files that get concatenated by the build:
  - `e1_core.js` through `e17_fallout.js` — the simulation engine (economy, war, diplomacy, events, cabinet, storylines, intel, aftermath, reports, national programmes, credit/debt, fallout), all inside one shared scope so files can reference each other freely.
  - `u1_base.js`, `u2_views.js`, `u3_flow.js` — the UI layer (map rendering, dock panels, event modals, turn flow). Runs after the engine in its own scope and only reaches engine internals through the exported `Engine` object.
  - `worlddata.json`, `mapdata.json` — country data and map geometry.
- `build/` — build scripts:
  - `bundle-engine.js` builds `dist/engine.js` from the `src/e*.js` files.
  - `build-page.js` builds `dist/artifact.html` (the playable game, fully self-contained) and `dist/test.html` (exposes `window.__hos = {E, UI, enter}` for automated testing).
  - `prepare.js` is a one-time script that regenerates `src/worlddata.json` / `src/mapdata.json` from the `d3-geo`/`world-atlas`/`world-countries` npm packages. Only needed if the underlying map/country data changes; requires `npm install` first.
- `test/` — Node test scripts. Most (`sim.js`, `story.js`, `proj.js`, `empire.js`, `secede.js`, `credit.js`, `conq.js`, `saves.js`, `evfilter.js`, `govterm.js`, `pcuse.js`, ...) run headlessly against `dist/engine.js` with no dependencies beyond Node itself. A handful (`*shot*.js`, `ui.js`, `uidesk.js`, `uimobile.js`, `uimapdock.js`) drive `dist/test.html` with Playwright for visual/UI checks and need `npm install` plus a Chromium build.
- `docs/index.html` — a copy of `dist/artifact.html`, kept in sync so GitHub Pages can serve the game directly from this repo (Pages only serves from the repo root or `/docs`, not `/dist`).

## Building

No npm install needed for the normal build loop:

```
node build/bundle-engine.js   # -> dist/engine.js
node build/build-page.js      # -> dist/artifact.html, dist/test.html
cp dist/artifact.html docs/index.html   # keep the Pages copy in sync
```

## Testing

```
node test/sim.js
node test/story.js
node test/proj.js
node test/empire.js
node test/secede.js
node test/credit.js
node test/conq.js
node test/evfilter.js
node test/govterm.js
node test/pcuse.js
node test/saves.js
```

Playwright-based UI tests (`npm install` first, needs a Chromium build):

```
node test/ui.js
```

## Enabling GitHub Pages

Settings → Pages → Source: "Deploy from a branch" → Branch: `main`, folder: `/docs` → Save. The game will then be live at `https://super-gill.github.io/headofstate/`.
