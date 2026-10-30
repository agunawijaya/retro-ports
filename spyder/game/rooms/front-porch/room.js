/*
 * Spyder — Room 1: the Front Porch (the tutorial).
 *
 * An exterior: the porch of the house at night, seen from the front yard.
 * It is the first room the player sees, so it sets the tone — cozy-creepy,
 * the house waiting with its door shut and one lantern swinging.
 *
 * Same shape as rooms/living-room/room.js (the template): layout data,
 * paint() into cached `dirty` and `clean` layers, webs, the far layer,
 * live props, the light rig and the glow pass. What is new here:
 *
 *   - There is no window to look out of. The far layer (sky, moon, trees,
 *     a neighbour's lit window, a street lamp) shows past the porch posts
 *     on both sides, through `layout.farRegions`.
 *   - The porch swing is a platform that moves. onUpdate() pushes it and
 *     the runtime carries the hero standing on it.
 *   - The lantern swings and flickers, and the shadows of its frame sweep
 *     across the porch with it (drawn into the light map).
 *   - The tutorial: six handwritten notes from "A.", pinned to the left
 *     post one at a time, each with its own scripted setup. They live in
 *     the DOM (crisp Caveat text, readable by screen readers) and are torn
 *     off when their job is done. See the Tutorial section near the end.
 *
 * Unique makeover beat (from 3.4 s): the lantern stops swinging, the front
 * door swings open a crack and lays a wedge of warm light across the
 * boards, then the two windows light up one after the other.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const { paintShape, wobblyPath, rectPoints, roundedRectPoints, ellipsePoints, softShadow, stain } = S.paint;

  // ── Layout ────────────────────────────────────────────────────────────

  const CEILING = 120; // where the porch ceiling meets the house; spiders drop from here
  const FLOOR_LINE = 770; // where the facade meets the porch floor
  const GROUND = 935; // where the hero walks
  const PORCH_EDGE = 1000; // the front edge of the porch; the steps start below it

  const FACADE = { x0: 150, x1: 1770 };
  const COLUMNS = [
    { x: 150, w: 50, side: -1 },
    { x: 1720, w: 50, side: 1 },
  ];
  // The lantern hangs on a short chain; its glass box is y 150–230.
  const LANTERN = { x: 1150, pivotY: CEILING, glassTop: 152, glassBottom: 228, half: 27 };
  const LAMP_AT = { x: LANTERN.x, y: 190 }; // for light directions when painting

  const DOOR = { x: 870, y: 332, w: 180, h: FLOOR_LINE - 332 };
  const TRANSOM = { x: 870, y: 256, w: 180, h: 46 };
  const PLATE = { x: 960, y: 317, rx: 64, ry: 16 };
  const WINDOWS = [
    { x: 380, y: 270, w: 240, h: 290, id: 'left' },
    { x: 1280, y: 270, w: 240, h: 290, id: 'right' },
  ];
  const SHUTTER_W = 62;
  const SWING = { x0: 300, x1: 620, seat: 800, hooks: [332, 588] };
  const PLANTER = { x: 1300, w: 160, top: 820, floor: 932 };
  const RAILING = { x0: 1560, x1: 1840, top: 760, floor: 930 };
  const FERN = { x: 750, basketY: 252 };
  const MAILBOX = { x: 1096, y: 498, w: 58, h: 78 };
  const MAT = { cx: 960, top: 786, bottom: 842, wTop: 236, wBottom: 270 };

  // The swing seat is a platform that moves; the runtime carries the hero on it.
  const swingPlatform = { name: 'swing', x0: SWING.x0 + 20, x1: SWING.x1 - 20, y: SWING.seat, oneWay: true };

  const FAR_REGIONS = [
    { x: 0, y: 0, w: FACADE.x0, h: FLOOR_LINE + 2 },
    { x: FACADE.x1, y: 0, w: 1920 - FACADE.x1, h: FLOOR_LINE + 2 },
  ];

  const layout = {
    name: 'Front Porch',
    act: 1,
    number: 1,
    CEILING,
    FLOOR_LINE,
    GROUND,
    // The hero stays between the posts; the left post carries the notes.
    bounds: { left: 232, right: 1790 },
    heroStart: 760,
    platforms: [
      { name: 'floor', x0: 0, x1: 1920, y: GROUND, oneWay: false },
      swingPlatform,
      { name: 'planter', x0: PLANTER.x + 4, x1: PLANTER.x + PLANTER.w - 4, y: PLANTER.top, oneWay: true },
      { name: 'railing', x0: RAILING.x0, x1: RAILING.x1, y: RAILING.top, oneWay: true },
    ],
    // String spiders drop from the porch ceiling. None from under the lantern.
    dropPoints: [300, 470, 680, 860, 1010, 1300, 1450, 1620],
    hoverBand: [360, 600],
    lairs: [{ x: 960, y: 240, label: 'under the eaves' }], // no wall crawlers on the porch yet
    wallArea: { x0: FACADE.x0 + 40, x1: FACADE.x1 - 40, y0: CEILING + 30, y1: 600 },
    farRegions: FAR_REGIONS,
    lookout: { x: 1010, y: 430 }, // the door, during the makeover
    dustArea: { x: 60, y: 110, w: 1800, h: 880 },
    breakables: [{ x: 330, y: GROUND, contains: 'coins' }],
  };

  // ── Colours (mixed from the palette, never invented) ─────────────────

  const C = {
    siding: [S.mixHex(P.taupe, P.moon, 0.28), S.mixHex(S.mixHex(P.taupe, P.moon, 0.26), P.oak, 0.12)],
    ceiling: [S.shadeHex(S.mixHex(P.taupe, P.moon, 0.32), -0.22), S.shadeHex(S.mixHex(P.moon, P.linen, 0.5), -0.18)],
    trim: [S.mixHex(P.linen, P.taupe, 0.58), S.mixHex(P.bone, P.linen, 0.45)],
    floor: [S.mixHex(P.taupe, P.walnut, 0.3), S.mixHex(P.oak, P.taupe, 0.45)],
    shutter: [S.mixHex(P.moss, P.taupe, 0.55), S.mixHex(P.moss, P.umber, 0.22)],
    door: [S.mixHex(S.mixHex(P.taupe, P.linen, 0.2), P.moon, 0.12), S.shadeHex(P.moss, -0.12)],
    brass: [S.mixHex(P.brass, P.walnut, 0.55), P.brass],
    gloves: [S.mixHex(S.mixHex(P.amber, P.linen, 0.5), P.taupe, 0.5), S.shadeHex(S.mixHex(P.amber, P.linen, 0.42), -0.08)],
    coral: S.mixHex(S.mixHex(P.ember, P.plum, 0.2), P.linen, 0.26),
    leaf: [S.mixHex(P.moss, P.oak, 0.6), S.mixHex(P.moss, P.linen, 0.14)],
  };
  const pick = (pair, clean) => pair[clean ? 1 : 0];

  // ── Small helpers ─────────────────────────────────────────────────────

  // Unit vector from (x, y) toward a light (the lantern by default).
  function toward(x, y, from = LAMP_AT) {
    const dx = from.x - x;
    const dy = from.y - y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }

  // A long man-made line drawn by hand: straight overall, wavering a little.
  function handLine(g, x0, y0, x1, y1, seed, amp = 0.8, step = 26) {
    const noise = S.createNoise(seed);
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const n = Math.max(1, Math.round(len / step));
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    g.moveTo(x0, y0);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const push = i === n ? 0 : noise(i * 0.7 + seed * 0.1) * amp;
      g.lineTo(S.lerp(x0, x1, t) + nx * push, S.lerp(y0, y1, t) + ny * push);
    }
  }

  // A blurred drop shadow for things on the facade. Light comes mostly from
  // the lantern, so shadows fall away from it.
  function dropShadow(g, x, y, w, h, blur = 10, alpha = 0.45, shape = 'rect') {
    const away = toward(x + w / 2, y + h / 2);
    g.save();
    g.filter = `blur(${blur}px)`;
    g.fillStyle = `rgba(8,8,10,${alpha})`;
    const ox = -away.x * 12;
    const oy = Math.max(6, -away.y * 10);
    if (shape === 'ellipse') {
      g.beginPath();
      g.ellipse(x + w / 2 + ox, y + h / 2 + oy, w / 2, h / 2, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(x + ox, y + oy, w, h);
    }
    g.restore();
  }

  // ── Static painting ───────────────────────────────────────────────────

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

  function paintBack(g, clean) {
    paintSiding(g, clean);
    paintCeiling(g, clean);
    for (const win of WINDOWS) paintWindow(g, win, clean);
    paintDoorway(g, clean);
    paintWallDetails(g, clean);
    paintFloor(g, clean);
    paintMat(g, clean);
    if (!clean) paintBackGrime(g);
    else paintBackFresh(g);
  }

  // Clapboard: horizontal boards 34 px tall, each lapping over the one
  // below. The lower edge of a board sticks out, so it catches light; the
  // board under it sits in that edge's shadow. That pair, repeated, is what
  // makes siding read as boards instead of stripes.
  function paintSiding(g, clean) {
    const base = pick(C.siding, clean);
    const top = CEILING - 6;
    paintShape(g, rectPoints(FACADE.x0 - 10, top, FACADE.x1 - FACADE.x0 + 20, FLOOR_LINE - top + 4), {
      color: base,
      lightDir: { x: 0.35, y: -1 },
      light: 0.14,
      shadow: 0.32,
      strokes: 10,
      strokeAngle: 0,
      strokeJitter: 0.05,
      strokeSize: 1.3,
      variance: 0.09,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 301,
    });

    const rng = S.createRng(clean ? 311 : 312);
    const BOARD = 34;
    g.save();
    g.beginPath();
    g.rect(FACADE.x0 - 10, CEILING, FACADE.x1 - FACADE.x0 + 20, FLOOR_LINE - CEILING);
    g.clip();
    for (let y = CEILING, k = 0; y < FLOOR_LINE; y += BOARD, k++) {
      // Each board was painted (and has weathered) a little differently.
      const tone = rng.range(-0.06, 0.06);
      g.fillStyle = tone > 0 ? `rgba(235,228,214,${tone * 0.9})` : `rgba(10,10,14,${-tone * 1.4})`;
      g.fillRect(FACADE.x0 - 10, y, FACADE.x1 - FACADE.x0 + 20, BOARD);

      // The board's face tilts outward toward its lower edge.
      const face = g.createLinearGradient(0, y, 0, y + BOARD);
      face.addColorStop(0, 'rgba(8,10,14,0.38)');
      face.addColorStop(0.28, 'rgba(8,10,14,0.06)');
      face.addColorStop(0.85, 'rgba(240,232,218,0.05)');
      face.addColorStop(1, 'rgba(240,232,218,0.1)');
      g.fillStyle = face;
      g.fillRect(FACADE.x0 - 10, y, FACADE.x1 - FACADE.x0 + 20, BOARD);

      // Lit lower edge, then the shadow lip under it.
      g.strokeStyle = clean ? 'rgba(245,236,220,0.26)' : 'rgba(225,220,210,0.17)';
      g.lineWidth = 2;
      g.beginPath();
      handLine(g, FACADE.x0 - 10, y + BOARD - 2, FACADE.x1 + 10, y + BOARD - 2, 320 + k, 0.7);
      g.stroke();
      g.strokeStyle = 'rgba(6,7,10,0.55)';
      g.lineWidth = 2.5;
      g.beginPath();
      handLine(g, FACADE.x0 - 10, y + BOARD + 0.5, FACADE.x1 + 10, y + BOARD + 0.5, 340 + k, 0.7);
      g.stroke();

      // Butt joints where two boards meet end to end, staggered row to row.
      let x = FACADE.x0 + rng.range(40, 420);
      while (x < FACADE.x1) {
        g.strokeStyle = 'rgba(6,7,10,0.4)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x, y + 3);
        g.lineTo(x + rng.range(-0.8, 0.8), y + BOARD - 1);
        g.stroke();
        g.strokeStyle = 'rgba(235,228,214,0.09)';
        g.beginPath();
        g.moveTo(x + 2, y + 3);
        g.lineTo(x + 2, y + BOARD - 1);
        g.stroke();
        x += rng.range(380, 760);
      }
      // A nail head here and there.
      for (let i = 0; i < 6; i++) {
        g.fillStyle = 'rgba(20,18,16,0.35)';
        g.beginPath();
        g.arc(FACADE.x0 + rng.range(10, FACADE.x1 - FACADE.x0 - 10), y + BOARD - 7, 1.4, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();

    // The swing's shadow on the siding behind it, thrown down and away from the moon.
    g.save();
    g.filter = 'blur(14px)';
    g.fillStyle = 'rgba(6,6,9,0.42)';
    g.fillRect(SWING.x0 + 40, SWING.seat - 100, SWING.x1 - SWING.x0 - 20, 120);
    g.restore();
    // (No corner boards: next to the posts they read as a second pair of posts.)
    for (const x of []) {
      paintShape(g, rectPoints(x, CEILING, 22, FLOOR_LINE - CEILING), {
        color: pick(C.trim, clean),
        lightDir: toward(x, 400),
        light: 0.15,
        shadow: 0.4,
        strokes: 10,
        strokeAngle: Math.PI / 2,
        rim: 0.3,
        innerShadow: 0.3,
        wobble: 0.4,
        seed: 330 + x,
      });
    }
  }

  // Beadboard: thin boards parallel to the house, seen from below. They
  // crowd together toward the facade, which is what makes the band read as
  // a ceiling going away from us rather than a stripe across the top.
  function paintCeiling(g, clean) {
    const x0 = FACADE.x0 - 14;
    const x1 = FACADE.x1 + 14;
    paintShape(g, rectPoints(x0, 0, x1 - x0, CEILING + 4), {
      color: pick(C.ceiling, clean),
      lightDir: { x: 0, y: 1 },
      light: 0.16,
      shadow: 0.38,
      strokes: 8,
      strokeAngle: 0,
      strokeJitter: 0.04,
      variance: 0.08,
      rim: 0,
      innerShadow: 0.2,
      wobble: 0,
      seed: 302,
    });

    // Board lines, spacing shrinking toward the facade.
    let y = 40;
    let gap = 13;
    let k = 0;
    while (y < CEILING - 2) {
      g.strokeStyle = 'rgba(8,9,12,0.42)';
      g.lineWidth = 1.4;
      g.beginPath();
      handLine(g, x0, y, x1, y, 360 + k, 0.5, 40);
      g.stroke();
      // The bead: a thin light line just inside each groove.
      g.strokeStyle = clean ? 'rgba(240,238,230,0.16)' : 'rgba(220,220,215,0.08)';
      g.lineWidth = 1;
      g.beginPath();
      handLine(g, x0, y + 2, x1, y + 2, 380 + k, 0.5, 40);
      g.stroke();
      y += gap;
      gap = Math.max(4.5, gap * 0.86);
      k++;
    }

    // The front beam and the gutter at the very top edge.
    paintShape(g, rectPoints(x0 - 6, 0, x1 - x0 + 12, 38), {
      color: S.shadeHex(pick(C.trim, clean), -0.25),
      lightDir: { x: 0, y: 1 },
      light: 0.2,
      shadow: 0.35,
      strokes: 10,
      strokeAngle: 0,
      rim: 0.35,
      innerShadow: 0.3,
      wobble: 0.4,
      seed: 303,
    });
    const gutter = g.createLinearGradient(0, 0, 0, 14);
    gutter.addColorStop(0, S.shadeHex(P.taupe, -0.45));
    gutter.addColorStop(0.6, S.shadeHex(P.taupe, -0.15));
    gutter.addColorStop(1, S.shadeHex(P.taupe, -0.5));
    g.fillStyle = gutter;
    g.fillRect(x0 - 10, 0, x1 - x0 + 20, 13);
    // Underside of the beam catches the lantern.
    g.strokeStyle = clean ? 'rgba(255,236,206,0.3)' : 'rgba(242,190,120,0.2)';
    g.lineWidth = 2;
    g.beginPath();
    handLine(g, x0, 37, x1, 37, 305, 0.5, 40);
    g.stroke();

    // Where the ceiling meets the house: a deep shadow line, then the frieze board.
    const junction = g.createLinearGradient(0, CEILING - 22, 0, CEILING + 4);
    junction.addColorStop(0, 'rgba(6,6,9,0)');
    junction.addColorStop(1, 'rgba(6,6,9,0.6)');
    g.fillStyle = junction;
    g.fillRect(x0, CEILING - 22, x1 - x0, 26);
    paintShape(g, rectPoints(FACADE.x0, CEILING + 2, FACADE.x1 - FACADE.x0, 14), {
      color: pick(C.trim, clean),
      lightDir: { x: 0, y: -1 },
      light: 0.1,
      shadow: 0.45,
      strokes: 8,
      rim: 0,
      innerShadow: 0.2,
      wobble: 0.3,
      seed: 304,
    });
    g.fillStyle = 'rgba(6,6,9,0.45)';
    g.fillRect(FACADE.x0, CEILING + 16, FACADE.x1 - FACADE.x0, 5);

    // The roof ends at the posts: dark end boards against the sky.
    for (const x of [x0 - 8, x1 - 6]) {
      paintShape(g, rectPoints(x, 0, 14, CEILING + 8), {
        color: S.shadeHex(pick(C.trim, clean), -0.45),
        lightDir: { x: 0, y: 1 },
        light: 0.1,
        shadow: 0.3,
        strokes: 8,
        strokeAngle: Math.PI / 2,
        rim: 0,
        innerShadow: 0,
        wobble: 0.3,
        seed: 306 + x,
      });
    }
  }

  // ── Windows ───────────────────────────────────────────────────────────

  // The six panes of a sash window (three over three), in stage units.
  // The live layer lights exactly these rects during the makeover.
  function windowPanes(win) {
    const fx = win.x + 16;
    const fy = win.y + 16;
    const fw = win.w - 32;
    const fh = win.h - 32;
    const rail = 14;
    const bar = 8;
    const sashH = (fh - rail) / 2;
    const paneW = (fw - bar * 2) / 3;
    const out = [];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        out.push({ x: fx + col * (paneW + bar), y: fy + row * (sashH + rail), w: paneW, h: sashH });
      }
    }
    return out;
  }

  function paintWindow(g, win, clean) {
    const { x, y, w, h } = win;
    const trim = pick(C.trim, clean);
    const light = toward(x + w / 2, y + h / 2);

    // Casing with a little cornice on top, set out from the siding.
    dropShadow(g, x - 22, y - 34, w + 44, h + 76, 12, 0.5);
    paintShape(g, rectPoints(x - 20, y - 20, w + 40, h + 40), {
      color: trim,
      lightDir: light,
      light: 0.16,
      shadow: 0.42,
      strokes: 10,
      strokeAngle: Math.PI / 2,
      rim: 0.35,
      innerShadow: 0.3,
      wobble: 0.5,
      seed: 400 + x,
    });
    paintShape(g, rectPoints(x - 32, y - 36, w + 64, 18), {
      color: S.shadeHex(trim, 0.05),
      lightDir: { x: light.x, y: -1 },
      light: 0.22,
      shadow: 0.35,
      strokes: 10,
      rim: 0.45,
      innerShadow: 0.2,
      wobble: 0.4,
      seed: 402 + x,
    });
    g.fillStyle = 'rgba(6,6,9,0.4)';
    g.fillRect(x - 28, y - 18, w + 56, 4);

    // The dark room behind the glass. It is lit only in the makeover (live layer).
    paintWindowInterior(g, win, clean);

    // Sashes: rails, the meeting rail and the muntins, all one painted wood.
    const frame = S.shadeHex(trim, -0.08);
    const fx = x + 16;
    const fy = y + 16;
    const fw = w - 32;
    const fh = h - 32;
    const panes = windowPanes(win);
    const bars = [
      [x, y, w, 16],
      [x, y + h - 16, w, 16],
      [x, y, 16, h],
      [x + w - 16, y, 16, h],
      [fx, panes[3].y - 14, fw, 14], // meeting rail
    ];
    for (const p of panes.slice(0, 2)) bars.push([p.x + p.w, fy, 8, fh]);
    g.fillStyle = frame;
    for (const [bx, by, bw, bh] of bars) g.fillRect(bx, by, bw, bh);
    // Bevels: dark inside edge, light outside edge, on every pane opening.
    for (const p of panes) {
      g.strokeStyle = 'rgba(6,6,9,0.5)';
      g.lineWidth = 2;
      g.strokeRect(p.x, p.y, p.w, p.h);
      g.strokeStyle = 'rgba(245,236,220,0.14)';
      g.beginPath();
      g.moveTo(p.x - 2, p.y + p.h + 2);
      g.lineTo(p.x + p.w + 2, p.y + p.h + 2);
      g.lineTo(p.x + p.w + 2, p.y - 2);
      g.stroke();
    }
    // A sash lock on the meeting rail.
    g.fillStyle = pick(C.brass, clean);
    g.fillRect(x + w / 2 - 9, panes[3].y - 11, 18, 6);

    // Glass: a cold reflection streak; grime and a crack when dirty.
    g.save();
    g.beginPath();
    for (const p of panes) g.rect(p.x, p.y, p.w, p.h);
    g.clip();
    const sheen = g.createLinearGradient(x, y, x + w, y + h);
    sheen.addColorStop(0, clean ? 'rgba(225,232,240,0.16)' : 'rgba(127,163,199,0.22)');
    sheen.addColorStop(0.5, 'rgba(127,163,199,0.04)');
    sheen.addColorStop(1, 'rgba(127,163,199,0)');
    g.fillStyle = sheen;
    g.fillRect(x, y, w, h);
    g.fillStyle = clean ? 'rgba(225,232,240,0.1)' : 'rgba(170,190,210,0.1)';
    g.beginPath();
    g.moveTo(x + 30, y + h);
    g.lineTo(x + 92, y + h);
    g.lineTo(x + 210, y);
    g.lineTo(x + 150, y);
    g.closePath();
    g.fill();
    if (!clean) {
      g.filter = 'blur(12px)';
      g.fillStyle = 'rgba(120,112,98,0.42)';
      const rng = S.createRng(410 + x);
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.ellipse(x + rng.range(20, w - 20), y + rng.range(h * 0.45, h - 10), rng.range(30, 70), rng.range(18, 40), rng.range(-0.4, 0.4), 0, Math.PI * 2);
        g.fill();
      }
      g.filter = 'none';
      if (win.id === 'right') {
        // A cracked lower pane, the kind of thing an empty house collects.
        const p = panes[4];
        g.strokeStyle = 'rgba(215,220,225,0.35)';
        g.lineWidth = 1.2;
        const cx = p.x + p.w * 0.4;
        const cy = p.y + p.h * 0.55;
        for (const [dx, dy] of [[-30, -40], [26, -34], [34, 22], [-18, 38], [-36, 6]]) {
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + dx * 0.5 + 3, cy + dy * 0.5 - 2);
          g.lineTo(cx + dx, cy + dy);
          g.stroke();
        }
      }
    }
    g.restore();

    // Sill, catching the lantern on its top edge.
    paintShape(g, rectPoints(x - 36, y + h + 18, w + 72, 18), {
      color: trim,
      lightDir: { x: light.x * 0.4, y: -1 },
      light: 0.28,
      shadow: 0.4,
      strokes: 8,
      rim: 0.5,
      innerShadow: 0.2,
      wobble: 0.4,
      seed: 404 + x,
    });
    softShadow(g, x + w / 2, y + h + 44, w * 0.62, 10, 0.5);

    // Shutters. The right window's left shutter hangs from one hinge while dirty.
    const sy = y - 4;
    const sh = h + 8;
    paintShutter(g, x - 22 - SHUTTER_W, sy, SHUTTER_W, sh, clean, 420 + x, !clean && win.id === 'right' ? 0.13 : 0, 'left');
    paintShutter(g, x + w + 22, sy, SHUTTER_W, sh, clean, 430 + x, 0, 'right');
  }

  function paintWindowInterior(g, win, clean) {
    const { x, y, w, h } = win;
    g.save();
    g.beginPath();
    g.rect(x + 16, y + 16, w - 32, h - 32);
    g.clip();
    const room = g.createLinearGradient(0, y, 0, y + h);
    room.addColorStop(0, S.mixHex(P.soot, P.plum, 0.35));
    room.addColorStop(1, S.mixHex(P.soot, P.umber, 0.6));
    g.fillStyle = room;
    g.fillRect(x, y, w, h);
    // A lace curtain drawn half across, inside.
    const side = win.id === 'left' ? 1 : -1;
    const cx = side === 1 ? x + 16 : x + w - 16;
    g.fillStyle = S.rgba(P.linen, clean ? 0.1 : 0.07);
    g.beginPath();
    g.moveTo(cx, y + 16);
    g.lineTo(cx + side * 92, y + 16);
    g.quadraticCurveTo(cx + side * 60, y + h * 0.5, cx + side * 76, y + h - 16);
    g.lineTo(cx, y + h - 16);
    g.closePath();
    g.fill();
    g.strokeStyle = S.rgba(P.linen, 0.06);
    g.lineWidth = 3;
    for (let i = 1; i < 5; i++) {
      g.beginPath();
      g.moveTo(cx + side * i * 18, y + 16);
      g.quadraticCurveTo(cx + side * i * 13, y + h * 0.5, cx + side * i * 15, y + h - 16);
      g.stroke();
    }
    // Furniture in the dark room: a table lamp in one, a chair and a frame in the other.
    g.fillStyle = 'rgba(8,6,6,0.55)';
    if (win.id === 'left') {
      const lx = x + w * 0.66;
      g.beginPath();
      g.moveTo(lx - 34, y + h * 0.44);
      g.lineTo(lx + 34, y + h * 0.44);
      g.lineTo(lx + 22, y + h * 0.3);
      g.lineTo(lx - 22, y + h * 0.3);
      g.closePath();
      g.fill();
      g.fillRect(lx - 3, y + h * 0.44, 6, h * 0.3);
      g.fillRect(lx - 60, y + h * 0.74, 120, h * 0.3);
    } else {
      const cxh = x + w * 0.38;
      g.beginPath();
      g.moveTo(cxh - 40, y + h);
      g.lineTo(cxh - 36, y + h * 0.42);
      g.quadraticCurveTo(cxh, y + h * 0.32, cxh + 36, y + h * 0.42);
      g.lineTo(cxh + 40, y + h);
      g.closePath();
      g.fill();
      g.fillRect(x + w * 0.62, y + h * 0.2, 46, 56);
    }
    g.restore();
  }

  // `outer` is the edge the hinges are on ('left' or 'right').
  function paintShutter(g, x, y, w, h, clean, seed, askew, outer) {
    const color = pick(C.shutter, clean);
    const hingeX = outer === 'left' ? x : x + w;
    g.save();
    // An askew shutter has lost its bottom hinge and turns about the top one.
    if (askew) {
      g.translate(hingeX, y + 8);
      g.rotate(outer === 'left' ? askew : -askew);
      g.translate(-hingeX, -(y + 8));
    }
    dropShadow(g, x, y, w, h, 9, 0.5);
    paintShape(g, rectPoints(x, y, w, h), {
      color,
      lightDir: toward(x + w / 2, y + h / 2),
      light: 0.16,
      shadow: 0.4,
      strokes: 14,
      strokeAngle: Math.PI / 2,
      rim: 0.3,
      innerShadow: 0.35,
      wobble: 0.5,
      seed,
    });
    // Louvers: each slat lit on top, shadowed underneath.
    const rng = S.createRng(seed + 1);
    const mid = y + h * 0.48;
    for (let sy = y + 14; sy < y + h - 14; sy += 12) {
      if (Math.abs(sy - mid) < 9) continue;
      const missing = !clean && rng.chance(0.06);
      g.fillStyle = missing ? 'rgba(6,6,9,0.7)' : 'rgba(6,6,9,0.42)';
      g.fillRect(x + 8, sy + 7, w - 16, missing ? 6 : 4);
      g.fillStyle = S.shade(color, 0.22, 0.5);
      g.fillRect(x + 8, sy, w - 16, 2);
    }
    // Stiles and the middle rail.
    g.fillStyle = 'rgba(6,6,9,0.3)';
    g.fillRect(x + 7, y + 10, 2, h - 20);
    g.fillRect(x + w - 9, y + 10, 2, h - 20);
    g.fillRect(x + 8, mid - 6, w - 16, 12);
    g.fillStyle = S.shade(color, 0.18, 0.5);
    g.fillRect(x + 8, mid - 6, w - 16, 2);
    if (!clean) {
      // Paint gone powdery and lifting in places.
      for (let i = 0; i < 5; i++) {
        g.fillStyle = S.rgba(P.linen, rng.range(0.06, 0.14));
        g.beginPath();
        g.ellipse(x + rng.range(10, w - 10), y + rng.range(20, h - 20), rng.range(6, 14), rng.range(4, 10), 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Hinge straps on the outer edge.
    g.fillStyle = S.shadeHex(P.gear, -0.4);
    const strapX = outer === 'left' ? x - 2 : x + w - 14;
    g.fillRect(strapX, y + 18, 16, 6);
    if (!askew) g.fillRect(strapX, y + h - 26, 16, 6);
    g.restore();
    if (askew) {
      // The bottom hinge plate is still on the wall, its pin bent.
      g.fillStyle = S.shadeHex(P.gear, -0.4);
      g.fillRect(hingeX - 6, y + h - 26, 10, 7);
      g.strokeStyle = S.shadeHex(P.gear, -0.2);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(hingeX + 2, y + h - 22);
      g.lineTo(hingeX + 10, y + h - 14);
      g.stroke();
    }
  }

  // ── The doorway: casing, transom, name plate, the dark hall behind ──────

  // The stained glass over the door: a fan of segments round a half sun.
  function transomSegments() {
    const x0 = TRANSOM.x + 8;
    const x1 = TRANSOM.x + TRANSOM.w - 8;
    const y0 = TRANSOM.y + 6;
    const y1 = TRANSOM.y + TRANSOM.h - 4;
    const hub = { x: (x0 + x1) / 2, y: y1 };
    const tones = [P.amber, P.plum, P.moss, P.amber, P.plum, P.moss];
    const edge = [[x0, y1], [x0, y0], [S.lerp(x0, x1, 0.25), y0], [S.lerp(x0, x1, 0.5), y0], [S.lerp(x0, x1, 0.75), y0], [x1, y0], [x1, y1]];
    const segs = [];
    for (let i = 0; i < edge.length - 1; i++) {
      segs.push({ pts: [[hub.x, hub.y], edge[i], edge[i + 1]], tone: tones[i % tones.length] });
    }
    const sun = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      sun.push([hub.x + Math.cos(a) * 22, hub.y + Math.sin(a) * 16]);
    }
    segs.push({ pts: sun, tone: P.amber, sun: true });
    return { segs, hub, x0, x1, y0, y1 };
  }

  function segPath(g, pts) {
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
  }

  function paintDoorway(g, clean) {
    const trim = pick(C.trim, clean);
    const light = toward(DOOR.x + DOOR.w / 2, 400);
    dropShadow(g, DOOR.x - 32, TRANSOM.y - 30, DOOR.w + 64, FLOOR_LINE - TRANSOM.y + 30, 12, 0.5);

    // The hall behind the door: dark, a newel post and a runner just readable.
    const hall = g.createLinearGradient(0, DOOR.y, 0, FLOOR_LINE);
    hall.addColorStop(0, S.mixHex(P.soot, P.umber, 0.5));
    hall.addColorStop(1, S.mixHex(P.soot, P.walnut, 0.4));
    g.fillStyle = hall;
    g.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    g.fillStyle = 'rgba(70,50,36,0.35)';
    g.fillRect(DOOR.x + 120, DOOR.y + 160, 14, DOOR.h - 160);
    g.fillRect(DOOR.x + 30, FLOOR_LINE - 40, 120, 40);

    // Casing: two side boards, the head above the transom, a rail under it.
    const boards = [
      [DOOR.x - 26, TRANSOM.y - 14, 26, FLOOR_LINE - TRANSOM.y + 14],
      [DOOR.x + DOOR.w, TRANSOM.y - 14, 26, FLOOR_LINE - TRANSOM.y + 14],
      [DOOR.x - 34, TRANSOM.y - 34, DOOR.w + 68, 22],
      [DOOR.x, TRANSOM.y + TRANSOM.h, DOOR.w, DOOR.y - TRANSOM.y - TRANSOM.h],
    ];
    boards.forEach(([bx, by, bw, bh], i) => {
      paintShape(g, rectPoints(bx, by, bw, bh), {
        color: trim,
        lightDir: i === 2 ? { x: light.x, y: -1 } : light,
        light: 0.18,
        shadow: 0.42,
        strokes: 10,
        strokeAngle: bw > bh ? 0 : Math.PI / 2,
        rim: 0.4,
        innerShadow: 0.25,
        wobble: 0.4,
        seed: 440 + i,
      });
    });
    g.fillStyle = 'rgba(6,6,9,0.42)';
    g.fillRect(DOOR.x - 30, TRANSOM.y - 12, DOOR.w + 60, 4);

    // Transom: lead came round muted glass. Its light comes from inside, later.
    const tr = transomSegments();
    g.fillStyle = S.mixHex(P.soot, P.umber, 0.4);
    g.fillRect(TRANSOM.x, TRANSOM.y, TRANSOM.w, TRANSOM.h);
    for (const seg of tr.segs) {
      g.fillStyle = S.mixHex(P.soot, seg.tone, clean ? 0.42 : 0.22);
      segPath(g, seg.pts);
      g.fill();
    }
    drawTransomLead(g, tr, clean);
    if (!clean) {
      g.save();
      g.filter = 'blur(6px)';
      g.fillStyle = 'rgba(120,110,96,0.35)';
      g.fillRect(TRANSOM.x + 10, TRANSOM.y + 20, 70, 24);
      g.restore();
    }

    paintNamePlate(g, clean);

    // Threshold, worn in the middle by years of feet.
    paintShape(g, rectPoints(DOOR.x - 14, FLOOR_LINE - 8, DOOR.w + 28, 14), {
      color: S.shadeHex(pick(C.brass, clean), -0.15),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.4,
      strokes: 6,
      rim: 0.45,
      innerShadow: 0.2,
      wobble: 0.3,
      seed: 450,
    });
  }

  function drawTransomLead(g, tr, clean) {
    g.strokeStyle = clean ? 'rgba(38,32,28,0.95)' : 'rgba(24,20,18,0.95)';
    g.lineWidth = 3;
    g.lineJoin = 'round';
    for (const seg of tr.segs) {
      segPath(g, seg.pts);
      g.stroke();
    }
  }

  // The story object: a brass plate engraved ASHWORTH. Dirty, it is
  // tarnished almost black and the name barely shows; clean, it is polished
  // and reads at a glance.
  function paintNamePlate(g, clean) {
    const { x, y, rx, ry } = PLATE;
    const metal = clean ? P.brass : C.brass[0];
    dropShadow(g, x - rx, y - ry, rx * 2, ry * 2, 5, 0.5, 'ellipse');
    g.fillStyle = S.shadeHex(metal, -0.35);
    g.beginPath();
    g.ellipse(x, y, rx + 3, ry + 3, 0, 0, Math.PI * 2);
    g.fill();
    const face = g.createLinearGradient(x - rx, y - ry, x + rx * 0.6, y + ry);
    face.addColorStop(0, S.shadeHex(metal, clean ? 0.38 : 0.05));
    face.addColorStop(0.45, metal);
    face.addColorStop(1, S.shadeHex(metal, clean ? -0.38 : -0.4));
    g.fillStyle = face;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();

    g.save();
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.clip();
    if (clean) {
      // Polish: a bright streak across the top.
      g.fillStyle = 'rgba(255,246,220,0.45)';
      g.beginPath();
      g.ellipse(x - 14, y - 8, rx * 0.7, 3.5, -0.05, 0, Math.PI * 2);
      g.fill();
    } else {
      // Verdigris and grime in blotches.
      const rng = S.createRng(461);
      g.filter = 'blur(2px)';
      for (let i = 0; i < 9; i++) {
        g.fillStyle = S.rgba(S.mixHex(P.moss, P.linen, 0.3), rng.range(0.18, 0.35));
        g.beginPath();
        g.ellipse(x + rng.range(-rx, rx), y + rng.range(-ry, ry), rng.range(6, 16), rng.range(3, 7), 0, 0, Math.PI * 2);
        g.fill();
      }
      g.filter = 'none';
    }
    // The engraving.
    g.font = '700 16px Fraunces, Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = '1.5px';
    if (clean) {
      g.fillStyle = 'rgba(255,240,200,0.45)';
      g.fillText('ASHWORTH', x + 1, y + 2);
      g.fillStyle = 'rgba(46,30,14,0.9)';
      g.fillText('ASHWORTH', x, y + 1);
    } else {
      g.fillStyle = 'rgba(30,22,14,0.22)';
      g.fillText('ASHWORTH', x, y + 1);
    }
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.restore();
    for (const sx of [x - rx + 9, x + rx - 9]) {
      g.fillStyle = S.shadeHex(metal, -0.45);
      g.beginPath();
      g.arc(sx, y, 2.6, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Mailbox, doorbell: the small things that make a facade somebody's house.
  function paintWallDetails(g, clean) {
    const { x, y, w, h } = MAILBOX;
    const metal = clean ? S.shadeHex(P.gear, -0.2) : S.mixHex(S.shadeHex(P.gear, -0.35), P.rust, 0.25);
    dropShadow(g, x, y, w, h, 9, 0.5);
    paintShape(g, roundedRectPoints(x, y, w, h, 6), {
      color: metal,
      lightDir: toward(x + w / 2, y + h / 2),
      light: 0.3,
      shadow: 0.45,
      strokes: 8,
      strokeAngle: Math.PI / 2,
      rim: 0.5,
      innerShadow: 0.3,
      wobble: 0.3,
      seed: 470,
    });
    paintShape(g, rectPoints(x - 4, y - 6, w + 8, 16), {
      color: S.shadeHex(metal, 0.12),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.4,
      strokes: 5,
      rim: 0.5,
      wobble: 0.3,
      seed: 471,
    });
    g.font = '700 26px Fraunces, Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = S.rgba(clean ? P.brass : C.brass[0], clean ? 0.95 : 0.6);
    g.fillText('17', x + w / 2, y + h * 0.56);
    if (!clean) {
      // Letters nobody collected, curled with damp.
      g.save();
      g.translate(x + w / 2 + 4, y - 4);
      g.rotate(-0.18);
      g.fillStyle = S.mixHex(P.linen, P.taupe, 0.3);
      g.fillRect(-18, -14, 34, 16);
      g.rotate(0.3);
      g.fillStyle = S.mixHex(P.linen, P.oak, 0.35);
      g.fillRect(-10, -18, 26, 14);
      g.restore();
    }

    // Doorbell beside the door.
    const bx = DOOR.x - 52;
    const by = 560;
    dropShadow(g, bx - 9, by - 14, 18, 28, 4, 0.45, 'ellipse');
    g.fillStyle = S.shadeHex(pick(C.brass, clean), -0.2);
    g.beginPath();
    g.ellipse(bx, by, 9, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = clean ? P.bone : S.mixHex(P.linen, P.taupe, 0.5);
    g.beginPath();
    g.arc(bx, by, 4, 0, Math.PI * 2);
    g.fill();
  }

  // ── The porch floor ───────────────────────────────────────────────────

  // Boards run toward the viewer in one-point perspective, like the
  // reference room's floor.
  function paintFloor(g, clean) {
    const vp = { x: 960, y: -900 };
    const top = FLOOR_LINE;
    const bottom = 1080;
    paintShape(g, [[0, top], [1920, top], [1920, bottom], [0, bottom]], {
      color: pick(C.floor, clean),
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
      seed: 480,
    });
    const xAt = (xBottom, y) => vp.x + (xBottom - vp.x) * ((y - vp.y) / (bottom - vp.y));
    const rng = S.createRng(481);
    for (let xb = -360; xb < 2300; xb += 112) {
      // Each board weathered on its own: a slightly different tone per board.
      const tone = rng.range(-0.07, 0.07);
      g.fillStyle = tone > 0 ? `rgba(235,226,212,${tone * 0.8})` : `rgba(8,7,8,${-tone * 1.6})`;
      g.beginPath();
      g.moveTo(xAt(xb, top), top);
      g.lineTo(xAt(xb + 112, top), top);
      g.lineTo(xb + 112, bottom);
      g.lineTo(xb, bottom);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(8,7,8,0.62)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(xAt(xb, top), top);
      g.lineTo(xb, bottom);
      g.stroke();
      g.strokeStyle = clean ? 'rgba(240,232,220,0.08)' : 'rgba(220,214,204,0.05)';
      g.beginPath();
      g.moveTo(xAt(xb, top) + 2, top);
      g.lineTo(xb + 3, bottom);
      g.stroke();
      let y = top + rng.range(10, 110);
      while (y < bottom) {
        g.strokeStyle = 'rgba(8,7,8,0.42)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(xAt(xb, y), y);
        g.lineTo(xAt(xb + 112, y), y);
        g.stroke();
        y += rng.range(150, 280) * ((y - vp.y) / (bottom - vp.y));
      }
    }

    // A sheen where the lantern pools on the paint.
    const sheen = g.createRadialGradient(LANTERN.x, 930, 20, LANTERN.x, 930, 620);
    sheen.addColorStop(0, `rgba(255,224,180,${clean ? 0.12 : 0.06})`);
    sheen.addColorStop(1, 'rgba(255,224,180,0)');
    g.fillStyle = sheen;
    g.fillRect(0, top, 1920, bottom - top);

    // The front edge of the porch: a rounded nosing, lit on top.
    g.fillStyle = 'rgba(6,6,8,0.5)';
    g.fillRect(0, PORCH_EDGE + 4, 1920, 12);
    g.strokeStyle = clean ? 'rgba(245,236,220,0.22)' : 'rgba(220,214,204,0.14)';
    g.lineWidth = 3;
    g.beginPath();
    handLine(g, 0, PORCH_EDGE, 1920, PORCH_EDGE, 482, 0.6, 40);
    g.stroke();

    // Contact shadow where the floor meets the house, and a skirting board.
    const shadow = g.createLinearGradient(0, top, 0, top + 70);
    shadow.addColorStop(0, 'rgba(0,0,0,0.55)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = shadow;
    g.fillRect(FACADE.x0 - 10, top, FACADE.x1 - FACADE.x0 + 20, 70);
    g.fillStyle = S.shadeHex(pick(C.trim, clean), -0.35);
    g.fillRect(FACADE.x0, FLOOR_LINE - 22, FACADE.x1 - FACADE.x0, 22);
    g.fillStyle = 'rgba(245,236,220,0.1)';
    g.fillRect(FACADE.x0, FLOOR_LINE - 22, FACADE.x1 - FACADE.x0, 2);
  }

  // The welcome mat, squashed into the floor's perspective. Its letters are
  // half buried in dust and leaves until the makeover.
  function paintMat(g, clean) {
    const { cx, top, bottom, wTop, wBottom } = MAT;
    const quad = [
      [cx - wTop / 2, top],
      [cx + wTop / 2, top],
      [cx + wBottom / 2, bottom],
      [cx - wBottom / 2, bottom],
    ];
    softShadow(g, cx, bottom - 6, wBottom * 0.55, 16, 0.4);
    paintShape(g, quad, {
      color: clean ? S.mixHex(P.oak, P.rust, 0.35) : S.mixHex(P.oak, P.taupe, 0.45),
      lightDir: { x: 0, y: -1 },
      light: 0.12,
      shadow: 0.3,
      strokes: 40,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.25,
      strokeSize: 0.45,
      rim: 0.2,
      innerShadow: 0.45,
      wobble: 1,
      seed: 490,
    });
    g.strokeStyle = 'rgba(20,14,10,0.45)';
    g.lineWidth = 3;
    wobblyPath(g, [[cx - wTop / 2 + 12, top + 6], [cx + wTop / 2 - 12, top + 6], [cx + wBottom / 2 - 14, bottom - 7], [cx - wBottom / 2 + 14, bottom - 7]], { wobble: 0.8, seed: 491 });
    g.stroke();
    g.save();
    g.translate(cx, (top + bottom) / 2 + 2);
    g.scale(1, 0.5);
    g.font = '900 46px Fraunces, Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = '5px';
    g.fillStyle = clean ? 'rgba(28,18,12,0.78)' : 'rgba(28,18,12,0.38)';
    g.fillText('WELCOME', 0, 0);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.restore();
    if (!clean) {
      // Dust drifted over the right half, and a few leaves on top.
      g.save();
      g.filter = 'blur(7px)';
      g.fillStyle = 'rgba(150,140,124,0.55)';
      g.beginPath();
      g.ellipse(cx + 54, (top + bottom) / 2, 78, 22, 0.05, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(150,140,124,0.3)';
      g.beginPath();
      g.ellipse(cx - 70, top + 14, 50, 12, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      const rng = S.createRng(492);
      for (let i = 0; i < 7; i++) leaf(g, cx + rng.range(-40, 120), rng.range(top + 8, bottom - 8), rng.range(9, 14), rng.range(0, 6.2), rng.pick(LEAF_TONES), 493 + i);
    }
  }

  const LEAF_TONES = [S.mixHex(P.rust, P.taupe, 0.3), S.mixHex(P.oak, P.linen, 0.2), S.mixHex(P.rust, P.oak, 0.5), S.mixHex(P.walnut, P.rust, 0.4)];

  // A dead leaf lying flat: two curves and a midrib, squashed by perspective.
  function leaf(g, x, y, size, angle, color, seed) {
    const rng = S.createRng(seed);
    g.save();
    g.translate(x, y);
    g.scale(1, 0.55);
    g.rotate(angle);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(2, 3, size, size * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(-size, 0);
    g.quadraticCurveTo(-size * 0.2, -size * rng.range(0.5, 0.8), size, 0);
    g.quadraticCurveTo(-size * 0.2, size * rng.range(0.5, 0.8), -size, 0);
    g.fill();
    g.strokeStyle = 'rgba(20,14,10,0.4)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-size * 1.2, 0);
    g.lineTo(size * 0.9, 0);
    g.stroke();
    g.restore();
  }

  // Paint lifting off the clapboard: bare grey wood, a dark edge where the
  // paint has come away, and a lighter rim of paint still clinging on.
  function peelPatch(g, x, y, rx, ry, seed) {
    const noise = S.createNoise(seed);
    const pts = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 0.7 + S.fbm(noise, i * 0.45, 3) * 0.8;
      pts.push([x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r]);
    }
    g.save();
    g.fillStyle = S.rgba(S.mixHex(P.linen, P.taupe, 0.62), 0.3);
    wobblyPath(g, pts, { wobble: 2, seed });
    g.fill();
    g.clip();
    // Grain in the bare wood, and the board seams running on through it.
    const rng = S.createRng(seed + 3);
    for (let i = 0; i < 10; i++) {
      g.strokeStyle = `rgba(40,34,28,${rng.range(0.12, 0.25)})`;
      g.lineWidth = 1;
      const gy = y + rng.range(-ry, ry);
      g.beginPath();
      g.moveTo(x - rx * 1.6, gy);
      g.lineTo(x + rx * 1.6, gy + rng.range(-1, 1));
      g.stroke();
    }
    for (let sy = CEILING + 34; sy < FLOOR_LINE; sy += 34) {
      if (sy < y - ry * 1.6 || sy > y + ry * 1.6) continue;
      g.fillStyle = 'rgba(6,7,10,0.5)';
      g.fillRect(x - rx * 1.6, sy, rx * 3.2, 4);
    }
    g.restore();
    g.strokeStyle = 'rgba(12,12,14,0.32)';
    g.lineWidth = 1.4;
    wobblyPath(g, pts, { wobble: 2, seed });
    g.stroke();
    g.save();
    g.translate(-1.5, -1.5);
    g.strokeStyle = 'rgba(228,224,214,0.1)';
    g.lineWidth = 1.2;
    wobblyPath(g, pts, { wobble: 2, seed });
    g.stroke();
    g.restore();
    for (let i = 0; i < 2; i++) {
      const [px, py] = pts[rng.int(0, pts.length - 1)];
      g.fillStyle = S.rgba(P.linen, 0.35);
      g.beginPath();
      g.ellipse(px, py, rng.range(3, 6), rng.range(2, 3.5), rng.range(0, 3), 0, Math.PI * 2);
      g.fill();
    }
  }

  // Everything that says nobody has lived here for fifteen years.
  function paintBackGrime(g) {
    const rng = S.createRng(500);
    // Peeling patches, thickest low on the wall and round the windows.
    const patches = [
      [262, 650, 46, 26], [300, 420, 28, 18], [700, 690, 60, 30], [740, 470, 26, 16], [1186, 690, 52, 26],
      [1230, 380, 30, 20], [1600, 640, 56, 30], [1640, 300, 34, 22], [560, 640, 30, 18], [1490, 700, 40, 20],
      [820, 200, 32, 16], [1100, 260, 26, 14], [1610, 480, 24, 14], [360, 720, 34, 18],
    ];
    patches.forEach(([x, y, rx, ry], i) => peelPatch(g, x, y, rx * 0.8, ry * 0.75, 510 + i));

    // Water stains spreading down from the ceiling, and on the beadboard.
    stain(g, 460, 150, 70, '#2E2A24', 520, 0.3);
    stain(g, 1420, 140, 60, '#2E2A24', 521, 0.25);
    stain(g, 700, 60, 50, '#2A2620', 522, 0.3);
    stain(g, 1600, 70, 44, '#2A2620', 523, 0.28);
    // Grime streaks running down from the window sills.
    g.strokeStyle = 'rgba(30,28,24,0.18)';
    g.lineCap = 'round';
    for (const win of WINDOWS) {
      for (let i = 0; i < 5; i++) {
        const sx = win.x + rng.range(10, win.w - 10);
        g.lineWidth = rng.range(4, 9);
        g.beginPath();
        g.moveTo(sx, win.y + win.h + 40);
        g.quadraticCurveTo(sx + rng.range(-4, 4), win.y + win.h + 90, sx + rng.range(-3, 3), win.y + win.h + rng.range(110, 190));
        g.stroke();
      }
    }
    g.save();
    g.filter = 'blur(16px)';
    // Mildew creeping up from the floor line.
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(40,46,34,${rng.range(0.08, 0.18)})`;
      g.beginPath();
      g.ellipse(rng.range(FACADE.x0, FACADE.x1), FLOOR_LINE - rng.range(10, 60), rng.range(40, 110), rng.range(14, 34), 0, 0, Math.PI * 2);
      g.fill();
    }
    // A dusty grey film, patchy.
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(150,146,138,${rng.range(0.03, 0.07)})`;
      g.beginPath();
      g.ellipse(rng.range(FACADE.x0, FACADE.x1), rng.range(0, FLOOR_LINE), rng.range(60, 200), rng.range(40, 110), 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    const film = g.createLinearGradient(0, 0, 0, FLOOR_LINE);
    film.addColorStop(0, 'rgba(140,136,128,0.12)');
    film.addColorStop(1, 'rgba(140,136,128,0.03)');
    g.fillStyle = film;
    g.fillRect(FACADE.x0 - 14, 0, FACADE.x1 - FACADE.x0 + 28, FLOOR_LINE);

    // Dead leaves blown onto the boards, piled against the house and the posts.
    for (let i = 0; i < 70; i++) {
      const nearWall = rng.chance(0.55);
      const x = nearWall ? rng.range(FACADE.x0, FACADE.x1) : rng.pick([rng.range(180, 420), rng.range(1500, 1880), rng.range(0, 1920)]);
      const y = nearWall ? rng.range(FLOOR_LINE + 4, FLOOR_LINE + 50) : rng.range(FLOOR_LINE + 40, PORCH_EDGE - 6);
      leaf(g, x, y, rng.range(8, 15), rng.range(0, 6.2), rng.pick(LEAF_TONES), 530 + i);
    }
    // Dust over the floor.
    g.save();
    g.filter = 'blur(22px)';
    for (let i = 0; i < 34; i++) {
      g.fillStyle = `rgba(150,142,130,${rng.range(0.04, 0.09)})`;
      g.beginPath();
      g.ellipse(rng.range(0, 1920), rng.range(FLOOR_LINE, PORCH_EDGE), rng.range(80, 220), rng.range(18, 44), 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // The clean facade gets only a little warmth: fresh paint, swept boards.
  function paintBackFresh(g) {
    const warm = g.createLinearGradient(0, CEILING, 0, FLOOR_LINE);
    warm.addColorStop(0, 'rgba(255,214,160,0.04)');
    warm.addColorStop(1, 'rgba(255,214,160,0)');
    g.fillStyle = warm;
    g.fillRect(FACADE.x0, CEILING, FACADE.x1 - FACADE.x0, FLOOR_LINE - CEILING);
  }

  // ── Furniture layer ───────────────────────────────────────────────────

  function paintFurniture(g, clean) {
    paintFern(g, clean);
    paintPlanter(g, clean);
    paintRailing(g, clean);
    paintTrace(g, clean);
    for (const col of COLUMNS) paintColumn(g, col, clean);
  }

  // Turned porch posts. The profile is a list of [y, half-width] pairs, the
  // way a woodturner would draw it; the outline goes down one side and back
  // up the other.
  const POST_PROFILE = [
    [100, 33], [128, 33], [128, 25], [212, 25], [216, 20], [224, 20], [228, 14], [262, 19], [298, 21], [336, 16],
    [380, 13], [560, 15], [690, 18], [718, 20], [726, 14], [734, 20], [744, 20], [748, 25], [938, 25], [942, 31], [994, 31],
  ];

  function paintColumn(g, col, clean) {
    const cx = col.x + col.w / 2;
    const left = POST_PROFILE.map(([y, hw]) => [cx - hw, y]);
    const right = POST_PROFILE.map(([y, hw]) => [cx + hw, y]).reverse();
    const outline = [...left, ...right];
    const lampSide = col.side === -1 ? 1 : -1; // which way the lantern is
    softShadow(g, cx + lampSide * -20, 996, 60, 12, 0.6);
    // A soft shadow on the siding behind, thrown away from the lantern.
    g.save();
    g.filter = 'blur(14px)';
    g.fillStyle = 'rgba(6,6,9,0.45)';
    g.fillRect(cx - 22 - lampSide * 40, CEILING, 44, FLOOR_LINE - CEILING);
    g.restore();

    paintShape(g, outline, {
      color: pick(C.trim, clean),
      lightDir: { x: lampSide, y: -0.25 },
      light: 0.22,
      shadow: 0.55,
      strokes: 12,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.04,
      rim: 0.6,
      rimColor: clean ? '#FFE2B8' : P.amber,
      innerShadow: 0.3,
      wobble: 0.5,
      seed: 600 + col.x,
    });
    // The far edge picks up the cold moon (left post) or the street lamp (right).
    g.save();
    g.strokeStyle = col.side === -1 ? S.rgba(P.moon, clean ? 0.15 : 0.32) : S.rgba(P.amber, 0.12);
    g.lineWidth = 2.5;
    g.beginPath();
    const far = col.side === -1 ? left : right.slice().reverse();
    far.forEach(([x, y], i) => (i ? g.lineTo(x + -lampSide * -1.5, y) : g.moveTo(x, y)));
    g.stroke();
    g.restore();

    // Turned rings: every change of profile is a lit lip over a shadow.
    for (let i = 1; i < POST_PROFILE.length - 1; i++) {
      const [y, hw] = POST_PROFILE[i];
      const [, prev] = POST_PROFILE[i - 1];
      if (Math.abs(hw - prev) < 3) continue;
      g.fillStyle = 'rgba(6,6,9,0.4)';
      g.fillRect(cx - hw, y, hw * 2, 3);
      g.fillStyle = clean ? 'rgba(255,236,206,0.22)' : 'rgba(242,190,120,0.14)';
      g.fillRect(cx - hw, y - 2, hw * 2, 2);
    }
    if (!clean) {
      // Paint flaking off the post.
      const rng = S.createRng(610 + col.x);
      for (let i = 0; i < 9; i++) {
        const y = rng.range(240, 930);
        const hw = 12;
        g.fillStyle = S.rgba(S.mixHex(P.taupe, P.walnut, 0.4), rng.range(0.3, 0.5));
        g.beginPath();
        g.ellipse(cx + rng.range(-hw, hw), y, rng.range(3, 8), rng.range(6, 16), 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // A wooden planter box with geraniums: dead stalks, or muted coral blooms.
  function paintPlanter(g, clean) {
    const { x, w, top, floor } = PLANTER;
    softShadow(g, x + w / 2, floor + 2, w * 0.62, 14, 0.6);
    const wood = clean ? S.mixHex(P.oak, P.linen, 0.12) : S.mixHex(P.taupe, P.linen, 0.12);
    paintShape(g, rectPoints(x, top + 6, w, floor - top - 6), {
      color: wood,
      lightDir: toward(x + w / 2, top + 50),
      light: 0.22,
      shadow: 0.45,
      strokes: 14,
      strokeAngle: 0,
      strokeJitter: 0.05,
      rim: 0.55,
      rimColor: clean ? '#FFE2B8' : P.amber,
      innerShadow: 0.35,
      wobble: 0.5,
      seed: 620,
    });
    for (let py = top + 36; py < floor - 4; py += 30) {
      g.fillStyle = 'rgba(6,6,9,0.45)';
      g.fillRect(x + 4, py, w - 8, 2.5);
      g.fillStyle = 'rgba(245,236,220,0.08)';
      g.fillRect(x + 4, py + 3, w - 8, 1.5);
    }
    for (const px of [x, x + w - 14]) {
      g.fillStyle = S.shadeHex(wood, -0.25);
      g.fillRect(px, top + 4, 14, floor - top - 4);
    }
    // Cap board: the platform the hero stands on.
    paintShape(g, rectPoints(x - 8, top, w + 16, 12), {
      color: S.shadeHex(wood, 0.12),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.3,
      strokes: 8,
      rim: 0.5,
      innerShadow: 0.15,
      wobble: 0.3,
      seed: 621,
    });

    const rng = S.createRng(clean ? 622 : 623);
    if (clean) {
      // Round scalloped leaves, then the bloom clusters above them.
      for (let i = 0; i < 16; i++) {
        const lx = x + 14 + rng.range(0, w - 28);
        const ly = top - rng.range(4, 34);
        g.fillStyle = rng.chance(0.5) ? C.leaf[1] : S.shadeHex(C.leaf[1], -0.18);
        g.beginPath();
        g.ellipse(lx, ly, rng.range(12, 18), rng.range(9, 13), rng.range(-0.4, 0.4), 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(20,26,14,0.35)';
        g.lineWidth = 1;
        g.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const bx = x + 22 + i * ((w - 44) / 5) + rng.range(-6, 6);
        const by = top - rng.range(50, 76);
        g.strokeStyle = S.shadeHex(C.leaf[1], -0.2);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(bx + rng.range(-8, 8), top - 10);
        g.quadraticCurveTo(bx, by + 24, bx, by);
        g.stroke();
        for (let k = 0; k < 9; k++) {
          const a = rng.range(0, Math.PI * 2);
          const r = rng.range(0, 11);
          g.fillStyle = rng.chance(0.4) ? S.shadeHex(C.coral, 0.12) : C.coral;
          g.beginPath();
          g.arc(bx + Math.cos(a) * r, by + Math.sin(a) * r * 0.8, rng.range(3.5, 5.5), 0, Math.PI * 2);
          g.fill();
        }
      }
    } else {
      // Dead stalks bent over, crumpled leaves, a few dry heads.
      g.lineCap = 'round';
      for (let i = 0; i < 11; i++) {
        const sx = x + 14 + rng.range(0, w - 28);
        const bend = rng.range(-40, 40);
        const len = rng.range(30, 70);
        g.strokeStyle = S.mixHex(P.oak, P.linen, rng.range(0.05, 0.35));
        g.lineWidth = rng.range(1.5, 3);
        g.beginPath();
        g.moveTo(sx, top - 2);
        g.quadraticCurveTo(sx + bend * 0.2, top - len, sx + bend, top - len * 0.55);
        g.stroke();
        if (rng.chance(0.5)) {
          g.fillStyle = S.mixHex(P.rust, P.linen, 0.25);
          g.beginPath();
          g.arc(sx + bend, top - len * 0.55 + 2, 4.5, 0, Math.PI * 2);
          g.fill();
        }
      }
      for (let i = 0; i < 9; i++) leaf(g, x + rng.range(10, w - 10), top - rng.range(0, 6), rng.range(7, 11), rng.range(0, 6.2), rng.pick(LEAF_TONES), 624 + i);
    }
  }

  // The side railing: a newel post, a cap rail the hero can stand on, balusters.
  function paintRailing(g, clean) {
    const { x0, x1, top, floor } = RAILING;
    const trim = pick(C.trim, clean);
    softShadow(g, (x0 + x1) / 2, floor + 4, (x1 - x0) * 0.55, 12, 0.5);
    const rng = S.createRng(640);
    for (let bx = x0 + 30; bx < x1; bx += 26) {
      const broken = !clean && Math.abs(bx - (x0 + 134)) < 13;
      if (broken) {
        // One baluster has come loose and hangs from the bottom rail.
        g.save();
        g.translate(bx + 4, floor - 18);
        g.rotate(0.5);
        g.fillStyle = S.shadeHex(trim, -0.3);
        g.fillRect(-4, -110, 8, 110);
        g.restore();
        continue;
      }
      const bw = 8;
      g.fillStyle = S.shadeHex(trim, -0.18 + rng.range(-0.04, 0.04));
      g.fillRect(bx, top + 14, bw, floor - top - 30);
      g.fillStyle = 'rgba(6,6,9,0.35)';
      g.fillRect(bx + bw - 2, top + 14, 2, floor - top - 30);
      g.fillStyle = 'rgba(245,236,220,0.14)';
      g.fillRect(bx, top + 14, 2, floor - top - 30);
    }
    // Bottom rail and cap rail.
    paintShape(g, rectPoints(x0, floor - 28, x1 - x0, 12), {
      color: S.shadeHex(trim, -0.15),
      lightDir: { x: 0, y: -1 },
      light: 0.2,
      shadow: 0.4,
      strokes: 8,
      rim: 0.3,
      innerShadow: 0.2,
      wobble: 0.4,
      seed: 641,
    });
    paintShape(g, rectPoints(x0 - 6, top, x1 - x0 + 12, 18), {
      color: trim,
      lightDir: { x: -0.5, y: -1 },
      light: 0.25,
      shadow: 0.4,
      strokes: 10,
      strokeAngle: 0,
      rim: 0.5,
      rimColor: clean ? '#FFE2B8' : P.amber,
      innerShadow: 0.2,
      wobble: 0.4,
      seed: 642,
    });
    // Newel post at the inner end.
    paintShape(g, rectPoints(x0 - 14, top - 22, 30, floor - top + 26), {
      color: trim,
      lightDir: { x: -1, y: -0.3 },
      light: 0.22,
      shadow: 0.5,
      strokes: 12,
      strokeAngle: Math.PI / 2,
      rim: 0.55,
      rimColor: clean ? '#FFE2B8' : P.amber,
      innerShadow: 0.3,
      wobble: 0.4,
      seed: 643,
    });
    g.fillStyle = S.shadeHex(trim, 0.06);
    g.beginPath();
    g.ellipse(x0 + 1, top - 26, 20, 9, 0, 0, Math.PI * 2);
    g.fill();
    softShadow(g, x0 + 1, floor + 2, 30, 8, 0.6);
  }

  // A hanging fern basket between the left window and the door.
  function paintFern(g, clean) {
    const { x, basketY } = FERN;
    // Three wires up to the ceiling hook.
    g.strokeStyle = 'rgba(30,28,26,0.85)';
    g.lineWidth = 1.5;
    for (const dx of [-38, 0, 38]) {
      g.beginPath();
      g.moveTo(x, CEILING + 2);
      g.lineTo(x + dx, basketY + 4);
      g.stroke();
    }
    g.fillStyle = S.shadeHex(P.gear, -0.3);
    g.beginPath();
    g.arc(x, CEILING + 4, 5, 0, Math.PI * 2);
    g.fill();

    // The drop shadow of the whole thing on the siding.
    g.save();
    g.filter = 'blur(12px)';
    g.fillStyle = 'rgba(6,6,9,0.4)';
    g.beginPath();
    g.ellipse(x - 26, basketY + 70, 80, 90, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    const rng = S.createRng(clean ? 650 : 651);
    const fronds = clean ? 24 : 13;
    for (let i = 0; i < fronds; i++) {
      const side = i % 2 ? 1 : -1;
      const a = side * rng.range(0.15, 1.3);
      const len = clean ? rng.range(90, 160) : rng.range(70, 140);
      const sx = x + rng.range(-30, 30);
      const sy = basketY + 6;
      // Alive, fronds arch out and fall; dead, they hang straight down, broken.
      const ex = sx + Math.sin(a) * len * (clean ? 0.62 : 0.35);
      const ey = sy + Math.cos(a) * len * (clean ? 0.7 : 1) + (clean ? 20 : 0);
      const cx = sx + Math.sin(a) * len * (clean ? 0.55 : 0.25);
      const cy = sy - (clean ? 34 : 4);
      g.strokeStyle = clean ? S.shadeHex(C.leaf[1], -0.15) : S.mixHex(P.walnut, P.oak, 0.5);
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(cx, cy, ex, ey);
      g.stroke();
      for (let t = 0.2; t < 0.98; t += clean ? 0.07 : 0.11) {
        const px = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
        const py = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;
        if (!clean && rng.chance(0.35)) continue; // dead fronds have lost most leaflets
        const size = (clean ? 12 : 8) * (1.1 - t * 0.6);
        g.fillStyle = clean ? (rng.chance(0.5) ? C.leaf[1] : S.shadeHex(C.leaf[1], 0.08)) : rng.pick(LEAF_TONES);
        for (const s of [-1, 1]) {
          g.beginPath();
          g.ellipse(px + s * size * 0.6, py + 2, size, size * 0.32, s * 0.9 + a * 0.3, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // The basket itself: coir in a wire frame.
    paintShape(g, [[x - 44, basketY], [x + 44, basketY], [x + 36, basketY + 30], [x + 14, basketY + 46], [x - 14, basketY + 46], [x - 36, basketY + 30]], {
      color: clean ? S.mixHex(P.oak, P.rust, 0.3) : S.mixHex(P.walnut, P.taupe, 0.3),
      lightDir: toward(x, basketY),
      light: 0.25,
      shadow: 0.45,
      strokes: 30,
      strokeAngle: 0.4,
      strokeJitter: 0.8,
      strokeSize: 0.5,
      rim: 0.4,
      innerShadow: 0.3,
      wobble: 1.2,
      seed: 652,
    });
    g.strokeStyle = 'rgba(30,28,26,0.8)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 46, basketY);
    g.lineTo(x + 46, basketY);
    g.moveTo(x - 38, basketY + 24);
    g.quadraticCurveTo(x, basketY + 34, x + 38, basketY + 24);
    g.stroke();
  }

  // The previous cleaner's things: yellow rubber gloves and an old pump
  // sprayer. Left dusty by the door; afterwards, put away neatly.
  function paintTrace(g, clean) {
    const tank = clean ? { x: 1250, y: 796 } : { x: 1112, y: 800 };
    const metal = clean ? S.mixHex(P.taupe, P.moon, 0.25) : S.mixHex(P.taupe, P.linen, 0.15);
    softShadow(g, tank.x + 6, tank.y + 2, 46, 9, 0.6);
    if (!clean) {
      // The wand and hose lying on the boards, pointing at the door.
      g.strokeStyle = S.shadeHex(P.gear, -0.35);
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(tank.x + 14, tank.y - 10);
      g.bezierCurveTo(tank.x + 40, tank.y + 6, tank.x + 20, tank.y + 26, tank.x + 64, tank.y + 22);
      g.stroke();
      g.strokeStyle = S.shadeHex(P.brass, -0.3);
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(tank.x + 64, tank.y + 22);
      g.lineTo(tank.x + 128, tank.y + 16);
      g.stroke();
    }
    // The tank: a dented cylinder with a pump handle.
    paintShape(g, roundedRectPoints(tank.x - 20, tank.y - 70, 40, 70, 10), {
      color: metal,
      lightDir: toward(tank.x, tank.y - 40),
      light: 0.35,
      shadow: 0.5,
      strokes: 10,
      strokeAngle: Math.PI / 2,
      rim: 0.5,
      innerShadow: 0.3,
      wobble: 0.6,
      seed: 660,
    });
    g.fillStyle = S.shadeHex(metal, -0.35);
    g.fillRect(tank.x - 20, tank.y - 52, 40, 4);
    g.fillRect(tank.x - 20, tank.y - 20, 40, 4);
    g.fillStyle = S.shadeHex(P.gear, -0.2);
    g.fillRect(tank.x - 3, tank.y - 96, 6, 26);
    g.fillRect(tank.x - 16, tank.y - 100, 32, 6);
    if (clean) {
      // The wand clipped to the side of the tank.
      g.strokeStyle = S.shadeHex(P.brass, -0.1);
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(tank.x + 24, tank.y - 4);
      g.lineTo(tank.x + 24, tank.y - 82);
      g.stroke();
    }

    const glove = pick(C.gloves, clean);
    if (clean) {
      // Folded on top of the tank, side by side.
      drawGlove(g, tank.x - 8, tank.y - 104, 0.08, glove, 1, 0.9);
      drawGlove(g, tank.x + 8, tank.y - 100, -0.12, S.shadeHex(glove, -0.08), -1, 0.9);
    } else {
      // One draped over the tank, one dropped on the boards.
      drawGlove(g, tank.x + 4, tank.y - 64, 1.2, glove, 1, 1);
      drawGlove(g, tank.x - 44, tank.y + 8, -1.4, S.shadeHex(glove, -0.1), -1, 1);
      // A grey skin of dust on everything.
      g.save();
      g.filter = 'blur(4px)';
      g.fillStyle = 'rgba(160,152,138,0.35)';
      g.fillRect(tank.x - 22, tank.y - 100, 44, 30);
      g.beginPath();
      g.ellipse(tank.x - 44, tank.y + 6, 26, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  // A rubber glove: cuff, palm and four fingers, with a thumb.
  function drawGlove(g, x, y, angle, color, flip, scale) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.scale(flip * scale, scale);
    const body = g.createLinearGradient(-14, -30, 14, 20);
    body.addColorStop(0, S.shadeHex(color, 0.2));
    body.addColorStop(1, S.shadeHex(color, -0.3));
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(-10, 22);
    g.lineTo(-12, 0);
    g.quadraticCurveTo(-22, -6, -18, -14); // thumb
    g.quadraticCurveTo(-12, -12, -10, -8);
    for (let f = 0; f < 4; f++) {
      const fx = -9 + f * 6;
      g.lineTo(fx, -22 - (f === 1 || f === 2 ? 6 : 2));
      g.quadraticCurveTo(fx + 3, -28 - (f === 1 || f === 2 ? 6 : 2), fx + 5, -22 - (f === 1 || f === 2 ? 6 : 2));
    }
    g.lineTo(13, -6);
    g.lineTo(11, 22);
    g.closePath();
    g.fill();
    g.fillStyle = S.shadeHex(color, -0.2);
    g.fillRect(-11, 14, 22, 8); // rolled cuff
    g.strokeStyle = 'rgba(30,20,10,0.35)';
    g.lineWidth = 1;
    g.stroke();
    g.restore();
  }

  // ── Front layer: the steps and bushes nearest the camera ─────────────────

  function paintFront(g, clean) {
    // The top edges of two steps, darker than the porch, slightly soft.
    g.save();
    g.filter = 'blur(2px)';
    const stepTone = S.shadeHex(pick(C.floor, clean), -0.12);
    const treads = [
      [PORCH_EDGE + 16, 16, 24],
      [PORCH_EDGE + 56, 12, 40],
    ];
    treads.forEach(([y, tread, riser], i) => {
      paintShape(g, rectPoints(-80, y, 2080, tread), {
        color: S.shadeHex(stepTone, 0.12 - i * 0.08),
        lightDir: { x: 0, y: -1 },
        light: 0.2,
        shadow: 0.3,
        strokes: 12,
        strokeAngle: 0,
        rim: 0.55,
        rimColor: clean ? '#FFE2B8' : P.moon,
        innerShadow: 0.1,
        wobble: 0.6,
        seed: 700 + i,
      });
      paintShape(g, rectPoints(-80, y + tread, 2080, riser), {
        color: S.shadeHex(stepTone, -0.35 - i * 0.1),
        lightDir: { x: 0, y: -1 },
        light: 0.05,
        shadow: 0.3,
        strokes: 8,
        strokeAngle: 0,
        rim: 0,
        innerShadow: 0.2,
        wobble: 0.6,
        seed: 702 + i,
      });
    });
    for (const [y] of treads) {
      g.strokeStyle = clean ? 'rgba(255,226,184,0.3)' : 'rgba(150,180,210,0.22)';
      g.lineWidth = 3;
      g.beginPath();
      handLine(g, -80, y + 1, 2000, y + 1, 705 + y, 0.6, 40);
      g.stroke();
    }
    g.restore();

    g.save();
    g.filter = 'blur(7px)';
    // Bottom-left: an overgrown bush close to the camera. Brambles while dirty.
    const rng = S.createRng(clean ? 710 : 711);
    if (clean) {
      g.fillStyle = S.shadeHex(P.moss, -0.45);
      g.beginPath();
      g.ellipse(80, 1060, 230, 130, -0.1, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 60; i++) {
        g.fillStyle = rng.chance(0.5) ? S.shadeHex(P.moss, -0.2) : S.shadeHex(P.moss, -0.35);
        g.beginPath();
        g.ellipse(rng.range(-80, 290), rng.range(930, 1090), rng.range(14, 26), rng.range(8, 14), rng.range(0, 3), 0, Math.PI * 2);
        g.fill();
      }
      for (let i = 0; i < 4; i++) {
        g.fillStyle = S.shadeHex(C.coral, -0.2);
        g.beginPath();
        g.arc(rng.range(40, 240), rng.range(950, 1000), 12, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.strokeStyle = S.mixHex(P.soot, P.walnut, 0.5);
      g.lineCap = 'round';
      for (let i = 0; i < 18; i++) {
        const sx = rng.range(-60, 200);
        g.lineWidth = rng.range(4, 9);
        g.beginPath();
        g.moveTo(sx, 1100);
        g.quadraticCurveTo(sx + rng.range(-40, 80), rng.range(900, 980), sx + rng.range(40, 220), rng.range(880, 1000));
        g.stroke();
      }
      g.fillStyle = S.mixHex(P.soot, P.walnut, 0.6);
      g.beginPath();
      g.ellipse(60, 1080, 200, 80, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Bottom-right: the newel post of the steps and a dark shrub beside it.
    g.fillStyle = clean ? S.shadeHex(pick(C.trim, true), -0.55) : S.mixHex(P.soot, P.taupe, 0.4);
    g.fillRect(1730, 940, 70, 160);
    g.fillRect(1716, 926, 98, 26);
    g.strokeStyle = clean ? 'rgba(255,214,160,0.25)' : 'rgba(127,163,199,0.18)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(1734, 948);
    g.lineTo(1734, 1100);
    g.stroke();
    g.fillStyle = clean ? S.shadeHex(P.moss, -0.5) : S.mixHex(P.soot, P.umber, 0.6);
    g.beginPath();
    g.ellipse(1900, 1050, 170, 120, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    if (!clean) {
      // Thick out-of-focus cobweb strands across the top corners.
      g.save();
      g.filter = 'blur(3px)';
      g.strokeStyle = 'rgba(220,215,200,0.2)';
      g.lineWidth = 3;
      for (const [x1, y1, x2, y2, sag] of [
        [-10, 150, 250, -10, 60],
        [-10, 270, 170, -10, 40],
        [1670, -10, 1930, 230, 70],
        [1770, -10, 1930, 130, 30],
      ]) {
        g.beginPath();
        g.moveTo(x1, y1);
        g.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + sag, x2, y2);
        g.stroke();
      }
      g.restore();
    }
  }

  // ── Webs ──────────────────────────────────────────────────────────────

  function cornerAnchors(cornerX, cornerY, alongCeiling, alongWall, count, flip) {
    // Spokes fan from the ceiling edge round to the post.
    const anchors = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      if (t < 0.5) {
        const k = 1 - t * 2;
        anchors.push([cornerX + flip * alongCeiling * k, cornerY]);
      } else {
        const k = (t - 0.5) * 2;
        anchors.push([cornerX, cornerY + alongWall * k]);
      }
    }
    return anchors;
  }

  function orbAnchors(cx, cy, rx, ry, count, turn) {
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + turn;
      return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
    });
  }

  function makeWebs() {
    const [rw] = WINDOWS.slice(1);
    return [
      // Top-left corner fan, between the left post and the ceiling.
      new S.Web({ hub: [262, 200], anchors: cornerAnchors(196, CEILING + 14, 250, 270, 8, 1), rings: 7, sheet: 0.65, seed: 801 }),
      // Orb web strung between the left post and the facade.
      new S.Web({ hub: [278, 362], anchors: orbAnchors(278, 362, 84, 92, 10, 0.3), rings: 8, closed: true, sheet: 0.15, seed: 802 }),
      // Top-right corner fan.
      new S.Web({ hub: [1658, 204], anchors: cornerAnchors(1724, CEILING + 14, 230, 250, 8, -1), rings: 7, sheet: 0.6, seed: 803 }),
      // A big web across the upper half of the right window.
      new S.Web({
        hub: [rw.x + rw.w * 0.6, rw.y + 74],
        anchors: [
          [rw.x - 18, rw.y - 18], [rw.x + 90, rw.y - 20], [rw.x + 200, rw.y - 20], [rw.x + rw.w + 18, rw.y - 14],
          [rw.x + rw.w + 20, rw.y + 80], [rw.x + rw.w + 16, rw.y + 150], [rw.x + 150, rw.y + 148], [rw.x - 10, rw.y + 120],
        ],
        rings: 8,
        closed: true,
        sheet: 0.32,
        seed: 804,
      }),
      // From the lantern chain up to the ceiling.
      new S.Web({
        hub: [1198, 148],
        anchors: [[1118, CEILING + 4], [1172, CEILING + 4], [1236, CEILING + 4], [1292, CEILING + 6], [1266, 196], [1153, 142]],
        rings: 5,
        sheet: 0.3,
        seed: 805,
      }),
      // Between the swing's right chain and the ceiling.
      new S.Web({
        hub: [642, 186],
        anchors: [[556, CEILING + 4], [618, CEILING + 4], [700, CEILING + 4], [730, 214], [592, 262], [590, 196]],
        rings: 5,
        sheet: 0.35,
        seed: 806,
      }),
      // In the corner where the planter box meets the house.
      new S.Web({
        hub: [1322, 788],
        anchors: [[1302, 824], [1266, 806], [1262, 742], [1316, 728], [1356, 766], [1352, 822]],
        rings: 5,
        closed: true,
        sheet: 0.4,
        seed: 807,
      }),
      // Over the top corner of the door casing.
      new S.Web({
        hub: [860, 262],
        anchors: [[824, 220], [880, 222], [930, 226], [890, 300], [846, 330], [826, 290]],
        rings: 5,
        sheet: 0.4,
        seed: 808,
      }),
    ];
  }

  // ── Live state the room keeps between frames ────────────────────────────

  // The swing and the tutorial live here; onStart() resets them.
  const porch = {
    world: null,
    swing: { offset: 0, kick: 0, age: 9, dir: 1 },
  };

  // How much of a point has been swept clean by the makeover wave (0 → 1),
  // matching the runtime's 280 px smoothstep crossfade.
  function sweepMix(x, mk) {
    if (mk.wipe <= 0) return 0;
    if (mk.wipe >= 1) return 1;
    const t = S.clamp((mk.sweepX - x) / 280 + 0.5, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function createLive(seed = 1) {
    return {
      noise: S.createNoise(seed),
      branchNoise: S.createNoise(seed + 7),
      stars: Array.from({ length: 46 }, (_, i) => {
        const r = S.createRng(900 + i);
        return { x: r.range(0, 1), y: r.range(0.02, 0.6), s: r.range(0.6, 1.8), p: r.range(0, 6), right: i % 2 === 1 };
      }),
    };
  }

  // ── The far layer: the night past the posts ───────────────────────────

  const moonY = (day) => 236 + day * 330;

  function drawSky(g, live, time, mk) {
    const day = mk.window;
    const dirty = S.moods.dirty;
    const clean = S.moods.clean;
    const top = S.mixHex(dirty.windowSkyTop, clean.windowSkyTop, day);
    const low = S.mixHex(dirty.windowSkyBottom, clean.windowSkyBottom, day);
    const sky = g.createLinearGradient(0, 0, 0, FLOOR_LINE);
    sky.addColorStop(0, top);
    sky.addColorStop(0.8, low);
    sky.addColorStop(1, S.mixHex(low, P.soot, 0.3));
    g.fillStyle = sky;
    const L = { x: -60, w: 290 };
    const R = { x: 1700, w: 290 };
    g.fillRect(L.x, 0, L.w, FLOOR_LINE + 4);
    g.fillRect(R.x, 0, R.w, FLOOR_LINE + 4);

    // Stars fade as dawn comes.
    for (const st of live.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * 2 + st.p);
      const region = st.right ? R : L;
      g.fillStyle = `rgba(230,235,255,${(1 - day) * twinkle * 0.8})`;
      g.beginPath();
      g.arc(region.x + st.x * region.w, st.y * FLOOR_LINE, st.s, 0, Math.PI * 2);
      g.fill();
    }

    // The moon, upper left, sinking as the sun comes up behind the trees.
    const my = moonY(day);
    const halo = g.createRadialGradient(92, my, 18, 92, my, 120);
    halo.addColorStop(0, `rgba(190,210,235,${0.4 * (1 - day)})`);
    halo.addColorStop(1, 'rgba(190,210,235,0)');
    g.fillStyle = halo;
    g.fillRect(-60, my - 120, 300, 240);
    g.fillStyle = `rgba(232,238,248,${1 - day})`;
    g.beginPath();
    g.arc(92, my, 27, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = `rgba(150,165,190,${0.35 * (1 - day)})`; // a few maria
    g.beginPath();
    g.arc(84, my - 6, 7, 0, Math.PI * 2);
    g.arc(100, my + 8, 5, 0, Math.PI * 2);
    g.fill();
    if (day > 0) {
      const sun = g.createRadialGradient(60, 720 - day * 180, 10, 60, 720 - day * 180, 260);
      sun.addColorStop(0, `rgba(255,236,190,${day})`);
      sun.addColorStop(0.3, `rgba(255,200,140,${0.6 * day})`);
      sun.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = sun;
      g.fillRect(-60, 300, 300, 480);
      g.fillRect(1700, 300, 290, 480);
    }

    const silhouette = S.mixHex('#0C0E14', '#4A5A60', day);
    // Bare trees, swaying.
    const sway = live.branchNoise(time * 0.3) * 0.05;
    g.strokeStyle = silhouette;
    g.lineCap = 'round';
    drawBranch(g, 30, FLOOR_LINE - 90, -1.45 + sway, 220, 16, 6, live.branchNoise, time);
    drawBranch(g, 1990, 330, Math.PI + 0.35 - sway, 160, 12, 5, live.branchNoise, time);

    // A faint glow over the town beyond, so the neighbour's roof stands out.
    const town = g.createRadialGradient(1860, 690, 10, 1860, 690, 260);
    town.addColorStop(0, `rgba(242,165,74,${0.2 * (1 - day)})`);
    town.addColorStop(1, 'rgba(242,165,74,0)');
    g.fillStyle = town;
    g.fillRect(1700, 430, 290, 340);
    // A second roof further off, lower.
    g.fillStyle = S.mixHex(silhouette, low, 0.45);
    g.beginPath();
    g.moveTo(1900, 640);
    g.lineTo(1950, 600);
    g.lineTo(2000, 640);
    g.lineTo(2000, 700);
    g.lineTo(1900, 700);
    g.closePath();
    g.fill();
    // The neighbour's house, far off: a roofline and one window still lit.
    g.fillStyle = S.mixHex(silhouette, low, 0.3);
    g.beginPath();
    g.moveTo(1762, 560);
    g.lineTo(1830, 508);
    g.lineTo(1898, 560);
    g.lineTo(1890, 560);
    g.lineTo(1890, 680);
    g.lineTo(1770, 680);
    g.lineTo(1770, 560);
    g.closePath();
    g.fill();
    g.fillRect(1846, 512, 10, 26); // chimney
    const lit = 1 - day;
    g.fillStyle = S.mix('#2A2228', P.amber, 0.25 + 0.75 * lit);
    g.fillRect(1820, 580, 18, 22);
    g.fillStyle = S.rgba(silhouette, 0.9);
    g.fillRect(1828, 580, 2, 22);

    // A street lamp on the far right: a post and a glass head.
    g.fillStyle = silhouette;
    g.fillRect(1887, 478, 6, FLOOR_LINE - 478);
    g.beginPath();
    g.moveTo(1878, 476);
    g.lineTo(1902, 476);
    g.lineTo(1896, 456);
    g.lineTo(1884, 456);
    g.closePath();
    g.fill();
    g.fillStyle = S.mix('#3A3430', '#FFE2B0', lit);
    g.fillRect(1883, 460, 14, 14);

    // Hedge and lawn at the bottom, with a rail fence.
    const ground = S.mixHex(S.mixHex(P.soot, P.moss, 0.25), S.shadeHex(P.moss, -0.1), day);
    g.fillStyle = ground;
    const hedge = (x0, x1) => {
      g.beginPath();
      g.moveTo(x0, FLOOR_LINE + 4);
      for (let x = x0; x <= x1; x += 14) g.lineTo(x, 650 + live.noise(x * 0.05) * 16 + Math.sin(x * 0.11) * 6);
      g.lineTo(x1, FLOOR_LINE + 4);
      g.closePath();
      g.fill();
    };
    hedge(L.x, L.x + L.w);
    hedge(R.x, R.x + R.w);
    g.strokeStyle = S.mixHex(silhouette, P.linen, 0.15 + day * 0.3);
    g.lineWidth = 4;
    for (const region of [L, R]) {
      g.beginPath();
      g.moveTo(region.x, 700);
      g.lineTo(region.x + region.w, 702);
      g.moveTo(region.x, 728);
      g.lineTo(region.x + region.w, 730);
      g.stroke();
      for (let x = region.x + 20; x < region.x + region.w; x += 64) g.fillRect(x, 690, 6, 60);
    }
  }

  function drawBranch(g, x, y, angle, length, width, depth, noise, time) {
    if (depth === 0 || length < 8) return;
    const wobble = noise(time * 0.5 + depth * 3 + x * 0.01) * 0.08;
    const ex = x + Math.cos(angle + wobble) * length;
    const ey = y + Math.sin(angle + wobble) * length;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(ex, ey);
    g.stroke();
    drawBranch(g, ex, ey, angle - 0.45, length * 0.68, width * 0.65, depth - 1, noise, time);
    drawBranch(g, ex, ey, angle + 0.38, length * 0.6, width * 0.6, depth - 1, noise, time);
  }

  // ── Sprites for the moving props, painted once per variant ──────────────

  const sprites = { door: {}, swing: {} };

  function doorSprite(clean) {
    const key = clean ? 'clean' : 'dirty';
    if (sprites.door[key]) return sprites.door[key];
    const c = S.makeCanvas(DOOR.w, DOOR.h);
    const g = c.getContext('2d');
    const paintCol = pick(C.door, clean);
    const light = toward(DOOR.x + DOOR.w / 2, DOOR.y + DOOR.h / 2);
    paintShape(g, rectPoints(0, 0, DOOR.w, DOOR.h), {
      color: paintCol,
      lightDir: light,
      light: 0.16,
      shadow: 0.4,
      strokes: 13,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.04,
      rim: 0.35,
      innerShadow: 0.45,
      wobble: 0.3,
      seed: 820,
    });
    // Six raised panels.
    const panels = [[18, 22, 64, 92], [98, 22, 64, 92], [18, 130, 64, 140], [98, 130, 64, 140], [18, 300, 64, 118], [98, 300, 64, 118]];
    panels.forEach(([x, y, w, h], i) => {
      g.fillStyle = 'rgba(6,6,9,0.45)';
      g.fillRect(x - 3, y - 3, w + 6, h + 6);
      paintShape(g, rectPoints(x, y, w, h), {
        color: S.shadeHex(paintCol, 0.04),
        lightDir: light,
        light: 0.2,
        shadow: 0.35,
        strokes: 14,
        strokeAngle: Math.PI / 2,
        rim: 0.4,
        innerShadow: 0.35,
        wobble: 0.3,
        seed: 821 + i,
      });
      g.strokeStyle = 'rgba(245,236,220,0.16)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 3, y + h + 3);
      g.lineTo(x + w + 3, y + h + 3);
      g.lineTo(x + w + 3, y - 3);
      g.stroke();
    });
    const brass = pick(C.brass, clean);
    // Letter slot, knocker, knob and keyhole.
    g.fillStyle = S.shadeHex(brass, -0.3);
    g.fillRect(58, 280, 64, 13);
    g.fillStyle = brass;
    g.fillRect(60, 282, 60, 4);
    g.strokeStyle = brass;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(90, 76, 15, 0.2, Math.PI - 0.2);
    g.stroke();
    g.fillStyle = S.shadeHex(brass, -0.2);
    g.beginPath();
    g.ellipse(90, 62, 8, 6, 0, 0, Math.PI * 2);
    g.fill();
    const knob = g.createRadialGradient(160, 228, 1, 162, 232, 12);
    knob.addColorStop(0, clean ? '#FFF0C8' : S.shadeHex(brass, 0.25));
    knob.addColorStop(1, S.shadeHex(brass, -0.45));
    g.fillStyle = S.shadeHex(brass, -0.25);
    g.beginPath();
    g.ellipse(162, 236, 9, 20, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = knob;
    g.beginPath();
    g.arc(162, 232, 11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.soot;
    g.beginPath();
    g.arc(162, 250, 2.4, 0, Math.PI * 2);
    g.fill();
    g.fillRect(161, 250, 2, 5);
    if (clean) {
      // Fresh paint shines along the lantern side.
      g.fillStyle = 'rgba(255,236,206,0.08)';
      g.fillRect(DOOR.w - 26, 0, 14, DOOR.h);
    } else {
      // Grey paint flaking off: underneath, the green it used to be.
      const rng = S.createRng(830);
      for (let i = 0; i < 24; i++) {
        const fx = rng.range(4, DOOR.w - 4);
        const fy = rng.range(4, DOOR.h - 4);
        const pts = [];
        const n = rng.int(5, 8);
        const r = rng.range(2, 7);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          pts.push([fx + Math.cos(a) * r * rng.range(0.5, 1.3), fy + Math.sin(a) * r * rng.range(0.5, 1.6)]);
        }
        g.fillStyle = S.rgba(S.mixHex(S.shadeHex(P.moss, -0.2), paintCol, 0.35), 0.7);
        segPath(g, pts);
        g.fill();
        g.strokeStyle = 'rgba(230,224,212,0.14)';
        g.lineWidth = 1;
        g.stroke();
      }
      g.save();
      g.filter = 'blur(10px)';
      g.fillStyle = 'rgba(40,36,30,0.3)';
      g.fillRect(0, DOOR.h - 90, DOOR.w, 90);
      g.restore();
    }
    sprites.door[key] = c;
    return c;
  }

  // The swing, drawn into a sprite at its rest position (x 280–640, y 660–840).
  const SWING_BOX = { x: 280, y: 660, w: 360, h: 180 };

  function swingSprite(clean) {
    const key = clean ? 'clean' : 'dirty';
    if (sprites.swing[key]) return sprites.swing[key];
    const c = S.makeCanvas(SWING_BOX.w, SWING_BOX.h);
    const g = c.getContext('2d');
    g.translate(-SWING_BOX.x, -SWING_BOX.y);
    const wood = clean ? S.mixHex(P.oak, P.linen, 0.18) : S.mixHex(P.taupe, P.linen, 0.18);
    const { x0, x1, seat } = SWING;
    const light = toward((x0 + x1) / 2, seat - 60);
    // Back slats.
    paintShape(g, rectPoints(x0 + 18, seat - 112, x1 - x0 - 36, 14), {
      color: S.shadeHex(wood, 0.05),
      lightDir: { x: light.x, y: -1 },
      light: 0.25,
      shadow: 0.4,
      strokes: 10,
      strokeAngle: 0,
      rim: 0.6,
      rimColor: clean ? '#FFE2B8' : P.moon,
      innerShadow: 0.2,
      wobble: 0.4,
      seed: 840,
    });
    for (let sx = x0 + 26, i = 0; sx < x1 - 30; sx += 30, i++) {
      const cracked = !clean && i === 4;
      paintShape(g, rectPoints(sx, seat - 98, 20, 96), {
        color: S.shadeHex(wood, -0.1 + (i % 2) * 0.04),
        lightDir: light,
        light: 0.2,
        shadow: 0.4,
        strokes: 12,
        strokeAngle: Math.PI / 2,
        rim: 0.3,
        innerShadow: 0.3,
        wobble: 0.4,
        seed: 841 + i,
      });
      if (cracked) {
        g.strokeStyle = 'rgba(6,6,9,0.7)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(sx + 6, seat - 98);
        g.lineTo(sx + 12, seat - 60);
        g.lineTo(sx + 8, seat - 30);
        g.stroke();
      }
    }
    // Seat, with its front apron below.
    paintShape(g, rectPoints(x0, seat - 4, x1 - x0, 14), {
      color: S.shadeHex(wood, 0.1),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.35,
      strokes: 12,
      strokeAngle: 0,
      rim: 0.6,
      rimColor: clean ? '#FFE2B8' : P.moon,
      innerShadow: 0.15,
      wobble: 0.4,
      seed: 850,
    });
    paintShape(g, rectPoints(x0 + 6, seat + 10, x1 - x0 - 12, 20), {
      color: S.shadeHex(wood, -0.2),
      lightDir: { x: light.x, y: -1 },
      light: 0.15,
      shadow: 0.45,
      strokes: 12,
      strokeAngle: 0,
      rim: 0.2,
      innerShadow: 0.3,
      wobble: 0.4,
      seed: 851,
    });
    // A cushion on the seat: flattened and mildewed, or plumped and striped.
    const cushion = clean ? S.mixHex(P.rust, P.linen, 0.35) : S.mixHex(P.taupe, P.moss, 0.3);
    paintShape(g, roundedRectPoints(x0 + 34, seat - 20, x1 - x0 - 68, clean ? 22 : 16, 8), {
      color: cushion,
      lightDir: { x: 0, y: -1 },
      light: 0.25,
      shadow: 0.4,
      strokes: 26,
      strokeAngle: 0,
      strokeSize: 0.6,
      rim: 0.35,
      innerShadow: 0.3,
      wobble: 1,
      seed: 852,
    });
    if (clean) {
      g.strokeStyle = S.rgba(P.linen, 0.35);
      g.lineWidth = 3;
      for (let sx = x0 + 52; sx < x1 - 40; sx += 26) {
        g.beginPath();
        g.moveTo(sx, seat - 18);
        g.lineTo(sx - 2, seat);
        g.stroke();
      }
    } else {
      stain(g, x0 + 150, seat - 12, 18, '#20180F', 853, 0.5);
    }
    // Arms at both ends.
    for (const ax of [x0, x1 - 16]) {
      paintShape(g, rectPoints(ax, seat - 58, 16, 66), {
        color: S.shadeHex(wood, -0.05),
        lightDir: light,
        light: 0.22,
        shadow: 0.45,
        strokes: 10,
        strokeAngle: Math.PI / 2,
        rim: 0.4,
        innerShadow: 0.3,
        wobble: 0.3,
        seed: 854 + ax,
      });
      paintShape(g, rectPoints(ax - 8, seat - 64, 32, 10), {
        color: S.shadeHex(wood, 0.12),
        lightDir: { x: 0, y: -1 },
        light: 0.3,
        shadow: 0.35,
        strokes: 6,
        rim: 0.5,
        wobble: 0.3,
        seed: 856 + ax,
      });
    }
    if (!clean) {
      g.save();
      g.filter = 'blur(5px)';
      g.fillStyle = 'rgba(165,158,144,0.3)';
      g.fillRect(x0 + 20, seat - 118, x1 - x0 - 40, 10);
      g.fillRect(x0 + 30, seat - 22, x1 - x0 - 60, 8);
      g.restore();
    }
    sprites.swing[key] = c;
    return c;
  }

  // Dirty → clean for a sprite, crossfaded where the makeover wave is.
  function drawSprite(g, dirty, clean, x, y, w, h, m) {
    if (m <= 0) return g.drawImage(dirty, x, y, w, h);
    g.drawImage(clean, x, y, w, h);
    if (m < 1) {
      g.save();
      g.globalAlpha = 1 - m;
      g.drawImage(dirty, x, y, w, h);
      g.restore();
    }
  }

  // ── Moving props ────────────────────────────────────────────────────────

  function drawProps(g, live, time, mk) {
    drawLitWindows(g, mk);
    drawTransomGlow(g, mk);
    drawDoor(g, mk);
    drawSwing(g, live, time, mk);
    drawLantern(g, live, time, mk);
  }

  // The rooms behind the windows come on during the makeover.
  function drawLitWindows(g, mk) {
    WINDOWS.forEach((win) => {
      const k = win.id === 'left' ? mk.windowLeft : mk.windowRight;
      if (!(k > 0)) return;
      const panes = windowPanes(win);
      g.save();
      g.beginPath();
      for (const p of panes) g.rect(p.x, p.y, p.w, p.h);
      g.clip();
      g.globalAlpha = k * 0.72;
      const lampX = win.id === 'left' ? win.x + win.w * 0.66 : win.x + win.w * 0.3;
      const room = g.createRadialGradient(lampX, win.y + win.h * 0.4, 10, lampX, win.y + win.h * 0.4, win.w * 0.95);
      room.addColorStop(0, '#FFE2B0');
      room.addColorStop(0.25, S.mixHex(P.amber, P.linen, 0.25));
      room.addColorStop(0.65, S.mixHex(P.amber, P.rust, 0.45));
      room.addColorStop(1, S.mixHex(P.rust, P.walnut, 0.55));
      g.fillStyle = room;
      g.fillRect(win.x, win.y, win.w, win.h);
      // The window head shades the top of the room; the lace catches the lamp.
      const head = g.createLinearGradient(0, win.y, 0, win.y + win.h * 0.4);
      head.addColorStop(0, 'rgba(40,24,16,0.5)');
      head.addColorStop(1, 'rgba(40,24,16,0)');
      g.fillStyle = head;
      g.fillRect(win.x, win.y, win.w, win.h * 0.4);
      const side = win.id === 'left' ? 1 : -1;
      const cx = side === 1 ? win.x + 16 : win.x + win.w - 16;
      g.strokeStyle = 'rgba(255,240,214,0.3)';
      g.lineWidth = 3;
      for (let i = 1; i < 5; i++) {
        g.beginPath();
        g.moveTo(cx + side * i * 18, win.y + 16);
        g.quadraticCurveTo(cx + side * i * 13, win.y + win.h * 0.5, cx + side * i * 15, win.y + win.h - 16);
        g.stroke();
      }
      // The same furniture, now dark against the light.
      g.fillStyle = 'rgba(40,24,16,0.55)';
      if (win.id === 'left') {
        const lx = win.x + win.w * 0.66;
        g.fillRect(lx - 3, win.y + win.h * 0.44, 6, win.h * 0.3);
        g.fillRect(lx - 60, win.y + win.h * 0.74, 120, win.h * 0.3);
        g.fillStyle = 'rgba(255,240,210,0.9)';
        g.beginPath();
        g.moveTo(lx - 34, win.y + win.h * 0.44);
        g.lineTo(lx + 34, win.y + win.h * 0.44);
        g.lineTo(lx + 22, win.y + win.h * 0.3);
        g.lineTo(lx - 22, win.y + win.h * 0.3);
        g.closePath();
        g.fill();
      } else {
        const cx = win.x + win.w * 0.38;
        g.beginPath();
        g.moveTo(cx - 40, win.y + win.h);
        g.lineTo(cx - 36, win.y + win.h * 0.42);
        g.quadraticCurveTo(cx, win.y + win.h * 0.32, cx + 36, win.y + win.h * 0.42);
        g.lineTo(cx + 40, win.y + win.h);
        g.closePath();
        g.fill();
        g.fillRect(win.x + win.w * 0.62, win.y + win.h * 0.2, 46, 56);
      }
      g.restore();
    });
  }

  function drawTransomGlow(g, mk) {
    const k = mk.transom;
    if (!(k > 0)) return;
    const tr = transomSegments();
    g.save();
    g.globalAlpha = k;
    for (const seg of tr.segs) {
      g.fillStyle = seg.sun ? '#FFE2B0' : S.mixHex(seg.tone, P.dawn, 0.3);
      segPath(g, seg.pts);
      g.fill();
    }
    drawTransomLead(g, tr, true);
    g.restore();
  }

  // The door: shut while dirty; in the makeover it swings in on its left
  // hinges, and the warm hall shows through the gap.
  function drawDoor(g, mk) {
    const open = S.clamp(mk.doorOpen || 0, 0, 1);
    const w = DOOR.w * (1 - 0.2 * open);
    if (open > 0) {
      const gap = g.createLinearGradient(DOOR.x + w, 0, DOOR.x + DOOR.w, 0);
      gap.addColorStop(0, S.mixHex(P.amber, P.ember, 0.3));
      gap.addColorStop(1, '#FFE2B0');
      g.save();
      g.globalAlpha = open;
      g.fillStyle = gap;
      g.fillRect(DOOR.x + w - 4, DOOR.y, DOOR.w - w + 4, DOOR.h);
      g.restore();
    }
    const m = sweepMix(DOOR.x + DOOR.w / 2, mk);
    drawSprite(g, doorSprite(false), doorSprite(true), DOOR.x, DOOR.y, w, DOOR.h, m);
    if (open > 0) {
      // Turned away from us, the face of the door darkens; its edge catches the hall light.
      g.fillStyle = `rgba(10,8,8,${0.28 * open})`;
      g.fillRect(DOOR.x, DOOR.y, w, DOOR.h);
      g.fillStyle = `rgba(255,214,160,${0.7 * open})`;
      g.fillRect(DOOR.x + w - 6, DOOR.y + 2, 6, DOOR.h - 4);
    }
  }

  // Where the lantern is this frame: its swing angle, its glass centre and
  // the direction "down" points for its light cone.
  function lanternPose(live, time, mk) {
    const settle = S.ease.out(S.clamp(mk.lanternSettle || 0, 0, 1));
    const swing = 0.08 * Math.sin(time * ((Math.PI * 2) / 3.4)) + 0.012 * live.noise(time * 0.8);
    const theta = swing * (1 - settle);
    const d = (LANTERN.glassTop + LANTERN.glassBottom) / 2 - LANTERN.pivotY;
    return {
      theta,
      x: LANTERN.x - Math.sin(theta) * d,
      y: LANTERN.pivotY + Math.cos(theta) * d,
      down: Math.PI / 2 + theta,
    };
  }

  function lanternFlicker(live, time, mk) {
    if (mk.lanternSteady >= 1) return 1;
    return S.lerp(S.light.flicker(live.noise, time, 1.3), 1, mk.lanternSteady || 0);
  }

  function drawLantern(g, live, time, mk) {
    const pose = lanternPose(live, time, mk);
    const flick = lanternFlicker(live, time, mk);
    const clean = sweepMix(LANTERN.x, mk) > 0.5;
    const iron = S.shadeHex(P.gear, -0.45);
    const brass = clean ? P.brass : C.brass[0];
    const top = LANTERN.glassTop - LANTERN.pivotY; // local y of the glass
    const bottom = LANTERN.glassBottom - LANTERN.pivotY;
    const half = LANTERN.half;

    // Ceiling plate.
    g.fillStyle = S.shadeHex(brass, -0.3);
    g.beginPath();
    g.ellipse(LANTERN.x, LANTERN.pivotY + 2, 18, 5, 0, 0, Math.PI * 2);
    g.fill();

    g.save();
    g.translate(LANTERN.x, LANTERN.pivotY);
    g.rotate(pose.theta);
    // Chain.
    g.strokeStyle = S.shadeHex(brass, -0.25);
    g.lineWidth = 2.5;
    for (let cy = 3; cy < top - 14; cy += 8) {
      g.beginPath();
      g.ellipse(0, cy + 4, 2.5, 4.5, (cy / 8) % 2 ? 0 : Math.PI / 2, 0, Math.PI * 2);
      g.stroke();
    }
    // Roof: a little pyramid with a ring on top.
    g.fillStyle = iron;
    g.beginPath();
    g.moveTo(-8, top - 14);
    g.lineTo(8, top - 14);
    g.lineTo(half + 6, top + 1);
    g.lineTo(-half - 6, top + 1);
    g.closePath();
    g.fill();
    g.fillStyle = S.rgba(brass, 0.9);
    g.fillRect(-half - 6, top - 1, half * 2 + 12, 3);

    // Glass, lit from inside by the flame.
    const glass = g.createRadialGradient(0, (top + bottom) / 2 + 6, 4, 0, (top + bottom) / 2, half * 1.6);
    glass.addColorStop(0, `rgba(255,236,196,${0.65 + 0.3 * flick})`);
    glass.addColorStop(0.5, S.rgba(P.amber, 0.45 + 0.35 * flick));
    glass.addColorStop(1, S.rgba(P.ember, 0.35 + 0.2 * flick));
    g.fillStyle = glass;
    g.fillRect(-half, top + 2, half * 2, bottom - top - 2);
    // The flame.
    g.fillStyle = `rgba(255,246,220,${0.7 + 0.3 * flick})`;
    g.beginPath();
    g.ellipse(0, (top + bottom) / 2 + 10, 4, 9 * (0.85 + 0.15 * flick), 0, 0, Math.PI * 2);
    g.fill();
    if (!clean) {
      // Soot and grime on the inside of the glass.
      g.fillStyle = 'rgba(40,32,26,0.35)';
      g.fillRect(-half, top + 2, half * 2, 12);
      g.fillStyle = 'rgba(70,60,48,0.25)';
      g.beginPath();
      g.ellipse(-10, bottom - 14, 14, 8, 0.3, 0, Math.PI * 2);
      g.fill();
    }
    // The cage: corner posts in front, the back posts fainter through the glass.
    g.fillStyle = S.rgba(iron, 0.55);
    for (const px of [-half * 0.4, half * 0.4]) g.fillRect(px - 1, top, 2, bottom - top);
    g.fillStyle = iron;
    for (const px of [-half, half]) g.fillRect(px - 2.5, top, 5, bottom - top);
    g.fillRect(-half - 2, (top + bottom) / 2 - 1, half * 2 + 4, 3);
    // Base and finial.
    g.fillStyle = iron;
    g.fillRect(-half - 4, bottom, half * 2 + 8, 7);
    g.fillStyle = S.rgba(brass, 0.85);
    g.beginPath();
    g.moveTo(-8, bottom + 7);
    g.lineTo(8, bottom + 7);
    g.lineTo(0, bottom + 18);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawSwing(g, live, time, mk) {
    const sx = porch.swing.offset;
    const m = sweepMix((SWING.x0 + SWING.x1) / 2, mk);
    // Its shadow on the boards stays put while the seat moves above it.
    softShadow(g, (SWING.x0 + SWING.x1) / 2 + sx * 0.5, GROUND - 6, 190, 16, 0.4);
    drawSprite(g, swingSprite(false), swingSprite(true), SWING_BOX.x + sx, SWING_BOX.y, SWING_BOX.w, SWING_BOX.h, m);
    // Chains from the ceiling hooks: each splits near the bottom to the arm and the back.
    const metal = S.shadeHex(m > 0.5 ? P.brass : C.brass[0], -0.25);
    SWING.hooks.forEach((hx, i) => {
      const armX = (i === 0 ? SWING.x0 + 8 : SWING.x1 - 8) + sx;
      const forkY = SWING.seat - 170;
      const forkX = S.lerp(hx, armX, (forkY - CEILING) / (SWING.seat - 64 - CEILING));
      chain(g, hx, CEILING + 2, forkX, forkY, metal);
      chain(g, forkX, forkY, armX, SWING.seat - 64, metal);
      chain(g, forkX, forkY, armX + (i === 0 ? 14 : -14), SWING.seat - 112, metal);
      g.fillStyle = S.shadeHex(P.gear, -0.4);
      g.beginPath();
      g.arc(hx, CEILING + 3, 4, 0, Math.PI * 2);
      g.fill();
    });
    void live;
    void time;
  }

  // A chain as alternating links, so it reads as metal, not a line.
  function chain(g, x0, y0, x1, y1, color) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const a = Math.atan2(y1 - y0, x1 - x0);
    const n = Math.max(1, Math.floor(len / 9));
    g.strokeStyle = color;
    g.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      g.save();
      g.translate(S.lerp(x0, x1, t), S.lerp(y0, y1, t));
      g.rotate(a);
      g.beginPath();
      if (i % 2) g.ellipse(0, 0, 5.5, 2.6, 0, 0, Math.PI * 2);
      else {
        g.moveTo(-5, 0);
        g.lineTo(5, 0);
      }
      g.stroke();
      g.restore();
    }
  }

  // ── Light rig ─────────────────────────────────────────────────────────

  // The moon comes in past the left post and slants down across the porch.
  function moonQuad(mk) {
    const lean = S.lerp(0, 90, mk.window);
    return [
      [150, 250],
      [262, 196],
      [900 + lean, PORCH_EDGE],
      [500 + lean, PORCH_EDGE],
    ];
  }

  // The wedge of hall light that the open door lays across the boards.
  function doorWedge(open) {
    const crack = DOOR.x + DOOR.w * (1 - 0.2 * open);
    const edge = DOOR.x + DOOR.w;
    return [
      [crack - 2, FLOOR_LINE - 6],
      [edge, FLOOR_LINE - 6],
      [edge + 560 * open, 1080],
      [crack + 40 * open, 1080],
    ];
  }

  function windowSpill(win) {
    return [
      [win.x + 20, win.y + win.h - 20],
      [win.x + win.w - 20, win.y + win.h - 20],
      [win.x + win.w + 90, PORCH_EDGE],
      [win.x - 90, PORCH_EDGE],
    ];
  }

  function lights(lm, live, time, mk) {
    const day = mk.window;
    const sky = S.mixHex(P.moon, P.dawn, day);

    // Moonlight from the upper left: a broad spill, the sky past the post, the beam.
    lm.point(-200, -200, 1400, sky, S.lerp(0.55, 0.72, day));
    lm.point(70, 400, 460, sky, S.lerp(0.42, 0.6, day));
    lm.shaft(moonQuad(mk), sky, S.lerp(0.8, 0.95, day));
    // The right side: open sky, and the street lamp until it goes out at dawn.
    lm.point(1860, 380, 540, sky, 0.5);
    lm.point(1745, 640, 300, sky, 0.22); // open sky beside the right post
    lm.point(1910, 470, 600, P.amber, 0.2 * (1 - day));

    // The lantern: unreliable while dirty, and it swings, so its light swings.
    const flick = lanternFlicker(live, time, mk);
    const pose = lanternPose(live, time, mk);
    lm.point(pose.x, pose.y, 720, P.amber, 0.9 * flick);
    lm.cone(pose.x, pose.y + 18, pose.down, 1.5, 1000, P.amber, 0.82 * flick);
    lm.cone(pose.x, pose.y - 18, pose.down + Math.PI, 1.4, 460, P.amber, 0.5 * flick);
    const poolX = LANTERN.x - Math.tan(pose.theta) * (GROUND - LANTERN.pivotY);
    lm.point(poolX, GROUND - 10, 470, P.amber, 0.62 * flick);
    lanternShadows(lm, pose, mk, flick);

    // Off until the makeover: the transom, the door, the two windows.
    lm.point(960, 282, 330, P.amber, 0.6 * (mk.transom || 0));
    const open = mk.doorOpen || 0;
    if (open > 0) {
      lm.shaft(doorWedge(open), P.amber, 1.1 * open);
      lm.point(DOOR.x + DOOR.w - 10, 560, 440, P.amber, 0.55 * open);
    }
    for (const win of WINDOWS) {
      const k = (win.id === 'left' ? mk.windowLeft : mk.windowRight) || 0;
      if (k <= 0) continue;
      lm.point(win.x + win.w / 2, win.y + win.h / 2, 460, P.amber, 0.45 * k);
      lm.shaft(windowSpill(win), P.amber, 0.6 * k);
    }
    return flick;
  }

  /*
   * The lantern's frame throws thin shadows that sweep across the porch as
   * it swings. A shadow in a light map is just "less light": each post's
   * shadow is a narrow wedge, radiating from the flame, painted back toward
   * the ambient colour over the light already added.
   */
  function lanternShadows(lm, pose, mk, flick) {
    const g = lm.ctx;
    const strength = 0.32 * flick * (1 - 0.5 * mk.mood);
    const bottom = LANTERN.glassBottom - LANTERN.pivotY - (pose.y - LANTERN.pivotY);
    const top = LANTERN.glassTop - LANTERN.pivotY - (pose.y - LANTERN.pivotY);
    g.save();
    g.globalCompositeOperation = 'source-over';
    for (const [lx, ly] of [[-LANTERN.half, bottom], [LANTERN.half, bottom], [-LANTERN.half, top], [LANTERN.half, top]]) {
      const a = Math.atan2(ly, lx) + pose.theta;
      const reach = ly > 0 ? 950 : 200;
      for (const [half, alpha] of [[0.075, 0.28], [0.04, 0.34], [0.018, 0.4]]) {
        g.fillStyle = S.mix(S.moods.dirty.ambient, S.moods.clean.ambient, mk.mood, alpha * strength);
        g.beginPath();
        g.moveTo(pose.x + Math.cos(a - half) * 60, pose.y + Math.sin(a - half) * 60);
        g.lineTo(pose.x + Math.cos(a - half) * reach, pose.y + Math.sin(a - half) * reach);
        g.lineTo(pose.x + Math.cos(a + half) * reach, pose.y + Math.sin(a + half) * reach);
        g.lineTo(pose.x + Math.cos(a + half) * 60, pose.y + Math.sin(a + half) * 60);
        g.closePath();
        g.fill();
      }
    }
    g.restore();
  }

  function glow(g, lm, live, time, mk, flick, shift = 0) {
    const day = mk.window;
    const sky = day > 0.5 ? P.dawn : P.moon;

    // Beyond the posts: the moon, the street lamp, the neighbour's window.
    S.light.glow(g, 92 + shift, moonY(day), 140, P.moon, 0.32 * (1 - day));
    S.light.glow(g, 1890 + shift, 467, 110, P.amber, 0.55 * (1 - day));
    S.light.glow(g, 1890 + shift, 467, 26, '#FFE2B0', 0.6 * (1 - day));
    S.light.glow(g, 1829 + shift, 591, 34, P.amber, 0.4 * (1 - day));
    S.light.glow(g, 1890 + shift, 700, 120, P.amber, 0.18 * (1 - day)); // its pool on the hedge

    // The moon beam, visible in the dusty air.
    S.light.beam(g, moonQuad(mk), sky, S.lerp(0.2, 0.3, day));

    // The lantern glass blooms; the flame burns through it.
    const pose = lanternPose(live, time, mk);
    S.light.glow(g, pose.x, pose.y, 250, P.amber, 0.6 * flick);
    S.light.glow(g, pose.x, pose.y + 8, 64, '#FFE2B0', 0.7 * flick);

    if (mk.transom > 0) S.light.glow(g, 960, 282, 140, P.amber, 0.5 * mk.transom);
    const open = mk.doorOpen || 0;
    if (open > 0) {
      S.light.beam(g, doorWedge(open), P.amber, 0.34 * open);
      S.light.glow(g, DOOR.x + DOOR.w - 16, 560, 190, P.dawn, 0.4 * open);
    }
    for (const win of WINDOWS) {
      const k = (win.id === 'left' ? mk.windowLeft : mk.windowRight) || 0;
      if (k <= 0) continue;
      S.light.glow(g, win.x + win.w / 2, win.y + win.h / 2, 230, P.amber, 0.26 * k);
      S.light.beam(g, windowSpill(win), P.amber, 0.14 * k);
    }
    void lm;
  }

  // ── Rules: the tutorial room is gentle ────────────────────────────────

  const rules = {
    quota: 8,
    webGoal: 0.8,
    spawnPattern: ['string'],
    maxAlive: [2, 3],
    spawnInterval: [3.2, 2.0],
    types: ['string'], // no wall crawlers yet; eggs and hatchlings come from the spiders
  };

  // ── Makeover: the porch's own beats ───────────────────────────────────

  const makeover = {
    beats: [
      { key: 'lanternSteady', from: 1.6, to: 1.9, ease: 'linear', chime: 0.0 }, // the flicker stops
      { key: 'transom', from: 2.0, to: 2.5, ease: 'out', chime: 0.34 }, // glows from inside
      { key: 'windowLeft', from: 4.6, to: 4.85, ease: 'out', chime: 0.58 },
      { key: 'windowRight', from: 4.9, to: 5.15, ease: 'out', chime: 1.0 },
    ],
    // The porch's moment: the lantern stops swinging, then the door opens a
    // crack and lays warm light across the boards (the windows follow, above).
    uniqueBeat: {
      key: 'welcome',
      at: 3.4,
      run(mk, t, fx) {
        mk.welcome = 1;
        mk.lanternSettle = S.clamp((t - 3.4) / 0.5, 0, 1);
        mk.doorOpen = S.ease.inOut(S.clamp((t - 3.9) / 0.8, 0, 1));
        if (t >= 3.9 && !mk.doorCreaked) {
          mk.doorCreaked = true;
          fx.sfx('creak', 1.2);
        }
      },
    },
  };

  // ── The swing ─────────────────────────────────────────────────────────

  // A damped sway: ±8 px, a 1.6 s period, dying away over a few swings.
  const SWAY = { amp: 9.6, period: 1.6, decay: 1.9 };

  function kickSwing(vx) {
    const s = porch.swing;
    s.age = 0;
    s.dir = vx < -20 ? -1 : 1;
  }

  function onUpdate(dt, world) {
    const s = porch.swing;
    s.age += dt;
    const w = (Math.PI * 2) / SWAY.period;
    const sway = SWAY.amp * Math.exp(-s.age / SWAY.decay) * Math.sin(w * s.age) * s.dir;
    const breeze = world.live ? world.live.noise(world.time * 0.35 + 40) * 1.2 : 0;
    s.offset = sway + breeze;
    swingPlatform.x0 = SWING.x0 + 20 + s.offset;
    swingPlatform.x1 = SWING.x1 - 20 + s.offset;
    if (world.state !== 'playing') tutorial.leaveRoom();
  }

  // ── Tutorial: six notes from "A.", pinned to the left post ──────────────

  const NOTES = [
    'Walk the porch first. A and D.',
    'The swing will hold you. W to jump.',
    "There's one right above you. Aim, and click.",
    'Shoot the thread. It is weaker than the spider.',
    'Tear the webs down too. The house remembers.',
    'Little ones. Land on them.',
  ];
  const LAST_NOTE = 'The rest is yours. Finish the job.';
  const STEP_GAP = 0.7; // seconds between one note tearing and the next going up

  /*
   * One step per note. Each step has a scripted setup (enter) and a test
   * for "done" (events, or a per-frame check). While the tutorial runs it
   * is the director: the runtime's spawner waits until the last note.
   */
  const tutorial = {
    active: false,
    step: -1,
    wait: 0,
    world: null,
    el: null,
    note: null,
    walked: 0,
    lastX: 0,
    torn: 0,
    tries: 0,
    spider: null,
    egg: null,
    brood: [],

    reset() {
      this.active = false;
      this.step = -1;
      this.wait = 0;
      this.spider = null;
      this.egg = null;
      this.brood = [];
      this.removeDom();
    },

    begin(world, step = 0, opts = {}) {
      this.world = world;
      this.active = true;
      this.enter(step, opts);
    },

    enter(step, opts = {}) {
      const world = this.world;
      const hero = world.hero;
      this.step = step;
      this.tries = 0;
      this.wait = 0;
      this.show(NOTES[step], step === 0);
      if (step === 0) {
        this.walked = 0;
        this.lastX = hero.x;
      } else if (step === 1) {
        // Already standing on it? Then this note is quickly done.
        if (hero.onGround && hero.standingOn === swingPlatform) this.wait = -1.2;
      } else if (step === 2) {
        this.spider = this.tame(world.spawn('string', { x: (SWING.x0 + SWING.x1) / 2 + 30, targetY: 430, hover: Boolean(opts.hover) }));
      } else if (step === 3) {
        this.spider = this.tame(world.spawn('string', { x: 690, targetY: 300, hover: Boolean(opts.hover) }));
      } else if (step === 4) {
        this.torn = 0;
      } else if (step === 5) {
        this.dropEgg();
      }
    },

    // A teaching spider: it hangs there and waits. No lunges, no eggs.
    tame(spider) {
      spider.aggression = 0;
      spider.eggCooldown = Infinity;
      spider.hoverFor = Infinity;
      return spider;
    },

    untame(spider) {
      if (!spider || !spider.alive) return;
      spider.aggression = 0.6;
      spider.eggCooldown = 2;
      spider.hoverFor = spider.timer + 3;
    },

    dropEgg() {
      const hero = this.world.hero;
      // Land it on open boards beside the hero, never on the swing or the planter.
      let x = hero.x + (hero.facing || 1) * 220;
      if (x > 1240 || x < 680) x = hero.x > 960 ? hero.x - 240 : hero.x + 240;
      x = S.clamp(x, 680, 1240);
      this.egg = this.world.spawnEgg(x, CEILING + 30, 'falling', { hatchAt: 1.3, count: 2, speed: 0.6 });
      this.brood = [];
    },

    // The current note is done: tear it off, and put the next one up shortly.
    complete() {
      this.tear();
      this.wait = STEP_GAP;
      this.next = this.step + 1;
      this.step = -1;
    },

    finish() {
      this.active = false;
      this.show(LAST_NOTE, false, false);
      this.lastTimer = 3.6;
    },

    skip() {
      this.tear();
      this.active = false;
      this.untame(this.spider);
    },

    leaveRoom() {
      if (this.note) this.tear();
      this.active = false;
    },

    // Called by the runtime every step instead of the director. Returns true
    // while the tutorial is in charge.
    update(dt, world) {
      if (this.lastTimer > 0) {
        this.lastTimer -= dt;
        if (this.lastTimer <= 0) this.tear();
      }
      if (!this.active) return false;
      const hero = world.hero;
      if (this.step === -1) {
        this.wait -= dt;
        if (this.wait <= 0) {
          if (this.next >= NOTES.length) this.finish();
          else this.enter(this.next);
        }
        return true;
      }
      if (this.wait < 0) {
        this.wait += dt;
        if (this.wait >= 0) this.complete();
        return true;
      }
      if (this.step === 0) {
        this.walked += Math.abs(hero.x - this.lastX);
        this.lastX = hero.x;
        if (this.walked >= 300) this.complete();
      } else if (this.step === 3 && this.respawnIn > 0) {
        this.respawnIn -= dt;
        if (this.respawnIn <= 0) this.spider = this.tame(world.spawn('string', { x: 690, targetY: 300 }));
      } else if (this.step === 5) {
        const eggGone = this.egg && !this.egg.alive && !this.brood.length && this.egg.done;
        const broodGone = this.brood.length && this.brood.every((h) => !h.alive);
        if (eggGone || broodGone) {
          // Shot instead of stomped. Try once more, then let it go.
          this.tries++;
          if (this.tries >= 2) this.complete();
          else this.dropEgg();
        }
      }
      return true;
    },

    event(name, payload) {
      if (!this.active || this.step < 0 || this.wait < 0) return;
      const step = this.step;
      if (name === 'land' && step === 1 && payload === swingPlatform) this.complete();
      else if (name === 'kill' && step === 2) this.complete();
      else if (name === 'kill' && step === 3) {
        this.lastHow = payload.how;
        if (payload.how === 'cut') this.complete();
        else if (++this.tries >= 2) this.complete();
        else this.respawnIn = 1.0;
      } else if (name === 'tear' && step === 4) {
        this.torn += payload.count;
        if (this.torn >= 15) this.complete();
      } else if (name === 'hatch' && step === 5 && payload.egg === this.egg) {
        this.brood = payload.hatchlings;
      } else if (name === 'stomp' && step === 5) this.complete();
    },

    // ── The paper notes (DOM, under the HUD and the cards) ─────────────

    ensureDom() {
      if (this.el && this.el.isConnected) return this.el;
      const frame = this.world.frameEl;
      const el = document.createElement('div');
      el.className = 'porch-notes';
      el.setAttribute('aria-live', 'polite');
      frame.insertBefore(el, frame.querySelector('#hud') || null);
      this.el = el;
      return el;
    },

    show(text, first, skippable = true) {
      if (this.note) this.tear();
      const el = this.ensureDom();
      const note = document.createElement('div');
      note.className = 'porch-note is-pinned';
      note.innerHTML = `<span class="porch-note__paper"></span><span class="porch-note__pin"></span>
        <p class="porch-note__text"></p><p class="porch-note__sign">— A.</p>
        ${skippable ? '<p class="porch-note__skip">Tab: skip the notes</p>' : ''}`;
      note.querySelector('.porch-note__text').textContent = text;
      el.appendChild(note);
      this.note = note;
      void first;
    },

    tear() {
      const note = this.note;
      if (!note) return;
      this.note = null;
      note.classList.remove('is-pinned');
      note.classList.add('is-torn');
      // A scrap of paper stays under the pin for a moment.
      const scrap = document.createElement('div');
      scrap.className = 'porch-scrap';
      scrap.innerHTML = '<span class="porch-scrap__paper"></span><span class="porch-scrap__pin"></span>';
      note.parentNode?.appendChild(scrap);
      setTimeout(() => note.remove(), 900);
      setTimeout(() => scrap.remove(), 2600);
      if (this.world) this.world.sfx('rip', 0.25);
    },

    removeDom() {
      if (this.el) this.el.remove();
      this.el = null;
      this.note = null;
      this.lastTimer = 0;
    },
  };

  // ── Room hooks ────────────────────────────────────────────────────────

  function onStart(world, info = {}) {
    porch.world = world;
    porch.swing = { offset: 0, age: 99, dir: 1 };
    swingPlatform.x0 = SWING.x0 + 20;
    swingPlatform.x1 = SWING.x1 - 20;
    tutorial.reset();
    tutorial.world = world;

    world.on('land', ({ platform }) => {
      if (platform === swingPlatform) kickSwing(world.hero.vx);
      tutorial.event('land', platform);
    });
    for (const name of ['kill', 'tear', 'stomp', 'hatch']) world.on(name, (payload) => tutorial.event(name, payload));
    world.on('key', ({ code, event }) => {
      if (code !== 'Tab' || !tutorial.active || world.state !== 'playing') return;
      event.preventDefault(); // keep the focus on the game
      tutorial.skip();
    });

    // QA stages its own states; the tutorial state starts the notes itself.
    if (info.qa) return;
    // Someone who has cleaned the porch before does not need the notes again.
    if (world.progress.isCleared('front-porch')) return;
    tutorial.begin(world);
  }

  function direct(dt, world) {
    return tutorial.update(dt, world);
  }

  function onLeave() {
    tutorial.reset();
  }

  // ── QA staging (ART-DIRECTION.md §15) ─────────────────────────────────

  const qa = {
    heroX: { dirty: 760, makeover: 720, clean: 720 },
    action: {
      heroX: 820,
      strings: [
        { x: 680, targetY: 470 },
        { x: 1300, targetY: 540 },
      ],
      crawlers: [], // none on the porch
      eggs: [{ x: 1240, y: 600 }],
      hatchlings: [{ x: 1180, seed: 77 }],
      tear: { webs: 2, path: [140, 460, 430, 150] }, // a dart has already ripped the left corner
      kills: 4,
      score: 2840,
      nerve: 72,
      aimAt: { x: 680, y: 470 },
    },
    // Read-only view for play tests (rooms/front-porch/playtest.mjs).
    peek() {
      const w = porch.world;
      const h = w && w.hero;
      const sp = tutorial.spider;
      return {
        state: w ? w.state : null,
        active: tutorial.active,
        step: tutorial.step,
        note: tutorial.note ? tutorial.note.querySelector('.porch-note__text').textContent : null,
        notesOnPost: document.querySelectorAll('.porch-note:not(.is-torn)').length,
        hero: h ? { x: h.x, y: h.y, onGround: h.onGround, on: h.standingOn ? h.standingOn.name : null, nerve: h.nerve } : null,
        spider: sp && sp.alive ? { x: sp.rig.x, y: sp.rig.y, anchorX: sp.anchorX, state: sp.state } : null,
        brood: tutorial.brood.filter((b) => b.alive).map((b) => ({ x: b.rig.x, y: b.rig.y })),
        egg: tutorial.egg && tutorial.egg.alive ? { x: tutorial.egg.x, y: tutorial.egg.y, mode: tutorial.egg.mode } : null,
        lastHow: tutorial.lastHow || null,
        swingOffset: porch.swing.offset,
        swingX0: swingPlatform.x0,
        critters: w ? w.critters.filter((c) => c.alive).length : 0,
      };
    },
    states: {
      // Note 3 up, a spider hovering over the swing, the hero on the swing aiming at it.
      tutorial(api) {
        const hero = api.hero;
        api.setState('playing');
        api.holdDirector();
        api.placeHero(470, 'swing');
        hero.facing = 1;
        tutorial.begin(api.world, 2, { hover: true });
        api.step(0.8);
        const spider = tutorial.spider;
        api.aimAt(spider.rig.x, spider.rig.y);
        api.step(0.3);
      },
    },
  };

  S.rooms.register({
    id: 'front-porch',
    number: 1,
    act: 1,
    name: 'Front Porch',
    css: 'rooms/front-porch/room.css',
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
    storyObject: 'The name above the door: Ashworth.',
    qa,
    onStart,
    onUpdate,
    direct,
    onLeave,
  });
})();
