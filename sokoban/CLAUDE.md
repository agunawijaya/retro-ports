# Hening (sokoban) — working notes for Claude Code

Hening is a new web game built on the 50 rooms of the 1984 Sokoban. It is built
from an architect's design rather than reconstructed, so the decompilation
conventions in `../CLAUDE.md` apply only where they make sense here (evidence,
copyright, tone). Talk to the owner in Indonesian; prompts, code and docs stay in
English.

## Who decides who builds what

The architect (claude.ai chat) writes `docs/` and `prompts/NN-*.md`: **what** to
build. **Claude Code decides who builds it**, by the model policy below. The
architect does not assign work to models.

Hening's crew rules live here and in `prompts/CLAUDE-CODE.md`, which carries the
same policy and the mechanics of running agy (`run-agy.ps1`, done markers, one
background wait, no polling, at most two follow-ups, the sheet, summary and
gallery, reporting, commits). The global "Aturan Kru" moved out of
`~/.claude/CLAUDE.md` on 2026-10-30; the `engineer` (Sonnet) and `qa-scout`
(Haiku) agents themselves stay global.

### Model policy (owner's decision, 2026-10-30)

| Who | Takes | Never |
|---|---|---|
| **Opus** (main session) | Director: the split, briefs and fix prompts, **one review per prompt**, the **solver**, and **new [ART]** — art the reference does not have (tower, elevator, floors, ending, themes) — when Argon is out | Delegate a visual or gameplay decision |
| **Sonnet** (`engineer` subagent) | **[ART] ported from `reference/index.html`** when Argon is out; **backup [LOGIC]** when a Flash run has failed once | Decide the look; touch `docs/` or `reference/` |
| **Haiku** (`qa-scout` subagent) | Running `run-agy.ps1`, the one background wait, reading the `.done` file and the log; running `review.mjs` (sheet, audit, gallery) | Make decisions; edit source |
| **Flash** via agy | **All [LOGIC]**: `-Model gemini-3.8-flash-high -Scope logic` | [ART] |
| **Argon** via agy | **Only [ART]**, while its quota lasts | [LOGIC] |
| **Kimi** (K3 via `prompts/run-kimi.ps1`) | **Backup [LOGIC]** before Sonnet once a Flash run has failed (owner, 2026-11-02) | [ART]; decide the look; touch `docs/` or `reference/`; commit |

- **[LOGIC] always starts on Flash.** If a Flash run fails once (a quota
  failure, a stall, or a result Opus's review rejects), that [LOGIC] goes to
  Kimi, then to Sonnet with a brief if Kimi fails too — no second Flash try for
  the same work.
- **[ART] goes to Argon while it has quota; when Argon is out, Opus builds it**
  (owner, 2026-11-02: "semua yang terkait ART harusnya Opus"). Kimi and Flash
  never take [ART] — both were tried on 03/04 on 2026-11-02 and the owner
  stopped it. A faithful port of `reference/index.html` may still go to Sonnet.
- Every result is reviewed once by Opus before it is accepted. The report to
  the owner names who built what and every fallback taken (Flash → Kimi → Sonnet,
  Argon → Sonnet or Opus).

### "Pembagian kerja" in every prompt and brief

Every prompt or brief Claude Code writes carries a section headed
**Pembagian kerja**: what goes to Flash, Argon, Sonnet and Haiku, and what Opus
does itself. That includes the split of an architect prompt, fix prompts and
crew briefs. When an architect prompt arrives, write the split before starting
anything.

### Where files go

- **Agy prompts:** `prompts/<NN-name>.md`; fix prompts `prompts/<NN-name>-fix-N.md`.
  `run-agy.ps1` reads only from `prompts/`.
- **Crew briefs:** `briefs/<task>.md`. This project has no `DESIGN.md`; briefs
  refer to `docs/GAME-DESIGN.md`, `docs/ARCHITECTURE.md` and
  `docs/ART-DIRECTION.md` instead. `docs/` and `reference/` play the role
  `DESIGN.md` plays in the crew definitions: the crew never edits them.

## Traps

- `docs/ARCHITECTURE.md` §9 describes a hidden feature. Never mention it to
  anyone but the owner, and never in UI text. A brief may cite the section number.
- Do not use `src-game/assets/levels/*.xsb` or `all_*_levels.txt`: wrong names,
  rooms 1–4 missing. The importer reads `original/` (`ARCHITECTURE.md` §4).
- `rooms.generated.json`, `solutions.generated.json` and all of `review/` hold the
  original rooms and are git-ignored (`ARCHITECTURE.md` §12). Check before any
  commit; commit only when the owner asks.
- Quota: Argon (`gemini-4-argon-high`) was out on 2026-10-29 until about
  2026-11-04 22:00. Flash shares its quota with other projects that run `agy` on
  this machine.

## State (2026-11-03, after prompt 05 — the last; update when it changes)

- **Prompt 00 (foundation):** accepted except the solver. Fix 2 made every
  pruning rule sound; the solver solved 1 of 50.
- **Solver (Opus, 2026-10-30, owner's order):** rewritten — typed-array nodes,
  incremental hashing and matching, bucket open list, PI-corral pruning, corral
  deadlocks, goal-room macros (w ≥ 2 only, so w = 1 stays exact). Push-optimal
  at w = 1 (room 1: 97, the known optimum; the old search gave 123). The §6.2
  run solves **8 of 50** (1, 2, 3, 6, 7, 17, 26, 38). **Owner's decision:** web
  solutions fill the rest — 48 verified from StrategyWiki's walkthrough in
  `solutions.manual.json`; rooms **11 and 42** differ from that source's
  layouts. Given to Codex, Gemini Flash and DeepSeek (owner's order): Codex
  solved room 11 (verified, stored). Room 42 was then found to be the
  historically shipped-broken Original level 42 — a first fix (misread from a
  secondary source) was wrong, caught by the owner asking why a documented fix
  wouldn't have a documented solution too; the real fix, diffed against
  XSokoban's own level file, is one box up one row, not left one column.
  **All 50 of 50 rooms now have a verified solution.** `game/NOTES.md` →
  *Solver*.
- **Prompt 01 (room): approved, one item for the architect.** All 50 rooms work
  and match the reference over three regression rounds; 95 tests; build 597 kB;
  room 6 all lit 5.4 ms/frame on integrated graphics. **Draw calls over the 150
  budget** (room 6: 174–191, room 10: 420–429): needs instanced theme objects,
  a theme-interface change (ARCHITECTURE §7.2). Built by Opus ([ART]) and
  engineer ([LOGIC], moved from Agy because of the quota); Flash stopped after 7
  min. `review/prompts/01-room/summary.md`, `game/NOTES.md`.
- **Prompt 02 (tower): built and approved by Claude Code (2026-10-30), waiting
  for the owner.** Title, courtyard, elevator, five floors, results, pause,
  Batu Catatan, Kolam, ending. Flow check 13/13 with and without storage; 141
  tests; build 656,716 bytes; title 127 / Lantai II 116 draw calls; GPU frame
  ≤ 7.8 ms median. No Agy (Argon quota): Opus built every [ART] part, engineer
  the [LOGIC] (router, stores, sound buses, room hooks, flow/perf checks),
  qa-scout surveyed and re-ran checks. `review/prompts/02-tower/summary.md`;
  decisions and three critique rounds in `game/NOTES.md`. Re-render the tower
  frames with `node tools/shoot-tower.mjs --save`, the sheet with `--sheet`.
- **Prompts 03 and 04: built, approved by Claude Code (2026-11-02), waiting for
  the owner.** [LOGIC] by Flash (03 accepted; 04 rejected, then fixed by
  `04-themes-fix-1` on Kimi and `04-themes-fix-2` on Sonnet). [ART]: Kimi
  (stopped by its quota) and Flash produced sheets that failed review; the
  owner then ruled all [ART] is Opus's, and Opus built `03-modes-garden-fix-1`
  and `04-themes-fix-3`. Checks: 169 tests, flow 18/18, all 50 rooms × 5
  themes ≤ 97 draw calls (worst: Mata Air, room 39), build 865,488 bytes,
  audit clean. Frames: `node tools/shoot-modes.mjs --save` and
  `node tools/shoot-themes.mjs --save` (`--sheet --prompt <name>` for sheets).
  Notes merged into `game/NOTES.md`. **Open:** frame time per theme is only
  measured under SwiftShader; `tools/perf.mjs` has no per-theme GPU cases yet.
- **Prompt 04b (floating stones): built, approved by Claude Code (2026-11-03),
  waiting for the owner.** The tower is seven floating stones on one axis
  (`world/stone-layout.js`, DeepSeek; [LOGIC] Flash; [ART] Opus). Overview
  views look up at the stack (title / ending 13°, courtyard 20°) because at
  35° the stones overlap; floors show one stone at rest. Flow 18/18, 203
  tests, title 104 / Lantai II 106 draw calls, build 873,572 bytes. Re-render:
  `node tools/shoot-tower.mjs --save`, sheet `--sheet04b`.
- **Prompt 05 (polish): built, approved by Claude Code (2026-11-03), waiting
  for the owner. Hening is done.** §1 stones and §8 acceptance by Opus; [LOGIC]
  Flash (reduced motion, leaks, limiter + gains); copy/secret/README and
  `tools/playthrough.mjs` DeepSeek; single-file build + copy fixes and
  `tools/gpu-frames.mjs` Sonnet; `tools/phone-check.mjs` Kimi (Flash's phone
  matrix had no tool). Review found and fixed: Mimpi froze the game at its
  first lantern (`playNote`, since 03), the frame loop died on any throw, the
  build was three files, phone layout lost two theme options. Checks: 203
  tests, flow 19/19, themes 250/250, rooms 50/50, playthrough 50/50 from disk
  (0 requests, 0 errors), phone 46/46, GPU worst median 1.1 ms, load median
  938 ms, build 1,091,897 bytes, audit clean. Final frames:
  `node tools/shoot-final.mjs --save` (`--sheet` for the 05 sheet).
  `review/prompts/05-polish/summary.md` has the §15 table and what stays open
  (GPU numbers vs 02's hand measurement, first-appearance stalls on the GPU,
  sound by ear, feel in a visible window).
- **Next:** nothing from the architect; the owner reviews 03–05.
- How the room is built: `briefs/01-room-contract.md` (the look ↔ glue
  interface); the reference-section map is in `briefs/01-room.md`.
- The record of each round: `review/prompts/<NN-name>/summary.md`, each ending in
  a `**Claude Code review:**` line.
