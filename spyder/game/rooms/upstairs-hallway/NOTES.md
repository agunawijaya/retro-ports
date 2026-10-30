# Upstairs Hallway (Room 7) — Design & Implementation Notes

*Built per `prompts/09-upstairs-hallway.md` under model policy: [LOGIC] sections implemented; [ART] items implemented as clear geometric blockouts.*

---

## 1. Architecture & Room Structure

- **Two-File Form:** Split cleanly across `game/rooms/upstairs-hallway/room.js` ([LOGIC]) and `game/rooms/upstairs-hallway/art.js` ([ART]).
- **House Map Id:** `upstairs-hallway`, Act 2, Room 7 (matching `game/lib/house-map.js` and `game/lib/room-registry.js`).
- **Layout & Props:**
  - `CEILING`: 110, picture rail at y 150.
  - `DADO_RAIL`: 560.
  - `FLOOR_LINE`: 770.
  - `GROUND`: 935.
  - Bounds: left 120, right 1840.
  - Door A (x 480–660, y 360–770), Door B (x 820–1000, y 360–770), Door C — Thomas's room (x 1160–1340, y 360–770), Door D (x 1500–1680, y 360–770).
  - Sconces at x 400, 740, 1080, 1420 at y 320.
  - Side table with vase and photos (x 690–790, top y 800).
  - Attic hatch (x 1350–1500, y 40–110).
  - Attic ladder (x 1370–1490, rungs at y 800, 660, 520, 380).
  - End window (x 1730–1850, y 320–700).
  - Radiator under window (x 1700–1860, top y 820).
  - Hall runner (y 860–1000).
  - Floor (y 770–1080).

## 2. Platforms & Jump Reach Budget

- Floor (y 935)
- Banister rail (x 110–430, y 760) — rise 175 px (budget ≤ 190 px)
- Side table (x 695–785, y 800) — rise 135 px (budget ≤ 190 px)
- Ladder rungs (x 1375–1485):
  - Rung 1 at y 800 — rise from floor 135 px
  - Rung 2 at y 660 — rise 140 px
  - Rung 3 at y 520 — rise 140 px
  - Rung 4 at y 380 — rise 140 px (all one-way, 140 px apart)
- Radiator (x 1705–1855, y 820) — rise 115 px (budget ≤ 190 px)

All vertical rises and horizontal gaps are strictly within the engine jump reach limits (rise ≤ 190 px, gap ≤ 160 px).

## 3. The Egg Carrier (`game/lib/spider-types/egg-carrier.js`)

- **Registration:** `S.registerSpiderType('eggCarrier', ...)`, `quota: true`, `layer: () => 'wall'`.
- **Rig & Silhouette:** `SpiderRig` with scale 1.1, `legFemur: [1, 1, 1, 1.2]`. The back leg pair (`leg.index === 3`) is held over the abdomen clasping the pale bundle, with a faint silk strand securing it.
- **Egg Sac Helper:** Extracted `S.spiders.drawEggSac(ctx, x, y, opts)` in `game/lib/spiders.js` without any behavior change (verified 100% regression-free against reference). The carrier draws its held sac at 1.3× scale with gentle pulsing.
- **Intro Rule:** First egg carrier spawns alone (`canSpawn` checks no active quota spiders) through Door B with a slow emerge (1.2 s).
- **Movement:** Walks wall like Wall Crawler at 0.75× speed with organic noise surges, freezes occasionally, and selects targets maximizing distance from hero.
- **Planting:** After 9.0 s alive carrying the sac, it stops and lowers the sac onto the wall over 0.8 s, spawning a wall egg sac (`world.spawnEgg(..., 'wall')`). It then continues as a crawler worth 120 points.
- **Shot in Body while carrying:** Carrier dies, sac falls (`world.spawnEgg(..., 'falling', { hatchAt: 3 })`), lands, and hatches in 3 s unless popped. Awards 220 points.
- **Shot in Sac:** Intercepts dart via `world.on('dart')`, pops sac (+150 pts, label "Egg first!", combo bumped, fibres & splat burst), survives, flees at 1.4× speed, points become 120.

## 4. Makeover Beats & Story Object

- **Story Object:** `"On a door frame: Thomas, measured every birthday. The marks stop at eight."`
- **Beats:**
  - `sconce1` at 3.3 s (chime 0.1)
  - `sconce2` at 3.6 s (chime 0.25)
  - `sconce3` at 3.9 s (chime 0.4)
  - `sconce4` at 4.2 s (chime 0.55)
  - `doorC` at 4.4 s (Thomas's door opens, warm night-light spills out)
  - `ladder` at 4.9 s (attic ladder folds up and hatch closes with a clunk sound)

## 5. QA Staging States

- `dirty`: Initial dark state with flickering sconce, damp patches, torn wallpaper, closed doors, fallen photos, tipped stool.
- `action`: Busy room with string spiders (including one dropping from the attic hatch at x 1425), wall crawler from Door A, egg sac, hatchling, torn webs, active dart volley.
- `carrier`: Custom QA state showing first carrier emerging from Door B with sac, second carrier planting on wall, hero on ladder rung 2 aiming.
- `makeover`: Restored at t ≈ 3.9 s with sconces lighting in sequence.
- `clean`: Completely restored morning hallway with intact wallpaper, polished woodwork, standing photos, legible height marks.
- `results`: Restored state displaying results card with story object.

## 6. Left for ART

Every [ART] item has been implemented as a geometric blockout marked with `// ART: blockout - <item>`:
1. `// ART: blockout - Wall`
2. `// ART: blockout - Doors`
3. `// ART: blockout - Height marks (story)`
4. `// ART: blockout - Sconces`
5. `// ART: blockout - Attic hatch`
6. `// ART: blockout - Window`
7. `// ART: blockout - Stairwell`
8. `// ART: blockout - Under-door light`
9. `// ART: blockout - Dirty to clean`
10. `// ART: blockout - Trace of the previous cleaner`
11. `// ART: blockout - Egg Carrier art`


## Art (2026-10-29, Claude Code)

`art.js` was repainted over Flash's blockout; see `review/prompts/09-upstairs-hallway/summary.md` for each item.

**Traps for whoever touches it next:**
- **Opening doors:** a door's leaf is cached as a sprite per door and state (`live.leaves`), so a door can be drawn swung open over the painted one. It narrows from its hinge (left) side.
- **Door state:** `live.doors` is written by room.js's `onUpdate`. The art never sees the critters; it only reads which doors are ajar.
- **The ladder after the makeover:** the ladder rungs stay platforms in the logic even after the ladder has folded away at the makeover. The hero cannot move in the restored room, so nothing can stand on them, but a future "play on after the makeover" mode would need them removed.
