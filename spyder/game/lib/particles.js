/*
 * Spyder — particles.
 *
 * Two systems live here:
 *   - Burst: short-lived effects (air puffs, goo, silk fibres, sparkles).
 *     Drawn inside the lit scene, so they are shaded by the room's light.
 *   - DustField: the slow motes that hang in the air. Drawn AFTER lighting,
 *     and only bright where light actually falls, which is what sells the
 *     god rays and the lamp pool.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  class Burst {
    constructor(seed = 5, density = 1) {
      this.items = [];
      this.rng = S.createRng(seed);
      // Settings → Visual → Particles: "reduced" keeps about half of them.
      // At 1 the random stream is untouched, so the default look is exact.
      this.density = density;
      this.thinning = S.createRng(seed + 1);
    }

    add(kind, x, y, props = {}) {
      if (this.density < 1 && this.thinning.next() > this.density) return null;
      const p = {
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        gravity: 0,
        drag: 1.5,
        life: 1,
        age: 0,
        size: 4,
        rot: 0,
        spin: 0,
        color: P.linen,
        ...props,
      };
      this.items.push(p);
      return p;
    }

    // The compressed-air "pop" of the vacuum blaster.
    airPuff(x, y, angle) {
      const r = this.rng;
      for (let i = 0; i < 6; i++) {
        const a = angle + r.range(-0.6, 0.6);
        const speed = r.range(80, 220);
        this.add('puff', x, y, {
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          drag: 5,
          life: r.range(0.25, 0.45),
          size: r.range(6, 14),
          color: P.bone,
        });
      }
    }

    // A spider hit: muted olive droplets that arc and splat.
    goo(x, y, power = 1) {
      const r = this.rng;
      for (let i = 0; i < 12 * power; i++) {
        const a = r.range(0, Math.PI * 2);
        const speed = r.range(120, 420) * power;
        this.add('goo', x, y, {
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 120,
          gravity: 1400,
          drag: 0.6,
          life: r.range(0.5, 0.9),
          size: r.range(2.5, 6),
          color: r.chance(0.3) ? P.spiderMark : P.goo,
        });
      }
    }

    // Torn silk: tiny bright curls that float down slowly.
    fibres(x, y, count = 6) {
      const r = this.rng;
      for (let i = 0; i < count; i++) {
        this.add('fibre', x, y, {
          vx: r.range(-60, 60),
          vy: r.range(-40, 30),
          gravity: 40,
          drag: 2.2,
          life: r.range(1.2, 2.4),
          size: r.range(6, 14),
          rot: r.range(0, Math.PI * 2),
          spin: r.range(-3, 3),
          color: P.silk,
        });
      }
    }

    dustPuff(x, y, count = 10, spread = 60) {
      const r = this.rng;
      for (let i = 0; i < count; i++) {
        this.add('puff', x + r.range(-spread, spread) * 0.3, y, {
          vx: r.range(-spread, spread),
          vy: r.range(-70, -10),
          drag: 2.5,
          life: r.range(0.6, 1.2),
          size: r.range(10, 26),
          color: P.taupe,
        });
      }
    }

    sparkle(x, y, count = 8, color = P.dawn) {
      const r = this.rng;
      for (let i = 0; i < count; i++) {
        this.add('sparkle', x + r.range(-30, 30), y + r.range(-30, 30), {
          vx: r.range(-20, 20),
          vy: r.range(-50, -10),
          drag: 1,
          life: r.range(0.6, 1.3),
          size: r.range(4, 9),
          color,
        });
      }
    }

    update(dt, floorAt) {
      for (let i = this.items.length - 1; i >= 0; i--) {
        const p = this.items[i];
        p.age += dt;
        if (p.age >= p.life) {
          this.items.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        const slow = Math.exp(-p.drag * dt);
        p.vx *= slow;
        p.vy *= slow;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;

        // Goo lands and flattens instead of falling through the floor.
        if (p.kind === 'goo' && floorAt) {
          const floor = floorAt(p.x, p.y);
          if (floor !== null && p.y > floor) {
            p.y = floor;
            p.vx = 0;
            p.vy = 0;
            p.gravity = 0;
            p.kind = 'splat';
            p.life = p.age + 2.5;
          }
        }
      }
    }

    draw(ctx) {
      for (const p of this.items) {
        const t = p.age / p.life;
        const fade = 1 - t;
        switch (p.kind) {
          case 'puff': {
            const r = p.size * (0.6 + t * 1.4);
            ctx.fillStyle = S.rgba(p.color, 0.28 * fade);
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'goo': {
            ctx.fillStyle = S.rgba(p.color, 0.9);
            ctx.beginPath();
            // Stretch along velocity so droplets read as moving liquid.
            const speed = Math.hypot(p.vx, p.vy);
            const stretch = 1 + Math.min(speed / 400, 1.5);
            ctx.ellipse(p.x, p.y, p.size * stretch, p.size, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'splat': {
            ctx.fillStyle = S.rgba(p.color, 0.7 * Math.min(1, (p.life - p.age) / 1));
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.size * 2.2, p.size * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'fibre': {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.strokeStyle = S.rgba(p.color, 0.6 * fade);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-p.size, 0);
            ctx.quadraticCurveTo(0, -p.size * 0.6, p.size, 0);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'sparkle': {
            const a = Math.sin(t * Math.PI);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = S.rgba(p.color, a);
            ctx.beginPath();
            const s = p.size * a;
            ctx.moveTo(0, -s);
            ctx.quadraticCurveTo(0, 0, s, 0);
            ctx.quadraticCurveTo(0, 0, 0, s);
            ctx.quadraticCurveTo(0, 0, -s, 0);
            ctx.quadraticCurveTo(0, 0, 0, -s);
            ctx.fill();
            ctx.restore();
            break;
          }
        }
      }
    }
  }

  // ── Floating dust ───────────────────────────────────────────────────

  class DustField {
    constructor(count, bounds, seed = 21) {
      this.bounds = bounds;
      this.noise = S.createNoise(seed);
      const rng = S.createRng(seed);
      this.motes = Array.from({ length: count }, (_, i) => ({
        x: rng.range(bounds.x, bounds.x + bounds.w),
        y: rng.range(bounds.y, bounds.y + bounds.h),
        size: rng.range(0.8, 2.6),
        depth: rng.range(0.4, 1.2), // nearer motes drift faster and look bigger
        phase: i * 1.37,
      }));
    }

    update(dt, time, windX = 0) {
      const { x, y, w, h } = this.bounds;
      for (const m of this.motes) {
        m.x += (this.noise(m.phase + time * 0.15) * 14 + windX) * m.depth * dt;
        m.y += (this.noise(m.phase * 2.1 + time * 0.12) * 10 + 3) * m.depth * dt;
        if (m.y > y + h) m.y = y;
        if (m.x < x) m.x = x + w;
        if (m.x > x + w) m.x = x;
      }
    }

    // `light` is the frame's LightMap; motes in the dark stay nearly invisible.
    draw(ctx, light, tint = P.bone, sparkle = 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const m of this.motes) {
        const lit = Math.min(1, light.brightnessAt(m.x, m.y));
        const alpha = 0.04 + lit * 0.75;
        if (alpha < 0.05) continue;
        const r = m.size * m.depth * (1 + sparkle * 0.8);
        ctx.fillStyle = S.rgba(tint, alpha);
        ctx.beginPath();
        ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  S.Burst = Burst;
  S.DustField = DustField;
})();
