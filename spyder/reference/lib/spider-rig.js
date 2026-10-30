/*
 * Spyder — the spider rig.
 *
 * Every spider in the game is this one rig, seen from above (the way you
 * see a spider on a wall or dangling in front of your face). What makes it
 * creepy is not the body, it's the legs:
 *
 *   - 8 legs, each a two-bone limb (femur + tibia) solved with IK, knees
 *     always bulging outward away from the body.
 *   - Feet are PLANTED in the world. The body slides over them, and when a
 *     foot falls too far behind its rest spot it steps — in two alternating
 *     groups of four, the way real spiders walk.
 *   - When hanging on silk the feet are not planted; they twitch and paddle.
 *
 * Proportions are exaggerated on purpose (fat abdomen, long knees, big
 * glinting eyes). That is the "stylized-creepy" agreed in ART-DIRECTION.md.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  // Per leg (front → back). Units are at scale 1.
  const LEG = {
    hipForward: [10, 4, -3, -9],
    hipLateral: [9, 12, 12, 9],
    restAngle: [0.72, 1.28, 1.86, 2.42], // radians away from the heading
    reach: [92, 82, 80, 96],
  };

  // Group A steps together, then group B. [side, index]
  const GROUP_A = [[-1, 0], [1, 1], [-1, 2], [1, 3]];

  class SpiderRig {
    constructor({ x = 0, y = 0, heading = 0, scale = 1, seed = 1, markings = true } = {}) {
      this.x = x;
      this.y = y;
      this.heading = heading;
      this.scale = scale;
      this.seed = seed;
      this.noise = S.createNoise(seed);
      this.markings = markings;

      this.mode = 'walk'; // 'walk' | 'hang'
      this.vx = 0;
      this.vy = 0;
      this.curl = 0; // 0 alive … 1 legs fully curled (dead)
      this.flash = 0; // hit flash, decays
      this.glint = 0.6; // eye shine, fed by how lit the spot is
      this.breath = 0;
      this.lift = 0; // 0 on the wall, >0 when hanging away from it (bigger shadow offset)

      this.legs = [];
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const inA = GROUP_A.some(([s, k]) => s === side && k === i);
          this.legs.push({ side, index: i, group: inA ? 'A' : 'B', foot: null, step: null });
        }
      }
      this.plantAll();
    }

    get size() {
      return 38 * this.scale;
    }

    forward() {
      return { x: Math.cos(this.heading), y: Math.sin(this.heading) };
    }

    // Where a leg's hip is in the world right now.
    hip(leg) {
      const f = this.forward();
      const r = { x: -f.y, y: f.x };
      const s = this.scale;
      const ceph = this.cephCenter();
      return {
        x: ceph.x + f.x * LEG.hipForward[leg.index] * s + r.x * leg.side * LEG.hipLateral[leg.index] * s,
        y: ceph.y + f.y * LEG.hipForward[leg.index] * s + r.y * leg.side * LEG.hipLateral[leg.index] * s,
      };
    }

    cephCenter() {
      const f = this.forward();
      return { x: this.x + f.x * 8 * this.scale, y: this.y + f.y * 8 * this.scale };
    }

    abdomenCenter() {
      const f = this.forward();
      return { x: this.x - f.x * 26 * this.scale, y: this.y - f.y * 26 * this.scale };
    }

    // The spot a foot wants to be at when the spider is standing still.
    restFoot(leg, lead = 0) {
      const hip = this.hip(leg);
      const a = this.heading + leg.side * LEG.restAngle[leg.index];
      const reach = LEG.reach[leg.index] * this.scale * S.lerp(1, 0.35, this.curl);
      return {
        x: hip.x + Math.cos(a) * reach + this.vx * lead,
        y: hip.y + Math.sin(a) * reach + this.vy * lead,
      };
    }

    plantAll() {
      for (const leg of this.legs) {
        leg.foot = this.restFoot(leg);
        leg.step = null;
      }
    }

    update(dt, time) {
      this.flash = Math.max(0, this.flash - dt * 5);
      this.breath += dt;

      if (this.mode === 'walk' && this.curl < 0.05) this.updateGait(dt);
      else this.updateDangling(time);
    }

    updateGait(dt) {
      const speed = Math.hypot(this.vx, this.vy);
      const threshold = 24 * this.scale;
      const duration = S.clamp(0.16 - speed / 3000, 0.07, 0.16);
      const stepping = { A: false, B: false };

      for (const leg of this.legs) {
        if (leg.step) {
          leg.step.t += dt / duration;
          const t = Math.min(1, leg.step.t);
          const e = S.ease.inOut(t);
          leg.foot = {
            x: S.lerp(leg.step.from.x, leg.step.to.x, e),
            y: S.lerp(leg.step.from.y, leg.step.to.y, e),
          };
          leg.lifted = Math.sin(t * Math.PI);
          if (t >= 1) {
            leg.step = null;
            leg.lifted = 0;
          } else {
            stepping[leg.group] = true;
          }
        }
      }

      // A group may only start stepping while the other group is planted.
      for (const leg of this.legs) {
        if (leg.step) continue;
        const other = leg.group === 'A' ? 'B' : 'A';
        if (stepping[other]) continue;
        const rest = this.restFoot(leg);
        if (S.dist(leg.foot.x, leg.foot.y, rest.x, rest.y) > threshold) {
          leg.step = { from: { ...leg.foot }, to: this.restFoot(leg, 0.12), t: 0 };
          stepping[leg.group] = true;
        }
      }
    }

    // On silk, or dying: legs paddle around their rest pose.
    updateDangling(time) {
      for (const leg of this.legs) {
        const rest = this.restFoot(leg);
        const k = leg.index + leg.side * 4 + this.seed;
        const twitch = 1 - this.curl;
        const hip = this.hip(leg);
        // Pull feet a little inward when hanging; spiders tuck up on silk.
        const tuck = 0.82;
        leg.foot = {
          x: S.lerp(hip.x, rest.x, tuck) + this.noise(time * 3.2 + k) * 10 * this.scale * twitch,
          y: S.lerp(hip.y, rest.y, tuck) + this.noise(time * 2.7 + k + 50) * 10 * this.scale * twitch,
        };
        leg.step = null;
        leg.lifted = 0.3;
      }
    }

    // Two-bone IK. Returns the knee position, picking the bend that pushes
    // the knee away from the body (that silhouette is what reads as "spider").
    knee(hip, foot, l1, l2) {
      const dx = foot.x - hip.x;
      const dy = foot.y - hip.y;
      const d = S.clamp(Math.hypot(dx, dy), 1, l1 + l2 - 0.5);
      const base = Math.atan2(dy, dx);
      const cosA = S.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
      const off = Math.acos(cosA);
      const k1 = { x: hip.x + Math.cos(base + off) * l1, y: hip.y + Math.sin(base + off) * l1 };
      const k2 = { x: hip.x + Math.cos(base - off) * l1, y: hip.y + Math.sin(base - off) * l1 };
      const d1 = S.dist(k1.x, k1.y, this.x, this.y);
      const d2 = S.dist(k2.x, k2.y, this.x, this.y);
      return d1 > d2 ? k1 : k2;
    }

    hitRadius() {
      return 34 * this.scale;
    }

    hitCenter() {
      return { x: this.x - Math.cos(this.heading) * 10 * this.scale, y: this.y - Math.sin(this.heading) * 10 * this.scale };
    }

    // ── Drawing ─────────────────────────────────────────────────────────

    draw(ctx) {
      // Shadow on the wall behind. Hanging spiders sit further from the wall,
      // so their shadow drifts further and fades. Kept sharp-edged and faint:
      // a live blur per spider is far too expensive.
      const off = 8 + this.lift * 18;
      ctx.save();
      ctx.globalAlpha = 0.24 - this.lift * 0.1;
      ctx.translate(off * 0.6, off);
      this.drawLegs(ctx, true);
      this.drawBody(ctx, true);
      ctx.restore();

      this.drawLegs(ctx, false);
      this.drawBody(ctx, false);

      if (this.flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = this.flash;
        this.drawBody(ctx, false, '#ffffff');
        ctx.restore();
      }
    }

    drawLegs(ctx, asShadow) {
      const s = this.scale;
      const dark = asShadow ? '#000000' : P.spiderBody;
      const joint = asShadow ? '#000000' : S.shade(P.spiderBody, 0.12);
      for (const leg of this.legs) {
        const hip = this.hip(leg);
        const reach = LEG.reach[leg.index] * s;
        const l1 = reach * 0.62;
        const l2 = reach * 0.64;
        const knee = this.knee(hip, leg.foot, l1, l2);

        // Femur: thick, with a sheen line along the top.
        S.paint.taperedLine(ctx, hip.x, hip.y, knee.x, knee.y, 6.6 * s, 4.4 * s, dark);
        // Tibia: thinner, ending in a hooked tip.
        S.paint.taperedLine(ctx, knee.x, knee.y, leg.foot.x, leg.foot.y, 4.2 * s, 1.2 * s, dark);

        if (!asShadow) {
          ctx.fillStyle = joint;
          ctx.beginPath();
          ctx.arc(knee.x, knee.y, 3.8 * s, 0, Math.PI * 2);
          ctx.fill();

          // Sheen on the femur: chitin catches light along its ridge.
          ctx.strokeStyle = S.rgba(P.spiderSheen, 0.55);
          ctx.lineWidth = 1.2 * s;
          ctx.beginPath();
          ctx.moveTo(S.lerp(hip.x, knee.x, 0.2), S.lerp(hip.y, knee.y, 0.2) - 1);
          ctx.lineTo(S.lerp(hip.x, knee.x, 0.85), S.lerp(hip.y, knee.y, 0.85) - 1);
          ctx.stroke();

          // Bristles on the tibia — a few short hairs sell the texture.
          ctx.strokeStyle = S.rgba(P.spiderBody, 0.9);
          ctx.lineWidth = 0.9;
          const ang = Math.atan2(leg.foot.y - knee.y, leg.foot.x - knee.x);
          for (let h = 0.2; h < 0.8; h += 0.2) {
            const px = S.lerp(knee.x, leg.foot.x, h);
            const py = S.lerp(knee.y, leg.foot.y, h);
            const outward = ang + leg.side * 0.9;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(outward) * 4 * s, py + Math.sin(outward) * 4 * s);
            ctx.stroke();
          }

          // Lifted feet get a faint shadow gap: reads as stepping.
          if (leg.lifted > 0.3 && this.mode === 'walk') {
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.arc(leg.foot.x + 3, leg.foot.y + 4, 2 * s, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    drawBody(ctx, asShadow, override = null) {
      const s = this.scale;
      const abd = this.abdomenCenter();
      const ceph = this.cephCenter();
      const pulse = 1 + Math.sin(this.breath * 3) * 0.025;
      const base = override || (asShadow ? '#000000' : P.spiderBody);

      // Abdomen
      ctx.save();
      ctx.translate(abd.x, abd.y);
      ctx.rotate(this.heading);
      ctx.scale(pulse, pulse);
      const rx = 34 * s;
      const ry = 26 * s;
      if (asShadow || override) {
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(-rx * 0.1, -ry * 0.45, 2, 0, 0, rx * 1.1);
        g.addColorStop(0, S.shade(P.spiderBody, 0.22));
        g.addColorStop(0.55, P.spiderBody);
        g.addColorStop(1, P.soot);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pale chevrons down the back: the spider's "face" from above.
        if (this.markings) {
          ctx.fillStyle = S.rgba(P.spiderMark, 0.75);
          for (let i = 0; i < 4; i++) {
            const x = rx * 0.5 - i * rx * 0.36;
            const w = ry * (0.55 - i * 0.1);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x - 7 * s, -w);
            ctx.lineTo(x - 11 * s, -w * 0.85);
            ctx.lineTo(x - 5 * s, 0);
            ctx.lineTo(x - 11 * s, w * 0.85);
            ctx.lineTo(x - 7 * s, w);
            ctx.closePath();
            ctx.fill();
          }
          // Two dots near the front, like eyes on the back — extra unsettling.
          ctx.fillStyle = S.rgba(P.spiderMark, 0.85);
          ctx.beginPath();
          ctx.arc(rx * 0.62, -ry * 0.28, 2.6 * s, 0, Math.PI * 2);
          ctx.arc(rx * 0.62, ry * 0.28, 2.6 * s, 0, Math.PI * 2);
          ctx.fill();
        }

        // Rim sheen
        ctx.strokeStyle = S.rgba(P.spiderSheen, 0.6);
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx - 2, ry - 2, 0, Math.PI * 1.05, Math.PI * 1.7);
        ctx.stroke();

        // Fine hairs around the edge
        ctx.strokeStyle = S.rgba(P.spiderBody, 0.8);
        ctx.lineWidth = 0.8;
        for (let a = 0; a < Math.PI * 2; a += 0.28) {
          const ex = Math.cos(a) * rx;
          const ey = Math.sin(a) * ry;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex * 1.12, ey * 1.12);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Cephalothorax and head
      ctx.save();
      ctx.translate(ceph.x, ceph.y);
      ctx.rotate(this.heading);
      const cx = 19 * s;
      const cy = 15 * s;
      if (asShadow || override) {
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.ellipse(0, 0, cx, cy, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(cx * 0.2, -cy * 0.4, 1, 0, 0, cx * 1.1);
        g.addColorStop(0, S.shade(P.spiderBody, 0.25));
        g.addColorStop(1, P.soot);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, cx, cy, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pedipalps: two short feelers that never stop moving.
        const palp = Math.sin(this.breath * 7) * 0.25;
        ctx.strokeStyle = P.spiderBody;
        ctx.lineCap = 'round';
        ctx.lineWidth = 3 * s;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx * 0.7, side * cy * 0.45);
          ctx.quadraticCurveTo(
            cx * 1.25,
            side * cy * (0.75 + palp * side),
            cx * 1.45,
            side * cy * (0.35 + palp)
          );
          ctx.stroke();
        }

        // Fangs
        ctx.fillStyle = S.shade(P.spiderBody, -0.2);
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(cx * 0.98, side * cy * 0.22, 5 * s, 3.4 * s, side * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }

        this.drawEyes(ctx, cx, cy);
      }
      ctx.restore();
    }

    drawEyes(ctx, cx, cy) {
      const s = this.scale;
      // Two big front eyes, two medium, four small: a jumping-spider face.
      const eyes = [
        [0.62, -0.26, 4.6],
        [0.62, 0.26, 4.6],
        [0.42, -0.58, 2.8],
        [0.42, 0.58, 2.8],
        [0.12, -0.5, 2.0],
        [0.12, 0.5, 2.0],
        [-0.1, -0.32, 1.7],
        [-0.1, 0.32, 1.7],
      ];
      for (const [ex, ey, r] of eyes) {
        const x = ex * cx;
        const y = ey * cy * 1.4;
        ctx.fillStyle = '#050405';
        ctx.beginPath();
        ctx.arc(x, y, r * s, 0, Math.PI * 2);
        ctx.fill();
        // The glint is what makes them feel alive and watching.
        const shine = S.clamp(this.glint * (1 - this.curl), 0, 1);
        ctx.fillStyle = S.rgba(P.spiderEye, 0.35 + shine * 0.6);
        ctx.beginPath();
        ctx.arc(x - r * 0.3 * s, y - r * 0.3 * s, r * 0.42 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = S.rgba('#ffffff', 0.3 + shine * 0.6);
        ctx.beginPath();
        ctx.arc(x - r * 0.35 * s, y - r * 0.38 * s, r * 0.18 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Where the eyes are, so the scene can add a bloom glint after lighting.
    eyePoint() {
      const ceph = this.cephCenter();
      const f = this.forward();
      return { x: ceph.x + f.x * 12 * this.scale, y: ceph.y + f.y * 12 * this.scale };
    }
  }

  S.SpiderRig = SpiderRig;
})();
