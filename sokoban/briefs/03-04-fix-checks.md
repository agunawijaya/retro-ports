# Brief: checks after 03 fix 1 and 04 fix 3 (qa-scout)

## Pembagian kerja

- **Haiku (you):** run the checks, report numbers, append them to the two summaries. No source edits, no decisions.
- **Opus:** built both fixes ([ART]); reviews your numbers.

## Run, in `E:\Projects\retro-ports\sokoban\game`, in this order

1. `npm test` — files / tests passed / failed (names of failures).
2. `node tools/flow.mjs` — PASS/FAIL per step and the total; the reason of any FAIL.
3. `node tools/themes-check.mjs` — the full sweep (all 50 rooms × 5 themes, all lit): the worst room and its draw calls per theme, and whether every case is ≤ 150; console errors if any.
4. `node tools/regress.mjs` — the Lentera states: report what the tool prints per state (and whether any frame shows a title, logo or courtyard instead of a room). Do not pass `--save`.
5. `npm run build` — size of `dist/hening.html`, errors if any.
6. `node tools/review.mjs audit` — whether it printed anything.
7. `node tools/review.mjs gallery`.

Then append a section `## Checks (Haiku)` with these numbers to the end of both `review/prompts/03-modes-garden-fix-1/summary.md` and `review/prompts/04-themes-fix-3/summary.md`. Edit nothing else.

If a command runs longer than 25 minutes, stop it and report that. Report back in at most 20 lines.
