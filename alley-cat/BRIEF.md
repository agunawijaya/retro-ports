# Brief: Alley Cat (1984, DOS)

Bill Williams for Synapse Software, published by Datasoft. Nothing here has been read yet. This file is the triage, done on
2026-08-02 with `mzinfo.py` and `comrec.py` -- **every number below was
measured, not recalled** -- and the order the work is worth doing in.

## What triage found

- MZ, 512-byte header, load image 0x200..0xD71B (54,555 bytes)
- **9 relocations** -- multi-segment, but only just
- entry CS:IP 0723:0000, file offset 0x7430
- no trailing data

Nine relocations across 54 KB means the program is laid out in
several segments but barely uses them -- most addressing is within one. The
entry sits two thirds of the way into the image at 0x7430, so the code before
it is either reached from there or is data.

Nothing in this collection has been reconstructed through the relocation path
yet. Karateka is an MZ, but a single-segment one that takes the `.COM` route.
This is the first that may genuinely need relocations applied, and finding
that out is the first job.

## Tested on 2026-08-02

`build.ps1` reports **BYTE-IDENTICAL**, `4979C886…`, at **41.4% decoded** —
and only after the tool was changed, which is the part worth reading.

The first attempt failed with "comrec.py did not write an MZ header", and that
was written up here as *"the .COM route needs a file with no relocations, and
this one has nine."* **That was wrong.** The rule in `comrec.py` was
`if nreloc > 8: return None` — not zero, eight. Alley Cat missed it **by one
relocation**, against a threshold picked when Karateka (four relocations) was
the only example anybody had.

Raising the limit and running it: byte-identical, 41.4%. The nine relocations
were never the obstacle.

`comrec.py` now takes `--max-relocations N`, and `build.ps1` here passes 16.
The limit is raised per game and on purpose rather than widened for everyone,
because the guard is protecting against something real: **a byte-identical
rebuild does not prove the address base was right.** Frogger rebuilds exactly
while addressing half its code from the wrong segment, and the only symptom is
a decode rate that stays low for no visible reason. 41.4% is plausible for a
55 KB game; if it had come out at 5%, the hash would still have matched and the
reading would still have been wrong.

## The first thing to do

Run comrec through the .COM route first (`build.ps1` does). If it reports BYTE-IDENTICAL, the nine relocations do not matter for reconstruction and only matter for reading. If it does not, that is the interesting result and worth writing down.

## How to regenerate

```powershell
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

Three steps: reconstruct, apply names, **reassemble and compare**. It refuses
to report success on anything short of an identical SHA-256. Put your own copy
of the game in `original\`; this repository ships none.

## The rules, and they do not bend

**Nothing derived from the game may ever be committed.** Not the binary, not a
byte-identical reconstruction of it, not extracted sprites, not memory dumps,
not screenshots. `original/`, `recovered/` and `reference/` are gitignored and
game binaries are blocked repository-wide as a backstop. A sprite sheet pulled
out of a copyrighted game is still that game, and a PNG does not feel like a
binary, which is exactly why people forget. Read what you staged before every
commit that adds files; never `git add -A`.

**Byte-identity is the floor, not the achievement.** Emitting the whole file as
`db` would also hash correctly and tell you nothing. The number that matters is
how much came back as instructions, and after that how much has a name with
evidence behind it.

**Measure, never recall.** Six times in this project the question "is it
finished?" found a real gap, and every time the previous count read 100%
against the wrong denominator: prologues instead of call targets, references
instead of bytes, direct calls instead of every address control reaches. Put
the denominator in the same sentence as the percentage. `annotate.py` checks
all of them on every build and prints them -- **read that output, not a
document's memory of it.**

**Every name carries its evidence.** A name with no `why` is a guess the next
reader will believe. This project has published three of those and withdrawn
them.

**Do not use heredocs to write scripts.** They eat backslash escapes and the
check then passes while measuring nothing.

**No absolute paths in repository code.** Take toolchains as parameters.

## The ladder, in order

1. `build.ps1` reports **BYTE-IDENTICAL**. Nothing counts before this.
2. The decode rate is as high as the file allows. A low one means control is
   leaving somewhere the walk cannot follow -- find out where before naming
   anything.
3. Every **call target** named, with evidence. Not every prologue: a
   hand-written runtime has none, and Karateka read "120 of 120" while 56 call
   targets had no name.
4. Every **tail-call entry** -- an address a `jmp` reaches from outside the
   routine containing it. Karateka had 39 of those while the direct-call count
   read 165 of 165.
5. Every **bracketed constant** named, or recorded in `_displacements` as an
   offset rather than an address.
6. **`_data_spans`**: a contiguous partition of the whole image, no gap and no
   overlap, each extent saying what it is for. This is the denominator that
   catches a symbol file which names every reference and has never looked at
   half the file.
7. Then the documents `01`-`06`, then the port.

## Where to look

| | |
|---|---|
| the conventions | [`../CLAUDE.md`](../CLAUDE.md) |
| a game taken all the way | [`../paratrooper/`](../paratrooper/) -- six documents and a playable port in three files with **no image assets at all** |
| the fullest symbol file | [`../tapper/symbols.json`](../tapper/symbols.json) -- 583 routines, 336 globals, 43 spans |
| how to choose a hook | [`../../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md`](../../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md) |
| naming hand-written asm | [`../../DOS-Decompiler/knowledge/13-naming-hand-written-assembly.md`](../../DOS-Decompiler/knowledge/13-naming-hand-written-assembly.md) |
| when a game is a translation | [`../../DOS-Decompiler/knowledge/14-translated-binaries.md`](../../DOS-Decompiler/knowledge/14-translated-binaries.md) |
| a port brief, for later | [`../karateka/PORT-BRIEF.md`](../karateka/PORT-BRIEF.md) |
