/*
 * Spyder — Room 4: the Kitchen.
 *
 * A 1960s family kitchen, abandoned mid-life: the kettle still on the stove,
 * the calendar on an October page, the fridge door not quite shut and its
 * cold light lying across the floor. This is the room that introduces the
 * Jumper (lib/spider-types/jumper.js), a spider that lives on the counter,
 * the table and the floor and leaps at the hero.
 *
 * It follows the Living Room's template (rooms/living-room/room.js): data
 * and painting only, everything else is the runtime's. What it adds:
 *
 *   - Props drawn live because they change while the room is played: the
 *     swinging pendant lamp (a dart or a spider sets it going, its light
 *     swings with it), the ajar fridge door, the café curtain, the tap.
 *   - The recipe card and the calendar are drawn live as well, from small
 *     cached canvases, because they carry handwriting: the cached room
 *     layers are painted the moment the room loads, possibly before the
 *     fonts have arrived, and would keep the fallback font for good.
 *   - Its unique makeover beat (ART-DIRECTION §10): the fridge door swings
 *     shut, the tap sputters brown and runs clear, the kettle whistles.
 *
 * Decisions that differ from the prompt's table are listed in NOTES.md.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const { paintShape, wobblyPath, rectPoints, roundedRectPoints, ellipsePoints, softShadow, stain } = S.paint;

  // ── Layout (stage units) ──────────────────────────────────────────────

  const CEILING = 100; // underside of the cornice; string spiders drop from here
  const PAPER_END = 440; // wallpaper above, the tiled backsplash below
  const RAIL = 560; // away from the counter: wallpaper down to a chair rail, beadboard below
  const TILE_END = 935; // the tiling stops just past the end of the counter
  const FLOOR_LINE = 770; // where the wall meets the linoleum
  const GROUND = 935; // where the hero walks
  const TILE = 55; // wall tile, grout included

  const WINDOW = { x: 560, y: 210, w: 300, h: 270 }; // the glass
  const MEETING = 340; // the sash meeting rail; the café curtain hangs from it
  const CAB_LEFT = { x: 90, y: 150, w: 430, h: 250 };
  const CAB_GLASS = { x: 1180, y: 150, w: 320, h: 250 };
  const COUNTER = { x0: 100, x1: 900, top: 700, front: 714, floor: 852 };
  const STOVE = { x0: 140, x1: 420 };
  const SINK = { x0: 600, x1: 820 };
  const TAP = { x: 712, spoutX: 758, spoutY: 655 };
  const KETTLE = { x: 322, base: 694 };
  const PILOT = { x: 254, y: 698 };
  const DRAWER = { x0: 436, x1: 586, y: 816 }; // the bottom drawer, left pulled out
  const FRIDGE = { x0: 940, x1: 1110, top: 300, floor: 852 };
  const SLIT_X = 1104; // the fridge door's free edge
  const STOOL = { x0: 1150, x1: 1215, top: 830, floor: 888 };
  const TABLE = { x0: 1260, x1: 1640, top: 760, hem: 806, floor: 868 };
  const PENDANT = { x: 1450, cord: 168, shade: 62 }; // shade from y 268 to 330
  const CALENDAR = { x: 1560, y: 324, w: 100, h: 140 };
  const RECIPE = { x: 1004, y: 548 }; // centre of the card on the fridge door
  const PANS = { y: 458, x0: 166, x1: 404 };

  const layout = {
    name: 'Kitchen',
    act: 1,
    number: 4,
    CEILING,
    FLOOR_LINE,
    GROUND,
    heroStart: 1230,
    bounds: { left: 90, right: 1830 },
    platforms: [
      { name: 'floor', x0: 0, x1: 1920, y: GROUND, oneWay: false },
      { name: 'counter', x0: 110, x1: 890, y: COUNTER.top, oneWay: true },
      { name: 'drawer', x0: DRAWER.x0, x1: DRAWER.x1, y: DRAWER.y, oneWay: true },
      { name: 'stool', x0: STOOL.x0, x1: STOOL.x1, y: STOOL.top, oneWay: true },
      { name: 'table', x0: TABLE.x0 + 10, x1: TABLE.x1 - 10, y: TABLE.top, oneWay: true },
    ],
    dropPoints: [230, 420, 640, 820, 1030, 1290, 1478, 1700],
    hoverBand: [360, 620],
    // Wall crawlers come out of these.
    lairs: [
      { x: 760, y: 140, label: 'crack in the cornice' },
      { x: (FRIDGE.x0 + FRIDGE.x1) / 2, y: FRIDGE.top - 4, label: 'gap above the fridge' },
      { x: CALENDAR.x + CALENDAR.w / 2, y: CALENDAR.y + CALENDAR.h + 4, label: 'behind the calendar' },
      { x: CAB_LEFT.x + CAB_LEFT.w + 14, y: 300, label: 'beside the cabinets' },
    ],
    wallArea: { x0: 90, x1: 1830, y0: CEILING + 30, y1: 650 },
    // Jumpers come out of these (see lib/spider-types/jumper.js).
    jumperLairs: [
      {
        label: 'under the fridge',
        surface: 'floor',
        from: { x: 972, y: 856 },
        to: { x: 972, y: GROUND },
        moves: 'depth',
        heading: Math.PI / 2, // facing the camera as it comes out
        time: 1.0,
        fade: true,
        clip: { x0: 0, y0: FRIDGE.floor - 8, x1: 1920, y1: 1080 },
      },
      {
        label: 'behind the stove',
        surface: 'counter',
        from: { x: 360, y: COUNTER.top },
        to: { x: 476, y: COUNTER.top },
        moves: 'walk',
        heading: 0,
        time: 1.1,
        clip: { x0: STOVE.x1 + 2, y0: 0, x1: 1920, y1: 1080 },
      },
      {
        label: 'out of the sink drain',
        surface: 'counter',
        from: { x: 652, y: COUNTER.top + 40 },
        to: { x: 652, y: COUNTER.top },
        moves: 'climb',
        heading: 0,
        time: 1.1,
        clip: { x0: 0, y0: 0, x1: 1920, y1: COUNTER.top + 3 },
      },
    ],
    window: WINDOW,
    lookout: { x: WINDOW.x + WINDOW.w / 2, y: WINDOW.y + 110 },
    breakables: [{ x: 1180, y: GROUND, contains: 'flamethrower' }],
  };

  // ── Colours, mixed from the palette (ART-DIRECTION §3) ────────────────

  const TONE = {
    paint: S.mixHex(P.linen, S.mixHex(P.moss, P.taupe, 0.72), 0.42), // cabinet paint: warm muted sage-taupe
    wainscot: S.mixHex(P.linen, S.mixHex(P.moss, P.taupe, 0.78), 0.46), // beadboard: warm muted sage shifted toward taupe
    paper: S.mixHex(S.mixHex(P.linen, P.bone, 0.28), P.oak, 0.34), // buttery wallpaper
    tile: S.mixHex(S.mixHex(P.bone, P.linen, 0.5), P.oak, 0.12), // glazed cream tile
    grout: S.mixHex(P.linen, P.taupe, 0.55),
    trim: S.mixHex(S.mixHex(P.moss, P.taupe, 0.35), P.linen, 0.28), // the green bullnose row
    lino: S.mixHex(S.mixHex(P.linen, P.bone, 0.3), P.oak, 0.1),
    oxblood: S.mixHex(P.rust, P.plum, 0.45),
    enamel: S.mixHex(P.bone, P.linen, 0.45),
    chrome: S.mixHex(P.gear, P.bone, 0.55),
    copper: S.mixHex(P.rust, P.ember, 0.32),
    verdigris: S.mixHex(P.moss, P.goo, 0.45),
    terracotta: S.mixHex(P.rust, P.linen, 0.2),
    leaf: S.mixHex(P.moss, P.goo, 0.32),
    vinyl: S.mixHex(P.rust, P.plum, 0.22),
    check: S.mixHex(P.rust, P.ember, 0.12),
    plaster: S.mixHex(P.taupe, P.umber, 0.3),
  };
  // Fridge light: moonlight-cold, a little whitened by the bulb inside.
  const COLD = S.mixHex(P.moon, P.silk, 0.18);
  // Handwriting: a blue-black fountain-pen ink, and a softer pencil grey.
  const INK = S.shadeHex(S.mixHex(P.gear, P.plum, 0.4), -0.35);
  const PENCIL = S.mixHex(P.gear, P.plum, 0.3);
  // Dust and grime are warm in this house: old varnish, cooking fat, tea.
  const DUST = S.mixHex(P.taupe, P.oak, 0.4);

  // A surface after fifteen years: darker, the colour sunk into warm dust.
  function aged(hex, clean, amount = 1) {
    if (clean) return hex;
    return S.mixHex(S.shadeHex(hex, -0.26 * amount), DUST, 0.22 * amount);
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
    paintCeiling(g, clean);
    paintWallpaper(g, clean);
    paintWallTiles(g, clean);
    paintWainscot(g, clean);
    paintSideWalls(g);
    paintFloor(g, clean);
    paintWindowFrame(g, clean);
    paintLeftCabinets(g, clean);
    paintGlassCabinet(g, clean);
    paintWallPhone(g, clean);
    paintPanRack(g, clean);
    paintFridge(g, clean);
    paintRecipe(g, clean);
    paintCalendar(g, clean);
    paintCeilingCup(g, clean);
    if (!clean) paintBackGrime(g);
  }

  // Plaster ceiling with a coved cornice. The crack is the house's own; the
  // makeover fills it, leaving a hairline.
  function paintCeiling(g, clean) {
    paintShape(g, rectPoints(0, 0, 1920, CEILING + 4), {
      color: aged(TONE.plaster, clean, 0.6),
      lightDir: { x: 0, y: 1 },
      light: 0.16,
      shadow: 0.5,
      strokes: 9,
      strokeAngle: 0,
      strokeJitter: 0.8,
      rim: 0,
      wobble: 0,
      seed: 401,
    });
    // Crack: a jagged line with a dark gap and a pale lip below it.
    const rng = S.createRng(402);
    const pts = [[560, 4]];
    let x = 560;
    let y = 4;
    while (x < 1010) {
      x += rng.range(14, 30);
      y = S.clamp(y + rng.range(-4, 10), 4, CEILING - 24);
      pts.push([x, y]);
    }
    g.save();
    g.lineJoin = 'round';
    g.strokeStyle = clean ? 'rgba(20,14,10,0.16)' : 'rgba(14,10,7,0.65)';
    g.lineWidth = clean ? 1 : 2.4;
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.stroke();
    if (!clean) {
      g.strokeStyle = 'rgba(200,185,160,0.14)';
      g.lineWidth = 1.2;
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px + 1, py + 3) : g.moveTo(px + 1, py + 3)));
      g.stroke();
      // A branch off the main crack
      g.strokeStyle = 'rgba(14,10,7,0.5)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(pts[7][0], pts[7][1]);
      for (let i = 1; i < 6; i++) g.lineTo(pts[7][0] + i * 18, pts[7][1] - i * 3 + (i % 2) * 5);
      g.stroke();
    }
    g.restore();

    // Cornice: a cove that catches light from below, then a sharp shadow.
    const cove = g.createLinearGradient(0, CEILING - 22, 0, CEILING);
    cove.addColorStop(0, S.shade(aged(TONE.paint, clean), -0.25));
    cove.addColorStop(1, S.shade(aged(TONE.paint, clean), 0.08));
    g.fillStyle = cove;
    g.fillRect(0, CEILING - 22, 1920, 22);
    g.fillStyle = S.shade(aged(TONE.paint, clean), 0.18);
    g.fillRect(0, CEILING - 4, 1920, 5);
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.fillRect(0, CEILING + 1, 1920, 6);
  }

  // Faded wallpaper: buttery ground, a tiny apple-and-cherry print at low
  // contrast (alpha ≈ 0.25), with roll seams.
  function paintWallpaper(g, clean) {
    const base = aged(S.shadeHex(TONE.paper, -0.12), clean, 1.1);
    paintShape(g, rectPoints(0, CEILING, 1920, RAIL - CEILING + 6), {
      color: base,
      lightDir: { x: 0.1, y: -1 },
      light: 0.1,
      shadow: 0.26,
      strokes: 9,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.12,
      variance: 0.08,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 411,
    });
    const ink = clean ? S.mixHex(TONE.leaf, P.linen, 0.25) : S.mixHex(TONE.leaf, P.taupe, 0.3);
    const fruit = clean ? S.mixHex(P.rust, P.linen, 0.2) : S.mixHex(P.rust, P.taupe, 0.45);
    const alpha = clean ? 0.3 : 0.22;
    const rng = S.createRng(412);
    g.save();
    g.beginPath();
    g.rect(0, CEILING, 1920, RAIL - CEILING);
    g.clip();
    // Faint double stripes
    for (let x = 0; x < 1920; x += 96) {
      g.fillStyle = S.rgba(ink, 0.06);
      g.fillRect(x, CEILING, 3, RAIL - CEILING);
      g.fillRect(x + 7, CEILING, 2, RAIL - CEILING);
    }
    // The print, in a half-drop repeat with a printer's slight wander.
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 21; col++) {
        const x = col * 96 + 48 + (row % 2) * 48 + rng.range(-2, 2);
        const y = CEILING + 26 + row * 50 + rng.range(-1.5, 1.5);
        if ((row + col) % 2) appleMotif(g, x, y, S.rgba(fruit, alpha), S.rgba(ink, alpha));
        else cherryMotif(g, x, y, S.rgba(fruit, alpha), S.rgba(ink, alpha));
      }
    }
    // Seams between the rolls
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 1.5;
    for (let x = 170; x < 1920; x += 268) {
      g.beginPath();
      g.moveTo(x, CEILING);
      g.lineTo(x + rng.range(-2, 2), RAIL);
      g.stroke();
    }
    g.restore();
  }

  // Away from the counter the wall is beadboard below a chair rail, painted
  // a muted warm sage so it reads warm amber under the pendant light.
  function paintWainscot(g, clean) {
    const x0 = TILE_END;
    const wood = aged(S.shadeHex(TONE.wainscot, -0.1), clean);
    paintShape(g, rectPoints(x0, RAIL, 1920 - x0, FLOOR_LINE - RAIL), {
      color: wood,
      lightDir: { x: 0.2, y: -1 },
      light: 0.12,
      shadow: 0.42,
      strokes: 12,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.05,
      rim: 0,
      innerShadow: 0,
      wobble: 0,
      seed: 466,
    });
    // Tongue-and-groove boards
    for (let x = x0 + 16; x < 1920; x += 30) {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x, RAIL + 10, 2, FLOOR_LINE - RAIL - 26);
      g.fillStyle = 'rgba(255,236,210,0.07)';
      g.fillRect(x + 2, RAIL + 10, 2, FLOOR_LINE - RAIL - 26);
    }
    // Chair rail and skirting
    paintShape(g, rectPoints(x0 - 4, RAIL - 6, 1924 - x0, 16), {
      color: S.shadeHex(wood, 0.12),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.35,
      strokes: 6,
      strokeAngle: 0,
      rim: 0.4,
      seed: 467,
      wobble: 0.4,
    });
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x0, RAIL + 10, 1920 - x0, 4);
    const skirt = g.createLinearGradient(0, FLOOR_LINE - 20, 0, FLOOR_LINE);
    skirt.addColorStop(0, S.shadeHex(wood, -0.1));
    skirt.addColorStop(1, S.shadeHex(wood, -0.45));
    g.fillStyle = skirt;
    g.fillRect(x0, FLOOR_LINE - 20, 1920 - x0, 20);
    g.fillStyle = 'rgba(255,230,200,0.08)';
    g.fillRect(x0, FLOOR_LINE - 20, 1920 - x0, 2);
  }

  function appleMotif(g, x, y, fruit, leaf) {
    g.fillStyle = fruit;
    g.beginPath();
    g.arc(x - 3, y, 6.5, 0, Math.PI * 2);
    g.arc(x + 3, y, 6.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = leaf;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(x, y - 5);
    g.quadraticCurveTo(x + 1, y - 10, x + 3, y - 12);
    g.stroke();
    g.fillStyle = leaf;
    g.beginPath();
    g.ellipse(x + 6, y - 11, 5, 2.4, -0.5, 0, Math.PI * 2);
    g.fill();
  }

  function cherryMotif(g, x, y, fruit, leaf) {
    g.strokeStyle = leaf;
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(x - 6, y + 6);
    g.quadraticCurveTo(x - 3, y - 6, x + 2, y - 10);
    g.moveTo(x + 6, y + 5);
    g.quadraticCurveTo(x + 4, y - 4, x + 2, y - 10);
    g.stroke();
    g.fillStyle = leaf;
    g.beginPath();
    g.ellipse(x + 6, y - 11, 4.5, 2, 0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = fruit;
    g.beginPath();
    g.arc(x - 6, y + 8, 4, 0, Math.PI * 2);
    g.arc(x + 6, y + 7, 4, 0, Math.PI * 2);
    g.fill();
  }

  // Glazed cream tiles from the wallpaper down to the floor. Each tile gets
  // its own tone, a glaze highlight and a bevel; the grout is wobbly, so the
  // field reads as laid by hand rather than ruled. Dirty: grease above the
  // stove, cracks, and a few tiles gone, showing the combed adhesive.
  const MISSING = [[3, 2], [9, 3], [13, 1], [15, 3]];
  const CRACKED = [[2, 1], [5, 3], [6, 1], [8, 0], [11, 2], [14, 0], [16, 2]];

  function paintWallTiles(g, clean) {
    const top = PAPER_END;
    const bottom = FLOOR_LINE;
    const tile = aged(TONE.tile, clean, 1);
    const grout = aged(TONE.grout, clean, 0.5);
    g.fillStyle = grout;
    g.fillRect(0, top, TILE_END, bottom - top);

    const tone = S.createRng(421); // the same tiles in both states
    const cols = Math.round(TILE_END / TILE);
    const rows = Math.ceil((bottom - top) / TILE);
    const isIn = (list, c, r) => list.some(([lc, lr]) => lc === c && lr === r);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * TILE + 1.5;
        const y = top + r * TILE + 1.5;
        const w = TILE - 3;
        const h = Math.min(TILE - 3, bottom - y);
        const jitter = tone.range(-0.06, 0.06);
        const dab = tone.next();
        if (!clean && isIn(MISSING, c, r)) {
          missingTile(g, x, y, w, h, c * 7 + r);
          continue;
        }
        const face = g.createLinearGradient(x, y, x + w, y + h);
        face.addColorStop(0, S.shade(tile, 0.1 + jitter));
        face.addColorStop(0.6, S.shade(tile, jitter));
        face.addColorStop(1, S.shade(tile, -0.12 + jitter));
        g.fillStyle = face;
        g.beginPath();
        g.roundRect(x, y, w, h, 3);
        g.fill();
        // Glaze: a soft sheen top-left and a few brush dabs.
        g.fillStyle = `rgba(255,248,232,${clean ? 0.16 : 0.08})`;
        g.beginPath();
        g.ellipse(x + w * 0.32, y + h * 0.28, w * 0.26, h * 0.14, -0.5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.shade(tile, dab > 0.5 ? 0.06 : -0.08, 0.18);
        g.beginPath();
        g.ellipse(x + w * (0.3 + dab * 0.4), y + h * (0.55 + dab * 0.2), 12, 3, 0.2, 0, Math.PI * 2);
        g.fill();
        // Bevel
        g.strokeStyle = 'rgba(255,240,215,0.16)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x + 2, y + h - 3);
        g.lineTo(x + 2, y + 2);
        g.lineTo(x + w - 3, y + 2);
        g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.22)';
        g.beginPath();
        g.moveTo(x + w - 1, y + 3);
        g.lineTo(x + w - 1, y + h - 1);
        g.lineTo(x + 3, y + h - 1);
        g.stroke();
        if (!clean && isIn(CRACKED, c, r)) crackTile(g, x, y, w, h, c * 13 + r);
      }
    }

    // Wobbly grout over the tile edges.
    g.save();
    g.strokeStyle = S.rgba(grout, 0.9);
    g.lineWidth = 2.6;
    for (let r = 1; r < rows; r++) {
      const y = top + r * TILE;
      wobblyPath(g, [[0, y], [TILE_END, y]], { wobble: 0.7, step: 22, seed: 430 + r, closed: false });
      g.stroke();
    }
    for (let c = 1; c < cols; c++) {
      const x = c * TILE;
      wobblyPath(g, [[x, top], [x, bottom]], { wobble: 0.7, step: 22, seed: 450 + c, closed: false });
      g.stroke();
    }
    g.restore();

    // The top row is a green bullnose trim, the edge of the tiling.
    paintShape(g, rectPoints(0, top - 4, TILE_END + 8, 14), {
      color: aged(TONE.trim, clean, 0.9),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.35,
      strokes: 6,
      strokeAngle: 0,
      rim: 0.35,
      innerShadow: 0.2,
      wobble: 0.5,
      seed: 461,
    });
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, top + 10, TILE_END, 3);
    // …and down the end of the tiling.
    paintShape(g, rectPoints(TILE_END - 2, top - 4, 10, bottom - top + 4), {
      color: aged(TONE.trim, clean, 0.9),
      lightDir: { x: -1, y: 0 },
      light: 0.25,
      shadow: 0.35,
      strokes: 4,
      strokeAngle: Math.PI / 2,
      rim: 0.3,
      innerShadow: 0.1,
      wobble: 0.4,
      seed: 462,
    });

    // A dark cove tile where wall meets floor.
    const cove = g.createLinearGradient(0, bottom - 16, 0, bottom);
    cove.addColorStop(0, S.shade(aged(TONE.oxblood, clean), 0.05));
    cove.addColorStop(1, S.shade(aged(TONE.oxblood, clean), -0.35));
    g.fillStyle = cove;
    g.fillRect(0, bottom - 16, TILE_END, 16);
    g.fillStyle = 'rgba(255,230,200,0.08)';
    g.fillRect(0, bottom - 16, TILE_END, 2);

    if (!clean) {
      // Grease climbing the tiles above the stove, and dull grime overall.
      g.save();
      g.filter = 'blur(18px)';
      g.fillStyle = 'rgba(58,40,22,0.42)';
      g.beginPath();
      g.ellipse((STOVE.x0 + STOVE.x1) / 2, 640, 170, 90, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(70,58,40,0.25)';
      g.fillRect(0, top + 20, TILE_END, bottom - top - 20);
      g.restore();
      for (const [x, y, r, seed] of [[260, 600, 46, 471], [160, 520, 30, 472], [520, 650, 26, 473], [1190, 650, 34, 474]]) {
        stain(g, x, y, r, '#3A2814', seed, 0.38);
      }
    }
  }

  function missingTile(g, x, y, w, h, seed) {
    const rng = S.createRng(seed + 900);
    // Combed adhesive on bare plaster.
    g.fillStyle = '#4B3E30';
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.strokeStyle = 'rgba(110,92,66,0.5)';
    g.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const yy = y + 6 + i * (h / 6);
      g.beginPath();
      g.moveTo(x + 2, yy);
      g.quadraticCurveTo(x + w / 2, yy + rng.range(-4, 4), x + w - 2, yy + rng.range(-2, 2));
      g.stroke();
    }
    // A chipped shard of tile still stuck in one corner.
    g.fillStyle = S.shade(aged(TONE.tile, false), 0.02);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w * rng.range(0.3, 0.5), y);
    g.lineTo(x + w * 0.18, y + h * rng.range(0.25, 0.4));
    g.lineTo(x, y + h * 0.5);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x, y + h - 4, w, 4);
  }

  function crackTile(g, x, y, w, h, seed) {
    const rng = S.createRng(seed + 700);
    g.save();
    g.strokeStyle = 'rgba(20,14,10,0.6)';
    g.lineWidth = 1.2;
    g.beginPath();
    let cx = x + rng.range(0, w);
    let cy = y;
    g.moveTo(cx, cy);
    while (cy < y + h) {
      cx = S.clamp(cx + rng.range(-9, 9), x, x + w);
      cy += rng.range(6, 14);
      g.lineTo(cx, Math.min(cy, y + h));
    }
    g.stroke();
    g.restore();
  }

  // Narrow side walls in perspective, as in the Living Room.
  function paintSideWalls(g) {
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
  }

  // Checkerboard linoleum in the Living Room's one-point perspective (the
  // same vanishing point, 960 / -900). Rows are spaced for square tiles:
  // with the horizon at -900 and a viewing distance of 3600, a row is about
  // half as deep as it is wide, shrinking toward the wall.
  const FLOOR_VP = { x: 960, y: -900 };
  const FLOOR_F = 3600;
  const FLOOR_W0 = 96; // tile width along the bottom edge of the frame

  function floorRowY(k) {
    return FLOOR_VP.y + (1080 - FLOOR_VP.y) / (1 + (k * FLOOR_W0) / FLOOR_F);
  }
  function floorX(xBottom, y) {
    return FLOOR_VP.x + (xBottom - FLOOR_VP.x) * ((y - FLOOR_VP.y) / (1080 - FLOOR_VP.y));
  }

  function paintFloor(g, clean) {
    const top = FLOOR_LINE;
    // Dirty, the cream squares have gone the colour of the dust on them.
    const cream = aged(TONE.lino, clean, 1.5);
    // Clean, the oxblood is still a worn linoleum red, not a new one.
    const red = clean ? S.mixHex(TONE.oxblood, P.umber, 0.22) : aged(TONE.oxblood, clean, 0.8);
    g.fillStyle = S.shade(red, -0.3);
    g.fillRect(0, top, 1920, 1080 - top);

    const rng = S.createRng(481);
    g.save();
    g.beginPath();
    g.rect(0, top, 1920, 1080 - top);
    g.clip();
    for (let k = 0; ; k++) {
      const yNear = floorRowY(k);
      const yFar = floorRowY(k + 1);
      if (yNear <= top) break;
      for (let c = -16; c <= 16; c++) {
        const xb0 = FLOOR_VP.x + (c - 0.5) * FLOOR_W0;
        const xb1 = xb0 + FLOOR_W0;
        const quad = [
          [floorX(xb0, yFar), yFar],
          [floorX(xb1, yFar), yFar],
          [floorX(xb1, yNear), yNear],
          [floorX(xb0, yNear), yNear],
        ];
        if (quad[1][0] < -10 || quad[0][0] > 1930) continue;
        const dark = (c + k) % 2 !== 0;
        const base = dark ? red : cream;
        const jitter = rng.range(-0.05, 0.05);
        const grad = g.createLinearGradient(0, yFar, 0, yNear);
        grad.addColorStop(0, S.shade(base, 0.05 + jitter));
        grad.addColorStop(1, S.shade(base, -0.08 + jitter));
        g.fillStyle = grad;
        wobblyPath(g, quad, { wobble: 0.7, step: 24, seed: 490 + c * 31 + k });
        g.fill();
        // Brush texture inside the tile, running across it.
        const cx = (quad[0][0] + quad[2][0]) / 2;
        const cy = (yFar + yNear) / 2;
        for (let i = 0; i < 5; i++) {
          g.fillStyle = S.shade(base, rng.range(-0.1, 0.1), rng.range(0.06, 0.18));
          g.beginPath();
          g.ellipse(cx + rng.range(-36, 36), cy + rng.range(-12, 12), rng.range(8, 26), rng.range(1.2, 3), rng.range(-0.15, 0.15), 0, Math.PI * 2);
          g.fill();
        }
        // The near edge of each tile catches a little light; the far edge
        // sits in a hairline of shadow.
        g.strokeStyle = `rgba(255,236,210,${dark ? 0.05 : 0.1})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(quad[0][0] + 2, yFar + 1.5);
        g.lineTo(quad[1][0] - 2, yFar + 1.5);
        g.stroke();
      }
    }
    // Seams between the tiles, slightly wobbly.
    g.strokeStyle = 'rgba(12,8,6,0.45)';
    g.lineWidth = 1.4;
    for (let k = 1; ; k++) {
      const y = floorRowY(k);
      if (y <= top) break;
      wobblyPath(g, [[0, y], [1920, y]], { wobble: 0.6, step: 30, seed: 520 + k, closed: false });
      g.stroke();
    }
    for (let c = -16; c <= 17; c++) {
      const xb = FLOOR_VP.x + (c - 0.5) * FLOOR_W0;
      wobblyPath(g, [[floorX(xb, top), top], [xb, 1080]], { wobble: 0.6, step: 30, seed: 560 + c, closed: false });
      g.stroke();
    }

    if (clean) {
      // Polished: a soft sheen where the window and lamp light pool.
      for (const [x, y, r, a] of [[760, 960, 520, 0.12], [1450, 900, 460, 0.1]]) {
        const sheen = g.createRadialGradient(x, y, 10, x, y, r);
        sheen.addColorStop(0, `rgba(255,232,196,${a})`);
        sheen.addColorStop(1, 'rgba(255,232,196,0)');
        g.fillStyle = sheen;
        g.fillRect(0, top, 1920, 1080 - top);
      }
    }
    g.restore();

    // Contact shadow along the wall, and the floor nearest the camera
    // falling into shadow, so the checks do not run edge to edge at one value.
    const shadow = g.createLinearGradient(0, top, 0, top + 70);
    shadow.addColorStop(0, 'rgba(0,0,0,0.55)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = shadow;
    g.fillRect(0, top, 1920, 70);
    const near = g.createLinearGradient(0, 930, 0, 1080);
    near.addColorStop(0, 'rgba(12,8,6,0)');
    near.addColorStop(1, `rgba(12,8,6,${clean ? 0.22 : 0.42})`);
    g.fillStyle = near;
    g.fillRect(0, 930, 1920, 150);
    for (const side of [0, 1]) {
      const edge = g.createLinearGradient(side ? 1920 : 0, 0, side ? 1560 : 360, 0);
      edge.addColorStop(0, `rgba(12,8,6,${clean ? 0.2 : 0.38})`);
      edge.addColorStop(1, 'rgba(12,8,6,0)');
      g.fillStyle = edge;
      g.fillRect(side ? 1560 : 0, top, 360, 1080 - top);
    }
  }

  // The window over the sink: a painted wooden sash window set deep into the
  // wall, its glass cut out so the garden (drawSky) shows through.
  function paintWindowFrame(g, clean) {
    const { x, y, w, h } = WINDOW;
    const wood = aged(S.shadeHex(TONE.paint, 0.12), clean, 0.9);
    g.save();
    g.filter = 'blur(10px)';
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(x - 40, y - 24, w + 70, h + 70);
    g.restore();
    paintShape(g, rectPoints(x - 24, y - 24, w + 48, h + 48), {
      color: wood,
      lightDir: { x: 0.2, y: -1 },
      light: 0.18,
      shadow: 0.35,
      strokes: 8,
      strokeAngle: Math.PI / 2,
      rim: 0.35,
      seed: 501,
      wobble: 0.6,
    });
    // The reveal: the window sits back inside a thick wall.
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x - 8, y - 8, w + 16, h + 16);
    g.clearRect(x, y, w, h);

    // Sashes: a meeting rail and a centre muntin, with bevels.
    const bar = S.shade(wood, -0.08);
    g.fillStyle = bar;
    g.fillRect(x, MEETING - 6, w, 14);
    g.fillRect(x + w / 2 - 6, y, 12, h);
    g.fillStyle = 'rgba(255,240,215,0.14)';
    g.fillRect(x, MEETING - 6, w, 3);
    g.fillRect(x + w / 2 - 6, y, 3, h);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x, MEETING + 6, w, 3);
    // The sash lock on the meeting rail
    g.fillStyle = TONE.chrome;
    g.beginPath();
    g.ellipse(x + w / 2, MEETING - 8, 12, 5, 0, 0, Math.PI * 2);
    g.fill();

    // Sill, with the herbs' shadows (the pots themselves are furniture).
    paintShape(g, rectPoints(x - 44, y + h + 8, w + 88, 18), {
      color: wood,
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.4,
      strokes: 6,
      rim: 0.45,
      seed: 502,
      wobble: 0.5,
    });
    softShadow(g, x + w / 2, y + h + 34, w * 0.62, 10, 0.45);
  }

  // Upper cabinets on the left: painted wood, three panelled doors, chrome
  // knobs, a crown on top and the strip light fitting underneath.
  function paintLeftCabinets(g, clean) {
    const { x, y, w, h } = CAB_LEFT;
    // A shade less aged than the base cabinets: high up, and the room's
    // darkest corner would otherwise swallow them.
    const paintTone = aged(TONE.paint, clean, 0.7);
    wallShadow(g, x - 12, y + 12, w, h, 12, 0.5);
    // Its right side faces the window: a cold edge of moonlight while dirty.
    cabinetBox(g, x, y, w, h, paintTone, 511, clean ? null : S.mixHex(P.moon, P.linen, 0.4));
    const doors = 3;
    const inset = 10;
    const dw = (w - inset * 2 - (doors - 1) * 6) / doors;
    for (let i = 0; i < doors; i++) {
      const dx = x + inset + i * (dw + 6);
      panelDoor(g, dx, y + 16, dw, h - 34, paintTone, 512 + i);
      const knobX = i === 0 ? dx + dw - 16 : dx + 16;
      chromeKnob(g, knobX, y + h - 40, 6, clean);
    }
    stripFitting(g, x + 8, y + h, w - 16, clean);
    if (!clean) {
      // Dust thick on the crown and one door hanging open a crack.
      g.save();
      g.filter = 'blur(4px)';
      g.fillStyle = 'rgba(170,160,140,0.3)';
      g.fillRect(x - 6, y - 10, w + 12, 8);
      g.restore();
      g.fillStyle = 'rgba(10,7,5,0.7)';
      g.fillRect(x + inset + dw + 3, y + 18, 5, h - 38);
    }
  }

  // Glass-fronted cabinet on the right: plates stand behind the glass.
  // Dirty: one plate is missing (it is in pieces on the floor below), the
  // rest lean in the dust. Clean: plates stacked and standing in a row.
  function paintGlassCabinet(g, clean) {
    const { x, y, w, h } = CAB_GLASS;
    const paintTone = aged(TONE.paint, clean);
    wallShadow(g, x - 10, y + 12, w, h, 12, 0.5);
    cabinetBox(g, x, y, w, h, paintTone, 521);

    const inset = 12;
    const dw = (w - inset * 2 - 6) / 2;
    const gy = y + 18;
    const gh = h - 38;
    for (let i = 0; i < 2; i++) {
      const dx = x + inset + i * (dw + 6);
      // Door frame
      paintShape(g, rectPoints(dx, gy, dw, gh), {
        color: S.shadeHex(paintTone, 0.04),
        lightDir: { x: 0.4, y: -0.9 },
        light: 0.2,
        shadow: 0.35,
        strokes: 8,
        strokeAngle: Math.PI / 2,
        rim: 0.3,
        seed: 522 + i,
        wobble: 0.4,
      });
      const px = dx + 12;
      const py = gy + 12;
      const pw = dw - 24;
      const ph = gh - 24;
      // Inside: a dark cupboard with two shelves.
      const inside = g.createLinearGradient(0, py, 0, py + ph);
      inside.addColorStop(0, '#231C17');
      inside.addColorStop(1, '#16110E');
      g.fillStyle = inside;
      g.fillRect(px, py, pw, ph);
      const shelfY = [py + ph * 0.48, py + ph - 4];
      for (const sy of shelfY) {
        g.fillStyle = S.shade(paintTone, -0.35);
        g.fillRect(px, sy - 5, pw, 6);
        g.fillStyle = 'rgba(255,235,210,0.1)';
        g.fillRect(px, sy - 5, pw, 1.5);
      }
      platesOnShelf(g, px, shelfY[0] - 5, pw, i, clean, 'standing');
      platesOnShelf(g, px, shelfY[1] - 5, pw, i, clean, i === 0 ? 'stack' : 'cups');
      // The glass: grime or a clean sheen, and a reflection streak.
      g.save();
      g.beginPath();
      g.rect(px, py, pw, ph);
      g.clip();
      if (!clean) {
        g.fillStyle = 'rgba(120,112,98,0.32)';
        g.fillRect(px, py, pw, ph);
        g.filter = 'blur(10px)';
        g.fillStyle = 'rgba(140,130,112,0.35)';
        g.beginPath();
        g.ellipse(px + pw * 0.3, py + ph * 0.8, 50, 30, 0.3, 0, Math.PI * 2);
        g.fill();
        g.filter = 'none';
      }
      g.fillStyle = `rgba(255,250,240,${clean ? 0.1 : 0.05})`;
      g.beginPath();
      g.moveTo(px + 10, py + ph);
      g.lineTo(px + 34, py + ph);
      g.lineTo(px + 74, py);
      g.lineTo(px + 50, py);
      g.closePath();
      g.fill();
      g.restore();
      // Muntin across the middle of each door
      g.fillStyle = S.shadeHex(paintTone, -0.02);
      g.fillRect(px, shelfY[0] - 9, pw, 8);
      chromeKnob(g, i === 0 ? dx + dw - 8 : dx + 8, gy + gh / 2 + 30, 5, clean);
    }
    stripFitting(g, x + 8, y + h, w - 16, clean);
  }

  // A wall telephone with a rotary dial. Dirty: the receiver hangs off the
  // hook on its coiled cord, as if someone put it down mid-call. Clean: back
  // on its cradle.
  function paintWallPhone(g, clean) {
    const x = 1738;
    const y = 352;
    const body = aged(S.mixHex(P.bone, P.linen, 0.35), clean, 1);
    wallShadow(g, x - 40, y + 10, 62, 94, 8, 0.45);
    paintShape(g, roundedRectPoints(x - 30, y, 60, 92, 12), {
      color: body,
      lightDir: { x: -0.6, y: -0.8 },
      light: 0.25,
      shadow: 0.45,
      strokes: 8,
      rim: 0.45,
      seed: 581,
      wobble: 0.4,
    });
    // The dial: a darker disc, ten finger holes, a white centre.
    const dx = x;
    const dy = y + 54;
    g.fillStyle = S.shadeHex(body, -0.22);
    g.beginPath();
    g.arc(dx, dy, 19, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.shadeHex(body, -0.5);
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI * 0.35 + (i / 10) * Math.PI * 1.6;
      g.beginPath();
      g.arc(dx + Math.cos(a) * 12.5, dy + Math.sin(a) * 12.5, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = S.shadeHex(body, 0.15);
    g.beginPath();
    g.arc(dx, dy, 6, 0, Math.PI * 2);
    g.fill();
    // The cradle's two prongs
    g.fillStyle = S.shadeHex(body, -0.3);
    g.fillRect(x - 22, y - 6, 8, 10);
    g.fillRect(x + 14, y - 6, 8, 10);

    const handset = (hx, hy, angle) => {
      g.save();
      g.translate(hx, hy);
      g.rotate(angle);
      // Earpiece and mouthpiece cups at the two ends, the grip between.
      paintShape(g, [[-46, -5], [46, -5], [53, 8], [40, 19], [24, 5], [-24, 5], [-40, 19], [-53, 8]], {
        color: body,
        lightDir: { x: 0, y: -1 },
        light: 0.3,
        shadow: 0.4,
        strokes: 6,
        rim: 0.4,
        seed: 582,
        wobble: 0.3,
      });
      g.restore();
    };
    // The coiled cord, from the bottom of the phone to the handset.
    const coil = (x0, y0, x1, y1, turns) => {
      g.strokeStyle = S.shadeHex(body, -0.55);
      g.lineWidth = 2.8;
      g.beginPath();
      for (let i = 0; i <= turns * 10; i++) {
        const t = i / (turns * 10);
        const px = S.lerp(x0, x1, t) + Math.sin(t * turns * Math.PI * 2) * 6;
        const py = S.lerp(y0, y1, t) + Math.sin(t * Math.PI) * 26;
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.stroke();
    };
    if (clean) {
      coil(x - 26, y + 86, x - 40, y + 2, 7);
      handset(x, y - 6, 0);
    } else {
      coil(x - 24, y + 88, x + 16, y + 192, 11);
      wallShadow(g, x + 2, y + 200, 34, 96, 6, 0.45);
      handset(x + 24, y + 244, 1.38);
    }
  }

  function platesOnShelf(g, x, shelf, w, door, clean, kind) {
    const plate = clean ? '#D9CFBA' : '#8F8676';
    const rim = clean ? S.mixHex(P.moss, P.linen, 0.35) : '#5E6152';
    if (kind === 'standing') {
      const count = 3;
      for (let i = 0; i < count; i++) {
        // Dirty: the left door's middle plate is the one on the floor.
        if (!clean && door === 0 && i === 1) continue;
        const cx = x + w * (0.2 + i * 0.3);
        const r = 21;
        const lean = !clean && door === 0 && i === 2 ? -0.22 : 0;
        g.save();
        g.translate(cx, shelf);
        g.rotate(lean);
        const face = g.createRadialGradient(-5, -r - 6, 2, 0, -r, r);
        face.addColorStop(0, S.shade(plate, 0.12));
        face.addColorStop(1, S.shade(plate, -0.2));
        g.fillStyle = face;
        g.beginPath();
        g.arc(0, -r, r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = S.rgba(rim, 0.8);
        g.lineWidth = 3;
        g.beginPath();
        g.arc(0, -r, r - 4, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
    } else if (kind === 'stack') {
      const n = clean ? 7 : 3;
      for (let i = 0; i < n; i++) {
        g.fillStyle = S.shade(plate, -0.15 + (i % 2) * 0.08);
        g.beginPath();
        g.ellipse(x + w / 2, shelf - 4 - i * 5, w * 0.34, 4, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = S.rgba(rim, 0.6);
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(x + w / 2, shelf - 4 - (n - 1) * 5, w * 0.3, 3, 0, 0, Math.PI * 2);
      g.stroke();
    } else {
      // Cups on the right door's bottom shelf
      for (let i = 0; i < 3; i++) {
        const cx = x + w * (0.22 + i * 0.28);
        if (!clean && i === 2) continue;
        g.fillStyle = S.shade(plate, -0.08);
        g.beginPath();
        g.moveTo(cx - 11, shelf - 24);
        g.lineTo(cx + 11, shelf - 24);
        g.lineTo(cx + 8, shelf);
        g.lineTo(cx - 8, shelf);
        g.closePath();
        g.fill();
        g.strokeStyle = S.shade(plate, -0.2);
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cx + 13, shelf - 13, 6, -1.2, 1.2);
        g.stroke();
      }
    }
  }

  function cabinetBox(g, x, y, w, h, color, seed, rimColor = null) {
    // Crown moulding, wider than the box
    paintShape(g, rectPoints(x - 8, y - 10, w + 16, 14), {
      color: S.shadeHex(color, 0.08),
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.35,
      strokes: 6,
      rim: 0.4,
      seed: seed + 50,
      wobble: 0.4,
    });
    paintShape(g, rectPoints(x, y + 2, w, h - 2), {
      color,
      lightDir: rimColor ? { x: 0.94, y: -0.34 } : { x: 0.35, y: -0.94 },
      light: 0.16,
      shadow: 0.42,
      strokes: 12,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.06,
      rim: rimColor ? 0.55 : 0.3,
      rimColor,
      seed,
      wobble: 0.5,
    });
  }

  function panelDoor(g, x, y, w, h, color, seed) {
    paintShape(g, rectPoints(x, y, w, h), {
      color: S.shadeHex(color, 0.05),
      lightDir: { x: 0.35, y: -0.94 },
      light: 0.18,
      shadow: 0.32,
      strokes: 12,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.05,
      rim: 0.3,
      seed,
      wobble: 0.5,
    });
    bevel(g, x, y, w, h, 0.16, 0.38);
    bevel(g, x + 16, y + 16, w - 32, h - 32, 0.3, 0.14, true);
  }

  // Light on the top-left edge, shadow bottom-right (or the reverse for a
  // recessed panel).
  function bevel(g, x, y, w, h, light, dark, recessed = false) {
    const lit = `rgba(255,240,215,${recessed ? dark : light})`;
    const shade = `rgba(0,0,0,${recessed ? light : dark})`;
    g.lineWidth = 2.5;
    g.strokeStyle = lit;
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x, y);
    g.lineTo(x + w, y);
    g.stroke();
    g.strokeStyle = shade;
    g.beginPath();
    g.moveTo(x + w, y);
    g.lineTo(x + w, y + h);
    g.lineTo(x, y + h);
    g.stroke();
  }

  function chromeKnob(g, x, y, r, clean) {
    softShadow(g, x - 2, y + 3, r * 1.4, r * 0.9, 0.4);
    const k = g.createRadialGradient(x - r * 0.35, y - r * 0.4, 0.5, x, y, r);
    k.addColorStop(0, clean ? '#F1ECE0' : '#B9B4A8');
    k.addColorStop(0.5, aged(TONE.chrome, clean, 0.6));
    k.addColorStop(1, S.shadeHex(TONE.chrome, -0.5));
    g.fillStyle = k;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // The strip light under a wall cabinet: a slim tube in a metal channel.
  // It is dark until the makeover switches it on (see lights/glow).
  function stripFitting(g, x, y, w, clean) {
    g.fillStyle = S.shadeHex(TONE.chrome, -0.45);
    g.fillRect(x, y - 2, w, 8);
    g.fillStyle = clean ? 'rgba(240,226,196,0.55)' : 'rgba(150,140,120,0.4)';
    g.fillRect(x + 6, y + 4, w - 12, 3);
  }

  function wallShadow(g, x, y, w, h, blur, alpha) {
    g.save();
    g.filter = `blur(${blur}px)`;
    g.fillStyle = `rgba(0,0,0,${alpha})`;
    g.fillRect(x, y, w, h);
    g.restore();
  }

  // Copper pans on a rail over the stove. Dirty: dull brown, green with
  // verdigris. Clean: shining copper that throws back the light.
  function paintPanRack(g, clean) {
    const { y, x0, x1 } = PANS;
    // Rail and brackets
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x0 - 4, y + 4, x1 - x0 + 8, 6);
    const rail = g.createLinearGradient(0, y - 4, 0, y + 4);
    rail.addColorStop(0, S.shadeHex(P.brass, clean ? 0.2 : -0.2));
    rail.addColorStop(1, S.shadeHex(P.brass, clean ? -0.35 : -0.6));
    g.fillStyle = rail;
    g.fillRect(x0, y - 4, x1 - x0, 7);
    for (const bx of [x0 - 4, x1 - 6]) {
      g.fillStyle = S.shadeHex(P.brass, clean ? -0.1 : -0.45);
      g.fillRect(bx, y - 10, 10, 18);
    }
    // [x, radius, handle length]
    const pans = [
      [214, 44, 36],
      [300, 33, 30],
      [366, 24, 26],
    ];
    pans.forEach(([px, r, handle], i) => {
      const hookY = y + 3;
      const top = hookY + 8 + handle;
      const cy = top + r;
      // S-hook
      g.strokeStyle = S.shadeHex(P.brass, clean ? -0.15 : -0.5);
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(px, hookY + 3, 4, Math.PI, Math.PI * 2.6);
      g.stroke();
      // Handle (brass), then the pan seen from below: a disc with hammered rings.
      g.fillStyle = S.shadeHex(TONE.copper, clean ? -0.2 : -0.45);
      g.beginPath();
      g.roundRect(px - 5, hookY + 6, 10, handle + 6, 4);
      g.fill();
      wallShadow(g, px - r - 10, cy - r + 10, r * 2, r * 2, 7, 0.45);
      const base = clean ? TONE.copper : S.mixHex(S.shadeHex(TONE.copper, -0.35), P.taupe, 0.35);
      paintShape(g, ellipsePoints(px, cy, r, r, 24), {
        color: base,
        lightDir: { x: 0.5, y: -0.86 },
        light: clean ? 0.45 : 0.2,
        shadow: 0.5,
        strokes: 14,
        strokeAngle: 0.8,
        strokeJitter: 1.2,
        rim: clean ? 0.7 : 0.45,
        rimColor: clean ? P.dawn : S.mixHex(P.moon, P.linen, 0.4),
        seed: 531 + i,
        wobble: 0.5,
      });
      g.strokeStyle = clean ? 'rgba(255,214,160,0.3)' : 'rgba(30,20,12,0.3)';
      g.lineWidth = 1.5;
      for (let ring = 0.35; ring < 0.95; ring += 0.2) {
        g.beginPath();
        g.arc(px, cy, r * ring, 0, Math.PI * 2);
        g.stroke();
      }
      if (clean) {
        // A bright gleam: the copper throws the lamp back.
        const shine = g.createRadialGradient(px - r * 0.35, cy - r * 0.35, 1, px - r * 0.3, cy - r * 0.3, r * 0.7);
        shine.addColorStop(0, 'rgba(255,228,180,0.55)');
        shine.addColorStop(1, 'rgba(255,228,180,0)');
        g.fillStyle = shine;
        g.beginPath();
        g.arc(px, cy, r, 0, Math.PI * 2);
        g.fill();
      } else {
        // Verdigris blooms and a dull rim.
        const rng = S.createRng(540 + i);
        g.save();
        g.beginPath();
        g.arc(px, cy, r, 0, Math.PI * 2);
        g.clip();
        g.filter = 'blur(3px)';
        for (let k = 0; k < 7; k++) {
          g.fillStyle = S.rgba(TONE.verdigris, rng.range(0.35, 0.6));
          g.beginPath();
          g.ellipse(px + rng.range(-r, r) * 0.8, cy + rng.range(-r, r) * 0.8, rng.range(5, 13), rng.range(4, 9), rng.range(0, 3), 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
    });
  }

  // The fridge: a rounded 1950s cabinet in cream enamel. Its door is painted
  // shut here; while the room is dirty the live drawing (drawFridgeDoor)
  // opens it a crack, so the makeover can swing it closed on its own beat.
  function fridgeOutline() {
    const { x0, x1, top, floor } = FRIDGE;
    const pts = [];
    const rTop = 46;
    const rBot = 10;
    const arc = (cx, cy, r, a0, a1) => {
      for (let i = 0; i <= 8; i++) {
        const a = S.lerp(a0, a1, i / 8);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    arc(x1 - rTop, top + rTop, rTop, -Math.PI / 2, 0);
    arc(x1 - rBot, floor - rBot, rBot, 0, Math.PI / 2);
    arc(x0 + rBot, floor - rBot, rBot, Math.PI / 2, Math.PI);
    arc(x0 + rTop, top + rTop, rTop, Math.PI, Math.PI * 1.5);
    return pts;
  }

  function paintFridge(g, clean) {
    const { x0, x1, top, floor } = FRIDGE;
    const w = x1 - x0;
    const enamel = aged(TONE.enamel, clean, 1.1);
    wallShadow(g, x0 - 18, top + 14, w + 6, floor - top - 14, 14, 0.55);
    softShadow(g, (x0 + x1) / 2, floor + 4, w * 0.62, 16, 0.6);
    paintShape(g, fridgeOutline(), {
      color: enamel,
      lightDir: { x: 0.55, y: -0.83 },
      light: 0.2,
      shadow: 0.45,
      strokes: 7,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.1,
      variance: 0.06,
      rim: 0.4,
      innerShadow: 0.4,
      wobble: 0.5,
      seed: 551,
    });
    // The rounded body bulges: a soft vertical highlight down its left third.
    const bulge = g.createLinearGradient(x0, 0, x1, 0);
    bulge.addColorStop(0, 'rgba(255,248,232,0)');
    bulge.addColorStop(0.3, `rgba(255,248,232,${clean ? 0.16 : 0.07})`);
    bulge.addColorStop(0.55, 'rgba(255,248,232,0)');
    bulge.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = bulge;
    g.fillRect(x0 + 6, top + 20, w - 12, floor - top - 40);

    // Door seam, the chrome trim and the badge.
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(x0 + 6, top + 22, w - 12, floor - top - 58, [36, 36, 4, 4]);
    g.stroke();
    const trimY = top + 96;
    const trim = g.createLinearGradient(0, trimY - 3, 0, trimY + 4);
    trim.addColorStop(0, clean ? '#EDE6D6' : '#A49E92');
    trim.addColorStop(1, S.shadeHex(TONE.chrome, -0.45));
    g.fillStyle = trim;
    g.fillRect(x0 + 8, trimY - 3, w - 16, 7);
    g.fillStyle = trim;
    g.beginPath();
    g.ellipse((x0 + x1) / 2, top + 54, 30, 9, 0, 0, Math.PI * 2);
    g.fill();
    // A chrome flourish on the badge (no maker's name: this house's fridge has none).
    g.strokeStyle = 'rgba(40,30,22,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo((x0 + x1) / 2 - 18, top + 57);
    g.bezierCurveTo((x0 + x1) / 2 - 8, top + 46, (x0 + x1) / 2 + 2, top + 62, (x0 + x1) / 2 + 18, top + 50);
    g.stroke();

    // The long chrome handle on the opening side.
    const hx = x1 - 22;
    softShadow(g, hx - 4, 560, 10, 90, 0.35);
    const handle = g.createLinearGradient(hx - 6, 0, hx + 6, 0);
    handle.addColorStop(0, S.shadeHex(TONE.chrome, -0.45));
    handle.addColorStop(0.4, clean ? '#F3EEE2' : '#B4AFA3');
    handle.addColorStop(1, S.shadeHex(TONE.chrome, -0.35));
    g.fillStyle = handle;
    g.beginPath();
    g.roundRect(hx - 5, 470, 10, 170, 5);
    g.fill();
    for (const my of [474, 632]) {
      g.fillStyle = S.shadeHex(TONE.chrome, -0.3);
      g.fillRect(hx - 9, my - 4, 18, 8);
    }

    // Kick plate: a dark grille.
    g.fillStyle = 'rgba(14,10,8,0.85)';
    g.fillRect(x0 + 10, floor - 30, w - 20, 22);
    g.strokeStyle = aged(TONE.chrome, clean, 0.8);
    g.lineWidth = 2;
    for (let gy = floor - 26; gy < floor - 10; gy += 5) {
      g.beginPath();
      g.moveTo(x0 + 16, gy);
      g.lineTo(x1 - 16, gy);
      g.stroke();
    }

    // On top: a biscuit tin.
    paintShape(g, rectPoints(x0 + 36, top - 34, 64, 36), {
      color: aged(S.mixHex(P.rust, P.linen, 0.35), clean),
      lightDir: { x: 0.5, y: -0.86 },
      light: 0.25,
      shadow: 0.4,
      strokes: 8,
      rim: 0.4,
      seed: 552,
      wobble: 0.6,
    });
    g.fillStyle = S.rgba(P.linen, 0.3);
    g.fillRect(x0 + 36, top - 24, 64, 5);

    if (!clean) {
      // Yellowed, finger-greasy round the handle, rust blooming at the base.
      g.save();
      g.filter = 'blur(8px)';
      g.fillStyle = 'rgba(70,52,24,0.25)';
      g.beginPath();
      g.ellipse(hx - 10, 560, 26, 110, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(150,140,120,0.3)';
      g.fillRect(x0 + 20, top - 6, w - 40, 14);
      g.restore();
      stain(g, x0 + 40, floor - 46, 18, '#4A2A14', 553, 0.5);
      stain(g, x1 - 36, floor - 60, 12, '#4A2A14', 554, 0.45);
    }
  }

  // The cup in the ceiling the pendant cord hangs from.
  function paintCeilingCup(g, clean) {
    softShadow(g, PENDANT.x, CEILING + 8, 34, 8, 0.4);
    g.fillStyle = aged(TONE.enamel, clean, 0.9);
    g.beginPath();
    g.ellipse(PENDANT.x, CEILING + 2, 22, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.shade(aged(TONE.enamel, clean), -0.3);
    g.fillRect(PENDANT.x - 8, CEILING + 2, 16, 8);
  }

  // Everything that says "nobody has been here for fifteen years".
  function paintBackGrime(g) {
    const rng = S.createRng(571);
    stain(g, 820, 150, 60, '#3A2E20', 572, 0.3);
    stain(g, 1560, 170, 50, '#3A2E20', 573, 0.25);
    stain(g, 1740, 360, 70, '#2E2418', 574, 0.25);
    // Drips from the ceiling stain
    g.strokeStyle = 'rgba(45,35,22,0.2)';
    g.lineWidth = 7;
    g.lineCap = 'round';
    for (const [x, len] of [[806, 170], [838, 110], [1570, 140]]) {
      g.beginPath();
      g.moveTo(x, 180);
      g.quadraticCurveTo(x + 5, 180 + len / 2, x - 2, 180 + len);
      g.stroke();
    }
    // Wallpaper peeling at a seam near the glass cabinet.
    peel(g, 1708, CEILING + 8, 32, 96);

    // A dusty grey film, thicker up high.
    g.save();
    g.filter = 'blur(30px)';
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(150,140,128,${rng.range(0.03, 0.08)})`;
      g.beginPath();
      g.ellipse(rng.range(0, 1920), rng.range(0, 760), rng.range(60, 200), rng.range(40, 120), 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    const film = g.createLinearGradient(0, 0, 0, FLOOR_LINE);
    film.addColorStop(0, 'rgba(140,130,118,0.15)');
    film.addColorStop(1, 'rgba(140,130,118,0.04)');
    g.fillStyle = film;
    g.fillRect(0, 0, 1920, FLOOR_LINE);

    // The floor: dust drifted against the walls and the cabinets, scuffs,
    // a dull worn path in front of the counter.
    g.save();
    g.filter = 'blur(10px)';
    g.fillStyle = 'rgba(160,150,135,0.24)';
    g.fillRect(0, FLOOR_LINE - 2, 1920, 26);
    g.restore();
    g.save();
    g.filter = 'blur(26px)';
    for (let i = 0; i < 56; i++) {
      g.fillStyle = `rgba(140,128,110,${rng.range(0.07, 0.15)})`;
      g.beginPath();
      g.ellipse(rng.range(0, 1920), rng.range(FLOOR_LINE, 1080), rng.range(80, 240), rng.range(20, 50), 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    g.strokeStyle = 'rgba(14,10,8,0.35)';
    g.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const x = rng.range(200, 1800);
      const y = rng.range(860, 1060);
      g.lineWidth = rng.range(1.5, 3.5);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + rng.range(10, 30), y + rng.range(-6, 6), x + rng.range(20, 60), y + rng.range(-3, 3));
      g.stroke();
    }

    // The previous cleaner's mop water, dried to a grey tide mark.
    stain(g, 1010, 922, 80, '#4E4A40', 575, 0.5);

    // The missing plate, in pieces under the glass cabinet.
    const shards = [[1224, 902, 0.4, 22], [1262, 912, -0.8, 16], [1240, 924, 1.6, 12], [1290, 898, 2.4, 10], [1206, 918, -2, 8]];
    for (const [x, y, a, size] of shards) {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.moveTo(-size + 2, 3);
      g.lineTo(size + 2, 1);
      g.lineTo(2, size * 0.5 + 3);
      g.closePath();
      g.fill();
      g.fillStyle = '#9D9484';
      g.beginPath();
      g.moveTo(-size, 0);
      g.lineTo(size, -2);
      g.lineTo(0, size * 0.5);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(94,97,82,0.8)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-size, 0);
      g.lineTo(size, -2);
      g.stroke();
      g.restore();
    }
  }

  function peel(g, x, y, w, h) {
    g.fillStyle = 'rgba(40,30,20,0.22)';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w, y + h * 0.7);
    g.quadraticCurveTo(x + w / 2, y + h * 0.9, x, y + h * 0.75);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(214,202,180,0.85)';
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

  // ── Furniture layer ───────────────────────────────────────────────────

  // The chairs, the herbs, the fruit and the mop bucket are not in here:
  // see LIVE_PROPS below.
  function paintFurniture(g, clean) {
    paintCounterRun(g, clean);
    paintHerbPots(g, clean);
    paintStool(g, clean);
    paintTable(g, clean);
  }

  // The counter run: the stove, the drawers, the sink cabinet, the worktop.
  function paintCounterRun(g, clean) {
    const { x0, x1, top, front, floor } = COUNTER;
    const paintTone = aged(TONE.paint, clean);
    softShadow(g, (x0 + x1) / 2, floor + 6, (x1 - x0) * 0.56, 22, 0.6);

    // Base cabinets (the stove covers its own span below).
    paintShape(g, rectPoints(x0, front, x1 - x0, floor - front - 14), {
      color: S.shadeHex(paintTone, -0.06),
      lightDir: { x: 0.3, y: -0.95 },
      light: 0.14,
      shadow: 0.45,
      strokes: 12,
      strokeAngle: Math.PI / 2,
      rim: 0.25,
      seed: 601,
      wobble: 0.5,
    });
    // Toe kick
    g.fillStyle = 'rgba(12,8,6,0.9)';
    g.fillRect(x0 + 6, floor - 14, x1 - x0 - 12, 14);

    // Left of the sink: a stack of three drawers.
    const dx0 = STOVE.x1 + 10;
    const dx1 = SINK.x0 - 8;
    const drawers = [[front + 4, 36], [front + 44, 42], [front + 90, 34]];
    drawers.forEach(([dy, dh], i) => {
      const pulledOut = !clean && i === 2;
      if (pulledOut) return;
      panelFront(g, dx0, dy, dx1 - dx0, dh, paintTone, 610 + i, clean);
      barPull(g, (dx0 + dx1) / 2, dy + dh / 2, 40, clean);
    });
    if (!clean) pulledDrawer(g, dx0, drawers[2][0], dx1 - dx0, drawers[2][1], paintTone);

    // Under the sink: two doors behind a tilt-out false front.
    const sx0 = SINK.x0 + 4;
    const sx1 = SINK.x1 - 4;
    panelFront(g, sx0, front + 4, sx1 - sx0, 26, paintTone, 615, clean);
    const doorW = (sx1 - sx0 - 6) / 2;
    for (let i = 0; i < 2; i++) {
      const ddx = sx0 + i * (doorW + 6);
      panelFront(g, ddx, front + 36, doorW, floor - front - 56, paintTone, 616 + i, clean, true);
      chromeKnob(g, i === 0 ? ddx + doorW - 14 : ddx + 14, front + 60, 5, clean);
    }
    // The narrow door at the end of the run, and the end strip by the wall.
    panelFront(g, SINK.x1 + 6, front + 4, x1 - SINK.x1 - 12, floor - front - 24, paintTone, 618, clean, true);
    chromeKnob(g, SINK.x1 + 20, front + 30, 5, clean);
    panelFront(g, x0 + 4, front + 4, STOVE.x0 - x0 - 8, floor - front - 24, paintTone, 619, clean);

    if (!clean) {
      // A tea towel left over the sink cabinet's edge, gone stiff and grey.
      paintShape(g, [[648, front + 2], [700, front + 4], [704, front + 64], [690, front + 78], [672, front + 70], [652, front + 76]], {
        color: S.mixHex(P.linen, P.taupe, 0.55),
        lightDir: { x: 0.3, y: -0.95 },
        light: 0.2,
        shadow: 0.4,
        strokes: 22,
        strokeAngle: Math.PI / 2,
        rim: 0.3,
        seed: 620,
        wobble: 1.6,
      });
      g.strokeStyle = S.rgba(P.rust, 0.35);
      g.lineWidth = 3;
      for (const ly of [front + 18, front + 26]) {
        g.beginPath();
        g.moveTo(650, ly);
        g.lineTo(702, ly + 2);
        g.stroke();
      }
    }

    paintStove(g, clean);
    paintWorktop(g, clean);
    paintSink(g, clean);
    paintTap(g, clean);
    paintKettle(g, clean);
  }

  function panelFront(g, x, y, w, h, color, seed, clean, recessed = false) {
    paintShape(g, rectPoints(x, y, w, h), {
      color: S.shadeHex(color, 0.04),
      lightDir: { x: 0.3, y: -0.95 },
      light: 0.18,
      shadow: 0.3,
      strokes: 12,
      strokeAngle: Math.PI / 2,
      strokeJitter: 0.05,
      rim: 0.28,
      seed,
      wobble: 0.45,
    });
    bevel(g, x, y, w, h, 0.15, 0.4);
    if (recessed && h > 60 && w > 50) bevel(g, x + 12, y + 12, w - 24, h - 24, 0.3, 0.12, true);
    void clean;
  }

  function barPull(g, cx, cy, w, clean) {
    softShadow(g, cx - 2, cy + 4, w * 0.6, 4, 0.35);
    const bar = g.createLinearGradient(0, cy - 3, 0, cy + 4);
    bar.addColorStop(0, clean ? '#F0EBDF' : '#ABA69A');
    bar.addColorStop(1, S.shadeHex(TONE.chrome, -0.45));
    g.fillStyle = bar;
    g.beginPath();
    g.roundRect(cx - w / 2, cy - 3, w, 7, 3);
    g.fill();
  }

  // The bottom drawer, left pulled out: its box shows above the front, and
  // its top edge is a step up to the counter.
  function pulledDrawer(g, x, y, w, h, color) {
    // The empty slot in the cabinet
    g.fillStyle = 'rgba(10,7,5,0.92)';
    g.fillRect(x, y, w, h);
    // Drawer sides and the things inside, seen from above
    g.fillStyle = S.shadeHex(color, -0.3);
    g.beginPath();
    g.moveTo(x + 2, y + 2);
    g.lineTo(x + w - 2, y + 2);
    g.lineTo(x + w + 4, DRAWER.y - 2);
    g.lineTo(x - 4, DRAWER.y - 2);
    g.closePath();
    g.fill();
    g.fillStyle = S.mixHex(P.linen, P.taupe, 0.5);
    g.beginPath();
    g.ellipse(x + w * 0.35, DRAWER.y - 6, 26, 5, 0.1, 0, Math.PI * 2);
    g.ellipse(x + w * 0.7, DRAWER.y - 5, 18, 4, -0.2, 0, Math.PI * 2);
    g.fill();
    // The front panel, nearer the camera: lower and a touch wider.
    softShadow(g, x + w / 2, DRAWER.y + 46, w * 0.6, 8, 0.5);
    panelFront(g, x - 4, DRAWER.y - 2, w + 8, h + 4, color, 611, false);
    barPull(g, x + w / 2, DRAWER.y + h / 2, 40, false);
  }

  function paintWorktop(g, clean) {
    const { x0, x1, top, front } = COUNTER;
    const surface = aged(S.mixHex(P.bone, TONE.paint, 0.35), clean);
    // Two runs of worktop either side of the stove's own enamel top.
    for (const [a, b, seed] of [[x0 - 4, STOVE.x0, 631], [STOVE.x1, x1 + 4, 632]]) {
      paintShape(g, rectPoints(a, top - 12, b - a, front - top + 4), {
        color: surface,
        lightDir: { x: 0, y: -1 },
        light: 0.25,
        shadow: 0.3,
        strokes: 14,
        strokeAngle: 0,
        rim: 0.3,
        innerShadow: 0.15,
        seed,
        wobble: 0.3,
      });
    }
    // A boomerang print on the laminate, very faint: the period's pattern.
    g.save();
    g.beginPath();
    g.rect(STOVE.x1, top - 12, x1 + 4 - STOVE.x1, 16);
    g.clip();
    g.strokeStyle = S.rgba(S.mixHex(TONE.trim, P.rust, 0.3), clean ? 0.22 : 0.12);
    g.lineWidth = 1.5;
    const rng = S.createRng(633);
    for (let x = STOVE.x1 + 10; x < x1; x += 34) {
      const y = top - 6 + rng.range(-3, 3);
      g.beginPath();
      g.moveTo(x - 8, y + 2);
      g.quadraticCurveTo(x, y - 4, x + 8, y + 2);
      g.stroke();
    }
    g.restore();
    // Aluminium edge band with its ridges.
    const band = g.createLinearGradient(0, front - 10, 0, front);
    band.addColorStop(0, clean ? '#E8E3D6' : '#A6A196');
    band.addColorStop(0.5, aged(TONE.chrome, clean, 0.8));
    band.addColorStop(1, S.shadeHex(TONE.chrome, -0.5));
    for (const [a, b] of [[x0 - 4, STOVE.x0], [STOVE.x1, x1 + 4]]) {
      g.fillStyle = band;
      g.fillRect(a, front - 10, b - a, 10);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(a, front - 5, b - a, 1);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(a, front, b - a, 4);
    }
    if (!clean) {
      g.save();
      g.filter = 'blur(4px)';
      g.fillStyle = 'rgba(175,165,148,0.28)';
      g.fillRect(x0, top - 14, x1 - x0, 10);
      g.restore();
      // Crumbs, a ring where a cup stood, a spill gone tacky.
      stain(g, 520, top - 6, 12, '#3A2410', 634, 0.5);
      stain(g, 860, top - 6, 9, '#3A2410', 635, 0.45);
    }
  }

  // A 1960s freestanding range: backguard with a clock, four burners, the
  // knobs and the oven door with its window.
  function paintStove(g, clean) {
    const { x0, x1 } = STOVE;
    const enamel = aged(TONE.enamel, clean, 1.15);
    const w = x1 - x0;
    const top = COUNTER.top;
    const floor = COUNTER.floor;
    // Backguard
    wallShadow(g, x0 - 10, 616, w, 76, 9, 0.45);
    paintShape(g, roundedRectPoints(x0, 608, w, 86, 14), {
      color: enamel,
      lightDir: { x: 0.4, y: -0.9 },
      light: 0.22,
      shadow: 0.4,
      strokes: 8,
      strokeAngle: 0,
      rim: 0.4,
      seed: 641,
      wobble: 0.4,
    });
    g.fillStyle = aged(TONE.chrome, clean, 0.8);
    g.fillRect(x0 + 6, 686, w - 12, 5);
    // Clock in the backguard, left of the kettle: stopped while dirty.
    const cx = x0 + 58;
    const cy = 646;
    g.fillStyle = S.shadeHex(TONE.chrome, -0.2);
    g.beginPath();
    g.arc(cx, cy, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = clean ? '#EFE6D2' : '#B4A992';
    g.beginPath();
    g.arc(cx, cy, 18, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = P.soot;
    g.lineCap = 'round';
    for (const [len, a, wdt] of [[9, clean ? 4.4 : 0.9, 2.5], [14, clean ? 0 : 1.7, 1.6]]) {
      g.lineWidth = wdt;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a - Math.PI / 2) * len, cy + Math.sin(a - Math.PI / 2) * len);
      g.stroke();
    }
    g.fillStyle = S.shadeHex(TONE.chrome, -0.25);
    g.beginPath();
    g.arc(x1 - 28, cy, 8, 0, Math.PI * 2);
    g.fill();

    // Cooktop: the stove's own enamel top, with four burners.
    paintShape(g, rectPoints(x0, top - 12, w, 20), {
      color: S.shadeHex(enamel, -0.06),
      lightDir: { x: 0, y: -1 },
      light: 0.25,
      shadow: 0.35,
      strokes: 8,
      rim: 0.3,
      innerShadow: 0.2,
      seed: 642,
      wobble: 0.3,
    });
    const burners = [x0 + 44, x0 + 112, KETTLE.x, x1 - 40];
    burners.forEach((bx, i) => {
      const by = top - 4 + (i % 2 ? 2 : -1);
      g.fillStyle = 'rgba(14,10,8,0.85)';
      g.beginPath();
      g.ellipse(bx, by, 30, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = S.shadeHex(TONE.chrome, -0.4);
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(bx, by - 1, 24, 3.6, 0, 0, Math.PI * 2);
      g.stroke();
    });

    // Front: knob panel, oven door with window, broiler drawer.
    const fy = top + 8;
    paintShape(g, rectPoints(x0, fy, w, floor - fy - 2), {
      color: enamel,
      lightDir: { x: 0.35, y: -0.93 },
      light: 0.2,
      shadow: 0.45,
      strokes: 8,
      strokeAngle: 0,
      rim: 0.35,
      seed: 643,
      wobble: 0.4,
    });
    g.fillStyle = S.shadeHex(enamel, -0.25);
    g.fillRect(x0 + 6, fy + 2, w - 12, 30);
    [x0 + 50, x0 + 110, x0 + 170, x0 + 230].forEach((kx, i) => {
      if (!clean && i === 2) {
        // A knob gone: only its stem is left.
        g.fillStyle = 'rgba(10,8,6,0.8)';
        g.fillRect(kx - 2, fy + 14, 4, 7);
        return;
      }
      chromeKnob(g, kx, fy + 17, 9, clean);
      g.fillStyle = 'rgba(20,14,10,0.6)';
      g.fillRect(kx - 1, fy + 9, 2, 6);
    });
    const ox = x0 + 18;
    const oy = fy + 40;
    const ow = w - 36;
    const oh = 70;
    bevel(g, ox, oy, ow, oh, 0.2, 0.4);
    barPull(g, x0 + w / 2, oy + 9, ow - 30, clean);
    const glass = g.createLinearGradient(0, oy + 20, 0, oy + 62);
    glass.addColorStop(0, '#1C1714');
    glass.addColorStop(1, '#0F0C0A');
    g.fillStyle = glass;
    g.beginPath();
    g.roundRect(ox + 28, oy + 20, ow - 56, 42, 6);
    g.fill();
    g.fillStyle = `rgba(255,248,232,${clean ? 0.12 : 0.05})`;
    g.beginPath();
    g.moveTo(ox + 40, oy + 62);
    g.lineTo(ox + 58, oy + 62);
    g.lineTo(ox + 80, oy + 20);
    g.lineTo(ox + 62, oy + 20);
    g.closePath();
    g.fill();
    bevel(g, x0 + 10, floor - 26, w - 20, 22, 0.18, 0.4);

    if (!clean) {
      // Grease runs and rust at the corners.
      stain(g, x0 + 60, fy + 50, 22, '#3C2410', 644, 0.5);
      stain(g, x1 - 30, floor - 30, 16, '#5A2E10', 645, 0.5);
      g.strokeStyle = 'rgba(60,38,16,0.35)';
      g.lineWidth = 4;
      g.lineCap = 'round';
      for (const lx of [x0 + 90, x0 + 200]) {
        g.beginPath();
        g.moveTo(lx, fy + 34);
        g.lineTo(lx + 2, fy + 60);
        g.stroke();
      }
    }
  }

  // A drop-in enamel sink: on a worktop seen this nearly edge-on, it shows
  // as a pale rim round a dark slot.
  function paintSink(g, clean) {
    const { x0, x1 } = SINK;
    const top = COUNTER.top;
    paintShape(g, roundedRectPoints(x0 + 6, top - 12, x1 - x0 - 12, 16, 7), {
      color: aged(P.bone, clean, 0.9),
      lightDir: { x: 0, y: -1 },
      light: 0.25,
      shadow: 0.3,
      strokes: 6,
      rim: 0.4,
      innerShadow: 0.2,
      seed: 651,
      wobble: 0.3,
    });
    const basin = g.createLinearGradient(0, top - 9, 0, top + 2);
    basin.addColorStop(0, '#0E0B09');
    basin.addColorStop(1, '#2A231E');
    g.fillStyle = basin;
    g.beginPath();
    g.roundRect(x0 + 18, top - 9, x1 - x0 - 36, 9, 4);
    g.fill();
    if (!clean) stain(g, TAP.spoutX, top - 3, 10, '#5A3212', 652, 0.6);
  }

  // The tap: a chrome gooseneck with two cross handles. The water itself is
  // drawn live (drawTapStream), only during the makeover.
  function paintTap(g, clean) {
    const base = COUNTER.top - 11;
    const chrome = aged(TONE.chrome, clean, 0.7);
    softShadow(g, TAP.x - 6, base + 2, 34, 4, 0.45);
    g.fillStyle = chrome;
    g.beginPath();
    g.ellipse(TAP.x, base, 28, 4.5, 0, 0, Math.PI * 2);
    g.fill();
    // Column and gooseneck: a thick stroke, a dark edge and a bright line.
    const neck = () => {
      g.beginPath();
      g.moveTo(TAP.x, base);
      g.lineTo(TAP.x, 640);
      g.quadraticCurveTo(TAP.x + 2, 618, TAP.x + 18, 618);
      g.quadraticCurveTo(TAP.spoutX, 618, TAP.spoutX, TAP.spoutY - 4);
    };
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = S.shadeHex(TONE.chrome, -0.55);
    g.lineWidth = 11;
    neck();
    g.stroke();
    g.strokeStyle = chrome;
    g.lineWidth = 8;
    neck();
    g.stroke();
    g.save();
    g.translate(-2, -1);
    g.strokeStyle = clean ? 'rgba(255,252,244,0.8)' : 'rgba(210,205,195,0.45)';
    g.lineWidth = 2;
    neck();
    g.stroke();
    g.restore();
    // Spout tip
    g.fillStyle = S.shadeHex(TONE.chrome, -0.4);
    g.beginPath();
    g.ellipse(TAP.spoutX, TAP.spoutY - 2, 5, 3, 0, 0, Math.PI * 2);
    g.fill();
    // Cross handles, hot and cold, clear of the water's path.
    for (const hx of [TAP.x - 26, TAP.x + 22]) {
      g.strokeStyle = S.shadeHex(TONE.chrome, -0.45);
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(hx - 9, base - 8);
      g.lineTo(hx + 9, base - 8);
      g.moveTo(hx, base - 1);
      g.lineTo(hx, base - 14);
      g.stroke();
      g.strokeStyle = chrome;
      g.lineWidth = 3;
      g.stroke();
    }
    if (!clean) {
      // Limescale and a green crust at the base.
      g.fillStyle = S.rgba(TONE.verdigris, 0.6);
      g.beginPath();
      g.ellipse(TAP.x, base - 2, 12, 3, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // The kettle on the back burner. It whistles at the end of the makeover.
  function paintKettle(g, clean) {
    const x = KETTLE.x;
    const base = KETTLE.base;
    const body = aged(S.mixHex(P.bone, P.rust, 0.18), clean, 1);
    softShadow(g, x, base + 2, 50, 6, 0.5);
    // Spout first, so the body overlaps its root: a stout tube angled up,
    // with the whistle cap on its tip.
    g.lineCap = 'round';
    g.strokeStyle = S.shadeHex(body, -0.35);
    g.lineWidth = 15;
    g.beginPath();
    g.moveTo(x - 30, base - 16);
    g.lineTo(x - 64, base - 44);
    g.stroke();
    g.strokeStyle = S.shadeHex(body, -0.05);
    g.lineWidth = 11;
    g.stroke();
    g.fillStyle = aged(TONE.chrome, clean, 0.8);
    g.beginPath();
    g.ellipse(KETTLE.x - 68, base - 48, 8, 6, -0.7, 0, Math.PI * 2);
    g.fill();
    // Body: a squat dome on a flared foot.
    const dome = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i / 16) * Math.PI;
      dome.push([x + Math.cos(a) * 42, base - 12 + Math.sin(a) * 44]);
    }
    dome.push([x + 46, base - 4], [x + 44, base], [x - 44, base], [x - 46, base - 4]);
    paintShape(g, dome, {
      color: body,
      lightDir: { x: 0.45, y: -0.9 },
      light: clean ? 0.4 : 0.2,
      shadow: 0.5,
      strokes: 10,
      strokeAngle: 0,
      rim: clean ? 0.65 : 0.3,
      rimColor: clean ? P.dawn : null,
      seed: 661,
      wobble: 0.6,
    });
    g.fillStyle = S.shadeHex(body, -0.3);
    g.fillRect(x - 44, base - 8, 88, 4);
    // Lid, knob, and a black bakelite handle on two posts.
    g.fillStyle = S.shadeHex(body, 0.1);
    g.beginPath();
    g.ellipse(x, base - 54, 20, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.soot;
    g.beginPath();
    g.ellipse(x, base - 60, 7, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = S.shadeHex(TONE.chrome, -0.3);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x - 26, base - 44);
    g.lineTo(x - 22, base - 66);
    g.moveTo(x + 26, base - 44);
    g.lineTo(x + 22, base - 66);
    g.stroke();
    g.strokeStyle = P.soot;
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(x - 24, base - 66);
    g.quadraticCurveTo(x, base - 76, x + 24, base - 66);
    g.stroke();
    g.strokeStyle = 'rgba(200,180,160,0.25)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 18, base - 71);
    g.quadraticCurveTo(x, base - 78, x + 16, base - 71);
    g.stroke();
    if (!clean) {
      stain(g, x + 12, base - 26, 12, '#3A2410', 662, 0.5); // a dent full of grease
    } else {
      g.fillStyle = 'rgba(255,240,214,0.5)';
      g.beginPath();
      g.ellipse(x - 16, base - 36, 6, 13, 0.4, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Herbs on the windowsill: dead stalks → basil and parsley. The pots are
  // furniture; the plants are a live prop, drawn just before the pots.
  const SILL = WINDOW.y + WINDOW.h + 9;
  const HERB_POTS = [[614, 'basil'], [700, 'parsley'], [800, 'basil']];

  function paintHerbPots(g, clean) {
    HERB_POTS.forEach(([x], i) => {
      const pot = aged(TONE.terracotta, clean, 0.9);
      softShadow(g, x, SILL + 1, 26, 4, 0.5);
      paintShape(g, [[x - 20, SILL - 34], [x + 20, SILL - 34], [x + 15, SILL], [x - 15, SILL]], {
        color: pot,
        lightDir: { x: 0.3, y: -0.95 },
        light: 0.2,
        shadow: 0.45,
        strokes: 10,
        rim: 0.35,
        seed: 671 + i,
        wobble: 0.6,
      });
      g.fillStyle = S.shadeHex(pot, 0.08);
      g.fillRect(x - 22, SILL - 36, 44, 7);
    });
  }

  function paintHerbPlants(g, clean) {
    HERB_POTS.forEach(([x, kind], i) => {
      if (clean) freshHerb(g, x, SILL - 34, kind, 680 + i);
      else deadHerb(g, x, SILL - 34, 690 + i);
    });
  }

  function freshHerb(g, x, y, kind, seed) {
    const rng = S.createRng(seed);
    const leaf = TONE.leaf;
    g.strokeStyle = S.shadeHex(leaf, -0.25);
    g.lineWidth = 2;
    const stems = kind === 'basil' ? 5 : 8;
    for (let i = 0; i < stems; i++) {
      const a = S.lerp(-2.3, -0.84, i / (stems - 1)) + rng.range(-0.1, 0.1);
      const len = rng.range(26, 46);
      const ex = x + Math.cos(a) * len * 0.6;
      const ey = y + Math.sin(a) * len;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.2, y + Math.sin(a) * len * 0.6, ex, ey);
      g.stroke();
      if (kind === 'basil') {
        for (const t of [0.55, 1]) {
          const lx = S.lerp(x, ex, t);
          const ly = S.lerp(y, ey, t);
          g.fillStyle = S.shade(leaf, rng.range(-0.08, 0.14));
          g.beginPath();
          g.ellipse(lx, ly, 10, 6, a + 1.2, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = 'rgba(255,250,230,0.12)';
          g.beginPath();
          g.ellipse(lx - 2, ly - 2, 4, 2, a + 1.2, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        // Parsley: clusters of small frilly leaves
        for (let k = 0; k < 5; k++) {
          g.fillStyle = S.shade(leaf, rng.range(-0.05, 0.18));
          g.beginPath();
          g.arc(ex + rng.range(-7, 7), ey + rng.range(-6, 4), rng.range(3, 5), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }

  function deadHerb(g, x, y, seed) {
    const rng = S.createRng(seed);
    g.strokeStyle = '#4A3A26';
    g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = S.lerp(-2.1, -1.0, i / 4);
      const len = rng.range(22, 36);
      const mx = x + Math.cos(a) * len * 0.4;
      const my = y + Math.sin(a) * len;
      // Stalks bent over at the top, a dry leaf hanging off the end.
      const ex = mx + (i < 2 ? -14 : 14);
      const ey = my + 12;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(mx, my - 6, ex, ey);
      g.stroke();
      g.fillStyle = '#5A4430';
      g.beginPath();
      g.ellipse(ex, ey + 3, 4, 2.5, 1.2, 0, Math.PI * 2);
      g.fill();
    }
    // Dead leaves fallen on the sill
    g.fillStyle = 'rgba(90,68,44,0.8)';
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.ellipse(x + rng.range(-30, 30), y + 34, 4, 2, rng.range(0, 3), 0, Math.PI * 2);
      g.fill();
    }
  }

  // A two-step kitchen stool: chrome legs, a red vinyl top, a fold-out step.
  function paintStool(g, clean) {
    const { x0, x1, top, floor } = STOOL;
    const cx = (x0 + x1) / 2;
    const chrome = aged(TONE.chrome, clean, 0.7);
    softShadow(g, cx, floor + 2, 52, 10, 0.55);
    // Legs splay from the seat to the floor.
    g.lineCap = 'round';
    for (const [tx, bx, back] of [[-24, -38, false], [24, 38, false], [-18, -30, true], [18, 30, true]]) {
      g.strokeStyle = back ? S.shadeHex(chrome, -0.45) : chrome;
      g.lineWidth = back ? 4 : 5;
      g.beginPath();
      g.moveTo(cx + tx, top + 8);
      g.lineTo(cx + bx, back ? floor - 10 : floor);
      g.stroke();
    }
    // The step, half way down.
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(cx - 40, top + 36, 80, 4);
    g.fillStyle = chrome;
    g.beginPath();
    g.roundRect(cx - 42, top + 28, 84, 8, 3);
    g.fill();
    g.fillStyle = 'rgba(14,10,8,0.7)';
    for (let i = -36; i < 36; i += 8) g.fillRect(cx + i, top + 29, 4, 3);
    // Seat: a vinyl pad seen slightly from above.
    const vinyl = aged(TONE.vinyl, clean, 0.9);
    paintShape(g, ellipsePoints(cx, top - 2, 40, 9, 24), {
      color: S.shadeHex(vinyl, 0.1),
      lightDir: { x: 0.3, y: -0.95 },
      light: 0.3,
      shadow: 0.3,
      strokes: 10,
      rim: 0.45,
      seed: 701,
      wobble: 0.4,
    });
    paintShape(g, rectPoints(cx - 40, top - 2, 80, 10), {
      color: S.shadeHex(vinyl, -0.15),
      lightDir: { x: 0.3, y: -0.95 },
      light: 0.15,
      shadow: 0.4,
      strokes: 6,
      rim: 0.2,
      seed: 702,
      wobble: 0.3,
    });
    g.fillStyle = chrome;
    g.fillRect(cx - 41, top + 6, 82, 3);
    if (!clean) {
      // A split in the vinyl, stuffing showing.
      g.fillStyle = S.mixHex(P.linen, P.taupe, 0.4);
      g.beginPath();
      g.ellipse(cx + 12, top - 4, 9, 2.5, 0.2, 0, Math.PI * 2);
      g.fill();
    }
  }

  // The kitchen table: chrome legs and a checked oilcloth cloth.
  function paintTable(g, clean) {
    const { x0, x1, top, hem, floor } = TABLE;
    const chrome = aged(TONE.chrome, clean, 0.7);
    softShadow(g, (x0 + x1) / 2, floor + 2, (x1 - x0) * 0.5, 18, 0.2);
    // Back legs, behind and in shadow
    for (const lx of [x0 + 44, x1 - 44]) {
      g.strokeStyle = S.shadeHex(chrome, -0.55);
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(lx, hem - 4);
      g.lineTo(lx, floor - 12);
      g.stroke();
    }
    const red = aged(TONE.check, clean, 0.85);
    const cream = aged(P.linen, clean, 0.9);
    // The top of the cloth, in perspective, then the drop at the front.
    const topQuad = [[x0 - 10, top - 16], [x1 + 10, top - 16], [x1 + 16, top + 4], [x0 - 16, top + 4]];
    paintShape(g, topQuad, { color: cream, lightDir: { x: 0.2, y: -1 }, light: 0.25, shadow: 0.2, strokes: 10, rim: 0.3, seed: 711, wobble: 0.4 });
    checks(g, topQuad, red, 28, 4, clean);
    const dropPts = [[x0 - 16, top + 4], [x1 + 16, top + 4], [x1 + 20, hem + 6]];
    for (let i = 12; i >= 0; i--) {
      const t = i / 12;
      dropPts.push([S.lerp(x0 - 20, x1 + 20, t), hem + 6 + (i % 2 ? 5 : 0)]);
    }
    paintShape(g, dropPts, { color: cream, lightDir: { x: 0.25, y: -0.97 }, light: 0.2, shadow: 0.35, strokes: 16, strokeAngle: Math.PI / 2, rim: 0.25, seed: 712, wobble: 0.8 });
    checks(g, dropPts, red, 28, 3, clean);
    // Folds in the drop: soft vertical bands of shade.
    g.save();
    wobblyPath(g, dropPts, { wobble: 0.8, seed: 712 });
    g.clip();
    for (let x = x0 - 20; x < x1 + 20; x += 54) {
      const fold = g.createLinearGradient(x, 0, x + 54, 0);
      fold.addColorStop(0, 'rgba(0,0,0,0)');
      fold.addColorStop(0.5, 'rgba(0,0,0,0.16)');
      fold.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fold;
      g.fillRect(x, top, 54, hem - top + 20);
    }
    // Oilcloth is shiny: a band of sheen along the edge.
    g.fillStyle = `rgba(255,246,228,${clean ? 0.16 : 0.07})`;
    g.fillRect(x0 - 20, top + 4, x1 - x0 + 40, 5);
    g.restore();
    // Front legs
    for (const lx of [x0 + 22, x1 - 22]) {
      const leg = g.createLinearGradient(lx - 5, 0, lx + 5, 0);
      leg.addColorStop(0, S.shadeHex(chrome, -0.4));
      leg.addColorStop(0.4, clean ? '#F0EBDF' : '#A9A498');
      leg.addColorStop(1, S.shadeHex(chrome, -0.5));
      g.fillStyle = leg;
      g.fillRect(lx - 5, hem + 4, 10, floor - hem - 6);
      g.fillStyle = P.soot;
      g.fillRect(lx - 7, floor - 4, 14, 5);
    }
    // On the table: the fruit bowl, the salt and pepper.
    fruitBowl(g, clean);
    for (const [sx, c] of [[1340, P.bone], [1362, P.gear]]) {
      g.fillStyle = aged(c, clean, 0.8);
      g.beginPath();
      g.roundRect(sx - 7, top - 30, 14, 24, 5);
      g.fill();
      g.fillStyle = aged(TONE.chrome, clean, 0.7);
      g.fillRect(sx - 7, top - 32, 14, 5);
    }
    if (!clean) {
      g.save();
      g.filter = 'blur(5px)';
      g.fillStyle = 'rgba(175,165,148,0.24)';
      g.fillRect(x0 - 10, top - 18, x1 - x0 + 20, 12);
      g.restore();
    }
  }

  // Gingham-like checks clipped to a cloth shape.
  function checks(g, pts, color, size, rowH, clean) {
    g.save();
    wobblyPath(g, pts, { wobble: 0.6, seed: 713 });
    g.clip();
    const b = S.paint.boundsOf(pts);
    for (let y = b.y; y < b.y + b.h; y += rowH * 2) {
      for (let x = b.x; x < b.x + b.w; x += size) {
        const odd = Math.round((y - b.y) / (rowH * 2)) % 2;
        g.fillStyle = S.rgba(color, clean ? 0.6 : 0.45);
        g.fillRect(x + (odd ? size / 2 : 0), y, size / 2, rowH);
      }
    }
    for (let x = b.x; x < b.x + b.w; x += size) {
      g.fillStyle = S.rgba(color, clean ? 0.28 : 0.2);
      g.fillRect(x, b.y, size / 2, b.h);
    }
    g.restore();
  }

  // The fruit is a live prop (shrivelled → fresh apples); the bowl's front
  // lip, painted in the furniture layer, sits over it.
  const FRUIT = { x: 1530, base: TABLE.top - 8 };

  function paintFruit(g, clean) {
    const { x, base } = FRUIT;
    if (clean) {
      const apples = [[-26, -26, 15, P.rust], [0, -32, 16, TONE.leaf], [24, -26, 15, P.rust], [-12, -42, 14, S.mixHex(P.rust, P.ember, 0.3)]];
      for (const [dx, dy, r, c] of apples) {
        const apple = g.createRadialGradient(x + dx - r * 0.35, base + dy - r * 0.4, 1, x + dx, base + dy, r);
        apple.addColorStop(0, S.shadeHex(c, 0.3));
        apple.addColorStop(1, S.shadeHex(c, -0.3));
        g.fillStyle = apple;
        g.beginPath();
        g.arc(x + dx, base + dy, r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = P.walnut;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x + dx, base + dy - r + 2);
        g.lineTo(x + dx + 2, base + dy - r - 5);
        g.stroke();
      }
    } else {
      // Shrivelled: small, brown, wrinkled.
      for (const [dx, dy, r] of [[-20, -22, 10], [4, -24, 9], [22, -20, 8]]) {
        g.fillStyle = '#4A3424';
        g.beginPath();
        g.ellipse(x + dx, base + dy, r, r * 0.85, 0.3, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(20,12,8,0.7)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + dx - r * 0.6, base + dy);
        g.quadraticCurveTo(x + dx, base + dy - 3, x + dx + r * 0.6, base + dy + 1);
        g.stroke();
      }
    }
  }

  function fruitBowl(g, clean) {
    const { x, base } = FRUIT;
    softShadow(g, x, base + 4, 50, 6, 0.45);
    const bowl = aged(S.mixHex(TONE.trim, P.bone, 0.3), clean, 0.9);
    paintShape(g, [[x - 40, base - 22], [x + 40, base - 22], [x + 30, base - 4], [x + 12, base], [x - 12, base], [x - 30, base - 4]], {
      color: bowl,
      lightDir: { x: 0.3, y: -0.95 },
      light: 0.3,
      shadow: 0.4,
      strokes: 8,
      rim: 0.5,
      seed: 721,
      wobble: 0.4,
    });
    g.strokeStyle = S.rgba(TONE.check, 0.5);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 36, base - 16);
    g.quadraticCurveTo(x, base - 10, x + 36, base - 16);
    g.stroke();
  }

  // A dinette chair seen from the side: chrome frame, vinyl seat and back.
  // `facing` is the way the seat faces (toward the table).
  function chair(g, { x, floor, facing, clean, tilt = 0, shadow = true }) {
    const chrome = aged(TONE.chrome, clean, 0.7);
    const vinyl = aged(TONE.vinyl, clean, 0.9);
    if (shadow) softShadow(g, x, floor + 2, 58, 10, 0.5);
    g.save();
    g.translate(x, floor);
    g.rotate(tilt * -facing);
    g.scale(facing, 1);
    // Local: x forward (toward the table), y up negative, origin between the back legs.
    g.lineCap = 'round';
    g.strokeStyle = S.shadeHex(chrome, -0.3);
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(-26, 0);
    g.lineTo(-22, -64);
    g.lineTo(-30, -150);
    g.moveTo(34, 0);
    g.lineTo(30, -64);
    g.stroke();
    g.strokeStyle = chrome;
    g.lineWidth = 4;
    g.stroke();
    // Seat pad
    paintShape(g, roundedRectPoints(-34, -76, 78, 14, 6), {
      color: vinyl,
      lightDir: { x: 0, y: -1 },
      light: 0.3,
      shadow: 0.35,
      strokes: 8,
      rim: 0.4,
      seed: 731,
      wobble: 0.4,
    });
    // Back pad
    paintShape(g, roundedRectPoints(-40, -152, 18, 58, 8), {
      color: vinyl,
      lightDir: { x: 0.6, y: -0.8 },
      light: 0.25,
      shadow: 0.4,
      strokes: 8,
      strokeAngle: Math.PI / 2,
      rim: 0.35,
      seed: 732,
      wobble: 0.4,
    });
    g.restore();
  }

  // The second chair, knocked over backwards onto the floor in front of the table.
  // A chair tucked in behind the table, seen from the front: only its
  // backrest shows above the cloth.
  function chairFromFront(g, x, clean) {
    const chrome = aged(TONE.chrome, clean, 0.7);
    const vinyl = aged(TONE.vinyl, clean, 0.9);
    g.lineCap = 'round';
    for (const ux of [x - 33, x + 33]) {
      g.strokeStyle = S.shadeHex(chrome, -0.35);
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(ux, 696);
      g.lineTo(ux, 762);
      g.stroke();
      g.strokeStyle = chrome;
      g.lineWidth = 3;
      g.stroke();
    }
    paintShape(g, roundedRectPoints(x - 42, 684, 84, 38, 14), {
      color: vinyl,
      lightDir: { x: 0.3, y: -0.95 },
      light: 0.3,
      shadow: 0.4,
      strokes: 10,
      rim: 0.4,
      seed: 733,
      wobble: 0.4,
    });
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x - 30, 703);
    g.lineTo(x + 30, 703);
    g.stroke();
  }

  // It faced the window and went over backwards, so it lies with its back
  // toward the right, legs in the air.
  function fallenChair(g) {
    softShadow(g, 1466, 926, 100, 12, 0.5);
    g.save();
    g.translate(1386, 905);
    g.rotate(Math.PI / 2 - 0.12);
    chair(g, { x: 0, floor: 0, facing: -1, clean: false, shadow: false });
    g.restore();
  }

  // ── Live props: things whose outline changes in the makeover ──────────
  // The runtime cross-fades a cached layer by painting the dirty version
  // over the clean one. That works for the opaque back layer, but in the
  // furniture layer the clean props show through wherever the dirty layer
  // is empty: during the sweep the room would have a fallen chair and a
  // tucked-in one, an overturned bucket and an upright one. So these are
  // painted once into small sprites and faded live with the sweep. They
  // are drawn before the furniture layer, which is where they belong
  // anyway (behind the table, under the bowl's lip, behind the pots).
  const LIVE_PROPS = [
    { box: [570, 388, 270, 112], cx: 700, paint: paintHerbPlants },
    { box: [1340, 672, 140, 100], cx: 1408, paint: (g, clean) => clean && chairFromFront(g, 1408, clean) },
    {
      box: [1590, 690, 240, 212],
      cx: 1712,
      // Pushed back from the end of the table, then tucked in.
      paint: (g, clean) => chair(g, clean ? { x: 1676, floor: TABLE.floor + 4, facing: -1, clean } : { x: 1748, floor: TABLE.floor + 4, facing: -1, clean, tilt: 0.05 }),
    },
    { box: [1346, 820, 240, 125], cx: 1461, paint: (g, clean) => !clean && fallenChair(g) },
    { box: [1478, 676, 104, 80], cx: FRUIT.x, paint: paintFruit },
    { box: [820, 790, 320, 180], cx: 1050, paint: paintMopBucket },
  ];
  const propCache = new Map();

  function propSprite(prop, clean) {
    const key = `${LIVE_PROPS.indexOf(prop)}:${clean}`;
    if (!propCache.has(key)) {
      const [x, y, w, h] = prop.box;
      const c = S.makeCanvas(w, h);
      const g = c.getContext('2d');
      g.translate(-x, -y);
      const drew = prop.paint(g, clean);
      propCache.set(key, drew === false ? null : c);
    }
    return propCache.get(key);
  }

  function drawLiveProps(g, mk) {
    for (const prop of LIVE_PROPS) {
      const k = cleanAt(mk, prop.cx);
      const [x, y] = prop.box;
      const dirty = k < 1 ? propSprite(prop, false) : null;
      const clean = k > 0 ? propSprite(prop, true) : null;
      g.save();
      if (dirty) {
        g.globalAlpha = 1 - k;
        g.drawImage(dirty, x, y);
      }
      if (clean) {
        g.globalAlpha = k;
        g.drawImage(clean, x, y);
      }
      g.restore();
    }
  }

  // The previous cleaner's bucket and mop. Dirty: knocked over in front of
  // the fridge, the mop dried stiff where it fell. Clean: upright, empty.
  function paintMopBucket(g, clean) {
    const zinc = aged(S.mixHex(P.gear, P.linen, 0.35), clean, 0.8);
    if (clean) {
      const x = 1052;
      const base = 906;
      softShadow(g, x, base + 2, 40, 7, 0.5);
      paintShape(g, [[x - 32, base - 50], [x + 32, base - 50], [x + 25, base], [x - 25, base]], {
        color: zinc,
        lightDir: { x: 0.4, y: -0.9 },
        light: 0.3,
        shadow: 0.4,
        strokes: 10,
        strokeAngle: Math.PI / 2,
        rim: 0.45,
        seed: 741,
        wobble: 0.5,
      });
      for (const ry of [base - 40, base - 14]) {
        g.strokeStyle = 'rgba(0,0,0,0.25)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x - 30, ry);
        g.lineTo(x + 30, ry);
        g.stroke();
      }
      g.fillStyle = 'rgba(14,10,8,0.85)';
      g.beginPath();
      g.ellipse(x, base - 50, 31, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = S.shadeHex(zinc, -0.35);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 30, base - 48);
      g.quadraticCurveTo(x, base - 92, x + 30, base - 48);
      g.stroke();
      return;
    }
    // Overturned: lying on its side, mouth toward the room.
    const x = 1072;
    const y = 902;
    softShadow(g, x - 10, y + 22, 66, 9, 0.55);
    paintShape(g, [[x - 34, y - 28], [x + 26, y - 22], [x + 26, y + 20], [x - 34, y + 26]], {
      color: zinc,
      lightDir: { x: 0.5, y: -0.86 },
      light: 0.25,
      shadow: 0.45,
      strokes: 10,
      rim: 0.4,
      seed: 742,
      wobble: 0.6,
    });
    for (const rx of [x - 18, x + 8]) {
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(rx, y - 25);
      g.lineTo(rx + 1, y + 23);
      g.stroke();
    }
    g.fillStyle = 'rgba(12,9,7,0.9)';
    g.beginPath();
    g.ellipse(x - 34, y, 9, 28, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = S.shadeHex(zinc, 0.1);
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(x - 34, y, 9, 28, 0, 0, Math.PI * 2);
    g.stroke();
    // The mop: grey strings splayed and stiff, its handle across the floor.
    g.strokeStyle = S.mixHex(P.taupe, P.linen, 0.3);
    g.lineCap = 'round';
    const rng = S.createRng(743);
    for (let i = 0; i < 18; i++) {
      g.lineWidth = rng.range(2, 3.5);
      const sy = y + rng.range(-14, 18);
      g.beginPath();
      g.moveTo(x - 36, sy);
      g.quadraticCurveTo(x - 60, sy + rng.range(-8, 10), x - rng.range(70, 96), sy + rng.range(4, 20));
      g.stroke();
    }
    g.strokeStyle = S.shadeHex(P.oak, -0.1);
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(x - 80, y + 14);
    g.lineTo(x - 210, y + 42);
    g.stroke();
  }

  // ── Foreground (out of focus, strongest parallax) ─────────────────────

  function paintFront(g, clean) {
    g.save();
    g.filter = 'blur(7px)';
    // Bottom left: the back of a dinette chair, close to the camera.
    const frame = clean ? '#4A4844' : '#1E1C1A';
    const pad = clean ? '#4C2C26' : '#1F1513';
    g.fillStyle = frame;
    g.fillRect(14, 880, 18, 230);
    g.fillRect(204, 880, 18, 230);
    g.fillStyle = pad;
    g.beginPath();
    g.roundRect(-20, 852, 270, 128, 40);
    g.fill();
    g.strokeStyle = clean ? 'rgba(255,200,140,0.3)' : 'rgba(127,163,199,0.22)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(0, 862);
    g.quadraticCurveTo(120, 848, 236, 864);
    g.stroke();

    // Bottom right: a galvanised mop pail with its wringer, a mop leaning in.
    const pail = clean ? '#5A5852' : '#22201E';
    g.fillStyle = pail;
    g.beginPath();
    g.moveTo(1690, 960);
    g.lineTo(1910, 960);
    g.lineTo(1890, 1100);
    g.lineTo(1710, 1100);
    g.closePath();
    g.fill();
    g.fillStyle = clean ? '#3E3C38' : '#161412';
    g.fillRect(1740, 912, 120, 52);
    g.strokeStyle = clean ? '#6B5240' : '#2A2018';
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(1790, 1000);
    g.lineTo(1960, 640);
    g.stroke();
    g.strokeStyle = clean ? 'rgba(255,200,140,0.28)' : 'rgba(164,186,205,0.2)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(1694, 962);
    g.lineTo(1906, 962);
    g.stroke();
    g.restore();

    if (!clean) {
      g.save();
      g.filter = 'blur(3px)';
      g.strokeStyle = 'rgba(220,215,200,0.22)';
      g.lineWidth = 3;
      for (const [x1, y1, x2, y2, sag] of [[-10, 150, 270, -10, 60], [-10, 270, 190, -10, 40], [1690, -10, 1930, 230, 70], [1780, -10, 1930, 130, 30]]) {
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
    const anchors = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      if (t < 0.5) anchors.push([cornerX + flip * alongCeiling * (1 - t * 2), cornerY]);
      else anchors.push([cornerX, cornerY + alongWall * (t - 0.5) * 2]);
    }
    return anchors;
  }

  function makeWebs() {
    return [
      // Top-left corner, big and old, over the end of the cabinets
      new S.Web({ hub: [150, 196], anchors: cornerAnchors(74, CEILING, 290, 300, 9, 1), rings: 8, sheet: 0.65, seed: 801 }),
      // Top-right corner
      new S.Web({ hub: [1772, 230], anchors: cornerAnchors(1846, CEILING, 250, 330, 8, -1), rings: 7, sheet: 0.55, seed: 802 }),
      // Between the left cabinets and the ceiling: a low strung sheet
      new S.Web({
        hub: [452, 126],
        anchors: [[360, CEILING + 2], [440, CEILING + 2], [520, CEILING + 2], [540, 150], [500, CEILING + 46], [400, CEILING + 44]],
        rings: 4,
        sheet: 0.5,
        seed: 803,
      }),
      // Across the window's top-left corner
      new S.Web({
        hub: [WINDOW.x + 30, WINDOW.y + 34],
        anchors: [[WINDOW.x + 140, WINDOW.y - 24], [WINDOW.x + 60, WINDOW.y - 24], [WINDOW.x - 24, WINDOW.y - 24], [WINDOW.x - 24, WINDOW.y + 70], [WINDOW.x - 24, WINDOW.y + 150]],
        rings: 6,
        sheet: 0.35,
        seed: 804,
      }),
      // From the pendant's cord up to the ceiling
      new S.Web({
        hub: [1492, 140],
        anchors: [[PENDANT.x + 1, 196], [PENDANT.x, 150], [1470, CEILING + 2], [1530, CEILING + 2], [1590, CEILING + 2], [1570, 170], [1520, 200]],
        rings: 5,
        sheet: 0.3,
        seed: 805,
      }),
      // From the fridge top to the glass cabinet
      new S.Web({
        hub: [1144, 292],
        anchors: [[FRIDGE.x1 - 12, 316], [FRIDGE.x1 - 20, FRIDGE.top + 4], [1112, 246], [1150, 230], [CAB_GLASS.x, 250], [CAB_GLASS.x, 310], [CAB_GLASS.x, 360]],
        rings: 5,
        sheet: 0.4,
        seed: 806,
      }),
      // Between the tap and the backsplash
      new S.Web({
        hub: [690, 630],
        anchors: [[TAP.x, 672], [TAP.x, 646], [TAP.x + 14, 620], [700, 578], [654, 588], [640, 628], [656, 668]],
        rings: 5,
        sheet: 0.3,
        seed: 807,
      }),
      // Under the table, between the legs: low, so it has to be aimed down at
      new S.Web({
        hub: [1350, 838],
        anchors: Array.from({ length: 9 }, (_, i) => {
          const a = (i / 9) * Math.PI * 2 + 0.3;
          return [1350 + Math.cos(a) * 74, S.clamp(838 + Math.sin(a) * 34, TABLE.hem + 6, TABLE.floor - 4)];
        }),
        rings: 6,
        closed: true,
        sheet: 0.2,
        seed: 808,
      }),
    ];
  }

  // ── Live drawing ──────────────────────────────────────────────────────

  function createLive(seed = 1) {
    return {
      noise: S.createNoise(seed),
      wind: S.createNoise(seed + 7),
      hum: S.createNoise(seed + 13),
      stars: Array.from({ length: 30 }, (_, i) => {
        const r = S.createRng(800 + i);
        return { x: r.range(0, 1), y: r.range(0, 0.4), s: r.range(0.6, 1.6), p: r.range(0, 6) };
      }),
      pendant: freshPendant(),
    };
  }

  function freshPendant() {
    return { theta: 0.03, omega: 0, jolt: 0, touching: new Set() };
  }

  // What you see through the window: the back garden at night, a washing
  // line with laundry left on it, the moon. Drawn BEHIND the back layer.
  function drawSky(g, live, time, mk) {
    const { x, y, w, h } = WINDOW;
    const day = mk.window;
    const dirty = S.moods.dirty;
    const clean = S.moods.clean;
    const L = x - 60; // wide enough for the parallax shift
    const R = x + w + 60;

    const sky = g.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, S.mix(dirty.windowSkyTop, clean.windowSkyTop, day));
    sky.addColorStop(1, S.mix(dirty.windowSkyBottom, clean.windowSkyBottom, day));
    g.fillStyle = sky;
    g.fillRect(L, y - 4, R - L, h + 8);

    for (const st of live.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * 2 + st.p);
      g.fillStyle = `rgba(230,235,255,${(1 - day) * twinkle * 0.8})`;
      g.beginPath();
      g.arc(L + st.x * (R - L), y + st.y * h, st.s, 0, Math.PI * 2);
      g.fill();
    }
    // Moon sinking, sun coming up behind the garden.
    const moonY = y + 56 + day * 240;
    g.fillStyle = `rgba(232,238,248,${1 - day})`;
    g.beginPath();
    g.arc(x + w * 0.78, moonY, 20, 0, Math.PI * 2);
    g.fill();
    const halo = g.createRadialGradient(x + w * 0.78, moonY, 16, x + w * 0.78, moonY, 80);
    halo.addColorStop(0, `rgba(180,200,230,${0.38 * (1 - day)})`);
    halo.addColorStop(1, 'rgba(180,200,230,0)');
    g.fillStyle = halo;
    g.fillRect(L, y, R - L, h);
    if (day > 0) {
      const sunY = y + h + 30 - day * 150;
      const sun = g.createRadialGradient(x + w * 0.22, sunY, 10, x + w * 0.22, sunY, 200);
      sun.addColorStop(0, `rgba(255,236,190,${day})`);
      sun.addColorStop(0.3, `rgba(255,200,140,${0.6 * day})`);
      sun.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = sun;
      g.fillRect(L, y, R - L, h);
    }

    const ink = S.mix('#0B0D13', '#56664E', day);
    // Trees beyond the fence
    g.fillStyle = ink;
    g.beginPath();
    g.moveTo(L, y + h);
    for (let i = 0; i <= 12; i++) {
      const tx = S.lerp(L, R, i / 12);
      g.lineTo(tx, y + 150 + Math.sin(i * 1.9) * 16 + (i % 3) * 10);
    }
    g.lineTo(R, y + h);
    g.closePath();
    g.fill();
    // A garden fence
    g.fillStyle = S.mix('#12141A', '#7A6A52', day);
    for (let px = L + 6; px < R; px += 22) {
      g.beginPath();
      g.moveTo(px, y + h);
      g.lineTo(px, y + 196);
      g.lineTo(px + 7, y + 188);
      g.lineTo(px + 14, y + 196);
      g.lineTo(px + 14, y + h);
      g.closePath();
      g.fill();
    }
    g.fillRect(L, y + 214, R - L, 6);

    // The washing line, sagging between two posts, laundry still pegged on it.
    const lineY = (t) => y + 70 + Math.sin(t * Math.PI) * 26;
    const lx0 = L + 10;
    const lx1 = R - 10;
    g.strokeStyle = S.mix('#2A2E38', '#8A7A62', day);
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const px = S.lerp(lx0, lx1, t);
      if (i) g.lineTo(px, lineY(t));
      else g.moveTo(px, lineY(t));
    }
    g.stroke();
    const gust = live.wind(time * 0.45);
    const laundry = [
      { t: 0.24, w: 92, h: 84, night: '#76839A', dayC: '#D8CDB4' }, // a sheet
      { t: 0.53, w: 54, h: 58, night: '#5E6A84', dayC: '#8EA2B8' }, // a shirt
      { t: 0.72, w: 20, h: 30, night: '#626A7E', dayC: '#B9A27A' }, // socks
      { t: 0.79, w: 20, h: 28, night: '#626A7E', dayC: '#B9A27A' },
    ];
    for (const item of laundry) {
      const px = S.lerp(lx0, lx1, item.t);
      const py = lineY(item.t);
      const sway = (gust + live.wind(time * 0.7 + item.t * 9) * 0.4) * 10;
      g.fillStyle = S.mix(item.night, item.dayC, day);
      g.beginPath();
      g.moveTo(px - item.w / 2, py);
      g.lineTo(px + item.w / 2, py + 2);
      g.quadraticCurveTo(px + item.w / 2 + sway * 0.6, py + item.h * 0.6, px + item.w / 2 + sway, py + item.h);
      g.lineTo(px - item.w / 2 + sway, py + item.h + (item.w > 50 ? 4 : 0));
      g.quadraticCurveTo(px - item.w / 2 + sway * 0.4, py + item.h * 0.5, px - item.w / 2, py);
      g.closePath();
      g.fill();
      g.fillStyle = S.mix('#1A1C22', '#5A4630', day);
      g.fillRect(px - item.w / 2 + 4, py - 3, 3, 7);
      g.fillRect(px + item.w / 2 - 7, py - 2, 3, 7);
    }
    // The posts
    g.fillStyle = ink;
    g.fillRect(lx0 - 3, y + 60, 6, h);
    g.fillRect(lx1 - 3, y + 60, 6, h);
  }

  // Moving props on the wall plane, drawn after the back layer and before
  // the furniture (so the counter hides the bottom of the tap's water).
  function drawProps(g, live, time, mk) {
    drawGlass(g, mk);
    drawCafeCurtain(g, live, time, mk);
    drawTableShadow(g, live);
    drawLiveProps(g, mk);
    drawFridgeDoor(g, live, time, mk);
    drawTapStream(g, time, mk);
    drawPendant(g, live, time, mk);
  }

  let grimeCache = null;
  function glassGrime() {
    if (grimeCache) return grimeCache;
    const { w, h } = WINDOW;
    const c = S.makeCanvas(w + 80, h + 80);
    const g = c.getContext('2d');
    g.beginPath();
    g.rect(40, 40, w, h);
    g.clip();
    g.filter = 'blur(14px)';
    g.fillStyle = 'rgba(110,100,85,0.45)';
    g.beginPath();
    g.ellipse(40 + w * 0.85, 40 + h * 0.2, 90, 60, 0.3, 0, Math.PI * 2);
    g.ellipse(40 + w * 0.15, 40 + h * 0.12, 60, 40, 0.3, 0, Math.PI * 2);
    g.fill();
    grimeCache = c;
    return c;
  }

  function drawGlass(g, mk) {
    const { x, y, w, h } = WINDOW;
    const grime = 1 - mk.window;
    if (grime > 0.01) {
      g.save();
      g.globalAlpha = grime;
      g.drawImage(glassGrime(), x - 40, y - 40);
      g.restore();
    }
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.beginPath();
    g.moveTo(x + 30, y + h);
    g.lineTo(x + 90, y + h);
    g.lineTo(x + 200, y);
    g.lineTo(x + 140, y);
    g.closePath();
    g.fill();
    g.restore();
  }

  // The café curtain over the lower sash. Limp and grey while dirty; at
  // dawn it is drawn back to the sides.
  function drawCafeCurtain(g, live, time, mk) {
    const { x, y, w, h } = WINDOW;
    const open = mk.curtain;
    const top = MEETING + 4;
    const bottom = y + h - 2;
    const fabric = S.mixHex(S.mixHex(P.linen, P.taupe, 0.45), P.linen, mk.window);
    const checkC = S.mixHex(S.mixHex(TONE.check, P.taupe, 0.5), TONE.check, mk.window);
    // Rod
    g.fillStyle = S.shadeHex(TONE.chrome, -0.3);
    g.fillRect(x - 6, top - 5, w + 12, 4);
    for (const side of [-1, 1]) {
      const outer = side === -1 ? x - 2 : x + w + 2;
      const centre = x + w / 2;
      const inner = S.lerp(centre, side === -1 ? x + 64 : x + w - 64, open);
      const breeze = live.noise(time * 0.6 + side * 3) * 3;
      const hemInner = inner + breeze + side * open * 14;
      const pts = [[outer, top], [inner, top]];
      // Gathered: the inner edge curves as it is pulled aside.
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        pts.push([S.lerp(inner, hemInner, t) - side * Math.sin(t * Math.PI) * 12 * open, S.lerp(top, bottom, t)]);
      }
      // Hem: ragged while dirty.
      const rag = 1 - mk.window;
      for (let i = 1; i <= 7; i++) {
        const t = i / 7;
        pts.push([S.lerp(hemInner, outer, t), bottom + (i % 2 ? 8 : -2) * rag]);
      }
      g.save();
      const grad = g.createLinearGradient(outer, 0, inner, 0);
      for (let i = 0; i <= 8; i++) grad.addColorStop(i / 8, S.shade(fabric, i % 2 ? -0.28 : 0.06));
      g.fillStyle = grad;
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
      g.fill();
      g.clip();
      // Gingham checks, faint.
      g.fillStyle = S.rgba(checkC, 0.2 + mk.window * 0.15);
      for (let cy = top; cy < bottom + 10; cy += 16) {
        for (let cx = Math.min(outer, inner) - 16; cx < Math.max(outer, inner) + 16; cx += 16) {
          if (((cx - x) / 16 + (cy - top) / 16) % 2 < 1) g.fillRect(cx, cy, 8, 8);
        }
        g.fillRect(Math.min(outer, inner) - 16, cy, Math.abs(outer - inner) + 32, 3);
      }
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.fillRect(Math.min(outer, inner) - 10, top, Math.abs(outer - inner) + 20, 10);
      if (mk.window < 0.5) {
        g.fillStyle = `rgba(70,52,30,${0.22 * (1 - mk.window * 2)})`;
        g.beginPath();
        g.ellipse(S.lerp(outer, inner, 0.5), bottom - 30, 30, 22, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      // Rings on the rod
      g.fillStyle = S.shadeHex(TONE.chrome, -0.1);
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(S.lerp(outer, inner, i / 4), top - 3, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // The pendant's floor shadow under the table swings with the lamp.
  function drawTableShadow(g, live) {
    const bulb = pendantBulb(live.pendant.theta);
    const cx = (TABLE.x0 + TABLE.x1) / 2 - (bulb.x - PENDANT.x) * 1.6;
    softShadow(g, cx, TABLE.floor + 6, 230, 26, 0.45);
  }

  // How far the fridge door stands open: 1 while dirty, 0 once the makeover
  // has swung it shut.
  const fridgeAjar = (mk) => S.clamp(1 - (mk.fridgeShut ?? 0), 0, 1);

  function drawFridgeDoor(g, live, time, mk) {
    const ajar = fridgeAjar(mk);
    if (ajar <= 0.01) return;
    const top = FRIDGE.top + 52; // below the rounded top corner
    const bottom = FRIDGE.floor - 40;
    const gap = 7 * ajar;
    // The door's free edge stands proud of the cabinet: a strip of its
    // thickness, then the bright crack of cold light, then the gasket.
    const edge = g.createLinearGradient(SLIT_X - 8, 0, SLIT_X, 0);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, `rgba(0,0,0,${0.35 * ajar})`);
    g.fillStyle = edge;
    g.fillRect(SLIT_X - 8, top, 8, bottom - top);
    const hum = 0.9 + 0.1 * S.light.flicker(live.hum, time, 0.3);
    const crack = g.createLinearGradient(0, top, 0, bottom);
    crack.addColorStop(0, S.rgba(COLD, 0));
    crack.addColorStop(0.1, S.rgba(COLD, 0.9 * hum));
    crack.addColorStop(0.85, S.rgba('#F2F4F2', 0.95 * hum));
    crack.addColorStop(1, S.rgba(COLD, 0.2));
    g.fillStyle = crack;
    g.fillRect(SLIT_X, top, gap, bottom - top);
    g.fillStyle = `rgba(10,8,8,${0.8 * ajar})`;
    g.fillRect(SLIT_X + gap, top + 4, 2, bottom - top - 8);
    // Cold light catching the cabinet's side and the floor at the foot of the door.
    g.fillStyle = S.rgba(COLD, 0.22 * ajar * hum);
    g.fillRect(SLIT_X + gap + 2, top, FRIDGE.x1 - SLIT_X - gap, bottom - top);
  }

  // How far the makeover's sweep has cleaned a point at x (0 dirty … 1
  // clean), with the same 280 px smoothstep feather the runtime uses.
  function cleanAt(mk, x) {
    if (mk.wipe <= 0) return 0;
    if (mk.wipe >= 1) return 1;
    const t = S.clamp((mk.sweepX - x) / 280 + 0.5, 0, 1);
    return t * t * (3 - 2 * t);
  }

  // The story object. Dirty: curled, water-stained, the writing run to
  // smudges. Clean: flat and readable — "Apple cake — for A., when she visits".
  function paintRecipe(g, clean) {
    const w = 98;
    const h = 66;
    g.save();
    g.translate(RECIPE.x, RECIPE.y + 4);
    g.rotate(clean ? -0.035 : 0.07);
    // Shadow on the fridge door
    g.fillStyle = clean ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.4)';
    g.beginPath();
    g.roundRect(-w / 2 + 3, -h / 2 + 5, w, h, 2);
    g.fill();
    const paper = clean ? S.mixHex(P.bone, P.linen, 0.25) : S.mixHex(P.linen, DUST, 0.45);
    const card = g.createLinearGradient(0, -h / 2, 0, h / 2);
    card.addColorStop(0, S.shadeHex(paper, 0.05));
    card.addColorStop(1, S.shadeHex(paper, -0.08));
    g.fillStyle = card;
    g.beginPath();
    if (clean) {
      g.roundRect(-w / 2, -h / 2, w, h, 2);
    } else {
      // Curled: the bottom corners lift away from the door.
      g.moveTo(-w / 2, -h / 2);
      g.lineTo(w / 2, -h / 2);
      g.lineTo(w / 2 - 2, h / 2 - 14);
      g.quadraticCurveTo(w / 2 - 6, h / 2 + 2, w / 2 - 22, h / 2 - 6);
      g.lineTo(-w / 2 + 18, h / 2 - 2);
      g.quadraticCurveTo(-w / 2 + 2, h / 2 + 4, -w / 2 + 2, h / 2 - 16);
      g.closePath();
    }
    g.fill();
    // Ruled lines
    g.strokeStyle = clean ? 'rgba(120,140,170,0.35)' : 'rgba(80,80,90,0.2)';
    g.lineWidth = 1;
    for (let ly = -h / 2 + 22; ly < h / 2 - 6; ly += 12) {
      g.beginPath();
      g.moveTo(-w / 2 + 6, ly);
      g.lineTo(w / 2 - 6, ly);
      g.stroke();
    }
    g.strokeStyle = clean ? 'rgba(170,70,60,0.4)' : 'rgba(110,60,50,0.25)';
    g.beginPath();
    g.moveTo(-w / 2 + 6, -h / 2 + 15);
    g.lineTo(w / 2 - 6, -h / 2 + 15);
    g.stroke();
    if (clean) {
      g.fillStyle = INK;
      g.textAlign = 'left';
      g.font = '700 17px Caveat, "Segoe Print", cursive';
      g.fillText('Apple cake', -w / 2 + 8, -h / 2 + 12);
      g.font = '500 14px Caveat, "Segoe Print", cursive';
      g.fillText('— for A.,', -w / 2 + 10, -h / 2 + 31);
      g.fillText('when she visits', -w / 2 + 14, -h / 2 + 43);
      g.fillStyle = 'rgba(46,42,68,0.55)';
      g.font = '500 11px Caveat, "Segoe Print", cursive';
      g.fillText('4 apples, cinnamon', -w / 2 + 10, -h / 2 + 56);
    } else {
      // The writing has run: smudged strokes, and a brown water ring.
      g.strokeStyle = 'rgba(46,42,68,0.35)';
      g.lineWidth = 2.5;
      g.lineCap = 'round';
      for (const [ly, len] of [[-h / 2 + 11, 52], [-h / 2 + 29, 38], [-h / 2 + 41, 58], [-h / 2 + 53, 44]]) {
        g.beginPath();
        g.moveTo(-w / 2 + 10, ly);
        for (let i = 1; i <= 6; i++) g.lineTo(-w / 2 + 10 + (len * i) / 6, ly + (i % 2 ? -2 : 1));
        g.stroke();
      }
      g.strokeStyle = 'rgba(90,56,26,0.5)';
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(14, 6, 22, 16, 0.3, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = 'rgba(90,56,26,0.2)';
      g.fill();
      // The curl's shadow underneath
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.ellipse(w / 2 - 12, h / 2 - 4, 12, 4, -0.4, 0, Math.PI * 2);
      g.fill();
    }
    // The magnet: a little red apple, holding the top right corner.
    const mx = w / 2 - 14;
    const my = -h / 2 + 2;
    const mg = g.createRadialGradient(mx - 3, my - 4, 1, mx, my, 10);
    mg.addColorStop(0, S.shadeHex(P.rust, clean ? 0.22 : -0.15));
    mg.addColorStop(1, S.shadeHex(P.rust, clean ? -0.35 : -0.6));
    g.fillStyle = mg;
    g.beginPath();
    g.arc(mx - 4, my, 8, 0, Math.PI * 2);
    g.arc(mx + 4, my, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.shadeHex(TONE.leaf, clean ? 0 : -0.35);
    g.beginPath();
    g.ellipse(mx + 5, my - 10, 5, 2.5, -0.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // The wall calendar, turned to October, the 17th circled in red pencil
  // (the house stopped that day; the Living Room's clock says 3:17). The
  // date is the same in both states; clean, the pencil note beside it shows.
  function paintCalendar(g, clean) {
    const { x, y, w, h } = CALENDAR;
    g.save();
    g.translate(x, y);
    // Nail and string
    g.strokeStyle = 'rgba(30,20,12,0.6)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(w * 0.3, 2);
    g.lineTo(w / 2, -8);
    g.lineTo(w * 0.7, 2);
    g.stroke();
    g.fillStyle = P.brass;
    g.beginPath();
    g.arc(w / 2, -8, 2.5, 0, Math.PI * 2);
    g.fill();
    // Shadow on the wall
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(-5, 6, w, h);
    const paper = clean ? S.mixHex(P.bone, P.linen, 0.35) : S.mixHex(P.linen, DUST, 0.5);
    g.fillStyle = paper;
    g.fillRect(0, 0, w, h);
    // The picture at the top: an orchard in the period's flat colours.
    g.fillStyle = clean ? S.mixHex(P.sky, P.linen, 0.3) : S.mixHex(P.moon, P.taupe, 0.55);
    g.fillRect(6, 6, w - 12, 40);
    g.fillStyle = S.shadeHex(TONE.leaf, clean ? 0.05 : -0.3);
    g.beginPath();
    g.moveTo(6, 46);
    g.quadraticCurveTo(w / 2, 26, w - 6, 40);
    g.lineTo(w - 6, 46);
    g.closePath();
    g.fill();
    for (const [tx, ty] of [[26, 30], [52, 26], [76, 31]]) {
      g.fillStyle = S.shadeHex(TONE.leaf, clean ? -0.2 : -0.5);
      g.beginPath();
      g.arc(tx, ty, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = clean ? S.mixHex(P.rust, P.ember, 0.2) : S.shadeHex(P.rust, -0.3);
      g.beginPath();
      g.arc(tx + 3, ty + 2, 2, 0, Math.PI * 2);
      g.arc(tx - 4, ty - 1, 2, 0, Math.PI * 2);
      g.fill();
    }
    // Month and the grid
    const ink = clean ? S.shadeHex(P.walnut, -0.08) : S.mixHex(P.walnut, P.taupe, 0.3);
    g.fillStyle = ink;
    g.textAlign = 'center';
    g.font = '13px "Special Elite", "Courier New", monospace';
    g.fillText('OCTOBER', w / 2, 60);
    g.font = '9px "Special Elite", "Courier New", monospace';
    const cellW = (w - 10) / 7;
    const gridTop = 72;
    let day = 1;
    const firstDow = 3; // October 1st on a Wednesday
    for (let row = 0; row < 5 && day <= 31; row++) {
      for (let col = 0; col < 7 && day <= 31; col++) {
        if (row === 0 && col < firstDow) continue;
        g.fillStyle = col === 0 ? S.shadeHex(P.rust, clean ? 0 : -0.3) : ink; // Sundays in red
        g.fillText(String(day), 5 + cellW * (col + 0.5), gridTop + row * 12);
        if (day === 17) circleDay(g, 5 + cellW * (col + 0.5), gridTop + row * 12 - 3, clean);
        day++;
      }
    }
    if (clean) {
      // The note beside the circled date.
      g.fillStyle = PENCIL;
      g.font = '600 13px Caveat, "Segoe Print", cursive';
      g.textAlign = 'left';
      g.fillText('A. coming!', 30, h - 6);
      // A pencil arrow from the note up to the circled 17.
      g.strokeStyle = S.rgba(PENCIL, 0.7);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(68, h - 19);
      g.quadraticCurveTo(66, h - 30, 75, h - 39);
      g.lineTo(71, h - 37);
      g.moveTo(75, h - 39);
      g.lineTo(75, h - 34);
      g.stroke();
    } else {
      // Fifteen years: the page has yellowed and the corner curls.
      g.fillStyle = 'rgba(70,50,24,0.25)';
      g.fillRect(0, 0, w, h);
      g.fillStyle = S.shadeHex(paper, -0.25);
      g.beginPath();
      g.moveTo(w, h - 22);
      g.quadraticCurveTo(w - 6, h - 6, w - 24, h);
      g.lineTo(w, h);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function circleDay(g, x, y, clean) {
    g.save();
    g.strokeStyle = S.rgba(S.mixHex(P.rust, P.ember, 0.35), clean ? 0.9 : 0.7); // red pencil
    g.lineWidth = 1.6;
    g.beginPath();
    g.ellipse(x, y, 8, 6.5, -0.2, 0.3, Math.PI * 2.15);
    g.stroke();
    g.restore();
  }

  // ── The tap (makeover) ────────────────────────────────────────────────

  function drawTapStream(g, time, mk) {
    const flow = mk.tap ?? 0;
    if (flow <= 0.01) return;
    const clear = mk.tapClear ?? 0;
    const x0 = TAP.spoutX;
    const y0 = TAP.spoutY + 1;
    const y1 = COUNTER.top - 4;
    const brown = S.mixHex(P.rust, P.goo, 0.4);
    const water = S.mixHex(P.silk, P.moon, 0.25);
    const color = S.mixHex(brown, water, clear);
    const width = 3 + 4.5 * flow;
    // Brown water sputters: the stream breaks into gouts. Clear water runs.
    const sputter = 1 - clear;
    g.save();
    g.lineCap = 'round';
    const pieces = 14;
    for (let i = 0; i < pieces; i++) {
      const t0 = i / pieces;
      const t1 = (i + 1) / pieces;
      if (sputter > 0.2 && Math.sin(time * 38 - i * 1.7) > 0.4 - sputter * 0.2) continue;
      const wob = (t) => Math.sin(time * 26 + t * 9) * 1.2 * t;
      g.strokeStyle = S.rgba(color, S.lerp(0.9, 0.55, clear));
      g.lineWidth = width * (1 - t0 * 0.25);
      g.beginPath();
      g.moveTo(x0 + wob(t0), S.lerp(y0, y1, t0));
      g.lineTo(x0 + wob(t1), S.lerp(y0, y1, t1));
      g.stroke();
    }
    // Highlights running down the clear stream.
    if (clear > 0.2) {
      g.strokeStyle = `rgba(255,255,250,${0.55 * clear * flow})`;
      g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const t = (time * 2.4 + i / 3) % 1;
        g.beginPath();
        g.moveTo(x0 - 1, S.lerp(y0, y1, t));
        g.lineTo(x0 - 1, S.lerp(y0, y1, Math.min(1, t + 0.18)));
        g.stroke();
      }
    }
    g.restore();
  }

  // ── The pendant lamp ──────────────────────────────────────────────────
  // A pendulum hung from the ceiling cup. theta > 0 swings it to the right.

  function pendantPoint(theta, d) {
    return { x: PENDANT.x + Math.sin(theta) * d, y: CEILING + Math.cos(theta) * d };
  }
  function pendantBulb(theta) {
    return pendantPoint(theta, PENDANT.cord + PENDANT.shade + 4);
  }

  function pendantFlicker(live, time, mk) {
    const steady = mk.pendantSteady;
    const jolt = live.pendant.jolt;
    let f = steady >= 1 ? 1 : S.lerp(S.light.flicker(live.noise, time, 1.3), 1, steady);
    // Knocked by a dart: the filament stutters.
    if (jolt > 0) f *= 1 - jolt * (Math.sin(time * 47) > 0 ? 0.55 : 0.15);
    return f;
  }

  function drawPendant(g, live, time, mk) {
    const theta = live.pendant.theta;
    const enamel = S.mixHex(aged(TONE.enamel, false, 0.8), TONE.enamel, mk.wipe >= 1 ? 1 : cleanAt(mk, PENDANT.x));
    const k = cleanAt(mk, PENDANT.x);
    g.save();
    g.translate(PENDANT.x, CEILING);
    g.rotate(-theta);
    // The cord, braided cloth, with a slight sag
    g.strokeStyle = '#1E1814';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 6);
    g.quadraticCurveTo(1.5, PENDANT.cord / 2, 0, PENDANT.cord);
    g.stroke();
    g.strokeStyle = 'rgba(200,180,150,0.2)';
    g.lineWidth = 1;
    g.stroke();
    const top = PENDANT.cord;
    const bottom = top + PENDANT.shade;
    // Cap
    g.fillStyle = S.shadeHex(TONE.chrome, -0.2);
    g.beginPath();
    g.roundRect(-9, top - 4, 18, 16, 4);
    g.fill();
    // Dome: enamel outside, darker below the curve.
    const dome = g.createLinearGradient(-60, 0, 60, 0);
    dome.addColorStop(0, S.shadeHex(enamel, -0.35));
    dome.addColorStop(0.35, S.shadeHex(enamel, 0.12));
    dome.addColorStop(1, S.shadeHex(enamel, -0.45));
    g.fillStyle = dome;
    g.beginPath();
    g.moveTo(-12, top + 8);
    g.bezierCurveTo(-30, top + 12, -56, bottom - 22, -60, bottom);
    g.lineTo(60, bottom);
    g.bezierCurveTo(56, bottom - 22, 30, top + 12, 12, top + 8);
    g.closePath();
    g.fill();
    // A green enamel band at the rim
    g.strokeStyle = S.mixHex(aged(TONE.trim, false), TONE.trim, k);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-60, bottom - 2);
    g.lineTo(60, bottom - 2);
    g.stroke();
    // The inside of the shade, lit by the bulb.
    const lit = pendantFlicker(live, time, mk);
    g.fillStyle = `rgba(255,226,170,${0.55 + 0.4 * lit})`;
    g.beginPath();
    g.ellipse(0, bottom, 58, 7, 0, 0, Math.PI);
    g.fill();
    g.fillStyle = `rgba(255,240,210,${0.6 + 0.4 * lit})`;
    g.beginPath();
    g.ellipse(0, bottom + 4, 12, 9, 0, 0, Math.PI * 2);
    g.fill();
    if (k < 1) {
      // Dust on the dome and a chip in the enamel.
      g.fillStyle = `rgba(170,160,140,${0.35 * (1 - k)})`;
      g.beginPath();
      g.ellipse(-6, top + 16, 26, 7, 0, Math.PI, Math.PI * 2);
      g.fill();
      g.fillStyle = `rgba(20,14,10,${0.7 * (1 - k)})`;
      g.beginPath();
      g.ellipse(34, bottom - 12, 5, 3, 0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // ── Light rig ─────────────────────────────────────────────────────────

  function shaftQuad(mk) {
    const { x, y, w } = WINDOW;
    // At night the moon stands high at the right of the window, so its
    // light falls down to the left, over the sink onto the drawers. In the
    // morning the low sun at the left throws long rays to the right: the
    // shaft swings across the room as the dawn comes.
    const lean = S.lerp(-190, 320, mk.window);
    return [
      [x + 8, y + 10],
      [x + w - 8, y + 10],
      [x + w + lean + 70, 1040],
      [x + lean - 30, 1040],
    ];
  }

  // The fridge's cold wedge across the floor, from the crack toward the
  // lower right.
  function fridgeWedge() {
    return [
      [SLIT_X - 4, FRIDGE.floor - 60],
      [SLIT_X + 10, FRIDGE.floor - 60],
      [1760, 1080],
      [1230, 1080],
    ];
  }

  // Soft floor-only cold tint under the fridge wedge, fading smoothly at the edges.
  function coldTint(g, amount) {
    const [a, b, c, d] = fridgeWedge();
    g.save();
    g.globalCompositeOperation = 'multiply';
    const grad = g.createLinearGradient(SLIT_X, FRIDGE.floor - 40, 1520, 1080);
    grad.addColorStop(0, S.rgba(P.moon, 0.28 * amount));
    grad.addColorStop(0.55, S.rgba(P.moon, 0.22 * amount));
    grad.addColorStop(1, S.rgba(P.moon, 0));
    g.fillStyle = grad;
    for (const [k, alpha] of [[-55, 0.28], [-20, 0.36], [15, 0.36]]) {
      g.globalAlpha = alpha;
      g.beginPath();
      g.moveTo(a[0] - 4, a[1]);
      g.lineTo(b[0] + 4, b[1]);
      g.lineTo(c[0] + k, c[1]);
      g.lineTo(d[0] - k, d[1]);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function stripPoints() {
    const pts = [];
    for (const cab of [CAB_LEFT, CAB_GLASS]) {
      for (let x = cab.x + 40; x < cab.x + cab.w - 20; x += 90) pts.push({ x, y: cab.y + cab.h + 6 });
    }
    return pts;
  }

  function lights(lm, live, time, mk) {
    const windowColor = S.mixHex(P.moon, P.dawn, mk.window);
    lm.point(WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h / 2, 600, windowColor, S.lerp(0.5, 0.85, mk.window));
    lm.shaft(shaftQuad(mk), windowColor, S.lerp(0.85, 1, mk.window));
    // Moonlight lying on the counter and the sink under the window.
    lm.point(WINDOW.x + WINDOW.w / 2, COUNTER.top, 380, windowColor, S.lerp(0.34, 0.2, mk.window));

    // Fridge: a cold blue wedge across the floor and a tight glow along the
    // door edge itself — never spilling a cold stripe onto the wall.
    const ajar = fridgeAjar(mk);
    if (ajar > 0.01) {
      const hum = 0.9 + 0.1 * S.light.flicker(live.hum, time, 0.3);
      lm.shaft(fridgeWedge(), P.moon, 1.45 * ajar * hum);
      // Tight light along the fridge door slit edge
      for (const y of [440, 560, 680]) {
        lm.point(SLIT_X - 6, y, 68, COLD, 0.32 * ajar * hum);
      }
      // Soft spill under the door onto the floor in front.
      lm.point(1065, 885, 220, P.moon, 0.45 * ajar * hum);
    }

    // The pendant over the table: warm, unreliable, and it swings.
    const flick = pendantFlicker(live, time, mk);
    const theta = live.pendant.theta;
    const bulb = pendantBulb(theta);
    lm.point(bulb.x, bulb.y, 780, P.amber, 0.92 * flick);
    lm.cone(bulb.x, bulb.y - 6, Math.PI / 2 - theta, 1.18, 620, P.amber, 0.42 * flick);
    // Broad warm wall wash behind the table so the wainscot and wallpaper read
    // as one coherent material with a smooth warm-to-cool falloff toward the fridge.
    lm.point(bulb.x - 110, 520, 640, P.amber, 0.58 * flick);
    const pool = pendantPoint(theta, TABLE.top - CEILING);
    lm.point(pool.x, TABLE.top - 10, 420, P.amber, 0.68 * flick);
    // …and on the floor in front of the table.
    lm.point(pendantPoint(theta, 820).x, 930, 440, P.amber, 0.45 * flick);

    // The stove's pilot light: a pinprick of blue.
    lm.point(PILOT.x, PILOT.y, 70, P.moon, 0.22);

    // Off until the makeover: strip lights under the wall cabinets.
    if (mk.strip > 0) {
      for (const p of stripPoints()) lm.point(p.x, p.y + 30, 190, P.amber, 0.42 * mk.strip);
      lm.cone(CAB_LEFT.x + CAB_LEFT.w / 2, CAB_LEFT.y + CAB_LEFT.h + 4, Math.PI / 2, 2.2, 360, P.dawn, 0.5 * mk.strip);
      lm.cone(CAB_GLASS.x + CAB_GLASS.w / 2, CAB_GLASS.y + CAB_GLASS.h + 4, Math.PI / 2, 2.2, 360, P.dawn, 0.5 * mk.strip);
    }
    return flick;
  }

  function glow(g, lm, live, time, mk, flick) {
    const windowHex = mk.window > 0.5 ? P.dawn : P.moon;
    S.light.beam(g, shaftQuad(mk), windowHex, S.lerp(0.22, 0.32, mk.window));
    S.light.glow(g, WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h / 2, 240, windowHex, S.lerp(0.16, 0.28, mk.window));

    // The fridge: the crack itself burns white, and the wedge is visible in
    // the dust.
    const ajar = fridgeAjar(mk);
    if (ajar > 0.01) {
      const hum = 0.9 + 0.1 * S.light.flicker(live.hum, time, 0.3);
      // The warm floor and the night grade turn moonlight grey; tint the
      // wedge cold first (multiply), then lay the visible beam over it.
      coldTint(g, ajar * hum);
      S.light.beam(g, fridgeWedge(), P.moon, 0.8 * ajar * hum);
      for (let y = FRIDGE.top + 70; y < FRIDGE.floor - 40; y += 60) S.light.glow(g, SLIT_X + 3, y, 52, COLD, 0.38 * ajar * hum);
      S.light.glow(g, SLIT_X + 30, FRIDGE.floor - 10, 150, COLD, 0.32 * ajar * hum);
    }

    // The pendant: bulb bloom and soft warm air glow down to the table.
    const theta = live.pendant.theta;
    const bulb = pendantBulb(theta);
    S.light.glow(g, bulb.x, bulb.y, 180, P.amber, 0.58 * flick);
    S.light.glow(g, bulb.x, bulb.y + 2, 60, '#FFE6B8', 0.7 * flick);
    const midCone = pendantPoint(theta, PENDANT.cord + PENDANT.shade + 165);
    const lowCone = pendantPoint(theta, PENDANT.cord + PENDANT.shade + 320);
    S.light.glow(g, midCone.x, midCone.y, 240, P.amber, 0.16 * flick);
    S.light.glow(g, lowCone.x, lowCone.y, 310, P.amber, 0.12 * flick);

    // The pilot light: a tiny blue flame under the burner.
    const p = 0.85 + 0.15 * Math.sin(time * 19);
    S.light.glow(g, PILOT.x, PILOT.y, 18, P.moon, 0.7 * p);
    g.save();
    g.globalCompositeOperation = 'screen';
    g.fillStyle = S.rgba(S.mixHex(P.moon, P.plum, 0.18), 0.9 * p);
    g.beginPath();
    g.ellipse(PILOT.x, PILOT.y - 2, 2.2, 4 * p, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    if (mk.strip > 0) {
      for (const cab of [CAB_LEFT, CAB_GLASS]) {
        for (let x = cab.x + 30; x < cab.x + cab.w - 20; x += 40) S.light.glow(g, x, cab.y + cab.h + 6, 40, P.dawn, 0.45 * mk.strip);
      }
    }

    // The makeover's tap: clear water catches the morning light.
    const flow = (mk.tap ?? 0) * (mk.tapClear ?? 0);
    if (flow > 0.02) {
      for (const f of [0.2, 0.55, 0.9]) S.light.glow(g, TAP.spoutX, S.lerp(TAP.spoutY, COUNTER.top - 6, f), 24, P.dawn, 0.35 * flow);
    }
    drawSteam(g, mk);
    void lm;
  }

  // The kettle's whistle: puffs of steam curling up and away from the
  // spout. Timed from mk.t, which keeps running after the results card.
  function drawSteam(g, mk) {
    const t = mk.t ?? -1;
    const from = BEAT.whistle;
    const until = BEAT.whistle + 1.6;
    if (!mk.steaming || t < from || t > until + 1.6) return;
    const tip = { x: KETTLE.x - 72, y: KETTLE.base - 54 };
    const life = 1.5;
    g.save();
    g.globalCompositeOperation = 'screen';
    for (let i = 0; i < 12; i++) {
      const p = ((t - from) / life + i / 12) % 1; // 0 just out … 1 gone
      const born = t - p * life;
      if (born < from || born > until) continue;
      const x = tip.x - p * 52 + Math.sin(p * 5 + i * 1.3) * 12 * p;
      const y = tip.y - p * 130;
      const r = 8 + p * 34;
      const a = (1 - p) * 0.62;
      const puff = g.createRadialGradient(x, y, 0, x, y, r);
      puff.addColorStop(0, S.rgba(P.bone, a));
      puff.addColorStop(0.6, S.rgba(P.bone, a * 0.4));
      puff.addColorStop(1, S.rgba(P.bone, 0));
      g.fillStyle = puff;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();
  }

  // ── Behaviour of the room's own things ────────────────────────────────

  // A dart that hits the pendant's shade sets it swinging and stops there.
  function dartHitsPendant(dart, world) {
    const pd = world.live.pendant;
    const c = pendantPoint(pd.theta, PENDANT.cord + PENDANT.shade * 0.6);
    if (S.pointSegmentDistance(c.x, c.y, dart.px, dart.py, dart.x, dart.y) > 44) return false;
    pd.omega += (Math.sign(dart.vx) || 1) * 1.05;
    pd.jolt = 1;
    world.burst.dustPuff(c.x, c.y - 24, 4, 30);
    const audio = world.audio;
    if (audio && audio.ctx && !audio.muted) {
      // An enamel "tonk": a bright knock and a ringing overtone.
      audio.tone({ type: 'triangle', freq: 980, freqEnd: 900, duration: 0.5, gain: 0.08 });
      audio.tone({ type: 'sine', freq: 2210, duration: 0.3, gain: 0.03 });
    }
    return true;
  }

  function swingPendant(dt, world) {
    const pd = world.live.pendant;
    const steady = world.mk.pendantSteady ?? 0;
    const w0 = 3.1; // rad/s: about a two-second swing
    const damping = S.lerp(0.5, 2.6, steady);
    // A draught keeps the old lamp turning a little while the room is dirty.
    const draught = world.live.noise(world.time * 0.35 + 40) * 0.35 * (1 - steady);
    pd.omega += (-w0 * w0 * Math.sin(pd.theta) - damping * pd.omega + draught) * dt;
    pd.theta += pd.omega * dt;
    pd.jolt = Math.max(0, pd.jolt - dt * 1.6);

    // Spiders brushing the cord or landing on the shade set it going too.
    const top = pendantPoint(pd.theta, 10);
    const bottom = pendantPoint(pd.theta, PENDANT.cord + PENDANT.shade);
    for (const c of world.critters) {
      if (!c.rig || !c.alive) continue;
      const near = S.pointSegmentDistance(c.rig.x, c.rig.y, top.x, top.y, bottom.x, bottom.y) < 30;
      if (near && !pd.touching.has(c)) {
        pd.touching.add(c);
        const push = S.clamp((c.rig.vx || c.vx || 0) / 700, -0.7, 0.7);
        pd.omega += push || (c.rig.x < bottom.x ? 0.35 : -0.35);
      } else if (!near) {
        pd.touching.delete(c);
      }
    }
  }

  // ── Rules: what the director sends at you ─────────────────────────────

  const rules = {
    quota: 18,
    webGoal: 0.85,
    spawnPattern: ['string', 'jumper', 'string', 'crawler', 'jumper', 'string', 'crawler', 'jumper'],
    maxAlive: [3, 4],
    spawnInterval: [2.4, 1.3],
    types: ['string', 'crawler', 'jumper'],
  };

  // ── Makeover ─────────────────────────────────────────────────────────

  // A cue that fires once, and only when the makeover actually passes it:
  // jumping straight to the end (QA, finishMakeover) stays silent.
  function cueOnce(mk, name, t, at, fn) {
    mk.kitchenCues = mk.kitchenCues || new Set();
    if (t >= at && !mk.kitchenCues.has(name)) {
      mk.kitchenCues.add(name);
      if (t - at < 0.4) fn();
    }
  }

  const BEAT = {
    shut: 3.4, // the fridge door swings shut…
    thunk: 3.6,
    tapOn: 3.75, // …the tap sputters brown…
    tapClear: 4.05, // …and runs clear…
    tapOff: 4.95, // (1.2 s of water in all)
    whistle: 4.75, // …and the kettle whistles.
  };

  function sound(fx, play) {
    const a = fx.audio;
    if (a && a.ctx && !a.muted) play(a);
  }

  const makeover = {
    beats: [
      { key: 'strip', from: 1.8, to: 2.2, ease: 'out', chime: 0.25 }, // strip lights under the cabinets
      { key: 'pendantSteady', from: 2.3, to: 2.6, ease: 'linear', chime: 0.58 }, // the pendant stops flickering
      { key: 'curtain', from: 2.6, to: 3.8, ease: 'inOut' }, // the café curtain parts on the morning
    ],
    uniqueBeat: {
      key: 'kitchen',
      at: BEAT.shut,
      run(mk, t, fx) {
        mk.kitchen = 1;
        // The fridge door swings shut, with a little overshoot, and its light goes out.
        mk.fridgeShut = S.ease.outBack(S.clamp((t - BEAT.shut) / 0.28, 0, 1));
        cueOnce(mk, 'thunk', t, BEAT.thunk, () =>
          sound(fx, (a) => {
            a.tone({ type: 'sine', freq: 92, freqEnd: 46, duration: 0.22, gain: 0.42 });
            a.noise({ duration: 0.1, filter: 'lowpass', freq: 500, gain: 0.25 });
          })
        );

        // The tap: on, a cough of brown water, then clear for the rest.
        const on = S.clamp((t - BEAT.tapOn) / 0.1, 0, 1);
        const off = S.clamp((t - BEAT.tapOff) / 0.12, 0, 1);
        mk.tap = on * (1 - off);
        mk.tapClear = S.clamp((t - BEAT.tapClear) / 0.3, 0, 1);
        cueOnce(mk, 'sputter', t, BEAT.tapOn, () =>
          sound(fx, (a) => {
            for (let i = 0; i < 6; i++) setTimeout(() => a.noise({ duration: 0.05, filter: 'bandpass', freq: 500 + Math.random() * 500, q: 3, gain: 0.22 }), i * 50 + Math.random() * 20);
          })
        );
        cueOnce(mk, 'run', t, BEAT.tapClear, () =>
          sound(fx, (a) => {
            for (let i = 0; i < 3; i++) setTimeout(() => a.noise({ duration: 0.34, filter: 'bandpass', freq: 2200, q: 0.7, gain: 0.07, attack: 0.05 }), i * 280);
          })
        );
        if (mk.tap > 0.2 && Math.random() < 0.6) {
          // Splashes jump out of the basin.
          const brown = S.mixHex(P.rust, P.goo, 0.4);
          fx.burst.add('goo', TAP.spoutX + (Math.random() - 0.5) * 10, COUNTER.top - 10, {
            vx: (Math.random() - 0.5) * 160,
            vy: -120 - Math.random() * 160,
            gravity: 1400,
            drag: 0.6,
            life: 0.4,
            size: 1.6 + Math.random(),
            color: S.mixHex(brown, P.silk, mk.tapClear),
          });
        }

        // The kettle: two notes gliding up, and steam.
        cueOnce(mk, 'whistle', t, BEAT.whistle, () => {
          mk.steaming = true;
          sound(fx, (a) => {
            a.tone({ type: 'sine', freq: 1180, freqEnd: 1560, duration: 0.55, gain: 0.05, attack: 0.12 });
            a.tone({ type: 'sine', freq: 1560, freqEnd: 2080, duration: 0.85, gain: 0.05, attack: 0.1, delay: 0.42 });
            a.noise({ duration: 1.2, filter: 'highpass', freq: 4200, gain: 0.03, attack: 0.3 });
          });
        });
        // (The steam itself is drawn in the glow pass: see drawSteam.)
      },
    },
  };

  // ── QA staging (ART-DIRECTION §15) ────────────────────────────────────

  const qa = {
    // In front of the sink, in the moonlight: the fridge, the stool and the
    // table all stay in view.
    heroX: { dirty: 716, makeover: 716, clean: 716 },
    action: {
      heroX: 980,
      strings: [
        { x: 640, targetY: 470 },
        { x: 1300, targetY: 540 },
      ],
      crawlers: [{ lair: { x: 1740, y: 520 } }],
      eggs: [{ x: 1300, y: 660 }],
      hatchlings: [{ x: 1500, seed: 77 }],
      tear: { webs: 2, path: [100, 300, 400, 120] },
      kills: 9,
      score: 6420,
      nerve: 72,
      aimAt: { x: 640, y: 470 },
    },
    states: {
      // One Jumper frozen mid-leap above the table, legs splayed, body pitched
      // along its ballistic arc, three ghost silhouettes trailing back toward
      // the table, and a soft shadow on the tabletop below.
      jumper(api) {
        api.setState('playing');
        api.holdDirector();
        const hero = api.hero;
        hero.x = 1165;
        hero.facing = 1;
        api.setNerve(88);
        api.step(0.4);
        const spot = { x: 1445, y: 585 };
        api.spawn('jumper', { surface: 'table', x: spot.x, feetY: spot.y + 8, state: 'leap', vx: -485, vy: 5, facing: -1, hold: 99 });
        for (let i = 0; i < 12; i++) api.aimAt(spot.x, spot.y);
        api.step(0.1);
        for (let i = 0; i < 6; i++) api.aimAt(spot.x, spot.y);
      },
    },
  };

  // ── Register ─────────────────────────────────────────────────────────

  S.rooms.register({
    id: 'kitchen',
    number: 4,
    act: 1,
    name: 'Kitchen',
    layout,
    paint,
    makeWebs,
    createLive,
    drawSky,
    drawProps,
    lights,
    glow,
    shaftQuad,
    rules,
    makeover,
    storyObject: 'On the fridge: a recipe card, in a hand you almost know.',
    qa,

    onStart(world, info) {
      world.live.pendant = freshPendant();
      world.on('dart', ({ dart }) => dartHitsPendant(dart, world));
      // The 'action' frame also shows a Jumper, crouched on the counter.
      // (On the table under the pendant, clear of the staged dart's path.)
      if (info && info.qa === 'action') {
        world.spawn('jumper', { surface: 'table', x: 1468, state: 'crouch', crouch: 0.75, facing: -1, hold: 99 });
      }
    },

    onUpdate(dt, world) {
      swingPendant(dt, world);
    },

    // The room's first Jumper gets the room to itself for a few seconds, so
    // the player sees it prowl, crouch and leap before anything else comes.
    direct(dt, world) {
      return world.critters.some((c) => c.kind === 'jumper' && c.first && c.alive && c.age < 7);
    },
  });
})();
