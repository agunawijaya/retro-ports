/**
 * @file Tsukubai: a stone basin with a bamboo spout, for inner walls of one or
 * two cells (reference §13b, ART-DIRECTION §10b.1).
 */

import * as THREE from 'three';
import { pastel } from '../../render/pastel.js';
import { waterMaterial } from '../../render/water.js';
import { textures } from '../../render/textures.js';
import { cellX, cellZ } from '../../render/board.js';
import { clamp, lerp } from '../../render/math.js';
import { sound } from '../../audio/sound.js';
import { env } from './env.js';
import { mergeStatic } from '../../render/merge.js';
import { reducedMotion } from '../../state/settings.js';

export class Basin {
  /**
   * @param {{r:number,c:number}[]} cells
   * @param {THREE.Group} island
   * @param {{ batch?: import('./water-batch.js').WaterBatch }} [options]
   *   rooms pass the shared batch so a dozen basins still draw once per
   *   material; without it the basin builds its own meshes as before.
   */
  constructor(cells, island, options = {}) {
    const batch = options.batch ?? null;
    this.batch = batch;
    const [first, second] = cells;
    const x = cellX(first.c);
    const z = cellZ(first.r);
    this.x = x;
    this.z = z;
    this.tip = new THREE.Vector3(x - 0.07, 0.4, z - 0.1);
    this.t = env.rand();

    if (batch) {
      // Still parts join the room-wide merge, in island space already.
      const moss = cells.map(({ r, c }) => {
        const g = new THREE.BoxGeometry(0.98, 0.16, 0.98);
        g.translate(cellX(c), 0.04, cellZ(r));
        return g;
      });
      const bowl = new THREE.CylinderGeometry(0.21, 0.24, 0.17, 20);
      bowl.translate(x, 0.205, z);
      const stone = [bowl];
      if (second) {
        const sx = cellX(second.c);
        const sz = cellZ(second.r);
        const rock = new THREE.DodecahedronGeometry(0.15);
        rock.scale(1, 0.7, 1);
        rock.translate(sx - 0.08, 0.2, sz + 0.05);
        const pebble = new THREE.DodecahedronGeometry(0.09);
        pebble.scale(1, 0.6, 1);
        pebble.translate(sx + 0.18, 0.16, sz - 0.12);
        stone.push(rock, pebble);
      }
      const post = new THREE.CylinderGeometry(0.022, 0.024, 0.34, 10);
      post.translate(x - 0.32, 0.29, z - 0.1);
      const spout = new THREE.CylinderGeometry(0.018, 0.018, 0.3, 10);
      spout.rotateZ(-1.25);
      spout.translate(x - 0.2, 0.43, z - 0.1);
      const water = new THREE.CircleGeometry(0.16, 24).rotateX(-Math.PI / 2);
      water.translate(x, 0.292, z);
      batch.addBasinParts({ moss, stone, bamboo: [post, spout], water: [water] });
      this.dropSlot = batch.addDrop();
      return;
    }

    // Built in its own group so the still parts can merge per colour.
    const group = new THREE.Group();
    island.add(group);
    const moss = pastel('#c7cfb6');
    const stone = pastel('#ddd3c7');
    for (const { r, c } of cells) {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.16, 0.98), moss);
      plinth.position.set(cellX(c), 0.04, cellZ(r));
      group.add(plinth);
    }
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.17, 20), stone);
    bowl.position.set(x, 0.205, z);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24).rotateX(-Math.PI / 2), waterMaterial(0.9));
    water.position.set(x, 0.292, z);
    water.renderOrder = 2;
    const bamboo = pastel('#b9c98f');
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.34, 10), bamboo);
    post.position.set(x - 0.32, 0.29, z - 0.1);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 10), bamboo);
    spout.rotation.z = -1.25;
    spout.position.set(x - 0.2, 0.43, z - 0.1);
    group.add(bowl, water, post, spout);

    this.drop = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: textures().glow, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
    );
    this.drop.scale.setScalar(0.06);
    group.add(this.drop);

    if (second) {
      const sx = cellX(second.c);
      const sz = cellZ(second.r);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15), stone);
      rock.scale.set(1, 0.7, 1);
      rock.position.set(sx - 0.08, 0.2, sz + 0.05);
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09), stone);
      pebble.scale.set(1, 0.6, 1);
      pebble.position.set(sx + 0.18, 0.16, sz - 0.12);
      group.add(rock, pebble);
    }
    // The water keeps its own mesh: it must draw after the stone (renderOrder 2).
    mergeStatic(group, group.children.filter((o) => o.isMesh && o !== water));
  }

  update(dt) {
    if (reducedMotion()) {
      if (this.batch) this.batch.setDrop(this.dropSlot, this.tip.x, this.tip.y, this.tip.z, 0);
      else if (this.drop) this.drop.material.opacity = 0;
      return;
    }
    // One drop every 1.8 s: forms at the spout, falls, rings the basin.
    this.t += dt / 1.8;
    if (this.t >= 1) {
      this.t -= 1;
      env.fx?.ripple(this.x - 0.05, this.z - 0.1, '#ffffff', 1.6, 0.9, 0.296, 0.12);
      sound.drip();
    }
    const fall = clamp((this.t - 0.75) / 0.25, 0, 1);
    const y = lerp(this.tip.y, 0.3, fall * fall);
    const opacity = this.t > 0.55 ? 0.9 : 0;
    if (this.batch) {
      this.batch.setDrop(this.dropSlot, this.tip.x, y, this.tip.z, opacity);
    } else {
      this.drop.position.set(this.tip.x, y, this.tip.z);
      this.drop.material.opacity = opacity;
    }
  }
}
