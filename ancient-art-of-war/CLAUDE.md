# The Ancient Art of War (1984) — working notes

Context for an agent working in this folder. **Read the numbers `build.ps1`
prints, not this file's memory of them.**

Dave and Barry Murry (Evryware), published by Broderbund. CGA version.

## Where this stands

| | |
|---|---|
| rebuild | **byte-identical**, `B26326CE…` |
| decoded as code | **73.2% of the 12,256-byte load image** |
| trailing data preserved | 87,072 bytes, put back verbatim on the end |
| routines named | **0 of N call targets** — nothing read yet |
| variables named | **0 of N bracketed constants** — nothing read yet |
| data spans | none yet |

Triaged on 2026-08-02 and set up to rebuild; nothing above the naming line has
been read. See [BRIEF.md](BRIEF.md) for the triage and the two corrections it
took to get here.

## The one thing to know before touching it

**The file is 99,840 bytes and DOS loads only 12,256 of them.** The MZ header
declares a 12 KB image; the other 87 KB sits behind it on disk and is not
mapped into memory when the program starts. It is read later, by the 12 KB
that does — a loader or resident kernel that pages in levels, artwork,
scenario data, or further code on demand.

The trap this project has already fallen into once, and left a note about in
[BRIEF.md](BRIEF.md), is to read the whole 99,840-byte file flat and report a
decode rate on it. Comrec does that as a fallback when it refuses the `.COM`
route. The 61% it returned was published here as "the 87 KB is mostly code,
not artwork" — but that reading was done at the wrong base, over a region DOS
never loads. **It measured nothing about the trailing data.** A number with a
wrong denominator reads as more authoritative than a guess, which is why the
mistake was worse than the guess it replaced.

What is actually known: **the 12,256-byte load image decodes 73.2% as code.**
What the 87,072 bytes behind it hold is **open**, and the way to find out is
to read the 12 KB and see how it reaches them — not to run a decoder over
bytes DOS never gave the program.

The build now says out loud when it appends the trailing data, so the number
is visible on every run. Read it, do not remember it.

## What triage found, and what it implies

- MZ, **67 relocations**, load image `0x200..0x31E0` — **12,256 bytes**
- **87,072 bytes of trailing data** past the declared image
- entry `CS:IP 027E:02FA`
- data files beside it in the collection: `PG`..`PN`, `M`, and more

67 relocations across 12 KB is dense — this is genuinely multi-segment code,
unlike Alley Cat's nominal nine. `--max-relocations 128` is passed in
`build.ps1` because the toolkit's default guard (`> 8`) refuses it, and that
guard is per-game on purpose: **a byte-identical rebuild does not prove the
address base was right**, only that every byte was accounted for. If the
decode rate does not move as naming progresses, the segment layout is the
first suspect.

There is also an EGA version in the wider collection
(`The-Ancient-Art-of-War_DOS_EN_EGA-Version.zip`, 261 KB). **Comparing the two
is a shortcut worth remembering:** whatever differs between them is display
code, and whatever matches is everything else. Do not use it as the reading —
use it to isolate where to look first.

## How to regenerate

```powershell
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

Three steps: reconstruct, name, **rebuild and compare**. It refuses to report
success on anything short of an identical SHA-256, and it prints the trailing
data size as it appends it. `tools/profile.py` in the toolkit prints what can
be said about each unnamed routine and address without guessing.

This repository ships no game files. Put your own copy of `WAR.EXE` in
`original\` — along with the data files that live beside it (`PG`, `PH`, …,
`PN`, `M`, and any others). Nothing in `recovered\` may be committed: a
byte-identical reconstruction is the game, named or not.

## What is open, in the order it is worth doing

1. **Read the 12 KB, not the 87 KB.** The load image is its own program;
   understand it before touching anything behind it.
2. **Find how the 12 KB reaches the trailing data.** Which DOS calls open
   which of `PG`..`PN` and `M`; what offsets it reads; whether it maps them
   into memory or streams them. That answer tells you what the 87 KB actually
   is, which is the question the earlier reading tried to answer with a
   decoder and got wrong.
3. Name the call targets in the 12 KB, with evidence, from `tools/profile.py`
   output.
4. Name the bracketed constants, and record the ones that are displacements
   rather than addresses in `_displacements`.
5. Name every **tail-call entry** — an address a `jmp` reaches from outside
   the routine containing it. Karateka read "165 of 165 direct calls" while
   39 tail-call entries had no name; the direct-call count is not the
   denominator that matters.
6. `_data_spans`: a contiguous partition of the 12,256-byte image, no gap
   and no overlap, each extent saying what it is for. The trailing 87 KB gets
   spans of its own once the 12 KB says what it is for.
7. Documents `01`–`06`, and a port. [ParaTrooper](../paratrooper/) is the
   worked example of both.

## Where to look

| | |
|---|---|
| repository conventions | [`../CLAUDE.md`](../CLAUDE.md) |
| the triage that set this up | [`BRIEF.md`](BRIEF.md) |
| a game taken all the way | [`../paratrooper/`](../paratrooper/) |
| the fullest symbol file | [`../tapper/symbols.json`](../tapper/symbols.json) |
| how to choose a hook | [`../../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md`](../../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md) |
| naming hand-written asm | [`../../DOS-Decompiler/knowledge/13-naming-hand-written-assembly.md`](../../DOS-Decompiler/knowledge/13-naming-hand-written-assembly.md) |
