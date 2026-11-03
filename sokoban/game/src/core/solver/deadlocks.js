/**
 * @file Deadlock detection: dead cells and push distances from reverse pull BFS,
 * goal-room packing depth (used only to order the search), and freeze deadlocks.
 */

import { DIRS } from '../level.js';

/**
 * Precomputes push distances from every cell to every target on the empty board
 * using reverse pull BFS. Also identifies dead cells (cells from which NO target is reachable).
 *
 * @param {object} level Parsed Level
 * @returns {{
 *   distances: Array<Array<Int32Array>>, // [targetIdx][r][c]
 *   isDeadCell: boolean[][],             // [r][c] is true if cell cannot reach any target
 * }}
 */
export function precomputeDistancesAndDeadCells(level) {
  const { rows, cols, wall, inside, targets } = level;

  const isFloor = (r, c) =>
    r >= 0 && c >= 0 && r < rows && c < cols && inside[r]?.[c] && !wall[r]?.[c];

  const distances = Array.from({ length: targets.length }, () =>
    Array.from({ length: rows }, () => new Int32Array(cols).fill(-1))
  );

  targets.forEach((target, tIdx) => {
    const visited = new Set();
    const queue = [];

    // Helper to get reachable player cells given box at (br, bc) and seed (pr, pc)
    function getReachable(br, bc, pr, pc) {
      const reach = new Uint8Array(rows * cols);
      const stack = [pr * cols + pc];
      reach[pr * cols + pc] = 1;
      let norm = pr * cols + pc;

      while (stack.length > 0) {
        const curr = stack.pop();
        if (curr < norm) norm = curr;
        const cr = Math.floor(curr / cols);
        const cc = curr % cols;
        for (const [dr, dc] of DIRS) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (isFloor(nr, nc) && !(nr === br && nc === bc)) {
            const nidx = nr * cols + nc;
            if (!reach[nidx]) {
              reach[nidx] = 1;
              stack.push(nidx);
            }
          }
        }
      }
      return { reach, norm };
    }

    // Initial states: box at target
    for (const [dr, dc] of DIRS) {
      const pr = target.r + dr;
      const pc = target.c + dc;
      if (isFloor(pr, pc)) {
        const { reach, norm } = getReachable(target.r, target.c, pr, pc);
        const key = `${target.r},${target.c},${norm}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ br: target.r, bc: target.c, reach, norm, d: 0 });
        }
      }
    }

    distances[tIdx][target.r][target.c] = 0;

    let head = 0;
    while (head < queue.length) {
      const { br, bc, reach, norm, d } = queue[head++];
      if (distances[tIdx][br][bc] === -1 || d < distances[tIdx][br][bc]) {
        distances[tIdx][br][bc] = d;
      }

      // Check all 4 pull directions
      for (const [dr, dc] of DIRS) {
        const pr = br + dr;
        const pc = bc + dc;
        if (isFloor(pr, pc) && reach[pr * cols + pc]) {
          const npr = pr + dr;
          const npc = pc + dc;
          if (isFloor(npr, npc)) {
            const nbr = pr;
            const nbc = pc;
            const nextReachable = getReachable(nbr, nbc, npr, npc);
            const key = `${nbr},${nbc},${nextReachable.norm}`;
            if (!visited.has(key)) {
              visited.add(key);
              queue.push({
                br: nbr,
                bc: nbc,
                reach: nextReachable.reach,
                norm: nextReachable.norm,
                d: d + 1,
              });
            }
          }
        }
      }
    }
  });

  const isDeadCell = Array.from({ length: rows }, () => Array(cols).fill(false));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isFloor(r, c)) {
        const canReachAny = targets.some((_, tIdx) => distances[tIdx][r][c] !== -1);
        if (!canReachAny) {
          isDeadCell[r][c] = true;
        }
      }
    }
  }

  return { distances, isDeadCell };
}

/**
 * Precomputes goal room packing order: identifies target rooms with a single entrance,
 * establishes dependencies where deeper targets must be filled before entrance targets,
 * and calculates target depth from the entrance.
 *
 * @param {object} level Parsed level
 * @returns {{
 *   dependsOn: Map<number, number[]>, // targetIdx -> array of targetIdx that must be occupied
 *   targetDepth: Int32Array,           // cellIdx -> depth from entrance
 * }}
 */
export function precomputeGoalRoomPacking(level) {
  const { rows, cols, wall, inside, targets, start } = level;
  const totalCells = rows * cols;
  const isFloor = (r, c) =>
    r >= 0 && c >= 0 && r < rows && c < cols && inside[r]?.[c] && !wall[r]?.[c];

  const targetIndices = new Set(targets.map((t) => t.r * cols + t.c));
  const dependsOn = new Map();
  const targetDepth = new Int32Array(totalCells);

  // Find articulation entrances that isolate target rooms
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isFloor(r, c)) continue;
      const entranceIdx = r * cols + c;
      if (entranceIdx === start.r * cols + start.c) continue;

      const visited = new Uint8Array(totalCells);
      visited[entranceIdx] = 1;

      const q = [start.r * cols + start.c];
      visited[start.r * cols + start.c] = 1;
      let head = 0;
      while (head < q.length) {
        const curr = q[head++];
        const cr = Math.floor(curr / cols);
        const cc = curr % cols;
        for (const [dr, dc] of DIRS) {
          const nr = cr + dr;
          const nc = cc + dc;
          const nidx = nr * cols + nc;
          if (isFloor(nr, nc) && !visited[nidx]) {
            visited[nidx] = 1;
            q.push(nidx);
          }
        }
      }

      const unvisitedFloor = [];
      for (let i = 0; i < totalCells; i++) {
        if (isFloor(Math.floor(i / cols), i % cols) && !visited[i]) {
          unvisitedFloor.push(i);
        }
      }

      if (unvisitedFloor.length > 0) {
        const compTargets = unvisitedFloor.filter((i) => targetIndices.has(i));
        if (compTargets.length >= 2) {
          // BFS distances from entrance inside the room
          const distQ = [entranceIdx];
          const distVisited = new Uint8Array(totalCells);
          const distArray = new Int32Array(totalCells).fill(100000);
          distVisited[entranceIdx] = 1;
          distArray[entranceIdx] = 0;
          let dHead = 0;
          while (dHead < distQ.length) {
            const curr = distQ[dHead++];
            const cr = Math.floor(curr / cols);
            const cc = curr % cols;
            for (const [dr, dc] of DIRS) {
              const nr = cr + dr;
              const nc = cc + dc;
              const nidx = nr * cols + nc;
              if (isFloor(nr, nc) && unvisitedFloor.includes(nidx) && !distVisited[nidx]) {
                distVisited[nidx] = 1;
                distArray[nidx] = distArray[curr] + 1;
                distQ.push(nidx);
              }
            }
          }

          for (const t of compTargets) {
            if (distArray[t] < 100000) {
              targetDepth[t] = Math.max(targetDepth[t], distArray[t]);
            }
          }

          // For each pair of targets tA, tB: if blocking tA disconnects tB from entrance,
          // then tB must be filled BEFORE tA
          for (const tA of compTargets) {
            const blockedVisited = new Uint8Array(totalCells);
            blockedVisited[tA] = 1;
            const checkQ = [entranceIdx];
            blockedVisited[entranceIdx] = 1;
            let cHead = 0;
            while (cHead < checkQ.length) {
              const curr = checkQ[cHead++];
              const cr = Math.floor(curr / cols);
              const cc = curr % cols;
              for (const [dr, dc] of DIRS) {
                const nr = cr + dr;
                const nc = cc + dc;
                const nidx = nr * cols + nc;
                if (isFloor(nr, nc) && unvisitedFloor.includes(nidx) && !blockedVisited[nidx]) {
                  blockedVisited[nidx] = 1;
                  checkQ.push(nidx);
                }
              }
            }

            for (const tB of compTargets) {
              if (tA !== tB && !blockedVisited[tB]) {
                if (!dependsOn.has(tA)) {
                  dependsOn.set(tA, []);
                }
                if (!dependsOn.get(tA).includes(tB)) {
                  dependsOn.get(tA).push(tB);
                }
              }
            }
          }
        }
      }
    }
  }

  return { dependsOn, targetDepth };
}

/**
 * Builds the freeze test the solver runs after every push.
 *
 * An object is frozen when it can never move again. Along one axis it is stuck
 * when a wall stands on either side (pushing toward the wall is blocked, and
 * pushing away needs the wanderer to stand inside it), when both sides are dead
 * cells, or when a neighbour on that axis is itself frozen. Stuck on both axes
 * means frozen, and a frozen object off its target can never be solved.
 *
 * While a neighbour is examined, every object already under examination counts
 * as a wall: that is how two objects pin each other, and the 2 × 2 block is the
 * simplest case. A neighbour's verdict is only kept when the object that asked
 * ends up frozen as well, because it was reached on the assumption that the
 * asker could not move.
 *
 * Fix 2 replaced the earlier freeze, chain-freeze and corral rules with this
 * one. Pulling objects back from the solved position (states that are
 * solvable by construction) showed the old freeze rule calling them dead in 14
 * of the 50 rooms and the corral rule in 49.
 *
 * @param {object} level Parsed level
 * @param {boolean[][]} isDeadCell From precomputeDistancesAndDeadCells
 * @returns {(occupied: Uint8Array, cell: number) => boolean}
 *   `occupied[i]` is 1 where an object stands, indexed `r * cols + c`; `cell`
 *   is the object to test (after a push, the one just pushed). True means the
 *   position is dead.
 */
export function createFreezeChecker(level, isDeadCell) {
  const { rows, cols, wall, inside, targets } = level;
  const total = rows * cols;
  const solid = new Uint8Array(total);
  const dead = new Uint8Array(total);
  const onTarget = new Uint8Array(total);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (wall[r]?.[c] || !inside[r]?.[c]) solid[i] = 1;
      else if (isDeadCell[r][c]) dead[i] = 1;
    }
  }
  for (const t of targets) onTarget[t.r * cols + t.c] = 1;

  const asWall = new Uint8Array(total);
  // Dense clusters can revisit the same objects along many paths. Past this
  // many examinations a neighbour is simply treated as movable: that can only
  // miss a deadlock, never invent one.
  const MAX_EXAMINATIONS = 4000;
  let examinations = 0;
  let occupied = null;

  const isWallLike = (i) => i < 0 || i >= total || solid[i] === 1 || asWall[i] === 1;

  // 0 = the object can still move along this axis; 1 = stuck; 2 = stuck, and
  // a frozen object off its target is part of the reason.
  function axisState(a, b) {
    if (isWallLike(a) || isWallLike(b)) return 1;
    if (dead[a] === 1 && dead[b] === 1) return 1;
    const viaA = occupied[a] === 1 ? frozenState(a) : 0;
    if (viaA === 2) return 2;
    const viaB = occupied[b] === 1 ? frozenState(b) : 0;
    return Math.max(viaA, viaB);
  }

  // Same codes, for the object at `cell` on both axes together.
  function frozenState(cell) {
    if (++examinations > MAX_EXAMINATIONS) return 0;
    const c = cell % cols;
    asWall[cell] = 1;
    const across = axisState(c > 0 ? cell - 1 : -1, c < cols - 1 ? cell + 1 : -1);
    const along = across === 0 ? 0 : axisState(cell - cols, cell + cols);
    asWall[cell] = 0;
    if (across === 0 || along === 0) return 0;
    return onTarget[cell] === 0 || across === 2 || along === 2 ? 2 : 1;
  }

  return function isFreezeDeadlockAt(occupiedCells, cell) {
    occupied = occupiedCells;
    examinations = 0;
    return frozenState(cell) === 2;
  };
}
