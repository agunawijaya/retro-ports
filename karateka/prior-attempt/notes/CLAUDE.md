# CLAUDE.md — Karateka DOS reverse-engineering

Project context for future Claude Code sessions. Read this first, then dive
into the numbered docs.

## What this directory is

The original **1986 Karateka IBM PC port** (Brøderbund, ported by The
Connelley Group from Mechner's 1984 Apple II original) plus a
reverse-engineering investigation aimed at extracting clean assets for a
TypeScript/Canvas2D remake.

- Original game files: `KARATEKA.EXE`, `*.BCG`, `K[MS]*.{DAT,IND}`,
  `BAL*`, `CAL*`, `ALL*`, `PRNGAL` — see `08-original-files-inventory.md`
  for the full catalogue.
- Patched executable: `KARATEKA_NOCHK.EXE` (disk-check patched out — not
  original).
- Memory dumps from DOSBox-X: `MEMDUMP_*.BIN` — ground truth captures.
- Python tools: `extract_dos_sprites_v2.py` is the current working
  extractor; older `*.py` scripts used the wrong KM/KS interpretation and
  are superseded.
- Output: `remake_assets/` (DOS backgrounds + sprite fragments + Apple II
  / NES rips), `extracted/`, plus `princess_one_pose.png` / `akuma_one_pose.png`.
- Web remake skeleton: `karateka-web/` (HTML + `src/karateka.js` + assets).
  The remake itself has not been built yet — `07-remake-prompt.md` is the
  resume prompt the user plans to paste into a fresh session.

## Where to start each session

**Read `10-investigation-progress.md` first.** It is the consolidated
state-of-the-investigation doc and supersedes any conflicting claims in
the older numbered docs. Then consult:

| Doc | When to read |
|---|---|
| `10-investigation-progress.md` | Always — overall state, blockers, what's proven |
| `08-original-files-inventory.md` | When you need to know what a file is |
| `09-runtime-memory-and-capture.md` | Before any sprite extraction or DOSBox-X capture |
| `06-debug-findings.md` §12 | Runtime memory map specifics |
| `07-remake-prompt.md` | When building the TS/Canvas2D remake |
| `01`–`05` | Background context; partially superseded by `06` and `10` |

## Critical gotchas (don't repeat past mistakes)

1. **Figure IDs ≠ sprite IDs.** `set_fig,208` in BAL/CAL scripts is NOT a
   lookup into `.IND` files. `.IND` IDs are in the 257–477 range; figure
   IDs are 0–255 and resolve through a runtime recipe table. Treating
   them as the same cost ~half a day on a prior session. See
   `10` §5.4 and the `[[project-figure-ind-gotcha]]` memory.

2. **KM = alpha mask, KS = color.** Earlier notes (including
   `06-debug-findings.md` §8) had this reversed. The corrected decoder
   lives in `extract_dos_sprites_v2.py`. Verified against KS0 sprite
   `0x0166` (hero's magenta-capped head). See `10` §5.1.

3. **Clean character PNGs in this project are shadow-buffer crops, not
   code-built renders.** The recipe-resolution algorithm is traced and
   proven (`10` §11), but a working from-scratch character renderer does
   NOT exist — sub-byte X rotation and shadow-buffer accumulation are
   unimplemented. Don't claim "we can rebuild any frame from sprite data"
   — see `10` §12 for the honest reckoning.

4. **The IBM PC port is 1986, not 1984.** Apple II original is 1984; DOS
   port is 1986 (proven by the runtime copyright string).

5. **Recipe commands are 4 bytes, not 5.** `<fig_byte> <x_LE16> <y>`.
   The recurring `0x04` is usually a `Y` value, not a command opcode.
   See `10` §11.1.

## Engine model (one-paragraph recap)

ASCII scene scripts (BAL/CAL/ALL*/PRNGAL) → parsed to a binary command
stream at `DS:0xBB30+0x1B5` → each `set_fig,FIG X Y` resolves through
two lookup tables at `DS:0x423C` (KSC offsets) and `DS:0x873A` (KMC
offsets), indexed by `figure_byte*2` → per-shape blitter at
`image+0x0640` decodes RLE and writes to the 16 KB shadow buffer at
`DS:0x337` → slow 4-pass column reveal copies to CGA VRAM at
`B800:0000` (interlaced, mode 4, palette 1 = black/cyan/magenta/white).

POP's published 1989 Apple II source is the reference implementation
for this engine model — Karateka EXE bytes at `0x14786+` are
3-byte `<Fimage, Fdx, Fdy>` records analogous to POP's `FRAMEDEF.S`
5-byte records (minus sword + collision). See `10` §9.

## Working capture workflow (DOSBox-X)

The user is hands-on with DOSBox-X and willing to capture memory live.
The proven flow for static scenes (Princess, Akuma, backgrounds):

1. Boot via `dosbox-x_run.conf` → reach target scene.
2. Pause, drop to debugger, `MEMDUMPBIN ds:337 4000` to grab the shadow
   buffer.
3. Decode with the linear CGA-mode-4 decoder (see `09` §3).
4. Diff against an empty-shadow baseline, crop the delta.

Fight/dynamic scenes don't hold a populated buffer long enough —
workaround is `Ctrl+F11` × many to slow CPU before pausing, or fall back
to Apple II / NES rips for action poses.

## Persistent memory

Long-term context lives in
`C:\Users\aguna\.claude\projects\E--Projects-DOS-Games-Karateka-karateka\memory\`
indexed by `MEMORY.md`. Update those entries — not this file — when
something surprising or non-obvious comes up across sessions.
