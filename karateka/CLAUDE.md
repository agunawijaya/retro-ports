# Working on Karateka

Context for an agent picking up work in this folder. The
[root CLAUDE.md](../CLAUDE.md) still applies — this only adds what is specific
to Karateka.

Read [docs/02-architecture.md](docs/02-architecture.md) first — it is how the
program is shaped, and everything else hangs off it. The other four are
[01-the-game.md](docs/01-the-game.md),
[03-the-code.md](docs/03-the-code.md),
[04-porting.md](docs/04-porting.md) and
[05-the-fighting.md](docs/05-the-fighting.md).

## State of the work

**Read in full, with the denominators stated.** The reconstruction is
byte-identical; the code region is entirely read; the data segment is 100%
accounted for *by byte*.

| | |
|---|---|
| routines | 120 of 120 |
| data-segment addresses the code names | 312 of 312, all 1,642 references |
| the data segment **by byte** | 59,670 of 59,670 — **100%**, in 58 contiguous spans with no gap |

**Quote the third row whenever you quote the second.** "312 of 312 addresses"
was true when it was written and read as completeness, and it is a fact about
*references* — it says nothing about the 59,670 bytes between them, which were
40% accounted for at the time. Half the data segment is a 24,260-byte arena of
zeroes that files are read into; empty is finished, unread is work, and only
counting bytes tells them apart.

The names are also not equally strong. Each `why` in `symbols.json` says which
kind of evidence it rests on, and seven of them were checked against Lattice C's
own library and came back right.

| | |
|---|---|
| rebuild | byte-identical, rung 1b — the whole `.EXE`, header and all |
| code region | **91.9% recovered**, and nothing left in it looks like unreached code |
| the ninety data files | container **and** record format settled — 666 of 666 |
| the compiler | **Lattice C 2.1**, stated in the binary's own data segment |
| the animation system | a 14-command **compiler**, opcode = 2 × command index |
| the fighting | choreography read — 150 moves in three plain-text libraries |
| the fight AI | **found and read** — `0x2605`, a tree over pose, pose and distance |
| the reading | 218 routines — **every call target and every tail-call entry** — 338 named addresses, **100% of the data segment by byte** |
| the hit test | **read** — `0x43AA`, a distance-band lookup on the target's stance |
| health and damage | **read** — 13 points a side, both bars regenerate to a cap of 26 |
| the map | **read** — four scenery scripts, `docs/01-the-game.md` |
| documents | **6 of 6** — `docs/06-web-code.md` walks the port |
| referee | **proven** — `tools/prove-exact.py` matches 192/192 non-zero bytes of fig 201 (the fence); `tools/prove-blit.py` matches all 40 blit boxes of the intro; the shadow buffer's address is `image + 0x6FD7`, verified by scanning memory for `FUJI.BCG`'s bytes |
| port | **playable, byte-identical on BAL00** in `web/` — three files, no game data committed. Decodes and renders at runtime from `../original/`. Two modes: viewer (steps through libraries) and game (input, guard AI, hit test, health bars). Fig-ID lookup uses the game's own `(0x100 \| byte)` convention across a scene-picked pack list; BAL/CAL scene composition wired; sub-byte X shift and mask+shape combine in the blitter. **BAL00 composes byte-for-byte with the game** — 16000/16000 match against a hooked shadow snapshot after all seven BAL00 blits (see `docs/06-web-code.md` for the seven fixes that took it from 34 % to 100 %). What is honest to say is not there: the game's own `0x2605` AI tree (the port uses a distance-band substitute), pose-flag striking (approximated as the middle frame of a strike), level progression, horizontal sprite flipping, attract mode, and cutscene playback. See `docs/06-web-code.md` |

## The fighting is data, and it is readable text

The whole account is in [05-the-fighting.md](docs/05-the-fighting.md); the part
you need before touching anything here is that **`ALLPAL`, `ALLGAL` and
`ALLVAL` are ASCII**, and between them hold 150 blocks of animation script — one
block per move.

```
set_pos,11 12 pal08      inc_x,4    set_fig,2 -4 165    set_fig,47 15 131
```

A frame is exactly five commands — `set_pos`, `inc_x`, `set_tune`, `set_fig`,
`set_fig` — in that order, **293 times out of 293**. Two sprites per fighter per
frame. `inc_x` is the travel, and move index 8 is +20 px in all three libraries,
which makes it the literal answer to *what makes a guard step forward*.

```
python tools\read-moves.py --library ALLPAL
python tools\read-moves.py --block pal08
```

**Do not call `0x1364..0x1660` an interpreter.** It is a compiler: each of its
fourteen arms emits an opcode and parses its arguments with `sscanf` at
`0x5741`. That mistake is on the record in
[03-the-code.md](docs/03-the-code.md#2-the-animation-language).

### The fight globals, all of them

| | |
|---|---|
| `[0x102]` / `[0x104]` | the level's left and right walls |
| `[0x10C]` / `[0x110]` | pose, player / guard — set from each frame's first byte |
| `[0x10E]` / `[0xBCD5]` | x position, guard / player |
| `[0x114]` / `[0x116]` | hit points, opponent / player — 13 each, cap 26 together |
| `[0x118]` / `[0x11A]` | **not health** — the guard's two-stage patience timer |
| `[0x11E]` / `[0x124]` | hits taken, opponent / player |
| `[0x126]` / `[0x128]` | regeneration owed, +3 per hit |
| `[0x130]` | the level, 1..7 |
| `[0x142]` | a per-level flag; adds one to the section index |
| `[0x156]` | 0 = the human plays, 1 = the demo plays |
| `[0xC3A6]` | which of the six sections of a scenery script is live |
| `[0xD5AA]` | an opponent is on screen |
| `[0xD5AC]` | that opponent's aggression: 0, 12 or 24, dealt at random |
| `[0xEC]` / `[0x112]` | this frame is a striking frame, player / guard |
| `[0xD5AE]` / `[0xD5B0]` | that frame's stance value, fed to the hit test |
| `[0xFC]` / `[0xFE]` | just been hit, player / guard |
| `[0xF8]` | the player is down |

**`random(n)` is at `0x629`** and returns 0..n. Eleven call sites, none of them
choosing a room — see [01-the-game.md](docs/01-the-game.md#what-is-random).

### Where the fight lives, in one table

| | player | guard |
|---|---|---|
| compiled byte code | `DS:0xC428` | `DS:0xCE3E` |
| index of its 42 moves | `DS:0xC3D4` | `DS:0xCDEA` |
| current frame cursor | `DS:0xC3D2` | `DS:0xCDE8` |
| pose code, set every frame | `DS:0x010C` | `DS:0x0110` |
| x position | `DS:0xBCD5` | `DS:0x010E` |
| picks the next move | `0x205E` or `0x2A49`, by `[0x156]` | `0x2605` |
| advances one frame | `0x245C` | `0x25C8` |
| starts a move | `0x234D` | `0x248B` |

A frame is **17 bytes**, opcode-then-arguments: pose at +1, a flag-and-seven-bits
at +2, signed travel at +4, and `0xFF` at +0 ends the move. The level's x bounds
are `[0x102]` and `[0x104]`.

**Every one of those was checked against the running game, not just read.**
207 of 209 in-phase samples have the pose global equal to the frame's byte; 38
of 40 moves changed x by exactly the frame's `inc_x`.

## Source you can rebuild

`recovered/karateka.asm` is correct and is not source: ten thousand
instructions under labels named after their own addresses. `symbols.json` holds
the reading — **218 routines and 338 globals**, each with the evidence
for its name — and the toolkit's `annotate.py` applies them.

**Everything is named**, and it is worth saying against which denominator.
The count used to be 120 of 120 `push bp` prologues, which was true and was
the wrong set: Lattice C's runtime is hand-written assembly with no prologue,
and so are the tail entry points the compiler generates inside a function. By
the measure that matters — **addresses the program actually calls** — 56 were
unnamed while the figure read 100%. All 165 are named now, along with every
data-segment address the code references.

**The finding that moved this most was not a naming technique.** `DS:0x0337` is
a 16,000-byte off-screen CGA frame, 200 rows of 80, ending at `0x4217` exactly
where the blitter's own globals begin. Forty addresses that looked like separate
variables were rows inside it — which is why they were only ever written with
`0x5555` and `0x2055`. Those are pixels. **A `[di + 0x337]` in the listing is
not a global with a displacement; it is the screen.**

A routine has an entry point, callers and behaviour you can probe. A global has
only its uses, and a global used twice leaves almost nothing to reason from.

The game side was read. The library side was settled three ways — *probed* with the arguments a specification takes,
*watched* during a real run to see what the program actually passes, and *read*
where the body says it outright. Which one applies is in each `why`, because
the names are not equally strong and pretending otherwise would undo the point
of keeping the evidence at all.

```powershell
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

Three steps: reconstruct, name, **rebuild and compare**. The third is the point.
Names are applied as `%define`s and label renames only, so NASM emits the bytes
it emitted before they existed — *naming a thing must not change it* — and the
script refuses to report success on anything short of the original's SHA-256.

```nasm
guard_choose_move:
    push bp
    sub  sp, 0xc
    cmp  sp, word [stack_limit]
    ...
    cmp  word [guard_pose], 0x46
    jne  L_0263A
    cmp  word [patience_b], 0
```

**Globals are renamed only inside brackets.** `mov ax, 0x116` is the constant
278, not `player_health`; rewriting it would be a lie that still assembles.

**None of the output may be committed.** `recovered/` is gitignored because a
byte-identical reconstruction is the game, named or not. What is worth keeping
is `symbols.json`, and it is small enough to read.

## Regenerating

```powershell
python <path-to>\DOS-Decompiler\tools\comrec.py `
       original\KARATEKA.EXE --out recovered\karateka.asm
```

**No flags.** `comrec.py` recognises the single-segment MZ, strips the header
and takes the entry from `CS:IP`.

| | |
|---|---|
| SHA-256 | `c8736bba30cd31d966756c812b673f56b753061354ffb67fca835c3ca2e9f2b2` |
| size | 87,990 bytes (512 header + 87,478 image) |
| instructions | 10,589 (987 pinned) |
| code region `0x0000..0x6C9D` | 27,805 bytes, **91.9% recovered**, 99.1% carrying a decoded instruction |
| whole file | 29.2% |

**Verifying it takes two steps, not one**, because the source covers the image
and the header is written out beside it:

```powershell
nasm -f bin -o image.bin recovered\karateka.asm
cmd /c copy /b recovered\karateka.mzheader + image.bin rebuilt.exe
```

`rebuilt.exe` must equal `original\KARATEKA.EXE`. **Comparing `image.bin`
against the `.EXE` is the mistake to avoid** — it is 512 bytes short and will
look like a failure that is not one.

## The three things that will trip you

**The drawing is C-calling-convention, the inner loops are not.** 117 `push bp`
prologues, thirty with a stack check against `[0x17]` — but the blitter and the
decoder have no prologue at all and keep their state in globals. Mixed C and
assembly, so do not expect one reading style to fit the whole program.

**Addresses are file offsets minus 512.** The MZ header is stripped before the
walk, so image offset `0x2` is file offset `0x202`. The documents use image
offsets. Get this wrong and every lookup lands half a kilobyte early.

**Code and data have different bases.** The entry stub sets `DS = image +
0x6CA0` once and never touches segments again, so a bare `[0x0F]` in the code
means image offset `0x6CAF`. The code region ends at `0x6C9D`, which is the
same boundary found by walking rather than by reading the constant.

**`reference/KARATEKA_NOCHK.EXE` is a patched copy someone else made.** It is
not the shipped game. Decompiling it by accident produces a byte-identical
reconstruction of the patch, and nothing would say so. Everything established
so far is from `original/KARATEKA.EXE`.

## The data files

Twenty-eight `.IND`/`.DAT` pairs, plus loose ones. The container is settled and
verified against all twenty-eight at once:

```
.IND    (uint16 id, uint16 offset) pairs, both ascending
        terminated by 0xFFFF followed by the total length
        padded to a fixed size with 0x80
.DAT    the records back to back, then exactly 128 bytes of 0x80 padding
```

A record's length is the next record's offset minus its own.

**The record format is settled, and it was settled by running the game.** Two
routines, found by hooking the buffer a `.DAT` was loaded into and asking which
instructions read it:

```
image 0x00B95   the decoder -- run-length, called once per output byte
image 0x00AE7   the blitter -- one byte per scanline, add di, 0x50
```

```
record:  byte 0   width, in bytes
         byte 1   height, in scanlines
         byte 2   a flag -- 0x01 in all 666
         byte 3+  the stream, then one trailing byte

stream:  0x7B v c   emits v, then c more of v   (c + 1 in total)
         any other  emits itself
```

The `+1` matters: the escape path returns the value immediately and the counter
then supplies `c` more.

**666 of 666 records** decode with no escape running off the end and yield at
least `width × height` bytes. The check discriminates — count-as-written gives
318, the neighbouring byte as escape gives 80, no escape gives 88.

**Do not test "decodes to exactly `w×h`".** That reaches 338 and stalls, because
it was never a property of the format: the decoder is called once per output
byte and stops when the caller stops asking. The game consumed 21 bytes of one
90-byte record. Chasing the rest with `(w+1)*h` and friends reaches 491 and is
curve-fitting.

### Which file holds which actor

**[inferred] — read off the rendered sheets, not stated anywhere in the binary.**
The binary names the fourteen files (`ks0`…`ksi`) and says nothing about who is
in them, so this is identification by appearance and can be checked the same
way it was made:

| | | |
|---|---|---|
| `KSC` | **the hero** | 60 frames — stances, punches, kicks, the run, falling, impact stars |
| `KS4` | **Akuma** | 22 — a heavy figure in an ornate robe and wide sash, plus #332 defeated |
| `KSI0` | **Mariko** | 11 — slim, long gown, long hair, walking and kneeling |
| `KSI4` | the final scene | hero, Akuma and Mariko together, plus the gate |

`KS0`…`KS3` are the guards. Every one of these files also carries scenery — the
palace gate is the *largest* record in three of them — so height is what picks
the people out: a standing figure is 30–60 scanlines and ≤ 14 bytes wide, a gate
is 99 tall, a banner 63 bytes across. That filter is what `--figures` applies.

```
python tools\render-sprites.py --sheet KSC   --toolkit <path-to>\DOS-Decompiler
python tools\render-sprites.py --figures KS4 --toolkit <path-to>\DOS-Decompiler
```

## The backdrops are a different format, and a much simpler one

`FUJI.BCG` and `CASTLE.BCG` share nothing with the sprite records beside them.
No run-length coding — there is not one `0x7B` in either file — no column-major
read, and no CGA bank interleave:

```
uint16   the byte count that follows
then     a raw CGA mode 4 bitmap, 80 bytes per scanline, row after row
```

The count divided by 80 is the height. `FUJI.BCG` is 2,800 bytes, so 320 × 35 —
a horizon band, not a screen. `CASTLE.BCG` is 15,280, so 320 × 191.

**Read it straight and both come out right on the first attempt**, which is the
check that matters: a wrong row stride shears the picture visibly and a wrong
interleave splits it into two combs. Neither happens.

```
python tools\render-sprites.py --backdrop FUJI.BCG --toolkit <path-to>\DOS-Decompiler
```

The lesson is worth keeping: **having just decoded a hard format, the next file
is not necessarily in it.** Trying the sprite decoder here first costs nothing
and finds nothing, and it is an easy hour to lose looking for compression that
was never applied.

## A prediction that was made and failed

The README predicted this would be a mechanical 6502 translation like
[Hard Hat Mack](../hard-hat-mack/), since Karateka is Jordan Mechner's Apple II
game. It said so in a form that could fail, and it failed:

| | Hard Hat Mack | Karateka |
|---|---|---|
| `cmc` | 391, 99% straight after a compare | **0** |
| `cmp` / `sub` | 431 | 913 |

Broderbund's conversion was a rewrite where Electronic Arts' was a translation.
**Leave the prediction in the README with the result beside it** — a falsified
prediction on the record is worth more than a quiet deletion.

**A second claim was made here and is also withdrawn.** This file used to end
that table with *"hand-written 8088 assembly"*, on the strength of a prologue
density of 0.4 per KB. That figure is over the whole file, and 68% of the file
is data; over the code region it is about four per KB, which is ordinary for a
compiler. The binary settles it outright — `Lattice C 2.1` sits at the start of
its own data segment. **Not a translation and not hand-written: a C program.**

## What to do next

**Three items that stood here are closed**, and were left standing after they
were — read [05-the-fighting.md](docs/05-the-fighting.md) rather than this list
if the two ever disagree again. The input chain *is* traced, `0x205E` through
the pose switch to `in al, 0x201`; the pose switch's seventeen cases *are*
mapped onto eight arms; and the stance classes *do* have an explanation — reach
16 standing, 12 crouched, and classes 3 and 4 are the recovery frames of `pal05`
and `pal06`, which nothing can hit. `0x425E` is not the joystick either. It is
Hercules detection.

What is actually left:

1. **A C reconstruction**, which is a different and weaker claim than this one:
   assembly that reassembles exactly proves the bytes, C that compiles to the
   same bytes would prove the design. It needs **Lattice C 2.1**. The copy on
   this machine is 3.10 (1985–86) and ships no library at all, so `libscan.py`
   has nothing to match against.
2. **A container reader in the toolkit**, not in this folder — an index-and-heap
   pair is not Broderbund's invention and the next game may use one.
3. **The Apple II original** is in `reference/apple-ii/`, six disk images. Now
   that the DOS version is known *not* to be a translation, the comparison is
   more interesting rather than less: two independent implementations of one
   design.
4. ~~**A port.** Nothing blocks one now; see [04-porting.md](docs/04-porting.md).~~
   **A port exists and plays** in [`web/`](web/) — hero, guard, hit test,
   health bars, and the level's own scenery composed from BAL/CAL. What was
   on this list before is done: sub-byte X shift, mask+shape combine, and
   the fig-ID mapping now uses `(0x100 | byte)` looked up across a scene's
   pack list (not the runtime table at `DS:0x423C`, but the same answer for
   scenes where each fig id resolves in exactly one loaded pack — verified
   for BAL00..BAL03).

   **Byte-verified against the game's own shadow buffer.** Hooking
   `draw_sprite` in Unicorn, dumping shadow at `DS:0x0337`, and diffing
   against a Python replica of the port's renderer got the numbers below.
   Each round of diffing pointed at one bug in the port; seven rounds took
   BAL00 from 34 % to **100 % — 16000 of 16000 bytes match**:

   | screen | match | evidence |
   |---|---|---|
   | BAL00 clean (backdrop only) | **100.0 %** | 0 bytes differ against the game's shadow after all seven BAL00 blits |
   | BAL00 + Mariko (fig 163 at 70,167) | **94.7 %** | character bytes match; diff is fence being in a different redraw phase |
   | BAL00 + hero walking (fig 10 at 240,165) | **81.5 %** | game shows an extra Akuma silhouette (fig 47/102) at the gate that the port does not add |
   | BAL00 + all demo figs at once | **76.2 %** | fundamental: reproducing a live demo frame needs the game's animation state machine, not a static composition |

   Tools that made the comparison possible are kept — see
   [docs/06-web-code.md#screen-by-screen-against-the-game](docs/06-web-code.md).

   What is honestly still not the game:

   - **Guard AI is a substitute.** The port's `guardAction` is a distance
     band with a small random tilt; the game's own `0x2605` is a tree over
     pose, pose and distance and picks moves the substitute never will.
   - **The striking-frame flag is approximated** as "the middle frame of
     any strike move". The real flag is set_pos's second byte (see
     [docs/05-the-fighting.md](docs/05-the-fighting.md)) and only some
     frames within a strike are hittable.
   - **No sprite flipping.** The guard uses ALLGAL sprites which are drawn
     from its own point of view; there is no horizontal mirror in the
     blitter, so a hero moving to the right side of a guard would look
     wrong. The game keeps the hero on the left.
   - **No level progression.** One scene, one guard, one round; hitting HP
     zero freezes and prompts `R` to restart.
   - **No attract mode / no cutscene playback.** The game's demo cycles
     between title (BAL00 + Mariko + walking hero + Akuma on gate) and the
     CAL01 story cutscene; the port has neither. BAL01/02/03 render right
     in viewer mode but are not byte-verified because the attract loop in
     the emulator never reaches them.

## Before you commit

- `original/`, `recovered/` and `reference/` are all gitignored. The third one
  is the one people forget: extracted sprites and memory dumps are the game.
  Check `git status` — never `git add -A`.
- `prior-attempt/` is committed and is **unverified**; see its own README before
  believing anything in it.
- Every figure in the documents must match what the tools print now.
