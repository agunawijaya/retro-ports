# Zaxxon (1984, DOS) — your task

Decompile it. Not "produce something that looks like source" — produce source
that **rebuilds the original file byte for byte**, and prove it, then read the
program until you can explain what it does and draw its screens without ever
running it.

This is the fourth game in this repository. Sopwith, ParaTrooper and Hard Hat
Mack came first, and the toolkit that came out of them is measured rather than
asserted. Read `dos-decompiler/AGENTS.md` before you start; it is the method,
not a manual.

---

## What you have been given, already checked

`Zaxxon.com`, 20,736 bytes. Everything below was run, not guessed.

**It is a `.COM`, in scope, and the `.COM` route applies.**

```
python <toolkit>/tools/triage.py Zaxxon.com
  VERDICT: in scope, by the .COM route
```

**The entry point is a decoy, and the naive run is worthless.** Straight out of
the box you get:

```
instructions: 9 disassembled
bytes as code: 18 / 20,736  (0.1% of file)
BYTE-IDENTICAL
```

That `BYTE-IDENTICAL` means only that 20,736 bytes were copied. It is the
clearest example in this repository of why the rebuild being exact and the
program being understood are two different claims.

**Why it stops.** The file opens with `jmp 0x180` over a text banner
("Zaxxon is brought to you by :"). At `0x180`:

```nasm
    mov ax, cs
    add ax, 0x20          ; CS + 0x20 paragraphs = +0x200 bytes
    push ax
    add ax, 0x500
    mov word [0x201], ax  ; a second segment, stored for later
    xor ax, ax
    push ax
    retf                  ; far jump to (CS+0x20):0000
```

A `retf` used as a computed far jump. The real program starts at offset `0x100`
in the file with an address base of `0` — so every address in it is 0x100 lower
than a naive reading gives, and a disassembler told otherwise produces
plausible nonsense.

**With the layout supplied, it opens up.** Verified:

```
python <toolkit>/tools/comrec.py Zaxxon.com --out recovered/zaxxon.asm \
       --segment 0x100:0 --entry 0x100

segments    : 0x0000+ @ base 0x0100, 0x0100+ @ base 0x0000
instructions: 2,123 disassembled (137 pinned to fixed bytes to preserve encoding)
disassembled: 5,126 bytes carry a decoded instruction (24.7%)
BYTE-IDENTICAL
```

From 9 instructions to 2,123. Start there.

**Byte statistics, for orientation:** 37.4% zeros, 15.9% printable ASCII, and
`0xFF` is the second commonest byte (1,770). The high zero count and the `0xFF`
runs are what artwork and tables look like; the printable fraction is unusually
high for a game of this size, so there is a lot of text somewhere.

---

## Your first task is a toolkit fix, not a Zaxxon task

`comrec.py` has `detect_layout()`, which finds exactly this `retf` pattern
automatically — it does it for ParaTrooper. It missed Zaxxon's, and the reason
is worth fixing rather than working around: **it abstract-evaluates from offset
0, and Zaxxon's stub is at 0x180, behind a `jmp` over a text banner.**

Follow the initial `jmp` before evaluating. Then Zaxxon needs no flags, and so
will the next game that hides its stub the same way.

Add a fixture to `dos-decompiler/tests/com/fixtures/` that reproduces the shape
— a `jmp` over data, then a `retf`-based segment switch — so it cannot come
back. There are four fixtures; the suite runs with
`python tests/com/regress.py`. Do not put Zaxxon itself in a fixture; it is
under copyright.

---

## What "finished" means here

In order. Do not skip forward; each step is what makes the next one checkable.

1. **Byte-identical rebuild, proved outside the tool that made it.**
   SHA-256 the original and the reassembled file. This is rung 1b of the
   verification ladder in `dos-decompiler/README.md`, and for a `.COM` it comes
   free — there is no linker, so the artefact compared *is* the whole image.

2. **A high fraction of real instructions.** Byte-identity alone is a low bar:
   emitting the entire file as `db` lines would pass it. ParaTrooper reached
   87.7% of its code region; Hard Hat Mack 53.3% of the whole file. Report
   both numbers and say which you mean.

3. **The data, decoded and confirmed by drawing it.** Sprite format, font,
   level or map data, text, lookup tables. `gfxdump.py` renders a region as
   CGA without running the program. Do not trust a format because it reads
   plausibly — render it.

4. **The screens, drawn from the file alone.** `placements.py` recovers
   "draw sprite S at column C, row R" by walking a build routine's call tree.
   It discovers the drawing conventions itself; do not hand it variable
   addresses. It reports the fraction of placement calls it could explain —
   quote that fraction, and read the warning about it below.

5. **Three documents**, following `hard-hat-mack/docs/`:
   `01-the-game.md` (what it is, how to play, what was remarkable for 1984 —
   research the game, do not invent), `02-architecture.md` (how it is built),
   `03-the-code.md` (a walk through the routines). Written for someone who has
   never seen assembly. Explain every diagram you draw.

6. **A `README.md`** for the game folder, and instructions to regenerate
   `recovered/` from a copy the reader already owns.

Porting is **not** part of this task. Do not start one.

---

## Traps the previous three games set, in the order they caught us

Every one of these was a confident wrong answer, not an admitted gap.

- **Sprites can be stored bottom row first.** Hard Hat Mack's are. It was
  called "mirrored" here for a week. The blitter settles it: if it steps *down*
  the scanline table while reading the bitmap forwards, the first bytes are the
  lowest row. **If a sprite sheet contains text anywhere, orient it by the
  text** — text has one correct orientation, shapes have four that all look
  plausible.
- **The font is usually a different routine with its own convention.** Hard Hat
  Mack's sprites are bottom-first and its font is top-first. Check separately.
- **A row is a scanline from the top, and the sprite's bottom edge sits on it.**
- **Two code paths that look identical may not be.** Hard Hat Mack has three
  drawing routines: one takes character columns (×7 pixels), one takes byte
  columns, and two of them draw *two* sprites per call from a second set of
  variables. Read the conventions out of each routine rather than assuming one.
- **Which register indexes a table matters.** One routine read its column from
  a table indexed by the loop counter in BX and its row from a table indexed by
  a fixed value in SI. Resolving both with one index turned a horizontal floor
  of fourteen girders into a diagonal staircase across the score line — while
  the coverage metric read **100%**.
- **A metric with no external reference can only detect absence.** The fraction
  of placement calls explained counts calls that produced *a* position, not the
  *right* one. It found every missing sprite and none of the misplaced ones.
  Draw the screen as well. Four of our errors were caught by looking at a
  picture and none by re-reading the code.
- **Low bits of a power-of-two LCG are a counter, not random.** `rnd() % 4`
  returned 2, 3, 0, 1 forever. Scale, never modulo.
- **`cmc` after every `cmp` means the program was mechanically translated from
  6502** — the two architectures have opposite carry conventions. Hard Hat Mack
  was; `comrec.py` detects and reports it. If Zaxxon is too, that tells you the
  idioms to expect and that speed will be CPU-dependent.

---

## Discipline

- **Separate what you verified from what you inferred.** Mark the second
  `[inferred]`, inline. A confident wrong statement costs more than an admitted
  gap. Everything in this repository's documents follows this.
- **Give numbers.** "It worked well" is not actionable. "2,123 instructions,
  24.7% of the file" is.
- **Record negative results.** Three are already written down in the toolkit,
  and they are worth as much as the successes. If something fails, write down
  what and why.
- **Correct claims in place when they turn out wrong**, and say that they were
  wrong. `hard-hat-mack/docs/02-architecture.md` does this in three places.
  This is not self-flagellation; it stops the next reader repeating it.

## Repository conventions — these are not negotiable

- **Never commit `original/` or `recovered/`.** A byte-identical
  reconstruction is legally the same thing as the binary. `.gitignore` already
  covers `*/original/`, `*/recovered/`, and every `.com`/`.exe` in the tree.
  Check `git status` before you commit; do not use `git add -A` without looking.
- **No absolute paths in anything committed.** Take tool locations from
  arguments or environment variables. The toolchain on this machine lives under
  `C:\Applications`, but nothing in the repository may say so.
- **Rename the folder.** It is currently `Zaxxon/Zaxxon/Zaxxon.com`. The
  convention is `zaxxon/original/ZAXXON.COM`, alongside `paratrooper/` and
  `hard-hat-mack/`. Add the game to the root `README.md` table when you have
  something to report.
- **Anything the toolkit learns goes back into the toolkit** — a tool, a
  documented technique, or a recorded negative result, in the
  `dos-decompiler` repository, with a regression test where one is possible.
  That is the actual point of this project; the games are the material.

## What this project is for

Read the root `README.md` first. It exists so that someone who has never
programmed can learn how programs work by taking apart games small enough to
understand completely. That is who the documents are written for. If a sentence
would only make sense to someone who already knows the answer, rewrite it.
