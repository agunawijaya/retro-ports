/*
 * Spyder — Room 8, the Master Bedroom: painting, light and glow.
 *
 * The logic is in room.js (layout, the bouncy bed, the wardrobe nest, the
 * extra goal). This file paints, and reads the state room.js keeps on
 * `live` (`doorsOpen`, `nestHits`/`nestTorn`, `nestDestroyed`, `quiltDent`,
 * `quiltDentX`) and the makeover values on `mk` (`lights`, `photo`,
 * `radio`).
 *
 * The parents' room, shut for fifteen years: a big bed under the window,
 * lace curtains that print their pattern in moonlight across the quilt, a
 * dark wardrobe in the corner where the spiders live, and a dressing table
 * with a ring of bulbs round its mirror.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const { paintShape, wobblyPath, rectPoints, roundedRectPoints, ellipsePoints, softShadow, stain } = S.paint;

  // ── Layout (must match room.js) ───────────────────────────────────────

  const CEILING = 110;
  const PICTURE_RAIL = 170;
  const FLOOR_LINE = 770;
  const WARDROBE = { x0: 120, x1: 380, y0: 260, y1: 850 };
  const WR_DOORS = { y0: 330, y1: 790 }; // the door opening, under the cornice
  const LEFT_STAND = { x0: 430, x1: 530, top: 790, base: 905 };
  const RIGHT_STAND = { x0: 1200, x1: 1290, top: 790, base: 905 };
  const BED = { head0: 540, head1: 590, headTop: 520, x0: 560, x1: 1180, top: 780, foot: 1170, footTop: 690, base: 912 };
  const WINDOW = { x: 760, y: 180, w: 240, h: 290 };
  const SHELF = { x0: 700, x1: 1050, y: 520 };
  const TABLE = { x0: 1360, x1: 1600, top: 760, base: 912 };
  const MIRROR = { y0: 420, y1: 700 };
  const CHEST = { x0: 1640, x1: 1820, top: 800, base: 912 };
  const LIGHT_DIR = { x: 0.35, y: -0.94 }; // lamps low, the window high

  const TONE = {
    paper: S.mixHex(P.taupe, P.linen, 0.42),
    paperDirty: S.mixHex(S.mixHex(P.taupe, P.linen, 0.25), P.umber, 0.18),
    rose: S.mixHex(P.plum, P.rust, 0.35),
    trellis: S.mixHex(P.moss, P.taupe, 0.4),
    wood: S.mixHex(P.walnut, P.umber, 0.25),
    woodLight: S.mixHex(P.walnut, P.oak, 0.5),
    quiltRose: S.mixHex(P.plum, P.linen, 0.3),
    quiltSage: S.mixHex(P.moss, P.linen, 0.38),
    quiltCream: S.mixHex(P.linen, P.taupe, 0.2),
    quiltRust: S.mixHex(P.rust, P.linen, 0.25),
    sheet: S.mixHex(P.taupe, P.linen, 0.45),
    brass: P.brass,
  };

  const aged = (hex, clean, k = 1) => (clean ? hex : S.mixHex(S.shadeHex(hex, -0.18 * k), P.taupe, 0.22 * k));

  // What room.js keeps on `live`, read in one place so a rename is one edit.
  const nestState = (live) => ({
    open: S.clamp(live.doorsOpen ?? 0, 0, 1),
    torn: S.clamp(live.nestTorn ?? (live.nestHits ?? 0) / 8, 0, 1),
    destroyed: Boolean(live.nestDestroyed),
  });
  // The quilt's dent after a bounce: depth 1 at the landing, recovering to 0.
  const bedDent = (live) => (live.quiltDent > 0.01 ? { x: live.quiltDentX ?? 870, depth: live.quiltDent } : null);

  // ── Back layer ────────────────────────────────────────────────────────

  function paintBack(g, clean) {
    paintCeiling(g, clean);
    paintWallpaper(g, clean);
    paintWindowFrame(g, clean);
    paintLace(g, clean);
    paintShelfBracketsShadow(g, clean);
    paintSkirting(g, clean);
    paintFloor(g, clean);
    paintRug(g, clean);
  }

  function paintCeiling(g, clean) {
    paintShape(g, rectPoints(0, 0, 1920, CEILING + 2), {
      color: clean ? S.mixHex(P.linen, P.taupe, 0.5) : S.mixHex(P.umber, P.taupe, 0.2),
      lightDir: { x: 0, y: 1 },
      light: 0.15,
      shadow: 0.45,
      strokes: 6,
      strokeAngle: 0,
      rim: 0,
      wobble: 0,
      seed: 8001,
    });
    // Coving: a quarter-round that turns from shadow into light, and an egg
    // and dart moulding under it.
    const cove = g.createLinearGradient(0, CEILING - 34, 0, CEILING);
    const base = clean ? S.mixHex(P.linen, P.taupe, 0.35) : S.mixHex(P.taupe, P.umber, 0.35);
    cove.addColorStop(0, S.shadeHex(base, -0.3));
    cove.addColorStop(0.6, base);
    cove.addColorStop(1, S.shadeHex(base, 0.12));
    g.fillStyle = cove;
    g.fillRect(0, CEILING - 34, 1920, 34);
    for (let x = 6; x < 1920; x += 22) {
      g.fillStyle = S.rgba(P.soot, 0.25);
      g.beginPath();
      g.ellipse(x, CEILING + 5, 6, 4, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.rgba(S.shadeHex(base, 0.25), 0.6);
      g.beginPath();
      g.ellipse(x - 1, CEILING + 4, 4.5, 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = S.rgba(P.soot, 0.35);
    g.fillRect(0, CEILING + 10, 1920, 3);
    // A plaster ceiling rose, the light flex long gone.
    const rose = clean ? S.mixHex(P.linen, P.bone, 0.3) : S.mixHex(P.taupe, P.linen, 0.3);
    paintShape(g, ellipsePoints(960, 40, 70, 18), {
      color: rose,
      lightDir: { x: 0, y: 1 },
      light: 0.2,
      shadow: 0.4,
      strokes: 4,
      rim: 0.2,
      wobble: 0.6,
      seed: 8002,
    });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillStyle = S.rgba(P.soot, 0.22);
      g.beginPath();
      g.ellipse(960 + Math.cos(a) * 48, 40 + Math.sin(a) * 12, 9, 3, a, 0, Math.PI * 2);
      g.fill();
    }
    if (!clean) {
      stain(g, 1380, 60, 90, P.oak, 8003, 0.3);
      stain(g, 300, 40, 60, P.oak, 8004, 0.22);
      g.strokeStyle = S.rgba(P.soot, 0.55);
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(1180, 20);
      g.lineTo(1250, 48);
      g.lineTo(1300, 44);
      g.lineTo(1420, 86);
      g.stroke();
    }
  }

  // Muted roses climbing a trellis over warm taupe: diagonal laths crossing
  // in diamonds, a small rose and two leaves at every other crossing.
  function paintWallpaper(g, clean) {
    paintShape(g, rectPoints(0, CEILING + 12, 1920, FLOOR_LINE - CEILING - 8), {
      color: clean ? TONE.paper : TONE.paperDirty,
      lightDir: LIGHT_DIR,
      light: 0.1,
      shadow: 0.3,
      strokes: 9,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.12,
      variance: 0.07,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 8010,
    });
    const a = clean ? 0.24 : 0.16;
    const cell = 64;
    g.save();
    g.beginPath();
    g.rect(0, CEILING + 12, 1920, FLOOR_LINE - CEILING - 12);
    g.clip();
    g.strokeStyle = S.rgba(TONE.trellis, a);
    g.lineWidth = 2;
    for (let k = -1200; k < 2400; k += cell) {
      g.beginPath();
      g.moveTo(k, CEILING);
      g.lineTo(k + 700, FLOOR_LINE + 30);
      g.stroke();
      g.beginPath();
      g.moveTo(k + 700, CEILING);
      g.lineTo(k, FLOOR_LINE + 30);
      g.stroke();
    }
    // Crossings fall every cell/2 in x along rows that are cell/2 · (660/700)
    // apart; place a rose on alternate crossings.
    const dy = (cell / 2) * ((FLOOR_LINE + 30 - CEILING) / 700);
    const rng = S.createRng(8011);
    for (let row = 0, y = CEILING; y < FLOOR_LINE + 20; row++, y += dy) {
      for (let x = (row % 2) * (cell / 2) - 1200 + ((y - CEILING) / ((FLOOR_LINE + 30 - CEILING) / 700)) % cell; x < 1960; x += cell) {
        if (x < -20 || (row + Math.round(x / cell)) % 2) continue;
        const r = 6 + rng.range(-1, 1);
        g.fillStyle = S.rgba(TONE.trellis, a * 1.2);
        for (const s of [-1, 1]) {
          g.beginPath();
          g.ellipse(x + s * 9, y + 4, 6, 2.6, s * 0.6, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = S.rgba(TONE.rose, a * 1.5);
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = S.rgba(S.shadeHex(TONE.rose, -0.3), a * 1.4);
        g.lineWidth = 1;
        g.beginPath();
        g.arc(x - 0.5, y - 0.5, r * 0.55, 0.3, 4.6);
        g.stroke();
      }
    }
    g.restore();
    // Picture rail, with two empty hooks and the paler squares of pictures
    // that were taken down.
    paintShape(g, rectPoints(0, PICTURE_RAIL - 5, 1920, 10), {
      color: aged(TONE.woodLight, clean),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.4,
      strokes: 4,
      rim: 0.3,
      wobble: 0,
      seed: 8012,
    });
    for (const [x, w, h] of [[1700, 120, 150], [480, 70, 90]]) {
      g.fillStyle = S.rgba(P.bone, clean ? 0.05 : 0.08);
      g.fillRect(x, 230, w, h);
      g.strokeStyle = S.rgba(P.brass, 0.5);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x + w / 2, PICTURE_RAIL + 2);
      g.lineTo(x + w / 2 - 22, 228);
      g.moveTo(x + w / 2, PICTURE_RAIL + 2);
      g.lineTo(x + w / 2 + 22, 228);
      g.stroke();
    }
    if (!clean) {
      for (const [x, y, r, seed] of [[420, 300, 90, 8013], [1250, 240, 110, 8014], [1880, 420, 80, 8015], [620, 650, 70, 8016]]) {
        stain(g, x, y, r, P.oak, seed, 0.26);
      }
      // Water came in round the window frame and ran down the paper.
      for (const [x, len] of [[770, 230], [994, 300], [1006, 180]]) {
        const run = g.createLinearGradient(0, WINDOW.y + WINDOW.h, 0, WINDOW.y + WINDOW.h + len);
        run.addColorStop(0, S.rgba(P.oak, 0.32));
        run.addColorStop(1, S.rgba(P.oak, 0));
        g.fillStyle = run;
        g.fillRect(x - 6, WINDOW.y + WINDOW.h, 12, len);
      }
      paintTear(g);
    }
  }

  // A long tear in the paper by the window, the bare plaster showing and the
  // flap folded back on itself.
  function paintTear(g) {
    const x = 1036;
    const top = 210;
    const bottom = 590;
    const edge = [];
    const rng = S.createRng(8017);
    for (let y = top; y <= bottom; y += 18) edge.push([x + rng.range(-4, 4) + (y - top) * 0.04, y]);
    const right = edge.map(([ex, ey], i) => [ex + 20 + Math.sin(i * 0.9) * 6 + (ey - top) * 0.06, ey]).reverse();
    g.fillStyle = S.mixHex(P.taupe, P.linen, 0.5);
    g.beginPath();
    g.moveTo(edge[0][0], edge[0][1]);
    for (const p of edge) g.lineTo(p[0], p[1]);
    for (const p of right) g.lineTo(p[0], p[1]);
    g.closePath();
    g.fill();
    g.strokeStyle = S.rgba(P.soot, 0.35);
    g.lineWidth = 1.2;
    g.stroke();
    // The flap, its pale back showing, curling forward from the right edge.
    const flap = [[right[right.length - 1][0], top], [right[0][0] + 4, bottom - 40], [right[0][0] + 26, bottom - 10], [right[right.length - 1][0] + 30, top + 40]];
    softShadow(g, right[0][0] + 22, (top + bottom) / 2, 18, 160, 0.25);
    paintShape(g, flap, {
      color: S.mixHex(P.linen, P.bone, 0.25),
      lightDir: { x: -0.6, y: -0.8 },
      light: 0.2,
      shadow: 0.4,
      strokes: 3,
      rim: 0.2,
      wobble: 1.2,
      seed: 8018,
    });
  }

  // The window frame: a deep reveal, a sash with glazing bars, a sill. The
  // glass is left open so drawSky shows through.
  function paintWindowFrame(g, clean) {
    const { x, y, w, h } = WINDOW;
    const wood = clean ? S.mixHex(P.linen, P.bone, 0.3) : S.mixHex(P.linen, P.taupe, 0.45);
    paintShape(g, rectPoints(x - 24, y - 22, w + 48, h + 44), {
      color: wood,
      lightDir: LIGHT_DIR,
      light: 0.2,
      shadow: 0.4,
      strokes: 4,
      rim: 0.3,
      wobble: 0.5,
      seed: 8020,
    });
    // Reveal: the depth of the wall around the glass.
    g.fillStyle = S.rgba(P.soot, 0.35);
    g.fillRect(x - 6, y - 6, w + 12, 6);
    g.fillRect(x - 6, y - 6, 6, h + 12);
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(x, y, w, h);
    g.restore();
    // Glazing bars: a meeting rail and two uprights per sash.
    g.fillStyle = S.shadeHex(wood, -0.08);
    g.fillRect(x, y + h / 2 - 6, w, 12);
    for (const bx of [x + w / 3 - 3, x + (w * 2) / 3 - 3]) g.fillRect(bx, y, 6, h);
    g.fillStyle = S.rgba(P.soot, 0.3);
    g.fillRect(x, y + h / 2 + 6, w, 2);
    if (!clean) {
      // A cracked pane in the upper left.
      g.strokeStyle = S.rgba(P.bone, 0.45);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 14, y + 20);
      g.lineTo(x + 40, y + 52);
      g.lineTo(x + 36, y + 80);
      g.moveTo(x + 40, y + 52);
      g.lineTo(x + 70, y + 60);
      g.stroke();
    }
    // Sill.
    paintShape(g, rectPoints(x - 34, y + h + 12, w + 68, 16), {
      color: wood,
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.45,
      strokes: 3,
      rim: 0.35,
      wobble: 0.3,
      seed: 8021,
    });
    softShadow(g, x + w / 2, y + h + 34, w * 0.6, 8, 0.3);
    // Curtain pole with finials.
    g.fillStyle = aged(TONE.brass, clean);
    g.fillRect(x - 70, y - 44, w + 140, 7);
    for (const fx of [x - 74, x + w + 74]) {
      g.beginPath();
      g.arc(fx, y - 40, 9, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Lace: two panels drawn over the open glass at partial opacity, so the
  // sky reads through the fabric, with a woven motif of rosettes and a
  // scalloped hem. Dirty, the lace is grey and the right panel is torn.
  function paintLace(g, clean) {
    const { x, y, w, h } = WINDOW;
    const top = y - 38;
    const bottom = y + h + 6;
    const panels = [
      { x0: x - 40, x1: x + w * 0.52, seed: 8030 },
      { x0: x + w * 0.48, x1: x + w + 40, seed: 8031 },
    ];
    const thread = clean ? P.bone : S.mixHex(P.linen, P.taupe, 0.45);
    for (const [pi, pnl] of panels.entries()) {
      g.save();
      const path = new Path2D();
      const rng = S.createRng(pnl.seed);
      path.moveTo(pnl.x0, top);
      path.lineTo(pnl.x1, top);
      // Scalloped hem.
      const scallops = 7;
      for (let i = scallops; i >= 0; i--) {
        const sx = S.lerp(pnl.x0, pnl.x1, i / scallops);
        const sy = bottom + (i % 2 ? 0 : 6);
        path.lineTo(sx, sy);
      }
      path.closePath();
      g.clip(path);
      if (!clean && pi === 1) {
        // The torn panel: a ragged hole where it caught and ripped.
        const hole = new Path2D();
        hole.moveTo(x + w * 0.66, y + 150);
        hole.lineTo(x + w * 0.86, y + 132);
        hole.lineTo(x + w * 0.95, y + 210);
        hole.lineTo(x + w * 0.8, y + 270);
        hole.lineTo(x + w * 0.7, y + 230);
        hole.closePath();
        const outer = new Path2D();
        outer.rect(pnl.x0 - 10, top - 10, pnl.x1 - pnl.x0 + 20, bottom - top + 30);
        outer.addPath(hole);
        g.clip(outer, 'evenodd');
      }
      // The net itself, thin enough to see the sky.
      g.fillStyle = S.rgba(thread, clean ? 0.32 : 0.36);
      g.fillRect(pnl.x0 - 10, top, pnl.x1 - pnl.x0 + 20, bottom - top + 12);
      // Folds: soft vertical bands of more and less fabric.
      for (let fx = pnl.x0; fx < pnl.x1; fx += 22) {
        g.fillStyle = S.rgba(thread, 0.12 + rng.range(0, 0.1));
        g.fillRect(fx, top, 9, bottom - top + 12);
        g.fillStyle = S.rgba(P.soot, 0.06);
        g.fillRect(fx + 12, top, 5, bottom - top + 12);
      }
      // Rosettes: a ring of eight dots round a centre, in a half-drop grid.
      for (let row = 0, ry = top + 34; ry < bottom - 10; row++, ry += 38) {
        for (let rx = pnl.x0 + 14 + (row % 2) * 19; rx < pnl.x1; rx += 38) {
          g.fillStyle = S.rgba(thread, 0.55);
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            g.beginPath();
            g.arc(rx + Math.cos(a) * 7, ry + Math.sin(a) * 7, 1.6, 0, Math.PI * 2);
            g.fill();
          }
          g.beginPath();
          g.arc(rx, ry, 2.4, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = S.rgba(thread, 0.3);
          g.lineWidth = 0.8;
          g.beginPath();
          g.arc(rx, ry, 12, 0, Math.PI * 2);
          g.stroke();
        }
      }
      // A denser band of border along the hem.
      g.fillStyle = S.rgba(thread, 0.4);
      g.fillRect(pnl.x0 - 10, bottom - 22, pnl.x1 - pnl.x0 + 20, 8);
      if (!clean) {
        // Grey with age, darkest at the hem where the dust settles.
        const grime = g.createLinearGradient(0, top, 0, bottom);
        grime.addColorStop(0, S.rgba(P.taupe, 0.05));
        grime.addColorStop(1, S.rgba(P.umber, 0.25));
        g.fillStyle = grime;
        g.fillRect(pnl.x0 - 10, top, pnl.x1 - pnl.x0 + 20, bottom - top + 12);
      }
      g.restore();
    }
    // Rings on the pole.
    g.strokeStyle = S.rgba(P.brass, 0.75);
    g.lineWidth = 1.6;
    for (let rx = x - 34; rx < x + w + 40; rx += 18) {
      g.beginPath();
      g.ellipse(rx, y - 40, 4, 6, 0, 0, Math.PI * 2);
      g.stroke();
    }
    if (!clean) {
      // The torn flap hangs down from the hole.
      g.fillStyle = S.rgba(S.mixHex(P.linen, P.taupe, 0.45), 0.45);
      g.beginPath();
      g.moveTo(x + w * 0.8, y + 270);
      g.lineTo(x + w * 0.7, y + 232);
      g.lineTo(x + w * 0.64, y + 330);
      g.lineTo(x + w * 0.72, y + 346);
      g.closePath();
      g.fill();
    }
  }

  // The hat-box shelf's shadow on the wall (the shelf itself is furniture).
  function paintShelfBracketsShadow(g) {
    const s = g.createLinearGradient(0, SHELF.y + 6, 0, SHELF.y + 40);
    s.addColorStop(0, S.rgba(P.soot, 0.4));
    s.addColorStop(1, S.rgba(P.soot, 0));
    g.fillStyle = s;
    g.fillRect(SHELF.x0 + 10, SHELF.y + 6, SHELF.x1 - SHELF.x0 - 20, 34);
  }

  function paintSkirting(g, clean) {
    paintShape(g, rectPoints(0, FLOOR_LINE - 44, 1920, 46), {
      color: aged(S.mixHex(P.linen, P.taupe, 0.35), clean),
      lightDir: { x: 0, y: -1 },
      light: 0.25,
      shadow: 0.4,
      strokes: 4,
      strokeAngle: 0,
      rim: 0.3,
      wobble: 0,
      seed: 8040,
    });
    g.fillStyle = S.rgba(P.soot, 0.3);
    g.fillRect(0, FLOOR_LINE - 36, 1920, 2);
  }

  function paintFloor(g, clean) {
    const vp = { x: 960, y: -900 };
    const top = FLOOR_LINE;
    const bottom = 1080;
    const base = clean ? S.mixHex(P.oak, P.walnut, 0.35) : S.mixHex(P.walnut, P.oak, 0.32);
    paintShape(g, rectPoints(0, top, 1920, bottom - top), {
      color: base,
      lightDir: { x: 0, y: 1 },
      light: 0.1,
      shadow: 0.35,
      strokes: 18,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.08,
      strokeSize: 1.4,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 8050,
    });
    const xAt = (xb, y) => vp.x + (xb - vp.x) * ((y - vp.y) / (bottom - vp.y));
    const rng = S.createRng(8051);
    for (let xb = -300; xb < 2300; xb += 110) {
      g.fillStyle = S.rgba(S.shadeHex(base, rng.range(-0.12, 0.08)), 0.4);
      g.beginPath();
      g.moveTo(xAt(xb, top), top);
      g.lineTo(xAt(xb + 110, top), top);
      g.lineTo(xb + 110, bottom);
      g.lineTo(xb, bottom);
      g.closePath();
      g.fill();
      g.strokeStyle = S.rgba(P.soot, 0.55);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(xAt(xb, top), top);
      g.lineTo(xb, bottom);
      g.stroke();
      let y = top + rng.range(10, 110);
      while (y < bottom) {
        g.strokeStyle = S.rgba(P.soot, 0.45);
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(xAt(xb, y), y);
        g.lineTo(xAt(xb + 110, y), y);
        g.stroke();
        y += rng.range(140, 260) * ((y - vp.y) / (bottom - vp.y));
      }
    }
    const fall = g.createRadialGradient(900, 900, 200, 900, 940, 1150);
    fall.addColorStop(0, 'rgba(0,0,0,0)');
    fall.addColorStop(1, S.rgba(P.soot, clean ? 0.32 : 0.5));
    g.fillStyle = fall;
    g.fillRect(0, top, 1920, bottom - top);
    const join = g.createLinearGradient(0, top, 0, top + 26);
    join.addColorStop(0, S.rgba(P.soot, 0.5));
    join.addColorStop(1, S.rgba(P.soot, 0));
    g.fillStyle = join;
    g.fillRect(0, top, 1920, 26);
    if (!clean) {
      // Dust lying in drifts along the skirting and under the furniture.
      for (const [x, r] of [[700, 260], [1300, 200], [1700, 220]]) {
        const d = g.createRadialGradient(x, FLOOR_LINE + 20, 10, x, FLOOR_LINE + 20, r);
        d.addColorStop(0, S.rgba(P.taupe, 0.3));
        d.addColorStop(1, S.rgba(P.taupe, 0));
        g.fillStyle = d;
        g.fillRect(x - r, FLOOR_LINE, r * 2, 70);
      }
    }
  }

  // An oval rag rug beside the bed, in rings of faded colour.
  function paintRug(g, clean) {
    const cx = 860;
    const cy = 985;
    const rings = [
      [430, 62, S.mixHex(P.plum, P.taupe, 0.3)],
      [400, 54, S.mixHex(P.linen, P.taupe, 0.35)],
      [360, 46, S.mixHex(P.rust, P.taupe, 0.25)],
      [320, 38, S.mixHex(P.moss, P.linen, 0.3)],
      [270, 30, S.mixHex(P.linen, P.plum, 0.25)],
      [210, 22, S.mixHex(P.plum, P.rust, 0.4)],
    ];
    softShadow(g, cx, cy + 6, 440, 50, 0.35);
    for (const [i, [rx, ry, hex]] of rings.entries()) {
      paintShape(g, ellipsePoints(cx, cy, rx, ry, 48), {
        color: aged(hex, clean, 1.2),
        lightDir: { x: 0, y: -1 },
        light: 0.12,
        shadow: 0.3,
        strokes: 30,
        strokeAngle: 0,
        strokeSize: 0.5,
        variance: 0.2,
        rim: 0,
        innerShadow: 0.15,
        wobble: 1.2,
        seed: 8060 + i,
      });
    }
    if (!clean) {
      g.fillStyle = S.rgba(P.taupe, 0.3);
      g.beginPath();
      g.ellipse(cx + 120, cy, 160, 28, 0.05, 0, Math.PI * 2);
      g.fill();
    }
  }

  // ── Furniture layer ───────────────────────────────────────────────────

  function paintFurniture(g, clean) {
    paintWardrobe(g, clean);
    paintNightstand(g, LEFT_STAND, clean, 8100);
    paintNightstand(g, RIGHT_STAND, clean, 8110);
    paintShelf(g, clean);
    paintBed(g, clean);
    paintLamp(g, (LEFT_STAND.x0 + LEFT_STAND.x1) / 2 - 18, LEFT_STAND.top, clean, 8120);
    paintLamp(g, (RIGHT_STAND.x0 + RIGHT_STAND.x1) / 2, RIGHT_STAND.top, clean, 8125);
    paintRadio(g, clean);
    paintDressingTable(g, clean);
    paintChest(g, clean);
    paintCleanerTrace(g, clean);
  }

  function woodPanel(g, x, y, w, h, clean, seed, opts = {}) {
    paintShape(g, rectPoints(x, y, w, h), {
      color: aged(opts.color ?? TONE.wood, clean),
      lightDir: LIGHT_DIR,
      light: opts.light ?? 0.22,
      shadow: opts.shadow ?? 0.45,
      strokes: 10,
      strokeAngle: opts.grain ?? Math.PI / 2,
      strokeJitter: 0.08,
      variance: 0.14,
      rim: opts.rim ?? 0.3,
      wobble: opts.wobble ?? 0.5,
      seed,
    });
  }

  // The wardrobe: a tall dark carcass with a carved cornice and plinth, two
  // doors each set with an oval mirror, and a brass key in the lock.
  function paintWardrobe(g, clean) {
    const { x0, x1, y0, y1 } = WARDROBE;
    softShadow(g, (x0 + x1) / 2 + 10, y1 + 4, (x1 - x0) * 0.62, 16, 0.55);
    // Side (seen a little from the right): gives the box its depth.
    paintShape(g, [[x1, y0 + 40], [x1 + 26, y0 + 56], [x1 + 26, y1 - 6], [x1, y1]], {
      color: aged(S.shadeHex(TONE.wood, -0.25), clean),
      lightDir: LIGHT_DIR,
      light: 0.1,
      shadow: 0.5,
      strokes: 8,
      strokeAngle: Math.PI / 2,
      rim: 0.15,
      wobble: 0.4,
      seed: 8070,
    });
    woodPanel(g, x0, y0 + 40, x1 - x0, y1 - y0 - 40, clean, 8071);
    // Cornice: a stepped crown with a carved swag in the middle.
    paintShape(g, [[x0 - 16, y0 + 44], [x1 + 30, y0 + 44], [x1 + 40, y0 + 22], [x0 - 26, y0 + 22]], {
      color: aged(TONE.woodLight, clean),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.45,
      strokes: 6,
      strokeAngle: 0,
      rim: 0.35,
      wobble: 0.3,
      seed: 8072,
    });
    paintShape(g, [[x0 + 30, y0 + 24], [x1 - 30, y0 + 24], [x1 - 60, y0 - 4], [(x0 + x1) / 2, y0 - 18], [x0 + 60, y0 - 4]], {
      color: aged(TONE.wood, clean),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.4,
      strokes: 5,
      rim: 0.35,
      wobble: 0.8,
      seed: 8073,
    });
    g.strokeStyle = S.rgba(P.soot, 0.45);
    g.lineWidth = 2;
    for (const s of [-1, 1]) {
      g.beginPath();
      const cx = (x0 + x1) / 2;
      g.moveTo(cx, y0 + 4);
      g.bezierCurveTo(cx + s * 20, y0 - 10, cx + s * 46, y0 + 12, cx + s * 70, y0 + 6);
      g.stroke();
    }
    // Plinth.
    woodPanel(g, x0 - 8, y1 - 44, x1 - x0 + 16, 44, clean, 8074, { color: TONE.woodLight, grain: 0, light: 0.25 });
    for (const fx of [x0 + 4, x1 - 26]) woodPanel(g, fx, y1 - 4, 22, 16, clean, 8075 + fx, { grain: 0 });
    // The doors (closed): drawn again, swung open, by drawOnFurniture.
    for (const side of [0, 1]) paintWardrobeDoor(g, side, clean, 0, 0);
    if (!clean) {
      stain(g, x0 + 60, y0 + 120, 60, P.taupe, 8076, 0.25);
      // Dust lying on the cornice.
      g.fillStyle = S.rgba(P.linen, 0.16);
      g.fillRect(x0 - 24, y0 + 20, x1 - x0 + 62, 4);
    }
  }

  // One wardrobe door, drawn at (ox, oy) on a canvas of its own size or in
  // place on the furniture layer. side 0 is the left door, 1 the right.
  function doorRect(side) {
    const { x0, x1 } = WARDROBE;
    const mid = (x0 + x1) / 2;
    return side === 0
      ? { x: x0 + 12, y: WR_DOORS.y0, w: mid - x0 - 14, h: WR_DOORS.y1 - WR_DOORS.y0 }
      : { x: mid + 2, y: WR_DOORS.y0, w: x1 - mid - 14, h: WR_DOORS.y1 - WR_DOORS.y0 };
  }

  function paintWardrobeDoor(g, side, clean, ox, oy, local = false) {
    const r = doorRect(side);
    const x = local ? ox : r.x;
    const y = local ? oy : r.y;
    const { w, h } = r;
    woodPanel(g, x, y, w, h, clean, 8080 + side, { color: S.mixHex(TONE.wood, TONE.woodLight, 0.25), wobble: 0.3 });
    // Moulded frame and the oval mirror.
    g.strokeStyle = S.rgba(P.soot, 0.45);
    g.lineWidth = 3;
    g.strokeRect(x + 10, y + 12, w - 20, h - 24);
    g.strokeStyle = S.rgba(P.linen, 0.12);
    g.lineWidth = 1.5;
    g.strokeRect(x + 13, y + 15, w - 26, h - 30);
    const mx = x + w / 2;
    const my = y + h * 0.42;
    const rx = w * 0.34;
    const ry = h * 0.3;
    paintShape(g, ellipsePoints(mx, my, rx + 7, ry + 7, 40), {
      color: aged(TONE.woodLight, clean),
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.45,
      strokes: 4,
      rim: 0.4,
      wobble: 0.3,
      seed: 8082 + side,
    });
    const glass = g.createLinearGradient(mx - rx, my - ry, mx + rx, my + ry);
    glass.addColorStop(0, S.mixHex(P.moon, P.umber, clean ? 0.55 : 0.72));
    glass.addColorStop(0.5, S.mixHex(P.umber, P.soot, 0.4));
    glass.addColorStop(1, S.mixHex(P.moon, P.soot, 0.7));
    g.fillStyle = glass;
    g.beginPath();
    g.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    // The room in the glass: the window, faint.
    g.save();
    g.clip();
    g.fillStyle = S.rgba(P.moon, clean ? 0.16 : 0.1);
    g.fillRect(mx - rx * 0.2, my - ry * 0.8, rx * 0.5, ry * 0.7);
    g.fillStyle = S.rgba(P.bone, 0.12);
    g.beginPath();
    g.moveTo(mx - rx, my - ry * 0.2);
    g.lineTo(mx - rx * 0.3, my - ry);
    g.lineTo(mx - rx * 0.05, my - ry);
    g.lineTo(mx - rx, my + ry * 0.3);
    g.closePath();
    g.fill();
    if (!clean) {
      // Cracked: a star from a knock, lines running out to the frame.
      const cx = mx + (side ? -rx * 0.25 : rx * 0.2);
      const cy = my + ry * (side ? 0.15 : -0.3);
      g.strokeStyle = S.rgba(P.bone, 0.5);
      g.lineWidth = 1;
      const rng = S.createRng(8084 + side);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + rng.range(-0.3, 0.3);
        const len = rng.range(rx * 0.6, rx * 1.4);
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * len * 0.5 + rng.range(-4, 4), cy + Math.sin(a) * len * 0.5);
        g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        g.stroke();
      }
      g.fillStyle = S.rgba(P.taupe, 0.35);
      g.fillRect(mx - rx, my - ry, rx * 2, ry * 2);
    }
    g.restore();
    // A lower panel.
    g.strokeStyle = S.rgba(P.soot, 0.4);
    g.lineWidth = 2;
    g.strokeRect(x + 22, y + h * 0.8, w - 44, h * 0.13);
    // The key (right door only) and a little brass escutcheon.
    if (side === 1) {
      const kx = x + 12;
      const ky = y + h * 0.5;
      g.fillStyle = aged(P.brass, clean, 0.8);
      g.beginPath();
      g.ellipse(kx, ky, 5, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(kx - 1.5, ky + 6, 3, 12);
      g.beginPath();
      g.arc(kx, ky + 24, 6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.rgba(P.soot, 0.6);
      g.beginPath();
      g.arc(kx, ky + 24, 2.6, 0, Math.PI * 2);
      g.fill();
    }
  }

  function paintNightstand(g, st, clean, seed) {
    const w = st.x1 - st.x0;
    softShadow(g, (st.x0 + st.x1) / 2, st.base + 2, w * 0.65, 10, 0.5);
    woodPanel(g, st.x0 + 4, st.top + 10, w - 8, st.base - st.top - 26, clean, seed, { color: TONE.woodLight });
    woodPanel(g, st.x0 - 6, st.top, w + 12, 12, clean, seed + 1, { grain: 0, light: 0.35, color: TONE.woodLight });
    // A drawer with a knob, and turned legs.
    g.strokeStyle = S.rgba(P.soot, 0.45);
    g.lineWidth = 2;
    g.strokeRect(st.x0 + 12, st.top + 20, w - 24, 34);
    g.fillStyle = aged(P.brass, clean);
    g.beginPath();
    g.arc((st.x0 + st.x1) / 2, st.top + 37, 4, 0, Math.PI * 2);
    g.fill();
    for (const lx of [st.x0 + 8, st.x1 - 18]) woodPanel(g, lx, st.base - 18, 10, 20, clean, seed + 2 + lx, { grain: Math.PI / 2 });
  }

  // A bedside lamp: a turned base and a pleated shade.
  function paintLamp(g, cx, top, clean, seed) {
    softShadow(g, cx, top - 2, 26, 4, 0.4);
    paintShape(g, [[cx - 18, top], [cx + 18, top], [cx + 12, top - 12], [cx + 16, top - 40], [cx + 6, top - 62], [cx - 6, top - 62], [cx - 16, top - 40], [cx - 12, top - 12]], {
      color: aged(S.mixHex(P.linen, P.rust, 0.25), clean),
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.45,
      strokes: 4,
      rim: 0.4,
      wobble: 0.4,
      seed,
    });
    g.fillStyle = aged(P.brass, clean);
    g.fillRect(cx - 2, top - 78, 4, 18);
    const s = { t: top - 128, b: top - 76, tw: 30, bw: 50 };
    paintShape(g, [[cx - s.tw, s.t], [cx + s.tw, s.t], [cx + s.bw, s.b], [cx - s.bw, s.b]], {
      color: aged(S.mixHex(P.linen, P.dawn, 0.18), clean, 1.3),
      lightDir: { x: 0, y: 1 },
      light: 0.15,
      shadow: 0.25,
      strokes: 3,
      rim: 0.2,
      wobble: 0.4,
      seed: seed + 1,
    });
    // The pleats.
    g.strokeStyle = S.rgba(P.soot, 0.2);
    g.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      g.beginPath();
      g.moveTo(cx + (i / 6) * s.tw, s.t + 1);
      g.lineTo(cx + (i / 6) * s.bw, s.b - 1);
      g.stroke();
    }
    g.fillStyle = S.rgba(P.soot, 0.25);
    g.fillRect(cx - s.bw, s.b - 4, s.bw * 2, 4);
    if (!clean) {
      g.fillStyle = S.rgba(P.taupe, 0.25);
      g.fillRect(cx - s.tw, s.t, s.tw * 2, 6);
    }
  }

  // A 1960s tabletop radio on the left nightstand: a two-tone cabinet, a
  // speaker grille, a long dial window and two knobs.
  const RADIO = { x: 470, y: 748, w: 58, h: 42 };
  function paintRadio(g, clean) {
    const { x, y, w, h } = RADIO;
    softShadow(g, x + w / 2, y + h, w * 0.6, 5, 0.45);
    paintShape(g, roundedRectPoints(x, y, w, h, 9), {
      color: aged(S.mixHex(P.linen, P.rust, 0.15), clean),
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.4,
      strokes: 3,
      rim: 0.4,
      wobble: 0.2,
      seed: 8130,
    });
    g.fillStyle = aged(S.mixHex(P.rust, P.walnut, 0.4), clean);
    g.fillRect(x + 4, y + 6, w * 0.45, h - 12);
    g.strokeStyle = S.rgba(P.soot, 0.4);
    g.lineWidth = 0.8;
    for (let gy = y + 9; gy < y + h - 7; gy += 3.5) {
      g.beginPath();
      g.moveTo(x + 6, gy);
      g.lineTo(x + 4 + w * 0.45 - 2, gy);
      g.stroke();
    }
    // The dial window is painted dark; its glow is live.
    g.fillStyle = S.mixHex(P.umber, P.soot, 0.4);
    g.fillRect(x + w * 0.55, y + 8, w * 0.38, 12);
    g.fillStyle = S.rgba(P.linen, 0.4);
    for (let i = 0; i < 6; i++) g.fillRect(x + w * 0.57 + i * 3.6, y + 10, 0.8, 4);
    for (const kx of [x + w * 0.62, x + w * 0.85]) {
      g.fillStyle = aged(P.brass, clean);
      g.beginPath();
      g.arc(kx, y + 30, 4.5, 0, Math.PI * 2);
      g.fill();
    }
  }

  // The hat-box shelf over the bed, and its boxes. One fell when dirty.
  function paintShelf(g, clean) {
    const { x0, x1, y } = SHELF;
    // Boxes first (they sit on the board), then the board over their feet.
    const boxes = clean
      ? [[740, 46, 50, 'rose'], [1004, 40, 40, 'sage'], [1012, 34, 26, 'cream']]
      : [[740, 46, 50, 'rose'], [1012, 34, 26, 'cream']];
    if (!clean) {
      // The third box fell: it lies on its side on the floor by the
      // dressing table, its lid rolled away.
      paintHatBox(g, 1318, 912, 26, 40, 'sage', clean, 8149, -1.35);
      g.save();
      g.translate(1352, 930);
      g.rotate(0.2);
      g.fillStyle = aged(S.mixHex(HAT_HUES.sage[0], P.soot, 0.15), clean, 1.3);
      g.beginPath();
      g.ellipse(0, 0, 30, 8, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    for (const [i, [cx, rx, hgt, hue]] of boxes.entries()) {
      if (i === 2 && clean) {
        paintHatBox(g, cx, y - 40, rx, hgt, hue, clean, 8142 + i);
      } else {
        paintHatBox(g, cx, y, rx, hgt, hue, clean, 8142 + i);
      }
    }
    paintShape(g, rectPoints(x0, y - 2, x1 - x0, 12), {
      color: aged(TONE.woodLight, clean),
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.45,
      strokes: 4,
      strokeAngle: 0,
      rim: 0.4,
      wobble: 0.2,
      seed: 8140,
    });
    for (const bx of [x0 + 30, x1 - 40]) {
      paintShape(g, [[bx, y + 10], [bx + 10, y + 10], [bx + 10, y + 46], [bx + 4, y + 46], [bx, y + 22]], {
        color: aged(TONE.woodLight, clean),
        light: 0.2,
        shadow: 0.4,
        strokes: 2,
        rim: 0.3,
        wobble: 0.3,
        seed: 8141 + bx,
      });
    }
  }

  const HAT_HUES = {
    rose: [S.mixHex(P.plum, P.linen, 0.45), S.mixHex(P.linen, P.bone, 0.3)],
    sage: [S.mixHex(P.moss, P.linen, 0.45), S.mixHex(P.linen, P.bone, 0.3)],
    cream: [S.mixHex(P.linen, P.bone, 0.2), S.mixHex(P.rust, P.linen, 0.4)],
  };

  // A round striped box seen from slightly above: a cylinder with a lid.
  function paintHatBox(g, cx, base, rx, h, hue, clean, seed, tilt = 0) {
    const [a, b] = HAT_HUES[hue].map((hex) => aged(hex, clean, 1.3));
    const ry = rx * 0.22;
    g.save();
    g.translate(cx, base);
    g.rotate(tilt);
    softShadow(g, 0, 0, rx * 1.05, ry * 0.8, 0.4);
    // Body with vertical stripes, shaded round.
    g.save();
    g.beginPath();
    g.moveTo(-rx, -h);
    g.lineTo(-rx, 0);
    g.ellipse(0, 0, rx, ry, 0, Math.PI, 0, true);
    g.lineTo(rx, -h);
    g.closePath();
    g.clip();
    g.fillStyle = a;
    g.fillRect(-rx, -h - ry, rx * 2, h + ry * 2);
    g.fillStyle = b;
    for (let sx = -rx; sx < rx; sx += 10) g.fillRect(sx, -h - ry, 4, h + ry * 2);
    const round = g.createLinearGradient(-rx, 0, rx, 0);
    round.addColorStop(0, S.rgba(P.soot, 0.45));
    round.addColorStop(0.35, S.rgba(P.bone, 0.1));
    round.addColorStop(1, S.rgba(P.soot, 0.55));
    g.fillStyle = round;
    g.fillRect(-rx, -h - ry, rx * 2, h + ry * 2);
    g.restore();
    // Lid: a slightly wider band and the top ellipse.
    g.fillStyle = S.shadeHex(a, -0.1);
    g.fillRect(-rx - 2, -h - 2, rx * 2 + 4, 9);
    g.fillStyle = S.shadeHex(a, 0.12);
    g.beginPath();
    g.ellipse(0, -h - 2, rx + 2, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = S.rgba(P.soot, 0.3);
    g.lineWidth = 1;
    g.stroke();
    if (!clean) {
      g.fillStyle = S.rgba(P.taupe, 0.3);
      g.beginPath();
      g.ellipse(0, -h - 2, rx + 2, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // The bed: a carved headboard on the left, the mattress running right
  // under a patchwork quilt that falls in folds to the floor, a lower
  // footboard at the right. Dirty: half a dust sheet still over it and a
  // grey dent where something heavy lay.
  function paintBed(g, clean) {
    const { head0, head1, headTop, x0, x1, top, foot, footTop, base } = BED;
    softShadow(g, (x0 + x1) / 2, base, (x1 - x0) * 0.56, 18, 0.6);
    // Valance shadow under the bed, and the space beneath it.
    g.fillStyle = S.rgba(P.soot, 0.7);
    g.fillRect(x0 + 10, 870, x1 - x0 - 30, base - 870);
    // The mattress top: a strip seen from a little above.
    paintShape(g, [[x0, top - 22], [x1, top - 22], [x1 + 4, top + 4], [x0 - 4, top + 4]], {
      color: aged(TONE.quiltCream, clean),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.2,
      strokes: 6,
      strokeAngle: 0,
      rim: 0.3,
      wobble: 0.6,
      seed: 8150,
    });
    paintQuilt(g, clean);
    // Headboard, seen from the side at a slight angle: a thinner, darker
    // back post against the wall, the carved panel between, the front post.
    bedPost(g, head1 - 2, headTop + 16, 870, clean, 8162, 0.75, -0.18);
    const crest = [[head0 + 14, 800], [head0 + 14, headTop + 44], [head0 + 24, headTop + 18], [head0 + 36, headTop + 4], [head1 - 2, headTop + 22], [head1, 790]];
    paintShape(g, crest, {
      color: aged(TONE.wood, clean),
      lightDir: LIGHT_DIR,
      light: 0.2,
      shadow: 0.5,
      strokes: 10,
      strokeAngle: Math.PI / 2,
      rim: 0.3,
      wobble: 0.4,
      seed: 8160,
    });
    // Carving: a scroll at the crest and a sunk panel, foreshortened.
    g.strokeStyle = S.rgba(P.soot, 0.5);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(head0 + 20, headTop + 70);
    g.lineTo(head1 - 6, headTop + 56);
    g.lineTo(head1 - 6, 740);
    g.lineTo(head0 + 20, 748);
    g.closePath();
    g.stroke();
    g.strokeStyle = S.rgba(P.linen, 0.18);
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(head0 + 34, headTop + 34, 9, Math.PI * 0.9, Math.PI * 2.3);
    g.stroke();
    bedPost(g, head0 - 4, headTop + 30, base, clean, 8161, 1, 0);
    // Pillows at the head end.
    for (const [px, w, seed] of [[602, 70, 8155], [646, 62, 8156]]) {
      paintShape(g, [[px - w / 2, top - 18], [px - w / 2 + 8, top - 46], [px + w / 2 - 6, top - 44], [px + w / 2, top - 16], [px, top - 10]], {
        color: aged(S.mixHex(P.bone, P.linen, 0.4), clean, 1.2),
        lightDir: { x: 0.5, y: -0.85 },
        light: 0.25,
        shadow: 0.35,
        strokes: 4,
        rim: 0.4,
        wobble: 1.4,
        seed,
      });
    }
    // Footboard at the right: lower, with a curved top rail.
    paintShape(g, [[foot - 6, base], [foot - 6, footTop + 16], [foot + 6, footTop], [foot + 28, footTop], [foot + 34, footTop + 16], [foot + 34, base]], {
      color: aged(TONE.wood, clean),
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.5,
      strokes: 8,
      strokeAngle: Math.PI / 2,
      rim: 0.35,
      wobble: 0.4,
      seed: 8165,
    });
    bedPost(g, foot + 26, footTop - 6, base, clean, 8166);
    if (!clean) {
      paintDustSheet(g);
    } else {
      // The folded nightgown on the pillow.
      paintShape(g, [[620, top - 40], [672, top - 44], [676, top - 30], [624, top - 26]], {
        color: S.mixHex(P.plum, P.linen, 0.55),
        lightDir: { x: 0.4, y: -0.9 },
        light: 0.3,
        shadow: 0.35,
        strokes: 3,
        rim: 0.4,
        wobble: 0.6,
        seed: 8167,
      });
      g.strokeStyle = S.rgba(P.bone, 0.5);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(624, top - 33);
      g.lineTo(673, top - 37);
      g.stroke();
    }
  }

  function bedPost(g, x, top, base, clean, seed, scale = 1, shade = 0) {
    const w = 14 * scale;
    paintShape(g, rectPoints(x, top, w, base - top), {
      color: aged(S.shadeHex(TONE.woodLight, shade), clean),
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.5,
      strokes: 4,
      strokeAngle: Math.PI / 2,
      rim: 0.4,
      wobble: 0.3,
      seed,
    });
    // Turned finial and two collars.
    g.fillStyle = aged(S.shadeHex(TONE.woodLight, shade), clean);
    g.beginPath();
    g.arc(x + w / 2, top - 8 * scale, 9 * scale, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.rgba(P.linen, 0.2);
    g.beginPath();
    g.arc(x + w / 2 - 3, top - 11 * scale, 3.5 * scale, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.rgba(P.soot, 0.35);
    for (const cy of [top + 20, base - 50]) g.fillRect(x - 2, cy, w + 4, 4);
  }

  // The patchwork quilt falling over the near side of the mattress: rows of
  // squares in faded colours, stitched, pulled into folds by its own weight.
  function paintQuilt(g, clean) {
    const { x0, x1, top } = BED;
    const drop = 96;
    const hem = (x) => top + drop + Math.sin(x * 0.045) * 6 + Math.sin(x * 0.013) * 4;
    g.save();
    const path = new Path2D();
    path.moveTo(x0 - 6, top - 4);
    path.lineTo(x1 + 6, top - 4);
    for (let x = x1 + 6; x >= x0 - 6; x -= 12) path.lineTo(x, hem(x));
    path.closePath();
    g.clip(path);
    const hues = [TONE.quiltRose, TONE.quiltSage, TONE.quiltCream, TONE.quiltRust, S.mixHex(P.plum, P.moon, 0.3)];
    const rng = S.createRng(8170);
    const size = 34;
    for (let row = 0, y = top - 4; y < top + drop + 14; row++, y += size) {
      for (let col = 0, x = x0 - 6; x < x1 + 6; col++, x += size) {
        const hex = aged(hues[(row * 3 + col * 2 + (rng.next() < 0.2 ? 1 : 0)) % hues.length], clean, 1.1);
        g.fillStyle = hex;
        g.fillRect(x, y, size + 0.5, size + 0.5);
        // A small print in some squares: dots or a tiny cross.
        if ((row + col) % 3 === 0) {
          g.fillStyle = S.rgba(P.bone, 0.18);
          for (let k = 0; k < 4; k++) {
            g.beginPath();
            g.arc(x + 8 + (k % 2) * 17, y + 8 + Math.floor(k / 2) * 17, 2, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
    // Stitching along the seams.
    g.strokeStyle = S.rgba(P.bone, 0.3);
    g.lineWidth = 1;
    g.setLineDash([4, 4]);
    for (let y = top - 4 + size; y < top + drop + 14; y += size) {
      g.beginPath();
      g.moveTo(x0 - 6, y - 2);
      g.lineTo(x1 + 6, y - 2);
      g.stroke();
    }
    for (let x = x0 - 6 + size; x < x1 + 6; x += size) {
      g.beginPath();
      g.moveTo(x - 2, top - 4);
      g.lineTo(x - 2, top + drop + 14);
      g.stroke();
    }
    g.setLineDash([]);
    // Folds: shadow and light bands hanging from the mattress edge. The
    // fabric is pulled into a fold every 60–90 px.
    for (let x = x0 + 20; x < x1; x += rng.range(60, 90)) {
      const band = g.createLinearGradient(x - 18, 0, x + 18, 0);
      band.addColorStop(0, 'rgba(0,0,0,0)');
      band.addColorStop(0.45, S.rgba(P.soot, 0.3));
      band.addColorStop(0.55, S.rgba(P.soot, 0.3));
      band.addColorStop(0.7, S.rgba(P.bone, 0.1));
      band.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = band;
      g.beginPath();
      g.moveTo(x - 6, top + 6);
      g.lineTo(x + 6, top + 6);
      g.lineTo(x + 18, top + drop + 14);
      g.lineTo(x - 18, top + drop + 14);
      g.closePath();
      g.fill();
    }
    // Round over the mattress edge: light on top, shade going down.
    const roll = g.createLinearGradient(0, top - 4, 0, top + drop + 14);
    roll.addColorStop(0, S.rgba(P.bone, 0.18));
    roll.addColorStop(0.12, 'rgba(0,0,0,0)');
    roll.addColorStop(0.7, S.rgba(P.soot, 0.15));
    roll.addColorStop(1, S.rgba(P.soot, 0.45));
    g.fillStyle = roll;
    g.fillRect(x0 - 6, top - 4, x1 - x0 + 12, drop + 18);
    g.restore();
    // A piped edge on the hem.
    g.strokeStyle = S.rgba(aged(TONE.quiltRose, clean), 0.9);
    g.lineWidth = 3;
    g.beginPath();
    for (let x = x0 - 6; x <= x1 + 6; x += 12) {
      if (x === x0 - 6) g.moveTo(x, hem(x));
      else g.lineTo(x, hem(x));
    }
    g.stroke();
  }

  // The dust sheet: grey cotton over the right two-thirds of the bed, half
  // pulled off so it trails to the floor, and a sunken dent in the middle.
  function paintDustSheet(g) {
    const { x1, top } = BED;
    const sheet = [[760, top - 26], [x1 + 10, top - 26], [x1 + 18, 900], [1080, 918], [960, 905], [880, 840], [800, top + 40], [740, top + 10]];
    paintShape(g, sheet, {
      color: S.mixHex(P.taupe, P.linen, 0.35),
      lightDir: { x: 0.2, y: -0.98 },
      light: 0.22,
      shadow: 0.4,
      strokes: 12,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.4,
      rim: 0.3,
      wobble: 3,
      seed: 8180,
    });
    // Folds in the sheet.
    const rng = S.createRng(8181);
    for (let i = 0; i < 9; i++) {
      const x = rng.range(800, 1160);
      g.strokeStyle = S.rgba(P.soot, 0.22);
      g.lineWidth = rng.range(3, 6);
      g.beginPath();
      g.moveTo(x, top - 10);
      g.quadraticCurveTo(x + rng.range(-20, 20), top + 50, x + rng.range(-30, 10), rng.range(860, 900));
      g.stroke();
    }
    // The sunken grey dent on the mattress top.
    const dent = g.createRadialGradient(930, top - 14, 4, 930, top - 14, 90);
    dent.addColorStop(0, S.rgba(P.soot, 0.4));
    dent.addColorStop(1, S.rgba(P.soot, 0));
    g.fillStyle = dent;
    g.beginPath();
    g.ellipse(930, top - 14, 100, 14, 0, 0, Math.PI * 2);
    g.fill();
    // The pulled-off end lying in folds on the floor.
    paintShape(g, [[1060, 912], [1190, 896], [1230, 930], [1120, 948], [1040, 940]], {
      color: S.mixHex(P.taupe, P.linen, 0.3),
      lightDir: { x: 0, y: -1 },
      light: 0.2,
      shadow: 0.4,
      strokes: 6,
      rim: 0.25,
      wobble: 2.5,
      seed: 8182,
    });
  }

  // The dressing table: a kidney top with a gathered skirt, a three-fold
  // mirror ringed with round bulbs, and its things laid out on the top.
  const BULBS = (() => {
    const list = [];
    const cx = 1480;
    // Round the centre panel's arch, then down each side.
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      list.push([cx + Math.cos(a) * 54, MIRROR.y0 + 48 + Math.sin(a) * 40]);
    }
    for (const y of [MIRROR.y0 + 90, MIRROR.y0 + 140, MIRROR.y0 + 190, MIRROR.y0 + 240]) {
      list.unshift([cx - 66, y]);
      list.push([cx + 66, y]);
    }
    // Sort from the left bottom, over the arch, to the right bottom.
    return list.sort((p, q) => {
      const ang = ([x, y]) => Math.atan2(y - (MIRROR.y0 + 140), x - cx);
      const norm = (a) => (a < Math.PI / 2 ? a + Math.PI * 2 : a);
      return norm(ang(p)) - norm(ang(q));
    });
  })();

  function paintDressingTable(g, clean) {
    const { x0, x1, top, base } = TABLE;
    const cx = (x0 + x1) / 2;
    softShadow(g, cx, base, (x1 - x0) * 0.58, 14, 0.55);
    // Mirror wings and the arched centre panel.
    const frame = aged(S.mixHex(P.linen, P.bone, 0.15), clean, 1.2);
    const wing = (xa, xb, lean, seed) => {
      paintShape(g, [[xa, MIRROR.y0 + 70 + lean], [xb, MIRROR.y0 + 60], [xb, MIRROR.y1], [xa, MIRROR.y1 - lean]], {
        color: frame,
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.4,
        strokes: 3,
        rim: 0.35,
        wobble: 0.3,
        seed,
      });
      const glass = [[xa + 7, MIRROR.y0 + 80 + lean], [xb - 6, MIRROR.y0 + 70], [xb - 6, MIRROR.y1 - 8], [xa + 7, MIRROR.y1 - 8 - lean]];
      mirrorGlass(g, glass, clean, seed + 1);
    };
    wing(x0 + 6, cx - 72, 12, 8190);
    wing(cx + 72, x1 - 6, -12, 8192);
    const arch = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      arch.push([cx + Math.cos(a) * 72, MIRROR.y0 + 60 + Math.sin(a) * 60]);
    }
    paintShape(g, [[cx - 72, MIRROR.y1], ...arch, [cx + 72, MIRROR.y1]], {
      color: frame,
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.4,
      strokes: 3,
      rim: 0.4,
      wobble: 0.3,
      seed: 8194,
    });
    const inner = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      inner.push([cx + Math.cos(a) * 58, MIRROR.y0 + 64 + Math.sin(a) * 48]);
    }
    mirrorGlass(g, [[cx - 58, MIRROR.y1 - 8], ...inner, [cx + 58, MIRROR.y1 - 8]], clean, 8195);
    // Bulb sockets: the bulbs themselves are drawn live (they light up).
    for (const [bx, by] of BULBS) {
      g.fillStyle = aged(P.brass, clean);
      g.beginPath();
      g.arc(bx, by, 7.5, 0, Math.PI * 2);
      g.fill();
    }
    // The top, kidney-shaped, seen a little from above.
    const topPts = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const dip = Math.cos(a) > 0.95 ? 0 : 0;
      topPts.push([cx + Math.cos(a) * (x1 - x0) * 0.52, top + Math.sin(a) * 16 + (Math.sin(a) < 0 ? -dip : 0)]);
    }
    // The skirt: gathered fabric to the floor, a pleat every 14 px.
    const skirt = [[x0 - 6, top + 6], [x1 + 6, top + 6], [x1 + 14, base], [x0 - 14, base]];
    paintShape(g, skirt, {
      color: aged(S.mixHex(P.plum, P.linen, 0.45), clean, 1.2),
      lightDir: LIGHT_DIR,
      light: 0.2,
      shadow: 0.45,
      strokes: 10,
      strokeAngle: Math.PI / 2,
      rim: 0.3,
      wobble: 0.8,
      seed: 8196,
    });
    for (let x = x0; x < x1 + 6; x += 14) {
      const p = g.createLinearGradient(x, 0, x + 14, 0);
      p.addColorStop(0, S.rgba(P.soot, 0.25));
      p.addColorStop(0.5, S.rgba(P.bone, 0.08));
      p.addColorStop(1, S.rgba(P.soot, 0.25));
      g.fillStyle = p;
      g.beginPath();
      g.moveTo(x, top + 8);
      g.lineTo(x + 14, top + 8);
      g.lineTo(x + 14 + (x - 1480) * 0.04, base);
      g.lineTo(x + (x - 1480) * 0.04, base);
      g.closePath();
      g.fill();
    }
    if (!clean) {
      const dust = g.createLinearGradient(0, top, 0, base);
      dust.addColorStop(0, S.rgba(P.taupe, 0.1));
      dust.addColorStop(1, S.rgba(P.umber, 0.35));
      g.fillStyle = dust;
      g.fillRect(x0 - 14, top + 6, x1 - x0 + 28, base - top);
    }
    paintShape(g, topPts, {
      color: aged(S.mixHex(P.linen, P.bone, 0.2), clean, 1.2),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.3,
      strokes: 3,
      rim: 0.4,
      wobble: 0.4,
      seed: 8197,
    });
    // Things on the top: perfume bottles, a hairbrush, a jewellery box.
    const bottles = [[1384, 14, 22, P.rust], [1402, 10, 30, P.moon], [1590, 12, 20, P.plum]];
    for (const [bx, w, h, hue] of bottles) {
      g.fillStyle = S.rgba(S.mixHex(hue, P.bone, 0.3), clean ? 0.75 : 0.5);
      g.beginPath();
      g.ellipse(bx, top - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.rgba(P.bone, 0.45);
      g.fillRect(bx - w * 0.25, top - h * 0.8, 2, h * 0.4);
      g.fillStyle = aged(P.brass, clean);
      g.fillRect(bx - 2.5, top - h - 6, 5, 7);
    }
    // Jewellery box with its lid a little open.
    paintShape(g, roundedRectPoints(1544, top - 22, 36, 20, 3), {
      color: aged(S.mixHex(P.rust, P.walnut, 0.3), clean),
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.4,
      strokes: 2,
      rim: 0.4,
      wobble: 0.2,
      seed: 8198,
    });
    g.fillStyle = aged(P.brass, clean);
    g.fillRect(1560, top - 14, 4, 4);
    // Hairbrush lying on its back.
    g.fillStyle = aged(S.mixHex(P.walnut, P.oak, 0.5), clean);
    g.beginPath();
    g.ellipse(1430, top - 6, 18, 5, -0.05, 0, Math.PI * 2);
    g.fill();
    g.fillRect(1446, top - 8, 26, 4);
    g.fillStyle = S.rgba(P.bone, 0.4);
    for (let i = 0; i < 6; i++) g.fillRect(1418 + i * 4, top - 10, 1, 3);
    if (!clean) {
      g.fillStyle = S.rgba(P.taupe, 0.3);
      g.beginPath();
      g.ellipse(cx, top, (x1 - x0) * 0.52, 16, 0, 0, Math.PI * 2);
      g.fill();
    }
    // A low stool tucked under, its seat showing below the skirt.
    paintShape(g, roundedRectPoints(cx - 50, base - 46, 100, 18, 8), {
      color: aged(S.mixHex(P.plum, P.linen, 0.3), clean),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.4,
      strokes: 3,
      rim: 0.3,
      wobble: 0.6,
      seed: 8199,
    });
    for (const lx of [cx - 40, cx + 34]) woodPanel(g, lx, base - 28, 6, 28, clean, 8200 + lx, { color: TONE.woodLight });
  }

  function mirrorGlass(g, pts, clean, seed) {
    g.save();
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
    g.closePath();
    const b = S.paint.boundsOf(pts);
    const glass = g.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    glass.addColorStop(0, S.mixHex(P.moon, P.umber, clean ? 0.45 : 0.65));
    glass.addColorStop(0.6, S.mixHex(P.umber, P.soot, 0.3));
    glass.addColorStop(1, S.mixHex(P.moon, P.soot, 0.6));
    g.fillStyle = glass;
    g.fill();
    g.clip();
    // A reflected streak and, dimly, the window.
    g.fillStyle = S.rgba(P.bone, 0.12);
    g.beginPath();
    g.moveTo(b.x, b.y + b.h * 0.4);
    g.lineTo(b.x + b.w * 0.5, b.y);
    g.lineTo(b.x + b.w * 0.75, b.y);
    g.lineTo(b.x, b.y + b.h * 0.65);
    g.closePath();
    g.fill();
    if (!clean) {
      // Silvering gone at the edges: dark blooms.
      const rng = S.createRng(seed);
      for (let i = 0; i < 5; i++) {
        g.fillStyle = S.rgba(P.soot, 0.35);
        g.beginPath();
        g.arc(b.x + rng.range(0, b.w), b.y + b.h - rng.range(0, 30), rng.range(5, 14), 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = S.rgba(P.taupe, 0.28);
      g.fillRect(b.x, b.y, b.w, b.h);
    }
    g.restore();
  }

  // The chest of drawers: three long drawers with brass pulls. Dirty, the
  // top is strewn with clothes; clean, they are folded, with the cleaner's
  // alarm clock beside them.
  function paintChest(g, clean) {
    const { x0, x1, top, base } = CHEST;
    softShadow(g, (x0 + x1) / 2, base, (x1 - x0) * 0.6, 12, 0.55);
    woodPanel(g, x0, top + 10, x1 - x0, base - top - 24, clean, 8210, { color: TONE.woodLight });
    woodPanel(g, x0 - 8, top, x1 - x0 + 16, 14, clean, 8211, { grain: 0, light: 0.35, color: TONE.woodLight });
    for (let i = 0; i < 3; i++) {
      const dy = top + 20 + i * 28;
      g.strokeStyle = S.rgba(P.soot, 0.5);
      g.lineWidth = 2;
      g.strokeRect(x0 + 8, dy, x1 - x0 - 16, 24);
      for (const px of [x0 + 40, x1 - 46]) {
        g.fillStyle = aged(P.brass, clean);
        g.fillRect(px, dy + 10, 12, 4);
      }
    }
    for (const lx of [x0 + 4, x1 - 16]) woodPanel(g, lx, base - 16, 12, 18, clean, 8212 + lx, { grain: 0 });
    if (!clean) {
      // A cardigan thrown over the corner, a scarf trailing down the front.
      paintShape(g, [[x0 + 10, top + 2], [x0 + 110, top - 6], [x0 + 120, top + 8], [x0 + 70, top + 60], [x0 + 40, top + 70], [x0 + 6, top + 20]], {
        color: S.mixHex(P.moss, P.taupe, 0.4),
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.45,
        strokes: 8,
        rim: 0.3,
        wobble: 2,
        seed: 8213,
      });
      paintShape(g, [[x1 - 50, top - 2], [x1 - 20, top - 4], [x1 - 14, top + 90], [x1 - 30, top + 96]], {
        color: S.mixHex(P.rust, P.linen, 0.35),
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.4,
        strokes: 3,
        rim: 0.3,
        wobble: 1.5,
        seed: 8214,
      });
      // A shoe on the floor.
      paintShape(g, [[x0 - 40, base + 10], [x0 - 4, base + 6], [x0 + 6, base + 16], [x0 - 36, base + 20]], {
        color: S.mixHex(P.walnut, P.rust, 0.3),
        light: 0.3,
        shadow: 0.4,
        strokes: 2,
        rim: 0.35,
        wobble: 0.6,
        seed: 8215,
      });
    } else {
      // Folded: a neat stack of three.
      const stack = [[S.mixHex(P.moss, P.linen, 0.3), 0], [S.mixHex(P.rust, P.linen, 0.4), 1], [S.mixHex(P.linen, P.bone, 0.3), 2]];
      for (const [hex, i] of stack) {
        paintShape(g, roundedRectPoints(x0 + 20 + i * 2, top - 12 - i * 11, 76 - i * 4, 11, 4), {
          color: hex,
          lightDir: { x: 0, y: -1 },
          light: 0.3,
          shadow: 0.35,
          strokes: 2,
          rim: 0.35,
          wobble: 0.3,
          seed: 8216 + i,
        });
      }
      paintClock(g, x1 - 40, top - 2, 0, clean);
    }
  }

  // A wind-up alarm clock: two bells and a face.
  function paintClock(g, cx, base, tilt, clean) {
    g.save();
    g.translate(cx, base);
    g.rotate(tilt);
    softShadow(g, 0, 0, 16, 3, 0.4);
    g.fillStyle = aged(S.mixHex(P.brass, P.rust, 0.25), clean);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(s * 9, -30, 6, Math.PI, 0);
      g.fill();
    }
    g.beginPath();
    g.arc(0, -15, 14, 0, Math.PI * 2);
    g.fill();
    g.fillRect(-11, -4, 3, 5);
    g.fillRect(8, -4, 3, 5);
    g.fillStyle = S.mixHex(P.bone, P.linen, 0.3);
    g.beginPath();
    g.arc(0, -15, 10.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = P.soot;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(0, -15);
    g.lineTo(0, -22);
    g.moveTo(0, -15);
    g.lineTo(5, -13);
    g.stroke();
    g.restore();
  }

  // The previous cleaner slept here: a sleeping bag rolled out on the floor
  // in front of the bed, with an alarm clock by the pillow end. Clean, the
  // bag is rolled up and tied and the clock has gone to the chest.
  function paintCleanerTrace(g, clean) {
    if (!clean) {
      const y = 960;
      softShadow(g, 1010, y + 26, 190, 14, 0.45);
      paintShape(g, [[830, y + 8], [850, y - 14], [1170, y - 18], [1196, y + 4], [1180, y + 30], [840, y + 34]], {
        color: S.mixHex(P.moss, P.gear, 0.45),
        lightDir: { x: 0, y: -1 },
        light: 0.25,
        shadow: 0.45,
        strokes: 10,
        strokeAngle: 0,
        rim: 0.3,
        wobble: 2,
        seed: 8220,
      });
      // Quilted channels and the zip.
      g.strokeStyle = S.rgba(P.soot, 0.3);
      g.lineWidth = 2;
      for (let x = 880; x < 1170; x += 34) {
        g.beginPath();
        g.moveTo(x, y - 14);
        g.lineTo(x + 4, y + 30);
        g.stroke();
      }
      g.strokeStyle = S.rgba(P.linen, 0.35);
      g.lineWidth = 1;
      g.setLineDash([2, 2]);
      g.beginPath();
      g.moveTo(850, y - 10);
      g.lineTo(1170, y - 14);
      g.stroke();
      g.setLineDash([]);
      // The open top turned back, its lining showing, and a folded jumper
      // for a pillow.
      paintShape(g, [[1110, y - 18], [1196, y - 4], [1186, y + 22], [1104, y + 6]], {
        color: S.mixHex(P.rust, P.linen, 0.3),
        light: 0.25,
        shadow: 0.4,
        strokes: 3,
        rim: 0.3,
        wobble: 1.2,
        seed: 8221,
      });
      paintShape(g, roundedRectPoints(1130, y - 30, 56, 18, 7), {
        color: S.mixHex(P.taupe, P.linen, 0.25),
        light: 0.3,
        shadow: 0.4,
        strokes: 3,
        rim: 0.3,
        wobble: 1,
        seed: 8222,
      });
      paintClock(g, 1232, y + 8, -0.12, clean);
    } else {
      // Rolled and tied, waiting at the door end of the room.
      const cx = 400;
      const y = 948;
      softShadow(g, cx, y + 26, 46, 7, 0.45);
      paintShape(g, ellipsePoints(cx, y, 40, 26, 30), {
        color: S.mixHex(P.moss, P.gear, 0.4),
        lightDir: LIGHT_DIR,
        light: 0.3,
        shadow: 0.45,
        strokes: 5,
        rim: 0.35,
        wobble: 1,
        seed: 8223,
      });
      g.strokeStyle = S.rgba(P.soot, 0.35);
      g.lineWidth = 1.5;
      for (const r of [10, 18]) {
        g.beginPath();
        g.ellipse(cx + 6, y, r, r * 0.65, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = S.mixHex(P.rust, P.linen, 0.2);
      g.lineWidth = 3;
      for (const dx of [-16, 18]) {
        g.beginPath();
        g.moveTo(cx + dx, y - 26);
        g.lineTo(cx + dx + 2, y + 26);
        g.stroke();
      }
    }
  }

  // ── Front layer ───────────────────────────────────────────────────────

  function paintFront(g, clean) {
    g.save();
    g.filter = 'blur(7px)';
    // A wicker chair with a dressing gown over its back, bottom right.
    paintShape(g, [[1780, 1080], [1790, 880], [1830, 860], [1940, 860], [1940, 1080]], {
      color: S.mixHex(P.oak, P.soot, 0.45),
      light: 0.1,
      shadow: 0.4,
      strokes: 8,
      rim: 0.2,
      wobble: 2,
      seed: 8230,
    });
    paintShape(g, [[1800, 870], [1880, 846], [1900, 1000], [1840, 1060], [1810, 980]], {
      color: S.mixHex(P.plum, P.soot, clean ? 0.3 : 0.45),
      light: 0.1,
      shadow: 0.4,
      strokes: 8,
      strokeAngle: Math.PI / 2,
      rim: 0.2,
      wobble: 2,
      seed: 8231,
    });
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
      noise: S.createNoise(seed + 80),
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

  // Beyond the window: night sky, a moon, chimneys across the road; dawn.
  function drawSky(g, live, t, mk) {
    const { x, y, w, h } = WINDOW;
    const day = mk.window;
    const sky = g.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, S.mix(S.moods.dirty.windowSkyTop, S.moods.clean.windowSkyTop, day));
    sky.addColorStop(1, S.mix(S.moods.dirty.windowSkyBottom, S.moods.clean.windowSkyBottom, day));
    g.fillStyle = sky;
    g.fillRect(x - 4, y - 4, w + 8, h + 8);
    if (day < 1) {
      g.fillStyle = `rgba(232,238,248,${1 - day})`;
      g.beginPath();
      g.arc(x + w * 0.7, y + 64 + day * 160, 20, 0, Math.PI * 2);
      g.fill();
      for (const [sx, sy] of [[0.15, 0.12], [0.32, 0.3], [0.5, 0.08], [0.88, 0.4], [0.24, 0.48]]) {
        g.fillStyle = `rgba(232,238,248,${0.6 * (1 - day)})`;
        g.fillRect(x + sx * w, y + sy * h, 2, 2);
      }
    }
    if (day > 0) {
      const sun = g.createRadialGradient(x + w * 0.35, y + h + 20 - day * 120, 6, x + w * 0.35, y + h - day * 120, 180);
      sun.addColorStop(0, `rgba(255,236,190,${day})`);
      sun.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = sun;
      g.fillRect(x, y, w, h);
    }
    // Rooftops and chimneys over the road.
    g.fillStyle = S.mix('#0B0D13', '#5A5F66', day);
    g.beginPath();
    g.moveTo(x - 4, y + h + 4);
    g.lineTo(x - 4, y + h - 50);
    g.lineTo(x + 60, y + h - 86);
    g.lineTo(x + 120, y + h - 54);
    g.lineTo(x + 150, y + h - 70);
    g.lineTo(x + 152, y + h - 104);
    g.lineTo(x + 166, y + h - 104);
    g.lineTo(x + 168, y + h - 76);
    g.lineTo(x + w + 4, y + h - 60);
    g.lineTo(x + w + 4, y + h + 4);
    g.closePath();
    g.fill();
    void live;
    void t;
  }

  // A wardrobe door swung open by `open` (0 shut … 1 wide). It turns on its
  // outer hinge toward the viewer, so from the front it narrows toward the
  // hinge, its free edge grows a little as it comes closer, and the edge of
  // the door shows.
  function drawOpenDoor(g, live, side, open, clean) {
    const r = doorRect(side);
    const c = sprite(live, `door${side}:${clean}`, r.w, r.h, (dg) => paintWardrobeDoor(dg, side, clean, 0, 0, true));
    const ang = open * 1.25; // radians
    const w = Math.max(2, r.w * Math.cos(ang));
    const edge = Math.sin(ang) * 12;
    const grow = open * 10;
    const x = side === 0 ? r.x : r.x + r.w - w;
    const free = side === 0 ? x + w : x - edge;
    g.save();
    // The leaf, a trapezium: the free edge taller than the hinge edge.
    const hingeSide = side === 0 ? 0 : 1;
    const slices = 8;
    for (let i = 0; i < slices; i++) {
      const u = i / slices;
      const sx = (u * r.w);
      const toward = hingeSide === 0 ? u : 1 - u; // 0 at the hinge, 1 at the free edge
      const dy = grow * toward;
      g.drawImage(c, sx, 0, r.w / slices + 0.5, r.h, x + u * w, r.y - dy, w / slices + 0.5, r.h + dy * 2);
    }
    g.fillStyle = S.rgba(P.soot, 0.3 * open);
    g.beginPath();
    g.moveTo(x, r.y - (hingeSide === 0 ? 0 : grow));
    g.lineTo(x + w, r.y - (hingeSide === 0 ? grow : 0));
    g.lineTo(x + w, r.y + r.h + (hingeSide === 0 ? grow : 0));
    g.lineTo(x, r.y + r.h + (hingeSide === 0 ? 0 : grow));
    g.closePath();
    g.fill();
    // The thickness of the door at its free edge.
    g.fillStyle = aged(S.shadeHex(TONE.woodLight, -0.1), clean);
    g.fillRect(free, r.y - grow, edge, r.h + grow * 2);
    g.restore();
  }

  // The nest inside the wardrobe: a thick pale sheet of silk across the
  // dark interior, clusters of eggs knotted into it, a faint light from
  // within. It tears as it is hit (torn 0 … 1) and hangs in rags once gone.
  function nestSprite(live, torn, destroyed) {
    const step = destroyed ? 9 : Math.round(torn * 8);
    const { x0, x1 } = WARDROBE;
    const w = x1 - x0 - 20;
    const h = WR_DOORS.y1 - WR_DOORS.y0;
    return sprite(live, `nest${step}`, w, h, (g) => {
      // The dark inside of the wardrobe, a rail and an old coat.
      const inside = g.createLinearGradient(0, 0, 0, h);
      inside.addColorStop(0, S.mixHex(P.soot, P.walnut, 0.4));
      inside.addColorStop(1, P.soot);
      g.fillStyle = inside;
      g.fillRect(0, 0, w, h);
      g.fillStyle = S.rgba(P.brass, 0.5);
      g.fillRect(6, 40, w - 12, 4);
      g.fillStyle = S.rgba(S.mixHex(P.plum, P.soot, 0.4), 0.9);
      g.beginPath();
      g.moveTo(18, 62);
      g.lineTo(62, 62);
      g.lineTo(74, 300);
      g.lineTo(8, 300);
      g.closePath();
      g.fill();
      const rng = S.createRng(8300);
      const keep = destroyed ? 0.12 : 1 - (step / 8) * 0.55;
      // The sheet on its own canvas, so tears can be cut from it alone.
      const sheet = S.makeCanvas(w, h);
      const sg = sheet.getContext('2d');
      const glow = sg.createRadialGradient(w / 2, h * 0.46, 10, w / 2, h * 0.46, h * 0.62);
      glow.addColorStop(0, S.rgba(P.silk, 0.92));
      glow.addColorStop(0.55, S.rgba(P.silk, 0.68));
      glow.addColorStop(1, S.rgba(P.silk, 0.3));
      sg.fillStyle = glow;
      sg.beginPath();
      sg.moveTo(0, 14);
      for (let x = 0; x <= w; x += 18) sg.lineTo(x, 14 + rng.range(-6, 12));
      sg.lineTo(w, h - 16);
      for (let x = w; x >= 0; x -= 18) sg.lineTo(x, h - 16 + rng.range(-16, 10));
      sg.closePath();
      sg.fill();
      // Felted drifts, darker folds and strands over the top.
      for (let i = 0; i < 12; i++) {
        sg.fillStyle = S.rgba(i % 3 ? P.bone : P.taupe, i % 3 ? 0.18 : 0.14);
        sg.beginPath();
        sg.ellipse(rng.range(10, w - 10), rng.range(40, h - 40), rng.range(30, 80), rng.range(50, 130), rng.range(-0.5, 0.5), 0, Math.PI * 2);
        sg.fill();
      }
      sg.lineCap = 'round';
      for (let i = 0; i < 220; i++) {
        const ax = rng.range(0, w);
        const ay = rng.range(10, h - 10);
        const bx = ax + rng.range(-120, 120);
        const by = ay + rng.range(-160, 160);
        sg.strokeStyle = S.rgba(i % 4 ? P.silk : P.taupe, rng.range(0.15, 0.45));
        sg.lineWidth = rng.range(0.6, 2.2);
        sg.beginPath();
        sg.moveTo(ax, ay);
        sg.quadraticCurveTo((ax + bx) / 2 + rng.range(-20, 20), (ay + by) / 2 + 20, bx, by);
        sg.stroke();
      }
      // Tears: ragged slits, one per hit, each pulled open a little.
      sg.globalCompositeOperation = 'destination-out';
      const trng = S.createRng(8301);
      const slits = destroyed ? 14 : step;
      for (let i = 0; i < slits; i++) {
        const tx = trng.range(24, w - 24);
        const ty = trng.range(70, h - 70);
        const len = trng.range(50, 110);
        const wide = trng.range(8, 18);
        sg.fillStyle = 'rgba(0,0,0,0.92)';
        sg.beginPath();
        sg.moveTo(tx, ty - len / 2);
        for (let k = 1; k <= 6; k++) sg.lineTo(tx + wide * Math.sin((k / 6) * Math.PI) + trng.range(-3, 3), ty - len / 2 + (k / 6) * len);
        for (let k = 5; k >= 1; k--) sg.lineTo(tx - wide * 0.6 * Math.sin((k / 6) * Math.PI) + trng.range(-3, 3), ty - len / 2 + (k / 6) * len);
        sg.closePath();
        sg.fill();
      }
      if (destroyed) {
        sg.fillStyle = 'rgba(0,0,0,0.75)';
        sg.fillRect(0, 0, w, h);
      }
      sg.globalCompositeOperation = 'source-over';
      g.globalAlpha = Math.min(1, keep + 0.25);
      g.drawImage(sheet, 0, 0);
      g.globalAlpha = 1;
      // Egg clusters: knots of round eggs. Each hit or so bursts one, which
      // leaves a yellowed smear.
      const clusters = [[w * 0.5, h * 0.42, 30], [w * 0.26, h * 0.6, 22], [w * 0.74, h * 0.3, 20], [w * 0.64, h * 0.7, 24], [w * 0.3, h * 0.24, 16], [w * 0.78, h * 0.52, 16], [w * 0.4, h * 0.82, 18]];
      clusters.forEach(([cx, cy, r], i) => {
        if (destroyed || i < step * 0.8) {
          // A burst cluster: a yellowed smear and a few empty shells.
          const smear = g.createRadialGradient(cx, cy, 2, cx, cy, r);
          smear.addColorStop(0, S.rgba(S.mixHex(P.goo, P.linen, 0.4), 0.3));
          smear.addColorStop(1, S.rgba(P.goo, 0));
          g.fillStyle = smear;
          g.fillRect(cx - r, cy - r, r * 2, r * 2);
          g.strokeStyle = S.rgba(P.eggSac, 0.5);
          g.lineWidth = 1;
          for (let k = 0; k < 4; k++) {
            g.beginPath();
            g.arc(cx + rng.range(-r * 0.6, r * 0.6), cy + rng.range(-r * 0.4, r * 0.4), rng.range(3, 5), 0.3, Math.PI * 1.6);
            g.stroke();
          }
          return;
        }
        for (let k = 0; k < r * 1.1; k++) {
          const a = rng.range(0, Math.PI * 2);
          const d = Math.sqrt(rng.next()) * r;
          const ex = cx + Math.cos(a) * d;
          const ey = cy + Math.sin(a) * d * 0.8;
          const er = rng.range(4, 7.5);
          g.fillStyle = S.mixHex(P.eggSac, P.linen, rng.range(0, 0.4));
          g.beginPath();
          g.arc(ex, ey, er, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = S.rgba(P.bone, 0.7);
          g.beginPath();
          g.arc(ex - er * 0.35, ey - er * 0.35, er * 0.35, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = S.rgba(P.soot, 0.3);
          g.lineWidth = 0.8;
          g.beginPath();
          g.arc(ex, ey, er, 0, Math.PI * 2);
          g.stroke();
        }
        g.strokeStyle = S.rgba(P.silk, 0.55);
        g.lineWidth = 1;
        for (let k = 0; k < 6; k++) {
          g.beginPath();
          g.ellipse(cx, cy, r * rng.range(0.8, 1.2), r * rng.range(0.4, 0.8), rng.range(0, Math.PI), 0, Math.PI * 2);
          g.stroke();
        }
      });
      if (destroyed) {
        // Rags hanging from the top and the rail.
        for (let i = 0; i < 9; i++) {
          const rx = trng.range(10, w - 10);
          const len = trng.range(40, 160);
          g.strokeStyle = S.rgba(P.silk, 0.45);
          g.lineWidth = trng.range(1, 3);
          g.beginPath();
          g.moveTo(rx, 20);
          g.quadraticCurveTo(rx + trng.range(-14, 14), 20 + len * 0.6, rx + trng.range(-8, 8), 20 + len);
          g.stroke();
        }
      }
    });
  }

  // The wardrobe once it is cleaned: clothes on the rail, a hat box on the
  // shelf, shoes in a row.
  function tidySprite(live) {
    const w = WARDROBE.x1 - WARDROBE.x0 - 20;
    const h = WR_DOORS.y1 - WR_DOORS.y0;
    return sprite(live, 'tidy', w, h, (g) => {
      const inside = g.createLinearGradient(0, 0, 0, h);
      inside.addColorStop(0, S.mixHex(P.walnut, P.oak, 0.3));
      inside.addColorStop(1, S.mixHex(P.walnut, P.soot, 0.4));
      g.fillStyle = inside;
      g.fillRect(0, 0, w, h);
      g.fillStyle = S.mixHex(P.oak, P.linen, 0.2);
      g.fillRect(0, 26, w, 6);
      paintHatBox(g, w * 0.3, 24, 30, 20, 'sage', true, 8310);
      g.fillStyle = P.brass;
      g.fillRect(6, 56, w - 12, 4);
      const hang = (x, hex, len, wide, seed) => {
        g.strokeStyle = S.rgba(P.linen, 0.6);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, 54);
        g.lineTo(x, 62);
        g.lineTo(x - wide * 0.45, 72);
        g.lineTo(x + wide * 0.45, 72);
        g.closePath();
        g.stroke();
        paintShape(g, [[x - wide * 0.45, 72], [x + wide * 0.45, 72], [x + wide * 0.55, 72 + len], [x - wide * 0.55, 72 + len]], {
          color: hex,
          lightDir: LIGHT_DIR,
          light: 0.25,
          shadow: 0.45,
          strokes: 5,
          strokeAngle: Math.PI / 2,
          rim: 0.3,
          wobble: 1,
          seed,
        });
      };
      hang(34, S.mixHex(P.plum, P.linen, 0.35), 300, 54, 8311); // a long dress
      hang(90, S.mixHex(P.taupe, P.umber, 0.3), 170, 60, 8312); // his jacket
      hang(150, S.mixHex(P.linen, P.bone, 0.3), 150, 50, 8313); // a shirt
      hang(204, S.mixHex(P.moss, P.linen, 0.3), 230, 52, 8314); // a coat
      for (const [sx, hex] of [[40, P.rust], [100, P.walnut], [160, P.umber]]) {
        g.fillStyle = S.mixHex(hex, P.oak, 0.2);
        g.beginPath();
        g.ellipse(sx, h - 14, 22, 8, 0, Math.PI, 0);
        g.fill();
      }
      const shade = g.createLinearGradient(0, 0, w, 0);
      shade.addColorStop(0, S.rgba(P.soot, 0.45));
      shade.addColorStop(0.5, S.rgba(P.soot, 0.05));
      shade.addColorStop(1, S.rgba(P.soot, 0.45));
      g.fillStyle = shade;
      g.fillRect(0, 0, w, h);
    });
  }

  function drawWardrobe(g, live, mk) {
    const n = nestState(live);
    const open = n.destroyed ? Math.max(n.open, 1) : n.open;
    if (open <= 0.01) return;
    const clean = mk.wipe >= 0.999 ? true : mk.sweepX > (WARDROBE.x0 + WARDROBE.x1) / 2;
    const nest = clean ? tidySprite(live) : nestSprite(live, n.torn, n.destroyed);
    g.drawImage(nest, WARDROBE.x0 + 10, WR_DOORS.y0);
    // Shadow thrown in by the opening doors.
    g.fillStyle = S.rgba(P.soot, 0.3 * (1 - open));
    g.fillRect(WARDROBE.x0 + 10, WR_DOORS.y0, WARDROBE.x1 - WARDROBE.x0 - 20, WR_DOORS.y1 - WR_DOORS.y0);
    drawOpenDoor(g, live, 0, open, clean);
    drawOpenDoor(g, live, 1, open, clean);
  }

  // The vanity bulbs: a ring of round globes, each lighting in turn at the
  // `lights` beat (0.12 s apart).
  function bulbOn(i, mk) {
    if (!(mk.lights > 0)) return 0;
    return S.clamp((mk.t - (3.3 + i * 0.12)) / 0.1, 0, 1) || (mk.lights >= 1 ? 1 : 0);
  }

  function drawBulbs(g, mk) {
    BULBS.forEach(([bx, by], i) => {
      const on = bulbOn(i, mk);
      const glass = g.createRadialGradient(bx - 2, by - 2, 1, bx, by, 6.5);
      glass.addColorStop(0, S.mix(S.mixHex(P.linen, P.taupe, 0.3), P.bone, on));
      glass.addColorStop(1, S.mix(S.mixHex(P.taupe, P.umber, 0.4), P.amber, on));
      g.fillStyle = glass;
      g.beginPath();
      g.arc(bx, by, 6, 0, Math.PI * 2);
      g.fill();
    });
  }

  // The wedding photograph in a silver frame. Face down on the table in the
  // dirty room, its glass cracked; it stands up at the `photo` beat.
  function photoSprite(live) {
    return sprite(live, 'photo', 64, 88, (g) => {
      const silver = g.createLinearGradient(0, 0, 64, 88);
      silver.addColorStop(0, '#D8D4CC');
      silver.addColorStop(0.5, '#8E8A84');
      silver.addColorStop(1, '#C4C0B8');
      g.fillStyle = silver;
      g.fillRect(0, 0, 64, 88);
      g.fillStyle = '#5E5A55';
      g.fillRect(3, 3, 58, 82);
      g.fillStyle = S.mixHex(P.bone, P.linen, 0.4);
      g.fillRect(5, 5, 54, 78);
      // The print: black and white, a couple on church steps.
      const print = g.createLinearGradient(0, 9, 0, 59);
      print.addColorStop(0, '#9C9890');
      print.addColorStop(1, '#5E5B56');
      g.fillStyle = print;
      g.fillRect(9, 9, 46, 50);
      g.fillStyle = '#7A7771';
      g.fillRect(9, 46, 46, 13);
      // He: dark suit, a pale shirt front.
      g.fillStyle = '#2A2826';
      g.beginPath();
      g.moveTo(22, 58);
      g.lineTo(23, 31);
      g.quadraticCurveTo(27, 27, 32, 31);
      g.lineTo(33, 58);
      g.closePath();
      g.fill();
      g.fillStyle = '#D8D4CC';
      g.beginPath();
      g.moveTo(26.5, 31);
      g.lineTo(28.5, 31);
      g.lineTo(27.5, 40);
      g.closePath();
      g.fill();
      g.fillStyle = '#B8B2A8';
      g.beginPath();
      g.arc(27.5, 25, 4.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#3A3634';
      g.beginPath();
      g.arc(27.5, 23.5, 4.2, Math.PI, 0);
      g.fill();
      // She: a white dress and a veil falling behind her.
      g.fillStyle = 'rgba(236,232,224,0.55)';
      g.beginPath();
      g.moveTo(38, 21);
      g.quadraticCurveTo(48, 30, 50, 58);
      g.lineTo(34, 58);
      g.closePath();
      g.fill();
      g.fillStyle = '#ECE8E0';
      g.beginPath();
      g.moveTo(35, 58);
      g.lineTo(37, 34);
      g.quadraticCurveTo(39.5, 31, 42, 34);
      g.lineTo(46, 58);
      g.closePath();
      g.fill();
      g.fillStyle = '#B8B2A8';
      g.beginPath();
      g.arc(39.5, 27.5, 3.8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ECE8E0';
      g.beginPath();
      g.arc(39.5, 25, 4, Math.PI * 1.05, Math.PI * 1.95);
      g.fill();
      // A posy of flowers between them.
      g.fillStyle = '#E0DCD4';
      g.beginPath();
      g.arc(35, 42, 2.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.rgba(P.walnut, 0.9);
      g.font = '700 10px Caveat, "Segoe Print", cursive';
      g.textAlign = 'center';
      g.fillText('Arthur & Eleanor', 32, 70);
      g.fillText('1968', 32, 80);
      // A sheen over the glass.
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.beginPath();
      g.moveTo(5, 30);
      g.lineTo(30, 5);
      g.lineTo(40, 5);
      g.lineTo(5, 40);
      g.closePath();
      g.fill();
    });
  }

  const PHOTO = { x: 1480, base: TABLE.top - 4 };
  function drawPhoto(g, live, mk) {
    const up = S.clamp(mk.photo ?? 0, 0, 1);
    const { x, base } = PHOTO;
    if (up <= 0.001) {
      // Face down: only its back and the strut show, lying flat.
      softShadow(g, x, base + 2, 36, 4, 0.4);
      g.fillStyle = S.mixHex(P.walnut, P.taupe, 0.3);
      g.fillRect(x - 32, base - 6, 64, 7);
      g.fillStyle = '#8E8A84';
      g.fillRect(x - 33, base - 1, 66, 2);
      g.strokeStyle = S.rgba(P.bone, 0.4);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(x + 20, base + 1);
      g.lineTo(x + 26, base - 1);
      g.stroke();
      return;
    }
    // Standing up: rotate from flat to upright, hinged at its bottom edge.
    const ph = photoSprite(live);
    const ease = S.ease.inOut(up);
    const hgt = 88 * Math.sin(ease * Math.PI / 2);
    softShadow(g, x + 6, base + 1, 36, 4, 0.4);
    g.drawImage(ph, x - 32, base - hgt, 64, hgt);
    if (ease < 0.6) {
      g.fillStyle = S.rgba(P.soot, 0.5 * (1 - ease / 0.6));
      g.fillRect(x - 32, base - hgt, 64, hgt);
    }
  }

  // The radio's dial: flickering in the dirty room, a warm steady glow once
  // the `radio` beat has cleared the static.
  function dialGlow(live, t, mk) {
    const r = S.clamp(mk.radio ?? 0, 0, 1);
    const flick = S.light.flicker(live.noise, t * 1.3, 2.2);
    return S.lerp(0.25 + 0.35 * flick, 1, r);
  }

  function drawRadioDial(g, live, t, mk) {
    const on = dialGlow(live, t, mk);
    const { x, y, w } = RADIO;
    g.fillStyle = S.rgba(P.amber, 0.25 + 0.55 * on);
    g.fillRect(x + w * 0.55, y + 8, w * 0.38, 12);
    g.fillStyle = S.rgba(P.ember, 0.9);
    const needle = x + w * 0.58 + (0.55 + 0.25 * S.clamp(mk.radio ?? 0, 0, 1) + live.noise(t * 0.2) * 0.04) * w * 0.32;
    g.fillRect(needle, y + 8, 1.5, 12);
  }

  // The quilt's dent after a bounce: a soft shadow on the mattress top at
  // the landing point, which fills back in as the quilt recovers.
  function drawBedDent(g, live) {
    const d = bedDent(live);
    if (!d || !(d.depth > 0.01)) return;
    const dent = g.createRadialGradient(d.x, BED.top - 12, 2, d.x, BED.top - 12, 70);
    dent.addColorStop(0, S.rgba(P.soot, 0.4 * d.depth));
    dent.addColorStop(1, S.rgba(P.soot, 0));
    g.fillStyle = dent;
    g.beginPath();
    g.ellipse(d.x, BED.top - 12, 76, 10 + 6 * d.depth, 0, 0, Math.PI * 2);
    g.fill();
  }

  function drawProps(g, live, t, mk) {
    void g;
    void live;
    void t;
    void mk;
  }

  function drawOnFurniture(g, live, t, mk) {
    drawWardrobe(g, live, mk);
    drawBedDent(g, live);
    drawBulbs(g, mk);
    drawPhoto(g, live, mk);
    drawRadioDial(g, live, t, mk);
  }

  // ── Light ─────────────────────────────────────────────────────────────

  // The lace's pattern in moonlight: painted once into two small canvases
  // (moon and dawn), then added into the light map each frame. Rosettes in
  // rows, stretched as the light falls away from the window, so the shapes
  // stay soft without a blur.
  const LACE_BOX = { x: 520, y: 470, w: 720, h: 540 };
  function lacePattern(live, hex) {
    return sprite(live, `lace:${hex}`, LACE_BOX.w / 2, LACE_BOX.h / 2, (g) => {
      g.scale(0.5, 0.5);
      g.translate(-LACE_BOX.x, -LACE_BOX.y);
      const { x, w } = WINDOW;
      const y0 = WINDOW.y + WINDOW.h + 4;
      const y1 = LACE_BOX.y + LACE_BOX.h - 10;
      const top = [x + 6, x + w - 6];
      const bot = [LACE_BOX.x + 70, LACE_BOX.x + LACE_BOX.w - 50];
      const at = (u, v) => {
        const vv = Math.pow(v, 0.85);
        const y = S.lerp(y0, y1, vv);
        const xa = S.lerp(top[0], bot[0], vv);
        const xb = S.lerp(top[1], bot[1], vv);
        return [S.lerp(xa, xb, u), y];
      };
      const quad = (u0, v0, u1, v1) => {
        const pts = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
        g.closePath();
      };
      // The pool of light the window lets in: nested, so its edges are soft.
      for (const [inset, a] of [[-0.05, 0.12], [0, 0.22], [0.06, 0.26], [0.14, 0.2]]) {
        g.fillStyle = S.rgba(hex, a);
        quad(inset, inset * 0.5, 1 - inset, 1 - inset * 0.3);
        g.fill();
      }
      // Fading as it falls away from the window.
      g.globalCompositeOperation = 'destination-out';
      const fade = g.createLinearGradient(0, y0, 0, y1);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = fade;
      g.fillRect(LACE_BOX.x, LACE_BOX.y, LACE_BOX.w, LACE_BOX.h);
      // The lace itself, as shadow: a fine net, flowers in rows, and the
      // scalloped border along the hem, all cut out of the light.
      g.lineCap = 'round';
      const line = (pts, width, a) => {
        g.strokeStyle = `rgba(0,0,0,${a})`;
        g.lineWidth = width;
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
        g.stroke();
      };
      for (let k = -1; k <= 1.001; k += 0.08) {
        const a = [];
        const b = [];
        for (let v = 0; v <= 1.001; v += 0.1) {
          a.push(at(k + v * 0.9, v));
          b.push(at(k + 0.9 - v * 0.9, v));
        }
        line(a, 2.2, 0.32);
        line(b, 2.2, 0.32);
      }
      const rows = 7;
      const cols = 5;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const u = (i + 0.5 + (j % 2) * 0.5) / (cols + 0.5);
          const v = (j + 0.55) / (rows + 0.6);
          if (u > 0.97) continue;
          const [px, py] = at(u, v);
          const sc = S.lerp(1, 2, v);
          // A flower: six petals round a ring, each an outline.
          for (let k = 0; k < 6; k++) {
            const ang = (k / 6) * Math.PI * 2;
            g.strokeStyle = 'rgba(0,0,0,0.7)';
            g.lineWidth = 3 * sc;
            g.beginPath();
            g.ellipse(px + Math.cos(ang) * 11 * sc, py + Math.sin(ang) * 7 * sc, 7 * sc, 3.6 * sc, ang, 0, Math.PI * 2);
            g.stroke();
          }
          g.fillStyle = 'rgba(0,0,0,0.75)';
          g.beginPath();
          g.ellipse(px, py, 4 * sc, 2.6 * sc, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      // The scalloped border near the bottom of the pool.
      for (let i = 0; i < 9; i++) {
        const [px, py] = at((i + 0.5) / 9, 0.92);
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.lineWidth = 6;
        g.beginPath();
        g.arc(px, py, 22, 0.15 * Math.PI, 0.85 * Math.PI);
        g.stroke();
      }
      // The glazing bars: two uprights and the meeting rail.
      for (const u of [1 / 3, 2 / 3]) line([at(u, 0), at(u, 1)], 12, 0.6);
      line([at(0, 0.45), at(1, 0.45)], 18, 0.6);
      g.globalCompositeOperation = 'source-over';
    });
  }

  function laceLight(lm, live, mk) {
    const g = lm.ctx; // begin() leaves it in stage units, compositing 'lighter'
    const day = mk.window;
    const moon = lacePattern(live, P.moon);
    const dawn = lacePattern(live, P.dawn);
    const { x, y, w, h } = LACE_BOX;
    g.save();
    if (day < 1) {
      g.globalAlpha = 1 - day;
      g.drawImage(moon, x, y, w, h);
    }
    if (day > 0) {
      g.globalAlpha = 0.85 * day;
      g.drawImage(dawn, x, y, w, h);
    }
    g.restore();
    lm.lights.push({ kind: 'shaft', quad: [[x + 240, y], [x + 480, y], [x + w - 40, y + h], [x + 60, y + h]], intensity: S.lerp(0.6, 0.75, day) });
  }

  function leftLamp(live, t, mk) {
    // Works, dimly, and stutters in the dirty room; steady once clean.
    const flick = S.light.flicker(live.noise, t + 3, 0.8);
    return S.lerp(0.45 * (0.75 + 0.25 * flick), 1, mk.wipe);
  }

  function rightLamp(mk) {
    // Dead until the sweep has passed it.
    return S.clamp((mk.sweepX - RIGHT_STAND.x1) / 220, 0, 1);
  }

  function lampLight(lm, cx, top, on) {
    if (on <= 0.01) return;
    const sy = top - 100;
    lm.point(cx, sy, 340, P.amber, 0.7 * on);
    lm.cone(cx, sy + 20, Math.PI / 2, 1.9, 320, P.amber, 0.55 * on);
    lm.cone(cx, sy - 24, -Math.PI / 2, 1.2, 200, P.amber, 0.3 * on);
  }

  function lights(lm, live, t, mk) {
    const win = S.mixHex(P.moon, P.dawn, mk.window);
    const { x, y, w, h } = WINDOW;
    lm.point(x + w / 2, y + h / 2, 420, win, S.lerp(0.5, 0.8, mk.window));
    laceLight(lm, live, mk);
    lampLight(lm, (LEFT_STAND.x0 + LEFT_STAND.x1) / 2 - 18, LEFT_STAND.top, leftLamp(live, t, mk));
    lampLight(lm, (RIGHT_STAND.x0 + RIGHT_STAND.x1) / 2, RIGHT_STAND.top, rightLamp(mk));
    // The vanity bulbs: each a little point, and together a pool on the
    // table and the wall.
    let sum = 0;
    BULBS.forEach(([bx, by], i) => {
      const on = bulbOn(i, mk);
      sum += on;
      if (on > 0.01) lm.point(bx, by, 70, P.amber, 0.5 * on);
    });
    const pool = sum / BULBS.length;
    if (pool > 0.01) {
      lm.point(1480, 560, 420, P.amber, 0.6 * pool);
      lm.point(1480, TABLE.top, 300, P.dawn, 0.5 * pool);
    }
    // The radio: a faint dial glow when dirty, a small warm light of its
    // own once it plays.
    const dial = dialGlow(live, t, mk);
    lm.point(RADIO.x + RADIO.w * 0.75, RADIO.y + 14, S.lerp(60, 150, mk.radio ?? 0), P.amber, 0.25 + 0.3 * dial * S.lerp(0.4, 1, mk.radio ?? 0));
    // The nest's own faint light, when the doors are open.
    const n = nestState(live);
    const open = n.destroyed ? 1 : n.open;
    if (open > 0.01 && !n.destroyed && mk.sweepX < 250) {
      lm.point(250, 540, 340, P.silk, 0.85 * open * (1 - n.torn * 0.45));
      lm.point(250, 540, 140, P.bone, 0.4 * open * (1 - n.torn * 0.45));
    }
    // Moonlight caught in the dressing-table mirror, thrown across to the
    // chest of drawers, so the right side of the dark room still reads.
    lm.point(1690, 800, 300, P.moon, S.lerp(0.3, 0, mk.window));
    return 1;
  }

  function glow(g, lm, live, t, mk) {
    const winHex = mk.window > 0.5 ? P.dawn : P.moon;
    const { x, y, w, h } = WINDOW;
    S.light.glow(g, x + w / 2, y + h / 2, 200, winHex, S.lerp(0.16, 0.26, mk.window));
    const l = leftLamp(live, t, mk);
    if (l > 0.01) S.light.glow(g, (LEFT_STAND.x0 + LEFT_STAND.x1) / 2 - 18, LEFT_STAND.top - 100, 70, P.amber, 0.55 * l);
    const r = rightLamp(mk);
    if (r > 0.01) S.light.glow(g, (RIGHT_STAND.x0 + RIGHT_STAND.x1) / 2, RIGHT_STAND.top - 100, 70, P.amber, 0.55 * r);
    BULBS.forEach(([bx, by], i) => {
      const on = bulbOn(i, mk);
      if (on > 0.01) S.light.glow(g, bx, by, 16, P.bone, 0.7 * on);
    });
    const dial = dialGlow(live, t, mk);
    S.light.glow(g, RADIO.x + RADIO.w * 0.75, RADIO.y + 14, 22, P.amber, 0.35 * dial);
    void lm;
  }

  function beat() {}

  S.rooms.attachArt('master-bedroom', {
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
