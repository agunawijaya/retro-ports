/*
 * String Spider: drops from the ceiling on silk, hovers, drops eggs on the
 * hero, lunges if the hero stands right below. The brain is
 * S.spiders.StringSpider (spiders.js); this file tells the runtime how to
 * place one in a room and how it threatens the hero.
 */
(function () {
  'use strict';

  const S = window.Spyder;

  S.registerSpiderType('string', {
    quota: true,

    spawn({ world, rng, seed, opts }) {
      const L = world.layout;
      // Prefer drop points away from the hero, so drops are seen, not felt.
      const choices = L.dropPoints.filter((x) => Math.abs(x - world.hero.x) > 120);
      const x = opts.x ?? rng.pick(choices.length ? choices : L.dropPoints);
      const [high, low] = L.hoverBand ?? [360, 620];
      const spider = new S.spiders.StringSpider({
        x,
        ceiling: L.CEILING,
        targetY: opts.targetY ?? rng.range(high, low),
        seed,
        aggression: 0.6,
      });
      if (opts.hover) {
        spider.rig.y = spider.targetY;
        spider.rig.plantAll(); // replant feet at the new height, or legs stay stretched to the ceiling
        spider.state = 'hovering';
      }
      world.sfx('creak', 0.4);
      return spider;
    },

    // Dangling right in front of the hero's face is what hurts.
    threat(spider, world, head) {
      const body = spider.rig.hitCenter();
      if (Math.hypot(body.x - head.x, body.y - head.y) < 62) world.hurtHero(15);
      return body;
    },
  });
})();
