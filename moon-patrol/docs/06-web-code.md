*Document six of six. See [05-web-architecture.md](05-web-architecture.md)
for what the port is; this document walks the routines in the order
`game.js` presents them.*

# Moon Patrol web port — the code

`web/game.js` is one file, ~730 lines, no dependencies. This document is
the narrative that connects its sections in reading order.

Every section header quotes the fenced-comment banner in `game.js` so a
jump-to-header search brings you to the right place.

## 1 · constants

The first ~180 lines. Every constant carries a tag saying which source
names it: `[DOS]`, `[arcade]`, or `[invented]/[inferred]`.

**From the DOS reading (`../symbols.json`):**
- `W = 320, H = 200` — CGA mode 4 from `enter_cga_graphics` (file 0x573)
- `PAL.{black,cyan,magenta,white}` — palette 1 from the same
- `HUD_H`, `FIELD_TOP`, `FIELD_BOTTOM`, `BANNER_H` — split layout from
  `program_crtc_split` (file 0x85D); heights inferred from the referee
  screenshot `reference/clean-final.png`
- `BUGGY_FIELD_W = 142` — `check_bounds_5C_A3_8E` at file 0x3975
- `TERRAIN_CELLS = 0x8D` — `advance_scroll` at file 0x20DB
- `SCORE_DIGITS = 8` — `add_bcd_score` at file 0x2249, cells `[0x7A..0x81]`
- `BUGGY_VX_{LEFT,RIGHT,IDLE}` — `check_var13_set_10_{FC,04,00}` trio at
  file 0xE2B/0xE4B/0xE6B (L/R/idle mapping `[inferred]`)

**From the arcade docs (Computer Archeology):**
- `TICK_HZ = 56.74` — `Moon_Patrol_Hardware_Info.txt`, VBLANK
- `ARCADE_SCORE[]` = `[0, 20, 50, 80, 100, 200, 300, 500, 800, 1000]` —
  Z80 address 2A0C in `Moon_Patrol.txt`
- `SCORE_ROCK_{SMALL,MED,LARGE}` = 20 / 100 / 300 — arcade rocks store
  their own tier byte at `(IX+$07) & 0x0F`
- `SCORE_CRATER_JUMP = 50` — labelled row in the score table
- `SCORE_CHECKPOINT = 0` — arcade "passing point" queues `Adjust Score`
  with A=0 (Z80 1525..1528). The bonus arrives at the goal, not per
  checkpoint.
- `SCORE_GOAL_BONUS = 1000` — arcade goal-bonus branch at 2876
- `SCORE_UFO = 300`, `SCORE_TANK = 200`, `SCORE_MINE = 100`,
  `SCORE_BOMB = 100`, `SCORE_PLANT = 80` — inferred to specific tiers
- `WAVE_PHASES[]` — eight-row per-class spawn-interval table indexed
  by checkpoint. Values `[invented]` for feel; the *shape* is arcade
  (script-driven, not random).
- Sound-effect names (`shot`, `jump`, etc.) map to arcade command
  numbers 01/02/10/11/12/13/14/17/1D/1F from the sound-jump-table at
  F400 in `Moon_Patrol_Sound.txt`
- `Audio_.startContinuous` / `stopContinuous` implement the arcade's
  continuous voice per plant (sound command 16 "Space plant" running
  on AY0 channel A while alive)

**Invented:**
- Jump kinematics (`JUMP_VY`, `GRAVITY`, `JUMP_HOLD_FRAMES`)
- All entity sizes (`ROCK_W/H`, `UFO_W/H`, `BOMB_W/H`, `TANK_W/H`,
  `MINE_W/H`, `PLANT_W/H`)
- The specific `WAVE_PHASES[]` interval values (the *shape* is arcade)
- Fire cooldown, tank fire cooldown
- Scroll speed and mountain parallax speed
- `FRAMES_PER_CHECKPOINT` (arcade uses a scroll-position test, not a timer)
- `ATTRACT_IDLE_FRAMES`, `ATTRACT_DEMO_FRAMES` (arcade uses menu_loop's
  own timers)
- Point values assigned to specific enemies where the arcade extracts
  do not label the callsite (tank, mine, bomb, plant — all `[inferred]`)
- Title-screen illustration (drawn from scratch to match the shape of
  the referee frame; the arcade sprite bitmap is copyrighted)

## 2 · utilities

`clamp`, and the RNG.

**On the RNG.** There is no `Math.random`-equivalent named in
`../symbols.json` — see [`04-porting.md § 1`](04-porting.md#1-there-is-no-named-rng).
The port defaults `rand = Math.random`, and `resetGame(seed)` swaps in
`mulberry32(seed)` for reproducibility. mulberry32 is **not** the DOS
binary's generator; it is just a deterministic function of a seed. If the
game's real generator is ever named, `rand` gets set to it and the
`resetGame(seed)` path can either wrap it or keep mulberry32 as a
port-side testing tool.

## 3 · audio

Web Audio, one square-wave oscillator per triggered effect. The
primitives are `beep(freq, ms, type, vol)` and `sweep(from, to, ms, vol)`,
and five named effects: `shot`, `jump`, `crash`, `ufo`, `point`.

None of the frequencies come from the DOS binary. The two note tables at
DS:0x556F and the two sound engines at file 0x5115 / 0x5134 could be
decoded — that would let the port play the exact same tones — but the
work is out of scope for v1 and is called out in
[`05-web-architecture.md § Sound`](05-web-architecture.md#sound).

`Audio_.init()` is called on the first key press, which is when the
browser will allow the `AudioContext` to start. The click hint over the
canvas exists because of this browser policy, not because the game
needs it.

## 4 · input

The DOS binary reads keyboard state through a one-byte cell at DS:`[0x100]`
that its own int 9 ISR at file 0x405 writes to (bit 7 = ready, bits 6..0
= scancode). Menu polls (`peek_key` / `wait_key_up` / `clear_key`) treat a
press as a *discrete event*: read once, clear the ready bit, wait for
release. Game polls (via `read_dir_pad_x` at file 0xE93) treat a press as
a *level* — is left held, is right held, is neither.

The port matches those two shapes with a `Keys` object (current level)
and a `Pressed` object (edge-triggered, consumed by `takePress`). Menu
keys — F1, F2, K, J, 1, 2, B, C, S — use `takePress`. Movement keys —
Left, Right, A, D — use `Keys` directly. Fire keys (Z, X) use
`takePress` for one shot per press, matching the arcade's fire button.

The `swallow` list in the `keydown` handler names the keys the port
prevents from doing browser things: Space (scroll), arrows (scroll), F1
(help), letter keys (nothing important, but shielded so a page-level
shortcut cannot swallow a game input).

## 5 · state

`const game = { ... }` — a single flat state object. The comment above
each field names the DS-relative address in the DOS binary that it
mirrors, wherever a mapping exists:

| port field | DOS binary cell | in symbols.json |
|---|---|---|
| `game.score` | `[0x7A..0x81]` | `score_ones_digit` and 7 siblings |
| `game.buggyX` | `[0x99]` | `buggy_x_current` |
| `game.buggyY` | `[0x9A]` | `buggy_y_current` |
| `game.buggyVX` | `[0x10]` | `buggy_vx` |
| `game.soundOn` | `[0x216]` | `sound_enable` |
| `game.course` | (menu key B/C) | `init_script_pointers` at file 0x3D89 |

Fields with no cited address are port-side inventions (e.g. the JS entity
arrays; the DOS binary uses four-slot arrays at DS:0x82B, 0x867, 0x8BE,
0x8F3, 0x90A which the port's plain JS arrays approximate but do not
mirror byte-for-byte).

`game.state` uses `State.{TITLE,OPTIONS,PLAYING,DYING,OVER}`. The DOS
binary has its own state variables (`state_A0`, `state_BB`, `state_BD`,
`state_C0`, various others) whose semantics are not settled in the
reading. Naming these in the port is a "when we know" item.

## 6 · resetGame(seed)

Two jobs: reset all `game` fields to their round-start values, and
either wire `rand` to `Math.random` (no seed) or to `mulberry32(seed)`
(with one). Exposed as `window.resetGame` for the browser console.

## 7 · step — the four dispatch arms

`step()` is a switch on `game.state`. Each arm handles one state:

### `stepTitle()`
- F1 → reset and enter `PLAYING`
- F2 → enter `OPTIONS`
- Otherwise increment `attractTimer` (would drive the demo run if we had
  one; v1 does not implement the attract-mode demo the DOS binary shows
  after 500 timer ticks — `menu_loop` at file 0x5C0)

### `stepOptions()`
- K/J: input mode (v1 ignores because joystick is unsupported)
- 1/2: player count (single-player only in v1)
- B/C: course
- S: sound toggle
- F1: start game
- Esc: back

### `stepPlaying()`
The main game update. In order:

1. `P` toggles pause.
2. `M` toggles mute.
3. Left/right keys set `game.buggyVX` to −4, +4, or 0. This mirrors the
   `check_var13_set_10_FC/04/00` trio at file 0xE2B/E4B/E6B; the values
   are from the reading, the mapping to keys is `[inferred]`.
4. Space / W / Up: if on the ground, launch a jump — `buggyVY = JUMP_VY`,
   `onGround = false`. If held while rising, subtract a small extra
   thrust for `JUMP_HOLD_FRAMES` frames. **All numbers here are
   invented.**
5. Z / X: forward / upward fire, subject to `fireCd`.
6. Physics: `buggyX += buggyVX` clamped to `[BUGGY_FIELD_X0,
   BUGGY_FIELD_X1 - 16]`; `buggyY` integrates `buggyVY` under gravity
   with a floor at `BUGGY_Y_GROUND`.
7. Death and respawn: if dead, `deathTimer` counts up; at 90 ticks
   respawn with `respawnImmune = 120`, or if out of lives go to `OVER`.
8. Scroll: `scrollX += WORLD_SCROLL` (1.35× on Champion course).
9. Checkpoint: every `FRAMES_PER_CHECKPOINT` ticks, advance the letter
   and add `SCORE_CHECKPOINT`. **Both invented.**
10. `spawnStep`, `entityStep`, `collisions`, `particles`.

### `stepOver()`
- Wait 3 s, then any of Space/F1 returns to title.

## 8 · spawn and entity step

`spawnStep(speed)` reads `wavePhase(game.checkpointIx)` to get the
current phase's per-class spawn intervals (in ticks), then decrements
six counters and pushes new entities when they hit zero. Champion
course scales all intervals to 0.82 (tighter spacing). A ±4 tick
wobble driven by `(game.tick >> 3) & 7` keeps intervals from feeling
robotic without introducing randomness.

Phase transitions happen at `PHASE_BOUNDARIES = [2, 4, 6, 9, 12, 15, 19, 26]`:

| phase | checkpoints | new arrivals |
|---|---|---|
| 0 | A-B | rocks, craters |
| 1 | C-D | + UFOs |
| 2 | E-F | + tanks |
| 3 | G-I | + mines |
| 4 | J-L | + space plants |
| 5 | M-O | denser |
| 6 | P-S | denser |
| 7 | T-Z | maximum |

Rocks come in three sizes (small = 20 pts, medium = 100 pts, large =
300 pts) picked from `((game.tick >> 2) + game.spawnRock) & 7` -- a
per-spawn deterministic hash. `Math.random()` no longer drives any
gameplay-affecting spawn decision; only cosmetic sparks still use it.

`entityStep(speed)` moves everything that scrolls with the world by
`speed` and everything that moves independently (UFOs, bombs, tank
shots, up-shots, forward shots, sparks) by its own velocity. Craters
have a `jumped` flag: when the buggy is airborne and its centre passes
the crater's trailing edge, the flag flips and `SCORE_CRATER_JUMP` is
awarded (arcade "Successfully jumping a crater", 50 pts).

The DOS binary keeps four slots per class (`for_each_slot_XXX` iterators
loop `mov cl, 3`); the port uses uncapped JS arrays with `splice` on
death. That is a **deliberate departure** — the four-slot cap is a
consequence of the 6502's addressing modes, not a game-design choice, so
mirroring it here would replicate a constraint without a reason.

## 9 · collisions

Four passes:

1. Forward shots against rocks, tanks, mines, and space plants. AABB,
   integer coordinates. All four award their `SCORE_XXX` and play
   `rockExplosion`.
2. Upward shots against UFOs and against bombs mid-fall / tank shots
   in flight.
3. Buggy against rocks, tanks, bombs, mines, and space plants. The
   ground-level ones (tank, mine) only kill when `onGround` — the jump
   defeats them. **The space plant is tall enough that jumping does
   not clear it**, matching the arcade behaviour where the plant sprite
   occupies the same vertical extent as the buggy's arc.
   `respawnImmune` gates all of these.
4. Buggy against craters — only if `onGround` is true, which is what
   makes the jump matter, and which is where the arcade's 50-pt
   crater-jump bonus comes from.

The DOS binary's collision routines are `collide_half_af_vs_46` at file
0x17A4 and `call_51E1_then_collide_D8` at 0x3FB2, both of which do a
6502-style `sub` + `cmc` compare of one Y coordinate against another.
The port does the same test on `y + h/2` bounds without the carry
inversion, because JavaScript comparisons return the result of the
comparison directly.

## 10 · render — draw()

Layers in reading order, from back to front:

- Black background (already `fillRect`ed)
- Mountains (parallax, scrolled by `mountainX`)
- Terrain surface (magenta strip below `BUGGY_Y_GROUND + 6`)
- Terrain edge wobble (a two-sine noise, invented; the DOS terrain is a
  141-cell strip of tile indices)
- Craters (black bowls cut into the magenta)
- Rocks, UFOs, bombs, shots, particles
- Buggy (respawn immunity blinks every 4th frame)
- HUD (two magenta-bordered panels, matching `reference/clean-final.png`)
- Bottom banner (only on title/options/over)
- State overlays (title text, options menu, game over, pause)

`drawText` renders the pixel font — 4×5 for narrow letters, 5×5 for the
five letters that need the extra column (M, N, W, X, Y).

## 11 · sprite drawers

Each entity has a small `drawXxx` function that does a handful of
`fillRect`s in one of the four palette colours. None of these are pulled
from the DOS sprite atlases — the atlas record format is not decoded and
the DOS artwork is copyrighted anyway. The shapes are drawn from scratch
to match the general look of the referee frames.

Per-entity drawer:

| function | draws | notes |
|---|---|---|
| `drawBuggy` | player buggy | colour swaps on Champion course (cyan → magenta) matching arcade `champColors` at E0F9 |
| `drawMiniBuggy` | HUD life counter icon | fixed cyan+white |
| `drawRock` | ground obstacle | magenta with white highlights |
| `drawTank` | tank | magenta hull, cyan turret + barrel pointing left, white tread |
| `drawMine` | ground mine | pulsing dome; magenta or cyan depending on `anim & 0x1F >= 0x0B` (arcade colour shift after 11 frames) |
| `drawPlant` | space plant | cyan stem, two pairs of leaves flapping by `anim >> 2`, white bud |
| `drawUfo` | flying enemy | cyan hull, magenta underside, white marker |
| `drawBomb` | dropped bomb OR tank shot | vertical droplet if `!fromTank`, horizontal streak if `fromTank` |
| `drawShot` | player shots | 1-pixel-wide streak |
| `drawPart` | spark particle | 1×1 in the spark's colour |

## 12 · main loop

`requestAnimationFrame` drives a fixed-timestep accumulator. Up to 8
`step()` calls per RAF frame; anything beyond that is dropped (a hidden
tab or a stopped debugger should not become a runaway).

## 13 · selfTest

Six checks that run in ~1 ms. Full list in
[`05-web-architecture.md § Testing`](05-web-architecture.md#testing).
The one worth calling out here is check 6 — running 300 ticks of a fresh
game — because it is what catches the class of bugs (a null read on a
freshly-spawned UFO, a crater with zero width) that only appear once the
entity system is running for a while. When adding a new entity, extend
the test to spawn at least one and run through its lifetime.

## What is *not* in the file, deliberately

- **No sprite atlases.** No PNG imports, no packed hex constants, no
  ROM decoder. If a future revision decodes the atlas format, extracted
  art still cannot ship — the root [CLAUDE.md](../../CLAUDE.md) rule
  covers extracted sprites the same as the binary.
- **No wave-script data.** The DOS binary's two scripts at DS:0xC46 and
  0xC93 would let the port reproduce the exact wave sequence; without
  the opcode meanings decoded, v1 spawns rocks/craters/UFOs on random
  intervals.
- **No emulation of the CRTC or the scanline table.** The HUD/field
  split is done by draw order, not by a hardware split.

Each of these has an entry in
[`05-web-architecture.md § What is *not* here`](05-web-architecture.md#what-is-not-here-and-where-each-item-goes-when-it-becomes-possible)
saying what would need to be true for it to arrive.
