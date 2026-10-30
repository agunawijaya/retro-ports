# Prompt 08 — Room 6: the Downstairs Bathroom [LOGIC] & Blockouts (2026-10-29)

*Who did what: Under the model policy (Gemini 4 Argon quota unavailable), **Gemini 3.8 Flash** built all [LOGIC] sections (layout data, platforms, mechanics, spawns, makeover beats, and QA staging) and geometric blockouts for every [ART] item in the palette at exact positions and dimensions. Per instructions, no finished painting or review sheet was created; **Claude Code (Opus)** will paint the [ART] items and produce the review sheet.*

---

## What Was Built

### L1 [LOGIC] — Layout & Two-File Structure
- **Two-File Architecture (`game/rooms/downstairs-bathroom/room.js` & `art.js`):**
  - Registered Room 6 (`id: 'downstairs-bathroom'`, `number: 6`, `act: 2`, `name: 'Downstairs Bathroom'`, `art: true`).
  - Added single `<script src="rooms/downstairs-bathroom/room.js"></script>` line to `game/index.html`.
  - Art and rendering cleanly decoupled into `rooms/downstairs-bathroom/art.js` via `Spyder.rooms.attachArt('downstairs-bathroom', ...)`.
- **Layout & Platform Geometry (`layout` and `layout.props`):**
  - `CEILING: 110`, `PLASTER_END: 380`, `FLOOR_LINE: 770`, `GROUND: 935`.
  - Bounds: left 280, right 1640 (narrower bounds, steep side wall perspective).
  - Platforms:
    - `floor`: x 0–1920, y 935 (`oneWay: false`).
    - `tub`: x 310–750, y 760 (`oneWay: true`, 175 px rise from floor).
    - `sink`: x 1050–1230, y 765 (`oneWay: true`, 170 px rise from floor).
    - `shelf`: x 1360–1600, y 600 (`oneWay: true`, 165 px rise from sink, 130 px gap).
    - `toilet`: x 1410–1550, y 820 (`oneWay: true`, 115 px rise from floor).
  - All jump reaches verified (rise ≤ 190 px, horizontal gap ≤ 160 px).
  - Props list: 15 items covering side walls, back plaster, tiles, ceiling, floor, bare bulb, window, tub, curtain & rail, sink, mirror cabinet, mirror strip light, towel shelf, and high-cistern toilet.
- **Drop Points & Lairs:**
  - `dropPoints`: `[520, 740, 960, 1480]` (bulb cord ceiling rose at x 960 and three ceiling points).
  - `lairs`: Wall crawlers emerge from behind cistern (`x: 1480, y: 290`) and under shower curtain (`x: 720, y: 450`).
  - `jumperLairs`: Jumpers climb out of tub drain (`x: 420, y: 830 → 760`) and sink plughole (`x: 1140, y: 810 → 765`) with front legs lifting out over the rim.
- **Webs (6 logic positions):**
  1. Bulb cord to ceiling (`hub: [970, 70]`)
  2. Tub corner under the window (`hub: [350, 420]`)
  3. Behind the cistern (`hub: [1440, 290]`)
  4. Mirror's upper corner (`hub: [1060, 360]`)
  5. The frosted window (`hub: [580, 210]`)
  6. Shower rail to ceiling (`hub: [700, 150]`)

### L2 [LOGIC] — Gameplay
- **Slippery Puddles:**
  - Three puddles on the floor: x 520–640, 880–1010, 1300–1380.
  - Ground braking friction drops to 25% while inside puddles, causing sliding.
  - Generates small water splash particles at hero feet during movement.
  - Puddles dry up in clean state and after makeover sweep.
- **Bare Bulb Blackouts & Swinging:**
  - Damped pendulum swing physics (`w0 = 3.6`, damping 0.8–3.4).
  - Dart hit event listener adds angular impulse (`omega += 1.35`) and triggers ding sound.
  - Spider contact with the cord imparts swing impulse.
  - Cuts out every 8–12 s for 0.4–0.8 s (point light drops to 0; headlamp and ambient floor carry the scene).
  - Steadies in clean state and receives frosted glass shade.
- **Dripping Tap:**
  - Drips every 1.2 s from tub tap spout (x 360, y 720) into tub basin with splash particle and plink tone.
  - Stops cleanly at makeover `tap` beat (4.0 s).
- **Rules:**
  - `quota: 16`, `webGoal: 0.85`, `types: ['string', 'crawler', 'jumper']`.
  - `spawnPattern: ['jumper', 'string', 'crawler', 'jumper', 'string', 'crawler', 'string', 'jumper']`.
  - `maxAlive: [3, 4]`, `spawnInterval: [2.2, 1.2]`.
- **Makeover Timing & Beats:**
  - `mirror` at 3.3 s (duration 2.0 s, easing `inOut`): fog demists outward from centre.
  - `tap` at 4.0 s: tap dripping stops.
  - `bulb` at 4.3 s (chime 0.6): bulb steadies and frosted shade appears.
- **Story Object:**
  - `"In the mirror, written in old steam: 'Thomas was here.'"`
- **QA Staging Hooks:**
  - `dirty`: hero at x 880.
  - `action`: active spiders, crawlers, eggs, hatchlings, jumper crouched on tub rim.
  - `makeover`: staged at t ≈ 3.9 s with mirror half cleared.
  - `clean`: restored state with clear mirror and morning light.
  - `results`: score card naming story object.
  - `drain`: hero sliding across puddle at x 580 with splash, swinging bulb reflection, and Jumper leg poking out of tub drain.

---

## Left for ART

Every [ART] item has been built as a clear geometric blockout using the palette at exact prompt dimensions and coordinates. Each drawing function is marked in `game/rooms/downstairs-bathroom/art.js` with `// ART: blockout - <item>`:

| # | Item | Marker in Code | Spec & What Is Left for ART |
|---|---|---|---|
| 1 | **Tiles** | `// ART: blockout - Tiles` | Back wall x 260–1660, y 380–770. Cream subway tiles with crazed glaze (fine cracks) and grey wobbly grout; cracked / missing tiles when dirty; moulded tile border at y 380. |
| 2 | **Plaster above** | `// ART: blockout - Plaster above` | Back wall x 260–1660, y 110–380. Faded mint plaster (`moss` + `linen`), water stains and mould blooms near ceiling when dirty. |
| 3 | **Floor** | `// ART: blockout - Floor` | y 770–1080. Hexagonal black-and-white mosaic in perspective, muted (`soot`/`bone`/`taupe`), cracked near tub drain. |
| 4 | **Tub** | `// ART: blockout - Tub` | x 300–760, rim y 760, feet to y 900. White enamel body gradient, rim highlight, claw feet in tarnished brass; rust stain under tap and grey tide line when dirty. |
| 5 | **Curtain** | `// ART: blockout - Curtain` | Shower rail arc at y 200, curtain half drawn over tub's right third (x 600–760, y 200–760). Translucent fabric with soft folds; mould spots and tear when dirty; clean striped curtain when clean. |
| 6 | **Mirror (story)** | `// ART: blockout - Mirror (story)` | x 1040–1240, y 330–580. Wooden cabinet frame, glass reflection. Dirty: fogged veil with condensation and faint finger-traced letters. Makeover: clears outward over 2 s revealing dim room reflection + child's handwriting **"THOMAS WAS HERE"** with small smiley. |
| 7 | **Bare bulb** | `// ART: blockout - Bare bulb` | Cord from x 960, y 0; bulb at y 240. Harsh warm-white point + glow, hard light pool; swings and blacks out. Clean: frosted glass shade appears around it. |
| 8 | **Frosted window** | `// ART: blockout - Frosted window` | x 420–640, y 170–330. Wooden frame, soft diffuse cold glow (`moon`), no outside view, frosted glass texture. |
| 9 | **Puddles** | `// ART: blockout - Puddles` | Three puddles on floor: x 520–640, 880–1010, 1300–1380. Dark glossy shapes reflecting bulb as a soft vertical streak moving with the bulb. Dry when clean. |
| 10 | **Dirty → clean changes** | `// ART: blockout - Dirty to clean changes` | (≥ 4 required) 1) Mouldy curtain → clean striped curtain; 2) Rust stain → white enamel; 3) Cracked tiles → whole; 4) Towel on floor (x 1320) → folded on shelf (x 1360–1600, y 600); 5) Puddles → dry floor. |
| 11 | **Trace of previous cleaner** | `// ART: blockout - Trace of the previous cleaner` | Empty spray bottle labelled "SPIDER-AWAY" on sink (x 1065, y 718). Dirty: label half peeled; clean: standing upright, empty. |
| 12 | **Narrow feel** | `// ART: blockout - Narrow feel` | Left wall x 0–260, right wall x 1660–1920 in steep perspective, darker tile tones, tighter vignette. |

---

## Decisions & Runtime Requests

### Decisions
1. **Jumper Drain Emergence:** Configured tub drain and sink plughole lairs with `moves: 'climb'`, `time: 1.6`, and bounding clip matching the tub/sink inner contour so the body remains concealed while the front legs extend upward over the rim.
2. **Dynamic Puddle Reflection:** Puddle reflection streaks are updated live in `art.js` `drawProps()` based on `bulb.x`, dynamically trailing the bulb's pendulum swing.
3. **Blackout Lighting:** During blackouts, the bulb's point light drops to 0 while maintaining the base ambient floor, leaving the hero's headlamp as the primary light.

### Runtime Requests
1. **House Map Stamp Clearance (`game/lib/house-map.js`):** In `house-map.js`, `downstairs-bathroom` has dimensions `w: 250, h: 140`. Because the room name splits onto two lines ("Downstairs" / "Bathroom") and an untouched clear produces two lines ("cleared" / "untouched"), the 4-line label height (`blockH ≈ 104 px`) leaves insufficient vertical clearance for the `112 × 44` CLEAN stamp in the bottom-right corner. `placeStamp` or `labelSvg` should apply a compact offset or single-line best formatting for rooms with `h ≤ 140`.

---

## Checks & Verification

- **`node game/tools/checks.mjs`:** All checks pass (keyboard navigation, fleeing, linear unlocking up through downstairs-bathroom, Fix 5 & 6 polish checks, two-file stand-in room on blockout, `?art=off`).
- **`node game/tools/regress.mjs`:** Pass (`REGRESSION: canvas identical to the reference in every state`).
- **`node game/tools/shoot.mjs --hero --room=downstairs-bathroom`:** Staged and saved all 6 hero frames into `review/current/downstairs-bathroom/`:
  - `dirty.jpg`
  - `action.jpg`
  - `makeover.jpg`
  - `clean.jpg`
  - `results.jpg`
  - `drain.jpg`
- **Zero Console Errors:** Verified across all QA states.
- **`node game/tools/review.mjs audit`:** Clean (prints nothing).
- **`.scratch/` Directory:** Emptied and clean.
- **Gallery:** Rebuilt with `node game/tools/review.mjs gallery`.

---

## Frame Time Performance (`perf.mjs`)

Measured on ANGLE Direct3D11 (Intel UHD Graphics, 1920 × 1080):
- **`downstairs-bathroom-action`:** **1.92 ms** mean · **1.80 ms** median · **2.90 ms** p95 (budget: ≤ 8 ms).
- **`downstairs-bathroom-makeover`:** **0.67 ms** mean · **0.60 ms** median · **1.00 ms** p95.


---

## [ART] painted by Claude Code (after the Flash logic run)

*Who did what: Gemini 4 Argon was refused on quota (429), so **Gemini 3.8 Flash** built the [LOGIC] (room.js, everything above), and **Claude Code (Opus)** replaced Flash's flat blockout `art.js` with a painted one. Flash's markers and rough shapes are gone; the shared state it reads (`live.bulb`, `live.dripTimer`, `mk.mirror`, `mk.tap`, `mk.bulb`) is unchanged.*

- **Narrow feel:** the only room drawn with its side walls in view, in one-point perspective toward (960, 440). The side walls are tiled like the back wall, with joints widening toward the viewer, and they darken toward the screen edge. The front layer has a tighter vignette, the edge of the open door and a wicker basket, out of focus.
- **Tiles:** cream subway tiles, 64 × 32 in running bond.
  - Each tile has its own glaze: a tone wobble, a lit top-left edge, a shadowed bottom-right edge, a sheen, and fine crazing on most of them.
  - The grout is freehand.
  - Dirty: six cracked tiles, three fallen ones showing the mortar, and grime and splashes low on the wall.
- **Border and plaster:** a moulded border band at y 380. The plaster above is faded mint; dirty, it has water stains running down and mould blooms in the corners.
- **Floor:** a hexagonal mosaic laid out on the floor plane and projected with the same camera, a white field with a scattered dark pattern, muted. There is a brass floor drain; dirty, cracks run out from it and the grout is grimy.
- **Tub:** an enamel body with a gradient, a belly highlight and a rolled rim with a long highlight. The inside shows over the far rim. It stands on four ball-and-claw brass feet, has a pillar tap whose spout curls down to where the drop forms, and a contact shadow. Dirty: a grey tide line, rust running over the rim under the tap, and verdigris.
- **Curtain:** painted on its own canvas and laid down translucent, so a crawler behind it shows through. It has eight folds, each a shadow band beside a lit band, and rings on a tubular brass rail with ceiling stays. Dirty: grey, mould climbing from the hem, a yellowed water line, and a ragged tear cut right out of the fabric. Clean: soft blue-grey stripes.
- **Mirror (story):** three cached pieces:
  - the reflection, a dim, reversed room;
  - the fog, with droplets, runs and the finger-traced letters faintly wiped out of it;
  - the letters as greasy traces on the clear glass, "THOMAS / WAS HERE" in a child's uneven hand, with a smiley.

  Per frame the fog is cut back from the centre outward with a soft edge as the `mirror` beat runs (square-root radius, so it reads as clearing as soon as the beat starts). The strip light above stays dark until the mirror clears.
- **Bare bulb:** a bakelite holder and a pear of glass with a glowing filament, tilting with the swing. It is grey during a blackout, when the filament keeps a moment of ember afterglow. Its light is a strong point, a hard cone straight down and a small bright floor pool, all following the swing. The frosted shade fades in with the `bulb` beat and softens and widens the light.
- **Puddles:** dark glossy water with a bright meniscus. Each reflects the bulb as a soft vertical streak that follows the swing, and disappears during blackouts. The puddles dry as the sweep passes them.
- **The tap's drop** swells at the spout between drips (from `live.dripTimer`) and stops with the `tap` beat.
- **Frosted window:** opaque frosted glass with a stipple, glazing bars and a grimy lower edge, plus a soft short beam over the tub. It turns from moon to dawn.
- **Sink, toilet and shelf:**
  - A porcelain pedestal sink with two cross-head taps.
  - A cast-iron high cistern on brackets, with a flush pipe, a pull chain and a porcelain handle; the bowl has an oak seat and lid.
  - A shelf on brackets with three folded towels and a bar of soap when clean.
- **Dirty → clean:** mouldy torn curtain → striped; rust and tide line → white enamel; cracked and missing tiles → whole; towel heaped on the floor → folded on the shelf; puddles → dry; bare bulb → shaded.
- **Trace of the previous cleaner:** the "SPIDER-AWAY" spray bottle. Dirty, it lies tipped over on the sink rim with its label peeling; clean, it stands upright, still empty.
- **[LOGIC] fix found while painting:** the puddle-slide wrapper on `hero.update` was installed only once per page (`_origHeroUpdate` was never cleared on a restart), so after "Play again" the hero no longer slid in puddles. Every new hero is now wrapped (`hero._puddleWrapped`).

## Checks (Claude Code, after the painting)

- No console errors in `action`, `makeover`, `drain` or `clean`.
- Frame time: `action` mean **2.22 ms**, p95 **3.50 ms**; `makeover` mean **0.77 ms**, p95 **1.00 ms**. The budget is 8 ms.
- No per-frame blur: blur is used only in paint-once code (the window's and mirror's drop shadows, the front layer).

- **Shell fix (`lib/house-map.js`), from Flash's runtime request:**
  - The CLEAN stamp now shrinks (down to half size) to fit small rooms; its clearance is measured on the rotated stamp, including the handwriting's descenders.
  - Short rooms whose name takes two lines, and long narrow rooms like the hallway, show only the score on the plan. "Untouched" stays in the hint and the screen-reader label.
  - In narrow rooms the score runs after the name, so it no longer sits on the wall line.
  - `flowtest.mjs` (all seven rooms) and `checks.mjs` both pass; audit clean.

**Claude Code review:** approved. It reads instantly as a narrow, tiled, tense bathroom. The mirror reveal works: faint traces under the fog, "Thomas was here" on the clear glass. Every dirty → clean change is visible.
