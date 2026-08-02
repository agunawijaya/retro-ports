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

## Tested on 2026-08-02 — and it does not build yet

`build.ps1` **fails**, and the failure is the finding.

comrec takes the `.COM` route through an MZ only when the file has **no
relocations**: no relocations means one segment, and one segment means the
image can be treated as a flat `.COM` and the header put back on the way out.
This file has nine. comrec writes no `.mzheader`, and the build stops with a
message saying so.

Of the four MZ games set up in this session, the two with zero relocations
(The Dam Busters, Rampage) rebuild byte-identically through that route and the
two with relocations (this and The Ancient Art of War) do not. **That is the
line, measured.** Nothing in this collection has been reconstructed through a
relocation-aware path, and building one is the interesting work here —
knowledge/07-extended-reconstruction.md is where the ladder for it is written
down.

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
