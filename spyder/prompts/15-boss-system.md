# Prompt 15 — Boss system and the makeover hitch [LOGIC]

You are working on the Spyder web game in `E:\Projects\retro-ports\spyder`. **Runs alone, before 16.** This prompt is almost all [LOGIC]; its only [ART] is the boss line on the work-order card (A1), small enough for whoever runs it.

## Read first

`DESIGN.md` §6 (Spider Queen), §8; `ART-DIRECTION.md` §6, §11, §13, §15 incl. "Where images go"; `game/NOTES.md`; `game/lib/room-runtime.js`, `game/lib/spider-rig.js`, `game/lib/weapons/` (damage, Sonic Pulse "25 % of boss health"), `game/lib/hud.js`; `review/prompts/12-weapons/summary.md` (the hitch note).

## Rules

Plain scripts, global `Spyder`, opens from disk. No per-frame blur. Humanized code. Images only through `review.mjs` or `.scratch/`; `audit` clean; `.scratch/` emptied. No git commits. `regress.mjs` must stay identical for the Living Room; `checks.mjs`, `flowtest.mjs` must pass.

## L1 [LOGIC] — The makeover hitch

`12-weapons` measured a one-off stall of about 190–230 ms when the makeover starts in some rooms (Kitchen, Study; not the Living Room or the Kid's Bedroom). Find the cause and remove it. Likely suspects, check each with timings (`performance.now()` around the first makeover frames) and write what you found:
- caches or sprites created lazily on the first makeover frame (clean-state sprites, room-specific offscreen canvases, the masked-blend canvases);
- fonts or `measureText` work on the first CLEAN stamp / results card;
- audio nodes created on the first chime;
- a room's `beat()` doing paint-once work at its first call.

Fix by **pre-warming at room load** (after `document.fonts.ready`): every clean-state cache, the blend canvases, the audio graph for chimes, and one dry-run of each room's beats into a throwaway context. Target: no makeover frame above 16 ms in any built room. Add `node perf.mjs --makeover-spike` that steps every room through `clearRoom()` + 6 s and reports the worst frame per room; put the table in the summary.

## L2 [LOGIC] — A boss framework

New `game/lib/boss.js`. A boss is a critter with phases. Interface:

```js
S.bosses.register({
  id: 'spider-queen',
  name: 'The Queen',
  health: 60,                        // in Vacuum-dart units
  phases: [                          // entered when health falls to `at` (fraction)
    { id: 'nest',   at: 1.0 },
    { id: 'descend', at: 0.66 },
    { id: 'rage',   at: 0.33 },
  ],
  create(world, opts) {},            // returns the boss instance
});
// instance: update(dt, world), draw(ctx), drawGlow(ctx, light),
//           hitTest(x, y, r), hit(world, damage, weaponId), phase, health, alive
```

Runtime support:
- `rules.boss: 'spider-queen'` in a room's data spawns the boss at room start (or at `rules.bossAt` seconds) and makes **defeating it an extra goal** (reuse `extraGoals`, label = the boss name). The room's spider quota still applies to the regular spawns.
- Weapons call `boss.hit(world, damage, weaponId)` through the same hit path as spiders. Sonic Pulse removes 25 % of max health. Bosses get a **hit stop** (40 ms freeze of the boss only), a white flash, and screen shake 0.3.
- **Phase transitions:** when a phase is entered, the runtime pauses spawns for 1.5 s, calls `boss.enterPhase(id)`, shakes the screen, plays a low roar (procedural audio, a filtered noise swell with a falling tone) and shows a handwritten note in the HUD layer ("She's angry now.") for 2 s.
- **Defeat:** slow motion 0.4× for 1.2 s, the boss's death animation, then the normal makeover may start once the other goals are done.
- QA hooks: `__spyder.bossTo(fraction)` sets boss health; `__spyder.bossPhase(id)`.
- A stand-in test boss in `checks.mjs` (a big circle with 10 health and two phases) proves: spawn, hit from every weapon, phase change, Sonic Pulse 25 %, defeat → goal done → makeover.

## A1 [ART] — The boss on the work order

While a boss is alive, the work-order card gets a heading line in red ink with the boss's name and a **hand-inked bar** below it (a wavy ink stroke that shortens as health drops, with a pencil tick at each phase threshold). When defeated, the bar is struck through and the line gets a small red tick. Same paper, same fonts. Nothing changes on cards of rooms without a boss.

## Deliverable — then STOP

1. `makeSheet('15-boss-system', …)`, two cells: the stand-in boss in the Living Room with the work-order boss line at about 50 % (with the phase note visible), and the same card after defeat.
2. `writeSummary('15-boss-system', …)`: hitch cause and fix, the per-room worst-frame table before and after, the boss interface, check counts, regression, audit, who did what.
3. `node review.mjs gallery`. Then stop.
