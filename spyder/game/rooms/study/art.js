/*
 * Spyder — Room 10, the Study / Library: painting, light and glow.
 *
 * The logic is in room.js (layout, the rolling ladder, the three diary
 * pages hidden behind webs, the beats). This file paints, and reads what
 * room.js keeps on `live` (`ladderX`, `pages`) and the makeover values on
 * `mk` (`lamp`, `globe`, `globeSpin`, `reading`, `books`).
 *
 * The grandfather's study turned family library: bookcases floor to
 * ceiling in two tiers, a gallery walkway between them, a ladder that rolls
 * on a brass rail, a partner's desk under a green banker's lamp, a globe, a
 * leather armchair by a leaded window. The quietest room in the house.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const { paintShape, rectPoints, roundedRectPoints, ellipsePoints, softShadow, stain } = S.paint;

  // ── Layout (must match room.js) ───────────────────────────────────────

  const CEILING = 100;
  const FLOOR_LINE = 770;
  const CASES = { x0: 120, x1: 1500 };
  const UPPER = { top: 110, bottom: 548 };
  const GALLERY = { y: 560, slab: 30, rail: 500 };
  const LOWER = { top: 594, bottom: 850 };
  const DOOR = { x0: 1390, x1: 1500 }; // the gap in the lower tier
  const RAIL = { y: 230, x0: 160, x1: 1460 };
  const LADDER = { w: 70, rungs: [810, 685, 560, 435, 310], foot: 935 };
  const WINDOW = { x: 1560, y: 200, w: 260, h: 400 };
  const DESK = { x0: 760, x1: 1160, top: 770, base: 930 };
  const LAMP = { x: 1090, y: 708 }; // the green shade's centre
  const GLOBE = { x: 1310, y: 712, r: 54, base: 860 };
  const CHAIR = { x0: 1560, x1: 1780, seat: 800, back: 640, base: 930 };
  const READING = { x: 1818, shade: 600 };
  const DIARY = { x: 960, y: 724 };
  const LIGHT_DIR = { x: 0.3, y: -0.95 };

  const TONE = {
    oak: S.mixHex(P.walnut, P.oak, 0.35),
    oakDark: S.mixHex(P.walnut, P.umber, 0.35),
    leather: S.mixHex(P.rust, P.walnut, 0.45),
    green: S.mixHex(P.moss, P.moon, 0.18),
    panel: S.mixHex(P.moss, P.walnut, 0.55),
    spines: [P.rust, P.moss, P.plum, P.walnut, P.oak, S.mixHex(P.moon, P.umber, 0.4), S.mixHex(P.linen, P.oak, 0.5), S.mixHex(P.rust, P.ember, 0.3), S.mixHex(P.moss, P.umber, 0.4)],
  };

  const aged = (hex, clean, k = 1) => (clean ? hex : S.mixHex(S.shadeHex(hex, -0.2 * k), P.taupe, 0.2 * k));

  // The books that fell, drawn live so they can slide back at `books`:
  // where each lies on the floor, and the gap on a shelf it goes back to.
  const FALLEN = [
    { floor: [560, 958, 0.08], shelf: [262, 846], w: 18, h: 62, hue: 0 },
    { floor: [604, 968, -0.2], shelf: [690, 846], w: 22, h: 58, hue: 2 },
    { floor: [1210, 960, 0.15], shelf: [1022, 761], w: 16, h: 66, hue: 5 },
    { floor: [1236, 976, 1.4], shelf: [520, 761], w: 20, h: 60, hue: 1 },
    { floor: [330, 970, -1.5], shelf: [1180, 846], w: 24, h: 56, hue: 7 },
  ];

  // ── Back layer ────────────────────────────────────────────────────────

  function paintBack(g, clean) {
    paintWalls(g, clean);
    paintCeiling(g, clean);
    paintWindowFrame(g, clean);
    paintFloor(g, clean);
    paintRug(g, clean);
    paintCase(g, UPPER.top, UPPER.bottom, [190, 278, 366, 454, 542], clean, 13010);
    paintCase(g, LOWER.top, LOWER.bottom, [676, 761, 846], clean, 13020);
    paintDoor(g, clean);
  }

  // Dark green panelling where there are no books: the right wall round
  // the window and the strip at the left.
  function paintWalls(g, clean) {
    paintShape(g, rectPoints(0, CEILING, 1920, FLOOR_LINE - CEILING + 4), {
      color: aged(TONE.panel, clean),
      lightDir: LIGHT_DIR,
      light: 0.12,
      shadow: 0.35,
      strokes: 8,
      strokeAngle: Math.PI / 2,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 13001,
    });
    // Raised panels on the right wall, under the window and beside it.
    for (const [x, y, w, h] of [[1530, 640, 310, 110], [1846, 140, 60, 600], [16, 140, 90, 600]]) {
      g.strokeStyle = S.rgba(P.soot, 0.45);
      g.lineWidth = 3;
      g.strokeRect(x, y, w, h);
      g.strokeStyle = S.rgba(P.linen, 0.1);
      g.lineWidth = 1.5;
      g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    }
    // A dado rail and a skirting.
    g.fillStyle = aged(TONE.oakDark, clean);
    g.fillRect(CASES.x1, 620, 1920 - CASES.x1, 10);
    g.fillRect(0, FLOOR_LINE - 30, 1920, 32);
    if (!clean) stain(g, 1700, 690, 80, P.oak, 13002, 0.25);
  }

  function paintCeiling(g, clean) {
    paintShape(g, rectPoints(0, 0, 1920, CEILING + 4), {
      color: clean ? S.mixHex(P.linen, P.taupe, 0.5) : S.mixHex(P.umber, P.taupe, 0.2),
      lightDir: { x: 0, y: 1 },
      light: 0.15,
      shadow: 0.45,
      strokes: 6,
      rim: 0,
      wobble: 0,
      seed: 13003,
    });
    // Beams running across, each with a lit underside and a shadow.
    for (let x = 60; x < 1920; x += 300) {
      paintShape(g, rectPoints(x, 0, 46, CEILING + 2), {
        color: aged(TONE.oakDark, clean),
        lightDir: { x: 0, y: 1 },
        light: 0.25,
        shadow: 0.45,
        strokes: 4,
        strokeAngle: Math.PI / 2,
        rim: 0.2,
        wobble: 0.2,
        seed: 13004 + x,
      });
    }
    g.fillStyle = aged(TONE.oakDark, clean);
    g.fillRect(0, CEILING - 8, 1920, 10);
    if (!clean) stain(g, 820, 40, 90, P.oak, 13005, 0.3);
  }

  // A bookcase tier: carved uprights in bays, shelf boards, and books — of
  // every height, thickness and colour, gold tooling on the spines, some
  // leaning, some laid flat, a bust or a clock here and there. Dirty: dust
  // on every top edge and gaps where books fell.
  function paintCase(g, top, bottom, shelves, clean, seed) {
    const { x0, x1 } = CASES;
    const rng = S.createRng(seed);
    // The back of the case, dark.
    g.fillStyle = aged(S.mixHex(P.umber, P.walnut, 0.4), clean);
    g.fillRect(x0, top, x1 - x0, bottom - top);
    const bays = [x0, 396, 672, 948, 1224, x1];
    for (let si = 0; si < shelves.length; si++) {
      const sy = shelves[si];
      const prev = si === 0 ? top : shelves[si - 1] + 8;
      const roomH = sy - prev;
      for (let b = 0; b < bays.length - 1; b++) {
        const bx0 = bays[b] + 12;
        const bx1 = bays[b + 1] - 12;
        if (top === LOWER.top && bx0 >= DOOR.x0 - 12) continue;
        // Gaps kept for the fallen books, so they have somewhere to go back.
        const gaps = FALLEN.filter((f) => f.shelf[1] === sy).map((f) => [f.shelf[0] - 2, f.shelf[0] + f.w + 2]);
        let x = bx0;
        while (x < bx1 - 10) {
          const gap = gaps.find(([a, b]) => x + 26 > a && x < b);
          if (gap) {
            x = gap[1] + 1;
            continue;
          }
          const roll = rng.next();
          if (roll < 0.012 && x < bx1 - 60) {
            // An ornament: a small bust or a carriage clock.
            if (rng.next() < 0.5) paintBust(g, x + 22, sy, clean, seed + x);
            else paintClock(g, x + 20, sy, clean, seed + x);
            x += 50;
            continue;
          }
          if (roll < 0.07 && x < bx1 - 70) {
            // A stack laid flat.
            let yy = sy;
            const n = 2 + Math.floor(rng.next() * 3);
            for (let k = 0; k < n; k++) {
              const bw = rng.range(54, 70);
              const bh = rng.range(8, 13);
              book(g, x + rng.range(-3, 3), yy - bh, bw, bh, rng, clean, true);
              yy -= bh;
            }
            x += 76;
            continue;
          }
          const w = rng.range(10, 26);
          const h = Math.min(roomH - 8, rng.range(roomH * 0.6, roomH * 0.92));
          if (!clean && rng.next() < 0.06) {
            // A gap where a book fell; its neighbour leans into it.
            x += w + 4;
            continue;
          }
          if (roll > 0.94 && x + w + 14 < bx1) {
            // Leaning.
            g.save();
            g.translate(x + w, sy);
            g.rotate(-0.22);
            book(g, -w, -h, w, h, rng, clean);
            g.restore();
            x += w + 14;
            continue;
          }
          book(g, x, sy - h, w, h, rng, clean);
          x += w + rng.range(0.5, 2);
        }
      }
      // The shelf board, its lit front edge, the shadow it casts.
      g.fillStyle = aged(TONE.oak, clean);
      g.fillRect(x0, sy, x1 - x0, 9);
      g.fillStyle = S.rgba(P.linen, clean ? 0.16 : 0.1);
      g.fillRect(x0, sy, x1 - x0, 2);
      if (!clean) {
        g.fillStyle = S.rgba(P.linen, 0.22);
        g.fillRect(x0, sy - 1, x1 - x0, 2);
      }
    }
    // Uprights with a carved capital and fluting.
    for (const ux of bays) {
      const w = ux === x0 || ux === x1 ? 20 : 24;
      paintShape(g, rectPoints(ux - w / 2, top - 6, w, bottom - top + 6), {
        color: aged(TONE.oak, clean),
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.5,
        strokes: 5,
        strokeAngle: Math.PI / 2,
        rim: 0.3,
        wobble: 0.2,
        seed: seed + ux,
      });
      g.strokeStyle = S.rgba(P.soot, 0.4);
      g.lineWidth = 1.5;
      for (const fx of [-5, 0, 5]) {
        g.beginPath();
        g.moveTo(ux + fx, top + 30);
        g.lineTo(ux + fx, bottom - 30);
        g.stroke();
      }
      g.fillStyle = aged(S.shadeHex(TONE.oak, 0.1), clean);
      g.beginPath();
      g.ellipse(ux, top + 14, w * 0.7, 8, 0, 0, Math.PI * 2);
      g.fill();
    }
    // The cornice over the tier.
    paintShape(g, rectPoints(x0 - 14, top - 14, x1 - x0 + 28, 16), {
      color: aged(TONE.oak, clean),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.45,
      strokes: 3,
      rim: 0.35,
      wobble: 0.2,
      seed: seed + 9,
    });
  }

  // One book standing on a shelf (or laid flat): a spine with a rounded
  // look, gold bands, a title label.
  function book(g, x, y, w, h, rng, clean, flat = false) {
    const hue = aged(TONE.spines[Math.floor(rng.next() * TONE.spines.length)], clean, 1.1);
    const tone = S.shadeHex(hue, rng.range(-0.12, 0.08));
    const body = flat ? g.createLinearGradient(0, y, 0, y + h) : g.createLinearGradient(x, 0, x + w, 0);
    body.addColorStop(0, S.shadeHex(tone, -0.3));
    body.addColorStop(0.35, S.shadeHex(tone, 0.12));
    body.addColorStop(1, S.shadeHex(tone, -0.4));
    g.fillStyle = body;
    g.fillRect(x, y, w, h);
    const gold = S.rgba(P.brass, clean ? 0.75 : 0.45);
    g.fillStyle = gold;
    if (flat) {
      g.fillRect(x + 4, y + 1, 1.2, h - 2);
      g.fillRect(x + w - 6, y + 1, 1.2, h - 2);
    } else {
      for (const fy of [y + 6, y + 9, y + h - 9, y + h - 6]) g.fillRect(x + 1, fy, w - 2, 1);
      if (h > 40 && rng.next() < 0.6) {
        g.fillStyle = S.shadeHex(tone, -0.25);
        g.fillRect(x + 2, y + h * 0.3, w - 4, h * 0.18);
        g.fillStyle = gold;
        g.fillRect(x + 3, y + h * 0.36, w - 6, 1);
      }
    }
    if (!clean) {
      g.fillStyle = S.rgba(P.linen, 0.22);
      g.fillRect(x, y, w, 2);
    }
  }

  function paintBust(g, x, base, clean, seed) {
    const stone = aged(S.mixHex(P.linen, P.bone, 0.3), clean);
    paintShape(g, [[x - 16, base], [x + 16, base], [x + 12, base - 18], [x + 8, base - 30], [x + 9, base - 46], [x, base - 54], [x - 9, base - 46], [x - 8, base - 30], [x - 12, base - 18]], {
      color: stone,
      lightDir: LIGHT_DIR,
      light: 0.35,
      shadow: 0.5,
      strokes: 2,
      rim: 0.4,
      wobble: 0.5,
      seed,
    });
  }

  function paintClock(g, x, base, clean, seed) {
    paintShape(g, roundedRectPoints(x - 16, base - 40, 32, 40, 8), {
      color: aged(P.brass, clean),
      lightDir: LIGHT_DIR,
      light: 0.4,
      shadow: 0.45,
      strokes: 2,
      rim: 0.45,
      wobble: 0.2,
      seed,
    });
    g.fillStyle = S.mixHex(P.bone, P.linen, 0.3);
    g.beginPath();
    g.arc(x, base - 22, 10, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = P.soot;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x, base - 22);
    g.lineTo(x, base - 29);
    g.moveTo(x, base - 22);
    g.lineTo(x + 5, base - 20);
    g.stroke();
  }

  // The doorway in the lower tier: a dark landing beyond, the door ajar.
  function paintDoor(g, clean) {
    const { x0, x1 } = DOOR;
    const top = LOWER.top + 20;
    g.fillStyle = S.mixHex(P.soot, P.umber, 0.4);
    g.fillRect(x0, top, x1 - x0, LOWER.bottom - top);
    paintShape(g, [[x0 + 4, top + 4], [x0 + 46, top - 4], [x0 + 46, LOWER.bottom + 8], [x0 + 4, LOWER.bottom]], {
      color: aged(TONE.oak, clean),
      lightDir: LIGHT_DIR,
      light: 0.25,
      shadow: 0.45,
      strokes: 5,
      strokeAngle: Math.PI / 2,
      rim: 0.3,
      wobble: 0.3,
      seed: 13030,
    });
    g.fillStyle = aged(P.brass, clean);
    g.beginPath();
    g.arc(x0 + 38, 720, 4, 0, Math.PI * 2);
    g.fill();
  }

  // The leaded window: a deep stone reveal and diamond panes in lead
  // cames. The glass is cut out of the layer so drawSky shows through,
  // then given a faint tint; one pane is cracked when dirty.
  function paintWindowFrame(g, clean) {
    const { x, y, w, h } = WINDOW;
    paintShape(g, rectPoints(x - 22, y - 22, w + 44, h + 44), {
      color: aged(S.mixHex(P.taupe, P.linen, 0.3), clean),
      lightDir: LIGHT_DIR,
      light: 0.22,
      shadow: 0.45,
      strokes: 5,
      rim: 0.3,
      wobble: 0.5,
      seed: 13040,
    });
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(x, y, w, h);
    g.restore();
    g.fillStyle = S.rgba(P.moon, 0.06);
    g.fillRect(x, y, w, h);
    // Lead cames: a diamond lattice.
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.strokeStyle = S.mixHex(P.soot, P.gear, 0.3);
    g.lineWidth = 3;
    const d = 40;
    for (let k = -h; k < w + h; k += d) {
      g.beginPath();
      g.moveTo(x + k, y);
      g.lineTo(x + k + h * 0.6, y + h);
      g.stroke();
      g.beginPath();
      g.moveTo(x + k, y);
      g.lineTo(x + k - h * 0.6, y + h);
      g.stroke();
    }
    if (!clean) {
      g.strokeStyle = S.rgba(P.bone, 0.55);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 150, y + 120);
      g.lineTo(x + 168, y + 140);
      g.lineTo(x + 160, y + 158);
      g.moveTo(x + 168, y + 140);
      g.lineTo(x + 186, y + 146);
      g.stroke();
    }
    g.restore();
    // Mullion and transom in stone, and a deep sill.
    g.fillStyle = aged(S.mixHex(P.taupe, P.linen, 0.25), clean);
    g.fillRect(x + w / 2 - 6, y, 12, h);
    g.fillRect(x, y + 130, w, 12);
    paintShape(g, rectPoints(x - 30, y + h + 16, w + 60, 18), {
      color: aged(S.mixHex(P.taupe, P.linen, 0.35), clean),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.45,
      strokes: 2,
      rim: 0.35,
      wobble: 0.3,
      seed: 13041,
    });
  }

  function paintFloor(g, clean) {
    const vp = { x: 960, y: -900 };
    const top = FLOOR_LINE;
    const bottom = 1080;
    const base = clean ? S.mixHex(P.oak, P.walnut, 0.4) : S.mixHex(P.walnut, P.oak, 0.3);
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
      seed: 13050,
    });
    const xAt = (xb, y) => vp.x + (xb - vp.x) * ((y - vp.y) / (bottom - vp.y));
    const rng = S.createRng(13051);
    for (let xb = -300; xb < 2300; xb += 96) {
      g.fillStyle = S.rgba(S.shadeHex(base, rng.range(-0.12, 0.08)), 0.4);
      g.beginPath();
      g.moveTo(xAt(xb, top), top);
      g.lineTo(xAt(xb + 96, top), top);
      g.lineTo(xb + 96, bottom);
      g.lineTo(xb, bottom);
      g.closePath();
      g.fill();
      g.strokeStyle = S.rgba(P.soot, 0.55);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(xAt(xb, top), top);
      g.lineTo(xb, bottom);
      g.stroke();
    }
    const fall = g.createRadialGradient(960, 900, 200, 960, 940, 1150);
    fall.addColorStop(0, 'rgba(0,0,0,0)');
    fall.addColorStop(1, S.rgba(P.soot, clean ? 0.32 : 0.5));
    g.fillStyle = fall;
    g.fillRect(0, top, 1920, bottom - top);
  }

  // A worn Persian rug: a field of deep red, a border of repeating motifs,
  // a central medallion, threadbare patches.
  function paintRug(g, clean) {
    const pts = [[600, 948], [1360, 948], [1420, 1048], [540, 1048]];
    softShadow(g, 980, 1000, 460, 56, 0.4);
    paintShape(g, pts, {
      color: aged(S.mixHex(P.rust, P.plum, 0.35), clean, 1.2),
      lightDir: { x: 0, y: -1 },
      light: 0.12,
      shadow: 0.3,
      strokes: 30,
      strokeSize: 0.5,
      variance: 0.15,
      rim: 0,
      innerShadow: 0.2,
      wobble: 0.6,
      seed: 13060,
    });
    const inset = (k) => [[600 + 30 * k, 948 + 8 * k], [1360 - 30 * k, 948 + 8 * k], [1420 - 36 * k, 1048 - 8 * k], [540 + 36 * k, 1048 - 8 * k]];
    for (const [k, hex, wd] of [[1, P.linen, 3], [2.2, P.moss, 6], [3.2, P.linen, 2]]) {
      const q = inset(k);
      g.strokeStyle = S.rgba(aged(hex, clean), 0.55);
      g.lineWidth = wd;
      g.beginPath();
      g.moveTo(q[0][0], q[0][1]);
      for (const p of q.slice(1)) g.lineTo(p[0], p[1]);
      g.closePath();
      g.stroke();
    }
    g.fillStyle = S.rgba(aged(P.moss, clean), 0.5);
    g.beginPath();
    g.ellipse(980, 998, 120, 22, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.rgba(aged(P.dawn, clean), 0.45);
    g.beginPath();
    g.ellipse(980, 998, 50, 9, 0, 0, Math.PI * 2);
    g.fill();
    // Threadbare where feet went, more so when dirty.
    for (const [x, y, r] of [[860, 990, 50], [1120, 1010, 40]]) {
      g.fillStyle = S.rgba(P.taupe, clean ? 0.15 : 0.3);
      g.beginPath();
      g.ellipse(x, y, r, r * 0.25, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // ── Furniture layer ───────────────────────────────────────────────────

  function paintFurniture(g, clean) {
    paintGallery(g, clean);
    paintRail(g, clean);
    paintGlobeStand(g, clean);
    paintDesk(g, clean);
    paintChair(g, clean);
  }

  // The gallery walkway: an oak slab with a moulded fascia, turned brass
  // balusters and a brass handrail that catches the lamp light.
  function paintGallery(g, clean) {
    const { x0, x1 } = CASES;
    const { y, slab, rail } = GALLERY;
    softShadow(g, (x0 + x1) / 2, y + slab + 10, (x1 - x0) * 0.5, 12, 0.5);
    paintShape(g, rectPoints(x0 - 10, y, x1 - x0 + 20, slab), {
      color: aged(TONE.oak, clean),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.5,
      strokes: 6,
      strokeAngle: 0,
      rim: 0.35,
      wobble: 0.2,
      seed: 13070,
    });
    g.strokeStyle = S.rgba(P.soot, 0.45);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0 - 10, y + 10);
    g.lineTo(x1 + 10, y + 10);
    g.stroke();
    const brass = aged(P.brass, clean, 1.2);
    for (let x = x0 + 6; x <= x1; x += 30) {
      const bal = g.createLinearGradient(x - 3, 0, x + 3, 0);
      bal.addColorStop(0, S.shadeHex(brass, -0.3));
      bal.addColorStop(0.4, S.shadeHex(brass, 0.35));
      bal.addColorStop(1, S.shadeHex(brass, -0.4));
      g.fillStyle = bal;
      g.fillRect(x - 2, rail, 4, y - rail);
      g.beginPath();
      g.ellipse(x, rail + 22, 4.5, 6, 0, 0, Math.PI * 2);
      g.ellipse(x, y - 8, 4, 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    const hand = g.createLinearGradient(0, rail - 6, 0, rail + 6);
    hand.addColorStop(0, S.shadeHex(brass, 0.45));
    hand.addColorStop(0.5, brass);
    hand.addColorStop(1, S.shadeHex(brass, -0.45));
    g.fillStyle = hand;
    g.fillRect(x0 - 6, rail - 5, x1 - x0 + 12, 10);
  }

  // The brass rail the ladder rolls on, on brackets along the upper tier.
  function paintRail(g, clean) {
    const brass = aged(P.brass, clean, 1.2);
    const rod = g.createLinearGradient(0, RAIL.y - 5, 0, RAIL.y + 5);
    rod.addColorStop(0, S.shadeHex(brass, 0.45));
    rod.addColorStop(1, S.shadeHex(brass, -0.4));
    g.fillStyle = rod;
    g.fillRect(RAIL.x0, RAIL.y - 4, RAIL.x1 - RAIL.x0, 8);
    for (let x = RAIL.x0 + 10; x <= RAIL.x1; x += 260) {
      g.fillStyle = S.shadeHex(brass, -0.25);
      g.fillRect(x - 3, RAIL.y - 4, 6, 14);
    }
  }

  // The globe's stand: a tripod of turned legs, a brass meridian. The
  // globe itself is drawn live (it lights and spins).
  function paintGlobeStand(g, clean) {
    const { x, y, r, base } = GLOBE;
    softShadow(g, x, base + 4, 60, 8, 0.5);
    const wood = aged(TONE.oak, clean);
    for (const [dx, sp] of [[-42, -0.25], [0, 0], [42, 0.25]]) {
      g.save();
      g.translate(x + dx, base);
      g.rotate(sp);
      paintShape(g, rectPoints(-4, -130, 8, 130), {
        color: wood,
        lightDir: LIGHT_DIR,
        light: 0.3,
        shadow: 0.45,
        strokes: 2,
        rim: 0.35,
        wobble: 0.2,
        seed: 13080 + dx,
      });
      g.restore();
    }
    paintShape(g, ellipsePoints(x, y + r + 16, 44, 9, 24), {
      color: wood,
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.45,
      strokes: 2,
      rim: 0.4,
      wobble: 0.2,
      seed: 13083,
    });
  }

  // The partner's desk: a leather-topped slab on two drawer pedestals, and
  // what is on it — inkwell and pen, a magnifying glass, letters, the
  // cleaner's notebook. The lamp, the diary and its stand are drawn here
  // too; their light and the open pages are live.
  function paintDesk(g, clean) {
    const { x0, x1, top, base } = DESK;
    softShadow(g, (x0 + x1) / 2, base, (x1 - x0) * 0.56, 14, 0.6);
    for (const [px, w] of [[x0 + 10, 120], [x1 - 130, 120]]) {
      paintShape(g, rectPoints(px, top + 14, w, base - top - 14), {
        color: aged(TONE.oak, clean),
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.45,
        strokes: 6,
        strokeAngle: Math.PI / 2,
        rim: 0.3,
        wobble: 0.3,
        seed: 13090 + px,
      });
      for (let i = 0; i < 3; i++) {
        const dy = top + 26 + i * 44;
        g.strokeStyle = S.rgba(P.soot, 0.5);
        g.lineWidth = 2;
        g.strokeRect(px + 10, dy, w - 20, 38);
        g.fillStyle = aged(P.brass, clean);
        g.fillRect(px + w / 2 - 9, dy + 17, 18, 4);
      }
    }
    g.fillStyle = S.rgba(P.soot, 0.65);
    g.fillRect(x0 + 130, top + 14, x1 - x0 - 260, 40);
    // The top: oak edge, a green leather inset with gold tooling.
    paintShape(g, rectPoints(x0 - 8, top - 2, x1 - x0 + 16, 18), {
      color: aged(TONE.oak, clean),
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.45,
      strokes: 4,
      strokeAngle: 0,
      rim: 0.4,
      wobble: 0.2,
      seed: 13093,
    });
    g.fillStyle = aged(S.mixHex(P.moss, P.umber, 0.25), clean);
    g.fillRect(x0 + 10, top - 4, x1 - x0 - 20, 6);
    g.fillStyle = S.rgba(P.brass, 0.5);
    g.fillRect(x0 + 14, top - 3, x1 - x0 - 28, 1);
    const t = top - 4;
    // Inkwell and a pen in a stand.
    g.fillStyle = S.mixHex(P.soot, P.moon, 0.25);
    g.beginPath();
    g.ellipse(800, t - 10, 13, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = aged(P.brass, clean);
    g.fillRect(794, t - 22, 12, 5);
    g.strokeStyle = S.mixHex(P.soot, P.plum, 0.3);
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(820, t);
    g.lineTo(842, t - 40);
    g.stroke();
    // A magnifying glass.
    g.strokeStyle = aged(P.brass, clean);
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(1150, t - 3, 16, 4, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = aged(TONE.oakDark, clean);
    g.fillRect(1120, t - 4, 16, 4);
    // Letters: scattered when dirty, a tidy stack tied with string clean.
    if (clean) {
      for (let i = 0; i < 4; i++) {
        g.fillStyle = S.mixHex(P.bone, P.linen, 0.3 + i * 0.1);
        g.fillRect(1010 + i, t - 4 - i * 3, 50, 3);
      }
      g.fillStyle = S.rgba(P.rust, 0.8);
      g.fillRect(1032, t - 16, 3, 13);
    } else {
      const rng = S.createRng(13094);
      for (let i = 0; i < 5; i++) {
        g.save();
        g.translate(1000 + rng.range(-30, 60), t - 2);
        g.rotate(rng.range(-0.3, 0.3));
        g.fillStyle = S.mixHex(P.linen, P.taupe, rng.range(0.2, 0.5));
        g.fillRect(-22, -2, 44, 3);
        g.restore();
      }
      // One more on the floor by the desk.
      g.save();
      g.translate(1210, 935);
      g.rotate(0.2);
      g.fillStyle = S.mixHex(P.linen, P.taupe, 0.3);
      g.fillRect(-24, -10, 48, 20);
      g.restore();
    }
    paintNotebook(g, clean, t);
    paintDiaryStand(g, clean, t);
    paintBankersLamp(g, clean, t);
    if (!clean) {
      g.fillStyle = S.rgba(P.linen, 0.18);
      g.fillRect(x0 - 8, top - 4, x1 - x0 + 16, 4);
    }
  }

  // The previous cleaner's notebook: open, a pencil map of the house with
  // the Attic circled three times. Clean: shut, the pencil laid on top.
  function paintNotebook(g, clean, t) {
    const x = 880;
    if (clean) {
      g.fillStyle = S.mixHex(P.moss, P.gear, 0.4);
      g.fillRect(x - 32, t - 6, 64, 6);
      g.fillStyle = S.mixHex(P.dawn, P.oak, 0.5);
      g.fillRect(x - 24, t - 9, 48, 3);
      return;
    }
    // Open, propped a little so the page can be seen.
    g.save();
    g.translate(x, t);
    g.transform(1, 0, -0.35, 0.55, 0, 0);
    g.fillStyle = S.mixHex(P.bone, P.linen, 0.25);
    g.fillRect(-46, -48, 44, 46);
    g.fillRect(2, -48, 44, 46);
    g.strokeStyle = S.rgba(P.soot, 0.6);
    g.lineWidth = 1.2;
    // The house plan: three floors of boxes, the attic on top, circled.
    g.strokeRect(-40, -34, 32, 10);
    g.strokeRect(-40, -24, 32, 10);
    g.strokeRect(-40, -14, 32, 10);
    g.beginPath();
    g.moveTo(-42, -34);
    g.lineTo(-24, -44);
    g.lineTo(-6, -34);
    g.stroke();
    g.strokeStyle = S.rgba(P.rust, 0.85);
    for (const r of [8, 10, 12]) {
      g.beginPath();
      g.ellipse(-24, -38, r * 1.6, r * 0.7, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = S.rgba(P.soot, 0.4);
    for (let i = 0; i < 5; i++) g.fillRect(8, -42 + i * 8, 30 - (i % 2) * 8, 1.2);
    g.restore();
  }

  // A small reading stand holding Eleanor's diary up toward us, so its page
  // can be read. The pages themselves are drawn live (closed and dusty when
  // dirty, open once clean).
  function paintDiaryStand(g, clean, t) {
    const { x } = DIARY;
    g.fillStyle = aged(TONE.oakDark, clean);
    g.beginPath();
    g.moveTo(x - 60, t);
    g.lineTo(x + 60, t);
    g.lineTo(x + 50, t - 10);
    g.lineTo(x - 50, t - 10);
    g.closePath();
    g.fill();
    g.fillRect(x - 3, t - 34, 6, 26);
  }

  // The green banker's lamp: a brass base and arm, a cased green glass
  // shade. The glass is painted here; its glow and light are live.
  function paintBankersLamp(g, clean, t) {
    const { x, y } = LAMP;
    const brass = aged(P.brass, clean);
    g.fillStyle = brass;
    g.beginPath();
    g.ellipse(x, t - 4, 26, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x - 3, y + 8, 6, t - y - 12);
    g.fillRect(x - 3, y + 20, 30, 3);
    g.fillRect(x + 24, y + 20, 2, 18);
    g.beginPath();
    g.arc(x + 25, y + 40, 3, 0, Math.PI * 2);
    g.fill();
    const shade = [[x - 46, y + 12], [x + 46, y + 12], [x + 40, y - 8], [x + 30, y - 16], [x - 30, y - 16], [x - 40, y - 8]];
    paintShape(g, shade, {
      color: aged(S.mixHex(P.moss, P.moon, 0.25), clean, 0.8),
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.5,
      strokes: 3,
      rim: 0.5,
      wobble: 0.3,
      seed: 13100,
    });
    g.fillStyle = S.rgba(P.bone, 0.35);
    g.fillRect(x - 30, y - 12, 50, 2);
    g.fillStyle = brass;
    g.fillRect(x - 47, y + 10, 94, 3);
  }

  // The armchair: cracked, tufted brown leather. Dirty: under a dust sheet.
  // The reading lamp beside it is a standard lamp with a fabric shade.
  function paintChair(g, clean) {
    const { x0, x1, seat, back, base } = CHAIR;
    softShadow(g, (x0 + x1) / 2, base, (x1 - x0) * 0.6, 14, 0.55);
    const leather = aged(TONE.leather, clean, 0.7);
    paintShape(g, [[x0 + 20, seat], [x0 + 30, back + 20], [x0 + 60, back], [x1 - 60, back], [x1 - 30, back + 20], [x1 - 20, seat]], {
      color: leather,
      lightDir: LIGHT_DIR,
      light: 0.3,
      shadow: 0.5,
      strokes: 6,
      rim: 0.35,
      wobble: 1,
      seed: 13110,
    });
    // Buttons and the creases between them.
    g.fillStyle = S.rgba(P.soot, 0.45);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const bx = x0 + 62 + c * 24 + (r % 2) * 12;
        const by = back + 34 + r * 36;
        g.beginPath();
        g.arc(bx, by, 2.5, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.strokeStyle = S.rgba(P.linen, 0.15);
    g.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(x0 + 70 + i * 18, back + 40);
      g.lineTo(x0 + 80 + i * 16, back + 110);
      g.stroke();
    }
    // Seat cushion and the rolled arms.
    paintShape(g, roundedRectPoints(x0 + 18, seat - 18, x1 - x0 - 36, 30, 12), {
      color: S.shadeHex(leather, 0.08),
      lightDir: { x: 0, y: -1 },
      light: 0.35,
      shadow: 0.45,
      strokes: 4,
      rim: 0.4,
      wobble: 0.6,
      seed: 13111,
    });
    for (const ax of [x0, x1 - 40]) {
      paintShape(g, roundedRectPoints(ax, seat - 50, 40, base - seat + 46, 18), {
        color: leather,
        lightDir: LIGHT_DIR,
        light: 0.3,
        shadow: 0.5,
        strokes: 4,
        rim: 0.35,
        wobble: 0.6,
        seed: 13112 + ax,
      });
    }
    paintShape(g, rectPoints(x0 + 20, seat + 10, x1 - x0 - 40, base - seat - 26), {
      color: S.shadeHex(leather, -0.15),
      light: 0.2,
      shadow: 0.45,
      strokes: 3,
      rim: 0.2,
      wobble: 0.4,
      seed: 13114,
    });
    // Cracks in the leather.
    g.strokeStyle = S.rgba(P.linen, clean ? 0.18 : 0.28);
    g.lineWidth = 1;
    for (const [ax, ay] of [[x0 + 12, seat - 30], [x1 - 22, seat - 16], [x0 + 90, back + 20]]) {
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(ax + 6, ay + 8);
      g.lineTo(ax + 2, ay + 16);
      g.stroke();
    }
    if (!clean) {
      // The dust sheet over it.
      paintShape(g, [[x0 - 6, base], [x0 + 6, seat - 60], [x0 + 50, back - 6], [x1 - 50, back - 8], [x1 - 4, seat - 50], [x1 + 8, base], [x1 - 60, base - 8], [x0 + 60, base - 4]], {
        color: S.mixHex(P.linen, P.taupe, 0.45),
        lightDir: LIGHT_DIR,
        light: 0.25,
        shadow: 0.45,
        strokes: 10,
        strokeAngle: Math.PI / 2,
        rim: 0.3,
        wobble: 3,
        seed: 13115,
      });
      g.strokeStyle = S.rgba(P.soot, 0.2);
      g.lineWidth = 4;
      for (const fx of [x0 + 40, x0 + 100, x1 - 60]) {
        g.beginPath();
        g.moveTo(fx, back + 10);
        g.quadraticCurveTo(fx + 10, seat - 20, fx - 6, base - 10);
        g.stroke();
      }
    }
    // The standard lamp.
    const lx = READING.x;
    g.fillStyle = aged(P.brass, clean);
    g.fillRect(lx - 2, READING.shade + 44, 4, base - READING.shade - 44);
    g.beginPath();
    g.ellipse(lx, base - 2, 20, 5, 0, 0, Math.PI * 2);
    g.fill();
    paintShape(g, [[lx - 26, READING.shade + 46], [lx + 26, READING.shade + 46], [lx + 18, READING.shade], [lx - 18, READING.shade]], {
      color: aged(S.mixHex(P.linen, P.dawn, 0.2), clean, 1.2),
      lightDir: { x: 0, y: 1 },
      light: 0.2,
      shadow: 0.3,
      strokes: 3,
      rim: 0.2,
      wobble: 0.5,
      seed: 13116,
    });
  }

  // ── Front layer ───────────────────────────────────────────────────────

  function paintFront(g, clean) {
    g.save();
    g.filter = 'blur(7px)';
    // A wing of a second chair, bottom left, and a tall plant, right.
    paintShape(g, [[-20, 1080], [-10, 900], [90, 880], [150, 1080]], {
      color: S.mixHex(TONE.leather, P.soot, 0.45),
      light: 0.1,
      shadow: 0.4,
      strokes: 6,
      rim: 0.2,
      wobble: 2,
      seed: 13120,
    });
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.4;
      g.strokeStyle = S.mixHex(P.moss, P.soot, clean ? 0.35 : 0.5);
      g.lineWidth = 14;
      g.beginPath();
      g.moveTo(1880, 1080);
      g.quadraticCurveTo(1880 + Math.cos(a) * 60, 1000 + Math.sin(a) * 60, 1880 + Math.cos(a) * 130, 960 + Math.sin(a) * 90);
      g.stroke();
    }
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
      // The logic's starting values (room.js keeps them up to date).
      ladderX: 400,
      pages: [],
      noise: S.createNoise(seed || 13),
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

  // Through the leaded window: a garden at night, a moon, then dawn.
  function drawSky(g, live, t, mk) {
    const { x, y, w, h } = WINDOW;
    const day = mk.window;
    const sky = g.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, S.mix(S.moods.dirty.windowSkyTop, S.moods.clean.windowSkyTop, day));
    sky.addColorStop(1, S.mix(S.moods.dirty.windowSkyBottom, S.moods.clean.windowSkyBottom, day));
    g.fillStyle = sky;
    g.fillRect(x - 4, y - 4, w + 8, h + 8);
    if (day < 1) {
      g.fillStyle = `rgba(236,240,248,${1 - day})`;
      g.beginPath();
      g.arc(x + w * 0.72, y + 80 + day * 160, 22, 0, Math.PI * 2);
      g.fill();
    }
    if (day > 0) {
      const sun = g.createRadialGradient(x + w * 0.4, y + h + 20 - day * 140, 6, x + w * 0.4, y + h - day * 140, 200);
      sun.addColorStop(0, `rgba(255,236,190,${day})`);
      sun.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = sun;
      g.fillRect(x, y, w, h);
    }
    // A cedar's dark mass and the garden wall.
    g.fillStyle = S.mix('#0A0D11', '#46524A', day);
    g.beginPath();
    g.moveTo(x - 4, y + h + 4);
    g.lineTo(x - 4, y + h * 0.5);
    for (let i = 0; i <= 6; i++) g.lineTo(x + i * 20, y + h * 0.5 - (i % 2 ? 40 : 10) - i * 6);
    g.lineTo(x + 140, y + h * 0.82);
    g.lineTo(x + w + 4, y + h * 0.82);
    g.lineTo(x + w + 4, y + h + 4);
    g.closePath();
    g.fill();
    void live;
    void t;
  }

  // The three diary pages: while hidden, a pale corner shows behind each
  // covering web (a hint); once free they flutter down, glinting softly.
  function pageSprite(live) {
    return sprite(live, 'page', 40, 50, (g) => {
      g.fillStyle = S.mixHex(P.bone, P.linen, 0.3);
      g.beginPath();
      g.moveTo(3, 3);
      g.lineTo(37, 2);
      g.lineTo(36, 18);
      g.lineTo(38, 26);
      g.lineTo(35, 47);
      g.lineTo(4, 46);
      g.lineTo(2, 30);
      g.lineTo(4, 22);
      g.closePath();
      g.fill();
      g.strokeStyle = S.rgba(P.oak, 0.5);
      g.lineWidth = 1;
      g.stroke();
      g.strokeStyle = S.rgba(P.walnut, 0.75);
      g.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        g.beginPath();
        let x = 7;
        g.moveTo(x, 9 + i * 5);
        while (x < 33 - (i % 3) * 3) {
          x += 3;
          g.lineTo(x, 9 + i * 5 + Math.sin(x * 1.3 + i) * 0.8);
        }
        g.stroke();
      }
    });
  }

  function drawPages(g, live, t) {
    const ps = pageSprite(live);
    for (const p of live.pages ?? []) {
      if (p.collected) continue;
      g.save();
      g.translate(p.x, p.y);
      if (p.state === 'hidden') {
        // Only a corner peeks out behind the web.
        g.globalAlpha = 0.55;
        g.rotate(-0.25);
        g.drawImage(ps, -20, -25, 40, 50);
        g.restore();
        continue;
      }
      if (p.state === 'falling') g.rotate(Math.sin(p.age * 5) * 0.35);
      else g.rotate(0.12);
      g.drawImage(ps, -20, -25, 40, 50);
      const glint = (Math.sin(t * 3 + p.id) + 1) / 2;
      g.fillStyle = S.rgba(P.bone, 0.6 * glint);
      g.beginPath();
      g.arc(14, -20, 3, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  function drawProps(g, live, t, mk) {
    drawPages(g, live, t);
    void mk;
  }

  // The rolling ladder: two oak rails, round rungs, a brass hook over the
  // rail at the top and wheels at the foot.
  function drawLadder(g, live, mk) {
    const lx = live.ladderX ?? 400;
    const clean = mk.wipe >= 0.999 || mk.sweepX > lx + 35;
    const c = sprite(live, `ladder:${clean}`, LADDER.w + 20, LADDER.foot - RAIL.y + 30, (lg) => {
      lg.translate(10, -RAIL.y + 10);
      const wood = aged(S.mixHex(P.oak, P.linen, 0.15), clean);
      for (const rx of [0, LADDER.w - 12]) {
        paintShape(lg, rectPoints(rx, RAIL.y + 6, 12, LADDER.foot - RAIL.y - 12), {
          color: wood,
          lightDir: LIGHT_DIR,
          light: 0.3,
          shadow: 0.45,
          strokes: 4,
          strokeAngle: Math.PI / 2,
          rim: 0.35,
          wobble: 0.2,
          seed: 13130 + rx,
        });
      }
      for (const ry of LADDER.rungs) {
        const rung = lg.createLinearGradient(0, ry - 5, 0, ry + 5);
        rung.addColorStop(0, S.shadeHex(wood, 0.25));
        rung.addColorStop(1, S.shadeHex(wood, -0.35));
        lg.fillStyle = rung;
        lg.fillRect(8, ry - 5, LADDER.w - 16, 10);
      }
      const brass = aged(P.brass, clean);
      lg.strokeStyle = brass;
      lg.lineWidth = 4;
      for (const hx of [6, LADDER.w - 6]) {
        lg.beginPath();
        lg.moveTo(hx, RAIL.y + 14);
        lg.lineTo(hx, RAIL.y - 2);
        lg.arc(hx + 5, RAIL.y - 2, 5, Math.PI, 0);
        lg.stroke();
      }
      for (const wx of [6, LADDER.w - 6]) {
        lg.fillStyle = brass;
        lg.beginPath();
        lg.arc(wx, LADDER.foot - 6, 7, 0, Math.PI * 2);
        lg.fill();
        lg.fillStyle = S.rgba(P.soot, 0.6);
        lg.beginPath();
        lg.arc(wx, LADDER.foot - 6, 2.5, 0, Math.PI * 2);
        lg.fill();
      }
    });
    softShadow(g, lx + LADDER.w / 2, LADDER.foot, 46, 6, 0.4);
    g.drawImage(c, lx - 10, RAIL.y - 10);
  }

  // The globe: painted continents (invented, softly stylised) turning on
  // their axis behind a brass meridian; it lights from inside once clean.
  function drawGlobe(g, live, t, mk) {
    const { x, y, r } = GLOBE;
    const lit = S.clamp(mk.globe ?? 0, 0, 1);
    const spin = mk.globeSpin ?? 0;
    const clean = mk.wipe >= 0.999 || mk.sweepX > x;
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.clip();
    const sea = g.createRadialGradient(x - r * 0.3, y - r * 0.35, 4, x, y, r);
    sea.addColorStop(0, S.mix(aged(S.mixHex(P.moon, P.linen, 0.25), clean), S.mixHex(P.moon, P.dawn, 0.45), lit * 0.7));
    sea.addColorStop(1, S.mix(aged(S.mixHex(P.moon, P.umber, 0.55), clean), S.mixHex(P.moon, P.umber, 0.35), lit * 0.5));
    g.fillStyle = sea;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    // Continents: soft blobs on a band that turns (x wraps round the globe).
    const lands = [[0.1, -0.3, 0.35, 0.22], [0.55, 0.1, 0.3, 0.3], [1.1, -0.1, 0.25, 0.4], [1.6, 0.35, 0.28, 0.18], [2.2, -0.4, 0.4, 0.2]];
    for (const [lon, lat, sw, sh] of lands) {
      const a = lon + spin;
      const u = Math.sin(a);
      if (Math.cos(a) < -0.1) continue;
      const lx = x + u * r * 0.95;
      const ly = y + lat * r;
      g.fillStyle = S.rgba(S.mix(aged(S.mixHex(P.moss, P.oak, 0.3), clean), S.mixHex(P.moss, P.dawn, 0.35), lit * 0.6), 0.9);
      g.beginPath();
      g.ellipse(lx, ly, sw * r * Math.max(0.2, Math.cos(a)), sh * r, 0.3, 0, Math.PI * 2);
      g.fill();
    }
    // Latitude lines and the shading of a sphere.
    g.strokeStyle = S.rgba(P.walnut, 0.3);
    g.lineWidth = 1;
    for (const k of [-0.5, 0, 0.5]) {
      g.beginPath();
      g.ellipse(x, y + k * r, r * Math.sqrt(1 - k * k), r * 0.12, 0, 0, Math.PI * 2);
      g.stroke();
    }
    const shade = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.2, x, y, r * 1.05);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, S.rgba(P.soot, 0.55 * (1 - lit * 0.6)));
    g.fillStyle = shade;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
    // The meridian.
    g.strokeStyle = aged(P.brass, clean);
    g.lineWidth = 4;
    g.beginPath();
    g.arc(x, y, r + 7, -2.2, 1.0);
    g.stroke();
    g.fillStyle = aged(P.brass, clean);
    g.beginPath();
    g.arc(x, y - r - 7, 3.5, 0, Math.PI * 2);
    g.fill();
  }

  // Eleanor's diary on its stand: shut under dust in the dirty room; open
  // once clean, her handwriting on the right-hand page.
  function diarySprite(live, open) {
    return sprite(live, `diary:${open}`, 180, 90, (g) => {
      if (!open) {
        g.fillStyle = S.mixHex(P.plum, P.walnut, 0.5);
        g.fillRect(50, 20, 80, 62);
        g.fillStyle = S.rgba(P.brass, 0.6);
        g.fillRect(56, 26, 68, 2);
        g.fillRect(56, 74, 68, 2);
        g.fillStyle = S.rgba(P.linen, 0.3);
        g.fillRect(50, 20, 80, 62);
        return;
      }
      g.fillStyle = S.mixHex(P.plum, P.walnut, 0.5);
      g.fillRect(4, 8, 172, 80);
      for (const [px, tilt] of [[8, -1], [90, 1]]) {
        g.fillStyle = S.mixHex(P.bone, P.linen, 0.2);
        g.beginPath();
        g.moveTo(px, 12);
        g.lineTo(px + 82, 12 + tilt * 2);
        g.lineTo(px + 82, 84);
        g.lineTo(px, 84 - tilt * 2);
        g.closePath();
        g.fill();
      }
      g.fillStyle = S.rgba(P.soot, 0.15);
      g.fillRect(88, 12, 4, 72);
      // Left page: older lines, too small to matter. Right page: the line.
      g.strokeStyle = S.rgba(P.walnut, 0.45);
      g.lineWidth = 0.8;
      for (let i = 0; i < 8; i++) {
        g.beginPath();
        g.moveTo(14, 22 + i * 8);
        g.lineTo(80 - (i % 3) * 6, 22 + i * 8);
        g.stroke();
      }
      g.fillStyle = S.rgba(S.mixHex(P.moon, P.soot, 0.5), 0.95);
      g.font = '500 10px Caveat, "Segoe Print", cursive';
      g.textAlign = 'left';
      const lines = ['Thomas says the', 'Helper will come', 'back one day and', 'make the house', 'safe.'];
      lines.forEach((ln, i) => g.fillText(ln, 96, 26 + i * 12));
      g.fillStyle = S.rgba(P.walnut, 0.6);
      g.font = '500 8px Caveat, "Segoe Print", cursive';
      g.fillText('— E.', 150, 82);
    });
  }

  function drawDiary(g, live, mk) {
    const open = mk.wipe >= 0.999 || mk.sweepX > DIARY.x + 60;
    const d = diarySprite(live, open);
    // Propped on its stand, leaning back a little.
    g.save();
    g.translate(DIARY.x, DESK.top - 14);
    g.transform(1, 0, 0, 0.9, 0, 0);
    g.drawImage(d, -90, -86, 180, 90);
    g.restore();
  }

  // The fallen books: on the floor until `books`, when they slide back to
  // their gaps one after another.
  function drawFallenBooks(g, live, mk) {
    const k = S.clamp(mk.books ?? 0, 0, 1);
    FALLEN.forEach((b, i) => {
      const p = S.ease.inOut(S.clamp(k * 1.8 - i * 0.2, 0, 1));
      const [fx, fy, ft] = b.floor;
      const [sx, sy] = b.shelf;
      const x = S.lerp(fx, sx + b.w / 2, p);
      const y = S.lerp(fy, sy - b.h / 2, p) - Math.sin(p * Math.PI) * 60;
      const rot = S.lerp(ft + Math.PI / 2, 0, p);
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      const hue = TONE.spines[b.hue];
      const body = g.createLinearGradient(-b.w / 2, 0, b.w / 2, 0);
      body.addColorStop(0, S.shadeHex(hue, -0.3));
      body.addColorStop(0.35, S.shadeHex(hue, 0.12));
      body.addColorStop(1, S.shadeHex(hue, -0.4));
      g.fillStyle = body;
      g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      g.fillStyle = S.rgba(P.brass, 0.6);
      g.fillRect(-b.w / 2 + 1, -b.h / 2 + 6, b.w - 2, 1);
      g.fillRect(-b.w / 2 + 1, b.h / 2 - 7, b.w - 2, 1);
      if (p < 0.05) {
        g.fillStyle = S.mixHex(P.bone, P.linen, 0.4);
        g.fillRect(b.w / 2 - 3, -b.h / 2 + 3, 3, b.h - 6);
      }
      g.restore();
    });
  }

  function drawOnFurniture(g, live, t, mk) {
    drawGlobe(g, live, t, mk);
    drawDiary(g, live, mk);
    drawFallenBooks(g, live, mk);
    drawLadder(g, live, mk);
  }

  // ── Light ─────────────────────────────────────────────────────────────

  // The banker's lamp: a dim green stutter in the dirty room; at `lamp` a
  // steady warm light under its green shade.
  function lampOn(live, t, mk) {
    const steady = S.clamp(mk.lamp ?? 0, 0, 1);
    const flick = S.light.flicker(live.noise, t * 1.7, 3.1);
    return { warm: steady, green: S.lerp(0.35 + 0.35 * flick, 0.5, steady) };
  }

  // The moonlight through the leaded panes, broken into diamonds on the
  // floor: painted once into small canvases and added to the light map.
  const DIAMOND_BOX = { x: 900, y: 600, w: 960, h: 480 };
  function diamondPattern(live, hex) {
    return sprite(live, `diamonds:${hex}`, DIAMOND_BOX.w / 2, DIAMOND_BOX.h / 2, (g) => {
      g.scale(0.5, 0.5);
      g.translate(-DIAMOND_BOX.x, -DIAMOND_BOX.y);
      // The pool: from the window's foot out across the floor to the left.
      const top = [[WINDOW.x, WINDOW.y + WINDOW.h + 30], [WINDOW.x + WINDOW.w, WINDOW.y + WINDOW.h + 30]];
      const bot = [[1000, 1060], [1600, 1060]];
      const at = (u, v) => [S.lerp(S.lerp(top[0][0], bot[0][0], v), S.lerp(top[1][0], bot[1][0], v), u), S.lerp(top[0][1], bot[0][1], v)];
      for (const [ins, a] of [[-0.04, 0.12], [0, 0.22], [0.06, 0.26]]) {
        g.fillStyle = S.rgba(hex, a);
        const q = [at(ins, ins), at(1 - ins, ins), at(1 - ins, 1 - ins * 0.3), at(ins, 1 - ins * 0.3)];
        g.beginPath();
        g.moveTo(q[0][0], q[0][1]);
        for (const p of q.slice(1)) g.lineTo(p[0], p[1]);
        g.closePath();
        g.fill();
      }
      // The lead cames as shadow: a diamond lattice through the pool.
      g.globalCompositeOperation = 'destination-out';
      g.strokeStyle = 'rgba(0,0,0,0.75)';
      for (let k = -1.2; k <= 1.2; k += 0.15) {
        g.lineWidth = 5;
        const a1 = [];
        const a2 = [];
        for (let v = 0; v <= 1.001; v += 0.1) {
          a1.push(at(k + v * 0.6, v));
          a2.push(at(k + 0.6 - v * 0.6, v));
        }
        for (const line of [a1, a2]) {
          g.beginPath();
          line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.stroke();
        }
      }
      g.lineWidth = 16;
      for (const [a, b] of [[at(0.5, 0), at(0.5, 1)], [at(0, 0.33), at(1, 0.33)]]) {
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    });
  }

  function lights(lm, live, t, mk) {
    const win = S.mixHex(P.moon, P.dawn, mk.window);
    const { x, y, w, h } = WINDOW;
    lm.point(x + w / 2, y + h / 2, 420, win, S.lerp(0.5, 0.8, mk.window));
    lm.shaft([[x + 10, y + 20], [x + w - 10, y + 20], [1600, 1060], [1000, 1060]], win, S.lerp(0.45, 0.6, mk.window));
    const g = lm.ctx;
    const moon = diamondPattern(live, P.moon);
    const dawn = diamondPattern(live, P.dawn);
    g.save();
    g.globalAlpha = 1 - mk.window;
    if (mk.window < 1) g.drawImage(moon, DIAMOND_BOX.x, DIAMOND_BOX.y, DIAMOND_BOX.w, DIAMOND_BOX.h);
    g.globalAlpha = mk.window * 0.85;
    if (mk.window > 0) g.drawImage(dawn, DIAMOND_BOX.x, DIAMOND_BOX.y, DIAMOND_BOX.w, DIAMOND_BOX.h);
    g.restore();
    // The banker's lamp.
    const lamp = lampOn(live, t, mk);
    const lampHex = S.mixHex(S.mixHex(P.moss, P.moon, 0.4), P.amber, lamp.warm);
    lm.point(LAMP.x, LAMP.y + 30, S.lerp(260, 380, lamp.warm), lampHex, S.lerp(lamp.green, 0.9, lamp.warm));
    lm.cone(LAMP.x, LAMP.y + 10, Math.PI / 2, 2.2, 260, P.amber, 0.7 * lamp.warm);
    lm.point(LAMP.x, LAMP.y - 40, 160, S.mixHex(P.moss, P.moon, 0.3), 0.35 * (0.6 + lamp.warm * 0.4));
    // The globe, lit from within.
    const globe = S.clamp(mk.globe ?? 0, 0, 1);
    if (globe > 0.01) lm.point(GLOBE.x, GLOBE.y, 220, P.dawn, 0.7 * globe);
    // The reading lamp.
    const reading = S.clamp(mk.reading ?? 0, 0, 1);
    if (reading > 0.01) {
      lm.point(READING.x, READING.shade + 30, 340, P.amber, 0.75 * reading);
      lm.cone(READING.x, READING.shade + 40, Math.PI / 2 + 0.2, 1.8, 360, P.amber, 0.6 * reading);
    }
    return 1;
  }

  function glow(g, lm, live, t, mk) {
    const winHex = mk.window > 0.5 ? P.dawn : P.moon;
    const { x, y, w, h } = WINDOW;
    S.light.glow(g, x + w / 2, y + h / 2, 200, winHex, S.lerp(0.14, 0.24, mk.window));
    const lamp = lampOn(live, t, mk);
    // The green glass glows; under it, the bulb's warm light once steady.
    S.light.glow(g, LAMP.x, LAMP.y - 2, 70, S.mixHex(P.moss, P.moon, 0.35), 0.55 * lamp.green + 0.2 * lamp.warm);
    if (lamp.warm > 0.01) S.light.glow(g, LAMP.x, LAMP.y + 16, 44, P.amber, 0.7 * lamp.warm);
    const globe = S.clamp(mk.globe ?? 0, 0, 1);
    if (globe > 0.01) S.light.glow(g, GLOBE.x, GLOBE.y, 80, P.dawn, 0.4 * globe);
    const reading = S.clamp(mk.reading ?? 0, 0, 1);
    if (reading > 0.01) S.light.glow(g, READING.x, READING.shade + 26, 60, P.amber, 0.6 * reading);
    void lm;
  }

  function beat() {}

  S.rooms.attachArt('study', {
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
