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

## Scene 5: Phase 4 — the cheese wall

`drawCheeseBlock(x, y, w, h, t)` draws a wedge shape (top-left corner
lower than top-right, sloped rind) filled with a yellow gradient. Then 14
mouse holes are punched with `ctx.createRadialGradient` from dark inside
to slightly lighter outer ring, plus an inner rim highlight arc simulating
light from top-left.

The "eyes peeking" trick uses `Math.floor(t / 3)` as a slow cycle counter
and shows amber eyes in a rotating subset of holes:

```js
const peekCycle = Math.floor(t / 3);
const showEyes = ((i + peekCycle * 3) % 5) === 0;
if (showEyes) {
  // draw two little amber eyes at the centre of the hole
}
```

## Scene 6: Phase 5 — the birdcage room

Three shared components debut here:

- **`drawCatPhoto(cx, cy, w, h, pose, frame)`** — a framed portrait with
  three frame styles (`gold`, `silver`, `wood`) and one of six full-body
  Felicia poses (`sit`, `lay`, `stretch`, `play`, `curl`, `hunt`).
- **`drawFeliciaPose(cx, cy, s, pose)`** — a nested switch that renders
  Felicia (white fur, pink bow, green eyes) in each pose. Shared inner
  helper `catHead(hx, hy, tilt)` for the face.
- **`drawBirdcage(cx, cy, t)`** — dome cage with 9 vertical bars, base
  plate, ring hook, perch, and a small animated yellow bird with a hop
  cycle and rising music notes.

The gallery is three photos side by side on the wall: `sit` (gold), `stretch`
(wood), `lay` (silver).

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
