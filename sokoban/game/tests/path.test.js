import { describe, it, expect } from 'vitest';
import { parseLevel } from '../src/core/level.js';
import { createGame } from '../src/core/game.js';
import { findPath } from '../src/core/path.js';

describe('path.js', () => {
  it('finds shortest path around obstacles and walls', () => {
    // A room with a wall obstacle between start and destination
    // Start at (1, 1). Target at (1, 4).
    // Wall at (1, 2). Path must go around via row 2: down, right, right, right, up.
    const level = parseLevel([
      '######',
      '#@##.#',
      '#    #',
      '######',
    ]);
    const game = createGame(level);

    const path = findPath(game, { r: 1, c: 4 });
    expect(path).not.toBeNull();
    expect(path).toEqual(['down', 'right', 'right', 'right', 'up']);
  });

  it('navigates around an object', () => {
    // Start at (1, 1), object at (1, 2), destination at (1, 3)
    const level = parseLevel([
      '#####',
      '#@$ #',
      '#   #',
      '#####',
    ]);
    const game = createGame(level);

    const path = findPath(game, { r: 1, c: 3 });
    expect(path).not.toBeNull();
    // Path goes down to row 2, right, right, up to row 1
    expect(path).toEqual(['down', 'right', 'right', 'up']);
  });

  it('returns empty array when already at target', () => {
    const level = parseLevel([
      '####',
      '#@ #',
      '####',
    ]);
    const game = createGame(level);
    expect(findPath(game, { r: 1, c: 1 })).toEqual([]);
  });

  it('returns null when target is unreachable (blocked by wall, object, or isolated)', () => {
    const level = parseLevel([
      '#######',
      '#@#   #', // wall separating (1, 1) and (1, 3)
      '###   #',
      '#######',
    ]);
    const game = createGame(level);

    // Completely walled off
    expect(findPath(game, { r: 1, c: 3 })).toBeNull();

    // Destination is a wall
    expect(findPath(game, { r: 1, c: 2 })).toBeNull();
  });
});
