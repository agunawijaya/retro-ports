# Brief 12 — Weapons, pickups and unlocks

The prompt is `prompts/12-weapons.md` (the architect's). This brief says only who does what. The specification is the prompt itself, `DESIGN.md` §7–§8 and `ART-DIRECTION.md` §3, §6, §8, §11 and §15.

**Runs alone:** it changes the shared runtime and every room's data.

## Pembagian kerja

### Agy (Gemini) — the bulk of the work

- **First try, Argon** (`run-agy.ps1 -Prompt 12-weapons`, `-Scope full`): the whole prompt, L1–L4 and A1–A3.
- **If Argon reports `quota=1`, Flash** (`-Model gemini-3.8-flash-high -Scope logic`): all of [LOGIC], which is:
  - L1, the weapon system;
  - L2, unlocks, boxes, the mini-objective and coins;
  - L3, the HUD and settings;
  - L4, the checks.

  Every weapon, projectile, pickup and HUD tag gets a blockout look. Flash writes the "Left for ART" list.

### Opus (Claude Code) — decisions, art and review

- **Only if Agy ran on Flash, A1–A3:**
  - A1, the held models in `hero.js`, with the face clear in every aim direction;
  - A2, the effects: blade, foam, flame (with its light), the sonic ring, boxes and pickups;
  - A3, the fan of luggage tags and the "Found:" label on the results card.
- **Every visual and gameplay decision.** That includes whether a box blocks a jump path, and how the weapons feel on the sheet.
- **The review against the reference, the verdict, and the report to the owner in Indonesian.**

### qa-scout (haiku) — running and checking, no decisions

- Read Agy's `.done` file, its log tail and the summary's "Left for ART", and report them as they are.
- After the art:
  - run `regress.mjs`, `checks.mjs` and `flowtest.mjs`, **one at a time**;
  - run `perf.mjs` with the Kitchen Flamethrower case;
  - run `review.mjs audit`;
  - check the console in every room.
- Make the six renders for the sheet, using the QA states that Agy provides, into the scratchpad or `.scratch/` only.
- Report the exact output of every command. Edit nothing.

### engineer (sonnet) — small mechanical fixes only

- Only fixes found in review, each with its own short brief: wiring the state the art needs, QA staging that is missing or broken, guards.
- **Not** L1–L4 as a whole, while Agy can run it.

## Run log

- **2026-10-29 22:46.** Argon refused: `quota=1`, "Resets in 143h14m".
- **22:47.** Flash refused as well: `quota=1`, "Individual quota reached … Resets in 1h10m16s".
- **Decision (Opus):** wait for the Flash quota rather than hand L1–L4 to `engineer`. The owner wants the bulk to go to Agy, and the wait is only about an hour. Flash is scheduled to start again at 23:59:30.
- **The owner's rule:** while Agy waits for its quota, `engineer` works one bounded piece. When it is done, Agy is checked again before anything else goes to `engineer`.
- **Change of plan:** the 23:59 Flash start was cancelled, so it would not collide with `engineer`.
  - `engineer` took `briefs/12-weapons-L1-core.md` (the registry, `vacuum.js`, world services, the damage model and switching).
  - Agy gets everything else in prompt 12 next, through a continuation prompt written once that piece has been reviewed.
- **23:33, `engineer` done:** `regress` identical, `checks` all pass (including the new "weapons (L1 core)" section), `audit` clean. It reported `flowtest` failing on the Dining Room timing check, with steps 15–20× slower.
- **23:36, `qa-scout`:**
  - The machine was at 79–99 % CPU: a `python` process near the top, 15 `node`, 16 `chrome`.
  - `flowtest`: **all checks passed** (Dining Room 3.6 s).
  - `perf`, still under that load: Living Room `action` 6.03 ms against the unchanged reference at 4.30 ms; Kids' Bedroom `action` 4.51 ms.
  - The reference slowed as well, so the machine explains it. The budget of 8 ms is still met.
- **Opus review of the L1 core:** accepted.
  - The code moves the dart path into `vacuum.js` with the same numbers and events.
  - The world services are small, and nothing new runs per frame.
  - Open decision, kept as it is for now: the weapon resets to the Vacuum on a room restart.
- **23:37, Agy checked again:** Flash's quota returns at 23:57. A second `engineer` piece was not started, because it would still be running when Agy starts and both would be writing the same files.
- **Next:** `prompts/12-weapons-rest.md` (written by Opus) on Flash `-Scope logic`, at 23:58:30.

## Done when

- The prompt's deliverable is met:
  - `review/prompts/12-weapons/sheet.jpg`, the six cells;
  - `summary.md`, recording who did [LOGIC] and [ART];
  - the gallery rebuilt;
  - `audit` clean;
  - `.scratch/` empty.
- `regress.mjs` reports the Living Room identical with only the Vacuum unlocked.
- The verdict is appended to `summary.md`.
- **23:58–00:53, Agy Flash `12-weapons-rest` (`-Scope logic`):** exit 0.
  - Built the four weapons, L2, L3 and L4, plus the QA states `cutter-arc`, `nest-foamed`, `flame-web`, `sonic-pulse`, `box-burst` and `hud-fan`.
  - Its summary reports `checks`, `regress`, `flowtest` and `audit` passing.
  - `qa-scout` read the result: 13 items left for ART.
- **Review found these, sent to `engineer`** (one brief each):
  - `briefs/12-fix-flame-hero.md`: the flame never drew, because it read a `S.world` that does not exist. Fixed; `checks` pass.
  - `briefs/12-fix-hud-tags.md`: the fan never showed the Vacuum behind another weapon, the main tag's icon never showed, and "Found:" showed on every clear, not only the first. Added while it was running: the pressure dots stayed visible for the tank and the timer.
- **Still open** (in `room-runtime.js`, which prompt 13's Agy run is editing; to go to `engineer` once 13 is done):
  - QA `nest-foamed` fires for one frame only, so no foam is visible.
  - QA `sonic-pulse` puts the hero below the floor in the Hallway.
- **Opus [ART] so far:**
  - the held models (`hero.js`);
  - the blade, the foam, the flame with its moving light, and the sonic ring (`weapons/*.js`);
  - the tag fan, the tank, the fuse, the bell, the ink icons and the "Found:" label (`hud.css`).
  - Waiting on other files:
    - the results card's ink drawing (`screens.js`, after `engineer`);
    - the boxes and the pickups (`room-runtime.js`, after 13).
- **Done (2026-10-30):**
  - Opus painted the boxes and pickups after 13 had left `room-runtime.js`.
  - Review found five more defects (the peek `z-index`, `.card__unlock` beating `[hidden]`, the sonic shake, the boxes under the HUD, the red-tint QA states), all fixed: two by Opus, the rest by `engineer`.
  - Final run by `qa-scout`: `regress` identical, `checks` 71/71, `flowtest` 101/101, `audit` clean.
  - Verdict: approved. See `review/prompts/12-weapons/`.
