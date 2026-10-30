# Prompt 00 — Game shell (turn the reference scene into a multi-room game)

You are building the real Spyder web game, in `E:\Projects\retro-ports\spyder`. This prompt is written for any coding agent (Claude Code, Codex, Gemini, Kimi). Follow it literally. When something is unclear, choose the option that keeps the reference scene's look **exactly**, and write the decision in `game/NOTES.md`.

## Why this prompt exists

A previous build of this game looked like a 1995 EGA game and was rejected. Since then, a **playable reference scene** was built (`reference/`) and the visual rules were written down (`ART-DIRECTION.md`). Your job is to turn that single-room reference into a game with many rooms **without losing any of its quality**. You are not designing visuals in this prompt; you are building the frame that every room will plug into.

## Read first (in this order, completely)

1. `ART-DIRECTION.md` — binding. Especially §5 (composition), §6 (frame pipeline), §10 (makeover), §11 (UI), §13 (performance), §14 (code conventions), §15 (QA loop).
2. `DESIGN.md` — gameplay.
3. `reference/README.md`, then **open `reference/living-room.html` in a browser and play it to the makeover**.
4. Every file in `reference/lib/`, `reference/rooms/living-room.js`, `reference/scene.js`. Understand the frame pipeline in `render()` before changing anything.
5. Look at all six frames in `reference/screens/`.

## Hard rules

- **Do not modify anything under `reference/`.** It is the frozen quality bar. Copy from it.
- Do not delete files. The old build in `web/` is moved, not deleted (step 1).
- Plain `<script>` tags and the global `Spyder` namespace, so the game opens from disk (`file://`) with no server and no bundler. No frameworks.
- No network at runtime: fonts and everything else are local.
- Keep every visual of the Living Room **pixel-for-pixel equivalent** to the reference (same painting, lighting, grading, HUD). Refactoring must not change the look.
- No `ctx.filter = 'blur(...)'` in any per-frame code path (ART-DIRECTION §6, §13).
- Humanized code: clear names, short functions, comments that explain *why*. Seeded randomness for all visuals.
- Do not commit or push with git. The owner commits.

## What to build

### 1. Folder move

- Move the old build `web/` to `_archive/web-kimi-v1/` (move, do not delete).
- Create the new game in `game/`.

### 2. Target structure

```
game/
├─ index.html              one page: all screens, HUD, cards
├─ css/hud.css             from reference, plus new screens
├─ fonts/                  copied from reference/fonts (with LICENSES.md)
├─ lib/                    copied from reference/lib, then extended
│  ├─ (all reference lib files)
│  ├─ room-runtime.js      the frame pipeline + room loop + makeover, generalised from reference/scene.js
│  ├─ room-registry.js     list of rooms in house order; rooms register themselves
│  ├─ progress.js          save/load (localStorage, wrapped in try/catch), unlocks, best scores
│  └─ screens.js           title, house map, settings, pause, results, game over
├─ rooms/
│  └─ living-room/room.js  the reference Living Room as room 2 (data + painting), unchanged visually
├─ main.js                 boot: load progress, show title, route between screens
├─ tools/                  shoot.mjs + package.json adapted to the game (see QA)
└─ NOTES.md                decisions, QA rounds (see QA loop)
```

### 3. Generalise the room loop (`room-runtime.js`)

Move everything room-independent out of `reference/scene.js` into `room-runtime.js`. A room file must provide only data and painting. Extend the room interface from ART-DIRECTION §14 with a `rules` object so rooms can differ without touching the runtime:

```js
Spyder.rooms.register({
  id: 'living-room',
  number: 2,
  act: 1,
  name: 'Living Room',
  layout,             // platforms, bounds, dropPoints, lairs, wallArea, window, CEILING, FLOOR_LINE, GROUND
  paint,              // (variant) => { back, furniture, front }
  makeWebs, createLive, drawSky, drawProps, lights, glow,
  rules: {
    quota: 16,                         // spiders to clear
    webGoal: 0.85,                     // share of silk to tear
    spawnPattern: ['string', 'string', 'crawler', 'string', 'crawler', 'string', 'crawler', 'string'],
    maxAlive: [3, 4],                  // early / after 6 kills
    spawnInterval: [2.6, 1.4],         // seconds, start → end of the room
    types: ['string', 'crawler'],      // which spider brains this room may spawn
  },
  makeover: {
    // the shared beats are in the runtime; a room adds its unique beat here
    uniqueBeat: { at: 3.6, run(mk, t) { /* e.g. clock pendulum */ } },
  },
  storyObject: 'A family photo, standing up again.',  // shown on the results card
});
```

The runtime owns: input, the 13-step frame pipeline (exact order of ART-DIRECTION §6), darts, scoring and combo, threats and hero reactions, the director (driven by `rules`), progress, the makeover with the shared beats (stamp, web release, sweep, lights, dawn, sparkle, results), and the QA hooks.

Spider brains must be looked up from a registry (`Spyder.spiderTypes[name]`) so a later prompt can add a new type (the Kitchen adds `jumper`) by adding one file and one registration line.

### 4. Screens (all diegetic, see ART-DIRECTION §11)

| Screen | Spec |
|---|---|
| **Title** | The **Living Room in its dirty state** as the living background (lamp flickering, dust drifting, webs swaying — reuse the room, no new painting). In front: the old-letter card from the reference start card, with the title "Spyder", and buttons **Continue** (if a save exists), **New game**, **Settings**, **How to play**. Keyboard: Enter = first button. |
| **House map** | A hand-drawn floor plan on aged paper (draw it with Canvas or SVG, not an image file): ground floor, upstairs, attic; each room is a labelled outline. Cleared rooms show a red **CLEAN** stamp and their best score in handwriting; the next room pulses gently; locked rooms are drawn in faint pencil. Secret rooms (13–15) are not drawn until unlocked. Only rooms that exist in the registry are playable; the others show "Coming soon" in pencil. Linear unlocking; cleared rooms can be replayed. |
| **Settings** | Paper card with tabs: Character (only The Exterminator selectable now; the other three shown as pencil sketches marked "Coming soon"), Difficulty (Easy/Normal/Hard, scales `rules.quota` and spawn interval), Sound (master/music/SFX sliders, as brass knobs or simple sliders styled as brass), Visual (screen shake on/off, particles normal/reduced, film grain on/off). Saved in progress. |
| **How to play** | One paper card with the controls strip from the reference and three short illustrated tips (snip silk, stomp hatchlings, eggs fall on your head). |
| **Pause** | As in the reference, plus **Room map** and **Restart room**. |
| **Results** | As in the reference, plus **Next room** (if unlocked and available) and **Room map**. The results card names the room's `storyObject`. |
| **Game over** | "You fled the room" card with **Try again** and **Room map**. |

Screen transitions: a short paper-slide (cards drop in with slight rotation, 300–450 ms, respecting `prefers-reduced-motion`). Between room and map: a 400 ms fade through `soot`.

### 5. Progress

`localStorage` key `spyder.progress.v1`: `{ cleared: {roomId: {best, bestCombo, untouched, time}}, settings: {...}, lastRoom }`. Every read/write in try/catch; the game must work when storage is unavailable.

## QA loop (mandatory — ART-DIRECTION §15)

1. Keep the reference QA API working in the game: `game/index.html?qa=1&room=living-room` exposes `window.__spyder` with `setup('title'|'dirty'|'action'|'makeover'|'clean'|'results')`, `step(s)`, `clearRoom()`, `play()`, plus `setup('map')`, `setup('settings')`.
2. Copy `reference/tools/shoot.mjs` to `game/tools/`, point it at `game/index.html?qa=1&room=living-room`, add the states `map` and `settings`. It uses the installed Edge/Chrome (`npm install` once in `game/tools`).
3. **Regression check:** render `dirty`, `action`, `clean` from the game and compare each side by side with `reference/screens/*.jpg`. They must be visually identical (same composition, light, colours, HUD). Any difference is a bug in your refactor — fix it.
4. Render `title`, `map`, `settings`. Critique each against the reference frames for quality: painterly, diegetic, readable, nothing flat or default-looking. Write the 5 biggest gaps per round in `game/NOTES.md`, fix, re-render. **At least 3 rounds.**
5. Play test: start a new game from the title, open the map, enter the Living Room, pause/resume, clear the room (use `__spyder.clearRoom()` in QA mode), see results, go to the map and see the CLEAN stamp, reload the page and see progress kept.

## Hero-frame checkpoint — STOP here

Save these to `game/screens/` at 1920 × 1080:

- `title.png`, `map.png`, `settings.png`
- `living-dirty.png`, `living-action.png`, `living-clean.png` (regression)

Then **stop and report** to the owner: the list of files created or moved, the QA notes of each round, and the six frames. **Do not start any room prompt.** The owner (or Claude, on the owner's request) reviews the frames first.

## Acceptance

- [ ] `web/` moved to `_archive/web-kimi-v1/`, nothing deleted, `reference/` untouched
- [ ] `game/index.html` opens from disk with no network and no console errors
- [ ] Living Room in the game is visually identical to the reference frames
- [ ] Room interface + `rules` + spider-type registry as specified
- [ ] Title, map, settings, how-to-play, pause, results, game over all diegetic and keyboard-usable
- [ ] Progress saved and restored; works with storage disabled
- [ ] No per-frame blur; ≤ 8 ms/frame on GPU canvas
- [ ] QA loop ≥ 3 rounds documented in `game/NOTES.md`; hero frames saved; stopped for review
