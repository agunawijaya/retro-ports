# Frogger (1983, DOS)

The sixth game in this collection, and the newest. Konami's 1981 arcade
original by way of Sierra On-Line's DOS conversion: four lanes of traffic, five
lanes of river, five homes to fill, and a clock.

**What is here today** is the reconstruction, not yet the reading. From a copy
of `FROGGER.COM` that you own, `build.ps1` produces NASM source that assembles
to a **byte-identical** copy of it — that is checked on every run and the
script refuses to report success without it. 53% of the file comes back as
instructions; the rest is still data.

What is *not* here yet: names, and a port. See
[CLAUDE.md](CLAUDE.md) for the measured state and the order the remaining work
is worth doing in. [ParaTrooper](../paratrooper/) is the worked example of a
game taken all the way through.

## Rebuilding it

You need a copy of the game, NASM, and Python.

```powershell
mkdir original
copy <your copy>\FROGGER.COM original\
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

It prints the SHA-256 of what it built and of what you gave it, and they have
to match.

## One thing worth knowing before you read the disassembly

The widely circulated copy of this game — probably the one you have — is
**patched**. The first thing it does is print

> `/Patch for Frogger, F10 or another key to play!`

and then jump into the game proper, in a segment ten paragraphs further along.
That shift means the game body's addresses are **not** what a `.COM` normally
uses, and the reconstruction currently reads them as if they were. It still
rebuilds exactly — byte-identity does not care — but it is why only half the
file decodes, and it is the first thing to fix.

This is the second game in the collection to arrive with somebody else's code
attached to the front of it; [Tapper](../tapper/) has a crack group's intro
screen and 344 bytes of copy-protection nothing can reach. Preservation gets
you the copy that survived, not the copy that shipped.

## What this repository does not contain

No game files. `original/`, `recovered/` and `reference/` are gitignored,
because a byte-identical reconstruction is the game in another form and a
sprite pulled out of it is still the game. What is kept is the reading: names,
evidence, documentation, and the tools that re-derive the rest from a copy you
already own.
