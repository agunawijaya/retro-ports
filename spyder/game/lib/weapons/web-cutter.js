/*
 * Spyder — the Web-Cutter.
 *
 * A spinning blade launcher that clears silk paths and snips threads.
 * Fires a spinning blade on a rising arc (starts along aim, curves upward, 1.1 s life).
 * Silk: tears every strand along path + 50 px around it; snips threads it crosses.
 * Bodies: 0.5 damage (big spiders need two hits).
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  const FIRE_RATE = 0.32; // seconds between blades
  const BLADE_SPEED = 1100;
  const LIFE = 1.1; // seconds before blade expires
  const DAMAGE = 0.5;

  let blades = [];
  let cooldown = 0;

  function fire(world, hero, aim) {
    if (cooldown > 0) return;
    const m = hero.muzzle();
    const blade = {
      x: m.x,
      y: m.y,
      px: m.x,
      py: m.y,
      vx: Math.cos(aim) * BLADE_SPEED,
      vy: Math.sin(aim) * BLADE_SPEED,
      spin: 0,
      age: 0,
      trail: [],
      tore: false,
    };
    blades.push(blade);
    hero.recoil = 1.1;
    hero.feel('determined', 0.4);
    world.burst.airPuff(m.x, m.y, aim);
    world.audio.play('pop', 0.85);
    cooldown = FIRE_RATE;
    world.emit('fire', { blade });
  }

  function update(world, dt) {
    cooldown = Math.max(0, cooldown - dt);
    if (world.hero && world.hero.heroModel === 'cutter') {
      world.hero.charge = 1 - cooldown / FIRE_RATE;
    }

    for (let i = blades.length - 1; i >= 0; i--) {
      const b = blades[i];
      b.px = b.x;
      b.py = b.y;

      // Rising arc: accelerates upward
      b.vy -= 750 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.spin += dt * 32;
      b.age += dt;

      // Store trail points (up to 3 fading copies)
      b.trail.unshift({ x: b.px, y: b.py, spin: b.spin - 0.3 });
      if (b.trail.length > 3) b.trail.pop();

      // Silk tears wherever the blade passes + 50 px radius. Passes through silk!
      if (world.tearSilk(b.px, b.py, b.x, b.y, 50)) {
        b.tore = true;
      }

      // Snip silk threads crossed
      world.snipThread(b.px, b.py, b.x, b.y);

      // Hit breakable boxes
      let consumed = false;
      if (world.hitBreakable && world.hitBreakable(b.px, b.py, b.x, b.y)) {
        consumed = true;
      }

      // Bodies: 0.5 damage (big spiders take two hits to kill)
      if (!consumed) {
        consumed = world.hitBody(b.px, b.py, b.x, b.y, DAMAGE);
      }

      const off = b.x < -60 || b.x > 1980 || b.y < -80 || b.y > 1140 || b.age > LIFE;
      if (consumed || off) {
        if (!consumed && !b.tore) world.breakCombo();
        blades.splice(i, 1);
      }
    }
  }

  // The blade: a four-point star of steel with concave, honed edges, a
  // bright rim on the edge that faces the light, a dark hub and a brass
  // rivet. The trail is three fading copies of it (see draw).
  function drawBlade(g, x, y, spin, scale = 1, alpha = 1) {
    g.save();
    g.translate(x, y);
    g.rotate(spin);
    g.scale(scale, scale);
    g.globalAlpha = alpha;
    const size = 25;
    const waist = 6;
    const star = () => {
      g.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        const tip = [Math.cos(a) * size, Math.sin(a) * size];
        const next = [Math.cos(a + Math.PI / 2) * size, Math.sin(a + Math.PI / 2) * size];
        const mid = [Math.cos(a + Math.PI / 4) * waist, Math.sin(a + Math.PI / 4) * waist];
        if (k === 0) g.moveTo(tip[0], tip[1]);
        // Concave edges: each curves in toward the waist between two tips.
        g.quadraticCurveTo(mid[0], mid[1], next[0], next[1]);
      }
      g.closePath();
    };
    const steel = g.createLinearGradient(-size, -size, size, size);
    steel.addColorStop(0, S.mixHex(P.bone, P.gear, 0.15));
    steel.addColorStop(0.5, S.mixHex(P.gear, P.bone, 0.45));
    steel.addColorStop(1, S.shadeHex(P.gear, -0.35));
    star();
    g.fillStyle = steel;
    g.fill();
    // The honed edge: a thin bright line, strongest at the top left.
    g.strokeStyle = S.rgba(P.bone, 0.9);
    g.lineWidth = 1.4;
    g.stroke();
    // A bevel down each arm.
    g.strokeStyle = S.rgba(P.soot, 0.35);
    g.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * size * 0.8, Math.sin(a) * size * 0.8);
      g.stroke();
    }
    // Hub and rivet.
    g.fillStyle = S.shadeHex(P.gear, -0.45);
    g.beginPath();
    g.arc(0, 0, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.brass;
    g.beginPath();
    g.arc(0, 0, 2.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.rgba(P.bone, 0.7);
    g.beginPath();
    g.arc(-0.8, -0.8, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function draw(g) {
    for (const b of blades) {
      // 3 motion trail fading copies
      for (let t = 0; t < b.trail.length; t++) {
        const pt = b.trail[t];
        const alpha = (0.35 / (t + 1)) * Math.max(0, 1 - b.age / LIFE);
        drawBlade(g, pt.x, pt.y, pt.spin, 0.9 - t * 0.1, alpha);
      }
      // Main spinning blade
      const alpha = Math.min(1, (LIFE - b.age) * 4);
      drawBlade(g, b.x, b.y, b.spin, 1, alpha);
    }
  }

  function glow(g) {
    for (const b of blades) S.light.glow(g, b.x, b.y, 40, S.mixHex(P.bone, P.moon, 0.3), 0.45);
  }

  function lights(lightMap) {
    for (const b of blades) lightMap.point(b.x, b.y, 110, S.mixHex(P.bone, P.moon, 0.2), 0.4);
  }

  function reset() {
    blades = [];
    cooldown = 0;
  }

  S.weapons.register({
    id: 'web-cutter',
    name: 'Web-Cutter',
    kind: 'default',
    resource: 'pressure',
    heroModel: 'cutter',
    fire,
    update,
    draw,
    glow,
    lights,
    reset,
  });
})();
