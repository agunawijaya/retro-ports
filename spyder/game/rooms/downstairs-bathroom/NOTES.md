# Room 6: Downstairs Bathroom — Notes

*Prompt 08 (`prompts/08-downstairs-bathroom.md`), built 2026-10-29.*

A small, tiled downstairs bathroom: claw-foot tub, pedestal sink under a fogged mirror, an old high-cistern toilet. Tense: harsh bare bulb, dripping water, plugholes. The walls close in for a distinctly narrow diorama feel.

Built under the model policy: **Gemini 3.8 Flash** built the [LOGIC] parts (layout, platforms, gameplay, rules, spawns, makeover beats, and QA staging) and geometric blockouts for all [ART] items, ready for **Claude Code (Opus)** to paint finished artwork.

## Files

| Path | What it is |
|---|---|
| `game/rooms/downstairs-bathroom/room.js` | [LOGIC]: layout data, platforms, drop points, lairs, rules, makeover timing, story object, QA staging |
| `game/rooms/downstairs-bathroom/art.js` | [ART]: blockouts for tiles, plaster, floor, tub, curtain, mirror, bare bulb, window, puddles, dirty-clean differences, and previous cleaner trace |
| `game/rooms/downstairs-bathroom/NOTES.md` | Decisions, mechanics, and runtime notes |
| `review/prompts/08-downstairs-bathroom/summary.md` | Flash summary and "Left for ART" blockout inventory |

One `<script>` line added to `game/index.html` for `rooms/downstairs-bathroom/room.js`.

## Layout & Platform Geometry

- **Room bounds:** left 280, right 1640 (narrow feel, steeper side walls x 0–260 and 1660–1920).
- **Floor:** y 935 (`CEILING: 110`, `PLASTER_END: 380`, `FLOOR_LINE: 770`).
- **Platforms:**
  - `floor`: x 0–1920, y 935 (walkable ground).
  - `tub`: x 310–750, y 760 (rise 175 px from floor, reach ≤ 190).
  - `sink`: x 1050–1230, y 765 (rise 170 px from floor, reach ≤ 190).
  - `shelf`: x 1360–1600, y 600 (rise 165 px from sink, gap 130 px across; reach ≤ 190 / ≤ 160).
  - `toilet`: x 1410–1550, y 820 (rise 115 px from floor).
- **Jump Reach Check:**
  - Floor (935) → Tub rim (760): rise 175 px ≤ 190 px.
  - Floor (935) → Sink rim (765): rise 170 px ≤ 190 px.
  - Sink rim (765) → Towel shelf (600): rise 165 px ≤ 190 px, gap 130 px ≤ 160 px.
  - Floor (935) → Toilet lid (820): rise 115 px ≤ 190 px.
  - Toilet lid (820) → Towel shelf (600): directly accessible from sink platform.

## Gameplay Mechanics ([LOGIC])

1. **Slippery puddles:**
   - Three puddles on floor: x 520–640, 880–1010, 1300–1380.
   - Ground braking friction drops to 25% while inside puddles (`origHeroUpdate` braking reduction adjustment).
   - Small water splash particles burst from the hero's feet while sliding (`Math.abs(hero.vx) > 30`).
   - Clean state: puddles dry up and friction returns to normal.
2. **Bare bulb swing & blackouts:**
   - Swings on damped pendulum physics (`w0 = 3.6`, damping 0.8–3.4).
   - A dart hitting the bulb adds angular impulse (`omega += 1.35`) and triggers enamel ding tone.
   - Any spider dropping or touching the cord adds angular swing impulse.
   - Every 8–12 s, the bulb cuts out for 0.4–0.8 s. The point light drops to 0; headlamp and ambient floor carry the scene.
   - Makeover / Clean: bulb steadies and a frosted glass shade appears around it.
3. **Dripping tap:**
   - Tub tap drops water every 1.2 s into the tub basin with splash particle and high-pitch plink sound (`tone 2150 → 2550 Hz`).
   - Dripping stops cleanly at makeover `tap` beat (4.0 s).
4. **Lairs & Spawns:**
   - Tub drain and sink plughole: Jumpers emerge climbing upward with front legs lifting out over the rim; hatchlings emerge from drains.
   - Wall crawlers from behind the cistern (x 1480, y 290) and from under the shower curtain (x 720, y 450).
   - String spiders drop from the bulb cord ceiling rose (x 960) and three other ceiling points (x 520, 740, 1480).
5. **Rules:**
   - `quota: 16`, `webGoal: 0.85`, `types: ['string', 'crawler', 'jumper']`.
   - `spawnPattern: ['jumper', 'string', 'crawler', 'jumper', 'string', 'crawler', 'string', 'jumper']`.
   - `maxAlive: [3, 4]`, `spawnInterval: [2.2, 1.2]`.
6. **Makeover beats:**
   - Shared beats (stamp, web release, sweep).
   - `mirror` at 3.3 s (duration 2.0 s, easing `inOut`): fog demists outward from centre, revealing reflection and "THOMAS WAS HERE" with smiley.
   - `tap` at 4.0 s: tap stops dripping.
   - `bulb` at 4.3 s (chime 0.6): bulb steadies and frosted glass shade appears around it.
7. **Story object:**
   - "In the mirror, written in old steam: 'Thomas was here.'"
8. **QA states:**
   - `dirty`: hero at x 880 between tub and sink.
   - `action`: spiders active, crawling, dropping, jumping from tub rim.
   - `makeover`: staged at t ≈ 3.9 s with mirror half cleared.
   - `clean`: restored bathroom with morning light through window.
   - `results`: score card naming story object.
   - `drain`: hero sliding across puddle at x 580 with splash particles, swinging bulb reflected in the puddle, and a Jumper's hairy leg poking out of the tub drain.

## Decisions

1. **Jumper tub drain emergence:** Staged with `moves: 'climb'`, `time: 1.6`, and vertical clip matching the tub inner profile, so during the first 0.6s the body stays inside the basin while the front legs lift out over the rim.
2. **Puddle reflection:** Handled live in `art.js` `drawProps()` by tracking `bulb.x` and projecting the reflection streak across each active puddle.
3. **Blackout light behaviour:** In `lights()`, when `live.bulb.isBlackout` is true, the bulb's point light contribution is set to 0, ensuring the headlamp is the primary directional light source during blackouts while maintaining ambient floor readability.


## Art (2026-10-29, Claude Code)

`art.js` was repainted over Flash's blockout; see `review/prompts/08-downstairs-bathroom/summary.md` for each item.

**Traps for whoever touches it next:**
- The walls, the floor mosaic and the side walls all share one camera: VP (960, 440), FOCAL 1400. Change one and the others stop meeting.
- The curtain is translucent on purpose: crawlers walk behind it, because wall critters are drawn before the furniture layer.
- The mirror's fog is cut away per frame on a small scratch canvas (`live.mirror`); its three source canvases are built lazily, after the fonts have loaded.
- The dirty fog must not let the message be read (08-fix-1). Only masked fragments of the letters are wiped out of it, at 0.12 alpha; the readable letters live on the `trace` canvas and appear only as `mk.mirror` clears the fog.
