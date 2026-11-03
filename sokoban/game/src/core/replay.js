/**
 * @file LURD replay and solution verification.
 */

import { createGame } from './game.js';

const CHAR_TO_DIR = {
  u: 'up',
  d: 'down',
  l: 'left',
  r: 'right',
  U: 'up',
  D: 'down',
  L: 'left',
  R: 'right',
};

/**
 * Replays a LURD string on a level and verifies every move.
 *
 * @param {object} level Parsed Level object
 * @param {string} lurd String of l, u, r, d (walk) and L, U, R, D (push)
 * @returns {{ ok: boolean, solved: boolean, steps: number, pushes: number, failedAt: number|null }}
 */
export function replayLurd(level, lurd) {
  const game = createGame(level);

  for (let i = 0; i < lurd.length; i++) {
    const ch = lurd[i];
    const dir = CHAR_TO_DIR[ch];
    if (!dir) {
      return {
        ok: false,
        solved: false,
        steps: game.state.steps,
        pushes: game.state.pushes,
        failedAt: i,
      };
    }

    const expectedPush = ch >= 'A' && ch <= 'Z';
    const res = game.move(dir);

    if (res.kind === 'blocked-wall' || res.kind === 'blocked-object') {
      return {
        ok: false,
        solved: false,
        steps: game.state.steps,
        pushes: game.state.pushes,
        failedAt: i,
      };
    }

    if (expectedPush && res.kind !== 'push') {
      return {
        ok: false,
        solved: false,
        steps: game.state.steps,
        pushes: game.state.pushes,
        failedAt: i,
      };
    }

    if (!expectedPush && res.kind !== 'walk') {
      return {
        ok: false,
        solved: false,
        steps: game.state.steps,
        pushes: game.state.pushes,
        failedAt: i,
      };
    }
  }

  return {
    ok: true,
    solved: game.state.solved,
    steps: game.state.steps,
    pushes: game.state.pushes,
    failedAt: null,
  };
}
