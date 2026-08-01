// Karateka — Web
// Uses NES-derived sprite atlas rendered in greyscale over the actual
// greyscaled DOS-port backgrounds (Akuma castle, gate hall, princess cell).
//
// Assets:
//   assets/atlas.png + atlas.json   built by tools/build_nes_atlas.py
//   assets/bg_outdoor.png           Akuma castle silhouette (OUTDOOR + AKUMA)
//   assets/bg_indoor.png            Gate hall with two pillars (GATE)
//   assets/bg_princess.png          Mariko's cell (MARIKO)

(() => {
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;

// scale display 3x via CSS, keep the backing buffer at native res
canvas.style.width  = (W * 3) + 'px';
canvas.style.height = (H * 3) + 'px';

const GROUND_Y = H - 22;          // y of ground line characters stand on

// ---------- Asset loading ----------
function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}
function loadJSON(src) {
  return fetch(src).then(r => r.json());
}

// ---------- Input ----------
// `keys` is current held state. `keyEdges` is set on keydown and consumed
// once per frame for rising-edge events (mode toggle, single-shot attack).
const keys = {};
const keyEdges = {};
addEventListener('keydown', e => {
  if (!keys[e.code]) keyEdges[e.code] = true;
  keys[e.code] = true;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyZ','KeyX','Enter'].includes(e.code)) {
    e.preventDefault();
  }
});
addEventListener('keyup',   e => { keys[e.code] = false; });
function consumeEdge(code) {
  if (keyEdges[code]) { keyEdges[code] = false; return true; }
  return false;
}

// ---------- Sprite atlas helpers ----------
let atlas;       // greyscaled atlas Image (offscreen canvas)
let sheet;       // atlas.json

function greyscaleAtlas(srcImg) {
  // Convert atlas to greyscale once, preserving alpha. Per-pixel walk keeps
  // the result identical across browsers (canvas filter has subtle differences).
  const off = document.createElement('canvas');
  off.width = srcImg.width;
  off.height = srcImg.height;
  const c = off.getContext('2d');
  c.drawImage(srcImg, 0, 0);
  const id = c.getImageData(0, 0, off.width, off.height);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    // luminance — but boost contrast so figures stay dark on light bg
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // remap to [40, 200] so sprites stay readable against the light bg
    const v = Math.round(40 + (y / 255) * 130);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  c.putImageData(id, 0, 0);
  return off;
}

function drawFrame(name, dx, dy, flipX = false) {
  const r = sheet.frames[name];
  if (!r) return;
  const [sx, sy, sw, sh] = r;
  if (flipX) {
    ctx.save();
    ctx.translate(dx + sw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(atlas, sx, sy, sw, sh, 0, 0, sw, sh);
    ctx.restore();
  } else {
    ctx.drawImage(atlas, sx, sy, sw, sh, dx, dy, sw, sh);
  }
}

function frameSize(name) {
  const r = sheet.frames[name];
  if (!r) return [0, 0];
  return [r[2], r[3]];
}

// ---------- Actor ----------
class Actor {
  constructor(kind, x, facing = 1) {
    this.kind  = kind;        // "hero" | "enemy" | "akuma" | "mariko"
    this.x = x;
    this.y = GROUND_Y;
    this.facing = facing;
    // mode: 'travel' (running, no attacks) | 'fight' (stance, can attack)
    // Mariko stays in a single standing pose so mode is irrelevant for her.
    this.mode  = (kind === 'mariko') ? 'travel' : 'travel';
    this.state = (kind === 'mariko') ? 'stance' : 'idle';
    this.frame = 0;
    this.tick  = 0;
    this.hp = (kind === 'akuma') ? 6 : (kind === 'enemy' ? 3 : 5);
    this.maxHp = this.hp;
    this.aiCooldown = 1.2;
    this.attackTimer = 0;
    this.hitThisAttack = false;
    this.dead = false;
    this.hitFlash = 0;
  }

  animName() {
    return `${this.kind}.${this.state}`;
  }

  currentFrameName() {
    let list = sheet.anims[this.animName()];
    if (!list || list.length === 0) {
      // Akuma has no idle/run in the atlas — fall through to walk, then stance.
      const fallbacks = {
        idle:   ['run', 'walk', 'stance'],
        run:    ['walk', 'stance'],
        walk:   ['run', 'stance'],
        stance: ['idle', 'walk'],
      };
      const chain = fallbacks[this.state] || ['stance'];
      for (const alt of chain) {
        list = sheet.anims[`${this.kind}.${alt}`];
        if (list && list.length > 0) break;
      }
    }
    if (!list || list.length === 0) return null;
    return list[this.frame % list.length];
  }

  width() {
    const fn = this.currentFrameName();
    if (!fn) return 12;
    return frameSize(fn)[0];
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.frame = 0;
    this.tick = 0;
  }

  update(dt) {
    if (this.dead && this.state === 'fall') {
      // still play out the fall animation, then freeze on last frame
      const list = sheet.anims[this.animName()];
      this.tick += dt;
      const fd = 0.18;
      while (this.tick > fd && this.frame < list.length - 1) {
        this.tick -= fd;
        this.frame++;
      }
      return;
    }
    this.tick += dt;
    const frameDuration = (this.state === 'walk') ? 0.10 :
                          (this.state === 'run') ? 0.07 :
                          (this.state === 'fall') ? 0.18 :
                          (this.state === 'stance') ? 0.45 :   // slow breathing animation
                          (this.state === 'punch' || this.state === 'kick') ? 0.07 : 0.25;
    while (this.tick > frameDuration) {
      this.tick -= frameDuration;
      this.frame++;
    }

    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackTimer = 0;
        if (this.state === 'punch' || this.state === 'kick') {
          this.setState('stance');
        }
        this.hitThisAttack = false;
      }
    }
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      if (this.hitFlash < 0) this.hitFlash = 0;
    }
  }

  isAttacking() {
    return this.attackTimer > 0 && (this.state === 'punch' || this.state === 'kick');
  }

  attack(kind) {
    if (this.attackTimer > 0 || this.state === 'fall') return;
    // Attacks force fight mode — you cannot punch while running.
    this.mode = 'fight';
    this.setState(kind);
    this.attackTimer = 0.38;
    this.hitThisAttack = false;
  }

  takeHit() {
    if (this.dead) return;
    this.hp--;
    this.hitFlash = 0.12;
    if (this.hp <= 0) {
      this.setState('fall');
      this.attackTimer = 0;
      this.dead = true;
    } else {
      // Getting hit snaps you out of running into a defensive stance.
      this.mode = 'fight';
      this.attackTimer = 0.22;
      this.setState('stance');
    }
  }

  enterFightMode() {
    if (this.mode === 'fight' || this.dead) return;
    this.mode = 'fight';
    this.setState('stance');
  }

  enterTravelMode() {
    if (this.mode === 'travel' || this.dead) return;
    if (this.attackTimer > 0) return;        // can't exit mid-attack
    this.mode = 'travel';
    this.setState('idle');
  }

  draw() {
    const fn = this.currentFrameName();
    if (!fn) return;
    const [w, h] = frameSize(fn);
    // small horizontal jitter while hitFlash is active — visible "ouch" reaction
    const jx = this.hitFlash > 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
    const dx = Math.round(this.x - w / 2) + jx;
    const dy = Math.round(this.y - h);
    drawFrame(fn, dx, dy, this.facing < 0);
  }
}

// ---------- Scenes (procedural) ----------
const SCENES = [
  { name: 'OUTDOOR',  length: 720, enemies: [{ kind: 'enemy', x: 260 }, { kind: 'enemy', x: 520 }] },
  { name: 'GATE',     length: 720, enemies: [{ kind: 'enemy', x: 220 }, { kind: 'enemy', x: 460 }, { kind: 'enemy', x: 640 }] },
  { name: 'AKUMA',    length: 520, enemies: [{ kind: 'akuma', x: 380 }] },
  { name: 'MARIKO',   length: 320, enemies: [], end: 'mariko' },
];

// ---------- Backgrounds ----------
// Greyscaled DOS-port backgrounds + a procedurally-generated Mt Fuji.
//
// Title screen → bg_outdoor (Akuma castle silhouette under moon).
// In-game OUTDOOR → bg_fuji (snow-capped Fuji + moon, no castle).
// In-game GATE / AKUMA → bg_indoor, TILED so the player traverses room → room.
// In-game MARIKO → bg_princess (the cell, single static room).
//
// `scroll: true` means the bg tiles horizontally and scrolls 1:1 with the
// camera. The outdoor Fuji stays static — it's a distant landmark, not a
// per-room backdrop.
const BG_FOR_SCENE = {
  OUTDOOR: { file: 'bg_fuji.png',    scroll: false },
  GATE:    { file: 'bg_indoor.png',  scroll: true  },
  AKUMA:   { file: 'bg_indoor.png',  scroll: true  },
  MARIKO:  { file: 'bg_princess.png', scroll: false },
};
const TITLE_BG_FILE = 'bg_outdoor.png';
const bgImages = {};   // file -> HTMLImageElement

function buildGroundTicks() {
  // A scrolling foreground stripe of ground ticks so movement reads visually
  // even when the bg image itself is static (OUTDOOR / MARIKO scenes).
  const tw = 280;
  const c = document.createElement('canvas');
  c.width = tw;
  c.height = 12;
  const g = c.getContext('2d');
  g.fillStyle = '#888';
  for (let x = 4; x < tw; x += 11) g.fillRect(x, 2, 5, 1);
  for (let x = 9; x < tw; x += 17) g.fillRect(x, 6, 3, 1);
  for (let x = 0; x < tw; x += 23) g.fillRect(x, 10, 7, 1);
  return c;
}
let groundTicks = null;

// ---------- Game ----------
class Game {
  constructor() {
    this.sceneIdx = 0;
    this.scene = null;
    this.cameraX = 0;
    this.hero = null;
    this.actors = [];
    this.mariko = null;
    this.state = 'title';
    this.winTimer = 0;
  }

  startScene(idx) {
    if (idx >= SCENES.length) {
      this.state = 'win';
      this.winTimer = 0;
      return;
    }
    this.sceneIdx = idx;
    this.scene = SCENES[idx];
    this.cameraX = 0;
    if (!this.hero) {
      this.hero = new Actor('hero', 40, 1);
    } else {
      this.hero.x = 40;
      this.hero.setState('stance');
    }
    this.actors = [this.hero];
    for (const e of this.scene.enemies) {
      this.actors.push(new Actor(e.kind, e.x, -1));
    }
    if (this.scene.end === 'mariko') {
      this.mariko = new Actor('mariko', 240, -1);
      this.actors.push(this.mariko);
    } else {
      this.mariko = null;
    }
  }

  updateHero(dt) {
    const h = this.hero;
    if (h.dead) return;

    // SPACE toggles between running and fighting stance.
    if (consumeEdge('Space')) {
      if (h.mode === 'travel') h.enterFightMode();
      else h.enterTravelMode();
    }

    // Attacks only available in fight mode. Z/X auto-enter fight mode if you
    // press them while running (matches original Karateka — pressing attack
    // immediately drops you into stance).
    if (h.attackTimer === 0) {
      if (keys['KeyZ']) { h.attack('punch'); }
      else if (keys['KeyX']) { h.attack('kick'); }
    }

    if (h.attackTimer === 0 && !h.dead) {
      if (h.mode === 'travel') {
        // Free running. Always uses run animation when moving.
        const speed = 90;
        if (keys['ArrowRight']) {
          h.x += speed * dt;
          h.facing = 1;
          h.setState('run');
        } else if (keys['ArrowLeft']) {
          h.x -= speed * dt;
          h.facing = -1;
          h.setState('run');
        } else if (h.state === 'run' || h.state === 'walk') {
          h.setState('idle');
        }
      } else {
        // Fight mode: slow edge-step in stance, no run cycle.
        const speed = 28;
        if (keys['ArrowRight']) {
          h.x += speed * dt;
          h.facing = 1;
          h.setState('stance');
        } else if (keys['ArrowLeft']) {
          h.x -= speed * dt;
          h.facing = -1;
          h.setState('stance');
        } else if (h.state !== 'stance') {
          h.setState('stance');
        }
      }
      if (h.x < 20) h.x = 20;
      if (h.x > this.scene.length - 20) h.x = this.scene.length - 20;
    }

    if (h.isAttacking() && !h.hitThisAttack) {
      const reach = 24;
      const ax = h.x + h.facing * reach;
      for (const a of this.actors) {
        if (a === h || a.dead || a === this.mariko) continue;
        if (Math.abs(a.x - ax) < 14) {
          a.takeHit();
          h.hitThisAttack = true;
          break;
        }
      }
    }
  }

  updateEnemy(e, dt) {
    if (e.dead || e === this.mariko) return;
    const h = this.hero;
    if (h.dead) return;
    const dx = h.x - e.x;
    const dist = Math.abs(dx);
    e.facing = dx < 0 ? -1 : 1;

    const FIGHT_RANGE = 60;     // engage stance when hero this close

    e.aiCooldown -= dt;
    if (e.attackTimer === 0) {
      if (dist > FIGHT_RANGE) {
        // Far away: travel mode, run toward hero.
        e.mode = 'travel';
        const speed = (e.kind === 'akuma') ? 36 : 30;
        e.x += Math.sign(dx) * speed * dt;
        e.setState('run');
      } else if (dist > 30) {
        // In engagement range: enter fight mode, edge-step closer.
        e.mode = 'fight';
        const speed = 22;
        e.x += Math.sign(dx) * speed * dt;
        e.setState('stance');
      } else {
        // Right next to hero: stance + attack on cooldown.
        e.mode = 'fight';
        e.setState('stance');
        if (e.aiCooldown <= 0) {
          e.attack(Math.random() < 0.5 ? 'punch' : 'kick');
          e.aiCooldown = (e.kind === 'akuma') ? 0.85 : 1.4;
        }
      }
    }

    if (e.isAttacking() && !e.hitThisAttack) {
      const reach = 24;
      const ax = e.x + e.facing * reach;
      if (Math.abs(h.x - ax) < 14 && !h.dead) {
        h.takeHit();
        e.hitThisAttack = true;
      }
    }
  }

  update(dt) {
    if (this.state === 'title') {
      if (keys['Enter']) {
        this.state = 'playing';
        this.startScene(0);
      }
      return;
    }
    if (this.state === 'gameover' || this.state === 'win') {
      this.winTimer += dt;
      if (keys['Enter'] && this.winTimer > 1.0) {
        this.state = 'title';
        this.hero = null;
        this.winTimer = 0;
      }
      return;
    }

    this.updateHero(dt);
    for (const a of this.actors) {
      if (a === this.hero || a === this.mariko) continue;
      this.updateEnemy(a, dt);
    }
    for (const a of this.actors) a.update(dt);

    if (this.hero.dead) {
      this.state = 'gameover';
      this.winTimer = 0;
      return;
    }

    const livingEnemies = this.actors.filter(a => a !== this.hero && a !== this.mariko && !a.dead).length;

    if (this.scene.end === 'mariko') {
      if (Math.abs(this.hero.x - this.mariko.x) < 26) {
        this.state = 'win';
        this.winTimer = 0;
      }
    } else if (livingEnemies === 0) {
      if (this.hero.x > this.scene.length - 50) {
        this.startScene(this.sceneIdx + 1);
      }
    }

    const target = this.hero.x - W / 2;
    this.cameraX = Math.max(0, Math.min(this.scene.length - W, target));
  }

  drawBackground() {
    const def = BG_FOR_SCENE[this.scene.name];
    const bg = def && bgImages[def.file];
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (bg) {
      if (def.scroll) {
        // Tile horizontally; each room is one bg width wide. cameraX advances
        // through the scene, so we draw repeats of the image as it scrolls.
        const bw = bg.width;
        const startX = -Math.floor(((this.cameraX % bw) + bw) % bw);
        for (let x = startX; x < W; x += bw) {
          ctx.drawImage(bg, x, 0, bw, H);
        }
      } else {
        ctx.drawImage(bg, 0, 0, W, H);
      }
    }
    // Scrolling ground ticks for the static-bg scenes — gives movement a cue.
    if (groundTicks && !def?.scroll) {
      const tw = groundTicks.width;
      const startX = -Math.floor(((this.cameraX % tw) + tw) % tw);
      for (let x = startX; x < W; x += tw) {
        ctx.drawImage(groundTicks, x, GROUND_Y + 2);
      }
    }
  }

  drawText(s, x, y, size = 8, color = '#222') {
    ctx.font = `${size}px monospace`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.fillText(s, x, y);
  }

  drawHUD() {
    // Original Karateka power meters: each fighter has a single horizontal
    // triangle that points away from center. The triangle shrinks from its
    // wide base (near the center of the screen) toward the point as HP drops.
    //
    //   PLAYER ▶   (point on right, base on left, full HP = full width)
    //                                                       ◀ ENEMY
    //
    // Empty outline is drawn first so the bar always reads as a "container",
    // then the current-HP portion is filled in solid.
    const baseY = 5;
    const barH = 9;
    const barW = 90;
    const padFromEdge = 6;

    // ---- Player meter, point facing RIGHT ----
    // Triangle vertices: (xL, baseY), (xL, baseY+barH), (xL+barW, baseY+barH/2)
    {
      const xL = padFromEdge;
      const xR = xL + barW;
      const midY = baseY + barH / 2;
      // outline
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xL + 0.5, baseY + 0.5);
      ctx.lineTo(xL + 0.5, baseY + barH - 0.5);
      ctx.lineTo(xR - 0.5, midY);
      ctx.closePath();
      ctx.stroke();
      // fill — clip the same triangle, then fill an HP-proportion rectangle
      // measured from the left (base) toward the right (point).
      const ratio = Math.max(0, this.hero.hp / this.hero.maxHp);
      const fillW = Math.round(barW * ratio);
      if (fillW > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xL, baseY);
        ctx.lineTo(xL, baseY + barH);
        ctx.lineTo(xR, midY);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = '#fff';
        ctx.fillRect(xL, baseY, fillW, barH);
        ctx.restore();
      }
    }

    // ---- Enemy meter, point facing LEFT ----
    let target = null;
    let bestDx = 1e9;
    for (const a of this.actors) {
      if (a === this.hero || a === this.mariko || a.dead) continue;
      const dx = Math.abs(a.x - this.hero.x);
      if (dx < bestDx && dx < 100) { bestDx = dx; target = a; }
    }
    if (target) {
      const xR = W - padFromEdge;
      const xL = xR - barW;
      const midY = baseY + barH / 2;
      // outline (point on left, base on right)
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xR - 0.5, baseY + 0.5);
      ctx.lineTo(xR - 0.5, baseY + barH - 0.5);
      ctx.lineTo(xL + 0.5, midY);
      ctx.closePath();
      ctx.stroke();
      const ratio = Math.max(0, target.hp / target.maxHp);
      const fillW = Math.round(barW * ratio);
      if (fillW > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xR, baseY);
        ctx.lineTo(xR, baseY + barH);
        ctx.lineTo(xL, midY);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = '#fff';
        // fill grows from the right (base) leftward
        ctx.fillRect(xR - fillW, baseY, fillW, barH);
        ctx.restore();
      }
    }

    // scene label, bottom-right, low contrast
    this.drawText(this.scene.name, W - 60, H - 12, 8, '#aaa');
  }

  drawTitle() {
    // Castle silhouette is the title backdrop (in-game OUTDOOR uses Fuji).
    const bg = bgImages[TITLE_BG_FILE];
    if (bg) {
      ctx.drawImage(bg, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
    }
    // soft dark overlay so the white title pops over the bg
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px monospace';
    ctx.textBaseline = 'top';
    const t = 'KARATEKA';
    const tw = ctx.measureText(t).width;
    ctx.fillText(t, (W - tw) / 2, 38);
    ctx.font = '8px monospace';
    ctx.fillStyle = '#ddd';
    const sub = 'PRESS ENTER TO BEGIN';
    ctx.fillText(sub, (W - ctx.measureText(sub).width) / 2, 78);
    const help = '← → run     SPACE fight     Z punch     X kick';
    ctx.fillStyle = '#bbb';
    ctx.fillText(help, (W - ctx.measureText(help).width) / 2, 110);
  }

  draw() {
    if (this.state === 'title') {
      this.drawTitle();
      return;
    }

    this.drawBackground();

    const sorted = [...this.actors].sort((a, b) => a.y - b.y);
    ctx.save();
    ctx.translate(-Math.round(this.cameraX), 0);
    for (const a of sorted) a.draw();
    ctx.restore();

    this.drawHUD();

    if (this.state === 'win' || this.state === 'gameover') {
      ctx.fillStyle = 'rgba(245,245,245,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#222';
      ctx.font = 'bold 14px monospace';
      const msg = (this.state === 'win') ? 'YOU FOUND MARIKO' : 'DEFEATED';
      const mw = ctx.measureText(msg).width;
      ctx.fillText(msg, (W - mw) / 2, 70);
      ctx.font = '8px monospace';
      ctx.fillStyle = '#555';
      const press = 'press ENTER';
      ctx.fillText(press, (W - ctx.measureText(press).width) / 2, 100);
    }
  }
}

// ---------- Boot ----------
async function boot() {
  sheet = await loadJSON('assets/atlas.json?v=6');
  const rawAtlas = await loadImage('assets/atlas.png?v=6');
  atlas = greyscaleAtlas(rawAtlas);

  // Load every unique bg image referenced by scenes + the title screen.
  const files = new Set([TITLE_BG_FILE, ...Object.values(BG_FOR_SCENE).map(d => d.file)]);
  await Promise.all([...files].map(async file => {
    bgImages[file] = await loadImage('assets/' + file + '?v=3');
  }));
  groundTicks = buildGroundTicks();

  const game = new Game();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot().catch(err => {
  ctx.fillStyle = '#c33';
  ctx.font = '10px monospace';
  ctx.fillText('LOAD ERROR: ' + err.message, 10, 20);
  console.error(err);
});

})();
