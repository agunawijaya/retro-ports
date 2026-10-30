/*
 * Spyder — the Vacuum Blaster.
 *
 * The weapon every room has always had, moved out of room-runtime.js
 * unchanged: same dart speed, fire rate, life, hit radius, score values,
 * sounds, recoil and events. It is the reference the other weapons
 * (prompts/12-weapons.md, L1 table) are measured against — the only one
 * with no weakness.
 *
 * It owns its own darts and cooldown; the runtime only calls the five
 * functions below, through the current-weapon slot (room-runtime.js,
 * "The current weapon and switching"), and asks world services
 * (tearSilk, snipThread, hitBody, breakCombo…) to do anything that touches
 * the room's webs, critters or score.
 */
(function () {
  'use strict';

  const S = window.Spyder;

  const FIRE_RATE = 0.2; // seconds between darts
  const DART_SPEED = 1700;
  const LIFE = 1.2; // seconds before a dart that hit nothing fades out
  const DAMAGE = 1;

  let darts = [];
  let cooldown = 0;

  function fire(world, hero, aim) {
    if (cooldown > 0) return;
    const m = hero.muzzle();
    const dart = {
      x: m.x,
      y: m.y,
      px: m.x,
      py: m.y,
      vx: Math.cos(aim) * DART_SPEED,
      vy: Math.sin(aim) * DART_SPEED,
      age: 0,
      tore: false,
    };
    darts.push(dart);
    hero.recoil = 1;
    hero.feel('determined', 0.35);
    world.burst.airPuff(m.x, m.y, aim);
    world.audio.play('pop');
    cooldown = FIRE_RATE;
    world.emit('fire', { dart });
  }

  function update(world, dt) {
    cooldown = Math.max(0, cooldown - dt);
    if (world.hero && world.hero.heroModel === 'vacuum') {
      world.hero.charge = 1 - cooldown / FIRE_RATE;
    }

    for (let i = darts.length - 1; i >= 0; i--) {
      const d = darts[i];
      d.px = d.x;
      d.py = d.y;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.age += dt;

      // Silk tears wherever the dart passes. It does not stop the dart.
      if (world.tearSilk(d.px, d.py, d.x, d.y)) d.tore = true;

      // A room can catch darts on its own props (a lamp that swings when hit).
      let consumed = world.emit('dart', { dart: d });

      // Snip the silk above a dangling spider: it drops, for a bonus.
      if (!consumed) consumed = world.snipThread(d.px, d.py, d.x, d.y);

      // Breakable box
      if (!consumed && world.hitBreakable) consumed = world.hitBreakable(d.px, d.py, d.x, d.y);

      // Bodies: the closest point of this frame's travel.
      if (!consumed) consumed = world.hitBody(d.px, d.py, d.x, d.y, DAMAGE);

      const off = d.x < -50 || d.x > 1970 || d.y < -50 || d.y > 1130 || d.age > LIFE;
      if (consumed || off) {
        // A dart that touched nothing at all breaks the combo.
        if (!consumed && !d.tore) world.breakCombo();
        darts.splice(i, 1);
      }
    }
  }

  function draw(g) {
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

  function glow(g) {
    for (const d of darts) S.light.glow(g, d.x, d.y, 40, '#FFF1D6', 0.5);
  }

  function lights(lightMap) {
    for (const d of darts) lightMap.point(d.x, d.y, 120, '#FFF6E0', 0.5);
  }

  function reset() {
    darts = [];
    cooldown = 0;
  }

  S.weapons.register({
    id: 'vacuum',
    name: 'Vacuum Blaster',
    kind: 'default',
    resource: 'pressure',
    heroModel: 'vacuum',
    fire,
    update,
    draw,
    glow,
    lights,
    reset,
  });
})();
