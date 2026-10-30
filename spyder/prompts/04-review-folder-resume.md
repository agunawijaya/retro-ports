# Prompt 04 — resume (finish what the first session started)

A previous session ran `prompts/04-review-folder.md` in `E:\Projects\retro-ports\spyder` and stopped about halfway through, when its model quota ran out. **Read `prompts/04-review-folder.md` completely; it is still the task and its deliverable.** Then finish it from where the previous session stopped.

## What was already there when this resume was written

- `game/tools/review.mjs` exists.
- Some tools already import `scratchDir`; for example, `tabs.mjs` and `regress.mjs` were changed. Check every tool listed in the prompt; some may still be untouched.
- `game/tools/rooms/` exists. Check that all three room scripts moved there, and that the old copies are gone from `game/rooms/*/`.
- `review/current/` holds 21 files. Check that they are complete:
  - `shell`: `title`, `map`, `settings`, `howto`;
  - `front-porch`, `living-room`, `kitchen`: `dirty`, `action`, `makeover`, `clean`, `results`;
  - plus `tutorial` for the porch and `jumper` for the kitchen.
- `review/prompts/` has `00-02-architect-review`, `03-polish` and `03-polish-fix-1`. Check that each has its sheet(s) and a `summary.md`.

## What was not there yet

- `review/index.html` (the gallery).
- `.scratch/`.
- The deletions in step 4: `game/tools/out/`, `game/screens/`, `game/rooms/front-porch/screens/` and `game/rooms/kitchen/screens/` all still exist.
- The `.gitignore` line, the docs updates, and the prompt 04 deliverable.

## How to work

- **Inspect first.** Do not redo a step that is already complete and correct; fix it only if it is broken or incomplete.
- Delete the old folders only after `review/current/` and `review/prompts/` are complete. Then `node review.mjs audit` must print nothing.
- Everything else (rules, checks, deliverable, "then STOP") is as in `04-review-folder.md`.
- In `review/prompts/04-review-folder/summary.md`, add one line saying the work was finished by a resumed session.
