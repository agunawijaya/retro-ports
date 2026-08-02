# Frogger (1983) — working notes

Context for an agent working in this folder. **Read the numbers `build.ps1`
prints, not this file's memory of them.**

## Where this stands

| | |
|---|---|
| rebuild | **byte-identical**, `D6437F96…` |
| decoded as code | 53.0% of the file (19,537 of 36,864 bytes) |
| routines named | **0 of 91 call targets** |
| variables named | **0 of 319 bracketed constants** |
| data spans | none yet |

Newest in the collection and the least read. Everything above the naming line
is done and checked on every build; everything below it is the work.

## The one thing to know before touching it

**This release is patched, and the patch moves the address base.** The file
starts with a stub that is not Frogger:

```
L_00068:
    cli
    mov ax, cs
    add ax, strict word 0x10     ; ten paragraphs on
    mov word [0x302], ax
    mov ax, 0x252
    mov word [0x300], ax
    mov ah, 9
    mov dx, 0x184                ; "/Patch for Frogger, F10 or another key to play!$"
    int 0x21
    mov bx, 0x300
    sti
    ljmp [bx]
```

So the game proper runs in a segment **0x10 paragraphs past** the one the
`.COM` was loaded into, and its entry is offset `0x252` there. A `.COM`
segment begins 0x100 bytes before the file, so shifting it by 0x100 makes the
new segment's offset 0 land exactly on file offset 0 — the body's addresses
are its file offsets, and the stub's are file offset + 0x100. **Two bases in
one file.**

`comrec.py` detects one region (`0x0000+ @ base 0x0100`) and reads the whole
file that way, which is why only half of it decodes: every absolute address in
the game body is off by 0x100, so the walk loses the thread almost at once.
`--segment` exists for exactly this and has not been applied yet. Doing that
first is worth more than any amount of naming, because every address named
before it is named in the wrong coordinate — the mistake this project has
already paid for twice, and the one whose only symptom is silence.

## What the strings already tell you

They are legible and they name the top-level structure:

| file offset | |
|---|---|
| `0x00183` | `/Patch for Frogger, F10 or another key to play!$` — the stub, not the game |
| `0x00637` | `FROGGER OPTIONS`, `F1 - Redefine keys`, `F2 - Joystick select`, `F3 - Play level` |
| `0x0093D` | `KEYBOARD REDEFINITION`, `Type "UP" key`, and the rest |
| `0x009AF` | `Play Level - Is this level your choice? (y/n)` |
| `0x00E1C` | `Score: Hi   Yours   Frogs:` — the HUD |
| `0x02A84` | ` GAME OVER `, `--- TIME OVER ---`, `TIME` |

## How to regenerate

```powershell
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

Three steps: reconstruct, name, **rebuild and compare**. It refuses to report
success on anything short of an identical SHA-256. `tools/profile.py` prints
what can be said about each unnamed routine and address without guessing —
interrupts, ports, stored constants, callers, callees, writers, readers.

This repository ships no game files. Put your own copy of `FROGGER.COM` in
`original\`. Nothing in `recovered\` may be committed: a byte-identical
reconstruction is the game, named or not.

## What is open, in the order it is worth doing

1. **Find the right `--segment` split and re-measure.** The decode rate is the
   check: if it does not move a long way past 53%, the split is wrong.
2. Name the 91 call targets, with evidence, from `tools/profile.py`.
3. Name the 319 bracketed constants, and record the ones that are
   displacements rather than addresses.
4. `_data_spans`: a contiguous partition of all 36,864 bytes.
5. Documents `01`–`06`, and a port. [ParaTrooper](../paratrooper/) is the
   worked example of both.
