# Prompt 04 — fix 3: the four themes, finished and visible

**The owner allowed this third follow-up (2026-11-02)**; fix 1 and fix 2 were [LOGIC], this is the first [ART] follow-up.

You are working on the Hening web game in `E:\Projects\retro-ports\sokoban\game`. This fixes the [ART] of `prompts/04-themes.md` after review. Read that prompt (including its rules for the ART step), `review/prompts/04-themes/summary.md`, `review/prompts/04-themes-fix-1/summary.md`, `review/prompts/04-themes-fix-2/summary.md`, `game/NOTES-04.md`, and look at `review/prompts/04-themes/sheet.jpg`. All of 04's hard rules hold. Do not edit `src/screens/*`, `src/ui/*`, `src/dev/*`, `src/state/*`, `tools/flow.mjs`, `tools/perf.mjs`.

## Pembagian kerja

| Who | Does |
|---|---|
| **Opus** (Argon is out; owner, 2026-11-02: all [ART] is Opus's) | All of this fix, then the sheet and summary. |
| **Haiku** | Re-runs tests and flow, the sheet, audit and gallery. |


## What review saw, and what fixed looks like

1. **Close-ups miss the objects.** `cahaya bintang · dekat` and `candi · dekat` frame a pond; the objects are cut off at the bottom edge. **Fixed:** `hening.focus(x, z, zoom)` on an object's position; one lit and one unlit object of the theme fill about a third of the frame, for all four themes.
2. **Taman Batu's sand is not there.** `taman batu · lingkaran pasir` is the room-06 frame again: no raked strips, no rings. **Fixed** (`ART-DIRECTION.md` §7.3): five strips per inside floor tile, direction alternating per room, readable at play distance; a lit monolith's rune glows and the strips within one tile curve into rings over 1.2 s — captured after the transition, close enough to see the rings.
3. **Mata Air has no water.** `mata air · semua tertutup` shows lit plugs and nothing else. **Fixed** (§7.5): water in the void channels beside the floor, rising `0.2 / goalCount` per sealed hole with one lotus each; all sealed → water at y −0.05 and the waterfall off one plinth edge, framed so the waterfall is in the picture.
4. **Lantai II · candi is the Kolam.** The cell shows the settings card over the floor. **Fixed:** close the Kolam; floor II with the Candi stupas in the alcoves, lit as their rooms, and the open room's lotus terrace.
5. **Lit and unlit, and the finish.** At play distance in Senja the Candi stupas are grey domes whose lit state barely shows; the Cahaya Bintang crystals are pale thin shapes; Taman Batu's monoliths are plain boxes. **Fixed:** each theme matches its table in §7.2–§7.5 number for number and the common rules of §7 (unlit/lit ramp, halo, pool, glow = mood glow mixed 50/50 with the accent); lit is unmistakable at play distance in every mood; each theme looks as finished as Lentera next to it.

Keep fix 1 and fix 2: `tools/themes-check.mjs`'s full sweep ≤ 150 draw calls in every room for every theme, `tools/regress.mjs` Lentera unchanged, `npm test` passing. The critique is real: render, look, compare with the Lentera frames; at least two rounds, five gaps each, in `game/NOTES-04.md` → *04 critique*.

## Deliverable — then STOP

1. Updated frames in `review/current/themes/`, and `review/prompts/04-themes-fix-3/sheet.jpg` through `game/tools/review.mjs` with the twelve cells of 04's sheet.
2. `review/prompts/04-themes-fix-3/summary.md`: what changed per defect, the critique rounds, the draw-call sweep result, the regress result, test count, `node tools/review.mjs audit` result.
3. `node tools/review.mjs gallery`.
