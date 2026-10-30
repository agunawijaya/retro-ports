/*
 * Spyder — Room 7, the Upstairs Hallway: painting, light and glow.
 *
 * The logic is in room.js (layout, platforms, lairs, the doors that creak
 * ajar). This file paints, and reads the state room.js keeps on `live`
 * (`live.doors`: 0 shut … 1 ajar, per door) and the makeover values on `mk`
 * (`sconce1`–`sconce4`, `doorC`, `ladder`).
 *
 * A long wall of four bedroom doors, the stairwell falling away on the left,
 * a tall window at the far right throwing moonlight back along the runner,
 * and the attic hatch open overhead with its ladder half down.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const { paintShape, wobblyPath, rectPoints, roundedRectPoints, ellipsePoints, softShadow, stain } = S.paint;

  // ── Layout (must match room.js) ───────────────────────────────────────

  const CEILING = 110;
  const PICTURE_RAIL = 150;
  const DADO = 560;
  const FLOOR_LINE = 770;
  const GROUND = 935;
  const DOOR = { y: 360, w: 180, h: 410 };
  const DOORS = [
    { id: 'A', x: 480, paint: 'cream' },
    { id: 'B', x: 820, paint: 'sage' },
    { id: 'C', x: 1160, paint: 'cream' },
    { id: 'D', x: 1500, paint: 'stone' },
  ];
  const SCONCES = [400, 740, 1080, 1420];
  const WINDOW = { x: 1730, y: 320, w: 120, h: 380 };
  const HATCH = { x0: 1350, x1: 1500, y0: 34, y1: 108 };
  const LADDER = { x0: 1378, x1: 1482, top: 108, bottom: 836, rungs: [800, 660, 520, 380, 240] };
  const STAIR = { x0: 110, x1: 440, top: FLOOR_LINE, bottom: 862 };
  const RUNNER = { x0: 130, x1: 1790, y0: 862, y1: 1000 };
  const TABLE = { x0: 690, x1: 790, top: 800 };
  const RADIATOR = { x0: 1700, x1: 1860, top: 820 };
  const LIGHT_DIR = { x: 0.55, y: -0.83 }; // the sconces are high, the window right

  const TONE = {
    paper: S.mixHex(P.linen, P.taupe, 0.35),
    paperDirty: S.mixHex(S.mixHex(P.linen, P.taupe, 0.55), P.oak, 0.15),
    panel: S.mixHex(P.moss, P.linen, 0.42),
    panelDirty: S.mixHex(S.mixHex(P.moss, P.taupe, 0.55), P.umber, 0.2),
    wood: S.mixHex(P.walnut, P.oak, 0.55),
    woodDirty: S.mixHex(P.walnut, P.umber, 0.4),
    doorCream: S.mixHex(P.linen, P.bone, 0.35),
    doorSage: S.mixHex(P.moss, P.linen, 0.6),
    doorStone: S.mixHex(P.taupe, P.linen, 0.45),
    runner: S.mixHex(P.rust, P.ember, 0.18),
    brass: P.brass,
    brassDirty: S.mixHex(P.brass, P.umber, 0.45),
  };

  const aged = (hex, clean, k = 1) => (clean ? hex : S.mixHex(S.shadeHex(hex, -0.2 * k), P.taupe, 0.22 * k));
  const doorColour = (d, clean) => aged({ cream: TONE.doorCream, sage: TONE.doorSage, stone: TONE.doorStone }[d.paint], clean);

  // ── Back layer ────────────────────────────────────────────────────────

  function paintBack(g, clean) {
    paintCeiling(g, clean);
    paintWallpaper(g, clean);
    paintPanelling(g, clean);
    paintWallDetails(g, clean);
    for (const d of DOORS) paintDoor(g, d, clean);
    paintHeightMarks(g, clean);
    for (const x of SCONCES) paintSconce(g, x, clean);
    paintWindowFrame(g, clean);
    paintFloor(g, clean);
    paintStairwell(g, clean);
    paintRunner(g, clean);
  }

  function paintCeiling(g, clean) {
    paintShape(g, rectPoints(0, 0, 1920, CEILING + 2), {
      color: clean ? S.mixHex(P.linen, P.taupe, 0.45) : P.umber,
      lightDir: { x: 0, y: 1 },
      light: 0.15,
      shadow: 0.45,
      strokes: 6,
      strokeAngle: 0,
      rim: 0,
      wobble: 0,
      seed: 7001,
    });
    // Cornice: three bands that catch light differently.
    for (const [y, h, tone] of [[CEILING - 18, 7, 0.12], [CEILING - 11, 6, -0.12], [CEILING - 5, 7, 0.2]]) {
      g.fillStyle = S.shade(clean ? '#8D7F6E' : '#5E544B', tone);
      g.fillRect(0, y, 1920, h);
    }
    // The attic hatch: a dark square hole with a moulded trim, and a breath
    // of cold light from a skylight somewhere up there.
    const { x0, x1, y0, y1 } = HATCH;
    paintShape(g, rectPoints(x0 - 10, y0 - 8, x1 - x0 + 20, y1 - y0 + 10), {
      color: aged(TONE.wood, clean),
      lightDir: { x: 0, y: 1 },
      light: 0.25,
      shadow: 0.4,
      strokes: 3,
      rim: 0.3,
      wobble: 0.4,
      seed: 7002,
    });
    const hole = g.createLinearGradient(0, y0, 0, y1);
    hole.addColorStop(0, S.mixHex(P.moon, P.soot, 0.75));
    hole.addColorStop(1, P.soot);
    g.fillStyle = hole;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Rafters inside.
    g.fillStyle = S.rgba(S.mixHex(P.walnut, P.soot, 0.5), 0.9);
    for (const rx of [1384, 1440, 1474]) g.fillRect(rx, y0, 8, y1 - y0);
    if (!clean) {
      g.strokeStyle = S.rgba(P.soot, 0.6);
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(200, 30);
      g.lineTo(290, 60);
      g.lineTo(340, 54);
      g.lineTo(430, 92);
      g.stroke();
      stain(g, 980, 50, 70, P.oak, 7003, 0.26);
    }
  }

  function paintWallpaper(g, clean) {
    paintShape(g, rectPoints(0, CEILING, 1920, DADO - CEILING + 4), {
      color: clean ? TONE.paper : TONE.paperDirty,
      lightDir: LIGHT_DIR,
      light: 0.12,
      shadow: 0.28,
      strokes: 9,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.12,
      variance: 0.07,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 7010,
    });
    // Small sprigs in a half-drop repeat: a curved stem, two leaves, three
    // tiny flowers. Low contrast; it is a texture, not a feature.
    const leaf = S.mixHex(P.moss, P.taupe, 0.3);
    const flower = S.mixHex(P.rust, P.linen, 0.35);
    const a = clean ? 0.3 : 0.2;
    for (let row = 0, y = CEILING + 70; y < DADO - 10; row++, y += 74) {
      for (let x = (row % 2) * 34 + 20; x < 1920; x += 68) {
        g.strokeStyle = S.rgba(leaf, a);
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x, y + 10);
        g.quadraticCurveTo(x + 4, y, x, y - 10);
        g.stroke();
        g.fillStyle = S.rgba(leaf, a);
        for (const s of [-1, 1]) {
          g.beginPath();
          g.ellipse(x + s * 5, y + 2, 5, 2.2, s * 0.7, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = S.rgba(flower, a * 1.1);
        for (const [fx, fy] of [[0, -12], [-4, -8], [4, -8]]) {
          g.beginPath();
          g.arc(x + fx, y + fy, 2.1, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // Picture rail.
    paintShape(g, rectPoints(0, PICTURE_RAIL - 4, 1920, 9), {
      color: aged(TONE.wood, clean),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.4,
      strokes: 4,
      strokeAngle: 0,
      rim: 0.3,
      wobble: 0,
      seed: 7011,
    });
    if (!clean) {
      for (const [x, r, seed] of [[260, 80, 7012], [1010, 60, 7013], [1650, 90, 7014]]) stain(g, x, 250, r, P.oak, seed, 0.24);
      for (const [x, seed] of [[200, 7015], [330, 7016], [760, 7017], [1110, 7018], [1880, 7019]]) tornStrip(g, x, seed);
    }
  }

  // A strip of wallpaper peeled from the top: the bare plaster shows where
  // it was, and the strip hangs, curling over at the bottom.
  function tornStrip(g, x, seed) {
    const rng = S.createRng(seed);
    const w = rng.range(26, 40);
    const top = CEILING + rng.range(20, 80);
    const len = rng.range(120, 200);
    g.fillStyle = S.mixHex(P.taupe, P.linen, 0.35);
    g.fillRect(x, top, w, len * 0.7);
    g.fillStyle = S.rgba(P.soot, 0.3);
    g.fillRect(x + w - 3, top, 3, len * 0.7);
    // The hanging strip, its back side (paler, no pattern) showing.
    const hang = [[x - 2, top + len * 0.6], [x + w + 2, top + len * 0.55], [x + w + 8, top + len], [x + 6, top + len + 14]];
    softShadow(g, x + w / 2 + 6, top + len + 8, w * 0.7, 6, 0.3);
    paintShape(g, hang, {
      color: S.mixHex(P.linen, P.bone, 0.3),
      lightDir: { x: -0.4, y: -0.9 },
      light: 0.2,
      shadow: 0.4,
      strokes: 3,
      rim: 0.2,
      wobble: 1.2,
      seed,
    });
  }

  function paintPanelling(g, clean) {
    const base = clean ? TONE.panel : TONE.panelDirty;
    paintShape(g, rectPoints(0, DADO, 1920, FLOOR_LINE - DADO), {
      color: base,
      lightDir: LIGHT_DIR,
      light: 0.12,
      shadow: 0.38,
      strokes: 9,
      strokeAngle: Math.PI / 2,
      rim: 0,
      innerShadow: 0.2,
      wobble: 0,
      seed: 7020,
    });
    // Raised panels between the doors, each with a bevel.
    const gaps = [[20, 470], [670, 810], [1010, 1150], [1350, 1490], [1690, 1910]];
    for (const [a, b] of gaps) {
      const n = Math.max(1, Math.round((b - a) / 150));
      const pw = (b - a) / n;
      for (let i = 0; i < n; i++) raisedPanel(g, a + i * pw + 12, DADO + 26, pw - 24, FLOOR_LINE - DADO - 56, clean);
    }
    // Dado rail and skirting.
    paintShape(g, rectPoints(0, DADO - 6, 1920, 12), {
      color: aged(TONE.wood, clean),
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.4,
      strokes: 4,
      strokeAngle: 0,
      rim: 0.4,
      wobble: 0,
      seed: 7021,
    });
    paintShape(g, rectPoints(0, FLOOR_LINE - 24, 1920, 24), {
      color: aged(TONE.wood, clean),
      lightDir: { x: 0, y: -1 },
      light: 0.25,
      shadow: 0.45,
      strokes: 6,
      strokeAngle: 0,
      rim: 0.3,
      wobble: 0,
      seed: 7022,
    });
  }

  function raisedPanel(g, x, y, w, h, clean) {
    const lit = clean ? 'rgba(255,248,232,0.3)' : 'rgba(210,215,225,0.1)';
    const dark = clean ? 'rgba(50,40,30,0.32)' : 'rgba(10,8,8,0.42)';
    const b = 8;
    g.fillStyle = lit;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w - b, y + b);
    g.lineTo(x + b, y + b);
    g.lineTo(x + b, y + h - b);
    g.lineTo(x, y + h);
    g.closePath();
    g.fill();
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(x + w, y);
    g.lineTo(x + w, y + h);
    g.lineTo(x, y + h);
    g.lineTo(x + b, y + h - b);
    g.lineTo(x + w - b, y + h - b);
    g.lineTo(x + w - b, y + b);
    g.closePath();
    g.fill();
  }

  // A barometer by the stairs, a silhouette portrait and a sampler between
  // the doors: the hallway as a family kept it.
  function paintWallDetails(g, clean) {
    const frame = (x, y, w, h, seed, oval) => {
      g.save();
      g.filter = 'blur(9px)';
      g.fillStyle = 'rgba(10,8,6,0.45)';
      g.fillRect(x - 6, y + 8, w + 10, h + 10);
      g.restore();
      const pts = oval ? ellipsePoints(x + w / 2, y + h / 2, w / 2, h / 2, 28) : rectPoints(x, y, w, h);
      paintShape(g, pts, {
        color: clean ? P.brass : TONE.brassDirty,
        lightDir: LIGHT_DIR,
        light: 0.3,
        shadow: 0.45,
        strokes: 6,
        rim: 0.4,
        wobble: 0.5,
        seed,
      });
    };
    // Barometer.
    frame(272, 360, 56, 140, 7030, false);
    paintShape(g, ellipsePoints(300, 410, 20, 20, 24), {
      color: clean ? P.bone : P.linen,
      lightDir: LIGHT_DIR,
      light: 0.2,
      shadow: 0.3,
      strokes: 2,
      rim: 0.2,
      wobble: 0.2,
      seed: 7031,
    });
    g.strokeStyle = S.rgba(P.soot, 0.8);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(300, 410);
    g.lineTo(312, 398);
    g.stroke();
    // Silhouette portrait: a child's profile cut in black paper.
    frame(712, 410, 56, 70, 7032, true);
    g.fillStyle = clean ? P.bone : P.linen;
    g.beginPath();
    g.ellipse(740, 445, 22, 29, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.rgba(P.soot, 0.9);
    g.beginPath();
    g.moveTo(734, 466);
    g.bezierCurveTo(728, 456, 732, 448, 736, 446);
    g.bezierCurveTo(738, 440, 744, 436, 746, 430);
    g.bezierCurveTo(748, 424, 744, 421, 740, 422);
    g.bezierCurveTo(733, 423, 730, 430, 732, 438);
    g.lineTo(729, 444);
    g.lineTo(733, 446);
    g.bezierCurveTo(729, 454, 728, 462, 734, 466);
    g.fill();
    // Sampler.
    frame(1050, 420, 60, 60, 7033, false);
    g.fillStyle = clean ? P.linen : S.mixHex(P.linen, P.taupe, 0.4);
    g.fillRect(1058, 428, 44, 44);
    g.fillStyle = S.rgba(P.rust, clean ? 0.7 : 0.4);
    for (let i = 0; i < 6; i++) g.fillRect(1062 + i * 7, 434, 3, 3);
    g.fillStyle = S.rgba(P.moss, clean ? 0.7 : 0.4);
    g.beginPath();
    g.moveTo(1080, 442);
    g.lineTo(1094, 456);
    g.lineTo(1066, 456);
    g.closePath();
    g.fill();
    g.fillRect(1072, 456, 16, 10);
  }

  /*
   * A four-panel door in its architrave: two tall panels over two short
   * ones, a brass knob and keyhole plate. Door C carries a painted name
   * plate. Door D, when dirty, hangs off its top hinge: tilted, a dark
   * wedge of gap showing above it.
   */
  function paintDoor(g, d, clean) {
    const { y, w, h } = DOOR;
    const x = d.x;
    // Architrave.
    paintShape(g, rectPoints(x - 16, y - 16, w + 32, h + 16), {
      color: aged(TONE.wood, clean),
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.45,
      strokes: 8,
      strokeAngle: Math.PI / 2,
      rim: 0.35,
      wobble: 0.5,
      seed: 7040 + x,
    });
    // The dark doorway behind the leaf.
    g.fillStyle = P.soot;
    g.fillRect(x, y, w, h);
    g.save();
    if (d.id === 'D' && !clean) {
      g.translate(x, y + h);
      g.rotate(-0.045);
      g.translate(-x, -(y + h));
    }
    paintLeaf(g, x, y, w, h, doorColour(d, clean), clean, 7050 + x, d.id === 'C');
    g.restore();
  }

  function paintLeaf(g, x, y, w, h, colour, clean, seed, nameplate) {
    paintShape(g, rectPoints(x + 2, y + 2, w - 4, h - 2), {
      color: colour,
      lightDir: LIGHT_DIR,
      light: 0.2,
      shadow: 0.38,
      strokes: 12,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.1,
      rim: 0.3,
      innerShadow: 0.3,
      wobble: 0.4,
      seed,
    });
    const px = 22;
    const pw = (w - px * 3) / 2;
    const rows = [[y + 26, h * 0.46], [y + 26 + h * 0.46 + 24, h * 0.36]];
    for (const [py, ph] of rows) {
      for (let i = 0; i < 2; i++) raisedPanel(g, x + px + i * (pw + px), py, pw, ph, clean);
    }
    // Brass knob and keyhole plate on the latch side.
    const kx = x + w - 24;
    const ky = y + h * 0.55;
    paintShape(g, roundedRectPoints(kx - 6, ky - 14, 12, 40, 5), {
      color: clean ? TONE.brass : TONE.brassDirty,
      lightDir: { x: -0.6, y: -0.8 },
      light: 0.4,
      shadow: 0.45,
      strokes: 1,
      rim: 0.4,
      wobble: 0.2,
      seed: seed + 1,
    });
    paintShape(g, ellipsePoints(kx, ky - 2, 8, 8, 16), {
      color: clean ? TONE.brass : TONE.brassDirty,
      lightDir: { x: -0.6, y: -0.8 },
      light: 0.5,
      shadow: 0.45,
      strokes: 1,
      rim: 0.5,
      rimColor: P.bone,
      wobble: 0.2,
      seed: seed + 2,
    });
    g.fillStyle = P.soot;
    g.beginPath();
    g.arc(kx, ky + 14, 2.2, 0, Math.PI * 2);
    g.fill();
    g.fillRect(kx - 1, ky + 14, 2, 6);
    if (nameplate) {
      // THOMAS, painted on a little wooden plaque by a child.
      paintShape(g, roundedRectPoints(x + w / 2 - 44, y + 74, 88, 30, 8), {
        color: S.mixHex(P.oak, P.linen, 0.35),
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.35,
        strokes: 4,
        rim: 0.3,
        wobble: 0.6,
        seed: seed + 3,
      });
      const colours = [P.rust, P.moss, S.mixHex(P.moon, P.taupe, 0.3), P.rust, P.moss, S.mixHex(P.moon, P.taupe, 0.3)];
      g.font = '700 22px Caveat, "Segoe Print", cursive';
      g.textAlign = 'center';
      [...'THOMAS'].forEach((ch, i) => {
        g.save();
        g.translate(x + w / 2 - 32 + i * 13, y + 97 + (i % 2 ? -1 : 1));
        g.rotate((i % 3 - 1) * 0.08);
        g.fillStyle = clean ? colours[i] : S.mixHex(colours[i], P.taupe, 0.5);
        g.fillText(ch, 0, 0);
        g.restore();
      });
    }
    if (!clean) {
      g.fillStyle = S.rgba(P.umber, 0.16);
      g.fillRect(x + 2, y + h - 80, w - 4, 78);
    }
  }

  /*
   * The story: Thomas measured every birthday on door C's left frame. A
   * pencil line across the frame for each year, his name and age beside
   * it on the wall, the dates under them. The last mark is at eight.
   */
  function paintHeightMarks(g, clean) {
    const jamb = 1152;
    const marks = [
      [3, 580, '4/71'],
      [4, 566, '4/72'],
      [5, 553, '4/73'],
      [6, 541, '4/74'],
      [7, 529, '4/75'],
      [8, 518, '4/76'],
    ];
    const lead = clean ? S.rgba(S.mixHex(P.gear, P.soot, 0.3), 0.85) : S.rgba(P.taupe, 0.55);
    g.save();
    g.strokeStyle = lead;
    g.fillStyle = lead;
    g.lineWidth = 1.3;
    g.textAlign = 'right';
    marks.forEach(([age, y, date], i) => {
      g.beginPath();
      g.moveTo(jamb - 8 - (i % 2) * 4, y);
      g.lineTo(jamb + 10, y + (i % 2 ? 1 : -0.5));
      g.stroke();
      g.font = '700 14px Caveat, "Segoe Print", cursive';
      g.fillText(`Thomas ${age}`, jamb - 12, y + 4);
      g.font = '500 10px Caveat, "Segoe Print", cursive';
      g.fillText(date, jamb - 74, y + 4);
    });
    g.restore();
    if (!clean) {
      // Fifteen years of dust: the marks are lines, but nothing is legible.
      const dust = g.createLinearGradient(1060, 0, 1162, 0);
      dust.addColorStop(0, S.rgba(P.taupe, 0));
      dust.addColorStop(0.3, S.rgba(S.mixHex(P.taupe, P.linen, 0.4), 0.72));
      dust.addColorStop(1, S.rgba(S.mixHex(P.taupe, P.linen, 0.4), 0.72));
      g.fillStyle = dust;
      g.fillRect(1060, 505, 102, 90);
    }
  }

  // A brass wall plate, a curved arm, a frosted tulip shade opening upward.
  function paintSconce(g, x, clean) {
    const metal = clean ? TONE.brass : TONE.brassDirty;
    paintShape(g, ellipsePoints(x, 336, 9, 15, 16), {
      color: metal,
      lightDir: LIGHT_DIR,
      light: 0.4,
      shadow: 0.45,
      strokes: 1,
      rim: 0.4,
      wobble: 0.2,
      seed: 7060 + x,
    });
    g.strokeStyle = metal;
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, 340);
    g.bezierCurveTo(x + 18, 342, x + 20, 326, x + 8, 318);
    g.stroke();
    paintShape(g, [[x - 2, 318], [x + 18, 318], [x + 30, 286], [x - 14, 286]], {
      color: clean ? S.mixHex(P.bone, P.linen, 0.4) : S.mixHex(P.linen, P.taupe, 0.55),
      lightDir: { x: 0, y: -1 },
      light: 0.25,
      shadow: 0.3,
      strokes: 3,
      rim: 0.35,
      rimColor: P.bone,
      innerShadow: 0.2,
      wobble: 0.6,
      seed: 7061 + x,
    });
    if (!clean && x !== SCONCES[0]) {
      // The dead ones are wrapped in old silk.
      g.strokeStyle = S.rgba(P.silk, 0.35);
      g.lineWidth = 0.8;
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.moveTo(x - 14 + k * 3, 286);
        g.quadraticCurveTo(x + 8, 270 - k * 3, x + 30 - k * 2, 286 + k * 4);
        g.stroke();
      }
    }
  }

  // The tall sash window: the glass is left open so drawSky shows through.
  function paintWindowFrame(g, clean) {
    const { x, y, w, h } = WINDOW;
    const wood = clean ? P.linen : S.mixHex(P.linen, P.taupe, 0.5);
    const opts = (seed) => ({
      color: wood,
      lightDir: { x: -0.6, y: -0.8 },
      light: 0.2,
      shadow: 0.4,
      strokes: 3,
      rim: 0.3,
      rimColor: P.moon,
      wobble: 0.3,
      seed,
    });
    paintShape(g, rectPoints(x - 16, y - 16, 16, h + 32), opts(7070));
    paintShape(g, rectPoints(x + w, y - 16, 16, h + 32), opts(7071));
    paintShape(g, rectPoints(x - 16, y - 16, w + 32, 16), opts(7072));
    paintShape(g, rectPoints(x - 26, y + h, w + 52, 16), opts(7073));
    // Meeting rail between the sashes, and glazing bars.
    paintShape(g, rectPoints(x, y + h / 2 - 6, w, 12), opts(7074));
    g.fillStyle = wood;
    g.fillRect(x + w / 2 - 3, y, 6, h);
    for (const yy of [y + h * 0.25, y + h * 0.75]) g.fillRect(x, yy - 3, w, 6);
    if (!clean) {
      // A cracked pane and a grime line on the lower sash.
      g.strokeStyle = S.rgba(P.bone, 0.45);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 12, y + h * 0.56);
      g.lineTo(x + 40, y + h * 0.66);
      g.lineTo(x + 30, y + h * 0.72);
      g.stroke();
    }
  }

  // Floorboards in the reference perspective (vanishing point above).
  function paintFloor(g, clean) {
    const vp = { x: 960, y: -900 };
    const top = FLOOR_LINE;
    const bottom = 1080;
    const base = clean ? S.mixHex(P.oak, P.walnut, 0.3) : S.mixHex(P.walnut, P.oak, 0.38);
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
      seed: 7080,
    });
    const xAt = (xb, y) => vp.x + (xb - vp.x) * ((y - vp.y) / (bottom - vp.y));
    const rng = S.createRng(7081);
    for (let xb = -300; xb < 2300; xb += 120) {
      g.fillStyle = S.rgba(S.shadeHex(base, rng.range(-0.12, 0.08)), 0.4);
      g.beginPath();
      g.moveTo(xAt(xb, top), top);
      g.lineTo(xAt(xb + 120, top), top);
      g.lineTo(xb + 120, bottom);
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
        g.lineTo(xAt(xb + 120, y), y);
        g.stroke();
        y += rng.range(140, 260) * ((y - vp.y) / (bottom - vp.y));
      }
    }
    const fall = g.createRadialGradient(1300, 900, 200, 1100, 940, 1100);
    fall.addColorStop(0, 'rgba(0,0,0,0)');
    fall.addColorStop(1, S.rgba(P.soot, clean ? 0.32 : 0.48));
    g.fillStyle = fall;
    g.fillRect(0, top, 1920, bottom - top);
    const join = g.createLinearGradient(0, top, 0, top + 26);
    join.addColorStop(0, S.rgba(P.soot, 0.5));
    join.addColorStop(1, S.rgba(P.soot, 0));
    g.fillStyle = join;
    g.fillRect(0, top, 1920, 26);
  }

  // The stairwell: an opening in the floor along the back wall, the top
  // steps catching a little moonlight and then darkness.
  function paintStairwell(g, clean) {
    const { x0, x1, top, bottom } = STAIR;
    const dark = g.createLinearGradient(x1, 0, x0, 0);
    dark.addColorStop(0, S.mixHex(P.umber, P.soot, 0.4));
    dark.addColorStop(1, P.soot);
    g.fillStyle = dark;
    g.fillRect(x0, top, x1 - x0, bottom - top);
    // Steps descending to the left, each tread a lit nosing over a dark riser.
    for (let i = 0; i < 6; i++) {
      const sx1 = x1 - i * 58;
      const sx0 = sx1 - 58;
      const sy = top + 10 + i * 13;
      const light = Math.max(0, 0.5 - i * 0.11);
      g.fillStyle = S.rgba(S.mixHex(P.oak, P.moon, 0.3), light);
      g.fillRect(Math.max(sx0, x0), sy, sx1 - Math.max(sx0, x0), 3);
      g.fillStyle = S.rgba(P.soot, 0.5);
      g.fillRect(Math.max(sx0, x0), sy + 3, sx1 - Math.max(sx0, x0), 10);
    }
    // The floor's edge where it stops at the opening.
    g.fillStyle = S.mixHex(P.walnut, P.oak, clean ? 0.5 : 0.3);
    g.fillRect(x0, bottom - 4, x1 - x0, 8);
    g.fillStyle = S.rgba(P.bone, 0.18);
    g.fillRect(x0, bottom - 4, x1 - x0, 2);
  }

  // The hall runner: rucked and grey when dirty, flat and deep red clean.
  function paintRunner(g, clean) {
    const { x0, x1, y0, y1 } = RUNNER;
    const colour = clean ? TONE.runner : S.mixHex(S.mixHex(P.rust, P.taupe, 0.5), P.linen, 0.12);
    const pts = clean
      ? [[x0, y0], [x1, y0], [x1 + 14, y1], [x0 - 14, y1]]
      : [[x0, y0], [940, y0], [1000, y0 - 14], [1060, y0 + 2], [x1, y0 + 4], [x1 + 12, y1], [1080, y1 - 2], [1010, y1 - 20], [950, y1], [x0 - 14, y1]];
    softShadow(g, (x0 + x1) / 2, y1 + 4, (x1 - x0) * 0.52, 16, 0.4);
    paintShape(g, pts, {
      color: colour,
      lightDir: { x: 0.5, y: -0.85 },
      light: 0.18,
      shadow: 0.38,
      strokes: 22,
      strokeAngle: 0,
      strokeJitter: 0.4,
      variance: 0.12,
      rim: 0.2,
      innerShadow: 0.3,
      wobble: 1.8,
      seed: 7090,
    });
    g.save();
    wobblyPath(g, pts, { wobble: 1.8, seed: 7090 });
    g.clip();
    // A border of two fine lines and a row of small lozenges.
    const line = clean ? S.mixHex(P.brass, P.linen, 0.3) : S.mixHex(P.linen, P.taupe, 0.4);
    g.strokeStyle = S.rgba(line, clean ? 0.45 : 0.25);
    g.lineWidth = 2;
    for (const off of [14, 22]) {
      g.beginPath();
      g.moveTo(x0, y0 + off);
      g.lineTo(x1, y0 + off);
      g.moveTo(x0, y1 - off);
      g.lineTo(x1, y1 - off);
      g.stroke();
    }
    g.fillStyle = S.rgba(line, clean ? 0.3 : 0.15);
    for (let x = x0 + 40; x < x1 - 20; x += 60) {
      const cy = (y0 + y1) / 2;
      g.beginPath();
      g.moveTo(x, cy - 12);
      g.lineTo(x + 12, cy);
      g.lineTo(x, cy + 12);
      g.lineTo(x - 12, cy);
      g.closePath();
      g.fill();
    }
    if (!clean) {
      // The ruck: a raised crest catching light, a shadow behind it.
      g.fillStyle = S.rgba(P.bone, 0.14);
      g.beginPath();
      g.ellipse(1000, y0 + 30, 50, 34, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = S.rgba(P.soot, 0.3);
      g.beginPath();
      g.ellipse(1040, y0 + 60, 34, 46, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.rgba(P.linen, 0.12);
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    g.restore();
    // Fringe at both ends.
    g.strokeStyle = S.rgba(clean ? P.linen : P.taupe, 0.6);
    g.lineWidth = 1.4;
    for (const [ex, dir] of [[x0 - 4, -1], [x1 + 4, 1]]) {
      for (let y = y0 + 4; y < y1; y += 6) {
        g.beginPath();
        g.moveTo(ex, y);
        g.lineTo(ex + dir * 10, y + 2);
        g.stroke();
      }
    }
  }

  // ── Furniture layer ───────────────────────────────────────────────────

  function paintFurniture(g, clean) {
    paintBanister(g, clean);
    paintSideTable(g, clean);
    paintRadiator(g, clean);
    paintStepStool(g, clean);
  }

  function paintBanister(g, clean) {
    const wood = aged(TONE.wood, clean);
    const rng = S.createRng(7100);
    for (let x = STAIR.x0 + 14; x < STAIR.x1; x += 22) {
      const broken = !clean && Math.abs(x - 252) < 11;
      const h = broken ? 46 : STAIR.bottom - 766;
      paintShape(g, [[x - 3, 766], [x + 3, 766], [x + 4, 766 + h * 0.4], [x + 2, 766 + h * 0.55], [x + 3, 766 + h], [x - 3, 766 + h], [x - 2, 766 + h * 0.55], [x - 4, 766 + h * 0.4]], {
        color: wood,
        lightDir: LIGHT_DIR,
        light: 0.2,
        shadow: 0.45,
        strokes: 1,
        rim: 0.25,
        wobble: 0.2,
        seed: 7101 + x,
      });
      if (broken) {
        // Snapped: the stump, and the rest lying in the stairwell.
        g.save();
        g.translate(x + 18, STAIR.bottom - 8);
        g.rotate(1.2);
        g.fillStyle = wood;
        g.fillRect(-3, -40, 6, 40);
        g.restore();
      }
      void rng;
    }
    // Handrail, with a newel post at the top of the stairs.
    paintShape(g, roundedRectPoints(STAIR.x0 - 8, 752, STAIR.x1 - STAIR.x0 + 16, 16, 7), {
      color: wood,
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.45,
      strokes: 6,
      strokeAngle: 0,
      rim: 0.4,
      wobble: 0.4,
      seed: 7102,
    });
    paintShape(g, rectPoints(STAIR.x1 - 4, 730, 26, STAIR.bottom - 730 + 6), {
      color: wood,
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.5,
      strokes: 4,
      strokeAngle: Math.PI / 2,
      rim: 0.35,
      wobble: 0.4,
      seed: 7103,
    });
    paintShape(g, ellipsePoints(STAIR.x1 + 9, 726, 17, 12, 18), {
      color: wood,
      lightDir: LIGHT_DIR,
      light: 0.4,
      shadow: 0.45,
      strokes: 2,
      rim: 0.4,
      wobble: 0.3,
      seed: 7104,
    });
  }

  function paintSideTable(g, clean) {
    const wood = aged(TONE.wood, clean);
    const { x0, x1, top } = TABLE;
    softShadow(g, (x0 + x1) / 2, GROUND + 2, 64, 10, 0.5);
    for (const lx of [x0 + 10, x1 - 16]) {
      paintShape(g, rectPoints(lx, top + 12, 6, GROUND - top - 12), {
        color: wood,
        lightDir: LIGHT_DIR,
        light: 0.2,
        shadow: 0.5,
        strokes: 1,
        rim: 0.2,
        wobble: 0.2,
        seed: 7110 + lx,
      });
    }
    paintShape(g, rectPoints(x0 + 6, top + 12, x1 - x0 - 12, 26), {
      color: wood,
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.45,
      strokes: 3,
      strokeAngle: 0,
      rim: 0.3,
      wobble: 0.3,
      seed: 7111,
    });
    g.fillStyle = TONE.brass;
    g.beginPath();
    g.arc((x0 + x1) / 2, top + 25, 2.5, 0, Math.PI * 2);
    g.fill();
    paintShape(g, rectPoints(x0, top, x1 - x0, 12), {
      color: wood,
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.4,
      strokes: 3,
      strokeAngle: 0,
      rim: 0.35,
      wobble: 0.3,
      seed: 7112,
    });
    // A vase, and two photographs: fallen flat when dirty, standing clean.
    paintShape(g, [[x0 + 14, top], [x0 + 32, top], [x0 + 36, top - 24], [x0 + 28, top - 40], [x0 + 18, top - 40], [x0 + 10, top - 24]], {
      color: S.mixHex(P.moon, P.taupe, 0.45),
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.4,
      strokes: 2,
      rim: 0.4,
      wobble: 0.3,
      seed: 7113,
    });
    g.strokeStyle = clean ? P.moss : S.mixHex(P.oak, P.taupe, 0.4);
    g.lineWidth = 1.6;
    for (const [dx, dy] of [[-10, -30], [2, -38], [12, -28]]) {
      g.beginPath();
      g.moveTo(x0 + 23, top - 40);
      g.quadraticCurveTo(x0 + 23 + dx * 0.5, top - 52, x0 + 23 + dx, top - 40 + dy);
      g.stroke();
      g.fillStyle = clean ? S.mixHex(P.dawn, P.rust, 0.35) : S.mixHex(P.oak, P.taupe, 0.4);
      g.beginPath();
      g.arc(x0 + 23 + dx, top - 40 + dy, clean ? 4 : 2.5, 0, Math.PI * 2);
      g.fill();
    }
    const photo = (fx, fy, w, h, seed) =>
      paintShape(g, rectPoints(fx, fy, w, h), {
        color: clean ? P.brass : TONE.brassDirty,
        lightDir: LIGHT_DIR,
        light: 0.3,
        shadow: 0.4,
        strokes: 1,
        rim: 0.35,
        wobble: 0.2,
        seed,
      });
    if (clean) {
      photo(x0 + 46, top - 30, 20, 30, 7114);
      photo(x0 + 70, top - 24, 18, 24, 7115);
      g.fillStyle = S.mixHex(P.linen, P.oak, 0.4);
      g.fillRect(x0 + 49, top - 27, 14, 24);
      g.fillRect(x0 + 73, top - 21, 12, 18);
      g.fillStyle = S.rgba(P.walnut, 0.7);
      g.beginPath();
      g.arc(x0 + 56, top - 18, 4, 0, Math.PI * 2);
      g.arc(x0 + 79, top - 13, 3, 0, Math.PI * 2);
      g.fill();
    } else {
      photo(x0 + 44, top - 5, 30, 5, 7116);
      photo(x0 + 70, top - 4, 22, 4, 7117);
    }
  }

  function paintRadiator(g, clean) {
    const { x0, x1, top } = RADIATOR;
    const iron = clean ? S.mixHex(P.bone, P.linen, 0.4) : S.mixHex(P.gear, P.rust, 0.3);
    softShadow(g, (x0 + x1) / 2, GROUND + 2, 90, 10, 0.5);
    const cols = 11;
    const cw = (x1 - x0) / cols;
    for (let i = 0; i < cols; i++) {
      paintShape(g, roundedRectPoints(x0 + i * cw + 1, top, cw - 2, GROUND - top - 14, 6), {
        color: iron,
        lightDir: { x: -0.4, y: -0.9 },
        light: 0.3,
        shadow: 0.45,
        strokes: 2,
        strokeAngle: Math.PI / 2,
        rim: 0.35,
        wobble: 0.3,
        seed: 7120 + i,
      });
    }
    for (const fx of [x0 + 8, x1 - 14]) {
      g.fillStyle = S.shadeHex(iron, -0.3);
      g.fillRect(fx, GROUND - 16, 6, 16);
    }
    if (!clean) {
      const rng = S.createRng(7121);
      for (let i = 0; i < 26; i++) {
        g.fillStyle = S.rgba(S.mixHex(P.rust, P.ember, 0.2), rng.range(0.3, 0.6));
        g.beginPath();
        g.ellipse(rng.range(x0, x1), rng.range(top + 4, GROUND - 16), rng.range(2, 6), rng.range(3, 9), 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // The previous cleaner tried to go up: a step stool tipped over under the
  // hatch and a coil of rope. Clean: the stool upright, the rope on it.
  function paintStepStool(g, clean) {
    const wood = clean ? S.mixHex(P.oak, P.linen, 0.25) : S.mixHex(P.oak, P.taupe, 0.4);
    g.save();
    if (clean) g.translate(1300, GROUND);
    else {
      g.translate(1290, GROUND - 2);
      g.rotate(-1.35);
    }
    softShadow(g, 0, 2, 44, 8, 0.45);
    for (const [lx, a] of [[-24, -0.12], [18, 0.12]]) {
      g.save();
      g.translate(lx, 0);
      g.rotate(a);
      paintShape(g, rectPoints(-3, -70, 6, 70), {
        color: wood,
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.45,
        strokes: 1,
        rim: 0.25,
        wobble: 0.2,
        seed: 7130 + lx,
      });
      g.restore();
    }
    paintShape(g, rectPoints(-30, -76, 60, 10), {
      color: wood,
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.4,
      strokes: 2,
      rim: 0.35,
      wobble: 0.3,
      seed: 7131,
    });
    paintShape(g, rectPoints(-22, -38, 44, 7), {
      color: wood,
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.45,
      strokes: 1,
      rim: 0.3,
      wobble: 0.2,
      seed: 7132,
    });
    g.restore();
    // The rope: on the floor beside it, or coiled on the seat.
    const [rx, ry] = clean ? [1300, GROUND - 82] : [1352, GROUND - 6];
    g.strokeStyle = S.mixHex(P.linen, P.oak, 0.45);
    g.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.ellipse(rx, ry - k * 2.5, 22 - k * 3, 6 - k * 0.6, 0, 0, Math.PI * 2);
      g.stroke();
    }
    if (!clean) {
      g.beginPath();
      g.moveTo(rx + 20, ry);
      g.quadraticCurveTo(rx + 60, ry + 6, rx + 76, ry - 4);
      g.stroke();
    }
  }

  // ── Front layer ───────────────────────────────────────────────────────

  function paintFront(g, clean) {
    g.save();
    g.filter = 'blur(7px)';
    // A fern on a plant stand in the right corner, a coat on a hook left.
    paintShape(g, [[1790, 1080], [1806, 960], [1880, 960], [1900, 1080]], {
      color: S.mixHex(P.walnut, P.soot, 0.35),
      light: 0.1,
      shadow: 0.4,
      strokes: 6,
      rim: 0.2,
      wobble: 1,
      seed: 7140,
    });
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.35;
      g.strokeStyle = clean ? S.mixHex(P.moss, P.linen, 0.2) : S.mixHex(P.moss, P.soot, 0.4);
      g.lineWidth = 12;
      g.beginPath();
      g.moveTo(1843, 960);
      g.quadraticCurveTo(1843 + Math.cos(a) * 60, 960 + Math.sin(a) * 90, 1843 + Math.cos(a) * 120, 940 + Math.sin(a) * 60 + 70);
      g.stroke();
    }
    paintShape(g, [[-20, 160], [70, 150], [96, 520], [40, 600], [-20, 580]], {
      color: S.mixHex(P.plum, P.soot, 0.4),
      light: 0.1,
      shadow: 0.4,
      strokes: 10,
      strokeAngle: Math.PI / 2,
      rim: 0.2,
      wobble: 2,
      seed: 7141,
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
      noise: S.createNoise(seed + 70),
      doors: { A: 0, B: 0, C: 0, D: 0 },
      leaves: new Map(),
    };
  }

  // Beyond the end window: night sky, a moon, a bare branch; dawn later.
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
      g.arc(x + w * 0.62, y + 70 + day * 200, 18, 0, Math.PI * 2);
      g.fill();
    }
    if (day > 0) {
      const sun = g.createRadialGradient(x + w * 0.4, y + h + 30 - day * 140, 6, x + w * 0.4, y + h - day * 140, 160);
      sun.addColorStop(0, `rgba(255,236,190,${day})`);
      sun.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = sun;
      g.fillRect(x, y, w, h);
    }
    g.strokeStyle = S.mix('#0C0E14', '#4A5A60', day);
    g.lineCap = 'round';
    const sway = live.noise(t * 0.3) * 0.05;
    const branch = (bx, by, a, len, wd, depth) => {
      if (depth === 0) return;
      const ex = bx + Math.cos(a + sway) * len;
      const ey = by + Math.sin(a + sway) * len;
      g.lineWidth = wd;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(ex, ey);
      g.stroke();
      branch(ex, ey, a - 0.45, len * 0.68, wd * 0.65, depth - 1);
      branch(ex, ey, a + 0.4, len * 0.6, wd * 0.6, depth - 1);
    };
    branch(x + w + 20, y + h * 0.55, Math.PI + 0.3, 90, 9, 4);
  }

  // A door leaf as a cached sprite, per door and per state, for drawing it
  // swung open over the painted one.
  function leafSprite(live, d, clean) {
    const key = `${d.id}:${clean}`;
    let c = live.leaves.get(key);
    if (!c) {
      c = S.makeCanvas(DOOR.w, DOOR.h);
      const g = c.getContext('2d');
      g.translate(-d.x, -DOOR.y);
      paintLeaf(g, d.x, DOOR.y, DOOR.w, DOOR.h, doorColour(d, clean), clean, 7050 + d.x, d.id === 'C');
      live.leaves.set(key, c);
    }
    return c;
  }

  /*
   * A door standing open by `open` (0 shut … 1 wide). Seen from the side,
   * the leaf swings away into the room: hinged on the left, it narrows and
   * darkens, and the dark doorway (or a lit room) shows on the right.
   */
  function drawOpenDoor(g, live, d, open, clean, inside) {
    if (open <= 0.005) return;
    const { y, w, h } = DOOR;
    const x = d.x;
    // C swings wide at the makeover. The others only creak ajar, and a
    // true 15° would leave a 6 px gap from the side: the gap is drawn
    // wider than life so the player sees which door a spider came from.
    const angle = open * (d.id === 'C' ? 1.25 : 0.26);
    const vis = d.id === 'C' ? Math.cos(angle) : 1 - open * 0.2;
    inside(g, x, y, w, h);
    g.save();
    g.translate(x, y);
    g.transform(vis, -Math.sin(angle) * 0.05, 0, 1, 0, 0);
    g.drawImage(leafSprite(live, d, clean), 0, 0);
    g.fillStyle = S.rgba(P.soot, Math.min(0.6, angle * 0.5));
    g.fillRect(0, 0, w, h);
    g.restore();
  }

  const darkRoom = (g, x, y, w, h) => {
    g.fillStyle = P.soot;
    g.fillRect(x, y, w, h);
  };

  // Thomas's room: a child's night-light, warm, and the shape of a bed.
  const thomasRoom = (g, x, y, w, h) => {
    const warm = g.createRadialGradient(x + w * 0.7, y + h * 0.75, 10, x + w * 0.6, y + h * 0.6, h * 0.8);
    warm.addColorStop(0, S.mixHex(P.dawn, P.bone, 0.3));
    warm.addColorStop(0.35, S.mixHex(P.amber, P.umber, 0.35));
    warm.addColorStop(1, S.mixHex(P.umber, P.soot, 0.5));
    g.fillStyle = warm;
    g.fillRect(x, y, w, h);
    g.fillStyle = S.rgba(P.soot, 0.45);
    g.fillRect(x + 20, y + h - 120, w * 0.5, 120);
    g.fillStyle = S.rgba(P.bone, 0.9);
    g.beginPath();
    g.arc(x + w * 0.72, y + h - 40, 6, 0, Math.PI * 2);
    g.fill();
  };

  function drawProps(g, live, t, mk) {
    const clean = mk.window > 0.5;
    // Doors A, B, D creak ajar while a spider comes out of them.
    for (const d of DOORS) {
      if (d.id === 'C') continue;
      drawOpenDoor(g, live, d, live.doors?.[d.id] ?? 0, clean, darkRoom);
    }
    // Thomas's door opens at the makeover; until then a warm line of
    // night-light shows under it, even in the dirty house.
    const c = DOORS[2];
    drawOpenDoor(g, live, c, S.clamp(mk.doorC ?? 0, 0, 1), clean, thomasRoom);
    const line = g.createLinearGradient(0, FLOOR_LINE - 6, 0, FLOOR_LINE + 2);
    line.addColorStop(0, S.rgba(P.dawn, 0));
    line.addColorStop(1, S.rgba(P.dawn, 0.85));
    g.fillStyle = line;
    g.fillRect(c.x + 6, FLOOR_LINE - 6, DOOR.w - 12, 8);
    drawAtticEyes(g, t, mk);
  }

  // Up in the attic, two pairs of eyes, blinking now and then.
  function drawAtticEyes(g, t, mk) {
    if (mk.window > 0.5 || (mk.ladder ?? 0) > 0.6) return;
    for (const [ex, ey, phase] of [[1394, 74, 0], [1456, 66, 1.7]]) {
      const blink = (t + phase) % 3.4 < 0.16;
      if (blink) continue;
      g.fillStyle = S.rgba(P.spiderEye, 0.9);
      for (const dx of [-4, 4]) {
        g.beginPath();
        g.arc(ex + dx, ey, 2.3, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  /*
   * The attic ladder and hatch flap, drawn after the furniture so they can
   * fold away at the makeover's `ladder` beat: the ladder slides up into
   * the hatch, then the flap swings shut over it.
   */
  function drawOnFurniture(g, live, t, mk) {
    const p = S.clamp(mk.ladder ?? 0, 0, 1);
    const clean = mk.window > 0.5;
    const wood = clean ? S.mixHex(P.oak, P.linen, 0.2) : S.mixHex(P.oak, P.taupe, 0.4);
    const lift = S.ease.inOut(Math.min(1, p / 0.7)) * (LADDER.bottom - LADDER.top);
    const bottom = LADDER.bottom - lift;
    if (bottom > LADDER.top + 4) {
      g.save();
      g.beginPath();
      g.rect(LADDER.x0 - 20, LADDER.top, LADDER.x1 - LADDER.x0 + 40, 1080);
      g.clip();
      for (const rx of [LADDER.x0, LADDER.x1 - 8]) {
        const grad = g.createLinearGradient(rx, 0, rx + 8, 0);
        grad.addColorStop(0, S.shadeHex(wood, 0.15));
        grad.addColorStop(1, S.shadeHex(wood, -0.35));
        g.fillStyle = grad;
        g.fillRect(rx, LADDER.top, 8, bottom - LADDER.top);
      }
      for (const ry of LADDER.rungs) {
        const y = ry - lift;
        if (y < LADDER.top + 4 || y > bottom) continue;
        g.fillStyle = S.shadeHex(wood, -0.2);
        g.fillRect(LADDER.x0 + 6, y, LADDER.x1 - LADDER.x0 - 12, 9);
        g.fillStyle = S.rgba(P.bone, clean ? 0.35 : 0.18);
        g.fillRect(LADDER.x0 + 6, y, LADDER.x1 - LADDER.x0 - 12, 2);
      }
      // The ladder's hinge, where the lower half folds.
      g.fillStyle = clean ? TONE.brass : TONE.brassDirty;
      g.fillRect(LADDER.x0 - 2, 440 - lift, 12, 10);
      g.fillRect(LADDER.x1 - 10, 440 - lift, 12, 10);
      g.restore();
    }
    // The hatch flap: hanging down from its hinge, swinging shut at the end.
    const shut = S.ease.out(S.clamp((p - 0.55) / 0.45, 0, 1));
    const a = S.lerp(1.35, 0, shut);
    g.save();
    g.translate(HATCH.x1, HATCH.y1);
    g.rotate(Math.PI - a);
    paintFlap(g, clean);
    g.restore();
  }

  function paintFlap(g, clean) {
    const len = HATCH.x1 - HATCH.x0;
    g.fillStyle = clean ? S.mixHex(P.linen, P.taupe, 0.3) : S.mixHex(P.taupe, P.umber, 0.4);
    g.fillRect(0, -7, len, 10);
    g.fillStyle = S.rgba(P.soot, 0.4);
    g.fillRect(0, 1, len, 2);
  }

  // ── Light ─────────────────────────────────────────────────────────────

  function sconceOn(i, mk, live, t) {
    const beat = S.clamp(mk[`sconce${i + 1}`] ?? 0, 0, 1);
    if (i === 0) {
      // The one that still flickers in the dirty house.
      const flick = S.light.flicker(live.noise, t, 1.4);
      return Math.max(beat, 0.55 * flick * (1 - beat));
    }
    return beat;
  }

  function moonShaft(mk) {
    const { x, y, w, h } = WINDOW;
    const lean = S.lerp(560, 700, mk.window);
    return [[x + 6, y + 12], [x + w - 6, y + 12], [x + w - 160 - lean * 0.4, 1000], [x - lean, 1000]];
  }

  function lights(lm, live, t, mk) {
    const win = S.mixHex(P.moon, P.dawn, mk.window);
    lm.point(WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h / 2, 480, win, S.lerp(0.55, 0.85, mk.window));
    lm.shaft(moonShaft(mk), win, S.lerp(0.85, 1, mk.window));
    // A little moonlight reaches the top steps of the stairwell.
    lm.point(320, 800, 260, P.moon, S.lerp(0.22, 0.1, mk.window));
    SCONCES.forEach((x, i) => {
      const on = sconceOn(i, mk, live, t);
      if (on <= 0.01) return;
      lm.point(x + 8, 300, 320, P.amber, 0.75 * on);
      lm.cone(x + 8, 296, -Math.PI / 2, 1.3, 260, P.amber, 0.45 * on);
      lm.point(x + 8, 420, 260, P.amber, 0.3 * on);
    });
    // Thomas's night-light: a warm line under the door, a spill when it opens.
    const c = DOORS[2];
    const open = S.clamp(mk.doorC ?? 0, 0, 1);
    lm.point(c.x + DOOR.w / 2, FLOOR_LINE + 6, S.lerp(170, 420, open), P.dawn, S.lerp(0.35, 0.8, open));
    if (open > 0.01) lm.point(c.x + DOOR.w / 2, 600, 520, P.dawn, 0.55 * open);
    // Cold light in the attic.
    if ((mk.ladder ?? 0) < 0.9) lm.point(1425, 70, 160, P.moon, 0.3);
    return 1;
  }

  function glow(g, lm, live, t, mk) {
    const winHex = mk.window > 0.5 ? P.dawn : P.moon;
    S.light.beam(g, moonShaft(mk), winHex, S.lerp(0.22, 0.3, mk.window));
    S.light.glow(g, WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h / 2, 220, winHex, S.lerp(0.2, 0.3, mk.window));
    SCONCES.forEach((x, i) => {
      const on = sconceOn(i, mk, live, t);
      if (on <= 0.01) return;
      S.light.glow(g, x + 8, 300, 60, P.amber, 0.75 * on);
      S.light.glow(g, x + 8, 298, 18, P.bone, 0.6 * on);
    });
    const c = DOORS[2];
    const open = S.clamp(mk.doorC ?? 0, 0, 1);
    S.light.glow(g, c.x + DOOR.w / 2, FLOOR_LINE + 2, S.lerp(110, 260, open), P.dawn, S.lerp(0.35, 0.6, open));
    void lm;
  }

  function beat() {}

  S.rooms.attachArt('upstairs-hallway', {
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
