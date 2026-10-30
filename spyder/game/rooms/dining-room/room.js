/*
 * Spyder — Room 5: the Dining Room.
 *
 * The formal dining room, laid for a dinner that never happened: six places
 * set, candles never lit, a long table under a dusty cloth, and an egg nest
 * pulsating under the table.
 *
 * Interfaces and contracts follow ART-DIRECTION.md, DESIGN.md, and the
 * runtime in lib/room-runtime.js.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const {
    paintShape,
    wobblyPath,
    rectPoints,
    roundedRectPoints,
    ellipsePoints,
    softShadow,
    stain,
  } = S.paint;

  // ── Layout (stage units, 1920 × 1080) ─────────────────────────────────

  const CEILING = 100; // underside of the cornice; spiders drop from here
  const WALLPAPER_BOTTOM = 575; // plate rail sits here
  const WAINSCOT_TOP = 585; // wainscot panels begin
  const FLOOR_LINE = 770; // where the lower wall meets the parquet
  const GROUND = 935; // where the hero walks

  const WINDOW = { x: 140, y: 160, w: 260, h: 380 };
  const SIDEBOARD = { x0: 110, x1: 430, top: 745, floor: 935 };
  const TABLE = { x0: 560, x1: 1420, top: 760, hem: 880, floor: 935 };
  const PLATE_RAIL = { x0: 620, x1: 1360, y: 575 };
  const CABINET = { x0: 1560, x1: 1800, top: 320, floor: 850, ledgeY: 600 };
  const CHANDELIER = { x: 980, yTop: 100, yBottom: 310 };

  const CANDLESTICKS = [640, 810, 980, 1150, 1320];
  const PLATES = [660, 770, 880, 990, 1100, 1210, 1320];
  const PLACES = [630, 765, 900, 1060, 1195, 1330];
  const PLACE_CARDS = [
    { x: 630, y: 775, name: 'Arthur' },
    { x: 765, y: 775, name: 'Eleanor' },
    { x: 900, y: 775, name: 'Thomas' },
    { x: 1060, y: 775, name: 'A.', chairUntouched: true },
    { x: 1195, y: 775, name: 'Beatrice' },
    { x: 1330, y: 775, name: 'Julian' },
  ];

  const NEST_SPOTS = [
    { x: 865, y: 892, hatchAt: 14, seed: 101 },
    { x: 925, y: 912, hatchAt: 22, seed: 202 },
    { x: 1025, y: 896, hatchAt: 30, seed: 303 },
    { x: 1085, y: 916, hatchAt: 38, seed: 404 },
  ];

  const layout = {
    name: 'Dining Room',
    act: 1,
    number: 5,
    CEILING,
    FLOOR_LINE,
    GROUND,
    heroStart: 480,
    bounds: { left: 90, right: 1830 },
    platforms: [
      { name: 'floor', x0: 0, x1: 1920, y: GROUND, oneWay: false },
      { name: 'sideboard', x0: 120, x1: 420, y: SIDEBOARD.top, oneWay: true },
      { name: 'table', x0: 570, x1: 1420, y: TABLE.top, oneWay: true },
      { name: 'plate-rail', x0: 640, x1: 1340, y: PLATE_RAIL.y, oneWay: true },
      { name: 'cabinet-ledge', x0: 1570, x1: 1790, y: CABINET.ledgeY, oneWay: true },
    ],
    dropPoints: [230, 420, 640, 810, 980, 1150, 1320, 1490, 1680],
    hoverBand: [360, 620],
    wallArea: { x0: 90, x1: 1830, y0: CEILING + 20, y1: 720 },
    lairs: [
      { x: 1680, y: 350, label: 'behind the china cabinet' },
      { x: 270, y: 760, label: 'under the sideboard' },
      { x: 160, y: 280, label: 'behind the drapes' },
      { x: 980, y: 540, label: 'crack above the plate rail' },
    ],
    jumperLairs: [
      {
        label: 'behind the tea set',
        surface: 'sideboard',
        from: { x: 340, y: SIDEBOARD.top },
        to: { x: 260, y: SIDEBOARD.top },
        moves: 'walk',
        heading: Math.PI,
        time: 1.0,
      },
      {
        label: 'from behind the centrepiece',
        surface: 'table',
        from: { x: 980, y: TABLE.top },
        to: { x: 910, y: TABLE.top },
        moves: 'walk',
        heading: Math.PI,
        time: 1.0,
      },
      {
        label: 'from between the dining chairs',
        surface: 'table',
        from: { x: 1240, y: TABLE.top },
        to: { x: 1150, y: TABLE.top },
        moves: 'walk',
        heading: Math.PI,
        time: 1.0,
      },
      {
        label: 'from behind decorative plates',
        surface: 'plate-rail',
        from: { x: 880, y: PLATE_RAIL.y },
        to: { x: 940, y: PLATE_RAIL.y },
        moves: 'walk',
        heading: 0,
        time: 1.0,
      },
      {
        label: 'under the sideboard',
        surface: 'floor',
        from: { x: 240, y: 880 },
        to: { x: 240, y: GROUND },
        moves: 'depth',
        heading: Math.PI / 2,
        time: 1.0,
        fade: true,
      },
    ],
    window: WINDOW,
    lookout: { x: WINDOW.x + WINDOW.w / 2, y: WINDOW.y + 120 },
    breakables: [{ x: 1470, y: GROUND, contains: 'coins' }],
  };

  // ── Palette mixing ────────────────────────────────────────────────────

  const TONE = {
    damaskDirty: S.mixHex(P.moss, P.taupe, 0.52),
    // ART: blockout - Clean wall
    damaskClean: S.mixHex(S.mixHex(P.moss, P.linen, 0.5), P.sky, 0.15),
    damaskPattern: S.mixHex(P.moss, P.umber, 0.42),
    wainscotBase: S.mixHex(P.taupe, P.linen, 0.38),
    wainscotLit: S.mixHex(P.linen, P.bone, 0.48),
    wainscotShadow: S.mixHex(P.walnut, P.taupe, 0.55),
    woodDark: S.mixHex(P.walnut, P.umber, 0.48),
    woodWarm: S.mixHex(P.walnut, P.oak, 0.62),
    woodLit: S.mixHex(P.oak, P.linen, 0.32),
    silverDirty: '#6e6762',
    silverClean: '#eae6e4',
    clothDirty: '#706860',
    clothClean: '#f4ede2',
    drapeDirty: '#3e2a34',
    drapeClean: '#5e374d',
    parquetDark: '#3d2e23',
    parquetLight: '#684d37',
  };

  const LIGHT_FROM_WINDOW = { x: 0.65, y: 0.76 };

  // ── Live state ────────────────────────────────────────────────────────

  let livePlates = PLATES.map((x) => ({ x, wobble: 0, wobbleV: 0 }));
  let noteState = { el: null, torn: false, timer: null };
  let nestEggs = [];

  function createLive(seed) {
    const rng = S.createRng(seed);
    const noise = S.createNoise(seed + 19);
    const stars = [];
    for (let i = 0; i < 18; i++) {
      stars.push({
        x: rng.range(0.08, 0.92),
        y: rng.range(0.08, 0.75),
        s: rng.range(0.8, 1.8),
        p: rng.range(0, Math.PI * 2),
      });
    }
    return {
      rng,
      noise,
      stars,
      flickerOffset: rng.range(0, 100),
    };
  }

  // ── Painting cached layers (dirty & clean) ────────────────────────────

  function paint(variant) {
    const clean = variant === 'clean';
    const W = S.STAGE.width;
    const H = S.STAGE.height;

    const back = S.makeCanvas(W, H);
    const furniture = S.makeCanvas(W, H);
    const front = S.makeCanvas(W, H);

    paintBack(back.getContext('2d'), clean);
    paintFurniture(furniture.getContext('2d'), clean);
    paintFront(front.getContext('2d'), clean);

    return { back, furniture, front };
  }

  // 1. Back Layer: Wall, ceiling rose, wainscot, parquet floor, china cabinet body
  function paintBack(g, clean) {
    const wallColor = clean ? TONE.damaskClean : TONE.damaskDirty;

    // Plaster ceiling band (0–100)
    paintShape(g, rectPoints(0, 0, 1920, CEILING + 2), {
      color: clean ? '#52483d' : P.umber,
      lightDir: { x: 0, y: 1 },
      light: 0.18,
      shadow: 0.42,
      strokes: 9,
      strokeAngle: 0,
    });

    // Cornice moulding steps
    const corniceSteps = [
      { y: 35, h: 14, col: clean ? '#635648' : '#261f1a' },
      { y: 55, h: 18, col: clean ? '#756857' : '#302620' },
      { y: 80, h: 20, col: clean ? '#877864' : '#3a2e26' },
    ];
    for (const st of corniceSteps) {
      paintShape(g, rectPoints(0, st.y, 1920, st.h), {
        color: st.col,
        lightDir: { x: 0, y: 1 },
        light: 0.22,
        shadow: 0.38,
        strokes: 8,
        strokeAngle: 0,
      });
    }

    // Ceiling rose medallion above the chandelier (x 980, y 100)
    paintCeilingRose(g, 980, 100, clean);

    // Upper wall with damask wallpaper (y 100–575)
    paintShape(g, rectPoints(0, CEILING, 1920, WALLPAPER_BOTTOM - CEILING + 2), {
      color: wallColor,
      lightDir: LIGHT_FROM_WINDOW,
      light: clean ? 0.25 : 0.16,
      shadow: 0.34,
      strokes: 16,
      strokeAngle: Math.PI / 2,
    });
    paintDamaskPattern(g, clean);
    paintWallDetails(g, clean);

    // Plate rail wooden ledge (x 620–1360, y 575)
    paintPlateRailShelf(g, clean);

    // Wainscot panels (y 585–770)
    paintWainscoting(g, clean);

    // Herringbone parquet floor (y 770–1080)
    paintParquetFloor(g, clean);

    // Tall window frame & casing (x 140–400, y 160–540)
    paintWindowFrame(g, clean);

    // Contact shadows on the back wall behind furniture
    softShadow(g, 270, 750, 180, 18, 0.48); // behind sideboard
    softShadow(g, 1680, 850, 140, 24, 0.55); // behind china cabinet
  }

  function paintCeilingRose(g, cx, cy, clean) {
    g.save();
    const baseCol = clean ? '#786b5b' : '#322922';
    const rimCol = clean ? '#a89885' : '#4e4136';

    // Outer relief ring with scalloped border
    paintShape(g, ellipsePoints(cx, cy, 145, 38, 28), {
      color: baseCol,
      lightDir: { x: 0, y: 1 },
      light: 0.24,
      shadow: 0.45,
    });
    // Middle petal ring
    paintShape(g, ellipsePoints(cx, cy, 100, 26, 22), {
      color: rimCol,
      lightDir: { x: 0, y: 1 },
      light: 0.3,
      shadow: 0.4,
    });
    // Center boss
    paintShape(g, ellipsePoints(cx, cy, 44, 14, 16), {
      color: clean ? '#54463a' : '#221b16',
      lightDir: { x: 0, y: 1 },
      light: 0.22,
      shadow: 0.55,
    });
    g.restore();
  }

  function paintDamaskPattern(g, clean) {
    // Damask reads as woven, not printed: the motif is drawn twice, a dark
    // pass and a lighter one nudged up-left toward the window, so it looks
    // slightly raised. Low contrast either way (ART-DIRECTION §4).
    const wall = clean ? TONE.damaskClean : TONE.damaskDirty;
    const passes = [
      { color: S.shadeHex(wall, -0.32), dx: 0, dy: 0, alpha: clean ? 0.3 : 0.24 },
      { color: S.shadeHex(wall, 0.2), dx: -1.5, dy: -1.5, alpha: clean ? 0.22 : 0.14 },
    ];
    const stepX = 110;
    const stepY = 120;
    for (const pass of passes) {
      g.save();
      g.globalAlpha = pass.alpha;
      g.strokeStyle = pass.color;
      g.fillStyle = pass.color;
      g.lineWidth = 1.6;
      for (let x = 40; x < 1900; x += stepX) {
        for (let y = CEILING + 20; y < WALLPAPER_BOTTOM - 20; y += stepY) {
          const ox = ((y / stepY) | 0) % 2 === 0 ? 0 : stepX * 0.5;
          const px = x + ox + pass.dx;
          const py = y + pass.dy;
          if (px > 1900) continue;
          // Classical acanthus cartouche, with curling leaves either side.
          g.beginPath();
          g.moveTo(px, py - 26);
          g.bezierCurveTo(px + 22, py - 18, px + 28, py - 4, px + 16, py + 14);
          g.bezierCurveTo(px + 22, py + 24, px + 6, py + 32, px, py + 24);
          g.bezierCurveTo(px - 6, py + 32, px - 22, py + 24, px - 16, py + 14);
          g.bezierCurveTo(px - 28, py - 4, px - 22, py - 18, px, py - 26);
          g.stroke();
          for (const side of [-1, 1]) {
            g.beginPath();
            g.moveTo(px + side * 20, py + 8);
            g.quadraticCurveTo(px + side * 40, py - 6, px + side * 34, py - 22);
            g.stroke();
          }
          g.beginPath();
          g.ellipse(px, py + 2, 7, 12, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
    }
  }

  // Two oval family portraits and a needlework sampler on the wall between
  // the window and the cabinet, which was an empty field before. Dirty: the
  // left portrait hangs crooked and everything is filmed with dust.
  function paintWallDetails(g, clean) {
    const portraits = [
      { x: 700, y: 330, rx: 54, ry: 70, tilt: clean ? 0 : -0.1, who: 'man', seed: 811 },
      { x: 1262, y: 330, rx: 54, ry: 70, tilt: 0, who: 'woman', seed: 812 },
    ];
    for (const f of portraits) {
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.tilt);
      // Drop shadow, away from the window (painted once, so blur is allowed).
      g.save();
      g.filter = 'blur(10px)';
      g.fillStyle = 'rgba(10,8,6,0.45)';
      g.beginPath();
      g.ellipse(10, 14, f.rx + 12, f.ry + 12, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      // Gilt frame, lit from the window side.
      paintShape(g, ellipsePoints(0, 0, f.rx + 12, f.ry + 12, 36), {
        color: clean ? P.brass : S.mixHex(P.brass, P.umber, 0.55),
        lightDir: { x: -0.6, y: -0.8 },
        light: 0.35,
        shadow: 0.45,
        strokes: 12,
        rim: 0.4,
        rimColor: clean ? P.dawn : P.moon,
        seed: f.seed,
      });
      // The canvas: dark varnish, a figure lit from the left.
      paintShape(g, ellipsePoints(0, 0, f.rx, f.ry, 32), {
        color: clean ? S.mixHex(P.walnut, P.moss, 0.35) : S.mixHex(P.umber, P.walnut, 0.4),
        lightDir: { x: -0.5, y: -0.8 },
        light: 0.22,
        shadow: 0.5,
        strokes: 14,
        rim: 0,
        seed: f.seed + 1,
      });
      const coat = clean ? S.mixHex(P.plum, P.umber, 0.35) : S.mixHex(P.plum, P.soot, 0.5);
      paintShape(g, [[-40, 70], [-34, 34], [-14, 22], [14, 22], [34, 34], [40, 70]], {
        color: f.who === 'man' ? S.mixHex(coat, P.walnut, 0.5) : coat,
        lightDir: { x: -0.6, y: -0.6 },
        light: 0.25,
        shadow: 0.45,
        strokes: 8,
        rim: 0.25,
        seed: f.seed + 2,
      });
      paintShape(g, ellipsePoints(0, -4, 15, 19, 20), {
        color: clean ? S.mixHex(P.skin, P.taupe, 0.45) : S.mixHex(P.skin, P.umber, 0.55),
        lightDir: { x: -0.6, y: -0.6 },
        light: 0.25,
        shadow: 0.4,
        strokes: 4,
        rim: 0.2,
        seed: f.seed + 3,
      });
      // Hair: parted short for him, gathered up for her.
      g.fillStyle = S.mixHex(P.umber, P.walnut, clean ? 0.6 : 0.3);
      g.beginPath();
      if (f.who === 'man') g.ellipse(0, -16, 16, 9, 0, Math.PI, 0);
      else {
        g.ellipse(0, -14, 17, 11, 0, Math.PI, 0);
        g.ellipse(0, -30, 9, 8, 0, 0, Math.PI * 2);
      }
      g.fill();
      if (!clean) {
        g.fillStyle = S.rgba(P.linen, 0.16);
        g.beginPath();
        g.ellipse(0, 0, f.rx, f.ry, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    // The sampler: "Bless this table", cross-stitched, in a small frame.
    const sx = 1450;
    const sy = 290;
    softShadow(g, sx + 6, sy + 48, 70, 16, 0.35);
    paintShape(g, rectPoints(sx - 52, sy - 40, 104, 84), {
      color: clean ? TONE.woodWarm : TONE.woodDark,
      lightDir: { x: -0.6, y: -0.8 },
      light: 0.3,
      shadow: 0.45,
      strokes: 8,
      rim: 0.3,
      seed: 821,
    });
    paintShape(g, rectPoints(sx - 42, sy - 30, 84, 64), {
      color: clean ? P.linen : S.mixHex(P.linen, P.taupe, 0.5),
      lightDir: { x: -0.4, y: -0.9 },
      light: 0.15,
      shadow: 0.25,
      strokes: 10,
      rim: 0,
      seed: 822,
    });
    g.fillStyle = S.rgba(P.rust, clean ? 0.7 : 0.4);
    for (let x = sx - 36; x <= sx + 36; x += 6) {
      g.fillRect(x, sy - 25, 2, 2);
      g.fillRect(x, sy + 27, 2, 2);
    }
    g.fillStyle = S.rgba(S.mixHex(P.rust, P.umber, 0.3), clean ? 0.9 : 0.5);
    g.font = '700 19px Caveat, "Segoe Print", cursive';
    g.textAlign = 'center';
    g.fillText('Bless this', sx, sy - 4);
    g.fillText('table', sx, sy + 15);
  }

  function paintPlateRailShelf(g, clean) {
    const { x0, x1, y } = PLATE_RAIL;
    const wood = clean ? TONE.woodWarm : TONE.woodDark;

    // Drop shadow under shelf
    softShadow(g, (x0 + x1) / 2, y + 16, (x1 - x0) * 0.52, 14, 0.45);

    // Shelf top face
    paintShape(g, rectPoints(x0, y - 4, x1 - x0, 8), {
      color: clean ? TONE.woodLit : wood,
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.2,
      strokes: 6,
      strokeAngle: 0,
    });

    // Front edge moulding
    paintShape(g, rectPoints(x0, y + 4, x1 - x0, 10), {
      color: wood,
      lightDir: { x: 0, y: 1 },
      light: 0.18,
      shadow: 0.45,
      strokes: 6,
      strokeAngle: 0,
    });

    // Decorative supporting brackets beneath rail
    const brackets = [660, 800, 940, 1080, 1220, 1340];
    for (const bx of brackets) {
      paintShape(
        g,
        [
          [bx - 7, y + 14],
          [bx + 7, y + 14],
          [bx + 5, y + 34],
          [bx - 5, y + 34],
        ],
        {
          color: wood,
          lightDir: { x: -1, y: 1 },
          light: 0.2,
          shadow: 0.5,
        }
      );
    }
  }

  // ART: blockout - Wainscot panels
  function paintWainscoting(g, clean) {
    const y0 = WAINSCOT_TOP;
    const y1 = FLOOR_LINE;
    const h = y1 - y0;
    const baseCol = clean ? TONE.wainscotLit : TONE.wainscotBase;

    // Dado rail with a lit top
    paintShape(g, rectPoints(0, y0 - 8, 1920, 10), {
      color: clean ? '#988a7b' : '#52463b',
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.3,
      strokes: 6,
      strokeAngle: 0,
    });
    // Lit top edge on dado rail
    g.fillStyle = clean ? S.rgba(P.bone, 0.6) : S.rgba(P.linen, 0.4);
    g.fillRect(0, y0 - 8, 1920, 2);

    // Wainscot wall plane
    paintShape(g, rectPoints(0, y0 + 2, 1920, h), {
      color: baseCol,
      lightDir: LIGHT_FROM_WINDOW,
      light: clean ? 0.26 : 0.18,
      shadow: 0.32,
      strokes: 12,
      strokeAngle: Math.PI / 2,
    });

    // Raised panels: bevelled frame (lit top-left edge, shadow bottom-right), inner field with faint grain
    const panelW = 160;
    const panelH = h - 36;
    for (let x = 40; x < 1880; x += panelW + 24) {
      const py = y0 + 18;
      // Bevelled frame outer body
      paintShape(g, rectPoints(x, py, panelW, panelH), {
        color: clean ? S.shadeHex(baseCol, -0.06) : TONE.wainscotShadow,
        lightDir: { x: 1, y: 1 },
        light: 0.14,
        shadow: 0.45,
        strokes: 8,
        strokeAngle: Math.PI / 2,
      });
      // Lit top-left edge
      g.fillStyle = clean ? S.rgba(P.bone, 0.5) : S.rgba(P.linen, 0.35);
      g.fillRect(x, py, panelW, 3);
      g.fillRect(x, py, 3, panelH);
      // Shadow bottom-right edge
      g.fillStyle = S.rgba(P.soot, clean ? 0.35 : 0.55);
      g.fillRect(x, py + panelH - 3, panelW, 3);
      g.fillRect(x + panelW - 3, py, 3, panelH);

      // Raised inner field
      const ifx = x + 12;
      const ify = py + 12;
      const ifw = panelW - 24;
      const ifh = panelH - 24;
      paintShape(g, rectPoints(ifx, ify, ifw, ifh), {
        color: clean ? S.shadeHex(baseCol, 0.08) : baseCol,
        lightDir: LIGHT_FROM_WINDOW,
        light: 0.28,
        shadow: 0.22,
        strokes: 8,
        strokeAngle: Math.PI / 2,
      });
      // Inner field lit top-left
      g.fillStyle = clean ? S.rgba(P.bone, 0.4) : S.rgba(P.linen, 0.25);
      g.fillRect(ifx, ify, ifw, 2);
      g.fillRect(ifx, ify, 2, ifh);
      // Inner field shadow bottom-right
      g.fillStyle = S.rgba(P.soot, clean ? 0.25 : 0.45);
      g.fillRect(ifx, ify + ifh - 2, ifw, 2);
      g.fillRect(ifx + ifw - 2, ify, 2, ifh);

      // Faint grain lines
      g.fillStyle = S.rgba(P.walnut, clean ? 0.1 : 0.15);
      g.fillRect(ifx + ifw * 0.28, ify + 4, 1.5, ifh - 8);
      g.fillRect(ifx + ifw * 0.54, ify + 4, 1.5, ifh - 8);
      g.fillRect(ifx + ifw * 0.76, ify + 4, 1.5, ifh - 8);
    }

    // Skirting baseboard at floor line
    paintShape(g, rectPoints(0, y1 - 16, 1920, 18), {
      color: clean ? '#56463a' : '#2b231d',
      lightDir: { x: 0, y: 1 },
      light: 0.22,
      shadow: 0.6,
      strokes: 6,
      strokeAngle: 0,
    });

    // Raised-panel modelling on top of what is painted above: each field
    // gets a bevel (lit top-left, shadowed bottom-right), so the wainscot
    // reads as carved wood rather than flat pale boxes.
    // Same grid as the panels above: 160 wide, every 184 px, inset 18.
    const panelTop = WAINSCOT_TOP + 18;
    const panelBottom = panelTop + (FLOOR_LINE - WAINSCOT_TOP) - 36;
    for (let px = 40; px < 1880; px += 184) {
      const x0 = px;
      const x1 = px + 160;
      const bevel = 9;
      const lit = clean ? 'rgba(255,248,232,0.32)' : 'rgba(200,210,230,0.12)';
      const dark = clean ? 'rgba(60,44,30,0.34)' : 'rgba(10,8,8,0.42)';
      g.fillStyle = lit;
      g.beginPath();
      g.moveTo(x0, panelTop);
      g.lineTo(x1, panelTop);
      g.lineTo(x1 - bevel, panelTop + bevel);
      g.lineTo(x0 + bevel, panelTop + bevel);
      g.lineTo(x0 + bevel, panelBottom - bevel);
      g.lineTo(x0, panelBottom);
      g.closePath();
      g.fill();
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(x1, panelTop);
      g.lineTo(x1, panelBottom);
      g.lineTo(x0, panelBottom);
      g.lineTo(x0 + bevel, panelBottom - bevel);
      g.lineTo(x1 - bevel, panelBottom - bevel);
      g.lineTo(x1 - bevel, panelTop + bevel);
      g.closePath();
      g.fill();
      // The field itself slightly shaded toward its lower edge.
      const field = g.createLinearGradient(0, panelTop + bevel, 0, panelBottom - bevel);
      field.addColorStop(0, 'rgba(0,0,0,0)');
      field.addColorStop(1, clean ? 'rgba(70,50,35,0.12)' : 'rgba(8,6,6,0.2)');
      g.fillStyle = field;
      g.fillRect(x0 + bevel, panelTop + bevel, x1 - x0 - bevel * 2, panelBottom - panelTop - bevel * 2);
    }
  }

  function paintParquetFloor(g, clean) {
    const y0 = FLOOR_LINE;
    const y1 = 1080;
    const h = y1 - y0;

    // Base floor tone
    paintShape(g, rectPoints(0, y0, 1920, h), {
      color: clean ? TONE.parquetLight : TONE.parquetDark,
      lightDir: { x: 0, y: -1 },
      light: clean ? 0.28 : 0.16,
      shadow: 0.42,
      strokes: 18,
      strokeAngle: 0,
    });

    // Herringbone parquet blocks in perspective
    g.save();
    const darkWood = clean ? '#523d2d' : '#271d17';
    const lightWood = clean ? '#826346' : '#443327';

    g.globalAlpha = clean ? 0.6 : 0.45;
    g.lineWidth = 1.0;

    const rows = 12;
    for (let r = 0; r < rows; r++) {
      const v0 = r / rows;
      const v1 = (r + 1) / rows;
      const py0 = y0 + Math.pow(v0, 1.45) * h;
      const py1 = y0 + Math.pow(v1, 1.45) * h;
      const segW = S.lerp(55, 115, v1);

      for (let x = -80; x < 2000; x += segW) {
        const toggle = ((r + ((x / segW) | 0)) % 2 === 0);
        g.fillStyle = toggle ? lightWood : darkWood;
        g.strokeStyle = clean ? '#322319' : '#18120e';

        // Angled chevron block
        g.beginPath();
        g.moveTo(x, py0);
        g.lineTo(x + segW * 0.7, py1);
        g.lineTo(x + segW * 1.2, py1);
        g.lineTo(x + segW * 0.5, py0);
        g.closePath();
        g.fill();
        g.stroke();
      }
    }
    g.restore();

    // Dirty floor stains and scuffs
    if (!clean) {
      stain(g, 720, 890, 48, '#18120e', 11, 0.42);
      stain(g, 1050, 920, 58, '#15100d', 22, 0.46);
      stain(g, 1340, 870, 42, '#19130f', 33, 0.38);
    }
  }

  function paintWindowFrame(g, clean) {
    const { x, y, w, h } = WINDOW;
    const wood = clean ? '#6e5d4d' : '#322720';

    // Architrave outer frame
    paintShape(g, rectPoints(x - 22, y - 24, w + 44, 24), {
      color: clean ? '#85715e' : '#3e3026',
      lightDir: { x: 0, y: 1 },
      light: 0.28,
      shadow: 0.35,
    });
    // Left & right jambs
    paintShape(g, rectPoints(x - 20, y, 20, h), {
      color: wood,
      lightDir: { x: 1, y: 0 },
      light: 0.32,
      shadow: 0.4,
    });
    paintShape(g, rectPoints(x + w, y, 20, h), {
      color: wood,
      lightDir: { x: -1, y: 0 },
      light: 0.15,
      shadow: 0.5,
    });
    // Sill
    paintShape(g, rectPoints(x - 26, y + h, w + 52, 22), {
      color: clean ? '#96816a' : '#48382d',
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.25,
    });

    // Sash bars
    const barCol = clean ? '#5e4e42' : '#271f19';
    // Center vertical mullion
    paintShape(g, rectPoints(x + w * 0.5 - 4, y, 8, h), {
      color: barCol,
      lightDir: { x: 1, y: 0 },
      light: 0.2,
      shadow: 0.3,
    });
    // Horizontal transoms
    paintShape(g, rectPoints(x, y + h * 0.33 - 3, w, 6), {
      color: barCol,
      lightDir: { x: 0, y: 1 },
      light: 0.2,
      shadow: 0.3,
    });
    paintShape(g, rectPoints(x, y + h * 0.66 - 3, w, 6), {
      color: barCol,
      lightDir: { x: 0, y: 1 },
      light: 0.2,
      shadow: 0.3,
    });
  }

  // 2. Furniture Layer: Sideboard, Long Table, Chairs, China Cabinet, Candlesticks, Centerpiece
  function paintFurniture(g, clean) {
    paintChinaCabinet(g, clean);
    paintSideboard(g, clean);
    paintDiningChairsBack(g, clean);
    paintLongTable(g, clean);
    paintDiningChairsFront(g, clean);
  }

  function paintSideboard(g, clean) {
    const { x0, x1, top, floor } = SIDEBOARD;
    const w = x1 - x0;
    const wood = clean ? TONE.woodWarm : TONE.woodDark;

    // Contact shadow
    softShadow(g, (x0 + x1) / 2, floor + 2, w * 0.52, 24, 0.58);

    // Carved legs
    const legW = 24;
    paintShape(g, rectPoints(x0 + 12, top + 130, legW, floor - top - 130), {
      color: TONE.woodDark,
      lightDir: { x: 1, y: 0 },
      light: 0.2,
      shadow: 0.6,
    });
    paintShape(g, rectPoints(x1 - 36, top + 130, legW, floor - top - 130), {
      color: TONE.woodDark,
      lightDir: { x: 1, y: 0 },
      light: 0.15,
      shadow: 0.65,
    });

    // Main cabinet body
    paintShape(g, rectPoints(x0, top + 14, w, 126), {
      color: wood,
      lightDir: LIGHT_FROM_WINDOW,
      light: clean ? 0.34 : 0.2,
      shadow: 0.42,
      strokes: 12,
      strokeAngle: 0,
    });

    // Top counter ledge
    paintShape(g, rectPoints(x0 - 8, top, w + 16, 16), {
      color: clean ? TONE.woodLit : wood,
      lightDir: { x: 0, y: -1 },
      light: 0.4,
      shadow: 0.2,
      strokes: 8,
      strokeAngle: 0,
    });

    // Drawers with carved bevels and brass pulls
    const dw = (w - 28) / 2;
    for (let i = 0; i < 2; i++) {
      const dx = x0 + 10 + i * (dw + 8);
      // Drawer front
      paintShape(g, rectPoints(dx, top + 22, dw, 48), {
        color: clean ? S.shadeHex(wood, 0.08) : S.shadeHex(wood, -0.08),
        lightDir: LIGHT_FROM_WINDOW,
        light: 0.28,
        shadow: 0.4,
      });
      // Brass handle
      const hx = dx + dw / 2;
      const hy = top + 46;
      paintShape(g, roundedRectPoints(hx - 16, hy - 4, 32, 8, 3), {
        color: clean ? P.brass : '#66533a',
        lightDir: { x: 0, y: -1 },
        light: 0.48,
        shadow: 0.3,
      });
    }

    // Cupboard doors below
    for (let i = 0; i < 2; i++) {
      const cx = x0 + 10 + i * (dw + 8);
      paintShape(g, rectPoints(cx, top + 76, dw, 58), {
        color: clean ? S.shadeHex(wood, 0.04) : S.shadeHex(wood, -0.12),
        lightDir: LIGHT_FROM_WINDOW,
        light: 0.24,
        shadow: 0.48,
      });
    }

    // Silver tea set on the sideboard top
    paintTeaSet(g, x0 + 70, top, clean);

    // Broken feather duster (Trace of previous cleaner)
    paintFeatherDuster(g, x0 + 260, top - 2, clean);
  }

  function paintTeaSet(g, cx, topY, clean) {
    const silver = clean ? TONE.silverClean : TONE.silverDirty;

    // Ornate silver tray
    paintShape(g, ellipsePoints(cx + 40, topY - 2, 84, 18, 20), {
      color: silver,
      lightDir: { x: 0, y: -1 },
      light: clean ? 0.48 : 0.22,
      shadow: 0.32,
    });

    // Teapot with body, spout and handle
    paintShape(g, roundedRectPoints(cx + 10, topY - 34, 32, 30, 8), {
      color: silver,
      lightDir: LIGHT_FROM_WINDOW,
      light: clean ? 0.58 : 0.25,
      shadow: 0.32,
    });
    g.save();
    g.strokeStyle = silver;
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(cx + 8, topY - 14);
    g.quadraticCurveTo(cx - 8, topY - 24, cx - 12, topY - 30);
    g.moveTo(cx + 42, topY - 12);
    g.quadraticCurveTo(cx + 56, topY - 20, cx + 42, topY - 32);
    g.stroke();
    g.restore();

    // Sugar bowl & creamer
    paintShape(g, roundedRectPoints(cx + 52, topY - 22, 18, 18, 4), {
      color: silver,
      lightDir: LIGHT_FROM_WINDOW,
      light: clean ? 0.52 : 0.22,
      shadow: 0.32,
    });
    paintShape(g, roundedRectPoints(cx + 74, topY - 20, 16, 16, 4), {
      color: silver,
      lightDir: LIGHT_FROM_WINDOW,
      light: clean ? 0.52 : 0.22,
      shadow: 0.32,
    });
  }

  function paintFeatherDuster(g, x, y, clean) {
    g.save();
    const handleCol = clean ? '#986539' : '#52341e';
    const featherCol = clean ? '#857682' : '#453c42';

    if (clean) {
      // Clean: the two halves laid neatly side by side
      paintShape(g, rectPoints(x, y - 6, 42, 5), {
        color: handleCol,
        lightDir: { x: 0, y: -1 },
        light: 0.32,
        shadow: 0.28,
      });
      paintShape(g, rectPoints(x, y - 13, 42, 5), {
        color: handleCol,
        lightDir: { x: 0, y: -1 },
        light: 0.32,
        shadow: 0.28,
      });
      paintShape(g, ellipsePoints(x + 54, y - 9, 18, 8, 12), {
        color: featherCol,
        lightDir: { x: 0, y: -1 },
        light: 0.38,
        shadow: 0.35,
      });
    } else {
      // Dirty: snapped in two, broken handle, splayed feathers
      g.save();
      g.translate(x, y - 4);
      g.rotate(-0.16);
      g.fillStyle = handleCol;
      g.fillRect(0, 0, 26, 5);
      g.beginPath();
      g.moveTo(26, 0);
      g.lineTo(32, 2.5);
      g.lineTo(26, 5);
      g.fill();
      g.restore();

      g.save();
      g.translate(x + 28, y - 2);
      g.rotate(0.24);
      g.fillStyle = handleCol;
      g.fillRect(0, 0, 22, 5);
      g.fillStyle = featherCol;
      g.beginPath();
      g.ellipse(32, 2, 22, 10, -0.2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.restore();
  }

  function paintLongTable(g, clean) {
    const { x0, x1, top, hem, floor } = TABLE;
    const w = x1 - x0;
    const wood = clean ? TONE.woodWarm : TONE.woodDark;

    // Contact shadow under table
    softShadow(g, (x0 + x1) / 2, floor + 4, w * 0.48, 28, 0.62);

    // Heavy turned mahogany legs at ends
    const legX = [x0 + 50, x0 + 130, x1 - 130, x1 - 50];
    for (const lx of legX) {
      paintShape(g, rectPoints(lx - 15, top + 20, 30, floor - top - 20), {
        color: wood,
        lightDir: { x: 1, y: 0 },
        light: clean ? 0.3 : 0.18,
        shadow: 0.58,
        strokes: 8,
        strokeAngle: Math.PI / 2,
      });
      paintShape(g, ellipsePoints(lx, top + 90, 22, 14, 16), {
        color: clean ? TONE.woodLit : wood,
        lightDir: { x: 1, y: 0 },
        light: 0.38,
        shadow: 0.38,
      });
    }

    // Stretcher bar between legs near floor
    paintShape(g, rectPoints(x0 + 80, floor - 42, w - 160, 16), {
      color: TONE.woodDark,
      lightDir: { x: 0, y: 1 },
      light: 0.16,
      shadow: 0.62,
    });

    // Tabletop wood edge beneath cloth
    paintShape(g, rectPoints(x0 - 10, top, w + 20, 18), {
      color: clean ? TONE.woodLit : wood,
      lightDir: { x: 0, y: -1 },
      light: 0.36,
      shadow: 0.24,
    });

    // Tablecloth
    paintTablecloth(g, clean);

    // Five Candlesticks on the table
    paintCandlesticks(g, clean);

    // Centerpiece of flowers
    paintCenterpiece(g, clean);

    // Place settings (plates, silverware, glasses)
    paintPlaceSettings(g, clean);
  }

  function paintTablecloth(g, clean) {
    const { x0, x1, top, hem } = TABLE;
    const w = x1 - x0;
    const clothCol = clean ? TONE.clothClean : TONE.clothDirty;

    // Drop shadow under cloth hem
    softShadow(g, (x0 + x1) / 2, hem + 12, w * 0.5, 20, 0.45);

    // Main hanging cloth skirt (y: top + 14 to hem)
    const skirtPoints = [
      [x0 + 4, top + 14],
      [x1 - 4, top + 14],
      [x1 + 10, hem],
      [x0 - 10, hem],
    ];
    paintShape(g, skirtPoints, {
      color: clothCol,
      lightDir: LIGHT_FROM_WINDOW,
      light: clean ? 0.34 : 0.2,
      shadow: 0.38,
      strokes: 24,
      strokeAngle: Math.PI / 2,
    });

    // Draped folds: each a soft band of shadow beside a soft band of light,
    // widening toward the hem, so the cloth hangs instead of standing flat.
    g.save();
    wobblyPath(g, skirtPoints, { wobble: 1.6, seed: 7 });
    g.clip();
    for (let x = x0 + 40; x < x1 - 20; x += 62) {
      const fold = g.createLinearGradient(x - 26, 0, x + 26, 0);
      fold.addColorStop(0, 'rgba(0,0,0,0)');
      fold.addColorStop(0.45, clean ? 'rgba(120,100,80,0.22)' : 'rgba(20,16,12,0.3)');
      fold.addColorStop(0.55, clean ? 'rgba(255,250,240,0.26)' : 'rgba(170,155,140,0.16)');
      fold.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fold;
      g.beginPath();
      g.moveTo(x - 16, top + 14);
      g.lineTo(x + 16, top + 14);
      g.lineTo(x + 28, hem + 4);
      g.lineTo(x - 28, hem + 4);
      g.closePath();
      g.fill();
    }
    g.restore();

    // The hem: a scalloped lace edge when clean, frayed and grey when dirty.
    g.save();
    g.strokeStyle = clean ? S.rgba(P.bone, 0.8) : S.rgba(P.taupe, 0.7);
    g.lineWidth = clean ? 2 : 1.4;
    g.beginPath();
    for (let x = x0 - 8; x < x1 + 8; x += 14) {
      g.moveTo(x, hem);
      g.arc(x + 7, hem, 7, Math.PI, 0, true);
    }
    g.stroke();
    g.restore();

    // Tabletop surface of the cloth (top to top + 16)
    paintShape(g, rectPoints(x0 - 8, top - 2, w + 16, 18), {
      color: clean ? P.bone : clothCol,
      lightDir: { x: 0, y: -1 },
      light: clean ? 0.45 : 0.24,
      shadow: 0.18,
      strokes: 16,
      strokeAngle: 0,
    });

    // Stains on dirty tablecloth
    if (!clean) {
      stain(g, x0 + 260, top + 45, 36, '#483428', 44, 0.45);
      stain(g, x0 + 520, top + 55, 48, '#3a2e28', 55, 0.50);
      stain(g, x0 + 740, top + 40, 32, '#423226', 66, 0.42);
    }
  }

  function paintCandlesticks(g, clean) {
    const brass = clean ? P.brass : '#564632';
    const candleWax = clean ? '#ede4d4' : '#786e62';

    for (const cx of CANDLESTICKS) {
      // Candlestick base
      paintShape(g, ellipsePoints(cx, TABLE.top, 24, 7, 16), {
        color: brass,
        lightDir: { x: 0, y: -1 },
        light: clean ? 0.48 : 0.24,
        shadow: 0.32,
      });
      // Stem
      paintShape(g, rectPoints(cx - 3.5, TABLE.top - 46, 7, 46), {
        color: brass,
        lightDir: { x: 1, y: 0 },
        light: clean ? 0.44 : 0.22,
        shadow: 0.38,
      });
      // Candle holder cup (bobeche)
      paintShape(g, ellipsePoints(cx, TABLE.top - 46, 12, 4.5, 14), {
        color: brass,
        lightDir: { x: 0, y: -1 },
        light: clean ? 0.52 : 0.24,
        shadow: 0.28,
      });
      // Taper candle shaft (height: 44 px, flame at top - 90)
      paintShape(g, rectPoints(cx - 3, TABLE.top - 88, 6, 42), {
        color: candleWax,
        lightDir: { x: 1, y: 0 },
        light: clean ? 0.38 : 0.2,
        shadow: 0.28,
      });
      // Black unlit wick (visible when dirty / before lighting)
      if (!clean) {
        paintShape(g, rectPoints(cx - 1, TABLE.top - 94, 2, 6), {
          color: P.soot,
          lightDir: { x: 0, y: 1 },
          light: 0.1,
          shadow: 0.8,
        });
      }
    }
  }

  function paintCenterpiece(g, clean) {
    const cx = 980;
    const cy = TABLE.top - 8;

    // Ornate footed silver vase / bowl
    const bowlCol = clean ? TONE.silverClean : TONE.silverDirty;
    paintShape(g, ellipsePoints(cx, cy, 48, 14, 16), {
      color: bowlCol,
      lightDir: { x: 0, y: -1 },
      light: clean ? 0.52 : 0.24,
      shadow: 0.32,
    });
    paintShape(g, roundedRectPoints(cx - 24, cy - 22, 48, 16, 6), {
      color: bowlCol,
      lightDir: LIGHT_FROM_WINDOW,
      light: clean ? 0.55 : 0.24,
      shadow: 0.36,
    });

    // Flowers inside bowl
    if (clean) {
      // Lush blooming English roses and greenery
      const roseColours = ['#d17d77', '#e2948e', '#bd6d69', '#eaaba6'];
      const leafColour = '#526347';
      for (let i = -3; i <= 3; i++) {
        paintShape(g, ellipsePoints(cx + i * 14, cy - 28 + Math.abs(i) * 3, 16, 8, 10), {
          color: leafColour,
          lightDir: { x: 0, y: -1 },
          light: 0.32,
          shadow: 0.32,
        });
      }
      for (let i = 0; i < 5; i++) {
        const rx = cx + (i - 2) * 16;
        const ry = cy - 36 - (i % 2) * 8;
        paintShape(g, ellipsePoints(rx, ry, 12, 10, 14), {
          color: roseColours[i % roseColours.length],
          lightDir: { x: 0, y: -1 },
          light: 0.45,
          shadow: 0.28,
        });
      }
    } else {
      // Dead dried shrivelled roses & drooping brown stems
      const deadRose = '#4d3f37';
      const deadStem = '#302822';
      for (let i = -2; i <= 2; i++) {
        const dx = cx + i * 18;
        const dy = cy - 24 + Math.abs(i) * 5;
        g.save();
        g.strokeStyle = deadStem;
        g.lineWidth = 2.0;
        g.beginPath();
        g.moveTo(cx, cy - 18);
        g.quadraticCurveTo(dx, cy - 28, dx + (i < 0 ? -8 : 8), dy);
        g.stroke();
        g.restore();
        paintShape(g, ellipsePoints(dx + (i < 0 ? -8 : 8), dy, 9, 6, 10), {
          color: deadRose,
          lightDir: { x: 0, y: 1 },
          light: 0.18,
          shadow: 0.52,
        });
      }
    }
  }

  function paintPlaceSettings(g, clean) {
    const plateCol = clean ? P.bone : '#6e655d';
    const silver = clean ? TONE.silverClean : TONE.silverDirty;

    for (let i = 0; i < PLACES.length; i++) {
      const px = PLACES[i];
      // Charger plate
      paintShape(g, ellipsePoints(px, TABLE.top + 6, 26, 8, 16), {
        color: plateCol,
        lightDir: { x: 0, y: -1 },
        light: clean ? 0.48 : 0.2,
        shadow: 0.26,
      });
      // Inner plate rim
      paintShape(g, ellipsePoints(px, TABLE.top + 6, 17, 5, 12), {
        color: clean ? '#f5ede0' : '#524a44',
        lightDir: { x: 0, y: -1 },
        light: clean ? 0.55 : 0.18,
        shadow: 0.28,
      });

      // Fork (left of plate)
      paintShape(g, rectPoints(px - 34, TABLE.top + 1, 3, 11), {
        color: silver,
        lightDir: { x: 1, y: 0 },
        light: clean ? 0.45 : 0.22,
        shadow: 0.28,
      });
      // Knife (right of plate)
      paintShape(g, rectPoints(px + 32, TABLE.top + 1, 3, 11), {
        color: silver,
        lightDir: { x: -1, y: 0 },
        light: clean ? 0.45 : 0.22,
        shadow: 0.28,
      });

      // Wine glass (above right)
      const gx = px + 28;
      const gy = TABLE.top - 8;
      g.save();
      g.strokeStyle = clean ? 'rgba(235,242,250,0.65)' : 'rgba(95,90,85,0.36)';
      g.fillStyle = clean ? 'rgba(235,242,250,0.28)' : 'rgba(75,70,65,0.2)';
      g.lineWidth = 1.3;
      g.beginPath();
      g.ellipse(gx, gy, 6, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(gx, gy + 9);
      g.lineTo(gx, gy + 17);
      g.moveTo(gx - 5, gy + 17);
      g.lineTo(gx + 5, gy + 17);
      g.stroke();
      g.restore();
    }
  }

  // ART: blockout - Chairs
  // A carved dining-chair back: 20% larger, two stiles with finials, an arched crest
  // rail, and either an upholstered pad or a vase-shaped splat with a pierced heart.
  function paintChairBack(g, cx, top, h, clean, { w = 60, upholstered = false, seed = 1 } = {}) {
    const wood = clean ? TONE.woodWarm : TONE.woodDark;
    const woodOpts = {
      lightDir: LIGHT_FROM_WINDOW,
      light: clean ? 0.34 : 0.2,
      shadow: 0.46,
      strokes: 10,
      strokeAngle: Math.PI / 2,
      rim: clean ? 0.32 : 0.2,
      rimColor: clean ? P.dawn : P.moon,
      wobble: 0.8,
    };
    const half = w / 2;
    for (const sx of [cx - half, cx + half - 8]) {
      paintShape(g, rectPoints(sx, top + 7, 8, h - 7), { color: wood, ...woodOpts, seed: seed + sx });
    }
    for (const fx of [cx - half + 4, cx + half - 4]) {
      paintShape(g, ellipsePoints(fx, top + 4, 6, 7, 12), { color: clean ? TONE.woodLit : wood, ...woodOpts, seed: seed + 7 });
    }
    const crest = [];
    for (let i = 0; i <= 10; i++) crest.push([cx - half + (i / 10) * w, top + 12 - Math.sin((i / 10) * Math.PI) * 10]);
    for (let i = 10; i >= 0; i--) crest.push([cx - half + (i / 10) * w, top + 26 - Math.sin((i / 10) * Math.PI) * 8]);
    paintShape(g, crest, { color: wood, ...woodOpts, strokeAngle: 0, seed: seed + 11 });

    if (upholstered) {
      const fabric = clean ? S.mixHex(P.moss, P.taupe, 0.3) : S.mixHex(P.moss, P.soot, 0.45);
      paintShape(g, roundedRectPoints(cx - half + 10, top + 28, w - 20, h - 40, 7), {
        color: fabric,
        lightDir: { x: -0.4, y: -0.9 },
        light: clean ? 0.3 : 0.16,
        shadow: 0.4,
        strokes: 14,
        strokeAngle: 0.6,
        rim: 0.2,
        seed: seed + 13,
      });
      // Buttoned tufting.
      g.fillStyle = S.rgba(P.soot, 0.45);
      for (const [bx, by] of [[0, 0.3], [-0.25, 0.6], [0.25, 0.6]]) {
        g.beginPath();
        g.arc(cx + bx * w, top + 28 + by * (h - 40), 2.0, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      const sy = top + 26;
      const sh = h - 30;
      const vase = [];
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        vase.push([cx + 8 + Math.sin(u * Math.PI) * 7 - u * 2.5, sy + u * sh]);
      }
      for (let i = 12; i >= 0; i--) {
        const u = i / 12;
        vase.push([cx - 8 - Math.sin(u * Math.PI) * 7 + u * 2.5, sy + u * sh]);
      }
      paintShape(g, vase, { color: clean ? S.mixHex(wood, TONE.woodLit, 0.3) : wood, ...woodOpts, seed: seed + 13 });
      // The pierced heart in the splat.
      const hy = sy + sh * 0.32;
      g.fillStyle = S.rgba(P.soot, 0.6);
      g.beginPath();
      g.moveTo(cx, hy + 6);
      g.bezierCurveTo(cx - 7, hy, cx - 5, hy - 6, cx, hy - 2);
      g.bezierCurveTo(cx + 5, hy - 6, cx + 7, hy, cx, hy + 6);
      g.fill();
    }
  }

  function paintDiningChairsBack(g, clean) {
    // Behind the table: 20% larger upholstered backs above the tabletop
    const backX = [700, 850, 1130, 1280];
    backX.forEach((cx, i) => paintChairBack(g, cx, TABLE.top - 116, 116, clean, { w: 62, upholstered: true, seed: 900 + i * 17 }));

    // Left end chair (x 525): at the table when clean, knocked over when dirty
    if (clean) {
      paintChairBack(g, 527, TABLE.top - 112, 112, clean, { w: 55, upholstered: true, seed: 980 });
    } else {
      softShadow(g, 505, 928, 84, 14, 0.45);
      g.save();
      g.translate(500, 915);
      g.rotate(1.15);
      paintChairBack(g, 0, -96, 96, clean, { w: 50, upholstered: true, seed: 981 });
      g.restore();
    }

    // Right end chair (x 1462): upright
    paintChairBack(g, 1462, TABLE.top - 112, 112, clean, { w: 55, upholstered: true, seed: 982 });
  }

  // In front of the table: 20% larger, visible seat in perspective (front edge and seat top),
  // legs with a turned profile, contact shadows; tucked-in "A." chair pushed further in.
  function paintFrontChair(g, cx, top, clean, seed, pulledOut) {
    const legs = clean ? TONE.woodWarm : TONE.woodDark;
    const floorY = GROUND;
    const legTopY = top + 86;

    // Contact shadows
    softShadow(g, cx + 6, floorY, 68, 14, pulledOut ? 0.55 : 0.4);
    softShadow(g, cx - 26, floorY, 16, 7, 0.45);
    softShadow(g, cx + 24, floorY, 16, 7, 0.45);

    // Turned profile legs (left and right)
    for (const lx of [cx - 26, cx + 22]) {
      // Upper turned collar
      paintShape(g, roundedRectPoints(lx - 2, legTopY, 10, 8, 2), {
        color: legs,
        lightDir: LIGHT_FROM_WINDOW,
        light: 0.3,
        shadow: 0.45,
        seed: seed + lx,
      });
      // Spindle neck
      paintShape(g, rectPoints(lx, legTopY + 8, 6, 12), {
        color: legs,
        lightDir: LIGHT_FROM_WINDOW,
        light: 0.22,
        shadow: 0.5,
        seed: seed + lx + 1,
      });
      // Turned bulb
      paintShape(g, ellipsePoints(lx + 3, legTopY + 26, 6, 6, 12), {
        color: clean ? TONE.woodLit : legs,
        lightDir: LIGHT_FROM_WINDOW,
        light: 0.35,
        shadow: 0.4,
        seed: seed + lx + 2,
      });
      // Lower shaft down to floor
      paintShape(g, rectPoints(lx, legTopY + 32, 6, floorY - (legTopY + 32)), {
        color: legs,
        lightDir: LIGHT_FROM_WINDOW,
        light: 0.2,
        shadow: 0.55,
        seed: seed + lx + 3,
      });
    }

    // Visible seat in perspective: seat top surface & front edge
    const fabric = clean ? S.mixHex(P.moss, P.taupe, 0.3) : S.mixHex(P.moss, P.soot, 0.45);
    // Seat top in perspective
    paintShape(
      g,
      [
        [cx - 34, top + 64],
        [cx + 34, top + 64],
        [cx + 38, top + 78],
        [cx - 38, top + 78],
      ],
      {
        color: fabric,
        lightDir: { x: 0, y: -1 },
        light: clean ? 0.35 : 0.2,
        shadow: 0.32,
        seed: seed + 4,
      }
    );
    // Seat front edge
    paintShape(g, roundedRectPoints(cx - 38, top + 78, 76, 12, 3), {
      color: clean ? S.shadeHex(fabric, -0.08) : S.shadeHex(fabric, -0.15),
      lightDir: LIGHT_FROM_WINDOW,
      light: 0.25,
      shadow: 0.45,
      seed: seed + 5,
    });

    // Chair back seen from behind
    paintChairBack(g, cx, top, 86, clean, { w: 65, seed });
  }

  function paintDiningChairsFront(g, clean) {
    paintFrontChair(g, 760, TABLE.hem + (clean ? 16 : 8), clean, 1010, true);
    // Seat A: clearly the same chair, tucked all the way in under the tablecloth
    paintFrontChair(g, 1060, TABLE.hem - 42, clean, 1030, false);
    if (!clean) {
      // Knocked over on the floor when dirty
      softShadow(g, 1236, 940, 84, 14, 0.45);
      g.save();
      g.translate(1230, 925);
      g.rotate(-1.22);
      paintChairBack(g, 0, -100, 96, clean, { w: 60, seed: 1050 });
      g.restore();
    } else {
      paintFrontChair(g, 1220, TABLE.hem + 12, clean, 1050, true);
    }
  }

  // ART: blockout - China cabinet
  function paintChinaCabinet(g, clean) {
    const { x0, x1, top, floor, ledgeY } = CABINET;
    const w = x1 - x0;
    const h = floor - top;
    const wood = clean ? TONE.woodWarm : TONE.woodDark;

    // Contact shadow
    softShadow(g, (x0 + x1) / 2, floor + 4, w * 0.52, 26, 0.58);

    // Cabinet outer carcass
    paintShape(g, rectPoints(x0, top, w, h), {
      color: wood,
      lightDir: { x: -1, y: 1 },
      light: clean ? 0.34 : 0.18,
      shadow: 0.42,
      strokes: 16,
      strokeAngle: Math.PI / 2,
    });

    // Carved cornice (stepped mouldings & carved dentil blockout)
    paintShape(g, rectPoints(x0 - 14, top - 20, w + 28, 8), {
      color: clean ? TONE.woodLit : wood,
      lightDir: { x: 0, y: -1 },
      light: 0.42,
      shadow: 0.25,
    });
    paintShape(g, rectPoints(x0 - 8, top - 12, w + 16, 8), {
      color: wood,
      lightDir: { x: 0, y: 1 },
      light: 0.22,
      shadow: 0.4,
    });
    // Dentil blocks along cornice
    g.fillStyle = clean ? TONE.woodLit : S.shadeHex(wood, 0.1);
    for (let dx = x0 - 4; dx < x1 + 4; dx += 14) {
      g.fillRect(dx, top - 10, 8, 5);
    }
    paintShape(g, rectPoints(x0 - 10, top - 4, w + 20, 6), {
      color: clean ? TONE.woodLit : wood,
      lightDir: { x: 0, y: -1 },
      light: 0.38,
      shadow: 0.28,
    });

    // Middle cornice ledge (platform at y 600)
    paintShape(g, rectPoints(x0 - 10, ledgeY - 6, w + 20, 14), {
      color: clean ? TONE.woodLit : wood,
      lightDir: { x: 0, y: -1 },
      light: 0.44,
      shadow: 0.2,
      strokes: 6,
      strokeAngle: 0,
    });

    // Interior glass compartment
    const glassX = x0 + 16;
    const glassY = top + 18;
    const glassW = w - 32;
    const glassH = ledgeY - glassY - 10;

    paintShape(g, rectPoints(glassX, glassY, glassW, glassH), {
      color: clean ? '#544332' : '#1e1814',
      lightDir: { x: 0, y: 1 },
      light: clean ? 0.38 : 0.1,
      shadow: 0.55,
    });

    // Interior shelves: plates standing & stacked in rows, cups hanging from hooks
    const shelfY = [glassY + glassH * 0.34, glassY + glassH * 0.68];
    for (let sIdx = 0; sIdx < shelfY.length; sIdx++) {
      const sy = shelfY[sIdx];
      // Shelf slab
      paintShape(g, rectPoints(glassX + 2, sy, glassW - 4, 6), {
        color: clean ? TONE.woodLit : '#322720',
        lightDir: { x: 0, y: -1 },
        light: 0.32,
        shadow: 0.38,
      });

      // Standing plates with rims and transfer bands
      const standingX = [glassX + 26, glassX + 78, glassX + 130];
      for (const px of standingX) {
        // Outer rim
        paintShape(g, ellipsePoints(px, sy - 14, 15, 14, 16), {
          color: clean ? P.bone : '#584e44',
          lightDir: { x: -0.5, y: -0.8 },
          light: clean ? 0.5 : 0.18,
          shadow: 0.3,
        });
        // Transfer band
        g.strokeStyle = clean ? '#3a4e68' : '#2b2a2d';
        g.lineWidth = 1.8;
        g.beginPath();
        g.arc(px, sy - 14, 9, 0, Math.PI * 2);
        g.stroke();
      }

      // Stacked plates in rows
      const stackX = [glassX + 172];
      for (const sx of stackX) {
        for (let p = 0; p < 3; p++) {
          const py = sy - 3 - p * 4;
          paintShape(g, ellipsePoints(sx, py, 16, 5, 12), {
            color: clean ? P.bone : '#4c4238',
            lightDir: { x: 0, y: -1 },
            light: clean ? 0.48 : 0.18,
            shadow: 0.28,
          });
        }
      }

      // Cups hanging from hooks beneath shelf
      const cupX = [glassX + 38, glassX + 90, glassX + 142];
      for (const cx of cupX) {
        // Hook
        g.strokeStyle = clean ? P.brass : '#443828';
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(cx, sy + 6);
        g.lineTo(cx, sy + 10);
        g.arc(cx - 2, sy + 10, 2, 0, Math.PI);
        g.stroke();
        // Cup body & handle
        paintShape(g, roundedRectPoints(cx - 6, sy + 12, 12, 11, 3), {
          color: clean ? P.bone : '#483f36',
          lightDir: { x: -0.5, y: -0.8 },
          light: clean ? 0.45 : 0.16,
          shadow: 0.35,
        });
        g.beginPath();
        g.arc(cx + 6, sy + 17, 3, -Math.PI / 2, Math.PI / 2);
        g.stroke();
      }
    }

    // Glazed doors with muntins
    const doorW = glassW / 2;
    g.save();
    g.strokeStyle = clean ? '#624f3e' : '#2a221b';
    g.lineWidth = 3.0;
    // Outer door frames
    g.strokeRect(glassX, glassY, glassW, glassH);
    g.strokeRect(glassX + doorW - 2, glassY, 4, glassH);
    // Muntin grid bars (vertical & horizontal dividing each door pane)
    g.lineWidth = 1.6;
    for (let d = 0; d < 2; d++) {
      const dx = glassX + d * doorW;
      // Vertical muntin
      g.beginPath();
      g.moveTo(dx + doorW * 0.5, glassY);
      g.lineTo(dx + doorW * 0.5, glassY + glassH);
      // Horizontal muntins
      g.moveTo(dx, glassY + glassH * 0.33);
      g.lineTo(dx + doorW, glassY + glassH * 0.33);
      g.moveTo(dx, glassY + glassH * 0.66);
      g.lineTo(dx + doorW, glassY + glassH * 0.66);
      g.stroke();
    }

    // Glass reflections: two soft diagonal streaks
    g.fillStyle = clean ? 'rgba(235,245,255,0.18)' : 'rgba(175,195,215,0.10)';
    // Streak 1
    g.beginPath();
    g.moveTo(glassX + 16, glassY);
    g.lineTo(glassX + 52, glassY);
    g.lineTo(glassX + glassW * 0.65, glassY + glassH);
    g.lineTo(glassX + glassW * 0.52, glassY + glassH);
    g.closePath();
    g.fill();
    // Streak 2
    g.beginPath();
    g.moveTo(glassX + 68, glassY);
    g.lineTo(glassX + 96, glassY);
    g.lineTo(glassX + glassW * 0.96, glassY + glassH);
    g.lineTo(glassX + glassW * 0.86, glassY + glassH);
    g.closePath();
    g.fill();

    // Cracked glass door pane when dirty
    if (!clean) {
      g.strokeStyle = 'rgba(225,238,250,0.85)';
      g.lineWidth = 1.4;
      g.beginPath();
      const kx = glassX + glassW * 0.28;
      const ky = glassY + glassH * 0.45;
      g.moveTo(kx, ky);
      g.lineTo(kx - 34, ky - 28);
      g.moveTo(kx, ky);
      g.lineTo(kx + 38, ky - 18);
      g.moveTo(kx, ky);
      g.lineTo(kx - 22, ky + 44);
      g.moveTo(kx, ky);
      g.lineTo(kx + 28, ky + 36);
      g.stroke();
    }
    g.restore();

    // Lower cabinet cupboard doors
    const lowerY = ledgeY + 12;
    const lowerH = floor - lowerY - 26;
    paintShape(g, rectPoints(glassX, lowerY, glassW, lowerH), {
      color: wood,
      lightDir: { x: -1, y: 1 },
      light: clean ? 0.3 : 0.16,
      shadow: 0.48,
    });

    // Carved base & bracket feet at floor
    paintShape(g, rectPoints(x0 - 8, floor - 24, w + 16, 10), {
      color: clean ? TONE.woodLit : wood,
      lightDir: { x: 0, y: -1 },
      light: 0.38,
      shadow: 0.32,
    });
    // Left & right bracket feet
    paintShape(g, rectPoints(x0 - 4, floor - 14, 38, 14), {
      color: wood,
      lightDir: { x: 1, y: 0 },
      light: 0.25,
      shadow: 0.55,
    });
    paintShape(g, rectPoints(x1 - 34, floor - 14, 38, 14), {
      color: wood,
      lightDir: { x: -1, y: 0 },
      light: 0.18,
      shadow: 0.6,
    });
  }

  // 3. Front Layer: Out-of-focus silhouettes in bottom corners (blur 7px painted once)
  function paintFront(g, clean) {
    g.save();
    g.filter = 'blur(7px)';

    // Bottom-left corner: Carved high back of a dining chair close to camera
    const chairCol = clean ? '#3e2e25' : '#1b1411';
    g.fillStyle = chairCol;
    g.beginPath();
    g.moveTo(-40, 1100);
    g.lineTo(-40, 830);
    g.quadraticCurveTo(40, 780, 140, 810);
    g.quadraticCurveTo(220, 840, 240, 1100);
    g.closePath();
    g.fill();
    g.strokeStyle = clean ? 'rgba(255,200,140,0.35)' : 'rgba(127,163,199,0.2)';
    g.lineWidth = 4;
    g.stroke();

    // Bottom-right corner: Serving trolley / bar cart silhouette with wine decanter & glasses
    const trolleyCol = clean ? '#36281e' : '#16110e';
    g.fillStyle = trolleyCol;
    g.beginPath();
    g.moveTo(1720, 1100);
    g.lineTo(1720, 870);
    g.lineTo(1960, 870);
    g.lineTo(1960, 1100);
    g.closePath();
    g.fill();
    g.beginPath();
    g.ellipse(1780, 830, 22, 38, 0, 0, Math.PI * 2);
    g.rect(1772, 770, 16, 30);
    g.ellipse(1780, 764, 12, 10, 0, 0, Math.PI * 2);
    g.ellipse(1840, 825, 14, 20, 0, 0, Math.PI * 2);
    g.rect(1837, 842, 6, 26);
    g.fill();

    g.restore();
  }

  // ── Sky layer behind the window (drawn every frame) ───────────────────

  function drawSky(g, live, time, mk) {
    const { x, y, w, h } = WINDOW;
    const day = mk.window; // 0 night -> 1 morning
    const dirty = S.moods.dirty;
    const clean = S.moods.clean;

    const sky = g.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, S.mix(dirty.windowSkyTop, clean.windowSkyTop, day));
    sky.addColorStop(1, S.mix(dirty.windowSkyBottom, clean.windowSkyBottom, day));
    g.fillStyle = sky;
    g.fillRect(x - 4, y - 4, w + 8, h + 8);

    // Stars at night
    for (const st of live.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * 2.2 + st.p);
      g.fillStyle = `rgba(230,238,255,${(1 - day) * twinkle * 0.8})`;
      g.beginPath();
      g.arc(x + st.x * w, y + st.y * h, st.s, 0, Math.PI * 2);
      g.fill();
    }

    // Silhouette of garden tree branches outside
    g.save();
    g.strokeStyle = S.mixHex('#0e131c', '#3c4a5a', day);
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(x + w, y + h * 0.4);
    g.quadraticCurveTo(x + w * 0.6, y + h * 0.35, x + w * 0.3, y + h * 0.15);
    g.quadraticCurveTo(x + w * 0.45, y + h * 0.22, x + w * 0.15, y + h * 0.05);
    g.stroke();
    g.restore();
  }

  // ── Dynamic Props Layer (drapes, chandelier, plates, place cards, candle flames) ─

  function drawProps(g, live, time, mk) {
    drawWindowDrapes(g, live, time, mk);
    drawChandelier(g, live, time, mk);
    drawPlateRailPlates(g, live, time, mk);
    drawUnderTableSilk(g, live, time, mk);
  }

  // Things on the table move, and must sit in front of the tablecloth and
  // the chair backs, so they are drawn after the furniture layer.
  function drawOnFurniture(g, live, time, mk) {
    drawCandleFlames(g, live, time, mk);
    drawPlaceCards(g, live, time, mk);
  }

  function drawWindowDrapes(g, live, time, mk) {
    const { x, y, w, h } = WINDOW;
    const day = mk.window;
    const drapeCol = S.mixHex(TONE.drapeDirty, TONE.drapeClean, day);

    g.save();
    g.fillStyle = drapeCol;

    if (day > 0.65) {
      // Clean: heavy drapes tied back neatly with gold braided tie-backs
      g.beginPath();
      g.moveTo(x - 16, y - 10);
      g.lineTo(x + 50, y - 10);
      g.quadraticCurveTo(x + 18, y + h * 0.5, x + 35, y + h + 10);
      g.lineTo(x - 16, y + h + 10);
      g.closePath();
      g.fill();

      g.beginPath();
      g.moveTo(x + w + 16, y - 10);
      g.lineTo(x + w - 50, y - 10);
      g.quadraticCurveTo(x + w - 18, y + h * 0.5, x + w - 35, y + h + 10);
      g.lineTo(x + w + 16, y + h + 10);
      g.closePath();
      g.fill();

      // Gold tie-backs
      g.strokeStyle = P.brass;
      g.lineWidth = 3.5;
      g.beginPath();
      g.arc(x + 10, y + h * 0.5, 14, -0.6, 1.2);
      g.stroke();
      g.beginPath();
      g.arc(x + w - 10, y + h * 0.5, 14, 1.9, 3.8);
      g.stroke();
    } else {
      // Dirty: torn heavy drapes hanging down, moth-eaten and frayed
      g.beginPath();
      g.moveTo(x - 16, y - 10);
      g.lineTo(x + 75, y - 10);
      g.quadraticCurveTo(x + 65, y + h * 0.5, x + 55, y + h * 0.7);
      g.lineTo(x + 40, y + h * 0.76);
      g.lineTo(x + 60, y + h * 0.84);
      g.lineTo(x + 30, y + h + 8);
      g.lineTo(x - 16, y + h + 8);
      g.closePath();
      g.fill();

      g.beginPath();
      g.moveTo(x + w + 16, y - 10);
      g.lineTo(x + w - 70, y - 10);
      g.quadraticCurveTo(x + w - 55, y + h * 0.5, x + w - 65, y + h * 0.65);
      g.lineTo(x + w - 42, y + h * 0.75);
      g.lineTo(x + w - 60, y + h * 0.86);
      g.lineTo(x + w - 24, y + h + 8);
      g.lineTo(x + w + 16, y + h + 8);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  // ART: blockout - Chandelier
  // The chandelier's brass and glass do not move, so they are painted once
  // per state into a sprite; per frame only the glints and bulbs are drawn.
  const CHAND_BOX = { x: CHANDELIER.x - 140, y: CHANDELIER.yTop - 10, w: 280, h: 300 };

  function drawChandelier(g, live, time, mk) {
    const cleanOn = mk.chandelier ?? (mk.window > 0.5 ? 1 : 0);
    const lit = cleanOn > 0;
    const img = sprite(`chandelier:${lit}`, CHAND_BOX.w, CHAND_BOX.h, (cg) => {
      cg.translate(-CHAND_BOX.x, -CHAND_BOX.y);
      paintChandelierBrass(cg, lit ? 1 : 0);
    });
    g.drawImage(img, CHAND_BOX.x, CHAND_BOX.y);
    drawChandelierLights(g, live, time, cleanOn);
  }

  // The brass and glass of the chandelier, painted once per state. Positions
  // match drawChandelierLights(): six arms ending at ARM_X / armHeights,
  // a first tier of drops on the urn, a second under each drip pan.
  function paintChandelierBrass(g, cleanOn) {
    const lit = cleanOn > 0;
    const cx = CHANDELIER.x;
    const yTop = CHANDELIER.yTop;
    const yBottom = CHANDELIER.yBottom;
    const brass = lit ? P.brass : S.mixHex(P.brass, P.umber, 0.6);
    const brassLit = lit ? S.mixHex(P.brass, P.bone, 0.45) : S.mixHex(P.brass, P.taupe, 0.4);
    const brassDark = lit ? S.shadeHex(P.brass, -0.45) : S.mixHex(P.umber, P.soot, 0.4);
    const metal = (pts, seed, light = 0.4) =>
      paintShape(g, pts, {
        color: brass,
        lightDir: { x: -0.5, y: -0.85 },
        light,
        shadow: 0.5,
        strokes: 4,
        rim: lit ? 0.45 : 0.2,
        rimColor: lit ? P.dawn : P.moon,
        wobble: 0.4,
        seed,
      });
    const armX = [-92, -56, -22, 22, 56, 92];
    const armY = [yBottom - 26, yBottom - 32, yBottom - 36, yBottom - 36, yBottom - 32, lit ? yBottom - 26 : yBottom - 8];
    const hub = { x: cx, y: yBottom - 34 };

    // Chain from the ceiling rose: alternating links, lit on the left.
    for (let y = yTop + 6, i = 0; y < yTop + 74; y += 9, i++) {
      g.strokeStyle = i % 2 ? brassDark : brass;
      g.lineWidth = 2.6;
      g.beginPath();
      if (i % 2) g.ellipse(cx, y, 2, 5.5, 0, 0, Math.PI * 2);
      else g.ellipse(cx, y, 4.5, 5.5, 0, 0, Math.PI * 2);
      g.stroke();
    }

    // The turned column: canopy, knop, a long vase, a collar, then the urn.
    metal(ellipsePoints(cx, yTop + 82, 14, 6, 18), 1401);
    metal([[cx - 6, yTop + 84], [cx + 6, yTop + 84], [cx + 9, yTop + 110], [cx + 4, yTop + 128], [cx - 4, yTop + 128], [cx - 9, yTop + 110]], 1402);
    metal(ellipsePoints(cx, yTop + 134, 11, 9, 18), 1403);
    metal([[cx - 5, yTop + 140], [cx + 5, yTop + 140], [cx + 13, yTop + 168], [cx + 6, yBottom - 52], [cx - 6, yBottom - 52], [cx - 13, yTop + 168]], 1404);
    metal(ellipsePoints(cx, yBottom - 50, 13, 5, 18), 1405);

    // Six tubular S-arms, each with a dark underside and a bright top line,
    // so they read as round brass tubes, not flat strokes.
    for (let i = 0; i < armX.length; i++) {
      const ex = cx + armX[i];
      const ey = armY[i];
      const sag = i === 5 && !lit ? 18 : 0; // the snapped arm droops
      const c1x = cx + armX[i] * 0.35;
      const c1y = hub.y + 22 + sag * 0.3;
      const c2x = cx + armX[i] * 0.85;
      const c2y = ey + 26 + sag;
      for (const [w, col, dy] of [[6.5, brassDark, 1.2], [4.2, brass, 0], [1.4, brassLit, -1.4]]) {
        g.strokeStyle = col;
        g.lineWidth = w;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(hub.x, hub.y + 4 + dy);
        g.bezierCurveTo(c1x, c1y + dy, c2x, c2y + dy, ex, ey + 3 + dy);
        g.stroke();
      }
      // A small scroll under each arm.
      g.strokeStyle = brass;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx + armX[i] * 0.55, hub.y + 22 + sag * 0.4, 7, 0.3, Math.PI * 1.6);
      g.stroke();

      // Drip pan (bobeche) and candle sleeve.
      metal(ellipsePoints(ex, ey + 2, 12, 4.5, 16), 1410 + i, 0.5);
      paintShape(g, rectPoints(ex - 3.5, ey - 18, 7, 18), {
        color: lit ? P.bone : S.mixHex(P.linen, P.taupe, 0.5),
        lightDir: { x: -0.8, y: -0.4 },
        light: 0.3,
        shadow: 0.35,
        strokes: 2,
        rim: 0.25,
        wobble: 0.2,
        seed: 1420 + i,
      });

      // Tier 2: a cut-glass drop under each drip pan.
      drawDrop(g, ex, ey + 6, 22, lit);
    }

    // The urn the arms spring from, and the finial below it.
    metal([[cx - 30, hub.y - 4], [cx + 30, hub.y - 4], [cx + 24, hub.y + 12], [cx + 10, hub.y + 22], [cx - 10, hub.y + 22], [cx - 24, hub.y + 12]], 1430, 0.45);
    metal(ellipsePoints(cx, hub.y - 4, 30, 6, 22), 1431, 0.55);
    metal([[cx - 6, hub.y + 22], [cx + 6, hub.y + 22], [cx, hub.y + 40]], 1432);

    // Tier 1: drops hanging from the urn's rim.
    for (const tx of [-24, -8, 8, 24]) drawDrop(g, cx + tx, hub.y + 8, 16, lit);
    drawDrop(g, cx, hub.y + 40, 20, lit);

    // Garlands of glass beads swagged between neighbouring arms.
    for (let i = 0; i < armX.length - 1; i++) {
      if (i === 4 && !lit) continue; // broken where the arm snapped
      const x0 = cx + armX[i];
      const x1 = cx + armX[i + 1];
      const y0 = armY[i] + 4;
      const y1 = armY[i + 1] + 4;
      for (let k = 1; k < 9; k++) {
        const u = k / 9;
        const bx = S.lerp(x0, x1, u);
        const by = S.lerp(y0, y1, u) + Math.sin(u * Math.PI) * 12;
        g.fillStyle = lit ? S.rgba(P.bone, 0.75) : S.rgba(P.taupe, 0.6);
        g.beginPath();
        g.arc(bx, by, 1.5, 0, Math.PI * 2);
        g.fill();
      }
    }

    if (!lit) {
      // Cobwebs strung from the column to the arms.
      g.strokeStyle = S.rgba(P.silk, 0.32);
      g.lineWidth = 0.9;
      for (const i of [0, 2, 5]) {
        g.beginPath();
        g.moveTo(cx, yTop + 120);
        g.quadraticCurveTo(cx + armX[i] * 0.6, yTop + 150, cx + armX[i], armY[i] - 14);
        g.stroke();
        g.beginPath();
        g.moveTo(cx, yTop + 150);
        g.quadraticCurveTo(cx + armX[i] * 0.5, yTop + 175, cx + armX[i] * 0.9, armY[i]);
        g.stroke();
      }
    }
    g.restore();
  }

  // One cut-glass drop: a faceted lozenge with a bright facet and a dark one.
  function drawDrop(g, x, y, len, lit) {
    g.save();
    g.strokeStyle = lit ? S.rgba(P.bone, 0.85) : S.rgba(P.taupe, 0.55);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y - 3);
    g.lineTo(x, y);
    g.stroke();
    const body = [[x, y], [x + 4.5, y + len * 0.6], [x, y + len], [x - 4.5, y + len * 0.6]];
    g.fillStyle = lit ? S.rgba(P.bone, 0.45) : S.rgba(P.taupe, 0.3);
    g.beginPath();
    body.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = lit ? S.rgba(P.sky, 0.35) : S.rgba(P.moon, 0.18);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 4.5, y + len * 0.6);
    g.lineTo(x, y + len);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawChandelierLights(g, live, time, cleanOn) {
    const cx = CHANDELIER.x;
    const yBottom = CHANDELIER.yBottom;
    const armX = [-92, -56, -22, 22, 56, 92];
    const armHeights = [
      yBottom - 26,
      yBottom - 32,
      yBottom - 36,
      yBottom - 36,
      yBottom - 32,
      cleanOn > 0 ? yBottom - 26 : yBottom - 8,
    ];

    // Glints on 2 tiers of crystal drops
    // Tier 1 upper drops glints
    const tier1X = [-24, -8, 8, 24];
    for (const tx of tier1X) {
      if (cleanOn > 0 || (time + tx) % 2.5 < 0.6) {
        g.fillStyle = S.rgba(P.bone, cleanOn > 0 ? 0.8 : 0.45);
        g.beginPath();
        g.arc(cx + tx, yBottom - 26 + 10, 1.8, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Tier 2 lower drops glints
    for (let i = 0; i < armX.length; i++) {
      const ax = armX[i];
      if (cleanOn > 0 || (time + ax) % 2.8 < 0.6) {
        g.fillStyle = S.rgba(P.bone, cleanOn > 0 ? 0.75 : 0.4);
        g.beginPath();
        g.arc(cx + ax, armHeights[i] + 6 + 22 * 0.65, 2.2, 0, Math.PI * 2);
        g.fill();
      }
    }

    g.save();
    // Bulbs: dirty has 1 weakly flickering bulb at cx - 56; clean lights all 6
    const flick = cleanOn > 0 ? 1 : S.light.flicker(live.noise, time, 1.25);
    for (let i = 0; i < armX.length; i++) {
      const bx = cx + armX[i];
      const by = armHeights[i] - 20;
      const isLit = cleanOn > 0 || i === 1;

      if (isLit) {
        const bulbAlpha = cleanOn > 0 ? cleanOn : 0.55 * flick;
        g.fillStyle = S.rgba(P.amber, bulbAlpha);
        g.beginPath();
        g.arc(bx, by, 4.2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(bx, by, 1.8, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillStyle = '#2a221b';
        g.beginPath();
        g.arc(bx, by, 2.5, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }

  // Everything below is drawn every frame, so nothing in it may call
  // paintShape (which blurs) — ART-DIRECTION §6. Each prop is painted once
  // into a small canvas, per state, and only placed and rotated per frame.
  const sprites = new Map();
  function sprite(key, w, h, paintFn) {
    let c = sprites.get(key);
    if (!c) {
      c = S.makeCanvas(w, h);
      paintFn(c.getContext('2d'));
      sprites.set(key, c);
    }
    return c;
  }

  // A display plate on the rail: rim, a blue transfer band, a highlight.
  function plateSprite(clean) {
    return sprite(`plate:${clean}`, 60, 60, (pg) => {
      paintShape(pg, ellipsePoints(30, 30, 24, 24, 24), {
        color: clean ? P.bone : '#736b63',
        lightDir: LIGHT_FROM_WINDOW,
        light: clean ? 0.42 : 0.2,
        shadow: 0.32,
        strokes: 6,
        rim: 0.35,
        rimColor: clean ? P.dawn : P.moon,
        seed: 1101,
      });
      pg.strokeStyle = clean ? S.rgba('#3a4e68', 0.75) : S.rgba('#33373d', 0.7);
      pg.lineWidth = 3;
      pg.beginPath();
      pg.arc(30, 30, 16, 0, Math.PI * 2);
      pg.stroke();
      pg.lineWidth = 1;
      pg.beginPath();
      pg.arc(30, 30, 11, 0, Math.PI * 2);
      pg.stroke();
      // The transfer pattern: a ring of tiny leaves.
      pg.fillStyle = clean ? S.rgba('#3a4e68', 0.55) : S.rgba('#33373d', 0.5);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        pg.beginPath();
        pg.ellipse(30 + Math.cos(a) * 20, 30 + Math.sin(a) * 20, 2.2, 1, a, 0, Math.PI * 2);
        pg.fill();
      }
      pg.fillStyle = S.rgba(P.bone, clean ? 0.55 : 0.2);
      pg.beginPath();
      pg.ellipse(22, 20, 8, 3, -0.7, 0, Math.PI * 2);
      pg.fill();
    });
  }

  function drawPlateRailPlates(g, live, time, mk) {
    const clean = mk.window > 0.5;
    const img = plateSprite(clean);
    for (const p of livePlates) {
      g.save();
      g.translate(p.x, PLATE_RAIL.y - 2);
      g.rotate(p.wobble);
      g.drawImage(img, -30, -52);
      g.restore();
    }
  }

  // A place card, folded in a tent. Standing, its name is readable from
  // across the room; fallen, it lies flat and grey under the dust.
  function cardSprite(name, standing) {
    const fontReady = !document.fonts || document.fonts.check('700 22px Caveat');
    const key = `card:${name}:${standing}:${fontReady}`;
    return sprite(key, 70, 44, (cg) => {
      if (standing) {
        paintShape(cg, [[7, 6], [63, 6], [59, 36], [11, 36]], {
          color: P.bone,
          lightDir: { x: -0.3, y: -0.95 },
          light: 0.25,
          shadow: 0.22,
          strokes: 6,
          rim: 0.3,
          wobble: 0.6,
          seed: name.length * 31,
        });
        cg.strokeStyle = S.rgba(P.brass, 0.7);
        cg.lineWidth = 1;
        cg.strokeRect(11, 9, 48, 24);
        cg.fillStyle = name === 'A.' ? '#7a2e22' : '#2b231d';
        cg.font = '700 22px Caveat, "Segoe Print", cursive';
        cg.textAlign = 'center';
        cg.fillText(name, 35, 29);
      } else {
        paintShape(cg, [[6, 24], [62, 22], [66, 36], [4, 38]], {
          color: '#6a6158',
          lightDir: { x: 0, y: -1 },
          light: 0.16,
          shadow: 0.45,
          strokes: 5,
          rim: 0,
          seed: name.length * 37,
        });
        cg.fillStyle = S.rgba(P.linen, 0.18);
        cg.fillRect(6, 24, 58, 12);
      }
    });
  }

  function drawPlaceCards(g, live, time, mk) {
    const cardsBeat = mk.cards ?? 0;
    for (let i = 0; i < PLACE_CARDS.length; i++) {
      const pc = PLACE_CARDS[i];
      // The cards' own beat decides, not the dawn: they stand up at 4.4 s,
      // after the candles. (In the restored room the beat is 1.)
      const progress = S.clamp((cardsBeat - i * 0.12) / 0.28, 0, 1);
      g.save();
      g.translate(pc.x, pc.y);
      if (progress > 0.95) {
        g.drawImage(cardSprite(pc.name, true), -35, -40);
      } else if (progress > 0) {
        // Rising: the card tips up from flat to standing.
        g.rotate(S.lerp(1.2, 0, progress));
        g.drawImage(cardSprite(pc.name, true), -35, -38);
      } else {
        g.drawImage(cardSprite(pc.name, false), -35, -38);
      }
      g.restore();
    }
  }

  // A candle flame: three nested soft layers (amber haze, ember body, pale
  // core) that fade to nothing at the tip, so there is no hard outline.
  function drawSoftFlame(g, x, base, w, h, sway, k) {
    const layers = [
      { s: 1, c0: P.ember, c1: P.amber, a: 0.4 },
      { s: 0.66, c0: P.ember, c1: P.amber, a: 0.7 },
      { s: 0.36, c0: P.dawn, c1: P.dawn, a: 0.9 },
    ];
    for (const L of layers) {
      const lw = w * L.s;
      const lh = h * (0.55 + L.s * 0.45);
      const grad = g.createLinearGradient(x, base, x + sway, base - lh);
      grad.addColorStop(0, S.rgba(L.c0, L.a * k));
      grad.addColorStop(0.5, S.rgba(L.c1, L.a * 0.75 * k));
      grad.addColorStop(1, S.rgba(L.c1, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x - lw, base);
      g.bezierCurveTo(x - lw * 1.2, base - lh * 0.45, x + sway * 0.6 - lw * 0.3, base - lh * 0.8, x + sway, base - lh);
      g.bezierCurveTo(x + sway * 0.6 + lw * 0.3, base - lh * 0.8, x + lw * 1.2, base - lh * 0.45, x + lw, base);
      g.closePath();
      g.fill();
    }
  }

  function drawCandleFlames(g, live, time, mk) {
    const keys = ['candle1', 'candle2', 'candle3', 'candle4', 'candle5'];
    for (let i = 0; i < CANDLESTICKS.length; i++) {
      const litVal = mk[keys[i]] ?? (mk.window > 0.5 ? 1 : 0);
      if (litVal <= 0.01) continue;
      const flick = S.light.flicker(live.noise, time * 1.8 + i * 2.2, 0.75);
      const sway = live.noise(time * 2.3 + i * 4.1) * 3;
      g.save();
      g.globalCompositeOperation = 'lighter';
      drawSoftFlame(g, CANDLESTICKS[i], TABLE.top - 86, 6 * litVal, (24 + flick * 6) * litVal, sway, litVal);
      g.restore();
    }
  }

  // ART: blockout - The egg nest
  function drawUnderTableSilk(g, live, time, mk) {
    if (mk.wipe >= 1 || mk.window > 0.6) return;

    g.save();

    // Crossing silk anchor lines between table legs under cloth
    const lines = [
      [830, 850, 1020, 915],
      [840, 890, 1120, 895],
      [1130, 855, 930, 920],
      [980, 880, 860, 915],
      [980, 880, 1090, 920],
      [875, 892, 925, 912],
      [925, 912, 1025, 896],
      [1025, 896, 1085, 916],
    ];

    // Base hammock web strands
    g.strokeStyle = S.rgba(P.silk, 0.45);
    g.lineWidth = 1.3;
    for (const [x1, y1, x2, y2] of lines) {
      g.beginPath();
      g.moveTo(x1, y1);
      g.quadraticCurveTo((x1 + x2) * 0.5, (y1 + y2) * 0.5 + 4, x2, y2);
      g.stroke();
    }

    // Hammock web brighter where cold bounce light catches it
    g.strokeStyle = S.rgba(P.moon, 0.68);
    g.lineWidth = 1.6;
    for (const [x1, y1, x2, y2] of lines.slice(3)) {
      g.beginPath();
      g.moveTo(x1 + (x2 - x1) * 0.2, y1 + (y2 - y1) * 0.2);
      g.quadraticCurveTo((x1 + x2) * 0.5, (y1 + y2) * 0.5 + 4, x1 + (x2 - x1) * 0.8, y1 + (y2 - y1) * 0.8);
      g.stroke();
    }

    // Rim light on each egg sac in the nest
    for (const spot of NEST_SPOTS) {
      g.strokeStyle = S.rgba(P.moon, 0.72);
      g.lineWidth = 1.8;
      g.beginPath();
      g.arc(spot.x, spot.y + 1, 14, 0.25 * Math.PI, 0.85 * Math.PI);
      g.stroke();
      g.strokeStyle = S.rgba(P.bone, 0.45);
      g.lineWidth = 0.9;
      g.beginPath();
      g.arc(spot.x, spot.y + 1, 13, 0.3 * Math.PI, 0.8 * Math.PI);
      g.stroke();
    }

    g.restore();
  }

  // ── Lighting Pass ─────────────────────────────────────────────────────

  function shaftQuad(mk) {
    const { x, y, w, h } = WINDOW;
    return [
      [x + 10, y + 10],
      [x + w - 10, y + 40],
      [x + w + 440, GROUND + 50],
      [x + 90, GROUND + 50],
    ];
  }

  function lights(lm, live, time, mk) {
    const windowColor = S.mixHex(P.moon, P.dawn, mk.window);

    // 1. Window moonlight / dawn spill & shaft
    lm.point(WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h / 2, 520, windowColor, S.lerp(0.55, 0.92, mk.window));
    lm.shaft(shaftQuad(mk), windowColor, S.lerp(0.85, 1.0, mk.window));

    // 2. Chandelier: dirty has 1 warm flickering bulb; clean lights whole room
    const cleanChand = mk.chandelier ?? (mk.window > 0.5 ? 1 : 0);
    const chandFlick = cleanChand > 0 ? 1 : S.light.flicker(live.noise, time, 1.3) * 0.55;

    // Center amber light from chandelier
    lm.point(
      CHANDELIER.x,
      CHANDELIER.yBottom - 10,
      cleanChand > 0 ? 680 : 480,
      P.amber,
      cleanChand > 0 ? 0.9 * cleanChand : 0.8 * chandFlick
    );
    // Amber light pool on the table beneath chandelier
    lm.point(
      CHANDELIER.x,
      TABLE.top - 10,
      cleanChand > 0 ? 520 : 420,
      P.amber,
      cleanChand > 0 ? 0.7 * cleanChand : 0.6 * chandFlick
    );

    // ART: blockout - Dirty frame
    // Keep it cold, but raise moonlight bounce so table, chairs, and cabinet read as shapes at a glance
    if (mk.window < 0.5) {
      const night = 1 - mk.window * 2;
      lm.point(990, 780, 720, P.moon, 0.45 * night);
      lm.point(680, 830, 440, P.moon, 0.40 * night);
      lm.point(1190, 830, 440, P.moon, 0.40 * night);
      lm.point(1680, 560, 540, P.moon, 0.52 * night);
      lm.point(1000, 540, 920, P.moon, 0.30 * night);
      lm.point(900, 980, 760, P.moon, 0.28 * night);
    }

    // The place card at the chair that was never pulled out.
    const cardsUp = S.clamp(((mk.cards ?? 0) - 0.36) / 0.28, 0, 1);
    if (cardsUp > 0) lm.point(1060, 755, 170, P.dawn, 0.45 * cardsUp);

    // ART: blockout - The egg nest
    // 3. Soft cold bounce light from the floor under the table: makes egg nest read distinctly in the dark
    const underLight = cleanChand > 0 ? 0.16 : 0.62;
    lm.point(975, 915, 380, P.moon, underLight);

    // 4. China Cabinet light: off dirty, warm interior light clean
    const cabLight = mk.cabinetLight ?? (mk.window > 0.5 ? 1 : 0);
    if (cabLight > 0.01) {
      lm.point(1680, 520, 440, P.amber, 0.85 * cabLight);
      lm.cone(1680, 360, Math.PI / 2, 1.2, 480, P.dawn, 0.78 * cabLight);
    }

    // 5. Five Candlesticks along the table
    const keys = ['candle1', 'candle2', 'candle3', 'candle4', 'candle5'];
    for (let i = 0; i < CANDLESTICKS.length; i++) {
      const cx = CANDLESTICKS[i];
      const litVal = mk[keys[i]] ?? (mk.window > 0.5 ? 1 : 0);
      if (litVal > 0.01) {
        const flameFlick = S.light.flicker(live.noise, time * 1.6 + i * 2, 0.8);
        lm.point(cx, TABLE.top - 88, 300, P.amber, 0.8 * litVal * flameFlick);
      }
    }
  }

  // ── Glow Pass ─────────────────────────────────────────────────────────

  function glow(g, lm, live, time, mk, flick, parallaxShift = 0) {
    const windowHex = mk.window > 0.5 ? P.dawn : P.moon;

    // Window light beam through dusty air
    S.light.beam(g, shaftQuad(mk), windowHex, S.lerp(0.26, 0.38, mk.window));
    S.light.glow(g, WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h / 2, 280, windowHex, S.lerp(0.22, 0.36, mk.window));

    // Chandelier glow
    const cleanChand = mk.chandelier ?? (mk.window > 0.5 ? 1 : 0);
    const chandFlick = cleanChand > 0 ? 1 : S.light.flicker(live.noise, time, 1.3) * 0.55;
    if (cleanChand > 0) {
      S.light.glow(g, CHANDELIER.x, CHANDELIER.yBottom - 10, 220, P.amber, 0.7 * cleanChand);
      S.light.glow(g, CHANDELIER.x, CHANDELIER.yBottom - 20, 110, P.dawn, 0.8 * cleanChand);
    } else {
      // 2nd bulb flickers weakly
      S.light.glow(g, CHANDELIER.x - 52, CHANDELIER.yBottom - 48, 55, P.amber, 0.6 * chandFlick);
    }

    // China Cabinet glow
    const cabLight = mk.cabinetLight ?? (mk.window > 0.5 ? 1 : 0);
    if (cabLight > 0.01) {
      S.light.glow(g, 1680, 500, 140, P.amber, 0.5 * cabLight);
    }

    // Candle flame glows
    const keys = ['candle1', 'candle2', 'candle3', 'candle4', 'candle5'];
    for (let i = 0; i < CANDLESTICKS.length; i++) {
      const cx = CANDLESTICKS[i];
      const litVal = mk[keys[i]] ?? (mk.window > 0.5 ? 1 : 0);
      if (litVal > 0.01) {
        const flameFlick = S.light.flicker(live.noise, time * 1.6 + i * 2, 0.8);
        S.light.glow(g, cx, TABLE.top - 88, 48, P.ember, 0.8 * litVal * flameFlick);
        S.light.glow(g, cx, TABLE.top - 88, 120, P.amber, 0.5 * litVal * flameFlick);
      }
    }

    // The "A." card is the one to notice: a little warmer than the others.
    const cardsUp = S.clamp(((mk.cards ?? 0) - 0.36) / 0.28, 0, 1);
    if (cardsUp > 0) S.light.glow(g, 1060, 752, 64, P.dawn, 0.3 * cardsUp);
  }

  // ── Webs (≥ 6 in at least 3 distinct shapes) ──────────────────────────

  function makeWebs() {
    const W = [];

    // 1. Chandelier arms to ceiling rose (big fan web)
    W.push(new S.Web({
      hub: [CHANDELIER.x, 195],
      anchors: [
        [CHANDELIER.x - 120, CEILING + 2],
        [CHANDELIER.x - 50, CEILING + 2],
        [CHANDELIER.x + 50, CEILING + 2],
        [CHANDELIER.x + 120, CEILING + 2],
        [CHANDELIER.x + 75, CHANDELIER.yBottom - 20],
        [CHANDELIER.x - 75, CHANDELIER.yBottom - 20],
      ],
      rings: 6,
      sheet: 0.55,
      seed: 51,
    }));

    // 2. Window upper corner
    W.push(new S.Web({
      hub: [WINDOW.x + 30, WINDOW.y + 35],
      anchors: [
        [WINDOW.x - 16, WINDOW.y - 12],
        [WINDOW.x + 110, WINDOW.y - 12],
        [WINDOW.x + 95, WINDOW.y + 90],
        [WINDOW.x - 16, WINDOW.y + 110],
      ],
      rings: 5,
      seed: 62,
    }));

    // 3. Between two candlesticks on table (between #2 and #3)
    W.push(new S.Web({
      hub: [895, TABLE.top - 50],
      anchors: [
        [CANDLESTICKS[1], TABLE.top - 70],
        [CANDLESTICKS[1], TABLE.top - 20],
        [CANDLESTICKS[2], TABLE.top - 20],
        [CANDLESTICKS[2], TABLE.top - 70],
      ],
      rings: 4,
      seed: 73,
    }));

    // 4. Under the table between legs (where the egg nest is cradled)
    W.push(new S.Web({
      hub: [980, 890],
      anchors: [
        [830, 850],
        [840, GROUND - 6],
        [1120, GROUND - 6],
        [1130, 850],
        [980, TABLE.hem],
      ],
      rings: 7,
      sheet: 0.65,
      seed: 84,
    }));

    // 5. China cabinet top corner
    W.push(new S.Web({
      hub: [CABINET.x0 + 35, CABINET.top + 30],
      anchors: [
        [CABINET.x0 - 20, CABINET.top - 10],
        [CABINET.x0 + 90, CABINET.top - 10],
        [CABINET.x0 + 80, CABINET.top + 80],
        [CABINET.x0 - 20, CABINET.top + 70],
      ],
      rings: 5,
      seed: 95,
    }));

    // 6. Plate rail to ceiling
    W.push(new S.Web({
      hub: [1180, 340],
      anchors: [
        [1130, CEILING + 4],
        [1240, CEILING + 4],
        [1250, PLATE_RAIL.y - 4],
        [1120, PLATE_RAIL.y - 4],
      ],
      rings: 6,
      sheet: 0.5,
      seed: 106,
    }));

    // 7. Sideboard left corner to wall
    W.push(new S.Web({
      hub: [SIDEBOARD.x0 + 20, SIDEBOARD.top - 30],
      anchors: [
        [SIDEBOARD.x0 - 15, SIDEBOARD.top - 90],
        [SIDEBOARD.x0 + 75, SIDEBOARD.top - 90],
        [SIDEBOARD.x0 + 70, SIDEBOARD.top],
        [SIDEBOARD.x0 - 15, SIDEBOARD.top],
      ],
      rings: 4,
      seed: 117,
    }));

    return W;
  }

  // ── Rules & Makeover Timeline ─────────────────────────────────────────

  const rules = {
    quota: 20,
    webGoal: 0.85,
    types: ['string', 'crawler', 'jumper'],
    spawnPattern: ['string', 'crawler', 'jumper', 'string', 'crawler', 'jumper', 'string', 'string'],
    maxAlive: [3, 4],
    spawnInterval: [2.3, 1.2],
    firstSpawn: 1.2,
  };

  const makeover = {
    beats: [
      { key: 'candle1', from: 3.30, to: 3.45, chime: 0 / 12 },
      { key: 'candle2', from: 3.55, to: 3.70, chime: 2 / 12 },
      { key: 'candle3', from: 3.80, to: 3.95, chime: 4 / 12 },
      { key: 'candle4', from: 4.05, to: 4.20, chime: 5 / 12 },
      { key: 'candle5', from: 4.30, to: 4.45, chime: 7 / 12 },
      { key: 'chandelier', from: 4.30, to: 4.60, ease: 'out' },
      { key: 'cabinetLight', from: 4.30, to: 4.60, ease: 'out' },
      { key: 'cards', from: 4.40, to: 5.00 },
    ],
    uniqueBeat: {
      key: 'candlesAndCards',
      at: 3.3,
      run(mk, t, fx) {
        // Flares when each candle lights
        const candleTimes = [3.30, 3.55, 3.80, 4.05, 4.30];
        for (let i = 0; i < candleTimes.length; i++) {
          const ct = candleTimes[i];
          if (t >= ct && t < ct + 0.08 && !mk.cues?.has(`flare${i}`)) {
            mk.cues?.add(`flare${i}`);
            fx.burst.sparkle(CANDLESTICKS[i], TABLE.top - 88, 4, P.ember);
          }
        }
        // Small paper flip sound when cards stand up
        for (let i = 0; i < PLACE_CARDS.length; i++) {
          const pt = 4.40 + i * 0.1;
          if (t >= pt && t < pt + 0.08 && !mk.cues?.has(`cardFlip${i}`)) {
            mk.cues?.add(`cardFlip${i}`);
            fx.sfx('tick', 0.22);
          }
        }
      },
    },
  };

  // ── Diegetic Sideboard Note ───────────────────────────────────────────

  function ensureNoteDom(world) {
    if (noteState.el && noteState.el.isConnected) return noteState.el;
    const frame = world.frameEl;
    if (!frame) return null;
    const el = document.createElement('div');
    el.className = 'dining-notes';
    el.setAttribute('aria-live', 'polite');
    frame.insertBefore(el, frame.querySelector('#hud') || null);
    noteState.el = el;
    return el;
  }

  function showSideboardNote(world) {
    const el = ensureNoteDom(world);
    if (!el) return;
    el.innerHTML = `
      <div class="dining-note is-pinned">
        <span class="dining-note__paper"></span>
        <span class="dining-note__pin"></span>
        <p class="dining-note__text">Under the table.<br>Don't let them hatch.</p>
        <p class="dining-note__sign">— A.</p>
      </div>
    `;
    noteState.torn = false;
    // Auto-tear after 6 seconds
    if (noteState.timer) clearTimeout(noteState.timer);
    noteState.timer = setTimeout(() => tearSideboardNote(world), 6000);
  }

  function tearSideboardNote(world) {
    if (noteState.torn) return;
    noteState.torn = true;
    if (noteState.timer) {
      clearTimeout(noteState.timer);
      noteState.timer = null;
    }
    const note = noteState.el?.querySelector('.dining-note');
    if (!note) return;
    note.classList.remove('is-pinned');
    note.classList.add('is-torn');

    const scrap = document.createElement('div');
    scrap.className = 'dining-scrap';
    scrap.innerHTML = '<span class="dining-scrap__paper"></span><span class="dining-scrap__pin"></span>';
    noteState.el?.appendChild(scrap);

    setTimeout(() => note.remove(), 700);
    setTimeout(() => scrap.remove(), 2200);
    if (world && world.sfx) world.sfx('rip', 0.25);
  }

  function removeNoteDom() {
    if (noteState.timer) {
      clearTimeout(noteState.timer);
      noteState.timer = null;
    }
    if (noteState.el) {
      noteState.el.remove();
      noteState.el = null;
    }
    noteState.torn = false;
  }

  // ── Egg Nest Spawning & Scoring ───────────────────────────────────────

  function spawnEggNest(world) {
    nestEggs = [];
    for (const spot of NEST_SPOTS) {
      const egg = world.spawnEgg(spot.x, spot.y, 'resting', {
        hatchAt: spot.hatchAt,
        count: 3,
        speed: 1.0,
        seed: spot.seed,
      });
      const origKill = egg.kill.bind(egg);
      egg.kill = function (w, how) {
        origKill(w, how);
        tearSideboardNote(world);
        return { bonus: 120, label: 'Nest!' };
      };
      nestEggs.push(egg);
    }
  }

  // ── QA Staging ────────────────────────────────────────────────────────

  const qa = {
    heroX: { dirty: 480, makeover: 480, clean: 480 }, // clear of the place cards
    action: {
      heroX: 720,
      strings: [
        { x: 640, targetY: 480 },
        { x: 1260, targetY: 520 },
      ],
      crawlers: [{ lair: { x: 1680, y: 350 } }],
      eggs: [{ x: 1260, y: 640 }],
      hatchlings: [{ x: 800, seed: 55 }],
      tear: { webs: 2, path: [140, 260, 420, 160] },
      kills: 10,
      score: 7240,
      nerve: 75,
      aimAt: { x: 640, y: 480 },
    },
    states: {
      // ART: blockout - The egg nest
      // The four nest eggs under the table at different hatch stages
      // (one about to hatch, visibly pulsing), the hero crouched on the floor aiming under
      // the table, a Jumper on the table.
      nest(api) {
        api.setState('playing');
        api.holdDirector();
        api.placeHero(700);
        const hero = api.hero;
        hero.facing = 1;

        // Stage 4 nest eggs at staggered maturities
        // Egg 1: age right before 14 -> about to hatch, visibly pulsing!
        const e1 = api.world.spawnEgg(865, 892, 'resting', { hatchAt: 14, count: 3, speed: 1.0, seed: 101 });
        e1.age = 13.72;
        e1.wobble = 0.95;
        // Egg 2: age 17 of 22 -> late stage pulsing
        const e2 = api.world.spawnEgg(925, 912, 'resting', { hatchAt: 22, count: 3, speed: 1.0, seed: 202 });
        e2.age = 17.0;
        // Egg 3: age 14 of 30 -> mid stage
        const e3 = api.world.spawnEgg(1025, 896, 'resting', { hatchAt: 30, count: 3, speed: 1.0, seed: 303 });
        e3.age = 14.0;
        // Egg 4: age 5 of 38 -> early stage
        const e4 = api.world.spawnEgg(1085, 916, 'resting', { hatchAt: 38, count: 3, speed: 1.0, seed: 404 });
        e4.age = 5.0;

        // Jumper crouched on the table
        api.spawn('jumper', {
          surface: 'table',
          x: 1160,
          state: 'crouch',
          crouch: 0.8,
          facing: -1,
          hold: 99,
        });

        // Hero crouched on floor aiming under table at the nest
        api.aimAt(950, 905);
        api.setScore({ score: 4860, kills: 6, eggs: 1, combo: 2 });
        api.step(0.05);
        // Ensure e1 is peak pulse right before hatch
        e1.age = 13.78;
        e1.wobble = 0.98;
        api.aimAt(950, 905);
      },
    },
  };

  // ── Registration & Hooks ──────────────────────────────────────────────

  S.rooms.register({
    id: 'dining-room',
    number: 5,
    act: 1,
    name: 'Dining Room',
    title: 'The Dining Room',
    css: 'rooms/dining-room/room.css',
    layout,
    paint,
    makeWebs,
    createLive,
    drawSky,
    drawProps,
    drawOnFurniture,
    lights,
    glow,
    shaftQuad,
    rules,
    makeover,
    storyObject: "Place cards for six. One says 'A.' — her chair was never pulled out.",
    qa,

    onStart(world, info) {
      livePlates = PLATES.map((x) => ({ x, wobble: 0, wobbleV: 0 }));

      // Plate rail wobble when hero lands on it
      world.on('land', ({ platform }) => {
        if (platform && platform.name === 'plate-rail') {
          const hx = world.hero.x;
          for (const p of livePlates) {
            const dist = Math.abs(hx - p.x);
            if (dist < 180) {
              p.wobbleV = (1 - dist / 180) * 0.22 * (hx < p.x ? 1 : -1);
            }
          }
        }
      });

      // Show note from "A." only on dirty or action/nest visit (never on clean, makeover, or results)
      const isCleanState = info && (info.qa === 'clean' || info.qa === 'results' || info.qa === 'makeover');
      if (!isCleanState) {
        showSideboardNote(world);
      } else {
        removeNoteDom();
      }

      // In real play or QA dirty/action, spawn the 4 nest eggs under the table
      if (!info || info.qa === 'dirty' || info.qa === 'action') {
        spawnEggNest(world);
      }

      // In action state, add a Jumper on the table
      if (info && info.qa === 'action') {
        world.spawn('jumper', {
          surface: 'table',
          x: 1140,
          state: 'crouch',
          crouch: 0.75,
          facing: -1,
          hold: 99,
        });
      }
    },

    onUpdate(dt, world) {
      // Plate wobble physics dampening
      for (const p of livePlates) {
        p.wobble += p.wobbleV;
        p.wobbleV -= p.wobble * 28 * dt;
        p.wobbleV *= Math.exp(-dt * 4.5);
      }
    },

    onLeave(world) {
      removeNoteDom();
    },
  });
})();
