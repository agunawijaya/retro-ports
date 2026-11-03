/**
 * @file The wanderer (reference §12, ART-DIRECTION §8.1–8.2).
 *
 * Built from simple solids on a tiny rig, modelled at 1 = one tile and drawn
 * 1.4× so gestures read at iso distance. The glue owns `move` (where the
 * wanderer is going); the wanderer only reads its kind, progress and step.
 */

import * as THREE from 'three';
import { pastel } from '../render/pastel.js';
import { clamp, damp, dampAngle } from '../render/math.js';
import { contactShadow } from './shadow.js';
import {
  POSE_KEYS, REST, gaitPose, idlePose, ACTIONS, ACTION_LENGTH, LOOK_AFTER, MEDITATE_AFTER,
} from './poses.js';

export { LOOK_AFTER, MEDITATE_AFTER, ACTION_LENGTH };

export const WANDERER_SCALE = 1.4;
const ARM_REST_ROLL = 0.2;

export class Wanderer {
  constructor() {
    const root = (this.root = new THREE.Group());
    const robeMat = pastel('#f5efe6');
    const sleeveMat = pastel('#ebe3d8');
    const hatMat = pastel('#e3ae6f');
    const sashMat = pastel('#e48f7f');
    const skinMat = pastel('#f2e2d2');
    const footMat = pastel('#8c7f8f');

    this.body = new THREE.Group();
    root.add(this.body);

    // Robe: a bell, a little flared at the hem.
    const profile = [
      [0.0, 0.02], [0.19, 0.02], [0.2, 0.06], [0.185, 0.16], [0.155, 0.3], [0.125, 0.43],
      [0.1, 0.53], [0.075, 0.6], [0.045, 0.635], [0.0, 0.645],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    this.robe = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), robeMat);
    this.body.add(this.robe);

    // Sash down the front: it's how you read which way they face.
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.02), sashMat);
    sash.position.set(0, 0.31, 0.152);
    sash.rotation.x = -0.13;
    this.body.add(sash);

    // Scarf tail behind the neck, on a spring.
    this.scarf = new THREE.Group();
    this.scarf.position.set(0, 0.6, -0.08);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.02), sashMat);
    tail.position.y = -0.1;
    this.scarf.add(tail);
    this.body.add(this.scarf);
    this.scarfSwing = 0;
    this.scarfVel = 0;

    // Head and caping hat.
    this.head = new THREE.Group();
    this.head.position.y = 0.73;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.112, 24, 18), skinMat);
    this.head.add(skull);
    // Two dots for eyes: the least face that still lets you see where they look.
    const eyeMat = pastel('#5b4c5e');
    for (const side of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), eyeMat);
      eye.scale.set(1, 1.35, 0.6);
      eye.position.set(0.038 * side, 0.0, 0.104);
      this.head.add(eye);
    }
    const brim = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.09, 32), hatMat);
    brim.position.set(0, 0.098, -0.014);
    brim.rotation.x = -0.16; // tipped back so the face shows
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), hatMat);
    knob.position.set(0, 0.148, -0.022);
    this.head.add(brim, knob);
    this.body.add(this.head);

    // Arms hang from the shoulders; pitch swings them forward/back, roll opens them out.
    const makeArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.118 * side, 0.54, 0);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.044, 0.22, 12), sleeveMat);
      sleeve.position.y = -0.11;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), skinMat);
      hand.position.y = -0.24;
      pivot.add(sleeve, hand);
      this.body.add(pivot);
      return pivot;
    };
    this.armL = makeArm(1);
    this.armR = makeArm(-1);

    // Feet peek out under the hem.
    const makeFoot = (side) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), footMat);
      f.scale.set(1, 0.55, 1.5);
      f.position.set(0.075 * side, 0.025, 0.03);
      root.add(f);
      return f;
    };
    this.footL = makeFoot(1);
    this.footR = makeFoot(-1);

    this.shadow = contactShadow(0.75);
    root.add(this.shadow);

    this.pose = { ...REST };
    this.yaw = 0; // direction the wanderer intends to face
    this.shownYaw = 0;
    this.time = 0;

    this.action = null; // one-shot performances: protest, shrug, bump, bow
    this.actionTime = 0;
    this.move = null; // owned by the glue: { kind, p, stepIndex, … } while travelling
    this.idle = 0; // seconds since the player last did anything
    this.frozen = false; // scrubbing for tests: dt = 0, poses snap
    root.scale.setScalar(WANDERER_SCALE);
    this.opacity = 1;
    this.fadeTo = 1;
  }

  // Used when the wanderer arrives from, and leaves into, the clouds.
  setOpacity(a) {
    this.opacity = a;
    this.root.traverse((o) => {
      const u = o.material?.uniforms?.uOpacity;
      if (!u) return;
      u.value = a;
      const see = a < 0.999;
      if (o.material.transparent !== see) {
        o.material.transparent = see;
        o.material.needsUpdate = true;
      }
    });
    this.shadow.material.opacity = 0.32 * a;
  }

  faceDir(dr, dc) {
    this.yaw = Math.atan2(dc, dr);
  }

  perform(name) {
    this.action = name;
    this.actionTime = 0;
    this.idle = 0;
    return ACTION_LENGTH[name] ?? 1;
  }

  cancelAction() {
    this.action = null;
  }

  get busyPerforming() {
    return !!this.action;
  }

  update(dt, ctx) {
    if (this.frozen) dt = 0;
    this.time += dt;
    this.idle += dt;
    if (this.action) {
      this.actionTime += dt;
      if (!this.frozen && this.actionTime >= (ACTION_LENGTH[this.action] ?? 1)) this.action = null;
    }

    const target = { ...REST };
    if (this.move) {
      gaitPose(target, this.move.kind, this.move.p, this.move.stepIndex);
      this.idle = 0;
    } else if (this.action) {
      ACTIONS[this.action](target, this.actionTime, this, ctx);
    } else {
      idlePose(target, this.time, this.idle);
    }

    // Faster blending while moving keeps steps crisp. A frozen wanderer snaps
    // straight to the pose: that is how scrub checkpoints are captured.
    const rate = this.move ? 22 : 11;
    for (const k of POSE_KEYS) this.pose[k] = this.frozen ? target[k] : damp(this.pose[k], target[k], rate, dt);
    this.applyPose(dt);
  }

  applyPose(dt) {
    const p = this.pose;
    this.shownYaw = this.frozen ? this.yaw + p.yawOffset : dampAngle(this.shownYaw, this.yaw + p.yawOffset, 12, dt);
    this.root.rotation.y = this.shownYaw;

    const sit = p.sit;
    this.body.rotation.x = p.lean;
    this.body.position.y = p.bob + p.hop - sit * 0.16;
    const sq = p.squash;
    this.body.scale.set(1 - sq * 0.5 + sit * 0.12, 1 + sq - sit * 0.06, 1 - sq * 0.5 + sit * 0.12);

    this.head.rotation.set(p.headPitch, p.headYaw, p.headRoll);
    // Arms rest slightly away from the robe so the silhouette never melts into a cone.
    this.armL.rotation.set(p.armLPitch, 0, p.armLRoll + ARM_REST_ROLL);
    this.armR.rotation.set(p.armRPitch, 0, -(p.armRRoll + ARM_REST_ROLL));

    // Feet: lift and swing forward on their step; tuck away when sitting.
    const footScale = 1 - sit;
    for (const [foot, s, side] of [[this.footL, p.stepL, 1], [this.footR, p.stepR, -1]]) {
      foot.position.set(0.075 * side, 0.025 + Math.max(0, s) * 0.05, 0.03 + s * 0.1);
      foot.scale.set(footScale, 0.55 * footScale, 1.5 * footScale);
    }

    // Scarf lags behind turns and bobs.
    const drive = (p.bob + p.hop) * 30 + p.lean * 2;
    this.scarfVel += ((drive - this.scarfSwing) * 60 - this.scarfVel * 8) * dt;
    this.scarfSwing += this.scarfVel * dt;
    this.scarf.rotation.x = 0.15 + clamp(this.scarfSwing * 0.04, -0.4, 0.6) + p.lean * 0.6;

    this.shadow.scale.setScalar(1 - p.hop * 2 + sit * 0.25);
  }

  dispose() {
    this.root.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }
}
