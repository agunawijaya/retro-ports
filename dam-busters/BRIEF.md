# Brief: The Dam Busters (1984, DOS)

Sydney Development, published by Accolade. Nothing here has been read yet. This file is the triage, done on
2026-08-02 with `mzinfo.py` and `comrec.py` -- **every number below was
measured, not recalled** -- and the order the work is worth doing in.

## What triage found

- MZ, but **0 relocations** and entry `0000:0000`
- load image 0x200..0x10004 (65,028 bytes), 124 bytes trailing
- single-segment: a `.COM` wearing an MZ header

**This is the same shape as Karateka**, and Karateka is the
worked example: an MZ with no relocations is a single-segment program, and
comrec reconstructs it by stripping the header, treating the image as a `.COM`,
and putting the header back on the way out. `build.ps1` here already does
that, copied from Karateka's.

The 124 trailing bytes past the declared load image are worth a look before
anything else -- they are outside what DOS loads, so either the header
under-declares the image or something appended them.

Of the seven set up in this session this is the most likely to go all the way
through on the existing pipeline without new tooling.

## Tested on 2026-08-02

`build.ps1` reports **BYTE-IDENTICAL**, `D3657960…`, at 12.3% decoded.

It did not on the first attempt, and the reason is worth keeping. comrec
reconstructs the **load image** — what DOS maps into memory — and the build
concatenated header + image. This file keeps **124 bytes past the declared
image**, which DOS never loads and comrec never sees, so the rebuild came out
124 bytes short and the hash missed. mzinfo warns about trailing data for
exactly this reason, and the warning was there in the triage above before the
build was ever run. `build.ps1` puts it back now, and says so when it does.

12.3% is low. Same question as everywhere: where does control go that the walk
cannot follow?

## Where control went that the walk could not follow (2026-08-19)

Three limitations in comrec, all uncovered by this game, and every one made
the rebuild look correct while hiding real code as data. All three raise the
decode rate together to **26.7% at the same byte-identical hash** — the
important part is the second half of that sentence, because a walker that
reaches more addresses can only be trusted when the file still assembles back
to what it started as.

- **Wrap-around near calls.** Capstone sign-extends the target of a near
  branch whose signed offset would put it before the segment origin: `E8 C0
  E0` at IP 0x2F prints as `call 0xffffe0f2` for a target the CPU reaches at
  `(0x32 + 0xe0c0) & 0xffff = 0xe0f2`. The walker's `contains_addr` then
  refuses the target and the callee stays as data. Twenty call sites in this
  file take that shape, and every routine reached only through them was
  invisible.
- **Bare-`bx` dispatch tables.** `detect_jump_tables` required a `cs:` prefix
  because Karateka's compiler emits its switch tables that way (data through
  DS, tables through CS). A single-segment .COM has no distinction — DS is
  CS — so `jmp word [bx + 0xdf18]` reaches its table the same way, and this
  game has eleven of them. Every entry in each table pointed at a routine the
  walker had never reached.
- **Negative displacements in those dispatch tables.** Capstone writes
  `[bx - 0x20e8]` for what the 16-bit CPU sees as `[bx + 0xdf18]`. Masking to
  the segment offset makes it findable; leaving the sign there loses the one
  scenery dispatcher (`cs:0xdf18`, ten targets).

Fixes are in `../../DOS-Decompiler/tools/comrec.py`. The eleven `.COM`
regression fixtures still pass byte-identically, and Karateka still rebuilds
byte-identically at `C8736BBA…` with all 218 routines and 338 globals
resolving as before — so the changes recover code without disturbing what
already worked.

## State on 2026-08-19

| | before | after |
|---|---|---|
| rebuild | `D3657960…` byte-identical | same |
| bytes decoded as instructions | 8,556 (13.2%) | 17,364 (26.7%) |
| instructions | 2,797 | 5,690 (262 pinned) |
| call targets discovered | 75 | 158 |
| bracketed constants | 245 | 433 |
| indirect jumps resolved | 0 | 13 resolutions from 11 unique tables (some tables are read from more than one call site) |
| indirect jumps not resolved | — | 1 (a `jmp bx` whose value comes from `mov bx, word [si]`) |

Twelve dispatchers were found, and each says what the file organises itself
around:

| table | targets | what it selects |
|---|---|---|
| `cs:0x00b9` | 9 | called from the main loop by `[0x5db]` — the top-level game phase |
| `cs:0x08d2` | 8 | second-level, same structure, reached from a phase handler |
| `cs:0x1045` | 4 | selects by `[0x104]` — a small-arity choice |
| `cs:0x1610` | 19 | large fan-out from something indexed by `[0x14]` |
| `cs:0x4e82` | 10 | called from four sites (`di + 0x4e82/0x4e92/0x4ea2/0x4eb2` — same table read at four offsets) |
| `cs:0x6f3e` | 3 | selects by `bx`, guarded `cmp bx, 6 / jae` — one of six phases |
| `cs:0x7e9e` | 3 | reached from `[bx + 0x7e9e]` |
| `cs:0xdf18` | 10 | the scenery dispatcher, called through `[bx - 0x20e8]` |

## Names on 2026-08-20

**168 routines and 127 globals** in `symbols.json`, still byte-identical.
`annotate.py` reports:

- **104 of 158 call targets named (66%)**
- **all 5 tail-call entries named** (`set_menu_cursor`, `end_run`,
  `bomb_run_end`, `cycle_selector_a_apply`, `bombrun_draw_target_locks`)
- **111 of 433 bracketed constants named (26%)**
- byte hash `D3657960A00AAC6548C47EE35A8AC008EF0BB254F94AE2A335B04431F26C380D`

Growth this session, in three passes:

| after | routines | globals | call-target coverage | bracketed coverage |
|---|---|---|---|---|
| initial batch | 25 | 28 | 17 of 158 | 17 of 433 |
| map + 8 phases | 74 | 36 | 28 of 158 | 25 of 433 |
| per_frame_step chain | 101 | 66 | 50 of 158 | 55 of 433 |
| drawing subsystem | 131 | 85 | 70 of 158 | 71 of 433 |
| 3D + rendering + bombrun | 168 | 127 | **104 of 158** | **111 of 433** |

What is named:

- **The entry stub and the frame loop.** `entry` at 0x0 sets DS := CS,
  `post_boot` at 0x2F saves SP and calls the subsystem inits,
  `main_setup` at 0x5F puts the ambient song on and installs the ISRs,
  `main_loop` at 0x6B does the CLI/STI frame-flag transfer and the phase
  dispatch, and `restart_run` at 0x53 is the target the run's end jumps back
  to. `ret_stub` at 0xCB is the do-nothing entry in `phase_dispatch`.
- **The subsystems.** Video (`init_cga_mode`, `set_default_palette`,
  `set_border_color`, `clear_cga_frame`), the keyboard chain
  (`save_kbd_isr`, `install_kbd_isr`, `restore_kbd_isr`, plus `peek_key`,
  `flush_key`, `wait_key_or_timeout`), the timer and music
  (`install_timer_isr`, `timer_isr`, `play_song`, `set_loop_song`,
  `wait_ticks`), and the PRNG (`prng_step`).
- **All 8 game phases.** Both the `phase_init_dispatch[0..7]` and
  `phase_dispatch[0..8]` entries carry evidence for what they are:

  | phase | init | step | what it is |
  |---|---|---|---|
  | 0 | `flight_forward_init` | `flight_forward_step` | pilot/navigator view — `physics_step` reads input flags in bit-wise `[0x306B]`, integrates pitch/roll into `[0x3073]/[0x3075]`, drives altitude from `[0xCE6] - [0x23A1]` |
  | 1 | `flight_bombrun_init` | `flight_bombrun_step` | bomb-aimer/target-lock view — target-lock rectangle at `[0x3EBD..0x3EC3]`, and the alternate briefing at 0x3DB4 that unlocks 30 frames after `[0x4B61]` is set |
  | 2 | `flight_rearview_init` | `flight_rearview_step` | rear-gunner — same 3D pipeline but with `neg ax` on all three camera coordinates before writing to `[0x4DA5..0x4DA7]`, which flips the view |
  | 3 | `bomb_options_init` | `bomb_options_step` | pre-drop options — two YES/NO toggles at `[0x4B61]` and `[0x4B62]` drawn by `draw_bomb_options` |
  | 4 | `map_screen_init` | `map_screen_step` | region-select map — 'GREAT BRITAIN', 'BELGIUM', 'NORTH GERMANY', 'FRANCE', 'EASTERN FRANCE', 'SOUTH GERMANY'; `clamp_map_position` wraps between adjacent regions |
  | 5 | `menu_main_init` | `menu_main_step` | **cockpit controls** — text at 0x13A6 has 'BOOSTER GAUGES', 'RPM GAUGES', 'THROTTLES', 'FIRE EXT.', 'BOOSTERS'. Menu dispatches through `cs:0x1610` into `adjust_engine_slider_top_1..4` (values in `[0x1725..0x172B]`, cap 40), `adjust_engine_slider_bottom_1..4` (`[0x171D..0x1723]`, cap 24), and `use_fire_ext_engine_1..4` (sets bit 0 of `[bx + engine_states]` once per engine, one-shot). Which slider row is BOOST vs RPM vs THROTTLE has not been settled |
  | 6 | `menu_second_init` | `menu_second_step` | a second selection page — two 3-position cyclers (`cycle_selector_a` on `[0x239F]`, `cycle_selector_b` on `[0x23A3]`) |
  | 7 | `results_init` | `results_step` | end-of-run stats — 10 game counters (`[0x6AD3]`, `[0x598F]`, `[0x64BC]`, `[0x6C03]`, `[0x5991]`, `[0xCE6]`, `[0xBDB]`, `[0xBDD]`, `[0xBE3]`, `[0x5515]`) formatted by `format_decimal` into 6-byte template slots |
  | 8 | (none) | `ret_stub` | idle -- `check_phase_transition` never leaves phase 8 |

- **The two failure paths.** `end_run` (0x7DA3) picks a message from a
  9-entry table at `[bx*2 + 0x7FE1]` indexed by the reason code `[0x7D33]`
  (crash reasons include altitude below -0x2C, all crew dead, and crew
  position accumulator overflow), silences music, waits for a key, and
  restarts. `bomb_run_end` (0x84C7) is the post-bomb outcome dispatcher
  branching on `[0xBE3]` and `[0xBCB]`.

What is now named (major additions this session):

- **The per-frame update chains.** `per_frame_step` at 0xD62 calls 15+
  sub-updaters, all named: model updates (`integrate_heading`,
  `altitude_step`, `compute_yaw_torque`, `integrate_distance`,
  `check_flight_conditions`, `apply_region_flight_effect`,
  `step_plane_position`, `update_map_position`, `update_visible_tiles`,
  `check_heading_tile_change`) and world updates (`spawn_flak`,
  `update_flak`, `spawn_enemy_plane`, `update_enemy_plane`,
  `check_flak_hit`, `check_flak_hit_type4`, `count_engines_alive`,
  `draw_bomb_ready_icon`).
- **The world tile system.** `yaw_to_direction`, `get_map_tile` (with its
  edge-wrapping logic across regions), and the ten visible-tile bytes
  written each frame into `visible_tiles`.
- **The drawing subsystem.** `blit_rect` is the CGA blitter; every other
  drawer is built on it. The scan-line table at `cga_row_table` is the
  interleave workaround. `draw_display_list` at 0xDF0E is a **bytecode
  interpreter** for a drawing DSL -- ten opcodes (`dl_opcode_1_text`,
  `dl_opcode_2_sprite`, ..., `dl_opcode_9`) walk a stream of drawing
  commands and it's called from every phase init.
- **The 3D projection.** `project_point_2d` at 0x504D is the primitive
  every 3D drawer uses; `update_camera_transform` recomputes the 2x2
  matrix from roll and pitch each frame. `render_object_pool` walks the
  20-slot pool at `object_pool` (0x51DD), projecting each and dispatching
  to a per-type handler via `object_render_dispatch` (cs:0x4E82). The rear
  view uses `render_object_pool_rear`, which mirrors the world coord.
- **Two jump tables resolved by naming.** `apply_region_flight_effect`
  dispatches through `region_effect_dispatch` (cs:0x1045, 6 entries);
  every entry is now named as `region_effect_*`.
- **The bomb-run chain.** `bombrun_update_target_lock`, `bombrun_step_state_a`,
  `bombrun_step_state_b`, `bombrun_step_state_c`, `bombrun_draw_target_locks`,
  and `bomb_release`.
- **The menu draw chain.** `menu_main_draw_engine_gauges`,
  `menu_main_draw_top_row_gauges`, `menu_main_draw_bottom_row_gauges`,
  `menu_main_draw_engine_lights`, and equivalents for `menu_second`.
- **The music theme system.** `music_theme_index` at 0xCBF, indexed into a
  per-engine-state table at 0xCC3/0xCCF, drives which loop song plays.
  `altitude_step` picks the current theme each frame.

What is still not named (~54 direct-call targets remain):

- **Smaller helpers reached from `render_object_pool`'s object-type
  handlers** (cs:0x4E82) -- 10 renderers, one per object class (flak burst,
  night fighter, target, dam wall, etc.) still want reading.
- **The intro/attract loop entry chain** -- `L_0006B` is the frame loop
  but the boot path from `entry` through the animated intro (calls to
  `main_setup`'s inits) has not been walked past what's already named.
- **Small draw helpers** in the 0xDBBA..0xDE70 range -- variants of
  `blit_rect` with different masks that appear 2-3 times each.

## The first thing to do

Run `build.ps1` and confirm it still reports BYTE-IDENTICAL at 26.7% decoded
with 32 names applied and byte hash `D3657960…`. Then keep going down the
ladder in this order — each rung's ratio drops sharply if the one above it
is skipped:

1. **The remaining phase dispatchers.** Seven of eight are unread. Each is a
   game state; naming them in evidence-first order will settle what
   `game_phase` and `requested_phase` actually enumerate and give a
   vocabulary for the rest of the reading.
2. **The two per-frame chains from `per_frame_step` and
   `check_phase_transition`.** These are where all the game-model updates
   live; splitting `per_frame_step` and naming its callees is the largest
   remaining piece.
3. **The other five jump tables** (cs:0x1045, cs:0x1610, cs:0x4e82 read at
   four offsets, cs:0x6f3e, cs:0x7e9e). Each one bounds a state machine.
4. **The bracketed constants** — 416 of 433 still unnamed. Many will land
   inside sprite/text tables (the ASCII-heavy 6 KB region at 0x7EFC..0x84C7
   and the 7 KB one at 0x0884B..0x9FC0 are almost certainly game text and
   sprite headers); those become `_data_spans` entries rather than named
   globals.
5. **`_data_spans`** — the partition of the whole image with a reason for
   each extent. Karateka's file finished at 100% by byte using this;
   Dam Busters has not started it yet.

## How to regenerate

```powershell
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

Three steps: reconstruct, apply names, **reassemble and compare**. It refuses
to report success on anything short of an identical SHA-256. Put your own copy
of the game in `original\`; this repository ships none.

## The rules, and they do not bend

**Nothing derived from the game may ever be committed.** Not the binary, not a
byte-identical reconstruction of it, not extracted sprites, not memory dumps,
not screenshots. `original/`, `recovered/` and `reference/` are gitignored and
game binaries are blocked repository-wide as a backstop. A sprite sheet pulled
out of a copyrighted game is still that game, and a PNG does not feel like a
binary, which is exactly why people forget. Read what you staged before every
commit that adds files; never `git add -A`.

**Byte-identity is the floor, not the achievement.** Emitting the whole file as
`db` would also hash correctly and tell you nothing. The number that matters is
how much came back as instructions, and after that how much has a name with
evidence behind it.

**Measure, never recall.** Six times in this project the question "is it
finished?" found a real gap, and every time the previous count read 100%
against the wrong denominator: prologues instead of call targets, references
instead of bytes, direct calls instead of every address control reaches. Put
the denominator in the same sentence as the percentage. `annotate.py` checks
all of them on every build and prints them -- **read that output, not a
document's memory of it.**

**Every name carries its evidence.** A name with no `why` is a guess the next
reader will believe. This project has published three of those and withdrawn
them.

**Do not use heredocs to write scripts.** They eat backslash escapes and the
check then passes while measuring nothing.

**No absolute paths in repository code.** Take toolchains as parameters.

## The ladder, in order

1. `build.ps1` reports **BYTE-IDENTICAL**. Nothing counts before this.
2. The decode rate is as high as the file allows. A low one means control is
   leaving somewhere the walk cannot follow -- find out where before naming
   anything.
3. Every **call target** named, with evidence. Not every prologue: a
   hand-written runtime has none, and Karateka read "120 of 120" while 56 call
   targets had no name.
4. Every **tail-call entry** -- an address a `jmp` reaches from outside the
   routine containing it. Karateka had 39 of those while the direct-call count
   read 165 of 165.
5. Every **bracketed constant** named, or recorded in `_displacements` as an
   offset rather than an address.
6. **`_data_spans`**: a contiguous partition of the whole image, no gap and no
   overlap, each extent saying what it is for. This is the denominator that
   catches a symbol file which names every reference and has never looked at
   half the file.
7. Then the documents `01`-`06`, then the port.

## Where to look

| | |
|---|---|
| the conventions | [`../CLAUDE.md`](../CLAUDE.md) |
| a game taken all the way | [`../paratrooper/`](../paratrooper/) -- six documents and a playable port in three files with **no image assets at all** |
| the fullest symbol file | [`../tapper/symbols.json`](../tapper/symbols.json) -- 583 routines, 336 globals, 43 spans |
| how to choose a hook | [`../../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md`](../../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md) |
| naming hand-written asm | [`../../DOS-Decompiler/knowledge/13-naming-hand-written-assembly.md`](../../DOS-Decompiler/knowledge/13-naming-hand-written-assembly.md) |
| when a game is a translation | [`../../DOS-Decompiler/knowledge/14-translated-binaries.md`](../../DOS-Decompiler/knowledge/14-translated-binaries.md) |
| a port brief, for later | [`../karateka/PORT-BRIEF.md`](../karateka/PORT-BRIEF.md) |
