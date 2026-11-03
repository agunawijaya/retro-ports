# Prompt 04b — The tower becomes floating stones (Batu Bertumpuk)

You are rebuilding the tower of the Hening web game in `E:\Projects\retro-ports\sokoban\game`. **Runs after 03 and 04 are approved, alone, before 05.** Follow it literally. When something is unclear, choose what keeps the look of the approved room frames in `review/current/room/`, and write the decision in `game/NOTES.md`.

## Why this prompt exists

The owner reviewed prompt 02's tower: square terraces, arch bands, pillars and a dome read as a **multi-storey car park**, the one large shape in Hening that is not calm. The build followed the spec; the spec changed. `docs/ART-DIRECTION.md` §13.1–§13.5 and the new §13.12, and `docs/GAME-DESIGN.md` §4.2, §7.3, §7.4 and §8, now describe **Menara Hening as seven floating stones on one axis**: the courtyard stone, five ring-stones (one per floor, smaller as they rise, each with an opening the platform rises through), and a capstone where the game ends. Background and the questions it answered: `proposals/tower-floating-stones.md` (the architect's decisions are at its end).

Only the tower's **shape and its moving parts** change. Screens, flow, input, stores, records, modes, themes, Mimpi, the helper and Taman Sendiri stay exactly as they are.

## Read first (completely, in this order)

1. `docs/ART-DIRECTION.md` — §4, §5, §6, §9, §10b.3, §10b.4, **§13.1–§13.5, §13.12** (new), §14, §15.
2. `docs/GAME-DESIGN.md` — §4.2, §7.1–§7.4, §8.
3. `proposals/tower-floating-stones.md`.
4. `game/NOTES.md` → the tower sections and *Tower critique*; `render/tower.js`, `world/tower-world.js`, `world/tower-views.js`, `world/places.js`, `screens/title.js`, `courtyard.js`, `elevator.js`, `floor.js`, `ending.js`.
5. `review/prompts/02-tower/` and `review/current/tower/` (what is being replaced), `review/current/room/` (the quality bar).

## Hard rules

- Do not modify `reference/`, `docs/`, `original/`, `game/src/core/`, `src/themes/`.
- Keep every screen's module interface, input map and flow: `tools/flow.mjs` (02's and 03's steps) must pass **unchanged**. If a step can only pass by editing the check, stop and write why in NOTES.
- Niche objects and targets come from the theme registry and 04's instancing layer, as the alcoves do now; nothing in the tower may know which theme is active.
- Nothing from the old tower survives: no walls, arch bands, pillars, terraces, square shaft or dome (§13.2: "no walls, arches, pillars, bands or dome anywhere").
- Zero raster; pastel shader and role colours only; no new fonts. Humanized code. No git commits.

## [ART] 1. The stones — `render/tower.js` (rewrite)

Build exactly §13.2: the seven stones with their radii, openings and heights; the lathe profile (flat raked top, rounded `cap` rim, underside fading to `fog` like a plinth, rounded opening lip); the 0.22 balance offset turning 36° per floor, measured from the axis; the capstone 2.3 off the axis; the breathing (±0.025 over 8 s, ±0.4°, phase per floor; off with reduced motion); the rim of light for a fully solved floor. Below the courtyard stone, the room's three plinth tiers into cloud.

Judge it at the title framing first: from the courtyard to the capstone, the stack must read as **one calm object — balanced river stones in the sky** — with sky visible between the stones and through the openings, and the figure in black small on the capstone's edge. Then at floor distance: the stone's facets take the three tones softly; the raked rings are barely there; nothing looks like a plate or a car tyre (if it does, the underside and rim proportions are wrong — fix those, not the radii).

## [ART] + [LOGIC] 2. Niches — the floor stones

§13.5: ten niches per floor stone at 36°, each target / object / curved back stone at `R − 0.45 / 0.95 / 1.35`; low rim caps with finials between them; the locked slab; the current hover tile; the caption. The wanderer walks along the rim to the current niche's target. The 36° orbit is around the axis. Check Lantai V (R 2.8): the back stones must not crowd the opening and the objects must stay readable.

## [ART] + [LOGIC] 3. The courtyard stone — `world/places.js`, `screens/courtyard.js`

§13.3: the five places at their new cells, the walkable cells (within 4.2 of the axis, minus the opening's five cells), the torii at the opening's front lip leading onto the platform, Jalan Setapak as five free-floating stepping stones off the west rim. The stranger leaves the courtyard (he is on the capstone now); crows use the stele, torii and pavilion roof. Keys 1–5, captions, the 20 s idle and 03's gate choice keep working.

## [ART] + [LOGIC] 4. The ride — `screens/elevator.js`

§13.4: the platform rises from the recess along the axis through each opening, 3.2 s per floor; each stone it passes **settles** (4° turn, 3 cm dip, back over 1.6 s with a soft overshoot) with the quiet stone knock; arrival spring and D3 bell; down is the same ride reversed; any key skips. Several floors in one ride must feel like one smooth ascent through rings, not a sequence of stops.

## [ART] 5. Title and ending — `screens/title.js`, `screens/ending.js`

- Title (§13.1): reframe for the stack; lit rims show progress.
- Ending (§13.12, `GAME-DESIGN.md` §8): the platform rises past Lantai V to stop beside the capstone; the wanderer steps across; the lone theme object lights as he passes; he sits beside the figure in black, who turns his head; the 6 s pull-back to the whole stack with five lit rims; fade to Fajar and "Hening"; back to the courtyard. Skippable.

## [LOGIC] 6. Checks

- `tools/flow.mjs`: all steps of 02 and 03, unchanged, with and without storage.
- `tools/perf.mjs`: title (every floor lit), Lantai II all lit, courtyard, the ride, the ending. Draw calls must not rise above 02's (127 / 116); frame time within `ARCHITECTURE.md` §14.
- Geometry test: for every floor, the platform (r 0.8) clears the opening at every point of the ride including breathing and settling (`1.2 − offset − bob tilt > 0.8 + 0.05`).
- `npm test` passes; `npm run build` makes a `hening.html` that opens from disk and starts at the new title.

## [ART] 7. Critique — at least 3 rounds

Render every tower screen at 1440 × 900, the courtyard and a floor also at 390 × 844. Per round, compare with `review/current/room/` and §13: same palette per mood, three-tone shading, calm motion, veiled text; the stack readable as one balanced monument; nothing that reads as a building. Write the 5 biggest gaps per round in `game/NOTES.md` → *Stones critique*, fix, re-render.

Replace the frames in `review/current/tower/` with `saveCurrent` (same names as 02, so the gallery shows before → after in the prompt sheets): `title`, `courtyard`, `courtyard-caption`, `elevator`, `floor1`, `floor2-progress23`, `tower-from-courtyard-progress23`, `ending`, `phone-courtyard`, `phone-floor`; plus new `elevator-settle` (a stone mid-settle as the platform passes) and `floor5` (the smallest stone).

## Done when

- Flow passes unchanged, with and without storage; the clearance test passes.
- Draw calls and frame times within budget.
- 3 critique rounds documented.
- `node tools/review.mjs audit` prints nothing; `.scratch/` emptied.

## Deliverable — then STOP

1. `review/prompts/04b-floating-stones/sheet.jpg`, twelve cells, left = 02's frame, right = the new one where paired: `02 · judul`, `batu · judul`, `02 · halaman`, `batu · halaman`, `02 · elevator`, `batu · elevator (batu menetap)`, `02 · lantai II (23 ruang)`, `batu · lantai II (23 ruang)`, `batu · lantai V`, `batu · menara dari halaman (23 ruang)`, `02 · akhir`, `batu · akhir`. (Take the 02 frames from `review/prompts/02-tower/` cells or re-render them before replacing `review/current/tower/`.)
2. `review/prompts/04b-floating-stones/summary.md`: what was rewritten and removed, the stone numbers as built (any deviation from §13.2 with the reason), flow results, perf table, the critique notes per round, test counts, build size, audit result.
3. `node tools/review.mjs gallery`.

Then stop. Do not start prompt 05.

## Pembagian kerja (Claude Code, 2026-11-03)

The owner named the crew for this prompt: Haiku, Sonnet, Agy Flash and OpenCode DeepSeek Flash; [ART] stays with Opus (owner, 2026-11-02; Argon's quota is out until about 2026-11-04 22:00).

| Order | Who | Does |
|---|---|---|
| 1 | **DeepSeek Flash** (OpenCode, `prompts/run-opencode.ps1`) | `prompts/04b-stone-layout.md`: `src/world/stone-layout.js` — every number and the pure math of §13.2–§13.5 and §13.12 (stones, offsets, breathing, settling, niche positions, courtyard cells, capstone, ride heights, clearance) — and `tests/stones.test.js`. Reviewed by Opus before step 2. |
| 2 | **Flash** (agy, `-Scope logic`) | Every [LOGIC] of this prompt, **importing `world/stone-layout.js` for every number** (do not restate them): niche placement and the wanderer's walk along the rim, the orbit around the axis, the courtyard places / walkable cells / torii / stepping stones / the stranger moved to the capstone, the ride along the axis with each stone's settle, the ending's sequence, `tools/perf.mjs` scenes, flow unchanged. Every [ART] item is a labelled blockout (simple lathe or cylinder stones at the layout's positions). |
| 3 | **Opus** | Every [ART]: the stones' profile and finish, the raked rings, the rim of light, niches and back stones, the courtyard stone's places, the ride's feel, title and ending, the critique rounds and the frames. |
| — | **Sonnet** (`engineer`) | Backup [LOGIC] if the Flash run fails once (no second Flash try), and small [LOGIC] fixes the [ART] needs while Opus works. |
| — | **Haiku** (`qa-scout`) | Starts each run and reads its done marker; at the end runs flow, perf, tests, build, audit, the sheet and the gallery. |

**Rules for the [LOGIC] run (step 2):**

- Do not write any frame into `review/current/tower/` (no `saveCurrent` there): those are 02's approved frames until the [ART] replaces them; 02's frames are also kept in `.scratch/04b-02-tower/` for the before/after sheet — do not delete that folder.
- `world/stone-layout.js` and `tests/stones.test.js` belong to step 1; if a number there is wrong, write it in NOTES as a request instead of editing it.
- Notes in `game/NOTES.md` → *Stones* (logic decisions) only; *Stones critique* is the [ART]'s.
