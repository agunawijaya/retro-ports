# Brief for engineer: prompt 01, task B — the room's glue

Part of `prompts/01-room.md` §2 and §3 (read the whole prompt). The split is
in `briefs/01-room.md`; the interface you build against is
**`briefs/01-room-contract.md`**. Game root: `E:\Projects\retro-ports\sokoban\game`.
This project has no `DESIGN.md`; `docs/` plays that role and you never edit it.

## Pembagian kerja

- **engineer (you):** the [LOGIC] glue below, and its headless tests.
- **Opus:** builds every module of the contract (render, world, decor, theme,
  audio, HUD) at the same time, and decides anything visual. When the brief is
  silent on how something should *look or feel*, stop and ask; do not choose.
- **qa-scout / Agy:** nothing here.

## Read first

`docs/ARCHITECTURE.md` §5 (core API, `MoveResult`), §7.3 (screens), §10 (QA
hooks); `docs/GAME-DESIGN.md` §2 (rules, undo, restart), §3, §6, §7.5;
`docs/ART-DIRECTION.md` §0, §3.1, §5.3, §8.3, §9, §10b.2 (arrival/departure);
`reference/index.html` sections 14–18 (lines 2380–3076): **this is the code
you port**; `game/src/core/` (do not modify it; if it needs a change, write
the request in `game/NOTES.md` and work around it); `briefs/01-tools.md`
(what `hening.inspect()` and `hening.frameStats()` must return).

## What to build

Port reference sections 14, 15, 17 (the parts that are not drawing) and 18
onto `core/game.js`, keeping every number and timing. In particular:

- **`screens/room.js`** — `enter(ctx, { room, seed, mood })`, `update(dt, t)`,
  `exit()` (ARCHITECTURE §7.3). It creates the world with
  `createRoomWorld({ canvas, level, theme, rand: mulberry32(seed) })`
  (seed = room number unless `?seed=N`), and owns, as the reference does:
  - **Moves:** input → screen direction → `screenToGrid` → `game.move()` →
    animate the `MoveResult` like the reference's `tryStep` / `startMove` /
    `finishMove`: `DURATION = { walk: 0.24, run: 0.15, push: 0.42, rewind: 0.2 }`,
    `wanderer.move` objects, the object starting 12 % in and arriving at 92 %
    (smoothstep), `nudge(dc, dr, -2.2)` on landing, `theme.pushSound(sound)` on
    a push and `sound.step()` on a walk, lighting = `setLit(true)`, `sound.chime(note)`,
    `fx.ripple(x, z, world.glowHex(), 2.2, 1.1)` and 10 motes; leaving a
    target = `setLit(false)`, `sound.unchime(note)`. A target's note is
    `notesFor(theme)[target.index % notes.length]`.
  - **Blocked:** `blocked-wall` → `perform('bump')`, `sound.thump(110, 0.05)`;
    `blocked-object` → `protest` (+ `decor.stranger?.notice('protest')`, the two
    thumps, `hmph(1.32)`, the puff at 1.35 s if still protesting), or `shrug` if
    blocked again within 3.5 s.
  - **Queue:** one move buffered while a step is in flight; undo during a step
    is queued and runs when the step lands, never lost.
  - **Undo** (reference `undo`): rewind travel, `sound.rewind()`, white ripple
    1.2 / 0.5 at the tile left behind, re-light / un-light with chime / unchime.
  - **Restart** is one undoable history entry (GAME-DESIGN §2). It snaps the
    wanderer and every object to the start position, with the 3 / 0.9 white
    ripple at the wanderer, and no arrival. Undoing a restart snaps back the
    same way, with the white undo ripple. (Opus's decision; the reference has
    no undoable restart.)
  - **Tap to walk:** `world.cellUnderPointer`, `core/path.js` for the path, run
    when the path is longer than 2 tiles, tap an adjacent object to push, the
    0.8 / 0.5 white ripple at the tapped cell, `world.setHover` on pointer move.
  - **Arrival / departure:** the reference's `stageIntro`, `beginIntro`,
    `skipIntro`, `endScript`, `exitScript`, `runScript`, `stroll` (0.36 s per
    tile) against `world.decor.gate`. Any move key, Space or tap skips the
    arrival; R restarts without it. Record whether the walk reached the start
    or `endScript` had to place the wanderer (for `inspect().arrival`).
  - **Solved:** the reference's `win()` and `showWin()`: bow at 0.65 s,
    `decor.stranger?.notice('won')`, `sound.finale(notes)`,
    `fx.petalShower(max(rows, cols) + 4)`, 6 motes per object, the exit script
    after 2.95 s (else the veil at 2.3 s). The veil: `hud.showResults({ line:
    theme.solvedLine, stats: '<steps> langkah · <pushes> dorongan', next:
    'Enter · ruang berikutnya' })`; Enter opens the next room.
  - **Mood:** `setMoodPosition` from the room's place on its floor
    (ART-DIRECTION §5.3: room *k* of 10 → `(k − 1) / 3`); `?mood=0..3` and
    `hening.setMood` override it.
  - **Per frame:** scripts, tile travel and the queue (reference §17), then
    `world.update(dt, t, { covered })`, then `world.render()`.
  - **HUD:** `hud.setPlace('Lantai <roman> · Ruang <nn>')`, `setCounters`
    (label `theme.counterLabel`), tools → undo / restart / `rotateView(1)` /
    `sound.toggle()` + `setSoundOn`.
- **`ui/input.js`** — keyboard and pointer, reference §15 without the
  reference-only keys (no mood keys 1–4, no N, no panel toggle). Keys: arrows /
  WASD, Z / Backspace, R, Q / E, M, Enter, Space.
- **`main.js`** + **`index.html`** — boot straight into `?room=N` (default 1)
  behind the start veil (`hud.showStart`); the first gesture calls
  `sound.start()`. `index.html` keeps only `<div id="sun"></div>` and
  `<canvas id="stage" tabindex="0"></canvas>` and loads `main.js`; all styling
  comes from Opus's HUD CSS. With `?qa=1`, import `dev/qa.js`.
- **`dev/qa.js`** — `window.hening`: everything in ARCHITECTURE §10 with the
  reference's semantics (port its section 18, including `scrub`, `play` and
  the treadmill `demo` of section 16/17), plus `room(n)`, `level(0..2)` → rooms
  5–7, `theme(id)`, `freezeTime(on)` (stop all time-based motion: pass `dt = 0`
  and a constant `t` to `world.update`), `solve()` (play the stored solution
  from `solutions.generated.json` at full speed; with none, fall back to
  `arrange()`; never fail), `screen()` / `progress()` as stubs, and the
  `inspect()` and `frameStats(ms)` of `briefs/01-tools.md` (`inspect` = the
  glue's `phase` and `arrival` plus `world.inspect()`).

## Tests — `tests/room.test.js`

Keep the glue testable headless: `screens/room.js` takes the world, sound and
HUD through its context, so a test passes fakes that record calls. Cover:
walk, push onto and off a target (chime / unchime with the right note), bump,
protest then shrug within 3.5 s, a move buffered during a step, undo buffered
during a step, restart and undo of the restart, the solved sequence (bow at
0.65 s, results after the exit script), and the arrival skip. Use fake timers.
`npm test` must stay green.

## Fence

Create or edit only `src/screens/room.js`, `src/ui/input.js`, `src/dev/qa.js`,
`src/main.js`, `index.html`, `tests/room.test.js`, and your own section in
`game/NOTES.md` (*Room glue*). **Never** touch the contract's modules
(`src/render/`, `src/world/`, `src/themes/`, `src/audio/`, `src/ui/hud.*`,
`src/ui/icons.js`), `src/core/`, `tools/`, `docs/`, `reference/`. Opus is
writing those right now; they may not exist yet when you start, so write
against the contract and test with fakes. No git.

## Report

Files (one line each); test counts; what you ported and from which reference
lines; every place you had to choose something the brief did not say, and
every question you stopped at; anything the contract lacks.
