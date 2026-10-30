/*
 * Spyder — Room 2: the Living Room.
 *
 * This file is the template every other room follows. A room provides:
 *
 *   layout      platforms, bounds, spawn points (plain data)
 *   paint()     pre-renders its static layers twice, `dirty` and `clean`
 *   webs        the cobwebs to clear
 *   drawSky()   things behind the wall that move (window view)
 *   drawProps() things in the room that move (curtains, chandelier, clock)
 *   lights()    registers its lights for the frame
 *   glow()      bloom on light sources, after the lighting pass
 *
 * The `blend` value passed around runs 0 (dirty, night) → 1 (clean, morning).
 * Individual props read their own staged values from `makeover` so the
 * transformation can happen one beat at a time.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const { paintShape, wobblyPath, rectPoints, roundedRectPoints, ellipsePoints, softShadow, stain } = S.paint;

  // ── Layout ────────────────────────────────────────────────────────────

  const CEILING = 100; // underside of the crown moulding
  const RAIL = 585; // top of the wainscoting
  const FLOOR_LINE = 770; // where wall meets floor
  const GROUND = 935; // where the hero walks
  const LIGHT_FROM_LAMP = { x: 0.6, y: -0.8 };

  const WINDOW = { x: 262, y: 200, w: 318, h: 338 }; // the glass
  const SOFA = { x: 150, y: 612, w: 500, seat: 760, floor: 852 };
  const DRESSER = { x: 1288, top: 742, w: 236, floor: 852 };
  const LAMP = { x: 1168, shadeTop: 362, shadeBottom: 458, base: 866 };
  const SHELF = { x: 1588, y: 186, w: 252, h: 620 };
  const PORTRAIT = { x: 806, y: 246, w: 250, h: 236 };
  const CLOCK = { x: 1362, y: 236, w: 92, h: 236 };
  const SCONCE = { x: 706, y: 336 };
  const CHANDELIER = { x: 931, top: CEILING, hang: 66 };

  const layout = {
    name: 'Living Room',
    act: 1,
    number: 2,
    CEILING,
    FLOOR_LINE,
    GROUND,
    bounds: { left: 90, right: 1830 },
    platforms: [
      { name: 'floor', x0: 0, x1: 1920, y: GROUND, oneWay: false },
      { name: 'sofa', x0: SOFA.x + 70, x1: SOFA.x + SOFA.w - 70, y: SOFA.seat, oneWay: true },
      { name: 'dresser', x0: DRESSER.x + 6, x1: DRESSER.x + DRESSER.w - 6, y: DRESSER.top, oneWay: true },
    ],
    // Spiders on silk drop from these ceiling points.
    dropPoints: [220, 410, 700, 880, 1060, 1260, 1460, 1700],
    // Wall crawlers creep out of these gaps.
    lairs: [
      { x: PORTRAIT.x + PORTRAIT.w / 2, y: PORTRAIT.y + PORTRAIT.h + 6, label: 'behind the portrait' },
      { x: 430, y: 150, label: 'crack under the moulding' },
      { x: CLOCK.x + CLOCK.w / 2, y: CLOCK.y + CLOCK.h + 4, label: 'behind the clock' },
      { x: SHELF.x + 20, y: 320, label: 'gap beside the shelf' },
    ],
    // The part of the wall crawlers may walk on.
    wallArea: { x0: 90, x1: 1830, y0: CEILING + 30, y1: RAIL - 20 },
    window: WINDOW,
  };

  // ── Static painting ─────────────────────────────────────────────────

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
    const wallBase = clean ? '#7B6E62' : '#62564F';
    const wallpaperInk = clean ? '#9A8A72' : '#6E655C';

    // Ceiling band
    paintShape(g, rectPoints(0, 0, 1920, CEILING + 4), {
      color: clean ? '#4A4038' : P.umber,
      lightDir: { x: 0, y: 1 },
      light: 0.15,
      shadow: 0.5,
      strokes: 4,
      strokeAngle: 0,
      rim: 0,
      wobble: 0,
      seed: 2,
    });

    // Wallpaper
    paintShape(g, rectPoints(0, CEILING, 1920, RAIL - CEILING + 4), {
      color: wallBase,
      lightDir: { x: 0.2, y: -1 },
      light: 0.12,
      shadow: 0.28,
      strokes: 9,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.12,
      variance: 0.08,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 3,
    });
    drawWallpaperPattern(g, wallpaperInk, clean);

    // Moulding at the ceiling: three bands catch light differently.
    const bands = [
      [CEILING - 18, 8, 0.12],
      [CEILING - 10, 6, -0.12],
      [CEILING - 4, 10, 0.2],
    ];
    for (const [y, h, tone] of bands) {
      g.fillStyle = S.shade(clean ? '#8D7F6E' : '#6A5F55', tone);
      g.fillRect(0, y, 1920, h);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, CEILING + 6, 1920, 5);

    // Wainscoting
    paintShape(g, rectPoints(0, RAIL, 1920, FLOOR_LINE - RAIL), {
      color: clean ? '#5A4334' : P.walnut,
      lightDir: { x: 0.3, y: -1 },
      light: 0.12,
      shadow: 0.4,
      strokes: 10,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.05,
      rim: 0,
      wobble: 0,
      seed: 4,
    });
    // Chair rail
    g.fillStyle = S.shade(clean ? '#6B5240' : '#4E3D31', 0.18);
    g.fillRect(0, RAIL - 10, 1920, 12);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(0, RAIL + 2, 1920, 4);
    for (let x = 40; x < 1900; x += 190) {
      woodPanel(g, x, RAIL + 26, 160, FLOOR_LINE - RAIL - 70, clean, x);
    }
    // Skirting board
    g.fillStyle = clean ? '#3E3128' : '#2E2520';
    g.fillRect(0, FLOOR_LINE - 30, 1920, 30);
    g.fillStyle = 'rgba(255,230,200,0.08)';
    g.fillRect(0, FLOOR_LINE - 30, 1920, 3);

    // Side walls give the room depth: narrow, darker, in perspective.
    for (const side of [-1, 1]) {
      const x0 = side === -1 ? 0 : 1920;
      const x1 = side === -1 ? 74 : 1846;
      g.fillStyle = 'rgba(12,9,8,0.55)';
      g.beginPath();
      g.moveTo(x0, 0);
      g.lineTo(x1, CEILING);
      g.lineTo(x1, FLOOR_LINE);
      g.lineTo(x0, FLOOR_LINE + 60);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(255,230,200,0.06)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x1, CEILING);
      g.lineTo(x1, FLOOR_LINE);
      g.stroke();
    }

    paintFloor(g, clean);
    paintRug(g, clean);

    // Wall furniture and decor
    paintWindowFrame(g, clean);
    paintPortrait(g, clean);
    paintClockCase(g, clean);
    paintSconce(g, clean);
    paintShelf(g, clean);
    paintSmallFrames(g, clean);

    if (!clean) paintBackGrime(g);
  }

  function drawWallpaperPattern(g, ink, clean) {
    const rng = S.createRng(41);
    g.save();
    g.beginPath();
    g.rect(0, CEILING, 1920, RAIL - CEILING - 12);
    g.clip();

    // Faint stripes
    for (let x = 0; x < 1920; x += 64) {
      g.fillStyle = S.rgba(ink, 0.08);
      g.fillRect(x, CEILING, 8, RAIL - CEILING);
    }
    // Damask motifs in a half-drop repeat, slightly irregular so it feels printed.
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 17; col++) {
        const x = col * 120 + (row % 2) * 60 + rng.range(-2, 2);
        const y = CEILING + 30 + row * 76;
        damask(g, x, y, S.rgba(ink, clean ? 0.32 : 0.24));
      }
    }
    // Seams between wallpaper rolls
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 1.5;
    for (let x = 150; x < 1920; x += 260) {
      g.beginPath();
      g.moveTo(x, CEILING);
      g.lineTo(x + rng.range(-2, 2), RAIL);
      g.stroke();
    }
    g.restore();
  }

  function damask(g, x, y, color) {
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(x, y, 6, 15, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(x, y + 12);
    g.bezierCurveTo(x - 22, y + 4, x - 24, y - 18, x - 10, y - 20);
    g.moveTo(x, y + 12);
    g.bezierCurveTo(x + 22, y + 4, x + 24, y - 18, x + 10, y - 20);
    g.moveTo(x - 10, y + 20);
    g.quadraticCurveTo(x, y + 30, x + 10, y + 20);
    g.stroke();
    g.beginPath();
    g.arc(x, y - 22, 3, 0, Math.PI * 2);
    g.fill();
  }

  function woodPanel(g, x, y, w, h, clean, seed) {
    const wood = clean ? '#5E4636' : '#43352B';
    paintShape(g, rectPoints(x, y, w, h), {
      color: wood,
      lightDir: { x: 0.3, y: -1 },
      light: 0.1,
      shadow: 0.25,
      strokes: 12,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.04,
      rim: 0.2,
      innerShadow: 0.4,
      wobble: 0.6,
      seed,
    });
    // Bevel: light on top-left, shadow on bottom-right.
    g.strokeStyle = 'rgba(255,225,190,0.12)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x, y);
    g.lineTo(x + w, y);
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.moveTo(x + w, y);
    g.lineTo(x + w, y + h);
    g.lineTo(x, y + h);
    g.stroke();
  }

  // Floorboards in one-point perspective, vanishing above the room.
  function paintFloor(g, clean) {
    const vp = { x: 960, y: -900 };
    const top = FLOOR_LINE;
    const bottom = 1080;
    paintShape(g, [[0, top], [1920, top], [1920, bottom], [0, bottom]], {
      color: clean ? '#7A5A42' : '#5C4535',
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
      seed: 9,
    });

    const xAt = (xBottom, y) => vp.x + (xBottom - vp.x) * ((y - vp.y) / (bottom - vp.y));
    const rng = S.createRng(77);

    for (let xb = -300; xb < 2300; xb += 128) {
      // Board seam
      g.strokeStyle = 'rgba(10,6,4,0.55)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(xAt(xb, top), top);
      g.lineTo(xb, bottom);
      g.stroke();
      // A faint lit edge beside each seam
      g.strokeStyle = 'rgba(255,220,180,0.06)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(xAt(xb, top) + 2, top);
      g.lineTo(xb + 3, bottom);
      g.stroke();

      // Staggered butt joints
      let y = top + rng.range(10, 120);
      while (y < bottom) {
        const x1 = xAt(xb, y);
        const x2 = xAt(xb + 128, y);
        g.strokeStyle = 'rgba(10,6,4,0.45)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x1, y);
        g.lineTo(x2, y);
        g.stroke();
        y += rng.range(140, 260) * ((y - vp.y) / (bottom - vp.y));
      }
    }

    // Polished sheen along the middle, where lamp light pools.
    const sheen = g.createRadialGradient(1100, 960, 20, 1100, 960, 700);
    sheen.addColorStop(0, `rgba(255,220,170,${clean ? 0.14 : 0.06})`);
    sheen.addColorStop(1, 'rgba(255,220,170,0)');
    g.fillStyle = sheen;
    g.fillRect(0, top, 1920, bottom - top);

    // Contact shadow where floor meets wall
    const shadow = g.createLinearGradient(0, top, 0, top + 60);
    shadow.addColorStop(0, 'rgba(0,0,0,0.5)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = shadow;
    g.fillRect(0, top, 1920, 60);
  }

  function paintRug(g, clean) {
    const quad = [
      [560, 868],
      [1400, 868],
      [1600, 1060],
      [360, 1060],
    ];
    softShadow(g, 980, 968, 640, 110, 0.35);
    paintShape(g, quad, {
      color: clean ? '#8A4E36' : '#6C4230',
      lightDir: { x: 0.3, y: -1 },
      light: 0.1,
      shadow: 0.3,
      strokes: 30,
      strokeAngle: 0,
      strokeJitter: 0.3,
      strokeSize: 0.6,
      rim: 0,
      innerShadow: 0.5,
      wobble: 1.2,
      seed: 12,
    });
    // Border and medallion, squashed into the floor's perspective.
    const inset = [
      [604, 884],
      [1356, 884],
      [1530, 1040],
      [430, 1040],
    ];
    g.strokeStyle = S.rgba(clean ? '#D9B47A' : '#9C8360', 0.55);
    g.lineWidth = 6;
    wobblyPath(g, inset, { wobble: 1, seed: 13 });
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = S.rgba(clean ? '#3E5A55' : '#30403C', 0.7);
    wobblyPath(g, [[630, 896], [1330, 896], [1490, 1028], [470, 1028]], { wobble: 1, seed: 14 });
    g.stroke();
    g.save();
    g.translate(980, 960);
    g.scale(1, 0.32);
    for (let i = 0; i < 12; i++) {
      g.rotate(Math.PI / 6);
      g.fillStyle = S.rgba(clean ? '#D9B47A' : '#9C8360', 0.35);
      g.beginPath();
      g.ellipse(70, 0, 46, 14, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = S.rgba(clean ? '#3E5A55' : '#30403C', 0.8);
    g.beginPath();
    g.arc(0, 0, 40, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // Fringe
    g.strokeStyle = S.rgba(P.linen, 0.4);
    g.lineWidth = 1.5;
    for (let x = 370; x < 1590; x += 9) {
      g.beginPath();
      g.moveTo(x, 1060);
      g.lineTo(x + 1, 1072);
      g.stroke();
    }
  }

  function paintWindowFrame(g, clean) {
    const { x, y, w, h } = WINDOW;
    // The glass itself is cut out: the sky is drawn behind this layer.
    const wood = clean ? '#E3D6C0' : '#8E8170';

    // Deep reveal around the window, so it reads as set into a thick wall.
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x - 30, y - 30, w + 60, h + 60);
    paintShape(g, rectPoints(x - 26, y - 26, w + 52, h + 52), {
      color: wood,
      light: 0.15,
      shadow: 0.35,
      strokes: 6,
      strokeAngle: Math.PI / 2,
      rim: 0.3,
      seed: 21,
      wobble: 0.6,
    });
    g.clearRect(x, y, w, h);

    // Mullions (cross bars)
    g.fillStyle = S.shade(wood, -0.1);
    g.fillRect(x + w / 2 - 7, y, 14, h);
    g.fillRect(x, y + h * 0.45 - 6, w, 12);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fillRect(x + w / 2 - 7, y, 3, h);

    // Sill
    paintShape(g, rectPoints(x - 50, y + h + 18, w + 100, 22), {
      color: wood,
      lightDir: { x: 0, y: -1 },
      light: 0.25,
      shadow: 0.4,
      strokes: 5,
      rim: 0.4,
      seed: 22,
      wobble: 0.5,
    });
    softShadow(g, x + w / 2, y + h + 48, w * 0.6, 12, 0.4);
    // Curtain rod
    g.fillStyle = P.brass;
    g.fillRect(x - 90, y - 52, w + 180, 8);
    for (const ex of [x - 96, x + w + 96]) {
      g.beginPath();
      g.arc(ex, y - 48, 10, 0, Math.PI * 2);
      g.fill();
    }
  }

  function paintPortrait(g, clean) {
    const { x, y, w, h } = PORTRAIT;
    // Drop shadow on the wall: lamp light comes from the right.
    g.save();
    g.filter = 'blur(10px)';
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(x - 14, y + 10, w, h);
    g.restore();

    // Gilt frame
    paintShape(g, rectPoints(x, y, w, h), {
      color: clean ? '#B08A4E' : '#7A6340',
      lightDir: LIGHT_FROM_LAMP,
      light: 0.35,
      shadow: 0.45,
      strokes: 12,
      rim: 0.5,
      seed: 31,
      wobble: 0.5,
    });
    // Ornament beads along the frame
    g.fillStyle = S.rgba(clean ? '#E3C27F' : '#A88C5A', 0.8);
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      g.beginPath();
      g.arc(x + 12 + t * (w - 24), y + 9, 2.2, 0, Math.PI * 2);
      g.arc(x + 12 + t * (w - 24), y + h - 9, 2.2, 0, Math.PI * 2);
      g.fill();
    }

    // The painting: a family of three, faces left blank by time.
    const cx = x + 26;
    const cy = y + 26;
    const cw = w - 52;
    const ch = h - 52;
    paintShape(g, rectPoints(cx, cy, cw, ch), {
      color: clean ? '#3F4A3C' : '#262B24',
      light: 0.2,
      shadow: 0.5,
      strokes: 40,
      strokeAngle: 0.6,
      strokeJitter: 1,
      rim: 0,
      innerShadow: 0.6,
      wobble: 0,
      seed: 32,
    });
    const figures = [
      { fx: cx + cw * 0.3, scale: 1.0, coat: '#2A2420' }, // father
      { fx: cx + cw * 0.66, scale: 0.92, coat: '#3A2A30' }, // mother
      { fx: cx + cw * 0.49, scale: 0.62, coat: '#46382A', faded: true }, // child
    ];
    for (const f of figures) {
      const headY = cy + ch * (f.scale === 0.62 ? 0.48 : 0.3);
      const bodyTop = headY + 18 * f.scale;
      g.fillStyle = f.faded && !clean ? S.rgba(f.coat, 0.35) : f.coat;
      g.beginPath();
      g.moveTo(f.fx - 30 * f.scale, cy + ch);
      g.quadraticCurveTo(f.fx - 32 * f.scale, bodyTop, f.fx, bodyTop - 4);
      g.quadraticCurveTo(f.fx + 32 * f.scale, bodyTop, f.fx + 30 * f.scale, cy + ch);
      g.closePath();
      g.fill();
      // Blank, pale faces: no features. Story hook — someone wore them away.
      g.fillStyle = f.faded && !clean ? S.rgba(P.linen, 0.25) : S.rgba(P.linen, clean ? 0.85 : 0.6);
      g.beginPath();
      g.ellipse(f.fx, headY, 13 * f.scale, 16 * f.scale, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Varnish sheen
    const varnish = g.createLinearGradient(cx, cy, cx + cw, cy + ch);
    varnish.addColorStop(0, 'rgba(255,240,210,0.1)');
    varnish.addColorStop(0.4, 'rgba(255,240,210,0)');
    g.fillStyle = varnish;
    g.fillRect(cx, cy, cw, ch);

    // Hanging wire
    g.strokeStyle = 'rgba(30,20,10,0.7)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x + 40, y + 4);
    g.lineTo(x + w / 2, y - 34);
    g.lineTo(x + w - 40, y + 4);
    g.stroke();
    g.fillStyle = P.brass;
    g.beginPath();
    g.arc(x + w / 2, y - 34, 4, 0, Math.PI * 2);
    g.fill();
  }

  function paintClockCase(g, clean) {
    const { x, y, w, h } = CLOCK;
    g.save();
    g.filter = 'blur(8px)';
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(x - 10, y + 8, w, h);
    g.restore();
    paintShape(g, roundedRectPoints(x, y, w, h, 10), {
      color: clean ? '#5A3A26' : '#3B2A1F',
      lightDir: LIGHT_FROM_LAMP,
      light: 0.25,
      shadow: 0.5,
      strokes: 14,
      strokeAngle: Math.PI / 2,
      rim: 0.45,
      seed: 41,
    });
    // Crown on top
    g.fillStyle = clean ? '#6B4730' : '#46331F';
    g.beginPath();
    g.moveTo(x - 6, y + 4);
    g.lineTo(x + w / 2, y - 22);
    g.lineTo(x + w + 6, y + 4);
    g.closePath();
    g.fill();
    // Dial
    const dx = x + w / 2;
    const dy = y + 46;
    g.fillStyle = clean ? '#EFE4CC' : '#BBAE94';
    g.beginPath();
    g.arc(dx, dy, 32, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = P.brass;
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = P.soot;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillRect(dx + Math.cos(a) * 25 - 1.5, dy + Math.sin(a) * 25 - 1.5, 3, 3);
    }
    // Hands frozen at 3:17 when dirty — the moment the house stopped.
    const hour = clean ? 7.5 : 3.28;
    const minute = clean ? 0.5 : 0.28;
    g.strokeStyle = P.soot;
    g.lineCap = 'round';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(dx, dy);
    const ha = (hour / 12) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(dx + Math.cos(ha) * 14, dy + Math.sin(ha) * 14);
    g.stroke();
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(dx, dy);
    const ma = minute * Math.PI * 2 - Math.PI / 2;
    g.lineTo(dx + Math.cos(ma) * 22, dy + Math.sin(ma) * 22);
    g.stroke();
    // Pendulum window (the pendulum itself is drawn live)
    g.fillStyle = 'rgba(8,6,5,0.85)';
    g.fillRect(x + 16, y + 92, w - 32, h - 110);
  }

  function paintSconce(g, clean) {
    const { x, y } = SCONCE;
    g.fillStyle = P.brass;
    g.beginPath();
    g.ellipse(x, y + 18, 12, 20, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = P.brass;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x, y + 18);
    g.quadraticCurveTo(x + 30, y + 10, x + 26, y - 12);
    g.stroke();
    // Glass tulip shade — cracked when dirty
    g.fillStyle = clean ? 'rgba(255,236,200,0.85)' : 'rgba(180,170,150,0.55)';
    g.beginPath();
    g.moveTo(x + 10, y - 12);
    g.quadraticCurveTo(x + 26, y - 48, x + 42, y - 12);
    g.closePath();
    g.fill();
    if (!clean) {
      g.strokeStyle = 'rgba(40,30,20,0.6)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 22, y - 14);
      g.lineTo(x + 28, y - 26);
      g.lineTo(x + 25, y - 36);
      g.stroke();
    }
  }

  function paintShelf(g, clean) {
    const { x, y, w, h } = SHELF;
    const wood = clean ? '#5C4231' : '#3A2C22';
    // Shadow on the wall
    g.save();
    g.filter = 'blur(14px)';
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(x - 24, y + 14, w, h);
    g.restore();

    paintShape(g, rectPoints(x, y, w, h), {
      color: wood,
      lightDir: { x: -0.7, y: -0.7 },
      light: 0.2,
      shadow: 0.45,
      strokes: 10,
      strokeAngle: Math.PI / 2,
      rim: 0.35,
      seed: 51,
    });
    // Inside back of the shelf, darker
    const shelves = 5;
    const innerX = x + 16;
    const innerW = w - 32;
    const rowH = (h - 40) / shelves;
    const rng = S.createRng(clean ? 52 : 53);
    for (let r = 0; r < shelves; r++) {
      const ry = y + 20 + r * rowH;
      g.fillStyle = 'rgba(10,7,5,0.72)';
      g.fillRect(innerX, ry, innerW, rowH - 14);
      // Shelf board
      g.fillStyle = S.shade(wood, 0.12);
      g.fillRect(innerX - 4, ry + rowH - 14, innerW + 8, 14);
      g.fillStyle = 'rgba(255,230,200,0.1)';
      g.fillRect(innerX - 4, ry + rowH - 14, innerW + 8, 2);

      // Books
      let bx = innerX + 4;
      const bottom = ry + rowH - 14;
      const bookColors = ['#6E3B2C', '#3E4F44', '#4A3640', '#7A6A4F', '#2F3A4A', '#5E4E3A', '#8A7A60'];
      while (bx < innerX + innerW - 14) {
        if (rng.chance(0.08) && r !== 2) {
          bx += rng.range(16, 34); // a gap where a book is missing
          continue;
        }
        const bw = rng.range(12, 24);
        const bh = rng.range(rowH * 0.55, rowH - 22);
        const lean = rng.chance(0.12) ? rng.range(0.1, 0.25) : 0;
        const color = rng.pick(bookColors);
        g.save();
        g.translate(bx, bottom);
        g.rotate(lean);
        const book = g.createLinearGradient(0, 0, bw, 0);
        book.addColorStop(0, S.shade(color, 0.12));
        book.addColorStop(1, S.shade(color, -0.3));
        g.fillStyle = book;
        g.fillRect(0, -bh, bw, bh);
        g.fillStyle = S.rgba(clean ? '#D9B47A' : '#9C8360', 0.6);
        g.fillRect(2, -bh + 8, bw - 4, 2);
        g.fillRect(2, -16, bw - 4, 2);
        g.restore();
        bx += bw + (lean ? 8 : 1);
      }
      // A small object on one shelf: an hourglass, and a photo
      if (r === 2) {
        g.fillStyle = clean ? 'rgba(230,215,185,0.9)' : 'rgba(150,140,120,0.7)';
        g.fillRect(innerX + innerW - 50, bottom - 54, 40, 54);
        g.fillStyle = 'rgba(40,30,20,0.6)';
        g.fillRect(innerX + innerW - 45, bottom - 49, 30, 40);
      }
    }
  }

  // A small cluster of photos between the window and the portrait.
  function paintSmallFrames(g, clean) {
    const frames = [
      [640, 168, 52, 66],
      [636, 444, 40, 50],
      [1096, 214, 46, 58],
    ];
    frames.forEach(([x, y, w, h], i) => {
      g.save();
      g.filter = 'blur(5px)';
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(x - 6, y + 6, w, h);
      g.restore();
      g.fillStyle = clean ? '#9A7A4C' : '#6A5638';
      g.fillRect(x, y, w, h);
      g.fillStyle = clean ? '#CFC2A6' : '#8E846F';
      g.fillRect(x + 6, y + 6, w - 12, h - 12);
      // A sepia figure inside
      g.fillStyle = 'rgba(60,45,30,0.55)';
      g.beginPath();
      g.arc(x + w / 2, y + h * 0.42, w * 0.13, 0, Math.PI * 2);
      g.fill();
      g.fillRect(x + w * 0.35, y + h * 0.52, w * 0.3, h * 0.3);
      // One frame hangs crooked when dirty
      if (!clean && i === 2) {
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 1;
        g.strokeRect(x + 4, y + 4, w, h);
      }
    });
  }

  // Everything that makes the room look abandoned. Only painted on `dirty`.
  function paintBackGrime(g) {
    const rng = S.createRng(61);

    // Water stains running down from the ceiling
    stain(g, 520, 160, 70, '#3A2E20', 62, 0.3);
    stain(g, 1290, 150, 55, '#3A2E20', 63, 0.25);
    stain(g, 1760, 420, 80, '#2E2418', 64, 0.25);
    // Drip trails
    g.strokeStyle = 'rgba(45,35,22,0.18)';
    g.lineWidth = 8;
    g.lineCap = 'round';
    for (const [x, len] of [[505, 210], [540, 140], [1300, 180]]) {
      g.beginPath();
      g.moveTo(x, 190);
      g.quadraticCurveTo(x + 6, 190 + len / 2, x - 2, 190 + len);
      g.stroke();
    }

    // Peeling wallpaper: a strip curling away from the wall near the ceiling.
    peel(g, 1486, CEILING + 6, 34, 92);
    peel(g, 160, CEILING + 6, 40, 110);

    // Plaster cracks in the ceiling corners
    g.strokeStyle = 'rgba(15,10,6,0.5)';
    g.lineWidth = 1.5;
    for (const start of [[300, 40], [1540, 30], [880, 70]]) {
      let [cx, cy] = start;
      g.beginPath();
      g.moveTo(cx, cy);
      for (let i = 0; i < 9; i++) {
        cx += rng.range(10, 26);
        cy += rng.range(-8, 10);
        g.lineTo(cx, S.clamp(cy, 6, CEILING - 20));
      }
      g.stroke();
    }

    // A dusty grey film over everything, patchy and thicker at the top.
    g.save();
    g.filter = 'blur(30px)';
    for (let i = 0; i < 80; i++) {
      g.fillStyle = `rgba(150,140,128,${rng.range(0.03, 0.08)})`;
      g.beginPath();
      g.ellipse(rng.range(0, 1920), rng.range(0, 760), rng.range(60, 200), rng.range(40, 120), 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    const film = g.createLinearGradient(0, 0, 0, FLOOR_LINE);
    film.addColorStop(0, 'rgba(140,130,118,0.16)');
    film.addColorStop(1, 'rgba(140,130,118,0.04)');
    g.fillStyle = film;
    g.fillRect(0, 0, 1920, FLOOR_LINE);

    // Dust drifts along the skirting and old footprints across the floor.
    g.save();
    g.filter = 'blur(10px)';
    g.fillStyle = 'rgba(160,150,135,0.22)';
    g.fillRect(0, FLOOR_LINE - 4, 1920, 26);
    g.restore();

    // Footprints: someone else walked to the bookshelf and never came back.
    g.fillStyle = 'rgba(25,18,12,0.28)';
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const fx = S.lerp(700, 1640, t) + (i % 2 ? 10 : -10);
      const fy = S.lerp(1050, 820, t) + (i % 2 ? 6 : -6);
      const sc = S.lerp(1, 0.55, t);
      g.beginPath();
      g.ellipse(fx, fy, 16 * sc, 6 * sc, -0.2, 0, Math.PI * 2);
      g.fill();
    }

    // Dust film on the floor, thinning toward the lit centre
    g.save();
    g.filter = 'blur(24px)';
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(150,140,125,${rng.range(0.04, 0.09)})`;
      g.beginPath();
      g.ellipse(rng.range(0, 1920), rng.range(FLOOR_LINE, 1080), rng.range(80, 220), rng.range(20, 50), 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function peel(g, x, y, w, h) {
    // The gap behind the strip
    g.fillStyle = 'rgba(40,30,20,0.22)';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w, y + h * 0.7);
    g.quadraticCurveTo(x + w / 2, y + h * 0.9, x, y + h * 0.75);
    g.closePath();
    g.fill();
    // The curling strip, showing its pale paper back
    g.fillStyle = 'rgba(214,202,180,0.9)';
    g.beginPath();
    g.moveTo(x, y + h * 0.75);
    g.quadraticCurveTo(x + w / 2, y + h * 0.95, x + w, y + h * 0.7);
    g.quadraticCurveTo(x + w + 12, y + h * 0.95, x + w * 0.7, y + h * 1.1);
    g.quadraticCurveTo(x + w * 0.2, y + h * 1.12, x - 6, y + h * 0.98);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    g.stroke();
  }

  // ── Furniture layer ────────────────────────────────────────────────

  function paintFurniture(g, clean) {
    paintSofa(g, clean);
    paintDresser(g, clean);
    paintLamp(g, clean);
  }

  function paintSofa(g, clean) {
    const { x, y, w, seat, floor } = SOFA;
    const velvet = clean ? '#58684A' : P.moss;
    softShadow(g, x + w / 2, floor + 4, w * 0.62, 26, 0.6);

    // Back
    paintShape(g, roundedRectPoints(x + 30, y, w - 60, seat - y + 20, 34), {
      color: S.shadeHex(velvet, -0.12),
      lightDir: LIGHT_FROM_LAMP,
      light: 0.18,
      shadow: 0.5,
      strokes: 24,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.5,
      strokeSize: 0.8,
      rim: 0.3,
      seed: 71,
    });
    // Tufting buttons on the back
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 2; j++) {
        const bx = x + 90 + i * 64 + (j % 2) * 32;
        const by = y + 40 + j * 46;
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath();
        g.arc(bx, by, 5, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.18)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(bx - 14, by - 10);
        g.lineTo(bx, by);
        g.lineTo(bx + 14, by - 10);
        g.stroke();
      }
    }

    // Seat cushions
    for (let i = 0; i < 3; i++) {
      const cw = (w - 150) / 3;
      const cx = x + 75 + i * cw;
      paintShape(g, roundedRectPoints(cx + 2, seat - 16, cw - 4, 44, 16), {
        color: velvet,
        lightDir: { x: 0.3, y: -1 },
        light: 0.22,
        shadow: 0.4,
        strokes: 22,
        strokeAngle: 0,
        strokeSize: 0.8,
        rim: 0.35,
        seed: 72 + i,
      });
    }
    // Seat front / base
    paintShape(g, roundedRectPoints(x + 40, seat + 22, w - 80, floor - seat - 34, 10), {
      color: S.shadeHex(velvet, -0.2),
      lightDir: { x: 0, y: -1 },
      light: 0.1,
      shadow: 0.45,
      strokes: 16,
      strokeAngle: Math.PI / 2,
      rim: 0.2,
      seed: 75,
    });
    // Rolled arms
    for (const ax of [x, x + w - 92]) {
      paintShape(g, roundedRectPoints(ax, y + 74, 92, floor - y - 86, 40), {
        color: velvet,
        lightDir: LIGHT_FROM_LAMP,
        light: 0.25,
        shadow: 0.5,
        strokes: 24,
        strokeAngle: Math.PI / 2,
        strokeSize: 0.8,
        rim: 0.4,
        seed: 76 + ax,
      });
      // Scroll at the top of the arm
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(ax + 46, y + 110, 22, Math.PI * 0.9, Math.PI * 2.2);
      g.stroke();
    }
    // Turned wooden feet
    for (const fx of [x + 30, x + w - 46]) {
      g.fillStyle = '#2E2219';
      g.beginPath();
      g.moveTo(fx, floor - 14);
      g.lineTo(fx + 16, floor - 14);
      g.lineTo(fx + 12, floor + 2);
      g.lineTo(fx + 4, floor + 2);
      g.closePath();
      g.fill();
    }

    // Throw blanket draped over the right arm: lies on the back cushion,
    // folds over the arm, and hangs down the outside to a fringed hem.
    const ox = x + w; // outer edge of the sofa
    const blanket = [
      [ox - 190, y + 46],
      [ox - 70, y + 66],
      [ox + 4, y + 96],
      [ox + 14, seat + 64],
      [ox - 26, seat + 88],
      [ox - 56, seat + 30],
      [ox - 120, seat - 8],
      [ox - 200, seat - 14],
    ];
    paintShape(g, blanket, {
      color: clean ? '#A0634A' : P.rust,
      lightDir: LIGHT_FROM_LAMP,
      light: 0.28,
      shadow: 0.45,
      strokes: 26,
      strokeAngle: 1.3,
      strokeSize: 0.7,
      rim: 0.45,
      wobble: 2.2,
      seed: 79,
    });
    // Woven stripes follow the fold
    g.strokeStyle = S.rgba(P.linen, 0.28);
    g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const k = i * 22;
      g.beginPath();
      g.moveTo(ox - 196 + k * 0.4, y + 70 + k);
      g.quadraticCurveTo(ox - 60 + k * 0.2, y + 86 + k, ox + 6 - k * 0.3, seat - 10 + k * 1.6);
      g.stroke();
    }
    // Fringe at the hem
    g.strokeStyle = S.rgba(P.linen, 0.45);
    g.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const fx = S.lerp(ox + 12, ox - 24, i / 7);
      const fy = S.lerp(seat + 66, seat + 88, i / 7);
      g.beginPath();
      g.moveTo(fx, fy);
      g.lineTo(fx - 2, fy + 12);
      g.stroke();
    }

    if (!clean) {
      // Dust settled on top of the cushions and a stain on the seat.
      g.save();
      g.filter = 'blur(6px)';
      g.fillStyle = 'rgba(180,170,150,0.22)';
      g.fillRect(x + 40, y - 4, w - 80, 22);
      g.fillRect(x + 70, seat - 18, w - 140, 14);
      g.restore();
      stain(g, x + 220, seat + 4, 26, '#20180F', 81, 0.4);
    }
  }

  function paintDresser(g, clean) {
    const { x, top, w, floor } = DRESSER;
    const wood = clean ? '#6A4A34' : '#45342A';
    softShadow(g, x + w / 2, floor + 2, w * 0.62, 18, 0.55);

    // Top board
    paintShape(g, rectPoints(x - 8, top, w + 16, 16), {
      color: S.shadeHex(wood, 0.15),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.3,
      strokes: 10,
      rim: 0.5,
      seed: 91,
      wobble: 0.4,
    });
    // Body
    paintShape(g, rectPoints(x, top + 16, w, floor - top - 30), {
      color: wood,
      lightDir: { x: -0.6, y: -0.8 },
      light: 0.2,
      shadow: 0.45,
      strokes: 14,
      strokeAngle: 0,
      strokeJitter: 0.05,
      rim: 0.35,
      seed: 92,
    });
    // Two drawers with brass pulls
    for (let i = 0; i < 2; i++) {
      const dy = top + 26 + i * 34;
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = 2;
      g.strokeRect(x + 12, dy, w - 24, 28);
      g.strokeStyle = 'rgba(255,230,200,0.08)';
      g.strokeRect(x + 13, dy + 1, w - 26, 26);
      for (const px of [x + w * 0.3, x + w * 0.7]) {
        g.fillStyle = P.brass;
        g.beginPath();
        g.ellipse(px, dy + 14, 9, 4, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Legs
    for (const lx of [x + 8, x + w - 20]) {
      g.fillStyle = S.shadeHex(wood, -0.3);
      g.fillRect(lx, floor - 14, 12, 16);
    }

    // On top: a vase, a candlestick and a photo frame.
    // The photo is face-down while the room is dirty. After the makeover it
    // stands up and shows the family — a quiet story beat.
    const vx = x + 44;
    paintShape(g, ellipsePoints(vx, top - 30, 20, 30), {
      color: clean ? '#4E6A72' : '#3E4E52',
      lightDir: LIGHT_FROM_LAMP,
      light: 0.4,
      shadow: 0.5,
      strokes: 6,
      rim: 0.6,
      seed: 93,
      wobble: 0.4,
    });
    if (clean) {
      // Fresh flowers
      const blooms = [[-18, -96, '#E8A27A'], [6, -110, '#F2C46D'], [22, -88, '#D9837A'], [-4, -82, '#F0D9B5']];
      g.strokeStyle = '#4F6A3A';
      g.lineWidth = 3;
      for (const [dx, dy] of blooms) {
        g.beginPath();
        g.moveTo(vx, top - 56);
        g.quadraticCurveTo(vx + dx * 0.4, top + dy * 0.6, vx + dx, top + dy);
        g.stroke();
      }
      for (const [dx, dy, c] of blooms) {
        for (let p = 0; p < 6; p++) {
          const a = (p / 6) * Math.PI * 2;
          g.fillStyle = c;
          g.beginPath();
          g.ellipse(vx + dx + Math.cos(a) * 6, top + dy + Math.sin(a) * 6, 6, 4, a, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = '#5A3A20';
        g.beginPath();
        g.arc(vx + dx, top + dy, 3, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      // Dead stems, drooping
      g.strokeStyle = '#4A3C2A';
      g.lineWidth = 2.5;
      for (const [dx, droop] of [[-14, 30], [0, 40], [12, 22], [22, 48]]) {
        g.beginPath();
        g.moveTo(vx, top - 56);
        g.quadraticCurveTo(vx + dx, top - 120, vx + dx + droop, top - 90);
        g.stroke();
        g.fillStyle = '#5A4430';
        g.beginPath();
        g.ellipse(vx + dx + droop, top - 88, 6, 4, 0.8, 0, Math.PI * 2);
        g.fill();
      }
    }

    // Candlestick
    const cx = x + w - 46;
    g.fillStyle = P.brass;
    g.fillRect(cx - 4, top - 60, 8, 60);
    g.beginPath();
    g.ellipse(cx, top - 2, 18, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = clean ? '#F2EAD8' : '#BDB39E';
    g.fillRect(cx - 6, top - 96, 12, 38);
    if (!clean) {
      g.fillStyle = 'rgba(200,190,170,0.8)';
      g.beginPath();
      g.moveTo(cx - 6, top - 70);
      g.quadraticCurveTo(cx - 12, top - 60, cx - 8, top - 54);
      g.lineTo(cx - 6, top - 70);
      g.fill();
    }

    // Photo frame
    const fx = x + w / 2 + 8;
    if (clean) {
      g.save();
      g.translate(fx, top);
      g.rotate(-0.08);
      g.fillStyle = '#A88A55';
      g.fillRect(-26, -66, 52, 66);
      g.fillStyle = '#E3D6BC';
      g.fillRect(-20, -60, 40, 54);
      g.fillStyle = 'rgba(70,50,35,0.7)';
      for (const [px, py, r] of [[-8, -40, 6], [8, -42, 6], [0, -28, 4.5]]) {
        g.beginPath();
        g.arc(px, py, r, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    } else {
      g.fillStyle = '#6A5638';
      g.fillRect(fx - 30, top - 8, 60, 8);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(fx - 30, top - 2, 60, 2);
    }

    if (!clean) {
      g.save();
      g.filter = 'blur(5px)';
      g.fillStyle = 'rgba(175,165,148,0.25)';
      g.fillRect(x - 6, top - 4, w + 12, 10);
      g.restore();
    }
  }

  function paintLamp(g, clean) {
    const { x, shadeTop, shadeBottom, base } = LAMP;
    softShadow(g, x, base + 2, 70, 14, 0.55);
    // Weighted base
    g.fillStyle = S.shadeHex(P.brass, -0.35);
    g.beginPath();
    g.ellipse(x, base - 4, 46, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.brass;
    g.beginPath();
    g.ellipse(x, base - 8, 40, 9, 0, 0, Math.PI * 2);
    g.fill();
    // Pole
    const pole = g.createLinearGradient(x - 5, 0, x + 5, 0);
    pole.addColorStop(0, S.shadeHex(P.brass, -0.4));
    pole.addColorStop(0.4, S.shadeHex(P.brass, 0.3));
    pole.addColorStop(1, S.shadeHex(P.brass, -0.3));
    g.fillStyle = pole;
    g.fillRect(x - 5, shadeBottom - 10, 10, base - shadeBottom);
    // A knot of brass halfway
    g.fillStyle = P.brass;
    g.beginPath();
    g.ellipse(x, (shadeBottom + base) / 2, 10, 14, 0, 0, Math.PI * 2);
    g.fill();

    // Fabric shade: pleated linen. Torn and stained when dirty.
    const topW = 100;
    const botW = 160;
    const shadePts = [
      [x - topW / 2, shadeTop],
      [x + topW / 2, shadeTop],
      [x + botW / 2, shadeBottom],
      [x - botW / 2, shadeBottom],
    ];
    paintShape(g, shadePts, {
      color: clean ? '#E9D3A6' : '#B9A27A',
      lightDir: { x: 0, y: 1 },
      light: 0.15,
      shadow: 0.25,
      strokes: 10,
      strokeAngle: Math.PI / 2,
      rim: 0,
      innerShadow: 0.25,
      seed: 101,
      wobble: 0.6,
    });
    // Pleats
    g.strokeStyle = 'rgba(120,90,50,0.25)';
    g.lineWidth = 1.5;
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      g.beginPath();
      g.moveTo(x - topW / 2 + topW * t, shadeTop);
      g.lineTo(x - botW / 2 + botW * t, shadeBottom);
      g.stroke();
    }
    // Trim
    g.fillStyle = clean ? '#A07A45' : '#7A6040';
    g.fillRect(x - topW / 2 - 2, shadeTop - 3, topW + 4, 5);
    g.fillRect(x - botW / 2 - 3, shadeBottom - 4, botW + 6, 7);
    if (!clean) {
      // A tear in the shade, light will leak through it (see glow pass).
      g.fillStyle = 'rgba(40,25,10,0.75)';
      g.beginPath();
      g.moveTo(x + 30, shadeTop + 40);
      g.lineTo(x + 52, shadeTop + 52);
      g.lineTo(x + 40, shadeTop + 74);
      g.lineTo(x + 32, shadeTop + 60);
      g.closePath();
      g.fill();
      stain(g, x - 30, shadeTop + 56, 16, '#5A3A18', 102, 0.5);
    }
  }

  // ── Foreground (out of focus, strongest parallax) ───────────────────

  function paintFront(g, clean) {
    g.save();
    g.filter = 'blur(7px)';

    // Bottom-left: the high back of an armchair, very close to the camera.
    const chair = clean ? '#3A2A24' : '#1C1512';
    g.fillStyle = chair;
    g.beginPath();
    g.moveTo(-40, 1100);
    g.lineTo(-40, 880);
    g.quadraticCurveTo(40, 820, 150, 850);
    g.quadraticCurveTo(230, 880, 250, 1100);
    g.closePath();
    g.fill();
    // Its lit edge
    g.strokeStyle = clean ? 'rgba(255,200,140,0.35)' : 'rgba(127,163,199,0.2)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(-20, 868);
    g.quadraticCurveTo(40, 826, 150, 852);
    g.stroke();

    // Bottom-right: a potted fern, dead or alive.
    const potX = 1820;
    const potY = 1010;
    g.fillStyle = clean ? '#5A3A2A' : '#2A1E18';
    g.beginPath();
    g.moveTo(potX - 90, potY);
    g.lineTo(potX + 90, potY);
    g.lineTo(potX + 70, 1100);
    g.lineTo(potX - 70, 1100);
    g.closePath();
    g.fill();
    const rng = S.createRng(clean ? 111 : 112);
    for (let i = 0; i < 11; i++) {
      const a = S.lerp(-2.7, -0.4, i / 10) + rng.range(-0.1, 0.1);
      const len = rng.range(150, 260);
      const droop = clean ? 0.25 : 1.2; // dead fronds hang down
      const endX = potX + Math.cos(a) * len;
      const endY = potY + Math.sin(a) * len * (clean ? 1 : 0.4) + (clean ? 0 : 80);
      g.strokeStyle = clean ? '#4D6B3A' : '#3A2E1E';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(potX, potY - 10);
      g.quadraticCurveTo(potX + Math.cos(a) * len * 0.5, potY + Math.sin(a) * len * 0.8, endX, endY + droop * 30);
      g.stroke();
      // Leaflets along the frond
      for (let t = 0.3; t < 1; t += 0.12) {
        const px = S.lerp(potX, endX, t);
        const py = S.lerp(potY - 10, endY + droop * 30, t) - Math.sin(t * Math.PI) * 30;
        g.fillStyle = clean ? '#5E8045' : '#4A3A24';
        g.beginPath();
        g.ellipse(px, py, 16 * (1.1 - t), 6, a + 1.2, 0, Math.PI * 2);
        g.ellipse(px, py, 16 * (1.1 - t), 6, a - 1.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();

    if (!clean) {
      // Thick out-of-focus cobweb strands across the top corners.
      g.save();
      g.filter = 'blur(3px)';
      g.strokeStyle = 'rgba(220,215,200,0.22)';
      g.lineWidth = 3;
      for (const [x1, y1, x2, y2, sag] of [
        [-10, 140, 260, -10, 60],
        [-10, 260, 180, -10, 40],
        [1660, -10, 1930, 220, 70],
        [1760, -10, 1930, 120, 30],
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
    // Spokes fan from the ceiling edge round to the wall edge.
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

  function makeWebs() {
    return [
      // Top-left corner, big and old
      new S.Web({
        hub: [150, 196],
        anchors: cornerAnchors(74, CEILING, 300, 320, 9, 1),
        rings: 8,
        sheet: 0.7,
        seed: 201,
      }),
      // Top-right corner
      new S.Web({
        hub: [1760, 200],
        anchors: cornerAnchors(1846, CEILING, 260, 280, 8, -1),
        rings: 7,
        sheet: 0.6,
        seed: 202,
      }),
      // Across the top-right of the window
      new S.Web({
        hub: [WINDOW.x + WINDOW.w - 40, WINDOW.y + 34],
        anchors: [
          [WINDOW.x + WINDOW.w - 170, WINDOW.y - 26],
          [WINDOW.x + WINDOW.w - 90, WINDOW.y - 26],
          [WINDOW.x + WINDOW.w + 26, WINDOW.y - 26],
          [WINDOW.x + WINDOW.w + 26, WINDOW.y + 60],
          [WINDOW.x + WINDOW.w + 26, WINDOW.y + 150],
        ],
        rings: 6,
        sheet: 0.35,
        seed: 203,
      }),
      // Hanging between the ceiling and the chandelier
      new S.Web({
        hub: [1050, 158],
        anchors: [[960, CEILING], [1040, CEILING], [1140, CEILING], [1160, 190], [1080, 236], [1000, 220]],
        rings: 5,
        sheet: 0.3,
        seed: 204,
      }),
      // Orb web on the wall between portrait and clock
      new S.Web({
        hub: [1230, 250],
        anchors: Array.from({ length: 11 }, (_, i) => {
          const a = (i / 11) * Math.PI * 2 + 0.2;
          return [1230 + Math.cos(a) * 112, 250 + Math.sin(a) * 104];
        }),
        rings: 8,
        closed: true,
        sheet: 0.15,
        seed: 205,
      }),
      // Portrait top-right corner
      new S.Web({
        hub: [PORTRAIT.x + PORTRAIT.w - 18, PORTRAIT.y + 24],
        anchors: [
          [PORTRAIT.x + PORTRAIT.w - 110, PORTRAIT.y],
          [PORTRAIT.x + PORTRAIT.w - 50, PORTRAIT.y - 4],
          [PORTRAIT.x + PORTRAIT.w + 30, PORTRAIT.y - 10],
          [PORTRAIT.x + PORTRAIT.w + 20, PORTRAIT.y + 70],
          [PORTRAIT.x + PORTRAIT.w, PORTRAIT.y + 120],
        ],
        rings: 5,
        sheet: 0.4,
        seed: 206,
      }),
      // From the sofa back to the wall
      new S.Web({
        hub: [SOFA.x + 40, SOFA.y - 50],
        anchors: [[SOFA.x - 40, SOFA.y - 160], [SOFA.x + 20, SOFA.y - 170], [SOFA.x + 120, SOFA.y + 10], [SOFA.x + 60, SOFA.y + 20], [SOFA.x - 30, SOFA.y + 40]],
        rings: 5,
        sheet: 0.45,
        seed: 207,
      }),
      // From the lamp shade to the wall
      new S.Web({
        hub: [LAMP.x + 110, LAMP.shadeTop - 30],
        anchors: [
          [LAMP.x + 50, LAMP.shadeTop],
          [LAMP.x + 78, LAMP.shadeBottom],
          [LAMP.x + 200, LAMP.shadeTop + 60],
          [LAMP.x + 190, LAMP.shadeTop - 120],
          [LAMP.x + 90, LAMP.shadeTop - 110],
        ],
        rings: 5,
        sheet: 0.3,
        seed: 208,
      }),
      // Shelf top corner
      new S.Web({
        hub: [SHELF.x + 40, SHELF.y + 40],
        anchors: [[SHELF.x - 70, SHELF.y - 50], [SHELF.x + 30, SHELF.y], [SHELF.x + 120, SHELF.y + 24], [SHELF.x + 16, SHELF.y + 150], [SHELF.x - 60, SHELF.y + 120]],
        rings: 5,
        sheet: 0.5,
        seed: 209,
      }),
    ];
  }

  // ── Live drawing ────────────────────────────────────────────────────

  function createLive(seed = 1) {
    return {
      noise: S.createNoise(seed),
      branchNoise: S.createNoise(seed + 7),
      stars: Array.from({ length: 40 }, (_, i) => {
        const r = S.createRng(300 + i);
        return { x: r.range(0, 1), y: r.range(0, 0.6), s: r.range(0.6, 1.8), p: r.range(0, 6) };
      }),
    };
  }

  // What you see through the window. Drawn BEHIND the back layer.
  function drawSky(g, live, time, mk) {
    const { x, y, w, h } = WINDOW;
    const day = mk.window; // 0 night → 1 morning
    const dirty = S.moods.dirty;
    const clean = S.moods.clean;

    const sky = g.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, S.mix(dirty.windowSkyTop, clean.windowSkyTop, day));
    sky.addColorStop(1, S.mix(dirty.windowSkyBottom, clean.windowSkyBottom, day));
    g.fillStyle = sky;
    g.fillRect(x - 4, y - 4, w + 8, h + 8);

    // Stars fade out as dawn comes.
    for (const st of live.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * 2 + st.p);
      g.fillStyle = `rgba(230,235,255,${(1 - day) * twinkle * 0.8})`;
      g.beginPath();
      g.arc(x + st.x * w, y + st.y * h, st.s, 0, Math.PI * 2);
      g.fill();
    }

    // Moon sinking, sun rising
    const moonY = y + 80 + day * 260;
    g.fillStyle = `rgba(232,238,248,${1 - day})`;
    g.beginPath();
    g.arc(x + w * 0.7, moonY, 26, 0, Math.PI * 2);
    g.fill();
    const halo = g.createRadialGradient(x + w * 0.7, moonY, 20, x + w * 0.7, moonY, 90);
    halo.addColorStop(0, `rgba(180,200,230,${0.35 * (1 - day)})`);
    halo.addColorStop(1, 'rgba(180,200,230,0)');
    g.fillStyle = halo;
    g.fillRect(x, y, w, h);

    if (day > 0) {
      const sunY = y + h + 40 - day * 160;
      const sun = g.createRadialGradient(x + w * 0.25, sunY, 10, x + w * 0.25, sunY, 220);
      sun.addColorStop(0, `rgba(255,236,190,${day})`);
      sun.addColorStop(0.3, `rgba(255,200,140,${0.6 * day})`);
      sun.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = sun;
      g.fillRect(x, y, w, h);
    }

    // Bare tree branches outside, swaying in the wind.
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    const sway = live.branchNoise(time * 0.3) * 0.05;
    g.strokeStyle = S.mix('#0C0E14', '#4A5A60', day);
    g.lineCap = 'round';
    drawBranch(g, x - 20, y + h * 0.75, -0.35 + sway, 150, 14, 5, live.branchNoise, time);
    drawBranch(g, x + w + 30, y + h * 0.3, Math.PI + 0.25 - sway, 120, 10, 4, live.branchNoise, time);
    g.restore();
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

  // Moving props in front of the back layer.
  function drawProps(g, live, time, mk) {
    drawGlass(g, mk);
    drawCurtains(g, live, time, mk);
    drawPendulum(g, time, mk);
    drawChandelier(g, live, time, mk);
  }

  let glassGrimeCache = null;
  function glassGrime() {
    if (glassGrimeCache) return glassGrimeCache;
    const { w, h } = WINDOW;
    const c = S.makeCanvas(w + 80, h + 80);
    const g = c.getContext('2d');
    g.beginPath();
    g.rect(40, 40, w, h);
    g.clip();
    g.filter = 'blur(14px)';
    g.fillStyle = 'rgba(110,100,85,0.45)';
    g.beginPath();
    g.ellipse(40 + w * 0.2, 40 + h * 0.85, 140, 80, 0.3, 0, Math.PI * 2);
    g.ellipse(40 + w * 0.9, 40 + h * 0.15, 100, 70, 0.3, 0, Math.PI * 2);
    g.fill();
    glassGrimeCache = c;
    return c;
  }

  function drawGlass(g, mk) {
    const { x, y, w, h } = WINDOW;
    // Grime on the glass, wiped away by the makeover. Painted once, cached.
    const grime = 1 - mk.window;
    if (grime > 0.01) {
      g.save();
      g.globalAlpha = grime;
      g.drawImage(glassGrime(), x - 40, y - 40);
      g.restore();
    }
    // Reflection streak
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.beginPath();
    g.moveTo(x + 40, y + h);
    g.lineTo(x + 110, y + h);
    g.lineTo(x + 230, y);
    g.lineTo(x + 160, y);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawCurtains(g, live, time, mk) {
    const { x, y, w, h } = WINDOW;
    const open = mk.curtains; // 0 half-drawn and torn → 1 tied back
    const fabric = S.mixHex('#5A3C4C', '#8A5060', mk.window);
    const edgeLight = S.mixHex(P.moon, P.dawn, mk.window);

    for (const side of [-1, 1]) {
      const outer = side === -1 ? x - 96 : x + w + 96;
      // How far the curtain reaches over the glass.
      const reach = S.lerp(96, 22, open);
      const inner = side === -1 ? x + reach : x + w - reach;
      const top = y - 48;
      const bottom = y + h + S.lerp(130, 96, open);
      const breeze = live.noise(time * 0.6 + side * 5) * 6;
      const tieY = S.lerp(bottom, y + h * 0.66, open);
      const tieX = S.lerp(inner, outer + side * -26, open * 0.6);
      const hemInner = S.lerp(inner, outer + side * -34, open * 0.45) + breeze;

      const outline = () => {
        g.beginPath();
        g.moveTo(outer, top);
        g.lineTo(inner, top);
        g.quadraticCurveTo(inner + breeze, (top + tieY) / 2, tieX, tieY);
        g.lineTo(hemInner, bottom);
        // Tattered hem while dirty: a ragged edge instead of a straight one.
        const rag = 1 - open;
        for (let i = 1; i <= 9; i++) {
          const t = i / 9;
          g.lineTo(S.lerp(hemInner, outer, t), bottom + (i % 2 ? 22 : -4) * rag * (0.6 + 0.4 * Math.sin(i * 7)));
        }
        g.closePath();
      };

      g.save();
      // Folds: soft vertical bands of light and shadow across the width.
      const grad = g.createLinearGradient(outer, 0, inner, 0);
      const folds = 8;
      for (let i = 0; i <= folds; i++) {
        grad.addColorStop(i / folds, S.shade(fabric, i % 2 ? -0.32 : 0.12));
      }
      g.fillStyle = grad;
      outline();
      g.fill();

      // Velvet texture and a gathered top under the rod
      g.clip();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(Math.min(outer, inner) - 10, top, Math.abs(inner - outer) + 20, 18);
      const shadeDown = g.createLinearGradient(0, top, 0, bottom);
      shadeDown.addColorStop(0, 'rgba(0,0,0,0)');
      shadeDown.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = shadeDown;
      g.fillRect(Math.min(outer, inner) - 10, top, Math.abs(inner - outer) + 20, bottom - top + 30);
      g.restore();

      // The edge nearest the window catches its light.
      g.save();
      g.strokeStyle = S.rgba(edgeLight, 0.4);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(inner, top + 10);
      g.quadraticCurveTo(inner + breeze, (top + tieY) / 2, tieX, tieY);
      g.stroke();
      g.restore();

      // Rings on the rod
      g.fillStyle = P.brass;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.arc(S.lerp(outer, inner, i / 5), top - 2, 5, 0, Math.PI * 2);
        g.fill();
      }

      // Tie-back cord
      if (open > 0.2) {
        g.strokeStyle = S.rgba(P.brass, open);
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(tieX - 20, tieY);
        g.lineTo(tieX + 20, tieY + 4);
        g.stroke();
      }
    }
  }

  function drawPendulum(g, time, mk) {
    const { x, y, w, h } = CLOCK;
    const px = x + w / 2;
    const py = y + 94;
    // Stopped, hanging a little off-centre, until the clock comes back to life.
    const swing = mk.clock > 0 ? Math.sin(time * Math.PI) * 0.22 * mk.clock : 0.05;
    g.save();
    g.beginPath();
    g.rect(x + 16, y + 92, w - 32, h - 110);
    g.clip();
    g.translate(px, py);
    g.rotate(swing);
    g.strokeStyle = P.brass;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, 92);
    g.stroke();
    const bob = g.createRadialGradient(-4, 92, 2, 0, 96, 16);
    bob.addColorStop(0, '#F2D79A');
    bob.addColorStop(1, '#8A6A30');
    g.fillStyle = bob;
    g.beginPath();
    g.arc(0, 96, 15, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // Glass door reflection
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.fillRect(x + 20, y + 96, 8, h - 120);
  }

  function drawChandelier(g, live, time, mk) {
    const { x, top, hang } = CHANDELIER;
    // Broken: hangs crooked and creaks. Repaired: settles straight.
    const tilt = S.lerp(0.14, 0, mk.chandelier) + live.noise(time * 0.4) * 0.025;
    const bodyY = top + hang;

    // Ceiling rose
    g.fillStyle = '#5A5048';
    g.beginPath();
    g.ellipse(x, top + 2, 40, 9, 0, 0, Math.PI * 2);
    g.fill();

    g.save();
    g.translate(x, top);
    g.rotate(tilt);
    // Chain
    g.strokeStyle = S.shadeHex(P.brass, -0.2);
    g.lineWidth = 3;
    for (let cy = 4; cy < hang - 16; cy += 10) {
      g.beginPath();
      g.ellipse(0, cy + 5, 3, 5, (cy / 10) % 2 ? 0 : Math.PI / 2, 0, Math.PI * 2);
      g.stroke();
    }
    g.translate(0, hang);

    // Body
    const body = g.createLinearGradient(-20, -20, 20, 30);
    body.addColorStop(0, S.shadeHex(P.brass, 0.3));
    body.addColorStop(1, S.shadeHex(P.brass, -0.4));
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(-14, -16);
    g.lineTo(14, -16);
    g.quadraticCurveTo(26, 14, 0, 40);
    g.quadraticCurveTo(-26, 14, -14, -16);
    g.fill();

    // Arms with candle bulbs. Two arms are snapped while dirty.
    const arms = [-1, -0.55, 0.55, 1];
    arms.forEach((a, i) => {
      const broken = i === 1 || i === 3;
      const fall = broken ? (1 - mk.chandelier) : 0;
      g.save();
      g.rotate(fall * 0.9 * Math.sign(a));
      g.strokeStyle = S.shadeHex(P.brass, -0.1);
      g.lineWidth = 4;
      const ax = a * 84;
      g.beginPath();
      g.moveTo(0, 8);
      g.quadraticCurveTo(ax * 0.5, 40, ax, 0);
      g.stroke();
      // Drip cup and candle bulb
      g.fillStyle = P.brass;
      g.beginPath();
      g.ellipse(ax, 0, 11, 4, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#EDE4D0';
      g.fillRect(ax - 4, -26, 8, 26);
      const lit = mk.chandelierLights;
      g.fillStyle = lit > 0 ? `rgba(255,230,170,${0.4 + lit * 0.6})` : 'rgba(170,165,150,0.7)';
      g.beginPath();
      g.ellipse(ax, -32, 6, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    });

    // Crystal drops
    for (let i = -3; i <= 3; i++) {
      const sway = Math.sin(time * 1.4 + i) * 2;
      g.fillStyle = 'rgba(220,230,240,0.6)';
      g.beginPath();
      g.moveTo(i * 22 + sway, 34);
      g.lineTo(i * 22 + 4 + sway, 46);
      g.lineTo(i * 22 + sway, 54);
      g.lineTo(i * 22 - 4 + sway, 46);
      g.closePath();
      g.fill();
    }
    g.restore();

    void bodyY;
  }

  // World positions of the chandelier bulbs, for lights and glow.
  function chandelierBulbs(live, time, mk) {
    const { x, top, hang } = CHANDELIER;
    const tilt = S.lerp(0.14, 0, mk.chandelier) + live.noise(time * 0.4) * 0.025;
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    return [-1, -0.55, 0.55, 1].map((a) => {
      const lx = a * 84;
      const ly = hang - 32;
      return { x: x + lx * cos - ly * sin, y: top + lx * sin + ly * cos };
    });
  }

  // ── Light rig ───────────────────────────────────────────────────────

  function shaftQuad(mk) {
    const { x, y, w, h } = WINDOW;
    // Night moonlight falls steeply; low morning sun throws long rays.
    const lean = S.lerp(240, 420, mk.window);
    const fall = S.lerp(1010, 1060, mk.window);
    return [
      [x + 8, y + 10],
      [x + w - 8, y + 10],
      [x + w + lean + 90, fall],
      [x + lean - 40, fall],
    ];
  }

  function lights(lm, live, time, mk) {
    const windowColor = S.mixHex(P.moon, P.dawn, mk.window);

    // Window: a broad spill plus the shaft itself.
    lm.point(WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h / 2, 520, windowColor, S.lerp(0.45, 0.85, mk.window));
    lm.shaft(shaftQuad(mk), windowColor, S.lerp(0.8, 1, mk.window));

    // Floor lamp: unreliable while dirty.
    const flick = mk.lampSteady >= 1 ? 1 : S.lerp(S.light.flicker(live.noise, time, 1.2), 1, mk.lampSteady);
    const lampY = (LAMP.shadeTop + LAMP.shadeBottom) / 2;
    lm.point(LAMP.x, lampY, 560, P.amber, 0.85 * flick);
    lm.cone(LAMP.x, LAMP.shadeBottom - 30, Math.PI / 2, 1.3, 560, P.amber, 0.75 * flick);
    lm.cone(LAMP.x, LAMP.shadeTop + 20, -Math.PI / 2, 0.9, 380, P.amber, 0.4 * flick);
    // The pool of light on the floor under the shade
    lm.point(LAMP.x, LAMP.base - 20, 260, P.amber, 0.45 * flick);

    // Sconce and chandelier come on during the makeover.
    lm.point(SCONCE.x + 26, SCONCE.y - 28, 340, P.amber, 0.8 * mk.sconce);
    if (mk.chandelierLights > 0) {
      for (const b of chandelierBulbs(live, time, mk)) {
        lm.point(b.x, b.y, 420, P.dawn, 0.35 * mk.chandelierLights);
      }
    }
    return flick;
  }

  function glow(g, lm, live, time, mk, flick) {
    const windowHex = mk.window > 0.5 ? P.dawn : P.moon;

    // Visible god rays through the dusty air.
    S.light.beam(g, shaftQuad(mk), windowHex, S.lerp(0.22, 0.32, mk.window));
    S.light.glow(g, WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h / 2, 260, windowHex, S.lerp(0.18, 0.3, mk.window));

    // Lamp shade glows from inside; the tear leaks a bright spot.
    const lampY = (LAMP.shadeTop + LAMP.shadeBottom) / 2;
    S.light.glow(g, LAMP.x, lampY, 170, P.amber, 0.55 * flick);
    S.light.glow(g, LAMP.x, LAMP.shadeBottom + 4, 90, '#FFE2B0', 0.6 * flick);
    if (mk.lampSteady < 1) {
      S.light.glow(g, LAMP.x + 42, LAMP.shadeTop + 58, 34, '#FFE2B0', 0.7 * flick * (1 - mk.lampSteady));
    }

    S.light.glow(g, SCONCE.x + 26, SCONCE.y - 28, 80, P.amber, 0.7 * mk.sconce);
    if (mk.chandelierLights > 0) {
      for (const b of chandelierBulbs(live, time, mk)) {
        S.light.glow(g, b.x, b.y, 60, P.dawn, 0.65 * mk.chandelierLights);
      }
    }
    void lm;
  }

  S.rooms = S.rooms || {};
  S.rooms.livingRoom = {
    layout,
    paint,
    makeWebs,
    createLive,
    drawSky,
    drawProps,
    lights,
    glow,
    shaftQuad,
  };
})();
