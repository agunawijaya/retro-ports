# Alley Cat — the code

*Document three of six. See [01-the-game.md](01-the-game.md) for what the game
is, [02-architecture.md](02-architecture.md) for how the program is laid out,
and [04-porting.md](04-porting.md) for where to take it next. For the browser
port instead, see [06-web-code.md](06-web-code.md).*

Eight routines, walked end to end. Every listing is copied from
`recovered/alley-cat.asm` — the file that reassembles to a byte-identical
copy of the original — with comments added and nothing else changed.
Addresses are given both ways: image offset first, then any DS- or CS-relative
form that appears in the code.

Nothing here is a guess about what the machine does. Where the *purpose* of
something is inferred rather than proven, it says so.

---

## 1. The entry

**Image `0x7230`, forty-nine bytes.**

This is where CPU execution starts — the MZ header says `CS:IP = 0723:0000`,
which lands at image offset `0x7230`. The first thing it does is establish two
things that everything else depends on: a far pointer at the top of the stack,
and the data segment.

```nasm
L_07230:                        ; entry
    push ds                     ; DS at boot points at the PSP
    mov ax, 0
    push ax                     ; two pushes make a far pointer PSP:0000
    call L_0CE90                ; startup_video_probe
    mov ax, 0x10
    mov ds, ax                  ; DS := 0x10, our data segment
    call L_085DA                ; read_bios_machine_id
    mov byte [0x690], 4         ; startup_mode_value tentative = 4
    mov word [0x6df8], 0        ; attract_history_word cleared
    mov byte [0x69b], 0         ; joystick_calibration_done clear
    call L_08649                ; install_keyboard_handler
    call L_08618                ; init_keyboard_state
    ...
```

**What the machine does.** `push ds / push 0` writes a two-word structure to
the stack — a *far pointer* to segment `DS`, offset `0`. `call` runs
`startup_video_probe` and returns here. Then `mov ax, 0x10 / mov ds, ax` sets
DS to the data segment, and everything after uses DS-relative addressing.

**What the programmer was thinking.** *When the program dies it needs to hand
control back to DOS.* On program load, DS points at the PSP (the Program
Segment Prefix DOS builds when it loads a `.COM`-style program), and byte 0 of
the PSP contains an `INT 20h` instruction — the DOS "terminate" call.
`push ds / push 0` puts that address on the stack, and any later `retf` will
"return" straight to DOS-terminate. This is the same 1980s trick as
ParaTrooper's entry stub, in reverse: they use `retf` to *reach* their real
entry, this one uses `retf` to *leave*.

The next block (not shown) sets CGA mode 4, applies the palette, seeds the
PRNG from the PIT counter, and initialises sound state. Then execution falls
through to `attract_loop_start` — the outer loop.

---

## 2. The CGA detection dance

**Image `0x0CE90`, sixty-two bytes.**

`startup_video_probe` runs before anything else. It has to decide the machine
has usable colour graphics, and refuse if not.

```nasm
L_0CE90:                        ; startup_video_probe
    int 0x11                    ; BIOS equipment word into AX
    and al, 0x30
    cmp al, 0x30                ; bits 4-5 == 11 => BIOS says MDA
    jne L_0CEC5                 ; if not MDA, return silently
    mov ax, 0xb800
    mov ds, ax
    mov ax, 0x55aa
    mov word [0], ax            ; write 0x55AA to B800:0000
    mov ax, word [0]
    cmp ax, 0x55aa              ; read it back
    jne L_0CEC6                 ; if the write did not stick, no CGA
    mov si, 0x60f0
    call L_0CECE                ; print "Please turn on the color display."
    mov ax, 0x40
    mov ds, ax
    mov ax, word [0x10]
    and al, 0xcf
    or al, 0x10                 ; patch BIOS mode nibble to CGA-40x25
    mov word [0x10], ax
    mov ax, 4
    int 0x10                    ; set CGA mode 4 (320x200x4)
L_0CEC5:
    ret
L_0CEC6:
    mov si, 0x6112
    call L_0CECE                ; print "This program requires..."
L_0CECC:
    jmp L_0CECC                 ; halt forever
```

**What the machine does.** `INT 11h` returns a 16-bit equipment word;
bits 4–5 encode the video mode the BIOS thinks is initialised. `11` (=`0x30`
in AL) means MDA — a monochrome adapter. On modern CGA-only machines the
routine returns early and the main entry sets mode 4 anyway. On machines
whose BIOS defaults to MDA, it tries the CGA test: write `0x55AA` to the CGA
framebuffer segment, read it back, and if the writes stuck the CGA exists
even though the BIOS did not report it. If they didn't, print an error and
enter an infinite loop (`jmp $` at `L_0CECC`).

**What the programmer was thinking.** *A user with a Hercules card wired in
alongside a CGA card gets an MDA reading from the BIOS but has both
monitors.* The check switches the machine over to CGA in that case, and
prints "Please turn on the color display" to remind the user to look at the
right screen. In every other case (CGA already active, EGA, VGA) the routine
does nothing and lets the main entry's `INT 10h AH=0 AL=4` do the mode set.

The failure branch is `jmp $` — a hard hang. There is no path back to DOS
from a no-CGA machine.

---

## 3. The keyboard ISR

**Image `0x086E3`, seventy-two bytes.**

Alley Cat does not use the BIOS keyboard buffer. It installs its own
`INT 09h` handler and maintains a 22-slot scancode/state table pair:

```nasm
L_086E3:                        ; keyboard_isr (installed at CS:0x14B3)
    push ax
    push es
    push di
    push cx
    mov di, 0x10
    mov es, di                  ; ES := 0x10 (the data segment)
    in al, 0x60                 ; read scancode from the keyboard port
    mov ah, al                  ; save the make/break bit in AH
    and al, 0x7f                ; strip it from AL, leaving the pure scancode
    test ah, 0x80
    jne L_086FC                 ; if the top bit was set, it was a release
    inc word [es:0x693]         ; on press, increment key_tick_counter
L_086FC:
    mov di, 0x6a1               ; DI := key_scancode_table
    mov cx, 0x16                ; CX := 22 (the number of tracked keys)
    cld
    repne scasb                 ; scan for our AL in the 22-byte table
    jne L_08713                 ; not one of ours — ignore
    sub di, 0x6a2               ; convert DI to the slot index
    and ah, 0x80
    mov byte [es:di + 0x6b7], ah  ; write make/break bit into state table
L_08713:
    in al, 0x61                 ; pulse port 0x61 bit 7 to ack the keyboard
    mov ah, al
    or al, 0x80
    out 0x61, al
    mov al, ah
    out 0x61, al
    call L_087A2                ; a small tail routine (unread)
    pop cx
    pop di
    pop es
    mov al, 0x20
    out 0x20, al                ; EOI to the 8259 PIC
    pop ax
    iret
```

**What the machine does.** The keyboard is on IRQ 1, which maps to `INT 09h`.
When a key changes state (pressed or released), the CPU jumps here.
Port `0x60` gives one byte: the low 7 bits are the scancode, the top bit is
1-if-release. `repne scasb` compares AL to each byte at ES:DI, incrementing DI
each time, stopping when it matches or CX runs out. If it matches, the byte's
index in the table becomes the index into the parallel state table 22 bytes
later at `0x6B7`. Port `0x61` bit 7 must be pulsed to tell the keyboard the
byte was received. Port `0x20` bit 0x20 is End-Of-Interrupt to the interrupt
controller — without it the CPU never accepts another IRQ 1.

**What the programmer was thinking.** *I need a fixed table of what the
player pressed, not a queue of keystrokes.* The BIOS keyboard buffer is
useless for a game — it loses state on release, drops keys, and doesn't tell
you what is currently held down. Two parallel arrays (scancodes + states)
solve every one of those problems for the twenty-two keys the game cares
about. The main loop just polls `key_state_table[i]` bit 7 to know whether
key `i` is currently down.

The PCjr has a **separate handler** (`keyboard_isr_pcjr` at image `0x0872B`)
because the PCjr's keyboard hardware sends command bytes 0xFF and 0x55
alongside scancodes, and its shift-state byte at BIOS 40:0012 needs
cross-checking. The two handlers share the scancode/state tables but do the
work of reading and validating differently.

---

## 4. The CGA blitter

**Image `0x9FCD`, forty-one bytes.**

The interleave trick. Every sprite and every full-screen paint goes through
this routine or one of its four siblings.

```nasm
L_09FCD:                        ; blit_cga_interleaved
    cld
    mov byte [0x2ae0], cl       ; cache row-word-count (width) in blit_row_bytes
    mov byte [0x2ae2], ch       ; cache row count (height) in blit_row_count
    sub ch, ch                  ; clear CX high half; CL still has the width
L_09FD8:
    mov cl, byte [0x2ae0]       ; reload width for this row
    rep movsw                   ; copy CL words from DS:SI to ES:DI
    sub di, word [0x2ae0]       ; step DI back to the start of the row
    sub di, word [0x2ae0]       ; twice, because we copied words not bytes
    xor di, 0x2000              ; flip to the other CGA bank
    test di, 0x2000
    jne L_09FF3                 ; landed in the odd bank? no scan-line advance
    add di, 0x50                ; back in the even bank? +80 bytes = next row-pair
L_09FF3:
    dec byte [0x2ae2]           ; one row-pair done
    jne L_09FD8
    ret
```

**What the machine does.** `rep movsw` is the workhorse: copy CX words from
`DS:SI` to `ES:DI`, incrementing both pointers as it goes. That draws one
row. Then the pointer needs to move to the *next* scan line — but CGA doesn't
have a next scan line in the usual sense. Even lines live at offsets
`0x0000..0x1FFF`, odd lines at `0x2000..0x3FFF`. `xor di, 0x2000` flips
between the two banks. After drawing an even line and flipping, DI is in the
odd bank at the same column — perfect, no advance needed. After drawing an
odd line and flipping back, DI is in the even bank at the same column but
one *row-pair* behind — add 80 bytes to advance.

**What the programmer was thinking.** *The CGA framebuffer is not linear and
I need to draw a rectangle.* The XOR-flip idiom is the shortest possible
handler for the interleave. Alternatives — an if/else on the current bank, a
scan-line lookup table — are all more bytes and slower. This handler is 21
instructions and touches the framebuffer at hardware speed.

The four siblings extend the same idiom:

- `blit_cga_es_prefixed` (image `0x9FFA`) is identical in operation but
  accesses the width/height cache through the ES segment prefix instead of
  DS. It exists because `snapshot_video_rect` sets DS to the video segment
  to *read* from video, and needs the cache still accessible.
- `sprite_and_mask_blit` (image `0x9F65`) reads the current video byte,
  saves it to a scratch buffer at DS:BP, then writes `(sprite AND video)`
  back. Half of a mask+colour draw.
- `sprite_colored_blit_with_save` (image `0x9EFC`) is the coloured half —
  per-pixel bit manipulation with masks 0x30C0 and 0xFF0 to combine
  2-bpp CGA pixels, saving originals to DS:BP.
- `blit_sprite_list` (image `0x9D54`) is a tiny bytecode interpreter that
  reads pairs of `(source, destination_offset)` from a table, blitting each
  entry, terminated by `0xFFFF`. Used to compose multi-part sprites.

---

## 5. Save, draw, restore — the sprite trio

Three routines work together whenever the cat is drawn on top of a static
background. They share a scratch buffer at `DS:0x5FA`, a set of sprite
parameters at `DS:0x55D..0x565`, and a `sprite_state_flag` at `DS:0x583` for
sequencing.

**`snapshot_video_rect`** — image `0x8354` — captures the video area behind
where the sprite is *about* to be drawn, so it can be restored later:

```nasm
L_08354:                        ; snapshot_video_rect
    mov ax, 0x10
    mov es, ax                  ; ES := data (destination)
    mov di, 0x5fa               ; DI := scratch buffer offset
    push ds
    mov si, word [0x55f]        ; SI := sprite_dst_offset (source in video)
    mov ax, 0xb800
    mov ds, ax                  ; DS := video (source)
    mov cx, word [es:0x561]     ; count from sprite_width_cache
    call L_09FFA                ; blit_cga_es_prefixed
    pop ds
    mov byte [0x583], 0         ; sprite_state_flag := 0
    ret
```

**`sprite_draw_saving_bg`** — image `0x8375` — draws the sprite and captures
the underlying pixels in one pass:

```nasm
L_08375:                        ; sprite_draw_saving_bg
    mov ax, 0xb800
    mov es, ax                  ; ES := video (destination)
    mov di, word [0x55f]        ; DI := sprite_dst_offset
    mov bp, 0x5fa               ; BP := scratch buffer (for the pixels-underneath save)
    mov si, word [0x55d]        ; SI := sprite_src_offset
    mov cx, word [0x565]        ; CX := sprite_dim_packed
    mov word [0x561], cx        ; cache the width for later restore
    mov byte [0x583], 0
    call L_09F65                ; sprite_and_mask_blit
    ret
```

**`restore_video_from_snapshot`** — image `0x8413` — puts the saved
background back, erasing the sprite:

```nasm
L_08413:                        ; restore_video_from_snapshot
    mov ax, 0xb800
    mov es, ax
    mov di, word [0x55f]
    mov si, 0x5fa
    mov cx, word [0x561]        ; read the width cached by the draw
    call L_09FCD                ; blit_cga_interleaved
    ret
```

**What the programmer was thinking.** *A sprite drawn over a busy background
must be erasable without redrawing the whole scene.* The classic solution is
what these three do: snapshot the pixels the sprite will cover, draw the
sprite, and when the sprite moves, put the snapshot back before drawing at
the new position. Every game of the era does this in one form or another —
Alley Cat's version is unusual only in factoring the save into its own routine
(most games fold it into the draw). The reason it's factored: sometimes the
game snapshots without immediately drawing (screen transitions), and sometimes
it draws without snapshotting (over blank areas).

---

## 6. PRNG and its seed

**Image `0xA02D`, twenty-one bytes.**

The linear-feedback shift register that drives every random pick in the game.

```nasm
L_0A02D:                        ; prng_step
    mov dx, word [0x2ae5]       ; DX := prng_state
    xor dl, dh                  ; mix the halves
    shr dl, 1
    shr dl, 1                   ; the mixed bit is now in the carry flag
    rcr word [prng_state], 1    ; rotate the state through carry
    mov dx, word [0x2ae5]       ; reload for the caller
    ret
```

**What the machine does.** `rcr` — rotate through carry, right — takes the
current carry flag as the new high bit and puts the current low bit into
carry. So after this: the new bit 15 of `prng_state` is whatever the `xor
dl, dh / shr` produced (a mixed bit from the current state), and every other
bit has shifted right by one. Classic LFSR.

**What the programmer was thinking.** *I need a stream of random 16-bit
values, cheaply.* This is six instructions and 21 bytes. It has a period of
somewhere near 65,535 (a full-cycle 16-bit LFSR does exactly that) but the
program doesn't rely on that — it uses the top or bottom bits for one-off
decisions, and reseeds implicitly by continually stepping.

The **seed** comes from the PIT counter, which is a good randomness source at
boot because the counter has been running since the machine was powered on
and its exact value is essentially unpredictable:

```nasm
L_0A040:                        ; seed_random_from_pit
    mov al, 0
    out 0x43, al                ; latch PIT channel 0
    nop
    nop
    in al, 0x40                 ; read low byte
    mov ah, al
    nop
    in al, 0x40                 ; read high byte
    cmp ax, 0                   ; unlikely, but check anyway
    jne L_0A055
    mov ax, 0xfa59              ; if it was exactly zero, use a fallback
L_0A055:
    mov word [0x2ae5], ax       ; seed prng_state
    ret
```

The `0xfa59` fallback is there because a zero LFSR state never moves — an
all-zeros register XORed and shifted always produces zeros. That branch runs
approximately never (the odds of the PIT counter reading exactly zero
between two `in` instructions are about 1 in 65,536), but leaving it out
would be the bug that eventually hits somebody.

---

## 7. The phase dispatch

**Image `0x7468`, twenty-one bytes.**

Every frame, control returns here to pick which of the seven rooms is running.

```nasm
L_07468:                        ; dispatch_current_phase
    mov word [6], 0             ; clear previous_phase
    mov bx, word [4]            ; BX := current_phase
    cmp bx, 7
    jbe L_07479
    sub bx, bx                  ; clamp out-of-range to 0
L_07479:
    shl bx, 1                   ; word index
    jmp word [cs:bx + 0x250]    ; the dispatch — jump to phase_N_handler
```

**What the machine does.** Read the phase number, clamp it to 0..7, use it as
an index into a 16-byte table at CS-relative offset `0x250` (which is image
offset `0x7480`), and jump to the address stored there. The table:

```
0x7480:  E2 03  E2 03  59 04  94 03  49 03  FE 02  AA 02  60 02
         phase0  phase1 phase2 phase3 phase4 phase5 phase6 phase7
         0x03E2 0x03E2 0x0459 0x0394 0x0349 0x02FE 0x02AA 0x0260
```

Each value is a CS-relative code offset. Add `cs_base = 0x7230` to convert
to image offset: phase 7's `0x0260 + 0x7230 = 0x7490`, phase 6's
`0x02AA + 0x7230 = 0x74DA`, and so on.

**What the programmer was thinking.** *I have seven or eight game states and
need to switch between them cheaply.* A jump table is the standard answer:
one indexed load, one indirect jump, done. What makes this one interesting is
that phase 0 and phase 1 both point at the same address — the game boots into
phase 0, which immediately asserts `mov word [current_phase], 1` and becomes
phase 1. Effectively phase 0 has no body; it exists only so the boot state
transitions cleanly.

**This dispatch is what took a walker fix to decode.** The `cs:` prefix in
`jmp word [cs:bx + 0x250]` means "read this word relative to the *code*
segment," and for a MZ program with `CS != 0` at boot (Alley Cat: CS = 0x0723
so cs_base = 0x7230) that offset has to be added to reach the actual table.
The walker in comrec was written for single-segment `.COM` files where
cs_base is always 0, so it looked for the table at image `0x0250` (zero-fill
inside the data segment) and found nothing. The fix — teaching the walker
that `cs:` on a multi-segment MZ needs `cs_base` added, both to the table
address and to the words the table holds — is
`DOS-Decompiler` commit `fe84bad`. Before the fix, seven per-phase handlers
totalling ~1,500 bytes stayed data.

The paired routine `end_of_room_pick_next` (image `0x73E7`) chooses the next
phase using the PRNG:

```nasm
    ; ...tick capture, position save, restart flag handling elided...
L_07415:
    call L_0A02D                ; PRNG step
    test dl, 0xa0               ; ~75% chance of the weighted path
    je L_0743A                  ; otherwise take the uniform path
    mov bx, word [8]            ; phase_history_index
    and bx, 3                   ; 4 buckets
    cmp bx, 3
    je L_0743A                  ; bucket 3 doesn't use weighted, fall through
    mov cl, 2
    shl bx, cl                  ; bx *= 4
    and dx, 3
    add bx, dx                  ; index = bucket*4 + (PRNG & 3)
    mov al, [bx + 0x421]        ; phase_select_table_weighted
    jmp L_0744C
L_0743A:
    call L_0A02D                ; retry PRNG for uniform pick
    and dx, 7
    cmp dx, 5
    jae L_0743A                 ; reject and retry until < 5
    mov bx, dx
    mov al, [bx + 0x42d]        ; phase_select_table_uniform
L_0744C:
    sub ah, ah
    cmp ax, [0x41d]             ; phase_history_last
    jne L_0745A
    cmp ax, [0x41f]             ; phase_history_prev
    je L_07415                  ; same as both? retry from the top
L_0745A:
    mov [4], ax                 ; commit as current_phase
    mov cx, [0x41d]
    mov [0x41f], cx             ; shift history
    mov [0x41d], ax
```

The dedup at the bottom is what stops the cat visiting the same room twice
in a row: the freshly picked phase is rejected against `phase_history_last`,
and if it also matches `phase_history_prev` the whole selection restarts.

---

## 8. Sound: the speaker primitives

Alley Cat drives one sound device — the PC speaker via PIT channel 2 — with
half a dozen primitives that combine into every meow, beep, and iris-wipe
whoosh in the game.

**`speaker_off`** — image `0xCD51` — four instructions:

```nasm
L_0CD51:                        ; speaker_off
    in al, 0x61                 ; read port 0x61
    and al, 0xfc                ; clear bits 0 (PIT ch2 gate) and 1 (data)
    out 0x61, al                ; write back
    ret
```

The single most-called routine in the main loop. The game silences the
speaker aggressively between tones — otherwise a stuck PIT would drone
forever.

**`speaker_write_divisor_and_gate`** — image `0xCAB9` — the note-play
primitive, assumes the mode byte has already been written:

```nasm
L_0CAB9:                        ; speaker_write_divisor_and_gate
    out 0x42, al                ; low byte of PIT ch2 divisor
    mov al, ah
    out 0x42, al                ; high byte
    in al, 0x61
    or al, 3                    ; enable bits 0 and 1
    out 0x61, al                ; PIT ch2 gate on + speaker data on
    ret
```

**`sfx_start_tone`** — image `0xCB6B` — the async sound-effect entry:

```nasm
L_0CB6B:                        ; sfx_start_tone(freq_ax, param_bx)
    cmp byte [0], 0             ; sound_enabled?
    je L_0CB8C                  ; if muted, return without touching hardware
    mov word [0x5923], bx       ; sfx_bx_param
    push ax
    mov al, 0xb6
    out 0x43, al                ; PIT ch2 mode 3 (square wave)
    pop ax
    call L_0CAB9                ; play the tone
    mov byte [0x5920], 2        ; sfx_playing_state := active
    sub ah, ah
    int 0x1a                    ; BIOS tick
    mov word [0x5921], dx       ; sfx_start_tick
L_0CB8C:
    ret
```

Note the master mute check at the top: `cmp byte [0], 0 / je return`. This
one instruction pair appears at the top of nearly every sound routine (25
times in the disassembly). Toggle `sound_enabled` (`[0]`) to zero and the
whole engine goes silent instantly without any other state to change.

**`advance_pit_pattern_step`** — image `0xCAC7` — the screen-wipe sound:

```nasm
L_0CAC7:                        ; advance_pit_pattern_step
    cmp byte [0], 0
    je L_0CAEC
    push ax
    push cx
    push dx
    mov al, 0xb6
    out 0x43, al
    mov bx, word [0x5a56]       ; pit_pattern_index
    and bx, 6                   ; 4-slot mask
    add word [0x5a56], 2        ; advance for next call
    mov ax, word [bx + 0x5a5a]  ; pit_pattern_table
    call L_0CAB9
    pop dx
    pop cx
    pop ax
L_0CAEC:
    ret
```

Each call plays the *next* note in a 4-entry PIT-divisor table and advances
the index, so repeated calls produce a rising pattern. That is the whoosh
sound the iris wipe makes at every phase transition — `draw_transition_iris`
calls this once per iteration of the growing squares.

---

## What was remarkable in 1984

**Two keyboard ISRs for one program.** In 1984 the PCjr was a distinct
machine with a distinct keyboard, and games that supported both had to write
twice. Alley Cat has two full INT 09h handlers, cross-referenced by
`cmp byte [machine_id], 0xFD` at the vector install and in a handful of
control paths (INT 48h vector saved separately, different keyboard clocks,
different palette-set path). This was ordinary work that ordinary players
never noticed. It vanished from the platform's history along with the
machine.

**The `shr cx, 1` compensation.** In `beep_blocking` there is:

```nasm
    cmp byte [0x697], 0xfd
    jne L_0CBF5
    shr cx, 1                   ; PCjr runs slower — halve the delay
L_0CBF5:
    loop L_0CBF5
```

The standard PC runs faster than the PCjr, so the busy-wait needs half as
many iterations to produce the same real-time duration. One shift instruction
implements CPU-speed independence for that one delay. Not enough to make the
whole game frame-rate independent — most timing is BIOS-tick-driven, which
is the same everywhere — but the places where a busy-wait matters, this
handles them.

**The whole game in 55 KB.** Twelve KB of sprite artwork, ~9,000 lines of
code, three sound engines (basic tone, sweep, 4-note pattern), a keyboard
subsystem with per-machine handlers, and enough state for seven mini-games
plus attract mode and menu. In 1984, that was normal. Today, `55,067 bytes`
is about the size of a single photograph's JPEG thumbnail.

**What is still unread.** [`../CLAUDE.md`](../CLAUDE.md) lists the open
items — most importantly the seven `phase_N_tick_*` routine bodies, which
name the room-specific logic by structural role but not by what each room
actually contains. A runtime hook (per
[knowledge/12](../../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md))
would settle them.
