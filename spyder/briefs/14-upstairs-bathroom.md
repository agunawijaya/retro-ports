# Brief 14 — the Upstairs Bathroom

The prompt is `prompts/14-upstairs-bathroom.md` (the architect's). This brief says only who does what, and how it runs. The specification is the prompt itself, `DESIGN.md` §5 and `ART-DIRECTION.md`.

## How it runs

The owner asked, on 2026-10-30, for 13 and 14 to run while prompt 12 finishes.
- **14 starts now, in parallel with `12-weapons-rest`.** It does not touch `game/lib/`.
- Agy is given `prompts/notes/14-upstairs-bathroom.txt`, which tells it that prompt 12 is still being built, to stay out of `game/lib/`, `game/tools/` and the other rooms, and to edit only its one line in `index.html`.
- **13 waits until the `12-weapons-rest` logic run is done**, because both edit `game/lib/room-runtime.js`. Two Agy sessions writing the same file at once would lose one of them.

## Pembagian kerja

### Agy (Gemini) — the bulk of the work

- **First, Argon** (`-Scope full`): the whole prompt.
- **If `quota=1`, Flash** (`-Scope logic`): all of [LOGIC]:
  - L1, the layout;
  - L2: the mirror reflection pass, steam and the hot tap, the laundry basket lair, the chute hatch, the rules, the box, the beats and the QA states, including `mirror`;
  - the checks the prompt lists.

### Opus (Claude Code) — decisions, art and review

- **If Agy ran on Flash, all of A1:** the tiles, the slanted ceiling, the skylight and its light shaft, the mirror and its bulbs, the vanity, the bath and shower, the cupboard, the basket, the chute, the toothbrush cup (story), and dirty → clean.
- It must feel like a sibling of the downstairs bathroom, not a copy.
- The critique rounds, the verdict, and the report in Indonesian.

### qa-scout (haiku) — running and checking

- Agy's `.done` file, log tail and "Left for ART".
- After the art, the checks the prompt lists, one at a time: console errors, `perf` for `action` and `makeover`, and `audit`.
- The hero shots: `dirty`, `action`, `mirror`, `makeover`, `clean`, `results`.

### engineer (sonnet) — only small fixes found in review

- Wiring the state the art needs, broken QA staging.
- Never the room as a whole while Agy can run it.

## Run log

- **2026-10-30 00:09.** Argon refused: `quota=1`, "Resets in 141h51m".
- **00:10–00:26.** Flash `-Scope logic` finished: exit 0, with every check passing according to its summary.
- **`qa-scout`** read the result. Nothing under `game/lib/` was changed beyond the room's registry and map entries. There are 13 blockouts left for art.
- **Opus** painted A1, in three critique rounds; they are listed in the room's `NOTES.md`.
- **`engineer`** fixed the `mirror` QA state. The string spider's legs stretched to the top of the glass, because `hover: true` sets `rig.y` without replanting its feet. One line, `rig.plantAll()`, in the room's `room.js`.
  - **Follow-up for later:** the same fix belongs in the `hover` branch of `lib/spider-types/string.js`, so that no other room's QA state can hit it. It is left until `12-weapons-rest` is out of `game/lib/`.
- **Done.** `engineer` also fixed QA `action` (a red hurt pulse: a staged hatchling bit the hero). Final checks pass. Approved.
