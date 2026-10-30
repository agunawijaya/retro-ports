# Prompt 05 — fix 1: Family Room painting (2026-10-29)

*Done by Claude Code directly: agy rejected every Gemini 4 Argon run (High and Medium) with a quota error, and the owner asked for it to be finished here.*

- **Wall:** the wallpaper now reads as striped paper: a faded-rust band and a cream pinstripe every 46 px, with sun fading at the top and shadow at the rail.
- **Floor:** wide boards in the Living Room's one-point perspective (vanishing point above the room), a tone per board, grain, seams with a lit edge, staggered joints, dust when dirty, and a sheen in front of the hearth.
- **Rug:** a shag of about 3,000 short curled tufts, a faint border band, and a fringe at both ends, mixed from `rust` and `taupe`. It is no longer flat orange; only the fire warms it.
- **Fire:** nine soft tongues, each three stacked gradient layers (amber haze, ember body, pale core) that fade at the tip and sway on their own noise. Also an ember bed and rising sparks. No hard edges, no blur.
- **Dirty frame:** the moonlight through the blinds now lands as nine stripes on the floor and the armchair, sheared and widening toward the viewer, with one stripe missing where a slat hangs crooked. They are drawn straight into the light map, because `shaft()` would blur nine stripes into one patch. The TV's static throws a cold flicker on the floor in front of it.
- **Shell:** on the results card, "Next room →" and "Play again" now each sit on one line (`game/css/hud.css`, results row only).
- **Checks:**
  - `checks.mjs` passes 37/37. Its unlocking checks were rewritten to follow whichever rooms are built; they had expected only three rooms.
  - `flowtest.mjs` passes 53/53. `node review.mjs audit` is clean.
- **Frame time:** `action` mean 3.72 ms, p95 5.00 ms; `makeover` mean 2.07 ms, p95 3.40 ms. The budget is 8 ms.

**Claude Code review:** approved. The wall, floor, rug and fire now hold up next to the Living Room and Kitchen. The stripes are the room's signature look, and the dirty frame is readable.
