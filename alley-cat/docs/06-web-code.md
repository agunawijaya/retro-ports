# Alley Cat — the port's code, walked through

*Document six of six. See [05-web-architecture.md](05-web-architecture.md)
for the top-down view, and [04-porting.md](04-porting.md) for why HTML/Canvas
was chosen.*

Everything lives in one file: [`../web/game.js`](../web/game.js). This
document walks through it in the order the code is written, skipping the
obvious and dwelling on the parts that took several attempts to get right.

The file is wrapped in an IIFE, so all identifiers below are inside that
closure — nothing leaks to `window` except the small `selfTest()` helper.

## The utility layer

At the top:

```js
const W = 960, H = 600;
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
```

Then two things worth naming:

**`rng(seed)`** — a mulberry32 pseudo-random generator. Deterministic per
seed, so the fence's knot positions, the pavement's cobblestones, and the
scattered graffiti drips are all in the same place every render. Every
place in the code that would otherwise want `Math.random()` gets a seed
and uses this instead.

**`baked(key, w, h, drawFn)`** — a cache of offscreen canvases. First call
runs `drawFn` into a new canvas and stores it; subsequent calls return the
same canvas. This is how the fence, pavement, floor, and brick surrounds
are drawn only once even though the frame refreshes 60 times a second.

## Scene 1: the title screen

The draw order is intentional and matters:

```js
function drawTitle(t) {
  drawNightSky();                // sky gradient
  drawStars();
  drawMoon(t);
  drawSkyline();                 // faint city silhouette
  drawFence();                   // wood planks (baked)
  drawFenceGraffiti();           // handwritten spray text
  drawGround();                  // pavement — MUST come after fence,
                                 // otherwise the fence's dark bottom
                                 // repaints over the pavement
  drawLandedBones(t);            // fish bones from previous cycles
  drawCanCastShadows();          // shadows under cans
  drawTrashCans(t);              // 5 cans, one with popping cat + lid
  drawFlyingBoneIfActive(t);     // current bone in flight (on top)
  drawCatOnFence(t);             // walking cat with state machine
  drawFireflies(t);
  drawTitleType(t);              // "Alley Cat" script text
  drawTitleFooter();
  drawVignette();
}
```

### The walking cat has a state machine

`drawCatOnFence(t)` is the only place in the port with **mutable
module-level state**. The cat cycles through three behaviours:

- `walk` — moves left/right along the fence top with a proper 4-leg gait
  (lateral-sequence walk: LF, LB, RF, RB with quarter-cycle phases). Body
  bobs on foot-plant. Tail lags behind body motion (`tailPhase` is
  low-passed).
- `sit` — haunches down, tail curled around feet, occasional blink.
- `lick` — sits and grooms a raised front paw, tongue extending.

Transitions are random with weighted probabilities (60% chance of sit
after walking, 40% lick) and bounded durations (2–5 s per behaviour). At
either end of the fence, the cat is forced into a sit — no wrap-around.

This is the ONE place that would break in a naive headless capture,
because state persists between frames. In practice interactive browsers
have no problem with it, and the animation is so short-lived it doesn't
matter for screenshots.

### The pop-out cat and the layer bug

Original attempt drew a "cat head shoulders" shape sitting on top of the
lifted lid. It looked like a floating head. The user pointed this out
directly and the fix was structural:

```js
for (let i = 0; i < CANS.length; i++) {
  const c = CANS[i];

  // 1. Draw WHOLE cat behind the can (extending down into the can shape)
  if (isAnim && anim.headHeight > 0) {
    drawFullCatInCan(c.x, c.y, c.s, anim.headHeight, ...);
  }
  // 2. Can body — opaque rectangle covers the cat's lower half naturally
  drawTrashCanBody(c.x, c.y, c.s, c.dent);
  // 3. Paws on the near rim (visible on top of can)
  if (isAnim && anim.headHeight > 6) drawPawsOnRim(c.x, c.y, c.s);
  // 4. Lid on top — hinges up on one side, tilted 43° at peak
  if (isAnim) drawTrashCanLid(c.x, c.y, c.s, openness, hingeDir, false);
  else       drawTrashCanLid(c.x, c.y, c.s, ...static ajar tilt...);
}
```

The key insight from the user: **don't clip the cat manually; let the can
body clip it by drawing on top**. The cat function is now much simpler —
just draw a whole cat, and trust the can rectangle to hide the parts that
should be inside the can.

### Lid rotation direction

`drawTrashCanLid(cx, cy, s, openness, hingeDir, mouse)` had its rotation
sign flipped in an early iteration — the lid opened downward instead of
upward. The fix required a comment because the geometry is confusing:

```js
// Canvas rotation: positive angle = clockwise as viewed on screen.
//   hinge on LEFT (hingeDir = -1): want right edge to go UP → CCW → NEG angle
//   hinge on RIGHT (hingeDir = +1): want left edge to go UP → CW  → POS angle
//   → angle sign matches hingeDir.
const angle = hingeDir * openness * maxAngle;
```

The lid rests at `bodyTop - 6` (just above the rim) and pivots around a
point at either the left or right edge of that disc.

### Fish bones accumulate

Every ~7 seconds a random can throws a bone. Each bone lands at a fixed
deterministic pixel on the pavement, chosen by:

```js
function computeBoneTargetForCycle(c) {
  const rand = rng(c * 137 + canIdx * 19 + 5);
  const distance = 90 + rand() * 220;
  const py = GROUND_Y + 40 + rand() * 100;
  const rot = (rand() - 0.5) * TAU;
  return { x: can.x + dir * distance, y: py, rot };
}
```

`drawLandedBones(t)` iterates every cycle number from 0 to
`floor(t / POP_CYCLE)` and draws each bone at its own target position and
rotation. The bones accumulate forever (well, until the page reloads).

### Handwriting graffiti

`scrawlText(text, x, y, size, color, rot, seed)` renders text
character-by-character with per-glyph position/rotation/size jitter, so no
two letters share a baseline. The font stack starts with `"Segoe Print",
"Bradley Hand ITC", "Bradley Hand", "Segoe Script", "Marker Felt"`. Ink
drips are drawn as short rectangles under one or two random letters.

## Scene 2: Phase 0 — the courtyard/room

The layout follows the CGA original but rendered with warmth:

```js
function drawPhase0(t) {
  drawRoomWall();                       // cream wallpaper gradient
  drawWallDecor();                      // small painting + mirror on wall
  drawFloor();                          // wood plank floor, baked
  drawBaseboard();
  drawFireplace(t);                     // brick surround, mantle, animated fire
  drawAreaRug(195, 550, 170, 30);       // rug under the seating group
  drawWingChair(120, 525, 0.85, +0.45); // left chair, angled toward table
  drawWingChair(275, 525, 0.83, -0.45); // right chair, mirrored
  drawCoffeeTable(198, 528);            // coffee table between chairs
  drawSideTable(680, 515);
  drawFloorLamp(850, 580, t);
  drawFireGlowSpill(t);                 // warm bleed on floor
  drawDustMotes(t);                     // near the lamp
  drawCatByFire(t);
  drawSceneVignette();
}
```

### The fireplace is the visual centrepiece

`drawFireplace` draws (in order): mantle plank → baked brick surround →
black opening → soot gradient inside → iron grate → crossed logs → the
fire → warm glow overlay → mantle clock → two candles.

The fire itself is `drawFire(cx, baseY, w, h, t)` — four stacked flame
layers, each a teardrop path filled with a radial gradient, wobbling in
different phases and composited with `globalCompositeOperation = 'lighter'`
so overlapping flames add up:

```js
const layers = [
  { color: 'rgba(255,80,20,0.65)',  wob: 6,  speed: 3.0, offs: 0 },
  { color: 'rgba(255,150,40,0.75)', wob: 4,  speed: 4.2, offs: 1 },
  { color: 'rgba(255,215,90,0.85)', wob: 3,  speed: 5.6, offs: 2 },
  { color: 'rgba(255,240,180,0.95)', wob: 2, speed: 7.0, offs: 3 },
];
```

Plus six deterministic sparks refreshed each ~250 ms via
`rng(Math.floor(t * 4))`.

### The wing chair 3/4 view

`drawWingChair(cx, cy, s, facing)` was rewritten once. First version drew
chairs as an oval back on top of a rectangular seat — read as either
frontal or profile ambiguously. The user asked for chairs angled toward
the coffee table in 3/4 view.

The new version parameterises by `facing` (-1..+1) and applies a horizontal
`shift = facing * 7` to the back of the chair, so the back appears tilted
toward the target while the front stays planted. Front and back armrests
are drawn separately, with the near armrest larger (foreshortening cue).

## Scene 3: Phase 2 — the pond

Self-contained scene, no shared room chrome. Composition:

```js
function drawPhase2(t) {
  // Water gradient — teal surface → navy depth
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.00, '#5ec8dc');
  g.addColorStop(1.00, '#08243c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  drawSunbeams(t);    // angled light shafts through water
  drawPondSurface(t); // pink sky strip + wavy water crest, animated
  drawFishSchool(t);  // 14 ornamental fish
  drawBubbles(t);     // rising bubbles
  drawPondBottom(t);  // sandy floor + pebbles + swaying weeds
  drawSceneVignette();
}
```

### Fish direction bug — a lesson in modulo

The original fish loop was:

```js
const baseX = (rand() * W + t * speed * dir) % (W + 100);
const x = dir > 0 ? baseX - 50 : W + 50 - baseX;
```

Fish that were meant to swim left (`dir = -1`) fed negative time into the
modulo, and JavaScript's `%` on negative numbers gives negative results.
Fish ended up frozen off-screen or moving the wrong way.

Fix: time always advances positively; `dir` only controls whether the
final `x` is measured from the left or from the right:

```js
const wrapped = (t * speed + offset) % (W + 100);   // always ≥ 0
const x = dir > 0 ? -50 + wrapped : W + 50 - wrapped;
```

### Ornamental fish palette

`FISH_PALETTES` holds seven `{body, accent, fin}` triples — clownfish,
yellow tang, blue tetra, pink guppy, green molly, silver minnow, red
betta. `drawFish` picks one per fish and paints body + stripes + fins +
tail-fin rays + white sclera + coloured iris + dark pupil. Fish direction
matches facing (the whole sprite is `ctx.scale(dir, 1)`-mirrored).

## Scene 4: Phase 3 — the library

```js
function drawPhase3(t) {
  drawRoomWall(); drawFloor(); drawBaseboard();
  drawSmallFireplace(140, 220, 200, 150, t);   // wall-mounted
  drawWingChair(90,  530, 0.80, 0);            // frontal chairs
  drawWingChair(240, 530, 0.80, 0);
  drawFloorLamp(25,  585, t);
  drawFloorLamp(360, 585, t);
  drawBookshelf(460, 90, 460, 490);            // fills right half
  drawSceneVignette();
}
```

`drawSmallFireplace(x, y, w, h, t)` is the compact wall-mounted variant
reused by Phases 3–6. It bakes the brick surround with the same technique
as `drawFireplace` but at smaller scale, cuts a dark rectangular opening,
and drops in a small animated flame.

`drawBookshelf(x, y, w, h)` draws a wooden carcass and eight horizontal
shelves. Each shelf loop places books along the plank:

- Width per book: `10 + rand() * 14`
- Height per book: shelf inner height minus a small random dip
- Colour: from a 10-entry palette
- ~8% chance the book is slanted (`slant = (rand() - 0.5) * 0.4` radians)
- ~5% chance it's a stack of fallen books lying on their side
- ~70% have a gold title band, ~40% have a small text mark

Three flower pots sit on top; each uses `drawShelfPot` which draws
terracotta + tapered leaves + a small `drawFlower` on top.

## Scene 5: Phase 4 — the cheese wall (PLAYABLE)

Phase 4 is the first phase where you actually control the cat. The player
walks the cat on the floor, climbs it up the cheese wall through the mouse
holes, and catches mice as they poke out. It also has an incidental joke:
if the cat lands on the side table, the vase falls off and shatters.

`drawCheeseBlock(x, y, w, h, t)` draws the wall itself — a wedge shape
(top-left corner lower than top-right, sloped rind) filled with a yellow
gradient. Fourteen holes are punched with `ctx.createRadialGradient` from
dark inside to slightly lighter outer ring, plus an inner rim highlight
arc simulating light from top-left. Everything else about the phase is
built on top of that static scene.

### The platformer physics model

Phase 4 uses the same continuous-physics model as Phase 5 (see the
[Phase 5 section](#scene-6-phase-5--the-birdcage-room-playable) for
the full physics detail — the constants and integration steps are
identical), with one addition: **cheese holes are grab points**.

`PHASE4` state combines both:

| field | meaning |
|---|---|
| `catX, catY, catVX, catVY` | position + velocity (paws touch the surface directly; y-positive = downward) |
| `catFacing` | +1 right, −1 left |
| `onGround` | true when standing on the floor or a furniture platform |
| `onHole` | true when hanging on a cheese hole (mutex with `onGround`) |
| `currentPlatform` | index into `PHASE4_PLATFORMS`, or −1 for the floor |
| `currentHole` | index into `PHASE4_HOLES`, or −1 for none |
| `dropThroughIdx / UntilT` | platform temporarily ignored after ↓ |
| `justReleasedHole / UntilT` | hole temporarily ignored right after release |
| `jumpStartY` | y when the cat last left the ground/hole (for stun threshold) |
| `isStunned, stunnedUntilT` | dizzy pose after a fall from height |

### Furniture platforms and cheese holes

Three furniture platforms (top surface `y`, walkable horizontal range
`[x, x + w]`):

| id | x range | y | notes |
|---|---|---|---|
| `chair-back` | 648–692 | 395 | top of the wing chair, centred on x=670 (matches `drawWingChair` cx) |
| `chair-seat` | 644–696 | 488 | cushion, centred on x=670 (matches `drawWingChair` cx) |
| `side-table` | 794–866 | 509 | circular top, centred on x=830 (matches `drawSideTable` cx). First landing triggers the vase-fall animation (`PHASE4_TABLE_IDX = 2`) |

**Platform-vs-visual alignment.** An earlier version had `chair-seat`
at x=669..731 — centred on x=700 instead of x=670. That put the
platform 30 px to the right of the visible chair: the cat would jump
in front of the chair and fall (no platform there), or jump beyond it
and land on invisible air (platform extends past the chair). Fixed by
re-centring on the actual `drawWingChair` `cx`.

Fourteen `PHASE4_HOLES`, positioned as fractional (fx, fy) of
`PHASE4_CHEESE` (x=30, y=100, w=570, h=470) with per-hole radius
`r ∈ [20, 32]`. Each hole's **grab point** is `(h.x, h.y + h.r)` — the
bottom rim, which is where the cat's paws grip when hanging.

### Physics constants

    PHASE4_JUMP_V        = -560   // initial vy on ↑ press
    PHASE4_DIAG_JUMP_VX  =  380   // horizontal boost when ←/→ held during ↑ (~34° from vertical)
    PHASE4_LATERAL_HOP_V = -320   // upward vel for ← / → alone from a hole
    PHASE4_GRAVITY       = 1400
    PHASE4_WALK_SPEED    =  140
    PHASE4_HOLE_GRAB_R   =   30   // grab radius for auto-attach
    PHASE4_STUN_FALL     =  100   // fall ≥ this many px triggers stun on floor landing
    PHASE4_STUN_DUR      =  0.7

An earlier tuning used `DIAG_JUMP_VX = 220` — angle only 21° from
vertical, so diagonal jumps felt indistinguishable from straight-up.
Raised to 380 (angle ~34°) so held ←/→ during ↑ produces a visibly
diagonal arc.

**Air control** (`AIR_ACCEL = 800 px/s²`, capped at ±`DIAG_JUMP_VX`):
if ←/→ is held while the cat is in the air, catVX accelerates in that
direction each frame. This lets the player *steer* a jump that started
straight up — a common platformer affordance. The cap prevents air
control from exceeding a proper diagonal jump's reach.

Peak jump height = `JUMP_V² / (2·GRAVITY) = 112 px`. Chair seat is
97 px above floor and chair back is 93 px above chair seat, so one jump
reaches either (same as Phase 5). Bottom-row cheese holes' grab points
are at `y ≈ 482–532`; a straight-up jump from floor peaks at `y ≈ 473`,
just above the highest of them — the player has to be roughly under a
hole to grab it.

### The physics step

`updatePhase4Physics(t, dt)` runs each frame, structured as:

1. **Stunned lockout.** If `isStunned` and `t < stunnedUntilT`, discard
   pending input and skip the frame. Otherwise clear the flag and
   continue.
2. **On-hole input.** If `onHole`:
   - Snap `catX/Y` to the hole's grab point each frame (no drift).
   - `↑` → jump straight up (or diagonal with ←/→ held).
   - `↓` → release + small downward push; gravity does the rest.
   - `←` / `→` alone → lateral hop: `catVX = ±DIAG_JUMP_VX`,
     `catVY = LATERAL_HOP_V` (a small upward-and-sideways arc that
     may grab an adjacent hole).
   - Any release sets `justReleasedHole` for a 0.3 s cooldown so the
     cat can't immediately re-grab the same hole.
3. **Jump / drop-through from ground.** `↑` on ground jumps (physics),
   `↓` on a non-floor platform starts a 0.25 s drop-through window.
4. **Ground movement.** Held ←/→ or the click-to-walk target sets
   `catVX = ±WALK_SPEED`. Air preserves horizontal velocity — no
   mid-air steering.
5. **Integrate x** and clamp to `[FLOOR_XMIN, FLOOR_XMAX]`. If on a
   non-floor platform and `catX` is now outside its range, leave the
   ground (Mario-style walk-off).
6. **Gravity, auto-grab, landing.** In air, add gravity to `catVY` and
   integrate `catY`. Then:
   - **Auto-grab a cheese hole.** Only fires when `catVY > -100`
     (near apex or descending — a rising cat can pass over a hole to
     jump higher). Skip the just-released hole. For each remaining
     hole, if the cat is within `HOLE_GRAB_R` of its grab point,
     grab the nearest one and enter `onHole` mode.
   - **Land on a platform** (only descending): pick the topmost
     platform whose x range contains `catX` and whose surface y was
     crossed this frame. Skip the drop-through platform. First
     landing on the table sets `vaseBroken = true`.
   - **Land on the floor** (`catY ≥ FLOOR_Y`): snap to floor. If the
     fall was more than `STUN_FALL` px, enter `stunned` for
     `STUN_DUR` seconds and break the combo.

### Cheese-hole grabbing

A cheese hole is grabbable if:

- The cat's live position is within `HOLE_GRAB_R` (30 px) of its grab
  point `(h.x, h.y + h.r)`.
- The hole isn't the one the cat just released (0.3 s cooldown to
  avoid re-grabbing the same hole as soon as the cat starts rising).

The check fires **any time the cat is in the air**, including on the
way up. An earlier version restricted grab to `catVY > -100` (apex
and descent only) with the rationale that a rising cat with speed to
spare should pass through, but user feedback said the opposite —
if a jump passes through a hole's grab zone, the cat should latch on
right away. The just-released cooldown handles the "would re-grab
instantly" case that motivated the original restriction.

When multiple holes are in range, the closest one wins. On grab, the
cat's paws snap to the grab point, velocity clears, and `onHole`
becomes true. `catX = h.x, catY = h.y + h.r` — the paws sit on the
bottom rim of the hole, sprite body hangs down (that's what the
`cling` pose renders).

### Mouse spawn + auto-catch

Unchanged from the pre-refactor version. Mice spawn every 0.5 – 1.6 s
in a random free hole (free = no other mouse there, and the cat isn't
currently clinging to it). Every mouse has a `spawnT` and `duration`
(1.2 – 2.3 s); the popup follows a rise → hold → retract envelope
(`phase4PopupProgress`). Mice that time out without being caught
increment `missed` and break the combo.

Auto-catch fires only when `onHole && currentHole === mouse.hole`
AND the mouse's popup progress is past 35 %. The cat catches
automatically — the player only decides which hole to be at. Scoring:
`+1` per catch, with a combo multiplier that steps up every three
consecutive catches (`+2` after 3-in-a-row, `+3` after 6, etc). A
missed mouse or a stunned fall breaks the combo. Best score persists
in `localStorage` as `ac_phase4_best`.

### The vase joke

`PHASE4.vaseBroken` starts false. The physics-step landing code
checks if the landed platform is the side table:

    if (bestIdx === PHASE4_TABLE_IDX && !PHASE4.vaseBroken) {
      PHASE4.vaseBroken = true;
      PHASE4.vaseBreakT = t;
    }

`drawPhase4SideTable(t)` reads the flag and plays a three-phase
animation:

- **Falling** (age 0..0.4 s): table renders without the vase.
  `drawFallingVase(vx, vy, rot)` draws the vase mid-air, tumbling
  ~150° counter-clockwise as it falls from the table top to a resting
  spot on the floor just to the left of the table. Flowers, stems, and
  leaves tumble with it (all drawn under the same rotation).
- **Impact** (age = 0.4 s): a "poof" ring of 8 expanding lines fades
  in from the impact point on the floor over 0.6 s.
- **Broken** (age ≥ 0.4 s): scattered debris on the floor via
  `PHASE4_VASE_DEBRIS` (three flowers + seven shards in fixed
  deterministic positions), plus small vase remnants on the table top.
  No gameplay penalty.

An earlier version snapped straight to broken state on impact — no
falling animation. User wanted to see the vase tumble first, so the
three-phase version replaced it.

Shards use `drawVaseShard(cx, cy, rot, size, shape)` — larger polygons
than an early version, with a bright white edge stroke so they read
clearly against the dark wood floor. Three shape variants (`tri`,
`curve`, `chip`) plus varied rotations and sizes make the pile look
scattered rather than repeating.

### Cat pose

`drawPhase4Cat` selects the pose from physics state:

    if (isStunned)                pose = 'stunned';
    else if (onHole)              pose = 'cling';
    else if (!onGround)           pose = catVY > 220 ? 'falling' : 'jumping';
    else if (|catVX| > 1)         pose = 'floor-walk';
    else                          pose = 'floor-idle';

The `cling` pose has paws at the top of the sprite, then arms, head,
body, back legs extending downward — cat hanging from the bottom rim
of a hole. `falling` is the panicked spread-eagle used when the cat
is descending fast (a wall drop feels different from a graceful
jump). Two-state distinction is subtle in a small sprite but adds
motion character.

### Input handling

Both Phase 4 and Phase 5 use the same event handler:

- `←` / `→` always track physical key state (into `keyLeft` /
  `keyRight`) — needed for the diagonal-jump boost as well as for
  walking on ground.
- `↑` and `↓` are one-shot into `pendingDir` (`!e.repeat` guard).
- Phase 4 extra: while `onHole`, a fresh `←` / `→` press also sets
  `pendingDir` to `'left'` / `'right'` for the lateral-hop dispatch.
- Click sets `walkTargetX` to the clicked x; the cat walks toward it
  on whatever surface it's currently on. Vertical navigation is
  keyboard-only.

Two testing URL params:

- `?t=SECONDS` — jump the clock forward on load, for headless capture.
- `?vase=broken` — start with the vase already smashed, for inspecting
  the debris rendering without playing to unlock it first.

### The mouse sprite

`drawMouseInHole(cx, cy, holeR, popup, caught, t)` draws a small grey
mouse rising from below the hole rim, clipped to a circle so nothing
paints outside the hole opening. Full anatomy — head, ears with pink
inner-ear, black beady eyes with white highlights, snout, pink nose,
whiskers — because an early version was just amber blinking eyes and
the user (correctly) said the mouse should look like a mouse.

When caught, the sprite shrinks and emits a 6-line yellow "surprise"
burst outward. A floating `+N` popup rises from the hole for 0.9 s.

## Scene 6: Phase 5 — the birdcage room (PLAYABLE)

Three shared components debut here:

- **`drawCatPhoto(cx, cy, w, h, pose, frame)`** — a framed portrait with
  three frame styles (`gold`, `silver`, `wood`) and one of six full-body
  Felicia poses (`sit`, `lay`, `stretch`, `play`, `curl`, `hunt`).
- **`drawFeliciaPose(cx, cy, s, pose)`** — a nested switch that renders
  Felicia (white fur, pink bow, green eyes) in each pose. Shared inner
  helper `catHead(hx, hy, tilt)` for the face.
- **`drawBirdcageIntact(cx, cy, t)`** — dome cage with 9 vertical bars,
  base plate, ring hook, perch, and a small animated yellow bird with a
  hop cycle and rising music notes. Used while the cage is still on the
  table; after the cat topples it, **`drawBirdcageFallen(cx, floorY,
  ageT)`** takes over — a version tilted about the base with the door
  swung open. `ageT` animates a short tilt-and-settle over the first
  ~0.6 s so the impact reads visually.

The gallery is three photos side by side on the wall: `sit` (gold),
`stretch` (wood), `lay` (silver).

### The platformer physics model

Phase 5 is deliberately different from Phase 4. Phase 4 anchors the cat
to discrete cheese holes and animates hops between them. Phase 5 is a
Mario-style platformer: the cat has continuous `(catX, catY)`, velocity
`(catVX, catVY)`, gravity pulls it down, and every furniture surface is
a one-way platform.

`PHASE5.mode` is just `'normal' | 'won'` — the mode field is only for
freezing physics on catch. The rest of state describes physics:

| field | meaning |
|---|---|
| `catX, catY` | position (paws touch the platform / floor surface directly) |
| `catVX, catVY` | velocity (px/s). y-positive = downward |
| `onGround` | true when standing on a platform or the floor |
| `currentPlatform` | index into `PHASE5_PLATFORMS`, or `-1` for the floor |
| `dropThroughIdx`, `dropThroughUntilT` | after ↓ this platform is ignored briefly so the cat can pass through it |
| `catFacing` | +1 right, −1 left |

Sprite draws at `(catX, catY)` using the same `drawCheeseCat` from
Phase 4. Pose is derived: in air → `jumping`, on ground moving →
`floor-walk`, on ground still → `floor-idle`.

### Platforms and bird spots

Seven platforms, each with a top surface `y` and a walkable horizontal
range `[x, x+w]`:

| id | x range | y | notes |
|---|---|---|---|
| `chair1-seat` | 170–232 | 488 | left wingchair cushion |
| `chair1-back` | 182–222 | 395 | left wingchair top |
| `table` | 390–570 | 505 | centre-table top (`PHASE5_TABLE_IDX = 2`) |
| `chair2-seat` | 610–672 | 488 | |
| `chair2-back` | 622–662 | 395 | |
| `chair3-seat` | 760–822 | 488 | |
| `chair3-back` | 772–812 | 395 | |

The floor is at `PHASE5_FLOOR_Y = 585`, walkable across the whole width
`[40, W−30]`. It's not in the `PHASE5_PLATFORMS` array — it's the
default, handled as a special case in the landing check.

Bird landing spots (`PHASE5_BIRD_SPOTS`) reference platforms by
`platformIdx`. `platformIdx >= 0` means the spot sits on that
platform's top surface (so simply landing there catches the bird).
`platformIdx === -1` means the spot is unreachable (fireplace mantle,
floor-lamp shade, portrait 1 and 3 tops) — the only way to catch a bird
there is to intercept it mid-flight.

### Physics constants

    PHASE5_JUMP_V       = -560   // initial vy on ↑ press
    PHASE5_DIAG_JUMP_VX =  380   // horizontal boost when ←/→ held during ↑ (~34° from vertical)
    PHASE5_GRAVITY      = 1400
    PHASE5_WALK_SPEED   =  140

Peak jump height = `JUMP_V² / (2·GRAVITY) = 112 px`. Chair seat is
97 px above the floor and chair back is 93 px above the chair seat, so
a single jump comfortably reaches either. Floor → chair back in one hop
(190 px) is intentionally too far — the player must step through chair
seat, or take a diagonal from the table (505 → 395 is only 110 px).

### The physics step

`updatePhase5Physics(t, dt)` runs each frame:

1. **Jump input** (`pendingDir === 'up'` and `onGround`): set `catVY =
   JUMP_V`; if a horizontal key is held, add the diagonal boost;
   leave the ground. `hops++`.
2. **Drop-through input** (`pendingDir === 'down'` on a non-floor
   platform): remember which platform to ignore for the next 0.25 s,
   set `catVY = 40` for an initial downward push, leave the ground.
   If ← or → is held, also set `catVX = ±DIAG_JUMP_VX` — a
   **diagonal drop** (mirror of the ↑ + L/R diagonal jump). `hops++`.
3. **Ground movement.** If on ground, read held ←/→ (or the
   click-to-walk target) and set `catVX = ±WALK_SPEED`.
4. **Air preserves horizontal velocity.** No mid-air steering — the jump
   arc is fully predictable, which matters for intercepting the bird.
5. **Integrate `catX`.** Clamped to `[FLOOR_XMIN, FLOOR_XMAX]`.
6. **Edge check.** If still marked `onGround` on a non-floor platform
   and `catX` is now outside the platform's x range, leave the ground
   (Mario-style walk-off).
7. **Gravity and landing.** If in air, add `GRAVITY · dt` to `catVY`
   and integrate `catY`. If descending (`catVY > 0`), check every
   platform (skipping any temporarily on the drop-through list): if
   `prevY <= p.y` and `catY >= p.y` and `catX` is in range, the cat
   has crossed the surface from above — land on the highest such
   platform, snap `catY = p.y`, clear velocity. Special-case: landing
   on the table for the first time topples the cage and releases the
   bird. If no platform caught the cat but `catY >= FLOOR_Y`, land on
   the floor.

### Catch detection

Every frame after the bird has escaped, the update checks: is the cat's
sprite centre within `PHASE5_CATCH_R2` (26 px squared) of the bird AND
is the cat in the air? If both, catch. Standing still next to a
low-perched bird doesn't catch it — the bird's own `perched` update
spooks whenever the cat is on the floor within 40 px of a low landing
spot, so walking close turns into "bird flees" rather than a stealth
catch.

### The bird AI

Four states, unchanged from the pre-refactor version:

- `caged` — inside the intact cage; positions itself for the intact-cage
  renderer to draw around it.
- `flying` — parabolic arc from `fromX, fromY` to `toX, toY` over `dur`,
  with a 55 px vertical bulge at the midpoint (birds don't quite fly
  straight lines — they curve).
- `perched` — resting at `spot.x`, `spot.y` with a small idle bob; will
  take off when `pauseUntilT` elapses or when spooked.
- `caught` — sticks to the cat's mouth area.

`pickBirdNextTarget(t)` chooses the next destination. Preference weight
= horizontal distance from the cat + random jitter (0..200) + a small
bonus (30) for unreachable spots to make sure the "mid-air intercept"
gameplay actually happens. The last spot is excluded so the bird never
lands twice in a row in the same place.

**Bird sprite facing.** `drawFreeBird` calls `ctx.scale(-dir, 1)` — the
sprite geometry is drawn left-facing (head at `x=-8`, tail at
`x=+8..14`), so `dir = +1` (flying right) flips the sprite to face
right and `dir = -1` (flying left) leaves it as drawn. `b.dir` is
updated from `b.toX >= b.fromX` each frame.

### HUD and win

`drawPhase5Hud` shows *Hops*, *Best* (persisted as `ac_phase5_best` in
localStorage), and a state-dependent hint — "Leap to the table" until
the cage topples, then "Catch the bird!".

On catch, `mode` becomes `won` and a full-screen overlay fades in:
"Caught! in N hops". After a 1.2 s lockout, any key or click resets
`PHASE5.initialized = false`, which triggers a fresh session on the
next frame. Best-hop tracking uses `<` so the FIRST completed run
becomes the initial best.

## Scene 7: Phase 6 — the kittens

Same room chrome as Phase 5 but the wall gallery uses the OTHER three
poses (`play`, `curl`, `hunt`) and the floor is populated by
`drawKittensAndBowls(t)`:

- 9 milk bowls (`drawMilkBowl`) — cyan bowls with white milk, spread
  across the floor
- 8 kittens in three poses (`drawKitten` with pose `curl` / `lay` /
  `stand`). Standing kittens have a walk cycle, laying kittens have a tail
  wag.

## Scene 8: Phase 7 — the finale

This is the most complex scene and the last one built.

### Layout cache

`getPhase7Layout()` builds a 14×24 grid of hearts once, populated from
`rng(4444)` — bottom row all pink (guaranteed safe floor), other rows 70%
pink / 30% broken. A gift position is chosen from another PRNG
(`rng(9191)`), rejected until it lands on a pink cell. The layout is
cached in `PHASE7_LAYOUT` and never rebuilt.

### Cupids on three sides only

```js
function drawCupidBorder(t) {
  const downArrow = Math.PI / 4;
  // TOP — left half faces RIGHT, right half faces LEFT (converging inward),
  //        arrows angled 45° downward
  for (let x = 40; x < W - 20; x += 90) {
    const face = x < W / 2 ? 1 : -1;
    drawCupid(x, 32, 56, face, t, downArrow);
  }
  // LEFT column — face right, horizontal arrows
  for (let y = 110; y < H - 40; y += 90) drawCupid(30, y, 56, 1, y, 0);
  // RIGHT column — face left, horizontal arrows
  for (let y = 110; y < H - 40; y += 90) drawCupid(W - 30, y, 56, -1, y, 0);
  // No bottom row — the bottom is a solid pink heart safe floor.
}
```

`drawCupid` takes an optional `arrowAngle` (default 0). The
arm/bow/arrow block is wrapped in `ctx.save(); ctx.translate(shoulder);
ctx.rotate(arrowAngle); ctx.translate(-shoulder); ...; ctx.restore()`, so
the arrow rotates around the shoulder without disturbing the body.

### Broken hearts

`drawBrokenHeart(cx, cy, size)` draws two halves of a heart with a small
horizontal gap between them and a zigzag red-brown crack down the middle.
Clearly distinct from the whole pink heart.

### The cat AI as a precomputed sequence

`buildHeroSequence(L)` generates 260 moves in advance from `rng(31337)`:

```js
let r = L.rows - 1, c = L.startC, cursorT = 0.6;
for (let n = 0; n < 260; n++) {
  // 8 candidate directions — 2 walks + 3 jumps up + 3 hops down
  const cands = [];
  if (c > 0)          cands.push({ dr: 0, dc: -1, type: 'walk' });
  if (c < L.cols - 1) cands.push({ dr: 0, dc: +1, type: 'walk' });
  if (r > 0) {
    cands.push({ dr: -1, dc:  0, type: 'jump' });
    if (c > 0)          cands.push({ dr: -1, dc: -1, type: 'jump' });
    if (c < L.cols - 1) cands.push({ dr: -1, dc: +1, type: 'jump' });
  }
  if (r < L.rows - 1) {
    cands.push({ dr: +1, dc:  0, type: 'jump' });
    // ...
  }
  const m = cands[Math.floor(rand() * cands.length)];
  seq.push({ fromR: r, fromC: c, toR: r + m.dr, toC: c + m.dc,
              type: m.type, startT: cursorT, dur });
  cursorT += dur;
  r += m.dr; c += m.dc;

  // If landed on a broken heart, chain a FALL move to first pink row below.
  if (L.grid[r][c] === 'broken') {
    let fr = r + 1;
    while (fr < L.rows && L.grid[fr][c] === 'broken') fr++;
    if (fr >= L.rows) fr = L.rows - 1;
    seq.push({ ...type: 'fall'... });
    r = fr;
  }
  cursorT += rest;
}
```

`getHeroStateAt(t, L)` linear-scans the sequence to find the current
move. For walk moves it lerps position; for jumps it adds a parabolic arc;
for falls it uses `p * p` easing to feel gravitational.

### Three distinct cat poses

`drawHeroCat(cx, feetY, dir, state, t, animP)`:

- **`walk` / `idle`** — standing cat, walk-cycle legs, arched tail
- **`jump` — LEAPING pose** — this is what took multiple iterations:
  - Body elongated horizontally (17×5 ellipse, not the compact 13×5)
  - Body tilts along the arc: `tilt = (animP - 0.5) * 0.7` — nose up when
    rising, level at peak, nose down when landing
  - Front paws reach forward toward the target platform
  - Back legs stretched behind (pushing off from take-off)
  - Tail streaming straight back like an arrow
  - Three faint motion streaks trail the tail — sells the speed
  - Ears swept back
- **`fall`** — startled cat: body horizontal, all four legs splayed out
  in four directions, tail curled up

The distinct leap pose was the last user-requested change. Prior versions
used the same silhouette for walking and jumping, which read as "the
walking cat teleports" rather than "the cat leaps."

## Self-test hook

At the very end of the file:

```js
window.selfTest = function () {
  const checks = [];
  checks.push(['canvas present', !!canvas]);
  checks.push(['context 2d', !!ctx]);
  checks.push(['title draws without error', (() => {
    try { drawTitle(0); return true; } catch (e) { console.error(e); return false; }
  })()]);
  // ... same for phase0
  for (const [name, ok] of checks) console.log((ok ? '✓' : '✗') + ' ' + name);
  return checks.every(([, ok]) => ok);
};
```

Match the convention the other ports in this repo follow. Open the
browser console after loading `index.html`, type `selfTest()`, and you
get four green checks if the port is healthy. Trivial but catches the
"file loaded but scene function threw silently" class of failure.
