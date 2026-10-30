/*
 * Hatchlings and egg sacs. Neither counts toward a room's quota: they are
 * what happens when the real job (the spiders) is left undone. They are
 * registered so the runtime can treat every critter the same way, and so
 * room scripts can place them with world.spawn('hatchling', …).
 */
(function () {
  'use strict';

  const S = window.Spyder;

  S.registerSpiderType('hatchling', {
    quota: false,

    spawn({ world, seed, opts }) {
      return new S.spiders.Hatchling({
        x: opts.x ?? world.hero.x + 300,
        y: opts.y ?? world.layout.GROUND - 8,
        seed: opts.seed ?? seed,
        fromWall: Boolean(opts.fromWall),
        originX: opts.originX,
        originY: opts.originY,
        offsetX: opts.offsetX,
        dir: opts.dir,
        delay: opts.delay ?? 0,
        speedScale: opts.speedScale ?? 1,
      });
    },

    // Landing on one squashes it; walking into one costs a little nerve.
    threat(hatchling, world, head) {
      if (hatchling.dropping || hatchling.emerging) return null;
      const hero = world.hero;
      const rig = hatchling.rig;
      if (Math.abs(rig.x - hero.x) < 44 && Math.abs(rig.y - hero.y) < 44) {
        if (hero.vy > 120) {
          hatchling.kill(world);
          hero.vy = -520;
          world.award(hatchling.points * 2, rig.x, rig.y - 30, 'Stomp!');
          world.bumpCombo();
          world.sfx('stomp');
          world.emit('stomp', { critter: hatchling });
        } else {
          world.hurtHero(6);
        }
      }
      void head;
      return rig;
    },
  });

  S.registerSpiderType('egg', {
    quota: false,
    // Eggs laid by a crawler stick to the wallpaper, behind the furniture.
    layer: (egg) => (egg.mode === 'wall' ? 'wall' : 'room'),

    spawn({ world, seed, opts }) {
      return new S.spiders.EggSac({
        x: opts.x,
        y: opts.y,
        mode: opts.mode ?? 'falling',
        seed: opts.seed ?? seed ?? ((world.time * 1000) | 0),
        hatchAt: opts.hatchAt,
        hatchCount: opts.count,
        hatchSpeed: opts.speed,
      });
    },
  });
})();
