# The Oregon Trail — the code

*Document three of four. Before: [01 — the game](01-the-game.md),
[02 — architecture](02-architecture.md). After:
[04 — porting](04-porting.md).*

This is a walk through what has actually been read, and it is a **short**
document, because that is the honest length. Four routines and two file formats
are traced here. The game's own logic — the trail, the store, the rivers, the
hunting, the illnesses — is not, though it is now *located*, and
[document two](02-architecture.md#what-is-still-unknown) says so.

Addresses are offsets into the unpacked image. The image begins 32 bytes into
`work/unpacked.exe`, and **segment words in it are 0x1000 higher than the
image-relative value**, because the dump was taken after the packer applied
relocations at that segment.

---

## Reading compiled Pascal, if you have only read assembly before

The other games in this repository were written by hand. This one was written
by a compiler, and compiler output has a grammar you can learn in five minutes.

**A far call is a call to another unit.** `lcall 0x319F:0x03B5` means "segment
`0x319F`, offset `0x3B5`". Within a unit, calls are near — two or three bytes,
no segment. So the far calls are exactly the module boundaries, which is what
[document two](02-architecture.md#eleven-segments-one-per-unit) exploits.

**Every procedure starts and ends the same way.**

```nasm
    push bp
    mov bp, sp
    sub sp, 0x100        ; local variables
    ...
    mov sp, bp
    pop bp
    retf 0x0004          ; and drop four bytes of arguments
```

`[bp+6]`, `[bp+8]` and upward are the arguments; `[bp-2]`, `[bp-4]` and
downward are the locals. Hand-written assembly rarely bothers with any of this
— Zaxxon has three `push bp` in 2,655 instructions — so its presence is itself
the fingerprint that a compiler was here.

**A Pascal string is length-prefixed.** The first byte is the length, then that
many characters. No terminator. So `Your computer must have…` sits in the file
as `41 59 6F 75 72…` — `0x41` is 65, the length.

**Arguments are pushed left to right and the callee cleans up**, which is the
opposite of C on both counts. That is why you see `retf 0x0004` rather than a
bare `retf`.

## Start-up: the chain of unit initialisers

The entry point, at `0x10A`:

```nasm
0010A  lcall 0x319F:0x0000        ; System   -- Borland's runtime
0010F  lcall 0x313D:0x0000
00114  lcall 0x2DE9:0x1326
00119  lcall 0x28DC:0x0000
0011E  lcall 0x25BB:0x0000
00123  lcall 0x251C:0x09E5
00128  push bp                    ; and now the program's own begin block
00129  mov bp, sp
0012B  sub sp, 0x100
```

This is how every Turbo Pascal program starts. A unit may have an
`initialization` section; the compiler emits a call to each one, in dependency
order, before the program's own code runs. Six calls, six units with something
to set up.

It also means **the order of those six calls is the dependency order of the
program**, which is real information about how it was built: `System` first,
because everything needs it, and the program last because it needs everything.

## The System unit initialising itself

The first of those calls lands at `0x219F0`:

```nasm
    mov dx, 0x3348
    mov ds, dx                  ; DS = DGROUP, and that is the last word on
                                ;   the subject of where data lives
    mov [0x1566], es            ; ES holds the PSP on entry -- save it, this
                                ;   is Turbo Pascal's PrefixSeg
    xor bp, bp
    mov ax, sp
    add ax, 0x13
    mov cl, 4
    shr ax, cl                  ; (SP + 19) / 16 -- round up to a paragraph
    mov dx, ss
    add ax, dx                  ; the first paragraph above the stack
    mov [0x153E], ax            ; HeapOrg
    mov [0x1540], ax            ; HeapPtr  -- nothing allocated yet
    add ax, [0x1538]
    mov [0x1542], ax            ; HeapEnd
    ...
    mov ax, es:[2]              ; the PSP's "top of memory" word
    sub ax, 0x1000
    mov [0x1554], ax
```

Two things worth pointing out to someone who has only read hand-written code.

**The heap is computed, not declared.** There is no heap in the executable file.
The runtime works out where it can start — immediately above the stack, rounded
up to a paragraph — and how far it can go, from a word DOS left in the PSP. A
1990 program had no idea how much memory it would be given, so it asks at
start-up.

**`mov [0x1566], es` is the whole reason `PrefixSeg` exists.** On entry, `ES`
points at the PSP: the 256-byte block DOS puts in front of every program,
holding the command line and the memory ceiling. The runtime has exactly one
moment to capture that before something else overwrites `ES`, and this is it.

## The memory check, and the claim it refutes

At `0x14BF3`, in the program's own code:

```nasm
0014BF3  lcall 0x319F:0x03B5       ; into the runtime
0014BF8  mov [bp-4], ax            ; a 32-bit result: DX:AX
0014BFB  mov [bp-2], dx
0014BFE  cmp word [bp-2], 0        ; signed 32-bit compare, high word first
0014C02  jl  0014C0D               ;   negative -> definitely below
0014C04  jg  0014C30               ;   positive -> definitely above
0014C06  cmp word [bp-4], 0x88B8   ;   equal -> compare the low word: 35,000
0014C0B  jae 0014C30
0014C0D  mov di, 0x3ED8            ; the "below" path
0014C10  push ds / push di         ;   a string variable
0014C12  mov di, 0x475C
0014C15  push cs / push di         ;   and a literal, in the code segment
0014C1A  lcall 0x319F:0x1635
0014C1F  lcall 0x319F:0x15B8
0014C24  lcall 0x319F:0x020E
```

Three-instruction signed 32-bit comparison — high word against zero, then
`jl`/`jg` to settle it, then the low word — is what a compiler emits for
`if LongIntValue < 35000`. You would not write it by hand that way.

The literal at `CS:0x475C` is:

```
Your computer must have at least 512K memory to run Oregon Trail.
```

and the routine called at `0x319F:0x03B5` is `MemAvail`:

```nasm
0021DA5  call 0021FBE              ; walk the free list
0021DA8  mov ax, si
0021DAA  mov dx, di
0021DAC  les di, [0x1552]          ; FreeList, a far pointer
0021DB0  sub dx, [0x1550]
0021DB4  sub ax, [0x154E]          ; a far-pointer subtraction ...
0021DB8  jae 0021DE1
0021DBA  add ax, 0x10              ; ... normalised to paragraphs
0021DBD  dec dx
```

**An earlier session read this same code as a copy-protection date check** —
`GetDate`, 35,000 days after 1899-12-30, the game locking itself after 1995.
The address was exactly right; the meaning was not. And the arithmetic behind
the wrong answer genuinely works: 35,000 days after that epoch *is* late 1995.

What separates the two readings is a string sixty-five bytes away, and nothing
else. That is worth remembering as a method: **when a constant admits two
meanings, look for the message the program prints, not for a better argument.**

## Where the artwork is loaded from

Not traced in the code — but the file format is fully read, and
[document two](02-architecture.md#the-artwork-which-needs-no-reverse-engineering)
has it. The short version, because it is the part a port needs:

```
"pcxLib\0"  122-byte header
then, repeating:
    0x01              a marker
    name[13]          "ANIMALS .PCC\0" -- 8.3, space-padded
    size              4 bytes: the length of the image
    metadata[66]
    the PCX           exactly `size` bytes; the next entry follows it
```

29 members per container, two containers, 58 of 58 decoded. The size field and
an independent decode of the run-length encoding agree to within one byte on
every one of them.

## The data file, which is a Pascal record written to disk

`DIALOGS.REC` needed no reverse engineering either, once you know the language.
It is 51 records of 286 bytes:

```pascal
type
  Dialog = record
    speaker : string[29];     { 30 bytes: a length byte and 29 characters }
    advice  : string[255];    { 256 bytes }
  end;                        { 286 bytes, and 51 x 286 = 14,586 exactly }
```

A Pascal `string[N]` occupies `N+1` bytes always, whatever it holds, so a file
of them has a fixed stride and record *n* sits at `n × 286` with no index
needed. That is why the file has no header: there is nothing to say.

```
'A trader named Jim'
    "Better take extra sets of clothing.  Trade 'em to Indians for fresh
     vegetables, fish, or meat. ..."
'A town resident'
    'Some folks seem to think that two oxen are enough to get them to
     Oregon!  Two oxen can barely mo...'
```

**The check is the division.** 14,586 divides by 286 exactly, 51 times, with
nothing left over. A guessed record size almost never does that.

## Where the rest of the program is

Not read — but no longer unlocated, which is the difference between this
document and where it started. The strings in each segment say what each unit
is, and [document two](02-architecture.md#naming-them-which-turned-out-to-be-nearly-free)
has the table. For anyone continuing:

| what you want | where it is | size |
|---|---|---|
| the trail, the menu, weather, landmarks | segment `0x00000` | 31,584 bytes |
| scoring, the ending, the top ten | segment `0x007B6` | 35,008 bytes |
| menus, files, saved games, tombstones | segment `0x01042` | 18,656 bytes |
| loading the artwork | segment `0x014D0` | 1,216 bytes |
| the licence check | segment `0x0151C` | 2,544 bytes |

The licence check is small enough to read in an afternoon and is the most
self-contained thing left. Its strings are all recovered:

```
This disk appears to be damaged or some...
This is a MECC Membership product copy that has not been properly duplicated.
This is a MECC Demo product whose time...
PROGRAM IS NOT AVAILABLE
This product is licensed for use by a single computer at a time.
It is currently being used by someone else on the network.
The network version of this program may be licensed from MECC.
```

Four different refusals — a damaged disk, an improperly duplicated membership
copy, an expired demo, and a network seat already in use. That is a school
district's licensing model rendered as error messages, and it is a more
interesting piece of 1990 software history than the date check that was not
there.

## What has not been read

Most of the program: 137,712 bytes across ten segments. Specifically the trail
simulation, the store, the river crossings, the hunting screen, the illness
model and the event tables — the 66,592 bytes in segments `0x00000` and
`0x007B6`.

`prior-attempt/src/` contains a 17-unit Pascal reconstruction covering exactly
those topics. On the evidence of this document it should be read as a set of
hypotheses: the one claim from it that was tested had the right address and the
wrong meaning, which is roughly the outcome this repository expects from careful
reading that has never met an oracle.

---

*Next: [04 — porting](04-porting.md).*
