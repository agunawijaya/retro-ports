# Prompt 00 — Foundation: project, rooms, rules, solver, review tools

You are starting the real Hening web game in `E:\Projects\retro-ports\sokoban`. **Runs alone.** Every section of this prompt is **[LOGIC]**: there is no visual work here. Follow it literally. When something is unclear, choose what `docs/ARCHITECTURE.md` implies and write the decision in `game/NOTES.md`.

## Read first (completely, in this order)

1. `docs/ARCHITECTURE.md` — binding for this prompt (all of it).
2. `docs/GAME-DESIGN.md` — §2 rules, §4 structure.
3. `docs/ART-DIRECTION.md` §0 (the `window.hening` API) and §15.
4. `reference/index.html` — read sections 2, 10 and 14 (levels, board parsing, game state) and section 18 (`window.hening`). Open it in a browser once.

Do **not** use `src-game/assets/levels/*.xsb` or `all_*_levels.txt`: they have wrong file names, levels 1–4 missing, and empty editor stubs (`ARCHITECTURE.md` §2, §4.2). Read the original binary files instead.

## Hard rules

- Do not modify `reference/`, `docs/`, `original/`, `src/`, `src-game/`.
- Do not delete anything. Move `web-prototype/` to `_archive/web-prototype/` (an earlier concept; keep it). Leave the stray `index.html` in the folder root as it is (the owner's copy of the reference).
- No original room may appear in committed-looking places: the generated JSON files and everything in `review/` are git-ignored (`ARCHITECTURE.md` §12). Unit-test fixtures are rooms **you write yourself**.
- Humanized code: clear names, short functions, comments that explain *why*. Plain JavaScript (ES modules) with JSDoc where it helps. No frameworks.
- No git commits.

## [LOGIC] 1. Scaffold `game/`

Create the Vite project with the layout of `ARCHITECTURE.md` §2. In this prompt only `core/`, `data/`, `tools/`, `tests/` get real code; create the other folders with a one-line `README.md` each saying which prompt fills them.

- `package.json` scripts: `dev`, `build`, `test` (Vitest), `rooms` (importer + solver), `review` (`node tools/review.mjs`).
- Dependencies, exact versions: `three@0.170.0`; dev: `vite`, `vite-plugin-singlefile`, `vitest`, `playwright-core`. Pin what you install in `package.json` without `^`.
- `index.html` + `src/main.js`: for now a plain page that loads the rooms and prints "Hening — fondasi" plus the room count. Prompt 01 replaces it.
- `vite.config.js`: single-file build to `dist/hening.html` (`ARCHITECTURE.md` §12). Verify `npm run build` produces it and that it opens from disk showing the room count.
- Fonts: download Cormorant Garamond (300, 300 italic, 400, 400 italic, 500) and Jost (300, 400, 500) as WOFF2 from Google Fonts into `public/fonts/` with a `LICENSES.md` (SIL OFL 1.1, names and source URLs). Not used yet; prompt 01 switches the CSS to them.
- Append the `.gitignore` lines from `ARCHITECTURE.md` §12 to `E:\Projects\retro-ports\.gitignore` (append only; keep everything there).

## [LOGIC] 2. The importer — `tools/import-rooms.mjs`

Exactly as `ARCHITECTURE.md` §4. Notes:

- The file list in §4.1 is authoritative. Assert each file is 612 bytes.
- Decode, trim blank rows/columns, write `src/data/rooms.generated.json` with 50 rooms and the garden array (empty slots are omitted; today all 50 are empty — report that count).
- Validate every room with `core/level.js` (`validateLevel`); any failure stops the import with file, record and reason.
- `src/data/rooms.js`: loads the generated file; if it is missing, exposes one built-in practice room **you design** (small, 2 objects, solvable) and a flag `rooms.isPractice = true`.

## [LOGIC] 3. The rules — `src/core/`

`level.js`, `game.js`, `replay.js`, `path.js` exactly as `ARCHITECTURE.md` §5, including the `MoveResult` contract, the stable target index in reading order, restart as one undoable history entry, and LURD replay. No imports from outside `core/`.

## [LOGIC] 4. The solver — `src/core/solver/` and `tools/solve.mjs`

As `ARCHITECTURE.md` §6: push-based weighted A*, Hungarian matching lower bound on precomputed push distances, dead cells, freeze deadlocks incl. 2 × 2, Zobrist transposition table, deterministic. `worker.js` wraps the same solver for the browser (message in: rows + budget; out: progress ticks every 250 ms, then `{ lurd, steps, pushes }` or `{ failed: true }`); prove it loads in a Vite dev page.

`tools/solve.mjs`:
- Solves all 50 rooms with the budgets of §6.2, using all CPU cores (worker threads, one room each).
- Verifies each solution with `replayLurd` before writing `src/data/solutions.generated.json`.
- Merges `solutions.manual.json` if present (none exists now).
- Prints and saves the table (room, solved, steps, pushes, weight, seconds) to `.scratch/solve/report.md`.

If rooms stay unsolved after the full budget: improve the solver (tunnel macros, goal-room packing order, better deadlock detection) and re-run **only those rooms**, up to two improvement rounds. Then report what is left. **Never** take solutions from the internet.

## [LOGIC] 5. Tests — `tests/`

Vitest, all passing:

- `level.test.js`: parsing, trimming, inside flood fill, validation messages (objects ≠ targets, no start, start not enclosed).
- `game.test.js`: walk, push, push onto/off a target (`lit`/`unlit` indices), blocked by wall, blocked by object, blocked by object+object, solved event, undo of each, restart + undo of the restart, counters.
- `replay.test.js`: LURD round trip; a wrong LURD reports `failedAt`.
- `path.test.js`: shortest path around walls and objects; unreachable → `null`.
- `solver.test.js`: three small rooms you write (trivial, one needing a detour, one with a dead-cell trap); also a room that is unsolvable on purpose returns `failed`.
- `importer.test.js`: a synthetic 612-byte buffer you build in the test (two tiny rooms, both object codes, start on a target) decodes to the expected rows. Plus one test, skipped when `original/` is absent, that imports the real files and checks: 50 rooms, objects = targets in each.

## [LOGIC] 6. Review tools — `tools/review.mjs` and `tools/shoot-reference.mjs`

`review.mjs` (ES module + CLI), as `ARCHITECTURE.md` §13:

| Export / command | Does |
|---|---|
| `paths` | `root` (sokoban), `review`, `scratch` |
| `scratchDir(name)` | creates `.scratch/<name>/` |
| `saveCurrent(page, target, state)` | JPEG q90, 1920 × 1080 → `review/current/<target>/<state>.jpg` |
| `makeSheet(promptId, cells)` | `cells = [{ src, label }]` → `review/prompts/<promptId>/sheet.jpg` (1920 wide, 2 columns of 960 × 540, q80, caption strip in Jost) — compose in a headless page with `<canvas>`, no image npm packages |
| `writeSummary(promptId, md)` | `review/prompts/<promptId>/summary.md` |
| `gallery` | rebuilds `review/index.html` (data embedded, opens from disk; prompts newest first with sheet + rendered summary; current frames by target; the reference row labelled "quality bar"). Look: background `#2b2833`, text `#efe8f2`, headings in Cormorant Garamond italic, thumbnails with a 1 px `#4a4558` border, generous spacing. Click to enlarge, arrows to move, Esc to close |
| `audit` | `ARCHITECTURE.md` §13; prints nothing and exits 0 when clean |

`shoot-reference.mjs` renders the quality bar from `reference/index.html` into `review/reference/` (JPEG q90, 1920 × 1080). Make it reproducible: in `page.addInitScript`, replace `Math.random` with a seeded generator (mulberry32, seed 7) before the page runs. Frames:

| File | Calls (see `ART-DIRECTION.md` §0, §8.4) |
|---|---|
| `room06-fajar.jpg`, `-siang`, `-senja`, `-malam` | `start(); skipIntro(); arrange(4)`; hide the panel; `setMood(0..3)`; wait 1.5 s |
| `room07-senja.jpg` | `level(2); skipIntro(); setMood(2)` |
| `scrub-walk.jpg`, `scrub-run.jpg`, `scrub-push.jpg`, `scrub-protest-up.jpg`, `scrub-look-left.jpg`, `scrub-meditate.jpg`, `scrub-bow.jpg` | `closeUp(5); face(1); scrub(…)` with the checkpoint times of §8.4 |
| `gate.jpg`, `stranger.jpg`, `fountain.jpg`, `basin.jpg` | `focus(...)` on `decor.gate`, `decor.stranger`, the fountain in room 7, the first basin in room 6 |
| `finale.jpg` | room 6, `arrange()`, wait 4.5 s (bow + petals) |
| `arrival.jpg` | room 6 reloaded, `start()`, wait 2.5 s (wanderer on the stepping stones) |

Use the installed Edge or Chrome via `playwright-core` (`ARCHITECTURE.md` §11). The reference loads Three.js from jsDelivr, so this needs the network.

## [LOGIC] 7. `game/NOTES.md`

Start it with sections: *Decisions*, *Rooms* (import counts), *Solver* (the table, unsolved list, improvement rounds), *Tests* (counts), *Tools*. Later prompts append their own sections.

## Done when

- `npm test` passes (counts in the summary).
- `npm run rooms` imports 50 rooms and writes verified solutions; the summary has the full solve table.
- `npm run build` writes `dist/hening.html` that opens from disk.
- `review/reference/` holds the 18 quality-bar frames.
- `node tools/review.mjs audit` prints nothing; `.scratch/` is emptied (copy the solve report into the summary first).

## Deliverable — then STOP

1. `review/prompts/00-foundation/sheet.jpg`, four cells:
   - **"Ruang 1–25"** and **"Ruang 26–50"**: a plain 2D schematic of every room (5 × 5 grid of thumbnails per cell, drawn on a canvas: walls `#8f8ab8`, floor `#f2ece4`, targets as rings, objects as filled hexagons, the start as a dot), each labelled with its number and the solution's `langkah/dorongan` (or `belum` if unsolved). This lets the owner see that rooms 1–4 are there.
   - **"Quality bar · Fajar"**: `review/reference/room06-fajar.jpg`.
   - **"Quality bar · protes"**: `review/reference/scrub-protest-up.jpg`.
2. `review/prompts/00-foundation/summary.md`: what was created and moved, import counts (rooms, empty garden slots), test counts, the solve table, unsolved rooms (if any) and what you tried, build size of `hening.html`, audit result.
3. `node tools/review.mjs gallery`.

Then stop. Do not start prompt 01.
