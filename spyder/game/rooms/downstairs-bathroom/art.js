/*
 * Spyder — Room 6, the Downstairs Bathroom: painting, light and glow.
 *
 * The logic (layout, platforms, puddles, the bulb's swing and blackouts,
 * the dripping tap) lives in room.js; this file only paints. It reads the
 * shared state room.js keeps on `live` (`live.bulb`, `live.dripTimer`) and
 * the makeover values on `mk` (`mirror`, `tap`, `bulb`).
 *
 * The room has to feel narrow, so it is the only one drawn with its side
 * walls in view: one-point perspective toward a vanishing point at
 * (960, 440), tiled like the back wall, darker, closing in. The floor's
 * hexagonal mosaic is projected with the same camera.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const { paintShape, wobblyPath, rectPoints, roundedRectPoints, ellipsePoints, softShadow, stain } = S.paint;

  // ── Layout (stage units; must match room.js) ───────────────────────────

  const CEILING = 110;
  const BORDER_TOP = 380; // moulded tile border
  const BORDER_BOTTOM = 396;
  const FLOOR_LINE = 770;
  const GROUND = 935;
  const BACK = { x0: 260, x1: 1660 };
  const VP = { x: 960, y: 440 }; // the camera looks at the middle of the back wall
  const FOCAL = 1400; // world units per depth unit, for the floor mosaic

  const WINDOW = { x: 420, y: 170, w: 220, h: 160 };
  const TUB = { x0: 300, x1: 760, rimY: 760, footY: 900, tapX: 360, tapY: 720 };
  const SINK = { x0: 1040, x1: 1240, rimY: 765 };
  const MIRROR = { x: 1040, y: 330, w: 200, h: 250 };
  const GLASS = { x: 1058, y: 348, w: 164, h: 214 };
  const STRIP = { x0: 1060, x1: 1220, y: 310 };
  const SHELF = { x0: 1360, x1: 1600, y: 600 };
  const CISTERN = { x0: 1420, x1: 1540, y0: 250, y1: 330 };
  const BOWL = { x0: 1400, x1: 1560, lidY: 820 };
  const ROSE = { x: 960, y: 0 };
  const PUDDLES = [
    { x0: 520, x1: 640 },
    { x0: 880, x1: 1010 },
    { x0: 1300, x1: 1380 },
  ];
  const SPOUT = { x: 380, y: 731 }; // where the tub tap's drop forms

  const LIGHT_DIR = { x: 0.35, y: -0.94 }; // toward the bare bulb, high and central

  // ── Tones (palette mixes only) ────────────────────────────────────────

  const TONE = {
    tile: S.mixHex(P.bone, P.linen, 0.45),
    tileDirty: S.mixHex(S.mixHex(P.linen, P.taupe, 0.42), P.oak, 0.12),
    grout: S.mixHex(P.taupe, P.linen, 0.35),
    groutDirty: S.mixHex(P.umber, P.taupe, 0.5),
    border: S.mixHex(P.moss, P.taupe, 0.45),
    plaster: S.mixHex(P.moss, P.linen, 0.55),
    plasterDirty: S.mixHex(S.mixHex(P.moss, P.linen, 0.4), P.taupe, 0.35),
    hexWhite: S.mixHex(P.bone, P.taupe, 0.35),
    hexBlack: S.mixHex(P.soot, P.taupe, 0.48),
    enamel: S.mixHex(P.bone, P.linen, 0.25),
    enamelDirty: S.mixHex(P.linen, P.taupe, 0.38),
    porcelain: S.mixHex(P.bone, P.linen, 0.3),
    brass: P.brass,
    brassDirty: S.mixHex(P.brass, P.umber, 0.45),
    iron: S.mixHex(P.gear, P.moss, 0.3),
    rust: S.mixHex(P.rust, P.ember, 0.2),
    mould: S.mixHex(P.moss, P.soot, 0.4),
    cabinet: S.mixHex(P.moss, P.linen, 0.45),
  };

  const tileTone = (clean) => (clean ? TONE.tile : TONE.tileDirty);

  // Where a back-wall line at height y meets the screen edge at x, seen on
  // a side wall: the line runs straight to the vanishing point.
  const rayY = (y, x, edge) => VP.y + (y - VP.y) * ((x - VP.x) / (edge - VP.x));

  // ── Back layer: walls, ceiling, floor, window ─────────────────────────

  function paintBack(g, clean) {
    paintCeiling(g, clean);
    paintPlaster(g, clean);
    paintTileBorder(g, clean);
    paintBackTiles(g, clean);
    paintSideWall(g, clean, -1);
    paintSideWall(g, clean, 1);
    paintFloor(g, clean);
    paintWindow(g, clean);
  }

  function paintCeiling(g, clean) {
    const top = rayY(CEILING, 0, BACK.x0);
    paintShape(g, [[-10, top - 10], [1930, top - 10], [BACK.x1, CEILING], [BACK.x0, CEILING]], {
      color: clean ? S.mixHex(P.linen, P.taupe, 0.5) : S.mixHex(P.umber, P.taupe, 0.35),
      lightDir: { x: 0, y: 1 },
      light: 0.15,
      shadow: 0.5,
      strokes: 7,
      strokeAngle: 0,
      rim: 0,
      wobble: 0,
      seed: 6001,
    });
    // Ceiling rose the bulb hangs from.
    paintShape(g, ellipsePoints(ROSE.x, ROSE.y + 6, 34, 9, 20), {
      color: clean ? P.linen : S.mixHex(P.linen, P.taupe, 0.5),
      lightDir: { x: 0, y: 1 },
      light: 0.2,
      shadow: 0.4,
      strokes: 3,
      rim: 0.2,
      seed: 6002,
    });
    if (!clean) {
      // A crack across the plaster and a damp brown bloom by the cord.
      g.strokeStyle = S.rgba(P.soot, 0.5);
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(620, 18);
      g.lineTo(700, 52);
      g.lineTo(760, 46);
      g.lineTo(840, 90);
      g.stroke();
      stain(g, 1120, 50, 60, P.rust, 6003, 0.3);
    }
    // The join with the back wall.
    g.fillStyle = S.rgba(P.soot, 0.4);
    g.fillRect(BACK.x0, CEILING - 2, BACK.x1 - BACK.x0, 5);
  }

  function paintPlaster(g, clean) {
    paintShape(g, rectPoints(BACK.x0, CEILING, BACK.x1 - BACK.x0, BORDER_TOP - CEILING + 2), {
      color: clean ? TONE.plaster : TONE.plasterDirty,
      lightDir: LIGHT_DIR,
      light: 0.14,
      shadow: 0.3,
      strokes: 9,
      strokeAngle: 0.2,
      strokeJitter: 0.9,
      variance: 0.08,
      rim: 0,
      innerShadow: 0.2,
      wobble: 0,
      seed: 6010,
    });
    if (!clean) {
      // Water stains run down from the ceiling; mould blooms in the corners.
      for (const [x, r, seed] of [[330, 70, 6011], [780, 54, 6012], [1240, 80, 6013], [1590, 62, 6014]]) {
        stain(g, x, CEILING + 30, r, P.oak, seed, 0.26);
      }
      const rng = S.createRng(6015);
      for (const cx of [290, 1630, 700]) {
        for (let i = 0; i < 70; i++) {
          const a = rng.range(0, Math.PI * 2);
          const d = Math.pow(rng.next(), 1.6) * 70;
          g.fillStyle = S.rgba(TONE.mould, rng.range(0.15, 0.45));
          g.beginPath();
          g.arc(cx + Math.cos(a) * d, CEILING + 14 + Math.abs(Math.sin(a)) * d * 0.7, rng.range(1.5, 5), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }

  // The moulded border: a rounded bead of darker glazed tile at y 380.
  function paintTileBorder(g, clean) {
    paintShape(g, rectPoints(BACK.x0, BORDER_TOP, BACK.x1 - BACK.x0, BORDER_BOTTOM - BORDER_TOP), {
      color: clean ? TONE.border : S.mixHex(TONE.border, P.umber, 0.35),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.45,
      strokes: 4,
      strokeAngle: 0,
      rim: 0.45,
      rimColor: P.bone,
      innerShadow: 0.25,
      wobble: 0.4,
      seed: 6020,
    });
    g.fillStyle = S.rgba(P.bone, clean ? 0.4 : 0.2);
    g.fillRect(BACK.x0, BORDER_TOP + 3, BACK.x1 - BACK.x0, 2);
  }

  /*
   * Subway tiles, 64 × 32, in running bond. The whole field is painted once
   * with brush texture; each tile then gets its own glaze: a tone wobble, a
   * lit top-left edge, a shadowed bottom-right edge, a soft sheen and (on
   * most tiles) a fine craze of cracks in the glaze. Grout lines are drawn
   * freehand with noise.
   */
  function paintBackTiles(g, clean) {
    const y0 = BORDER_BOTTOM;
    const y1 = FLOOR_LINE;
    const TW = 64;
    const TH = 32;
    const base = tileTone(clean);
    paintShape(g, rectPoints(BACK.x0, y0, BACK.x1 - BACK.x0, y1 - y0), {
      color: base,
      lightDir: LIGHT_DIR,
      light: 0.16,
      shadow: 0.32,
      strokes: 8,
      strokeAngle: 0,
      strokeJitter: 0.15,
      variance: 0.06,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 6030,
    });
    const rng = S.createRng(6031);
    const noise = S.createNoise(6032);
    const cracked = new Set(['3,5', '7,11', '9,17', '4,19', '10,8', '2,14']);
    const missing = new Set(['6,9', '10,16', '8,3']);

    for (let row = 0, y = y0; y < y1; row++, y += TH) {
      const offset = row % 2 ? TW / 2 : 0;
      for (let col = 0, x = BACK.x0 - offset; x < BACK.x1; col++, x += TW) {
        const key = `${row},${col}`;
        const tx = Math.max(x, BACK.x0);
        const tw = Math.min(x + TW, BACK.x1) - tx;
        if (tw <= 2) continue;
        if (!clean && missing.has(key)) {
          paintMissingTile(g, tx, y, tw, TH, rng);
          continue;
        }
        // Tone wobble per tile: no two hand-made tiles are quite the same.
        g.fillStyle = S.rgba(S.shadeHex(base, rng.range(-0.08, 0.06)), 0.4);
        g.fillRect(tx, y, tw, TH);
        // Glaze sheen: brighter toward the top-left.
        const sheen = g.createLinearGradient(tx, y, tx + tw, y + TH);
        sheen.addColorStop(0, S.rgba(P.bone, clean ? 0.28 : 0.12));
        sheen.addColorStop(0.5, S.rgba(P.bone, 0));
        sheen.addColorStop(1, S.rgba(P.soot, clean ? 0.08 : 0.14));
        g.fillStyle = sheen;
        g.fillRect(tx, y, tw, TH);
        // Bevelled edges.
        g.fillStyle = S.rgba(P.bone, clean ? 0.45 : 0.2);
        g.fillRect(tx + 1, y + 1, tw - 2, 1.5);
        g.fillRect(tx + 1, y + 1, 1.5, TH - 2);
        g.fillStyle = S.rgba(P.soot, clean ? 0.16 : 0.24);
        g.fillRect(tx + 1, y + TH - 3, tw - 2, 2);
        g.fillRect(tx + tw - 3, y + 1, 2, TH - 2);
        // Crazed glaze.
        if (rng.chance(0.6)) crazing(g, tx, y, tw, TH, rng, clean ? 0.12 : 0.2);
        if (!clean && cracked.has(key)) {
          g.strokeStyle = S.rgba(P.soot, 0.7);
          g.lineWidth = 1.4;
          g.beginPath();
          let cx = tx + rng.range(4, tw * 0.4);
          let cy = y;
          g.moveTo(cx, cy);
          while (cy < y + TH) {
            cx += rng.range(-6, 9);
            cy += rng.range(5, 10);
            g.lineTo(Math.min(cx, tx + tw), Math.min(cy, y + TH));
          }
          g.stroke();
        }
      }
    }

    // Grout, freehand: horizontal joints wander a little, verticals per row.
    g.strokeStyle = clean ? S.rgba(TONE.grout, 0.85) : S.rgba(TONE.groutDirty, 0.85);
    g.lineWidth = 2.4;
    for (let y = y0; y <= y1; y += TH) {
      g.beginPath();
      for (let x = BACK.x0; x <= BACK.x1; x += 20) {
        const yy = y + noise(x * 0.02 + y) * 0.9;
        if (x === BACK.x0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    }
    for (let row = 0, y = y0; y < y1; row++, y += TH) {
      const offset = row % 2 ? TW / 2 : 0;
      for (let x = BACK.x0 - offset + TW; x < BACK.x1; x += TW) {
        g.beginPath();
        g.moveTo(x + noise(x + y) * 0.8, y);
        g.lineTo(x + noise(x - y) * 0.8, y + TH);
        g.stroke();
      }
    }

    // Dirt collects low on the wall and behind the fixtures.
    const grime = g.createLinearGradient(0, y0, 0, y1);
    grime.addColorStop(0, S.rgba(P.soot, clean ? 0 : 0.08));
    grime.addColorStop(1, S.rgba(P.soot, clean ? 0.12 : 0.34));
    g.fillStyle = grime;
    g.fillRect(BACK.x0, y0, BACK.x1 - BACK.x0, y1 - y0);
    if (!clean) {
      stain(g, 520, 700, 90, P.oak, 6033, 0.22); // splashes behind the tub
      stain(g, 1150, 720, 60, P.oak, 6034, 0.2);
    }
  }

  function crazing(g, x, y, w, h, rng, alpha) {
    g.strokeStyle = S.rgba(P.soot, alpha);
    g.lineWidth = 0.7;
    for (let k = 0; k < rng.int(2, 4); k++) {
      let cx = x + rng.range(2, w - 2);
      let cy = y + rng.range(2, h - 2);
      g.beginPath();
      g.moveTo(cx, cy);
      for (let j = 0; j < 3; j++) {
        cx = S.clamp(cx + rng.range(-10, 10), x + 1, x + w - 1);
        cy = S.clamp(cy + rng.range(-6, 6), y + 1, y + h - 1);
        g.lineTo(cx, cy);
      }
      g.stroke();
    }
  }

  // A fallen tile: the grey bed of mortar shows, with chipped edges.
  function paintMissingTile(g, x, y, w, h, rng) {
    g.fillStyle = S.mixHex(P.taupe, P.umber, 0.45);
    g.fillRect(x, y, w, h);
    g.fillStyle = S.rgba(P.soot, 0.45);
    g.fillRect(x, y, w, 4);
    g.fillRect(x, y, 3, h);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = S.rgba(P.linen, rng.range(0.08, 0.2));
      g.fillRect(x + rng.range(4, w - 6), y + rng.range(4, h - 6), rng.range(2, 6), rng.range(1, 3));
    }
  }

  /*
   * A side wall, seen at a steep angle. side = -1 is the left wall (from
   * the back wall's left edge out to the screen's left edge), 1 the right.
   * Tile columns get wider toward the viewer, rows run to the vanishing
   * point. Darker than the back wall: less of the bulb reaches it.
   */
  function paintSideWall(g, clean, side) {
    const inner = side < 0 ? BACK.x0 : BACK.x1;
    const outer = side < 0 ? 0 : 1920;
    const yAt = (y) => rayY(y, outer, inner);
    const quad = (yTop, yBottom) => [[inner, yTop], [outer, yAt(yTop)], [outer, yAt(yBottom)], [inner, yBottom]];
    const darker = (hex) => S.mixHex(hex, P.soot, 0.35);

    // Plaster above the tiles, the border band, then the tiles.
    paintShape(g, quad(CEILING, BORDER_TOP), {
      color: darker(clean ? TONE.plaster : TONE.plasterDirty),
      lightDir: { x: -side, y: -0.4 },
      light: 0.12,
      shadow: 0.4,
      strokes: 8,
      strokeAngle: side * -0.35,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 6040 + side,
    });
    paintShape(g, quad(BORDER_TOP, BORDER_BOTTOM), {
      color: darker(TONE.border),
      lightDir: { x: 0, y: -1 },
      light: 0.25,
      shadow: 0.4,
      strokes: 3,
      rim: 0.3,
      rimColor: P.bone,
      innerShadow: 0,
      wobble: 0,
      seed: 6042 + side,
    });
    const tiles = quad(BORDER_BOTTOM, FLOOR_LINE);
    paintShape(g, tiles, {
      color: darker(tileTone(clean)),
      lightDir: { x: -side, y: -0.4 },
      light: 0.15,
      shadow: 0.4,
      strokes: 8,
      strokeAngle: side * -0.35,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 6044 + side,
    });

    // Joints: the wall plane is X = ±700 at depths from 1 (the back wall)
    // to where it leaves the screen; a 64-unit tile is 64/FOCAL deep.
    g.save();
    g.beginPath();
    tiles.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    g.strokeStyle = S.rgba(clean ? TONE.grout : TONE.groutDirty, 0.75);
    g.lineWidth = 2;
    const zEdge = 700 / Math.abs(outer - VP.x);
    for (let z = 1; z > zEdge - 0.06; z -= 64 / FOCAL) {
      const x = VP.x + (side * 700) / z;
      g.beginPath();
      g.moveTo(x, VP.y + (BORDER_BOTTOM - VP.y) / z);
      g.lineTo(x, VP.y + (FLOOR_LINE - VP.y) / z);
      g.stroke();
    }
    for (let y = BORDER_BOTTOM; y <= FLOOR_LINE; y += 32) {
      g.beginPath();
      g.moveTo(inner, y);
      g.lineTo(outer, yAt(y));
      g.stroke();
    }
    g.restore();

    // The wall darkens toward the viewer: it is in the bulb's shadow.
    const fall = g.createLinearGradient(inner, 0, outer, 0);
    fall.addColorStop(0, S.rgba(P.soot, 0.2));
    fall.addColorStop(1, S.rgba(P.soot, clean ? 0.5 : 0.62));
    g.fillStyle = fall;
    g.beginPath();
    quad(CEILING - 1, FLOOR_LINE).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    // The corner where it meets the back wall.
    g.fillStyle = S.rgba(P.soot, 0.45);
    g.fillRect(inner - (side < 0 ? 3 : 0), CEILING, 3, FLOOR_LINE - CEILING);
  }

  /*
   * Hexagonal mosaic floor. The hexes are laid out on the floor plane in
   * world units (X across, D into the room), then projected with the same
   * camera as the walls: z = 1 - D / FOCAL, x = 960 + X / z, y = 440 + 330 / z.
   * White field with a scattered pattern of dark hexes, all muted.
   */
  function paintFloor(g, clean) {
    const project = (X, D) => {
      const z = 1 - D / FOCAL;
      return [VP.x + X / z, VP.y + (FLOOR_LINE - VP.y) / z];
    };
    const floorPoly = [[BACK.x0, FLOOR_LINE], [BACK.x1, FLOOR_LINE], [1920, rayY(FLOOR_LINE, 1920, BACK.x1)], [1920, 1080], [0, 1080], [0, rayY(FLOOR_LINE, 0, BACK.x0)]];
    const grout = clean ? S.mixHex(TONE.grout, P.taupe, 0.4) : S.mixHex(TONE.groutDirty, P.soot, 0.2);
    paintShape(g, floorPoly, {
      color: grout,
      lightDir: { x: 0, y: -1 },
      light: 0.1,
      shadow: 0.3,
      strokes: 4,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 6050,
    });

    const s = 15; // hex circumradius, world units
    const dx = 1.5 * s;
    const dy = Math.sqrt(3) * s;
    const rng = S.createRng(6051);
    const white = clean ? TONE.hexWhite : S.mixHex(TONE.hexWhite, P.oak, 0.25);
    const black = TONE.hexBlack;
    g.save();
    g.beginPath();
    floorPoly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    const maxD = FOCAL * (1 - (FLOOR_LINE - VP.y) / (1080 - VP.y)) + dy;
    for (let col = -34; col <= 34; col++) {
      const X = col * dx;
      for (let row = 0; row * dy < maxD; row++) {
        const D = row * dy + (col & 1 ? dy / 2 : 0);
        const dark = (((col % 7) + 7) % 7 === 0 && row % 3 === 1) || (((col + 3) % 7 + 7) % 7 === 0 && row % 3 === 0 && col % 2);
        let tone = dark ? black : white;
        if (!clean && rng.chance(0.05)) tone = S.mixHex(tone, P.umber, 0.5);
        g.fillStyle = S.shade(tone, rng.range(-0.05, 0.04));
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const [px, py] = project(X + Math.cos(a) * s * 0.86, D + Math.sin(a) * s * 0.86);
          if (k === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.fill();
      }
    }
    g.restore();

    // The drain in the floor, and cracks running out from it when dirty.
    const [drx, dry] = project(40, 450);
    if (!clean) {
      g.strokeStyle = S.rgba(P.soot, 0.6);
      g.lineWidth = 1.5;
      for (const [ax, ay] of [[-1, -0.3], [0.9, -0.5], [0.4, 0.8], [-0.6, 0.7]]) {
        g.beginPath();
        g.moveTo(drx, dry);
        let x = drx;
        let y = dry;
        for (let j = 0; j < 4; j++) {
          x += ax * 26 + rng.range(-8, 8);
          y += ay * 9 + rng.range(-4, 4);
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    paintShape(g, ellipsePoints(drx, dry, 26, 9, 20), {
      color: clean ? TONE.brass : TONE.brassDirty,
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.5,
      strokes: 2,
      rim: 0.4,
      wobble: 0.3,
      seed: 6052,
    });
    g.strokeStyle = S.rgba(P.soot, 0.75);
    g.lineWidth = 2;
    for (let k = -2; k <= 2; k++) {
      g.beginPath();
      g.moveTo(drx - 16 + Math.abs(k) * 3, dry + k * 3);
      g.lineTo(drx + 16 - Math.abs(k) * 3, dry + k * 3);
      g.stroke();
    }

    // Light and grime: darker toward the viewer and the side walls.
    const fall = g.createRadialGradient(960, 880, 120, 960, 900, 980);
    fall.addColorStop(0, 'rgba(0,0,0,0)');
    fall.addColorStop(1, S.rgba(P.soot, clean ? 0.45 : 0.6));
    g.fillStyle = fall;
    g.beginPath();
    floorPoly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    if (!clean) {
      g.fillStyle = S.rgba(P.umber, 0.22);
      g.fill();
    }
    const join = g.createLinearGradient(0, FLOOR_LINE, 0, FLOOR_LINE + 24);
    join.addColorStop(0, S.rgba(P.soot, 0.55));
    join.addColorStop(1, S.rgba(P.soot, 0));
    g.fillStyle = join;
    g.fillRect(BACK.x0, FLOOR_LINE, BACK.x1 - BACK.x0, 24);
  }

  // The frosted window: no view, only a cold glow through textured glass.
  function paintWindow(g, clean) {
    const { x, y, w, h } = WINDOW;
    g.save();
    g.filter = 'blur(10px)';
    g.fillStyle = 'rgba(10,8,6,0.4)';
    g.fillRect(x - 6, y + 10, w + 22, h + 18);
    g.restore();
    paintShape(g, rectPoints(x - 14, y - 14, w + 28, h + 28), {
      color: clean ? P.linen : S.mixHex(P.linen, P.taupe, 0.5),
      lightDir: LIGHT_DIR,
      light: 0.2,
      shadow: 0.4,
      strokes: 6,
      strokeAngle: Math.PI / 2,
      rim: 0.3,
      wobble: 0.8,
      seed: 6060,
    });
    const glass = g.createLinearGradient(x, y, x, y + h);
    glass.addColorStop(0, clean ? S.mixHex(P.sky, P.bone, 0.45) : S.mixHex(P.moon, P.taupe, 0.45));
    glass.addColorStop(1, clean ? S.mixHex(P.dawn, P.bone, 0.5) : S.mixHex(P.moon, P.umber, 0.55));
    g.fillStyle = glass;
    g.fillRect(x, y, w, h);
    // Frosting: a stipple of tiny light and dark specks, denser at the edges.
    const rng = S.createRng(6061);
    for (let i = 0; i < 1600; i++) {
      const px = x + rng.next() * w;
      const py = y + rng.next() * h;
      g.fillStyle = rng.chance(0.5) ? S.rgba(P.bone, rng.range(0.05, 0.2)) : S.rgba(P.soot, rng.range(0.03, 0.1));
      g.fillRect(px, py, rng.range(1, 2.5), rng.range(1, 2.5));
    }
    // Glazing bars and a grimy lower edge.
    g.fillStyle = clean ? P.linen : S.mixHex(P.linen, P.taupe, 0.45);
    g.fillRect(x + w / 2 - 4, y, 8, h);
    g.fillRect(x, y + h / 2 - 4, w, 8);
    if (!clean) {
      const grime = g.createLinearGradient(0, y + h * 0.6, 0, y + h);
      grime.addColorStop(0, S.rgba(P.umber, 0));
      grime.addColorStop(1, S.rgba(P.umber, 0.45));
      g.fillStyle = grime;
      g.fillRect(x, y + h * 0.6, w, h * 0.4);
    }
    // Sill.
    paintShape(g, rectPoints(x - 22, y + h + 12, w + 44, 12), {
      color: clean ? P.linen : S.mixHex(P.linen, P.taupe, 0.5),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.4,
      strokes: 3,
      rim: 0.3,
      wobble: 0.5,
      seed: 6062,
    });
  }

  // ── Furniture layer ───────────────────────────────────────────────────

  function paintFurniture(g, clean) {
    paintRailAndCurtain(g, clean);
    paintTub(g, clean);
    paintMirrorCabinet(g, clean);
    paintSink(g, clean);
    paintSprayBottle(g, clean);
    paintShelf(g, clean);
    paintToilet(g, clean);
    if (!clean) paintFloorTowel(g);
  }

  // The curtain is painted on its own canvas so its tear can be cut out
  // and the whole of it laid down translucent: a crawler behind it shows
  // through as a dark shape.
  function paintRailAndCurtain(g, clean) {
    const railY = (x) => 204 - Math.sin(((x - 296) / 468) * Math.PI) * 10;
    // Ceiling stays for the rail.
    g.strokeStyle = clean ? TONE.brass : TONE.brassDirty;
    g.lineWidth = 3;
    for (const sx of [410, 650]) {
      g.beginPath();
      g.moveTo(sx, CEILING);
      g.lineTo(sx, railY(sx));
      g.stroke();
    }
    // The rail: a brass tube, lit along its top.
    for (const [w, col, dy] of [[7, S.shadeHex(clean ? TONE.brass : TONE.brassDirty, -0.4), 1], [5, clean ? TONE.brass : TONE.brassDirty, 0], [1.5, S.mixHex(P.brass, P.bone, clean ? 0.5 : 0.2), -1.5]]) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      for (let x = 296; x <= 764; x += 12) {
        if (x === 296) g.moveTo(x, railY(x) + dy);
        else g.lineTo(x, railY(x) + dy);
      }
      g.stroke();
    }

    const cw = 190;
    const ch = 620;
    const c = S.makeCanvas(cw, ch);
    const cg = c.getContext('2d');
    const left = 578; // stage x of the canvas' left edge
    const top = 196;
    const folds = 8;
    const hem = (x) => 590 + Math.sin(x * 0.11) * 10 + (x / cw) * 14;
    const fabric = clean ? S.mixHex(P.bone, P.linen, 0.4) : S.mixHex(P.linen, P.taupe, 0.4);
    const outline = [[6, 12]];
    for (let i = 0; i <= folds; i++) outline.push([6 + (i / folds) * (cw - 12), 12 + (i % 2) * 4]);
    for (let x = cw - 6; x >= 6; x -= 10) outline.push([x, hem(x)]);
    paintShape(cg, outline, {
      color: fabric,
      lightDir: { x: -0.6, y: -0.7 },
      light: 0.2,
      shadow: 0.3,
      strokes: 22,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.1,
      rim: 0.2,
      innerShadow: 0.2,
      wobble: 1.2,
      seed: 6070,
    });
    cg.save();
    wobblyPath(cg, outline, { wobble: 1.2, seed: 6070 });
    cg.clip();
    // Stripes when clean: soft blue-grey bands, bent by the folds.
    if (clean) {
      for (let x = 10; x < cw; x += 26) {
        cg.fillStyle = S.rgba(S.mixHex(P.moon, P.taupe, 0.4), 0.35);
        cg.fillRect(x, 0, 9, ch);
      }
    }
    // Folds: a shadow band beside a lit band, all the way down.
    for (let i = 0; i < folds; i++) {
      const fx = 6 + (i + 0.5) * ((cw - 12) / folds);
      const band = cg.createLinearGradient(fx - 12, 0, fx + 12, 0);
      band.addColorStop(0, 'rgba(0,0,0,0)');
      band.addColorStop(0.4, S.rgba(P.soot, clean ? 0.22 : 0.32));
      band.addColorStop(0.62, S.rgba(P.bone, clean ? 0.3 : 0.14));
      band.addColorStop(1, 'rgba(0,0,0,0)');
      cg.fillStyle = band;
      cg.fillRect(fx - 12, 0, 24, ch);
    }
    if (!clean) {
      // Mould climbing up from the hem, and a yellowed water line.
      const rng = S.createRng(6071);
      for (let i = 0; i < 260; i++) {
        const x = rng.range(8, cw - 8);
        const y = 600 - Math.pow(rng.next(), 2) * 260;
        cg.fillStyle = S.rgba(TONE.mould, rng.range(0.15, 0.55));
        cg.beginPath();
        cg.arc(x, y, rng.range(1, 3.6), 0, Math.PI * 2);
        cg.fill();
      }
      cg.fillStyle = S.rgba(P.oak, 0.22);
      cg.fillRect(0, 470, cw, 26);
    }
    cg.restore();
    if (!clean) {
      // The tear: a ragged hole, cut right out of the fabric.
      cg.save();
      cg.globalCompositeOperation = 'destination-out';
      const rng = S.createRng(6072);
      cg.beginPath();
      const tx = 120;
      const ty = 300;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        const r = (k % 2 ? 10 : 22) * rng.range(0.7, 1.2);
        const px = tx + Math.cos(a) * r * 0.7;
        const py = ty + Math.sin(a) * r * 1.6;
        if (k === 0) cg.moveTo(px, py);
        else cg.lineTo(px, py);
      }
      cg.closePath();
      cg.fill();
      cg.restore();
    }
    // Rings on the rail.
    for (let i = 0; i <= folds; i++) {
      const rx = 6 + (i / folds) * (cw - 12);
      cg.strokeStyle = clean ? P.brass : TONE.brassDirty;
      cg.lineWidth = 2;
      cg.beginPath();
      cg.ellipse(rx, 9, 4, 6, 0, 0, Math.PI * 2);
      cg.stroke();
    }
    g.save();
    g.globalAlpha = clean ? 0.86 : 0.8;
    g.drawImage(c, left, top);
    g.restore();
  }

  function paintTub(g, clean) {
    const enamel = clean ? TONE.enamel : TONE.enamelDirty;
    softShadow(g, 530, 902, 270, 20, 0.6);
    // The body, from the rolled rim down to its curved belly.
    const body = [[300, 754], [760, 754], [767, 764], [758, 800], [742, 838], [716, 866], [344, 866], [318, 838], [302, 800], [293, 764]];
    paintShape(g, body, {
      color: enamel,
      lightDir: { x: 0.45, y: -0.89 },
      light: 0.22,
      shadow: 0.42,
      strokes: 10,
      strokeAngle: 0,
      strokeJitter: 0.2,
      variance: 0.05,
      rim: 0.45,
      rimColor: P.bone,
      innerShadow: 0.3,
      wobble: 1.2,
      seed: 6080,
    });
    // A belly highlight: enamel is glossy.
    const gloss = g.createLinearGradient(0, 770, 0, 840);
    gloss.addColorStop(0, S.rgba(P.bone, clean ? 0.32 : 0.12));
    gloss.addColorStop(1, S.rgba(P.bone, 0));
    g.fillStyle = gloss;
    g.beginPath();
    g.ellipse(560, 792, 170, 14, 0, 0, Math.PI * 2);
    g.fill();
    // The inside, seen over the far rim: shadowed enamel, and the tide line.
    paintShape(g, [[312, 754], [748, 754], [740, 745], [320, 745]], {
      color: S.shadeHex(enamel, -0.35),
      lightDir: { x: 0, y: 1 },
      light: 0.1,
      shadow: 0.3,
      strokes: 3,
      rim: 0,
      innerShadow: 0,
      wobble: 0.4,
      seed: 6081,
    });
    if (!clean) {
      g.strokeStyle = S.rgba(P.taupe, 0.8);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(326, 750);
      g.lineTo(742, 750);
      g.stroke();
      // Rust from years of the dripping tap, running over the rim.
      const rust = g.createLinearGradient(0, 750, 0, 850);
      rust.addColorStop(0, S.rgba(TONE.rust, 0.75));
      rust.addColorStop(1, S.rgba(TONE.rust, 0));
      g.fillStyle = rust;
      g.beginPath();
      g.moveTo(352, 750);
      g.quadraticCurveTo(366, 790, 358, 848);
      g.lineTo(376, 840);
      g.quadraticCurveTo(380, 790, 384, 750);
      g.closePath();
      g.fill();
    }
    // The rolled rim, a fat rounded lip with a long highlight.
    paintShape(g, roundedRectPoints(290, 746, 480, 18, 9), {
      color: enamel,
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.35,
      strokes: 4,
      strokeAngle: 0,
      rim: 0.5,
      rimColor: P.bone,
      innerShadow: 0.2,
      wobble: 0.5,
      seed: 6082,
    });
    g.fillStyle = S.rgba(P.bone, clean ? 0.7 : 0.35);
    g.fillRect(306, 748, 448, 2);
    // Claw feet: a ball gripped by three toes, on a short leg.
    for (const fx of [350, 710]) paintClawFoot(g, fx, clean);
    paintTap(g, clean);
  }

  function paintClawFoot(g, x, clean) {
    const metal = clean ? TONE.brass : TONE.brassDirty;
    const opts = (seed) => ({
      color: metal,
      lightDir: { x: 0.4, y: -0.9 },
      light: 0.35,
      shadow: 0.5,
      strokes: 3,
      rim: 0.4,
      rimColor: clean ? P.bone : P.linen,
      wobble: 0.6,
      seed,
    });
    paintShape(g, [[x - 9, 860], [x + 9, 860], [x + 6, 878], [x - 6, 878]], opts(6090 + x));
    paintShape(g, ellipsePoints(x, 888, 12, 11, 16), opts(6091 + x));
    for (const tx of [-11, 0, 11]) {
      paintShape(g, [[x + tx - 4, 884], [x + tx + 4, 884], [x + tx + 6, 900], [x + tx - 4, 900]], opts(6092 + x + tx));
    }
    if (!clean) {
      // Verdigris in the hollows.
      g.fillStyle = S.rgba(S.mixHex(P.moss, P.sky, 0.3), 0.35);
      g.beginPath();
      g.arc(x - 5, 892, 4, 0, Math.PI * 2);
      g.fill();
    }
  }

  // An old pillar tap on the tub's end, its spout curling down to where
  // the drip forms.
  function paintTap(g, clean) {
    const metal = clean ? TONE.brass : TONE.brassDirty;
    paintShape(g, rectPoints(TUB.tapX - 6, 712, 12, 40), {
      color: metal,
      lightDir: { x: -0.7, y: -0.7 },
      light: 0.4,
      shadow: 0.5,
      strokes: 2,
      rim: 0.5,
      wobble: 0.3,
      seed: 6100,
    });
    g.strokeStyle = metal;
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(TUB.tapX, 716);
    g.quadraticCurveTo(SPOUT.x + 2, 708, SPOUT.x, SPOUT.y - 4);
    g.stroke();
    g.strokeStyle = S.rgba(P.bone, clean ? 0.6 : 0.25);
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(TUB.tapX, 713);
    g.quadraticCurveTo(SPOUT.x, 705, SPOUT.x - 2, SPOUT.y - 8);
    g.stroke();
    // Cross handle.
    paintShape(g, rectPoints(TUB.tapX - 13, 704, 26, 6), {
      color: metal,
      lightDir: { x: 0, y: -1 },
      light: 0.4,
      shadow: 0.4,
      strokes: 1,
      rim: 0.4,
      wobble: 0.2,
      seed: 6101,
    });
    g.fillStyle = clean ? P.bone : P.linen;
    g.beginPath();
    g.arc(TUB.tapX, 701, 4, 0, Math.PI * 2);
    g.fill();
    if (!clean) {
      g.fillStyle = S.rgba(S.mixHex(P.moss, P.sky, 0.3), 0.45);
      g.fillRect(TUB.tapX - 6, 740, 12, 10);
    }
  }

  function paintMirrorCabinet(g, clean) {
    const { x, y, w, h } = MIRROR;
    g.save();
    g.filter = 'blur(12px)';
    g.fillStyle = 'rgba(10,8,6,0.5)';
    g.fillRect(x + 10, y + 16, w, h);
    g.restore();
    paintShape(g, rectPoints(x, y, w, h), {
      color: clean ? TONE.cabinet : S.mixHex(TONE.cabinet, P.taupe, 0.45),
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.45,
      strokes: 10,
      strokeAngle: Math.PI / 2,
      rim: 0.35,
      rimColor: P.bone,
      innerShadow: 0.3,
      wobble: 0.6,
      seed: 6110,
    });
    // The bevelled glass edge, and dark behind the glass (drawn live).
    g.fillStyle = S.rgba(P.soot, 0.55);
    g.fillRect(GLASS.x - 6, GLASS.y - 6, GLASS.w + 12, GLASS.h + 12);
    g.fillStyle = S.rgba(P.bone, clean ? 0.35 : 0.15);
    g.fillRect(GLASS.x - 4, GLASS.y - 4, GLASS.w + 8, 2);
    g.fillRect(GLASS.x - 4, GLASS.y - 4, 2, GLASS.h + 8);
    if (!clean) {
      // Chipped enamel at the corners, rust showing through.
      const rng = S.createRng(6111);
      for (let i = 0; i < 12; i++) {
        const cx = rng.chance(0.5) ? x + rng.range(2, 14) : x + w - rng.range(2, 14);
        const cy = rng.chance(0.5) ? y + rng.range(2, 14) : y + h - rng.range(2, 14);
        g.fillStyle = S.rgba(TONE.rust, rng.range(0.4, 0.7));
        g.beginPath();
        g.ellipse(cx, cy, rng.range(2, 5), rng.range(1.5, 3.5), rng.range(0, 3), 0, Math.PI * 2);
        g.fill();
      }
    }
    // The strip light above it: a chrome bar holding a frosted tube.
    paintShape(g, roundedRectPoints(STRIP.x0, STRIP.y - 9, STRIP.x1 - STRIP.x0, 18, 8), {
      color: clean ? S.mixHex(P.gear, P.bone, 0.45) : S.mixHex(P.gear, P.taupe, 0.4),
      lightDir: { x: 0, y: -1 },
      light: 0.4,
      shadow: 0.45,
      strokes: 2,
      rim: 0.5,
      wobble: 0.3,
      seed: 6112,
    });
  }

  function paintSink(g, clean) {
    const china = clean ? TONE.porcelain : TONE.enamelDirty;
    const opts = (seed, light = 0.25) => ({
      color: china,
      lightDir: { x: -0.3, y: -0.95 },
      light,
      shadow: 0.42,
      strokes: 8,
      strokeAngle: 0,
      rim: 0.45,
      rimColor: P.bone,
      innerShadow: 0.3,
      wobble: 0.8,
      seed,
    });
    softShadow(g, 1140, 938, 70, 10, 0.55);
    // Pedestal: narrow at the waist, flaring to its foot.
    paintShape(g, [[1112, 808], [1168, 808], [1160, 860], [1172, 920], [1186, 935], [1094, 935], [1108, 920], [1120, 860]], opts(6120, 0.2));
    // Basin.
    paintShape(g, [[1036, 756], [1244, 756], [1232, 782], [1196, 806], [1140, 816], [1084, 806], [1048, 782]], opts(6121));
    paintShape(g, roundedRectPoints(1032, 750, 216, 14, 7), opts(6122, 0.35));
    g.fillStyle = S.rgba(P.bone, clean ? 0.65 : 0.3);
    g.fillRect(1046, 752, 188, 2);
    // Two cross-head taps on the back of the rim.
    for (const tx of [1094, 1186]) {
      paintShape(g, rectPoints(tx - 4, 730, 8, 20), {
        color: clean ? TONE.brass : TONE.brassDirty,
        lightDir: { x: -0.7, y: -0.7 },
        light: 0.4,
        shadow: 0.45,
        strokes: 1,
        rim: 0.4,
        wobble: 0.2,
        seed: 6123 + tx,
      });
      g.fillStyle = clean ? P.bone : P.linen;
      g.fillRect(tx - 10, 727, 20, 4);
    }
    if (!clean) {
      stain(g, 1140, 790, 28, P.oak, 6124, 0.3);
    }
  }

  // The previous cleaner's spray bottle: tipped over on the rim and
  // half-peeled when dirty, standing up when clean. It is empty either way.
  function paintSprayBottle(g, clean) {
    g.save();
    if (clean) g.translate(1062, 750);
    else {
      g.translate(1078, 746);
      g.rotate(-Math.PI / 2 + 0.08);
    }
    paintShape(g, roundedRectPoints(-10, -40, 20, 40, 5), {
      color: S.mixHex(P.bone, P.moon, 0.18),
      lightDir: { x: -0.6, y: -0.8 },
      light: 0.3,
      shadow: 0.35,
      strokes: 2,
      rim: 0.4,
      innerShadow: 0.15,
      wobble: 0.3,
      seed: 6130,
    });
    g.fillStyle = S.mixHex(P.gear, P.soot, 0.3);
    g.fillRect(-6, -52, 12, 12);
    g.fillRect(-12, -52, 8, 5);
    // The label: "SPIDER-AWAY", peeling off one corner when dirty.
    g.fillStyle = clean ? S.mixHex(P.rust, P.linen, 0.25) : S.mixHex(P.rust, P.taupe, 0.45);
    g.fillRect(-9, -30, 18, 16);
    if (!clean) {
      g.fillStyle = S.mixHex(P.linen, P.taupe, 0.3);
      g.beginPath();
      g.moveTo(9, -30);
      g.lineTo(14, -24);
      g.lineTo(9, -18);
      g.closePath();
      g.fill();
    }
    g.fillStyle = P.bone;
    g.font = '6px "Special Elite", monospace';
    g.textAlign = 'center';
    g.fillText('SPIDER', 0, -23);
    g.fillText('AWAY', 0, -17);
    g.restore();
  }

  function paintShelf(g, clean) {
    const wood = clean ? S.mixHex(P.oak, P.walnut, 0.3) : S.mixHex(P.walnut, P.umber, 0.35);
    softShadow(g, (SHELF.x0 + SHELF.x1) / 2 + 8, SHELF.y + 26, 120, 10, 0.4);
    for (const bx of [SHELF.x0 + 26, SHELF.x1 - 26]) {
      paintShape(g, [[bx - 4, SHELF.y + 12], [bx + 4, SHELF.y + 12], [bx + 4, SHELF.y + 52], [bx - 4, SHELF.y + 20]], {
        color: wood,
        lightDir: LIGHT_DIR,
        light: 0.2,
        shadow: 0.5,
        strokes: 2,
        rim: 0.2,
        wobble: 0.3,
        seed: 6140 + bx,
      });
    }
    paintShape(g, rectPoints(SHELF.x0, SHELF.y, SHELF.x1 - SHELF.x0, 14), {
      color: wood,
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.45,
      strokes: 6,
      strokeAngle: 0,
      rim: 0.35,
      wobble: 0.5,
      seed: 6141,
    });
    if (clean) {
      // Towels folded and stacked, a bar of soap beside them.
      const colours = [S.mixHex(P.rust, P.linen, 0.45), P.linen, S.mixHex(P.moss, P.linen, 0.5)];
      colours.forEach((c, i) => {
        const ty = SHELF.y - 14 - i * 14;
        paintShape(g, roundedRectPoints(1420 + i * 4, ty, 112 - i * 8, 14, 6), {
          color: c,
          lightDir: { x: -0.3, y: -0.95 },
          light: 0.25,
          shadow: 0.35,
          strokes: 10,
          strokeAngle: 0,
          rim: 0.25,
          wobble: 0.8,
          seed: 6142 + i,
        });
        g.fillStyle = S.rgba(P.soot, 0.15);
        g.fillRect(1430 + i * 4, ty + 9, 92 - i * 8, 1.5);
      });
      paintShape(g, roundedRectPoints(1548, SHELF.y - 9, 26, 9, 4), {
        color: S.mixHex(P.dawn, P.linen, 0.5),
        lightDir: { x: -0.3, y: -0.95 },
        light: 0.3,
        shadow: 0.3,
        strokes: 2,
        rim: 0.3,
        wobble: 0.2,
        seed: 6145,
      });
    }
  }

  function paintToilet(g, clean) {
    const iron = clean ? TONE.iron : S.mixHex(TONE.iron, P.soot, 0.35);
    const china = clean ? TONE.porcelain : TONE.enamelDirty;
    // The cistern, high on the wall on two brackets.
    for (const bx of [CISTERN.x0 + 16, CISTERN.x1 - 16]) {
      paintShape(g, [[bx - 3, CISTERN.y1], [bx + 3, CISTERN.y1], [bx + 3, CISTERN.y1 + 30], [bx - 3, CISTERN.y1 + 4]], {
        color: iron,
        lightDir: LIGHT_DIR,
        light: 0.2,
        shadow: 0.5,
        strokes: 1,
        rim: 0.2,
        wobble: 0.2,
        seed: 6150 + bx,
      });
    }
    paintShape(g, rectPoints(CISTERN.x0, CISTERN.y0, CISTERN.x1 - CISTERN.x0, CISTERN.y1 - CISTERN.y0), {
      color: iron,
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.5,
      strokes: 6,
      strokeAngle: 0,
      rim: 0.35,
      rimColor: P.linen,
      innerShadow: 0.35,
      wobble: 0.5,
      seed: 6151,
    });
    // Cast lettering panel.
    g.strokeStyle = S.rgba(P.linen, clean ? 0.3 : 0.15);
    g.lineWidth = 1.4;
    g.strokeRect(CISTERN.x0 + 14, CISTERN.y0 + 16, CISTERN.x1 - CISTERN.x0 - 28, 34);
    if (!clean) {
      const rust = g.createLinearGradient(0, CISTERN.y1 - 30, 0, CISTERN.y1 + 40);
      rust.addColorStop(0, S.rgba(TONE.rust, 0.6));
      rust.addColorStop(1, S.rgba(TONE.rust, 0));
      g.fillStyle = rust;
      g.fillRect(CISTERN.x0 + 40, CISTERN.y1 - 30, 18, 70);
    }
    // Flush pipe down to the bowl, and the pull chain with its handle.
    const pipeX = 1462;
    g.fillStyle = S.mixHex(iron, P.bone, clean ? 0.15 : 0.05);
    g.fillRect(pipeX - 5, CISTERN.y1, 10, BOWL.lidY - CISTERN.y1 - 4);
    g.fillStyle = S.rgba(P.bone, clean ? 0.3 : 0.12);
    g.fillRect(pipeX - 4, CISTERN.y1, 2, BOWL.lidY - CISTERN.y1 - 4);
    g.strokeStyle = clean ? S.mixHex(P.gear, P.bone, 0.4) : S.mixHex(P.gear, P.taupe, 0.3);
    g.lineWidth = 1.5;
    for (let y = 318; y < 560; y += 7) {
      g.beginPath();
      g.ellipse(1530, y, 1.8, 3.5, 0, 0, Math.PI * 2);
      g.stroke();
    }
    paintShape(g, ellipsePoints(1530, 574, 7, 13, 14), {
      color: china,
      lightDir: { x: -0.6, y: -0.8 },
      light: 0.35,
      shadow: 0.4,
      strokes: 1,
      rim: 0.4,
      wobble: 0.2,
      seed: 6152,
    });
    // The bowl on its pedestal, and the wooden seat and lid.
    softShadow(g, 1482, 938, 70, 10, 0.55);
    paintShape(g, [[1404, 828], [1556, 828], [1548, 858], [1520, 880], [1506, 935], [1454, 935], [1446, 880], [1414, 858]], {
      color: china,
      lightDir: { x: -0.3, y: -0.95 },
      light: 0.25,
      shadow: 0.45,
      strokes: 8,
      strokeAngle: 0,
      rim: 0.45,
      rimColor: P.bone,
      innerShadow: 0.3,
      wobble: 0.8,
      seed: 6153,
    });
    paintShape(g, roundedRectPoints(1398, BOWL.lidY - 8, 166, 16, 6), {
      color: clean ? S.mixHex(P.oak, P.walnut, 0.25) : S.mixHex(P.walnut, P.umber, 0.3),
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.45,
      strokes: 6,
      strokeAngle: 0,
      rim: 0.35,
      wobble: 0.4,
      seed: 6154,
    });
  }

  // When dirty, the towel lies where it was dropped, a grey heap.
  function paintFloorTowel(g) {
    softShadow(g, 1296, 936, 66, 10, 0.5);
    paintShape(g, [[1240, 935], [1250, 912], [1276, 900], [1300, 906], [1322, 896], [1346, 912], [1352, 935]], {
      color: S.mixHex(S.mixHex(P.rust, P.linen, 0.45), P.taupe, 0.45),
      lightDir: { x: 0.3, y: -0.95 },
      light: 0.2,
      shadow: 0.45,
      strokes: 14,
      strokeAngle: 0.5,
      strokeJitter: 0.8,
      rim: 0.2,
      innerShadow: 0.3,
      wobble: 2,
      seed: 6160,
    });
    g.strokeStyle = S.rgba(P.soot, 0.3);
    g.lineWidth = 1.4;
    for (const [x0, y0, x1, y1] of [[1262, 930, 1286, 910], [1300, 930, 1318, 906], [1330, 932, 1340, 914]]) {
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2 + 6, (y0 + y1) / 2, x1, y1);
      g.stroke();
    }
  }

  // ── Front layer: out of focus, and the walls closing in ───────────────

  function paintFront(g, clean) {
    g.save();
    g.filter = 'blur(7px)';
    // The open door's edge on the left, and a wicker laundry basket right.
    paintShape(g, [[-20, 0], [60, 0], [70, 1080], [-20, 1080]], {
      color: S.mixHex(P.walnut, P.soot, 0.4),
      light: 0.1,
      shadow: 0.4,
      strokes: 4,
      strokeAngle: Math.PI / 2,
      rim: 0.2,
      wobble: 0,
      seed: 6170,
    });
    paintShape(g, [[1760, 1080], [1776, 930], [1900, 920], [1930, 1080]], {
      color: S.mixHex(P.oak, P.walnut, 0.5),
      light: 0.15,
      shadow: 0.4,
      strokes: 16,
      strokeAngle: 0.4,
      rim: 0.2,
      wobble: 2,
      seed: 6171,
    });
    g.restore();
    // A tighter vignette than other rooms: the walls close in.
    const v = g.createRadialGradient(960, 600, 380, 960, 560, 1150);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, S.rgba(P.soot, clean ? 0.28 : 0.4));
    g.fillStyle = v;
    g.fillRect(-40, -40, 2000, 1160);
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
      noise: S.createNoise(seed + 60),
      rng: S.createRng(seed + 61),
      // room.js replaces this on start; it is here so drawing never fails.
      bulb: { theta: 0, omega: 0, isBlackout: false, cordLen: 240, x: ROSE.x, y: 240 },
      dripTimer: 0,
      mirror: null,
    };
  }

  // The window is frosted and painted opaque: nothing to see beyond it.
  function drawSky() {}

  const bulbOf = (live) => live?.bulb || { x: ROSE.x, y: 240, isBlackout: false };
  const bulbLit = (live) => !bulbOf(live).isBlackout;

  function drawProps(ctx, live, t, mk) {
    drawPuddles(ctx, live, t, mk);
    drawBulb(ctx, live, t, mk);
    drawDrip(ctx, live, mk);
  }

  // Puddles: dark glossy water with a bright meniscus, reflecting the bulb
  // as a soft vertical streak that follows its swing. They dry as the
  // makeover's sweep passes over them.
  function drawPuddles(ctx, live, t, mk) {
    const bulb = bulbOf(live);
    for (const pd of PUDDLES) {
      const cx = (pd.x0 + pd.x1) / 2;
      const dry = mk.wipe >= 1 ? 1 : S.clamp((mk.sweepX - cx) / 220, 0, 1);
      if (dry >= 1) continue;
      const k = 1 - dry;
      const rx = (pd.x1 - pd.x0) / 2;
      const cy = GROUND + 10;
      const ry = 11;
      ctx.save();
      ctx.globalAlpha = k;
      const water = ctx.createRadialGradient(cx, cy - 2, 2, cx, cy, rx);
      water.addColorStop(0, S.rgba(S.mixHex(P.soot, P.moon, 0.25), 0.85));
      water.addColorStop(0.8, S.rgba(S.mixHex(P.soot, P.umber, 0.3), 0.75));
      water.addColorStop(1, S.rgba(P.soot, 0));
      ctx.fillStyle = water;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = S.rgba(P.bone, 0.25);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 1, rx * 0.94, ry * 0.8, 0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      // The bulb's reflection: mirrored about the floor, it lands below the
      // bulb's x, shifted toward the viewer's eye line.
      if (bulbLit(live)) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.clip();
        const sx = cx + (bulb.x - ROSE.x) * 0.5 + (ROSE.x - cx) * 0.12;
        const streak = ctx.createLinearGradient(sx - 6, 0, sx + 6, 0);
        streak.addColorStop(0, S.rgba(P.dawn, 0));
        streak.addColorStop(0.5, S.rgba(S.mixHex(P.dawn, P.bone, 0.5), 0.8));
        streak.addColorStop(1, S.rgba(P.dawn, 0));
        ctx.fillStyle = streak;
        ctx.fillRect(sx - 6, cy - ry, 12, ry * 2);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // The bare bulb on its cord: a bakelite holder, a pear of glass with a
  // glowing filament; dark grey when it blacks out. With the makeover's
  // `bulb` beat a frosted glass shade appears round it.
  function drawBulb(ctx, live, t, mk) {
    const bulb = bulbOf(live);
    const bx = bulb.x;
    const by = bulb.y;
    const angle = Math.atan2(bx - ROSE.x, by - ROSE.y);
    ctx.save();
    ctx.strokeStyle = S.mixHex(P.soot, P.umber, 0.4);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(ROSE.x, ROSE.y + 8);
    ctx.lineTo(bx, by - 14);
    ctx.stroke();
    ctx.translate(bx, by);
    ctx.rotate(-angle);
    ctx.fillStyle = S.mixHex(P.soot, P.walnut, 0.4);
    ctx.fillRect(-6, -16, 12, 14);
    ctx.fillStyle = S.mixHex(P.brass, P.umber, 0.3);
    ctx.fillRect(-5, -3, 10, 4);
    const lit = bulbLit(live);
    const glass = ctx.createRadialGradient(-3, 6, 1, 0, 9, 13);
    glass.addColorStop(0, lit ? P.bone : S.mixHex(P.taupe, P.linen, 0.3));
    glass.addColorStop(1, lit ? S.rgba(P.dawn, 0.85) : S.rgba(P.taupe, 0.7));
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(-5, 1);
    ctx.bezierCurveTo(-13, 6, -12, 22, 0, 23);
    ctx.bezierCurveTo(12, 22, 13, 6, 5, 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = lit ? S.rgba(P.bone, 0.95) : S.rgba(P.ember, 0.4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-3, 6);
    ctx.lineTo(-2, 14);
    ctx.lineTo(2, 14);
    ctx.lineTo(3, 6);
    ctx.stroke();
    const shade = S.clamp(mk.bulb ?? 0, 0, 1);
    if (shade > 0) {
      ctx.globalAlpha = shade;
      const sg = ctx.createLinearGradient(0, -12, 0, 32);
      sg.addColorStop(0, S.rgba(P.bone, 0.85));
      sg.addColorStop(1, S.rgba(S.mixHex(P.bone, P.dawn, 0.4), 0.65));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(-10, -12);
      ctx.lineTo(10, -12);
      ctx.bezierCurveTo(26, 0, 34, 20, 36, 30);
      ctx.lineTo(-36, 30);
      ctx.bezierCurveTo(-34, 20, -26, 0, -10, -12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = S.rgba(P.linen, 0.8);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  // The tub tap's next drop, swelling until room.js lets it fall.
  function drawDrip(ctx, live, mk) {
    if ((mk.tap ?? 0) > 0 || mk.t >= 4) return;
    const k = S.clamp((live?.dripTimer ?? 0) / 1.2, 0, 1);
    const r = 1.2 + k * 2.6;
    ctx.save();
    const d = ctx.createRadialGradient(SPOUT.x - 1, SPOUT.y + r * 0.6, 0.5, SPOUT.x, SPOUT.y + r, r * 1.4);
    d.addColorStop(0, S.rgba(P.bone, 0.9));
    d.addColorStop(1, S.rgba(S.mixHex(P.moon, P.silk, 0.5), 0.5));
    ctx.fillStyle = d;
    ctx.beginPath();
    ctx.ellipse(SPOUT.x, SPOUT.y + r, r * 0.8, r * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /*
   * The mirror (story object). Three cached pieces: the reflection, the
   * fog with the finger-traced letters wiped out of it, and the letters as
   * they stay on the glass once it is clear. Per frame the fog is cut back
   * from the centre outward as the makeover's `mirror` beat runs.
   */
  function mirrorParts(live) {
    if (live.mirror) return live.mirror;
    const { w, h } = GLASS;
    const reflection = S.makeCanvas(w, h);
    const r = reflection.getContext('2d');
    const bg = r.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, S.mixHex(P.umber, P.moon, 0.25));
    bg.addColorStop(1, S.mixHex(P.soot, P.taupe, 0.3));
    r.fillStyle = bg;
    r.fillRect(0, 0, w, h);
    // The room behind you, reversed and dim: tiles, a doorway, the bulb.
    r.strokeStyle = S.rgba(P.linen, 0.12);
    r.lineWidth = 1;
    for (let y = h * 0.45; y < h; y += 12) {
      r.beginPath();
      r.moveTo(0, y);
      r.lineTo(w, y);
      r.stroke();
    }
    r.fillStyle = S.rgba(P.soot, 0.55);
    r.fillRect(w * 0.62, h * 0.18, w * 0.26, h * 0.82);
    const blob = r.createRadialGradient(w * 0.22, h * 0.14, 2, w * 0.22, h * 0.14, 46);
    blob.addColorStop(0, S.rgba(P.dawn, 0.55));
    blob.addColorStop(1, S.rgba(P.dawn, 0));
    r.fillStyle = blob;
    r.fillRect(0, 0, w, h);
    // A long diagonal sheen across the glass.
    r.fillStyle = S.rgba(P.bone, 0.08);
    r.beginPath();
    r.moveTo(w * 0.1, 0);
    r.lineTo(w * 0.32, 0);
    r.lineTo(w * 0.02, h);
    r.lineTo(0, h);
    r.closePath();
    r.fill();

    const letters = (g, color, width) => {
      g.save();
      g.strokeStyle = color;
      g.lineWidth = width;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.font = '700 34px Caveat, "Segoe Print", cursive';
      g.textAlign = 'center';
      const rng = S.createRng(6180);
      const lines = [['THOMAS', 64], ['WAS HERE', 104]];
      for (const [text, y] of lines) {
        // A child's hand: each letter a little off its line and tilted.
        const widths = [...text].map((ch) => g.measureText(ch).width);
        const total = widths.reduce((a, b) => a + b, 0);
        let x = w / 2 - total / 2;
        [...text].forEach((ch, i) => {
          g.save();
          g.translate(x + widths[i] / 2, y + rng.range(-3, 3));
          g.rotate(rng.range(-0.12, 0.12) - 0.04);
          g.strokeText(ch, 0, 0);
          g.restore();
          x += widths[i];
        });
      }
      // The smiley.
      g.beginPath();
      g.arc(w / 2, 148, 15, 0, Math.PI * 2);
      g.moveTo(w / 2 - 8, 152);
      g.quadraticCurveTo(w / 2, 160, w / 2 + 8, 152);
      g.moveTo(w / 2 - 5, 143);
      g.arc(w / 2 - 6, 143, 1, 0, Math.PI * 2);
      g.moveTo(w / 2 + 7, 143);
      g.arc(w / 2 + 6, 143, 1, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    };

    const fog = S.makeCanvas(w, h);
    const f = fog.getContext('2d');
    const veil = f.createLinearGradient(0, 0, 0, h);
    veil.addColorStop(0, S.rgba(S.mixHex(P.linen, P.bone, 0.5), 0.9));
    veil.addColorStop(1, S.rgba(S.mixHex(P.linen, P.taupe, 0.3), 0.92));
    f.fillStyle = veil;
    f.fillRect(0, 0, w, h);
    const rng = S.createRng(6181);
    for (let i = 0; i < 260; i++) {
      // Condensation: droplets with a dark edge and a bright point.
      const x = rng.range(0, w);
      const y = rng.range(0, h);
      const rr = rng.range(0.8, 3.2);
      f.fillStyle = S.rgba(P.taupe, 0.35);
      f.beginPath();
      f.arc(x, y, rr, 0, Math.PI * 2);
      f.fill();
      f.fillStyle = S.rgba(P.bone, 0.7);
      f.beginPath();
      f.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.35, 0, Math.PI * 2);
      f.fill();
    }
    for (let i = 0; i < 9; i++) {
      // Runs where drops slid down.
      const x = rng.range(6, w - 6);
      f.fillStyle = S.rgba(P.taupe, 0.25);
      f.fillRect(x, rng.range(h * 0.3, h * 0.7), 1.6, rng.range(30, 80));
    }
    // The finger-traced letters, wiped out of the fog long ago and fogged
    // over again since. Only broken streaks survive, faint enough that no
    // word can be read: the reveal belongs to the makeover. The strokes are
    // cut down to a few short smears, and those are taken only faintly out
    // of the fog.
    const wipe = S.makeCanvas(w, h);
    const wg = wipe.getContext('2d');
    letters(wg, 'rgba(0,0,0,1)', 3.5);
    const mask = S.makeCanvas(w, h);
    const mg = mask.getContext('2d');
    const mrng = S.createRng(6182);
    // Short smears along the line of a stroke: what is left of a finger
    // track once the steam has settled back over most of it.
    mg.fillStyle = 'rgba(0,0,0,1)';
    for (let i = 0; i < 22; i++) {
      mg.beginPath();
      mg.ellipse(mrng.range(w * 0.12, w * 0.88), mrng.range(48, 160), mrng.range(5, 12), mrng.range(2, 4), mrng.range(-0.4, 0.4), 0, Math.PI * 2);
      mg.fill();
    }
    wg.globalCompositeOperation = 'destination-in';
    wg.drawImage(mask, 0, 0);
    f.save();
    f.globalCompositeOperation = 'destination-out';
    f.globalAlpha = 0.12;
    f.drawImage(wipe, 0, 0);
    f.restore();
    // Water gathers on the edge of a wiped streak and runs down from it, so
    // the runs start on what survives of the strokes.
    const px = wg.getImageData(0, 0, w, h).data;
    const starts = [];
    for (let tries = 0; tries < 400 && starts.length < 8; tries++) {
      const x = Math.floor(mrng.range(0, w));
      const y = Math.floor(mrng.range(40, 170));
      if (px[(y * w + x) * 4 + 3] > 128) starts.push([x, y]);
    }
    for (const [x, y] of starts) {
      const len = mrng.range(16, 44);
      f.fillStyle = S.rgba(P.soot, 0.16);
      f.fillRect(x - 0.6, y + 2, 1.3, len);
      f.fillStyle = S.rgba(P.bone, 0.55);
      f.fillRect(x - 0.2, y + 2, 0.5, len);
      f.fillStyle = S.rgba(P.bone, 0.8);
      f.beginPath();
      f.arc(x, y + len + 2, 1.9, 0, Math.PI * 2);
      f.fill();
    }

    const trace = S.makeCanvas(w, h);
    letters(trace.getContext('2d'), S.rgba(P.bone, 0.5), 3);

    const scratch = S.makeCanvas(w, h);
    live.mirror = { reflection, fog, trace, scratch };
    return live.mirror;
  }

  function drawMirror(ctx, live, mk) {
    const parts = mirrorParts(live);
    const { x, y, w, h } = GLASS;
    const clear = S.clamp(mk.mirror ?? 0, 0, 1);
    ctx.drawImage(parts.reflection, x, y);
    if (clear < 1) {
      const sg = parts.scratch.getContext('2d');
      sg.clearRect(0, 0, w, h);
      sg.drawImage(parts.fog, 0, 0);
      if (clear > 0) {
        // The fog clears from the centre outward, with a soft edge.
        // Square root: the first breath of warm air clears the most glass,
        // so the mirror reads as clearing as soon as the beat starts.
        const reach = Math.hypot(w, h) * 0.55;
        const r = Math.sqrt(clear) * (reach + 40);
        const hole = sg.createRadialGradient(w / 2, h / 2, Math.max(0, r - 40), w / 2, h / 2, Math.max(1, r));
        hole.addColorStop(0, 'rgba(0,0,0,1)');
        hole.addColorStop(1, 'rgba(0,0,0,0)');
        sg.globalCompositeOperation = 'destination-out';
        sg.fillStyle = hole;
        sg.fillRect(0, 0, w, h);
        sg.fillStyle = 'rgba(0,0,0,1)';
        sg.beginPath();
        sg.arc(w / 2, h / 2, Math.max(0, r - 40), 0, Math.PI * 2);
        sg.fill();
        sg.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(parts.scratch, x, y);
    }
    if (clear > 0) {
      // Once the glass clears, the letters are still there: greasy traces.
      ctx.save();
      ctx.globalAlpha = clear;
      ctx.drawImage(parts.trace, x, y);
      ctx.restore();
    }
  }

  function drawOnFurniture(ctx, live, t, mk) {
    drawMirror(ctx, live, mk);
    // The strip light's tube, dark until the mirror clears.
    const on = S.clamp(mk.mirror ?? 0, 0, 1);
    ctx.fillStyle = on > 0.05 ? S.rgba(S.mixHex(P.dawn, P.bone, 0.6), 0.5 + on * 0.5) : S.rgba(P.taupe, 0.8);
    ctx.fillRect(STRIP.x0 + 10, STRIP.y - 3, STRIP.x1 - STRIP.x0 - 20, 6);
  }

  // ── Light ─────────────────────────────────────────────────────────────

  function lights(lm, live, t, mk) {
    const bulb = bulbOf(live);
    const shade = S.clamp(mk.bulb ?? 0, 0, 1);
    const warm = S.mixHex(P.dawn, P.bone, 0.45);
    if (bulbLit(live)) {
      // Harsh and close: a strong point, a hard cone straight down, a small
      // bright pool on the floor right under it. The shade softens and
      // widens all three.
      lm.point(bulb.x, bulb.y + 8, S.lerp(640, 820, shade), warm, S.lerp(1.0, 0.85, shade));
      lm.cone(bulb.x, bulb.y + 8, Math.PI / 2 - (bulb.x - ROSE.x) * 0.002, S.lerp(1.15, 1.7, shade), 760, warm, S.lerp(0.75, 0.55, shade));
      lm.point(bulb.x + (bulb.x - ROSE.x) * 2.5, GROUND, S.lerp(230, 340, shade), warm, S.lerp(0.55, 0.4, shade));
    }
    // The frosted window: a broad soft cold spill, warming at dawn.
    const win = S.mixHex(P.moon, P.dawn, mk.window);
    lm.point(WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h / 2, 460, win, S.lerp(0.55, 0.8, mk.window));
    lm.shaft(windowShaft(), win, S.lerp(0.45, 0.7, mk.window));
    // The strip light over the mirror, off until the mirror clears.
    const strip = S.clamp(mk.mirror ?? 0, 0, 1);
    if (strip > 0.01) {
      lm.point(1140, STRIP.y + 6, 380, P.amber, 0.7 * strip);
      lm.cone(1140, STRIP.y + 8, Math.PI / 2, 1.4, 520, P.amber, 0.45 * strip);
    }
    return bulbLit(live) ? 1 : 0;
  }

  // A soft, short beam from the frosted window down over the tub.
  function windowShaft() {
    const { x, y, w, h } = WINDOW;
    return [[x + 10, y + h - 10], [x + w - 10, y + h - 10], [x + w + 140, 760], [x - 40, 760]];
  }

  function glow(ctx, lm, live, t, mk, flick) {
    const bulb = bulbOf(live);
    const shade = S.clamp(mk.bulb ?? 0, 0, 1);
    if (bulbLit(live)) {
      S.light.glow(ctx, bulb.x, bulb.y + 9, S.lerp(70, 110, shade), S.mixHex(P.dawn, P.bone, 0.5), S.lerp(0.95, 0.7, shade));
      S.light.glow(ctx, bulb.x, bulb.y + 9, 22, P.bone, S.lerp(0.9, 0.5, shade));
    } else {
      // The filament cools for a moment in the dark.
      S.light.glow(ctx, bulb.x, bulb.y + 12, 14, P.ember, 0.35);
    }
    const winHex = mk.window > 0.5 ? P.dawn : P.moon;
    S.light.glow(ctx, WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h / 2, 150, winHex, S.lerp(0.28, 0.36, mk.window));
    S.light.beam(ctx, windowShaft(), winHex, S.lerp(0.14, 0.22, mk.window));
    const strip = S.clamp(mk.mirror ?? 0, 0, 1);
    if (strip > 0.01) S.light.glow(ctx, 1140, STRIP.y, 90, P.amber, 0.55 * strip);
    void lm;
    void flick;
  }

  // The makeover beats only set values; drawing reads them.
  function beat(name, mk, t) {
    if (name === 'mirror') mk.mirrorDemist = S.clamp((t - 3.3) / 2.0, 0, 1);
  }

  S.rooms.attachArt('downstairs-bathroom', {
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
