# Prompt 03 — fix 1: icons as text, the dream that does not look like one

You are working on the Hening web game in `E:\Projects\retro-ports\sokoban\game`. This fixes the [ART] of `prompts/03-modes-garden.md` after review. Read that prompt (including its rules for the ART step), `review/prompts/03-modes-garden/summary.md`, `game/NOTES-03.md`, and look at `review/prompts/03-modes-garden/sheet.jpg`. All of 03's hard rules hold (no edits to `reference/`, `docs/`, `original/`, `game/src/core/`; zero raster; Indonesian copy exactly as written; no git commits). Do not edit `src/themes/*`, `src/render/*`, `src/world/*`, `tools/regress.mjs`, `tools/themes-check.mjs`.

## Pembagian kerja

| Who | Does |
|---|---|
| **Opus** (Argon is out; owner, 2026-11-02: all [ART] is Opus's) | All of this fix, then the sheet and summary. |
| **Haiku** | Re-runs tests and flow, the sheet, audit and gallery. |


## What review saw, and what fixed looks like

1. **Icons shown as source text.** The `penunjuk` cell shows `<svg viewBox="0 0 24 24"> <path d="…` as text across the helper strip; `taman sendiri · menyunting` shows the same down the left palette, and `ponsel · menyunting` along the bottom. **Fixed:** every icon is a drawing (SVG inserted as markup or built as DOM nodes, never through `textContent`/`innerText`), thin `ink` lines as `ART-DIRECTION.md` asks; check every module 03 added for the same mistake.
2. **Mimpi looks like a normal room.** The `mimpi` cell is room 6 in plain Siang with the ordinary wanderer sitting on the ledge. **Fixed** (prompt 03 §3, `ART-DIRECTION.md` §13.9): capture mid-solution, with the dream wanderer at opacity 0.45, colour mixed 50 % toward `#d8d4ff`, `depthWrite` off, walking and pushing; a mote left at each step; the vignette toward the mood veil; `mimpi` in Jost uppercase top centre; no HUD. At sheet size it must be unmistakably a dream and still readable.
3. **Gate choice over the title.** The `gerbang · pilih jalan` cell shows the title screen's "Hening" logo behind the card. **Fixed:** the card in the courtyard, in front of the gate, in the courtyard's mood (prompt 03 §2).
4. **Phone editor.** The board is a small square in the middle of the screen and the palette overflows. **Fixed:** the board fills the phone viewport sensibly (Q/E camera as in rooms) and the palette is one row of glass buttons at the bottom, selected = filled white.
5. **The stick.** In `dupa · menyala` the stick is a very small mark. Check it against §13.7 (2 px × 120 px at 1440 × 900, glowing tip, smoke curl, numerals under it) and make a 390 × 844 frame where it sits beside the counters.

The critique is real: render each frame, look at it, compare against `review/current/room/`, `review/current/tower/` and `ART-DIRECTION.md`; at least two rounds, five gaps each, in `game/NOTES-03.md` → *03 critique*. Then re-run `npm test` and `node tools/flow.mjs` (all 18 steps must still pass).

## Deliverable — then STOP

1. Updated frames in `review/current/modes/`, and `review/prompts/03-modes-garden-fix-1/sheet.jpg` through `game/tools/review.mjs` with the twelve cells of 03's sheet.
2. `review/prompts/03-modes-garden-fix-1/summary.md`: what changed per defect, the critique rounds, test count, flow result, `node tools/review.mjs audit` result.
3. `node tools/review.mjs gallery`.
