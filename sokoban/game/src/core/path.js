/**
 * @file Shortest path BFS for tap-to-walk.
 */

import { DIRS, DIR_TO_NAME } from './level.js';

/**
 * Finds the shortest free path for the player to reach target { r, c },
 * avoiding walls and current objects.
 *
 * @param {object} game Game instance
 * @param {{ r: number, c: number }} target Target coordinate
 * @returns {string[]|null} Array of directions ('up'|'down'|'left'|'right') or null if unreachable
 */
export function findPath(game, target) {
  const { player, objects } = game.state;
  if (player.r === target.r && player.c === target.c) {
    return [];
  }

  const level = game.level;
  if (!level) return null;

  // Fast lookup for objects
  const objSet = new Set();
  for (const obj of objects) {
    objSet.add(`${obj.r},${obj.c}`);
  }

  // Target cell itself cannot be an object or wall
  const targetKey = `${target.r},${target.c}`;
  if (
    objSet.has(targetKey) ||
    target.r < 0 ||
    target.c < 0 ||
    target.r >= level.rows ||
    target.c >= level.cols ||
    !level.inside[target.r]?.[target.c] ||
    level.wall[target.r]?.[target.c]
  ) {
    return null;
  }

  // BFS
  const queue = [{ r: player.r, c: player.c, path: [] }];
  const visited = new Set();
  visited.add(`${player.r},${player.c}`);

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];

    for (const [dr, dc] of DIRS) {
      const nr = curr.r + dr;
      const nc = curr.c + dc;
      const key = `${nr},${nc}`;

      if (visited.has(key)) continue;

      if (
        nr < 0 ||
        nc < 0 ||
        nr >= level.rows ||
        nc >= level.cols ||
        !level.inside[nr]?.[nc] ||
        level.wall[nr]?.[nc] ||
        objSet.has(key)
      ) {
        continue;
      }

      visited.add(key);
      const dirName = DIR_TO_NAME[`${dr},${dc}`];
      const newPath = curr.path.concat(dirName);

      if (nr === target.r && nc === target.c) {
        return newPath;
      }

      queue.push({ r: nr, c: nc, path: newPath });
    }
  }

  return null;
}
