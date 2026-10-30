# 08-downstairs-bathroom-fix-1: the dirty mirror

*Who did what: Gemini 4 Argon was refused on quota (429, after 0.1 min). As the queue allows for this art-only fix, **Claude Code (Opus)** made it.*

## What changed

Only the fog canvas in `mirrorParts()` in `game/rooms/downstairs-bathroom/art.js`.

- **Before:** the whole of "THOMAS / WAS HERE" and the smiley were cut out of the fog at 0.3 alpha, so they could be read through it in `dirty`, `drain` and `action`.
- **Now:**
  - The letters are first drawn on their own canvas, and then cut down by a mask of 22 short, roughly horizontal smears. What survives is a few broken bits of stroke, not a letter.
  - Those bits are taken out of the fog at 0.12 alpha, against 0.3 before. Since only fragments survive the mask, the wiped area is a small fraction of what it was.
  - Eight water runs start on the surviving bits (sampled from the masked canvas, so each starts on a streak) and run 16–44 px down, each ending in a bead.
- **Unchanged:**
  - the `mirror` beat, the trace canvas and the clear-glass reveal, so the letters appear on the glass and can be read in full in `clean`;
  - the rest of the room.

## Checks

- At 1920 × 1080 no word can be read and the smiley cannot be recognised, in `dirty`, `drain` or `action`. The sheet's second cell is a 2× crop of the dirty mirror.
- `clean` shows "THOMAS / WAS HERE" and the smiley in full, as before.
- No console errors (`shoot.mjs --hero --room=downstairs-bathroom`: no page errors).
- `node review.mjs audit`: clean.

**Claude Code review:** approved. Up close, the dirty mirror shows dense fog, droplets and a few faint smears with runs below them, and nothing can be read. "Thomas was here" now appears only when the makeover clears the glass.
