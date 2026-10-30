# Prompt 12 — Weapons, pickups and unlocks

## Who did what (Pembagian kerja, `briefs/12-weapons.md`)

**Gemini 4 Argon** refused on quota at 22:46 (it resets in about 143 h). **Gemini 3.8 Flash** refused at 22:47 (about 1 h 10 min).

The owner's rule: while Agy waits, `engineer` takes one bounded piece, and then Agy is checked again.

| Part | Done by |
|---|---|
| **L1 core:** the registry, `vacuum.js` moved out unchanged, world services (`tearSilk`, `snipThread`, `hitBody(…, damage)`), the damage model (`health`), switching with 1/2/3, Q/E and the wheel | **engineer (sonnet)**, while Agy was out of quota (`briefs/12-weapons-L1-core.md`) |
| **The rest of L1, plus L2, L3 and L4:** the Web-Cutter, Foam Spray, Flamethrower and Sonic Pulse; unlocks with save migration; one box per room; three snips → Sonic Pulse; coins; the HUD fan; Controls; the checks; the QA states | **Agy, Gemini 3.8 Flash** (`-Scope logic`), from Opus's continuation prompt `prompts/12-weapons-rest.md`, 23:58–00:53 |
| **A1–A3 [ART]:** the held models, the effects, the boxes and pickups, the HUD tags, the "Found:" label | **Opus** |
| **Small [LOGIC] fixes found in review** | **engineer**, four briefs (below) |
| **Reading Agy's results, perf, renders, audit** | **qa-scout (haiku)** |

## As built

| Weapon | Key | How you get it | Resource | What it does |
|---|---|---|---|---|
| Vacuum Blaster | 1 | always | pressure, 0.2 s | dart at 1700 px/s, 1 damage, 1.2 s life; unchanged |
| Web-Cutter | 2 | first Living Room clear | pressure, 0.32 s | spinning blade on a rising arc, 1.1 s life; tears silk 50 px round its path, snips threads, 0.5 damage |
| Foam Spray | 3 | first Dining Room clear | tank: −22 %/s firing, +12 %/s resting | 40° cone, 260 px; pops eggs and hatchlings; slows big spiders 50 % for 2 s |
| Flamethrower | (pickup) | crate in the Kitchen and the Master Bedroom | 8 s timer | 30° cone, 360 px; burns webs; the only weapon while it lasts, then the previous one returns |
| Sonic Pulse | F | crate in the Upstairs Hallway; three snips in 8 s | 1 charge (max 1) | one ring across the room; clears critters, bosses take 25 % |

**Boxes** (x, y = floor 935 unless said; Opus moved six of them out from under the HUD):

| Room | x | contains |
|---|---|---|
| front-porch | 330 | coins |
| living-room | 1260 | coins (not in a fresh Living Room, to keep the regression) |
| family-room | 1300 | coins |
| kitchen | 1180 | flamethrower |
| dining-room | 1470 | coins |
| downstairs-bathroom | 1320 | coins |
| upstairs-hallway | 1000 | sonic |
| master-bedroom | 380 | flamethrower |
| kids-bedroom | 1200 | coins |
| study (13) | 600, on the gallery (y 560) | coins |
| upstairs-bathroom (14) | 1570, on the cupboard shelf (y 620) | sonic |

**QA states for the sheet:** `cutter-arc`, `nest-foamed`, `flame-web`, `sonic-pulse`, `box-burst`, `hud-fan`.

## [ART] by Opus

- **Held models (`hero.js`).** Each is as slim as the blaster where it passes the head, so the face stays clear at every aim.
  - Web-Cutter: a steel launcher with a notched muzzle and a brass drum on top, its blades turning.
  - Foam Spray: a fat cream canister with a hand pump, a level window that shows the tank, and a hose to a wide flat nozzle.
  - Flamethrower: a dented copper tank, a brass fitting, a pilot flame at the nozzle, and wavy heat strokes.
- **Effects (`weapons/*.js`).**
  - The blade: a four-point steel star with concave honed edges, a bright edge, a hub and a brass rivet, plus a three-copy trail.
  - Foam: creamy lumps of three rounds with a darker underside and bubbles. Stuck, they flatten into splats that shrink, fade and pop.
  - Flame: nine flickering tongues in four layers (amber haze, ember body, dawn, a pale core) with curling embers.
    - It is also a moving warm light: a cone along the aim, a pool, and a wash round the hero, plus a pilot light while it is held.
    - It catches at once and dies down over half a second.
  - Sonic Pulse: a wavering bright edge, a band of disturbed air behind it, and dust kicked up where it meets the floor.
- **Boxes and pickups (`room-runtime.js`).**
  - A dusty cardboard box with tape, a stencilled arrow and "THIS WAY UP", or a nailed crate with a brace and "KEEP DRY" in the Kitchen and the Master Bedroom.
  - It cracks per hit, and each state is painted once as a sprite.
  - It bursts into six flying flaps or splinters with rolling dust, then lies open and flattened on the floor.
  - Pickups are sprites: a copper tank with a gauge, a brass bell, a paper bag with a coin. Each has a shadow that shrinks as it bobs, and a star glint once a second.
- **HUD (`hud.css`).**
  - The fan: the other unlocked weapons' tags peek above and behind, each turned, and the active tag grows slightly only when there is a fan.
  - Ink drawings of each weapon on the tags.
  - A glass-fronted foam tank with a meniscus.
  - A twisted fuse with a spitting ember.
  - A swaying brass bell with "F" written on it.
- **Results card (`screens.js`, `hud.css`).** "Found: …" is a slanted paper label tied to an ink sketch of the item.

## Review findings, all fixed

1. **The Flamethrower never drew.** It read `window.Spyder.world`, which does not exist. Fixed by **engineer**.
2. **The HUD fan.** The Vacuum never peeked, the main icon never showed, the pressure dots stayed visible for the tank and the timer, and "Found:" showed on every clear. Fixed by **engineer**.
3. **The peeking tags were drawn behind the game canvas.** Their negative `z-index` came from the blockout. Fixed by **Opus**.
4. **`.card__unlock`'s `display: flex` beat `[hidden]`,** so "Found: Web-Cutter" showed on every results card. Fixed by **Opus** in CSS.
5. **QA `nest-foamed` fired for one frame only,** so there was no foam. QA `sonic-pulse` swapped the held weapon. The `hover` string spider's legs stretched. Fixed by **engineer**.
6. **Sonic Pulse `world.shake(16)`** threw the screen about by roughly ±1280 px. **Opus** set it to 0.5; the strongest other shake is 0.6.
7. **Six boxes sat under the weapon tag or the nerve gauge.** **Opus** chose the new positions; **engineer** applied them.
8. **Stray `game/tools/living-room/*.png`** came from `regress.mjs living-room`. Deleted, and the trap is noted in `CLAUDE.md`.

## Checks

- **Regression, with only the Vacuum unlocked:** `regress.mjs` reports the Living Room canvas identical to the reference in every state.
- **`checks.mjs`:** all **71** pass, including the sections on weapons, dynamic webs and the "Found:" banner.
- **`flowtest.mjs`:** all **101** pass, over the eleven built rooms, with storage both normal and blocked.
- **Perf:**
  - Kitchen `action`: mean **3.35 ms**, p95 **5.30 ms** (`perf.mjs`, by qa-scout).
  - Kitchen with **the Flamethrower firing continuously and foam on screen**: step + render mean **2.63 ms**, p95 **3.10 ms** (Opus, over the frames before the burnt room starts its makeover). `perf.mjs` has no mode for this.
  - The budget is 8 ms.
- **Console:** no errors in any of the six sheet renders, or in the hero shots.
- **`review.mjs audit`:** clean.

## Open, not fixed here

- **A one-off hitch of about 190–230 ms when some rooms start their makeover** (Kitchen, Study; not the Living Room or the Kid's Bedroom), measured by stepping frames after `clearRoom()`. Where it comes from is not yet established.
- **`?room=kitchen&art=off` throws `world.live.noise is not a function`.** The Kitchen's `room.js` needs `live.noise`, and only its art's `createLive` provides it. This was there before this prompt.
- **The main tag's `aria-label` still says "Weapon: Vacuum Blaster"** whatever weapon is held.

**Claude Code review:** approved. All five weapons read on the sheet: the blade through the web, the foam on the eggs, the flame lighting the bedroom, the ring in the hallway, the crate bursting. The fan of tags and the bell read in the 2× crop, and "Found: Web-Cutter" shows on the first Living Room clear only.
