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

**0.4 prologues per KB is the signature of hand-written assembly**, and the same
figure [Hard Hat Mack](../hard-hat-mack/) shows. That is worth stating as a
prediction before any work is done, because it is falsifiable: if this is a
6502 port like Hard Hat Mack was, `comrec.py` will report it —

```
provenance  : mechanically translated from 6502
```

— and if it does not, the prediction was wrong and that is worth knowing too.
The Apple II original is right there in `reference/apple-ii/` to compare against.

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

## What is here

| | |
|---|---|
| `original/` | the game as it shipped, plus the archive it came in — **not committed** |
| `prior-attempt/` | an earlier session's work: notes, extraction scripts, a web remake. Committed, and **unverified** — see its own README |
| `reference/` | the Apple II disk images, extracted sprites, memory dumps, screenshots, and a patched copy of the executable someone else made — **not committed** |
| `docs/` | not written yet |

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
