/**
 * @file The solver: weighted A* over pushes (ARCHITECTURE §6).
 *
 * A node is the set of object cells plus the wanderer's region, named by the
 * smallest cell the wanderer can reach. The search is built for speed, because
 * the 50 rooms need millions of nodes:
 *
 * - the board is compiled to a compact list of floor cells with neighbour
 *   tables, so nothing divides or allocates inside the loop;
 * - nodes live in typed arrays (no object per node), and the open list is a
 *   bucket per f value, last in first out, so ties go to the deepest node;
 * - the Zobrist hash is updated incrementally: one push moves one object;
 * - the lower bound (minimum-cost matching of objects to targets on push
 *   distances, Hungarian) is solved once per expanded node, and each child
 *   only re-solves the one row whose object moved (O(n²) instead of O(n³));
 * - pruning: dead cells, freeze deadlocks (both proven sound by
 *   tests/soundness.test.js), and PI-corrals (see `piCorral`).
 */

import { findPath } from '../path.js';
import { replayLurd } from '../replay.js';
import { minWeightBipartiteMatching } from './matching.js';
import { precomputeDistancesAndDeadCells, createFreezeChecker } from './deadlocks.js';

/** A cost no real matching reaches: an object that cannot get to any free target. */
const BIG = 100000;
/** Directions in core/level.js order; the opposite of d is d ^ 1. */
const DIR_CHARS = ['u', 'd', 'l', 'r'];
const PUSH_CHARS = ['U', 'D', 'L', 'R'];
const DIR_NAMES = ['up', 'down', 'left', 'right'];

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/**
 * The search's lower bound: the cheapest way to give every object its own
 * target, counting each pair by its push distance on the empty board. 100000 or
 * more means some object cannot reach any target it could be matched to, so
 * the position is dead. Exported so the soundness test checks exactly the
 * bound the search uses (the search computes the same matching incrementally).
 *
 * @param {object} level Parsed level
 * @param {Array<Array<Int32Array>>} distances From precomputeDistancesAndDeadCells
 * @returns {(objectCells: Int32Array) => number}
 */
export function createLowerBound(level, distances) {
  const { cols, targets } = level;
  const numObjects = level.objects.length;
  const targetMask = new Uint8Array(level.rows * cols);
  for (const t of targets) targetMask[t.r * cols + t.c] = 1;
  const costMatrix = Array.from({ length: numObjects }, () => new Float64Array(targets.length));

  return function lowerBound(objectCells) {
    let allOnTargets = true;
    for (let i = 0; i < numObjects; i++) {
      const idx = objectCells[i];
      if (!targetMask[idx]) allOnTargets = false;
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      for (let t = 0; t < targets.length; t++) {
        const d = distances[t][r][c];
        costMatrix[i][t] = d === -1 ? BIG : d;
      }
    }
    if (allOnTargets) return 0;
    return minWeightBipartiteMatching(costMatrix);
  };
}

// --- the board, compiled ---------------------------------------------------------------

/**
 * Floor cells in reading order with their four neighbours, targets, dead
 * cells and push distances, all indexed by compact cell number.
 */
function compile(level) {
  const { rows, cols, wall, inside, targets } = level;
  const id = new Int32Array(rows * cols).fill(-1);
  const full = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (inside[r]?.[c] && !wall[r]?.[c]) {
        id[r * cols + c] = full.length;
        full.push(r * cols + c);
      }
    }
  }
  const n = full.length;
  const nbr = new Int16Array(n * 4).fill(-1);
  for (let k = 0; k < n; k++) {
    const f = full[k];
    const r = (f / cols) | 0;
    const c = f - r * cols;
    if (r > 0) nbr[k * 4] = id[f - cols];
    if (r < rows - 1) nbr[k * 4 + 1] = id[f + cols];
    if (c > 0) nbr[k * 4 + 2] = id[f - 1];
    if (c < cols - 1) nbr[k * 4 + 3] = id[f + 1];
  }

  const { distances, isDeadCell } = precomputeDistancesAndDeadCells(level);
  const T = targets.length;
  const dist = new Int32Array(n * T);
  const dead = new Uint8Array(n);
  const isTarget = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const r = (full[k] / cols) | 0;
    const c = full[k] - r * cols;
    dead[k] = isDeadCell[r][c] ? 1 : 0;
    for (let t = 0; t < T; t++) {
      const d = distances[t][r][c];
      dist[k * T + t] = d === -1 ? BIG : d;
    }
  }
  for (const t of targets) isTarget[id[t.r * cols + t.c]] = 1;
  return { n, id, full, nbr, dist, dead, isTarget, T, isDeadCell };
}

// --- goal rooms ---------------------------------------------------------------------------

/**
 * Goal rooms: a region holding two or more targets, no object and not the
 * start, joined to the rest of the room by a single entrance cell. For each
 * one, a filling order found backwards: from the full room, pull out any
 * object that can still reach the entrance; the reverse of that order fills
 * the room without ever walling a target in. Rooms whose objects cannot all
 * be pulled out get no order (and no macro).
 *
 * @returns {{ inside: Uint8Array, entrance: number, order: number[] }[]}
 */
function findGoalRooms(board, startCell, boxCells) {
  const { n, nbr, isTarget } = board;
  const rooms = [];
  const comp = new Int32Array(n);
  const isBox = new Uint8Array(n);
  for (const k of boxCells) isBox[k] = 1;
  for (let e = 0; e < n; e++) {
    if (isTarget[e]) continue;
    // Components of the floor without e.
    comp.fill(-1);
    let label = 0;
    const regions = [];
    for (let s = 0; s < n; s++) {
      if (s === e || comp[s] >= 0) continue;
      const cells = [s];
      comp[s] = label;
      for (let h = 0; h < cells.length; h++) {
        for (let d = 0; d < 4; d++) {
          const m = nbr[cells[h] * 4 + d];
          if (m >= 0 && m !== e && comp[m] < 0) {
            comp[m] = label;
            cells.push(m);
          }
        }
      }
      regions.push(cells);
      label++;
    }
    if (regions.length < 2) continue;
    for (const cells of regions) {
      const targets = cells.filter((k) => isTarget[k]);
      if (targets.length < 2 || cells.some((k) => isBox[k])) continue;
      const inside = new Uint8Array(n);
      for (const k of cells) inside[k] = 1;
      const order = packingOrder(board, inside, e, targets);
      if (order) rooms.push({ inside, entrance: e, order });
    }
  }
  // Prefer the smallest region for each set of targets: a corridor leading
  // in is several entrances deep, and the innermost one is the useful one.
  rooms.sort((a, b) => count(a.inside) - count(b.inside));
  const kept = [];
  const claimed = new Uint8Array(n);
  for (const r of rooms) {
    if (r.order.some((t) => claimed[t])) continue;
    for (const t of r.order) claimed[t] = 1;
    kept.push(r);
  }
  return kept;
}

const count = (mask) => mask.reduce((s, v) => s + v, 0);

/** Filling order for one goal room, or null. */
function packingOrder(board, inside, entrance, targets) {
  const { n, nbr } = board;
  const filled = new Set(targets);
  const removed = [];
  while (filled.size) {
    let found = -1;
    for (const t of filled) {
      if (canPullOut(t)) {
        found = t;
        break;
      }
    }
    if (found < 0) return null;
    filled.delete(found);
    removed.push(found);
  }
  return removed.reverse();

  // Can the object on `t` be pulled out to the entrance, the others staying
  // put? The wanderer comes in through the entrance and may stand outside it.
  function canPullOut(t) {
    const manFree = (k) => k >= 0 && !(k !== t && filled.has(k));
    const boxFree = (k) => k >= 0 && (k === entrance || inside[k]) && !(k !== t && filled.has(k));
    const flood = (from, box) => {
      const region = new Set([from]);
      const walk = [from];
      while (walk.length) {
        const k = walk.pop();
        for (let d = 0; d < 4; d++) {
          const m = nbr[k * 4 + d];
          if (manFree(m) && m !== box && !region.has(m)) {
            region.add(m);
            walk.push(m);
          }
        }
      }
      return region;
    };
    const minOf = (set) => {
      let m = Infinity;
      for (const k of set) if (k < m) m = k;
      return m;
    };
    const seenState = new Set();
    const queue = [[t, flood(entrance, t)]];
    while (queue.length) {
      const [box, region] = queue.pop();
      if (box === entrance) return true;
      for (let d = 0; d < 4; d++) {
        const p = nbr[box * 4 + d]; // the wanderer stands here and pulls the object onto it
        if (p < 0 || !region.has(p) || !boxFree(p)) continue;
        const q = nbr[p * 4 + d]; // stepping back to here
        if (!manFree(q) || q === box) continue;
        const next = flood(q, p);
        const key = p * n + minOf(next);
        if (seenState.has(key)) continue;
        seenState.add(key);
        queue.push([p, next]);
      }
    }
    return false;
  }
}

// --- storage ---------------------------------------------------------------------------

/** Every node ever generated, in typed arrays that grow by doubling. */
class NodeStore {
  constructor(boxes) {
    this.B = boxes;
    this.count = 0;
    this.alloc(1 << 16);
  }

  alloc(cap) {
    const old = this.cap ? this : null;
    const grow = (Type, stride, src) => {
      const a = new Type(cap * stride);
      if (src) a.set(src.subarray(0, this.count * stride));
      return a;
    };
    this.boxes = grow(Uint8Array, this.B, old?.boxes);
    this.parent = grow(Int32Array, 1, old?.parent);
    this.g = grow(Uint16Array, 1, old?.g);
    this.h = grow(Uint16Array, 1, old?.h);
    this.player = grow(Uint8Array, 1, old?.player);
    this.dir = grow(Uint8Array, 1, old?.dir);
    this.norm = grow(Uint8Array, 1, old?.norm);
    this.bh1 = grow(Uint32Array, 1, old?.bh1);
    this.bh2 = grow(Uint32Array, 1, old?.bh2);
    this.cap = cap;
  }

  add() {
    if (this.count === this.cap) this.alloc(this.cap * 2);
    return this.count++;
  }
}

/** Key (two 32-bit halves) → node index, open addressing. */
class Table {
  constructor() {
    this.alloc(1 << 20);
  }

  alloc(cap) {
    const old = this.k1 ? { k1: this.k1, k2: this.k2, v: this.v, cap: this.cap } : null;
    this.cap = cap;
    this.mask = cap - 1;
    this.k1 = new Uint32Array(cap);
    this.k2 = new Uint32Array(cap);
    this.v = new Int32Array(cap).fill(-1);
    this.size = 0;
    if (old) for (let i = 0; i < old.cap; i++) if (old.v[i] >= 0) this.set(old.k1[i], old.k2[i], old.v[i]);
  }

  slot(a, b) {
    let i = (a ^ Math.imul(b, 0x9e3779b1)) & this.mask;
    while (this.v[i] >= 0 && (this.k1[i] !== a || this.k2[i] !== b)) i = (i + 1) & this.mask;
    return i;
  }

  get(a, b) {
    return this.v[this.slot(a, b)];
  }

  set(a, b, node) {
    if (this.size * 10 >= this.cap * 6) this.alloc(this.cap * 2);
    const i = this.slot(a, b);
    if (this.v[i] < 0) this.size++;
    this.k1[i] = a;
    this.k2[i] = b;
    this.v[i] = node;
  }
}

/** Open list: one stack of nodes per f value; the lowest f pops first, newest first. */
class Buckets {
  constructor() {
    this.stacks = [];
    this.lens = [];
    this.min = Infinity;
    this.size = 0;
  }

  push(f, node) {
    let s = this.stacks[f];
    if (!s) {
      s = this.stacks[f] = new Int32Array(1024);
      this.lens[f] = 0;
    } else if (this.lens[f] === s.length) {
      const bigger = new Int32Array(s.length * 2);
      bigger.set(s);
      s = this.stacks[f] = bigger;
    }
    s[this.lens[f]++] = node;
    if (f < this.min) this.min = f;
    this.size++;
  }

  pop() {
    if (this.size === 0) return -1;
    while (!this.lens[this.min]) this.min++;
    this.size--;
    return this.stacks[this.min][--this.lens[this.min]];
  }
}

// --- the search -------------------------------------------------------------------------

/**
 * Solves a room with weighted A* over pushes.
 *
 * @param {object} level Parsed level object
 * @param {object} [options]
 * @param {number} [options.weight=1] w in f = g + w·h
 * @param {number} [options.maxNodes=6000000] expanded-node cap
 * @param {number} [options.maxTimeMs=120000] time cap
 * @param {(p: {nodes:number, pushes:number, f:number, ms:number}) => void} [options.onProgress]
 * @returns {{ solved: boolean, failed: boolean, reason: string, lurd?: string, steps?: number,
 *   pushes?: number, weight?: number, nodes: number, ms: number }}
 */
export function solve(level, options = {}) {
  const weight = options.weight ?? 1;
  const maxNodes = options.maxNodes ?? 6_000_000;
  const maxTimeMs = options.maxTimeMs ?? 120_000;
  const onProgress = options.onProgress ?? null;
  const started = Date.now();
  const fail = (reason, nodes = 0) => ({ solved: false, failed: true, reason, nodes, ms: Date.now() - started });

  const B = level.objects.length;
  if (B === 0 || B !== level.targets.length) return fail('bad_room');
  const board = compile(level);
  const { n, nbr, dist, dead, T, full } = board;
  for (const o of level.objects) if (dead[board.id[o.r * level.cols + o.c]]) return fail('object_on_dead_cell');

  const isFrozen = createFreezeChecker(level, board.isDeadCell);
  const rng = mulberry32(1984);
  const zb1 = new Uint32Array(n);
  const zb2 = new Uint32Array(n);
  const zp1 = new Uint32Array(n);
  const zp2 = new Uint32Array(n);
  for (let k = 0; k < n; k++) {
    zb1[k] = rng();
    zb2[k] = rng();
    zp1[k] = rng();
    zp2[k] = rng();
  }

  // Scratch, reused by every expansion.
  const occ = new Uint8Array(n);
  const occFull = new Uint8Array(level.rows * level.cols);
  const boxAt = new Int16Array(n).fill(-1);
  const mark = new Int32Array(n);
  const mark2 = new Int32Array(n);
  const mark3 = new Int32Array(n);
  let stamp = 0;
  let stamp2 = 0;
  let stamp3 = 0;
  const queue = new Int16Array(n);
  const cells = new Uint8Array(B);

  /** Flood the wanderer's region from `from` into `marks`; returns its smallest cell. */
  function flood(from, marks, s) {
    let head = 0;
    let tail = 0;
    queue[tail++] = from;
    marks[from] = s;
    let min = from;
    while (head < tail) {
      const k = queue[head++];
      if (k < min) min = k;
      const base = k * 4;
      for (let d = 0; d < 4; d++) {
        const m = nbr[base + d];
        if (m >= 0 && marks[m] !== s && !occ[m]) {
          marks[m] = s;
          queue[tail++] = m;
        }
      }
    }
    return min;
  }

  // Hungarian (Kuhn–Munkres, potentials, 1-indexed) on rows = objects, columns = targets.
  const U = new Float64Array(B + 1);
  const V = new Float64Array(B + 1);
  const P = new Int32Array(B + 1);
  const u2 = new Float64Array(B + 1);
  const v2 = new Float64Array(B + 1);
  const p2 = new Int32Array(B + 1);
  const way = new Int32Array(B + 1);
  const minv = new Float64Array(B + 1);
  const used = new Uint8Array(B + 1);
  const rowCell = new Int32Array(B + 1);

  /** Adds row i to the assignment held in (u, v, p), with the row's object at rowCell[i]. */
  function augment(i, u, v, p) {
    p[0] = i;
    let j0 = 0;
    minv.fill(Infinity);
    used.fill(0);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      const base = rowCell[i0] * T - 1;
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= B; j++) {
        if (used[j]) continue;
        const cur = dist[base + j] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= B; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  function matchingCost(p) {
    let sum = 0;
    for (let j = 1; j <= B; j++) sum += dist[rowCell[p[j]] * T + j - 1];
    return sum;
  }

  /** Full matching for the objects in `cells` (into U, V, P). */
  function solveMatching() {
    U.fill(0);
    V.fill(0);
    P.fill(0);
    for (let i = 1; i <= B; i++) rowCell[i] = cells[i - 1];
    for (let i = 1; i <= B; i++) augment(i, U, V, P);
    return matchingCost(P);
  }

  /** The matching after object `i` (0-based) moves to `to`, from the parent's U, V, P. */
  function rematch(i, to) {
    u2.set(U);
    v2.set(V);
    p2.set(P);
    const row = i + 1;
    rowCell[row] = to;
    for (let j = 1; j <= B; j++) {
      if (p2[j] === row) {
        p2[j] = 0;
        break;
      }
    }
    // Keep the row's potential feasible for its new costs, then re-insert it.
    let best = Infinity;
    const base = to * T - 1;
    for (let j = 1; j <= B; j++) {
      const r = dist[base + j] - v2[j];
      if (r < best) best = r;
    }
    u2[row] = best;
    augment(row, u2, v2, p2);
    const cost = matchingCost(p2);
    rowCell[row] = cells[i];
    return cost;
  }

  // --- PI-corrals ---------------------------------------------------------------------
  //
  // A corral is a region the wanderer cannot reach, fenced by objects. It is a
  // PI-corral when every push of its fence objects goes into it (I) and the
  // wanderer can make every such push (P). Some object or target inside it is
  // unfinished, so some fence push has to happen before the room is solved —
  // and pushes elsewhere cannot help it, so only its fence pushes need to be
  // tried in this position (Damgaard's PI-corral pruning). This cuts the
  // branching without losing any solution.
  //
  // Why it is safe: before the corral changes, every push in any solution is
  // outside it; the first push that changes it is a fence push into it, which
  // (P) is already possible now. Moving that push to the front keeps every
  // other push legal — it only frees a cell the wanderer could not use and
  // fills one it could not reach — and the rest of the solution is unchanged.
  const corralId = new Int32Array(n);
  let corralStamp = 0;
  const corralCells = new Int16Array(n);
  const fenceList = new Int16Array(B);
  const fenceBest = new Int16Array(B);
  const allowed = new Uint8Array(B);

  // --- corral deadlocks -----------------------------------------------------------------
  //
  // A corral is dead when its own objects, alone on the board (every other
  // object removed, which only adds freedom), can never get one of them out of
  // the corral nor all of them onto targets. A small bounded search decides it;
  // when the bound runs out the corral counts as alive, so this can only miss
  // a deadlock, never invent one. Results are cached by position.
  const CORRAL_NODES = options.corralNodes ?? 800;
  const useCorralDeadlocks = options.corralDeadlocks ?? true;
  const corralCache = new Map();
  const subOcc = new Uint8Array(n);
  const subFull = new Uint8Array(level.rows * level.cols);
  const subMark = new Int32Array(n);
  const subReach = new Uint8Array(n);
  let subStamp = 0;
  const subQueue = new Int16Array(n);

  function subFlood(from) {
    let head = 0;
    let tail = 0;
    subQueue[tail++] = from;
    subMark[from] = ++subStamp;
    let min = from;
    while (head < tail) {
      const k = subQueue[head++];
      if (k < min) min = k;
      for (let d = 0; d < 4; d++) {
        const m = nbr[k * 4 + d];
        if (m >= 0 && subMark[m] !== subStamp && !subOcc[m]) {
          subMark[m] = subStamp;
          subQueue[tail++] = m;
        }
      }
    }
    return min;
  }

  /** Is the corral `region` (its objects in `boxes`) dead, the wanderer at `man`? */
  function corralDead(boxes, region, man) {
    const sorted = boxes.slice().sort((a, b) => a - b);
    for (const k of sorted) subOcc[k] = 1;
    const startNorm = subFlood(man);
    for (const k of sorted) subOcc[k] = 0;
    const cacheKey = sorted.join(',') + '|' + startNorm;
    const cached = corralCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const inCorral = (k) => corralId[k] === region;
    const seenStates = new Set([cacheKey]);
    const stack = [[sorted, man]];
    let explored = 0;
    let isDead = true;
    search: while (stack.length) {
      if (++explored > CORRAL_NODES) {
        isDead = false;
        break;
      }
      const [bx, pm] = stack.pop();
      for (const k of bx) {
        subOcc[k] = 1;
        subFull[full[k]] = 1;
      }
      // The children's floods reuse the marks: keep this state's reach apart.
      subFlood(pm);
      for (let k = 0; k < n; k++) subReach[k] = subMark[k] === subStamp ? 1 : 0;
      for (let b = 0; b < bx.length; b++) {
        const from = bx[b];
        for (let d = 0; d < 4; d++) {
          const to = nbr[from * 4 + d];
          const stance = nbr[from * 4 + (d ^ 1)];
          if (to < 0 || stance < 0 || subOcc[to] || dead[to] || !subReach[stance]) continue;
          if (!inCorral(to)) {
            isDead = false; // an object got out: the corral opens
            break search;
          }
          subOcc[from] = 0;
          subFull[full[from]] = 0;
          subOcc[to] = 1;
          subFull[full[to]] = 1;
          const frozen = isFrozen(subFull, full[to]);
          const nb = bx.slice();
          nb[b] = to;
          let solved = true;
          for (const k of nb) if (!board.isTarget[k]) solved = false;
          const norm = frozen ? -1 : subFlood(from);
          subOcc[to] = 0;
          subFull[full[to]] = 0;
          subOcc[from] = 1;
          subFull[full[from]] = 1;
          if (frozen) continue;
          if (solved) {
            isDead = false;
            break search;
          }
          nb.sort((a, c) => a - c);
          const key = nb.join(',') + '|' + norm;
          if (seenStates.has(key)) continue;
          seenStates.add(key);
          stack.push([nb, from]);
        }
      }
      for (const k of bx) {
        subOcc[k] = 0;
        subFull[full[k]] = 0;
      }
    }
    subOcc.fill(0);
    subFull.fill(0);
    corralCache.set(cacheKey, isDead);
    return isDead;
  }

  /**
   * Marks in `allowed` the fence objects of the PI-corral with the fewest
   * pushes. Returns 'dead' when some corral is a deadlock, true when a
   * PI-corral restricts the pushes, false otherwise.
   */
  function piCorral(reachStamp, man) {
    const callBase = corralStamp;
    let found = false;
    let bestPushes = Infinity;
    let bestFence = 0;
    for (let start = 0; start < n; start++) {
      if (mark[start] === reachStamp || corralId[start] > callBase || occ[start]) continue;
      // One region: the unreachable cells around `start`, flooded through free
      // cells and objects alike (corrals that share fence objects merge).
      const region = ++corralStamp;
      let head = 0;
      let tail = 0;
      corralCells[tail++] = start;
      corralId[start] = region;
      let unfinished = false;
      let fence = 0;
      const regionBoxes = [];
      while (head < tail) {
        const k = corralCells[head++];
        if (occ[k]) regionBoxes.push(k);
        if (occ[k] ? !board.isTarget[k] : board.isTarget[k]) unfinished = true;
        const base = k * 4;
        let touchesReach = false;
        for (let d = 0; d < 4; d++) {
          const m = nbr[base + d];
          if (m < 0) continue;
          if (mark[m] === reachStamp) {
            touchesReach = true;
          } else if (corralId[m] !== region) {
            corralId[m] = region;
            corralCells[tail++] = m;
          }
        }
        if (occ[k] && touchesReach) fenceList[fence++] = boxAt[k];
      }
      if (!unfinished || fence === 0) continue;
      if (useCorralDeadlocks && regionBoxes.length <= 10 && regionBoxes.some((k) => !board.isTarget[k])
          && corralDead(regionBoxes, region, man)) return 'dead';
      // I: every legal push of a fence object from the reach goes into the
      // corral. P: every push of a fence object into the corral can be made now.
      let ok = true;
      let pushes = 0;
      for (let f = 0; f < fence && ok; f++) {
        const k = cells[fenceList[f]];
        for (let d = 0; d < 4 && ok; d++) {
          const to = nbr[k * 4 + d];
          const stance = nbr[k * 4 + (d ^ 1)];
          if (to < 0 || occ[to] || stance < 0) continue;
          const intoCorral = corralId[to] === region;
          const fromReach = mark[stance] === reachStamp;
          if (fromReach && !intoCorral) ok = false;
          else if (!fromReach && intoCorral) ok = false;
          else if (fromReach) pushes++;
        }
      }
      if (ok && pushes < bestPushes) {
        found = true;
        bestPushes = pushes;
        bestFence = fence;
        fenceBest.set(fenceList.subarray(0, fence));
      }
    }
    if (!found) return false;
    allowed.fill(0);
    for (let f = 0; f < bestFence; f++) allowed[fenceBest[f]] = 1;
    return true;
  }

  // --- start ------------------------------------------------------------------------------

  // --- goal-room macros (options.macros) -----------------------------------------------
  //
  // An object pushed onto a goal room's entrance is carried straight on to
  // the room's next target in its filling order; nothing else may push into
  // the room or move what is already in it. This gives up optimality and, in
  // rare rooms, completeness — so the exact w = 1 search runs without it.
  const startCell = board.id[level.start.r * level.cols + level.start.c];
  const goalRooms = options.macros
    ? findGoalRooms(board, startCell, level.objects.map((o) => board.id[o.r * level.cols + o.c]))
    : [];
  const roomOf = new Int8Array(n).fill(-1);
  const entranceOf = new Int8Array(n).fill(-1);
  goalRooms.forEach((room, ri) => {
    for (let k = 0; k < n; k++) if (room.inside[k]) roomOf[k] = ri;
    entranceOf[room.entrance] = ri;
  });
  const roomFill = new Int32Array(goalRooms.length);
  /** node → the pushes a macro child stands for, in order: [{ from, d }]. */
  const macroPushes = new Map();

  /**
   * The pushes that carry the object on `box` (wanderer at `man`) to `goal`
   * inside goal room `ri`, other objects fixed; null if there is no way.
   */
  function pushPath(box, man, goal, ri) {
    const keyOf = (b, region) => b * n + region;
    // Its own marks: the region of a state must survive the floods of its children.
    const regionOf = (b, m) => {
      occ[b] = 1;
      const min = flood(m, mark3, ++stamp3);
      occ[b] = 0;
      return min;
    };
    const states = [{ box, man, prev: -1, from: -1, d: -1 }];
    const seenKeys = new Set([keyOf(box, regionOf(box, man))]);
    for (let s = 0; s < states.length; s++) {
      const st = states[s];
      if (st.box === goal) {
        const list = [];
        for (let k = s; states[k].prev >= 0; k = states[k].prev) list.push({ from: states[k].from, d: states[k].d });
        return list.reverse();
      }
      occ[st.box] = 1;
      flood(st.man, mark2, ++stamp2);
      const here = stamp2;
      occ[st.box] = 0;
      for (let d = 0; d < 4; d++) {
        const to = nbr[st.box * 4 + d];
        const stance = nbr[st.box * 4 + (d ^ 1)];
        if (to < 0 || stance < 0 || occ[to] || roomOf[to] !== ri || mark2[stance] !== here) continue;
        const key = keyOf(to, regionOf(to, st.box));
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        states.push({ box: to, man: st.box, prev: s, from: st.box, d });
      }
    }
    return null;
  }

  const store = new NodeStore(B);
  const table = new Table();
  const open = new Buckets();

  const root = store.add();
  let h1 = 0;
  let h2 = 0;
  level.objects.forEach((o, i) => {
    const k = board.id[o.r * level.cols + o.c];
    store.boxes[root * B + i] = k;
    cells[i] = k;
    occ[k] = 1;
    h1 ^= zb1[k];
    h2 ^= zb2[k];
  });
  const rootNorm = flood(startCell, mark, ++stamp);
  for (let i = 0; i < B; i++) occ[cells[i]] = 0;
  store.parent[root] = -1;
  store.g[root] = 0;
  store.h[root] = solveMatching();
  store.player[root] = startCell;
  store.norm[root] = rootNorm;
  store.bh1[root] = h1 >>> 0;
  store.bh2[root] = h2 >>> 0;
  if (store.h[root] >= BIG) return fail('exhausted');
  table.set((h1 ^ zp1[rootNorm]) >>> 0, (h2 ^ zp2[rootNorm]) >>> 0, root);
  open.push(weight * store.h[root], root);

  function addChild(parent, i, to, g, h, player, dir, norm, c1, c2) {
    const child = store.add();
    const cb = child * B;
    for (let j = 0; j < B; j++) store.boxes[cb + j] = cells[j];
    store.boxes[cb + i] = to;
    store.parent[child] = parent;
    store.g[child] = g;
    store.h[child] = h;
    store.player[child] = player;
    store.dir[child] = dir;
    store.norm[child] = norm;
    store.bh1[child] = c1;
    store.bh2[child] = c2;
    table.set((c1 ^ zp1[norm]) >>> 0, (c2 ^ zp2[norm]) >>> 0, child);
    open.push(g + weight * h, child);
    return child;
  }

  /**
   * Object i pushed from `from` onto a goal room's entrance `to`: carry it on
   * to the room's next target. True when handled (a child made, or the same
   * position already known for less); false when there is no way in, so the
   * plain push stands.
   */
  function macroChild(node, i, from, to, d) {
    const ri = entranceOf[to];
    const room = goalRooms[ri];
    const k = roomFill[ri];
    if (k >= room.order.length) return false;
    const goal = room.order[k];
    occ[from] = 0;
    const path = pushPath(to, from, goal, ri);
    occ[from] = 1;
    if (!path || !path.length) return false;
    const last = path[path.length - 1];
    const g = store.g[node] + 1 + path.length;
    occ[from] = 0;
    occ[goal] = 1;
    const norm = flood(last.from, mark2, ++stamp2);
    occ[goal] = 0;
    occ[from] = 1;
    const c1 = (store.bh1[node] ^ zb1[from] ^ zb1[goal]) >>> 0;
    const c2 = (store.bh2[node] ^ zb2[from] ^ zb2[goal]) >>> 0;
    const existing = table.get((c1 ^ zp1[norm]) >>> 0, (c2 ^ zp2[norm]) >>> 0);
    if (existing >= 0 && store.g[existing] <= g) return true;
    const h = rematch(i, goal);
    if (h >= BIG) return true;
    const child = addChild(node, i, goal, g, h, last.from, last.d, norm, c1, c2);
    macroPushes.set(child, [{ from, d }, ...path]);
    return true;
  }

  let expanded = 0;
  let lastTick = started;
  const usePi = options.piCorrals ?? true;

  while (true) {
    const node = open.pop();
    if (node < 0) return fail('exhausted', expanded);
    const nb1 = store.bh1[node];
    const nb2 = store.bh2[node];
    const nn = store.norm[node];
    // A better path to the same position superseded this entry.
    if (table.get((nb1 ^ zp1[nn]) >>> 0, (nb2 ^ zp2[nn]) >>> 0) !== node) continue;

    expanded++;
    if (store.h[node] === 0) {
      const { lurd, steps, pushes } = reconstruct(level, board, store, node, macroPushes);
      return { solved: true, failed: false, reason: 'solved', lurd, steps, pushes, weight, nodes: expanded, ms: Date.now() - started };
    }
    if (expanded >= maxNodes) return fail('nodes', expanded);
    if ((expanded & 1023) === 0) {
      const now = Date.now();
      if (now - started >= maxTimeMs) return fail('time', expanded);
      if (onProgress && now - lastTick >= 250) {
        lastTick = now;
        onProgress({ nodes: expanded, pushes: store.g[node], f: store.g[node] + weight * store.h[node], ms: now - started });
      }
    }

    // Load the position.
    const base = node * B;
    roomFill.fill(0);
    for (let i = 0; i < B; i++) {
      const k = store.boxes[base + i];
      cells[i] = k;
      occ[k] = 1;
      occFull[full[k]] = 1;
      boxAt[k] = i;
      if (roomOf[k] >= 0) roomFill[roomOf[k]]++;
    }
    const reach = ++stamp;
    flood(store.player[node], mark, reach);
    solveMatching();
    const pruned = usePi && piCorral(reach, store.player[node]);
    const g = store.g[node] + 1;

    for (let i = 0; i < B && pruned !== 'dead'; i++) {
      if (pruned && !allowed[i]) continue;
      const from = cells[i];
      for (let d = 0; d < 4; d++) {
        const to = nbr[from * 4 + d];
        if (to < 0 || occ[to] || dead[to]) continue;
        const stance = nbr[from * 4 + (d ^ 1)];
        if (stance < 0 || mark[stance] !== reach) continue;

        if (goalRooms.length) {
          // Only the macro fills a goal room, and what it placed stays.
          if (roomOf[from] >= 0 || roomOf[to] >= 0) continue;
          if (entranceOf[to] >= 0 && macroChild(node, i, from, to, d)) continue;
        }

        occ[from] = 0;
        occ[to] = 1;
        occFull[full[from]] = 0;
        occFull[full[to]] = 1;
        let skip = isFrozen(occFull, full[to]);
        let norm = 0;
        let c1 = 0;
        let c2 = 0;
        let existing = -1;
        if (!skip) {
          norm = flood(from, mark2, ++stamp2);
          c1 = (store.bh1[node] ^ zb1[from] ^ zb1[to]) >>> 0;
          c2 = (store.bh2[node] ^ zb2[from] ^ zb2[to]) >>> 0;
          existing = table.get((c1 ^ zp1[norm]) >>> 0, (c2 ^ zp2[norm]) >>> 0);
          if (existing >= 0 && store.g[existing] <= g) skip = true;
        }
        occ[to] = 0;
        occ[from] = 1;
        occFull[full[to]] = 0;
        occFull[full[from]] = 1;
        if (skip) continue;

        const h = rematch(i, to);
        if (h >= BIG) continue;
        addChild(node, i, to, g, h, from, d, norm, c1, c2);
      }
    }

    for (let i = 0; i < B; i++) {
      occ[cells[i]] = 0;
      occFull[full[cells[i]]] = 0;
      boxAt[cells[i]] = -1;
    }
  }
}

/**
 * The LURD string for the path to `goal`, replayed push by push from the
 * root: before each push the wanderer walks the shortest free path to its
 * stance (core/path.js). A macro node stands for several pushes.
 */
function reconstruct(level, board, store, goal, macroPushes) {
  const chain = [];
  for (let k = goal; store.parent[k] >= 0; k = store.parent[k]) chain.push(k);
  chain.reverse();
  const { cols } = level;
  const at = (k) => ({ r: (board.full[k] / cols) | 0, c: board.full[k] % cols });
  const objects = [];
  for (let i = 0; i < store.B; i++) objects.push(at(store.boxes[i]));
  let player = at(store.player[0]);
  let lurd = '';
  for (const k of chain) {
    const pushes = macroPushes.get(k) ?? [{ from: store.player[k], d: store.dir[k] }];
    for (const { from, d } of pushes) {
      const stance = at(board.nbr[from * 4 + (d ^ 1)]);
      const walk = findPath({ level, state: { player, objects } }, stance);
      if (!walk) throw new Error('reconstruct: no walk to a push stance');
      for (const name of walk) lurd += DIR_CHARS[DIR_NAMES.indexOf(name)];
      lurd += PUSH_CHARS[d];
      const src = at(from);
      const obj = objects.find((o) => o.r === src.r && o.c === src.c);
      Object.assign(obj, at(board.nbr[from * 4 + d]));
      player = src;
    }
  }
  const check = replayLurd(level, lurd);
  if (!check.ok || !check.solved) throw new Error('reconstruct: the solution does not replay');
  return { lurd, steps: check.steps, pushes: check.pushes };
}
