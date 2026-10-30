/*
 * Spyder — Room 6: the Downstairs Bathroom.
 *
 * A small, tiled downstairs bathroom: claw-foot tub, pedestal sink under a
 * fogged mirror, an old high-cistern toilet. Tense: harsh bare bulb, dripping
 * water, plugholes. It feels narrow — the walls close in.
 *
 * This file contains ONLY the [LOGIC] sections per prompts/08-downstairs-bathroom.md:
 * layout data, platforms, lairs, drop points, rules, makeover timing, story object,
 * and QA staging hooks.
 *
 * Painting, lighting, and props are attached via rooms/downstairs-bathroom/art.js.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  // ── Layout constants (stage units) ──────────────────────────────────

  const CEILING = 110;
  const PLASTER_END = 380;
  const FLOOR_LINE = 770;
  const GROUND = 935;

  const WINDOW = { x: 420, y: 170, w: 220, h: 160 };
  const TUB = { x0: 300, x1: 760, rimY: 760, footY: 900, drainX: 420, tapX: 360, tapY: 720 };
  const SINK = { x0: 1040, x1: 1240, rimY: 765, plugholeX: 1140, plugholeY: 790 };
  const MIRROR = { x: 1040, y: 330, w: 200, h: 250 };
  const SHELF = { x0: 1360, x1: 1600, y: 600 };
  const TOILET = { bowlX0: 1400, bowlX1: 1560, lidY: 820, cisternX0: 1420, cisternX1: 1540, cisternY0: 250, cisternY1: 330 };
  const BULB_CORD = { roseX: 960, roseY: 0, bulbY: 240 };

  // Three slippery puddles on the floor
  const PUDDLES = [
    { x0: 520, x1: 640 },
    { x0: 880, x1: 1010 },
    { x0: 1300, x1: 1380 },
  ];

  // ── Props list for blockout / layout inspection ─────────────────────

  const props = [
    { name: 'Left wall', x: 0, y: 0, w: 260, h: 1080, kind: 'wall' },
    { name: 'Right wall', x: 1660, y: 0, w: 260, h: 1080, kind: 'wall' },
    { name: 'Ceiling', x: 260, y: 0, w: 1400, h: 110, kind: 'wall' },
    { name: 'Plaster wall', x: 260, y: 110, w: 1400, h: 270, kind: 'wall' },
    { name: 'Tiled wall', x: 260, y: 380, w: 1400, h: 390, kind: 'wall' },
    { name: 'Floor', x: 0, y: 770, w: 1920, h: 310, kind: 'wall' },
    { name: 'Bare bulb', x: 940, y: 220, w: 40, h: 40, kind: 'light' },
    { name: 'Frosted window', x: 420, y: 170, w: 220, h: 160, kind: 'window' },
    { name: 'Claw-foot tub', x: 300, y: 740, w: 460, h: 160, kind: 'furniture' },
    { name: 'Shower rail & curtain', x: 300, y: 200, w: 460, h: 560, kind: 'furniture' },
    { name: 'Pedestal sink', x: 1040, y: 745, w: 200, h: 190, kind: 'furniture' },
    { name: 'Mirror cabinet', x: 1040, y: 330, w: 200, h: 250, kind: 'story' },
    { name: 'Mirror strip light', x: 1060, y: 300, w: 160, h: 20, kind: 'light' },
    { name: 'Towel shelf', x: 1360, y: 600, w: 240, h: 25, kind: 'furniture' },
    { name: 'High-cistern toilet', x: 1400, y: 250, w: 160, h: 685, kind: 'furniture' },
  ];

  // ── Platforms ───────────────────────────────────────────────────────

  const platforms = [
    { name: 'floor', x0: 0, x1: 1920, y: GROUND, oneWay: false },
    { name: 'tub', x0: 310, x1: 750, y: TUB.rimY, oneWay: true },
    { name: 'sink', x0: 1050, x1: 1230, y: SINK.rimY, oneWay: true },
    { name: 'shelf', x0: SHELF.x0, x1: SHELF.x1, y: SHELF.y, oneWay: true },
    { name: 'toilet', x0: 1410, x1: 1550, y: TOILET.lidY, oneWay: true },
  ];

  // ── Lairs & drop points ─────────────────────────────────────────────

  const dropPoints = [520, 740, 960, 1480]; // bulb cord ceiling rose at 960 and 3 other points

  const lairs = [
    { x: 1480, y: 290, label: 'behind the cistern' },
    { x: 720, y: 450, label: 'under the shower curtain' },
  ];

  const jumperLairs = [
    {
      label: 'out of the tub drain',
      surface: 'tub',
      from: { x: TUB.drainX, y: 830 },
      to: { x: TUB.drainX, y: TUB.rimY },
      moves: 'climb',
      heading: 0,
      time: 1.6,
      clip: { x0: TUB.x0 + 10, y0: TUB.rimY - 5, x1: TUB.x1 - 10, y1: 920 },
    },
    {
      label: 'out of the sink plughole',
      surface: 'sink',
      from: { x: SINK.plugholeX, y: 810 },
      to: { x: SINK.plugholeX, y: SINK.rimY },
      moves: 'climb',
      heading: 0,
      time: 1.6,
      clip: { x0: SINK.x0 + 10, y0: SINK.rimY - 5, x1: SINK.x1 - 10, y1: 920 },
    },
  ];

  const layout = {
    name: 'Downstairs Bathroom',
    act: 2,
    number: 6,
    CEILING,
    FLOOR_LINE,
    GROUND,
    heroStart: 880,
    bounds: { left: 280, right: 1640 },
    platforms,
    props,
    dropPoints,
    hoverBand: [300, 600],
    lairs,
    jumperLairs,
    wallArea: { x0: 280, x1: 1640, y0: CEILING + 10, y1: FLOOR_LINE - 20 },
    window: WINDOW,
    lookout: { x: 530, y: 250 },
    puddles: PUDDLES,
    breakables: [{ x: 1320, y: GROUND, contains: 'coins' }],
  };

  // ── Webs (>= 6) ─────────────────────────────────────────────────────

  function makeWebs() {
    return [
      // 1. Bulb cord to ceiling
      new S.Web({
        hub: [970, 70],
        anchors: [[920, CEILING], [960, 30], [960, CEILING], [960, 160], [1000, CEILING], [1020, 75]],
        rings: 5,
        sheet: 0.5,
        seed: 601,
      }),
      // 2. Tub corner under the window
      new S.Web({
        hub: [350, 420],
        anchors: [[300, 360], [300, 440], [300, 520], [360, 520], [420, 460], [400, 370]],
        rings: 6,
        sheet: 0.45,
        seed: 602,
      }),
      // 3. Behind the cistern
      new S.Web({
        hub: [1440, 290],
        anchors: [[1400, 240], [1400, 320], [1450, 340], [1520, 340], [1540, 260], [1480, 240]],
        rings: 5,
        sheet: 0.4,
        seed: 603,
      }),
      // 4. Mirror's upper corner
      new S.Web({
        hub: [1060, 360],
        anchors: [[1040, 330], [1040, 400], [1080, 410], [1120, 360], [1100, 330]],
        rings: 5,
        sheet: 0.4,
        seed: 604,
      }),
      // 5. The frosted window
      new S.Web({
        hub: [580, 210],
        anchors: [[520, 170], [450, 170], [440, 230], [500, 270], [600, 270], [630, 210]],
        rings: 6,
        sheet: 0.35,
        seed: 605,
      }),
      // 6. From the shower rail to the ceiling
      new S.Web({
        hub: [700, 150],
        anchors: [[640, CEILING], [700, CEILING], [760, CEILING], [760, 200], [720, 200], [660, 190]],
        rings: 5,
        sheet: 0.45,
        seed: 606,
      }),
    ];
  }

  // ── Rules ───────────────────────────────────────────────────────────

  const rules = {
    quota: 16,
    webGoal: 0.85,
    types: ['string', 'crawler', 'jumper'],
    spawnPattern: ['jumper', 'string', 'crawler', 'jumper', 'string', 'crawler', 'string', 'jumper'],
    maxAlive: [3, 4],
    spawnInterval: [2.2, 1.2],
  };

  // ── Makeover ────────────────────────────────────────────────────────

  const makeover = {
    beats: [
      { name: 'mirror', key: 'mirror', from: 3.3, to: 5.3, at: 3.3, ease: 'inOut' },
      { name: 'tap', key: 'tap', from: 4.0, to: 4.2, at: 4.0, ease: 'linear' },
      { name: 'bulb', key: 'bulb', from: 4.3, to: 4.8, at: 4.3, chime: 0.6, ease: 'out' },
    ],
    uniqueBeat: {
      key: 'mirror',
      at: 3.3,
      run(mk, t, fx) {
        // Demisting progress: 0 to 1 over 2.0 s (3.3 s to 5.3 s)
        mk.mirrorDemist = S.clamp((t - 3.3) / 2.0, 0, 1);
        if (t >= 4.0 && !mk.tapStopped) {
          mk.tapStopped = true;
        }
        if (t >= 4.3 && !mk.bulbSteadied) {
          mk.bulbSteadied = true;
          const a = fx.audio;
          if (a && a.ctx && !a.muted) {
            a.tone({ type: 'sine', freq: 660, freqEnd: 880, duration: 0.45, gain: 0.08 });
          }
        }
      },
    },
  };

  // ── Puddle & hero physics ───────────────────────────────────────────

  function isHeroInPuddle(hero, world) {
    if (!hero || !hero.onGround) return false;
    if (Math.abs(hero.y - GROUND) > 6) return false;
    // Puddles gone in clean state or after makeover sweep reaches them
    if (world.game?.state === 'restored' || (world.mk && world.mk.t >= 2.0)) return false;
    return PUDDLES.some((p) => hero.x >= p.x0 && hero.x <= p.x1);
  }

  // ── Bulb swing & blackout mechanics ─────────────────────────────────

  function dartHitsBulb(dart, world) {
    const bulb = world.live?.bulb;
    if (!bulb) return false;
    const dist = S.pointSegmentDistance(bulb.x, bulb.y, dart.px, dart.py, dart.x, dart.y);
    if (dist > 36) return false;
    bulb.omega += (Math.sign(dart.vx) || 1) * 1.35;
    world.burst.dustPuff(bulb.x, bulb.y, 3, 24);
    const audio = world.audio;
    if (audio && audio.ctx && !audio.muted) {
      audio.tone({ type: 'triangle', freq: 1100, freqEnd: 920, duration: 0.35, gain: 0.08 });
    }
    return true;
  }

  function swingBulb(dt, world) {
    const bulb = world.live?.bulb;
    if (!bulb) return;
    const steady = (world.mk?.bulb ?? 0) > 0.5 ? 1 : (world.game?.state === 'restored' ? 1 : 0);
    const w0 = 3.6;
    const damping = S.lerp(0.8, 3.4, steady);
    const draught = world.live.noise ? world.live.noise(world.time * 0.35 + 40) * 0.2 * (1 - steady) : 0;
    bulb.omega += (-w0 * w0 * Math.sin(bulb.theta) - damping * bulb.omega + draught) * dt;
    bulb.theta += bulb.omega * dt;

    bulb.x = BULB_CORD.roseX + Math.sin(bulb.theta) * bulb.cordLen;
    bulb.y = BULB_CORD.roseY + Math.cos(bulb.theta) * bulb.cordLen;

    // A spider landing on or touching the cord makes it swing
    for (const c of world.critters) {
      if (c.alive && !c._hitBulbCord && c.rig) {
        const d = S.pointSegmentDistance(c.rig.x, c.rig.y, BULB_CORD.roseX, BULB_CORD.roseY, bulb.x, bulb.y);
        if (d < 28) {
          c._hitBulbCord = true;
          bulb.omega += (Math.random() > 0.5 ? 1 : -1) * 0.85;
          world.burst.dustPuff(c.rig.x, c.rig.y, 2, 20);
        }
      }
    }

    // Blackouts every 8–12 s for 0.4–0.8 s
    if (world.game?.state !== 'restored' && (!world.mk || world.mk.t < 4.3)) {
      if (bulb.isBlackout) {
        bulb.blackoutRemaining -= dt;
        if (bulb.blackoutRemaining <= 0) {
          bulb.isBlackout = false;
          bulb.blackoutTimer = 8 + Math.random() * 4;
          const a = world.audio;
          if (a && a.ctx && !a.muted) {
            a.noise({ duration: 0.06, filter: 'bandpass', freq: 1400, q: 2, gain: 0.05 });
          }
        }
      } else {
        bulb.blackoutTimer -= dt;
        if (bulb.blackoutTimer <= 0) {
          bulb.isBlackout = true;
          bulb.blackoutRemaining = 0.4 + Math.random() * 0.4;
          const a = world.audio;
          if (a && a.ctx && !a.muted) {
            a.tone({ type: 'sine', freq: 110, freqEnd: 55, duration: 0.1, gain: 0.06 });
          }
        }
      }
    } else {
      bulb.isBlackout = false;
    }
  }

  // ── Dripping tap ────────────────────────────────────────────────────

  function updateDrippingTap(dt, world) {
    if (world.game?.state === 'restored') return;
    if (world.mk && (world.mk.tap > 0 || world.mk.t >= 4.0)) return;

    world.live.dripTimer = (world.live.dripTimer ?? 0) + dt;
    if (world.live.dripTimer >= 1.2) {
      world.live.dripTimer -= 1.2;
      // Splash particle inside tub basin
      world.burst.add('goo', TUB.tapX, TUB.rimY + 50, {
        vx: (Math.random() - 0.5) * 50,
        vy: -35 - Math.random() * 45,
        gravity: 1300,
        drag: 0.8,
        life: 0.22,
        size: 1.8,
        color: S.mixHex(P.silk, P.moon, 0.4),
      });
      // Plink sound
      const a = world.audio;
      if (a && a.ctx && !a.muted) {
        a.tone({ type: 'sine', freq: 2150, freqEnd: 2550, duration: 0.07, gain: 0.045, attack: 0.005 });
      }
    }
  }

  // ── QA staging ──────────────────────────────────────────────────────

  const qa = {
    heroX: { dirty: 880, makeover: 880, clean: 880 },
    action: {
      heroX: 880,
      strings: [
        { x: 520, targetY: 480 },
        { x: 960, targetY: 440 },
      ],
      crawlers: [{ lair: { x: 1480, y: 290 } }],
      eggs: [{ x: 1200, y: 640 }],
      hatchlings: [{ x: 800, seed: 91 }],
      tear: { webs: 2, path: [940, 50, 1020, 100] },
      kills: 9,
      score: 6420,
      nerve: 72,
      aimAt: { x: 520, y: 480 },
    },
    states: {
      makeover(api) {
        api.holdDirector();
        api.placeHero(880);
        api.step(0.5);
        api.startMakeover();
        api.step(3.9); // mirror half clear per prompt
      },
      drain(api) {
        api.setState('playing');
        api.holdDirector();
        api.placeHero(580); // in puddle x 520–640
        const hero = api.hero;
        hero.vx = 220;
        hero.facing = 1;
        api.world.burst.add('goo', hero.x - 8, hero.y - 2, {
          vx: -60,
          vy: -40,
          gravity: 1200,
          drag: 0.7,
          life: 0.25,
          size: 2,
          color: S.mixHex(P.silk, P.moon, 0.4),
        });

        // Bulb swinging slightly
        if (api.world.live?.bulb) {
          api.world.live.bulb.theta = 0.08;
          api.world.live.bulb.omega = 0.25;
          api.world.live.bulb.x = BULB_CORD.roseX + Math.sin(0.08) * 240;
          api.world.live.bulb.y = BULB_CORD.roseY + Math.cos(0.08) * 240;
        }

        // Jumper emerging from tub drain with leg poking out
        const jumper = api.spawn('jumper', {
          surface: 'tub',
          lair: jumperLairs[0],
          x: TUB.drainX,
          feetY: 830,
        });
        if (jumper) {
          jumper.timer = 0.55;
          jumper.emerge(0, 0.016, api.world);
        }
      },
    },
  };

  // ── Register Room ───────────────────────────────────────────────────

  let _origHeroUpdate = null;

  S.rooms.register({
    id: 'downstairs-bathroom',
    number: 6,
    act: 2,
    name: 'Downstairs Bathroom',
    art: true,
    layout,
    rules,
    makeWebs,
    makeover,
    storyObject: "In the mirror, written in old steam: 'Thomas was here.'",
    qa,

    onStart(world, info) {
      const live = world.live;
      if (live) {
        live.bulb = {
          theta: 0,
          omega: 0,
          blackoutTimer: 8 + Math.random() * 4,
          blackoutRemaining: 0,
          isBlackout: false,
          cordLen: 240,
          x: BULB_CORD.roseX,
          y: BULB_CORD.bulbY,
        };
        live.dripTimer = 0;
      }

      world.on('dart', ({ dart }) => dartHitsBulb(dart, world));

      // Wrap hero.update to drop friction inside puddles to 25% (sliding)
      // Every restart makes a new hero, so wrap each one (not just the first).
      const hero = world.hero;
      if (hero && !hero._puddleWrapped) {
        hero._puddleWrapped = true;
        _origHeroUpdate = S.Hero.prototype.update;
        hero.update = function (dt, input, roomPlat) {
          const inPuddle = isHeroInPuddle(this, world);
          const prevVx = this.vx;
          _origHeroUpdate.call(this, dt, input, roomPlat);
          if (inPuddle && this.onGround && !input.left && !input.right) {
            const brakeApplied = Math.abs(prevVx) - Math.abs(this.vx);
            if (brakeApplied > 0) {
              this.vx = prevVx - Math.sign(prevVx) * (brakeApplied * 0.25);
            }
          }
          if (inPuddle && this.onGround && Math.abs(this.vx) > 30) {
            if (Math.random() < 0.35) {
              world.burst.add('goo', this.x + (Math.random() - 0.5) * 20, this.y - 2, {
                vx: -this.vx * 0.12 + (Math.random() - 0.5) * 50,
                vy: -20 - Math.random() * 50,
                gravity: 1400,
                drag: 0.7,
                life: 0.18,
                size: 1.5,
                color: S.mixHex(P.silk, P.moon, 0.4),
              });
            }
          }
        };
      }

      if (info && info.qa === 'action') {
        world.spawn('jumper', { surface: 'tub', x: 580, state: 'crouch', crouch: 0.75, facing: 1, hold: 99 });
      }
    },

    onUpdate(dt, world) {
      swingBulb(dt, world);
      updateDrippingTap(dt, world);
    },

    direct(dt, world) {
      // First jumper has room to itself for a few seconds
      return world.critters.some((c) => c.kind === 'jumper' && c.first && c.alive && c.age < 6);
    },

    onLeave(world) {
      const hero = world.hero;
      if (hero && _origHeroUpdate) {
        hero.update = _origHeroUpdate;
        _origHeroUpdate = null;
      }
    },
  });
})();
