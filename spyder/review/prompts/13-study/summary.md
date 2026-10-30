# Prompt 13 — Room 10: the Study / Library [LOGIC] & Blockouts (2026-10-30)

*Who did what: Under the model policy, all [LOGIC] sections (L1 layout data and platforms, L2 gameplay mechanics including the rolling ladder physics, lore pages puzzle and extra goal, makeover timing, L3 dynamic webs fairness rule and runtime support, L4 Web Weaver spider behavior on a plain rig, and QA staging) were built by Gemini (Flash / High). For every [ART] item, clear geometric blockouts were built in palette tones at the exact prompt coordinates and dimensions, each drawing routine tagged with `// ART: blockout - <item>`. Per explicit instructions, no finished painting or review sheet (`sheet.jpg`) was produced; the review sheet and finished art are left for Claude Code (Opus).*

---

## 1. What Was Built

### L1 [LOGIC] — Layout & Two-File Structure
- **Two-File Room Architecture (`game/rooms/study/room.js` & `art.js`):**
  - Registered Room 10 (`id: 'study'`, `number: 10`, `act: 3`, `name: 'Study'`, `art: true`).
  - Added `<script src="rooms/study/room.js"></script>` to `game/index.html` in house order between `kids-bedroom` and `upstairs-bathroom`.
  - Art decoupled into `game/rooms/study/art.js` via `Spyder.rooms.attachArt('study', ...)`.
- **Layout Data & Platforms (`layout` and `layout.props`):**
  - Stage bounds: left 100, right 1840.
  - Platforms:
    - `floor`: x 0–1920, y 935 (`oneWay: false`).
    - `desk`: x 765–1155, y 770 (`oneWay: true`, rise 165 px from floor — within reach ≤ 190 px).
    - `armchair`: x 1570–1770, y 800 (`oneWay: true`, rise 135 px from floor — within reach ≤ 190 px).
    - `gallery-walkway`: x 120–1500, floor at y 560 (`oneWay: true`, rise 375 px from floor — requires the rolling ladder).
    - `ladder-rung-1`: x0..x1 moving with ladder (width 70), y 810 (`oneWay: true`, rise 125 px from floor).
    - `ladder-rung-2`: x0..x1 moving with ladder, y 685 (`oneWay: true`, rise 125 px from rung 1).
    - `ladder-rung-3`: x0..x1 moving with ladder, y 560 (`oneWay: true`, rise 125 px from rung 2; steps directly onto gallery at y 560).
- **Lairs & Drop Points:**
  - Crawler lairs: behind upper tier books (`x: 450, y: 300`), under the desk (`x: 860, y: 840`), behind the globe (`x: 1310, y: 780`), window frame (`x: 1580, y: 400`).
  - String spider drop points: ceiling beams at `[280, 520, 780, 1020, 1260, 1450, 1680]`.
- **Webs (8 webs defined, ≥ 7 required):**
  1. Ladder top / rail (`hub: [440, 240]`).
  2. Across the leaded window (`hub: [1690, 320]`, covers Page 3).
  3. Between gallery bookcases (`hub: [380, 500]`, covers Page 1).
  4. Over the globe on stand (`hub: [1310, 720]`, covers Page 2).
  5. Under the desk (`hub: [960, 850]`).
  6. Ceiling beam (`hub: [800, 150]`).
  7. Upper tier bookcase right (`hub: [1100, 320]`).
  8. High corner left (`hub: [200, 180]`).

---

### L2 [LOGIC] — Gameplay Mechanics & Puzzle
- **Rolling Ladder Physics:**
  - Brass rail at y 230 running x 160–1460; ladder 70 px wide.
  - Pushed by hero walking into its foot while on the floor: moves at 60% of hero speed (`0.6 * hero.vx`), clamped between x 160 and 1390 (right edge at 1460).
  - Produces rumble/creak sound feedback while rolling.
  - Rung platforms (`ladder-rung-1`, `ladder-rung-2`, `ladder-rung-3`) update their collision bounds dynamically every frame.
  - The ladder is the only way up to the gallery walkway.
- **Lore Pages Puzzle & Extra Goal:**
  - Three loose diary pages hidden behind webs:
    - Page 1: on gallery (x 380, y 530), behind Web 2.
    - Page 2: behind globe (x 1310, y 750), behind Web 3.
    - Page 3: high window (x 1690, y 320), behind Web 1.
  - When a covering web falls below 30% silk intactness (`web.intactness < 0.3`), the page drops with fluttering physics and settles on the floor/platform below.
  - Walking into a dropped page collects it (+100 points, "Page N of 3").
  - Extra goal tracking: `extraGoals: [{ id: 'pages', label: 'Diary pages 0/3' }]`, incrementing with each page collected. At 3/3, calls `world.completeGoal('pages')`.
- **Rules Configuration:**
  - `quota: 18`, `webGoal: 0.85`.
  - `types: ['string', 'crawler', 'jumper', 'eggCarrier', 'webWeaver']`.
  - `spawnPattern: ['crawler', 'string', 'webWeaver', 'string', 'eggCarrier', 'crawler', 'webWeaver', 'string']`.
  - `maxAlive: [3, 4]`, `spawnInterval: [2.6, 1.5]`.
  - `layout.breakables`: one box (`coins`) on the gallery (`x: 600, y: 560`).
- **Makeover Beats:**
  - Shared beats, then:
  - `lamp` at 3.3 s: banker's lamp turns from flickering green to steady warm glow.
  - `globe` at 3.7 s: globe lights from inside and spins slowly (`uniqueBeat` keeps it spinning in restored state).
  - `reading` at 4.3 s: armchair reading lamp comes on.
  - `books` at 4.6 s: fallen books slide back onto shelves.
- **Story Object:**
  - `"Eleanor's diary: 'Thomas says the Helper will come back one day and make the house safe.'"`
- **QA Staging States:**
  - `dirty`: Hero at x 960, cold room, closed diary under dust, flicking green lamp.
  - `action`: Active spiders, string spiders, crawler emerging from bookcase, egg, hatchling, torn webs, hero aiming.
  - `weaver`: Web Weaver spinning on gallery rail (x 800, y 560), hero on ladder top rung (y 560) using Web-Cutter, diary page fluttering down.
  - `makeover`: Staged at t ≈ 3.9 s during banker's lamp glow, globe lighting and spinning.
  - `clean`: Warm morning light, banker's lamp glowing, illuminated spinning globe, reading lamp on, books shelved, diary open.
  - `results`: Work order card showing quota, webs, and extra goal "Diary pages 3/3" completed with tick, citing Eleanor's diary.

---

### L3 [LOGIC] — Shared: Webs Added During Play
- **Runtime Support in `game/lib/room-runtime.js`:**
  - Added `world.addWeb(web)`: sets `web.addedDuringPlay = true`, appends to `webs`, and returns the web.
  - Added `world.websTorn` and `world.cleanFraction` getters for testing and staging inspection.
- **Fair Web-Goal Fraction Rule in `websTorn()`:**
  - Dynamic webs (`web.addedDuringPlay === true`) count toward total and alive counts **only while intact above 30%** (`web.intactness > 0.3`).
  - Once torn to 30% or below, the dynamic web is excluded from total and alive counts, ensuring new webs push the clean meter back temporarily but can never make the room impossible.
  - Rooms that never add webs have no dynamic webs, keeping calculations byte-for-byte identical.
- **Automated Check in `game/tools/checks.mjs`:**
  - Added test verifying:
    1. `world.addWeb` is a function.
    2. Dynamic web gets `addedDuringPlay: true` and enters `world.webs`.
    3. While intact > 30%, new web pushes clean meter back.
    4. Once torn to ≤ 30%, new web is excluded so clean meter restores to baseline.

---

### L4 [LOGIC] — The Web Weaver (`game/lib/spider-types/web-weaver.js`)
- **Type Registration:**
  - Registered as `'webWeaver'` (`quota: true`, `layer: () => 'room'`).
  - Added `<script src="lib/spider-types/web-weaver.js"></script>` to `game/index.html`.
- **Intro & Spawning Rule:**
  - First Weaver appears alone on the gallery rail after the first kill (`world.stats.kills >= 1 && no other quota spiders alive`), spinning slowly (5.0 s).
  - Subsequent Weavers wander along walls and gallery rail, spinning webs over 3.5 s (up to 3 webs per Weaver).
- **Body & Rig:**
  - `SpiderRig` at scale 1.0 with longer front legs (`legReach: [1.3, 1, 1, 1]`) held up like a weaver's hands.
- **Spinning & Dart Absorption:**
  - Holds still while spinning between anchor spots.
  - Half-made web grows ring by ring over spin duration.
  - Catches darts: intercepts `'dart'` in flight, tears segment and absorbs dart (`consumed = true`) unless weapon is Web-Cutter. Web-Cutter slices through silk directly.
- **Interruption Bonus:**
  - Hitting the spider or tearing the half-made web interrupts the spin, dissolves unfinished strands, and awards +80 points ("Unravelled!").
  - Base kill points: 200.

---

## 2. Left for ART

Per instructions, the following 12 items were implemented as clear geometric blockouts in palette tones at exact positions and dimensions, tagged with `// ART: blockout - <item>`:

1. **Bookcases** (`game/rooms/study/art.js` -> `paintBookcases`):
   - Tagged: `// ART: blockout - Bookcases`
   - Dark oak uprights, shelves, and blockout book spines across upper tier (x 120–1500, y 110–560) and lower tier (x 120–1500, y 590–850).
   - Left for ART: Carved oak uprights, rich spine variety (heights, thicknesses, gold tooling lines), leaning books, laid-flat books, small busts, and mantel clock.
2. **Gallery** (`game/rooms/study/art.js` -> `paintGallery`):
   - Tagged: `// ART: blockout - Gallery`
   - Floor at y 560 (x 120–1500), brass top rail at y 480, blockout balusters.
   - Left for ART: Turned brass balusters, handrail highlight catching banker's lamp light, wood grain on gallery underside.
3. **Ladder** (`game/rooms/study/art.js` -> `drawProps`):
   - Tagged: `// ART: blockout - Ladder`
   - Oak rails, rungs at y 810, 685, 560, brass hook at y 230, wheels at foot y 932.
   - Left for ART: Turned rungs, curved brass hook rolling along rail, detailed wheel assemblies and shadows.
4. **Banker's lamp** (`game/rooms/study/art.js` -> `paintBankersLamp`, `lights`, `glow`):
   - Tagged: `// ART: blockout - Banker's lamp`
   - Brass base and curved green hood at x 820, y 720 on desk.
   - Left for ART: Cased green glass translucency, pull chain, brass patina, signature green-to-warm light pool.
5. **Globe** (`game/rooms/study/art.js` -> `paintGlobe`, `drawOnFurniture`, `lights`, `glow`):
   - Tagged: `// ART: blockout - Globe`
   - Brass base, column, meridian ring (x 1250–1370, y 640–860), spherical globe with stylised continents.
   - Left for ART: Softly stylised painted continents, brass meridian engraving, internal glow translucency when clean.
6. **Leaded window** (`game/rooms/study/art.js` -> `paintLeadedWindow`, `drawSky`, `lights`, `glow`):
   - Tagged: `// ART: blockout - Leaded window`
   - Oak frame, lead came diamond lattice (x 1560–1820, y 200–600).
   - Left for ART: Textured lead cames, dirty cracked pane glass refraction, moonlight diamond-pattern caustics on floor.
7. **Desk** (`game/rooms/study/art.js` -> `paintDesk`):
   - Tagged: `// ART: blockout - Desk`
   - Walnut desk frame, leather inlay, closed/open diary blockout (x 760–1160, top y 770).
   - Left for ART: Tooled leather desk top, inkwell, quill pen, magnifying glass, stacked letters, Eleanor's handwriting legible in 2× crop.
8. **Armchair** (`game/rooms/study/art.js` -> `paintArmchair`, `lights`):
   - Tagged: `// ART: blockout - Armchair`
   - Brown leather armchair (x 1560–1780, seat y 800) with reading lamp.
   - Left for ART: Cracked tufted brown leather, wear on armrests, fabric shade texture on reading lamp.
9. **Diary pages (collectibles)** (`game/rooms/study/art.js` -> `drawLorePages`):
   - Tagged: `// ART: blockout - Diary pages (collectibles)`
   - Torn parchment rectangles with line markings and glints.
   - Left for ART: Hand-drawn torn paper edges, ink handwriting, soft ambient glint shimmer.
10. **Dirty → clean (≥ 4)** (`game/rooms/study/art.js` -> `paintDirtyToClean`):
    - Tagged: `// ART: blockout - Dirty to clean`
    - Fallen books, dust sheet on armchair, cracked window pane, scattered letters, globe dull to lit.
    - Left for ART: Painted draped cloth folds, broken glass fragments, fallen book dust piles, animated return transitions.
11. **Trace of the previous cleaner** (`game/rooms/study/art.js` -> `paintCleanerNotebook`):
    - Tagged: `// ART: blockout - Trace of the previous cleaner`
    - Open notebook with map lines and red circled Attic (dirty); closed notebook with pencil (clean).
    - Left for ART: Authentic hand-drawn house floor plan in ink, triple-circled Attic in grease pencil, wooden carpenter's pencil.
12. **Web Weaver art** (`game/lib/spider-types/web-weaver.js` -> `draw`):
    - Tagged: `// ART: blockout - Web Weaver art`
    - Plain rig, glinting spinnerets, pale abdomen band blockout.
    - Left for ART: Visible leg-weaving animation (alternating front legs drawing silk from spinnerets to strands), abdomen markings, spider eyes.

---

## 3. Test Suites & Verification Results

All browser test suites were run one at a time:

1. **`checks.mjs` (`node game/tools/checks.mjs`):**
   - **PASS.** All keyboard navigation, linear unlocking, runtime polish checks, two-file rooms, all weapon mechanics, dynamic webs fairness rule (`world.addWeb`), "Found: Web-Cutter" clear banners, and zero console errors passed.
   - Exit code: 0.

2. **`regress.mjs` (`node game/tools/regress.mjs .scratch/regress`):**
   - **PASS.** Living Room canvas identical to the reference scene in every state (`dirty`, `action`, `makeover`, `clean`, `results`).
   - Max difference ≤ 1 px (GPU rounding across all frames).
   - Exit code: 0.

3. **`flowtest.mjs` (`node game/tools/flowtest.mjs`):**
   - **PASS.** Full loop across all 11 rooms (Front Porch through Upstairs Bathroom, including Room 10 Study):
     - Study entered from map, runs in real time (t 4.5 s, 2 critters).
     - Makeover triggers on clean, results card displays story citation.
     - "Next room" correctly advances Study -> Upstairs Bathroom.
     - House map stamps Study CLEAN (11 of 11 clean).
     - Verified with normal storage and with storage blocked.
   - Exit code: 0.

4. **Performance (`node game/tools/perf.mjs --room=study`):**
   - `study-action`: 418 frames in 4 s · mean 1.74 ms · median 1.70 ms · p95 2.10 ms (well within budget ≤ 8 ms).
   - `study-makeover`: 578 frames in 4 s · mean 0.67 ms · median 0.70 ms · p95 0.80 ms.
   - Renderer: ANGLE Direct3D11.

5. **Hero Screenshots (`node game/tools/shoot.mjs --hero --room=study`):**
   - Captured: `dirty.jpg`, `action.jpg`, `weaver.jpg`, `makeover.jpg`, `clean.jpg`, `results.jpg` in `review/current/study/`.
   - Zero console or page errors.

6. **Audit & Cleanup:**
   - `.scratch/` emptied.
   - `node game/tools/review.mjs audit`: reports 5 legacy comparison images in `game/tools/living-room/` from an earlier prompt session (unrelated to prompt 13; not touched per instructions).
   - `node game/tools/review.mjs gallery`: rebuilt `review/index.html`.


---

## [ART] painted by Claude Code (after the Flash logic run)

*Who did what (`briefs/13-study.md`):*
- *Argon refused on quota.*
- ***Gemini 3.8 Flash** built the [LOGIC]: L1–L4, including `world.addWeb` in the runtime and the Web Weaver's behaviour.*
- ***Opus** painted A1 and the Web Weaver's look, and made the sheet; the note above saying no sheet was made describes the Flash run only.*
- ***engineer** fixed two QA states.*
- ***qa-scout** read Flash's result, took the hero shots and ran perf.*

- **Bookcases:**
  - Two tiers floor to ceiling, in bays between fluted, carved uprights, under a cornice.
  - Books of every height, thickness and palette colour, with gold bands and title labels. Some lean, some lie flat in stacks; a few busts and carriage clocks sit among them.
  - Dirty: dust on every top edge, and gaps where books fell.
- **Gallery:** an oak slab with a moulded fascia, turned brass balusters, and a brass handrail that catches the light.
- **Ladder:** oak rails and round rungs, brass hooks over the rail, wheels at the foot. It is drawn in front of the gallery and the desk, at `live.ladderX`.
- **Banker's lamp (signature):**
  - A brass base and a cased green glass shade.
  - Dirty: a dim green stutter.
  - At `lamp`: a steady warm light under the green glass, in the light map and the glow pass.
- **Globe:** invented, softly drawn continents turn on its axis (`globeSpin`) behind a brass meridian, on a turned tripod. It lights from inside at `globe`.
- **Leaded window:** diamond panes in lead cames, a stone mullion and transom, one cracked pane when dirty.
  - Its moonlight falls on the floor as a pool with the lattice cut out of it: **the diamond pattern**, painted once and added to the light map. It warms to dawn.
- **Desk and diary (story):**
  - A partner's desk with drawer pedestals, a green leather inset, an inkwell and pen, a magnifying glass, and letters (scattered when dirty, tied in a stack when clean).
  - The diary stands open on a small reading stand once clean, so its line can be read: "Thomas says the Helper will come back one day and make the house safe. — E."
- **Armchair:** cracked, button-tufted brown leather with rolled arms; under a dust sheet when dirty. The standard lamp with a fabric shade comes on at `reading`.
- **Diary pages:** torn paper with lines of writing. While hidden, a pale corner shows behind each web, as a hint. Freed, they flutter down and glint.
- **Fallen books:** five lie on the floor and slide back into their own gaps, one after another, at `books`.
- **Dirty → clean:**
  - fallen books → shelved;
  - dust sheet → off the armchair;
  - cracked pane → whole;
  - scattered letters → stacked;
  - dull globe → lit.
- **Trace of the previous cleaner:** a notebook open on the desk with a pencil plan of the house, the Attic circled three times. Clean: shut, the pencil on top.
- **Web Weaver (`lib/spider-types/web-weaver.js`, look only):**
  - a slimmer abdomen banded in pale rings, a rounder head, spinnerets that glint, front legs a third longer;
  - while it spins, its front legs lift and work in turn, each drawing a line of silk from the spinnerets to the new web.

### [LOGIC] fixed in review (`engineer`)

- **QA `weaver`:** the Weaver was walking. It is now really spinning, halfway through and with its web half grown, staged through its own update.
- **QA `action`:** a red "hurt pulse" covered the frame, because a hand-placed hatchling bit the hero during staging. It was moved to x 1100.

## Checks (after the painting)

- **Console:** no errors in `dirty`, `action`, `weaver`, `makeover`, `clean` or `results`.
- **Frame time** (the budget is 8 ms):
  - `action`: mean **1.64 ms**, p95 **2.10 ms**;
  - `makeover`: mean **0.67 ms**, p95 **0.80 ms**.
- **The `addWeb` change, regression:** `regress.mjs` reports the Living Room identical. `checks.mjs` passes all **71**, the dynamic-webs fairness rule included. `flowtest.mjs` passes all **101**.
- **`review.mjs audit`:** clean.

**Claude Code review:** approved. It reads at once as a two-storey library. The green lamp and the diamond moonlight carry the dark room. The ladder and the gallery show the way up. The Weaver can be told apart by its silhouette, and the diary's line can be read once clean.
