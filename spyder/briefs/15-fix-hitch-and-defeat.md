# Brief 15-fix — finish L1 (name the hitch) and the defeat sequence

For `engineer`. The prompt is `prompts/15-boss-system.md`; read L1 and L2 there. Gemini Flash built both, all checks pass (`checks` 86/86, `flowtest`, `regress` identical), but it stopped before writing anything down, and two parts do not yet meet the prompt.

**Stay out of `game/lib/hud.js`, `game/css/hud.css` and `game/index.html`** — Opus is painting the boss line on the work-order card there right now. Everything you need is in `game/lib/room-runtime.js`, `game/lib/boss.js`, `game/tools/perf.mjs`, `game/tools/checks.mjs` and the QA flag parsing.

## A. L1: measure the "before", name the cause, make the dry run harmless

Today `prewarmRoom()` (room-runtime.js ~2024) pre-warms everything at room load, and `node perf.mjs --makeover-spike` reports worst makeover frames of 8 ms or less. But there is no "before" table, and the prompt asks to *find the cause and write what you found*. The only earlier number is in `review/prompts/12-weapons/summary.md`: "a one-off hitch of about 190–230 ms when some rooms start their makeover (Kitchen, Study; not the Living Room or the Kid's Bedroom), measured by stepping frames after `clearRoom()`".

1. Add a QA URL flag `noprewarm=1` that skips `prewarmRoom()`, and a second one, `prewarm=<parts>`, that runs only the named parts. Split the function into parts: `blend` (the two masked-blend canvases), `art` (drawProps / drawSky / drawOnFurniture / lights / glow into the throwaway), `beats` (each `art.beat` and `uniqueBeat.run`), `audio` (`audio.prewarm()`), `results` (the results-card fill and layout). `perf.mjs --makeover-spike` gets `--no-prewarm` and `--prewarm=<parts>` that pass the flags through.
2. Run `--makeover-spike --no-prewarm` over every built room: that is the "before" column. Then, for Kitchen and Study (and any other room that spikes), run with each part alone to find which one removes the spike. Run perf jobs one at a time.
3. Say what the cause is, with its timing (e.g. "first `art.beat('oven')` paints a 1920×1080 offscreen, 180 ms"). Read the code of the part that matters far enough to name the actual expensive call. If the spike does not reproduce at all with `--no-prewarm`, that is the finding: say so, and say what in the code likely removed it since prompt 12 (check `review/prompts/12-weapons-rest/summary.md` and the room code), marked as inferred unless you prove it.
4. Make the dry run side-effect free. `uniqueBeat.run(cleanMk, 6, fx)` and `art.beat(...)` are called with the live `fx`, and `art.lights(light, …)` / `art.glow(tctx, light, …)` with the live light system. Pass a no-op stub where a call could spawn particles, play sounds or add lights, and restore any room/live state the beats mutate. Prove it: for every built room, the `dirty` QA state renders identically with `noprewarm=1` and without it (pixel-compare, images into `.scratch/` only).
5. Replace the silent `catch (e) { /* Safe fail-through */ }` with a `console.warn` that names the room and the error, so a broken dry run is visible.

## B. L2: the defeat sequence, per the prompt

The prompt: *"Defeat: slow motion 0.4× for 1.2 s, the boss's death animation, then the normal makeover may start once the other goals are done."* Today `defeatBoss()` (~399) calls `world.completeGoal('boss')` at the moment of defeat, and `S.Boss` never sets `done`, so there is no death animation and the dead boss stays in `critters` forever.

1. Complete the `boss` goal when the boss reports `done` (its death animation finished), not at defeat.
2. Base `S.Boss` (boss.js): a default death for the stand-in — over 0.8 s of simulated time, scale and alpha go 1 → 0, keep drawing while dying, then `done = true`. This is test scaffolding, not game art; keep it that plain.
3. A custom boss from `create()` owns its own death and sets `done` itself. Guard: if it has not after 4 s of simulated time, the runtime sets it.
4. Phases may carry an optional `note`; the HUD note uses `phase.note ?? "She's angry now."`.
5. `checks.mjs`: update the defeat test (defeat → goal not done yet → step 1.5 s → goal done → `clearRoom()` → makeover) and add two checks: the sim runs at 0.4× for 1.2 s after defeat, and no regular spawn happens in the 1.5 s after a phase change.

## Finish

- Run, one at a time: `node checks.mjs`, `node flowtest.mjs`, `node regress.mjs` (no positional argument; the Living Room must stay identical), `node perf.mjs --makeover-spike`.
- No git commits. Images only in `.scratch/`.
- Report, under 500 words: the before/after table per room (worst frame, at what makeover time), the cause with its timing, which parts of the pre-warm are needed, what you changed (files and functions), and the check totals verbatim.
