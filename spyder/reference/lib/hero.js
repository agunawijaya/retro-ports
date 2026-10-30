/*
 * Spyder — the hero (The Exterminator).
 *
 * Chibi proportions, about 1 : 3 head to body, so the face reads at a
 * glance even when the hero is small on screen. The face does real work:
 * players should be able to tell how the hero feels about a spider before
 * they see the spider.
 *
 * Coordinates: (x, y) is the point between the boots, on the ground.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  const PHYS = {
    gravity: 2700,
    runSpeed: 430,
    accel: 3200,
    friction: 2600,
    jumpSpeed: 1060,
    coyoteTime: 0.09, // grace period after walking off a ledge
    jumpBuffer: 0.12, // jump pressed slightly early still counts
    dropThrough: 0.28,
  };

  const BODY = {
    headY: -134,
    headR: 33,
    shoulderY: -90,
    hipY: -50,
  };

  // The hero is drawn in "body units" and scaled up as a whole. Changing
  // this one number resizes the hero everywhere, hit boxes included.
  const SCALE = 1.25;

  class Hero {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.onGround = true;
      this.groundY = y;
      this.coyote = 0;
      this.buffer = 0;
      this.ignorePlatform = null;
      this.ignoreTimer = 0;

      this.aim = -Math.PI / 2; // straight up, in world space
      this.runPhase = 0;
      this.squash = 0; // + squash, - stretch
      this.recoil = 0;
      this.time = 0;

      this.expression = 'neutral';
      this.expressionTimer = 0;
      this.blink = 0;
      this.nextBlink = 2.5;
      this.look = { x: 0, y: -1 };

      this.nerve = 100; // health, shown on the gauge
      this.invulnerable = 0;
      this.hurtShake = 0;
    }

    // ── Feelings ────────────────────────────────────────────────────────

    // Short-lived expressions win over the mood for their duration.
    feel(expression, duration = 0.6) {
      const priority = { hurt: 4, relieved: 4, disgusted: 3, surprised: 2, determined: 1, neutral: 0 };
      if (this.expressionTimer > 0 && priority[expression] < priority[this.expression]) return;
      this.expression = expression;
      this.expressionTimer = duration;
    }

    lookAt(x, y) {
      const dx = x - this.x;
      const dy = y - (this.y + BODY.headY);
      const d = Math.hypot(dx, dy) || 1;
      this.look.x = S.damp(this.look.x, dx / d, 8, 1 / 60);
      this.look.y = S.damp(this.look.y, dy / d, 8, 1 / 60);
    }

    // ── Movement ────────────────────────────────────────────────────────

    update(dt, input, room) {
      this.time += dt;
      this.expressionTimer = Math.max(0, this.expressionTimer - dt);
      if (this.expressionTimer === 0) this.expression = 'neutral';
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      this.hurtShake = Math.max(0, this.hurtShake - dt * 3);
      this.recoil = Math.max(0, this.recoil - dt * 9);
      this.squash = S.damp(this.squash, 0, 10, dt);

      // Blinking keeps the face alive even when nothing happens.
      this.nextBlink -= dt;
      if (this.nextBlink <= 0) {
        this.blink = 0.13;
        this.nextBlink = 1.8 + Math.random() * 3.5;
      }
      this.blink = Math.max(0, this.blink - dt);

      // Horizontal: accelerate toward the wanted speed, brake hard otherwise.
      const want = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (want !== 0) {
        this.vx += want * PHYS.accel * dt;
        this.vx = S.clamp(this.vx, -PHYS.runSpeed, PHYS.runSpeed);
        this.facing = want;
      } else {
        const brake = Math.min(Math.abs(this.vx), PHYS.friction * dt);
        this.vx -= Math.sign(this.vx) * brake;
      }

      // Facing follows the aim when the hero is standing and shooting.
      if (want === 0 && Math.abs(Math.cos(this.aim)) > 0.25) {
        this.facing = Math.cos(this.aim) > 0 ? 1 : -1;
      }

      // Jumping, with coyote time and an input buffer so it feels fair.
      this.coyote = this.onGround ? PHYS.coyoteTime : Math.max(0, this.coyote - dt);
      this.buffer = input.jumpPressed ? PHYS.jumpBuffer : Math.max(0, this.buffer - dt);

      if (input.downPressed && this.onGround && this.standingOn && this.standingOn.oneWay) {
        this.ignorePlatform = this.standingOn;
        this.ignoreTimer = PHYS.dropThrough;
        this.onGround = false;
        this.y += 2;
      }
      this.ignoreTimer = Math.max(0, this.ignoreTimer - dt);
      if (this.ignoreTimer === 0) this.ignorePlatform = null;

      if (this.buffer > 0 && this.coyote > 0) {
        this.vy = -PHYS.jumpSpeed;
        this.onGround = false;
        this.coyote = 0;
        this.buffer = 0;
        this.squash = -0.18; // stretch on take-off
        this.justJumped = true;
      }
      // Releasing jump early cuts the arc: short hops are possible.
      if (!input.jumpHeld && this.vy < -300) this.vy = S.lerp(this.vy, -300, 0.25);

      this.vy += PHYS.gravity * dt;
      const prevY = this.y;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.x = S.clamp(this.x, room.bounds.left, room.bounds.right);

      // Land on whatever surface we fell through this frame.
      const wasOnGround = this.onGround;
      this.onGround = false;
      this.standingOn = null;
      if (this.vy >= 0) {
        for (const p of room.platforms) {
          if (p === this.ignorePlatform) continue;
          if (this.x < p.x0 || this.x > p.x1) continue;
          if (prevY <= p.y + 1 && this.y >= p.y) {
            this.y = p.y;
            this.vy = 0;
            this.onGround = true;
            this.standingOn = p;
            break;
          }
        }
      }
      if (this.onGround) this.lastGroundY = this.y;
      if (this.onGround && !wasOnGround) {
        this.squash = 0.22; // squash on landing
        this.justLanded = true;
      }

      // Run cycle phase advances with actual speed, so feet never skate.
      const speed = Math.abs(this.vx);
      if (this.onGround && speed > 20) this.runPhase += speed * dt * 0.034;
    }

    hurt(amount) {
      if (this.invulnerable > 0) return false;
      this.nerve = Math.max(0, this.nerve - amount);
      this.invulnerable = 1.1;
      this.hurtShake = 1;
      this.feel('hurt', 0.7);
      return true;
    }

    // How much the hero is aiming upward: 0 level … 1 straight up.
    upness() {
      return S.clamp(-Math.sin(this.aim), 0, 1);
    }

    // The blaster pivots at the front shoulder. When aiming up, the hero
    // holds it out to the front so it never covers the face.
    pivotLocal() {
      const up = this.upness();
      return { x: 14 + 28 * up * up, y: BODY.shoulderY + this.bob() };
    }

    shoulder() {
      const p = this.pivotLocal();
      return { x: this.x + this.facing * p.x * SCALE, y: this.y + p.y * SCALE };
    }

    // Where darts leave the blaster.
    muzzle() {
      const sh = this.shoulder();
      const reach = (80 - this.recoil * 8) * SCALE;
      return { x: sh.x + Math.cos(this.aim) * reach, y: sh.y + Math.sin(this.aim) * reach };
    }

    headLamp() {
      return { x: this.x + this.facing * 14 * SCALE, y: this.y + (BODY.headY - 34 + this.bob()) * SCALE };
    }

    headCenter() {
      return { x: this.x, y: this.y + (BODY.headY + this.bob()) * SCALE };
    }

    bob() {
      if (!this.onGround) return 0;
      const running = Math.min(1, Math.abs(this.vx) / PHYS.runSpeed);
      const breathe = Math.sin(this.time * 2.4) * 1.5 * (1 - running);
      return -Math.abs(Math.sin(this.runPhase)) * 6 * running + breathe;
    }

    // ── Drawing ─────────────────────────────────────────────────────────

    draw(ctx) {
      // Flicker while invulnerable, the classic "I just got hit" read.
      if (this.invulnerable > 0 && Math.floor(this.invulnerable * 14) % 2 === 0) return;

      const shake = this.hurtShake * Math.sin(this.time * 70) * 4;
      const bob = this.bob();
      const sq = this.squash;

      // Contact shadow (stays on the ground while jumping, shrinking with height).
      const height = Math.max(0, this.groundRef() - this.y);
      const k = S.clamp(1 - height / 300, 0.3, 1);
      S.paint.softShadow(ctx, this.x, this.groundRef() + 2, 50 * SCALE * k, 11 * SCALE * k, 0.55 * k);

      ctx.save();
      ctx.translate(this.x + shake, this.y);
      ctx.scale(SCALE * (1 + sq * 0.6), SCALE * (1 - sq));

      // Everything below is drawn facing right; mirror for left.
      ctx.scale(this.facing, 1);
      const localAim = this.facing === 1 ? this.aim : Math.PI - this.aim;

      this.drawCanister(ctx, bob);
      this.drawHose(ctx, bob, localAim);
      this.drawLegs(ctx);
      this.drawTorso(ctx, bob);
      this.drawBackArm(ctx, bob, localAim);

      // Aiming steeply up, the blaster passes beside the head: draw it first
      // so the face stays on top. Otherwise the blaster is in front.
      if (this.upness() > 0.75) {
        this.drawBlaster(ctx, localAim);
        this.drawHead(ctx, bob);
      } else {
        this.drawHead(ctx, bob);
        this.drawBlaster(ctx, localAim);
      }
      ctx.restore();
    }

    groundRef() {
      return this.onGround ? this.y : this.lastGroundY || this.y;
    }

    drawLegs(ctx) {
      const running = this.onGround ? Math.min(1, Math.abs(this.vx) / PHYS.runSpeed) : 0;
      const airborne = !this.onGround;
      for (const side of [-1, 1]) {
        const phase = this.runPhase + (side === 1 ? 0 : Math.PI);
        let footX = side * 9 + Math.cos(phase) * 18 * running;
        let footY = -Math.max(0, Math.sin(phase)) * 14 * running;
        if (airborne) {
          // Tuck the legs mid-jump.
          footX = side * 10 + (side === 1 ? 6 : -4);
          footY = side === 1 ? -14 : -6;
        }
        const hipX = side * 9;
        const hipY = BODY.hipY + this.bob();
        const back = side === -1;

        // Leg
        ctx.strokeStyle = back ? P.jumpsuitShade : S.shade(P.jumpsuit, -0.12);
        ctx.lineWidth = 15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.quadraticCurveTo(hipX + (footX - hipX) * 0.5 + 4, (hipY + footY) / 2, footX, footY - 10);
        ctx.stroke();

        // Boot: chunky, slightly upturned toe.
        ctx.fillStyle = back ? S.shade(P.gear, -0.35) : P.gear;
        ctx.beginPath();
        ctx.moveTo(footX - 10, footY - 14);
        ctx.lineTo(footX + 8, footY - 14);
        ctx.quadraticCurveTo(footX + 20, footY - 10, footX + 19, footY - 2);
        ctx.lineTo(footX - 11, footY);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = S.shade(P.gear, -0.5);
        ctx.fillRect(footX - 11, footY - 3, 30, 3);
      }
    }

    drawCanister(ctx, bob) {
      // Vacuum canister on the back, with a pressure gauge and brass bands.
      const x = -30;
      const y = -112 + bob;
      ctx.fillStyle = S.shade(P.gear, -0.15);
      ctx.beginPath();
      ctx.roundRect(x - 14, y, 28, 62, 12);
      ctx.fill();
      ctx.fillStyle = S.shade(P.gear, 0.18);
      ctx.fillRect(x - 10, y + 6, 5, 50);
      ctx.fillStyle = P.brass;
      ctx.fillRect(x - 14, y + 14, 28, 4);
      ctx.fillRect(x - 14, y + 44, 28, 4);
      ctx.fillStyle = S.shade(P.brass, -0.3);
      ctx.beginPath();
      ctx.arc(x, y - 2, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    drawTorso(ctx, bob) {
      const top = -112 + bob;
      const bottom = BODY.hipY + 6 + bob;
      const breathe = 1 + Math.sin(this.time * 2.4) * 0.015;

      ctx.save();
      ctx.translate(0, bottom);
      ctx.scale(1, breathe);
      ctx.translate(0, -bottom);

      const g = ctx.createLinearGradient(-26, 0, 26, 0);
      g.addColorStop(0, P.jumpsuitShade);
      g.addColorStop(0.45, P.jumpsuit);
      g.addColorStop(1, S.shade(P.jumpsuit, 0.12));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-20, top + 8);
      ctx.quadraticCurveTo(0, top - 2, 20, top + 8);
      ctx.quadraticCurveTo(30, (top + bottom) / 2, 24, bottom);
      ctx.quadraticCurveTo(0, bottom + 8, -24, bottom);
      ctx.quadraticCurveTo(-30, (top + bottom) / 2, -20, top + 8);
      ctx.fill();

      // Zipper, chest pocket, utility belt.
      ctx.strokeStyle = S.rgba(P.soot, 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, top + 6);
      ctx.lineTo(6, bottom - 6);
      ctx.stroke();
      ctx.fillStyle = S.shade(P.jumpsuit, -0.18);
      ctx.fillRect(9, top + 16, 11, 10);
      ctx.fillStyle = P.gear;
      ctx.fillRect(-25, bottom - 16, 50, 8);
      ctx.fillStyle = P.brass;
      ctx.fillRect(-3, bottom - 17, 8, 10);
      // Canister strap
      ctx.strokeStyle = S.shade(P.gear, -0.2);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-14, top + 4);
      ctx.lineTo(12, bottom - 16);
      ctx.stroke();
      ctx.restore();
    }

    drawHead(ctx, bob) {
      const hy = BODY.headY + bob;
      const r = BODY.headR;

      // Tilt the head back a little when looking up the barrel.
      ctx.save();
      ctx.translate(0, hy + r);
      ctx.rotate(-0.16 * this.upness());
      ctx.translate(0, -(hy + r));

      // Hood, slightly bigger than the head, with a soft inner shadow.
      const hood = ctx.createRadialGradient(-8, hy - 14, 4, 0, hy, r + 10);
      hood.addColorStop(0, S.shade(P.jumpsuit, 0.15));
      hood.addColorStop(0.7, P.jumpsuit);
      hood.addColorStop(1, P.jumpsuitShade);
      ctx.fillStyle = hood;
      ctx.beginPath();
      ctx.ellipse(-2, hy - 2, r + 9, r + 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Face
      const face = ctx.createRadialGradient(6, hy - 6, 3, 2, hy + 2, r);
      face.addColorStop(0, S.shade(P.skin, 0.08));
      face.addColorStop(1, P.skinShade);
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.ellipse(4, hy + 4, r - 4, r - 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Blush
      ctx.fillStyle = 'rgba(232, 120, 100, 0.28)';
      ctx.beginPath();
      ctx.ellipse(-6, hy + 14, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.ellipse(24, hy + 14, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      this.drawFace(ctx, hy);

      // Goggles pushed up on the hood, head lamp mounted on the strap.
      ctx.fillStyle = P.gear;
      ctx.fillRect(-r - 4, hy - 26, r * 2 + 6, 8);
      for (const gx of [-4, 20]) {
        ctx.fillStyle = S.shade(P.gear, -0.3);
        ctx.beginPath();
        ctx.arc(gx, hy - 24, 10, 0, Math.PI * 2);
        ctx.fill();
        const lens = ctx.createLinearGradient(gx - 8, hy - 32, gx + 8, hy - 16);
        lens.addColorStop(0, '#9FC4D8');
        lens.addColorStop(1, '#2E4A5C');
        ctx.fillStyle = lens;
        ctx.beginPath();
        ctx.arc(gx, hy - 24, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(gx - 3, hy - 27, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Lamp housing
      ctx.fillStyle = P.brass;
      ctx.beginPath();
      ctx.roundRect(8, hy - 40, 14, 10, 3);
      ctx.fill();
      ctx.fillStyle = '#FFF4D6';
      ctx.beginPath();
      ctx.arc(20, hy - 35, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Hood drawstrings
      ctx.strokeStyle = S.shade(P.linen, -0.1);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, hy + r - 2);
      ctx.lineTo(-16, hy + r + 14);
      ctx.moveTo(2, hy + r);
      ctx.lineTo(3, hy + r + 16);
      ctx.stroke();
      ctx.restore();
    }

    drawFace(ctx, hy) {
      const e = this.expression;
      const lookX = S.clamp(this.look.x * (this.facing === 1 ? 1 : -1), -1, 1) * 3;
      const lookY = S.clamp(this.look.y, -1, 1) * 3;
      const eyes = [
        { x: -4, y: hy + 2 },
        { x: 20, y: hy + 2 },
      ];

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Eyes
      for (const [i, eye] of eyes.entries()) {
        const blinking = this.blink > 0 && e !== 'relieved' && e !== 'hurt';
        if (e === 'relieved') {
          // Happy closed eyes: ^ ^
          ctx.strokeStyle = P.soot;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(eye.x - 6, eye.y + 2);
          ctx.quadraticCurveTo(eye.x, eye.y - 6, eye.x + 6, eye.y + 2);
          ctx.stroke();
        } else if (e === 'hurt') {
          // > <
          ctx.strokeStyle = P.soot;
          ctx.lineWidth = 3;
          const dir = i === 0 ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(eye.x - 5 * dir, eye.y - 5);
          ctx.lineTo(eye.x + 4 * dir, eye.y);
          ctx.lineTo(eye.x - 5 * dir, eye.y + 5);
          ctx.stroke();
        } else if (blinking || (e === 'disgusted' && i === 0)) {
          ctx.strokeStyle = P.soot;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(eye.x - 6, eye.y);
          ctx.lineTo(eye.x + 6, eye.y);
          ctx.stroke();
        } else {
          const big = e === 'surprised' ? 1.25 : 1;
          ctx.fillStyle = '#FFFDF7';
          ctx.beginPath();
          ctx.ellipse(eye.x, eye.y, 7 * big, 8.5 * big, 0, 0, Math.PI * 2);
          ctx.fill();
          const pupil = e === 'surprised' ? 3.2 : 5;
          ctx.fillStyle = '#2A1C14';
          ctx.beginPath();
          ctx.ellipse(eye.x + lookX, eye.y + lookY, pupil, pupil * 1.15, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(eye.x + lookX - 1.5, eye.y + lookY - 2.5, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Brows tell most of the story.
      ctx.strokeStyle = S.shade(P.skinShade, -0.45);
      ctx.lineWidth = 3;
      const browY = hy - 11;
      const browShapes = {
        neutral: [[-10, browY, 2, browY - 1], [14, browY - 1, 26, browY]],
        determined: [[-10, browY - 3, 2, browY + 2], [14, browY + 2, 26, browY - 3]],
        surprised: [[-10, browY - 5, 2, browY - 7], [14, browY - 7, 26, browY - 5]],
        disgusted: [[-10, browY + 1, 2, browY + 3], [14, browY - 4, 26, browY - 1]],
        hurt: [[-10, browY + 2, 2, browY - 2], [14, browY - 2, 26, browY + 2]],
        relieved: [[-10, browY - 3, 2, browY - 4], [14, browY - 4, 26, browY - 3]],
      };
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of browShapes[e] || browShapes.neutral) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      // Mouth
      const mx = 9;
      const my = hy + 19;
      ctx.strokeStyle = '#5A2E22';
      ctx.fillStyle = '#5A2E22';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      switch (e) {
        case 'surprised':
          ctx.ellipse(mx, my + 1, 4, 5.5, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'hurt':
          ctx.ellipse(mx, my + 1, 6, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'determined':
          ctx.moveTo(mx - 6, my + 1);
          ctx.lineTo(mx + 5, my - 1);
          ctx.stroke();
          break;
        case 'disgusted':
          ctx.moveTo(mx - 7, my);
          ctx.lineTo(mx - 3, my - 3);
          ctx.lineTo(mx + 1, my);
          ctx.lineTo(mx + 5, my - 3);
          ctx.lineTo(mx + 8, my);
          ctx.stroke();
          break;
        case 'relieved':
          ctx.moveTo(mx - 8, my - 2);
          ctx.quadraticCurveTo(mx, my + 9, mx + 8, my - 2);
          ctx.closePath();
          ctx.fill();
          break;
        default:
          ctx.moveTo(mx - 5, my);
          ctx.quadraticCurveTo(mx, my + 4, mx + 5, my);
          ctx.stroke();
      }
    }

    // Hose from the bottom of the canister, round the hip, to the blaster.
    drawHose(ctx, bob, aim) {
      const p = this.pivotLocal();
      const tail = { x: p.x - Math.cos(aim) * 8, y: p.y - Math.sin(aim) * 8 };
      ctx.strokeStyle = S.shade(P.gear, -0.3);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-30, -52 + bob);
      ctx.bezierCurveTo(-30, -24 + bob, 18, -30 + bob, tail.x, tail.y);
      ctx.stroke();
      // Ribbing on the hose
      ctx.strokeStyle = S.rgba(P.linen, 0.22);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    drawBackArm(ctx, bob, aim) {
      const p = this.pivotLocal();
      const kick = this.recoil * 8;
      const hx = p.x + Math.cos(aim) * (16 - kick);
      const hy = p.y + Math.sin(aim) * (16 - kick) + 4;
      ctx.strokeStyle = P.jumpsuitShade;
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-8, BODY.shoulderY - 4 + bob);
      ctx.quadraticCurveTo((hx - 8) / 2, hy + 18, hx, hy);
      ctx.stroke();
      this.drawGlove(ctx, hx, hy);
    }

    drawBlaster(ctx, aim) {
      const p = this.pivotLocal();
      const kick = this.recoil * 8;
      const dirX = Math.cos(aim);
      const dirY = Math.sin(aim);

      // A chunky tube with a flared nozzle and a glowing pressure window.
      ctx.save();
      ctx.translate(p.x + dirX * (18 - kick), p.y + dirY * (18 - kick));
      ctx.rotate(aim);
      const body = ctx.createLinearGradient(0, -11, 0, 11);
      body.addColorStop(0, S.shade(P.gear, 0.35));
      body.addColorStop(0.5, P.gear);
      body.addColorStop(1, S.shade(P.gear, -0.4));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.roundRect(-14, -10, 56, 20, 6);
      ctx.fill();
      ctx.fillStyle = S.shade(P.gear, 0.1);
      ctx.beginPath();
      ctx.moveTo(40, -9);
      ctx.lineTo(60, -14);
      ctx.lineTo(60, 14);
      ctx.lineTo(40, 9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = S.shade(P.gear, -0.55);
      ctx.beginPath();
      ctx.ellipse(60, 0, 3, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = P.brass;
      ctx.fillRect(-2, -10, 4, 20);
      ctx.fillRect(34, -10, 4, 20);
      const charge = this.charge === undefined ? 1 : this.charge;
      ctx.fillStyle = S.rgba(P.amber, 0.35 + charge * 0.6);
      ctx.beginPath();
      ctx.roundRect(8, -5, 20 * charge + 2, 6, 3);
      ctx.fill();
      ctx.restore();

      // Front arm supports the barrel.
      const hx = p.x + dirX * (42 - kick);
      const hy = p.y + dirY * (42 - kick) + 5;
      ctx.strokeStyle = P.jumpsuit;
      ctx.lineWidth = 13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(10, BODY.shoulderY + this.bob());
      ctx.quadraticCurveTo((hx + 10) / 2 + 6, hy + 20, hx, hy);
      ctx.stroke();
      this.drawGlove(ctx, hx, hy);
    }

    drawGlove(ctx, x, y) {
      ctx.fillStyle = S.shade(P.gear, 0.05);
      ctx.beginPath();
      ctx.arc(x, y, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(x - 2, y - 2.5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  Hero.PHYS = PHYS;
  Hero.SCALE = SCALE;
  S.Hero = Hero;
})();
