import { describe, it, expect } from 'vitest';
import { parseLevel } from '../src/core/level.js';
import { solve } from '../src/core/solver/solver.js';
import { replayLurd } from '../src/core/replay.js';
import {
  precomputeDistancesAndDeadCells,
  createFreezeChecker,
  precomputeGoalRoomPacking,
} from '../src/core/solver/deadlocks.js';

/**
 * Canonical plain Breadth-First Search over Sokoban push states.
 * No heuristic, no macros, no pruning except walls.
 * Finds the push-optimal solution depth.
 */
function bfsPushSolver(level) {
  const { rows, cols, wall, inside, targets, start, objects: initObjs } = level;
  const targetMask = new Uint8Array(rows * cols);
  for (const t of targets) targetMask[t.r * cols + t.c] = 1;

  function getNormPlayer(pr, pc, boxIndices) {
    const occ = new Uint8Array(rows * cols);
    for (let i = 0; i < boxIndices.length; i++) occ[boxIndices[i]] = 1;
    let minIdx = pr * cols + pc;
    const q = [minIdx];
    const visited = new Uint8Array(rows * cols);
    visited[minIdx] = 1;
    let head = 0;
    while (head < q.length) {
      const curr = q[head++];
      if (curr < minIdx) minIdx = curr;
      const r = Math.floor(curr / cols);
      const c = curr % cols;
      const deltas = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (let d = 0; d < 4; d++) {
        const nr = r + deltas[d][0];
        const nc = c + deltas[d][1];
        const nidx = nr * cols + nc;
        if (
          nr >= 0 &&
          nc >= 0 &&
          nr < rows &&
          nc < cols &&
          inside[nr]?.[nc] &&
          !wall[nr]?.[nc] &&
          !occ[nidx] &&
          !visited[nidx]
        ) {
          visited[nidx] = 1;
          q.push(nidx);
        }
      }
    }
    return { minIdx, reachable: visited };
  }

  function isGoal(boxIndices) {
    for (let i = 0; i < boxIndices.length; i++) {
      if (!targetMask[boxIndices[i]]) return false;
    }
    return true;
  }

  const startBoxIndices = initObjs.map((o) => o.r * cols + o.c).sort((a, b) => a - b);
  const startReach = getNormPlayer(start.r, start.c, startBoxIndices);
  if (isGoal(startBoxIndices)) return 0;

  const queue = [{ boxes: startBoxIndices, normPlayer: startReach.minIdx, pushes: 0 }];
  const seen = new Set([`${startBoxIndices.join(',')}:${startReach.minIdx}`]);

  let head = 0;
  while (head < queue.length) {
    const { boxes, normPlayer, pushes } = queue[head++];
    const pr = Math.floor(normPlayer / cols);
    const pc = normPlayer % cols;
    const { reachable } = getNormPlayer(pr, pc, boxes);

    const boxSet = new Set(boxes);
    for (let b = 0; b < boxes.length; b++) {
      const bIdx = boxes[b];
      const br = Math.floor(bIdx / cols);
      const bc = bIdx % cols;
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of dirs) {
        const sr = br - dr;
        const sc = bc - dc;
        const sIdx = sr * cols + sc;
        if (sr < 0 || sc < 0 || sr >= rows || sc >= cols || !reachable[sIdx]) continue;

        const destR = br + dr;
        const destC = bc + dc;
        const destIdx = destR * cols + destC;
        if (
          destR < 0 ||
          destC < 0 ||
          destR >= rows ||
          destC >= cols ||
          !inside[destR]?.[destC] ||
          wall[destR]?.[destC] ||
          boxSet.has(destIdx)
        ) {
          continue;
        }

        const nextBoxes = [...boxes];
        nextBoxes[b] = destIdx;
        nextBoxes.sort((x, y) => x - y);

        if (isGoal(nextBoxes)) return pushes + 1;

        const nextReach = getNormPlayer(br, bc, nextBoxes);
        const stateKey = `${nextBoxes.join(',')}:${nextReach.minIdx}`;
        if (!seen.has(stateKey)) {
          seen.add(stateKey);
          queue.push({ boxes: nextBoxes, normPlayer: nextReach.minIdx, pushes: pushes + 1 });
        }
      }
    }
  }
  return -1;
}

describe('solver.js', () => {
  it('solves a trivial 1-push room', () => {
    const level = parseLevel([
      '#####',
      '#@$.#',
      '#####',
    ]);
    const res = solve(level, { weight: 1 });
    expect(res.solved).toBe(true);
    expect(res.pushes).toBe(1);
    expect(res.lurd).toBe('R');

    const verified = replayLurd(level, res.lurd);
    expect(verified.ok).toBe(true);
    expect(verified.solved).toBe(true);
  });

  it('solves a room needing a player detour', () => {
    const level = parseLevel([
      '#######',
      '#@# $.#',
      '#     #',
      '#######',
    ]);
    const res = solve(level, { weight: 1 });
    expect(res.solved).toBe(true);
    expect(res.pushes).toBe(1);

    const verified = replayLurd(level, res.lurd);
    expect(verified.ok).toBe(true);
    expect(verified.solved).toBe(true);
  });

  it('solves a room with a dead-cell trap', () => {
    const level = parseLevel([
      '########',
      '#   #  #',
      '#@ $ . #',
      '#   #  #',
      '########',
    ]);
    const res = solve(level, { weight: 1 });
    expect(res.solved).toBe(true);

    const verified = replayLurd(level, res.lurd);
    expect(verified.ok).toBe(true);
    expect(verified.solved).toBe(true);
  });

  it('returns failed for an unsolvable room', () => {
    const level = parseLevel([
      '######',
      '#$   #',
      '# @ .#',
      '######',
    ]);
    const res = solve(level, { weight: 1, maxTimeMs: 2000, maxNodes: 1000 });
    expect(res.solved).toBe(false);
    expect(res.failed).toBe(true);
  });

  describe('BFS push comparison & corridor parking (Section 2)', () => {
    // 4 bespoke rooms with up to 4 objects
    const room1 = [
      '#####',
      '#@$.#',
      '#####',
    ];

    const room2 = [
      '#######',
      '#     #',
      '# @$$ #',
      '#  .. #',
      '#######',
    ];

    const room3 = [
      '########',
      '#      #',
      '# @$$$ #',
      '#  ... #',
      '########',
    ];

    // Room 4: 2 boxes, 1-wide corridor. Box 1 MUST be parked inside the corridor
    // to clear the room for Box 2, and then later retrieved.
    const room4Corridor = [
      '#########',
      '#      .#',
      '# $###  #',
      '#@$    ##',
      '# .###  #',
      '#       #',
      '#########',
    ];

    it('matches plain BFS pushes on Room 1 (1 object)', () => {
      const level = parseLevel(room1);
      const bfs = bfsPushSolver(level);
      const sol = solve(level, { weight: 1 });
      expect(sol.solved).toBe(true);
      expect(sol.pushes).toBe(bfs);
    });

    it('matches plain BFS pushes on Room 2 (2 objects)', () => {
      const level = parseLevel(room2);
      const bfs = bfsPushSolver(level);
      const sol = solve(level, { weight: 1 });
      expect(sol.solved).toBe(true);
      expect(sol.pushes).toBe(bfs);
    });

    it('matches plain BFS pushes on Room 3 (3 objects)', () => {
      const level = parseLevel(room3);
      const bfs = bfsPushSolver(level);
      const sol = solve(level, { weight: 1 });
      expect(sol.solved).toBe(true);
      expect(sol.pushes).toBe(bfs);
    });

    it('matches plain BFS pushes on Room 4 (needing box parked inside corridor)', () => {
      const level = parseLevel(room4Corridor);
      const bfs = bfsPushSolver(level);
      const sol = solve(level, { weight: 1 });
      expect(sol.solved).toBe(true);
      expect(sol.pushes).toBe(bfs);
      expect(bfs).toBe(9);
    });
  });

  describe('Deadlock detection improvements (Section 4)', () => {
    // The corral test called the removed isCorralDeadlock: fix 2 found it
    // unsound (49 of 50 rooms, see src/core/solver/deadlocks.js) and Opus
    // removed the rule rather than repair it, so there is nothing left to
    // test here.

    it('freeze: two objects side by side against a wall, off target, is dead', () => {
      const level = parseLevel([
        '#########',
        '#@      #',
        '#       #',
        '#  $$  .#',
        '#########',
      ]);
      const { isDeadCell } = precomputeDistancesAndDeadCells(level);
      const isFreezeDeadlockAt = createFreezeChecker(level, isDeadCell);
      const occupied = new Uint8Array(level.rows * level.cols);
      for (const o of level.objects) occupied[o.r * level.cols + o.c] = 1;

      for (const o of level.objects) {
        expect(isFreezeDeadlockAt(occupied, o.r * level.cols + o.c)).toBe(true);
      }
    });

    it('freeze: the same two objects, both on target, is not dead', () => {
      const level = parseLevel([
        '#########',
        '#@      #',
        '#       #',
        '#  **   #',
        '#########',
      ]);
      const { isDeadCell } = precomputeDistancesAndDeadCells(level);
      const isFreezeDeadlockAt = createFreezeChecker(level, isDeadCell);
      const occupied = new Uint8Array(level.rows * level.cols);
      for (const o of level.objects) occupied[o.r * level.cols + o.c] = 1;

      for (const o of level.objects) {
        expect(isFreezeDeadlockAt(occupied, o.r * level.cols + o.c)).toBe(false);
      }
    });

    it('freeze: a 2x2 block of objects, off target, is dead', () => {
      const level = parseLevel([
        '#########',
        '#@      #',
        '#  ##  .#',
        '#  $$   #',
        '#  $$   #',
        '#       #',
        '#########',
      ]);
      const { isDeadCell } = precomputeDistancesAndDeadCells(level);
      const isFreezeDeadlockAt = createFreezeChecker(level, isDeadCell);
      const occupied = new Uint8Array(level.rows * level.cols);
      for (const o of level.objects) occupied[o.r * level.cols + o.c] = 1;

      for (const o of level.objects) {
        expect(isFreezeDeadlockAt(occupied, o.r * level.cols + o.c)).toBe(true);
      }
    });

    it('freeze: one object against a wall with free cells on both sides along the wall is not dead', () => {
      const level = parseLevel([
        '#########',
        '#@      #',
        '#       #',
        '#  $   .#',
        '#########',
      ]);
      const { isDeadCell } = precomputeDistancesAndDeadCells(level);
      const isFreezeDeadlockAt = createFreezeChecker(level, isDeadCell);
      const occupied = new Uint8Array(level.rows * level.cols);
      for (const o of level.objects) occupied[o.r * level.cols + o.c] = 1;

      expect(isFreezeDeadlockAt(occupied, level.objects[0].r * level.cols + level.objects[0].c)).toBe(
        false
      );
    });

    it('goal-room packing order: orders filling near target while deeper target is empty', () => {
      const level = parseLevel([
        '########',
        '#@  ...#',
        '########',
      ]);
      const { dependsOn } = precomputeGoalRoomPacking(level);
      const cols = level.cols;
      const nearTargetIdx = 1 * cols + 4;
      const deepTargetIdx = 1 * cols + 6;

      // The near target depends on the deep target being filled first
      expect(dependsOn.has(nearTargetIdx)).toBe(true);
      expect(dependsOn.get(nearTargetIdx)).toContain(deepTargetIdx);
    });
  });
});
