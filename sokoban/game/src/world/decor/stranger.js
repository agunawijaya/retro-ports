/**
 * @file The stranger: a figure in black, sitting on the edge of the world
 * (reference §13d, ART-DIRECTION §10b.3). Never speaks, never moves from the
 * seat, has no name in the UI.
 */

import * as THREE from 'three';
import { pastel } from '../../render/pastel.js';
import { cellX, cellZ } from '../../render/board.js';
import { clamp, damp, wrapAngle } from '../../render/math.js';
import { WANDERER_SCALE } from '../wanderer.js';
import { mergeStatic } from '../../render/merge.js';
import { env } from './env.js';
import { reducedMotion } from '../../state/settings.js';

export class Stranger {
  constructor(seat, group) {
    const root = (this.root = new THREE.Group());
    root.position.copy(seat.pos);
    root.rotation.y = seat.yaw;
    group.add(root);
    this.seat = seat;

    const robe = pastel('#2c2834');
    const shade = pastel('#1f1c25');
    const boot = pastel('#46404e');
    const eyeMat = pastel('#f4ede2', { glow: '#fff4dc' });
    eyeMat.uniforms.uGlowAmt.value = 0.7;

    this.body = new THREE.Group();
    root.add(this.body);
    const profile = [[0, 0], [0.16, 0], [0.165, 0.05], [0.15, 0.17], [0.12, 0.29], [0.09, 0.37], [0.05, 0.41], [0, 0.42]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), robe);
    torso.position.z = -0.05;
    this.body.add(torso);

    // Hood with an opening at the front; a shadowed face with two pale eyes.
    this.head = new THREE.Group();
    this.head.position.set(0, 0.5, -0.04);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 14), shade);
    const hoodMat = pastel('#2c2834');
    hoodMat.side = THREE.DoubleSide;
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.122, 24, 16, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.82),
      hoodMat,
    );
    hood.position.set(0, 0.012, -0.012);
    // The hood falls back to a soft point, like a monk's cowl.
    const peak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.13, 16), robe);
    peak.position.set(0, 0.075, -0.115);
    peak.rotation.x = -1.15;
    this.head.add(face, hood, peak);
    for (const s of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), eyeMat);
      eye.scale.set(1, 1.3, 0.6);
      eye.position.set(0.033 * s, 0.006, 0.088);
      this.head.add(eye);
    }
    this.body.add(this.head);

    mergeStatic(this.head, this.head.children.filter((o) => o.isMesh));

    // Arms resting back, hands flat on the stone.
    const restingParts = [torso];
    for (const s of [1, -1]) {
      const arm = new THREE.Group();
      arm.position.set(0.1 * s, 0.35, -0.04);
      arm.rotation.set(0.32, 0, 0.32 * s);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.044, 0.22, 10), robe);
      sleeve.position.y = -0.11;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), shade);
      hand.position.y = -0.23;
      arm.add(sleeve, hand);
      this.body.add(arm);
      restingParts.push(sleeve, hand);
    }
    // Torso and arms never move against the body: merge them.
    root.updateMatrixWorld(true);
    mergeStatic(this.body, restingParts);

    // Legs: thighs on the stone, shins hanging over the edge, kicking lazily.
    this.knees = [1, -1].map((s) => {
      const hip = new THREE.Group();
      hip.position.set(0.062 * s, 0.035, 0.0);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.24, 10), robe);
      thigh.rotation.x = Math.PI / 2;
      thigh.position.z = 0.12;
      const knee = new THREE.Group();
      knee.position.z = 0.24;
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.22, 10), robe);
      shin.position.y = -0.11;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.1), boot);
      foot.position.set(0, -0.23, 0.025);
      knee.add(shin, foot);
      hip.add(thigh, knee);
      this.body.add(hip);
      return knee;
    });

    root.scale.setScalar(WANDERER_SCALE);
    this.headYaw = 0;
    this.headPitch = 0;
    this.twist = 0;
    this.look = { yaw: 0, pitch: 0, follow: 0 };
    this.lookIn = 2;
    this.chuckle = 0;
    this.nod = 0;
    this.toTarget = new THREE.Vector3();
  }

  notice(kind) {
    this.look.follow = kind === 'won' ? 5 : 3.2;
    this.lookIn = this.look.follow;
    if (kind === 'protest') this.chuckle = 0.9;
    if (kind === 'won') this.nod = 1.6;
  }

  update(dt, t, target) {
    if (reducedMotion()) {
      this.body.rotation.y = 0;
      this.head.rotation.set(0, 0, 0);
      this.body.position.y = 0;
      this.body.scale.y = 1;
      this.knees[0].rotation.x = 0;
      this.knees[1].rotation.x = 0;
      return;
    }
    const rand = env.rand;
    // Choose where to look next: mostly the clouds, sometimes the wanderer.
    this.lookIn -= dt;
    if (this.lookIn <= 0) {
      if (rand() < 0.3) {
        this.look.follow = 2 + rand() * 1.5;
        this.lookIn = this.look.follow;
      } else {
        this.look.follow = 0;
        this.look.yaw = (rand() * 2 - 1) * 1.25;
        this.look.pitch = -0.22 + rand() * 0.4;
        this.lookIn = 1.8 + rand() * 2.6;
      }
    }
    let yaw = this.look.yaw;
    let pitch = this.look.pitch;
    if (this.look.follow > 0) {
      this.look.follow -= dt;
      const d = this.toTarget.copy(target).sub(this.root.position);
      yaw = clamp(wrapAngle(Math.atan2(d.x, d.z) - this.root.rotation.y), -1.9, 1.9);
      pitch = -0.05;
    }
    const twistTarget = clamp(yaw * 0.32, -0.55, 0.55);
    this.twist = damp(this.twist, twistTarget, 3, dt);
    this.headYaw = damp(this.headYaw, yaw - twistTarget, 5, dt);
    this.headPitch = damp(this.headPitch, pitch, 5, dt);

    this.nod = Math.max(0, this.nod - dt);
    const nod = this.nod > 0 ? Math.max(0, Math.sin((1.6 - this.nod) * 4)) * 0.3 : 0;
    this.chuckle = Math.max(0, this.chuckle - dt);

    this.body.rotation.y = this.twist;
    this.head.rotation.set(this.headPitch + nod, this.headYaw, 0);
    this.body.position.y = this.chuckle > 0 ? Math.abs(Math.sin(t * 22)) * 0.012 * this.chuckle : 0;
    this.body.scale.y = 1 + Math.sin(t * 1.3) * 0.01;
    this.knees[0].rotation.x = Math.sin(t * 1.6) * 0.3;
    this.knees[1].rotation.x = Math.sin(t * 1.6 + 2.3) * 0.3;
  }
}

/**
 * A ledge to sit on: an outer wall cell in a straight run with sky on one side,
 * at least 3 tiles from the gate. Seats facing the default camera win; one of
 * the best three is picked with the room's generator.
 */
export function chooseSeat(level, gate) {
  const isVoid = (r, c) => !(level.wall[r]?.[c] || level.inside[r]?.[c]);
  const isWall = (r, c) => level.wall[r]?.[c];
  const options = [];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (!isWall(r, c) || (gate && Math.abs(r - gate.r) + Math.abs(c - gate.c) < 3)) continue;
      const straight = (isWall(r, c - 1) && isWall(r, c + 1)) || (isWall(r - 1, c) && isWall(r + 1, c));
      if (!straight) continue;
      for (const [dr, dc] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        if (!isVoid(r + dr, c + dc)) continue;
        const front = dr > 0 || dc > 0; // faces the default camera: always visible
        const far = gate ? Math.abs(r - gate.r) + Math.abs(c - gate.c) : 0;
        options.push({ r, c, dir: [dr, dc], score: (front ? 100 : 0) + far });
      }
    }
  }
  if (!options.length) return null;
  options.sort((a, b) => b.score - a.score);
  const pick = options[Math.min(options.length - 1, Math.floor(env.rand() * Math.min(3, options.length)))];
  const pos = new THREE.Vector3(cellX(pick.c) + pick.dir[1] * 0.28, 0.48, cellZ(pick.r) + pick.dir[0] * 0.28);
  return { ...pick, pos, yaw: Math.atan2(pick.dir[1], pick.dir[0]) };
}
