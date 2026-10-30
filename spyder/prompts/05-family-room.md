# Prompt 05 — Room 3: the Family Room

You are adding Room 3 to the Spyder web game in `E:\Projects\retro-ports\spyder\game\`. Follow this literally; where something is unclear, choose the option closest to the reference scene and write the decision in `game/rooms/family-room/NOTES.md`.

**Precondition:** prompt 04 (review folder) is done: `game/tools/review.mjs` exists. If not, stop and report. May run **in parallel with prompt 06** (Dining Room).

## Read first

1. `ART-DIRECTION.md` — binding. §3 palette, §4 painterly technique, §5 composition minimums and HUD safe zones, §6 lighting, §9 webs, §10 makeover, §15 QA loop **and "Where images go"**, §16 checklist, §17 room bible (row 3).
2. `DESIGN.md` §5, §6, §8.
3. `game/NOTES.md`, the room interface in `game/lib/room-runtime.js` (`rules`, `makeover.uniqueBeat`, `storyObject`, `css: true`, `spawnEgg(…, { hatchAt, count, speed })`, staging `placeHero`/`setScore`).
4. `game/rooms/kitchen/room.js` and `game/rooms/front-porch/room.js` — your templates (the most recent, most complete rooms).
5. `review/current/` and `reference/screens/` — the quality bar.

## Hard rules

- Create files only under `game/rooms/family-room/`. Shared edit: **one `<script>` line** in `game/index.html`. Re-read it right before editing and insert only your line (prompt 06 may be editing it too).
- Use the room id the house map already uses for this room (check `lib/house-map.js`), so the map links to it.
- Do not modify `game/lib/`, `reference/`, or other rooms. Runtime needs go into your NOTES as requests, with a workaround inside your room.
- `S.paint` for every surface (no flat fills, no ruler-straight organic edges); palette only; saturation only from light; no per-frame blur; static art cached in `dirty` and `clean` layers.
- **Jump reach:** the hero jumps about 200 px. Every platform must be reachable from the floor or from another platform with ≤ 190 px rise and ≤ 160 px horizontal gap.
- **Images:** only through `review.mjs` (hero frames, sheet) or into `.scratch/`. Run `node review.mjs audit` before you stop; it must print nothing. Empty `.scratch/family-room*` at the end.
- Humanized code, seeded randomness. No git commits.

## The room

A 1980s family room, the room where the family watched television. Wood panelling, a brick fireplace, a console TV that still hisses with static. Darker and more intimate than the Living Room.

### Layout (stage units, 1920 × 1080)

| Element | Position | Notes |
|---|---|---|
| Ceiling | y 0–100 | Low, with an exposed wooden beam across it; spiders drop from y = 100 |
| Upper wall | y 100–470 | Muted 1980s wallpaper (thin vertical stripes, cream and faded rust, alpha 0.2–0.3) |
| Lower wall | y 470–770 | **Vertical wood panelling** (tongue-and-groove planks 48 px wide, grain strokes, a lit edge on each plank) |
| Window with venetian blinds | x 150–450, y 170–480 | The blinds' slats throw **striped moonlight** across the wall and floor (the signature look of this room). Dirty: blinds hang crooked, two slats broken, a gap |
| Fireplace (brick chimney breast) | x 540–900, y 100–770 | Brick pattern with wobbly mortar, soot stains above the opening. Firebox x 620–820, y 600–770 with grate and logs. Mantel shelf x 560–880 at y 600. Painting above the mantel x 620–820, y 240–420 |
| Console TV | x 1160–1420, y 600–850 | Wooden 1980s console on short legs with a low stand shelf in front of it (x 1150–1430, y 780). Screen x 1190–1340, y 630–740 (curved glass, rounded corners), knobs and speaker grille on the right, **rabbit-ear antenna** on top |
| Built-in bookshelf | x 1520–1800, y 310–850 | Board games, records, books, a stack of VHS tapes; its top ledge is a platform |
| Armchair | x 200–430, seat y 790 | Recliner, worn fabric |
| Rug | centre floor | Shaggy brown-orange rug in perspective |
| Floor | y 770–1080 | Wide parquet in the reference perspective |
| Foreground | bottom corners | Out-of-focus: a floor cushion (left), a side table with a phone (right) |

### Platforms

| Platform | Surface | Notes |
|---|---|---|
| Floor | y 935 | |
| Armchair | x 210–420, y 790 | |
| Mantel | x 560–880, y 600 | Reached from the armchair (190 up, 140 across) |
| TV stand shelf | x 1150–1430, y 780 | 155 up from the floor |
| TV top | x 1170–1410, y 600 | 180 up from the stand shelf |
| Bookshelf top | x 1530–1790, y 430 | 170 up from the TV top, 120 across. Stays below the work-order card safe zone (y > 300) |

### Lights (≥ 3 + head lamp)

| Light | Spec |
|---|---|
| **TV static** | The screen glows cold blue-white with animated static noise (draw the noise into a small offscreen canvas and scale it up; no blur). It lights the room in a pulsing cone/point from the screen (`moon`-ish colour mixed with `bone`), and **every 3–6 s it surges** (0.15–0.3 s, about 2× brightness), briefly lighting the whole room and revealing spiders in the corners. Never below the ambient floor of §3. |
| **Moonlight through blinds** | Striped shafts: 8–10 thin parallel quads from the window down to the floor (soft edges with nested quads, no blur), dust motes visible only inside the stripes |
| **Fireplace embers** | Faint red-orange glow in the firebox (`ember` at low intensity), slow breathing flicker |
| Off until the makeover | **Picture light** over the painting (brass bar, warm downward wash), and a **table lamp** on the right side table (foreground) |

### Webs (≥ 6)

Across the fireplace opening (it will burn away in the makeover), between the rabbit-ear antenna and the wall, in the upper corners of the window frame, from the ceiling beam to the chimney breast, under the armchair, on the bookshelf's top corner.

### Dirty → clean (≥ 4, plus story and trace)

1. Dust sheet thrown over the armchair → removed, folded on the arm (the chair's brown corduroy shows)
2. Cold grey ash in the firebox → logs and a real fire (see unique beat)
3. Blinds crooked with broken slats → straight and whole
4. Board games toppled across the shelf → stacked neatly
5. Painting above the mantel dark and grimy → a clear seascape at dusk
6. TV static → home movie (story object)
- **Story object:** the TV. Clean, it plays a **looping home movie**: painterly sepia frames of a beach, two adults, and a small child waving at the camera (the child who is faded in the Living Room portrait). 4–6 frames, cross-fading, slight film jitter and vignette. Results card: "On the television: a home movie. A child waves at whoever is filming."
- **Trace of the previous cleaner:** a flashlight with its lens cracked on the mantel, and a sticky note on the TV ("DON'T turn it off"). Clean: the flashlight stands upright; the note stays.

### Unique makeover beat

At t = 3.3 s the embers glow brighter, then **the fire catches**: flames rise across the logs over 1.2 s (layered flame tongues with flicker, sparks rising, the web across the opening shrivels and burns away), the fire becomes a warm flickering light source, and the crackle sound starts. At t = 4.6 s the TV static **rolls** (a vertical roll like an old set) and becomes the home movie.

## Gameplay

The room is darker and crawler-heavy: wall crawlers hide in the dark, the TV surges reveal them.

`rules`: `quota: 18`, `webGoal: 0.85`, `types: ['string', 'crawler']`, `spawnPattern: ['crawler', 'string', 'crawler', 'crawler', 'string', 'crawler', 'string', 'crawler']`, `maxAlive: [3, 4]`, `spawnInterval: [2.4, 1.3]`. Wall-crawler lairs: behind the TV, a crack in the chimney breast, behind the bookshelf, the gap above the blinds. Drop points avoid the beam's x range.

## QA (Gemini's own loop — ART-DIRECTION §15)

QA URL `game/index.html?qa=1&room=family-room` with `setup('dirty'|'action'|'makeover'|'clean'|'results')` plus `setup('surge')`: the TV mid-surge, two crawlers revealed in the corners, hero on the mantel aiming. Run at least 3 critique rounds against `reference/screens/` and `review/current/living-room/`, writing the 5 biggest gaps per round in the room's NOTES. Typical gaps for this room: panelling reading as flat stripes, brick as a regular grid, blinds light too hard-edged or too faint, static as flat grey noise, fire looking like clip-art.

Then play the room once start to finish.

## Deliverable — then STOP

1. Hero frames via `saveHero(page, 'family-room', state)`: `dirty`, `action`, `surge`, `makeover`, `clean`, `results`.
2. `makeSheet('05-family-room', …)` with six cells in this order: dirty, surge, action, makeover (at t ≈ 3.9 s, fire catching), clean, results.
3. `writeSummary('05-family-room', …)`: 8–12 lines — what was built, decisions, runtime requests, check results (no console errors, perf mean/p95 during action and makeover), `audit` result.
4. `node review.mjs gallery`.

Then stop. Do not start another room.

## Acceptance (ART-DIRECTION §16 plus)

- [ ] All checks of §16
- [ ] Reads instantly as a family TV room: fireplace, console TV, recliner, panelling, blinds
- [ ] Striped moonlight through the blinds, soft-edged
- [ ] TV static animated and surging; surges reveal corners
- [ ] Every platform reachable within the jump limits
- [ ] Unique beat: fire catches (web burns), TV rolls to the home movie
- [ ] Results card names the story object
- [ ] Images only in `review/` and `.scratch/`; audit clean
