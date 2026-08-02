# Karateka — the fighting

*Document five. [01-the-game.md](01-the-game.md) is what the game is;
[02-architecture.md](02-architecture.md) is how the program is shaped;
[03-the-code.md](03-the-code.md) walks its routines;
[04-porting.md](04-porting.md) is what rebuilding it would take.*

The other four documents all end at the same wall: *nothing here has read the
fighting.* This one gets most of the way through it, and the answer is not where
those documents were looking.

**The fighting is not in the executable.** The choreography ships beside it as
**plain text**, in a language the program compiles at load time into a
thirteen-opcode byte code. Every move in the game is a few lines you can read in
a text editor.

---

## Three libraries, in ASCII

```
$ head -6 original/ALLPAL
set_pos,1 12 pal00
inc_x,0
set_tune,0
set_fig,1 0 165
set_fig,47 17 131
end_animation,
```

| | | | |
|---|---|---|---|
| `ALLPAL` | 51 blocks | 125 frames | the player |
| `ALLGAL` | 51 blocks | 105 frames | a second fighter |
| `ALLVAL` | 48 blocks | 63 frames | a third |
| `ALLBAL` | 1 block | — | a level's scenery |
| `ALLCAL` | 2 blocks | — | the cutscenes |

A block is a move. It ends at `end_animation`, and some blocks carry their own
name as a third token on the first line — `pal00`, `gal17`, `val30`. There are
thirty-seven such names in `ALLPAL`, so **naming is a comment, not the index**;
blocks are addressed by ordinal.

```
python tools/read-moves.py --library ALLPAL
python tools/read-moves.py --block pal08
```

## A frame is five commands, and never anything else

```
set_pos,<a> <b> [name]     two numbers, constant through a walk and
                           varying through a strike
inc_x,<n>                  how far the fighter travels this frame
set_tune,<n>               a sound; 0 is silence
set_fig,<id> <x> <y>       a sprite, placed absolutely
set_fig,<id> <x> <y>       and a second one
```

**293 frames across the three libraries and not one exception.** That is worth
stating as a law rather than a habit: a port can parse these files with a
five-line loop and be certain it has not missed a shape.

Two `set_fig` per frame means a fighter is drawn from **two sprites**, not one.
In `pal08` the second is id 47 in every frame while the first changes — one part
is held and the other animates.

## The move index is a shared vocabulary

`pal08`, the forward walk:

```
set_pos,11 12 pal08     inc_x,4    set_fig,2 -4 165    set_fig,47 15 131
set_pos,11 12           inc_x,4    set_fig,3 -4 165    set_fig,47 17 131
set_pos,11 12           inc_x,4    set_fig,7 2 165     set_fig,47 11 131
set_pos,11 12           inc_x,4    set_fig,83 0 165    set_fig,47 13 131
set_pos,11 12           inc_x,4    set_fig,84 -2 165   set_fig,47 14 131
```

Five frames, `inc_x 4` each — twenty pixels forward. And block 8 is twenty
pixels forward in **all three libraries**; block 7 is twenty pixels *back* in
all three.

| index | frames | travel | in PAL / GAL / VAL |
|---|---|---|---|
| 0 | 1 | 0 | the stance |
| 1–6 | 4 | 0 | six strikes — three heights of punch, three of kick |
| 7 | 5 | −20 | step back |
| 8 | 5 | +20 | step forward |
| 12 / 13 | 10 | ∓40 | the long retreat and advance |
| 15 | 8 | +96 | the run |

Thirty-one of fifty blocks share frame count *and* travel between `ALLPAL` and
`ALLGAL`. So **the index is the move and the library is the actor**: something
decides "number 8", and the player's library and the guard's library each supply
their own five frames of it.

That is the direct answer to the question the other documents kept deferring.
*What makes a guard step forward* is move index 8, run out of `ALLGAL`.

## `set_pos` is not a position — it is the pose code the AI reads

`set_pos,11 12` never changes through a walk. Through `pal04`, a strike, it goes
`15 0`, `15 2`, `5 5`, `5 2`. An earlier draft of this document guessed the pair
was reach and height. It is not.

**The first number is a pose code**, copied into a global at the top of every
frame and read by the opponent's decision routine:

```nasm
    mov  si, [0xc3d2]           ; the player's frame cursor
    mov  al, [si + 1]           ; set_pos's first argument
    mov  [0x10c], ax            ; -> the player's pose, which the guard reads
    mov  al, [si + 2]           ; set_pos's second argument
    and  al, 1                  ; one flag bit
    shr  cl, 1                  ; and seven bits of something else
```

Checked against the running game: **207 of 209 in-phase samples** have the pose
global equal to the frame's first byte.

## The byte code, laid out

Compiling gives each library a flat block and an index built by the routine at
image `0x1976`:

```nasm
    lea  bx, [0xc428]           ; the player's compiled byte code
    lea  di, [0xc3d4]           ; the index it is building
    mov  cl, 0x2a               ; forty-two blocks
next_block:
    mov  [di], si               ; record where this block starts
scan:
    cmp  byte [bx+si], 0xff     ; end_animation?
    je   done
    cmp  byte [bx+si], 0x18     ; `loop` is two bytes
    jne  long
    add  si, 2
    jmp  scan
long:
    add  si, 0x11               ; everything else is a seventeen-byte frame
```

Three facts fall out of nine instructions. **A frame is exactly 17 bytes.**
**`loop` is the one command that is not a frame.** And **there are 42 moves** —
`mov cl, 0x2a` — which is exactly the range of the names in the file,
`pal00`…`pal41`. The binary and the text agree without being asked.

Within a frame, the bytes are opcode-then-arguments:

| offset | | |
|---|---|---|
| +0 | `20` | `set_pos`'s opcode — and `0xFF` here means the move is over |
| +1 | | the **pose code** |
| +2 | | one flag bit and seven more |
| +3 | `22` | `inc_x`'s opcode |
| +4 | | the **travel**, signed |

| | player | guard |
|---|---|---|
| byte code | `DS:0xC428` | `DS:0xCE3E` |
| index of 42 blocks | `DS:0xC3D4` | `DS:0xCDEA` |
| current cursor | `DS:0xC3D2` | `DS:0xCDE8` |
| pose | `DS:0x010C` | `DS:0x0110` |
| x position | `DS:0xBCD5` | `DS:0x010E` |

## The fight loop

```nasm
    mov  bx, [0xc3d2]           ; the player's cursor
    cmp  byte [bx], 0xff        ; is the move over?
    jne  play_this_frame
    cmp  word [0x156], 0        ; which chooser?
    je   .human
    call 0x2a49                 ;   the AI
    jmp  .got
.human:
    call 0x205e                 ;   the other one
.got:
    cmp  ax, 0x2a               ; a move number, 0..41
    jb   .ok
    xor  ax, ax                 ;   out of range -> move 0, the stance
.ok:
    shl  ax, 1
    mov  ax, [bx + index]       ; index[move]
    mov  [0xc3d2], ax           ; and play it
```

The guard's half at `0x246B` is the same shape with one chooser, `0x2605`, and
no `[0x156]` test. **`[0x156]` is what lets the attract sequence play itself** —
the same loop, with a routine substituted for the keyboard.

A move that ends immediately re-enters the chooser on the next iteration, which
is why `jmp` at the end of the guard's block goes back to the test rather than
onward.

## The guard's AI

`0x2605`, and it is a decision tree over three inputs:

```nasm
    mov  ax, [0x10e]            ; the guard's x
    sub  ax, [0xbcd5]           ; minus the player's  ->  THE DISTANCE
    mov  [bp+6], ax
    ...
    cmp  word [0x10c], 0x3f     ; is the player's pose above 63?
    jle  .not_that
    mov  ax, 1                  ;   -> move 1
    ret
.not_that:
    cmp  word [bp+6], 0x38      ; is the distance under 56?
    jge  .stand
    mov  ax, 2                  ;   -> move 2
    ret
.stand:
    xor  ax, ax                 ;   -> move 0, the stance
    ret
```

Three questions — *what is the other fighter doing*, *how far away is he*, *what
am I doing* — and a move number out. Under emulation the guard's chooser fires
64 times and returns 19, 0, 5, 9 and 7; the player's returns 30, 15 and 20.

**That is the answer to what makes a guard step forward**, and it is more
specific than the earlier one: the guard steps when the distance crosses a
threshold its own routine names as a constant.

## Moving, and why fighters cannot walk through each other

```nasm
    mov  al, [si + 4]           ; inc_x's argument
    cwde
    add  [0xbcd5], ax           ; the player moves
    cmp  cx, [0x102]            ; clamp to the level's left edge
    ...
    cmp  cx, [0x104]            ; and its right
    ...
    cmp  cx, [0x10e]            ; past the guard?
    jle  .clear
    sub  cx, [0x10e]
    sub  [0xbcd5], cx           ;   give back exactly the overlap
```

`inc_x` is applied to x, clamped to the level bounds at `[0x102]`/`[0x104]`, and
then the overlap with the other fighter is subtracted back out. **38 of the 40
observed moves changed x by exactly the frame's `inc_x` byte**; the other two
are this clamp doing its job.

## The language is compiled, not interpreted

This is the part that was wrong in [03-the-code.md](03-the-code.md) and is
corrected here. That document called the routine at image `0x1364..0x1660` "the
interpreter". It is a **compiler**. Each of its fourteen arms emits an opcode
and parses its arguments with `sscanf`:

```nasm
set_pos:                        ; arm 10, image 0x0157E
    mov  byte [si], 0x14        ; emit opcode 20
    mov  ax, 0xbc9d             ; "%d %d"
    push ax
    call 0x5741                 ; sscanf
```

Read all fourteen arms and the instruction set falls out whole:

| # | command | opcode | arguments |
|---|---|---|---|
| 0 | `set_tune` | 0 | `%d` |
| 1 | `set_bg` | 2 | `%d` |
| 2 | `set_fig` | 4 | `%d %d %d` |
| 3 | `chg_fig` | 6 | `%d %d %d %d` |
| 4 | `do_scr` | 8 | — |
| 5 | `del_fig` | 10 | `%d` |
| 6 | `set_wipe` | 12 | — |
| 7 | `set_nowipe` | 14 | — |
| 8 | `wait` | 16 | `%d` |
| 9 | `init_sal` | 18 | — |
| 10 | `set_pos` | 20 | `%d %d` |
| 11 | `inc_x` | 22 | `%d` |
| 12 | `loop` | 24 | `%d` |
| 13 | `end_animation` | 255 | — |

**The opcode is twice the command index, for thirteen of the fourteen.** That is
not decoration: a doubled opcode is already a word offset, so the runtime can
use it as a jump-table index without shifting. `end_animation` breaks the
pattern because 26 would be a fourteenth table slot and it is not a command, it
is a terminator.

Every row of that table was read out of the arm that implements it — the opcode
from the `mov byte [si], N` it emits, the arity from the format string it hands
`sscanf`. Nothing is inferred.

## The cutscenes are a second dialect

`ALLCAL` uses `chg_fig`, `do_scr`, `wait`, `set_wipe` and barely touches
`set_pos` or `inc_x`. The fight libraries use exactly the opposite half. One
language, two disjoint working vocabularies — direction for a scene, and
choreography for a fight.

The attract sequence proves the reading. `CAL01` in memory reads:

```
set_fig,200 0 185 / set_fig,206 44 185 / set_fig,201 0 112
set_fig,208 178 116 / set_fig,208 262 116 / set_fig,208 92 116
set_fig,163 70 167 / do_scr, / chg_fig,6 164 74 167 / do_scr, ...
```

and the sprite ids arriving at the dispatcher, logged under emulation, are
`200, 206, 201, 208, 208, 208, 163, 164, 165, 166, 167` — the script, line for
line.

## The hit test

Called twice per frame, once for each fighter, and symmetrically:

```nasm
    cmp  word [0xec], 1         ; is the player's frame a striking frame?
    mov  ax, [0x10c]            ; the player's pose
    dec  ax
    dec  ax                     ;   ... minus two
    push word [0xd5b0]          ; the GUARD's seven-bit field
    push word [bp + 4]          ; the distance between them
    push ax
    call 0x43aa                 ; -> 4 means nothing happened
```

**The third argument is the target's stance, not the attacker's.** The guard's
half of the frame passes `[0xd5ae]`, the player's. Attacker's pose, distance,
defender's stance — three numbers in, one out.

`0x43AA` itself is a distance-band lookup:

```nasm
    cmp  byte [bp+4], 2         ; fold the pose into a small class
    jg   .high
    add  byte [bp+4], 3
    jmp  .go
.high:
    sub  byte [bp+4], 3
    je   .go
    sub  word [bp+6], 4         ; a high attack reaches four pixels further
.go:
    mov  si, [bp+8]             ; the defender's stance
    and  word [bp+6], 0xfffc    ; round the distance down to a multiple of four
    mov  bl, [si + class]       ; two tables, indexed by that stance
    mov  dl, [si + reach]
    cmp  word [bp+6], dx
    jl   .miss                  ; too far -> 4
    ...
    add  dx, 0x11               ; and a seventeen-pixel band beyond it
```

The two stance tables and the five outcome tables read out of the data segment
whole:

```
DS:0xE0F8  reach   16 16 16 16 16 16 16 12 16 16 16 12 16 16 12 16 …
DS:0xE112  class    0  1  2  3  4  5  6  7  6  8  9  7  9  9  7  9 …
DS:0xE12C  five ten-byte outcome tables, indexed by class 0..9
```

Every strike wants the fighters **16 pixels apart, or 12 for some stances**, and
connects anywhere in a 17-pixel band beyond that — with the distance first
rounded down to a multiple of four, which is the game's collision granularity.
Classes 3 and 4 return 0 from every table: those stances cannot be hit at all.

The result is `4` for a miss, and `2` or `3` for a connection — the callers test
exactly those two.

## Health, damage, and why the bar refills

```nasm
    mov  ax, [0x116]
    dec  ax                     ; the player loses a point
    test ax, ax
    mov  [0x116], ax
    je   .down
    ...
    add  word [0x126], 3        ; three ticks of regeneration owed
    inc  word [0x124]           ; one more hit taken
    mov  word [0xfc], 1         ; and a flag the chooser reads next frame
.down:
    mov  word [0xf8], 1         ; dead
    mov  word [0x10c], 0x44
    mov  [0xc3d2], [0xc40c]     ; play move 28 -- the collapse
```

| | player | opponent |
|---|---|---|
| hit points | `[0x116]`, starts at **13** (12 or 10 for tougher opponents) | `[0x114]`, starts at 13 |
| hits taken | `[0x124]` | `[0x11E]` |
| regeneration owed | `[0x126]` | `[0x128]` |
| just been hit | `[0xFC]` | `[0xFE]` |

**Both bars refill.** After each hit the loser is owed three ticks; a counter
runs them down and gives a point back, and the whole thing stops when
`[0x114] + [0x116]` reaches **26** — two full bars of thirteen. That is the
mechanism behind the health bars creeping back up between exchanges.

And when an opponent goes down, the player's health is **normalised to 9**:

```nasm
    cmp  word [0x116], 9
    jle  .under
    mov  word [0x116], 9        ; more than nine -> capped
    mov  word [0x124], 0
.under:
    mov  bx, 9
    sub  bx, [0x116]            ; less than nine -> the difference is the damage
    mov  word [0x124], bx
```

So you never carry more than nine of your thirteen points into the next fight,
however cleanly you won the last one.

## Which chooser is the player's

`[0x156]` selects, and the two settings are set in the two obvious places:

```nasm
    mov  word [0x156], 1        ; the attract path, when no key was pressed
    ...
    mov  word [0x156], 0        ; after the game proper starts
```

So **`0x205E` is the human's** and **`0x2A49` plays the demo**. `0x2A49` gives
itself away independently: it computes `[0x10e] - [0xbcd5]`, the distance,
exactly as the guard's AI does. A routine reading a keyboard has no use for
that.

`0x205E` reads no input directly. It branches on reaction flags — `[0xFC]` just
hit, `[0x16C]`, `[0x170]`, `[0x174]` — and then dispatches on the player's own
pose through a sparse switch at `0x228B`, whose arms are where the input is
consumed. **[unresolved]** the joystick routine at `0x425E` — two `in al, dx`
around a counted `loop`, the classic RC-decay timing — has no direct caller
anywhere in the image, so the path from hardware to those flags is not traced.

## The rest of the guard's tree

Beyond the distance test, `0x2605` branches on five more globals:

| | |
|---|---|
| `[0xD5AA]` | an opponent is present at all; 0 means the screen is empty |
| `[0xFA]` | the phase of the fight — 2 means the opponent is leaving |
| `[0xF0]` | a restricted mode: only three replies are possible, 0, 1 and 2 |
| `[0xFE]` | the guard was struck this frame |
| `[0x118]`, `[0x11A]` | **not health** — a two-stage patience timer |

The timers were the one thing this document guessed wrong twice. They count
down from 32 while the player stays beyond 330 pixels, and both reset to zero
the moment he closes. When they expire the guard is pushed into pose 70 and the
chooser starts returning move 14. **It is the routine that stops you waiting
the game out.**

## What is still unread

- **The path from the joystick to the reaction flags.** `0x425E` reads the
  hardware and nothing calls it directly.
- **The arms of the pose switch at `0x228B`**, which is where the player's
  chooser turns input into a move.
- **What the second stance table's classes mean.** The numbers are read; that
  class 3 and class 4 can never be hit is a fact, not yet an explanation.

## How this was found

Not by reading the listing.

1. Running the game under `comrun.py` and logging every sprite id arriving at
   the dispatcher gave a repeating pattern with one number climbing — an
   animation, driven by something.
2. Logging where each file is read to showed every script file streaming
   through **one 512-byte buffer**, which is what a program does with data it
   consumes rather than keeps.
3. Reading that buffer out of memory produced `CAL01` in ASCII, matching the
   ids from step 1 exactly.
4. `read-moves.py` then parsed the libraries statically, and the fourteen arms
   of the jump table at `0x163E` — found by the toolkit's own
   `detect_case_tables` — supplied the opcodes.

Step 3 is the one that mattered, and it cost nothing: **the file was readable
text and nobody had looked.**

Finding the *AI* took one more turn of the same handle, and the trick was to
pick a variable nothing could fake:

5. Hooking the single instruction that emits `set_pos`'s opcode gave the byte
   code's address without having to work out whose argument it was.
6. Hooking **writes to the cursor** then named every move change in the game,
   with the writer's address attached. Four instructions did all of it: two
   advancing a frame, two starting a move. The two that start a move have the
   chooser call directly above them.

The general form is worth keeping: **hook the narrowest thing that can only
happen for one reason.** "Who draws sprites" named one routine and taught
nothing, because everything draws sprites. "Who writes the move cursor" named
four, and two of them were the answer.
