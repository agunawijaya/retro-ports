# Prompt 05 — part D: copy, the secret, the README, and the full playthrough ([LOGIC], DeepSeek)

You are working on the Hening web game in `E:\Projects\retro-ports\sokoban\game` (Vite, Three.js, Vitest, Playwright via `playwright-core` and the harness in `tools/lib/harness.mjs`). This is the self-contained part of `prompts/05-polish.md` given to you: its **§6** and **§7**. Read that prompt first (its *Pembagian kerja* and parallel rules apply to you), then `docs/GAME-DESIGN.md` (all of it: every Indonesian string there is the reference copy) and `docs/ARCHITECTURE.md` §8, §9, §12.

Other agents are editing the game at the same time. So:

- Create or edit only: `tools/playthrough.mjs` (new), `game/README.md`, `game/NOTES-05-ds.md` (new), and `review/prompts/05-polish/playthrough.md` (new). **Edit no other file.** No `package.json` changes.
- Build your own copy for the playthrough: `npx vite build --outDir ../.scratch/05ds-dist` (from `game/`), and run the playthrough against `.scratch/05ds-dist/hening.html`. Delete only `.scratch/05ds-*` folders when done.

## §6 Copy, the secret, the README

1. **Copy table** in `game/NOTES-05-ds.md` → *Copy*: every player-facing string in `src/` (screens, ui, themes' labels, HUD, captions, cards, settings, records, results, garden, gate choice, the dupa time-out), one row each: screen · string · matches `GAME-DESIGN.md` (yes / no / not in the doc) · problem (English left, exclamation mark, wrong case, wrong word). Then a list **Proposed fixes**: file, line, from → to. Do not apply them.
2. **The secret** (`ARCHITECTURE.md` §9 describes a hidden helper). Search the build output, `game/README*`, every UI string and every settings label for anything that mentions it: the key chord, a solution viewer, a helper, "cheat", "solusi", "jawaban". Report every hit with file and line. Its only allowed trace is the one comment in `src/dev/solution-view.js`. Do not describe the helper in your notes beyond "the hidden helper of ARCHITECTURE §9".
3. **`game/README.md`** for the owner: what Hening is in two sentences; how to run (`npm install`, `npm run dev`), test (`npm test`), build (`npm run build`), and open `dist/hening.html` offline; where the rooms come from and why `src/data/*.generated.json`, `solutions.manual.json`, `review/` and `dist/` are git-ignored (`ARCHITECTURE.md` §12). **No mention of the hidden helper.**

## §7 The full playthrough — `tools/playthrough.mjs`

Exactly prompt 05 §7: fresh storage, the built file from disk (`file://…/hening.html?qa=1`; `?qa=1` only for `window.hening.solve()` and inspection), title → courtyard → gate → **tanpa batas** → floor I; rooms **1 to 50 in order**, each entered from its floor niche, `solve()`, results, **ruang berikutnya**; the elevator after 10, 20, 30, 40; **naik** after 50; the ending to the courtyard; then Batu Catatan shows 50 records equal to the stored solutions' moves and pushes (`src/data/solutions.generated.json`), every floor's rim lit on the title, and a reload keeps it all; then rooms 1–3 again in **dupa**, records in the Dupa tab. Log every network request after load (there must be none), every console error (none), and the worst frame time.

Use the screen-level QA hooks in `src/dev/qa.js` (`screen`, `solve`, `progress`, `inspect`, `current`) and real keyboard input where a screen needs a choice (look at `tools/flow.mjs` for how the existing checks drive screens). Report per room: solved (yes/no), moves, pushes, seconds. A room that fails is reported with what happened — **do not skip it and do not change game code**; write it under *Defects* in `review/prompts/05-polish/playthrough.md`.

Write the result table to `review/prompts/05-polish/playthrough.md` (50 rows + the ending, records, reload, dupa, network, console, worst frame), and how to run the tool at its top.

Then stop.
