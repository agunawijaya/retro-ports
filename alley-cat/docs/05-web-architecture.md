# Alley Cat — the web port, top down

*Document five of six. See [01-the-game.md](01-the-game.md),
[02-architecture.md](02-architecture.md), [03-the-code.md](03-the-code.md)
for the 1984 program, and [04-porting.md](04-porting.md) for why HTML/Canvas
was chosen as the target. The code walkthrough is
[06-web-code.md](06-web-code.md).*

The port lives at [`../web/`](../web/) and is three files:

    web/
    ├── index.html    the page frame, tab bar, canvas element
    ├── style.css     dark showcase theme
    └── game.js       the rendering — one file, no build

Open `index.html` directly in a browser. There is no build step, no bundler,
no server, no image assets. Everything on the canvas is drawn from
JavaScript.

## What the port includes today

Eight scenes are rendered:

| tab | what it shows |
|---|---|
| **title** | Moonlit alley: fence, five metal trash cans, cat walking the fence top with idle behaviours (sit / lick paw), a cat popping out of a random can every ~7 s to throw a fish bone in a parabolic arc — bones accumulate on the pavement below |
| **phase 0** | Cozy sitting room: cream wallpaper, wood floor, animated brick fireplace with real flames, mantle with brass clock + two candles, two wing chairs and coffee table on the left, brass floor lamp on the right, cat curled in front of the fire |
| **phase 2** | Underwater pond: teal-to-navy gradient, wavy pink surface with animated ripples, angled sunbeams, seven varieties of ornamental fish swimming in both directions, rising bubbles, pond floor with pebbles and swaying weeds |
| **phase 3** | Library: wall-mounted brick fireplace on the left, two chairs, two floor lamps, giant bookshelf on the right with eight rows of colourful books (some slanted, some fallen, gold title bands) and three flower pots on top |
| **phase 4** | Swiss-cheese wall: massive yellow cheese wedge with darker rind and 14 dark mouse holes — some holes occasionally show a pair of amber eyes peeking; small fireplace and side table on the right |
| **phase 5** | Birdcage room: gallery of three framed full-body Felicia photos (sitting, stretching, laying), central table with domed birdcage containing an animated yellow bird + music notes, three wing chairs, small fireplace, floor lamp |
| **phase 6** | Kittens: fireplace, second gallery of three Felicia photos (playing, curled, hunting), floor lamp, two chairs, and eight kittens in three poses (curled / laying / standing) scattered on the floor with nine cyan milk bowls |
| **phase 7** | The finale: cupids on three sides (top row facing inward, arrows angled 45° downward), tight brickwork grid of hearts (pink = safe platform, black = broken); a cat wanders across the platform — walks, jumps (with a distinct airborne leaping pose), falls through broken hearts; wrapped gift on a random pink slot |

The reference frames these were built against are in
[`../reference/screens/`](../reference/), captured from the byte-identical
rebuild. The port is a **reimagining**, not a pixel copy: the arrangement of
furniture, the placement of trash cans, the seven rooms — those follow the
original. Colour, lighting, texture, animation, and detail are new.

## The four load-bearing decisions

### 1. Canvas 2D at 960×600, procedurally drawn

The canvas is native 960×600. Everything is drawn from JavaScript on each
frame with `ctx.fillRect`, `ctx.arc`, `ctx.bezierCurveTo`, gradients, and
`ctx.rotate`. There are no PNG/JPG assets, no external image loads, no font
files. The one thing that *is* loaded from the OS is the browser's cursive
font stack (for the "Alley Cat" title and the handwriting graffiti) — with
Bradley Hand, Segoe Print, Marker Felt, and Comic Sans as fallbacks.

Trade-off: procedural drawing is slower per frame than blitting sprites,
but the whole port fits in one JavaScript file and any change to a scene is
a code edit, not an asset-pipeline round trip. For the scale of art the game
needs — a dozen or so recognisable interior scenes — this is fine.

### 2. Scenes as a dispatch table

At the top of the render loop:

```js
const SCENES = {
  title:  drawTitle,
  phase0: drawPhase0,
  phase2: drawPhase2,
  phase3: drawPhase3,
  phase4: drawPhase4,
  phase5: drawPhase5,
  phase6: drawPhase6,
  phase7: drawPhase7,
};

function loop(nowMs) {
  const t = (nowMs - startMs) / 1000;
  ctx.clearRect(0, 0, W, H);
  (SCENES[scene] || drawTitle)(t);
  requestAnimationFrame(loop);
}
```

Each scene function takes one argument: `t`, seconds since page load. The
scene draws itself from scratch every frame. There is **no persistent
world state that is mutated per frame** — everything visible is derived
from `t` (and a few once-baked textures).

Why: this means the state at any given `t` is fully reproducible. That
matters for headless screenshot capture (see decision 4) and it matters
for reasoning about the code — "what does the scene look like at second
25?" is answerable by reading the drawing functions, not by simulating
frames forward.

### 3. Baked textures for expensive, unchanging noise

Repeatable noise — wood grain on the fence, cobblestones on the pavement,
brick on the fireplace, the wood floor — is drawn ONCE into an offscreen
canvas the first time a scene renders it, then blitted every frame after.
The helper is `baked(key, w, h, drawFn)`; the cache is a `Map<string,
HTMLCanvasElement>`.

Without this the fence alone would spend a few milliseconds per frame
generating knot placements and grain streaks. With it, the fence draw is
one `drawImage` call.

Deterministic noise uses a tiny mulberry32 PRNG (`rng(seed)`) rather than
`Math.random`, so the same seed always produces the same texture — knots
in the same places, cobblestones scattered the same way. Same reasoning as
decision 2: reproducibility.

### 4. `?t=SECONDS` URL param for headless capture

Chrome headless with `--virtual-time-budget=5000` doesn't fire
`requestAnimationFrame` reliably — the debug overlay caught `t` stuck at
`0.08` after 5 s of virtual time budget. That's an rAF-throttling
behaviour, not a bug in the port; a real browser advances `t` normally.

For screenshot tooling, `?t=5.5` in the URL runs

```js
const startMs = performance.now() - startOffsetT * 1000;
```

so the very first frame reports `t ≈ 5.5` and the scene draws its
five-and-a-half-second state on that one frame. This is what makes the
Phase 7 cat visible mid-jump in `previews/phase7.png` — the capture used
`?t=0.8` to land inside the first jump's animation window.

The parameter is a no-op in interactive use.

## The animation model

Two flavours of animation:

**Time-driven** — used for everything visible: fire flicker, water ripples,
fireflies, cat walking cycle, fish swimming, bird hopping, cupid bobbing.
These read `t` directly. E.g. flame flicker is
`0.88 + Math.sin(t * 5.3) * 0.06 + Math.sin(t * 9.7) * 0.04`. Fish position
is `(t * speed + offset) % (W + 100)`.

Frame timing: because every draw call derives its state from `t`, dropping
frames doesn't accumulate error. If the browser only manages 30 fps
instead of 60, the animation still looks right — it just updates half as
often.

**Precomputed sequence** — used for the Phase 7 cat AI, which needs to
make discrete decisions (which platform to jump to next) over time. Rather
than mutate state in an incremental update loop (which was fragile under
headless capture, per decision 4), the entire sequence of ~260 moves is
generated once from a fixed seed:

```js
function buildHeroSequence(L) {
  const seq = [];
  let r = L.rows - 1, c = L.startC, cursorT = 0.6;
  for (let n = 0; n < 260; n++) {
    // pick a random neighbour cell
    const m = cands[Math.floor(rand() * cands.length)];
    seq.push({ fromR: r, fromC: c, toR: r + m.dr, toC: c + m.dc,
                type: m.type, startT: cursorT, dur: ... });
    cursorT += dur;
    r += m.dr; c += m.dc;
    // chain a fall if we landed on a broken heart
    if (L.grid[r][c] === 'broken') { ... }
    cursorT += rest;
  }
  return seq;
}
```

Given any `t`, `getHeroStateAt(t)` linear-scans the sequence to find the
current move and interpolates position within it. The cat's state is a
pure function of `t`.

## Draw order matters — an early bug worth remembering

Phase 7 originally drew hearts BEFORE the fence base and the horizon of
the courtyard scene. The fence extended down to `y=600` and repainted over
the pavement gradient underneath. Pavement was drawn, then hidden.

The fix was one line — draw the fence FIRST, then the ground on top of it:

```js
drawFence();
drawFenceGraffiti();
drawGround();          // covers the fence base with pavement
drawCanCastShadows();
drawTrashCans(t);
```

The lesson generalises. Any time a texture "disappears" in this code base,
the first thing to check is the draw order in the scene function that owns
it.

## Preview snapshots

Static PNG captures of each scene at a representative moment live in
[`../web/previews/`](../web/previews/). These are the same headless-Chrome
captures used to verify each iteration, kept in the repo for quick review
without having to run the port. They are regenerated whenever a scene
changes materially.

## Playable so far, and what is still art-only

**Phase 4 (cheese wall) is playable.** Full walk-and-climb mechanics: cat
starts on the floor, walks left/right, leaps up to holes in the wall or
onto the furniture (chair, side table), climbs from chair-seat to
chair-back to a cheese hole, catches mice as they poke out of whatever
hole it's currently clinging to. Score + best in the HUD, best persists
via `localStorage`. See [06-web-code.md § Scene 5](06-web-code.md) for the
five-mode state machine and every rule.

The other seven scenes are **art-only**. Missing from those:

- **Game loop** (score, lives, level progression) — the phase machine at
  CS:0x479 documented in [03-the-code.md](03-the-code.md) is not wired
  to switch scenes.
- **Input handling for the rest** — only Phase 4 captures keyboard/click.
  Other tabs are view-only.
- **Sound.** The port is silent throughout. The five sound primitives
  documented in [02-architecture.md](02-architecture.md)
  (`sfx_start_tone`, `beep_blocking`, etc.) haven't been ported.
- **Sprite-bank decoding.** The original's three CGA sprite banks
  (`sprite_data_bank_a/b/c`, ~12.5 KB total) hold the cat's walking
  frames, the mice, the birds, and so on. None of that binary data is
  parsed — every sprite (including the Phase 4 gameplay ones) is drawn
  procedurally.

Phase 4 was written to a house rule where the gameplay logic was
reconstructed from the visible CGA reference frames and the user's design
choices, not lifted from a decode of the original phase-4 handler bytes.
The porting brief in [04-porting.md](04-porting.md) still applies for
turning the other six phases into real games — the sprite-bank decode it
names as the blocker is unchanged.
