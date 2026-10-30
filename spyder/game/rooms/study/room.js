/*
 * Spyder — Room 10: the Study / Library.
 *
 * The grandfather's study turned family library: floor-to-ceiling bookcases
 * with a rolling library ladder, a gallery walkway above, a big desk with a
 * green banker's lamp, an illuminated globe, a leather armchair, a leaded window.
 * Slower and quieter than the other rooms: a room to explore.
 *
 * This file contains ONLY the [LOGIC] sections per prompts/13-study.md:
 * layout data, platforms, rolling ladder physics, lore pages puzzle,
 * rules, makeover beats, story object, and QA staging hooks.
 *
 * Art, painting, lighting, and blockouts are in rooms/study/art.js.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  // ── Layout constants (stage units) ──────────────────────────────────
  const CEILING = 100;
  const FLOOR_LINE = 770;
  const GROUND = 935;

  const WINDOW = { x: 1560, y: 200, w: 260, h: 400 };

  // ── Props list for blockout / layout inspection ─────────────────────
  const props = [
    { name: 'Ceiling with beams', x: 0, y: 0, w: 1920, h: CEILING, kind: 'wall' },
    { name: 'Bookcases, lower tier', x: 120, y: 400, w: 1380, h: 450, kind: 'furniture' },
    { name: 'Gallery walkway', x: 120, y: 560, w: 1380, h: 30, kind: 'furniture' },
    { name: 'Bookcases, upper tier', x: 120, y: 110, w: 1380, h: 450, kind: 'furniture' },
    { name: 'Rolling ladder on a rail', x: 400, y: 230, w: 70, h: 705, kind: 'furniture' },
    { name: 'Leaded window', x: 1560, y: 200, w: 260, h: 400, kind: 'window' },
    { name: "Desk with banker's lamp", x: 760, y: 770, w: 400, h: 165, kind: 'story' },
    { name: 'Illuminated globe on a stand', x: 1250, y: 640, w: 120, h: 220, kind: 'light' },
    { name: 'Leather armchair with reading lamp', x: 1560, y: 720, w: 220, h: 215, kind: 'furniture' },
    { name: 'Floor and Persian rug', x: 0, y: FLOOR_LINE, w: 1920, h: 1080 - FLOOR_LINE, kind: 'wall' },
  ];

  // ── Platforms ───────────────────────────────────────────────────────
  // Jump reach: rise <= 190 px, gap <= 160 px.
  // The rolling ladder is the only way up to the gallery walkway at y 560.
  const platforms = [
    { name: 'floor', x0: 0, x1: 1920, y: GROUND, oneWay: false },
    { name: 'desk', x0: 765, x1: 1155, y: 770, oneWay: true },
    { name: 'armchair', x0: 1570, x1: 1770, y: 800, oneWay: true },
    { name: 'gallery-walkway', x0: 120, x1: 1500, y: 560, oneWay: true },
    { name: 'ladder-rung-1', x0: 400, x1: 470, y: 810, oneWay: true },
    { name: 'ladder-rung-2', x0: 400, x1: 470, y: 685, oneWay: true },
    { name: 'ladder-rung-3', x0: 400, x1: 470, y: 560, oneWay: true },
  ];

  // ── Lairs & drop points ─────────────────────────────────────────────
  const dropPoints = [280, 520, 780, 1020, 1260, 1450, 1680];

  const lairs = [
    { x: 450, y: 300, label: 'behind upper tier books' },
    { x: 860, y: 840, label: 'under the desk' },
    { x: 1310, y: 780, label: 'behind the globe' },
    { x: 1580, y: 400, label: 'the window frame' },
  ];

  const layout = {
    name: 'Study',
    act: 3,
    number: 10,
    CEILING,
    FLOOR_LINE,
    GROUND,
    heroStart: 960,
    bounds: { left: 100, right: 1840 },
    platforms,
    props,
    dropPoints,
    hoverBand: [260, 580],
    lairs,
    wallArea: { x0: 120, x1: 1820, y0: CEILING + 10, y1: FLOOR_LINE - 10 },
    window: WINDOW,
    lookout: { x: WINDOW.x + WINDOW.w / 2, y: WINDOW.y + 120 },
    breakables: [{ x: 600, y: 560, contains: 'coins' }],
  };

  // ── Webs (>= 7 webs) ────────────────────────────────────────────────
  // Covering webs for lore pages:
  // - Web 1: across window (x 1560-1820, y 200-450) -> covers Page 3 (high window)
  // - Web 2: gallery bookcases (x 320-480, y 420-560) -> covers Page 1 (gallery)
  // - Web 3: over the globe (x 1240-1380, y 620-800) -> covers Page 2 (globe)
  function makeWebs() {
    return [
      // 0. Ladder top / rail
      new S.Web({
        hub: [440, 240],
        anchors: [[380, 230], [500, 230], [480, 310], [400, 310]],
        rings: 5,
        sheet: 0.45,
        seed: 1301,
      }),
      // 1. Across the leaded window (covers Page 3)
      new S.Web({
        hub: [1690, 320],
        anchors: [[1560, 220], [1720, 200], [1820, 250], [1820, 420], [1680, 440], [1560, 360]],
        rings: 6,
        sheet: 0.5,
        seed: 1302,
      }),
      // 2. Between two bookcases on the gallery (covers Page 1)
      new S.Web({
        hub: [380, 500],
        anchors: [[300, 420], [460, 420], [460, 560], [300, 560]],
        rings: 5,
        sheet: 0.45,
        seed: 1303,
      }),
      // 3. Over the globe on stand (covers Page 2)
      new S.Web({
        hub: [1310, 720],
        anchors: [[1250, 650], [1370, 650], [1370, 800], [1250, 800]],
        rings: 5,
        sheet: 0.4,
        seed: 1304,
      }),
      // 4. Under the desk
      new S.Web({
        hub: [960, 850],
        anchors: [[780, 780], [1140, 780], [1140, 935], [780, 935]],
        rings: 6,
        sheet: 0.5,
        seed: 1305,
      }),
      // 5. Ceiling beam
      new S.Web({
        hub: [800, 150],
        anchors: [[700, 100], [900, 100], [880, 220], [720, 220]],
        rings: 5,
        sheet: 0.4,
        seed: 1306,
      }),
      // 6. Upper tier bookcase right
      new S.Web({
        hub: [1100, 320],
        anchors: [[1000, 240], [1200, 240], [1200, 380], [1000, 380]],
        rings: 5,
        sheet: 0.35,
        seed: 1307,
      }),
      // 7. Corner high left
      new S.Web({
        hub: [200, 180],
        anchors: [[120, 110], [280, 110], [280, 260], [120, 260]],
        rings: 5,
        sheet: 0.4,
        seed: 1308,
      }),
    ];
  }

  // ── Rules (L2) ──────────────────────────────────────────────────────
  const rules = {
    quota: 18,
    webGoal: 0.85,
    types: ['string', 'crawler', 'jumper', 'eggCarrier', 'webWeaver'],
    spawnPattern: ['crawler', 'string', 'webWeaver', 'string', 'eggCarrier', 'crawler', 'webWeaver', 'string'],
    maxAlive: [3, 4],
    spawnInterval: [2.6, 1.5],
    extraGoals: [{ id: 'pages', label: 'Diary pages 0/3' }],
  };

  // ── Makeover Beats (L2) ─────────────────────────────────────────────
  // Shared beats, then:
  // - lamp at 3.3 s (banker's lamp turns to steady warm glow)
  // - globe at 3.7 s (globe lights from inside and spins slowly)
  // - reading at 4.3 s (armchair reading lamp comes on)
  // - books at 4.6 s (fallen books slide back onto shelves)
  const makeover = {
    beats: [
      { name: 'lamp', key: 'lamp', from: 3.3, to: 3.7, ease: 'out', chime: 0.2 },
      { name: 'globe', key: 'globe', from: 3.7, to: 4.3, ease: 'out', chime: 0.4 },
      { name: 'reading', key: 'reading', from: 4.3, to: 4.6, ease: 'out', chime: 0.6 },
      { name: 'books', key: 'books', from: 4.6, to: 5.0, ease: 'out', chime: 0.8 },
    ],
    uniqueBeat: {
      key: 'globe',
      at: 3.7,
      run(mk, t, fx) {
        if (t >= 3.7) {
          mk.globeSpin = (t - 3.7) * 0.8;
        }
        void fx;
      },
    },
  };

  // ── Story Object (L2) ───────────────────────────────────────────────
  const storyObject = "Eleanor's diary: 'Thomas says the Helper will come back one day and make the house safe.'";

  // ── Rolling Ladder & Lore Pages State ────────────────────────────────
  const LADDER_RAIL = { minX: 160, maxX: 1390, y: 230, width: 70 };

  let ladder = {
    x: 400,
    vx: 0,
    rolling: false,
    rumbleTimer: 0,
  };

  let pages = [];
  let collectedPages = 0;

  function initGameplayState() {
    ladder = {
      x: 400,
      vx: 0,
      rolling: false,
      rumbleTimer: 0,
    };
    updateLadderPlatforms();

    collectedPages = 0;
    pages = [
      { id: 1, x: 380, y: 530, coveringWebIndex: 2, state: 'hidden', vy: 0, vx: 0, age: 0, collected: false },
      { id: 2, x: 1310, y: 750, coveringWebIndex: 3, state: 'hidden', vy: 0, vx: 0, age: 0, collected: false },
      { id: 3, x: 1690, y: 320, coveringWebIndex: 1, state: 'hidden', vy: 0, vx: 0, age: 0, collected: false },
    ];
  }

  function updateLadderPlatforms() {
    const p1 = platforms.find((p) => p.name === 'ladder-rung-1');
    const p2 = platforms.find((p) => p.name === 'ladder-rung-2');
    const p3 = platforms.find((p) => p.name === 'ladder-rung-3');
    if (p1) { p1.x0 = ladder.x; p1.x1 = ladder.x + LADDER_RAIL.width; }
    if (p2) { p2.x0 = ladder.x; p2.x1 = ladder.x + LADDER_RAIL.width; }
    if (p3) { p3.x0 = ladder.x; p3.x1 = ladder.x + LADDER_RAIL.width; }

    const prop = props.find((p) => p.name === 'Rolling ladder on a rail');
    if (prop) prop.x = ladder.x;
  }

  function updateRollingLadder(dt, world) {
    const hero = world.hero;
    if (!hero) return;

    ladder.rolling = false;

    // Hero pushes ladder by walking into its foot while on the floor
    const onFloor = Math.abs(hero.y - GROUND) < 12 || (hero.standingOn && hero.standingOn.name === 'floor');
    if (onFloor) {
      const footLeft = ladder.x;
      const footRight = ladder.x + LADDER_RAIL.width;
      const heroSpeed = hero.vx !== undefined && Math.abs(hero.vx) > 10 ? hero.vx : (hero.facing * 180);

      // Pushing right: hero walking right into ladder's left side
      if (heroSpeed > 0 && hero.x >= footLeft - 24 && hero.x <= footLeft + 12) {
        const move = Math.abs(heroSpeed) * 0.6 * dt;
        if (ladder.x < LADDER_RAIL.maxX) {
          ladder.x = Math.min(LADDER_RAIL.maxX, ladder.x + move);
          hero.x = ladder.x - 22;
          ladder.rolling = true;
        } else {
          hero.x = ladder.x - 22;
        }
      }
      // Pushing left: hero walking left into ladder's right side
      else if (heroSpeed < 0 && hero.x <= footRight + 24 && hero.x >= footRight - 12) {
        const move = Math.abs(heroSpeed) * 0.6 * dt;
        if (ladder.x > LADDER_RAIL.minX) {
          ladder.x = Math.max(LADDER_RAIL.minX, ladder.x - move);
          hero.x = ladder.x + LADDER_RAIL.width + 22;
          ladder.rolling = true;
        } else {
          hero.x = ladder.x + LADDER_RAIL.width + 22;
        }
      }
    }

    if (ladder.rolling) {
      ladder.rumbleTimer -= dt;
      if (ladder.rumbleTimer <= 0) {
        world.sfx('creak', 0.5);
        ladder.rumbleTimer = 0.35;
      }
    } else {
      ladder.rumbleTimer = 0;
    }

    updateLadderPlatforms();

    // Expose ladder coordinates on live for art rendering
    if (world.live) {
      world.live.ladderX = ladder.x;
    }
  }

  function updateLorePages(dt, world) {
    const hero = world.hero;
    const webs = world.webs;

    for (const page of pages) {
      if (page.collected) continue;

      // Free page when covering web is torn below 30% silk
      if (page.state === 'hidden') {
        const coveringWeb = webs && webs[page.coveringWebIndex];
        if (coveringWeb && coveringWeb.intactness < 0.3) {
          page.state = 'falling';
          world.sfx('chime', 0.4);
          world.burst.fibres(page.x, page.y, 6);
        }
      }

      // Fluttering physics when falling
      if (page.state === 'falling') {
        page.age += dt;
        page.vy = Math.min(180, page.vy + 200 * dt);
        page.vx = Math.sin(page.age * 6) * 45;
        page.x += page.vx * dt;
        page.y += page.vy * dt;

        const floor = world.floorAt(page.x, page.y);
        if (floor !== null && page.y >= floor - 8) {
          page.y = floor - 8;
          page.vy = 0;
          page.vx = 0;
          page.state = 'settled';
        }
      }

      // Hero walks into page to collect it
      if (page.state !== 'hidden' && hero) {
        const hx = hero.x;
        const hy = hero.y - 40;
        if (Math.hypot(hx - page.x, hy - page.y) < 45) {
          page.collected = true;
          collectedPages++;
          world.award(100, page.x, page.y - 30, `Page ${collectedPages} of 3`);
          world.sfx('chime', 0.4 + collectedPages * 0.2);
          world.burst.fibres(page.x, page.y, 8);

          const goal = rules.extraGoals?.find((g) => g.id === 'pages');
          if (goal) goal.label = `Diary pages ${collectedPages}/3`;

          if (collectedPages >= 3) {
            world.completeGoal('pages');
          }
        }
      }
    }

    if (world.live) {
      world.live.pages = pages;
    }
  }

  // ── QA Staging States ───────────────────────────────────────────────
  const qa = {
    heroX: { dirty: 960, makeover: 960, clean: 960 },
    action: {
      heroX: 700,
      aimAt: { x: 450, y: 300 },
      strings: [
        { x: 520, targetY: 420, seed: 1321 },
        { x: 1260, targetY: 480, seed: 1322 },
      ],
      crawlers: [
        { lair: { x: 450, y: 300 }, seed: 1323 },
      ],
      eggs: [
        { x: 860, y: 840 },
      ],
      // x 1100: far enough from heroX (700) that it cannot close the gap and
      // bite before the staged frame renders, the way front-porch (360 px)
      // and living-room (360 px) are too far for their own hatchlings to
      // reach in the ~1 s stageAction() runs for. At the old x 920 (220 px
      // away) it closed the gap during the closing step(0.08) — right before
      // the render — so hero.invulnerable was still ~1.1 and the "hurt
      // pulse" in room-runtime.js's grade() painted a red tint over the
      // whole frame.
      hatchlings: [
        { x: 1100, seed: 1325 },
      ],
      tear: { webs: 2, path: [1600, 240, 1780, 360] },
      kills: 9,
      score: 6420,
    },
    states: {
      makeover(api) {
        api.holdDirector();
        api.placeHero(960);
        api.step(0.5);
        api.startMakeover();
        api.step(3.9); // t ≈ 3.9 s: banker's lamp warm, globe lighting & spinning
      },
      weaver(api) {
        // QA state: a Web Weaver spinning a new web on the gallery rail,
        // the hero on the ladder's top rung using the Web-Cutter, a diary page fluttering down.
        api.setState('playing');
        api.holdDirector();

        // Position ladder under gallery walkway at x 480
        ladder.x = 480;
        updateLadderPlatforms();
        if (api.world.live) api.world.live.ladderX = 480;

        // Hero on the ladder's top rung (y 560) using Web-Cutter
        api.placeHero(515, 'ladder-rung-3');
        api.switchWeapon('web-cutter');
        api.hero.facing = 1;
        api.aimAt(800, 500);

        // Web Weaver spinning a new web on the gallery rail (x 800, y 560).
        // Spawning with spinning:true runs the Weaver's own startSpinning()
        // (see web-weaver.js), which puts it in the 'spinning' state with an
        // empty, growing web. Stepping the room from here — rather than
        // poking spinTimer and segments by hand — lets its own
        // updateSpinningWeb() grow the web to about half, and gives
        // game.time a non-zero value so the front-leg weaving pose (which
        // animates off game.time in web-weaver.js's draw()) actually reads
        // as weaving instead of a frozen walking stance.
        api.world.critters.length = 0;
        const weaver = api.spawn('webWeaver', {
          x: 800,
          y: 560,
          spinning: true,
          spinDuration: 5.0,
          seed: 1331,
        });
        if (weaver && weaver.rig) {
          weaver.rig.x = 800;
          weaver.rig.y = 560;
        }
        api.step(2.5); // half of spinDuration: web half grown, legs mid-weave

        // A diary page fluttering down
        if (pages.length > 0) {
          pages[0].state = 'falling';
          pages[0].x = 650;
          pages[0].y = 660;
          pages[0].vy = 80;
          pages[0].age = 1.2;
        }
      },
    },
  };

  // ── Register Room ───────────────────────────────────────────────────
  S.rooms.register({
    id: 'study',
    number: 10,
    act: 3,
    name: 'Study',
    layout,
    makeWebs,
    rules,
    makeover,
    storyObject,
    qa,
    art: true,
    onStart(world) {
      initGameplayState();
      if (world.live) {
        world.live.ladderX = ladder.x;
        world.live.pages = pages;
      }
    },
    onUpdate(dt, world) {
      updateRollingLadder(dt, world);
      updateLorePages(dt, world);
    },
    onLeave() {
      // Cleanup
    },
  });
})();
