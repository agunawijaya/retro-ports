/*
 * Spyder — the Egg Carrier spider.
 *
 * Carries a large, pulsating egg sac on its abdomen, held by its raised back legs.
 * Walks the wall like a Wall Crawler at 0.75x speed, avoiding the hero.
 * After 9 seconds alive, it stops and plants a wall egg sac (0.8s).
 * If shot in the sac: sac pops (+150 pts, "Egg first!"), spider survives and flees at 1.4x speed.
 * If shot in the body while carrying: spider dies, sac drops and hatches in 3 seconds.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  const sentInto = new WeakMap();
  const sentSoFar = (world) => (world && world.stats ? (sentInto.get(world.stats) || 0) : 0);

  class EggCarrier {
    constructor({ world, lair, area, seed = 1, speed = 100, first = false, emergeDuration = 0.8, opts = {} }) {
      this.kind = 'eggCarrier';
      this.points = 220;
      this.hasSac = true;
      this.alive = true;
      this.done = false;
      this.seed = seed;
      this.area = area || { x0: 120, x1: 1840, y0: 110, y1: 770 };
      this.lair = lair || { x: 910, y: 565 };
      this.first = first;
      this.emergeDuration = emergeDuration;

      this.rng = S.createRng(seed);
      this.noise = S.createNoise(seed + 19);

      // SpiderRig, scale 1.1, back pair (legFemur 1.2) raised and curled over its back
      this.rig = new S.SpiderRig({
        x: this.lair.x,
        y: this.lair.y,
        heading: -Math.PI / 2 + this.rng.range(-0.5, 0.5),
        scale: 1.1,
        seed,
        legFemur: [1, 1, 1, 1.2],
        // The back pair is lifted off the wall to hold the sac (drawn in
        // draw()), so the rig's own back legs stay short and tucked.
        legReach: [1, 1, 1, 0.42],
      });
      this.rig.mode = 'walk';

      this.baseSpeed = speed;
      this.state = 'emerging';
      this.timer = 0;
      this.aliveTime = 0;
      this.emerge = 0;
      this.freezeFor = 0;
      this.plantingTimer = 0;
      this.plantingDuration = 0.8;
      this.fleeSpeed = this.baseSpeed * 1.4;
      this.vy = 0;

      this.pickTarget(world);

      // Listen for incoming darts to detect sac hits
      if (world && typeof world.on === 'function') {
        world.on('dart', (payload) => this.onDart(payload, world));
      }
    }

    pickTarget(world) {
      const { x0, x1, y0, y1 } = this.area;
      const hero = world?.hero;
      const hx = hero ? hero.x : 960;
      const hy = hero ? hero.y : 935;

      let bestTarget = {
        x: this.rng.range(x0 + 60, x1 - 60),
        y: this.rng.range(y0 + 40, y1 - 40),
      };
      let maxDist = Math.hypot(bestTarget.x - hx, bestTarget.y - hy);

      // Generate candidates and pick the one farthest from the hero
      for (let i = 0; i < 4; i++) {
        const cx = this.rng.range(x0 + 60, x1 - 60);
        const cy = this.rng.range(y0 + 40, y1 - 40);
        const dist = Math.hypot(cx - hx, cy - hy);
        if (dist > maxDist) {
          maxDist = dist;
          bestTarget = { x: cx, y: cy };
        }
      }
      this.target = bestTarget;
    }

    onDart({ dart: d }, world) {
      if (!this.alive || this.done || this.state === 'dying' || this.state === 'emerging') return false;
      if (!this.hasSac) return false;

      const abd = this.rig.abdomenCenter();
      const sacX = abd.x;
      const sacY = abd.y;
      const bodyCenter = this.rig.hitCenter();

      const distToSac = S.pointSegmentDistance(sacX, sacY, d.px, d.py, d.x, d.y);
      const distToBody = S.pointSegmentDistance(bodyCenter.x, bodyCenter.y, d.px, d.py, d.x, d.y);

      const sacRadius = 24;
      const bodyRadius = this.rig.hitRadius();

      if (distToSac <= sacRadius) {
        // If dart path is also near the body, see which center is reached first along the flight path
        if (distToBody <= bodyRadius + 6) {
          const vx = d.x - d.px;
          const vy = d.y - d.py;
          const lenSq = vx * vx + vy * vy || 1;
          const tSac = S.clamp(((sacX - d.px) * vx + (sacY - d.py) * vy) / lenSq, 0, 1);
          const tBody = S.clamp(((bodyCenter.x - d.px) * vx + (bodyCenter.y - d.py) * vy) / lenSq, 0, 1);
          if (tBody < tSac) {
            // Body was hit before the sac: allow regular body kill
            return false;
          }
        }

        // Hit in the sac: pops, +150, spider flees at 1.4x speed
        this.popSac(world, sacX, sacY);
        return true; // dart consumed
      }

      return false;
    }

    popSac(world, x, y) {
      this.hasSac = false;
      this.points = 120; // Carrier worth fewer points after losing sac
      world.bumpCombo();
      world.award(150, x, y - 25, 'Egg first!');
      world.sfx('squish');
      world.splat(x, y, 0.6);
      world.burst.fibres(x, y, 10);

      this.state = 'fleeing';
      this.pickTarget(world);
    }

    update(dt, world) {
      const r = this.rig;
      this.timer += dt;

      if (this.state === 'dying') {
        this.vy += 1600 * dt;
        r.y += this.vy * dt;
        r.heading += 4 * dt;
        r.curl = Math.min(1, r.curl + dt * 3);
        r.vx = r.vy = 0;
        const floor = world.floorAt(r.x, r.y - 30);
        if (floor !== null && r.y > floor - 14) {
          world.splat(r.x, floor - 10, 0.8);
          this.done = true;
        }
        r.update(dt, world.time);
        return;
      }

      this.aliveTime += dt;

      if (this.state === 'emerging') {
        this.emerge = Math.min(1, this.emerge + dt / this.emergeDuration);
        if (this.emerge >= 1) {
          this.state = 'wandering';
          this.timer = 0;
        }
      }

      // Check planting trigger: after 9s alive while carrying, stops to lower sac (0.8s)
      if (this.hasSac && this.aliveTime >= 9.0 && (this.state === 'wandering' || this.state === 'frozen')) {
        this.state = 'planting';
        this.plantingTimer = 0;
        r.vx = 0;
        r.vy = 0;
      }

      if (this.state === 'planting') {
        this.plantingTimer += dt;
        r.vx = 0;
        r.vy = 0;
        if (this.plantingTimer >= this.plantingDuration) {
          const abd = this.rig.abdomenCenter();
          world.spawnEgg(abd.x, abd.y, 'wall');
          world.burst.fibres(abd.x, abd.y, 6);
          this.hasSac = false;
          this.points = 120;
          this.state = 'wandering';
          this.pickTarget(world);
        }
      } else if (this.state === 'frozen') {
        r.vx = 0;
        r.vy = 0;
        if (this.timer > this.freezeFor) {
          this.state = 'wandering';
          this.timer = 0;
        }
      } else if (this.state === 'wandering' || this.state === 'fleeing' || this.state === 'emerging') {
        const toX = this.target.x - r.x;
        const toY = this.target.y - r.y;
        const d = Math.hypot(toX, toY);

        if (d < 30) {
          this.pickTarget(world);
          if (this.state === 'wandering' && this.rng.chance(0.4)) {
            this.state = 'frozen';
            this.freezeFor = this.rng.range(0.8, 1.8);
            this.timer = 0;
          }
        }

        const want = Math.atan2(toY, toX);
        const turnRate = this.state === 'fleeing' ? 5 : 3;
        r.heading += S.clamp(S.angleDelta(r.heading, want), -turnRate * dt, turnRate * dt);

        const surge = 0.7 + 0.6 * Math.max(0, this.noise(world.time * 0.9));
        let speed = this.baseSpeed * surge;
        if (this.state === 'emerging') speed *= 0.5;
        if (this.state === 'fleeing') speed = this.fleeSpeed * surge;

        r.vx = Math.cos(r.heading) * speed;
        r.vy = Math.sin(r.heading) * speed;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.x = S.clamp(r.x, this.area.x0, this.area.x1);
        r.y = S.clamp(r.y, this.area.y0, this.area.y1);
      }

      r.scale = 1.1 * S.lerp(0.6, 1, S.ease.out(this.emerge));
      r.glint = world.light.brightnessAt(r.x, r.y) + 0.25;
      r.update(dt, world.time);

      // Back legs curled over back holding sac
      if (this.hasSac && this.state !== 'dying') {
        const abd = this.rig.abdomenCenter();
        const f = this.rig.forward();
        const lat = { x: -f.y, y: f.x };
        for (const leg of this.rig.legs) {
          if (leg.index === 3) {
            leg.foot = {
              x: abd.x + f.x * 4 + lat.x * leg.side * 14,
              y: abd.y + f.y * 4 + lat.y * leg.side * 14,
            };
            leg.lifted = 0.5;
            leg.step = null;
          }
        }
      }
    }

    hitTest(x, y) {
      if (!this.alive) return false;
      const c = this.rig.hitCenter();
      return Math.hypot(x - c.x, y - c.y) < this.rig.hitRadius();
    }

    kill(world, how) {
      if (!this.alive) return;
      this.alive = false;
      this.state = 'dying';
      this.vy = -200;
      this.rig.flash = 1;
      this.rig.mode = 'hang';
      world.splat(this.rig.x, this.rig.y, 1);

      // Shot in the body while carrying: sac falls and lands, hatches in 3s unless popped
      if (this.hasSac) {
        this.hasSac = false;
        const abd = this.rig.abdomenCenter();
        world.spawnEgg(abd.x, abd.y, 'falling', { hatchAt: 3 });
      }
    }

    // The silhouette has to read at a glance: a spider carrying a pale
    // bundle. The sac sits on the abdomen, a silk band ties it on, and the
    // two back legs curl up and over it, tips hooked round its far end.
    draw(ctx, time) {
      ctx.save();
      ctx.globalAlpha = S.clamp(this.emerge * 1.5, 0, 1);
      this.rig.draw(ctx);

      if (this.hasSac && this.state !== 'dying') {
        const r = this.rig;
        const s = r.scale;
        const f = r.forward();
        const side = { x: -f.y, y: f.x };
        const abd = r.abdomenCenter();
        // The sac rides a little behind the abdomen's centre.
        const sac = { x: abd.x - f.x * 6 * s, y: abd.y - f.y * 6 * s };
        const pulse = 1 + Math.sin(this.aliveTime * 4.5) * 0.05;
        S.spiders.drawEggSac(ctx, sac.x, sac.y, {
          seed: this.seed,
          scale: 1.3,
          pulse,
          mode: 'wall',
          shadow: false,
          drawAttachment: false,
        });

        // A band of silk binding it on, across the middle.
        ctx.strokeStyle = S.rgba(P.silk, 0.6);
        ctx.lineWidth = 1.2;
        for (const k of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sac.x + side.x * 22 * s, sac.y + side.y * 22 * s);
          ctx.quadraticCurveTo(sac.x + f.x * k * 10 * s, sac.y + f.y * k * 10 * s, sac.x - side.x * 22 * s, sac.y - side.y * 22 * s);
          ctx.stroke();
        }

        // The curled back legs: hip → knee out beside the sac → tip hooked
        // over its far end. Two tapered segments each, with a sheen line.
        for (const leg of r.legs) {
          if (leg.index !== 3) continue;
          const hip = r.hip(leg);
          const sd = leg.side;
          const knee = {
            x: sac.x + side.x * sd * 34 * s + f.x * 6 * s,
            y: sac.y + side.y * sd * 34 * s + f.y * 6 * s,
          };
          const tip = {
            x: sac.x - f.x * 30 * s + side.x * sd * 8 * s,
            y: sac.y - f.y * 30 * s + side.y * sd * 8 * s,
          };
          const twitch = Math.sin(time * 3 + sd) * 1.5;
          S.paint.taperedLine(ctx, hip.x, hip.y, knee.x, knee.y + twitch, 6.5 * s, 5 * s, P.spiderBody);
          S.paint.taperedLine(ctx, knee.x, knee.y + twitch, tip.x, tip.y, 4.5 * s, 1.6 * s, P.spiderBody);
          ctx.strokeStyle = S.rgba(P.spiderSheen, 0.75);
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(hip.x, hip.y);
          ctx.lineTo(knee.x, knee.y + twitch);
          ctx.lineTo(tip.x, tip.y);
          ctx.stroke();
          ctx.fillStyle = P.spiderBody;
          ctx.beginPath();
          ctx.arc(knee.x, knee.y + twitch, 3.4 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
      void time;
    }
  }

  // ── Register spider type ──────────────────────────────────────────────

  S.registerSpiderType('eggCarrier', {
    quota: true,
    layer: () => 'wall',

    spawn({ world, rng, seed, opts }) {
      const L = world.layout;
      const count = sentSoFar(world);
      sentInto.set(world.stats, count + 1);

      const isFirst = opts.first ?? (count === 0);
      let lair = opts.lair;
      if (!lair) {
        if (isFirst && L.lairs) {
          lair = L.lairs.find((l) => l.door === 'B') || L.lairs[0];
        } else {
          lair = rng.pick(L.lairs);
        }
      }

      const speed = S.lerp(110, 170, world.stats.kills / world.rules.quota) * 0.75;
      const carrier = new EggCarrier({
        world,
        lair,
        area: L.wallArea,
        seed,
        speed,
        first: isFirst,
        emergeDuration: isFirst ? 1.2 : 0.8,
        opts,
      });

      if (opts.emerged) {
        carrier.emerge = 1;
        carrier.state = 'wandering';
      }
      if (opts.planting) {
        carrier.emerge = 1;
        carrier.state = 'planting';
        carrier.plantingTimer = opts.plantingTimer ?? 0.4;
      }
      if (opts.noSac) {
        carrier.hasSac = false;
        carrier.points = 120;
      }

      return carrier;
    },

    canSpawn(world) {
      if (sentSoFar(world) > 0) return true;
      return !world.critters.some((c) => c.alive && S.countsForQuota(c));
    },

    threat(carrier) {
      return carrier.alive ? carrier.rig.hitCenter() : null;
    },
  });

  S.spiders.EggCarrier = EggCarrier;
})();
