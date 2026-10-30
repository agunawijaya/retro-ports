# Prompt 10 — Room 8: the Master Bedroom (introduces nests)

You are adding Room 8 to the Spyder web game in `E:\Projects\retro-ports\spyder\game\`. Where something is unclear, choose the option closest to the reference scene and write the decision in `game/rooms/master-bedroom/NOTES.md`.

May run **in parallel with prompt 11**. Sections are tagged **[LOGIC]** or **[ART]** (`prompts/CLAUDE-CODE.md`, "Model policy"); if you were told to do only [LOGIC], build no art: the runtime's blockout covers it.

## Read first

1. `ART-DIRECTION.md` — §3–§6, §9, §10, §15 incl. "Where images go", §16, §17 row 8.
2. `DESIGN.md` §5, §8.2 ("Destroy nest: large bonus").
3. `game/NOTES.md` ("The room interface", two-file form), `game/lib/room-runtime.js`.
4. Templates: `game/rooms/upstairs-hallway/` (two-file room, latest), `game/rooms/family-room/room.js` (striped window light). Quality bar: `review/current/`, `reference/screens/`.

## Hard rules

- Files: `game/rooms/master-bedroom/room.js` ([LOGIC]), `art.js` ([ART]), optional `room.css`. Shared edits: one `<script>` line in `game/index.html` (re-read before editing; prompt 11 may edit it too) and **L3 below in `room-runtime.js`/`hud.js` only** (prompt 11 does not touch lib).
- Use the room id the house map uses (`lib/house-map.js`). Do not modify other rooms or `reference/`.
- **Jump reach:** rise ≤ 190 px, gap ≤ 160 px — except from the bouncy bed (L2), which allows a rise ≤ 270 px.
- `S.paint` for every surface, palette only, no per-frame blur, static art cached.
- Images only through `review.mjs` or `.scratch/`; `audit` clean; `.scratch/` emptied. No git commits.

## The room

The parents' bedroom, untouched for fifteen years: a big bed with a quilted cover, a wardrobe in the corner, a dressing table with a three-fold mirror ringed with bulbs, lace curtains. Cozy-creepy; the wardrobe is where the spiders live.

### L1 [LOGIC] — Layout data (also `layout.props`)

| Element | Position (stage units) | kind |
|---|---|---|
| Ceiling, coving | y 0–110 | wall |
| Wall | y 110–770, wallpaper with a picture rail at y 170 | wall |
| Wardrobe (the nest) | x 120–380, y 260–850, two doors | furniture |
| Left nightstand | x 430–530, top y 790, with a lamp and the **radio** | furniture |
| Bed | headboard x 540–590 rising to y 520; mattress x 560–1180, top y 780; footboard at x 1170 | furniture |
| Window with lace curtains | x 760–1000, y 180–470 (above the bed) | window |
| Hat-box shelf | x 700–1050, y 520 | furniture |
| Right nightstand | x 1200–1290, top y 790, with a lamp | furniture |
| Dressing table (story) | x 1360–1600, top y 760; three-fold mirror y 420–700 with bulbs around it; the wedding photo on the table | story |
| Chest of drawers | x 1640–1820, top y 800 | furniture |
| Floor | y 770–1080, boards in the reference perspective, a rug by the bed | wall |

**Platforms:** floor y 935; left nightstand x 435–525, y 790; mattress x 570–1170, y 780 (**bouncy**, L2); hat-box shelf x 705–1045, y 520 (260 up from the mattress — only via a bounce); right nightstand x 1205–1285, y 790; dressing table x 1365–1595, y 760; chest x 1645–1815, y 800.

### L2 [LOGIC] — Gameplay

- **Bouncy bed:** landing on the mattress with downward speed > 300 px/s bounces the hero up at 1.35× the normal jump speed (springs creak; the quilt dents and recovers). Holding jump on landing gives the full bounce; otherwise a small one.
- **The wardrobe nest:** inside the wardrobe is a thick sheet of web with egg clusters (a **nest**, 8 hits to destroy). Every 10 s (8 s after the first kill) the wardrobe doors creak open for 2.5 s and 2–3 hatchlings tumble out; while the doors are open, darts that enter the doorway hit the nest. Each hit tears it visibly. When destroyed: +500 "Nest!", the doors swing open and stay still, and no more spawns come from it.
- **The room is not clean until the nest is destroyed** (see L3).
- `rules`: `quota: 18`, `webGoal: 0.85`, `types: ['string', 'crawler', 'jumper', 'eggCarrier']`, `spawnPattern: ['string', 'crawler', 'eggCarrier', 'string', 'jumper', 'crawler', 'string', 'eggCarrier']`, `maxAlive: [3, 4]`, `spawnInterval: [2.4, 1.3]`, `extraGoals: [{ id: 'nest', label: 'Wardrobe nest' }]`. Crawler lairs: behind the headboard, under the dressing table, behind the chest; string spiders drop from four ceiling points and the curtain rail.
- Makeover beats (timing): shared beats, then `lights` at 3.3 s (the dressing-table bulbs come on one by one, 0.12 s apart), `photo` at 3.9 s (the wedding photo stands up), `radio` at 4.3 s (the radio's static clears into a soft song).
- `storyObject`: "On the dressing table: Arthur and Eleanor's wedding photograph, 1968."
- QA states: `dirty`, `action`, `makeover` (t ≈ 3.9 s), `clean`, `results`, plus `nest`: the wardrobe doors open mid-burst, the nest half torn, two hatchlings tumbling out, the hero mid-bounce above the bed aiming at the wardrobe.
- Webs (≥ 6): across the wardrobe's top, curtain rail to ceiling, between the bedposts, the mirror's top corner, under the bed, the hat boxes.

### L3 [LOGIC] — Shared: extra goals on the work order

In `game/lib/room-runtime.js` (and `hud.js` / `index.html` for the card), add support for `rules.extraGoals: [{ id, label }]`:
- A room marks a goal done with `world.completeGoal(id)`.
- `roomIsClear()` also requires every extra goal to be done.
- The work-order card shows one more line per goal (label left, a hand-drawn tick or an empty box right, same style as the other lines).
- The clean meter counts each extra goal as one share alongside spiders and webs.
- Rooms without `extraGoals` behave exactly as before: `regress.mjs` must stay identical for the Living Room, and `checks.mjs` / `flowtest.mjs` must pass.

### L4 [LOGIC] — The radio song

The `radio` beat plays a short, soft, original tune (procedural Web Audio: a slow waltz melody on a warm triangle/sine voice over a two-chord pad, gently filtered like an old radio, about 16 bars, then it fades to a quiet loop). Dirty state: the radio hisses with static and the odd half-heard phrase now and then. No existing songs, melodies or recordings.

### A1 [ART] — Painting, light, props

| Item | Spec |
|---|---|
| Wallpaper | Muted rose-and-trellis pattern (low contrast) over a warm taupe; dirty: water stains and a long tear by the window |
| Lace curtains | The window's moonlight passes through lace: a **lace pattern of light** falls across the bed and wall (the room's signature look, like the blinds in the Family Room), drawn into the light map with soft-edged shapes, no blur |
| Bed | Carved headboard and footboard; a quilted cover with patchwork squares and soft folds; pillows; dirty: dust sheet half pulled off, a sunken grey dent; clean: made, plumped, a folded nightgown on the pillow |
| Wardrobe | Tall, dark wood, carved cornice, two doors with oval mirrors (dirty: cracked) and a brass key; the nest inside reads as a thick pale sheet with egg clusters, lit faintly from within |
| Dressing table | Kidney-shaped with a skirt, a three-fold mirror; the ring of round vanity bulbs (dark when dirty, lit in the `lights` beat); perfume bottles, a hairbrush, a jewellery box |
| Wedding photo (story) | Silver frame. Dirty: face down, glass cracked. Clean: standing, a black-and-white couple — he in a suit, she in a veil — "Arthur & Eleanor, 1968" written on the mount |
| Radio | A 1960s tabletop radio with a glowing dial (dirty: dial flickering); it gets a small warm light of its own in the clean state |
| Lamps | Two bedside lamps with pleated shades; dirty: the left one works dimly, the right one is dead |
| Hat boxes | Round striped boxes on the shelf, one fallen when dirty |
| Dirty → clean (≥ 4) | Dust sheet → made bed; cracked wardrobe mirrors → whole; fallen hat box → back on the shelf; torn wallpaper → whole; scattered clothes on the chest → folded; dead right lamp → lit |
| Trace of the previous cleaner | A sleeping bag rolled out at the foot of the bed with a wind-up alarm clock — they slept here. Clean: rolled up and tied, the clock on the chest |

## QA (ART-DIRECTION §15)

URL `game/index.html?qa=1&room=master-bedroom`. [LOGIC]: play through on the blockout: bounces, nest bursts, nest destruction, the extra goal on the card, makeover timing. [ART]: at least 3 critique rounds against `reference/screens/` and `review/current/`, 5 biggest gaps per round in NOTES (typical: quilt as a flat block, lace light as dots, wardrobe as a brown box, the nest unreadable).

## Deliverable — then STOP

1. `saveHero(page, 'master-bedroom', …)`: `dirty`, `action`, `nest`, `makeover`, `clean`, `results`.
2. `makeSheet('10-master-bedroom', …)`: dirty, nest, action, makeover, clean, results.
3. `writeSummary('10-master-bedroom', …)`: what was built, decisions, the extra-goals change and its regression result, runtime requests, checks (no console errors; perf mean/p95 in `action` and `makeover`), audit, and who did [LOGIC] and [ART].
4. `node review.mjs gallery`. Then stop.
