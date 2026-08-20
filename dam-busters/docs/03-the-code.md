# The Dam Busters — the code

*Document three of six. See [01-the-game.md](01-the-game.md) for what the
game is, [02-architecture.md](02-architecture.md) for how the program is
laid out, [04-porting.md](04-porting.md) for where to take it next,
[05-web-architecture.md](05-web-architecture.md) for the port's shape and
[06-web-code.md](06-web-code.md) for its code. Some of those files may
not exist yet; the header names positions.*

Nine routines, walked instruction by instruction. Every listing is copied
from `recovered/dam-busters-named.asm` — the file that reassembles to a
byte-identical copy of the original — with comments added and nothing
else changed. The routine's file offset is quoted in each header; since
`DAMB.EXE` is a single-segment MZ, that offset is also the address the
code itself uses.

Doc 02 pointed at [ParaTrooper's five ideas](../../paratrooper/docs/02-architecture.md#five-ideas-if-assembly-is-new-to-you)
if 8086 assembly is unfamiliar; that primer applies here too. Each
routine below is explained twice: once as *what the machine does*, once
as *what the programmer was thinking* — and the transferable lesson is
named at the end of the section, because most of these idioms outlive
the machine they were written for.

Nothing here is a guess about what the machine does. Where a *purpose*
is reasoned rather than proven, it is marked **[inferred]**.

---

## 1. `entry` and `post_boot` — how a DOS program starts

**File `0x0000`.** The first two instructions are all it takes to make
`DAMB.EXE` behave like a `.COM` file wearing an MZ header:

```nasm
entry:
    mov ax, cs
    mov ds, ax
    mov dl, 0
    mov si, 4
    mov cl, 1
    mov ch, 0xa
    mov dh, 0
    mov bx, 0
L_00012:
    mov al, 1
    mov ah, 4
    nop
    nop
    jmp L_00020
    db 0x4E, 0x75, 0xF5, 0xEB, 0x0E, 0x90
L_00020:
    mov si, 4
    inc cl
    cmp cl, 0x10
    jbe L_00012
    jmp post_boot
```

**What the machine does.** `mov ax, cs / mov ds, ax` copies the code
segment into the data segment — from this point on, `DS:0` names the
same byte as `CS:0`. Then a 16-round loop runs, setting up registers,
falling through a hand-written six-byte block, incrementing a counter,
looping until `CL > 16`, and jumping to `post_boot`.

**What the programmer was thinking.** *One segment for everything.* MZ
programs normally live in a code segment and a separate data segment,
with a relocation table telling DOS which addresses to patch when it
picks the load segment. This file has no relocation table because it
does not need one: every address in it is relative to that one shared
segment. This is the `.COM`-shape-in-an-MZ-wrapper trick that Karateka
uses too.

The 16-round detection loop is not settled. Bytes at `0x001A` are
`4E 75 F5 EB 0E 90` — a hand-written block that reads as
`dec si / jne (backwards) / jmp / nop` and appears to test whether some
opcode leaves flags a particular way. What the shipped machine
condition triggers `detection_failure_halt` at `0x2D` — an infinite
`jmp $` — is not established. **[inferred]** something about CPU
identification, since the round count is 16 and the loop is at the very
first instruction, before any I/O is touched. In the shipped file it
always falls through.

Falling through, `post_boot` brings the machine up:

```nasm
post_boot:
    call init_cga_mode
    call set_default_palette
    call save_kbd_isr
    mov word [saved_sp], sp
    mov byte [music_enabled], 1
    mov ax, 0
L_00044:
    dec ax
    jne L_00044
L_00047:
    call install_timer_isr
    call draw_title_screen
    call flush_key
    call wait_key_or_timeout
```

**Two lines are worth pausing on.**

`mov word [saved_sp], sp` writes the current stack pointer into memory,
so that when the run ends and the program jumps back to `restart_run`
it can peel every push made along the way off the stack in one
instruction. Without this, the second run would start with a stack
still holding two hundred bytes of the first run's return addresses.

`mov ax, 0 / L_00044: dec ax / jne L_00044` is a **timing delay** — a
loop that runs 65,536 times doing nothing except counting. This is
what a programmer does before there is a hardware clock to wait on:
burn time by counting to a number the CPU takes a known amount of time
to count to. The trick was ubiquitous in the era and is the reason
early-80s games became unplayable on a faster PC a few years later. In
this game it is a warm-up for the video hardware between `save_kbd_isr`
and `install_timer_isr`; nothing in the game's *playing loop* relies
on it, because the play loop waits on the timer interrupt instead
(see [section 5](#5-timer_isr--the-part-that-runs-in-the-background)).

**The transferable lesson.** Every program has a bring-up sequence, and
its shape is dictated by what has to be true before what. Here: the
video mode must exist before anything can draw; the BIOS keyboard
vector must be saved before the game replaces it; the stack pointer
must be recorded before it is spent. The order is not arbitrary. In a
modern program, replace *interrupt vector* with *dependency injection
container* and the reasoning is identical.

---

## 2. `main_loop` — the CLI/STI fence and the indirect call

**File `0x006B`.** Fifteen instructions and one indirect call. The
architectural centre of the program:

```nasm
main_loop:
    cli
    mov ax, word [tick_flags]
    mov word [tick_flags_working], ax
    mov word [tick_flags], 0
    sti
    test word [tick_flags_working], 1
    je main_loop
    call strict near per_frame_step
    call strict near check_phase_transition
    mov bx, word [game_phase]
    shl bx, 1
    call word [bx + phase_dispatch]
```

**Why the fence exists.** `tick_flags` at `[0xE144]` is a **shared
variable**: `timer_isr` writes into it every 55 milliseconds on the
hardware's schedule, and `main_loop` reads and clears it on the game's
schedule. Without protection, this sequence is possible —

- `main_loop` reads `tick_flags` into `AX`
- the timer fires; `timer_isr` sets bit 4 of `tick_flags`
- `main_loop` clears `tick_flags`

The bit the ISR just set is now lost. `cli` disables hardware
interrupts and `sti` re-enables them; between them, the copy and clear
are atomic — no interrupt can fire in the middle. This is the **only
place in the game** that fences an interrupt, because it is the only
place where the main code and an ISR share a variable that both write.

**Two things about this idiom that transfer.** First, the fence is
around the copy-plus-clear, not around every read. Once `tick_flags`
is safely in `tick_flags_working`, the frame code reads the working
copy freely — the ISR cannot touch that one. Snapshot-then-clear is
the classic pattern for consuming a signal that an asynchronous
producer keeps updating; it appears in modern lock-free queues under
the name *seq-lock*, and in higher-level code as *atomic swap*.

Second, the fence is as narrow as possible. Four instructions are
inside `cli/sti`, no more. An interrupt disabled for too long causes
the timer to fall behind, the keyboard to drop keys, and the music to
stutter. Hold the lock, use the lock, drop the lock — the wording is
newer, but the discipline is the same.

**The indirect call.** `mov bx, [game_phase] / shl bx, 1 / call word
[bx + phase_dispatch]` reads the current phase (0..8), doubles it
because addresses are two bytes on the 8086, and calls through the
table at `phase_dispatch` (offset `0x00B9`). Nine possible targets,
one instruction to reach the right one. This is what "polymorphic
dispatch" compiles to in the absence of a compiler that will do it for
you — a table of function pointers indexed by a state variable — and
it is the first of eleven such tables in this file (the full list is
in [doc 02](02-architecture.md#the-eleven-jump-tables)).

**The transferable lesson.** A shared variable needs a fence at every
write and every read-then-modify — but the fence should surround the
smallest possible operation. And an indirect call through a table is
what an if-else chain becomes when the number of arms outgrows
readability; the same shape appears in every runtime, from V-tables in
C++ to method dispatch in Smalltalk to `enum` variants matched in
Rust.

---

## 3. `clamp_map_position` — the six-region map, and how carry means "something changed"

**File `0x0240`.** The map screen has six regions arranged in a 2×3
grid (Great Britain, North Germany, Eastern France on the top row;
France, Belgium, South Germany on the bottom). The cursor moves in
world coordinates within one region, and when it walks off an edge, it
either wraps into the neighbour or stays put — depending on which
edge. This routine is the arbiter:

```nasm
clamp_map_position:
    mov ax, word [si]           ; x
    mov bx, word [si + 2]       ; y
    mov cx, word [si + 4]       ; region
    db 0x33, 0xD2               ; xor dx, dx  -- "have we wrapped?"
L_0024A:
    cmp ax, strict word 0
    jge L_00266                 ; x >= 0: move on to the top-edge test
    cmp cx, 0
    je L_00261                  ; region 0: clamp x to 0
    cmp cx, 3
    je L_00261                  ; region 3: clamp x to 0
    dec cx                      ; otherwise step to the left neighbour
    mov ax, 0xdf                ; and reappear at x=223
L_0025D:
    mov dl, 1                   ; "yes, we wrapped"
    jmp L_0024A
L_00261:
    mov ax, 0                   ; clamp
    jmp L_0024A
```

**What the machine does.** The routine reads three words from
`DS:SI` — the (x, y, region) triple — into `AX`, `BX`, `CX`. `DX` is
zeroed with `xor dx, dx` to serve as a "did anything wrap?" flag. Then
four tests, one per edge:

- **Left edge** (`x < 0`). If we are in region 0 or 3, clamp `x` to 0
  — this is the *west edge of Europe* and the plane cannot fly further
  west. Otherwise decrement the region (walk to the left neighbour)
  and put `x` at 223 (the right side of that neighbour), setting the
  wrap flag.
- **Right edge** (`x >= 0xE0`) — the code continues below this excerpt
  with the same structure: regions 2 and 5 (east edge) clamp; the
  others increment the region and set `x = 0`.
- **Top edge** (`y < 0`) — regions 0, 1 and 2 (the top row) clamp;
  otherwise subtract 3 from the region (walk from bottom row to top)
  and set `y = 143`.
- **Bottom edge** (`y >= 0x90`) — regions 3, 4 and 5 clamp; otherwise
  add 3 and set `y = 0`.

After the four tests the routine writes the (possibly modified) triple
back and returns:

```nasm
L_002AF:
    mov word [si], ax
    mov word [si + 2], bx
    mov word [si + 4], cx
    clc
    cmp dl, 0
    je L_002BE
    stc
L_002BE:
    ret
```

**`clc` clears the carry flag; `stc` sets it.** The return value is
the carry flag itself: **caller reads `CF` to learn whether the cursor
wrapped**. This is the 8086's convention for returning a boolean
without spending a register on it, and every caller of
`clamp_map_position` (`map_screen_step`, `update_map_position`) uses
`jc` immediately after the call.

**Two idioms worth naming for the first time.**

`xor dx, dx` sets `DX` to zero. Why not `mov dx, 0`? Because `xor` of
a register with itself is two bytes and `mov dx, 0` is three, and the
`xor` is also faster on this processor. ParaTrooper's doc 03 named
this one in section 1; it appears here on every routine that needs a
zero register.

`db 0x33, 0xD2 ; xor dx, dx` — a real instruction pinned to raw bytes
because the two legal encodings of `xor dx, dx` produce different
byte sequences and the reconstruction has to match the original
exactly. Written this way, `db` plus a comment naming the instruction,
the file rebuilds byte-identical and the reader loses nothing. The
same trick appears throughout the file; ParaTrooper's postscript
explains it in more detail.

**The transferable lesson.** When you have four analogous cases —
here, the four edges of a rectangle — write them so their *shape*
matches. Every edge in this routine has the same structure: *test the
coordinate, check whether this region has a neighbour on that side,
either clamp or wrap-plus-set-the-flag*. You could compress it further
by treating (x, y) as a single 2D vector, but the compression would
hide the per-region asymmetry: **the map is not toroidal, and there
are hard edges the plane cannot cross**. Making the edges visible in
the code makes the game rule visible in the code. That is worth more
than the two saved instructions.

---

## 4. `integrate_heading` — multi-precision arithmetic in 16-bit registers

**File `0x0E46`.** The plane's heading is a value in degrees, 0..359,
integrated every frame from the current roll input. This is the
integrator:

```nasm
integrate_heading:
    mov ax, word [roll]
    neg ax
    shl ax, 1
    shl ax, 1
    add ax, word [heading_accum]
    cmp byte [auto_stabilise], 0
    jne L_00E6A
    cmp ax, strict word 0xfffa
    jl L_00E67
    cmp ax, strict word 6
    jg L_00E67
    mov ax, 0
L_00E67:
    mov word [heading_rate], ax
L_00E6A:
    mov ax, word [heading_rate]
    cwd
    add word [heading_accum_lo], ax
    adc byte [heading_accum_hi], dl
    jns L_00E7E
    add word [heading], 0x168
L_00E7E:
    cmp word [heading], 0x168
    jb L_00E8C
    sub word [heading], 0x168
L_00E8C:
    ret
```

**Line by line.** `roll` is negated (because the input's sign is
opposite to the desired direction) and multiplied by 4 with two `shl ax, 1`
instructions. `shl` shifts left by one bit — a *left shift by N* is a
multiply by 2^N, and two of them together is a multiply by 4. This is
faster than an actual `mul` on the 8086, where `mul` costs 70+ cycles
and each `shl` costs 2.

The scaled roll is added to a running `heading_accum`. Then a check:
if `auto_stabilise` is zero, saturate the accumulator to the range
[-6, +6]. `0xFFFA` is -6 as a signed 16-bit value; `+6` is `+6`.
Values outside that range collapse to zero. This is the "the plane
levels itself when you let go of the stick" behaviour; setting
`auto_stabilise` non-zero disables it and lets the pilot pull harder
manoeuvres.

**The clever bit is the 24-bit integration.** `heading_accum_lo` at
`[0xBC8]` is a word and `heading_accum_hi` at `[0xBCA]` is a byte;
together they hold a 24-bit signed value. The heading rate (which
might be negative) is sign-extended into 32 bits with `cwd` — "convert
word to double", which sets `DX` to `0xFFFF` if `AX` is negative and
`0x0000` if positive — and then:

```nasm
    add word [heading_accum_lo], ax
    adc byte [heading_accum_hi], dl
```

`add` writes the low word and sets the carry flag if there was an
overflow. `adc` — add with carry — adds `DL` (the low byte of the
sign extension) *plus the carry flag from the previous add* into the
high byte. This is exactly how the 8086 does multi-word arithmetic:
the carry flag chains the operation across word boundaries. The same
pattern applied twice more would give you 32-bit or 64-bit addition on
a 16-bit processor.

**The modular wrap.** The middle byte of the 24-bit accumulator —
`heading` at `[0xBC9]` — is the heading in degrees. After the
integration, the code checks:

```nasm
    jns L_00E7E                 ; sign clear -> not negative
    add word [heading], 0x168   ; became negative: wrap up by 360
L_00E7E:
    cmp word [heading], 0x168
    jb L_00E8C
    sub word [heading], 0x168   ; became >= 360: wrap down
```

`0x168` is 360. If the heading crossed zero going down, add 360; if it
crossed 360 going up, subtract 360. `jns` (jump if sign not set) tests
whether the high bit is clear — the classic way to test signedness on
a value where you cannot afford a `cmp x, 0`.

**The transferable lesson.** Multi-precision arithmetic on a small
processor is a chain of adds where each add's *carry* is the next
add's *input*. The 8086 exposes this directly with `add` and `adc`;
modern processors do the same with `addcarry` intrinsics. Extended
precision is what floating-point libraries do internally to squeeze
another few bits out of a `double`, and what cryptographic libraries
do everywhere: `add` for the bottom, `adc` for every word above.

**Not settled:** why the *middle* byte of the 24-bit accumulator is
the visible heading, rather than the top. **[inferred]** it is a
fixed-point representation where the low word is the sub-degree
fractional part and the high byte is a sign-cum-overflow bit; the
degree that the game reads is the byte in the middle. The reading has
not confirmed this by tracing every writer.

---

## 5. `timer_isr` — the part that runs in the background

**File `0x0E24E`.** The DOS timer interrupt fires 18.2 times a second
— every 55 milliseconds, from PIT channel 0. This routine has hooked
INT 1Ch so the game gets called every time. It does two jobs in one
handler:

```nasm
timer_isr:
    cli
    push ds
    push ax
    push si
    mov ax, cs
    mov ds, ax
    inc word [cs:0xe142]        ; free-running tick counter
    cmp byte [end_of_run_flag], 0
    je L_0E26C
    mov word [cs:0xe144], 0xffff
    jmp L_0E2FE                 ; ISR bailout — end-of-run path
L_0E26C:
    dec word [cs:0xe138]        ; music_inner_counter
    jne L_0E2A0
    mov word [cs:0xe138], 2     ; refill
    dec word [cs:0xe13c]        ; music sub-tick
    jns L_0E28D
    inc word [cs:0xe13e]        ; music_bar_count
    mov word [cs:0xe13c], 4
L_0E28D:
    mov ax, word [cs:0xe140]    ; tick_counter
    inc word [cs:0xe140]
    xor ax, word [cs:0xe140]    ; bit-diff before/after inc
    or word [cs:0xe144], ax     ; OR into tick_flags
```

**The first job is the frame tick.** The interesting three lines are
the last three of the block above. `AX` gets the tick counter's value
*before* increment; the counter is then incremented; `xor` produces
the bit pattern of *which bits changed*. When the counter goes
`0 → 1`, `2 → 3`, `4 → 5`, etc., only bit 0 changes — the xor is 1.
When it goes `1 → 2`, bits 0 and 1 both change — the xor is 3. When
it goes `3 → 4`, three bits change — the xor is 7. And so on. The
`or word [cs:0xe144], ax` line then OR-s that bit pattern into
`tick_flags`, which is what `main_loop` reads under its CLI/STI fence.

Read that again. **Bit 0 of `tick_flags` is set on every timer tick
where the counter's low bit toggles.** That happens on every
increment, so bit 0 is set every 55 ms, and `main_loop` waits on it
with `test word [tick_flags_working], 1 / je main_loop`. This is the
game's frame rate: **18.2 Hz**. Higher-numbered bits (1, 2, 3...)
toggle less frequently and other subsystems read them for lower-rate
work: bit 5, for example, gates the model-update calls in
`per_frame_step`.

Same routine, same primitive — but the ISR does not spend a single
extra instruction on rate division. The *natural* bit-toggle rate of
a binary counter *is* the rate division. That is a clean piece of
engineering.

**The second job is music.** Continuing:

```nasm
L_0E2A0:
    cmp byte [cs:0xe14f], 0     ; music_note_ticks_left
    jne L_0E2EC
L_0E2A8:
    mov si, word [cs:0xe148]    ; music_note_ptr
    mov al, byte [si]           ; read duration
    cmp al, 0
    je L_0E306                  ; 0 = end of song, jump to loop
    dec al
    mov byte [cs:0xe14f], al    ; store ticks left
    ...
    inc si
    mov al, byte [si]           ; read note index
    add word [cs:0xe148], 2     ; advance the read cursor
    ...
    shl si, 1
    mov ax, word [cs:si - 0x1eaf]   ; look up PIT count from freq table
    out 0x42, al                     ; program PIT channel 2 low byte
    xchg ah, al
    out 0x42, al                     ; PIT channel 2 high byte
    in al, 0x61
    or al, 3
    out 0x61, al                     ; enable speaker gate
```

The music sequencer is a byte stream of (duration, note-index) pairs.
Every timer tick, the ISR decrements the current note's duration; when
it reaches zero, the ISR advances the read cursor two bytes, looks the
new note-index up in the frequency table at `0xE151`, and programs the
Programmable Interval Timer's channel 2 to that frequency. Channel 2
is wired to the PC speaker; setting it produces a square wave.

**The `out` instruction writes a byte to an I/O port.** Port `0x42` is
the PIT's channel-2 count register; ports `0x61` bits 0 and 1 gate
whether channel 2 actually reaches the speaker. This is what "playing
a note" looks like on a machine without a sound chip: reprogram the
timer that was going to fire an interrupt so that it fires at *audio
rate* instead, and pipe its output to a speaker.

**When the note stream reaches its `0` terminator, `L_0E306` reads
`music_loop_ptr` and resumes playing from there** — that is how the
menu music loops indefinitely, and how `set_loop_song` in the setup
code decides what plays.

**The transferable lesson.** An interrupt handler is a *tiny*
scheduler: it runs on its own timeline, it must return quickly, and it
communicates with the main code by touching shared state under a lock
the main code respects. This one does two entirely different jobs
(video timing and audio synthesis) because the hardware only gives it
one interrupt to work with. Modern equivalents — a `setInterval`
callback, an OS timer, a real-time thread — face the same
constraints, and the same rules apply: touch as little shared state as
possible, do the minimum work needed to hand off to the main code, get
out.

---

## 6. `draw_display_list` — a bytecode interpreter in eight instructions

**File `0x0DF0E`.** Every menu, panel, title screen and results page
in the game is drawn by an interpreter for a tiny bytecode language.
The interpreter itself is *eight instructions long*:

```nasm
draw_display_list:
    db 0x32, 0xFF                       ; xor bh, bh
    mov bl, byte [si]                   ; read one opcode byte
    shl bx, 1                           ; word-index
    jmp word [bx - 0x20e8]              ; jump through dl_dispatch
    db 0xDE, 0xE0, 0x2C, 0xDF, 0x62, 0xDF, ...   ; dl_dispatch table
```

**What the machine does.** `SI` points at the display-list bytecode.
`BL` reads the current opcode. `BH` is cleared, so `BX` is now the
opcode as a 16-bit index. `shl bx, 1` doubles it (word addresses). And
`jmp word [bx + dl_dispatch]` — written here as `[bx - 0x20e8]`
because NASM has resolved the address arithmetic — jumps through the
ten-entry table at `dl_dispatch` (`0xDF18`).

Ten opcodes:

| # | handler | what it does |
|---|---|---|
| 0 | `L_0E0DE` | end of program |
| 1 | `dl_opcode_1_text` | draw text via `blit_rect` |
| 2 | `dl_opcode_2_sprite` | draw sprite via `blit_shape` |
| 3 | `dl_opcode_3_wait` | wait N timer ticks |
| 4 | `dl_opcode_4_border` | set the CGA border colour |
| 5 | `dl_opcode_5_sprite_at` | draw sprite at (x, y) |
| 6 | `dl_opcode_6_text_clip` | draw clipped text |
| 7 | `dl_opcode_7_sprite_clip` | draw clipped sprite |
| 8 | `dl_opcode_8` | further sprite variant |
| 9 | `dl_opcode_9` | further sprite variant |

**Each handler follows the same shape.** Opcode 3 is the smallest one
worth reading through:

```nasm
dl_opcode_3_wait:
    mov ax, word [si + 1]       ; read the argument word
    call wait_ticks
    add si, 3                   ; step past opcode + word argument
    jmp draw_display_list       ; back to the top
```

The bytecode instruction is 3 bytes: the opcode itself, then the
16-bit tick count. The handler reads the argument at `[si + 1]`, calls
the underlying primitive, advances `SI` by 3, and jumps back to the
interpreter. **Every handler tail-jumps back to `draw_display_list`.**
That is the interpreter loop; it does not have one of its own.

**Opcode 1 is longer** because it has more arguments — a rectangle
plus a string address — but the shape is the same:

```nasm
dl_opcode_1_text:
    db 0x32, 0xFF
    mov bl, byte [si + 1]       ; width
    mov word [blit_width], bx
    mov bl, byte [si + 2]       ; height
    mov word [blit_height], bx
    mov bl, byte [si + 3]       ; x
    mov word [blit_x], bx
    mov bl, byte [si + 4]       ; y
    mov word [blit_y], bx
    mov bl, byte [si + 5]       ; string index
    shl bx, 1
    add bx, word [dl_string_base]
    mov ax, word [bx]           ; look up string address
    mov word [blit_src], ax
    add si, 6                   ; step past the 6-byte instruction
    push si
    call blit_rect              ; do the draw
    pop si
    jmp draw_display_list
```

The instruction takes six bytes: opcode plus five one-byte arguments.
The last argument is not the string itself but an *index* into a
per-phase string table pointed to by `dl_string_base`. The same phase
init sets `dl_string_base` and the display list, so the phase's
strings are addressed by small numbers rather than 16-bit pointers,
saving one byte per text-draw instruction. In a display list with
several `draw text` calls, that adds up.

**The transferable lesson.** A bytecode interpreter is worth reaching
for whenever the same *shape* of operation is going to be issued from
many places with different parameters. Every menu in this game would
otherwise be a hundred lines of `mov / mov / call blit_rect`; instead,
each is a short byte stream of shape `opcode, args, opcode, args, ...`
that the interpreter walks. The eight-instruction dispatcher plus ten
short handlers together **replace an estimated several kilobytes of
hard-coded drawing calls**.

This is the same trick that HTML is (a tag stream a browser walks),
that PostScript is (a program a printer interprets), and that every
game engine's "scene" description language is. The Sydney Development
Corp programmer had built a small one for a single-file DOS game in
1984 — which is not unusual for the time but is worth naming plainly
because most 1984 games hard-coded their screens.

---

## 7. `project_point_2d` — a 2×2 matrix multiply in integer registers

**File `0x504D`.** The whole 3D pipeline of this game is one 2×2
matrix multiply plus a translation. This is it:

```nasm
project_point_2d:
    mov word [0x4da9], ax       ; save x
    mov word [0x4dab], bx       ; save y
    imul word [camera_matrix_cos]
    mov cl, 6
    sar ax, cl                  ; (x * cos) / 64
    db 0x8B, 0xE8, 0x8B, 0xC3   ; mov bp, ax | mov ax, bx
    imul word [camera_matrix_sin]
    mov cl, 6
    sar ax, cl                  ; (y * sin) / 64
    db 0x2B, 0xE8, 0x8B, 0xC3   ; sub bp, ax | mov ax, bx
    imul word [camera_matrix_cos]
    mov cl, 6
    sar ax, cl                  ; (y * cos) / 64
    db 0x8B, 0xD8               ; mov bx, ax
    mov ax, word [0x4da9]
    imul word [camera_matrix_sin]
    mov cl, 6
    sar ax, cl                  ; (x * sin) / 64
    db 0x03, 0xD8               ; add bx, ax
    add bx, word [camera_offset_y]
    add bp, word [camera_offset_x]
    db 0x8B, 0xC5               ; mov ax, bp
    ret
```

**What the machine computes.** Given input point `(x, y)` in `(AX,
BX)`, and camera matrix `sin(roll)` at `camera_matrix_sin` and
`cos(roll)` at `camera_matrix_cos` (both scaled by 64), this
calculates:

```
x' = (x·cos - y·sin) / 64 + camera_offset_x
y' = (y·cos + x·sin) / 64 + camera_offset_y
```

That is the 2D rotation matrix

```
[cos  -sin] [x]     [tx]
[sin   cos] [y]  +  [ty]
```

with the offsets added at the end. Every world-space point projected
onto the screen goes through this. The result is left in `(AX, BX)`
for the caller to draw.

**Two things about the arithmetic.**

`imul word [addr]` is **signed multiply** — the game's coordinates and
trig values are both signed. The result lands in `DX:AX` (a 32-bit
value split across two registers), but this routine only reads `AX`,
throwing `DX` away. This is safe here because the scale factor of the
trig values (they range from `-64` to `+64`) times world coordinates
(bounded by the map size) never overflows a 16-bit word.

`mov cl, 6 / sar ax, cl` is **arithmetic shift right by 6**, which is
signed divide by 64. The 8086 cannot shift by a constant other than 1
without loading the count into `CL` first; loading `CL := 6` then
`sar ax, cl` costs 4 cycles vs a real `div` at 80+ cycles. And why 64?
Because the trig values are stored as `sin/cos * 64` — that scale
factor is baked into the matrix and the division cancels it back out.

This is **fixed-point arithmetic**: numbers with an implicit decimal
point that both the storer and the reader agree on. The game uses `/
64` (six bits below the point) for its trig values, and it works
because the resulting range fits comfortably in a word. No floating
point needed, no floating-point unit needed (the 8086 had none), no
precision lost that the game can notice.

**The transferable lesson.** A rotation is two multiplies, two more
multiplies, two adds and two shifts — nine instructions worth of
actual work, wrapped in bookkeeping. Every 3D engine before the
mid-1990s did this in integer or fixed-point arithmetic because the
processors of the day had no floating-point hardware. The idiom is
alive today anywhere floating point is undesirable: DSP code,
embedded systems, financial software, video codecs. **Choosing a
scale factor that divides out cleanly to a shift** is the same trade
a modern programmer makes when they pick a 32-bit fixed-point
representation for a game with reproducible physics — the
representation makes the arithmetic exact and cheap.

**The camera matrix itself** is recomputed every frame by
`update_camera_transform` at `0x4EDA`, which calls `sin_deg` and
`cos_deg` on the current `camera_roll` and writes the results into
`camera_matrix_sin` and `camera_matrix_cos`. That is the frame-level
update; `project_point_2d` is the per-point primitive that everything
else builds on.

---

## 8. `spawn_flak` — the PRNG-driven world

**File `0x5517`.** This is what a per-frame update looks like when the
game world is populated *by chance*. The routine is called from
`per_frame_step` every tick and decides whether to spawn a flak burst
(or a light flare, or a fighter):

```nasm
spawn_flak:
    cmp word [flak_next_tick], 0
    je L_05536
    dec word [flak_next_tick]
    jne L_05536
    cmp word [engine_fire_severity], 0
    je L_05536
    sub word [engine_fire_severity], 4
    mov word [flak_next_tick], 0x64
L_05536:
    mov si, 0x51dd              ; the object pool
L_05539:
    cmp word [si + 0xa], 0      ; type byte 0 = free slot
    je L_05549                  ; found one
    add si, 0x14                ; slot is 14 bytes
    cmp si, 0x536d              ; walked past the end
    jne L_05539
    ret                         ; no free slot, nothing to spawn
```

**Two counters and a walk.** `flak_next_tick` counts down between
spawn attempts — its value at reset is `0x64` (100 ticks, about 5.5
seconds at 18.2 Hz). When it reaches zero, the routine falls through
to the walk that looks for a free object slot in the 20-slot pool at
`0x51DD`. If every slot is full, the routine bails out. Every 100
ticks, `engine_fire_severity` also bleeds down by 4 — a slow decay,
because engine fires are supposed to worsen over time and this is the
brake.

Finding a free slot, the code decides what to put in it:

```nasm
L_055B2:
    call prng_step
    and al, 3                   ; four possibilities
    mov byte [0x5501], al
    db 0x8A, 0xD8, 0x32, 0xFF   ; mov bl, al | xor bh, bh
    mov bl, byte [bx + visible_tiles]
    cmp bl, 0xd
    je L_055CC
    cmp bl, 0xe
    jne L_055D8
L_055CC:
    mov word [engine_fire_severity], 8
    mov word [flak_next_tick], 0x64
L_055D8:
    test bl, 0x80
    je L_055E9
    mov word [engine_fire_severity], 8
    mov word [flak_next_tick], 0x64
L_055E9:
    test bl, 0x40
    je L_055F4
    mov word [engine_fire_severity], 0
```

**`prng_step` is the LFSR at `0xE366`** — the 8-bit random source
described in doc 02. It writes into `AL` a new byte from the state
table. `and al, 3` masks it to values 0..3 — a **modulo-4** operation,
because the bottom two bits of any number naturally form its remainder
when divided by 4. This is the fastest possible way to pick one of
four choices. The same trick masking with `and, 7` gives 0..7, `and,
0x1F` gives 0..31, and so on: **`x & (2^N - 1)` is `x mod 2^N`, in one
instruction**.

The four possibilities index into `visible_tiles` — a small array
describing what's below the plane right now. Each tile carries flags
in its high bits: `0x40` means "flak-suppressing radar hole", `0x80`
means "flak-heavy target zone", and specific values (0xD, 0xE)
indicate specific city types. Depending on which flags are set, the
routine either raises engine fire severity, resets the next-tick
counter, or clears the fire severity.

**This is how the intelligence report matters.** When the pre-mission
briefing said "RADAR HOLE THROUGH BRUSSELS", it was OR-ing `0x40`
into the tile byte for that city (see `pick_radar_hole` at `0xA19`).
Now, when the plane flies over that tile, `spawn_flak` reads that bit,
finds the `0x40` flag set, and *clears* the engine fire severity —
the radar hole shields the plane. The intelligence report and the
per-frame spawner touch the same bit of memory, without any
intermediate abstraction. **The map is the state**, and the code
reads its own annotations.

**The transferable lesson.** Randomness is a *tool for spreading
work out over time*. A world that spawns things every frame is a
world with too much stuff in it; a world that spawns nothing is
boring. The formula "on every frame, run the LFSR, mask to a small
number, and use that number as an index" is the same shape as every
particle system, every enemy AI's decision loop, and every
loot-drop table since. The interesting design decision here is not
that the game rolls dice — it is *which* piece of state the roll
looks at. `visible_tiles` is where the game and the world meet, and
the code goes there because that is where the answer is.

---

## 9. `check_flight_conditions` — the crash chain

**File `0x0FBF`.** Doc 01 listed the seven ways the aircraft can die.
This routine handles three of them, and its shape is worth reading:

```nasm
check_flight_conditions:
    cmp word [distance_travelled], 0x200
    jg L_0101E
    mov ax, word [roll]
    cmp ax, strict word 0
    jl L_00FD1
    neg ax
L_00FD1:
    shl ax, 1
    shl ax, 1
    add ax, word [distance_travelled]
    jl L_0101F
    jne L_00FFB
    cmp byte [damage_flag], 0
    jne L_0101F
    cmp word [selector_b], 2
    jne L_01028
    cmp word [distance_step_counter], 0xc
    jb L_0101E
    mov word [end_run_reason], 4
    jmp end_run
L_00FFB:
    db 0x32, 0xFF                       ; xor bh, bh
    mov bl, byte [engine_status_3]
    cmp byte [bx + 0xd44], 0
    je L_0101E
    mov bl, byte [engine_status_1]
    cmp byte [bx + 0xd44], 0
    je L_0101E
    cmp word [damage_grace_timer], 0
    je L_0101F
    dec word [damage_grace_timer]
L_0101E:
    ret
L_0101F:
    mov word [end_run_reason], 3
    jmp end_run
L_01028:
    mov word [end_run_reason], 2
    jmp end_run
```

**Three crash reasons chained on a shared computation.** The routine
runs every frame while the plane is in flight. The first branch is
the take-off gate: if the plane has travelled less than `0x200`
units, none of these checks apply — you cannot crash on take-off from
insufficient distance.

Otherwise: read `roll`, take its absolute value with a compare and
`neg` (there is no `abs` instruction on the 8086, so *branch on sign
and negate if negative* is how it is done), multiply by 4, add
`distance_travelled`.

The rest is a decision tree on the result:

- **Value negative** — `jl L_0101F`, end run with **reason 3**
  (LOW ALTITUDE CRASH).
- **Value zero and `damage_flag` clear and `selector_b == 2` and
  `distance_step_counter >= 12`** — end run with **reason 4** (UNABLE
  TO COME OUT OF STALL).
- **Value zero and `selector_b != 2`** — end run with **reason 2**
  (SHOT DOWN IN ACTION).
- **Value positive** — check the two-engine damage state: if both
  `engine_status_1` and `engine_status_3` point into the damage
  table at `0xD44` at non-zero entries, decrement the grace timer;
  when it hits zero, end run with **reason 3** again.

**Two things worth pausing on.**

`cmp byte [bx + 0xd44], 0` is a **table lookup for the crash rule** —
`BL` is set to `engine_status_1` (a small number 0..17), and the
routine uses it as an index into the table at `0xD44` to see whether
that engine state currently counts as "damaged enough". The engine
status byte is a compact number; the table expands it to the full
per-state effect. This is the *decode step* of the classic
state-machine idiom: state number in one place, action in a table.

`damage_grace_timer` is the classic **debounce**: when both engines
enter their damaged states, the timer starts counting down at `0x64`
(100 frames, about 5.5 seconds). If they recover before it reaches
zero, the plane lives; if they stay damaged, the plane crashes. **The
game gives you five seconds to react to a two-engine failure.** That
number is not in the manual; it is in the code.

**The transferable lesson.** A chain of crash conditions is usually
written as a chain of independent tests: *stall? crash. shot? crash.
low? crash.* This routine does something subtler — it *computes one
value*, then decides which crash reason that value indicates. The
same computation feeds all three checks, and the branches at the
bottom are cheap comparisons rather than repeated calculations. When
several conditions share a numeric ingredient (here, roll-squared
plus distance), extract it once and switch on the result. Modern
languages hide this behind pattern matching; the shape is the same.

---

## What was remarkable in 1984

Several things in this file that are worth naming — some of them
because they are impressive, some because they are ordinary and
would be misread if not called out.

### A bytecode interpreter for the UI

[Section 6](#6-draw_display_list--a-bytecode-interpreter-in-eight-instructions)
is the standout piece of design in the file. Every game does menus;
this game does them with a byte-stream language that the interpreter
walks with an eight-instruction loop. The 34 call sites to
`draw_display_list` are the game's UI, expressed as data rather than
code. This is not routine for 1984 — most games of the era
hard-coded their layouts.

### One matrix multiply for the whole 3D world

Everything the flight phases display goes through
`project_point_2d`. The scenery, the enemies, the terrain, the
target, the sights — all projected through the same 30-line
routine, with `render_object_pool` walking 20 slots and dispatching
per-type renderers over each visible one. That is the entire 3D
system.

For scale: modern game engines have vertex shaders. This game has
one function. It is what "3D graphics" looked like before there was
enough silicon to build a pipeline.

### The music sequencer is entirely in the ISR

The whole music synthesis path — reading the note stream,
programming the PIT, cycling to the next note, looping — happens
inside `timer_isr`. There is no music thread, because there are no
threads; there is no `update_music()` in the main loop. The
programmer has hooked the same interrupt the OS uses for its own
clock and made it do double duty. This was an expected trick of the
era but done well here: the ISR is short, it takes exactly one lock
(with `cli` at the top), and it does not touch any state the main
code writes to.

### And several things that are completely ordinary

**Writing directly to CGA memory** at `0xB800`. Every fast game did.
The BIOS video calls were too slow to use per frame.

**Replacing the BIOS keyboard handler.** ParaTrooper does the same,
Karateka does the same. It was the only way to read a *held* key
rather than a *last-pressed* key.

**Fixed-point arithmetic with a scale factor of 64.** The 8086 had
no floating-point hardware; every game with any 2D rotation did the
same trick. What makes this one worth naming is how neatly it
chose 64 — the shift that undoes it is a *single* `sar ax, cl`
after the multiply, which is fast on this processor.

These are called out as *typical* precisely so the two items above
— the display-list interpreter and the tightness of the ISR — stand
out.

---

## What a programmer today can take from it

**Snapshot-then-clear survives.** The `main_loop` CLI/STI pattern is
what lock-free queues do under a different name. When one producer
and one consumer share a variable and the producer runs on its own
schedule, the consumer's job is to atomically move the value
somewhere private and clear the shared slot. Do everything else from
the private copy.

**Extended-precision arithmetic is a chain of carries.** The 8086's
`add` and `adc` pair lets you build 24-bit, 32-bit or 96-bit
integers out of 16-bit registers, one word at a time. Every modern
processor exposes the same primitive, and every big-integer library
uses it. `integrate_heading` is a compact worked example of the
idiom.

**A tiny bytecode is nearly always worth it.** Every screen in this
game is a display-list program, and the interpreter is eight
instructions. When the *shape* of the operation is fixed but the
*parameters* vary, a data-driven interpreter is smaller and clearer
than a matching amount of hand-written code — HTML, PostScript,
Lua, every game engine's scene format is the same idea.

**Choose a scale factor that divides out to a shift.** Fixed-point
arithmetic makes rotations exact and cheap, but the choice of scale
factor matters. `project_point_2d` uses 64 (six bits) because the
multiply-then-shift-by-six exactly cancels, and six is small enough
that `sar ax, cl` is one instruction after loading `CL`. A modern
game with reproducible physics makes the same trade with a 32-bit
fixed-point representation and shifts of 16 or 20.

**Randomness is a scheduling tool.** `spawn_flak` does not roll to
decide *if* something happens — it rolls to decide *what* happens
*when* the game has already decided this is the frame something can
happen. Timers gate the roll; the roll picks the shape. Every
particle system, every enemy spawner, every loot table since works
the same way.

**The map is the state.** `pick_radar_hole` in the intelligence
report writes a bit into the same `visible_tiles` table that
`spawn_flak` reads at flight time. There is no messaging layer, no
event queue, no "briefing_data" object — the briefing is written
directly into the flight world. This is *not* a good pattern in a
large program (it makes reasoning about state changes hard), but in
5,690 instructions with no compiler and no other author, it works.
The lesson is that global shared state is not always wrong; the
question is always whether the confusion it prevents costs more than
the confusion it enables.

---

## Reading the rest

`recovered/dam-busters-named.asm` is about 11,700 lines and covers
the whole 65,028-byte image. It is navigable in the same shape as
ParaTrooper's:

- **Named labels** for every routine (`entry`, `main_loop`,
  `clamp_map_position`, etc.); `%define` block at the top for every
  global address.
- **Data rows** carry both the file offset and any semantic name in
  a trailing comment.
- **`db` lines with a comment** are instructions pinned to a fixed
  byte encoding (see the `xor dx, dx` in `clamp_map_position`); the
  comment names what the byte sequence does.
- **Text is emitted as text**, not hex — grep for anything readable.

The honest limits are listed at the end of
[02-architecture.md](02-architecture.md#what-is-still-unknown). The
sprite formats and the `jmp bx` at `0x6F53` are the largest things
still open; both need a runtime hook to settle, which is a different
kind of work from the static reading walked through here.
