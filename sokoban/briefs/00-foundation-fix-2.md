# Split for fix 2 — the solver prunes live positions

The prompt is `prompts/00-foundation-fix-2.md` (architect decision: Claude Code
builds it, not Agy). This file says who does what inside Claude Code. Rules:
`sokoban/CLAUDE.md` → *Who decides who builds what*.

## Pembagian kerja

| Who | Takes |
|---|---|
| **Opus** | §1 diagnosis (rejection table on the unchanged solver; reverse-pull check of every rule). §3 the rules: the new freeze checker (`createFreezeChecker`), removing corral pruning, goal-room packing reduced to ordering, the exported lower bound (`createLowerBound`), the solver wiring. Choosing the thread count. Reviewing engineer's and qa-scout's work. The summary, the `NOTES.md` *Solver* section, the verdict. |
| **engineer** (Sonnet) | §2 `tests/soundness.test.js` and the fix-1 tests that used removed functions; `--threads` in `tools/solve.mjs`. Brief: `briefs/fix2-soundness-test.md`. |
| **qa-scout** (Haiku) | §4 runs: the thread-count comparison and the full 50-room solve, `npm test`, `review.mjs audit`, the sheet through `review.mjs`, the gallery; numbers reported verbatim. Brief: `briefs/fix2-runs.md` (written after engineer is done). |
| **Agy** | Nothing in fix 2 (architect decision). Agy runs prompt 01 in parallel. |

Fence: fix 2 owns `src/core/solver/`, `tests/solver.test.js`,
`tests/soundness.test.js`, `tools/solve.mjs`, and the *Solver* section of
`game/NOTES.md`. Prompt 01 owns everything else in `game/`.
