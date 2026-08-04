# Port vs. DOS — visual audit

Screenshot comparison of the browser port at `web/` against the DOS
binary run under `comrun.py`. Screenshots are in `work/dos-shots/` and
`work/port-shots/` (both gitignored).

**Bottom line:** the port and the DOS game render the SAME assets but
compose them differently. Assets are pixel-identical (both extracted
from the same PCX/PCC containers). Layout, palette (CGA vs VGA), and
which UI elements live in the canvas vs the DOM are port-specific
decisions. This audit lists what matches, what's a design choice,
and what's a real bug.

Comparison was done at the **South Pass** state (landmark 7, day
1848-05-13) because the shipped `ZOP12.GAM` save lands there and
matches the port's demo state.

---

## Screen-by-screen

### 1. Title / main menu

| | file | notes |
|---|---|---|
| DOS | `dos-shots/01-title.png` | CGA palette 1 (cyan/magenta/white/black). Banner top, ornamental scrollwork band, faded MECC logo watermark, **6 menu items** including "Turn sound off", "What is your choice?" prompt, second ornamental band + copyright at bottom. |
| Port | `port-shots/f2-title.png` | Same banner (from `vga_TERRAIN.png`) in **VGA color** (cream/brown, not cyan). Wagon added in the middle of the canvas (not in DOS). Menu is **5 items** (missing "Turn sound off") as DOM buttons below. No bottom ornament, no watermark, no "What is your choice?" text. |

**Real bugs:** wagon on title = extra (not in DOS); "Turn sound off"
option missing.

**Design choices:** VGA vs CGA palette; DOM menu vs canvas menu.

### 2. Continue-saved-game prompt

| | file | notes |
|---|---|---|
| DOS | `dos-shots/02-continue-prompt.png` | Standalone prompt screen after picking "1. Travel the trail": ornamental banners top and bottom, "Would you like to continue a saved game?" in white text center. |
| Port | (none) | **Missing.** Port jumps directly to setup flow from title. |

**Real bug:** feature missing. Fix: add prompt to `playOneRun()` when
localStorage has a save.

### 3. Landmark arrival / daily menu

| | file | notes |
|---|---|---|
| DOS | `dos-shots/04-arrival.png` = `05-daily-menu.png` | Landmark scene (South Pass: mountains + wagon train + Native American rider) as backdrop. Overlay: status box top (`Weather: cool / Health: poor / Pace: grueling / Rations: filling`), menu box middle with **8 items** (Continue on trail through Talk to people — no Hunt because we're AT a landmark), name+date box bottom (`South Pass / May 13, 1848`), prompt very bottom (`What is your choice?`). |
| Port | `port-shots/f2-daily.png` | **Correct backdrop** (South Pass scene from `vga_P7.png`) after the toolkit-extraction fix. Menu is 9-item list in DOM below the canvas (does NOT drop "Hunt for food" at landmarks). No status box overlay, no name/date overlay. |

**Real bugs:**
- Menu doesn't gate "Hunt for food" on `cmp byte [0x199d], 0` at
  image `0x4109` — port always shows Hunt.
- No status/date overlay drawn on canvas.

**Fixed since first audit:** landmark backdrop was showing
`vga_SCENERY.png` (a sprite atlas) fullscreen — root cause was
`drawDailyMenu`'s fallback branch. Now uses the current landmark
image as backdrop, which matches DOS behavior.

**Fixed since first audit:** `vga_P7.png` was Fort Kearney (or
similar) because the old extraction (`extract_cga.py` in the BASIC
Programs folder) numbered images in scan order, not by member name.
Re-extracted with the toolkit's `pcxlib.py --extract`, which
preserves the container's real names (P0.PCC → vga_P0.png, etc.).
All 18 landmark images now correspond to the correct landmark IDs.

### 4. Map

| | file | notes |
|---|---|---|
| DOS | `dos-shots/06-map.png` | Same `vga_MAP.png` (monochrome). **Solid black route line** from Independence up to current landmark ONLY. Magenta landmark labels (from BIT8X8.GFT). Legend box bottom-right. `Press SPACE BAR to continue` at bottom. |
| Port | `port-shots/f2-map.png` | Same map. **Trail line now correctly stops at the current landmark** (fixed since first audit — was drawing all 18 points, now draws up to `currentLandmarkIndex`). Yellow square marker at (338, 117) from the leg record's `mapX/mapY` fields. Labels are baked into the PNG. |

**Match:** the geographical shape of the drawn route matches DOS.
Marker position matches to within a few pixels (both use the
`+0x21..+0x24` bytes from the leg record).

**Difference:** DOS uses text overlaid via 8×8 font; port uses the
baked-in PNG labels. Both readable.

### 5. Hunting

| | file | notes |
|---|---|---|
| DOS | `dos-shots/08-hunt-instructions.png` `09-hunt-field.png` | Captures came out as composited/torn frames (comrun's snapshot timing mid-transition), but visible elements: hunt instructions overlay text (Enter/Space/Escape + two keypad diagrams from `terrain.pcc`), plus a hunt field with real pine tree sprites and a stick-figure hunter, all in CGA cyan/magenta at 320×200. |
| Port | `port-shots/f2-hunt.png` | Real pine trees, rocks, bushes from `vga_TERRAIN.png` — coordinates read from `DS:0x013A` (`TERRAIN_KINDS` in `hunting.js`). Real bison, deer, rabbit from `vga_ANIMALS.png`. Hunter from `vga_HUNTER.png` `HUNTER_SPRITES.getSprite()`. Region-appropriate sprites via `DS:0x0364` (`REGIONS`). HUD text at top and bottom. |

**Fixed since first audit:** hunt scenery used coloured placeholder
boxes. Now uses the 16-entry `TERRAIN_KINDS` sprite table read
directly from the unpacked binary at `DS:0x013A` (per docs/03) and
draws them via `assets.drawSprite` from `vga_TERRAIN.png`.

**Match:** the sprite set is correct — same trees, same rocks, same
region-per-landmark rule. The DOS field would show the same objects
in the same region (region 2 mountains for South Pass area).

**Remaining differences:**
- Animal walk cycle uses only frame 0 in the demo (real port cycles
  through 4 frames via `species.frames[]`).
- Hunter doesn't walk when Enter is pressed (uses a single pose per
  aim direction, not a walk cycle).
- Palette: VGA vs CGA.
- HUD at top and bottom = port design; DOS has a smaller in-frame
  bullets/meat counter.

### 6. Store

| | file | notes |
|---|---|---|
| DOS | not captured (requires visiting a fort) | Text-based menu with shopkeeper dialogue quoted inline: `"Hello, I'm Matt. So you want to go to Oregon..."` + `1. Oxen / 2. Food / 3. Clothing / 4. Ammunition / 5. Spare parts`. |
| Port | `port-shots/f2-store.png` | Custom 3×3 grid layout with Matt sprite (from `vga_SUPPLIES.png` sx=201) on the left, item icons+prices+labels on the right. Not a reproduction of the DOS text-based store. |

**Design choice:** port's store is graphical, DOS's is text-based
dialogue. Prices match `docs/03` verbatim (oxen $40/yoke, food
$0.20/lb, ammo $2/box-of-20, clothing $10/set, parts $10 each).

### 7. Supplies check

| | file | notes |
|---|---|---|
| DOS | not captured | Text list of quantities, similar to store dialogue style. |
| Port | `port-shots/f2-supplies.png` | Row of item icons with counts underneath, "Cash on hand" line at the bottom. Also custom design. |

### 8. Travel screen

| | file | notes |
|---|---|---|
| DOS | not captured | Wagon on trail (from `travelox.pcc`), scenery scrolling, status box. |
| Port | `port-shots/f2-travel.png` | Procedural sky/mountains/ground painted, wagon (from `vga_TRAVELOX.png` frame 0), one tree on each side, status box top-left with date/weather/health/pace/rations/miles. |

**Match:** wagon sprite is correct.

**Design choice:** procedural backdrop vs the DOS's rendered scene.
The DOS wagon does NOT animate per frame (see docs/03 — travelox.pcc
loaded once via `artwork:0x0390` at image `0x04169`); port cycles
through 3 wagon frames every 300ms.

### 9. River crossing

| | file | notes |
|---|---|---|
| DOS | not captured (needs traversal to a river) | Composited scene from `float.pcc` sprites (per proc_055BA). |
| Port | `port-shots/f2-river.png` | Displays `vga_FLOAT.png` (the atlas) as fullscreen with an overlay text box top-left showing river name/width/depth. |

**Real bug:** port shows the atlas full-screen instead of composing
individual sprites (wagon-on-ferry, wagon floating, wagon tipped,
etc.). Same class of bug as the earlier daily-menu-atlas issue.

Fix would involve reading `float.pcc`'s own sprite table from
`DS:0x???` — not traced yet.

---

## Ranked gap list

Reordered by severity after the fixes in this session:

| gap | severity | status |
|---|---|---|
| Landmark numbering mismatch (`vga_P7 != South Pass`) | **had been high** | **FIXED** — re-extracted with toolkit's pcxlib.py |
| Daily-menu backdrop was scenery atlas | **had been high** | **FIXED** — now uses current landmark image |
| Map trail line spanned entire trail | had been medium | **FIXED** — now up to currentLandmarkIndex only |
| Hunting scenery was coloured boxes | had been medium | **FIXED** — real sprites from vga_TERRAIN.png via TERRAIN_KINDS |
| River crossing shows atlas fullscreen | **medium** | open — needs float.pcc sprite table |
| Continue-saved-game prompt missing | medium | open — small UI addition |
| Daily menu doesn't hide "Hunt for food" at landmarks | medium | open — needs `at_landmark` flag on gameState + menu filter |
| No date/name overlay on landmark arrival scene | low | open |
| No status box overlay on daily menu (uses DOM instead) | low (design choice) | wontfix per port design |
| Menu is DOM below canvas vs in-canvas | low (design choice) | wontfix per port design |
| Palette is VGA 256-color vs DOS CGA cyan | low (design choice) | wontfix per port design |
| Wagon animation on title (not in DOS) | low | trivial — remove |
| "Turn sound off" menu option missing | low | trivial — add |
| Hunter walk animation not cycling frames | low | small — cycle sprite frames on walking |
| Store is graphical grid vs DOS text dialogue | low (design choice) | wontfix per port design |

---

## What the port *does* get right

- **Every sprite/asset is authentic MECC artwork** — extracted from
  the same PCL/PCC containers the DOS game uses at runtime.
- **Sprite coordinates measured, not invented:**
  - Animals: frames measured from vga_ANIMALS.png (`assets.js`
    audit).
  - Hunter: 8-direction table from `DS:0x00DA` (`HUNTER_SPRITES` in
    `assets.js`, verified against binary in this session).
  - Terrain (hunting scenery): 16-kind table from `DS:0x013A`
    (`TERRAIN_KINDS` in `hunting.js`).
  - Wagon: 3 walk frames measured from vga_TRAVELOX.png.
- **Region-to-sprite mapping is authentic** — the 5 regions × 6 kinds
  table at `DS:0x0364` drives which sprites appear where.
- **Map marker position** uses the exact `(mapX, mapY)` bytes at
  `+0x21..+0x24` of each leg record. Marker lands where the DOS game
  would draw it.
- **Trail line on map** connects landmarks in visit order via those
  same coordinates, and now correctly stops at the current landmark.
- **Store prices** match the shopkeeper's dialogue verbatim per
  `docs/03`.
- **River outcome formulas** (`0.4/severity` mud, `0.16/severity`
  overturn, ferry $5, wait 2-6 days, `0.05/0.10` broke-loose
  thresholds) all decoded from `oregon.asm` in this session.
- **Fork detection** (`+0x1E` non-zero → alternate route menu) with
  real destinations (South Pass → Fort Bridger detour or Green
  River shortcut).
- **Shoshoni guide** (Random(2)+2 = 2-4 sets of clothing, calls
  ford/float at severity=5) from proc_050DD.
- **Casualty routine** with `p = (health - 2.5) / (severity * 10)`
  from `docs/03`, per party member (skipping the leader).
- **Turbo Pascal LCG** for reproducible seeds.
- **selfTest** completes a full 250-day playthrough reaching
  Willamette Valley at day 153 — historically realistic.

## What "sama persis" (identical) would require

Given the audit, achieving pixel-identical rendering would need:

1. **CGA palette mode.** Force the extracted MCGA PNGs through a
   palette-remapping to CGA cyan/magenta/white/black. Or extract
   from `OTCGA.PCL` (the CGA-mode container) instead.
2. **Canvas-based text rendering** using `BIT8X8.GFT` (the DOS 8×8
   bitmap font from the game itself), not browser monospace CSS.
3. **In-canvas menu boxes** with inverse-video shortcuts, at fixed
   pixel positions, matching DOS's `ui:0x1789` and `ui:0x1a60`
   coordinate arguments.
4. **All status/name/date overlays drawn to canvas**, not DOM.
5. **Text strings copied verbatim** from the string table in the
   binary (docs/03 lists many; not all have been transcribed to
   the port).

Each is doable but is essentially a second port pass focused on
visual fidelity. The current port prioritized simulation
correctness; a "faithful reproduction" pass is a bigger project.

## What's still HYPOTHESIS in the port

Bounded to values genuinely not readable from the binary:

- **Hazard scale factor** (linear amp of Bernoulli slot odds by hazard
  variable). model.pas notes this formula wasn't traced.
- **Illness recovery days** (3..8 days). DOS binary uses casualty odds
  based on health; the "days until well" isn't a fixed field.
- **Individual event slot probabilities** except the two named in
  PROMPT-PORT.md (rough trail 0.05, wild fruit 0.15).
- **Trade offers** — the "attempt to trade" system is not decoded.

The simulation is faithful to the binary where the binary IS the
authority. The visuals now use real sprite data everywhere except the
river scene composition. Documented negatives are recorded in-place.
