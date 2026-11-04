# Karateka — the game

*Document one of six. [02-architecture.md](02-architecture.md) is how the
program is built; [03-the-code.md](03-the-code.md) walks its routines;
[04-porting.md](04-porting.md) is what rebuilding it would take;
[05-the-fighting.md](05-the-fighting.md) reads the fighting;
[06-web-code.md](06-web-code.md) walks the port's code.*

Two kinds of fact are kept apart here on purpose:

- **From the binary.** Strings, tables and code read out of `KARATEKA.EXE` and
  its ninety data files. Checkable — you can look at the same bytes.
- **From published sources.** History and reception, linked at the
  [bottom](#sources).

---

## What it is

**Karateka**, written by **Jordan Mechner** and published by **Brøderbund** in
1984 — his first game, made while he was an undergraduate at Yale. You climb a
cliff to Akuma's fortress, fight your way past his guards and his eagle, defeat
Akuma, and free Princess Mariko.

The IBM PC version examined here is `KARATEKA.EXE`, **87,990 bytes**, with
ninety data files beside it.

## Why it mattered

Two things, and the second one is why people still talk about it.

**It was rotoscoped.** Mechner filmed his father — in his mother's karate gi,
in the woods behind the family house in upstate New York — and traced the
frames. The result is a figure that moves like a person rather than like a
sprite, and it is visible directly in the data: sixty frames of the hero come
out of `KSC.DAT` alone, and laid out in a grid they read as a continuous
performance rather than a set of poses.

Mechner used the same technique four years later on *Prince of Persia*.

**It was cinematic.** Karateka opens with an animated sequence, cuts between
the hero and Akuma's fortress, and ends with a scene rather than a score
screen. That was close to unheard of on 1984 home computers, and the program
does it with a **small scripting language** — fourteen commands, in a table
the binary names itself, compiled into byte code each time a scene loads:

```
set_tune   set_bg    set_fig   chg_fig   do_scr    del_fig    set_wipe
set_nowipe wait      init_sal  set_pos   inc_x     loop       end_animation
```

That is a cutscene system, written as a script engine, in 1984. It is traced in
[03-the-code.md](03-the-code.md#2-the-animation-language).

## How to play

| | |
|---|---|
| approach | walk right; you are attacked in sequence |
| stance | you fight in a karate stance and travel in a run |
| attacks | three heights of punch and three of kick |
| the eagle | attacks in the fortress and must be struck out of the air |
| the death gate | a portcullis that will crush you if you mistime it |
| Akuma | the last fight |

The keys, read out of the program rather than a manual:

| key | what it does |
|---|---|
| `q` `a` `z` | the three punches |
| `w` `s` `x` | the three kicks |
| `6` / `4` (or →/←) | step forward / back; from standing, `6` runs |
| space | drop into the fighting stance, or rise out of it |
| `j` / `k` | keyboard / joystick |
| Ctrl-S | sound: all → effects only → silent, and round again |
| Ctrl-R | start the game again |
| Ctrl-Q | quit to DOS |

A short beep confirms each of the settings keys. **The six strikes do nothing
until you are in the stance** — from the standing start, `6` runs you into the
first guard instead. That one rule is why the first attempt at driving the
game by script lost every fight.

**Most guards fall to a low kick and a high kick, repeated.** It is not elegant
and it works; the guards vary in how quickly they close and how far they back
off, not in what beats them. Driving the original under emulation with `x`
then `w` beat both guards it was tried on; "most" is the published advice,
and two guards cannot confirm a word like that.

The eagle and the death gate turned out to be read straight out of the code;
how each works, and how to get past it, is in
[05-the-fighting.md](05-the-fighting.md#the-eagle-is-a-guard).

## The map, from the beach to the princess

Four scenery scripts hold the whole game, and their own coordinates give the
size of each place. The order they come in, and the cutscenes between them,
were read out of the code that loads them — every call that opens a script,
39 in all — rather than from playing.

This map first followed the cutscene files' names, in numeric order, and put
`CAL01` after the shore and `CAL07`/`CAL07A` at the end as "two endings". The
code plays them in a different order, and neither `CAL07` file is an ending:

```mermaid
flowchart TD
    T["the title cards and the scrolling prologue"]
    A0["<b>cal00</b> — the opening cutscene"]
    A1["<b>cal01</b> and a fight on the shore<br/>— the attract demo"]
    B0["<b>BAL00</b> · the shore<br/>689 px, about 2 screens<br/>1 guard"]
    C7A["<b>cal07a</b>"]
    B1["<b>BAL01</b> · the cliff path<br/><b>2,152 px, about 7 screens</b><br/>27 posts"]
    C4["<b>cal04</b>"]
    B2["<b>BAL02</b> · the fortress wall<br/>the death gate and the eagle<br/><b>cal07</b> plays here"]
    C5["<b>cal05</b>"]
    B3["<b>BAL03</b> · the interior<br/>room after room, levels 1–6<br/>the eagle again at level 5"]
    C6["<b>cal06</b>"]
    AK["Akuma"]
    MA["Mariko<br/>— <b>cal03</b> is loaded for her room"]
    CL["the closing card"]
    T --> A0 --> A1 -- "press a key" --> B0
    B0 --> C7A --> B1 --> C4 --> B2 --> C5 --> B3 --> C6 --> AK --> MA --> CL
    style B0 fill:#d4edda,stroke:#155724
    style B1 fill:#d4edda,stroke:#155724
    style B2 fill:#fff3cd,stroke:#856404
    style B3 fill:#fff3cd,stroke:#856404
    style MA fill:#f8d7da,stroke:#721c24
```

Read it as the program does: each arrow out of a `BAL` box is the hero
reaching that scene's right-hand wall, which is what makes the level script
runner (`0x31AA`) play the next cutscene and load the next scene. Akuma and
Mariko share one last scene; the runner brings Akuma on when the interior's
level counter reaches 7, and Mariko when the hero reaches the end of his room.

Fourteen of the script files on the disk are never opened at all — no string
in the program names `ALLBAL`, `ALLCAL`, `CAL02`, `BAL02A` to `BAL02E` or
`BAL03A` to `BAL03F`. **[inferred]** they are the pieces the shipped files
were assembled from; the game does not need them.

### How many rooms you fight through

This is the part worth being precise about, because it is easy to assume it is
random and the code says otherwise.

`BAL02` and `BAL03` are each **six sections**, and the loader is told so
outright — `0x19EE` is called with a literal **6**, and walks the compiled
script counting `init_sal` markers to index them. But the two use their
sections for completely different things.

**`BAL02`'s six sections are the death gate.** Each one places the portcullis
at x 1860 a step further down — its spiked bottom bar at y 113, 123, 133, 143,
153 and 171 — and the gate falls and rises by switching between them. An
earlier version of this page counted the bars stacked above the spikes and
reported them as "opponents standing on the wall", six, seven and nine of
them. They are iron, not men. [05-the-fighting.md](05-the-fighting.md#the-death-gate)
has the mechanism.

**`BAL03`'s sections are rooms.** Inside the fortress the level counter
(`[0x130]`) starts again at 1 and goes up by one each time you reach the end
of a room, and the room shown is chosen by a two-line calculation:

```nasm
    mov  word [0xc3a6], 3       ; three, normally
    cmp  word [bp+6], 7
    jne  .normal
    mov  word [0xc3a6], 5       ; five, on the last level
.normal:
    mov  ax, [0x12e]
    add  word [0xc3a6], ax      ; plus a per-level flag, 0 or 1
```

The flag is set when a guard has been beaten on that level. So which room you
see is **not random**: section 3, or 4 once you have beaten the guard there,
or 5 on the last level — fixed outcomes, chosen by where you are and what you
have done.

### What *is* random

`random(n)` sits at image `0x629` — `rand()`, multiplied by `n + 1`, high word
taken, giving a uniform integer in `0…n` without a division. It is called from
**eleven places**, and never for the room count:

| | |
|---|---|
| `random(1)` | which of two variants of a move to play — `pal17` or `pal18` |
| `random(2)` | on spawning a guard, `× 12` → an aggression of **0, 12 or 24** |
| `random(255)` | probability rolls inside the guard's decision tree |

So two guards on the same piece of wall are not identical: each is dealt one of
three temperaments when it appears. That, and not the layout, is where the game's
variety comes from.

### The levels themselves

`[0x130]` counts the level and runs **1 to 7**, advancing by a plain `inc`.
It is set back to 1 when you enter the fortress, so most of its counting is
the rooms of the interior. Level 2 starts the player at x = 32 rather than 4
and shifts the level bounds one screen left; level 5 is where the eagle comes
back; when it reaches 7, Akuma is brought on; the `[0x102]` and `[0x104]`
globals hold the current left and right walls, and the player's x is clamped
between them every frame.

### The ending everyone gets wrong the first time

When you reach Mariko, **drop out of your fighting stance before you approach
her.** Walk up to her in a stance and she takes you for one of Akuma's men,
kicks you in the head, and the game ends.

It is the most famous thing about Karateka after the animation, and it is a
deliberate joke at the expense of a player who has spent the whole game being
told that stance is safety.

In the code it is two comparisons. Mariko is brought on in the guard's place
with her own three-move library, `PRNGAL`, and a restricted mode that leaves
her only three answers: if you are standing upright she plays one move; if
you are in a stance and within 56 pixels she plays the other, which is a kick;
otherwise she waits. On the last level a single landed strike ends the game.
Reach the end of her room standing, and the program plays the closing card —
"and so this adventure ends…" — with its tune looping until you press a key.
[05-the-fighting.md](05-the-fighting.md#mariko-and-the-ending-everyone-gets-wrong)
has the rest.

There is a second joke in the same spirit: the game was pressed so that it
would boot from either side of the disk, and if you inserted it upside down it
ran **upside down**.

## What the binary says about itself

Three things it states outright, which most games of the era do not.

**The compiler.** The first string in the data segment is `Lattice C 2.1`,
followed by its runtime's own error messages — `Invalid stack size`,
`Invalid I/O redirection`, `Insufficient memory`, `*** STACK OVERFLOW ***`.
So the DOS version is a **C program**, not the hand-written assembly that its
prologue density at first suggested. See
[02-architecture.md](02-architecture.md#it-is-a-c-program-and-it-says-so).

**The asset tables.** Two parallel lists of fourteen names, in the same order:

```
ks0 ks1 ks2 ks3 ks4 ksc ksi0 ksi1 ksi2 ksj2 ksi3 ksi4 ksj4 ksi
km0 km1 km2 km3 km4 kmc kmi0 kmi1 kmi2 kmj2 kmi3 kmi4 kmj4 kmi
```

Fourteen shapes, fourteen masks, one pair per character or scene. The `.dat`
extension is appended at run time, from another string three bytes further on.

**And a curiosity, since solved.** At `DS:0x0322` sits `qazwsx46 b0.ind` — a
keyboard pattern and a filename in one string. It was first taken for a
developer shortcut left in the shipped build. It is the key table: the
program compares each key you press against the first eleven bytes,
`q a z w s x 4 6`, space, `b`, `0`, and the position it finds is the move
number. The `.ind` that follows is just the next string in memory — the
extension it adds to the sprite files' names.

## It was not translated — it was rewritten

[Hard Hat Mack](../../hard-hat-mack/), also an Apple II game brought to the IBM
PC in the same period, turned out to be a **mechanical translation** of its 6502
original: 391 `cmc` instructions that exist only to reconcile two processors
that disagree about the carry flag.

Karateka has **zero**, in 10,589 instructions, against 913 compares. Brøderbund's
conversion was a rewrite in C where Electronic Arts' was a translation — and the
difference is measurable rather than a matter of opinion.

The Apple II original is still worth reading alongside it. Six disk images are
in `reference/apple-ii/`, and now that the DOS version is known *not* to be a
translation, the comparison is more interesting rather than less: two
independent implementations of one design, four years before *Prince of
Persia*.

## Sources

- [Karateka — Jordan Mechner's own page](https://www.jordanmechner.com/en/games-movies/karateka/)
- [Karateka — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Karateka)
- [The Making of Karateka — Xbox Wire](https://news.xbox.com/en-us/2023/07/11/making-of-karateka-gold-master-series/)
- [karateka.com](https://karateka.com/) — the 2023 remaster

Everything in *What the binary says about itself* and *It was not translated*
was read out of `KARATEKA.EXE`; the history and the anecdotes are from the
sources above.
