# Prompt 04 — The four other themes, and instanced theme objects

You are building the Hening web game in `E:\Projects\retro-ports\sokoban\game`. **Runs after 02 is approved, in parallel with `03-modes-garden.md`** (see *Sharing the code with 03* below). Follow it literally. When something is unclear, choose what keeps the look of the approved Lentera rooms in `review/current/room/`, and write the decision in `game/NOTES.md`.

## Why this prompt exists

The player chooses a theme at the Kolam (`GAME-DESIGN.md` §6). Only Lentera exists. This prompt adds **Cahaya Bintang**, **Taman Batu**, **Candi** and **Mata Air**, each as beautiful as Lentera, and fixes the one open item of prompt 01: rooms draw too many calls (room 6: 174–191, room 10: 420–429, budget ≤ 150) because every theme object is its own set of meshes. Themes now draw **instanced**, and Lentera is moved onto the same path first.

## Read first (completely, in this order)

1. `docs/ART-DIRECTION.md` — §4, §5, §7 (all of it), §10, §11, §14, §15.
2. `docs/ARCHITECTURE.md` — §7.2 (the theme interface, including the instancing note), §13, §14.
3. `docs/GAME-DESIGN.md` — §6.
4. `game/NOTES.md`, `briefs/01-room-contract.md`, `game/src/themes/`, `world/room-world.js`, `render/merge.js`, `render/pastel.js`.
5. `review/prompts/01-room/summary.md` → *Perf*, and the frames in `review/current/room/`.

## Hard rules

- Do not modify `reference/`, `docs/`, `original/`, `game/src/core/`.
- Every theme follows the common rules of `ART-DIRECTION.md` §7 (footprint, height, unlit/lit ramp, halo, pool, motes, ripple, empty-target pulse, glow = mood glow mixed 50/50 with the accent) and its own table in §7.2–§7.5, number for number.
- Nothing outside `src/themes/` may know which theme is active, except through the theme interface.
- Zero raster: no image or audio files. All instruments are synthesized.
- Humanized code. No git commits.

## Sharing the code with 03

03 (modes, garden) runs at the same time.

| Owned by 04 | Owned by 03 | Neither changes the other's files |
|---|---|---|
| `src/themes/**`, new `render/instances.js`, the object/target construction inside `world/room-world.js` (and the alcove objects in the floor and tower views, through the theme only) | `screens/*` (including `room.js`), `state/*`, `dev/*` | The handle `screens/room.js` uses for an object (`world.objects[i]`: `group.position`, `setLit(on)`, `nudge(…)`) **stays exactly as it is**. Keep that handle; change what is behind it |

`game/NOTES.md`: write only your own sections (*Themes*, *Instancing*, *04 critique*).

## [LOGIC] + [ART] 1. Instanced theme objects — first, with Lentera

- `render/instances.js`: one `InstancedMesh` per theme part (foot, post, roof, core…), per room. The pastel shader gets a per-instance `glowAmt` attribute (and a per-instance colour mix where a part needs it), so lit and unlit objects share one draw. Halos and pools likewise as instanced sprites/discs. Targets the same way.
- The handle per object stays: `group` becomes a light `Object3D` whose matrix (position, the push wobble, Cahaya Bintang's spin) is copied into its instances each frame when it changed; `setLit`, `update`, `nudge` work as before. `room.js` needs no change.
- Extend the theme interface in `themes/index.js` as `ARCHITECTURE.md` §7.2 now describes: a theme declares its **parts** (geometry, role colour, glowing or not, local transform) and its target parts; the instancing layer builds them. Effects that cannot be instanced (Mata Air's rising water, Taman Batu's raked lines) live in `roomExtras`.
- **Move Lentera onto it first.** Then render the regression frames of prompt 01 (`tools/regress.mjs`, same seed) for room 6 in the four moods, room 7, the finale and the scrub `push`: they must match the approved frames in `review/current/room/` — same silhouettes, same glow, same wobble. Only then start the new themes.
- Target: **≤ 150 draw calls** in room 6 all lit and in room 10 all lit, **for every theme**, with frame time still within §14.

## [ART] 2. The four themes — `themes/bintang.js`, `themes/batu.js`, `themes/candi.js`, `themes/mata-air.js`

Each exactly as its table in `ART-DIRECTION.md`:

| Theme | File | What must be true on screen |
|---|---|---|
| **Cahaya Bintang** (§7.2) | `bintang.js` | The crystal floats and turns slowly even unlit; lit, the thin beam rises and fades upward, wall caps within one tile take 15 % of the glow; the altar's U of pillars frames the star inlay |
| **Taman Batu** (§7.3) | `batu.js` | Raked sand on the inside floor (5 strips per tile, direction alternating per room); a lit monolith's rune glows and the strips within one tile curve into rings around it over 1.2 s, and back when it leaves |
| **Candi** (§7.4) | `candi.js` | The stupa reads as a stupa at play distance; lit, the lotus in the socket lights first and the dome's 8 windows 0.3 s later; **slendro** scale instead of pentatonic |
| **Mata Air** (§7.5) | `mata-air.js` | Water channels in the void cells next to the floor; each sealed hole raises the water by `0.2 / goalCount` and blooms one lotus; all sealed → water at y −0.05 and the waterfall off one plinth edge; unsealing reverses it |

- Labels per theme: `counterLabel` and `solvedLine` exactly as `GAME-DESIGN.md` §6.
- Instruments and push sounds exactly as the tables (partials, decay, filters, the marimba click, the koto bend, the bonang detune, the handpan drip). The muffled unlit note of §7.6 for all.
- Every theme in every mood: check Fajar, Siang, Senja and Malam. The unlit object must not disappear into the floor in any mood (adjust within the role tints, not by adding outlines), and the lit glow must stay pastel.
- The alcoves on the floors and the tower show the current theme's object (lit / unlit as their room). The title keeps Lentera only if the theme setting is unknown.
- The Kolam's theme row now lists all five (it reads the registry already; check it). Switching applies live, in rooms too, without a reload.

## [LOGIC] 3. Checks

- `tools/themes-check.mjs` (Playwright, `?qa=1`): for each theme × rooms 1, 6, 10, 25, 50: load, `arrange()` half the objects, then all; record draw calls, frame time, console errors; switch theme in a lit room and back.
- Unit tests: the registry (every theme has every interface field, `scale` length ≥ 5), slendro frequencies (D4 base, ratios of §7.4), Mata Air's water level per sealed count.
- `tools/perf.mjs`: room 6 and room 10 all lit, per theme. Budgets `ARCHITECTURE.md` §14.
- `npm test` passes; `npm run build` makes a `hening.html` that opens from disk; build ≤ 3 MB.

## [ART] 4. Critique — at least 3 rounds

Render room 6 in Senja with half the objects lit, for each theme, at 1440 × 900, plus a close-up (`closeUp(5)`) of one lit and one unlit object per theme. Per round: does each theme feel as finished as Lentera? Same palette and three-tone shading, same calm, nothing glossy or neon, objects readable at play distance, the lit moment special. Write the 5 biggest gaps per round in `game/NOTES.md` → *04 critique*, fix, re-render.

Keep the latest frames with `saveCurrent` in `review/current/themes/`: for each of `bintang`, `batu`, `candi`, `mata-air`: `<id>-room06`, `<id>-closeup`, `<id>-malam`; plus `mata-air-sealed` (all sealed, waterfall), `batu-rings`, `lentera-instanced-room06` (the regression check), `kolam-themes`, `floor2-candi`.

## Done when

- Lentera on the instanced path matches the approved frames.
- Draw calls ≤ 150 in room 6 and room 10, all lit, for all five themes; frame time within budget.
- The themes check passes with no console errors.
- 3 critique rounds documented.
- `node tools/review.mjs audit` prints nothing; `.scratch/` emptied.

## Deliverable — then STOP

1. `review/prompts/04-themes/sheet.jpg`, twelve cells: `lentera · instanced (ruang 06)`, `cahaya bintang · ruang 06`, `cahaya bintang · dekat`, `taman batu · ruang 06`, `taman batu · lingkaran pasir`, `candi · ruang 06`, `candi · dekat`, `mata air · ruang 06`, `mata air · semua tertutup`, `malam · keempat tema` (a 2 × 2 composite of the four `-malam` frames in one cell), `kolam · tema`, `lantai II · candi`.
2. `review/prompts/04-themes/summary.md`: the instancing design (parts, attributes, what stayed un-instanced and why), the Lentera regression result, draw calls and frame time per theme × room (table), test counts, the critique notes per round, build size, audit result.
3. `node tools/review.mjs gallery`.

Then stop. Do not start prompt 05.

## Pembagian kerja (Claude Code, 2026-11-02)

Runs at the same time as 03. The model policy is in `prompts/CLAUDE-CODE.md`.

| Who | Does in 04 |
|---|---|
| **Flash** (agy, `-Scope logic`) | Part 1 in full: `render/instances.js`, the per-instance attributes in the pastel shader, the parts interface in `themes/index.js`, the object/target construction in `world/room-world.js`, Lentera moved onto it, and the regression check against `review/current/room/` (the gate: no new theme work until it matches). For part 2: the four registry entries with every interface field, labels (`GAME-DESIGN.md` §6), `scale` data including the slendro frequencies, Mata Air's water level per sealed count, Taman Batu's ring timing, Candi's light order, Cahaya Bintang's spin — with **blockout** geometry and placeholder instruments. Part 3 in full. |
| **Argon** (agy, `-Scope art`) | The finished look and the instrument timbres of the four themes, every mood, the alcoves, critique 4 — tried once at the ART step. Argon and Kimi were both out of quota; **owner's decision (2026-11-02): Flash** (`run-agy.ps1 -Model gemini-3.8-flash-high -Scope art`), reviewed by Opus. |
| **Kimi**, then **Sonnet** | Backup [LOGIC] if the Flash run fails once (quota, stall, or rejected in review): Kimi first, Sonnet if Kimi fails too. |
| **Haiku** (`qa-scout`) | Starts the run, reads the `.done` file and the log; after ART: `review.mjs` sheet, audit, gallery. |
| **Opus** | This split, the review (including the Lentera regression frames), every visual decision, merging the notes, the report. |

**Rules for running beside 03** (they add to *Sharing the code with 03*):

- Notes: write your sections in **`game/NOTES-04.md`**, not `game/NOTES.md`. Claude Code merges them after review.
- `tools/flow.mjs` and `tools/perf.mjs` belong to 03 during this run. Do not edit them: record draw calls and frame time per theme × room in `tools/themes-check.mjs` (the prompt already asks for that) and put the table in the summary. The per-theme cases go into `perf.mjs` after both runs.
- Check the build with `npx vite build --outDir .scratch/04-dist` so the two runs never write `dist/` at the same time; the 3 MB limit applies to that output.
- Theme switching in tools: `hening.theme(id)` (the `window.hening` QA object) already exists in `dev/qa.js` (03 owns that file; do not edit it).
- Do not edit `package.json` (no new dependencies) or any test file you did not create. Do not touch `src/data/*.json`.
- `.scratch/`: delete only the folders your own tools created; never delete `.scratch/` itself.

**Rules for the ART step** (2026-11-02, after the [LOGIC] review; it runs beside 03's [ART]):

- The [LOGIC] was fixed twice: `review/prompts/04-themes-fix-1/summary.md` (regress renders rooms, water decor batched, all 50 rooms ≤ 150 calls, alcoves follow the theme) and `review/prompts/04-themes-fix-2/summary.md` (per-instance colour through `aColor`, start veil). Keep all of it: after your art, `tools/themes-check.mjs`'s full sweep must still give ≤ 150 in every room for every theme, and `tools/regress.mjs` must still show Lentera unchanged.
- Every frame enters its room through the router (`await hening.screen('room', { room: N })`) and waits for the start veil as `regress.mjs` does. Close-ups use `hening.focus(x, z, zoom)` on an object's position: `closeUp(5)` frames the wanderer, which is why the [LOGIC] run's `candi-closeup` and `mata-air-closeup` show no theme object.
- You own `src/themes/*`, `src/render/*`, `src/world/*`, `tools/regress.mjs`, `tools/themes-check.mjs`. 03's [ART] owns `src/screens/*`, `src/ui/*`, `src/dev/*`, `src/state/*`, `tools/flow.mjs`, `tools/perf.mjs`; do not edit them. Build checks go to `.scratch/04art-dist`, scratch folders `.scratch/04art-*` only.
- Build each theme exactly as its table in `ART-DIRECTION.md` §7.2–§7.5 and the common rules of §7; the *Left for ART* list in the summary suggests extras the spec does not have (a Buddha silhouette, moss textures, sampled sounds) — ignore those; zero raster holds.
- The critique rounds are real: render, look at every frame against the Lentera frames in `review/current/room/`. The [LOGIC] run's rounds were about blockouts and do not count.
- Notes in `game/NOTES-04.md` (*04 critique*).
