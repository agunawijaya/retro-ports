/**
 * @file What every decor piece of the current room shares: the room's effects
 * (ripples) and its seeded generator. Set by buildDecor before anything is built,
 * so the same room always dresses itself the same way.
 */

export const env = {
  /** @type {ReturnType<import('../fx.js').createFx> | null} */
  fx: null,
  /** @type {() => number} */
  rand: Math.random,
};
