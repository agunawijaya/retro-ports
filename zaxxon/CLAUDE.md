# Working on Zaxxon

Context for an agent picking up work in this folder. The
[root CLAUDE.md](../CLAUDE.md) still applies — this only adds what is specific
to Zaxxon, so that facts already established are not re-derived.

Read [docs/02-architecture.md](docs/02-architecture.md) before changing
anything that touches the binary. This file is the working reference; the
documents are the explanation.

## State of the work

**The decompilation is finished.** The rebuild is byte-identical, every data
format is decoded and confirmed by rendering, and every byte of the code region
is accounted for. There is one open question and it cannot be closed by
analysis — see [What is genuinely open](#what-is-genuinely-open).

**There is no port, and porting was deliberately out of scope.**
[docs/04-porting.md](docs/04-porting.md) is the decision that comes before one.
If a port starts, it goes in `web/` and gets documents 05 and 06, following
[ParaTrooper](../paratrooper/).

## Source you can rebuild

`recovered/zaxxon.asm` is correct and is not source. `symbols.json` holds the
reading — 127 routines and 105 globals, each with the evidence for
its name. All 74 call targets are named, plus the scene, fortress and wall
handlers the three jump tables reach; 47 of the 64 bracketed constants have a
name, and every one of the remaining 17 is a displacement into a struct
rather than an address; and `_data_spans` accounts for all 20,736 bytes — and the toolkit's `annotate.py` applies it.

```powershell
.\build.ps1 -Toolkit ..\..\dos-decompiler -Nasm C:\path\to\nasm.exe
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
       original\ZAXXON.COM --out recovered\zaxxon.asm --map recovered\zaxxon.map
python tools\render-artwork.py --com original\ZAXXON.COM --out recovered
```

**No flags.** The layout, the interrupt handler, the four jump tables and the
nine-way dispatch are all found automatically. If you find yourself reaching
for `--segment` or `--entry`, something has regressed in the toolkit.

Expected output, and the numbers the documents quote:

| | |
|---|---|
| SHA-256 | `A9214CCED592DDEA960753A37ECB0029A7AE7AE2B37E9EE394944BE61A41A45B` |
| size | 20,736 bytes |
| instructions | 2,655 (116 pinned) |
| code region `0x0000..0x20DD` | 8,413 bytes, **75.8% recovered** |
| whole file | 30.8% |

If those move, the documents are stale — [the root
CLAUDE.md](../CLAUDE.md) requires figures to match what the tools currently
print. Grep the four documents and the README for the old number.

## The two things that will trip you

**Addresses are 256 lower than file offsets.** The entry stub far-returns to a
second base, so file offset `0x100` is program address `0`. In the documents,
`file 0x0848` and `cs:0x0748` are the same place. Get this wrong and every
lookup lands one routine early.

**`[0x70]` and `file 0x70` are unrelated.** `DS` points at the *end of the
file*, so a bare `[...]` is RAM 20,736 bytes past anything in the image, and a
`cs:` prefix means the file. Two address spaces, one notation.

## Where things are

Program addresses. Add `0x100` for a file offset.

| | |
|---|---|
| `cs:0x075E` | the scene script — 22 entries of (setup, per-frame) |
| `cs:0x1518` | 8 enemy wave scripts, pairs of (kind, lane), `0xFF` ends one |
| `cs:0x150E` | 5 lane entry positions, all at column `0x4A` |
| `cs:0x14FE` | per-kind starting altitude — **indexed from kind 4, not 0** |
| `cs:0x144F` | per-kind score index — **also indexed from kind 4** |
| `cs:0x00D3` | the five score amounts: 100, 150, 200, 300, 500 |
| `cs:0x2613` | 34 sprites: (graphics pointer, drawing routine) |
| `cs:0x1FDD` | 94 tile pointers, 16 bytes each |
| `cs:0x0FF5` | 8 velocity pairs, indexed by an object's direction byte |
| `cs:0x12A7` | the player's movement table |
| `cs:0x10E3` | scancode → direction, for `xlatb` |
| `cs:0x046B` | the terrain strip: 79 tile numbers with bit 7 pre-set |
| `cs:0x1379` | the altitude bar, 21 altitudes × 6 tiles |
| `cs:0x0E4D` | the boss's twelve (mask, RAM window) pairs |

Data-segment addresses:

| | |
|---|---|
| `DS:0x0000` | flags — bit 4 which player, bit 5 joystick, low nibble player count |
| `DS:0x0009` | the per-scene wall test, called as `call word [9]` |
| `DS:0x00A0` | the player's object, six bytes, same shape as the array |
| `DS:0x00AC` | the object array, 29 records of six bytes |
| `DS:0x0100` | six of those are the player's shots |
| `DS:0x015C` | a parallel array: where each shot was fired from (`[si+0x5C]`) |
| `DS:0x0910` | the visible part of the off-screen buffer, 80 bytes per row |
| `DS:0x478A` | the decompressed 192×144 section, 48 bytes per row |
| `DS:0x62B2` | the background tile map, 40×25, bit 7 = needs redrawing |

## Conventions this program uses everywhere

- **`0xFF` terminates every list.** No counts, no lengths.
- **Carry is a boolean return.** `stc` yes, `clc` no.
- **A table index beats a branch.** Directions, sprites, scenes, sounds, score
  amounts — all of them.
- **Two tables are indexed from a base pointing into code**, four bytes early,
  to save four bytes. It looks like a bug and is not.
- **Coordinates are `x` in byte columns (6…74) and `y` in half-rows (12…100).**
  Altitude only shifts the allowed range of `y`. There is no 3D anywhere.

## What is genuinely open

One thing, and no amount of reading closes it: **whether this file matches what
Sega shipped.** It carries a crack group's 128-byte banner, so at minimum the
first 128 bytes are not original. The rest is bounded rather than unknown — the
file contains no `INT 13h`, `21h`, `25h`, `26h`, `24h` or `27h` anywhere in
20,736 bytes, so it never touches a disk or DOS, and therefore cannot itself
have held a disk-based protection check. Whatever the group removed was not in
here. Settling it needs a second copy, not more analysis.

Everything else that was on the unknowns list has been closed;
[docs/02-architecture.md](docs/02-architecture.md#what-is-still-unknown)
records what each one turned out to be, including one answer that was published
wrong and is corrected in place.

## Before you commit

- `original/` and `recovered/` are gitignored, and `recovered/zaxxon.asm`
  assembles to the game. Check `git status` — never `git add -A`.
- On this machine the folder may still be `Zaxxon` on disk while git records
  `zaxxon/`. Name paths in lower case when you `git add`, or a new file lands
  outside the tracked tree without saying so.
- Every figure in the four documents must match what the tools print now.
- Every Markdown link and anchor must resolve; there is no renderer here, so
  check Mermaid blocks structurally — balanced brackets and quotes, matched
  `subgraph`/`end`, no edge to an undeclared node.
