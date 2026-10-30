# Brief 12-L1-core — the weapon system's core (for `engineer`)

This is one bounded piece of `prompts/12-weapons.md`, done while Agy is out of quota. Read the prompt's **L1** whole, plus `DESIGN.md` §7, `game/NOTES.md`, and the files named below. Everything else in prompt 12 goes to Agy afterwards.

## Pembagian kerja

- **engineer (you):** this brief only, which is the core of L1.
- **Agy:**
  - the four new weapons;
  - L2: unlocks, boxes, the mini-objective and coins;
  - L3: the HUD fan, settings and the how-to-play card;
  - L4: the remaining checks.
- **Opus:** all [ART], and the review of this piece.
- **qa-scout:** re-runs the checks after the review.

## Build

1. **`game/lib/weapons/registry.js`:**
   - `S.weapons.register(def)`, `S.weapons.get(id)` and `S.weapons.list()`.
   - A definition has the fields in the prompt's L1: `id`, `name`, `kind`, `resource`, `fire`, `update`, `draw`, `glow`, `lights`, `heroModel`.
   - Load it, and each weapon file, from `game/index.html`, before `room-runtime.js` needs them.
2. **`game/lib/weapons/vacuum.js`:**
   - The Vacuum Blaster: the dart code moved out of `room-runtime.js` (`fire()`, `updateDarts()`, `drawDarts()`, `drawDartGlow()`, and the dart line in the light pass) **unchanged in behaviour and look**.
   - Keep the same numbers: `DART_SPEED`, `FIRE_RATE` 0.2 s, the 1.2 s life, the hit radius `+ 6`, the score values, the sounds, `burst.airPuff`, recoil, `hero.feel`, and the `'fire'`, `'dart'`, `'tear'` and `'kill'` events.
   - Its resource is `'pressure'`: `hero.charge` and `hud.setCharge` are as today.
3. **World services in `room-runtime.js`,** so that a weapon can do what the dart code does today without reaching into the closure:
   - tear silk along a segment, with the same scoring and fibres, and the `'tear'` event;
   - snip a dangling spider's thread (the `'Snip!'` bonus);
   - hit a body;
   - `award`, `bumpCombo` and `breakCombo`;
   - `emit`, `burst`, `audio`, `shake` and `stats`.

   Name them clearly and list them in `game/NOTES.md`.
4. **The damage model:**
   - Every critter has `health`, 1 by default for every current type.
   - A hit does `damage` (the Vacuum dart does 1). A critter dies only when its health reaches 0, through exactly the same kill bookkeeping as today: quota, eggs, combo, `award`, sound, shake and the `'kill'` event.
   - A critter that is hit but survives gets a small hit reaction. The rig's existing `flash` is enough; no new art.
5. **The current weapon and switching:**
   - The runtime keeps a current weapon, and `fire`, `update`, `draw`, `glow` and `lights` go through it.
   - **Keys 1 / 2 / 3** select Vacuum / Web-Cutter / Foam Spray. **Q / E** and the **mouse wheel** cycle.
   - A weapon that is not registered or not unlocked is skipped. Read the unlock state through one small function, e.g. `S.weapons.isUnlocked(id)`: the Vacuum is always unlocked, and the others read `S.progress` (L2 fills it later; until then they are locked).
   - A switch takes 0.18 s, and nothing fires during it.
   - `hero.heroModel` follows the weapon. `hero.js` draws `'vacuum'` with the existing `drawBlaster`, untouched. Any other model, for now, falls back to `drawBlaster` too; Opus paints the real models later.
6. **Checks:** add to `game/tools/checks.mjs` a section "weapons (L1 core)" that tests:
   - the registry holds `vacuum`;
   - with only the Vacuum unlocked, 1, 2, 3, Q, E and the wheel all leave it selected;
   - with a test weapon registered and unlocked inside the test page, switching works, locked ones are skipped, and nothing fires during the 0.18 s;
   - a critter with `health: 2` survives one dart and dies on the second.

## Do not

- Build the Web-Cutter, Foam, Flamethrower or Sonic Pulse.
- Touch the HUD's look, unlocks or progress saving, boxes, pickups, coins, the how-to-play card or settings.
- Make any visual or gameplay decision. If the prompt is unclear on one, stop there and report the question.
- Edit `DESIGN.md`, `prompts/` or this brief.
- Commit anything.
- Write images anywhere except `.scratch/`, and empty it when done.

## Done when

Run these **one at a time**, never in parallel, from `game/tools/`:

- `node regress.mjs`: `REGRESSION: canvas identical to the reference in every state`;
- `node checks.mjs`: `all checks passed`, with the new section included;
- `node flowtest.mjs`: `all checks passed`;
- `node review.mjs audit`: exit 0, with `.scratch/` empty.

Quote their key lines in the report. Aim to finish in about an hour. If it grows beyond that, stop at a working, passing state and report what is left.
