# Brief: Jungle Hunt (1983, DOS)

Taito's 1982 arcade original, Atarisoft DOS conversion. Nothing here has been read yet. This file is the triage, done on
2026-08-02 with `mzinfo.py` and `comrec.py` -- **every number below was
measured, not recalled** -- and the order the work is worth doing in.

## What triage found

- `hunt.com` 20,096 bytes rebuilds **byte-identically**
- **8.8% decoded as code**
- `hunt.ptl` 36,864 bytes, plus six 16,384-byte files named `@ d h l p t x`

**`hunt.com` is not the game.** It is a crack loader, and it
says so in its own strings:

```
This has been yet another quality game brought
to you by the members of the PTL Club.
Look for more PTL Club cracks!
Call the Buccaneer BBs    (312) 560-7777
PTLLoad from SPI, decoded by Sam Brown and modified by Bad Brains
```

It reads `HUNT.PTL` -- the string is at file offset 0x136 -- and that is where
the game is. The six same-sized files `@ d h l p t x` are almost certainly
graphics banks, one per something: 16,384 bytes is exactly one CGA screen.

So reconstructing `hunt.com` gets you somebody's 1980s loader, which is a
curiosity and not the subject. This is the third release in the collection to
arrive with somebody else's code attached; Tapper has a crack intro and 344
bytes of unreachable copy protection, and Frogger has a patch stub that moves
the address base.

Reconstruct the loader anyway -- it is small, it is honest work, and
understanding how it decodes `HUNT.PTL` is the only way into the game. But
know what you are looking at.

## Tested on 2026-08-02

`build.ps1` reports **BYTE-IDENTICAL**, `ECF3BD75…`, at 8.8% decoded — of the
crack loader, which is not the game.

## The first thing to do

Read `hunt.com` for one thing only: how it turns `HUNT.PTL` into something executable. That decoder is the door. The six 16 KB files are probably CGA screens -- `gfxdump.py` will say in a minute.

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
