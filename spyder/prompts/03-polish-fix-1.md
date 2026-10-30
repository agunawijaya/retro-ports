# Prompt 03 — fix 1 (four defects seen on the 03-polish review sheet)

You are working on the Spyder web game in `E:\Projects\retro-ports\spyder`. Prompt 03 (polish) is done. Its review sheet, `game/tools/out/review/03-polish.jpg`, shows four things that are still wrong. Fix only these. Do not touch anything else, and do not re-run QA on things this prompt does not touch. Same rules as prompt 03: plain scripts, no per-frame `ctx.filter` blur, seeded randomness, no git commits, and `reference/` stays as it is now.

## 1. The Jumper still does not read as a leap (sheet cell 5)

**What the sheet shows.**
- The Jumper above the table has its legs splayed and looks slightly stretched, but it still reads as a spider on the wall.
- The three ghost silhouettes are so pale and thin against the lit wainscot that they read as a faint cobweb behind it, not as motion.
- The shadow on the table top below is barely visible.
- No predicted-path dots can be seen.

**What fixed looks like.** Someone who has never played the game, looking at the `jumper` hero frame, says "it is jumping".
- The ghosts read as **spider silhouettes**: drawn in the body colour (`spiderBody` / `spiderSheen`), not pale. Their alpha falls off clearly, for example 0.35, 0.22, 0.12, and they are spaced along the arc behind it, so they mark the path it came from.
- A **clearly visible shadow** sits on the table top directly under the Jumper: a soft dark ellipse at about alpha 0.3 at that height, centred on the Jumper's x.
- The **rest of the predicted arc** ahead of the Jumper, down to its landing point, is visible in the hero frame as faint chalk dots.

Re-render only the `jumper` hero frame (`game/rooms/kitchen/screens/jumper.png`).

## 2. A best-score line overflows its room on the map (sheet cell 6)

**What the sheet shows.** The Kitchen's line "best 22,450 · untouched" runs through the Kitchen's right wall into the Dining Room. There it sits beside the Dining Room's "coming soon", so the two read as one line.

**What fixed looks like.**
- Every label, best-score line and note stays inside its own room outline, including long scores with "· untouched". For example, put "untouched" on its own line when the room is too narrow.
- Add a check to `game/tools/checks.mjs` that every room's text bounding box lies inside its room box.

## 3. Hatchlings still come out as a pile (sheet cell 1, panel 3)

**What the sheet shows.** "Split husk + 4 scattering" shows the hatchlings piled on top of each other on the husk. Nothing in the frame shows them scattering.

**What fixed looks like.**
- Retime panel 3 to about 0.5 s after the split.
- By then the four hatchlings have visibly spread apart in different directions: no two overlap by more than about a third of their size, and none stands on the husk.
- If they don't spread like that in play, fix the scatter itself, not only the panel's timing.

## 4. The HUD is dimmed in the Front Porch makeover (sheet cell 3)

**What the sheet shows.** In the porch makeover cell, the score plate, the work order, the nerve gauge and the weapon tag are all faded to about a third, as if a card were open. In the Living Room's makeover cell they are at full strength.

**What fixed looks like.**
- Find out which it is. Either the game leaves the HUD dimmed during the porch makeover (for example a tutorial note, or `has-card`, that is never cleared), or it is a timing artefact of how the cell was captured.
- If it is the game, fix it.
- If it is the capture, re-shoot the cell after the HUD transition has finished.
- Say which it was in the NOTES.

## Deliverable: ONE review sheet — then STOP

Create **one** JPEG, `game/tools/out/review/03-polish-fix-1.jpg`, 1920 px wide, a 2-column grid of 960 × 540 cells, quality about 80, in this order:

1. Kitchen `jumper` hero frame
2. The same frame, zoomed 2× on the Jumper, the table and the hero
3. Egg life-cycle strip, with panel 3 retimed
4. House map with all three rooms cleared and a long Kitchen score with "untouched"
5. Front Porch makeover at t = 1.3 s, with the HUD at full strength
6. The map from cell 4, zoomed 2× on the Kitchen and Dining Room labels

Run `game/tools/checks.mjs` and `game/tools/flowtest.mjs` once at the end, and report the counts. Append a short section **"Prompt 03 — fix 1 (date)"** to `game/NOTES.md`: what changed for each defect, what defect 4 turned out to be, and the check results. Then stop.
