# Prompt 02 — The tower: title, courtyard, elevator, floors, progress

You are building the Hening web game in `E:\Projects\retro-ports\sokoban\game`. **Runs alone, after 01 is approved.** Follow it literally. When something is unclear, choose what keeps the look of the approved room and of `docs/ART-DIRECTION.md`, and write the decision in `game/NOTES.md`.

## Why this prompt exists

After 01, the 50 rooms play beautifully, one after another. Now the world around them: the Menara Hening floating above the clouds, a courtyard the wanderer walks in instead of a menu, a stone elevator, five floors of alcoves that light up as rooms are solved, and the progress that remembers it all. Every screen is built from the same kit, shader, moods and wanderer as the room — **no flat 2D menus**.

## Read first (completely, in this order)

1. `docs/GAME-DESIGN.md` — §4, §5 (only to know what 03 adds), §7, §8, §9.
2. `docs/ART-DIRECTION.md` — §5.3, §9, §12, §13 (all screens), §14, §15.
3. `docs/ARCHITECTURE.md` — §7.3 (screens and router), §8 (storage), §10, §13.
4. `game/NOTES.md`, then open the game (`npm run dev`, `?qa=1&room=6`) and play a room through to its results. Look at `review/current/room/` and `review/prompts/01-room/`.

## Hard rules

- Do not modify `reference/`, `docs/`, `original/`, `game/src/core/`.
- Reuse, do not fork: island builder, pastel shader, moods, wanderer, decor, fx, audio and HUD from 01. If a screen needs something new (the tower, an alcove, a stele), add it as a new module in `render/` or `world/` built from the same kit pieces and role colours.
- Zero raster; no new fonts; Indonesian copy exactly as written in `GAME-DESIGN.md` (lower case where it is lower case, no exclamation marks).
- Input is never blocked by an animation; every cut-scene can be skipped (`GAME-DESIGN.md` §3).
- Humanized code. No git commits.

## [LOGIC] 1. Router, storage, progression

- `main.js` + a tiny router (`ARCHITECTURE.md` §7.3): `enter / update / exit`, one renderer, one audio engine, transitions as a veil fade through the current mood's `fog` colour (0.6 s out, 0.6 s in; instant with reduced motion).
- `state/progress.js` and `state/settings.js` exactly as `ARCHITECTURE.md` §8 (the garden store comes in 03). Everything wrapped in try/catch; the game must work with storage disabled.
- Progression: `GAME-DESIGN.md` §4.1 — room 1 open; solving room *n* opens *n + 1*; a floor is "lit" when its ten rooms are solved; replays allowed; records (Tanpa Batas only for now) keep the best moves and best pushes independently.
- `dev/qa.js`: make `screen(name, params)` and `progress(json)` real. `progress({ solvedUpTo: 23 })` must be a shortcut for "rooms 1–23 solved with plausible records".
- Remove the temporary boot of 01: the game starts at the title. `?qa=1&room=N` still opens a room directly.

## [ART] 2. The tower and the title — `render/tower.js`, `screens/title.js`

`ART-DIRECTION.md` §13.1, §13.2. Build Menara Hening from the kit: five floor terraces, 2.4 units apart, each 9 × 9 tiles around a 3 × 3 shaft, wall caps and finials on their edges, a band of three arches per side between floors, the dome (half sphere r 1.6 with a jewel) on top, the courtyard island at its foot, plinth tiers into the clouds below. The alcoves (see 5) are part of each terrace and show the lit rooms from far away; a lit floor's arch band glows (mood `glow`, the pastel shader's glow term, 0.6).

Title: mood Fajar, camera zoomed out to frame the whole tower from the courtyard to the dome, the wanderer meditating at its foot, "Hening" and "ketuk untuk mulai" exactly as the reference's start veil. First gesture: audio starts, veil fades (1.4 s), wanderer stands, camera eases down to the courtyard (2.4 s).

## [ART] + [LOGIC] 3. The courtyard — `screens/courtyard.js`

`ART-DIRECTION.md` §13.3, `GAME-DESIGN.md` §7.2. A 9 × 9 island at the tower's foot, mood Fajar. Rows `r` 0–8 back to front, columns `c` 0–8 left to right in grid terms (default camera):

| Place | Cells | Build |
|---|---|---|
| Gerbang Menara | gate at (0, 4), against the tower foot | two pillars 0.3 × 1.4 × 0.3, lintel 1.6 × 0.16 × 0.4 with a finial, in the torii's vermilion and dark top; through it, the elevator platform |
| Batu Catatan | (2, 1) | upright stele 0.5 × 1.0 × 0.16, engraved lines as thin inset boxes; one more engraved line per solved floor |
| Paviliun Taman | (2, 6)–(3, 7) | four posts, a hex roof like the lantern's at 2.2 wide |
| Kolam | (6, 5)–(7, 6) | 2 × 2 pond with the room's water shader, stone rim, one lotus, two koi |
| Jalan Setapak | off the west edge at (6, 0) | five descending stone blocks vanishing into the cloud |

- The wanderer starts at (5, 4) (or by the place it last used) and walks with keys or taps, exactly like in a room. Places are not walkable cells except their activation tile, which is the cell in front of each place.
- Standing on an activation tile shows the place's name in a small serif caption above it (fade 0.3 s); Enter, Space or a second tap uses it. Keys 1–5 walk there automatically (order of `GAME-DESIGN.md` §7.2).
- The stranger sits on the courtyard's front edge; one or two crows use the courtyard's perches (finials, the gate lintel, the stele top).
- Gerbang → elevator up to the floor of the next unsolved room (mode choice arrives in 03; until then every run is Tanpa Batas). Batu Catatan → records card (7). Kolam → preferences card (8). Paviliun → a veiled card "taman ini sedang disiapkan" (prompt 03 replaces it). Jalan Setapak → back to the title.

## [ART] + [LOGIC] 4. The elevator — `screens/elevator.js`

`ART-DIRECTION.md` §13.4. The round stone platform (r 0.8, h 0.15) in the shaft; 3.2 s per floor, `easeInOutSine`, camera rising with it; arch bands rotate 90° into place (0.9 s each, staggered) and a stair section slides out of the shaft wall as it passes — purely visual; arrival settles with a 2 cm spring overshoot and a quiet D3 bell. Works up and down, over several floors in one ride. Any key skips to the arrival.

## [ART] + [LOGIC] 5. The floors — `screens/floor.js`

`ART-DIRECTION.md` §13.5, `GAME-DESIGN.md` §7.4. Each floor terrace has ten alcoves, one-tile niches set into its outer wall, spaced evenly around the terrace. The camera orbits the terrace in 36° steps (0.6 s each) so one alcove faces the player at a time; the wanderer walks along the terrace to stand in front of it.

| Alcove | Look |
|---|---|
| Locked | closed by a stone slab (`wall` colour), no object |
| Open | slab gone, the theme object unlit, a softly pulsing target ring in front |
| Solved | the theme object lit (halo, pool, motes) |
| Current | lit hover tile in front; place line `LANTAI II · RUANG 14`; a caption under it with the best moves and pushes if solved |

- ← / → (or tap an alcove) moves; Enter enters the room (the alcove's object rises, 0.8 s cross-fade into the room's arrival); ↑ / ↓ rides the elevator to an open floor above or below; Esc rides down to the courtyard.
- The terrace's mood is the mood of that floor's next unsolved room (§5.3); a fully solved floor shows Malam with every alcove lit.
- The theme object in the alcoves comes from the theme registry (it will be crystals, monoliths… in 04).

## [ART] + [LOGIC] 6. Results and pause — `screens/results.js`, `screens/pause.js`

- Results: replace 01's temporary veil with `GAME-DESIGN.md` §7.6 — solved line, counters, `rekor baru` when a record falls (a small engraved-line flourish), choices **ruang berikutnya** (Enter) / **ulangi** / **menara**. After room 10, 20, 30, 40: *ruang berikutnya* rides the elevator up first and the floor's ring lights with a deep bell. After room 50: only **naik** → the ending (9).
- Pause (`ART-DIRECTION.md` §13.8): Esc or P in a room: canvas `saturate(0.6) brightness(1.04)` over 0.6 s, the wanderer sits, veiled list *lanjutkan · ulangi ruang · kembali ke menara · suara*, ↑ / ↓ + Enter, the selected item breathing (2.4 s).

## [ART] + [LOGIC] 7. Batu Catatan — `screens/records.js`

A veiled stele card: title "Batu Catatan", tabs Lantai I–V (← / →), ten rows per floor: `ruang 14 · 212 langkah · 61 dorongan`, unsolved `—`. A disabled tab "Dupa" for now (03 fills it). Esc closes back to the courtyard.

## [ART] + [LOGIC] 8. Kolam — `screens/settings.js`

A veiled card with the settings of `GAME-DESIGN.md` §7.10 that exist now: Tema (list from the registry; only Lentera, the others not shown yet), Suara (three sliders styled as thin stone bars with a round pebble handle), Gerak halus (on / off / ikut sistem), Petunjuk tombol. Mode awal and Panjang dupa appear in 03. Changes apply live and are saved. Keyboard: ↑ / ↓ rows, ← / → values, Esc closes.

## [ART] 9. The ending — `screens/ending.js`

`GAME-DESIGN.md` §8: the elevator rises past floor V to the dome; every alcove glows; the wanderer walks to the dome's edge and sits beside the stranger, who turns its head toward the wanderer; hold 6 s; slow fade to the Fajar sky with "Hening"; back to the courtyard. Skippable. Reachable in QA with `progress({ solvedUpTo: 49 })`, then finishing room 50 via `arrange()`.

## [LOGIC] 10. Checks

- `tools/flow.mjs` (Playwright): title → courtyard → walk to the gate → elevator → floor I → room 1 → `arrange()` → results → ruang berikutnya → room 2 → pause → kembali ke menara → floor I shows room 1 solved and room 2 open → Esc to courtyard → Batu Catatan shows room 1's record → Kolam changes a slider → reload → everything kept. Then the same with storage disabled (`page.addInitScript` making `localStorage` throw): plays without errors, forgets on reload. Then `progress({ solvedUpTo: 9 })` → `arrange()` room 10 → elevator up, floor II, ring lit on floor I. Then the ending from `solvedUpTo: 49`.
- `tools/perf.mjs`: add the title (whole tower) and a fully lit floor to the existing room measurements. Budgets: `ARCHITECTURE.md` §14.
- No check uses the solver; `arrange()` finishes rooms everywhere.
- `npm test` passes; `npm run build` still makes a `hening.html` that opens from disk, starts at the title and plays.

## [ART] 11. Critique — at least 3 rounds

Render every new screen at 1440 × 900 (and the courtyard and a floor at 390 × 844). Per round, compare against the approved room frames in `review/current/room/` and against `ART-DIRECTION.md`: same palette per mood, same pastel three-tone shading, same kit pieces, calm motion, veiled text, nothing flat, default-looking or cluttered, captions legible, the tower readable as one monument. Write the 5 biggest gaps per round in `game/NOTES.md` → *Tower critique*, fix, re-render.

Keep the latest frames with `saveCurrent` in `review/current/tower/`: `title`, `courtyard`, `courtyard-caption`, `elevator`, `floor1`, `floor2-progress23`, `tower-from-courtyard-progress23`, `results`, `results-record`, `pause`, `records`, `settings`, `ending`, `phone-courtyard`, `phone-floor`.

## Done when

- The whole flow of 10 passes, with and without storage.
- 3 critique rounds documented.
- Perf within budget.
- `node tools/review.mjs audit` prints nothing; `.scratch/` emptied.

## Deliverable — then STOP

1. `review/prompts/02-tower/sheet.jpg`, twelve cells: `judul`, `halaman`, `halaman · keterangan tempat`, `elevator`, `lantai I`, `lantai II (23 ruang selesai)`, `menara dari halaman (23 ruang selesai)`, `selesai · rekor baru`, `jeda`, `batu catatan`, `kolam`, `akhir`.
2. `review/prompts/02-tower/summary.md`: screens and modules added, storage schema as implemented, the flow test steps with pass/fail, perf numbers, the critique notes per round, test counts, build size, audit result.
3. `node tools/review.mjs gallery`.

Then stop.
