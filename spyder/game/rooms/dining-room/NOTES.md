# Room 5: The Dining Room, and the Egg Nest

*Prompt 06 (`prompts/06-dining-room.md`), built 2026-10-29.*

The formal dining room, laid for a dinner that never happened: six places set, candles never lit, a long table under a dusty cloth, and an egg nest pulsating in the dark under the table. It introduces the **Egg Nest** under the table cradled in a silk hammock web, creating immediate urgency before the eggs hatch into swarms of hatchlings.

## Files

| Path | What it is |
|---|---|
| `room.js` | The room: layout, painting, cached layers, webs, live props, lights, rules, makeover, QA staging, hooks |
| `room.css` | Diegetic pinned note styling with Caveat handwriting, pin drop-shadow, and tear animations |
| `NOTES.md` | Room documentation, platform reach metrics, decisions, 3 QA critique rounds, and runtime requests |
| `review/current/dining-room/` | Six hero frames (1920 × 1080 JPEG): `dirty.jpg`, `action.jpg`, `nest.jpg`, `makeover.jpg`, `clean.jpg`, `results.jpg` |
| `review/prompts/06-dining-room/sheet.jpg` | Contact sheet with six cells (dirty, nest, action, makeover at t ≈ 3.9 s, clean, results) |
| `review/prompts/06-dining-room/summary.md` | Deliverable summary report |

One line was added to `game/index.html`: `<script src="rooms/dining-room/room.js"></script>` after the Kitchen. No other files outside `game/rooms/dining-room/` were modified.

## Run It

```bash
cd game/tools
node shoot.mjs --hero --room=dining-room
node review.mjs gallery
node review.mjs audit
```

QA URL: `game/index.html?qa=1&room=dining-room`
- `setup('dirty')`: Room laid for dinner, dusty cloth, knocked-over chairs, unlit candles, flickering chandelier bulb, pinned note from "A." on sideboard.
- `setup('nest')`: Four nest eggs under table in varying stages of maturity (egg 1 at 13.6/14 s about to hatch), hero crouched on floor aiming under table, Jumper crouched on table.
- `setup('action')`: String spiders dropping from ceiling rose, wall crawler emerging from cabinet, nest eggs pulsating, Jumper poised on table, hero firing.
- `setup('makeover')`: Dynamic makeover beat — candles light one by one left to right (3.30–4.30 s) with flares and rising chimes, chandelier and cabinet light up, place cards flip upright.
- `setup('clean')`: Crisp white linen, fresh roses centerpiece, chairs upright and tucked in, china cabinet lit with sparkling china, place cards standing.
- `setup('results')`: Results card highlighting story object: *"Place cards for six. One says 'A.' — her chair was never pulled out."*

## Gameplay: The Egg Nest

Under the long dining table, suspended within a silk hammock web strung between the turned mahogany legs, lies a nest of **four egg sacs** placed at the start:
- **Redesigned Egg Sacs:** Rendered in wall/web mode with wobbly teardrops, layered silk binding threads, internal egg silhouettes, translucent breathing pulses, and husk fade on hatching.
- **Staggered Hatch Timers:** 14 s, 22 s, 30 s, and 38 s from room entry. Each egg produces 3 rapid hatchlings if not neutralized.
- **Tactical Geometry:** The hero must crouch-shoot from the floor or drop down off the table to shoot beneath the tablecloth hem (hem y = 880, floor y = 935).
- **Scoring & Bonus:** Popping any nest egg yields the **"+120 Nest!"** bonus, increments the egg stat, and counts toward the room quota.
- **Diegetic Warning Note:** A handwritten scrap pinned with a brass pushpin to the sideboard reads: *"Under the table. Don't let them hatch. — A."*. The note automatically tears off after 6 seconds, or tears immediately upon the first nest egg popped.

## Platforms and Jump Reach Verification

Hero jump reach: rise ≤ 190 px, horizontal gap ≤ 160 px.
- **Floor (`y = 935`):** Full room span.
- **Sideboard (`x: 120–420, y = 745`):** Rise from floor is `935 - 745 = 190 px` (≤ 190 px).
- **Long Table (`x: 570–1420, y = 760`):** Rise from floor is `935 - 760 = 175 px` (≤ 190 px). Horizontal gap from sideboard right edge (`x = 420`) is `570 - 420 = 150 px` (≤ 160 px).
- **Plate Rail (`x: 640–1340, y = 575`):** Rise from table is `760 - 575 = 185 px` (≤ 190 px). Overlaps table horizontally (gap = 0 px). Landing on the rail causes nearby decorative plates to wobble with damped harmonic physics.
- **China Cabinet Ledge (`x: 1570–1790, y = 600`):** Reached from the table's right end (`x = 1420, y = 760`). Rise is `760 - 600 = 160 px` (≤ 190 px); horizontal gap is `1570 - 1420 = 150 px` (≤ 160 px).

## Lights (5 Light Sources + Headlamp)

1. **Window Moonlight:** Tall cool beam (`#8ca6c8`) through the left window crossing the sideboard and left end of the table, populated with floating dust motes.
2. **Chandelier (x 980, y 300):** Dirty: single bulb flickering weakly (`#f2a54a`), faceted cut crystals catching glints; clean: all 6 warm bulbs blazing.
3. **China Cabinet Interior:** Dark when dirty; warm glowing interior (`#f2a54a` / `#f6d29b`) after makeover illuminating porcelain rows.
4. **Candlesticks (5 Along Table):** Dirty: dark charred wicks; clean: 5 warm ember/amber candle flames flickering with localized light points.
5. **Under-Table Ambient Bounce:** Dedicated soft ambient bounce light (`#a69880`) beneath the table cloth ensuring the egg nest and silk web are distinctly readable against the dark parquet.

## Story Object & Cleaner's Trace

- **Story Object (Place Cards):** Six handwritten place cards set before each chair. Dirty: lying flat in dust, smudged and unreadable. Clean: upright cards reading "Arthur", "Eleanor", "Thomas", "A.", "Beatrice", "Julian". Seat A's chair is tucked all the way under the table — her chair was never pulled out.
- **Trace of Previous Cleaner:** A feather duster snapped in two on the sideboard with splintered handle and splayed feathers (dirty); neatly laid side-by-side (clean).

## Unique Makeover Beat

- **t = 3.30 s – 4.30 s:** Candlesticks ignite sequentially left to right at 0.25 s intervals (`3.30`, `3.55`, `3.80`, `4.05`, `4.30`). Each ignition triggers a burst of amber sparkle particles and a soft rising chime (`0/12`, `2/12`, `4/12`, `5/12`, `7/12`).
- **t = 4.30 s:** As the final candle catches, the chandelier blazes to full illumination and the china cabinet interior lights up.
- **t = 4.40 s – 5.00 s:** Place cards flip up one by one across the table with subtle paper flip audio cues.

## Design Decisions

1. **Tablecloth Folds as Painterly Shading:** To prevent the tablecloth from appearing as a flat grey slab, layered directional brush strokes, vertical draped folds, drop shadows, and hem scallops were hand-crafted into the furniture canvas.
2. **Dynamic Plate Wobble Physics:** Handled via custom harmonic spring damping in `onUpdate`, triggered by hero landing events within 180 px of each plate.
3. **Under-Table Readability:** Added a dedicated point light beneath the table so the egg sacs and silk web hammock remain clearly legible without blowing out the room's moody atmosphere.
4. **Two Knocked-Over Chairs:** Left end chair knocked over on its side at x 500, y 915; front-right chair knocked flat on the parquet floor at x 1230, y 925. In clean state, both are upright and tucked in. Chair "A." is uniquely tucked all the way beneath the tablecloth.
5. **Diegetic Pinned Note Removal:** Clean and makeover QA states immediately purge the DOM element so clean frames never show dirty paper artifacts.

## QA Critique Rounds (ART-DIRECTION §15)

Each round was evaluated against `reference/screens/` and `review/current/` frames.

### Round 1
1. **Tablecloth read as a flat grey slab:** The cloth looked like a flat polygon without weight or drapery. → Added deep vertical draping folds with alternating shadow/highlight ribbons, hem scallop shadow, and woven texture.
2. **China cabinet interior was an opaque black box:** Glass shelves and contents were invisible when dirty. → Added back panel wood framing, two interior shelves, china plate silhouettes, and a diagonal crack across the left pane.
3. **Chandelier looked like a stick figure:** Chandelier arms were simple single lines. → Added turned mahogany/brass stem, collar rings, ornate double-curved scrolling arms, bobeches, candle cups, and faceted teardrop cut-glass crystal pendants.
4. **Plates and glasses were flat discs:** Dinner settings lacked dimension. → Added charger plates, inner porcelain rims, polished knife and fork silhouettes, and translucent wine glasses with specular stems.
5. **Egg nest was unreadable in the dark under the table:** The space under the table hem fell into near pitch-black shadow. → Added dedicated under-table bounce light point and pale silk hammock anchor lines.

### Round 2
1. **Damask wallpaper was too high contrast:** The pattern competed with spiders on the upper wall. → Subdued wallpaper motif opacity, shifted base to muted moss-umber mix, and deepened ceiling shadow.
2. **Pinned note lingered during makeover and clean states:** The HTML note remained visible over clean hero frames. → Updated `onStart` to explicitly remove the note DOM during clean, makeover, and results states.
3. **Decorative plates on the plate rail were completely static:** Landing on the plate rail had no feedback. → Added dynamic wobble physics to plates triggered whenever the hero lands on the plate rail.
4. **Dirty chairs lacked dramatic disarray:** The front chair was only slightly tilted. → Changed front-right chair to fully knocked over on the parquet floor with splayed legs, contrasting with clean upright alignment.
5. **Candle flames lacked punch during makeover:** Flames appeared abruptly without flare. → Added multi-layer flame rendering (amber outer body, ember core, white root) and sparkle particle bursts upon each candle lighting.

### Round 3
1. **Parquet floor lacked grain and perspective definition:** Herringbone pattern felt flat under lighting. → Refined herringbone plank layout with alternating grain angles, tonal wood variations, and soft contact shadows.
2. **Broken feather duster was indistinct:** Duster looked like stray twigs. → Scaled up the duster, added splintered fracture detail at the break, and splayed purple-grey feathers.
3. **Moonlight shaft lacked motes:** Window beam looked like a static gradient polygon. → Added floating dust motes drifting across the moonlight beam.
4. **Makeover pacing had candle and card cues colliding:** Candle chimes and card flips stepped on each other. → Staggered candle ignition sequence across 3.30–4.30 s, chandelier/cabinet at 4.30 s, and card flips from 4.40 to 5.00 s.
5. **Egg pop lacked direct narrative tie-in with the note:** Popping an egg felt disconnected from the note. → Linked first egg pop directly to tearing the pinned note with sound effect, along with "+120 Nest!" banner.

## Runtime Requests

1. **Platform Landing Impulse Data:** Request that `world.on('land', ...)` pass landing impact velocity and position. *Workaround:* Monitored hero position `world.hero.x` during `land` events on platform `plate-rail` to compute localized plate wobble.
2. **Custom Egg Kill Handler in `spawnEgg`:** Request native support for custom bonus points and banners in `spawnEgg`. *Workaround:* Wrapped `egg.kill` on spawned nest eggs to return `{ bonus: 120, label: 'Nest!' }` and trigger note destruction.

## Fix 1 (2026-10-29, Claude Code)

- **Readability:** the dirty frame is readable through moonlight bounce. The clean wall is muted sage with embossed damask.
- **New painting:** two portraits and a sampler on the wall; carved chairs; tablecloth folds with a lace hem.
- **Per-frame drawing:** plates, place cards and the chandelier's brass are now cached sprites. They used to call `paintShape`, which blurs, on every frame.
- **Place cards:** they were drawn in `drawProps`, behind the furniture layer, so the tablecloth hid them. They now go through the new runtime hook `drawOnFurniture`, together with the candle flames, and rise on the `cards` beat, not on the dawn.

Details and numbers: `review/prompts/06-dining-room-fix-1/summary.md`.
