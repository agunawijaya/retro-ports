/*
 * Spyder — 2D lighting.
 *
 * Light is the star of this game, so it gets its own pass:
 *
 *   1. The whole scene (room, hero, spiders, webs) is drawn fully lit.
 *   2. A light map is built at half resolution: start from the room's
 *      ambient colour, then ADD every light on top ('lighter').
 *   3. The light map is MULTIPLIED over the scene. Unlit corners fall back
 *      to the ambient colour; lamp pools stay at full brightness.
 *   4. A glow pass SCREENs bulbs, beams and god rays on top so light
 *      sources themselves bloom.
 *
 * Every light registered in a frame is also kept in `lights`, so gameplay
 * code can ask "how lit is this spot?" (dust motes sparkle, spider eyes glint).
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const RES = 0.5; // light map resolution relative to the stage

  class LightMap {
    constructor(width = S.STAGE.width, height = S.STAGE.height) {
      this.width = width;
      this.height = height;
      this.canvas = S.makeCanvas(width * RES, height * RES);
      this.ctx = this.canvas.getContext('2d');
      this.lights = [];
    }

    begin(ambientColor) {
      const g = this.ctx;
      this.lights.length = 0;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = ambientColor;
      g.fillRect(0, 0, this.canvas.width, this.canvas.height);
      // From here on we think in stage units and paint additively.
      g.setTransform(RES, 0, 0, RES, 0, 0);
      g.globalCompositeOperation = 'lighter';
    }

    // A round light: lamps, bulbs, glints, the hero's torch spill.
    point(x, y, radius, color, intensity = 1) {
      if (intensity <= 0.001) return;
      const g = this.ctx;
      const grad = g.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, S.rgba(color, 0.95 * intensity));
      grad.addColorStop(0.35, S.rgba(color, 0.5 * intensity));
      grad.addColorStop(1, S.rgba(color, 0));
      g.fillStyle = grad;
      g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      this.lights.push({ kind: 'point', x, y, radius, intensity });
    }

    // A soft-edged cone: lampshade spill, the hero's head lamp.
    cone(x, y, angle, spread, length, color, intensity = 1) {
      if (intensity <= 0.001) return;
      const g = this.ctx;
      // Five stacked wedges of decreasing width fake a soft penumbra.
      // (A live blur filter here costs more than the whole rest of the frame.)
      const layers = [
        { widen: 1.4, alpha: 0.12 },
        { widen: 1.2, alpha: 0.16 },
        { widen: 1.0, alpha: 0.2 },
        { widen: 0.8, alpha: 0.2 },
        { widen: 0.6, alpha: 0.18 },
      ];
      for (const layer of layers) {
        const half = (spread / 2) * layer.widen;
        const grad = g.createRadialGradient(x, y, 0, x, y, length);
        grad.addColorStop(0, S.rgba(color, layer.alpha * intensity));
        grad.addColorStop(0.6, S.rgba(color, layer.alpha * 0.45 * intensity));
        grad.addColorStop(1, S.rgba(color, 0));
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(x, y);
        g.arc(x, y, length, angle - half, angle + half);
        g.closePath();
        g.fill();
      }
      this.lights.push({ kind: 'cone', x, y, angle, spread, length, intensity });
    }

    // A shaft through a window: a quad with brightness fading along its length.
    shaft(quad, color, intensity = 1) {
      if (intensity <= 0.001) return;
      const g = this.ctx;
      const [a, b] = quad; // a,b on the window; c,d on the floor
      const [, , c, d] = quad;
      const grad = g.createLinearGradient(
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        (c[0] + d[0]) / 2,
        (c[1] + d[1]) / 2
      );
      grad.addColorStop(0, S.rgba(color, 0.24 * intensity));
      grad.addColorStop(1, S.rgba(color, 0.05 * intensity));
      g.fillStyle = grad;
      // Three nested quads give the shaft soft edges without a blur filter.
      for (const inset of [-36, 0, 36]) fillQuad(g, widenQuad(quad, inset));
      this.lights.push({ kind: 'shaft', quad, intensity });
    }

    // Multiply the light map over whatever has been drawn on `ctx`.
    apply(ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }

    // Rough brightness (0..1+) at a stage point. Not physically correct,
    // just consistent enough to decide whether a mote or an eye catches light.
    brightnessAt(x, y) {
      let total = 0;
      for (const l of this.lights) {
        if (l.kind === 'point') {
          const d = Math.hypot(x - l.x, y - l.y);
          total += Math.max(0, 1 - d / l.radius) * l.intensity;
        } else if (l.kind === 'cone') {
          const d = Math.hypot(x - l.x, y - l.y);
          if (d > l.length) continue;
          const off = Math.abs(S.angleDelta(l.angle, Math.atan2(y - l.y, x - l.x)));
          if (off > l.spread * 0.6) continue;
          total += (1 - d / l.length) * (1 - off / (l.spread * 0.6)) * l.intensity;
        } else if (l.kind === 'shaft' && pointInQuad(x, y, l.quad)) {
          total += 0.6 * l.intensity;
        }
      }
      return total;
    }
  }

  function pointInQuad(x, y, quad) {
    let inside = false;
    for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
      const [xi, yi] = quad[i];
      const [xj, yj] = quad[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // ── Glow pass helpers (draw on the main canvas AFTER LightMap.apply) ───

  function glow(ctx, x, y, radius, color, alpha = 0.6) {
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, S.rgba(color, alpha));
    g.addColorStop(0.25, S.rgba(color, alpha * 0.45));
    g.addColorStop(1, S.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  // The visible beam of a god ray: a soft quad screened over the frame.
  function beam(ctx, quad, color, alpha = 0.25) {
    if (alpha <= 0.001) return;
    const [a, b, c, d] = quad;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const grad = ctx.createLinearGradient(
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (c[0] + d[0]) / 2,
      (c[1] + d[1]) / 2
    );
    grad.addColorStop(0, S.rgba(color, alpha / 3));
    grad.addColorStop(0.7, S.rgba(color, (alpha * 0.35) / 3));
    grad.addColorStop(1, S.rgba(color, 0));
    ctx.fillStyle = grad;
    for (const inset of [-30, 0, 30]) fillQuad(ctx, widenQuad(quad, inset));
    ctx.restore();
  }

  // Push a shaft's two long edges outward (positive) or inward (negative).
  function widenQuad([a, b, c, d], amount) {
    const spread = (p, q, k) => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const ux = (q[0] - p[0]) / len;
      const uy = (q[1] - p[1]) / len;
      return [
        [p[0] - ux * k, p[1] - uy * k],
        [q[0] + ux * k, q[1] + uy * k],
      ];
    };
    const [a2, b2] = spread(a, b, amount * 0.4);
    const [d2, c2] = spread(d, c, amount);
    return [a2, b2, c2, d2];
  }

  function fillQuad(g, [a, b, c, d]) {
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.lineTo(c[0], c[1]);
    g.lineTo(d[0], d[1]);
    g.closePath();
    g.fill();
  }

  // Old wiring: mostly steady, with the occasional stutter and dip.
  function flicker(noise, t, nervousness = 1) {
    const slow = S.fbm(noise, t * 0.7, 2) * 0.06;
    const fast = noise(t * 23) * 0.04 * nervousness;
    const dropout = noise(t * 3.1 + 40) > 0.72 ? -0.35 * nervousness : 0;
    return S.clamp(1 + slow + fast + dropout, 0.35, 1.1);
  }

  S.LightMap = LightMap;
  S.light = { glow, beam, flicker, pointInQuad };
})();
