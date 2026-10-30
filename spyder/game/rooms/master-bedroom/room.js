/*
 * Spyder — Room 8: the Master Bedroom.
 *
 * The parents' bedroom, untouched for fifteen years: a big bed with a quilted cover,
 * a wardrobe in the corner, a dressing table with a three-fold mirror ringed with bulbs,
 * lace curtains. Cozy-creepy; the wardrobe is where the spiders live.
 *
 * This file contains ONLY the [LOGIC] sections per prompts/10-master-bedroom.md:
 * layout data, platforms, lairs, drop points, rules (including extraGoals), bouncy bed,
 * wardrobe nest mechanics, procedural radio song, makeover timing, story object,
 * and QA staging hooks.
 *
 * Art, painting, lighting, and blockouts are attached via rooms/master-bedroom/art.js.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  // ── Layout constants (stage units) ──────────────────────────────────

  const CEILING = 110;
  const PICTURE_RAIL = 170;
  const FLOOR_LINE = 770;
  const GROUND = 935;

  const WINDOW = { x: 760, y: 180, w: 240, h: 290 };

  // ── Props list for blockout / layout inspection ─────────────────────

  const props = [
    { name: 'Ceiling, coving', x: 0, y: 0, w: 1920, h: CEILING, kind: 'wall' },
    { name: 'Wall with picture rail at y 170', x: 0, y: CEILING, w: 1920, h: FLOOR_LINE - CEILING, kind: 'wall' },
    { name: 'Wardrobe (the nest)', x: 120, y: 260, w: 260, h: 590, kind: 'furniture' },
    { name: 'Left nightstand with lamp and radio', x: 430, y: 790, w: 100, h: 145, kind: 'furniture' },
    { name: 'Bed with quilted cover', x: 540, y: 520, w: 640, h: 415, kind: 'furniture' },
    { name: 'Window with lace curtains', x: 760, y: 180, w: 240, h: 290, kind: 'window' },
    { name: 'Hat-box shelf', x: 700, y: 520, w: 350, h: 30, kind: 'furniture' },
    { name: 'Right nightstand with lamp', x: 1200, y: 790, w: 90, h: 145, kind: 'furniture' },
    { name: 'Dressing table with three-fold mirror and wedding photo', x: 1360, y: 420, w: 240, h: 515, kind: 'story' },
    { name: 'Chest of drawers', x: 1640, y: 800, w: 180, h: 135, kind: 'furniture' },
    { name: 'Floor and rug by the bed', x: 0, y: FLOOR_LINE, w: 1920, h: 1080 - FLOOR_LINE, kind: 'wall' },
  ];

  // ── Platforms ───────────────────────────────────────────────────────
  // Jump reach: rise <= 190 px, gap <= 160 px — except from the bouncy bed (L2),
  // which allows a rise <= 270 px (to hat-box shelf at 520, 260 px above mattress at 780).
  const platforms = [
    { name: 'floor', x0: 0, x1: 1920, y: GROUND, oneWay: false },
    { name: 'left-nightstand', x0: 435, x1: 525, y: 790, oneWay: true },
    { name: 'mattress', x0: 570, x1: 1170, y: 780, oneWay: true },
    { name: 'hat-box-shelf', x0: 705, x1: 1045, y: 520, oneWay: true },
    { name: 'right-nightstand', x0: 1205, x1: 1285, y: 790, oneWay: true },
    { name: 'dressing-table', x0: 1365, x1: 1595, y: 760, oneWay: true },
    { name: 'chest', x0: 1645, x1: 1815, y: 800, oneWay: true },
  ];

  // ── Lairs & drop points ─────────────────────────────────────────────

  // String spiders drop from four ceiling points and the curtain rail (x 880)
  const dropPoints = [300, 500, 880, 1250, 1600];

  // Crawler lairs: behind the headboard, under the dressing table, behind the chest
  const lairs = [
    { x: 570, y: 650, label: 'behind the headboard' },
    { x: 1480, y: 840, label: 'under the dressing table' },
    { x: 1730, y: 860, label: 'behind the chest' },
  ];

  const layout = {
    name: 'Master Bedroom',
    act: 2,
    number: 8,
    CEILING,
    PICTURE_RAIL,
    FLOOR_LINE,
    GROUND,
    heroStart: 960,
    bounds: { left: 120, right: 1840 },
    platforms,
    props,
    dropPoints,
    hoverBand: [280, 600],
    lairs,
    wallArea: { x0: 120, x1: 1840, y0: CEILING + 10, y1: FLOOR_LINE - 10 },
    window: WINDOW,
    lookout: { x: WINDOW.x + WINDOW.w / 2, y: WINDOW.y + 120 },
    breakables: [{ x: 380, y: GROUND, contains: 'flamethrower' }],
  };

  // ── Webs (>= 6) ─────────────────────────────────────────────────────

  function makeWebs() {
    return [
      // 1. Across the wardrobe's top (x 120-380, top y 260)
      new S.Web({
        hub: [250, 240],
        anchors: [[120, 260], [180, 180], [280, 160], [380, 260], [320, 310], [160, 310]],
        rings: 6,
        sheet: 0.5,
        seed: 801,
      }),
      // 2. Curtain rail to ceiling (window x 760-1000, rail y 180)
      new S.Web({
        hub: [880, 140],
        anchors: [[760, CEILING], [880, CEILING], [1000, CEILING], [1000, 190], [880, 180], [760, 190]],
        rings: 5,
        sheet: 0.45,
        seed: 802,
      }),
      // 3. Between the bedposts (headboard post x 560, footboard post x 1170)
      new S.Web({
        hub: [570, 600],
        anchors: [[540, 520], [600, 520], [640, 660], [580, 780], [540, 720]],
        rings: 5,
        sheet: 0.4,
        seed: 803,
      }),
      // 4. The mirror's top corner (dressing table mirror x 1360-1600, top y 420)
      new S.Web({
        hub: [1370, 430],
        anchors: [[1360, 420], [1430, 420], [1450, 480], [1390, 520], [1360, 480]],
        rings: 5,
        sheet: 0.45,
        seed: 804,
      }),
      // 5. Under the bed (mattress y 780 to floor y 935)
      new S.Web({
        hub: [870, 860],
        anchors: [[650, 780], [1080, 780], [1120, 935], [600, 935]],
        rings: 6,
        sheet: 0.5,
        seed: 805,
      }),
      // 6. The hat boxes (shelf x 700-1050, y 520)
      new S.Web({
        hub: [850, 490],
        anchors: [[740, 520], [780, 460], [920, 460], [960, 520], [860, 520]],
        rings: 5,
        sheet: 0.4,
        seed: 806,
      }),
      // 7. Dressing table right edge to wall
      new S.Web({
        hub: [1610, 600],
        anchors: [[1590, 500], [1640, 560], [1640, 680], [1595, 760], [1560, 680]],
        rings: 5,
        sheet: 0.35,
        seed: 807,
      }),
    ];
  }

  // ── Rules (L2, L3) ──────────────────────────────────────────────────

  const rules = {
    quota: 18,
    webGoal: 0.85,
    types: ['string', 'crawler', 'jumper', 'eggCarrier'],
    spawnPattern: ['string', 'crawler', 'eggCarrier', 'string', 'jumper', 'crawler', 'string', 'eggCarrier'],
    maxAlive: [3, 4],
    spawnInterval: [2.4, 1.3],
    extraGoals: [{ id: 'nest', label: 'Wardrobe nest' }],
  };

  // ── Procedural Radio Song & Static (L4) ──────────────────────────────
  // The radio hisses with static and odd half-heard phrases in dirty state.
  // At makeover beat 'radio' (4.3 s), static clears into a soft waltz melody
  // on a warm triangle/sine voice over a two-chord pad, filtered like an old radio.

  let radioAudio = null;

  function initRadioAudio(audio) {
    if (!audio || !audio.ctx) return;
    if (radioAudio && radioAudio.ctx === audio.ctx) return;

    const ctx = audio.ctx;
    const radioMaster = ctx.createGain();
    radioMaster.gain.setValueAtTime(0.7, ctx.currentTime);
    radioMaster.connect(audio.ambBus || audio.master);

    // Vintage radio bandpass filter
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1400;
    bandpass.Q.value = 1.2;
    bandpass.connect(radioMaster);

    // Static noise node
    const staticGain = ctx.createGain();
    staticGain.gain.setValueAtTime(0.04, ctx.currentTime);

    const noiseLength = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseSource.connect(staticGain);
    staticGain.connect(bandpass);
    try {
      noiseSource.start();
    } catch (_) {}

    radioAudio = {
      ctx,
      radioMaster,
      bandpass,
      staticGain,
      noiseSource,
      songPlaying: false,
      nodes: [],
    };
  }

  function playRadioSong(audio) {
    if (!radioAudio || !radioAudio.ctx) return;
    if (radioAudio.songPlaying) return;
    radioAudio.songPlaying = true;

    const ctx = radioAudio.ctx;
    const now = ctx.currentTime;

    // Fade out static
    radioAudio.staticGain.gain.linearRampToValueAtTime(0, now + 0.6);

    // Filter adapts to warm vintage radio
    radioAudio.bandpass.frequency.setTargetAtTime(1200, now, 0.4);
    radioAudio.bandpass.Q.setTargetAtTime(0.8, now, 0.4);

    // Pad gain
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0.001, now);
    padGain.gain.exponentialRampToValueAtTime(0.12, now + 1.2);
    padGain.connect(radioAudio.bandpass);

    // Pad chord oscillators (two-chord waltz: C maj7 -> Am7)
    const chord1 = [261.63, 329.63, 392.00, 493.88]; // C, E, G, B
    const chord2 = [220.00, 261.63, 329.63, 392.00]; // A, C, E, G

    const padOscs = [];
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(chord1[i], now);
      osc.connect(padGain);
      try {
        osc.start(now);
      } catch (_) {}
      padOscs.push(osc);
    }
    radioAudio.nodes.push(...padOscs, padGain);

    // Melody synth voice
    const melodyGain = ctx.createGain();
    melodyGain.gain.setValueAtTime(0.001, now);
    melodyGain.gain.exponentialRampToValueAtTime(0.18, now + 0.5);
    melodyGain.connect(radioAudio.bandpass);

    const melOsc = ctx.createOscillator();
    melOsc.type = 'triangle';
    melOsc.connect(melodyGain);
    try {
      melOsc.start(now);
    } catch (_) {}
    radioAudio.nodes.push(melOsc, melodyGain);

    // 16-bar waltz sequence (tempo ~ 60 BPM for 3/4 = 1.5s per bar)
    const bar = 1.4;
    // Notes: [freq, startOffset, duration]
    const notes = [
      // Bars 1-4: C maj
      [659.25, 0 * bar, bar * 0.9],         // E5
      [587.33, 1 * bar, bar * 0.4],         // D5
      [523.25, 1 * bar + bar * 0.4, bar * 0.5], // C5
      [659.25, 2 * bar, bar * 0.9],         // E5
      [783.99, 3 * bar, bar * 0.9],         // G5
      // Bars 5-8: Am (pad switch at bar 4)
      [659.25, 4 * bar, bar * 0.6],         // E5
      [587.33, 4 * bar + bar * 0.6, bar * 0.3], // D5
      [523.25, 5 * bar, bar * 0.6],         // C5
      [493.88, 5 * bar + bar * 0.6, bar * 0.3], // B4
      [440.00, 6 * bar, bar * 0.9],         // A4
      [523.25, 7 * bar, bar * 0.3],         // C5
      [587.33, 7 * bar + bar * 0.3, bar * 0.3], // D5
      [659.25, 7 * bar + bar * 0.6, bar * 0.3], // E5
      // Bars 9-12: F/C
      [698.46, 8 * bar, bar * 0.9],         // F5
      [659.25, 9 * bar, bar * 0.4],         // E5
      [587.33, 9 * bar + bar * 0.4, bar * 0.5], // D5
      [523.25, 10 * bar, bar * 0.9],        // C5
      [587.33, 11 * bar, bar * 0.9],        // D5
      // Bars 13-16: G7 -> C
      [659.25, 12 * bar, bar * 0.6],        // E5
      [587.33, 12 * bar + bar * 0.6, bar * 0.3], // D5
      [493.88, 13 * bar, bar * 0.9],        // B4
      [523.25, 14 * bar, bar * 1.8],        // C5 resolution
    ];

    // Schedule pad chord change at bar 4 and bar 12
    for (let i = 0; i < 4; i++) {
      padOscs[i].frequency.setValueAtTime(chord1[i], now);
      padOscs[i].frequency.setValueAtTime(chord2[i], now + 4 * bar);
      padOscs[i].frequency.setValueAtTime(chord1[i], now + 8 * bar);
      padOscs[i].frequency.setValueAtTime(chord2[i], now + 12 * bar);
    }

    // Schedule melody notes
    for (const [freq, offset, dur] of notes) {
      const noteTime = now + 0.2 + offset;
      melOsc.frequency.setValueAtTime(freq, noteTime);
      melodyGain.gain.setValueAtTime(0.001, noteTime);
      melodyGain.gain.linearRampToValueAtTime(0.18, noteTime + 0.05);
      melodyGain.gain.linearRampToValueAtTime(0.001, noteTime + dur);
    }

    // After 16 bars (~22s), fade to a quiet warm pad loop
    const endTime = now + 16 * bar;
    melodyGain.gain.setValueAtTime(0.001, endTime);
    padGain.gain.setTargetAtTime(0.06, endTime, 2.0);
  }

  function stopRadioAudio() {
    if (!radioAudio) return;
    try {
      if (radioAudio.noiseSource) radioAudio.noiseSource.stop();
      for (const node of radioAudio.nodes) {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      }
      if (radioAudio.radioMaster) radioAudio.radioMaster.disconnect();
    } catch (_) {}
    radioAudio = null;
  }

  // ── Makeover ────────────────────────────────────────────────────────

  const makeover = {
    beats: [
      // Dressing-table vanity bulbs come on one by one, 0.12 s apart (3.3 - 4.1 s)
      { name: 'lights', key: 'lights', from: 3.3, to: 4.1, ease: 'linear' },
      // Wedding photo stands up (3.9 - 4.3 s)
      { name: 'photo', key: 'photo', from: 3.9, to: 4.3, ease: 'out' },
      // Radio static clears into a soft song (4.3 - 4.8 s)
      { name: 'radio', key: 'radio', from: 4.3, to: 4.8, ease: 'out' },
    ],
    uniqueBeat: {
      key: 'radio',
      at: 4.3,
      run(mk, t, fx) {
        if (t >= 4.3 && !mk._radioStarted) {
          mk._radioStarted = true;
          if (S.audio) playRadioSong(S.audio);
        }
        void fx;
      },
    },
  };

  const storyObject = "On the dressing table: Arthur and Eleanor's wedding photograph, 1968.";

  // ── Gameplay Mechanics (L2) ─────────────────────────────────────────

  // Bouncy bed, wardrobe nest timing, and dart interception
  let jumpKeysDown = false;
  let prevHeroVy = 0;

  function onKeyDown(e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
      jumpKeysDown = true;
    }
  }

  function onKeyUp(e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
      jumpKeysDown = false;
    }
  }

  function onBlur() {
    jumpKeysDown = false;
  }

  // Wardrobe doorway hit area
  const WARDROBE_DOORWAY = { x0: 140, x1: 360, y0: 280, y1: 830 };

  function checkDartHitNest(dart, world) {
    const live = world.live;
    if (!live || live.nestDestroyed) return false;
    // While doors are open, darts that enter the doorway hit the nest
    if (live.doorsOpen <= 0.1) return false;

    const dx = dart.x;
    const dy = dart.y;
    if (dx >= WARDROBE_DOORWAY.x0 && dx <= WARDROBE_DOORWAY.x1 &&
        dy >= WARDROBE_DOORWAY.y0 && dy <= WARDROBE_DOORWAY.y1) {
      // Dart hit the nest!
      live.nestHits = (live.nestHits || 0) + 1;
      live.nestTorn = Math.min(1, live.nestHits / 8);

      world.burst.fibres(dx, dy, 10);
      world.burst.goo(dx, dy, 0.5);
      world.sfx('rip', 0.8);

      if (live.nestHits >= 8) {
        // Nest destroyed!
        live.nestDestroyed = true;
        live.doorsOpen = 1;
        world.award(500, 250, 500, 'Nest!');
        world.completeGoal('nest');
      }
      return true; // consumed dart
    }
    return false;
  }

  function updateWardrobeNest(dt, world) {
    const live = world.live;
    if (!live) return;

    if (live.nestDestroyed) {
      // When destroyed: the doors swing open and stay still, no more spawns come from it
      live.doorsOpen = 1;
      return;
    }

    live.nestTimer = (live.nestTimer ?? (world.stats.kills >= 1 ? 8.0 : 10.0)) - dt;

    if (live.nestTimer <= 0) {
      // Open doors for 2.5 s and tumble hatchlings out
      const interval = (world.stats.kills >= 1) ? 8.0 : 10.0;
      live.nestTimer = interval;
      live.doorsOpenDuration = 2.5;
      world.sfx('creak', 0.8);

      // 2–3 hatchlings tumble out
      const count = 2 + (Math.random() > 0.5 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const seed = ((world.time * 1000) | 0) + i * 37;
        const h = new S.spiders.Hatchling({
          x: 220 + i * 35,
          y: 560 + i * 20,
          originX: 250,
          originY: 560,
          fromWall: true,
          dir: 1, // tumble right out of wardrobe
          seed,
        });
        world.critters.push(h);
      }
    }

    if (live.doorsOpenDuration > 0) {
      live.doorsOpenDuration -= dt;
      // Doors stay open for the 2.5s duration
      live.doorsOpen = S.damp(live.doorsOpen || 0, 1.0, 10, dt);
    } else {
      live.doorsOpen = S.damp(live.doorsOpen || 0, 0, 3, dt);
    }
  }

  function updateBouncyBed(dt, world) {
    const live = world.live;
    const hero = world.hero;
    if (!hero) return;

    // Track hero vertical speed before landing
    if (!hero.onGround) {
      prevHeroVy = hero.vy;
    }

    // Recover quilt dent
    if (live && live.quiltDent) {
      live.quiltDent = S.damp(live.quiltDent, 0, 5, dt);
    }
  }

  function handleHeroLanding(platform, world) {
    if (!platform || platform.name !== 'mattress') return;

    // Downward speed > 300 px/s bounces the hero up at 1.35x normal jump speed
    if (prevHeroVy > 300) {
      const normalJump = S.Hero.PHYS.jumpSpeed || 1060;
      const holdingJump = jumpKeysDown || (world.hero.buffer > 0);
      const bounceMult = holdingJump ? 1.35 : 0.85;
      const bounceSpeed = normalJump * bounceMult;

      world.hero.vy = -bounceSpeed;
      world.hero.onGround = false;
      world.hero.coyote = 0;
      world.hero.buffer = 0;

      world.sfx('creak', 0.8);

      if (world.live) {
        world.live.quiltDent = 1.0;
        world.live.quiltDentX = world.hero.x; // where the art dents the quilt
      }
    }
  }

  // ── QA States ───────────────────────────────────────────────────────

  const qa = {
    heroX: { dirty: 960, makeover: 960, clean: 960 },
    action: {
      heroX: 860,
      aimAt: { x: 300, y: 450 },
      strings: [
        { x: 880, targetY: 420, seed: 811 }, // dropping from curtain rail
        { x: 1250, targetY: 460, seed: 812 },
      ],
      crawlers: [
        { lair: { x: 570, y: 650 }, seed: 813 }, // behind headboard
      ],
      eggs: [
        { x: 1100, y: 620 },
      ],
      hatchlings: [
        { x: 960, seed: 815 },
      ],
      tear: { webs: 2, path: [230, 220, 270, 250] },
      kills: 9,
      score: 6420,
    },
    states: {
      makeover(api) {
        api.holdDirector();
        api.placeHero(960);
        api.step(0.5);
        api.startMakeover();
        api.step(3.9); // t ≈ 3.9 s (bulbs on, photo standing)
      },
      nest(api) {
        api.setState('playing');
        api.holdDirector();

        // The wardrobe doors open mid-burst, nest half torn
        const live = api.world.live;
        if (live) {
          live.doorsOpen = 1.0;
          live.doorsOpenDuration = 1.5;
          live.nestHits = 4;
          live.nestTorn = 0.5;
        }

        // Two hatchlings tumbling out
        const h1 = new S.spiders.Hatchling({
          x: 230,
          y: 520,
          originX: 250,
          originY: 520,
          fromWall: true,
          dir: 1,
          seed: 821,
        });
        const h2 = new S.spiders.Hatchling({
          x: 270,
          y: 570,
          originX: 250,
          originY: 570,
          fromWall: true,
          dir: 1,
          seed: 822,
        });
        api.world.critters.push(h1, h2);

        // Hero mid-bounce above the bed aiming at the wardrobe
        api.placeHero(870, 'mattress');
        api.hero.y = 620; // mid-air above mattress (780)
        api.hero.vy = -600;
        api.hero.onGround = false;
        api.hero.facing = -1;

        api.aimAt(250, 520);
      },
    },
  };

  // ── Register Room ───────────────────────────────────────────────────

  S.rooms.register({
    id: 'master-bedroom',
    number: 8,
    act: 2,
    name: 'Master Bedroom',
    layout,
    makeWebs,
    rules,
    makeover,
    storyObject,
    qa,
    art: true,
    onStart(world, info) {
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
      }
      jumpKeysDown = false;
      prevHeroVy = 0;

      // Start procedural radio audio
      initRadioAudio(world.audio);

      world.on('dart', ({ dart }) => checkDartHitNest(dart, world));
      world.on('land', ({ platform }) => handleHeroLanding(platform, world));
    },
    onUpdate(dt, world) {
      updateWardrobeNest(dt, world);
      updateBouncyBed(dt, world);
    },
    onLeave() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
      }
      stopRadioAudio();
    },
  });
})();
