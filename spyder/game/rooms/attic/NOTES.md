# Room 12: The Attic & Spider Queen — Implementation Notes

## Architecture & Layout Decisions

### 1. Platform Topology & Reach Verification
All platform heights and gaps adhere strictly to the reach rule (rise ≤ 190 px, gap ≤ 160 px):
- **Floor:** y 935
- **Lower trunk:** x 190–450, y 830 (from floor: rise 105 px)
- **Upper trunk:** x 220–420, y 700 (from lower trunk: rise 130 px, within trunk footprint)
- **Box stack:** x 470–560, y 560 (from upper trunk: rise 140 px, gap 50 px)
- **Collar beam:** x 520–1400, y 430 (from box stack: rise 130 px, overlapping horizontally)
- **Rocking horse:** x 1490–1690, y 790 (from floor: rise 145 px)
- **Lower crate:** x 1300–1400, y 650 (from rocking horse: rise 140 px, gap 90 px)
- **Upper crate:** x 1320–1400, y 520 (from lower crate: rise 130 px)
- **Collar beam (right approach):** y 430 (from upper crate: rise 90 px, overlapping horizontally)

### 2. Webs & Breakables
- **Webs (10 total, ≥ 8 required):**
  1. Left rafter eave: (140, 500) to (360, 400)
  2. Right rafter eave: (1560, 400) to (1800, 500)
  3. Bulb cord & ceiling: (660, 100) to (740, 310)
  4. Boarded round window gable: (870, 160) to (1050, 340)
  5. Lower/upper trunk stack: (190, 710) to (340, 840)
  6. Rocking horse dust sheet: (1520, 750) to (1670, 860)
  7. Entry hatch & ladder top: (1740, 920) to (1880, 970)
  8. Left collar beam junction: (520, 420) to (680, 560)
  9. Right collar beam junction: (1280, 420) to (1400, 540)
  10. Central gable under ridge: (860, 80) to (1060, 200)
- **Breakables:**
  - `flamethrower`: Box on the lower trunk at x 320, y 830.
  - `sonic`: Box on the collar beam at x 960, y 430.

### 3. Spider Queen Boss System (`lib/bosses/spider-queen.js`)
- Registered as `'spider-queen'`, health 60.
- Three distinct combat phases:
  - **Nest (100–66%):** She stays in the silk funnel; lunges forward every 3 s (0.5 s telegraph with legs spread wide); spits egg sac to the floor every 6 s (hatches in 4 s). Takes damage only during lunges, or when Web-Cutter tears through the funnel (1 damage per blade). Regular spawns continue at a low rate.
  - **Descend (66–33%):** Drops on a thick silk line swinging across x 500–1420 with a 4 s period, laying 3 wall eggs per pass. Cutting the silk line (Web-Cutter or 6 darts) drops her to the floor, stunned for 3 s taking double damage (2× multiplier). Afterwards climbs back up to re-attach.
  - **Rage (33–0%):** Walks rafters and collar beam with heavy slow gait (step 0.28 s, camera shakes lightly on each step); telegraphed leap (0.8 s crouch) aiming at hero; summons 4 hatchlings every 8 s. Foam slows her 30% (`speedMult = 0.7`).
- **Hit Detection:**
  - `hitTest(x, y, r)` inspects body parts and caches `lastHitZone`.
  - Leg hits do 0 damage (`hit` returns false).
  - Head and abdomen hits register normal damage.
  - Silk line is a separate target in phase 2.
- **Defeat:**
  - Curls, falls to floor, nest collapses, drops old torch, sim runs at 0.4× for 1.2 s.
  - Sets `done = true` after defeat animation completes, fulfilling the goal completion contract.

### 4. Makeover Timeline & Story Object
- Shared beats up to 3.0 s.
- `boards` at 3.3 s (renamed from `window`, which collided with the shared `mk.window` dawn): boards come away from the round window one by one, morning light floods through.
- `bulb` at 4.0 s: Hanging bare bulb steadies.
- `sheets` at 4.4 s: Dust sheets slide off rocking horse and trunks; Christmas decoration box stands upright with glinting tinsel.
- **Story Object:**
  - Description: *"In the nest, an old torch. Engraved on it: 'A. Ashworth'. She was the one who tried before you."*
  - Dirty: Faint brass glint inside the nest wall.
  - Defeat: Dropped onto floor under collapsed nest.
  - Clean: Resting on upper trunk at (300, 690).

---

## Changes Under `game/lib/`

1. **`game/lib/bosses/spider-queen.js`:**
   - Added complete Spider Queen boss implementation conforming to the boss framework.
2. **`game/lib/room-registry.js`:** Flash changed `after(id)` to fall back to `HOUSE[i + 1]`, so the Attic's results card said "next on the plan: the Basement — not built yet". **Reversed in review:** the Basement, Greenhouse and The Wall are secret rooms (`DESIGN.md` §5.2: the Basement opens with the cellar key), and naming one gives it away. `after(id, progress)` now returns the next room that is not secret, or secret and already found; after the Attic, with nothing found, the card names no next room. `checks.mjs` tests both cases (`engineer`, `briefs/16-fix-secret-next-room.md`).
3. **`game/index.html`:**
   - Added script tags for `lib/bosses/spider-queen.js` and `rooms/attic/room.js`.

---

## Art (painted by Opus after the Flash logic run)

**What the room is, visually.** We stand inside the roof facing the far gable. The near roof slopes overhead in one-point perspective: board seams run to the vanishing point (960, 430), rafters run parallel to the gable's edge and thicken and spread as they come closer, and fibrous insulation is packed between the first rafters near the eaves. The gable is uneven vertical boards with knots and nail rows, four studs (two framing the window, two under the collar beam's ends), damp streaks below the window (the storm of 1976 came in there), and a timber ring round a hole cut through to the sky.

**Drawn live, not painted into the layers.** The sweep reveals the clean layer at 0.6–2.0 s, but the boards come off at 3.3 s, the bulb steadies at 4.0 s and the sheets slide at 4.4 s. So the boards, the dust sheets, the rocking horse (which rocks once when its sheet is gone), the nest and the torch are cached sprites drawn each frame from `mk` and the Queen's state.

- **Moonlight:** five thin blades through the gaps between the planks, slanting down-left, drawn by hand into the light map and the glow pass. The stock `shaft()`/`beam()` widen any quad by tens of pixels, and turned five slits into one cone that read as a lampshade.
- **The nest:** a sprite of 24 translucent sheets with lit hems, 80 strands following the funnel's curve, egg clusters under the sheets, skirts pulled out to the rafters and posts, a dark uneven throat with a torn lip. Its outline is `S.NEST_OUTLINE`, defined in `spider-queen.js`, so what hides her and what is painted are the same shape. When she dies (`boss.nestCollapseT`) the two halves part down the middle and sag away; rags stay on the ridge until the sweep.
- **The torch:** in the nest's wall, faint, under strands; falling with `boss.torchY`; on the floor below; and once the sheets are off, on the upper trunk with "A. Ashworth" engraved (readable in a 2× crop).
- **The Queen's shadow:** drawn small from her rig, flattened, and stretched from the bulb up the gable and roof (the Kid's Bedroom technique), kept inside the bulb's pool so it can be seen.
- **Light sources:** the bulb (flickers and sways while dirty, steadies at `bulb`), the window (moon blades, then a round dawn shaft), and warm light up through the hatch from the hallway.

**The Queen's look (`QueenRig`, in `spider-queen.js`).** The same rig as every spider. Her one silhouette cue is scale 2.4 and a crown: a ring of ten ivory chevrons round a pale diamond. The finish is black-plum gloss with a broad soft highlight, legs with thicker femurs and bristles every 10 px (alternating sides, varied length), a sheen rim drawn after lighting so she reads in the dark corners, red-amber eyes, and hooked mandibles that open on lunges and crouches. Her step is 0.28 s. The 66 % tear breaks the crown ring; at 33 % the right front leg ends in a splintered stump. For the telegraph her front legs reach out 32 % and open wide (`rig.spread`). In the nest she is a dark mass through the silk; only what reaches out of the funnel shows in full.

**Two bugs found while painting.** In `QueenRig`, not in the room:
- **The hang clock:** the boss passed `world.gameTime`, which the world does not have, so dangling legs went to NaN once she hung on her line. The rig keeps its own clock now.
- **The spread value:** `spread` was read by the base constructor before it was set, which planted every foot at NaN.

**Phase notes, in A.'s voice** (not in `STORY.md`; for the architect to approve): "She's coming down." (descend) and "She's angry now." (rage). Flash's lines had exclamation marks.

**QA:** `queen-nest` now stages the lunge's peak (`lungeCycleTimer = 3.15`) so her head is out of the mouth.
