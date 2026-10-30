/*
 * Spyder — Room 12: The Attic and the Spider Queen.
 *
 * The final room of Act 3: a pitched roof with exposed rafters, a boarded round
 * window, stacked trunks, a rocking horse under a dust sheet, a hanging bulb,
 * and between two rafters, the Queen's silk funnel nest.
 *
 * This file contains ONLY the [LOGIC] sections per prompts/16-attic.md:
 * layout data, platforms, rules, makeover timing, story object, webs, and QA staging.
 *
 * Art and blockouts are in rooms/attic/art.js.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  // ── Layout constants (stage units) ──────────────────────────────────
  const CEILING = 60; // Ridge at (960, 60)
  const FLOOR_LINE = 770;
  const GROUND = 935;

  const WINDOW = { x: 850, y: 140, w: 220, h: 220, cx: 960, cy: 250, r: 110 };
  const FUNNEL = { x0: 780, x1: 1140, y0: 60, y1: 380 };
  const BULB = { cordX: 700, cordY: 100, bulbY: 330 };

  // ── Props list for layout & blockout inspection ─────────────────────
  const props = [
    { name: 'Pitched roof with rafters', x: 0, y: 60, w: 1920, h: 460, kind: 'wall' },
    { name: 'Collar beam', x: 520, y: 430, w: 880, h: 30, kind: 'furniture' },
    { name: 'Boarded round window', x: WINDOW.x, y: WINDOW.y, w: WINDOW.w, h: WINDOW.h, kind: 'window' },
    { name: "The Queen's nest funnel", x: FUNNEL.x0, y: FUNNEL.y0, w: FUNNEL.x1 - FUNNEL.x0, h: FUNNEL.y1 - FUNNEL.y0, kind: 'furniture' },
    { name: 'Hanging bulb', x: BULB.cordX - 10, y: BULB.cordY, w: 20, h: BULB.bulbY - BULB.cordY + 30, kind: 'light' },
    { name: 'Lower trunk', x: 190, y: 830, w: 260, h: 105, kind: 'furniture' },
    { name: 'Upper trunk', x: 220, y: 700, w: 200, h: 130, kind: 'furniture' },
    { name: 'Box stack', x: 470, y: 560, w: 90, h: 140, kind: 'furniture' },
    { name: 'Rocking horse under dust sheet', x: 1480, y: 790, w: 220, h: 145, kind: 'furniture' },
    { name: 'Lower crate', x: 1300, y: 650, w: 100, h: 140, kind: 'furniture' },
    { name: 'Upper crate', x: 1320, y: 520, w: 80, h: 130, kind: 'furniture' },
    { name: 'Hallway hatch & ladder top', x: 1760, y: 935, w: 120, h: 30, kind: 'furniture' },
    { name: 'Attic floor', x: 0, y: FLOOR_LINE, w: 1920, h: 310, kind: 'wall' },
  ];

  // ── Platforms ───────────────────────────────────────────────────────
  // Jump reach budget: rise <= 190 px, gap <= 160 px.
  //   - Floor (935) -> Lower trunk (830): rise 105 px
  //   - Lower trunk (830) -> Upper trunk (700): rise 130 px
  //   - Upper trunk (700, x 220-420) -> Box stack (560, x 470-560): rise 140 px, gap 50 px
  //   - Box stack (560, x 470-560) -> Collar beam (430, x 520-1400): rise 130 px, overlap
  //   - Floor (935) -> Rocking horse (790): rise 145 px
  //   - Rocking horse (790, x 1490-1690) -> Lower crate (650, x 1300-1400): rise 140 px, gap 90 px
  //   - Lower crate (650, x 1300-1400) -> Upper crate (520, x 1320-1400): rise 130 px, overlap
  //   - Upper crate (520, x 1320-1400) -> Collar beam (430, x 520-1400): rise 90 px, overlap
  const platforms = [
    { name: 'floor', x0: 0, x1: 1920, y: GROUND, oneWay: false },
    { name: 'lower-trunk', x0: 190, x1: 450, y: 830, oneWay: true },
    { name: 'upper-trunk', x0: 220, x1: 420, y: 700, oneWay: true },
    { name: 'box-stack', x0: 470, x1: 560, y: 560, oneWay: true },
    { name: 'collar-beam', x0: 520, x1: 1400, y: 430, oneWay: true },
    { name: 'rocking-horse', x0: 1490, x1: 1690, y: 790, oneWay: true },
    { name: 'lower-crate', x0: 1300, x1: 1400, y: 650, oneWay: true },
    { name: 'upper-crate', x0: 1320, x1: 1400, y: 520, oneWay: true },
  ];

  // ── Lairs & drop points ─────────────────────────────────────────────
  // Rafter drop points across pitched roof
  const dropPoints = [140, 360, 580, 800, 1020, 1240, 1460, 1680];

  const lairs = [
    { x: 260, y: 810, label: 'behind the trunks' },
    { x: 1580, y: 810, label: 'behind the rocking horse' },
    { x: 120, y: 520, label: 'left eave' },
    { x: 1800, y: 520, label: 'right eave' },
    { x: 540, y: 420, label: 'collar beam' },
  ];

  const layout = {
    name: 'Attic',
    act: 3,
    number: 12,
    CEILING,
    FLOOR_LINE,
    GROUND,
    heroStart: 1780, // Emerging from hallway hatch
    bounds: { left: 80, right: 1840 },
    platforms,
    props,
    dropPoints,
    hoverBand: [240, 560],
    lairs,
    wallArea: { x0: 80, x1: 1840, y0: 80, y1: FLOOR_LINE },
    window: WINDOW,
    lookout: { x: WINDOW.cx, y: WINDOW.cy },
    breakables: [
      { x: 340, y: 830, contains: 'flamethrower' }, // On lower trunk
      { x: 700, y: 430, contains: 'sonic' },        // On collar beam
    ],
  };

  // ── Rules (L2) ──────────────────────────────────────────────────────
  const rules = {
    quota: 12,
    webGoal: 0.8,
    boss: 'spider-queen',
    bossAt: 4,
    types: ['string', 'crawler', 'jumper', 'webWeaver'],
    spawnPattern: ['string', 'crawler', 'string', 'webWeaver', 'jumper', 'string'],
    maxAlive: [2, 3],
    spawnInterval: [4.0, 2.6],
  };

  // ── Webs (>= 8 webs required) ───────────────────────────────────────
  function makeWebs() {
    return [
      // 0. Between rafters left
      new S.Web({
        hub: [360, 200],
        anchors: [[220, 180], [500, 180], [460, 310], [280, 310]],
        rings: 5,
        sheet: 0.5,
        seed: 1601,
      }),
      // 1. Between rafters right
      new S.Web({
        hub: [1560, 200],
        anchors: [[1420, 180], [1700, 180], [1680, 310], [1460, 310]],
        rings: 5,
        sheet: 0.5,
        seed: 1602,
      }),
      // 2. Around bulb cord
      new S.Web({
        hub: [700, 220],
        anchors: [[650, 140], [750, 140], [740, 290], [660, 290]],
        rings: 4,
        sheet: 0.45,
        seed: 1603,
      }),
      // 3. Boarded window edges
      new S.Web({
        hub: [880, 260],
        anchors: [[840, 180], [940, 170], [940, 330], [840, 320]],
        rings: 4,
        sheet: 0.6,
        seed: 1604,
      }),
      // 4. Over the trunks
      new S.Web({
        hub: [300, 750],
        anchors: [[200, 690], [400, 690], [420, 820], [220, 820]],
        rings: 5,
        sheet: 0.55,
        seed: 1605,
      }),
      // 5. Over the rocking horse
      new S.Web({
        hub: [1590, 780],
        anchors: [[1490, 740], [1690, 740], [1680, 860], [1500, 860]],
        rings: 5,
        sheet: 0.55,
        seed: 1606,
      }),
      // 6. Over the hatch
      new S.Web({
        hub: [1820, 910],
        anchors: [[1760, 870], [1880, 870], [1880, 935], [1760, 935]],
        rings: 3,
        sheet: 0.4,
        seed: 1607,
      }),
      // 7. Across collar beam
      new S.Web({
        hub: [860, 430],
        anchors: [[780, 420], [940, 420], [920, 480], [800, 480]],
        rings: 4,
        sheet: 0.45,
        seed: 1608,
      }),
      // 8. Gable corner left
      new S.Web({
        hub: [80, 460],
        anchors: [[20, 420], [140, 420], [120, 520], [30, 520]],
        rings: 3,
        sheet: 0.4,
        seed: 1609,
      }),
      // 9. Gable corner right
      new S.Web({
        hub: [1840, 460],
        anchors: [[1780, 420], [1900, 420], [1890, 520], [1800, 520]],
        rings: 3,
        sheet: 0.4,
        seed: 1610,
      }),
    ];
  }

  // ── Makeover Beats (L2) ─────────────────────────────────────────────
  const makeover = {
    beats: [
      { name: 'boards', key: 'boards', from: 3.3, to: 4.0, ease: 'out', chime: 0.5 },
      { name: 'bulb', key: 'bulb', from: 4.0, to: 4.4, ease: 'out', chime: 0.6 },
      { name: 'sheets', key: 'sheets', from: 4.4, to: 5.0, ease: 'out', chime: 0.7 },
    ],
    uniqueBeat: {
      key: 'boards',
      at: 3.3,
      run(mk, t, fx) {
        if (t >= 3.3) {
          mk.windowLight = S.clamp((t - 3.3) / 0.7, 0, 1);
        }
        if (t >= 4.0) {
          mk.bulbSteady = S.clamp((t - 4.0) / 0.4, 0, 1);
        }
        if (t >= 4.4) {
          mk.sheetsOff = S.clamp((t - 4.4) / 0.6, 0, 1);
        }
        void fx;
      },
    },
  };

  // ── Story Object (L2) ───────────────────────────────────────────────
  const storyObject = "In the nest, an old torch. Engraved on it: 'A. Ashworth'. She was the one who tried before you.";

  // ── QA Staging (L2) ─────────────────────────────────────────────────
  const qa = {
    heroX: { dirty: 1780, makeover: 960, clean: 960 },
    action: {
      heroX: 760,
      aimAt: { x: 960, y: 350 },
      strings: [
        { x: 500, targetY: 400, seed: 1601 },
      ],
      crawlers: [
        { lair: { x: 260, y: 810 }, seed: 1602 },
      ],
      eggs: [
        { x: 860, y: 840 },
      ],
      hatchlings: [
        { x: 1200, seed: 1603 },
      ],
    },
    states: {
      makeover(api) {
        api.holdDirector?.();
        api.placeHero(960);
        api.step(0.5);
        api.startMakeover?.();
        api.step(3.9); // prompt: t ≈ 3.9 s
      },
      'queen-nest'(api) {
        api.setState('playing');
        api.placeHero(760, 'floor');
        api.aimAt(960, 360);
        const b = api.world.spawnBoss('spider-queen');
        if (b) {
          b.phase = 'nest';
          b.lungeCycleTimer = 3.15; // the next step lands at the lunge's peak, head out of the mouth
          b.lunging = true;
          b.telegraph = false;
          b.y = 410; // mid-lunge out of mouth
          b.mandiblesOpen = 1.0;
        }
        api.step(0.1);
      },
      'queen-swing'(api) {
        api.setState('playing');
        api.placeHero(800, 'collar-beam');
        api.world.switchWeapon?.('web-cutter');
        api.aimAt(1000, 240);
        const b = api.world.spawnBoss('spider-queen');
        if (b) {
          b.phase = 'descend';
          b.lineActive = true;
          b.stunned = false;
          b.tear = true;
          b.x = 1180;
          b.y = 440;
          b.rig.x = b.x;
          b.rig.y = b.y;
        }
        api.step(0.1);
      },
      'queen-rage'(api) {
        api.setState('playing');
        api.placeHero(1200, 'floor');
        api.aimAt(850, 360);
        const b = api.world.spawnBoss('spider-queen');
        if (b) {
          b.phase = 'rage';
          b.lineActive = false;
          b.tear = true;
          b.brokenLeg = true;
          b.leaping = true;
          b.x = 850;
          b.y = 360;
          b.leapVx = 220;
          b.leapVy = -120;
          b.rig.x = b.x;
          b.rig.y = b.y;
        }
        api.step(0.1);
      },
    },
  };

  // ── Register Attic ──────────────────────────────────────────────────
  S.rooms.register({
    id: 'attic',
    number: 12,
    act: 3,
    name: 'Attic',
    art: true,
    layout,
    rules,
    makeWebs,
    makeover,
    storyObject,
    qa,

    onStart(world, info) {
      if (world && world.live) {
        world.live.world = world;
      }
    },
  });
})();
