/*
 * Spyder — Room 7: the Upstairs Hallway.
 *
 * The upstairs hallway, seen from the side: a long wall with four bedroom doors in a row,
 * the top of the staircase on the left, a tall window at the far right end,
 * and the attic hatch in the ceiling with its ladder pulled half down.
 *
 * This file contains ONLY the [LOGIC] sections per prompts/09-upstairs-hallway.md:
 * layout data, platforms, lairs, drop points, rules, makeover timing, story object,
 * and QA staging hooks.
 *
 * Art, painting, lighting, and props are attached via rooms/upstairs-hallway/art.js.
 */
(function () {
  'use strict';

  const S = window.Spyder;

  // ── Layout constants (stage units) ──────────────────────────────────

  const CEILING = 110;
  const PICTURE_RAIL = 150;
  const DADO_RAIL = 560;
  const FLOOR_LINE = 770;
  const GROUND = 935;

  const WINDOW = { x: 1730, y: 320, w: 120, h: 380 };

  // ── Props list for blockout / layout inspection ─────────────────────

  const props = [
    { name: 'Ceiling', x: 0, y: 0, w: 1920, h: CEILING, kind: 'wall' },
    { name: 'Wall', x: 0, y: CEILING, w: 1920, h: FLOOR_LINE - CEILING, kind: 'wall' },
    { name: 'Staircase top and banister', x: 100, y: 760, w: 340, h: 220, kind: 'furniture' },
    { name: 'Door A', x: 480, y: 360, w: 180, h: 410, kind: 'furniture' },
    { name: 'Door B', x: 820, y: 360, w: 180, h: 410, kind: 'furniture' },
    { name: "Door C — Thomas's room", x: 1160, y: 360, w: 180, h: 410, kind: 'story' },
    { name: 'Door D', x: 1500, y: 360, w: 180, h: 410, kind: 'furniture' },
    { name: 'Sconce 1', x: 386, y: 306, w: 28, h: 36, kind: 'light' },
    { name: 'Sconce 2', x: 726, y: 306, w: 28, h: 36, kind: 'light' },
    { name: 'Sconce 3', x: 1066, y: 306, w: 28, h: 36, kind: 'light' },
    { name: 'Sconce 4', x: 1406, y: 306, w: 28, h: 36, kind: 'light' },
    { name: 'Side table with vase and photos', x: 690, y: 800, w: 100, h: 135, kind: 'furniture' },
    { name: 'Attic hatch', x: 1350, y: 40, w: 150, h: 70, kind: 'furniture' },
    { name: 'Attic ladder', x: 1370, y: 110, w: 120, h: 700, kind: 'furniture' },
    { name: 'End window', x: 1730, y: 320, w: 120, h: 380, kind: 'window' },
    { name: 'Radiator under the window', x: 1700, y: 820, w: 160, h: 115, kind: 'furniture' },
    { name: 'Hall runner', x: 100, y: 860, w: 1700, h: 140, kind: 'wall' },
    { name: 'Floor', x: 0, y: FLOOR_LINE, w: 1920, h: 1080 - FLOOR_LINE, kind: 'wall' },
  ];

  // ── Platforms ───────────────────────────────────────────────────────

  const platforms = [
    { name: 'floor', x0: 0, x1: 1920, y: GROUND, oneWay: false },
    { name: 'banister', x0: 110, x1: 430, y: 760, oneWay: true },
    { name: 'side-table', x0: 695, x1: 785, y: 800, oneWay: true },
    { name: 'ladder-rung-1', x0: 1375, x1: 1485, y: 800, oneWay: true },
    { name: 'ladder-rung-2', x0: 1375, x1: 1485, y: 660, oneWay: true },
    { name: 'ladder-rung-3', x0: 1375, x1: 1485, y: 520, oneWay: true },
    { name: 'ladder-rung-4', x0: 1375, x1: 1485, y: 380, oneWay: true },
    { name: 'radiator', x0: 1705, x1: 1855, y: 820, oneWay: true },
  ];

  // ── Lairs & drop points ─────────────────────────────────────────────

  const dropPoints = [240, 420, 600, 780, 950, 1120, 1300, 1425, 1600, 1720];

  const lairs = [
    { x: 570, y: 565, door: 'A', label: 'door A' },
    { x: 910, y: 565, door: 'B', label: 'door B' },
    { x: 1590, y: 565, door: 'D', label: 'door D' },
  ];

  const jumperLairs = [
    {
      label: 'up the stairwell',
      surface: 'banister',
      from: { x: 180, y: 950 },
      to: { x: 260, y: 760 },
      moves: 'jump',
      heading: 0,
      time: 1.2,
    },
  ];

  const layout = {
    name: 'Upstairs Hallway',
    act: 2,
    number: 7,
    CEILING,
    PICTURE_RAIL,
    DADO_RAIL,
    FLOOR_LINE,
    GROUND,
    heroStart: 740,
    bounds: { left: 120, right: 1840 },
    platforms,
    props,
    dropPoints,
    hoverBand: [300, 620],
    lairs,
    jumperLairs,
    wallArea: { x0: 120, x1: 1840, y0: CEILING + 10, y1: FLOOR_LINE - 10 },
    window: WINDOW,
    lookout: { x: WINDOW.x + WINDOW.w / 2, y: WINDOW.y + 120 },
    breakables: [{ x: 1000, y: GROUND, contains: 'sonic' }],
  };

  // ── Webs (>= 6) ─────────────────────────────────────────────────────

  function makeWebs() {
    return [
      // 1. Across the attic hatch
      new S.Web({
        hub: [1425, 75],
        anchors: [[1350, 40], [1400, 40], [1500, 40], [1500, 110], [1420, 110], [1350, 110]],
        rings: 6,
        sheet: 0.5,
        seed: 901,
      }),
      // 2. Between two ladder rungs (rungs at 660 and 520)
      new S.Web({
        hub: [1430, 590],
        anchors: [[1380, 520], [1480, 520], [1480, 660], [1380, 660], [1430, 520], [1430, 660]],
        rings: 5,
        sheet: 0.45,
        seed: 902,
      }),
      // 3. From a sconce to the ceiling (sconce 2 at 740, 320)
      new S.Web({
        hub: [740, 220],
        anchors: [[710, CEILING], [770, CEILING], [790, 150], [755, 305], [725, 305], [690, 180]],
        rings: 6,
        sheet: 0.4,
        seed: 903,
      }),
      // 4. Corner of door A (x 480, y 360)
      new S.Web({
        hub: [495, 375],
        anchors: [[480, 360], [540, 360], [540, 410], [480, 450], [480, 400]],
        rings: 5,
        sheet: 0.4,
        seed: 904,
      }),
      // 5. Corner of door D (x 1680, y 360)
      new S.Web({
        hub: [1665, 375],
        anchors: [[1680, 360], [1620, 360], [1620, 410], [1680, 450], [1680, 400]],
        rings: 5,
        sheet: 0.4,
        seed: 905,
      }),
      // 6. Banister to wall (x 430, y 760)
      new S.Web({
        hub: [440, 740],
        anchors: [[410, 760], [430, 720], [470, 710], [470, 770], [430, 790]],
        rings: 5,
        sheet: 0.45,
        seed: 906,
      }),
      // 7. Window upper corner (x 1730, y 320)
      new S.Web({
        hub: [1750, 340],
        anchors: [[1730, 320], [1800, 320], [1800, 370], [1730, 400]],
        rings: 5,
        sheet: 0.35,
        seed: 907,
      }),
    ];
  }

  // ── Rules ───────────────────────────────────────────────────────────

  const rules = {
    quota: 20,
    webGoal: 0.85,
    types: ['string', 'crawler', 'jumper', 'eggCarrier'],
    spawnPattern: ['crawler', 'eggCarrier', 'string', 'crawler', 'jumper', 'eggCarrier', 'string', 'crawler'],
    maxAlive: [3, 4],
    spawnInterval: [2.2, 1.2],
  };

  // ── Makeover ────────────────────────────────────────────────────────

  const makeover = {
    beats: [
      { name: 'sconce1', key: 'sconce1', from: 3.3, to: 3.5, chime: 0.1, ease: 'out' },
      { name: 'sconce2', key: 'sconce2', from: 3.6, to: 3.8, chime: 0.25, ease: 'out' },
      { name: 'sconce3', key: 'sconce3', from: 3.9, to: 4.1, chime: 0.4, ease: 'out' },
      { name: 'sconce4', key: 'sconce4', from: 4.2, to: 4.4, chime: 0.55, ease: 'out' },
      { name: 'doorC', key: 'doorC', from: 4.4, to: 5.0, ease: 'inOut' },
      { name: 'ladder', key: 'ladder', from: 4.9, to: 5.4, ease: 'inOut' },
    ],
    uniqueBeat: {
      key: 'ladder',
      at: 4.9,
      run(mk, t, fx) {
        if (t >= 4.9 && !mk._ladderClunk) {
          mk._ladderClunk = true;
          S.audio?.play('stomp', 0.6);
        }
        void fx;
      },
    },
  };

  const storyObject = 'On a door frame: Thomas, measured every birthday. The marks stop at eight.';

  // ── QA states ───────────────────────────────────────────────────────

  const qa = {
    heroX: { dirty: 740, makeover: 740, clean: 740 },
    action: {
      heroX: 820,
      aimAt: { x: 600, y: 480 },
      strings: [
        { x: 600, targetY: 480, seed: 911 },
        { x: 1425, targetY: 450, seed: 912 }, // dropping from attic hatch
      ],
      crawlers: [
        { lair: { x: 570, y: 565, door: 'A' }, seed: 913 },
      ],
      eggs: [
        { x: 1080, y: 640 },
      ],
      hatchlings: [
        { x: 920, seed: 915 },
      ],
      tear: { webs: 2, path: [1400, 70, 1460, 90] },
      kills: 11,
      score: 7850,
    },
    states: {
      makeover(api) {
        api.holdDirector();
        api.placeHero(740);
        api.step(0.5);
        api.startMakeover();
        api.step(3.9); // t ≈ 3.9 s, sconces lighting
      },
      carrier(api) {
        api.setState('playing');
        api.holdDirector();

        // Hero on the ladder's second rung aiming
        api.placeHero(1430, 'ladder-rung-2');
        api.hero.facing = -1;

        // Egg Carrier emerging from door B's gap with its sac
        const c1 = api.spawn('eggCarrier', {
          lair: { x: 910, y: 565, door: 'B' },
          first: true,
          seed: 931,
        });
        if (c1) {
          c1.emerge = 0.5;
          c1.state = 'emerging';
        }

        // Second Egg Carrier planting an egg on the wall
        const c2 = api.spawn('eggCarrier', {
          lair: { x: 1200, y: 480 },
          planting: true,
          plantingTimer: 0.4,
          seed: 932,
        });
        if (c2) {
          c2.emerge = 1;
          c2.state = 'planting';
          c2.rig.x = 1200;
          c2.rig.y = 480;
        }

        api.aimAt(910, 565);
      },
    },
  };

  // ── Doors that creak ajar ───────────────────────────────────────────
  // Crawlers and Egg Carriers come out of the bedrooms: while one is
  // emerging from a door's lair, that door swings 10–15° open with a
  // creak, then drifts shut. The art reads `live.doors[door]` (0 shut … 1 ajar).
  const DOOR_LAIRS = lairs.filter((l) => l.door);

  function updateDoors(dt, world) {
    const live = world.live;
    if (!live) return;
    live.doors = live.doors || { A: 0, B: 0, C: 0, D: 0 };
    live.doorTarget = live.doorTarget || {};
    for (const lair of DOOR_LAIRS) {
      const emerging = world.critters.some((c) =>
        c.alive && c.rig && (c.state === 'emerging' || (c.emerge ?? 1) < 1) &&
        Math.hypot(c.rig.x - lair.x, c.rig.y - lair.y) < 110);
      const was = live.doorTarget[lair.door] || 0;
      const target = emerging ? 1 : 0;
      if (target && !was) world.sfx('creak', 0.7);
      live.doorTarget[lair.door] = target;
      // Opens quickly, drifts shut slowly.
      live.doors[lair.door] = S.damp(live.doors[lair.door] || 0, target, target ? 9 : 1.6, dt);
    }
  }

  // ── Register room ───────────────────────────────────────────────────

  S.rooms.register({
    id: 'upstairs-hallway',
    number: 7,
    act: 2,
    name: 'Upstairs Hallway',
    layout,
    makeWebs,
    rules,
    makeover,
    storyObject,
    qa,
    art: true,
    onUpdate(dt, world) {
      updateDoors(dt, world);
    },
  });
})();
