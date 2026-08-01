# 09 — Runtime memory & DOSBox-X capture workflow

> **Audience: a future Claude (or human) reverse-engineering this game.**
> This doc captures the END STATE of a multi-session investigation into
> Karateka's runtime data flow. Read this before retrying any sprite
> extraction. It will save you from repeating an entire investigation.

---

## 1. Why this document exists

Earlier sessions assumed the `K[MS]*.IND` lookup tables held the sprite
IDs that BAL/CAL scripts reference. That assumption is **wrong** and led
to extraction attempts whose output was uninterpretable magenta-and-white
noise. The actual data flow has **at least three layers of indirection**
between an ASCII script command (`set_fig,211 266 183`) and the pixel
bytes that appear on screen.

This file documents:
- The runtime memory map (what lives at which `DS:offset`)
- The capture workflow with DOSBox-X (`MEMDUMPBIN` commands)
- The indirection chain in full
- What is currently solved and what is not
- The pragmatic alternative that gave us clean PNG assets

---

## 2. Confirmed runtime memory map

All addresses are relative to the runtime data segment `DS` after the
DOS loader places the program. To get the actual numeric `DS` value at
runtime, type `R` in the DOSBox-X debugger — it varies by load
environment. Earlier static disassembly showed `MOV DS, 06CA` at
`image+0x0002`, which is what we observed in DOSBox-X too.

| Address | Size | Contents | How verified |
|---|---:|---|---|
| `DS:0x0337` | 16,000 B | **Shadow buffer.** Linear 200×80, no interlace. CGA palette 1 (black / cyan / magenta / white), 2 bits per pixel, MSB-first within each byte. Engine composes every frame here before blitting. | `MEMDUMPBIN <DS>:0337 4000` decodes to a pixel-perfect 320×200 PNG of the current game frame. Six captures collected in this folder render as the expected scenes. |
| `DS:0xBB30 + 0x1B5` | 0xFF-terminated stream | **Loaded scene-script buffer.** Binary form of the active BAL/CAL script. 5-byte command `04 <fig> <x_LE16> <y>` is the figure-draw opcode. Other opcodes (`0x00`, `0x08`, `0x0e`) handle wipes, control flow, and a 4-byte bracket `14 <a> <b> 16` whose meaning is unclear. | `MEMDUMPBIN <DS>:BB30 1000` captured the `pillar_left` scene buffer. Decoded Y coordinates (183, 180, 131, 127, 123, …) match the ASCII BAL/CAL script Y values exactly. Figure numbers (210, 215, 209, 191, 190) are the same small-number namespace the scripts use. |
| `DS:0xBB30 + 0x000..0x070` | 100 B | **Character-animation pointer table.** 25 × 4-byte entries `(offset_LE16, seg_LE16)`. The segment value is `0xD074` for 23 of the 25 entries; the offsets increment by `0x54` (84 bytes), implying 84-byte fixed-size records pointed to. | Same capture as above. |
| `0xD074:0..0x7F5` | ~2 KB | **Character-animation recipes.** Each 84-byte block is one animation frame, listing the sub-figures that compose it via repeated `04 <fig> <x_LE16> <y>` commands. The most common pattern is `(102, dx, dy)` paired with a different "pose" figure each block — figure **102 is the recurring shadow underlay** drawn beneath every actor. Figures referenced are in the 0–200 range. | `MEMDUMPBIN D074:0 800` captured a 2 KB recipe area. 24 distinct 84-byte records visible, each containing 4–10 figure-draw commands. |
| (NOT YET LOCATED) | — | **Structural-figure recipes.** The recipes for figures ≥ ~190 (pillars, fences, building gates, doors, interior walls). Tried: (a) byte-searching `KARATEKA.EXE` for plausible sprite headers `<w> <h> 01` matching pillar dimensions (12 × 140 px) → zero hits; (b) parsing the character-animation table for figures > 200 → none found. | — |

CGA VRAM at `B800:0000` (16 KB) is **interlaced** (even lines at
`0x0000–0x1F3F`, odd lines at `0x2000–0x3F3F`, 80 bytes/line). The
shadow buffer at `DS:0x337` is **linear**. They need different decoders.

---

## 3. The indirection chain in full

```
┌──────────────────────────────────────────────────┐
│ ASCII script file (BAL00 / CAL00 / ALLPAL / …)   │
│   set_fig,211 266 183                            │
└────────────────┬─────────────────────────────────┘
                 │ parse + load into runtime buffer
                 ▼
┌──────────────────────────────────────────────────┐
│ DS:0xBB30 + 0x1B5  (scene-script buffer)         │
│   04 d3 0a 01 b7   ← binary form of set_fig 211  │
└────────────────┬─────────────────────────────────┘
                 │ "draw figure FIG"
                 ▼
┌──────────────────────────────────────────────────┐
│ Figure recipe table — LOCATION DEPENDS ON FIG ID │
│   • fig < ~200 → 0xD074:offset (animation frame) │
│   • fig ≥ ~200 → UNKNOWN  (NOT YET LOCATED)      │
│   List of (piece_id, dx, dy, …) entries          │
└────────────────┬─────────────────────────────────┘
                 │ for each piece
                 ▼
┌──────────────────────────────────────────────────┐
│ Sprite piece                                      │
│   • Some in K[MS]*.DAT (IND IDs 257–477)         │
│   • Some apparently hardcoded in KARATEKA.EXE    │
│   Decoded via <w,h,anchor> + RLE-0x7B            │
└────────────────┬─────────────────────────────────┘
                 │ blit
                 ▼
┌──────────────────────────────────────────────────┐
│ DS:0x337 shadow buffer (composed frame)          │
└────────────────┬─────────────────────────────────┘
                 │ 4-pass column blit (slow-reveal)
                 ▼
┌──────────────────────────────────────────────────┐
│ B800:0000 CGA VRAM (interlaced)                  │
└──────────────────────────────────────────────────┘
```

**Layers 1 & 2 are fully decoded** (`MEMDUMPBIN` confirms).
**Layer 3 is decoded for character animations only** (figure IDs < 200).
**Layer 4 is partially decoded** for character sprites in `K[MS]*.DAT`;
the structural pieces (pillar bodies, fence rails, lintels, etc.) have
NOT been located in any data file or in the EXE so far.

---

## 4. DOSBox-X capture workflow

### 4.1 Prerequisites

1. Use a DOSBox-X build that includes the **heavy debugger** (the
   official `joncampbell123/dosbox-x` Windows builds have it by default).
   If `Debug → Start DOSBox-X Debugger` is greyed out, your build
   lacks it — download a current release.
2. Confirm `dosbox-x_run.conf` exists and mounts this folder as drive
   `A:` with floppy emulation (see `06-debug-findings.md` §10).

### 4.2 Capture procedure

```
1. Launch:    dosbox-x.exe -conf dosbox-x_run.conf
2. Run game until the desired scene is on screen.
3. Top menu:  Debug → Pause            (or Alt+Pause)
4. Top menu:  Debug → Start DOSBox-X Debugger
5. At the H> prompt:
                R                                ← read register values
                                                 (note the actual hex DS value)
                MEMDUMPBIN <DS_hex>:0337 4000    ← shadow buffer (16 KB)
                MEMDUMPBIN B800:0 4000           ← CGA VRAM (16 KB, interlaced)
                MEMDUMPBIN <DS_hex>:BB30 1000    ← scene-script buffer (4 KB)
                MEMDUMPBIN D074:0 800            ← animation recipes (2 KB)
6. Files land in:  <dosbox-x_dir>/capture/MEMDUMP_NNN.BIN
7. Rename meaningfully before next capture, e.g.:
      MEMDUMP_NNN.BIN → MEMDUMP_PillarLeft_shadow.BIN
8. Drop renamed files into this project folder for analysis.
```

Common pitfall: typing the literal text `<DS>` instead of substituting
the hex value from `R`. The command produces a 0-byte file when this
happens. Always replace `<DS_hex>` with the actual value (e.g. `06CA`).

### 4.3 Shadow-buffer decoder (Python)

```python
from PIL import Image
CGA = [(0,0,0), (0x55,0xff,0xff), (0xff,0x55,0xff), (0xff,0xff,0xff)]

def decode_shadow(path):
    with open(path,'rb') as f: buf = f.read()
    img = Image.new('RGB', (320, 200))
    px = img.load()
    for y in range(200):
        for bx in range(80):
            b = buf[y*80 + bx]
            for sub in range(4):
                px[bx*4+sub, y] = CGA[(b >> (6 - sub*2)) & 3]
    return img
```

### 4.4 VRAM decoder (Python — note the interlace)

```python
def decode_vram(path):
    with open(path,'rb') as f: vram = f.read()
    img = Image.new('RGB', (320, 200))
    px = img.load()
    for y in range(200):
        bank = (y & 1) * 0x2000
        off  = bank + (y >> 1) * 80
        for bx in range(80):
            b = vram[off + bx]
            for sub in range(4):
                px[bx*4+sub, y] = CGA[(b >> (6 - sub*2)) & 3]
    return img
```

### 4.5 Scene-script decoder (Python)

```python
def decode_scene_script(path, start=0x1B5, end=0x3F0):
    with open(path,'rb') as f: buf = f.read()
    p, cmds = start, []
    while p < end and buf[p] != 0xFF:
        if buf[p] == 0x04 and p + 4 < end:
            fig = buf[p+1]
            x   = buf[p+2] | (buf[p+3] << 8)
            if x >= 0x8000: x -= 0x10000     # signed
            y   = buf[p+4]
            cmds.append(("set_fig", fig, x, y))
            p += 5
        else:
            # control opcode (0x00, 0x08, 0x0e, bracket 14...16, etc.)
            # walk forward to next 0x04 for now
            cmds.append(("op", buf[p]))
            p += 1
    return cmds
```

---

## 5. What we already captured

In this folder:

| File | Scene | Source |
|---|---|---|
| `MEMDUMP_VRAM.BIN` | just_landed | CGA VRAM (B800:0000) |
| `MEMDUMP_1.BIN` | just_landed | shadow buffer (DS:0337) |
| `MEMDUMP_2.BIN` | "A Game by Jordan Mechner" splash | shadow buffer — useful as near-empty baseline |
| `MEMDUMP_Pillar_Left.BIN` | torii gate on left | shadow buffer |
| `MEMDUMP_Pillar_Right.BIN` | torii gate on right + fight | shadow buffer |
| `MEMDUMP_Building_Gate.BIN` | ornate pagoda gate | shadow buffer |
| `MEMDUMP_Inside_Building.BIN` | interior cell — door, window, floor | shadow buffer |
| `MEMDUMP_FigTable_PillarLeft.BIN` | pillar_left | scene-script buffer (DS:BB30, 4 KB) |
| `MEMDUMP_FigRecipes_PillarLeft.BIN` | pillar_left | animation recipes (0xD074:0, 2 KB) |

Captures still missing (would be useful for closing remaining gaps):
- A scene-script buffer for `Inside_Building` (different figure mix → may reveal more structural figure IDs)
- Animation recipes from a scene with multiple enemies (to enumerate enemy frame numbers)
- Memory dump in the `0xD000`–`0xCFFF` range (might contain the structural recipes we haven't located)

---

## 6. The pragmatic extraction strategy that actually works

Decoding the structural-figure recipes is a multi-hour reverse-engineering
effort with uncertain payoff. **A faster route gave us clean assets in
minutes**:

1. Capture the shadow buffer for each scene of interest.
2. Capture a near-empty baseline (the splash works).
3. Diff scene against baseline — non-zero bytes are exactly the pixels the
   engine drew for that scene.
4. Crop tight bounding boxes around each structural element (excluding
   actor figures) and save as PNG.

This produced 16 clean CGA reference PNGs in `remake_assets/dos_backgrounds/`
covering: torii gate (both pillar variants), pagoda gate, magenta cell door,
window grille, striped cell floor, fence rail, plateau, stairs, Mt Fuji
silhouette, castle title screen, Karateka wordmark, and splash text. See
`07-remake-prompt.md` for how a remake should use them.

These PNGs are byte-exact renders of what the original engine drew. They
are usable in a TypeScript/Canvas2D remake as-is, with no further decoding.

---

## 7. If you DO want to close the remaining gaps

The unsolved piece is the recipe table for figures ≥ ~190 (the structural
pieces). The most promising next experiments:

1. **Capture more memory regions.** Try `MEMDUMPBIN <DS>:0 4000` and
   `MEMDUMPBIN D000:0 4000` to scan around the known data segments for
   another 84-byte-stride pointer table.
2. **Breakpoint the composer routine.** Set `BP <CS>:0BD5` and let it
   fire when drawing each figure. Inspect SI/DI to see what memory it's
   reading from.
3. **Disassemble the `set_fig` dispatcher.** The 5-byte opcode `04 <fig>
   <x> <y>` is parsed somewhere in the EXE. Find the function that
   reads this opcode and trace its dispatch on `fig` — that reveals where
   the figure-recipe table is indexed.

Approach #3 is the cleanest. It needs no further runtime captures and
would deterministically locate the structural recipes.

---

## 8. Cardinal rule for future sessions

> **Do not extract sprites by IND ID for anything you see referenced in
> a BAL/CAL script (`set_fig,N`).** The number `N` is a figure ID, not
> an IND sprite ID. The IND tables don't contain those numbers at all.
> The right path is the capture workflow above.

---

## 9. Static sprite extraction — IT WORKS (with the right interpretation)

A later session (2026-05-31, continued) found that direct extraction
from `K[MS]*.DAT` files **does** produce coherent sprites once the
mask/color interpretation is corrected.

### 9.1 The fix

`06-debug-findings.md` §8 originally labelled the two byte streams the
wrong way around. Verified ground truth:

| File | Role | Evidence |
|---|---|---|
| `KM*.DAT` | **Alpha mask** (binary opacity per pixel) | KM streams contain only `0`/`1`-pattern bytes: `0x00`, `0x03`, `0x0f`, `0x3f`, `0xff`. No magenta-bit (`10`) patterns anywhere. |
| `KS*.DAT` | **Color** (2-bit CGA palette index per pixel) | KS0 sprite `0x0166` (the hero's head) has 33 magenta + 21 white pixels in a 12×10 area — magenta bits are present in KS, never in KM. |

The combine formula in the assembly (`shadow = (shadow & ~rotated_pix)
| rotated_mask`) is correct — the labels for *which file each byte
stream came from* were just swapped in the documentation.

### 9.2 Working decoder

```python
def decode_sprite(km_bytes, ks_bytes, w_bytes, h_rows):
    """KM = alpha mask, KS = color. Both streams come from rle_decode of
    the .DAT file starting at offset+3 (header is <w_bytes, h_rows, anchor>)."""
    img = Image.new("RGB", (w_bytes * 4, h_rows), TRANSPARENT)
    for row in range(h_rows):
        for col in range(w_bytes):
            alpha_byte = bit_reverse(km_bytes[row*w_bytes + col]) if km_bytes else 0xFF
            color_byte = bit_reverse(ks_bytes[row*w_bytes + col])
            for sub in range(4):
                shift = 6 - sub*2
                if (alpha_byte >> shift) & 3 == 0:
                    set_pixel(transparent)
                else:
                    set_pixel(CGA_PALETTE[(color_byte >> shift) & 3])
    return img
```

Full implementation: `extract_dos_sprites_v2.py` in the project root.

### 9.3 What was produced

361 sprites across 14 packs in `remake_assets/dos_sprites/`:

| Pack | Sprites | Likely actor |
|---|---:|---|
| KM0/KS0 | 17 | Hero — movement / stance pieces |
| KM1/KS1 | 22 | Guard tier 1 |
| KM2/KS2 | 42 | Guard tier 2 |
| KM3/KS3 | 43 | Guard tier 3 |
| KM4/KS4 | 31 | Akuma |
| KMI0..4 / KSI0..4 | ~95 | Idle / reaction frames |
| KMJ2/KSJ2, KMJ4/KSJ4 | 48 | Jump / jeopardy frames |
| KMC/KSC | 60 | Common pool (eagle, princess, props) |
| KMI/KSI | 3 | Auxiliary (UI / icons?) |

Browse via `remake_assets/dos_sprites/index.html`.

### 9.4 Important caveat — sprites are PIECES, not complete poses

Each "sprite" extracted is a small body part / fragment. A complete
character pose on screen is composed at runtime by stacking 2–N pieces
together via the figure-recipe table at `0xD074:0` (see §2 above).

Example from the character-animation recipe parse:
```
Recipe 0:  draw figure 17 + figure 102 (shadow underlay)
Recipe 1:  draw figure 18 + figure 102
Recipe 2:  draw figure 19 + figure 102
...
```
Figure 102 is the recurring shadow underlay paired with every pose. The
mapping from `figure_id → sprite_id_in_K[MS]*.DAT` is partially understood
for character animations but not finalised.

So the extracted PNG sheet shows the *raw pieces*, not assembled
character sprites. A remake using these as-is would need to either:
1. Reproduce the engine's figure-recipe composition logic, or
2. Use the shadow-buffer crop workflow (Section 4) to capture complete
   characters in action, or
3. Fall back to Apple II / NES rips for clean per-pose sprite sheets.

The pieces ARE still useful as visual reference and for studying the
DOS-specific art style at byte-exact fidelity.
