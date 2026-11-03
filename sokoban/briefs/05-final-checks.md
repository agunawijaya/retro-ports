# Brief: prompt 05 final checks (qa-scout)

## Pembagian kerja

- **Haiku (you):** run the checks below in order, one at a time (they share the CPU), and report the numbers. Edit no source, tool or document. No git.
- **Opus:** fixed everything up to now; writes the numbers into the summary; decides anything that fails.

Work in `E:\Projects\retro-ports\sokoban\game`. `dist/hening.html` is already built — do **not** rebuild.

## Run, in order (PowerShell or Bash; give each its own command, timeout 20 min)

1. `npm test` — the files and tests counts, pass/fail.
2. `node tools/flow.mjs` — how many of 19 PASS; any FAIL line in full.
3. `node tools/themes-check.mjs` — its summary line(s) (cases passed, worst draw calls).
4. `node tools/rooms-check.mjs` — its summary lines (rooms passed; water counts / koi / departs+results / stranger lines).
5. `node tools/playthrough.mjs` — it rewrites `review/prompts/05-polish/playthrough.md` against `dist/hening.html` from disk. Report: rooms solved of 50, each whole-run check line (ending, records, rim lights, reload, dupa, network, console errors, worst frame).
6. `node tools/memory-check.mjs` — both table rows (baseline/final geo/tex/prog, heap growth).
7. `node tools/phone-check.mjs` — the count of `pass` cells of 46 and touch ok count of 18.
8. `node tools/review.mjs audit` — print its output verbatim (empty is good).
9. `node tools/review.mjs gallery` — the path it wrote.

If a check fails, do not re-run it more than once and do not try to fix anything; report the failing lines verbatim.

## Report

At most 25 lines: one line per check with the numbers above, then any failure in full.
