/*
 * Spyder — Room 9: the Kid's Bedroom (Thomas's room).
 *
 * Thomas's bedroom, kept exactly as it was the year the height marks stopped:
 * a bunk bed, a toy chest, a desk under a window, a planet mobile, a star-projector
 * night-light that still turns. The tone is slightly surreal: toys move by
 * themselves, and the night-light throws spider shadows far bigger than the spiders.
 *
 * This file contains ONLY the [LOGIC] sections per prompts/11-kids-bedroom.md:
 * layout data, platforms, lairs, drop points, rules, makeover timing, story object,
 * procedural music-box tune, and QA staging hooks.
 *
 * Art, painting, lighting, and blockouts are attached via rooms/kids-bedroom/art.js.
 */
(function () {
  'use strict';

  const S = window.Spyder;

  // ── Layout constants (stage units) ──────────────────────────────────

  const CEILING = 110;
  const FLOOR_LINE = 770;
  const GROUND = 935;

  const WINDOW = { x: 1600, y: 330, w: 200, h: 270 };

  // ── Props list for blockout / layout inspection ─────────────────────

  const props = [
    { name: 'Ceiling, a sloped dormer on the right', x: 0, y: 0, w: 1920, h: 110, kind: 'wall' },
    { name: 'Wall', x: 0, y: 110, w: 1920, h: 660, kind: 'wall' },
    { name: 'Door to the hallway', x: 110, y: 360, w: 150, h: 410, kind: 'furniture' },
    { name: 'Bunk bed', x: 300, y: 560, w: 440, h: 375, kind: 'furniture' },
    { name: 'Planet mobile', x: 800, y: 110, w: 200, h: 210, kind: 'furniture' },
    { name: 'Star-projector night-light', x: 860, y: 900, w: 40, h: 35, kind: 'light' },
    { name: 'Toy chest (a lair)', x: 820, y: 840, w: 180, h: 95, kind: 'furniture' },
    { name: 'Toy train and track', x: 760, y: 960, w: 520, h: 60, kind: 'furniture' },
    { name: 'Desk with lamp', x: 1250, y: 730, w: 300, h: 205, kind: 'furniture' },
    { name: 'Wall shelf with toys and the music box', x: 1250, y: 560, w: 300, h: 30, kind: 'furniture' },
    { name: "Thomas's drawing (story)", x: 1330, y: 430, w: 140, h: 110, kind: 'story' },
    { name: 'Dormer window with rocket curtains', x: 1600, y: 330, w: 200, h: 270, kind: 'window' },
    { name: 'Floor', x: 0, y: 770, w: 1920, h: 310, kind: 'wall' },
  ];

  // ── Platforms ───────────────────────────────────────────────────────
  // Jump reach budget: rise <= 190 px, gap <= 160 px.
  // Floor (935) -> Lower bunk (800): rise 135 px
  // Lower bunk (800) -> Upper bunk (620): rise 180 px
  // Floor (935) -> Toy chest (840): rise 95 px
  // Lower bunk (x 305-695) -> Toy chest (x 825-995): gap 130 px, y diff 40 px
  // Floor (935) -> Desk (770): rise 165 px
  // Desk (770) -> Shelf (590): rise 180 px
  const platforms = [
    { name: 'floor', x0: 0, x1: 1920, y: GROUND, oneWay: false },
    { name: 'lower-bunk', x0: 305, x1: 695, y: 800, oneWay: true },
    { name: 'upper-bunk', x0: 305, x1: 695, y: 620, oneWay: true },
    { name: 'toy-chest', x0: 825, x1: 995, y: 840, oneWay: true },
    { name: 'desk', x0: 1255, x1: 1545, y: 770, oneWay: true },
    { name: 'shelf', x0: 1260, x1: 1540, y: 590, oneWay: true },
  ];

  // ── Lairs & drop points ─────────────────────────────────────────────

  // String spiders hang from the planet mobile (x 900) as well as the ceiling
  const dropPoints = [360, 520, 700, 880, 920, 1100, 1340, 1480, 1680];

  // Crawler and Egg Carrier lairs: door gap, behind bunk headboard, under dormer slope, behind desk
  const lairs = [
    { x: 250, y: 560, label: 'the door gap' },
    { x: 310, y: 640, label: "behind the bunk's headboard" },
    { x: 1350, y: 760, label: 'behind the desk' },
    { x: 1720, y: 320, label: 'under the dormer slope' },
  ];

  // Jumpers come only from the chest (jack-in-the-box pop) and under the bunk
  const jumperLairs = [
    {
      label: 'out of the toy chest',
      surface: 'toy-chest',
      from: { x: 910, y: 880 },
      to: { x: 910, y: 840 },
      moves: 'scurry',
      heading: -Math.PI / 2,
      time: 1.0,
      chestLid: true,
    },
    {
      label: 'from under the bunk',
      surface: 'floor',
      from: { x: 420, y: 935 },
      to: { x: 550, y: 935 },
      moves: 'scurry',
      heading: 0,
      time: 1.2,
    },
  ];

  const layout = {
    name: "Kid's Bedroom",
    act: 2,
    number: 9,
    CEILING,
    FLOOR_LINE,
    GROUND,
    heroStart: 420,
    bounds: { left: 100, right: 1840 },
    platforms,
    props,
    dropPoints,
    hoverBand: [300, 620],
    lairs,
    jumperLairs,
    wallArea: { x0: 100, x1: 1840, y0: 120, y1: 760 },
    window: WINDOW,
    lookout: { x: 1700, y: 450 },
    breakables: [{ x: 1200, y: GROUND, contains: 'coins' }],
  };

  // ── Webs (>= 6) ─────────────────────────────────────────────────────

  function makeWebs() {
    return [
      // 1. Mobile to ceiling
      new S.Web({
        hub: [900, 180],
        anchors: [[860, 110], [940, 110], [940, 240], [860, 230]],
        rings: 5,
        sheet: 0.45,
        seed: 1101,
      }),
      // 2. Bunk upper corner
      new S.Web({
        hub: [320, 600],
        anchors: [[300, 520], [360, 520], [360, 630], [300, 630]],
        rings: 5,
        sheet: 0.4,
        seed: 1102,
      }),
      // 3. Dormer window
      new S.Web({
        hub: [1700, 420],
        anchors: [[1610, 340], [1790, 340], [1790, 500], [1610, 500]],
        rings: 6,
        sheet: 0.45,
        seed: 1103,
      }),
      // 4. Shelf end
      new S.Web({
        hub: [1540, 570],
        anchors: [[1510, 510], [1560, 510], [1560, 600], [1510, 600]],
        rings: 4,
        sheet: 0.35,
        seed: 1104,
      }),
      // 5. Under the desk
      new S.Web({
        hub: [1360, 840],
        anchors: [[1270, 780], [1450, 780], [1460, 910], [1280, 910]],
        rings: 5,
        sheet: 0.4,
        seed: 1105,
      }),
      // 6. Door frame
      new S.Web({
        hub: [240, 390],
        anchors: [[200, 360], [270, 360], [270, 440], [210, 450]],
        rings: 5,
        sheet: 0.4,
        seed: 1106,
      }),
      // 7. Toy chest corner
      new S.Web({
        hub: [840, 850],
        anchors: [[820, 830], [860, 830], [860, 880], [820, 880]],
        rings: 4,
        sheet: 0.35,
        seed: 1107,
      }),
    ];
  }

  // ── Rules ───────────────────────────────────────────────────────────

  const rules = {
    quota: 20,
    webGoal: 0.85,
    types: ['string', 'crawler', 'jumper', 'eggCarrier'],
    spawnPattern: ['string', 'jumper', 'crawler', 'string', 'eggCarrier', 'jumper', 'string', 'crawler'],
    maxAlive: [3, 4],
    spawnInterval: [2.3, 1.2],
  };

  // ── Makeover ────────────────────────────────────────────────────────

  const makeover = {
    beats: [
      { name: 'musicbox', key: 'musicbox', from: 3.3, to: 4.0, ease: 'out' },
      { name: 'stars', key: 'stars', from: 3.6, to: 4.5, ease: 'out' },
      { name: 'train', key: 'train', from: 4.4, to: 4.9, ease: 'out' },
      { name: 'drawing', key: 'drawing', from: 4.8, to: 5.4, ease: 'out' },
    ],
    uniqueBeat: {
      key: 'musicbox',
      at: 3.3,
      run(mk, t, fx) {
        if (!mk._musicboxStarted) {
          mk._musicboxStarted = true;
          startCleanMusicBox(fx?.world || fx);
        }
        if (t >= 4.4 && !mk._trainTooted) {
          mk._trainTooted = true;
          playTrainToot(fx?.world || fx);
        }
      },
    },
  };

  const storyObject = "Above the desk: Thomas's drawing of his family — and of someone in an orange suit.";

  // ── Train track math ────────────────────────────────────────────────
  // Oval track on floor: x 760–1280, y 960–1020
  // Left curve at 800, right curve at 1240, straight sections of 440 px, radius 30 px
  const TRACK = {
    leftX: 800,
    rightX: 1240,
    topY: 960,
    bottomY: 1020,
    r: 30,
    straightLen: 440,
    arcLen: Math.PI * 30, // ~94.25 px
  };
  TRACK.perimeter = 2 * TRACK.straightLen + 2 * TRACK.arcLen; // ~1068.5 px

  function trackPos(dist) {
    let d = ((dist % TRACK.perimeter) + TRACK.perimeter) % TRACK.perimeter;
    const { leftX, rightX, topY, bottomY, r, straightLen, arcLen } = TRACK;
    const cy = (topY + bottomY) / 2;

    // 1. Top straight (going right: leftX -> rightX)
    if (d < straightLen) {
      const t = d / straightLen;
      return { x: leftX + t * straightLen, y: topY, heading: 0 };
    }
    d -= straightLen;

    // 2. Right curve (topY -> bottomY)
    if (d < arcLen) {
      const a = -Math.PI / 2 + (d / arcLen) * Math.PI;
      return {
        x: rightX + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        heading: a + Math.PI / 2,
      };
    }
    d -= arcLen;

    // 3. Bottom straight (going left: rightX -> leftX)
    if (d < straightLen) {
      const t = d / straightLen;
      return { x: rightX - t * straightLen, y: bottomY, heading: Math.PI };
    }
    d -= straightLen;

    // 4. Left curve (bottomY -> topY)
    const a = Math.PI / 2 + (d / arcLen) * Math.PI;
    return {
      x: leftX + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
      heading: a + Math.PI / 2,
    };
  }

  // ── L3 [LOGIC] — Music-Box Audio & Sound Effects ────────────────────

  // Original, tinkling 12-bar melody (comb music box with dual sine/triangle & detune)
  // Slows slightly toward the end of each phrase as if winding down.
  const MUSICBOX_MELODY = [
    // Phrase 1 (bars 1–4)
    { freq: 587.33, dur: 0.42 }, // D5
    { freq: 493.88, dur: 0.42 }, // B4
    { freq: 392.00, dur: 0.42 }, // G4
    { freq: 659.25, dur: 0.42 }, // E5
    { freq: 523.25, dur: 0.42 }, // C5
    { freq: 440.00, dur: 0.42 }, // A4
    { freq: 587.33, dur: 0.46 }, // D5
    { freq: 392.00, dur: 0.50 }, // G4
    { freq: 493.88, dur: 0.56 }, // B4
    { freq: 440.00, dur: 0.82 }, // A4 (held, slowing)
    { rest: 0.38 },

    // Phrase 2 (bars 5–8)
    { freq: 587.33, dur: 0.42 }, // D5
    { freq: 493.88, dur: 0.42 }, // B4
    { freq: 392.00, dur: 0.42 }, // G4
    { freq: 659.25, dur: 0.42 }, // E5
    { freq: 783.99, dur: 0.42 }, // G5
    { freq: 659.25, dur: 0.42 }, // E5
    { freq: 587.33, dur: 0.46 }, // D5
    { freq: 493.88, dur: 0.50 }, // B4
    { freq: 440.00, dur: 0.56 }, // A4
    { freq: 392.00, dur: 0.90 }, // G4 (held, slowing)
    { rest: 0.38 },

    // Phrase 3 (bars 9–12)
    { freq: 493.88, dur: 0.42 }, // B4
    { freq: 587.33, dur: 0.42 }, // D5
    { freq: 783.99, dur: 0.42 }, // G5
    { freq: 739.99, dur: 0.42 }, // F#5
    { freq: 659.25, dur: 0.42 }, // E5
    { freq: 587.33, dur: 0.42 }, // D5
    { freq: 659.25, dur: 0.48 }, // E5
    { freq: 493.88, dur: 0.54 }, // B4
    { freq: 440.00, dur: 0.62 }, // A4
    { freq: 392.00, dur: 1.05 }, // G4 (held, quiet ritardando)
    { rest: 0.85 },
  ];

  let musicBoxState = {
    active: false,
    timer: null,
    step: 0,
    dirtyTimer: null,
  };

  function playMusicBoxNote(audio, freq, dur = 0.6, gain = 0.11, detune = 6) {
    if (!audio?.ctx || audio.muted) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const dest = audio.ambBus || audio.master;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq, t);
    osc2.detune.setValueAtTime(detune, t);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.003); // comb pluck
    g.gain.exponentialRampToValueAtTime(0.0003, t + dur);

    osc1.connect(g);
    osc2.connect(g);
    g.connect(dest);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur + 0.05);
    osc2.stop(t + dur + 0.05);
  }

  function startCleanMusicBox(world) {
    const audio = world?.audio || S.audio;
    if (!audio) return;
    musicBoxState.active = true;
    musicBoxState.step = 0;

    function nextNote() {
      if (!musicBoxState.active) return;
      const entry = MUSICBOX_MELODY[musicBoxState.step % MUSICBOX_MELODY.length];
      musicBoxState.step++;
      if (entry.rest) {
        musicBoxState.timer = setTimeout(nextNote, entry.rest * 1000);
      } else {
        playMusicBoxNote(audio, entry.freq, entry.dur, 0.09, 5);
        musicBoxState.timer = setTimeout(nextNote, entry.dur * 1000);
      }
    }
    nextNote();
  }

  function playDirtyMusicBoxChime(world) {
    const audio = world?.audio || S.audio;
    if (!audio?.ctx || audio.muted) return;
    // Slow, out-of-tune notes as if the music box tries to play by itself
    const notes = [
      { freq: 440 * 1.03, dur: 0.9, delay: 0 },
      { freq: 392 * 0.97, dur: 1.1, delay: 0.8 },
    ];
    for (const n of notes) {
      setTimeout(() => {
        playMusicBoxNote(audio, n.freq, n.dur, 0.06, 18);
      }, n.delay * 1000);
    }
  }

  function playSpringBoing(world) {
    const audio = world?.audio || S.audio;
    if (!audio?.ctx || audio.muted) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.22);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.45);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(g).connect(audio.sfxBus || audio.master);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  function playTrainToot(world) {
    const audio = world?.audio || S.audio;
    if (!audio?.ctx || audio.muted) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    for (const f of [587, 740]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.96, t + 0.35);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      osc.connect(g).connect(audio.sfxBus || audio.master);
      osc.start(t);
      osc.stop(t + 0.4);
    }
  }

  function playWalkieTalkieCrackle(world) {
    const audio = world?.audio || S.audio;
    if (!audio?.noise) return;
    audio.noise({ duration: 0.22, filter: 'bandpass', freq: 2400, q: 4, gain: 0.16 });
  }

  function stopAllAudio() {
    musicBoxState.active = false;
    if (musicBoxState.timer) {
      clearTimeout(musicBoxState.timer);
      musicBoxState.timer = null;
    }
  }

  // ── Gameplay Simulation Update ──────────────────────────────────────

  function updateRoom(dt, world) {
    const live = world.live;
    if (!live) return;

    live.time = (live.time || 0) + dt;
    // The art throws a giant shadow for every spider near the projector.
    live.world = world;
    const isClean = world.state === 'clean' || (world.mk && world.mk.wipe >= 1);

    // 1. Train movement around track
    if (!live.trainDist) live.trainDist = 120;
    const trainStopped = world.mk && (world.mk.train ?? 0) >= 0.98;
    if (!trainStopped) {
      const trainSpeed = isClean ? 0 : 70; // runs slowly in dirty room
      live.trainDist += trainSpeed * dt;
    }
    const enginePos = trackPos(live.trainDist);
    live.trainEngine = enginePos;

    // 2. Toy chest lid pop & Jack-in-the-box Jumper emergence
    live.chestLid = live.chestLid || 0;
    let chestEmerging = false;
    for (const c of world.critters) {
      if (c.alive && c.kind === 'jumper' && c.state === 'emerge' && c.lair?.chestLid) {
        chestEmerging = true;
        if (!c._boingPlayed) {
          c._boingPlayed = true;
          playSpringBoing(world);
        }
      }
    }
    const targetLid = chestEmerging ? 1 : (isClean ? 0 : 0.15); // lid ajar when dirty
    live.chestLid = S.damp(live.chestLid, targetLid, chestEmerging ? 16 : 4, dt);

    // 3. Hatchlings riding the train
    // "a hatchling that touches the track climbs on and rides one lap before hopping off"
    for (const c of world.critters) {
      if (!c.alive || c.kind !== 'hatchling') continue;
      if (c._ridingTrain) {
        // Mounted on train carriage
        const carriageOffset = (c._carriageIndex + 1) * 28;
        const pos = trackPos(live.trainDist - carriageOffset);
        c.rig.x = pos.x;
        c.rig.y = pos.y - 6;
        c.rig.heading = pos.heading;
        c.rig.update(dt, world.time);

        // Check if full lap completed
        const ridden = Math.abs(live.trainDist - c._trainLapStartDist);
        if (ridden >= TRACK.perimeter * 0.96) {
          c._ridingTrain = false;
          c._hasRiddenTrain = true;
          c.rig.y = GROUND - 8;
          c.rig.heading = Math.random() > 0.5 ? 0 : Math.PI;
        }
      } else if (!c._hasRiddenTrain && !c.dropping && c.rig.y >= TRACK.topY - 12 && c.rig.y <= TRACK.bottomY + 12) {
        // Check proximity to engine or carriages
        const distToEngine = Math.hypot(c.rig.x - enginePos.x, c.rig.y - enginePos.y);
        if (distToEngine < 36 && !trainStopped) {
          c._ridingTrain = true;
          c._trainLapStartDist = live.trainDist;
          c._carriageIndex = Math.floor(Math.random() * 3);
          c.rig.mode = 'walk';
        }
      }
    }

    // 4. Planet mobile drop impulse
    // "String spiders hang from the planet mobile as well as from the ceiling; when one drops from it, the mobile turns a little."
    live.mobileAngle = live.mobileAngle || 0;
    live.mobileVel = live.mobileVel || 0;
    for (const c of world.critters) {
      if (c.alive && c.kind === 'string' && c.dropping) {
        if (!c._mobileImpulseChecked && Math.abs(c.rig.x - 900) < 60 && c.rig.y < 340) {
          c._mobileImpulseChecked = true;
          const impulse = (Math.random() > 0.5 ? 1 : -1) * 0.65;
          live.mobileVel += impulse;
        }
      }
    }
    // Damped rotational pendulum oscillation
    live.mobileAngle += live.mobileVel * dt;
    live.mobileVel = S.damp(live.mobileVel, -live.mobileAngle * 2.8, 3.2, dt);

    // 5. Toys that move on their own
    // "every 6–10 s one small toy on the shelf or floor twitches or rolls a little ... purely atmosphere"
    live.toyTwitchTimer = (live.toyTwitchTimer || 8) - dt;
    live.toyTwitch = live.toyTwitch || { toy: null, timer: 0 };
    if (live.toyTwitchTimer <= 0) {
      live.toyTwitchTimer = 6 + Math.random() * 4;
      const choices = ['ball', 'robot', 'top'];
      live.toyTwitch = {
        toy: choices[Math.floor(Math.random() * choices.length)],
        timer: 1.5,
      };
    }
    if (live.toyTwitch.timer > 0) {
      live.toyTwitch.timer -= dt;
    }

    // 6. Occasional dirty music-box chime & walkie-talkie crackle
    live.walkieCrackle = Math.max(0, (live.walkieCrackle || 0) - dt * 2.5);
    if (!isClean && world.state !== 'makeover') {
      live.dirtyChimeTimer = (live.dirtyChimeTimer || 16) - dt;
      if (live.dirtyChimeTimer <= 0) {
        live.dirtyChimeTimer = 16 + Math.random() * 12;
        playDirtyMusicBoxChime(world);
      }
      live.walkieTimer = (live.walkieTimer || 12) - dt;
      if (live.walkieTimer <= 0) {
        live.walkieTimer = 18 + Math.random() * 14;
        live.walkieCrackle = 1; // its little light blinks while it crackles
        playWalkieTalkieCrackle(world);
      }
    }
  }

  // ── QA States ───────────────────────────────────────────────────────

  const qa = {
    heroX: { dirty: 420, makeover: 420, clean: 420 },
    action: {
      heroX: 500,
      aimAt: { x: 900, y: 350 },
      strings: [
        { x: 900, targetY: 340, seed: 1121 }, // dropping from planet mobile
        { x: 1350, targetY: 480, seed: 1122 },
      ],
      crawlers: [
        { lair: { x: 1350, y: 760 }, seed: 1123 },
      ],
      eggs: [
        { x: 1400, y: 770 },
      ],
      hatchlings: [
        { x: 980, seed: 1125 },
      ],
      tear: { webs: 2, path: [1650, 360, 1750, 420] },
      kills: 9,
      score: 6420,
    },
    states: {
      makeover(api) {
        api.holdDirector();
        api.placeHero(420);
        api.step(0.5);
        api.startMakeover();
        api.step(3.9); // t ≈ 3.9 s, music box turning and stars warming
      },
      shadows(api) {
        api.setState('playing');
        api.holdDirector();

        // Hero on the upper bunk aiming
        api.placeHero(450, 'upper-bunk');
        api.hero.facing = 1;
        api.aimAt(860, 880);

        // String spider near projector (x 860, y 900) throwing huge shadow on wall
        const s1 = api.spawn('string', {
          x: 870,
          targetY: 820,
          seed: 1131,
        });
        if (s1 && s1.rig) {
          s1.dropping = false;
          s1.rig.x = 870;
          s1.rig.y = 820;
          s1.rig.plantAll();
        }

        // Jumper leaping out of the open toy chest: staged through the
        // Jumper's own stage(), so its leap state is complete and it can play on.
        api.spawn('jumper', {
          surface: 'toy-chest',
          x: 910,
          feetY: 790,
          state: 'leap',
          vx: -60,
          vy: -320,
          facing: -1,
        });

        // Open chest lid
        if (api.world?.live) {
          api.world.live.world = api.world;
          api.world.live.chestLid = 1.0;
          api.world.live.trainDist = 240;
        }

        // Hatchling riding the train
        const h1 = api.spawn('hatchling', {
          x: 960,
          y: 960,
          seed: 1133,
        });
        if (h1 && api.world?.live) {
          h1._ridingTrain = true;
          h1._carriageIndex = 0;
          h1._trainLapStartDist = api.world.live.trainDist;
        }
      },
    },
  };

  // ── Register Room ───────────────────────────────────────────────────

  S.rooms.register({
    id: 'kids-bedroom',
    number: 9,
    act: 2,
    name: "Kid's Bedroom",
    layout,
    makeWebs,
    rules,
    makeover,
    storyObject,
    qa,
    art: true,
    onStart(world) {
      if (world.live) {
        world.live.world = world; // the art reads the critters through it
        world.live.trainDist = 140;
        world.live.mobileAngle = 0;
        world.live.chestLid = 0;
      }
    },
    onUpdate(dt, world) {
      updateRoom(dt, world);
    },
    onLeave() {
      stopAllAudio();
    },
  });
})();
