# Working on Hard Hat Mack

Context for an agent picking up work in this folder. The
[root CLAUDE.md](../CLAUDE.md) still applies — this only adds what is specific
to Hard Hat Mack, so that facts already established are not re-derived.

Read [docs/02-architecture.md](docs/02-architecture.md) before changing anything
that touches the binary. This file is the working reference; the documents are
the explanation.

## State of the work

**The reconstruction is finished. The reading is not, and the gap is measured
rather than guessed at.**

| | |
|---|---|
| rebuild | byte-identical, rung 1b |
| level screens drawn from the file alone | **38% / 83% / 58%** of the blits the game actually performs |
| variables named | 9 of 405 |
| bytes with a bucket | 92.4% |

There is no port, and porting was deliberately out of scope.
[docs/04-porting.md](docs/04-porting.md) is the decision that comes before one.
If a port starts, it goes in `web/` and gets documents 05 and 06, following
[ParaTrooper](../paratrooper/).

## Source you can rebuild

`recovered/hhm.asm` is correct and is not source. `symbols.json` holds the
reading — 18 routines and 32 globals, each with the evidence for
its name — and the toolkit's `annotate.py` applies it.

```powershell
.uild.ps1 -Toolkit ..\..\dos-decompiler -Nasm C:\path	o
asm.exe
```

Three steps: reconstruct, name, **rebuild and compare**. Names go in as
`%define`s and label renames only, so NASM emits the bytes it emitted before
they existed, and the script refuses to report success on anything short of the
original's SHA-256.

**This game is not compiled C** — zero `push bp` prologues — so routines are
enumerated by *call target*, not by prologue, and `probelib.py` finds nothing
in it. There is no C runtime here to identify.

Nothing the build produces may be committed: `recovered/` is gitignored,
because a byte-identical reconstruction is the game whether or not it has names
on it.

## Regenerating

```powershell
python <path-to>\dos-decompiler\tools\comrec.py `
       original\HHM.COM --out recovered\hhm.asm
python tools\render-screens.py --toolkit <path-to>\dos-decompiler
```

**No flags.** The interrupt handler, the two dispatch pointers and the 6502
provenance are all found automatically.

| | |
|---|---|
| SHA-256 | `FD70BAB8A1099A01A7696A236957F816CC54DE3F0D28C8707F7CADDF60D22737` |
| size | 42,112 bytes |
| instructions | 9,060 (320 pinned) |
| code region `0x0000..0x6C8B` | 27,787 bytes, **78.2% recovered** |
| whole file | 53.2% |

**These have moved since the documents were written** — the figures there are
9,094 instructions and 649 pinned, from before the toolkit's zero-fill guard.
Byte-identity is unchanged. If you touch this game, reconcile the documents
first.

## The four things that will trip you

**Sprites are stored bottom row first.** Not mirrored — that was this project's
first answer and it was wrong for a week. The blitter walks *down* the scanline
table while reading the bitmap forwards. **The font is the other way round**: a
different routine, top row first. Two conventions in one file.

**A row is a scanline from the top, and the sprite's *bottom* edge sits on it.**
Not the top-left corner.

**The scanline table in the file is not the table the program uses.** Start-up
adds 5 to every entry, so the playfield begins twenty pixels in from the left.
This cannot be found by reading; it took running the program. Anything that
reads `0x042D` out of the file and draws with it is twenty pixels wrong.

**The whole game is behind a pointer.** Following control flow from the entry
reaches 236 of 9,060 instructions before stopping at `jmp word [0xbd9]`.
`comrec.py` resolves it now, but any *new* analysis that walks the code has to
resolve it too or it sees 2.6% of the program.

## Where things are

File offsets.

| | |
|---|---|
| `0x0071` | the INT 9 keyboard handler — nothing calls it, the hardware does |
| `0x00DF` | the nested delay loop that is the frame timer, called from 21 sites |
| `0x042D` | the CGA scanline table, 202 entries — **patched +5 at start-up** |
| `0x05C1` | 96 more entries, all clamped to the last two lines — a bounds check made of data |
| `0x0217` | the sprite drawer: one sprite, 7-pixel character columns |
| `0x0268` | two sprites per call, **byte columns**, second triple at `0x6D9D/0x6D9E/0x6D99` |
| `0x02B1` | two sprites per call, character columns |
| `0x14D8` `0x1763` `0x1627` | the level 1, 2 and 3 builders |
| `0x1D86` | the text-record walker: `[col][row][chars]`, `0x01` continues, `0x00` ends |
| `0x1DEE` | the score line; `0x1E19` and `0x1E35` are "LEVEL 0" and "MACK 2", vertical |
| `0x63F3` | 25-entry chromatic pitch table, two octaves, as loop counts |
| `0x640C` | seven tunes, `(pitch, duration)` pairs, zero-terminated |
| `0x648A` | the music player — bit-bangs port `0x61`, so pitch is CPU-speed dependent |
| `0x6D10` | the sprite pointer table, 395 entries |
| `0x716F` | the font pointer table, 64 entries |

Named variables — nine of 405, and every one from evidence:

| | |
|---|---|
| `[0x6D9B]` `[0x6D9C]` `[0x6D97]` | column, row, sprite selector |
| `[0x6D9D]` `[0x6D9E]` `[0x6D99]` | the second triple, for the two-sprite drawers |
| `[0x594F]` | the level number |
| `[0x0781]` | the last key, **top bit set means unread** — twenty consumers clear it with `and byte [0x781], 0x7f` |
| `[0x0B62]` | ends the title loop; set when the key is `0xA0`, the space bar |

## Two lessons this game taught, that apply everywhere

**A metric with no external reference can only detect absence.** The placement
extraction read **100%** while a floor was being drawn as a diagonal staircase
across the score line, and again while Level 2's four floors were collapsed onto
one row. The number was identical before and after both fixes. Use
`comrun.py`, which runs the game and dumps the framebuffer, whenever a claim can
be checked against it.

**Drawing the data is a form of proof.** Four errors here were caught by
rendering and none by re-reading the code.

## Running it

```powershell
python <path-to>\dos-decompiler\tools\comrun.py original\HHM.COM `
       --stop-at 0xAA8 --call 0x14D8 --png level1.png
```

To get past the title screen, deliver **scancode `0x39`** — the space bar —
through the program's own INT 9 handler at file `0x71`:

```python
m.run(0, stop=0xAA8); m.key(0x39, 0x71); m.play(0x71, [], slices=6)
```

## Before you commit

- `original/` and `recovered/` are gitignored, and `recovered/hhm.asm` assembles
  to the game. Check `git status` — never `git add -A`. A `__pycache__` reached
  a commit here once that way.
- Every figure in the four documents must match what the tools print now.
- Every Markdown link and anchor must resolve; check Mermaid blocks
  structurally — balanced brackets and quotes, matched `subgraph`/`end`, no edge
  to an undeclared node.
