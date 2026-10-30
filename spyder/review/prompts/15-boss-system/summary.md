# Prompt 15 — Boss system and the makeover hitch (2026-10-30)

*Who did what (`briefs/15-boss-system.md`):*
- *Argon refused on quota (8 s).*
- ***Gemini 3.8 Flash** (`-Scope logic`, 82 min) built L1 and L2 and ran every check, then hung for 30 min on a background clean-up task and was terminated without writing this summary. Everything below was re-measured afterwards.*
- ***engineer** finished L1 (the "before" measurement, the cause, a side-effect-free dry run) and the defeat sequence (`briefs/15-fix-hitch-and-defeat.md`).*
- ***Opus** reviewed, painted A1, restyled the phase note, made the sheet and wrote this summary.*
- ***qa-scout** read Flash's log and ran the checks, the regression, perf and the audit, one at a time.*

---

## L1 — The makeover hitch

**What was found.** The 190–230 ms stall that `12-weapons` measured (Kitchen, Study) **no longer reproduces**, with or without pre-warming, measured the same way (`clearRoom()`, then stepping frames). With pre-warming switched off, the worst makeover frame in every room is 10.7–12.5 ms, always at t = 5.23 s. That is the moment the results card first lays out, with its fonts and `measureText` (suspect 2 in the prompt). Pre-warming the results card alone takes the Kitchen from 10.9 ms to 4.7 ms.
- **[inferred]** Whatever caused the large stall left the code between prompts 12 and 15; the Study has no first-call lazy cache today. Which change removed it is not established.

**The fix.** `prewarmRoom()` runs at room load, after `document.fonts.ready`, in five parts:
- `blend`: the two masked-blend canvases;
- `art`: props, sky, furniture, lights and glow, into a throwaway context and a throwaway `S.LightMap`, with `live` snapshotted and restored;
- `beats`: each `art.beat` and the unique beat, with a stub `fx` (no sound, no particles);
- `audio`: the chime graph;
- `results`: the results card's first fill and layout.

A failed dry run now warns with the room's name instead of being swallowed. QA flags `noprewarm=1` and `prewarm=<parts>` reproduce the "before" column and isolate each part.

**`node perf.mjs --makeover-spike`** steps each room through `clearRoom()` and 6 s of makeover (360 frames, step + render), and reports the worst frame. `--no-prewarm` and `--prewarm=<parts>` pass the flags through.

| Room | Before (no pre-warm) | After |
|---|---|---|
| front-porch | 11.00 ms at 5.23 s | 3.90 ms |
| living-room | 11.30 ms at 5.23 s | 3.90 ms |
| family-room | 11.40 ms at 5.23 s | 5.00 ms |
| kitchen | 10.90 ms at 5.23 s | 3.70 ms |
| dining-room | 12.20 ms at 5.23 s | 4.60 ms |
| downstairs-bathroom | 11.00 ms at 5.23 s | 3.30 ms |
| upstairs-hallway | 10.70 ms at 5.23 s | 3.50 ms |
| master-bedroom | 12.20 ms at 5.23 s | 3.70 ms |
| kids-bedroom | 11.30 ms at 5.23 s | 3.70 ms |
| study | 10.90 ms at 5.23 s | 3.70 ms |
| upstairs-bathroom | 12.50 ms at 5.23 s | 3.90 ms |

The target was no makeover frame above 16 ms; the worst is now 5.0 ms. One batch run showed a single 20 ms Kitchen frame that did not come back on a re-run or in isolation; it is reported as machine noise, not as a pass.

## L2 — The boss framework

`game/lib/boss.js`:

```js
S.bosses.register({ id, name, health, phases: [{ id, at, note? }], create(world, opts) {} });
// instance: update(dt, world), draw(ctx), drawGlow(ctx, light),
//           hitTest(x, y, r), hit(world, damage, weaponId), enterPhase(id), die(world),
//           phase, health, maxHealth, alive, dying, done
```

- **Spawning:** `rules.boss` spawns the boss at room start, or at `rules.bossAt` seconds. Defeating it is an extra goal labelled with its name; the room's quota still applies to the regular spawns.
- **Hits:** every weapon reaches the boss through the shared hit path. Sonic Pulse takes 25 % of max health. A hit freezes only the boss for 40 ms, flashes it white and shakes the screen 0.3.
- **Phases:** spawns pause 1.5 s, `enterPhase(id)` is called, the screen shakes, a low roar plays (band-passed noise falling 240 → 90 Hz under two falling tones), and a note shows for 2 s: `phase.note ?? "She's angry now."`.
- **Defeat:** slow motion at 0.4× for 1.2 s, and the boss's own death animation. The goal completes only when the boss reports `done`, so the makeover cannot start under the death. The base class shrinks and fades the stand-in over 0.8 s. A custom boss sets `done` itself; the runtime forces it after 4 s.
- **QA hooks:** `__spyder.bossTo(fraction)`, `__spyder.bossPhase(id)`.
- **The stand-in in `checks.mjs`:** 10 health, two phases. It is hit by all five weapons and changes phase. Sonic Pulse takes 2.5. On defeat the goal is not done at once, the sim runs at 0.4×, the goal completes after the death, and `clearRoom()` starts the makeover. No regular spawn happens in the 1.5 s after a phase change.

## A1 — The boss on the work order (painted by Opus)

The blockout canvas was replaced by markup and SVG, using the clean meter's own technique (`pathLength="1"` and a dash offset), so it is the same paper and the same ink:
- **The name:** in Caveat, red ink (`--ink-red: #962c20`), slightly askew, as if added by hand.
- **The bar:** a nervous wavy ink stroke that shortens with health. A faint ghost of the full length stays, like ink blotted off, so the lost health still reads. A thin dark line along the top is where a nib pools its ink.
- **Phase ticks:** two quick pencil strokes at each threshold.
- **On defeat:** a two-pass red strike is drawn across the bar, then a small red tick beside the name.
- **Nothing changes on the cards of rooms without a boss.**

**The phase note**, restyled. Flash left it as bare red text over the wall, which breaks ART-DIRECTION §11 (every piece of UI is an object) and reads poorly on the dark wallpaper. It is now a slip torn off the work-order pad, in the same red ink, dropping in with a slight turn.

**The sheet:**
- **Cell 1:** the stand-in at 50 %, the phase note on screen.
- **Cell 2:** the card after defeat, enlarged.
- **How the note was captured:** it is triggered through the real phase path. Its 2 s hide timer was held for the photograph, because one screenshot took 2.5 s on the loaded machine.

## Checks

- **`checks.mjs`:** 87 / 87 (engineer); all pass again in the final run.
- **`regress.mjs`:** "canvas identical to the reference in every state".
- **`review.mjs audit`:** clean. `.scratch/` emptied.
- **Console:** no errors in the sheet pages.
- **`flowtest.mjs`:** passed in the engineer's run. The final run failed two real-time checks: "front-porch: runs in real time and spiders come (t 2.5 s, 1 critters)", and the same for master-bedroom.
  - That run overlapped another project's `tools/solve.mjs --threads 24`, which started at 12:06 and held the CPU at 90 %.
  - The check counts spiders against the wall clock, and it is the one listed in this folder's traps as failing under load.
  - **Re-run after the solver exited, on an idle machine: 101 pass, "all checks passed", exit 0.**

**Claude Code review:** approved. The framework does what the prompt asks, and L1 now says what it found rather than guessing. The boss line reads as written on the card by the same hand, and the struck-through bar makes the defeat legible at a glance.
