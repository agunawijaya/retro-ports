# Brief 14-fix — the `mirror` QA state's string spider (for `engineer`)

This is a small fix found by Opus while reviewing room 14 (`prompts/14-upstairs-bathroom.md`).

## Pembagian kerja

- **engineer:** this fix only.
- **Opus:** the review.
- **Agy:** not needed for this.

## The defect

In `game/rooms/upstairs-bathroom/room.js`, the QA state `mirror` spawns a string spider (`api.spawn('string', { x: 860, targetY: 420, hover: true })`), marked `mirrorOnly`, so it is drawn only in the mirror pass.

In the rendered state, its legs run as long straight lines up to the top of the glass, as if its feet were still where it spawned. The real spider hangs at y ≈ 420, so its legs should be short and splayed round its body, as they are for the crawler in the same frame.

The Kid's Bedroom had the same thing, fixed with `rig.plantAll()` after the spider was placed. See `game/rooms/kids-bedroom/room.js`, QA state `shadows`. Check whether that is the cause here too, or whether a hovering string spider needs a step of `rig.update` or its own staging call. Read `game/lib/spiders.js` (the string spider) and `game/lib/spider-rig.js` (`plantAll`, `updateDangling`).

## Do

- Fix it inside `game/rooms/upstairs-bathroom/room.js`, in the `mirror` QA state only.
- Change nothing else: not the art, not `game/lib/`, not other rooms.
- Another Gemini session is editing `game/lib/` right now, so stay out of it.

## Done when

- A render of the state shows the spider in the mirror with normal legs.
  - Use `game/tools/` with a small Playwright script: `openQa(page, gameUrl('qa=1&room=upstairs-bathroom'))`, then `__spyder.setup('mirror')`, wait 750 ms, and take a screenshot.
  - Write the image to `E:\Projects\retro-ports\spyder\.scratch\` only, and delete it afterwards.
- There are no console errors.

Report the change (file and lines) and what you saw in the render.
