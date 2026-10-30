/*
 * Wall Crawler: creeps out of a lair (behind a frame, a crack), wanders the
 * wall with speed surges, freezes, and lays egg sacs on the wallpaper.
 * Brain: S.spiders.WallCrawler. It never touches the hero itself; the eggs
 * it lays do the damage.
 */
(function () {
  'use strict';

  const S = window.Spyder;

  S.registerSpiderType('crawler', {
    quota: true,
    layer: () => 'wall',

    spawn({ world, rng, seed, opts }) {
      const L = world.layout;
      const lair = opts.lair ?? rng.pick(L.lairs);
      // Later crawlers are quicker: the room gets harder as it gets emptier.
      const speed = S.lerp(110, 170, world.stats.kills / world.rules.quota);
      const crawler = new S.spiders.WallCrawler({ lair, area: L.wallArea, seed, speed });
      if (opts.emerged) {
        crawler.emerge = 1;
        crawler.state = 'wandering';
      }
      return crawler;
    },
  });
})();
