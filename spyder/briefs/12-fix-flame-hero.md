# Brief 12-fix — the Flamethrower never draws (for `engineer`)

This is a small fix found by Opus while reviewing prompt 12 (`prompts/12-weapons.md`, built in `prompts/12-weapons-rest.md`).

## Pembagian kerja

- **engineer:** this fix only.
- **Opus:** the flame's look, which it paints afterwards in the same file; and the review.
- **Agy:** not needed.

## The defect

`game/lib/weapons/flamethrower.js` reads the hero from `window.Spyder?.world?.hero`, in `draw` (line ≈118), `glow` (≈180) and `lights` (≈191). Nothing ever sets `S.world`; grep confirms it.

So `hero` is always undefined, and the flame cone, its glow and its light never appear. The logic (timer, damage, burning webs) runs in `fire` and `update`, which get `world` and `hero` as arguments. That is why the checks pass.

## Do

- In `flamethrower.js` only: keep a reference to the hero from the calls that receive it (`fire(world, hero, aim)` and/or `update(world, dt)`, where `world.hero` exists). Use that reference in `draw`, `glow` and `lights`. Do not introduce a global.
- Clear it in `reset()`.
- Do not change the drawing itself (gradients, shapes, numbers). Opus repaints it next.
- Do not touch any other file. Another Gemini session is editing `game/lib/room-runtime.js` for prompt 13.

## Done when

- A headless render of the QA state `flame-web` (`?qa=1&room=master-bedroom`, `__spyder.setup('flame-web')`, wait 750 ms, screenshot) shows the flame cone in front of the hero.
- There are no console errors.
- `node checks.mjs` still says `all checks passed`. Run it alone, with no other browser job running.
- The screenshot goes in `E:\Projects\retro-ports\spyder\.scratch\` only, and is deleted afterwards.

Report the change, with lines, and what the render showed.
