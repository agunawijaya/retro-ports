# Prompt 07 — Polish 2: art/logic split, reference sync, Dining Room and Family Room art

You are working on the Spyder web game in `E:\Projects\retro-ports\spyder`. **Runs alone.** Sections are tagged **[LOGIC]** or **[ART]** (see `prompts/CLAUDE-CODE.md`, "Model policy"): if you were told to do only [LOGIC], build no art and leave the [ART] sections untouched.

## Read first

`ART-DIRECTION.md` (§3, §4, §6, §15 incl. "Where images go"), `game/NOTES.md`, `review/prompts/05-family-room-fix-1/summary.md`, `review/prompts/06-dining-room-fix-1/summary.md`, `game/lib/room-registry.js`, `game/lib/room-runtime.js`, `game/rooms/dining-room/room.js`, `game/rooms/family-room/room.js`.

## Rules

Plain scripts, global `Spyder`, opens from disk, no network. No per-frame blur. Palette only; saturation only from light. Images only through `review.mjs` or into `.scratch/`; `node review.mjs audit` must print nothing at the end; empty `.scratch/` at the end. Humanized code. No git commits.

---

## L1 [LOGIC] — Rooms can keep their art in a separate file

So that logic and painting can be built by different agents, a room may now be two files:

| File | Holds |
|---|---|
| `rooms/<id>/room.js` | `S.rooms.register({...})` with everything that is not painting: `id`, `number`, `act`, `name`, `layout` (platforms, bounds, dropPoints, lairs, wallArea, window, CEILING, FLOOR_LINE, GROUND, **and the new `props` list**), `rules`, `makeWebs`, makeover **timing** (`makeover.beats: [{ at, name }]`), `storyObject`, QA states, `art: true` |
| `rooms/<id>/art.js` | `S.rooms.attachArt('<id>', { paint, createLive, drawSky, drawProps, drawOnFurniture, lights, glow, beat })` — all painting, lighting and glow. `beat(name, mk, t)` draws/animates each named makeover beat. |

- `layout.props` is a list of `{ name, x, y, w, h, kind }` (`kind`: `furniture`, `wall`, `light`, `window`, `story`) describing every object the art will paint, at its real position and size.
- **Built-in blockout:** if a room registers with `art: true` but `art.js` is missing or has not attached yet, the runtime draws a **blockout** from `layout`: room bands (ceiling, wall, floor) in flat palette tones, every platform as a lit slab, every prop as a labelled rectangle (name in Special Elite, `linen` on `walnut`), lights as small amber circles with a simple point light. The game is fully playable on a blockout. Add a QA flag `?art=off` that forces the blockout even when art exists.
- The registry loads `rooms/<id>/art.js` after `room.js` when `art: true` (same mechanism as `room.css`).
- Existing rooms stay single-file; do not migrate them. Document the two-file form in `game/NOTES.md` ("The room interface").
- Add a check to `checks.mjs`: a stand-in two-file room registered without its art plays on the blockout with no console errors, and `?art=off` shows the blockout for the Living Room.

## L2 [LOGIC] — Reference sync for hatchlings

`03-polish-fix-1` changed how hatchlings scatter in `game/lib/` but not in `reference/`, so `regress.mjs` now shows a small difference in `action`. Port that scatter change (`world.hatch` fan presets and the `Hatchling` scatter phase) into `reference/lib/spiders.js` and `reference/scene.js`, change nothing else there, and re-render `reference/screens/action.jpg` (JPEG quality 90, same name). `regress.mjs` must then report the Living Room identical in every state.

---

## A1 [ART] — Dining Room up to the bar

The Dining Room is playable but the weakest room. In `game/rooms/dining-room/room.js` (its painting functions only):

| Item | Now | Make it |
|---|---|---|
| Wainscot panels | Flat light boxes | Raised panels: a bevelled frame (lit top-left edge, shadow bottom-right), an inner field with faint grain, a dado rail with a lit top |
| China cabinet | A plain box with flat discs | Carved cornice and base, glazed doors with muntins, glass reflections (two soft diagonal streaks), plates standing and stacked in rows with rims and transfer bands, cups hanging from hooks; the cracked pane when dirty |
| Chairs | Small and stiff | 20 % larger, with a visible seat in perspective (front edge and seat top), legs with a turned profile, contact shadows; the tucked-in "A." chair clearly the same chair, pushed further in |
| Chandelier | Thin | Fuller: a central column, 6 curved arms with drip pans, 2 tiers of glass drops that glint; dirty: cobwebbed, one arm drooping |
| Clean wall | Too olive | Cooler and lighter sage (mix `moss` with `linen` and a touch of `sky`), so the room reads calm, not murky |
| **The egg nest** | Almost invisible under the table | Readable without breaking the mood: a soft cold **bounce light** from the floor under the table, a rim light on each egg sac, the hammock web brighter where light catches it; in `nest`, the about-to-hatch egg visibly pulsing |
| Dirty frame | Very dark | Keep it cold, but raise the moonlight bounce so the table, chairs and cabinet read as shapes at a glance (compare with `review/current/living-room/dirty.jpg`) |

## A2 [ART] — Family Room touch-ups

In `game/rooms/family-room/room.js` (painting only):

- **The empty wall** between the chimney breast and the bookshelf: add a cork board with children's crayon drawings and a school photo (low contrast), and a small shelf with a lava lamp that glows faintly when clean (a new tiny light source, warm-red, slow blobs).
- **The painting above the mantel, dirty state:** grimy and dark, but the seascape must still be recognisable (horizon, a sail), not a black square.

---

## Checks before you stop

`checks.mjs`, `flowtest.mjs` pass (counts); `regress.mjs` identical for the Living Room in every state; `perf.mjs` for the Dining Room `action` and `makeover` (mean, p95); no console errors in any room; `audit` clean.

## Deliverable — then STOP

1. `saveHero` for the changed frames: `dining-room` (`dirty`, `nest`, `makeover`, `clean`, `results`), `family-room` (`dirty`, `clean`).
2. `makeSheet('07-polish-2', …)`, six cells: dining dirty, dining nest, dining clean, family dirty, family clean, the Living Room on its blockout (`?art=off`, `action`).
3. `writeSummary('07-polish-2', …)`: per item what changed, check counts, perf, audit, and which parts were [LOGIC] and [ART] and who did them.
4. `node review.mjs gallery`. Then stop.
