# 10 — Investigation progress & open questions

> **Audience: yourself, weeks/months later, or a future Claude.**
> Consolidated state of the reverse-engineering investigation as of the
> end of the late-night Princess/Akuma/Soldier sessions. Captures what
> works, what doesn't, what was tried, and exactly where to pick up.

---

## 1. TL;DR — current state of understanding

```
┌──────────────────────────────────────────────────────────────────────┐
│ Engine algorithm:  KNOWN end-to-end (disassembly + runtime dumps)    │
│ Decoder (single sprite piece):  WORKING  (KM=alpha, KS=color)        │
│ Composition algorithm:  TRACED IN ASSEMBLY (see §11)                  │
│ Figure→sprite table: CAPTURED + MAPPED (fig N = IND position N)      │
│ Background extraction:  WORKING (shadow-buffer crop, 16 PNGs done)   │
│ Static-scene character extraction: WORKING (Princess + Akuma done    │
│                                    — but via shadow-buffer CROPS)    │
│ Dynamic-scene character extraction (e.g. kick mid-action): BLOCKED   │
│ Building chars from sprite data alone (no shadow-buffer help):       │
│                              FAILED — see §12 for honest reckoning   │
└──────────────────────────────────────────────────────────────────────┘
```

Plain-English summary: **"The engine algorithm is fully traced — we know
exactly how a recipe byte becomes a screen pixel. But we have NOT
generated a clean character render from sprite data alone; every clean
character PNG in this project (Princess, Akuma, soldier) was cropped from
a runtime shadow-buffer dump, not built from sprite tables. The remaining
gap — implementing the blitter's sub-byte X rotation and shadow-buffer
state — is significant additional work."**

---

## 2. The engine data flow (final understanding)

```
┌──────────────────────────────────────────────────────────┐
│ Layer 0 — ASCII scripts                                   │
│   Files: BAL00..BAL03F, CAL00..CAL07A, ALLBAL, ALLCAL,    │
│          ALLGAL, ALLPAL, ALLVAL, PRNGAL                   │
│   Commands: set_fig,FIG X Y / chg_fig,SLOT FIG X Y /      │
│             do_scr / set_tune / set_wipe / etc.           │
│   Figure-ID namespace: 0..255 (small numbers)             │
└────────────────────┬─────────────────────────────────────┘
                     │ parsed on scene load
                     ▼
┌──────────────────────────────────────────────────────────┐
│ Layer 1 — Binary scene-script buffer                      │
│   Lives at runtime memory:  DS:0xBB30 + 0x1B5..0xFF       │
│   Command format: 04 <fig> <x_LE16> <y>  (5 bytes)        │
│   Control opcodes: 0x00, 0x08, 0x0e, 14 ?? ?? 16, ...     │
│   STATUS: decoded — `MEMDUMP_FigTable_PillarLeft.BIN`     │
│           confirms format byte-exact                       │
└────────────────────┬─────────────────────────────────────┘
                     │ for each figure, look up recipe
                     ▼
┌──────────────────────────────────────────────────────────┐
│ Layer 2 — Figure recipe table                             │
│   Lives at runtime memory:  D074:0..D074:0x7F5            │
│   Structure: 24 records × 84 bytes each                   │
│   Each record references SUB-FIGURE pieces by small ID    │
│   STATUS: PARTIALLY decoded                                │
│      - Pattern: each pose pairs main piece + figure 102   │
│        (shared shadow underlay)                            │
│      - Format uses 5-byte `04 <piece_id> <x> <y>` and     │
│        framing brackets `14 ?? ?? 16` + `04 66` separators│
│      - EXACT recipe content not decoded — would need      │
│        disassembly of composer routine at image+0x0BD5    │
└────────────────────┬─────────────────────────────────────┘
                     │ for each piece, fetch sprite data
                     ▼
┌──────────────────────────────────────────────────────────┐
│ Layer 3 — Sprite piece (the actual pixels)                │
│   Files: K[MS]*.{IND,DAT}                                 │
│     KM = alpha mask (binary opacity)                      │
│     KS = color  (2-bit CGA palette index per pixel)       │
│   Encoding: 3-byte header <w_bytes, h_rows, anchor>       │
│             + RLE-0x7B compressed stream                  │
│   STATUS: WORKING — extract_dos_sprites_v2.py             │
│           produced 361 PNG pieces in                       │
│           remake_assets/dos_sprites/                       │
└────────────────────┬─────────────────────────────────────┘
                     │ blit (read-modify-write w/ sub-byte X rotation)
                     ▼
┌──────────────────────────────────────────────────────────┐
│ Layer 4 — Shadow buffer                                    │
│   Lives at:  DS:0x0337  (linear 200×80 byte plane)        │
│   Standard CGA mode 4, palette 1, 2bpp MSB-first          │
│   STATUS: decoded — captures render directly to PNG       │
└────────────────────┬─────────────────────────────────────┘
                     │ slow 4-pass column blit
                     ▼
┌──────────────────────────────────────────────────────────┐
│ Layer 5 — CGA VRAM at B800:0000                            │
│   Interlaced layout (NOT linear like shadow buffer)        │
│   STATUS: decoded — `MEMDUMP_VRAM.BIN` renders correctly  │
└──────────────────────────────────────────────────────────┘
```

---

## 3. What is WORKING (and shipped under `remake_assets/`)

### 3.1 Sprite-piece extraction (361 PNGs)

`remake_assets/dos_sprites/<pack>/` contains every sprite piece from every
paired K[MS]\*.DAT pack, decoded with the corrected KM=alpha/KS=color
interpretation. Browse via `remake_assets/dos_sprites/index.html`.

Useful caveat: each PNG is a **fragment** (head, torso, arm, leg
separately). The hero on screen = ~3 pieces stacked. So these are
reference assets / art-style witnesses, not ready-to-use sprite sheets.

### 3.2 Background pieces (15 cropped PNGs)

`remake_assets/dos_backgrounds/` contains pixel-perfect CGA crops of
every structural background element from the DOS engine:

- Backgrounds proper: `castle_title.png`, `title_wordmark.png`,
  `splash_jordan_mechner.png`, `mt_fuji.png`
- Outdoor cliff: `torii_gate_full.png`, `torii_pillar_only.png`,
  `fence_section.png`, `ocean.png`, `plateau_magenta.png`
- Castle: `building_gate.png`, `cell_door_closed_partial.png`,
  `cell_window_grille.png`, `cell_floor.png`
- HUD: `power_meter_outdoor.png`, `power_meter_indoor.png` (NOT stairs
  — these are the combat power meters: ▶ player, ◀ computer)

Each one was produced by:
1. Capturing the shadow buffer at `DS:0x337` from DOSBox-X
2. Diffing against a near-empty baseline
3. Cropping the non-baseline region

### 3.3 Static-scene character crops (2 PNGs)

- `princess_one_pose.png` — Princess Mariko full body
- `akuma_one_pose.png` — Akuma with eagle on shoulder, back view

Both via the same shadow-buffer-crop workflow, with scene-specific
captures (`MEMDUMP_Princess.BIN`, `MEMDUMP_Akuma_not_alone.BIN`).

---

## 4. What is BLOCKED and why

### 4.1 Building character poses from sprite data alone

**Symptom:** Trying to render a complete Princess, Akuma, or kicking
soldier from `K[MS]*.DAT` sprites produces fragments, not whole poses.

**Root cause:** Layer 2 (recipe content) is undecoded. We can decode
each individual piece in Layer 3, but we don't know which pieces stack
to form a given character pose, at which (dx, dy) offsets.

**Additional complication:** the blitter applies **sub-byte X rotation**
when a sprite is placed at a non-byte-aligned X coordinate. Source-sprite
bytes don't byte-equal shadow-buffer bytes when that rotation is in play.

### 4.2 Capturing dynamic fight-scene shadow buffers

**Symptom:** Pausing during a fight, dumping `DS:0x337`, often gets only
the background — characters missing.

**Root cause:** Fight scenes redraw their shadow buffer many times per
second:
```
clear → bg → char A → char B → ... → blit to VRAM → repeat
   ↑ pausing here gets empty buffer
                           ↑ pausing here gets full buffer
```

Static scenes (Princess in cell, Akuma standing) hold the "full"
state long enough that pausing reliably catches it. Fights don't.

**Workaround:** Slow CPU way down before pausing (`Ctrl+F11` × many in
DOSBox-X to ~50-100 cycles/ms), then pause. Or accept that action
poses come from Apple II / NES rips.

### 4.3 D074 recipe-table runtime captures keep coming up empty

**Symptom:** `MEMDUMPBIN D074:0 800` often produces an all-zero file in
fight scenes.

**Root cause:** same timing issue as 4.2 — the recipes get cleared and
re-loaded on every scene transition. We caught a populated table once
(during the `PillarLeft` scene) — that single dump
(`MEMDUMP_FigRecipes_PillarLeft.BIN`) is our only ground truth for what
populated recipe data looks like.

---

## 5. Major findings — engine internals reference

### 5.1 The mask/color reversal (the key decoder fix)

`06-debug-findings.md` §8 originally said "mask = displayed color, pixel
= inverse". That's **backwards**. The corrected interpretation:

* KM stream = **alpha mask** (binary opacity per pixel). KM bytes only
  contain bit patterns `00, 03, 0F, 3F, FF` — never magenta-bit (`10`)
  patterns. KM is a binary alpha gate, not color.
* KS stream = **color** (2-bit CGA palette index per pixel). KS bytes
  contain `0xAA`, `0x55`, etc. — the actual displayed colors.

Verified by KS0 sprite `0x0166`: 33 magenta + 21 white pixels in 12×10
area = exactly the hero's magenta-capped head. KM0's matching sprite has
zero magenta bits.

### 5.2 Runtime memory map

| Address (relative to DS) | Size | Contents |
|---|---:|---|
| `DS:0x0337` | 16,000 B | Shadow buffer (linear 200×80, every frame composed here) |
| `DS:0xBB30 + 0x000..0x070` | 100 B | Character-anim pointer table (24 entries × 4 bytes; 23 of 25 use segment 0xD074) |
| `DS:0xBB30 + 0x148..0x1A0` | ~88 B | ASCII strings (filenames, format strings, copyright) |
| `DS:0xBB30 + 0x1B5..0xFF terminator` | variable | Loaded scene-script (binary `04 <fig> <x_LE16> <y>` commands) |
| `0xD074:0..0x7F5` | ~2 KB | Character-animation recipes (24 × 84-byte blocks) |

CGA VRAM at `B800:0000` is **interlaced** (even rows at 0x0000–0x1F3F,
odd rows at 0x2000–0x3F3F). Shadow buffer at `DS:0x337` is **linear**.
They need different decoders.

### 5.3 Recipe-related data inside KARATEKA.EXE

Found during the final session — partial breakthrough but not fully
decoded:

| EXE file offset | Content |
|---|---|
| `0x12b18` | String `castle.bcg` |
| `0x12b28..0x12b3F` | printf format strings |
| `0x12b44` | `KARATEKA COPYRIGHT 1986 BRODERBUND SOFTWARE` |
| **`0x12b88`** | **Pointer table — 13 × 2-byte LE pointers: `0x1786..0x18bf`** |
| `0x12ba4` | A small ~20-byte recipe-like structure |
| **`0x14786..0x149e0`** | **Bulk of recipe data — variable-length records terminated by 0xFF** |
| `0x14a55..0x14de0` | Game narrative text + ending + credits |

**Dereference rule:** pointer value + base `0x13000` = file offset
into the data region. Example: pointer `0x1786` → file offset `0x14786`.

**Record format (partially seen, not yet decoded):**

- 3-byte commands: `04 01 <param>`, `01 01 <param>`
- Control bytes: `0xFE`, `0xFD`, `0xFF` (likely terminator / step / line)
- Different command structure from the runtime BB30 5-byte format

**Open question:** only 13 records in the EXE vs 24 in the runtime D074
table. So the EXE region is a SUBSET. The other records are either
loaded from a data file we haven't identified, generated at runtime, or
parameterised from these 13 base records.

### 5.4 The BAL/CAL figure-namespace gotcha

The "figure ID" in `set_fig,N X Y` is **NOT** the same as the sprite ID
in the `.IND` files. Sprite IDs in IND files are 257–477 (`0x101–0x1DD`);
figure IDs in scripts are 0–255. The mapping from figure ID to sprite
piece(s) goes through the layer-2 recipe table (see §2).

Previous extraction attempts that treated `set_fig,208` as "load sprite
208 from KMC.IND" produced unrecognizable noise — because there is no
sprite 208 in any IND file. This mistake cost ~half a day before being
caught.

### 5.5 The IBM PC port is 1986, not 1984

The runtime BB30 buffer contains the literal string `KARATEKA COPYRIGHT
1986 BRODERBUND SOFTWARE`. Jordan Mechner's Apple II original is 1984;
the IBM PC port (by The Connelley Group, per a credits string at EXE
`0x14d70`) is 1986. Files that said "1984" have been corrected.

---

## 6. Tools / scripts produced during the investigation

| File | Purpose |
|---|---|
| `extract_dos_sprites_v2.py` | Mass-extract all 361 sprite pieces with corrected decoder |
| `06-debug-findings.md` §12 | Runtime memory map |
| `09-runtime-memory-and-capture.md` | DOSBox-X capture workflow + decoders |
| `MEMDUMP_*.BIN` (in project root) | Raw memory dumps from DOSBox-X — kept for re-analysis |

Older scripts (`extract_karateka.py`, `disasm_karateka.py`,
`compose_scene.py`, etc.) used the **wrong** mask/color interpretation
and produced noise. They're superseded by `extract_dos_sprites_v2.py`
and the docs above.

---

## 7. Captured memory dumps in this folder

| File | Scene | Address | Size | Useful? |
|---|---|---|---:|---|
| `MEMDUMP_VRAM.BIN` | just_landed | `B800:0` | 16 KB | yes — clean VRAM |
| `MEMDUMP_1.BIN` | just_landed | `DS:0x337` | 16 KB | yes — characters present |
| `MEMDUMP_2.BIN` | "A Game by Jordan Mechner" splash | `DS:0x337` | 16 KB | yes — empty baseline |
| `MEMDUMP_Pillar_Left.BIN` | torii on left | `DS:0x337` | 16 KB | yes |
| `MEMDUMP_Pillar_Right.BIN` | torii on right + fight | `DS:0x337` | 16 KB | yes (chars present, mid-fight) |
| `MEMDUMP_Building_Gate.BIN` | ornate pagoda gate | `DS:0x337` | 16 KB | yes |
| `MEMDUMP_Inside_Building.BIN` | cell interior — door + window | `DS:0x337` | 16 KB | yes |
| `MEMDUMP_Princess.BIN` | Princess in cell | `DS:0x337` | 16 KB | yes — character present |
| `MEMDUMP_Akuma_not_alone.BIN` | Akuma + Princess + guard | `DS:0x337` | 16 KB | yes (re-captured) |
| `MEMDUMP_FigTable_PillarLeft.BIN` | pillar_left | `DS:0xBB30` | 4 KB | yes — populated scene script |
| `MEMDUMP_FigRecipes_PillarLeft.BIN` | pillar_left | `D074:0` | 2 KB | yes — populated recipes (rare!) |
| `MEMDUMP_Soldiers_Kicking_337.BIN` | kicking fight | `DS:0x337` | 16 KB | partial — only background captured |
| `MEMDUMP_Soldiers_Kicking_BB30.BIN` | kicking fight | `DS:0xBB30` | 4 KB | yes — scene script populated |
| `MEMDUMP_Soldiers_Kicking_D074.BIN` | kicking fight | `D074:0` | 2 KB | empty (all zeros) |

The single `MEMDUMP_FigRecipes_PillarLeft.BIN` populated capture is the
only ground truth we have for what a fully-loaded recipe table looks
like. Preserve it carefully if doing further reverse-engineering.

---

## 8. Where to pick up if you come back to this

### To finish what's blocked

**With POP source now as reference (see §9), these are tractable:**

1. **Decode all 13 EXE records at `0x14786+`** using the 3-byte
   `<Fimage, Fdx, Fdy>` format inferred from POP `FRAMEDEF.S`. Already
   verified: record 0 = the torii pillar (image $04 stacked 4× vertically).
   Walk every record and identify what each composes (probably fence,
   building gate, pagoda roof, door pieces, etc.).
2. **Decode the special opcodes** `$FE`, `$FD`, `$C0` that appear at
   record starts. POP's Fsword high bits (`$40`/`$80`/`$C0`) encode flip
   and orientation flags — Karateka likely uses analogous semantics.
3. **Figure out where the other 11 recipes come from** (EXE has 13;
   runtime D074 table holds 24). Read POP's `SEQDATA.S` / `SEQTABLE.S`
   for the sequence-table design pattern, then look for the same shape
   in Karateka's data files (probably embedded in `K[MS]I*.IND/DAT`
   or assembled from BAL/CAL composition rules).
4. **Map `Fimage` indices to sprite IDs.** POP's CHTAB structure (see
   §9.6 mapping) plus the IND tables should yield the lookup. Probably
   `Fimage` = sprite index within the pack (0-based), not the raw IND
   sprite ID.
5. **Implement sub-byte X rotation** in the static decoder so it can
   reproduce shadow-buffer bytes byte-exactly. POP's `HIRES.S/LAY`
   routine shows the shift-and-OR pattern at HGR resolution; adapt for CGA.

### To deliver more remake assets without finishing reverse-engineering

1. Use the shadow-buffer crop workflow (see §4.4 in `09`) for any
   additional STATIC scenes you want (intro narrative scenes, defeat
   pose, victory pose, princess-rescue scene, etc.).
2. Use the slow-CPU trick (`Ctrl+F11` × many in DOSBox-X) to capture
   action poses if you really need DOS-faithful kicks/punches.
3. Otherwise stay with the Apple II / NES rips already in
   `remake_assets/apple_ii/` and `remake_assets/nes/` for action poses —
   they're clean and ready to use.

### For the TypeScript / Canvas2D remake

Don't block on finishing the engine reverse-engineering. The assets in
`remake_assets/` are sufficient to build a faithful remake:

- `remake_assets/dos_backgrounds/` — 15 CGA-exact background pieces
- `remake_assets/dos_sprites/` — 361 sprite fragments (art-style reference)
- `remake_assets/apple_ii/`, `remake_assets/nes/` — character sprite sheets
- `princess_one_pose.png`, `akuma_one_pose.png` — DOS-faithful character refs

See `07-remake-prompt.md` for the resume-prompt to paste into a fresh
Claude session when ready to build the remake.

---

## 9. Prince of Persia source code — Mechner's published reference implementation

Jordan Mechner released the Apple II source code of Prince of Persia (1989) — his
next game after Karateka — on GitHub. **Mechner reused his data structures and
naming conventions between the two games**, so POP's source is effectively a
reference implementation of the engine model we've been reverse-engineering.

Cross-referenced in a later session. **Major finding: it validates and clarifies
the EXE recipe data we found at `0x14786+`.**

### 9.1 Where the POP source lives

* Apple II original: <https://github.com/jmechner/Prince-of-Persia-Apple-II> (1985–89, 6502 assembly)
* MS-DOS port source was **not** released (Mechner only released the Apple II original)
* Fabien Sanglard's code review (companion reading): <https://fabiensanglard.net/prince_of_persia/>

The repo's relevant subdirectory is `01 POP Source/Source/`. Key files for our work:

| POP file | Contains | Karateka equivalent (proven or hypothesised) |
|---|---|---|
| `FRAMEDEF.S` | **Static animation frame definitions** — 5-byte records | EXE `0x14786+` records (3-byte version) |
| `FRAMEADV.S` | Screen-block advance (level rendering) | The `image+0x0BD5` composer routine |
| `HIRES.S` | **HGR shape draw primitive** — `PREPREP`, `LAY`, `GETWIDTH` | Karateka's CGA blitter at `image+0x0640`/`0x083C` |
| `SEQDATA.S` | Animation sequence data | NOT YET IDENTIFIED in Karateka — would map frame IDs to walk/jump/fight cycles |
| `SEQTABLE.S` | Animation sequence table | Same — not yet found |
| `GRAFIX.S` | Higher-level graphics routines | Various entry points in Karateka.EXE |
| `MOVER.S` | Animated background object drawing (gates, spikes, …) | Less relevant — Karateka doesn't have these |

### 9.2 POP shape data format (verified from `HIRES.S/PREPREP`)

```asm
PREPREP:
  LDY #0
  LDA (IMAGE),Y      ; byte 0 = WIDTH (bytes per row)
  STA WIDTH
  INY
  LDA (IMAGE),Y      ; byte 1 = HEIGHT (rows)
  STA HEIGHT
  LDA IMAGE
  CLC
  ADC #2             ; skip past 2-byte header
  STA IMAGE          ; ...then read pixel data
```

So **POP shape format**: `<W, H, pixel_data>` — 2-byte header + pixels.

**Karateka shape format** (per `09-runtime-memory-and-capture.md` §9): `<W_bytes, H, anchor, RLE_pixels>` — 3-byte header + RLE pixels. Karateka adds one **anchor** byte (probably equivalent to POP's per-frame Fdx/Fdy positioning).

Same conceptual model; Karateka has one extra byte for relative positioning of structural pieces.

### 9.3 POP frame definition format (from `FRAMEDEF.S`)

Each frame is **5 bytes**: `Fimage, Fsword, Fdx, Fdy, Fcheck`.

Examples from the source:

```asm
:1  db $01,0,1,0,$c0+4     ;run-4
:15 db $0f,9,0,0,$40+3     ;stand
:53 db $01,$40,0,0,$c0+2   ;runturn-8       ; same image as frame 1 but $40 = flip flag
:67 db $11,$40,-2,0,$40+1  ;jumphang-2
```

Fields:
| Field | Bytes | Meaning |
|---|---:|---|
| `Fimage` | 1 | Image index into the character image table (CHTAB) |
| `Fsword` | 1 | Low bits = sword-table index; high bits ($40/$80/$c0) = orientation flags (mirror, etc.) |
| `Fdx` | 1 (signed) | Horizontal offset delta applied this frame |
| `Fdy` | 1 (signed) | Vertical offset delta |
| `Fcheck` | 1 | Bounding-box/collision flags |

### 9.4 Karateka frame format — inferred from POP + verified against EXE bytes

Karateka has no swords and no detailed collision boxes, so the format collapses to **3 bytes**:

```
<Fimage, Fdx, Fdy>
```

Verified against EXE record 0 at file offset `0x14786` (pointer table at `0x12b88`, dereference base `0x13000`):

```
04 01 BC   → image=$04, dx=+1,  dy=−68     ; tile #4 at relative (+1, -68)
04 01 A8   → image=$04, dx=+1,  dy=−88     ; tile #4 at relative (+1, -88)
04 01 96   → image=$04, dx=+1,  dy=−106    ; tile #4 at relative (+1, -106)
04 01 85   → image=$04, dx=+1,  dy=−123    ; tile #4 at relative (+1, -123)
```

Same image $04, regular dy steps of ~20 going UP — that's **the torii pillar** assembled
from four copies of a small column-segment piece stacked vertically. The pillar mystery
from earlier sessions is solved at the format level.

Special bytes still to decode:
* `$FF` — terminator (already known)
* `$FE`, `$FD`, `$C0` — appear at start of some records; possibly orientation flags or frame-skip markers (equivalent to POP's Fsword high bits)

### 9.5 What POP source unlocks for further Karateka work

**Now actionable** (was guesswork before):

1. **Decode the remaining EXE records.** Walk all 13 records at `0x14786..0x149e0` with the 3-byte parser. Match each one against background pieces (torii, fence, building gate, building roof, etc.) by comparing dy patterns.
2. **Decode animation sequences.** POP's `SEQDATA.S` shows how frame IDs are grouped into named sequences (`run`, `stand`, `jumphang`, …). Karateka's equivalent is loaded into the runtime D074 area we partially captured. Cross-reference our `MEMDUMP_FigRecipes_PillarLeft.BIN` against POP's SEQDATA structure.
3. **Decode the Fsword high-bit flag system.** POP uses `$40` for horizontal flip, `$80` and `$C0` for other orientations. Karateka's `$FE`/`$FD`/`$C0` bytes likely encode similar flags but in a different position.
4. **Identify the `IMG.CHTAB` ↔ `KS[N].DAT` mapping.** POP has 7+ character image tables (CHTAB1..7 + variants). Karateka has ~14 paired packs. The mapping is probably:

   | POP | Karateka |
   |---|---|
   | `IMG.CHTAB1` (kid) | `KM0/KS0` (hero) + `KMI0/KSI0` |
   | `IMG.CHTAB4.GD` (guard) | `KM1/KS1` + `KMI1/KSI1` |
   | `IMG.CHTAB4.FAT` (fat guard) | `KM2/KS2` + `KMI2/KSI2` + `KMJ2/KSJ2` |
   | `IMG.CHTAB4.SKEL` (skeleton) | `KM3/KS3` + `KMI3/KSI3` |
   | `IMG.CHTAB4.VIZ` (Vizier/boss) | `KM4/KS4` + `KMI4/KSI4` + `KMJ4/KSJ4` (Akuma) |
   | `IMG.CHTAB2/3` (background actors) | `KMC/KSC` (common pool) |

### 9.6 Naming convention match (Mechner's tradition)

| POP suffix | Character | Karateka pack | Likely character |
|---|---|---|---|
| `.GD` | Guard | KM1/KS1 | Tier-1 guard |
| `.FAT` | Fat guard | KM2/KS2 | Tier-2 guard |
| `.SHAD` | Shadow man | (not used in Karateka) | — |
| `.SKEL` | Skeleton | KM3/KS3 | Tier-3 guard |
| `.VIZ` | Vizier (boss) | KM4/KS4 | **Akuma** (final boss) |

Mechner kept the same per-character-table pattern across both games.

### 9.7 Honest scope of this finding

**What this gives us:** the conceptual model is now grounded in published reference source.
The format inferences for Karateka EXE bytes have a confirmed family resemblance, not just
guesses.

**What it does NOT give us automatically:** byte-exact correctness for every Karateka
record. Karateka's format is similar to POP's but not identical (3-byte vs 5-byte; the
flag bytes use different opcodes). Full decoding still requires running the parser against
every EXE record and comparing rendered output to ground-truth shadow-buffer crops.

---

## 11. Composer + blitter disassembly (the recipe resolution algorithm)

In the final 2026-06-01 session, the composer routine at `image+0x0BD5` and the
per-shape blitter at `image+0x0640` were disassembled using Capstone. This pins
down EXACTLY how a recipe byte becomes a sprite lookup.

### 11.1 Composer routine — `image+0x0BD5`

```asm
0x0BD5  mov  si, [0xBB2E]              ; SI = current pointer into recipe stream
0x0BD9  mov  al, [si - 0x44D0]         ; AL = byte at recipe pointer
0x0BDD  cmp  al, 0xFF                  ; 0xFF = end of recipe
0x0BDF  je   0xC14                     ; → exit
0x0BE1  mov  ah, 0                     ; AX = AL (figure_byte, zero-extended)
0x0BE3  mov  cl, [si - 0x44CD]         ; CL = Y from recipe (offset +3)
0x0BE7  mov  ch, 0                     ; CX = Y
0x0BE9  push cx
0x0BEA  mov  dx, [si - 0x44CF]         ; DX = X (LE16, offset +1)
0x0BEE  test dx, 0x8000                ; high bit = special flag?
...
0x0BFE  push dx                        ; push X
0x0BFF  push ax                        ; push figure_byte
0x0C00  call 0x640                     ; ← BLITTER (resolves fig → sprite + draws)
0x0C0D  add  word ptr [0xBB2E], 4      ; advance to next command (4 bytes!)
0x0C12  jmp  0xBD5                     ; loop until 0xFF
```

**Confirmed**: recipe commands are **4 bytes** — `<fig_byte> <x_LE16> <y>`. The
common interpretation of "5-byte commands starting with 0x04" was wrong; the
0x04 we kept seeing is actually the `Y` field of the *previous* command (or
explained by frequent `04` y-values).

### 11.2 Per-shape blitter — `image+0x0640` (the figure-resolution code)

```asm
0x0640  push bp
0x0641  mov  bp, sp
0x064D  mov  si, [bp+4]                ; SI = figure_byte (zero-extended word)
0x0650  shl  si, 1                     ; SI = figure_byte * 2
0x0652  mov  bx, [si + 0x423C]         ; BX = WORD at DS:[0x423C + 2*fig]
                                       ;   ← LOOKUP TABLE 1
0x0656  mov  [0x421E], bx              ; save BX
0x065A  mov  ax, [si - 0x78C6]         ; AX = WORD at DS:[0x873A + 2*fig]
                                       ;   (in unsigned 16-bit math)
                                       ;   ← LOOKUP TABLE 2
0x065E  mov  [0x4220], ax              ; save AX
0x0661  mov  al, [bx + 0x443C]         ; AL = width byte of shape
                                       ;   ← BX is offset into LOADED SPRITE DATA
0x0670  mov  al, [bx + 0x443D]         ; AL = height byte
...                                    ; (RLE decode loop follows)
```

**Key constants identified**:
- `DS:0x423C` = lookup table 1, **256 entries × 2 bytes = 512 bytes**, indexed
  by `figure_byte * 2`
- `DS:0x873A` = lookup table 2, same size, same indexing
- `0x443C` = offset of the loaded sprite-data region inside DS

### 11.3 Runtime tables captured

`MEMDUMP_423C.BIN` (512 B) and `MEMDUMP_873A.BIN` (512 B) — taken during the
pillar_left scene. 144 of 256 figure entries are populated; the rest are zero
(unused or unloaded).

### 11.4 Verified mapping: figure_byte ↔ K[MS]*.IND sprite

By matching each populated table value against the IND files:

| Lookup table | Maps to | Verification |
|---|---|---|
| `DS:0x423C` entries | **KSC offsets** (color/pixel data) | Direct exact match against KSC.IND |
| `DS:0x873A` entries | **KMC offsets** (alpha/mask data) | Direct exact match against KMC.IND |

**Mapping rule** (verified for figures 16, 17, 18, 19):

```
figure_byte N   ↔   sequential position N within KMC.IND / KSC.IND
```

Example:
* fig 16: `t_423C[32..34]` = `0x0739` → KSC sprite **0x0110** (16th in KSC.IND, 12×38)
* fig 17: `t_423C[34..36]` = `0x0770` → KSC sprite **0x0111** (17th, 16×40)
* fig 18: `t_423C[36..38]` = `0x07CB` → KSC sprite **0x0112** (18th, 24×38)
* fig 19: `t_423C[38..40]` = `0x084E` → KSC sprite **0x0113** (19th, 36×35)

Figures with no `IND` match (like fig 102 pointing past KMC end-marker) appear
to be runtime-populated by the scene loader. The "shared head/shadow" piece
mentioned in §9.5 is filled into memory at runtime; we can't decode it from
the static `.DAT` file.

### 11.5 Structural figures (200-215)

Entries 200–215 have a populated KMC pointer but **zero KSC pointer**. These
are the background/structural pieces (fence post = fig 208, ground = fig 200,
walls = figs 209/210, torii = figs 211/212, etc.) — they draw with mask only,
no color, hence the all-magenta look on screen.

---

## 12. Honest reckoning — what visual proof DOES and DOESN'T exist

**Update after the 2026-06-01 proof attempt**: I tried to construct a clean
hero character render from the decoded recipe + lookup tables + sprite pieces.
**It didn't work.** The composited result is fragmented pixel patterns, not a
recognizable humanoid.

### 12.1 What every clean character PNG in this project actually is

| File | Source workflow | NOT from code construction |
|---|---|---|
| `princess_one_pose.png` | Cropped from `MEMDUMP_Princess.BIN` (shadow buffer) | ✓ confirmed |
| `akuma_one_pose.png` | Cropped from `MEMDUMP_Akuma_not_alone.BIN` | ✓ confirmed |
| The "soldier" image (left figure in Akuma scene) | Cropped from shadow buffer | ✓ confirmed |
| `remake_assets/dos_backgrounds/*` | Cropped from various scene shadow buffers | ✓ confirmed |
| `remake_assets/dos_sprites/*` (361 PNGs) | Decoded from K[MS]*.DAT — but these are FRAGMENTS, not full characters | ✓ confirmed |

**There is no PNG in this project of a complete character generated from
recipe + sprite data alone.** Every visually-clean character came from the
shadow-buffer-crop workflow, which captures the engine's already-composited
output, not from independently decoding the engine's algorithm.

### 12.2 Why the code-construction attempt failed

Three unresolved details in the blitter:

1. **Sub-byte X rotation** (`mov cl, [0x4227]; ror ax, cl`). When a sprite is
   placed at a non-byte-aligned X, the blitter rotates pixel bits by `(X mod 4)
   * 2` bits before writing. Our static decoder doesn't do this, so colors
   come out striped instead of solid.
2. **Shadow-buffer read-modify-write**. The blit formula is
   `shadow = (shadow & ~rot_pix) | rot_mask`. Standalone sprite renders skip
   the read step — they don't know what was already there. For overlapping or
   composited pieces this matters.
3. **Figure 102 (shared head/shadow)** points to runtime-filled memory not
   present in the static `.DAT` files. The actor's specific head piece is
   copied into a shared slot at scene-load time.

### 12.3 The algorithm IS proven, the visual output is NOT

What we have:
- ✅ Recipe byte format (4-byte commands)
- ✅ Figure resolution (the assembly that reads `[si + 0x423C]` etc.)
- ✅ Lookup table content (captured + parsed)
- ✅ figure_byte ↔ IND-position mapping (verified for figs 16-19)
- ✅ Individual sprite decode (KM=alpha, KS=color works)

What we do NOT have:
- ❌ Sub-byte X rotation in our decoder
- ❌ Shadow-buffer accumulation
- ❌ Static decode of fig 102
- ❌ Any character render from sprite data that visually matches the engine output

### 12.4 How to honestly describe the proof status

**"The recipe model is algorithmically traced from disassembly + runtime
captures. Every memory read and table lookup is verified. However, we have
not implemented the complete blitter (sub-byte X rotation + shadow-buffer
state), so we cannot produce a code-built character render that looks like
the ground truth. All clean character images in this project are
shadow-buffer crops, not sprite-table constructions."**

### 12.5 If a future session wants visual end-to-end proof

The remaining work, in order of effort:

1. **Implement sub-byte X rotation** in the Python decoder. Read
   `[0x4227]` from the same memory dump as `MEMDUMP_423C.BIN`, use it as the
   shift amount, rotate sprite bytes accordingly.
2. **Simulate shadow-buffer accumulation**. Maintain a 16 KB byte buffer
   matching the engine's `DS:0x0337` region, blit each piece into it with the
   correct combine formula, render the final buffer.
3. **Dump the runtime "shared head" slot** to find fig 102's actual content.
   Look at what's at memory `(t_KSC[102] + 0x443C)` and `(t_KMC[102] + 0x443C)`
   during a scene where the hero is on screen.

Estimated effort: 4-8 hours of focused work, with no guarantee until the
output is compared frame-by-frame against the shadow buffer.

---

## 13. References between docs

| Doc | Purpose |
|---|---|
| `01-game-logic.md` | Game model, FSM, etiquette |
| `02-pseudo-code.md` | Engine-loop pseudo-code |
| `03-decompile-disassemble.md` | Older decompile notes (superseded by 06) |
| `04-best-language-to-remake.md` | Stack choice: TypeScript + Canvas2D |
| `05-trex-style-remake.md` | Target architecture |
| `06-debug-findings.md` | Disassembly findings; **§12 = runtime memory map** |
| `07-remake-prompt.md` | Resume prompt for the remake |
| `08-original-files-inventory.md` | What every file in this folder is |
| `09-runtime-memory-and-capture.md` | DOSBox-X capture workflow + decoders |
| **`10-investigation-progress.md`** | **This file — overall investigation state, §9 POP cross-reference, §11 composer/blitter disassembly, §12 honest reckoning on visual proof** |

When in doubt, **read this file (10) first**, then dive into 06 §12,
08, or 09 for specifics.
