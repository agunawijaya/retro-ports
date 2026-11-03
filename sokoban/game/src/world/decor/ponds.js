/**
 * @file Koi ponds (reference §13b, ART-DIRECTION §10b.1). Inner walls become
 * water; the rules never change: a water cell is still a wall to the game.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pastel, roles } from '../../render/pastel.js';
import { waterMaterial, pondDeep, WATER_Y, RIM_H } from '../../render/water.js';
import { board, cellX, cellZ, CLOCKWISE } from '../../render/board.js';
import { clamp, dampAngle } from '../../render/math.js';
import { Fountain } from './fountain.js';
import { env } from './env.js';
import { reducedMotion } from '../../state/settings.js';

/** Copy of a geometry moved to (x, y, z): the building block of merged meshes. */
export function translated(geo, x, y, z) {
  const g = geo.clone();
  g.translate(x, y, z);
  return g;
}

const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));

/**
 * Writes one instance's colour into an `aColor` `InstancedBufferAttribute`
 * (`pastel`'s `instancedColor` scheme). `THREE.Color` does the sRGB -> linear
 * working-colour-space conversion on construction, same as it would for
 * `InstancedMesh.setColorAt`; this just lands those three numbers in our own
 * buffer instead of the one pastel's fragment shader can't see.
 */
export function writeInstanceColor(attr, index, hex) {
  const c = _colorScratch.set(hex);
  attr.setXYZ(index, c.r, c.g, c.b);
}
const _colorScratch = new THREE.Color();

/** Split the inner wall cells into 4-connected groups. */
export function innerComponents(level, inner) {
  const seen = new Set();
  const groups = [];
  const key = (r, c) => r * 1000 + c;
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (!inner[r][c] || seen.has(key(r, c))) continue;
      const cells = [];
      const stack = [{ r, c }];
      seen.add(key(r, c));
      while (stack.length) {
        const cur = stack.pop();
        cells.push(cur);
        for (const [dr, dc] of CLOCKWISE) {
          const nr = cur.r + dr;
          const nc = cur.c + dc;
          if (inner[nr]?.[nc] && !seen.has(key(nr, nc))) {
            seen.add(key(nr, nc));
            stack.push({ r: nr, c: nc });
          }
        }
      }
      groups.push(cells);
    }
  }
  return groups;
}

export const KOI_PALETTES = [
  ['#f5873f', '#fbf5ec'], ['#fbf5ec', '#ec6240'], ['#f3a52f', '#fbf5ec'], ['#fbf5ec', '#3d3743'], ['#ee6e4a', '#f3a52f'],
];

export class Pond {
  /**
   * @param {{r:number,c:number}[]} cells
   * @param {THREE.Group} group
   * @param {{ fountain?: boolean, koi?: number, pads?: number, batch?: import('./water-batch.js').WaterBatch }} [options]
   *   a room leaves these to the size rule (§10b.1); the courtyard's Kolam
   *   asks for exactly two koi, one lotus and no fountain. `batch` (rooms
   *   only) pools the still shell, pads, blooms and koi with the room's
   *   other water decor, one draw call per kind instead of one per pond.
   */
  constructor(cells, group, options = {}) {
    const rand = env.rand;
    const batch = options.batch ?? null;
    this.batch = batch;
    this.cells = cells;
    this.set = new Set(cells.map((p) => p.r * 1000 + p.c));
    this.kois = [];
    this.fountain = null;

    const bottom = [];
    const water = [];
    const rim = [];
    const bottomGeo = new THREE.BoxGeometry(1, 0.1, 1);
    const waterGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (const { r, c } of cells) {
      const x = cellX(c);
      const z = cellZ(r);
      bottom.push(translated(bottomGeo, x, -0.15, z));
      water.push(translated(waterGeo, x, WATER_Y, z));
      // A rim stone on every edge that does not continue into the same pond.
      CLOCKWISE.forEach(([dr, dc]) => {
        if (this.has(r + dr, c + dc)) return;
        const along = dr === 0;
        const g = new THREE.BoxGeometry(along ? 0.12 : 1.04, RIM_H + 0.06, along ? 1.04 : 0.12);
        rim.push(translated(g, x + dc * 0.46, (RIM_H - 0.06) / 2, z + dr * 0.46));
      });
    }
    if (batch) {
      batch.addPondShell({ bottom, rim, surface: water });
    } else {
      group.add(new THREE.Mesh(merge(bottom), pastel(null, { roleColor: pondDeep })));
      group.add(new THREE.Mesh(merge(rim), pastel(null, { roleColor: roles.cap })));
      const surface = new THREE.Mesh(merge(water), waterMaterial());
      surface.renderOrder = 2;
      group.add(surface);
    }

    // Lily pads drift slowly on the bigger ponds.
    const pads = options.pads ?? Math.min(3, cells.length - 2);
    this.pads = [];
    for (let i = 0; i < pads; i++) {
      const cell = cells[(i * 7 + 3) % cells.length];
      const r = 0.08 + rand() * 0.05;
      const px = cellX(cell.c) + (rand() - 0.5) * 0.4;
      const pz = cellZ(cell.r) + (rand() - 0.5) * 0.4;
      if (batch) {
        const index = batch.addPad(px, WATER_Y + 0.006, pz, r, rand() * 6);
        if (i === 0) batch.addBloom(index);
        continue;
      }
      const pad = new THREE.Mesh(new THREE.CircleGeometry(r, 18, 0.4, Math.PI * 2 - 0.4).rotateX(-Math.PI / 2), pastel('#a9c99b'));
      pad.position.set(px, WATER_Y + 0.006, pz);
      pad.rotation.y = rand() * 6;
      if (i === 0) {
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), pastel('#f5c2cf'));
        bloom.scale.y = 0.7;
        bloom.position.set(0.02, 0.02, 0);
        pad.add(bloom);
      }
      group.add(pad);
      this.pads.push(pad);
    }

    // A fountain for the big ponds: at the shared corner of a 2×2 block if there is one.
    const block = cells.find(({ r, c }) => this.has(r + 1, c) && this.has(r, c + 1) && this.has(r + 1, c + 1));
    if (options.fountain !== false && (block || cells.length >= 6)) {
      const mid = cells[Math.floor(cells.length / 2)];
      const x = block ? cellX(block.c) + 0.5 : cellX(mid.c);
      const z = block ? cellZ(block.r) + 0.5 : cellZ(mid.r);
      this.fountain = new Fountain(x, z);
      group.add(this.fountain.group);
    }

    const count = options.koi ?? clamp(Math.floor(cells.length / 2) + 1, 2, 5);
    // This pond's slots in the room-wide koi meshes (its own meshes when unbatched).
    this.koiBase = batch ? batch.koiSlots : 0;

    if (!batch) {
      // Instanced koi meshes for this pond (body, spot, fin). Colour rides a
      // merged-geometry `aColor` attribute (`pastel`'s `instancedColor`
      // option, the same scheme `instances.js` uses for per-instance glow) -
      // not `InstancedMesh.setColorAt`, whose colour pastel's fragment
      // shader never receives: three only adds the built-in
      // `USE_INSTANCING_COLOR` define to the *vertex* stage, so a koi lost
      // its palette and rendered as plain white tinted by the sky.
      const bodyGeo = new THREE.SphereGeometry(1, 14, 10);
      bodyGeo.scale(0.045, 0.026, 0.12);
      const spotGeo = new THREE.SphereGeometry(1, 10, 8);
      spotGeo.scale(0.036, 0.02, 0.05);
      spotGeo.translate(0, 0.009, 0.025);
      const finGeo = new THREE.ConeGeometry(0.05, 0.09, 4);
      finGeo.rotateX(-Math.PI / 2);
      finGeo.scale(1, 1, 0.22);
      finGeo.translate(0, 0, -0.035);

      this.bodyColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      this.spotColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      this.finColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      bodyGeo.setAttribute('aColor', this.bodyColor);
      spotGeo.setAttribute('aColor', this.spotColor);
      finGeo.setAttribute('aColor', this.finColor);

      this.bodyMesh = new THREE.InstancedMesh(bodyGeo, pastel('#ffffff', { instancedColor: true }), count);
      this.spotMesh = new THREE.InstancedMesh(spotGeo, pastel('#ffffff', { instancedColor: true }), count);
      this.finMesh = new THREE.InstancedMesh(finGeo, pastel('#ffffff', { instancedColor: true }), count);
      this.bodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.spotMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.finMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(this.bodyMesh, this.spotMesh, this.finMesh);
    }

    for (let i = 0; i < count; i++) {
      const palette = KOI_PALETTES[i % KOI_PALETTES.length];
      const koi = new Koi(this);
      group.add(koi.group);
      this.kois.push(koi);

      if (batch) {
        batch.addKoi(palette[0], palette[1]);
      } else {
        writeInstanceColor(this.bodyColor, i, palette[0]);
        writeInstanceColor(this.spotColor, i, palette[1]);
        writeInstanceColor(this.finColor, i, palette[0]);
      }
    }
    if (!batch) {
      this.bodyColor.needsUpdate = true;
      this.spotColor.needsUpdate = true;
      this.finColor.needsUpdate = true;
    }
  }

  has(r, c) {
    return this.set.has(r * 1000 + c);
  }

  // Is a point inside the water, clear of the rim and the fountain?
  contains(x, z) {
    const c = Math.round(x + board.cols / 2 - 0.5);
    const r = Math.round(z + board.rows / 2 - 0.5);
    if (!this.has(r, c)) return false;
    const lx = x - cellX(c);
    const lz = z - cellZ(r);
    const m = 0.34;
    if (lx > m && !this.has(r, c + 1)) return false;
    if (lx < -m && !this.has(r, c - 1)) return false;
    if (lz > m && !this.has(r + 1, c)) return false;
    if (lz < -m && !this.has(r - 1, c)) return false;
    if (this.fountain && Math.hypot(x - this.fountain.x, z - this.fountain.z) < 0.3) return false;
    return true;
  }

  randomPoint() {
    const rand = env.rand;
    for (let i = 0; i < 20; i++) {
      const cell = this.cells[Math.floor(rand() * this.cells.length)];
      const x = cellX(cell.c) + (rand() - 0.5) * 0.6;
      const z = cellZ(cell.r) + (rand() - 0.5) * 0.6;
      if (this.contains(x, z)) return { x, z };
    }
    return { x: cellX(this.cells[0].c), z: cellZ(this.cells[0].r) };
  }

  update(dt, t) {
    const bodyMesh = this.batch ? this.batch.koiBody : this.bodyMesh;
    const spotMesh = this.batch ? this.batch.koiSpot : this.spotMesh;
    const finMesh = this.batch ? this.batch.koiFin : this.finMesh;
    const base = this.batch ? this.koiBase : 0;
    const finMat = new THREE.Matrix4();
    for (let i = 0; i < this.kois.length; i++) {
      const k = this.kois[i];
      k.update(dt, t);
      k.group.updateMatrix();
      k.tail.updateMatrix();

      bodyMesh.setMatrixAt(base + i, k.group.matrix);
      spotMesh.setMatrixAt(base + i, k.group.matrix);

      finMat.multiplyMatrices(k.group.matrix, k.tail.matrix);
      finMesh.setMatrixAt(base + i, finMat);
    }
    // Batched: the batch flags the shared buffers once per frame.
    if (!this.batch && this.kois.length > 0) {
      this.bodyMesh.instanceMatrix.needsUpdate = true;
      this.spotMesh.instanceMatrix.needsUpdate = true;
      this.finMesh.instanceMatrix.needsUpdate = true;
    }

    if (!this.batch && !reducedMotion()) for (const p of this.pads) p.rotation.y += dt * 0.03;
    if (!reducedMotion()) this.fountain?.update(dt);
  }
}

class Koi {
  constructor(pond) {
    const rand = env.rand;
    this.pond = pond;
    const g = (this.group = new THREE.Group());
    this.tail = new THREE.Group();
    this.tail.position.z = -0.1;
    g.add(this.tail);

    const start = pond.randomPoint();
    g.position.set(start.x, WATER_Y - 0.035, start.z);
    g.scale.setScalar(1.3);
    this.heading = rand() * Math.PI * 2;
    this.speed = 0.18 + rand() * 0.14;
    this.target = pond.randomPoint();
    this.phase = rand() * 10;
    this.rippleIn = 3 + rand() * 6;
  }

  update(dt, t) {
    if (reducedMotion()) {
      this.tail.rotation.y = 0;
      this.group.rotation.y = this.heading;
      return;
    }
    const p = this.group.position;
    const dx = this.target.x - p.x;
    const dz = this.target.z - p.z;
    if (Math.hypot(dx, dz) < 0.12) this.target = this.pond.randomPoint();
    this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 1.4, dt);
    const nx = p.x + Math.sin(this.heading) * this.speed * dt;
    const nz = p.z + Math.cos(this.heading) * this.speed * dt;
    if (this.pond.contains(nx, nz)) {
      p.x = nx;
      p.z = nz;
    } else {
      this.target = this.pond.randomPoint();
      this.heading += 0.08;
    }

    const beat = t * (6 + this.speed * 14) + this.phase;
    this.tail.rotation.y = Math.sin(beat) * 0.55;
    this.group.rotation.y = this.heading + Math.sin(beat - 0.6) * 0.07;

    // Now and then a koi kisses the surface.
    this.rippleIn -= dt;
    if (this.rippleIn < 0) {
      this.rippleIn = 4 + env.rand() * 7;
      env.fx?.ripple(p.x + Math.sin(this.heading) * 0.1, p.z + Math.cos(this.heading) * 0.1, '#ffffff', 1.2, 1.0, WATER_Y + 0.004, 0.22);
    }
  }
}
