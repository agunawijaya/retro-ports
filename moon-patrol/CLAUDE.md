# Working on Moon Patrol

Context for an agent picking up work in this folder. The
[root CLAUDE.md](../CLAUDE.md) still applies — this only adds what is specific
to Moon Patrol, so that facts already established are not re-derived.

Read [BRIEF.md](BRIEF.md) first — it is the triage that opened the reading up,
and it records the traps in the order they were hit. Then
[docs/02-architecture.md](docs/02-architecture.md) for how the DOS program is
shaped, and [docs/03-the-code.md](docs/03-the-code.md) for a walk of the
routines in reading order. This file is the working reference; the documents
are the explanation.

## Session pickup — 2026-08-04

**Where the port stands and what needs the user's eyes next.**

Today's work in order (both under `web/game.js`):

1. Read the Computer Archeology arcade docs at
   `E:\Projects\Arcade Games\Moon Patrol` — score table (Z80 2A0C),
   sound roster (F400), enemy list (`ObjectDraws` at 08F5), attract-mode
   flag (E046 bit 7), frame rate 56.74 Hz. Baked into `WAVE_PHASES[]`,
   `ARCADE_SCORE[]`, `Audio_` effect names.
2. Reverse-engineered the sprite format from `blit_sprite_or` at file
   0x53F9: `(width_bytes, height_rows, CGA-packed pixels)`.
   `tools/extract_sprites.py` dumps all three atlases to
   `recovered/sprites/` (gitignored).
3. Identified 4 arcade sprites and wired them into `loadDosAssets()`:
   `A[24]` buggy 36x9, `A[13]` UFO 36x9, `A[16]` tank 52x14, `A[1]`
   title illustration 56x15.
4. **Independent wheel suspension** on the buggy — sprite split into
   body (rows 0..6) + two wheel patches (rows 7..8 at cols 7..11 and
   17..21), wheels drawn at independent `terrainHeight()` samples.
5. Attempted to use `A[19]` and `A[14]`/`A[0]` as mountains/plant/rock
   sprites. **A[19] was wrong** — referee frame
   `reference/game-35000000.png` shows mountains as single-pixel white
   zigzag with height variation, not a filled sprite. Reverted to
   zigzag with `ampMod` for variety.
6. **Crater** rewritten from "skip terrain column entirely" (looked
   bottomless) to "push terrain top down by `sqrt(1-t²) * CRATER_DEPTH`
   in the crater's X range" — proper depression with magenta walls
   and floor.
7. **Wordmark** now uses `measureTextScaled()` to size the cyan box
   around the text, not the other way round — L stays inside.
8. **Start key** — F1 was intercepted by the browser (Help). Fix:
   accept ANY key or canvas click as start. F2 / Tab / Digit2 open
   options. Canvas has `tabindex="0"` and auto-focuses on load.
9. **Shot wrap-around** — killed shots used `s.x = -100` sentinel, but
   cleanup only removed `x > W+10`; killed shots drifted back into
   view at `vx = +4`. Fix: `dead` flag consulted by cleanup.

**Things the user REPORTED as broken today but I have not
play-verified yet** — try these first in the next session:

- Press F1 / Space / Enter / any key at title → does the game start?
  (New any-key-or-click logic should handle it; needs a human test.)
- Fire forward Z → does the shot vanish at the right edge and stay
  gone? (No wrap-around after collision cleanup.)
- Does the crater now look like a bowl and not a bottomless pit?
- Do the mountains show varying peaks instead of one repeated tile?
- Is "MOON PATROL" fully inside the cyan title box?

**How the user tests** — they open <http://localhost:8765/web/> after
running `python -m http.server 8765 --directory E:\Projects\retro-ports\moon-patrol`
(the moon-patrol/ parent dir, so `fetch('../original/PATROL.COM')` works).
They report visual defects concretely; trust their observation.

**What is genuinely still open** (not user-facing bugs, actual
port gaps):

- Buggy has 2 wheel positions; arcade shows 4 (front pair, rear pair).
  Bumping to 4 wheels would need re-splitting the sprite.
- Mines, small/medium rocks, bombs still primitive. Their arcade
  sprite IDs are not yet identified — dump `recovered/sprites/*.png`
  with `tools/extract_sprites.py` and eyeball them.
- Title illustration (A[1] loaded but not composited) — could replace
  the plain wordmark for a much richer title.
- Fully arcade-accurate wave sequence — `WAVE_PHASES[]` is scripted
  data-driven but not the actual arcade byte stream.
- Sound-effect mapping for DOS `sound_effect_B75/BBC/DA7` — needs
  a `comrun.py` audio capture.

## State of the work

**The decompilation is read.** The rebuild is byte-identical, the code region
is 88% decoded, every call target and tail-call entry is named, and 29
`_data_spans` partition the whole 58,306-byte file with no gap and no overlap.

**All six documents are written.** 01 the game, 02 architecture, 03 the code
walk, 04 the porting decision, 05 the port's architecture, 06 the port's code.

**A port is in `web/`** — three files (`index.html`, `game.js`, `style.css`,
~1800 lines of game code), no build step, opens standalone. It is
**a rewrite informed by two sources**:

1. The DOS decompilation in `../symbols.json` (screen model, palette,
   HUD, split-screen shape, buggy bounds, terrain wrap).
2. The **Computer Archeology arcade docs** at
   `E:\Projects\Arcade Games\Moon Patrol` (mirror of
   <https://computerarcheology.com/Arcade/MoonPatrol/>) — the 1982 Irem
   Z80/6803 ROM's score table, enemy roster, sound-effect roster, frame
   rate, and attract-mode behaviour. The DOS conversion is a port of the
   same game, so game *design* facts carry across; the *hardware*
   facts do not.

Every constant in `game.js` carries either the routine that names it
in `../symbols.json` (tagged `[DOS]`), the arcade doc file that names it
(tagged `[arcade]`), or an explicit `[invented]/[inferred]` note that
points at [docs/04-porting.md](docs/04-porting.md). See
[docs/05-web-architecture.md § Provenance](docs/05-web-architecture.md#provenance)
for the four-group rule that keeps this honest.

**Features implemented in v1**:

- **Arcade-accurate sprites decoded from PATROL.COM at run time.**
  The atlas record format was reverse-engineered from the blit
  routine at file 0x53F9: `(width_bytes, height_rows, CGA-packed
  pixels...)`. `tools/extract_sprites.py` dumps all three atlases
  to PNG for identification; `tools/screenshots.ps1` serves the
  moon-patrol/ folder so `web/game.js` can `fetch('../original/PATROL.COM')`.
  Identified sprites: atlas A[24] = buggy (36x9), A[13] = UFO (36x9),
  A[16] = tank (52x14), A[1] = title illustration (56x15). Falls
  back to primitive shapes if PATROL.COM is not available.
- **Independent wheel suspension** -- iconic Moon Patrol behaviour.
  Each wheel of the buggy samples `terrainHeight()` at its own world
  X and is drawn at that Y independent of the chassis. On rough
  terrain, wheels visibly bounce apart while the body rides above
  the higher of the two. The extracted-sprite path splits the 9-row
  buggy sprite into a 7-row body + two 5x2 wheel patches so the
  suspension effect works with real arcade art.
- Title screen with wordmark banner, starfield, mountains, buggy
  silhouette, and an overhead UFO -- drawn from primitives in the CGA
  palette. The `A[1]` title-illustration sprite is loaded but not
  rendered on the title yet; a v2 could composite it in.
- Options menu (F2 → B/C/S), F1 start.
- Buggy movement + jump + variable-height hold, forward + up shots.
- Enemy roster: **three rock sizes** (20 / 100 / 300 pts), craters
  (50-pt bonus for jumping), UFOs with dropped bombs, tanks with tank
  shots, ground mines with a 32-frame animation split at frame 11,
  space plants (tall, not jumpable, only killable with forward gun).
- **Continuous space-plant sound** — one Web Audio oscillator per
  live plant with slow LFO wobble, capped at 3 voices. Started on
  spawn, stopped on kill or off-screen.
- **Scripted per-checkpoint wave phases** (`WAVE_PHASES[]`) with 8
  difficulty tiers gated by checkpoint index. Deterministic tick
  wobble replaces random spawn intervals; no `Math.random()` drives
  gameplay any more.
- Champion course tightens intervals to 82% and swaps colour scheme
  (cyan ↔ magenta on buggy and HUD border).
- Attract-mode demo after 10s idle; any key aborts.
- 6-digit BCD score, HIGH / current / POINT / TIME HUD, checkpoint
  bar A-Z with `E J O T Z` markers, lives counter, pause (P), mute (M).
- No score per checkpoint (matches arcade behaviour); 1000-pt goal
  bonus at Z (arcade "GOOD BONUS POINTS").
- Sound effects named after arcade sound roster
  (`shot / jump / rockExplosion / ufoExplosion / carExplosion /
  ufoFlying / passingPoint / coin / reachingGoal`) — arcade command
  IDs 12, 14, 01, 11, 1F, 17, 10, 13, 1D. Frequencies invented.

**Not implemented, per user's explicit ask**: joystick support, and
two-player alternating play. The DOS/arcade mechanisms for both are
documented in `docs/01`, `docs/02`, and `symbols.json` for reference,
but nothing about them is wired into the port. `[1]` / `[2]` are not
even shown on the option screen; the 2UP HUD row is left blank.

**Still open by nature, not by choice** (short list now):

- **Exact wave bytes.** Arcade `E600` text-command list and DOS
  `DS:0xC46`/`0xC93` opcode streams are still opaque. The port's
  `WAVE_PHASES[]` is a scripted stand-in with the right *shape*
  (data-driven, per-checkpoint), not the exact sequence.
- **Exact enemy-to-score-tier mapping** for tank / mine / UFO / bomb /
  plant. Arcade extracts label only rocks (tier 4 = 100 or a per-rock
  byte 0..13) and crater-jump (tier 2 = 50). Everything else the port
  assigns tiers `[inferred]` from context.
- **Which DOS `sound_effect_B75/BBC/DA7` stream maps to which arcade
  sound-command ID.** Needs a `comrun.py` audio capture.
- **Sprite art for the smaller enemies** -- rocks (three sizes),
  craters, mines, plants, bombs still render as primitives. Their
  atlas entries exist but haven't been identified visually yet.
  `tools/extract_sprites.py` dumps candidates to
  `recovered/sprites/` (gitignored) for a future pass.

**Rand1to3 note**: the arcade has one "random" routine, `LD A,R` at
Z80 `17F0` (DRAM refresh counter, distribution 25%/50%/25% over
{1, 2, 3}). It is used to vary explosion animations, not gameplay
decisions. The port does not need to reproduce it, and because it
depends on Z80 hardware behaviour it could not be reproduced faithfully
even if we wanted to.

**`window.selfTest()` passes six checks** — palette identity, buggy-field
width (from `check_bounds_5C_A3_8E`), terrain wrap (from `advance_scroll`),
PRNG determinism, `resetGame(seed)` reproducibility, and a 300-tick
simulation. Verified under a fake DOM in Node; **not yet visually
confirmed in a real browser** — that is the next thing to do.

**A previous port existed at `E:\Projects\Moon Patrol\`** (arcade-lineage
Z80/6803 reconstruction with a ~5 MB single-file HTML wrapper) and was
deliberately not brought over. The reasons are recorded in the session that
built this port and in the memory at
`C:\Users\aguna\.claude\projects\E--Projects-retro-ports\memory\feedback_no_guessing.md`
— the old port mirrored the arcade `gameplay.asm`, not the DOS binary we
decompiled here, and had a dormant 80 KB of ROM-derived hex inline. This
port starts from the reading in `symbols.json`.

| | |
|---|---|
| rebuild | byte-identical, `FF12627C…` |
| routines named | 175 — all 130 call targets, 0 unnamed tail-call entries |
| globals named | 257 |
| bracketed constants | 328 covered — 243 as globals, 85 in `_displacements` as struct offsets |
| data spans | 29, partition all 58,306 bytes with no gap and no overlap |
| code region `0x0000..0x54C9` | 21,705 bytes, **88.3% decoded** (8,578 instructions, 463 pinned) |
| whole file | 32.9% decoded — most of the rest is sprite tables and script data in the 36 KB data tail |
| what it actually is | a mechanical **6502 to 8086 translation** — same class as [hard-hat-mack](../hard-hat-mack/). See [knowledge/14](../../DOS-Decompiler/knowledge/14-translated-binaries.md) |
| referee | **proven** — `comrun.py` on `recovered/rebuilt.bin` reaches the title screen and, with F1 fed to the game's own int 9 ISR at file 0x405, drops into attract-mode gameplay with a clean HUD render |

## Source you can rebuild

`recovered/moon-patrol.asm` is correct and is not source. `symbols.json`
holds the reading — 175 routines and 257 globals, each with the evidence for
its name, plus `_displacements` for the 85 struct-offset constants and
`_data_spans` for the whole-file partition — and the toolkit's `annotate.py`
checks and applies it.

```powershell
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

Three steps: reconstruct with `--segment 0x100:0 --entry 0x100`, apply names
from `symbols.json`, reassemble and compare. Refuses to report success on
anything short of the original SHA-256.

**This game is not compiled C** — zero `push bp` prologues — so routines are
enumerated by *call target* rather than by prologue. There is no C runtime here
to identify with `probelib.py`; `comrec.py`'s 6502-translation detector is what
identifies it.

Nothing the build produces may be committed: `original/`, `recovered/` and
`reference/` are gitignored, because a byte-identical reconstruction is the
game whether or not it has names on it, and a PNG pulled from a referee run is
the game's screen.

## Regenerating

```powershell
mkdir original
copy <your copy>\PATROL.COM original\
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

## Regenerating the port screenshots

The two PNGs in `screenshots/` (`title.png`, `gameplay.png`) are the
port's own artwork -- nothing from PATROL.COM is used at run time --
so they live inside the repo and are committed with the rest of the
port. To refresh them:

```powershell
tools\screenshots.ps1 -Chrome "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

The script starts `python -m http.server` against `web/`, polls until
the port answers, then runs headless Chrome twice: once at the title
and once at gameplay via the `?start&demo&seed=42` URL. Both files
land in `screenshots/`; nothing is written to a temp directory.

Expected:

    BYTE-IDENTICAL  FF12627CE23EF72BEB8072F0327805F56D7592F35E819EBA4C46F3D51C8451C9

You need Python with `capstone` and `unicorn`, and NASM on the path (or in the
`-Nasm` argument). The 58,306-byte `PATROL.COM` goes in `original/`; this
repository ships no game files.

**Do not drop the `--segment 0x100:0 --entry 0x100` flags** — they are what
made the decode rate go from 0.5% to 88.3%, and the reason is in
[BRIEF.md](BRIEF.md#what-the-earlier-triage-got-wrong-on-the-record). Comrec
cannot see the entry target by static walk because the pointer is written at
run time; the flags seed it explicitly.

## The two things that will trip you

**The file has two address bases.** File 0x0000..0x00FF runs at ORG 0x100 (the
`.COM` load position); file 0x0100 onward runs in a new segment addressed from
0. The entry stub writes its own far-jump target at run time and jumps through
it. A near jump at file 0x100 like `e9 eb 01` reads as `jmp 0x1EE` in the
new base, which is file 0x2EE. In the listing the labels are file offsets, so
`L_002EE` is that same instruction. Get this wrong and every address in the
code region is off by 0x100.

**DS is not CS.** `startup` sets `DS = CS + 0x55D paragraphs`, so
`DS:0x0000 = file 0x56D0` — 517 bytes past the end of the code region. A bare
`[0x81E0]` in the listing addresses file 0xD8B0, which is the
`          Game Options          ` banner in the data tail. `cs:` and bare-DS
references are two different address spaces. [zaxxon](../zaxxon/CLAUDE.md) has
the same rule with a different bias.

## Where things are

File offsets. Add nothing — the coordinate is what the listing uses.

| | |
|---|---|
| `0x0000..0x00FF` | entry stub, ORG 0x100. Writes the far-jump target at `0x140`/`0x142`, jumps through it |
| `0x0100` | first byte of the new segment — `e9 eb 01` = `jmp 0x1EE` |
| `0x02EE` | `startup` — disables NMI, sets DS, sets up CGA, unmasks NMI, jumps to main menu |
| `0x0405` | the int 9 (keyboard) ISR — pushes ax/bx/ds, dispatches by scancode |
| `0x04CB` | `irq_epilogue` — the tail every ISR arm jumps to |
| `0x0505` | `reset_and_reboot` — the Ctrl+Alt+Del exit, chains to BIOS int 9 saved at `[0x8812]` |
| `0x0562..0x0573` | `peek_key` / `wait_key_up` / `clear_key` — the input primitives |
| `0x0573` | `enter_cga_graphics` — int 10h mode 4, palette 1 (cyan/magenta/white), background 0 |
| `0x082E` | video setup — CRTC programming for CGA graphics |
| `0x4ECB` | main menu / title loop |
| `0x54C9` | end of the code region; everything below is data |

DS-relative addresses (`DS:0` = file 0x56D0):

| | |
|---|---|
| `DS:0x0000` | keyboard state and scratch — `[0x100]` is the key-ready byte, low bits scancode, top bit "ready" |
| `DS:0x0140`/`0x0142` | the far-jump pointer the entry stub writes and jumps through |
| `DS:0x1210` / `0x1242` / `0x1268` | sprite pointer tables |
| `DS:0x53C9` | `row_dispatch_table` — 200 entries indexed by scanline, supplies the per-row ES value the blit uses. Populated at startup; the runtime bytes differ from the file bytes in 165 of 167 positions |
| `DS:0x556F` | sound engine |
| `DS:0x0C46` / `0x0C93` | script tables |
| `DS:0x8814` | saved original ES |
| `DS:0x8812` | saved BIOS int 9 vector, chained by `reset_and_reboot` |
| `DS:0x8818` | in-game flag |
| `DS:0x8819` | current video mode marker |

## Conventions this program uses (because it was a 6502 program)

- **AL is the accumulator.** BL is X, CL is Y. Every byte moves through AL.
- **Sixteen-bit arithmetic is done byte-by-byte with `adc`**, even where the
  8086 could do it in one instruction.
- **`cmc` after `cmp` inverts the carry sense** so the 6502's `BCS`/`BCC`
  behaviour is preserved. 281 of them in this file, 99% straight after a
  compare.
- **No register push/pop**. Callee state lives in fixed globals.
- **Every global is a fixed address**, because the 6502 addressed the same way.

If any of this is surprising, read [knowledge/14](../../DOS-Decompiler/knowledge/14-translated-binaries.md)
before reasoning about the code.

## The referee run, and what it corrected

`comrun.py` on `recovered/rebuilt.bin` reaches the title screen and, with F1
fed to the game's own int 9 ISR at file 0x405, drops into attract-mode
gameplay. The HUD reads `HIGH 001550 / 000000 / 2UP 000000` on the left,
`POINT / TIME 000` and the A-Z checkpoint arrow on the right, the buggy icon
and life count in the corner, and the moon buggy on scrolling terrain below.

```powershell
python ..\..\DOS-Decompiler\tools\comrun.py recovered\rebuilt.bin `
       --png reference\screen-boot.png --palette 1
```

Two things worth internalising, both on the record in
[BRIEF.md](BRIEF.md#what-the-referee-run-corrected-and-then-re-corrected):

- **Capture timing matters.** A single referee frame that shows pixel garbage
  can be the game working normally, sampled mid-XOR-erase. A second run at a
  different budget clears it. Look at more than one frame before drawing
  conclusions from what a frame does not show.
- **A byte-identical static reading can still be wrong** in ways only a runtime
  referee can catch. The scanline-table interpretation was correct, was
  declared broken from one garbage frame, and then confirmed again from a
  clean frame. The blit routines were renamed the other way (`blit_sprite_or`
  and `blit_sprite_and`, not `_xor` and `_copy`) after reading the inner ops.

## What is genuinely open

Two things, and both are informational:

- **The exact encoding of `row_dispatch_table`.** The runtime values do not
  match a plain CGA segment table (0xB800 + row/2 * 5) in the spot-check, so
  entries may combine row and column shift, or encode something a frame-by-
  frame trace would clarify. `symbols.json` names it `row_dispatch_table` with
  that uncertainty on the record.
- **`annotate.py` prints `0x00011 had nowhere to go`.** 0x0011 is inside a run
  `comrec` decoded as instructions (`add byte [bx+si], al` on 238 bytes of
  zeros). The span is right; the message just says the heading cannot be
  placed as a label without splitting a code run. Byte-identity hashes
  correctly with it there.

Neither blocks a port. Both are candidates for a runtime-tracing pass if the
port needs the exact indexing.

## The port in `web/`

Three files, opened by loading `web/index.html` in a browser — no build step.

    web/index.html    canvas, controls, footer
    web/game.js       the port (855 lines)
    web/style.css     CGA-palette styling (146 lines)

Nothing is ripped from the shipped binary. The pixel art is drawn from scratch
on a 320×200 canvas in the same four-colour CGA palette (cyan/magenta/white on
black) the original targeted. The rules — checkpoint letters, jump timing,
buggy behaviour — come from the reading in `symbols.json`.

**It is not a byte-accurate emulation.** Docs 04-06 do not exist yet; when
they are written they should say plainly what was ported at the mechanical
level and what was recreated from the reading. Follow the ParaTrooper template
for shape and honesty.

If you touch `web/`, keep `selfTest()` on `window` in the browser console (see
the root CLAUDE.md's "Verifying the port" section) — a page that loads is not
a page that works, and one syntax error kills a classic script while the page
still renders.

## Before you commit

- `original/`, `recovered/` and `reference/` are all gitignored. The third
  is the one people forget: PNGs from referee runs, memory dumps and CGA
  captures are all the game in another form. Check `git status` — never
  `git add -A`.
- Every figure in this file, in [BRIEF.md](BRIEF.md), in the README, and in
  `docs/01..03` must match what the tools print now. The counts drift the
  moment `annotate.py` or `comrec.py` improves — the root CLAUDE.md's warning
  about denominators applies here too.
- Every Markdown link and anchor must resolve; there is no renderer here, so
  check Mermaid blocks structurally — balanced brackets and quotes, matched
  `subgraph`/`end`, no edge to an undeclared node.

## Where to look

| | |
|---|---|
| the conventions | [`../CLAUDE.md`](../CLAUDE.md) |
| the triage that opened this up | [BRIEF.md](BRIEF.md) |
| how the DOS program is shaped | [docs/02-architecture.md](docs/02-architecture.md) |
| a walk of the code | [docs/03-the-code.md](docs/03-the-code.md) |
| the other 6502 translation in the collection | [`../hard-hat-mack/`](../hard-hat-mack/) |
| a port taken all the way | [`../paratrooper/`](../paratrooper/) — the template for docs 04-06 |
| when a game is a translation | [`../../DOS-Decompiler/knowledge/14-translated-binaries.md`](../../DOS-Decompiler/knowledge/14-translated-binaries.md) |
| naming hand-written asm | [`../../DOS-Decompiler/knowledge/13-naming-hand-written-assembly.md`](../../DOS-Decompiler/knowledge/13-naming-hand-written-assembly.md) |
