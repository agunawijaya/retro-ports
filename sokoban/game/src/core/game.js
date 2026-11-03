/**
 * @file Core game state, move rules, undo, restart, and history.
 */

import { DIR_NAMES } from './level.js';

/**
 * Creates a playable game instance from a parsed Level.
 * Pure logic: no rendering, audio, or DOM dependencies.
 *
 * @param {object} level Parsed Level object from parseLevel
 * @returns {object} Game instance
 */
export function createGame(level) {
  // Deep clone initial objects and player position
  const initialPlayer = { r: level.start.r, c: level.start.c };
  const initialObjects = level.objects.map((o) => ({ r: o.r, c: o.c }));

  // Helper map for fast target lookup by position "r,c" -> targetIndex
  const targetMap = new Map();
  level.targets.forEach((t) => {
    targetMap.set(`${t.r},${t.c}`, t.index);
  });

  function getTargetIndex(r, c) {
    const idx = targetMap.get(`${r},${c}`);
    return idx !== undefined ? idx : null;
  }

  function checkSolved(objects) {
    if (objects.length === 0 || objects.length !== level.targets.length) return false;
    for (const obj of objects) {
      if (!targetMap.has(`${obj.r},${obj.c}`)) return false;
    }
    return true;
  }

  const state = {
    player: { ...initialPlayer },
    objects: initialObjects.map((o) => ({ ...o })),
    steps: 0,
    pushes: 0,
    solved: checkSolved(initialObjects),
  };

  /** @type {Array<object>} */
  const history = [];

  function findObjectIndex(r, c) {
    return state.objects.findIndex((o) => o.r === r && o.c === c);
  }

  function normalizeDir(dir) {
    if (typeof dir === 'string') {
      const lower = dir.toLowerCase();
      if (DIR_NAMES[lower]) return { name: lower, delta: DIR_NAMES[lower] };
      // Also accept 'u', 'd', 'l', 'r'
      const shortMap = { u: 'up', d: 'down', l: 'left', r: 'right' };
      if (shortMap[lower]) return { name: shortMap[lower], delta: DIR_NAMES[shortMap[lower]] };
    }
    if (Array.isArray(dir) && dir.length === 2) {
      const [dr, dc] = dir;
      for (const [name, delta] of Object.entries(DIR_NAMES)) {
        if (delta[0] === dr && delta[1] === dc) return { name, delta };
      }
    }
    throw new Error(`Invalid direction: ${JSON.stringify(dir)}`);
  }

  return {
    get level() {
      return level;
    },
    get state() {
      return state;
    },
    get history() {
      return history;
    },

    /**
     * Executes a move in grid direction.
     * @param {'up'|'right'|'down'|'left'|number[]} dir
     * @returns {object} MoveResult
     */
    move(dir) {
      const { name: dirName, delta } = normalizeDir(dir);
      const [dr, dc] = delta;
      const from = { r: state.player.r, c: state.player.c };
      const to = { r: from.r + dr, c: from.c + dc };

      // 1. Check boundary & wall
      if (
        to.r < 0 ||
        to.c < 0 ||
        to.r >= level.rows ||
        to.c >= level.cols ||
        level.wall[to.r]?.[to.c] ||
        !level.inside[to.r]?.[to.c]
      ) {
        return {
          kind: 'blocked-wall',
          dir: dirName,
        };
      }

      // 2. Check if an object is at 'to'
      const objIndex = findObjectIndex(to.r, to.c);
      if (objIndex !== -1) {
        // Pushing an object
        const objectFrom = { r: to.r, c: to.c };
        const objectTo = { r: to.r + dr, c: to.c + dc };

        // Check if object destination is blocked by wall or void
        if (
          objectTo.r < 0 ||
          objectTo.c < 0 ||
          objectTo.r >= level.rows ||
          objectTo.c >= level.cols ||
          level.wall[objectTo.r]?.[objectTo.c] ||
          !level.inside[objectTo.r]?.[objectTo.c]
        ) {
          return {
            kind: 'blocked-object',
            dir: dirName,
            objectIndex: objIndex,
          };
        }

        // Check if object destination is blocked by another object
        const secondObj = findObjectIndex(objectTo.r, objectTo.c);
        if (secondObj !== -1) {
          return {
            kind: 'blocked-object',
            dir: dirName,
            objectIndex: objIndex,
          };
        }

        // Push succeeds!
        const lit = getTargetIndex(objectTo.r, objectTo.c);
        const unlit = getTargetIndex(objectFrom.r, objectFrom.c);

        // Update positions
        state.objects[objIndex].r = objectTo.r;
        state.objects[objIndex].c = objectTo.c;
        state.player.r = to.r;
        state.player.c = to.c;
        state.steps += 1;
        state.pushes += 1;

        const wasSolved = state.solved;
        const nowSolved = checkSolved(state.objects);
        state.solved = nowSolved;

        const moveRecord = {
          kind: 'push',
          dir: dirName,
          from,
          to,
          objectIndex: objIndex,
          objectFrom,
          objectTo,
          lit,
          unlit,
        };

        history.push(moveRecord);

        const result = { ...moveRecord };
        if (nowSolved && !wasSolved) {
          result.solved = {
            steps: state.steps,
            pushes: state.pushes,
          };
        }
        return result;
      }

      // 3. Normal walk step
      state.player.r = to.r;
      state.player.c = to.c;
      state.steps += 1;

      const moveRecord = {
        kind: 'walk',
        dir: dirName,
        from,
        to,
      };

      history.push(moveRecord);

      return { ...moveRecord };
    },

    /**
     * Undoes the last move or restart.
     * @returns {object|null} UndoResult
     */
    undo() {
      if (history.length === 0) return null;
      const last = history.pop();

      if (last.kind === 'restart') {
        // Restore state before restart
        state.player.r = last.prevState.player.r;
        state.player.c = last.prevState.player.c;
        state.objects = last.prevState.objects.map((o) => ({ ...o }));
        state.steps = last.prevState.steps;
        state.pushes = last.prevState.pushes;
        state.solved = last.prevState.solved;

        return {
          kind: 'undo-restart',
          state: {
            player: { ...state.player },
            steps: state.steps,
            pushes: state.pushes,
            solved: state.solved,
          },
        };
      }

      if (last.kind === 'walk') {
        state.player.r = last.from.r;
        state.player.c = last.from.c;
        state.steps -= 1;
        return {
          kind: 'undo',
          move: last,
        };
      }

      if (last.kind === 'push') {
        state.player.r = last.from.r;
        state.player.c = last.from.c;
        state.objects[last.objectIndex].r = last.objectFrom.r;
        state.objects[last.objectIndex].c = last.objectFrom.c;
        state.steps -= 1;
        state.pushes -= 1;
        state.solved = checkSolved(state.objects);
        return {
          kind: 'undo',
          move: last,
        };
      }

      return null;
    },

    /**
     * Resets the room to the starting configuration.
     * Creates one undoable history entry.
     */
    restart() {
      const prevState = {
        player: { ...state.player },
        objects: state.objects.map((o) => ({ ...o })),
        steps: state.steps,
        pushes: state.pushes,
        solved: state.solved,
      };

      history.push({
        kind: 'restart',
        prevState,
      });

      state.player = { ...initialPlayer };
      state.objects = initialObjects.map((o) => ({ ...o }));
      state.steps = 0;
      state.pushes = 0;
      state.solved = checkSolved(state.objects);

      return {
        kind: 'restart',
        state: { ...state },
      };
    },

    /**
     * Converts current history into a LURD string.
     * @returns {string}
     */
    toLurd() {
      const lurdMap = {
        walk: { up: 'u', down: 'd', left: 'l', right: 'r' },
        push: { up: 'U', down: 'D', left: 'L', right: 'R' },
      };

      let str = '';
      for (const entry of history) {
        if (entry.kind === 'walk' || entry.kind === 'push') {
          str += lurdMap[entry.kind][entry.dir];
        }
      }
      return str;
    },
  };
}
