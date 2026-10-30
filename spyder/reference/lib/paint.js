/*
 * Spyder — painterly drawing helpers.
 *
 * The look we are after is "storybook painting", not "vector clip-art".
 * Three tricks do most of the work, and every room should use all three:
 *
 *   1. Edges are never ruler-straight. Shapes go through wobblyPath(), which
 *      nudges each edge with noise so it looks hand-drawn.
 *   2. Fills are never flat. paintShape() lays a light-to-shadow gradient,
 *      then scatters dozens of soft translucent "brush strokes" inside it,
 *      then adds an inner shadow and a rim light on the side facing the light.
 *   3. The finished frame gets film grain and a colour grade (see scene.js).
 *
 * These helpers are slow-ish on purpose; use them when pre-rendering room
 * layers into offscreen canvases, not every frame.
 */
(function () {
  'use strict';

  const S = window.Spyder;

  // Build a closed path through `points`, subdividing each edge and pushing
  // the in-between points sideways with noise.
  function wobblyPath(ctx, points, { wobble = 1.6, step = 18, seed = 1, closed = true } = {}) {
    const noise = S.createNoise(seed);
    let travelled = seed * 13.7;
    const count = closed ? points.length : points.length - 1;

    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);

    for (let i = 0; i < count; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[(i + 1) % points.length];
      const length = Math.hypot(bx - ax, by - ay);
      const pieces = Math.max(1, Math.round(length / step));
      // Perpendicular to the edge: that is the direction the wobble pushes.
      const nx = -(by - ay) / (length || 1);
      const ny = (bx - ax) / (length || 1);

      for (let p = 1; p <= pieces; p++) {
        const t = p / pieces;
        travelled += step / 40;
        // Taper the wobble to zero at corners so corners stay crisp.
        const taper = Math.sin(t * Math.PI);
        const push = p === pieces ? 0 : S.fbm(noise, travelled, 2) * wobble * 2 * taper;
        ctx.lineTo(S.lerp(ax, bx, t) + nx * push, S.lerp(ay, by, t) + ny * push);
      }
    }
    if (closed) ctx.closePath();
  }

  function rectPoints(x, y, w, h) {
    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ];
  }

  // A rounded rectangle expressed as a polygon so it can go through wobblyPath.
  function roundedRectPoints(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    const pts = [];
    const corner = (cx, cy, start) => {
      for (let i = 0; i <= 4; i++) {
        const a = start + (i / 4) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    corner(x + w - r, y + r, -Math.PI / 2);
    corner(x + w - r, y + h - r, 0);
    corner(x + r, y + h - r, Math.PI / 2);
    corner(x + r, y + r, Math.PI);
    return pts;
  }

  function ellipsePoints(cx, cy, rx, ry, segments = 28) {
    const pts = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
  }

  function boundsOf(points) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  /*
   * The workhorse. Paints a polygon like a painter would:
   * gradient body → brush texture → inner shadow → rim light.
   *
   *   points     polygon outline
   *   color      base hex colour (from the palette)
   *   lightDir   unit vector pointing TOWARD the main light, default up-right
   *   light      how much the lit side brightens (0..1)
   *   shadow     how much the far side darkens (0..1)
   *   strokes    brush strokes per 10,000 px² of area
   *   strokeAngle  general direction of the brush (wood grain, fabric nap)
   *   rim        rim light strength (0 turns it off)
   */
  function paintShape(ctx, points, opts = {}) {
    const {
      color,
      lightDir = { x: 0.45, y: -0.9 },
      light = 0.18,
      shadow = 0.35,
      strokes = 7,
      strokeAngle = 0,
      strokeJitter = 0.35,
      strokeSize = 1,
      variance = 0.12,
      rim = 0.28,
      rimColor = null,
      innerShadow = 0.35,
      wobble = 1.6,
      seed = 7,
    } = opts;

    const b = boundsOf(points);
    const rng = S.createRng(seed * 977 + 13);

    ctx.save();
    wobblyPath(ctx, points, { wobble, seed });

    // 1. Body gradient running from the lit side to the shadow side.
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const reach = Math.max(b.w, b.h) / 2;
    const grad = ctx.createLinearGradient(
      cx + lightDir.x * reach,
      cy + lightDir.y * reach,
      cx - lightDir.x * reach,
      cy - lightDir.y * reach
    );
    grad.addColorStop(0, S.shade(color, light));
    grad.addColorStop(0.55, color);
    grad.addColorStop(1, S.shade(color, -shadow));
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.clip();

    // 2. Brush texture: soft elongated dabs of nearby tones.
    const area = b.w * b.h;
    const dabCount = Math.round((area / 10000) * strokes);
    for (let i = 0; i < dabCount; i++) {
      const x = b.x + rng.next() * b.w;
      const y = b.y + rng.next() * b.h;
      const len = rng.range(6, 30) * strokeSize;
      const thick = rng.range(1.2, 4.5) * strokeSize;
      const angle = strokeAngle + rng.range(-strokeJitter, strokeJitter);
      const tone = rng.range(-variance, variance);
      ctx.fillStyle = S.shade(color, tone, rng.range(0.06, 0.2));
      ctx.beginPath();
      ctx.ellipse(x, y, len, thick, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Inner shadow hugging the outline, so shapes feel round, not cut out.
    if (innerShadow > 0) {
      ctx.filter = 'blur(5px)';
      ctx.lineWidth = Math.min(16, Math.max(6, Math.min(b.w, b.h) * 0.12));
      ctx.strokeStyle = S.shade(color, -0.65, innerShadow);
      wobblyPath(ctx, points, { wobble, seed });
      ctx.stroke();
      ctx.filter = 'none';
    }

    // 4. Rim light: the outline, shifted away from the light, only survives
    //    the clip on the edge that faces the light.
    if (rim > 0) {
      ctx.filter = 'blur(1.5px)';
      ctx.translate(-lightDir.x * 3, -lightDir.y * 3);
      ctx.lineWidth = 3;
      ctx.strokeStyle = rimColor ? S.rgba(rimColor, rim) : S.shade(color, 0.5, rim);
      wobblyPath(ctx, points, { wobble, seed });
      ctx.stroke();
      ctx.filter = 'none';
    }

    ctx.restore();
  }

  // Soft blurred ellipse, mostly for contact shadows under objects.
  function softShadow(ctx, x, y, rx, ry, alpha = 0.45, color = '#000000') {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, S.rgba(color, alpha));
    g.addColorStop(0.6, S.rgba(color, alpha * 0.45));
    g.addColorStop(1, S.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Irregular water stain with a darker tide line — the "abandoned" tell.
  function stain(ctx, x, y, radius, color, seed = 3, alpha = 0.22) {
    const noise = S.createNoise(seed);
    const pts = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = radius * (0.75 + S.fbm(noise, i * 0.35, 3) * 0.6);
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 1.15]);
    }
    ctx.save();
    ctx.filter = 'blur(6px)';
    ctx.fillStyle = S.rgba(color, alpha * 0.6);
    wobblyPath(ctx, pts, { wobble: 3, seed });
    ctx.fill();
    ctx.filter = 'blur(1px)';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = S.rgba(color, alpha * 1.4);
    ctx.stroke();
    ctx.restore();
  }

  // A tile of monochrome grain. Drawn over the finished frame each tick at a
  // random offset, which makes the image feel like a moving painting.
  function grainTile(size = 256, seed = 99) {
    const canvas = S.makeCanvas(size, size);
    const g = canvas.getContext('2d');
    const img = g.createImageData(size, size);
    const rng = S.createRng(seed);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rng.next() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return canvas;
  }

  // Thin tapered stroke between two points; legs, hose, silk ends.
  function taperedLine(ctx, ax, ay, bx, by, startWidth, endWidth, color) {
    const angle = Math.atan2(by - ay, bx - ax);
    const nx = Math.cos(angle + Math.PI / 2);
    const ny = Math.sin(angle + Math.PI / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ax + nx * startWidth * 0.5, ay + ny * startWidth * 0.5);
    ctx.lineTo(bx + nx * endWidth * 0.5, by + ny * endWidth * 0.5);
    ctx.lineTo(bx - nx * endWidth * 0.5, by - ny * endWidth * 0.5);
    ctx.lineTo(ax - nx * startWidth * 0.5, ay - ny * startWidth * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  S.paint = {
    wobblyPath,
    rectPoints,
    roundedRectPoints,
    ellipsePoints,
    boundsOf,
    paintShape,
    softShadow,
    stain,
    grainTile,
    taperedLine,
  };
})();
