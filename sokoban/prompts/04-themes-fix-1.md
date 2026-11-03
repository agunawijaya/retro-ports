# Prompt 04 — fix 1: a regression check that renders rooms, and the draw-call budget in every room

You are working on the Hening web game in `E:\Projects\retro-ports\sokoban\game`. This fixes the [LOGIC] of `prompts/04-themes.md` after review. Read that prompt, `review/prompts/04-themes/summary.md` and `game/NOTES-04.md` first. Hard rules of 04 still hold (no edits to `reference/`, `docs/`, `original/`, `game/src/core/`; no new dependencies; no git commits; humanized code).

## Pembagian kerja

| Who | Does |
|---|---|
| **Kimi** (`run-kimi.ps1`) | This whole fix. The Flash [LOGIC] run of 04 failed review, so by the model policy (`prompts/CLAUDE-CODE.md`) the fix goes to Kimi. |
| **Haiku** | Starts the run, reads the `.done` file. |
| **Opus** | Reviews the result, judges the Lentera comparison, decides. |

**Running at the same time:** the [ART] run of 03 (dupa stick, gate choice, Mimpi look, helper strip, Taman Sendiri). It owns `src/screens/*`, `src/ui/*`, `src/state/*`, `src/dev/*`, `tools/flow.mjs`, `tools/perf.mjs`. Do not edit those. You own `tools/regress.mjs`, `tools/themes-check.mjs`, `src/render/*`, `src/world/*`, `src/themes/*`. Write notes only in `game/NOTES-04.md` (a section *Fix 1*). `.scratch/`: use `.scratch/04fix-*` folders only and delete only those. Check the build with `npx vite build --outDir .scratch/04fix-dist`, never into `dist/`.

## What review found

### 1. The Lentera regression never rendered a room

`tools/regress.mjs` enters rooms with `window.hening.level(i)`. Since prompt 02 that only loads the room world; it does not move the router, so the title/courtyard stays on screen. Every `*-game.jpg` the 04 run produced shows the tower, not room 6 (look at `.scratch/regress/room06-fajar-game.jpg`), and `review/current/themes/lentera-instanced-room06.jpg` shows room 6 under the title's "Hening" logo. The summary's seven "MATCH" lines were never checked.

The same run also **overwrote the approved frames** in `review/current/room/` (room06-*, room07-senja, scrub-*, gate, stranger, basin, fountain, finale; timestamps 2026-11-02 18:59) with those tower renders. The only untouched record of the approved look is `review/prompts/01-room/sheet.jpg`.

**Fixed looks like:**
- `regress.mjs` reaches every game state through the router first: `await window.hening.screen('room', { room: N })` (N = 5 + the old `level(i)` index), then the existing setup calls. No title, logo or courtyard in any game frame; the HUD place line reads the right room.
- **A baseline from the approved code.** The tree as it was before 03 and 04 is in `C:\Users\aguna\AppData\Local\Temp\claude\E--Projects-retro-ports-sokoban\e870bb89-b393-4c43-b863-6bfc2fea6844\scratchpad\sokoban-before-03-04.tgz` (folders `game/`, `briefs/`, `prompts/`; no `node_modules`). Extract it to `sokoban/.scratch/04fix-baseline/`, give it `game/node_modules` as a directory junction to the real one (`cmd /c mklink /J`), copy your fixed `regress.mjs` into its `game/tools/`, and render every regress state there with the same seed. Its frames are the baseline.
- Render the same states from the current (instanced) tree.
- Compare each pair: mean absolute difference per channel, and the percentage of pixels differing by more than 8/255. Make a side-by-side (baseline left, instanced right) per state with `tools/lib/composite.mjs` and save them in `review/prompts/04-themes-fix-1/` as `regress-<state>.jpg`.
- Put the baseline frames back in `review/current/room/` (restoring the approved set) and save the instanced ones as `review/current/themes/lentera-instanced-<state>.jpg`.
- If a pair differs beyond animation noise (clouds, motes, koi), fix the instancing until it does not. The koi in `world/decor/ponds.js` and the fountain merge in `world/decor/fountain.js` were changed by 04; the `basin` and `fountain` states must match too.

### 2. Draw calls over budget outside rooms 6 and 10

`ARCHITECTURE.md` §14: **≤ 150 draw calls in a room** — every room, not only 6 and 10. The 04 table shows rooms 25 and 50 at 181–186 for every theme, marked PASS.

**Fixed looks like:** `themes-check.mjs` measures draw calls for **all 50 rooms**, all objects lit, for each of the five themes (draw calls only for the 245 extra cases; frame time stays on rooms 1, 6, 10, 25, 50). Find what grows with the room (decor, wall or plinth pieces, basins, ponds, fx) — not the theme objects, which are already instanced — and merge or instance it until the worst room of every theme is ≤ 150. Report the five worst rooms per theme before and after.

### 3. Alcoves

`review/current/themes/floor2-candi.jpg` appears to show lanterns in the floor alcoves with the theme set to Candi. Check that the alcoves on the floors and the tower build the current theme's object (lit / unlit as their room), through the theme interface only, and fix if not. Render `floor2-<theme>` for each of the five themes into `.scratch/04fix-alcoves/` and state in the summary what each one shows.

## Done when

- Every regress state has a baseline/instanced pair with its numbers and a composite in `review/prompts/04-themes-fix-1/`; the approved set is back in `review/current/room/`.
- Draw calls ≤ 150 in all 50 rooms, all lit, for all five themes.
- Alcoves follow the theme.
- `npm test` passes; the `.scratch/04fix-dist` build opens from disk with no console errors; `node tools/review.mjs audit` prints nothing.

## Deliverable — then STOP

`review/prompts/04-themes-fix-1/summary.md`: what was wrong in `regress.mjs`, the comparison table (state · mean diff · % pixels > 8/255 · your verdict), what you changed in the instancing if anything, the draw-call table (theme · worst five rooms before · after), the alcove result per theme, test count, build size, audit result. Then stop; do not start any [ART] work.
