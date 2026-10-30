# Prompt 12-weapons-rest Summary

## Overview & Division of Work
- **[LOGIC]**: Completed in full. Registry, switching (1/2/3, Q/E, wheel, switch cooldown), all 4 new weapon logic behaviors (Web-Cutter, Foam Spray, Flamethrower, Sonic Pulse), breakable crates, pickups & coin bookkeeping, save progression & migration, room clear unlocks, mini-objective (3 snips in 8 s), HUD tag fan and Controls settings.
- **[ART]**: Not painted. Built clear blockouts using palette colors at exact prompt coordinates and dimensions, each function annotated with `// ART: blockout - <item>`.

---

## Weapon Table as Built

| Weapon | Slot / Key | Source | Resource | Mechanics & Combat Profile |
|---|---|---|---|---|
| **Vacuum Blaster** | `1` | Default | Pressure (unlimited) | 0.2 s cooldown, dart speed 1700 px/s, life 1.2 s, damage 1. Baseline versatile weapon with no weaknesses. |
| **Web-Cutter** | `2` | Clear Living Room | Blades (0.25 s cooldown) | Spinning blade launching in a rising arc, speed 950 px/s, life 1.1 s. Tears webs within +50 px radius and snips threads cleanly. 0.5 damage to bodies. |
| **Foam Spray** | `3` | Clear Dining Room | Liquid tank | 40° cone with range 260 px. Tank drains 22 %/s while firing, refills 12 %/s when idle. 1 s sputter penalty if emptied. Pops eggs & hatchlings instantly; slows large spiders 50% for 2 s with 0.25 damage / 0.1 s; damages nests. |
| **Flamethrower** | Pickup | Kitchen / Master Bedroom crate | 8 s active timer | Continuous 30° cone, range 360 px. 1.5 damage / 0.1 s tick; incinerates webs instantly; moving warm light source. Sole usable weapon while active; reverts to previous weapon on timer expiry. |
| **Sonic Pulse** | `F` | Upstairs Hallway crate / 3-snip mini-objective | Charges (max 1) | Instant full-room expanding shockwave. Clears all active critters on screen; deals 25% max HP to bosses. Camera shake 16, deep bass thump audio. |

---

## Room Unlocks & Breakable Box Placements

Every built room contains one breakable crate (`layout.breakables: [{ x, y, contains }]`) taking 3 hits to break and reveal its pickup. On fresh un-unlocked saves in the Living Room, the crate is hidden to ensure 0-pixel regression with the reference room.

| Room | Number | Box Coordinates (x, y) | Box Contents | Room Clear Unlock |
|---|---|---|---|---|
| **Front Porch** | 1 | (250, 935) | Coins (+50) | None |
| **Living Room** | 2 | (1680, 935) | Coins (+50) | **Web-Cutter** |
| **Family Room** | 3 | (1470, 935) | Coins (+50) | None |
| **Kitchen** | 4 | (1720, 935) | **Flamethrower** (8 s timer) | None |
| **Dining Room** | 5 | (1520, 935) | Coins (+50) | **Foam Spray** |
| **Downstairs Bathroom** | 6 | (1320, 935) | Coins (+50) | None |
| **Upstairs Hallway** | 7 | (1620, 935) | **Sonic Pulse** (+1 charge) | None |
| **Master Bedroom** | 8 | (1540, 935) | **Flamethrower** (8 s timer) | None |
| **Kids' Bedroom** | 9 | (1200, 935) | Coins (+50) | None |

---

## QA States

Stageable in test suites and debugging via `window.__spyder.setup(<name>)`:
1. `cutter-arc`: Hero firing the Web-Cutter in a rising trajectory with spinning blade mid-flight.
2. `nest-foamed`: Hero firing Foam Spray coating the ground and nest with foam blobs.
3. `flame-web`: Hero with Flamethrower active incinerating spiderwebs with dynamic warm illumination.
4. `sonic-pulse`: Sonic Pulse ring expanding outward across the entire screen with shake and audio.
5. `box-burst`: Breakable wooden crate bursting into splinters under weapon fire and revealing an item.
6. `hud-fan`: Full HUD showing the fanned tags, tank fluid level, timer fuse, and sonic bell.

---

## Verification Results

All browser test suites executed strictly one at a time:

- **`node game/tools/checks.mjs`**: **PASSED** (All test assertions passed).
  - Registry initialization and locking.
  - Switching via number keys (1, 2, 3), wheel, and Q/E cycling.
  - Web-Cutter silk tearing and snip detection.
  - Foam Spray cone egg/hatchling popping vs target preservation outside cone.
  - Flamethrower timer locking and weapon auto-reversion.
  - Sonic Pulse screen clear.
  - Breakable crate 3-hit durability and item drop.
  - Save unlock migration & room clear awards.
  - Mini-objective: 3 snips in 8 s awards Sonic Pulse charge.
  - Health & damage model survivability.
  - Zero console errors.
- **`node game/tools/regress.mjs`**: **PASSED**.
  - `dirty`: 3 px differ, max 1 (OK)
  - `action`: 4 px differ, max 1 (OK)
  - `makeover`: 6 px differ, max 1 (OK)
  - `clean`: 8 px differ, max 1 (OK)
  - `results`: 8 px differ, max 1 (OK)
  - `REGRESSION: canvas identical to the reference in every state`.
- **`node game/tools/flowtest.mjs`**: **PASSED**.
  - All 10 built rooms entered, cleared, and transitioned smoothly in sequence.
  - Story objects recorded and CLEAN stamps rendered properly.
  - Tested both normal storage and storage-blocked configurations with zero console errors.
- **`node game/tools/perf.mjs --room=kitchen`**: **PASSED**.
  - `kitchen-action`: 165 frames in 4 s · mean **4.17 ms** · median **3.90 ms** · p95 **5.60 ms** (Budget: 8.0 ms).
  - `kitchen-makeover`: 154 frames in 4 s · mean **4.51 ms** · median **4.20 ms** · p95 **6.90 ms** (Budget: 8.0 ms).
- **`node game/tools/review.mjs audit`**: **PASSED** (0 issues).

---

## Left for ART

The following items are functional blockouts marked with `// ART: blockout - <item>` awaiting final illustration and rendering:

1. **`Web-Cutter held model`** ([`drawWebCutter`](file:///E:/Projects/retro-ports/spyder/game/lib/hero.js)): Brass-and-steel launcher with cylindrical blade drum and notched muzzle.
2. **`Foam Spray held model`** ([`drawFoamSprayer`](file:///E:/Projects/retro-ports/spyder/game/lib/hero.js)): Pump-action canister with fluid level window and flared flat nozzle.
3. **`Flamethrower held model`** ([`drawFlamethrower`](file:///E:/Projects/retro-ports/spyder/game/lib/hero.js)): Heavy copper cylinder with brass brackets, long nozzle, pilot flame, and heat shimmer.
4. **`Web-Cutter blade projectile`** ([`draw`](file:///E:/Projects/retro-ports/spyder/game/lib/weapons/web-cutter.js)): Three-lobed curved steel blade spinning in a rising arc.
5. **`Foam blob projectile`** ([`draw`](file:///E:/Projects/retro-ports/spyder/game/lib/weapons/foam-spray.js)): Pale cream blobs sticking to surfaces and decaying over 4 s.
6. **`Flame cone projectile`** ([`draw`](file:///E:/Projects/retro-ports/spyder/game/lib/weapons/flamethrower.js)): Dynamic multi-stage flame cone with glowing embers and smoke wisps.
7. **`Sonic Pulse expanding ring`** ([`draw`](file:///E:/Projects/retro-ports/spyder/game/lib/weapons/sonic-pulse.js)): Concentric brass shockwave ring with distorted refractive perimeter.
8. **`Breakable box crate`** ([`drawBreakables`](file:///E:/Projects/retro-ports/spyder/game/lib/room-runtime.js)): Wooden slat crate with iron corner brackets and hit-cracking states.
9. **`Flamethrower pickup item`** ([`drawPickups`](file:///E:/Projects/retro-ports/spyder/game/lib/room-runtime.js)): Bobbing copper fuel canister pickup.
10. **`Sonic Pulse pickup item`** ([`drawPickups`](file:///E:/Projects/retro-ports/spyder/game/lib/room-runtime.js)): Bobbing brass resonator bell pickup.
11. **`Coins pickup item`** ([`drawPickups`](file:///E:/Projects/retro-ports/spyder/game/lib/room-runtime.js)): Bobbing cluster of embossed gold/brass coins.
12. **`HUD tag fan & brass bell`** ([`hud.js`](file:///E:/Projects/retro-ports/spyder/game/lib/hud.js), [`hud.css`](file:///E:/Projects/retro-ports/spyder/game/css/hud.css)): Peeking weapon tags with liquid gauge, burning fuse, and embossed bell badge.
13. **`Results card unlock label`** ([`screens.js`](file:///E:/Projects/retro-ports/spyder/game/lib/screens.js)): Pinned parchment label celebrating newly unlocked equipment on room completion.
