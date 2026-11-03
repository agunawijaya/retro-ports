import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLevel, DIRS } from '../src/core/level.js';
import {
  precomputeDistancesAndDeadCells,
  createFreezeChecker,
} from '../src/core/solver/deadlocks.js';
import { createLowerBound } from '../src/core/solver/solver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 2,000 pulled states per room, as the brief asks. Do not cut this to make the
// file faster: report the duration instead (see the bottom of this file).
const STATES_PER_ROOM = 2000;

/**
 * Same generator ARCHITECTURE.md §6 and solver.js use for Zobrist hashing.
 * Reused here only to pick a legal pull uniformly; no cryptographic
 * properties are needed, just a deterministic, reproducible sequence.
 */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/** True when (r, c) is a playable floor cell (inside the room, not a wall). */
function isFloor(level, r, c) {
  const { rows, cols, wall, inside } = level;
  return r >= 0 && c >= 0 && r < rows && c < cols && inside[r]?.[c] && !wall[r]?.[c];
}

/**
 * Flood-fills the cells reachable from `from` without crossing a wall, going
 * outside the room, or stepping on an occupied cell. Mirrors the wording in
 * the brief: "the cells the wanderer can reach (not wall, not outside, not
 * occupied)".
 */
function reachableFrom(level, occupied, from) {
  const { rows, cols } = level;
  const reach = new Uint8Array(rows * cols);
  const stack = [from];
  reach[from] = 1;
  while (stack.length > 0) {
    const cur = stack.pop();
    const r = Math.floor(cur / cols);
    const c = cur % cols;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (!isFloor(level, nr, nc)) continue;
      const ni = nr * cols + nc;
      if (reach[ni] || occupied[ni]) continue;
      reach[ni] = 1;
      stack.push(ni);
    }
  }
  return reach;
}

/**
 * The solved-position generator's starting state: every object on a target,
 * the wanderer on the first inside, non-wall, unoccupied cell in reading
 * order (row by row, left to right).
 */
function solvedState(level) {
  const { rows, cols, targets } = level;
  const objects = Int32Array.from(targets.map((t) => t.r * cols + t.c)).sort((a, b) => a - b);
  const occupiedSet = new Set(objects);
  let wanderer = -1;
  for (let r = 0; r < rows && wanderer === -1; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (isFloor(level, r, c) && !occupiedSet.has(idx)) {
        wanderer = idx;
        break;
      }
    }
  }
  return { objects, wanderer };
}

/**
 * One legal pull, per the brief: a pull of the object at `b` in direction `d`
 * is legal when `p = b + d` is reachable and free and `s = p + d` is floor
 * and free; the object moves to `p`, the wanderer to `s`. Returns the next
 * state, or `null` when no object has a legal pull from here.
 */
function tryPull(level, state, rng) {
  const { cols } = level;
  const occupied = new Uint8Array(level.rows * cols);
  for (const idx of state.objects) occupied[idx] = 1;
  const reach = reachableFrom(level, occupied, state.wanderer);

  const legal = [];
  for (let oi = 0; oi < state.objects.length; oi++) {
    const b = state.objects[oi];
    const br = Math.floor(b / cols);
    const bc = b % cols;
    for (const [dr, dc] of DIRS) {
      const pr = br + dr;
      const pc = bc + dc;
      if (!isFloor(level, pr, pc)) continue;
      const p = pr * cols + pc;
      if (!reach[p] || occupied[p]) continue;
      const sr = pr + dr;
      const sc = pc + dc;
      if (!isFloor(level, sr, sc)) continue;
      const s = sr * cols + sc;
      if (occupied[s]) continue;
      legal.push({ oi, p, s });
    }
  }
  if (legal.length === 0) return null;

  const pick = legal[rng() % legal.length];
  const nextObjects = Int32Array.from(state.objects);
  nextObjects[pick.oi] = pick.p;
  nextObjects.sort((a, b) => a - b);
  return { objects: nextObjects, wanderer: pick.s };
}

/**
 * Walks `count` pulled states from the solved position. Restarts from the
 * solved position whenever no legal pull exists, as the brief says, and
 * counts the resulting state (the solved position itself is solvable too,
 * so it belongs in the sample).
 */
function generateStates(level, seed, count) {
  const rng = mulberry32(seed);
  let state = solvedState(level);
  const states = [];
  for (let i = 0; i < count; i++) {
    const next = tryPull(level, state, rng);
    state = next ?? solvedState(level);
    states.push(state);
  }
  return states;
}

/** Renders a state as XSB-style rows for a failure message. */
function stateToRows(level, objects, wanderer) {
  const { rows, cols, wall, inside, targets } = level;
  const objectSet = new Set(objects);
  const targetSet = new Set(targets.map((t) => t.r * cols + t.c));
  const lines = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (!inside[r]?.[c] && !wall[r]?.[c]) {
        line += ' ';
        continue;
      }
      if (wall[r]?.[c]) {
        line += '#';
        continue;
      }
      const onTarget = targetSet.has(idx);
      const hasObject = objectSet.has(idx);
      const hasWanderer = idx === wanderer;
      if (hasWanderer) line += onTarget ? '+' : '@';
      else if (hasObject) line += onTarget ? '*' : '$';
      else if (onTarget) line += '.';
      else line += ' ';
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Runs the three dead-state checks on every generated state. Throws with the
 * room, the rule, and the state as rows on the first state any rule calls
 * dead, exactly as the brief asks ("so the case can be turned into a unit
 * test").
 */
function checkSoundness(level, roomLabel, seed) {
  const { distances, isDeadCell } = precomputeDistancesAndDeadCells(level);
  const isFreezeDeadlockAt = createFreezeChecker(level, isDeadCell);
  const lowerBound = createLowerBound(level, distances);
  const { cols, rows } = level;

  const states = generateStates(level, seed, STATES_PER_ROOM);

  for (const state of states) {
    for (const idx of state.objects) {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      if (isDeadCell[r][c]) {
        fail(level, roomLabel, 'dead cell (precomputeDistancesAndDeadCells)', state);
      }
    }

    const occupied = new Uint8Array(rows * cols);
    for (const idx of state.objects) occupied[idx] = 1;
    for (const idx of state.objects) {
      if (isFreezeDeadlockAt(occupied, idx)) {
        fail(level, roomLabel, 'freeze (createFreezeChecker)', state);
      }
    }

    if (lowerBound(state.objects) >= 100000) {
      fail(level, roomLabel, 'lower bound >= 100000 (createLowerBound)', state);
    }
  }
}

function fail(level, roomLabel, rule, state) {
  const rows = stateToRows(level, state.objects, state.wanderer);
  throw new Error(
    `${roomLabel}: rule "${rule}" called a pulled (solvable) state dead.\n${rows.join('\n')}`
  );
}

describe('soundness: a state reached by pulling from the solved position is never dead', () => {
  const roomsPath = path.resolve(__dirname, '../src/data/rooms.generated.json');
  const roomsAvailable = fs.existsSync(roomsPath);
  const originalRooms = roomsAvailable
    ? JSON.parse(fs.readFileSync(roomsPath, 'utf8')).rooms
    : [];

  describe.skipIf(!roomsAvailable)('the 50 original rooms', () => {
    for (const room of originalRooms) {
      it(`room ${room.number}`, () => {
        const level = parseLevel(room.rows);
        checkSoundness(level, `room ${room.number}`, 1000 + room.number);
      });
    }
  });

  describe('rooms written for this test (never from the original game)', () => {
    it('objects in a row along a wall, some on targets', () => {
      const level = parseLevel([
        '###########',
        '#@       .#',
        '#        .#',
        '#  $*$*   #',
        '###########',
      ]);
      expect(level.objects.length).toBe(4);
      expect(level.targets.length).toBe(4);
      checkSoundness(level, 'row-along-wall', 7001);
    });

    it('a 2x2 block of objects, all on targets', () => {
      const level = parseLevel([
        '#######',
        '#@    #',
        '#  ** #',
        '#  ** #',
        '#######',
      ]);
      expect(level.objects.length).toBe(4);
      expect(level.targets.length).toBe(4);
      checkSoundness(level, '2x2-block', 7002);
    });

    it('dead cells along a wall and a one-wide corridor', () => {
      const level = parseLevel([
        '#############',
        '#   #########',
        '#@ .$    $ .#',
        '#   #########',
        '#############',
      ]);
      expect(level.objects.length).toBe(2);
      expect(level.targets.length).toBe(2);
      checkSoundness(level, 'dead-cells-and-corridor', 7003);
    });
  });
});
