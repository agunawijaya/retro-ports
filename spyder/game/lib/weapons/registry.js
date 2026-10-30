/*
 * Spyder — the weapon registry.
 *
 * The room runtime never names a weapon directly; it looks one up here by
 * id (the current weapon, the one a key or the wheel asks for) so a new
 * weapon is one new file in this folder that calls `S.weapons.register(...)`,
 * plus one <script> line in index.html. Nothing in the runtime changes.
 *
 * A weapon definition (prompts/12-weapons.md, L1):
 *
 *   S.weapons.register({
 *     id: 'web-cutter',
 *     name: 'Web-Cutter',
 *     kind: 'default',          // 'default' (swappable, permanent) | 'bonus' (temporary)
 *     resource: 'pressure',     // 'pressure' | 'tank' | 'timer' | 'charges'
 *     fire(world, hero, aim) {},  // called every step the player wants to fire;
 *                                  // the weapon decides whether anything happens
 *                                  // (its own cooldown, tank level, charges…)
 *     update(world, dt) {},       // its own projectiles, tank refill, timers —
 *                                  // called every step, whatever the room is doing
 *     draw(ctx) {},                // its projectiles, in the room's own frame
 *     glow(ctx, light) {},         // its projectiles' glow pass
 *     lights(lightMap) {},         // its projectiles as light sources
 *     heroModel: 'cutter',         // which held model hero.js draws for it
 *     reset(world) {},             // optional: clear its state for a fresh room
 *   })
 *
 * `fire`, `draw`, `glow`, `lights` and `reset` are all optional; a weapon
 * with nothing to add (a future one-shot effect, say) can omit any of them.
 */
(function () {
  'use strict';

  const S = window.Spyder;

  const weapons = new Map();

  S.weapons = {
    register(def) {
      if (!def || typeof def.id !== 'string') {
        throw new Error('A weapon needs a string "id".');
      }
      weapons.set(def.id, def);
      return def;
    },

    get(id) {
      return weapons.get(id);
    },

    list() {
      return Array.from(weapons.values());
    },

    // Is this weapon available to switch to? The Vacuum Blaster always is;
    // every other weapon is granted through S.progress (prompt 12, L2) —
    // until that exists, nothing but the Vacuum unlocks.
    isUnlocked(id) {
      if (id === 'vacuum') return true;
      const unlocked = S.progress && S.progress.data && S.progress.data.unlocked;
      return Array.isArray(unlocked) && unlocked.includes(id);
    },
  };
})();
