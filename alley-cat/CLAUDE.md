# Alley Cat (1984) — working notes

Context for an agent working in this folder. **Read the numbers `build.ps1`
prints, not this file's memory of them.**

Bill Williams for Synapse Software, published by Datasoft.

## Where this stands

*Last measured 2026-08-21.*

| | |
|---|---|
| rebuild | **byte-identical**, `4979C886…` |
| decoded as code | 25,250 / 54,555 bytes (46.3%), 26,291 with pins (48.2%) |
| instructions | 9,171 disassembled (518 pinned) |
| call targets named | **258 of 258 (100%)** |
| tail-call entries named | **3 of 3 (100%)** |
| bracketed constants named | **69 of 685** (10.1% -- next slice) |
| routines / globals | **280 / 75** |
| data spans | **54 spans covering 100%** (31 named + 3 sprite banks + 20 unread gaps) |

Triaged on 2026-08-02, orientation done on 2026-08-21 in three passes
plus a `DOS-Decompiler` walker fix (see the section below).
The named routines cover the entry; the video/keyboard/timer/sound
primitives; the CGA blitter family (`blit_cga_interleaved` and its
ES-prefixed twin); the sprite save/draw/restore trio
(`snapshot_video_rect` / `sprite_draw_saving_bg` /
`restore_video_from_snapshot`); the mask-blit underneath
(`sprite_and_mask_blit`); the sprite-list interpreter (`blit_sprite_list`);
the PRNG and its seed; a boxes-overlap utility; the sound-effect and beep
primitives (`sfx_start_tone`, `beep_blocking`,
`speaker_write_divisor_and_gate`, `advance_pit_pattern_step`,
`init_sound_state`); the CGA-screen clear (`clear_cga_screen`); the BIOS
teletype helpers (`bios_print_string`, `bios_set_cursor_row`,
`print_next_message`); and the **main-loop structure**
(`attract_loop_start`, `attract_show_title`, `attract_show_title_and_wait`,
`new_game_setup`, `game_frame_top`, `game_frame_body`,
`end_of_room_pick_next`, `dispatch_current_phase`). See [BRIEF.md](BRIEF.md)
for the triage; `symbols.json` holds the evidence for every name.

The confirmed master mute flag is at DS:0 (`sound_enabled`) -- set to 0xFF
at boot, toggled by `not byte [0]` when key state byte 0x6C7 fires, and
tested at the top of 22+ sound routines. That single flag alone matches on
25 bracketed references, most of the coverage jump from pass 1 to pass 2.

The main-loop reading (pass 3) surfaced the game's phase machine:
`[current_phase]` at DS:4 is a value 0..7 that indexes the 8-word dispatch
table at CS:0x250 (image 0x7480). Each level exit runs
`end_of_room_pick_next`, which PRNG-picks the next phase from one of two
tables (weighted `phase_select_table_weighted` at DS:0x421 or uniform
`phase_select_table_uniform` at DS:0x42D) with two-slot history dedup.
That is the "cat picks its next room" logic. The specific mapping from
phase number to Alley Cat room (birdcage, aquarium, cheese/mice, dog,
sleeping woman, kittens) needs a runtime hook -- see
`knowledge/12-hooking-the-right-thing.md`.

Pass 4 (also 2026-08-21) read the two most-visible phase bodies -- phase_1
(the initial state at boot, also reached from PRNG slot 0) and phase_2
(reached from phase_1 via `[phase_1_to_2_trigger]` non-zero, an in-scene
transition that does not go through end_of_room_pick_next). Named the
shared init sequence (`screen_transition_wipe` with its outward-iris
`draw_transition_iris`, `init_phase_screen_pattern`,
`set_cat_position_for_phase` reading `phase_start_col_table` and
`phase_start_row_table`), the per-frame updates
(`handle_keyboard_events`, `poll_joystick_or_delay`,
`update_speaker_sweep`, `movement_tick_scheduler`, `init_gameplay_state`,
`init_object_slot_32XX`), and the phase-1-specific
`phase_1_object_tick` + `cycle_phase_1_bg_pattern`, plus phase-2's
`init_phase_2_actors`.

Pass 5 (2026-08-21) covered the remaining phase handlers (3..7) by call
structure. Every phase has: 1 or 2 init routines (`init_phase_N_state_*`
or `init_phase_N_actors`) that zero-init phase-specific state blocks
scattered through the data segment (blocks at 0x37AF, 0x3964, 0x3EAE,
0x40A8, 0x4548, 0x70EE); and 2-3 per-frame tick routines
(`phase_N_tick_a`, `phase_N_tick_b`, ...). Phase 7 stands out: its exit
OR is missing 0x552 (the level-end flag) and it does not call the
per-frame gameplay updates -- almost certainly the game-over/scoreboard
screen. Phase 6 conditionally chooses between `L_09093` and `L_0A380`
based on `[sound_gate_flag]`. Phase 1 handler was renamed from
`phase_01_handler` because dispatch slot 0 lands here too but the
handler asserts `mov word [4], 1` at its top.

Pass 6 (2026-08-21) named the hottest remaining unnamed routines by call
count: `sprite_colored_blit_with_save` (L_09EFC, the 12-caller
colored-sprite primitive that does per-pixel CGA mode-4 mask ops with
0x30C0/0xFF0), `advance_frame_scheduler` (L_09093, the vretrace-gated
per-frame counter advance that alternates its threshold), `blit_sprite_lists_4x/5x`
(L_09B88/L_09BA0 -- batch renderers over pointer tables at 0x263C),
`check_attract_collision` (L_08DAA), `check_cat_at_trigger_zone`
(L_09325, the fence-to-window trigger), `advance_sound_timer`, and the
phase-7-specific sprite pair `render_phase_7_sprite` /
`restore_phase_7_sprite_bg`.

Pass 7 (2026-08-21) worked through the 0x076D0..0x08F9E cluster of
early-code-segment routines: `spawn_countdown_tick` (periodic spawner
with vretrace and slot-empty gates), `shift_sprite_column_rcr` /
`shift_sprite_column_rcl` (paired pixel-column bit-shift for sprite
scrolling), `check_cat_row_in_zone` (range check on cat_row_plus_50
against a per-object zone), `draw_speaker_pattern` (0xAAAA/0x4444 pattern
for the cat's mouth animation), `pick_random_from_4_ptr_table`,
`reset_movement_scheduler`, `initialize_cat_start_position` (the
left-vs-right entry logic when a game starts), `sfx_meow`,
`set_screen_bounds_for_phase` (phase-7 has tighter bounds), and
`set_pcjr_palette_register`.

Pass 8 (2026-08-21) refined the coarse first partition into **54 spans**:
28 named clusters (one per identifiable group of related globals -- the
cat's per-frame state block, the phase select tables, the iris/palette
tables, each phase's state block, the sound state, the message tables,
etc.) and 22 unread gaps between them, plus the pre-DS zero-fill and
the CS segment. Every byte from image 0x0 to 0xD51B is now inside a
reasoned span with no gap and no overlap. The unread spans total
roughly 20 KB of the 29 KB DS segment -- that is the honest gap the
_data_spans denominator makes visible.

Dam Busters has 112 spans for 65 KB; Alley Cat is at 54 for 54 KB.

Pass 9 (2026-08-21) sampled bytes in the three largest unread spans and
reclassified all three as CGA sprite/graphics banks: `sprite_data_bank_a`
(4,453 bytes at 0x07CD..0x1931), `sprite_data_bank_b` (4,966 bytes at
0x46BA..0x5A1F), and `sprite_data_bank_c` (3,079 bytes at 0x6230..0x6E36).
The first two were confirmed by pattern (`FC 0F FF FF FF...`, CGA mode 4
2-bpp packed pixels); the third was inferred from position and size. That
converts 12,498 bytes (~23% of the file) from 'unread' to 'known to be
artwork', without pretending each sprite inside has been parsed.

The remaining unread spans are all under 2 KB. Per-sprite partitioning
of the three banks is future work, along with the pointer tables that
index into them (some referenced from `[bx + 0x1853]`, `[bx + 0x1679]`,
`[0x70F0] + 0x6F30` in the code).

Pass 10 (2026-08-21) extracted the game's text strings from the binary
and drafted [`docs/01-the-game.md`](docs/01-the-game.md). Found the
boot menu (three skill levels: House Cat / Tomcat / Alley Cat), the
in-game control help (Ctrl-S sound, Ctrl-R restart, Ctrl-M menu, Esc
= "paws mode"), and the CGA/joystick detection messages. The doc
follows the pattern of ParaTrooper's and Dam Busters' 01 -- every
quoted string is anchored to a file offset. What the doc explicitly
does NOT do: name the six mini-game rooms, or credit the author. The
Atari-original attribution (Bill Williams / Synapse Software) is
marked `[inferred]` because no string in `CAT.EXE` confirms it.

Pass 11 (2026-08-21) drafted [`docs/02-architecture.md`](docs/02-architecture.md)
-- 332 lines covering the memory layout (two segments, 9 relocations),
the CGA video system (the five blitters, the two-bank interleave, iris
wipe, palette apply), the two INT 09h keyboard handlers (PC and PCjr
variants), the timer strategy (BIOS INT 1Ah + PIT ch0 direct reads,
no timer interrupt handler), the PC-speaker sound engine (five
primitives, master mute at DS:0), the 6-instruction LFSR PRNG, and
the phase-dispatch machine. All facts are direct code quotes or
routine names with the evidence in symbols.json. Six items are
listed as still-unknown at the end of the doc.

Pass 12 (2026-08-21) drafted [`docs/03-the-code.md`](docs/03-the-code.md)
-- 613 lines walking through eight key routines end to end with the
actual assembly quoted: the entry (with the `push ds / push 0`
return-to-DOS trick), startup_video_probe (CGA/MDA detection dance),
keyboard_isr (the 22-slot scancode/state pattern), blit_cga_interleaved
(the two-bank XOR-flip idiom), the sprite save/draw/restore trio,
prng_step + seed_random_from_pit (6-instruction LFSR with 0xFA59
fallback), dispatch_current_phase + end_of_room_pick_next (the phase
dispatch with the CS-relative table that took the walker fix), and
the speaker primitives (speaker_off, speaker_write_divisor_and_gate,
sfx_start_tone, advance_pit_pattern_step). Closes with a "what was
remarkable in 1984" section covering the two-ISR PCjr support and the
`shr cx, 1` compensation for PC-vs-PCjr CPU speed.

Pass 20 (2026-08-21, later) closed the loop with a runtime hook. Ran
`comrun.py --call init_attract_screen` on `recovered/rebuilt.exe` (the
reconstruction, not the original, to prove they render identically) and
captured the CGA framebuffer to PNG. The title screen came out reading

  IBM PRESENTS
  Alley Cat(TM)
  By Bill Williams
  (C) Copyright SynSoft(TM) 1984

which settled three claims that docs/01 had marked `[inferred]` (Bill
Williams, SynSoft, 1984) and revealed a fourth that had not been in the
document at all (IBM co-published this release, consistent with the
extensive PCjr support). Running `--call phase_N_handler` for each phase
identified phases 0/1/2 as the **fishbowl/aquarium**: cat on the top rim
with 8 fish swimming below; phase 2 draws a "cat sits down" variant of
the same scene, confirming that `phase_1_to_2_trigger` is an in-scene
transition. Phases 3..7 come out black when called cold because their
inner-loop exit-OR triggers on uninitialised state; mapping those five
requires poking the state or running `new_game_setup` first.

Passes 13-19 (2026-08-21) drove call-target coverage from 31% to
**100%** across six focused naming batches: hot-caller helpers (BCD
score adder, sprite-per-phase draw/erase pairs, the 5-slot object
iterators), the keyboard-event dispatcher chain (handle_keyboard_events
and all its dispatch targets), the sound engine's second-tier
primitives (advance_sound_timer, wait_bios_tick_from_5A14, the
beep-and-sweep family beep_390_or_silent / beep_400_or_silent /
beep_double_high_low / beep_sweep_1F4_to_0), the joystick calibration
routines (calibrate_joystick, check_gameport_and_calibrate,
wait_joystick_button_released), the intro/boot music engine
(advance_boot_animation_counter, init_boot_music_5A10,
reset_boot_animation_state, spin_pit_delta_from_5A16), the phase-N
tick pairs and per-slot state initializers (init_phase_3_state_a/b,
init_phase_4_actors, init_phase_5_state, init_phase_7_state), and
the three tail-call entries (tail_check_restart_flags,
tail_return_to_new_game_or_attract, warm_boot_via_bios_reboot which
sets the BIOS 40:0072 warm-boot magic 0x1234). Final tally:
**280 routines named, 258/258 call targets, 3/3 tail-call entries,
byte-identical rebuild sustained across all 19 passes.** Alley Cat
has now reached the same completeness bar as Dam Busters on the
naming ladder.

### Segment layout is being read correctly

The 2026-08-02 concern from BRIEF was whether the .COM route was reading
segments right. It is. Evidence:

- Only one distinct segment value is patched by the loader — `0010h` (all 9
  relocations write it).
- The entry code at image 0x7230 does `mov ax, 0x10 / mov ds, ax` at image
  offset 0x7239 (file 0x7439). That matches relocation [0] which patches
  segment 0x0010 at file 0x7439 exactly.
- All DS-relative loads that follow (`[0x690]`, `[0x697]`, `[0x412]`, ...)
  point into the 27.9 KB pre-entry data region as expected.
- The walker followed both INT 09h handlers — at CS:0x14B3 (image 0x86E3)
  for standard PC and CS:0x14FB (image 0x872B) for PCjr. Both decode as
  clean ISRs with `in al, 0x60 / EOI 0x20`.

The 1,348 "code" bytes at image 0x0-0x544 are zero-fill disassembling as
`add byte [bx+si], al` (opcode 0x00 0x00). Not real code — inflates the
decoded-bytes number by ~2.4%. Real code is contiguous from the entry.

## The walker gap this game surfaced, and what fixed it

*Found and fixed 2026-08-21.*

**comrec was silently reading `jmp word [cs:bx + disp]` dispatch as
flat-model.** The main loop's phase selector at L_07479 is exactly this
form:

```
mov bx, word [4]         ; current_phase
cmp bx, 7
jbe L_07479
sub bx, bx
L_07479:
shl bx, 1
jmp word [cs:bx + 0x250] ; -- comrec used to stop here
```

For a single-segment .COM (Karateka, all 11 .COM regression fixtures) CS
is set to the load segment at boot and CS-relative offsets are the same as
flat file offsets. The walker was written for that case. But for a MZ that
took the .COM route with a CS != 0 in the header (Alley Cat: CS = 0x0723,
so cs_base = 0x7230), the CS-relative displacement 0x250 has to be added
to cs_base to reach the actual dispatch table at image 0x7480 -- not read
as image 0x0250, which is zero-fill in the data segment. Same story for
the *words inside* the table: they are CS-relative offsets, not flat.

The fix is small: `mz_load_image` returns cs_base = cs << 4, the
Reconstructor carries it, and `detect_jump_tables` -- which already
captured the `cs:` prefix in its regex -- adds cs_base whenever that
prefix was present. When cs_base is 0 (Karateka, Dam Busters, all the
fixtures), nothing changes.

At Alley Cat: decode rate **41.4% -> 46.3%**, instructions **8,293 ->
9,171**, call targets **203 -> 258** (all 7 phase handlers plus every
routine they reach), bracketed constants **628 -> 685**. Same
byte-identical hash. Regression: Karateka rebuilds unchanged
(`C8736BBA...`, 218 routines / 165 of 165 call targets), Dam Busters
rebuilds unchanged (`D3657960...`, 158 of 158, 112 spans), and all 11
`.COM` fixtures still pass.

## The one thing to know before touching it

**The relocation-count guard is what almost lost this one, and the fix is
already in the tree — but the reason it is there is worth carrying forward.**

`comrec.py` used to refuse any file with more than eight relocations. That
threshold was picked when Karateka (four) was the only example anybody had.
Alley Cat has **nine**, and the first attempt failed with a message that read
as "the .COM route does not apply here." It did apply. The rule was one
relocation too tight.

The current build passes `--max-relocations 16` and gets a byte-identical
rebuild at 41.4% decoded. **But byte-identity does not prove the address base
was right.** Frogger rebuilds exactly while reading half its code from the
wrong segment; the only symptom is a decode rate that stays low for no visible
reason. 41.4% on a 54 KB game is plausible — data-heavy games decode in that
range — but if further reading finds control leaving the walk in a pattern
that says "wrong segment," the nine relocations and the multi-segment layout
are where to look. **Do not raise `--max-relocations` for other games** to
match; the guard is protecting against something real, and it is per-game on
purpose.

## What triage found, and what it implies

- MZ, 512-byte header, load image `0x200..0xD71B` (54,555 bytes)
- **9 relocations** across 54 KB — multi-segment, but barely
- entry `CS:IP 0723:0000`, file offset `0x7430`
- no trailing data

Nine relocations across 54 KB means the program is laid out in several segments
but most addressing stays within one. The entry sits **two thirds of the way
into the image** at `0x7430`, so the 30 KB before it is either reached from
there or is data. That is the first thing the reading has to establish, and
`tools/profile.py` is the way in: what calls into the pre-entry region, and
what does not.

## How to regenerate

```powershell
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

Three steps: reconstruct, name, **rebuild and compare**. It refuses to report
success on anything short of an identical SHA-256. `tools/profile.py` in the
toolkit prints what can be said about each unnamed routine and address without
guessing — interrupts, ports, stored constants, callers, callees, writers,
readers.

This repository ships no game files. Put your own copy of `CAT.EXE` in
`original\`. Nothing in `recovered\` may be committed: a byte-identical
reconstruction is the game, named or not.

## What is open, in the order it is worth doing

1. ~~Confirm the segment layout is being read correctly.~~ Done 2026-08-21.
2. Name the remaining **175 of 203** call targets, with evidence. Still
   unnamed: L_09EFC (a colored/patterned blit variant that reads a byte
   from DS:SI and does pattern manipulation with the 0x30C0/0xFF0 masks --
   more study needed to name confidently), L_08430 (a delta-tick check
   reading INT 1Ah AH=0 into DS:[0x69F], mixed with a joystick-port read
   at 0x201), L_08396 (a sprite blit at row [0x57B]/col [0x579] from
   source 0x1679 with dims 0x1205 -- specific game object, not yet
   identified), L_08568 (a keyboard-event observer that reads
   key_tick_counter and dispatches on state-byte bits), and the phase
   entries below. Working outward from the main loop is likely more
   productive than picking off hotness.
3. **The main loop is unread.** L_072B1 (outer), L_072C0 (inner) call a
   sequence including L_08F61 (`apply_palette`, named), L_0CD51 (named),
   L_0CEE0, L_0CD84 (also named as start of the sound-tick tracker but not
   fully -- it uses `[0x59BE]` and `[0x59C0]`), and dispatch tables.
   Reading L_072B1..L_073A6 all the way through will surface the phase
   dispatch, at which point the game's structure becomes visible.
4. Name the remaining **599 of 628** bracketed constants; record the ones
   that are displacements rather than addresses in `_displacements`.
5. Name every **tail-call entry** -- annotate reports zero unnamed today,
   but that is because it counts only tail-calls reaching a currently
   unnamed address; as call targets get named it will find more.
6. `_data_spans`: a contiguous partition of all 54,555 bytes, no gap and
   no overlap. The 30 KB pre-entry data region alone will need several
   spans (palette tables 0x1853/0x183B/0x1843/0x184B, key tables at
   0x6A1/0x6B7, blit scratch at 0x2AE0, sprite scratch at 0x5FA,
   messages/rows at 0x6D37/0x6D63, etc.).
7. Documents `01`-`06`, and a port. [ParaTrooper](../paratrooper/) is the
   worked example of both.

Note: the CLAUDE.md previously listed `tools/profile.py` as the way to
enumerate unnamed routines. That tool does not exist in the toolkit today
(2026-08-21 check of `E:\Projects\DOS-Decompiler\tools\`). `annotate.py`
prints the unnamed-target list in its own report; that is the source of
truth used above.

## Where to look

| | |
|---|---|
| repository conventions | [`../CLAUDE.md`](../CLAUDE.md) |
| the triage that set this up | [`BRIEF.md`](BRIEF.md) |
| a game taken all the way | [`../paratrooper/`](../paratrooper/) |
| the fullest symbol file | [`../tapper/symbols.json`](../tapper/symbols.json) |
| how to choose a hook | [`../../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md`](../../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md) |
| naming hand-written asm | [`../../DOS-Decompiler/knowledge/13-naming-hand-written-assembly.md`](../../DOS-Decompiler/knowledge/13-naming-hand-written-assembly.md) |
