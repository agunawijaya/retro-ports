# Prompt 05 — Polish and final acceptance (the last prompt)

You are finishing the Hening web game in `E:\Projects\retro-ports\sokoban\game`. **Runs alone, after 04b is approved. It is the last prompt.** Nothing new is designed here: every feature exists. This prompt makes the whole game hold together on every screen, every device size, every theme and every mood, proves it with one full playthrough, and leaves a build the owner can keep. When something is unclear, choose what keeps the approved frames in `review/current/` and write the decision in `game/NOTES.md`.

## Read first (completely, in this order)

1. `docs/ART-DIRECTION.md` — all of it, with **§9 (motion), §12 (type and HUD), §14 (never), §15 (acceptance checklist)** in mind.
2. `docs/GAME-DESIGN.md` — all of it (every Indonesian string in it is the reference copy).
3. `docs/ARCHITECTURE.md` — §8, §9, §11, §12, §13, §14.
4. `game/NOTES.md`, the summaries in `review/prompts/` (01, 02, 03, 04, 04b), and the frames in `review/current/`.

## Hard rules

- Do not modify `reference/`, `docs/`, `original/`. `game/src/core/` only for a proven bug, with a test and a NOTES entry.
- No new features, screens or settings. A fix may touch any module; it must not change a screen's flow.
- Everything that passes today must still pass: `tools/flow.mjs`, `tools/themes-check.mjs`, `tools/rooms-check.mjs`, `npm test`.
- The hidden helper (`ARCHITECTURE.md` §9) must not be mentioned in any UI string, hint, help text, setting or README. Check it (6).
- Zero raster; no new fonts. Humanized code. No git commits.

## [ART] 1. The stones — three refinements from the architect's review of 04b

04b is approved; at the title and the floors the stack still reads a little like a **tiered cake**: the rims are walled by back stones and lanterns, the stones' edges look cut rather than worn, and the lean is too small to see. Change only these numbers, in `world/stone-layout.js` and the [ART] built on it, then update `tests/stones.test.js`:

| | From | To | Why |
|---|---|---|---|
| Opening radius | 1.2 | **1.45** on floors I–IV, **1.3** on Lantai V | room for a visible lean |
| Balance offset | 0.22 | **0.42** on floors I–IV, **0.3** on Lantai V, still from the axis, still turning 36° per floor | the stack must visibly lean this way and that (clearance 1.03 and 1.0 > 0.8 + 0.05 + breathing) |
| Rim rounding | quarter-ellipse 0.25 out × 0.35 down | **0.45 out × 0.5 down**, and the underside's dome 0.15 deeper | a worn river stone, not a plate; the silhouette from the side must be a lens, not a disc |
| Niche back stone | 24° of arc, h 0.45, at `R − 1.35` | **14° of arc, h 0.3**, at `R − 1.3`; the theme object moves to `R − 0.9` | the rim reads open; sky and the next stone show between niches; on Lantai V the back stone (1.5) clears the opening (1.3) and sits just behind the object's foot |

Keep the radii, heights, pitch and everything else of §13.2. Re-check Lantai V (R 2.8): object, back stone and opening must not crowd. Re-render `review/current/tower/` and judge the title against the question: *river stones balanced in the sky, or a cake?*

## [ART] + [LOGIC] 2. Reduced motion, everywhere

*Gerak halus* (on / off / ikut sistem) must hold on every screen, per `ART-DIRECTION.md` §9: no camera glides (cuts with a 0.3 s veil instead), no breathing stones, no stone settling, no cloud drift or star twinkle, crows perch only, koi still, the wanderer's steps without bob, no petals or motes, Mimpi's trail off, the incense smoke still (the stick still shortens). Sound unchanged. Add a check to `tools/flow.mjs`: with reduced motion forced on, two consecutive frames of the courtyard, a floor and room 6 differ by less than a small pixel threshold when nothing is pressed.

## [ART] + [LOGIC] 3. Phones and small windows

Every screen at **390 × 844**, **844 × 390** (landscape phone) and **768 × 1024**, DPR 2–3:

- The canvas fills the screen (`100dvh`, safe-area insets respected); nothing overlaps; tools sit at the bottom on portrait (§12.2); captions and veiled cards stay inside the screen and legible (≥ 13 px for the smallest Jost line).
- Touch works everywhere: tap-to-walk and tap-to-push in rooms, courtyard taps on places, floor taps on niches, gate choice, pause, records tabs (swipe or tap), Kolam sliders (drag the pebble), the slot list (scroll), the editor (tap and drag to paint, two-finger rotate is **not** required — the rotate button is enough), the helper strip.
- No double-tap zoom, no text selection on long-press, no pull-to-refresh inside the game.

## [LOGIC] 4. Performance, memory, load

`ARCHITECTURE.md` §14, measured on the owner's laptop GPU (as in 02/04b) and reported per screen:

- Frame time ≤ 8 ms and draw calls ≤ 150 on: title, courtyard, ride, floors I and V, rooms 6 and 10 in all five themes, Mimpi, the editor, the ending.
- **Memory:** 20 room changes and 5 floor/courtyard round trips: geometry, texture and program counts (`renderer.info`) return to their baseline; JS heap does not grow by more than 10 % after a GC. Fix every leak found.
- **Load:** `dist/hening.html` opened from disk is interactive (title responding to a tap) in ≤ 1.5 s; size ≤ 3 MB.

## [ART] 5. Sound balance

Listen to every theme in rooms 6 and 10, the courtyard, the ride, the floors, Mimpi and the ending. No clipping on the master (add a gentle limiter if needed); the five instruments sit at the same perceived loudness (match them by RMS of a one-octave run); lighting notes clearly above the ambience at default volumes (80 / 60 / 80); M mutes instantly everywhere; audio starts only after the first gesture, and resumes after the tab returns from the background.

## [LOGIC] 6. Copy, text and the secret

- Every player-facing string compared against `GAME-DESIGN.md` and the prompts: Indonesian, lower case where specified, no exclamation marks, no English left in the UI. List the strings in `game/NOTES.md` → *Copy* (one table: screen, string).
- `grep` the build output, `game/README*`, `src/` UI strings and every settings label: nothing mentions the helper, Ctrl + Alt + C, a solution viewer or "cheat". Its only trace is the one comment in `dev/solution-view.js`.
- `game/README.md` for the owner: how to run (`npm run dev`), build, open `dist/hening.html` offline; what is git-ignored and why (`ARCHITECTURE.md` §12). No mention of the helper.

## [LOGIC] 7. The full playthrough — `tools/playthrough.mjs`

The proof that the game is whole. With fresh storage, in the built `dist/hening.html` opened from disk (Playwright, `file://`, `?qa=1` only for `solve()` and the network check):

1. Title → courtyard → gate → **tanpa batas** → floor I.
2. For rooms **1 to 50 in order**: enter from the floor niche, `solve()` (plays the stored solution through the real game input path, at full speed), results, **ruang berikutnya** — riding the elevator after rooms 10, 20, 30, 40, and **naik** after 50.
3. The ending plays to the courtyard.
4. Then: Batu Catatan shows 50 records whose moves and pushes equal the stored solutions'; every floor's rim is lit on the title; reload keeps it all.
5. Repeat rooms 1–3 in **dupa** with the stick running; records appear in the Dupa tab.
6. During the whole run: **zero network requests** after load (log every request), zero console errors, and the frame budget held (report the worst frame).

Report per room: solved (yes/no), moves, pushes, the time `solve()` took. A room whose stored solution fails in the real game is a defect to fix (in the game, or by re-verifying the solution) — not to skip.

## [ART] 8. Final acceptance — `ART-DIRECTION.md` §15

Go through **every** item of §15 (and the per-screen checks of §13) and prove each with a frame or a check result. Write the table in the summary: item, how it was checked, evidence (frame name or check), pass/fail. Fix what fails; an item may stay open only with the owner-facing reason.

Then a last critique round over the whole game (one round is enough here, it follows four prompts of them): the five biggest remaining gaps, fixed, written in `game/NOTES.md` → *Final critique*.

Keep the latest frames in `review/current/` (all targets re-rendered once at the end so the gallery shows the finished game), plus `review/current/final/`: `title-new`, `title-complete` (all 50 solved), `room06-<theme>-senja` for all five themes, `phone-room06`, `phone-courtyard`, `landscape-room06`, `ending-pullback`.

## Done when

- The full playthrough passes: 50 of 50 rooms, the ending, records, no network, no errors.
- Every item of §15 passes or is listed with its reason.
- Flow, themes and rooms checks pass; reduced-motion check passes; tests pass.
- Perf, memory and load within budget; build ≤ 3 MB and opens from disk.
- The secret is nowhere in UI, README or settings.
- `node tools/review.mjs audit` prints nothing; `.scratch/` emptied.

## Deliverable — then STOP

1. `review/prompts/05-polish/sheet.jpg`, twelve cells: `judul · batu baru`, `judul · 50 ruang selesai`, `ruang 06 · lentera`, `ruang 06 · cahaya bintang`, `ruang 06 · taman batu`, `ruang 06 · candi`, `ruang 06 · mata air`, `ponsel · ruang 06`, `ponsel · halaman`, `ponsel mendatar · ruang 06`, `akhir · tumpukan batu`, `batu catatan · 50 ruang`.
2. `review/prompts/05-polish/summary.md`: the stones change, reduced-motion results, the phone matrix (screen × size, pass/fail), perf / memory / load tables, the sound balance numbers, the playthrough table (50 rows), the §15 table, the final critique, test counts, build size, audit result.
3. `node tools/review.mjs gallery`.

Then stop. Hening is done.

## Pembagian kerja (Claude Code, 2026-11-03)

Model policy in `prompts/CLAUDE-CODE.md`; Argon is out until about 2026-11-04 22:00, so every [ART] is Opus's. DeepSeek Flash joins as in 04b.

| Who | Does in 05 |
|---|---|
| **Opus** | §1 (the stone numbers in `world/stone-layout.js` and `tests/stones.test.js`, and the stones' geometry in `render/tower.js`); the tower's own reduced motion (breathing, settling); the gains of §5 from Flash's measurements; §8 (the §15 table, the final critique, the final frames); the review. |
| **Flash** (agy, `-Scope logic`) | §2 (reduced motion on every screen except `render/tower.js`, and the new flow check), §3 (phones and small windows: viewport, safe areas, touch), §4 (perf, memory, load — measure and fix leaks), §5's measuring tool and limiter (RMS of a one-octave run per instrument, a proposed gain per instrument — Opus sets the final gains). |
| **DeepSeek Flash** (OpenCode) | `prompts/05-copy-playthrough.md`: §6 (copy table, the secret check, `game/README.md`) and §7 (`tools/playthrough.mjs`), run on its own build. String fixes are listed, not applied. |
| **Haiku** (`qa-scout`) | Starts the runs, reads the done markers; the final checks, the sheet, the gallery. |
| **Sonnet** (`engineer`) | Backup [LOGIC] if a Flash run fails (after Kimi, by the policy); applies the listed copy fixes and any playthrough fix after Flash's run, if they are small. |

**Rules for running in parallel:**

- Opus owns `src/world/stone-layout.js`, `tests/stones.test.js`, `src/render/tower.js`, `src/world/tower-views.js` during this run. Flash and DeepSeek do not edit them; a change they need there goes into their notes as a request.
- DeepSeek owns `tools/playthrough.mjs` and `game/README.md`; it builds into `.scratch/05ds-dist/` (never `dist/`) and edits no other source.
- Notes: Flash writes `game/NOTES-05.md`, DeepSeek `game/NOTES-05-ds.md`; Opus merges them into `game/NOTES.md`. Scratch folders: `.scratch/05-*` (Flash), `.scratch/05ds-*` (DeepSeek); delete only your own.
- No one writes frames into `review/current/` except Opus at §8.
