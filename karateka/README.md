# Karateka (Broderbund, DOS)

Jordan Mechner's 1984 debut — the game that introduced rotoscoped animation and
cinematic cutscenes to home computers, four years before *Prince of Persia*. You
walk right, you fight Akuma's guards, you rescue Princess Mariko, and if you
approach her in a fighting stance she kicks you to death.

**Not decompiled yet.** This folder is set up and triaged, and there is
substantial material from an earlier attempt that predates the toolkit — see
[`prior-attempt/`](prior-attempt/).

*Part of [retro-ports](../README.md).*

## What triage says

```
python <toolkit>/tools/triage.py original/KARATEKA.EXE
```

```
Format : MZ
Image  : 87,478 bytes, 4 relocations
Entry  : 0000:0002
[WARN] memory model looks small or medium -- 4 relocations over 85 KB
[WARN] few stack frames (34 prologues, 0.4/KB)
VERDICT: probably workable, with caveats.
```

Not packed, which makes it the more approachable of the two games added
alongside it. Four relocations over 85 KB means almost everything is addressed
within one segment.

**0.4 prologues per KB looks like the signature of hand-written assembly**, and
it is the same figure [Hard Hat Mack](../hard-hat-mack/) shows. It was read that
way here and that was wrong — the figure is computed over the whole file, and
68% of this file is data. The program turns out to be **Lattice C 2.1**, which
it states in the first string of its own data segment. See
[docs/02-architecture.md](docs/02-architecture.md#it-is-a-c-program-and-it-says-so).

The rest of the prediction stood: That was stated here as a
prediction before any work was done, because it was falsifiable: if this is a
6502 port like Hard Hat Mack was, `comrec.py` would report it —

```
provenance  : mechanically translated from 6502
```

**It did not, and the prediction was wrong.** Zero `cmc` instructions in 9,740,
against 914 compares. Hard Hat Mack has 391, 99% of them straight after a
compare. There is no carry-flag adapter in Karateka because nothing needed
adapting: Broderbund's DOS conversion was a rewrite where Electronic Arts' was
a translation. Written up in
[docs/02-architecture.md](docs/02-architecture.md#it-was-written-for-the-8088-not-translated-to-it).

## Why this one is a good test of the toolkit

Every game here so far has been a single executable with its data inside it.
Karateka is not:

- **The game is an `.EXE` plus ninety data files.** `KM*.DAT` / `KM*.IND` and
  `KS*.DAT` / `KS*.IND` are paired — a data file and an index into it — and
  there are twenty-two such pairs. `ALLPAL`, `ALLBAL`, `ALLCAL`, `ALLGAL`,
  `ALLVAL` look like combined versions of the `BAL*`, `CAL*`, `PAL*`, `VAL*`
  series. `CASTLE.BCG` and `FUJI.BCG` are backdrops.
- **Nothing in this toolkit reads a data-file format yet.** ParaTrooper and Hard
  Hat Mack keep their artwork inside the executable, so `gfxdump.py` takes an
  offset into one file. Karateka will need the pairing understood first.
- **The Apple II original is available for comparison.** Six disk images in
  `reference/apple-ii/`. If the DOS version is a translation, the two can be
  read against each other — which is a luxury Hard Hat Mack did not have.

## What has been done

`KARATEKA.EXE` **rebuilds byte for byte** — 87,990 bytes, SHA-256 checked
outside the tool that produced it. 9,740 instructions, **85.0% of the code
region** recovered as real instructions.

That took a change to the toolkit rather than to the game. An MZ with four
relocations and an entry stub that sets `DS` once is a `.COM` wearing a header,
and the `.COM` route — which reaches a byte-identical rebuild — applies to it.
`comrec.py` now strips the header itself and writes it back out beside the
source. See
[docs/02-architecture.md](docs/02-architecture.md#it-is-an-mz-but-it-is-really-a-com).

**The ninety data files are decoded, all 666 records.** `(id, offset)` pairs
terminated by `0xFFFF`; records are run-length encoded with `0x7B` as the
escape; `KS*` holds shapes and `KM*` the matching silhouettes. The format was
settled by running the game and reading the routines that consume the data, not
by inspecting the bytes — an earlier guess reached 282 of 284 and was wrong.

```
python tools/render-sprites.py --sheet KSC --toolkit <path-to>/dos-decompiler
  60 records -> reference/sprites/KSC.png
```

Sixty frames of Jordan Mechner's rotoscoped animation, out of the file.

## What is here

| | |
|---|---|
| `original/` | the game as it shipped, plus the archive it came in — **not committed** |
| `prior-attempt/` | an earlier session's work: notes, extraction scripts, a web remake. Committed, and **unverified** — see its own README |
| `reference/` | the Apple II disk images, extracted sprites, memory dumps, screenshots, and a patched copy of the executable someone else made — **not committed** |
| `docs/` | [four documents](docs/) — the game, the architecture, the code, and porting |

## A note on `KARATEKA_NOCHK.EXE`

`reference/` holds a copy of the executable with its disk check removed. It is
not the shipped game and it is not our work, so it is neither `original/` nor
`prior-attempt/`.

**Do not decompile it by accident.** A byte-identical reconstruction of a
patched binary proves you reconstructed the patch. If the copy protection is
interesting, read it in the real executable, where it is still there.

## Getting the game

Nothing here redistributes it. `original/` and `reference/` are excluded from
the repository; if you have your own copy, put it in `original/` and everything
above applies.
