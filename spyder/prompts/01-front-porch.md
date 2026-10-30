# Prompt 01 — Room 1: the Front Porch (tutorial)

You are adding Room 1 to the Spyder web game in `E:\Projects\retro-ports\spyder\game\`. This prompt is written for any coding agent (Claude Code, Codex, Gemini, Kimi). Follow it literally; where something is unclear, choose the option closest to the reference scene and write the decision in `game/rooms/front-porch/NOTES.md`.

**Precondition:** prompt 00 (game shell) has run and the owner approved its hero frames. If `game/lib/room-runtime.js` or `game/rooms/living-room/room.js` does not exist, **stop and report** — do not build the shell yourself.

## Read first (completely)

1. `ART-DIRECTION.md` — binding. §3 palette, §4 painterly technique, §5 composition minimums, §6 lighting, §9 webs, §10 makeover, §15 QA loop, §16 checklist, §17 room bible (row 1).
2. `DESIGN.md` §5 (rooms) and §8 (gameplay).
3. `game/NOTES.md` and the room interface in `game/lib/room-runtime.js`.
4. `game/rooms/living-room/room.js` — **your template**. Your room file has the same shape, the same painting helpers, the same light rig pattern.
5. `reference/screens/*.jpg` — the quality bar. Your frames must look like the same game.

## Hard rules

- Only create files under `game/rooms/front-porch/`. The only shared edit allowed is **one `<script>` line** in `game/index.html` for your room file — re-read `index.html` immediately before editing and insert only that line (another session may be editing it).
- Do not modify `game/lib/`, `reference/`, or other rooms. If the runtime lacks something you need, write it in your NOTES as a request and work around it inside your room file.
- Paint with `S.paint` (`paintShape`, `wobblyPath`, `softShadow`, `stain`) — **no flat fills, no ruler-straight organic edges**. Every surface larger than 100 × 100 px uses `paintShape` with brush strokes.
- Palette only (ART-DIRECTION §3). Saturation comes only from light.
- No per-frame blur. Paint static art once into the `dirty` and `clean` cached layers.
- Humanized code, seeded randomness. No git commits.

## The room

An **exterior**: the front porch of the house at night, seen from the front yard. It is the first thing the player sees, so it sets the tone: cozy-creepy, the house waiting.

### Layout (stage units, 1920 × 1080)

| Element | Position | Notes |
|---|---|---|
| Porch ceiling | y 0–120 | Painted beadboard (thin parallel boards) with a deep shadow line; gutter edge at the very top. Spiders drop from y = 120 (`CEILING`). |
| House facade | y 120–770 | Clapboard siding: horizontal overlapping boards 34 px tall, each with a lit top edge and a shadow lip; paint `#5F6A6E`-ish (mix `taupe` + `moon`), peeling in patches when dirty. |
| Front door | x 870–1050, y 330–770 | Panelled door with a **stained-glass transom** (x 870–1050, y 270–325) in muted amber/plum/moss segments. Brass knob and knocker. Dirty: paint flaking, door shut. |
| Name plate | x 925–995, y 300 (above the door, under the transom) | Brass oval plate engraved **ASHWORTH**. Dirty: tarnished, letters barely readable. Clean: polished and readable — this is the **story object**. |
| Windows | Left x 380–620, right x 1280–1520, y 270–560 | Six-pane sash windows with shutters. Inside: dark room silhouettes (a lamp shape, curtain). Dirty: right window's left shutter hangs askew from one hinge; glass grimy. |
| Porch columns | x 150–200 and x 1720–1770, full height | Turned wooden posts with a lit edge from the lantern; they frame the scene. |
| Porch floor | y 770–1000 | Floorboards running toward the viewer (one-point perspective, as the reference floor). |
| Front steps | y 1000–1080 | The top edges of two steps, darker, in the front layer. |
| Far layer (behind/around the house edges, above the porch roof line on both sides, x 0–150 and x 1770–1920) | — | Night sky, moon (upper left), bare tree silhouettes, a neighbour's roofline with **one lit window** far away, a street lamp on the far right. Parallax like the reference window view. |

### Platforms (≥ 3)

| Platform | Spec |
|---|---|
| Floor | y = 935, full width |
| **Porch swing** | Seat x 300–620, y 800, hung from the ceiling on two chains. **It sways** when the hero lands on it (damped swing, ±8 px, 1.6 s period), and the platform moves with it. |
| Planter box | x 1300–1460, top y 820 (dead geraniums dirty / blooming clean) |
| Side railing | x 1560–1840, rail top y 760 (balusters below) |

### Lights (≥ 3 + head lamp)

| Light | Spec |
|---|---|
| **Porch lantern** | Hangs on a short chain from the ceiling at x 1150, glass box y 150–230. Warm `amber` point + downward cone. **Swings slowly** (±0.08 rad) and **flickers** while dirty; the cone and its shadows swing with it. Glow on the glass. |
| Moonlight | Broad cool spill from the upper left (point light at x –200, y –200, radius 1400, `moon`, 0.55), plus a visible soft beam slanting down across the left porch. |
| Street lamp (far) | Small warm glow far right in the far layer; weak contribution (0.2) to the right edge of the porch. |
| Off until the makeover | The **transom** glows from inside; then the **front door opens a crack** and a warm wedge of light spills across the porch boards; then both **windows light up** warm. |

### Webs (≥ 6)

Corner fans at both top corners (column ↔ ceiling), a big web across the upper half of the right window, one from the lantern chain to the ceiling, one between the swing chain and the ceiling, one in the planter box corner, an orb web between the left column and the facade.

### Dirty → clean (≥ 4, plus story and trace)

1. Name plate tarnished → polished **ASHWORTH** (story object, named on the results card: "The name above the door: Ashworth.")
2. Shutter hanging askew → straight
3. Door paint flaking grey → deep moss green, brass shining
4. Hanging fern basket dead and brown → full and green
5. Welcome mat dusty with letters half-hidden → clean "WELCOME"
6. Planter: dead geraniums → blooming (muted coral, not neon)
- **Trace of the previous cleaner:** a pair of yellow rubber gloves and an old pump sprayer left by the door, dusty. They stay in the clean state (moved neatly to the side).

### Unique makeover beat

At t = 3.4 s: the lantern stops swinging and settles, then the **front door swings open a crack** (door rotates in 0.8 s, warm light wedge sweeps across the floor), then the windows light up one after another (0.3 s apart). The night sky in the far layer turns to dawn with the shared beat.

## Gameplay: the tutorial

Room 1 teaches the game. `rules`: `quota: 8`, `webGoal: 0.8`, `types: ['string']` (no wall crawlers yet; eggs and hatchlings yes), `spawnInterval: [3.2, 2.0]`, `maxAlive: [2, 3]`.

Tutorial steps appear as **handwritten notes on small paper tags**, pinned to the left column at eye level of the hero (diegetic, Caveat font, ink colour `#3b2a6a` like the start letter). One note at a time; each disappears with a small tear-off animation when its action is done. The notes are from "A." — the relative who wrote the letter.

| # | Note text (write your own wording in this spirit) | Done when | Scripted setup |
|---|---|---|---|
| 1 | "Walk the porch. A and D." | Hero moved 300 px | — |
| 2 | "The swing will hold you. W to jump." | Hero lands on the swing | — |
| 3 | "There's one above you. Aim and click." | First spider killed | One String Spider descends and hovers above the swing; it does not lunge or drop eggs |
| 4 | "The thread is weaker than the spider." | A silk snipped | A second spider hovers high (y ≈ 300) |
| 5 | "Tear the webs down too. The house remembers." | Any 15 strands torn | — |
| 6 | "Little ones. Land on them." | A hatchling stomped | An egg drops and hatches 2 hatchlings near the hero (they move at 60 % speed) |
| — | Free play to finish the quota | | Normal director |

The tutorial is skippable (**Tab** — shown as a small "Tab: skip the notes" in pencil under the note) and is automatically skipped when the room has been cleared before (progress).

## QA loop (mandatory — ART-DIRECTION §15)

Add the room's QA states to `game/tools/shoot.mjs` usage: `?qa=1&room=front-porch` with `setup('dirty'|'action'|'makeover'|'clean'|'results')` plus `setup('tutorial')` (note 3 visible, spider hovering above the swing, hero on the swing aiming up).

Every round: render all states, put them side by side with `reference/screens/` (dirty with dirty, action with action, clean with clean), list the **5 biggest quality gaps** in `game/rooms/front-porch/NOTES.md` (typical: flatter shading, missing rim light on columns, siding looks like stripes instead of boards, lantern light too weak or too uniform, far layer empty, porch floor reads as a plain band), fix, render again. **At least 3 rounds.** Then play the room start to finish once (tutorial included) and confirm the flow: notes → free play → makeover → results → map shows CLEAN.

## Hero-frame checkpoint — STOP here

Save to `game/rooms/front-porch/screens/` at 1920 × 1080: `dirty.png`, `tutorial.png`, `action.png`, `makeover.png`, `clean.png`.

Stop and report: files created, the one line added to `index.html`, the QA notes per round, and the five frames. **Do not continue to another room.**

## Acceptance (ART-DIRECTION §16 plus)

- [ ] All 15 checks of ART-DIRECTION §16
- [ ] Exterior reads instantly as "a porch at night": facade, door, windows, columns, sky, lantern
- [ ] Swing platform sways and carries the hero
- [ ] Lantern swings and flickers; its light and shadows move with it
- [ ] Tutorial notes diegetic, one at a time, skippable, auto-skipped on replay
- [ ] Unique beat: door opens a crack with a warm light wedge, windows light up
- [ ] Results card names the story object (Ashworth)
- [ ] No console errors; ≤ 8 ms/frame on GPU canvas; no per-frame blur
