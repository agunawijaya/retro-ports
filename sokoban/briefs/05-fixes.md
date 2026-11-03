# Brief: 05 follow-up fixes (engineer)

## Pembagian kerja

- **Sonnet (engineer, you):** the four fixes below — small [LOGIC] after Flash's run, by the model policy.
- **Opus:** decided each fix; works on §8 (frames in `review/current/`) meanwhile — do not write frames there.
- **Haiku:** re-runs the checks afterwards.

Work in `E:\Projects\retro-ports\sokoban\game`. Do not edit `docs/`, `reference/`, `original/`, `src/render/tower.js`, `src/world/stone-layout.js`, `src/world/tower-views.js`. No git commits.

## 1. One file, as ARCHITECTURE.md promised

`docs/ARCHITECTURE.md` (Build): `npm run build` writes `dist/hening.html`, "one file with the code, the fonts (as data URIs) and the generated rooms inlined. It opens from disk with no server and no network." Today `dist/` also holds `fonts/*.woff2` (loaded from `public/fonts/`) and `worker-*.js` (the solver Web Worker). Make the build produce **only `dist/hening.html`** (plus nothing the page needs at run time): the fonts inlined as data URIs (import them from source so `vite-plugin-singlefile` inlines them, or an equivalent), and the solver worker inlined (`?worker&inline` or equivalent). Keep `public/fonts/LICENSES.md` reachable in the repo (it does not need to be in `dist/`). Prove it: copy `dist/hening.html` alone to an empty folder, open it from there with Playwright (`file://`), and check that `document.fonts` reports Cormorant Garamond and Jost loaded, that a garden room's solver search still starts (the worker), and that there are no console errors. Size must stay ≤ 3 MB.

## 2. Floor caption uses the current mode's record

`src/screens/floor.js` (around line 146) reads `solved?.[room]?.bebas`. `GAME-DESIGN.md` §7.4: the caption shows the best moves and pushes **for the current mode**. Use the session mode (`state/mode.js`).

## 3. Batu Catatan's mode button names where it goes

`src/screens/records.js` (around line 45): the toggle's label is always `dupa`. Make it name the mode the press switches **to**: `dupa` while the tab shows *tanpa batas*, `tanpa batas` while it shows *dupa*. Same style and behaviour otherwise.

## 4. Small copy and the secret

- `src/ui/hud.js` (around line 44): the room hint becomes `← ↑ → ↓ atau ketuk ubin · Z mundur · R ulang · Q / E putar · esc jeda`. Check it still fits one line at 390 px wide (it may wrap on a phone the way it does now; do not shrink the font below 11 px).
- `src/dev/README.md`: remove the line (or table row) that names `solution-view.js`; its only trace must be the one comment inside that file (ARCHITECTURE §9).

## Then

`npm test`, `node tools/flow.mjs` (all steps), `npm run build`, `node tools/review.mjs audit`. Add a short section *05 fixes* to `game/NOTES-05.md` if it exists, otherwise to `game/NOTES.md`. Report back in at most 15 lines: what changed per fix, the single-file proof, the check results, the build size.
