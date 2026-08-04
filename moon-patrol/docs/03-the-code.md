*Document three of six. See also: [01-the-game.md](01-the-game.md),
[02-architecture.md](02-architecture.md), the BRIEF, and the
[root CLAUDE.md](../../CLAUDE.md).*

# Moon Patrol -- the code

This document threads the 175 routines and 328 covered bracketed constants
in [`symbols.json`](../symbols.json) into a reading order. The order it uses
is the order the program takes when you turn it on: the two-stage entry,
the interrupt setup, the title screen, the menu, the wave scripts, the
per-frame step, the blitter, the sound engine, and the exit path. Every
routine mentioned here has an entry in `symbols.json` with the evidence for
its name; this document is the narrative that connects them.

The counts are what `annotate.py` currently prints. If they drift from what
this document says, the tool is right and this document needs updating.

## 1 · The two-stage entry

The first byte of the file is `8C C8` -- `mov ax, cs`. What follows is a
runtime-written far pointer and a jump through it:

```
mov ax, cs
add ax, strict word 0x20    ; +0x20 paragraphs = +512 bytes
mov word [far_jmp_target_segment], ax   ; [0x142] gets CS+0x20
xor ax, ax
mov word [far_jmp_target_offset], ax    ; [0x140] gets 0
jmp far [far_jmp_target_offset]         ; -> (CS+0x20):0000
```

`(CS+0x20):0000` is 512 bytes above CS in linear memory, which in .COM terms
is file offset 0x100. In the new segment that address is 0. The first byte
of the new segment is `E9 EB 01` -- a near jump to offset 0x1EE, which is
`startup` at file 0x2EE.

Comrec cannot follow this by static analysis because the pointer only
exists after the five stores run. Zaxxon and ParaTrooper use `retf` for
the same effect and comrec recognises it; Moon Patrol does not, so
`build.ps1` passes `--segment 0x100:0 --entry 0x100` to seed the walk
manually. See [02-architecture.md](02-architecture.md#the-address-bases).

## 2 · Startup and the segment registers

`startup` at file 0x2EE is the first routine that runs game code:

```
cli
mov al, 0
out 0xA0, al               ; NMI mask -- disable NMI on the 5150/5160
mov bx, cs
mov ss, bx                 ; SS = CS, like every .COM
sub bx, 0x100
add bx, 0x65D
mov ds, bx                 ; DS = CS + 0x55D paragraphs = file offset 0x56D0
mov word [ss:saved_ds], ds
mov word [old_es], es      ; ES snapshot for later ISR arms
mov sp, 0x1EE              ; stack top -- grows down from here
call walk_installed_isrs   ; install int 8, int 9 and the game's hooks
in al, 0xA0
mov al, 0x80
out 0xA0, al               ; NMI unmask
sti
in al, 0x61
and al, 0xFE
out 0x61, al               ; disable the PPI beep (bit 0)
jmp main_menu_entry
```

The four segments settle into the pattern the whole rest of the game uses:
CS and SS point at the code image, DS points at file offset 0x56D0 (517
bytes past the end of the code region), and ES gets set to `0xB800` (CGA
video) or `0` (BIOS data area) at the routines that need them, then restored
from `[old_es]`.

`walk_installed_isrs` at file 0x82E takes a table pointer in BP and walks
triples of `(offset, seg, offset-of-old-save)`. It is used both to install
the game's own vectors at startup and to restore the BIOS's vectors on exit
-- the direction is encoded in the table. The pointer table itself is at
file 0x11C: nine word entries plus the terminator, holding offsets like
0x03CB, 0x4E21, 0x4E36, 0x0425, 0x04A3, 0x4DC3, 0x03CF, 0x03D6...0x0405.
The last one, 0x0405, is the int 9 (keyboard) ISR entry.

## 3 · The keyboard ISR and its arms

The int 9 ISR at file 0x405 is:

```
push ax
push bx
push ds
mov ds, [ss:saved_ds]
in al, 0x60                ; scancode
mov ah, al
in al, 0x61                ; PPI
or al, 0x80
out 0x61, al               ; ACK the keyboard
and al, 0x7F
out 0x61, al               ; release
mov al, 0x20
out 0x20, al               ; EOI to PIC
sti
test ah, ah
...
```

That is the boilerplate a period keyboard handler shares. What follows is
the dispatch: `[0x101]` gets the scancode, and code branches out to arms
based on what it holds. Every arm ends with `jmp irq_epilogue` at file
0x4CB -- `pop ds; pop bx; pop ax; iret`.

The arms this document names in `symbols.json`:

* `reset_and_reboot` at 0x505 -- scancode 0x1D (LCtrl) or 0x38 (LAlt),
  chains through the BIOS int 9 at `[old_int9_far]` after setting text
  mode. Ctrl+Alt+Del as this game handles it.
* `key_repeat_arm` at 0x513 -- the hold-down poll for the sound and
  joystick-configure menus. Loops `peek_key` at file 0x53C for up to
  0xCCC ticks before releasing.

The ISR also updates `kbd_input` at DS:0x100, which is the byte the
polling routines (`peek_key`, `wait_key_up`, `clear_key`) read. Bit 7 is
the "key ready" flag the ISR sets and `clear_key` clears.

## 4 · Video setup and CRTC

`enter_cga_graphics` at file 0x573 is the whole video setup path:

```
mov byte [in_game_flag], 0
mov es, 0
and byte [es:bios_equipment_word], 0xCF
or  byte [es:bios_equipment_word], 0x20
mov ax, 4
int 0x10                   ; CGA mode 4 -- 320x200x4
mov [video_mode], al       ; = 4
mov ah, 0x0B
mov bh, 1
int 0x10                   ; palette 1 -- cyan/magenta/white
mov ah, 0x0B
mov bh, 0
int 0x10                   ; background 0
```

Falls through into `program_crtc_split` at file 0x85D, which writes to
port 0x3D4 (CRTC index) and 0x3D5 (data, addressed together as a word):

```
mov dx, 0x3D4
mov ax, 0xFF0E             ; register 0x0E (cursor position hi) = 0xFF (hide)
out dx, ax
mov ax, 0x0A03             ; register 0x03 (h-sync width)      = 0x0A
out dx, ax
dec ax
mov ah, [crtc_scroll_offset]
out dx, ax                 ; the split, driven by [0x8817]
mov dx, 0x3DA              ; CGA status -- poll for vertical retrace
...
```

`[crtc_scroll_offset]` at DS:0x8817 is what makes the fixed-position status
bar work: writing a non-zero value pushes the top of the visible field down
so the top scan lines can be treated as a separate zone. The scancode arms
at 0x4EB and 0x4F7 bump this cell within [0..0x2E].

The three video-clear routines (`clear_video_page_a` at 0x500D,
`_page_b` at 0x5044, `_page_c` at 0x509B) all walk a page-pointer table
through BP with `mov es, [bp + 0x53C9]; xor al; mov cx, 0x46; rep stosb`
-- three passes because the raster catches up between them.

## 5 · The menu

`show_menu_and_wait` at file 0x5A3 is the entry the game's [K]/[J]
options-sub-screen calls. It resets SP to 0x1EE, zeroes the in-game
latch and the frame counter at `ss:frame_ticks`, sets the video mode, and
falls into `menu_render` at 0x5B7. That prints the "Game Options" banner
from DS:0x81E0 (file offset 0xD8B0) via `print_string` at 0x88D, and
enters `menu_loop` at 0x5C0.

`menu_loop` prints the demo copy at DS:0x84B7 every 500 timer ticks, walks
a `(scancode, action-address)` pair table at DS:`scancode_action_table`
(0x88A9) looking for a match, and dispatches. Two scancodes have their own
sub-menus:

* `2D` = 'Z' -> `L_0060A` (player-select follow-up)
* `2E` = 'C' -> `scancode_dispatch` at 0x64B (course/keyboard remap)

`scancode_dispatch` walks the pair table with `lodsw / xchg bx, ax / inc bx
/ je end / lodsw / dec bx / je continue`, scans 0x53 bytes at DS:0x8856
(`scancode_map`) for the target scancode using `repne scasb`, and stores
the paired action byte at whatever offset the second word says.
`install_scancode` at 0x66D is the entry the user hits when accepting a
new binding: it prints the 'PRESS KEY' prompt at DS:0x84D9, reads a
scancode, and swaps the mirrored key-map cells.

`print_string` at file 0x88D is the whole text primitive:

```
mov ax, 0xB800
mov es, ax
lodsb
cmp al, 0xFF               ; terminator
jne body
ret
body:
mov ah, 0x50               ; bytes-per-row / 2
mul ah
add ax, strict word 4      ; +4 for the position header
...                        ; writes attribute + char to [es:ax]
```

Every menu banner, prompt, score line and end-of-game string goes through
this. The `@` characters visible with `strings` are actually a printed glyph
that the font renders as a small mark, not a terminator; the terminator is
0xFF that follows.

## 6 · The joystick

`read_joystick_or_cache` at file 0x789 is the input path every game step
uses. If `[input_mode]` is 1 (joystick), it calls `read_joystick_raw` at
0x7AB; otherwise it returns the cached values at
`[joy_cached_x_lo]/_hi/_y_lo/_hi` (0x881A/0x881C/0x881E/0x8820) from the
last real read.

`read_joystick_raw` is a period-standard PC gameport poll:

```
push bx
cli
mov byte [joy_reading_valid], 0xFF
mov ax, 0xFC00
mov bx, 0x7F00
mov cx, 0x100
mov dx, 0x201              ; PC gameport
xor si, si
xor di, di
out dx, al                 ; arm the RC one-shots
loop:
in al, dx
...                        ; time the four axis bits as they drop
```

The four axis bits time out at different rates depending on the joystick
position; the count-until-drop is the reading. `run_calibrate_or_read`
at 0x6BF is the calibration path -- three timed reads with the caller's
function pointer invoked between them, populating `joy_calib_min_x` at
0x8832 and its two siblings.

## 7 · The game-loop and the wave scripts

`main_menu_entry` at file 0x4ECB is what startup jumps to. It zeroes three
counters (0x231, 0x230, 0x22F), calls `enter_cga_graphics`, and renders the
title screen: `mov si, [title_sprite_ptr]; call draw_bitmap_stream;
mov si, [title_over_sprite_ptr]; ... call blit_sprite_xor` at (0x15, 0xB9).
The game reaches its top-level poll from here.

Once a round starts, `init_script_pointers` at file 0x3D89 seeds
`script_ptr_73` = 0xC46 and `script_ptr_75` = 0xC93 -- the two cursors
that walk the wave-setup and per-frame scripts respectively. Both scripts
live in the data tail's script-table region at file 0xC4C0..0xD380.

The interpreter itself is `script_run` at file 0x22EE:

```
pop word [script_pc_lo]    ; the return address IS the script PC
dec word [script_pc_lo]
mov byte [script_arg_cl], cl
mov byte [script_arg_bl], bl
loop:
inc byte [script_pc_lo]
je L_02307                 ; high-byte wrap
jmp L_0230B
...
L_0230B (script_fetch):
mov cl, 0
mov si, word [script_pc_lo]
mov al, byte [cs:si]       ; opcodes are in the code region
or al, 0x80
```

Every caller of this is `call script_run` followed by inline opcode bytes;
the interpreter reads them out of the caller's code stream and never
returns to the byte after the call. 25 of the 130 call sites in the
listing target `script_run`. It is the dominant control-flow shape of the
whole game.

## 8 · The per-frame step

The per-frame update walks the four-slot object arrays through a family of
iterators named `for_each_slot_XXX` in `symbols.json`. Each iterator has
the same shape: `mov cl, 3` (four slots, counting down), then a body that
loads `[si + BASE]` where BASE is the array's head address. Every one of
those BASE values is either in `globals` (if it also gets read as a bare
`[X]` somewhere) or in `_displacements` (if it only ever appears with an
index register).

The arrays this document identifies:

| base | walked by | probable class |
|---|---|---|
| DS:0x82B | for_each_slot_82B_step and three siblings | one object class -- draw/undraw/step/hit |
| DS:0x867 | for_each_slot_867 and for_each_slot_867_bx | second class |
| DS:0x8BE | for_each_slot_8BE_zeroing and four siblings | third class |
| DS:0x8F3 | for_each_slot_8F3_zero and three siblings | fourth class |
| DS:0x90A | for_each_slot_90A_hit / _step / _alt | fifth class |
| DS:0xF0A | loop_add_al_var6 | sixth |

The four-per-array shape is why the game has three UFOs, three enemy cars,
three rockets and three of everything else -- one array per class, four
slots per array with slot 3 as a sentinel.

The BCD-add primitive at `add_bcd_score` (file 0x2249) is the scoreboard:

```
push ax
mov al, [round_owner_player]
mov [screen_offset_arg], al
pop ax
push ax
mov al, cl
push ax
mov al, bl
add al, [score_ones_digit]
daa
mov [score_ones_digit], al
pop ax
...
```

The eight BCD score digits live in the zero-page cells [0x7A..0x81]. `daa`
after `add` keeps each digit in 0..99 without any branching -- the reason
this shape appears in every game of the era.

## 9 · The blit family and the scanline table

Every draw begins with the same three instructions:

```
mov bp, scanline_ptr_table  ; = 0x53C9 in DS
add bp, dx
add bp, dx                  ; word index dx into the table
mov bx, cx
sar bx, 1
sar bx, 1                   ; cx / 4 -- the byte inside the row
```

The 200-word table at DS:0x53C9 gives the CGA video-memory offset of each
screen row. Neither the row offset nor the pixel-to-byte mapping is
computed from arithmetic: both are lookups. This is why the shape appears
in five variants -- `draw_sprite_A`, `erase_sprite_A`, `draw_sprite_B`,
`erase_sprite_B`, `draw_sprite_A_alt_scale` (file 0x5115, 0x50F6, 0x50D7,
0x5134, 0x5153) -- that differ only in (a) which sprite atlas
(0x1210, 0x1242) they index and (b) which blit body (`blit_sprite_xor` at
0x53F9 or `blit_sprite_copy` at 0x5432) they call. Two atlases times two
blit modes plus one alt-scale variant equals five entries.

`draw_sprite_C` at file 0x50BA is the third atlas (DS:0x1268), reached with
`and ax, 0x3F` before indexing -- so this atlas has 64 slots addressable
directly.

`render_horizon_stripe` at file 0x5172 is what draws the ground line each
frame: `mov bl, [terrain_cursor]; mov cl, 0x8D; mov dx, 0xCF3; mov di,
0xFFFF` and walks 0x8D cells (141, the visible field width). `[0x43]` is
the write pointer that `advance_scroll` at 0x20DB wraps at 0x8D -- the
horizon is a 141-cell circular buffer.

`clear_screen_and_draw` at file 0x4FC6 is the whole-screen wipe protected
by a semaphore:

```
inc byte [clear_semaphore]
je skip                    ; someone else is already clearing
dec byte [clear_semaphore]
mov es, 0xB800
xor di, di
mov cx, 0x4000
rep stosb                  ; 16 KB -- the whole CGA image
mov cx, 0
mov dx, 0
mov si, [clear_screen_sprite_ptr]
call blit_sprite_xor
```

Used for full-screen transitions between wave phases.

## 10 · Sound

`speaker_toggle` at file 0x4F8B is the whole primitive:

```
lahf
in al, 0x61
xor al, [speaker_xor_mask]  ; usually 0x02 -- the speaker bit
and al, [sound_gate_mask]   ; 0xFF when sound-on; a mask that drops the XOR when muted
out 0x61, al
sahf
ret
```

Two sound engines above it -- 0x5115 and 0x5134 -- queue notes from the
per-voice sound-channel state block at DS:0x200..0x215. Each of those
22 cells (`sound_ch_state_0` through `sound_ch_state_15` in `symbols.json`)
is one field of the running note state.

The feeders are `queue_sound_pair_L115` and `queue_sound_pair_L134` at
files 0xACA and 0xA82. Each reads a `(note, duration)` pair from the
zero-page cells `voice_a_note` at [0x57] / `voice_b_note` at [0x59] and
enqueues it. The `[sound_enable]` byte at DS:0x216 -- toggled by the
`[S]` menu key -- is OR'd into every queued mask so a disabled sound
leaves the notes untouched but never reaches the port.

`play_sound_effect` at file 0x4D7D is the shared body of three
trampolines at 0x4D70/0x4D75/0x4D7A, each of which loads SI with a data
pointer at DS:0xB75, 0xBBC or 0xDA7 respectively. Which of the three
plays the alarm, the crash and the celebration is not settled without
listening to the game.

## 11 · The exit path

`reset_and_reboot` at file 0x505 is the entry Ctrl+Alt uses. It sets
`[es:bios_equipment_word]` bits 4-5 (colour text), runs `int 10h AX=3`
(80x25 colour text mode), and far-jumps to the saved BIOS int 9 handler
at `[old_int9_far]` (0x8812). That chain gives control back to the ROM,
whose reset path takes it from there.

The game has no `int 21h AH=4C` exit -- Ctrl+Alt is the only clean way
out. Rebooting is the game's own opinion on how to leave a game.

## What is genuinely open

Nothing that further static reading closes. See
[02-architecture.md](02-architecture.md#what-is-genuinely-open) for the
three items that need observing the running game to settle -- the mapping
of the three sound-effect trampolines to alarm/crash/celebration, the
finer semantics of the state-toggle trio at 0xE2B/E4B/E6B, and the exact
purpose of the 24 pointer slots in atlas C past the `& 0x3F` mask.
