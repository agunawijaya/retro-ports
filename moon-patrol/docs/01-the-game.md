*Document one of six. See also: [02-architecture.md](02-architecture.md), the
BRIEF, and the root [CLAUDE.md](../../CLAUDE.md).*

# Moon Patrol -- the game

Moon Patrol is a side-scrolling shoot-'em-up first released as an arcade
cabinet by Irem in 1982 (distributed in North America by Williams). The
player drives a moon buggy from left to right across a lunar landscape, firing
upward at UFOs and forward at ground obstacles, jumping craters and other
low-lying hazards, and reaching lettered checkpoints A through Z.

Atari, Inc. published the DOS conversion. The title screen the game renders
on boot shows `(C) 1982 WILLIAMS   (C) 1983 ATARI   ALL RIGHTS RESERVED`,
which was confirmed by running the reassembled binary in an emulator (see
[BRIEF.md](../BRIEF.md#the-title-screen-referee-run)). A separate
never-displayed string inside the binary at file 0x4E98 reads
`Moon Patrol Copyright (C) 1984 Atari, Inc.` -- possibly a later-revision
notice that never shipped, possibly a leftover from the source tree. The
**on-screen date is 1983**; where sources disagree, the image is the
authority.

The top-level menu the title screen prompts for is `F1: START GAME` and
`F2: OPTION SCREEN`. The `[K] KEYBOARD MODE`, `[J] JOYSTICK MODE`, `[B/C]
COURSE`, `[1/2] PLAYERS` and `[S] SOUND` bindings this document lists in the
next section are the *options sub-screen* -- reached from F2, not from the
title.

## What is on screen

Cross-referenced with the arcade reverse-engineering docs at
<https://computerarcheology.com/Arcade/MoonPatrol/>, mirrored locally at
`E:\Projects\Arcade Games\Moon Patrol`. The DOS conversion is a port of
the same design, so the enemy roster and screen model carry across.

- **The buggy.** Four-wheeled; the arcade sprites are called
  `Moon buggy` (`ObjDraw_07`) and `Buggy wheel` (`ObjDraw_16`). It fires
  two shots: one straight up (`Player air shot`, `ObjDraw_0D`) at the UFO
  layer, one along the ground (`Player forward shot`, `ObjDraw_0E`) at
  ground targets. On the DOS conversion each shot is drawn XOR onto the
  terrain so the wheels can ride over its bumps without needing to be
  redrawn against them.
- **The terrain.** A single-row strip of tile numbers scrolls past under
  the buggy at one pixel per frame. Above it, a horizon and mountain
  layer scroll at a slower rate -- the parallax that Moon Patrol was one
  of the first arcade games to attempt. Arcade layers are named
  `Mountains` (mpe-1.3l), `Hills` (mpe-2.3k), `City` (mpe-3.3h), each 4 KB.
- **Craters.** Ground hazards jumped, not shot. Arcade rewards
  successfully jumping a crater with **50 points** (score-table index 2
  at Z80 2A0C, `Moon_Patrol.txt`). Falling in ends the buggy via
  `Moon buggy crashing in crater` (`ObjDraw_12`).
- **Rocks and boulders.** Ground hazards, shootable with the forward
  gun. Arcade `ObjDraw_00` handles the whole "rocks, boulders, exploding
  rocks and boulders, tank" family. **100 points per rock** (score-table
  index 4).
- **Tanks.** Come at the buggy from ahead on the ground, faster than the
  world scrolls, and fire tank-shots at the buggy periodically. Arcade
  shares `ObjDraw_00` with rocks. Score value not labelled in the
  arcade extracts; the port assigns tier 5 = 200 pts.
- **Ground mines.** Ground hazards that animate through 31 frames with a
  colour shift half-way (`ObjDraw_14`, Z80 0925: `INC (IX+$0A); AND $1F`
  in a loop). Jumpable and shootable.
- **UFOs.** Fly overhead, drop bombs. Arcade `Hover craft` (`ObjDraw_01`)
  and the boost variant (`Hover craft full boost`, `ObjDraw_13`). Bombs
  are drawn as `Alien shot hitting ground` (`ObjDraw_0A`) and `Bubble
  alien shot` (`ObjDraw_15`). **UFO score commonly quoted at 300** (tier
  6, `[inferred]` -- the score-table entry is present but the extracts
  do not label the callsite).
- **Space plants.** Ground-mounted decorative hazards; too tall to jump,
  killed only by the forward gun. Arcade sprites: `Space plant leaf 1..4`
  (`ObjDraw_02/03/0C/0D`) and `Space plant base` (`ObjDraw_11`).
  Continuous sound effect while alive (arcade sound-command 16, on AY0
  channel A, `Moon_Patrol_Sound.txt`).
- **The status bar.** Fixed at the top of the screen. Arcade layout
  (`Moon_Patrol.txt` screen-address comments):
    - `HIGH ######` at row 0 (screen address `8043`)
    - Current player score at `8084` (P1) / `80A4` (P2)
    - `POINT` label at `804B` with the checkpoint letter at `8052`
    - `TIME ###` at `822D`
    - The bar does not scroll with the terrain, which is why the CRTC is
      programmed to split the display (see
      [02-architecture.md](02-architecture.md)).

## Scoring

Arcade score-add table at Z80 address `2A0C` (`Moon_Patrol.txt`). All
score deltas the game grants come from this 10-entry table:

| index | pts | labelled use |
|---|---|---|
| 0 | 0 | (placeholder) |
| 1 | 20 | (unlabelled) |
| 2 | 50 | **Successfully jumping a crater** |
| 3 | 80 | (unlabelled) |
| 4 | 100 | **Shooting a rock, shooting an alien ship** |
| 5 | 200 | (unlabelled) |
| 6 | 300 | (unlabelled) |
| 7 | 500 | (unlabelled) |
| 8 | 800 | (unlabelled) |
| 9 | 1000 | (unlabelled) |

Only the two rows the disassembly labels are direct facts; the other
tier assignments (tank = 200, UFO = 300, mine = 100, plant = 80, etc.)
are the port's `[inferred]` choices from the arcade table.

**Extended play**: extra lives are awarded at DIP-switch-configured
thresholds -- typically 10 000 or a 10K/30K/50K sequence
(`Moon_Patrol.txt` `CheckExtPlay` at Z80 `06AF`; DIP bits stored at
`extPoints` E045). The DOS conversion's DIP settings are not decoded.

## Checkpoints and courses

The point counter (`curPoint` at E50E) increments through 0..0x33 (0..51)
and stops -- "past position 0x1B = 27 (past Z) letters wrap and use an
alternate colour" (`RAM.txt`). Two course modes:

- **Beginner** (`courseNum` = 0 at E510): the shorter of the two
  sequences. Arcade text: `BEGINNER COURSE GO`.
- **Champion** (`courseNum` = 1, 2, 3, ...): repeats and increments after
  each completion. Arcade text: `CHAMPION COURSE N GO`.

A `champColors` flag at E0F9 swaps the palette: buggy changes from pink
to red, status window from blue to pink. The port's CGA-locked palette
reproduces the *contrast* via cyan↔magenta swap.

Reaching a checkpoint plays arcade sound `10 Passing one point`; reaching
the final one plays `1D Reaching goal` followed by a bonus-check that
grants "GOOD BONUS POINTS" or shows "SORRY NO BONUS" if a time condition
fails (`Moon_Patrol.txt` 2876/2883).

## Sound

The arcade sound roster (`Moon_Patrol_Sound.txt` jump table at F400):

| cmd | effect | notes |
|---|---|---|
| 01 | Explosion: car shooting rocks | DAC sample |
| 02 | Explosion: missiles hitting ground | DAC sample |
| 10 | Passing one point | checkpoint bonus |
| 11 | UFO explosion | |
| 12 | Missile from car | fire |
| 13 | Coin insert | |
| 14 | Car jump | |
| 16 | Space plant | continuous while alive |
| 17 | UFO flying | continuous |
| 18 | Background music | |
| 1B | Ending music | |
| 1C | Opening music | title tune |
| 1D | Reaching goal | |
| 1E | Congratulations | |
| 1F | Car explosion | |

The DOS conversion carries three sound-effect data streams
(`sound_effect_B75/BBC/DA7` at file 0x4D70/0x4D75/0x4D7A) plus the
speaker bit-bang; which of the arcade command IDs each maps to is open,
flagged in [02-architecture.md](02-architecture.md#what-is-genuinely-open).

## Attract mode

The arcade RAM flag `E046` bit 7 = "demo mode -- don't register score"
(`RAM.txt`). While set, `Adjust Score` at Z80 `0622` early-returns
(`062F..0630: AND A; RET P`). The DOS `menu_loop` at file 0x5C0 prints
the demo copy every 500 timer ticks -- the same idea, driven from the
DOS keyboard-ISR frame counter at `ss:0x5A`.

The port implements this: 10 s idle on title → scripted 12 s demo →
back to title. Any key press aborts.

## Controls

The DOS version supports either the keyboard or an IBM PC-compatible
joystick on port 0x201. The choice is made from the options menu with
`K` or `J`. Every string the options screen prints is visible with
`strings` -- they sit in the data tail from file 0xD8B0 onward, each
prefixed with a `\x0B, row, \x0E, col` cursor-positioning sequence and
terminated with an 0xFF byte:

    [K] KEYBOARD MODE
    [J] JOYSTICK MODE
    [1] ONE PLAYER OPTION
    [2] TWO PLAYER OPTION
    [B] BEGINNER COURSE
    [C] CHAMPION COURSE
    [S] SOUND ON OR OFF

The scancode-to-action mapping lives in a (scancode, action-address) pair
table at DS:0x88A9, walked by `scancode_dispatch` at file 0x64B, and the
keyboard remap in `install_scancode` writes back into the parallel scancode
array at DS:0x8856.

The port ships keyboard-only and single-player, so `[J]`, `[1]` and
`[2]` are documented above for completeness but not exposed on the
port's option screen. See [04-porting.md](04-porting.md) for the
rationale.

## Two courses, one shape

Both courses use the same buggy, the same enemies and the same obstacle
classes; the difference is the wave sequence and the density. That
structure is why the game fits in 58,306 bytes: everything the two
courses have in common is one copy in the code region, and the two
script tables at DS:0xC46 (the `[0x73]` cursor) and DS:0xC93 (the
`[0x75]` cursor) select which sequence runs. See `init_script_pointers`
at file 0x3D89.

## What "random" means in this game

Neither the DOS binary nor the arcade docs name a general-purpose random
number generator. The arcade has one routine called `Rand1to3` at Z80
`17F0`:

```
17F0: ED 5F   LD A,R      ; DRAM refresh counter
17F2: E6 03   AND $03     ; keep bottom two bits
17F4: C0     RET NZ       ; return 1, 2, or 3
17F5: 3E 02   LD A,$02    ; if 0, return 2
17F7: C9     RET
```

That is not a RNG -- it is a Z80-hardware-specific 2-bit read of the
DRAM refresh register, with a 25%/50%/25% distribution over
{1, 2, 3}. Used to vary explosion animations and rubble scatter, not to
choose which enemy to spawn.

The **enemy spawn sequence is data-driven**, not random-driven: arcade
uses the "text command" list at E600 and per-object script pointers;
the DOS binary uses `init_script_pointers` at file 0x3D89 to point at
the two script tables at DS:0xC46 and DS:0xC93.

For a port, this means there is no LCG to port -- there is nothing to
port. The port's per-tick spawn intervals are `[invented]`; a future
version could replace them with the actual arcade sequence if the
wave-script opcodes get decoded.

## Reception, briefly

Moon Patrol was significant in the arcade as one of the early
demonstrations that parallax scrolling was worth the extra silicon. The
DOS conversion is a faithful port for its target hardware (CGA 320x200
in mode 4, PC speaker, one adapter) rather than a re-imagining. The
parallax is preserved by using two draw passes into the same CGA image,
one at the buggy's row stride and one at the horizon's, so the fixed
vertical position of the horizon line is programmed into the CRTC as a
split rather than redrawn per frame.

## The DOS version's own quirks

- **CGA mode 4.** 320x200 pixels, four colours. Palette 1
  (cyan/magenta/white on background 0) is chosen at startup and never
  changed. See `enter_cga_graphics` at file 0x573. The arcade uses a
  16-colour PROM-driven palette (`Sprite_Colors.txt`), so the DOS
  conversion is deliberately a lower-colour version.
- **PC speaker only.** No AdLib, no PCjr audio, no Tandy. Sound is a
  one-bit bit-bang through port 0x61, driven by `speaker_toggle` at
  file 0x4F8B and gated by the `sound_enable` byte at DS:0x216 that
  the `[S]` menu key toggles. The arcade board has two AY-3-8910 chips
  plus a DAC; the DOS conversion collapses all of that to the speaker.
- **56.74 Hz VBLANK, not 60.** The arcade board's ISR runs at 56.74 Hz
  (`Moon_Patrol_Hardware_Info.txt`). The DOS conversion's tick rate is
  not directly named in `symbols.json`; the port uses the arcade's rate
  as the closest known.
- **No hard disk expected.** The .COM loads and runs -- no data files,
  no overlays, no INT 21h calls to open anything. All the game state,
  sprites, scripts and music fit in the single file.
- **No mouse and no colour choice.** The game shipped when the mouse
  was an optional accessory. The palette is hard-coded.
