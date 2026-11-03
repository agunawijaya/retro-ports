# Brief: prompt 02 — router, storage, progression (LOGIC only)

You are the crew engineer on Hening (`E:\Projects\retro-ports\sokoban\game`). This
is the [LOGIC] 1 section of `prompts/02-tower.md` — read that section (and only
that section) in the prompt file first. The [ART] sections (tower geometry,
title/courtyard/elevator/floor/ending screens, their look and feel) are being
built separately by the director (Opus) — **do not touch anything visual, and do
not write the body of any `screens/*.js` file beyond an empty stub** (see below).
Do not touch `reference/`, `docs/`, `original/`, `game/src/core/`.

## What exists already (prompt 01, reuse, do not change)

- `game/src/screens/room.js` — the only screen so far; current `main.js` calls
  `room.enter()` directly. Look at its `enter(ctx, params)` / `update(dt, t)` /
  `exit()` shape — your router must call every screen the same way.
- `game/src/dev/qa.js` — has stub `screen: (_name, _params) => {}` and
  `progress: (_json) => {}` around line 45-47. Make them real.
- `game/src/ui/hud.js` — `createHud()`, has `showStart`/`hideStart`, veils.
  Reuse for whatever veil mechanics you need; do not change its CSS/DOM.

## 1. Screen stubs (scaffolding only — zero decisions)

Create these files, each exporting exactly `enter(ctx, params)`, `update(dt, t)`,
`exit()` as **empty no-op functions** (just the three exports, a one-line JSDoc
comment on the module saying "stub — filled in by ART", nothing else — no
geometry, no text, no camera, no colours):

```
game/src/screens/title.js
game/src/screens/courtyard.js
game/src/screens/elevator.js
game/src/screens/floor.js
game/src/screens/results.js
game/src/screens/pause.js
game/src/screens/records.js
game/src/screens/settings.js
game/src/screens/ending.js
```

These will be overwritten with real content afterward. Keep them minimal so
there's nothing to merge around.

## 2. Router in `main.js`

Replace the current direct `room.enter()` boot with a tiny router:

- A screens registry mapping name → module, for: `title`, `courtyard`,
  `elevator`, `floor`, `room`, `results`, `pause`, `records`, `settings`,
  `ending`. (`room` → the existing `screens/room.js`; the other nine → the
  stubs above.)
- `goto(name, params)`: calls the current screen's `exit()`, runs a veil fade
  (see below), switches, calls the new screen's `enter(ctx, params)`. One
  renderer, one audio engine (`sound`), shared across all screens — do not
  create a new `THREE.WebGLRenderer` per screen.
- Veil fade transition: **0.6 s fade out, 0.6 s fade in**, through the
  *current mood's* `fog` colour (from `render/moods.js` — `moodState.live.fog`
  or equivalent). Instant (no fade) when `prefers-reduced-motion` is set. This
  is a plain opacity transition on a full-screen overlay div or canvas quad —
  the colour and timing are fully specified already, so this is mechanical, not
  a design choice. If you're unsure how to render the overlay, do it as a DOM
  div (like the existing `#start`/`#win` veils in `hud.js`) rather than
  invent a new rendering path.
- Boot: the game now starts at `title`, not at a room. Keep `?qa=1&room=N`
  working as a direct shortcut straight into the room screen (skip title).
- Main loop stays as is (one `requestAnimationFrame` calling the current
  screen's `update(dt, elapsed)`).

## 3. `state/progress.js` and `state/settings.js`

Exact schema, `docs/ARCHITECTURE.md` §8 (ask the director if you want the
literal JSON — it's also quoted in full in `game/NOTES.md`'s "Pembagian kerja —
prompt 02" section once that's written, or just read §8 directly):

```json
{
  "hening.progress.v1": {
    "open": number,
    "solved": { "[room]": { "dupa?": {"steps":0,"pushes":0,"timeMs":0}, "bebas?": {"steps":0,"pushes":0} } },
    "assisted": [number],
    "floorsLit": [number],
    "ending": boolean,
    "lastRoom": number
  },
  "hening.settings.v1": {
    "theme": "lentera",
    "mode": "dupa" | "bebas",
    "dupaMinutes": 10 | 20 | 30,
    "volume": { "master": 0, "ambience": 0, "notes": 0 },
    "reducedMotion": "system" | "on" | "off",
    "hints": true
  }
}
```

- `state/progress.js`: `load()`, `save(progress)`, `openRoom(n)` (sets `open`
  if `n+1 > open`), `recordSolve(room, mode, stats)` (keeps best-of for each
  mode's steps/pushes/timeMs independently — lower is better, never overwrite
  with worse), `isFloorLit(progress, floor)` (all 10 rooms 1-indexed in that
  floor solved), `markFloorLit`, `defaultProgress()` → `{ open: 1, solved: {},
  assisted: [], floorsLit: [], ending: false, lastRoom: 1 }`.
- `state/settings.js`: `load()`, `save(settings)`, `defaultSettings()` → the
  defaults from `GAME-DESIGN.md` §7.10 (mode `bebas` i.e. Tanpa Batas,
  dupaMinutes 20, volume `{master:0.8, ambience:0.6, notes:0.8}`,
  reducedMotion `system`, hints `true`, theme `lentera`).
- **Everything wrapped in try/catch.** If `localStorage` throws or is
  unavailable, `load()` returns the default and `save()` silently no-ops. The
  game must be fully playable with storage disabled — nothing may throw.
- Progression rule (`GAME-DESIGN.md` §4.1): room 1 open at start; solving room
  *n* opens *n+1*; solving room 10/20/30/40/50 lights floor I/II/III/IV/V.

## 4. `dev/qa.js` — make the stubs real

- `screen(name, params)` → calls the router's `goto(name, params)` directly
  (no fade — instant, for test determinism).
- `progress(json)` → `{ solvedUpTo: 23 }` must: build a progress object with
  rooms 1..23 marked solved in `bebas` mode with plausible placeholder
  records (e.g. steps/pushes derived from the room's own target count — ask
  the director if a specific formula matters; a simple deterministic
  placeholder like `steps: 20, pushes: 10` per room is fine, **do not** run
  the solver), set `open` to 24, set `floorsLit` for every floor fully covered
  (room 23 → floor I only, since floor II isn't finished), save it via
  `state/progress.js`, and leave the player wherever the caller then
  navigates (don't auto-navigate — that's for the test script to do via
  `screen()`).

## Tests

Run `npm test` before you report back — it must still pass (24/24 from prompt
01, plus any you add for `state/progress.js` / `state/settings.js`,
particularly the try/catch-when-storage-disabled behaviour and the
record-keeping "never overwrite with worse" rule). Don't touch
`tools/flow.mjs` or `tools/perf.mjs` — those come later, after the ART screens
exist, as a separate piece.

## When you're done

Report back exactly: which files you created/changed, the final shape of
`state/progress.js` and `state/settings.js`'s exported functions, how `main.js`'s
router works (the registry, `goto()`, the fade mechanism), test count and
pass/fail, and anything in the prompt's [LOGIC] 1 section you could not do
without an [ART] decision (flag it, don't guess at it).
