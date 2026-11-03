# Brief for engineer: prompt 01, task A — the three check tools

Part of `prompts/01-room.md` §3 and §4; the split is in `briefs/01-room.md`.
Game root: `E:\Projects\retro-ports\sokoban\game`. This project has no
`DESIGN.md`; `docs/` plays that role and you never edit it.

## Pembagian kerja

- **engineer (you):** the three tools below. They are [LOGIC]: Playwright
  harnesses that drive `window.hening` and record numbers.
- **Opus:** builds the room's look (render, world, decor, theme, audio, HUD) in
  parallel and judges every regression pair. You make no visual judgement:
  the tools collect, Opus looks.
- **qa-scout:** later runs your tools against the finished room.
- **Agy:** nothing here.

## Read first

`prompts/01-room.md` (all of it, for context), `docs/ARCHITECTURE.md` §10
(QA hooks), §11 (browser, Playwright), §13 (review, `.scratch/`), §14 (perf
budgets), `docs/ART-DIRECTION.md` §0 (the `window.hening` API) and §8.4
(scrub checkpoints), `reference/index.html` section 18 (lines 3012–3076, the
reference's `window.hening`), `game/tools/shoot-reference.mjs` and
`game/tools/review.mjs` (reuse `paths`, `scratchDir`, `saveCurrent`, and its
browser launch).

## The game side you can rely on

The game is being built while you write this. It will expose, with `?qa=1`:

- Everything in `ARCHITECTURE.md` §10, with the reference's semantics:
  `start()`, `skipIntro()`, `setMood(i)`, `rotate(±1)`, `closeUp(z)`,
  `focus(x, z, zoom)`, `face(d)`, `scrub(name, t, step)`, `arrange(n)`,
  `where()`, `decor`, `state`, `room(n)`, `level(0..2)` (rooms 5–7),
  `theme(id)`, `freezeTime(on)`, `solve()`.
- URL parameters `?room=N` (default 1), `?seed=N`, `?mood=0..3`.
- **`hening.inspect()`** (defined here; Opus and the qa hooks will provide it)
  returns:

  ```js
  {
    room: 6,
    phase: 'arriving' | 'playing' | 'departing' | 'results',
    gate: { found: true, stones: 4 },
    arrival: { reachedStart: true, teleported: false },
    stranger: { seated: true, onScreen: true },
    water: { ponds: 2, basins: 1, fountains: 1, koi: 5 },
    framing: { fits: true },      // the room fits the current viewport
    render: { calls: 212, triangles: 48000 },
  }
  ```
- **`hening.frameStats(ms)`** → `Promise<{ frames, avgMs, p95Ms }>`, measured
  with `requestAnimationFrame` over `ms` milliseconds.

Write against exactly these names. If you need something else from the game,
do not invent it: list it in your report and Opus adds it to the contract.

## The tools

All three: ES modules in `game/tools/`, usable as a CLI and as imports, the
installed Edge or Chrome through `playwright-core` (as `review.mjs` does).
They serve the game from source with Vite's `createServer` on a free port, so
no build is needed; `--url` overrides that (e.g. the built
`dist/hening.html` from disk). They collect browser console errors per page,
write temporary output only under `.scratch/<tool>/`, and exit non-zero when a
check fails.

1. **`rooms-check.mjs`** — prompt 01 §3 *All-rooms check*, every item in it:
   for each of the 50 rooms with `?qa=1&room=N&seed=N`, at 1440 × 900 and at
   390 × 844, record gate/stones, arrival reached without teleport, stranger
   seat and on screen, ponds / basins / fountains, koi, framing fits at both
   sizes, console errors, average frame ms. Then `arrange()` and confirm the
   phase reaches `departing` and then `results` (generous timeout; say which
   you chose). Rooms with no gate or seat are listed, not failed. Output a
   Markdown table (the summary's all-rooms table, columns as in the prompt's
   deliverable) to `.scratch/rooms-check/report.md`, and print it.
   `--rooms 1,6,50` limits the run.
2. **`perf.mjs`** — prompt 01 §3 *Perf*: room 6 with all objects lit
   (`arrange()`, wait for the results phase, then measure) and the largest room
   by floor-cell count (compute it from `src/data/rooms.generated.json`).
   Average and p95 frame ms and draw calls, against the budgets of
   `ARCHITECTURE.md` §14. Report to `.scratch/perf/report.md`.
3. **`regress.mjs`** — prompt 01 §4: render the game with `?qa=1&seed=7` using
   **the same call sequences and timings as `shoot-reference.mjs`** for its 18
   frames (thanks to `level(0..2)` the rooms match), with `freezeTime(true)`
   where the reference frame is static. For each, write the game frame and a
   side-by-side composite (reference left, game right, labels) to
   `.scratch/regress/` (compose on a canvas in a headless page, as
   `review.mjs` does, no image packages). Then save the latest game frames
   with `saveCurrent` to `review/current/room/<state>.jpg` for every name the
   prompt lists (`room06-fajar` … `arrival`, plus `room01`, `room25`,
   `room50`, `phone-room06` at 390 × 844). `--only gate,stranger` limits it.

## How to check without the finished game

The game's room is not ready yet. Check what can be checked now: point
`regress.mjs --url` at `reference/index.html` for **both** sides, so its 18
calls are proven on the reference API; check that `rooms-check.mjs` and
`perf.mjs` start Vite, open the page, and report cleanly that `inspect` /
`frameStats` are missing, instead of crashing. Say exactly which checks ran and
which did not.

## Fence

Create only `game/tools/rooms-check.mjs`, `game/tools/perf.mjs`,
`game/tools/regress.mjs`, and helpers under `game/tools/lib/` if you need
shared code. Do not edit `review.mjs`, `shoot-reference.mjs`, anything in
`game/src/`, `tests/`, `docs/`, `reference/`. Delete what you put in
`.scratch/` when you finish. No git.

## Report

Files created (one line each); how you checked (commands and key output
lines); what did not run and why; anything you need from the game that is not
in the contract above.
