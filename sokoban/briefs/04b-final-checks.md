# Brief: final checks for 04b (qa-scout)

## Pembagian kerja

- **Haiku (you):** run the checks, report numbers, append them to the summary. No source edits, no decisions.
- **Opus:** built the [ART]; reviews your numbers.

## Run, in `E:\Projects\retro-ports\sokoban\game`, in this order

1. `npm test` — files / tests passed / failed.
2. `node tools/flow.mjs` — PASS/FAIL per step and the total. Count only lines starting with `[PASS]` or `[FAIL]` at column 0 of `.scratch/flow/flow.txt` (indented lines are sub-steps).
3. `node tools/perf.mjs` — per scene: draw calls, triangles, avg/p95 ms. Compare title and Lantai II with 02's 127 / 116 draw calls.
4. `npm run build` — size of `dist/hening.html`, errors if any.
5. `node tools/review.mjs audit` — whether it printed anything.
6. `node tools/review.mjs gallery`.

Then append `## Checks (Haiku)` with these numbers to the end of `E:\Projects\retro-ports\sokoban\review\prompts\04b-floating-stones\summary.md`. Edit nothing else. Do not delete anything in `.scratch/`.

If a command runs longer than 20 minutes, stop it and report that. Report back in at most 15 lines.
