/**
 * @file The fountain in a big pond (reference §13b, ART-DIRECTION §10b.1):
 * a stone column, a particle jet that rises, arcs and falls, splash ripples.
 */

import * as THREE from 'three';
import { pastel, roles } from '../../render/pastel.js';
import { textures } from '../../render/textures.js';
import { WATER_Y } from '../../render/water.js';
import { mergeStatic } from '../../render/merge.js';
import { env } from './env.js';

export class Fountain {
  constructor(x, z) {
    this.x = x;
    this.z = z;
    const g = (this.group = new THREE.Group());
    g.position.set(x, 0, z);
    const stone = pastel(null, { roleColor: roles.cap });
    const part = (geo, y) => {
      const m = new THREE.Mesh(geo, stone);
      m.position.y = y;
      g.add(m);
      return m;
    };
    part(new THREE.CylinderGeometry(0.2, 0.24, 0.24, 24), 0.0);
    part(new THREE.CylinderGeometry(0.055, 0.075, 0.2, 16), 0.22);
    part(new THREE.CylinderGeometry(0.16, 0.09, 0.06, 24), 0.35);
    part(new THREE.SphereGeometry(0.04, 12, 10), 0.4);
    mergeStatic(g, g.children.filter((o) => o.isMesh));

    // Water: a small particle jet that rises, arcs and falls into the pond.
    this.N = 110;
    this.pos = new Float32Array(this.N * 3);
    this.vel = Array.from({ length: this.N }, () => ({ alive: false }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({
      size: 6, sizeAttenuation: false, map: textures().glow, color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    g.add(this.points);
    this.spawn = 0;
    this.rippleIn = 0;
  }

  update(dt) {
    const rand = env.rand;
    this.spawn += dt * 130;
    for (let i = 0; i < this.N && this.spawn >= 1; i++) {
      const v = this.vel[i];
      if (v.alive) continue;
      const a = rand() * Math.PI * 2;
      const out = 0.2 + rand() * 0.22;
      Object.assign(v, { alive: true, x: 0, y: 0.43, z: 0, vx: Math.cos(a) * out, vy: 0.95 + rand() * 0.3, vz: Math.sin(a) * out });
      this.spawn -= 1;
    }
    this.spawn = Math.min(this.spawn, 2);
    this.vel.forEach((v, i) => {
      if (v.alive) {
        v.vy -= 3.4 * dt;
        v.x += v.vx * dt;
        v.y += v.vy * dt;
        v.z += v.vz * dt;
        if (v.y < WATER_Y) v.alive = false;
      }
      this.pos[i * 3] = v.alive ? v.x : 0;
      this.pos[i * 3 + 1] = v.alive ? v.y : -999;
      this.pos[i * 3 + 2] = v.alive ? v.z : 0;
    });
    this.points.geometry.attributes.position.needsUpdate = true;
    this.rippleIn -= dt;
    if (this.rippleIn < 0) {
      this.rippleIn = 0.35;
      const a = rand() * Math.PI * 2;
      const d = 0.28 + rand() * 0.1;
      env.fx?.ripple(this.x + Math.cos(a) * d, this.z + Math.sin(a) * d, '#ffffff', 1.4, 0.7, WATER_Y + 0.004, 0.14);
    }
  }
}
