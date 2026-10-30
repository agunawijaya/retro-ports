# Prompt 06 — fix 1 (Dining Room: painting quality and the story object)

You are working on the Spyder web game in `E:\Projects\retro-ports\spyder`. Prompt 06 built the Dining Room, and it plays correctly. Its review sheet, `review/prompts/06-dining-room/sheet.jpg`, shows that the **painting** is below the quality bar of `reference/screens/` and of the Living Room and Kitchen in `review/current/`. Fix only what is listed here.

**Rules.**
- Same as prompt 06.
- Edit only `game/rooms/dining-room/`. **Do not touch `game/css/hud.css`**: a parallel session fixes the results-card buttons.
- No per-frame blur. Palette only. Images only through `review.mjs` or `.scratch/`; `node review.mjs audit` must be clean at the end.
- No git commits.

## Defects: what the sheet shows, and what fixed looks like

1. **The dirty frame is too dark to read.**
   - *Seen:* the table, chairs, sideboard, china cabinet and chandelier are barely visible, and the upper half of the frame is an empty dark wall.
   - *Fixed:*
     - Every piece of furniture can be identified at a glance.
     - The moonlight shaft falls across the table and the floor, with dust in it.
     - The chandelier's crystals catch a little light, and the candlesticks show glints.
     - Ambient light is no darker than ART-DIRECTION §3 allows.
     - Compare with `reference/screens/dirty.jpg`: the room should be as readable.
2. **The clean wall is a flat, saturated green.**
   - *Seen:* the damask barely shows.
   - *Fixed:*
     - A muted wall mixed from `moss` and `taupe`, with the damask pattern visible at alpha 0.2–0.35 over `paintShape` brush texture.
     - Warmth comes from the chandelier and candle light, not from the paint (ART-DIRECTION §3: saturation only from light).
3. **The furniture is flat shapes.**
   - *Seen:* the tablecloth, chairs, plates on the rail and the sideboard read as flat fills.
   - *Fixed:*
     - Each is painted with `paintShape`: a light-to-shadow gradient, brush strokes, inner shadow, and a rim light toward the main light.
     - Contact shadows under the table, chairs and sideboard.
     - Chair backs with carved detail.
     - Plates with rims and a highlight.
     - Folds in the tablecloth.
4. **The empty wall above the plate rail.**
   - *Fixed:* at least five wall details are visible in the frame (ART-DIRECTION §5), and the upper wall no longer reads as an empty field in either state.
5. **The story object can't be read.**
   - *Seen:* the place cards are not legible in the clean frame, and the candles lighting from left to right cannot be made out in the makeover cell.
   - *Fixed:*
     - In the clean hero frame, the place cards are readable, and the "A." card in front of the one chair that was never pulled out stands out. Light on it, or the composition, makes it noticed.
     - In the makeover frame at t ≈ 3.9 s, the candles visibly light from left to right, some lit and some not yet.

## Deliverable — then STOP

- Re-shoot the Dining Room's hero frames with `node shoot.mjs --hero --room=dining-room`.
- Make `makeSheet('06-dining-room-fix-1', …)` with six cells:
  1. dirty
  2. nest
  3. makeover at t ≈ 3.9 s
  4. clean
  5. results
  6. a 2× zoom on the place cards and the "A." chair in the clean state
- Write `writeSummary('06-dining-room-fix-1', …)`: what changed for each defect, the check counts (`checks.mjs`, `flowtest.mjs`), the audit result, and perf (mean and p95).
- Rebuild the gallery (`node review.mjs gallery`). Then stop.
