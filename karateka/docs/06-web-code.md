# Karateka — the port's code

*Document six of six. [01-the-game.md](01-the-game.md) is what the game is;
[02-architecture.md](02-architecture.md) is how the program is shaped;
[03-the-code.md](03-the-code.md) walks its routines;
[04-porting.md](04-porting.md) picks the language;
[05-the-fighting.md](05-the-fighting.md) reads the fighting.*

The port lives in [`web/`](../web/) as three files — `index.html`, `game.js`,
`style.css` — and takes the shape [ParaTrooper's port](../../paratrooper/web/)
established: nothing loaded that is not either code or the player's own copy
of the game.

**The port ships no game data.** Every pixel on screen is decoded at runtime,
in the browser, from the `.DAT`, `.IND`, `.BCG`, `ALL*`, `BAL*` and `CAL*`
files the player already owns. Copy those into `../original/` (which
`.gitignore` blocks), serve `karateka/` from a local HTTP server, and the
port fetches them at load. That is a hard rule, and the shape of the port
proves it: `web/game.js` decodes what it reads, and a browser that cannot
find the data files renders an empty screen with an error message.

---

## What the port had to inherit from the reverse-engineering

Everything the port draws was settled first at the byte level, in the tools
that live in [`tools/`](../tools/). Two of them are the only reason any of
this is trustable:

| tool | what it settles |
|---|---|
| [`tools/referee.py`](../tools/referee.py) | runs `KARATEKA.EXE` under a Unicorn emulator, dumps the shadow buffer at `DS:0x0337` (image offset `0x6FD7` — verified by scanning the machine's own memory for `FUJI.BCG`'s bytes and finding them there), writes PNG and raw bin |
| [`tools/hook-blitter.py`](../tools/hook-blitter.py) | records every call to `draw_sprite` (`image+0x083C`) and `draw_sprite_shifted` (`image+0x0640`), capturing `fig`, `x`, `y`, resolved KSC/KMC offsets, and the sub-byte shift byte |
| [`tools/prove-blit.py`](../tools/prove-blit.py) | for each blit call, snapshots shadow before and after, computes the delta, verifies the changed rectangle is inside what our decoder predicts. All 40 blit calls of the intro passed |
| [`tools/prove-exact.py`](../tools/prove-exact.py) | the byte-exact gate: for `fig 201` (a 24×8 fence, all non-zero content, shift 0) it verifies every single byte value. 192 of 192 matched |

Two conventions came out of these that the port's blitter is built around and
neither is guessable from the file:

- **Y is exclusive-end.** A sprite drawn at `y=115` with height 50 fills
  rows 65..114, not 115..164. Verified against three different figures at
  three different heights.
- **The shift is `x mod 4`.** The blitter reads the byte at `DS:0x4227` — but
  that byte holds the *previous* call's shift at the moment we hook the entry.
  Compute it from `x`, do not read it.

The other decoder facts were already settled elsewhere:

- The `.DAT` record format (`w`, `h`, `flag`, RLE) —
  [02-architecture.md](02-architecture.md).
- The RLE (`0x7B v c` emits `v` then `c` more) — same document.
- Column-major layout (byte `k` → col `k div h`, row `k mod h`) — same.
- The `.BCG` layout (`uint16` count, then linear rows of 80 bytes) — same.
- The move-script language — [05-the-fighting.md](05-the-fighting.md).

---

## The shape of `game.js`

Read top-to-bottom, the file falls into sections that mirror the pipeline the
game itself follows:

```
constants          W, H, CGA palette
fetch helpers      one for bytes, one for text
RLE decoder        the game's routine at image 0x00B95, in five lines of JS
.IND/.DAT reader   parseIndex, decodeSprite
.BCG reader        parseBackdrop
move-script reader parseMoves
ShadowBuffer       320x200 as 80x200 bytes -- the game's own packing
assets             what has arrived; a self-test wants to introspect it
game state         hero_x, hero_y, current move, current frame
input              keyboard
render             backdrop then hero
self-test          the checks that this reads the file, not our expectations
main               fetch, self-test, tick loop
```

The `ShadowBuffer` class is the design decision worth explaining. The game
does its drawing in 80-bytes-per-row CGA packing (2 bits per pixel, 4 pixels
per byte, MSB first) because that is what a CGA chip reads. A port could
render straight to a 320×200 RGB buffer and skip the packing, and it would
be simpler by exactly the amount of code that packs and unpacks — but every
existing tool in [`tools/`](../tools/) speaks in packed bytes, and every
number in [02-architecture.md](02-architecture.md) is a byte offset. Keeping
the same packing means a sprite decoder unit-tests against the same bytes
we already know work, and the expansion to RGB happens once at the end.

The tradeoff is honest and it is documented at the class:

> "Keeping the game's byte packing means the sprite decoders can work in
> their native units and only the final 'byte → RGB' step has to expand
> pixels."

## `selfTest` and `resetGame`, and why they are on `window`

The brief calls for both, and each earns itself against a different failure.

- `resetGame(seed)` — a reproducible game. Called with no argument it seeds
  from the clock. Called with a specific number it produces exactly the same
  animation sequence twice, which is the shape a "please reproduce this bug"
  report actually takes.

- `selfTest()` — six assertions run at load and again on `T`:
  - The RLE decoder emits four bytes for `7B 55 03` (`v` then `c` more).
  - `FUJI.BCG` decodes to 320×35.
  - `CASTLE.BCG` decodes to 320×191.
  - `ALLPAL` parses to 51 moves.
  - A fighting frame has exactly two sprites.
  - `KSC[0x110]` (the 16th record in `KSC`, per prior-attempt §11.4) decodes
    to a plausible sprite size.

Each of these has failed at least once in the tools that produced the numbers
they check. The `KSC[0x110]` one is the youngest and is worth mentioning: a
tool tuned against one program's conventions can silently fail on the next
one, and a self-test that produces a table can be inspected in the console
even when the visible output looks fine.

---

## What is drawn from the reading now

Three things that stood as "not yet" in this document's first draft are
done, and the rest of this section is what remains.

**Scene composition from BAL/CAL.** Parsed the same way the fighting move
libraries are (they share the `set_fig` verb) and rendered as a wide level
canvas — BAL01 is 2160 pixels across — with a camera the game state (or,
in viewer mode, `[`/`]`) scrolls through it. The magenta plateau placeholder
is gone; when the scene loads, it draws the level's own ground, fence and
gate as figures 200..212 out of the guard-pack for that level.

**Figure-ID → IND-ID mapping.** Every fig-byte from the move scripts is
looked up as `(0x100 | byte)` against a list of packs the current scene
knows to consult. The `fig → 0x100 | fig` rule was already right for the
hero (55 of 55 ALLPAL figs hit a KSC record when checked this way);
falling through into a per-scene pack list catches the remaining cases —
ALLPAL's two fig-74/fig-75 crossovers into KS0, and every ALLGAL fig
resolving in KS2/KS3 first with KSC as a fallback for the shared pieces.
This does *not* consult the runtime table at `DS:0x423C`; it works because
in each scene's chosen pack list, each fig id is present in exactly one
pack — a property that was measured against the packs directly, not
assumed. If a future scene brings two conflicting packs into scope, the
runtime table becomes necessary.

**Sub-byte X shift and mask+shape combine.** Both live in `blitSprite`
now. Shift: for `x mod 4 != 0`, the byte is split as `shape >> shiftBits`
plus `(shape << (8 - shiftBits))` into the neighbouring byte, with the
mask following the same split. Combine: `dest = (dest & ~mask) | (shape
& mask)`. Both are verified in
[`tools/prove-blit.py`](../tools/prove-blit.py) for the intro's 40 blit
calls and byte-exactly for fig 201 in
[`tools/prove-exact.py`](../tools/prove-exact.py).

**No mask means opaque, not transparent.** An earlier draft of this
document claimed the opposite — that a zero shape byte with no mask
should be treated as transparent, "the right behaviour for structural
figures". That was wrong. The correction came from
[`tools/hook-bal.py`](../tools/hook-bal.py) plus a byte-level diff
against the game's own BAL00 shadow: fig 200 and 206 (the ground pieces)
have no mask pack and write shape bytes of `0x00` right over the
plateau, producing black patches where the ground meets the plateau's
dither. Treating those as transparent left the plateau showing through
and cost about ~500 bytes on the 16000-byte BAL00 shadow. Setting the
mask fallback to `0xFF` (fully opaque) is what the game actually does.

## Scene composition, and the seven bugs a byte-diff caught

Rendering the game's own opening screen (`BAL00`, "Mariko kneeling by
the palace gate under Mt. Fuji") is the smallest complete test of the
scene composition path. Running the game under Unicorn, hooking
`draw_sprite`, dumping the shadow at `DS:0x0337` right after the seven
BAL00 blits finish, and byte-diffing against what the port renders from
the same BAL00 file — that comparison started at 34% match. Each byte
that differs is a bug in the port's rendering, so each round of
diffing pointed to one. Seven rounds took BAL00 from 34 % to **100 %**:

| step | fix | match |
|---|---|---|
| baseline | FUJI at Y=0, no sky-fill, no plateau-fill, structural = transparent | **34 %** |
| FUJI at Y=80 | horizon offset — the game does not draw FUJI.BCG at Y=0 but at Y=80, putting the mountain base at the top of the ground plateau. 195 of 206 distinctive FUJI bytes match at Y=80, zero at Y=0 | (visual close) |
| sky-fill Y=0..107 = 0x55 | game clears the upper region to cyan before drawing anything; the port did the same clear only within FUJI.BCG's own 35 rows | **90.6 %** |
| no-mask = opaque | fig 200/206 (the ground pieces) have no mask pack; the game writes their shape bytes — including `0x00` — straight through. Treating zero as transparent (the port's earlier behaviour) let the plateau show through where the ground meant to draw black | **92.8 %** |
| plateau alt `0x66`/`0x99` | Y=155..183 is a dither: odd rows `0x66`, even rows `0x99`. Same striped magenta at 4× scale but a diff away by pixel — invisible on screen and 100 % byte-miss on those rows | **98.1 %** |
| post-FUJI overlay | Y=106 = `0xFF` (white horizon rail), Y=107..109 = `0x00` (black band under the rail), Y=114 = `0x00` (base; FUJI's row 34 is cyan and would otherwise leak). None of these are in FUJI.BCG — the game overwrites them after drawing the backdrop. Caught by inspecting the shadow *before* any BAL blit fired: the horizon rail was already there | **99.2 %** |
| plateau range Y=154..183 | off-by-one on both ends. The port had Y=155..183 (29 rows); the game has Y=154..183 (30 rows). The 0x99/0x66 phase also flips accordingly (even rows = `0x99`, odd = `0x66`) | **99.9 %** |
| snap after 7 blits, not 6 | this one is a comparison bug rather than a port bug. The game's BAL00 sequence is 7 blits (`fig 91` from the earlier title, then six ground/fence/post pieces). The port draws all seven; the game snapshot the port was being diffed against was taken after only six had fired. Re-snapping after seven closed the last 9 bytes | **100 %** |

That is **16,000 of 16,000 bytes match** against the game's own
composed shadow — every pixel of Karateka's opening screen, as
composed by the game itself, is exactly what the port produces from
the same input files.

**All seven fixes are now in [`web/game.js`](../web/game.js).**
Two are new methods on `ShadowBuffer` (`fillSceneLayers` and
`overlayHorizon`); the `blitSprite` mask fallback is a one-line
change; FUJI's Y offset lives in a `backdropY` helper. The order
matters:

```javascript
render(shadow) {
  shadow.clear();
  shadow.fillSceneLayers();                     // sky + plateau bands
  if (bcg) shadow.blitBackdrop(bcg, backdropY(viewer.backdrop));
  if (viewer.backdrop === 'FUJI.BCG')           // post-FUJI cleanup:
    shadow.overlayHorizon();                    //   horizon rail + shadow
  renderScene(shadow) || ...                    // BAL/CAL figs on top
  // then, in game mode, drawFighter for player and guard
}
```

## Screen-by-screen against the game

The methodology above generalises. The tools that made it possible are
kept for the next surprise:

| tool | what it does |
|---|---|
| [`tools/snap-series.py`](../tools/snap-series.py) | dumps the shadow every N instructions across the attract loop; the manifest lists which BAL/CAL files were open at each sample so we can guess which scene the game was in |
| [`tools/snap-at-step.py`](../tools/snap-at-step.py) | one-shot: run to a target step, dump the shadow. Useful for catching a moment between two `draw_sprite` entries — the hook can only fire on entry, so between blit N and blit N+1 we cannot hook, but we can sample often enough that one sample lands there |
| [`tools/hook-bal.py`](../tools/hook-bal.py) | records every `draw_sprite` call with fig/x/y and its step, plus a shadow dump after the Nth blit |
| [`tools/port-replica.py`](../tools/port-replica.py) | Python 1:1 of `web/game.js` scene rendering; `--extra ID,X,Y` overlays a character; `--dump-bin` writes the raw shadow for diffing |
| [`tools/diff-shadows.py`](../tools/diff-shadows.py) | triptych game / port / diff, with the byte-match percentage in the header |

What the comparison reached:

| screen | match | notes |
|---|---|---|
| BAL00 clean (backdrop only) | **100.0 %** | the seven fixes above |
| BAL00 + Mariko (fig 163 at 70,167) | **94.7 %** | the character bytes match; the remaining diff is the fence being in a different phase of the game's redraw cycle |
| BAL00 + hero walking (fig 10 at 240,165) | **81.5 %** | the hero matches; the game shows an extra Akuma silhouette (fig 47/102) at the gate that the port does not add |
| BAL00 + all demo figs at once | **76.2 %** | worse than the single-character case, and the reason matters: the game runs an erase-then-draw cycle each frame, showing one instance of each moving figure; feeding the port every position seen in a 1M-step window overlays them all |
| BAL01, BAL02, BAL03 | not captured | the attract loop cycles between title (BAL00) and CAL01 cutscene; without triggering the game past intro (which needs a specific key it reads from port 0x60), the later scenes never get drawn, so there is no reference to diff against |

The 81.5 % vs 94.7 % gap is worth taking seriously. It says: *the port's
scene composition is right and the port's single-character render is
right, but a live demo has multiple animated figures in flight at once,
and reproducing a specific moment from the game byte-perfectly requires
reproducing the game's own animation state machine.* The port does have
its own state machine (game mode's clear-and-redraw loop), it just is
not the demo's state machine — one runs a fight against player input,
the other runs a scripted attract sequence.

## What the port stands in for

Three approximations remain, worth stating plainly:

**Guard AI is a distance-band substitute for `0x2605`.** The game's own
chooser is a tree over pose, pose and distance —
[docs/05-the-fighting.md](05-the-fighting.md) reads it — and picks moves
from the guard's library based on both its own pose and the player's.
The port's `guardAction` picks by distance and a small random tilt: far
means run, near means strike, just-hit means step back. It is enough to
have a fight, not enough to have *the* fight.

**Striking frames are approximated** as "the middle frame of any strike
move". The real flag is set_pos's second byte, a single bit that marks
which specific frames within a strike animation actually make contact.
The approximation is right often enough that punches connect at a
believable rate, but wrong sometimes both ways.

**Fighters do not flip horizontally.** The guard sprites come from
ALLGAL, which is drawn from a guard-on-the-right point of view; the hero
sprites come from ALLPAL, drawn from hero-on-the-left. There is no
horizontal mirror in `blitSprite`, so a hero who reached the right side
of a guard would look wrong. The port keeps the hero on the left and the
guard on the right — one round only, no level progression yet.

## The fighting, wired

`game.js` now has two modes, switchable with `G` (game) and `V` (viewer).
Viewer keeps its original job of stepping through a library's animations
so a decoder failure is visible. Game runs a live fight: a hero on the
left driven by keyboard, a guard on the right driven by
[`guardAction`](../web/game.js), both animated by playing their
libraries frame-by-frame, both drawn by the same `blitSprite` the
viewer uses.

- Player input: `←`/`→` walk, hold `Shift` to run, `A`/`S`/`D` for
  three heights of punch, `Z`/`X`/`C` for three heights of kick,
  `R` restart, `P` pause.
- Health bars top-left (player) and top-right (guard), each 26 pixels
  wide because the game's own cap is 26 HP.
- Fight ends when either HP reaches zero, `game.message` is set, and
  `tickGame` freezes until `R`.

The hit test is a distance-band lookup with a small pose adjustment,
which is the shape of the game's own `0x43AA` but not its exact tables
— see the "stands in for" section below for the honest scope.

---

## How to run it

```
cd karateka
python -m http.server 8765
```

Open <http://localhost:8765/web/> in a browser. Buttons at the top
switch mode, library, backdrop, and scene. Console: `selfTest()` and
`resetGame(seed)` are both attached to `window` for scripting; the
latter takes an optional seed so a fight can be reproduced.

The rendering pipeline (decoder, blitter, scene composition, backdrops)
is verified byte-level against the game's own shadow buffer — the
Screen-by-Screen section above walks through those numbers. **The
gameplay feel — how fights read, how the guard behaves, whether input
lag is right — has not been play-tested during this session.** A
page that loads is not a page that plays well; verify the feel
yourself, and if a specific bug reproduces, use `resetGame(N)` with
the same N to freeze the RNG.
