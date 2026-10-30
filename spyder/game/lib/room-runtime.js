/*
 * Spyder — the room runtime.
 *
 * Everything a room needs that is not about that particular room. It grew
 * out of the reference scene (reference/scene.js) and keeps its code and
 * its order, so the Living Room looks exactly as it did there. It owns:
 *
 *   1. The frame pipeline — the fixed 13-step order things are drawn, lit
 *      and graded in (ART-DIRECTION.md §6). See render().
 *   2. The room loop — input, darts, scoring and combo, threats and the
 *      hero's reactions, and the director that spawns spiders from the
 *      room's `rules`.
 *   3. The makeover — the 5-second transformation when a room is cleared.
 *      The shared beats (stamp, web release, sweep, the room's lights one
 *      by one, dawn, sparkle, results) live here; a room lists its own
 *      lights as `makeover.beats` and adds one `makeover.uniqueBeat`.
 *   4. Progress — a cleared room is written to S.progress at the stamp.
 *   5. QA hooks — frozen time and staged states for screenshots.
 *
 * A room file provides only data and painting:
 *
 *   S.rooms.register({
 *     id, number, act, name, layout,
 *     paint(variant) → { back, furniture, front },
 *     makeWebs(), createLive(seed), drawSky(), drawProps(), lights(), glow(),
 *     rules: { quota, webGoal, spawnPattern, maxAlive, spawnInterval, types },
 *     makeover: { beats: [...], uniqueBeat: { key, at, run(mk, t, fx) } },
 *     storyObject: 'Found on the dresser: …',
 *   })
 *
 * …and may add optional hooks when it needs behaviour of its own (the
 * porch's swinging bench, a tutorial, a lamp that swings when shot). Each
 * receives `world`, the same services object every spider gets:
 *
 *   onStart(world, info)     play begins (also in QA staging; info.qa names
 *                            the staged state)
 *   onUpdate(dt, world)      every simulated step, BEFORE the hero moves —
 *                            move platforms here and the hero rides them
 *   direct(dt, world)        return true to skip the default director this
 *                            step (scripted tutorial spawns)
 *   drawOnFurniture(ctx, live, t, mk)   right after the furniture layer, lit
 *                            like it: moving things that sit ON furniture
 *   drawOverlay(ctx, world)  after the grade and the score pop-ups
 *   onLeave(world)           the player leaves the room (remove DOM, timers)
 *   qa: { heroX, action, states: { name(api) } }   QA staging, see qaSetup()
 *
 * and can listen to gameplay events with world.on(name, fn), registered in
 * onStart: 'kill' {critter, how}, 'tear' {count}, 'stomp', 'land'
 * {platform}, 'hurt', 'hatch' {egg, hatchlings}, 'fire' {dart}, 'key'
 * {code}, and 'dart' {dart} every step for every dart in flight — a 'dart'
 * listener that returns true stops the dart (it hit the room's lamp).
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The current weapon and switching (prompts/12-weapons.md, L1). Keys 1/2/3
  // always mean the same weapon, whether or not it is registered or
  // unlocked yet; Q/E and the wheel cycle through whichever of those are
  // both. A switch takes WEAPON_SWITCH_TIME, and nothing fires during it.
  const WEAPON_KEYS = { Digit1: 'vacuum', Digit2: 'web-cutter', Digit3: 'foam-spray' };
  const WEAPON_CYCLE = ['vacuum', 'web-cutter', 'foam-spray'];
  const WEAPON_SWITCH_TIME = 0.18;

  // Difficulty scales how many spiders a room asks for and how fast they come.
  const DIFFICULTY = {
    easy: { quota: 0.75, interval: 1.3 },
    normal: { quota: 1, interval: 1 },
    hard: { quota: 1.25, interval: 0.8 },
  };

  const DEFAULT_RULES = {
    quota: 16,
    webGoal: 0.85, // tearing 85% of all silk counts as "webs done"
    spawnPattern: ['string'],
    maxAlive: [3, 4], // early / once `rampAt` spiders are down
    spawnInterval: [2.6, 1.4], // seconds, start → end of the room
    types: ['string'],
    firstSpawn: 1.2, // seconds of quiet before the first spider
  };

  const EASE = { linear: (t) => t, ...S.ease };

  // The shared makeover timeline (ART-DIRECTION.md §10), in seconds.
  const MAKEOVER = {
    webs: 0.2, // first web lets go…
    webStep: 0.07, // …then one more every 0.07 s
    rip: 0.25,
    sweep: [0.6, 2.0],
    dawn: [2.6, 4.2],
    sparkle: [4.0, 4.8],
    results: 5.2,
  };

  // A room's rules, with defaults filled in and the difficulty applied.
  function rulesFor(room, difficulty) {
    const base = { ...DEFAULT_RULES, ...(room.rules || {}) };
    const k = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    const quota = Math.max(1, Math.round(base.quota * k.quota));
    for (const kind of base.spawnPattern) {
      if (!base.types.includes(kind)) {
        throw new Error(`Room "${room.id}": spawnPattern uses "${kind}", which is not in rules.types.`);
      }
    }
    for (const kind of base.types) {
      if (!S.spiderTypes[kind]) {
        throw new Error(`Room "${room.id}": spider type "${kind}" is not registered (missing <script>?).`);
      }
    }
    const extraGoals = [...(base.extraGoals || [])];
    if (base.boss) {
      const bossDef = S.bosses ? S.bosses.get(base.boss) : null;
      const bossName = bossDef?.name || 'The Queen';
      if (!extraGoals.some((g) => g.id === 'boss')) {
        extraGoals.push({ id: 'boss', label: bossName });
      }
    }
    return {
      ...base,
      quota,
      extraGoals: extraGoals.length ? extraGoals : undefined,
      spawnInterval: base.spawnInterval.map((s) => s * k.interval),
      // 6 of 16 in the Living Room: the room speeds up a third of the way in.
      rampAt: base.rampAt ?? Math.round(quota * 0.375),
    };
  }

  /*
   * Create the runtime for one canvas. `onEvent(name, payload)` tells the
   * page what happened so it can show the right card:
   *   'paused', 'resumed', 'cleared' (stamp), 'restored' (results),
   *   'fled', 'muted'.
   */
  S.createRoomRuntime = function createRoomRuntime({ canvas, hud, audio, settings, frameEl, onEvent = () => {} }) {
    const ctx = canvas.getContext('2d');
    canvas.width = S.STAGE.width;
    canvas.height = S.STAGE.height;

    // Convert a pointer position to stage units.
    function toStage(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * S.STAGE.width,
        y: ((clientY - rect.top) / rect.height) * S.STAGE.height,
      };
    }

    // ── Input ─────────────────────────────────────────────────────────

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

    // The room has the keyboard only while it is on screen; on the title,
    // the map and the cards, keys belong to the buttons.
    const inRoom = () => ['playing', 'paused', 'makeover', 'restored', 'fled'].includes(game.state);

    window.addEventListener('keydown', (e) => {
      if (!inRoom()) return;
      if (game.state === 'playing' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (!keys.has(e.code)) pressed.add(e.code);
      keys.add(e.code);

      if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
      if (e.code === 'KeyM') onEvent('muted', audio.toggleMute());
      if (e.code === 'KeyR' && (game.state === 'restored' || game.state === 'fled')) restart();
      if (game.state === 'playing') {
        if (e.code === 'KeyF') {
          const pulse = S.weapons.get('sonic-pulse');
          if (pulse && pulse.hasCharge && pulse.hasCharge()) {
            pulse.fire(world, hero);
          }
        } else if (WEAPON_KEYS[e.code]) selectWeapon(WEAPON_KEYS[e.code]);
        else if (e.code === 'KeyQ') cycleWeapon(-1);
        else if (e.code === 'KeyE') cycleWeapon(1);
      }
      emit('key', { code: e.code, event: e });
    });
    window.addEventListener('keyup', (e) => keys.delete(e.code));
    window.addEventListener('blur', () => {
      keys.clear();
      if (game.state === 'playing' && !qa.frozen) togglePause();
    });

    canvas.addEventListener('wheel', (e) => {
      if (!inRoom() || game.state !== 'playing') return;
      e.preventDefault();
      cycleWeapon(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    canvas.addEventListener('pointermove', (e) => {
      const p = toStage(e.clientX, e.clientY);
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.lastMove = game.clock;
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!inRoom()) return;
      const p = toStage(e.clientX, e.clientY);
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.down = true;
      pointer.lastMove = game.clock;
    });
    window.addEventListener('pointerup', () => (pointer.down = false));

    // ── World state ───────────────────────────────────────────────────

    const light = new S.LightMap();
    const grain = S.paint.grainTile(256, 7);
    const paintCache = new Map(); // room id → { dirty, clean }, most recent last

    // Two reusable scratch canvases for the makeover sweep's masked crossfade.
    const blendClean = document.createElement('canvas');
    blendClean.width = S.STAGE.width;
    blendClean.height = S.STAGE.height;
    const blendCleanCtx = blendClean.getContext('2d');

    const blendDirty = document.createElement('canvas');
    blendDirty.width = S.STAGE.width;
    blendDirty.height = S.STAGE.height;
    const blendDirtyCtx = blendDirty.getContext('2d');

    const game = {
      state: 'loading', // loading | ready | title | playing | paused | makeover | restored | fled | idle
      clock: 0, // real seconds, always ticking
      time: 0, // room time, stops when paused
    };

    let room = null;
    let L = null; // room.layout
    let currentArt = null;
    let rules = null;
    let live = null;
    let layers = null; // { dirty, clean }

    let hero;
    let webs;
    let critters; // spiders, eggs, hatchlings
    let popups;
    let burst;
    let dust;
    let mk; // makeover values, driven by updateMakeover()
    let stats;
    let director;
    let shake;
    let nerveSeen;
    let listeners = new Map();
    let staging = false; // true while QA stages a state: nothing is saved
    let lastUnlockedWeapon = null; // set by the clear just made, read when results show (12-fix-2)
    const completedGoals = new Set();

    let currentWeaponId = 'vacuum';
    let previousWeaponId = 'vacuum';
    let switchTimer = 0; // seconds left in a weapon switch; no firing while > 0
    let breakables = [];
    let pickups = [];
    let snipTimes = [];
    let snipObjectiveDone = false;
    let boss = null;
    let bossSpawned = false;
    let spawnPauseTimer = 0;
    let slowMotion = null; // { speed: 0.4, timer: 1.2 }
    let bossDeathDeadline = null; // game.time at which the runtime forces boss.done if the boss hasn't

    function resetRoom() {
      rules = rulesFor(room, settings.difficulty);
      hero = new S.Hero(L.heroStart ?? 960, L.GROUND);
      hero.facing = 1;
      currentWeaponId = 'vacuum';
      previousWeaponId = 'vacuum';
      switchTimer = 0;
      hero.heroModel = S.weapons.get(currentWeaponId)?.heroModel ?? 'vacuum';
      webs = room.makeWebs ? room.makeWebs() : [];
      critters = [];
      boss = null;
      bossSpawned = false;
      spawnPauseTimer = 0;
      slowMotion = null;
      bossDeathDeadline = null;
      const isFreshLivingRoom = room && room.id === 'living-room' && !S.weapons.isUnlocked('web-cutter');
      breakables = isFreshLivingRoom
        ? []
        : (L.breakables || []).map((b) => ({ ...b, hits: 0, maxHits: 3, broken: false }));
      pickups = [];
      snipTimes = [];
      snipObjectiveDone = false;
      popups = [];
      burst = new S.Burst(11, settings.particles === 'reduced' ? 0.5 : 1);
      const dustCount = L.dustCount ?? 170;
      dust = new S.DustField(settings.particles === 'reduced' ? Math.round(dustCount / 2) : dustCount, L.dustArea ?? { x: 80, y: 110, w: 1760, h: 900 }, 21);
      mk = freshMakeover();
      stats = { score: 0, kills: 0, eggs: 0, combo: 1, bestCombo: 1, untouched: true, time: 0, comboTimer: 0 };
      director = { spawned: 0, next: rules.firstSpawn, seq: 0 };
      shake = 0;
      nerveSeen = 100;
      listeners = new Map();
      lastUnlockedWeapon = null;
      completedGoals.clear();
      game.time = 0;
      hud.reset();
      if (rules.boss && (rules.bossAt === undefined || rules.bossAt <= 0)) {
        spawnBoss(rules.boss);
      }
      // Every weapon's own projectiles and cooldowns start fresh with the room.
      for (const w of S.weapons.list()) if (w.reset) w.reset(world);
    }

    function spawnBoss(bossId, opts = {}) {
      if (boss) return boss;
      const def = S.bosses ? S.bosses.get(bossId) : null;
      if (!def) {
        console.warn(`Boss "${bossId}" is not registered.`);
        return null;
      }
      boss = def.create ? def.create(world, opts) : new S.Boss(def, world, opts);
      boss.def = def;
      boss.name = def.name;
      boss.maxHealth = def.health || boss.health || 60;
      if (boss.health === undefined) boss.health = boss.maxHealth;
      boss.phases = def.phases || [{ id: 'default', at: 1.0 }];
      boss.currentPhaseIndex = 0;
      boss.phase = boss.phases[0]?.id || 'default';
      boss.alive = true;
      boss.isBoss = true;
      bossSpawned = true;
      critters.push(boss);
      syncBossHud();
      return boss;
    }

    function syncBossHud() {
      if (!boss) {
        hud.updateBoss(null);
        return;
      }
      const frac = boss.maxHealth > 0 ? boss.health / boss.maxHealth : 0;
      hud.updateBoss({
        name: boss.name || boss.def?.name || 'Boss',
        fraction: frac,
        phases: boss.phases,
        alive: boss.alive,
        defeated: !boss.alive,
      });
    }

    function hitBoss(damage, weaponId = currentWeaponId) {
      if (!boss || boss.defeated) return;
      if (boss.hit) boss.hit(world, damage, weaponId);
      else boss.health = Math.max(0, boss.health - damage);
      boss.hitStop = 0.04; // 40 ms freeze of the boss only
      boss.flash = 1;      // white flash
      world.shake(0.3);    // screen shake 0.3
      checkBossPhase();
      syncBossHud();
      if (boss.health <= 0) {
        defeatBoss();
      }
    }

    function checkBossPhase() {
      if (!boss || !boss.phases) return;
      const frac = boss.health / boss.maxHealth;
      for (let i = boss.phases.length - 1; i >= 0; i--) {
        const p = boss.phases[i];
        if (frac <= p.at && i > boss.currentPhaseIndex) {
          boss.currentPhaseIndex = i;
          triggerBossPhase(p.id);
          break;
        }
      }
    }

    function triggerBossPhase(phaseId) {
      if (!boss) return;
      boss.phase = phaseId;
      if (boss.enterPhase) boss.enterPhase(phaseId);
      spawnPauseTimer = 1.5; // pauses spawns for 1.5 s
      world.shake(0.4);
      audio.play('roar');
      const phaseDef = boss.phases?.find((p) => p.id === phaseId);
      hud.showNote(phaseDef?.note ?? "She's angry now.", 2000);
      syncBossHud();
    }

    // Defeat ends the fight (no more hits land, HUD shows it struck through)
    // but the "boss" goal is not complete yet: that waits for the boss's own
    // death animation to finish (boss.done), so the makeover cannot start out
    // from under a boss that is still dying on screen.
    function defeatBoss() {
      if (!boss || boss.defeated) return;
      boss.defeated = true;
      if (boss.die) boss.die(world);
      else boss.alive = false;
      slowMotion = { speed: 0.4, timer: 1.2 };
      bossDeathDeadline = game.time + 4; // guard: a custom boss gets 4s of sim time to set `done` itself
      syncBossHud();
    }

    // A custom boss (from create()) owns its death animation and sets
    // `done` itself; this only completes the goal once it has, and forces
    // `done` if a custom boss has not set it within the 4s guard.
    function checkBossDeath() {
      if (!boss || !boss.defeated) return;
      if (!boss.done && bossDeathDeadline !== null && game.time >= bossDeathDeadline) {
        boss.done = true;
      }
      if (boss.done) world.completeGoal('boss');
    }

    function freshMakeover() {
      const m = {
        t: -1,
        wipe: 0,
        window: 0, // the shared dawn: 0 night → 1 morning
        sparkle: 0,
        mood: 0,
        sweepX: -400,
        released: new Set(),
        cues: new Set(),
      };
      // The room's own staged values (lights, curtains, its unique beat) start at 0.
      for (const beat of room.makeover?.beats ?? []) {
        if (beat.key) m[beat.key] = 0;
        if (beat.name) m[beat.name] = 0;
      }
      const unique = room.makeover?.uniqueBeat;
      if (unique?.key) m[unique.key] = 0;
      return m;
    }

    // ── World services passed to entities and room hooks ──────────────

    function emit(name, payload) {
      let handled = false;
      for (const fn of listeners.get(name) || []) if (fn(payload) === true) handled = true;
      return handled;
    }

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
      audio,
      frameEl,
      get room() {
        return room;
      },
      get layout() {
        return L;
      },
      get rules() {
        return rules;
      },
      get stats() {
        return stats;
      },
      get critters() {
        return critters;
      },
      get boss() {
        return boss;
      },
      spawnBoss,
      hitBoss,
      get webs() {
        return webs;
      },
      addWeb(web) {
        if (!web) return null;
        web.addedDuringPlay = true;
        webs.push(web);
        return web;
      },
      get websTorn() {
        return websTorn();
      },
      get cleanFraction() {
        return cleanFraction();
      },
      get mk() {
        return mk;
      },
      get live() {
        return live;
      },
      get state() {
        return game.state;
      },
      get isBlockout() {
        return Boolean(isBlockout(room));
      },
      get progress() {
        return S.progress;
      },
      completeGoal(id) {
        if (!completedGoals.has(id)) {
          completedGoals.add(id);
          showProgress();
          if (game.state === 'playing' && roomIsClear()) startMakeover();
        }
      },
      isGoalComplete(id) {
        return completedGoals.has(id);
      },
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
        const count = opts.count ?? egg.hatchCount ?? rules.hatchCount ?? 4;
        const speed = opts.speed ?? egg.hatchSpeed ?? rules.hatchSpeed ?? 1;
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
        emit('hatch', { egg, hatchlings });
        return hatchlings;
      },
      spawn(kind, opts) {
        return spawn(kind, opts);
      },
      addCritter(critter) {
        critters.push(critter);
        return critter;
      },
      award(points, x, y, label) {
        award(points, x, y, label);
      },
      bumpCombo() {
        bumpCombo();
      },
      breakCombo() {
        breakCombo();
      },
      // A dart (or any weapon's projectile) travelling from (ax, ay) to
      // (bx, by) tears every silk strand it crosses: same scoring (5 a
      // strand), the same fibre burst and 'rip' sound, and the 'tear' event.
      // Returns true if anything tore.
      tearSilk(ax, ay, bx, by, radius = 34) {
        let tore = false;
        for (const web of webs) {
          const torn = web.tear(ax, ay, bx, by, game.time, radius);
          if (torn.length) {
            tore = true;
            stats.score += torn.length * 5;
            hud.setScore(stats.score);
            for (const t of torn.slice(0, 4)) burst.fibres(t.x, t.y, 3);
            audio.play('rip', 0.6);
            emit('tear', { count: torn.length, web });
          }
        }
        return tore;
      },
      // Snip the silk above a dangling spider: it drops, for a "Snip!" bonus.
      // Returns true if a thread was cut (and so the shot is spent).
      snipThread(ax, ay, bx, by) {
        for (const c of critters) {
          if (!c.alive || typeof c.silkTest !== 'function') continue;
          const cut = c.silkTest(ax, ay, bx, by);
          if (cut) {
            c.kill(world, 'cut');
            if (S.countsForQuota(c)) stats.kills++;
            bumpCombo();
            award(c.points + 150, cut.x, cut.y, 'Snip!');
            audio.play('snip');
            emit('kill', { critter: c, how: 'cut' });

            // Mini-objective (prompt 12, L2): 3 snips in 8 s awards Sonic Pulse charge
            snipTimes.push(game.time);
            snipTimes = snipTimes.filter((t) => game.time - t <= 8.0);
            if (!snipObjectiveDone && snipTimes.length >= 3) {
              snipObjectiveDone = true;
              const pulse = S.weapons.get('sonic-pulse');
              if (pulse) pulse.addCharge(1);
              award(0, hero.x, hero.y - 60, 'Three snips! Sonic Pulse');
              audio.play('chime', 1.0);
            }
            return true;
          }
        }
        return false;
      },
      // Hit a breakable box with a projectile or ray
      hitBreakable(ax, ay, bx, by) {
        for (const b of breakables) {
          if (b.broken) continue;
          const bw = 46;
          const bh = 42;
          const d = S.pointSegmentDistance(b.x, b.y - bh / 2, ax, ay, bx, by);
          if (d <= bw / 2 + 6) {
            b.hits++;
            burst.fibres(b.x, b.y - 20, 8);
            audio.play('pop', 0.8);
            if (b.hits >= b.maxHits) {
              b.broken = true;
              burst.fibres(b.x, b.y - 20, 20);
              burst.airPuff(b.x, b.y - 20, -Math.PI / 2);
              audio.play('rip', 0.8);
              pickups.push({
                x: b.x,
                y: b.y - 20,
                startY: b.y - 20,
                contains: b.contains,
                age: 0,
              });
            }
            return true;
          }
        }
        return false;
      },
      // Hit whatever body the segment (ax, ay)–(bx, by) passes closest to,
      // for `damage` (1 by default). A hit that brings health to 0 or below
      // runs the usual kill bookkeeping (quota, eggs, combo, award, sound,
      // shake, the 'kill' event); one that doesn't just flashes the rig.
      // Returns true if something was hit either way.
      hitBody(ax, ay, bx, by, damage = 1, weaponId = currentWeaponId) {
        if (boss && boss.alive) {
          let hit = false;
          if (typeof boss.hitTest === 'function') {
            hit = boss.hitTest(bx, by, 8) || boss.hitTest(ax, ay, 8) || boss.hitTest((ax + bx) * 0.5, (ay + by) * 0.5, 8);
            if (!hit && boss.x != null && boss.y != null) {
              const br = boss.radius || 50;
              hit = S.pointSegmentDistance(boss.x, boss.y, ax, ay, bx, by) < br + 8;
            }
          }
          if (hit) {
            hitBoss(damage, weaponId);
            return true;
          }
        }
        for (const c of critters) {
          if (c === boss || !c.alive) continue;
          const cx = c.rig ? c.rig.hitCenter().x : c.x;
          const cy = c.rig ? c.rig.hitCenter().y : c.y;
          const r = c.rig ? (c.kind === 'hatchling' ? 26 : c.rig.hitRadius()) : 26;
          if (S.pointSegmentDistance(cx, cy, ax, ay, bx, by) < r + 6) {
            return hitCritter(c, cx, cy, damage);
          }
        }
        return false;
      },
      // Hurt the hero; the gauge, combo and "fled" rules follow. True if it landed.
      hurtHero(amount) {
        if (!hero.hurt(amount)) return false;
        onHurt();
        return true;
      },
      on(name, fn) {
        if (!listeners.has(name)) listeners.set(name, []);
        listeners.get(name).push(fn);
      },
      emit,
      // Screen shake, as every other impact already causes.
      shake(amount) {
        shake = Math.max(shake, amount);
      },
    };

    // Apply `damage` to a critter's health (1 by default for every current
    // type); it dies, through the usual bookkeeping, only once health
    // reaches 0. A critter that is hit but survives just flashes — the
    // rig's existing hit reaction, no new art.
    function hitCritter(c, cx, cy, damage) {
      const health = (c.health ?? 1) - damage;
      if (health > 0) {
        c.health = health;
        if (c.rig) c.rig.flash = 1;
        return true;
      }
      c.health = 0;
      const extra = c.kill(world, 'shot');
      if (S.countsForQuota(c)) stats.kills++;
      if (c.kind === 'egg') stats.eggs++;
      bumpCombo();
      if (extra && extra.bonus) award(c.points + extra.bonus, cx, cy - 30, extra.label || '');
      else award(c.points, cx, cy - 30);
      audio.play('squish', c.kind === 'hatchling' ? 0.5 : 1);
      shake = Math.max(shake, c.kind === 'hatchling' ? 0.15 : 0.35);
      emit('kill', { critter: c, how: 'shot' });
      return true;
    }

    // ── Spawning ──────────────────────────────────────────────────────

    function activeSpiders() {
      return critters.filter((c) => c.alive && S.countsForQuota(c)).length;
    }

    function runDirector(dt) {
      if (spawnPauseTimer > 0) return;
      if (room.direct && room.direct(dt, world)) return;
      const pending = stats.kills + activeSpiders();
      if (pending >= rules.quota) return;
      director.next -= dt;
      const maxAlive = stats.kills < rules.rampAt ? rules.maxAlive[0] : rules.maxAlive[1];
      if (director.next > 0 || activeSpiders() >= maxAlive) return;

      const kind = rules.spawnPattern[director.spawned % rules.spawnPattern.length];
      const type = S.spiderTypes[kind];
      if (type.canSpawn && !type.canSpawn(world)) return; // wait, try again next step
      spawn(kind);
      director.spawned++;
      director.next = S.lerp(rules.spawnInterval[0], rules.spawnInterval[1], stats.kills / rules.quota);
    }

    function spawn(kind, opts = {}) {
      const type = S.spiderTypes[kind];
      if (!type) throw new Error(`Unknown spider type "${kind}".`);
      // Every spawn gets its own seed, whether from the director or scripted.
      const seq = director.seq++;
      const seed = opts.seed ?? 500 + seq * 17;
      const rng = S.createRng(seed);
      const critter = type.spawn({ world, rng, seed, opts });
      critters.push(critter);
      return critter;
    }

    // ── Shooting ──────────────────────────────────────────────────────

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

    function updateAim() {
      const usingMouse = game.clock - pointer.lastMove < 2.5;
      const sh = hero.shoulder();
      const want = usingMouse ? Math.atan2(pointer.y - sh.y, pointer.x - sh.x) : autoAim();
      hero.aim = clampAim(hero.aim + S.angleDelta(hero.aim, clampAim(want)) * 0.35);
    }

    // The weapon currently in hand, or undefined if somehow nothing is
    // selected (never happens: resetRoom() always starts on the Vacuum).
    function currentWeapon() {
      return S.weapons.get(currentWeaponId);
    }

    function fireWeapon() {
      const weapon = currentWeapon();
      if (weapon && weapon.fire) weapon.fire(world, hero, hero.aim);
    }

    // A weapon that is not registered, or not unlocked, is skipped.
    function availableWeapon(id) {
      return S.weapons.get(id) && S.weapons.isUnlocked(id) ? id : null;
    }

    function switchWeapon(id) {
      if (id === currentWeaponId) return;
      if (currentWeaponId !== 'flamethrower') previousWeaponId = currentWeaponId;
      currentWeaponId = id;
      switchTimer = WEAPON_SWITCH_TIME;
      hero.heroModel = currentWeapon()?.heroModel ?? 'vacuum';
    }

    function selectWeapon(id) {
      if (currentWeaponId === 'flamethrower' && S.weapons.get('flamethrower')?.timer > 0) return;
      const target = availableWeapon(id);
      if (target) switchWeapon(target);
    }

    function cycleWeapon(dir) {
      if (currentWeaponId === 'flamethrower' && S.weapons.get('flamethrower')?.timer > 0) return;
      const avail = WEAPON_CYCLE.filter(availableWeapon);
      if (avail.length < 2) return;
      const i = avail.indexOf(currentWeaponId);
      switchWeapon(avail[(i + dir + avail.length) % avail.length]);
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

    // ── Hero vs threats ──────────────────────────────────────────────

    function updateThreats() {
      const head = hero.headCenter();
      let nearest = null;
      let nearestD = Infinity;

      for (const c of critters) {
        if (!c.alive) continue;
        const type = S.spiderTypes[c.kind];
        if (!type || !type.threat) continue;
        const point = type.threat(c, world, head);
        if (!point) continue;
        const d = Math.hypot(point.x - head.x, point.y - head.y);
        if (d < nearestD) {
          nearestD = d;
          nearest = point;
        }
      }

      // The face reacts before the player has time to.
      if (nearest && nearestD < 230) hero.feel('surprised', 0.4);
      if (nearest) hero.lookAt(nearest.x, nearest.y);
      else hero.lookAt(pointer.x, pointer.y);
    }

    function onHurt() {
      stats.untouched = false;
      nerveSeen = hero.nerve;
      audio.play('hurt');
      shake = Math.max(shake, 0.6);
      breakCombo();
      hud.setNerve(hero.nerve);
      emit('hurt', { nerve: hero.nerve });
      if (hero.nerve <= 0) {
        game.state = 'fled';
        onEvent('fled', { ...stats });
      }
    }

    // Some threats hurt the hero from inside their own brain (an egg landing
    // on the head). Catch those too, so they count against "untouched" and
    // can make the hero flee.
    function watchNerve() {
      if (hero.nerve < nerveSeen) onHurt();
      nerveSeen = hero.nerve;
    }

    // ── Progress ─────────────────────────────────────────────────────

    function websTorn() {
      let alive = 0;
      let total = 0;
      for (const w of webs) {
        // Webs added during play count toward the total only while intact above 30% (Prompt 13 L3)
        if (w.addedDuringPlay && (w.total === 0 || w.intactness <= 0.3)) {
          continue;
        }
        alive += w.aliveCount;
        total += w.total;
      }
      return total === 0 ? 1 : 1 - alive / total;
    }

    function cleanFraction() {
      const extraCount = rules.extraGoals?.length || 0;
      const totalShares = 2 + extraCount;
      let goalShares = 0;
      if (extraCount > 0) {
        for (const g of rules.extraGoals) {
          if (completedGoals.has(g.id)) goalShares += 1;
        }
      }
      const kills = Math.min(1, stats.kills / rules.quota);
      const silk = Math.min(1, websTorn() / rules.webGoal);
      return (kills + silk + goalShares) / totalShares;
    }

    function roomIsClear() {
      const extraGoalsDone = !rules.extraGoals || rules.extraGoals.every((g) => completedGoals.has(g.id));
      return cleanFraction() >= 1 && !critters.some((c) => c.alive) && extraGoalsDone;
    }

    function showProgress() {
      hud.setProgress({
        clean: cleanFraction(),
        kills: stats.kills,
        quota: rules.quota,
        websTorn: Math.min(1, websTorn() / rules.webGoal),
        extraGoals: rules.extraGoals?.map((g) => ({
          id: g.id,
          label: g.label,
          done: completedGoals.has(g.id),
        })),
      });
    }

    // ── The makeover ────────────────────────────────────────────────

    /*
     * One beat at a time, so each change can be seen:
     *   0.0  stamp            work order stamped CLEAN, hero exhales
     *   0.2  webs let go      remaining silk drops away, one web after another
     *   0.6  the sweep        a wave of clean air crosses the room, left → right
     *   …    the room's own lights come on, each with a chime (makeover.beats)
     *   2.6  morning          night turns to dawn, music resolves
     *   …    the room's unique beat (makeover.uniqueBeat)
     *   4.0  dust → sparkle   the motes in the sun turn golden
     *   5.2  results card
     */
    function startMakeover() {
      game.state = 'makeover';
      mk.t = 0;
      hero.feel('relieved', 6);
      hud.stamp();
      audio.play('stamp');
      // The room is clean the moment it is stamped; save it now, so leaving
      // during the makeover does not lose it.
      if (!staging) {
        const saved = S.progress.recordClear(room.id, stats);
        lastUnlockedWeapon = saved.unlockedWeapon;
        onEvent('cleared', { room, stats: { ...stats }, ...saved });
      }
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

      webs.forEach((w, i) => cue(`web${i}`, MAKEOVER.webs + i * MAKEOVER.webStep, () => {
        w.release();
        for (const a of w.anchors.slice(0, 3)) burst.fibres(a.x, a.y, 3);
      }));
      cue('rip', MAKEOVER.rip, () => audio.play('rip', 0.4));

      mk.wipe = S.ease.inOut(span(...MAKEOVER.sweep));
      mk.sweepX = S.lerp(-300, 2220, mk.wipe);
      cue('sweep', MAKEOVER.sweep[0], () => audio.play('sweep'));
      if (mk.wipe > 0 && mk.wipe < 1) {
        // Dust blown off by the passing wave.
        for (let i = 0; i < 2; i++) burst.dustPuff(mk.sweepX + 40, S.lerp(140, 1000, Math.random()), 2, 140);
        burst.sparkle(mk.sweepX, S.lerp(120, 1000, Math.random()), 3, P.dawn);
      }

      // The room's own lights and props, each on its own beat.
      for (const beat of room.makeover?.beats ?? []) {
        if (beat.key) mk[beat.key] = EASE[beat.ease || 'linear'](span(beat.from, beat.to));
        if (beat.chime !== undefined) cue(beat.key, beat.from, () => audio.play('chime', beat.chime));
        if (beat.name && currentArt?.beat && mk.t >= (beat.at ?? beat.from ?? 0)) {
          currentArt.beat(beat.name, mk, mk.t);
        }
      }

      mk.window = S.ease.inOut(span(...MAKEOVER.dawn));
      cue('resolve', MAKEOVER.dawn[0], () => audio.resolve());

      runUniqueBeat();
      mk.sparkle = span(...MAKEOVER.sparkle);
      mk.mood = S.clamp(mk.wipe * 0.35 + mk.window * 0.65, 0, 1);

      cue('results', MAKEOVER.results, () => {
        game.state = 'restored';
        onEvent('restored', { room, stats: { ...stats }, unlockedWeapon: lastUnlockedWeapon });
      });
    }

    // The room's one signature beat (Living Room: the clock starts). It keeps
    // running after the makeover, so a ticking clock goes on ticking.
    const fx = {
      get time() {
        return game.time;
      },
      sfx: (name, amount) => audio.play(name, amount),
      audio,
      get burst() {
        return burst;
      },
    };
    function runUniqueBeat() {
      const unique = room.makeover?.uniqueBeat;
      if (unique && mk.t >= unique.at) unique.run(mk, mk.t, fx);
    }

    // Jump straight to a fully restored room (QA and "results" screenshots).
    function finishMakeover() {
      mk.t = 6;
      mk.wipe = 1;
      mk.sweepX = 2300;
      mk.window = 1;
      for (const beat of room.makeover?.beats ?? []) {
        if (beat.key) mk[beat.key] = 1;
        if (beat.name && currentArt?.beat) currentArt.beat(beat.name, mk, 6);
      }
      runUniqueBeat();
      mk.sparkle = 1;
      mk.mood = 1;
      for (const w of webs) w.falling = 1;
    }

    // ── Update ───────────────────────────────────────────────────────

    // Let the room move its own things first. A platform that moved carries
    // the hero standing on it, so swings and lifts never drop him through.
    function roomUpdate(dt) {
      if (!room.onUpdate) return;
      const under = hero.onGround ? hero.standingOn : null;
      const before = under ? { x0: under.x0, y: under.y } : null;
      room.onUpdate(dt, world);
      if (under && (under.x0 !== before.x0 || under.y !== before.y)) {
        hero.x += under.x0 - before.x0;
        hero.y = under.y;
      }
    }

    function lookoutPoint() {
      if (L.lookout) return L.lookout;
      if (L.window) return { x: L.window.x + 160, y: L.window.y + 160 };
      return { x: 960, y: 300 };
    }

    function update(dt) {
      let simDt = dt;
      if (slowMotion && slowMotion.timer > 0) {
        slowMotion.timer -= dt;
        simDt = dt * slowMotion.speed;
        if (slowMotion.timer <= 0) slowMotion = null;
      }
      if (spawnPauseTimer > 0) {
        spawnPauseTimer = Math.max(0, spawnPauseTimer - dt);
      }

      game.time += simDt;
      shake = Math.max(0, shake - dt * 2.5);

      if (game.state === 'playing') {
        if (!bossSpawned && rules.boss && rules.bossAt !== undefined && game.time >= rules.bossAt) {
          spawnBoss(rules.boss);
        }
        stats.time += simDt;
        switchTimer = Math.max(0, switchTimer - simDt);
        stats.comboTimer -= simDt;
        if (stats.comboTimer <= 0 && stats.combo > 1) breakCombo();

        roomUpdate(simDt);
        hero.update(simDt, {
          left: held('left'),
          right: held('right'),
          jumpPressed: tapped('jump'),
          jumpHeld: held('jump'),
          downPressed: tapped('down'),
        }, { platforms: L.platforms, bounds: L.bounds });
        if (hero.justLanded) {
          burst.dustPuff(hero.x, hero.y, 6, 40);
          hero.justLanded = false;
          emit('land', { platform: hero.standingOn });
        }

        updateAim();
        const wantsFire = pointer.down || held('fire');
        if (switchTimer === 0 && wantsFire) fireWeapon();

        runDirector(simDt);
        updateThreats();
      } else if (game.state === 'makeover' || game.state === 'restored') {
        if (game.state === 'makeover') updateMakeover(dt);
        else {
          mk.t += dt;
          runUniqueBeat();
        }
        roomUpdate(dt);
        // The hero still breathes and blinks while the room transforms.
        hero.update(dt, {}, { platforms: L.platforms, bounds: L.bounds });
        const look = lookoutPoint();
        hero.lookAt(look.x, look.y);
      }

      // Flamethrower timer expiration returns previous weapon
      if (currentWeaponId === 'flamethrower') {
        const ft = S.weapons.get('flamethrower');
        if (!ft || ft.timer <= 0) {
          switchWeapon(previousWeaponId || 'vacuum');
        }
      }

      for (const w of S.weapons.list()) {
        if (w.update) w.update(world, simDt);
      }

      // Update pickups & hero collection
      for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        p.age += simDt;
        p.y = p.startY + Math.sin(p.age * 3.5) * 6;
        if (Math.hypot(hero.x - p.x, (hero.y - 45) - p.y) < 45) {
          if (p.contains === 'flamethrower') {
            previousWeaponId = currentWeaponId;
            S.weapons.get('flamethrower')?.startTimer(8.0);
            switchWeapon('flamethrower');
            audio.play('plop', 0.8);
            award(0, p.x, p.y, 'Flamethrower!');
          } else if (p.contains === 'sonic') {
            S.weapons.get('sonic-pulse')?.addCharge(1);
            audio.play('chime', 0.8);
            award(0, p.x, p.y, 'Sonic Pulse!');
          } else if (p.contains === 'coins') {
            S.progress.addCoins(50);
            stats.coins = (stats.coins || 0) + 50;
            audio.play('chime', 0.6);
            award(50, p.x, p.y, '+50 Coins');
          }
          pickups.splice(i, 1);
        }
      }

      for (const c of critters) {
        if (c.isBoss && c.hitStop > 0) {
          c.hitStop -= dt;
          continue;
        }
        c.update(simDt, world);
      }
      critters = critters.filter((c) => !c.done);
      checkBossDeath();
      for (const w of webs) w.update(simDt);
      burst.update(simDt, (x, y) => world.floorAt(x, y));
      dust.update(simDt, game.time, mk.wipe > 0 && mk.wipe < 1 ? 60 : 0);
      for (const p of popups) p.age += simDt;
      popups = popups.filter((p) => p.age < p.life);

      if (game.state === 'playing') {
        watchNerve();
      }
      if (game.state === 'playing') {
        showProgress();
        hud.setNerve(hero.nerve);
        hud.setCharge(hero.charge ?? 1);
        hud.updateWeapon(currentWeapon(), {
          unlocked: S.progress.data.unlocked || ['vacuum'],
          charge: hero.charge ?? 1,
          tank: S.weapons.get('foam-spray')?.tank ?? 1,
          timer: S.weapons.get('flamethrower')?.timer ?? 0,
          sonicCharges: S.weapons.get('sonic-pulse')?.charges ?? 0,
        });
        if (roomIsClear()) startMakeover();
      }
      hud.tick(dt);
      pressed.clear();
    }

    // ── Render ───────────────────────────────────────────────────────

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
      if (shake > 0 && !reducedMotion && settings.shake) {
        const s = shake * shake * 10;
        ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      }

      // 1. Beyond the window (strong parallax: it is far away)
      ctx.save();
      ctx.beginPath();
      for (const r of L.farRegions ?? (L.window ? [L.window] : [])) ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.translate(-camX * 40, 0);
      (currentArt || room).drawSky(ctx, live, t, mk);
      ctx.restore();

      // 2. Back wall and floor, dirty → clean as the sweep passes
      drawBlended(ctx, 'back');

      // 3. Moving props on the wall plane
      (currentArt || room).drawProps(ctx, live, t, mk);

      // 4. Things that live ON the wall
      for (const c of critters) {
        if (layerOf(c) === 'wall') c.draw(ctx, t);
      }

      // 5. Furniture, then anything a room keeps ON its furniture that moves
      // (place cards that stand up, candle flames on a table)
      drawBlended(ctx, 'furniture');
      if (currentArt?.drawOnFurniture) currentArt.drawOnFurniture(ctx, live, t, mk);
      else if (room.drawOnFurniture) room.drawOnFurniture(ctx, live, t, mk);

      // 6. Webs
      for (const w of webs) w.draw(ctx, t);

      // 7. Things hanging and running in the room
      for (const c of critters) {
        if (layerOf(c) === 'wall') continue;
        c.draw(ctx, t);
      }

      // 8. Hero, the weapons' projectiles, breakables, pickups, particles
      hero.draw(ctx);
      for (const w of S.weapons.list()) {
        if (w.draw) w.draw(ctx);
      }
      drawBreakables(ctx);
      drawPickups(ctx);
      burst.draw(ctx);

      // 9. Foreground silhouettes (strongest parallax)
      ctx.save();
      ctx.translate(-camX * 36, 0);
      drawBlended(ctx, 'front');
      ctx.restore();

      // 10. Lighting
      const ambient = S.mix(S.moods.dirty.ambient, S.moods.clean.ambient, mk.mood);
      light.begin(ambient);
      const flick = (currentArt || room).lights(light, live, t, mk);
      if (game.state !== 'restored') {
        const lamp = hero.headLamp();
        light.cone(lamp.x, lamp.y, hero.aim, 0.6, 700, '#FFF0D2', S.lerp(0.55, 0.2, mk.mood));
        light.point(hero.x, hero.y - 90, 170, '#FFE6C4', 0.25);
      }
      for (const w of S.weapons.list()) {
        if (w.lights) w.lights(light);
      }
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
      (currentArt || room).glow(ctx, light, live, t, mk, flick, -camX * 40);
      for (const w of webs) w.drawGlints(ctx, t, light);
      for (const c of critters) {
        if (!c.rig || !c.alive) continue;
        const eye = c.rig.eyePoint();
        const lit = Math.min(1, light.brightnessAt(eye.x, eye.y));
        S.light.glow(ctx, eye.x, eye.y, 18 * c.rig.scale + 6, P.spiderEye, 0.25 + lit * 0.4);
      }
      if (boss && boss.alive && boss.drawGlow) {
        boss.drawGlow(ctx, light);
      }
      for (const w of S.weapons.list()) {
        if (w.glow) w.glow(ctx, light);
      }
      dust.draw(ctx, light, mk.sparkle > 0 ? P.dawn : P.bone, mk.sparkle);
      drawSweep(ctx);

      // 12. Grade: tint shadows, pull saturation, vignette, grain
      grade(ctx);

      ctx.restore();

      // 13. Score pop-ups, then anything the room draws over the frame
      drawPopups(ctx);
      if (room.drawOverlay) room.drawOverlay(ctx, world);
    }

    // Breakable boxes. A dusty cardboard box with a stencilled arrow and
    // packing tape, or, in the Kitchen and the Master Bedroom, a small wooden
    // crate. Each is painted once per hit count (S.paint uses blur, so never
    // per frame) and drawn as a sprite. When it breaks it bursts open: flaps
    // fly out with the dust, and an opened, flattened box stays on the floor.
    const boxSprites = new Map();
    const BOX = { w: 54, h: 46, top: 12 };

    function boxSprite(isWood, hits) {
      const key = `${isWood}:${hits}`;
      let c = boxSprites.get(key);
      if (c) return c;
      c = S.makeCanvas(96, 96);
      const g = c.getContext('2d');
      g.translate(48, 82);
      const { w, h, top } = BOX;
      const front = [[-w / 2, -h], [w / 2, -h], [w / 2, 0], [-w / 2, 0]];
      const lid = [[-w / 2, -h], [w / 2, -h], [w / 2 + 10, -h - top], [-w / 2 + 10, -h - top]];
      const side = [[w / 2, -h], [w / 2 + 10, -h - top], [w / 2 + 10, -top], [w / 2, 0]];
      S.paint.softShadow(g, 6, 2, w * 0.7, 6, 0.5);
      const face = isWood ? S.mixHex(P.oak, P.walnut, 0.25) : S.mixHex(P.oak, P.linen, 0.42);
      const opts = (color, seed, light = 0.22) => ({
        color,
        lightDir: { x: -0.4, y: -0.9 },
        light,
        shadow: 0.42,
        strokes: isWood ? 9 : 5,
        strokeAngle: isWood ? 0 : Math.PI / 2,
        rim: 0.3,
        wobble: isWood ? 0.3 : 0.9,
        seed,
      });
      S.paint.paintShape(g, side, opts(S.shadeHex(face, -0.28), 701));
      S.paint.paintShape(g, front, opts(face, 702));
      S.paint.paintShape(g, lid, opts(S.shadeHex(face, 0.12), 703, 0.3));
      if (isWood) {
        // Planks, a diagonal brace, nail heads.
        g.strokeStyle = S.rgba(P.soot, 0.5);
        g.lineWidth = 1.5;
        for (const y of [-h + 15, -h + 31]) {
          g.beginPath();
          g.moveTo(-w / 2, y);
          g.lineTo(w / 2, y);
          g.stroke();
        }
        g.fillStyle = S.shadeHex(face, -0.12);
        g.save();
        g.beginPath();
        g.rect(-w / 2, -h, w, h);
        g.clip();
        g.translate(0, -h / 2);
        g.rotate(-0.68);
        g.fillRect(-40, -5, 80, 10);
        g.restore();
        g.fillStyle = S.rgba(P.soot, 0.7);
        for (const [x, y] of [[-w / 2 + 5, -h + 5], [w / 2 - 5, -h + 5], [-w / 2 + 5, -5], [w / 2 - 5, -5]]) {
          g.beginPath();
          g.arc(x, y, 1.6, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = S.rgba(P.linen, 0.55);
        g.font = '700 8px "Special Elite", monospace';
        g.textAlign = 'center';
        g.fillText('KEEP DRY', 0, -h + 26);
      } else {
        // Tape along the lid's seam and down the front, a stencilled arrow.
        const tape = S.mixHex(P.linen, P.bone, 0.3);
        g.fillStyle = S.rgba(tape, 0.75);
        g.beginPath();
        g.moveTo(-3, -h);
        g.lineTo(3, -h);
        g.lineTo(13, -h - top);
        g.lineTo(7, -h - top);
        g.closePath();
        g.fill();
        g.fillRect(-3, -h, 6, 16);
        g.strokeStyle = S.rgba(P.walnut, 0.7);
        g.lineWidth = 2.6;
        g.beginPath();
        g.moveTo(-16, -10);
        g.lineTo(-16, -30);
        g.moveTo(-22, -24);
        g.lineTo(-16, -31);
        g.lineTo(-10, -24);
        g.stroke();
        g.fillStyle = S.rgba(P.walnut, 0.65);
        g.font = '700 7px "Special Elite", monospace';
        g.textAlign = 'center';
        g.fillText('THIS WAY UP', 12, -9);
        // Dust lying on the lid, a dented corner.
        g.fillStyle = S.rgba(P.linen, 0.3);
        g.beginPath();
        g.moveTo(-w / 2 + 4, -h - 1);
        g.lineTo(w / 2 + 2, -h - 1);
        g.lineTo(w / 2 + 9, -h - top + 2);
        g.lineTo(-w / 2 + 11, -h - top + 2);
        g.closePath();
        g.fill();
        g.strokeStyle = S.rgba(P.soot, 0.35);
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(w / 2 - 8, 0);
        g.quadraticCurveTo(w / 2 - 4, -6, w / 2, -10);
        g.stroke();
      }
      // Damage: each hit splits it a little more.
      g.strokeStyle = S.rgba(P.soot, 0.75);
      g.lineWidth = 1.6;
      const cracks = [
        [[-12, -h], [-6, -h + 14], [-10, -h + 24], [-2, -h + 34]],
        [[14, 0], [10, -12], [16, -22], [8, -30]],
      ];
      for (let k = 0; k < Math.min(hits, cracks.length); k++) {
        g.beginPath();
        cracks[k].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
        if (!isWood) {
          // Cardboard tears show its pale inside along the split.
          g.strokeStyle = S.rgba(P.bone, 0.45);
          g.lineWidth = 0.8;
          g.beginPath();
          cracks[k].forEach(([x, y], i) => (i ? g.lineTo(x + 1.5, y) : g.moveTo(x + 1.5, y)));
          g.stroke();
          g.strokeStyle = S.rgba(P.soot, 0.75);
          g.lineWidth = 1.6;
        }
      }
      boxSprites.set(key, c);
      return c;
    }

    // What is left once it has burst: an opened box, its flaps splayed flat.
    function drawOpenedBox(ctx, isWood) {
      const face = isWood ? S.mixHex(P.oak, P.walnut, 0.25) : S.mixHex(P.oak, P.linen, 0.42);
      ctx.fillStyle = S.rgba(P.soot, 0.35);
      ctx.beginPath();
      ctx.ellipse(4, 0, 40, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = S.shadeHex(face, -0.1);
      ctx.fillRect(-24, -18, 48, 18);
      ctx.fillStyle = S.shadeHex(face, -0.45);
      ctx.fillRect(-20, -18, 40, 4);
      ctx.fillStyle = face;
      for (const [x, tilt] of [[-34, -0.5], [30, 0.45]]) {
        ctx.save();
        ctx.translate(x, -8);
        ctx.rotate(tilt);
        ctx.fillRect(-12, -3, 24, 6);
        ctx.restore();
      }
    }

    function drawBreakables(ctx) {
      for (const b of breakables) {
        const isWood = room && (room.id === 'kitchen' || room.id === 'master-bedroom');
        ctx.save();
        ctx.translate(b.x, b.y);
        if (!b.broken) {
          ctx.drawImage(boxSprite(isWood, b.hits || 0), -48, -82);
          ctx.restore();
          continue;
        }
        // The burst: flaps or splinters thrown up and out, falling back.
        b.brokenAt ??= game.time;
        const t = game.time - b.brokenAt;
        drawOpenedBox(ctx, isWood);
        if (t < 0.9) {
          const face = isWood ? S.mixHex(P.oak, P.walnut, 0.25) : S.mixHex(P.oak, P.linen, 0.42);
          for (let i = 0; i < 6; i++) {
            const a = -Math.PI / 2 + (i - 2.5) * 0.42;
            const v = 260 + (i % 3) * 60;
            const x = Math.cos(a) * v * t;
            const y = -30 + Math.sin(a) * v * t + 700 * t * t;
            ctx.save();
            ctx.translate(x, Math.min(y, -4));
            ctx.rotate(t * (6 + i));
            ctx.globalAlpha = S.clamp(1.4 - t * 1.5, 0, 1);
            ctx.fillStyle = i % 2 ? face : S.shadeHex(face, -0.2);
            if (isWood) ctx.fillRect(-12, -2, 24, 4);
            else ctx.fillRect(-10, -7, 20, 14);
            ctx.restore();
          }
          // Dust rolling out.
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI - Math.PI;
            const r = 20 + t * 90;
            ctx.fillStyle = S.rgba(P.linen, 0.3 * (1 - t / 0.9));
            ctx.beginPath();
            ctx.arc(Math.cos(a) * r, -18 + Math.sin(a) * r * 0.5, 14 + t * 20, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    // Pickups float with a slow bob (the logic moves p.y), cast a small
    // shadow that shrinks as they rise, and glint once a second. Each is a
    // sprite painted once: a little copper tank, a brass bell, a paper bag
    // of coins.
    const pickupSprites = new Map();
    function pickupSprite(kind) {
      let c = pickupSprites.get(kind);
      if (c) return c;
      c = S.makeCanvas(64, 64);
      const g = c.getContext('2d');
      g.translate(32, 36);
      const lit = { x: -0.4, y: -0.9 };
      if (kind === 'flamethrower') {
        S.paint.paintShape(g, S.paint.roundedRectPoints(-11, -16, 22, 32, 9), {
          color: S.mixHex(P.rust, P.ember, 0.3), lightDir: lit, light: 0.45, shadow: 0.45, strokes: 3, rim: 0.5, wobble: 0.2, seed: 711,
        });
        g.fillStyle = S.rgba(P.soot, 0.3);
        g.beginPath();
        g.ellipse(3, 2, 4, 2.5, 0.4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = P.brass;
        g.fillRect(-4, -22, 8, 7);
        g.fillRect(-9, -24, 18, 3);
        g.fillStyle = S.mixHex(P.bone, P.linen, 0.3);
        g.beginPath();
        g.arc(0, -4, 5, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = P.soot;
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(0, -4);
        g.lineTo(3, -7);
        g.stroke();
      } else if (kind === 'sonic') {
        S.paint.paintShape(g, [[-13, 12], [13, 12], [9, -6], [6, -13], [0, -16], [-6, -13], [-9, -6]], {
          color: P.brass, lightDir: lit, light: 0.5, shadow: 0.5, strokes: 3, rim: 0.55, wobble: 0.2, seed: 712,
        });
        g.fillStyle = S.shadeHex(P.brass, -0.35);
        g.fillRect(-14, 10, 28, 4);
        g.fillStyle = S.mixHex(P.walnut, P.oak, 0.4);
        g.fillRect(-2, -26, 4, 11);
        g.beginPath();
        g.arc(0, -27, 4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.shadeHex(P.brass, -0.5);
        g.beginPath();
        g.arc(0, 16, 3.4, 0, Math.PI * 2);
        g.fill();
      } else {
        S.paint.paintShape(g, [[-12, 16], [12, 16], [11, -8], [7, -12], [-7, -12], [-11, -8]], {
          color: S.mixHex(P.oak, P.linen, 0.55), lightDir: lit, light: 0.3, shadow: 0.4, strokes: 5, rim: 0.3, wobble: 0.9, seed: 713,
        });
        // The twisted top and a coin peeking out of it.
        g.fillStyle = S.mixHex(P.oak, P.linen, 0.4);
        g.beginPath();
        g.moveTo(-7, -12);
        g.lineTo(-2, -18);
        g.lineTo(3, -12);
        g.closePath();
        g.fill();
        const coin = g.createRadialGradient(5, -17, 1, 6, -15, 7);
        coin.addColorStop(0, S.mixHex(P.brass, P.bone, 0.5));
        coin.addColorStop(1, S.shadeHex(P.brass, -0.3));
        g.fillStyle = coin;
        g.beginPath();
        g.arc(6, -15, 6.5, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = S.rgba(P.soot, 0.4);
        g.lineWidth = 0.8;
        g.beginPath();
        g.arc(6, -15, 4.5, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = S.rgba(P.walnut, 0.6);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(-8, 0);
        g.lineTo(8, 0);
        g.stroke();
      }
      pickupSprites.set(kind, c);
      return c;
    }

    function drawPickups(ctx) {
      for (const p of pickups) {
        const floorY = world.floorAt(p.x, p.startY) ?? (p.startY + 20);
        const lift = S.clamp((floorY - p.y) / 60, 0, 1);
        ctx.fillStyle = S.rgba(P.soot, 0.45 - lift * 0.2);
        ctx.beginPath();
        ctx.ellipse(p.x, floorY - 2, 16 - lift * 4, 5 - lift, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(pickupSprite(p.contains === 'flamethrower' || p.contains === 'sonic' ? p.contains : 'coins'), p.x - 32, p.y - 36);
        // A glint once a second: a small four-pointed star on its top edge.
        const phase = (p.age % 1) / 1;
        if (phase < 0.25) {
          const k = Math.sin((phase / 0.25) * Math.PI);
          ctx.save();
          ctx.translate(p.x + 6, p.y - 14);
          ctx.fillStyle = S.rgba(P.bone, 0.9 * k);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const r = i % 2 ? 1.5 : 7 * k + 2;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }

    const layerOf = (c) => (S.spiderTypes[c.kind]?.layer ?? (() => 'room'))(c);

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
      if (settings.grain) {
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

    // ── Loop (the page's requestAnimationFrame calls frame()) ───────────

    const qa = { enabled: new URLSearchParams(location.search).has('qa'), frozen: false };

    function frame(dt) {
      game.clock += dt;
      if (!layers || !hero) return;
      const running = ['playing', 'makeover', 'restored'].includes(game.state);
      if (running && !qa.frozen) update(dt);
      else if (game.state === 'title' && !qa.frozen) idleTitle(dt);
      render();
    }

    // Behind the title letter the room is alive: dust drifts, lamp flickers.
    function idleTitle(dt) {
      game.time += dt;
      for (const w of webs) w.update(dt);
      dust.update(dt, game.time, 0);
      hero.update(dt, {}, { platforms: L.platforms, bounds: L.bounds });
      const look = lookoutPoint();
      hero.lookAt(look.x, look.y - 40);
    }

    // ── Flow ─────────────────────────────────────────────────────────

    const artOff = typeof location !== 'undefined' && new URLSearchParams(location.search).get('art') === 'off';

    // QA flags for prewarmRoom (Prompt 15, L1): ?noprewarm=1 skips the whole
    // dry run; ?prewarm=blend,art runs only the named parts. Neither flag
    // present runs every part, which is the normal, non-QA behaviour.
    const prewarmSearch = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    const noPrewarm = Boolean(prewarmSearch && prewarmSearch.has('noprewarm'));
    const prewarmOnly = prewarmSearch && prewarmSearch.has('prewarm')
      ? new Set(prewarmSearch.get('prewarm').split(',').map((s) => s.trim()).filter(Boolean))
      : null;
    function prewarmPartEnabled(name) {
      if (noPrewarm) return false;
      if (prewarmOnly) return prewarmOnly.has(name);
      return true;
    }

    function isBlockout(r) {
      if (!r) return false;
      if (artOff) return true;
      if (r.art === true && !r._artAttached) return true;
      if (!r.paint && (!r.art || !r.art.paint)) return true;
      return false;
    }

    function buildBlockoutArt(r) {
      const L = r.layout;
      const props = L.props || [];

      function paint(variant) {
        const isClean = variant === 'clean';
        const W = S.STAGE.width;
        const H = S.STAGE.height;
        const back = S.makeCanvas(W, H);
        const furniture = S.makeCanvas(W, H);
        const front = S.makeCanvas(W, H);
        const bg = back.getContext('2d');
        const fg = furniture.getContext('2d');

        const ceilY = L.CEILING ?? 100;
        const floorLine = L.FLOOR_LINE ?? 770;

        // Room bands (ceiling, wall, floor) in flat palette tones
        bg.fillStyle = isClean ? P.taupe : P.umber;
        bg.fillRect(0, 0, W, ceilY);

        bg.fillStyle = isClean ? P.linen : P.taupe;
        bg.fillRect(0, ceilY, W, floorLine - ceilY);

        bg.fillStyle = isClean ? P.oak : P.walnut;
        bg.fillRect(0, floorLine, W, H - floorLine);

        function drawLabelledRect(ctx, pr) {
          ctx.save();
          ctx.fillStyle = P.walnut;
          ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
          ctx.strokeStyle = P.linen;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(pr.x, pr.y, pr.w, pr.h);

          ctx.fillStyle = P.linen;
          ctx.font = '20px "Special Elite", cursive';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const label = pr.name || pr.kind || '';
          const metrics = ctx.measureText(label);
          if (metrics.width > pr.w - 12) {
            const s = Math.max(10, Math.floor((20 * (pr.w - 12)) / metrics.width));
            ctx.font = `${s}px "Special Elite", cursive`;
          }
          ctx.fillText(label, pr.x + pr.w / 2, pr.y + pr.h / 2);
          ctx.restore();
        }

        // Draw props
        for (const pr of props) {
          if (pr.kind === 'light') {
            const cx = pr.x + pr.w / 2;
            const cy = pr.y + pr.h / 2;
            const r = Math.min(14, Math.max(8, Math.min(pr.w, pr.h) / 2));
            fg.fillStyle = P.amber;
            fg.beginPath();
            fg.arc(cx, cy, r, 0, Math.PI * 2);
            fg.fill();
            fg.fillStyle = P.ember;
            fg.beginPath();
            fg.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
            fg.fill();
          } else if (pr.kind === 'wall' || pr.kind === 'window') {
            drawLabelledRect(bg, pr);
          } else {
            drawLabelledRect(fg, pr);
          }
        }

        if (L.window && !props.some((p) => p.kind === 'window')) {
          drawLabelledRect(bg, { name: 'Window', ...L.window, kind: 'window' });
        }

        // Every platform as a lit slab
        for (const p of L.platforms || []) {
          const h = p.y === L.GROUND ? Math.max(20, H - L.GROUND) : 18;
          fg.fillStyle = isClean ? P.oak : P.taupe;
          fg.fillRect(p.x0, p.y, p.x1 - p.x0, h);
          fg.fillStyle = isClean ? P.bone : P.linen;
          fg.fillRect(p.x0, p.y, p.x1 - p.x0, 4);
          fg.fillStyle = P.soot;
          fg.fillRect(p.x0, p.y + h - 2, p.x1 - p.x0, 2);
        }

        return { back, furniture, front };
      }

      function drawSky(ctx, live, t, mk) {
        ctx.fillStyle = mk.window > 0.5 ? P.sky : '#141B2C';
        ctx.fillRect(0, 0, S.STAGE.width, S.STAGE.height);
      }

      function drawProps() {}

      function lights(lightMap, live, t, mk) {
        const lightProps = props.filter((p) => p.kind === 'light');
        if (lightProps.length) {
          for (const pr of lightProps) {
            lightMap.point(pr.x + pr.w / 2, pr.y + pr.h / 2, 450, P.amber, 0.75);
          }
        } else {
          lightMap.point(400, 450, 500, P.amber, 0.7);
          lightMap.point(980, 320, 600, P.amber, 0.7);
          lightMap.point(1450, 450, 500, P.amber, 0.7);
        }
        return 1.0;
      }

      function glow(ctx, lightMap, live, t, mk, flick, shift) {
        const lightProps = props.filter((p) => p.kind === 'light');
        if (lightProps.length) {
          for (const pr of lightProps) {
            S.light.glow(ctx, pr.x + pr.w / 2, pr.y + pr.h / 2, 40, P.amber, 0.6);
          }
        } else {
          S.light.glow(ctx, 400, 450, 40, P.amber, 0.6);
          S.light.glow(ctx, 980, 320, 40, P.amber, 0.6);
          S.light.glow(ctx, 1450, 450, 40, P.amber, 0.6);
        }
      }

      return {
        paint,
        createLive: () => ({}),
        drawSky,
        drawProps,
        drawOnFurniture: () => {},
        lights,
        glow,
        beat: () => {},
      };
    }

    // Paint a room (or take it from the cache) and make it current.
    function load(id) {
      const next = S.rooms.get(id);
      if (!next) return Promise.reject(new Error(`There is no room "${id}".`));
      if (room && room !== next && room.onLeave) room.onLeave(world);

      const cached = !artOff && paintCache.get(id);
      const ready = () => {
        room = next;
        L = room.layout;
        const blockout = isBlockout(room);
        currentArt = blockout ? buildBlockoutArt(room) : (room.art && typeof room.art === 'object' ? room.art : room);
        live = currentArt.createLive ? currentArt.createLive(3) : (room.createLive ? room.createLive(3) : {});
        layers = takeLayers(next, currentArt);
        hud.setRoom(room);
        resetRoom();
        prewarmRoom(room, currentArt, live);
        game.state = 'ready';
        return room;
      };
      if (cached) return Promise.resolve(ready());
      const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
      const cssReady = next._cssReady || Promise.resolve();
      const artReady = next._artReady || Promise.resolve();
      // Painting a room twice takes a moment. Wait for fonts and room CSS, and
      // let the browser show whatever is on screen before we block it.
      return Promise.all([
        fontsReady,
        cssReady,
        artReady,
        new Promise((r) => setTimeout(r, 40)),
      ]).then(() => ready());
    }

    // A fully-clean makeover state, used only to dry-run paints and beats
    // that would otherwise do their first, expensive work on the first real
    // makeover frame. r.makeover.beats/.uniqueBeat name the flags their own
    // room expects to see set, same as the live makeover eventually sets them.
    function prewarmCleanMk(r) {
      const cleanMk = {
        t: 6,
        wipe: 1,
        sweepX: 2500,
        window: 1,
        sparkle: 1,
        mood: 1,
        steaming: true,
        released: new Set(),
        cues: new Set(),
      };
      for (const beat of r.makeover?.beats ?? []) {
        if (beat.key) cleanMk[beat.key] = 1;
        if (beat.name) cleanMk[beat.name] = 1;
      }
      const unique = r.makeover?.uniqueBeat;
      if (unique?.key) cleanMk[unique.key] = 1;
      return cleanMk;
    }

    function prewarmThrowawayCtx() {
      const throwaway = document.createElement('canvas');
      throwaway.width = 320;
      throwaway.height = 180;
      return throwaway.getContext('2d');
    }

    // Part "blend": the two masked-blend canvases used while the sweep crosses the room.
    function prewarmBlend() {
      if (!(layers && layers.clean && layers.dirty)) return;
      const W = S.STAGE.width;
      const H = S.STAGE.height;
      blendCleanCtx.globalCompositeOperation = 'source-over';
      blendCleanCtx.clearRect(0, 0, W, H);
      blendCleanCtx.drawImage(layers.clean.back, 0, 0);
      blendCleanCtx.globalCompositeOperation = 'destination-in';
      const gradClean = blendCleanCtx.createLinearGradient(0, 0, W, 0);
      gradClean.addColorStop(0, 'rgba(0,0,0,1)');
      gradClean.addColorStop(1, 'rgba(0,0,0,0)');
      blendCleanCtx.fillStyle = gradClean;
      blendCleanCtx.fillRect(0, 0, W, H);

      blendDirtyCtx.globalCompositeOperation = 'source-over';
      blendDirtyCtx.clearRect(0, 0, W, H);
      blendDirtyCtx.drawImage(layers.dirty.back, 0, 0);
      blendDirtyCtx.globalCompositeOperation = 'destination-in';
      const gradDirty = blendDirtyCtx.createLinearGradient(0, 0, W, 0);
      gradDirty.addColorStop(0, 'rgba(0,0,0,0)');
      gradDirty.addColorStop(1, 'rgba(0,0,0,1)');
      blendDirtyCtx.fillStyle = gradDirty;
      blendDirtyCtx.fillRect(0, 0, W, H);
    }

    // Part "art": drawProps / drawSky / drawOnFurniture / lights / glow,
    // painted once into a throwaway context so any cache they build lazily
    // (an offscreen sprite, a gradient) is built before the first real frame.
    // The live light map and the live room state are never touched: a stub
    // light map stands in, and `lv` is restored to what it held going in,
    // in case some room's art writes to it rather than just reading it.
    function prewarmArt(r, art, lv) {
      const tctx = prewarmThrowawayCtx();
      const cleanMk = prewarmCleanMk(r);
      const stubLight = new S.LightMap();
      const lvKeysBefore = lv ? Object.keys(lv) : null;
      const lvSnapshot = lv ? { ...lv } : null;
      try {
        if (art.drawProps) art.drawProps(tctx, lv, 0, cleanMk);
        if (art.drawSky) art.drawSky(tctx, lv, 0, cleanMk);
        if (art.drawOnFurniture) art.drawOnFurniture(tctx, lv, 0, cleanMk);
        if (art.lights) art.lights(stubLight, lv, 0, cleanMk);
        if (art.glow) art.glow(tctx, stubLight, lv, 0, cleanMk, 0, 0);
      } catch (e) {
        console.warn(`prewarmRoom: "art" dry run failed for room "${r.id}":`, e);
      }
      if (lv) {
        for (const k of Object.keys(lv)) if (!lvKeysBefore.includes(k)) delete lv[k];
        Object.assign(lv, lvSnapshot);
      }
    }

    // Part "beats": each makeover beat and the room's uniqueBeat, dry-run at
    // t = 6 so a beat's own first-call cache is already built. Nothing here
    // can spawn a real particle, play a real sound or touch live state: fx
    // is a throwaway stand-in (a fresh Burst, a muted audio stub), and the
    // beats only ever write into the cleanMk passed to them, not into `lv`.
    function prewarmStubFx() {
      return {
        time: 6,
        sfx: () => {},
        audio: {}, // every room's own sound() helper checks `a.ctx`, which this lacks
        burst: new S.Burst(1, 1), // thrown away with this call; never drawn or updated
      };
    }

    function prewarmBeats(r, art) {
      const cleanMk = prewarmCleanMk(r);
      const stubFx = prewarmStubFx();
      try {
        for (const beat of r.makeover?.beats ?? []) {
          if (beat.name && art?.beat) art.beat(beat.name, cleanMk, 6);
        }
        const unique = r.makeover?.uniqueBeat;
        if (unique?.run) unique.run(cleanMk, 6, stubFx);
      } catch (e) {
        console.warn(`prewarmRoom: "beats" dry run failed for room "${r.id}":`, e);
      }
    }

    // Part "audio": the chime/roar/tone audio graph's nodes.
    function prewarmAudioPart() {
      if (audio && audio.prewarm) audio.prewarm();
    }

    // Part "results": lay out the results card once, off-screen, so its
    // font metrics and layout are already computed before the real one shows.
    function prewarmResults() {
      const resultsCard = document.querySelector('[data-card="results"]');
      if (!resultsCard) return;
      if (hud && hud.fillResults) {
        hud.fillResults({ score: 10000, time: 60, kills: 16, eggs: 0, bestCombo: 5, untouched: true });
      }
      const prevVis = resultsCard.style.visibility;
      resultsCard.style.visibility = 'hidden';
      resultsCard.classList.add('is-open');
      void resultsCard.offsetHeight;
      const btn = resultsCard.querySelector('button');
      if (btn) {
        btn.focus({ preventScroll: true });
        btn.blur();
      }
      resultsCard.classList.remove('is-open');
      resultsCard.style.visibility = prevVis;
    }

    // Pre-warm caches, blend buffers, audio graph and DOM layout to prevent
    // makeover hitches (Prompt 15, L1). ?noprewarm=1 / ?prewarm=<parts> (QA
    // only, see prewarmPartEnabled above) let perf.mjs isolate which part is
    // responsible for a given room's spike.
    function prewarmRoom(r, art, lv) {
      if (prewarmPartEnabled('blend')) prewarmBlend();
      if (prewarmPartEnabled('art')) prewarmArt(r, art, lv);
      if (prewarmPartEnabled('beats')) prewarmBeats(r, art);
      if (prewarmPartEnabled('audio')) prewarmAudioPart();
      if (prewarmPartEnabled('results')) prewarmResults();
    }

    // Painted layers per room, newest last; three rooms is plenty of memory.
    function takeLayers(r, artSource) {
      let painted = !artOff && paintCache.get(r.id);
      if (painted) paintCache.delete(r.id);
      else {
        const art = artSource || (r.art && typeof r.art === 'object' ? r.art : r);
        painted = { dirty: art.paint('dirty'), clean: art.paint('clean') };
      }
      if (!artOff) {
        paintCache.set(r.id, painted);
        while (paintCache.size > 3) paintCache.delete(paintCache.keys().next().value);
      }
      return painted;
    }

    // The title: the room in its dirty state, alive, nobody fighting.
    function showTitle(pose = {}) {
      resetRoom();
      game.state = 'title';
      poseHero(pose);
    }

    function poseHero({ x, facing, aim } = {}) {
      if (x !== undefined) hero.x = x;
      if (aim !== undefined) hero.aim = aim;
      if (facing !== undefined) hero.facing = facing;
    }

    function begin() {
      audio.resetAmbience();
      resetRoom();
      hud.setNerve(100);
      game.state = 'playing';
      if (room.onStart) room.onStart(world, {});
      S.progress.setLastRoom(room.id);
      canvas.focus({ preventScroll: true });
    }

    function restart() {
      begin();
      onEvent('restarted', {});
    }

    function togglePause() {
      if (game.state === 'playing') {
        game.state = 'paused';
        onEvent('paused', {});
      } else if (game.state === 'paused') {
        game.state = 'playing';
        onEvent('resumed', {});
        canvas.focus({ preventScroll: true });
      }
    }

    // Leaving for the map: the room stops; its painted layers stay cached.
    function leave() {
      if (room && room.onLeave) room.onLeave(world);
      game.state = 'idle';
      keys.clear();
      pointer.down = false;
    }

    function applySettings(next) {
      Object.assign(settings, next);
    }

    // ── QA hooks ─────────────────────────────────────────────────────

    const step = (seconds) => {
      const n = Math.round(seconds * 60);
      for (let i = 0; i < n; i++) update(1 / 60);
    };

    const qaHeroX = (name, fallback) => room.qa?.heroX?.[name] ?? fallback;

    // The same "action" frame as the reference: two string spiders hovering,
    // a crawler on the wall, an egg falling, a hatchling, a dart mid-flight.
    function stageAction() {
      const a = room.qa?.action;
      if (!a) {
        game.state = 'playing';
        director.next = 999;
        hero.x = 820;
        hero.facing = 1;
        step(0.9);
        return;
      }
      game.state = 'playing';
      director.next = 999;
      hero.x = a.heroX ?? 820;
      hero.facing = 1;
      for (const s of a.strings ?? []) spawn('string', { x: s.x, targetY: s.targetY, hover: true, seed: s.seed ?? 500 });
      for (const c of a.crawlers ?? []) spawn('crawler', { lair: c.lair, emerged: true, seed: c.seed ?? 500 });
      for (const e of a.eggs ?? []) world.spawnEgg(e.x, e.y, 'falling');
      for (const h of a.hatchlings ?? []) critters.push(new S.spiders.Hatchling({ x: h.x, y: L.GROUND - 8, seed: h.seed }));
      // A dart that has already ripped through the first webs.
      if (a.tear) for (const w of webs.slice(0, a.tear.webs)) w.tear(...a.tear.path, 0, 60);
      stats.kills = a.kills ?? 9;
      stats.score = a.score ?? 6420;
      stats.combo = 3;
      hud.setScore(stats.score);
      hud.setCombo(3);
      hero.nerve = a.nerve ?? 72;
      nerveSeen = hero.nerve; // staged, not an injury: no shake, combo kept
      step(0.9);
      // Aim at a spider and fire a volley mid-flight.
      pointer.x = a.aimAt.x;
      pointer.y = a.aimAt.y;
      pointer.lastMove = game.clock;
      updateAim();
      fireWeapon();
      step(0.08);
    }

    function stageRestored() {
      game.state = 'restored';
      stats.kills = rules.quota;
      for (const w of webs) for (const seg of w.segments) seg.alive = false;
      if (rules.extraGoals) {
        for (const g of rules.extraGoals) completedGoals.add(g.id);
      }
      hero.x = qaHeroX('clean', 980);
      finishMakeover();
      hero.feel('relieved', 99);
      hud.stamp();
    }

    // What a room's own QA states (qa.states.name(api)) may use.
    const stagingApi = {
      world,
      completeGoal(id) {
        world.completeGoal(id);
      },
      step,
      spawn,
      fire: fireWeapon,
      get hero() {
        return hero;
      },
      aimAt(x, y) {
        pointer.x = x;
        pointer.y = y;
        pointer.lastMove = game.clock;
        updateAim();
      },
      setState(name) {
        game.state = name;
      },
      // Set the hero's nerve for a staged frame without it counting as a hit.
      setNerve(value) {
        hero.nerve = value;
        nerveSeen = value;
      },
      placeHero(x, platformName) {
        hero.x = x;
        if (platformName) {
          const p = L.platforms.find((pl) => pl.name === platformName);
          if (!p) throw new Error(`Room "${room.id}" has no platform "${platformName}".`);
          hero.y = p.y;
          hero.vy = 0;
          hero.onGround = true;
          hero.standingOn = p;
        } else {
          hero.y = L.GROUND;
          hero.vy = 0;
          hero.onGround = true;
          hero.standingOn = L.platforms.find((pl) => pl.y === L.GROUND && x >= pl.x0 && x <= pl.x1) || null;
        }
      },
      setScore({ score, combo, kills, eggs } = {}) {
        if (score !== undefined) {
          stats.score = score;
          hud.setScore(score);
        }
        if (combo !== undefined) {
          stats.combo = combo;
          stats.bestCombo = Math.max(stats.bestCombo, combo);
          hud.setCombo(combo);
        }
        if (kills !== undefined) stats.kills = kills;
        if (eggs !== undefined) stats.eggs = eggs;
      },
      holdDirector() {
        director.next = 999;
      },
      startMakeover,
      finishMakeover,
      selectWeapon,
      switchWeapon,
      get breakables() {
        return breakables;
      },
      get pickups() {
        return pickups;
      },
    };

    function qaSetup(name) {
      staging = true;
      resetRoom();
      qa.frozen = true;
      hud.setNerve(100);
      // The weapon tag keeps whatever the last staged state left on it; start
      // full, so a frame does not depend on which state was staged before it.
      hud.setCharge(1);
      if (room.onStart) room.onStart(world, { qa: name });
      const custom = room.qa?.states?.[name];
      switch (custom ? 'custom' : name) {
        case 'custom':
          custom(stagingApi);
          break;
        case 'dirty':
          game.state = 'playing';
          director.next = 999;
          hero.x = qaHeroX('dirty', 760);
          step(1.5);
          break;
        case 'action':
          stageAction();
          break;
        case 'cutter-arc':
          stageAction();
          switchWeapon('web-cutter');
          stagingApi.aimAt(1500, 200);
          fireWeapon();
          step(0.12);
          break;
        case 'nest-foamed': {
          game.state = 'playing';
          director.next = 999;
          switchWeapon('foam-spray');
          stagingApi.placeHero(700);
          stagingApi.aimAt(920, 890);
          // Foam Spray only emits while fire is held, so hold it through
          // every sub-step rather than tapping it once, or the tank puts
          // out at most a single blob instead of a stream.
          const foamFrames = Math.round(0.15 * 60);
          for (let i = 0; i < foamFrames; i++) {
            fireWeapon();
            step(1 / 60);
          }
          break;
        }
        case 'flame-web':
          game.state = 'playing';
          director.next = 999;
          previousWeaponId = 'vacuum';
          S.weapons.get('flamethrower')?.startTimer(8.0);
          switchWeapon('flamethrower');
          stagingApi.placeHero(500);
          stagingApi.aimAt(250, 240);
          fireWeapon();
          step(0.15);
          break;
        case 'sonic-pulse': {
          game.state = 'playing';
          director.next = 999;
          // Open floor, away from the stairwell banister (x 110-430): GROUND
          // (935) via placeHero's no-platform branch.
          stagingApi.placeHero(740);
          const pulse = S.weapons.get('sonic-pulse');
          pulse?.addCharge(1);
          // Fire it the way pressing F does in play (see the KeyF handler
          // above): the Sonic Pulse fires on its own charge, without ever
          // becoming the held weapon.
          if (pulse && pulse.hasCharge && pulse.hasCharge()) pulse.fire(world, hero);
          step(0.2);
          break;
        }
        case 'box-burst':
          game.state = 'playing';
          director.next = 999;
          stagingApi.placeHero(380);
          if (breakables.length > 0) {
            breakables[0].hits = 3;
            breakables[0].broken = true;
            pickups.push({
              x: breakables[0].x,
              y: breakables[0].y - 20,
              startY: breakables[0].y - 20,
              contains: breakables[0].contains,
              age: 0.5,
            });
            burst.fibres(breakables[0].x, breakables[0].y - 20, 20);
            burst.airPuff(breakables[0].x, breakables[0].y - 20, -Math.PI / 2);
          }
          step(0.05);
          break;
        case 'hud-fan':
          game.state = 'playing';
          director.next = 999;
          S.progress.data.unlocked = ['vacuum', 'web-cutter', 'foam-spray'];
          S.weapons.get('sonic-pulse')?.addCharge(1);
          switchWeapon('vacuum');
          step(0.05);
          break;
        case 'makeover':
          game.state = 'playing';
          director.next = 999;
          hero.x = qaHeroX('makeover', 980);
          step(0.5);
          startMakeover();
          step(1.25);
          break;
        case 'clean':
          stageRestored();
          step(1.2);
          break;
        case 'results':
          stageRestored();
          Object.assign(stats, { score: 18740, kills: rules.quota, eggs: 5, bestCombo: 5, untouched: false, time: 154 });
          onEvent('restored', { room, stats: { ...stats }, staged: true });
          step(1);
          break;
        default:
          staging = false;
          throw new Error(`Unknown QA state "${name}".`);
      }
      showProgress();
      hud.setNerve(hero.nerve);
      hud.tick(10);
      render();
      staging = false;
    }

    function qaTitle(pose) {
      resetRoom();
      qa.frozen = true;
      game.state = 'title';
      poseHero(pose);
      idleTitle(2);
      render();
    }

    return {
      load,
      showTitle,
      begin,
      restart,
      togglePause,
      leave,
      frame,
      render: () => layers && hero && render(),
      applySettings,
      get room() {
        return room;
      },
      get state() {
        return game.state;
      },
      get stats() {
        return stats;
      },
      get world() {
        return world;
      },
      get muted() {
        return audio.muted;
      },
      qa: {
        enabled: qa.enabled,
        setup: qaSetup,
        title: qaTitle,
        step(seconds) {
          step(seconds);
          render();
        },
        // Finish the room's goals instantly and let the normal rules notice.
        clearRoom() {
          stats.kills = rules.quota;
          critters = [];
          for (const w of webs) for (const seg of w.segments) seg.alive = false;
          if (rules.extraGoals) {
            for (const g of rules.extraGoals) completedGoals.add(g.id);
          }
        },
        bossTo(fraction) {
          if (!boss) return;
          boss.health = Math.max(0, Math.min(1, fraction)) * boss.maxHealth;
          checkBossPhase();
          if (boss.health <= 0) defeatBoss();
          syncBossHud();
        },
        bossPhase(phaseId) {
          if (!boss || !boss.phases) return;
          const pIdx = boss.phases.findIndex((p) => p.id === phaseId);
          if (pIdx !== -1) {
            boss.currentPhaseIndex = pIdx;
            triggerBossPhase(phaseId);
          }
        },
        play() {
          qa.frozen = false;
        },
        freeze() {
          qa.frozen = true;
        },
        get frozen() {
          return qa.frozen;
        },
      },
    };
  };
})();
