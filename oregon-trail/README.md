# The Oregon Trail (MECC, DOS)

The 1990 MS-DOS release of the game a generation of American schoolchildren
learned to type "hunt" into. You outfit a wagon in Independence, Missouri, and
try to reach Oregon's Willamette Valley before winter, your oxen, or dysentery
stop you.

**Decompiled as far as the toolkit could take it, which is not all the way.**
The packing, the compiler, the module structure and the artwork are done and
measured; the game's own logic is barely read. [Four documents](docs/) say
which is which, and [CLAUDE.md](CLAUDE.md) is the working reference.

The objective here was the toolkit rather than the game, and on that it
delivered: an LZEXE entry point read instead of guessed, a Turbo Pascal
structure scanner, and a PCX/pcxLib reader — all now in
[dos-decompiler](https://github.com/agunawijaya/dos-decompiler).

There is also substantial material from an earlier attempt that predates the
toolkit — see [`prior-attempt/`](prior-attempt/). The one claim from it that was
tested had the right address and the wrong meaning.

## Documentation

| | |
|---|---|
| [**docs/01-the-game.md**](docs/01-the-game.md) | what it is, and the four earlier programs that carried the name |
| [**docs/02-architecture.md**](docs/02-architecture.md) | the packing, the compiler, eleven segments, the artwork container, and what changed between 1983 and 1990 |
| [**docs/03-the-code.md**](docs/03-the-code.md) | four routines, and a deliberately short document because that is the honest length |
| [**docs/04-porting.md**](docs/04-porting.md) | why the hard part here is not the code, and the one experiment worth running first |

*Part of [retro-ports](../README.md).*

## What triage says

```
python <toolkit>/tools/triage.py original/OREGON.EXE
```

```
Format : MZ
Image  : 81,864 bytes, 0 relocations
[BLOCKER] packed with LZEXE 0.91
VERDICT: out of scope. Unpack before doing anything else.
```

It is packed, so the visible code is a decompressor. Unpacking works and the
result is in scope:

```
python <toolkit>/tools/unpack.py original/OREGON.EXE -o work/unpacked.exe
```

```
instructions executed : 1,316,187
outcome               : decompression finished
unpacked image        : 201,184 bytes
original entry point  : unknown -- header entry set to 0
```

```
python <toolkit>/tools/triage.py work/unpacked.exe
  179 prologues, 0.9/KB
  VERDICT: in scope. Run tools/pipeline.ps1.
```

**Two things to carry into the work.** The entry point is not recovered —
LZEXE does not record it and guessing is worse than leaving it blank, so use
`anchors.py` to find `main` structurally. And 0.9 prologues per KB is the
ambiguous band: either hand-written assembly or a compiler that omits frame
pointers.

For this program the earlier attempt already answered that second question, and
the answer is unusual for this repository.

## It is Turbo Pascal

Every other game here is assembly or C. This one is **Borland Turbo Pascal**,
and the earlier attempt found it by reading a far call in the copy-protection
check straight into `TDateTime GetDate`.

That matters more than a compiler name usually does:

- Turbo Pascal's runtime is not an OMF `.LIB`, so `libscan.py` — which
  subtracts a C runtime and recovers the entry point from it — **does not apply
  as written**. Recognising the Pascal runtime is new work, and it is the most
  transferable thing this game has to offer the toolkit.
- Pascal's string and set types have distinctive shapes in memory. They should
  make data structures easier to identify than in a C program, not harder.
- The reconstruction target is `.PAS`, not `.C` or `.ASM`.

## What is here

| | |
|---|---|
| `original/` | the game as it shipped, plus the archive it came in — **not committed** |
| `prior-attempt/` | an earlier session's work: a Turbo Pascal reconstruction, notes, and a JavaScript port. Committed, and **unverified** — see its own README |
| `reference/` | everything derived from the game: screenshots, extracted artwork, a Ghidra export — **not committed** |
| `docs/` | not written yet |

## The game's own files

| | |
|---|---|
| `OREGON.EXE` | the game, LZEXE-packed |
| `INSTALL.EXE` | the installer |
| `OTCGA.PCL`, `OTMCGA.PCL` | the artwork, 190 KB and 321 KB — two versions, one per graphics card |
| `CGA.BGI`, `VGA256.BGI` | Borland Graphics Interface drivers, which is itself a Turbo Pascal tell |
| `BIT8X8.GFT` | a font |
| `DIALOGS.REC` | the game's text |
| `SONGS.TXT` | the music, as text |
| `*.REC` | high scores, joystick calibration, saved state |

`OTMCGA.PCL` being 321 KB against an 82 KB executable says what kind of program
this is: mostly pictures. Expect the same shape as
[Hard Hat Mack](../hard-hat-mack/), where two thirds of the file is artwork.

## Getting the game

Nothing here redistributes it. `original/` and `reference/` are excluded from
the repository; if you have your own copy, put it in `original/` and everything
above applies.
