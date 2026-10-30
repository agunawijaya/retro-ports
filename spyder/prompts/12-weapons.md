# Prompt 12 — Weapons, pickups and unlocks

You are working on the Spyder web game in `E:\Projects\retro-ports\spyder`. **Runs alone** (it changes the shared runtime and touches every room's data). Sections are tagged **[LOGIC]** or **[ART]** (`prompts/CLAUDE-CODE.md`, "Model policy"); if you were told to do only [LOGIC], give every weapon, projectile, pickup and HUD tag a plain blockout look and leave the [ART] sections untouched.

## Why

Nine rooms are built and every one is played with the same Vacuum Blaster. `DESIGN.md` §7 describes three swappable weapons and two temporary bonus weapons; none exist yet. This prompt adds them, in a way the rooms of Act 3 can design around.

## Read first

`DESIGN.md` §7, §8; `ART-DIRECTION.md` §3, §6, §8 (weapon rule: never cover the face), §11 (UI), §15 incl. "Where images go"; `game/NOTES.md`; `game/lib/room-runtime.js` (darts, scoring, combo), `game/lib/hero.js` (`drawBlaster`, `pivotLocal`, `muzzle`), `game/lib/hud.js`, `game/lib/progress.js`, `game/lib/screens.js`, `game/index.html`, `game/css/hud.css`.

## Rules

Plain scripts, global `Spyder`, opens from disk, no network. No per-frame blur. Palette only; saturation only from light. Humanized code. Images only through `review.mjs` or `.scratch/`; `audit` clean; `.scratch/` emptied at the end. No git commits.

**Nothing may change for a fresh save in the Living Room** with only the Vacuum Blaster: `regress.mjs` must still report it identical to the reference in every state.

---

## L1 [LOGIC] — A weapon system

New folder `game/lib/weapons/`: `registry.js` (`S.weapons.register(def)`, `S.weapons.get(id)`), one file per weapon, loaded from `index.html`. A weapon definition:

```js
S.weapons.register({
  id: 'web-cutter',
  name: 'Web-Cutter',
  kind: 'default',          // 'default' (swappable, permanent) | 'bonus' (temporary)
  resource: 'pressure',     // 'pressure' (cooldown dots) | 'tank' (meter that drains and refills) | 'timer' | 'charges'
  fire(world, hero, aim) {}, // spawn projectiles / effects
  update(world, dt) {},      // its projectiles, tank refill, timers
  draw(ctx) {}, glow(ctx, light) {}, lights(lightMap) {},
  heroModel: 'cutter',       // which held model hero.js draws
});
```

The existing dart code moves into `weapons/vacuum.js` **unchanged in behaviour**. Darts, silk tearing, snipping, hits, combo and score keep working through the same world services.

### The weapons

| Weapon | Kind | Fire | Resource | Strong against | Weak against |
|---|---|---|---|---|---|
| **Vacuum Blaster** (exists) | default | Straight fast dart | Pressure, 0.2 s | Everything, all-rounder | — |
| **Web-Cutter** | default | A spinning blade that flies on a **rising arc** (starts along the aim, curves upward, 1.1 s life), passes through silk | Pressure, 0.32 s | **Silk**: tears every strand along its whole path plus 50 px around it; snips any thread it crosses (counts as a snip, bonus) | Bodies: 0.5 damage (big spiders need two hits) |
| **Foam Spray** | default | A **short cone** (range 260 px, 40°) of foam blobs that stick where they land and fade in 4 s | Tank: drains 22 %/s while held, refills 12 %/s when not firing; empty = a 1 s sputter | **Eggs and hatchlings**: pops every egg sac and hatchling in the cone; wall eggs too; damages nests | Big spiders: slows them 50 % for 2 s, 0.25 damage per 0.1 s |
| **Flamethrower** | bonus | A cone of flame (range 360 px, 30°), continuous | Timer: 8 s from pickup | Everything: high damage, **burns webs instantly** | Ends fast; cannot be swapped away and back |
| **Sonic Pulse** | bonus | One expanding ring from the hero across the whole room | Charges: 1 per pickup, key **F** | Clears every spider, hatchling and egg on screen once (bosses take 25 % of their health) | One use |

Damage model: spiders get `health` (string 1, crawler 1, jumper 1, egg carrier 1, hatchling 1; later bosses more). The Vacuum dart does 1. Existing behaviour stays identical because every current type dies to one dart.

### Switching and keys

- **1 / 2 / 3** select Vacuum / Web-Cutter / Foam Spray; **Q / E** or the **mouse wheel** cycle; **F** fires a Sonic Pulse charge. Locked weapons are skipped.
- Switching takes 0.18 s (the hero swaps the held model with a small flourish); no firing during it.
- While a Flamethrower is active it is the only weapon; when its timer ends, the previous weapon returns.
- Update the How-to-play card and the start-card key strip (keep the 4-column layout; add a fifth column "Weapons · 1 2 3 / Q E").

## L2 [LOGIC] — Unlocks and pickups

- **Unlocks** (permanent, in `progress.js`): the **Web-Cutter** is unlocked when the Living Room is first cleared; the **Foam Spray** when the Dining Room is first cleared. The results card shows "Found: Web-Cutter" / "Found: Foam Spray" with the item (see A3). Existing saves are migrated: anything already cleared grants its unlock on load.
- **Breakable boxes:** add `layout.breakables: [{ x, y, contains }]` to every built room's data (`contains`: `'flamethrower'`, `'sonic'` or `'coins'`). A box takes 3 hits from any weapon, bursts open with dust and splinters, and drops its item (a pickup that floats and glints; walk into it to take it). Place **one** box per room on the floor or a platform where it does not block a jump path; contents: `flamethrower` in the Kitchen and the Master Bedroom, `sonic` in the Upstairs Hallway, `coins` elsewhere. List the positions in the summary. Rooms built later declare their own.
- **Mini-objective for a Sonic Pulse:** in every room, the first time the player **snips 3 threads within 8 s**, a Sonic Pulse charge is awarded ("Three snips! Sonic Pulse"). Max 1 charge held.
- **Coins:** a box with coins adds 50 to a persistent `coins` total in progress (spent later, in the gamification pass). Show the total on the results card ("Coins +50").

## L3 [LOGIC] — HUD and settings

- The luggage tag (bottom right) becomes a **small fan of tags**: the active weapon's tag in front, the other unlocked weapons peeking out behind it, tilted. Each tag shows its resource: dots for pressure, a liquid level for the tank, a burning fuse for the timer. A Sonic Pulse charge shows as a small brass bell clipped to the tag's string, with "F" handwritten.
- With only the Vacuum unlocked, the tag must look **exactly** as today (regression).
- Settings → Visual: no change. Settings → Controls: list the weapon keys.

## L4 [LOGIC] — Checks

- `checks.mjs`: switching (keys, wheel, Q/E, locked skipped), tank drain/refill, Web-Cutter tears silk and snips, Foam pops eggs and hatchlings in the cone and not outside it, Flamethrower timer and return to the previous weapon, Sonic Pulse clears the room once, box takes 3 hits and drops its item, unlocks granted and migrated, mini-objective awards one charge.
- `flowtest.mjs` still passes for every room; `regress.mjs` identical for the Living Room.
- `perf.mjs`: Kitchen `action` with the Flamethrower firing continuously and Foam blobs on screen — report mean and p95 (budget 8 ms).

---

## A1 [ART] — Held models (in `hero.js`, keeping the face clear in every aim direction)

| Weapon | Model |
|---|---|
| Vacuum | Unchanged |
| Web-Cutter | A brass-and-steel launcher with a round drum on top holding spinning blades, a short barrel with a notched muzzle |
| Foam Spray | A pump-action sprayer: a fat cream canister with a hand pump, a flexible hose to a wide flat nozzle; the canister's level window shows the tank |
| Flamethrower | A dented copper tank with a pilot flame at the nozzle (a small live light) and heat shimmer (drawn as faint wavy strokes, no blur) |

## A2 [ART] — Effects

- **Web-Cutter blade:** a spinning four-point star of steel with a bright rim and a motion trail of 3 fading copies; tiny silk fibres burst where it cuts.
- **Foam:** creamy blobs with a soft highlight and darker underside, landing as splats that hold their shape, slowly shrink and fade; small bubbles pop on them.
- **Flame:** layered gradient tongues (amber haze, ember body, pale core) streaming along the cone with sparks; the cone is a **moving warm light source** in the light map; burnt silk curls into embers.
- **Sonic Pulse:** a translucent ring of air with a faint shimmer edge expanding from the hero, dust kicked up along it, a brief bass thump.
- **Boxes:** a dusty cardboard box with a stencilled arrow and tape (or a small wooden crate in the Kitchen and Bedroom); cracks on each hit; a satisfying burst of cardboard flaps and dust.
- **Pickups:** the item floating with a slow bob, a soft glint every second and a small shadow; a Flamethrower pickup is a little copper tank, a Sonic Pulse a brass bell, coins a small paper bag with a coin peeking out.

## A3 [ART] — HUD and cards

- The fan of luggage tags (L3): each tag with the weapon's name in Fraunces and a small ink drawing of it; the active tag in front, slightly larger.
- "Found:" on the results card: a small paper label tied to the item's ink drawing, slightly rotated, in the same style as the story-object line.

## Deliverable — then STOP

1. `makeSheet('12-weapons', …)`, six cells: the Kitchen `action` with the Web-Cutter blade mid-arc through a web; the Dining Room nest being foamed; the Master Bedroom with the Flamethrower burning a web (its warm light on the room); the Sonic Pulse ring mid-expansion in the Hallway; a box bursting with a pickup; the HUD fan of three tags plus the bell (2× crop) and the "Found: Web-Cutter" results card.
2. `writeSummary('12-weapons', …)`: the weapon table as built, unlock and box positions per room, check counts, regression result, perf, audit, and who did [LOGIC] and [ART].
3. `node review.mjs gallery`. Then stop.
