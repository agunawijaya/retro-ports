# Brief 12-fix-3 — two QA states, and the hovering string spider (for `engineer`)

These are found by Opus in review. All three are mechanical staging fixes. Opus will edit `drawBreakables`/`drawPickups` in `game/lib/room-runtime.js` **after** you are done, so do not touch those two functions, and finish before Opus starts.

## Pembagian kerja

- **engineer:** items 1–3.
- **Opus:** the review, and the box and pickup art afterwards.
- **Agy:** not needed.

## The defects

1. **`nest-foamed`** (`room-runtime.js`, the QA `case 'nest-foamed'`).
   - It calls `fireWeapon()` once, then `step(0.15)`. The Foam Spray only emits while fire is held, so it puts out at most one blob, and the sheet cell "the Dining Room nest being foamed" shows no foam at all.
   - Make the state hold fire through its step, e.g. call `fireWeapon()` before each sub-step, or set the held-fire input for the duration. The hero's spray should then have put out a visible stream of blobs, some stuck where they landed on the eggs or nest under the table and some in the air.
   - The tank must still read below full afterwards. Keep `aimAt` pointed at the eggs.
2. **`sonic-pulse`** (`case 'sonic-pulse'`, used in `?room=upstairs-hallway`).
   - The hero ends up below the floor: drawn at the bottom edge of the screen, cut off.
   - Place the hero standing on the Hallway's floor (`GROUND` 935), in open floor away from the stairwell. Fire the pulse from there, so the ring is seen mid-expansion around him.
3. **`hover: true` string spiders** (`game/lib/spider-types/string.js`).
   - The `hover` option sets `rig.y` to `targetY` without replanting the rig's feet, so a QA state that spawns a hovering spider and never steps leaves its legs stretched to the ceiling.
   - Today's instance was patched in `rooms/upstairs-bathroom/room.js` (`rig.plantAll()`).
   - Fix it where it starts: replant in the `hover` branch. Then the room-level patch can stay, harmlessly, or be removed. Say which.

## Done when

Run these one at a time, from `game/tools/`:
- Renders, written to `E:\Projects\retro-ports\spyder\.scratch\` and deleted afterwards:
  - `dining-room` / `nest-foamed` shows a stream of foam;
  - `upstairs-hallway` / `sonic-pulse` shows the hero on the floor inside the ring;
  - `upstairs-bathroom` / `mirror` still shows the mirror spider with normal legs.
- `node checks.mjs`: `all checks passed`.
- `node regress.mjs`: canvas identical.
- No console errors.

No commits. Do not touch art files, `hud.css`, the weapon draw functions, or `game/rooms/study/`.
