# Prompt 14 — Room 11: the Upstairs Bathroom

You are adding Room 11 to the Spyder web game in `E:\Projects\retro-ports\spyder\game\`. Where something is unclear, choose the option closest to the reference scene and write the decision in `game/rooms/upstairs-bathroom/NOTES.md`.

**Precondition:** prompt 12 (weapons) is done. May run **in parallel with prompt 13**. Sections are tagged **[LOGIC]** or **[ART]** (`prompts/CLAUDE-CODE.md`, "Model policy"); if you were told to do only [LOGIC], build no art: the runtime's blockout covers it.

## Read first

1. `ART-DIRECTION.md` — §3–§6, §9, §10, §15 incl. "Where images go", §16, §17 row 11.
2. `DESIGN.md` §5 ("mirrors, tight corners").
3. `game/NOTES.md` (room interface, two-file form, weapons from prompt 12), `game/lib/room-runtime.js`.
4. Templates: `game/rooms/downstairs-bathroom/` (it must feel like a sibling, not a copy), `game/rooms/master-bedroom/`. Quality bar: `review/current/`, `reference/screens/`.

## Hard rules

- Files: `game/rooms/upstairs-bathroom/room.js` ([LOGIC]), `art.js` ([ART]), optional `room.css`. Shared edit: one `<script>` line in `game/index.html` (re-read before editing; prompt 13 may edit it too). **Do not modify `game/lib/`** (prompt 13 is changing it).
- Use the room id the house map uses (`lib/house-map.js`). Do not modify other rooms or `reference/`.
- **Jump reach:** rise ≤ 190 px, gap ≤ 160 px.
- `S.paint` for every surface, palette only, no per-frame blur, static art cached. Images only through `review.mjs` or `.scratch/`; `audit` clean; `.scratch/` emptied. No git commits.

## The room

The family bathroom under the roof: a slanted ceiling with a shuttered skylight, a long vanity with a **wall-wide mirror**, a bath with a shower, a laundry basket, a linen cupboard. The downstairs bathroom was narrow and cold; this one is wider, warmer in tone (pink and cream 1960s tiles) and full of reflections.

### L1 [LOGIC] — Layout data (also `layout.props`)

| Element | Position (stage units) | kind |
|---|---|---|
| Slanted ceiling | from (120, 300) up to (900, 110), flat to x 1920; spiders drop from the flat part and the slope | wall |
| Shuttered skylight | in the slope, x 380–620 | window |
| Wall | pink-and-cream tiles to y 600, painted above | wall |
| Bath with shower | x 160–620, rim y 780; shower rail and curtain; low under the slope | furniture |
| Vanity with two basins | x 760–1380, top y 760 | furniture |
| **Wall-wide mirror** | x 760–1380, y 330–700, ringed with vanity bulbs | furniture |
| Toothbrush cup (story) | on the vanity, x 1060 | story |
| Linen cupboard | x 1460–1680, y 330–850, top shelf open at y 620 | furniture |
| Laundry basket (a lair) | x 1720–1840, top y 840 | furniture |
| Laundry chute hatch | in the wall, x 1720–1820, y 560–640 | furniture |
| Floor | y 770–1080, small square tiles in the reference perspective, a bath mat | wall |

**Platforms:** floor y 935; bath rim x 170–610, y 780; vanity x 770–1370, y 760; linen cupboard open shelf x 1470–1670, y 620 (140 up and 100 across from the vanity's right end); a step stool x 1400–1460, top y 840; laundry basket lid x 1725–1835, y 840.

### L2 [LOGIC] — Gameplay: the mirror

- **The mirror shows the room behind the hero, reversed.** It shows spiders that are **behind or above** the hero before they come into the main view: a crawler emerging from the skylight, a string spider descending behind the hero. Render the reflection as a second, cheap pass of the spider and hero draw calls, mirrored about the mirror's plane and darkened, clipped to the glass (no repaint of the room each frame: the reflected room is a cached layer per state).
- **Steam:** while the hot tap runs (dirty: it was left dripping hot), the mirror fogs from the bottom up over 20 s, hiding the reflections. A dart or a Foam blob hitting the hot tap turns it off (a squeak); the mirror clears in 4 s. The tap turns itself back on 25 s later (pipes knock). The room is playable without the mirror; it is an advantage, not a requirement.
- **The laundry basket** is a lair: its lid lifts and hatchlings spill out. The **laundry chute hatch** rattles now and then — a sound and a shake, nothing comes out (a hint at the Basement, for later).
- `rules`: `quota: 18`, `webGoal: 0.85`, `types: ['string', 'crawler', 'jumper', 'eggCarrier']`, `spawnPattern: ['string', 'crawler', 'string', 'eggCarrier', 'jumper', 'crawler', 'string', 'eggCarrier']`, `maxAlive: [3, 4]`, `spawnInterval: [2.3, 1.3]`. Crawler lairs: the skylight frame, behind the linen cupboard, behind the bath panel, the chute hatch's edge.
- `layout.breakables`: one box (`sonic`) on the cupboard shelf.
- Makeover beats (timing): shared beats, then `skylight` at 3.3 s (the shutters fold open one by one and morning light falls in a slanted shaft across the bath), `bulbs` at 3.9 s (the mirror's vanity bulbs come on, left to right), `cup` at 4.5 s (the toothbrush cup stands up with its four brushes).
- `storyObject`: "Four toothbrushes in a cup. One has a strip of tape on it: 'A.'"
- QA states: `dirty`, `action`, `makeover` (t ≈ 3.9 s), `clean`, `results`, plus `mirror`: the hero at the vanity facing right, a string spider descending **behind** him visible only in the mirror, a crawler on the skylight frame in the reflection, steam halfway up the glass.
- Webs (≥ 6): across the skylight, the shower rail, the mirror's top corner, between the cupboard and the slope, under the vanity, the laundry chute hatch.

### A1 [ART] — Painting, light, props

| Item | Spec |
|---|---|
| Tiles | 1960s pink and cream square tiles in a checker band, a black pencil-tile border at y 600, glaze highlight per tile; dirty: grime in the grout, two tiles cracked |
| Slanted ceiling | Painted boards following the slope, a rafter line; damp stain around the skylight when dirty |
| Skylight | Wooden shutters (dirty: closed, a thin line of moonlight through the slats); clean: open, morning shaft with motes slanting across the bath |
| Mirror | A long mirror with a bevelled edge; the cached reflected room (darker, slightly cooler, reversed); steam as a soft white veil rising from the bottom with droplets and runs; vanity bulbs around it |
| Bath and shower | Pink enamel bath panelled in; a chrome shower head; a curtain with a 60s flower print (dirty: mildew, half off its hooks) |
| Vanity | Two basins, chrome taps (the hot tap dripping and steaming when dirty), perfume, a shaving brush, a razor, a soap dish |
| Toothbrush cup (story) | Dirty: fallen, brushes scattered and dusty. Clean: upright, four brushes; three in colours, one older with a strip of tape reading "A." |
| Linen cupboard | Slatted doors, folded towels inside; the step stool in front |
| Laundry basket | Wicker, the lid on a hinge; the chute hatch above it with a brass pull |
| Dirty → clean (≥ 4) | Mildewed curtain → clean flowered curtain; scattered brushes → cup upright; cracked tiles → whole; shutters closed → open; towels on the floor → folded in the cupboard |
| Trace of the previous cleaner | A respirator mask hung on the tap, its strap broken. Clean: on the vanity, strap mended |

## QA (ART-DIRECTION §15)

URL `game/index.html?qa=1&room=upstairs-bathroom`. [LOGIC]: play through on the blockout: the reflection shows spiders behind the hero, steam fogging and clearing, hot-tap toggle, basket spills, makeover timing. [ART]: at least 3 critique rounds against `reference/screens/`, `review/current/downstairs-bathroom/` (it must feel different) and `review/current/`, 5 biggest gaps per round in NOTES (typical: the reflection reading as a second room glued on, steam as a white rectangle, tiles as a flat checkerboard, the slope empty).

## Deliverable — then STOP

1. `saveHero(page, 'upstairs-bathroom', …)`: `dirty`, `action`, `mirror`, `makeover`, `clean`, `results`.
2. `makeSheet('14-upstairs-bathroom', …)`: dirty, mirror, action, makeover, clean, results.
3. `writeSummary('14-upstairs-bathroom', …)`: what was built, decisions, runtime requests, checks (no console errors; perf mean/p95 in `action` and `mirror`), audit, and who did [LOGIC] and [ART].
4. `node review.mjs gallery`. Then stop.
