# Prompt 16 — Room 12: The Attic and the Spider Queen

## Who did what (`prompts/16-attic.md`)
- **Gemini (Flash)**: Implemented all **[LOGIC]** requirements, built geometric blockouts in the palette tagged with `// ART: blockout - <item>` for all **[ART]** items, updated room registry next-room resolution for Act 4 secret rooms, and verified all test suites (`checks.mjs`, `flowtest.mjs`, `regress.mjs`, `perf.mjs`, `review.mjs audit`). Did not make the review sheet.
- **Claude Code (Opus)**: Left to paint finished **[ART]** and generate the review sheet (`sheet.jpg`).

---

## What was built

### 1. Platform Topology & Room Geometry
Built Room 12 in `game/rooms/attic/room.js` (registered as `attic`, act 3, room number 12):
- **Roof:** Pitched ceiling with ridge at (960, 60), sloping down to eaves at y 520 (x 0 and 1920), rafters spaced every 220 px.
- **8 Platforms (all verified within jump reach: rise ≤ 190 px, gap ≤ 160 px):**
  1. Floor (y 935)
  2. Lower trunk (x 190–450, y 830, rise 105 px from floor)
  3. Upper trunk (x 220–420, y 700, rise 130 px from lower trunk)
  4. Box stack (x 470–560, y 560, rise 140 px, gap 50 px from upper trunk)
  5. Collar beam (x 520–1400, y 430, rise 130 px from box stack)
  6. Rocking horse (x 1490–1690, y 790, rise 145 px from floor)
  7. Lower crate (x 1300–1400, y 650, rise 140 px, gap 90 px from rocking horse)
  8. Upper crate (x 1320–1400, y 520, rise 130 px from lower crate, rise 90 px to collar beam)
- **Breakables:** Lower trunk crate (`flamethrower` drop at y 830) and collar beam crate (`sonic` pulse drop at y 430).
- **Webs:** 10 web surfaces (exceeding ≥ 8 required) across rafters, bulb cord, boarded window edges, trunks, rocking horse, entry hatch, collar beam, and gable corners.
- **Makeover Beats:** Custom timeline with `window` at 3.3 s, `bulb` at 4.0 s, and `sheets` at 4.4 s.
- **Story Object:** *"In the nest, an old torch. Engraved on it: 'A. Ashworth'. She was the one who tried before you."* (Visible in nest wall dirty, dropped on defeat, placed on upper trunk clean).

### 2. The Spider Queen Boss (`game/lib/bosses/spider-queen.js`)
Registered via `S.bosses.register` with 60 HP and 3 phases:
- **Nest Phase (100–66% HP):**
  - Stays inside the silk funnel; only head and front legs emerge.
  - Lunges forward every 3 s (0.5 s telegraph with legs spread wide).
  - Spits an egg sac every 6 s landing on the floor (hatches in 4 s).
  - Takes damage only during lunges, or when the Web-Cutter slices through the funnel (1 damage per blade). Regular spiders spawn at a low rate.
- **Descend Phase (66–33% HP):**
  - Drops from the nest on a thick silk line and swings across x 500–1420 (pendulum period 4 s).
  - Lays 3 wall eggs per pass as she nears the gables.
  - Silk line can be severed with the Web-Cutter (or 6 dart hits), dropping her to the floor stunned for 3 s taking double damage (2× multiplier). Afterwards she climbs back up and re-attaches.
- **Rage Phase (33–0% HP):**
  - Walks the rafters and collar beam with a heavy slow gait (0.28 s per step, light camera shake).
  - Leaps at the hero with a 0.8 s crouch telegraph.
  - Summons 4 hatchlings every 8 s.
  - Foam slows her 30% (`speedMult = 0.7`, vs 50% default). Contact or landed leap inflicts 20 damage.
- **Hit Detection & Defeat:**
  - `hitTest(x, y, r)` identifies hit zones: leg hits do 0 damage (`hit` returns false); head and abdomen take full damage; silk line acts as separate target.
  - Defeat curls the Queen, falls to the floor, collapses the silk funnel, drops the old torch, and sets `done = true` after completion.

---

## Left for ART

All [ART] items currently run as geometric blockouts in `game/rooms/attic/art.js` and `game/lib/bosses/spider-queen.js`, tagged with `// ART: blockout - <item>`. They await final painting by Claude Code (Opus):

1. **Roof & rafters (`// ART: blockout - Pitched roof and rafters`):**
   - Current: Solid pitch ceiling polygon (taupe/umber) with simple rectangular rafters every 220 px from ridge (960, 60) down to eaves (y 520) and floor line (y 770).
   - Left for ART: Rough timber texture with grain, nail heads, boards between rafters, insulation tufts, slope darkening toward eaves.
2. **Round window (`// ART: blockout - Round window`):**
   - Current: Circular gable window at (960, 250) r=110 with 3 horizontal plank rectangles and moonlight slit rectangles; clean: open disc.
   - Left for ART: Boarded uneven planks with authentic moonlight blades leaking through gaps; clean: morning light shaft projecting into the room.
3. **The Queen's nest (`// ART: blockout - The Queen's nest`):**
   - Current: Trapezoidal translucent silk funnel from ridge (960, 60) to y 380, x 780–1140, with an elliptical mouth ring.
   - Left for ART: Layered translucent silk sheets denser toward the core, egg clusters glimmering inside, backlit by the window's light.
4. **Hanging bulb (`// ART: blockout - Hanging bulb`):**
   - Current: Line cord from (700, 100) to bulb at y 330 with socket block and amber circle that sways dirty / steadies clean.
   - Left for ART: Realistic bare vintage bulb on twisted fabric cord, filament glow, lighting the nest's underside.
5. **Trunks and crates (`// ART: blockout - Trunks and crates`):**
   - Current: Solid rectangular boxes at x 190–450 y 830, x 220–420 y 700, x 470–560 y 560, and right crates x 1300–1400 y 650, x 1320–1400 y 520.
   - Left for ART: Leather-bound trunks with brass corner protectors, travel labels from invented places, weathered crate wood.
6. **Rocking horse (`// ART: blockout - Rocking horse under dust sheet`):**
   - Current: Sheet polygon over horse dirty; clean: block horse body and curved stroke rockers.
   - Left for ART: Dapple-grey painted horse, subtle ear showing under draped cloth dirty; clean: gently rocking dapple-grey finish.
7. **Floor and hatch (`// ART: blockout - Floor and hatch`):**
   - Current: Horizontal floor band at y 770–1080 with joist line ticks; rectangular hatch at x 1760–1880 with two yellow ladder rungs.
   - Left for ART: Rough floorboards with exposed insulation between joists near edges, dark entry hatch recess with ladder perspective.
8. **Collar beam (`// ART: blockout - Collar beam`):**
   - Current: Rectangular beam platform x 520–1400 at y 430, height 26.
   - Left for ART: Heavy wooden structural collar beam with joist joinery and aged surface.
9. **Dirty → clean transitions (`// ART: blockout - Dirty to clean transitions`):**
   - Current: Boarded window -> open; dust sheets -> removed; webs -> removed; fallen box -> upright red box with gold cross and tinsel square.
   - Left for ART: Detailed fallen holiday decoration box with spilled tinsel glinting in the morning light.
10. **Trace of the previous cleaner / Story torch (`// ART: blockout - Trace of the previous cleaner (torch)`):**
    - Current: Brass cylinder at (960, 320) dirty, floor defeat, (300, 690) clean with line indicator for engraving.
    - Left for ART: Weathered metallic flashlight glinting in the silk wall, dropped on floor upon defeat, resting on trunk with legible 'A. Ashworth' engraving in 2× zoom.
11. **Spider Queen look on rig (`// ART: blockout - Spider Queen`):**
    - Current: Scaled `SpiderRig` (scale 2.4) with pale chevron crown blockout on abdomen and thick stroke silk line.
    - Left for ART: Glossy black-plum chitin with deep sheen, ivory chevron ring, 8 red-amber glinting eyes, hairy leg bristles (every 10 px), mandibles opening on lunges, huge cast shadow on roof, and phase damage visuals (abdomen tear at 66%, broken leg at 33%).

---

## Changes Under `game/lib/`

1. **`game/lib/bosses/spider-queen.js`:**
   - Created and registered the Spider Queen boss adhering to the boss framework.
2. **`game/lib/room-registry.js`:**
   - Updated `after(id)` to:
     ```javascript
     function after(id) {
       const i = HOUSE.findIndex((h) => h.id === id);
       if (i < 0) return null;
       return HOUSE.slice(i + 1).find((h) => !h.secret) || HOUSE[i + 1] || null;
     }
     ```
   - *Rationale:* Since all rooms following Room 12 Attic are Act 4 secret rooms (Basement, Greenhouse, The Wall), `HOUSE[i + 1]` fallback allows the results card to identify Room 13 Basement as the next unbuilt room on the house plan ("next on the plan: the Basement — not built yet").
3. **`game/index.html`:**
   - Added script tags for `lib/bosses/spider-queen.js` and `rooms/attic/room.js`.
4. **`game/tools/checks.mjs`:**
   - Added test suite for Attic and Spider Queen boss mechanics.
   - Updated stand-in room test in checks to use Room 13 (`basement`) instead of `attic`.
5. **`game/tools/perf.mjs` & `game/tools/shoot.mjs`:**
   - Supported `--state=` in `perf.mjs`.
   - Injected `#hud { transition: none !important; }` and warm-up screenshot in `shoot.mjs` to resolve the headless HUD transition trap.

---

## Verification & Check Counts

- **`node game/tools/checks.mjs`:** PASS (100% — all checks passed).
- **`node game/tools/flowtest.mjs .scratch/flow`:** PASS (101 / 101 checks passed across normal storage and blocked storage loops).
- **`node game/tools/regress.mjs .scratch/regress`:** PASS (REGRESSION: canvas identical to reference in every state).
- **Console Errors:** 0 page errors across tests and hero capture.
- **Performance (`node game/tools/perf.mjs`):**
  - `queen-rage`: 268 frames in 4 s · mean **2.06 ms** · median 2.00 ms · p95 **3.40 ms** (GPU canvas: ANGLE Direct3D11)
  - `attic-makeover`: 521 frames in 4 s · mean **0.99 ms** · median 0.90 ms · p95 **1.90 ms**
  - `attic-action`: 261 frames in 4 s · mean **2.32 ms** · median 2.30 ms · p95 **3.70 ms**
  - `--makeover-spike --room=attic`: worst frame **7.80 ms** at t = 5.23 s, mean 1.53 ms (well below 16 ms target).
- **Hero Shots (`node game/tools/shoot.mjs --hero --room=attic`):**
  - Saved: `dirty`, `action`, `makeover`, `clean`, `results`, `queen-nest`, `queen-swing`, `queen-rage`.
- **Audit (`node game/tools/review.mjs audit`):** Clean.

---

## [ART] painted by Claude Code (after the Flash logic run)

*Who did what (`briefs/16-attic.md`):*
- *Argon refused on quota.*
- ***Gemini 3.8 Flash** built the [LOGIC]: L1, L2, the Queen's three phases, the QA states and the checks.*
- ***Opus** painted A1 and A2, decided the review's gameplay questions, and wrote the phase notes. The sections above were written by Flash and describe its run only; where they disagree with this section, this section is current.*
- ***engineer** reversed the secret-room spoiler and added the glue the art needed.*
- ***qa-scout** read Flash's result, took the hero shots, made the sheet and ran the checks.*

**A1, the room.** We stand inside the roof facing the far gable.
- **The near roof** slopes overhead in one-point perspective. Board seams run to the vanishing point, rafters run parallel to the gable's edge and thicken as they come closer, and fibrous insulation is packed in near the eaves.
- **The gable** is uneven vertical boards with knots and nail rows, and four studs. Damp streaks run down from the window the storm broke.
- **The window:** a timber ring round a hole cut through to a live sky.
- **Moonlight** comes in as five thin blades through the gaps between three planks. At `boards` the planks come away one by one, top first; a round shaft of morning follows.
- **The nest:** 24 translucent sheets with lit hems, egg clusters under them, skirts tied to the rafters, and a dark throat with a torn lip. It tears in two and sags away when the Queen dies.
- **The torch:** a faint glint in the nest's wall, then falling, then on the floor. Once the sheets are off it lies on the upper trunk, with "A. Ashworth" engraved.
- **Furniture:** leather and canvas trunks with brass corners and labels from invented places (Castelmar, S.S. Wanderly, Hotel Orsino, Kestrel Bay, Linea Alba). Labelled boxes, stencilled crates. A dapple-grey rocking horse under a sheet with its ear poking through; uncovered at `sheets`, it rocks once. A tipped box of Christmas baubles stands up clean, with tinsel glinting.
- **Light sources:** the bulb (flickers and sways while dirty, steadies at `bulb`), the window, and warm light up through the hatch.

**A2, the Queen** (`QueenRig` in `spider-queen.js`: the same rig, her own finish).
- **Silhouette:** scale 2.4 and a crown — a ring of ten ivory chevrons round a pale diamond.
- **Finish:** black-plum gloss; bristles every 10 px on thickened legs; a sheen rim drawn after lighting so she reads in the dark; red-amber eyes; mandibles that open on lunges.
- **Gait:** a 0.28 s step.
- **Telegraph:** her front legs spread wide before a lunge.
- **Phase marks:** a tear across the crown at 66 %, and a splintered stump on the right front leg at 33 %.
- **Her line:** thick and pale with a dark edge, so it reads across the silk.
- **Her shadow:** drawn from her rig and thrown from the bulb up the gable and roof.

**Decided in review (Opus):**
- **The secret rooms.** Flash had the Attic's results card name the Basement, a secret room. Reversed: the card names no next room until one is found.
- **The phase notes,** written in A.'s voice. **For the architect to approve**, since they are not in `STORY.md`:
  - "She's coming down." (descend)
  - "She's angry now." (rage)
- **The `queen-nest` QA state** now stages the lunge's peak.

### [LOGIC] fixed in review

- **`engineer`:**
  - `after(id, progress)` in `room-registry.js`, with two new checks;
  - `live.world = world` in the Attic's `onStart`;
  - the beat `window` renamed `boards`, because its key collided with the shared dawn `mk.window`.
- **Opus, in `QueenRig`:**
  - the boss passed `world.gameTime`, which does not exist, so her dangling legs went to NaN; the rig keeps its own clock;
  - `spread` was read before it was set, which planted her feet at NaN.

### Checks (after the painting)

- **`checks.mjs`:** all checks passed (119).
- **`regress.mjs`:** "canvas identical to the reference in every state".
- **`flowtest.mjs`:** it failed three times on "attic: runs in real time and spiders come", at t 2.0–2.5 s against a threshold of 2.5.
  - **The cause:** the Attic's static paint used blurred inner shadows and rims on huge shapes, such as rafters about 1500 px long. The GPU pays for those on the room's first frames, and the stall ran past the test's settle time.
  - **The fix:** the blur was taken off the large flat shapes (lit and shadowed edges are drawn instead).
  - **After it:** two runs in a row, all checks passed (attic t 3.2 s and 3.3 s).
- **Frame time:**
  - `queen-rage`: mean 4.26 ms, p95 6.20 ms.
  - `attic-action`: mean 4.34 ms, p95 5.70 ms.
  - `attic-makeover`: mean 2.25 ms, p95 4.50 ms.
  - Worst makeover frame: 13.80 ms.
  - Measured before the blur change, which affects only the static layers painted at load.
- **A measurement trap, recorded so nobody repeats it:** a synchronous loop of 300 `step()` calls showed 1–2 s "frames" in the Attic and in the approved Kitchen alike — the GPU queue filling without a yield. Yielding to rAF each frame, every Queen state costs 1.8–2.3 ms.
- **`review.mjs audit`:** clean; `.scratch/` emptied.

**Claude Code review:** approved. It reads as the house's attic, the darkest and most crowded room, with the Queen's nest as its centrepiece. Each phase of the fight is legible in a still: the lunge out of the funnel, the swing on a line worth cutting, the leap from the beam. The morning that comes through the round window at the end is the payoff of the act.
