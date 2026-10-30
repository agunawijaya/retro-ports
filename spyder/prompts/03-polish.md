# Prompt 03 — Polish pass (eggs, makeover sweep, Kitchen light, Jumper leap, map, runtime requests)

You are working on the Spyder web game in `E:\Projects\retro-ports\spyder`. Prompts 00–02 are done: the shell, the Front Porch and the Kitchen exist in `game/` and passed their own QA. The architect reviewed every hero frame. This prompt fixes the six findings of that review. **Runs alone.**

Work efficiently: render only the states a change affects, fix, check once more, move on. Do not re-run QA on things this prompt does not touch.

## Read first

1. `ART-DIRECTION.md` (§3 palette, §6 pipeline and the no-per-frame-blur rule, §7 spiders, §10 makeover).
2. `game/NOTES.md`, especially the table "What both rooms asked of the runtime".
3. `game/lib/room-runtime.js` (`drawBlended`, `drawSweep`, the makeover light), `game/lib/spiders.js` (`EggSac`, `Hatchling`, `hatch`), `game/lib/spider-types/jumper.js`, `game/lib/house-map.js`, `game/rooms/kitchen/room.js` (its `lights()` and wall painting).

## Rules

- Plain scripts, global `Spyder`, opens from disk, no network, no frameworks. Humanized code, seeded randomness.
- **No `ctx.filter` blur in per-frame code.** Soft edges come from gradients and stacked shapes.
- `reference/` may be changed **only** for fixes 1 and 2 below, so the reference stays the true quality bar (see "Reference sync").
- No git commits.

## Fix 1 — Egg sacs and hatching (the weakest asset in the game)

Today an egg sac is a smooth pale disc with three dots: it reads as a button or a biscuit. Hatchlings come out stacked on top of each other, or abseil in a perfect identical row.

Redraw `EggSac.draw` (and the hatch moment) so an egg sac reads instantly as **spun silk full of eggs**:

| Aspect | Spec |
|---|---|
| Shape | A lumpy teardrop, about 24 × 30 at rest, its outline wobbled with noise (`S.paint.wobblyPath` geometry, but drawn per frame without blur). Wall and ceiling eggs are pointed toward their attachment. Resting floor eggs flatten about 15 % and get a contact shadow. |
| Silk | Body filled with a soft radial gradient from `bone` to `eggSac` to a darker rim. Over it, 10–14 thin crossing silk strands (curves wrapping round the sac, alpha 0.35–0.6), plus a few loose fibres sticking out of the outline. |
| Attachment | Wall and ceiling eggs: a short silk tuft or stalk to the surface. Falling eggs: a broken thread fragment trailing above them. |
| Eggs inside | Slight translucency: a cluster of 12–20 small round eggs (radius 2–3 px), visible faintly through the silk. They darken and move as hatching gets close. **Never three big dots.** |
| Before hatching | Over the last 40 % of its life the sac pulses faster, bulges on one side, and the silk thins (strands fade, the eggs show more). In the last 0.6 s a tear opens at the top. |
| Hatch | The sac splits into a torn husk (two flaps of silk) that stays 2 s and fades. Fibres burst out. |
| Hatchlings | Count and speed come from the room (see fix 6, `hatch({ count, speed })`, default count 4). They **emerge one by one** (0.1–0.18 s apart, seeded jitter) from the tear and **scatter**: each picks its own heading and speed (±35 %), so they never move as a block. Wall eggs: each hatchling abseils on **its own thread** with a different x offset (±40 px), length and start time. |

Render the egg life cycle as a strip (fresh on the floor → about to hatch → torn open with hatchlings scattering → wall egg with hatchlings abseiling) at 2× zoom to check readability.

## Fix 2 — The makeover sweep

Two problems, both also present in the reference:

1. **Clean props appear ahead of the wave.** `drawBlended` draws the whole clean layer and then the dirty layer on top, so wherever the dirty layer is transparent (fresh flowers versus dead stems, lit windows versus dark ones), the clean version shows through before the sweep has reached it.
2. **A hard vertical seam** at the leading edge (the moving light quad and the bright band have a sharp right edge).

Fix:

- **Masked blend.** For each layer while the sweep runs: draw the clean layer masked to the left of the edge, and the dirty layer masked to the right, with complementary soft masks (a horizontal linear gradient, feather 280 px, smoothstep-shaped). Use two reusable offscreen canvases (`globalCompositeOperation = 'destination-in'` with the gradient), created once and reused every frame. Before and after the sweep, draw a single layer as today. Nothing clean may be visible to the right of the feather.
- **Soft leading edge.** The bright band becomes a wide, soft swell: about 520 px wide, peak alpha about 0.32, eased in and out (no visible edge on either side). The light the wave carries in the light map uses nested quads or a horizontal gradient so it has no hard border.

Check: render each room's makeover at t = 0.9 s, 1.3 s and 1.7 s and look along the wave front. No seam, no clean prop ahead of the wave.

## Fix 3 — Kitchen: the colour band right of the fridge

In the Kitchen's dirty state, a hue band runs down the wall just right of the fridge (orange to green to blue), where the fridge's cold light meets the pendant's warm cone. With the olive wall paint, the whole right half reads sickly green rather than warm.

Find the cause in `rooms/kitchen/room.js` (the fridge light's colour, intensity and spread, the overlap of the two cones, the wall's base colour) and fix it so that:

- the **fridge light is cold only where it should be**: on the floor wedge and the fridge door edge, with a soft falloff. It must not paint a coloured stripe on the wall.
- the **wall under the pendant reads warm amber**, not olive. Shift the wainscot paint toward a muted sage (mix `moss` with `taupe`) if needed.
- no visible hue band anywhere in the dirty or makeover frames.

## Fix 4 — The Jumper must read as a leap

In the `jumper` hero frame, the Jumper at the top of its arc looks like any spider on the wall. Make the leap unmistakable:

| Moment | Spec |
|---|---|
| Crouch (telegraph) | Keep the existing squash and dust. Add a faint dotted arc of the predicted path (chalk-like dots, `bone` at alpha 0.25, fading toward the end) for the crouch duration, so the player can read where it will land. |
| In the air | All eight legs splayed fully outward, symmetric, tips slightly curled. Body stretched about 10 % along the direction of travel. **Three ghost silhouettes** behind it along the arc (alpha 0.22, 0.13, 0.06). A soft **shadow ellipse on the surface below**, shrinking and fading with height. |
| Landing | Keep the existing landing. |

Re-render the `jumper` hero frame: the Jumper mid-arc above the table, hero below aiming at it.

## Fix 5 — House map details

- A cleared room with a best score of 0 shows "cleared" instead of "best 0". In normal play the best is never 0; this only shows up in QA saves, but it must not look broken.
- The CLEAN stamp must never overlap a room's label or its best-score line. Place it in the emptiest corner of the room outline (check bounding boxes; the Front Porch is the tight case).

## Fix 6 — Runtime requests from the rooms

Implement the requests listed in `game/NOTES.md` ("What both rooms asked of the runtime"), except the makeover blend (that is fix 2):

1. Room-scripted spawns accept `opts.seed`, or every spawn gets a unique counter-based seed.
2. `hatch()` takes `{ count, speed }` (used by fix 1).
3. `mk.t` keeps running after the results card, so late unique beats can be timed.
4. Rooms paint their layers only after `document.fonts.ready`.
5. QA staging: put the hero on a named platform; set the score plate from the room's own state.
6. `glow()` receives the far layer's parallax offset.
7. A sanctioned place for a room's own CSS (for example `rooms/<id>/room.css`, loaded by the registry).
8. Per-leg options on the rig (reach and femur thickness multipliers per leg pair), so `jumper.js` stops copying the rig's private leg table. Change `jumper.js` to use them, with no visual change to the Jumper's resting look.

Then remove the matching workarounds from the room files where it is simple and safe. Note what you removed.

## Reference sync (fixes 1 and 2 only)

Port the egg/hatch redesign and the masked blend with soft edge into `reference/lib/` and `reference/scene.js`, changing nothing else there. Re-render `reference/screens/` with `reference/tools/shoot.mjs` and save them as JPEG (quality about 90) under the **same file names** (`title.jpg`, `dirty.jpg`, `action.jpg`, `makeover.jpg`, `clean.jpg`, `results.jpg`), replacing the old ones. Only `makeover.jpg` (and `action.jpg` if an egg is visible) should look different. Confirm that with a quick side-by-side and note it.

## Checks before you stop

1. `game/tools/regress.mjs`: the Living Room still matches the reference, except where fixes 1 and 2 intentionally changed it. Explain any difference.
2. `game/tools/flowtest.mjs` and `game/tools/checks.mjs` pass. Extend them where fixes 5 and 6 add behaviour.
3. `game/tools/perf.mjs`: still within budget during a makeover (the masked blend is the new cost; report mean and 95th percentile).
4. No console errors in any room.

## Deliverable for the architect: ONE review sheet — then STOP

Create **one** JPEG, `game/tools/out/review/03-polish.jpg`, 1920 px wide, a 2-column grid of 960 × 540 cells, quality about 80, in this order:

1. Egg life-cycle strip (the 2× zoom strip from fix 1, fitted into one cell)
2. Living Room makeover at t = 1.3 s
3. Front Porch makeover at t = 1.3 s
4. Kitchen dirty
5. Kitchen `jumper` hero frame
6. House map with all three rooms cleared, one of them with best 0

Append a section **"Prompt 03 — polish (date)"** to `game/NOTES.md`: what changed per fix, which workarounds were removed, the check results (counts and perf numbers), and anything you could not do. Keep it short.

Then stop. Do not start another room.
