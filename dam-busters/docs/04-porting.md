# The Dam Busters — porting it

*Document four of six. See [01-the-game.md](01-the-game.md) for what
the game is, [02-architecture.md](02-architecture.md) for how the
shipped program is put together, and [03-the-code.md](03-the-code.md)
for the annotated routines. [05-web-architecture.md](05-web-architecture.md)
and [06-web-code.md](06-web-code.md) will describe the port this
document argues for; they do not exist yet.*

This page is about the decision, not the code. It says what the port
must reproduce, what it can drop, what target language to write it
in, and what will bite in that target. Names in `back-tick` are from
`symbols.json`; addresses are image offsets.

---

## What the port has to reproduce

Doc 02 enumerated nine phases and four subsystems. The port owes
each behaviour a 1984 player would recognise. It does not owe
byte-identity — a port is a rewrite informed by the disassembly, not
a translation of it — but the *shape* comes from the reading.

**The nine phases,** dispatched through `phase_dispatch` (`0x00B9`)
per frame and initialised through `phase_init_dispatch` (`0x08D2`) on
transition — flight forward, bomb-run with target-lock rectangle at
`[0x3EBD..0x3EC3]` and hold-timer at `[0x3E64]`, rear-gunner view
(camera negated), bomb options, map screen, cockpit controls with
`menu_action_dispatch` at `0x1610`, target/altitude selector,
scoreboard, idle. Doc 02 has the table.

**The four subsystems,** each of which the port *replaces*:

- **Video** — CGA mode 4 at `0xB800`, framebuffer written directly;
  `blit_rect` at `0xDA39`; scan-line table at `0xE4A2`.
- **Keyboard** — INT 9 handler at `cs:0xD271`; writes `input_flags`
  at `[0x0D1C2]` every frame — bit 0 up, 1 down, 2 left, 3 right.
- **Timer and music** — INT 1Ch at `cs:0xE24E`, 18.2 Hz. Drives the
  frame-tick bit and walks `song_note_streams` at `0xADCB` — byte
  streams of duration + note-index — programming PIT channel 2 via
  the frequency table at `0xE151`.
- **PRNG** — 256-byte LFSR at `prng_state_bank` (`0xE381`).

Two pieces sit *above* the phase machine. The **frame loop** at
`0x006B` — CLI/STI transfer of `tick_flags` into a working copy,
wait for bit 0, `per_frame_step` + `check_phase_transition`, then
`call word [bx + phase_dispatch]`. And the **drawing DSL** — the
ten-opcode bytecode interpreter at `draw_display_list` (`0xDF0E`),
called 34 times across every phase's init. Each phase's screen is a
**program** in this language; the port must be able to run those
programs or it will re-encode every panel by hand.

## What the port does not need to reproduce

- The **16-round hardware-detection loop** at `0x0000..0x002E`. The
  browser will not fail its own memory check.
- **INT 9 replacement.** `KeyboardEvent` gives `keydown`/`keyup` and
  tracks what is held.
- **INT 1Ch.** `requestAnimationFrame` runs the loop.
- **CGA mode 4's interlaced framebuffer.** A `<canvas>` is a flat
  array; the interleave table is a workaround for hardware a browser
  does not have.
- **PIT channel 2 speaker programming.** Web Audio produces square
  waves at any frequency, mixed cleanly.
- **PRNG state seeding rituals.** A small seeded generator will do.
- **The three toolkit fixes in `comrec.py`** and the 124 trailing
  bytes past the load image. Those are for reading and rebuilding
  the 1984 program.

## What the port has to reproduce faithfully

Not fidelity to the bytes — fidelity to the **feel**. Dam Busters is
a slow, patient flight simulation whose hard part is knowing when to
release the bomb. Small changes to that feel are visible.

- **The phase state machine.** Transitions happen on frame
  boundaries via `requested_phase` at `[0x0D1CD]` and
  `check_phase_transition`. Whether input takes effect this frame or
  the next matters when the player is holding two keys.
- **The bomb-release timing.** The hold-timer at `[0x3E64]`
  accumulates while the target is inside the lock rectangle and
  releases when it crosses threshold. The port owes this as its own
  state, not "press to fire".
- **The map cursor wrap.** Which regions are adjacent (which key
  moves to which) is baked into `map_screen_step`; owe the same
  connectivity.
- **The end-run reason codes and crash messages.** Nine reasons at
  `0x7F2C`. 1943's vocabulary, worth preserving verbatim.
- **The music.** `song_note_streams` at `0xADCB` is a bytecode the
  port can play verbatim: same duration/note-index pairs, same
  terminator-and-loop convention that `music_loop_ptr` implements,
  frequencies re-encoded from `0xE151`. The songs then sound like
  the original because they *are* the original.
- **The rate.** Timer ISR runs at 18.2 Hz. Whether flight views feel
  better at 60 Hz interpolated is a decision to record (see
  [What is left open](#what-is-left-open-deliberately)) but the
  **logic** advances at 18.2 Hz, always.

## Target language

**Vanilla JavaScript on an HTML5 `<canvas>`, no build step, no
framework, no npm.** The other five ports in this repository —
Karateka, Hard Hat Mack, Zaxxon, Tapper, ParaTrooper — are the same
shape: three files under `web/`, opened directly in a browser.

The rule is in the root CLAUDE.md:

> Each port should be runnable with no build step — open `index.html`.

A build tool is a dependency that rots. `npm install` on a project
written five years ago has a good chance of not producing the site
the author wrote. A single HTML file loading a classic-script
`game.js` will still open in a browser in twenty years. This project
is meant to *stay readable*: the point is teaching, and teaching
requires that a reader can open the port, look at the code, change a
line, refresh, and see what changed. Every layer between the source
and the running program is a layer that stops the reader.

Dam Busters fits the pattern. It is small and single-threaded;
TypeScript's ceremony would obscure the point. Its 3D pipeline is a
2×2 matrix multiply plus a translation; WebGL would be more
machinery than the whole pipeline is in the original. Its 320×200
CGA framebuffer maps directly to `<canvas>` 2D `ImageData`. No
argument for deviating, and none is made.

## The specific decisions

- **Rendering.** `<canvas>` 2D context, 320×200 backing store, CSS-
  scaled to 4× (or configurable). Every phase's screen is rendered by
  evaluating that phase's display-list bytecode; each opcode becomes
  a JavaScript function. Sprites decode 2bpp CGA into 32bpp RGBA
  once at load. **WebGL is rejected** — overkill for a 4-colour game.
- **Input.** `KeyboardEvent` `keydown`/`keyup` maintaining a
  held-keys bitmap that reproduces `input_flags` — the same bit
  layout the 1984 INT 9 handler writes at `[0x0D1C2]`. The '1' key
  (per doc 01, `0x7111` reads `1 - DAM APPROACH`) is the acknowledge
  key the shipped game uses.
- **Audio.** Web Audio API, one `OscillatorNode` with
  `type: 'square'`, frequency reprogrammed on each note. The port
  walks `song_note_streams` verbatim in JavaScript. **`<audio>`
  elements are rejected**: the songs are procedural, not sampled.
- **Timing.** `requestAnimationFrame` drives a real-time accumulator
  that fires the 18.2 Hz logical tick. Rendering can happen at
  whatever rate the browser offers; game logic advances at its own
  rate. A headless self-test can then replay a mission at 10,000
  ticks per second, and the game does not speed up on a 144 Hz
  display.
- **Determinism.** Expose `resetGame(seed)` on `window`. Root
  CLAUDE.md is explicit and ParaTrooper learned it the hard way: a
  game you cannot replay is a bug you cannot fix. No argument seeds
  from the clock; the argument version is what the self-test uses.
- **Testing.** Expose `selfTest()` on `window`. Runs headless from a
  fixed seed and checks: the map screen appears from a fresh reset;
  transitioning to phase 0 advances `plane_x`/`plane_y` monotonically;
  a bomb released inside the lock rectangle at the correct hold-timer
  value transitions to phase 7 with the expected outcome code.
  Failures name the state that disagreed. Same shape as ParaTrooper's
  `selfTest`.
- **Modules.** No `import` graph. Classic scripts loaded from
  `index.html`. `game.js` is fine as one file until it grows past
  comfort; splitting later is mechanical.

## What could go wrong

**A `Date.now()` reference sneaks in.** One call to `Date.now()` or
`performance.now()` outside the accumulator, and the game becomes
non-deterministic. Keep every non-deterministic input at the *edge*
— the accumulator, the RNG seed — and forbid the rest of the code
from touching them. Grep for `Date.` and `performance.` before commit.

**Fixed-point drift in the 3D projection.** The 1984 pipeline runs
in 16-bit registers with `>>` scaling by 64. JavaScript's `Number`
is 64-bit float; straight arithmetic will *nearly* reproduce the
original but positions can drift by one pixel at the edges. If it
does, use `Math.trunc` after each multiplication and `& 0xFFFF`
where the original register overflowed. Costs nothing — a few
projections per frame, not per pixel.

**The sprite tables are on the other side of the copyright rule.**
`_data_spans` names sprite banks — `sprite_base_bank` at `0xB544`
(7,307 bytes), `phase_sprite_bank_a` at `0x886B` (5,973 bytes),
`results_sprite_bank` at `0xA10E` (~3,000 bytes), and more. The
reconstruction that contains them is gitignored and must stay that
way. Two acceptable resolutions:

1. **Derive at runtime from the user's own copy.** The port ships a
   decoder. The user places `DAMB.EXE` in `original/DAMB.EXE`; the
   port loads and decodes sprites in the browser. Karateka does this
   — see [`../../karateka/PORT-BRIEF.md`](../../karateka/PORT-BRIEF.md).
   Likely the answer for Dam Busters given the volume of art.
2. **Draw everything.** ParaTrooper does this because its sprite
   format was never decoded. Works for a small game.

`PORT-BRIEF.md` §5 explains how Karateka kept extraction verifiable:
hook the game under Unicorn (`comrun.py`) at the frame the sprite is
drawn, read the shadow-buffer, compare pixel for pixel. Dam Busters
has an added complication — `draw_display_list` composes each phase
from multiple sprite calls, so the referee wants full-frame
comparison. Same tool, same discipline.

**The unresolved indirect at `0x06F53`.** `symbols.json` records one
`jmp bx` whose target comes from `mov si, [0x6EAB] / mov bx, [si]` —
a callback stored in memory whose writer is not visible statically.
The port will need to either identify it via a runtime hook or
reproduce its *effect* by reading behaviour off the shipped game.
The one open reading item the port cannot ignore.

## What is left open, deliberately

- **60 Hz interpolated vs. 18.2 Hz flat.** Logical tick is 18.2 Hz.
  Rendering at 60 Hz with position interpolated feels smoother; flat
  18.2 Hz gives the exact motion of the 1984 game. ParaTrooper
  interpolates because it is an arcade game. Dam Busters is a slow
  flight sim; the flat option is arguably more faithful. Try both,
  record which you shipped.
- **WASD alongside the arrow keys.** 1984 uses arrows; modern
  convention is WASD. Support both, or decline on the grounds that
  the game is a period piece.
- **The intelligence-report city labels.** 'DUSSELDORF', 'KOLN' (the
  German spelling of Köln, in the file), 'BERLIN' and the rest —
  accurate for 1943; not the port's place to modernise. Ship as-is;
  the historical framing is the point.

None of these blocks anything. They are the surface at which "port"
starts to mean "your port".

---

Doc 05 will describe the port's own architecture — the shape of
`game.js`, how phases become JavaScript state, how the display-list
opcodes become functions, and where the seams between logic and
rendering fall.
