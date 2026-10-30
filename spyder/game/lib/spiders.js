/*
 * Spyder — spider behaviours.
 *
 * All of these drive the same SpiderRig; only the brain differs.
 *
 *   StringSpider  drops from the ceiling on silk, hovers, drops eggs,
 *                 lunges if you stand right under it. Shoot the body,
 *                 or snip the silk above it for a bonus.
 *   WallCrawler   creeps out of a gap in the wall, wanders, freezes,
 *                 and lays egg sacs on the wallpaper.
 *   Hatchling     tiny, fast, runs along the floor at your ankles.
 *                 Pop it with a dart or stomp it.
 *   EggSac        falls from a StringSpider (or sits on the wall) and
 *                 hatches if you leave it alone.
 *
 * Each entity exposes: update(dt, world), draw(ctx), hitTest(x, y),
 * hit(world) and an `alive` / `done` pair the scene uses for cleanup.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  // ── String spider ────────────────────────────────────────────────────

  class StringSpider {
    constructor({ x, ceiling, targetY, seed, aggression = 0.5 }) {
      this.kind = 'string';
      this.points = 100;
      this.anchorX = x;
      this.ceiling = ceiling;
      this.targetY = targetY;
      this.aggression = aggression;
      this.rng = S.createRng(seed);
      this.noise = S.createNoise(seed + 3);
      this.rig = new S.SpiderRig({ x, y: ceiling - 40, heading: Math.PI / 2, scale: 1.0, seed });
      this.rig.mode = 'hang';
      this.rig.lift = 1;
      this.state = 'descending';
      this.timer = 0;
      this.hoverFor = this.rng.range(2.2, 4.2);
      this.eggCooldown = this.rng.range(1.2, 2.5);
      this.alive = true;
      this.done = false;
      this.vy = 0;
      this.spin = 0;
    }

    // Top end of the silk where it leaves the spider's spinnerets.
    silkEnd() {
      const r = this.rig;
      return { x: r.x - Math.cos(r.heading) * 50 * r.scale, y: r.y - Math.sin(r.heading) * 50 * r.scale };
    }

    update(dt, world) {
      const r = this.rig;
      this.timer += dt;
      const sway = this.noise(world.time * 0.5) * 22;

      switch (this.state) {
        case 'descending': {
          // Fast at first, braking near the target — feels like a decision.
          const gap = this.targetY - r.y;
          r.y += Math.max(40, gap * 2.4) * dt;
          r.x = this.anchorX + sway * S.invLerp(this.ceiling, this.targetY, r.y);
          if (gap < 3) {
            this.state = 'hovering';
            this.timer = 0;
            world.sfx('creak', 0.3);
          }
          break;
        }
        case 'hovering': {
          r.y = this.targetY + Math.sin(this.timer * 2.2) * 8;
          r.x = this.anchorX + sway;
          this.eggCooldown -= dt;
          const hero = world.hero;
          const below = Math.abs(hero.x - r.x) < 140 && hero.y > r.y;

          if (below && this.eggCooldown <= 0) {
            world.spawnEgg(r.x, r.y + 20, 'falling');
            this.eggCooldown = this.rng.range(2.6, 4);
          }
          // Lunge when the hero is directly underneath and close.
          if (below && Math.abs(hero.x - r.x) < 60 && this.rng.chance(this.aggression * dt)) {
            this.state = 'lunging';
            this.timer = 0;
            this.lungeFrom = r.y;
            this.lungeTo = Math.min(hero.y - 120, r.y + 240);
            world.sfx('hiss', 0.5);
          }
          if (this.timer > this.hoverFor) {
            this.state = 'ascending';
          }
          break;
        }
        case 'lunging': {
          const t = Math.min(1, this.timer / 0.35);
          const k = t < 0.5 ? S.ease.out(t * 2) : 1 - S.ease.inOut((t - 0.5) * 2) * 0.6;
          r.y = S.lerp(this.lungeFrom, this.lungeTo, k);
          if (t >= 1) {
            this.state = 'hovering';
            this.timer = 0;
            this.targetY = r.y;
          }
          break;
        }
        case 'ascending': {
          r.y -= 220 * dt;
          r.x = this.anchorX + sway * 0.5;
          if (r.y < this.ceiling - 60) this.done = true; // escaped, comes back later
          break;
        }
        case 'falling': {
          // Silk was cut, or it was shot: tumble down.
          this.vy += 1800 * dt;
          r.y += this.vy * dt;
          r.heading += this.spin * dt;
          if (!this.alive) r.curl = Math.min(1, r.curl + dt * 5);
          const floor = world.floorAt(r.x, r.y - 20);
          if (floor !== null && r.y > floor - 10) {
            world.splat(r.x, floor - 10, 1.2);
            this.done = true;
          }
          break;
        }
      }

      r.glint = world.light.brightnessAt(r.x, r.y) + 0.35;
      r.update(dt, world.time);
    }

    hitTest(x, y) {
      if (!this.alive) return false;
      const c = this.rig.hitCenter();
      return Math.hypot(x - c.x, y - c.y) < this.rig.hitRadius();
    }

    // Does a dart path cross the silk above us?
    silkTest(ax, ay, bx, by) {
      if (!this.alive || this.state === 'falling') return null;
      const end = this.silkEnd();
      return S.segmentIntersection(ax, ay, bx, by, this.anchorX, this.ceiling, end.x, end.y - 8);
    }

    kill(world, how = 'shot') {
      if (!this.alive) return;
      this.alive = false;
      this.state = 'falling';
      this.vy = how === 'cut' ? 0 : -260;
      this.spin = this.rng.range(-5, 5);
      this.rig.flash = 1;
      world.splat(this.rig.x, this.rig.y, how === 'cut' ? 0.4 : 1);
    }

    draw(ctx, time) {
      const r = this.rig;
      // Silk thread to the ceiling. It catches light as a thin bright line.
      if (this.state !== 'falling') {
        const end = this.silkEnd();
        ctx.strokeStyle = S.rgba(P.silk, 0.55);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(this.anchorX, this.ceiling);
        ctx.quadraticCurveTo(S.lerp(this.anchorX, end.x, 0.5) + Math.sin(time * 2) * 3, (this.ceiling + end.y) / 2, end.x, end.y);
        ctx.stroke();
      }
      r.draw(ctx);
    }
  }

  // ── Wall crawler ──────────────────────────────────────────────────────

  class WallCrawler {
    constructor({ lair, area, seed, speed = 120 }) {
      this.kind = 'crawler';
      this.points = 150;
      this.area = area;
      this.rng = S.createRng(seed);
      this.noise = S.createNoise(seed + 11);
      this.rig = new S.SpiderRig({ x: lair.x, y: lair.y, heading: -Math.PI / 2 + this.rng.range(-0.6, 0.6), scale: 1.15, seed });
      this.rig.mode = 'walk';
      this.baseSpeed = speed;
      this.state = 'emerging';
      this.timer = 0;
      this.emerge = 0;
      this.pickTarget();
      this.eggTimer = this.rng.range(5, 9);
      this.alive = true;
      this.done = false;
      this.vy = 0;
    }

    pickTarget() {
      const { x0, x1, y0, y1 } = this.area;
      this.target = { x: this.rng.range(x0 + 40, x1 - 40), y: this.rng.range(y0 + 30, y1 - 30) };
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

      if (this.state === 'emerging') {
        this.emerge = Math.min(1, this.emerge + dt * 1.4);
        if (this.emerge >= 1) this.state = 'wandering';
      }

      if (this.state === 'frozen') {
        // Spiders that go perfectly still are the scariest ones.
        r.vx = r.vy = 0;
        if (this.timer > this.freezeFor) {
          this.state = 'wandering';
          this.timer = 0;
        }
      } else {
        const toX = this.target.x - r.x;
        const toY = this.target.y - r.y;
        const d = Math.hypot(toX, toY);
        if (d < 30) {
          this.pickTarget();
          if (this.rng.chance(0.45)) {
            this.state = 'frozen';
            this.freezeFor = this.rng.range(0.6, 1.8);
            this.timer = 0;
          }
        }
        // Turn toward the target smoothly, then walk where we face.
        const want = Math.atan2(toY, toX);
        r.heading += S.clamp(S.angleDelta(r.heading, want), -3 * dt, 3 * dt);
        // Speed surges and stalls: never a constant robotic glide.
        const surge = 0.6 + 0.8 * Math.max(0, this.noise(world.time * 0.9));
        const speed = this.baseSpeed * surge * (this.state === 'emerging' ? 0.5 : 1);
        r.vx = Math.cos(r.heading) * speed;
        r.vy = Math.sin(r.heading) * speed;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.x = S.clamp(r.x, this.area.x0, this.area.x1);
        r.y = S.clamp(r.y, this.area.y0, this.area.y1);
      }

      this.eggTimer -= dt;
      if (this.eggTimer <= 0 && this.state !== 'emerging') {
        world.spawnEgg(r.x - Math.cos(r.heading) * 40, r.y - Math.sin(r.heading) * 40, 'wall');
        this.eggTimer = this.rng.range(7, 11);
      }

      r.scale = 1.15 * S.lerp(0.55, 1, S.ease.out(this.emerge));
      r.glint = world.light.brightnessAt(r.x, r.y) + 0.25;
      r.update(dt, world.time);
    }

    hitTest(x, y) {
      if (!this.alive) return false;
      const c = this.rig.hitCenter();
      return Math.hypot(x - c.x, y - c.y) < this.rig.hitRadius();
    }

    kill(world) {
      if (!this.alive) return;
      this.alive = false;
      this.state = 'dying';
      this.vy = -200;
      this.rig.flash = 1;
      this.rig.mode = 'hang';
      world.splat(this.rig.x, this.rig.y, 1);
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = S.clamp(this.emerge * 1.5, 0, 1);
      this.rig.draw(ctx);
      ctx.restore();
    }
  }

  // ── Hatchling ─────────────────────────────────────────────────────────

  class Hatchling {
    constructor({
      x,
      y,
      groundY,
      seed = 1,
      fromWall = false,
      originX,
      originY,
      offsetX,
      laneY = 0,
      scatterPitch = 0,
      dir,
      delay = 0,
      speedScale = 1,
    }) {
      this.kind = 'hatchling';
      this.points = 40;
      this.rng = S.createRng(seed);
      this.originX = originX ?? x;
      this.originY = originY ?? y;
      this.offsetX = offsetX ?? 0;
      this.laneY = laneY;
      this.scatterPitch = scatterPitch;
      this.fromEgg = originX !== undefined || delay > 0;
      this.delay = delay;
      this.age = 0;

      // Individual x-offset for wall abseiling (±40 px around the sac)
      const wallOff = offsetX !== undefined ? S.clamp(offsetX, -40, 40) : this.rng.range(-36, 36);
      this.abseilX = this.originX + (fromWall ? wallOff : 0);
      this.anchorY = this.originY + (fromWall ? this.rng.range(-6, 8) : 0);

      // Initial scatter direction so hatchlings fan out instead of moving as a block
      this.scatterDir = dir ?? this.rng.pick([-1, 1]);
      this.scatterDuration = this.rng.range(0.75, 0.95);
      this.scatterVy = fromWall ? 0 : this.rng.range(-150, -70);

      const startX = delay > 0 ? this.originX + this.offsetX : x;
      const startY = delay > 0 ? this.originY - 4 : y;
      const initHeading = fromWall
        ? Math.PI / 2
        : this.scatterDir > 0
          ? this.scatterPitch
          : Math.PI - this.scatterPitch;

      this.rig = new S.SpiderRig({ x: startX, y: startY, heading: initHeading, scale: 0.4, seed, markings: false });
      this.rig.mode = fromWall ? 'hang' : 'walk';
      this.fromWall = fromWall;
      this.dropping = fromWall;
      this.groundY = groundY;
      this.alive = true;
      this.done = false;

      // Base speed ~190 with ±35% per-hatchling variation (or caller-provided speedScale)
      const baseSpeed = 190 * (speedScale !== undefined ? speedScale : 1 + this.rng.range(-0.35, 0.35));
      this.speed = S.clamp(baseSpeed, 75, 310);
      this.dropSpeed = this.rng.range(190, 290) * S.clamp(speedScale || 1, 0.5, 1.5);
      this.jitter = S.createNoise(seed + 2);
      this.zigPhase = this.rng.range(0, 100);
      this.vy = 0;
    }

    get emerging() {
      return this.age < this.delay;
    }

    update(dt, world) {
      const r = this.rig;
      if (!this.alive) {
        r.curl = Math.min(1, r.curl + dt * 6);
        this.fade = (this.fade || 1) - dt * 2.5;
        if (this.fade <= 0) this.done = true;
        r.update(dt, world.time);
        return;
      }

      this.age += dt;
      if (this.age < this.delay) {
        // Crawling up to the tear at the top of the egg sac before emerging.
        const peek = S.invLerp(this.delay - 0.12, this.delay, this.age);
        r.x = this.originX + this.offsetX * peek;
        r.y = this.originY - 6 + this.laneY * 0.25 * peek;
        r.scale = 0.4 * S.lerp(0.55, 1, peek);
        return;
      }
      r.scale = 0.4;
      const activeAge = this.age - this.delay;

      if (this.dropping) {
        // Skitter sideways to our own thread anchor, then abseil down to the floor.
        const spreadT = S.clamp(activeAge / 0.18, 0, 1);
        r.x = S.lerp(this.originX, this.abseilX, S.ease.out(spreadT));
        if (activeAge < 0.12) {
          r.y = S.lerp(this.originY - 8, this.anchorY, activeAge / 0.12);
        } else {
          r.y += this.dropSpeed * dt;
        }
        const floor = world.floorAt(r.x, r.y);
        if (floor !== null && r.y >= floor - 8) {
          r.y = floor - 8;
          this.dropping = false;
          r.mode = 'walk';
          r.plantAll();
        }
      } else {
        const hero = world.hero;
        // First ~0.85s after emerging: scatter outward in our own diagonal direction.
        const scattering = activeAge < this.scatterDuration && this.fromEgg;
        const dir = scattering ? this.scatterDir : Math.sign(hero.x - r.x) || this.scatterDir;
        const zig = this.jitter(world.time * 3.4 + this.zigPhase) * (scattering ? 0.18 : 0.95);
        const pitch = scattering ? this.scatterPitch : 0;
        const targetHeading = dir > 0 ? pitch + zig * 0.55 : Math.PI - pitch - zig * 0.55;
        r.heading = S.damp(r.heading, targetHeading, 14, dt);
        const burstMult = scattering ? 0.54 : 1;
        r.vx = Math.cos(r.heading) * this.speed * burstMult;
        r.vy = 0;
        r.x += r.vx * dt;
        const floor = world.floorAt(r.x, r.y - 40);
        if (floor !== null) {
          const baseFloorY = this.fromEgg ? this.originY : floor - 8;
          if (scattering) {
            const spreadK = S.ease.out(S.clamp(activeAge / 0.48, 0, 1));
            const hop = activeAge < 0.2 ? Math.sin((activeAge / 0.2) * Math.PI) * 6 : 0;
            r.y = baseFloorY + this.laneY * spreadK - hop;
          } else {
            const settleK = S.clamp((activeAge - this.scatterDuration) / 0.45, 0, 1);
            r.y = S.lerp(baseFloorY + this.laneY, floor - 8, settleK);
          }
        }
      }
      r.glint = world.light.brightnessAt(r.x, r.y) + 0.3;
      r.update(dt, world.time);
    }

    hitTest(x, y) {
      if (!this.alive || this.age < this.delay) return false;
      return Math.hypot(x - this.rig.x, y - this.rig.y) < 26;
    }

    kill(world) {
      if (!this.alive) return;
      this.alive = false;
      this.rig.flash = 1;
      world.splat(this.rig.x, this.rig.y, 0.4);
    }

    draw(ctx, time) {
      if (this.age < this.delay - 0.12) return;
      const emergeAlpha = this.delay > 0 ? S.invLerp(this.delay - 0.12, this.delay, this.age) : 1;
      if (this.dropping && this.age >= this.delay) {
        ctx.strokeStyle = S.rgba(P.silk, 0.48);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(this.abseilX, this.anchorY);
        ctx.lineTo(this.rig.x, this.rig.y - 5);
        ctx.stroke();
      }
      ctx.save();
      const baseAlpha = this.fade === undefined ? 1 : Math.max(0, this.fade);
      ctx.globalAlpha = baseAlpha * emergeAlpha;
      this.rig.draw(ctx);
      ctx.restore();
      void time;
    }
  }

  // ── Egg sac ───────────────────────────────────────────────────────────

  function teardropPoint(a, bulge = 0, bulgeSide = 1, bulgeAngle = 0) {
    const rx = 12.5;
    const ry = 15.5;
    // Narrow at the top tip (a = 0), fuller in the lower belly (a ~ 2.1).
    const belly = 0.68 - 0.3 * Math.cos(a) + 0.08 * Math.sin(a * 2);
    let x = Math.sin(a) * rx * belly;
    let y = -Math.cos(a) * ry + 1.5;
    if (bulge > 0) {
      const sideMatch = Math.max(0, Math.sin(a) * bulgeSide);
      const vertMatch = Math.max(0, Math.sin(a - bulgeAngle));
      const push = bulge * sideMatch * (0.45 + 0.55 * vertMatch);
      x += bulgeSide * push * 4.2;
      y += push * 1.4;
    }
    return { x, y };
  }

  function buildOutline(bulge = 0, bulgeSide = 1, bulgeAngle = 0) {
    const pts = [];
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = teardropPoint(a, bulge, bulgeSide, bulgeAngle);
      pts.push([p.x, p.y]);
    }
    return pts;
  }

  function generateEggSacElements(seed) {
    const rng = S.createRng(seed || 1);
    const bulgeSide = rng.pick([-1, 1]);
    const bulgeAngle = rng.range(-0.35, 0.45);
    const innerEggs = [];
    const eggCount = 16;
    for (let i = 0; i < eggCount; i++) {
      const frac = (i + 0.5) / eggCount;
      const ang = i * 2.39996 + rng.range(-0.2, 0.2);
      const rad = Math.sqrt(frac) * 8.2;
      const ex = Math.cos(ang) * rad * 0.92;
      const ey = 2.5 + Math.sin(ang) * rad * 1.05;
      innerEggs.push({
        x: ex,
        y: ey,
        r: rng.range(2.1, 2.9),
        phase: rng.range(0, Math.PI * 2),
        shade: rng.range(-0.08, 0.08),
      });
    }
    const strands = [];
    for (let i = 0; i < 12; i++) {
      const a0 = rng.range(0.35, Math.PI * 2 - 0.35);
      const a1 = a0 + rng.range(1.6, 3.6);
      strands.push({
        a0,
        a1,
        bend: rng.range(-5, 5),
        alpha: rng.range(0.36, 0.58),
        width: rng.range(0.7, 1.25),
      });
    }
    const fibres = [];
    for (let i = 0; i < 7; i++) {
      const a = rng.range(0.3, Math.PI * 2 - 0.3);
      fibres.push({
        a,
        len: rng.range(3.5, 6.5),
        curl: rng.range(-0.6, 0.6),
        alpha: rng.range(0.35, 0.55),
      });
    }
    return { innerEggs, strands, fibres, bulgeSide, bulgeAngle };
  }

  function drawEggSac(ctx, x, y, opts = {}) {
    const seed = opts.seed ?? 1;
    const mode = opts.mode ?? 'wall';
    const scale = opts.scale ?? 1;
    const wobble = opts.wobble ?? 0;
    const pulse = opts.pulse ?? 1;
    const bulge = opts.bulge ?? 0;
    const late = opts.late ?? 0;
    const left = opts.left ?? 999;
    const rate = opts.rate ?? 1;
    const age = opts.age ?? 0;

    let { innerEggs, strands, fibres, bulgeSide, bulgeAngle } = opts;
    if (!innerEggs || !strands || !fibres) {
      const gen = generateEggSacElements(seed);
      innerEggs = innerEggs || gen.innerEggs;
      strands = strands || gen.strands;
      fibres = fibres || gen.fibres;
      if (bulgeSide === undefined) bulgeSide = gen.bulgeSide;
      if (bulgeAngle === undefined) bulgeAngle = gen.bulgeAngle;
    }
    if (bulgeSide === undefined) bulgeSide = 1;
    if (bulgeAngle === undefined) bulgeAngle = 0;

    ctx.save();
    ctx.translate(x, y);

    if (opts.shadow !== false) {
      if (mode === 'resting') {
        S.paint.softShadow(ctx, 2, 13, 23 * scale, 6 * scale, 0.42);
      } else if (mode === 'wall') {
        S.paint.softShadow(ctx, 4, 14, 18 * scale, 7 * scale, 0.3);
      }
    }

    if (typeof opts.drawAttachment === 'function') {
      opts.drawAttachment(ctx);
    }

    ctx.rotate(wobble * 0.14);
    const flatX = mode === 'resting' ? 1.15 : 1;
    const flatY = mode === 'resting' ? 0.85 : 1;
    ctx.scale(flatX * pulse * scale, (flatY / pulse) * scale);

    const outline = buildOutline(bulge, bulgeSide, bulgeAngle);

    // 1. Base silk body: radial gradient from bone → eggSac → darker rim
    const g = ctx.createRadialGradient(-4, -5, 2, 0, 2, 18);
    g.addColorStop(0, S.mixHex(P.bone, P.eggSac, late * 0.35));
    g.addColorStop(0.62, S.mixHex(P.eggSac, '#B9AA8E', late * 0.3));
    g.addColorStop(1, '#7B6E56');
    ctx.fillStyle = g;
    S.paint.wobblyPath(ctx, outline, { wobble: 1.25, step: 8, seed, closed: true });
    ctx.fill();

    // 2. Clip to the sac outline to draw the internal egg cluster & wrapping strands
    ctx.save();
    S.paint.wobblyPath(ctx, outline, { wobble: 1.25, step: 8, seed, closed: true });
    ctx.clip();

    const eggAlpha = S.lerp(0.24, 0.68, late);
    const eggTone = S.mixHex('#8A7558', '#2A1E1A', late * 0.85);
    const eggRim = S.mixHex('#B8A484', '#4B362E', late * 0.75);
    for (let i = 0; i < innerEggs.length; i++) {
      const e = innerEggs[i];
      const jostle = late * 2.1;
      const jx = Math.sin(age * (rate * 0.85) + e.phase) * jostle;
      const jy = Math.cos(age * (rate * 0.95) + e.phase * 1.3) * jostle * 0.85;
      const ex = e.x + jx + (e.x * bulgeSide > 0 ? bulge * bulgeSide * 2.2 : 0);
      const ey = e.y + jy;

      ctx.fillStyle = S.rgba(S.shade(eggTone, e.shade), eggAlpha);
      ctx.beginPath();
      ctx.arc(ex, ey, e.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = S.rgba(eggRim, eggAlpha * 0.55);
      ctx.lineWidth = 0.6;
      ctx.stroke();

      ctx.fillStyle = S.rgba(P.bone, (1 - late * 0.45) * 0.22);
      ctx.beginPath();
      ctx.arc(ex - e.r * 0.3, ey - e.r * 0.3, e.r * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }

    const veilAlpha = S.lerp(0.32, 0.06, late);
    if (veilAlpha > 0.01) {
      const veil = ctx.createRadialGradient(-3, -4, 1, 0, 2, 16);
      veil.addColorStop(0, S.rgba(P.bone, veilAlpha));
      veil.addColorStop(1, S.rgba(P.eggSac, veilAlpha * 0.5));
      ctx.fillStyle = veil;
      ctx.fillRect(-20, -20, 40, 40);
    }

    const strandFade = S.lerp(1, 0.68, late);
    for (const st of strands) {
      const p0 = teardropPoint(st.a0, bulge, bulgeSide, bulgeAngle);
      const p1 = teardropPoint(st.a1, bulge, bulgeSide, bulgeAngle);
      const mx = (p0.x + p1.x) * 0.5 + st.bend * 0.6;
      const my = (p0.y + p1.y) * 0.5 + st.bend;
      ctx.strokeStyle = S.rgba(P.bone, st.alpha * strandFade);
      ctx.lineWidth = st.width;
      ctx.beginPath();
      ctx.moveTo(p0.x * 1.05, p0.y * 1.05);
      ctx.quadraticCurveTo(mx, my, p1.x * 1.05, p1.y * 1.05);
      ctx.stroke();
    }

    if (mode !== 'falling' && left < 0.6) {
      const tear = S.invLerp(0.6, 0, left);
      const w = 1.2 + tear * 4.2;
      const len = 6 + tear * 11;
      ctx.fillStyle = '#181210';
      ctx.beginPath();
      ctx.moveTo(0, -14.5);
      ctx.lineTo(-w, -14.5 + len * 0.45);
      ctx.lineTo(-w * 0.5, -14.5 + len);
      ctx.lineTo(0, -14.5 + len + 2);
      ctx.lineTo(w * 0.6, -14.5 + len * 0.85);
      ctx.lineTo(w, -14.5 + len * 0.4);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = S.rgba(P.bone, 0.65);
      ctx.lineWidth = 0.75;
      for (let k = 0; k < 3; k++) {
        const ty = -12 + k * (len * 0.28);
        ctx.beginPath();
        ctx.moveTo(-w, ty);
        ctx.lineTo(w, ty + 1);
        ctx.stroke();
      }
    }

    ctx.restore();

    // 3. Soft outer rim and loose silk fibres sticking out of the outline
    ctx.strokeStyle = S.rgba('#6E624C', 0.55);
    ctx.lineWidth = 1.0;
    S.paint.wobblyPath(ctx, outline, { wobble: 1.25, step: 8, seed, closed: true });
    ctx.stroke();

    ctx.lineCap = 'round';
    for (const fb of fibres) {
      const p = teardropPoint(fb.a, bulge, bulgeSide, bulgeAngle);
      const nx = Math.sin(fb.a);
      const ny = -Math.cos(fb.a);
      const tx = Math.sin(fb.a + fb.curl);
      const ty = -Math.cos(fb.a + fb.curl);
      ctx.strokeStyle = S.rgba(P.bone, fb.alpha);
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(
        p.x + nx * fb.len * 0.55,
        p.y + ny * fb.len * 0.55,
        p.x + tx * fb.len,
        p.y + ty * fb.len
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  class EggSac {
    constructor({ x, y, mode, seed = 1, hatchAt, hatchCount, hatchSpeed }) {
      this.kind = 'egg';
      this.points = 60;
      this.x = x;
      this.y = y;
      this.mode = mode; // 'falling' | 'resting' | 'wall' | 'ceiling'
      this.seed = seed || 1;
      this.vy = 0;
      this.age = 0;
      this.hatchAt = hatchAt ?? (mode === 'wall' ? 9 : 6);
      this.hatchCount = hatchCount;
      this.hatchSpeed = hatchSpeed;
      this.alive = true;
      this.done = false;
      this.hatched = false;
      this.killed = false;
      this.huskAge = 0;
      this.huskDuration = 2.0;
      this.rng = S.createRng(this.seed);
      this.wobble = 0;
      this.bulgeSide = this.rng.pick([-1, 1]);
      this.bulgeAngle = this.rng.range(-0.35, 0.45);

      // 16 small translucent eggs packed inside the sac (radius 2–3 px).
      this.innerEggs = [];
      const eggCount = 16;
      for (let i = 0; i < eggCount; i++) {
        // Golden-angle spiral inside the lower belly of the teardrop
        const frac = (i + 0.5) / eggCount;
        const ang = i * 2.39996 + this.rng.range(-0.2, 0.2);
        const rad = Math.sqrt(frac) * 8.2;
        const ex = Math.cos(ang) * rad * 0.92;
        const ey = 2.5 + Math.sin(ang) * rad * 1.05;
        this.innerEggs.push({
          x: ex,
          y: ey,
          r: this.rng.range(2.1, 2.9),
          phase: this.rng.range(0, Math.PI * 2),
          shade: this.rng.range(-0.08, 0.08),
        });
      }

      // 12 crossing silk strands wrapped around the sac + 7 loose outer fibres.
      this.strands = [];
      for (let i = 0; i < 12; i++) {
        const a0 = this.rng.range(0.35, Math.PI * 2 - 0.35);
        const a1 = a0 + this.rng.range(1.6, 3.6);
        this.strands.push({
          a0,
          a1,
          bend: this.rng.range(-5, 5),
          alpha: this.rng.range(0.36, 0.58),
          width: this.rng.range(0.7, 1.25),
        });
      }
      this.fibres = [];
      for (let i = 0; i < 7; i++) {
        const a = this.rng.range(0.3, Math.PI * 2 - 0.3);
        this.fibres.push({
          a,
          len: this.rng.range(3.5, 6.5),
          curl: this.rng.range(-0.6, 0.6),
          alpha: this.rng.range(0.35, 0.55),
        });
      }
    }

    // Point on the lumpy teardrop outline for angle `a` (0 = top tip, PI = bottom).
    teardropPoint(a, bulge = 0) {
      return teardropPoint(a, bulge, this.bulgeSide, this.bulgeAngle);
    }

    buildOutline(bulge = 0) {
      return buildOutline(bulge, this.bulgeSide, this.bulgeAngle);
    }

    update(dt, world) {
      if (this.killed) {
        this.done = true;
        return;
      }
      if (this.hatched) {
        this.huskAge += dt;
        if (this.huskAge >= this.huskDuration) this.done = true;
        return;
      }
      if (!this.alive) {
        this.done = true;
        return;
      }
      this.age += dt;

      if (this.mode === 'falling') {
        this.vy += 1500 * dt;
        this.y += this.vy * dt;
        // Eggs dropped on the hero's head: the original game's signature move.
        const hero = world.hero;
        const head = hero.headCenter();
        if (Math.hypot(this.x - head.x, this.y - head.y) < 42) {
          if (hero.hurt(10)) world.sfx('squish', 0.6);
          hero.feel('disgusted', 1);
          world.splat(this.x, this.y, 0.6);
          this.alive = false;
          this.killed = true;
          this.done = true;
          return;
        }
        const floor = world.floorAt(this.x, this.y - 20);
        if (floor !== null && this.y >= floor - 12) {
          this.y = floor - 12;
          this.mode = 'resting';
          this.age = 0;
          world.burst.dustPuff(this.x, floor, 5, 30);
          world.sfx('plop', 0.4);
        }
        return;
      }

      // Resting and wall eggs pulse faster and faster before they hatch.
      const left = this.hatchAt - this.age;
      const rate = S.remap(this.hatchAt, 0, 2.2, 18, left);
      this.wobble = Math.sin(this.age * rate) * S.remap(this.hatchAt, 0, 0, 1, left);
      if (left <= 0) {
        this.alive = false;
        this.hatched = true;
        this.huskAge = 0;
        world.hatch(this);
      }
    }

    hitTest(x, y) {
      return this.alive && Math.hypot(x - this.x, y - this.y) < 26;
    }

    kill(world) {
      if (!this.alive) return;
      this.alive = false;
      this.killed = true;
      this.done = true;
      world.splat(this.x, this.y, 0.5);
      world.burst.fibres(this.x, this.y, 8);
    }

    drawAttachment(ctx) {
      if (this.mode === 'wall' || this.mode === 'ceiling') {
        // Short silk tuft/stalk anchoring the pointed tip to the wall or ceiling.
        ctx.save();
        ctx.lineCap = 'round';
        // Soft silk pad at the attachment point
        ctx.fillStyle = S.rgba(P.eggSac, 0.35);
        ctx.beginPath();
        ctx.ellipse(0, -19, 9, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();

        const anchors = [-11, -6, -2, 2, 6, 11];
        for (let i = 0; i < anchors.length; i++) {
          const ax = anchors[i];
          ctx.strokeStyle = S.rgba(P.bone, i % 2 === 0 ? 0.55 : 0.38);
          ctx.lineWidth = i === 2 || i === 3 ? 1.3 : 0.9;
          ctx.beginPath();
          ctx.moveTo(ax * 0.25, -13.5);
          ctx.quadraticCurveTo(ax * 0.6, -16.5, ax, -20 - (i % 2) * 2);
          ctx.stroke();
        }
        ctx.restore();
      } else if (this.mode === 'falling') {
        // Broken thread fragment trailing above a falling egg sac.
        const sway = Math.sin(this.age * 14 + this.seed) * 4;
        ctx.save();
        ctx.strokeStyle = S.rgba(P.silk, 0.55);
        ctx.lineWidth = 1.15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(sway, -26, -sway * 0.6, -38);
        ctx.stroke();
        // Frayed split end
        ctx.strokeStyle = S.rgba(P.silk, 0.35);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-sway * 0.6, -38);
        ctx.lineTo(-sway * 0.6 - 4, -44);
        ctx.moveTo(-sway * 0.6, -38);
        ctx.lineTo(-sway * 0.6 + 3.5, -45);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawHusk(ctx) {
      const fade = 1 - S.ease.in(S.clamp(this.huskAge / this.huskDuration, 0, 1));
      if (fade <= 0.01) return;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(this.x, this.y);
      if (this.mode === 'resting') {
        S.paint.softShadow(ctx, 2, 13, 24, 6, 0.34 * fade);
        ctx.scale(1.15, 0.85);
      } else if (this.mode === 'wall') {
        S.paint.softShadow(ctx, 4, 14, 18, 7, 0.26 * fade);
      }

      this.drawAttachment(ctx);

      const open = S.ease.out(S.clamp(this.huskAge / 0.25, 0, 1));

      // Dark hollow cavity inside the split husk
      ctx.fillStyle = '#1B1512';
      ctx.beginPath();
      ctx.ellipse(0, 1, 9.5, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // A few pale empty egg shells left in the bottom of the cup
      ctx.strokeStyle = S.rgba(P.bone, 0.35);
      ctx.lineWidth = 0.9;
      for (let i = 0; i < 4; i++) {
        const e = this.innerEggs[i];
        ctx.beginPath();
        ctx.arc(e.x * 0.7, 5 + Math.abs(e.y) * 0.4, e.r * 0.85, 0.3, Math.PI * 1.6);
        ctx.stroke();
      }

      // Two torn silk flaps peeled apart from the top tear
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * 2 * open, 4);
        ctx.rotate(side * (0.22 + 0.16 * open));
        ctx.translate(-side * 2 * open, -4);

        const flap = [
          [side * 1.5, -14],
          [side * 8.5, -11],
          [side * 12.8, -2],
          [side * 12.2, 8],
          [side * 6.5, 15.5],
          [0, 16.5],
          [-side * 2.2, 8],
          [side * 2.8, 0],
          [side * 0.8, -7],
        ];
        const g = ctx.createRadialGradient(side * -3, -4, 1, side * 3, 2, 18);
        g.addColorStop(0, S.rgba(P.bone, 0.9));
        g.addColorStop(0.65, S.rgba(P.eggSac, 0.86));
        g.addColorStop(1, S.rgba('#7B6E56', 0.82));
        ctx.fillStyle = g;
        S.paint.wobblyPath(ctx, flap, { wobble: 1.1, step: 8, seed: this.seed + (side < 0 ? 17 : 31), closed: true });
        ctx.fill();
        ctx.strokeStyle = S.rgba('#6E624C', 0.55);
        ctx.lineWidth = 0.9;
        ctx.stroke();

        // Crossing silk strands on the flap
        ctx.strokeStyle = S.rgba(P.bone, 0.42);
        ctx.lineWidth = 0.85;
        for (let k = -2; k <= 2; k++) {
          const y = k * 4.5 + 2;
          ctx.beginPath();
          ctx.moveTo(side * 1.5, y - 2);
          ctx.quadraticCurveTo(side * 7, y + 1.5, side * 11.5, y - 1);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Loose frayed silk fibres sticking out of the torn top
      ctx.strokeStyle = S.rgba(P.bone, 0.52);
      ctx.lineWidth = 0.85;
      for (let i = 0; i < 6; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const bx = side * (3 + i * 1.4);
        const by = -11 + (i % 3) * 3;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + side * 4, by - 4, bx + side * 6.5, by - 7);
        ctx.stroke();
      }

      ctx.restore();
    }

    draw(ctx) {
      if (this.hatched) {
        this.drawHusk(ctx);
        return;
      }

      // Last 40% of life: faster pulse, asymmetric bulge, thinning silk.
      const late = this.mode === 'falling' ? 0 : S.invLerp(this.hatchAt * 0.6, this.hatchAt, this.age);
      const left = this.hatchAt - this.age;
      const rate = S.remap(this.hatchAt, 0, 2.2, 18, left);
      const pulse = 1 + Math.abs(this.wobble) * (0.06 + late * 0.05);
      const bulge = late * (0.65 + 0.35 * Math.sin(this.age * rate));

      drawEggSac(ctx, this.x, this.y, {
        mode: this.mode,
        seed: this.seed,
        scale: 1,
        wobble: this.wobble,
        pulse,
        bulge,
        bulgeSide: this.bulgeSide,
        bulgeAngle: this.bulgeAngle,
        late,
        left,
        rate,
        age: this.age,
        innerEggs: this.innerEggs,
        strands: this.strands,
        fibres: this.fibres,
        drawAttachment: () => this.drawAttachment(ctx),
      });
    }
  }

  S.spiders = { StringSpider, WallCrawler, Hatchling, EggSac, drawEggSac };
})();
