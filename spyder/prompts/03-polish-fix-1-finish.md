# Prompt 03 — fix 1, finish (checks and notes only)

You are working on the Spyder web game in `E:\Projects\retro-ports\spyder`. The previous session (prompt `03-polish-fix-1.md`) finished all four fixes and produced its review sheet, `game/tools/out/review/03-polish-fix-1.jpg`. Its sign-in then expired before it could record the results.

**Do not change any game code, any tool, or the review sheet.** Do only this:

1. Run `game/tools/checks.mjs` and `game/tools/flowtest.mjs` once each, and note the pass/fail counts. If either fails, do not fix it: record which check failed and its message.
2. Find out what defect 4 of `03-polish-fix-1.md` was: the HUD looked dimmed in the Front Porch makeover cell of `03-polish.jpg`. It was either a game bug or a capture-timing artefact. Read the code that was changed for it and say which.
3. Append a short section **"Prompt 03 — fix 1 (2026-10-29)"** to `game/NOTES.md` containing:
   - what changed for each of the four defects (read the diff or the files);
   - what defect 4 turned out to be;
   - the check counts from step 1.

Then stop.
