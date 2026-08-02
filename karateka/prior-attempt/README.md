# The earlier attempt — read this before trusting anything in here

This folder is work from a session that ran **before `DOS-Decompiler` existed**.
It is kept because it contains a lot of genuine investigation, and it is
quarantined because **none of it has been checked by the method this repository
now uses.**

## What is in it

| | |
|---|---|
| `notes/` | ten numbered documents — game logic, pseudocode, a disassembly pass, remake options, debug findings, a file inventory, runtime memory capture, and a progress log |
| `notes/chatgpt/` | a second, parallel investigation with its own findings folder: function maps, string dumps, disk-check analysis, DOSBox runtime logs |
| `tools/` | eighteen Python scripts — sprite extractors, disk-image readers, buffer finders, animation probes, comparison harnesses |
| ~~`web/`~~ | **removed on 2026-08-02.** A browser remake whose characters were a *NES* sprite atlas in greyscale, over backgrounds cropped from shadow-buffer dumps — because the DOS sprite decoder never worked (see `notes/10`, §12). Nothing on its screen came from reading `KARATEKA.EXE`, so it was the wrong foundation to build on rather than a partial one. It is in the history if it is ever wanted: `git log -- karateka/prior-attempt/web` |

The extracted sprites, memory dumps, screenshots and Apple II disk images are
**not here**. They came out of the game and are therefore the game; they are in
`../reference/`, which the repository does not commit.

## What is worth keeping from it

**The scripts, more than the conclusions.** `extract_dsk.py`, `hgr_scan.py` and
the sprite extractors encode real knowledge about Apple II disk images and
high-resolution graphics that this toolkit does not have. They may be wrong in
detail; they are still the fastest route back into the problem.

**The observation that the data files are paired.** `KM*.DAT` with `KM*.IND`,
`KS*.DAT` with `KS*.IND` — twenty-two pairs of a file and an index into it. If
that holds, it is the shape of the whole asset system and the first thing to
confirm.

**The memory-dump captures.** Sixteen `MEMDUMP_*.BIN` files named after what was
on screen when they were taken — `MEMDUMP_Princess.BIN`,
`MEMDUMP_Pillar_Left.BIN`, `MEMDUMP_Soldiers_Kicking_*.BIN`. A dump labelled
with what it should contain is far more useful than a dump that is not, and
whoever took them was thinking about verification.

## Why it is quarantined anyway

Nothing in here has been through an oracle. There is no reconstruction that
rebuilds the binary, and no comparison against the running game — the two
checks this repository treats as the difference between a finding and a
plausible story.

That is not a criticism of the work; the tools to do it did not exist when it
was done. It is a statement about what its claims currently rest on, which is
careful reading. Careful reading has been wrong in this repository repeatedly
and expensively:
[sprite orientation](../../hard-hat-mack/docs/02-architecture.md#the-sprite-format-decoded),
a coverage metric reading 100% while a floor was drawn as a staircase, and a
lookup table read correctly out of a file that the program rewrites before it
uses it.

## How to use it

**As hypotheses, and as a head start on the tools.** Three things can be tested
now that could not be tested then:

- `comrec.py` will say whether the executable was mechanically translated from
  6502 — a question this game invites, since the Apple II original sits in
  `../reference/apple-ii/` and Jordan Mechner wrote it there first.
- `comrun.py` runs the game and dumps the framebuffer, so a claim about a sprite
  can be checked against the screen rather than against another extraction.
- `gfxdump.py` renders a region as graphics without running anything, which is
  how a guess about a data format gets tested in a minute rather than a day.

Anything that survives a test moves into `docs/` with its evidence. Anything
that does not stays here as a corrected claim — on the record, because the next
person would have believed it too.
