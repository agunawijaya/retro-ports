/*
 * Spyder — Room 9, the Kid's Bedroom (Thomas's room): painting, light and
 * glow.
 *
 * The logic is in room.js (layout, the toy chest, the train, the mobile, the
 * toys that move by themselves, the music box). This file paints, and reads
 * what room.js keeps on `live` (`trainDist`, `chestLid`, `mobileAngle`,
 * `toyTwitch`, `walkieCrackle`, and `world` for the critters) and the
 * makeover values on `mk` (`musicbox`, `stars`, `train`, `drawing`).
 *
 * Kept as it was the year the height marks stopped: a bunk bed, a toy
 * chest, a planet mobile, a desk by the dormer, and a star projector on the
 * floor that still turns, scattering stars over the walls and throwing
 * every spider's shadow up the wall several times its size.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const { paintShape, rectPoints, roundedRectPoints, ellipsePoints, softShadow, stain } = S.paint;

  // ── Layout (must match room.js) ───────────────────────────────────────

  const CEILING = 110;
  const FLOOR_LINE = 770;
  const SLOPE = { x0: 1500, y0: 110, x1: 1860, y1: 300 };
  const BORDER_Y = 420;
  const DOOR = { x: 110, y: 360, w: 150, h: 410 };
  const BUNK = { x0: 300, x1: 700, lower: 800, upper: 620, ladder0: 700, ladder1: 740, base: 920 };
  const MOBILE = { x: 900, top: CEILING, bottom: 320 };
  const PROJECTOR = { x: 860, y: 900 };
  const CHEST = { x0: 820, x1: 1000, top: 840, base: 935 };
  const TRACK = { leftX: 800, rightX: 1240, topY: 960, bottomY: 1020, r: 30 };
  TRACK.straight = TRACK.rightX - TRACK.leftX;
  TRACK.arc = Math.PI * TRACK.r;
  TRACK.perimeter = 2 * TRACK.straight + 2 * TRACK.arc;
  const STATION = { x: 1120, dist: 1120 - 800 }; // on the top straight
  const DESK = { x0: 1250, x1: 1550, top: 770, base: 930 };
  const SHELF = { x0: 1250, x1: 1550, y: 590 };
  const DRAWING = { x: 1330, y: 430, w: 140, h: 110 };
  const WINDOW = { x: 1600, y: 330, w: 200, h: 270 };
  const LIGHT_DIR = { x: -0.3, y: -0.95 }; // the projector is low; the lamp and window right

  const TONE = {
    paper: S.mixHex(P.sky, P.taupe, 0.42),
    paperDirty: S.mixHex(S.mixHex(P.sky, P.taupe, 0.62), P.umber, 0.18),
    bunk: S.mixHex(P.moon, P.taupe, 0.45),
    wood: S.mixHex(P.oak, P.walnut, 0.3),
    chest: S.mixHex(P.rust, P.taupe, 0.25),
    tin: S.mixHex(P.rust, P.ember, 0.3),
  };

  const aged = (hex, clean, k = 1) => (clean ? hex : S.mixHex(S.shadeHex(hex, -0.18 * k), P.taupe, 0.24 * k));

  // ── Back layer ────────────────────────────────────────────────────────

  function paintBack(g, clean) {
    paintWallpaper(g, clean);
    paintCeiling(g, clean);
    paintDoor(g, clean);
    paintPosters(g, clean);
    paintPegRail(g, clean);
    paintWindowFrame(g, clean);
    paintShelfShadow(g);
    paintSkirting(g, clean);
    paintFloor(g, clean);
    paintRug(g, clean);
    paintTrack(g, clean);
  }

  // Pale sky blue with tiny stars, and a border of small rockets.
  function paintWallpaper(g, clean) {
    paintShape(g, rectPoints(0, CEILING - 4, 1920, FLOOR_LINE - CEILING + 8), {
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
      seed: 9010,
    });
    const a = clean ? 0.34 : 0.22;
    const rng = S.createRng(9011);
    const star = (x, y, r) => {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const rr = i % 2 ? r * 0.42 : r;
        g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
      }
      g.closePath();
      g.fill();
    };
    for (let row = 0, y = CEILING + 30; y < FLOOR_LINE - 50; row++, y += 46) {
      if (Math.abs(y - BORDER_Y) < 30) continue;
      for (let x = (row % 2) * 30 + 14; x < 1920; x += 60) {
        g.fillStyle = S.rgba(row % 3 ? P.bone : P.dawn, a);
        star(x + rng.range(-4, 4), y + rng.range(-4, 4), rng.range(3, 5));
      }
    }
    // The rocket border: a band with little rockets and puffs, nose to tail.
    g.fillStyle = S.rgba(S.mixHex(P.moon, P.umber, 0.35), clean ? 0.55 : 0.45);
    g.fillRect(0, BORDER_Y - 18, 1920, 36);
    g.fillStyle = S.rgba(P.bone, 0.25);
    g.fillRect(0, BORDER_Y - 18, 1920, 2);
    g.fillRect(0, BORDER_Y + 16, 1920, 2);
    for (let x = 20; x < 1920; x += 70) {
      const body = (x / 70) % 2 ? S.mixHex(P.rust, P.linen, 0.3) : S.mixHex(P.linen, P.bone, 0.3);
      g.fillStyle = S.rgba(body, clean ? 0.85 : 0.6);
      g.beginPath();
      g.moveTo(x, BORDER_Y - 5);
      g.lineTo(x + 26, BORDER_Y - 5);
      g.quadraticCurveTo(x + 38, BORDER_Y, x + 26, BORDER_Y + 5);
      g.lineTo(x, BORDER_Y + 5);
      g.closePath();
      g.fill();
      g.fillStyle = S.rgba(P.rust, clean ? 0.8 : 0.55);
      g.beginPath();
      g.moveTo(x + 2, BORDER_Y - 5);
      g.lineTo(x - 6, BORDER_Y - 11);
      g.lineTo(x + 8, BORDER_Y - 5);
      g.moveTo(x + 2, BORDER_Y + 5);
      g.lineTo(x - 6, BORDER_Y + 11);
      g.lineTo(x + 8, BORDER_Y + 5);
      g.fill();
      g.fillStyle = S.rgba(P.moon, 0.7);
      g.beginPath();
      g.arc(x + 18, BORDER_Y, 2.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.rgba(P.dawn, clean ? 0.6 : 0.4);
      for (const [px, pr] of [[-10, 4], [-18, 3], [-24, 2]]) {
        g.beginPath();
        g.arc(x + px, BORDER_Y, pr, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (!clean) {
      // A long damp stain down from the dormer and a peeling corner.
      for (const [x, y, r, seed] of [[1560, 260, 110, 9012], [1530, 420, 80, 9013], [1500, 560, 70, 9014], [180, 180, 70, 9015], [1100, 230, 60, 9016]]) {
        stain(g, x, y, r, P.oak, seed, 0.26);
      }
      const run = g.createLinearGradient(0, 200, 0, 720);
      run.addColorStop(0, S.rgba(P.oak, 0.3));
      run.addColorStop(1, S.rgba(P.oak, 0));
      g.fillStyle = run;
      g.fillRect(1528, 200, 26, 520);
      paintShape(g, [[1080, CEILING + 6], [1180, CEILING + 6], [1150, CEILING + 70], [1120, CEILING + 92], [1110, CEILING + 40]], {
        color: S.mixHex(P.linen, P.bone, 0.2),
        lightDir: { x: -0.4, y: -0.9 },
        light: 0.2,
        shadow: 0.4,
        strokes: 3,
        rim: 0.2,
        wobble: 1.4,
        seed: 9017,
      });
      g.fillStyle = S.rgba(P.taupe, 0.45);
      g.beginPath();
      g.moveTo(1080, CEILING + 6);
      g.lineTo(1180, CEILING + 6);
      g.lineTo(1110, CEILING + 40);
      g.closePath();
      g.fill();
    }
  }

  // The flat ceiling and, on the right, the slope of the roof coming down
  // over the dormer.
  function paintCeiling(g, clean) {
    const plaster = clean ? S.mixHex(P.linen, P.sky, 0.25) : S.mixHex(P.umber, P.taupe, 0.25);
    paintShape(g, [[0, 0], [1920, 0], [1920, SLOPE.y1], [SLOPE.x1, SLOPE.y1], [SLOPE.x0, SLOPE.y0], [0, CEILING]], {
      color: plaster,
      lightDir: { x: 0, y: 1 },
      light: 0.15,
      shadow: 0.45,
      strokes: 6,
      rim: 0,
      wobble: 0,
      seed: 9001,
    });
    // The slope faces the room a little more, so it is a touch lighter.
    g.fillStyle = S.rgba(P.bone, clean ? 0.08 : 0.04);
    g.beginPath();
    g.moveTo(SLOPE.x0, 0);
    g.lineTo(1920, 0);
    g.lineTo(1920, SLOPE.y1);
    g.lineTo(SLOPE.x1, SLOPE.y1);
    g.lineTo(SLOPE.x0, SLOPE.y0);
    g.closePath();
    g.fill();
    // A thin cornice line where ceiling meets wall, following the slope.
    g.strokeStyle = S.rgba(P.soot, 0.45);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, CEILING);
    g.lineTo(SLOPE.x0, SLOPE.y0);
    g.lineTo(SLOPE.x1, SLOPE.y1);
    g.lineTo(1920, SLOPE.y1);
    g.stroke();
    g.strokeStyle = S.rgba(P.bone, 0.18);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, CEILING - 4);
    g.lineTo(SLOPE.x0, SLOPE.y0 - 4);
    g.lineTo(SLOPE.x1, SLOPE.y1 - 4);
    g.stroke();
    // Glow-in-the-dark stars stuck on the ceiling, gone pale and grey.
    const rng = S.createRng(9002);
    for (let i = 0; i < 14; i++) {
      const x = rng.range(100, 1480);
      const y = rng.range(16, 90);
      g.fillStyle = S.rgba(S.mixHex(P.linen, P.moss, 0.3), clean ? 0.5 : 0.3);
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
        const r = k % 2 ? 3.2 : 7.5;
        g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.45);
      }
      g.closePath();
      g.fill();
    }
    // The hook the mobile hangs from.
    g.fillStyle = S.rgba(P.brass, 0.8);
    g.beginPath();
    g.arc(MOBILE.x, CEILING - 4, 5, 0, Math.PI * 2);
    g.fill();
    if (!clean) stain(g, 1700, 140, 110, P.oak, 9003, 0.3);
  }

  // The door to the hallway, ajar: the gap shows the dark landing and, once
  // clean, the warm light of the sconce outside.
  function paintDoor(g, clean) {
    const { x, y, w, h } = DOOR;
    const frame = aged(S.mixHex(P.linen, P.bone, 0.2), clean);
    paintShape(g, rectPoints(x - 16, y - 18, w + 32, h + 18), {
      color: frame,
      lightDir: LIGHT_DIR,
      light: 0.2,
      shadow: 0.4,
      strokes: 4,
      rim: 0.3,
      wobble: 0.3,
      seed: 9020,
    });
    // The gap: the landing beyond. Its warm light is added in the light map.
    const gap = g.createLinearGradient(x, 0, x + 46, 0);
    gap.addColorStop(0, clean ? S.mixHex(P.amber, P.umber, 0.55) : S.mixHex(P.moon, P.soot, 0.75));
    gap.addColorStop(1, P.soot);
    g.fillStyle = gap;
    g.fillRect(x, y, 46, h);
    // The leaf, swung in toward the room a little: narrower, its edge
    // toward us, the panels foreshortened.
    const lx = x + 46;
    const lw = w - 46;
    paintShape(g, [[lx, y - 6], [x + w + 8, y], [x + w + 8, y + h], [lx, y + h + 8]], {
      color: aged(S.mixHex(P.linen, P.moon, 0.15), clean),
      lightDir: LIGHT_DIR,
      light: 0.2,
      shadow: 0.45,
      strokes: 5,
      strokeAngle: Math.PI / 2,
      rim: 0.3,
      wobble: 0.3,
      seed: 9021,
    });
    g.strokeStyle = S.rgba(P.soot, 0.35);
    g.lineWidth = 2;
    for (const [py, ph] of [[y + 30, 150], [y + 220, 160]]) {
      g.strokeRect(lx + 14, py, lw - 20, ph);
    }
    // The THOMAS plaque on this side too, and a "KEEP OUT" sign in crayon.
    g.fillStyle = aged(S.mixHex(P.oak, P.linen, 0.3), clean);
    g.fillRect(lx + 16, y + 196, lw - 24, 18);
    g.fillStyle = S.rgba(P.walnut, 0.9);
    g.font = '700 14px Caveat, "Segoe Print", cursive';
    g.textAlign = 'center';
    g.fillText('THOMAS', lx + 4 + lw / 2, y + 210);
    g.save();
    g.translate(lx + lw / 2 + 4, y + 120);
    g.rotate(-0.06);
    g.fillStyle = S.mixHex(P.bone, P.linen, clean ? 0.2 : 0.5);
    g.fillRect(-36, -24, 72, 46);
    g.fillStyle = S.rgba(P.rust, 0.85);
    g.font = '700 15px Caveat, "Segoe Print", cursive';
    g.fillText('KEEP OUT', 0, -4);
    g.fillStyle = S.rgba(P.moon, 0.85);
    g.font = '500 11px Caveat, "Segoe Print", cursive';
    g.fillText('(spiders ok)', 0, 12);
    g.restore();
    g.fillStyle = aged(P.brass, clean);
    g.beginPath();
    g.arc(x + w - 4, y + 220, 6, 0, Math.PI * 2);
    g.fill();
  }

  // A space poster and a dinosaur poster above the bunks; both invented.
  function paintPosters(g, clean) {
    const poster = (x, y, w, h, tilt, seed, draw) => {
      g.save();
      g.translate(x + w / 2, y + h / 2);
      g.rotate(tilt);
      softShadow(g, 4, 6, w * 0.52, h * 0.52, 0.3);
      g.fillStyle = S.mixHex(P.bone, P.linen, clean ? 0.2 : 0.55);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.save();
      g.beginPath();
      g.rect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 26);
      g.clip();
      draw(-w / 2 + 6, -h / 2 + 6, w - 12, h - 26);
      g.restore();
      if (!clean) {
        g.fillStyle = S.rgba(P.linen, 0.3);
        g.fillRect(-w / 2, -h / 2, w, h);
        // The top corner peeled down, showing its back.
        g.fillStyle = S.mixHex(P.bone, P.taupe, 0.25);
        g.beginPath();
        g.moveTo(w / 2, -h / 2);
        g.lineTo(w / 2 - 34, -h / 2);
        g.lineTo(w / 2 - 4, -h / 2 + 30);
        g.closePath();
        g.fill();
        g.fillStyle = S.rgba(P.soot, 0.25);
        g.beginPath();
        g.moveTo(w / 2 - 34, -h / 2);
        g.lineTo(w / 2, -h / 2);
        g.lineTo(w / 2, -h / 2 + 4);
        g.closePath();
        g.fill();
      }
      // Drawing pins.
      g.fillStyle = S.rgba(P.rust, 0.9);
      for (const [px, py] of [[-w / 2 + 6, -h / 2 + 6], [w / 2 - 6, h / 2 - 6], [-w / 2 + 6, h / 2 - 6]]) {
        g.beginPath();
        g.arc(px, py, 3, 0, Math.PI * 2);
        g.fill();
      }
      void seed;
      g.restore();
    };
    poster(340, 200, 140, 180, -0.03, 9030, (x, y, w, h) => {
      g.fillStyle = S.mixHex(P.soot, P.moon, 0.25);
      g.fillRect(x, y, w, h);
      const rng = S.createRng(9031);
      g.fillStyle = S.rgba(P.bone, 0.8);
      for (let i = 0; i < 30; i++) g.fillRect(x + rng.range(0, w), y + rng.range(0, h), 1.5, 1.5);
      // A ringed planet and a rocket going past.
      g.fillStyle = S.mixHex(P.dawn, P.rust, 0.3);
      g.beginPath();
      g.arc(x + w * 0.65, y + h * 0.35, 22, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = S.rgba(P.linen, 0.8);
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(x + w * 0.65, y + h * 0.35, 36, 8, -0.3, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = S.mixHex(P.bone, P.linen, 0.2);
      g.beginPath();
      g.moveTo(x + 20, y + h - 10);
      g.lineTo(x + 34, y + h - 50);
      g.lineTo(x + 48, y + h - 10);
      g.closePath();
      g.fill();
      g.fillStyle = S.rgba(P.ember, 0.8);
      g.beginPath();
      g.moveTo(x + 26, y + h - 10);
      g.lineTo(x + 34, y + h + 6);
      g.lineTo(x + 42, y + h - 10);
      g.closePath();
      g.fill();
    });
    g.save();
    g.fillStyle = S.rgba(P.walnut, 0.85);
    g.font = '700 12px "Special Elite", monospace';
    g.textAlign = 'center';
    g.fillText('TO THE STARS', 410, 372);
    g.restore();
    poster(530, 230, 150, 150, 0.04, 9032, (x, y, w, h) => {
      g.fillStyle = S.mixHex(P.moss, P.linen, 0.45);
      g.fillRect(x, y, w, h);
      g.fillStyle = S.mixHex(P.dawn, P.linen, 0.4);
      g.beginPath();
      g.arc(x + w * 0.8, y + 22, 14, 0, Math.PI * 2);
      g.fill();
      // A long-necked dinosaur by a volcano.
      g.fillStyle = S.mixHex(P.taupe, P.umber, 0.3);
      g.beginPath();
      g.moveTo(x + w * 0.6, y + h);
      g.lineTo(x + w * 0.85, y + h * 0.45);
      g.lineTo(x + w, y + h);
      g.closePath();
      g.fill();
      g.fillStyle = S.mixHex(P.moss, P.umber, 0.3);
      g.beginPath();
      g.ellipse(x + w * 0.38, y + h * 0.75, 36, 18, 0, 0, Math.PI * 2);
      g.fill();
      g.lineCap = 'round';
      g.strokeStyle = S.mixHex(P.moss, P.umber, 0.3);
      g.lineWidth = 10;
      g.beginPath();
      g.moveTo(x + w * 0.5, y + h * 0.7);
      g.quadraticCurveTo(x + w * 0.62, y + h * 0.4, x + w * 0.56, y + h * 0.22);
      g.stroke();
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(x + w * 0.16, y + h * 0.76);
      g.lineTo(x - 6, y + h * 0.68);
      g.stroke();
      for (const lx of [0.24, 0.32, 0.44, 0.52]) {
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(x + w * lx, y + h * 0.8);
        g.lineTo(x + w * lx, y + h * 0.95);
        g.stroke();
      }
    });
    g.save();
    g.fillStyle = S.rgba(P.walnut, 0.85);
    g.font = '700 12px "Special Elite", monospace';
    g.textAlign = 'center';
    g.fillText('LONG AGO', 605, 372);
    g.restore();
  }

  // A peg rail on the bare wall: a school satchel, a striped scarf and a
  // cap. Dirty, the scarf has slipped to the floor of the rail and the cap
  // hangs by one side.
  function paintPegRail(g, clean) {
    const y = 520;
    const x0 = 1010;
    const x1 = 1190;
    softShadow(g, (x0 + x1) / 2, y + 10, 100, 6, 0.3);
    paintShape(g, rectPoints(x0, y - 8, x1 - x0, 16), {
      color: aged(TONE.wood, clean),
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.4,
      strokes: 3,
      strokeAngle: 0,
      rim: 0.35,
      wobble: 0.3,
      seed: 9025,
    });
    const pegs = [x0 + 30, x0 + 90, x0 + 150];
    for (const px of pegs) {
      g.fillStyle = aged(S.mixHex(P.oak, P.linen, 0.3), clean);
      g.beginPath();
      g.arc(px, y, 6, 0, Math.PI * 2);
      g.fill();
    }
    // The satchel: a leather bag on a long strap.
    const sx = pegs[0];
    g.strokeStyle = aged(S.mixHex(P.rust, P.walnut, 0.4), clean);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(sx, y);
    g.lineTo(sx - 22, y + 92);
    g.moveTo(sx, y);
    g.lineTo(sx + 22, y + 92);
    g.stroke();
    paintShape(g, roundedRectPoints(sx - 32, y + 88, 64, 50, 8), {
      color: aged(S.mixHex(P.rust, P.oak, 0.5), clean),
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.45,
      strokes: 4,
      rim: 0.35,
      wobble: 0.6,
      seed: 9026,
    });
    g.fillStyle = S.rgba(P.soot, 0.25);
    g.beginPath();
    g.moveTo(sx - 32, y + 92);
    g.quadraticCurveTo(sx, y + 120, sx + 32, y + 92);
    g.lineTo(sx + 32, y + 88);
    g.lineTo(sx - 32, y + 88);
    g.closePath();
    g.fill();
    g.fillStyle = aged(P.brass, clean);
    g.fillRect(sx - 4, y + 112, 8, 6);
    // The scarf: stripes of rust and cream hanging in two tails.
    const fx = pegs[1];
    const tails = clean ? [[-10, 120], [8, 104]] : [[-6, 60], [10, 52]];
    for (const [dx, len] of tails) {
      for (let k = 0; k < len; k += 12) {
        g.fillStyle = aged(k % 24 ? S.mixHex(P.linen, P.bone, 0.2) : S.mixHex(P.rust, P.ember, 0.2), clean);
        g.fillRect(fx + dx - 7 + k * 0.02 * dx, y + 4 + k, 14, 12);
      }
    }
    if (!clean) {
      // The rest of it in a heap on the skirting below.
      paintShape(g, [[fx - 36, FLOOR_LINE - 4], [fx - 20, FLOOR_LINE - 24], [fx + 24, FLOOR_LINE - 22], [fx + 40, FLOOR_LINE - 2]], {
        color: S.mixHex(S.mixHex(P.rust, P.ember, 0.2), P.taupe, 0.35),
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.45,
        strokes: 4,
        rim: 0.3,
        wobble: 2,
        seed: 9027,
      });
    }
    // A cap.
    const cx = pegs[2];
    g.save();
    g.translate(cx, y + 2);
    g.rotate(clean ? 0 : 0.6);
    paintShape(g, [[-20, 18], [-18, 2], [-6, -6], [10, -6], [20, 4], [20, 18]], {
      color: aged(S.mixHex(P.moon, P.umber, 0.35), clean),
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.45,
      strokes: 3,
      rim: 0.35,
      wobble: 0.5,
      seed: 9028,
    });
    g.fillStyle = aged(S.mixHex(P.moon, P.soot, 0.45), clean);
    g.beginPath();
    g.ellipse(24, 18, 16, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // The dormer window: set back under the slope, with its own cheeks. The
  // glass is left open so drawSky shows through; the curtains are drawn
  // over it here.
  function paintWindowFrame(g, clean) {
    const { x, y, w, h } = WINDOW;
    // The recess: the dormer's cheeks and its little ceiling.
    g.fillStyle = S.rgba(P.soot, 0.3);
    g.beginPath();
    g.moveTo(x - 50, y - 40);
    g.lineTo(x + w + 50, y - 40);
    g.lineTo(x + w + 20, y - 10);
    g.lineTo(x - 20, y - 10);
    g.closePath();
    g.fill();
    const frame = clean ? S.mixHex(P.bone, P.linen, 0.3) : S.mixHex(P.linen, P.taupe, 0.4);
    paintShape(g, rectPoints(x - 20, y - 16, w + 40, h + 36), {
      color: frame,
      lightDir: LIGHT_DIR,
      light: 0.2,
      shadow: 0.4,
      strokes: 4,
      rim: 0.3,
      wobble: 0.4,
      seed: 9040,
    });
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(x, y, w, h);
    g.restore();
    g.fillStyle = S.shadeHex(frame, -0.08);
    g.fillRect(x + w / 2 - 4, y, 8, h);
    g.fillRect(x, y + h / 2 - 4, w, 8);
    paintShape(g, rectPoints(x - 30, y + h + 10, w + 60, 14), {
      color: frame,
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.45,
      strokes: 2,
      rim: 0.35,
      wobble: 0.3,
      seed: 9041,
    });
    // Rocket-print curtains, tied back at the sides. Dirty, the right one is
    // torn and hangs loose.
    const curtain = (pts, seed, torn) => {
      g.save();
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
      g.closePath();
      g.clip();
      const b = S.paint.boundsOf(pts);
      paintShape(g, pts, {
        color: aged(S.mixHex(P.moon, P.linen, 0.4), clean),
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.4,
        strokes: 6,
        strokeAngle: Math.PI / 2,
        rim: 0.3,
        wobble: 0.8,
        seed,
      });
      const rng = S.createRng(seed + 1);
      for (let ry = b.y + 20; ry < b.y + b.h; ry += 34) {
        for (let rx = b.x + 10 + ((ry / 34) % 2) * 14; rx < b.x + b.w; rx += 30) {
          g.fillStyle = S.rgba(rng.next() < 0.5 ? P.rust : P.bone, clean ? 0.7 : 0.45);
          g.beginPath();
          g.moveTo(rx, ry - 8);
          g.lineTo(rx + 4, ry + 4);
          g.lineTo(rx - 4, ry + 4);
          g.closePath();
          g.fill();
          g.fillStyle = S.rgba(P.dawn, 0.5);
          g.fillRect(rx - 1.5, ry + 4, 3, 4);
        }
      }
      for (let fx = b.x; fx < b.x + b.w; fx += 16) {
        g.fillStyle = S.rgba(P.soot, 0.14);
        g.fillRect(fx + 9, b.y, 5, b.h);
      }
      if (torn) {
        g.fillStyle = S.rgba(P.soot, 0.2);
        g.fillRect(b.x, b.y, b.w, b.h);
      }
      g.restore();
    };
    g.fillStyle = aged(P.brass, clean);
    g.fillRect(x - 46, y - 30, w + 92, 6);
    curtain([[x - 46, y - 26], [x + 30, y - 26], [x + 14, y + 150], [x - 4, y + h + 10], [x - 46, y + h + 10]], 9042, false);
    if (clean) {
      curtain([[x + w - 30, y - 26], [x + w + 46, y - 26], [x + w + 46, y + h + 10], [x + w + 4, y + h + 10], [x + w - 14, y + 150]], 9044, false);
    } else {
      // Torn from its rings on one side: it hangs at a slant, ragged.
      curtain([[x + w + 10, y - 26], [x + w + 46, y - 26], [x + w + 46, y + h + 10], [x + w - 40, y + h + 24], [x + w - 70, y + h - 30], [x + w - 20, y + 60]], 9046, true);
    }
    // Tie-backs.
    g.fillStyle = S.rgba(P.rust, 0.8);
    g.fillRect(x - 24, y + 146, 34, 6);
    if (clean) g.fillRect(x + w - 10, y + 146, 34, 6);
  }

  function paintShelfShadow(g) {
    const s = g.createLinearGradient(0, SHELF.y + 8, 0, SHELF.y + 44);
    s.addColorStop(0, S.rgba(P.soot, 0.4));
    s.addColorStop(1, S.rgba(P.soot, 0));
    g.fillStyle = s;
    g.fillRect(SHELF.x0 + 10, SHELF.y + 8, SHELF.x1 - SHELF.x0 - 20, 36);
  }

  function paintSkirting(g, clean) {
    paintShape(g, rectPoints(0, FLOOR_LINE - 38, 1920, 40), {
      color: aged(S.mixHex(P.bone, P.linen, 0.4), clean),
      lightDir: { x: 0, y: -1 },
      light: 0.25,
      shadow: 0.4,
      strokes: 4,
      rim: 0.3,
      wobble: 0,
      seed: 9050,
    });
  }

  function paintFloor(g, clean) {
    const vp = { x: 960, y: -900 };
    const top = FLOOR_LINE;
    const bottom = 1080;
    const base = clean ? S.mixHex(P.oak, P.linen, 0.2) : S.mixHex(P.walnut, P.oak, 0.4);
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
      seed: 9060,
    });
    const xAt = (xb, y) => vp.x + (xb - vp.x) * ((y - vp.y) / (bottom - vp.y));
    const rng = S.createRng(9061);
    for (let xb = -300; xb < 2300; xb += 110) {
      g.fillStyle = S.rgba(S.shadeHex(base, rng.range(-0.12, 0.08)), 0.4);
      g.beginPath();
      g.moveTo(xAt(xb, top), top);
      g.lineTo(xAt(xb + 110, top), top);
      g.lineTo(xb + 110, bottom);
      g.lineTo(xb, bottom);
      g.closePath();
      g.fill();
      g.strokeStyle = S.rgba(P.soot, 0.5);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(xAt(xb, top), top);
      g.lineTo(xb, bottom);
      g.stroke();
      let y = top + rng.range(10, 110);
      while (y < bottom) {
        g.strokeStyle = S.rgba(P.soot, 0.4);
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
    fall.addColorStop(1, S.rgba(P.soot, clean ? 0.3 : 0.5));
    g.fillStyle = fall;
    g.fillRect(0, top, 1920, bottom - top);
    const join = g.createLinearGradient(0, top, 0, top + 26);
    join.addColorStop(0, S.rgba(P.soot, 0.5));
    join.addColorStop(1, S.rgba(P.soot, 0));
    g.fillStyle = join;
    g.fillRect(0, top, 1920, 26);
  }

  // A round rug with a road and a little town printed on it.
  function paintRug(g, clean) {
    const cx = 520;
    const cy = 995;
    softShadow(g, cx, cy + 4, 230, 44, 0.35);
    paintShape(g, ellipsePoints(cx, cy, 220, 44, 48), {
      color: aged(S.mixHex(P.moss, P.linen, 0.35), clean, 1.2),
      lightDir: { x: 0, y: -1 },
      light: 0.12,
      shadow: 0.3,
      strokes: 24,
      strokeSize: 0.5,
      variance: 0.18,
      rim: 0,
      innerShadow: 0.15,
      wobble: 1,
      seed: 9070,
    });
    g.strokeStyle = S.rgba(aged(P.linen, clean), 0.6);
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(cx, cy, 200, 38, 0, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = S.rgba(P.umber, 0.45);
    g.lineWidth = 8;
    g.beginPath();
    g.ellipse(cx, cy, 120, 20, 0, 0.2, Math.PI * 1.7);
    g.stroke();
    g.strokeStyle = S.rgba(P.bone, 0.45);
    g.lineWidth = 1;
    g.setLineDash([6, 6]);
    g.stroke();
    g.setLineDash([]);
    for (const [hx, hy, hue] of [[430, 985, P.rust], [600, 1000, P.moon], [520, 975, P.dawn]]) {
      g.fillStyle = S.rgba(aged(hue, clean), 0.6);
      g.fillRect(hx - 8, hy - 6, 16, 8);
      g.beginPath();
      g.moveTo(hx - 10, hy - 6);
      g.lineTo(hx, hy - 13);
      g.lineTo(hx + 10, hy - 6);
      g.closePath();
      g.fill();
    }
  }

  // The tin track: two rails and sleepers round an oval, and a station.
  function trackPath(g, inset) {
    const { leftX, rightX, topY, bottomY } = TRACK;
    const cy = (topY + bottomY) / 2;
    const r = (bottomY - topY) / 2 + inset;
    g.beginPath();
    g.moveTo(leftX, cy - r);
    g.lineTo(rightX, cy - r);
    g.arc(rightX, cy, r, -Math.PI / 2, Math.PI / 2);
    g.lineTo(leftX, cy + r);
    g.arc(leftX, cy, r, Math.PI / 2, Math.PI * 1.5);
    g.closePath();
  }

  function paintTrack(g, clean) {
    // Sleepers.
    trackPath(g, 0);
    g.strokeStyle = S.rgba(P.soot, 0.35);
    g.lineWidth = 22;
    g.stroke();
    for (let d = 0; d < TRACK.perimeter; d += 13) {
      const p = trackPos(d);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.heading);
      g.fillStyle = aged(S.mixHex(P.walnut, P.oak, 0.6), clean);
      g.fillRect(-3, -10, 6, 20);
      g.fillStyle = S.rgba(P.bone, 0.12);
      g.fillRect(-3, -10, 6, 2);
      g.restore();
    }
    for (const inset of [-6, 6]) {
      trackPath(g, inset);
      g.strokeStyle = aged('#4E525A', clean);
      g.lineWidth = 3;
      g.stroke();
      trackPath(g, inset - 1);
      g.strokeStyle = S.rgba('#C8CCD2', clean ? 0.55 : 0.35);
      g.lineWidth = 1;
      g.stroke();
    }
    // The station: a little platform with a roof on two posts, behind the
    // top straight.
    const sx = STATION.x;
    const sy = TRACK.topY - 12;
    paintShape(g, rectPoints(sx - 40, sy - 6, 80, 8), {
      color: aged(S.mixHex(P.linen, P.taupe, 0.3), clean),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.4,
      strokes: 2,
      rim: 0.3,
      wobble: 0.2,
      seed: 9080,
    });
    g.fillStyle = aged(S.mixHex(P.walnut, P.oak, 0.4), clean);
    for (const px of [sx - 32, sx + 28]) g.fillRect(px, sy - 44, 4, 40);
    if (clean) {
      g.fillStyle = S.mixHex(P.rust, P.linen, 0.25);
      g.beginPath();
      g.moveTo(sx - 44, sy - 42);
      g.lineTo(sx + 44, sy - 42);
      g.lineTo(sx + 36, sy - 54);
      g.lineTo(sx - 36, sy - 54);
      g.closePath();
      g.fill();
    } else {
      // The roof has come off and lies beside it.
      g.fillStyle = S.mixHex(S.mixHex(P.rust, P.linen, 0.25), P.taupe, 0.4);
      g.save();
      g.translate(sx + 64, sy + 2);
      g.rotate(0.35);
      g.fillRect(-40, -6, 80, 10);
      g.restore();
    }
  }

  // Distance round the track → position and heading. The same oval as in
  // room.js: right along the back straight, round, left along the front.
  function trackPos(dist) {
    let d = ((dist % TRACK.perimeter) + TRACK.perimeter) % TRACK.perimeter;
    const { leftX, rightX, topY, bottomY, r, straight, arc } = TRACK;
    const cy = (topY + bottomY) / 2;
    if (d < straight) return { x: leftX + d, y: topY, heading: 0 };
    d -= straight;
    if (d < arc) {
      const a = -Math.PI / 2 + (d / arc) * Math.PI;
      return { x: rightX + Math.cos(a) * r, y: cy + Math.sin(a) * r, heading: a + Math.PI / 2 };
    }
    d -= arc;
    if (d < straight) return { x: rightX - d, y: bottomY, heading: Math.PI };
    d -= straight;
    const a = Math.PI / 2 + (d / arc) * Math.PI;
    return { x: leftX + Math.cos(a) * r, y: cy + Math.sin(a) * r, heading: a + Math.PI / 2 };
  }

  // ── Furniture layer ───────────────────────────────────────────────────

  function paintFurniture(g, clean) {
    paintBunk(g, clean);
    paintChest(g, clean);
    paintDesk(g, clean);
    paintShelf(g, clean);
    paintFloorToys(g, clean);
    paintCleanerTrace(g, clean);
  }

  function wood(g, x, y, w, h, hex, clean, seed, grain = Math.PI / 2, light = 0.25) {
    paintShape(g, rectPoints(x, y, w, h), {
      color: aged(hex, clean),
      lightDir: LIGHT_DIR,
      light,
      shadow: 0.45,
      strokes: 6,
      strokeAngle: grain,
      variance: 0.1,
      rim: 0.3,
      wobble: 0.3,
      seed,
    });
  }

  // The bunk bed: muted blue painted wood, two decks with patchwork quilts,
  // a ladder on the right. Upper bunk: a torch and a pile of comics.
  function paintBunk(g, clean) {
    const { x0, x1, lower, upper, ladder0, ladder1, base } = BUNK;
    softShadow(g, (x0 + x1) / 2 + 20, base, (x1 - x0) * 0.6, 16, 0.55);
    g.fillStyle = S.rgba(P.soot, 0.65);
    g.fillRect(x0 + 10, lower + 60, x1 - x0 - 20, base - lower - 60);
    // Posts.
    for (const px of [x0 - 6, x1 - 8]) wood(g, px, upper - 70, 16, base - upper + 70, TONE.bunk, clean, 9100 + px);
    // Each deck: a mattress with a quilt hanging over the side rail.
    for (const [deck, seed] of [[lower, 9110], [upper, 9120]]) {
      paintShape(g, rectPoints(x0 + 6, deck - 16, x1 - x0 - 14, 18), {
        color: aged(S.mixHex(P.bone, P.linen, 0.4), clean),
        lightDir: { x: 0, y: -1 },
        light: 0.25,
        shadow: 0.3,
        strokes: 3,
        rim: 0.3,
        wobble: 0.6,
        seed,
      });
      paintPatchwork(g, x0 + 6, deck - 2, x1 - x0 - 14, 52, clean, seed + 1);
      // The side rail of the deck.
      wood(g, x0, deck + 50, x1 - x0, 14, TONE.bunk, clean, seed + 2, 0, 0.3);
      // Pillow.
      paintShape(g, [[x0 + 16, deck - 14], [x0 + 22, deck - 38], [x0 + 92, deck - 38], [x0 + 98, deck - 14]], {
        color: aged(S.mixHex(P.bone, P.moon, 0.15), clean, 1.2),
        lightDir: { x: 0.5, y: -0.85 },
        light: 0.25,
        shadow: 0.35,
        strokes: 3,
        rim: 0.4,
        wobble: 1.6,
        seed: seed + 3,
      });
    }
    // The upper deck's guard rail, and the head and foot boards.
    wood(g, x0, upper - 58, x1 - x0 - 80, 10, TONE.bunk, clean, 9130, 0, 0.3);
    for (const px of [x0 + 60, x0 + 160, x0 + 260]) wood(g, px, upper - 50, 8, 34, TONE.bunk, clean, 9131 + px);
    for (const [deck, seed] of [[lower, 9135], [upper, 9136]]) {
      wood(g, x0 - 2, deck - 70, 14, 72, TONE.bunk, clean, seed);
    }
    // Ladder.
    for (const lx of [ladder0, ladder1 - 10]) wood(g, lx, upper - 60, 10, base - upper + 50, TONE.bunk, clean, 9140 + lx);
    for (let ry = upper - 20; ry < base - 20; ry += 56) wood(g, ladder0, ry, ladder1 - ladder0, 8, TONE.bunk, clean, 9150 + ry, 0, 0.35);
    // A torch and a stack of comics on the upper bunk.
    paintShape(g, roundedRectPoints(x1 - 150, upper - 36, 46, 14, 5), {
      color: aged(S.mixHex(P.rust, P.ember, 0.3), clean),
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.4,
      strokes: 2,
      rim: 0.4,
      wobble: 0.2,
      seed: 9160,
    });
    g.fillStyle = S.rgba(P.bone, 0.6);
    g.beginPath();
    g.ellipse(x1 - 104, upper - 29, 3, 7, 0, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 4; i++) {
      g.fillStyle = aged([P.dawn, P.moon, P.rust, P.linen][i], clean, 1.2);
      g.save();
      g.translate(x1 - 210, upper - 20 - i * 4);
      g.rotate((i - 1.5) * 0.08);
      g.fillRect(-26, -2, 52, 4);
      g.restore();
    }
    if (!clean) {
      // Bedding tangled on the lower bunk and a sheet hanging to the floor.
      paintShape(g, [[x0 + 120, lower - 20], [x0 + 260, lower - 34], [x0 + 330, lower - 12], [x0 + 300, lower + 10], [x0 + 140, lower + 6]], {
        color: S.mixHex(P.bone, P.taupe, 0.45),
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.45,
        strokes: 8,
        rim: 0.3,
        wobble: 3,
        seed: 9170,
      });
      g.save();
      g.globalAlpha = 0.88;
      paintShape(g, [[x0 + 200, upper + 40], [x0 + 300, upper + 44], [x0 + 320, lower + 40], [x0 + 300, lower + 96], [x0 + 284, lower + 78], [x0 + 262, lower + 104], [x0 + 240, lower + 70], [x0 + 222, lower + 84], [x0 + 210, lower - 30]], {
        color: S.mixHex(P.linen, P.taupe, 0.62),
        lightDir: LIGHT_DIR,
        light: 0.2,
        shadow: 0.4,
        strokes: 8,
        strokeAngle: Math.PI / 2,
        rim: 0.3,
        wobble: 2,
        seed: 9171,
      });
      g.restore();
      // Folds pulled down by its own weight.
      for (const [fx, sway] of [[232, -8], [262, 6], [290, -4]]) {
        const band = g.createLinearGradient(x0 + fx - 8, 0, x0 + fx + 8, 0);
        band.addColorStop(0, 'rgba(0,0,0,0)');
        band.addColorStop(0.5, S.rgba(P.soot, 0.28));
        band.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = band;
        g.beginPath();
        g.moveTo(x0 + fx - 6, upper + 50);
        g.lineTo(x0 + fx + 6, upper + 50);
        g.lineTo(x0 + fx + sway + 8, lower + 80);
        g.lineTo(x0 + fx + sway - 8, lower + 80);
        g.closePath();
        g.fill();
      }
    }
  }

  function paintPatchwork(g, x, y, w, h, clean, seed) {
    const hues = [S.mixHex(P.moon, P.linen, 0.3), S.mixHex(P.rust, P.linen, 0.35), S.mixHex(P.dawn, P.linen, 0.3), S.mixHex(P.moss, P.linen, 0.4)];
    const size = 26;
    const rng = S.createRng(seed);
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    for (let row = 0, yy = y; yy < y + h; row++, yy += size) {
      for (let col = 0, xx = x; xx < x + w; col++, xx += size) {
        g.fillStyle = aged(hues[(row + col * 3 + (rng.next() < 0.2 ? 1 : 0)) % hues.length], clean, 1.1);
        g.fillRect(xx, yy, size + 0.5, size + 0.5);
      }
    }
    for (let xx = x + 20; xx < x + w; xx += rng.range(50, 80)) {
      const band = g.createLinearGradient(xx - 14, 0, xx + 14, 0);
      band.addColorStop(0, 'rgba(0,0,0,0)');
      band.addColorStop(0.5, S.rgba(P.soot, 0.28));
      band.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = band;
      g.fillRect(xx - 14, y, 28, h);
    }
    const roll = g.createLinearGradient(0, y, 0, y + h);
    roll.addColorStop(0, S.rgba(P.bone, 0.15));
    roll.addColorStop(0.3, 'rgba(0,0,0,0)');
    roll.addColorStop(1, S.rgba(P.soot, 0.4));
    g.fillStyle = roll;
    g.fillRect(x, y, w, h);
    g.restore();
  }

  // The toy chest: painted wood with stars on it. The lid is drawn live
  // (it pops up like a jack-in-the-box).
  function paintChest(g, clean) {
    const { x0, x1, top, base } = CHEST;
    softShadow(g, (x0 + x1) / 2, base, (x1 - x0) * 0.6, 10, 0.5);
    paintShape(g, rectPoints(x0, top + 8, x1 - x0, base - top - 10), {
      color: aged(TONE.chest, clean),
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.45,
      strokes: 8,
      strokeAngle: 0,
      rim: 0.3,
      wobble: 0.4,
      seed: 9180,
    });
    g.fillStyle = S.rgba(P.soot, 0.85);
    g.fillRect(x0 + 6, top + 4, x1 - x0 - 12, 8);
    g.fillStyle = S.rgba(P.dawn, clean ? 0.7 : 0.45);
    for (const [sx, sy, r] of [[860, 880, 9], [910, 900, 6], [958, 876, 8], [880, 912, 5]]) {
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
        const rr = k % 2 ? r * 0.42 : r;
        g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
    }
    g.strokeStyle = S.rgba(P.soot, 0.35);
    g.lineWidth = 2;
    g.strokeRect(x0 + 8, top + 18, x1 - x0 - 16, base - top - 30);
    if (!clean) {
      g.strokeStyle = S.rgba(P.linen, 0.35);
      g.lineWidth = 1;
      for (const [ax, ay, bx, by] of [[836, 920, 870, 910], [960, 900, 990, 924], [900, 860, 930, 866]]) {
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.stroke();
      }
    }
  }

  // A school desk with drawers, an angle-poise lamp, crayons, a pencil pot
  // and an exercise book. Dirty, two drawers hang open.
  function paintDesk(g, clean) {
    const { x0, x1, top, base } = DESK;
    softShadow(g, (x0 + x1) / 2, base, (x1 - x0) * 0.58, 12, 0.5);
    wood(g, x0 - 6, top, x1 - x0 + 12, 14, TONE.wood, clean, 9200, 0, 0.35);
    // A drawer pedestal on the right and legs on the left.
    wood(g, x1 - 110, top + 14, 104, base - top - 14, TONE.wood, clean, 9201);
    for (const lx of [x0 + 4, x0 + 150]) wood(g, lx, top + 14, 12, base - top - 14, TONE.wood, clean, 9202 + lx);
    for (let i = 0; i < 3; i++) {
      const dy = top + 24 + i * 44;
      const out = !clean && i !== 1 ? 18 + i * 4 : 0;
      if (out) {
        // An open drawer: its sides and the dark inside, pulled toward us.
        g.fillStyle = S.rgba(P.soot, 0.8);
        g.fillRect(x1 - 104, dy - 4, 92, 8);
        wood(g, x1 - 104 - out * 0.2, dy + 2, 92 + out * 0.4, 38 + out * 0.3, TONE.wood, clean, 9210 + i);
        g.fillStyle = S.rgba(P.bone, 0.5);
        g.fillRect(x1 - 90, dy - 6, 30, 6);
      } else {
        g.strokeStyle = S.rgba(P.soot, 0.45);
        g.lineWidth = 2;
        g.strokeRect(x1 - 102, dy, 88, 38);
      }
      g.fillStyle = aged(P.brass, clean);
      g.fillRect(x1 - 66, dy + 16 + out * 0.15, 16, 4);
    }
    // The exercise book, the pencil pot and crayons.
    g.save();
    g.translate(x0 + 110, top - 2);
    g.rotate(-0.05);
    g.fillStyle = aged(S.mixHex(P.moon, P.linen, 0.3), clean);
    g.fillRect(-46, -6, 92, 7);
    g.fillStyle = S.rgba(P.bone, 0.8);
    g.fillRect(-44, -8, 88, 3);
    g.restore();
    paintShape(g, rectPoints(x0 + 200, top - 34, 24, 34), {
      color: aged(S.mixHex(P.rust, P.dawn, 0.3), clean),
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.4,
      strokes: 2,
      rim: 0.4,
      wobble: 0.3,
      seed: 9220,
    });
    for (const [i, hue] of [P.ember, P.moon, P.moss, P.dawn].entries()) {
      g.strokeStyle = aged(hue, clean);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x0 + 206 + i * 4, top - 30);
      g.lineTo(x0 + 202 + i * 6, top - 56 + i * 3);
      g.stroke();
    }
    for (const [i, hue] of [P.ember, P.moss, P.moon].entries()) {
      g.save();
      g.translate(x0 + 30 + i * 12, top - 3);
      g.rotate(0.3 * (i - 1));
      g.fillStyle = aged(hue, clean);
      g.fillRect(-10, -2, 20, 4);
      g.restore();
    }
    // The angle-poise lamp: base, two arms, a cone shade turned down.
    const lb = { x: x1 - 50, y: top };
    g.fillStyle = aged(S.mixHex(P.moss, P.gear, 0.4), clean);
    g.beginPath();
    g.ellipse(lb.x, lb.y - 4, 26, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = aged(S.mixHex(P.moss, P.gear, 0.4), clean);
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(lb.x, lb.y - 8);
    g.lineTo(lb.x - 30, lb.y - 90);
    g.lineTo(lb.x - 96, lb.y - 120);
    g.stroke();
    g.strokeStyle = S.rgba(P.bone, 0.25);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(lb.x - 2, lb.y - 10);
    g.lineTo(lb.x - 31, lb.y - 92);
    g.stroke();
    g.save();
    g.translate(lb.x - 100, lb.y - 116);
    g.rotate(0.6);
    paintShape(g, [[-10, -14], [10, -14], [24, 18], [-24, 18]], {
      color: aged(S.mixHex(P.moss, P.gear, 0.4), clean),
      lightDir: { x: 0.3, y: -0.9 },
      light: 0.35,
      shadow: 0.45,
      strokes: 2,
      rim: 0.4,
      wobble: 0.2,
      seed: 9221,
    });
    g.restore();
  }

  // The wall shelf: the toys that are not drawn live, and its brackets.
  function paintShelf(g, clean) {
    const { x0, x1, y } = SHELF;
    // A wooden rocket, a stuffed bear (clean: here; dirty: on the floor), a
    // globe.
    paintShape(g, [[x0 + 50, y], [x0 + 50, y - 40], [x0 + 58, y - 58], [x0 + 66, y - 40], [x0 + 66, y]], {
      color: aged(S.mixHex(P.linen, P.bone, 0.2), clean),
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.4,
      strokes: 2,
      rim: 0.4,
      wobble: 0.3,
      seed: 9230,
    });
    g.fillStyle = aged(P.rust, clean);
    g.beginPath();
    g.moveTo(x0 + 50, y);
    g.lineTo(x0 + 42, y);
    g.lineTo(x0 + 50, y - 16);
    g.moveTo(x0 + 66, y);
    g.lineTo(x0 + 74, y);
    g.lineTo(x0 + 66, y - 16);
    g.fill();
    if (clean) paintBear(g, x1 - 16, y, 1, clean);
    // The globe on its stand.
    const gx = x0 + 180;
    g.fillStyle = aged(P.brass, clean);
    g.fillRect(gx - 10, y - 6, 20, 6);
    g.fillRect(gx - 2, y - 14, 4, 10);
    const globe = g.createRadialGradient(gx - 6, y - 38, 3, gx, y - 32, 18);
    globe.addColorStop(0, aged(S.mixHex(P.moon, P.bone, 0.3), clean));
    globe.addColorStop(1, aged(S.mixHex(P.moon, P.umber, 0.4), clean));
    g.fillStyle = globe;
    g.beginPath();
    g.arc(gx, y - 32, 17, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.rgba(aged(P.moss, clean), 0.8);
    g.beginPath();
    g.ellipse(gx - 4, y - 36, 7, 5, 0.5, 0, Math.PI * 2);
    g.ellipse(gx + 7, y - 26, 5, 4, -0.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = aged(P.brass, clean);
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(gx, y - 32, 21, -2.2, 1.2);
    g.stroke();
    // The board and two brackets.
    wood(g, x0, y - 2, x1 - x0, 12, TONE.wood, clean, 9231, 0, 0.35);
    for (const bx of [x0 + 24, x1 - 34]) {
      paintShape(g, [[bx, y + 10], [bx + 10, y + 10], [bx + 10, y + 46], [bx + 4, y + 46], [bx, y + 22]], {
        color: aged(TONE.wood, clean),
        light: 0.2,
        shadow: 0.4,
        strokes: 2,
        rim: 0.3,
        wobble: 0.3,
        seed: 9232 + bx,
      });
    }
  }

  function paintBear(g, cx, base, scale, clean, tilt = 0) {
    g.save();
    g.translate(cx, base);
    g.rotate(tilt);
    g.scale(scale, scale);
    const fur = aged(S.mixHex(P.oak, P.linen, 0.3), clean);
    const blob = (x, y, rx, ry, seed) => paintShape(g, ellipsePoints(x, y, rx, ry, 20), {
      color: fur,
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.45,
      strokes: 4,
      rim: 0.35,
      wobble: 0.6,
      seed,
    });
    blob(0, -16, 15, 16, 9240);
    blob(-12, -4, 7, 5, 9241);
    blob(12, -4, 7, 5, 9242);
    blob(0, -40, 12, 11, 9243);
    blob(-9, -50, 5, 5, 9244);
    blob(9, -50, 5, 5, 9245);
    g.fillStyle = P.soot;
    g.beginPath();
    g.arc(-4, -42, 1.6, 0, Math.PI * 2);
    g.arc(4, -42, 1.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.mixHex(P.linen, P.bone, 0.3);
    g.beginPath();
    g.ellipse(0, -36, 5, 3.5, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Dirty: blocks, the bear and a toy car strewn on the floor; a derailed
  // carriage on its side by the track. (The ball, the top and the robot are
  // live; see drawToys.)
  function paintFloorToys(g, clean) {
    if (clean) return;
    const blocks = [[700, 948, 0.2, P.rust, 'A'], [730, 944, -0.1, P.moon, 'B'], [1360, 950, 0.35, P.dawn, 'C']];
    for (const [bx, by, tilt, hue, letter] of blocks) {
      g.save();
      g.translate(bx, by);
      g.rotate(tilt);
      softShadow(g, 0, 10, 16, 4, 0.4);
      paintShape(g, rectPoints(-12, -12, 24, 24), {
        color: S.mixHex(hue, P.linen, 0.3),
        lightDir: LIGHT_DIR,
        light: 0.3,
        shadow: 0.4,
        strokes: 2,
        rim: 0.4,
        wobble: 0.2,
        seed: 9250 + bx,
      });
      g.fillStyle = S.rgba(P.soot, 0.6);
      g.font = '700 14px "Special Elite", monospace';
      g.textAlign = 'center';
      g.fillText(letter, 0, 5);
      g.restore();
    }
    paintBear(g, 1110, 946, 0.95, clean, 1.3);
    // The derailed carriage lying on its side off the track.
    g.save();
    g.translate(1290, 985);
    g.rotate(1.2);
    softShadow(g, 0, 8, 20, 5, 0.4);
    g.fillStyle = S.mixHex(TONE.tin, P.taupe, 0.3);
    g.fillRect(-18, -10, 36, 18);
    g.fillStyle = S.rgba(P.soot, 0.7);
    g.beginPath();
    g.arc(-10, 9, 4, 0, Math.PI * 2);
    g.arc(10, 9, 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // The previous cleaner's walkie-talkie: on the floor by the door when
  // dirty, on the desk once clean.
  function paintWalkie(g, x, y, tilt, clean) {
    g.save();
    g.translate(x, y);
    g.rotate(tilt);
    softShadow(g, 0, 2, 16, 4, 0.4);
    paintShape(g, roundedRectPoints(-11, -44, 22, 44, 4), {
      color: aged(S.mixHex(P.gear, P.jumpsuit, 0.2), clean),
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.45,
      strokes: 2,
      rim: 0.4,
      wobble: 0.2,
      seed: 9260,
    });
    g.fillStyle = S.rgba(P.soot, 0.6);
    g.fillRect(-5, -64, 3, 22);
    g.strokeStyle = S.rgba(P.soot, 0.5);
    g.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(-7, -36 + i * 4);
      g.lineTo(7, -36 + i * 4);
      g.stroke();
    }
    g.fillStyle = S.rgba(P.jumpsuit, 0.9);
    g.fillRect(-7, -16, 14, 5);
    g.restore();
  }

  function paintCleanerTrace(g, clean) {
    if (clean) paintWalkie(g, DESK.x0 + 160, DESK.top - 2, 0, clean);
    else paintWalkie(g, 300, 940, -0.2, clean);
  }

  // ── Front layer ───────────────────────────────────────────────────────

  function paintFront(g, clean) {
    g.save();
    g.filter = 'blur(7px)';
    // A beanbag in the right corner and a kite hanging in the top left.
    paintShape(g, [[1760, 1080], [1770, 960], [1840, 920], [1940, 930], [1940, 1080]], {
      color: S.mixHex(clean ? P.rust : S.mixHex(P.rust, P.taupe, 0.4), P.soot, 0.4),
      light: 0.1,
      shadow: 0.4,
      strokes: 8,
      rim: 0.2,
      wobble: 2,
      seed: 9270,
    });
    paintShape(g, [[-20, 120], [60, 60], [120, 150], [40, 230]], {
      color: S.mixHex(P.moon, P.soot, 0.4),
      light: 0.1,
      shadow: 0.4,
      strokes: 6,
      rim: 0.2,
      wobble: 1,
      seed: 9271,
    });
    g.strokeStyle = S.rgba(P.soot, 0.5);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(40, 230);
    g.quadraticCurveTo(70, 300, 30, 380);
    g.stroke();
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
      noise: S.createNoise(seed + 90),
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

  const sweptPast = (mk, x) => mk.wipe >= 0.999 || mk.sweepX > x;

  // Beyond the dormer: night sky with stars and a crescent moon over the
  // gardens; dawn later.
  function drawSky(g, live, t, mk) {
    const { x, y, w, h } = WINDOW;
    const day = mk.window;
    const sky = g.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, S.mix(S.moods.dirty.windowSkyTop, S.moods.clean.windowSkyTop, day));
    sky.addColorStop(1, S.mix(S.moods.dirty.windowSkyBottom, S.moods.clean.windowSkyBottom, day));
    g.fillStyle = sky;
    g.fillRect(x - 4, y - 4, w + 8, h + 8);
    if (day < 1) {
      const rng = S.createRng(9300);
      for (let i = 0; i < 16; i++) {
        const tw = 0.6 + 0.4 * Math.sin(t * 2 + i * 1.7);
        g.fillStyle = `rgba(232,238,248,${0.7 * tw * (1 - day)})`;
        g.fillRect(x + rng.range(0, w), y + rng.range(0, h * 0.6), 2, 2);
      }
      g.fillStyle = `rgba(236,240,248,${1 - day})`;
      g.beginPath();
      g.arc(x + w * 0.3, y + 60 + day * 120, 18, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.mix(S.moods.dirty.windowSkyTop, S.moods.clean.windowSkyTop, day);
      g.beginPath();
      g.arc(x + w * 0.3 + 8, y + 54 + day * 120, 16, 0, Math.PI * 2);
      g.fill();
    }
    if (day > 0) {
      const sun = g.createRadialGradient(x + w * 0.6, y + h + 20 - day * 120, 6, x + w * 0.6, y + h - day * 120, 180);
      sun.addColorStop(0, `rgba(255,236,190,${day})`);
      sun.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = sun;
      g.fillRect(x, y, w, h);
    }
    // Treetops.
    g.fillStyle = S.mix('#0B0E12', '#4E5C52', day);
    for (const [tx, ty, r] of [[0.1, 0.92, 40], [0.4, 0.98, 50], [0.75, 0.9, 46], [1, 0.96, 40]]) {
      g.beginPath();
      g.arc(x + tx * w, y + ty * h, r, 0, Math.PI * 2);
      g.fill();
    }
    void live;
  }

  // The planet mobile: two crossed bars on threads, painted wooden planets
  // at their ends, turning slowly (and a little more when a spider lets go
  // of it). Planets on the far side are smaller and darker.
  const PLANETS = [
    { bar: 0, end: 0, r: 20, hue: P.dawn, ring: true },
    { bar: 0, end: 1, r: 14, hue: P.moon },
    { bar: 1, end: 0, r: 12, hue: P.rust },
    { bar: 1, end: 1, r: 16, hue: P.moss, low: true },
    { bar: -1, end: 0, r: 22, hue: S.mixHex(P.ember, P.dawn, 0.4) },
  ];

  function drawMobile(g, live, t, mk) {
    const clean = sweptPast(mk, MOBILE.x);
    const turn = t * 0.18 + (live.mobileAngle ?? 0);
    const bars = [
      { y: 190, half: 90, angle: turn },
      { y: 250, half: 64, angle: -turn * 1.3 + 1 },
    ];
    g.strokeStyle = S.rgba(P.linen, 0.55);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(MOBILE.x, CEILING - 2);
    g.lineTo(MOBILE.x, bars[1].y);
    g.stroke();
    const items = [];
    bars.forEach((b, i) => {
      const dx = Math.cos(b.angle) * b.half;
      const dz = Math.sin(b.angle);
      g.strokeStyle = S.rgba(aged(P.linen, clean), 0.85);
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(MOBILE.x - dx, b.y + dz * 4);
      g.lineTo(MOBILE.x + dx, b.y - dz * 4);
      g.stroke();
      for (const p of PLANETS.filter((pp) => pp.bar === i)) {
        const s = p.end ? 1 : -1;
        const len = p.low && !clean ? 62 : 34;
        items.push({ p, x: MOBILE.x + s * dx, y: b.y - s * dz * 4 + len, z: s * dz, top: b.y - s * dz * 4 });
      }
    });
    items.push({ p: PLANETS[4], x: MOBILE.x, y: MOBILE.bottom - 18, z: 0, top: bars[1].y });
    items.sort((a, b) => a.z - b.z);
    for (const it of items) {
      g.strokeStyle = S.rgba(P.linen, 0.45);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(it.x, it.top);
      g.lineTo(it.x, it.y - it.p.r);
      g.stroke();
      const r = it.p.r * (1 + it.z * 0.08);
      const hex = aged(it.p.hue, clean);
      const body = g.createRadialGradient(it.x - r * 0.4, it.y - r * 0.4, r * 0.1, it.x, it.y, r);
      body.addColorStop(0, S.shadeHex(hex, 0.25 - it.z * 0.1));
      body.addColorStop(1, S.shadeHex(hex, -0.45 - it.z * 0.1));
      g.fillStyle = body;
      g.beginPath();
      g.arc(it.x, it.y, r, 0, Math.PI * 2);
      g.fill();
      if (it.p.ring) {
        g.strokeStyle = S.rgba(aged(P.linen, clean), 0.85);
        g.lineWidth = 2.5;
        g.beginPath();
        g.ellipse(it.x, it.y, r * 1.7, r * 0.4, -0.25, 0, Math.PI * 2);
        g.stroke();
      }
      if (!clean) {
        g.strokeStyle = S.rgba(P.silk, 0.35);
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(it.x - r, it.y);
        g.quadraticCurveTo(it.x, it.y + r * 1.6, it.x + r, it.y + 2);
        g.stroke();
      }
    }
  }

  // Thomas's drawing, pinned above the shelf. Dirty: curled, bleached, a web
  // over half of it, nothing but scribbles. At the `drawing` beat it
  // uncurls and shows what it is.
  function drawingSprite(live, clean) {
    const { w, h } = DRAWING;
    return sprite(live, `drawing:${clean}`, w, h, (g) => {
      g.fillStyle = clean ? S.mixHex(P.bone, P.linen, 0.15) : S.mixHex(P.bone, P.linen, 0.6);
      g.fillRect(0, 0, w, h);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const crayon = (hex, width, pts, a = 0.9) => {
        g.strokeStyle = S.rgba(hex, a);
        g.lineWidth = width;
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
        g.stroke();
      };
      if (!clean) {
        // Only scribbles survive the sun: a yellow smear of sky, a green
        // line of grass, a few faded strokes.
        crayon(P.dawn, 6, [[10, 14], [60, 10], [120, 16]], 0.35);
        crayon(P.moss, 5, [[4, 96], [70, 92], [136, 98]], 0.4);
        const rng = S.createRng(9310);
        for (let i = 0; i < 6; i++) {
          const x = rng.range(20, 120);
          crayon(i % 2 ? P.rust : P.moon, 2, [[x, rng.range(40, 60)], [x + rng.range(-10, 10), rng.range(70, 88)]], 0.3);
        }
        return;
      }
      // Sky, sun and grass.
      crayon(P.sky, 7, [[6, 10], [50, 12], [100, 8], [134, 12]], 0.6);
      g.fillStyle = S.rgba(P.dawn, 0.9);
      g.beginPath();
      g.arc(122, 18, 10, 0, Math.PI * 2);
      g.fill();
      crayon(P.moss, 6, [[4, 88], [60, 85], [136, 89]], 0.8);
      // A figure: round head, stick body, arms out to hold hands.
      const person = (x, top, size, hex, hair) => {
        g.strokeStyle = S.rgba(hex, 0.95);
        g.lineWidth = 2.2;
        g.beginPath();
        g.arc(x, top + size * 0.18, size * 0.15, 0, Math.PI * 2);
        g.stroke();
        crayon(hex, 2.2, [[x, top + size * 0.33], [x, top + size * 0.7]], 0.95);
        crayon(hex, 2.2, [[x - size * 0.22, top + size * 0.48], [x + size * 0.22, top + size * 0.48]], 0.95);
        crayon(hex, 2.2, [[x - size * 0.14, top + size], [x, top + size * 0.7], [x + size * 0.14, top + size]], 0.95);
        if (hair) crayon(hair, 2.6, [[x - size * 0.16, top + size * 0.12], [x, top + size * 0.02], [x + size * 0.16, top + size * 0.12]], 0.9);
      };
      person(26, 34, 54, P.rust, P.walnut); // MUM
      person(56, 28, 60, P.moon, P.soot); // DAD
      person(84, 50, 40, P.moss, P.dawn); // ME
      // The helper: orange, a hose ending in a nozzle.
      g.fillStyle = S.rgba(P.jumpsuit, 0.95);
      g.beginPath();
      g.arc(116, 54, 6, 0, Math.PI * 2);
      g.fill();
      g.fillRect(111, 60, 10, 18);
      crayon(P.jumpsuit, 2.4, [[112, 78], [110, 88]], 0.95);
      crayon(P.jumpsuit, 2.4, [[120, 78], [122, 88]], 0.95);
      crayon(P.gear, 2.6, [[121, 64], [130, 60], [134, 48], [128, 40]], 0.9);
      g.fillStyle = S.rgba(P.gear, 0.95);
      g.fillRect(124, 36, 8, 5);
      // The labels, in a child's capitals.
      g.fillStyle = S.rgba(P.soot, 0.85);
      g.font = '700 13px Caveat, "Segoe Print", cursive';
      g.textAlign = 'center';
      g.fillText('MUM', 26, 30);
      g.fillText('DAD', 56, 24);
      g.fillText('ME', 84, 46);
      g.font = '700 12px Caveat, "Segoe Print", cursive';
      g.fillText('THE HELPER', 102, 102);
    });
  }

  function drawDrawing(g, live, mk) {
    const flat = S.clamp(mk.drawing ?? 0, 0, 1);
    const { x, y, w, h } = DRAWING;
    const e = S.ease.inOut(flat);
    // Curled: narrower, rolled at the bottom, tilted; flat: square on.
    const curl = 1 - e;
    g.save();
    g.translate(x + w / 2, y + 6);
    g.rotate(-0.06 * curl);
    const hh = h * (1 - 0.32 * curl);
    softShadow(g, 3, hh / 2 + 4, w * 0.5, hh * 0.5, 0.3);
    if (e < 1) g.drawImage(drawingSprite(live, false), -w / 2, 0, w, hh);
    if (e > 0) {
      g.globalAlpha = e;
      g.drawImage(drawingSprite(live, true), -w / 2, 0, w, hh);
      g.globalAlpha = 1;
    }
    if (curl > 0.01) {
      // The roll at the bottom edge, and a web over the right half.
      const roll = g.createLinearGradient(0, hh - 8, 0, hh + 10);
      roll.addColorStop(0, S.mixHex(P.bone, P.linen, 0.5));
      roll.addColorStop(1, S.mixHex(P.linen, P.taupe, 0.5));
      g.fillStyle = roll;
      g.globalAlpha = curl;
      g.fillRect(-w / 2, hh - 4, w, 12 * curl);
      g.strokeStyle = S.rgba(P.silk, 0.6);
      g.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i / 5) * (Math.PI / 2);
        g.beginPath();
        g.moveTo(w / 2, 0);
        g.lineTo(w / 2 + Math.cos(a + Math.PI) * w * 0.7, Math.sin(a + Math.PI) * -hh * 0.9);
        g.stroke();
      }
      for (const r of [20, 36, 52, 68]) {
        g.beginPath();
        g.arc(w / 2, 0, r, Math.PI / 2, Math.PI);
        g.stroke();
      }
      g.fillStyle = S.rgba(P.silk, 0.2);
      g.beginPath();
      g.moveTo(w / 2, 0);
      g.arc(w / 2, 0, 70, Math.PI / 2, Math.PI);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
    }
    // The drawing pin.
    g.fillStyle = S.rgba(P.rust, 0.95);
    g.beginPath();
    g.arc(0, 2, 3.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // The giant shadows. Any spider within 300 px of the projector throws its
  // silhouette up the wall, away from the projector, three to five times
  // its size: drawn small into a scratch canvas, turned into a flat shape,
  // and stretched up — the stretching is what softens it.
  const SHADOW_SIZE = 256; // scratch canvas, at half the stage scale
  function drawGiantShadows(g, live, t) {
    const critters = live.world?.critters;
    if (!critters || !critters.length) return;
    if (!live.shadowCanvas) live.shadowCanvas = S.makeCanvas(SHADOW_SIZE, SHADOW_SIZE);
    const sc = live.shadowCanvas;
    const s = sc.getContext('2d');
    for (const c of critters) {
      if (!c.alive || !c.rig) continue;
      const dx = c.rig.x - PROJECTOR.x;
      const dy = c.rig.y - PROJECTOR.y;
      const d = Math.hypot(dx, dy);
      if (d > 300) continue;
      // Nearer the lamp, bigger the shadow.
      const k = S.lerp(5, 3, S.clamp(d / 300, 0, 1));
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.globalCompositeOperation = 'source-over';
      s.clearRect(0, 0, SHADOW_SIZE, SHADOW_SIZE);
      s.setTransform(0.5, 0, 0, 0.5, SHADOW_SIZE / 2 - c.rig.x * 0.5, SHADOW_SIZE / 2 - c.rig.y * 0.5);
      c.rig.draw(s);
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.globalCompositeOperation = 'source-in';
      s.fillStyle = P.soot;
      s.fillRect(0, 0, SHADOW_SIZE, SHADOW_SIZE);
      // Thrown away from the lamp and up onto the wall.
      let sx = PROJECTOR.x + dx * k;
      let sy = PROJECTOR.y + dy * k - 120;
      sy = S.clamp(sy, 200, 640);
      sx = S.clamp(sx, 200, 1700);
      const size = SHADOW_SIZE * 2 * k;
      // A shadow is darkest close to its caster and fades with distance.
      g.save();
      g.globalAlpha = S.lerp(0.42, 0.26, S.clamp(d / 300, 0, 1));
      g.drawImage(sc, sx - size / 2, sy - size / 2, size, size * 1.08);
      g.restore();
    }
  }

  function drawProps(g, live, t, mk) {
    drawGiantShadows(g, live, t);
    drawMobile(g, live, t, mk);
    drawDrawing(g, live, mk);
  }

  // The chest lid, hinged at the back: 0 shut, a crack ajar when dirty,
  // 1 thrown up when a Jumper pops out.
  function drawChestLid(g, live, mk) {
    const lid = S.clamp(live.chestLid ?? 0, 0, 1.2);
    const clean = sweptPast(mk, CHEST.x0);
    const { x0, x1, top } = CHEST;
    const w = x1 - x0 + 12;
    const ang = lid * 1.1;
    const lift = Math.sin(ang) * 46;
    const depth = Math.cos(ang) * 14;
    g.save();
    // The underside of the lid shows as it rises; the inside of the chest
    // is dark.
    if (lid > 0.02) {
      g.fillStyle = P.soot;
      g.fillRect(x0 + 6, top - 2, x1 - x0 - 12, 10);
    }
    const pts = [[x0 - 6, top + 6 - lift * 0.15], [x1 + 6, top + 6 - lift * 0.15], [x1 + 6, top - depth - lift], [x0 - 6, top - depth - lift]];
    g.fillStyle = aged(S.shadeHex(TONE.chest, 0.1), clean);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
    g.closePath();
    g.fill();
    g.fillStyle = S.rgba(P.bone, 0.15);
    g.fillRect(x0 - 6, top - depth - lift, w, 3);
    g.fillStyle = S.rgba(P.soot, 0.3);
    g.fillRect(x0 - 6, top + 2 - lift * 0.15, w, 4);
    // Stars painted on the lid.
    g.fillStyle = S.rgba(P.dawn, clean ? 0.7 : 0.45);
    for (const sx of [0.2, 0.5, 0.8]) {
      g.beginPath();
      g.arc(x0 + w * sx - 6, top - depth / 2 - lift * 0.6, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // The tin train: an engine and three carriages, following the track. At
  // the `train` beat it runs into the station and stops.
  function trainDist(live, mk) {
    const d = live.trainDist ?? 120;
    const stop = S.clamp(mk.train ?? 0, 0, 1);
    if (stop <= 0) return d;
    // The next time it passes the station, at most one lap ahead.
    const lap = TRACK.perimeter;
    const here = ((d % lap) + lap) % lap;
    const ahead = ((STATION.dist - here) % lap + lap) % lap;
    return d + ahead * S.ease.inOut(stop);
  }

  function drawTrain(g, live, t, mk) {
    const clean = sweptPast(mk, 1000);
    const head = trainDist(live, mk);
    const cars = [0, 28, 56, 84];
    // Draw the far ones (top straight) first.
    const parts = cars.map((off, i) => ({ i, p: trackPos(head - off) })).sort((a, b) => a.p.y - b.p.y);
    for (const { i, p } of parts) {
      g.save();
      g.translate(p.x, p.y);
      const flip = Math.cos(p.heading) < 0 ? -1 : 1;
      g.scale(flip, 1);
      softShadow(g, 0, 4, 14, 4, 0.45);
      const hex = aged(i === 0 ? TONE.tin : [S.mixHex(P.moon, P.linen, 0.25), S.mixHex(P.moss, P.linen, 0.3), S.mixHex(P.dawn, P.rust, 0.3)][i - 1], clean);
      const body = g.createLinearGradient(0, -20, 0, 0);
      body.addColorStop(0, S.shadeHex(hex, 0.25));
      body.addColorStop(1, S.shadeHex(hex, -0.3));
      g.fillStyle = body;
      if (i === 0) {
        // The engine: boiler, cab, chimney, a headlamp.
        g.fillRect(-12, -16, 18, 13);
        g.fillRect(-14, -24, 10, 21);
        g.fillStyle = S.shadeHex(hex, -0.35);
        g.fillRect(2, -24, 5, 9);
        g.fillStyle = S.rgba(P.bone, 0.9);
        g.beginPath();
        g.arc(7, -11, 2.4, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillRect(-11, -15, 22, 12);
        g.fillStyle = S.rgba(P.soot, 0.55);
        g.fillRect(-8, -13, 6, 5);
        g.fillRect(2, -13, 6, 5);
      }
      // A glint along the tin.
      g.fillStyle = S.rgba(P.bone, 0.35);
      g.fillRect(-11, -15, 20, 1.5);
      g.fillStyle = P.soot;
      for (const wx of [-7, 5]) {
        g.beginPath();
        g.arc(wx, -2, 3, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
  }

  // The live toys: a ball, a spinning top and a robot. They sit still and
  // then, every few seconds, one of them moves on its own (room.js picks
  // which: `live.toyTwitch`).
  function twitch(live, toy) {
    const tw = live.toyTwitch;
    if (!tw || tw.toy !== toy || !(tw.timer > 0)) return 0;
    return S.clamp(tw.timer / 1.5, 0, 1);
  }

  function drawToys(g, live, t, mk) {
    // The ball: on the floor when dirty, rolling a little when it twitches;
    // on the shelf once clean.
    const ballClean = sweptPast(mk, 1180);
    const b = twitch(live, 'ball');
    live.ballRoll = (live.ballRoll ?? 0) + (b > 0 ? 0.02 : 0);
    const roll = Math.sin(Math.min(1, live.ballRoll) * Math.PI) * 30;
    const bx = ballClean ? SHELF.x0 + 100 : 1190 + roll;
    const by = ballClean ? SHELF.y - 13 : 920;
    const br = 13;
    softShadow(g, bx, by + br, br, 3, 0.4);
    const ball = g.createRadialGradient(bx - 4, by - 4, 1, bx, by, br);
    ball.addColorStop(0, S.mixHex(P.ember, P.bone, 0.3));
    ball.addColorStop(1, S.mixHex(P.rust, P.soot, 0.3));
    g.fillStyle = ball;
    g.beginPath();
    g.arc(bx, by, br, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = S.rgba(P.bone, 0.7);
    g.lineWidth = 2.4;
    const spin = (ballClean ? 0 : roll / br) + 0.4;
    g.beginPath();
    g.ellipse(bx, by, br, br * 0.35, spin, 0, Math.PI * 2);
    g.stroke();
    // The spinning top: on the shelf when clean, on the rug when dirty.
    const topClean = sweptPast(mk, 640);
    const tp = twitch(live, 'top');
    const tx = topClean ? SHELF.x0 + 140 : 640;
    const ty = topClean ? SHELF.y : 978;
    const wob = tp > 0 ? Math.sin(t * 30) * 0.12 * tp : 0.35;
    g.save();
    g.translate(tx, ty);
    g.rotate(topClean ? 0 : wob);
    softShadow(g, 0, 0, 12, 3, 0.4);
    g.fillStyle = S.mixHex(P.moon, P.linen, 0.3);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-14, -14);
    g.quadraticCurveTo(0, -24, 14, -14);
    g.closePath();
    g.fill();
    g.fillStyle = S.mixHex(P.dawn, P.rust, 0.3);
    const stripe = tp > 0 ? Math.sin(t * 40) * 6 : 0;
    g.fillRect(-10 + stripe * 0.3, -16, 4, 4);
    g.fillRect(4 - stripe * 0.3, -16, 4, 4);
    g.fillStyle = P.walnut;
    g.fillRect(-1.5, -28, 3, 9);
    g.restore();
    // The robot on the shelf, which turns its head.
    const rp = twitch(live, 'robot');
    const rx = SHELF.x0 + 22;
    const ry = SHELF.y;
    const head = rp > 0 ? Math.sin((1 - rp) * Math.PI) : 0;
    const tin = S.mixHex(P.gear, P.moon, 0.3);
    g.fillStyle = tin;
    g.fillRect(rx - 11, ry - 34, 22, 26);
    g.fillRect(rx - 9, ry - 8, 6, 8);
    g.fillRect(rx + 3, ry - 8, 6, 8);
    g.fillStyle = S.shadeHex(tin, -0.2);
    g.fillRect(rx - 16, ry - 32, 5, 16);
    g.fillRect(rx + 11, ry - 32, 5, 16);
    g.fillStyle = S.rgba(P.dawn, 0.8);
    g.fillRect(rx - 6, ry - 28, 12, 6);
    // Head, turning: the face slides across as it turns.
    g.fillStyle = S.shadeHex(tin, 0.15);
    g.fillRect(rx - 9, ry - 52, 18, 16);
    g.fillStyle = S.rgba(P.ember, 0.9);
    const fx = rx - 4 + head * 6;
    g.fillRect(fx - 2, ry - 47, 3, 3);
    g.fillRect(fx + 4, ry - 47, 3, 3);
    g.fillStyle = S.rgba(P.soot, 0.6);
    g.fillRect(fx - 1, ry - 41, 7, 1.5);
    g.fillStyle = S.rgba(P.bone, 0.5);
    g.fillRect(rx - 1, ry - 60, 2, 8);
  }

  // The music box on the shelf: shut and dusty in the dirty room; at the
  // `musicbox` beat its lid opens and the little figure turns.
  function drawMusicBox(g, live, t, mk) {
    const open = S.clamp(mk.musicbox ?? 0, 0, 1);
    const cx = SHELF.x0 + 235;
    const base = SHELF.y;
    const clean = sweptPast(mk, cx);
    softShadow(g, cx, base, 24, 4, 0.4);
    paintShapeLive(g, roundedRectPoints(cx - 20, base - 20, 40, 20, 3), aged(S.mixHex(P.plum, P.rust, 0.3), clean));
    g.fillStyle = aged(P.brass, clean);
    g.fillRect(cx - 20, base - 12, 40, 2);
    // The figure: a little dancer on a spindle, turning once open.
    if (open > 0.01) {
      const rise = open * 16;
      const spin = t * 2.2;
      const face = Math.cos(spin);
      g.fillStyle = aged(P.brass, clean);
      g.fillRect(cx - 1, base - 20 - rise, 2, rise);
      g.fillStyle = S.mixHex(P.bone, P.dawn, 0.2);
      g.beginPath();
      g.moveTo(cx, base - 20 - rise - 12);
      g.lineTo(cx - 7 * Math.abs(face) - 1, base - 20 - rise);
      g.lineTo(cx + 7 * Math.abs(face) + 1, base - 20 - rise);
      g.closePath();
      g.fill();
      g.beginPath();
      g.arc(cx, base - 20 - rise - 15, 3, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = S.mixHex(P.bone, P.dawn, 0.2);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(cx - 6 * face, base - 20 - rise - 14);
      g.lineTo(cx + 6 * face, base - 20 - rise - 20);
      g.stroke();
    }
    // The lid, hinged at the back, opening up and back.
    const ang = open * 1.9;
    const lh = 20 * Math.cos(ang);
    const ly = base - 20 - Math.max(0, Math.sin(ang)) * 2;
    g.fillStyle = aged(S.mixHex(P.plum, P.rust, 0.2), clean);
    if (lh >= 0) {
      g.fillRect(cx - 21, ly - 4 - lh * 0.1, 42, 5);
    } else {
      g.fillRect(cx - 21, ly + lh - 4, 42, -lh + 2);
      g.fillStyle = S.rgba(P.bone, 0.4);
      g.fillRect(cx - 17, ly + lh - 1, 34, -lh - 3);
    }
    if (!clean) {
      g.fillStyle = S.rgba(P.taupe, 0.3);
      g.fillRect(cx - 20, base - 24, 40, 24);
    }
  }

  function paintShapeLive(g, pts, hex) {
    const b = S.paint.boundsOf(pts);
    const grad = g.createLinearGradient(0, b.y, 0, b.y + b.h);
    grad.addColorStop(0, S.shadeHex(hex, 0.2));
    grad.addColorStop(1, S.shadeHex(hex, -0.3));
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
    g.closePath();
    g.fill();
  }

  // The star projector: a little drum on legs with a pierced shade that
  // turns, a warm bulb inside.
  function drawProjector(g, live, t, mk) {
    const { x, y } = PROJECTOR;
    const turn = projectorTurn(live, t, mk);
    g.save();
    g.translate(x, y + 30);
    g.scale(1.3, 1.3);
    g.translate(-x, -(y + 30));
    softShadow(g, x, y + 30, 26, 5, 0.5);
    g.fillStyle = S.mixHex(P.walnut, P.oak, 0.4);
    for (const lx of [-14, 12]) g.fillRect(x + lx, y + 12, 3, 18);
    const shell = g.createLinearGradient(x - 20, 0, x + 20, 0);
    shell.addColorStop(0, S.mixHex(P.moon, P.umber, 0.5));
    shell.addColorStop(0.4, S.mixHex(P.moon, P.linen, 0.3));
    shell.addColorStop(1, S.mixHex(P.moon, P.soot, 0.6));
    g.fillStyle = shell;
    g.beginPath();
    g.moveTo(x - 18, y + 14);
    g.lineTo(x - 14, y - 16);
    g.quadraticCurveTo(x, y - 26, x + 14, y - 16);
    g.lineTo(x + 18, y + 14);
    g.closePath();
    g.fill();
    // The pierced holes, turning: the light shows through them.
    const warm = S.mix(S.mixHex(P.bone, P.moon, 0.3), P.dawn, S.clamp(mk.stars ?? 0, 0, 1));
    g.fillStyle = warm;
    for (let i = 0; i < 10; i++) {
      const a = turn + (i / 10) * Math.PI * 2;
      const fx = Math.sin(a);
      if (Math.cos(a) < 0) continue;
      const hy = y - 8 + (i % 3) * 7;
      g.beginPath();
      g.arc(x + fx * 14, hy, 1.6 * Math.cos(a) + 0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = S.mixHex(P.brass, P.walnut, 0.3);
    g.fillRect(x - 19, y + 12, 38, 4);
    g.restore();
  }

  function drawOnFurniture(g, live, t, mk) {
    drawChestLid(g, live, mk);
    drawProjector(g, live, t, mk);
    drawToys(g, live, t, mk);
    drawMusicBox(g, live, t, mk);
    drawTrain(g, live, t, mk);
    drawWalkieLed(g, live, mk);
  }

  function drawWalkieLed(g, live, mk) {
    if (sweptPast(mk, 300)) return;
    const on = live.walkieCrackle ?? 0;
    if (on <= 0.01) return;
    g.fillStyle = S.rgba(P.spiderEye, 0.9 * on);
    g.beginPath();
    g.arc(300 - 2, 940 - 40, 2.2, 0, Math.PI * 2);
    g.fill();
  }

  // ── Light ─────────────────────────────────────────────────────────────

  // The projector turns at its own pace; once the `stars` beat has run it
  // slows to a calm turn. The angle is integrated so the slowing is smooth.
  function projectorTurn(live, t, mk) {
    const calm = S.clamp(mk.stars ?? 0, 0, 1);
    const speed = S.lerp(0.22, 0.07, calm);
    const last = live.turnT ?? t;
    const dt = S.clamp(t - last, 0, 0.1);
    live.turnT = t;
    live.turn = (live.turn ?? 0) + speed * dt;
    return live.turn;
  }

  // Stars and moons: fixed on a sphere round the projector (an azimuth and a
  // height each), turned about the upright axis and thrown onto the wall and
  // ceiling. Ones facing away land on the wall behind the player and are
  // not shown.
  const SKY = (() => {
    const rng = S.createRng(9400);
    const list = [];
    for (let i = 0; i < 44; i++) {
      list.push({
        az: rng.range(0, Math.PI * 2),
        h: rng.range(0.12, 1),
        size: rng.range(0.7, 1.3),
        moon: i % 11 === 0,
      });
    }
    return list;
  })();

  // A five-pointed star and a crescent, each painted once with a soft edge
  // (the blur is in this paint-once code, never per frame).
  function starSprite(live, warm) {
    return sprite(live, `star:${warm}`, 64, 64, (g) => {
      const hex = warm ? P.dawn : S.mixHex(P.bone, P.moon, 0.4);
      const halo = g.createRadialGradient(32, 32, 0, 32, 32, 31);
      halo.addColorStop(0, S.rgba(hex, 0.35));
      halo.addColorStop(1, S.rgba(hex, 0));
      g.fillStyle = halo;
      g.fillRect(0, 0, 64, 64);
      g.filter = 'blur(2.5px)';
      g.fillStyle = S.rgba(hex, 0.95);
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
        const r = k % 2 ? 9 : 22;
        g.lineTo(32 + Math.cos(a) * r, 33 + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      g.filter = 'none';
    });
  }

  function moonSprite(live, warm) {
    return sprite(live, `moon:${warm}`, 80, 80, (g) => {
      const hex = warm ? P.dawn : S.mixHex(P.bone, P.moon, 0.4);
      const halo = g.createRadialGradient(40, 40, 0, 40, 40, 39);
      halo.addColorStop(0, S.rgba(hex, 0.3));
      halo.addColorStop(1, S.rgba(hex, 0));
      g.fillStyle = halo;
      g.fillRect(0, 0, 80, 80);
      const c = S.makeCanvas(80, 80);
      const m = c.getContext('2d');
      m.fillStyle = S.rgba(hex, 0.95);
      m.beginPath();
      m.arc(40, 40, 26, 0, Math.PI * 2);
      m.fill();
      m.globalCompositeOperation = 'destination-out';
      m.beginPath();
      m.arc(52, 32, 24, 0, Math.PI * 2);
      m.fill();
      g.filter = 'blur(2.5px)';
      g.drawImage(c, 0, 0);
      g.filter = 'none';
    });
  }

  function projected(live, t, mk) {
    const turn = live.turn ?? 0;
    const out = [];
    for (const s of SKY) {
      const a = s.az + turn;
      const facing = Math.cos(a);
      if (facing < -0.1) continue;
      const x = PROJECTOR.x + Math.sin(a) * 1150;
      const y = PROJECTOR.y - 120 - s.h * 820;
      // Further from the lamp, bigger and fainter.
      const far = Math.hypot(x - PROJECTOR.x, y - PROJECTOR.y) / 1000;
      const r = (s.moon ? 30 : 16) * s.size * (0.8 + far * 0.7);
      const a2 = S.clamp((facing + 0.1) * 2.5, 0, 1) * S.lerp(1, 0.55, Math.min(1, far));
      out.push({ x, y, r, a: a2, moon: s.moon });
    }
    void t;
    void mk;
    return out;
  }

  function starLight(lm, live, t, mk) {
    const g = lm.ctx; // stage units, compositing 'lighter'
    const warm = S.clamp(mk.stars ?? 0, 0, 1);
    const cold = { star: starSprite(live, false), moon: moonSprite(live, false) };
    const hot = { star: starSprite(live, true), moon: moonSprite(live, true) };
    g.save();
    for (const p of projected(live, t, mk)) {
      const size = p.r * 2.4;
      for (const [set, k] of [[cold, 1 - warm], [hot, warm]]) {
        if (k <= 0.01) continue;
        g.globalAlpha = Math.min(1, p.a * k * 1.1);
        g.drawImage(p.moon ? set.moon : set.star, p.x - size / 2, p.y - size / 2, size, size);
      }
    }
    g.restore();
  }

  function deskLamp(mk) {
    return sweptPast(mk, DESK.x1) ? 1 : 0;
  }

  function lights(lm, live, t, mk) {
    projectorTurn(live, t, mk);
    const win = S.mixHex(P.moon, P.dawn, mk.window);
    const { x, y, w, h } = WINDOW;
    lm.point(x + w / 2, y + h / 2, 400, win, S.lerp(0.5, 0.8, mk.window));
    lm.shaft([[x + 10, y + 20], [x + w - 10, y + 20], [x + w - 220, 1000], [x - 260, 1000]], win, S.lerp(0.6, 0.85, mk.window));
    // The projector's own glow on the floor and the chest.
    const warm = S.clamp(mk.stars ?? 0, 0, 1);
    const lampHex = S.mixHex(S.mixHex(P.bone, P.moon, 0.45), P.dawn, warm);
    lm.point(PROJECTOR.x, PROJECTOR.y - 6, 220, lampHex, 0.55);
    starLight(lm, live, t, mk);
    const desk = deskLamp(mk);
    if (desk > 0) {
      lm.point(DESK.x1 - 150, DESK.top - 100, 200, P.amber, 0.7 * desk);
      lm.cone(DESK.x1 - 150, DESK.top - 106, Math.PI / 2 + 0.25, 1.4, 300, P.amber, 0.7 * desk);
    }
    // The hallway's sconce, warm through the door gap once clean.
    if (sweptPast(mk, DOOR.x + 40)) {
      lm.point(DOOR.x + 24, DOOR.y + 200, 200, P.amber, 0.55);
      lm.cone(DOOR.x + 40, FLOOR_LINE, Math.PI / 2 - 0.5, 0.7, 380, P.amber, 0.45);
    }
    return 1;
  }

  function glow(g, lm, live, t, mk) {
    const winHex = mk.window > 0.5 ? P.dawn : P.moon;
    const { x, y, w, h } = WINDOW;
    S.light.glow(g, x + w / 2, y + h / 2, 180, winHex, S.lerp(0.16, 0.26, mk.window));
    const warm = S.clamp(mk.stars ?? 0, 0, 1);
    S.light.glow(g, PROJECTOR.x, PROJECTOR.y - 6, 40, warm > 0.5 ? P.dawn : P.moon, 0.5);
    // The stars themselves glow a little on top, so they read as light.
    g.save();
    g.globalCompositeOperation = 'screen';
    const set = warm > 0.5 ? { star: starSprite(live, true), moon: moonSprite(live, true) } : { star: starSprite(live, false), moon: moonSprite(live, false) };
    for (const p of projected(live, t, mk)) {
      const size = p.r * 2.4;
      g.globalAlpha = p.a * 0.22;
      g.drawImage(p.moon ? set.moon : set.star, p.x - size / 2, p.y - size / 2, size, size);
    }
    g.restore();
    if (deskLamp(mk) > 0) S.light.glow(g, DESK.x1 - 150, DESK.top - 100, 40, P.amber, 0.6);
    void lm;
  }

  function beat() {}

  S.rooms.attachArt('kids-bedroom', {
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
