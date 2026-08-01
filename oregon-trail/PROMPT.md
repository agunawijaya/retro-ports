# The Oregon Trail (MECC, 1990, DOS) — your task

Decompile it. The point is not the game.

**The objective is to enrich `dos-decompiler`.** Every game in this repository
has been chosen for what it breaks, and this one breaks more than any of the
others: it is the first **Turbo Pascal** program the toolkit has ever seen. Five
games in, every tool assumes C or hand-written assembly. If you do this well,
the toolkit comes out able to handle a compiler family it currently cannot see
at all — and that is worth more than the game.

Read `dos-decompiler/AGENTS.md` before you start. It is the method, not a
manual. Then read `prior-attempt/README.md` in this folder, which explains what
an earlier session found and why none of it is trusted yet.

---

## What has already been checked, so you do not repeat it

Everything below was run, not guessed.

### It is packed, and unpacking works

```
python <toolkit>/tools/triage.py original/OREGON.EXE
  [BLOCKER] packed with LZEXE 0.91
  VERDICT: out of scope. Unpack before doing anything else.

python <toolkit>/tools/unpack.py original/OREGON.EXE -o work/unpacked.exe
  instructions executed : 1,316,187
  unpacked image        : 201,184 bytes   (from 81,896)
  original entry point  : unknown -- header entry set to 0

python <toolkit>/tools/triage.py work/unpacked.exe
  179 prologues, 0.9/KB
  VERDICT: in scope. Run tools/pipeline.ps1.
```

**The entry point is not recovered.** LZEXE does not record it and the toolkit
refuses to guess, because a wrong entry point sends the disassembler into the
middle of a routine and everything after inherits the error. `anchors.py` finds
`main` structurally instead.

That gap is your first opportunity — see *What would enrich the toolkit* below.

### It is Turbo Pascal, and the binary says so

Two strings in the unpacked image:

```
0x021BFF  'Runtime error '
0x0244D3  'Copyright (c) Genus Microprogramming, Inc. 1988-89'
```

The first is Borland's runtime. The second is a **third-party graphics library**
linked into the program.

The earlier session reached the same conclusion from the other end, by tracing
the copy-protection check into a far call at `0x14BF3` that lands in Borland's
`TDateTime GetDate`. Two independent routes to the same answer is the toolkit's
own standard for committing to a claim, so treat "this is Turbo Pascal" as
established and everything downstream of it as open.

### The artwork is PCX, which is an open format

This is the largest head start you have been handed, and it took ten minutes to
find.

```
OTCGA.PCL   189,831 bytes   70 63 78 4c 69 62 00   "pcxLib\0"
OTMCGA.PCL  321,139 bytes   70 63 78 4c 69 62 00   "pcxLib\0"
LOGO.256      2,117 bytes   0a 05 01 08            a PCX header
PAL.256         906 bytes   0a 05 01 08            a PCX header
```

`pcxLib` is Genus Microprogramming's PCX Library — a **container of ZSoft PCX
images**. `0A 05 01 08` is the PCX magic: ZSoft, version 5, RLE-encoded, 8 bits
per plane.

So **there is no sprite format to reverse engineer here.** PCX is documented,
forty years old, and readable in fifty lines. What you have to work out is the
container's index, not the images.

Compare that with the two games before it, where the sprite format had to be
guessed from a pointer table's stride and confirmed by rendering. This one is
the opposite problem, and that difference is itself worth writing down.

### The shape of the release

| | |
|---|---|
| `OREGON.EXE` | the game, LZEXE-packed, 81,896 bytes → 201,184 unpacked |
| `INSTALL.EXE` | the installer |
| `OTCGA.PCL`, `OTMCGA.PCL` | the artwork, two versions — one per graphics card |
| `CGA.BGI`, `VGA256.BGI` | Borland Graphics Interface drivers |
| `BIT8X8.GFT` | a font — the header contains the ASCII string `BIT8X8` |
| `DIALOGS.REC` | the game's text |
| `SONGS.TXT` | the music, as text |
| `*.REC` | high scores, joystick calibration, saved state |

**321 KB of artwork against an 82 KB executable.** Expect the same shape as
[Hard Hat Mack](../hard-hat-mack/), where two thirds of the file is pictures and
the interesting code is a small fraction of the whole.

---

## What would enrich the toolkit

This is the actual task. In rough order of value.

### 1. Turbo Pascal runtime recognition

`libscan.py` subtracts a C runtime by matching modules out of an OMF `.LIB`,
with the FIXUPP relocation slots as wildcards. It recovers the runtime region,
names its functions from PUBDEF records, and reads the entry point out of the
startup module's MODEND. It is measured exact on four binaries across two
compilers.

**None of that applies here.** Turbo Pascal does not link OMF libraries; it uses
`.TPU` units and its runtime is bound into the executable by its own linker.
`libscan.py` will find nothing, correctly and uselessly.

So: what *is* the equivalent? Some candidates, in the order they are worth
trying:

- **The runtime error table.** `'Runtime error '` at `0x021BFF` is part of a
  block of Borland runtime strings. Their layout is version-specific and would
  identify the compiler version, which nothing currently does for Pascal.
- **The `.TPU` files, if you have a copy of Turbo Pascal.** They are the Pascal
  equivalent of `.OBJ` and carry symbol tables. If they can be matched against
  the image the way `libscan.py` matches OMF modules, that is the same technique
  ported to a new compiler family — and it is the single most valuable thing
  this game could produce.
- **The Genus library.** A third-party library linked into the binary is a
  fingerprint of its own, and one that identifies the *graphics* code, which is
  usually the largest and least interesting part of a game.

Whatever you find, record what did **not** work as carefully as what did. The
toolkit keeps negative results deliberately; there are several already in
`knowledge/`.

### 2. The entry point of an LZEXE'd binary

`unpack.py` writes 0 and says so. For a C program `libscan.py` now recovers it
from the startup module. For a Pascal program nothing does.

Turbo Pascal's initialisation code has a recognisable shape — it sets up the
heap, the exit chain and the runtime error handler before it reaches your
`begin`. If that shape can be matched, the entry point follows, and so does the
boundary between "the runtime" and "the program".

### 3. A pcxLib / PCX reader

`gfxdump.py` renders a *region of an executable* as CGA. It has no concept of a
data file, let alone a container of them. Oregon Trail needs both.

A reader that opens a `pcxLib` container, lists its members and decodes PCX into
PNG belongs in the toolkit, not in this game's folder — the format is not
MECC's, and the next 1990 DOS game you meet may well use it too.

**Test it the way this repository tests things**: decode a picture, then run the
game under `comrun.py` and compare what you decoded against what it drew. That
turns "the format looks right" into a number.

### 4. A Pascal reconstruction target

Every reconstruction here so far has produced NASM (`.COM`) or C (MZ). A
byte-identical Pascal rebuild would need Turbo Pascal itself, which is
abandonware and findable. Whether that is reachable is an open question and a
good one — say what you find either way, including "not reachable, and here is
why".

---

## The earlier attempt

`prior-attempt/` holds a session's work from before the toolkit existed: a
17-unit Turbo Pascal reconstruction, six documents, a set of prompts, and a
JavaScript port.

**Treat it as hypotheses, not results.** It has never been through an oracle —
nothing rebuilds the binary, nothing compares against the running game. Its own
README explains this at length, and gives the repository's record of how often
careful reading has been confidently wrong.

The specific claim most worth testing first, because it is precise and
falsifiable:

> The copy protection is a date check at `0x14BF3` in the unpacked image. It
> calls Borland's `GetDate`, compares against `0x88B8` = 35,000 days since
> 1899-12-30, and locks the game after 1995.

You can now test that in a way the earlier session could not: run it under
`comrun.py` and see.

The port's image assets are **not** in `prior-attempt/` — they were extracted
from the game, so they live in `reference/`, which the repository does not
commit. The port will not render until you put them back.

---

## What "finished" means

In order. Each step is what makes the next one checkable.

1. **The unpacked image, disassembled, with the entry point established** —
   structurally if not from a header, and say which.
2. **The compiler identified precisely** — Turbo Pascal which version, and on
   what evidence.
3. **The runtime separated from the program.** How much of those 201 KB is
   Borland's and Genus's rather than MECC's? On Sopwith the equivalent figure
   was 9%; on a program that links a graphics library it will be much higher,
   and that number is worth having.
4. **The artwork decoded**, checked against the running game rather than against
   itself.
5. **The game's own logic read** — the trail, the store, the river crossings,
   the hunting, the illnesses, the events. The earlier attempt has a unit per
   topic; use them as a map and verify each.
6. **Four documents**, following `hard-hat-mack/docs/`: the game, the
   architecture, the code, and porting. Written for someone who has never seen
   assembly. Explain every diagram you draw.
7. **Whatever the toolkit learned, in the toolkit** — a tool, a documented
   technique, or a recorded negative result, with a regression test where one is
   possible.

Porting is not part of this task.

---

## Traps this repository has already paid for

Every one was a confident wrong answer, not an admitted gap.

- **A metric with no external reference can only detect absence.** Hard Hat
  Mack's placement extraction read **100%** while a floor was being drawn as a
  diagonal staircase across the score line, and the number was identical before
  and after the fix. Counting what you explained is not the same as being right.
- **Reading a table out of a binary tells you what shipped, not what runs.**
  Hard Hat Mack's start-up adds 5 to every entry of its scanline table. The
  table was verified against its own formula, exactly, and was still the wrong
  table.
- **`BYTE-IDENTICAL` can mean "20,736 bytes were copied".** Zaxxon reported it
  while recovering nine instructions, because its entry point is a decoy.
  Quote the fraction that came back as *instructions*, always.
- **Do not decompile a patched binary by accident.** Check what you were given
  is the shipped file. Karateka's folder contains a copy with its disk check
  removed, and a byte-identical reconstruction of that proves you reconstructed
  the patch.
- **An emulator hook that returns a success flag where a value was wanted** will
  give you a program that runs, acknowledges every keypress, and receives the
  same key every time. Nothing errors.

---

## Repository conventions — not negotiable

- **Never commit `original/`, `recovered/` or `reference/`.** The first is the
  game, the second is legally the game, and the third is *derived from* the game
  — extracted sprites, memory dumps, screenshots. `.gitignore` covers all three
  plus every executable, archive and disk image. **Check `git status` before you
  commit; do not use `git add -A` without reading what it staged.** Thirty of
  the JavaScript port's image assets turned out to be the game's own artwork
  converted from `OTMCGA.PCL`, and they were staged before a check caught them.
- **No absolute paths in anything committed.** Take tool locations from
  arguments or environment variables.
- **Separate what you verified from what you inferred.** Mark the second
  `[inferred]`, inline. A confident wrong statement costs more than an admitted
  gap.
- **Give numbers.** "It worked well" is not actionable.
- **Correct claims in place when they turn out wrong**, and say that they were
  wrong. The Hard Hat Mack documents do this in four places, and it is the most
  useful thing in them.
- **Someone else is working in `dos-decompiler` at the same time.** Commit only
  your own files, read `git log` before you start, and expect the tools to move
  under you.

## What this project is for

Read the root `README.md` first. It exists so that someone who has never
programmed can learn how programs work by taking apart games small enough to
understand completely. That is who the documents are written for. If a sentence
would only make sense to someone who already knows the answer, rewrite it.
