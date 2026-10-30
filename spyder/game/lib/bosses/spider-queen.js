/*
 * Spyder — Room 12 Boss: The Spider Queen (lib/bosses/spider-queen.js).
 *
 * Health 60. Three distinct phases:
 *   1. Nest (100–66%): Stays in funnel, lunges every 3 s (0.5 s telegraph),
 *      spits egg sac every 6 s, damaged only during lunge or when Web-Cutter
 *      tears the funnel (1 damage per blade).
 *   2. Descend (66–33%): Swings on a thick silk line (pendulum across x 500–1420,
 *      period 4 s), laying wall eggs. Cutting her line (Web-Cutter or 6 darts)
 *      drops her stunned for 3 s (double damage).
 *   3. Rage (33–0%): Walks rafters and collar beam (slow heavy gait 0.28 s,
 *      camera shakes), telegraphed leap (0.8 s crouch) at hero, summons 4
 *      hatchlings every 8 s. Foam slows 30% (not 50%).
 *
 * Contact or landed leap: hurt 20.
 * Defeat: curls, falls, nest collapses, drops old torch, then sets done = true.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  const FUNNEL = { x0: 780, x1: 1140, y0: 60, y1: 380, mouthX: 960, mouthY: 380 };
  const ROOF_RIDGE = { x: 960, y: 60 };
  const GROUND = 935;
  const BEAM_Y = 430;

  // The funnel's outline, shared with the Attic's art (which paints the nest
  // inside it) so that what hides her and what is painted are the same shape.
  const NEST_OUTLINE = [[895, 64], [1025, 64], [1052, 150], [1088, 250], [1124, 338], [1140, 380], [1096, 408], [1030, 420], [960, 424], [890, 420], [824, 408], [780, 380], [796, 338], [832, 250], [868, 150]];
  S.NEST_OUTLINE = NEST_OUTLINE;

  // ── Her look: the same rig as every spider, with one silhouette cue (scale
  // and a crown) and a heavier finish: black-plum gloss, bristled legs,
  // mandibles, and the marks each phase leaves on her.
  const QUEEN = {
    body: S.mixHex(P.spiderBody, P.plum, 0.38),
    deep: S.mixHex(P.soot, P.plum, 0.25),
    sheen: S.mixHex(P.spiderSheen, P.bone, 0.18),
    crown: S.mixHex(P.bone, P.spiderMark, 0.3),
    eye: S.mixHex(P.spiderEye, P.ember, 0.45),
    wound: S.mixHex(P.goo, P.soot, 0.35),
  };

  class QueenRig extends S.SpiderRig {
    constructor(opts) {
      super({ ...opts, markings: false, legFemur: [1.45, 1.35, 1.35, 1.5] });
      this.tear = false;
      this.brokenLeg = false;
      this.mandibles = 0;
      this.spread = 0;
      this.stepDuration = 0.28;
    }

    // The telegraph before a lunge: front legs reach out and open wide.
    // (`spread` is read during the base constructor, before it is set.)
    reachOf(index) {
      return super.reachOf(index) * (1 + (index < 2 ? 0.32 : 0.1) * (this.spread || 0));
    }

    restAngleOf(index) {
      return super.restAngleOf(index) + (index < 2 ? 0.28 : 0.08) * (this.spread || 0);
    }

    // The dangling legs need a clock; the boss passes `world.gameTime`,
    // which the world does not have, so keep one of her own.
    update(dt, time) {
      this.clock = (this.clock || 0) + dt;
      super.update(dt, Number.isFinite(time) ? time : this.clock);
    }

    // The base gait with her own slow, heavy step.
    updateGait(dt) {
      const threshold = 24 * this.scale;
      const stepping = { A: false, B: false };
      for (const leg of this.legs) {
        if (!leg.step) continue;
        leg.step.t += dt / this.stepDuration;
        const t = Math.min(1, leg.step.t);
        const e = S.ease.inOut(t);
        leg.foot = { x: S.lerp(leg.step.from.x, leg.step.to.x, e), y: S.lerp(leg.step.from.y, leg.step.to.y, e) };
        leg.lifted = Math.sin(t * Math.PI);
        if (t >= 1) {
          leg.step = null;
          leg.lifted = 0;
        } else {
          stepping[leg.group] = true;
        }
      }
      for (const leg of this.legs) {
        if (leg.step) continue;
        if (stepping[leg.group === 'A' ? 'B' : 'A']) continue;
        const rest = this.restFoot(leg);
        if (S.dist(leg.foot.x, leg.foot.y, rest.x, rest.y) > threshold) {
          leg.step = { from: { ...leg.foot }, to: this.restFoot(leg, 0.12), t: 0 };
          stepping[leg.group] = true;
        }
      }
    }

    legJoints(leg) {
      const hip = this.hip(leg);
      const reach = this.reachOf(leg.index);
      const knee = this.knee(hip, leg.foot, reach * 0.62, reach * 0.64);
      return { hip, knee, foot: leg.foot };
    }

    isBroken(leg) {
      return this.brokenLeg && leg.side === 1 && leg.index === 0;
    }

    drawLegs(ctx, asShadow) {
      if (asShadow) return super.drawLegs(ctx, true);
      const s = this.scale;
      for (const leg of this.legs) {
        const { hip, knee } = this.legJoints(leg);
        const fem = this.legFemur[leg.index] ?? 1;
        const broken = this.isBroken(leg);
        const foot = broken
          ? { x: S.lerp(knee.x, leg.foot.x, 0.58), y: S.lerp(knee.y, leg.foot.y, 0.58) }
          : leg.foot;
        S.paint.taperedLine(ctx, hip.x, hip.y, knee.x, knee.y, 6.6 * s * fem, 4.8 * s * fem, QUEEN.body);
        S.paint.taperedLine(ctx, knee.x, knee.y, foot.x, foot.y, 5 * s, broken ? 3.4 * s : 1.4 * s, QUEEN.body);
        ctx.fillStyle = QUEEN.deep;
        ctx.beginPath();
        ctx.arc(knee.x, knee.y, 4.6 * s, 0, Math.PI * 2);
        ctx.fill();
        // A glossy ridge along the femur, and a catch-light on the knee.
        ctx.strokeStyle = S.rgba(QUEEN.sheen, 0.6);
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(S.lerp(hip.x, knee.x, 0.18), S.lerp(hip.y, knee.y, 0.18) - 1.5);
        ctx.lineTo(S.lerp(hip.x, knee.x, 0.86), S.lerp(hip.y, knee.y, 0.86) - 1.5);
        ctx.stroke();
        ctx.fillStyle = S.rgba(QUEEN.sheen, 0.5);
        ctx.beginPath();
        ctx.arc(knee.x - 1.4 * s, knee.y - 1.4 * s, 1.4 * s, 0, Math.PI * 2);
        ctx.fill();
        // A thin rim of light along each segment, so the legs read against
        // the dark boards as well as against the pale nest.
        ctx.strokeStyle = S.rgba(QUEEN.sheen, 0.3);
        ctx.lineWidth = 1;
        for (const [a, b, w] of [[hip, knee, 3.1 * s * fem], [knee, foot, 2.2 * s]]) {
          const ang = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(a.x + Math.cos(ang) * w, a.y + Math.sin(ang) * w);
          ctx.lineTo(b.x + Math.cos(ang) * w * 0.4, b.y + Math.sin(ang) * w * 0.4);
          ctx.stroke();
        }
        // Bristles every 10 px, alternating sides, each a slightly
        // different length, all swept toward the foot.
        ctx.strokeStyle = S.rgba(QUEEN.deep, 0.9);
        ctx.lineWidth = 1;
        let n = leg.index * 3 + (leg.side > 0 ? 1 : 0);
        for (const [a, b, out, wHalf] of [[hip, knee, 4.6, 3 * s * fem], [knee, foot, 3.6, 2 * s]]) {
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          for (let d = 6; d < len - 4; d += 10) {
            const u = d / len;
            const px = S.lerp(a.x, b.x, u);
            const py = S.lerp(a.y, b.y, u);
            const side = n % 2 ? 1 : -1;
            const o = ang + side * 0.6;
            const l = out * s * (0.6 + ((n * 37) % 10) / 25);
            const w = wHalf * (1 - u * 0.5);
            const bx = px + Math.cos(ang + side * Math.PI / 2) * w;
            const by = py + Math.sin(ang + side * Math.PI / 2) * w;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(o) * l, by + Math.sin(o) * l);
            ctx.stroke();
            n++;
          }
        }
        // The broken tip: a pale, splintered stump.
        if (broken) {
          ctx.fillStyle = S.rgba(QUEEN.wound, 0.95);
          ctx.beginPath();
          const ang = Math.atan2(foot.y - knee.y, foot.x - knee.x);
          for (let k = 0; k <= 6; k++) {
            const a = ang - Math.PI / 2 + (k / 6) * Math.PI;
            const r = (k % 2 ? 1.2 : 2.4) * s;
            ctx.lineTo(foot.x + Math.cos(a) * r + Math.cos(ang) * (k % 2 ? 3 : 0) * s, foot.y + Math.sin(a) * r + Math.sin(ang) * (k % 2 ? 3 : 0) * s);
          }
          ctx.closePath();
          ctx.fill();
        }
        if (leg.lifted > 0.3 && this.mode === 'walk') {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.arc(foot.x + 4, foot.y + 6, 2.4 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    drawBody(ctx, asShadow, override = null) {
      if (asShadow || override) return super.drawBody(ctx, asShadow, override);
      const s = this.scale;
      const abd = this.abdomenCenter();
      const ceph = this.cephCenter();
      const pulse = 1 + Math.sin(this.breath * 2.2) * 0.022;

      ctx.save();
      ctx.translate(abd.x, abd.y);
      ctx.rotate(this.heading);
      ctx.scale(pulse, pulse);
      const rx = 34 * s;
      const ry = 26 * s;
      // Glossy black-plum: a deep body with a broad, soft highlight.
      const g = ctx.createRadialGradient(-rx * 0.15, -ry * 0.5, 2, 0, 0, rx * 1.1);
      g.addColorStop(0, S.shadeHex(QUEEN.body, 0.35));
      g.addColorStop(0.45, QUEEN.body);
      g.addColorStop(1, QUEEN.deep);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = S.rgba(QUEEN.sheen, 0.22);
      ctx.beginPath();
      ctx.ellipse(-rx * 0.12, -ry * 0.42, rx * 0.55, ry * 0.2, -0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = S.rgba('#ffffff', 0.12);
      ctx.beginPath();
      ctx.ellipse(-rx * 0.2, -ry * 0.5, rx * 0.22, ry * 0.07, -0.05, 0, Math.PI * 2);
      ctx.fill();

      // The crown: a ring of ivory chevrons, each pointing outward, round a
      // pale diamond. At 66 % a ragged tear breaks the ring.
      const tearAt = 0.55;
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        if (this.tear && Math.abs(S.angleDelta(a, tearAt)) < 0.45) continue;
        const cx = Math.cos(a) * rx * 0.56;
        const cy = Math.sin(a) * ry * 0.56;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.fillStyle = S.rgba(QUEEN.crown, 0.9);
        ctx.beginPath();
        ctx.moveTo(6 * s, 0);
        ctx.lineTo(-2 * s, -4.6 * s);
        ctx.lineTo(0, 0);
        ctx.lineTo(-2 * s, 4.6 * s);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = S.rgba(QUEEN.crown, 0.85);
      ctx.beginPath();
      ctx.moveTo(7 * s, 0);
      ctx.lineTo(0, -4.4 * s);
      ctx.lineTo(-7 * s, 0);
      ctx.lineTo(0, 4.4 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = S.rgba(QUEEN.deep, 0.9);
      ctx.beginPath();
      ctx.arc(0, 0, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
      if (this.tear) {
        const tx = Math.cos(tearAt) * rx * 0.5;
        const ty = Math.sin(tearAt) * ry * 0.5;
        ctx.fillStyle = S.rgba(QUEEN.wound, 0.95);
        ctx.beginPath();
        const pts = 9;
        for (let k = 0; k <= pts; k++) {
          const u = k / pts;
          const along = S.lerp(-12, 12, u) * s;
          const jag = (k % 2 ? 2.6 : 0.6) * s;
          ctx.lineTo(tx + Math.cos(tearAt + 1.4) * along - Math.sin(tearAt + 1.4) * jag, ty + Math.sin(tearAt + 1.4) * along + Math.cos(tearAt + 1.4) * jag);
        }
        for (let k = pts; k >= 0; k--) {
          const u = k / pts;
          const along = S.lerp(-12, 12, u) * s;
          const jag = (k % 2 ? -1.4 : -3) * s;
          ctx.lineTo(tx + Math.cos(tearAt + 1.4) * along - Math.sin(tearAt + 1.4) * jag, ty + Math.sin(tearAt + 1.4) * along + Math.cos(tearAt + 1.4) * jag);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = S.rgba(QUEEN.crown, 0.5);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      // Rim gloss and long hairs round the edge.
      ctx.strokeStyle = S.rgba(QUEEN.sheen, 0.55);
      ctx.lineWidth = 2.2 * s;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx - 3, ry - 3, 0, Math.PI * 1.05, Math.PI * 1.65);
      ctx.stroke();
      ctx.strokeStyle = S.rgba(QUEEN.deep, 0.85);
      ctx.lineWidth = 1.1;
      for (let a = 0; a < Math.PI * 2; a += 0.16) {
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex * 1.16, ey * 1.16);
        ctx.stroke();
      }
      ctx.restore();

      // Cephalothorax: smaller, darker, glossier.
      ctx.save();
      ctx.translate(ceph.x, ceph.y);
      ctx.rotate(this.heading);
      const cx = 19 * s;
      const cy = 15 * s;
      const hg = ctx.createRadialGradient(cx * 0.15, -cy * 0.45, 1, 0, 0, cx * 1.1);
      hg.addColorStop(0, S.shadeHex(QUEEN.body, 0.32));
      hg.addColorStop(1, QUEEN.deep);
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.ellipse(0, 0, cx, cy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = S.rgba(QUEEN.sheen, 0.2);
      ctx.beginPath();
      ctx.ellipse(-cx * 0.1, -cy * 0.45, cx * 0.5, cy * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pedipalps.
      const palp = Math.sin(this.breath * 5) * 0.2;
      ctx.strokeStyle = QUEEN.body;
      ctx.lineCap = 'round';
      ctx.lineWidth = 3.6 * s;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx * 0.7, side * cy * 0.5);
        ctx.quadraticCurveTo(cx * 1.25, side * cy * (0.8 + palp * side), cx * 1.4, side * cy * (0.45 + palp));
        ctx.stroke();
      }
      // Mandibles: hooked fangs that swing apart as she lunges.
      const open = S.clamp(this.mandibles, 0, 1);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(cx * 0.92, side * cy * 0.2);
        ctx.rotate(side * (0.15 + open * 0.75));
        ctx.fillStyle = QUEEN.deep;
        ctx.beginPath();
        ctx.moveTo(0, -side * 3 * s);
        ctx.quadraticCurveTo(9 * s, -side * 3.5 * s, 13 * s, side * 1.5 * s);
        ctx.quadraticCurveTo(8 * s, side * 1 * s, 0, side * 3 * s);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = S.rgba(QUEEN.sheen, 0.55);
        ctx.beginPath();
        ctx.arc(11 * s, side * 0.6 * s, 1 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      this.drawEyes(ctx, cx, cy);
      ctx.restore();
    }

    drawRim(ctx, alpha) {
      const s = this.scale;
      ctx.strokeStyle = S.rgba(QUEEN.sheen, alpha);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const leg of this.legs) {
        const { hip, knee } = this.legJoints(leg);
        const foot = this.isBroken(leg)
          ? { x: S.lerp(knee.x, leg.foot.x, 0.58), y: S.lerp(knee.y, leg.foot.y, 0.58) }
          : leg.foot;
        ctx.moveTo(hip.x, hip.y);
        ctx.lineTo(knee.x, knee.y);
        ctx.lineTo(foot.x, foot.y);
      }
      ctx.stroke();
      const abd = this.abdomenCenter();
      const ceph = this.cephCenter();
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(abd.x, abd.y, 34 * s + 1, 26 * s + 1, this.heading, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(ceph.x, ceph.y, 19 * s + 1, 15 * s + 1, this.heading, Math.PI * 1.0, Math.PI * 1.8);
      ctx.stroke();
    }

    drawEyes(ctx, cx, cy) {
      const s = this.scale;
      const eyes = [[0.62, -0.26, 4.6], [0.62, 0.26, 4.6], [0.42, -0.58, 2.8], [0.42, 0.58, 2.8], [0.12, -0.5, 2.0], [0.12, 0.5, 2.0], [-0.1, -0.32, 1.7], [-0.1, 0.32, 1.7]];
      const shine = S.clamp(this.glint * (1 - this.curl), 0, 1);
      for (const [ex, ey, r] of eyes) {
        const x = ex * cx;
        const y = ey * cy * 1.4;
        ctx.fillStyle = '#060305';
        ctx.beginPath();
        ctx.arc(x, y, r * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = S.rgba(QUEEN.eye, 0.45 + shine * 0.5);
        ctx.beginPath();
        ctx.arc(x - r * 0.25 * s, y - r * 0.25 * s, r * 0.5 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = S.rgba('#ffffff', 0.35 + shine * 0.55);
        ctx.beginPath();
        ctx.arc(x - r * 0.35 * s, y - r * 0.4 * s, r * 0.18 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  class SpiderQueen {
    constructor(def, world, opts = {}) {
      this.def = def;
      this.id = def.id || 'spider-queen';
      this.name = def.name || 'The Spider Queen';
      this.maxHealth = def.health || 60;
      this.health = this.maxHealth;
      this.phases = def.phases || [
        { id: 'nest', at: 1.0 },
        { id: 'descend', at: 0.66, note: "She's coming down." },
        { id: 'rage', at: 0.33, note: "She's angry now." },
      ];
      this.phase = 'nest';
      this.currentPhaseIndex = 0;
      this.alive = true;
      this.done = false;
      this.isBoss = true;

      this.scale = 2.4;
      this.x = opts.x ?? 960;
      this.y = opts.y ?? 310;
      this.radius = 65 * this.scale;
      this.points = 1000;

      this.hitStop = 0;
      this.flash = 0;
      this.dying = false;
      this.deathTimer = 0;
      this.deathDuration = 2.8;

      // Rig initialization (scale 2.4, slow gait)
      this.rig = new QueenRig({
        x: this.x,
        y: this.y,
        heading: Math.PI / 2,
        scale: this.scale,
        seed: 1601,
        markings: true,
      });

      // Phase 1 (Nest) state
      this.nestRestY = 310;
      this.lungeY = 420;
      this.lungeCycleTimer = 0;
      this.telegraph = false;
      this.lunging = false;
      this.spitTimer = 0;
      this.mandiblesOpen = 0;

      // Phase 2 (Descend) state
      this.swingTime = 0;
      this.lineActive = false;
      this.lineDarts = 0;
      this.stunned = false;
      this.stunTimer = 0;
      this.climbing = false;
      this.climbTimer = 0;
      this.wallEggsTimer = 0;

      // Phase 3 (Rage) state
      this.walkDir = 1;
      this.stepTimer = 0;
      this.leapCooldown = 3.0;
      this.crouching = false;
      this.crouchTimer = 0;
      this.leaping = false;
      this.leapVx = 0;
      this.leapVy = 0;
      this.summonTimer = 0;
      this.slowTimer = 0;
      this.speedMult = 1.0;

      // Visual phase state (for ART blockouts)
      this.tear = false;       // 66% health tear
      this.brokenLeg = false;   // 33% health broken leg tip
      this.nestCollapsed = false;
      this.nestCollapseT = 0;
      this.torchX = 960;
      this.torchY = 320;
      this.torchDropped = false;
      this.lastHitZone = 'body';

      // Track cutter blades for funnel damage
      this._trackedBlades = [];
      if (world && world.on) {
        world.on('fire', ({ blade }) => {
          if (blade) this._trackedBlades.push(blade);
        });
      }
    }

    hitTest(x, y, r = 0) {
      if (!this.alive) return false;

      // 1. Line target during descend
      if (this.phase === 'descend' && this.lineActive && !this.stunned && !this.climbing) {
        const distToLine = S.pointSegmentDistance(x, y, ROOF_RIDGE.x, ROOF_RIDGE.y, this.x, this.y - 30);
        if (distToLine <= 18 + r) {
          this.lastHitZone = 'line';
          return true;
        }
      }

      // 2. Head / cephalothorax
      const ceph = this.rig.cephCenter();
      if (Math.hypot(x - ceph.x, y - ceph.y) <= 34 * this.scale + r) {
        this.lastHitZone = 'head';
        return true;
      }

      // 3. Abdomen
      const abd = this.rig.abdomenCenter();
      if (Math.hypot(x - abd.x, y - abd.y) <= 44 * this.scale + r) {
        this.lastHitZone = 'abdomen';
        return true;
      }

      // 4. Legs
      if (Math.hypot(x - this.x, y - this.y) <= 90 * this.scale + r) {
        this.lastHitZone = 'legs';
        return true;
      }

      return false;
    }

    hit(world, damage = 1, weaponId = 'vacuum') {
      if (!this.alive) return false;

      // Silk line target in Phase 2
      if (this.lastHitZone === 'line') {
        if (weaponId === 'web-cutter') {
          this.cutLine(world);
        } else {
          this.lineDarts = (this.lineDarts || 0) + 1;
          if (this.lineDarts >= 6) {
            this.cutLine(world);
          } else {
            if (world && world.burst) world.burst.fibres(this.x, this.y - 100, 8);
            if (world && world.audio) world.audio.play('pop', 0.6);
          }
        }
        return true;
      }

      // Legs do nothing
      if (this.lastHitZone === 'legs') {
        if (world && world.audio) world.audio.play('plop', 0.25);
        return false;
      }

      // Phase 1 (nest): takes damage ONLY during lunge (or web-cutter funnel cut handled in update)
      if (this.phase === 'nest' && !this.lunging && weaponId !== 'web-cutter') {
        if (world && world.audio) world.audio.play('plop', 0.35);
        return false;
      }

      // Stunned on floor: double damage
      if (this.stunned) {
        damage *= 2;
      }

      // Flamethrower deals 1.5 per tick
      if (weaponId === 'flamethrower' && damage < 1.5) {
        damage = 1.5;
      }

      this.health = Math.max(0, this.health - damage);
      this.flash = 1;
      this.hitStop = 0.04;
      if (world && world.shake) world.shake(0.3);

      // Phase tear & broken leg thresholds
      if (this.health <= this.maxHealth * 0.66) this.tear = true;
      if (this.health <= this.maxHealth * 0.33) this.brokenLeg = true;

      if (this.health <= 0) {
        this.die(world);
      }
      return true;
    }

    cutLine(world) {
      this.lineActive = false;
      this.lineDarts = 0;
      this.stunned = true;
      this.stunTimer = 3.0;
      this.y = GROUND;
      this.rig.x = this.x;
      this.rig.y = this.y;
      this.rig.plantAll();

      if (world && world.burst) {
        world.burst.fibres(this.x, 300, 32);
        world.burst.dustPuff(this.x, GROUND, 14, 50);
      }
      if (world && world.shake) world.shake(0.4);
      if (world && world.audio) {
        world.audio.play('tear', 1.0);
        world.audio.play('thump', 1.0);
      }
    }

    enterPhase(phaseId) {
      this.phase = phaseId;
      if (phaseId === 'descend') {
        this.startDescend();
      } else if (phaseId === 'rage') {
        this.startRage();
      }
    }

    startDescend() {
      this.phase = 'descend';
      this.lineActive = true;
      this.lineDarts = 0;
      this.stunned = false;
      this.tear = true;
      this.swingTime = 0;
      this.y = 480;
      this.rig.heading = Math.PI / 2;
    }

    startRage() {
      this.phase = 'rage';
      this.lineActive = false;
      this.stunned = false;
      this.tear = true;
      this.brokenLeg = true;
      this.y = BEAM_Y;
      this.x = 960;
      this.walkDir = 1;
      this.stepTimer = 0;
      this.leapCooldown = 2.0;
      this.rig.heading = 0;
      this.rig.plantAll();
    }

    die(world) {
      this.alive = false;
      this.dying = true;
      this.deathTimer = 0;
      this.nestCollapsed = true;
      this.torchDropped = true;

      if (world && world.audio) {
        world.audio.play('thump', 1.2);
        world.audio.play('tear', 1.0);
      }
      if (world && world.burst) {
        world.burst.fibres(FUNNEL.mouthX, FUNNEL.mouthY, 40);
        world.burst.dustPuff(this.x, GROUND, 20, 80);
      }
      if (world && world.shake) world.shake(0.5);
    }

    update(dt, world) {
      // Hit stop freeze
      if (this.hitStop > 0) {
        this.hitStop = Math.max(0, this.hitStop - dt);
        if (this.hitStop > 0) return;
      }
      if (this.flash > 0) {
        this.flash = Math.max(0, this.flash - dt * 6);
      }

      // Death sequence (curl, fall, nest collapse, sets done = true)
      if (this.dying && !this.done) {
        this.deathTimer += dt;
        const t = Math.min(1, this.deathTimer / this.deathDuration);

        // Legs curl tightly
        this.rig.curl = S.clamp(this.deathTimer / 1.0, 0, 1);

        // Fall to floor with gravity
        if (this.y < GROUND) {
          this.y = Math.min(GROUND, this.y + 600 * dt);
          this.rig.x = this.x;
          this.rig.y = this.y;
        }

        // Nest collapse animation
        this.nestCollapseT = S.clamp(this.deathTimer / 1.5, 0, 1);

        // Torch falls from nest to floor
        if (this.torchY < GROUND) {
          this.torchY = Math.min(GROUND, this.torchY + 700 * dt);
        }

        if (this.deathTimer >= this.deathDuration) {
          this.done = true;
        }
        return;
      }

      if (!this.alive) return;

      // Slow timer (Foam slows 30%, so speedMult = 0.7)
      if (this.slowTimer > 0) {
        this.slowTimer = Math.max(0, this.slowTimer - dt);
        this.speedMult = 0.7;
      } else {
        this.speedMult = 1.0;
      }

      const simDt = dt * this.speedMult;

      // Phase-specific updates
      if (this.phase === 'nest') {
        this.updateNest(simDt, world);
      } else if (this.phase === 'descend') {
        this.updateDescend(simDt, world);
      } else if (this.phase === 'rage') {
        this.updateRage(simDt, world);
      }

      // Check contact damage with hero (hurt 20)
      if (world && world.hero && !this.stunned) {
        const h = world.hero;
        const dist = Math.hypot(this.x - h.x, this.y - (h.y - 60));
        if (dist < 60 * this.scale) {
          world.hurtHero(20);
        }
      }

      this.rig.x = this.x;
      this.rig.y = this.y;
      this.rig.update(simDt, world ? world.gameTime : 0);
    }

    updateNest(dt, world) {
      this.x = 960;
      this.rig.heading = Math.PI / 2; // Facing down out of funnel

      // Check Web-Cutter blades crossing funnel (each blade = 1 damage)
      if (this._trackedBlades && this._trackedBlades.length) {
        for (let i = this._trackedBlades.length - 1; i >= 0; i--) {
          const b = this._trackedBlades[i];
          if (!b || b.age > 1.1) {
            this._trackedBlades.splice(i, 1);
            continue;
          }
          if (!b._hitFunnel && b.x >= FUNNEL.x0 && b.x <= FUNNEL.x1 && b.y >= FUNNEL.y0 && b.y <= FUNNEL.y1) {
            b._hitFunnel = true;
            if (world && world.hitBoss) world.hitBoss(1, 'web-cutter');
            else this.hit(world, 1, 'web-cutter');
            if (world && world.burst) world.burst.fibres(b.x, b.y, 14);
            if (world && world.audio) world.audio.play('tear', 0.7);
          }
        }
      }

      // Lunge cycle: lunges every 3 s (telegraph: legs spread wide 0.5 s before)
      this.lungeCycleTimer += dt;
      if (this.lungeCycleTimer < 2.5) {
        // Resting in funnel
        this.telegraph = false;
        this.lunging = false;
        this.mandiblesOpen = 0;
        this.y = this.nestRestY;
      } else if (this.lungeCycleTimer < 3.0) {
        // Telegraph (0.5 s before lunge): legs spread wide, mandibles twitch
        this.telegraph = true;
        this.lunging = false;
        this.mandiblesOpen = (this.lungeCycleTimer - 2.5) * 2;
        this.y = this.nestRestY;
      } else if (this.lungeCycleTimer < 3.5) {
        // Lunging out of mouth!
        this.telegraph = false;
        this.lunging = true;
        this.mandiblesOpen = 1;
        const t = (this.lungeCycleTimer - 3.0) / 0.5;
        this.y = S.lerp(this.nestRestY, this.lungeY, Math.sin(t * Math.PI));

        // Damage hero if nearby during lunge
        if (world && world.hero) {
          const h = world.hero;
          if (Math.hypot(this.x - h.x, this.y - h.y) < 80 * this.scale) {
            world.hurtHero(20);
          }
        }
      } else {
        // Reset cycle
        this.lungeCycleTimer = 0;
        this.lunging = false;
        this.telegraph = false;
        this.y = this.nestRestY;
      }

      // Spit egg sac onto the floor every 6 s (lands and hatches in 4 s)
      this.spitTimer += dt;
      if (this.spitTimer >= 6.0) {
        this.spitTimer = 0;
        if (world) {
          const targetX = 400 + Math.random() * 1120;
          if (world.spawnEgg) {
            world.spawnEgg({ x: targetX, y: GROUND, hatchAt: 4.0 });
          } else if (world.spawn) {
            world.spawn('egg', { x: targetX, y: GROUND, hatchAt: 4.0 });
          }
          if (world.audio) world.audio.play('pop', 0.8);
          if (world.burst) world.burst.gooBurst(this.x, this.y + 40, 8, P.oliveGoo);
        }
      }
    }

    updateDescend(dt, world) {
      if (this.stunned) {
        this.stunTimer -= dt;
        this.y = GROUND;
        this.rig.curl = 0.5;
        if (this.stunTimer <= 0) {
          this.stunned = false;
          this.climbing = true;
          this.climbTimer = 1.2;
          this.rig.curl = 0;
        }
        return;
      }

      if (this.climbing) {
        this.climbTimer -= dt;
        const progress = 1 - Math.max(0, this.climbTimer / 1.2);
        this.y = S.lerp(GROUND, 480, progress);
        if (this.climbTimer <= 0) {
          this.climbing = false;
          this.lineActive = true;
          this.lineDarts = 0;
        }
        return;
      }

      // Pendulum swing across x 500–1420, period 4 s
      this.swingTime += dt;
      const omega = (2 * Math.PI) / 4.0;
      const sinVal = Math.sin(this.swingTime * omega);
      const amp = (1420 - 500) / 2; // 460
      this.x = 960 + sinVal * amp;
      // Pendulum height variation
      this.y = 520 - Math.abs(sinVal) * 90;
      this.rig.heading = Math.PI / 2 + (Math.cos(this.swingTime * omega) * 0.3);

      // Lay row of 3 wall eggs as she passes the gables (near extremes)
      this.wallEggsTimer += dt;
      if (this.wallEggsTimer > 4.0 && (this.x <= 560 || this.x >= 1360)) {
        this.wallEggsTimer = 0;
        if (world && world.spawnEgg) {
          const side = this.x <= 560 ? 120 : 1800;
          for (let k = 0; k < 3; k++) {
            world.spawnEgg({
              x: side + (this.x <= 560 ? k * 30 : -k * 30),
              y: 500 + k * 45,
              hatchAt: 6.0,
              onWall: true,
            });
          }
        }
      }
    }

    updateRage(dt, world) {
      // Crouch telegraph before leap (0.8 s)
      if (this.crouching) {
        this.crouchTimer -= dt;
        this.rig.curl = 0.35;
        this.mandiblesOpen = 1.0;
        if (this.crouchTimer <= 0) {
          this.crouching = false;
          this.leaping = true;
          this.rig.curl = 0;
          // Launch leap toward hero
          const h = world?.hero || { x: 960, y: GROUND };
          const airTime = 0.8;
          this.leapVx = (h.x - this.x) / airTime;
          this.leapVy = -380;
          if (world && world.audio) world.audio.play('pop', 1.2);
        }
        return;
      }

      // In mid-leap
      if (this.leaping) {
        this.x += this.leapVx * dt;
        this.leapVy += 850 * dt;
        this.y += this.leapVy * dt;
        this.rig.heading = Math.atan2(this.leapVy, this.leapVx);

        // Check landing on collar beam or floor
        const targetFloor = (this.x >= 520 && this.x <= 1400 && this.leapVy > 0 && this.y >= BEAM_Y && this.y <= BEAM_Y + 30)
          ? BEAM_Y
          : GROUND;

        if (this.y >= targetFloor) {
          this.y = targetFloor;
          this.leaping = false;
          this.leapCooldown = 5.0 + Math.random() * 2;
          this.rig.heading = this.walkDir > 0 ? 0 : Math.PI;
          this.rig.plantAll();

          if (world && world.shake) world.shake(0.4);
          if (world && world.burst) world.burst.dustPuff(this.x, this.y, 18, 60);
          if (world && world.audio) world.audio.play('thump', 1.3);

          // Check leap damage to hero
          if (world && world.hero) {
            const h = world.hero;
            if (Math.hypot(this.x - h.x, this.y - h.y) < 110) {
              world.hurtHero(20);
            }
          }
        }
        return;
      }

      // Normal walking on beam or floor (step period 0.28 s, shakes camera)
      this.stepTimer += dt;
      const stepInterval = 0.28;
      if (this.stepTimer >= stepInterval) {
        this.stepTimer = 0;
        if (world && world.shake) world.shake(0.12);
        if (world && world.audio) world.audio.play('thump', 0.4);
      }

      const walkSpeed = 140;
      this.x += this.walkDir * walkSpeed * dt;

      // Reverse direction at edges of beam or walls
      if (this.y <= BEAM_Y + 10) {
        if (this.x <= 540) { this.x = 540; this.walkDir = 1; }
        if (this.x >= 1380) { this.x = 1380; this.walkDir = -1; }
      } else {
        if (this.x <= 200) { this.x = 200; this.walkDir = 1; }
        if (this.x >= 1720) { this.x = 1720; this.walkDir = -1; }
      }
      this.rig.heading = this.walkDir > 0 ? 0 : Math.PI;

      // Trigger leap when cooldown ready
      this.leapCooldown -= dt;
      if (this.leapCooldown <= 0) {
        this.crouching = true;
        this.crouchTimer = 0.8;
      }

      // Summon 4 hatchlings every 8 s
      this.summonTimer += dt;
      if (this.summonTimer >= 8.0) {
        this.summonTimer = 0;
        if (world && world.spawn) {
          for (let i = 0; i < 4; i++) {
            world.spawn('hatchling', { x: this.x + (i - 1.5) * 35, y: this.y - 10 });
          }
          if (world.audio) world.audio.play('squish', 0.8);
        }
      }
    }

    draw(ctx) {
      if (this.done) return;
      const rig = this.rig;
      rig.tear = this.tear;
      rig.brokenLeg = this.brokenLeg;
      rig.mandibles = Math.max(this.mandiblesOpen || 0, this.crouching ? 0.5 : 0, this.leaping ? 0.8 : 0);
      rig.flash = Math.max(rig.flash, this.flash * 0.2);
      const spreadTo = this.telegraph ? 1 : this.lunging ? 0.7 : this.crouching ? 0.5 : 0;
      rig.spread += (spreadTo - rig.spread) * 0.3;
      const onLine = this.phase === 'descend' && this.lineActive && !this.stunned;
      rig.mode = onLine ? 'hang' : 'walk';
      rig.lift = onLine ? 1 : 0;

      // Her line: thick and pale, a fainter sheath round a bright core,
      // from the ridge to her spinnerets.
      if (onLine) {
        const abd = rig.abdomenCenter();
        const f = rig.forward();
        const tail = { x: abd.x - f.x * 30 * this.scale, y: abd.y - f.y * 30 * this.scale };
        // A faint dark edge first, so the pale line still reads where it
        // crosses the pale nest.
        for (const [w, hex, a, dx] of [[10, P.soot, 0.45, 0], [12, P.silk, 0.14, 0], [5, P.silk, 0.6, 0], [2.6, P.silk, 0.95, 0]]) {
          ctx.strokeStyle = S.rgba(hex, a);
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(ROOF_RIDGE.x + dx, ROOF_RIDGE.y);
          ctx.quadraticCurveTo((ROOF_RIDGE.x + tail.x) / 2 + 6 + dx, (ROOF_RIDGE.y + tail.y) / 2, tail.x + dx, tail.y);
          ctx.stroke();
        }
      }

      // In the nest she is a dark mass seen through the silk; only what
      // reaches out of the funnel (head, legs) shows in full.
      if (this.phase === 'nest' && this.alive) {
        const outline = () => {
          ctx.beginPath();
          ctx.moveTo(NEST_OUTLINE[0][0], NEST_OUTLINE[0][1]);
          for (const p of NEST_OUTLINE.slice(1)) ctx.lineTo(p[0], p[1]);
          ctx.closePath();
        };
        ctx.save();
        outline();
        ctx.rect(0, 0, 1920, 1080);
        ctx.clip('evenodd');
        rig.draw(ctx);
        ctx.restore();
        ctx.save();
        outline();
        ctx.clip();
        ctx.globalAlpha = 0.2;
        rig.draw(ctx);
        ctx.restore();
        return;
      }
      rig.draw(ctx);
    }

    drawGlow(ctx, light) {
      if (!this.alive) return;
      // A catch-light in each big eye (the runtime adds the wide eye glow),
      // and a shimmer down her line where light falls on it.
      const rig = this.rig;
      const ceph = rig.cephCenter();
      const f = rig.forward();
      const r = { x: -f.y, y: f.x };
      const s = this.scale;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      if (this.phase === 'nest') {
        ctx.beginPath();
        ctx.moveTo(NEST_OUTLINE[0][0], NEST_OUTLINE[0][1]);
        for (const p of NEST_OUTLINE.slice(1)) ctx.lineTo(p[0], p[1]);
        ctx.closePath();
        ctx.rect(0, 0, 1920, 1080);
        ctx.clip('evenodd');
      }
      rig.drawRim(ctx, 0.16 + 0.1 * (rig.flash > 0 ? 1 : 0));
      ctx.restore();
      for (const side of [-1, 1]) {
        const x = ceph.x + f.x * 11.8 * s + r.x * side * 5.5 * s;
        const y = ceph.y + f.y * 11.8 * s + r.y * side * 5.5 * s;
        S.light.glow(ctx, x, y, 12, QUEEN.eye, 0.55);
      }
      if (this.phase === 'descend' && this.lineActive && !this.stunned) {
        for (let k = 1; k <= 4; k++) {
          const u = k / 5;
          const x = S.lerp(ROOF_RIDGE.x, this.x, u);
          const y = S.lerp(ROOF_RIDGE.y, this.y, u);
          const lit = light ? Math.min(1, light.brightnessAt(x, y)) : 0.5;
          S.light.glow(ctx, x, y, 16, P.silk, 0.12 + lit * 0.25);
        }
      }
    }
  }

  // Register boss definition
  S.bosses.register({
    id: 'spider-queen',
    name: 'The Spider Queen',
    health: 60,
    phases: [
      { id: 'nest', at: 1.0 },
      { id: 'descend', at: 0.66, note: "She's coming down." },
      { id: 'rage', at: 0.33, note: "She's angry now." },
    ],
    create(world, opts) {
      return new SpiderQueen(this, world, opts);
    },
  });

  S.SpiderQueen = SpiderQueen;
})();
