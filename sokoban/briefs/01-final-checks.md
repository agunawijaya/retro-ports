# Brief for qa-scout: prompt 01 — final checks and the review sheet

Part of `prompts/01-room.md` (*Done when* and *Deliverable*). The split is in
`briefs/01-room.md`. Game root: `E:\Projects\retro-ports\sokoban\game`.
Opus's scratchpad (`$S`):
`C:\Users\aguna\AppData\Local\Temp\claude\E--Projects-retro-ports-sokoban\b23bb32e-7204-4ddd-8981-c37b1e229f8c\scratchpad`.

## Pembagian kerja

- **qa-scout (you):** run, compose, report. Mechanical only; no source edits.
- **Opus:** owns every decision, the summary, `game/NOTES.md`, the gallery.
- **engineer / Agy:** nothing here.

## Steps

1. `npx vitest run` in `game/`: total and per-file counts. A failure: stop and report.
2. `npm run build`: the size of `dist/hening.html`. Then open it **from disk**
   (`file:///E:/Projects/retro-ports/sokoban/game/dist/hening.html?qa=1&room=6`)
   with Playwright (reuse `launchBrowser`, `collectConsoleErrors`, `waitForHening`
   from `game/tools/lib/harness.mjs`): `hening.start()`, `hening.skipIntro()`,
   `hening.arrange()`, then wait up to 20 s for `hening.inspect().phase === 'results'`.
   Report the phase reached and every console error.
3. **The sheet** (`review/prompts/01-room/sheet.jpg`), with a script you write in
   `$S`, using `makeSheet` from `game/tools/review.mjs` (do not edit `review.mjs`).
   `makeSheet` stretches each image to 960 × 540, so first **letterbox** the
   phone frame: draw `review/current/room/phone-room06.jpg` (390 × 844) scaled
   to fit the height of a 1920 × 1080 canvas, centred, on `#2b2833`, saved as
   JPEG q90 in `.scratch/sheet-01/phone-letterboxed.jpg` (canvas in a headless
   page, no image packages). Cells, in this order, with exactly these labels:

   | # | Label | Image |
   |---|---|---|
   | 1 | `ref · ruang 06 fajar` | `review/reference/room06-fajar.jpg` |
   | 2 | `game · ruang 06 fajar` | `review/current/room/room06-fajar.jpg` |
   | 3 | `ref · ruang 06 malam` | `review/reference/room06-malam.jpg` |
   | 4 | `game · ruang 06 malam` | `review/current/room/room06-malam.jpg` |
   | 5 | `ref · protes` | `review/reference/scrub-protest-up.jpg` |
   | 6 | `game · protes` | `review/current/room/scrub-protest-up.jpg` |
   | 7 | `game · ruang 01 kedatangan` | `review/current/room/room01-arrival.jpg` |
   | 8 | `game · ruang 50` | `review/current/room/room50.jpg` |
   | 9 | `game · air mancur` | `review/current/room/fountain.jpg` |
   | 10 | `game · ponsel ruang 06` | `.scratch/sheet-01/phone-letterboxed.jpg` |

   Confirm the sheet exists; give its pixel size and byte size.
4. Empty `E:\Projects\retro-ports\sokoban\.scratch\` completely (every file and
   folder in it; keep the folder itself).
5. `node tools/review.mjs audit` from `game/`: quote the output exactly (nothing
   printed and exit 0 = clean). Do **not** run `gallery`.

## Report

Test counts; build size; the from-disk result (phase reached, console errors);
the sheet's size; what you deleted; the audit output. Quote command output; a
step you did not run is "not run", never "passed".
