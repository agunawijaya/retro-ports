/*
 * Spyder — Room 11, the Upstairs Bathroom: painting, light and glow.
 *
 * The logic is in room.js (layout, the hot tap and the steam, the laundry
 * basket lair, the chute that rattles, the QA states). This file paints, and
 * reads what room.js keeps on `live` (`steam`, `tapRunning`, `basketLid`,
 * `chuteShake`, and `world` for the mirror pass) and the makeover values on
 * `mk` (`skylight`, `bulbs`, `cup`).
 *
 * The family bathroom under the roof, the sibling of the cold narrow one
 * downstairs: warm pink and cream 1960s tiles, a ceiling that slopes down to
 * the bath, a shuttered skylight in the slope, and a mirror the width of the
 * vanity that shows the room behind you, small and reversed.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const { paintShape, rectPoints, roundedRectPoints, ellipsePoints, softShadow, stain } = S.paint;

  // ── Layout (must match room.js) ───────────────────────────────────────

  const CEILING = 110;
  const FLOOR_LINE = 770;
  const TILE_TOP = 600; // the black pencil border; painted wall above
  const SLOPE = { x0: 120, y0: 300, x1: 900, y1: 110 };
  const slopeY = (x) => S.lerp(SLOPE.y0, SLOPE.y1, S.clamp((x - SLOPE.x0) / (SLOPE.x1 - SLOPE.x0), 0, 1));
  // The skylight lies in the slope: a parallelogram whose bottom edge runs
  // just above the line where the roof meets the wall.
  const SKY = (() => {
    const x0 = 392;
    const x1 = 608;
    const lift = 12;
    const depth = 92;
    return {
      x0,
      x1,
      bl: [x0, slopeY(x0) - lift],
      br: [x1, slopeY(x1) - lift],
      tr: [x1, slopeY(x1) - lift - depth],
      tl: [x0, slopeY(x0) - lift - depth],
    };
  })();
  const BATH = { x0: 160, x1: 620, rim: 780, base: 935 };
  const VANITY = { x0: 760, x1: 1380, top: 760, base: 930, tapX: 880, tapY: 730 };
  const BASINS = [920, 1220];
  const MIRROR = { x: 760, y: 330, w: 620, h: 370 };
  const GLASS = { x: 770, y: 340, w: 600, h: 350 };
  const CUP_X = 1060;
  const CUPBOARD = { x0: 1460, x1: 1680, y0: 330, y1: 850, shelf: 620 };
  const STOOL = { x0: 1400, x1: 1460, top: 840 };
  const BASKET = { x0: 1720, x1: 1840, top: 840, base: 935 };
  const CHUTE = { x0: 1720, x1: 1820, y0: 560, y1: 640 };
  const LIGHT_DIR = { x: -0.35, y: -0.94 }; // the skylight is up and to the left

  const TONE = {
    // A warm 1960s pink: bone warmed with ember, a touch of plum to cool it.
    pink: S.mixHex(S.mixHex(P.bone, P.ember, 0.3), P.plum, 0.12),
    pinkDeep: S.mixHex(S.mixHex(P.bone, P.ember, 0.42), P.plum, 0.22),
    cream: S.mixHex(P.bone, P.linen, 0.3),
    paint: S.mixHex(P.bone, P.plum, 0.12),
    paintDirty: S.mixHex(S.mixHex(P.linen, P.taupe, 0.4), P.oak, 0.12),
    boards: S.mixHex(P.linen, P.bone, 0.3),
    boardsDirty: S.mixHex(P.taupe, P.linen, 0.35),
    enamel: S.mixHex(S.mixHex(P.bone, P.ember, 0.26), P.plum, 0.14),
    chrome: S.mixHex(P.gear, P.bone, 0.45),
    wood: S.mixHex(P.oak, P.linen, 0.25),
    wicker: S.mixHex(P.oak, P.linen, 0.35),
  };

  const aged = (hex, clean, k = 1) => (clean ? hex : S.mixHex(S.shadeHex(hex, -0.2 * k), P.taupe, 0.22 * k));

  function poly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
    g.closePath();
  }

  // ── Back layer ────────────────────────────────────────────────────────

  function paintBack(g, clean) {
    paintWall(g, clean);
    paintTiles(g, clean);
    paintCeiling(g, clean);
    paintSkylightFrame(g, clean);
    paintChute(g, clean, 0);
    paintFloor(g, clean);
  }

  // Painted plaster above the tiles, a soft warm cream.
  function paintWall(g, clean) {
    paintShape(g, rectPoints(0, CEILING - 4, 1920, TILE_TOP - CEILING + 10), {
      color: clean ? TONE.paint : TONE.paintDirty,
      lightDir: LIGHT_DIR,
      light: 0.12,
      shadow: 0.3,
      strokes: 9,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.15,
      variance: 0.06,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 11010,
    });
    if (!clean) {
      for (const [x, y, r, seed] of [[1100, 220, 90, 11011], [1560, 180, 70, 11012], [700, 380, 60, 11013]]) {
        stain(g, x, y, r, P.oak, seed, 0.22);
      }
    }
    // A towel rail between the mirror and the cupboard, a hook by the bath.
    g.fillStyle = aged(TONE.chrome, clean);
    g.fillRect(1394, 520, 4, 40);
    g.fillRect(1440, 520, 4, 40);
    g.fillRect(1390, 530, 58, 4);
  }

  // Square tiles from the floor up to the pencil border at y 600: a pink
  // field, a two-row pink-and-cream checker band under the border, and the
  // shower surround tiled right up to the slope. Each tile has its own glaze.
  function paintTiles(g, clean) {
    const size = 32;
    const rng = S.createRng(11020);
    const tile = (x, y, hex) => {
      const tone = S.shadeHex(aged(hex, clean, 1.1), rng.range(-0.05, 0.05));
      g.fillStyle = tone;
      g.fillRect(x + 1, y + 1, size - 2, size - 2);
      // Glaze: a lit top-left edge, a shaded bottom-right, a soft sheen.
      g.fillStyle = S.rgba(P.bone, clean ? 0.22 : 0.12);
      g.fillRect(x + 1, y + 1, size - 2, 2);
      g.fillRect(x + 1, y + 1, 2, size - 2);
      g.fillStyle = S.rgba(P.soot, 0.16);
      g.fillRect(x + 1, y + size - 3, size - 2, 2);
      g.fillRect(x + size - 3, y + 1, 2, size - 2);
      const sheen = g.createRadialGradient(x + 10, y + 9, 1, x + 10, y + 9, 14);
      sheen.addColorStop(0, S.rgba(P.bone, clean ? 0.22 : 0.1));
      sheen.addColorStop(1, S.rgba(P.bone, 0));
      g.fillStyle = sheen;
      g.fillRect(x + 1, y + 1, size - 2, size - 2);
    };
    // Grout.
    const grout = clean ? S.mixHex(P.linen, P.bone, 0.4) : S.mixHex(P.taupe, P.umber, 0.3);
    g.fillStyle = grout;
    g.fillRect(0, TILE_TOP, 1920, FLOOR_LINE - TILE_TOP);
    g.save();
    g.beginPath();
    // The shower surround: from the slope down, over the bath.
    g.moveTo(BATH.x0 - 40, slopeY(BATH.x0 - 40));
    g.lineTo(BATH.x1 + 30, slopeY(BATH.x1 + 30));
    g.lineTo(BATH.x1 + 30, TILE_TOP);
    g.lineTo(BATH.x0 - 40, TILE_TOP);
    g.closePath();
    g.fillStyle = grout;
    g.fill();
    g.restore();
    for (let y = TILE_TOP + 8; y < FLOOR_LINE; y += size) {
      const row = Math.round((y - TILE_TOP - 8) / size);
      for (let x = 0; x < 1920; x += size) {
        const col = x / size;
        const checker = row < 2 ? ((row + col) % 2 ? TONE.cream : TONE.pinkDeep) : TONE.pink;
        tile(x, y, checker);
      }
    }
    // Above the bath, up to the slope: cream with a pink row every fourth.
    g.save();
    g.beginPath();
    g.moveTo(BATH.x0 - 40, slopeY(BATH.x0 - 40));
    g.lineTo(BATH.x1 + 30, slopeY(BATH.x1 + 30));
    g.lineTo(BATH.x1 + 30, TILE_TOP);
    g.lineTo(BATH.x0 - 40, TILE_TOP);
    g.closePath();
    g.clip();
    for (let y = TILE_TOP - size; y > 100; y -= size) {
      const row = Math.round((TILE_TOP - y) / size);
      for (let x = Math.floor((BATH.x0 - 40) / size) * size; x < BATH.x1 + 30; x += size) {
        tile(x, y, row % 4 === 0 ? TONE.pink : TONE.cream);
      }
    }
    g.restore();
    // The black pencil-tile border, a rounded bead that catches light.
    const pencil = (x0, x1, y) => {
      const bead = g.createLinearGradient(0, y - 5, 0, y + 5);
      bead.addColorStop(0, S.mixHex(P.soot, P.bone, 0.35));
      bead.addColorStop(0.4, P.soot);
      bead.addColorStop(1, S.mixHex(P.soot, P.umber, 0.4));
      g.fillStyle = bead;
      g.fillRect(x0, y - 5, x1 - x0, 10);
    };
    pencil(0, BATH.x0 - 40, TILE_TOP);
    pencil(BATH.x1 + 30, 1920, TILE_TOP);
    g.save();
    g.translate(0, 0);
    g.strokeStyle = S.mixHex(P.soot, P.umber, 0.4);
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(BATH.x0 - 40, TILE_TOP);
    g.lineTo(BATH.x0 - 40, slopeY(BATH.x0 - 40) + 6);
    g.moveTo(BATH.x1 + 30, TILE_TOP);
    g.lineTo(BATH.x1 + 30, slopeY(BATH.x1 + 30) + 6);
    g.stroke();
    g.restore();
    if (!clean) {
      // Grime in the grout low down, and two cracked tiles.
      const grime = g.createLinearGradient(0, FLOOR_LINE - 90, 0, FLOOR_LINE);
      grime.addColorStop(0, S.rgba(P.umber, 0));
      grime.addColorStop(1, S.rgba(P.umber, 0.4));
      g.fillStyle = grime;
      g.fillRect(0, FLOOR_LINE - 90, 1920, 90);
      g.strokeStyle = S.rgba(P.soot, 0.6);
      g.lineWidth = 1.2;
      for (const [x, y] of [[704, 680], [1416, 712]]) {
        g.beginPath();
        g.moveTo(x + 4, y + 2);
        g.lineTo(x + 14, y + 13);
        g.lineTo(x + 11, y + 22);
        g.lineTo(x + 26, y + 30);
        g.moveTo(x + 14, y + 13);
        g.lineTo(x + 27, y + 9);
        g.stroke();
      }
      stain(g, 400, 360, 90, P.moss, 11021, 0.18);
    }
  }

  // The sloped ceiling: painted boards running along the slope, a rafter,
  // and the flat ceiling to the right of where the slope meets it.
  function paintCeiling(g, clean) {
    const slopeArea = [[0, 0], [SLOPE.x1, 0], [SLOPE.x1, SLOPE.y1], [SLOPE.x0, SLOPE.y0], [0, SLOPE.y0]];
    paintShape(g, slopeArea, {
      color: clean ? TONE.boards : TONE.boardsDirty,
      lightDir: { x: 0.3, y: 0.95 },
      light: 0.18,
      shadow: 0.4,
      strokes: 5,
      strokeAngle: -0.24,
      rim: 0,
      wobble: 0,
      seed: 11030,
    });
    // Board seams parallel to the slope, closer together as they go up (the
    // ceiling falls away from us).
    g.save();
    poly(g, slopeArea);
    g.clip();
    let off = 18;
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = S.rgba(P.soot, 0.28);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(SLOPE.x0 - 400, SLOPE.y0 - off + 400 * (190 / 780));
      g.lineTo(SLOPE.x1 + 200, SLOPE.y1 - off - 200 * (190 / 780));
      g.stroke();
      g.strokeStyle = S.rgba(P.bone, 0.12);
      g.beginPath();
      g.moveTo(SLOPE.x0 - 400, SLOPE.y0 - off + 2 + 400 * (190 / 780));
      g.lineTo(SLOPE.x1 + 200, SLOPE.y1 - off + 2 - 200 * (190 / 780));
      g.stroke();
      off += 22 - i * 0.8;
    }
    // A rafter running down the slope.
    g.fillStyle = aged(S.mixHex(P.oak, P.linen, 0.3), clean);
    poly(g, [[SLOPE.x0 - 200, SLOPE.y0 - 40 + 50], [SLOPE.x1 + 120, SLOPE.y1 - 70 - 30], [SLOPE.x1 + 120, SLOPE.y1 - 56 - 30], [SLOPE.x0 - 200, SLOPE.y0 - 26 + 50]]);
    g.fill();
    g.restore();
    // The flat ceiling.
    paintShape(g, rectPoints(SLOPE.x1, 0, 1920 - SLOPE.x1, CEILING), {
      color: clean ? S.mixHex(P.linen, P.bone, 0.5) : S.mixHex(P.umber, P.taupe, 0.3),
      lightDir: { x: 0, y: 1 },
      light: 0.15,
      shadow: 0.45,
      strokes: 5,
      rim: 0,
      wobble: 0,
      seed: 11031,
    });
    // Where the slope and the flat ceiling meet the wall: a shadowed edge.
    g.strokeStyle = S.rgba(P.soot, 0.5);
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, SLOPE.y0);
    g.lineTo(SLOPE.x0, SLOPE.y0);
    g.lineTo(SLOPE.x1, SLOPE.y1);
    g.lineTo(1920, SLOPE.y1);
    g.stroke();
    const under = g.createLinearGradient(0, SLOPE.y1, 0, SLOPE.y1 + 40);
    under.addColorStop(0, S.rgba(P.soot, 0.3));
    under.addColorStop(1, S.rgba(P.soot, 0));
    g.fillStyle = under;
    g.fillRect(SLOPE.x1, SLOPE.y1, 1920 - SLOPE.x1, 40);
    if (!clean) {
      // Damp round the skylight.
      stain(g, (SKY.x0 + SKY.x1) / 2, (SKY.bl[1] + SKY.tr[1]) / 2 + 20, 150, P.oak, 11032, 0.35);
      stain(g, SKY.x0 - 20, SKY.bl[1] + 30, 70, P.moss, 11033, 0.22);
    }
  }

  // The skylight's frame in the slope. Its glass is cut out of the back layer
  // and the sky and shutters are drawn live (drawProps).
  function paintSkylightFrame(g, clean) {
    const { bl, br, tr, tl } = SKY;
    const grow = (p, c, k) => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k];
    const c = [(bl[0] + tr[0]) / 2, (bl[1] + tr[1]) / 2];
    const outer = [bl, br, tr, tl].map((p) => grow(p, c, 1.16));
    paintShape(g, outer, {
      color: aged(S.mixHex(P.linen, P.bone, 0.2), clean),
      lightDir: { x: 0, y: 1 },
      light: 0.25,
      shadow: 0.45,
      strokes: 3,
      rim: 0.3,
      wobble: 0.3,
      seed: 11040,
    });
    // The lining of the opening: the depth of the roof.
    g.fillStyle = S.rgba(P.soot, 0.35);
    poly(g, [bl, br, grow(br, c, 1.08), grow(bl, c, 1.08)]);
    g.fill();
    g.save();
    g.globalCompositeOperation = 'destination-out';
    poly(g, [bl, br, tr, tl]);
    g.fill();
    g.restore();
  }

  // The laundry chute hatch in the wall: a small door with a brass pull.
  function paintChute(g, clean, shake) {
    const { x0, x1, y0, y1 } = CHUTE;
    g.fillStyle = S.rgba(P.soot, 0.45);
    g.fillRect(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12);
    g.save();
    g.translate(shake, 0);
    paintShape(g, rectPoints(x0, y0, x1 - x0, y1 - y0), {
      color: aged(S.mixHex(P.linen, P.bone, 0.25), clean),
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.4,
      strokes: 3,
      rim: 0.3,
      wobble: 0.2,
      seed: 11050,
    });
    g.strokeStyle = S.rgba(P.soot, 0.35);
    g.lineWidth = 2;
    g.strokeRect(x0 + 8, y0 + 8, x1 - x0 - 16, y1 - y0 - 16);
    g.fillStyle = aged(P.brass, clean);
    g.fillRect((x0 + x1) / 2 - 12, y1 - 22, 24, 6);
    g.fillStyle = S.rgba(P.walnut, 0.7);
    g.font = '700 9px "Special Elite", monospace';
    g.textAlign = 'center';
    g.fillText('LAUNDRY', (x0 + x1) / 2, y0 + 26);
    g.restore();
  }

  // Small square floor tiles in perspective: black and white in a basket
  // pattern, worn and grey when dirty.
  function paintFloor(g, clean) {
    const vp = { x: 960, y: -900 };
    const top = FLOOR_LINE;
    const bottom = 1080;
    const base = clean ? S.mixHex(P.bone, P.linen, 0.5) : S.mixHex(P.linen, P.taupe, 0.45);
    g.fillStyle = base;
    g.fillRect(0, top, 1920, bottom - top);
    const xAt = (xb, y) => vp.x + (xb - vp.x) * ((y - vp.y) / (bottom - vp.y));
    // Rows get taller toward the viewer.
    const rows = [];
    let y = top;
    let h = 9;
    while (y < bottom) {
      rows.push([y, Math.min(bottom, y + h)]);
      y += h;
      h *= 1.075;
    }
    const step = 30;
    rows.forEach(([ya, yb], r) => {
      for (let xb = -600, c = 0; xb < 2500; xb += step, c++) {
        if ((r + c) % 2) continue;
        const dark = (r % 4 < 2) === (c % 4 < 2);
        g.fillStyle = dark ? aged(S.mixHex(P.umber, P.taupe, 0.35), clean) : aged(S.mixHex(P.bone, P.ember, 0.12), clean);
        g.beginPath();
        g.moveTo(xAt(xb, ya), ya);
        g.lineTo(xAt(xb + step, ya), ya);
        g.lineTo(xAt(xb + step, yb), yb);
        g.lineTo(xAt(xb, yb), yb);
        g.closePath();
        g.fill();
      }
    });
    g.strokeStyle = S.rgba(P.soot, 0.25);
    g.lineWidth = 1;
    for (const [ya] of rows) {
      g.beginPath();
      g.moveTo(0, ya);
      g.lineTo(1920, ya);
      g.stroke();
    }
    const fall = g.createRadialGradient(1000, 900, 200, 1000, 940, 1150);
    fall.addColorStop(0, 'rgba(0,0,0,0)');
    fall.addColorStop(1, S.rgba(P.soot, clean ? 0.3 : 0.5));
    g.fillStyle = fall;
    g.fillRect(0, top, 1920, bottom - top);
    const join = g.createLinearGradient(0, top, 0, top + 24);
    join.addColorStop(0, S.rgba(P.soot, 0.5));
    join.addColorStop(1, S.rgba(P.soot, 0));
    g.fillStyle = join;
    g.fillRect(0, top, 1920, 24);
    // The bath mat: a pink pile rug with a fringe.
    paintShape(g, [[230, 975], [570, 975], [600, 1040], [200, 1040]], {
      color: aged(S.mixHex(S.mixHex(P.bone, P.ember, 0.4), P.plum, 0.25), clean, 1.2),
      lightDir: { x: 0, y: -1 },
      light: 0.15,
      shadow: 0.3,
      strokes: 30,
      strokeSize: 0.4,
      variance: 0.15,
      rim: 0.2,
      wobble: 2,
      seed: 11060,
    });
    g.strokeStyle = S.rgba(P.bone, 0.4);
    g.lineWidth = 1;
    for (let x = 206; x < 600; x += 6) {
      g.beginPath();
      g.moveTo(x, 1040);
      g.lineTo(x - 1, 1048);
      g.stroke();
    }
    if (!clean) {
      // Towels dropped on the floor by the bath.
      for (const [pts, hex, seed] of [
        [[[650, 940], [760, 928], [790, 960], [700, 980], [640, 968]], S.mixHex(P.linen, P.taupe, 0.4), 11061],
        [[[700, 958], [800, 948], [830, 985], [720, 998]], S.mixHex(P.plum, P.taupe, 0.4), 11062],
      ]) {
        paintShape(g, pts, { color: hex, lightDir: LIGHT_DIR, light: 0.25, shadow: 0.45, strokes: 8, rim: 0.3, wobble: 3, seed });
      }
    }
  }

  // ── Furniture layer ───────────────────────────────────────────────────

  function paintFurniture(g, clean) {
    paintBath(g, clean);
    paintMirrorFrame(g, clean);
    paintVanity(g, clean);
    paintCupboard(g, clean);
    paintStool(g, clean);
    paintBasket(g, clean);
    paintCleanerTrace(g, clean);
  }

  // The bath: pink enamel, panelled in, low under the slope; a chrome shower
  // head on the tiles, a rail, and a flowered curtain.
  function paintBath(g, clean) {
    const { x0, x1, rim, base } = BATH;
    softShadow(g, (x0 + x1) / 2, base, (x1 - x0) * 0.56, 14, 0.5);
    // The panel.
    paintShape(g, rectPoints(x0, rim + 8, x1 - x0, base - rim - 8), {
      color: aged(TONE.enamel, clean),
      lightDir: LIGHT_DIR,
      light: 0.2,
      shadow: 0.4,
      strokes: 6,
      strokeAngle: Math.PI / 2,
      rim: 0.3,
      wobble: 0.3,
      seed: 11070,
    });
    g.strokeStyle = S.rgba(P.soot, 0.2);
    g.lineWidth = 2;
    for (const px of [x0 + 150, x0 + 300]) {
      g.beginPath();
      g.moveTo(px, rim + 14);
      g.lineTo(px, base - 6);
      g.stroke();
    }
    // The rim: a rolled edge in a long highlight.
    paintShape(g, roundedRectPoints(x0 - 8, rim - 6, x1 - x0 + 16, 18, 8), {
      color: aged(S.shadeHex(TONE.enamel, 0.1), clean),
      lightDir: { x: 0, y: -1 },
      light: 0.4,
      shadow: 0.35,
      strokes: 3,
      rim: 0.5,
      wobble: 0.2,
      seed: 11071,
    });
    g.fillStyle = S.rgba(P.bone, 0.5);
    g.fillRect(x0 + 10, rim - 3, x1 - x0 - 40, 2);
    // Taps at the left end, the shower riser and head.
    g.fillStyle = aged(TONE.chrome, clean);
    g.fillRect(x0 + 24, rim - 30, 6, 24);
    g.fillRect(x0 + 18, rim - 32, 18, 5);
    g.fillRect(x0 + 60, rim - 22, 5, 16);
    g.fillRect(x0 + 52, rim - 26, 20, 5);
    g.fillRect(x0 + 40, 420, 5, rim - 450);
    g.save();
    g.translate(x0 + 52, 412);
    g.rotate(0.5);
    g.beginPath();
    g.ellipse(0, 0, 18, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.rgba(P.soot, 0.4);
    g.beginPath();
    g.ellipse(2, 4, 14, 5, 0, 0, Math.PI);
    g.fill();
    g.restore();
    // The rail, under the slope.
    const railY = 340;
    g.fillStyle = aged(TONE.chrome, clean);
    g.fillRect(x0 + 60, railY, x1 - x0 - 50, 5);
    g.fillRect(x1 + 4, railY - 26, 4, 30);
    paintCurtain(g, clean, railY);
    if (!clean) {
      // A tide line and a rust drip below the taps.
      g.fillStyle = S.rgba(P.oak, 0.4);
      g.fillRect(x0 + 26, rim + 10, 4, 60);
    }
  }

  // The curtain: drawn back to the right end of the bath, so the bath shows.
  // A 60s print of big round flowers. Dirty: mildewed, half off its hooks.
  function paintCurtain(g, clean, railY) {
    const x0 = BATH.x1 - 140;
    const x1 = BATH.x1 + 4;
    const bottom = BATH.rim - 10;
    const sag = clean ? 0 : 1;
    const pts = [[x0, railY + 4 + sag * 50], [x0 + 40, railY + 4 + sag * 20], [x1, railY + 4], [x1 + 10, bottom], [x0 + 60, bottom + 6], [x0 - 14, bottom - 4 + sag * 10]];
    g.save();
    poly(g, pts);
    g.clip();
    paintShape(g, pts, {
      color: aged(S.mixHex(P.bone, P.linen, 0.25), clean, 1.2),
      lightDir: LIGHT_DIR,
      light: 0.2,
      shadow: 0.4,
      strokes: 6,
      strokeAngle: Math.PI / 2,
      rim: 0.2,
      wobble: 1.5,
      seed: 11080,
    });
    // The print.
    const rng = S.createRng(11081);
    for (let y = railY + 20; y < bottom; y += 46) {
      for (let x = x0 - 10 + ((y / 46) % 2) * 22; x < x1 + 10; x += 44) {
        const hue = rng.next() < 0.5 ? P.ember : P.moss;
        const fx = x + rng.range(-4, 4);
        const fy = y + rng.range(-4, 4);
        g.fillStyle = S.rgba(aged(S.mixHex(hue, P.bone, 0.3), clean), 0.75);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          g.beginPath();
          g.arc(fx + Math.cos(a) * 7, fy + Math.sin(a) * 7, 6, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = S.rgba(P.dawn, 0.85);
        g.beginPath();
        g.arc(fx, fy, 4, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Folds.
    for (let x = x0; x < x1; x += 18) {
      const band = g.createLinearGradient(x, 0, x + 18, 0);
      band.addColorStop(0, S.rgba(P.soot, 0.25));
      band.addColorStop(0.5, S.rgba(P.bone, 0.12));
      band.addColorStop(1, S.rgba(P.soot, 0.25));
      g.fillStyle = band;
      g.fillRect(x, railY, 18, bottom - railY + 20);
    }
    if (!clean) {
      // Mildew climbing from the hem.
      const mould = g.createLinearGradient(0, bottom - 160, 0, bottom);
      mould.addColorStop(0, S.rgba(P.moss, 0));
      mould.addColorStop(1, S.rgba(S.mixHex(P.moss, P.soot, 0.4), 0.6));
      g.fillStyle = mould;
      g.fillRect(x0 - 20, bottom - 160, x1 - x0 + 40, 180);
      for (let i = 0; i < 24; i++) {
        g.fillStyle = S.rgba(S.mixHex(P.moss, P.soot, 0.5), rng.range(0.2, 0.5));
        g.beginPath();
        g.arc(rng.range(x0, x1), rng.range(bottom - 140, bottom), rng.range(2, 6), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
    // Rings, the first ones off their hooks when dirty.
    g.strokeStyle = aged(TONE.chrome, clean);
    g.lineWidth = 1.5;
    for (let x = x0 + 6; x < x1; x += 16) {
      const off = !clean && x < x0 + 60;
      g.beginPath();
      g.ellipse(x, railY + (off ? 40 : 2), 4, 6, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }

  // The mirror's frame: a bevelled edge round the glass, and the sockets for
  // the bulbs (which are drawn live: they light in turn).
  const BULBS = (() => {
    const list = [];
    for (let i = 0; i < 9; i++) list.push([MIRROR.x + 30 + (i * (MIRROR.w - 60)) / 8, MIRROR.y - 16]);
    for (const y of [MIRROR.y + 70, MIRROR.y + 170, MIRROR.y + 270]) {
      list.push([MIRROR.x - 16, y]);
      list.push([MIRROR.x + MIRROR.w + 16, y]);
    }
    return list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  })();

  function paintMirrorFrame(g, clean) {
    const { x, y, w, h } = MIRROR;
    softShadow(g, x + w / 2 + 6, y + h / 2 + 10, w * 0.52, h * 0.52, 0.35);
    paintShape(g, roundedRectPoints(x - 26, y - 30, w + 52, h + 56, 8), {
      color: aged(S.mixHex(P.bone, P.plum, 0.18), clean),
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.4,
      strokes: 4,
      rim: 0.35,
      wobble: 0.3,
      seed: 11090,
    });
    // The bevel: a bright inner edge on two sides, dark on the others.
    const base = g.createLinearGradient(x, y, x + w, y + h);
    base.addColorStop(0, S.mixHex(P.moon, P.bone, clean ? 0.35 : 0.15));
    base.addColorStop(1, S.mixHex(P.moon, P.umber, clean ? 0.35 : 0.55));
    g.fillStyle = base;
    g.fillRect(x, y, w, h);
    g.strokeStyle = S.rgba(P.bone, 0.45);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x + 4, y + h - 4);
    g.lineTo(x + 4, y + 4);
    g.lineTo(x + w - 4, y + 4);
    g.stroke();
    g.strokeStyle = S.rgba(P.soot, 0.5);
    g.beginPath();
    g.moveTo(x + w - 4, y + 4);
    g.lineTo(x + w - 4, y + h - 4);
    g.lineTo(x + 4, y + h - 4);
    g.stroke();
    for (const [bx, by] of BULBS) {
      g.fillStyle = aged(TONE.chrome, clean);
      g.beginPath();
      g.arc(bx, by, 8, 0, Math.PI * 2);
      g.fill();
    }
  }

  // The vanity: two basins in a long top over cupboards, chrome taps, and
  // the things people leave on a bathroom counter.
  function paintVanity(g, clean) {
    const { x0, x1, top, base } = VANITY;
    softShadow(g, (x0 + x1) / 2, base, (x1 - x0) * 0.55, 12, 0.5);
    paintShape(g, rectPoints(x0 + 10, top + 14, x1 - x0 - 20, base - top - 14), {
      color: aged(TONE.wood, clean),
      lightDir: LIGHT_DIR,
      light: 0.22,
      shadow: 0.45,
      strokes: 8,
      strokeAngle: Math.PI / 2,
      rim: 0.3,
      wobble: 0.3,
      seed: 11100,
    });
    // Doors, with pink laminate panels and chrome pulls.
    const doors = 5;
    const dw = (x1 - x0 - 40) / doors;
    for (let i = 0; i < doors; i++) {
      const dx = x0 + 20 + i * dw;
      g.fillStyle = aged(S.mixHex(P.plum, P.bone, 0.45), clean);
      g.fillRect(dx + 6, top + 30, dw - 12, base - top - 50);
      g.strokeStyle = S.rgba(P.soot, 0.35);
      g.lineWidth = 2;
      g.strokeRect(dx + 6, top + 30, dw - 12, base - top - 50);
      g.fillStyle = aged(TONE.chrome, clean);
      g.fillRect(dx + dw / 2 - 10, top + 44, 20, 4);
    }
    // The counter top.
    paintShape(g, rectPoints(x0 - 6, top - 4, x1 - x0 + 12, 20), {
      color: aged(S.mixHex(P.bone, P.linen, 0.3), clean),
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.3,
      strokes: 3,
      rim: 0.4,
      wobble: 0.2,
      seed: 11101,
    });
    // Basins, sunk into the top: an oval rim and the bowl's shadow.
    for (const bx of BASINS) {
      g.fillStyle = aged(S.mixHex(P.bone, P.plum, 0.12), clean);
      g.beginPath();
      g.ellipse(bx, top + 2, 74, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.rgba(P.soot, 0.35);
      g.beginPath();
      g.ellipse(bx, top + 3, 62, 7, 0, 0, Math.PI * 2);
      g.fill();
      // Chrome mixer: spout and two cross-heads.
      g.fillStyle = aged(TONE.chrome, clean);
      g.fillRect(bx - 3, top - 34, 6, 26);
      g.fillRect(bx - 3, top - 36, 26, 6);
      g.fillRect(bx + 20, top - 34, 4, 6);
      for (const s of [-1, 1]) {
        g.fillRect(bx + s * 34 - 2, top - 20, 4, 14);
        g.fillRect(bx + s * 34 - 10, top - 22, 20, 4);
      }
    }
    // On the counter: a perfume bottle, a shaving brush, a razor, a soap dish.
    const t = top - 4;
    g.fillStyle = S.rgba(S.mixHex(P.dawn, P.bone, 0.3), clean ? 0.8 : 0.5);
    g.beginPath();
    g.ellipse(1140, t - 14, 9, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = aged(P.brass, clean);
    g.fillRect(1136, t - 34, 8, 8);
    g.fillStyle = aged(S.mixHex(P.walnut, P.oak, 0.4), clean);
    g.fillRect(1310, t - 18, 12, 18);
    g.fillStyle = aged(S.mixHex(P.linen, P.taupe, 0.3), clean);
    g.beginPath();
    g.ellipse(1316, t - 24, 10, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = aged(TONE.chrome, clean);
    g.fillRect(1338, t - 6, 26, 4);
    g.fillRect(1360, t - 10, 6, 10);
    g.fillStyle = aged(S.mixHex(P.bone, P.plum, 0.2), clean);
    g.beginPath();
    g.ellipse(800, t - 4, 20, 5, 0, 0, Math.PI);
    g.fill();
    g.fillStyle = aged(S.mixHex(P.moss, P.linen, 0.5), clean);
    g.fillRect(790, t - 10, 20, 7);
    if (!clean) {
      g.fillStyle = S.rgba(P.taupe, 0.3);
      g.fillRect(x0 - 6, top - 4, x1 - x0 + 12, 6);
    }
  }

  // The linen cupboard: an open top section with folded towels on shelves,
  // slatted doors below.
  function paintCupboard(g, clean) {
    const { x0, x1, y0, y1, shelf } = CUPBOARD;
    softShadow(g, (x0 + x1) / 2, y1, (x1 - x0) * 0.6, 12, 0.5);
    paintShape(g, rectPoints(x0, y0, x1 - x0, y1 - y0), {
      color: aged(S.mixHex(P.bone, P.linen, 0.35), clean),
      lightDir: LIGHT_DIR,
      light: 0.2,
      shadow: 0.45,
      strokes: 6,
      strokeAngle: Math.PI / 2,
      rim: 0.3,
      wobble: 0.3,
      seed: 11110,
    });
    // The open top: a dark inside, two shelves, towels.
    g.fillStyle = S.mixHex(P.umber, P.walnut, 0.3);
    g.fillRect(x0 + 12, y0 + 14, x1 - x0 - 24, shelf - y0 - 14);
    for (const sy of [y0 + 150, shelf]) {
      g.fillStyle = aged(S.mixHex(P.bone, P.linen, 0.2), clean);
      g.fillRect(x0 + 8, sy - 6, x1 - x0 - 16, 10);
    }
    const stack = (x, base, n, hues, seed) => {
      for (let i = 0; i < n; i++) {
        paintShape(g, roundedRectPoints(x + (i % 2) * 2, base - 6 - (i + 1) * 16, 82, 16, 6), {
          color: aged(hues[i % hues.length], clean),
          lightDir: { x: 0, y: -1 },
          light: 0.3,
          shadow: 0.35,
          strokes: 2,
          rim: 0.35,
          wobble: 0.3,
          seed: seed + i,
        });
      }
    };
    const pinks = [S.mixHex(P.plum, P.bone, 0.45), S.mixHex(P.linen, P.bone, 0.4), S.mixHex(P.moss, P.bone, 0.5)];
    stack(x0 + 24, y0 + 150, clean ? 5 : 3, pinks, 11111);
    stack(x0 + 116, y0 + 150, clean ? 4 : 2, pinks.slice().reverse(), 11116);
    stack(x0 + 24, shelf, clean ? 2 : 1, pinks, 11121);
    // Slatted doors below.
    for (const [dx, dw] of [[x0 + 10, (x1 - x0) / 2 - 12], [(x0 + x1) / 2 + 2, (x1 - x0) / 2 - 12]]) {
      g.fillStyle = aged(S.mixHex(P.bone, P.linen, 0.25), clean);
      g.fillRect(dx, shelf + 16, dw, y1 - shelf - 30);
      for (let sy = shelf + 26; sy < y1 - 20; sy += 12) {
        g.fillStyle = S.rgba(P.soot, 0.28);
        g.fillRect(dx + 8, sy, dw - 16, 4);
        g.fillStyle = S.rgba(P.bone, 0.2);
        g.fillRect(dx + 8, sy - 2, dw - 16, 2);
      }
      g.fillStyle = aged(TONE.chrome, clean);
      g.fillRect(dx + (dx < (x0 + x1) / 2 ? dw - 14 : 8), shelf + 120, 6, 20);
    }
  }

  function paintStool(g, clean) {
    const { x0, x1, top } = STOOL;
    softShadow(g, (x0 + x1) / 2, 935, 36, 6, 0.45);
    paintShape(g, rectPoints(x0 - 4, top, x1 - x0 + 8, 10), {
      color: aged(S.mixHex(P.plum, P.bone, 0.35), clean),
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.4,
      strokes: 2,
      rim: 0.4,
      wobble: 0.2,
      seed: 11130,
    });
    g.fillStyle = aged(TONE.chrome, clean);
    for (const lx of [x0 + 2, x1 - 6]) g.fillRect(lx, top + 10, 4, 935 - top - 10);
    g.fillRect(x0 + 2, top + 60, x1 - x0 - 4, 3);
  }

  // The wicker laundry basket. Its lid is drawn live (it lifts).
  function paintBasket(g, clean) {
    const { x0, x1, top, base } = BASKET;
    softShadow(g, (x0 + x1) / 2, base, (x1 - x0) * 0.6, 8, 0.5);
    const body = [[x0 + 4, top + 8], [x1 - 4, top + 8], [x1 - 10, base], [x0 + 10, base]];
    paintShape(g, body, {
      color: aged(TONE.wicker, clean),
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.45,
      strokes: 6,
      rim: 0.3,
      wobble: 0.4,
      seed: 11140,
    });
    // The weave: alternating short strokes in rows.
    g.save();
    poly(g, body);
    g.clip();
    for (let y = top + 12, r = 0; y < base; y += 8, r++) {
      for (let x = x0 + (r % 2) * 7; x < x1; x += 14) {
        g.fillStyle = S.rgba(P.soot, 0.25);
        g.fillRect(x, y, 7, 3);
        g.fillStyle = S.rgba(P.bone, 0.12);
        g.fillRect(x + 7, y + 1, 7, 2);
      }
    }
    g.restore();
    if (!clean) {
      // A sleeve hanging out over the rim.
      paintShape(g, [[x0 + 60, top + 6], [x0 + 80, top + 4], [x0 + 86, top + 60], [x0 + 70, top + 64]], {
        color: S.mixHex(P.moon, P.taupe, 0.4),
        light: 0.25,
        shadow: 0.4,
        strokes: 2,
        rim: 0.3,
        wobble: 1,
        seed: 11141,
      });
    }
  }

  // The previous cleaner's respirator: hung on the hot tap with its strap
  // broken when dirty; mended and laid on the vanity once clean.
  function paintCleanerTrace(g, clean) {
    const mask = (x, y, tilt) => {
      g.save();
      g.translate(x, y);
      g.rotate(tilt);
      paintShape(g, ellipsePoints(0, 0, 16, 13, 20), {
        color: S.mixHex(P.gear, P.taupe, 0.3),
        lightDir: LIGHT_DIR,
        light: 0.3,
        shadow: 0.45,
        strokes: 2,
        rim: 0.4,
        wobble: 0.3,
        seed: 11150,
      });
      for (const s of [-1, 1]) {
        g.fillStyle = S.mixHex(P.jumpsuit, P.taupe, 0.3);
        g.beginPath();
        g.arc(s * 13, 6, 7, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.rgba(P.soot, 0.4);
        g.beginPath();
        g.arc(s * 13, 6, 3, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    };
    if (!clean) {
      const { tapX, tapY } = VANITY;
      mask(tapX - 6, tapY + 22, 0.3);
      g.strokeStyle = S.mixHex(P.gear, P.soot, 0.3);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(tapX - 18, tapY + 14);
      g.quadraticCurveTo(tapX - 6, tapY - 6, tapX + 4, tapY - 2);
      g.moveTo(tapX + 6, tapY + 24);
      g.lineTo(tapX + 14, tapY + 58);
      g.stroke();
    } else {
      mask(1270, VANITY.top - 14, -0.1);
      g.strokeStyle = S.mixHex(P.gear, P.soot, 0.3);
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(1270, VANITY.top - 20, 26, 8, -0.1, Math.PI, Math.PI * 2);
      g.stroke();
    }
  }

  // ── Front layer ───────────────────────────────────────────────────────

  function paintFront(g, clean) {
    g.save();
    g.filter = 'blur(7px)';
    // A towel on a stand at the right edge, a bottle on a ledge at the left.
    paintShape(g, [[1830, 1080], [1846, 880], [1940, 870], [1940, 1080]], {
      color: S.mixHex(clean ? S.mixHex(P.plum, P.bone, 0.4) : P.taupe, P.soot, 0.4),
      light: 0.1,
      shadow: 0.4,
      strokes: 8,
      strokeAngle: Math.PI / 2,
      rim: 0.2,
      wobble: 2,
      seed: 11160,
    });
    paintShape(g, [[-10, 1080], [-10, 930], [50, 940], [70, 1080]], {
      color: S.mixHex(P.moss, P.soot, 0.45),
      light: 0.1,
      shadow: 0.4,
      strokes: 6,
      rim: 0.2,
      wobble: 1.5,
      seed: 11161,
    });
    g.restore();
  }

  const painted = {};
  function paint(variant) {
    const clean = variant === 'clean';
    const back = S.makeCanvas(1920, 1080);
    const furniture = S.makeCanvas(1920, 1080);
    const front = S.makeCanvas(1920, 1080);
    paintBack(back.getContext('2d'), clean);
    paintFurniture(furniture.getContext('2d'), clean);
    paintFront(front.getContext('2d'), clean);
    painted[clean ? 'clean' : 'dirty'] = { back, furniture };
    return { back, furniture, front };
  }

  // ── Live drawing ──────────────────────────────────────────────────────

  function createLive(seed) {
    return {
      noise: S.createNoise(seed + 110),
      // The logic's starting values (room.js keeps them up to date).
      steam: 1.0,
      tapRunning: true,
      tapCooldown: 0,
      dripTimer: 0,
      chuteRattleTimer: 14 + Math.random() * 8,
      chuteShake: 0,
      basketTimer: 18 + Math.random() * 8,
      basketLid: 0,
      reflections: {},
    };
  }

  // The room as the mirror sees it: the painted room itself, reversed and
  // small through the same transform the live pass uses, then darkened,
  // cooled and softened. Built once per state, the first time it is needed.
  const MIRROR_T = { cx: 1070, cy: 515, k: 0.45, ox: 980, oy: 480 };
  function reflection(live, clean) {
    const key = clean ? 'clean' : 'dirty';
    let c = live.reflections[key];
    if (c) return c;
    const src = painted[key];
    if (!src) return null;
    c = S.makeCanvas(GLASS.w, GLASS.h);
    const g = c.getContext('2d');
    g.save();
    g.translate(-GLASS.x, -GLASS.y);
    g.translate(MIRROR_T.cx, MIRROR_T.cy);
    g.scale(-MIRROR_T.k, MIRROR_T.k);
    g.translate(-MIRROR_T.ox, -MIRROR_T.oy);
    g.filter = 'blur(1.2px)';
    g.drawImage(src.back, 0, 0);
    g.drawImage(src.furniture, 0, 0);
    g.filter = 'none';
    g.restore();
    // Darker and cooler than the room: glass takes a little light away.
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = clean ? '#B8BCC8' : '#7C8094';
    g.fillRect(0, 0, GLASS.w, GLASS.h);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = S.rgba(P.moon, clean ? 0.06 : 0.1);
    g.fillRect(0, 0, GLASS.w, GLASS.h);
    live.reflections[key] = c;
    return c;
  }

  // Beyond the skylight: drawn in drawProps instead (it is not a rectangle).
  function drawSky() {}

  // The skylight: sky through the glass, and the shutters folding open one
  // by one at the `skylight` beat.
  function drawSkylight(g, live, t, mk) {
    const { bl, br, tr, tl } = SKY;
    const open = S.clamp(mk.skylight ?? 0, 0, 1);
    const day = mk.window;
    g.save();
    poly(g, [bl, br, tr, tl]);
    g.clip();
    const sky = g.createLinearGradient(0, tl[1], 0, bl[1]);
    sky.addColorStop(0, S.mix(S.moods.dirty.windowSkyTop, S.moods.clean.windowSkyTop, day));
    sky.addColorStop(1, S.mix(S.moods.dirty.windowSkyBottom, S.moods.clean.windowSkyBottom, day));
    g.fillStyle = sky;
    g.fillRect(SKY.x0 - 10, tr[1] - 10, SKY.x1 - SKY.x0 + 20, bl[1] - tr[1] + 20);
    if (day < 1) {
      g.fillStyle = `rgba(232,238,248,${0.8 * (1 - day)})`;
      for (const [u, v] of [[0.2, 0.3], [0.5, 0.5], [0.78, 0.25], [0.35, 0.7]]) {
        const px = S.lerp(SKY.x0, SKY.x1, u);
        const py = S.lerp(S.lerp(tl[1], bl[1], v), S.lerp(tr[1], br[1], v), u);
        g.fillRect(px, py, 2, 2);
      }
    }
    // Four shutters, each a louvred panel. They fold up and back in turn,
    // the leftmost first; folded, each shows only its edge.
    const n = 4;
    for (let i = 0; i < n; i++) {
      const k = S.clamp(open * 1.6 - i * 0.2, 0, 1);
      const u0 = i / n;
      const u1 = (i + 1) / n;
      const at = (u, v) => [S.lerp(S.lerp(tl[0], bl[0], v), S.lerp(tr[0], br[0], v), u), S.lerp(S.lerp(tl[1], bl[1], v), S.lerp(tr[1], br[1], v), u)];
      // A folding shutter keeps its hinge (top) edge and its bottom edge
      // rises toward it.
      const v1 = S.lerp(1, 0.08, S.ease.inOut(k));
      const p = [at(u0, 0), at(u1, 0), at(u1, v1), at(u0, v1)];
      g.fillStyle = S.mixHex(TONE.wood, P.umber, 0.45);
      poly(g, p);
      g.fill();
      const slats = 7;
      for (let s = 1; s < slats; s++) {
        const v = (s / slats) * v1;
        const a = at(u0, v);
        const b = at(u1, v);
        g.strokeStyle = S.rgba(P.soot, 0.55);
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
        if (k < 0.05) {
          // A thin line of moonlight between the slats.
          g.strokeStyle = S.rgba(S.mixHex(P.moon, P.bone, 0.3), 0.55);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(a[0] + 4, a[1] + 1.5);
          g.lineTo(b[0] - 4, b[1] + 1.5);
          g.stroke();
        }
      }
      g.strokeStyle = S.rgba(P.soot, 0.6);
      g.lineWidth = 1.5;
      poly(g, p);
      g.stroke();
    }
    g.restore();
  }

  function drawProps(g, live, t, mk) {
    drawSkylight(g, live, t, mk);
    const shake = live.chuteShake > 0 ? Math.sin(t * 70) * 3 * (live.chuteShake / 0.6) : 0;
    if (shake) paintChute(g, sweptPast(mk, CHUTE.x0), shake);
  }

  const sweptPast = (mk, x) => mk.wipe >= 0.999 || mk.sweepX > x;

  // The mirror, live: the cached reflected room, the hero and the spiders
  // drawn again through the mirror's transform, dimmed; a sheen over the
  // glass; then the steam rising from the bottom.
  function drawMirror(g, live, t, mk) {
    const clean = mk.wipe >= 0.999;
    g.save();
    g.beginPath();
    g.rect(GLASS.x, GLASS.y, GLASS.w, GLASS.h);
    g.clip();
    const room = reflection(live, clean);
    if (room) g.drawImage(room, GLASS.x, GLASS.y);
    g.save();
    g.translate(MIRROR_T.cx, MIRROR_T.cy);
    g.scale(-MIRROR_T.k, MIRROR_T.k);
    g.translate(-MIRROR_T.ox, -MIRROR_T.oy);
    g.globalAlpha = 0.78;
    for (const c of live.world?.critters ?? []) {
      c._inMirror = true;
      c.draw(g, t);
      c._inMirror = false;
    }
    live.world?.hero?.draw(g);
    g.restore();
    // Glass: a cool cast, and two long diagonal sheens.
    g.fillStyle = S.rgba(P.moon, 0.08);
    g.fillRect(GLASS.x, GLASS.y, GLASS.w, GLASS.h);
    for (const [x, w, a] of [[GLASS.x + 60, 70, 0.08], [GLASS.x + 170, 26, 0.06], [GLASS.x + 420, 90, 0.05]]) {
      g.fillStyle = S.rgba(P.bone, a);
      g.beginPath();
      g.moveTo(x, GLASS.y);
      g.lineTo(x + w, GLASS.y);
      g.lineTo(x + w - 160, GLASS.y + GLASS.h);
      g.lineTo(x - 160, GLASS.y + GLASS.h);
      g.closePath();
      g.fill();
    }
    drawSteam(g, live, t);
    if (!clean) {
      // Spots on the glass where the silvering has gone.
      const rng = S.createRng(11170);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = S.rgba(P.soot, 0.3);
        g.beginPath();
        g.arc(GLASS.x + rng.range(0, GLASS.w), GLASS.y + (rng.next() < 0.5 ? rng.range(0, 30) : GLASS.h - rng.range(0, 30)), rng.range(4, 12), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }

  // Steam: a soft veil rising from the bottom of the glass with a wavering
  // edge, droplets gathering in it and runs below them. Its edge is made of
  // overlapping soft blobs, so it never reads as a white rectangle.
  function steamSprite(live) {
    if (live.steamSprite) return live.steamSprite;
    const c = S.makeCanvas(GLASS.w, GLASS.h + 80);
    const g = c.getContext('2d');
    const fill = g.createLinearGradient(0, 0, 0, GLASS.h + 80);
    fill.addColorStop(0, S.rgba(P.bone, 0));
    fill.addColorStop(0.12, S.rgba(P.bone, 0.5));
    fill.addColorStop(1, S.rgba(P.bone, 0.85));
    g.fillStyle = fill;
    g.fillRect(0, 40, GLASS.w, GLASS.h + 40);
    const rng = S.createRng(11171);
    for (let i = 0; i < 40; i++) {
      const x = rng.range(-20, GLASS.w + 20);
      const r = rng.range(20, 46);
      const blob = g.createRadialGradient(x, 50, 2, x, 50, r);
      blob.addColorStop(0, S.rgba(P.bone, 0.45));
      blob.addColorStop(1, S.rgba(P.bone, 0));
      g.fillStyle = blob;
      g.fillRect(x - r, 50 - r, r * 2, r * 2);
    }
    // Droplets and runs.
    for (let i = 0; i < 90; i++) {
      const x = rng.range(4, GLASS.w - 4);
      const y = rng.range(70, GLASS.h + 60);
      const r = rng.range(1, 2.6);
      g.fillStyle = S.rgba(P.moon, 0.35);
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.rgba(P.bone, 0.9);
      g.beginPath();
      g.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2);
      g.fill();
      if (i % 6 === 0) {
        g.globalCompositeOperation = 'destination-out';
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(x - 1, y + r, 2.2, rng.range(20, 60));
        g.globalCompositeOperation = 'source-over';
      }
    }
    live.steamSprite = c;
    return c;
  }

  function drawSteam(g, live, t) {
    const steam = S.clamp(live.steam ?? 0, 0, 1);
    if (steam <= 0.01) return;
    const sp = steamSprite(live);
    const top = GLASS.y + GLASS.h - steam * (GLASS.h + 40);
    const wave = Math.sin(t * 0.7) * 4;
    g.save();
    g.globalAlpha = S.clamp(steam * 1.4, 0, 1);
    g.drawImage(sp, GLASS.x + wave * 0.3, top - 40 + wave);
    g.restore();
  }

  // The mirror's bulbs: lit left to right at the `bulbs` beat.
  function bulbOn(i, mk) {
    const b = S.clamp(mk.bulbs ?? 0, 0, 1);
    if (b <= 0) return 0;
    return S.clamp(b * BULBS.length - i, 0, 1);
  }

  function drawBulbs(g, mk) {
    BULBS.forEach(([bx, by], i) => {
      const on = bulbOn(i, mk);
      const glass = g.createRadialGradient(bx - 2, by - 2, 1, bx, by, 7);
      glass.addColorStop(0, S.mix(S.mixHex(P.linen, P.taupe, 0.3), P.bone, on));
      glass.addColorStop(1, S.mix(S.mixHex(P.taupe, P.umber, 0.4), P.amber, on));
      g.fillStyle = glass;
      g.beginPath();
      g.arc(bx, by, 6.5, 0, Math.PI * 2);
      g.fill();
    });
  }

  // The toothbrush cup: fallen on its side with the brushes scattered when
  // dirty; it stands up at the `cup` beat, four brushes in it, one older,
  // with a strip of tape that reads "A."
  function drawCup(g, live, mk) {
    const up = S.ease.inOut(S.clamp(mk.cup ?? 0, 0, 1));
    const base = VANITY.top - 4;
    const brushes = [[P.ember, -7, -0.18], [P.moon, -2, -0.05], [P.moss, 3, 0.08], [S.mixHex(P.linen, P.taupe, 0.3), 8, 0.2]];
    if (up < 0.02) {
      // Fallen: the cup on its side, brushes lying about, dusty.
      g.save();
      g.translate(CUP_X, base - 8);
      g.rotate(Math.PI / 2 - 0.1);
      cupBody(g, false);
      g.restore();
      brushes.forEach(([hue, dx], i) => {
        g.save();
        g.translate(CUP_X + 26 + i * 16, base - 2 - (i % 2) * 2);
        g.rotate(0.1 * (i - 1.5));
        brush(g, S.mixHex(hue, P.taupe, 0.35), i === 3);
        g.restore();
        void dx;
      });
      return;
    }
    g.save();
    g.translate(CUP_X, base);
    g.rotate((1 - up) * (Math.PI / 2 - 0.1));
    brushes.forEach(([hue, dx, tilt], i) => {
      g.save();
      g.translate(dx, -22);
      g.rotate(-Math.PI / 2 + tilt);
      brush(g, hue, i === 3);
      g.restore();
    });
    cupBody(g, true);
    g.restore();
  }

  function cupBody(g, clean) {
    const body = g.createLinearGradient(-11, 0, 11, 0);
    body.addColorStop(0, S.shadeHex(TONE.enamel, -0.25));
    body.addColorStop(0.4, S.shadeHex(TONE.enamel, 0.15));
    body.addColorStop(1, S.shadeHex(TONE.enamel, -0.35));
    g.fillStyle = clean ? body : S.mixHex(TONE.enamel, P.taupe, 0.4);
    g.beginPath();
    g.moveTo(-11, -26);
    g.lineTo(11, -26);
    g.lineTo(9, 0);
    g.lineTo(-9, 0);
    g.closePath();
    g.fill();
    g.fillStyle = S.rgba(P.soot, 0.35);
    g.beginPath();
    g.ellipse(0, -26, 11, 3, 0, 0, Math.PI * 2);
    g.fill();
  }

  // A toothbrush lying along +x: handle, then the head with bristles.
  function brush(g, hue, taped) {
    g.fillStyle = hue;
    g.beginPath();
    g.roundRect(0, -2, 34, 4, 2);
    g.fill();
    g.fillStyle = S.mixHex(P.bone, P.linen, 0.2);
    g.fillRect(28, -6, 8, 4);
    if (taped) {
      g.fillStyle = S.mixHex(P.bone, P.linen, 0.5);
      g.fillRect(8, -3, 10, 6);
      g.save();
      g.translate(13, 0);
      g.rotate(Math.PI / 2);
      g.fillStyle = S.rgba(P.soot, 0.9);
      g.font = '700 7px Caveat, "Segoe Print", cursive';
      g.textAlign = 'center';
      g.fillText('A.', 0, 2.5);
      g.restore();
    }
  }

  // The hot tap: dripping and steaming while it runs.
  function drawTap(g, live, t) {
    if (!live.tapRunning) return;
    const { tapX, tapY } = VANITY;
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.35 + i / 3) % 1;
      const x = tapX + Math.sin(t * 1.3 + i * 2) * 8 * p;
      const y = tapY + 8 - p * 70;
      g.fillStyle = S.rgba(P.bone, 0.18 * (1 - p));
      g.beginPath();
      g.arc(x, y, 6 + p * 16, 0, Math.PI * 2);
      g.fill();
    }
  }

  // The basket lid, hinged at the back: it lifts when hatchlings spill.
  function drawBasketLid(g, live, mk) {
    const lid = S.clamp(live.basketLid ?? 0, 0, 1);
    const clean = sweptPast(mk, BASKET.x0);
    const { x0, x1, top } = BASKET;
    const lift = Math.sin(S.clamp(lid, 0, 1) * Math.PI * 0.5) * 34;
    g.fillStyle = aged(S.shadeHex(TONE.wicker, 0.08), clean);
    poly(g, [[x0 - 2, top + 10 - lift * 0.2], [x1 + 2, top + 10 - lift * 0.2], [x1, top - lift], [x0, top - lift]]);
    g.fill();
    g.fillStyle = S.rgba(P.soot, 0.3);
    g.fillRect(x0, top + 6 - lift * 0.2, x1 - x0, 4);
    g.fillStyle = aged(P.brass, clean);
    g.fillRect((x0 + x1) / 2 - 8, top - lift - 4, 16, 5);
    if (lid > 0.02) {
      g.fillStyle = P.soot;
      g.fillRect(x0 + 8, top + 8, x1 - x0 - 16, 6);
    }
  }

  function drawOnFurniture(g, live, t, mk) {
    drawMirror(g, live, t, mk);
    drawBulbs(g, mk);
    drawTap(g, live, t);
    drawCup(g, live, mk);
    drawBasketLid(g, live, mk);
  }

  // ── Light ─────────────────────────────────────────────────────────────

  // The skylight's shaft falls slanting down across the bath.
  function skyShaft() {
    const { bl, br } = SKY;
    return [bl, br, [BATH.x1 - 20, BATH.rim + 40], [BATH.x0 - 60, BATH.rim + 60]];
  }

  function lights(lm, live, t, mk) {
    const open = S.clamp(mk.skylight ?? 0, 0, 1);
    const win = S.mixHex(P.moon, P.dawn, mk.window);
    const c = [(SKY.bl[0] + SKY.tr[0]) / 2, (SKY.bl[1] + SKY.tr[1]) / 2];
    // Closed shutters let a little moonlight through the slats.
    lm.point(c[0], c[1] + 40, 300, P.moon, S.lerp(0.35, 0, open));
    lm.shaft(skyShaft(), P.moon, 0.25 * (1 - open));
    if (open > 0.01) {
      lm.shaft(skyShaft(), win, open);
      lm.point(c[0], c[1] + 60, 520, win, 0.7 * open);
    }
    // The mirror's bulbs.
    let sum = 0;
    BULBS.forEach(([bx, by], i) => {
      const on = bulbOn(i, mk);
      sum += on;
      if (on > 0.01) lm.point(bx, by, 80, P.amber, 0.45 * on);
    });
    const pool = sum / BULBS.length;
    if (pool > 0.01) {
      lm.point(1070, 520, 520, P.amber, 0.6 * pool);
      lm.point(1070, VANITY.top, 360, P.dawn, 0.45 * pool);
    }
    // The landing light under the door, off to the right: a faint warm spill
    // so the cupboard and basket read in the dark.
    lm.point(1760, 900, 280, P.amber, S.lerp(0.22, 0.1, mk.window));
    // The mirror throws a little of the room's light back.
    lm.point(1070, 520, 300, P.moon, S.lerp(0.18, 0, mk.window));
    return 1;
  }

  function glow(g, lm, live, t, mk) {
    const open = S.clamp(mk.skylight ?? 0, 0, 1);
    const c = [(SKY.bl[0] + SKY.tr[0]) / 2, (SKY.bl[1] + SKY.tr[1]) / 2];
    if (open > 0.01) {
      S.light.beam(g, skyShaft(), mk.window > 0.5 ? P.dawn : P.moon, 0.28 * open);
      S.light.glow(g, c[0], c[1], 160, P.dawn, 0.35 * open);
    } else {
      S.light.glow(g, c[0], c[1], 90, P.moon, 0.12);
    }
    BULBS.forEach(([bx, by], i) => {
      const on = bulbOn(i, mk);
      if (on > 0.01) S.light.glow(g, bx, by, 16, P.bone, 0.7 * on);
    });
    void lm;
    void live;
    void t;
  }

  function beat() {}

  S.rooms.attachArt('upstairs-bathroom', {
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
