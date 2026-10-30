/*
 * Spyder — Living Room reference scene.
 *
 * This is the playable proof of the art direction. It wires the shared
 * library (lib/) to one room (rooms/living-room.js) and owns three things
 * the library does not:
 *
 *   1. The frame pipeline — the exact order things are drawn, lit and
 *      graded. Every room must keep this order (see ART-DIRECTION.md §6).
 *   2. The room loop — spawning, darts, scoring, the clean meter.
 *   3. The makeover — the 5-second transformation when a room is cleared.
 *
 * Append ?qa=1 to the URL to freeze time and drive the scene from the
 * console (window.__spyder) for deterministic screenshots.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const room = S.rooms.livingRoom;
  const L = room.layout;

  const QUOTA = 16;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FIRE_RATE = 0.2; // seconds between darts
  const DART_SPEED = 1700;
  const WEB_GOAL = 0.85; // tearing 85% of all silk counts as "webs done"

  // ── Canvas and stage scaling ──────────────────────────────────────────

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const frame = document.getElementById('frame');
  canvas.width = S.STAGE.width;
  canvas.height = S.STAGE.height;

  function fitStage() {
    const scale = Math.min(window.innerWidth / S.STAGE.width, window.innerHeight / S.STAGE.height);
    frame.style.transform = `translate(-50%, -50%) scale(${scale})`;
    frame.dataset.scale = scale;
  }
  window.addEventListener('resize', fitStage);
  fitStage();

  // Convert a pointer position to stage units.
  function toStage(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * S.STAGE.width,
      y: ((clientY - rect.top) / rect.height) * S.STAGE.height,
    };
  }

  // ── Input ─────────────────────────────────────────────────────────────

  const keys = new Set();
  const pressed = new Set();
  const pointer = { x: 960, y: 300, down: false, lastMove: -10 };

  const KEYMAP = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    jump: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    fire: ['Space', 'KeyJ', 'KeyK'],
  };
  const held = (action) => KEYMAP[action].some((k) => keys.has(k));
  const tapped = (action) => KEYMAP[action].some((k) => pressed.has(k));

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);

    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'KeyM') audio.toggleMute();
    if (e.code === 'KeyR' && (game.state === 'restored' || game.state === 'fled')) restart();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    if (game.state === 'playing') togglePause();
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = toStage(e.clientX, e.clientY);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.lastMove = game.clock;
  });
  canvas.addEventListener('pointerdown', (e) => {
    const p = toStage(e.clientX, e.clientY);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.down = true;
    pointer.lastMove = game.clock;
  });
  window.addEventListener('pointerup', () => (pointer.down = false));

  // ── World state ───────────────────────────────────────────────────────

  const audio = new S.Audio();
  const hud = new S.Hud(document.getElementById('hud'));
  const light = new S.LightMap();
  const grain = S.paint.grainTile(256, 7);
  const live = room.createLive(3);

  // Two reusable scratch canvases for the makeover sweep's masked crossfade.
  const blendClean = document.createElement('canvas');
  blendClean.width = S.STAGE.width;
  blendClean.height = S.STAGE.height;
  const blendCleanCtx = blendClean.getContext('2d');

  const blendDirty = document.createElement('canvas');
  blendDirty.width = S.STAGE.width;
  blendDirty.height = S.STAGE.height;
  const blendDirtyCtx = blendDirty.getContext('2d');

  let layers = null; // { dirty, clean } filled once painting finishes

  const game = {
    state: 'loading',
    clock: 0, // real seconds since load, always ticking
    time: 0, // room time, stops when paused
  };

  let hero;
  let webs;
  let critters; // spiders, eggs, hatchlings
  let darts;
  let popups;
  let burst;
  let dust;
  let mk; // makeover values, driven by updateMakeover()
  let stats;
  let director;
  let shake;

  function resetRoom() {
    hero = new S.Hero(960, L.GROUND);
    hero.facing = 1;
    webs = room.makeWebs();
    critters = [];
    darts = [];
    popups = [];
    burst = new S.Burst(11);
    dust = new S.DustField(170, { x: 80, y: 110, w: 1760, h: 900 }, 21);
    mk = {
      t: -1,
      wipe: 0,
      window: 0,
      curtains: 0,
      clock: 0,
      chandelier: 0,
      chandelierLights: 0,
      sconce: 0,
      lampSteady: 0,
      sparkle: 0,
      mood: 0,
      sweepX: -400,
      released: new Set(),
      cues: new Set(),
    };
    stats = { score: 0, kills: 0, eggs: 0, combo: 1, bestCombo: 1, untouched: true, time: 0, comboTimer: 0 };
    director = { spawned: 0, next: 1.2, pattern: ['string', 'string', 'crawler', 'string', 'crawler', 'string', 'crawler', 'string'] };
    shake = 0;
    game.time = 0;
    hud.reset();
  }

  // ── World services passed to entities ─────────────────────────────────

  const world = {
    get time() {
      return game.time;
    },
    get hero() {
      return hero;
    },
    get burst() {
      return burst;
    },
    light,
    floorAt(x, y) {
      // The highest surface under (x, y), ignoring ones above it.
      let best = null;
      for (const p of L.platforms) {
        if (x < p.x0 || x > p.x1) continue;
        if (p.y < y - 4) continue;
        if (best === null || p.y < best) best = p.y;
      }
      return best;
    },
    sfx(name, amount) {
      audio.play(name, amount);
    },
    splat(x, y, power) {
      burst.goo(x, y, power);
    },
    spawnEgg(x, y, mode, opts = {}) {
      const egg = new S.spiders.EggSac({
        x,
        y,
        mode,
        seed: opts.seed ?? ((game.time * 1000) | 0),
        hatchAt: opts.hatchAt,
        hatchCount: opts.count,
        hatchSpeed: opts.speed,
      });
      critters.push(egg);
      return egg;
    },
    hatch(egg, opts = {}) {
      audio.play('hatch', 0.7);
      burst.fibres(egg.x, egg.y, 14);
      const count = opts.count ?? egg.hatchCount ?? 4;
      const speed = opts.speed ?? egg.hatchSpeed ?? 1;
      const baseSeed = ((egg.seed ?? (game.time * 1000)) | 0) + 101;
      const rng = S.createRng(baseSeed);
      const hatchlings = [];
      // Four-way scatter directions so floor hatchlings fan out in distinct
      // diagonals (up-left, down-left, up-right, down-right) off the husk.
      const fanPresets = [
        { dir: -1, laneY: -35, speedMult: 1.12, delay: 0.015, startX: -12, startY: -8, pitch: -0.52 },
        { dir: -1, laneY: 37, speedMult: 0.88, delay: 0.045, startX: -10, startY: 8, pitch: 0.62 },
        { dir: 1, laneY: -35, speedMult: 0.90, delay: 0.03, startX: 10, startY: -8, pitch: -0.60 },
        { dir: 1, laneY: 37, speedMult: 1.14, delay: 0.06, startX: 12, startY: 8, pitch: 0.52 },
      ];
      for (let i = 0; i < count; i++) {
        const fromWall = egg.mode === 'wall';
        const slot = count > 1 ? i / (count - 1) - 0.5 : 0; // -0.5 .. 0.5
        const preset = fanPresets[i % fanPresets.length];
        const delay = fromWall
          ? i * S.lerp(0.08, 0.12, rng.next()) + rng.range(0, 0.02)
          : preset.delay + rng.range(0, 0.015);
        const speedScale = speed * (preset.speedMult + rng.range(-0.04, 0.04));
        const offsetX = fromWall
          ? slot * 64 + rng.range(-6, 6)
          : preset.startX + rng.range(-1.5, 1.5);
        const laneY = fromWall ? 0 : preset.laneY + rng.range(-2, 2);
        const dir = fromWall ? (slot < -0.05 ? -1 : slot > 0.05 ? 1 : -1) : preset.dir;
        const h = new S.spiders.Hatchling({
          x: egg.x + offsetX,
          y: egg.y + (fromWall ? 0 : preset.startY),
          originX: egg.x,
          originY: egg.y,
          offsetX,
          laneY,
          scatterPitch: fromWall ? 0 : preset.pitch,
          dir,
          delay,
          speedScale,
          seed: baseSeed + i * 29,
          fromWall,
        });
        critters.push(h);
        hatchlings.push(h);
      }
      return hatchlings;
    },
  };

  // ── Spawning ──────────────────────────────────────────────────────────

  function activeSpiders() {
    return critters.filter((c) => c.alive && (c.kind === 'string' || c.kind === 'crawler')).length;
  }

  function runDirector(dt) {
    const pending = stats.kills + activeSpiders();
    if (pending >= QUOTA) return;
    director.next -= dt;
    const maxAlive = stats.kills < 6 ? 3 : 4;
    if (director.next > 0 || activeSpiders() >= maxAlive) return;

    const kind = director.pattern[director.spawned % director.pattern.length];
    spawn(kind);
    director.spawned++;
    director.next = S.lerp(2.6, 1.4, stats.kills / QUOTA);
  }

  function spawn(kind, opts = {}) {
    const seed = 500 + director.spawned * 17;
    const rng = S.createRng(seed);
    if (kind === 'string') {
      // Prefer drop points away from the hero, so drops are seen, not felt.
      const choices = L.dropPoints.filter((x) => Math.abs(x - hero.x) > 120);
      const x = opts.x ?? rng.pick(choices.length ? choices : L.dropPoints);
      const s = new S.spiders.StringSpider({
        x,
        ceiling: L.CEILING,
        targetY: opts.targetY ?? rng.range(360, 620),
        seed,
        aggression: 0.6,
      });
      if (opts.hover) {
        s.rig.y = s.targetY;
        s.state = 'hovering';
      }
      critters.push(s);
      audio.play('creak', 0.4);
      return s;
    }
    const lair = opts.lair ?? rng.pick(L.lairs);
    const c = new S.spiders.WallCrawler({ lair, area: L.wallArea, seed, speed: S.lerp(110, 170, stats.kills / QUOTA) });
    if (opts.emerged) {
      c.emerge = 1;
      c.state = 'wandering';
    }
    critters.push(c);
    return c;
  }

  // ── Shooting ──────────────────────────────────────────────────────────

  // Darts may point anywhere in the upper half, and a little below level.
  function clampAim(a) {
    let n = Math.atan2(Math.sin(a), Math.cos(a));
    const low = 0.35;
    if (n > low && n < Math.PI - low) n = n < Math.PI / 2 ? low : Math.PI - low;
    return n;
  }

  // Keyboard players get gentle auto-aim toward the most "upward" threat.
  function autoAim() {
    const head = hero.headCenter();
    let best = null;
    let bestScore = Infinity;
    for (const c of critters) {
      if (!c.alive) continue;
      const tx = c.rig ? c.rig.x : c.x;
      const ty = c.rig ? c.rig.y : c.y;
      const a = Math.atan2(ty - head.y, tx - head.x);
      const off = Math.abs(S.angleDelta(-Math.PI / 2, a));
      if (off > 1.25) continue;
      const score = off + Math.hypot(tx - head.x, ty - head.y) / 1600;
      if (score < bestScore) {
        bestScore = score;
        best = a;
      }
    }
    return best ?? -Math.PI / 2 + hero.facing * 0.22;
  }

  let fireCooldown = 0;

  function updateAim() {
    const usingMouse = game.clock - pointer.lastMove < 2.5;
    const sh = hero.shoulder();
    const want = usingMouse ? Math.atan2(pointer.y - sh.y, pointer.x - sh.x) : autoAim();
    hero.aim = clampAim(hero.aim + S.angleDelta(hero.aim, clampAim(want)) * 0.35);
  }

  function fire() {
    const m = hero.muzzle();
    darts.push({
      x: m.x,
      y: m.y,
      px: m.x,
      py: m.y,
      vx: Math.cos(hero.aim) * DART_SPEED,
      vy: Math.sin(hero.aim) * DART_SPEED,
      age: 0,
      hitSomething: false,
      tore: false,
    });
    hero.recoil = 1;
    hero.feel('determined', 0.35);
    burst.airPuff(m.x, m.y, hero.aim);
    audio.play('pop');
    fireCooldown = FIRE_RATE;
  }

  function award(points, x, y, label = '') {
    const value = points * stats.combo;
    stats.score += value;
    hud.setScore(stats.score);
    popups.push({ x, y, text: label ? `${label} +${value}` : `+${value}`, age: 0, life: 1.1 });
  }

  function bumpCombo() {
    stats.combo = Math.min(5, stats.combo + 1);
    stats.bestCombo = Math.max(stats.bestCombo, stats.combo);
    stats.comboTimer = 2.2;
    hud.setCombo(stats.combo);
  }

  function breakCombo() {
    stats.combo = 1;
    hud.setCombo(1);
  }

  function updateDarts(dt) {
    for (let i = darts.length - 1; i >= 0; i--) {
      const d = darts[i];
      d.px = d.x;
      d.py = d.y;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.age += dt;

      // Silk tears wherever a dart passes. It does not stop the dart.
      for (const web of webs) {
        const torn = web.tear(d.px, d.py, d.x, d.y, game.time);
        if (torn.length) {
          d.tore = true;
          stats.score += torn.length * 5;
          hud.setScore(stats.score);
          for (const t of torn.slice(0, 4)) burst.fibres(t.x, t.y, 3);
          audio.play('rip', 0.6);
        }
      }

      let consumed = false;

      // Snip the silk above a dangling spider: it drops, for a bonus.
      for (const c of critters) {
        if (c.kind !== 'string' || !c.alive) continue;
        const cut = c.silkTest(d.px, d.py, d.x, d.y);
        if (cut) {
          c.kill(world, 'cut');
          stats.kills++;
          bumpCombo();
          award(c.points + 150, cut.x, cut.y, 'Snip!');
          audio.play('snip');
          consumed = true;
          break;
        }
      }

      // Bodies: test the closest point of this frame's travel.
      if (!consumed) {
        for (const c of critters) {
          if (!c.alive) continue;
          const cx = c.rig ? c.rig.hitCenter().x : c.x;
          const cy = c.rig ? c.rig.hitCenter().y : c.y;
          const r = c.rig ? (c.kind === 'hatchling' ? 26 : c.rig.hitRadius()) : 26;
          if (S.pointSegmentDistance(cx, cy, d.px, d.py, d.x, d.y) < r + 6) {
            c.kill(world);
            if (c.kind === 'string' || c.kind === 'crawler') stats.kills++;
            if (c.kind === 'egg') stats.eggs++;
            bumpCombo();
            award(c.points, cx, cy - 30);
            audio.play('squish', c.kind === 'hatchling' ? 0.5 : 1);
            shake = Math.max(shake, c.kind === 'hatchling' ? 0.15 : 0.35);
            consumed = true;
            break;
          }
        }
      }

      const off = d.x < -50 || d.x > 1970 || d.y < -50 || d.y > 1130 || d.age > 1.2;
      if (consumed || off) {
        // A dart that touched nothing at all breaks the combo.
        if (!consumed && !d.tore) breakCombo();
        darts.splice(i, 1);
      }
    }
  }

  // ── Hero vs threats ──────────────────────────────────────────────────

  function updateThreats() {
    const head = hero.headCenter();
    let nearest = null;
    let nearestD = Infinity;

    for (const c of critters) {
      if (!c.alive) continue;

      if (c.kind === 'string') {
        const hc = c.rig.hitCenter();
        const d = Math.hypot(hc.x - head.x, hc.y - head.y);
        if (d < nearestD) {
          nearestD = d;
          nearest = hc;
        }
        if (d < 62 && hero.hurt(15)) onHurt();
      }

      if (c.kind === 'hatchling' && !c.dropping) {
        const dx = Math.abs(c.rig.x - hero.x);
        const dy = c.rig.y - hero.y;
        if (dx < 44 && Math.abs(dy) < 44) {
          if (hero.vy > 120) {
            // Landing on it squashes it.
            c.kill(world);
            hero.vy = -520;
            award(c.points * 2, c.rig.x, c.rig.y - 30, 'Stomp!');
            bumpCombo();
            audio.play('stomp');
          } else if (hero.hurt(6)) {
            onHurt();
          }
        }
        const d = Math.hypot(c.rig.x - head.x, c.rig.y - head.y);
        if (d < nearestD) {
          nearestD = d;
          nearest = c.rig;
        }
      }
    }

    // The face reacts before the player has time to.
    if (nearest && nearestD < 230) hero.feel('surprised', 0.4);
    if (nearest) hero.lookAt(nearest.x, nearest.y);
    else hero.lookAt(pointer.x, pointer.y);
  }

  function onHurt() {
    stats.untouched = false;
    audio.play('hurt');
    shake = Math.max(shake, 0.6);
    breakCombo();
    hud.setNerve(hero.nerve);
    if (hero.nerve <= 0) {
      game.state = 'fled';
      hud.showCard('fled');
    }
  }

  // ── Progress ─────────────────────────────────────────────────────────

  function websTorn() {
    let alive = 0;
    let total = 0;
    for (const w of webs) {
      alive += w.aliveCount;
      total += w.total;
    }
    return 1 - alive / total;
  }

  function cleanFraction() {
    const kills = Math.min(1, stats.kills / QUOTA);
    const silk = Math.min(1, websTorn() / WEB_GOAL);
    return kills * 0.5 + silk * 0.5;
  }

  function roomIsClear() {
    return cleanFraction() >= 1 && !critters.some((c) => c.alive);
  }

  // ── The makeover ────────────────────────────────────────────────────

  /*
   * One beat at a time, so each change can be seen:
   *   0.0  stamp            work order stamped CLEAN, hero exhales
   *   0.2  webs let go      remaining silk drops away, one web after another
   *   0.6  the sweep        a wave of clean air crosses the room, left → right
   *   1.6  lamp steadies    the flicker stops
   *   2.0  sconce on        chime
   *   2.3  chandelier       swings straight, its bulbs light at 2.8
   *   2.6  morning          curtains open, night turns to dawn, music resolves
   *   3.6  clock            the pendulum starts; the house is alive again
   *   4.0  dust → sparkle   the motes in the sun turn golden
   *   5.0  results card
   */
  function startMakeover() {
    game.state = 'makeover';
    mk.t = 0;
    hero.feel('relieved', 6);
    hud.stamp();
    audio.play('stamp');
    // Brief hold before anything moves: let the player register "I did it".
  }

  function cue(name, at, fn) {
    if (mk.t >= at && !mk.cues.has(name)) {
      mk.cues.add(name);
      fn();
    }
  }

  function updateMakeover(dt) {
    mk.t += dt;
    const t = mk.t;
    const span = (a, b) => S.clamp((t - a) / (b - a), 0, 1);

    webs.forEach((w, i) => cue(`web${i}`, 0.2 + i * 0.07, () => {
      w.release();
      for (const a of w.anchors.slice(0, 3)) burst.fibres(a.x, a.y, 3);
    }));
    cue('rip', 0.25, () => audio.play('rip', 0.4));

    mk.wipe = S.ease.inOut(span(0.6, 2.0));
    mk.sweepX = S.lerp(-300, 2220, mk.wipe);
    cue('sweep', 0.6, () => audio.play('sweep'));
    if (mk.wipe > 0 && mk.wipe < 1) {
      // Dust blown off by the passing wave.
      for (let i = 0; i < 2; i++) burst.dustPuff(mk.sweepX + 40, S.lerp(140, 1000, Math.random()), 2, 140);
      burst.sparkle(mk.sweepX, S.lerp(120, 1000, Math.random()), 3, P.dawn);
    }

    mk.lampSteady = span(1.6, 1.9);
    cue('lamp', 1.6, () => audio.play('chime', 0.0));
    mk.sconce = S.ease.out(span(2.0, 2.4));
    cue('sconce', 2.0, () => audio.play('chime', 0.25));
    mk.chandelier = S.ease.outElastic(span(2.3, 3.3));
    mk.chandelierLights = S.ease.out(span(2.8, 3.2));
    cue('chandelier', 2.8, () => audio.play('chime', 0.42));

    mk.curtains = S.ease.inOut(span(2.6, 3.8));
    mk.window = S.ease.inOut(span(2.6, 4.2));
    cue('resolve', 2.6, () => audio.resolve());

    mk.clock = span(3.6, 4.2);
    mk.sparkle = span(4.0, 4.8);
    mk.mood = S.clamp(mk.wipe * 0.35 + mk.window * 0.65, 0, 1);

    cue('results', 5.2, () => {
      game.state = 'restored';
      hud.fillResults({ ...stats, time: stats.time });
      hud.showCard('results');
    });
  }

  // Jump straight to a fully restored room (QA and "results" screenshots).
  function finishMakeover() {
    mk.t = 6;
    mk.wipe = 1;
    mk.sweepX = 2300;
    mk.window = 1;
    mk.curtains = 1;
    mk.clock = 1;
    mk.chandelier = 1;
    mk.chandelierLights = 1;
    mk.sconce = 1;
    mk.lampSteady = 1;
    mk.sparkle = 1;
    mk.mood = 1;
    for (const w of webs) w.falling = 1;
  }

  // ── Update ───────────────────────────────────────────────────────────

  let lastTick = -1;

  function update(dt) {
    game.time += dt;
    shake = Math.max(0, shake - dt * 2.5);

    if (game.state === 'playing') {
      stats.time += dt;
      fireCooldown = Math.max(0, fireCooldown - dt);
      stats.comboTimer -= dt;
      if (stats.comboTimer <= 0 && stats.combo > 1) breakCombo();

      hero.update(dt, {
        left: held('left'),
        right: held('right'),
        jumpPressed: tapped('jump'),
        jumpHeld: held('jump'),
        downPressed: tapped('down'),
      }, { platforms: L.platforms, bounds: L.bounds });
      if (hero.justLanded) {
        burst.dustPuff(hero.x, hero.y, 6, 40);
        hero.justLanded = false;
      }

      updateAim();
      const wantsFire = pointer.down || held('fire');
      if (wantsFire && fireCooldown === 0) fire();
      hero.charge = 1 - fireCooldown / FIRE_RATE;

      runDirector(dt);
      updateThreats();
    } else if (game.state === 'makeover' || game.state === 'restored') {
      if (game.state === 'makeover') updateMakeover(dt);
      // The hero still breathes and blinks while the room transforms.
      hero.update(dt, {}, { platforms: L.platforms, bounds: L.bounds });
      hero.lookAt(L.window.x + 160, L.window.y + 160);
      // The clock ticks once it has come back to life.
      const second = Math.floor(game.time);
      if (mk.clock > 0.5 && second !== lastTick) {
        lastTick = second;
        audio.play('tick', 0.7);
      }
    }

    updateDarts(dt);
    for (const c of critters) c.update(dt, world);
    critters = critters.filter((c) => !c.done);
    for (const w of webs) w.update(dt);
    burst.update(dt, (x, y) => world.floorAt(x, y));
    dust.update(dt, game.time, mk.wipe > 0 && mk.wipe < 1 ? 60 : 0);
    for (const p of popups) p.age += dt;
    popups = popups.filter((p) => p.age < p.life);

    if (game.state === 'playing') {
      hud.setProgress({ clean: cleanFraction(), kills: stats.kills, quota: QUOTA, websTorn: Math.min(1, websTorn() / WEB_GOAL) });
      hud.setNerve(hero.nerve);
      hud.setCharge(hero.charge ?? 1);
      if (roomIsClear()) startMakeover();
    }
    hud.tick(dt);
    pressed.clear();
  }

  // ── Render ───────────────────────────────────────────────────────────

  function render() {
    const W = S.STAGE.width;
    const H = S.STAGE.height;
    const t = game.time;
    const camX = (hero.x - 960) / 960; // -1 … 1, drives parallax

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = P.soot;
    ctx.fillRect(0, 0, W, H);

    // Screen shake: small, short, and only on impacts.
    if (shake > 0 && !reducedMotion) {
      const s = shake * shake * 10;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    // 1. Beyond the window (strong parallax: it is far away)
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.window.x, L.window.y, L.window.w, L.window.h);
    ctx.clip();
    ctx.translate(-camX * 40, 0);
    room.drawSky(ctx, live, t, mk);
    ctx.restore();

    // 2. Back wall and floor, dirty → clean as the sweep passes
    drawBlended(ctx, 'back');

    // 3. Moving props on the wall plane
    room.drawProps(ctx, live, t, mk);

    // 4. Things that live ON the wall
    for (const c of critters) {
      if (c.kind === 'crawler' || (c.kind === 'egg' && c.mode === 'wall')) c.draw(ctx, t);
    }

    // 5. Furniture
    drawBlended(ctx, 'furniture');

    // 6. Webs
    for (const w of webs) w.draw(ctx, t);

    // 7. Things hanging and running in the room
    for (const c of critters) {
      if (c.kind === 'crawler' || (c.kind === 'egg' && c.mode === 'wall')) continue;
      c.draw(ctx, t);
    }

    // 8. Hero, darts, particles
    hero.draw(ctx);
    drawDarts(ctx);
    burst.draw(ctx);

    // 9. Foreground silhouettes (strongest parallax)
    ctx.save();
    ctx.translate(-camX * 36, 0);
    drawBlended(ctx, 'front');
    ctx.restore();

    // 10. Lighting
    const ambient = S.mix(S.moods.dirty.ambient, S.moods.clean.ambient, mk.mood);
    light.begin(ambient);
    const flick = room.lights(light, live, t, mk);
    if (game.state !== 'restored') {
      const lamp = hero.headLamp();
      light.cone(lamp.x, lamp.y, hero.aim, 0.6, 700, '#FFF0D2', S.lerp(0.55, 0.2, mk.mood));
      light.point(hero.x, hero.y - 90, 170, '#FFE6C4', 0.25);
    }
    for (const d of darts) light.point(d.x, d.y, 120, '#FFF6E0', 0.5);
    // The makeover wave carries its own warm light across the room.
    if (mk.wipe > 0 && mk.wipe < 1) {
      const x = mk.sweepX;
      const x0 = x - 340;
      const w = 520;
      const lg = light.ctx;
      const grad = lg.createLinearGradient(x0, 0, x0 + w, 0);
      grad.addColorStop(0, S.rgba(P.dawn, 0));
      grad.addColorStop(0.2, S.rgba(P.dawn, 0.04));
      grad.addColorStop(0.45, S.rgba(P.dawn, 0.14));
      grad.addColorStop(0.65, S.rgba(P.dawn, 0.2));
      grad.addColorStop(0.82, S.rgba(P.dawn, 0.09));
      grad.addColorStop(1, S.rgba(P.dawn, 0));
      lg.fillStyle = grad;
      lg.fillRect(x0, 0, w, 1080);
      light.lights.push({ kind: 'shaft', quad: [[x - 280, 0], [x + 120, 0], [x + 120, 1080], [x - 280, 1080]], intensity: 0.75 });
    }
    light.apply(ctx);

    // 11. Glow pass: bulbs, beams, silk shimmer, eye glints, dust
    room.glow(ctx, light, live, t, mk, flick);
    for (const w of webs) w.drawGlints(ctx, t, light);
    for (const c of critters) {
      if (!c.rig || !c.alive) continue;
      const eye = c.rig.eyePoint();
      const lit = Math.min(1, light.brightnessAt(eye.x, eye.y));
      S.light.glow(ctx, eye.x, eye.y, 18 * c.rig.scale + 6, P.spiderEye, 0.25 + lit * 0.4);
    }
    drawDartGlow(ctx);
    dust.draw(ctx, light, mk.sparkle > 0 ? P.dawn : P.bone, mk.sparkle);
    drawSweep(ctx);

    // 12. Grade: tint shadows, pull saturation, vignette, grain
    grade(ctx);

    ctx.restore();

    drawPopups(ctx);
  }

  // Draw a layer, crossfading dirty → clean along the makeover sweep.
  function drawBlended(g, name) {
    const dirty = layers.dirty[name];
    const clean = layers.clean[name];
    if (mk.wipe <= 0) return g.drawImage(dirty, 0, 0);
    if (mk.wipe >= 1) return g.drawImage(clean, 0, 0);

    const W = S.STAGE.width;
    const H = S.STAGE.height;
    const edge = mk.sweepX;
    const feather = 280;
    const x0 = edge - feather / 2;
    const x1 = edge + feather / 2;

    if (x1 <= 0) return g.drawImage(dirty, 0, 0);
    if (x0 >= W) return g.drawImage(clean, 0, 0);

    blendCleanCtx.globalCompositeOperation = 'source-over';
    blendCleanCtx.clearRect(0, 0, W, H);
    blendCleanCtx.drawImage(clean, 0, 0);
    blendCleanCtx.globalCompositeOperation = 'destination-in';
    const cleanMask = blendCleanCtx.createLinearGradient(x0, 0, x1, 0);

    blendDirtyCtx.globalCompositeOperation = 'source-over';
    blendDirtyCtx.clearRect(0, 0, W, H);
    blendDirtyCtx.drawImage(dirty, 0, 0);
    blendDirtyCtx.globalCompositeOperation = 'destination-in';
    const dirtyMask = blendDirtyCtx.createLinearGradient(x0, 0, x1, 0);

    const stops = 16;
    for (let i = 0; i <= stops; i++) {
      const t = i / stops;
      const s = t * t * (3 - 2 * t);
      cleanMask.addColorStop(t, `rgba(0,0,0,${1 - s})`);
      dirtyMask.addColorStop(t, `rgba(0,0,0,${s})`);
    }

    blendCleanCtx.fillStyle = cleanMask;
    blendCleanCtx.fillRect(0, 0, W, H);

    blendDirtyCtx.fillStyle = dirtyMask;
    blendDirtyCtx.fillRect(0, 0, W, H);

    blendCleanCtx.globalCompositeOperation = 'lighter';
    blendCleanCtx.drawImage(blendDirty, 0, 0);

    g.drawImage(blendClean, 0, 0);
  }

  function drawSweep(g) {
    if (mk.wipe <= 0 || mk.wipe >= 1) return;
    const x = mk.sweepX;
    g.save();
    g.globalCompositeOperation = 'screen';
    // A wide, soft swell of warm air (~520 px wide) that eases in and out.
    const x0 = x - 340;
    const w = 520;
    const band = g.createLinearGradient(x0, 0, x0 + w, 0);
    band.addColorStop(0, 'rgba(255,214,160,0)');
    band.addColorStop(0.18, 'rgba(255,216,164,0.05)');
    band.addColorStop(0.38, 'rgba(255,222,176,0.16)');
    band.addColorStop(0.55, 'rgba(255,232,196,0.28)');
    band.addColorStop(0.66, 'rgba(255,240,214,0.32)');
    band.addColorStop(0.78, 'rgba(255,236,204,0.20)');
    band.addColorStop(0.9, 'rgba(255,224,184,0.06)');
    band.addColorStop(1, 'rgba(255,214,160,0)');
    g.fillStyle = band;
    g.fillRect(x0, 0, w, 1080);
    g.restore();
  }

  function drawDarts(g) {
    for (const d of darts) {
      const a = Math.atan2(d.vy, d.vx);
      // Trailing rings of displaced air
      for (let i = 1; i <= 3; i++) {
        const tx = d.x - Math.cos(a) * i * 26;
        const ty = d.y - Math.sin(a) * i * 26;
        g.strokeStyle = `rgba(240,232,214,${0.28 / i})`;
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(tx, ty, 5 + i * 3, 9 + i * 4, a, 0, Math.PI * 2);
        g.stroke();
      }
      g.save();
      g.translate(d.x, d.y);
      g.rotate(a);
      const body = g.createLinearGradient(-26, 0, 10, 0);
      body.addColorStop(0, 'rgba(255,240,210,0)');
      body.addColorStop(1, 'rgba(255,248,230,0.95)');
      g.fillStyle = body;
      g.beginPath();
      g.ellipse(-8, 0, 20, 5.5, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  function drawDartGlow(g) {
    for (const d of darts) S.light.glow(g, d.x, d.y, 40, '#FFF1D6', 0.5);
  }

  function grade(g) {
    const W = S.STAGE.width;
    const H = S.STAGE.height;
    const dirty = S.moods.dirty;
    const clean = S.moods.clean;

    // Colour in the shadows: cool plum at night, warm gold in the morning.
    g.save();
    g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = S.lerp(dirty.gradeAlpha, clean.gradeAlpha, mk.mood) * 2;
    g.fillStyle = S.mix(dirty.grade, clean.grade, mk.mood);
    g.fillRect(0, 0, W, H);
    g.restore();

    // Desaturate a touch while the room is neglected.
    const sat = S.lerp(dirty.saturation, clean.saturation, mk.mood);
    if (sat < 0.99) {
      g.save();
      g.globalCompositeOperation = 'saturation';
      g.globalAlpha = 1 - sat;
      g.fillStyle = '#808080';
      g.fillRect(0, 0, W, H);
      g.restore();
    }

    // Vignette, tighter when the hero's nerve is low.
    const tight = S.remap(100, 0, 0, 0.18, hero.nerve);
    const v = g.createRadialGradient(W / 2, H * 0.55, H * (0.45 - tight), W / 2, H * 0.55, H * 1.05);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(8,5,4,${S.lerp(0.62, 0.42, mk.mood)})`);
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);

    // Hurt pulse
    if (hero.invulnerable > 0.6) {
      g.fillStyle = `rgba(120,30,20,${(hero.invulnerable - 0.6) * 0.5})`;
      g.fillRect(0, 0, W, H);
    }

    // Film grain, re-positioned every frame
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.07;
    const ox = Math.floor(Math.random() * 256);
    const oy = Math.floor(Math.random() * 256);
    g.translate(-ox, -oy);
    g.fillStyle = g.createPattern(grain, 'repeat');
    g.fillRect(0, 0, W + 256, H + 256);
    g.restore();
  }

  function drawPopups(g) {
    g.save();
    g.textAlign = 'center';
    g.font = '600 40px Caveat, "Segoe Print", cursive';
    for (const p of popups) {
      const k = p.age / p.life;
      const y = p.y - S.ease.out(k) * 60;
      g.globalAlpha = 1 - S.ease.in(k);
      g.lineWidth = 6;
      g.strokeStyle = 'rgba(22,18,15,0.8)';
      g.strokeText(p.text, p.x, y);
      g.fillStyle = P.bone;
      g.fillText(p.text, p.x, y);
    }
    g.restore();
  }

  // ── Loop ─────────────────────────────────────────────────────────────

  const qa = { enabled: new URLSearchParams(location.search).has('qa'), frozen: false };
  let previous = performance.now();

  function loop(now) {
    const dt = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    game.clock += dt;
    if (layers) {
      const running = ['playing', 'makeover', 'restored'].includes(game.state);
      if (running && !qa.frozen) update(dt);
      else if (game.state === 'title' && !qa.frozen) idleTitle(dt);
      render();
    }
    requestAnimationFrame(loop);
  }

  // Behind the start card the room is alive: dust drifts, lamp flickers.
  function idleTitle(dt) {
    game.time += dt;
    for (const w of webs) w.update(dt);
    dust.update(dt, game.time, 0);
    hero.update(dt, {}, { platforms: L.platforms, bounds: L.bounds });
    hero.lookAt(L.window.x + 160, L.window.y + 120);
  }

  // ── Flow ─────────────────────────────────────────────────────────────

  function begin() {
    audio.start();
    hud.showCard(null);
    game.state = 'playing';
    canvas.focus();
  }

  function restart() {
    resetRoom();
    hud.showCard(null);
    hud.setNerve(100);
    game.state = 'playing';
  }

  function togglePause() {
    if (game.state === 'playing') {
      game.state = 'paused';
      hud.showCard('pause');
    } else if (game.state === 'paused') {
      hud.showCard(null);
      game.state = 'playing';
    }
  }

  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'begin') begin();
      if (action === 'resume') togglePause();
      if (action === 'restart') restart();
      if (action === 'mute') btn.textContent = audio.toggleMute() ? 'Sound: off' : 'Sound: on';
      if (action === 'pause') togglePause();
    });
  });

  // Painting the room twice takes a moment; do it after the first paint so
  // the start card shows immediately.
  function paintRoom() {
    resetRoom();
    requestAnimationFrame(() => {
      setTimeout(() => {
        layers = { dirty: room.paint('dirty'), clean: room.paint('clean') };
        game.state = 'title';
        document.body.classList.add('is-ready');
        document.querySelector('[data-action="begin"]').disabled = false;
        if (qa.enabled) qa.ready = true;
      }, 30);
    });
  }

  // ── QA hooks (only with ?qa=1) ─────────────────────────────────────

  if (qa.enabled) {
    document.body.classList.add('is-qa');
    const step = (seconds) => {
      const n = Math.round(seconds * 60);
      for (let i = 0; i < n; i++) update(1 / 60);
    };

    window.__spyder = {
      get ready() {
        return Boolean(qa.ready);
      },
      setup(name) {
        resetRoom();
        qa.frozen = true;
        hud.showCard(null);
        hud.setNerve(100);
        switch (name) {
          case 'title':
            game.state = 'title';
            hud.showCard('start');
            hero.x = 1020;
            idleTitle(2);
            break;
          case 'dirty':
            game.state = 'playing';
            director.next = 999;
            hero.x = 760;
            step(1.5);
            break;
          case 'action': {
            game.state = 'playing';
            director.next = 999;
            hero.x = 820;
            hero.facing = 1;
            spawn('string', { x: 700, targetY: 470, hover: true });
            spawn('string', { x: 1060, targetY: 560, hover: true });
            spawn('crawler', { lair: { x: 480, y: 330 }, emerged: true });
            world.spawnEgg(1270, 640, 'falling');
            critters.push(new S.spiders.Hatchling({ x: 1180, y: L.GROUND - 8, seed: 77 }));
            for (const w of webs.slice(0, 2)) w.tear(100, 300, 400, 120, 0, 60);
            stats.kills = 9;
            stats.score = 6420;
            stats.combo = 3;
            hud.setScore(stats.score);
            hud.setCombo(3);
            hero.nerve = 72;
            step(0.9);
            // Aim at the left spider and fire a volley mid-flight.
            pointer.x = 700;
            pointer.y = 470;
            pointer.lastMove = game.clock;
            updateAim();
            fire();
            step(0.08);
            break;
          }
          case 'makeover':
            game.state = 'playing';
            director.next = 999;
            hero.x = 980;
            step(0.5);
            startMakeover();
            step(1.25);
            break;
          case 'clean':
            game.state = 'restored';
            stats.kills = QUOTA;
            for (const w of webs) for (const seg of w.segments) seg.alive = false;
            hero.x = 980;
            finishMakeover();
            hero.feel('relieved', 99);
            hud.stamp();
            step(1.2);
            break;
          case 'results':
            game.state = 'restored';
            stats.kills = QUOTA;
            for (const w of webs) for (const seg of w.segments) seg.alive = false;
            finishMakeover();
            hero.x = 980;
            hero.feel('relieved', 99);
            hud.stamp();
            Object.assign(stats, { score: 18740, kills: 16, eggs: 5, bestCombo: 5, untouched: false, time: 154 });
            hud.fillResults(stats);
            hud.showCard('results');
            step(1);
            break;
        }
        hud.setProgress({ clean: cleanFraction(), kills: stats.kills, quota: QUOTA, websTorn: Math.min(1, websTorn() / WEB_GOAL) });
        hud.setNerve(hero.nerve);
        hud.tick(10);
        render();
      },
      step(seconds) {
        step(seconds);
        render();
      },
      // Finish the room's goals instantly and let the normal rules notice.
      clearRoom() {
        stats.kills = QUOTA;
        critters = [];
        for (const w of webs) for (const seg of w.segments) seg.alive = false;
      },
      get state() {
        return game.state;
      },
      play() {
        qa.frozen = false;
      },
    };
  }

  hud.showCard('start');
  paintRoom();
  requestAnimationFrame(loop);
})();
