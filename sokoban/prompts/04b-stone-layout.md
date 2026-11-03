# Prompt 04b — part A: the stone layout module ([LOGIC], DeepSeek)

You are working on the Hening web game in `E:\Projects\retro-ports\sokoban\game` (Vite, Three.js r170, Vitest). This is the first, self-contained [LOGIC] piece of `prompts/04b-floating-stones.md`: **the numbers and the pure math of the new tower**, in one module that the rest of 04b (built afterwards by another agent) and the art will import. No rendering, no DOM, no Three.js scene code here.

## Pembagian kerja

| Who | Does |
|---|---|
| **DeepSeek Flash** (OpenCode, you) | This module and its tests. |
| **Flash** (agy) | Afterwards: the rest of 04b's [LOGIC], importing your module. |
| **Opus** | The [ART] of 04b; reviews your module first. |
| **Haiku** | Starts your run, reads the done marker. |

## Read first

1. `docs/ART-DIRECTION.md` §13.2, §13.3, §13.4, §13.5, §13.12 — **every number below comes from there; where this prompt and the doc differ, the doc wins.**
2. `game/src/render/board.js` (`cellX`, `cellZ`), `game/src/render/camera.js` (`view.azimuth`, `placeCamera`: the camera sits at direction `(sin a, cos a)` from its target), `game/src/render/math.js`.

## Hard rules

- Create only `game/src/world/stone-layout.js` and `game/tests/stones.test.js`. Edit nothing else (no `package.json`, no other source, no docs).
- Pure functions and frozen data; may import `three` math classes (`Vector3`) and `../render/math.js`, nothing else. Humanized code, short comments that say why. No git commits.

## Angles

All spec angles are measured from the **default camera's front** and turn the way `view.azimuth` increases: a spec angle φ (degrees) is the world direction `(sin α, cos α)` with `α = π/4 + φ·π/180`. So the camera at azimuth `α` faces whatever stands at spec angle φ on a rim. Write this once in the module header.

## What the module exports

```js
export const AXIS_STEP = 2.4;            // floor pitch
export const STONES;                     // frozen array, index 0 courtyard, 1..5 Lantai I..V, 6 capstone:
// { index, name, R, opening /* 0 for courtyard (recess) and capstone */, recess /* courtyard only: { r: 1.2, depth: 0.15 } */,
//   topY, thickness /* capstone 0.7, others from the profile */, offset /* 0, 0.22 or 2.3 */, offsetAngleDeg,
//   centre: { x, z } /* from offset and angle */, breathScale /* 1, capstone 0.5 */ }
export function floorStone(floor)        // 1..5 -> STONES[floor]
export function breathe(index, t, reducedMotion)   // -> { dy, tiltX, tiltZ } (±0.025 over 8 s, ±0.4°, phase 0.7 s × index; capstone half; zero with reduced motion)
export function settle(sinceS)           // -> { turnDeg, dip } for a stone the platform passed sinceS seconds ago:
// 4° turn and 0.03 dip, back over 1.6 s with a soft overshoot; { 0, 0 } before 0 and after 1.6
export const NICHE_COUNT = 10;
export function nicheAngle(i)            // spec angle of niche i: 36° × i (niche 0 at the front)
export function nicheAzimuth(i)          // the camera azimuth that faces niche i (π/4 + 36° × i)
export function niche(floor, i)          // -> { target, object, back /* {x, z} world, around the stone's centre */, angle, azimuth }
                                         // at radii R − 0.45, R − 0.95, R − 1.35 from the stone's centre
export function finials(floor)           // the ten finial positions, offset 18° from the niches, on the rim caps
export const COURTYARD;                  // { size: 9, place cells exactly as §13.3, stepping stones (5, free-floating off the west rim) }
export function courtyardCell(r, c)      // -> { x, z } with the board convention for a 9 × 9 board centred on the axis
export function isWalkable(r, c)         // §13.3: centre within 4.2 of the axis, minus the opening (centre cell and its four neighbours)
export function capstone()               // -> { centre, topY, R } (2.3 off the axis toward 180°)
export function platformY(fromFloor, toFloor, p)  // the ride's height at progress p ∈ [0, 1] (easeInOutSine over the whole ride; 3.2 s per floor is the caller's)
export function rideSeconds(fromFloor, toFloor)   // 3.2 × floors travelled
export function clearance(floor, t, sinceSettle) // the worst gap between the platform (r 0.8, on the axis) and the floor's opening
                                         // over the stone's breathing and settling: 1.2 − offset − (bob tilt lateral shift) − 0.8
```

Floor 0 means the courtyard stone in `platformY`/`rideSeconds`; the ending's ride to the capstone level is `toFloor = 6` (stops level with the capstone's top, `14.4`).

## Tests (`game/tests/stones.test.js`)

- `STONES` matches §13.2's table (radii, openings, top y, offsets, offset angles).
- Openings clear the platform: for every floor, `clearance(floor, t, s) > 0.05` for t over two breathing periods and s over the settle (sampled finely).
- `isWalkable`: the opening's five cells are not walkable; every place's activation cell is walkable; count the walkable cells and assert the number you get (write it in the summary).
- `niche()`: radii from the stone's centre are `R − 0.45 / 0.95 / 1.35`; niche 0 lies toward the default camera; ten distinct angles 36° apart; on Lantai V the back stones stay outside `opening + 0.15` from the stone's centre.
- `settle`: zero at 0 and 1.6 s, peak turn 4° and dip 0.03, one overshoot.
- `breathe`: zero with reduced motion; capstone half of a floor.

Run `npx vitest run tests/stones.test.js` until it passes, then `npm test` (all files) and report the totals.

## Deliverable — then STOP

`review/prompts/04b-floating-stones/layout-summary.md`: the exports as built, every decision you made where the doc left room, the walkable cell count, the test counts. Then stop.
