# Room 8: Master Bedroom — Implementation Notes

## Architecture & Responsibilities
- **Model Policy & Role Separation:**
  - Logic ([LOGIC]) implemented in `game/rooms/master-bedroom/room.js`.
  - Geometric blockouts ([ART]) implemented in `game/rooms/master-bedroom/art.js` using game palette colors at exact prompt coordinates and dimensions. Finished painting left for the ART pass.
  - Shared work-order extra goals (L3) implemented in `game/lib/room-runtime.js` and `game/lib/hud.js`.
- **Two-File Room Form:**
  - `master-bedroom/room.js` registers Room 8 (`art: true`).
  - `master-bedroom/art.js` attaches via `Spyder.rooms.attachArt('master-bedroom', ...)`.
  - Added single `<script src="rooms/master-bedroom/room.js"></script>` in `game/index.html`.

## Design Decisions
1. **Bouncy Bed Mechanics (L2):**
   - Landing on mattress (`platform.name === 'mattress'`) with downward speed `prevHeroVy > 300` triggers a vertical bounce.
   - Jump speed is scaled by 1.35x when jump is held on landing (or jump buffer is active), enabling reach up to the hat-box shelf at y 520 (260 px above mattress). When jump is not held, a smaller bounce (0.85x) is performed.
   - Springs creak sound (`creak`, 0.8) plays, and quilt dent animates (`live.quiltDent`) and recovers.
2. **Wardrobe Nest Mechanics (L2):**
   - Inside the wardrobe (x 120–380, y 260–850) is a thick sheet of web with egg clusters taking 8 hits to destroy.
   - Every 10 s (8 s after first spider kill), doors creak open for 2.5 s and 2–3 hatchlings tumble out.
   - While doors are open, darts entering the doorway (x 140–360, y 280–830) hit the nest, tear it visibly (`live.nestTorn = live.nestHits / 8`), and are consumed.
   - Upon the 8th hit, the nest is destroyed: awards +500 "Nest!", marks extraGoal 'nest' complete via `world.completeGoal('nest')`, the doors swing open and stay still, and no more spawns emerge.
3. **Extra Goals on Work Order (L3):**
   - Supported `rules.extraGoals: [{ id, label }]` in `room-runtime.js` and `hud.js`.
   - `world.completeGoal(id)` marks goals complete and checks room completion.
   - `cleanFraction()` counts each extra goal as one equal share alongside spiders and webs: `(kills/quota + silk/webGoal + completedGoals) / (2 + extraGoals.length)`.
   - Work order card dynamically appends a line per extra goal with a hand-drawn tick (`✓`) or an empty box (`class="work-order__goal-box"`).
   - Zero regression on existing rooms (`regress.mjs` identical for Living Room).
4. **Procedural Radio Song (L4):**
   - Implemented original 16-bar waltz in 3/4 time synthesized with Web Audio.
   - Dirty state: bandpass-filtered noise hiss (1400 Hz) with low volume.
   - Makeover beat `radio` (at 4.3 s): static clears, and a warm triangle melody over a two-chord pad (Cmaj7 / Am7) plays through a vintage radio filter, fading to a gentle ambient pad loop.
5. **QA Staging (L2):**
   - Added standard states: `dirty`, `action`, `makeover` (t ≈ 3.9 s), `clean`, `results`.
   - Added custom state `nest`: wardrobe doors open mid-burst, nest half-torn (4 hits), two hatchlings tumbling out, hero mid-bounce above the bed (y 620, vy -600) aiming at the wardrobe.

## Blockout Items Left for ART
All [ART] items currently use geometric blockout shapes in palette colors and are tagged with `// ART: blockout - <item>`:
1. Wallpaper (faded rose-and-trellis pattern over warm taupe, picture rail at y 170, dirty tear and water stains)
2. Lace curtains (lace pattern of light casting shadows across the bed and wall)
3. Bed (carved headboard/footboard, quilted patchwork squares with denting, pillows, dirty dust sheet / clean nightgown)
4. Wardrobe (tall dark wood, carved cornice, two mirrored doors with brass key, inner nest sheet with egg clusters)
5. Dressing table (kidney-shaped table with skirt, three-fold mirror, vanity bulbs, perfume bottles, hairbrush, jewellery box)
6. Wedding photo (silver frame, dirty face down cracked / clean standing couple Arthur & Eleanor 1968)
7. Radio (1960s tabletop radio with glowing dial)
8. Lamps (left nightstand dim lamp, right nightstand dead dirty / lit clean lamp)
9. Hat boxes (round striped boxes on shelf, fallen box dirty / on shelf clean)
10. Dirty to clean differences (dust sheet -> made bed; cracked mirrors -> whole; fallen hat box -> shelf; torn wallpaper -> whole; clothes on chest -> folded; right lamp -> lit)
11. Trace of previous cleaner (sleeping bag rolled out with alarm clock -> rolled up & tied with clock on chest)


## Art (2026-10-29, Claude Code)

`art.js` was repainted over Flash's blockout. See `review/prompts/10-master-bedroom/summary.md` for each item.

### Critique rounds (5 biggest gaps per round)

**Round 1:**
1. The lace light was rows of blurred rosettes that read as smudges. It is now a bright pool with the lace cut out of it as shadow: net, flowers, scallops and glazing bars.
2. The nest was a dark interior with a few strands.
3. After the makeover, an open wardrobe still showed the nest. It now shows clothes once the sweep has passed.
4. "Arthur & Eleanor, 1968" was cut off by the frame. It now sits on two lines in a taller frame.
5. A blurred bedpost in the front layer showed as a dark bar top left. It was removed.

**Round 2:**
1. The nest was still too dark to read. It now has a sheet of its own at 0.9 alpha, ragged slits instead of diamond holes, clusters drawn over the tears, and a stronger light.
2. The right side was unreadable when dirty. Moonlight caught in the mirror now reaches the chest.
3. The headboard read as a tall cabinet. It now has a thinner, darker back post and a carved crest, so it reads at an angle.
4. Burst clusters showed as green ovals. They are now faint smears and empty shells.
5. The fallen hat box was missing. It now lies by the dressing table with its lid.

**Round 3:**
1. The chest of drawers is still dark in the dirty room. That is accepted.
2. There was nothing else worth a round.

### Traps for whoever touches it next

- **What the art reads from `live`:** `doorsOpen`, `nestTorn` (or `nestHits / 8`), `nestDestroyed`, `quiltDent` and `quiltDentX`. They are read in one place, `nestState()` and `bedDent()` at the top of `art.js`, so a rename is one edit.
- **The nest sprite is cached per tear step** (`nest0` … `nest8`, and `nest9` for destroyed). A change to how it tears means clearing `live.sprites`.
- **Wardrobe doors and the clean state:** the closed doors are painted on the furniture layer, and the open ones are drawn over them live. In the QA `clean` state the nest was never destroyed, so the doors are shut and the whole mirrors show. In real play they stay open after the nest goes, and show the tidy wardrobe.
- **The lace light is two cached canvases at half resolution** (`LACE_BOX`) added into the light map. Moving the window means moving `LACE_BOX` with it.
