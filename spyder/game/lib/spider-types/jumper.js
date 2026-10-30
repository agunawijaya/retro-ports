/*
 * Jumper: lives on the furniture, not on the wall. It prowls along the
 * counter, the table or the floor, and when the hero comes within reach it
 * crouches, then leaps at where the hero is about to be. Shot in mid-air it
 * is "Swatted!" for a bonus. First seen in the Kitchen (DESIGN.md §6).
 *
 * It is the same SpiderRig as every other spider (ART-DIRECTION.md §7: new
 * types are new brains). The rig is subclassed here, not changed, for three
 * things the rig cannot be told through its constructor:
 *
 *   1. Silhouette. Pairs 3 and 4 reach 1.15× further and their femurs are
 *      1.4× thicker ("built to jump"), and the abdomen carries three pale
 *      transverse bands instead of chevrons.
 *   2. Standing on a surface. Every other spider is seen flat against the
 *      wall. A spider standing on a counter is seen from above at an angle,
 *      so its leg plane is squashed vertically, its feet sit on the surface
 *      line and its knees rise above the body. In the air the squash relaxes
 *      and the full splayed spider shows.
 *   3. Poses the rig does not have: the crouch (body down, legs gathered,
 *      front pair raised and waving), the splayed leap, and a quick scurry
 *      for the moments it moves in depth (out from under the fridge).
 *
 * States (prompts/02-kitchen.md):
 *
 *   emerge → prowl → crouch → leap → land → recover → prowl …
 *   a hit in any state kills it; a hit during `leap` is "Swatted!" (+100).
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  // ── The look ────────────────────────────────────────────────────────

  const SCALE = 0.9;

  const REACH_MULT = [1, 1, 1.15, 1.15];
  const FEMUR_MULT = [1, 1, 1.4, 1.4];
  // In the air all 8 legs splay symmetrically outward around π/2.
  const SPLAY_ANGLE = [0.46, 1.08, 2.06, 2.68];

  class JumperRig extends S.SpiderRig {
    constructor(opts) {
      // No chevrons and no false eyes: the bands below replace them.
      super({ ...opts, markings: false, legReach: REACH_MULT, legFemur: FEMUR_MULT });
      this.pose = 'walk'; // 'walk' | 'scurry' | 'crouch' | 'air' | 'dead'
      this.k = 0.5; // vertical squash of the leg plane (how deep the surface reads)
      this.kBody = 0.62; // vertical squash of the body at the same angle
      this.feetY = this.y + 12 * this.scale; // screen y of the surface the feet stand on
      this.kneeLift = 25 * this.scale; // how far knees rise above the surface
      this.squash = 0; // crouch: 0 standing … 1 gathered to jump
      this.frontLift = 0; // the crouch telegraph: front pair raised and waving
      this.reachScale = 1; // legs pulled in while crouching
      this.hidden = false; // not yet out of its hiding place: darts pass by
      this.shadow = null; // contact shadow, set by the brain every frame
      this.scurryPhase = 0;
      this.scurrySpeed = 0;
      this.plantAll();
    }

    // Same as the rig, scaled by reachScale when gathered to crouch.
    restFoot(leg, lead = 0) {
      const hip = this.hip(leg);
      const a = this.heading + leg.side * this.restAngleOf(leg.index);
      const reach = this.reachOf(leg.index) * (this.reachScale ?? 1) * S.lerp(1, 0.35, this.curl);
      return {
        x: hip.x + Math.cos(a) * reach + this.vx * lead,
        y: hip.y + Math.sin(a) * reach + this.vy * lead,
      };
    }

    update(dt, time) {
      if (this.pose === 'walk' || this.pose === 'dead') {
        this.mode = this.pose === 'walk' ? 'walk' : 'hang';
        super.update(dt, time); // planted gait, or paddling and curling when dead
        return;
      }
      this.flash = Math.max(0, this.flash - dt * 5);
      this.breath += dt;
      if (this.pose === 'air') this.splay(time);
      else if (this.pose === 'crouch') this.gather(dt);
      else this.scurry(dt);
    }

    // In the air: all 8 legs splayed fully outward, symmetric, with a slight flutter.
    splay(time) {
      for (const leg of this.legs) {
        const hip = this.hip(leg);
        const a = this.heading + leg.side * SPLAY_ANGLE[leg.index];
        const reach = this.reachOf(leg.index) * 1.06 * S.lerp(1, 0.4, this.curl);
        const k = leg.index + leg.side * 4 + this.seed;
        leg.foot = {
          x: hip.x + Math.cos(a) * reach + this.noise(time * 5 + k) * 2.5 * this.scale,
          y: hip.y + Math.sin(a) * reach + this.noise(time * 4.4 + k + 30) * 2.5 * this.scale,
        };
        leg.step = null;
        leg.lifted = 0;
      }
    }

    // Crouching: the feet stay down but slide in under the body.
    gather(dt) {
      for (const leg of this.legs) {
        const rest = this.restFoot(leg);
        leg.foot = { x: S.damp(leg.foot.x, rest.x, 12, dt), y: S.damp(leg.foot.y, rest.y, 12, dt) };
        leg.step = null;
        leg.lifted = 0;
      }
    }

    // A quick alternating patter for moving in depth (toward the camera),
    // where planted feet would slide: rest pose plus a stride, group A
    // against group B.
    scurry(dt) {
      this.scurryPhase += dt * (8 + this.scurrySpeed / 8);
      const f = this.forward();
      const stride = 10 * this.scale;
      for (const leg of this.legs) {
        const rest = this.restFoot(leg);
        const sign = leg.group === 'A' ? 1 : -1;
        const swing = Math.sin(this.scurryPhase) * sign;
        leg.foot = { x: rest.x + f.x * stride * swing, y: rest.y + f.y * stride * swing };
        leg.lifted = Math.max(0, Math.cos(this.scurryPhase) * sign);
        leg.step = null;
      }
    }

    // ── Projection: from the rig's flat plane to the stage ──────────────
    // The rig works in a flat plane whose y doubles as depth. Feet are put
    // on the surface line, squashed by `k`; knees are lifted; the body is
    // squashed about its own centre. In the air feetY sits at the body and
    // kneeLift is 0, which is the plain dorsal view.

    toScreen(p, part) {
      if (part === 'body') return { x: p.x, y: this.y + (p.y - this.y) * this.kBody };
      const y = this.feetY + (p.y - this.y) * this.k;
      return { x: p.x, y: part === 'knee' ? y - this.kneeLift : y };
    }

    hitCenter() {
      if (this.hidden) return { x: -9999, y: -9999 };
      return this.toScreen(super.hitCenter(), 'body');
    }

    eyePoint() {
      return this.toScreen(super.eyePoint(), 'body');
    }

    // ── Drawing ─────────────────────────────────────────────────────────

    draw(ctx) {
      // On a counter or the floor the shadow lies under it, not on the wall.
      const sh = this.shadow;
      if (sh && sh.alpha > 0.01) S.paint.softShadow(ctx, sh.x, sh.y, sh.rx, sh.ry, sh.alpha);
      this.drawLegs(ctx);
      this.drawBody(ctx, false);
      if (this.flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = this.flash;
        this.drawBody(ctx, false, '#ffffff');
        ctx.restore();
      }
    }

    drawLegs(ctx) {
      const s = this.scale;
      const dark = P.spiderBody;
      const joint = S.shade(P.spiderBody, 0.12);
      for (const leg of this.legs) {
        const i = leg.index;
        const hipFlat = this.hip(leg);
        const reach = this.reachOf(i);
        const kneeFlat = this.knee(hipFlat, leg.foot, reach * 0.62, reach * 0.64);

        const hip = this.toScreen(hipFlat, 'body');
        let knee = this.toScreen(kneeFlat, 'knee');
        let foot = this.toScreen(leg.foot, 'foot');
        const ground = { ...foot };

        // A stepping foot visibly leaves the surface.
        if (leg.lifted > 0 && this.pose !== 'air') {
          foot = { x: foot.x, y: foot.y - leg.lifted * 7 * s };
          knee = { x: knee.x, y: knee.y - leg.lifted * 4 * s };
        }
        // The telegraph: the front pair comes up off the surface and waves.
        if (i === 0 && this.frontLift > 0.01) {
          const wave = 0.5 + 0.5 * Math.sin(this.breath * 13 + leg.side * 1.9);
          const up = this.frontLift * (34 + 16 * wave) * s;
          foot = { x: S.lerp(foot.x, hip.x, 0.22 * this.frontLift), y: foot.y - up };
          knee = { x: knee.x, y: knee.y - up * 0.65 };
        }

        const fm = this.legFemur[i] ?? 1;
        S.paint.taperedLine(ctx, hip.x, hip.y, knee.x, knee.y, 6.6 * s * fm, 4.4 * s * (fm > 1 ? 1.25 : 1), dark);
        S.paint.taperedLine(ctx, knee.x, knee.y, foot.x, foot.y, 4.2 * s * (fm > 1 ? 1.15 : 1), 1.4 * s, dark);

        const ang = Math.atan2(foot.y - knee.y, foot.x - knee.x);
        // In the air, leg tips curl slightly inward at the tarsus.
        if (this.pose === 'air') {
          const curlAng = ang + leg.side * 0.62;
          const tipLen = 9 * s;
          const midX = foot.x + Math.cos(ang + leg.side * 0.25) * tipLen * 0.55;
          const midY = foot.y + Math.sin(ang + leg.side * 0.25) * tipLen * 0.55;
          const tipX = foot.x + Math.cos(curlAng) * tipLen;
          const tipY = foot.y + Math.sin(curlAng) * tipLen;
          ctx.strokeStyle = dark;
          ctx.lineCap = 'round';
          ctx.lineWidth = 1.6 * s;
          ctx.beginPath();
          ctx.moveTo(foot.x, foot.y);
          ctx.quadraticCurveTo(midX, midY, tipX, tipY);
          ctx.stroke();
        }

        ctx.fillStyle = joint;
        ctx.beginPath();
        ctx.arc(knee.x, knee.y, 3.8 * s * (fm > 1 ? 1.2 : 1), 0, Math.PI * 2);
        ctx.fill();

        // Sheen along the femur; the thick ones catch more of it.
        ctx.strokeStyle = S.rgba(P.spiderSheen, fm > 1 ? 0.7 : 0.55);
        ctx.lineWidth = 1.2 * s * fm;
        ctx.beginPath();
        ctx.moveTo(S.lerp(hip.x, knee.x, 0.2), S.lerp(hip.y, knee.y, 0.2) - 1);
        ctx.lineTo(S.lerp(hip.x, knee.x, 0.85), S.lerp(hip.y, knee.y, 0.85) - 1);
        ctx.stroke();

        // Bristles on the tibia.
        ctx.strokeStyle = S.rgba(P.spiderBody, 0.9);
        ctx.lineWidth = 0.9;
        for (let h = 0.2; h < 0.8; h += 0.2) {
          const px = S.lerp(knee.x, foot.x, h);
          const py = S.lerp(knee.y, foot.y, h);
          const outward = ang + leg.side * 0.9;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(outward) * 4 * s, py + Math.sin(outward) * 4 * s);
          ctx.stroke();
        }

        // Where a lifted foot will come down.
        if (leg.lifted > 0.3 && this.pose === 'walk') {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.ellipse(ground.x, ground.y + 1, 2.6 * s, 1.2 * s, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    drawBody(ctx, asShadow, override = null) {
      ctx.save();
      // Seen from above at an angle, flattened when crouching, and stretched
      // ~10% along the direction of travel when airborne.
      ctx.translate(this.x, this.y);
      ctx.scale(1 + this.squash * 0.08, this.kBody * (1 - this.squash * 0.15));
      if (this.pose === 'air') {
        ctx.rotate(this.heading);
        ctx.scale(1.16, 0.88);
        ctx.rotate(-this.heading);
      }
      ctx.translate(-this.x, -this.y);
      super.drawBody(ctx, asShadow, override);
      if (!asShadow && !override) this.drawBands(ctx);
      ctx.restore();
    }

    // Draw a full splayed silhouette (legs + stretched body) for motion ghosts
    // in the spider's dark body colours (spiderBody / spiderSheen), not pale.
    drawGhostSilhouette(ctx, gx, gy, heading, alpha) {
      const s = this.scale;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(gx, gy);
      ctx.scale(1, this.k);
      ctx.rotate(heading);

      const bodyCol = P.spiderBody;
      const sheenCol = P.spiderSheen;
      const bandCol = S.mixHex(P.spiderBody, P.spiderSheen, 0.75);
      ctx.fillStyle = bodyCol;
      ctx.strokeStyle = sheenCol;
      ctx.lineCap = 'round';

      // All 8 splayed legs with curled tips in local heading space
      for (const leg of this.legs) {
        const i = leg.index;
        const hipX = (8 + [10, 4, -3, -9][i]) * s;
        const hipY = leg.side * [9, 12, 12, 9][i] * s;
        const a = leg.side * SPLAY_ANGLE[i];
        const reach = this.reachOf(i) * 1.06;
        const footX = hipX + Math.cos(a) * reach;
        const footY = hipY + Math.sin(a) * reach;
        const l1 = reach * 0.62;
        const l2 = reach * 0.64;
        const dx = footX - hipX;
        const dy = footY - hipY;
        const d = S.clamp(Math.hypot(dx, dy), 1, l1 + l2 - 0.5);
        const base = Math.atan2(dy, dx);
        const off = Math.acos(S.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
        const k1 = { x: hipX + Math.cos(base + off) * l1, y: hipY + Math.sin(base + off) * l1 };
        const k2 = { x: hipX + Math.cos(base - off) * l1, y: hipY + Math.sin(base - off) * l1 };
        const knee = Math.hypot(k1.x, k1.y) > Math.hypot(k2.x, k2.y) ? k1 : k2;

        const fm = this.legFemur[i] ?? 1;
        S.paint.taperedLine(ctx, hipX, hipY, knee.x, knee.y, 6.4 * s * fm, 4.3 * s * (fm > 1 ? 1.2 : 1), bodyCol);
        S.paint.taperedLine(ctx, knee.x, knee.y, footX, footY, 4.1 * s * (fm > 1 ? 1.15 : 1), 1.5 * s, bodyCol);

        // Knee joint cap and femur sheen in spiderSheen
        ctx.fillStyle = sheenCol;
        ctx.beginPath();
        ctx.arc(knee.x, knee.y, 3.4 * s * (fm > 1 ? 1.15 : 1), 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = sheenCol;
        ctx.lineWidth = 1.2 * s * fm;
        ctx.beginPath();
        ctx.moveTo(S.lerp(hipX, knee.x, 0.22), S.lerp(hipY, knee.y, 0.22) - 1);
        ctx.lineTo(S.lerp(hipX, knee.x, 0.82), S.lerp(hipY, knee.y, 0.82) - 1);
        ctx.stroke();

        const ang = Math.atan2(footY - knee.y, footX - knee.x);
        const curlAng = ang + leg.side * 0.62;
        const tipLen = 9 * s;
        ctx.strokeStyle = bodyCol;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(footX, footY);
        ctx.lineTo(footX + Math.cos(curlAng) * tipLen, footY + Math.sin(curlAng) * tipLen);
        ctx.stroke();
      }

      // Stretched abdomen + cephalothorax silhouette in spiderBody with spiderSheen rim
      ctx.scale(1.16, 0.88);
      ctx.fillStyle = bodyCol;
      ctx.strokeStyle = sheenCol;
      ctx.beginPath();
      ctx.ellipse(-26 * s, 0, 34 * s, 26 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(8 * s, 0, 19 * s, 15 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.6 * s;
      ctx.stroke();
      ctx.fillStyle = bandCol;
      for (const [f, width] of [[-0.56, 5.5], [-0.2, 6.4], [0.16, 5.8]]) {
        const x = -26 * s + f * 34 * s;
        const h = 26 * s * Math.sqrt(1 - f * f) * 0.8;
        ctx.fillRect(x - (width * s) / 2, -h, width * s, h * 2);
      }
      ctx.restore();
    }

    // Three pale bands across the abdomen, bowed slightly so they wrap it.
    drawBands(ctx) {
      const s = this.scale;
      const abd = this.abdomenCenter();
      const pulse = 1 + Math.sin(this.breath * 3) * 0.025;
      const rx = 34 * s;
      const ry = 26 * s;
      ctx.save();
      ctx.translate(abd.x, abd.y);
      ctx.rotate(this.heading);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = S.rgba(P.spiderMark, 0.88);
      for (const [f, width] of [[-0.56, 6], [-0.2, 7], [0.16, 6.2]]) {
        const x = f * rx;
        const h = ry * Math.sqrt(1 - f * f) * 0.86;
        const w = width * s;
        const bow = 4 * s;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, -h);
        ctx.quadraticCurveTo(x - w / 2 - bow, 0, x - w / 2, h);
        ctx.lineTo(x + w / 2, h * 0.92);
        ctx.quadraticCurveTo(x + w / 2 - bow, 0, x + w / 2, -h * 0.92);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ── The brain ───────────────────────────────────────────────────────

  const G = 2200; // gravity in flight, stage units/s²
  const REACH = 520; // how close the hero must be (horizontally) before it crouches
  const LIFT = 12; // body height above its surface, at scale 1
  const CROUCH_LIFT = 5;
  const PROWL_SPEED = 125;
  const LAND_TIME = 0.16;
  const RECOVER_TIME = 1.2;
  const AIR_K = 0.82;

  // How a surface reads at this camera: the floor is seen deep, a ledge
  // (counter, table, stool) almost edge-on, and the feet stand a few units
  // back from its front edge.
  function surfaceLook(p) {
    return p && p.oneWay ? { k: 0.32, inset: 6 } : { k: 0.5, inset: 0 };
  }

  class Jumper {
    constructor({ world, lair, seed, first }) {
      const L = world.layout;
      this.kind = 'jumper';
      this.points = 180;
      this.rng = S.createRng(seed);
      this.noise = S.createNoise(seed + 5);
      this.platforms = L.platforms;
      this.bounds = L.bounds;
      this.ceiling = L.CEILING;
      this.first = first;
      // The room's first Jumper takes its time, so the player learns the tell.
      this.crouchTime = first ? 0.9 : 0.45;

      this.lair = lair;
      this.surface = L.platforms.find((p) => p.name === lair.surface) || L.platforms.find((p) => !p.oneWay) || L.platforms[0];
      this.gy = lair.from.y; // the surface under the feet (in flight: the feet)
      const look = surfaceLook(this.surface);
      const heading = lair.heading ?? 0;
      this.rig = new JumperRig({ x: lair.from.x, y: this.gy - look.inset - LIFT * SCALE, heading, scale: SCALE, seed });
      this.rig.k = look.k;
      this.rig.feetY = this.gy - look.inset;
      this.facing = Math.cos(heading) < -0.1 ? -1 : 1;

      this.state = 'emerge';
      this.timer = 0;
      this.age = 0;
      this.prowlTime = 0;
      this.freeze = 0;
      this.nextFreeze = this.rng.range(1.2, 2.6);
      this.vx = 0;
      this.vy = 0;
      this.spin = 0;
      this.hold = 0; // QA staging: seconds to stay exactly as placed
      this.alpha = 1;
      this.clip = null;
      this.lying = 0;
      this.disgustIn = 0;
      this.alive = true;
      this.done = false;
    }

    get visible() {
      return this.alive && !this.rig.hidden;
    }

    // ── Update ────────────────────────────────────────────────────────

    update(dt, world) {
      // `sim` moves the spider; `dt` keeps it breathing. QA staging can hold
      // a pose (mid-leap, mid-crouch) by zeroing the first.
      if (this.hold > 0) this.hold -= dt;
      const sim = this.hold > 0 ? 0 : dt;
      this.age += sim;
      this.timer += sim;

      switch (this.state) {
        case 'emerge':
          this.emerge(sim, dt, world);
          break;
        case 'prowl':
          this.prowl(sim, dt, world);
          break;
        case 'crouch':
          this.crouch(sim, dt, world);
          break;
        case 'leap':
          this.leap(sim, dt, world);
          break;
        case 'land':
        case 'recover':
          this.settle(sim, dt, world);
          break;
        case 'tumble':
        case 'dying':
          this.fall(sim, dt, world);
          break;
      }

      // The hurt face first, then the disgust (they cannot overlap).
      if (this.disgustIn > 0) {
        this.disgustIn -= dt;
        if (this.disgustIn <= 0) world.hero.feel('disgusted', 0.9);
      }
      this.finishFrame(dt, world);
    }

    // Common to every state: eye shine, the shadow under it, the legs.
    finishFrame(dt, world) {
      const r = this.rig;
      const tell = this.state === 'crouch' ? 0.7 * r.squash : 0; // the eyes flare as it gathers
      r.glint = world.light.brightnessAt(r.x, r.y) + 0.3 + tell;

      const look = surfaceLook(this.surface);
      if (this.state === 'leap' || (this.state === 'tumble' && this.lying <= 0)) {
        const below = world.floorAt(r.x, this.gy) ?? this.gy;
        const height = Math.max(0, below - this.gy);
        const k = S.clamp(1 - height / 520, 0.56, 1);
        const surf = this.platformAt(r.x, below);
        this.airShadow = {
          x: r.x,
          y: below - surfaceLook(surf).inset,
          rx: 86 * SCALE * k,
          ry: 19 * SCALE * k,
          alpha: S.lerp(0.42, 0.58, k),
        };
        r.shadow = null;
      } else {
        this.airShadow = null;
        r.shadow = { x: r.x, y: this.gy - look.inset + 2, rx: 46 * SCALE, ry: 9 * SCALE, alpha: 0.5 * this.alpha };
      }
      r.update(dt, world.time);
    }

    platformAt(x, y) {
      return this.platforms.find((p) => x >= p.x0 && x <= p.x1 && Math.abs(p.y - y) < 2) || null;
    }

    // Damp the rig toward the standing pose on the current surface.
    stand(dt, lift = LIFT, rate = 14) {
      const r = this.rig;
      const look = surfaceLook(this.surface);
      r.k = S.damp(r.k, look.k, rate, dt);
      r.kBody = S.damp(r.kBody, 0.62, rate, dt);
      r.feetY = this.gy - look.inset;
      r.y = r.feetY - lift * SCALE;
      r.kneeLift = S.damp(r.kneeLift, (lift + 13) * SCALE, rate, dt);
    }

    faceHeading() {
      return this.facing > 0 ? 0 : Math.PI;
    }

    // Turn toward `facing`. From 0 to π the shortest way is ambiguous; it
    // turns through π/2, toward the camera, which reads as "it looked at me".
    turn(dt, rate = 7) {
      const r = this.rig;
      const d = S.angleDelta(r.heading, this.faceHeading());
      r.heading += S.clamp(d, -rate * dt, rate * dt);
      return Math.cos(d); // 1 = facing the right way
    }

    // Out of its hiding place: from under the fridge (in depth, toward the
    // camera), from behind the stove (a walk), out of the sink (a climb).
    emerge(sim, dt, world) {
      const lair = this.lair;
      const r = this.rig;
      const k = S.clamp(this.timer / (lair.time ?? 1), 0, 1);
      const e = S.ease.inOut(k);
      const x = S.lerp(lair.from.x, lair.to.x, e);
      const y = S.lerp(lair.from.y, lair.to.y, e);
      const moved = Math.hypot(x - r.x, y - this.gy);
      r.vx = sim > 0 ? (x - r.x) / sim : 0;
      r.vy = 0;
      r.x = x;
      this.gy = y;
      r.pose = lair.moves === 'walk' ? 'walk' : 'scurry';
      r.scurrySpeed = sim > 0 ? moved / sim : 0;
      r.frontLift = lair.moves === 'climb' ? S.damp(r.frontLift, k < 0.8 ? 1 : 0, 10, dt) : 0;
      this.alpha = lair.fade ? S.clamp(k * 2.2, 0, 1) : 1;
      this.clip = lair.clip ?? null;
      // Last third: turn to face the hero.
      if (k > 0.66) {
        this.facing = Math.sign(world.hero.x - r.x) || this.facing;
        this.turn(dt, 5);
      }
      this.stand(dt);
      // Darts pass it by while its body is still behind cover or in the dark.
      const c = this.clip;
      const covered = c && (r.x < c.x0 || r.x > c.x1 || r.y < c.y0 || r.y > c.y1);
      r.hidden = Boolean(covered) || this.alpha < 0.5;
      if (k >= 1) this.becomeProwler();
    }

    becomeProwler() {
      const r = this.rig;
      this.state = 'prowl';
      this.timer = 0;
      this.prowlTime = 0;
      this.clip = null;
      this.alpha = 1;
      r.hidden = false;
      r.pose = 'walk';
      r.frontLift = 0;
      r.plantAll();
    }

    prowl(sim, dt, world) {
      const r = this.rig;
      const hero = world.hero;
      const p = this.surface;
      this.prowlTime += sim;
      const lo = Math.max(p.x0, this.bounds.left) + 16;
      const hi = Math.min(p.x1, this.bounds.right) - 16;
      const dx = hero.x - r.x;
      const dir = Math.abs(dx) > 10 ? Math.sign(dx) : this.facing;

      // Stops dead now and then, like the Wall Crawler.
      let speed = 0;
      if (this.freeze > 0) {
        this.freeze -= sim;
        r.heading += this.noise(world.time * 9) * 0.6 * sim; // a twitch
      } else {
        this.nextFreeze -= sim;
        if (this.nextFreeze <= 0) {
          this.freeze = this.rng.range(0.35, 0.9);
          this.nextFreeze = this.rng.range(1.4, 3);
        }
        speed = PROWL_SPEED * (0.55 + 0.9 * Math.max(0, this.noise(world.time * 1.1)));
      }

      // At the end of a ledge with the hero out of reach: hop down (with the
      // same crouch first, so even this is telegraphed).
      const atEdge = (dir < 0 && r.x <= lo) || (dir > 0 && r.x >= hi);
      if (atEdge) {
        speed = 0;
        if (p.oneWay && Math.abs(dx) > REACH && this.prowlTime > 0.6) {
          const hx = S.clamp(r.x + dir * 120, this.bounds.left + 30, this.bounds.right - 30);
          const hy = world.floorAt(hx, p.y + 10) ?? p.y;
          this.facing = dir;
          return this.startCrouch(world, { x: hx, y: hy });
        }
      }

      this.facing = dir;
      const aligned = this.turn(dt);
      r.vx = dir * speed * Math.max(0, aligned) * (sim > 0 ? 1 : 0);
      r.vy = 0;
      r.x = S.clamp(r.x + r.vx * sim, lo, hi);
      this.stand(dt);

      if (this.prowlTime > 0.35 && aligned > 0.7 && this.inReach(world)) this.startCrouch(world);
    }

    inReach(world) {
      const hero = world.hero;
      if (world.state !== 'playing' || hero.nerve <= 0) return false;
      const dy = hero.y - this.gy;
      return Math.abs(hero.x - this.rig.x) < REACH && dy > -330 && dy < 280;
    }

    startCrouch(world, hop = null) {
      const r = this.rig;
      this.state = 'crouch';
      this.timer = 0;
      this.hop = hop;
      const tx = hop ? hop.x : world.hero.x;
      this.facing = Math.sign(tx - r.x) || this.facing;
      r.vx = r.vy = 0;
      r.pose = 'crouch';
      world.burst.dustPuff(r.x, this.gy - surfaceLook(this.surface).inset, 4, 22);
      this.hiss(world);
    }

    // A short hiss that rises as the spider gathers itself.
    hiss(world) {
      const audio = world.audio;
      if (!audio || !audio.ctx || audio.muted) return;
      audio.noise({ duration: this.crouchTime + 0.08, filter: 'bandpass', freq: 1800, freqEnd: 6200, q: 1.2, gain: 0.13, attack: this.crouchTime * 0.85 });
    }

    // Compute the ballistic arc toward where the hero is about to be.
    predictArc(world) {
      const r = this.rig;
      const hero = world.hero;
      let tx;
      let ty;
      if (this.hop) {
        tx = this.hop.x;
        ty = this.hop.y;
      } else {
        // Not where the hero is: where the hero will be 0.3 s from now.
        tx = hero.x + hero.vx * 0.3;
        ty = hero.onGround ? hero.y : world.floorAt(tx, hero.y) ?? hero.y;
      }
      tx = S.clamp(tx, this.bounds.left + 20, this.bounds.right - 20);
      const dx = tx - r.x;
      const T = S.clamp(0.55 + 0.25 * Math.min(1, Math.abs(dx) / REACH), 0.55, 0.8);
      const vx = dx / T;
      const vy = (ty - this.gy - 0.5 * G * T * T) / T;
      return { tx, ty, dx, T, vx, vy, x0: r.x, y0: r.y };
    }

    // The tell. Players must always see a leap coming: the body drops and
    // flattens, the legs pull in, the front pair comes up and waves, the
    // eyes flare, a faint chalk-dotted arc shows the trajectory, and at the
    // end the whole body trembles.
    crouch(sim, dt, world) {
      const r = this.rig;
      const k = S.clamp(this.timer / this.crouchTime, 0, 1);
      r.squash = S.ease.out(Math.min(1, k * 2.2));
      r.reachScale = S.lerp(1, 0.8, r.squash);
      r.frontLift = S.ease.out(Math.min(1, k * 2));
      this.turn(dt, 9);
      this.stand(dt, S.lerp(LIFT, CROUCH_LIFT, r.squash), 20);
      r.kneeLift = (S.lerp(LIFT, CROUCH_LIFT, r.squash) + 13 + 9 * r.squash) * SCALE;
      this.predictedArc = this.predictArc(world);
      if (k > 0.6) r.y += Math.sin(world.time * 90) * 1.1 * (k - 0.6) * 2.5; // trembling
      if (this.timer >= this.crouchTime) this.launch(world);
    }

    launch(world) {
      const r = this.rig;
      const arc = this.predictArc(world);
      this.vx = arc.vx;
      this.vy = arc.vy;
      this.facing = Math.sign(arc.dx) || this.facing;
      this.state = 'leap';
      this.timer = 0;
      this.trail = [];
      this.predictedArc = null;
      r.pose = 'air';
      r.squash = 0;
      r.reachScale = 1;
      r.frontLift = 0;
      world.burst.dustPuff(r.x, this.gy - surfaceLook(this.surface).inset, 6, 36);
      const audio = world.audio;
      if (audio && audio.ctx && !audio.muted) audio.noise({ duration: 0.22, filter: 'bandpass', freq: 700, freqEnd: 2600, q: 0.9, gain: 0.08, attack: 0.03 });
    }

    // Splayed, nose oriented along its velocity vector.
    airPose(dt) {
      const r = this.rig;
      r.k = S.damp(r.k, AIR_K, 16, dt);
      r.kBody = S.damp(r.kBody, 0.84, 16, dt);
      r.kneeLift = S.damp(r.kneeLift, 0, 16, dt);
      r.y = this.gy - 10 * SCALE;
      r.feetY = r.y + 3 * SCALE;
      if (Math.abs(this.vx) > 20 || Math.abs(this.vy) > 20) {
        r.heading = Math.atan2(this.vy * 0.72, this.vx);
      }
    }

    leap(sim, dt, world) {
      const r = this.rig;
      const before = this.gy;
      this.vy += G * sim;
      this.gy += this.vy * sim;
      let x = r.x + this.vx * sim;
      const lo = this.bounds.left + 10;
      const hi = this.bounds.right - 10;
      if (x < lo || x > hi) {
        x = S.clamp(x, lo, hi);
        this.vx = 0; // hit the side wall: slide down it
      }
      r.x = x;
      r.vx = this.vx;
      r.vy = this.vy;
      if (this.gy - 70 < this.ceiling) {
        this.gy = this.ceiling + 70;
        this.vy = Math.max(this.vy, 0);
      }
      if (this.vy > 0) {
        const p = this.crossed(before, this.gy, x);
        if (p) return this.land(world, p);
      }
      this.airPose(dt);
      if (sim > 0) {
        this.trail.push({ x: r.x, y: r.y });
        if (this.trail.length > 6) this.trail.shift();
      }
    }

    // The highest platform the feet passed down through this step.
    crossed(from, to, x) {
      let best = null;
      for (const p of this.platforms) {
        if (x < p.x0 || x > p.x1) continue;
        if (from <= p.y + 1 && to >= p.y && (!best || p.y < best.y)) best = p;
      }
      return best;
    }

    land(world, p) {
      const r = this.rig;
      this.surface = p;
      this.gy = p.y;
      this.vx = this.vy = 0;
      this.state = 'land';
      this.timer = 0;
      r.pose = 'walk';
      r.vx = r.vy = 0;
      r.heading = this.faceHeading();
      this.stand(1); // snap onto the surface…
      r.plantAll();
      r.squash = 0.9; // …and squash on impact
      const look = surfaceLook(p);
      world.burst.dustPuff(r.x, p.y - look.inset, 8, 46);
      world.sfx('stomp', 0.3);

      // Landing on the hero, or right beside him.
      const hero = world.hero;
      if (Math.hypot(hero.x - r.x, hero.y - p.y) < 50) {
        if (world.hurtHero(12)) this.disgustIn = 0.72;
        hero.feel('disgusted', 1);
      }
    }

    // Land, then recover: still, palps going, turning to keep the hero in view.
    settle(sim, dt, world) {
      const r = this.rig;
      r.squash = S.damp(r.squash, 0, 9, dt);
      this.facing = Math.sign(world.hero.x - r.x) || this.facing;
      this.turn(dt, 4);
      this.stand(dt, S.lerp(LIFT, CROUCH_LIFT, r.squash));
      if (this.state === 'land' && this.timer >= LAND_TIME) {
        this.state = 'recover';
        this.timer = 0;
      } else if (this.state === 'recover' && this.timer >= RECOVER_TIME) {
        this.becomeProwler();
      }
    }

    fall(sim, dt, world) {
      const r = this.rig;
      r.curl = Math.min(1, r.curl + dt * 4);
      if (this.lying > 0) {
        this.lying -= sim;
        if (this.lying <= 0) this.done = true;
        return;
      }
      const before = this.gy;
      this.vy += G * sim;
      this.gy += this.vy * sim;
      r.x = S.clamp(r.x + this.vx * sim, this.bounds.left, this.bounds.right);
      r.heading += this.spin * sim;
      r.k = S.damp(r.k, 0.8, 10, dt);
      r.kBody = S.damp(r.kBody, 0.8, 10, dt);
      r.kneeLift = S.damp(r.kneeLift, 0, 10, dt);
      r.y = this.gy - 10 * SCALE;
      r.feetY = r.y;
      if (this.vy > 0) {
        const p = this.crossed(before, this.gy, r.x);
        if (p) {
          this.surface = p;
          this.gy = p.y;
          r.y = p.y - surfaceLook(p).inset - 4;
          r.feetY = r.y;
          world.splat(r.x, p.y - surfaceLook(p).inset - 4, 0.7);
          this.lying = 0.35;
        }
      }
      if (this.gy > 1200) this.done = true;
    }

    // ── Being hit ────────────────────────────────────────────────────

    kill(world, how = 'shot') {
      if (!this.alive) return undefined;
      const r = this.rig;
      const midAir = this.state === 'leap';
      this.alive = false;
      r.flash = 1;
      r.hidden = false;
      r.pose = 'dead';
      r.squash = 0;
      r.frontLift = 0;
      this.clip = null;
      this.alpha = 1;
      const c = r.hitCenter();
      world.splat(c.x, c.y, midAir ? 1.1 : 0.9);
      if (midAir) {
        // Swatted: it tumbles out of the air.
        this.state = 'tumble';
        this.vx *= 0.45;
        this.vy = Math.min(this.vy, -160);
        this.spin = this.rng.sign() * this.rng.range(7, 11);
        return { bonus: 100, label: 'Swatted!' };
      }
      this.state = 'dying';
      this.vx = this.rng.range(-60, 60);
      this.vy = -240;
      this.spin = this.rng.range(-6, 6);
      void how;
      return undefined;
    }

    // ── Drawing ──────────────────────────────────────────────────────

    draw(ctx) {
      ctx.save();
      if (this.alpha < 1) ctx.globalAlpha = this.alpha;
      if (this.clip) {
        const c = this.clip;
        ctx.beginPath();
        ctx.rect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
        ctx.clip();
      }
      if (this.airShadow) this.drawAirShadow(ctx, this.airShadow);
      if (this.state === 'crouch' || this.state === 'leap') this.drawTelegraphArc(ctx);
      if (this.state === 'leap') this.drawStreak(ctx);
      this.rig.draw(ctx);
      ctx.restore();
    }

    // Soft dark ellipse on the surface directly under the airborne Jumper,
    // holding a clear ~0.3 body alpha before feathering at the rim.
    drawAirShadow(ctx, sh) {
      if (!sh || sh.rx <= 0 || sh.ry <= 0) return;
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.scale(1, sh.ry / sh.rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sh.rx);
      const a = sh.alpha;
      g.addColorStop(0, `rgba(8, 6, 12, ${a.toFixed(3)})`);
      g.addColorStop(0.55, `rgba(8, 6, 12, ${(a * 0.78).toFixed(3)})`);
      g.addColorStop(0.82, `rgba(8, 6, 12, ${(a * 0.35).toFixed(3)})`);
      g.addColorStop(1, 'rgba(8, 6, 12, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, sh.rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Compute remaining flight time until the descending parabola hits a platform.
    flightTimeToLand() {
      const r = this.rig;
      let prevGy = this.gy;
      const step = 0.015;
      for (let tau = step; tau <= 1.2; tau += step) {
        const px = r.x + this.vx * tau;
        const gy = this.gy + this.vy * tau + 0.5 * G * tau * tau;
        const curVy = this.vy + G * tau;
        if (curVy > 0) {
          const p = this.crossed(prevGy, gy, px);
          if (p) {
            const frac = S.clamp((p.y - prevGy) / Math.max(1e-3, gy - prevGy), 0, 1);
            return tau - step + step * frac;
          }
        }
        prevGy = gy;
      }
      return 0.52;
    }

    // Faint chalk-like dotted arc of the ballistic path while crouching or leaping,
    // tracing the rest of the predicted arc all the way down to the landing point.
    drawTelegraphArc(ctx) {
      const r = this.rig;
      let x0;
      let y0;
      let vx;
      let vy;
      let T;
      let show = 1;
      if (this.state === 'crouch') {
        const arc = this.predictedArc;
        if (!arc) return;
        x0 = arc.x0;
        y0 = arc.y0;
        vx = arc.vx;
        vy = arc.vy;
        T = arc.T;
        show = S.clamp(r.squash * 1.15, 0.45, 1);
      } else {
        x0 = r.x;
        y0 = r.y;
        vx = this.vx;
        vy = this.vy;
        T = this.flightTimeToLand();
      }
      const dots = 11;
      ctx.save();
      for (let i = 1; i <= dots; i++) {
        const u = i / dots;
        const tau = S.lerp(0.06, 0.98, (i - 1) / (dots - 1)) * T;
        const px = x0 + vx * tau;
        const py = y0 + vy * tau + 0.5 * G * tau * tau;
        const ang = Math.atan2(vy + G * tau, vx);
        // Chalk dots in P.bone with a gentle falloff so the full landing arc reads clearly.
        const alpha = (0.58 - u * 0.24) * show;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang);
        ctx.fillStyle = S.rgba(P.spiderBody, alpha * 0.35);
        ctx.beginPath();
        ctx.ellipse(0, 1.1, 5.4, 2.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = S.rgba(P.bone, alpha);
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.0, 2.1, 0, 0, Math.PI * 2);
        ctx.arc(-2.8, (i % 2 === 0 ? 1 : -1) * 1.0, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // Three spider-silhouette ghosts along the ballistic path behind the leaping Jumper.
    drawStreak(ctx) {
      const r = this.rig;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed < 120) return;
      const back = (tau) => ({ x: r.x - this.vx * tau, y: r.y - this.vy * tau + 0.5 * G * tau * tau });
      ctx.save();

      // Three full splayed ghost silhouettes in spiderBody / spiderSheen,
      // spaced along the arc behind it with clear alpha falloff (0.35, 0.22, 0.12).
      for (const [tau, a] of [[0.125, 0.35], [0.235, 0.22], [0.34, 0.12]]) {
        const p = back(tau);
        const ang = Math.atan2((this.vy - G * tau) * 0.72, this.vx);
        r.drawGhostSilhouette(ctx, p.x, p.y, ang, a);
      }
      ctx.restore();
    }

    // ── QA staging: put it straight into a state ─────────────────────
    // opts: { surface, x, feetY, state: 'prowl' | 'crouch' | 'leap',
    //         crouch (0..1), vx, vy, facing, hold (seconds) }

    stage(opts, world) {
      const r = this.rig;
      const L = world.layout;
      if (opts.surface) this.surface = L.platforms.find((p) => p.name === opts.surface) || this.surface;
      this.gy = opts.feetY ?? this.surface.y;
      r.x = opts.x ?? r.x;
      this.facing = opts.facing ?? (Math.sign(world.hero.x - r.x) || 1);
      r.heading = this.faceHeading();
      this.becomeProwler();
      this.stand(1);
      r.kneeLift = (LIFT + 13) * SCALE;
      r.k = surfaceLook(this.surface).k;
      r.plantAll();
      if (opts.state === 'crouch') {
        this.startCrouch(world);
        this.timer = (opts.crouch ?? 0.7) * this.crouchTime;
        this.crouch(0, 1, world);
        r.plantAll();
        r.gather(1);
      } else if (opts.state === 'leap') {
        this.state = 'leap';
        this.trail = [];
        this.vx = opts.vx ?? 0;
        this.vy = opts.vy ?? 0;
        r.pose = 'air';
        this.airPose(1);
        r.k = AIR_K;
        r.kBody = 0.84;
        r.kneeLift = 0;
        r.splay(world.time);
      }
      this.hold = opts.hold ?? 0;
      return this;
    }
  }

  // ── Registration ────────────────────────────────────────────────────

  // Jumpers sent into the current room so far. Keyed by the room's stats
  // object, which the runtime makes fresh for every attempt at a room.
  const sentInto = new WeakMap();
  const sentSoFar = (world) => sentInto.get(world.stats) ?? 0;

  // Rooms list where Jumpers hide in `layout.jumperLairs`:
  //   { label, surface, from: {x, y}, to: {x, y}, moves: 'walk'|'depth'|'climb',
  //     time, heading, clip: {x0, y0, x1, y1}, fade }
  // A room without any gets one walking in along the floor from a side.
  function lairsOf(world) {
    const L = world.layout;
    if (L.jumperLairs && L.jumperLairs.length) return L.jumperLairs;
    const floor = L.platforms.find((p) => !p.oneWay) || L.platforms[0];
    const { left, right } = L.bounds;
    return [
      { label: 'from the left', surface: floor.name, from: { x: left - 60, y: floor.y }, to: { x: left + 60, y: floor.y }, moves: 'walk', time: 1, heading: 0 },
      { label: 'from the right', surface: floor.name, from: { x: right + 60, y: floor.y }, to: { x: right - 60, y: floor.y }, moves: 'walk', time: 1, heading: Math.PI },
    ];
  }

  // Come out where the hero will see it: about one leap away, on the hero's
  // own level if possible, and not from the same place twice running (a
  // first play-test sent all seven out of the sink while the hero stood by
  // the fridge).
  const lastLair = new WeakMap();
  function pickLair(world, rng) {
    const hero = world.hero;
    const standing = hero.standingOn?.name;
    const last = lastLair.get(world.stats);
    let best = null;
    let bestScore = Infinity;
    for (const lair of lairsOf(world)) {
      const d = Math.abs(lair.to.x - hero.x);
      const score = Math.abs(d - 560) * 0.6 + (d < 220 ? 320 : 0) + (lair.surface === standing ? 0 : 60) + (lair === last ? 260 : 0) + rng.range(0, 220);
      if (score < bestScore) {
        bestScore = score;
        best = lair;
      }
    }
    lastLair.set(world.stats, best);
    return best;
  }

  S.registerSpiderType('jumper', {
    quota: true,
    layer: () => 'room', // it stands on furniture, so it is drawn in front of it

    spawn({ world, rng, seed, opts }) {
      const count = sentSoFar(world);
      sentInto.set(world.stats, count + 1);
      const lair = opts.lair ?? pickLair(world, rng);
      const jumper = new Jumper({ world, lair, seed, first: opts.first ?? count === 0 });
      if (opts.state) jumper.stage(opts, world);
      return jumper;
    },

    // The first Jumper of a room comes alone: wait until no other spider is out.
    canSpawn(world) {
      if (sentSoFar(world) > 0) return true;
      return !world.critters.some((c) => c.alive && S.countsForQuota(c));
    },

    // It hurts by landing on the hero (see land()); here it only draws the eye.
    threat(jumper) {
      return jumper.visible ? jumper.rig.hitCenter() : null;
    },
  });
})();
