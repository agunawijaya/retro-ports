# Working on The Oregon Trail

Context for an agent picking up work in this folder. The
[root CLAUDE.md](../CLAUDE.md) still applies — this only adds what is specific
to Oregon Trail.

**If you are starting this game, read [PROMPT.md](PROMPT.md) first.** It is the
brief: what the objective is, what has already been checked, and what would
enrich the toolkit. This file is the shorter working reference you come back to.

## State of the work

**Not started.** The folder is set up and triaged, nothing more.

| | |
|---|---|
| triage | packed with LZEXE 0.91 — out of scope until unpacked |
| unpacking | works: 81,896 → 201,184 bytes, and the result is in scope |
| entry point | **not recovered**, left at 0 rather than guessed |
| compiler | **Borland Turbo Pascal**, plus a Genus Microprogramming graphics library |
| documents | none |
| prior work | `prior-attempt/`, unverified — see its README |

## Why this game is here

It is the first **Turbo Pascal** program the toolkit has met. Five games in,
every tool assumes C or hand-written assembly, and the most valuable thing this
game can produce is a Pascal equivalent of what already exists for C.

Specifically: `libscan.py` subtracts a C runtime by matching OMF `.LIB` modules
with their FIXUPP slots wildcarded, and reads the entry point out of the startup
module's MODEND. **None of that applies here.** Turbo Pascal links `.TPU` units,
not OMF libraries. `libscan.py` will find nothing, correctly and uselessly.

## Regenerating what exists

```powershell
python <path-to>\dos-decompiler\tools\unpack.py `
       original\OREGON.EXE -o work\unpacked.exe
python <path-to>\dos-decompiler\tools\triage.py work\unpacked.exe
```

| | |
|---|---|
| `OREGON.EXE` | 81,896 bytes, LZEXE 0.91 |
| unpacked | 201,184 bytes, 179 prologues (0.9/KB) |
| entry point | unknown — use `anchors.py` to find `main` structurally |

## What is already known about the file

Two strings in the unpacked image identify everything:

```
0x021BFF  'Runtime error '                                  Borland's runtime
0x0244D3  'Copyright (c) Genus Microprogramming, Inc. 1988-89'
```

And the artwork needs no reverse engineering at all:

```
OTCGA.PCL   189,831 bytes   70 63 78 4c 69 62 00   "pcxLib\0"
OTMCGA.PCL  321,139 bytes   70 63 78 4c 69 62 00   "pcxLib\0"
LOGO.256      2,117 bytes   0a 05 01 08            a PCX header
```

`pcxLib` is Genus Microprogramming's container of **ZSoft PCX images**.
`0A 05 01 08` is the PCX magic — version 5, RLE, 8 bits per plane. The format is
documented and forty years old; only the container's index has to be worked out.

**321 KB of artwork against an 82 KB executable.** Expect the shape of
[Hard Hat Mack](../hard-hat-mack/): mostly pictures, with the interesting code a
small fraction of the whole.

## The prior attempt

`prior-attempt/` holds a 17-unit Turbo Pascal reconstruction, six documents and
a JavaScript port, from a session that predates the toolkit. Its README explains
why it is quarantined; the short version is that **nothing in it has been
through an oracle.**

The claim most worth testing first, because it is precise and falsifiable:

> The copy protection is a date check at `0x14BF3` in the unpacked image,
> calling Borland's `GetDate` and comparing against `0x88B8` = 35,000 days
> since 1899-12-30 — so the game locks itself after 1995.

`comrun.py` can now test that by running it.

The port's image assets are **not** in `prior-attempt/` — they were extracted
from the game and therefore live in `reference/`, which is not committed. The
port will not render until they are put back.

## Before you commit

- `original/`, `recovered/` and `reference/` are all gitignored. The third is
  the one people forget: **thirty of the JavaScript port's images turned out to
  be the game's own artwork converted from `OTMCGA.PCL`**, and they were staged
  for commit until a check caught them. Check `git status` — never
  `git add -A`.
- `work/` is for unpacked images and Ghidra projects. Nothing there is worth
  committing; a 105 MB DOSBox trace and a 6.7 MB Ghidra project were deleted
  from this folder once already.
- Every figure in any document you write must match what the tools print.
