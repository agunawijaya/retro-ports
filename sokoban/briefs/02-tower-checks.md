# Brief: prompt 02 — the flow and perf checks (LOGIC)

Crew engineer, Hening (`E:\Projects\retro-ports\sokoban\game`). This is
`prompts/02-tower.md` **§10 Checks** — read that section first, it is the
spec. Every screen now exists (the director built them); you write the
checks, run them, and report. Do not change any `screens/*.js` other than
`room.js`, nor `render/`, `world/`, `ui/screens.css`, `ui/veil.js`, `docs/`,
`reference/`. If a check fails because of a bug in a screen, **report it
with the exact step and what you saw** — do not fix screens yourself.

## QA hooks you may add (`src/dev/qa.js`)

- `current()` → `{ base: router.baseName(), top: router.top() }`.
- `inspect()` already exists for rooms; add `screenInfo()` →
  the `inspect()` export of the current base screen module when it has one
  (`courtyard`, `floor`, `elevator` export `inspect()`; return `null` otherwise).
  Import the screen modules directly (`../screens/floor.js` etc.).
- `renderStats()` → `getRenderer().renderer.info.render` (`calls`,
  `triangles`) from `render/renderer.js`.
- `settings()` → a copy of `getSettings()`.

## `tools/flow.mjs` (Playwright, same harness as `perf.mjs`/`regress.mjs`)

Drive the game **with the keyboard and the pointer** wherever §10 says so (the
screens implement: courtyard digits `1`–`5` walk to a place, `Enter` uses it;
floor `←`/`→` move between alcoves, `Enter` enters, `↑`/`↓` ride, `Escape`
rides down; results `←`/`→` + `Enter`; pause `↑`/`↓` + `Enter`, `Escape`
closes; Kolam `↑`/`↓` rows, `←`/`→` values, `Escape` closes; any key skips the
elevator ride). Use `screenInfo()`/`current()` to wait for states (poll with
`page.waitForFunction`, generous timeouts — SwiftShader is slow), never fixed
sleeps alone. Steps, each one PASS/FAIL with a reason:

1. Load `?qa=1` (no `room`): base is `title`. Click the page → base becomes
   `courtyard`.
2. `1` → the wanderer walks to the gate tile (`screenInfo().place ===
   'gerbang'`), `Enter` → base `elevator` → (press a key to skip) → base
   `floor` with `screenInfo().floor === 1`, alcove room 1 `open`.
3. `Enter` → base `room` (room 1). `hening.skipIntro()`, `hening.arrange()` →
   wait for top `results`.
4. `Enter` (ruang berikutnya is the default) → base `room`, room 2
   (`hening.inspect().room === 2`).
5. `Escape` → top `pause`. `ArrowDown` ×2, `Enter` (kembali ke menara) → base
   `floor`, floor 1; `screenInfo().alcoves[0].state === 'solved'`,
   `alcoves[1].state === 'open'`, `alcoves[2].state === 'locked'`.
6. `Escape` → elevator → (skip) → base `courtyard`.
7. `3` → walks to Batu Catatan, `Enter` → top `records`; the card's text
   contains `ruang 01` with a number of `langkah` (read the DOM).
   `Escape` → top `courtyard`.
8. `4` → walks to Kolam, `Enter` → top `settings`. `ArrowDown` (to
   `suara · utama`), `ArrowLeft` ×2 → `settings().volume.master` is 0.6.
   `Escape`.
9. Reload (`?qa=1`). Progress (`hening.progress()`) still has room 1 solved and
   `open >= 2`; `settings().volume.master === 0.6`.
10. New context with `page.addInitScript` making every `localStorage` method
    throw (and `window.localStorage` access throw). Repeat 1–5 (no console
    errors allowed), then reload: progress back to default (`open === 1`).
11. Fresh page: `hening.progress({ solvedUpTo: 9 })`, `hening.screen('room',
    { room: 10 })`, `skipIntro()`, `arrange()`, wait for `results`, `Enter` →
    base `elevator` → let it finish **without** skipping → base `floor`,
    floor 2, `screenInfo().ringsLit` includes 1.
12. Fresh page: `progress({ solvedUpTo: 49 })`, `screen('room', { room: 50 })`,
    `skipIntro()`, `arrange()`, wait for `results` (only one choice: `naik`),
    `Enter` → elevator → base `ending` → wait for base `courtyard` (≤ 40 s).
13. No console errors anywhere (collect per page; list them).

Write the log to `.scratch/flow/flow.txt` and print a PASS/FAIL table.
**No check uses the solver**; rooms are finished with `arrange()`.

## `tools/perf.mjs`

Add two measurements next to the existing room ones, same output format:
`title` (`hening.screen('title')`, all floors lit: `progress({ solvedUpTo: 50
})` first) and `floor-lit` (`progress({ solvedUpTo: 20 })`,
`screen('floor', { floor: 2 })`, wait 2 s). Report `frameStats(2000)` and
`renderStats().calls` for each, against `ARCHITECTURE.md` §14 (draw calls ≤
150, frame ≤ 8 ms — the headless frame time is SwiftShader's, say so, as the
existing report does).

## Also run

`npm test`, `npm run build` (then open `dist/hening.html` **from disk** with
Playwright: base must be `title` and a click must reach `courtyard`; then
delete `dist/`), and `node tools/review.mjs audit` (must print nothing; if it
lists `.scratch/` content that is fine — `.scratch` is excluded — report
anything else).

## Report

The PASS/FAIL table for flow, the perf numbers (all four measurements), test
count, build size, and every failure with the exact step and observation.
