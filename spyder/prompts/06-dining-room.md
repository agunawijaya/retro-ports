# Prompt 06 — Room 5: the Dining Room

You are adding Room 5 to the Spyder web game in `E:\Projects\retro-ports\spyder\game\`. Follow this literally; where something is unclear, choose the option closest to the reference scene and write the decision in `game/rooms/dining-room/NOTES.md`.

**Precondition:** prompt 04 (review folder) is done: `game/tools/review.mjs` exists. If not, stop and report. May run **in parallel with prompt 05** (Family Room).

## Read first

1. `ART-DIRECTION.md` — binding. §3 palette, §4 painterly technique, §5 composition minimums and HUD safe zones, §6 lighting, §7 spiders, §9 webs, §10 makeover, §15 QA loop **and "Where images go"**, §16 checklist, §17 room bible (row 5).
2. `DESIGN.md` §5, §6, §8.
3. `game/NOTES.md`, the room interface in `game/lib/room-runtime.js` (`rules`, `makeover.uniqueBeat`, `storyObject`, `css: true`, `spawnEgg(…, { hatchAt, count, speed })`, staging `placeHero`/`setScore`), and `game/lib/spiders.js` (the redesigned egg sacs).
4. `game/rooms/kitchen/room.js` (also for how the Jumper is spawned) and `game/rooms/front-porch/room.js` — your templates.
5. `review/current/` and `reference/screens/` — the quality bar.

## Hard rules

- Create files only under `game/rooms/dining-room/`. Shared edit: **one `<script>` line** in `game/index.html`. Re-read it right before editing and insert only your line (prompt 05 may be editing it too).
- Use the room id the house map already uses for this room (check `lib/house-map.js`).
- Do not modify `game/lib/`, `reference/`, or other rooms. Runtime needs go into your NOTES as requests, with a workaround inside your room.
- `S.paint` for every surface; palette only; saturation only from light; no per-frame blur; static art cached in `dirty` and `clean` layers.
- **Jump reach:** the hero jumps about 200 px. Every platform must be reachable with ≤ 190 px rise and ≤ 160 px horizontal gap.
- **Images:** only through `review.mjs` (hero frames, sheet) or into `.scratch/`. Run `node review.mjs audit` before you stop; it must print nothing. Empty `.scratch/dining-room*` at the end.
- Humanized code, seeded randomness. No git commits.

## The room

The formal dining room, laid for a dinner that never happened: six places set, candles never lit, a long table under a dusty cloth.

### Layout (stage units, 1920 × 1080)

| Element | Position | Notes |
|---|---|---|
| Ceiling | y 0–100 | Plaster with a ceiling rose above the chandelier; spiders drop from y = 100 |
| Upper wall | y 100–520 | Deep green damask wallpaper (muted: mix `moss` and `umber`), low contrast |
| Plate rail | x 620–1360, at y 575 | A narrow wooden shelf along the wall with 7 decorative plates standing on it (painted patterns, low contrast) |
| Lower wall | y 590–770 | Painted wainscot panels (cream-taupe) |
| Tall window with heavy drapes | x 140–400, y 160–540 | Above the sideboard; moonlight; drapes torn when dirty |
| Sideboard | x 110–430, top y 745 | Carved wood, drawers, a silver tea set and a broken feather duster on top |
| Long table | x 560–1420, top y 760 | Dusty grey cloth hanging to y 880, six places set (plates, glasses, cutlery), centrepiece of dead flowers, **five candlesticks** along the centre line at x 640, 810, 980, 1150, 1320 |
| Chairs | two at each long side shown as backs in front of/behind the table, one at each end | Dirty: two knocked over |
| Chandelier | over the table at x 980, hanging to y 300 | Brass and glass drops, one bulb flickering when dirty |
| China cabinet | x 1560–1800, y 320–850 | Glass doors (one cracked when dirty), shelves of china inside; keep its top below the work-order card (y > 300) |
| Floor | y 770–1080 | Herringbone parquet in the reference perspective |
| Foreground | bottom corners | Out-of-focus: a chair back (left), a serving trolley (right) |

### Platforms

| Platform | Surface | Notes |
|---|---|---|
| Floor | y 935 | |
| Sideboard | x 120–420, y 745 | |
| Long table | x 570–1420, y 760 | The main stage of the room |
| Plate rail | x 640–1340, y 575 | Narrow (hero stands between the plates; plates wobble when he lands near them). Reached from the table (185 up) |
| China cabinet ledge | x 1570–1790, y 600 | A ledge across the cabinet's middle cornice; 160 up and 150 across from the table's right end |

### Lights (≥ 3 + head lamp)

| Light | Spec |
|---|---|
| Window moonlight | Tall cool shaft across the sideboard and the left end of the table, with motes |
| **Chandelier** | Dirty: one bulb flickering weakly (warm), the rest dark; its glass drops catch light and glint. Clean: all bulbs warm |
| China cabinet light | Off when dirty; warm interior light after the makeover, glass glinting |
| **Candles** | Off when dirty; each lights in the unique beat (warm `ember`/`amber` flame with a small glow and flicker) |

### Webs (≥ 6)

Between the chandelier arms and the ceiling rose (a big one), across the window's upper corner, between two candlesticks on the table, **under the table** (between the legs, where the egg nest is), on the china cabinet's corner, from the plate rail to the ceiling.

### Dirty → clean (≥ 4, plus story and trace)

1. Grey dusty tablecloth with stains → crisp white linen
2. Dead centrepiece → fresh flowers (muted roses and greenery)
3. Two chairs knocked over → upright, tucked in
4. Cracked, dark china cabinet → whole glass, lit, china visible
5. Torn drapes → whole, tied back
6. Dust on plates and glasses → clean, glasses glinting
- **Story object: the place cards.** Six handwritten place cards. Dirty: fallen flat, dust-covered, unreadable. Clean: standing up; five carry first names, one carries **"A."** — and that chair is the only one never pulled out. Results card: "Place cards for six. One says 'A.' — her chair was never pulled out."
- **Trace of the previous cleaner:** a feather duster snapped in two on the sideboard. Clean: the two halves laid side by side.

### Unique makeover beat

At t = 3.3 s the **candles light one by one** from left to right, 0.25 s apart, each with a small flare and a soft chime rising in pitch; the chandelier comes on fully as the last candle lights; the china cabinet light comes on; then the place cards **stand up** one after another (a small paper flip).

## Gameplay: the egg nest

The room introduces pressure from **eggs**. Under the table, inside the web between the legs, there is a **nest of four egg sacs** placed at the start (use the redesigned egg sacs; wall/web mode). They hatch on staggered timers (14, 22, 30, 38 s after the room starts; each hatches 3 hatchlings) unless popped. The hero must crouch-shoot them from the floor or drop off the table to reach them. A small handwritten note from "A." pinned to the sideboard on first visit only: "Under the table. Don't let them hatch." (diegetic, same style as the porch tutorial notes, tears off after 6 s or when the first egg is popped).

`rules`: `quota: 20`, `webGoal: 0.85`, `types: ['string', 'crawler', 'jumper']`, `spawnPattern: ['string', 'crawler', 'jumper', 'string', 'crawler', 'jumper', 'string', 'string']`, `maxAlive: [3, 4]`, `spawnInterval: [2.3, 1.2]`. Jumpers live on the table, sideboard and plate rail. Wall-crawler lairs: behind the china cabinet, under the sideboard, behind the drapes, a crack above the plate rail. Popping a nest egg counts toward the eggs stat and gives a bonus "Nest!" (+120).

## QA (Gemini's own loop — ART-DIRECTION §15)

QA URL `game/index.html?qa=1&room=dining-room` with `setup('dirty'|'action'|'makeover'|'clean'|'results')` plus `setup('nest')`: the four nest eggs under the table at different hatch stages (one about to hatch), the hero crouched on the floor aiming under the table, a Jumper on the table. Run at least 3 critique rounds against `reference/screens/` and `review/current/`, writing the 5 biggest gaps per round in the room's NOTES. Typical gaps: tablecloth reading as a flat grey slab, plates and glasses as flat discs, chandelier as a stick figure, damask too busy, the nest unreadable in the dark under the table.

Then play the room once start to finish.

## Deliverable — then STOP

1. Hero frames via `saveHero(page, 'dining-room', state)`: `dirty`, `action`, `nest`, `makeover`, `clean`, `results`.
2. `makeSheet('06-dining-room', …)` with six cells: dirty, nest, action, makeover (t ≈ 3.9 s, candles lighting), clean, results.
3. `writeSummary('06-dining-room', …)`: 8–12 lines — what was built, decisions, runtime requests, check results (no console errors, perf mean/p95 during action and makeover), `audit` result.
4. `node review.mjs gallery`.

Then stop. Do not start another room.

## Acceptance (ART-DIRECTION §16 plus)

- [ ] All checks of §16
- [ ] Reads instantly as a formal dining room: long laid table, chandelier, candles, china cabinet, sideboard
- [ ] The egg nest under the table is readable and creates pressure
- [ ] Every platform reachable within the jump limits; plate rail plates react to landings
- [ ] Unique beat: candles light left to right, chandelier and cabinet on, place cards stand up
- [ ] Results card names the story object (the "A." place card)
- [ ] Images only in `review/` and `.scratch/`; audit clean
