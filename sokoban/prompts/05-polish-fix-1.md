# 05 fix 1 — [LOGIC] the phone matrix as a check: `tools/phone-check.mjs`

Prompt 05 §3 asks for every screen at three sizes with proof. The 05 run wrote a
pass/fail table without a tool behind it, so that table is not accepted. Build
the check, run it, write the real table. **Do not fix layout or CSS** — report
what fails; the director fixes it.

Work in `E:\Projects\retro-ports\sokoban\game`. Read `prompts/05-polish.md` §3,
`docs/ART-DIRECTION.md` §12.2 and §15 (phone line), and `tools/shoot-tower.mjs`,
`tools/shoot-modes.mjs`, `tools/lib/harness.mjs` for how screens are reached
(`window.hening.screen(...)`, `progress({ solvedUpTo })`, `skipIntro()`,
`garden(json)`, `idle()`).

## Pembagian kerja

- **Kimi (you):** [LOGIC] — this tool, one run, the report. Nothing else.
- **Opus:** wrote this; fixes every layout failure the tool finds; reviews once.
- **Haiku:** re-runs the tool after Opus's fixes.

## Hard rules

- Create only `tools/phone-check.mjs` and `review/prompts/05-polish/phone-matrix.md`.
  Do not edit `src/`, `docs/`, `reference/`, `original/`, `vite.config.js`,
  `package.json`, `review/current/`, or any other tool.
- No git commits. No downloads, no new npm packages.
- Use the existing harness (`resolveTarget`, `launchBrowser`, `waitForHening`,
  `withParams`, `collectConsoleErrors`); open `?qa=1&seed=7`.

## What the tool checks

Sizes: **390 × 844**, **844 × 390**, **768 × 1024**, each at `deviceScaleFactor: 2`,
plus 390 × 844 at DPR 3 for the room only. Every context is created with
`hasTouch: true, isMobile: true`.

Screens: title, courtyard, courtyard with a place caption (`at: 'batu'`),
elevator (mid-ride), floor I and floor V, room 6 (playing), room 6 results
(`screen('results', { room: 6 })`), pause, records (`records`), Kolam
(`settings`), the gate choice (the screen the courtyard gate opens; find how
`flow.mjs` reaches it), Mimpi (`screen('dream', { room: 10 })`), the editor
(`garden` screen with a full 19 × 16 board as `shoot-modes.mjs` does), the
ending.

Per screen × size, in the page:

1. **Canvas fills the screen:** the WebGL canvas's `getBoundingClientRect()`
   equals the viewport within 1 px.
2. **Inside the screen:** every visible element with text (non-empty
   `innerText`, `offsetParent !== null`, opacity > 0.05, `visibility` not hidden)
   has its rect inside the viewport (1 px tolerance).
3. **Nothing overlaps:** no two visible text elements that are not ancestor
   and descendant intersect by more than 2 px in both axes.
4. **Legible:** the smallest computed `font-size` among visible text elements
   whose font family contains `Jost` is ≥ **13 px** (portrait and landscape
   phone only; the tablet is reported, not failed).
5. **Portrait tools at the bottom (§12.2):** on 390 × 844, in the room, the
   bottom edge of the HUD controls/hint block is in the lower 30 % of the screen.
6. **No browser gestures:** on `html` / `body` / the canvas, the computed
   `touch-action` is `none` or `manipulation`, `user-select` is `none`
   (except inputs), `overscroll-behavior` is `none` or `contain`.

Touch, once per size (with `page.touchscreen.tap` and synthesised
`TouchEvent`/pointer drags where `tap` is not enough):

- Room 6: tap the tile next to the wanderer → `hening.inspect().steps` (or
  `where()`) changes. Tap a tile three away along an open path → the wanderer
  walks there.
- Courtyard: tap the Batu Catatan place → a caption appears (or the records
  screen opens, whichever the game does).
- Floor I: tap a lit niche → the room's caption or the room opens.
- Records: tap a floor tab → the shown floor changes.
- Kolam: drag a slider's pebble → its value changes.
- Editor: drag across three cells → three cells change.

Console errors: collected per page, reported with the screen.

## Output

`review/prompts/05-polish/phone-matrix.md`: one table, screen rows × size
columns, each cell `pass` or `fail: <check number> <element/reason>`; then the
touch results (one line each); then every failure in full. The tool exits 1 if
anything fails. Run it once and stop. Write `PHONE-CHECK DONE` as the last
line of your final answer.
