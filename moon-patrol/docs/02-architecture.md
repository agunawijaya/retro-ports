*Document two of six. See also: [01-the-game.md](01-the-game.md),
[03-the-code.md](03-the-code.md) (not yet written), the BRIEF, and the
[root CLAUDE.md](../../CLAUDE.md).*

# Moon Patrol -- how the DOS program was built

This document is about the **original** binary, not the port. Every fact here
is derivable from the file and the reading in `symbols.json` -- read the
symbols alongside this and each named routine will land on the paragraph that
mentions it.

## It is not 8086 code that a person wrote

The single most important thing about this binary is that a program made it,
not a programmer. `comrec.py`'s own detector spotted the tell:

    281 `cmc` instructions, 99% of them straight after a cmp/sub,
    covering 75% of all compares -- a carry-convention adapter,
    not hand-written x86

The 6502's `CMP` sets carry when A >= M (carry means *no borrow*). The
8086's `cmp` sets carry when the subtraction borrowed, the opposite sense.
A translator that wants the 6502's `BCS` and `BCC` to keep meaning what they
meant emits `cmp; cmc` after every comparison, so the flag has the sense the
next branch expects. No human writes that twice, let alone 281 times. The
other games in this collection that were translated from a 6502 (Hard Hat
Mack, see its own `CLAUDE.md`) show exactly the same fingerprint; the
hand-written games (ParaTrooper, Zaxxon) show zero.

The consequence for reading the code is that **8086 register conventions do
not apply**. AL is the 6502's accumulator; BL is X; CL is Y; every
byte moves through AL because the 6502 had one 8-bit accumulator and its
program was written that way. There are no `push`/`pop` on registers other
than the ones the ISR uses because the 6502's stack is one page and its
authors kept state in fixed memory instead. Sixteen-bit arithmetic is done
byte-by-byte with `adc`, even where the 8086 could do it in a single
instruction and never does. See
[`knowledge/14-translated-binaries.md`](../../DOS-Decompiler/knowledge/14-translated-binaries.md)
for the full checklist.

## The address bases

The file is 58,306 bytes and has **two address bases**. This is the trap
that landed the previous reading at 0.5% decoded.

    ORG 0x0100     file 0x0000..0x0100    entry stub, addressed at load position
    ORG 0x0000     file 0x0100..0xE302    the game, addressed from 0 in a new segment

The transition is the entry stub at file 0. Rather than fall straight into
the game, it writes a run-time far pointer and jumps through it:

    mov ax, cs
    add ax, strict word 0x20    ; +512 bytes
    mov word [0x142], ax        ; segment field of the pointer
    xor ax, ax
    mov word [0x140], ax        ; offset field of the pointer
    jmp far [0x140]             ; -> (CS+0x20):0000

`(CS+0x20):0000` is 512 bytes above the initial CS, which in .COM terms is
file offset 0x100. In the new segment that address is 0. So every near
jump, near call and bracketed constant in the code from file 0x100 onward is
in the base-0 coordinate system.

The first byte of the new segment is another jump -- `e9 eb 01` = `jmp 0x1EE`
-- so the real init routine lives at file 0x2EE (`startup` in
`symbols.json`), and the 494 bytes between file 0x100 and file 0x2EE are
mostly zero fill with a small pointer table at file 0x11C.

Zaxxon and ParaTrooper have the same shape but with a `retf` in place of the
run-time-written pointer, and comrec detects that automatically. Moon Patrol
does not, so `build.ps1` passes `--segment 0x100:0 --entry 0x100` explicitly.

## The four segment registers

Once startup runs, the segment registers point at four different things:

| register | pointed at | offset from new_CS |
|---|---|---|
| CS | code segment (file 0x100 = CS:0) | 0 |
| SS | code segment (`mov ss, bx` where bx = cs) | 0 |
| DS | data | +0x55D paragraphs = +0x55D0 bytes |
| ES | usually 0xB800 (CGA video) or 0 (BIOS data) | -- |

So `DS:0x0000` is at file 0x56D0 -- 517 bytes past the end of the code
region at file 0x54C9, well inside the data tail. A bare `[X]` in the code
addresses file `X + 0x56D0` while any of the game's file offsets or code
addresses are `cs:X` or fetched with `[cs:X]`. Two different address spaces,
one notation. Missing this is the same mistake the Zaxxon `CLAUDE.md` warns
against; both games translated from the same lineage, both trip on it.

The `mov word [ss:0x5C], ds` at file 0x2F5 exists because ES gets set to
`0xB800` and `0` at various points; saving DS to SS-relative memory lets any
ISR restore it after DOS or BIOS calls.

## The regions of the file

    file 0x0000..0x0011   17    entry stub (13 bytes code + 4-byte pinned far jmp)
    file 0x0011..0x00FF   238   zero fill
    file 0x00FF..0x0100   1     bridge byte
    file 0x0100..0x0103   3     near jmp e9 eb 01 into the new segment
    file 0x0103..0x011C   25    zero fill
    file 0x011C..0x012E   18    9-word pointer table walk_installed_isrs uses
    file 0x012E..0x02EE   448   BSS zone (the far-jmp target words at 0x140/0x142 land in here)
    file 0x02EE..0x54C9   20955 code region: 8,578 instructions, 88.3% recovered
    file 0x54C9..0x56D0   519   pre-DS transition
    file 0x56D0..0x58D0   512   DS:0x0000..0x01FF -- the game's zero page equivalent
    file 0x58D0..0x59D0   256   DS:0x0200..0x02FF -- sound_enable, active_player, ammo/round counters
    file 0x59D0..0x68E0   3856  DS:0x0300..0x120F -- object-slot arrays
    file 0x68E0..0x6912   50    DS:0x1210..0x1241 -- sprite_atlas_A pointer table
    file 0x6912..0x6938   38    DS:0x1242..0x1267 -- sprite_atlas_B pointer table
    file 0x6938..0x6A98   352   DS:0x1268..0x13C7 -- sprite_atlas_C pointer table
    file 0x6A98..0x7A99   4097  DS:0x13C8..0x23C8 -- sprite bitmaps
    file 0x7A99..0xAA99   12288 DS:0x23C9..0x53C8 -- more sprite/tile bitmaps + terrain
    file 0xAA99..0xAC29   400   DS:0x53C9..0x5558 -- 200-entry scanline table
    file 0xAC29..0xAC3F   22    DS:0x5559..0x556E -- cs-referenced constants
    file 0xAC3F..0xC4C0   6273  DS:0x556F..0x6DEF -- sound engine + music sequences
    file 0xC4C0..0xD380   3776  DS:0x6DF0..0x7CAF -- script tables + wave scripts
    file 0xD380..0xD949   1481  DS:0x7CB0..0x8278 -- keyboard/joystick maps
    file 0xD949..0xDAB6   365   DS:0x8279..0x83E5 -- menu strings
    file 0xDAB6..0xE302   2316  DS:0x83E6..0x8CF1 -- end-of-round strings + HUD text

Full evidence for each span is in `symbols.json` under `_data_spans`.

## The scanline table

Every blit begins with the same two instructions:

    mov bp, 0x53C9
    add bp, dx / add bp, dx    ; multiply row by 2, add to table base

The 200-entry word table at DS:0x53C9 gives the CGA video-memory offset of
each screen row. The blit routines (`blit_sprite_xor` at file 0x53F9 and
`blit_sprite_copy` at file 0x5432) do not compute the row offset from row
number and stride -- they look it up.

This is a 6502-translation artefact. The Apple II's hi-res screen is
interleaved in a way that makes arithmetic on row addresses useless, so
Apple II programs all carry a scanline table. CGA is interleaved too, less
badly, and the translated table works unchanged. It is also why the same
sprite-draw shape appears in five variants (`draw_sprite_A`, `erase_sprite_A`,
`draw_sprite_B`, `erase_sprite_B`, `draw_sprite_A_alt_scale`) with only the
sprite atlas pointer table (`0x1210`, `0x1242`) and the blit target
(`blit_sprite_xor`, `blit_sprite_copy`) changing.

## The script interpreter

The dominant control-flow shape of the code is not `call routine; ret` but
`call script_run; db opcodes...`. `script_run` at file 0x22EE pops its own
return address into the two-byte cell at `[5]/[6]` and walks the caller's
inline byte stream from there. This is why 25 of the 130 call sites in the
listing target `script_run` and never return to the byte after the call.

The two script cursors `[0x73]` and `[0x75]` are set by `init_script_pointers`
at file 0x3D89 to point at the wave-setup script at DS:0xC46 and the
per-frame script at DS:0xC93. Both scripts live in the data tail's script
table region at file 0xC4C0..0xD380.

## Sound

Sound is a one-bit bit-bang through port 0x61. `speaker_toggle` at file
0x4F8B is the whole primitive:

    lahf                        ; save the caller's flags
    in al, 0x61
    xor al, byte [0x8852]       ; the XOR mask, usually 0x02 -- the speaker bit
    and al, byte [0x896E]       ; the sound-on gate, 0xFF or a mask that drops the XOR
    out 0x61, al
    sahf                        ; restore flags

Two sound engines above it -- `L_05115` and `L_05134` -- queue notes from
per-voice tables at DS:0x556F onward. `queue_sound_pair_L115` and
`queue_sound_pair_L134` are the two most common feeders; each reads a
`(note, duration)` pair from the zero-page cells and enqueues it. The
`[S]` menu key toggles `sound_enable` at DS:0x216, which the queue routines
OR into their mask so a disabled sound leaves the notes untouched but never
reaches the port.

There are three sound-effect trampolines (`sound_effect_B75`, `_BBC`, `_DA7`)
at file 0x4D70/0x4D75/0x4D7A, each of which loads SI with a data pointer and
falls into `play_sound_effect` at file 0x4D7D. Those three are the alarm,
the crash and the celebration -- or thereabouts; the actual mapping is not
settled without running the game and listening.

## Interrupts and I/O

The keyboard is handled entirely in the game's own int 9 ISR at file 0x321,
installed by `walk_installed_isrs` (file 0x82E) from a table set up in the
BSS zone at file 0x140-0x145 area. The ISR reads scancodes from port 0x60,
writes them into `kbd_input` at DS:0x100 with bit 7 as the ready flag, and
falls through the `irq_epilogue` at file 0x4CB (`pop ds; pop bx; pop ax;
iret`).

Ctrl+Alt is a special case. `reset_and_reboot` at file 0x505 checks
scancode 0x1D (LCtrl) or 0x38 (LAlt), sets the BIOS equipment word to
text mode, calls `int 10h AX=3` (80x25 colour text), and far-jumps to the
saved BIOS int 9 handler at `[0x8812]` -- so the ROM's own reset path runs
next. That is Ctrl+Alt+Del the way this game exits to DOS.

The joystick is polled through port 0x201 in `read_joystick_raw` at file
0x7AB: cli, arm the RC one-shots by writing to the port, then a 256-iteration
loop reads the port and times each of the four axis bits as they drop. The
calibration values live at DS:0x8832/0x8836/0x883A and are set once by
`run_calibrate_or_read` at file 0x6BF.

The CRTC at ports 0x3D4/0x3D5 is programmed once at startup by
`program_crtc_split` at file 0x85D and revisited each time the display split
is redrawn -- it hides the cursor (register 0x0E = 0xFF) and sets the row
offset from `[0x8817]` so the status bar stays on top while the game field
scrolls below.

## What is genuinely open

Nothing that reading the file can settle without running the game and
observing.

- **Which of the three sound-effect trampolines is which.** The data
  pointers (0xB75, 0xBBC, 0xDA7) are named after their SI values rather than
  their meanings, because a mislabel here would carry through into any port.
- **The finer state-toggle semantics** on the cluster at DS:0x00E2B/0x00E4B/
  0x00E6B. All three read the same state byte `buggy_ax_state` and write
  different values (0xFC, 4, 0) into `buggy_vx`. Named as "accelerate left",
  "accelerate right", "idle" but the mapping between those and the buggy's
  actual on-screen response wants observation to nail down.
- **The exact contents of the 88 pointer entries in `sprite_atlas_C_ptrs`**
  reached through the `& 0x3F` mask (only 64 addressable, the other 24
  either pad or an alternate index).

Everything else in `symbols.json` carries the evidence for itself in its
description. `annotate.py` checks and applies all of it on every build; the
one heading message the audit prints ("`0x00011` had nowhere to go") is
informational -- 0x0011 is inside a run comrec decoded as instructions
(`add byte [bx+si], al` on zero bytes), and the span is right; the message
just notes that the heading cannot be placed as a label.
