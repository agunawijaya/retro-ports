# Prompt 04 — One Place for Every Image (Review Folder) (2026-10-29)

*Note: This work was finished by a resumed session.*

- **Single review folder (`review/`, `game/tools/review.mjs`):** Built the unified review system specified in `ART-DIRECTION.md` §15. Tools export `paths`, `scratchDir()`, `saveHero()`, `makeSheet()`, `writeSummary()`, `buildGallery()`, and `audit()`.
- **What moved:**
  - Migrated review sheets to prompt folders:
    - `game/tools/out/review/03-polish.jpg` → `review/prompts/03-polish/sheet.jpg`
    - `game/tools/out/review/03-polish-fix-1.jpg` → `review/prompts/03-polish-fix-1/sheet.jpg`
    - `game/tools/out/review/{shell,porch,kitchen,makeovers,regression}.jpg` → `review/prompts/00-02-architect-review/`
  - Moved room QA scripts into `game/tools/rooms/`:
    - `game/rooms/front-porch/playtest.mjs` → `game/tools/rooms/front-porch-playtest.mjs`
    - `game/rooms/front-porch/perf.mjs` → `game/tools/rooms/front-porch-perf.mjs`
    - `game/rooms/kitchen/playtest.mjs` → `game/tools/rooms/kitchen-playtest.mjs`
  - Re-shot fresh 1920 × 1080 JPEG hero frames into `review/current/` (21 frames):
    - `shell` (4): `title`, `map`, `settings`, `howto`
    - `front-porch` (6): `dirty`, `action`, `makeover`, `clean`, `results`, `tutorial`
    - `living-room` (5): `dirty`, `action`, `makeover`, `clean`, `results`
    - `kitchen` (6): `dirty`, `action`, `makeover`, `clean`, `results`, `jumper`
- **What was deleted:**
  - Deleted legacy QA output and screen directories:
    - `game/tools/out/`: 281 files, 684.11 MB (including `make-sheets.ps1`)
    - `game/screens/`: 6 files, 14.80 MB
    - `game/rooms/front-porch/screens/`: 5 files, 14.44 MB
    - `game/rooms/kitchen/screens/`: 5 files, 14.70 MB
  - Total space freed: **297 files, 728.05 MB**.
- **Audit result:** `node review.mjs audit` passed with 0 stray images found (clean exit 0).
- **Check counts:**
  - `checks.mjs`: **37 passed, 0 failed** (`all checks passed`).
  - `flowtest.mjs`: **53 passed, 0 failed** (`all checks passed` — 34 normal storage, 19 blocked storage).
- **Gallery (`review/index.html`):** Standalone zero-dependency review gallery supporting full keyboard navigation (`←`/`→`/`Esc`), lightbox viewing, prompt contact sheets and summaries, current hero frames by house order, and frozen reference comparison frames.

**Claude Code review:** approved — the gallery shows every prompt card, the current frames in house order and the reference row; audit clean; checks 37/37 and flow 53/53 as reported. (The first two automated runs stopped on an agy quota error; the owner finished it in an interactive agy session.)
