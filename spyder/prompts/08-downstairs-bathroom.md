# Prompt 08 — Room 6: the Downstairs Bathroom

You are adding Room 6 to the Spyder web game in `E:\Projects\retro-ports\spyder\game\`. Where something is unclear, choose the option closest to the reference scene and write the decision in `game/rooms/downstairs-bathroom/NOTES.md`.

**Precondition:** prompt 07 is done (two-file rooms with `art: true` and the built-in blockout exist). May run **in parallel with prompt 09**. Sections are tagged **[LOGIC]** or **[ART]** (`prompts/CLAUDE-CODE.md`, "Model policy"); if you were told to do only [LOGIC], build no art: the runtime's blockout covers it.

## Read first

1. `ART-DIRECTION.md` — §3, §4, §5 (composition, HUD safe zones), §6, §9, §10, §15 incl. "Where images go", §16, §17 row 6.
2. `game/NOTES.md` ("The room interface", the two-file form), `game/lib/room-runtime.js`.
3. Templates: `game/rooms/kitchen/room.js` (Jumper spawns, lights), `game/rooms/family-room/room.js` (latest painting quality).
4. `review/current/` and `reference/screens/` — the quality bar.

## Hard rules

- Two files: `game/rooms/downstairs-bathroom/room.js` ([LOGIC]) and `art.js` ([ART]); optional `room.css`. Shared edit: **one `<script>` line** in `game/index.html` for `room.js` (re-read the file right before editing; prompt 09 may edit it too). Use the room id the house map uses (check `lib/house-map.js`).
- Do not modify `game/lib/`, `reference/`, or other rooms. Runtime needs go into NOTES as requests.
- **Jump reach:** rise ≤ 190 px, horizontal gap ≤ 160 px between platforms.
- `S.paint` for every surface, palette only, no per-frame blur, static art cached in `dirty`/`clean` layers.
- Images only through `review.mjs` or `.scratch/`; `audit` clean; `.scratch/` emptied at the end. No git commits.

## The room

A small, tiled downstairs bathroom: claw-foot tub, pedestal sink under a fogged mirror, an old high-cistern toilet. Tense: harsh bare bulb, dripping water, plugholes. It must feel **narrow** — the walls close in.

### L1 [LOGIC] — Layout data (also `layout.props`)

| Element | Position (stage units) | kind |
|---|---|---|
| Side walls in perspective | left x 0–260, right x 1660–1920 (darker, tiled) | wall |
| Back wall | x 260–1660; plaster y 110–380, tiles y 380–770 | wall |
| Ceiling | y 0–110 | wall |
| Bare bulb on a cord | cord from x 960, y 0; bulb at y 240 | light |
| Frosted window | x 420–640, y 170–330 (above the tub) | window |
| Claw-foot tub | x 300–760, rim y 760, feet to y 900 | furniture |
| Shower rail and curtain | rail arc above the tub at y 200; curtain half drawn over the tub's right third | furniture |
| Pedestal sink | x 1040–1240, rim y 765 | furniture |
| Mirror cabinet (story) | x 1040–1240, y 330–580 | story |
| Mirror strip light | above the mirror, x 1060–1220, y 310 | light |
| Towel shelf | x 1360–1600, y 600 | furniture |
| High-cistern toilet | bowl x 1400–1560, lid y 820; cistern x 1420–1540, y 250–330, pull chain | furniture |
| Floor | y 770–1080, hexagonal mosaic tiles | wall |

**Platforms:** floor y 935; tub rim x 310–750, y 760; sink rim x 1050–1230, y 765; towel shelf x 1360–1600, y 600 (165 up from the sink, 130 across); toilet lid x 1410–1550, y 820. `bounds`: left 280, right 1640.

**Lairs and drop points:** jumpers and hatchlings come out of the **tub drain** and the **sink plughole** (a hairy leg pokes out first, 0.6 s, then the spider climbs out); wall crawlers from behind the cistern and from under the curtain; string spiders drop from the bulb cord's ceiling rose and from three other ceiling points.

### L2 [LOGIC] — Gameplay

- **Slippery puddles:** three puddles on the floor (x 520–640, 880–1010, 1300–1380). Inside a puddle the hero's ground friction drops to 25 % (he slides), with small splash particles. Clean state: puddles gone.
- **Bulb blackouts:** every 8–12 s the bare bulb cuts out for 0.4–0.8 s (the head lamp becomes the main light; the ambient floor of §3 still holds). A dart hitting the bulb or a spider landing on its cord makes it swing (damped), light and shadows swinging with it.
- **Dripping tap:** a drop every 1.2 s from the tub tap (particle + plink sound).
- `rules`: `quota: 16`, `webGoal: 0.85`, `types: ['string', 'crawler', 'jumper']`, `spawnPattern: ['jumper', 'string', 'crawler', 'jumper', 'string', 'crawler', 'string', 'jumper']`, `maxAlive: [3, 4]`, `spawnInterval: [2.2, 1.2]`.
- Makeover beats (timing): shared beats, then `mirror` at 3.3 s (2.0 s long), `tap` at 4.0 s (dripping stops), `bulb` at 4.3 s (steadies; a frosted glass shade appears around it).
- `storyObject`: "In the mirror, written in old steam: 'Thomas was here.'"
- QA states: `dirty`, `action`, `makeover` (t ≈ 3.9 s, mirror half clear), `clean`, `results`, plus `drain`: a Jumper's leg poking out of the tub drain, a puddle reflecting the bulb, hero sliding on a puddle.
- Webs (≥ 6, positions are logic): bulb cord to ceiling, tub corner under the window, behind the cistern, mirror's upper corner, the frosted window, from the shower rail to the ceiling.

### A1 [ART] — Painting, light, props

| Item | Spec |
|---|---|
| Tiles | Cream subway tiles with **crazed glaze** (fine cracks) and grey grout in wobbly lines; a few cracked or missing when dirty; a moulded tile border at y 380 |
| Plaster above | Faded mint (mix `moss` + `linen`), water stains and mould blooms near the ceiling when dirty |
| Floor | Hexagonal black-and-white mosaic in the reference floor perspective, muted (`soot`/`bone` mixed toward `taupe`), cracked near the drain |
| Tub | White enamel with a body gradient, rim highlight, claw feet in tarnished brass; dirty: a rust stain under the tap and a grey tide line |
| Curtain | Translucent fabric with soft folds; dirty: mould spots and a tear, a spider silhouette visible **through** it when a crawler is behind it |
| Mirror (story) | Dirty: fully fogged (soft grey-white veil, condensation droplets) with the finger-traced letters faintly visible. Makeover `mirror` beat: the fog clears from the centre outward over 2 s, revealing the reflection (a dim, reversed hint of the room) and the letters **"THOMAS WAS HERE"** in a child's hand with a small smiley, still traced on the glass |
| Bare bulb | Harsh warm-white point + glow; a hard small light pool; it swings and blacks out per L2 |
| Frosted window | Soft diffuse cold glow (`moon`), no view, pre-painted frosting texture |
| Puddles | Dark, glossy; each reflects the bulb as a soft vertical streak (gradient, no blur) that moves when the bulb swings |
| Dirty → clean (≥ 4) | Mouldy curtain → clean striped curtain; rust stain → white enamel; cracked tiles → whole; towel on the floor → folded on the shelf; puddles → dry floor |
| Trace of the previous cleaner | An empty spray bottle labelled "SPIDER-AWAY" (fictional), label half peeled, on the sink; clean: standing upright, empty |
| Narrow feel | Side walls darker and in steeper perspective, vignette slightly tighter than other rooms |

## QA (ART-DIRECTION §15)

URL `game/index.html?qa=1&room=downstairs-bathroom`. [LOGIC]: play the room through on the blockout and check slides, blackouts, drains, makeover timing, results. [ART]: at least 3 critique rounds against `reference/screens/` and `review/current/family-room/`, 5 biggest gaps per round in NOTES (typical: tiles as a flat grid, enamel as a flat white blob, fog as a grey rectangle, puddles as black ellipses).

## Deliverable — then STOP

1. `saveHero(page, 'downstairs-bathroom', …)`: `dirty`, `action`, `drain`, `makeover`, `clean`, `results`.
2. `makeSheet('08-downstairs-bathroom', …)`: dirty, drain, action, makeover, clean, results.
3. `writeSummary('08-downstairs-bathroom', …)`: what was built, decisions, runtime requests, checks (no console errors; perf mean/p95 in `action` and `makeover`), audit, and which parts were [LOGIC] and [ART] and who did them.
4. `node review.mjs gallery`. Then stop.
