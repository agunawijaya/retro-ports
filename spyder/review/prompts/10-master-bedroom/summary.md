# Prompt 10 — Room 8: the Master Bedroom [LOGIC] & Blockouts (2026-10-29)

*Who did what: Under the model policy, all [LOGIC] sections (layout data, platforms, bouncy bed mechanics, wardrobe nest mechanics, extra goals runtime support, procedural Web Audio radio system, makeover timing, and QA staging) were built by Gemini. For every [ART] item, clear geometric blockouts were built in the game palette at the exact prompt coordinates and dimensions, each drawing routine tagged with `// ART: blockout - <item>`. Per explicit instructions, no finished painting or review sheet (`sheet.jpg`) was produced; the review sheet and finished art are left for the Art agent.*

---

## 1. What Was Built

### L1 [LOGIC] — Layout & Two-File Structure
- **Two-File Room Architecture (`game/rooms/master-bedroom/room.js` & `art.js`):**
  - Registered Room 8 (`id: 'master-bedroom'`, `number: 8`, `act: 2`, `name: 'Master Bedroom'`, `art: true`).
  - Added `<script src="rooms/master-bedroom/room.js"></script>` to `game/index.html` in house order between `upstairs-hallway` and `kids-bedroom`.
  - Art decoupled into `game/rooms/master-bedroom/art.js` via `Spyder.rooms.attachArt('master-bedroom', ...)`.
- **Layout Data & Platforms (`layout` and `layout.props`):**
  - Stage bounds: left 100, right 1840.
  - Platforms:
    - `floor`: x 0–1920, y 935 (`oneWay: false`).
    - `left-nightstand`: x 435–525, y 790 (`oneWay: true`, 145 px rise from floor).
    - `mattress`: x 570–1170, y 780 (`oneWay: true`, 155 px rise from floor, **bouncy**).
    - `hat-box-shelf`: x 705–1045, y 520 (`oneWay: true`, 260 px rise from mattress — accessible only via mattress bounce).
    - `right-nightstand`: x 1205–1285, y 790 (`oneWay: true`, 145 px rise from floor).
    - `dressing-table`: x 1365–1595, y 760 (`oneWay: true`, 175 px rise from floor).
    - `chest`: x 1645–1815, y 800 (`oneWay: true`, 135 px rise from floor).
  - All standard jumps are within reach budget (rise ≤ 190 px, horizontal gap ≤ 160 px). The hat-box shelf at y 520 requires the 1.35× bounce from the bouncy mattress (L2).
- **Lairs & Drop Points:**
  - Crawler lairs: behind the headboard (`x: 565, y: 560`), under the dressing table (`x: 1480, y: 800`), and behind the chest (`x: 1730, y: 840`).
  - String spider drop points: ceiling and curtain rail points at `[300, 500, 880, 1250, 1600]`.
- **Webs (7 webs defined, ≥ 6 required):**
  1. Across the wardrobe top (`hub: [250, 260]`).
  2. Curtain rail to ceiling (`hub: [880, 160]`).
  3. Between the bedposts / headboard (`hub: [565, 520]`).
  4. Dressing table three-fold mirror corner (`hub: [1560, 430]`).
  5. Under the bed (`hub: [870, 890]`).
  6. Hat boxes on the shelf (`hub: [780, 500]`).
  7. Dressing table edge to wall (`hub: [1365, 760]`).

---

### L2 [LOGIC] — Gameplay & Mechanics
- **Bouncy Bed Mechanics:**
  - Hero landing on mattress (`platform.name === 'mattress'`) with downward velocity `prevHeroVy > 300` triggers a vertical bounce.
  - Holding jump on landing (or active jump buffer) boosts hero velocity to 1.35× normal jump speed (`-hero.jumpSpeed * 1.35`, ~1431 px/s), allowing a vertical rise of up to 270 px (easily reaching the hat-box shelf at y 520). Releasing jump gives a smaller bounce (0.85×).
  - Plays the creaking springs audio effect (`sfx('creak', 0.8)`).
  - Animates quilt denting and recovery (`live.quiltDent`).
- **The Wardrobe Nest:**
  - Inside the wardrobe (x 120–380, y 260–850) is a thick sheet of web with egg clusters taking 8 hits to destroy.
  - Every 10 s (8 s after the first spider kill), the wardrobe doors creak open for 2.5 s and 2–3 hatchlings tumble out.
  - Dart interception: while doors are open, darts entering the wardrobe doorway (x 140–360, y 280–830) hit the nest, tear it visibly (`live.nestTorn = live.nestHits / 8`), emit burst fibres and goo, and are consumed.
  - On the 8th hit: awards +500 `"Nest!"`, calls `world.completeGoal('nest')`, keeps the doors open, and halts future hatchling bursts.
- **Rules Configuration:**
  - `quota: 18`, `webGoal: 0.85`.
  - `types: ['string', 'crawler', 'jumper', 'eggCarrier']`.
  - `spawnPattern: ['string', 'crawler', 'eggCarrier', 'string', 'jumper', 'crawler', 'string', 'eggCarrier']`.
  - `maxAlive: [3, 4]`, `spawnInterval: [2.4, 1.3]`.
  - `extraGoals: [{ id: 'nest', label: 'Wardrobe nest' }]`.
- **Makeover Timing & Beats:**
  - Shared makeover beats in runtime, followed by:
  - `lights` at 3.3 s: dressing table vanity bulbs light one by one, 0.12 s apart.
  - `photo` at 3.9 s: Arthur and Eleanor's wedding photo stands upright.
  - `radio` at 4.3 s: radio static clears into an original vintage waltz.
- **Story Object:**
  - `"On the dressing table: Arthur and Eleanor's wedding photograph, 1968."`
- **QA Staging States:**
  - `dirty`: Hero at x 480, cold room, static radio hiss, cracked mirrors, closed wardrobe.
  - `action`: Active spiders, crawler from headboard, jumper, egg sac, torn webs, hero aiming.
  - `nest`: Wardrobe doors open mid-burst, nest half-torn (4 hits), two tumbling hatchlings, hero mid-bounce above bed (y 620, vy -600) aiming at wardrobe doorway.
  - `makeover`: Staged at t ≈ 3.9 s during vanity light sequence and wedding photo standing.
  - `clean`: Morning lace window light, pristine made bed, open wardrobe, illuminated bulbs, standing photo, clear radio music.
  - `results`: Work order card showing quota, webs, and extra goal completed with tick, citing the story object.

---

### L3 [LOGIC] — Shared Extra Goals (`game/lib/room-runtime.js` & `game/lib/hud.js`)
- **Runtime Support for `rules.extraGoals: [{ id, label }]`:**
  - Added `completedGoals = new Set()` in runtime closure, cleared on `resetRoom()`.
  - Added `world.completeGoal(id)` and `world.isGoalComplete(id)`.
  - Exposed `completeGoal(id)` on `stagingApi`.
  - Updated `cleanFraction()`: each extra goal counts as one equal share alongside spiders and webs:
    `fraction = (kills / quota + websTorn / webGoal + completedGoals.size) / (2 + extraGoals.length)`.
  - Updated `roomIsClear()`: requires `cleanFraction() >= 1 && !critters.some(c => c.alive) && extraGoalsDone`.
  - Updated `clearRoom()` and `stageRestored()`: marks all extra goals completed to support automated testing and cheat commands.
- **HUD Card Integration (`game/lib/hud.js`):**
  - Dynamically appends extra goal checklist lines to the work order card.
  - Displays goal label on the left and a hand-drawn tick (`✓`) or empty box (`class="work-order__goal-box"`) on the right, matching work order styling.
  - Updates ticks in real-time as goals are completed; resets on room restart.
  - Rooms without `extraGoals` are unaffected (card displays exactly as before).

---

### L4 [LOGIC] — Procedural Radio Audio
- **Web Audio Radio Engine:**
  - Original 16-bar waltz melody in 3/4 time synthesized using a warm triangle wave voice over a two-chord pad (Cmaj7 / Am7).
  - Filtered through a bandpass/lowpass network mimicking vintage 1960s tabletop radio acoustics.
  - Fades naturally into a quiet ambient pad loop.
  - Dirty state: bandpass-filtered noise hiss (1400 Hz) with intermittent radio crackle.
  - Clean/makeover state: static clears smoothly into the waltz melody at the 4.3 s `radio` beat.
  - Safe teardown: all audio nodes and timeouts disconnected on room exit via `onLeave()`.

---

## 2. Left for ART

Every [ART] item has been built as a clear geometric blockout in the palette at exact prompt positions and dimensions in `game/rooms/master-bedroom/art.js`. Each routine is marked in code with `// ART: blockout - <item>`:

| # | Item | Marker in Code | Location | Spec & What is Left for Finished ART |
|---|---|---|---|---|
| 1 | **Wallpaper** | `// ART: blockout - Wallpaper` | `game/rooms/master-bedroom/art.js` (`paintWallpaper`) | Muted rose-and-trellis pattern (low contrast) over warm taupe, picture rail at y 170. Dirty: water stains and a long tear beside the window. Clean: pristine paper. |
| 2 | **Lace curtains** | `// ART: blockout - Lace curtains` | `game/rooms/master-bedroom/art.js` (`paintLaceCurtains`, `glow`, `lights`) | Window at x 760–1000, y 180–470. Window moonlight passes through lace: a lace pattern of light falls across the bed and wall (signature room look), drawn into light map with soft-edged shapes, no blur. |
| 3 | **Bed** | `// ART: blockout - Bed` | `game/rooms/master-bedroom/art.js` (`paintBed`, `drawProps`) | Carved headboard (x 540–590, y 520) and footboard (x 1170); quilted cover with patchwork squares and soft folds; pillows. Dirty: dust sheet half pulled off, sunken grey dent. Clean: made bed, plumped pillows, folded nightgown. Denting animation on hero bounce. |
| 4 | **Wardrobe** | `// ART: blockout - Wardrobe` | `game/rooms/master-bedroom/art.js` (`paintWardrobe`, `drawProps`) | Tall dark wood at x 120–380, y 260–850, carved cornice, two doors with oval mirrors (dirty: cracked) and brass key. Doors creak open for hatchling bursts. Inside: thick pale sheet of web with egg clusters, lit faintly from within, tearing on dart hits. |
| 5 | **Dressing table** | `// ART: blockout - Dressing table` | `game/rooms/master-bedroom/art.js` (`paintDressingTable`, `drawProps`) | Kidney-shaped with skirt at x 1360–1600, top y 760; three-fold mirror (y 420–700) ringed with round vanity bulbs (dark dirty, lighting one by one at makeover beat `lights`); perfume bottles, hairbrush, jewellery box. |
| 6 | **Wedding photo (story)** | `// ART: blockout - Wedding photo (story)` | `game/rooms/master-bedroom/art.js` (`paintWeddingPhoto`, `drawProps`) | Silver frame on dressing table. Dirty: face down, glass cracked. Clean: stands upright, black-and-white couple in suit and veil — "Arthur & Eleanor, 1968" on mount. |
| 7 | **Radio** | `// ART: blockout - Radio` | `game/rooms/master-bedroom/art.js` (`paintRadio`, `drawProps`, `glow`) | 1960s tabletop radio on left nightstand with glowing dial. Dirty: dial flickering in static. Clean: warm small light of its own. |
| 8 | **Lamps** | `// ART: blockout - Lamps` | `game/rooms/master-bedroom/art.js` (`paintLamps`, `drawProps`, `glow`, `lights`) | Two bedside lamps with pleated shades on nightstands. Dirty: left lamp works dimly, right lamp is dead. Clean: both lamps glowing warm. |
| 9 | **Hat boxes** | `// ART: blockout - Hat boxes` | `game/rooms/master-bedroom/art.js` (`paintHatBoxes`, `drawProps`) | Round striped boxes on shelf (x 700–1050, y 520). Dirty: one box fallen over. Clean: neatly stacked on shelf. |
| 10 | **Dirty → clean (≥ 4)** | `// ART: blockout - Dirty to clean` | `game/rooms/master-bedroom/art.js` (`paintProps`, `drawProps`) | (1) Dust sheet half pulled off → made bed with folded nightgown; (2) Cracked wardrobe mirrors → intact; (3) Fallen hat box → returned to shelf; (4) Torn wallpaper → pristine; (5) Scattered clothes on chest → neatly folded; (6) Dead right bedside lamp → illuminated. |
| 11 | **Trace of previous cleaner** | `// ART: blockout - Trace of the previous cleaner` | `game/rooms/master-bedroom/art.js` (`paintCleanerTrace`, `drawProps`) | Sleeping bag rolled out at foot of bed with wind-up alarm clock (they slept here). Clean: sleeping bag rolled up and tied, alarm clock resting on chest of drawers. |

---

## 3. Decisions & Architectural Notes

1. **LightMap API Contract (`lights` vs `glow`):**
   - The runtime calls `room.lights(lightMap, live, t, mk)` which takes 4 arguments and must return the flicker scalar `flick`.
   - The runtime then calls `room.glow(ctx, lightMap, live, t, mk, flick, shift)`.
   - In `master-bedroom/art.js`, `live.noise` is seeded in `createLive()`, and `flick = S.light.flicker(live.noise, t, 1.4)` is computed and returned by `lights()` to avoid any `undefined`/`NaN` gradient values.
2. **Runtime `clearRoom()` Behavior for Extra Goals:**
   - In `game/lib/room-runtime.js`, `clearRoom()` must satisfy `roomIsClear()`. For rooms with `rules.extraGoals`, `clearRoom()` marks all extra goals complete (`rules.extraGoals.forEach(g => completedGoals.add(g.id))`), guaranteeing that test automations (`flowtest.mjs`, `checks.mjs`) advance properly into makeover.
3. **Bouncy Bed Reach Calculations:**
   - Standard jump budget: rise ≤ 190 px, gap ≤ 160 px.
   - The hat-box shelf is at y 520, which is a 260 px rise above the mattress (y 780).
   - Mattress bounce velocity at 1.35× normal jump speed (`-1431 px/s` with engine gravity `2800 px/s²`) provides peak height `h = v² / (2g) ≈ 365 px`, with reach up to 270 px well within controlled jump arc.
4. **Zero Shared-Code Regression:**
   - The addition of `rules.extraGoals` in `room-runtime.js` and `hud.js` was carefully isolated with guards `if (rules.extraGoals)` so rooms without extra goals execute with identical logic and rendering paths.

---

## 4. Verification & Benchmarks

- **Checks Suite (`node game/tools/checks.mjs`):**
  - **36/36 checks passed (100%)**, zero errors.
  - Confirmed house room unlocking order: `(front-porch, living-room, family-room, kitchen, dining-room, downstairs-bathroom, upstairs-hallway, master-bedroom, kids-bedroom)`.
- **Visual Regression Suite (`node game/tools/regress.mjs`):**
  - **Passed completely:** `REGRESSION: canvas identical to the reference in every state` across dirty, action, makeover, clean, and results states.
- **Campaign Flow Suite (`node game/tools/flowtest.mjs`):**
  - **Passed completely** across all 9 rooms sequentially from Title through Kid's Bedroom.
  - Verified entering from map, real-time critter spawning, makeover, results card with story object, CLEAN stamp placement, and reload state persistence in both normal and blocked storage environments.
- **Performance Benchmarks (`node game/tools/perf.mjs 4 --room=master-bedroom`):**
  - `master-bedroom-action`: **363 frames in 4 s · mean 2.02 ms · median 1.80 ms · p95 3.00 ms**
  - `master-bedroom-makeover`: **393 frames in 4 s · mean 1.23 ms · median 1.20 ms · p95 2.00 ms**
  - Both states operate comfortably beneath the budget threshold of ≤ 8.0 ms.
- **Hero Frame Captures (`review/current/master-bedroom/`):**
  - Rendered: `dirty.jpg`, `action.jpg`, `nest.jpg`, `makeover.jpg`, `clean.jpg`, `results.jpg`.
- **Review Gallery Rebuild (`node game/tools/review.mjs gallery`):**
  - Gallery rebuilt cleanly in `review/index.html`.
- **Image Audit (`node game/tools/review.mjs audit`):**
  - Clean: **0 stray images**; `.scratch/` directory is emptied.
- **Review Sheet:**
  - Deliberately omitted per user instruction ("Do not make the review sheet").


---

## [ART] painted by Claude Code (after the Flash logic run)

*Who did what: Gemini 4 Argon was refused on quota (429), so **Gemini 3.8 Flash** built the [LOGIC]:
- L1–L4: room.js, the bouncy bed, the wardrobe nest, the extra goals in `room-runtime.js`/`hud.js`, and the radio.

**Claude Code (Opus)** replaced Flash's blockout `art.js` with a painted one and made the review sheet. The note above saying no sheet was made describes the Flash run only.*

- **Lace light (the signature):**
  - The moonlight through the lace falls in a soft pool down the wall below the window and across the bed.
  - The lace shows *as shadow* in it: a fine diagonal net, rows of six-petal flowers, a scalloped border, and the window's glazing bars, all growing larger as the pool falls away from the window.
  - It is painted once into two small canvases (moon and dawn) and added into the light map each frame. The edges are soft from nested shapes; there is no blur.
- **Wallpaper:** muted roses on a diagonal trellis over warm taupe, under a picture rail with two empty hooks and paler squares where pictures hung. Dirty: water stains, runs down from the window frame, and a long tear beside the window with its flap folded back.
- **Window and lace curtains:** a sash window with glazing bars and a deep reveal. Two lace panels are drawn over the open glass at partial opacity, so the sky reads through them: rosettes, folds and a scalloped hem. Dirty: grey with age, a cracked pane, and the right panel torn with a flap hanging.
- **Bed:**
  - Seen from the side, the headboard has a carved crest and a thinner, darker back post, so it reads as a panel at an angle. The footboard is lower.
  - The patchwork quilt hangs over the side in folds, with stitched seams and a piped hem, and there are pillows.
  - Dirty: a grey dust sheet over two thirds of the bed, half pulled off onto the floor, and a sunken grey dent.
  - Clean: the bed made, with a folded nightgown on the pillow.
  - The quilt dents where the hero bounces (`quiltDent`, at `quiltDentX`).
- **Wardrobe and nest:**
  - Dark wood with a carved cornice and plinth, and two doors with oval mirrors (cracked when dirty) and a brass key.
  - The doors swing open from their outer hinges: each narrows toward its hinge, grows a little at its free edge, and shows its thickness.
  - Inside, the nest is a thick, pale, glowing sheet of silk with seven egg clusters, and it has a light of its own in the light map.
  - Each hit cuts a ragged slit, and every hit or so bursts a cluster, which leaves a yellowed smear and empty shells. Destroyed, only rags hang from the rail.
  - Once the sweep has passed, an open wardrobe shows clothes on the rail, a hat box and shoes, instead of the nest.
- **Dressing table:**
  - A kidney top with a gathered, pleated skirt, and a three-fold mirror (an arched centre and two wings, the silvering gone at the edges when dirty).
  - A ring of 15 round bulbs that light in order, 0.12 s apart, at the `lights` beat.
  - Perfume bottles, a hairbrush, a jewellery box and a stool.
- **Wedding photograph (story):** in a silver frame. Dirty, it lies face down. At the `photo` beat it stands up, hinged at its foot, showing a black-and-white couple — him in a dark suit, her in a white dress and veil — and "Arthur & Eleanor / 1968" on the mount.
- **Radio:** a two-tone 1960s cabinet with a speaker grille and a dial window. Dirty, the dial flickers. At the `radio` beat it glows steadily, and the radio gets a small warm light of its own.
- **Lamps:** two lamps with pleated shades. The left one works dimly and stutters; the right one is dead until the sweep passes it.
- **Hat boxes:** round striped boxes with lids. Dirty, one lies on its side on the floor by the dressing table, its lid rolled away. Clean, there are three on the shelf.
- **Dirty → clean:**
  - dust sheet → made bed;
  - cracked wardrobe mirrors → whole;
  - fallen hat box → on the shelf;
  - torn wallpaper and curtain → whole;
  - clothes strewn on the chest → folded;
  - dead right lamp → lit;
  - nest → tidy wardrobe.
- **Trace of the previous cleaner:** a sleeping bag rolled out on the rug in front of the bed, with a jumper for a pillow and a wind-up alarm clock beside it. Clean: the bag is rolled and tied at the door end of the room, and the clock is on the chest.

### Critique rounds (5 biggest gaps per round, written in the room's NOTES.md)

1. **Round 1:** the lace light read as blurred blobs; the nest was a dark box with a few strands; the cleaned wardrobe still showed the nest; the photo's inscription was cut off; and a stray dark bar sat top left.
2. **Round 2:** the nest was still not pale enough to read; the right side of the room was unreadable when dirty; the headboard read as a tall cabinet; the burst clusters showed as green ovals; and the fallen hat box was missing.
3. **Round 3:** the chest of drawers is still dark in the dirty room. Moonlight from the mirror now catches it, and it is kept dark on purpose. No other gap is big enough to list.

### [LOGIC] touched while painting

- `room.js` records where the quilt is dented (`quiltDentX = hero.x` on a bounce).
- `room-runtime.js`: `completeGoal()` starts the makeover only while the room is `playing`. Before, a goal completed from a QA state or during the makeover could have restarted it.

## Checks (Claude Code, after the painting)

- **Play-through, headless (`?qa=1&room=master-bedroom`, driven step by step), all as specified:**
  - The bounce sends the hero up at −901 px/s with jump not held (0.85 × 1060), and the dent is recorded.
  - The doors open to 1 at the first burst, and 3 hatchlings come out.
  - With every spider and web done but the nest, the room stays `playing` and the card reads 67 %.
  - Eight darts fired with the mouse into the open doorway destroy the nest: +500, the goal is done, and the card's box becomes a tick.
- **The makeover beats** are `lights` 3.3 s, `photo` 3.9 s and `radio` 4.3 s.
- **No console errors** in `dirty`, `action`, `nest`, `makeover`, `clean` or `results`.
- **Frame time:** `action` mean **3.20 ms**, p95 **4.70 ms**; `makeover` mean **1.76 ms**, p95 **2.60 ms**. The budget is 8 ms.
- **The extra-goals change, regression:**
  - `regress.mjs`: the Living Room canvas is identical to the reference in every state.
  - `checks.mjs`: all pass.
  - `flowtest.mjs`: all pass, 89 checks over nine rooms, including the master bedroom's map entry, real-time spawns, makeover and results card.
  - One `flowtest` run failed once on the Dining Room's "spiders come" timing while two other browser jobs ran beside it. Run on its own, it passes.
- **Audit:** clean.

**Claude Code review:** approved. The lace light reads at once as the room's look. The nest is unmistakable and visibly tears. The wedding photo lands as the story. The extra goal works end to end.
