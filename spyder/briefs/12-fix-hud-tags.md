# Brief 12-fix-2 — HUD tag fan and the "Found:" line (for `engineer`)

These are small [LOGIC] gaps against `prompts/12-weapons.md` L2/L3, found by Opus in review. Opus is restyling the tags in `game/css/hud.css` and repainting the item drawing in `game/lib/screens.js` (`drawResultsItemBlockout`), so leave both of those alone.

## Pembagian kerja

- **engineer:** the three items below.
- **Opus:** the look (CSS, ink drawings) and the review.
- **Agy:** not needed.

## The gaps

1. **The fan never shows the Vacuum behind another weapon.**
   - `index.html` has peek tags only for the Foam Spray and the Web-Cutter, and `hud.js` `updateWeapon()` hides a peek when its weapon is active.
   - So with the Web-Cutter active, only the Foam peeks. L3 asks for "the other unlocked weapons peeking out behind it".
   - Add a third peek tag for the Vacuum Blaster: same markup as the others, `data-peek="vacuum"`, `class="tag tag--peek tag--peek-vacuum"`, with a `tag__icon tag__icon--vacuum` span.
   - Show it when the active weapon is not the Vacuum. Show the other peeks when their weapon is unlocked and not active, as now.
   - During the Flamethrower, all three default weapons peek if they are unlocked.
2. **The main tag's icon.** `data-tag-icon` is always hidden.
   - Give it the class `tag__icon tag__icon--<id>` for the active weapon (`vacuum`, `web-cutter`, `foam-spray`, `flamethrower`).
   - Show it **only when more than one weapon is unlocked**. With only the Vacuum unlocked, the tag must look exactly as before (prompt 12, L3).
   - Also set `data-weapon="<id>"` on the main `.tag` element, so CSS can tell which weapon it is.
3. **"Found: …" shows on every clear of the Living Room and the Dining Room.**
   - In `screens.js` `fillResults()`, it is keyed on the room id alone. It should show only on the clear that granted the unlock, i.e. the first one.
   - Use whatever `progress.js` already knows. For example, have the unlock step record which weapon was just granted, and read that. Do not add a new save format.

## Do not

- Touch `game/css/hud.css`, `drawResultsItemBlockout` in `screens.js`, or any weapon file.
- Touch `game/lib/room-runtime.js` or `game/rooms/study/`, which another Gemini session is building.
- Commit.

## Done when

- `node checks.mjs` says `all checks passed`, run alone.
- Add checks for:
  - a. the Vacuum peeks when the Web-Cutter is active, with both unlocked;
  - b. the main tag's icon is hidden with only the Vacuum unlocked;
  - c. "Found:" shows on the first Living Room clear and not on a second one.
- `node regress.mjs` reports the Living Room canvas identical, run alone.
