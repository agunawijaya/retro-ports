# Brief for qa-scout: fix 2 — the runs, the checks, the sheet

Part of `prompts/00-foundation-fix-2.md` §4 and its deliverable;
`briefs/00-foundation-fix-2.md` has the split. Game root:
`E:\Projects\retro-ports\sokoban\game`. Opus's scratchpad (call it `$S`):
`C:\Users\aguna\AppData\Local\Temp\claude\E--Projects-retro-ports-sokoban\b23bb32e-7204-4ddd-8981-c37b1e229f8c\scratchpad`.

## Pembagian kerja

- **qa-scout (you):** run, copy, report. Mechanical only.
- **Opus:** owns every decision, the summary and `game/NOTES.md`. Opus set the
  thread-count rule below; you apply it.
- **engineer / Agy:** nothing here. Gemini runs prompt 01 in the same folder
  from 00:00: do not touch any of its files.

## Steps

> **Changed 2026-10-29 23:10:** each 50-room run takes longer than the
> 10-minute limit of a subagent's command, so Opus ran steps 2 and 3 itself as
> one background command. Their outputs are in `$S`: `run-t32.log`,
> `report-t32.md`, `solutions-t32.json`, and the same for `t16`. Start at
> step 1, skip 2–3, and take the minutes and counts from those files.

1. In `game/`: `npx vitest run`. Report the counts (total and per file). If
   anything fails, **stop and report**.
2. **Run A:** `npm run rooms -- --threads 32`. Then at once copy
   `.scratch/solve/report.md` to `$S/report-t32.md` and
   `src/data/solutions.generated.json` to `$S/solutions-t32.json` (prompt 01 may
   empty `.scratch/` at any time). Note the wall-clock minutes.
3. **Run B:** `npm run rooms -- --threads 16`; copy to `$S/report-t16.md` and
   `$S/solutions-t16.json`; note the minutes.
4. **Winner:** more solved rooms wins; on a tie, the shorter wall-clock run.
   If run A wins, copy `$S/solutions-t32.json` back over
   `src/data/solutions.generated.json` (both were verified before writing).
5. **Exhausted:** list every room whose stop reason is `exhausted` in either
   run. If there is any, still finish the steps, but put it first in your report.
6. Delete only these leftovers in `E:\Projects\retro-ports\sokoban\.scratch\`:
   the `*.mjs` files directly in it (Gemini's aborted fix-2 scripts; Opus has
   copies) and `.scratch/solve/`. Leave every other folder there alone.
7. `node tools/review.mjs audit` from `game/`; quote its output exactly
   (nothing printed and exit 0 means clean).
8. **The sheet,** without editing `tools/review.mjs` (prompt 01 owns it): write
   `$S/fix2-sheet.mjs` that does what `buildFix1Sheet()` in `tools/review.mjs`
   does, with `promptId` `'00-foundation-fix-2'` and scratch name
   `'sheet-fix-2'`, importing `paths`, `scratchDir`, `renderRoomGrid` and
   `makeSheet` from `file:///E:/Projects/retro-ports/sokoban/game/tools/review.mjs`.
   Same four cells and labels. Run it; confirm
   `review/prompts/00-foundation-fix-2/sheet.jpg` exists and give its size.
   Do not run `gallery`; Opus does that after writing the summary.

## Report

For each run: thread count, wall-clock minutes, solved count, the solved rooms
with steps / pushes / weight, the unsolved list, any `exhausted`. Then: which
run won and whether you copied solutions back, test counts, audit output, the
sheet path and size, every file you created or deleted. Quote command output;
a step you did not run is "not run", never "passed".
