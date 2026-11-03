/**
 * @file The decor manager, rebuilt with each room (reference §13f,
 * ART-DIRECTION §10b). Everything here is decoration: none of it changes the
 * rules, blocks input, or can be pushed.
 */

import * as THREE from 'three';
import { cellX, cellZ, CLOCKWISE } from '../../render/board.js';
import { waterUniforms, RIM_H } from '../../render/water.js';
import { Pond } from './ponds.js';
import { Basin } from './basin.js';
import { Gate } from './gate.js';
import { Stranger, chooseSeat } from './stranger.js';
import { Crow } from './crows.js';
import { env } from './env.js';
import { WaterBatch } from './water-batch.js';
import { reducedMotion } from '../../state/settings.js';

/**
 * @param {object} level core level
 * @param {{ gate: object|null, components: {r:number,c:number}[][], finials: {x:number,z:number}[], capPerches: {x:number,z:number}[] }} plan from buildIsland
 * @param {THREE.Group} group the island group
 * @param {{ fx: object, rand: () => number }} room the room's effects and seeded generator
 */
export function buildDecor(level, plan, group, { fx, rand }) {
  env.fx = fx;
  env.rand = rand;
  const decor = { ponds: [], basins: [], gate: null, stranger: null, crows: [], perches: [] };

  // The water decor shares one batch: big rooms hold a dozen basins and half
  // a dozen ponds, and per-piece meshes would run past the draw-call budget.
  const batch = new WaterBatch();
  for (const cells of plan.components) {
    if (cells.length <= 2) decor.basins.push(new Basin(cells, group, { batch }));
    else decor.ponds.push(new Pond(cells, group, { batch }));
  }
  batch.build(group);
  decor.batch = batch;
  decor.gate = plan.gate ? new Gate(plan.gate, group) : null;
  const seat = chooseSeat(level, plan.gate);
  decor.stranger = seat ? new Stranger(seat, group) : null;

  // Places a crow may land: finials, the torii, pond rims, wall caps.
  const add = (x, y, z) => decor.perches.push({ pos: new THREE.Vector3(x, y, z), taken: null });
  for (const f of plan.finials) add(f.x, 0.78, f.z);
  if (decor.gate) for (const p of decor.gate.perches) add(p.x, p.y, p.z);
  for (const pond of decor.ponds) {
    const cell = pond.cells[0];
    const [dr, dc] = CLOCKWISE.find(([r, c]) => !pond.has(cell.r + r, cell.c + c));
    add(cellX(cell.c) + dc * 0.46, RIM_H + 0.01, cellZ(cell.r) + dr * 0.46);
  }
  for (const w of plan.capPerches) add(w.x, 0.48, w.z);

  // One or two crows (50 / 50), arriving staggered.
  const crows = 1 + (rand() < 0.5 ? 1 : 0);
  for (let i = 0; i < crows; i++) {
    const crow = new Crow(group, decor.perches);
    crow.timer = 1.5 + i * 3.5 + rand() * 2;
    decor.crows.push(crow);
  }
  decor.dispose = () => batch.dispose();
  return decor;
}

/** @param {THREE.Vector3} wandererPos */
export function updateDecor(decor, dt, t, wandererPos) {
  waterUniforms.uTime.value = reducedMotion() ? 0 : t;
  for (const p of decor.ponds) p.update(dt, t);
  for (const b of decor.basins) b.update(dt);
  decor.batch?.update(dt);
  decor.gate?.update(dt, t);
  decor.stranger?.update(dt, t, wandererPos);
  for (const c of decor.crows) c.update(dt, t, wandererPos);
}

/** Counts for the all-rooms check. */
export function decorCounts(decor) {
  return {
    ponds: decor.ponds.length,
    basins: decor.basins.length,
    fountains: decor.ponds.filter((p) => p.fountain).length,
    koi: decor.ponds.reduce((n, p) => n + p.kois.length, 0),
  };
}
