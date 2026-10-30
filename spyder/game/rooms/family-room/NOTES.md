# Room 3: the Family Room

*Prompt 05 (`prompts/05-family-room.md`), built 2026-10-29.*

A 1980s family room: the room where the family gathered to watch television. Darker, warmer, and more intimate than the Living Room. Characterized by tongue-and-groove wood panelling, a brick chimney breast with a hearth slab, a CRT console television hissing with static, venetian blinds casting striped moonlight across the parquet floor, and a warm corduroy recliner.

## Files

| Path | What it is |
|---|---|
| `room.js` | The room: layout, painting, platforms, webs, live props, lights, rules, makeover, QA staging, hooks |
| `NOTES.md` | Architecture, jump reaches, decisions, critique rounds, and runtime requests |
| `../../../review/current/family-room/` | The six hero frames, 1920 × 1080 JPEG: `dirty.jpg`, `action.jpg`, `surge.jpg`, `makeover.jpg`, `clean.jpg`, `results.jpg` |
| `../../../review/prompts/05-family-room/sheet.jpg` | 2-column contact sheet with 6 cells: dirty, surge, action, makeover (t ≈ 3.9 s), clean, results |
| `../../../review/prompts/05-family-room/summary.md` | Build summary and verification report |

One line was added to `game/index.html`: `<script src="rooms/family-room/room.js"></script>` between `living-room` and `kitchen`.

## Layout & Platforms (Stage Units 1920 × 1080)

| Platform | Coordinates | Reach Verification |
|---|---|---|
| **Floor** | y = 935 | Base platform across the room |
| **Armchair** | x 210–420, y = 790 | Rise 145 px from floor (within ≤ 190 px reach) |
| **Mantel** | x 560–880, y = 600 | Rise 190 px from Armchair, horizontal gap 140 px (within ≤ 190 px rise, ≤ 160 px gap) |
| **TV stand shelf** | x 1150–1430, y = 780 | Rise 155 px from floor (within ≤ 190 px reach) |
| **TV top** | x 1170–1410, y = 600 | Rise 180 px from TV stand shelf (within ≤ 190 px reach) |
| **Bookshelf top** | x 1530–1790, y = 430 | Rise 170 px from TV top, horizontal gap 120 px (within ≤ 190 px rise, ≤ 160 px gap; below HUD safe zone y > 300) |

## Lights & Ambiance

1. **TV Static & Surges:** Offscreen noise canvas scaled up with CRT scanlines, barrel distortion, phosphor tint. Pulses cold blue-white light into the room (`moon` + `bone`). Every 3–6 s, a 0.22 s surge boosts intensity 2×, illuminating wall crawlers hiding in high corners while respecting the ambient floor.
2. **Moonlight through Blinds:** 9 parallel soft-edged quads casting diagonal striped moonlight from window (x 150–450, y 170–480) down to floor. Dirty state features two broken slats and a crooked tilt; dust motes render strictly within beam boundaries.
3. **Fireplace Embers / Fire:** Dirty state has cold embers with low breathing red-orange glow. During makeover, embers flare and fire catches across logs over 1.2 s with flickering flame tongues, rising sparks, and crackle audio.
4. **Picture Light & Table Lamp:** Turn on during makeover. Picture light illuminates the seascape over the mantel with a warm downward wash; table lamp illuminates the foreground phone table.

## Dirty → Clean Transformations

1. **Dust Sheet on Armchair:** Dirty recliner covered with draped, creased dust sheet → Clean recliner uncovered, showing rich brown corduroy fabric with folded sheet draped on the armrest.
2. **Fireplace:** Cold grey ash and solitary ember in grate → Roaring fire with layered flame tongues, embers, and burning flue sparks.
3. **Venetian Blinds:** Crooked hanging blinds with 2 broken slats → Straight, pristine horizontal blinds.
4. **Built-in Bookshelf:** Board games toppled over and tapes in disarray → Neatly organized board games, record albums, and stacked VHS tapes.
5. **Mantel Painting:** Dark, grime-obscured canvas → Crisp dusk seascape under warm brass picture light.
6. **Console TV (Story Object):** Static noise and antenna hiss → Animated looping 5-frame home movie of a beach where two adults and a child wave at the camera, with sepia grading, subtle film jitter, and vignette.
7. **Cleaner Trace:** Cracked flashlight on the mantel and sticky note on the TV reading "DON'T turn it off". Clean: flashlight stands repaired and upright; note remains on the TV.

## Decisions & Deviations

1. **TV Bezel Aperture Punch-Out:** In the `room-runtime` render loop, `drawProps` (Step 3) runs before `drawBlended('furniture')` (Step 5). If `furniture` renders a solid background for the TV screen, it obscures the dynamic CRT static and home movie. `paintConsoleTV()` carves out the screen aperture using `ctx.globalCompositeOperation = 'destination-out'`, ensuring live props shine through with crisp bevels.
2. **QA Hero Staging Position:** Default makeover hero position was shifted to `x = 980` (from `x = 720`), so the hero does not stand directly in front of the fireplace opening or obscure the fire catching beat.
3. **Sticky Note Preservation:** The sticky note warning ("DON'T turn it off") remains on the TV frame in the clean state as an intentional narrative cleaner trace.
4. **Foreground Parallax Framing:** Left floor cushion and right side table with rotary telephone are framed outside the HUD safe zones (Nerve meter x 30–240, y 850–1080 and Weapon tag x 1510–1880, y 900–1060).

## QA Critique Rounds (ART-DIRECTION §15)

Each round rendered all states and evaluated visual quality against `reference/screens/` and `review/current/living-room/`.

### Round 1
1. **Panelling read as flat repetitive vertical stripes:** Flat rect fills lacked depth. Added tongue-and-groove beveled edges, lit plank highlights, and varied woodgrain fiber strokes every 48 px.
2. **TV screen was completely black in action/clean:** The static and movie were painted in `drawProps` but overwritten by the opaque TV screen in `paintFurniture`. Fixed using `destination-out` aperture carving.
3. **Brick chimney breast looked like a mechanical grid:** Rendered bricks with hand-painted wobbly mortar seams, varied russet/burnt-umber hues, and organic soot gradient stains above the firebox.
4. **Venetian blind light shafts were too hard-edged:** Replaced single quads with nested soft-alpha quads, creating realistic diffuse beam falloff across wall and floor without blur filters.
5. **Armchair looked plastic:** Replaced flat silhouette with textured corduroy ribs, padded cushions, arm contours, and weighted cloth folds on the dust sheet.

### Round 2
1. **TV static was uniform grey noise:** Created offscreen pixelated noise canvas with CRT scanline bars, subtle horizontal sync jitter, and phosphor tint.
2. **Fireplace fire looked flat and static:** Redesigned with 4 overlapping sinusoidal flame tongues, procedural flicker, rising ember sparks into the chimney flue, and web burning reaction.
3. **Hero obscured fireplace in makeover:** Adjusted `qa.heroX.makeover = 980` and `qa.heroX.clean = 980` so the hearth action is fully unobstructed.
4. **Surge frame crawlers hidden in deep shadow:** Moved staged crawler positions to `(250, 145)` above window blinds and `(1620, 340)` on bookshelf wall; hero aims directly at the upper crawler.
5. **Bookshelf clutter lacked 80s character:** Replaced generic blocks with recognizable board game box silhouettes, vintage record sleeves, and stacked VHS cassette spines.

### Round 3
1. **Moonlight shafts vs panelling contrast:** Tuned beam alpha to provide crisp silhouette reading of crawlers without washing out the warm wood tones beneath.
2. **Makeover sweep timing vs unique beat:** Synchronized ember flare at `t = 3.3 s`, fire catching over 1.2 s (web shrivels at `t = 3.35 s`), and CRT vertical roll at `t = 4.6 s` to reveal the beach home movie.
3. **Picture light & table lamp illumination:** Added warm circular and downward conical light sources that trigger during makeover beats, balancing the cool TV glow.
4. **Foreground element HUD clearance:** Positioned foreground floor cushion and phone table to emerge naturally around the Nerve and Weapon HUD cards without occlusion.
5. **Audio integration:** Synthesized procedural crackle audio for the fireplace and 60 Hz sawtooth roll hum for the CRT TV transition.

## Runtime Requests

1. **Aperture punch-out helper in `room-runtime`:** It would be beneficial if `paintFurniture` or layer rendering provided a standard composite mask or hook for props that contain live animated displays behind architectural frames.
2. **Makeover QA staging time parameter:** Allowing `setup('makeover', { t: 3.9 })` directly would simplify capturing midpoint unique beats for rooms where the sweep concludes early.

## Playtest & Check Results

- **Console Errors:** 0 page errors across all QA setups, hero captures, and playtests.
- **Performance (`action`):** Mean 1.91 ms, p95 2.50 ms (381 frames in 4 s, well under ≤ 8 ms budget).
- **Performance (`makeover`):** Mean 2.19 ms, p95 2.60 ms (228 frames in 4 s, well under ≤ 8 ms budget).
- **Full Flow Test:** 53 passed, 0 failed in `flowtest.mjs`, seamlessly linking `living-room` → `family-room` → `kitchen`.
- **Review Audit:** Clean (0 stray images).

## Fix 1 (2026-10-29, Claude Code)

The painting was below the reference. Changed:
- the wallpaper stripes;
- the floor, now wide boards in the Living Room's perspective;
- the shag rug, now muted rust and taupe;
- the fire, now soft three-layer tongues.

The blinds' moonlight now lands as nine stripes on the floor and the chair. These stripes are drawn straight into the light map (`stripeLight`), because `LightMap.shaft()` widens a quad by ±36 px and would merge them into one patch. Details and numbers: `review/prompts/05-family-room-fix-1/summary.md`.
