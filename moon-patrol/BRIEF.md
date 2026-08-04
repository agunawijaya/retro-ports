# Brief: Moon Patrol (Atari, 1984, DOS)

Irem's 1982 arcade original, DOS conversion published by Atari, Inc. -- the
copyright banner in the file reads `Moon Patrol Copyright (C) 1984 Atari, Inc.`
at file 0x4E98, so 1984 is what the disk shipped, not 1983 as the previous
version of this brief guessed.

The triage was done on 2026-08-02 with `mzinfo.py` and `comrec.py`; the
reading opened up on 2026-08-03 once the entry-stub trap below was fixed.
**Every number below is what the tools currently print**, not what they printed
before.

## What triage found

- one `.COM`, 58,306 bytes -- the largest `.COM` in the collection
- rebuilds **byte-identically**: SHA-256 `FF12627C…`
- **32.9% of the file** decoded as code -- **88.3% of the 21,705-byte code
  region** at `0x0000..0x54C9` came back as instructions (8,578 of them, 463
  pinned to fixed bytes to preserve encoding)
- **mechanically translated from 6502**: comrec's own detector saw 281 `cmc`
  instructions, 99% of them straight after a `cmp` or `sub`, covering 75% of
  all compares. Same class as Hard Hat Mack. Read as 6502: AL is the
  accumulator, BL and CL are X and Y index registers, no register push/pop,
  16-bit as byte pairs with `adc`, every global is a fixed address. See
  [`knowledge/14-translated-binaries.md`](../../DOS-Decompiler/knowledge/14-translated-binaries.md).

## What the earlier triage got wrong, on the record

The previous version of this file said **"0.5% is the whole story"** and
listed three shapes the entry might have. The correct answer was the first of
the three -- **the program relocates itself to a fresh segment and jumps
there** -- and it was mis-classified because comrec did not detect it.

Zaxxon and ParaTrooper use a `retf` far-return that comrec's stub-detector
recognises automatically. Moon Patrol writes the target pointer at run time:

    mov ax, cs
    add ax, strict word 0x20    ; +0x20 paragraphs = +512 bytes
    mov word [0x142], ax        ; segment field
    xor ax, ax
    mov word [0x140], ax        ; offset field
    jmp far [0x140]             ; -> (CS+0x20):0000 = file 0x100 in new segment

Nothing in the file image points to file 0x100 -- the pointer only exists
after those five stores run, so a static walk cannot see it. `build.ps1` now
passes `--segment 0x100:0 --entry 0x100` and 0.5% became 88.3%.

**The first byte of the new segment is another jump**: `e9 eb 01` = `jmp 0x1EE`,
so the real init routine is at file 0x2EE (address 0x1EE in the new-segment
coordinate system). That is `startup` in `symbols.json`.

## Where the reading stands (2026-08-03)

- **130 of 130 call targets named** with the evidence for each
- **0 unnamed tail-call entries** -- every address the code jumps to from
  outside its containing routine is accounted for
- **328 of 328 bracketed constants covered**: 243 named as globals, 85 more
  recorded in `_displacements` as base addresses of per-slot object arrays
- **175 routine names, 256 globals**, 734 label references and 1,488 memory
  references applied on each build
- **`_data_spans`**: 28 spans partition the whole 58,306-byte file with no
  gap and no overlap. The 36,601-byte data tail at 0x54C9..0xE302 is
  described region by region: sprite pointer tables at DS:0x1210/0x1242/0x1268,
  the 200-entry CGA scanline table at DS:0x53C9, sound engine at DS:0x556F,
  script tables at DS:0xC46/0xC93, keyboard/joystick maps and the menu text
- documents **01-03 written** (the game, the architecture, the code walk);
  docs 04-06 belong to the port phase and come next

The one thing annotate.py's audit still notes -- `0x00011 had nowhere to
go` -- is informational: 0x0011 is inside a run comrec decoded as
instructions (`add byte [bx+si], al` on 238 bytes of zeros), and the span
is right; the message just says the heading cannot be placed as a label
without splitting a code run. The span is in the partition; the byte-
identity check hashes correctly with it there.

## What the referee run corrected and then re-corrected

The referee run went through two revisions before settling. Both are on
the record here because both were wrong in instructive ways.

**First reading (wrong):** the blit routines look up a 200-word "scanline
pointer table" at DS:0x53C9 giving the CGA memory offset for each row.

**First correction (also wrong):** the referee-run image had ~1/6 top-of-
screen garbage, so the scanline-table interpretation was declared broken
and re-tested. A byte-level comparison found the runtime bytes at CS:0x53C9
differ from the file bytes in 165 of 167 positions, so a startup routine
does overwrite the region -- but the runtime bytes did not match a plain
CGA segment layout (0xB800 + row/2 * 5) either, so the table was renamed
`video_dispatch_table_UNCLEAR` and the blit routines' descriptions were
softened to say the mechanism was unknown.

**Second correction (the one that stands):** running comrun again with a
different instruction budget produced a fully clean render -- HUD reads
`HIGH 001550 / 000000 / 2UP 000000` on the left, `POINT / TIME 000` and
the A-Z checkpoint arrow on the right, the buggy icon and life count in
the corner, and the game field with the moon buggy on scrolling terrain
below. Nothing garbage anywhere.

The pixel garbage was a **capture-timing** effect. Comrun stops the
emulator when `--budget` is exhausted, and that lands at whatever
instruction the run happens to be executing. If it lands in the middle of
a routine that XOR-erases a digit before XOR-drawing the new one, the
snapshot shows the erased state. If it lands at a frame boundary or in a
poll loop, the snapshot is clean. Neither says anything about the game's
correctness -- both are the game working normally, sampled at different
moments in its own loop.

The decompile itself was closer to right than the first-correction claim.
The table at CS:0x53C9 does supply per-row ES values to the blit; a
startup routine does populate it (the runtime differs from the static
image), and the game renders correctly using it. What remains genuinely
open is the **exact encoding** of each entry -- the runtime values did
not match a plain segment table in the spot-check, so the entries may
combine row and column shift, or encode something a frame-by-frame trace
would clarify. `symbols.json` names it `row_dispatch_table` with that
uncertainty on the record.

The blit routine names were also revised: `blit_sprite_xor` became
`blit_sprite_or` (its inner is `or word [es:di], ax` -- draws by setting
bits), and `blit_sprite_copy` became `blit_sprite_and` (`not ax; and
word [es:di], ax` -- clears bits). Together they are the erase/draw
pair a per-frame sprite move needs.

**The lesson worth internalising**: a static reading that survives
byte-identity and the annotate.py audit can still be wrong in ways only
a runtime referee can catch, AND a single referee-run image can be
misleading in ways only a second run catches. Look at more than one
frame before drawing conclusions from what a frame does not show.

## The two things that will trip you

**The file has two address bases.** File 0x0000..0x00FF runs at ORG 0x100
(the .COM load position); file 0x0100 onward runs in a new segment addressed
from 0. A near jump at file 0x100 like `e9 eb 01` reads as `jmp 0x1EE` in the
new base, which is file 0x2EE. In the assembly listing the labels are file
offsets, so `L_002EE` is that same instruction. Get this wrong and every
address in the code region is off by 0x100.

**DS is not CS.** startup sets `DS = CS + 0x55D paragraphs`, so DS:0x0000 =
file 0x56D0 -- 517 bytes past the end of the code region. A bare `[0x81E0]`
in the listing addresses file 0xD8B0, which is the `          Game Options          `
banner in the data tail. `cs:` and bare-DS references are two different address
spaces. Zaxxon has the same rule (see [`../zaxxon/CLAUDE.md`](../zaxxon/CLAUDE.md)).

## How to regenerate

```powershell
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

Three steps: reconstruct with `--segment 0x100:0 --entry 0x100`, apply names
from `symbols.json`, reassemble and compare. Refuses to report success on
anything short of the original SHA-256 `FF12627C…`.

## The title-screen referee run

Byte-identity says the bytes came back the same. It says nothing about
whether the reading is right, because emitting the whole file as `db` would
also hash correctly. The referee for a static reading is a run:

```powershell
python ..\..\DOS-Decompiler\tools\comrun.py recovered\rebuilt.bin `
       --png reference\screen-boot.png --palette 1
```

`rebuilt.bin` is the byte-for-byte reassembly of the recovered assembly
listing. If it runs to a real screen, everything static about the reading
survives one test the reading itself cannot do: the entry-stub interpretation,
the address bases, the DS bias, the CRTC programming, the palette choice,
the scanline-table indexing and the sprite-atlas layout have all been
exercised by execution.

On 2026-08-03 the run stopped at image offset 0x8A8-0x8B4 with 'budget
exhausted', which is a small tight loop that reads the keyboard variable at
`[0x100]` -- the game arrived at its title screen and is waiting for `F1`
or `F2`. The interrupts requested and ports written match the reading:
INT 10h once, ports 0xA0 (NMI mask), 0x61 (PPI/speaker), 0x3D4/0x3D8/0x3DA
(CGA CRTC + status). Nothing else.

The `reference/` folder is gitignored, so the PNG stays out of the tree.

One factual correction the referee delivered: the on-screen banner reads
`(C) 1982 WILLIAMS   (C) 1983 ATARI`, but the never-displayed string at file
0x4E98 reads `Copyright (C) 1984 Atari, Inc.`. The on-screen date is the
one that shipped; the internal string is either a later-revision notice or a
source-tree leftover. Documents that name a date name **1983**.

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
