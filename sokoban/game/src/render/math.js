/**
 * @file Small numeric helpers shared by the look and the glue (reference §3).
 * `damp` is the heart of every pose blend: a frame-rate independent
 * "move towards", so nothing in Hening ever snaps unless it means to.
 */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const dampAngle = (current, target, rate, dt) =>
  current + wrapAngle(target - current) * (1 - Math.exp(-rate * dt));

/**
 * Seeded generator (mulberry32). One per room, so the same room always
 * dresses itself the same way and regression frames are reproducible.
 * @param {number} seed
 * @returns {() => number} values in [0, 1)
 */
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
