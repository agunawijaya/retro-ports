/**
 * @file The torii gate where the wanderer arrives and leaves (reference §13c,
 * ART-DIRECTION §10b.2). The gate itself is decoration; the walk through it is
 * scripted by the room's glue.
 */

import * as THREE from 'three';
import { pastel, roles } from '../../render/pastel.js';
import { cellX, cellZ, CLOCKWISE } from '../../render/board.js';
import { damp } from '../../render/math.js';
import { mergeStatic } from '../../render/merge.js';
import { sound } from '../../audio/sound.js';

const VERMILION = '#e88f78';
export const GATE_OPEN = 1.05; // raised like a crossing boom

export class Gate {
  /**
   * @param {{ r: number, c: number, dir: number[], stones: number }} spot from chooseGate
   * @param {THREE.Group} group
   */
  constructor(spot, group) {
    Object.assign(this, spot); // r, c, dir (outward [dr, dc]), stones
    const g = (this.group = new THREE.Group());
    g.position.set(cellX(this.c), 0, cellZ(this.r));
    g.rotation.y = Math.atan2(this.dir[1], this.dir[0]); // local +z points outward
    group.add(g);

    const red = pastel(VERMILION);
    const top = pastel('#4d4552');
    const wood = pastel('#e6d3b8');
    const base = pastel(null, { roleColor: roles.cap });
    // The frame never moves, so its parts merge (one draw call per colour);
    // the bar swings and the stones bob, so they stay separate.
    const frame = new THREE.Group();
    g.add(frame);
    const add = (geo, mat, x, y, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      frame.add(m);
      return m;
    };

    // Threshold stone so the gate cell reads as a step, not a hole in the wall.
    add(new THREE.BoxGeometry(1, 0.06, 1), base, 0, -0.03);
    for (const x of [-0.4, 0.4]) {
      add(new THREE.CylinderGeometry(0.1, 0.11, 0.09, 16), top, x, 0.045);
      add(new THREE.CylinderGeometry(0.052, 0.06, 1.06, 16), red, x, 0.53);
    }
    add(new THREE.BoxGeometry(1.0, 0.05, 0.08), red, 0, 0.82); // nuki
    add(new THREE.BoxGeometry(0.06, 0.14, 0.06), red, 0, 0.92); // gakuzuka
    add(new THREE.BoxGeometry(1.16, 0.05, 0.12), red, 0, 1.015); // shimaki
    add(new THREE.BoxGeometry(1.12, 0.07, 0.15), top, 0, 1.07); // kasagi
    for (const s of [-1, 1]) {
      const tip = add(new THREE.BoxGeometry(0.16, 0.07, 0.15), top, s * 0.62, 1.09);
      tip.rotation.z = s * 0.28; // upturned ends
    }
    mergeStatic(frame);

    // The bar: hinged at one pillar, it swings up to let the wanderer pass.
    this.bar = new THREE.Group();
    this.bar.position.set(-0.4, 0.36, 0);
    g.add(this.bar);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.055, 0.055), wood);
    beam.position.x = 0.39;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.07), red);
    cap.position.x = 0.76;
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.09, 12), top);
    hinge.rotation.x = Math.PI / 2;
    this.bar.add(beam, cap, hinge);
    this.angle = 0;
    this.target = 0;

    // Stepping stones floating out into the clouds.
    this.stoneMeshes = [];
    const stoneMat = pastel(null, { roleColor: roles.cap });
    for (let i = 1; i <= this.stones; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.34 - i * 0.04, 0.26 - i * 0.04, 0.12, 9), stoneMat);
      s.position.set(i % 2 ? 0.05 : -0.05, -0.06, i);
      s.rotation.y = i;
      g.add(s);
      this.stoneMeshes.push(s);
    }
    g.updateMatrixWorld(true);
    this.perches = [-1, 1].map((s) => g.localToWorld(new THREE.Vector3(s * 0.58, 1.13, 0)));
  }

  // Cells along the path out: 0 = the gate itself, 1..n = the stones.
  cell(k) {
    return { r: this.r + this.dir[0] * k, c: this.c + this.dir[1] * k };
  }

  get inner() {
    return this.cell(-1);
  }

  open() {
    this.target = GATE_OPEN;
    sound.creak();
  }

  close() {
    this.target = 0;
    sound.creak();
    this.closing = true;
  }

  snap(open) {
    this.target = this.angle = open ? GATE_OPEN : 0;
  }

  update(dt, t) {
    const before = this.angle;
    this.angle = damp(this.angle, this.target, 4.2, dt);
    // A soft knock as the bar lands.
    if (this.closing && this.angle < 0.02 && before >= 0.02) {
      this.closing = false;
      sound.thump(150, 0.06);
    }
    this.bar.rotation.z = this.angle;
    this.stoneMeshes.forEach((s, i) => {
      s.position.y = -0.06 + Math.sin(t * 0.9 + i * 1.7) * 0.02;
    });
  }
}

/**
 * The perimeter wall closest (by walking) to the start, with open sky beyond.
 * Score = distance × 10 − stones × 3 − 2 if it faces the default camera.
 */
export function chooseGate(level) {
  const start = level.start;
  const dist = new Map();
  const key = (r, c) => r * 1000 + c;
  const queue = [start];
  dist.set(key(start.r, start.c), 0);
  while (queue.length) {
    const cur = queue.shift();
    for (const [dr, dc] of CLOCKWISE) {
      const nr = cur.r + dr;
      const nc = cur.c + dc;
      if (!level.inside[nr]?.[nc] || dist.has(key(nr, nc))) continue;
      dist.set(key(nr, nc), dist.get(key(cur.r, cur.c)) + 1);
      queue.push({ r: nr, c: nc });
    }
  }
  const isVoid = (r, c) => !(level.wall[r]?.[c] || level.inside[r]?.[c]);
  let best = null;
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (!level.wall[r][c]) continue;
      for (const [dr, dc] of CLOCKWISE) {
        const d = dist.get(key(r - dr, c - dc));
        if (d === undefined) continue;
        let stones = 0;
        while (stones < 3 && isVoid(r + dr * (stones + 1), c + dc * (stones + 1))) stones++;
        if (stones === 0) continue;
        // Prefer short walks, then more room for stones, then gates facing the camera.
        const score = d * 10 - stones * 3 - (dr > 0 || dc > 0 ? 2 : 0);
        if (!best || score < best.score) best = { r, c, dir: [dr, dc], stones, score };
      }
    }
  }
  return best;
}
