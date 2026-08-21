# Alley Cat — architecture

*Document two of six. See [01-the-game.md](01-the-game.md) for what the game
is, [03-the-code.md](03-the-code.md) for annotated routines, and
[04-porting.md](04-porting.md) for where to take it next. For the browser port
instead, see [05-web-architecture.md](05-web-architecture.md).*

This describes how the program is shaped: its memory layout, and the four
mechanisms it is built out of — video, keyboard, timer, sound — plus the phase
machine that stitches them together.

Facts here were read from the binary. Anything inferred is marked
**[inferred]**. What is still unknown is listed
[at the end](#what-is-still-unknown).

---

## Shape of the file

`CAT.EXE` is **55,067 bytes**: a 512-byte MZ header followed by a 54,555-byte
load image. The MZ header is a small block DOS reads to know where to put the
program and where to start; the load image is what actually runs.

```
+----+ file 0x00000
| MZ | 512-byte header (magic, sizes, entry CS:IP, relocation table)
+----+ file 0x00200 = image 0x00000
|    |
|    | 54,555-byte load image
|    |
+----+ file 0xD71B = image 0xD51B
```

Inside the image the program uses **two segments**, and the MZ header tells DOS
which one to jump into first:

- `entry CS:IP = 0723:0000`, meaning start execution at image offset
  `0x0723 * 16 + 0 = 0x7230`
- `SS:SP = 0000:0100`, the initial stack

There are **nine relocation entries** in the header, and every one of them
writes the same segment value: `0x0010`. That is the *data* segment — the
program's first act is `mov ax, 0x10 / mov ds, ax`, and from that point on `DS`
points at image offset `0x0010 * 16 = 0x100`. Everything read through DS lands
at `image 0x100 + <DS-relative offset>`; everything the CPU executes lives at
`image 0x7230 + <CS-relative offset>`.

**Two coordinate systems for one file.** This is the trap the CLAUDE.md
warns about — a symbol named `[0x579]` in code refers to DS-relative offset
0x579, which is physical image offset `0x100 + 0x579 = 0x679`. The [symbol
file](../symbols.json) uses DS-relative offsets for its `globals` section
and image offsets for `_data_spans`. Getting them the wrong way round is a
mistake that is silent: the rebuild still hashes, and the reading is just
wrong.

Where each region lives:

| image offset | length | what |
|---|---|---|
| `0x00000..0x00100` | 256 | zero-fill; not addressed by DS or CS |
| `0x00100..0x07230` | 28,976 | **DS segment** — game state, tables, three sprite banks, message strings |
| `0x07230..0x0D51B` | 25,323 | **CS segment** — all executable code, plus one 16-byte dispatch table at `0x7480` and two interrupt handlers |

The full per-region breakdown is in `_data_spans` (54 spans covering 100% of
the image with no gap or overlap) — see [`../symbols.json`](../symbols.json).

## What the game is written in

Almost certainly **hand-written 8088 assembly**. Evidence: nothing looks like a
compiler runtime. There are no stack-frame prologues (`push bp / mov bp, sp`);
routines take their arguments in registers, sometimes in globals, sometimes
both. The keyboard ISR is short, hand-optimised, and speaks directly to the
8259 PIC. The sprite blitter maintains its width and height in named globals
(`blit_row_bytes` and `blit_row_count`) rather than on the stack, and there are
two versions of it that differ only in which segment prefix reaches those
globals — a hand-written variant to work around DS being pointed at video RAM
during a save.

The version with the ES prefix (`blit_cga_es_prefixed`) is a byte-for-byte copy
of `blit_cga_interleaved` with two operand encodings changed. A C or Pascal
compiler would not emit that; a person writing assembly would.

## Video: CGA mode 4, two interleaved banks

The game runs in **CGA graphics mode 4** — 320 × 200 pixels, 4 colors,
2 bits per pixel packed into each byte. `startup_video_probe` at boot writes
`0x55AA` to `B800:0000`, reads it back to confirm CGA is present, and sets
mode with `int 10h AH=0 AL=4`. On BIOS machines that report MDA instead, it
also patches the BIOS 40:0010 video-mode nibble to CGA-40x25 before switching
mode — so a machine with both adapters ends up on the color one.

The framebuffer at segment `B800` is **not** a linear 320×200 array. CGA
splits it into two 8000-byte banks:

- `B800:0000..B800:1F3F` holds the **even** scan lines (0, 2, 4, ...)
- `B800:2000..B800:3F3F` holds the **odd** scan lines (1, 3, 5, ...)

Each scan line is 80 bytes = 320 pixels ÷ 4 pixels-per-byte. To draw a
rectangle you write to the even bank for one row, then flip `di ^= 0x2000` to
reach the odd bank for the next row, and add 80 (`0x50`) at the top-bank
return so the beam advances a pair of scan lines. That is the whole trick, and
`blit_cga_interleaved` (image `0x9FCD`) is the routine that does it:

```
L_09FCD:
    cld
    mov byte [blit_row_bytes], cl
    mov byte [blit_row_count], ch
    sub ch, ch
L_09FD8:
    mov cl, byte [blit_row_bytes]
    rep movsw                       ; copy one scan line worth
    sub di, [blit_row_bytes]        ; step DI back to where the row started
    sub di, [blit_row_bytes]
    xor di, 0x2000                  ; flip to the other bank
    test di, 0x2000
    jne L_09FF3                     ; if we landed in the odd bank, no advance
    add di, 0x50                    ; if we landed back in the even bank, +1 row-pair
L_09FF3:
    dec byte [blit_row_count]
    jne L_09FD8
    ret
```

There are five distinct blitters in the file, all sharing that interleave
idiom:

- **`blit_cga_interleaved`** — plain copy (source: data, dest: video)
- **`blit_cga_es_prefixed`** — same operation, ES-prefixed cache access, used
  when the caller wants DS pointing at video (`snapshot_video_rect` does this
  to *read* from video into a scratch buffer)
- **`sprite_and_mask_blit`** — reads current video pixel, ANDs with mask from
  source, writes back; also saves the original to a scratch buffer so it can
  be restored. Half of the classic mask+color sprite pattern.
- **`sprite_colored_blit_with_save`** — the coloured half, with per-pixel bit
  manipulation using masks `0x30C0` and `0xFF0` to combine sprite bits with
  underlying video, saving originals to DS:BP for restore. Called 12 times —
  the primary "draw a coloured sprite" primitive.
- **`blit_sprite_list`** — a small bytecode interpreter. Reads pairs of
  `(source_offset, dest_offset)` from a table pointed to by BX, terminated by
  `0xFFFF`, blitting each entry with `rep movsb` and interleave handling.
  Used to render composed multi-part sprites in one call.

Two helpers ride alongside them: `cga_row_col_to_offset` computes a byte
offset and bit-shift from a (row, column) pair (this is what handles the
interleave for callers that need an address before they start blitting), and
the sprite-save/draw/restore trio — `snapshot_video_rect`,
`sprite_draw_saving_bg`, `restore_video_from_snapshot` — implement the
standard sprite-on-static-background pattern from a fixed scratch buffer at
`DS:0x5FA`.

**Screen transitions use an iris wipe.** `screen_transition_wipe` picks the
cat's current position as the centre, then calls `draw_transition_iris` which
`rep stosw`s outward-growing squares of the fill pattern (`0x0000` on the first
pass, then `0xAAAA` or `0x5555` depending on phase) while advancing a 4-note
PIT-channel-2 pattern for the wipe sound.

**Palette.** Set once per frame by `apply_palette`. On standard CGA a single
`int 10h AH=0Bh BH=1 BL=[table]` picks one of the two 4-color palettes; on
PCjr the game takes three separate `int 10h AH=10h` calls to set palette
registers 1, 2 and 3 independently, from parallel tables at `DS:0x183B`,
`DS:0x1843`, `DS:0x184B` (byte-per-phase). The palette is per-phase — the
same variable indexes both tables, and every phase transition applies the
palette for the new phase.

## Keyboard: two ISRs for two keyboards

Alley Cat installs its own **INT 09h handler** and reads keys itself. The
handler is short and machine-specific: `install_keyboard_handler` saves the
old vector (also INT 48h on PCjr, which routes keyboard events differently),
then writes either `CS:0x14B3` (standard PC) or `CS:0x14FB` (PCjr) into the
INT 09h vector — chosen by `cmp byte [machine_id], 0xFD`.

Both handlers do the same conceptual thing:

1. Read the scancode from port `0x60`
2. Split into scancode (`al & 0x7F`) and make/break flag (`ah & 0x80`)
3. `repne scasb` through `key_scancode_table` (22 bytes at `DS:0x6A1`) to find
   which of the game's 22 tracked keys this is
4. If found, write the make/break bit into `key_state_table[index]` (22 bytes
   at `DS:0x6B7`) — bit 7 = released
5. Increment `key_tick_counter` — the game's clock for keyboard events
6. Acknowledge the keyboard on port `0x61` (pulse bit 7), send EOI `0x20`
   to port `0x20` (the 8259 PIC), IRET

The PCjr handler is longer because PCjr's keyboard sends command bytes
`0xFF` and `0x55` in addition to scancodes, and cross-checks the BIOS
40:0012 shift-state byte against its own cached copy. Everything else is
the same.

The game polls the state table each frame — `handle_keyboard_events` looks
for edges in `key_tick_counter`, then dispatches on specific slots of
`key_state_table`. That is how `Ctrl-S` (toggle sound via
`not byte [sound_enabled]`), `Ctrl-R` (restart), and `Esc` (paws mode)
work — each is one entry in the 22-slot table, checked by bit 7.

## Timer: two sources, two purposes

Alley Cat reads the timer from **two different places**, for two different
kinds of thing:

- **BIOS INT 1Ah AH=0** returns the 32-bit tick count (~18.2 ticks per
  second). This is the slow clock — used for movement scheduling, sound
  duration, animation timing. Sixty-plus call sites read it.
- **PIT channel 0 counter, read directly through ports 0x43 and 0x40**, gives
  a 16-bit high-resolution reading (~1.19 MHz). This is used only twice:
  once at boot by `seed_random_from_pit` (the initial PRNG state), and once
  in the speaker duration loop (`speaker_start_tone` reads PIT counts to
  hold a tone for a specific number of high-resolution ticks).

The BIOS tick is coarse enough that many routines gate on it (`if
tick == last_tick: return`), then do work only on tick edges. That is why
delta-tick shadows appear in the globals as often as they do:
`movement_last_tick`, `bg_pattern_last_tick`, `scheduler_last_tick`,
`speaker_sweep_last_tick`, `sound_tick_state`, `poll_last_tick`, and half a
dozen per-phase shadows. Each is one routine's private clock.

There is **no** INT 08h or INT 1Ch handler — Alley Cat does not install a
timer interrupt. Everything runs on the main-loop poll of INT 1Ah.

## Sound: one PC speaker, one master mute

There is exactly one sound source: the **PC speaker**, driven from PIT
channel 2 through port `0x42` (divisor) and port `0x61` bits 0 and 1
(gate + speaker-data-enable).

The whole engine boils down to five primitives:

- **`speaker_off`** — clears port `0x61` bits 0 and 1. The single hottest
  routine in the main loop; the game silences the speaker aggressively
  between tones.
- **`speaker_start_tone`** — programs PIT ch2 mode 3 (square wave) with a
  16-bit divisor from `[speaker_pit_divisor]`, gates the speaker on, then
  holds for a duration measured against the PIT counter (`sound_delay_threshold`).
- **`sfx_start_tone`** — starts a non-blocking sound effect for the main loop
  to advance. Sets `sfx_playing_state := 2` and captures the start tick.
- **`beep_blocking`** — blocking beep with a spin-loop count that is halved on
  standard PCs (`shr cx, 1`) because they run faster than PCjr. That single
  shift compensates for the CPU-speed difference.
- **`advance_pit_pattern_step`** — steps through a 4-note pattern at
  `[pit_pattern_table]` indexed by `[pit_pattern_index] & 6`. Called by the
  screen wipe for a rising-tones effect.
- **`update_speaker_sweep`** — a per-frame frequency sweep: divisor =
  `([speaker_sweep_freq] & 0x1FF) + 0xC8`, then `sweep_freq -= 0x4B`. Falling
  tone. Used for "cat is falling / meowing" effects.

**The master mute is one byte at DS:0.** Set to `0xFF` at boot; toggled by
`not byte [sound_enabled]` when the `Ctrl-S` key state fires; tested at the
top of nearly every sound routine — twenty-five occurrences of `cmp byte [0],
0 / je return` in the disassembly. If the flag is zero, the routine returns
without touching the speaker.

## Random: a 6-instruction LFSR

Every random pick in the game — the next phase to enter, the position of a
new mouse, the pitch of a random meow — passes through `prng_step`
(`L_0A02D`), which is six instructions:

```
L_0A02D:
    mov dx, word [prng_state]
    xor dl, dh
    shr dl, 1
    shr dl, 1
    rcr word [prng_state], 1
    mov dx, word [prng_state]
    ret
```

That is a **linear feedback shift register**. The `xor dl, dh` mixes the two
halves of the state; `shr dl, 1` twice puts the resulting bit into carry after
being shifted through; `rcr word [prng_state], 1` rotates the whole 16-bit
state right through the carry, shifting the mixed bit back in as the new
high bit. Deterministic — same seed, same sequence.

`seed_random_from_pit` reads the PIT counter at boot. If the counter happens
to be zero, it substitutes `0xFA59` — an anti-lockup so the seed is never
exactly zero (an all-zeros LFSR state would never move).

## The phase machine

Everything above is machinery. What ties it together is the state machine
in [`docs/01-the-game.md`](01-the-game.md#the-shape-of-a-session):

```
mov bx, word [current_phase]
cmp bx, 7
jbe L_07479
sub bx, bx
L_07479:
shl bx, 1
jmp word [cs:bx + 0x250]   ; dispatch through the 8-word table at CS:0x250
```

That is **one instruction** at the end of `dispatch_current_phase` (image
`0x07468`), and it is what took a comrec walker fix to decode: the
`cs:` prefix in the dispatch means "read this word relative to the CS
segment," and the walker had assumed `cs:` addressing was flat — see the
[fix narrative in CLAUDE.md](../CLAUDE.md#the-walker-gap-this-game-surfaced-and-what-fixed-it).

Every phase handler has the same shape (which is [described in
docs/03](03-the-code.md#the-shape-of-a-phase-handler)): self-assert the phase
number, run the shared init (screen wipe, palette, cat position, per-phase
state), then an inner loop of six or seven per-frame calls terminated by an
OR-check on four or five level-end flags. Each handler is 74–120 bytes.
Room-specific logic — draw the birdcage, animate a mouse — lives in
`phase_N_tick_a` and `phase_N_tick_b` for each phase, which have been named
by structural role but not by what they actually draw.

## What is still unknown

- **Which phase is which room.** The seven phase handlers have been decoded,
  their init and tick routines named, but nothing in the code says "phase 4
  is the aquarium." This needs a runtime hook — set `[current_phase] = N`,
  jump to `dispatch_current_phase`, screenshot. See
  [knowledge/12](../../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md).
- **The sprite pointer tables.** Three sprite banks are identified by
  extent (`sprite_data_bank_a`, `sprite_data_bank_b`, `sprite_data_bank_c`,
  totalling ~12.5 KB) but the pointer tables that pick individual sprites
  out of them have not been parsed. The code references them by
  `[bx + 0x1853]`, `[bx + 0x1679]`, and `[0x70F0] + 0x6F30`, but each
  pointer table's length and entry format are still open.
- **The ~5 KB of remaining unread DS data.** Twenty spans between the named
  clusters — total ~5 KB — hold data whose purpose has not been read. Some
  are almost certainly per-phase initial-value tables; some are additional
  sprite pointer tables; some may be lookup tables for movement or scoring.
- **Scoring rules.** The only score-related string in the binary is
  `'BONUS MULTIPLIER: 12'` at image `0x0380E`. What triggers a multiplier,
  what the score for each mini-game action is, is not in this reading.
- **Tail-call entries.** annotate reports two unnamed tail-call entries
  (`0x07323`, `0x07657`) which sit inside the main loop's exit paths and
  need reading.
