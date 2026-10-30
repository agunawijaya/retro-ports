# Prompt 13 — Room 10: the Study / Library (introduces the Web Weaver)

You are adding Room 10 to the Spyder web game in `E:\Projects\retro-ports\spyder\game\`, with a new spider type, the **Web Weaver**. Where something is unclear, choose the option closest to the reference scene and write the decision in `game/rooms/study/NOTES.md`.

**Precondition:** prompt 12 (weapons) is done. May run **in parallel with prompt 14**. Sections are tagged **[LOGIC]** or **[ART]** (`prompts/CLAUDE-CODE.md`, "Model policy"); if you were told to do only [LOGIC], build no art: the runtime's blockout covers the room, and the Web Weaver uses a plain rig.

## Read first

1. `ART-DIRECTION.md` — §3–§7, §9, §10, §15 incl. "Where images go", §16, §17 row 10.
2. `DESIGN.md` §5 ("many collectibles, slower pace, puzzle-like layout"), §6 (Web Weaver: "creates new web patches over time").
3. `game/NOTES.md` (room interface, two-file form, weapons from prompt 12), `game/lib/room-runtime.js`, `game/lib/webs.js`, `game/lib/weapons/`.
4. Templates: `game/rooms/master-bedroom/`, `game/rooms/upstairs-hallway/`. Quality bar: `review/current/`, `reference/screens/`.

## Hard rules

- Files: `game/rooms/study/room.js` ([LOGIC]), `art.js` ([ART]), optional `room.css`; **one new file** `game/lib/spider-types/web-weaver.js` and its registration line; **L3 below in `room-runtime.js` only** (prompt 14 does not touch lib). Shared `<script>` lines in `game/index.html`: re-read before editing; prompt 14 may edit it too.
- Use the room id the house map uses (`lib/house-map.js`). Do not modify other rooms or `reference/`.
- **Jump reach:** rise ≤ 190 px, gap ≤ 160 px. The rolling ladder (L2) is the way up.
- `S.paint` for every surface, palette only, no per-frame blur, static art cached. Images only through `review.mjs` or `.scratch/`; `audit` clean; `.scratch/` emptied. No git commits.

## The room

The grandfather's study turned family library: floor-to-ceiling bookcases with a rolling library ladder, a gallery walkway above, a big desk with a green banker's lamp, an illuminated globe, a leather armchair, a leaded window. Slower and quieter than the other rooms: a room to explore.

### L1 [LOGIC] — Layout data (also `layout.props`)

| Element | Position (stage units) | kind |
|---|---|---|
| Ceiling with beams | y 0–100 | wall |
| Bookcases, lower tier | x 120–1500, y 400–850 (with gaps for the window and the door) | furniture |
| Gallery walkway | x 120–1500, floor at y 560, with a brass rail; reached by the ladder | furniture |
| Bookcases, upper tier | x 120–1500, y 110–560 | furniture |
| Rolling ladder on a rail | rail at y 230 running x 160–1460; ladder 70 wide, rungs every 125 px from y 810 up to y 560 | furniture |
| Leaded window | x 1560–1820, y 200–600 (keep below the work-order card, y > 300 for anything important) | window |
| Desk with banker's lamp (story: the diary) | x 760–1160, top y 770 | story |
| Illuminated globe on a stand | x 1250–1370, y 640–860 | light |
| Leather armchair with reading lamp | x 1560–1780, seat y 800 | furniture |
| Floor | y 770–1080, boards, a worn Persian rug | wall |

**Platforms:** floor y 935; desk x 765–1155, y 770; armchair x 1570–1770, y 800; **gallery walkway** x 120–1500, y 560 (one-way); **ladder rungs** (one-way, 70 wide, move with the ladder) at y 810, 685, 560.

### L2 [LOGIC] — Gameplay

- **The rolling ladder:** the hero pushes it along its rail by walking into its foot while on the floor (it moves at 60 % of the hero's speed, with a rumble); its rungs are platforms that move with it. It is the only way up to the gallery. It stops at the rail's ends.
- **The gallery** carries shelves of books; from it the hero reaches high webs and the Weaver's favourite spots.
- **Lore pages (puzzle):** three loose diary pages are hidden **behind webs** (one on the gallery, one behind the globe, one behind a high web over the window). When the covering web is torn below 30 % of its silk, the page falls free and flutters down; walk into it to collect (+100 each, "Page 1 of 3"). Collecting all three is an **extra goal** (`extraGoals: [{ id: 'pages', label: 'Diary pages 0/3' }]`), with the label counting up.
- `rules`: `quota: 18`, `webGoal: 0.85`, `types: ['string', 'crawler', 'jumper', 'eggCarrier', 'webWeaver']`, `spawnPattern: ['crawler', 'string', 'webWeaver', 'string', 'eggCarrier', 'crawler', 'webWeaver', 'string']`, `maxAlive: [3, 4]`, `spawnInterval: [2.6, 1.5]` (slower room). Lairs: behind the books of the upper tier (a book slides out and a crawler emerges), under the desk, behind the globe, the window frame.
- `layout.breakables`: one box (`coins`) on the gallery.
- Makeover beats (timing): shared beats, then `lamp` at 3.3 s (the banker's lamp turns from flickering green to a steady warm glow under its green shade), `globe` at 3.7 s (the globe lights from inside and spins slowly), `reading` at 4.3 s (the armchair's reading lamp comes on), `books` at 4.6 s (fallen books slide back onto the shelves, one after another).
- `storyObject`: "Eleanor's diary: 'Thomas says the Helper will come back one day and make the house safe.'"
- QA states: `dirty`, `action`, `makeover` (t ≈ 3.9 s), `clean`, `results`, plus `weaver`: a Web Weaver spinning a new web on the gallery rail, the hero on the ladder's top rung using the Web-Cutter, a diary page fluttering down.
- Webs (≥ 7): the ladder's top, across the window, between two bookcases on the gallery, over the globe, under the desk, a ceiling beam, over the gallery page (three of them cover the pages).

### L3 [LOGIC] — Shared: webs that are added during play

In `game/lib/room-runtime.js`: `world.addWeb(web)` adds a `Web` to the room while playing. The web-goal fraction must stay fair: a web added during play counts toward the total **only while it is intact above 30 %**, so new webs push the clean meter back a little but can never make the room impossible. Rooms that never add webs behave exactly as before (`regress.mjs` identical for the Living Room; `checks.mjs`, `flowtest.mjs` pass). Add a check for the rule.

### L4 [LOGIC] — The Web Weaver (`lib/spider-types/web-weaver.js`, registered as `webWeaver`)

| Aspect | Spec |
|---|---|
| Body | `SpiderRig`, scale 1.0, **longer front legs** (`legReach` 1.3 on the front pair) held up like a weaver's hands, spinnerets that glint; a slimmer abdomen with a pale band pattern |
| Behaviour | Moves along walls and the gallery rail to a spot between two anchor points (a corner, a gap between bookcases, the ladder top), stops, and **spins a new web** over 3.5 s (the web grows ring by ring while it works; the hero can interrupt it by hitting it or tearing the half-made web). Then it moves on and repeats, up to 3 webs per Weaver. |
| While spinning | It holds still and is an easy target, but its new web catches darts: each strand absorbs a dart unless it is the Web-Cutter |
| Points | 200; +80 for interrupting a web half-spun ("Unravelled!") |
| Intro | The room's first Weaver appears alone on the gallery rail after the first kill, spinning slowly (5 s) so the player sees what it does |

### A1 [ART] — Painting, light, props

| Item | Spec |
|---|---|
| Bookcases | Dark oak with carved uprights; books with **varied spines** (heights, thicknesses, colours from the palette, gold tooling as thin lines), some leaning, some laid flat, small busts and a clock between them; dirty: gaps where books fell, dust on every top edge |
| Gallery | A narrow walkway with a turned brass rail and balusters, catching the lamp light |
| Ladder | Oak ladder with a brass hook rolling on a brass rail, wheels at the foot |
| Banker's lamp | Brass base, **green glass shade** that glows; dirty: flickers greenish; clean: warm light under the green glass — the room's signature light |
| Globe | Painted continents (invented, softly stylised so nothing reads as an exact map), lit from inside once clean, a brass meridian |
| Leaded window | Diamond panes with lead cames, one cracked when dirty; moonlight shaft broken into a **diamond pattern** on the floor |
| Desk | Leather top, inkwell, pen, a magnifying glass, a stack of letters, the **diary** (story): dirty: closed under dust; clean: open, Eleanor's handwriting on the page, the sentence of the story object legible in a 2× crop |
| Armchair | Cracked brown leather, a reading lamp with a fabric shade |
| Diary pages (collectibles) | Torn pages with a few handwritten lines; they glint softly when free |
| Dirty → clean (≥ 4) | Fallen books → shelved; dust sheet on the armchair → removed; cracked pane → whole; scattered letters → stacked; the globe dull → lit |
| Trace of the previous cleaner | A notebook left open on the desk with a hand-drawn **map of the house** and the Attic circled three times. Clean: closed, the pencil laid on top |
| Web Weaver art | Its long front legs visibly "weave": they alternate drawing silk from the spinnerets to the new strands |

## QA (ART-DIRECTION §15)

URL `game/index.html?qa=1&room=study`. [LOGIC]: play through on the blockout: push the ladder, reach the gallery, free and collect the three pages, interrupt a Weaver, new-web fairness, makeover timing. [ART]: at least 3 critique rounds against `reference/screens/` and `review/current/`, 5 biggest gaps per round in NOTES (typical: books as uniform stripes, the gallery invisible, the green lamp too weak, the diamond light as a grid of dots).

## Deliverable — then STOP

1. `saveHero(page, 'study', …)`: `dirty`, `action`, `weaver`, `makeover`, `clean`, `results`.
2. `makeSheet('13-study', …)`: dirty, weaver, action, makeover, clean, results.
3. `writeSummary('13-study', …)`: what was built, decisions, the `addWeb` rule and its regression result, runtime requests, checks (no console errors; perf mean/p95 in `action` and `makeover`), audit, and who did [LOGIC] and [ART].
4. `node review.mjs gallery`. Then stop.
