# Zaxxon (1984, IBM PC)

Sega's **Zaxxon** was the first arcade game drawn in an isometric view, in
1982. You fly a small fighter through a fortress of walls, gun towers and fuel
drums, and because nothing on screen changes size with distance, the only way
to judge your height is the shadow your aircraft casts.

This folder takes apart the **IBM PC version, 1984** — one file, 20,736 bytes,
containing the code, all the artwork, the level scripts and the sound.

*Part of [retro-ports](../README.md). There is no browser port: the
decompilation came first, and porting was deliberately not part of this work.*

## Documentation

| | |
|---|---|
| [**docs/01-the-game.md**](docs/01-the-game.md) | what it is, how it plays, why the isometric view mattered, and the crack-group banner in the first 128 bytes |
| [**docs/02-architecture.md**](docs/02-architecture.md) | how the program is built: the entry stub that rewrites its own code, the off-screen buffer, 94 tiles compressed 49:1, 34 sprites in 8 formats, and the shadow that is a sprite made only of holes |
| [**docs/03-the-code.md**](docs/03-the-code.md) | the routines, in the order the program runs them, from the joystick measurement loop to the score kept as decimal digits |

Each marks plainly what was read from the binary and what was inferred, and
[what is still unknown](docs/02-architecture.md#what-is-still-unknown) is
listed rather than papered over.

## What was found

**The program's real entry point is hidden behind a crack intro.** The file
opens with `jmp 0x180` over 126 bytes of text ending in a DOS end-of-file
marker — a signature that shows up when you `TYPE` the file and never when you
run it. Behind it is a stub that far-returns into a second address base and
patches its own first instruction with a segment computed at run time.

Straight out of the box, a disassembler recovered **nine instructions out of
20,736 bytes** and reported the rebuild as byte-identical. It was: nine
instructions and 20,718 bytes of `db`. That is the clearest demonstration in
this repository of why *the rebuild is exact* and *the program is understood*
are two different claims.

**The game is 60% artwork by weight, and almost none of it is stored as
pixels.** Seven fortress sections of 192 × 144 pixels — 48,384 bytes as
bitmaps — occupy **982 bytes**, because they are run-length encoded grids of
8 × 8 tiles rather than run-length encoded pixels. One command covers 64
pixels.

**Zaxxon broke three things in the toolkit, and all three are now fixed with
regression tests.** The layout detector gave up at the banner jump; the
interrupt-handler detector knew only one of the two ways to write a vector; and
nothing at all could follow a jump through a table, which is how 2,400 bytes of
this game's routines are reached. Recovery of the code region went 0.1% →
57.9% → **75.3%** as each was addressed. The fixes and the fixtures live in
[dos-decompiler](https://github.com/agunawijaya/dos-decompiler).

## Reconstructing the source

**`original/` and `recovered/` are not in this repository.** Zaxxon is still
under copyright, and `recovered/zaxxon.asm` assembles to a byte-identical copy
— which makes shipping it the same as shipping the game, only in source form.

If you have your own copy you can regenerate both. You need
[dos-decompiler](https://github.com/agunawijaya/dos-decompiler) and
[NASM](https://www.nasm.us/):

```powershell
mkdir original, recovered
copy <your copy> original\ZAXXON.COM

python <path-to>\dos-decompiler\tools\comrec.py `
       original\ZAXXON.COM --out recovered\zaxxon.asm --map recovered\zaxxon.map
```

No flags describing the layout are needed; it works the rest out. It reports
what it found before it starts:

```
segments    : 0x0000+ @ base 0x0100, 0x0100+ @ base 0x0000   (detected from the entry stub)
interrupts  : INT 1Ch -> file 0x00291
jump tables : cs:0x075e -> 11 targets, 0x008FC..0x01B03; cs:0x1754 -> 4 targets, ...
instructions: 2,633 disassembled (114 pinned to fixed bytes to preserve encoding)
bytes as code: 6,335 / 20,736  (30.6% of file)
code region : 0x0000..0x20DD  (8,413 bytes)
  recovered : 6,333 bytes as instructions (75.3% of the code region)
  data tail : 0x20DD..0x5100 left as data (12,323 bytes)
BYTE-IDENTICAL
```

Check that claim rather than believing it:

```powershell
nasm -f bin -o recovered\rebuilt.com recovered\zaxxon.asm
(Get-FileHash original\ZAXXON.COM   -Algorithm SHA256).Hash
(Get-FileHash recovered\rebuilt.com -Algorithm SHA256).Hash
```

Both should read
`A9214CCED592DDEA960753A37ECB0029A7AE7AE2B37E9EE394944BE61A41A45B`, at 20,736
bytes.

## Drawing the artwork

Nothing in `recovered/*.png` is a screenshot. Every sprite, every tile, every
wall and every object position is read out of the file, using formats taken
from the drawing routines themselves. The program is never run, and this needs
neither the toolkit nor an assembler — only [Pillow](https://python-pillow.org/):

```powershell
python tools\render-artwork.py --com original\ZAXXON.COM --out recovered
```

```
sprites.png   34 sprites, 8 storage formats
tiles.png     94 tiles of 8x8
sections.png  7 compressed fortress sections
screen.png    11/11 objects placed from wave script 0
```

`screen.png` is the one that can be wrong in an interesting way, and the other
three are what make it checkable: a sprite decoded with the wrong width shears
diagonally and you see it on the sheet in a second, rather than wondering about
the composed screen for an hour.

**Two things to be honest about.**

`screen.png` is a frame the game would never produce. It draws a whole wave
script at once, spread along the approach, where the game feeds the same wave
in over time as object slots come free. Every *position* in it is one the game
would produce; the combination is composed.

And the toolkit's usual measure of this — `placements.py`, which walks a build
routine's call tree and reports the fraction of "draw sprite S at column C, row
R" calls it could explain — **finds nothing here, correctly**:

```
0 placement routines found
```

That tool looks for a screen assembled by a sequence of calls, which is what
Hard Hat Mack's levels are. Zaxxon has no such routine: its screens are a
scrolling background plus a table of objects that move every frame, so there is
no call tree to walk and no fraction to quote. A recorded negative result, not
a failure to try.

For a reference to compare against, the toolkit's `comrun.py` runs the binary
under emulation and dumps the framebuffer:

```powershell
python <path-to>\dos-decompiler\tools\comrun.py original\ZAXXON.COM `
       --keys K,1 --stop-at 0x3B1 --stop-after 200 --png frame.png
```

**None of this is needed to read the documents** — every routine discussed is
quoted where it is explained.

---

Zaxxon is © 1982–84 Sega Enterprises. Nothing here redistributes it.
