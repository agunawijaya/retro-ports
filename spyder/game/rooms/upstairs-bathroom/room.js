/*
 * Spyder — Room 11: the Upstairs Bathroom.
 *
 * The family bathroom under the roof: a slanted ceiling with a shuttered skylight,
 * a long vanity with a wall-wide mirror, a bath with a shower, a laundry basket,
 * and a linen cupboard. Wider and warmer than the downstairs bathroom (pink and
 * cream 1960s tiles), full of reflections.
 *
 * This file contains ONLY the [LOGIC] sections per prompts/14-upstairs-bathroom.md:
 * layout data, platforms, lairs, drop points, rules, mirror mechanics, hot tap & steam,
 * laundry chute rattle, laundry basket hatchling spills, makeover timing, story object,
 * and QA staging hooks.
 *
 * Art, painting, lighting, and blockouts are attached via rooms/upstairs-bathroom/art.js.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  // ── Layout constants (stage units) ──────────────────────────────────

  const CEILING = 110;
  const FLOOR_LINE = 770;
  const GROUND = 935;
  const SLOPE = { x0: 120, y0: 300, x1: 900, y1: 110 };

  const SKYLIGHT = { x: 380, y: 170, w: 240, h: 160 };
  const BATH = { x0: 160, x1: 620, rimY: 780, panelBottom: 935 };
  const VANITY = { x0: 760, x1: 1380, topY: 760, tapX: 880, tapY: 730 };
  const MIRROR = { x: 760, y: 330, w: 620, h: 370 };
  const CUPBOARD = { x0: 1460, x1: 1680, y0: 330, y1: 850, shelfY: 620 };
  const STOOL = { x0: 1400, x1: 1460, topY: 840 };
  const BASKET = { x0: 1720, x1: 1840, topY: 840 };
  const CHUTE = { x0: 1720, x1: 1820, y0: 560, y1: 640 };

  // Helper to compute slanted ceiling height at any x
  function ceilingYAt(x) {
    if (x <= SLOPE.x0) return SLOPE.y0;
    if (x >= SLOPE.x1) return SLOPE.y1;
    const t = (x - SLOPE.x0) / (SLOPE.x1 - SLOPE.x0);
    return SLOPE.y0 + t * (SLOPE.y1 - SLOPE.y0);
  }

  // ── Props list for blockout / layout inspection ─────────────────────

  const props = [
    { name: 'Slanted ceiling', x: 120, y: 110, w: 1800, h: 190, kind: 'wall' },
    { name: 'Shuttered skylight', x: SKYLIGHT.x, y: SKYLIGHT.y, w: SKYLIGHT.w, h: SKYLIGHT.h, kind: 'window' },
    { name: 'Wall (pink & cream tiles to y 600, painted above)', x: 120, y: 110, w: 1800, h: 660, kind: 'wall' },
    { name: 'Bath with shower', x: BATH.x0, y: BATH.rimY - 40, w: BATH.x1 - BATH.x0, h: 195, kind: 'furniture' },
    { name: 'Vanity with two basins', x: VANITY.x0, y: VANITY.topY, w: VANITY.x1 - VANITY.x0, h: 175, kind: 'furniture' },
    { name: 'Wall-wide mirror', x: MIRROR.x, y: MIRROR.y, w: MIRROR.w, h: MIRROR.h, kind: 'furniture' },
    { name: 'Toothbrush cup (story)', x: 1050, y: 720, w: 25, h: 40, kind: 'story' },
    { name: 'Linen cupboard', x: CUPBOARD.x0, y: CUPBOARD.y0, w: CUPBOARD.x1 - CUPBOARD.x0, h: CUPBOARD.y1 - CUPBOARD.y0, kind: 'furniture' },
    { name: 'Step stool', x: STOOL.x0, y: STOOL.topY, w: STOOL.x1 - STOOL.x0, h: 95, kind: 'furniture' },
    { name: 'Laundry basket (a lair)', x: BASKET.x0, y: BASKET.topY, w: BASKET.x1 - BASKET.x0, h: 95, kind: 'furniture' },
    { name: 'Laundry chute hatch', x: CHUTE.x0, y: CHUTE.y0, w: CHUTE.x1 - CHUTE.x0, h: CHUTE.y1 - CHUTE.y0, kind: 'furniture' },
    { name: 'Floor', x: 0, y: FLOOR_LINE, w: 1920, h: 310, kind: 'wall' },
  ];

  // ── Platforms ───────────────────────────────────────────────────────
  // Jump reach budget: rise <= 190 px, gap <= 160 px.
  // Floor (935) -> Bath rim (780): rise 155 px (<= 190)
  // Floor (935) -> Vanity (760): rise 175 px (<= 190)
  // Bath rim (610) -> Vanity (770): gap 160 px (<= 160)
  // Floor (935) -> Step stool (840): rise 95 px (<= 190)
  // Vanity (1370) -> Step stool (1400): gap 30 px, y diff 80 px
  // Vanity right end (1370, y 760) -> Cupboard open shelf (1470, y 620): gap 100 px, rise 140 px (<= 190, <= 160)
  // Floor (935) -> Laundry basket lid (840): rise 95 px (<= 190)
  const platforms = [
    { name: 'floor', x0: 0, x1: 1920, y: GROUND, oneWay: false },
    { name: 'bath-rim', x0: 170, x1: 610, y: BATH.rimY, oneWay: true },
    { name: 'vanity', x0: 770, x1: 1370, y: VANITY.topY, oneWay: true },
    { name: 'cupboard-shelf', x0: 1470, x1: 1670, y: CUPBOARD.shelfY, oneWay: true },
    { name: 'step-stool', x0: STOOL.x0, x1: STOOL.x1, y: STOOL.topY, oneWay: true },
    { name: 'laundry-basket', x0: 1725, x1: 1835, y: BASKET.topY, oneWay: true },
  ];

  // ── Lairs & drop points ─────────────────────────────────────────────

  // Spiders drop from both the slanted slope and the flat ceiling
  const dropPoints = [260, 480, 700, 960, 1180, 1400, 1620, 1800];

  // Crawler lairs per prompt: the skylight frame, behind the linen cupboard,
  // behind the bath panel, the chute hatch's edge
  const lairs = [
    { x: 500, y: 220, label: 'the skylight frame' },
    { x: 1570, y: 350, label: 'behind the linen cupboard' },
    { x: 390, y: 800, label: 'behind the bath panel' },
    { x: 1770, y: 600, label: "the chute hatch's edge" },
  ];

  // Jumper lairs: out of the laundry basket (lifting lid) and out of the bath
  const jumperLairs = [
    {
      label: 'out of the laundry basket',
      surface: 'laundry-basket',
      from: { x: 1780, y: 880 },
      to: { x: 1780, y: 840 },
      moves: 'scurry',
      heading: -Math.PI / 2,
      time: 1.0,
      basketLid: true,
    },
    {
      label: 'out of the bath',
      surface: 'bath-rim',
      from: { x: 390, y: 840 },
      to: { x: 390, y: BATH.rimY },
      moves: 'climb',
      heading: 0,
      time: 1.4,
    },
  ];

  const layout = {
    name: 'Upstairs Bathroom',
    act: 3,
    number: 11,
    CEILING,
    FLOOR_LINE,
    GROUND,
    heroStart: 1000,
    bounds: { left: 120, right: 1840 },
    platforms,
    props,
    dropPoints,
    hoverBand: [320, 620],
    lairs,
    jumperLairs,
    wallArea: { x0: 120, x1: 1840, y0: 110, y1: FLOOR_LINE - 10 },
    window: SKYLIGHT,
    lookout: { x: SKYLIGHT.x + SKYLIGHT.w / 2, y: SKYLIGHT.y + SKYLIGHT.h / 2 },
    breakables: [{ x: 1570, y: CUPBOARD.shelfY, contains: 'sonic' }],
    ceilingYAt,
  };

  // ── Webs (>= 6) ─────────────────────────────────────────────────────

  function makeWebs() {
    return [
      // 1. Across the skylight (slope x 380-620)
      new S.Web({
        hub: [500, 200],
        anchors: [[380, 240], [420, 170], [540, 170], [620, 190], [580, 270], [450, 260]],
        rings: 5,
        sheet: 0.45,
        seed: 1401,
      }),
      // 2. The shower rail (x 160-620, y 320-360)
      new S.Web({
        hub: [350, 360],
        anchors: [[200, 340], [300, 320], [450, 330], [480, 420], [360, 450], [220, 420]],
        rings: 5,
        sheet: 0.4,
        seed: 1402,
      }),
      // 3. Mirror's top corner (mirror x 760-1380, y 330)
      new S.Web({
        hub: [790, 360],
        anchors: [[760, 330], [830, 330], [860, 380], [810, 420], [760, 390]],
        rings: 5,
        sheet: 0.45,
        seed: 1403,
      }),
      // 4. Between the cupboard and the slope
      new S.Web({
        hub: [1560, 220],
        anchors: [[1460, 330], [1460, 200], [1560, 110], [1680, 110], [1680, 330], [1570, 330]],
        rings: 6,
        sheet: 0.5,
        seed: 1404,
      }),
      // 5. Under the vanity (top y 760 to floor y 935)
      new S.Web({
        hub: [1070, 840],
        anchors: [[800, 760], [1050, 760], [1340, 760], [1300, 935], [820, 935]],
        rings: 6,
        sheet: 0.45,
        seed: 1405,
      }),
      // 6. The laundry chute hatch (x 1720-1820, y 560-640)
      new S.Web({
        hub: [1770, 600],
        anchors: [[1720, 560], [1820, 560], [1840, 620], [1820, 660], [1720, 660], [1700, 600]],
        rings: 5,
        sheet: 0.4,
        seed: 1406,
      }),
    ];
  }

  // ── Rules ───────────────────────────────────────────────────────────

  const rules = {
    quota: 18,
    webGoal: 0.85,
    types: ['string', 'crawler', 'jumper', 'eggCarrier'],
    spawnPattern: ['string', 'crawler', 'string', 'eggCarrier', 'jumper', 'crawler', 'string', 'eggCarrier'],
    maxAlive: [3, 4],
    spawnInterval: [2.3, 1.3],
  };

  // ── Makeover ────────────────────────────────────────────────────────

  const makeover = {
    beats: [
      { name: 'skylight', key: 'skylight', from: 3.3, to: 4.8, chime: 0.5, ease: 'out' },
      { name: 'bulbs', key: 'bulbs', from: 3.9, to: 4.5, chime: 0.6, ease: 'out' },
      { name: 'cup', key: 'cup', from: 4.5, to: 4.9, chime: 0.7, ease: 'inOut' },
    ],
    uniqueBeat: {
      key: 'skylight',
      at: 3.3,
      run(mk, t, fx) {
        if (t >= 3.3) {
          mk.skylightOpen = S.clamp((t - 3.3) / 1.5, 0, 1);
        }
        if (t >= 3.9) {
          mk.bulbsLit = S.clamp((t - 3.9) / 0.6, 0, 1);
        }
        if (t >= 4.5) {
          mk.cupUpright = S.clamp((t - 4.5) / 0.4, 0, 1);
        }
      },
    },
  };

  // ── Hot tap & steam mechanics ───────────────────────────────────────

  function dartHitsHotTap(dart, world) {
    const live = world.live;
    if (!live) return false;
    const dist = S.pointSegmentDistance(VANITY.tapX, VANITY.tapY, dart.px, dart.py, dart.x, dart.y);
    if (dist > 30) return false;

    if (live.tapRunning) {
      live.tapRunning = false;
      live.tapCooldown = 25; // turns itself back on 25s later
      world.burst.dustPuff(VANITY.tapX, VANITY.tapY, 4, 32);
      const a = world.audio;
      if (a && a.ctx && !a.muted) {
        // Squeak sound when turned off
        a.tone({ type: 'sine', freq: 1100, freqEnd: 1650, duration: 0.12, gain: 0.08 });
      }
    }
    return true; // stops dart on the tap
  }

  function updateSteamAndTap(dt, world) {
    const live = world.live;
    if (!live) return;
    const isClean = world.game?.state === 'restored' || (world.mk && world.mk.t >= 3.3);

    if (isClean) {
      live.tapRunning = false;
      live.steam = Math.max(0, (live.steam ?? 0) - dt / 4.0);
      return;
    }

    if (live.tapRunning) {
      // Mirror fogs from the bottom up over 20 s
      live.steam = Math.min(1, (live.steam ?? 0) + dt / 20.0);

      // Water drip & steam particles at the tap spout
      live.dripTimer = (live.dripTimer ?? 0) + dt;
      if (live.dripTimer >= 0.9) {
        live.dripTimer -= 0.9;
        world.burst.add('goo', VANITY.tapX, VANITY.tapY + 12, {
          vx: (Math.random() - 0.5) * 20,
          vy: 15 + Math.random() * 25,
          gravity: 800,
          drag: 0.85,
          life: 0.22,
          size: 1.6,
          color: S.mixHex(P.silk, P.moon, 0.35),
        });
      }
    } else {
      // Mirror clears in 4 s once tap is turned off
      live.steam = Math.max(0, (live.steam ?? 0) - dt / 4.0);

      // Tap turns itself back on 25 s later (pipes knock)
      live.tapCooldown = (live.tapCooldown ?? 25) - dt;
      if (live.tapCooldown <= 0) {
        live.tapRunning = true;
        live.tapCooldown = 0;
        const a = world.audio;
        if (a && a.ctx && !a.muted) {
          // Pipes knock sound
          a.tone({ type: 'triangle', freq: 140, freqEnd: 75, duration: 0.18, gain: 0.09 });
        }
      }
    }
  }

  // ── Laundry chute rattle & laundry basket spills ─────────────────────

  function updateChuteAndBasket(dt, world) {
    const live = world.live;
    if (!live) return;
    const isClean = world.game?.state === 'restored' || (world.mk && world.mk.t >= 2.0);

    // Chute hatch rattles now and then: sound and shake, nothing comes out
    if (!isClean) {
      live.chuteRattleTimer = (live.chuteRattleTimer ?? (14 + Math.random() * 8)) - dt;
      if (live.chuteRattleTimer <= 0) {
        live.chuteRattleTimer = 16 + Math.random() * 10;
        live.chuteShake = 0.6; // duration of rattle
        const a = world.audio;
        if (a && a.ctx && !a.muted) {
          a.noise({ duration: 0.35, filter: 'bandpass', freq: 620, q: 3.5, gain: 0.06 });
        }
      }
    }
    if (live.chuteShake > 0) {
      live.chuteShake = Math.max(0, live.chuteShake - dt);
    }

    // Laundry basket lair: lid lifts and hatchlings spill out
    if (!isClean) {
      live.basketTimer = (live.basketTimer ?? (18 + Math.random() * 8)) - dt;
      if (live.basketTimer <= 0) {
        live.basketTimer = 22 + Math.random() * 10;
        live.basketLid = 1.0;
        if (typeof world.hatch === 'function') {
          world.hatch({
            x: 1780,
            y: BASKET.topY,
            count: 2 + (Math.random() > 0.5 ? 1 : 0),
            speed: 110,
            groundY: GROUND,
          });
        }
      }
    }
    if (live.basketLid > 0) {
      live.basketLid = Math.max(0, live.basketLid - dt * 1.5);
    }
  }

  // ── Ceiling height adjustment for string spiders on the slope ───────

  function syncStringSpiderAnchors(world) {
    if (!world.critters) return;
    for (const c of world.critters) {
      if (c.kind === 'string' && !c._ceilingAdjusted) {
        c._ceilingAdjusted = true;
        c.ceiling = ceilingYAt(c.anchorX);
      }
    }
  }

  // ── QA staging ──────────────────────────────────────────────────────

  const qa = {
    heroX: { dirty: 1000, makeover: 1000, clean: 1000 },
    action: {
      heroX: 1000,
      strings: [
        { x: 960, targetY: 450 },
        { x: 1400, targetY: 480 },
      ],
      crawlers: [{ lair: { x: 500, y: 220 } }],
      eggs: [{ x: 1520, y: 620 }],
      // x 1500: far enough from heroX (1000) that it cannot close the 500 px
      // gap and bite before the staged frame renders — the same fix as
      // study's qa.action.hatchlings (see rooms/study/room.js). At x 1200
      // (200 px away) the hatchling has no `originX`/`delay`, so
      // spider-types/hatchling.js's threat() chases hero.x at full speed
      // from frame 0 (no scatter phase), closed the gap during stageAction()'s
      // ~1 s of step(), and world.hurtHero(6) left hero.invulnerable ≈ 1.0 at
      // render time — above the 0.6 threshold for the "Hurt pulse" red tint
      // in room-runtime.js's grade().
      hatchlings: [{ x: 1500, seed: 141 }],
      tear: { webs: 2, path: [780, 350, 860, 420] },
      kills: 8,
      score: 7200,
      nerve: 75,
      aimAt: { x: 960, y: 450 },
    },
    states: {
      makeover(api) {
        api.holdDirector();
        api.placeHero(1000);
        api.step(0.5);
        api.startMakeover();
        api.step(3.9); // prompt: t ≈ 3.9 s
      },
      mirror(api) {
        api.setState('playing');
        api.holdDirector();
        api.placeHero(1000, 'vanity');
        const hero = api.hero;
        hero.facing = 1; // hero at vanity facing right
        api.world.live.steam = 0.5; // steam halfway up the glass

        // Crawler on skylight frame in the reflection
        api.spawn('crawler', {
          lair: { x: 480, y: 220 },
        });

        // String spider descending behind him visible only in the mirror
        const stringSpider = api.spawn('string', {
          x: 860,
          targetY: 420,
          hover: true,
        });
        if (stringSpider) {
          stringSpider.mirrorOnly = true;
          // `hover: true` replants the rig's feet at spawn now (fixed in
          // spider-types/string.js), so no patch is needed here any more.
          const origDraw = stringSpider.draw.bind(stringSpider);
          stringSpider.draw = function (ctx, t) {
            if (this.mirrorOnly && !this._inMirror) return;
            origDraw(ctx, t);
          };
        }
      },
    },
  };

  // ── Register Room ───────────────────────────────────────────────────

  S.rooms.register({
    id: 'upstairs-bathroom',
    number: 11,
    act: 3,
    name: 'Upstairs Bathroom',
    art: true,
    layout,
    rules,
    makeWebs,
    makeover,
    storyObject: "Four toothbrushes in a cup. One has a strip of tape on it: 'A.'",
    qa,

    onStart(world, info) {
      const live = world.live;
      if (live) {
        live.world = world;
        live.steam = info?.qa === 'clean' ? 0 : 1.0;
        live.tapRunning = info?.qa !== 'clean';
        live.tapCooldown = 0;
        live.dripTimer = 0;
        live.chuteRattleTimer = 14 + Math.random() * 8;
        live.chuteShake = 0;
        live.basketTimer = 18 + Math.random() * 8;
        live.basketLid = 0;
      }

      world.on('dart', ({ dart }) => dartHitsHotTap(dart, world));

      if (info && info.qa === 'action') {
        world.spawn('jumper', { surface: 'bath-rim', x: 390, state: 'crouch', crouch: 0.75, facing: 1, hold: 99 });
      }
    },

    onUpdate(dt, world) {
      updateSteamAndTap(dt, world);
      updateChuteAndBasket(dt, world);
      syncStringSpiderAnchors(world);
    },

    onLeave(world) {
      if (world.live) {
        world.live.world = null;
      }
    },
  });
})();
