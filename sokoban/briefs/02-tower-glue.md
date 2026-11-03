# Brief: prompt 02 — glue between the router, the room and the new screens (LOGIC)

Crew engineer, Hening (`E:\Projects\retro-ports\sokoban\game`). You already built
`briefs/02-tower-logic.md` (router, stores, stubs); it was reviewed and accepted.
This is the second [LOGIC] piece. The director (Opus) is writing the [ART] side
at the same time — `render/tower.js`, `world/places.js`, `world/tower-world.js`
and the bodies of every `screens/*.js` except `room.js`. **Do not edit those
files**, and do not touch `docs/`, `reference/`, `original/`, `src/core/`. No
visual decisions: every number below is already decided.

Files you own for this brief: `src/main.js`, `src/ui/input.js`,
`src/audio/sound.js`, `src/state/progress.js`, `src/state/settings.js`,
`src/screens/room.js`, `src/ui/hud.js` (one small addition), `src/dev/qa.js`,
and tests.

## 1. Router (`main.js`)

`ctx` given to every screen's `enter(ctx, params)` becomes
`{ canvas, hud, router, sound }`, where
`router = { goto, open, close, top, baseName }`.

- `goto(name, params = {}, opts = {})` — `opts`: `{ instant?: boolean, crossfade?: number }`.
  - default: veil fade 0.6 s to opaque, then 0.6 s back, through the current
    mood's fog colour (as now) — but use CSS `ease-in-out` instead of `linear`
    (director's call: ART-DIRECTION §9, everything eases).
  - **order fix:** the leaving screen keeps updating and rendering while the
    veil fades in; only when the veil is opaque: `old.exit()`, `new.enter()`,
    then the fade out. (Today `exit()` runs before the fade.)
  - `crossfade: s` — a real cross-fade: copy the WebGL canvas
    (`preserveDrawingBuffer` is already true) into a full-screen 2D `<canvas>`
    overlay (same CSS box as `#stage`, `pointer-events: none`, z-index just
    above the stage and below the HUD), then exit/enter immediately, then fade
    the overlay's opacity 1 → 0 over `s` seconds (`ease-in-out`), then remove it.
  - `instant: true` — no transition at all.
  - Reduced motion (`settings.reducedMotion()` below, true) → every transition
    is instant.
  - `goto` closes every open overlay first (calling their `exit()`).
  - Re-entrancy: calls are serialised — a `goto` issued while another
    transition runs waits for it, then runs. Never two at once.
- Overlays: `open(name, params)` pushes an overlay screen on top of the current
  base screen and calls its `enter(ctx, params)`. `close()` pops the top one
  and calls its `exit()`. While an overlay is open the base screen **still gets
  `update(dt, t)` every frame** (it keeps rendering underneath), and overlays get
  `update(dt, t)` after it. Overlay names: `results`, `pause`, `records`,
  `settings`, `notice`. Base names: `title`, `courtyard`, `elevator`, `floor`,
  `room`, `ending`. Create `src/screens/notice.js` as a stub like the others
  (the director fills it). `top()` returns the name of the top-most screen,
  `baseName()` the base's.
- Input: every `bindInput` callback goes to the **top-most** screen only
  (overlay if one is open, else the base): each screen module may export an
  `input` object with any of `onDirection(screenDir)`, `onConfirm()`, `onSkip()`,
  `onBack()`, `onPause()`, `onDigit(n)`, `onUndo()`, `onRestart()`,
  `onRotate(delta)`, `onPointerMove(x, y)`, `onPointerDown(x, y)`,
  `onAnyKey(code)`. Missing handler = ignored. `M` (sound) stays global, as now.
- `window` resize → `resize?.()` on the base and on every overlay.
- Boot unchanged otherwise: `?qa=1&room=N` → room instantly + the start veil (the
  regression tools rely on it); else `title` instantly.
- `hud.showStart` / `startGame` stay for the `?qa=1&room=N` path only.

## 2. Input (`ui/input.js`)

Add: `Escape` → `onBack()`, `KeyP` → `onPause()`, `Digit1`–`Digit5` and
`Numpad1`–`Numpad5` → `onDigit(n)`. Call `onAnyKey(e.code)` for **every**
keydown, before the specific handler. Keep everything else.

## 3. Stores (`state/progress.js`, `state/settings.js`)

Keep every existing export. Add in-memory stores so a session remembers even
with storage disabled (ARCHITECTURE §8: "on failure the game keeps state in
memory"):

- progress: `getProgress()` (loads once, then returns the same object),
  `setProgress(p)` (replace in memory + `save`), `saveProgress()` (save the
  in-memory object).
- settings: `getSettings()`, `updateSettings(patch)` (shallow-merge, with
  `volume` merged field by field; saves; notifies), `onSettingsChange(fn)` →
  unsubscribe function, and `reducedMotion()` → boolean: `'on'` → true, `'off'`
  → false, `'system'` → `matchMedia('(prefers-reduced-motion: reduce)')`
  (guarded so it works in Node tests).
- Also add `nextRoom(p)` → the lowest room number that is open but not solved,
  or 50 if every room is solved; and `floorOf(room)` → `Math.ceil(room / 10)`;
  `openFloors(p)` → highest floor whose first room is open (`Math.ceil(min(p.open, 50) / 10)`).

## 4. Sound (`audio/sound.js`)

- Three buses: `master` (exists; its gain = `0.9 × volume.master`, still faded
  to 0 by the M toggle), `ambience` (the drone and the wind go through it, gain
  `volume.ambience / 0.6` so the default 0.6 keeps today's level), `notes`
  (lighting chimes, unchimes and the finale bell + rolled chord go through it,
  gain `volume.notes / 0.8`). Footsteps, pushes, creaks, thumps stay on
  `dry` → master.
  - The theme instruments call `instrument.play(sound, freq, when, level)` and
    connect to `sound.dry`. Do **not** edit the theme files: inside
    `chime()`/`unchime()` pass a small proxy `{ ctx: this.ctx, dry: this.notesBus }`
    instead of `this`.
- `setVolumes({ master, ambience, notes })` — applies immediately (0.15 s
  ramp); before `start()` it just remembers them; `start()` applies the
  remembered values. `main.js` calls it at boot from `getSettings().volume` and
  on every settings change.
- `bell(freq = 146.83, level = 0.07)` — the finale's temple-bell partials only
  (no rolled chord), on the notes bus. The elevator calls `bell()` (D3, quiet)
  on arrival and `bell(73.42, 0.09)` (deep) when a floor's ring lights.

## 5. Room (`screens/room.js`)

- Export `input = { onDirection, onSkip, onUndo, onRestart, onRotate, onConfirm,
  onPointerMove, onPointerDown, onBack, onPause }` (the first eight are today's
  functions; `onBack` and `onPause` → `router.open('pause', { room })` unless
  the phase is `'results'`). Remove the `currentName === 'room'` guards in
  `main.js` — the dispatch replaces them.
- `enter(ctx, params)`: keep `ctx.router` for later. Call `disposeTowerWorld()`
  imported from `../world/tower-world.js` (the director creates that file and
  export; it frees the tower scene while a room plays). Theme comes from
  `getSettings().theme`. Hide/show the HUD for a room:
  `hud.setVisible({ title: true, tools: true, counters: true, hint: getSettings().hints })`.
- On solve (`win()`), before the departure starts, update the progress store:
  `const prev = p.solved[room]?.bebas` (copy it first), `recordSolve(p, room,
  'bebas', { steps, pushes })`, `openRoom(p, room)`, if `isFloorLit(p, floor)`
  and not already in `floorsLit` → `markFloorLit` and remember
  `newlyLitFloor = floor`, `p.lastRoom = room`, if `room === 50` →
  `p.ending = true`, `saveProgress()`. `isRecord = !!prev && (steps < prev.steps
  || pushes < prev.pushes)`.
- `showResults()` → instead of `hud.showResults(...)`:
  `router.open('results', { room, steps, pushes, isRecord, newlyLitFloor,
  solvedLine: theme.solvedLine })`.
- New exports: `replay()` — from the results state: restart the room without
  the arrival, wanderer visible again (`setOpacity(1)`, `fadeTo = 1`), phase
  `'playing'`; `setPaused(on)` — while on, every input handler of the room
  ignores input, and the wanderer sits (`wanderer.idle = MEDITATE_AFTER + 1.2`,
  so the meditation pose blends in); off → `wanderer.idle = 0`.
  `currentRoom()` → the room number.
- `confirm()` (Enter after solving) is no longer used for "next room" — the
  results overlay owns that now. Remove that behaviour.
- `qa.js`'s room helpers keep working unchanged.

## 6. HUD (`ui/hud.js`)

Add `setVisible({ title, tools, counters, hint })` — each `true`/`false`
toggles `display`/`opacity` of `#title-block`, `#tools`, `#counters`, `#hint`
(use a `.off` class with `opacity: 0; pointer-events: none` — opacity, so it
eases with the existing `.hud` transition). Missing keys = unchanged.

## 7. QA (`dev/qa.js`)

- `screen(name, params)`: base names → `goto(name, params, { instant: true })`.
  Overlay names → if the needed base is not active, first go to it instantly
  (`results` and `pause` need `room` — use `params.room ?? 1`; `records`,
  `settings`, `notice` need `courtyard`), then `open(name, params)`. For
  `results` with no stats in `params`, fill `{ room, steps: 128, pushes: 41,
  isRecord: false, solvedLine: 'Semua lentera menyala' }`.
- `progress(json)`: as now, but varied plausible placeholder records per room,
  deterministic: `pushes = 18 + ((n * 7) % 23)`, `steps = pushes * 3 + ((n * 13) % 40)`;
  then `setProgress(p)` so the running game sees it immediately.
- `progress()` with no argument returns a copy of the current in-memory progress.

## Tests

`npm test` must pass. Add tests for: `getProgress` returning the same object
across calls; `nextRoom`; `openFloors`; `updateSettings` merging `volume` field
by field and notifying; `reducedMotion()` for 'on'/'off'. Don't test `main.js`
or the DOM.

## Report

Files changed; the exact `ctx`/`router` shape you implemented; anything you
could not do without a visual decision (flag, don't guess).
