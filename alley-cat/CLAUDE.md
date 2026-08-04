# Alley Cat (1984) — working notes

Context for an agent working in this folder. **Read the numbers `build.ps1`
prints, not this file's memory of them.**

Bill Williams for Synapse Software, published by Datasoft.

## Where this stands

| | |
|---|---|
| rebuild | **byte-identical**, `4979C886…` |
| decoded as code | 41.4% of the 54,555-byte load image |
| routines named | **0 of N call targets** — nothing read yet |
| variables named | **0 of N bracketed constants** — nothing read yet |
| data spans | none yet |

Triaged on 2026-08-02 and set up to rebuild; nothing above the naming line has
been read. See [BRIEF.md](BRIEF.md) for the triage.

## The one thing to know before touching it

**The relocation-count guard is what almost lost this one, and the fix is
already in the tree — but the reason it is there is worth carrying forward.**

`comrec.py` used to refuse any file with more than eight relocations. That
threshold was picked when Karateka (four) was the only example anybody had.
Alley Cat has **nine**, and the first attempt failed with a message that read
as "the .COM route does not apply here." It did apply. The rule was one
relocation too tight.

The current build passes `--max-relocations 16` and gets a byte-identical
rebuild at 41.4% decoded. **But byte-identity does not prove the address base
was right.** Frogger rebuilds exactly while reading half its code from the
wrong segment; the only symptom is a decode rate that stays low for no visible
reason. 41.4% on a 54 KB game is plausible — data-heavy games decode in that
range — but if further reading finds control leaving the walk in a pattern
that says "wrong segment," the nine relocations and the multi-segment layout
are where to look. **Do not raise `--max-relocations` for other games** to
match; the guard is protecting against something real, and it is per-game on
purpose.

## What triage found, and what it implies

- MZ, 512-byte header, load image `0x200..0xD71B` (54,555 bytes)
- **9 relocations** across 54 KB — multi-segment, but barely
- entry `CS:IP 0723:0000`, file offset `0x7430`
- no trailing data

Nine relocations across 54 KB means the program is laid out in several segments
but most addressing stays within one. The entry sits **two thirds of the way
into the image** at `0x7430`, so the 30 KB before it is either reached from
there or is data. That is the first thing the reading has to establish, and
`tools/profile.py` is the way in: what calls into the pre-entry region, and
what does not.

## How to regenerate

```powershell
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

Three steps: reconstruct, name, **rebuild and compare**. It refuses to report
success on anything short of an identical SHA-256. `tools/profile.py` in the
toolkit prints what can be said about each unnamed routine and address without
guessing — interrupts, ports, stored constants, callers, callees, writers,
readers.

This repository ships no game files. Put your own copy of `CAT.EXE` in
`original\`. Nothing in `recovered\` may be committed: a byte-identical
reconstruction is the game, named or not.

## What is open, in the order it is worth doing

1. **Confirm the segment layout is being read correctly.** If the decode rate
   does not move much past 41% as naming progresses, the multi-segment layout
   is the suspect and `--segment` is the lever.
2. Name the call targets, with evidence, from `tools/profile.py` output.
3. Name the bracketed constants, and record the ones that are displacements
   rather than addresses in `_displacements`.
4. Name every **tail-call entry** — an address a `jmp` reaches from outside
   the routine containing it. Karateka read "165 of 165 direct calls" while
   39 tail-call entries had no name; the direct-call count is not the
   denominator that matters.
5. `_data_spans`: a contiguous partition of all 54,555 bytes, no gap and no
   overlap, each extent saying what it is for. This is the denominator that
   catches a symbol file which names every reference and has never looked at
   half the file.
6. Documents `01`–`06`, and a port. [ParaTrooper](../paratrooper/) is the
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
