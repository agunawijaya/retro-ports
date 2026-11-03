/**
 * @file The island: floor checker, outer walls with caps and finials, and the
 * plinth stepping down into the mist (reference §10, ART-DIRECTION §6).
 * Geometry only: it reads a level and returns the plan the decor builds on.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pastel, roles } from './pastel.js';
import { cellX, cellZ } from './board.js';
import { chooseGate } from '../world/decor/gate.js';
import { innerComponents, translated } from '../world/decor/ponds.js';

// Shared geometry for the architecture kit. Tile = 1 unit.
const KIT = {
  floorTile: new THREE.BoxGeometry(0.96, 0.06, 0.96),
  wallBody: new THREE.BoxGeometry(1, 0.46, 1),
  wallCap: new THREE.BoxGeometry(1.04, 0.08, 1.04),
  finialBase: new THREE.CylinderGeometry(0.14, 0.16, 0.12, 20),
  finialBall: new THREE.SphereGeometry(0.12, 20, 14),
};

function erode(grid) {
  return grid.map((row, r) => row.map((v, c) => v && grid[r - 1]?.[c] && grid[r + 1]?.[c] && row[c - 1] && row[c + 1]));
}

function edgeCell(grid, r, c) {
  return !(grid[r - 1]?.[c] && grid[r + 1]?.[c] && grid[r][c - 1] && grid[r][c + 1]);
}

function centerCore(level) {
  const cr = (level.rows - 1) / 2;
  const cc = (level.cols - 1) / 2;
  return level.wall.map((row, r) => row.map((_, c) => Math.abs(r - cr) <= 1 && Math.abs(c - cc) <= 1));
}

/**
 * @param {object} level core level ({ rows, cols, wall, inside, start, … })
 * @param {{ openings?: {r:number,c:number}[] }} [options] `openings`: wall
 *   cells left open (no body, cap or finial) instead of the one torii gate a
 *   room chooses for itself — the courtyard opens onto the tower and the path.
 * @returns {{ group: THREE.Group, plan: { gate: object|null, components: object[][], finials: object[], capPerches: object[] } }}
 */
export function buildIsland(level, { openings } = {}) {
  const group = new THREE.Group();
  const parts = { floorA: [], floorB: [], wall: [], cap: [], stone: [] };
  const footprint = level.wall.map((row, r) => row.map((w, c) => w || level.inside[r][c]));

  // Walls that never touch the sky are "inner": they become water (decor).
  const isVoid = (r, c) => !(level.wall[r]?.[c] || level.inside[r]?.[c]);
  const inner = level.wall.map((row, r) => row.map((w, c) => w
    && ![-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => (dr || dc) && isVoid(r + dr, c + dc)))));
  const gate = openings ? null : chooseGate(level);
  const open = openings ?? (gate ? [gate] : []);
  const isGate = (r, c) => open.some((g) => g.r === r && g.c === c);
  const plan = { gate, components: innerComponents(level, inner), finials: [], capPerches: [] };

  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const x = cellX(c);
      const z = cellZ(r);
      if (level.inside[r][c]) {
        parts[(r + c) % 2 ? 'floorB' : 'floorA'].push(translated(KIT.floorTile, x, -0.03, z));
      }
      if (level.wall[r][c] && !inner[r][c] && !isGate(r, c)) {
        parts.wall.push(translated(KIT.wallBody, x, 0.17, z));
        parts.cap.push(translated(KIT.wallCap, x, 0.44, z));
        if ((r * 7 + c * 3) % 5 === 0) plan.capPerches.push({ x, z });
      }
    }
  }

  // Finials on outward corners and wall ends: a small dome, like temple railings.
  const isWall = (r, c) => r >= 0 && c >= 0 && r < level.rows && c < level.cols && level.wall[r][c] && !inner[r][c];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (!isWall(r, c) || isGate(r, c)) continue;
      const n = [isWall(r - 1, c), isWall(r, c + 1), isWall(r + 1, c), isWall(r, c - 1)];
      const count = n.filter(Boolean).length;
      const corner = count === 2 && !(n[0] && n[2]) && !(n[1] && n[3]);
      if (corner || count <= 1) {
        parts.cap.push(translated(KIT.finialBase, cellX(c), 0.54, cellZ(r)));
        parts.cap.push(translated(KIT.finialBall, cellX(c), 0.66, cellZ(r)));
        plan.finials.push({ x: cellX(c), z: cellZ(r) });
      }
    }
  }

  // The plinth: terraces stepping inward as they sink into the mist.
  let tier = footprint;
  const tiers = [[-0.06, -0.95], [-0.95, -2.2], [-2.2, -5.5]];
  tiers.forEach(([top, bottom], i) => {
    if (i > 0) tier = erode(tier);
    if (!tier.some((row) => row.some(Boolean))) tier = centerCore(level);
    const h = top - bottom;
    const col = new THREE.BoxGeometry(1, h, 1);
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (tier[r][c]) parts.stone.push(translated(col, cellX(c), bottom + h / 2, cellZ(r)));
      }
    }
    col.dispose();
    // A thin lip at the top of the first tier gives the island a carved edge.
    if (i === 0) {
      const lip = new THREE.BoxGeometry(1.06, 0.07, 1.06);
      for (let r = 0; r < level.rows; r++) {
        for (let c = 0; c < level.cols; c++) {
          if (tier[r][c] && edgeCell(tier, r, c)) parts.cap.push(translated(lip, cellX(c), -0.3, cellZ(r)));
        }
      }
      lip.dispose();
    }
  });

  // One merged mesh, one draw call, per material role.
  for (const [key, geos] of Object.entries(parts)) {
    if (!geos.length) continue;
    const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
    merged.computeVertexNormals();
    geos.forEach((g) => g.dispose());
    group.add(new THREE.Mesh(merged, pastel(null, { roleColor: roles[key] })));
  }

  return { group, plan };
}
