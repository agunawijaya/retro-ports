/*
 * Spyder — the spider-type registry.
 *
 * The room runtime never names a spider class directly. It looks the brain
 * up here by the name a room uses in its rules (`types`, `spawnPattern`),
 * so a new spider is one new file in this folder that calls
 * `S.registerSpiderType(...)`, plus one <script> line in index.html.
 * Nothing in the runtime changes.
 *
 * A type is an object with:
 *
 *   quota       true if killing it counts toward the room's spider quota
 *               (and toward the "how many are alive" cap the director keeps).
 *               Hatchlings and eggs are false: they are consequences, not
 *               the job.
 *   layer(c)    'wall' to be drawn on the wall plane, behind the furniture
 *               (wall crawlers, eggs stuck to the wallpaper); 'room' for
 *               everything hanging or running in front of it. Default 'room'.
 *   spawn(ctx)  build one entity. ctx = { world, rng, seed, opts }. `rng` is
 *               seeded by the director so every run spawns the same spiders
 *               in the same places, which keeps screenshots reproducible.
 *               `opts` carries overrides from QA staging or room scripts
 *               (x, targetY, hover, lair, emerged, …).
 *   canSpawn(world)   optional. While it returns false the director waits
 *               with this spawn (e.g. "the first Jumper comes alone").
 *   threat(c, world, head)   optional, called every frame for each living
 *               entity of this type. Hurt the hero if it is close
 *               (world.hurtHero), and return the point the hero's eyes
 *               should track, or null if the hero should ignore it.
 *
 * The entity itself follows the contract in spiders.js: update(dt, world),
 * draw(ctx, time), kill(world, how), `alive`, `done`, `kind`, `points`, and
 * a `rig` (SpiderRig) if it should get eye glints and rig-sized hit tests.
 * `kill()` may return { bonus, label } to add points to the kill
 * (e.g. a Jumper swatted mid-air).
 */
(function () {
  'use strict';

  const S = window.Spyder;

  S.spiderTypes = S.spiderTypes || {};

  S.registerSpiderType = function registerSpiderType(name, type) {
    if (typeof type.spawn !== 'function') {
      throw new Error(`Spider type "${name}" needs a spawn(ctx) function.`);
    }
    S.spiderTypes[name] = { name, quota: true, layer: () => 'room', ...type };
    return S.spiderTypes[name];
  };

  // Does killing this entity count toward the room's quota?
  S.countsForQuota = (critter) => Boolean(S.spiderTypes[critter.kind]?.quota);
})();
