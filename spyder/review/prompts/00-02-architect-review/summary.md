# Prompts 00–02 — Game Shell, Front Porch, Kitchen & Jumper (2026-10-28)

- **Prompt 00 (`game/`):** Built the full game shell (title letter, SVG/canvas house map, settings with character sketches and brass dials, how-to, room runtime, spider registry, `localStorage` progress) with Room 2 (`living-room`) rendering canvas-identical to `reference/`.
- **Prompt 01 (`rooms/front-porch/`):** Added Room 1 (Front Porch) with swinging bench platform, swinging lantern + cage shadows, Ashworth brass nameplate story object, door-crack makeover beat, and 6-step diegetic tutorial notes from "A." on the left post.
- **Prompt 02 (`rooms/kitchen/`, `lib/spider-types/jumper.js`):** Added Room 4 (Kitchen) and the Jumper spider (perspective leg plane, telegraph crouch, predictive ballistic leap, mid-air "Swatted! +100" bonus, fridge/stove/drain hiding places, tap & kettle makeover beat).
- **Shell integration:** Updated map navigation (edge-to-edge room comparison, same-floor horizontal arrows) and multi-room flow/unlock checks across `front-porch`, `living-room`, and `kitchen`.
- **Checks:** `regress.mjs` canvas-identical in all 5 states; `flowtest.mjs` 49/49 passed; `checks.mjs` 28/28 passed; Front Porch `playtest` 28/28 passed; Kitchen `playtest` 14/14 passed; frame times 1.9–2.9 ms mean (budget ≤ 8 ms).
- **Verdict:** approved.
