/*
 * Spyder — core helpers.
 *
 * Everything in the reference scene hangs off a single global namespace,
 * `Spyder`, and is loaded with plain <script> tags. That is deliberate:
 * the page has to open straight from disk (file://) where ES modules are
 * blocked, and every room built later should be able to drop in the same
 * way without a bundler.
 */
(function () {
  'use strict';

  const Spyder = (window.Spyder = window.Spyder || {});

  // The whole game is authored on a fixed 1920×1080 stage and scaled to fit.
  // Rooms, platforms and spawn points are all written in these units.
  Spyder.STAGE = { width: 1920, height: 1080 };

  // ── Small math kit ────────────────────────────────────────────────────

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
  const remap = (a, b, c, d, v) => lerp(c, d, invLerp(a, b, v));
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

  // Shortest signed difference between two angles, handy for turning.
  function angleDelta(from, to) {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  // Frame-rate independent smoothing: "close `rate` of the gap per second".
  const damp = (current, target, rate, dt) =>
    lerp(current, target, 1 - Math.exp(-rate * dt));

  const ease = {
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    outBack: (t) => {
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
    outElastic: (t) =>
      t === 0 || t === 1
        ? t
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  };

  // ── Deterministic randomness ──────────────────────────────────────────
  // Rooms are painted from a seed so the same room always looks the same,
  // and screenshot runs are reproducible.

  function createRng(seed) {
    let s = seed >>> 0 || 1;
    const next = () => {
      // mulberry32
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      range: (lo, hi) => lo + (hi - lo) * next(),
      int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),
      pick: (list) => list[Math.floor(next() * list.length)],
      chance: (p) => next() < p,
      sign: () => (next() < 0.5 ? -1 : 1),
    };
  }

  // Smooth 1D value noise. Good enough for sway, flicker and wobbly edges.
  function createNoise(seed) {
    const rng = createRng(seed);
    const table = new Float32Array(256);
    for (let i = 0; i < 256; i++) table[i] = rng.next() * 2 - 1;
    return (x) => {
      const i = Math.floor(x);
      const f = x - i;
      const a = table[i & 255];
      const b = table[(i + 1) & 255];
      const u = f * f * (3 - 2 * f);
      return a + (b - a) * u;
    };
  }

  // A couple of octaves layered together reads far more organic than one.
  function fbm(noise, x, octaves = 3) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < octaves; i++) {
      sum += noise(x * freq) * amp;
      freq *= 2.03;
      amp *= 0.5;
    }
    return sum;
  }

  // ── Colour helpers ────────────────────────────────────────────────────

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(hex, alpha = 1) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Mix two hex colours; returns an rgba() string.
  function mix(hexA, hexB, t, alpha = 1) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const r = Math.round(lerp(a.r, b.r, t));
    const g = Math.round(lerp(a.g, b.g, t));
    const bl = Math.round(lerp(a.b, b.b, t));
    return `rgba(${r},${g},${bl},${alpha})`;
  }

  // Shift a hex colour toward white (amount > 0) or black (amount < 0).
  function shade(hex, amount, alpha = 1) {
    return amount >= 0 ? mix(hex, '#ffffff', amount, alpha) : mix(hex, '#000000', -amount, alpha);
  }

  // Hex-returning versions, for when the result feeds another colour helper.
  // (Passing an rgba() string into shade() or mix() would silently give black.)
  function toHex({ r, g, b }) {
    return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  }

  function mixHex(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    return toHex({ r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) });
  }

  function shadeHex(hex, amount) {
    return amount >= 0 ? mixHex(hex, '#ffffff', amount) : mixHex(hex, '#000000', -amount);
  }

  // ── Geometry ──────────────────────────────────────────────────────────

  // Where segment AB crosses segment CD, or null. Used for darts vs. web strands.
  function segmentIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
    const rX = bx - ax;
    const rY = by - ay;
    const sX = dx - cx;
    const sY = dy - cy;
    const denom = rX * sY - rY * sX;
    if (Math.abs(denom) < 1e-9) return null;
    const t = ((cx - ax) * sY - (cy - ay) * sX) / denom;
    const u = ((cx - ax) * rY - (cy - ay) * rX) / denom;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: ax + rX * t, y: ay + rY * t, t, u };
  }

  // Distance from point P to segment AB.
  function pointSegmentDistance(px, py, ax, ay, bx, by) {
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy || 1;
    const t = clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1);
    return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
  }

  // A quadratic curve point, used for sagging silk.
  function quadPoint(ax, ay, cx, cy, bx, by, t) {
    const it = 1 - t;
    return {
      x: it * it * ax + 2 * it * t * cx + t * t * bx,
      y: it * it * ay + 2 * it * t * cy + t * t * by,
    };
  }

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    return canvas;
  }

  Object.assign(Spyder, {
    clamp,
    lerp,
    invLerp,
    remap,
    dist,
    angleTo,
    angleDelta,
    damp,
    ease,
    createRng,
    createNoise,
    fbm,
    hexToRgb,
    rgba,
    mix,
    shade,
    toHex,
    mixHex,
    shadeHex,
    segmentIntersection,
    pointSegmentDistance,
    quadPoint,
    makeCanvas,
  });
})();
