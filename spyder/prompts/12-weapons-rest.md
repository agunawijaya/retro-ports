# Prompt 12-rest — Weapons, pickups and unlocks (the remainder of prompt 12)

You are working on the Spyder web game in `E:\Projects\retro-ports\spyder`. This continues `prompts/12-weapons.md`. **Read that prompt whole: it is the specification.** This file says only what is already built and what is left.

**Runs alone.** Sections are tagged **[LOGIC]** or **[ART]** exactly as in prompt 12. If you were told to do only [LOGIC], give every weapon, projectile, pickup and HUD tag a plain blockout look, and leave every [ART] section untouched.

## Already built — keep it, build on it, do not rewrite it

The core of L1, built while you were out of quota; it passes `regress`, `checks` and `audit`. `game/NOTES.md`, section "The weapon system", has the API.

- `game/lib/weapons/registry.js`: `S.weapons.register / get / list / isUnlocked`. `isUnlocked` reads `S.progress.data.unlocked`, which L2 creates.
- `game/lib/weapons/vacuum.js`: the Vacuum Blaster, moved out of the runtime unchanged.
- In `room-runtime.js`:
  - the current-weapon slot;
  - switching: 1 / 2 / 3, Q / E, the mouse wheel, locked weapons skipped, 0.18 s with no firing;
  - world services for weapons: `tearSilk`, `snipThread`, `hitBody(…, damage)`, `breakCombo`, `shake`, plus `award`, `emit`, `burst` and `audio`;
  - the damage model (`health`, 1 for every current type).
- `hero.heroModel` follows the weapon. Every model other than `'vacuum'` falls back to the Vacuum's drawing until [ART] paints it.
- `checks.mjs`, section "weapons (L1 core)".

**Open decision:** whether the chosen weapon survives a room restart. Today `resetRoom()` always goes back to the Vacuum. Keep that, and write it in NOTES as the current rule.

## Left to build (all from prompt 12)

- **L1 [LOGIC]:**
  - The Web-Cutter, the Foam Spray, the Flamethrower and the Sonic Pulse, one file each in `game/lib/weapons/`, with the numbers in the prompt's table.
  - The Flamethrower's "only weapon while active, then the previous one returns".
  - **F** for a Sonic Pulse charge.
  - The how-to-play card and the start-card key strip (a fifth column "Weapons · 1 2 3 / Q E").
- **L2 [LOGIC]:** unlocks and the save migration, one breakable box per built room (contents as specified), the "three snips in 8 s" Sonic Pulse, and coins.
- **L3 [LOGIC]:**
  - The HUD fan of tags, with their resource displays. With only the Vacuum unlocked, it must look **exactly** as today.
  - Settings → Controls.
- **L4 [LOGIC]:** every check the prompt lists. `flowtest` for every room, `regress` identical for the Living Room, and `perf` for the Kitchen with the Flamethrower and foam.
- **A1–A3 [ART]:** as in prompt 12.

### Two traps

- **Run the browser suites one at a time:** `regress`, `checks`, `flowtest`, `perf`. Run in parallel, they have caused timing failures.
- **QA states:** add the ones the sheet needs, so that each of the six cells in prompt 12's deliverable can be staged with `__spyder.setup(<name>)`. List their names in the summary.

## Deliverable — then STOP

As in prompt 12, but written under this prompt's id: `makeSheet('12-weapons-rest', …)` when you paint, and `writeSummary('12-weapons-rest', …)`.

The summary records:
- the weapon table as built;
- the unlock and box positions per room;
- the names of the QA states;
- check counts, the regression result, perf and audit;
- who did [LOGIC] and [ART].

Then run `node review.mjs gallery` and stop.
