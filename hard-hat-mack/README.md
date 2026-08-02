# Hard Hat Mack (1983)

A platform game designed by **Michael Abbot** and **Matthew Alexander**,
published by **Electronic Arts** in October 1983 — one of EA's opening five
titles, and the one the company calls "truly EA's first game."

The IBM PC version is somebody else's work again: its own title screen credits
**Dana How & Kevin Gilmore, through TMQ Software, Inc.**, dated 1984. That
credit was recovered by running the program, and it corroborates what the code
already showed — this version was
[mechanically translated from the Apple II's 6502](docs/03-the-code.md#5-the-instruction-that-should-not-be-there),
which is what a conversion house does and not what an author does.

You are a construction worker filling gaps in girders, collecting lunchboxes and
feeding iron to a rivet machine, while a vandal and an inspector from OSHA try
to stop you and a clock runs down.

This folder contains four documents explaining how the IBM PC version works,
and instructions for reconstructing its source yourself.

*Part of [retro-ports](../README.md). There is no browser port yet — the
decompilation came first.*

## Documentation

| | |
|---|---|
| [**docs/01-the-game.md**](docs/01-the-game.md) | what it is, the three levels, the controls, and the state senator who tried to get it banned |
| [**docs/02-architecture.md**](docs/02-architecture.md) | how the program is built: the file layout, taking over the keyboard, video, and how it differs from a hand-written game |
| [**docs/03-the-code.md**](docs/03-the-code.md) | five routines traced line by line — and the 391 instructions that reveal how this version was really made |
| [**docs/04-porting.md**](docs/04-porting.md) | what it would take to rebuild it: five options with their costs, and the five things that will bite in any of them |

Each marks plainly what was read from the binary and what was inferred;
[what is still unknown](docs/02-architecture.md#what-is-still-unknown) is listed
rather than papered over.

## What was found

**The IBM version was not rewritten — it was mechanically translated from the
Apple II's 6502 code.** The evidence is 391 `cmc` instructions, 99% of them
directly after a compare, most of them doing nothing at all. They are a
carry-flag adapter between two processors that disagree about which way round
carry means "borrow", emitted unconditionally by a tool that never checked
whether the flag would be read.

Traced in full in
[03-the-code.md](docs/03-the-code.md#5-the-instruction-that-should-not-be-there).

The program also **installs its own keyboard interrupt handler** — 55 bytes that
nothing in the program ever calls, because the hardware calls them. Handlers are
invisible to a disassembler that follows control flow, which is a hole this game
exposed in the toolkit and which is now closed.

**And the whole game is entered through a pointer.** Following the program from
its first instruction reaches 236 of its 9,060 instructions — 2.6% — before
stopping at `jmp word [0xbd9]`. The way past it is not to follow the jump but to
find the one instruction that writes the pointer, which stores a constant. That
takes reachability to 94.9%, and it closed the gap this project had recorded as
unsolved since Sopwith:
[functions reached only through pointers](docs/02-architecture.md#the-game-is-entered-through-a-pointer).

## Reconstructing the source

**`original/` and `recovered/` are not in this repository.** Hard Hat Mack is
still under copyright, and `recovered/hhm.asm` assembles to a byte-identical
copy — which makes shipping it the same as shipping the game, only in source
form.

If you have your own copy you can regenerate both. You need
[DOS-Decompiler](https://github.com/agunawijaya/DOS-Decompiler) and
[NASM](https://www.nasm.us/):

```powershell
mkdir original, recovered
copy <your copy> original\HHM.COM

python <path-to>\DOS-Decompiler\tools\comrec.py `
       original\HHM.COM --out recovered\hhm.asm
```

It reports what it found before it starts:

```
interrupts  : INT 09h -> file 0x00071
dispatch    : jmp [0x0bd9] -> 0x00BB6; jmp [0x6daa] -> 0x02AFC, 0x02B05, 0x02B0E
              indirect jumps resolved from the constants written to the pointer
provenance  : mechanically translated from 6502
              391 cmc, 99% of them straight after a cmp/sub, covering 91% of
              all compares -- a carry-convention adapter, not hand-written x86
instructions: 9,060 disassembled (320 pinned to fixed bytes to preserve encoding)
bytes as code: 21,746 / 42,112  (51.6% of file)
code region : 0x0000..0x6C8B  (27,787 bytes)
  recovered : 21,738 bytes as instructions (78.2% of the code region)
BYTE-IDENTICAL
```

Check that claim rather than believing it:

```powershell
nasm -f bin -o recovered\rebuilt.com recovered\hhm.asm
(Get-FileHash original\HHM.COM        -Algorithm SHA256).Hash
(Get-FileHash recovered\rebuilt.com   -Algorithm SHA256).Hash
```

## Drawing the level screens

The three level screens in `recovered/screens-game.png` are not screenshots.
Every sprite and every position is read out of the binary — the artwork from
the sprite region, the positions by walking each level's build routine — and
the program is never run:

```powershell
python tools\render-screens.py --toolkit <path-to>\DOS-Decompiler
```

```
3 placement routines found in the binary
Level 1: 53 sprites drawn, 36/36 calls explained
Level 2: 104 sprites drawn, 30/30 calls explained
Level 3: 36 sprites drawn, 39/39 calls explained
```

Neither number means the screen is right. They count placement calls that
produced *a* position, not the *right* one, and only the calls reached from the
three build routines — 40 of the 89 in the program.

For the number that does mean something, run the game and compare. `comrun.py`
in the toolkit executes the binary and dumps the framebuffer, and against that
reference the static reading recovers **38%, 83% and 58%** of the blits the
game actually performs. That is the honest figure, and
[why it is not higher](docs/02-architecture.md#and-a-harder-number-which-is-the-true-one)
is a limit of reading without executing rather than a bug to be tuned out.

Both should read
`FD70BAB8A1099A01A7696A236957F816CC54DE3F0D28C8707F7CADDF60D22737`, at 42,112
bytes.

**None of this is needed to read the documents** — every routine discussed is
quoted where it is explained.

---

Hard Hat Mack is © 1983–84 Electronic Arts. Nothing here redistributes it.
