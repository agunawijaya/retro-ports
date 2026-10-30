# Prompt 05 — fix 1 (Family Room: painting quality, plus one shell layout bug)

You are working on the Spyder web game in `E:\Projects\retro-ports\spyder`. Prompt 05 built the Family Room, and it plays correctly. Its review sheet, `review/prompts/05-family-room/sheet.jpg`, shows that the **painting** is below the quality bar of `reference/screens/` and of the Living Room and Kitchen in `review/current/`. Fix only what is listed here.

**Rules.**
- Same as prompt 05.
- Edit only `game/rooms/family-room/`, plus `game/css/hud.css` for item 5 and nothing else in that file.
- No per-frame blur. Palette only. Images only through `review.mjs` or `.scratch/`; `node review.mjs audit` must be clean at the end.
- No git commits.

## Defects: what the sheet shows, and what fixed looks like

1. **The wall and floor read as flat planes.**
   - *Seen:* the upper wallpaper is an almost uniform grey-beige field. The floor is a dark band with no visible parquet.
   - *Fixed:*
     - The stripes are visible at alpha 0.2–0.3 over `paintShape` brush texture.
     - The panelling planks have grain strokes and a lit edge.
     - The floor shows wide parquet boards in the reference's one-point perspective: seams, a tone per board, dust.
     - Put it side by side with the Living Room floor and wainscot; it should hold up.
2. **The rug is a flat orange shape.**
   - *Seen:* it is flat in the dirty state and a flat saturated orange in the clean state.
   - *Fixed:*
     - A shaggy pile, made of many short pile strokes, with a fringe at both ends and a faint low-contrast pattern.
     - Its colour is mixed from `rust` and `taupe`. It is muted in both states; only light makes it warmer.
3. **The fire is spiky yellow triangles.**
   - *Seen:* the flames in the makeover and clean frames are hard-edged triangles.
   - *Fixed:*
     - Layered, soft flame tongues with gradients: an `ember` core, then `amber`, then transparent.
     - Each tongue sways and flickers on its own, sparks rise, the logs glow underneath, and the glow lights the hearth and the rug.
     - No hard polygon edges.
4. **The dirty frame is too dark to read.**
   - *Seen:* most of the room is lost in shadow, and the blinds' striped moonlight stops on the wall.
   - *Fixed:*
     - The stripes fall across the wall, the floor and the armchair (the prompt calls them "the signature look").
     - The TV's static throws a cold flicker onto the floor in front of it.
     - Every piece of furniture can be identified: armchair, fireplace, TV, bookshelf.
     - Ambient light is no darker than ART-DIRECTION §3 allows.
5. **Shell bug: the results card buttons wrap.**
   - *Seen:* when "Next room →" is shown, "Play again R" breaks onto two lines and the row looks cramped.
   - *Fixed:* both buttons sit on one line each, at the same height, with readable spacing. Change only the results-card button row in `game/css/hud.css`, and check the results card in every room (porch, living room, family room, kitchen, dining room).

## Deliverable — then STOP

- Re-shoot the Family Room's hero frames with `node shoot.mjs --hero --room=family-room`.
- Make `makeSheet('05-family-room-fix-1', …)` with six cells:
  1. dirty
  2. action
  3. makeover at t ≈ 3.9 s
  4. clean
  5. results
  6. a 2× zoom on the fireplace and rug in the clean state
- Write `writeSummary('05-family-room-fix-1', …)`: what changed for each defect, the check counts (`checks.mjs`, `flowtest.mjs`), the audit result, and perf (mean and p95).
- Rebuild the gallery (`node review.mjs gallery`). Then stop.
