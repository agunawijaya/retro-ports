# The earlier attempt — read this before trusting anything in here

This folder is work from a session that ran **before `dos-decompiler` existed**.
It is kept because it contains real findings and a great deal of reading, and it
is quarantined because **none of it has been checked by the method this
repository now uses.**

Both of those are true at once, and the second one is easy to forget while
reading the first.

## What is in it

| | |
|---|---|
| `src/` | a **Turbo Pascal reconstruction** — 17 `.PAS` units, a `MAKEFILE`, and notes on the RNG, the screens and a static trace |
| `notes/` | six documents and a folder of prompts: a project overview, a rebuild guide, a reverse-engineering playbook, a tools reference |
| `web/` | a JavaScript port, with its own README and a trail of `CLAUDE_CODE_FIX_*.md` files |

The image assets the port used, and the screenshots, are **not here**. They were
extracted from the game and are therefore the game; they are in `../reference/`,
which the repository does not commit. The port will not render until they are
put back.

## What it got right, and it is worth having

The single most valuable thing in this folder is the identification of the
compiler. `src/COPYPROT.PAS` traces the copy-protection gate to a far call into
Borland's runtime:

```
0x14BF3  9A B5 03 9F 21   lcall 0x219F:0x3B5    ; TP TDateTime GetDate
0x14C06  81 7E FC B8 88   cmp word [bp-4], 0x88B8   ; 35000 days
```

35,000 days after 1899-12-30 is 1995. The game locks itself after that date.
That is a specific, checkable claim about a specific address, and it is the kind
of finding that survives a change of method.

It also establishes that this program is **Turbo Pascal**, which no other game
in this repository is, and which changes what the toolkit can do — see the
[folder README](../README.md#it-is-turbo-pascal).

## Why it is quarantined anyway

The reconstruction has never been through the check that makes a reconstruction
mean anything:

> Does it compile, and does the result match the original binary?

Until that is answered, `src/` is a **hypothesis written in Pascal**. It may be
an excellent one. It reads like careful work. But this repository's whole
argument is that reading carefully and being right are different things, and
that only an oracle tells them apart — which is why:

- [Hard Hat Mack's sprites](../../hard-hat-mack/docs/02-architecture.md) were
  documented as mirrored for a week, and were not;
- its screens reported **100% of placement calls explained** while a floor was
  being drawn as a diagonal staircase;
- its scanline table was read out of the file correctly and was still the wrong
  table, because start-up rewrites it.

Every one of those was confident, plausible, and wrong, and every one was caught
by a measurement rather than by rereading.

## How to use it

**As a source of hypotheses, not as a result.** Each claim in here is worth
testing, and the toolkit can now test several of them that could not be tested
before:

- `unpack.py` gets past the LZEXE packing that this attempt had to work around.
- `comrun.py` runs the binary and dumps its framebuffer, so a claim about what
  a screen looks like has a reference.
- `anchors.py` finds `main` structurally, which matters because LZEXE does not
  record the entry point.

Anything that survives being tested moves into `docs/` as a fact with its
evidence attached. Anything that does not survive stays here, and is worth
writing down as a corrected claim rather than quietly deleting — a wrong answer
that someone else would have reached too is worth more on the record than off
it.
