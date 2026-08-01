# Zaxxon — the code

*Document three of three. Before this: [01 — the game](01-the-game.md) and
[02 — architecture](02-architecture.md), which explains the memory layout, the
coordinate system and the data formats this document assumes.*

This is a walk through the program in the order it runs, with the routines
quoted from `recovered/zaxxon.asm`. Every listing is real: it assembles, as
part of the whole file, to bytes identical to `ZAXXON.COM`.

Addresses are given as **file offsets** — `file 0x0848` — because that is what
you can look up. The program's own addresses are 256 lower, for the reason
explained in
[document two](02-architecture.md#the-stub-and-why-it-matters-more-than-it-looks).

---

## Contents

- [Reading assembly, if you never have](#reading-assembly-if-you-never-have)
- [Start-up](#start-up)
- [The title screen](#the-title-screen)
- [The outer loop: one player's turn](#the-outer-loop-one-players-turn)
- [The frame](#the-frame)
- [Flying the aircraft](#flying-the-aircraft)
- [Moving everything else](#moving-everything-else)
- [Spawning](#spawning)
- [Drawing, and the order things are drawn in](#drawing-and-the-order-things-are-drawn-in)
- [Hitting things](#hitting-things)
- [Fuel](#fuel)
- [The score](#the-score)
- [What transfers](#what-transfers)

---

## Reading assembly, if you never have

Six ideas will get you through everything below.

**A register is a variable inside the processor.** The 8086 has eight of them,
sixteen bits each: `AX BX CX DX SI DI BP SP`. They are not named for what they
hold, they are named because there are eight. Some have habits — `CX` is what
loop instructions count down, `SI` and `DI` are what copy instructions read
from and write to — and the habits are enforced by the instruction set, not by
convention.

**`mov` is assignment, backwards.** `mov ax, 5` means `ax = 5`. Destination
first, always.

**Square brackets mean "the memory at".** `mov ax, [0x70]` reads the word at
address `0x70`. `mov ax, 0x70` puts the number 112 in `AX`. That one character
is the difference between a pointer and its target, and it is the single most
common thing to misread.

**A segment register decides which memory.** An 8086 address is a 16-bit
offset inside a 64 KB *segment*. `[0x70]` means offset `0x70` in the segment
`DS` points at; `[cs:0x70]` means offset `0x70` in the code segment. In this
program those are two completely different places —
[document two](02-architecture.md#where-everything-lives) has the map.

**Flags remember the last comparison.** `cmp al, 3` subtracts and throws the
answer away, keeping only the flags; `ja` ("jump if above") then acts on them.
`jae`/`jb` are the carry flag, which routines here also use deliberately as a
one-bit return value: `stc` means "yes", `clc` means "no".

**A `call` pushes a return address; `ret` pops it.** Which is why you will see
`push si` immediately followed by `ret` used as a *jump* to whatever `SI`
holds. That is not a trick this program invented; it is what you do when you
have no "jump to a computed address" instruction and three bytes to spare.

## Start-up

`file 0x0000` is a jump over the banner. `file 0x0080` is the entry stub, both
covered in [document two](02-architecture.md#getting-the-program-to-start).
What follows is the real beginning, at `file 0x0100`:

```nasm
    mov ax, 0x560                   ; patched by the stub to CS + 0x520
    mov ds, ax
    mov ss, ax
    mov sp, 0x6942
    mov ax, 0xb800
    mov es, ax                      ; ES -> the CGA framebuffer, permanently
    call set_video_mode             ; file 0x014C
    mov di, 0
    mov cx, 0x67b2
    call fill                       ; zero every variable the game has
```

Note what is *not* here: no memory allocation, no checking that the video card
exists, no error handling of any kind. The program assumes a machine and gets
one. `mov cx, 0x67b2` zeroes 26,546 bytes in one `rep stosb` — every variable,
every buffer, the object table, all of it, because DOS does not clear memory
and the game would otherwise start with whatever the last program left.

Then the timer install, then:

```nasm
    call read_joystick              ; file 0x0247
    jae have_stick
    mov al, 0                       ; no joystick
    jmp store
have_stick:
    mov word [3], bx                ; remember its centre position
    mov al, 0x20                    ; the "joystick present" flag bit
store:
    mov byte [0], al
```

The joystick test (`file 0x0247`) is a good example of hardware from before
there were drivers:

```nasm
    xor bx, bx
    mov dx, 0x201
    out dx, al                      ; writing anything starts the measurement
poll:
    in al, dx
    test al, 1                      ; has the X axis finished yet?
    je x_done
    inc bl                          ; no -- count another loop
    js timeout
x_done:
    test al, 2                      ; has the Y axis finished?
    je y_done
    inc bh
    js timeout
y_done:
    and al, 3
    jne poll                        ; keep going until both are done
    clc
    ret                             ; carry clear: a joystick answered
timeout:
    stc
    ret
```

The joystick port has no digital value to read. Each axis is a potentiometer
wired to a one-shot: you write to the port to start it, and then you *count how
long* the corresponding bit stays set. The count is the position. So the
routine's inner loop is the measuring instrument, and the units are "how many
times round this loop" — which means the reading depends on how fast your
processor is. `js timeout` catches the case where nobody is holding a stick and
the bit never clears.

This is worth sitting with for a moment, because it is the most alien thing in
the file. There is no abstraction between the program and the hardware, so the
program's own speed is part of the measurement.

## The title screen

`file 0x02C0` onwards. The structure is a loop between two screens:

```nasm
    in al, 0x61
    or al, 0x60
    out 0x61, al                    ; make sure the speaker is off
attract:
    call clear_screen
    mov bx, 0x6a8
    call draw_text_list             ; the title
    call wait_for_choice
    jb start_game
    call clear_screen
    call draw_scores
    mov bx, 0x6d8
    call draw_text_list             ; the instructions screen
    call wait_for_choice
    jae attract
start_game:
```

`draw_text_list` (`file 0x020C`) walks a small format that is worth showing,
because a beginner will meet the idea again in every file format they ever
read:

```nasm
    mov al, byte [cs:bx]            ; colour
    cmp al, 0xff
    je done                         ; 0xFF ends the list
    mov byte [2], al
    inc bx
    mov dx, word [cs:bx]            ; row and column, packed into one word
    inc bx
    inc bx
    call draw_string                ; then the string, ending in 0x00
    jmp start
```

A list of records, each `colour, row, column, text, 0`, and `0xFF` where the
next record would be. There is no count and no length field anywhere: the
terminator carries that information. The strings themselves are in the file in
plain text, which is how the recovered source can print them:

```nasm
    db 0x03, 0x10, 0x0C
    db 'Z A X X O N'
    db 0x00, 0x02, 0x07, 0x0E
    db 'c 1984 Sega Enterprises Inc.'
    db 0x00, 0xFF
```

`wait_for_choice` (`file 0x04EE`) is the part that decides one or two players:

```nasm
    mov cx, 0xb4                    ; 180 attempts
try:
    push cx
    call wait_for_tick              ; file 0x017D
    mov ah, 1
    int 0x16                        ; has a key been pressed?
    je no_key
    mov ah, 0
    int 0x16                        ; take it
    cmp al, 0x31                    ; '1'
    jl no_key
    cmp al, 0x32                    ; '2'
    jg no_key
    sub al, 0x30
set_players:
    and byte [0], 0xf0
    or byte [0], al                 ; the low nibble of [0] is the player count
    jmp chosen
```

180 iterations of "wait for a clock tick, then look for a key" is a ten-second
timeout built out of the only clock available. `wait_for_tick` is:

```nasm
    xor ax, ax
    int 0x1a                        ; CX:DX = ticks since midnight
    cmp dl, byte [5]
    je wait_for_tick                ; unchanged? go round again
    mov byte [5], dl
    ret
```

This is a **spin-wait**, and it is the reason the emulator that acts as this
project's referee had to be taught to answer `INT 1Ah` with a number that
changes. Answering with a constant is not "no effect"; it is an infinite loop.

## The outer loop: one player's turn

`file 0x0336`. Once the players are chosen, this runs per turn:

```nasm
turn:
    call clear_screen
    call draw_status_line
    test byte [0], 0x10             ; which player?
    jne player_two
    mov bx, 0x6f4                   ; "Player 1 Your Turn"
    jmp announce
player_two:
    mov bx, 0x707                   ; "Player 2 Your Turn"
announce:
    mov dx, 0xd0f
    call draw_string
    mov cx, 0x36
    mov byte [0x25], 1              ; start a sound effect
    call wait_ticks
    call script_step                ; file 0x08B4 -- set the scene up
    jae not_first
    call clear_play_field
    ...
```

`test byte [0], 0x10` is how the whole program handles two players. Bit 4 of
the flags byte says whose turn it is, and one routine (`file 0x05D9`) turns it
into a pointer:

```nasm
    test byte [0], 0x10
    jne second
    mov bx, 0x4e8
    ret
second:
    mov bx, 0x4f4
    ret
```

Two blocks of pointers, twelve bytes apart, and everything else in the game
says `call this; mov bx, [cs:bx + n]` to reach *this player's* score, script
position, fuel and so on. It is the 1984 equivalent of passing a context
object, and it costs three instructions.

## The frame

`file 0x038B`. This is the game, and it is sixteen calls and two exits:

```nasm
frame:
    call script_dispatch            ; 0x0848  advance the scene
    call sound_tick                 ; 0x1FAD
    call read_controls              ; 0x11EE  move the player
    call sound_tick
    call move_objects               ; 0x1071
    call spawn                      ; 0x173E
    call check_player_hit           ; 0x1DC5
    jb  player_died
    call sound_tick
    call draw_objects               ; 0x0FF0
    call after_draw                 ; 0x1BA7
    call sound_tick
    call flush_to_screen            ; 0x05BA
    call sound_tick
    call draw_status_line           ; 0x0E31
    call sound_tick
    call burn_fuel                  ; 0x13FF
    jb  player_died
    test byte [1], 0xff             ; did the score change?
    je  frame
    call draw_score                 ; 0x01DD
    call extra_life_check           ; 0x045E
    call draw_lives                 ; 0x0534
    jmp frame
```

Two things are worth noticing about the shape of it.

**`sound_tick` is called six times per frame, between everything.** The sound
hardware has no queue: a tone plays until you change it. If the program only
touched it once per frame, every effect would last exactly one frame. Sprinkling
the tick through the loop gives the sound engine six chances per frame to
advance, which is as close to a timer-driven mixer as this gets.

**There is no wait anywhere.** No vertical-retrace sync in the loop, no frame
counter, no delay. The loop runs as fast as the processor will let it. That is
the single biggest difference between this program and anything written today,
and it is the one thing a port cannot copy —
[document two](02-architecture.md#time) has the consequence.

The scene dispatcher (`file 0x0848`) is the top of the state machine:

```nasm
    call this_player                ; file 0x05D9
    mov bx, word [cs:bx + 4]        ; -> this player's script state
    mov al, byte [bx + 2]           ; a sub-step counter
    mov bp, word [bx]               ; the script position
    mov dx, bp
    add bp, 0x75e                   ; the table of 22 scenes
    jmp word [cs:bp]
```

`jmp word [cs:bp]` — jump to the address stored in the table. This one
instruction is why the first pass over this program recovered so little: a
disassembler following control flow has nowhere to go from here. Reading the
table is what
[document two](02-architecture.md#the-level-script) describes.

The scene routines themselves are short and all built the same way. Here is a
whole one (`file 0x0AFF`):

```nasm
    mov bp, 0x3ab3                  ; which background section to use
    mov word [9], 0x1e47            ; the per-frame routine for this scene
    mov byte [0xb], 0               ; a scene flag
    jmp common_setup                ; file 0x0B51
```

`mov word [9], 0x1e47` stores a **function pointer in a variable**, called
later as `call word [9]`. The scenes differ in three numbers: which artwork,
which behaviour, one flag. Everything else is shared.

## Flying the aircraft

`file 0x11EE`. First it reads the controls, from whichever device is in use:

```nasm
    test byte [0], 0x20             ; joystick?
    je keyboard
    jmp joystick
keyboard:
    call read_keys                  ; file 0x11B0
    mov bx, 0xa0                    ; the player's object
    and ax, strict word 0xf
    cmp al, 8                       ; 8 means "no direction"
    jne move
    jmp no_move
```

`read_keys` is a lookup, not a chain of comparisons:

```nasm
    mov ah, 1
    int 0x16
    je none
    call get_key
    cmp ax, 0x11b                   ; Escape
    jne not_escape
    call pause_or_quit
not_escape:
    cmp al, 0x20                    ; space -- fire
    jne not_fire
    mov byte [0x3f], 1
    jmp none
not_fire:
    cmp ax, 0x5200                  ; below the arrow keys?
    jge none
    cmp ax, 0x4600                  ; above them?
    jle none
    mov al, ah
    sub al, 0x47                    ; scancode 0x47..0x51 -> 0..10
    mov bx, 0x10e3
    xlatb                           ; -> a direction 0..8
    ret
none:
    mov al, 8
    ret
```

`xlatb` is a whole switch statement in one byte of machine code: it replaces
`AL` with the byte at `[BX + AL]`. The table at `cs:0x10E3` is eleven bytes
long — `07 02 05 08 03 08 01 08 06 00 04` — and it turns the numeric-keypad
scancodes into the game's eight directions plus 8 for "centre". Note the three
`08`s: those are the keys in the arrow block that are not arrows.

Then the movement itself, which is again a table (`cs:0x12A7`):

```nasm
    mov si, 0x12a7
    mov cx, ax
    shl al, 1
    add si, ax
    mov ax, word [cs:si]            ; (dx, dy) for this direction
    add byte [bx + 2], al
    add byte [bx + 3], ah
```

and then the clamps that define where the player may be:

```nasm
    cmp byte [bx + 2], 6            ; left edge
    ja  check_right
    je  vertical
    mov byte [bx + 2], 6
    jmp vertical
check_right:
    cmp byte [bx + 2], 0x2e         ; right edge
    jbe vertical
    mov byte [bx + 2], 0x2e
vertical:
    mov al, 0x28
    add al, byte [bx + 4]           ; the floor, offset by altitude
    cmp byte [bx + 3], al
    ...
    mov al, 0x3e
    add al, byte [bx + 4]           ; the ceiling, offset by altitude
```

**The vertical limits move with the altitude.** `[bx+4]` is how high the
aircraft is flying, and both the top and the bottom of its allowed range shift
by that amount. That is the isometric projection expressed as two additions:
climbing does not change the picture's size, it changes where on the screen the
same picture is allowed to be. Everything the player perceives as
three-dimensional comes out of those two `add` instructions.

The bank angle — which of the four aircraft pictures to draw — is derived from
the altitude, not from the direction of travel:

```nasm
    mov al, byte [bx + 4]
    shr al, 1
    shr al, 1                       ; altitude / 4
    cmp al, 3
    jle ok
    mov al, 3
ok:
    mov byte [bx], al               ; sprite kinds 0..3
```

## Moving everything else

`file 0x1071`, and it is the whole physics engine:

```nasm
    mov bx, 0xac
    mov cx, 0x1d                    ; 29 objects
each:
    cmp byte [bx], 0xff
    je  next                        ; empty slot
    mov si, word [bx + 1]
    and si, strict word 7           ; the direction byte, 0..7
    shl si, 1
    add si, 0xff5
    mov ax, word [cs:si]
    add byte [bx + 2], al
    add byte [bx + 3], ah
next:
    add bx, 6
    loop each
```

Thirteen instructions to move everything on screen. There is no acceleration,
no per-object speed, no floating point — an object has one of eight velocities,
picked once when it spawns, and it keeps it until it dies. The sixteen bytes at
`cs:0x0FF5` are the entire vocabulary of motion in the game.

This is the pattern worth taking away: **a fixed table of behaviours beats a
field per object when memory is the constraint.** Three bits of direction give
eight movements for the price of nothing; a `dx`/`dy` pair per object would
cost two bytes each, which on 29 objects is 58 bytes — more than three whole
objects.

## Spawning

`file 0x173E`, run once per frame. It is a two-branch routine: mostly it adds
an enemy from the current wave, and occasionally it does something specific to
the scene.

```nasm
    mov bx, 0xf4
    cmp byte [bx], 0xff             ; is this slot free?
    je  try_spawn
    add bx, 6
    cmp byte [bx], 0xff             ; or the next one?
    je  try_spawn
    ret                             ; both busy -- nothing to do
try_spawn:
    test byte [0x6d], 0xff          ; is spawning enabled?
    jne  from_wave
    jmp aimed_shot
from_wave:
    call random                     ; file 0x20BD
    and al, 0xf
    cmp al, 0xc
    jge  ret                        ; 12..15: spawn nothing this frame
    mov ah, 6
    mul ah
    mov di, 0xac
    add di, ax                      ; a random one of the first twelve objects
    mov al, byte [di]
    cmp al, 6
    jne not_kind_6
    ...
```

Read that carefully, because it is not what it first looks like. The random
number does not choose *what* to spawn — it chooses **which existing object to
copy a position from**. The new object is placed relative to one already on
screen, and its kind depends on that object's kind. So enemy fire comes from
whatever is currently in the fortress, which is why the pattern feels related
to the scenery rather than sprinkled over it.

The other branch (`file 0x1812`) is the one that aims:

```nasm
    mov ax, 0x4a
    sub al, byte [0xa2]             ; 0x4A minus the player's x
    cmp al, byte [0xa3]             ; compare with the player's y
    jg  use_y
    mov al, byte [0xa3]
use_y:
    sub ah, al
    add al, byte [0xa2]
    add ah, byte [0xa3]
    mov word [bx + 2], ax           ; a position on the player's diagonal
    mov al, byte [0xa4]
    mov ah, 0x30
    mov word [bx + 4], ax           ; at the player's altitude
    mov word [bx], 0x60e
```

It places the shot **at the player's own altitude**, on the diagonal the player
is on, at the edge of the field. That is why changing height as a turret comes
into range works: the shot was aimed when it was fired and does not correct.

## Drawing, and the order things are drawn in

`file 0x0FF0`. In an isometric world, whether an object is in front of another
is decided by position, so the draw order matters and cannot be fixed:

```nasm
    mov bx, 0xa6
    cmp byte [bx], 0xff
    je  no_shadow
    call draw_one                   ; the shadow first, under everything
no_shadow:
    mov bx, 0xac
    mov al, byte [0xa2]             ; the player's x
    mov ah, byte [0xa4]             ;   and altitude
    add al, 4
    mov cx, 0x17                    ; 23 objects
    xor bp, bp                      ; a count of deferred objects
each:
    push ax
    cmp byte [bx], 0xff
    je  skip
    cmp bx, 0xf4
    jb  compare
    add al, 0xf8
compare:
    cmp al, byte [bx + 2]           ; is this object in front of the player?
    jae later
    cmp byte [bx + 4], ah           ; and above them?
    ja  later
    pop ax
    push bx                         ; defer it: stack it for afterwards
    inc bp
    jmp next
later:
    push bx / push cx / push bp
    call draw_one                   ; draw it now
    pop bp / pop cx / pop bx
skip:
    pop ax
next:
    add bx, 6
    loop each

    push bp
    mov bx, 0xa0
    call draw_one                   ; then the player
    call sound_tick
    pop cx
    cmp cx, 0
    je  done
deferred:
    pop bx                          ; and finally everything that was in front
    push cx
    call draw_one
    pop cx
    loop deferred
done:
```

**The stack is the sort.** Objects that should appear in front of the player
are pushed rather than drawn; the player is drawn; then the stack is unwound
and they are drawn on top. There is no sorting algorithm, no comparison
function, no temporary array — just a partition into "behind" and "in front",
which is all a painter's algorithm needs when there is exactly one thing in the
middle. It costs one `push` per deferred object.

`draw_one` (`file 0x1098`) does three things: clip, draw, and stamp the
collision grid:

```nasm
    call visible                    ; file 0x0C8C -- and retire it if not
    jae done
    push bx
    call draw_sprite                ; file 0x0CC3 -- the dispatcher
    pop bx
    mov dl, byte [bx + 2]
    or  dl, byte [bx + 3]
    mov al, byte [bx + 3]
    and al, 0xfc
    mov ah, 0xa
    mul ah                          ; (y & ~3) * 10
    mov bl, byte [bx + 2]
    mov bh, 0
    shr bx, 1                       ;   + x / 2
    add bx, ax
    add bx, 0x62b2                  ; -> the coarse grid
    mov al, 0x80
    or  byte [bx], al               ; a 3 x 3 stamp
    or  byte [bx + 1], al
    or  byte [bx + 2], al
    or  byte [bx + 0x28], al
    ...
```

The clipping routine that runs first is also the object's lifetime:

```nasm
    cmp byte [bx + 2], 0            ; off the left?
    jle retire
    cmp byte [bx + 3], 0x64         ; off the bottom?
    jge retire
    ...
retire:
    mov byte [bx], 0xff             ; free the slot
    clc
    ret
```

There is no separate "is this object dead" pass. An object dies by being drawn
off the edge of the screen, which means the draw routine and the garbage
collector are the same code.

## Hitting things

Two loops, both in `file 0x1DC5`. The first asks whether the player has been
hit:

```nasm
    mov cx, 0xe
    mov si, 0xa0                    ; the player
    mov bx, 0xac
each:
    mov al, byte [bx]
    cmp al, 0xff
    je  next                        ; empty
    cmp al, 8
    je  next                        ; an explosion cannot hit you
    cmp al, 9
    je  next
    call overlap                    ; file 0x1EA3
    jae next
    ret                             ; carry set: you are dead
```

The second asks whether any of the player's shots hit anything, and it is the
same shape with the roles swapped. The test itself:

```nasm
    mov al, byte [bx + 2]
    sub al, byte [si + 2]
    jge  positive
    neg al
positive:
    cmp al, 3
    ja  miss
    mov al, byte [bx + 3]
    sub al, byte [si + 3]
    jge  positive2
    neg al
positive2:
    cmp al, 3
    ja  miss
```

An axis-aligned box, three units each way. It is worth saying plainly why this
is the right answer rather than a compromise: a rectangle is cheaper than the
real outline **and it plays better**. A player who is killed by a pixel they
could not see reads it as the game cheating; a box slightly smaller than the
drawing produces near misses that feel generous. The technique has not changed
since.

The `cmp al, 3` figures also tell you the tuning. Three byte columns is 12
pixels; three half-rows is 6 scanlines. The boxes are wider than they are tall,
which in this projection is what "the same size in world space" looks like.

## Fuel

`file 0x13FF`, called once per frame, and its return value ends the turn:

```nasm
    mov bx, 0xa0
    mov ah, 0
    mov al, byte [bx + 4]           ; altitude
    mov cl, 4
    mul cl
    mov bx, 0x1379
    add bx, ax                      ; -> the altitude bar's tile numbers
    mov cx, 6
draw_bar:
    ...
    call draw_tile_direct           ; file 0x0E82 -- straight to the screen
    ...
    dec byte [0x67]                 ; the fuel countdown
    jne  still_flying
    test byte [0x68], 0x80
    je   normal_rate
    mov byte [0x67], 0x14           ; a slower drain in one game state
    jmp  drain
normal_rate:
    mov byte [0x67], 3              ; otherwise one cell every three frames
drain:
    mov bx, 0x57
    mov ax, 0xf
    sub al, byte [0x66]             ; how many cells are left
    add bx, ax
    inc byte [bx]                   ; advance this cell to its next picture
    push bx
    call redraw_gauge
    pop bx
    cmp byte [bx], 0x5d             ; the last picture in the sequence
    jb   still_flying
    dec byte [0x66]                 ; that cell is gone
    ...
    cmp byte [0x66], 0
    jne  still_flying
    stc
    ret                             ; out of fuel
still_flying:
    clc
    ret
```

The gauge is fifteen cells, and each cell is a byte holding a **tile number**
between `0x55` and `0x5D`. Emptying a cell means incrementing that byte until
it reaches `0x5D`, and drawing the gauge means drawing those fifteen tiles. So
the animation, the state and the display are the same fifteen bytes. There is
no "fuel" number anywhere in the program.

That is a pattern worth noticing, because it is the opposite of how you would
be taught to do it. Modern advice is to keep the model and the view separate;
here they are deliberately the same object, because the machine has 26 KB of
variables and any duplication is a real cost. It works because there is exactly
one view.

Refuelling (`file 0x14ED`) runs the same bytes backwards:

```nasm
    mov al, byte [bx]
    cmp al, 4                       ; did we shoot a fuel drum?
    jne  not_fuel
    push bx
    mov bx, 0x57
    mov ax, 0xf
    sub al, byte [0x66]
    add bx, ax
    mov byte [bx], 0x55             ; that cell back to full
    cmp al, 0
    je   only_one
    inc byte [0x66]
    mov byte [bx - 1], 0x55         ; and the one before it
```

Two cells per drum.

## The score

`file 0x018C`, and it is arithmetic in **binary-coded decimal** — one decimal
digit per byte:

```nasm
    mov byte [1], 1                 ; "the score changed, redraw it"
    push bx / push cx / push di
    call this_player
    mov di, word [cs:bx]
    add di, 6                       ; -> the least significant digit
    mov bx, 0xd4                    ; -> a table of amounts
    shl al, 1
    add bl, al
    jae no_carry
    inc bh
no_carry:
    mov cx, 5
    call add_digit                  ; file 0x01CA
    jae no_ripple
    inc byte [di - 1]
no_ripple:
    dec di
    dec bx
    call add_digit
    jae done
ripple:
    dec di
    mov al, byte [di]
    inc al
    aaa                             ; ASCII adjust after addition
    mov byte [di], al
    jae done
    loop ripple
done:
```

`aaa` is an instruction that exists for exactly this: after adding two
digits, if the result is 10 or more it subtracts 10, adds 1 to `AH`, and sets
the carry flag. So `inc al / aaa` is "add one to this digit and tell me whether
it carried" in two bytes. The loop above it is the carry rippling up through
the digits, exactly as you would do it on paper.

Why store a score as digits at all, rather than as a number? Because the score
is only ever *displayed*, and converting a binary number to decimal on an 8086
means repeated division, which is slow and needs a routine. Keeping the digits
means displaying the score is a copy, and adding to it is this routine. The
game never needs the numeric value for anything, so it never computes it.

That is the general lesson, and it is the one most worth carrying away from
this whole document: **choose the representation that makes the common
operation free.** Everything in Zaxxon is an example — the score is digits
because it is displayed, positions are byte columns because that makes the
address arithmetic one multiply, the fuel gauge is tile numbers because that is
what drawing needs, and directions are table indices because the table is the
physics.

## What transfers

Nearly all of it, and mostly not as assembly technique.

- **Draw off-screen, copy once.** Double buffering. Every graphics API you will
  ever use does this; here you can see the eleven instructions it costs and
  exactly what it buys.
- **A dispatch table instead of a switch.** The sprite table, the scene table,
  the direction table, the effect table. A pointer to a function stored in
  data, so behaviour is data. This is a virtual method table, hand-built.
- **A painter's algorithm needs a partition, not a sort.** When there is one
  thing in the middle, "before" and "after" is enough.
- **Boxes for collision, deliberately.** Cheaper *and* better.
- **Retire objects where you clip them.** One pass, not two.
- **A terminator instead of a count.** Every list in this file ends in `0xFF`
  or `0x00`. Streaming formats still do it.
- **Compress the right unit.** Run-length encoding tiles rather than pixels is
  what turns 48 KB of artwork into 982 bytes; the encoder is ordinary, the
  choice of unit is not.
- **Represent state the way you use it.** The score as digits, the fuel as
  pictures.

And one thing that does *not* transfer, which is just as useful to know: this
program has **no notion of elapsed time**. It does as much work as the
processor allows and calls that a frame. Any port has to introduce a fixed
timestep, and the moment it does, the feel changes — because the original's
difficulty was partly a property of the machine it ran on.

---

*Back to [01 — the game](01-the-game.md), [02 — architecture](02-architecture.md),
or the [README](../README.md).*
