# Karateka — porting it

*Document four of six. [01-the-game.md](01-the-game.md) is what the game is;
[02-architecture.md](02-architecture.md) is how the program is shaped;
[03-the-code.md](03-the-code.md) walks its routines;
[05-the-fighting.md](05-the-fighting.md) reads the fighting;
[06-web-code.md](06-web-code.md) walks the port's code.*

**A port now exists.** [`../web/`](../web/) &mdash; three files, no game data
committed, everything decoded at runtime. This document was written before it
existed and its analysis of trade-offs is unchanged; [06-web-code.md](06-web-code.md)
is the walk-through of the choices that were actually made and what remains
open.


**No port exists.** This is the decision that comes before one — what the
choices are, what each costs, and what about *this* game makes it different
from the others in this repository.

---

## Read this before choosing a language

### The assets are the port

ParaTrooper's artwork is inside its executable and takes an afternoon to
extract. Hard Hat Mack's is 14 KB of sprites at a known offset. Karateka's is
**ninety files, 666 records, two parallel streams per sprite**, and it is 68% of
everything shipped.

The good news is that all of it is decoded, verified and rendering:

```
python tools/render-sprites.py --sheet KSC --toolkit <path-to>/DOS-Decompiler
  60 records -> reference/sprites/KSC.png
```

So the porting job here is not *work out the format*. It is **carry sixty frames
of rotoscoped animation across without losing the thing that made them worth
rotoscoping**, which is a different problem and mostly not a programming one.

### Two of the three hard parts are already solved

| | |
|---|---|
| the sprite format | **done** — [02-architecture.md](02-architecture.md#the-stream-is-run-length-encoded-and-0x7b-is-the-escape-after-all) |
| the shape/mask pairing | **done** — `KS` is the figure, `KM` the silhouette |
| the fighting | **read** — see [05-the-fighting.md](05-the-fighting.md); the hit test is the one gap left |

That third row used to read *not read at all*, and it was the reason a port
could not start. It can now. A guard steps forward because its decision routine
at image `0x2605` compared the distance between the fighters against a constant
and returned a move number; the move itself is five lines of text in `ALLGAL`.
What is still missing is where a strike is *scored* — see the end of
[05-the-fighting.md](05-the-fighting.md).

### The animation language is an opportunity, not an obstacle

Karateka's cutscenes run on a fourteen-command interpreter that the binary names
itself — `set_bg`, `set_fig`, `chg_fig`, `do_scr`, `wait`, `loop`,
`end_animation`. A port has two choices and they are genuinely different
projects:

- **Reimplement the interpreter** and keep the scripts as data. The cutscenes
  then behave exactly as they did, including their timing, and you have a system
  you can write new scenes in.
- **Hard-code the sequences.** Faster to a first screen, and it throws away the
  most interesting thing in the program.

The first is barely more work than the second, because the vocabulary is
fourteen verbs and most of them are one line.

### The timing problem is real and unlike the others

Karateka waits on the **BIOS tick counter at `0040:006C`**, read straight out of
memory rather than through an interrupt. That is 18.2 Hz on the hardware it was
written for, and it is a fixed rate rather than a delay loop — which makes this
game *easier* to time than [Hard Hat Mack](../../hard-hat-mack/), whose frame
rate is a counted loop tuned by ear and therefore has no number to copy.

Take 18.2 Hz as the tick and run a fixed-timestep loop over it. That is the whole
of it — for the game.

**The sound is the exception.** It is made by flipping the speaker inside
counted loops, so its pitch and length are set by how fast the CPU runs, and
the program knows it: at start-up it counts loop passes over seven BIOS ticks
and rescales its tune tempos and delays for a slow or fast machine
([02-architecture.md](02-architecture.md#it-times-the-machine-before-it-plays-a-note)).
What a port can copy exactly is the *schedule* — after how many passes of
which loop each flip happens; every one of those was checked against the
original. What it cannot copy is the length of a pass in seconds, which
nobody has measured on a 4.77 MHz PC. Synthesise the flips with one tunable
pass length per kind of loop, set it by ear, and say that you did.

---

## The options

### 1. HTML / CSS / JavaScript, on a `<canvas>`

**For:** a URL and nothing to install. `requestAnimationFrame` with a
fixed-timestep accumulator reproduces an 18.2 Hz tick exactly. The sprites
decode from the original files at load time, so there is no asset pipeline and
no copyrighted artwork in the repository. Sixty frames of animation are a
sprite-sheet problem the platform is good at.

**Against:** one language for everything. Audio needs a user gesture before it
will start, in every browser without exception.

**Effort: about a week** to a playable approach-and-fight, given the format work
already done. Most of that week is the fighting, which nobody has read yet.

### 2. C99 + SDL2

**For:** the closest mental model to the original — a framebuffer, a blit, a
byte array. The mask-and-shift blitter in
[03-the-code.md](03-the-code.md#4-the-blitter-one-byte-per-scanline) translates
almost line for line, which makes it easy to check yourself against the
original. And **the original is C**, so its structure is a fair guide to yours
in a way that hand-written assembly never is.

**Against:** a toolchain, a build per platform, and asking people to run a
binary.

**Effort: a week and a half.**

### 3. Rust + macroquad

**For:** the type system earns its keep on 666 records and two parallel streams,
where an index into the wrong table is the obvious bug and the compiler catches
it. Single binary, WebAssembly target available.

**Against:** if this would be your first Rust project, the borrow checker and a
game loop full of shared mutable state make a poor introduction.

**Effort: two weeks**, more if Rust is new.

### 4. Python + pygame

**For:** the shortest path from this documentation to something moving. The
decoder is fifteen lines and it is already written twice in this repository.
Ideal for **checking your understanding** — which is exactly what
`tools/render-sprites.py` does.

**Against:** distribution is painful. Not the answer for a port people are meant
to play.

**Effort: three days to something on screen**, then a wall.

### 5. Do not port it — run the original

DOSBox runs it today, exactly. If the goal is *playing Karateka*, that is the
honest answer and it costs nothing. There is also an official 2023 remaster.

Port it when the goal is different: to understand it, to change it, or to prove
the reading was right.

---

## Side by side

| | reach | effort | fit | shareable |
|---|---|---|---|---|
| **HTML/CSS/JS** | everywhere | ~1 week | good | a URL |
| **C99 + SDL2** | desktop, +web via Emscripten | ~1.5 weeks | best — the original is C | a download |
| **Rust + macroquad** | desktop, +web | ~2 weeks | good, and the types help | a download |
| **Python + pygame** | wherever Python is | ~3 days | fine for checking | painful |
| **DOSBox** | everywhere | none | it *is* the program | a disk image |

---

## Recommendation

**HTML/CSS/JS with TypeScript**, for the same reason as the other games here:
reach, no install, and a frame clock better than the original had.

The one argument for C that does not apply elsewhere is that **Karateka is
already C** — Lattice C 2.1, by its own admission. A C port could follow the
original's structure closely enough that the two can be compared function by
function, which is a stronger claim than any of the other games here can offer.
If the goal is *understanding* rather than *reach*, take that.

---

## Seven things that will bite

The first five were paid for while writing the other documents; the last two
came out of specifying the rules.

**1. Sprite data is column-major.** The blitter walks down a column, one byte
per scanline. Read it row-major and you get a recognisable figure lying on its
side, which looks like a discovery and is not.

**2. `0x7B v c` emits `c + 1` bytes, not `c`.** The escape returns the value
immediately and the counter supplies the rest. Off by one here and 328 of 666
records come out the wrong length.

**3. A record carries more than any one drawing uses.** The decoder yields one
byte per call and stops when the caller stops asking — the game consumed 21
bytes of one 90-byte record. Do not write a decoder that insists on consuming a
whole record.

**4. Every sprite is two records.** A shape from `KS*` and a mask from `KM*`,
same id, same dimensions, decoded in lockstep through two independent stream
pointers. Draw the shape alone and it will have no transparency. The
exception is the other way round: 56 shapes have no mask partner at all —
the ground and wall pieces among them — and the game draws those opaquely,
black included. Treat a missing mask as "transparent" and the plateau shows
through the ground.

**5. CGA packs four pixels to a byte and sprites do not land on byte
boundaries.** The original rotates and masks. A port with per-pixel addressing
does not need to — but if you are comparing your output against the original's
framebuffer, the edges are where you will differ first.

**6. The title-card font is mirrored the obvious way, and patched at
start-up.** In a glyph byte, bit 0 is the *leftmost* pixel, not bit 7; and
before any card is drawn the program swaps two glyphs, shifts the punctuation
slots and trims a pixel from twelve letters. Draw the font as stored and every
letter is reversed; skip the patch and no card matches the original's frame.

**7. Three characters that are not guards run through the guard's code.** The
eagle is the guard slot with one flag set and four moves of its own; Mariko
is the guard slot with her own library and a three-answer chooser; Akuma is
the guard slot with his. A port that gives each its own class will find the
rules spread across one routine's branches — the guard's chooser, its strike
rules and its spawn — and should read them there rather than invent them.

---

## How to know your port is right

The top of this ladder is reachable for this game, which is not true of all of
them, because the original can be run and watched.

| | check | what it proves |
|---|---|---|
| weakest | it looks like the screenshots | nothing |
| | your decoded sprites match `reference/sprites/*.png` | your decoder is right |
| | your frame matches the emulator's, pixel for pixel | your drawing is right |
| strongest | **the same recorded input produces the same frames** | the game behaves the same |

`comrun.py` runs the original and dumps its framebuffer:

```
python <toolkit>/tools/comrun.py original/KARATEKA.EXE --files original --png frame.png
```

It reaches the attract sequence — Mount Fuji, the torii gate, the hero — which
is enough to check a renderer against before any of the fighting is understood.

**The strongest rung has a ready-made input now.** The game was played to the
end under the same emulator by a small bot
([05-the-fighting.md](05-the-fighting.md#played-to-the-end)), and the run is
deterministic: every key it pressed, at every decision, is in its log, and the
original answers that sequence the same way every time — the same scenes at
the same instruction counts, to the closing card. Feed the same keys to a port
at the same decisions and compare what happens: which scene, whose health,
which frame of which move. A port that reaches the closing card with the
hero's health at 9, as the original does, has the rules right along that whole
route; one that diverges says where.

**And say what you changed on purpose.** A port that fixes the CGA palette, adds
a pause key or runs the music in tune is a better program and a different one.
The port is worth more when the reader knows which parts are faithful.
