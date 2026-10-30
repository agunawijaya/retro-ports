# Brief 12-fix-4 — boxes out from under the HUD, and three QA states (for `engineer`)

These come from Opus's review. **Opus made the decisions; the work is mechanical.**

## Pembagian kerja

- **engineer:** items 1–4, exactly as written.
- **Opus:** the positions and the review.
- **Agy:** not needed.

## 1. Move the boxes out of the HUD safe zones

The weapon tag covers about x 1500–1880, y 880–1045, and the nerve gauge about x 30–240, y 850–1045. Six boxes sit under them and cannot be seen.

Change `layout.breakables[0].x` in these rooms' `room.js`, keeping `y` and `contains` as they are:

| room | x now | x new |
|---|---|---|
| front-porch | 250 | 330 |
| living-room | 1680 | 1260 |
| family-room | 1470 | 1300 |
| kitchen | 1720 | 1180 |
| dining-room | 1520 | 1470 |
| upstairs-hallway | 1620 | 1000 |
| master-bedroom | 1540 | 380 |

Leave downstairs-bathroom (1320), kids-bedroom (1200), study and upstairs-bathroom as they are. If a check or the summary lists the positions, update it to match.

## 2. QA `sonic-pulse` must not make the Sonic Pulse the held weapon

The Sonic Pulse is fired with **F** and shows as a bell on the tag (prompt 12, L1/L3). The last fix added `switchWeapon('sonic-pulse')`, so the tag now reads "Sonic Pulse · Pressure", with dots.
- Remove that.
- Fire the pulse the way pressing F does in play. Find the F-key path in `room-runtime.js` and call the same thing.
- Give the hero a charge first, so the bell is seen before it is used. Whatever keeps the frame honest is fine.

## 3. QA `weaver` (`rooms/study/room.js`): the Weaver must be spinning

The prompt asks for "a Web Weaver spinning a new web on the gallery rail". In the current state it is walking, not spinning.
- Stage it in its `'spinning'` state, partway through (`spinTimer` at about half of `spinDuration`), with its new web half grown. Use the Weaver's own methods in `lib/spider-types/web-weaver.js` (the code that starts a spin) rather than setting fields by hand where you can.
- The hero stays on the ladder's top rung with the Web-Cutter, and a page still flutters down.

## 4. QA `action` (`?room=study`): a red tint covers the whole frame

Find out why: is the hero hurt, the nerve low, or a danger vignette? If the staging causes it (for instance a hit landing on the hero during the staging step), stage it so the hero is not hurt, the way the other rooms' `action` states look. If it is a deliberate gameplay effect that the state triggers legitimately, change nothing and report what it is.

## Done when

Run these one at a time:
- `node checks.mjs`: `all checks passed`.
- `node regress.mjs`: canvas identical.
- `node flowtest.mjs`: `all checks passed`.

Do not pass a positional argument to `regress.mjs`: last time `regress.mjs living-room` wrote PNGs into `game/tools/living-room/`. Delete those five stray PNGs, `game/tools/living-room/*.png` created at about 01:14, but first check that they are regress outputs. Then remove the empty folder.

Renders, to `.scratch/` only and deleted afterwards:
- `kitchen/box-burst`;
- `upstairs-hallway/sonic-pulse`;
- `study/weaver`;
- `study/action`.

No commits. Do not touch art files, `hud.css`, weapon draw code, `drawBreakables` or `drawPickups`.
