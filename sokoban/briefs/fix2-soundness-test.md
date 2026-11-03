# Brief for engineer: fix 2 — soundness test, test updates, `--threads`

Part of `prompts/00-foundation-fix-2.md` (read §2 and §3 of it first) and
`briefs/00-foundation-fix-2.md`. Game root: `E:\Projects\retro-ports\sokoban\game`.
Read `docs/ARCHITECTURE.md` §5 and §6 for the rules and the solver. This project
has no `DESIGN.md`; `docs/` plays that role and you never edit it.

## Pembagian kerja

- **engineer (you):** the three tasks below, and their test run.
- **Opus:** owns every rule in `src/core/solver/` and decides any rule change. If your test catches a rule calling a solvable position dead, **do not change the rule**: report it.
- **qa-scout / Agy:** nothing in this brief.

## What Opus changed (already in the tree)

Pulling objects back from the solved position showed the fix-1 freeze rule
calling solvable positions dead in 14 rooms and the corral rule in 49. So:

- `src/core/solver/deadlocks.js` now exports `precomputeDistancesAndDeadCells`,
  `precomputeGoalRoomPacking`, and the new `createFreezeChecker`. The old
  `isFreezeDeadlock`, `isChainFreezeDeadlock`, `isFreezeDeadlockFast`,
  `isCorralDeadlockFast` and `isCorralDeadlock` are gone.
- `src/core/solver/solver.js` exports `createLowerBound`. Goal-room packing is
  now only a tie-break; it no longer cuts pushes.

The interface your test uses (all cells are `r * cols + c` of the parsed level):

| Call | Returns |
|---|---|
| `parseLevel(rows)` (`src/core/level.js`) | `{ rows, cols, wall[r][c], inside[r][c], targets[{r,c}], objects[{r,c}], start{r,c} }` |
| `precomputeDistancesAndDeadCells(level)` | `{ distances, isDeadCell[r][c] }` |
| `createFreezeChecker(level, isDeadCell)` | `isFreezeDeadlockAt(occupied: Uint8Array, cell: number)`; `occupied[i] = 1` where an object stands; **true = dead** |
| `createLowerBound(level, distances)` | `lowerBound(objectCells: Int32Array)`; **≥ 100000 = dead** |

Rooms: `src/data/rooms.generated.json` → `{ rooms: [{ number, rows, … }] }`, 50
rooms. It is git-ignored and may be absent: skip those tests then
(`describe.skipIf`).

## Task 1 — `tests/soundness.test.js`

States reached by **pulling** objects backwards from the solved position are
solvable by construction, so no dead-state rule may ever fire on one.

- **Generator:** every object on a target; the wanderer on the first inside,
  non-wall, unoccupied cell in reading order. Each step: flood-fill the cells the
  wanderer can reach (not wall, not outside, not occupied). A pull of the object
  at `b` in direction `d` is legal when `p = b + d` is reachable and free and
  `s = p + d` is floor and free; the object moves to `p`, the wanderer to `s`.
  Pick one legal pull uniformly with mulberry32 (seed = 1000 + room number for
  original rooms; a fixed seed for each of your own rooms). With no legal pull,
  start again from the solved position. **2,000 states per room.**
- **Checks on every state:** no object on a dead cell; `isFreezeDeadlockAt`
  false for **every** object cell; `lowerBound < 100000`.
- **On failure:** the message gives the room, the rule, and the state as rows
  (`#` wall, `$` object, `*` object on target, `.` target, `@` wanderer,
  `+` wanderer on target, space floor), so Opus can turn it into a unit test.
- **Rooms:** one `it` per original room (skipped when the JSON is absent), plus
  **at least three rooms you design yourself**: objects in a row along a wall,
  some on targets; a 2 × 2 block of objects all on targets; a room with dead
  cells along a wall and a one-wide corridor. Write them yourself; never use
  rooms from the original game or the internet.
- Report how long the file takes. If it is over 60 s, report it; do not cut
  the state count.

## Task 2 — `tests/solver.test.js`

- The *chain freeze* test calls the removed `isChainFreezeDeadlock`. Replace it
  with `createFreezeChecker` cases, each built from rows you write: two objects
  side by side against a wall, both off target → dead; the same with both on
  targets → not dead; a 2 × 2 block of objects off targets → dead; one object
  against a wall with free cells on both sides along the wall → not dead.
- The *corral pruning* test calls the removed `isCorralDeadlock`: delete it
  (Opus removed the rule as unsound).
- Rename the *goal-room packing order* test so it no longer says "prunes": it
  checks the dependency data, which is now used for ordering only. Do not change
  what it asserts unless it fails; if it fails, report it.
- Do not change the BFS comparison tests or any other test.

## Task 3 — `tools/solve.mjs`

Add `--threads N` (default: `os.availableParallelism()`), alongside the
existing `--room` / `--rooms`. Print the thread count and the machine's
core count in the start line and in the report header.

## Fence

Touch only `tests/soundness.test.js`, `tests/solver.test.js`,
`tools/solve.mjs`. Never `src/core/**`, `docs/`, `reference/`, `original/`,
`src/` or `src-game/` at the project root, and nothing else in `game/`: Gemini
runs prompt 01 in this folder from 00:00 and owns the rest. No git. Do not run
`npm run rooms` (qa-scout does the long run later).

## Done when

`npx vitest run` passes in `game/`. Report: files touched, test counts (total
and per file), the soundness file's duration, and any failure verbatim. **Finish
before 23:50**, so the tests are green when prompt 01 starts.
