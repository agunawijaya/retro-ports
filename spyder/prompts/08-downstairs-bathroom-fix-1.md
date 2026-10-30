# Prompt 08 — fix 1: the mirror gives its secret away too early [ART]

Small, art-only fix in `game/rooms/downstairs-bathroom/art.js`. Runs **before** 10 and 11 (it is quick).

## The defect

In the `dirty`, `drain` and `action` frames the words **"THOMAS WAS HERE" are clearly readable through the fog**. The reveal is the room's story beat; it must land in the makeover, not before.

## Make it so

- **Dirty:** the fog is dense. Only the faintest hint that something was once written there survives — a few broken streaks where a finger wiped, with water droplets running down from them. Nobody should be able to read a word or recognise the smiley at 1920 × 1080. Lower the trace alpha to about a quarter of today's and break the strokes up with fog noise and droplets.
- **Makeover `mirror` beat:** unchanged — the fog clears from the centre outward and the letters appear on the clear glass, fully readable in `clean`.
- Change nothing else in the room.

## Deliverable — then STOP

1. `saveHero(page, 'downstairs-bathroom', …)` for `dirty`, `drain`, `action`, `clean`.
2. `makeSheet('08-downstairs-bathroom-fix-1', …)`: dirty, a 2× crop of the dirty mirror, action, clean.
3. `writeSummary('08-downstairs-bathroom-fix-1', …)`: what changed, no console errors, `audit` clean.
4. `node review.mjs gallery`. Then stop.
