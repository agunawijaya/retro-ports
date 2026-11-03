# Prompt 00 · fix 1 — the solver, and the room sheet

Follow-up to `00-foundation.md`. **Runs alone. Everything here is [LOGIC].** Same hard rules as prompt 00: do not touch `reference/`, `docs/`, `original/`, `src/`, `src-game/`; no git commits; never take solutions from the internet. Fix only what is listed; keep everything else as it is.

## What the review saw

Prompt 00 solved **1 of 50** rooms. That is not acceptable as a final result, and the record does not yet show why it happened:

1. **The table contradicts the summary.** The summary says rooms 2–50 timed out at `w = 1`, `w = 2` and `w = 3` with 120 s each. The table shows `120.00` s per room, which is one attempt, not three. Either the retries did not run or the table drops them. Nodes explored and the stop reason are not reported at all.
2. **The tunnel macro removes states.** In `src/core/solver/solver.js` (the `while (true)` loop after a push), whenever the box's destination has walls on both sides across the push direction and is not a target, the box is pushed on automatically, and only the final position is queued. The single push that leaves a box inside a corridor is never generated. That makes the search incomplete, and `w = 1` no longer guarantees a push-optimal answer (room 1 came back at 113 pushes at `w = 1`).
3. **The improvement rounds were not the ones asked for.** Round 2 was "try higher weights up to 200 k nodes", against a 6 M node budget. Goal-room packing order and better deadlock detection, both named in prompt 00, were not tried.
4. **The hot path allocates strings.** Every child builds `${r},${c}` keys into a `Map`, the heuristic checks targets through a string `Set`, and the transposition key is a string. Within a fixed 120 s this throttles the node count.
5. **The room sheet is clipped.** On `review/prompts/00-foundation/sheet.jpg` the fifth row of thumbnails (rooms 21–25 and 46–50) runs under the caption strip and is cut off.

## [LOGIC] 1. Measure first

`tools/solve.mjs` reports **every attempt** per room: weight, nodes explored, nodes per second, milliseconds, and the stop reason (`solved`, `time`, `nodes`, `exhausted`). The room's row shows the total time over all attempts and the weight that found the solution. Confirm the `w = 2` and `w = 3` retries run as `ARCHITECTURE.md` §6.2 says (120 s and 6 M nodes each, at most 10 min per room). Record room 2's nodes per second **before** you change anything else.

## [LOGIC] 2. Correctness

- Restrict the tunnel macro to a case that cannot lose a solution (for example: the player is also inside the one-wide passage behind the box, and the passage holds no target), or remove it. Write the rule you chose and why it is safe in `game/NOTES.md`.
- New test in `tests/solver.test.js`: a plain breadth-first search over push states (no heuristic, no macros, no pruning except walls) on at least four rooms you design yourself, up to 4 objects, one of them needing a box parked inside a corridor. The solver at `w = 1` must return the same push count as the BFS on every one.

## [LOGIC] 3. Speed

Take strings out of the search loop: cell indices only, a `Uint8Array` target mask, object occupancy as a typed array (or bitset) instead of `Set`/`Map`, a numeric transposition key (for example an open-addressing table on the two 32-bit Zobrist halves). Report room 2's nodes per second after, next to the before figure.

## [LOGIC] 4. The two improvement rounds prompt 00 asked for

Do them in this order, re-running **only the unsolved rooms** after each and recording solved counts:

1. **Goal-room packing order:** when targets sit in a room with a single entrance, compute a packing order offline (targets filled from the far end back toward the entrance) and use it to order or cut the pushes into that room.
2. **Better deadlock detection:** freeze deadlocks that involve chains of objects (an object frozen by a frozen neighbour, on either axis), and corral pruning (an area the wanderer cannot reach, closed off by objects, whose objects cannot all reach targets). Each new rule gets a small test that it prunes a dead position and keeps a live one.

The `w = 1` BFS comparison test must still pass after both rounds. Then run all 50 rooms once more with the §6.2 budgets.

## [LOGIC] 5. The sheet

Scale the 5 × 5 room grid so all 25 thumbnails, numbers and `langkah/dorongan` labels sit fully above the caption strip in both room cells.

## Done when

- `npm test` passes, including the new BFS comparison and deadlock tests (counts in the summary).
- `npm run rooms` writes verified solutions; the summary has the full table with every attempt, and the list of rooms still unsolved after both rounds.
- `node tools/review.mjs audit` prints nothing; `.scratch/` is emptied (copy the solve report into the summary first).

## Deliverable — then STOP

1. `review/prompts/00-foundation-fix-1/sheet.jpg` through `review.mjs`: the same four cells as prompt 00 (two room grids with the new results, the two quality-bar frames).
2. `review/prompts/00-foundation-fix-1/summary.md`: nodes per second before and after, the tunnel rule you kept, solved counts after measurement, after round 1 and after round 2, the full final table, rooms still unsolved, test counts, audit result.
3. Update the *Solver* section of `game/NOTES.md`.
4. `node tools/review.mjs gallery`.

Then stop. Do not start prompt 01.
