/*
 * Spyder — Room 10: the Web Weaver spider.
 *
 * Body: SpiderRig, scale 1.0, longer front legs (legReach 1.3 on front pair)
 * held up like a weaver's hands, spinnerets that glint; a slimmer abdomen
 * with a pale band pattern.
 *
 * Behaviour: Moves along walls and the gallery rail to a spot between two
 * anchor points (a corner, a gap between bookcases, the ladder top), stops,
 * and spins a new web over 3.5 s (the web grows ring by ring while it works;
 * the hero can interrupt it by hitting it or tearing the half-made web).
 * Then it moves on and repeats, up to 3 webs per Weaver.
 *
 * While spinning: holds still and is an easy target, but its new web catches
 * darts: each strand absorbs a dart unless it is the Web-Cutter.
 *
 * Points: 200; +80 for interrupting a web half-spun ("Unravelled!").
 *
 * Intro: The room's first Weaver appears alone on the gallery rail after
 * the first kill, spinning slowly (5 s) so the player sees what it does.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  const sentInto = new WeakMap();
  const sentSoFar = (world) => (world && world.stats ? (sentInto.get(world.stats) || 0) : 0);
  const bumpSent = (world) => {
    if (world && world.stats) sentInto.set(world.stats, sentSoFar(world) + 1);
  };

  class WebWeaver {
    constructor({ world, area, seed = 1, speed = 100, first = false, opts = {} }) {
      this.kind = 'webWeaver';
      this.points = 200;
      this.alive = true;
      this.done = false;
      this.seed = seed;
      this.area = area || { x0: 120, x1: 1500, y0: 110, y1: 770 };
      this.first = first;
      this.rng = S.createRng(seed);
      this.noise = S.createNoise(seed + 27);

      const spawnX = opts.x ?? (first ? 800 : this.rng.range(300, 1300));
      const spawnY = opts.y ?? (first ? 560 : (this.rng.chance(0.6) ? 560 : this.rng.range(250, 450)));

      // SpiderRig, scale 1.0, longer front legs (legReach 1.3 on front pair)
      this.rig = new S.SpiderRig({
        x: spawnX,
        y: spawnY,
        heading: 0,
        scale: 1.0,
        seed,
        legReach: [1.3, 1, 1, 1],
      });
      this.rig.mode = 'walk';

      this.baseSpeed = speed;
      this.websSpun = opts.websSpun ?? 0;
      this.maxWebs = 3;
      this.spinDuration = opts.spinDuration ?? (first ? 5.0 : 3.5);
      this.spinTimer = opts.spinTimer ?? 0;
      this.spinningWeb = null;
      this.allSegments = [];
      this.interrupted = false;
      this.vy = 0;
      this.timer = 0;

      // Anchor spots where webs can be spun
      this.anchorSpots = [
        { hub: [450, 500], anchors: [[320, 440], [580, 440], [580, 560], [320, 560]], rings: 5, closed: true },
        { hub: [800, 500], anchors: [[680, 440], [920, 440], [920, 560], [680, 560]], rings: 5, closed: true },
        { hub: [1150, 500], anchors: [[1020, 440], [1280, 440], [1280, 560], [1020, 560]], rings: 5, closed: true },
        { hub: [1420, 500], anchors: [[1350, 420], [1500, 420], [1500, 560], [1350, 560]], rings: 4, closed: false },
        { hub: [240, 280], anchors: [[140, 200], [340, 200], [340, 360], [140, 360]], rings: 4, closed: false },
      ];
      this.currentSpotIndex = first ? 1 : (opts.spotIndex ?? 0);

      this.state = opts.state ?? (opts.spinning || first ? 'spinning' : 'wandering');

      if (this.state === 'spinning') {
        this.startSpinning(world, this.currentSpotIndex);
        if (opts.spinTimer) this.spinTimer = opts.spinTimer;
      } else {
        this.pickNextSpot();
      }

      // Listen for darts to absorb them while spinning
      if (world && typeof world.on === 'function') {
        this._onDart = (payload) => this.onDart(payload, world);
        this._onTear = (payload) => this.onTear(payload, world);
        world.on('dart', this._onDart);
        world.on('tear', this._onTear);
      }
    }

    pickNextSpot() {
      if (this.websSpun >= this.maxWebs) {
        // Wandering freely once 3 webs are done
        const { x0, x1, y0, y1 } = this.area;
        this.target = {
          x: this.rng.range(x0 + 40, x1 - 40),
          y: this.rng.chance(0.6) ? 560 : this.rng.range(y0 + 30, y1 - 30),
        };
        return;
      }
      this.currentSpotIndex = (this.currentSpotIndex + 1) % this.anchorSpots.length;
      const spot = this.anchorSpots[this.currentSpotIndex];
      this.target = { x: spot.hub[0], y: spot.hub[1] };
    }

    startSpinning(world, spotIndex = 0) {
      if (this.websSpun >= this.maxWebs) return;
      const spot = this.anchorSpots[spotIndex % this.anchorSpots.length];
      this.rig.x = spot.hub[0];
      this.rig.y = spot.hub[1];
      this.rig.vx = 0;
      this.rig.vy = 0;
      this.state = 'spinning';
      this.spinTimer = 0;
      this.interrupted = false;

      // Create new Web
      const web = new S.Web({
        hub: spot.hub,
        anchors: spot.anchors,
        rings: spot.rings,
        closed: spot.closed,
        sheet: 0.35,
        seed: this.seed + this.websSpun * 37 + 1,
      });

      // Save full segments list and reveal ring by ring
      this.allSegments = [...web.segments];
      web.segments = [];
      this.spinningWeb = web;

      if (world && typeof world.addWeb === 'function') {
        world.addWeb(web);
      }
    }

    updateSpinningWeb(dt, world) {
      if (!this.spinningWeb) return;
      this.spinTimer += dt;
      const p = Math.min(1, this.spinTimer / this.spinDuration);

      // Web grows ring by ring as progress advances
      const targetCount = Math.min(this.allSegments.length, Math.floor(p * this.allSegments.length));
      this.spinningWeb.segments = this.allSegments.slice(0, targetCount);

      if (this.spinTimer >= this.spinDuration) {
        // Fully spun!
        this.spinningWeb.segments = this.allSegments;
        this.spinningWeb = null;
        this.websSpun++;
        this.state = 'wandering';
        this.timer = 0;
        this.pickNextSpot();
      }
    }

    onDart(payload, world) {
      if (!this.alive || this.state !== 'spinning' || !this.spinningWeb) return false;
      const dart = payload?.dart;
      if (!dart) return false;

      // While spinning: its new web catches darts (absorbs dart unless Web-Cutter)
      const torn = this.spinningWeb.tear(dart.px, dart.py, dart.x, dart.y, world.time, 34);
      if (torn && torn.length > 0) {
        for (const t of torn.slice(0, 3)) world.burst.fibres(t.x, t.y, 4);
        world.audio.play('rip', 0.6);
        this.interruptSpin(world, true);
        return true; // Consumes the dart!
      }
      return false;
    }

    onTear(payload, world) {
      if (!this.alive || this.state !== 'spinning' || !this.spinningWeb) return;
      if (payload?.web === this.spinningWeb) {
        // Hero tore the half-made web!
        this.interruptSpin(world, true);
      }
    }

    interruptSpin(world, awardBonus = true) {
      if (this.interrupted || this.state !== 'spinning') return;
      this.interrupted = true;

      if (awardBonus && world) {
        world.award(80, this.rig.x, this.rig.y - 30, 'Unravelled!');
        world.audio.play('rip', 0.8);
      }

      if (this.spinningWeb) {
        // Strands of half-made web disintegrate
        for (const seg of this.spinningWeb.segments) seg.alive = false;
        if (world && world.burst) world.burst.fibres(this.rig.x, this.rig.y, 10);
        this.spinningWeb = null;
      }

      this.state = 'wandering';
      this.timer = 0;
      this.pickNextSpot();
    }

    kill(world) {
      if (!this.alive) return;
      this.alive = false;
      const wasSpinning = (this.state === 'spinning');

      if (wasSpinning) {
        this.interruptSpin(world, false);
      }

      this.state = 'dying';
      this.vy = -200;
      this.rig.flash = 1;
      this.rig.mode = 'hang';
      if (world && world.splat) world.splat(this.rig.x, this.rig.y, 1);

      if (wasSpinning) {
        return { bonus: 80, label: 'Unravelled!' };
      }
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

      if (this.state === 'spinning') {
        r.vx = 0;
        r.vy = 0;
        // Front legs held up and weaving
        r.breath = Math.sin(world.time * 9);
        this.updateSpinningWeb(dt, world);
      } else {
        // Wandering along walls and gallery rail
        const toX = this.target.x - r.x;
        const toY = this.target.y - r.y;
        const dist = Math.hypot(toX, toY);

        if (dist < 25) {
          if (this.websSpun < this.maxWebs) {
            this.startSpinning(world, this.currentSpotIndex);
          } else {
            this.pickNextSpot();
          }
        } else {
          const want = Math.atan2(toY, toX);
          r.heading += S.clamp(S.angleDelta(r.heading, want), -3.2 * dt, 3.2 * dt);
          const speed = this.baseSpeed * (0.8 + 0.4 * Math.max(0, this.noise(world.time * 0.8)));
          r.vx = Math.cos(r.heading) * speed;
          r.vy = Math.sin(r.heading) * speed;
          r.x += r.vx * dt;
          r.y += r.vy * dt;
          r.x = S.clamp(r.x, this.area.x0, this.area.x1);
          r.y = S.clamp(r.y, this.area.y0, this.area.y1);
        }
      }

      r.glint = world.light ? world.light.brightnessAt(r.x, r.y) + 0.3 : 0.6;
      r.update(dt, world.time);
    }

    // The Weaver: a slimmer abdomen banded in pale rings instead of the
    // common chevrons, spinnerets that glint at its tail, and front legs a
    // third longer than the rest. While it spins, those front legs are held
    // up and work in turn like a weaver's hands, each drawing a line of silk
    // from the spinnerets out to the web growing in front of it.
    draw(ctx, t) {
      const r = this.rig;
      const spinning = this.state === 'spinning' && this.spinningWeb;
      const front = r.legs.filter((leg) => leg.index === 0);
      const saved = front.map((leg) => leg.foot);
      let active = null;
      if (spinning) {
        const f = r.forward();
        const ceph = r.cephCenter();
        const phase = Math.sin((t ?? 0) * 7);
        for (const leg of front) {
          const up = leg.side * phase > 0;
          const reach = r.reachOf(0) * (up ? 0.85 : 0.62);
          const side = leg.side * (up ? 0.35 : 0.75);
          const a = r.heading + side;
          leg.foot = { x: ceph.x + Math.cos(a) * reach, y: ceph.y + Math.sin(a) * reach - (up ? 10 : 0) };
          if (up) active = leg.foot;
          void f;
        }
      }
      // Shadow on the wall, as the rig draws it.
      const off = 8 + r.lift * 18;
      ctx.save();
      ctx.globalAlpha = 0.24 - r.lift * 0.1;
      ctx.translate(off * 0.6, off);
      r.drawLegs(ctx, true);
      this.drawWeaverBody(ctx, true);
      ctx.restore();
      r.drawLegs(ctx, false);
      this.drawWeaverBody(ctx, false);
      if (r.flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = r.flash;
        this.drawWeaverBody(ctx, false, '#ffffff');
        ctx.restore();
      }
      // The spinnerets, glinting.
      const abd = r.abdomenCenter();
      const tail = { x: abd.x - Math.cos(r.heading) * 30 * r.scale, y: abd.y - Math.sin(r.heading) * 30 * r.scale };
      const glint = 0.5 + 0.5 * Math.sin((t ?? 0) * 5 + this.seed);
      ctx.fillStyle = S.rgba(P.silk, 0.6 + 0.4 * glint);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(tail.x - Math.sin(r.heading) * 4 * s, tail.y + Math.cos(r.heading) * 4 * s, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Silk drawn out by the working leg: spinnerets → foot → the web.
      if (spinning && active) {
        const web = this.spinningWeb;
        const hub = Array.isArray(web.hub) ? { x: web.hub[0], y: web.hub[1] } : web.hub || null;
        ctx.strokeStyle = S.rgba(P.silk, 0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.quadraticCurveTo((tail.x + active.x) / 2, Math.max(tail.y, active.y) + 18, active.x, active.y);
        if (hub) ctx.lineTo(hub.x, hub.y);
        ctx.stroke();
      }
      front.forEach((leg, i) => {
        leg.foot = saved[i];
      });
    }

    // The body: the rig's head and eyes, and an abdomen of its own — longer
    // and slimmer, with pale bands across it.
    drawWeaverBody(ctx, asShadow, override = null) {
      const r = this.rig;
      const s = r.scale;
      const abd = r.abdomenCenter();
      const ceph = r.cephCenter();
      const base = override || (asShadow ? '#000000' : P.spiderBody);
      const pulse = 1 + Math.sin(r.breath * 3) * 0.025;
      ctx.save();
      ctx.translate(abd.x, abd.y);
      ctx.rotate(r.heading);
      ctx.scale(pulse, pulse);
      const rx = 38 * s;
      const ry = 17 * s;
      if (asShadow || override) {
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.ellipse(-4 * s, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(-rx * 0.1, -ry * 0.5, 2, 0, 0, rx * 1.1);
        g.addColorStop(0, S.shade(P.spiderBody, 0.25));
        g.addColorStop(0.55, P.spiderBody);
        g.addColorStop(1, P.soot);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(-4 * s, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.clip();
        for (const bx of [-26, -14, -2, 10]) {
          ctx.strokeStyle = S.rgba(P.spiderMark, 0.7);
          ctx.lineWidth = 3 * s;
          ctx.beginPath();
          ctx.ellipse(bx * s, 0, 4 * s, ry * 1.1, 0, -Math.PI / 2, Math.PI / 2);
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = S.rgba(P.spiderSheen, 0.5);
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        ctx.ellipse(-4 * s, 0, rx * 0.9, ry * 0.75, 0, Math.PI * 1.1, Math.PI * 1.7);
        ctx.stroke();
      }
      ctx.restore();
      // The head: a smaller, rounder cephalothorax, and the eyes.
      ctx.save();
      ctx.translate(ceph.x, ceph.y);
      ctx.rotate(r.heading);
      ctx.fillStyle = asShadow || override ? base : S.shade(P.spiderBody, 0.06);
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * s, 15 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // drawEyes works in the head's own frame, given its half-size.
      if (!asShadow && !override) r.drawEyes(ctx, 18 * s, 15 * s);
      ctx.restore();
    }
  }

  S.registerSpiderType('webWeaver', {
    quota: true,
    layer: () => 'room',

    spawn({ world, rng, seed, opts }) {
      const isFirst = sentSoFar(world) === 0;
      bumpSent(world);

      const L = world.layout;
      const weaver = new WebWeaver({
        world,
        area: L.wallArea || { x0: 120, x1: 1500, y0: 110, y1: 770 },
        seed,
        speed: S.lerp(100, 140, world.stats.kills / world.rules.quota),
        first: isFirst,
        opts,
      });

      return weaver;
    },

    canSpawn(world) {
      if (sentSoFar(world) > 0) return true;
      // First Weaver: appears alone on the gallery rail after the first kill
      if (world.stats.kills < 1) return false;
      return !world.critters.some((c) => c.alive && S.countsForQuota(c));
    },

    threat(weaver) {
      return weaver.alive ? weaver.rig.hitCenter() : null;
    },
  });

  S.spiders.WebWeaver = WebWeaver;
})();
