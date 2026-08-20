# Working on The Dam Busters

Context for an agent picking up work in this folder. The
[root CLAUDE.md](../CLAUDE.md) still applies — this only adds what is specific
to Dam Busters, so that facts already established are not re-derived.

This file is the working reference. [BRIEF.md](BRIEF.md) is the historical
triage from 2026-08-02 plus the toolkit-fix narrative from 2026-08-19 — read
it once, then use this file. [docs/01-the-game.md](docs/01-the-game.md)
explains what The Dam Busters is as a game — the 1943 raid it dramatises,
the crew stations, the phases, and how to win it — read before working on
the port.

## State of the work

**Reading complete on the naming ladder, still byte-identical.**
`symbols.json` holds **241 routines and 290 globals**, each with the evidence
for its name, and every byte in the load image is inside a named or reasoned
_data_span. `annotate.py` reports:

| | |
|---|---|
| rebuild | `D3657960A00AAC6548C47EE35A8AC008EF0BB254F94AE2A335B04431F26C380D` byte-identical |
| bytes as code | 16,838 / 65,028 (25.9%), 17,364 with pins (26.7%) |
| instructions | 5,690 (262 pinned) |
| call targets named | **158 of 158 (100%)** |
| tail-call entries named | **6 of 6** |
| bracketed constants named | 260 of 433 (60%) + 13 recorded as displacements |
| routines / globals | 241 / 290 |
| `_data_spans` | **112 spans, 65,028 bytes covering 0x00000..0x0FE04 (100% of image)** |

**Quote both numbers when you say "how much is decoded".** 25.9% is the file
number and it describes the game — most of Dam Busters is text, sprites and
tables. The code region needs to be measured separately (there is not yet a
single boundary quoted for it), and until it is, the whole-file number is
what to use.

The reading started at 12.3% decoded on 2026-08-19. Three walker limitations
in comrec fixed on 2026-08-19 (recorded in
[BRIEF.md](BRIEF.md#where-control-went-that-the-walk-could-not-follow-2026-08-19))
took it to 26.7% at the same hash; the naming then walked outward from the
entry stub through every subsystem.

## What the game is, in one paragraph

A 1984 Sydney Development flight sim of the RAF's Operation Chastise (the
617 Squadron raid on the Ruhr dams). Six regions of Europe to fly across
(Great Britain, Belgium, North Germany, France, Eastern France, South
Germany) — each with its own physics via `apply_region_flight_effect`.
Nine game phases: three flight views (forward, bomb-aimer, rear-gunner), a
bomb-options page, a map region-select, a cockpit controls menu, a
target/options menu, an end-of-run scoreboard, and an idle phase. The
Lancaster has four engines, each with two adjustable slider values and a
one-shot fire extinguisher.

## How to regenerate

Have a copy of the game in `original\DAMB.EXE`, then:

```powershell
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

Three steps: reconstruct, apply names, **reassemble and compare**. The
script refuses to report success on anything short of the original SHA-256
and prints the 124 trailing bytes it adds after the load image (see the
trap below).

`build.ps1` should print, unchanged from what is quoted above:

```
BYTE-IDENTICAL. wrote recovered\dam-busters.asm
              wrote dam-busters.mzheader (512 bytes)
              ...
241 routine names, 290 globals
  applied: ...
  names 158 of 158 call targets
  no unnamed tail-call entries
  covers 260 of 433 bracketed constants, and 13 more are recorded as displacements or as not addresses at all
  160 unnamed: 0x00C8, 0x0190, 0x05DD, 0x09EA, 0x0D44, 0x1234, 0x128E, 0x1682, 0x1683, 0x16A8...
  112 data spans cover 0x00000..0x0FE04, 65,028 bytes with no gap and no overlap
BYTE-IDENTICAL  D3657960A00AAC6548C47EE35A8AC008EF0BB254F94AE2A335B04431F26C380D
```

If any of those numbers moved, either the toolkit improved (re-measure and
update this file) or something broke (find out what before naming more).

## The three things that will trip you

**The file keeps 124 bytes past the declared load image.** DOS never loads
them and comrec never sees them, so a naive `header + image` rebuild comes
out short and the hash misses. `build.ps1` puts them back and says so on
the way out. `mzinfo.py` warns about trailing data for exactly this reason.

**Zero prologues in 65 KB — this is hand-written 8086 assembly, not C.**
Routines are enumerated by call target, not by `push bp`. `libscan.py` and
`probelib.py` find nothing here, correctly. Every named routine has its
evidence from reading, not from a compiler signature.

**Three walker fixes are baked into the toolkit.** Wrap-around near calls,
bare-`bx` dispatch tables, and negative displacements in those tables — all
in [`../../DOS-Decompiler/tools/comrec.py`](../../DOS-Decompiler/tools/comrec.py)
as of `8907d76`. If you run this with an earlier comrec, the decode rate
drops back to 12.3%, call targets fall from 158 to 75, and most of what is
named in `symbols.json` becomes unreachable. Karateka and the 11 `.COM`
regression fixtures still pass unchanged; details in
[BRIEF.md](BRIEF.md#where-control-went-that-the-walk-could-not-follow-2026-08-19).

## The architecture, in one table

| | |
|---|---|
| entry | `0x00000` — MZ from `CS:IP = 0000:0000`, sets `DS := CS` and falls into a 16-round detection loop |
| post-boot | `0x0002F` — saves SP for the restart path, brings up the video/timer/kbd subsystems |
| main setup | `0x0005F` — starts the ambient song, installs the ISRs |
| frame loop | `0x0006B` — CLI/STI transfers `tick_flags` -> `tick_flags_working`, waits for bit 0, calls `per_frame_step` + `check_phase_transition`, dispatches to `phase_dispatch[game_phase]` |
| restart | `0x00053` — target of `jmp restart_run` when end-of-run flag and restart-ready flag agree |

## The nine phases, and what selects each

**`phase_dispatch`** at `0x00B9` (9 entries) — main_loop calls
`word [game_phase * 2 + 0xB9]` each frame. **`phase_init_dispatch`** at
`0x08D2` (8 entries) — `check_phase_transition` calls this once when
`requested_phase` changes.

| phase | init | step | what it is |
|---|---|---|---|
| 0 | `flight_forward_init` | `flight_forward_step` | pilot/navigator view; `physics_step` reads `[0x306B]` bit-wise for pitch/roll |
| 1 | `flight_bombrun_init` | `flight_bombrun_step` | bomb-aimer with the target-lock rectangle at `[0x3EBD..0x3EC3]` |
| 2 | `flight_rearview_init` | `flight_rearview_step` | rear-gunner — same 3D pipeline with `neg ax` on all three camera coords |
| 3 | `bomb_options_init` | `bomb_options_step` | two YES/NO toggles at `[0x4B61]` and `[0x4B62]`, drawn by `draw_bomb_options` |
| 4 | `map_screen_init` | `map_screen_step` | six-region raid map ('GREAT BRITAIN', 'BELGIUM', 'NORTH GERMANY', 'FRANCE', 'EASTERN FRANCE', 'SOUTH GERMANY') at `0x015C..0x0195` |
| 5 | `menu_main_init` | `menu_main_step` | **cockpit controls** — text at 0x13A6: 'BOOSTER GAUGES', 'RPM GAUGES', 'THROTTLES', 'FIRE EXT.', 'BOOSTERS'. Dispatches through `menu_action_dispatch` (cs:0x1610) |
| 6 | `menu_second_init` | `menu_second_step` | target/altitude selector — two 3-position cyclers (`cycle_selector_a`, `cycle_selector_b`) |
| 7 | `results_init` | `results_step` | end-of-run stats; 10 counters formatted by `format_decimal` into the template |
| 8 | (none) | `ret_stub` | idle — `check_phase_transition` never leaves phase 8 |

## The eleven jump tables

Every dispatcher and where it lives. Named ones are one line in
`symbols.json`; unnamed ones would be if their targets had been read.

| table | targets | selected by | status |
|---|---|---|---|
| `phase_dispatch` (0x00B9) | 9 | `game_phase` | named |
| `phase_init_dispatch` (0x08D2) | 8 | `requested_phase` on transition | named |
| `region_effect_dispatch` (0x1045) | 6 (4 unique) | `map_region` | named |
| `menu_action_dispatch` (0x1610) | 19 | `menu_cursor` | 15 of 19 named |
| `object_render_dispatch` (0x4E82) | 10, read at 4 offsets | object type `[si + 0xA]` | table named, **10 per-type renderers unnamed** |
| (0x6F3E) | 3 | `bx` guarded by `cmp bx, 6 / jae` | unnamed |
| (0x7E9E) | 3 | `bx` | unnamed |
| `dl_dispatch` (0xDF18) | 10 | `draw_display_list` opcode byte | all 10 named as `dl_opcode_*` |

Plus one unresolved indirect: a single `jmp bx` at ~0x6F53 whose value comes
from `mov si, word [0x6EAB] / mov bx, word [si]` — a callback stored in
memory, and the writer has not been read.

## Key subsystems, one line each

- **Video** — `init_cga_mode`, `set_default_palette`, `set_border_color`, `clear_cga_frame`. CGA mode 4 at `0xB800`, 320x200x4.
- **Keyboard** — `save_kbd_isr`, `install_kbd_isr` (INT 9 at `cs:0xD271`, INT 0 at `cs:0xD445`), `restore_kbd_isr`, plus `peek_key`, `flush_key`, `wait_key_or_timeout`.
- **Timer / music** — `install_timer_isr` (INT 1Ch), `timer_isr` (drives frame ticks and PIT-channel-2 music), `play_song`, `set_loop_song`, `wait_ticks`.
- **PRNG** — `prng_step` (an 8-bit LFSR over the 256-byte state table at `prng_state_table` 0xE381).
- **CGA blit** — `blit_rect` is the primitive; every drawer builds on it. Scan-line addresses come from `cga_row_table` at 0xE4A2 (which handles the interleave).
- **Drawing DSL** — `draw_display_list` (0xDF0E) interprets a bytecode of 10 opcodes, called 34 times from every phase's init.
- **3D projection** — `project_point_2d` is the matrix multiply; `update_camera_transform` rebuilds sin/cos each frame; `render_object_pool` walks 20 slots and dispatches per type.

## Key globals to know before you touch anything

| addr | name | what |
|---|---|---|
| `[0x00100]` / `[0x00102]` | `plane_x` / `plane_y` | world position, integrated by `step_plane_position` |
| `[0x00104]` | `map_region` | 0..5, selects `region_effect_dispatch` |
| `[0x00108]` | `target_region` | region containing the target (0xFFFF = unset) |
| `[0x005DB]` | `game_phase` | 0..8, indexes `phase_dispatch` |
| `[0x00BC9]` | `heading` | 0..0x167 degrees |
| `[0x00BCB]` | `distance_travelled` | from mission start |
| `[0x00CE6]` | `altitude` | > 0x186 → crash reason 7 |
| `[0x0173D]` | `engine_states` | 4-byte per-engine status (0/1/2) |
| `[0x03072]` | `auto_stabilise` | when zero, `integrate_heading` saturates to [-6, +6] |
| `[0x03070]` / `[0x0306D]` | `roll` / `throttle` | inputs |
| `[0x0D1CD]` | `requested_phase` | writer for `check_phase_transition` |
| `[0x0D1C7]` | `end_of_run_flag` | frame_loop wait-and-restart trigger |
| `[0x0D1C2]` | `input_flags` | per-frame INT 9 output, bit-wise up/down/left/right |
| `[0x0E140]` | `tick_counter` | timer_isr counter |
| `[0x0E144]` / `[0x0E146]` | `tick_flags` / `tick_flags_working` | frame-tick + subdivided-tick bitfield |
| `[0x07D33]` | `end_run_reason` | index into 9-entry message table at 0x7FE1 |

## What is still open

**All 158 direct-call targets are named. All 6 tail-call entries are named.**
**`_data_spans` now covers 100% of the image contiguously** (0x0..0x0FE04 --
every byte in the load image sits inside a named or reasoned span, with no
gap and no overlap). What is left is smaller.

- **160 unnamed bracketed constants** (260 of 433 covered + 13 as
  displacements). Many of these are inside the sprite/text tables that the
  span partition subsumes with a coarse reason rather than a per-address name.
  Naming more of them would refine the coverage number without necessarily
  teaching anything new. The leading addresses in the current unnamed list
  are 0x00C8 (a per-menu byte-field), 0x0190 (a byte in the region-title
  string table), 0x0D44 (a per-engine damage-status byte table used by
  check_flight_conditions), 0x1682/0x1683 (the per-slot X/Y coord tables
  draw_menu_cursor reads), 0x1234 and 0x128E (inside get_map_tile's
  addressing math), and a run through 0x16Axx (menu_main state fields near
  the row counters).
- **One indirect not resolved** — the `jmp bx` at 0x06F53, where BX is loaded
  from memory that no static reading has traced (the pointer is at
  `jmp_bx_indirect_ptr` 0x6EAB → 0x6EAD, but its writer is not visible
  statically). Solving it would need a runtime hook (see
  `../../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md`).
- **Two dispatchers still un-decoded** — `cs:0x7E9E` (walker resolves 3
  distinct targets; the table is actually 8 word entries pointing at 3 real
  targets, one per grade-message class -- recorded in _data_spans at
  0x7E9E) and the 4-slot cs:0x4EB2, which has a couple of entries with values
  `0x300` and `0xA06` that the walker refused as too-early. Those are
  false-positive targets; the real table sizes are smaller than 10.
- **Two globals inside code** — flak_active_type_b (0x6B7D) and
  flak_active_type_a (0x6B7F). Both are documented as sub-state counters for
  check_flak_hit / check_flak_hit_type4, but statically their bytes disassemble
  as parts of instructions. Either the memory references are misidentified or
  the routine reads them via an addressing pattern the reading has not
  followed. Recorded as a note on the 0x6AD7 code region span; leaving them
  here for the next reader to settle.

## The order to work in

1. Fill in the small game-state globals as they surface while reading. Chase
   the 160 unnamed bracketed constants down when they resolve cleanly; do not
   invent names for the ones that do not.
2. Then documents 02-06 (01 is done — see [docs/01-the-game.md](docs/01-the-game.md)),
   in the order the root CLAUDE.md prescribes.
3. Then the port. [`../karateka/PORT-BRIEF.md`](../karateka/PORT-BRIEF.md)
   is the reference for what that looks like.

## Before you commit

- `original/`, `recovered/`, `reference/` and `*.zip` are gitignored, and
  `dam-busters/dam-busters/` (the extracted release) is too. Check
  `git status` — never `git add -A`.
- Any change to the numbers above must land in this file, `BRIEF.md`, and
  the root `CLAUDE.md` before commit. The root CLAUDE.md warns that eleven
  numbers had gone stale within one session; this game has the same risk.
- The three toolkit fixes are already in `DOS-Decompiler` as commit
  `8907d76`. If comrec regresses on any of the three, the decode rate here
  falls back to 12.3% — verify by rebuild before assuming a break is
  elsewhere.
