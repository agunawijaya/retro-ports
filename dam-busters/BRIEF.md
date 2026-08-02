# Brief: The Dam Busters (1984, DOS)

Sydney Development, published by Accolade. Nothing here has been read yet. This file is the triage, done on
2026-08-02 with `mzinfo.py` and `comrec.py` -- **every number below was
measured, not recalled** -- and the order the work is worth doing in.

## What triage found

- MZ, but **0 relocations** and entry `0000:0000`
- load image 0x200..0x10004 (65,028 bytes), 124 bytes trailing
- single-segment: a `.COM` wearing an MZ header

**This is the same shape as Karateka**, and Karateka is the
worked example: an MZ with no relocations is a single-segment program, and
comrec reconstructs it by stripping the header, treating the image as a `.COM`,
and putting the header back on the way out. `build.ps1` here already does
that, copied from Karateka's.

The 124 trailing bytes past the declared load image are worth a look before
anything else -- they are outside what DOS loads, so either the header
under-declares the image or something appended them.

Of the seven set up in this session this is the most likely to go all the way
through on the existing pipeline without new tooling.

## Tested on 2026-08-02

`build.ps1` reports **BYTE-IDENTICAL**, `D3657960…`, at 12.3% decoded.

It did not on the first attempt, and the reason is worth keeping. comrec
reconstructs the **load image** — what DOS maps into memory — and the build
concatenated header + image. This file keeps **124 bytes past the declared
image**, which DOS never loads and comrec never sees, so the rebuild came out
124 bytes short and the hash missed. mzinfo warns about trailing data for
exactly this reason, and the warning was there in the triage above before the
build was ever run. `build.ps1` puts it back now, and says so when it does.

12.3% is low. Same question as everywhere: where does control go that the walk
cannot follow?

## The first thing to do

Run `build.ps1`. If it reports BYTE-IDENTICAL, follow Karateka's path exactly: name the call targets from evidence, then the bracketed constants, then `_data_spans`.

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
