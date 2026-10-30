# Prompt 09 — Room 7: the Upstairs Hallway (introduces the Egg Carrier)

You are adding Room 7 to the Spyder web game in `E:\Projects\retro-ports\spyder\game\`, with a new spider type, the **Egg Carrier**. Where something is unclear, choose the option closest to the reference scene and write the decision in `game/rooms/upstairs-hallway/NOTES.md`.

**Precondition:** prompt 07 is done (two-file rooms and the built-in blockout exist). May run **in parallel with prompt 08**. Sections are tagged **[LOGIC]** or **[ART]** (`prompts/CLAUDE-CODE.md`, "Model policy"); if you were told to do only [LOGIC], build no art: the runtime's blockout covers the room, and the Egg Carrier uses a plain rig with a simple sac shape.

## Read first

1. `ART-DIRECTION.md` — §3–§7 (incl. "new types are new brains" in §7), §9, §10, §15 incl. "Where images go", §16, §17 row 7.
2. `DESIGN.md` §6 (Egg Carrier: "carries an egg sac; drops it when killed", first appears in the Hallway).
3. `game/NOTES.md` ("The room interface", two-file form), `game/lib/room-runtime.js`, `game/lib/spider-rig.js` (`legReach`, `legFemur`), `game/lib/spiders.js` (EggSac), `game/lib/spider-types/jumper.js` (how a type is built and registered).
4. Templates: `game/rooms/kitchen/room.js`, `game/rooms/family-room/room.js`. Quality bar: `review/current/`, `reference/screens/`.

## Hard rules

- Files: `game/rooms/upstairs-hallway/room.js` ([LOGIC]), `art.js` ([ART]), optional `room.css`; **one new file** `game/lib/spider-types/egg-carrier.js` and its registration line. In `game/lib/spiders.js` you may add **one exported drawing helper** (`S.spiders.drawEggSac(ctx, x, y, opts)`, extracted from `EggSac.draw`, no behaviour change). Shared edits: `<script>` lines in `game/index.html` (egg-carrier, then the room) — re-read before editing; prompt 08 may edit it too.
- Use the room id the house map uses (`lib/house-map.js`). Do not modify other lib files, `reference/`, or other rooms.
- **Jump reach:** rise ≤ 190 px, horizontal gap ≤ 160 px.
- `S.paint` for every surface, palette only, no per-frame blur, static art cached.
- Images only through `review.mjs` or `.scratch/`; `audit` clean; `.scratch/` emptied. No git commits.

## The room

The upstairs hallway, seen from the side like every room: a long wall with four bedroom doors in a row, the top of the staircase on the left, a tall window at the far right end, and the attic hatch in the ceiling with its ladder pulled half down. Tense: every door is a place something can come out of.

### L1 [LOGIC] — Layout data (also `layout.props`)

| Element | Position (stage units) | kind |
|---|---|---|
| Ceiling | y 0–110, picture rail at y 150 | wall |
| Wall | y 110–770: wallpaper above a dado rail at y 560, painted panelling below | wall |
| Staircase top and banister | x 100–440, rail top y 760, balusters below, the stairwell dropping away into darkness at the far left | furniture |
| Door A | x 480–660, y 360–770 | furniture |
| Door B | x 820–1000, y 360–770 | furniture |
| Door C — Thomas's room (story) | x 1160–1340, y 360–770; its door frame carries the height marks | story |
| Door D | x 1500–1680, y 360–770 | furniture |
| Sconces | x 400, 740, 1080, 1420, at y 320 | light |
| Side table with vase and photos | x 690–790, top y 800 | furniture |
| Attic hatch | x 1350–1500 in the ceiling, dark opening | furniture |
| Attic ladder (pulled half down) | x 1370–1490, rungs at y 800, 660, 520, 380 | furniture |
| End window | x 1730–1850, y 320–700 | window |
| Radiator under the window | x 1700–1860, top y 820 | furniture |
| Hall runner | along the floor, y 860–1000 | wall |
| Floor | y 770–1080, boards in the reference perspective | wall |

**Platforms:** floor y 935; banister rail x 110–430, y 760; side table x 695–785, y 800; ladder rungs x 1375–1485 at y 800, 660, 520, 380 (one-way, 140 apart); radiator x 1705–1855, y 820. `bounds`: left 120, right 1840.

**Lairs:** wall crawlers and Egg Carriers come out of the **gap of a door that creaks ajar** (doors A, B, D swing open 10–15° with a creak and a sliver of darkness, the spider emerges, the door drifts shut); string spiders drop from the ceiling and **from the attic hatch**; jumpers come up the stairwell.

### L2 [LOGIC] — The Egg Carrier (`lib/spider-types/egg-carrier.js`, registered as `eggCarrier`)

| Aspect | Spec |
|---|---|
| Body | `SpiderRig`, scale 1.1, back pair (`legFemur` 1.2) **raised and curled over its back, holding a large egg sac** on the abdomen (sac drawn with `S.spiders.drawEggSac`, about 1.3× a normal sac, slightly pulsing). The silhouette must read instantly: a spider carrying a pale bundle. |
| Movement | Walks the wall like a Wall Crawler at 0.75× its speed; freezes now and then; stays away from the hero when possible |
| Planting | After 9 s alive (if not killed) it stops, lowers the sac onto the wall with a little silk (0.8 s), and leaves a **wall egg sac** (normal hatch timer). Then it continues as a crawler without the sac (worth fewer points) |
| Shot in the body while carrying | It dies; the sac **falls** and lands, and hatches after only 3 s unless popped |
| Shot in the sac | The sac pops (+150, label "Egg first!"); the spider survives and flees at 1.4× speed |
| Points | 220 (carrier), 120 after planting |
| Intro | The room's first Egg Carrier spawns alone through door B with a slow emerge (1.2 s), so the player can read it |

### L3 [LOGIC] — Gameplay and data

- `rules`: `quota: 20`, `webGoal: 0.85`, `types: ['string', 'crawler', 'jumper', 'eggCarrier']`, `spawnPattern: ['crawler', 'eggCarrier', 'string', 'crawler', 'jumper', 'eggCarrier', 'string', 'crawler']`, `maxAlive: [3, 4]`, `spawnInterval: [2.2, 1.2]`.
- Makeover beats (timing): shared beats, then `sconces` at 3.3 s (light left to right, 0.3 s apart, a chime each), `doorC` at 4.4 s (Thomas's door swings slowly open, warm night-light spilling out), `ladder` at 4.9 s (the attic ladder folds up and the hatch closes with a clunk).
- `storyObject`: "On a door frame: Thomas, measured every birthday. The marks stop at eight."
- Webs (≥ 6): across the attic hatch, between two ladder rungs, from a sconce to the ceiling, the corners of doors A and D, banister to wall, the window's upper corner.
- QA states: `dirty`, `action`, `makeover` (t ≈ 3.9 s, sconces lighting), `clean`, `results`, plus `carrier`: an Egg Carrier emerging from door B's gap with its sac, a second one planting an egg on the wall, the hero on the ladder's second rung aiming.

### A1 [ART] — Painting, light, props

| Item | Spec |
|---|---|
| Wall | Faded floral wallpaper (small sprigs, low contrast) above the dado; painted panelling below with bevels; dirty: torn strips hanging, damp patches |
| Doors | Four-panel doors with brass knobs and keyhole plates, each door slightly different (one with a child's name plate on door C, "THOMAS", hand-painted); door frames with mouldings; dirty: door D hangs from one hinge |
| **Height marks (story)** | On door C's frame: pencil lines with dates and "Thomas 3 · 4 · 5 · 6 · 7 · 8". Dirty: greyed by dust, unreadable. Clean: legible, the last mark at eight |
| Sconces | Brass arms with frosted tulip shades; dirty: one flickering, the others dark and cobwebbed |
| Attic hatch | A black opening with faint cold light and, in the dirty state, **two pairs of eye glints** that blink now and then |
| Window | Tall sash window, moonlight shaft running left along the runner with motes |
| Stairwell | Darkness falling away past the banister, the top steps catching a little moonlight |
| Under-door light | A faint warm line under door C (a child's night-light) even when dirty |
| Dirty → clean (≥ 4) | Torn wallpaper → whole; runner rucked and dusty → flat and rich red; photos on the side table fallen → standing; door D off its hinge → fixed; a broken baluster → whole; radiator rusty → painted cream |
| Trace of the previous cleaner | A step stool tipped over under the attic hatch with a coil of rope (they tried to go up). Clean: stool upright, rope coiled on it |
| Egg Carrier art | Its sac uses the redesigned egg sac look; the raised back legs clearly wrap the sac; a faint silk strand ties sac to abdomen |

## QA (ART-DIRECTION §15)

URL `game/index.html?qa=1&room=upstairs-hallway`. [LOGIC]: play through on the blockout; check door spawns, planting, sac shots, the 3 s fallen-sac hatch, ladder rungs, makeover timing. [ART]: at least 3 critique rounds against `reference/screens/` and `review/current/`, 5 biggest gaps per round in NOTES (typical: doors as flat rectangles, wallpaper too busy, attic hatch as a plain black box, Egg Carrier not readable at a glance).

## Deliverable — then STOP

1. `saveHero(page, 'upstairs-hallway', …)`: `dirty`, `action`, `carrier`, `makeover`, `clean`, `results`.
2. `makeSheet('09-upstairs-hallway', …)`: dirty, carrier, action, makeover, clean, results.
3. `writeSummary('09-upstairs-hallway', …)`: what was built, decisions, runtime requests, checks (no console errors; perf mean/p95 in `action` and `makeover`), audit, and which parts were [LOGIC] and [ART] and who did them.
4. `node review.mjs gallery`. Then stop.
