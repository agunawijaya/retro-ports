import { describe, it, expect } from 'vitest';
import { parseLevel } from '../src/core/level.js';
import { createGame } from '../src/core/game.js';
import { replayLurd } from '../src/core/replay.js';

describe('replay.js', () => {
  const level = parseLevel([
    '######',
    '#@ $.#',
    '#  $.#',
    '######',
  ]);

  it('performs LURD round trip on a solved game', () => {
    const game = createGame(level);
    // Move: walk right, push right, walk left, walk down, push right
    game.move('right'); // r
    game.move('right'); // R
    game.move('left');  // l
    game.move('down');  // d
    game.move('right'); // R

    expect(game.state.solved).toBe(true);
    const lurd = game.toLurd();
    expect(lurd).toBe('rRldR');

    // Replay the LURD string
    const res = replayLurd(level, lurd);
    expect(res.ok).toBe(true);
    expect(res.solved).toBe(true);
    expect(res.steps).toBe(5);
    expect(res.pushes).toBe(2);
    expect(res.failedAt).toBeNull();
  });

  it('reports failedAt index for illegal moves in LURD', () => {
    // Attempting to walk into a wall at index 0 (left from (1, 1))
    const wallFail = replayLurd(level, 'lu');
    expect(wallFail.ok).toBe(false);
    expect(wallFail.failedAt).toBe(0);

    // Attempting push when there is only empty floor
    const pushEmptyFail = replayLurd(level, 'rU'); // r reaches (1, 2); U pushes up into wall
    expect(pushEmptyFail.ok).toBe(false);
    expect(pushEmptyFail.failedAt).toBe(1);

    // Attempting walk when expecting push
    const walkIntoObjFail = replayLurd(level, 'rr'); // second r walks into object instead of pushing
    expect(walkIntoObjFail.ok).toBe(false);
    expect(walkIntoObjFail.failedAt).toBe(1);
  });
});
