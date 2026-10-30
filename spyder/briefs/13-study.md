# Brief 13 — the Study / Library, and the Web Weaver

The prompt is `prompts/13-study.md` (the architect's). This brief says only who does what, and how it runs. The specification is the prompt itself, `DESIGN.md` §5–§6 and `ART-DIRECTION.md`.

## How it runs

The owner asked, on 2026-10-30, for 13 and 14 to run while prompt 12 finishes.

13 edits `game/lib/room-runtime.js` (L3, `world.addWeb`), which `12-weapons-rest` is editing too. So 13 **starts automatically the moment the `12-weapons-rest` logic run writes its `.done` file**, in parallel with 14.

Agy is given `prompts/notes/13-study.txt`, which says:
- Opus is then painting prompt 12's art in `hero.js`, the weapons' draw code, `hud.js` and `hud.css`, so stay out of those;
- 14 is building `rooms/upstairs-bathroom`;
- edit only what this prompt names.

## Pembagian kerja

### Agy (Gemini) — the bulk of the work

- **First, Argon** (`-Scope full`): the whole prompt.
- **If `quota=1`, Flash** (`-Scope logic`): all of [LOGIC]:
  - L1, the layout;
  - L2: the rolling ladder, the gallery, the three diary pages, the rules, the beats and the QA states, including `weaver`;
  - L3, `world.addWeb` and its fairness rule, with a check;
  - L4, the Web Weaver's behaviour on a plain rig;
  - the checks the prompt lists.

### Opus (Claude Code) — decisions, art and review

- **If Agy ran on Flash, all of A1:**
  - the bookcases with varied spines, the gallery, the ladder;
  - the green banker's lamp (the signature light), the globe;
  - the leaded window and its diamond light, the desk and the diary (story), the armchair, the pages;
  - dirty → clean, and the cleaner's notebook with the house map;
  - the Web Weaver's look: long front legs that weave.
- The critique rounds, the verdict, and the report in Indonesian.

### qa-scout (haiku) — running and checking

- Agy's `.done` file, log tail and "Left for ART".
- After the art, one at a time:
  - `regress`, `checks` and `flowtest`, because 13 changes `game/lib/`;
  - `perf` for `action` and `makeover`;
  - console errors and `audit`.
- The hero shots: `dirty`, `action`, `weaver`, `makeover`, `clean`, `results`.

### engineer (sonnet) — only small fixes found in review

- Never the room, `addWeb` or the Weaver as a whole while Agy can run them.

## Run log

- **2026-10-30 00:53–01:22:** Argon refused, then Flash `-Scope logic` finished with exit 0.
- **`qa-scout`** read the result.
- **Opus** painted A1 and the Web Weaver's look.
- **`engineer`** fixed QA `weaver` (it was not spinning) and QA `action` (a red hurt pulse).
- **Final:** `checks` 71/71, `flowtest` 101/101, `regress` identical. Approved.
