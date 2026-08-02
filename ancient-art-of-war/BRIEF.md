# Brief: The Ancient Art of War (1984, DOS) — CGA

Dave and Barry Murry (Evryware), published by Broderbund. Nothing here has been read yet. This file is the triage, done on
2026-08-02 with `mzinfo.py` and `comrec.py` -- **every number below was
measured, not recalled** -- and the order the work is worth doing in.

## What triage found

- MZ, 67 relocations, load image 0x200..0x31E0 -- **12,256 bytes**
- **87,072 bytes of trailing data** past the declared image
- entry CS:IP 027E:02FA
- many data files beside it: `PG`..`PN`, `M`, and more

**The declared load image is 12 KB and the file is 100 KB.**
DOS loads only what the header declares, so seven eighths of this file is not
code that runs at start-up. It is read later, by the 12 KB that does.

That makes this the hardest of the seven and the most interesting. The 12 KB
is a loader or a resident kernel; the 87 KB behind it is levels, artwork,
scenario data, or further code paged in on demand. mzinfo flags the trailing
data as a warning for exactly this reason.

There is also an EGA version in the collection
(`The-Ancient-Art-of-War_DOS_EN_EGA-Version.zip`, 261 KB). Comparing the two
is a shortcut worth remembering: whatever differs between them is display
code, and whatever matches is everything else.

## Tested on 2026-08-02

`build.ps1` reports **BYTE-IDENTICAL**, `B26326CE…`, and decodes **73.2% of the
12,256-byte load image** — plus the 87,072 trailing bytes put back on the end,
which the build now says out loud when it does it.

This took two corrections, both of them mine.

**First**, the failure was written up as "67 relocations, so the `.COM` route
does not apply". The actual rule was `nreloc > 8`, a threshold set when
Karateka's four was the only data point. `comrec.py` takes
`--max-relocations N` now and this build passes 128.

**Second**, and worse: when the route was refused, comrec fell back to reading
the whole 99,840-byte file flat and decoded 61% of it. That was written up here
as evidence that *"the 87 KB of trailing data is mostly code, not artwork"* —
correcting an earlier guess with a measurement. But the 61% came from reading
the file at the wrong base, over a region DOS never loads. It measured nothing
about the trailing data. **The correction was as unfounded as the guess it
replaced**, and it read as more authoritative for having a number attached.

What is actually known: the load image is 12,256 bytes and 73.2% of it comes
back as instructions. What the other 87,072 bytes are is **open**, and the way
to find out is to read the 12 KB and see how it reaches them.

## The first thing to do

Reconstruct the 12,256-byte load image first and read it as its own program. Do not touch the 87 KB until the 12 KB says what it is for -- that is the difference between reading and guessing.

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
