# Brief: verify the Flash [LOGIC] claims of 03 and 04 (qa-scout)

## Pembagian kerja

- **Haiku (you):** run the checks below on the tree as it is now, report numbers. No edits, no decisions.
- **Opus:** reviews the report.

The 04 summary claimed a Lentera regression "MATCH" that turned out never to have rendered a room, so the other claims are checked once, independently, before the ART step.

## Run, in `E:\Projects\retro-ports\sokoban\game`

1. `npm test` — report files / tests passed / failed (names of any failures).
2. `node tools/flow.mjs` — report the PASS/FAIL line per step and the total; on a FAIL, the reason column.
3. `npm run build` — report the size of `dist/hening.html` and whether it finished without errors.
4. `node tools/review.mjs audit` — report whether it printed anything.

Do not edit any file. If a command hangs longer than 15 minutes, stop it and report that.
Report in at most 25 lines.
