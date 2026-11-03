# Prompt 01 — The room: port the reference scene onto the engine

You are building the Hening web game in `E:\Projects\retro-ports\sokoban\game`. **Runs after 00 is approved, possibly while Claude Code finishes the solver (`00-foundation-fix-2.md`) in parallel.** Do not touch `src/core/solver/`, the solver tests or `tools/solve.mjs`, and in `game/NOTES.md` edit only your own sections. Follow it literally. When something is unclear, choose the option that keeps the reference scene's look **exactly**, and write the decision in `game/NOTES.md`.

## Why this prompt exists

The look of Hening is already solved: `reference/index.html` is a playable, art-directed scene, and `docs/ART-DIRECTION.md` writes down every number in it. Prompt 00 built the pure rules, the 50 rooms and the solver. Your job is to join them: split the reference into the modules of `docs/ARCHITECTURE.md` §7.1, drive it from `core/game.js`, and make **every one of the 50 rooms** look and feel like the reference. You are not designing anything new here.

## Read first (completely, in this order)

1. `docs/ART-DIRECTION.md` — binding, all of it.
2. `docs/ARCHITECTURE.md` §1, §2, §5, §7, §10, §11, §13, §14.
3. `docs/GAME-DESIGN.md` §2, §3, §6, §7.5.
4. `reference/index.html` — **all of it**. Then open it in a browser and play: walk, push, protest, undo, rotate, solve a room (`hening.arrange()`), watch the departure. Use the reference panel to trigger every animation.
5. `review/reference/` — the 18 quality-bar frames from prompt 00.
6. `game/NOTES.md` and `game/src/core/` from prompt 00.

## Hard rules

- Do not modify `reference/`, `docs/`, `original/`, or `game/src/core/` (if the core needs a change, write it in NOTES as a request and work around it).
- Port, do not reinvent: every colour, size, timing, easing and shader line comes from the reference. Where the reference and `ART-DIRECTION.md` disagree, the reference wins; note the difference in NOTES.
- Zero raster: no image or audio files (fonts excepted).
- No per-frame allocation in hot paths beyond what the reference does; dispose everything on room change.
- Humanized code; JSDoc where it helps. No frameworks. No git commits.

## [ART] 1. Rendering and the world

Move reference sections into modules as mapped in `ARCHITECTURE.md` §7.1:

- `render/`: renderer (transparent canvas, CSS sky and sun), orthographic iso camera with framing and Q/E rotation, the pastel shader and role uniforms, the water shader, moods and their 2.4 s cross-fade, canvas textures, the island builder (floor checker, outer walls, caps, finials, three plinth tiers, lip; inner walls left to decor).
- `world/`: wanderer and its 15-number pose rig with every state of `ART-DIRECTION.md` §8.3 (walk, run, push, idle, look around, meditate, protest, shrug, bump, bow, rewind) and the opacity fade; fx (ripples, motes, petals, steam puff, hover tile, contact shadows); atmosphere (clouds, stars).
- `world/decor/`: ponds with koi and lily pads, fountain, tsukubai basin, torii gate with the lifting bar and stepping stones, the stranger, the crows, the decor manager with perches (`ART-DIRECTION.md` §10b).
- `themes/lentera.js` + `themes/index.js`: the lantern, pedestal, lit effects, wind-chime instrument and labels through the theme interface of `ARCHITECTURE.md` §7.2. Only Lentera exists after this prompt, but nothing outside `themes/` may know it is a lantern.
- `audio/sound.js`: the engine, hall reverb, drone and wind, and every effect sound of `ART-DIRECTION.md` §11; instruments come from the theme.
- `ui/hud.css`, `ui/hud.js`, `ui/icons.js`: wordmark + place line, tool buttons, counters (label from the theme), hint line, the veils — with the bundled fonts from `public/fonts/` (no Google Fonts link).

## [LOGIC] 2. The room screen — `screens/room.js`

The glue between `core/game.js` and the world:

- **Moves:** input → screen direction → grid direction (camera step) → `game.move()` → animate the `MoveResult` exactly as the reference animates its own state changes (walk/run/push timings, the object's delayed start and spring wobble, chime or muffled note by target index, ripple and motes on lighting).
- **Blocked:** `blocked-wall` → bump; `blocked-object` → protest, or shrug if blocked again within 3.5 s; the stranger notices the protest.
- **Undo / restart:** as `GAME-DESIGN.md` §2 (restart is undoable) with the reference's rewind animation and ripples. Undo during a step is queued, never lost.
- **Tap to walk:** `core/path.js`, run when the path is longer than 2 tiles, tap an adjacent object to push.
- **Arrival and departure:** the gate scripts of `ART-DIRECTION.md` §10b.2 (skip with any move key, Space or tap; R restarts without the arrival). After the departure, the results veil (temporary until prompt 02): solved line from the theme, `langkah · dorongan`, `Enter · ruang berikutnya`, which opens the next room.
- **Mood:** from the room's position on its floor (`ART-DIRECTION.md` §5.3), blending the two neighbouring moods for fractional positions. `?mood=0..3` and `hening.setMood()` override it.
- **Seeded randomness:** one seeded generator per room (seed = room number, or `?seed=N`), used for every decor choice (stranger seat among the best three, crow count and timers, koi starts, pad placement, clouds). The same room always looks the same; with the same seed, frames are reproducible.

## [LOGIC] 3. Boot, QA hooks and checks

- `main.js`: for now boots straight into `?room=N` (default 1) behind the reference's "ketuk untuk mulai" veil. Prompt 02 replaces this with the title and the tower.
- `dev/qa.js`: `window.hening` with every reference call plus `room(n)`, `level(0..2)` → rooms 5–7, `theme(id)`, `freezeTime(on)`, `solve()` (`ARCHITECTURE.md` §10). `solve()` plays the room's stored solution from `solutions.generated.json` when there is one, and otherwise falls back to `arrange()`; it must never fail because a room has no solution yet. `screen()` and `progress()` may be stubs until 02.
- **All-rooms check** (`tools/rooms-check.mjs`, Playwright): load each of the 50 rooms with `?qa=1`, and record: gate found (and number of stepping stones), arrival path reaches the start without the teleport fallback, stranger seat found and on screen at the default camera, number of ponds / basins / fountains, koi count, the camera framing fits the room at 1440 × 900 and at 390 × 844, no console errors, frame time. Rooms with no gate or seat are fine (the code falls back) but must be listed. Then finish each room with `hening.arrange()` and confirm the departure plays and the results veil appears. **No check in this prompt may depend on the solver**: the solver is being fixed in parallel, and all 50 original rooms are known to be solvable.
- **Perf** (`tools/perf.mjs`): frame time and draw calls in room 6 with all objects lit, and in the largest room. Budgets in `ARCHITECTURE.md` §14.

## [ART] 4. Regression against the reference — at least 3 rounds

`tools/regress.mjs` renders the game with `?qa=1&seed=7` using the **same calls** as `tools/shoot-reference.mjs` (thanks to `level(0..2)` the rooms match), and puts each game frame next to its `review/reference/` frame in `.scratch/regress/`.

Per round: compare every pair at full size. They must match in framing, tile proportions, palette per mood, plinth fade, wall/cap/finial shapes, water look, lantern shape and glow, wanderer silhouette and pose, gate, stranger, HUD type and layout. Decor *placement* may differ (seeded differently from the reference); decor *look* may not. Write the 5 biggest differences per round in `game/NOTES.md` → *Regression*, fix, re-render. Also check rooms 1, 25 and 50 for anything the reference never showed (very long walls, big ponds, many fountains, rooms with no inner walls) and fix what looks wrong.

Keep the latest frames with `saveCurrent` as `review/current/room/<state>.jpg`: `room06-fajar`, `room06-siang`, `room06-senja`, `room06-malam`, `room07-senja`, `room01`, `room25`, `room50`, `phone-room06`, the seven scrub checkpoints, `gate`, `stranger`, `fountain`, `basin`, `finale`, `arrival`.

## Done when

- Every one of the 50 rooms loads, arrives through its gate, plays, solves, departs and shows the results veil, with no console errors (all-rooms check).
- The regression pairs match (3 rounds documented).
- Perf within budget.
- `npm test` still passes; `npm run build` still makes a `hening.html` that opens from disk and plays.
- `node tools/review.mjs audit` prints nothing; `.scratch/` emptied.

## Deliverable — then STOP

1. `review/prompts/01-room/sheet.jpg`, ten cells in this order (left = reference, right = game where paired):
   1. `ref · ruang 06 fajar` 2. `game · ruang 06 fajar`
   3. `ref · ruang 06 malam` 4. `game · ruang 06 malam`
   5. `ref · protes` 6. `game · protes`
   7. `game · ruang 01 kedatangan` (arrival on the stepping stones)
   8. `game · ruang 50`
   9. `game · air mancur` (closest fountain in any room)
   10. `game · ponsel ruang 06` (390 × 844 frame, letterboxed into the cell)
2. `review/prompts/01-room/summary.md`: module list, the regression notes per round, the all-rooms table (room, stones, arrival ok, seat, ponds/basins/fountains, koi, fits desktop/phone, ms/frame), perf numbers, test counts, build size, audit result, and anything the core needed (requests).
3. `node tools/review.mjs gallery`.

Then stop. Do not start prompt 02.
