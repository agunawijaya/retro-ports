# Prompt 14 — Room 11: the Upstairs Bathroom [LOGIC] & Blockouts (2026-10-30)

*Who did what: Under the model policy, all [LOGIC] sections (layout data, platforms, mirror reflection optics & dynamic pass, steam progression & hot tap toggle, laundry chute rattling, laundry basket hatchling spills, makeover sequence, story object, and QA staging hooks) were built by Gemini 3.8 Flash (High). For every [ART] item, clear geometric blockouts were built in the palette at exact prompt positions and dimensions, marked with `// ART: blockout - <item>`. Per explicit instructions, no finished painting or review sheet was produced; the review sheet and finished art are left for the Art agent.*

---

## 1. What Was Built

### L1 [LOGIC] — Layout & Two-File Architecture
- **Two-File Architecture (`game/rooms/upstairs-bathroom/room.js` & `art.js`):**
  - Registered Room 11 (`id: 'upstairs-bathroom'`, `number: 11`, `act: 3`, `name: "Upstairs Bathroom"`, `art: true`).
  - Added single `<script src="rooms/upstairs-bathroom/room.js"></script>` line to `game/index.html`.
  - Attached art via `Spyder.rooms.attachArt('upstairs-bathroom', ...)` in `game/rooms/upstairs-bathroom/art.js`.
- **Layout Constants & Stage Bounds:**
  - `CEILING`: 110.
  - Slanted ceiling slope: from `(120, 300)` up to `(900, 110)`, flat to x `1920`.
  - `FLOOR_LINE`: 770.
  - `GROUND`: 935.
  - Bounds: left `120`, right `1840`.
  - Window (Skylight): `{ x: 380, y: 170, w: 240, h: 160 }` (aperture in the ceiling slope).
  - Wall area: `{ x0: 120, x1: 1840, y0: 110, y1: 760 }`.
  - Props list (`layout.props`) fully populating all room objects with coordinates and kinds (`wall`, `furniture`, `window`, `story`).
- **Platforms & Jump Reach Compliance:**
  - `floor`: x 0–1920, y 935 (`oneWay: false`).
  - `bath-rim`: x 170–610, y 780 (`oneWay: true`, rise 155 px from floor, ≤ 190 px).
  - `vanity`: x 770–1370, y 760 (`oneWay: true`, rise 175 px from floor, ≤ 190 px; gap 160 px from bath rim, ≤ 160 px).
  - `cupboard-shelf`: x 1470–1670, y 620 (`oneWay: true`, rise 140 px and gap 100 px from vanity right end at x 1370, y 760, ≤ 190 px, ≤ 160 px).
  - `step-stool`: x 1400–1460, y 840 (`oneWay: true`, rise 95 px from floor, gap 30 px from vanity).
  - `laundry-basket`: x 1725–1835, y 840 (`oneWay: true`, rise 95 px from floor).
  - All platforms strictly within reach budget: rise ≤ 190 px, gap ≤ 160 px.
- **Webs (6 webs, ≥ 6 required):**
  1. Across the skylight (`hub: [500, 200]`).
  2. Across the shower rail (`hub: [350, 360]`).
  3. Mirror's top corner (`hub: [790, 360]`).
  4. Between the cupboard and the slope (`hub: [1560, 220]`).
  5. Under the vanity (`hub: [1070, 840]`).
  6. The laundry chute hatch (`hub: [1770, 600]`).
- **Breakables:**
  - Declared `layout.breakables: [{ x: 1570, y: 620, contains: 'sonic' }]` on the open cupboard shelf.

---

### L2 [LOGIC] — Gameplay & Mechanics
- **The Wall-Wide Mirror & Reflection Dynamics:**
  - The mirror extends from x 760 to 1380 (y 330 to 700), with mirror glass area x 770 to 1370 (y 340 to 690).
  - Pre-cached reflected room background per state (`live.reflectedRoom.dirty` and `clean`), darkened, cooler, and reversed.
  - Second cheap dynamic reflection pass in `drawOnFurniture`: draws spiders and hero mirrored across the vertical axis, scaled to fit the wide room view into the mirror glass (`scale(-0.45, 0.45)` relative to mirror glass center).
  - Reflects spiders behind or above the hero (crawler on the skylight frame reflected at x ≈ 1295, y ≈ 398; string spider descending behind hero reflected at x ≈ 1124, y ≈ 470).
  - Mirrored spiders with `mirrorOnly = true` draw only in the mirror pass.
- **Steam & Hot Tap Mechanics:**
  - Hot tap located on the left basin of the vanity at (880, 730).
  - In dirty room: hot tap drips and steams; mirror fogs from the bottom up over 20 s (`live.steam` rises 0 → 1 at `dt / 20.0`).
  - Dart or Foam blob hitting within 30 px of hot tap turns it off with a squeak sound (`audio.tone`); mirror clears in 4 s (`dt / 4.0`).
  - Tap turns itself back on 25 s later (`live.tapCooldown`) with a pipe knock sound (`audio.tone`).
  - During makeover / clean state: tap is turned off permanently and steam clears.
- **The Laundry Basket Lair:**
  - Basket located at x 1720–1840, top y 840.
  - Wicker lid lifts (`live.basketLid`) and 2–3 hatchlings spill out onto the floor via `world.hatch()`.
- **The Laundry Chute Hatch:**
  - Wall hatch located at x 1720–1820, y 560–640.
  - Rattles intermittently every 14–22 s (`live.chuteShake`) with a metallic bandpass rattle sound; nothing emerges (hint at the Basement).
- **Rules:**
  - `quota: 18`, `webGoal: 0.85`, `types: ['string', 'crawler', 'jumper', 'eggCarrier']`.
  - `spawnPattern: ['string', 'crawler', 'string', 'eggCarrier', 'jumper', 'crawler', 'string', 'eggCarrier']`.
  - `maxAlive: [3, 4]`, `spawnInterval: [2.3, 1.3]`.
  - Crawler lairs: skylight frame (`x: 500, y: 220`), behind linen cupboard (`x: 1570, y: 350`), behind bath panel (`x: 390, y: 800`), chute hatch's edge (`x: 1770, y: 600`).
  - Drop points: along slope (x 260, 480, 700) and flat ceiling (x 960, 1180, 1400, 1620, 1800).
- **Makeover Beats:**
  - Shared runtime makeover beats, then:
  - `skylight` at 3.3 s: shutters fold open one by one, morning light falls in a slanted shaft across the bath.
  - `bulbs` at 3.9 s: mirror's vanity bulbs light up left to right.
  - `cup` at 4.5 s: fallen toothbrush cup stands upright with its four brushes.
- **Story Object:**
  - `"Four toothbrushes in a cup. One has a strip of tape on it: 'A.'"`
- **QA Staging States:**
  - `dirty`: Hero at x 1000, unlit room, running hot tap with steam, fallen cup, closed shutters.
  - `action`: Active string spiders, crawler from skylight frame lair, eggs, hatchling, torn webs, hero aiming at x 960, y 450.
  - `mirror`: Custom QA state with hero at vanity facing right, string spider descending behind him visible only in the mirror, crawler on skylight frame in the reflection, steam halfway up the glass (steam = 0.5).
  - `makeover`: Staged at t ≈ 3.9 s (vanity bulbs lighting).
  - `clean`: Morning sunbeam across the bath, open shutters, lit vanity bulbs, upright toothbrush cup, clean curtain.
  - `results`: Cleared room score card citing the story object.

---

## 2. Left for ART

Every [ART] item has been built as a clear geometric blockout in the palette at exact prompt positions and dimensions in `game/rooms/upstairs-bathroom/art.js`. Each function is explicitly marked with `// ART: blockout - <item>`:

| # | Item | Marker in Code | Spec & What is Left for Finished ART |
|---|---|---|---|
| 1 | **Tiles** | `// ART: blockout - Tiles` | 1960s pink and cream square tiles in a checker band up to y 600, a black pencil-tile border at y 600, glaze highlight per tile; dirty: grime in the grout, two tiles cracked. Clean: whole and glossy. |
| 2 | **Slanted ceiling** | `// ART: blockout - Slanted ceiling` | Slanted boards from (120, 300) to (900, 110), flat to 1920, with rafter lines; dirty: damp stain around skylight. Clean: fresh painted boards. |
| 3 | **Skylight** | `// ART: blockout - Skylight` | In the slope, x 380–620. Wooden shutters (dirty: closed, thin line of moonlight through slats); clean: open, morning light shaft with motes slanting across the bath. |
| 4 | **Mirror** | `// ART: blockout - Mirror` | Long mirror (x 760–1380, y 330–700) with bevelled edge; cached reflected room (darker, slightly cooler, reversed); steam as a soft white veil rising from bottom with droplets and condensation runs; vanity bulbs around it. |
| 5 | **Bath and shower** | `// ART: blockout - Bath and shower` | x 160–620, rim y 780. Pink enamel bath panelled in, chrome shower head, shower rail and curtain with 60s flower print (dirty: mildew, half off its hooks; clean: hanging neatly). |
| 6 | **Vanity** | `// ART: blockout - Vanity` | x 760–1380, top y 760. Two basins, chrome taps (hot tap dripping and steaming when dirty), perfume, shaving brush, razor, soap dish. |
| 7 | **Toothbrush cup (story)** | `// ART: blockout - Toothbrush cup (story)` | On vanity at x 1060. Dirty: fallen, brushes scattered and dusty. Clean: upright, four brushes (three in colours, one older with a strip of tape reading "A."). |
| 8 | **Linen cupboard** | `// ART: blockout - Linen cupboard` | x 1460–1680, y 330–850, top shelf open at y 620. Slatted doors, folded towels inside; step stool (x 1400–1460, top y 840) in front. |
| 9 | **Laundry basket** | `// ART: blockout - Laundry basket` | x 1720–1840, top y 840. Wicker basket with hinged lid tilting open during spills. |
| 10 | **Laundry chute hatch** | `// ART: blockout - Laundry chute hatch` | In wall at x 1720–1820, y 560–640 with brass pull handle; rattling shake animation when active. |
| 11 | **Dirty → clean (≥ 4)** | `// ART: blockout - Dirty to clean` | Mildewed curtain → clean flowered curtain; scattered brushes → cup upright; cracked tiles → whole; shutters closed → open; towels on floor → folded in cupboard. |
| 12 | **Trace of the previous cleaner** | `// ART: blockout - Trace of the previous cleaner` | Dirty: respirator mask hung on hot tap with broken strap dangling. Clean: on the vanity counter with strap mended. |
| 13 | **Floor** | `// ART: blockout - Floor` | y 770–1080, small square tiles in perspective with pink bath mat in front of bath. |

---

## 3. Decisions & Runtime Requests

- **Jump Reach Compliance:**
  - Floor (935) -> Bath rim (780): rise 155 px (budget ≤ 190 px).
  - Floor (935) -> Vanity (760): rise 175 px (budget ≤ 190 px).
  - Bath rim (610) -> Vanity (770): gap 160 px (budget ≤ 160 px).
  - Vanity right end (1370, y 760) -> Cupboard open shelf (1470, y 620): gap 100 px, rise 140 px (budget ≤ 160 px gap, ≤ 190 px rise).
  - Floor (935) -> Step stool (840) / Laundry basket (840): rise 95 px.
  - All platforms strictly within reach constraints.
- **Slanted Ceiling String Spider Drop Coordinates:**
  - Implemented `syncStringSpiderAnchors()` to dynamically set `ceiling` based on `ceilingYAt(c.anchorX)` along the slope from (120, 300) to (900, 110), ensuring silk threads anchor accurately to the angled ceiling.
- **Mirror Reflection Performance:**
  - Pre-cached reflected room background canvas into `live.reflectedRoom` (dirty and clean) avoids per-frame environment redraws; only active spiders and the hero are drawn in the dynamic reflection pass, keeping frame times under 2.5 ms.
- **Runtime Requests:**
  - None. Everything operates cleanly through existing room registration and lifecycle hooks without modifications to `game/lib/`.

---

## 4. Verification & Checks

- **`node game/tools/checks.mjs`:**
  - All checks passed (100% clean).
  - Verified built rooms order: `front-porch, living-room, family-room, kitchen, dining-room, downstairs-bathroom, upstairs-hallway, master-bedroom, kids-bedroom, upstairs-bathroom`.
  - Linear room unlocking, flee mechanics, and Polish Fixes verified.
  - Zero console errors.
- **`node game/tools/flowtest.mjs`:**
  - Full end-to-end loop passed across all 10 rooms (Title -> Front Porch -> ... -> Upstairs Bathroom).
  - Real-time spider spawning, clearing, makeover sequence, story object display (`Four toothbrushes in a cup. One has a strip of tape on it: 'A.'`), CLEAN stamp placement on the house map, and save persistence verified with both normal and blocked storage.
  - Zero console errors.
- **Performance (`game/tools/perf.mjs`):**
  - `upstairs-bathroom-action`: **mean 2.31 ms**, median 2.20 ms, **p95 3.00 ms** (budget ≤ 8.0 ms).
  - `upstairs-bathroom-mirror`: **mean 1.91 ms**, median 1.80 ms, **p95 2.50 ms** (budget ≤ 8.0 ms).
  - `upstairs-bathroom-makeover`: **mean 0.82 ms**, median 0.80 ms, **p95 1.10 ms**.
- **Hero Frame Generation (`node game/tools/shoot.mjs --hero --room=upstairs-bathroom`):**
  - Saved to `review/current/upstairs-bathroom/`:
    - `dirty.jpg`
    - `action.jpg`
    - `mirror.jpg`
    - `makeover.jpg`
    - `clean.jpg`
    - `results.jpg`
  - Zero page errors.
- **Audit (`node game/tools/review.mjs audit`):**
  - Completely clean, zero stray images outside allowed folders.
  - `.scratch/` directory emptied.
- **Gallery Rebuilt:**
  - `node game/tools/review.mjs gallery` updated `review/index.html`.
- **Review Sheet:**
  - Not created, per explicit instruction ("Do not make the review sheet").


---

## [ART] painted by Claude Code (after the Flash logic run)

*Who did what (`briefs/14-upstairs-bathroom.md`):*
- *Argon refused on quota.*
- ***Gemini 3.8 Flash** built the [LOGIC], including the mirror pass and the steam, in parallel with prompt 12.*
- ***Opus** painted A1 and made the sheet; the note above saying no sheet was made describes the Flash run only.*
- ***engineer** fixed two QA states.*
- ***qa-scout** read Flash's result, took the hero shots and ran perf.*

- **Tiles:**
  - Warm 1960s salmon pink and cream squares to y 600.
  - A two-row checker band under a rounded black pencil border.
  - The shower surround over the bath is tiled right up to the slope.
  - Every tile has its own glaze: a lit edge, a shaded edge, a sheen.
  - Dirty: grime in the grout and two cracked tiles.
- **Slanted ceiling:** painted boards running along the slope, closer together as it falls away, with a rafter. Damp round the skylight when dirty.
- **Skylight:** a parallelogram lying in the slope, its sky drawn live.
  - Four louvred shutters. Dirty: shut, with thin lines of moonlight between the slats.
  - At `skylight` they fold up one by one, and a morning shaft slants across the bath.
- **Mirror:**
  - A bevelled frame and 15 chrome bulb sockets. The bulbs light left to right at `bulbs`.
  - The reflected room is **the painted room itself**, drawn through the same reversed, ×0.45 transform as the live pass of the hero and spiders, then softened, darkened and cooled; cached per state.
  - The steam rises from the bottom as a veil with a wavering edge of soft blobs, droplets and runs (`live.steam`).
- **Bath and shower:** a pink enamel bath panelled in, with a rolled rim, taps, a riser, a chrome head, and a rail under the slope.
  - The 60s flower-print curtain is drawn back to the bath's end. Dirty: mildew from the hem, and half off its hooks.
- **Vanity:** two sunk basins with chrome mixers, pink laminate doors, a perfume bottle, a shaving brush, a razor and a soap dish. The hot tap steams while it runs.
- **Toothbrush cup (story):** fallen on its side with the brushes scattered when dirty. At `cup` it stands up holding four brushes; the oldest has a strip of tape reading "A."
- **Linen cupboard:** open shelves of folded towels over slatted doors, and a step stool.
- **Laundry:** a wicker basket with a live hinged lid, and a chute hatch marked LAUNDRY with a brass pull that rattles (`chuteShake`).
- **Dirty → clean:**
  - mildewed curtain → clean;
  - fallen cup → upright;
  - cracked tiles → whole;
  - shutters shut → open;
  - towels on the floor → folded in the cupboard.
- **Trace of the previous cleaner:** a respirator hung on the hot tap with its strap broken; once clean, laid on the vanity, mended.
- **Sibling, not a copy:** the downstairs room is cold, narrow and seen in one-point perspective. This one is wide and warm, under a slope, and full of reflections.

### [LOGIC] fixed in review (`engineer`)

- **QA `mirror`:** the mirror spider's legs stretched to the top of the glass. Fixed at the source, in the `hover` branch of `lib/spider-types/string.js`.
- **QA `action`:** a red hurt pulse covered the frame (see below).

## Checks (after the painting)

- **Console:** no errors in `dirty`, `action`, `mirror`, `makeover`, `clean` or `results`.
- **Frame time** (the budget is 8 ms):
  - `action`: mean **2.24 ms**, p95 **2.90 ms**;
  - `mirror`: step + render mean **1.59 ms**, p95 **2.70 ms**;
  - `makeover`: mean **0.80 ms**, p95 **1.00 ms**.
- **QA `action` fix:** a hand-placed hatchling bit the hero during staging, which showed as a red hurt pulse over the frame. It was moved from x 1200 to 1500, and the hurt log is now empty.
- **`checks.mjs`, `flowtest.mjs` and `regress.mjs`:** all pass after this prompt's work, 71 / 101 / identical.
- **`review.mjs audit`:** clean.

**Claude Code review:** approved. It reads as a 1960s family bathroom under the roof, warmer and wider than the one downstairs. The mirror shows the room behind the hero reversed, and the steam veils it. The skylight's shaft and the bulbs make the makeover.
