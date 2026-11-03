# Prompt 03 — Modes, records, Mimpi, the helper, Taman Sendiri

You are building the Hening web game in `E:\Projects\retro-ports\sokoban\game`. **Runs after 02 is approved, in parallel with `04-themes.md`** (see *Sharing the code with 04* below). Follow it literally. When something is unclear, choose what keeps the look of the approved frames in `review/current/room/` and `review/current/tower/`, and write the decision in `game/NOTES.md`.

## Why this prompt exists

The tower and its rooms are done. What is still missing is everything that makes Hening more than a level list: the two ways to play (**Dupa** and **Tanpa Batas**), records kept per mode, the dream (**Mimpi**) that plays itself when the player sits still, the owner's hidden helper, and the player's own garden of rooms (**Taman Sendiri**). After this prompt every feature of `GAME-DESIGN.md` exists; prompt 05 only polishes.

## Read first (completely, in this order)

1. `docs/GAME-DESIGN.md` — §2, §3, §5, §7.2, §7.6–§7.10, §9.
2. `docs/ART-DIRECTION.md` — §9, §12, §13.3, §13.7, §13.9, §13.10, §13.11, §14, §15.
3. `docs/ARCHITECTURE.md` — §6.2, §7.3, §8, **§9 (the hidden helper; never mention it in UI text, help, hints, settings or any README)**, §10, §13, §14.
4. `game/NOTES.md`, `briefs/01-room-contract.md`, then open the game (`npm run dev`, `?qa=1`) and play: courtyard → gate → floor → room → results → pause → Batu Catatan → Kolam.

## Hard rules

- Do not modify `reference/`, `docs/`, `original/`, `game/src/core/` (rules and solver: if you need a change, write it in NOTES as a request and work around it).
- Reuse, do not fork: router, stores, HUD, veils, pastel shader, moods, wanderer, decor, fx, audio, island builder. A new screen is a new module built from the same kit.
- Zero raster; no new fonts; Indonesian copy exactly as written here and in `GAME-DESIGN.md` (lower case where it is lower case, no exclamation marks).
- Input is never blocked by an animation; every overlay and cut-scene can be skipped or closed.
- Humanized code. No git commits.

## Sharing the code with 04

04 (themes) runs at the same time. To keep the two apart:

| Owned by 03 | Owned by 04 | Neither changes the other's files |
|---|---|---|
| `screens/room.js` (HUD, input, modes, timer, results hand-off), `screens/results.js`, `screens/records.js`, `screens/settings.js`, `screens/courtyard.js`, new `screens/gate-choice.js`, `screens/dream.js`, `screens/garden*.js`, `state/*`, `dev/solution-view.js`, `dev/qa.js` | `src/themes/**`, the object/target construction inside `world/room-world.js`, new `render/instances.js` | The handle `room.js` uses for an object (`world.objects[i]`: `group.position`, `setLit(on)`, `nudge(…)`) stays exactly as it is now — 04 keeps that interface while changing what is behind it |

`game/NOTES.md`: write only your own sections (*Modes*, *Mimpi*, *Helper*, *Garden*, *03 critique*).

## [LOGIC] 1. Modes, timer and records

- **Mode choice at the Gerbang Menara** (`GAME-DESIGN.md` §5): using the gate opens a choice of two before the elevator. The last choice is pre-selected; Kolam's *Mode awal* is the first default. ← / → or tap to choose, Enter to ride, Esc to stay in the courtyard. The mode holds until the player returns to the courtyard.
- **Dupa timer:** one stick per room, `dupaMinutes` long (10 / 20 / 30, default 20). It starts when the arrival ends (the first move or the skip), burns through undo and restart, **stops** in pause, during the results and while the helper is open (§5). Restart lights a fresh stick. Time out: input to the board stops, "dupa telah padam" with **ulangi** (fresh stick, room from the start) and **kembali ke menara**. Nothing is lost.
- **Records per mode** in `hening.progress.v1` exactly as `ARCHITECTURE.md` §8: `solved[room].dupa = { steps, pushes, timeMs }`, `solved[room].bebas = { steps, pushes }`. Moves, pushes and time are best-of independently. Either mode unlocks the next room. Migrate a 02-era progress object (records without a mode) to `bebas` and keep the old one as `hening.progress.v1.bak`.
- **Kolam:** add *Mode awal* (Dupa / Tanpa Batas) and *Panjang dupa* (10 / 20 / 30 menit), same row style as 02.
- **Results** (`GAME-DESIGN.md` §7.6): in Dupa the stats line becomes `128 langkah · 41 dorongan · 12:40`; `rekor baru` compares against the current mode's record only.
- **Batu Catatan:** the *Dupa* tab works: the same ten rows per floor plus the time (`ruang 14 · 212 langkah · 61 dorongan · 14:05`). Tab / ↑ ↓ switches mode, ← → floors.

## [ART] 2. The incense stick, the gate choice, the time-out

- **Stick:** exactly `ART-DIRECTION.md` §13.7 — vertical line 2 px × 120 px in `ink` 60 %, the glowing tip with halo, the drifting smoke curl (SVG, 8 s loop), ash flakes at 25 / 50 / 75 %, Cormorant numerals under it, the 1 Hz ember pulse in the last 60 s. Placed in the HUD's top-right column under the tool buttons on desktop, beside the counters on a phone. Not shown in Tanpa Batas. **No red, no shaking, no ticking.**
- **Gate choice:** a veiled card in front of the gate in the courtyard's mood. Title "jalan ke atas", two choices side by side, each a small drawing in thin `ink` lines above its label: a standing incense stick with a curl of smoke for **dupa** (sub-line `20 menit` from settings), an open ensō circle for **tanpa batas** (sub-line `tanpa waktu`). The selected one is filled white with the 2.4 s breathing of the pause menu. Card fade 0.3 s.
- **Time-out:** the ember goes dark, the smoke rises and thins over 2 s, a soft low bell (the floor bell an octave down, quieter), then the veil with "dupa telah padam" and the two choices. The wanderer sits down while it fades.

## [LOGIC] + [ART] 3. Mimpi — `screens/dream.js`

`GAME-DESIGN.md` §7.7, `ART-DIRECTION.md` §13.9.

- **When:** 20 s without input in the courtyard (no walking, no keys, no taps; a card being open counts as input). Never on other screens.
- **Which room:** the room the player last played if it has a solution, otherwise the highest solved room, otherwise room 1. Solutions come from `solutions.generated.json`, then `solutions.manual.json` (both exist for all 50 rooms now; read them through one small `data/solutions.js` so the helper uses the same source).
- **How:** cross-fade (1.2 s) from the courtyard into that room in its own mood, the room already arrived (no gate script), and the **dream wanderer** performing the solution at 4 steps per second: every material at opacity 0.45, colour mixed 50 % toward `#d8d4ff`, `depthWrite false`, one mote per step left behind. Objects push and light as in play, with notes at half volume. A CSS vignette to the mood veil, the caption `mimpi` in Jost uppercase top centre. No HUD, no counters.
- **End:** any input wakes the player (0.8 s fade) in the courtyard where they stood. When the solution ends: the bow, 3 s of stillness, a slow fade back to the courtyard; the idle clock restarts.
- The dream never changes progress or records.

## [LOGIC] + [ART] 4. The hidden helper — `dev/solution-view.js`

Exactly `ARCHITECTURE.md` §9: Ctrl + Alt + C (matching `event.code`) in a room or a garden room; freezes the attempt (state, history, timer) and dims the HUD; replays the room from its start with the dream wanderer of 3; the veiled strip `‹ langkah 41 / 128 ›` with ▶ / ❚❚; → ← Space Home Esc; on close the attempt comes back exactly, timer included; solving after opening it records the room in `assisted`, opens the next room, sets no record. Garden rooms and any room without a stored solution start the solver Web Worker (`core/solver/worker.js`, unchanged) as §9.3 describes, and cache a found solution with the slot.

Ships in the normal build. No UI text anywhere mentions it; its only comment says what it is.

## [LOGIC] + [ART] 5. Taman Sendiri — `screens/garden.js`, `screens/garden-editor.js`

`GAME-DESIGN.md` §7.8, `ART-DIRECTION.md` §13.10. Opened from the Paviliun Taman (replaces 02's "sedang disiapkan" card).

**Slot list.** A veiled scroll in Siang under the pavilion roof: title "Taman Sendiri", 50 small stone plaques in a 5 × 10 grid (one column of 10 on a phone, scrolling). Each plaque: `taman 07`, then `kosong`, `belum lengkap`, `siap` or `teruji`, and the slot's best record if any. ↑ ↓ ← → / tap to choose; Enter opens a menu on the plaque: **ubah** (edit), **main** (play; only when `siap` or `teruji`), **salin ke…** (copy to an empty slot), **kosongkan** (empty, asks once: "kosongkan taman 07? · ya · tidak"). Esc back to the courtyard.

**Editor.** Mood Siang, the play camera with a 1 px grid on the floor plane (`ink` 12 %), Q / E rotate as in rooms.

| Input | Does |
|---|---|
| ← ↑ → ↓ | move the cursor tile (a lit hover tile, as in rooms) |
| 1–6 or the palette | tool: **lantai**, **dinding**, **objek**, **target**, **awal**, **hapus** |
| Space / tap / drag | apply the tool to the tile (drag paints lantai, dinding, hapus) |
| Z | undo the last edit (whole drag = one edit) |
| Enter | **coba** (try) |
| Esc | back to the slot list (saves) |

- Board up to 19 × 16 cells. The palette: glass buttons on the left (bottom on a phone), selected = filled white. An object placed on a target makes "object on target"; *awal* moves the single start.
- Placing pops in (scale 0 → 1, `easeOutBack` 0.25 s) with a soft wooden tick; removing shrinks (0.15 s). The plinth regenerates live, debounced 200 ms. Painted inner walls become ponds and basins by the room rules (shared decor code, seeded by the slot number).
- **Rules line** under the board, one at a time, in this order: `belum ada titik awal`, `titik awal belum dikelilingi dinding`, `jumlah objek dan target belum sama` (with the counts `· 4 objek · 5 target`), `belum ada objek`. None → `siap dicoba`. Check with `core/level.js` `validateLevel`.
- **Coba:** plays the slot as a normal room (no gate script, Tanpa Batas, HUD place line `TAMAN 07`); Esc or the results' **kembali** returns to the editor exactly as it was (cursor, tool, camera, undo history). Solving it marks the slot `teruji`.
- **Main** from the slot list: plays like a room with its own record in the slot (`hening.garden.v1`, `ARCHITECTURE.md` §8). Results: **ulangi** / **kembali ke taman**.
- Storage: every edit saved (debounced 500 ms); with storage disabled the garden works and forgets on reload.

## [LOGIC] 6. QA hooks and checks

- `dev/qa.js`: `screen('garden')`, `screen('dream', { room })`, `mode('dupa'|'bebas')`, `dupaLeft(ms)` (set the remaining time), `garden(json)` (load a garden object), `idle()` (start Mimpi now), `helper()` (open the helper).
- **Tests** (`tests/`): mode records best-of per field; migration of a 02 progress object; Dupa clock (start, pause stops it, restart refreshes, undo does not refund); `assisted` sets no record but opens the next room; editor validation messages in the order above; garden store round trip and the storage-disabled path.
- **`tools/flow.mjs`**, add to 02's flow (all of 02's steps must still pass):
  1. gate → choice → **dupa** → room 1 → `dupaLeft(3000)` → wait → "dupa telah padam" → ulangi → fresh stick → `arrange()` → results show the time → Batu Catatan Dupa tab shows it.
  2. gate → **tanpa batas** → room 2 → helper opens, steps forward 5, closes → the attempt is unchanged → `arrange()` → results without `rekor baru` → `assisted` holds room 2, room 3 open.
  3. courtyard, 20 s idle → Mimpi plays → a key wakes the player in the courtyard at the same tile.
  4. Paviliun → slot 1 → paint a small solvable room (script the clicks) → rules line reaches `siap dicoba` → coba → solve by script → back in the editor exactly → slot shows `teruji` → reload → still there.
  5. Steps 1 and 4 with storage disabled: no errors, forgotten on reload.
- **Perf** (`tools/perf.mjs`): add the editor with a full 19 × 16 board and Mimpi in room 10. Budgets `ARCHITECTURE.md` §14 (draw calls in rooms are 04's job; report the numbers anyway).
- `npm test` passes; `npm run build` makes a `hening.html` that opens from disk with all of this working.

## [ART] 7. Critique — at least 3 rounds

Render at 1440 × 900 (and 390 × 844 for the stick, the gate choice, the slot list and the editor). Per round compare against `review/current/room/`, `review/current/tower/` and `ART-DIRECTION.md`: same palette per mood, same type and veils, nothing flat or default-looking, the stick calm, the dream unmistakably a dream but still readable, the editor as beautiful as a room. Write the 5 biggest gaps per round in `game/NOTES.md` → *03 critique*, fix, re-render.

Keep the latest frames with `saveCurrent` in `review/current/modes/`: `gate-choice`, `dupa-stick`, `dupa-last-minute`, `dupa-padam`, `results-dupa`, `records-dupa`, `settings-modes`, `mimpi`, `helper`, `garden-slots`, `garden-editor`, `garden-editor-rules`, `garden-play`, `phone-dupa`, `phone-editor`.

## Done when

- Every flow step of 6 passes, with and without storage, and 02's flow still passes.
- 3 critique rounds documented.
- Perf numbers reported; the editor and Mimpi within the frame budget.
- `node tools/review.mjs audit` prints nothing; `.scratch/` emptied.

## Deliverable — then STOP

1. `review/prompts/03-modes-garden/sheet.jpg`, twelve cells: `gerbang · pilih jalan`, `dupa · menyala`, `dupa · menit terakhir`, `dupa telah padam`, `selesai · dupa`, `batu catatan · dupa`, `mimpi`, `penunjuk` (the helper), `taman sendiri · daftar`, `taman sendiri · menyunting`, `taman sendiri · coba`, `ponsel · menyunting`.
2. `review/prompts/03-modes-garden/summary.md`: modules added, storage schema as implemented (with the migration), the flow steps with pass/fail, test counts, perf numbers, the critique notes per round, build size, audit result, anything the core needed (requests).
3. `node tools/review.mjs gallery`.

Then stop. Do not start prompt 05.

## Pembagian kerja (Claude Code, 2026-11-02)

Runs at the same time as 04. The model policy is in `prompts/CLAUDE-CODE.md`.

| Who | Does in 03 |
|---|---|
| **Flash** (agy, `-Scope logic`) | [LOGIC] 1 and 6 in full; the logic of 3, 4 and 5 (idle clock, room choice, solution playback, wake, the helper's freeze/replay/restore and `assisted`, slot store, editor state, undo, validation order, coba/main hand-off). Every [ART] item (stick, gate card, time-out, the dream look, the helper strip's look, the slot scroll, plaques, editor grid and palette, pop-in) is a labelled blockout. |
| **Argon** (agy, `-Scope art`) | [ART] 2, the art of 3–5, critique 7 — tried once at the ART step. Argon was out; Kimi started it and hit its 5-hour quota at 21:17; **owner's decision (2026-11-02): Flash finishes it** (`run-agy.ps1 -Model gemini-3.8-flash-high -Scope art`), reviewed by Opus. |
| **Kimi**, then **Sonnet** | Backup [LOGIC] if the Flash run fails once (quota, stall, or rejected in review): Kimi first, Sonnet if Kimi fails too. |
| **Haiku** (`qa-scout`) | Starts the run, reads the `.done` file and the log; after ART: `review.mjs` sheet, audit, gallery. |
| **Opus** | This split, the review, every visual decision, merging the notes, the report. |

**Rules for running beside 04** (they add to *Sharing the code with 04*):

- Notes: write your sections in **`game/NOTES-03.md`**, not `game/NOTES.md`. Claude Code merges them after review.
- You own `tools/flow.mjs` and `tools/perf.mjs`; 04 does not edit them. Build to `dist/` as usual.
- `render/*` belongs to 04 during this run (it adds per-instance attributes to the pastel shader). Change nothing in `render/`; the dream look is [ART] and comes later.
- `world/room-world.js`: 04 rebuilds its object and target construction. If you need a change there or in another 04 file, write it as a request in `NOTES-03.md` and work around it.
- Do not edit `package.json` (no new dependencies) or any test file you did not create. Do not touch `src/data/*.json`.
- `.scratch/`: delete only the folders your own tools created; never delete `.scratch/` itself.

**Rules for the ART step** (added 2026-11-02 after the [LOGIC] review; it runs beside `04-themes-fix-1.md`):

- Build the look exactly as `ART-DIRECTION.md` specifies (§9, §12, §13.3, §13.7, §13.9, §13.10, §13.11, §14, §15) and section 2 of this prompt. The *Left for ART* list in the summary suggests extras the spec does not have (chromatic aberration, parchment textures, fraying, a Buddha silhouette, sampled bells); ignore those. Zero raster still holds: no image or audio files.
- The fix run owns `src/render/*`, `src/world/*`, `src/themes/*`, `tools/regress.mjs`, `tools/themes-check.mjs`. Do not edit them. The dream look is done inside `screens/dream.js` (material clones / uniforms already on the pastel material), not by changing the shader.
- Notes stay in `game/NOTES-03.md` (*03 critique*). Frames go to `review/current/modes/`, the sheet to `review/prompts/03-modes-garden/sheet.jpg` as section *Deliverable* lists.

**Flash finishing the ART (2026-11-02, owner's decision):** Kimi began this [ART] and was stopped by its quota at 21:17. It had worked on the gate choice, the dupa stick (`ui/hud.*`), the time-out (`screens/room.js`), the slot list and the editor; `screens/dream.js` and `dev/solution-view.js` were being edited when it stopped and may be unfinished. Start by listing every remaining `// ART: blockout` marker and checking what is already built against the spec; keep what meets it, finish the rest. This step now runs beside **04's [ART]**, which owns `src/themes/*`, `src/render/*`, `src/world/*`, `tools/regress.mjs`, `tools/themes-check.mjs`. The critique rounds are real: render the frames and look at them; the [LOGIC] run's rounds were about blockouts and do not count.
