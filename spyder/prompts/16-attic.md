# Prompt 16 — Room 12: the Attic and the Spider Queen

You are adding Room 12, the last room of Act 3, to the Spyder web game in `E:\Projects\retro-ports\spyder\game\`, with its boss. Where something is unclear, choose the option closest to the reference scene and write the decision in `game/rooms/attic/NOTES.md`.

**Precondition:** prompt 15 (boss framework) is done. **Runs alone.** Sections are tagged **[LOGIC]** or **[ART]** (`prompts/CLAUDE-CODE.md`, "Model policy"); with only [LOGIC], the room runs on the blockout and the Queen on a plain, scaled rig.

## Read first

1. `ART-DIRECTION.md` — §3–§7 (incl. the Queen: scale 2.4, pale crown pattern, slow heavy gait), §9, §10, §15 incl. "Where images go", §16, §17 row 12.
2. `DESIGN.md` §3.3 (Act 3), §6 (Spider Queen: "spawns tiny spiders, takes many hits").
3. `game/NOTES.md`, `game/lib/boss.js` and the "Prompt 15" summary, `game/lib/weapons/`.
4. Templates: `game/rooms/study/` (ladder, gallery), `game/rooms/kids-bedroom/` (projected shadows). Quality bar: `review/current/`, `reference/screens/`.

## Hard rules

- Files: `game/rooms/attic/room.js` ([LOGIC]), `art.js` ([ART]), optional `room.css`; `game/lib/bosses/spider-queen.js` (registered with `S.bosses.register`). Shared edit: `<script>` lines in `game/index.html`. Use the room id the house map uses (`lib/house-map.js`). Do not modify other rooms or `reference/`.
- **Jump reach:** rise ≤ 190 px, gap ≤ 160 px.
- `S.paint` for every surface, palette only, no per-frame blur, static art cached. Images only through `review.mjs` or `.scratch/`; `audit` clean; `.scratch/` emptied. No git commits.

## The room

Under the roof: a pitched ceiling with rafters, a round window boarded up, trunks and a rocking horse under dust sheets, a single bulb on a long cord. The heaviest web density in the house. At the far end, between two rafters, the Queen's nest: a vast funnel of silk. This is where the previous cleaner gave up.

### L1 [LOGIC] — Layout data (also `layout.props`)

| Element | Position (stage units) | kind |
|---|---|---|
| Pitched roof | ridge at x 960, y 60; slopes down to y 520 at x 0 and x 1920; rafters every 220 px | wall |
| Collar beam (a platform) | x 520–1400, y 430 | furniture |
| Round window, boarded | centre (960, 250), radius 110, in the gable wall | window |
| The Queen's nest | a silk funnel from the ridge down to y 380, x 780–1140, in front of the window | furniture |
| Hanging bulb | cord from (700, 100), bulb at y 330 | light |
| Trunks | stack at x 180–460: lower trunk top y 830, upper trunk top y 700 | furniture |
| Rocking horse under a sheet | x 1480–1700, back y 790 | furniture |
| Hatch from the hallway (the way in) | in the floor at x 1760–1880, the ladder's top visible | furniture |
| Floor | y 770–1080, rough boards, insulation showing between joists at the edges | wall |

**Platforms** (every step passes the reach rule):

| Platform | Surface | Reached from |
|---|---|---|
| Floor | y 935 | — |
| Lower trunk | x 190–450, y 830 | floor, 105 up |
| Upper trunk | x 220–420, y 700 | lower trunk, 130 up |
| Box stack | x 470–560, y 560 | upper trunk, 140 up, 50 across |
| **Collar beam** | x 520–1400, y 430 | box stack, 130 up |
| Rocking horse | x 1490–1690, y 790 | floor, 145 up |
| Lower crate | x 1300–1400, y 650 | rocking horse, 140 up, 90 across |
| Upper crate | x 1320–1400, y 520 | lower crate, 130 up |
| (beam again) | y 430 | upper crate, 90 up |

### L2 [LOGIC] — The Spider Queen (`lib/bosses/spider-queen.js`)

Health 60. Phases (from the framework):

| Phase | Health | Behaviour |
|---|---|---|
| **Nest** | 100–66 % | She stays in the funnel; only her head and front legs show, lunging out of the mouth every 3 s (a telegraph: legs spread wide 0.5 s before). Every 6 s she **spits an egg sac** onto the floor (it lands and hatches in 4 s). She takes damage only during a lunge, or from the Web-Cutter tearing the funnel (each blade through the funnel = 1 damage). Regular spawns continue at a low rate. |
| **Descend** | 66–33 % | She drops out of the nest on a thick silk line and **swings** above the room (a pendulum across x 500–1420, period 4 s), laying a row of 3 wall eggs as she passes the gables. **Cutting her line** with the Web-Cutter (or 6 darts on the line) drops her to the floor, stunned for 3 s, taking double damage; then she climbs back up and re-attaches. |
| **Rage** | 33–0 % | She walks the rafters and the collar beam with a heavy, slow gait (the camera shakes lightly at each step), **leaps** at the hero like a Jumper (telegraphed crouch, 0.8 s), and summons 4 hatchlings every 8 s. Foam slows her 30 % (not 50 %). |

- Hits on her legs do nothing; hits on the head and abdomen count. The Flamethrower does 1.5 per tick as usual. Sonic Pulse: 25 % (from the framework).
- Contact or a landed leap: hurt 20.
- **Defeat:** she curls, falls from wherever she is, and the nest collapses in a long tear of silk.
- `rules`: `quota: 12` (regular spiders), `webGoal: 0.8`, `boss: 'spider-queen'`, `bossAt: 4`, `types: ['string', 'crawler', 'jumper', 'webWeaver']`, `spawnPattern: ['string', 'crawler', 'string', 'webWeaver', 'jumper', 'string']`, `maxAlive: [2, 3]`, `spawnInterval: [4.0, 2.6]` (the Queen is the main threat).
- `layout.breakables`: two boxes, one `flamethrower` (on the lower trunk) and one `sonic` (on the collar beam).
- Makeover beats: shared beats, then `window` at 3.3 s (the boards are pulled away from the round window one by one, morning light floods in through it in a round shaft), `bulb` at 4.0 s (the bulb steadies), `sheets` at 4.4 s (the dust sheets slide off the rocking horse and the trunks).
- `storyObject`: "In the nest, an old torch. Engraved on it: 'A. Ashworth'. She was the one who tried before you."
- QA states: `dirty`, `action`, `makeover` (t ≈ 3.9 s), `clean`, `results`, plus `queen-nest` (phase 1 lunge with legs spread), `queen-swing` (phase 2, mid-swing, the hero on the beam aiming the Web-Cutter at her line), `queen-rage` (phase 3, leaping from the beam).
- Webs (≥ 8): between rafters, around the bulb cord, across the boarded window's edges, over the trunks, the rocking horse, the hatch, the collar beam, the gable corners.

### A1 [ART] — The room

| Item | Spec |
|---|---|
| Roof | Rough rafters with grain and nail heads, boards between them, insulation tufts; the slope darkens toward the eaves |
| Round window | Boarded with three uneven planks, moonlight leaking through the gaps as thin blades of light; clean: boards gone, a round shaft of morning light |
| The nest | A huge funnel of layered silk (many translucent sheets, denser toward the core), egg clusters glimmering inside, the window's leaked light making it glow from behind |
| Bulb | A bare bulb on a long cord, dim and swaying; it lights a small cone and the nest's underside |
| Trunks, rocking horse | Leather-bound trunks with brass corners and old travel labels (invented places); a dapple-grey rocking horse under a grey sheet, its ear showing; clean: the sheet off, the horse painted, rocking gently once |
| Dirty → clean (≥ 4) | Boarded window → open; dust sheets → off; webs on everything → gone; a fallen box of Christmas decorations → upright, a little tinsel glints |
| Trace of the previous cleaner (story) | The torch is visible in the nest's wall from the start, a faint metal glint; after the Queen dies it lies on the floor below the collapsed nest, and clean, it rests on a trunk, its engraving readable in a 2× crop |

### A2 [ART] — The Spider Queen

`SpiderRig` at scale 2.4 with her own look: a heavy abdomen with a **pale crown pattern** (a ring of ivory chevrons), a glossy black-plum body with a deep sheen, eight eyes that glint red-amber, thick hairy legs (bristles every 10 px), mandibles that open on lunges. Slow, heavy gait (step 0.28 s). Her silk line is thick and pale. In the bulb's light she casts a huge shadow up the roof (like the Kid's Bedroom). Phase changes show on her: a ragged tear in the abdomen pattern at 66 %, a broken leg tip at 33 %.

## Deliverable — then STOP

1. `saveHero(page, 'attic', …)`: `dirty`, `queen-nest`, `queen-swing`, `queen-rage`, `makeover`, `clean`, `results`.
2. `makeSheet('16-attic', …)`, six cells: dirty, queen-nest, queen-swing, queen-rage, makeover, clean.
3. `writeSummary('16-attic', …)`: what was built, platform numbers, how each phase plays, check counts (no console errors; perf mean/p95 in `queen-rage` and `makeover`, worst makeover frame), audit, who did [LOGIC] and [ART].
4. `node review.mjs gallery`. Then stop.
