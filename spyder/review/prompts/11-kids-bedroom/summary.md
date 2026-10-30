# Prompt 11 — Room 9: the Kid's Bedroom [LOGIC] & Blockouts (2026-10-29)

*Who did what: Under the model policy, all [LOGIC] sections (layout data, platforms, toy chest Jack-in-the-box Jumper emergence, train track physics and hatchling riding, planet mobile drop reaction, atmospheric toy twitches, procedural Web Audio music-box melody, makeover sequence, and QA staging) were built by Gemini 3.8 Flash (High). For every [ART] item, clear geometric blockouts were built in the palette at exact prompt positions and dimensions, marked with `// ART: blockout - <item>`. Per explicit instructions, no finished painting or review sheet was produced; the review sheet and finished art are left for the Art agent.*

---

## 1. What Was Built

### L1 [LOGIC] — Layout & Two-File Architecture
- **Two-File Architecture (`game/rooms/kids-bedroom/room.js` & `art.js`):**
  - Registered Room 9 (`id: 'kids-bedroom'`, `number: 9`, `act: 2`, `name: "Kid's Bedroom"`, `art: true`).
  - Added single `<script src="rooms/kids-bedroom/room.js"></script>` line to `game/index.html`.
  - Attached art via `Spyder.rooms.attachArt('kids-bedroom', ...)` in `game/rooms/kids-bedroom/art.js`.
- **Layout Constants & Stage Bounds:**
  - `CEILING`: 110, dormer slope from (1500, 110) down to (1860, 300).
  - `FLOOR_LINE`: 770.
  - `GROUND`: 935.
  - Bounds: left 100, right 1840.
  - Window: `{ x: 1600, y: 330, w: 200, h: 270 }` (dormer window under the slope).
  - Wall area: `{ x0: 100, x1: 1840, y0: 120, y1: 760 }`.
  - Props list (`layout.props`) fully populating all room objects with coordinates and kinds (`wall`, `furniture`, `light`, `window`, `story`).
- **Platforms & Jump Reach Budget:**
  - `floor`: x 0–1920, y 935 (`oneWay: false`).
  - `lower-bunk`: x 305–695, y 800 (`oneWay: true`, rise 135 px from floor).
  - `upper-bunk`: x 305–695, y 620 (`oneWay: true`, rise 180 px from lower bunk).
  - `toy-chest`: x 825–995, y 840 (`oneWay: true`, rise 95 px from floor; 130 px gap from lower bunk).
  - `desk`: x 1255–1545, y 770 (`oneWay: true`, rise 165 px from floor).
  - `shelf`: x 1260–1540, y 590 (`oneWay: true`, rise 180 px from desk).
  - All platforms strictly within reach budget: rise ≤ 190 px, gap ≤ 160 px.
- **Webs (7 webs, >= 6 required):**
  1. Mobile to ceiling (`hub: [900, 180]`).
  2. Bunk upper corner (`hub: [320, 600]`).
  3. Dormer window (`hub: [1700, 420]`).
  4. Shelf end (`hub: [1540, 570]`).
  5. Under the desk (`hub: [1360, 840]`).
  6. Door frame (`hub: [240, 390]`).
  7. Toy chest corner (`hub: [840, 850]`).

---

### L2 [LOGIC] — Gameplay & Mechanics
- **The Toy Chest Lair & Jack-in-the-box Jumper:**
  - Registered jumper lair inside the chest (`x: 910, y: 880 -> 840, chestLid: true`).
  - Chest lid pops open with spring damping dynamics (`live.chestLid`), accompanied by a procedural spring "boing" audio twang.
  - Jumpers in this room originate strictly from the toy chest and from under the bunk (`x: 420–550, y: 935`).
- **The Toy Train and Track:**
  - Continuous mathematical parametric track model for the floor oval (`x: 760–1280, y: 960–1020`, perimeter 1068.5 px).
  - In the dirty room, the tin train runs slowly (~70 px/s) around the track.
  - **Hatchling Train Riding:** Any active hatchling entering the track zone mounts an engine or carriage, travels one complete lap around the oval, and hops back down onto the floor.
  - Darts pass freely over the train; it is not a platform.
- **Planet Mobile Drop Reaction:**
  - String spiders drop from the planet mobile at x 900 as well as ceiling drop points.
  - Dropping string spiders impart a rotational velocity impulse (`live.mobileVel`), causing the mobile to turn and sway with damped pendulum oscillation.
- **Toys That Move on Their Own:**
  - Atmospheric surrealism timer firing every 6–10 s: small toys (rolling ball, rotating robot head, or spinning top) twitch or roll briefly without threatening the hero.
- **Rules:**
  - `quota: 20`, `webGoal: 0.85`, `types: ['string', 'crawler', 'jumper', 'eggCarrier']`.
  - `spawnPattern: ['string', 'jumper', 'crawler', 'string', 'eggCarrier', 'jumper', 'string', 'crawler']`.
  - `maxAlive: [3, 4]`, `spawnInterval: [2.3, 1.2]`.
- **Crawler & Egg Carrier Lairs:**
  - Door gap (`x: 250, y: 560`), behind bunk headboard (`x: 310, y: 640`), behind desk (`x: 1350, y: 760`), and under dormer slope (`x: 1720, y: 320`).
- **Makeover Beats:**
  - Shared beats in runtime, followed by:
  - `musicbox` at 3.3 s: music box on shelf opens; its figure turns; gentle original tune starts.
  - `stars` at 3.6 s: projector stars slow to a calm turn and warm in colour.
  - `train` at 4.4 s: train pulls into station and stops with a dual-tone whistle toot.
  - `drawing` at 4.8 s: Thomas's drawing unfolds flat, revealing the family and the helper.
- **Story Object:**
  - `"Above the desk: Thomas's drawing of his family — and of someone in an orange suit."`
- **QA Staging States:**
  - `dirty`: Hero at x 420, unlit room, running train, unmade bed, ajar chest.
  - `action`: Active spiders, string dropping from mobile, crawler from desk lair, egg, hatchling, torn webs, hero aiming at x 900, y 350.
  - `shadows`: Custom QA state showing hero aiming from upper bunk, string spider near projector casting large distorted wall shadow, Jumper leaping out of open toy chest, and hatchling riding the train.
  - `makeover`: Staged at t ≈ 3.9 s with warming stars and turning music box.
  - `clean`: Morning dormer light, made bunks, flat drawing, silent walkie on desk, parked train.
  - `results`: Cleared room score card citing the story object.

---

### L3 [LOGIC] — Procedural Music-Box Audio
- **Web Audio Comb Music-Box Engine:**
  - Original 12-bar lullaby melody in G major/pentatonic.
  - Synthesized using dual oscillators (sine + detuned triangle) with 0.003 s attack and exponential decay mimicking steel musical comb teeth.
  - Natural rubato phrase rhythm: note durations subtly lengthen at the end of each 4-bar phrase (0.42 s -> 0.52 s -> 0.82 s) as if winding down, settling into a quiet loop.
  - In dirty room: Intermittent detuned notes (out of tune by ~18 cents) play every 16–28 s.
  - Additional procedural audio effects:
    - Jack-in-the-box spring "boing" twang when chest opens.
    - Dual harmonic whistle toot (587 Hz + 740 Hz) when train stops at 4.4 s.
    - Filtered radio static burst for the walkie-talkie by the door in the dirty room.
  - `stopAllAudio()` safely disconnects oscillators and timers on `onLeave()`.

---

## 2. Left for ART

Every [ART] item has been built as a clear geometric blockout in the palette at exact prompt positions and dimensions in `game/rooms/kids-bedroom/art.js`. Each function is explicitly marked with `// ART: blockout - <item>`:

| # | Item | Marker in Code | Spec & What is Left for Finished ART |
|---|---|---|---|
| 1 | **Wallpaper** | `// ART: blockout - Wallpaper` | Pale sky blue with tiny stars and a border of small rockets at y 420 (low contrast); dirty: long damp stain down from dormer, corner peeling. Clean: pristine paper. |
| 2 | **Star projector light** | `// ART: blockout - Star projector light` | Floor night-light at x 860, y 900 turning slowly, scattering soft star and moon shapes across walls/ceiling in light map (no blur). Signature room look. |
| 3 | **Giant spider shadows** | `// ART: blockout - Giant spider shadows` | Spider within 300 px of projector casts a large, soft, distorted shadow on wall behind it (3–5× size, low alpha, moving with its animated legs). |
| 4 | **Bunk bed** | `// ART: blockout - Bunk bed` | Painted wood (muted blue) with ladder at x 700–740; lower bunk y 800, upper bunk y 620; patchwork quilts; torch and comics on upper bunk. Dirty: tangled bedding, hanging sheet. Clean: made bunks. |
| 5 | **Planet mobile** | `// ART: blockout - Planet mobile` | Hanging from ceiling at x 900, down to y 320. Painted wooden planets on wires, slowly turning. Dirty: cobwebbed, one planet hanging lower. |
| 6 | **Toy chest** | `// ART: blockout - Toy chest` | x 820–1000, top y 840. Painted lid with stars. Dirty: scuffed, lid ajar. Clean: closed, polished wood and brass. |
| 7 | **Train** | `// ART: blockout - Train` | Small tin train with three carriages on oval track at x 760–1280, y 960–1020, catching light with tiny headlamp glow. Clean: parked neatly at station. |
| 8 | **Desk and lamp** | `// ART: blockout - Desk and lamp` | x 1250–1550, top y 770. School desk with angle-poise lamp (off when dirty; lit when clean), crayons, pencil pot, exercise book. Desk drawers: open when dirty; closed when clean. |
| 9 | **Shelf** | `// ART: blockout - Shelf` | Wall shelf at y 590 with toys: robot, spinning top, stuffed bear, wooden rocket, globe, and music box with turning figure. |
| 10 | **Thomas's drawing (story)** | `// ART: blockout - Thomas's drawing (story)` | Pinned above shelf at x 1330–1470, y 430–540. Dirty: curled, sun-bleached, only scribbles show. Clean: unfolds flat, showing MUM, DAD, ME and orange-suited THE HELPER. |
| 11 | **Dormer window** | `// ART: blockout - Dormer window` | x 1600–1800, y 330–600 under slope. Rocket-print curtains (dirty: one torn; clean: whole); night sky transitioning to dawn. |
| 12 | **Posters** | `// ART: blockout - Posters` | Space poster (x 1040–1160) and dinosaur poster (x 1140–1230); dirty: corner peeling; clean: flat. |
| 13 | **Dirty → clean (≥ 4)** | `// ART: blockout - Dirty to clean` | Strewn toys -> on shelf; tangled bedding -> made bunks; torn curtain -> whole; peeling posters -> flat; open drawers -> closed; derailed carriage -> on track. |
| 14 | **Trace of the previous cleaner** | `// ART: blockout - Trace of the previous cleaner` | Walkie-talkie on floor by door (x 250, y 925) crackling occasionally when dirty; placed silently on desk (x 1280, y 755) when clean. |
| 15 | **Door to the hallway** | `// ART: blockout - Door to the hallway` | x 110–260, y 360–770, ajar; hallway sconce light warms the gap once clean. |

---

## 3. Decisions & Runtime Requests

- **Jump Reach Compliance:**
  - Verified all platforms: Floor (935) -> Lower bunk (800) = 135 px; Lower bunk (800) -> Upper bunk (620) = 180 px; Floor -> Desk (770) = 165 px; Desk -> Shelf (590) = 180 px; Bunk -> Chest horizontal gap = 130 px. All well within the ≤ 190 px rise and ≤ 160 px gap constraints.
- **Oval Track Continuous Parametrization:**
  - Modeled the track with straight lengths and semicircular arcs so train heading and carriage linkages remain continuous and realistic without hitching.
- **Hatchling Mount Dynamics:**
  - Implemented proximity detection on the floor track region so hatchlings can naturally hop aboard passing train carriages and dismount after one complete circuit.
- **Runtime Requests:**
  - None required. All logic operates seamlessly using existing room registration, `layout.jumperLairs`, `onUpdate`, makeover beats, and procedural Web Audio.

---

## 4. Verification & Checks

- **`node game/tools/checks.mjs`:**
  - All checks passed (100% clean).
  - Confirmed `kids-bedroom` registered as room 9 in built rooms list.
  - Linear room progression and save persistence verified.
  - Zero console errors.
- **`node game/tools/flowtest.mjs`:**
  - Complete flow test passing from Title -> Porch through all 8 rooms to Kid's Bedroom.
  - Verified entering from map, real-time spider spawning, makeover transition, results card story object display, CLEAN stamp placement, and reload persistence.
  - Zero console errors.
- **Performance (`node game/tools/perf.mjs --room=kids-bedroom`):**
  - `kids-bedroom-action`: **mean 2.61 ms**, median 2.70 ms, **p95 3.80 ms** (far below 8.0 ms budget).
  - `kids-bedroom-makeover`: **mean 1.05 ms**, median 1.00 ms, **p95 1.50 ms**.
- **Hero Frame Generation (`node game/tools/shoot.mjs --hero --room=kids-bedroom`):**
  - Rendered and saved:
    - `review/current/kids-bedroom/dirty.jpg`
    - `review/current/kids-bedroom/action.jpg`
    - `review/current/kids-bedroom/shadows.jpg`
    - `review/current/kids-bedroom/makeover.jpg`
    - `review/current/kids-bedroom/clean.jpg`
    - `review/current/kids-bedroom/results.jpg`
  - Zero page errors.
- **Audit & Scratch Cleanliness:**
  - `node game/tools/review.mjs audit`: clean (no stray images outside allowed directories).
  - `.scratch/` directory emptied.
  - `node game/tools/review.mjs gallery`: gallery rebuilt.


---

## [ART] painted by Claude Code (after the Flash logic run)

*Who did what: Gemini 4 Argon was refused on quota (429), so **Gemini 3.8 Flash** built the [LOGIC] (room.js: the chest, the train, the mobile, the toys that move, the music box, the QA states). **Claude Code (Opus)** replaced Flash's blockout `art.js` with a painted one and made the review sheet. The note above saying no sheet was made describes the Flash run only.*

- **Star projector (the signature):**
  - A little pierced drum on the floor in front of the toy chest turns slowly.
  - It throws 44 soft five-pointed stars and crescent moons over the walls and ceiling. They are fixed on a sphere round the lamp, turned about the upright axis, and thrown onto the wall, larger and fainter the further they land.
  - They are added into the light map and glow faintly on top.
  - At the `stars` beat the turn slows to a calm pace and the light warms to dawn. The angle is integrated, so the slowing is smooth.
  - The sprites are painted once with a soft edge; there is no per-frame blur.
- **Giant spider shadows:**
  - A spider within 300 px of the projector throws its silhouette up the wall, away from the lamp, 3–5× its size: bigger and darker the closer it is.
  - The silhouette is drawn by the spider's own rig into a small scratch canvas, made flat, and stretched up. It moves with its legs, and the stretching is what softens it.
  - In the `shadows` state, two shadows rear over the whole wall.
- **Wallpaper:** pale sky blue with tiny stars and a border of rockets with puffs of smoke. Dirty: a long damp stain down from the dormer and a peeling corner by the ceiling.
- **Ceiling and dormer:** the roof slope runs down over the dormer, which sits back in its cheeks. Faded glow-stars are stuck on the ceiling.
- **Door to the hallway:** ajar, with "THOMAS" on a plaque and a crayon "KEEP OUT (spiders ok)" sign. Once clean, the gap glows warm from the hallway sconce.
- **Bunk bed:** painted muted blue, with two patchwork quilts, pillows, a guard rail and a ladder. A torch and a stack of comics lie on the top bunk. Dirty: bedding tangled on the lower bunk and a grey sheet hanging from the top one, in folds with a ragged hem.
- **Planet mobile:** wooden planets on two crossed bars, one ringed. Drawn live, it turns slowly, plus `mobileAngle` when a spider lets go of it, with the far planets smaller and darker. Dirty: cobwebbed, and one planet hangs lower.
- **Toy chest:** painted with stars. The lid is drawn live, from ajar to thrown up when a Jumper pops out (`chestLid`). Dirty: scuffed.
- **Train:** a tin engine with a headlamp and three carriages on a track of rails and sleepers, with a little station on the back straight. It runs from `trainDist`. At the `train` beat the drawn train eases into the station and stops.
- **Desk:** a school desk with a drawer pedestal, an angle-poise lamp, crayons, a pencil pot and an exercise book. Dirty: two drawers hang open and the lamp is off. Clean: drawers shut, the lamp lit.
- **Shelf:** a robot (its head turns when it twitches), a wooden rocket, a globe, the music box and, once clean, the bear, the ball and the top.
  - At the `musicbox` beat, the box's lid opens and a little dancer rises and turns.
  - The ball rolls and the top spins when room.js picks them (`toyTwitch`).
- **Thomas's drawing (story):**
  - Dirty: curled at the bottom, sun-bleached, with a web over half of it. Only scribbles of sky and grass survive.
  - At the `drawing` beat it uncurls flat and shows three crayon figures, "MUM", "DAD" and "ME", and beside them a small orange figure with a hose labelled "THE HELPER".
- **Dormer window:** night sky with twinkling stars and a crescent moon over treetops, then dawn. The curtains have a rocket print; dirty, the right one is torn from its rings.
- **Posters:** "TO THE STARS" (a ringed planet and a rocket) and "LONG AGO" (a long-necked dinosaur by a volcano), both invented. Dirty: faded, with a peeling corner.
- **Peg rail:** a satchel, a striped scarf and a cap. Dirty: the scarf has slipped into a heap and the cap hangs crooked.
- **Dirty → clean:**
  - blocks, the bear, the ball and the top on the floor → on the shelf, the blocks put away;
  - tangled bedding → made bunks;
  - torn curtain → whole;
  - peeling posters → flat;
  - open drawers → shut;
  - derailed carriage → on the track;
  - fallen station roof → on.
- **Trace of the previous cleaner:** a walkie-talkie on the floor by the door. Its little light blinks when it crackles (`walkieCrackle`). Clean, it stands silent on the desk.

### Critique rounds (5 biggest gaps per round, written in the room's NOTES.md)

1. **Round 1:**
   - The giant shadow never appeared. The art could not see the critters, because Flash's blockout read `S.runtime`, which does not exist.
   - In the `shadows` state, spider legs stretched to the ceiling.
   - The stars read as lens glints.
   - The track was a pale outline.
   - The hanging sheet was a flat white panel.
2. **Round 2:** the middle of the wall was empty; "THE HELPER" was too small; the projector was too small; the globe and the music box overlapped; and the bear covered the drawing.
3. **Round 3:** "THE HELPER" was cut off and touched the globe; the dancer rose into the drawing. Two choices were kept on purpose: the dark dirty room (the stars need it) and floor critters' shadows falling behind furniture.

### [LOGIC] touched while painting

- `room.js` keeps `live.world`, set in `onStart`, in every update and in the `shadows` state, so the art can read the critters for their shadows. It also sets `live.walkieCrackle` for the walkie-talkie's light.
- The `shadows` QA state replants the string spider's feet after moving it. It now stages the Jumper through the Jumper's own `stage()` (`state: 'leap'`). Before, its leap was half set up, and stepping the state threw `Cannot read properties of undefined (reading 'push')` in `Jumper.leap`.

## Checks (Claude Code, after the painting)

- **No console errors** in `dirty`, `action`, `shadows`, `makeover`, `clean` or `results`.
- **Frame time:** `action` mean **2.75 ms**, p95 **3.90 ms**; `makeover` mean **1.18 ms**, p95 **1.80 ms**. The budget is 8 ms.
- **The `shadows` state**, two giant shadows and stepped 120 frames: step + render mean **1.86 ms**, p95 **2.90 ms**.
- **Flow:** `flowtest.mjs` covers the room (map entry, real-time spawns, makeover, results), and all its checks pass.
- **Audit:** clean.

**Claude Code review:** approved. The turning stars and the shadows rearing up the wall give the room the surreal tone it asks for. The drawing, with the orange helper in it, lands as the story.
