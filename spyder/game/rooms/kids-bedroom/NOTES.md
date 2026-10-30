# Room 9: The Kid's Bedroom (Thomas's Room) — Design & Implementation Notes

*Built per `prompts/11-kids-bedroom.md` under model policy: [LOGIC] sections implemented; [ART] items implemented as geometric blockouts.*

---

## 1. Architecture & Room Structure

- **Two-File Architecture:**
  - `game/rooms/kids-bedroom/room.js`: Contains all [LOGIC] sections: layout, platforms, lairs, drop points, rules, makeover timing, procedural music-box Web Audio, train physics, chest pop mechanics, and QA states.
  - `game/rooms/kids-bedroom/art.js`: Attached via `Spyder.rooms.attachArt('kids-bedroom', ...)` containing geometric blockouts for all [ART] items.
- **House Map ID:** `kids-bedroom`, Act 2, Room 9 (matching `game/lib/house-map.js` and `game/lib/room-registry.js`).
- **Layout & Props:**
  - `CEILING`: 110, sloped dormer on right from (1500, 110) down to (1860, 300).
  - `FLOOR_LINE`: 770.
  - `GROUND`: 935.
  - Bounds: left 100, right 1840.
  - Door to hallway: x 110–260, y 360–770, ajar.
  - Bunk bed: x 300–700; lower bunk y 800, upper bunk y 620, ladder at x 700–740.
  - Planet mobile: hanging from ceiling at x 900, planets down to y 320.
  - Star-projector night-light: on floor at x 860, y 900.
  - Toy chest (lair): x 820–1000, top y 840.
  - Toy train and track: oval track on floor, x 760–1280, y 960–1020.
  - Desk with lamp: x 1250–1550, top y 770.
  - Wall shelf with toys & music box: x 1250–1550, y 590.
  - Thomas's drawing (story): pinned above shelf, x 1330–1470, y 430–540.
  - Dormer window with rocket curtains: x 1600–1800, y 330–600 (under dormer slope).
  - Floor: y 770–1080.

---

## 2. Platforms & Jump Reach Budget

- Platforms defined:
  - `floor`: x 0–1920, y 935 (`oneWay: false`).
  - `lower-bunk`: x 305–695, y 800 (`oneWay: true`).
  - `upper-bunk`: x 305–695, y 620 (`oneWay: true`).
  - `toy-chest`: x 825–995, y 840 (`oneWay: true`).
  - `desk`: x 1255–1545, y 770 (`oneWay: true`).
  - `shelf`: x 1260–1540, y 590 (`oneWay: true`).
- Jump Reach Verification:
  - Floor (935) to Lower bunk (800): rise 135 px (budget ≤ 190 px).
  - Lower bunk (800) to Upper bunk (620): rise 180 px (budget ≤ 190 px).
  - Floor (935) to Toy chest (840): rise 95 px (budget ≤ 190 px).
  - Lower bunk (right edge 695) to Toy chest (left edge 825): gap 130 px, y diff 40 px (budget gap ≤ 160 px).
  - Floor (935) to Desk (770): rise 165 px (budget ≤ 190 px).
  - Desk (770) to Shelf (590): rise 180 px (budget ≤ 190 px), direct vertical rise.
  All jumps strictly adhere to the engine reach budget (rise ≤ 190 px, gap ≤ 160 px).

---

## 3. Gameplay Mechanics (L2)

- **Toy Chest Lair:**
  - Jumper lair inside the chest (`{ from: { x: 910, y: 880 }, to: { x: 910, y: 840 }, chestLid: true }`).
  - When the Jumper emerges, the chest lid pops up like a jack-in-the-box (`live.chestLid` damped with spring stiffness) and triggers a spring "boing" Web Audio effect.
  - Jumpers in this room originate solely from the chest and under the bunk (`x: 420–550, y: 935`).
- **Toy Train & Oval Track:**
  - Runs around an oval track at x 760–1280, y 960–1020.
  - In the dirty room, the train runs slowly (~70 px/s) continuously.
  - Hatchling riding: Any alive hatchling touching the track climbs on, mounts a carriage, and rides one lap (~1068 px) before hopping back down to the floor.
  - Darts pass over the train without colliding (not a platform).
- **Planet Mobile:**
  - Hanging from ceiling at x 900.
  - String spiders hang from it as well as ceiling drop points.
  - When a string spider drops from near the mobile (x 840–960, y < 340), an impulse is imparted to the mobile (`live.mobileVel`), causing it to turn and sway with damped pendulum oscillation.
- **Atmospheric Toy Twitches:**
  - Every 6–10 s, one toy on the shelf or floor (ball, robot head, or spinning top) twitches or turns slightly, purely as atmospheric surrealism.

---

## 4. Procedural Music-Box Melody (L3)

- Original, tinkling 12-bar melody composed in G major/pentatonic.
- Synthesized via Web Audio using dual sine/triangle oscillators with slight detune (5 cents) and rapid exponential decay mimicking steel comb tines.
- Tempo features subtle ritardando rubato slowing at the end of each 4-bar phrase.
- At makeover beat `musicbox` (t = 3.3 s), the music box opens, its figure turns, and it plays the full melody before entering a quiet loop.
- In dirty room: Intermittent slow, detuned notes (out of tune by ~18 cents) play every 16–28 s, as if the music box tries to play by itself.

---

## 5. Makeover Sequence & Story Object

- Story Object: `"Above the desk: Thomas's drawing of his family — and of someone in an orange suit."`
- Makeover Beats:
  - `musicbox` at 3.3 s: Box opens, figure turns, lullaby begins.
  - `stars` at 3.6 s: Star projector slows to calm turn and warms in colour.
  - `train` at 4.4 s: Train pulls into station and stops with a dual-tone whistle toot.
  - `drawing` at 4.8 s: Thomas's drawing unfolds flat and reveals the family and the orange-suited helper.

---

## 6. QA Staging States

- `dirty`: Hero at x 420, dark sky, unlit desk lamp, train running slowly, tangled bedding, unread drawing.
- `action`: Active gameplay with string spiders (including dropping from mobile), crawlers from desk lair, egg sac, hatchling, torn curtains/webs, hero aiming at x 900, y 350.
- `shadows`: Custom QA state showing:
  - Hero on the upper bunk aiming.
  - String spider near the projector casting a 4× distorted shadow across the sky-blue wallpaper.
  - Jumper leaping out of the open toy chest with lid popped.
  - Hatchling riding the train along the oval track.
- `makeover`: Staged at t ≈ 3.9 s with music box playing and stars warming.
- `clean`: Morning sky, made bunks, flat drawing, silent walkie-talkie on desk, lit desk lamp, parked train.
- `results`: Cleared room with story object displayed on card.

---

## 7. Left for ART

Every [ART] item has been built as a geometric blockout in the palette at exact prompt coordinates and marked with `// ART: blockout - <item>` in `game/rooms/kids-bedroom/art.js`:
1. `// ART: blockout - Wallpaper`
2. `// ART: blockout - Star projector light`
3. `// ART: blockout - Giant spider shadows`
4. `// ART: blockout - Bunk bed`
5. `// ART: blockout - Planet mobile`
6. `// ART: blockout - Toy chest`
7. `// ART: blockout - Train`
8. `// ART: blockout - Desk and lamp`
9. `// ART: blockout - Shelf`
10. `// ART: blockout - Thomas's drawing (story)`
11. `// ART: blockout - Dormer window`
12. `// ART: blockout - Posters`
13. `// ART: blockout - Dirty to clean`
14. `// ART: blockout - Trace of the previous cleaner`
15. `// ART: blockout - Door to the hallway`

---

## 8. Art (2026-10-29, Claude Code)

`art.js` was repainted over Flash's blockout. What it paints, and the critique rounds, are in `review/prompts/11-kids-bedroom/summary.md`.

### Critique rounds (5 biggest gaps per round, against `reference/screens/` and `review/current/`)

**Round 1** (first full render):
1. The giant shadow did not show at all. The art had no way to see the critters: Flash's blockout read `S.runtime.world`, which does not exist.
2. In the `shadows` QA state, the string spider's and the Jumper's legs stretched up to the ceiling, because they were teleported without their feet being replanted.
3. The projected stars read as four-point lens glints, not as star and moon shapes on the wall.
4. The track was a pale double outline, more a drawing than a tin track.
5. The sheet hanging from the top bunk was a flat white panel.

**Round 2:**
1. The middle of the wall (x 1000–1200) was empty.
2. On the clean drawing, "THE HELPER" was too small to read.
3. The projector was too small to find at a glance.
4. On the shelf, the globe and the music box overlapped.
5. The bear sat over the drawing's corner.

**Round 3:**
1. "THE HELPER" was cut off at the drawing's edge and touched the globe. It now sits higher, and the grass was moved up with it.
2. The music box's dancer rose into the drawing. The box moved right of the drawing, to x 1485.
3. The scarf on the peg rail is long. It was kept, because it is the only strong colour in that part of the wall.
4. A floor critter's shadow falls behind the furniture. That is accepted: it is physically right, and a spider on the string or wall reads far better.
5. The dirty room is dark. It is kept dark on purpose, because the projector's stars are the room's look and need the dark.

### Traps for whoever touches it next

- **The art reaches the critters through `live.world`.** `room.js` stores it in `onStart` and in every update, and the `shadows` QA state stores it too. Without it, there are no giant shadows, and nothing reports an error.
- **Every shadow is drawn by `c.rig.draw` into a 256 px scratch canvas at half scale,** then filled flat with `source-in` and stretched 3–5×. The stretching is what softens it; there is no blur.
- **The projector's turn is integrated in `live.turn`,** so the slowing at the `stars` beat stays smooth. `lights()` advances it; `glow()` and `drawProjector()` only read it.
- **The train is drawn from `live.trainDist` through a copy of room.js's track geometry** (`TRACK`, `trackPos`). Change the oval in one file and you have to change it in the other.
- **At the `train` beat, the drawn train eases forward to the station** (`STATION.dist`, on the back straight), whatever distance the logic stopped it at.
