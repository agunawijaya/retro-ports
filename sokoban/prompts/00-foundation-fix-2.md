# Prompt 00 · fix 2 — the solver prunes live positions

Second and last follow-up to `00-foundation.md`. **Everything here is [LOGIC].**

> **Architect decision (2026-10-29): Claude Code (Opus) builds this one itself, not Gemini.** Flash failed the solver twice and then hit its quota; the solver is the hardest algorithm in the project. This is the one exception to "you do not build game code". It may run **in parallel with prompt 01** (Gemini): 01 never touches `game/src/core/`, `tests/` solver files or `tools/solve.mjs`. Write your `game/NOTES.md` *Solver* section only at the very end, editing just that section, so it does not collide with 01's sections. Same hard rules as prompt 00: do not touch `reference/`, `docs/`, `original/`, `src/`, `src-game/`; no git commits; never take solutions from the internet. Fix only what is listed.

## What the review saw

In `review/prompts/00-foundation-fix-1/summary.md`, **19 rooms stop with `exhausted`**: rooms 4, 9, 10, 11, 12, 19, 22, 24, 25, 27, 30, 37, 39, 41, 42, 45, 48, 49 after **one** node (11 after two), and room 6 after about 1,900 nodes. `exhausted` means the search ran out of states, i.e. the solver claims the room cannot be solved. Every one of the 50 rooms shipped in the original game and is solvable, so **at least one pruning rule removes live positions.** In prompt 00's run no room stopped this way; the rules added in fix 1 (goal-room packing order, chain freeze, corral pruning) are the suspects, but prove it, do not assume it. The summary's explanation ("complex spatial entanglement") does not fit a search that ends after one node.

## [LOGIC] 1. Find which rule is wrong

For each of the 19 rooms, expand the start node with every rule on, and record for each candidate push which check rejected it (wall/object, dead cell, freeze, chain freeze, 2 × 2, corral, goal-room packing, heuristic ≥ 100000). Put that table in the summary.

## [LOGIC] 2. A soundness test that needs no solutions — `tests/soundness.test.js`

States reached by **pulling** objects backwards from the solved position are solvable by construction (play the pulls in reverse as pushes). So:

- For each room in `rooms.generated.json` (skip the test when the file is absent) and for at least three rooms you design yourself: start with every object on a target and the wanderer on any cell it could stand on; make random legal pulls with a seeded generator (mulberry32, seed per room), 2,000 states per room.
- **No dead-state check may fire on any of those states**: dead cells, freeze, chain freeze, 2 × 2, corral, and the heuristic must stay below 100000.
- On a failure, print the room, the rule, and the state as rows, so the case can be turned into a unit test.

## [LOGIC] 3. Fix the rules

- Fix every dead-state rule that the soundness test catches. If a rule cannot be made sound, remove it and say so in `game/NOTES.md`.
- **Goal-room packing order** is an ordering, not a proof that a state is dead. Keep it only as move ordering or tie-breaking (it may change *which* node is expanded first, never *whether* a node exists), unless you can show in `NOTES.md` why a hard cut cannot lose a solution in the rooms where you apply it.
- The `w = 1` BFS comparison test from fix 1 must still pass.

## [LOGIC] 4. Re-run

Run all 50 rooms with the `ARCHITECTURE.md` §6.2 budgets. **No room may stop with `exhausted`**; if one does, the soundness work is not finished. Note that the full run with 32 threads gave room 2 about 10,500 nodes per second against 39,035 measured alone; record the thread count you use and the machine's core count, and choose the thread count that solves the most rooms.

## Done when

- `npm test` passes, including `soundness.test.js` (counts in the summary).
- `npm run rooms` writes verified solutions; no room ends `exhausted`.
- `node tools/review.mjs audit` prints nothing; `.scratch/` is emptied (copy the solve report into the summary first).

## Deliverable — then STOP

1. `review/prompts/00-foundation-fix-2/sheet.jpg` through `review.mjs`: the same four cells as before (two room grids with the new results, the two quality-bar frames).
2. `review/prompts/00-foundation-fix-2/summary.md`: the rejection table from section 1, which rules were wrong and how each was fixed or removed, soundness test results, test counts, thread and core count, the full final table with every attempt, the rooms still unsolved, audit result.
3. Update the *Solver* section of `game/NOTES.md`.
4. `node tools/review.mjs gallery`.

Then stop. Do not start prompt 01.
