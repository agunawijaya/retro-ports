# Prompt 11 — Room 9: the Kid's Bedroom (Thomas's room)

You are adding Room 9 to the Spyder web game in `E:\Projects\retro-ports\spyder\game\`. Where something is unclear, choose the option closest to the reference scene and write the decision in `game/rooms/kids-bedroom/NOTES.md`.

May run **in parallel with prompt 10**. Sections are tagged **[LOGIC]** or **[ART]** (`prompts/CLAUDE-CODE.md`, "Model policy"); if you were told to do only [LOGIC], build no art: the runtime's blockout covers it.

## Read first

1. `ART-DIRECTION.md` — §3–§6, §9, §10, §15 incl. "Where images go", §16, §17 row 9 ("slightly surreal tone").
2. `game/NOTES.md` ("The room interface", two-file form), `game/lib/room-runtime.js`.
3. Templates: `game/rooms/upstairs-hallway/` (two-file room; door C is the door to this room — its night-light, its "THOMAS" plaque), `game/rooms/downstairs-bathroom/`. Quality bar: `review/current/`, `reference/screens/`.

## Hard rules

- Files: `game/rooms/kids-bedroom/room.js` ([LOGIC]), `art.js` ([ART]), optional `room.css`. Shared edit: one `<script>` line in `game/index.html` (re-read before editing; prompt 10 may edit it too). **Do not modify `game/lib/`** (prompt 10 is changing it).
- Use the room id the house map uses (`lib/house-map.js`). Do not modify other rooms or `reference/`.
- **Jump reach:** rise ≤ 190 px, gap ≤ 160 px.
- `S.paint` for every surface, palette only, no per-frame blur, static art cached.
- Images only through `review.mjs` or `.scratch/`; `audit` clean; `.scratch/` emptied. No git commits.

## The room

Thomas's bedroom, kept exactly as it was the year the height marks stopped: a bunk bed, a toy chest, a desk under a window, a planet mobile, a star-projector night-light that still turns. The tone is **slightly surreal**: the toys seem to move by themselves, and the night-light throws spider shadows far bigger than the spiders.

### L1 [LOGIC] — Layout data (also `layout.props`)

| Element | Position (stage units) | kind |
|---|---|---|
| Ceiling, a sloped dormer on the right | y 0–110; slope from (1500, 110) down to (1860, 300) | wall |
| Wall | y 110–770, wallpaper with a border of small rockets at y 420 | wall |
| Door to the hallway | x 110–260, y 360–770, ajar | furniture |
| Bunk bed | x 300–700; lower bunk y 800, upper bunk y 620, ladder at x 700–740 | furniture |
| Planet mobile | hanging from the ceiling at x 900, planets down to y 320 | furniture |
| Star-projector night-light | on the floor at x 860, y 900 | light |
| Toy chest (a lair) | x 820–1000, top y 840 | furniture |
| Toy train and track | an oval track on the floor in front, x 760–1280, y 960–1020 | furniture |
| Desk with lamp | x 1250–1550, top y 770 | furniture |
| Wall shelf with toys and the music box | x 1250–1550, y 590 | furniture |
| Thomas's drawing (story) | pinned above the shelf, x 1330–1470, y 430–540 | story |
| Dormer window with rocket curtains | x 1600–1800, y 330–600 (under the slope) | window |
| Floor | y 770–1080, boards in the reference perspective, a round rug | wall |

**Platforms:** floor y 935; lower bunk x 305–695, y 800; upper bunk x 305–695, y 620; toy chest x 825–995, y 840; desk x 1255–1545, y 770; shelf x 1260–1540, y 590 (180 up from the desk).

### L2 [LOGIC] — Gameplay

- **The toy chest** is a lair: its lid pops up like a jack-in-the-box (a spring "boing") and a Jumper leaps out. Jumpers in this room come only from the chest and from under the bunk.
- **The train** runs slowly round its track in the dirty room (it was never switched off). Hatchlings sometimes **ride** it (a hatchling that touches the track climbs on and rides one lap before hopping off). The train is not a platform; darts pass over it.
- **String spiders hang from the planet mobile** as well as from the ceiling; when one drops from it, the mobile turns a little.
- **Toys that move on their own:** every 6–10 s one small toy on the shelf or floor twitches or rolls a little (a ball rolls, a robot turns its head, a top spins briefly) — purely atmosphere, never a threat.
- `rules`: `quota: 20`, `webGoal: 0.85`, `types: ['string', 'crawler', 'jumper', 'eggCarrier']`, `spawnPattern: ['string', 'jumper', 'crawler', 'string', 'eggCarrier', 'jumper', 'string', 'crawler']`, `maxAlive: [3, 4]`, `spawnInterval: [2.3, 1.2]`. Crawler and Egg Carrier lairs: the door gap, behind the bunk's headboard, under the dormer slope, behind the desk.
- Makeover beats (timing): shared beats, then `musicbox` at 3.3 s (the music box on the shelf opens; its figure turns; a gentle original tune), `stars` at 3.6 s (the projector's stars slow to a calm turn and warm in colour), `train` at 4.4 s (the train pulls into a little station and stops with a toot), `drawing` at 4.8 s (the drawing unfolds flat and reveals itself).
- `storyObject`: "Above the desk: Thomas's drawing of his family — and of someone in an orange suit."
- QA states: `dirty`, `action`, `makeover` (t ≈ 3.9 s), `clean`, `results`, plus `shadows`: a string spider near the projector throwing a **huge shadow** across the wall, a Jumper leaping out of the open toy chest, a hatchling riding the train, the hero on the upper bunk aiming.
- Webs (≥ 6): the mobile to the ceiling, the bunk's upper corner, the dormer window, the shelf's end, under the desk, the door frame.

### L3 [LOGIC] — The music-box tune

Procedural Web Audio: a short, original, tinkling melody (sine/triangle with a quick decay and a little detune, like a comb music box), slightly slowing at the end of each phrase as if winding down, about 12 bars, then a quiet loop. Dirty state: now and then a few slow, out-of-tune notes, as if the music box tries to play by itself. No existing melodies.

### A1 [ART] — Painting, light, props

| Item | Spec |
|---|---|
| Wallpaper | Pale sky blue with tiny stars and a border of small rockets (low contrast); dirty: a long damp stain down from the dormer, a corner peeling |
| **Star projector light** | The night-light turns slowly and scatters soft star and moon shapes across the walls and ceiling (a rotating set of soft points and crescents, drawn into the light map; no blur). This is the room's signature look. |
| **Giant spider shadows** | A spider within 300 px of the projector casts a large, soft, distorted shadow on the wall behind it (its silhouette projected away from the projector, 3–5× size, low alpha, moving with its legs). Purely visual, but creepy. |
| Bunk bed | Painted wood (muted blue) with a ladder; patchwork quilts; a torch and comics on the upper bunk; dirty: bedding tangled, a sheet hanging down |
| Planet mobile | Painted wooden planets on wires, slowly turning; dirty: cobwebbed, one planet hanging lower |
| Toy chest | Painted lid with stars; dirty: scuffed, the lid ajar |
| Train | A small tin train with three carriages, catching light; a tiny headlamp glow |
| Desk and lamp | A school desk with an angle-poise lamp (off when dirty; lit in the clean state), crayons, a pencil pot, an exercise book |
| Shelf | Toys: a robot, a spinning top, a stuffed bear, a wooden rocket, the music box (a small box with a turning figure), a globe |
| **Thomas's drawing (story)** | Crayon on paper. Dirty: curled, sun-bleached and half covered by a web — only scribbles show. Clean: three figures holding hands, labelled in a child's hand "MUM", "DAD", "ME", and beside them a small **orange figure with a vacuum hose**, labelled "THE HELPER" |
| Dormer window | Rocket-print curtains (dirty: one torn); night sky with stars, then dawn |
| Posters | A space poster and a dinosaur poster (generic, invented, no brands or real logos); dirty: peeling |
| Dirty → clean (≥ 4) | Toys strewn on the floor → on the shelf; tangled bedding → made bunks; torn curtain → whole; peeling posters → flat; desk drawers open → closed; derailed carriage → on the track |
| Trace of the previous cleaner | A walkie-talkie on the floor by the door that **crackles** now and then in the dirty room. Clean: silent, placed on the desk |
| Door to the hallway | Ajar; the hallway's sconce light warms the gap once clean |

## QA (ART-DIRECTION §15)

URL `game/index.html?qa=1&room=kids-bedroom`. [LOGIC]: play through on the blockout: chest pops, train riding, mobile drops, makeover timing. [ART]: at least 3 critique rounds against `reference/screens/` and `review/current/`, 5 biggest gaps per round in NOTES (typical: star light as a dotted grid, shadows too hard or too dark to read the room, toys as flat icons, the drawing unreadable).

## Deliverable — then STOP

1. `saveHero(page, 'kids-bedroom', …)`: `dirty`, `action`, `shadows`, `makeover`, `clean`, `results`.
2. `makeSheet('11-kids-bedroom', …)`: dirty, shadows, action, makeover, clean, results.
3. `writeSummary('11-kids-bedroom', …)`: what was built, decisions, runtime requests, checks (no console errors; perf mean/p95 in `action` and `makeover`), audit, and who did [LOGIC] and [ART].
4. `node review.mjs gallery`. Then stop.
