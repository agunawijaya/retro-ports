/*
 * Spyder — the Foam Spray.
 *
 * A pump sprayer that shoots a short cone (range 260 px, 40°) of foam blobs
 * that stick where they land and fade in 4 s.
 * Tank: drains 22 %/s while held, refills 12 %/s when not firing; empty = a 1 s sputter.
 * Strong against eggs and hatchlings (pops them in cone, wall eggs, damages nests).
 * Weak against big spiders: slows 50% for 2 s, 0.25 damage per 0.1 s.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  const RANGE = 260;
  const SPREAD = (40 * Math.PI) / 180; // 40 degrees cone
  const DRAIN_RATE = 0.22; // 22% per second while firing
  const REFILL_RATE = 0.12; // 12% per second while idle
  const SPRAY_SPEED = 700;
  const BLOB_LIFE = 4.0; // seconds on floor/wall before fading completely

  let blobs = [];
  let tank = 1.0; // 0..1
  let sputter = 0; // seconds left in sputter penalty
  let firingThisFrame = false;
  let emitTimer = 0;
  let damageTick = 0;
  let boxHitCooldown = 0;

  function fire(world, hero, aim) {
    if (sputter > 0 || tank <= 0) return;
    firingThisFrame = true;
  }

  function inCone(x, y, mx, my, aim) {
    const dx = x - mx;
    const dy = y - my;
    const dist = Math.hypot(dx, dy);
    if (dist > RANGE + 20) return false;
    const angle = Math.atan2(dy, dx);
    let diff = Math.abs(angle - aim);
    while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
    return diff <= SPREAD / 2 + 0.08;
  }

  function update(world, dt) {
    boxHitCooldown = Math.max(0, boxHitCooldown - dt);
    const hero = world.hero;
    const m = hero ? hero.muzzle() : { x: 0, y: 0 };
    const aim = hero ? hero.aim : 0;

    if (sputter > 0) {
      sputter = Math.max(0, sputter - dt);
      firingThisFrame = false;
    }

    if (firingThisFrame && sputter === 0) {
      tank = Math.max(0, tank - DRAIN_RATE * dt);
      if (tank <= 0) {
        sputter = 1.0; // empty = 1 s sputter penalty
        world.audio.play('pop', 0.4);
      }

      emitTimer += dt;
      if (emitTimer >= 0.038) {
        emitTimer = 0;
        // Emit 2 foam blobs
        for (let k = 0; k < 2; k++) {
          const spreadAngle = aim + (Math.random() - 0.5) * SPREAD;
          const targetDist = 60 + Math.random() * (RANGE - 60);
          blobs.push({
            x: m.x,
            y: m.y,
            vx: Math.cos(spreadAngle) * SPRAY_SPEED,
            vy: Math.sin(spreadAngle) * SPRAY_SPEED,
            distTraveled: 0,
            targetDist,
            stuck: false,
            age: 0,
            radius: 8 + Math.random() * 8,
          });
        }
        world.audio.play('plop', 0.25);
      }

      // Check critters in cone
      damageTick += dt;
      const doDamage = damageTick >= 0.1;
      if (doDamage) damageTick = 0;

      for (const c of world.critters) {
        if (!c.alive) continue;
        const cx = c.rig ? c.rig.hitCenter().x : c.x;
        const cy = c.rig ? c.rig.hitCenter().y : c.y;

        if (inCone(cx, cy, m.x, m.y, aim)) {
          // Eggs and hatchlings pop immediately in the cone
          if (c.kind === 'egg' || c.kind === 'hatchling') {
            world.splat(cx, cy, 0.4);
            c.kill(world, 'shot');
            if (S.countsForQuota(c)) world.stats.kills++;
            if (c.kind === 'egg') world.stats.eggs++;
            world.bumpCombo();
            world.award(c.points, cx, cy - 20, 'Popped!');
            world.audio.play('squish', 0.6);
          } else {
            // Big spiders: slow 50% for 2 s, 0.25 damage per 0.1 s
            c.slowTimer = 2.0;
            c.speedMult = 0.5;
            if (doDamage) {
              world.hitBody(cx - 5, cy, cx + 5, cy, 0.25);
            }
          }
        }
      }

      // Hit breakable boxes in cone
      if (boxHitCooldown <= 0 && world.hitBreakable) {
        const coneTipX = m.x + Math.cos(aim) * (RANGE * 0.7);
        const coneTipY = m.y + Math.sin(aim) * (RANGE * 0.7);
        if (world.hitBreakable(m.x, m.y, coneTipX, coneTipY)) {
          boxHitCooldown = 0.25;
        }
      }

      // Master Bedroom nest / Dining Room nest damages
      world.emit('dart', { dart: { x: m.x + Math.cos(aim) * (RANGE * 0.6), y: m.y + Math.sin(aim) * (RANGE * 0.6) } });
    } else {
      // Tank refills when not firing
      tank = Math.min(1.0, tank + REFILL_RATE * dt);
      emitTimer = 0;
      damageTick = 0;
    }

    // Reset frame flag
    firingThisFrame = false;

    // Update foam blobs
    for (let i = blobs.length - 1; i >= 0; i--) {
      const b = blobs[i];
      if (!b.stuck) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.distTraveled += SPRAY_SPEED * dt;
        const floorY = world.floorAt(b.x, b.y);
        if (floorY !== null && b.y >= floorY - 6) {
          b.y = floorY - 3;
          b.stuck = true;
        } else if (b.distTraveled >= b.targetDist) {
          b.stuck = true;
        }
      } else {
        b.age += dt;
        if (b.age >= BLOB_LIFE) {
          blobs.splice(i, 1);
        }
      }
    }
  }

  // Foam: a creamy lump of three overlapping rounds, a darker underside, a
  // soft highlight and a few bubbles. In flight it is round; stuck, it
  // flattens into a splat that holds its shape, then slowly shrinks, fades
  // and its bubbles pop.
  function drawBlob(g, b) {
    const fade = b.stuck ? Math.max(0, 1 - b.age / BLOB_LIFE) : 1;
    const r = b.radius * (b.stuck ? 0.7 + fade * 0.3 : 1);
    const squash = b.stuck ? 0.72 : 0.9;
    const seed = b.seed ?? (b.seed = Math.floor(Math.random() * 1000));
    const wob = (k) => Math.sin(seed * 1.7 + k * 2.3);
    g.save();
    g.translate(b.x, b.y);
    g.globalAlpha = Math.min(1, fade * 1.3);
    const lumps = [[0, 0, 1], [-0.45 + wob(1) * 0.1, 0.12, 0.62], [0.48, 0.1 + wob(2) * 0.1, 0.58]];
    // Underside.
    g.fillStyle = S.mixHex(P.linen, P.taupe, 0.35);
    for (const [ox, oy, k] of lumps) {
      g.beginPath();
      g.ellipse(ox * r, oy * r + r * 0.18, r * k * 1.05, r * k * squash * 0.95, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Body.
    for (const [ox, oy, k] of lumps) {
      const body = g.createRadialGradient(ox * r - r * k * 0.3, oy * r - r * k * 0.35, 1, ox * r, oy * r, r * k);
      body.addColorStop(0, P.bone);
      body.addColorStop(0.7, S.mixHex(P.bone, P.linen, 0.45));
      body.addColorStop(1, S.mixHex(P.linen, P.taupe, 0.2));
      g.fillStyle = body;
      g.beginPath();
      g.ellipse(ox * r, oy * r, r * k, r * k * squash, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Bubbles on the surface; they pop one by one as it fades.
    const bubbles = Math.ceil(4 * fade);
    for (let i = 0; i < bubbles; i++) {
      const bx = Math.cos(seed + i * 2.1) * r * 0.55;
      const by = Math.sin(seed * 0.7 + i * 1.3) * r * 0.35 * squash - r * 0.1;
      const br = r * (0.12 + 0.06 * ((i + seed) % 3));
      g.strokeStyle = S.rgba(P.taupe, 0.45);
      g.lineWidth = 0.8;
      g.beginPath();
      g.arc(bx, by, br, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = S.rgba(P.bone, 0.9);
      g.beginPath();
      g.arc(bx - br * 0.35, by - br * 0.35, br * 0.3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function draw(g) {
    for (const b of blobs) drawBlob(g, b);
  }

  function reset() {
    blobs = [];
    tank = 1.0;
    sputter = 0;
    firingThisFrame = false;
    emitTimer = 0;
    damageTick = 0;
    boxHitCooldown = 0;
  }

  S.weapons.register({
    id: 'foam-spray',
    name: 'Foam Spray',
    kind: 'default',
    resource: 'tank',
    heroModel: 'foam',
    get tank() {
      return tank;
    },
    set tank(v) {
      tank = S.clamp(v, 0, 1);
    },
    get sputter() {
      return sputter;
    },
    fire,
    update,
    draw,
    reset,
  });
})();
