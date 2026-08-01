/* ParaTrooper — a port of the 1982 Orion Software game to the browser.
 *
 * The rules, the timing and the random number generator are the original's,
 * taken from the disassembly in ../src/paratrooper.asm and documented in
 * ../docs/. The artwork is not: the original sprite format was never decoded,
 * so every shape here is drawn from scratch.
 *
 * What is faithful:
 *   - the 18.2 Hz logic clock, the BIOS tick the original waited on
 *   - the linear congruential generator, constants and all
 *   - scoring: helicopter/jet 10, paratrooper 5, bomb 30, and -1 per shot
 *   - four paratroopers on one side, or one on the gun base, ends the game
 *   - the title melody, read as timer divisors out of the original binary
 *   - "classic" controls, where one key starts the gun swinging and another
 *     stops it and fires
 */

'use strict';

// ---------------------------------------------------------------- constants

const W = 960, H = 600;            // internal resolution; CSS scales it
const GROUND_Y = 545;              // screen y of the ground line
const TICK_HZ = 18.2;              // the original's clock, to the decimal
const TICK_MS = 1000 / TICK_HZ;

const GUN_X = W / 2;
const GUN_BASE_HALF = 52;          // half-width of the gun base zone
const GUN_HALF_W = 46;             // the emplacement itself, as a bomb target
const GUN_TOP = 46;                // its height in game coordinates
const MAX_ANGLE = 1.40;            // ~80 degrees either side of vertical
const BARREL_LEN = 52;

const SCORE_HELI = 10, SCORE_PARA = 5, SCORE_BOMB = 30, SCORE_SHOT = -1;
const LOSE_PER_SIDE = 4;

// The title melody, straight out of the original binary at DS:0x0F85. These
// are divisors for the PC's 1,193,182 Hz timer, not frequencies -- the same
// numbers the 1982 program fed to port 0x42.
const MELODY = [3620, 2712, 3620, 2416, 3620, 2280, 3620, 2712, 3620, 2416,
  3620, 2280, 3620, 2032, 3620, 2416, 3620, 2280, 3620, 2032, 3620, 1810,
  3620, 2280, 3620, 2032, 3620, 1810, 3620, 1708, 3620, 2032, 3620, 1810,
  3620, 1708, 3620, 2032, 3620, 1810, 3620, 2280, 3620, 2032, 3620, 2416,
  3620, 2280, 3620, 2712, 3620, 2416, 3620, 2873, 3620];
const PIT_HZ = 1193182;

// ---------------------------------------------------------------- the RNG

/* The original generator, exactly: seed = (seed * 30593 + 25801) mod 65536.
 *
 * Math.imul matters here. A plain `seed * 30593` exceeds 2^53 within a few
 * iterations and JavaScript silently loses precision, which produces a
 * generator that still looks random and is not this one. From seed 1 the first
 * six values must be 56394, 52243, 3932, 58917, 36974, 20023. */
let seed = 1;
function rnd() {
  seed = (Math.imul(seed, 30593) + 25801) & 0xFFFF;
  return seed;
}
function rndF() { return rnd() / 65536; }

/* Scale, never modulo.
 *
 * The low bits of a power-of-two LCG are barely random at all: bit k repeats
 * with period 2^(k+1). This generator is worse than most, because 30593 and
 * 25801 are both 1 (mod 4), which makes the bottom two bits literally count
 * upward -- 2, 3, 0, 1, 2, 3, 0, 1, for ever.
 *
 * `rnd() % 4` therefore returns a counter, not a number. Written that way,
 * `if (rndInt(4) === 0) spawnJet(); else spawnHeli();` locked to one phase and
 * spawned *only* jets, so no helicopter ever appeared, no paratrooper ever
 * jumped, and the game ran for eleven waves without anything happening.
 *
 * Scaling the whole value uses the high bits, which are fine. This is the
 * original reason for the old advice never to take an LCG modulo a small
 * number, demonstrated on an actual 1982 generator. */
function rndInt(n) { return Math.floor((rnd() / 65536) * n); }
function rndRange(a, b) { return a + rndF() * (b - a); }

(function selfTest() {
  const save = seed; seed = 1;
  const got = [rnd(), rnd(), rnd(), rnd(), rnd(), rnd()].join(',');
  if (got !== '56394,52243,3932,58917,36974,20023') {
    console.error('RNG does not match the original:', got);
  }
  seed = save;
})();

// ---------------------------------------------------------------- utilities

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

/* Game coordinates put y = 0 at the ground and count upward, the way the
 * original did -- so gravity is a subtraction and "has it landed?" is a
 * comparison against zero. The flip happens once, here, at drawing time. */
const sy = y => GROUND_Y - y;

// ---------------------------------------------------------------- audio

/* One square-wave voice, because that is what a PC speaker is. */
const Audio_ = {
  ctx: null, master: null, enabled: true, melodyTimer: null,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.16;
    this.master.connect(this.ctx.destination);
  },

  beep(freq, ms, type = 'square', vol = 1) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + ms / 1000 + 0.02);
    return osc;
  },

  sweep(from, to, ms, vol = 1) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + ms / 1000);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + ms / 1000 + 0.02);
  },

  shot()      { this.beep(1400, 45, 'square', 0.5); },
  hitAir()    { this.sweep(900, 180, 200, 0.7); },
  hitGround() { this.sweep(420, 60, 380, 0.9); },
  bombDrop()  { this.sweep(300, 900, 500, 0.35); },
  land()      { this.beep(180, 70, 'square', 0.5); },
  wave()      { this.beep(660, 90); setTimeout(() => this.beep(880, 140), 110); },

  /* The 1982 title tune. Each entry is a timer divisor; the frequency is
   * 1193182 divided by it, exactly as the original computed it. */
  startMelody() {
    this.stopMelody();
    if (!this.enabled || !this.ctx) return;
    let i = 0;
    const step = () => {
      const d = MELODY[i % MELODY.length];
      this.beep(PIT_HZ / d, 150, 'square', 0.55);
      i++;
      this.melodyTimer = setTimeout(step, 165);
    };
    step();
  },
  stopMelody() {
    if (this.melodyTimer) { clearTimeout(this.melodyTimer); this.melodyTimer = null; }
  }
};

// ---------------------------------------------------------------- input

const Keys = Object.create(null);
const Pressed = Object.create(null);   // consumed once per tick

addEventListener('keydown', e => {
  if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  if (!Keys[e.code]) Pressed[e.code] = true;
  Keys[e.code] = true;
  Audio_.init();
  if (Audio_.ctx && Audio_.ctx.state === 'suspended') Audio_.ctx.resume();
});
addEventListener('keyup', e => { Keys[e.code] = false; });
addEventListener('blur', () => { for (const k in Keys) Keys[k] = false; });

function takePress(code) {
  if (Pressed[code]) { Pressed[code] = false; return true; }
  return false;
}

// ---------------------------------------------------------------- state

const State = { TITLE: 0, PLAYING: 1, PYRAMID: 2, DYING: 3, OVER: 4 };

const game = {
  state: State.TITLE,
  score: 0, hiScore: 0, wave: 1,
  shots: 0, kills: 0,
  gunAngle: 0, gunPrev: 0, gunSpin: 0,      // gunSpin: -1, 0, +1
  reload: 0,
  classicControls: false,
  helis: [], jets: [], paras: [], bullets: [], bombs: [], parts: [],
  left: 0, right: 0,                        // landed paratrooper counters
  spawnTimer: 0, quota: 0, dyingTimer: 0,
  shake: 0, flash: 0, muzzle: 0,
  tick: 0
};

/* Pass a seed to get a reproducible game. Without one it seeds from the clock,
 * which is what the original did -- it measured how long you took to press a
 * key at the title screen, the only unpredictable thing on that machine.
 *
 * The override exists so the port can be tested the way the porting notes
 * argue for: run N ticks from a fixed seed and compare the result. A game you
 * cannot replay is a game you cannot debug. */
function resetGame(seedOverride) {
  game.score = 0; game.wave = 1; game.shots = 0; game.kills = 0;
  game.gunAngle = 0; game.gunPrev = 0; game.gunSpin = 0; game.reload = 0;
  game.helis = []; game.jets = []; game.paras = [];
  game.bullets = []; game.bombs = []; game.parts = [];
  game.left = 0; game.right = 0;
  game.spawnTimer = 12; game.quota = waveQuota(1);
  game.shake = 0; game.flash = 0; game.muzzle = 0; game.tick = 0;
  game.lastSide = 1; game.cause = null;
  game.pyrCrew = []; game.pyrTimer = 0;
  seed = (seedOverride !== undefined ? seedOverride : (Date.now() & 0xFFFF)) || 1;
}

const waveQuota = w => 4 + w * 2;
/* Fast enough that a wave crosses the screen and is gone. At the original
 * speed six helicopters were on screen at once for most of a wave, which made
 * "wave" mean nothing and gave the player no rhythm to play against. */
const waveSpeed = w => 3.1 + w * 0.34;
const waveGap   = w => Math.max(10, 32 - w * 2.2);

// ---------------------------------------------------------------- entities

function spawnHeli() {
  /* Alternate sides and keep altitudes apart. Picking both at random stacks
   * three helicopters into one silhouette often enough to look broken, and a
   * player cannot aim at what they cannot tell apart. */
  game.lastSide = -(game.lastSide || 1);
  const fromLeft = game.lastSide > 0;
  let y = rndRange(300, 470);
  for (let attempt = 0; attempt < 6; attempt++) {
    const clash = game.helis.some(o => Math.abs(o.y - y) < 42 &&
                                       (o.vx > 0) === fromLeft);
    if (!clash) break;
    y = rndRange(300, 470);
  }
  game.helis.push({
    x: fromLeft ? -70 : W + 70, y, px: 0, py: y,
    vx: (fromLeft ? 1 : -1) * waveSpeed(game.wave),
    dir: fromLeft ? 1 : -1,
    drops: 1 + rndInt(Math.min(3, 1 + Math.floor(game.wave / 2))),
    dropAt: 6 + rndInt(60),          // where in its run this one starts dropping
    rotor: rndF() * TAU, blink: 0, alive: true
  });
}

function spawnJet() {
  const fromLeft = rndInt(2) === 0;
  const y = rndRange(480, 530);
  game.jets.push({
    x: fromLeft ? -90 : W + 90, y, px: 0, py: y,
    vx: (fromLeft ? 1 : -1) * (waveSpeed(game.wave) + 3.4),
    dir: fromLeft ? 1 : -1,
    dropped: false, flame: 0, alive: true
  });
}

function dropPara(x, y) {
  game.paras.push({
    x, y, px: x, py: y, vy: 0,
    state: 'fall',            // fall -> canopy -> landed  (or 'cut')
    openAt: rndRange(200, 300),
    sway: rndF() * TAU, swayV: rndRange(0.06, 0.13),
    side: 0, walk: 0, alive: true
  });
}

function fire() {
  if (game.reload > 0) return;
  game.reload = 2;
  game.shots++;
  addScore(SCORE_SHOT);
  const a = game.gunAngle;
  const mx = GUN_X + Math.sin(a) * BARREL_LEN;
  const my = 34 + Math.cos(a) * BARREL_LEN;
  game.bullets.push({
    x: mx, y: my, px: mx, py: my,
    vx: Math.sin(a) * 17, vy: Math.cos(a) * 17
  });
  game.muzzle = 2;
  Audio_.shot();
}

function addScore(n) {
  game.score += n;
  if (game.score > game.hiScore) game.hiScore = game.score;
}

/* An explosion is four things happening at once, and leaving any of them out
 * is what makes a burst of dots look like a burst of dots: a white core that
 * dies almost immediately, a shockwave that outruns everything, sparks thrown
 * outward under gravity, and smoke that lingers after the light has gone. */
function boom(x, y, n, hue, big) {
  const P = game.parts;

  P.push({ kind: 'flash', x, y, px: x, py: y, age: 0,
           life: big ? 4 : 3, size: big ? 46 : 24 });

  P.push({ kind: 'ring', x, y, px: x, py: y, age: 0,
           life: big ? 6 : 4, size: big ? 62 : 32, hue });

  for (let i = 0; i < n; i++) {
    const a = rndF() * TAU;
    const s = rndRange(1.4, big ? 11 : 6.5) * (0.4 + rndF() * 0.6);
    P.push({
      kind: 'spark', x, y, px: x, py: y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rndRange(7, big ? 24 : 15), age: 0,
      hue: hue + rndRange(-16, 22), size: rndRange(1.4, big ? 3.6 : 2.4)
    });
  }

  const puffs = big ? 9 : 4;
  for (let i = 0; i < puffs; i++) {
    const a = rndF() * TAU, s = rndRange(0.3, big ? 2.2 : 1.3);
    P.push({
      kind: 'smoke', x: x + rndRange(-6, 6), y: y + rndRange(-6, 6),
      px: x, py: y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5,
      life: rndRange(16, big ? 40 : 26), age: 0,
      size: rndRange(big ? 9 : 5, big ? 20 : 11), rot: rndF() * TAU
    });
  }

  game.shake = Math.min(16, game.shake + (big ? 12 : 5));
  game.flash = Math.min(1, game.flash + (big ? 0.5 : 0.18));
}

// ---------------------------------------------------------------- one tick

function update() {
  game.tick++;
  if (game.reload > 0) game.reload--;
  if (game.muzzle > 0) game.muzzle--;
  game.shake *= 0.82;
  game.flash *= 0.80;

  if (game.state === State.PYRAMID) { updatePyramid(); return; }

  if (game.state === State.DYING) {
    game.dyingTimer--;
    stepParticles();
    if (game.dyingTimer <= 0) {
      game.state = State.OVER;
      Audio_.startMelody();
    }
    return;
  }
  if (game.state !== State.PLAYING) { stepParticles(); return; }

  // --- gun ---------------------------------------------------------------
  game.gunPrev = game.gunAngle;
  if (game.classicControls) {
    /* The original scheme: one key starts the gun swinging and it keeps
     * swinging; another stops it and fires. You do not aim, you time a stop. */
    if (takePress('ArrowLeft')  || takePress('Numpad4')) game.gunSpin = -1;
    if (takePress('ArrowRight') || takePress('Numpad6')) game.gunSpin = 1;
    if (takePress('Space') || takePress('Numpad5')) { game.gunSpin = 0; fire(); }
    game.gunAngle += game.gunSpin * 0.085;
  } else {
    let d = 0;
    if (Keys['ArrowLeft']  || Keys['KeyA'] || Keys['Numpad4']) d -= 1;
    if (Keys['ArrowRight'] || Keys['KeyD'] || Keys['Numpad6']) d += 1;
    game.gunAngle += d * 0.085;
    if (Keys['Space'] || Keys['Numpad5']) fire();
  }
  game.gunAngle = clamp(game.gunAngle, -MAX_ANGLE, MAX_ANGLE);

  // --- spawning ----------------------------------------------------------
  if (game.quota > 0) {
    if (--game.spawnTimer <= 0) {
      if (game.wave >= 2 && rndInt(4) === 0) spawnJet(); else spawnHeli();
      game.quota--;
      game.spawnTimer = waveGap(game.wave) + rndInt(14);
    }
  } else if (!game.helis.length && !game.jets.length &&
             !game.paras.some(p => p.state !== 'landed') && !game.bombs.length) {
    game.wave++;
    game.quota = waveQuota(game.wave);
    game.spawnTimer = 16;
    Audio_.wave();
  }

  // --- helicopters -------------------------------------------------------
  for (const h of game.helis) {
    h.px = h.x; h.py = h.y;
    h.x += h.vx;
    h.rotor += 0.9;
    h.blink++;
    /* The countdown only runs while the helicopter is over the field. Letting
     * it tick away off-screen meant every helicopter arrived with its timer
     * already expired and dropped its first man the instant it crossed the
     * boundary -- so parachutes piled into a column at exactly x = 91. */
    if (h.drops > 0 && h.x > 80 && h.x < W - 80 && --h.dropAt <= 0) {
      dropPara(h.x, h.y - 14);
      h.drops--;
      h.dropAt = 16 + rndInt(24);
    }
    if (h.x < -110 || h.x > W + 110) h.alive = false;
  }

  // --- jets --------------------------------------------------------------
  for (const j of game.jets) {
    j.px = j.x; j.py = j.y;
    j.x += j.vx;
    j.flame++;
    if (!j.dropped && Math.abs(j.x - GUN_X) < 130) {
      j.dropped = true;
      game.bombs.push({ x: j.x, y: j.y - 12, px: j.x, py: j.y - 12, vy: 0, spin: 0 });
      Audio_.bombDrop();
    }
    if (j.x < -130 || j.x > W + 130) j.alive = false;
  }

  // --- bombs -------------------------------------------------------------
  for (const b of game.bombs) {
    b.px = b.x; b.py = b.y;
    b.vy -= 0.55;               // game y counts upward, so gravity subtracts
    b.y += b.vy;
    b.spin += 0.2;

    /* A bomb is a physical object, not a trigger at ground level. It kills the
     * gun by touching it, at whatever height that happens -- so a bomb falling
     * squarely onto the emplacement ends the game before it ever lands. */
    if (Math.abs(b.x - GUN_X) < GUN_HALF_W && b.y <= GUN_TOP) {
      die('bomb'); return;
    }

    if (b.y <= 12) {
      /* On open ground it is just an explosion. But it will kill a paratrooper
       * standing there -- and that man stops counting against you, so the
       * enemy's own bombs can clear the ground they were trying to take. */
      for (const p of game.paras) {
        if (!p.alive || p.state !== 'landed') continue;
        if (Math.abs(p.x - b.x) > 22) continue;
        p.alive = false;
        if (p.side < 0) game.left = Math.max(0, game.left - 1);
        else            game.right = Math.max(0, game.right - 1);
        boom(p.x, sy(10), 16, 18, false);
      }
      boom(b.x, sy(8), 18, 30, false);
      Audio_.hitGround();
      b.dead = true;
    }
  }

  // --- paratroopers ------------------------------------------------------
  for (const p of game.paras) {
    p.px = p.x; p.py = p.y;
    if (p.state === 'fall') {
      p.vy -= 0.42;
      p.y += p.vy;
      if (p.y <= p.openAt) { p.state = 'canopy'; p.vy = -1.15; }
    } else if (p.state === 'canopy') {
      p.vy = -1.15;
      p.y += p.vy;
      p.sway += p.swayV;
      p.x += Math.sin(p.sway) * 0.5;
    } else if (p.state === 'cut') {
      /* Canopy shot away. He falls fast, and anyone he lands on dies with
       * him -- the chain kill that makes shooting canopies worth it. */
      p.vy -= 0.62;
      p.y += p.vy;
      for (const q of game.paras) {
        if (q === p || !q.alive || q.state === 'landed') continue;
        if (Math.abs(q.x - p.x) < 18 && q.y < p.y && p.y - q.y < 26) {
          q.alive = false;
          boom(q.x, sy(q.y), 12, 20, false);
          addScore(SCORE_PARA);
          game.kills++;
        }
      }
    }

    if (p.state !== 'landed' && p.y <= 8) {
      p.y = 8;
      if (p.state === 'cut') {                 // splattered, harmless
        p.alive = false;
        boom(p.x, sy(8), 14, 15, false);
        Audio_.hitGround();
        continue;
      }
      p.state = 'landed';
      Audio_.land();
      /* The original's three zones: left of the base, the base itself, and
       * right of it. Landing on the base is fatal at once. */
      if (Math.abs(p.x - GUN_X) < GUN_BASE_HALF) { die('base'); return; }
      if (p.x < GUN_X) { p.side = -1; game.left++; }
      else             { p.side = 1;  game.right++; }
      if (game.left >= LOSE_PER_SIDE) { startPyramid(-1); return; }
      if (game.right >= LOSE_PER_SIDE) { startPyramid(1); return; }
    }
  }

  // --- bullets and collisions -------------------------------------------
  for (const b of game.bullets) {
    b.px = b.x; b.py = b.y;
    b.x += b.vx; b.y += b.vy;
    if (b.x < -20 || b.x > W + 20 || b.y > H + 40 || b.y < 0) { b.dead = true; continue; }

    for (const h of game.helis) {
      if (!h.alive) continue;
      if (Math.abs(b.x - h.x) < 34 && Math.abs(b.y - h.y) < 17) {
        h.alive = false; b.dead = true;
        boom(h.x, sy(h.y), 28, 32, true);
        Audio_.hitAir();
        addScore(SCORE_HELI); game.kills++;
        break;
      }
    }
    if (b.dead) continue;

    for (const j of game.jets) {
      if (!j.alive) continue;
      if (Math.abs(b.x - j.x) < 38 && Math.abs(b.y - j.y) < 15) {
        j.alive = false; b.dead = true;
        boom(j.x, sy(j.y), 32, 38, true);
        Audio_.hitAir();
        addScore(SCORE_HELI); game.kills++;
        break;
      }
    }
    if (b.dead) continue;

    for (const bo of game.bombs) {
      if (bo.dead) continue;
      if (Math.abs(b.x - bo.x) < 15 && Math.abs(b.y - bo.y) < 15) {
        bo.dead = true; b.dead = true;
        boom(bo.x, sy(bo.y), 26, 44, true);
        Audio_.hitAir();
        addScore(SCORE_BOMB); game.kills++;
        break;
      }
    }
    if (b.dead) continue;

    for (const p of game.paras) {
      if (!p.alive || p.state === 'landed') continue;
      // the canopy: a wide, shallow target sitting above him
      if (p.state === 'canopy' &&
          Math.abs(b.x - p.x) < 26 && Math.abs(b.y - (p.y + 32)) < 12) {
        p.state = 'cut'; p.vy = -1.0; b.dead = true;
        boom(p.x, sy(p.y + 32), 8, 190, false);
        break;
      }
      // the man himself
      if (Math.abs(b.x - p.x) < 13 && Math.abs(b.y - p.y) < 17) {
        p.alive = false; b.dead = true;
        boom(p.x, sy(p.y), 14, 22, false);
        Audio_.hitAir();
        addScore(SCORE_PARA); game.kills++;
        break;
      }
    }
  }

  stepParticles();

  game.helis = game.helis.filter(h => h.alive);
  game.jets = game.jets.filter(j => j.alive);
  game.bombs = game.bombs.filter(b => !b.dead);
  game.bullets = game.bullets.filter(b => !b.dead);
  game.paras = game.paras.filter(p => p.alive);
}

function stepParticles() {
  for (const p of game.parts) {
    p.px = p.x; p.py = p.y;
    p.age++;
    if (p.kind === 'spark') {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.34;            // particles live in screen space, so y falls down
      p.vx *= 0.96; p.vy *= 0.99;
    } else if (p.kind === 'smoke') {
      p.x += p.vx; p.y += p.vy;
      p.vy -= 0.05;            // smoke rises
      p.vx *= 0.94; p.vy *= 0.94;
    }
  }
  game.parts = game.parts.filter(p => p.age < p.life);
}

/* Four on one side is already the loss. This sequence does not decide it, it
 * shows it: the men who landed run in, climb on each other and reach over the
 * sandbags. Shooting them now changes nothing -- the game was lost when the
 * fourth one touched the ground, and letting the player watch why is more
 * honest than the gun simply exploding. */
function startPyramid(side) {
  game.state = State.PYRAMID;
  game.pyrTimer = 0;
  const edge = GUN_X + side * (GUN_HALF_W - 4);
  const crew = game.paras
    .filter(p => p.alive && p.state === 'landed' && p.side === side)
    .sort((a, b) => Math.abs(a.x - GUN_X) - Math.abs(b.x - GUN_X))
    .slice(0, LOSE_PER_SIDE);
  crew.forEach((p, i) => {
    p.state = 'charge';
    p.order = i;
    p.tx = edge - side * i * 4;    // the stack leans slightly away from the gun
    p.ty = 8 + i * 18;
    p.step = 0;
  });
  game.pyrCrew = crew;
  Audio_.sweep(160, 420, 500, 0.45);
}

function updatePyramid() {
  game.pyrTimer++;
  let settled = true;

  for (const p of game.pyrCrew) {
    p.px = p.x; p.py = p.y;
    if (Math.abs(p.x - p.tx) > 4) {
      p.x += Math.sign(p.tx - p.x) * 7.5;
      p.step += 0.55;                      // drives the running animation
      settled = false;
    } else if (p.y < p.ty) {
      // Each man waits for the one below him to be in place before climbing.
      if (game.pyrTimer > 8 + p.order * 5) p.y = Math.min(p.ty, p.y + 4.2);
      settled = false;
    }
  }

  if (settled && game.pyrTimer > 20) { die('pyramid'); return; }
  stepParticles();
}

function die(cause) {
  game.state = State.DYING;
  game.dyingTimer = 26;
  boom(GUN_X, sy(30), 60, 30, true);
  boom(GUN_X - 26, sy(18), 20, 20, true);
  boom(GUN_X + 26, sy(18), 20, 40, true);
  game.shake = 20;
  Audio_.hitGround();
  setTimeout(() => Audio_.sweep(300, 40, 700, 0.8), 90);
  game.cause = cause;
}

// ---------------------------------------------------------------- drawing

const cv = document.getElementById('screen');
const ctx = cv.getContext('2d');

/* Backdrop pieces that never move are generated once. Recomputing a starfield
 * sixty times a second is the kind of waste the original could not have
 * afforded and we have no excuse for either. */
const stars = [];
for (let i = 0; i < 130; i++) {
  stars.push({ x: rndF() * W, y: rndF() * (GROUND_Y - 120),
               r: rndRange(0.4, 1.5), p: rndF() * TAU, s: rndRange(0.02, 0.06) });
}
const ridgeFar = makeRidge(120, 42, 7);
const ridgeNear = makeRidge(70, 60, 11);

function makeRidge(baseH, amp, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    pts.push({ x: (W / n) * i, y: baseH + Math.sin(i * 1.7) * amp * 0.5 + rndF() * amp });
  }
  return pts;
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0.00, '#070b1e');
  g.addColorStop(0.45, '#111a3e');
  g.addColorStop(0.78, '#28305c');
  g.addColorStop(1.00, '#4a3a5e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, GROUND_Y);

  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(game.tick * s.s + s.p);
    ctx.globalAlpha = tw * 0.9;
    ctx.fillStyle = '#dfe8ff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // moon, with a soft halo
  const mx = 812, my = 96;
  const halo = ctx.createRadialGradient(mx, my, 6, mx, my, 76);
  halo.addColorStop(0, 'rgba(226,236,255,0.30)');
  halo.addColorStop(1, 'rgba(226,236,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(mx, my, 76, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e8eeff';
  ctx.beginPath(); ctx.arc(mx, my, 26, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(150,165,205,0.5)';
  ctx.beginPath(); ctx.arc(mx - 8, my - 6, 5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 7, my + 5, 7, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 2, my - 13, 3.4, 0, TAU); ctx.fill();
}

function drawRidge(pts, color, yOff) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  for (const p of pts) ctx.lineTo(p.x, GROUND_Y - p.y - yOff);
  ctx.lineTo(W, GROUND_Y);
  ctx.closePath();
  ctx.fill();
}

function drawGround() {
  const g = ctx.createLinearGradient(0, GROUND_Y - 6, 0, H);
  g.addColorStop(0, '#2c4a2f');
  g.addColorStop(1, '#12200f');
  ctx.fillStyle = g;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.strokeStyle = 'rgba(150,220,150,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke();

  // the three zones, marked faintly — the rule made visible
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  ctx.fillRect(GUN_X - GUN_BASE_HALF, GROUND_Y, GUN_BASE_HALF * 2, H - GROUND_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (const x of [GUN_X - GUN_BASE_HALF, GUN_X + GUN_BASE_HALF]) {
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, H); ctx.stroke();
  }
}

function drawGun(a) {
  const bx = GUN_X, by = GROUND_Y;
  const recoil = game.muzzle > 0 ? 5 : 0;   // the barrel kicks back on firing

  // --- sandbag emplacement, three courses
  for (let row = 0; row < 3; row++) {
    const w = 46 - row * 7, yy = by - row * 9;
    const n = row === 2 ? 4 : 5;
    for (let i = 0; i < n; i++) {
      const cx = bx - w + (2 * w / (n - 1)) * i;
      const g = ctx.createLinearGradient(cx - 9, yy - 10, cx + 9, yy);
      g.addColorStop(0, row % 2 ? '#7a6b4e' : '#8a7a58');
      g.addColorStop(1, '#4a4130');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, yy - 5, 11, 6, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // --- barrel, drawn before the mantlet so the breech overlaps it
  ctx.save();
  ctx.translate(bx, by - 32);
  ctx.rotate(a);
  const bg = ctx.createLinearGradient(-6, 0, 6, 0);
  bg.addColorStop(0, '#20262e');
  bg.addColorStop(0.38, '#8b98a8');
  bg.addColorStop(0.62, '#5d6a78');
  bg.addColorStop(1, '#191d24');
  ctx.fillStyle = bg;
  ctx.fillRect(-5, -BARREL_LEN + recoil, 10, BARREL_LEN);
  // muzzle brake
  ctx.fillStyle = '#2b323b';
  ctx.fillRect(-7.5, -BARREL_LEN + recoil - 7, 15, 9);
  ctx.fillStyle = '#161a20';
  ctx.fillRect(-3, -BARREL_LEN + recoil - 8, 6, 4);

  if (game.muzzle > 0) {
    const f = game.muzzle / 2;
    const my = -BARREL_LEN + recoil - 10;
    ctx.globalAlpha = f;
    const fg = ctx.createRadialGradient(0, my, 1, 0, my, 30);
    fg.addColorStop(0, '#fffdf0');
    fg.addColorStop(0.32, 'rgba(255,205,90,0.9)');
    fg.addColorStop(1, 'rgba(255,110,0,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(0, my, 30, 0, TAU); ctx.fill();
    // star flash
    ctx.strokeStyle = `rgba(255,240,190,${f})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const ang = i * Math.PI / 4;
      ctx.moveTo(Math.cos(ang) * 6, my + Math.sin(ang) * 6);
      ctx.lineTo(Math.cos(ang) * 22, my + Math.sin(ang) * 22);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // --- mantlet and turret body
  const dg = ctx.createLinearGradient(bx - 20, by - 50, bx + 20, by - 24);
  dg.addColorStop(0, '#8d9aa8');
  dg.addColorStop(0.45, '#5a6675');
  dg.addColorStop(1, '#333c47');
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.moveTo(bx - 21, by - 24);
  ctx.quadraticCurveTo(bx - 19, by - 44, bx, by - 45);
  ctx.quadraticCurveTo(bx + 19, by - 44, bx + 21, by - 24);
  ctx.closePath(); ctx.fill();
  // rim light along the top, so it reads as metal rather than a blob
  ctx.strokeStyle = 'rgba(210,225,245,0.55)'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(bx - 18, by - 32);
  ctx.quadraticCurveTo(bx - 16, by - 43, bx, by - 44);
  ctx.stroke();
  // trunnion
  ctx.fillStyle = '#242b34';
  ctx.beginPath(); ctx.arc(bx, by - 32, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#69768a';
  ctx.beginPath(); ctx.arc(bx - 1.5, by - 33.5, 3, 0, TAU); ctx.fill();
}

function drawHeli(h, t) {
  const x = lerp(h.px, h.x, t), y = sy(lerp(h.py, h.y, t));
  const d = h.dir;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(d, 1);

  // --- tail boom, tapering
  ctx.fillStyle = '#3c5540';
  ctx.beginPath();
  ctx.moveTo(-10, -5); ctx.lineTo(-45, -2.6);
  ctx.lineTo(-45, 2.6); ctx.lineTo(-10, 7);
  ctx.closePath(); ctx.fill();

  // --- tail fin and stabiliser
  ctx.fillStyle = '#32462d';
  ctx.beginPath();
  ctx.moveTo(-39, -2); ctx.lineTo(-52, -17);
  ctx.lineTo(-45, -17); ctx.lineTo(-35, -2);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(-42, 0.5, 14, 2.6);

  // --- tail rotor, edge-on
  const ts = Math.abs(Math.sin(h.rotor * 1.7));
  ctx.strokeStyle = 'rgba(228,238,250,0.8)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-48, -12 - 7 * ts); ctx.lineTo(-48, -12 + 7 * ts);
  ctx.stroke();

  // --- fuselage: a nose-heavy teardrop, not a plain ellipse
  const bg = ctx.createLinearGradient(0, -12, 0, 13);
  bg.addColorStop(0, '#89a97c');
  bg.addColorStop(0.42, '#5b7d4f');
  bg.addColorStop(1, '#2b3d27');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(30, 1);
  ctx.quadraticCurveTo(29, -9, 16, -11);      // nose to canopy top
  ctx.lineTo(-4, -11);
  ctx.quadraticCurveTo(-16, -10, -14, -4);    // shoulder into the boom
  ctx.lineTo(-14, 5);
  ctx.quadraticCurveTo(-10, 11, 4, 11);       // belly
  ctx.quadraticCurveTo(24, 11, 30, 1);
  ctx.closePath(); ctx.fill();

  // --- canopy: front-mounted, not a blob in the middle
  const cg = ctx.createLinearGradient(16, -10, 26, 2);
  cg.addColorStop(0, 'rgba(205,238,255,0.95)');
  cg.addColorStop(1, 'rgba(70,120,165,0.75)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.quadraticCurveTo(26, -8, 16, -9);
  ctx.lineTo(11, -9);
  ctx.lineTo(11, 2);
  ctx.quadraticCurveTo(22, 3, 28, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(20,40,55,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(11, -9); ctx.lineTo(11, 2); ctx.stroke();

  // --- door outline, so the body reads as a machine
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
  ctx.strokeRect(-6, -7, 13, 15);

  // --- skids
  ctx.strokeStyle = '#26331f'; ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-14, 18); ctx.lineTo(20, 18);
  ctx.moveTo(-6, 10); ctx.lineTo(-9, 18);
  ctx.moveTo(12, 10); ctx.lineTo(15, 18);
  ctx.stroke();

  // --- main rotor
  // Drawn as a faint swept band plus one bright blade whose apparent length
  // shortens as it turns. A stroked ellipse -- the obvious first attempt --
  // draws a closed ring and reads as a flying saucer.
  ctx.fillStyle = '#78868d';
  ctx.fillRect(-2, -21, 4, 9);
  ctx.globalAlpha = 0.20;
  ctx.fillStyle = '#e2ecf5';
  ctx.beginPath(); ctx.ellipse(0, -21, 48, 2.4, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  const k = Math.cos(h.rotor), s = Math.sin(h.rotor) * 1.8;
  ctx.strokeStyle = 'rgba(238,246,255,0.9)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-48 * k, -21 - s);
  ctx.lineTo(48 * k, -21 + s);
  ctx.stroke();
  ctx.fillStyle = '#aab8c0';
  ctx.beginPath(); ctx.arc(0, -21, 3, 0, TAU); ctx.fill();

  ctx.restore();

  // navigation light, on the tail
  if ((h.blink >> 2) & 1) {
    ctx.fillStyle = '#ff4d4d';
    ctx.shadowColor = '#ff2d2d'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(x - d * 47, y - 18, 2.6, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawJet(j, t) {
  const x = lerp(j.px, j.x, t), y = sy(lerp(j.py, j.y, t));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(j.dir, 1);

  // afterburner
  const f = 14 + Math.sin(j.flame * 1.7) * 6;
  const fg = ctx.createLinearGradient(-26, 0, -26 - f, 0);
  fg.addColorStop(0, 'rgba(255,240,180,0.95)');
  fg.addColorStop(0.4, 'rgba(255,150,40,0.75)');
  fg.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-24, -4); ctx.lineTo(-24 - f, 0); ctx.lineTo(-24, 4);
  ctx.closePath(); ctx.fill();

  // wings
  ctx.fillStyle = '#4b5568';
  ctx.beginPath();
  ctx.moveTo(2, 0); ctx.lineTo(-18, 15); ctx.lineTo(-4, 2);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, 0); ctx.lineTo(-18, -15); ctx.lineTo(-4, -2);
  ctx.closePath(); ctx.fill();
  // tail fin
  ctx.beginPath();
  ctx.moveTo(-18, -2); ctx.lineTo(-26, -14); ctx.lineTo(-16, -2);
  ctx.closePath(); ctx.fill();

  // fuselage
  const bg = ctx.createLinearGradient(0, -7, 0, 7);
  bg.addColorStop(0, '#9aa6ba');
  bg.addColorStop(0.5, '#68748a');
  bg.addColorStop(1, '#3c4455');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(34, 0);
  ctx.quadraticCurveTo(10, -8, -24, -5);
  ctx.lineTo(-24, 5);
  ctx.quadraticCurveTo(10, 8, 34, 0);
  ctx.closePath(); ctx.fill();

  // canopy
  ctx.fillStyle = 'rgba(180,225,255,0.85)';
  ctx.beginPath(); ctx.ellipse(14, -3, 8, 4, 0, 0, TAU); ctx.fill();

  ctx.restore();
}

function drawPara(p, t) {
  const x = lerp(p.px, p.x, t), y = sy(lerp(p.py, p.y, t));

  if (p.state === 'canopy') {
    const tilt = Math.sin(p.sway) * 0.16;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    // cords
    ctx.strokeStyle = 'rgba(235,235,245,0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-22, -26); ctx.lineTo(-4, -8);
    ctx.moveTo(22, -26); ctx.lineTo(4, -8);
    ctx.moveTo(-9, -30); ctx.lineTo(-2, -8);
    ctx.moveTo(9, -30); ctx.lineTo(2, -8);
    ctx.stroke();

    // canopy, in alternating panels
    const panels = ['#e94f4f', '#f6f6f8', '#e94f4f', '#f6f6f8', '#e94f4f'];
    for (let i = 0; i < 5; i++) {
      const a0 = Math.PI + (i / 5) * Math.PI;
      const a1 = Math.PI + ((i + 1) / 5) * Math.PI;
      ctx.fillStyle = panels[i];
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.arc(0, -26, 27, a0, a1);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -26, 27, Math.PI, TAU); ctx.stroke();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.ellipse(-9, -37, 8, 4, -0.4, 0, TAU); ctx.fill();

    drawTrooperBody(0, 0, 0);
    ctx.restore();
  } else {
    // free fall — tumbling
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.state === 'cut' ? game.tick * 0.55 : Math.sin(game.tick * 0.3) * 0.35);
    drawTrooperBody(0, 0, 1);
    ctx.restore();
    if (p.state === 'cut') {
      ctx.strokeStyle = 'rgba(240,240,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 12); ctx.lineTo(x - 12, y - 26);
      ctx.moveTo(x + 6, y - 12); ctx.lineTo(x + 13, y - 24);
      ctx.stroke();
    }
  }
}

function drawTrooperBody(x, y, flail, gait) {
  const sw = gait || 0;          // limb swing, for the run
  ctx.save();
  ctx.translate(x, y);
  // legs
  ctx.strokeStyle = '#2f3a4a'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-1.5, 5); ctx.lineTo(flail ? -7 : -4 + sw, 14);
  ctx.moveTo(1.5, 5); ctx.lineTo(flail ? 7 : 4 - sw, 14);
  ctx.stroke();
  // arms
  ctx.strokeStyle = '#46566b'; ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-2, -3); ctx.lineTo(flail ? -10 : -7 - sw, flail ? -9 : -8);
  ctx.moveTo(2, -3); ctx.lineTo(flail ? 10 : 7 - sw, flail ? -9 : -8);
  ctx.stroke();
  // torso
  const g = ctx.createLinearGradient(-5, -6, 5, 8);
  g.addColorStop(0, '#5d7a52');
  g.addColorStop(1, '#39492f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-5, -6, 10, 12, 3) : ctx.rect(-5, -6, 10, 12);
  ctx.fill();
  // helmet
  ctx.fillStyle = '#3f4f38';
  ctx.beginPath(); ctx.arc(0, -9, 4.6, Math.PI, TAU); ctx.fill();
  ctx.fillStyle = '#d9b48a';
  ctx.beginPath(); ctx.arc(0, -8, 3.4, 0, Math.PI); ctx.fill();
  ctx.restore();
}

/* Troopers on the ground. Once they charge they have a height of their own,
 * so this cannot assume they are standing on the ground line any more. */
function drawLanded(p, t) {
  const x = lerp(p.px !== undefined ? p.px : p.x, p.x, t);
  const y = sy(lerp(p.py !== undefined ? p.py : p.y, p.y, t));
  const running = p.state === 'charge' && Math.abs(p.x - p.tx) > 3;
  ctx.save();
  ctx.translate(x, y);
  if (running) {
    // lean into the run, and swing the legs
    ctx.rotate(Math.sign(p.tx - p.x) * 0.18);
    drawTrooperBody(0, 0, 0, Math.sin(p.step) * 5);
  } else {
    drawTrooperBody(0, 0, 0, 0);
  }
  ctx.restore();
}

function drawBomb(b, t) {
  const x = lerp(b.px, b.x, t), y = sy(lerp(b.py, b.y, t));
  ctx.save();
  ctx.translate(x, y);
  // trail
  const tg = ctx.createLinearGradient(0, -8, 0, -46);
  tg.addColorStop(0, 'rgba(255,180,90,0.55)');
  tg.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = tg;
  ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(0, -46); ctx.lineTo(4, -6);
  ctx.closePath(); ctx.fill();

  const g = ctx.createLinearGradient(-5, 0, 5, 0);
  g.addColorStop(0, '#3a3a44');
  g.addColorStop(0.5, '#8b8f9c');
  g.addColorStop(1, '#2e2e38');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 11);
  ctx.quadraticCurveTo(6, 2, 5, -6);
  ctx.lineTo(-5, -6);
  ctx.quadraticCurveTo(-6, 2, 0, 11);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c0c6d2';
  ctx.beginPath();
  ctx.moveTo(-5, -6); ctx.lineTo(-8, -12); ctx.lineTo(0, -8);
  ctx.lineTo(8, -12); ctx.lineTo(5, -6);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBullet(b, t) {
  const x = lerp(b.px, b.x, t), y = sy(lerp(b.py, b.y, t));
  /* The tracer trails behind the bullet. Screen y runs the other way from
   * game y, so the trail is +vy on screen for a bullet travelling +vy in the
   * game's upward-counting world. */
  ctx.strokeStyle = 'rgba(255,225,120,0.55)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x - b.vx * 1.7, y + b.vy * 1.7);
  ctx.stroke();
  ctx.fillStyle = '#fff6c8';
  ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
}

function drawParticle(p, t) {
  const x = lerp(p.px, p.x, t), y = lerp(p.py, p.y, t);
  const u = p.age / p.life;              // 0 at birth, 1 at death
  const k = 1 - u;

  if (p.kind === 'flash') {
    const r = p.size * (0.5 + u * 0.7);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,240,${k})`);
    g.addColorStop(0.35, `rgba(255,214,140,${k * 0.75})`);
    g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    return;
  }

  if (p.kind === 'ring') {
    // Fast out, thin as it goes -- a shockwave, not a drawn circle.
    const e = 1 - Math.pow(k, 2.2);
    ctx.strokeStyle = `hsla(${p.hue},100%,80%,${k * 0.7})`;
    ctx.lineWidth = 1 + k * 5;
    ctx.beginPath(); ctx.arc(x, y, 6 + p.size * e, 0, TAU); ctx.stroke();
    return;
  }

  if (p.kind === 'smoke') {
    const r = p.size * (0.5 + u * 1.5);
    const a = k * 0.30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(90,88,96,${a})`);
    g.addColorStop(1, 'rgba(60,58,66,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    return;
  }

  // spark: a short streak along its own velocity, brightest when young
  const sp = Math.hypot(p.vx, p.vy);
  const L = clamp(sp * 1.5, 2, 14) * k;
  ctx.strokeStyle = `hsla(${p.hue},100%,${52 + k * 38}%,${k})`;
  ctx.lineWidth = Math.max(1, p.size * k);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - (p.vx / (sp || 1)) * L, y - (p.vy / (sp || 1)) * L);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawHUD() {
  ctx.font = '600 21px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'top';

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('SCORE', 22, 16);
  ctx.fillText('HI-SCORE', 210, 16);
  ctx.fillText('WAVE', 420, 16);

  ctx.font = '700 30px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(String(game.score).padStart(6, ' '), 22, 36);
  ctx.fillStyle = '#b9d6ff';
  ctx.fillText(String(game.hiScore).padStart(6, ' '), 210, 36);
  ctx.fillStyle = '#ffd0d0';
  ctx.fillText(String(game.wave), 420, 36);

  ctx.font = '500 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.textAlign = 'right';
  ctx.fillText('shots ' + game.shots + '   accuracy ' +
    (game.shots ? Math.round(100 * game.kills / game.shots) : 0) + '%', W - 22, 22);
  ctx.textAlign = 'left';

  /* The four-per-side rule, shown where it happens rather than in a corner.
   * Putting the counters over the ground they refer to means a glance tells
   * you which side is about to kill you -- which is the decision the rule
   * actually asks the player to make. */
  drawPips(GUN_X - GUN_BASE_HALF - 34, -1, game.left);
  drawPips(GUN_X + GUN_BASE_HALF + 34, 1, game.right);
}

function drawPips(x, dir, n) {
  const y = GROUND_Y + 32;
  for (let i = 0; i < LOSE_PER_SIDE; i++) {
    const cx = x + dir * i * 21;
    ctx.beginPath();
    ctx.arc(cx, y, 7, 0, TAU);
    ctx.fillStyle = i < n
      ? (n >= LOSE_PER_SIDE - 1 ? '#ff5a5a' : '#ffb35a')
      : 'rgba(255,255,255,0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = 1.3; ctx.stroke();
  }
  if (n >= LOSE_PER_SIDE - 1) {
    ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ff8080';
    ctx.textAlign = dir < 0 ? 'right' : 'left';
    ctx.fillText('ONE MORE', x + dir * 84, y - 8);
    ctx.textAlign = 'left';
  }
}

function drawOverlayTitle() {
  ctx.fillStyle = 'rgba(4,6,18,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  ctx.font = '800 78px "Segoe UI", system-ui, sans-serif';
  const g = ctx.createLinearGradient(0, 130, 0, 215);
  g.addColorStop(0, '#ffe9a8');
  g.addColorStop(1, '#ff9d3f');
  ctx.fillStyle = g;
  ctx.fillText('PARATROOPER', W / 2, 132);

  ctx.font = '500 19px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillText('originally by Greg Kuperberg · © 1982 Orion Software, Inc.', W / 2, 226);
  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.fillText('a browser port — original rules, timing and melody; new artwork', W / 2, 254);

  ctx.font = '600 24px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#9fe6ff';
  ctx.fillText('press SPACE to play', W / 2, 330);

  ctx.font = '500 17px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('← →  or  A D   rotate the gun          SPACE   fire', W / 2, 388);
  ctx.fillText('C  toggle 1982 controls (a key starts the swing, another stops it and fires)', W / 2, 416);
  ctx.fillText('M  mute', W / 2, 444);

  ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = game.classicControls ? '#ffb35a' : 'rgba(255,255,255,0.3)';
  ctx.fillText(game.classicControls ? '1982 CONTROLS: ON' : '1982 controls: off', W / 2, 486);

  ctx.font = '500 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.fillText('shoot the parachute, not the man — he falls, and takes others with him',
               W / 2, 524);
  ctx.textAlign = 'left';
}

function drawOverlayOver() {
  ctx.fillStyle = 'rgba(10,2,4,0.74)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  ctx.font = '800 62px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ff6b6b';
  ctx.fillText('GUN DESTROYED', W / 2, 150);

  ctx.font = '500 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  const why = game.cause === 'bomb' ? 'a bomb reached your base'
            : game.cause === 'base' ? 'a paratrooper landed on the gun itself'
            : 'four paratroopers massed on one side';
  ctx.fillText(why, W / 2, 232);

  ctx.font = '700 40px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('score  ' + game.score, W / 2, 296);
  ctx.font = '500 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('wave ' + game.wave + '   ·   ' + game.shots + ' shots   ·   ' +
    (game.shots ? Math.round(100 * game.kills / game.shots) : 0) + '% accuracy',
    W / 2, 352);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('every shell you fire costs a point — that was the 1982 design', W / 2, 384);

  ctx.font = '600 24px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#9fe6ff';
  ctx.fillText('press SPACE to try again', W / 2, 450);
  ctx.textAlign = 'left';
}

function render(t) {
  ctx.save();
  if (game.shake > 0.4) {
    ctx.translate((rndF() - 0.5) * game.shake, (rndF() - 0.5) * game.shake);
  }

  drawSky();
  drawRidge(ridgeFar, '#131a30', 0);
  drawRidge(ridgeNear, '#0d1322', 0);
  drawGround();

  const onGround = p => p.alive && (p.state === 'landed' || p.state === 'charge');
  // climbers are drawn after the gun so they appear to be on top of it
  for (const p of game.paras) if (onGround(p) && p.y <= 10) drawLanded(p, t);
  for (const h of game.helis) drawHeli(h, t);
  for (const j of game.jets) drawJet(j, t);
  for (const p of game.paras) if (!onGround(p)) drawPara(p, t);
  for (const b of game.bombs) drawBomb(b, t);
  if (game.state !== State.DYING) drawGun(lerp(game.gunPrev, game.gunAngle, t));
  for (const p of game.paras) if (onGround(p) && p.y > 10) drawLanded(p, t);
  for (const b of game.bullets) drawBullet(b, t);
  for (const p of game.parts) drawParticle(p, t);

  ctx.restore();

  if (game.flash > 0.01) {
    ctx.fillStyle = `rgba(255,220,160,${game.flash * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }

  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  if (game.state === State.PLAYING || game.state === State.PYRAMID ||
      game.state === State.DYING) drawHUD();
  if (game.state === State.TITLE) drawOverlayTitle();
  if (game.state === State.OVER) drawOverlayOver();
}

// ---------------------------------------------------------------- main loop

/* Logic runs at exactly 18.2 Hz, the rate the original's BIOS tick gave it.
 * Rendering runs as fast as the display, interpolating between the last two
 * logic states -- so the simulation is the 1982 one and the motion is smooth.
 * Driving the logic from the frame rate instead would make the game run at
 * 144 Hz on a 144 Hz monitor, which is the exact bug the original avoided. */
let acc = 0, last = performance.now();

function frame(now) {
  let dt = now - last;
  last = now;
  if (dt > 250) dt = 250;          // a backgrounded tab must not fast-forward
  acc += dt;

  let guard = 0;
  while (acc >= TICK_MS && guard++ < 8) {
    handleMeta();
    update();
    /* Edge-triggered keys last exactly one tick. Without this, a press nobody
     * consumed stays pending and fires later, in a state that never asked for
     * it -- pressing C on the title screen would then also fire the gun. */
    for (const k in Pressed) Pressed[k] = false;
    acc -= TICK_MS;
  }
  render(clamp(acc / TICK_MS, 0, 1));
  requestAnimationFrame(frame);
}

function handleMeta() {
  if (takePress('KeyM')) {
    Audio_.enabled = !Audio_.enabled;
    if (!Audio_.enabled) Audio_.stopMelody();
    else if (game.state === State.TITLE || game.state === State.OVER) Audio_.startMelody();
  }
  if (game.state === State.TITLE || game.state === State.OVER) {
    if (takePress('KeyC')) game.classicControls = !game.classicControls;
    if (takePress('Space')) {
      Audio_.stopMelody();
      resetGame();
      game.state = State.PLAYING;
    }
  }
}

/* Run `selfTest()` in the console. Checks the three things that broke while
 * this port was being written, each of which was invisible on screen:
 *
 *   1. the generator matches the original's sequence exactly
 *   2. rndInt is not reading the LCG's low bits, which are a counter
 *   3. a game left alone always ends -- it stalled forever before the fix
 */
window.selfTest = function selfTest() {
  const out = [];
  const save = seed;

  seed = 1;
  const vec = [rnd(), rnd(), rnd(), rnd(), rnd(), rnd()].join(',');
  out.push({ test: 'RNG matches the 1982 sequence',
             pass: vec === '56394,52243,3932,58917,36974,20023', got: vec });

  seed = 12345;
  const hist = [0, 0, 0, 0];
  for (let i = 0; i < 4000; i++) hist[rndInt(4)]++;
  const flat = hist.every(h => h > 800 && h < 1200);
  out.push({ test: 'rndInt(4) is uniform, not a counter', pass: flat, got: hist });

  const games = [], causes = {};
  for (let s = 1; s <= 10; s++) {
    resetGame(s * 4099); game.state = State.PLAYING;
    let t = 0;
    // run all the way to the game-over screen, through the pyramid sequence
    while (game.state !== State.OVER && t < 12000) { update(); t++; }
    games.push(+(t / 18.2).toFixed(1));
    causes[game.cause] = (causes[game.cause] || 0) + 1;
  }
  const allEnd = games.every(s => s < 600);
  out.push({ test: 'an unattended game always reaches game over',
             pass: allEnd, got: games });
  out.push({ test: 'and it ends for a stated reason',
             pass: !causes['null'] && !causes[undefined], got: causes });

  seed = save;
  resetGame(); game.state = State.TITLE;
  console.table(out);
  return out.every(r => r.pass) ? 'ALL PASS' : 'FAILURES ABOVE';
};

// kick off
Audio_.init();
document.getElementById('start-hint').addEventListener('click', () => {
  Audio_.init();
  if (Audio_.ctx && Audio_.ctx.state === 'suspended') Audio_.ctx.resume();
  if (game.state === State.TITLE) Audio_.startMelody();
});
requestAnimationFrame(frame);
