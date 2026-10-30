/*
 * Spyder — the Sonic Pulse.
 *
 * A bonus charge weapon (key F).
 * Max 1 charge held.
 * One expanding ring from the hero across the whole room.
 * Clears every spider, hatchling and egg on screen once (bosses take 25% health).
 * Brief bass thump, screen shake, dust kicked up along the ring.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  const MAX_RADIUS = 2200;
  const EXPAND_SPEED = 2600;

  let charges = 0;
  let activePulse = null;

  function hasCharge() {
    return charges > 0;
  }

  function addCharge(n = 1) {
    charges = Math.min(1, charges + n);
    return charges;
  }

  function fire(world, hero) {
    if (charges <= 0) return false;
    charges--;

    const hx = hero.x;
    const hy = hero.y - 45;

    activePulse = {
      x: hx,
      y: hy,
      radius: 0,
      maxRadius: MAX_RADIUS,
      hitCritters: new Set(),
      age: 0,
    };

    world.shake(0.5); // a short bass thump (the strongest other shake is 0.6)
    world.audio.play('pop', 1.4);
    world.audio.play('thump', 1.2);
    if (world.burst) {
      world.burst.airPuff(hx, hy, 0);
      world.burst.airPuff(hx, hy, Math.PI);
    }
    return true;
  }

  function update(world, dt) {
    if (!activePulse) return;
    const p = activePulse;
    p.age += dt;
    const prevRadius = p.radius;
    p.radius += EXPAND_SPEED * dt;

    // Check critters crossed by the expanding ring
    for (const c of world.critters) {
      if (!c.alive || p.hitCritters.has(c)) continue;
      const cx = c.rig ? c.rig.hitCenter().x : c.x;
      const cy = c.rig ? c.rig.hitCenter().y : c.y;
      const dist = Math.hypot(cx - p.x, cy - p.y);

      if (dist <= p.radius && dist >= prevRadius - 80) {
        p.hitCritters.add(c);
        if (world.burst) world.burst.fibres(cx, cy, 8);

        if (c.isBoss) {
          const maxHp = c.maxHealth || 4;
          const damage = maxHp * 0.25;
          if (world.hitBoss) {
            world.hitBoss(damage, 'sonic-pulse');
          } else if (c.hit) {
            c.hit(world, damage, 'sonic-pulse');
          } else {
            c.health = Math.max(0, (c.health || maxHp) - damage);
            if (c.health <= 0 && c.kill) c.kill(world, 'pulse');
          }
        } else {
          // Clear all regular spiders, hatchlings, eggs
          c.health = 0;
          c.kill(world, 'pulse');
          if (S.countsForQuota(c)) world.stats.kills++;
          if (c.kind === 'egg') world.stats.eggs++;
          world.bumpCombo();
          world.award(c.points, cx, cy - 25);
        }
      }
    }

    if (world.boss && world.boss.alive && !p.hitCritters.has(world.boss)) {
      const bx = world.boss.x ?? 960;
      const by = world.boss.y ?? 400;
      const dist = Math.hypot(bx - p.x, by - p.y);
      if (dist <= p.radius && dist >= prevRadius - 80) {
        p.hitCritters.add(world.boss);
        if (world.burst) world.burst.fibres(bx, by, 8);
        const maxHp = world.boss.maxHealth || 4;
        const damage = maxHp * 0.25;
        if (world.hitBoss) {
          world.hitBoss(damage, 'sonic-pulse');
        } else if (world.boss.hit) {
          world.boss.hit(world, damage, 'sonic-pulse');
        }
      }
    }

    // Tear webs touched by ring
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const rx = p.x + Math.cos(a) * p.radius;
      const ry = p.y + Math.sin(a) * p.radius;
      world.tearSilk(rx - 20, ry, rx + 20, ry, 30);
    }

    if (p.radius >= p.maxRadius) {
      activePulse = null;
    }
  }

  // The pulse: a ring of moving air, drawn as a bright leading edge with a
  // soft band of disturbed air behind it, a faint wavering shimmer, and
  // dust kicked up where it crosses the floor. Fades as it spreads.
  function draw(g) {
    if (!activePulse) return;
    const p = activePulse;
    const k = S.clamp(p.radius / p.maxRadius, 0, 1);
    const alpha = (1 - k) * 0.95;
    if (alpha <= 0.01) return;
    g.save();
    // The band behind the edge.
    const band = g.createRadialGradient(p.x, p.y, Math.max(0, p.radius - 70), p.x, p.y, p.radius);
    band.addColorStop(0, S.rgba(P.bone, 0));
    band.addColorStop(0.8, S.rgba(P.bone, 0.1 * alpha));
    band.addColorStop(1, S.rgba(P.bone, 0.4 * alpha));
    g.fillStyle = band;
    g.beginPath();
    g.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    g.fill();
    // The edge itself, wavering a little.
    g.strokeStyle = S.rgba(P.bone, 0.85 * alpha);
    g.lineWidth = 4;
    g.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const r = p.radius + Math.sin(a * 9 + p.radius * 0.05) * 3;
      const x = p.x + Math.cos(a) * r;
      const y = p.y + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.strokeStyle = S.rgba(P.moon, 0.35 * alpha);
    g.lineWidth = 8;
    g.beginPath();
    g.arc(p.x, p.y, Math.max(0, p.radius - 8), 0, Math.PI * 2);
    g.stroke();
    // Dust kicked up where the ring meets the floor, both sides.
    const floor = 935;
    const dy = floor - p.y;
    if (Math.abs(dy) < p.radius) {
      const dx = Math.sqrt(p.radius * p.radius - dy * dy);
      for (const sx of [p.x - dx, p.x + dx]) {
        for (let i = 0; i < 5; i++) {
          const ox = Math.sin(i * 3.1 + p.radius * 0.02) * 18;
          const oy = -i * 9 - (p.radius % 17);
          g.fillStyle = S.rgba(P.linen, 0.25 * alpha);
          g.beginPath();
          g.arc(sx + ox, floor + oy, 10 + i * 3, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.restore();
  }

  function reset() {
    charges = 0;
    activePulse = null;
  }

  S.weapons.register({
    id: 'sonic-pulse',
    name: 'Sonic Pulse',
    kind: 'bonus',
    resource: 'charges',
    heroModel: 'vacuum',
    hasCharge,
    addCharge,
    get charges() {
      return charges;
    },
    set charges(v) {
      charges = Math.max(0, Math.min(1, v));
    },
    fire,
    update,
    draw,
    reset,
  });
})();
