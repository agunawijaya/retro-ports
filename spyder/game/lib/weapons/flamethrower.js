/*
 * Spyder — the Flamethrower.
 *
 * A temporary bonus weapon (timer: 8 s from pickup).
 * While active, it is the only weapon; when timer ends, previous weapon returns.
 * Continuous cone of flame (range 360 px, 30°).
 * Burns webs instantly, deals high damage to everything.
 * Warm moving light in the light map.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  const RANGE = 360;
  const SPREAD = (30 * Math.PI) / 180; // 30 degrees cone
  const DURATION = 8.0;

  let timer = 0;
  let active = false;
  let firing = false;
  let boxHitCooldown = 0;
  let sparks = [];
  let heroRef = null;
  // How much flame is showing (0 … 1): it catches at once when the trigger
  // is held and dies down over half a second when it is let go. Only the
  // look follows it; the burning itself follows `firing`.
  let flame = 0;
  let clock = 0;

  function startTimer(seconds = DURATION) {
    timer = seconds;
    active = true;
  }

  function inCone(x, y, mx, my, aim) {
    const dx = x - mx;
    const dy = y - my;
    const dist = Math.hypot(dx, dy);
    if (dist > RANGE + 10) return false;
    const angle = Math.atan2(dy, dx);
    let diff = Math.abs(angle - aim);
    while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
    return diff <= SPREAD / 2 + 0.05;
  }

  function fire(world, hero, aim) {
    if (hero) heroRef = hero;
    if (!active || timer <= 0) return;
    firing = true;
  }

  function update(world, dt) {
    if (world.hero) heroRef = world.hero;
    if (!active) return;
    timer = Math.max(0, timer - dt);
    boxHitCooldown = Math.max(0, boxHitCooldown - dt);

    const hero = world.hero;
    const m = hero ? hero.muzzle() : { x: 0, y: 0 };
    const aim = hero ? hero.aim : 0;

    // Continuous flame while firing
    if (firing && timer > 0) {
      // 1. Burn webs instantly in cone
      for (let stepAngle = -SPREAD / 2; stepAngle <= SPREAD / 2; stepAngle += SPREAD / 6) {
        const rayAngle = aim + stepAngle;
        const tx = m.x + Math.cos(rayAngle) * RANGE;
        const ty = m.y + Math.sin(rayAngle) * RANGE;
        world.tearSilk(m.x, m.y, tx, ty, 40);
      }

      // 2. High damage to all critters in cone
      for (const c of world.critters) {
        if (!c.alive) continue;
        const cx = c.rig ? c.rig.hitCenter().x : c.x;
        const cy = c.rig ? c.rig.hitCenter().y : c.y;

        if (inCone(cx, cy, m.x, m.y, aim)) {
          world.hitBody(cx - 5, cy, cx + 5, cy, 6 * dt + 0.5);
        }
      }

      // 3. Breakable boxes in cone
      if (boxHitCooldown <= 0 && world.hitBreakable) {
        const tipX = m.x + Math.cos(aim) * (RANGE * 0.7);
        const tipY = m.y + Math.sin(aim) * (RANGE * 0.7);
        if (world.hitBreakable(m.x, m.y, tipX, tipY)) {
          boxHitCooldown = 0.25;
        }
      }

      // Master Bedroom nest
      world.emit('dart', { dart: { x: m.x + Math.cos(aim) * (RANGE * 0.6), y: m.y + Math.sin(aim) * (RANGE * 0.6) } });

      // Sparks
      if (Math.random() < 0.6) {
        sparks.push({
          x: m.x + Math.cos(aim) * (40 + Math.random() * (RANGE - 60)),
          y: m.y + Math.sin(aim) * (40 + Math.random() * (RANGE - 60)) + (Math.random() - 0.5) * 40,
          vx: Math.cos(aim) * 200 + (Math.random() - 0.5) * 80,
          vy: Math.sin(aim) * 200 - Math.random() * 60,
          age: 0,
          life: 0.35 + Math.random() * 0.25,
        });
      }
    }

    // Update sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.age += dt;
      if (sp.age >= sp.life) sparks.splice(i, 1);
    }

    clock += dt;
    flame = firing && timer > 0 ? 1 : Math.max(0, flame - dt * 2);
    firing = false;
  }

  // The flame: tongues of fire streaming out along the cone, each a long
  // teardrop that flickers in length and sways, drawn in three layers — an
  // amber haze, an ember body, a pale hot core near the nozzle — with
  // sparks and curling embers thrown ahead of it.
  const TONGUES = 9;
  function tongue(g, i, len, width, sway) {
    const a = ((i / (TONGUES - 1)) - 0.5) * SPREAD * 0.9 + sway;
    const ex = Math.cos(a) * len;
    const ey = Math.sin(a) * len;
    const nx = -Math.sin(a) * width;
    const ny = Math.cos(a) * width;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(ex * 0.35 + nx, ey * 0.35 + ny, ex * 0.8 + nx * 0.6, ey * 0.8 + ny * 0.6, ex, ey);
    g.bezierCurveTo(ex * 0.8 - nx * 0.6, ey * 0.8 - ny * 0.6, ex * 0.35 - nx, ey * 0.35 - ny, 0, 0);
    g.closePath();
  }

  function draw(g) {
    if (!active || flame <= 0.01) return drawEmbers(g);
    const hero = heroRef;
    if (!hero) return;
    const m = hero.muzzle();
    g.save();
    g.translate(m.x, m.y);
    g.rotate(hero.aim);
    const layers = [
      { k: 1.1, w: 0.24, color: P.amber, a: 0.34 },
      { k: 0.9, w: 0.16, color: P.ember, a: 0.65 },
      { k: 0.48, w: 0.07, color: P.dawn, a: 0.8 },
      { k: 0.26, w: 0.04, color: P.bone, a: 0.9 },
    ];
    for (const layer of layers) {
      const reach = RANGE * layer.k * (0.6 + 0.4 * flame);
      const grad = g.createRadialGradient(0, 0, 4, 0, 0, reach);
      grad.addColorStop(0, S.rgba(layer.color, layer.a * flame));
      grad.addColorStop(0.65, S.rgba(layer.color, layer.a * 0.6 * flame));
      grad.addColorStop(1, S.rgba(layer.color, 0));
      g.fillStyle = grad;
      for (let i = 0; i < TONGUES; i++) {
        const flick = 0.72 + 0.28 * Math.sin(clock * (9 + i * 1.7) + i * 2.1);
        const sway = Math.sin(clock * 5 + i) * 0.05;
        tongue(g, i, reach * flick, reach * layer.w * (0.8 + 0.2 * Math.sin(clock * 7 + i)), sway);
        g.fill();
      }
    }
    g.restore();
    drawEmbers(g);
  }

  // Sparks fly ahead of the flame; the slower ones curl like burnt silk
  // turning to embers.
  function drawEmbers(g) {
    for (const sp of sparks) {
      const k = Math.max(0, 1 - sp.age / sp.life);
      const curl = (sp.seed ?? (sp.seed = Math.random() * 6.28)) + sp.age * 9;
      g.strokeStyle = S.rgba(P.amber, 0.9 * k);
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(sp.x, sp.y, 3 + (1 - k) * 4, curl, curl + 2.2);
      g.stroke();
      g.fillStyle = S.rgba(P.dawn, k);
      g.beginPath();
      g.arc(sp.x, sp.y, 1.6, 0, Math.PI * 2);
      g.fill();
    }
  }

  function glow(g) {
    if (!active || flame <= 0.01 || !heroRef) return;
    const m = heroRef.muzzle();
    const aim = heroRef.aim;
    for (const [d, r, a] of [[0.15, 60, 0.7], [0.45, 150, 0.5], [0.8, 200, 0.3]]) {
      S.light.glow(g, m.x + Math.cos(aim) * RANGE * d, m.y + Math.sin(aim) * RANGE * d, r, P.ember, a * flame);
    }
    S.light.glow(g, m.x, m.y, 30, P.bone, 0.6 * flame);
  }

  // The flame is a warm light that moves with the aim: a bright pool along
  // the cone and a wide warm wash round the hero.
  function lights(lightMap) {
    if (!active || !heroRef) return;
    const m = heroRef.muzzle();
    const aim = heroRef.aim;
    const flick = 0.85 + 0.15 * Math.sin(clock * 23) * Math.sin(clock * 7);
    // The pilot light, always on while the weapon is held.
    lightMap.point(m.x, m.y, 90, P.amber, 0.35);
    if (flame <= 0.01) return;
    lightMap.cone(m.x, m.y, aim, SPREAD * 2.2, RANGE * 1.4, P.amber, 0.9 * flame * flick);
    lightMap.point(m.x + Math.cos(aim) * RANGE * 0.5, m.y + Math.sin(aim) * RANGE * 0.5, 320, P.ember, 0.75 * flame * flick);
    lightMap.point(m.x, m.y, 420, P.dawn, 0.35 * flame * flick);
  }

  function reset() {
    flame = 0;
    timer = 0;
    active = false;
    firing = false;
    boxHitCooldown = 0;
    sparks = [];
    heroRef = null;
  }

  S.weapons.register({
    id: 'flamethrower',
    name: 'Flamethrower',
    kind: 'bonus',
    resource: 'timer',
    heroModel: 'flamethrower',
    startTimer,
    get timer() {
      return timer;
    },
    set timer(v) {
      timer = v;
      active = v > 0;
    },
    get active() {
      return active;
    },
    set active(v) {
      active = v;
    },
    fire,
    update,
    draw,
    glow,
    lights,
    reset,
  });
})();
