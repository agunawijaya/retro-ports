# Phase 1 - Logic Discovery

## Scope And Limits

This report is static analysis only. No copyrighted game assets were extracted or reproduced. Raw evidence is saved under `docs/findings/`; interpretations below cite file offsets, load-image offsets, strings, and disassembly snippets. Because this is a 16-bit DOS executable with mixed code/data, the linear disassembly is evidence for anchors rather than a complete control-flow graph.

## File Identification

- Primary binary: `KARATEKA.EXE`, 87,990 bytes.
- Type: DOS MZ executable.
- Header evidence: `MZ` magic at file offset `0x0000`; parsed header in `docs/findings/file_identification.txt`.
- Header size: 512 bytes (`0x20` paragraphs).
- Load image size: 87,478 bytes.
- Entry point: `CS:IP 0000:0002`, load-image offset `0x0002`, file offset `0x0202`.
- Initial stack: `SS:SP 155C:0080`, load-image offset `0x15640`.
- Relocations: 4 entries, no overlay (`overlay number: 0`).
- Compiler/runtime evidence: string `Lattice C 2.1` at file offset `0x6EA2`.
- Packing/compression: unlikely. Evidence: low load-image entropy (`3.318 bits/byte`), many readable strings, visible runtime code, DOS call wrappers, and only 4 MZ relocations. This looks like a linked C program with embedded data and external resource files, not a packed stub.

## CPU And DOS Assumptions

- CPU mode: 16-bit x86 real mode.
- Minimum likely CPU: 8086/8088-compatible. Evidence: normal 16-bit DOS MZ startup, no required 286/386 protected-mode setup. Some Capstone output shows `cwde`/MMX-like mnemonics in data or ambiguous regions; these are likely disassembly-through-data artifacts.
- DOS dependency: high. Evidence: `int 21h` used for version, exit, console input, file, memory, and IOCTL operations.
- Runtime startup:
  - `0002: cli`, `0003: mov ax, 0x6ca`, `0006: mov ds, ax`
  - `0008: mov ax, 0x155c`, `000B: mov ss, ax`, `000D: mov sp, 0x80`, `0010: sti`
  - `0011: mov ah, 0x30`, `0013: int 0x21` asks DOS version.
  - `01F5: call 0x5953` transfers into the Lattice C main/runtime candidate.

## Display Hardware

The program targets IBM PC graphics adapters, apparently CGA-class graphics first, with direct adapter probing.

Evidence:

- User-facing adapter error string at file offset `0xB057`: `Karateka needs a graphics adapter card to operate correctly.`
- `0x4352: int 0x11` reads BIOS equipment flags.
- `0x4357: mov ah, 0xf`, `0x4359: int 0x10` gets current video mode.
- `0x428B: mov ah, 0`, `0x428D: mov al, 4`, `0x428F: int 0x10` sets BIOS video mode 4.
- CGA register/port access:
  - `0x4273: mov dx, 0x3bf`, `0x4278: out dx, al`
  - `0x42E7: mov dx, 0x3ba`
  - `0x433E: mov dx, 0x3b4`, then repeated indexed CRTC writes at `0x4348/0x434B`
  - `0x4334: mov dx, 0x3b8`, `0x4339: out dx, al`
- Video memory clearing at `0x4398..0x43A5`: sets `ES` from `[0xdf48]`, writes `0x4000` words of zero. This is consistent with clearing a 32 KB graphics buffer.
- Row-offset table setup:
  - `0x42B7..0x42CF` writes 200 entries stepping by `0x50`.
  - `0x42F3..0x4328` writes 50 groups of four interleaved offsets stepping by `0x5A`.

Hypothesis: the renderer supports at least CGA two-color/two-page style layouts and possibly alternate adapter paths. Exact adapter modes need runtime confirmation.

## Input Handling

Input is DOS console-based rather than raw keyboard interrupt hooking in the observed anchors.

Evidence:

- `0x41D2: mov ah, 7`, `0x41D4: int 0x21` reads a character without echo.
- Extended-key handling:
  - `0x41CE: cmp al, 0`
  - second DOS read at `0x41D2..0x41D4`
  - `0x41D6: cmp al, 0x4b` maps left arrow scan code to ASCII-like internal code `0x34` (`'4'`)
  - `0x41DE: cmp al, 0x4d` maps right arrow scan code to `0x36` (`'6'`)
- Control keys:
  - `0x4177: cmp al, 0x1b` handles Escape by consuming one more key and returning zero.
  - `0x417B: cmp al, 0x12` and `0x418C: cmp al, 0x13` trigger mode/sound-related routines.
- Built-in key map string near load offset `0x6Fxx`: `qazwsx46 b0.ind` followed by `.dat`. This suggests the classic keyboard layout is data-driven or used in script/resource loading.

Hypothesis: movement/combat controls use keys `q/a/z/w/s/x/4/6` plus space and possibly `b/0`. Needs dynamic confirmation.

## Timing

Timing uses BIOS timer ticks.

Evidence:

- `0x18BF..0x18CE`: `int 1Ah` reads BIOS time-of-day tick count and loops until `DX` changes.
- `0x18EF..0x190A`: stores tick value at `[0xbcd1]` and waits until at least 3 ticks have elapsed.

Hypothesis: the main game frame pacing is tied to BIOS timer tick deltas, likely approximately 18.2 Hz granularity with additional substeps or polling around animations.

## Sound

Sound output appears to use the PC speaker. No AdLib detection string or OPL port evidence was found in the current static scan.

Evidence:

- `0x3BDA: in al, 0x61`, `0x3BDE: out 0x61, al` manipulates PC speaker gate/control bits.
- `0x3DD6: in al, 0x61`, `0x3DDA: out 0x61, al` repeats speaker control.
- Sound/event dispatcher at `0x3BAE` uses `[0xd6bc]` as a mode flag and jumps through a table at `[bx - 0x2943]`.
- Script command string `set_tune` at file offset `0x7016` / load offset `0x6E16`.

## External Resource Architecture

The game is not a single self-contained executable. The directory contains many external data files:

- Backgrounds/resources: `CASTLE.BCG`, `FUJI.BCG`.
- Animation/data bundles: `KS*.DAT`, `KM*.DAT`, `KSI*.DAT`, `KMI*.DAT`, `KSC.DAT`, `KMC.DAT`.
- Index files: matching `.IND` files with pairs of 16-bit values and sentinels like `FFFF` and `8080`.
- Script/command names at load offset `0x6E16`: `set_tune`, `set_bg`, `set_fig`, `chg_fig`, `do_scr`, `del_fig`, `set_wipe`, `set_nowipe`, `wait`, `init_sal`, `set_pos`, `inc_x`, `loop`, `end_animation`.
- Resource name strings near load offset `0x6E9E`: `bal00`, `bal01`, `bal02`, `bal03`, `ks0`, `ks1`, `ks2`, `ks3`, `ks4`, `ksc`, `ksi0`, `ksi1`, `ksi2`, `ksj2`, `ksi3`, `ksi4`, `ksj4`, and matching `km*` names.
- DOS file wrappers:
  - `0x5CC4/0x5CC6`: open file, `AH=3Dh`, `int 21h`
  - `0x5CF8/0x5CFA`: read file, `AH=3Fh`, `int 21h`
  - `0x5D17/0x5D19`: write file, `AH=40h`, `int 21h`
  - `0x5D30/0x5D3B`: seek, `AH=42h`, `int 21h`

Interpretation: `.IND` files are likely resource index tables for frames/scripts inside matching `.DAT` files. The first value often looks like an ID/state number, followed by an offset; `FFFF` acts as an end marker.

Runtime confirmation from DOSBox-X (`docs/findings/dosboxx_runtime.log` and `docs/findings/dosboxx_runtime_notes.md`):

- DOSBox-X executed `karateka.exe`.
- The game set BIOS video mode 4.
- Observed resource open order: `allpal`, `ksc.ind`, `ksc.dat`, `kmc.ind`, `kmc.dat`, `allgal`, `fuji.bcg`, `ks0.ind`, `ks0.dat`, `km0.ind`, `km0.dat`, `bal00`, `ksi.ind`, `ksi.dat`, `kmi.ind`, `kmi.dat`, then `title.bcg`.
- The run later reaches the disk prompt path. Static analysis found direct BIOS `int 13h` floppy-sector reads around `0x16C2..0x1717`; see `docs/findings/disk_check_notes.md`. This means an extracted-folder mount can satisfy ordinary file opens but may not satisfy raw floppy-sector validation.

## Rendering Approach

Observed rendering appears to be software drawing into a RAM/video buffer, with adapter-specific write paths.

Evidence:

- `0x0B4E..0x0B5A` clears a large internal buffer starting at `[0x337]` for `0x1F40` words.
- `0x0BC9..0x0C14` iterates a draw list at `[0xbb30..]`, reading records of four bytes until `0xFF`, and calls either `0x0640` or `0x083C` depending on flag bits.
- `0x0C52..0x0CE4` builds patterned background areas using fills like `0x5555`, `0x9999`, `0x6666`, and copies from `[0xacb2]`.
- Direct CRTC/video memory work at `0x4273..0x43A9`.

Hypothesis: the renderer composes backgrounds plus figure sprites into an offscreen or structured buffer, then maps to CGA memory layout.

## Animation System

The animation system is strongly data/script driven.

Evidence:

- Script op names listed at load offset `0x6E16`.
- Routines around `0x0B5E..0x0BC8` read byte streams from two independent pointers:
  - `[0x421E]` reads from base `0x443C`
  - `[0x4220]` reads from base `0x893A`
  - byte `0x7B` means repeat/hold: the next byte is a counter, then repeated output byte is cached in `[0x422D]` or `[0x422F]`.
- Loader/parser code at `0x1027..0x121A` reads resource data into tables at `0x423C` and `0x893A`, scanning records in four-byte groups until an ID byte `0xFF`.

Interpretation: there are at least two animation/script streams, probably one for each actor or for background/foreground figure layers. The command names imply operations for figure selection, position, wipe/no-wipe, and waits.

## Collision And Combat Logic

Static anchors indicate actor state tables and draw/animation streams, but exact combat resolution was not fully recovered.

Evidence:

- Input routine maps left/right and command keys, so player action state is likely derived from returned internal key codes (`0x34`, `0x36`, etc.).
- `0x43AA..0x4420` computes values from table lookups near `0xE0F8..0xE14A` based on a direction/state parameter and a position value. This looks like a spatial classification or collision/drawing helper, but the exact role is not proven.
- Multiple global state words near low memory are used:
  - `[0x160]`, `[0x162]`, `[0x164]`, `[0x168]`, `[0x172]` reset in `0x19D1..0x19E4`.
  - `[0xE4]`, `[0xEA]`, `[0xEE]` used as rendering/game mode controls in `0x0C52..0x0D39` and temporarily saved/restored in `0x190B..0x1975`.

Hypothesis: combat resolution is table-driven from animation states, positions, and action windows rather than continuous physics. Needs DOSBox debugger or emulator tracing around the input-to-state transition.

## State Machine And Progression

The game likely uses a high-level script/event state machine.

Evidence:

- Script commands include `loop` and `end_animation`.
- External resource groups are staged by names: opening/title/background files (`allgal`, `fuji.bcg`, `title.bcg`, `cal00`, `cal01`), castle (`castle.bcg`), animation groups (`ks*`, `km*`), intro/ending story text.
- Story strings are embedded:
  - copyright string at file offset `0x12B44`.
  - intro text at file offsets `0x14A55..0x14C2D`.
  - ending text at `0x14C61..0x14D56`.
  - disk prompt at `0x14D9A`.

Hypothesis: level/progression is represented as script resources plus global state variables selecting scenes and animation sets.

## Important Memory Locations

These are static names assigned from observed behavior:

- `[0x000F]`: DOS version/runtime mode byte set after `int 21h AH=30h`.
- `[0x0015]`: runtime stack/top allocation value set during startup.
- `[0x005B]`: PSP segment saved from `ES`.
- `[0x006B..0x006F]`: environment/argument pointer area used by startup.
- `[0x0080]`: runtime error/status word used by DOS wrappers.
- `[0x0160]`, `[0x0162]`, `[0x0164]`, `[0x0168]`, `[0x0172]`: game/render state words reset during scene setup.
- `[0x0337]`: internal draw/back buffer base candidate.
- `[0x421E]`, `[0x4220]`: animation stream pointers.
- `[0x422C..0x422F]`: repeat counters/cached bytes for animation streams.
- `[0xDF40..0xDF48]`: input/video globals; `[0xDF42]` stores last key, `[0xDF43]` key-ready flag, `[0xDF48]` video segment candidate.
- `[0xD6BC]`: sound mode flag toggled by input control key and used by sound dispatcher.
- `[0xBCD1]`: last BIOS tick value.

## Main Loop Hypothesis

Evidence-based sequence:

1. MZ startup initializes segments, stack, DOS version, argv/env, heap.
2. Startup calls `0x5953`, a Lattice C `main` candidate.
3. `0x5953` parses command-line arguments, opens standard handles, then calls `0x0255`.
4. Game setup loads indexed resources with wrappers around DOS open/read/seek.
5. Video adapter is probed and initialized around `0x4352..0x438B`.
6. Scene setup/reset occurs around `0x19AE..0x19E9`.
7. Per-frame loop likely:
   - poll input via `0x4149`
   - wait/tick using `0x18F8..0x190A`
   - advance animation streams via `0x0B5E..0x0BC8`
   - update actor/game state
   - render draw list via `0x0BC9..0x0D39`
   - trigger PC speaker events through `0x3BAE`

Needs debug confirmation: exact loop head and branches, player/enemy state offsets, and hit/hurt state transition tables.
