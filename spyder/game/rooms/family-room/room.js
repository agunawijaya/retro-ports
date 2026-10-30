/*
 * Spyder — Room 3: the Family Room.
 *
 * A 1980s family room where the family gathered to watch television. Darker
 * and more intimate than the Living Room, with deep walnut and oak wood
 * panelling, a hand-laid brick chimney breast, a worn corduroy recliner,
 * venetian blinds casting striped moonlight across the parquet floor, and a
 * wood-grain console television that hisses with animated static.
 *
 * It follows the room contract in room-runtime.js:
 *   - Layout: low ceiling with exposed timber beam, wood panelling, fireplace,
 *     console TV, built-in bookshelf, armchair, and foreground diorama props.
 *   - Platforms: floor (935), armchair (790), mantel (600), TV stand shelf
 *     (780), TV top (600), and bookshelf top ledge (430). All within jump reach.
 *   - Lights: animated CRT static noise with random surges revealing corners,
 *     striped shafts of moonlight through venetian blinds with dust motes,
 *     breathing fireplace embers that catch fire into warm flames at makeover,
 *     plus picture light and foreground table lamp off until makeover.
 *   - Unique makeover beat: at t = 3.3 s embers glow and the fire catches over
 *     1.2 s (flames, sparks, fireplace web burns away, crackle sound); at
 *     t = 4.6 s the TV static vertically rolls into a sepia beach home movie.
 *   - Story object: the looping home movie on the TV showing the faded child.
 *   - Trace of previous cleaner: cracked flashlight on the mantel and a
 *     sticky note on the TV ("DON'T turn it off").
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const { paintShape, wobblyPath, rectPoints, roundedRectPoints, softShadow, stain } = S.paint;

  // ── Layout (stage units, 1920 × 1080) ───────────────────────────────────

  const CEILING = 100;
  const WALL_PAPER_BOTTOM = 470;
  const FLOOR_LINE = 770;
  const GROUND = 935;

  // Key furniture & architectural bounds
  const BEAM = { x0: 480, x1: 540, y0: 0, y1: 110 };
  const WINDOW = { x: 150, y: 170, w: 300, h: 310 };
  const CHIMNEY = { x0: 540, x1: 900, y0: 100, y1: 770 };
  const FIREBOX = { x0: 620, x1: 820, y0: 600, y1: 770 };
  const MANTEL = { x0: 560, x1: 880, y: 600, h: 22 };
  const HEARTH_STONE = { x0: 590, x1: 850, y0: 770, y1: 806 };
  const PAINTING = { x: 620, y: 240, w: 200, h: 180 };
  const PIC_LIGHT = { x: 680, y: 226, w: 80, h: 10 };

  const TV_CONSOLE = { x0: 1160, x1: 1420, y0: 600, y1: 850 };
  const TV_SHELF = { x0: 1150, x1: 1430, y: 780, h: 18 };
  const TV_SCREEN = { x: 1190, y: 630, w: 150, h: 110 };
  const TV_KNOBS = { x0: 1354, x1: 1406, y0: 632, y1: 742 };

  const BOOKSHELF = { x0: 1520, x1: 1800, y0: 310, y1: 850 };
  const ARMCHAIR = { x0: 200, x1: 430, seatY: 790, backTop: 620, floor: 852 };
  const RUG = { x0: 560, x1: 1360, y0: 840, y1: 1020 };

  // Foreground props (layer 5, out-of-focus, peek above/around HUD)
  const CUSHION = { x0: 60, x1: 260, y0: 950, y1: 1080 };
  const SIDE_TABLE = { x0: 1680, x1: 1880, y0: 870, y1: 1080 };
  const TABLE_LAMP = { x: 1760, y: 840 }; // Elevated so lamp shade is clearly visible at y 780–840

  // Wall details on the upper wall (x 900–1520, y 100–470)
  const WALL_CLOCK = { x: 1030, y: 240, r: 42 };
  const WALL_DUCKS = [
    { x: 1160, y: 210, s: 1.0 },
    { x: 1220, y: 245, s: 0.8 },
    { x: 1270, y: 285, s: 0.65 },
  ];
  const WALL_FRAME = { x: 1350, y: 230, w: 90, h: 110 };

  const layout = {
    name: 'Family Room',
    act: 1,
    number: 3,
    CEILING,
    FLOOR_LINE,
    GROUND,
    heroStart: 720,
    bounds: { left: 80, right: 1840 },
    platforms: [
      { name: 'floor', x0: 0, x1: 1920, y: GROUND, oneWay: false },
      { name: 'armchair', x0: 210, x1: 420, y: ARMCHAIR.seatY, oneWay: true },
      { name: 'mantel', x0: MANTEL.x0, x1: MANTEL.x1, y: MANTEL.y, oneWay: true },
      { name: 'tv-shelf', x0: TV_SHELF.x0, x1: TV_SHELF.x1, y: TV_SHELF.y, oneWay: true },
      { name: 'tv-top', x0: 1170, x1: 1410, y: TV_CONSOLE.y0, oneWay: true },
      { name: 'bookshelf', x0: 1530, x1: 1790, y: 430, oneWay: true },
    ],
    // Drop points avoid the exposed wooden beam (x 480–540) and chimney (x 540–900)
    dropPoints: [190, 280, 370, 450, 1010, 1120, 1260, 1420, 1580, 1720],
    hoverBand: [340, 620],
    // Wall-crawler lairs: behind TV, crack in chimney, behind bookshelf, gap above blinds
    lairs: [
      { x: 1290, y: 595, label: 'behind the TV' },
      { x: 720, y: 210, label: 'crack in the chimney breast' },
      { x: 1720, y: 480, label: 'behind the bookshelf' },
      { x: 300, y: 160, label: 'gap above the blinds' },
    ],
    wallArea: { x0: 80, x1: 1840, y0: CEILING + 20, y1: 720 },
    window: WINDOW,
    lookout: { x: WINDOW.x + WINDOW.w / 2, y: WINDOW.y + 130 },
    breakables: [{ x: 1300, y: GROUND, contains: 'coins' }],
  };

  // ── Palette and Surface Tones ──────────────────────────────────────────

  const TONE = {
    brick: S.mixHex(P.rust, P.taupe, 0.35),
    brickDark: S.mixHex(P.rust, P.soot, 0.52),
    brickPale: S.mixHex(P.rust, P.linen, 0.32),
    brickTerracotta: S.mixHex(P.rust, P.ember, 0.24),
    brickCharcoal: S.mixHex(P.soot, P.rust, 0.28),
    mortar: S.mixHex(P.linen, P.taupe, 0.52),
    panelBase: S.mixHex(P.walnut, P.oak, 0.45),
    panelShadow: S.shadeHex(P.walnut, -0.32),
    wallpaperBase: S.mixHex(P.linen, P.taupe, 0.22),
    wallpaperRust: S.mixHex(P.rust, P.linen, 0.5),
    parquetLight: S.mixHex(P.oak, P.linen, 0.18),
    parquetDark: S.mixHex(P.walnut, P.oak, 0.3),
    corduroy: S.mixHex(P.rust, P.walnut, 0.55),
    corduroyHighlight: S.mixHex(P.rust, P.oak, 0.35),
    dustSheet: S.mixHex(P.linen, P.taupe, 0.38),
    consoleWood: S.mixHex(P.walnut, P.oak, 0.6),
    tvScreenBg: '#10151C',
    shagRug: S.mixHex(S.mixHex(P.rust, P.taupe, 0.3), P.oak, 0.12),
    sepiaHigh: '#F8EED9',
    sepiaMid: '#C89E66',
    sepiaDeep: '#3E2516',
  };

  function aged(hex, clean, factor = 1) {
    if (clean) return hex;
    return S.mixHex(S.shadeHex(hex, -0.22 * factor), P.taupe, 0.2 * factor);
  }

  // ── Painting Layers (Static Art Cached in Dirty & Clean) ────────────────

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

  // ── Layer 2: Back (Walls, Floor, Chimney, Window Frame, Wall Decor) ─────

  function paintBack(g, clean) {
    paintCeiling(g, clean);
    paintWallpaper(g, clean);
    paintWoodPanelling(g, clean);
    paintParquetFloor(g, clean);
    paintWindowFrame(g, clean);
    paintChimneyBreast(g, clean);
    paintExposedBeam(g, clean);
    paintWallDecor(g, clean);
    if (!clean) paintBackGrime(g);
  }

  function paintCeiling(g, clean) {
    paintShape(g, rectPoints(0, 0, 1920, CEILING + 2), {
      color: aged(S.mixHex(P.linen, P.taupe, 0.3), clean, 0.7),
      lightDir: { x: 0, y: 1 },
      light: 0.15,
      shadow: 0.45,
      strokes: 8,
      strokeAngle: 0,
      strokeJitter: 0.8,
      rim: 0,
      wobble: 0,
      seed: 501,
    });
    // Dark brown cornice / ceiling trim moulding
    const trimColor = aged(P.walnut, clean);
    g.fillStyle = S.rgba(P.soot, 0.6);
    g.fillRect(0, CEILING - 3, 1920, 4);
    g.fillStyle = trimColor;
    g.fillRect(0, CEILING - 14, 1920, 11);
    g.fillStyle = S.rgba(P.linen, 0.14);
    g.fillRect(0, CEILING - 14, 1920, 2);
  }

  function paintExposedBeam(g, clean) {
    // Heavy timber ceiling beam across the ceiling (front-to-back perspective projection)
    const col = aged(S.shadeHex(P.walnut, -0.15), clean);
    const pts = [
      [BEAM.x0, 0],
      [BEAM.x1, 0],
      [BEAM.x1 + 6, BEAM.y1],
      [BEAM.x0 - 4, BEAM.y1],
    ];
    paintShape(g, pts, {
      color: col,
      lightDir: { x: -0.6, y: -0.8 },
      light: 0.22,
      shadow: 0.48,
      strokes: 14,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.08,
      rim: 0.3,
      wobble: 1.2,
      seed: 503,
    });
    // Wood grain lines along the beam
    g.save();
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.clip();
    const rng = S.createRng(504);
    for (let i = 0; i < 9; i++) {
      g.strokeStyle = S.rgba(P.soot, rng.range(0.2, 0.45));
      g.lineWidth = rng.range(1, 2.4);
      g.beginPath();
      const bx = BEAM.x0 + rng.range(6, BEAM.x1 - BEAM.x0 - 6);
      g.moveTo(bx, 0);
      g.lineTo(bx + rng.range(-3, 3), BEAM.y1);
      g.stroke();
    }
    // Corbels / mounting bracket where the beam meets ceiling
    g.fillStyle = S.rgba(P.soot, 0.5);
    g.fillRect(BEAM.x0 - 8, BEAM.y1 - 6, BEAM.x1 - BEAM.x0 + 16, 6);
    g.restore();
  }

  function paintWallpaper(g, clean) {
    // 1980s muted vertical striped wallpaper (cream and faded rust, alpha 0.2–0.3)
    const base = aged(TONE.wallpaperBase, clean, 0.9);
    paintShape(g, rectPoints(0, CEILING, 1920, WALL_PAPER_BOTTOM - CEILING), {
      color: base,
      lightDir: { x: 0.2, y: -0.9 },
      light: 0.12,
      shadow: 0.28,
      strokes: 10,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.1,
      variance: 0.06,
      rim: 0,
      wobble: 0,
      seed: 510,
    });

    g.save();
    g.beginPath();
    g.rect(0, CEILING, 1920, WALL_PAPER_BOTTOM - CEILING);
    g.clip();

    // Stripes: a broad faded-rust band and a thin cream pinstripe every
    // 46 px. Low contrast (ART-DIRECTION §4), but it has to read as paper.
    const band = clean ? TONE.wallpaperRust : S.mixHex(TONE.wallpaperRust, P.taupe, 0.35);
    const pin = clean ? P.bone : S.mixHex(P.linen, P.taupe, 0.4);
    const wallH = WALL_PAPER_BOTTOM - CEILING;
    const srng = S.createRng(512);
    for (let x = 6; x < 1920; x += 46) {
      g.fillStyle = S.rgba(band, clean ? 0.27 : 0.23);
      g.fillRect(x, CEILING, 12, wallH);
      g.fillStyle = S.rgba(pin, clean ? 0.24 : 0.15);
      g.fillRect(x + 23, CEILING, 2, wallH);
      // The print is not perfect: the band drifts and fades a little.
      g.fillStyle = S.rgba(P.linen, srng.range(0.02, 0.06));
      g.fillRect(x + srng.range(-1, 2), CEILING + srng.range(0, wallH * 0.5), 12, srng.range(40, 160));
    }
    // Sun-faded at the top, darker where the paper meets the panelling.
    const fade = g.createLinearGradient(0, CEILING, 0, WALL_PAPER_BOTTOM);
    fade.addColorStop(0, S.rgba(P.soot, clean ? 0.14 : 0.26));
    fade.addColorStop(0.25, S.rgba(P.soot, 0));
    fade.addColorStop(0.85, S.rgba(P.soot, 0));
    fade.addColorStop(1, S.rgba(P.soot, clean ? 0.12 : 0.2));
    g.fillStyle = fade;
    g.fillRect(0, CEILING, 1920, wallH);
    // Occasional subtle roll seams
    g.strokeStyle = S.rgba(P.taupe, 0.14);
    g.lineWidth = 1;
    for (let x = 160; x < 1920; x += 320) {
      g.beginPath();
      g.moveTo(x, CEILING);
      g.lineTo(x, WALL_PAPER_BOTTOM);
      g.stroke();
    }
    g.restore();
  }

  function paintWoodPanelling(g, clean) {
    // Vertical tongue-and-groove wood panelling (planks 48 px wide, grain strokes, lit edge)
    const y0 = WALL_PAPER_BOTTOM;
    const h = FLOOR_LINE - y0;
    const baseWood = aged(TONE.panelBase, clean);

    paintShape(g, rectPoints(0, y0, 1920, h), {
      color: baseWood,
      lightDir: { x: -0.4, y: -0.8 },
      light: 0.18,
      shadow: 0.35,
      strokes: 12,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.05,
      rim: 0,
      wobble: 0,
      seed: 520,
    });

    // Draw individual 48 px planks with bevels, grain, and subtle knots
    const plankW = 48;
    const plankCount = Math.ceil(1920 / plankW);
    const rng = S.createRng(521);

    for (let i = 0; i < plankCount; i++) {
      const px = i * plankW;
      const plankTone = S.mixHex(baseWood, rng.next() > 0.5 ? P.oak : P.walnut, rng.range(0.08, 0.28));

      // Subtle plank body tint
      g.fillStyle = S.rgba(plankTone, 0.24);
      g.fillRect(px, y0, plankW, h);

      // Lit bevel edge on left (towards room's light) & dark shadow groove on right
      g.fillStyle = S.rgba(P.linen, clean ? 0.16 : 0.1);
      g.fillRect(px + 1, y0, 1.5, h);

      g.fillStyle = S.rgba(P.soot, 0.48);
      g.fillRect(px + plankW - 2, y0, 2, h);
      g.fillStyle = S.rgba(P.soot, 0.25);
      g.fillRect(px + plankW - 3, y0, 1, h);

      // Wood grain lines
      g.save();
      g.beginPath();
      g.rect(px, y0, plankW, h);
      g.clip();
      const grainCount = Math.floor(rng.range(3, 7));
      for (let gIdx = 0; gIdx < grainCount; gIdx++) {
        const gx = px + rng.range(4, plankW - 6);
        g.strokeStyle = S.rgba(S.shadeHex(plankTone, -0.32), rng.range(0.12, 0.3));
        g.lineWidth = rng.range(0.9, 1.8);
        g.beginPath();
        g.moveTo(gx, y0);
        g.bezierCurveTo(gx + rng.range(-4, 4), y0 + h * 0.35, gx + rng.range(-5, 5), y0 + h * 0.7, gx + rng.range(-3, 3), y0 + h);
        g.stroke();
      }
      // Occasional small wood knot
      if (rng.next() < 0.25) {
        const kx = px + rng.range(12, plankW - 14);
        const ky = y0 + rng.range(40, h - 40);
        g.strokeStyle = S.rgba(P.soot, 0.5);
        g.lineWidth = 1.3;
        g.beginPath();
        g.ellipse(kx, ky, 7, 13, rng.range(-0.15, 0.15), 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = S.rgba(S.shadeHex(P.walnut, -0.4), 0.7);
        g.beginPath();
        g.ellipse(kx, ky, 3.5, 6.5, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    // Chair rail moulding at y = 470 (beveled wood)
    paintShape(g, rectPoints(0, y0 - 6, 1920, 14), {
      color: S.shadeHex(baseWood, 0.12),
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.4,
      strokes: 6,
      strokeAngle: 0,
      rim: 0.4,
      wobble: 0.5,
      seed: 525,
    });
    g.fillStyle = S.rgba(P.soot, 0.4);
    g.fillRect(0, y0 + 8, 1920, 5);

    // Skirting board / baseboard at y = 750–770
    const skirtGrad = g.createLinearGradient(0, FLOOR_LINE - 20, 0, FLOOR_LINE);
    skirtGrad.addColorStop(0, S.shadeHex(baseWood, 0.05));
    skirtGrad.addColorStop(1, S.shadeHex(baseWood, -0.42));
    g.fillStyle = skirtGrad;
    g.fillRect(0, FLOOR_LINE - 20, 1920, 20);
    g.fillStyle = S.rgba(P.linen, 0.1);
    g.fillRect(0, FLOOR_LINE - 20, 1920, 2);
    g.fillStyle = S.rgba(P.soot, 0.5);
    g.fillRect(0, FLOOR_LINE - 2, 1920, 2);
  }

  function paintParquetFloor(g, clean) {
    // Wide boards in the reference's one-point perspective (vanishing point
    // above the room, as in the Living Room), each board its own tone, with
    // seams, a lit edge, staggered joints and grain.
    const vp = { x: 960, y: -900 };
    const top = FLOOR_LINE;
    const bottom = 1080;
    const base = clean ? S.mixHex(P.oak, P.walnut, 0.28) : S.mixHex(P.walnut, P.oak, 0.42);
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
      seed: 530,
    });

    const xAt = (xBottom, y) => vp.x + (xBottom - vp.x) * ((y - vp.y) / (bottom - vp.y));
    const rng = S.createRng(531);
    const boardW = 150;
    for (let xb = -360; xb < 2300; xb += boardW) {
      // Each board slightly lighter or darker than its neighbours.
      g.fillStyle = S.rgba(S.shadeHex(base, rng.range(-0.14, 0.1)), clean ? 0.55 : 0.45);
      g.beginPath();
      g.moveTo(xAt(xb, top), top);
      g.lineTo(xAt(xb + boardW, top), top);
      g.lineTo(xb + boardW, bottom);
      g.lineTo(xb, bottom);
      g.closePath();
      g.fill();
      // Grain streaks running along the board.
      for (let k = 0; k < 5; k++) {
        const f = rng.range(0.12, 0.88);
        g.strokeStyle = S.rgba(k % 2 ? P.soot : P.linen, rng.range(0.04, 0.1));
        g.lineWidth = rng.range(0.8, 1.8);
        g.beginPath();
        g.moveTo(xAt(xb + boardW * f, top), top);
        g.quadraticCurveTo(xAt(xb + boardW * f, 930) + rng.range(-4, 4), 930, xb + boardW * f + rng.range(-8, 8), bottom);
        g.stroke();
      }
      // Seam, and a faint lit edge beside it.
      g.strokeStyle = S.rgba(P.soot, 0.6);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(xAt(xb, top), top);
      g.lineTo(xb, bottom);
      g.stroke();
      g.strokeStyle = 'rgba(255,220,180,0.07)';
      g.beginPath();
      g.moveTo(xAt(xb, top) + 2, top);
      g.lineTo(xb + 3, bottom);
      g.stroke();
      // Staggered butt joints, further apart toward the viewer.
      let y = top + rng.range(10, 110);
      while (y < bottom) {
        g.strokeStyle = S.rgba(P.soot, 0.5);
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(xAt(xb, y), y);
        g.lineTo(xAt(xb + boardW, y), y);
        g.stroke();
        y += rng.range(140, 260) * ((y - vp.y) / (bottom - vp.y));
      }
    }

    // A polished sheen in front of the hearth, where the fire's light pools.
    const sheen = g.createRadialGradient(720, 900, 20, 720, 900, 640);
    sheen.addColorStop(0, S.rgba(P.dawn, clean ? 0.16 : 0.05));
    sheen.addColorStop(1, S.rgba(P.dawn, 0));
    g.fillStyle = sheen;
    g.fillRect(0, top, 1920, bottom - top);

    if (!clean) {
      // Years of dust: fluff along the skirting, a grey film over the boards.
      const drng = S.createRng(533);
      for (let i = 0; i < 260; i++) {
        const x = drng.range(0, 1920);
        const y = top + Math.pow(drng.next(), 2.2) * (bottom - top);
        g.fillStyle = S.rgba(P.linen, drng.range(0.04, 0.12));
        g.beginPath();
        g.ellipse(x, y, drng.range(2, 7), drng.range(1, 2.5), 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = S.rgba(P.taupe, 0.12);
      g.fillRect(0, top, 1920, bottom - top);
    }

    // Contact shadow where the floor meets the panelling.
    const join = g.createLinearGradient(0, top, 0, top + 30);
    join.addColorStop(0, S.rgba(P.soot, 0.5));
    join.addColorStop(1, S.rgba(P.soot, 0));
    g.fillStyle = join;
    g.fillRect(0, top, 1920, 30);

    // The floor falls into shadow toward the viewer's corners.
    const vGrad = g.createRadialGradient(960, 820, 300, 960, 920, 1000);
    vGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vGrad.addColorStop(1, S.rgba(P.soot, clean ? 0.3 : 0.4));
    g.fillStyle = vGrad;
    g.fillRect(0, top, 1920, bottom - top);
  }

  function paintWindowFrame(g, clean) {
    // Window with venetian blinds at x 150–450, y 170–480
    const { x, y, w, h } = WINDOW;
    // Outer wooden casing with bevels
    paintShape(g, rectPoints(x - 18, y - 18, w + 36, h + 36), {
      color: aged(P.walnut, clean),
      lightDir: { x: 0.8, y: 0.6 },
      light: 0.22,
      shadow: 0.42,
      strokes: 10,
      strokeAngle: Math.PI / 2,
      rim: 0.25,
      wobble: 1,
      seed: 540,
    });

    // Window sill platform ledge at bottom
    paintShape(g, rectPoints(x - 24, y + h, w + 48, 22), {
      color: aged(S.shadeHex(P.walnut, 0.1), clean),
      lightDir: { x: 0, y: -1 },
      light: 0.32,
      shadow: 0.38,
      strokes: 6,
      strokeAngle: 0,
      rim: 0.35,
      wobble: 0.8,
      seed: 541,
    });
    g.fillStyle = S.rgba(P.soot, 0.45);
    g.fillRect(x - 20, y + h + 22, w + 40, 6);

    // Venetian blinds
    paintBlinds(g, clean);
  }

  function paintBlinds(g, clean) {
    const { x, y, w, h } = WINDOW;
    const slatCount = 18;
    const slatH = 12;
    const slatGap = (h - 20) / slatCount;
    const slatColor = clean ? P.linen : aged(P.linen, false, 1.2);

    g.save();
    // Headrail box at top of blinds
    g.fillStyle = aged(S.mixHex(P.linen, P.taupe, 0.5), clean);
    g.fillRect(x + 4, y + 4, w - 8, 14);
    g.fillStyle = S.rgba(P.soot, 0.4);
    g.fillRect(x + 4, y + 18, w - 8, 3);

    // Two vertical ladder cords
    const cordX1 = x + w * 0.25;
    const cordX2 = x + w * 0.75;
    g.strokeStyle = S.rgba(P.taupe, 0.4);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(cordX1, y + 16);
    g.lineTo(cordX1, y + h - 8);
    g.moveTo(cordX2, y + 16);
    g.lineTo(cordX2, y + h - 8);
    g.stroke();

    for (let i = 0; i < slatCount; i++) {
      const sy = y + 20 + i * slatGap;

      if (!clean) {
        // Dirty: blinds hang crooked (~3.5 deg tilt), two broken/bent slats with a gap
        if (i === 6) continue; // Gap: slat 6 missing/fallen, letting brighter moonlight through!
        let tilt = 0.055; // Crooked overall
        let offY = 0;
        let broken = false;

        if (i === 11) {
          // Bent/broken slat drooping
          tilt = -0.09;
          offY = 8;
          broken = true;
        } else if (i === 14) {
          // Second damaged slat (cracked on right)
          tilt = 0.08;
          offY = -3;
          broken = true;
        }

        g.save();
        g.translate(x + w * 0.5, sy + offY);
        g.rotate(tilt);

        // Individual slat
        g.fillStyle = slatColor;
        g.fillRect(-w * 0.5 + 8, -slatH * 0.5, w - 16, slatH);

        // Lower lip in shadow, upper lip catching moon
        g.fillStyle = S.rgba(P.soot, 0.35);
        g.fillRect(-w * 0.5 + 8, slatH * 0.5 - 2.5, w - 16, 2.5);
        g.fillStyle = S.rgba(P.moon, 0.25);
        g.fillRect(-w * 0.5 + 8, -slatH * 0.5, w - 16, 1.5);

        if (broken) {
          // Visible snap crack in the slat
          g.strokeStyle = S.rgba(P.soot, 0.85);
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(-20, -slatH * 0.5);
          g.lineTo(-12, slatH * 0.5);
          g.stroke();
        }
        g.restore();
      } else {
        // Clean: straight, whole, neat horizontal slats
        g.fillStyle = slatColor;
        g.fillRect(x + 8, sy, w - 16, slatH);
        g.fillStyle = S.rgba(P.soot, 0.2);
        g.fillRect(x + 8, sy + slatH - 2, w - 16, 2);
        g.fillStyle = S.rgba(P.bone, 0.3);
        g.fillRect(x + 8, sy, w - 16, 1.5);
      }
    }
    g.restore();
  }

  function paintChimneyBreast(g, clean) {
    // Brick chimney breast (x 540–900, y 100–770)
    const { x0, x1, y0, y1 } = CHIMNEY;
    const w = x1 - x0;
    const h = y1 - y0;

    // Contact drop shadow onto wallpaper/panelling
    softShadow(g, x0 + w * 0.5, y0 + h * 0.5, w + 16, h, 0.45);

    // Chimney mortar backing bed
    paintShape(g, rectPoints(x0, y0, w, h), {
      color: aged(TONE.mortar, clean, 0.8),
      lightDir: { x: -0.5, y: -0.7 },
      light: 0.15,
      shadow: 0.4,
      strokes: 10,
      strokeAngle: 0,
      rim: 0.2,
      wobble: 1.2,
      seed: 550,
    });

    // Individual bricks with wobbly mortar & natural terracotta variation
    const brickH = 20;
    const brickW = 52;
    const mortarGap = 4;
    const rows = Math.floor(h / (brickH + mortarGap));
    const rng = S.createRng(551);

    g.save();
    g.beginPath();
    g.rect(x0, y0, w, h);
    g.clip();

    for (let r = 0; r < rows; r++) {
      const by = y0 + r * (brickH + mortarGap);
      const isShifted = r % 2 === 1;
      const startX = x0 + (isShifted ? -brickW * 0.5 : 0);

      for (let bx = startX; bx < x1 + brickW * 0.5; bx += brickW + mortarGap) {
        // Skip bricks inside the firebox opening (x 620–820, y 600–770)
        if (bx + brickW > FIREBOX.x0 && bx < FIREBOX.x1 && by + brickH > FIREBOX.y0 && by < FIREBOX.y1) {
          continue;
        }

        const roll = rng.next();
        const bColor = roll > 0.82
          ? TONE.brickCharcoal
          : roll > 0.65
            ? TONE.brickDark
            : roll > 0.45
              ? TONE.brickTerracotta
              : roll > 0.25
                ? TONE.brickPale
                : TONE.brick;

        const brickPts = roundedRectPoints(bx, by, brickW, brickH, 2.5);
        paintShape(g, brickPts, {
          color: aged(bColor, clean),
          lightDir: { x: -0.4, y: -0.8 },
          light: 0.18,
          shadow: 0.34,
          strokes: 5,
          strokeAngle: rng.range(-0.25, 0.25),
          rim: 0.2,
          wobble: 1.1,
          seed: 552 + r * 17 + Math.floor(bx),
        });
      }
    }

    // Soot stains above firebox opening (dirty)
    if (!clean) {
      stain(g, (FIREBOX.x0 + FIREBOX.x1) * 0.5, FIREBOX.y0 - 24, 75, P.soot, 18, 0.55);
      stain(g, (FIREBOX.x0 + FIREBOX.x1) * 0.5 - 35, FIREBOX.y0 - 45, 50, P.soot, 14, 0.42);
      stain(g, (FIREBOX.x0 + FIREBOX.x1) * 0.5 + 40, FIREBOX.y0 - 50, 52, P.soot, 0.4);
    }
    g.restore();

    // Heavy slate/stone hearth slab on the floor (x 590–850, y 770–806)
    paintHearthStone(g, clean);

    // Firebox cavity (x 620–820, y 600–770)
    paintFirebox(g, clean);

    // Mantel shelf (x 560–880 at y 600)
    paintMantelShelf(g, clean);

    // Seascape painting above mantel (x 620–820, y 240–420)
    paintPainting(g, clean);
  }

  function paintHearthStone(g, clean) {
    const { x0, x1, y0, y1 } = HEARTH_STONE;
    paintShape(g, roundedRectPoints(x0, y0, x1 - x0, y1 - y0, 4), {
      color: aged(S.mixHex(P.gear, P.taupe, 0.4), clean),
      lightDir: { x: 0, y: -1 },
      light: 0.25,
      shadow: 0.4,
      strokes: 8,
      strokeAngle: 0,
      rim: 0.3,
      wobble: 0.6,
      seed: 556,
    });
    g.fillStyle = S.rgba(P.soot, 0.45);
    g.fillRect(x0 + 4, y1 - 2, x1 - x0 - 8, 4);
  }

  function paintFirebox(g, clean) {
    const { x0, x1, y0, y1 } = FIREBOX;
    const fw = x1 - x0;
    const fh = y1 - y0;

    // Deep black interior with arched or square firebrick lining
    g.fillStyle = S.rgba(P.soot, 0.96);
    g.fillRect(x0, y0, fw, fh);

    // Angled interior side firebricks catching light
    const sideG = g.createLinearGradient(x0, y0, x0 + 24, y0);
    sideG.addColorStop(0, S.rgba(P.soot, 0.9));
    sideG.addColorStop(1, S.rgba(P.taupe, 0.18));
    g.fillStyle = sideG;
    g.fillRect(x0, y0, 24, fh);

    const sideG2 = g.createLinearGradient(x1, y0, x1 - 24, y0);
    sideG2.addColorStop(0, S.rgba(P.soot, 0.9));
    sideG2.addColorStop(1, S.rgba(P.taupe, 0.18));
    g.fillStyle = sideG2;
    g.fillRect(x1 - 24, y0, 24, fh);

    // Iron lintel arch / trim around opening
    g.strokeStyle = S.rgba(P.gear, 0.85);
    g.lineWidth = 5;
    g.strokeRect(x0 - 2, y0 - 2, fw + 4, fh + 2);

    // Cast iron grate and andirons
    const grateY = y1 - 24;
    g.fillStyle = P.gear;
    g.fillRect(x0 + 20, grateY, fw - 40, 10);
    // Grate legs
    g.fillRect(x0 + 26, grateY, 8, 22);
    g.fillRect(x1 - 34, grateY, 8, 22);
    // Vertical iron bars
    for (let bx = x0 + 36; bx < x1 - 36; bx += 18) {
      g.fillRect(bx, grateY - 14, 5, 20);
    }

    // Fireplace logs
    const logPts1 = roundedRectPoints(x0 + 30, grateY - 26, fw - 60, 20, 6);
    paintShape(g, logPts1, {
      color: aged(P.walnut, clean),
      lightDir: { x: 0, y: -1 },
      light: 0.15,
      shadow: 0.4,
      strokes: 6,
      strokeAngle: 0,
      rim: 0.15,
      wobble: 1.2,
      seed: 560,
    });

    const logPts2 = roundedRectPoints(x0 + 44, grateY - 42, fw - 88, 18, 5);
    paintShape(g, logPts2, {
      color: aged(S.mixHex(P.walnut, P.oak, 0.4), clean),
      lightDir: { x: 0, y: -1 },
      light: 0.2,
      shadow: 0.35,
      strokes: 5,
      strokeAngle: 0,
      rim: 0.2,
      wobble: 1.1,
      seed: 561,
    });

    // Firebox contents:
    // Dirty: cold grey ash bed with faint glowing embers
    // Clean: logs ready with warm embers / flames handled in live loop
    g.fillStyle = clean ? S.rgba(P.taupe, 0.5) : S.rgba(P.taupe, 0.8);
    g.beginPath();
    g.ellipse((x0 + x1) * 0.5, y1 - 6, fw * 0.42, 10, 0, 0, Math.PI * 2);
    g.fill();
  }

  function paintMantelShelf(g, clean) {
    const { x0, x1, y, h } = MANTEL;
    const w = x1 - x0;
    const wood = aged(S.mixHex(P.walnut, P.oak, 0.5), clean);

    // Mantel shelf timber
    paintShape(g, rectPoints(x0, y, w, h), {
      color: wood,
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.4,
      strokes: 10,
      strokeAngle: 0,
      rim: 0.4,
      wobble: 0.8,
      seed: 570,
    });
    // Heavy drop shadow under the mantel onto the brickwork
    g.fillStyle = S.rgba(P.soot, 0.55);
    g.fillRect(x0 + 4, y + h, w - 8, 8);

    // Two decorative wooden supporting corbels
    [x0 + 36, x1 - 56].forEach((cx) => {
      const corbelPts = [
        [cx, y + h],
        [cx + 20, y + h],
        [cx + 16, y + h + 36],
        [cx + 4, y + h + 36],
      ];
      paintShape(g, corbelPts, {
        color: S.shadeHex(wood, -0.15),
        lightDir: { x: -0.5, y: -0.8 },
        light: 0.2,
        shadow: 0.4,
        strokes: 4,
        rim: 0.2,
        seed: 572 + cx,
      });
    });

    // Trace of previous cleaner: flashlight on the mantel
    // Dirty: lying on its side at x = 600 with cracked lens
    // Clean: standing upright at x = 590
    paintFlashlight(g, clean);
  }

  function paintFlashlight(g, clean) {
    g.save();
    if (!clean) {
      // Lying on its side on the mantel, lens cracked
      g.translate(615, MANTEL.y - 7);
      g.rotate(0.06);
      softShadow(g, 0, 4, 38, 12, 0.45);
      // Aluminium body
      g.fillStyle = S.mixHex(P.gear, P.bone, 0.35);
      g.fillRect(-18, -4, 28, 8);
      // Fluted knurling grip
      g.fillStyle = S.rgba(P.soot, 0.4);
      for (let i = -14; i < 6; i += 4) g.fillRect(i, -4, 1.5, 8);
      // Bezel head
      g.fillStyle = S.mixHex(P.gear, P.bone, 0.6);
      g.beginPath();
      g.moveTo(10, -7);
      g.lineTo(20, -9);
      g.lineTo(20, 9);
      g.lineTo(10, 7);
      g.closePath();
      g.fill();
      // Cracked glass lens with glint
      g.strokeStyle = S.rgba(P.bone, 0.85);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(20, -5);
      g.lineTo(16, 2);
      g.lineTo(20, 6);
      g.stroke();
    } else {
      // Clean: standing upright neatly on the mantel
      g.translate(595, MANTEL.y - 18);
      softShadow(g, 0, 18, 16, 6, 0.4);
      // Cylindrical body
      g.fillStyle = S.mixHex(P.gear, P.bone, 0.4);
      g.fillRect(-5, -12, 10, 28);
      // Knurling
      g.fillStyle = S.rgba(P.soot, 0.35);
      for (let i = -8; i < 12; i += 3.5) g.fillRect(-5, i, 10, 1.2);
      // Bezel at top
      g.fillStyle = S.mixHex(P.gear, P.bone, 0.65);
      g.fillRect(-7, -16, 14, 5);
      g.fillStyle = S.rgba(P.linen, 0.8);
      g.fillRect(-6, -17, 12, 1.5);
    }
    g.restore();
  }

  function paintPainting(g, clean) {
    const { x, y, w, h } = PAINTING;
    // Gilded antique picture frame
    paintShape(g, rectPoints(x - 14, y - 14, w + 28, h + 28), {
      color: aged(P.brass, clean, 0.8),
      lightDir: { x: -0.4, y: -0.8 },
      light: 0.3,
      shadow: 0.38,
      strokes: 8,
      strokeAngle: 0,
      rim: 0.35,
      wobble: 0.8,
      seed: 580,
    });
    g.fillStyle = S.rgba(P.soot, 0.5);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);

    // Canvas contents:
    // Dirty: dark grimy varnish, barely discernible shapes
    // Clean: clear seascape at dusk (golden-purple dusk sky, painterly sea waves)
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();

    if (!clean) {
      // The same dusk seascape under fifteen years of yellowed varnish and
      // soot. Darker and browner than the clean one, but the value structure
      // is kept: a glowing horizon band, a lighter sky than sea, and a pale
      // sail against the horizon, so it still reads as a painting of the sea.
      const sky = g.createLinearGradient(x, y, x, y + h * 0.56);
      sky.addColorStop(0, S.mixHex(P.umber, P.walnut, 0.5));
      sky.addColorStop(0.65, S.mixHex(S.mixHex(P.oak, P.rust, 0.35), P.linen, 0.2));
      sky.addColorStop(1, S.mixHex(P.linen, P.oak, 0.45));
      g.fillStyle = sky;
      g.fillRect(x, y, w, h * 0.56);

      // The low sun under the varnish: a dull amber smear above the horizon.
      const sun = g.createRadialGradient(x + w * 0.3, y + h * 0.53, 2, x + w * 0.3, y + h * 0.53, w * 0.45);
      sun.addColorStop(0, S.rgba(S.mixHex(P.dawn, P.oak, 0.45), 0.75));
      sun.addColorStop(1, S.rgba(P.oak, 0));
      g.fillStyle = sun;
      g.fillRect(x, y, w, h * 0.56);

      const sea = g.createLinearGradient(x, y + h * 0.56, x, y + h);
      sea.addColorStop(0, S.mixHex(S.mixHex(P.moon, P.taupe, 0.55), P.oak, 0.25));
      sea.addColorStop(1, S.mixHex(P.taupe, P.umber, 0.6));
      g.fillStyle = sea;
      g.fillRect(x, y + h * 0.56, w, h * 0.44);

      // The horizon itself, a thin bright line, and the sun's track on the water.
      g.fillStyle = S.rgba(S.mixHex(P.dawn, P.linen, 0.5), 0.5);
      g.fillRect(x, y + h * 0.555, w, 2);
      for (let k = 0; k < 6; k++) {
        g.fillStyle = S.rgba(P.linen, 0.22 - k * 0.03);
        g.fillRect(x + w * 0.3 - 18 + k * 2, y + h * (0.6 + k * 0.06), 36 - k * 4, 2);
      }

      // Wave crests, faint through the varnish.
      g.strokeStyle = S.rgba(P.linen, 0.22);
      g.lineWidth = 1.2;
      for (let wy = y + h * 0.64; wy < y + h; wy += 16) {
        g.beginPath();
        for (let wx = x; wx <= x + w; wx += 12) {
          const cy = wy + Math.sin(wx * 0.08 + wy) * 2;
          if (wx === x) g.moveTo(wx, cy);
          else g.lineTo(wx, cy);
        }
        g.stroke();
      }

      // The sailboat: a dark hull, and a sail pale enough to catch the eye.
      g.fillStyle = S.rgba(P.soot, 0.8);
      g.beginPath();
      g.moveTo(x + w * 0.6, y + h * 0.58);
      g.lineTo(x + w * 0.76, y + h * 0.58);
      g.lineTo(x + w * 0.72, y + h * 0.62);
      g.lineTo(x + w * 0.63, y + h * 0.62);
      g.closePath();
      g.fill();
      g.fillStyle = S.rgba(S.mixHex(P.linen, P.oak, 0.3), 0.9);
      g.beginPath();
      g.moveTo(x + w * 0.68, y + h * 0.57);
      g.lineTo(x + w * 0.68, y + h * 0.36);
      g.lineTo(x + w * 0.75, y + h * 0.56);
      g.closePath();
      g.fill();
      g.strokeStyle = S.rgba(P.soot, 0.7);
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x + w * 0.68, y + h * 0.59);
      g.lineTo(x + w * 0.68, y + h * 0.34);
      g.stroke();

      // Yellowed varnish over all of it, darkest at the edges where the
      // frame's dust settled, and a craquelure of fine cracks.
      g.fillStyle = S.rgba(S.mixHex(P.oak, P.umber, 0.5), 0.18);
      g.fillRect(x, y, w, h);
      const edge = g.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
      edge.addColorStop(0, 'rgba(0,0,0,0)');
      edge.addColorStop(1, S.rgba(P.soot, 0.42));
      g.fillStyle = edge;
      g.fillRect(x, y, w, h);
      const crng = S.createRng(586);
      g.strokeStyle = S.rgba(P.soot, 0.22);
      g.lineWidth = 0.8;
      for (let i = 0; i < 40; i++) {
        let cx = x + crng.range(0, w);
        let cy = y + crng.range(0, h);
        g.beginPath();
        g.moveTo(cx, cy);
        for (let j = 0; j < 4; j++) {
          cx += crng.range(-9, 9);
          cy += crng.range(-9, 9);
          g.lineTo(cx, cy);
        }
        g.stroke();
      }
      stain(g, x + w * 0.4, y + h * 0.28, w * 0.3, P.soot, 10, 0.16);
    } else {
      // Clear seascape at dusk: warm golden-pink dusk sky, deep violet sea
      const duskSky = g.createLinearGradient(x, y, x, y + h * 0.6);
      duskSky.addColorStop(0, S.mixHex(P.plum, P.taupe, 0.4));
      duskSky.addColorStop(0.5, S.mixHex(P.ember, P.dawn, 0.5));
      duskSky.addColorStop(1, P.dawn);
      g.fillStyle = duskSky;
      g.fillRect(x, y, w, h * 0.6);

      // Distant dusky sea
      const seaGrad = g.createLinearGradient(x, y + h * 0.55, x, y + h);
      seaGrad.addColorStop(0, S.mixHex(P.moon, P.plum, 0.4));
      seaGrad.addColorStop(1, S.shadeHex(P.moon, -0.4));
      g.fillStyle = seaGrad;
      g.fillRect(x, y + h * 0.55, w, h * 0.45);

      // Painterly wave crests
      g.strokeStyle = S.rgba(P.bone, 0.5);
      g.lineWidth = 1.5;
      for (let wy = y + h * 0.62; wy < y + h; wy += 14) {
        g.beginPath();
        for (let wx = x; wx <= x + w; wx += 20) {
          const cy = wy + Math.sin(wx * 0.08) * 2.5;
          if (wx === x) g.moveTo(wx, cy);
          else g.lineTo(wx, cy);
        }
        g.stroke();
      }
      // Distant sailboat silhouette
      g.fillStyle = S.rgba(P.soot, 0.65);
      g.beginPath();
      g.moveTo(x + w * 0.68, y + h * 0.54);
      g.lineTo(x + w * 0.72, y + h * 0.46);
      g.lineTo(x + w * 0.73, y + h * 0.54);
      g.fill();
    }
    g.restore();

    // Picture light fixture above painting (brass bar)
    paintPictureLightFixture(g, clean);
  }

  function paintPictureLightFixture(g, clean) {
    const { x, y, w, h } = PIC_LIGHT;
    const brass = aged(P.brass, clean);

    // Two curved brass mounting arms extending from frame top
    g.strokeStyle = brass;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x + 16, y + h + 6);
    g.quadraticCurveTo(x + 16, y + h * 0.5, x + 24, y + h * 0.5);
    g.moveTo(x + w - 16, y + h + 6);
    g.quadraticCurveTo(x + w - 16, y + h * 0.5, x + w - 24, y + h * 0.5);
    g.stroke();

    // Cylindrical brass reflector bar
    paintShape(g, roundedRectPoints(x, y, w, h, 3), {
      color: brass,
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.3,
      strokes: 5,
      strokeAngle: 0,
      rim: 0.4,
      wobble: 0.5,
      seed: 585,
    });
  }

  function paintWallDecor(g, clean) {
    // Wall details on the upper wall (x 900–1520, y 100–470):
    // 1. Octagonal wood regulator wall clock
    paintWallClock(g, clean);
    // 2. Flying brass ducks trio
    paintFlyingDucks(g, clean);
    // 3. Framed photograph
    paintWallPhoto(g, clean);
    // 4. Cork board and lava lamp shelf on the empty wall between chimney and bookshelf
    paintCorkBoardAndLavaLampShelf(g, clean);
  }

  // ART: blockout - Cork board and lava lamp shelf
  function paintCorkBoardAndLavaLampShelf(g, clean) {
    const cbX = 940;
    const cbY = 325;
    const cbW = 105;
    const cbH = 80;

    // Contact drop shadow behind cork board
    softShadow(g, cbX + cbW * 0.5, cbY + cbH * 0.5 + 4, cbW + 12, cbH + 12, 0.35);

    // Dark walnut frame
    paintShape(g, rectPoints(cbX, cbY, cbW, cbH), {
      color: aged(P.walnut, clean),
      lightDir: { x: -0.5, y: -0.8 },
      light: 0.25,
      shadow: 0.38,
      strokes: 6,
      rim: 0.3,
      seed: 680,
    });

    // Cork field
    const corkCol = clean ? S.mixHex(P.oak, P.linen, 0.25) : aged(S.mixHex(P.oak, P.taupe, 0.4), false);
    paintShape(g, rectPoints(cbX + 5, cbY + 5, cbW - 10, cbH - 10), {
      color: corkCol,
      lightDir: { x: 0, y: -1 },
      light: 0.18,
      shadow: 0.22,
      strokes: 6,
      seed: 681,
    });

    // Children's crayon drawings pinned to board (low contrast)
    // Drawing 1: Sun & stick figures
    const d1X = cbX + 11;
    const d1Y = cbY + 11;
    g.fillStyle = S.rgba(P.linen, clean ? 0.75 : 0.45);
    g.fillRect(d1X, d1Y, 36, 32);
    // Pushpin
    g.fillStyle = P.rust;
    g.beginPath();
    g.arc(d1X + 18, d1Y + 3, 2, 0, Math.PI * 2);
    g.fill();
    // Crayon sun & figure (low contrast)
    g.fillStyle = S.rgba(P.amber, clean ? 0.55 : 0.35);
    g.beginPath();
    g.arc(d1X + 28, d1Y + 11, 4.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = S.rgba(P.rust, clean ? 0.55 : 0.32);
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(d1X + 14, d1Y + 18);
    g.lineTo(d1X + 14, d1Y + 28);
    g.moveTo(d1X + 8, d1Y + 22);
    g.lineTo(d1X + 20, d1Y + 22);
    g.stroke();

    // Drawing 2: Crayon house
    const d2X = cbX + 18;
    const d2Y = cbY + 45;
    g.fillStyle = S.rgba(P.bone, clean ? 0.7 : 0.4);
    g.fillRect(d2X, d2Y, 38, 25);
    g.fillStyle = P.sky;
    g.beginPath();
    g.arc(d2X + 19, d2Y + 2.5, 2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = S.rgba(P.rust, clean ? 0.5 : 0.3);
    g.lineWidth = 1.2;
    g.strokeRect(d2X + 8, d2Y + 11, 14, 11);
    g.beginPath();
    g.moveTo(d2X + 5, d2Y + 11);
    g.lineTo(d2X + 15, d2Y + 5);
    g.lineTo(d2X + 25, d2Y + 11);
    g.stroke();

    // School photo: small portrait paper with oval child portrait (low contrast)
    const spX = cbX + 60;
    const spY = cbY + 14;
    g.fillStyle = S.rgba(P.linen, clean ? 0.8 : 0.5);
    g.fillRect(spX, spY, 34, 46);
    g.fillStyle = P.brass;
    g.beginPath();
    g.arc(spX + 17, spY + 3, 2, 0, Math.PI * 2);
    g.fill();
    // Inner photo oval with low contrast portrait
    g.fillStyle = S.rgba(P.taupe, clean ? 0.35 : 0.25);
    g.beginPath();
    g.ellipse(spX + 17, spY + 24, 13, 17, 0, 0, Math.PI * 2);
    g.fill();
    // Child silhouette
    g.fillStyle = S.rgba(P.skin, clean ? 0.6 : 0.4);
    g.beginPath();
    g.arc(spX + 17, spY + 20, 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.rgba(P.walnut, clean ? 0.5 : 0.35);
    g.beginPath();
    g.ellipse(spX + 17, spY + 32, 10, 6, 0, 0, Math.PI * 2);
    g.fill();

    // Small shelf beneath cork board on right
    const shX = 1065;
    const shY = 410;
    const shW = 58;
    const shH = 10;
    softShadow(g, shX + shW * 0.5, shY + shH + 6, shW + 12, 14, 0.4);

    paintShape(g, rectPoints(shX, shY, shW, shH), {
      color: clean ? TONE.panelBase : aged(P.walnut, false),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.35,
      seed: 683,
    });
    // Two small supporting brackets
    for (const bx of [shX + 8, shX + shW - 14]) {
      paintShape(
        g,
        [
          [bx, shY + shH],
          [bx + 6, shY + shH],
          [bx + 4, shY + shH + 12],
          [bx, shY + shH + 12],
        ],
        {
          color: aged(P.walnut, clean),
          lightDir: { x: -1, y: 0 },
          light: 0.2,
          shadow: 0.45,
          seed: 684 + bx,
        }
      );
    }

    // Lava lamp on the shelf (x: 1084, y: 346, w: 20, h: 64)
    const llX = 1084;
    const llY = 346;
    const llW = 20;
    const metalCol = clean ? P.brass : '#4e4130';

    // Metal base cone
    paintShape(
      g,
      [
        [llX - 2, shY],
        [llX + llW + 2, shY],
        [llX + llW - 2, shY - 14],
        [llX + 2, shY - 14],
      ],
      {
        color: metalCol,
        lightDir: { x: 0, y: -1 },
        light: clean ? 0.45 : 0.2,
        shadow: 0.35,
        seed: 685,
      }
    );

    // Glass vessel body
    g.fillStyle = clean ? 'rgba(255, 140, 90, 0.22)' : 'rgba(60, 50, 40, 0.3)';
    g.strokeStyle = clean ? 'rgba(255, 230, 210, 0.45)' : 'rgba(120, 110, 100, 0.3)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(llX + 2, shY - 14);
    g.quadraticCurveTo(llX - 3, llY + 28, llX + 3, llY + 10);
    g.lineTo(llX + llW - 3, llY + 10);
    g.quadraticCurveTo(llX + llW + 3, llY + 28, llX + llW - 2, shY - 14);
    g.closePath();
    g.fill();
    g.stroke();

    // Metal top cap
    paintShape(
      g,
      [
        [llX + 3, llY + 10],
        [llX + llW - 3, llY + 10],
        [llX + llW * 0.5 + 2, llY],
        [llX + llW * 0.5 - 2, llY],
      ],
      {
        color: metalCol,
        lightDir: { x: 0, y: -1 },
        light: clean ? 0.45 : 0.2,
        shadow: 0.35,
        seed: 686,
      }
    );

    // Wax state:
    if (!clean) {
      // Dirty: dark dormant wax slumped in bottom cone
      g.fillStyle = '#2b231c';
      g.beginPath();
      g.ellipse(llX + llW * 0.5, shY - 15, 7, 5, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      // Clean: warm-red wax pool in base (blobs animated in drawProps)
      g.fillStyle = P.ember;
      g.beginPath();
      g.ellipse(llX + llW * 0.5, shY - 15, 7, 4, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  function paintWallClock(g, clean) {
    const { x, y, r } = WALL_CLOCK;
    softShadow(g, x, y + 10, r * 2 + 12, r * 2.8, 0.4);

    // Octagonal wooden clock body
    const wood = aged(S.mixHex(P.walnut, P.oak, 0.4), clean);
    const octPts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      octPts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    paintShape(g, octPts, {
      color: wood,
      lightDir: { x: -0.5, y: -0.8 },
      light: 0.25,
      shadow: 0.4,
      strokes: 6,
      rim: 0.3,
      seed: 590,
    });

    // Cream clock dial face
    g.fillStyle = clean ? P.bone : aged(P.linen, false);
    g.beginPath();
    g.arc(x, y, r * 0.65, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = S.rgba(P.soot, 0.45);
    g.lineWidth = 1.5;
    g.stroke();

    // Hour ticks and black hands
    g.fillStyle = P.soot;
    for (let h = 0; h < 12; h++) {
      const a = (h * Math.PI) / 6;
      const tx = x + Math.cos(a) * (r * 0.52);
      const ty = y + Math.sin(a) * (r * 0.52);
      g.fillRect(tx - 1, ty - 1, 2, 2);
    }
    // Hands set to 8:15 (family prime-time TV hour)
    g.strokeStyle = P.soot;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - r * 0.35, y + r * 0.15); // Hour hand
    g.moveTo(x, y);
    g.lineTo(x + r * 0.48, y); // Minute hand
    g.stroke();

    // Lower glass drop case with pendulum
    g.fillStyle = S.shadeHex(wood, -0.2);
    g.fillRect(x - r * 0.5, y + r * 0.8, r, r * 0.9);
    // Brass pendulum bob
    g.fillStyle = P.brass;
    g.beginPath();
    g.arc(x, y + r * 1.35, 7, 0, Math.PI * 2);
    g.fill();
  }

  function paintFlyingDucks(g, clean) {
    // 1980s trio of brass wall ducks ascending
    WALL_DUCKS.forEach(({ x, y, s }) => {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      softShadow(g, 2, 4, 24, 16, 0.35);

      const col = clean ? P.brass : aged(P.brass, false, 0.8);
      g.fillStyle = col;
      // Flying mallard silhouette (wings up, neck extended)
      g.beginPath();
      g.moveTo(14, 0); // Beak
      g.quadraticCurveTo(8, -2, 4, -4); // Head & neck
      g.lineTo(-2, -14); // Upper wing tip
      g.lineTo(-5, -4); // Wing base
      g.lineTo(-14, 0); // Tail
      g.lineTo(-8, 3); // Underbody
      g.lineTo(-1, 8); // Lower wing tip
      g.lineTo(4, 2); // Breast
      g.closePath();
      g.fill();

      // Wing bevel / sheen
      g.strokeStyle = S.rgba(P.bone, clean ? 0.6 : 0.25);
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    });
  }

  function paintWallPhoto(g, clean) {
    const { x, y, w, h } = WALL_FRAME;
    softShadow(g, x + w * 0.5, y + h * 0.5, w + 10, h + 10, 0.35);

    // Dark walnut frame
    paintShape(g, rectPoints(x, y, w, h), {
      color: aged(P.walnut, clean),
      lightDir: { x: -0.5, y: -0.8 },
      light: 0.25,
      shadow: 0.38,
      strokes: 6,
      rim: 0.3,
      seed: 596,
    });
    // Inner mat
    g.fillStyle = S.rgba(P.linen, 0.85);
    g.fillRect(x + 7, y + 7, w - 14, h - 14);

    // Sepia photograph (vintage camping / cabin picture)
    g.fillStyle = aged(TONE.sepiaMid, clean);
    g.fillRect(x + 14, y + 14, w - 28, h - 28);
    // Silhouette of trees and cabin
    g.fillStyle = TONE.sepiaDeep;
    g.beginPath();
    g.moveTo(x + 18, y + h - 18);
    g.lineTo(x + 28, y + 26);
    g.lineTo(x + 38, y + h - 18);
    g.fill();
  }

  function paintBackGrime(g) {
    // Dirty-only age spots and cobweb dust films on wall corners
    stain(g, 110, 130, 60, P.soot, 14, 0.22);
    stain(g, 1810, 130, 70, P.soot, 16, 0.24);
    stain(g, 500, 480, 50, P.taupe, 12, 0.18);
    stain(g, 940, 480, 55, P.taupe, 12, 0.16);
  }

  // ── Layer 3: Furniture (TV Console, Bookshelf, Armchair, Rug) ───────────

  function paintFurniture(g, clean) {
    paintShagRug(g, clean);
    paintArmchair(g, clean);
    paintConsoleTV(g, clean);
    paintBookshelf(g, clean);
  }

  function paintShagRug(g, clean) {
    // A 1980s shag rug in perspective. The pile is the point: thousands of
    // short curled tufts lying every which way, smaller toward the back,
    // with a fringe at both ends. Muted rust and taupe; only light warms it.
    const { x0, x1, y0, y1 } = RUG;
    const rwTop = (x1 - x0) * 0.85;
    const rwBot = x1 - x0;
    const cx = (x0 + x1) * 0.5;
    const halfAt = (y) => S.lerp(rwTop, rwBot, (y - y0) / (y1 - y0)) * 0.5;
    const rugPts = [
      [cx - rwTop * 0.5, y0],
      [cx + rwTop * 0.5, y0],
      [cx + rwBot * 0.5, y1],
      [cx - rwBot * 0.5, y1],
    ];
    const base = aged(TONE.shagRug, clean, 0.8);

    softShadow(g, cx, (y0 + y1) * 0.5 + 6, rwBot * 0.56, (y1 - y0) * 0.62, 0.5);
    paintShape(g, rugPts, {
      color: base,
      lightDir: { x: -0.3, y: -0.8 },
      light: 0.14,
      shadow: 0.38,
      strokes: 26,
      strokeAngle: 0.2,
      strokeJitter: 0.9,
      variance: 0.16,
      rim: 0.12,
      wobble: 2.4,
      seed: 601,
    });

    g.save();
    wobblyPath(g, rugPts, { wobble: 2.4, seed: 601 });
    g.clip();

    // A faint border band, low contrast, squashed by perspective.
    const border = [
      [cx - rwTop * 0.5 + 34, y0 + 12],
      [cx + rwTop * 0.5 - 34, y0 + 12],
      [cx + rwBot * 0.5 - 40, y1 - 16],
      [cx - rwBot * 0.5 + 40, y1 - 16],
    ];
    g.strokeStyle = S.rgba(S.shadeHex(base, -0.4), 0.22);
    g.lineWidth = 12;
    wobblyPath(g, border, { wobble: 2, seed: 603 });
    g.stroke();

    // The pile.
    const rng = S.createRng(602);
    const tones = [S.shadeHex(base, 0.22), S.shadeHex(base, -0.25), S.mixHex(base, P.linen, 0.25), S.shadeHex(base, -0.45), base];
    const count = clean ? 3200 : 2600;
    for (let i = 0; i < count; i++) {
      const v = rng.next();
      const y = S.lerp(y0 + 2, y1 - 2, v);
      const half = halfAt(y);
      const x = cx + rng.range(-half, half);
      const near = 0.6 + v * 0.7; // tufts at the front are bigger
      const len = rng.range(3, 7) * near;
      const a = -Math.PI / 2 + rng.range(-1.1, 1.1);
      g.strokeStyle = S.rgba(tones[i % tones.length], rng.range(0.16, 0.42));
      g.lineWidth = rng.range(1, 2.2) * near;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + rng.range(-2, 2), y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }

    if (!clean) {
      // Matted and grey with dust in patches.
      for (let i = 0; i < 7; i++) {
        const px = cx + rng.range(-rwTop * 0.4, rwTop * 0.4);
        const py = rng.range(y0 + 20, y1 - 20);
        const dust = g.createRadialGradient(px, py, 4, px, py, rng.range(50, 110));
        dust.addColorStop(0, S.rgba(P.linen, 0.14));
        dust.addColorStop(1, S.rgba(P.linen, 0));
        g.fillStyle = dust;
        g.fillRect(px - 120, py - 120, 240, 240);
      }
    }
    g.restore();

    // Fringe along the front and the back edge (shorter at the back).
    const fringe = clean ? S.mixHex(P.linen, base, 0.35) : S.mixHex(P.taupe, base, 0.4);
    for (const [y, len, w] of [[y1, 11, rwBot], [y0, 5, rwTop]]) {
      for (let x = cx - w * 0.5 + 4; x < cx + w * 0.5 - 4; x += 6) {
        g.strokeStyle = S.rgba(fringe, rng.range(0.45, 0.75));
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + rng.range(-2, 2), y + (y === y1 ? len : -len) + rng.range(-2, 2));
        g.stroke();
      }
    }
  }

  function paintArmchair(g, clean) {
    // 1980s recliner armchair (x 200–430, seat y 790)
    const { x0, x1, seatY, backTop, floor } = ARMCHAIR;
    const w = x1 - x0;
    const cx = (x0 + x1) * 0.5;

    // Contact shadow under chair
    softShadow(g, cx, floor - 4, w + 16, 28, 0.5);

    // Sturdy wooden block feet
    g.fillStyle = S.shadeHex(P.walnut, -0.4);
    g.fillRect(x0 + 16, floor - 16, 22, 16);
    g.fillRect(x1 - 38, floor - 16, 22, 16);

    if (clean) {
      // CLEAN: rich brown corduroy fabric visible on seat, backrest and arms
      const cordColor = TONE.corduroy;

      // Tufted backrest
      const backPts = roundedRectPoints(x0 + 24, backTop, w - 48, seatY - backTop + 14, 14);
      paintShape(g, backPts, {
        color: cordColor,
        lightDir: { x: 0.6, y: -0.7 },
        light: 0.24,
        shadow: 0.42,
        strokes: 16,
        strokeAngle: Math.PI / 2,
        rim: 0.3,
        wobble: 1.4,
        seed: 610,
      });

      // Corduroy vertical ribbing on backrest
      g.save();
      g.beginPath();
      backPts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.clip();
      g.strokeStyle = S.rgba(P.soot, 0.22);
      g.lineWidth = 1.8;
      for (let rx = x0 + 32; rx < x1 - 32; rx += 7) {
        g.beginPath();
        g.moveTo(rx, backTop + 6);
        g.lineTo(rx, seatY);
        g.stroke();
      }
      // Tufted buttons
      g.fillStyle = S.rgba(P.soot, 0.6);
      [backTop + 45, backTop + 95].forEach((by) => {
        [cx - 40, cx, cx + 40].forEach((bx) => {
          g.beginPath();
          g.arc(bx, by, 4, 0, Math.PI * 2);
          g.fill();
        });
      });
      g.restore();

      // Thick seat cushion (platform at y = 790)
      const seatPts = roundedRectPoints(x0 + 16, seatY - 14, w - 32, 42, 10);
      paintShape(g, seatPts, {
        color: S.shadeHex(cordColor, 0.08),
        lightDir: { x: 0, y: -1 },
        light: 0.3,
        shadow: 0.38,
        strokes: 12,
        strokeAngle: 0,
        rim: 0.35,
        wobble: 1.2,
        seed: 612,
      });

      // Armrests on left and right
      [
        { ax: x0 + 6, aw: 36, seed: 614 },
        { ax: x1 - 42, aw: 36, seed: 616 },
      ].forEach(({ ax, aw, seed }) => {
        const armPts = roundedRectPoints(ax, seatY - 55, aw, 80, 12);
        paintShape(g, armPts, {
          color: cordColor,
          lightDir: { x: 0.4, y: -0.8 },
          light: 0.25,
          shadow: 0.4,
          strokes: 10,
          strokeAngle: Math.PI / 2,
          rim: 0.3,
          wobble: 1.1,
          seed,
        });
      });

      // Folded dust sheet resting neatly on the right armrest
      paintFoldedDustSheet(g, x1 - 44, seatY - 70);
    } else {
      // DIRTY: beige dust sheet (drop cloth) thrown over the armchair
      paintDrapedDustSheet(g, ARMCHAIR);
    }
  }

  function paintDrapedDustSheet(g, chair) {
    const { x0, x1, backTop, floor } = chair;
    const w = x1 - x0;
    const cx = (x0 + x1) * 0.5;

    // Bulky draped drop cloth contour
    const sheetPts = [
      [x0 + 10, backTop - 6],
      [x1 - 10, backTop - 4],
      [x1 + 14, backTop + 70],
      [x1 + 18, floor - 8],
      [x1 - 12, floor + 6],
      [cx + 10, floor + 2],
      [x0 - 8, floor + 6],
      [x0 - 14, backTop + 70],
    ];

    paintShape(g, sheetPts, {
      color: TONE.dustSheet,
      lightDir: { x: 0.6, y: -0.8 },
      light: 0.22,
      shadow: 0.45,
      strokes: 20,
      strokeAngle: 0.65,
      strokeJitter: 0.3,
      rim: 0.2,
      wobble: 2.2,
      seed: 620,
    });

    // Wrinkles, folds, and sag creases on the draped cloth
    g.save();
    g.beginPath();
    sheetPts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.clip();

    const rng = S.createRng(621);
    for (let i = 0; i < 16; i++) {
      const fy = backTop + 30 + i * 16;
      g.strokeStyle = S.rgba(P.soot, rng.range(0.18, 0.4));
      g.lineWidth = rng.range(1.5, 3.2);
      g.beginPath();
      g.moveTo(x0 + rng.range(4, 25), fy);
      g.quadraticCurveTo(cx + rng.range(-30, 30), fy + rng.range(10, 26), x1 - rng.range(4, 25), fy + rng.range(-6, 6));
      g.stroke();
    }
    // Stain on the old cloth
    stain(g, cx - 18, backTop + 110, 42, P.taupe, 12, 0.25);
    g.restore();
  }

  function paintFoldedDustSheet(g, x, y) {
    // Folded drop cloth neatly on the armrest (clean state)
    const pts = roundedRectPoints(x - 8, y, 48, 26, 6);
    paintShape(g, pts, {
      color: S.mixHex(TONE.dustSheet, P.linen, 0.3),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.35,
      strokes: 8,
      strokeAngle: 0,
      rim: 0.35,
      wobble: 1,
      seed: 625,
    });
    // Fabric fold lines
    g.strokeStyle = S.rgba(P.taupe, 0.45);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x - 6, y + 9);
    g.lineTo(x + 38, y + 9);
    g.moveTo(x - 6, y + 17);
    g.lineTo(x + 38, y + 17);
    g.stroke();
  }

  function paintConsoleTV(g, clean) {
    // 1980s wood console television (x 1160–1420, y 600–850)
    const { x0, x1, y0, y1 } = TV_CONSOLE;
    const w = x1 - x0;
    const cx = (x0 + x1) * 0.5;

    // Soft contact shadow under the cabinet
    softShadow(g, cx, y1 + 18, w + 20, 24, 0.5);

    // Short wooden legs with brass caps
    [x0 + 28, x1 - 42].forEach((lx) => {
      // Wooden angled leg
      g.fillStyle = S.shadeHex(P.walnut, -0.35);
      g.beginPath();
      g.moveTo(lx, y1);
      g.lineTo(lx + 14, y1);
      g.lineTo(lx + 10, y1 + 32);
      g.lineTo(lx - 2, y1 + 32);
      g.closePath();
      g.fill();
      // Brass cap at tip
      g.fillStyle = P.brass;
      g.fillRect(lx - 2, y1 + 22, 12, 10);
    });

    // Main wooden console cabinet
    const cabPts = roundedRectPoints(x0, y0, w, y1 - y0, 8);
    paintShape(g, cabPts, {
      color: aged(TONE.consoleWood, clean),
      lightDir: { x: -0.5, y: -0.7 },
      light: 0.26,
      shadow: 0.42,
      strokes: 14,
      strokeAngle: 0,
      rim: 0.3,
      wobble: 0.9,
      seed: 630,
    });

    // Lower TV stand shelf platform (x 1150–1430, y 780)
    const { x0: sx0, x1: sx1, y: sy, h: sh } = TV_SHELF;
    paintShape(g, rectPoints(sx0, sy, sx1 - sx0, sh), {
      color: aged(S.shadeHex(TONE.consoleWood, 0.08), clean),
      lightDir: { x: 0, y: -1 },
      light: 0.32,
      shadow: 0.4,
      strokes: 8,
      strokeAngle: 0,
      rim: 0.35,
      wobble: 0.7,
      seed: 632,
    });
    g.fillStyle = S.rgba(P.soot, 0.5);
    g.fillRect(sx0 + 4, sy + sh, sx1 - sx0 - 8, 6);

    // CRT screen bezel recess
    const { x: scrX, y: scrY, w: scrW, h: scrH } = TV_SCREEN;
    g.fillStyle = S.rgba(P.soot, 0.9);
    g.fillRect(scrX - 8, scrY - 8, scrW + 16, scrH + 16);

    // Leave the actual screen aperture TRANSPARENT in the furniture layer!
    // This allows drawProps (which renders dynamic static and the home movie)
    // to shine through unobstructed!
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const tubePts = roundedRectPoints(scrX, scrY, scrW, scrH, 14);
    g.beginPath();
    tubePts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.fill();
    g.restore();

    // Subtle glass bevel edge around the cutout
    g.strokeStyle = S.rgba(P.soot, 0.6);
    g.lineWidth = 3;
    g.stroke();

    // Right side control panel: channel dials, knobs, and speaker grille
    paintTVControls(g, clean);

    // Rabbit-ear antenna on top of the TV
    paintTVAntenna(g, clean);

    // Trace of previous cleaner: sticky note ("DON'T turn it off")
    paintTVStickyNote(g);
  }

  function paintTVControls(g, clean) {
    const { x0, x1, y0, y1 } = TV_KNOBS;
    // Dark recess for controls
    g.fillStyle = S.rgba(P.soot, 0.45);
    g.fillRect(x0, y0, x1 - x0, y1 - y0);

    // VHF clicker dial (large knob)
    const kx = (x0 + x1) * 0.5;
    const dial1Y = y0 + 24;
    g.fillStyle = P.gear;
    g.beginPath();
    g.arc(kx, dial1Y, 14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.brass;
    g.fillRect(kx - 2, dial1Y - 12, 4, 10);

    // UHF knob (smaller)
    const dial2Y = y0 + 58;
    g.fillStyle = P.gear;
    g.beginPath();
    g.arc(kx, dial2Y, 10, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.brass;
    g.fillRect(kx - 1.5, dial2Y - 8, 3, 7);

    // Slotted wooden speaker louvers below knobs
    const louverY0 = y0 + 78;
    const louverY1 = y1 + 50;
    for (let ly = louverY0; ly < louverY1; ly += 7) {
      g.fillStyle = S.rgba(P.soot, 0.7);
      g.fillRect(x0 + 4, ly, x1 - x0 - 8, 3);
      g.fillStyle = S.rgba(P.linen, 0.1);
      g.fillRect(x0 + 4, ly + 3, x1 - x0 - 8, 1);
    }
  }

  function paintTVAntenna(g, clean) {
    const baseCx = TV_CONSOLE.x0 + 90;
    const baseY = TV_CONSOLE.y0;

    // Round mounting base
    g.fillStyle = P.gear;
    g.beginPath();
    g.ellipse(baseCx, baseY, 12, 5, 0, 0, Math.PI * 2);
    g.fill();

    // Chrome rabbit-ear telescopic rods in V-shape
    g.strokeStyle = S.mixHex(P.gear, P.bone, 0.7);
    g.lineWidth = 2.4;
    g.beginPath();
    // Left rod
    g.moveTo(baseCx - 4, baseY);
    g.lineTo(baseCx - 46, baseY - 90);
    // Right rod
    g.moveTo(baseCx + 4, baseY);
    g.lineTo(baseCx + 52, baseY - 86);
    g.stroke();

    // Small chrome tips at the antenna ends
    g.fillStyle = P.bone;
    g.beginPath();
    g.arc(baseCx - 46, baseY - 90, 3, 0, Math.PI * 2);
    g.arc(baseCx + 52, baseY - 86, 3, 0, Math.PI * 2);
    g.fill();
  }

  function paintTVStickyNote(g) {
    // Yellow paper sticky note on TV console top-right: "DON'T turn it off"
    // Stays in both dirty and clean!
    g.save();
    g.translate(TV_CONSOLE.x0 + 160, TV_CONSOLE.y0 + 8);
    g.rotate(-0.06);
    softShadow(g, 0, 6, 42, 38, 0.35);

    // Note paper
    g.fillStyle = '#E8D272';
    g.fillRect(-20, -18, 40, 36);

    // Handwritten text in blue-black pen
    g.fillStyle = 'rgba(28, 22, 50, 0.88)';
    g.font = '700 11px Caveat, cursive, sans-serif';
    g.textAlign = 'center';
    g.fillText("DON'T", 0, -5);
    g.fillText('turn it off', 0, 8);
    g.restore();
  }

  function paintBookshelf(g, clean) {
    // Built-in wooden bookshelf (x 1520–1800, y 310–850)
    const { x0, x1, y0, y1 } = BOOKSHELF;
    const w = x1 - x0;
    const h = y1 - y0;
    const wood = aged(S.mixHex(P.walnut, P.oak, 0.45), clean);

    // Backing panels in deep shadow
    g.fillStyle = S.shadeHex(P.walnut, -0.45);
    g.fillRect(x0 + 12, y0 + 10, w - 24, h - 16);

    // Uprights on left and right
    [x0, x1 - 16].forEach((ux) => {
      paintShape(g, rectPoints(ux, y0, 16, h), {
        color: wood,
        lightDir: { x: -0.6, y: -0.8 },
        light: 0.22,
        shadow: 0.38,
        strokes: 8,
        strokeAngle: Math.PI / 2,
        rim: 0.25,
        wobble: 0.7,
        seed: 640 + ux,
      });
    });

    // Horizontal shelves: y = 430 (top platform), 540, 650, 750, 850
    const shelfYs = [430, 540, 650, 750, 846];
    shelfYs.forEach((sy, idx) => {
      paintShape(g, rectPoints(x0, sy, w, 16), {
        color: idx === 0 ? S.shadeHex(wood, 0.1) : wood,
        lightDir: { x: 0, y: -1 },
        light: 0.32,
        shadow: 0.4,
        strokes: 6,
        strokeAngle: 0,
        rim: 0.35,
        wobble: 0.6,
        seed: 645 + idx * 7,
      });
      g.fillStyle = S.rgba(P.soot, 0.45);
      g.fillRect(x0 + 12, sy + 16, w - 24, 5);
    });

    // Shelves contents: board games, vinyl records, books, VHS tapes
    paintBookshelfContents(g, clean);
  }

  function paintBookshelfContents(g, clean) {
    const { x0, x1 } = BOOKSHELF;

    // Shelf at y = 540 (board games):
    // Dirty: toppled boxes sliding across shelf
    // Clean: stacked neatly
    paintBoardGames(g, x0 + 20, 540, clean);

    // Shelf at y = 650 (vinyl records)
    paintVinylRecords(g, x0 + 22, 650, clean);

    // Shelf at y = 750 (hardcover books)
    paintHardcoverBooks(g, x0 + 20, 750, clean);

    // Shelf at y = 846 (stack of black VHS tapes)
    paintVHSTapes(g, x0 + 24, 846, clean);
  }

  function paintBoardGames(g, x, y, clean) {
    g.save();
    if (!clean) {
      // Dirty: board games toppled across shelf, lid askew
      // Box 1 (green/gold box tilted)
      g.translate(x + 35, y - 14);
      g.rotate(0.24);
      g.fillStyle = S.mixHex(P.moss, P.brass, 0.4);
      g.fillRect(-28, -8, 56, 16);
      g.strokeStyle = S.rgba(P.soot, 0.4);
      g.strokeRect(-28, -8, 56, 16);
      g.restore();

      g.save();
      // Box 2 (red vintage game box fallen flat)
      g.translate(x + 95, y - 8);
      g.rotate(-0.08);
      g.fillStyle = S.mixHex(P.rust, P.taupe, 0.3);
      g.fillRect(-35, -7, 70, 14);
      g.restore();

      g.save();
      // Box 3 (blue box askew)
      g.translate(x + 160, y - 20);
      g.rotate(0.38);
      g.fillStyle = S.mixHex(P.moon, P.taupe, 0.4);
      g.fillRect(-25, -9, 50, 18);
      g.restore();
    } else {
      // Clean: neatly stacked horizontally and standing vertically
      // Horizontal stack
      const boxTones = [
        S.mixHex(P.rust, P.ember, 0.4),
        S.mixHex(P.moss, P.brass, 0.5),
        S.mixHex(P.moon, P.linen, 0.3),
      ];
      boxTones.forEach((col, i) => {
        g.fillStyle = col;
        g.fillRect(x + 10, y - 12 - i * 14, 90, 13);
        g.strokeStyle = S.rgba(P.soot, 0.35);
        g.strokeRect(x + 10, y - 12 - i * 14, 90, 13);
      });
      // Vertical game boxes standing neatly on right
      const vTones = [P.brass, P.moss, P.plum];
      vTones.forEach((col, i) => {
        g.fillStyle = col;
        g.fillRect(x + 120 + i * 18, y - 56, 16, 56);
        g.strokeStyle = S.rgba(P.soot, 0.4);
        g.strokeRect(x + 120 + i * 18, y - 56, 16, 56);
      });
    }
    g.restore();
  }

  function paintVinylRecords(g, x, y, clean) {
    // 12-inch vinyl record sleeves in vertical dividers
    const colors = [P.plum, P.taupe, P.rust, P.linen, P.walnut, P.moss, P.brass];
    for (let i = 0; i < 22; i++) {
      const rx = x + i * 9.5;
      const col = colors[i % colors.length];
      g.fillStyle = clean ? col : aged(col, false);
      g.fillRect(rx, y - 68, 8, 68);
      g.strokeStyle = S.rgba(P.soot, 0.35);
      g.strokeRect(rx, y - 68, 8, 68);
    }
  }

  function paintHardcoverBooks(g, x, y, clean) {
    // Row of books with varied heights and gold spine lines
    const heights = [70, 78, 65, 82, 74, 68, 80, 72, 76, 66, 84, 70];
    const spineCols = [P.walnut, P.rust, P.moss, P.plum, P.taupe, P.oak];
    let curX = x;
    for (let i = 0; i < heights.length; i++) {
      const bh = heights[i];
      const bw = 14 + (i % 3) * 3;
      const col = spineCols[i % spineCols.length];
      g.fillStyle = clean ? col : aged(col, false);
      g.fillRect(curX, y - bh, bw, bh);
      // Gold foil line
      g.fillStyle = S.rgba(P.brass, clean ? 0.6 : 0.25);
      g.fillRect(curX + 2, y - bh + 12, bw - 4, 2);
      g.fillRect(curX + 2, y - 16, bw - 4, 1.5);
      curX += bw + 1.5;
    }
  }

  function paintVHSTapes(g, x, y, clean) {
    // Stack of black VHS tape cassettes
    for (let i = 0; i < 5; i++) {
      const ty = y - 12 - i * 13;
      // Black plastic cassette shell
      g.fillStyle = S.shadeHex(P.gear, -0.45);
      g.fillRect(x + 10, ty, 82, 12);
      // White label on tape spine
      g.fillStyle = clean ? S.mixHex(P.linen, P.bone, 0.5) : aged(P.linen, false);
      g.fillRect(x + 18, ty + 2, 60, 8);
      // Red or blue handwriting stroke on label
      g.fillStyle = S.rgba(P.rust, 0.6);
      g.fillRect(x + 24, ty + 5, 28, 2);
    }
  }

  // ── Layer 5: Front (Foreground Out-of-Focus Diorama Props) ───────────────

  function paintFront(g, clean) {
    // Blurred silhouettes in bottom corners (blur 7 px, painted once)
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = S.STAGE.width;
    blurCanvas.height = S.STAGE.height;
    const bg = blurCanvas.getContext('2d');

    // Bottom-left: corduroy floor cushion peeking behind nerve gauge
    const { x0: cx0, x1: cx1, y0: cy0, y1: cy1 } = CUSHION;
    const cushionPts = roundedRectPoints(cx0, cy0, cx1 - cx0, cy1 - cy0, 32);
    paintShape(bg, cushionPts, {
      color: aged(TONE.corduroy, clean, 0.7),
      lightDir: { x: 0.6, y: -0.8 },
      light: 0.2,
      shadow: 0.55,
      strokes: 16,
      strokeAngle: 0.5,
      rim: 0.25,
      wobble: 1.5,
      seed: 670,
    });

    // Bottom-right: side table with rotary telephone & table lamp
    // Elevated to y: 840–1050 so table lamp and shade are clearly visible above weapon tag!
    const { x0: tx0, x1: tx1, y0: ty0, y1: ty1 } = SIDE_TABLE;
    paintShape(bg, roundedRectPoints(tx0, ty0, tx1 - tx0, ty1 - ty0, 16), {
      color: aged(P.walnut, clean),
      lightDir: { x: -0.4, y: -0.8 },
      light: 0.22,
      shadow: 0.5,
      strokes: 12,
      strokeAngle: 0,
      rim: 0.3,
      wobble: 1,
      seed: 672,
    });

    // 1980s telephone on table
    const phoneX = tx0 + 38;
    const phoneY = ty0 + 35;
    bg.fillStyle = S.shadeHex(P.bone, -0.4);
    bg.beginPath();
    bg.ellipse(phoneX, phoneY, 24, 16, 0, 0, Math.PI * 2);
    bg.fill();
    // Handset receiver
    bg.fillStyle = S.shadeHex(P.bone, -0.55);
    bg.fillRect(phoneX - 28, phoneY - 12, 56, 9);

    // Table lamp (ceramic base + pleated shade)
    const lx = TABLE_LAMP.x;
    const ly = TABLE_LAMP.y;
    // Ceramic base
    bg.fillStyle = aged(P.taupe, clean);
    bg.beginPath();
    bg.ellipse(lx, ly + 36, 18, 24, 0, 0, Math.PI * 2);
    bg.fill();
    // Pleated fabric shade
    const shadePts = [
      [lx - 28, ly + 22],
      [lx + 28, ly + 22],
      [lx + 18, ly - 34],
      [lx - 18, ly - 34],
    ];
    paintShape(bg, shadePts, {
      color: clean ? S.mixHex(P.linen, P.amber, 0.45) : aged(P.linen, false),
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.3,
      strokes: 8,
      rim: 0.35,
      seed: 675,
    });

    // Render with 7 px blur once onto the cached front layer
    g.save();
    g.filter = 'blur(7px)';
    g.drawImage(blurCanvas, 0, 0);
    g.restore();
  }

  // ── Home Movie Frames & TV Static Generation ────────────────────────────

  function createHomeMovieCanvases() {
    // 5 painterly sepia frames of beach home movie:
    // Frame 1: Small child waving warmly with both hands at the camera (faded child!)
    // Frame 2: Two adults standing together on the sand, smiling proudly
    // Frame 3: Small child running along the water's edge
    // Frame 4: Small child waving at camera with both hands by sea waves
    // Frame 5: Close-up of small child smiling and waving with sand bucket
    const W = 150;
    const H = 110;
    const frames = [];

    for (let f = 0; f < 5; f++) {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');

      // Sepia sky and beach background
      const skyGrad = g.createLinearGradient(0, 0, 0, H * 0.55);
      skyGrad.addColorStop(0, TONE.sepiaHigh);
      skyGrad.addColorStop(1, TONE.sepiaMid);
      g.fillStyle = skyGrad;
      g.fillRect(0, 0, W, H * 0.55);

      // Pale nostalgic sun
      g.fillStyle = S.rgba('#FFF4DC', 0.6);
      g.beginPath();
      g.arc(W * 0.25, H * 0.26, 12, 0, Math.PI * 2);
      g.fill();

      // Distant sea
      g.fillStyle = S.mixHex(TONE.sepiaMid, TONE.sepiaDeep, 0.4);
      g.fillRect(0, H * 0.45, W, H * 0.18);

      // Sand shore
      const sandGrad = g.createLinearGradient(0, H * 0.6, 0, H);
      sandGrad.addColorStop(0, TONE.sepiaMid);
      sandGrad.addColorStop(1, S.shadeHex(TONE.sepiaMid, -0.2));
      g.fillStyle = sandGrad;
      g.fillRect(0, H * 0.6, W, H * 0.4);

      // Waves
      g.strokeStyle = S.rgba(TONE.sepiaHigh, 0.55);
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(0, H * 0.6);
      g.quadraticCurveTo(W * 0.5, H * 0.58, W, H * 0.61);
      g.stroke();

      // Subject silhouettes per frame
      g.fillStyle = TONE.sepiaDeep;
      if (f === 0 || f === 3) {
        // Child waving both arms enthusiastically at camera!
        const cx = W * 0.5;
        const cy = H * 0.54;
        g.beginPath();
        g.arc(cx, cy, 6.5, 0, Math.PI * 2);
        g.fill();
        g.fillRect(cx - 4.5, cy + 6, 9, 16);
        // Waving arms held high
        g.strokeStyle = TONE.sepiaDeep;
        g.lineWidth = 2.6;
        g.beginPath();
        g.moveTo(cx - 3, cy + 8);
        g.lineTo(cx - 12, cy - 4);
        g.moveTo(cx + 3, cy + 8);
        g.lineTo(cx + 13, cy - 5);
        g.stroke();
        // Legs standing
        g.fillRect(cx - 4, cy + 22, 3, 10);
        g.fillRect(cx + 1, cy + 22, 3, 10);
      } else if (f === 1) {
        // Two adults standing together smiling
        // Adult 1
        g.beginPath();
        g.arc(W * 0.42, H * 0.48, 6, 0, Math.PI * 2);
        g.fill();
        g.fillRect(W * 0.38, H * 0.54, 8, 22);
        // Adult 2
        g.beginPath();
        g.arc(W * 0.52, H * 0.46, 6.5, 0, Math.PI * 2);
        g.fill();
        g.fillRect(W * 0.48, H * 0.53, 9, 23);
      } else if (f === 2) {
        // Child running on sand towards waves
        g.beginPath();
        g.arc(W * 0.5, H * 0.55, 5, 0, Math.PI * 2);
        g.fill();
        g.fillRect(W * 0.47, H * 0.6, 6, 14);
        // Stride legs
        g.lineWidth = 2.2;
        g.strokeStyle = TONE.sepiaDeep;
        g.beginPath();
        g.moveTo(W * 0.48, H * 0.74);
        g.lineTo(W * 0.44, H * 0.82);
        g.moveTo(W * 0.52, H * 0.74);
        g.lineTo(W * 0.56, H * 0.81);
        g.stroke();
      } else if (f === 4) {
        // Close-up child waving with sand bucket
        const cx = W * 0.48;
        const cy = H * 0.46;
        g.beginPath();
        g.arc(cx, cy, 9.5, 0, Math.PI * 2);
        g.fill();
        g.fillRect(cx - 6, cy + 9, 13, 22);
        // Waving hand
        g.strokeStyle = TONE.sepiaDeep;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(cx + 6, cy + 12);
        g.lineTo(cx + 18, cy - 2);
        g.stroke();
        // Little sand bucket
        g.fillStyle = S.mixHex(P.rust, TONE.sepiaDeep, 0.4);
        g.fillRect(cx - 16, cy + 24, 8, 10);
      }

      // Warm film vignette
      const v = g.createRadialGradient(W * 0.5, H * 0.5, W * 0.35, W * 0.5, H * 0.5, W * 0.65);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(40, 25, 15, 0.45)');
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);

      frames.push(c);
    }
    return frames;
  }

  // Small offscreen canvas for dynamic CRT noise
  const staticCanvas = document.createElement('canvas');
  staticCanvas.width = 75;
  staticCanvas.height = 55;
  const staticCtx = staticCanvas.getContext('2d');

  function renderStaticNoise() {
    const imgData = staticCtx.createImageData(75, 55);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() > 0.42 ? Math.floor(Math.random() * 225) + 30 : 15;
      data[i] = v;
      data[i + 1] = v + 8; // Slight cold tint
      data[i + 2] = v + 16;
      data[i + 3] = 255;
    }
    staticCtx.putImageData(imgData, 0, 0);
  }

  // ── Webs (>= 6) ────────────────────────────────────────────────────────

  function makeWebs() {
    return [
      // 1. Across the fireplace opening (burns away at makeover unique beat)
      new S.Web({
        hub: [720, 680],
        anchors: [
          [FIREBOX.x0 - 4, FIREBOX.y0 + 20],
          [FIREBOX.x1 + 4, FIREBOX.y0 + 20],
          [FIREBOX.x1 + 4, FIREBOX.y1 - 10],
          [FIREBOX.x0 - 4, FIREBOX.y1 - 10],
          [720, FIREBOX.y0 - 2],
        ],
        rings: 7,
        sheet: 0.35,
        seed: 701,
      }),
      // 2. Between the rabbit-ear antenna and the wall
      new S.Web({
        hub: [1260, 560],
        anchors: [
          [1200, 510],
          [1245, 500],
          [1310, 520],
          [1290, 600],
          [1230, 600],
        ],
        rings: 5,
        sheet: 0.28,
        seed: 702,
      }),
      // 3. Upper left corner of window frame
      new S.Web({
        hub: [175, 195],
        anchors: [
          [145, 165],
          [225, 165],
          [245, 205],
          [180, 255],
          [145, 230],
        ],
        rings: 6,
        sheet: 0.32,
        seed: 703,
      }),
      // 4. Upper right corner of window frame
      new S.Web({
        hub: [425, 195],
        anchors: [
          [375, 165],
          [455, 165],
          [455, 230],
          [420, 255],
          [355, 205],
        ],
        rings: 6,
        sheet: 0.3,
        seed: 704,
      }),
      // 5. From ceiling beam to chimney breast
      new S.Web({
        hub: [525, 105],
        anchors: [
          [BEAM.x0 + 10, 80],
          [BEAM.x1 - 4, 80],
          [CHIMNEY.x0 + 10, 110],
          [CHIMNEY.x0 + 12, 160],
          [BEAM.x0 + 10, 115],
        ],
        rings: 5,
        sheet: 0.26,
        seed: 705,
      }),
      // 6. Under the armchair
      new S.Web({
        hub: [315, 835],
        anchors: [
          [ARMCHAIR.x0 + 20, 805],
          [ARMCHAIR.x1 - 25, 805],
          [ARMCHAIR.x1 - 15, ARMCHAIR.floor - 5],
          [ARMCHAIR.x0 + 15, ARMCHAIR.floor - 5],
        ],
        rings: 6,
        sheet: 0.35,
        seed: 706,
      }),
      // 7. Bookshelf top corner
      new S.Web({
        hub: [1760, 445],
        anchors: [
          [BOOKSHELF.x0 + 190, 420],
          [BOOKSHELF.x1 + 6, 420],
          [BOOKSHELF.x1 + 6, 490],
          [BOOKSHELF.x0 + 200, 520],
        ],
        rings: 5,
        sheet: 0.3,
        seed: 707,
      }),
    ];
  }

  // ── Live State ─────────────────────────────────────────────────────────

  function createLive(seed) {
    return {
      noise: S.createNoise(seed),
      homeMovieFrames: createHomeMovieCanvases(),
      surge: 0,
      nextSurge: 3.5,
      surgeDuration: 0,
      flames: 0,
      fireWebBurned: false,
    };
  }

  // ── Dynamic Render Passes (Far Sky, Moving Props) ───────────────────────

  function drawSky(ctx, live, time, mk) {
    // Window glass view (clipped to WINDOW bounds, with -camX * 40 parallax)
    const { x, y, w, h } = WINDOW;
    const morning = mk.window;

    // Deep night sky gradient -> morning dawn sky
    const sky = ctx.createLinearGradient(x, y, x, y + h);
    if (morning < 0.05) {
      sky.addColorStop(0, '#101626');
      sky.addColorStop(1, '#243248');
    } else {
      sky.addColorStop(0, S.mix('#101626', '#7CAED6', morning));
      sky.addColorStop(1, S.mix('#243248', '#FFD8A8', morning));
    }
    ctx.fillStyle = sky;
    ctx.fillRect(x - 60, y - 40, w + 120, h + 80);

    // Silhouettes of pine trees outside
    ctx.fillStyle = S.mixHex('#0C101A', '#526E54', morning);
    ctx.beginPath();
    ctx.moveTo(x + 20, y + h + 20);
    ctx.lineTo(x + 70, y + 60);
    ctx.lineTo(x + 120, y + h + 20);
    ctx.moveTo(x + 160, y + h + 20);
    ctx.lineTo(x + 220, y + 80);
    ctx.lineTo(x + 280, y + h + 20);
    ctx.fill();

    // Cold moon (fades at dawn)
    if (morning < 0.95) {
      ctx.save();
      ctx.globalAlpha = 1 - morning;
      ctx.fillStyle = '#E6F0FA';
      ctx.beginPath();
      ctx.arc(x + 90, y + 70, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawProps(ctx, live, time, mk) {
    // Dynamic props on wall/furniture:
    // 1. Fireplace (Embers pulsing when dirty, active fire tongues when caught)
    drawFireplaceActive(ctx, live, time, mk);

    // 2. TV Screen (Animated Static noise when dirty, Home movie when clean)
    drawTVScreen(ctx, live, time, mk);

    // 3. Lava lamp slow blobs when clean
    drawLavaLampBlobs(ctx, live, time, mk);
  }

  // ART: blockout - Cork board and lava lamp shelf
  function drawLavaLampBlobs(ctx, live, time, mk) {
    const isClean = mk.window > 0.8;
    if (!isClean) return;

    // Slow blobs floating inside lava lamp glass vessel (x: 1084–1104, y: 356–396)
    ctx.save();
    ctx.fillStyle = P.ember;
    // Blob 1
    const y1 = 374 + Math.sin(time * 0.45) * 11;
    ctx.beginPath();
    ctx.ellipse(1094, y1, 4.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Blob 2
    const y2 = 388 + Math.cos(time * 0.38 + 1.2) * 6;
    ctx.beginPath();
    ctx.ellipse(1093, y2, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Blob 3
    const y3 = 363 + Math.sin(time * 0.32 + 2.5) * 5;
    ctx.beginPath();
    ctx.ellipse(1095, y3, 3.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTVScreen(ctx, live, time, mk) {
    const { x, y, w, h } = TV_SCREEN;
    const isClean = mk.window > 0.8 || (mk.tvMovie ?? 0) >= 0.95;
    const movieT = isClean ? 1 : (mk.tvMovie ?? 0);
    const rollT = mk.tvRoll ?? 0;

    ctx.save();
    // Clip to curved CRT glass shape
    const tubePts = roundedRectPoints(x, y, w, h, 14);
    ctx.beginPath();
    tubePts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.clip();

    if (movieT < 0.98) {
      // Draw dynamic animated CRT static noise
      renderStaticNoise();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(staticCanvas, 0, 0, 75, 55, x, y, w, h);

      // Faint horizontal scanlines
      ctx.fillStyle = 'rgba(10, 15, 20, 0.22)';
      for (let ly = y; ly < y + h; ly += 4) {
        ctx.fillRect(x, ly, w, 1.5);
      }
    }

    if (movieT > 0.01 && live.homeMovieFrames) {
      // Home movie frames cross-fading
      const frameCount = live.homeMovieFrames.length;
      const loopTime = time * 0.85;
      const fIdx1 = Math.floor(loopTime) % frameCount;
      const fIdx2 = (fIdx1 + 1) % frameCount;
      const blend = S.clamp((loopTime % 1 - 0.7) / 0.3, 0, 1);

      // Slight handheld film camera jitter
      const jx = Math.sin(time * 16) * 0.8;
      const jy = Math.cos(time * 19) * 0.6;

      ctx.save();
      ctx.globalAlpha = movieT;
      ctx.drawImage(live.homeMovieFrames[fIdx1], x + jx, y + jy, w, h);
      if (blend > 0) {
        ctx.globalAlpha = movieT * blend;
        ctx.drawImage(live.homeMovieFrames[fIdx2], x + jx, y + jy, w, h);
      }
      ctx.restore();
    }

    // CRT vertical roll effect during makeover transition
    if (rollT > 0 && rollT < 1) {
      const rollY = y + ((time * 380) % h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fillRect(x, rollY, w, 12);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x, rollY - 18, w, 18);
    }

    // Glass glare / curve highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.3, y + h * 0.25, w * 0.22, h * 0.15, -0.2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawFireplaceActive(ctx, live, time, mk) {
    const { x0, x1, y0, y1 } = FIREBOX;
    const cx = (x0 + x1) * 0.5;
    const cy = y1 - 28;
    const isClean = mk.window > 0.8;
    const growth = isClean ? 1 : (mk.fireGrowth ?? (mk.wipe >= 1 ? 1 : 0));

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 + 4, y0 + 4, x1 - x0 - 8, y1 - y0 - 8);
    ctx.clip();

    if (growth <= 0.05) {
      // Dirty / Embers only: faint red-orange glow pulsing
      const emberFlicker = 0.7 + 0.3 * Math.sin(time * 3.5);
      ctx.fillStyle = S.rgba(P.ember, 0.55 * emberFlicker);
      for (let i = 0; i < 11; i++) {
        const ex = cx + Math.sin(i * 1.7) * 48;
        const ey = cy + Math.cos(i * 2.3) * 6;
        ctx.beginPath();
        ctx.arc(ex, ey, 2.5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Fire caught: soft tongues, each three stacked gradient layers (an
      // amber haze, an ember body, a pale core), swaying on their own.
      const fH = growth * 82;

      // The bed of embers glowing under the logs.
      const bed = ctx.createRadialGradient(cx, cy + 6, 4, cx, cy + 6, 90 * growth);
      bed.addColorStop(0, S.rgba(P.dawn, 0.9 * growth));
      bed.addColorStop(0.35, S.rgba(P.ember, 0.75 * growth));
      bed.addColorStop(1, S.rgba(P.ember, 0));
      ctx.fillStyle = bed;
      ctx.fillRect(cx - 100, cy - 40, 200, 80);

      ctx.globalCompositeOperation = 'lighter';
      const tongues = 9;
      for (let i = 0; i < tongues; i++) {
        const u = i / (tongues - 1);
        const middle = Math.sin(u * Math.PI); // taller in the middle of the grate
        const tx = cx - 62 + u * 124 + live.noise(time * 1.3 + i * 7.1) * 6;
        const h = fH * (0.5 + 0.5 * middle) * (0.72 + 0.36 * (0.5 + 0.5 * live.noise(time * 2.7 + i * 3.3)));
        const sway = live.noise(time * 1.9 + i * 5.7) * 12;
        drawFlameTongue(ctx, tx, cy, 13 + 8 * middle, h, sway, growth);
      }
      ctx.globalCompositeOperation = 'source-over';

      // Sparks rising from the fire and winking out.
      for (let i = 0; i < 7; i++) {
        const k = (time * 0.6 + i * 0.37) % 1;
        const sx = cx + Math.sin(i * 2.1 + time * 0.8) * 40 + k * 10;
        const sy = cy - k * 150 * growth;
        ctx.fillStyle = S.rgba(P.dawn, (1 - k) * 0.85 * growth);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.6 * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // One flame tongue: three nested layers, outer to inner. Each is a curved
  // teardrop whose colour fades to nothing at the tip, so there are no hard
  // points, and the outer haze softens the edges without a blur filter.
  function drawFlameTongue(ctx, x, base, w, h, sway, k) {
    const layers = [
      { s: 1, c0: P.ember, c1: P.amber, a: 0.32 },
      { s: 0.68, c0: P.ember, c1: P.amber, a: 0.55 },
      { s: 0.38, c0: P.dawn, c1: P.dawn, a: 0.7 },
    ];
    for (const L of layers) {
      const lw = w * L.s;
      const lh = h * (0.55 + L.s * 0.45);
      const grad = ctx.createLinearGradient(x, base, x + sway, base - lh);
      grad.addColorStop(0, S.rgba(L.c0, L.a * k));
      grad.addColorStop(0.55, S.rgba(L.c1, L.a * 0.7 * k));
      grad.addColorStop(1, S.rgba(L.c1, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - lw, base);
      ctx.bezierCurveTo(x - lw * 1.15, base - lh * 0.45, x + sway * 0.6 - lw * 0.35, base - lh * 0.78, x + sway, base - lh);
      ctx.bezierCurveTo(x + sway * 0.6 + lw * 0.35, base - lh * 0.78, x + lw * 1.15, base - lh * 0.45, x + lw, base);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ── Lights & Glow Passes (ART-DIRECTION §6) ─────────────────────────────

  function updateSurge(live, time, dt = 0.016) {
    live.nextSurge -= dt;
    if (live.nextSurge <= 0) {
      // Trigger surge: 0.22 s duration
      live.surgeDuration = 0.22;
      // Next surge in 3.5 to 5.5 s
      live.nextSurge = 3.5 + Math.random() * 2.0;
    }
    if (live.surgeDuration > 0) {
      live.surgeDuration -= dt;
      live.surge = Math.max(0, live.surgeDuration / 0.22);
    } else {
      live.surge = 0;
    }
  }

  // Moonlight through the blinds. Each gap between the slats lets through a
  // band of light; on the floor in front of the window those bands land as
  // stripes, nearer ones wider (perspective) and sheared right (the moon is
  // high on the left), crossing the armchair and the edge of the rug. In the
  // dirty state a slat hangs crooked: one stripe is missing, one is doubled.
  const STRIPE_FOOT = { far: { y: 790, x0: 190, x1: 560 }, near: { y: 1075, x0: 520, x1: 1060 } };

  function blindStripes(clean) {
    const { far, near } = STRIPE_FOOT;
    const n = 9;
    const bands = [];
    for (let i = 0; i < n; i++) {
      if (!clean && i === 5) continue;
      const t0 = Math.pow(i / n, 1.2);
      const t1 = Math.pow((i + (!clean && i === 6 ? 0.85 : 0.5)) / n, 1.2);
      const edge = (t) => {
        const y = S.lerp(far.y, near.y, t);
        return [S.lerp(far.x0, near.x0, t), S.lerp(far.x1, near.x1, t), y];
      };
      const [a0, a1, ya] = edge(t0);
      const [b0, b1, yb] = edge(t1);
      bands.push([[a0, ya], [a1, ya], [b1, yb], [b0, yb]]);
    }
    return bands;
  }

  // The visible beams in the dusty air: one thin shaft per gap, from the
  // window down to its own stripe on the floor.
  function getBlindShafts(clean = false) {
    const { x, y, w } = WINDOW;
    return blindStripes(clean).map((band, i) => {
      const sy = y + 26 + i * 27;
      return [
        [x + 20, sy],
        [x + w - 20, sy + 6],
        [band[2][0], band[2][1]],
        [band[3][0], band[3][1]],
      ];
    });
  }

  // LightMap.shaft() widens its quad by ±36 px for soft edges, which would
  // melt nine stripes into one patch. Stripes are drawn straight into the
  // light map instead: a firm core and a fainter fringe, additive like every
  // other light, and registered so dust and silk can ask how lit they are.
  function stripeLight(lm, quad, color, intensity) {
    const g = lm.ctx; // begin() leaves it in stage units, compositing 'lighter'
    const fill = (q, a) => {
      g.fillStyle = S.rgba(color, a * intensity);
      g.beginPath();
      g.moveTo(q[0][0], q[0][1]);
      for (let i = 1; i < q.length; i++) g.lineTo(q[i][0], q[i][1]);
      g.closePath();
      g.fill();
    };
    const grow = (q, k) => {
      const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
      const cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
      return q.map(([px, py]) => [cx + (px - cx) * (1 + k), cy + (py - cy) * (1 + k * 1.6)]);
    };
    fill(grow(quad, 0.06), 0.14);
    fill(quad, 0.34);
    lm.lights.push({ kind: 'shaft', quad, intensity: intensity * 0.8 });
  }

  function lights(lm, live, time, mk) {
    const flick = S.light.flicker(live.noise, time, 0.4);
    const isClean = mk.window > 0.8;
    const tvScrX = (TV_SCREEN.x + TV_SCREEN.w * 0.5);
    const tvScrY = (TV_SCREEN.y + TV_SCREEN.h * 0.5);

    // 1. TV static glow: cold blue-white light pulsing
    const surge = Math.max(live.surge ?? 0, live.qaSurge ?? 0);
    const tvColor = isClean ? P.dawn : '#A6C2E2';
    const baseTvIntensity = isClean ? 0.6 : 0.65 * flick;
    const tvIntensity = baseTvIntensity + surge * 0.95; // Surges to ~2x brightness
    const tvRadius = isClean ? 520 : 580 + surge * 520;

    lm.point(tvScrX, tvScrY, tvRadius, tvColor, tvIntensity);
    lm.cone(tvScrX, tvScrY, Math.PI * 0.62, 1.4, tvRadius * 1.1, tvColor, tvIntensity * 0.85);
    if (!isClean) lm.point(tvScrX - 40, 905, 380, tvColor, 0.3 * flick + surge * 0.35);

    // Mid-surge room reveal: illuminates the whole room and reveals spiders in dark corners
    if (surge > 0.05) {
      lm.point(960, 480, 1500, '#A6C2E2', 0.55 * surge);
      lm.point(260, 160, 700, '#A6C2E2', 0.65 * surge); // Upper left corner (reveals crawler)
      lm.point(1640, 360, 700, '#A6C2E2', 0.65 * surge); // Upper right corner (reveals crawler)
    }

    // 2. Striped Moonlight shafts through Venetian blinds
    // 9 thin parallel quads with shadow gaps between them
    const shaftHex = isClean ? P.dawn : P.moon;
    const shaftIntensity = isClean ? 0.45 : 0.65;
    for (const band of blindStripes(isClean)) stripeLight(lm, band, shaftHex, isClean ? 0.8 : 1);
    // The beams themselves, so motes and silk inside them catch the light.
    for (const quad of getBlindShafts(isClean)) {
      lm.lights.push({ kind: 'shaft', quad, intensity: shaftIntensity * 0.6 });
    }
    // A soft spill around the window itself.
    lm.point(WINDOW.x + WINDOW.w * 0.5, WINDOW.y + WINDOW.h * 0.6, 380, shaftHex, 0.3);

    // 3. Fireplace: embers (dirty) -> warm fire flames (clean/makeover)
    const fireGrowth = isClean ? 1 : (mk.fireGrowth ?? (mk.wipe >= 1 ? 1 : 0));
    const fireX = (FIREBOX.x0 + FIREBOX.x1) * 0.5;
    const fireY = FIREBOX.y1 - 32;

    if (fireGrowth <= 0.05) {
      // Faint breathing red-orange ember glow
      const emberBreath = 0.28 + 0.12 * Math.sin(time * 2.8);
      lm.point(fireX, fireY, 240, P.ember, emberBreath);
    } else {
      // Active roaring fire flames: warm flickering light source
      const fireFlick = 0.85 + 0.15 * Math.sin(time * 24);
      lm.point(fireX, fireY, 560 * fireGrowth, P.ember, 0.95 * fireFlick * fireGrowth);
      lm.cone(fireX, fireY, -Math.PI / 2, 2.0, 500 * fireGrowth, P.amber, 0.7 * fireFlick * fireGrowth);
      lm.point(fireX, 890, 460 * fireGrowth, P.amber, 0.5 * fireFlick * fireGrowth);
    }

    // 4. Off until makeover: Picture light over painting
    if (isClean || (mk.pictureLight ?? 0) > 0.02) {
      const plIntensity = isClean ? 1 : mk.pictureLight;
      const plX = (PAINTING.x + PAINTING.w * 0.5);
      const plY = PIC_LIGHT.y + PIC_LIGHT.h;
      lm.cone(plX, plY, Math.PI / 2, 1.35, 360, P.dawn, 0.75 * plIntensity);
      lm.point(plX, plY + 40, 240, P.dawn, 0.5 * plIntensity);
    }

    // 5. Off until makeover: Table lamp on foreground right side table
    if (isClean || (mk.tableLamp ?? 0) > 0.02) {
      const tlIntensity = isClean ? 1 : mk.tableLamp;
      lm.point(TABLE_LAMP.x, TABLE_LAMP.y - 10, 480, P.amber, 0.78 * tlIntensity);
      lm.cone(TABLE_LAMP.x, TABLE_LAMP.y + 10, Math.PI / 2, 1.8, 400, P.amber, 0.6 * tlIntensity);
    }

    // ART: blockout - Cork board and lava lamp shelf
    // 6. Tiny warm-red light source from lava lamp when clean
    if (isClean) {
      lm.point(1094, 380, 160, P.ember, 0.45);
    }

    return flick;
  }

  function glow(ctx, lm, live, time, mk, flick, shift) {
    const isClean = mk.window > 0.8;
    const surge = Math.max(live.surge ?? 0, live.qaSurge ?? 0);
    const tvScrX = (TV_SCREEN.x + TV_SCREEN.w * 0.5);
    const tvScrY = (TV_SCREEN.y + TV_SCREEN.h * 0.5);

    // 1. TV Screen bloom
    const tvBloomColor = isClean ? P.dawn : '#C2D8F2';
    S.light.glow(ctx, tvScrX, tvScrY, 180 + surge * 180, tvBloomColor, 0.5 + surge * 0.45);

    // 2. Striped moonlight shafts through blinds (nested soft quads, no live blur)
    const shaftHex = isClean ? P.dawn : P.moon;
    for (const quad of getBlindShafts(isClean)) {
      S.light.beam(ctx, quad, shaftHex, isClean ? 0.1 : 0.14);
    }
    // The stripes on the floor glint a little, like the reference's window pool.
    for (const band of blindStripes(isClean)) {
      const cx = (band[0][0] + band[2][0]) / 2;
      const cy = (band[0][1] + band[2][1]) / 2;
      S.light.glow(ctx, cx, cy, 70, shaftHex, isClean ? 0.06 : 0.09);
    }
    // Window bloom
    S.light.glow(ctx, WINDOW.x + WINDOW.w * 0.5, WINDOW.y + WINDOW.h * 0.5, 240, shaftHex, 0.28);

    // 3. Fireplace glow
    const fireGrowth = isClean ? 1 : (mk.fireGrowth ?? (mk.wipe >= 1 ? 1 : 0));
    const fireX = (FIREBOX.x0 + FIREBOX.x1) * 0.5;
    const fireY = FIREBOX.y1 - 32;

    if (fireGrowth <= 0.05) {
      S.light.glow(ctx, fireX, fireY, 80, P.ember, 0.35);
    } else {
      S.light.glow(ctx, fireX, fireY - 20, 240 * fireGrowth, P.ember, 0.7 * fireGrowth);
      S.light.glow(ctx, fireX, fireY - 10, 120 * fireGrowth, P.amber, 0.85 * fireGrowth);
    }

    // 4. Picture light fixture glow
    if (isClean || (mk.pictureLight ?? 0) > 0.05) {
      const plX = (PAINTING.x + PAINTING.w * 0.5);
      const plY = PIC_LIGHT.y + PIC_LIGHT.h * 0.5;
      S.light.glow(ctx, plX, plY, 80, P.dawn, 0.65 * (isClean ? 1 : mk.pictureLight));
    }

    // 5. Table lamp glow
    if (isClean || (mk.tableLamp ?? 0) > 0.05) {
      S.light.glow(ctx, TABLE_LAMP.x, TABLE_LAMP.y, 180, P.amber, 0.72 * (isClean ? 1 : mk.tableLamp));
    }

    // ART: blockout - Cork board and lava lamp shelf
    // 6. Faint warm-red glow from lava lamp when clean
    if (isClean) {
      S.light.glow(ctx, 1094, 380, 50, P.ember, 0.35);
    }
  }

  // ── Makeover & Unique Beat (ART-DIRECTION §10) ──────────────────────────

  const BEAT = {
    pictureLight: 2.2,
    tableLamp: 2.8,
    fireCatch: 3.3,
    tvRoll: 4.6,
  };

  const makeover = {
    beats: [
      { key: 'pictureLight', from: 2.2, to: 2.6, ease: 'out', chime: 0.35 },
      { key: 'tableLamp', from: 2.8, to: 3.2, ease: 'out', chime: 0.65 },
    ],
    uniqueBeat: {
      key: 'fire',
      at: BEAT.fireCatch,
      run(mk, t, fx) {
        // At t = 3.3 s the embers glow brighter, then the fire catches:
        // flames rise across the logs over 1.2 s (t 3.3 to 4.5).
        // Web across opening shrivels and burns away; fire crackle sound starts.
        const span = (a, b) => S.clamp((t - a) / (b - a), 0, 1);
        mk.fireGrowth = span(BEAT.fireCatch, BEAT.fireCatch + 1.2);

        // At t = 3.35 s, fireplace web shrivels and burns away
        if (t >= 3.35 && !mk.fireWebBurned) {
          mk.fireWebBurned = true;
          // Release first web (fireplace web)
          const firstWeb = window.__spyder?.world?.webs?.[0];
          if (firstWeb) {
            firstWeb.release();
            for (const a of firstWeb.anchors) fx.burst.sparkle(a.x, a.y, 4, P.amber);
          }
        }

        // Fire sparks rising into the chimney flue
        if (mk.fireGrowth > 0.1 && Math.random() < 0.4) {
          const cx = (FIREBOX.x0 + FIREBOX.x1) * 0.5;
          fx.burst.sparkle(
            cx + (Math.random() - 0.5) * 80,
            FIREBOX.y1 - 40 - mk.fireGrowth * 30,
            2,
            P.amber
          );
        }

        // Procedural fire crackle sound
        if (mk.fireGrowth > 0.15 && Math.random() < 0.25) {
          const a = fx.audio;
          if (a && a.ctx && !a.muted) {
            a.noise({
              duration: 0.04,
              filter: 'bandpass',
              freq: 1100 + Math.random() * 800,
              q: 3.5,
              gain: 0.12 * mk.fireGrowth,
            });
          }
        }

        // At t = 4.6 s, the TV static rolls vertically and becomes the home movie
        if (t >= BEAT.tvRoll) {
          mk.tvRoll = span(BEAT.tvRoll, BEAT.tvRoll + 0.45);
          mk.tvMovie = span(BEAT.tvRoll + 0.2, BEAT.tvRoll + 0.6);

          if (!mk.tvRolledSound) {
            mk.tvRolledSound = true;
            const a = fx.audio;
            if (a && a.ctx && !a.muted) {
              a.tone({
                type: 'sawtooth',
                freq: 60,
                duration: 0.35,
                gain: 0.06,
              });
            }
          }
        }
      },
    },
  };

  // ── Gameplay Rules (Director & Spawning) ────────────────────────────────

  const rules = {
    quota: 18,
    webGoal: 0.85,
    types: ['string', 'crawler'],
    spawnPattern: ['crawler', 'string', 'crawler', 'crawler', 'string', 'crawler', 'string', 'crawler'],
    maxAlive: [3, 4],
    spawnInterval: [2.4, 1.3],
  };

  // ── QA Staging Hooks (ART-DIRECTION §15) ────────────────────────────────

  const qa = {
    heroX: {
      dirty: 320, // Standing near the armchair
      makeover: 980, // Beside the rug, watching the transformation
      clean: 980, // In the warm room, clear of fireplace
    },
    action: {
      heroX: 720,
      strings: [
        { x: 370, targetY: 480, seed: 711 },
        { x: 1260, targetY: 530, seed: 712 },
      ],
      crawlers: [
        { lair: { x: 1290, y: 595 }, seed: 713 },
      ],
      eggs: [
        { x: 1010, y: 640 },
      ],
      hatchlings: [
        { x: 880, seed: 714 },
      ],
      tear: { webs: 2, path: [140, 200, 460, 240] },
      kills: 9,
      score: 6420,
      nerve: 72,
      aimAt: { x: 370, y: 480 },
    },
    states: {
      // Custom QA state: 'surge'
      // TV mid-surge (2x brightness), two wall crawlers revealed in the corners,
      // hero on the mantel platform aiming upward.
      surge(api) {
        api.setState('playing');
        api.holdDirector();
        const world = api.world;
        const live = world.live;
        live.qaSurge = 1.0; // Force full surge brightness
        live.surge = 1.0;

        // Place hero on mantel platform (x: 720, mantel)
        api.placeHero(720, 'mantel');
        api.hero.facing = 1;
        api.setNerve(85);
        api.setScore({ score: 4800, combo: 2, kills: 6 });

        // Two crawlers revealed in corners by the TV surge:
        // 1. Above blinds in upper-left corner (fully within wall plane)
        api.spawn('crawler', { lair: { x: 250, y: 145 }, emerged: true, seed: 801 });
        // 2. On wall near bookshelf in upper-right corner
        api.spawn('crawler', { lair: { x: 1620, y: 340 }, emerged: true, seed: 802 });

        // Aim up-right at crawler 2 near the bookshelf
        api.aimAt(1620, 340);
        api.step(0.4);
      },
    },
  };

  // ── Register Room ──────────────────────────────────────────────────────

  S.rooms.register({
    id: 'family-room',
    number: 3,
    act: 1,
    name: 'Family Room',
    layout,
    paint,
    makeWebs,
    createLive,
    drawSky,
    drawProps,
    lights,
    glow,
    rules,
    makeover,
    storyObject: 'On the television: a home movie. A child waves at whoever is filming.',
    qa,

    onStart(world, info) {
      const live = world.live;
      live.surge = 0;
      live.nextSurge = 3.5;
      live.surgeDuration = 0;
      live.qaSurge = 0;
      live.fireWebBurned = false;
    },

    onUpdate(dt, world) {
      if (!world.live.qaSurge) {
        updateSurge(world.live, world.time, dt);
      }
    },
  });
})();
