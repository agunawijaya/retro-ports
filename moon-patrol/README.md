# Moon Patrol (Atari, 1984, DOS)

Irem's 1982 arcade original, DOS conversion published by Atari, Inc. in 1984.
The copyright banner is inside the binary at file 0x4E98:
`Moon Patrol Copyright (C) 1984 Atari, Inc.`

**It rebuilds byte-identically** from a copy you own -- checked on every run.
**32.9% of the file** decoded as code (**88.3% of the 21,705-byte code
region**), all 130 call targets named, **all 328 bracketed constants covered**
(243 as globals + 85 as displacements), 28 data spans partition the whole
file with no gap or overlap. See [BRIEF.md](BRIEF.md) for the exact numbers
as the tools currently print them and
[docs/02-architecture.md](docs/02-architecture.md) for how the DOS program
was put together, or [docs/03-the-code.md](docs/03-the-code.md) for a
narrative walk of the routines in reading order.

**Referee-run proof**: `comrun.py` on the reassembled `rebuilt.bin` (not
on the original) runs Moon Patrol to its title screen and, with F1 fed in
via the game's own int 9 ISR at file 0x405, into its attract-mode game
field. That exercises the entry stub, both address bases, the DS bias, the
CRTC programming, the palette, the scanline-table indexing and the sprite
atlases -- everything the static reading claims. See
[BRIEF.md](BRIEF.md#the-title-screen-referee-run) for the command.

## What this program is

Not 8086 that a person wrote. `comrec.py`'s own detector caught 281 `cmc`
instructions, 99% of them straight after a compare -- the carry-inversion
adapter a translator emits when converting 6502 code to 8086. Every marker
of a translated binary is present: AL used as an accumulator in half of all
instructions, no register push/pop, 16-bit as byte pairs with `adc`. Same
class as Hard Hat Mack. See
[docs/02-architecture.md](docs/02-architecture.md) for the reading and
[knowledge/14](../../DOS-Decompiler/knowledge/14-translated-binaries.md) for
the detector.

## Rebuilding it

You need a copy of the game (58,306-byte `PATROL.COM`), NASM, and Python
with `capstone` and `unicorn`.

```powershell
mkdir original
copy <your copy>\PATROL.COM original\
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

Expected: `BYTE-IDENTICAL  FF12627CE23EF72BEB8072F0327805F56D7592F35E819EBA4C46F3D51C8451C9`.

`build.ps1` passes `--segment 0x100:0 --entry 0x100` to comrec because the
entry stub writes its own far-jump target at run time; comrec cannot see it
by static walk. See [BRIEF.md](BRIEF.md) for the shape of that trap and
[docs/02-architecture.md](docs/02-architecture.md) for what it means for the
address bases the listing uses.

## What this repository does not contain

No game files. `original/`, `recovered/` and `reference/` are gitignored,
because a byte-identical reconstruction is the game in another form and a
sprite pulled out of it is still the game. What is kept is the reading:
names in [symbols.json](symbols.json), evidence for each name, documentation,
and the tools that re-derive the rest from a copy you already own.

## Where the reading stands

Six documents planned, three written:

- [docs/01-the-game.md](docs/01-the-game.md) -- history, gameplay, controls,
  reception.
- [docs/02-architecture.md](docs/02-architecture.md) -- how the DOS
  program was built: the two address bases, the four segment registers, the
  region map, the scanline table, the script interpreter, sound and I/O.
- [docs/03-the-code.md](docs/03-the-code.md) -- a walk-through in reading
  order: the two-stage entry, the ISR family, video setup and CRTC, the
  menu, the joystick, the game-loop and wave scripts, the per-frame step,
  the blit family, sound, and the exit path.
- docs/04-porting.md -- the porting-target decision, comes when a port
  starts.
- docs/05-web-architecture.md and 06-web-code.md -- the port's own
  documents, when there is a port.

The reconstruction and the reading are the deliverable that is ready to
build on; the port is next.
