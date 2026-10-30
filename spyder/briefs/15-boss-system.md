# Brief 15 — the boss system and the makeover hitch

The prompt is `prompts/15-boss-system.md` (the architect's). This brief says only who does what, and how it runs. The specification is the prompt itself, `DESIGN.md` §6 and §8, and `ART-DIRECTION.md`.

## How it runs

- **Alone.** Nothing else is queued beside it; 16 (the Attic) waits until 15 is approved, because the Queen is built on this framework.
- It touches `game/lib/` (new `boss.js`, `room-runtime.js`, `hud.js`, the weapons), `game/tools/` (`perf.mjs`, `checks.mjs`) and every room's load path (the pre-warm). No other job may write those files while it runs.

## Pembagian kerja

### Agy (Gemini) — the bulk of the work

- **First, Argon** (`-Scope full`): the whole prompt. Argon refused at 14 with "Resets in 141h51m", so a `quota=1` is expected; it is tried once anyway, as the policy says.
- **If `quota=1`, Flash** (`-Scope logic`): all of [LOGIC]:
  - L1: measure the hitch per room *before* touching anything, find the cause, pre-warm at room load, add `perf.mjs --makeover-spike`, the before/after table;
  - L2: `game/lib/boss.js`, the runtime support (`rules.boss`, `rules.bossAt`, the extra goal, the shared hit path, hit stop, flash, shake, Sonic Pulse 25 %, phase transitions with the roar and the HUD note, the defeat slow-motion), the QA hooks `bossTo` and `bossPhase`, and the stand-in test boss in `checks.mjs`;
  - a blockout of A1 that already reads the boss state (name, health fraction, phase thresholds, defeated), so the painting is only the look;
  - the checks the prompt lists.

### Opus (Claude Code) — decisions, art and review

- **If Agy ran on Flash, A1:** the boss line on the work-order card: the red-ink heading with the name, the hand-inked wavy bar that shortens with health, a pencil tick at each phase threshold, and after defeat the strike-through and the small red tick. Same paper and fonts as the card; nothing changes on cards without a boss. Painted in the scratchpad until the `.done` file appears.
- Judging the hitch fix: are the before/after numbers measured, and is the cause named rather than guessed?
- The sheet (two cells, per the deliverable), the verdict, and the report in Indonesian.

### qa-scout (haiku) — running and checking

- Agy's `.done` file, log tail, and "Left for ART".
- After the art, the checks, one at a time: `checks`, `flowtest`, `regress` (Living Room identical), `perf --makeover-spike` (re-run independently, to confirm Agy's table), `audit`, console errors.
- Rendering the two sheet states.

### engineer (sonnet) — only small fixes found in review

- Wiring boss state into the card if the blockout does not expose it, a broken QA hook, a guard in `game/lib/`.
- Never the framework or the hitch as a whole while Agy can run it.

## Run log

- **2026-10-30 10:09.** Argon refused: `quota=1` after 8 s.
- **10:09–11:31.** Flash `-Scope logic`: exit 0, 82 min. It built L1 (`prewarmRoom()`, `perf.mjs --makeover-spike`) and L2 (`boss.js`, the runtime support, QA hooks, the stand-in in `checks.mjs`) by 11:01, ran every check, then started emptying `.scratch/` as a background task, sat idle 30 min waiting on it, and was terminated. **No `summary.md`, no results recorded, `.scratch/` left full.**
- **`qa-scout`** read the log and re-ran everything one at a time: `checks` 86 pass (the stand-in is hit by all five weapons, phase change, Sonic Pulse 25 %, defeat → goal → makeover), `flowtest` pass, `regress` identical, `perf --makeover-spike` worst frame 8.00 ms (Kitchen).
- **Opus review** found two gaps against the prompt: L1 has no "before" table and does not name the cause (it pre-warms everything, with the live `fx`/`light` and a silent `catch`); the defeat completes the goal at once, with no death animation, and the base `Boss` never sets `done`. Both went to **`engineer`** as `briefs/15-fix-hitch-and-defeat.md`.
- **Opus** painted A1 meanwhile (not touching the engineer's files): the canvas blockout replaced by markup + SVG using the clean meter's own dash technique — red-ink handwritten name, a wavy ink bar with a faint ghost of the lost length and a nib line, two pencil strokes per phase threshold; on defeat a two-pass red strike and a red tick drawn in. One critique round: the strike was too flat (it read as a double underline on the 1.6° card), the tick touched the name. Also restyled the phase note, which Flash had left as bare red text on the wall (against ART-DIRECTION §11), as a torn slip of the work-order pad.
- **`engineer`** finished: the 190–230 ms stall no longer reproduces even without pre-warm; the remaining 10.7–12.5 ms frame at 5.23 s is the results card's first layout, removed by pre-warming it. After: every room ≤ 5.0 ms. Dry run made side-effect free; defeat now completes the goal only when the boss is `done`. `checks` 87/87, `flowtest` pass, `regress` identical.
- **`qa-scout`** made the sheet and ran the final checks: `checks` pass, `regress` identical, audit clean, `.scratch/` emptied. `flowtest` failed two real-time spawn checks (front-porch, master-bedroom), during another project's `solve.mjs --threads 24` (CPU 90 %, started 12:06).
- **Opus** found the phase note missing from sheet cell 1 (a screenshot took 2.5 s under that load, longer than the note lives) and remade the sheet: the note triggered through `bossPhase`, its hide timer held for the shot. Summary written, gallery rebuilt.
- **`flowtest` re-run** automatically once the solver exited: 101 pass, "all checks passed", exit 0.
- **Verdict:** approved.

