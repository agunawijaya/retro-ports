/**
 * @file Crows: ordinary birds that come, perch, look about, and leave
 * (reference §13e, ART-DIRECTION §10b.4). Birds, never crow-people.
 */

import * as THREE from 'three';
import { pastel } from '../../render/pastel.js';
import { clamp, damp, dampAngle } from '../../render/math.js';
import { sound } from '../../audio/sound.js';
import { mergeStatic } from '../../render/merge.js';
import { env } from './env.js';
import { reducedMotion } from '../../state/settings.js';

const CROW_SCALE = 1.3;

function awayPoint() {
  const a = env.rand() * Math.PI * 2;
  return new THREE.Vector3(Math.cos(a) * 16, 4 + env.rand() * 2, Math.sin(a) * 16);
}

/** A free perch more than 2.6 tiles from the wanderer, or null. */
function pickPerch(perches, wandererPos, not = null) {
  const free = perches.filter(
    (p) => !p.taken && p !== not && Math.hypot(p.pos.x - wandererPos.x, p.pos.z - wandererPos.z) > 2.6,
  );
  return free.length ? free[Math.floor(env.rand() * free.length)] : null;
}

export class Crow {
  /**
   * @param {THREE.Group} group
   * @param {{ pos: THREE.Vector3, taken: Crow | null }[]} perches the room's perches
   */
  constructor(group, perches) {
    this.perches = perches;
    const g = (this.group = new THREE.Group());
    group.add(g);
    const ink = pastel('#3c3745');
    const beak = pastel('#5d5565');
    const eye = pastel('#f1e7d8');

    this.body = new THREE.Group();
    g.add(this.body);
    const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), ink);
    torso.scale.set(0.072, 0.068, 0.13);
    torso.position.y = 0.11;
    this.body.add(torso);

    this.head = new THREE.Group();
    this.head.position.set(0, 0.165, 0.1);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.054, 14, 10), ink);
    const bill = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.07, 8), beak);
    bill.rotation.x = Math.PI / 2;
    bill.position.set(0, -0.006, 0.075);
    this.head.add(skull, bill);
    for (const s of [1, -1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), eye);
      e.position.set(0.034 * s, 0.016, 0.036);
      this.head.add(e);
    }
    this.body.add(this.head);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.12), ink);
    tail.position.set(0, 0.12, -0.16);
    tail.rotation.x = -0.25;
    this.body.add(tail);

    this.wings = [1, -1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.055 * s, 0.14, 0.0);
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.1), ink);
      w.position.x = 0.09 * s;
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.01, 0.07), ink);
      tip.position.set(0.21 * s, 0, -0.015);
      pivot.add(w, tip);
      this.body.add(pivot);
      return { pivot, s };
    });
    this.legs = [1, -1].map((s) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.09, 6), beak);
      leg.position.set(0.025 * s, 0.045, 0.01);
      this.body.add(leg);
      return leg;
    });

    // Rigid parts merge per colour: torso and tail on the body, the head's
    // parts on the head, each wing on its pivot, the two legs together.
    mergeStatic(this.head);
    for (const { pivot } of this.wings) mergeStatic(pivot);
    const torsoAndTail = this.body.children.filter((o) => o.isMesh && !this.legs.includes(o));
    mergeStatic(this.body, torsoAndTail);
    const legsGroup = new THREE.Group();
    this.body.add(legsGroup);
    this.legs = mergeStatic(legsGroup, this.legs);

    g.scale.setScalar(CROW_SCALE);
    g.visible = false;
    this.state = 'away';
    this.timer = 1.5 + env.rand() * 3;
    this.perch = null;
    this.headYaw = 0;
    this.headTarget = 0;
    this.peck = 0;
    this.hop = 0;
  }

  flyTo(perch, from) {
    this.group.visible = true;
    if (this.perch) this.perch.taken = null;
    this.perch = perch;
    if (perch) perch.taken = this;
    const p0 = from ?? this.group.position.clone();
    const p2 = perch ? perch.pos.clone() : awayPoint();
    const mid = p0.clone().lerp(p2, 0.5);
    mid.y = Math.max(p0.y, p2.y) + 1.2 + p0.distanceTo(p2) * 0.18;
    this.curve = [p0, mid, p2];
    this.t = 0;
    this.duration = clamp(p0.distanceTo(p2) / 3.0, 1.4, 4.5);
    this.state = 'flying';
    sound.flutter();
  }

  update(dt, t, wandererPos) {
    if (reducedMotion()) {
      if (this.state !== 'perched') {
        const perch = this.perches.find((p) => !p.taken) || this.perches[0];
        if (perch) {
          if (this.perch) this.perch.taken = null;
          this.perch = perch;
          perch.taken = this;
          this.group.position.copy(perch.pos);
          this.group.visible = true;
          this.state = 'perched';
        } else {
          this.group.visible = false;
          return;
        }
      }
      this.group.position.copy(this.perch.pos);
      for (const { pivot, s } of this.wings) {
        pivot.rotation.y = 1.45 * s;
        pivot.rotation.z = -0.18 * s;
        pivot.scale.x = 0.72;
      }
      for (const l of this.legs) l.visible = true;
      this.head.rotation.set(0, 0, 0);
      this.body.rotation.set(0, 0, 0);
      return;
    }
    const rand = env.rand;
    if (this.state === 'away') {
      this.timer -= dt;
      if (this.timer <= 0) {
        const perch = pickPerch(this.perches, wandererPos);
        if (perch) this.flyTo(perch, awayPoint());
        else this.timer = 2;
      }
      return;
    }

    const g = this.group;
    if (this.state === 'flying') {
      this.t = Math.min(1, this.t + dt / this.duration);
      const [a, b, c] = this.curve;
      const u = this.t;
      const iu = 1 - u;
      const pos = a.clone().multiplyScalar(iu * iu).add(b.clone().multiplyScalar(2 * iu * u)).add(c.clone().multiplyScalar(u * u));
      const vel = pos.clone().sub(g.position);
      g.position.copy(pos);
      if (vel.lengthSq() > 1e-7) {
        g.rotation.y = dampAngle(g.rotation.y, Math.atan2(vel.x, vel.z), 8, dt);
        this.body.rotation.x = damp(this.body.rotation.x, clamp(-vel.y / (dt * 6), -0.5, 0.5), 6, dt);
      }
      // Flap hard to climb and to land, glide in between.
      const gliding = u > 0.3 && u < 0.72;
      const flap = gliding ? 0.18 + Math.sin(t * 5) * 0.1 : Math.sin(t * 24) * 0.95 + 0.15;
      for (const { pivot, s } of this.wings) {
        pivot.rotation.z = s * flap;
        pivot.rotation.y = damp(pivot.rotation.y, 0, 18, dt);
        pivot.scale.x = damp(pivot.scale.x, 1, 18, dt);
      }
      for (const l of this.legs) l.visible = u > 0.85;
      if (this.t >= 1) {
        if (this.perch) {
          this.state = 'perched';
          this.timer = 9 + rand() * 14;
          this.body.rotation.x = 0;
        } else {
          this.state = 'away';
          g.visible = false;
          this.timer = 4 + rand() * 8;
        }
      }
      return;
    }

    // Perched: wings swept back along the flanks, tips a little low; quick
    // bird-like head turns, a peck, a hop.
    for (const { pivot, s } of this.wings) {
      pivot.rotation.y = damp(pivot.rotation.y, 1.45 * s, 12, dt);
      pivot.rotation.z = damp(pivot.rotation.z, -0.18 * s, 12, dt);
      pivot.scale.x = damp(pivot.scale.x, 0.72, 12, dt);
    }
    for (const l of this.legs) l.visible = true;
    this.timer -= dt;
    if (rand() < dt * 0.9) this.headTarget = (rand() * 2 - 1) * 1.1;
    if (rand() < dt * 0.25) this.peck = 0.3;
    if (rand() < dt * 0.12) {
      this.hop = 0.25;
      g.rotation.y += (rand() - 0.5) * 1.4;
    }
    this.headYaw = damp(this.headYaw, this.headTarget, 28, dt);
    this.peck = Math.max(0, this.peck - dt);
    this.hop = Math.max(0, this.hop - dt);
    this.head.rotation.set(this.peck > 0 ? Math.sin(((0.3 - this.peck) / 0.3) * Math.PI) * 0.9 : 0, this.headYaw, 0);
    g.position.y = this.perch.pos.y + Math.sin(((0.25 - this.hop) / 0.25) * Math.PI) * (this.hop > 0 ? 0.05 : 0);

    // Too close? Off it goes: to another perch, or away entirely.
    const near = Math.hypot(wandererPos.x - g.position.x, wandererPos.z - g.position.z) < 1.6;
    if (near || this.timer <= 0) {
      const next = rand() < 0.6 ? pickPerch(this.perches, wandererPos, this.perch) : null;
      this.flyTo(next);
    }
  }
}
