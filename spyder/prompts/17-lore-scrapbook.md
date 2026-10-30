# Prompt 17 — Lore items and the scrapbook

You are working on the Spyder web game in `E:\Projects\retro-ports\spyder`. **Runs after 16.** May run **in parallel with prompt 18** (18 touches only `game/cutscenes/` and its own files). Sections are tagged **[LOGIC]**, **[ART]** or **[TEXT]**.

## Read first

`STORY.md` (binding: the lore table and the writing rules), `DESIGN.md` §3, `ART-DIRECTION.md` §3, §4, §11, §15 incl. "Where images go"; `game/NOTES.md`; `game/lib/progress.js`, `game/lib/screens.js`, `game/lib/house-map.js`, `game/lib/room-runtime.js`; every room's `layout`.

## Rules

Plain scripts, global `Spyder`, opens from disk. No per-frame blur. Palette only. Humanized code. Images only through `review.mjs` or `.scratch/`; `audit` clean; `.scratch/` emptied. No git commits. `regress.mjs` identical for the Living Room on a fresh save (the lore item is hidden there until spotted — see L1). `checks.mjs`, `flowtest.mjs` pass.

## L1 [LOGIC] — Lore items in every room

- Each of the 12 rooms gets `layout.lore: { id, x, y, hiddenBy, text }` — the item from `STORY.md`'s table. `hiddenBy` is one of: `'web'` (a specific web must be torn below 30 %), `'breakable'` (inside the room's box), `'prop'` (behind a prop that must be shot 3 times: a cushion, a drawer, a loose floorboard), or `'makeover'` (appears only after the room is clean). Use each kind at least twice across the 12 rooms; choose the place that fits the room and list them in the summary.
- When revealed, the item glints (a small sparkle every 1.5 s); walking into it collects it: a soft chime, a paper "flip" into the HUD's top-left, +200, and a small handwritten line on screen for 3 s (the first sentence of its text).
- Collected items are stored in progress (`progress.lore[roomId] = true`). The results card shows "Found: <item>" under the story object when found in that run.
- The house map shows a tiny ink mark next to each room whose lore item is found.
- QA: `__spyder.revealLore()` reveals the current room's item; a check proves each room's item can be revealed and collected and is saved.

## L2 [LOGIC] — The scrapbook screen

- New screen **Scrapbook**, reached from the title card and the house map ("Scrapbook" link) and from the pause card.
- A book with 12 double pages, one per room in house order. Each page shows: the room's name, its story object (once the room is cleared) and its lore item (once found), each with its text from `STORY.md`. Not-yet-found items show as an empty photo corner with a pencil "?".
- Page turning: arrow keys / A-D / click the page corner; Esc closes. A counter on the cover: "Found 7 of 12".
- Keyboard and screen-reader friendly (each page's text is real text in the DOM).

## T1 [TEXT] — Wording

All item texts come from `STORY.md`. Any extra line you need (a caption, an empty-page hint) is written in A.'s voice and **listed in the summary** for the architect.

## A1 [ART] — Items, scrapbook, map marks

- **Lore items in the rooms:** small painted objects at the scale of the room (postcard, tin whistle, cassette, shopping list, cracker crown, plaster tin, key on a ribbon, envelope, second drawing, folded will, hairbrush, hand-drawn map). Each readable as what it is at 1920 × 1080, with a contact shadow and the glint.
- **The scrapbook:** an old cloth-bound album on a dark table: thick cream pages with deckled edges, photo corners, items "glued" in at slight angles with a soft shadow, A.'s blue-black handwriting (Caveat) for captions, typewriter (Special Elite) for the room names, a ribbon bookmark, the cover in faded green cloth with a paper label "For Tommy". The page turn: a curling page (a 0.4 s skewed gradient sweep, no blur).
- **Map marks:** a tiny inked star next to the room name.

## Deliverable — then STOP

1. `makeSheet('17-lore-scrapbook', …)`, six cells: the Living Room with its lore item glinting (2× crop), the Kitchen item being collected (the handwritten line on screen), the scrapbook cover, a scrapbook double page with both items found, a page with the "?" corner, the house map with stars.
2. `writeSummary('17-lore-scrapbook', …)`: where each lore item hides (table), any extra text written (for the architect), check counts, regression, audit, who did [LOGIC], [ART], [TEXT].
3. `node review.mjs gallery`. Then stop.
