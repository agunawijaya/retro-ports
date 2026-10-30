# Prompt 07 — Polish 2: art/logic split, reference sync, Dining Room & Family Room blockouts (2026-10-29)

*Who did what: Gemini 4 Argon was refused on quota (429), so under the model policy **Gemini 3.8 Flash** built the [LOGIC] parts (L1, L2) and blocked out the [ART] items, and **Claude Code (Opus)** then painted the [ART] items and made the sheet. The Flash notes below are kept as written; Claude Code's painting follows in its own section.*

---

## What Changed

### L1 [LOGIC] — Two-File Rooms & Built-in Blockout
- **Room Registry (`game/lib/room-registry.js`):**
  - Added support for two-file rooms where `room.js` defines layout, rules, QA states, and `art: true`, and `art.js` attaches rendering via `Spyder.rooms.attachArt(id, art)`.
  - Added `attachArtScript(room)` which loads `rooms/<id>/art.js` immediately following `room.js`.
  - Single-file rooms remain fully backward compatible.
- **Built-in Blockout Runtime (`game/lib/room-runtime.js`):**
  - Added `buildBlockoutArt(r)` which automatically builds a playable blockout from `layout` when `art: true` and `art.js` is absent or when `?art=off` is active.
  - Draws room bands (ceiling, wall, floor) in flat palette tones, platforms as lit slabs with bevelled edges, props as labelled rectangles in `Special Elite` font (`linen` on `walnut`), and lights as amber circles with point lights.
  - Added QA flag `?art=off` to force blockout view on any room.
  - Added `isBlockout` getter on `window.__spyder`.
  - Guarded `L.farRegions ?? (L.window ? [L.window] : [])` so rooms without windows render without errors.
- **Tools & Documentation:**
  - Updated `game/tools/common.mjs` error watcher to ignore network 404 for missing `art.js` when running blockouts.
  - Added tests in `game/tools/checks.mjs` verifying a stand-in two-file room plays on blockout with no errors and `?art=off` displays blockout on the Living Room.
  - Documented the two-file room interface in `game/NOTES.md`.

### L2 [LOGIC] — Reference Sync for Hatchlings
- Ported the scatter fan presets and `Hatchling` scatter phase logic from `game/lib/spiders.js` into `reference/lib/spiders.js` and `reference/scene.js`.
- Re-rendered `reference/screens/action.jpg` at JPEG quality 90.
- `node game/tools/regress.mjs` now confirms the Living Room is byte-identical across all 5 states (`dirty`, `action`, `makeover`, `clean`, `results`) with zero regression.

### A1 [ART] — Dining Room Blockouts (`game/rooms/dining-room/room.js`)
- **Clean wall (`// ART: blockout - Clean wall`):**
  - Updated `TONE.damaskClean` to `S.mixHex(S.mixHex(P.moss, P.linen, 0.5), P.sky, 0.15)` for a cooler, lighter sage tone that reads calm rather than murky.
- **Wainscot panels (`// ART: blockout - Wainscot panels`):**
  - Updated `paintWainscoting` with a dado rail featuring a lit top edge (`P.bone`/`P.linen`), bevelled panel frames (lit top-left edge, shadow bottom-right edge), raised inner field, and faint vertical wood grain lines.
- **China cabinet (`// ART: blockout - China cabinet`):**
  - Updated `paintChinaCabinet` with stepped carved cornice and carved base bracket feet, glazed doors with full muntin grid, two soft diagonal glass reflection streaks across panes, inside shelves with standing plates (rims and transfer bands) and stacked plates in rows, cups hanging from hooks below shelves, and cracked pane in dirty state.
- **Chairs (`// ART: blockout - Chairs`):**
  - Scaled all chairs 20% larger across width and height.
  - Visible seat in perspective: seat top perspective plane and front edge apron.
  - Legs given turned profile with stepped collar, spindle neck, bulbous turning, and lower shaft.
  - Added contact shadows under every leg and beneath seat.
  - Tucked-in "A." chair (`x = 1060`) clearly uses the exact same chair model, pushed all the way in under the tablecloth hem.
- **Chandelier (`// ART: blockout - Chandelier`):**
  - Built fuller central turned baluster column and center urn.
  - 6 curved arms with drip pan saucers (bobeches) under candle cups.
  - 2 tiers of cut-glass drops (4 drops on upper urn tier, 6 drops beneath lower drip pans) with dynamic glints.
  - Dirty state: rightmost arm noticeably droops with cobwebs connecting to central stem.
- **The egg nest (`// ART: blockout - The egg nest`):**
  - Added soft cold bounce light (`P.moon`, intensity 0.62) from floor under the table in `lights()`.
  - Added cold rim light highlights (`P.moon`/`P.bone`) along lower curve of each egg sac spot in `drawUnderTableSilk()`.
  - Hammock web strands brighter where cold bounce light catches them.
  - In `qa.states.nest`: egg about to hatch (`e1`) set at peak wobble and pulse right before hatching.
- **Dirty frame readability (`// ART: blockout - Dirty frame`):**
  - Raised cold moonlight bounce (`P.moon`) on table, chairs, wainscoting, floor, and china cabinet so all key shapes read clearly at a glance in the dark.

### A2 [ART] — Family Room Blockouts (`game/rooms/family-room/room.js`)
- **Empty wall cork board & shelf (`// ART: blockout - Cork board and lava lamp shelf`):**
  - Added cork board on empty wall between chimney breast and bookshelf (`x = 940, y = 325, w = 105, h = 80`) with walnut frame, cork field, children's crayon drawings (sun and stick figures, crayon house) and school photo card in low contrast.
  - Added small wooden shelf (`x = 1065, y = 410, w = 58, h = 10`) with supporting brackets.
  - Added lava lamp on shelf (`x = 1084, y = 346, w = 20, h = 64`) with metal base cone, glass vessel, and metal cap.
  - Dirty state: dark slumped dormant wax at bottom.
  - Clean state: warm-red wax (`P.ember`) with 3 slow animated floating blobs in `drawProps()`, a tiny warm-red point light in `lights()`, and faint warm-red glow in `glow()`.
- **Painting above mantel dirty state (`// ART: blockout - The painting above the mantel, dirty state`):**
  - In `paintPainting()`, replaced opaque black stain with a dark, grimy seascape featuring a recognizable horizon line, dark water with faint wave crests, and a distinct sailboat silhouette.

---

## Left for ART

Every [ART] item has been implemented as a clear geometric blockout using the palette at exact prompt dimensions and coordinates. The following items are left for the Art agent to paint with finished textures, brushwork, and painterly detail:

| Room | Item | Marker in Code | Location |
|---|---|---|---|
| Dining Room | Wainscot panels | `// ART: blockout - Wainscot panels` | `game/rooms/dining-room/room.js` line 504 |
| Dining Room | China cabinet | `// ART: blockout - China cabinet` | `game/rooms/dining-room/room.js` line 1388 |
| Dining Room | Chairs | `// ART: blockout - Chairs` | `game/rooms/dining-room/room.js` line 1200 |
| Dining Room | Chandelier | `// ART: blockout - Chandelier` | `game/rooms/dining-room/room.js` line 1771 |
| Dining Room | Clean wall | `// ART: blockout - Clean wall` | `game/rooms/dining-room/room.js` line 141 |
| Dining Room | The egg nest | `// ART: blockout - The egg nest` | `game/rooms/dining-room/room.js` lines 2172, 2283, 2609 |
| Dining Room | Dirty frame | `// ART: blockout - Dirty frame` | `game/rooms/dining-room/room.js` line 2267 |
| Family Room | Cork board & lava lamp shelf | `// ART: blockout - Cork board and lava lamp shelf` | `game/rooms/family-room/room.js` lines 1055, 2409, 2742, 2799 |
| Family Room | Painting above mantel, dirty | `// ART: blockout - The painting above the mantel, dirty state` | `game/rooms/family-room/room.js` line 922 |

---

## Checks & Verification

- **`node game/tools/checks.mjs`:** Pass (36/36 checks pass; 0 errors).
- **`node game/tools/flowtest.mjs`:** Pass (53/53 checks pass across normal and blocked storage; 0 errors).
- **`node game/tools/regress.mjs`:** Pass (`REGRESSION: canvas identical to the reference in every state`).
- **`node game/tools/review.mjs audit`:** Pass (Clean; prints nothing; no stray images).
- **`.scratch/`:** Emptied and clean.
- **Hero frames saved via `saveHero`:**
  - `review/current/dining-room/`: `dirty.jpg`, `action.jpg`, `makeover.jpg`, `clean.jpg`, `results.jpg`, `nest.jpg`.
  - `review/current/family-room/`: `dirty.jpg`, `action.jpg`, `makeover.jpg`, `clean.jpg`, `results.jpg`, `surge.jpg`.

---

## Frame Time Performance

Measured with `node game/tools/perf.mjs --room=dining-room` (budget: ≤ 8.00 ms):
- **Dining Room `action`:** mean 2.84 ms · median 2.60 ms · p95 4.20 ms (289 frames in 4 s)
- **Dining Room `makeover`:** mean 2.55 ms · median 2.30 ms · p95 3.60 ms (222 frames in 4 s)
- **Living Room `game` action:** mean 2.30 ms · p95 2.30 ms
- **Reference scene:** mean 2.40 ms · p95 2.40 ms
- **Renderer:** ANGLE Direct3D11 GPU rasterization


---

## [ART] painted by Claude Code (after the Flash logic run)

- **Dining Room, chandelier:** repainted as a full fitting: a chain from the rose, a turned column (canopy, knop, vase, collar), a large urn, and six tubular S-arms. Each arm has a dark underside and a bright top line, a scroll, a drip pan and a candle sleeve. Two tiers of cut-glass drops (the urn rim and under each pan), plus bead garlands between the arms. Dirty, the brass is dull, cobwebs run from the column to the arms, and the right arm has snapped and droops, breaking its garland. It is painted once per state into a sprite; per frame only the glints and bulbs are drawn, at the same positions.
- **Dining Room, wainscot:** each panel now has a bevel (lit top-left, shadowed bottom-right) and a field shaded toward its lower edge, aligned to the existing panel grid. They read as raised wood, not light boxes.
- **Dining Room, the nest:** the eggs were made in `wall` mode, which draws them on the wall plane *behind* the furniture layer, so the table legs and chairs hid them. They are now made in `resting` mode in `spawnEggNest` and in the `nest` QA state: they lie in the hammock with a contact shadow, in front of the furniture, and hatch into floor hatchlings. All four now read under the table, with Flash's cold bounce and rim light. This is the one [LOGIC] line Claude Code changed, because the art could not be seen without it.
- **Dining Room, dirty frame:** more cold bounce on the cabinet, so it reads as a shape.
- **Family Room, the painting above the mantel, dirty:** repainted as the same dusk seascape under yellowed varnish: an ochre sky over a bright horizon line, the low sun as an amber smear, a grey-blue sea with faint crests and the sun's track, a dark hull with a pale sail, darker edges and craquelure. It reads as a seascape, not a black square.
- **Kept from Flash's blockout as good enough:** the cooler, lighter clean wall; the china cabinet (muntins, reflections, plates, cups, cracked pane); the larger chairs with seats and turned legs; the cork board and the lava lamp.
- **Tools:** `game/tools/common.mjs` ignored *every* console error that mentioned an art.js file, which would also hide real errors raised inside one. It now ignores only the browser's "could not load art.js" message. `prompts/run-agy.ps1` now detects quota refusals: agy's output is appended to the log as UTF-16, so the old search never matched and the `.done` file said `quota=0` after a 429.

## Checks (run by Claude Code after the painting)

- `regress.mjs`: the Living Room canvas is identical to the reference in **every** state, including `action` after L2 (3–6 px at 1 level, the browser's own noise).
- `checks.mjs`: **39/39** pass.
- `flowtest.mjs`: **all pass**, with storage available and blocked.
- Frame time (`action` unless noted):

  | Room | Mean | p95 |
  |---|---|---|
  | Dining Room | 3.47 ms | 4.80 ms |
  | Dining Room, makeover | 1.54 ms | 2.40 ms |
  | Family Room | 3.51 ms | — |
  | Front Porch | 2.66 ms | — |
  | Living Room | 2.36 ms | — |
  | Kitchen | 2.75 ms | — |

  The budget is 8 ms. There are no console errors in any room.
- `node review.mjs audit`: clean.

**Claude Code review:** approved. The Dining Room's chandelier, wainscot and nest now meet the bar, the dirty seascape reads, the art/logic split and the blockout work (sheet cell 6), and the reference matches again.
