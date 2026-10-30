# Prompt 18 — Comic-panel cutscenes (prologue and the three act breaks)

You are working on the Spyder web game in `E:\Projects\retro-ports\spyder`. **Runs after 16.** May run **in parallel with prompt 17**: create files only under `game/cutscenes/`, plus the `<script>` lines in `game/index.html` and the trigger hook in L2 (re-read shared files right before editing). Sections are tagged **[LOGIC]** or **[ART]**.

## Read first

`STORY.md` (binding: the "Acts and cutscenes" table and the writing rules), `DESIGN.md` §3.2, §9.4; `ART-DIRECTION.md` §2–§4, §6, §11, §15 incl. "Where images go"; `game/NOTES.md`; `game/lib/screens.js`, `game/lib/progress.js`, `game/main.js`.

## Rules

Plain scripts, global `Spyder`, opens from disk. No per-frame blur. Palette only; saturation only from light. Humanized code. Images only through `review.mjs` or `.scratch/`; `audit` clean; `.scratch/` emptied. No git commits. `checks.mjs`, `flowtest.mjs` pass (flowtest skips cutscenes with a QA flag, see L2).

## L1 [LOGIC] — A cutscene player

- `game/cutscenes/player.js`: plays a cutscene definition `{ id, panels: [{ draw(ctx, t, size), caption, hand }] }` on a dedicated canvas over a dark page: panels appear one at a time in a comic-page layout (2×2 grid for four panels, slight gutters, each panel on its own paper), each fading and sliding in over 0.5 s with a 3–5 s slow internal animation (a pan, a flicker, a light coming on). Click, Space or Enter advances to the next panel; **Esc skips** the whole cutscene (with a small "Esc — skip" in pencil).
- Captions: `hand: true` → A.'s handwriting (Caveat, blue-black ink on a torn paper slip); `hand: false` → typewritten slip (Special Elite). At most 12 words, from `STORY.md`.
- Audio: a quiet pad and the room tone; the After Act 3 scene ends with the two-note whistle (procedural, a soft sine with a little breath noise).
- `prefers-reduced-motion`: no slides or pans, only fades.

## L2 [LOGIC] — Triggers

- **Prologue:** before the Front Porch on a **new game** (and from the scrapbook, replayable).
- **After Act 1:** the first time the Dining Room is cleared, after its results card, before the map.
- **After Act 2:** the first time the Kid's Bedroom is cleared.
- **After Act 3:** the first time the Attic is cleared.
- Seen cutscenes are stored in progress; each is replayable from a "Memories" strip at the end of the scrapbook (if 17 has landed; otherwise from the pause card's How-to-play area, and note it).
- QA: `?cutscenes=off` disables triggers (flowtest uses it); `__spyder.playCutscene(id)` and `__spyder.cutscenePanel(id, n)` (freeze on panel n at full reveal) for screenshots.

## A1 [ART] — Sixteen painted panels

Each panel is drawn procedurally with `S.paint` in the game's painterly style, at a panel size of about 900 × 500 (the 2×2 page at 1920 × 1080), cached once per panel; only its small animation runs per frame. Follow `STORY.md`'s panel descriptions exactly. Composition rules:
- One clear focal point per panel; strong value contrast (a pool of lamp light, a window, a glowing card).
- Close-ups of hands and objects are allowed; **faces of the hero stay in shadow or turned away** (he must not be identified yet). Reuse the hero's chibi proportions and orange suit when he is visible.
- The house exterior (Prologue 4) reuses the Front Porch's palette and silhouette, seen from the gate at dusk, the attic window flickering.
- The After Act 3 final panel is black with only the caption slip and a faint glow — let the whistle carry it.

## Deliverable — then STOP

1. `makeSheet('18-cutscenes', …)`, four cells: each cutscene's full 2×2 page with all panels revealed (Prologue, After Act 1, After Act 2, After Act 3).
2. `writeSummary('18-cutscenes', …)`: triggers as built, any caption that had to differ from `STORY.md` (for the architect), check counts, audit, who did [LOGIC] and [ART].
3. `node review.mjs gallery`. Then stop.
