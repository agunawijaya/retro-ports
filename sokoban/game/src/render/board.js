/**
 * @file The room on screen: its size, and where a cell sits in the world.
 * The room is centred on the origin, one tile = one unit (ART-DIRECTION §6).
 */

/** Rows and columns of the room currently built. Written by createRoomWorld. */
export const board = { rows: 0, cols: 0 };

export const cellX = (c) => c - board.cols / 2 + 0.5;
export const cellZ = (r) => r - board.rows / 2 + 0.5;

/** The cell under a world point (inverse of cellX / cellZ). */
export const cellAt = (x, z) => ({
  r: Math.round(z + board.rows / 2 - 0.5),
  c: Math.round(x + board.cols / 2 - 0.5),
});

/** Grid steps in clockwise screen order for camera step 0: up, right, down, left. */
export const CLOCKWISE = [[-1, 0], [0, 1], [1, 0], [0, -1]];
