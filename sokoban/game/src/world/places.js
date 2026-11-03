/**
 * @file The courtyard (Halaman) and its five places (ART-DIRECTION §13.3,
 * GAME-DESIGN §7.2): the top of the courtyard stone (stone 0 of Menara Hening)
 * on a 9 × 9 walk grid centred on the vertical axis (0, 0). The wanderer walks
 * instead of reading a menu.
 */

import * as THREE from 'three';
import { parseLevel } from '../core/level.js';
import { pastel, roles } from '../render/pastel.js';
import { mergeStatic } from '../render/merge.js';
import { cellX, cellZ } from '../render/board.js';
import { COURTYARD, isWalkable } from './stone-layout.js';
import { Pond } from './decor/ponds.js';

const VERMILION = '#e88f78';
const DARK = '#4d4552';
const STONE = '#ece2d6';
const STONE_DARK = '#cdbfb3';
const STELE = '#e8ddd0';
const ENGRAVING = '#a8988c';

export const COURTYARD_START = { r: 6, c: 4 };

/** The tower axis is at (0, 0) — Menara Hening's floating stones share this vertical axis. */
export const TOWER_Z = 0;

/** Where the caption for each place hovers in 3D world space. */
function placeTop(id) {
  switch (id) {
    case 'gerbang':
      return [cellX(4), 1.8, cellZ(5)];
    case 'paviliun':
      return [cellX(6.5), 2.5, cellZ(1.5)];
    case 'batu':
      return [cellX(1), 1.45, cellZ(2)];
    case 'kolam':
      return [cellX(6.5), 0.6, cellZ(6.5)];
    case 'jalan':
      return [cellX(0), 0.55, cellZ(5)];
    default:
      return [0, 1, 0];
  }
}

/** The five places, in key order 1–5 (GAME-DESIGN §7.2, ART-DIRECTION §13.3). */
export const PLACES = COURTYARD.places.map((p) => ({
  id: p.id,
  name: p.name,
  tile: { r: p.activation.r, c: p.activation.c },
  cells: p.cells,
  top: placeTop(p.id),
}));

/** The walkable grid, for core/game.js and core/path.js. */
export function courtyardLevel() {
  const placeCells = new Set();
  for (const p of COURTYARD.places) {
    for (const [r, c] of p.cells) {
      placeCells.add(`${r},${c}`);
    }
  }

  const rows = [];
  for (let r = 0; r < COURTYARD.size; r++) {
    let row = '';
    for (let c = 0; c < COURTYARD.size; c++) {
      if (r === COURTYARD_START.r && c === COURTYARD_START.c) {
        row += '@';
      } else if (!isWalkable(r, c) || placeCells.has(`${r},${c}`)) {
        row += '#';
      } else {
        row += ' ';
      }
    }
    rows.push(row);
  }
  return parseLevel(rows);
}

// Gerbang Menara: the rooms' torii (gate.js) at 1.2 × its size, standing on the
// recess's front lip so its passage leads onto the platform. At 1.3 tall it
// clears the underside of Lantai I above the opening (y 1.8).
function buildGerbang(parts, red, dark, cap) {
  const k = 1.2;
  const gz = 1.32; // the front lip of the r 1.2 recess
  const at = (geo, mat, x, y, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x * k, y * k, gz);
    m.rotation.z = rz;
    parts.add(m);
  };
  for (const x of [-0.4, 0.4]) {
    at(new THREE.CylinderGeometry(0.1 * k, 0.11 * k, 0.09 * k, 16), dark, x, 0.045);
    at(new THREE.CylinderGeometry(0.052 * k, 0.06 * k, 1.06 * k, 16), red, x, 0.53);
  }
  at(new THREE.BoxGeometry(1.0 * k, 0.05 * k, 0.08 * k), red, 0, 0.82); // nuki
  at(new THREE.BoxGeometry(0.06 * k, 0.14 * k, 0.06 * k), red, 0, 0.92); // gakuzuka
  at(new THREE.BoxGeometry(1.16 * k, 0.05 * k, 0.12 * k), red, 0, 1.015); // shimaki
  at(new THREE.BoxGeometry(1.12 * k, 0.07 * k, 0.15 * k), dark, 0, 1.07); // kasagi
  for (const sgn of [-1, 1]) at(new THREE.BoxGeometry(0.16 * k, 0.07 * k, 0.15 * k), dark, sgn * 0.62, 1.09, sgn * 0.28);
}

function buildBatu(parts, steleMat, cap) {
  const bx = cellX(1);
  const bz = cellZ(2);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.36), cap);
  base.position.set(bx, 0.05, bz);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.16), steleMat);
  body.position.set(bx, 0.6, bz);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.16, 24, 1, false, -Math.PI / 2, Math.PI), steleMat);
  head.rotation.x = -Math.PI / 2;
  head.position.set(bx, 1.1, bz);
  parts.add(base, body, head);
}

// Paviliun Taman: four posts and a hex roof like the lantern's, 2.2 wide. It
// stands under the rim of Lantai I (whose underside is near y 1.45 here), so
// it is a low garden pavilion: everything stays under 1.35.
function buildPaviliun(parts, stoneDark, stone, cap) {
  const px = cellX(6.5);
  const pz = cellZ(1.5);
  const k = 3.24;
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.06, 0.08, 6), cap);
  dais.position.set(px, 0.04, pz);
  dais.rotation.y = Math.PI / 6;
  parts.add(dais);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.84, 8), stoneDark);
    col.position.set(px + Math.cos(a) * 0.72, 0.5, pz + Math.sin(a) * 0.72);
    parts.add(col);
  }
  const roofRim = new THREE.Mesh(new THREE.CylinderGeometry(0.31 * k, 0.33 * k, 0.06, 6), stoneDark);
  roofRim.position.set(px, 0.95, pz);
  roofRim.rotation.y = Math.PI / 6;
  const roofCap = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * k, 0.34 * k, 0.26, 6), stone);
  roofCap.position.set(px, 1.11, pz);
  roofCap.rotation.y = Math.PI / 6;
  const roofFinial = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), stone);
  roofFinial.position.set(px, 1.28, pz);
  parts.add(roofRim, roofCap, roofFinial);
}

// Jalan Setapak: five small river stones floating free off the west rim, each
// smaller and lower than the last, the same rounded profile as the big stones.
function buildJalan(parts, cap) {
  for (const s of COURTYARD.steppingStones) {
    const r = s.size / 2;
    const profile = [[0.001, -0.22], [r * 0.7, -0.2], [r, -0.08], [r * 0.96, -0.02], [r * 0.82, 0], [0.001, 0]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const step = new THREE.Mesh(new THREE.LatheGeometry(profile, 16), cap);
    step.position.set(s.x, s.topY, s.z);
    parts.add(step);
  }
}

/**
 * Builds the courtyard's five places into `group`.
 * @param {THREE.Group} group courtyard space (board 9 × 9, centred on the vertical axis)
 * @returns {{ pond: Pond, perches: {pos: THREE.Vector3, taken: null}[], setEngravings(n: number): void, update(dt, t): void }}
 */
export function buildCourtyard(group) {
  const parts = new THREE.Group();
  group.add(parts);

  const red = pastel(VERMILION);
  const dark = pastel(DARK);
  const cap = pastel(null, { roleColor: roles.cap });
  const stone = pastel(STONE);
  const stoneDark = pastel(STONE_DARK);
  const steleMat = pastel(STELE);

  buildGerbang(parts, red, dark, cap);
  buildBatu(parts, steleMat, cap);
  buildPaviliun(parts, stoneDark, stone, cap);
  buildJalan(parts, cap);

  mergeStatic(parts);

  // Engravings: one fixed pair at top, then one line per lit floor.
  const bx = cellX(1);
  const bz = cellZ(2);
  const engraveMat = pastel(ENGRAVING);
  let engravings = null;

  function setEngravings(lit) {
    if (engravings) {
      group.remove(engravings);
      engravings.children.forEach((m) => m.geometry.dispose());
    }
    engravings = new THREE.Group();
    const lines = [[0.3, 0.98, 0.04], [0.16, 0.9, 0.03]];
    for (let i = 0; i < Math.min(5, lit); i++) {
      lines.push([0.34, 0.76 - i * 0.12, 0.045]);
    }
    for (const [w, y, h] of lines) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.014), engraveMat);
      m.position.set(bx, y, bz + 0.085);
      engravings.add(m);
    }
    group.add(engravings);
    mergeStatic(engravings);
  }

  setEngravings(0);

  // Kolam: pond at (6, 6)–(7, 7).
  const kolamCells = COURTYARD.places.find((p) => p.id === 'kolam').cells.map(([r, c]) => ({ r, c }));
  const pond = new Pond(kolamCells, group, { fountain: false, koi: 2, pads: 1 });

  // Perches for crows: torii, stele, pavilion roof.
  const gx = cellX(4);
  const gz = cellZ(5);
  const px = cellX(6.5);
  const pz = cellZ(1.5);
  const k = 3.24;

  const perches = [
    // The torii's upturned kasagi ends (1.2 × the room torii), the stele's
    // round head, the pavilion's finial.
    { pos: new THREE.Vector3(-0.72, 1.36, 1.32), taken: null },
    { pos: new THREE.Vector3(0.72, 1.36, 1.32), taken: null },
    { pos: new THREE.Vector3(bx, 1.36, bz), taken: null },
    { pos: new THREE.Vector3(px, 1.36, pz), taken: null },
  ];

  return {
    pond,
    perches,
    setEngravings,
    update(dt, t) {
      pond.update(dt, t);
    },
  };
}
