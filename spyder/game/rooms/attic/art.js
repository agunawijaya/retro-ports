/*
 * Spyder — Room 12, the Attic: painting, light and glow.
 *
 * The logic is in room.js (layout, rules, beats) and lib/bosses/spider-queen.js
 * (the Queen). This file paints, and reads the makeover values on `mk`
 * (`windowLight`, `bulbSteady`, `sheetsOff`, set by the room's unique beat) and
 * the Queen's state through `live.world.boss` (`nestCollapseT`, `torchY`).
 *
 * We stand inside the roof, facing the far gable: its boards, a round window
 * the storm broke and someone boarded up, and in front of it, between the
 * rafters, the Queen's funnel of silk. The near roof slopes overhead in
 * perspective. Trunks, crates and a rocking horse under dust sheets.
 *
 * Anything that changes after the sweep has passed (the boards, the sheets,
 * the horse rocking, the nest, the torch) is drawn live from cached sprites;
 * the sweep would otherwise reveal it too early.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const { paintShape, rectPoints, ellipsePoints, softShadow, stain, wobblyPath } = S.paint;

  // ── Layout (must match room.js) ───────────────────────────────────────

  const RIDGE = { x: 960, y: 60 };
  const EAVES_Y = 520;
  const FLOOR_LINE = 770;
  const GROUND = 935;
  const VP = { x: 960, y: 430 };
  const BEAM = { x0: 520, x1: 1400, y: 430, h: 26 };
  const WINDOW = { cx: 960, cy: 250, r: 110, hole: 100, ring: 130 };
  const BULB = { x: 700, top: 100, y: 330 };
  const HATCH = { x0: 1760, x1: 1880, y: 935 };
  const HORSE = { x0: 1480, x1: 1700, back: 790, pivot: [1590, 600] };
  const POSTS = [520, 740, 1180, 1400];
  const LIGHT_DIR = { x: -0.35, y: -0.94 };

  const TONE = {
    timber: S.mixHex(P.walnut, P.oak, 0.3),
    timberDark: S.mixHex(P.walnut, P.umber, 0.45),
    gable: S.mixHex(P.walnut, P.taupe, 0.35),
    roof: S.mixHex(P.umber, P.walnut, 0.4),
    insulation: S.mixHex(S.mixHex(P.linen, P.oak, 0.3), P.taupe, 0.35),
    leather: S.mixHex(P.rust, P.walnut, 0.4),
    canvas: S.mixHex(P.moss, P.umber, 0.45),
    sheet: S.mixHex(P.taupe, P.linen, 0.35),
    horse: S.mixHex(P.bone, P.taupe, 0.3),
    card: S.mixHex(P.linen, P.oak, 0.45),
    crate: S.mixHex(P.oak, P.linen, 0.2),
    red: S.mixHex(P.rust, P.ember, 0.25),
  };

  const aged = (hex, clean, k = 1) => (clean ? hex : S.mixHex(S.shadeHex(hex, -0.18 * k), P.taupe, 0.22 * k));
  const slopeY = (x) => RIDGE.y + (Math.abs(x - RIDGE.x) / 960) * (EAVES_Y - RIDGE.y);
  const sweptPast = (mk, x) => mk.wipe >= 1 || (mk.wipe > 0 && mk.sweepX > x);

  const GABLE = [[0, EAVES_Y], [RIDGE.x, RIDGE.y], [1920, EAVES_Y], [1920, FLOOR_LINE + 4], [0, FLOOR_LINE + 4]];
  const ROOF_LEFT = [[0, 0], [RIDGE.x, 0], [RIDGE.x, RIDGE.y], [0, EAVES_Y]];
  const ROOF_RIGHT = [[RIDGE.x, 0], [1920, 0], [1920, EAVES_Y], [RIDGE.x, RIDGE.y]];

  function polyPath(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
    g.closePath();
  }

  function nails(g, pts, clean) {
    for (const [x, y] of pts) {
      g.fillStyle = S.rgba(P.soot, clean ? 0.55 : 0.7);
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.rgba(clean ? P.linen : P.taupe, 0.35);
      g.beginPath();
      g.arc(x - 0.8, y - 0.8, 1.1, 0, Math.PI * 2);
      g.fill();
    }
  }

  // ── Back layer ────────────────────────────────────────────────────────

  function paintBack(g, clean) {
    g.fillStyle = P.soot;
    g.fillRect(0, 0, 1920, 1080);
    paintRoofPlane(g, ROOF_LEFT, -1, clean);
    paintRoofPlane(g, ROOF_RIGHT, 1, clean);
    paintRidge(g, clean);
    paintGable(g, clean);
    paintPosts(g, clean);
    paintWindowFrame(g, clean);
    paintFloor(g, clean);
    paintHatch(g, clean);
  }

  // The near roof, overhead: boards running toward us (their seams meet at
  // the vanishing point), crossed by rafters parallel to the gable's edge,
  // each thicker and further apart as it comes closer. Darker at the eaves.
  function paintRoofPlane(g, region, side, clean) {
    g.save();
    polyPath(g, region);
    g.clip();
    const base = aged(TONE.roof, clean);
    const grad = g.createLinearGradient(RIDGE.x, 0, RIDGE.x + side * 960, EAVES_Y);
    grad.addColorStop(0, S.shadeHex(base, 0.08));
    grad.addColorStop(0.6, base);
    grad.addColorStop(1, S.shadeHex(base, -0.45));
    g.fillStyle = grad;
    g.fillRect(0, 0, 1920, EAVES_Y);

    // Board seams converging on the vanishing point.
    const rng = S.createRng(16101 + side);
    for (let t = 0.04; t < 1.0; t += 0.045 + rng.next() * 0.02) {
      const ex = RIDGE.x + side * 960 * (1 - t);
      const ey = slopeY(ex);
      const dx = ex - VP.x;
      const dy = ey - VP.y;
      const far = 4;
      // Each board a touch lighter or darker than its neighbour.
      g.fillStyle = S.rgba(rng.next() > 0.5 ? P.linen : P.soot, 0.025 + rng.next() * 0.04);
      g.beginPath();
      g.moveTo(ex, ey);
      g.lineTo(VP.x + dx * far, VP.y + dy * far);
      const t2 = t + 0.04;
      const ex2 = RIDGE.x + side * 960 * (1 - t2);
      const ey2 = slopeY(ex2);
      g.lineTo(VP.x + (ex2 - VP.x) * far, VP.y + (ey2 - VP.y) * far);
      g.lineTo(ex2, ey2);
      g.closePath();
      g.fill();
      g.strokeStyle = S.rgba(P.soot, 0.5);
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(ex, ey);
      g.lineTo(VP.x + dx * far, VP.y + dy * far);
      g.stroke();
    }

    // Rafters: bands parallel to the slope edge.
    const len = Math.hypot(960, EAVES_Y - RIDGE.y);
    const ux = (side * 960) / len;
    const uy = (EAVES_Y - RIDGE.y) / len;
    const nx = side * uy;
    const ny = -Math.abs(ux);
    const rafters = [[0, 24], [74, 30], [178, 40], [320, 52], [510, 66]];
    rafters.forEach(([off, thick], i) => {
      const a = [RIDGE.x - ux * 200 + nx * off, RIDGE.y - uy * 200 + ny * off];
      const b = [RIDGE.x + ux * 1400 + nx * off, RIDGE.y + uy * 1400 + ny * off];
      const pts = [a, b, [b[0] + nx * thick, b[1] + ny * thick], [a[0] + nx * thick, a[1] + ny * thick]];
      paintShape(g, pts, {
        color: aged(i === 0 ? TONE.timberDark : TONE.timber, clean),
        lightDir: { x: -nx, y: -ny },
        light: 0.2,
        shadow: 0.5,
        strokes: 12,
        strokeAngle: Math.atan2(uy, ux),
        strokeJitter: 0.08,
        rim: 0,
        innerShadow: 0,
        wobble: 0.8,
        seed: 16110 + i * 7 + (side > 0 ? 50 : 0),
      });
      // The lit edge and the shadowed edge, drawn rather than blurred:
      // these shapes are huge, and a blur filter over each costs the GPU
      // a long stall on the room's first frame.
      g.strokeStyle = S.rgba(P.linen, clean ? 0.16 : 0.1);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
      g.strokeStyle = S.rgba(P.soot, 0.55);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(a[0] + nx * thick, a[1] + ny * thick);
      g.lineTo(b[0] + nx * thick, b[1] + ny * thick);
      g.stroke();
      // Nail heads along each rafter, where boards are fixed to it.
      const row = [];
      for (let k = 0.1; k < 1.4; k += 0.11) {
        row.push([RIDGE.x + ux * len * k + nx * (off + thick * 0.5), RIDGE.y + uy * len * k + ny * (off + thick * 0.5)]);
      }
      nails(g, row, clean);
    });

    // Insulation between the first rafters near the eaves: fibre, not
    // lumps — many short curled strokes in two tones.
    const ins = aged(TONE.insulation, clean, 0.6);
    const irng = S.createRng(16130 + side);
    for (const [o0, o1] of [[24, 74], [104, 178]]) {
      for (let i = 0; i < 260; i++) {
        const k = 0.7 + irng.next() * 0.34;
        const off = o0 + irng.next() * (o1 - o0);
        const x = RIDGE.x + ux * len * k + nx * off;
        const y = RIDGE.y + uy * len * k + ny * off;
        if (y > EAVES_Y + 4 || x < -10 || x > 1930) continue;
        const a = irng.next() * Math.PI * 2;
        const l = 5 + irng.next() * 9;
        g.strokeStyle = S.rgba(irng.next() > 0.4 ? ins : S.shadeHex(ins, -0.3), 0.22 + irng.next() * 0.25);
        g.lineWidth = 1 + irng.next() * 1.4;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.6, y + Math.sin(a + 1) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
    }
    g.restore();
  }

  // The ridge beam, seen from below, running toward us.
  function paintRidge(g, clean) {
    paintShape(g, [[946, RIDGE.y + 6], [974, RIDGE.y + 6], [998, -4], [922, -4]], {
      color: aged(TONE.timberDark, clean),
      lightDir: { x: -1, y: 0 },
      light: 0.2,
      shadow: 0.5,
      strokes: 10,
      strokeAngle: Math.PI / 2,
      rim: 0.15,
      wobble: 0.4,
      seed: 16150,
    });
  }

  // The gable: vertical boards of uneven width, knots, nail rows, and below
  // the broken window the dark tide of years of rain.
  function paintGable(g, clean) {
    g.save();
    polyPath(g, GABLE);
    g.clip();
    const rng = S.createRng(16160);
    let x = -10;
    let i = 0;
    while (x < 1930) {
      const w = 46 + rng.next() * 30;
      const top = slopeY(x + w / 2) - 30;
      const tone = S.shadeHex(aged(TONE.gable, clean), rng.range(-0.12, 0.1));
      // Boards near the centre catch the bulb and the window; the corners
      // under the eaves sink into shadow.
      const centre = 1 - Math.min(1, Math.abs(x + w / 2 - 860) / 900);
      paintShape(g, rectPoints(x, top, w - 2, FLOOR_LINE - top + 6), {
        color: S.shadeHex(tone, -0.28 + centre * 0.3),
        lightDir: LIGHT_DIR,
        light: 0.14,
        shadow: 0.3,
        strokes: 12,
        strokeAngle: Math.PI / 2,
        strokeJitter: 0.06,
        strokeSize: 1.2,
        rim: 0,
        innerShadow: 0,
        wobble: 0.6,
        seed: 16170 + i,
      });
      // Gap between boards.
      g.fillStyle = S.rgba(P.soot, 0.6);
      g.fillRect(x + w - 2.5, top, 2.5, FLOOR_LINE - top + 6);
      // A knot or two.
      if (rng.next() > 0.45) {
        const ky = top + 80 + rng.next() * (FLOOR_LINE - top - 160);
        const kx = x + w * (0.3 + rng.next() * 0.4);
        g.strokeStyle = S.rgba(P.soot, 0.35);
        g.lineWidth = 1.2;
        for (const r of [3, 6, 9]) {
          g.beginPath();
          g.ellipse(kx, ky, r * 0.7, r * 1.6, 0, 0, Math.PI * 2);
          g.stroke();
        }
        g.fillStyle = S.rgba(P.soot, 0.45);
        g.beginPath();
        g.ellipse(kx, ky, 2.4, 4.5, 0, 0, Math.PI * 2);
        g.fill();
      }
      nails(g, [[x + w * 0.5, 480], [x + w * 0.5, 700]].filter(([, y]) => y > top + 20), clean);
      x += w;
      i++;
    }
    // The storm came in through the round window: damp streaks below it.
    if (!clean) {
      stain(g, WINDOW.cx + 10, WINDOW.cy + 190, 120, P.soot, 16190, 0.32);
      g.fillStyle = S.rgba(P.soot, 0.18);
      for (let k = 0; k < 9; k++) {
        const sx = WINDOW.cx - 90 + k * 22 + rng.range(-6, 6);
        g.fillRect(sx, WINDOW.cy + WINDOW.ring - 10, 3 + rng.next() * 3, 160 + rng.next() * 220);
      }
      stain(g, 260, 640, 90, P.oak, 16191, 0.22);
      stain(g, 1700, 600, 70, P.oak, 16192, 0.2);
    } else {
      stain(g, WINDOW.cx + 10, WINDOW.cy + 200, 100, P.oak, 16190, 0.08);
    }
    // The skirting where the gable meets the floor.
    g.fillStyle = aged(TONE.timberDark, clean);
    g.fillRect(0, FLOOR_LINE - 16, 1920, 20);
    g.restore();
  }

  // Four studs framing the window and carrying the collar beam.
  function paintPosts(g, clean) {
    POSTS.forEach((px, i) => {
      const top = slopeY(px) - 6;
      paintShape(g, rectPoints(px - 13, top, 26, FLOOR_LINE - top - 10), {
        color: aged(TONE.timber, clean),
        lightDir: px < BULB.x ? { x: 1, y: -0.3 } : { x: -1, y: -0.3 },
        light: 0.22,
        shadow: 0.5,
        strokes: 12,
        strokeAngle: Math.PI / 2,
        strokeJitter: 0.05,
        rim: 0.2,
        innerShadow: 0,
        wobble: 0.5,
        seed: 16200 + i,
      });
      softShadow(g, px + 18, (top + FLOOR_LINE) / 2, 14, (FLOOR_LINE - top) / 2, 0.25);
      nails(g, [[px, top + 30], [px, 445], [px, 700]], clean);
    });
  }

  // A wheel of timber round a round hole. Dirty: broken glass at the rim.
  // Clean: new glass and a thin cross of glazing bars.
  function paintWindowFrame(g, clean) {
    const { cx, cy, hole, ring } = WINDOW;
    softShadow(g, cx + 8, cy + 12, ring + 18, ring + 18, 0.45);
    const ringPts = [];
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      ringPts.push([cx + Math.cos(a) * ring, cy + Math.sin(a) * ring]);
    }
    for (let k = 48; k >= 0; k--) {
      const a = (k / 48) * Math.PI * 2;
      ringPts.push([cx + Math.cos(a) * hole, cy + Math.sin(a) * hole]);
    }
    paintShape(g, ringPts, {
      color: aged(TONE.timber, clean),
      lightDir: LIGHT_DIR,
      light: 0.28,
      shadow: 0.45,
      strokes: 14,
      strokeAngle: 0.6,
      strokeJitter: 0.8,
      rim: 0.22,
      innerShadow: 0.3,
      wobble: 0.4,
      seed: 16210,
    });
    // Eight joints, each pinned with a dowel; a bevel on the inner edge.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      g.strokeStyle = S.rgba(P.soot, 0.55);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (hole + 2), cy + Math.sin(a) * (hole + 2));
      g.lineTo(cx + Math.cos(a) * (ring - 2), cy + Math.sin(a) * (ring - 2));
      g.stroke();
      nails(g, [[cx + Math.cos(a + 0.18) * (hole + ring) * 0.5, cy + Math.sin(a + 0.18) * (hole + ring) * 0.5]], clean);
    }
    g.strokeStyle = S.rgba(clean ? P.linen : P.taupe, 0.25);
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, hole + 4, Math.PI * 0.9, Math.PI * 1.7);
    g.stroke();
    // The hole itself: cut through, so the sky behind shows.
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(cx, cy, hole, 0, Math.PI * 2);
    g.fill();
    g.restore();
    if (clean) {
      g.strokeStyle = aged(TONE.timberDark, clean);
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(cx - hole, cy);
      g.lineTo(cx + hole, cy);
      g.moveTo(cx, cy - hole);
      g.lineTo(cx, cy + hole);
      g.stroke();
      g.strokeStyle = S.rgba(P.bone, 0.18);
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, cy, hole - 8, -2.4, -1.5);
      g.stroke();
    } else {
      const rng = S.createRng(16220);
      for (let i = 0; i < 9; i++) {
        const a = rng.next() * Math.PI * 2;
        const r0 = hole + 1;
        const len = 10 + rng.next() * 22;
        const w = 0.12 + rng.next() * 0.12;
        g.fillStyle = S.rgba(P.moon, 0.22 + rng.next() * 0.2);
        g.beginPath();
        g.moveTo(cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0);
        g.lineTo(cx + Math.cos(a) * (r0 - len), cy + Math.sin(a) * (r0 - len));
        g.lineTo(cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0);
        g.closePath();
        g.fill();
      }
    }
  }

  // Rough boards running toward the vanishing point; at the back corners
  // the boarding stops and the joists show, with insulation between them.
  function paintFloor(g, clean) {
    const base = aged(S.mixHex(P.walnut, P.oak, 0.4), clean);
    paintShape(g, rectPoints(0, FLOOR_LINE, 1920, 310), {
      color: base,
      lightDir: { x: -0.2, y: -1 },
      light: 0.12,
      shadow: 0.4,
      strokes: 10,
      strokeAngle: 0,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 16230,
    });
    const atY = (xb, y) => VP.x + (xb - VP.x) * ((y - VP.y) / (1080 - VP.y));
    // Joists and insulation at the back corners, outside the boarding.
    for (const sideEdge of [-1, 1]) {
      const edge = sideEdge < 0 ? -300 : 2220;
      g.save();
      g.beginPath();
      if (sideEdge < 0) {
        g.moveTo(0, FLOOR_LINE);
        g.lineTo(atY(edge, FLOOR_LINE), FLOOR_LINE);
        g.lineTo(atY(edge, 1080), 1080);
        g.lineTo(0, 1080);
      } else {
        g.moveTo(1920, FLOOR_LINE);
        g.lineTo(atY(edge, FLOOR_LINE), FLOOR_LINE);
        g.lineTo(atY(edge, 1080), 1080);
        g.lineTo(1920, 1080);
      }
      g.closePath();
      g.clip();
      g.fillStyle = S.shadeHex(aged(TONE.insulation, clean, 0.7), -0.25);
      g.fillRect(0, FLOOR_LINE, 1920, 310);
      const irng = S.createRng(16240 + sideEdge);
      for (let i = 0; i < 90; i++) {
        const x = sideEdge < 0 ? irng.next() * 320 : 1600 + irng.next() * 320;
        const y = FLOOR_LINE + irng.next() * 200;
        g.fillStyle = S.rgba(irng.next() > 0.5 ? TONE.insulation : P.taupe, 0.25 + irng.next() * 0.3);
        wobblyPath(g, ellipsePoints(x, y, 16 + irng.next() * 14, 6 + irng.next() * 6, 10), { wobble: 3, step: 6, seed: 16250 + i });
        g.fill();
      }
      for (let k = 0; k < 4; k++) {
        const xb = edge + sideEdge * k * 260;
        const pts = [[atY(xb, FLOOR_LINE), FLOOR_LINE], [atY(xb + 34, FLOOR_LINE), FLOOR_LINE], [atY(xb + 90, 1080), 1080], [atY(xb, 1080), 1080]];
        paintShape(g, pts, {
          color: aged(TONE.timber, clean),
          lightDir: { x: 0, y: -1 },
          light: 0.2,
          shadow: 0.45,
          strokes: 10,
          strokeAngle: Math.atan2(1080 - FLOOR_LINE, atY(xb, 1080) - atY(xb, FLOOR_LINE)),
          rim: 0,
          innerShadow: 0,
          wobble: 0.5,
          seed: 16260 + k + (sideEdge > 0 ? 10 : 0),
        });
      }
      g.restore();
    }
    // Board seams and the odd board end.
    const rng = S.createRng(16270);
    for (let xb = -300; xb <= 2220; xb += 84 + rng.next() * 18) {
      g.fillStyle = S.rgba(rng.next() > 0.5 ? P.linen : P.soot, 0.03 + rng.next() * 0.05);
      const nxt = xb + 84;
      g.beginPath();
      g.moveTo(atY(xb, FLOOR_LINE), FLOOR_LINE);
      g.lineTo(atY(nxt, FLOOR_LINE), FLOOR_LINE);
      g.lineTo(nxt, 1080);
      g.lineTo(xb, 1080);
      g.closePath();
      g.fill();
      g.strokeStyle = S.rgba(P.soot, 0.55);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(atY(xb, FLOOR_LINE), FLOOR_LINE);
      g.lineTo(xb, 1080);
      g.stroke();
      const cut = FLOOR_LINE + 40 + rng.next() * 250;
      g.beginPath();
      g.moveTo(atY(xb, cut), cut);
      g.lineTo(atY(nxt, cut), cut);
      g.stroke();
      nails(g, [[atY(xb + 42, cut - 6), cut - 6], [atY(xb + 42, cut + 8), cut + 8]], clean);
    }
    if (!clean) {
      // Dust lying thick, scuffed where someone once walked to the trunks.
      g.fillStyle = S.rgba(P.linen, 0.07);
      g.fillRect(0, FLOOR_LINE, 1920, 310);
      stain(g, 980, 990, 160, P.soot, 16280, 0.18);
    }
    // The floor meets the gable: a dark seam.
    g.fillStyle = S.rgba(P.soot, 0.55);
    g.fillRect(0, FLOOR_LINE - 2, 1920, 6);
  }

  // The hatch from the hallway: a hole in the floor, the ladder's top rails
  // standing out of it, the lid laid back. Warm light comes up from below.
  function paintHatch(g, clean) {
    const q = [[HATCH.x0, 916], [HATCH.x1, 916], [HATCH.x1 + 12, 968], [HATCH.x0 - 10, 968]];
    g.fillStyle = P.soot;
    polyPath(g, q);
    g.fill();
    const glowGrad = g.createLinearGradient(0, 968, 0, 916);
    glowGrad.addColorStop(0, S.rgba(P.amber, 0.28));
    glowGrad.addColorStop(1, S.rgba(P.amber, 0));
    g.fillStyle = glowGrad;
    polyPath(g, q);
    g.fill();
    // The lid, laid back on the boards to the left.
    paintShape(g, [[1680, 920], [1752, 920], [1748, 968], [1668, 968]], {
      color: aged(TONE.timber, clean),
      lightDir: LIGHT_DIR,
      light: 0.2,
      shadow: 0.4,
      strokes: 12,
      strokeAngle: 0,
      rim: 0.2,
      wobble: 0.5,
      seed: 16290,
    });
    nails(g, [[1690, 930], [1740, 930], [1688, 958], [1738, 958]], clean);
    // Ladder rails and the top rung.
    for (const rx of [1786, 1852]) {
      paintShape(g, rectPoints(rx - 6, 880, 12, 82), {
        color: aged(TONE.timber, clean),
        lightDir: { x: 0, y: 1 },
        light: 0.3,
        shadow: 0.4,
        strokes: 10,
        strokeAngle: Math.PI / 2,
        rim: 0.25,
        wobble: 0.3,
        seed: 16295 + rx,
      });
    }
    paintShape(g, rectPoints(1786, 906, 66, 9), {
      color: aged(TONE.timber, clean),
      lightDir: { x: 0, y: 1 },
      light: 0.3,
      shadow: 0.4,
      strokes: 8,
      rim: 0.2,
      wobble: 0.3,
      seed: 16298,
    });
  }

  // ── Furniture layer ───────────────────────────────────────────────────

  function paintFurniture(g, clean) {
    paintCollarBeam(g, clean);
    paintBoxStack(g, clean);
    paintCrates(g, clean);
    paintLowerTrunk(g, clean);
    paintUpperTrunk(g, clean);
    paintDecorations(g, clean);
  }

  function paintCollarBeam(g, clean) {
    const { x0, x1, y, h } = BEAM;
    softShadow(g, (x0 + x1) / 2 + 20, y + h + 14, (x1 - x0) / 2, 12, 0.4);
    paintShape(g, rectPoints(x0 - 14, y, x1 - x0 + 28, h), {
      color: aged(TONE.timber, clean),
      lightDir: { x: -0.2, y: -1 },
      light: 0.28,
      shadow: 0.5,
      strokes: 13,
      strokeAngle: 0,
      strokeJitter: 0.05,
      strokeSize: 1.3,
      rim: 0.28,
      innerShadow: 0.3,
      wobble: 0.6,
      seed: 16300,
    });
    // Chamfered top edge catching light, iron straps where it meets the posts.
    g.fillStyle = S.rgba(clean ? P.linen : P.taupe, clean ? 0.22 : 0.3);
    g.fillRect(x0 - 12, y + 1, x1 - x0 + 24, 3);
    for (const px of [x0, x1]) {
      g.fillStyle = S.mixHex(P.gear, P.soot, 0.4);
      g.fillRect(px - 18, y - 2, 36, h + 4);
      nails(g, [[px - 9, y + 7], [px + 9, y + 7], [px - 9, y + h - 6], [px + 9, y + h - 6]], clean);
    }
    if (!clean) {
      // Dust lies thick on top of a beam nobody has walked for years.
      g.fillStyle = S.rgba(P.linen, 0.16);
      g.fillRect(x0 - 12, y - 3, x1 - x0 + 24, 4);
    }
  }

  // Cardboard and wooden boxes stacked to the beam, labelled by hand.
  function paintBoxStack(g, clean) {
    const boxes = [
      { y0: 810, y1: GROUND, x0: 466, x1: 566, color: TONE.card, label: 'BOOKS', seed: 1 },
      { y0: 690, y1: 810, x0: 470, x1: 562, color: TONE.crate, label: 'JARS', seed: 2, slats: true },
      { y0: 560, y1: 690, x0: 474, x1: 560, color: S.shadeHex(TONE.card, -0.1), label: 'LINEN', seed: 3 },
    ];
    softShadow(g, 516, GROUND + 4, 64, 8, 0.5);
    for (const b of boxes) {
      paintShape(g, rectPoints(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0), {
        color: aged(b.color, clean),
        lightDir: LIGHT_DIR,
        light: 0.2,
        shadow: 0.45,
        strokes: b.slats ? 12 : 8,
        strokeAngle: b.slats ? 0 : Math.PI / 2,
        rim: 0.2,
        innerShadow: 0.3,
        wobble: 0.8,
        seed: 16310 + b.seed,
      });
      if (b.slats) {
        g.strokeStyle = S.rgba(P.soot, 0.5);
        g.lineWidth = 2;
        for (let yy = b.y0 + 30; yy < b.y1 - 10; yy += 30) {
          g.beginPath();
          g.moveTo(b.x0 + 2, yy);
          g.lineTo(b.x1 - 2, yy);
          g.stroke();
        }
      } else {
        // Tape across the flaps.
        g.fillStyle = S.rgba(P.oak, 0.45);
        g.fillRect(b.x0 + (b.x1 - b.x0) / 2 - 7, b.y0, 14, 24);
      }
      g.save();
      g.translate((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2 + 6);
      g.rotate(-0.04);
      g.font = '700 17px Caveat, cursive';
      g.textAlign = 'center';
      g.fillStyle = S.rgba(P.soot, clean ? 0.7 : 0.45);
      g.fillText(b.label, 0, 0);
      g.restore();
    }
  }

  // Slatted packing crates on the right, stencilled.
  function paintCrates(g, clean) {
    const crates = [
      { x0: 1296, x1: 1404, y0: 790, y1: GROUND, mark: 'No 7' },
      { x0: 1300, x1: 1402, y0: 650, y1: 790, mark: '↑ UP' },
      { x0: 1318, x1: 1402, y0: 520, y1: 650, mark: '' },
    ];
    softShadow(g, 1350, GROUND + 4, 74, 9, 0.5);
    crates.forEach((c, i) => {
      paintShape(g, rectPoints(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0), {
        color: aged(S.shadeHex(TONE.crate, -0.05 * i), clean),
        lightDir: LIGHT_DIR,
        light: 0.22,
        shadow: 0.5,
        strokes: 13,
        strokeAngle: 0,
        strokeJitter: 0.05,
        rim: 0.2,
        innerShadow: 0.3,
        wobble: 0.6,
        seed: 16320 + i,
      });
      g.strokeStyle = S.rgba(P.soot, 0.55);
      g.lineWidth = 2;
      for (let yy = c.y0 + 28; yy < c.y1 - 6; yy += 28) {
        g.beginPath();
        g.moveTo(c.x0 + 3, yy);
        g.lineTo(c.x1 - 3, yy);
        g.stroke();
      }
      // Corner battens.
      g.fillStyle = S.rgba(P.soot, 0.25);
      g.fillRect(c.x0 + 2, c.y0 + 2, 9, c.y1 - c.y0 - 4);
      g.fillRect(c.x1 - 11, c.y0 + 2, 9, c.y1 - c.y0 - 4);
      nails(g, [[c.x0 + 6, c.y0 + 10], [c.x1 - 6, c.y0 + 10], [c.x0 + 6, c.y1 - 10], [c.x1 - 6, c.y1 - 10]], clean);
      if (c.mark) {
        g.font = '16px "Special Elite", monospace';
        g.textAlign = 'center';
        g.fillStyle = S.rgba(P.soot, clean ? 0.55 : 0.35);
        g.fillText(c.mark, (c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2 + 6);
      }
    });
  }

  // A travel label: an oval or a rectangle, a coloured band, a few letters.
  function label(g, x, y, w, h, angle, color, text, oval, clean) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    const paper = clean ? S.mixHex(P.bone, P.linen, 0.4) : S.mixHex(P.linen, P.taupe, 0.4);
    g.fillStyle = paper;
    g.beginPath();
    if (oval) g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    else g.rect(-w / 2, -h / 2, w, h);
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = aged(color, clean);
    g.fillRect(-w / 2, -h * 0.12, w, h * 0.3);
    g.restore();
    g.font = `${Math.round(h * 0.26)}px "Special Elite", monospace`;
    g.textAlign = 'center';
    g.fillStyle = S.rgba(P.soot, 0.7);
    g.fillText(text, 0, -h * 0.2);
    g.fillStyle = S.rgba(paper, 0.95);
    g.fillText('·', 0, h * 0.12);
    // Torn, curling edge.
    g.strokeStyle = S.rgba(P.soot, 0.25);
    g.lineWidth = 1;
    g.beginPath();
    if (oval) g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    else g.rect(-w / 2, -h / 2, w, h);
    g.stroke();
    g.restore();
  }

  function brassCorner(g, x, y, sx, sy, clean) {
    g.fillStyle = clean ? P.brass : S.mixHex(P.brass, P.umber, 0.5);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + sx * 26, y);
    g.lineTo(x + sx * 26, y + sy * 8);
    g.lineTo(x + sx * 8, y + sy * 8);
    g.lineTo(x + sx * 8, y + sy * 26);
    g.lineTo(x, y + sy * 26);
    g.closePath();
    g.fill();
    g.fillStyle = S.rgba(P.bone, clean ? 0.4 : 0.15);
    g.fillRect(x + sx * 2, y + sy * 2, sx * 18, sy * 2);
  }

  // A leather-bound trunk: straps, wooden ribs, brass corners, labels from
  // places nobody in the family ever named.
  function paintLowerTrunk(g, clean) {
    const x0 = 190;
    const x1 = 450;
    const y0 = 830;
    softShadow(g, 320, GROUND + 4, 150, 10, 0.55);
    paintShape(g, rectPoints(x0, y0, x1 - x0, GROUND - y0), {
      color: aged(TONE.leather, clean),
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.5,
      strokes: 14,
      strokeAngle: 0.1,
      variance: 0.16,
      rim: 0.25,
      innerShadow: 0.35,
      wobble: 0.7,
      seed: 16330,
    });
    // Lid seam and wooden ribs.
    for (const yy of [862, 904]) {
      paintShape(g, rectPoints(x0 - 2, yy - 5, x1 - x0 + 4, 10), {
        color: aged(TONE.timber, clean),
        lightDir: { x: 0, y: -1 },
        light: 0.3,
        shadow: 0.4,
        strokes: 8,
        rim: 0.2,
        innerShadow: 0,
        wobble: 0.3,
        seed: 16331 + yy,
      });
    }
    for (const sx of [244, 396]) {
      g.fillStyle = aged(S.shadeHex(TONE.leather, -0.25), clean);
      g.fillRect(sx - 9, y0 - 2, 18, GROUND - y0 + 2);
      g.fillStyle = clean ? P.brass : S.mixHex(P.brass, P.umber, 0.5);
      g.strokeStyle = g.fillStyle;
      g.lineWidth = 2.5;
      g.strokeRect(sx - 11, 872, 22, 16);
    }
    brassCorner(g, x0, y0, 1, 1, clean);
    brassCorner(g, x1, y0, -1, 1, clean);
    brassCorner(g, x0, GROUND, 1, -1, clean);
    brassCorner(g, x1, GROUND, -1, -1, clean);
    g.fillStyle = clean ? P.brass : S.mixHex(P.brass, P.umber, 0.5);
    g.fillRect(312, 856, 16, 20);
    label(g, 290, 920, 54, 30, -0.12, P.moss, 'CASTELMAR', true, clean);
    label(g, 360, 925, 48, 24, 0.08, P.rust, 'S.S. WANDERLY', false, clean);
    if (!clean) {
      g.fillStyle = S.rgba(P.linen, 0.2);
      g.fillRect(x0 + 4, y0 - 2, x1 - x0 - 8, 5);
    }
  }

  function paintUpperTrunk(g, clean) {
    const x0 = 220;
    const x1 = 420;
    const y0 = 700;
    const y1 = 830;
    softShadow(g, 320, y1 + 2, 110, 6, 0.5);
    paintShape(g, rectPoints(x0, y0, x1 - x0, y1 - y0), {
      color: aged(TONE.canvas, clean),
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.5,
      strokes: 16,
      strokeAngle: Math.PI / 2,
      variance: 0.14,
      rim: 0.25,
      innerShadow: 0.35,
      wobble: 0.7,
      seed: 16340,
    });
    for (const yy of [732, 794]) {
      paintShape(g, rectPoints(x0 - 2, yy - 5, x1 - x0 + 4, 10), {
        color: aged(TONE.timber, clean),
        lightDir: { x: 0, y: -1 },
        light: 0.3,
        shadow: 0.4,
        strokes: 8,
        rim: 0.2,
        innerShadow: 0,
        wobble: 0.3,
        seed: 16341 + yy,
      });
    }
    brassCorner(g, x0, y0, 1, 1, clean);
    brassCorner(g, x1, y0, -1, 1, clean);
    brassCorner(g, x0, y1, 1, -1, clean);
    brassCorner(g, x1, y1, -1, -1, clean);
    label(g, 270, 765, 60, 34, 0.1, P.plum, 'HOTEL ORSINO', true, clean);
    label(g, 372, 762, 46, 26, -0.15, P.moon, 'KESTREL BAY', false, clean);
    label(g, 318, 812, 40, 18, 0.04, P.rust, 'LINEA ALBA', false, clean);
  }

  // A box of Christmas decorations: tipped over in the dirty room, baubles
  // spilled; set upright, lid on, tinsel peeking out once clean.
  function paintDecorations(g, clean) {
    if (clean) {
      softShadow(g, 640, GROUND + 3, 46, 6, 0.5);
      paintShape(g, rectPoints(604, 872, 72, 63), {
        color: TONE.red,
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.45,
        strokes: 8,
        rim: 0.25,
        wobble: 0.6,
        seed: 16350,
      });
      paintShape(g, rectPoints(598, 862, 84, 16), {
        color: S.shadeHex(TONE.red, 0.08),
        lightDir: LIGHT_DIR,
        light: 0.3,
        shadow: 0.4,
        strokes: 6,
        rim: 0.3,
        wobble: 0.4,
        seed: 16351,
      });
      g.fillStyle = P.brass;
      g.fillRect(636, 862, 8, 73);
      for (let i = 0; i < 9; i++) {
        g.strokeStyle = S.rgba(P.brass, 0.85);
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(612 + i * 7, 862);
        g.lineTo(608 + i * 7 + (i % 2) * 5, 852 - (i % 3) * 3);
        g.stroke();
      }
    } else {
      softShadow(g, 650, GROUND + 3, 60, 7, 0.5);
      paintShape(g, [[596, 900], [668, 892], [676, 935], [602, 940]], {
        color: aged(TONE.red, false),
        lightDir: LIGHT_DIR,
        light: 0.2,
        shadow: 0.45,
        strokes: 8,
        rim: 0.18,
        wobble: 0.6,
        seed: 16352,
      });
      g.fillStyle = S.rgba(P.soot, 0.8);
      g.beginPath();
      g.ellipse(673, 914, 6, 20, -0.15, 0, Math.PI * 2);
      g.fill();
      for (const [bx, by, c] of [[700, 928, P.moss], [726, 932, TONE.red], [688, 936, P.brass]]) {
        g.fillStyle = aged(c, false);
        g.beginPath();
        g.arc(bx, by, 7, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.rgba(P.bone, 0.25);
        g.beginPath();
        g.arc(bx - 2, by - 2, 2, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = S.rgba(P.brass, 0.4);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(676, 930);
      for (let i = 1; i < 12; i++) g.lineTo(676 + i * 7, 934 + (i % 2 ? -3 : 3));
      g.stroke();
    }
  }

  // ── Front layer ───────────────────────────────────────────────────────

  // Out of focus in the near corners: a coil of rope and an old lampshade
  // on the left, the legs of a chair turned upside down on the right.
  function paintFront(g, clean) {
    g.save();
    g.filter = 'blur(7px)';
    const dark = S.mixHex(P.soot, P.umber, 0.4);
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(90, 1060, 150, 60, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(150, 1080);
    g.lineTo(190, 960);
    g.lineTo(300, 960);
    g.lineTo(340, 1080);
    g.closePath();
    g.fill();
    g.strokeStyle = S.rgba(clean ? P.oak : P.walnut, 0.6);
    g.lineWidth = 6;
    for (const r of [40, 64, 88]) {
      g.beginPath();
      g.ellipse(90, 1050, r, r * 0.35, 0, Math.PI, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = dark;
    for (const [x, w] of [[1760, 22], [1850, 22]]) g.fillRect(x, 900, w, 180);
    g.fillRect(1740, 990, 180, 26);
    g.fillRect(1740, 1040, 180, 40);
    g.restore();
  }

  function paint(variant) {
    const clean = variant === 'clean';
    const back = S.makeCanvas(1920, 1080);
    const furniture = S.makeCanvas(1920, 1080);
    const front = S.makeCanvas(1920, 1080);
    paintBack(back.getContext('2d'), clean);
    paintFurniture(furniture.getContext('2d'), clean);
    paintFront(front.getContext('2d'), clean);
    return { back, furniture, front };
  }

  // ── Live drawing ──────────────────────────────────────────────────────

  function createLive(seed) {
    return {
      noise: S.createNoise(seed || 1601),
      sprites: new Map(),
    };
  }

  function sprite(live, key, w, h, draw) {
    let c = live.sprites.get(key);
    if (!c) {
      c = S.makeCanvas(w, h);
      draw(c.getContext('2d'));
      live.sprites.set(key, c);
    }
    return c;
  }

  const bossOf = (live) => {
    const b = live.world?.boss;
    return b && b.id === 'spider-queen' ? b : null;
  };
  const makeoverOn = (mk) => (mk.t ?? -1) >= 0 || mk.wipe > 0;

  // The sky through the round window: night with a high moon and torn
  // cloud, then dawn.
  function drawSky(g, live, t, mk) {
    const { cx, cy, hole } = WINDOW;
    const day = S.clamp(mk.window ?? 0, 0, 1);
    g.save();
    const sky = g.createLinearGradient(0, cy - hole, 0, cy + hole);
    sky.addColorStop(0, S.mix(S.moods.dirty.windowSkyTop, S.moods.clean.windowSkyTop, day));
    sky.addColorStop(1, S.mix(S.moods.dirty.windowSkyBottom, S.moods.clean.windowSkyBottom, day));
    g.fillStyle = sky;
    g.fillRect(cx - hole - 70, cy - hole - 10, hole * 2 + 140, hole * 2 + 20);
    if (day < 1) {
      g.fillStyle = `rgba(236,240,248,${0.9 * (1 - day)})`;
      g.beginPath();
      g.arc(cx + 38, cy - 42 + day * 90, 17, 0, Math.PI * 2);
      g.fill();
    }
    if (day > 0) {
      const sun = g.createRadialGradient(cx - 30, cy + 60 - day * 50, 4, cx - 30, cy + 60 - day * 50, 150);
      sun.addColorStop(0, `rgba(255,236,190,${day})`);
      sun.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = sun;
      g.fillRect(cx - hole - 70, cy - hole - 10, hole * 2 + 140, hole * 2 + 20);
    }
    const drift = (t * 4) % 300;
    for (const [ox, oy, rx] of [[-120, 14, 70], [60, 46, 90], [190, -34, 60]]) {
      const x = cx + ((ox + drift + 300) % 420) - 210;
      for (let k = 0; k < 4; k++) {
        g.fillStyle = S.rgba(S.mix('#232B3D', '#F6DDBE', day), 0.08);
        g.beginPath();
        g.ellipse(x + k * 9, cy + oy - k * 2, rx - k * 12, 12 - k * 2, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }

  // Three uneven planks nailed across the window. At `window` they come
  // away one by one, top first, swinging on a last nail and dropping.
  const PLANKS = [
    { y: 196, a: -0.07, len: 276, h: 42, seed: 1 },
    { y: 252, a: 0.045, len: 292, h: 40, seed: 2 },
    { y: 306, a: -0.025, len: 262, h: 44, seed: 3 },
  ];
  function plankSprite(live, p) {
    return sprite(live, `plank${p.seed}`, p.len + 20, p.h + 20, (g) => {
      g.translate(10, 10);
      paintShape(g, rectPoints(0, 0, p.len, p.h), {
        color: S.mixHex(TONE.timberDark, P.taupe, 0.15 * p.seed),
        lightDir: LIGHT_DIR,
        light: 0.3,
        shadow: 0.5,
        strokes: 14,
        strokeAngle: 0,
        strokeJitter: 0.05,
        variance: 0.18,
        rim: 0.3,
        innerShadow: 0.3,
        wobble: 1.2,
        seed: 16400 + p.seed,
      });
      g.strokeStyle = S.rgba(P.soot, 0.4);
      g.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(8, 10 + k * 11);
        g.bezierCurveTo(p.len * 0.3, 6 + k * 12, p.len * 0.6, 16 + k * 10, p.len - 8, 12 + k * 11);
        g.stroke();
      }
      nails(g, [[12, p.h * 0.3], [12, p.h * 0.72], [p.len - 12, p.h * 0.32], [p.len - 12, p.h * 0.7]], false);
    });
  }
  function drawBoards(g, live, mk) {
    const open = S.clamp(mk.windowLight ?? 0, 0, 1);
    if (open >= 1) return;
    PLANKS.forEach((p, i) => {
      const k = S.clamp(open * 3 - i, 0, 1);
      if (k >= 1) return;
      const spr = plankSprite(live, p);
      g.save();
      g.globalAlpha = 1 - k * k;
      const pivotX = WINDOW.cx - p.len / 2 + 12;
      g.translate(pivotX, p.y + k * k * 300);
      g.rotate(p.a + k * 1.1);
      g.drawImage(spr, -22, -p.h / 2 - 10);
      g.restore();
    });
  }

  // The bare bulb on its long cord: it sways, and while the room is dirty
  // its old wiring stutters. At `bulb` it steadies.
  function bulbState(live, t, mk) {
    const steady = S.clamp(mk.bulbSteady ?? 0, 0, 1);
    const sway = Math.sin(t * 1.3) * 7 * (1 - steady) + Math.sin(t * 0.7) * 1.5;
    const flick = S.light.flicker(live.noise, t * 1.4, 2.4);
    return { steady, x: BULB.x + sway, y: BULB.y, power: S.lerp(flick, 1, steady) };
  }
  function drawBulb(g, live, t, mk) {
    const b = bulbState(live, t, mk);
    g.strokeStyle = S.mixHex(P.soot, P.walnut, 0.3);
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(BULB.x, BULB.top);
    g.quadraticCurveTo(BULB.x + (b.x - BULB.x) * 0.4 + 3, (BULB.top + b.y) / 2, b.x, b.y - 18);
    g.stroke();
    // The ceiling rose it hangs from.
    g.fillStyle = S.mixHex(P.taupe, P.soot, 0.4);
    g.beginPath();
    g.ellipse(BULB.x, BULB.top, 9, 5, 0, 0, Math.PI * 2);
    g.fill();
    // Bakelite holder, then the glass.
    g.fillStyle = S.mixHex(P.soot, P.umber, 0.3);
    g.fillRect(b.x - 6, b.y - 20, 12, 13);
    g.fillStyle = S.mixHex(P.brass, P.umber, 0.35);
    g.fillRect(b.x - 5, b.y - 8, 10, 4);
    const lit = 0.35 + 0.65 * b.power;
    const glass = g.createRadialGradient(b.x - 2, b.y + 4, 1, b.x, b.y + 6, 13);
    glass.addColorStop(0, S.rgba('#FFF1D6', lit));
    glass.addColorStop(0.6, S.rgba(P.amber, 0.55 * lit));
    glass.addColorStop(1, S.rgba(P.oak, 0.4));
    g.fillStyle = glass;
    g.beginPath();
    g.ellipse(b.x, b.y + 6, 10, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = S.rgba(P.ember, 0.9 * lit);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(b.x - 3, b.y + 2);
    g.lineTo(b.x - 1, b.y + 7);
    g.lineTo(b.x + 1, b.y + 2);
    g.lineTo(b.x + 3, b.y + 7);
    g.stroke();
  }

  // The Queen's shadow: thrown from the bulb up the gable and the roof,
  // three times her size — drawn small, flattened, and stretched (the
  // stretching softens it).
  const SHADOW_SIZE = 256;
  function drawQueenShadow(g, live, t, mk) {
    const boss = bossOf(live);
    if (!boss || !boss.rig || boss.done) return;
    const b = bulbState(live, t, mk);
    const dx = boss.rig.x - b.x;
    const dy = boss.rig.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d > 900) return;
    if (!live.shadowCanvas) live.shadowCanvas = S.makeCanvas(SHADOW_SIZE, SHADOW_SIZE);
    const s = live.shadowCanvas.getContext('2d');
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    const k0 = 0.22;
    s.setTransform(k0, 0, 0, k0, SHADOW_SIZE / 2 - boss.rig.x * k0, SHADOW_SIZE / 2 - boss.rig.y * k0);
    boss.rig.draw(s);
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = P.soot;
    s.fillRect(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    const k = S.lerp(2.6, 1.7, S.clamp(d / 900, 0, 1));
    const sx = S.clamp(b.x + dx * k * 0.35, 300, 1500);
    const sy = S.clamp(b.y + dy * k * 0.35 - 140, 150, 520);
    const size = (SHADOW_SIZE / k0) * k * 0.62;
    g.save();
    g.globalAlpha = S.lerp(0.78, 0.4, S.clamp(d / 900, 0, 1)) * (boss.alive ? 1 : 1 - S.clamp(boss.deathTimer ?? 0, 0, 1));
    g.drawImage(live.shadowCanvas, sx - size / 2, sy - size / 2, size, size * 0.92);
    g.restore();
  }

  function drawProps(g, live, t, mk) {
    drawQueenShadow(g, live, t, mk);
    drawBoards(g, live, mk);
    drawBulb(g, live, t, mk);
  }

  // The nest: many translucent sheets of silk, denser toward the core, a
  // dark throat at the mouth, egg clusters inside, guy-lines to the rafters.
  const NEST_BOX = { x: 680, y: 30, w: 560, h: 430 };
  function nestOutline() {
    return S.NEST_OUTLINE || [[895, 64], [1025, 64], [1052, 150], [1088, 250], [1124, 338], [1140, 380], [1096, 408], [1030, 420], [960, 424], [890, 420], [824, 408], [780, 380], [796, 338], [832, 250], [868, 150]];
  }
  function nestSprite(live) {
    return sprite(live, 'nest', NEST_BOX.w, NEST_BOX.h, (g) => {
      g.translate(-NEST_BOX.x, -NEST_BOX.y);
      const rng = S.createRng(16500);
      const silk = P.silk;
      const outline = nestOutline();
      // Guy-lines to the rafters and the beam.
      g.strokeStyle = S.rgba(silk, 0.22);
      g.lineWidth = 1;
      for (const [ax, ay, bx, by] of [[880, 120, 720, 190], [1040, 120, 1210, 190], [820, 320, 700, 330], [1100, 320, 1230, 360], [900, 410, 860, 455], [1030, 412, 1080, 455], [960, 70, 940, 34]]) {
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.moveTo(ax + k * 3, ay);
          g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 8, bx + k * 4, by);
          g.stroke();
        }
      }
      // Skirts of silk pulled out to the rafters and the posts: the nest is
      // tied into the roof, not hung in front of it.
      const skirts = [
        [[900, 90], [744, 175], [760, 300], [826, 300]],
        [[1022, 90], [1176, 175], [1164, 300], [1096, 300]],
        [[820, 360], [742, 432], [880, 412]],
        [[1100, 360], [1180, 432], [1040, 414]],
      ];
      skirts.forEach((pts, i) => {
        g.fillStyle = S.rgba(silk, 0.06);
        wobblyPath(g, pts, { wobble: 6, step: 12, seed: 16530 + i });
        g.fill();
        g.strokeStyle = S.rgba(silk, 0.12);
        g.lineWidth = 0.8;
        for (let k = 0; k < 9; k++) {
          const u = k / 8;
          const last = pts[pts.length - 1];
          g.beginPath();
          g.moveTo(S.lerp(pts[0][0], last[0], u * 0.5), S.lerp(pts[0][1], last[1], u * 0.5));
          g.lineTo(S.lerp(pts[1][0], pts[2][0], u), S.lerp(pts[1][1], pts[2][1], u));
          g.stroke();
        }
      });
      // The body: a soft fill clipped to the outline, densest down the middle.
      g.save();
      polyPath(g, outline);
      g.clip();
      const core = g.createLinearGradient(780, 0, 1140, 0);
      core.addColorStop(0, S.rgba(silk, 0.07));
      core.addColorStop(0.5, S.rgba(silk, 0.24));
      core.addColorStop(1, S.rgba(silk, 0.07));
      g.fillStyle = core;
      g.fillRect(760, 40, 400, 400);
      // Egg clusters, half hidden by the sheets laid over them.
      for (const [cx, cy, n] of [[930, 250, 7], [1008, 300, 6], [962, 170, 5], [880, 330, 4]]) {
        for (let i = 0; i < n; i++) {
          const ex = cx + rng.range(-18, 18);
          const ey = cy + rng.range(-14, 14);
          const er = 7 + rng.next() * 5;
          g.fillStyle = S.rgba(P.eggSac, 0.75);
          g.beginPath();
          g.ellipse(ex, ey, er, er * 0.85, rng.next(), 0, Math.PI * 2);
          g.fill();
          g.fillStyle = S.rgba(P.bone, 0.5);
          g.beginPath();
          g.arc(ex - er * 0.3, ey - er * 0.3, er * 0.3, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Sheets: each a translucent curtain from near the top to the mouth.
      for (let i = 0; i < 24; i++) {
        const topX = 905 + rng.range(-10, 110);
        const spread = 0.35 + rng.next() * 0.75;
        const left = S.lerp(topX, 780, spread);
        const right = S.lerp(topX + 30, 1140, spread);
        const hem = 360 + rng.next() * 60;
        const pts = [[topX, 62], [topX + 30, 62], [right, hem + rng.range(-10, 20)], [S.lerp(left, right, 0.66), hem + 26], [S.lerp(left, right, 0.33), hem + 8], [left, hem + rng.range(-10, 20)]];
        g.fillStyle = S.rgba(i % 5 === 0 ? P.soot : silk, i % 5 === 0 ? 0.06 : 0.03 + rng.next() * 0.05);
        wobblyPath(g, pts, { wobble: 6, step: 12, seed: 16510 + i });
        g.fill();
        // The hem of each sheet catches light: that is what shows the layers.
        g.strokeStyle = S.rgba(silk, 0.1 + rng.next() * 0.12);
        g.lineWidth = 1.2;
        g.stroke();
      }
      // Fine strands following the funnel's curve.
      for (let i = 0; i < 80; i++) {
        const u = rng.next();
        const x0 = S.lerp(898, 1022, u);
        const x1 = S.lerp(782, 1138, u);
        g.strokeStyle = S.rgba(silk, 0.08 + rng.next() * 0.2);
        g.lineWidth = 0.5 + rng.next() * 0.8;
        g.beginPath();
        g.moveTo(x0, 64);
        g.quadraticCurveTo(S.lerp(x0, x1, 0.35) + rng.range(-8, 8), 240, x1, 392 + rng.range(-6, 14));
        g.stroke();
      }
      g.restore();
      // The throat: a dark mouth, ringed with a thick lip of silk.
      const throat = g.createRadialGradient(960, 392, 4, 960, 392, 150);
      throat.addColorStop(0, S.rgba(P.soot, 0.95));
      throat.addColorStop(0.7, S.rgba(P.soot, 0.75));
      throat.addColorStop(1, S.rgba(P.soot, 0));
      g.fillStyle = throat;
      wobblyPath(g, ellipsePoints(960, 390, 150, 26, 24), { wobble: 7, step: 10, seed: 16540 });
      g.fill();
      for (let k = 0; k < 6; k++) {
        const pts = [];
        for (let i = 0; i <= 20; i++) {
          const a = 0.05 + (i / 20) * (Math.PI - 0.1);
          const r = 1 + Math.sin(i * 2.7 + k) * 0.05 + rng.range(-0.04, 0.04);
          pts.push([960 + Math.cos(a) * (168 - k * 5) * r, 392 + k * 2 + Math.sin(a) * (30 - k) * r + (i % 3 === 0 ? rng.range(0, 8) : 0)]);
        }
        g.strokeStyle = S.rgba(silk, 0.34 - k * 0.04);
        g.lineWidth = 2.6 - k * 0.3;
        wobblyPath(g, pts, { wobble: 3, step: 8, seed: 16545 + k, closed: false });
        g.stroke();
      }
      // Torn wisps trailing below the lip.
      for (let i = 0; i < 18; i++) {
        const x = 800 + rng.next() * 320;
        const len = 20 + rng.next() * 50;
        g.strokeStyle = S.rgba(silk, 0.18 + rng.next() * 0.2);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, 410);
        g.quadraticCurveTo(x + rng.range(-12, 12), 410 + len * 0.6, x + rng.range(-16, 16), 410 + len);
        g.stroke();
      }
    });
  }

  // How far the nest has come down: 0 whole, 1 gone. It tears when the
  // Queen dies, and is gone for good once the makeover has started.
  function nestCollapse(live, mk) {
    if (makeoverOn(mk)) return 1;
    const boss = bossOf(live);
    if (!boss) return 0;
    return S.clamp(boss.nestCollapseT ?? (boss.nestCollapsed ? 1 : 0), 0, 1);
  }

  function drawNest(g, live, t, mk) {
    const c = nestCollapse(live, mk);
    if (c >= 1) return drawNestTatters(g, live, t, mk);
    const spr = nestSprite(live);
    const sway = Math.sin(t * 0.6) * 0.004;
    if (c <= 0) {
      g.save();
      g.translate(RIDGE.x, RIDGE.y);
      g.rotate(sway);
      g.drawImage(spr, NEST_BOX.x - RIDGE.x, NEST_BOX.y - RIDGE.y);
      g.restore();
      return;
    }
    // The long tear: the two halves part down the middle and sag away.
    const half = NEST_BOX.w / 2;
    const e = S.ease.inOut ? S.ease.inOut(c) : c;
    for (const side of [-1, 1]) {
      g.save();
      g.globalAlpha = Math.pow(1 - c, 1.4);
      const px = RIDGE.x + side * 40;
      g.translate(px, RIDGE.y + 4);
      g.rotate(side * e * 0.55);
      g.translate(0, e * 220);
      const sx = side < 0 ? 0 : half;
      g.drawImage(spr, sx, 0, half, NEST_BOX.h, NEST_BOX.x + sx - px, NEST_BOX.y - RIDGE.y - 4, half, NEST_BOX.h * (1 + e * 0.5));
      g.restore();
    }
    drawNestTatters(g, live, t, mk, c);
  }

  // What stays after the tear: rags of silk hanging from the ridge, gone
  // when the sweep passes.
  function drawNestTatters(g, live, t, mk, grow = 1) {
    if (sweptPast(mk, RIDGE.x)) return;
    const rng = S.createRng(16520);
    for (let i = 0; i < 9; i++) {
      const x = 890 + rng.next() * 140;
      const len = (60 + rng.next() * 130) * grow;
      const sway = Math.sin(t * 0.9 + i) * 6;
      g.strokeStyle = S.rgba(P.silk, 0.18 + rng.next() * 0.16);
      g.lineWidth = 1.2 + rng.next() * 2;
      g.beginPath();
      g.moveTo(x, RIDGE.y + 6);
      g.quadraticCurveTo(x + sway * 0.5, RIDGE.y + len * 0.5, x + sway, RIDGE.y + len);
      g.stroke();
    }
  }

  // The torch. In the nest's wall from the start, a glint of metal under
  // the silk; on the floor below once the nest comes down; on the upper
  // trunk in the clean room, its engraving readable up close.
  function drawTorchAt(g, x, y, angle, clean) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    const steel = clean ? S.mixHex(P.gear, P.bone, 0.35) : S.mixHex(P.gear, P.taupe, 0.3);
    const body = g.createLinearGradient(0, -8, 0, 8);
    body.addColorStop(0, S.shadeHex(steel, 0.35));
    body.addColorStop(0.45, steel);
    body.addColorStop(1, S.shadeHex(steel, -0.45));
    g.fillStyle = body;
    g.beginPath();
    g.roundRect ? g.roundRect(-34, -7, 54, 14, 4) : g.rect(-34, -7, 54, 14);
    g.fill();
    // The head: wider, a brass bezel round the lens.
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(20, -7);
    g.lineTo(32, -11);
    g.lineTo(38, -11);
    g.lineTo(38, 11);
    g.lineTo(32, 11);
    g.lineTo(20, 7);
    g.closePath();
    g.fill();
    g.fillStyle = clean ? P.brass : S.mixHex(P.brass, P.umber, 0.4);
    g.fillRect(36, -11, 4, 22);
    g.fillStyle = S.rgba(P.bone, clean ? 0.6 : 0.3);
    g.fillRect(40, -9, 2, 18);
    // Ribbed grip and the switch.
    g.strokeStyle = S.rgba(P.soot, 0.45);
    g.lineWidth = 1;
    for (let k = -30; k < -12; k += 3) {
      g.beginPath();
      g.moveTo(k, -6);
      g.lineTo(k, 6);
      g.stroke();
    }
    g.fillStyle = S.mixHex(P.soot, P.rust, 0.3);
    g.fillRect(4, -9, 8, 3);
    // The engraving.
    g.font = '600 7px Georgia, serif';
    g.textAlign = 'center';
    g.fillStyle = S.rgba(P.soot, clean ? 0.85 : 0.5);
    g.fillText('A. Ashworth', -6, 2.6);
    g.restore();
  }

  // Where the torch is: in the nest wall; falling or on the floor once the
  // nest is down; on the upper trunk once the dust sheets are off.
  function torchSpot(live, mk, t) {
    if ((mk.sheetsOff ?? 0) >= 0.6) return { x: 312, y: 693, a: -0.04, clean: true, glint: [352, 690] };
    const boss = bossOf(live);
    if (makeoverOn(mk) || (boss && boss.torchDropped)) {
      const ty = makeoverOn(mk) ? GROUND : Math.min(boss.torchY ?? GROUND, GROUND);
      const landed = ty >= GROUND - 1;
      return { x: 960, y: ty - 4, a: landed ? 0.12 : (t * 7) % (Math.PI * 2), landed, glint: landed ? [998, 935] : null };
    }
    return { x: 984, y: 318, a: 0.95, inNest: true, glint: [1006, 349] };
  }

  function drawTorch(g, live, t, mk) {
    const spot = torchSpot(live, mk, t);
    if (spot.clean) {
      softShadow(g, 312, 701, 44, 4, 0.5);
      drawTorchAt(g, spot.x, spot.y, spot.a, true);
      return;
    }
    if (!spot.inNest) {
      if (spot.landed) softShadow(g, 960, GROUND + 4, 40, 4, 0.5);
      drawTorchAt(g, spot.x, spot.y, spot.a, false);
      return;
    }
    // Dirty: wrapped into the nest's wall, a few strands across it.
    g.save();
    g.globalAlpha = 0.42;
    drawTorchAt(g, spot.x, spot.y, spot.a, false);
    g.restore();
    g.strokeStyle = S.rgba(P.silk, 0.35);
    g.lineWidth = 1.2;
    for (let k = 0; k < 8; k++) {
      g.beginPath();
      g.moveTo(958 + k * 6, 290 + k * 4);
      g.quadraticCurveTo(990, 318 + k * 3, 1012 - k * 3, 346 + k * 2);
      g.stroke();
    }
  }

  // The rocking horse, dirty and clean, drawn live so it can rock once when
  // its sheet comes off.
  const HORSE_BOX = { x: 1440, y: 650, w: 320, h: 300 };
  function horseSprite(live, clean) {
    return sprite(live, clean ? 'horse-clean' : 'horse-dirty', HORSE_BOX.w, HORSE_BOX.h, (g) => {
      g.translate(-HORSE_BOX.x, -HORSE_BOX.y);
      const coat = aged(TONE.horse, clean, 1.3);
      const wood = aged(S.mixHex(P.oak, P.rust, 0.3), clean);
      // Bow rockers.
      g.strokeStyle = wood;
      g.lineWidth = 10;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(1590, 610, 330, Math.PI * 0.32, Math.PI * 0.68);
      g.stroke();
      g.strokeStyle = S.rgba(P.soot, 0.4);
      g.lineWidth = 3;
      g.beginPath();
      g.arc(1590, 614, 330, Math.PI * 0.33, Math.PI * 0.67);
      g.stroke();
      // Legs splayed to the rockers.
      for (const [hx, fx] of [[1530, 1500], [1556, 1546], [1636, 1640], [1660, 1690]]) {
        paintShape(g, [[hx - 7, 840], [hx + 7, 840], [fx + 6, 922], [fx - 6, 922]], {
          color: coat,
          lightDir: LIGHT_DIR,
          light: 0.2,
          shadow: 0.45,
          strokes: 6,
          rim: 0.15,
          innerShadow: 0.2,
          wobble: 0.5,
          seed: 16600 + hx,
        });
        g.fillStyle = S.mixHex(P.soot, P.walnut, 0.3);
        g.fillRect(fx - 7, 914, 14, 8);
      }
      // Body, neck and head.
      const body = [[1518, 806], [1560, 792], [1650, 792], [1690, 804], [1696, 832], [1660, 852], [1540, 852], [1514, 834]];
      paintShape(g, body, {
        color: coat,
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.45,
        strokes: 10,
        strokeAngle: 0,
        rim: 0.25,
        innerShadow: 0.3,
        wobble: 0.8,
        seed: 16610,
      });
      const neck = [[1522, 812], [1500, 760], [1494, 722], [1506, 704], [1530, 708], [1546, 744], [1556, 796]];
      paintShape(g, neck, {
        color: coat,
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.4,
        strokes: 8,
        strokeAngle: -1.2,
        rim: 0.25,
        innerShadow: 0.25,
        wobble: 0.6,
        seed: 16611,
      });
      const head = [[1506, 704], [1470, 716], [1460, 738], [1472, 748], [1500, 742], [1518, 728]];
      paintShape(g, head, {
        color: coat,
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.4,
        strokes: 6,
        rim: 0.3,
        innerShadow: 0.2,
        wobble: 0.5,
        seed: 16612,
      });
      // Dapples.
      const rng = S.createRng(clean ? 16620 : 16621);
      for (let i = 0; i < 26; i++) {
        const x = 1526 + rng.next() * 160;
        const y = 798 + rng.next() * 48;
        g.fillStyle = S.rgba(S.shadeHex(coat, -0.35), 0.35);
        g.beginPath();
        g.ellipse(x, y, 4 + rng.next() * 5, 3 + rng.next() * 3, rng.next(), 0, Math.PI * 2);
        g.fill();
      }
      // Mane, tail, ear, eye, saddle and bridle.
      g.strokeStyle = S.mixHex(P.soot, P.walnut, 0.4);
      g.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        g.moveTo(1512 + i * 4, 706 + i * 9);
        g.quadraticCurveTo(1528 + i * 4, 712 + i * 9, 1534 + i * 4, 724 + i * 9);
        g.stroke();
      }
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(1692, 812);
        g.quadraticCurveTo(1716, 826 + i * 4, 1712 + i * 2, 870 + i * 5);
        g.stroke();
      }
      g.fillStyle = coat;
      g.beginPath();
      g.moveTo(1508, 706);
      g.lineTo(1512, 684);
      g.lineTo(1520, 704);
      g.closePath();
      g.fill();
      g.fillStyle = P.soot;
      g.beginPath();
      g.arc(1488, 722, 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = aged(TONE.red, clean, 1.4);
      g.beginPath();
      g.ellipse(1600, 798, 34, 10, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(1592, 798, 16, 34);
      g.strokeStyle = aged(TONE.red, clean, 1.4);
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(1470, 732);
      g.lineTo(1506, 722);
      g.lineTo(1530, 740);
      g.stroke();
      if (!clean) {
        // Chipped paint and dust.
        g.fillStyle = S.rgba(P.linen, 0.18);
        g.fillRect(1514, 790, 186, 10);
        for (let i = 0; i < 10; i++) {
          g.fillStyle = S.rgba(wood, 0.6);
          g.beginPath();
          g.arc(1520 + rng.next() * 170, 800 + rng.next() * 50, 2 + rng.next() * 3, 0, Math.PI * 2);
          g.fill();
        }
      }
    });
  }

  // The dust sheets: one over the horse, its ear poking out; one over the
  // trunks. At `sheets` they slide off.
  function horseSheetSprite(live) {
    return sprite(live, 'sheet-horse', 340, 320, (g) => {
      g.translate(-1430, -650);
      const pts = [[1462, 932], [1470, 860], [1478, 760], [1490, 712], [1506, 702], [1526, 712], [1546, 760], [1586, 784], [1660, 784], [1706, 806], [1722, 860], [1730, 934], [1690, 926], [1640, 936], [1590, 926], [1540, 938], [1500, 926]];
      paintShape(g, pts, {
        color: TONE.sheet,
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.5,
        strokes: 26,
        strokeAngle: 1.1,
        strokeJitter: 0.25,
        variance: 0.14,
        rim: 0.22,
        innerShadow: 0.4,
        wobble: 2.2,
        seed: 16700,
      });
      // Folds.
      g.strokeStyle = S.rgba(P.soot, 0.25);
      g.lineWidth = 3;
      for (const [ax, ay, bx, by] of [[1560, 790, 1530, 930], [1620, 790, 1610, 928], [1676, 798, 1700, 930], [1500, 760, 1484, 920]]) {
        g.beginPath();
        g.moveTo(ax, ay);
        g.quadraticCurveTo((ax + bx) / 2 + 12, (ay + by) / 2, bx, by);
        g.stroke();
      }
      g.fillStyle = S.rgba(P.linen, 0.12);
      g.fillRect(1480, 780, 230, 10);
      // The ear, poking through a moth hole.
      g.fillStyle = aged(TONE.horse, false, 1.3);
      g.beginPath();
      g.moveTo(1504, 704);
      g.lineTo(1510, 682);
      g.lineTo(1518, 702);
      g.closePath();
      g.fill();
    });
  }
  function trunkSheetSprite(live) {
    return sprite(live, 'sheet-trunks', 300, 220, (g) => {
      g.translate(-180, -680);
      const pts = [[214, 704], [270, 694], [340, 696], [426, 706], [440, 760], [432, 836], [404, 842], [392, 800], [360, 790], [300, 798], [250, 812], [218, 852], [196, 846], [204, 772]];
      paintShape(g, pts, {
        color: S.shadeHex(TONE.sheet, -0.06),
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.5,
        strokes: 26,
        strokeAngle: 1.3,
        strokeJitter: 0.25,
        rim: 0.22,
        innerShadow: 0.35,
        wobble: 2.2,
        seed: 16710,
      });
      g.strokeStyle = S.rgba(P.soot, 0.25);
      g.lineWidth = 3;
      for (const [ax, bx] of [[260, 236], [330, 318], [400, 412]]) {
        g.beginPath();
        g.moveTo(ax, 704);
        g.quadraticCurveTo(ax + 10, 760, bx, 830);
        g.stroke();
      }
    });
  }

  function horseRock(mk) {
    const t = (mk.t ?? -1) - 4.4;
    if (t <= 0) return 0;
    return 0.055 * Math.sin(t * 3.9) * Math.exp(-t * 0.9);
  }

  function drawHorse(g, live, mk) {
    const clean = sweptPast(mk, 1590);
    const spr = horseSprite(live, clean);
    const a = horseRock(mk);
    g.save();
    g.translate(HORSE.pivot[0], HORSE.pivot[1]);
    g.rotate(a);
    g.translate(-HORSE.pivot[0], -HORSE.pivot[1]);
    softShadow(g, 1590, GROUND + 2, 120, 8, 0.45);
    g.drawImage(spr, HORSE_BOX.x, HORSE_BOX.y);
    g.restore();
  }

  function drawSheets(g, live, mk) {
    const off = S.clamp(mk.sheetsOff ?? 0, 0, 1);
    if (off >= 1) return;
    const e = off * off;
    g.save();
    g.globalAlpha = 1 - e;
    g.drawImage(horseSheetSprite(live), 1430 + e * 70, 650 + e * 160);
    g.restore();
    g.save();
    g.globalAlpha = 1 - e;
    g.translate(e * -60, e * 150);
    g.drawImage(trunkSheetSprite(live), 180, 680);
    g.restore();
  }

  function drawOnFurniture(g, live, t, mk) {
    drawNest(g, live, t, mk);
    drawHorse(g, live, mk);
    drawSheets(g, live, mk);
    drawTorch(g, live, t, mk);
  }

  // ── Light ─────────────────────────────────────────────────────────────

  // The shafts through the boards: blades of moonlight between the planks
  // while dirty; once the boards are gone, one round shaft of morning.
  // Each blade: where it leaves a gap between the planks, and where it
  // lands. Narrow, slanting down and to the left (the moon is high, right).
  const BLADES = [
    { x: 912, y: 224, w: 7, to: [690, 760], end: 34 },
    { x: 978, y: 222, w: 9, to: [770, 900], end: 44 },
    { x: 1030, y: 225, w: 6, to: [860, 820], end: 30 },
    { x: 930, y: 279, w: 8, to: [700, 1000], end: 40 },
    { x: 1004, y: 281, w: 6, to: [820, 1040], end: 30 },
  ];
  function bladeQuad(b) {
    return [[b.x - b.w / 2, b.y], [b.x + b.w / 2, b.y], [b.to[0] + b.end / 2, b.to[1]], [b.to[0] - b.end / 2, b.to[1]]];
  }
  function fillBlade(g, b, hex, alpha) {
    const grad = g.createLinearGradient(b.x, b.y, b.to[0], b.to[1]);
    grad.addColorStop(0, S.rgba(hex, alpha));
    grad.addColorStop(0.6, S.rgba(hex, alpha * 0.4));
    grad.addColorStop(1, S.rgba(hex, 0));
    g.fillStyle = grad;
    polyPath(g, bladeQuad(b));
    g.fill();
  }
  function dawnQuad() {
    return [[868, 210], [1052, 210], [1420, 1060], [560, 1060]];
  }

  function lights(lm, live, t, mk) {
    const b = bulbState(live, t, mk);
    const bulbHex = S.mixHex(P.amber, P.dawn, b.steady * 0.6);
    lm.point(b.x, b.y + 8, S.lerp(420, 520, b.steady), bulbHex, (0.55 + 0.2 * b.steady) * b.power);
    lm.cone(b.x, b.y + 12, Math.PI / 2, 2.4, 560, bulbHex, 0.4 * b.power);
    // The nest's underside, lit by the bulb.
    lm.point(900, 410, 160, bulbHex, 0.18 * b.power);

    const open = S.clamp(mk.windowLight ?? 0, 0, 1);
    const blades = 1 - open;
    if (blades > 0) {
      for (const b of BLADES) {
        fillBlade(lm.ctx, b, P.moon, 0.32 * blades);
        lm.lights.push({ kind: 'shaft', quad: bladeQuad(b), intensity: 0.3 * blades });
      }
    }
    lm.point(WINDOW.cx, WINDOW.cy, 200, P.moon, 0.18 * (1 - open) + 0.08);
    if (open > 0) {
      lm.point(WINDOW.cx, WINDOW.cy, 360, P.dawn, 0.75 * open);
      lm.shaft(dawnQuad(), P.dawn, 0.85 * open);
    }
    // Warm light up through the hatch from the hallway below.
    lm.point(1820, 945, 230, P.amber, 0.5);
    lm.cone(1820, 950, -Math.PI / 2, 1.2, 320, P.amber, 0.3);
    return b.power;
  }

  function glow(g, lm, live, t, mk) {
    const b = bulbState(live, t, mk);
    S.light.glow(g, b.x, b.y + 6, 70, S.mixHex(P.amber, P.dawn, b.steady * 0.5), 0.75 * b.power);
    S.light.glow(g, b.x, b.y + 6, 18, '#FFF3DC', 0.6 * b.power);

    const open = S.clamp(mk.windowLight ?? 0, 0, 1);
    const blades = 1 - open;
    if (blades > 0) {
      g.save();
      g.globalCompositeOperation = 'screen';
      for (const b of BLADES) fillBlade(g, b, P.moon, 0.2 * blades);
      g.restore();
    }
    S.light.glow(g, WINDOW.cx, WINDOW.cy, 170, open > 0.5 ? P.dawn : P.moon, 0.08 + 0.3 * open);
    if (open > 0) S.light.beam(g, dawnQuad(), P.dawn, 0.4 * open);

    // The nest glows from behind with whatever leaks through the window.
    const c = nestCollapse(live, mk);
    if (c < 1) {
      S.light.glow(g, 960, 240, 190, P.moon, 0.09 * (1 - c));
      const rng = S.createRng(16800);
      for (let i = 0; i < 7; i++) {
        const x = 900 + rng.next() * 120;
        const y = 160 + rng.next() * 180;
        const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + rng.next() * 2) + i);
        S.light.glow(g, x, y, 10, P.silk, 0.22 * tw * (1 - c));
      }
    }
    // The torch's glint, and the tinsel's once clean.
    const spot = torchSpot(live, mk, t);
    if (spot.glint) {
      const strength = spot.clean ? 0.35 : spot.inNest ? 0.22 * (1 - c) : 0.25;
      S.light.glow(g, spot.glint[0], spot.glint[1], spot.clean ? 14 : 10, P.bone, strength * (0.75 + 0.25 * Math.sin(t * 1.8)));
    }
    if (sweptPast(mk, 640)) {
      for (let i = 0; i < 4; i++) S.light.glow(g, 614 + i * 16, 856 - (i % 2) * 6, 9, P.dawn, 0.35 * (0.5 + 0.5 * Math.sin(t * 3 + i * 1.7)));
    }
    S.light.glow(g, 1820, 935, 90, P.amber, 0.22);
    void lm;
  }

  function beat() {}

  S.rooms.attachArt('attic', {
    paint,
    createLive,
    drawSky,
    drawProps,
    drawOnFurniture,
    lights,
    glow,
    beat,
  });
})();
