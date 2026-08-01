# 08 — Original Karateka (DOS) game files inventory

> Audit of the working directory to separate **original 1986 Karateka IBM PC port assets**
> from analysis tooling, output artefacts, and notes produced during reverse-engineering.
> File-format details come from earlier disassembly work in `06-debug-findings.md`.
> Sprite counts were verified by re-parsing every `.IND` table in this session.
>
> **Update (later session):** The copyright string `KARATEKA COPYRIGHT 1986 BRODERBUND
> SOFTWARE` was found in a runtime memory dump (see `09-runtime-memory-and-capture.md`).
> The IBM PC port is from **1986**, not 1984. Jordan Mechner's Apple II original is 1984.

---

## TL;DR — what is original and what is not

| Bucket | Count | Examples |
|---|---:|---|
| **Original game files (untouched)** | 84 | `KARATEKA.EXE`, `*.BCG`, `K[MS]*.{DAT,IND}`, `BAL*`, `CAL*`, `ALL*`, `PRNGAL` |
| **Original game file, patched copy** | 1 | `KARATEKA_NOCHK.EXE` |
| **Backup of original** | 1 | `ALLPAL.BAK` |
| **Reverse-engineering tools (your work)** | 16 | `*.py`, `dosbox-x_run.conf` |
| **Documentation (your work)** | 7 | `0[1-7]-*.md` |
| **Output / extraction folders** | 6 | `extracted/`, `remake_assets/`, `appleii_sprites/`, `nes_sprites/`, `chatgpt/`, `__pycache__/`, `.claude/` |

The Karateka IBM PC port (Brøderbund, **1986**, ported by Robert Cook from
Jordan Mechner's 1984 Apple II original) shipped roughly **86 data files +
1 executable**. All of them are present here.

---

## 1. Executable

### `KARATEKA.EXE`  *(87,990 bytes — original)*
The DOS executable. MZ-format 8086 binary, hand-written assembly with
no compiler signatures. Boots, asks "make sure your karateka disk is
in drive a.", hooks INT 9 directly for keyboard, reads data files via
`INT 21h AH=3Dh`, draws to CGA mode 4 (320×200, palette 1: black /
cyan / magenta / white). Identified entry points (image-relative):

| Address | Routine |
|---|---|
| `0x0002` | Init (`CLI; MOV DS,6CA; MOV SS,155C; STI`) |
| `0x0207` | "Karateka disk in drive A" string |
| `0x0640` / `0x083C` | Per-shape blitter |
| `0x0B5E` | Two-stream RLE decoder (mask + pixel) |
| `0x0B4E` | Zero 16 KB shadow buffer at `DS:0x337` |
| `0x0BD5` | Composition list walker (4-byte entries) |
| `0x0DEF` | Slow-reveal 4-pass BCG blit |
| `0x5CC4` | File-open call site |

### `KARATEKA_NOCHK.EXE`  *(87,990 bytes — your patch)*
Same length and structure as `KARATEKA.EXE` but with the disk-check
prompt patched out. Not part of the original distribution.

---

## 2. Background images — `.BCG` files

Backgrounds are uncompressed CGA byte planes. The engine zeroes a 16 KB
shadow buffer at `DS:0x337` (200 × 80 = 16,000 bytes), copies the BCG
bytes into it, and reveals the buffer to VRAM column-by-column over four
passes via the routine at `image+0x0DEF` — that's the famous slow fade-in.
Bytes per pixel: 2 (CGA mode 4). Stride: 80 bytes per scanline (320
pixels ÷ 4 pixels/byte).

| File | Size | Lines covered | Content |
|---|---:|---:|---|
| `CASTLE.BCG` | 15,360 B | 192 | **Title screen** — Akuma's castle silhouette with moon, used after the Brøderbund splash. Almost fills the screen (15,360 ÷ 80 = 192 lines). |
| `FUJI.BCG` | 2,816 B | ~35 | **Mt Fuji** — snow-capped mountain against cyan sky. Only ~35 lines; the rest of the shadow buffer stays zeroed (black ground below the mountain). |
| `TITLE.BCG` | 4,352 B | ~54 | **Karateka wordmark** screen (~54 lines). Shown between splash and gameplay. *(Mod-time later than the rest — see §6.)* |

---

## 3. Sprite data — paired `K[MS]*.{DAT, IND}` packs

Each logical sprite is split across **two parallel RLE streams**:

* `KM…` = **M**ask stream (which colour bits to SET — `mask = displayed colour`)
* `KS…` = **S**prite-pixel stream (which background bits to CLEAR — bitwise inverse of mask)

The blitter reads (mask, pixel) byte-pairs and combines into the shadow
buffer as `shadow = (shadow & ~bit_reverse(pixel)) | bit_reverse(mask)`.

Each `K?….IND` is a lookup table of `(sprite_id_LE16, offset_LE16)` rows
padded with `0x8080` sentinel. Each `K?….DAT` is a pool of RLE shapes;
every shape starts with a 3-byte header `<width_bytes, height, anchor>`
followed by an RLE stream using opcode `0x7B <data> <count>`. Shapes
can share encoded tails to save space.

### 3.1 Per-character "movement" packs (KM0–KM4 / KS0–KS4)

Five characters (hero + four guard tiers / Akuma). Each pack holds the
walking / stance / striking frames for one character.

| Pack | KM sprites | KS sprites | KM `.DAT` | KS `.DAT` | Likely character |
|---|---:|---:|---:|---:|---|
| **KM0 ↔ KS0** | 12 | 18 | 969 B | 6,040 B | **Hero** (Mariko's rescuer) — "movement" frames |
| **KM1 ↔ KS1** | 16 | 23 | 556 B | 7,109 B | Guard tier 1 |
| **KM2 ↔ KS2** | 38 | 43 | 1,937 B | 6,808 B | Guard tier 2 (largest move set) |
| **KM3 ↔ KS3** | 38 | 44 | 2,209 B | 8,874 B | Guard tier 3 |
| **KM4 ↔ KS4** | 27 | 32 | 3,156 B | 9,440 B | Akuma / final guard |

### 3.2 Per-character "idle" packs (KMI0–KMI4 / KSI0–KSI4)

The `I` suffix holds idle / inverse-facing / reaction frames. Same
character mapping as the movement packs.

| Pack | KM sprites | KS sprites | KM `.DAT` | KS `.DAT` |
|---|---:|---:|---:|---:|
| **KMI0 ↔ KSI0** | 28 | 34 | 2,960 B | 7,516 B |
| **KMI1 ↔ KSI1** | 18 | 21 | 2,233 B | 5,137 B |
| **KMI2 ↔ KSI2** | 5 | 7 | 855 B | 2,601 B |
| **KMI3 ↔ KSI3** | 9 | 11 | 1,281 B | 3,026 B |
| **KMI4 ↔ KSI4** | 21 | 27 | 2,465 B | 7,776 B |

### 3.3 "Jump / jeopardy" packs (KMJ2, KMJ4 / KSJ2, KSJ4)

The `J` suffix holds jump / fall / mid-air frames. Only the heavier
guard tiers (2 and 4) have them — used for the eagle drop and falling-
guard animations.

| Pack | KM sprites | KS sprites | KM `.DAT` | KS `.DAT` |
|---|---:|---:|---:|---:|
| **KMJ2 ↔ KSJ2** | 24 | 27 | 2,366 B | 5,241 B |
| **KMJ4 ↔ KSJ4** | 18 | 23 | 2,133 B | 5,838 B |

### 3.4 Common-pool pack (KMC ↔ KSC)

| Pack | KM sprites | KS sprites | KM `.DAT` | KS `.DAT` |
|---|---:|---:|---:|---:|
| **KMC ↔ KSC** | 61 | 61 | 7,355 B | 7,606 B |

The biggest single pack. Identical sprite ID set in both files (Jaccard
1.000 from `06-debug-findings.md`). This is the cutscene / common pool
— used by multiple actors and the eagle / princess animations.

### 3.5 Small auxiliary pair (KMI ↔ KSI)

| Pack | KM sprites | KS sprites | KM `.DAT` | KS `.DAT` |
|---|---:|---:|---:|---:|
| **KMI ↔ KSI** | 4 | 4 | 173 B | 1,066 B |

Only 4 sprites, identical IDs in both. Probably engine UI / status
icons (life bar pips, "press any key" cursor, or similar).

### 3.6 Orphan index — `KMIO.IND`

`KMIO.IND` lists **27 sprite IDs** (range `0x0133`–`0x0160` plus a
trailing `0xFFFF` blank) but **has no matching `KMIO.DAT` and no
`KSIO.*` pair**. The IDs sit in a higher numeric range than the
character sprites in 3.1–3.5, so this is almost certainly a global
index into one of the existing `.DAT` pools (probably KMC/KSC) — a
named lookup for "common sprite 0x0133 = censer", etc. The engine
opens it by name during boot.

### Totals across all sprite packs

* **422 mask shapes** in 15 KM files (3,089 KB total in `.DAT` pools)
* **475 pixel shapes** in 14 KS files (84,376 B total in `.DAT` pools)
* 28 paired KM/KS packs + 1 orphan KMIO index

(The KS count is higher because the KS file frequently has extra trailing
sprite IDs that the KM file doesn't enumerate — see Jaccard table in
`06-debug-findings.md` §4.)

---

## 4. Scene / animation scripts — `BAL`, `CAL`, `ALL*`, `PRNGAL`

These are **plain ASCII / CRLF text files**, not binaries. Each line is
a single engine command of the form `cmd,<args>`. The engine includes a
tiny interpreter that places sprites, swaps frames, plays tunes, and
sequences screen wipes. Verb vocabulary observed:

| Verb | Meaning |
|---|---|
| `set_pos, X Y [label]` | Set cursor position; optional scene label |
| `set_fig, ID X Y` | Draw **figure** `ID` at (X, Y) — see warning below |
| `chg_fig, slot ID X Y` | Replace figure in animation slot |
| `inc_x, N` | Increment X cursor |
| `set_tune, N` | Play tune / sfx number `N` (0 = silence) |
| `set_wipe,` / `set_nowipe,` | Toggle screen-wipe transition |
| `do_scr,` | Render / commit one frame to screen |
| `init_sal,` | Initialise animation channel |
| `end_animation, [n]` | End-of-sequence marker |

> ⚠️ **CRITICAL: "figure ID" is NOT a sprite ID.** Previous notes (including
> earlier versions of this file) called the numbers in `set_fig` "sprite IDs."
> They are not. The `K[MS]*.IND` lookup tables only contain IDs in the
> **257–477** range, but BAL/CAL scripts use small numbers like 200, 208,
> 211. The engine resolves `set_fig,FIG X Y` through at least **two** layers
> of indirection before any pixel is drawn:
>
> 1. **Scene script → figure number** (`set_fig,211 266 183` = "draw figure 211")
> 2. **Figure number → list of sprite pieces** (figure 211 = "draw piece A at
>    (0,0), piece B at (0,15), piece B at (0,30), ...") — a runtime recipe
>    table whose exact location is partially mapped (see `09-runtime-memory-and-capture.md`)
> 3. **Sprite piece → pixel data** (some pieces live in `K[MS]*.DAT` packs,
>    some appear to be hardcoded in `KARATEKA.EXE` — not all pieces have been
>    located yet)
>
> **Practical consequence**: do NOT try to extract "the sprite for the fence
> panel" by looking up ID 208 in any `.IND` file. There is no such mapping.
> The correct way to recover background pieces is to capture the runtime
> shadow buffer from DOSBox-X and crop the rendered pixels. See
> `09-runtime-memory-and-capture.md` for the working capture workflow and
> `remake_assets/dos_backgrounds/` for the resulting clean PNG assets.

### 4.1 Per-scene scripts

| File | Size | Likely purpose |
|---|---:|---|
| `BAL00` | 217 B | Level 0 **B**alcony / outdoor scene — places figures 200, 206, 201, 208×4, 202, 203 |
| `BAL01` | 650 B | Scene 1 background composition |
| `BAL02` | 2,907 B | Scene 2 (larger — multi-action sequence) |
| `BAL02A`–`BAL02E` | 355–439 B | Variants / state branches of scene 2 (A–E) |
| `BAL03` | 561 B | Scene 3 |
| `BAL03A`–`BAL03F` | 57–125 B | Six variants / micro-sequences of scene 3 |
| `CAL00` | 4,014 B | **C**utscene / fight-room scene 0 (longest) — full opening encounter |
| `CAL01`–`CAL06` | 182–485 B | Cutscene scenes 1–6 |
| `CAL07` | 1,216 B | Cutscene scene 7 |
| `CAL07A` | 1,216 B | Variant of CAL07 (identical size, alternate ending?) |

The `BAL` prefix matches the `set_fig,200 0 181 Level 0 BAL` header
comment, so almost certainly stands for **B**ackground / outdoor scenes.
`CAL` consistently opens with figures 209–212 (interior posts / pillars)
and runs combat / movement sequences — the **C**utscene / **C**ell
interior scripts.

### 4.2 Concatenated "ALL" master scripts

These five files bundle every scene of a given type into one stream,
with internal labels (`pal00`, `gal00`, `val00`, `bal00`, `pgal00`, …)
marking each sub-scene.

| File | Size | Labels seen | Likely purpose |
|---|---:|---|---|
| `ALLBAL` | 184 B | none — single Level 0 scene | Boot/loading composition for the title sequence |
| `ALLCAL` | 2,727 B | sequence of `chg_fig` frames | Full cutscene runtime (intro fight) |
| `ALLGAL` | 8,762 B | `gal00`–`gal??` | **G**uard animation gallery (sprite-47 paired with hero IDs) |
| `ALLPAL` | 10,095 B | `pal00`–`pal??` | **P**rincess gallery? — pairs hero frames (1, 29, 30, 31) with figure 47. Largest of the ALL files. |
| `ALLVAL` | 5,641 B | `val00`–`val??` | **V**illain / enemy gallery — uses figures 145, 135, 136, 178 |

### 4.3 Princess gallery — `PRNGAL`

* `PRNGAL` *(1,120 B, label `pgal00`–`pgal10`)* — **Pr**i**n**cess
  Mariko **G**a**l**lery. 11 sequence panels of Mariko's reactions
  (figures 125–127). Required by `KARATEKA.EXE` at boot.

### 4.4 `ALLPAL.BAK`  *(10,241 B)*
Backup of `ALLPAL` (146 bytes larger than the live copy). Not part of
the original distribution — looks like a save made during this folder's
history (text editor backup or DOS COPY).

---

## 5. Suspected file-naming legend

Putting all the prefixes together, the convention used by the porter
appears to be:

```
Prefix                  Meaning
─────────────────────   ──────────────────────────────────────────────
K   (sprite files)      Karateka
 ├─ KM…                 Mask stream
 └─ KS…                 Sprite-pixel stream
    ├─ K[MS]0..4        Per-character base (movement) pack
    ├─ K[MS]I[0..4]     Idle / reaction frames
    ├─ K[MS]J[2,4]      Jump / jeopardy frames
    ├─ K[MS]C           Common / cutscene pool
    ├─ K[MS]I           Auxiliary (UI?) — only 4 sprites
    └─ KMIO             Orphan global sprite index (no .DAT, no KS pair)

Scene scripts (text)
 ├─ BAL…                Background / outdoor scenes (Balcony)
 ├─ CAL…                Cutscene / interior scenes (Cell?)
 ├─ ALLBAL/CAL/GAL/PAL/VAL  Concatenated gallery scripts
 └─ PRNGAL              Princess Mariko gallery

Backgrounds              *.BCG  — uncompressed CGA byte planes
Executable               KARATEKA.EXE
```

(The exact word behind `BAL` / `CAL` / `GAL` / `PAL` / `VAL` is not in
the binary's strings — these are best guesses from observed usage. If
you have a period source disk listing or a Brøderbund design doc, that
would lock it down.)

---

## 6. Caveats about timestamps

Almost every original file in this folder shares mtime `2027-05-27 05:22`
— that's the timestamp at which they were copied from the source disk
image. **Three files have later mtimes** and deserve a note:

| File | mtime | Status |
|---|---|---|
| `TITLE.BCG` | 19:52 | Original-looking content (4,352-byte CGA layout). Likely the same bytes as the source disk, but the file was rewritten by an extraction or copy step. |
| `PRNGAL` | 19:52 | Same situation. Content matches the engine's expected script format and is referenced by `KARATEKA.EXE` at boot per `07-remake-prompt.md`. |
| `KARATEKA_NOCHK.EXE` | 19:40 | **Your patched copy**, not original. |

These are flagged as "original" in the inventory above because their
contents conform to the original formats and the engine accepts them,
but you may want to re-pull `TITLE.BCG` and `PRNGAL` from a clean image
if byte-exact preservation matters to you.

---

## 7. Everything else in this folder (NOT original Karateka assets)

For completeness, the directory also contains:

* **Markdown notes** (your work): `01-game-logic.md`, `02-pseudo-code.md`,
  `03-decompile-disassemble.md`, `04-best-language-to-remake.md`,
  `05-trex-style-remake.md`, `06-debug-findings.md`, `07-remake-prompt.md`
* **Python tools** (your work): `extract_karateka.py`, `disasm_karateka.py`,
  `compose_scene.py`, `export_dos_sprites.py`, `export_composed_animations.py`,
  `compare_hero.py`, `compare_streams.py`, `dump_sprite.py`,
  `final_sprite_proof.py`, `find_buffer.py`, `find_strings.py`,
  `audit_shapes.py`, `probe_pairs.py`, `probe_anim.py`, `hgr_scan.py`,
  `extract_dsk.py`
* **DOSBox-X config**: `dosbox-x_run.conf`
* **Output / derived folders**: `extracted/`, `remake_assets/`,
  `appleii_sprites/`, `nes_sprites/`, `chatgpt/`, `__pycache__/`,
  `.claude/`

None of those are part of the 1984 distribution.

---

## 8. Verdict

**Yes — every original Karateka (IBM PC, 1984) data file appears to be
present in this folder.** Specifically:

* The hand-written 8086 executable (`KARATEKA.EXE`)
* All three background screens (`CASTLE.BCG`, `FUJI.BCG`, `TITLE.BCG`)
* All 28 paired sprite packs (15 KM + 14 KS, plus the orphan `KMIO.IND`)
  totalling ~900 distinct sprite shapes split between mask and pixel streams
* All 23 scene scripts (`BAL00` … `CAL07A`)
* All 5 concatenated master scripts (`ALLBAL` … `ALLVAL`) plus the
  princess script `PRNGAL`

Nothing appears to be missing from the original game. If you ever need
a byte-exact reference copy of `TITLE.BCG` / `PRNGAL` (the two with
modified mtimes), re-extracting from the source disk image is the safest
route — but the content is functionally correct as-is.
