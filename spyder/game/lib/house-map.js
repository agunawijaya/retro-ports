/*
 * Spyder — the house map.
 *
 * Two layers, because each is good at a different thing:
 *
 *   The desk (canvas). The plan lies on an old hall table under a lamp:
 *   walnut boards, the letter from A. half under the sheet, the front-door
 *   key, a pencil, a dead spider on its back. Painted once with the same
 *   brushes as the rooms, then lit, dusted and graded every frame like a
 *   room is — so the map belongs to the same game.
 *
 *   The plan (SVG on a DOM sheet). A hand-drawn floor plan of the house:
 *   ground floor, upstairs, attic. Text stays crisp and every room is a
 *   real <button>, so the map works with a keyboard and a screen reader.
 *   Lines are wobbled with the same noise the painted rooms use.
 *
 * The plan is inked as the house is cleaned: rooms you can play are drawn
 * in ink, rooms that are locked or not built yet are faint pencil — the
 * draughtsman has not got to them. Cleared rooms carry a red CLEAN stamp
 * and the best score in handwriting; the next room glows gently.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;
  const { paintShape, rectPoints, softShadow, stain } = S.paint;

  // ── The plan, in sheet units (the sheet is 1560 × 880 stage px) ───────

  const SHEET = { w: 1560, h: 880 };

  // Rooms by id; unnumbered spaces (hall, pantry, landing) have no id.
  const PLAN = {
    floors: [
      { label: 'Ground floor', x: 70, y: 104 },
      { label: 'Upstairs', x: 920, y: 104 },
      { label: 'Attic', x: 940, y: 556 },
    ],
    rooms: [
      { id: 'family-room', x: 70, y: 120, w: 270, h: 250, furniture: 'family' },
      { id: 'kitchen', x: 340, y: 120, w: 250, h: 250, furniture: 'kitchen' },
      { id: 'dining-room', x: 590, y: 120, w: 250, h: 250, furniture: 'dining' },
      { id: 'living-room', x: 70, y: 370, w: 390, h: 270, furniture: 'living' },
      { space: 'hall', x: 460, y: 370, w: 130, h: 270, ink: true, furniture: 'stairsUp' },
      { id: 'downstairs-bathroom', x: 590, y: 370, w: 250, h: 140, furniture: 'bath' },
      { space: 'pantry', x: 590, y: 510, w: 250, h: 130, furniture: 'pantry' },
      { id: 'front-porch', x: 250, y: 640, w: 430, h: 86, open: 'south', furniture: 'porch' },

      { id: 'master-bedroom', x: 920, y: 120, w: 230, h: 170, furniture: 'master' },
      { id: 'kids-bedroom', x: 1150, y: 120, w: 190, h: 170, furniture: 'kids' },
      { id: 'upstairs-bathroom', x: 1340, y: 120, w: 150, h: 170, furniture: 'bathSmall' },
      { id: 'upstairs-hallway', x: 920, y: 290, w: 570, h: 60, furniture: 'runner' },
      { id: 'study', x: 920, y: 350, w: 290, h: 130, furniture: 'study' },
      { space: 'landing', x: 1210, y: 350, w: 280, h: 130, furniture: 'stairsDown' },

      { id: 'attic', x: 940, y: 572, w: 300, h: 214, furniture: 'attic' },
    ],
    // Door openings: a gap in the wall plus the swing of the leaf.
    // `along` is the wall direction ('h' or 'v'); `swing` which side the arc goes.
    doors: [
      { x: 180, y: 370, along: 'h', w: 44, swing: 1 },
      { x: 340, y: 236, along: 'v', w: 44, swing: 1 },
      { x: 590, y: 236, along: 'v', w: 44, swing: -1 },
      { x: 460, y: 470, along: 'v', w: 46, swing: -1 },
      { x: 506, y: 370, along: 'h', w: 44, swing: 1 },
      { x: 590, y: 414, along: 'v', w: 38, swing: 1 },
      { x: 590, y: 572, along: 'v', w: 38, swing: 1 },
      { x: 504, y: 640, along: 'h', w: 50, swing: -1 }, // the front door
      { x: 1012, y: 290, along: 'h', w: 40, swing: -1 },
      { x: 1226, y: 290, along: 'h', w: 40, swing: -1 },
      { x: 1394, y: 290, along: 'h', w: 34, swing: -1 },
      { x: 1080, y: 350, along: 'h', w: 40, swing: 1 },
      { x: 1300, y: 350, along: 'h', w: 120, swing: 0 }, // the landing is open
    ],
    windows: [
      { x: 70, y: 470, along: 'v', w: 96 },
      { x: 150, y: 640, along: 'h', w: 80 },
      { x: 70, y: 220, along: 'v', w: 90 },
      { x: 180, y: 120, along: 'h', w: 90 },
      { x: 460, y: 120, along: 'h', w: 96 },
      { x: 714, y: 120, along: 'h', w: 100 },
      { x: 840, y: 240, along: 'v', w: 90 },
      { x: 840, y: 440, along: 'v', w: 50 },
      { x: 1030, y: 120, along: 'h', w: 90 },
      { x: 1244, y: 120, along: 'h', w: 80 },
      { x: 1414, y: 120, along: 'h', w: 44 },
      { x: 920, y: 414, along: 'v', w: 60 },
      { x: 1490, y: 320, along: 'v', w: 40 },
    ],
  };

  // Each floor's outside wall, inked before any room is.
  const OUTLINES = [
    [70, 120, 770, 520],
    [920, 120, 570, 360],
    [940, 572, 300, 214],
  ];

  // ── Hand-drawn SVG paths ──────────────────────────────────────────────

  // A straight line pushed sideways by noise, like a line drawn freehand
  // against a ruler that slipped a little.
  function wobbleD(x1, y1, x2, y2, seed, amp = 1.1, step = 16) {
    const noise = S.createNoise(seed);
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    const pieces = Math.max(1, Math.round(len / step));
    let d = `M${x1.toFixed(1)} ${y1.toFixed(1)}`;
    for (let i = 1; i <= pieces; i++) {
      const t = i / pieces;
      const push = i === pieces ? 0 : S.fbm(noise, seed * 0.37 + t * len * 0.05, 2) * amp * 2 * Math.sin(t * Math.PI);
      d += ` L${(S.lerp(x1, x2, t) + nx * push).toFixed(1)} ${(S.lerp(y1, y2, t) + ny * push).toFixed(1)}`;
    }
    return d;
  }

  function hashSeed(...parts) {
    let h = 7;
    for (const p of parts) h = (h * 31 + Math.round(p * 10)) >>> 0;
    return (h % 9973) + 1;
  }

  // The four walls of a room, broken where a door or window sits on them.
  function wallSegments(r) {
    const edges = [
      { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y, along: 'h', side: 'north' },
      { x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h, along: 'v', side: 'east' },
      { x1: r.x, y1: r.y + r.h, x2: r.x + r.w, y2: r.y + r.h, along: 'h', side: 'south' },
      { x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.h, along: 'v', side: 'west' },
    ].filter((e) => e.side !== r.open);

    const segments = [];
    for (const e of edges) {
      const fixed = e.along === 'h' ? e.y1 : e.x1;
      const from = e.along === 'h' ? e.x1 : e.y1;
      const to = e.along === 'h' ? e.x2 : e.y2;
      const gaps = [...PLAN.doors, ...PLAN.windows]
        .filter((o) => o.along === e.along && Math.abs((o.along === 'h' ? o.y : o.x) - fixed) < 2)
        .map((o) => {
          const c = o.along === 'h' ? o.x : o.y;
          return [c - o.w / 2, c + o.w / 2];
        })
        .filter(([a, b]) => b > from && a < to)
        .sort((a, b) => a[0] - b[0]);
      let cursor = from;
      for (const [a, b] of gaps) {
        if (a > cursor) segments.push(piece(e, fixed, cursor, a));
        cursor = Math.max(cursor, b);
      }
      if (cursor < to) segments.push(piece(e, fixed, cursor, to));
    }
    return segments;
  }

  function piece(e, fixed, a, b) {
    return e.along === 'h' ? [a, fixed, b, fixed] : [fixed, a, fixed, b];
  }

  // Ink: a firm wall line and a fainter second pass, slightly off.
  // Pencil: thin, grey, and overshooting the corners like construction lines.
  function wallsSvg(room, style) {
    let out = '';
    for (const [x1, y1, x2, y2] of wallSegments(room)) {
      const seed = hashSeed(x1, y1, x2, y2);
      if (style === 'ink') {
        out += `<path class="ink-wall" d="${wobbleD(x1, y1, x2, y2, seed, 0.9)}"/>`;
        out += `<path class="ink-wall-pass" d="${wobbleD(x1 + 0.8, y1 + 0.6, x2 + 0.8, y2 + 0.6, seed + 3, 1.3)}"/>`;
      } else {
        const over = 9;
        const dx = Math.sign(x2 - x1) * over;
        const dy = Math.sign(y2 - y1) * over;
        out += `<path class="pencil-wall" d="${wobbleD(x1 - dx, y1 - dy, x2 + dx, y2 + dy, seed, 1.4, 12)}"/>`;
        out += `<path class="pencil-wall-pass" d="${wobbleD(x1 - dx * 0.4, y1 + 1.2, x2 + dx * 0.6, y2 + 1.5, seed + 5, 1.8, 12)}"/>`;
      }
    }
    return out;
  }

  // Doors and windows take the style of the most-inked room they belong to.
  function openingsSvg(styleAt) {
    let out = '';
    for (const d of PLAN.doors) {
      const style = styleAt(d.x, d.y);
      if (d.swing === 0) continue;
      const r = d.w;
      if (d.along === 'h') {
        const hx = d.x - d.w / 2;
        const ey = d.y + d.swing * r;
        out += `<path class="${style}-door" d="M${hx} ${d.y} L${hx} ${ey}"/>`;
        out += `<path class="${style}-arc" d="M${hx} ${ey} A${r} ${r} 0 0 ${d.swing > 0 ? 0 : 1} ${hx + r} ${d.y}"/>`;
      } else {
        const hy = d.y - d.w / 2;
        const ex = d.x + d.swing * r;
        out += `<path class="${style}-door" d="M${d.x} ${hy} L${ex} ${hy}"/>`;
        out += `<path class="${style}-arc" d="M${ex} ${hy} A${r} ${r} 0 0 ${d.swing > 0 ? 1 : 0} ${d.x} ${hy + r}"/>`;
      }
    }
    for (const w of PLAN.windows) {
      const style = styleAt(w.x, w.y);
      const half = w.w / 2;
      for (const off of [-3.5, 0, 3.5]) {
        out += w.along === 'h'
          ? `<path class="${style}-window" d="M${w.x - half} ${w.y + off} L${w.x + half} ${w.y + off}"/>`
          : `<path class="${style}-window" d="M${w.x + off} ${w.y - half} L${w.x + off} ${w.y + half}"/>`;
      }
    }
    return out;
  }

  // Furniture as a draughtsman draws it: outlines only, low contrast.
  const FURNITURE = {
    living: (r) => [rect(r.x + 30, r.y + 30, 150, 46, 8), rect(r.x + 120, r.y + 120, 170, 110, 2), circle(r.x + 205, r.y + 175, 26), rect(r.x + 300, r.y + 210, 70, 34, 3), rect(r.x + 330, r.y + 24, 40, 120, 2)],
    family: (r) => [rect(r.x + 20, r.y + 20, 120, 30, 2), rect(r.x + 160, r.y + 150, 70, 70, 10), rect(r.x + 30, r.y + 170, 90, 50, 4), rect(r.x + 200, r.y + 24, 50, 70, 2)],
    kitchen: (r) => [rect(r.x + 16, r.y + 16, r.w - 32, 34, 2), rect(r.x + 16, r.y + 50, 34, 120, 2), circle(r.x + 160, r.y + 170, 38), circle(r.x + 130, r.y + 208, 10), circle(r.x + 196, r.y + 140, 10)],
    dining: (r) => [rect(r.x + 50, r.y + 80, 150, 70, 4), ...[0, 1, 2].flatMap((i) => [rect(r.x + 64 + i * 46, r.y + 60, 26, 16, 2), rect(r.x + 64 + i * 46, r.y + 154, 26, 16, 2)]), rect(r.x + 30, r.y + 18, 190, 26, 2)],
    bath: (r) => [rect(r.x + 120, r.y + 16, 110, 52, 18), circle(r.x + 60, r.y + 104, 18), rect(r.x + 16, r.y + 16, 40, 40, 6)],
    bathSmall: (r) => [rect(r.x + 18, r.y + 90, 114, 60, 18), circle(r.x + 40, r.y + 40, 16)],
    pantry: (r) => [rect(r.x + 16, r.y + 16, r.w - 32, 24, 1), rect(r.x + 16, r.y + 86, r.w - 32, 24, 1)],
    porch: (r) => [rect(r.x + 30, r.y + 18, 120, 34, 4), circle(r.x + 14, r.y + 74, 7), circle(r.x + r.w - 14, r.y + 74, 7), rect(r.x + 250, r.y + 50, 54, 26, 2)],
    master: (r) => [rect(r.x + 50, r.y + 30, 120, 110, 6), rect(r.x + 54, r.y + 34, 112, 26, 4), rect(r.x + 18, r.y + 24, 26, 26, 2), rect(r.x + 176, r.y + 24, 26, 26, 2)],
    kids: (r) => [rect(r.x + 16, r.y + 20, 70, 120, 4), rect(r.x + 20, r.y + 24, 62, 22, 3), rect(r.x + 120, r.y + 100, 54, 40, 3), circle(r.x + 140, r.y + 46, 16)],
    study: (r) => [rect(r.x + 18, r.y + 16, r.w - 36, 22, 1), rect(r.x + 90, r.y + 60, 110, 46, 3), circle(r.x + 146, r.y + 118, 10)],
    runner: (r) => [rect(r.x + 60, r.y + 18, r.w - 120, 24, 2)],
    attic: (r) => [rect(r.x + 30, r.y + 120, 70, 44, 3), rect(r.x + 110, r.y + 140, 54, 40, 3), circle(r.x + 230, r.y + 150, 20)],
    stairsUp: (r) => stairs(r.x + 22, r.y + 40, r.w - 44, 170, 'up'),
    stairsDown: (r) => [...stairs(r.x + 22, r.y + 18, 104, r.h - 36, 'down'), rect(r.x + 190, r.y + 34, 56, 56, 1, true)],
  };

  function rect(x, y, w, h, rx = 2, dashed = false) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"${dashed ? ' stroke-dasharray="6 5"' : ''}/>`;
  }
  function circle(cx, cy, r) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  }
  // Treads, and the arrow every plan draws on a staircase.
  function stairs(x, y, w, h, dir) {
    const out = [];
    for (let ty = y; ty <= y + h; ty += 16) out.push(`<path d="M${x} ${ty} L${x + w} ${ty}"/>`);
    out.push(`<path d="M${x} ${y} L${x} ${y + h} M${x + w} ${y} L${x + w} ${y + h}"/>`);
    const mid = x + w / 2;
    const tip = dir === 'up' ? y + 6 : y + h - 6;
    const tail = dir === 'up' ? y + h - 6 : y + 6;
    const head = dir === 'up' ? 10 : -10;
    out.push(`<path class="arrow" d="M${mid} ${tail} L${mid} ${tip} M${mid - 7} ${tip + head} L${mid} ${tip} L${mid + 7} ${tip + head}"/>`);
    return out;
  }

  const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // The compass rose and the title block: what makes it read as a plan.
  function chromeSvg() {
    const compass = `
      <g class="compass" transform="translate(866 80)">
        <circle r="26"/><circle r="20" class="thin"/>
        <path d="M0 -34 L6 0 L0 34 L-6 0 Z" class="needle"/>
        <path d="M0 -34 L6 0 L-6 0 Z" class="needle-n"/>
        <text y="-40" text-anchor="middle">N</text>
      </g>`;
    const block = `
      <g class="title-block" transform="translate(1272 560)">
        <path d="${wobbleD(0, 0, 218, 0, 41, 0.6)} ${wobbleD(218, 0, 218, 226, 42, 0.6)} ${wobbleD(218, 226, 0, 226, 43, 0.6)} ${wobbleD(0, 226, 0, 0, 44, 0.6)}"/>
        <path class="thin" d="M0 76 L218 76 M0 124 L218 124 M0 170 L218 170 M110 170 L110 226"/>
        <text class="tb-kicker" x="14" y="26">PLAN OF</text>
        <text class="tb-title" x="14" y="62">The House</text>
        <text class="tb-small" x="14" y="104">ROOMS TO CLEAN</text>
        <text class="tb-hand" x="150" y="106">15</text>
        <text class="tb-small" x="14" y="152">DRAWN BY</text>
        <text class="tb-hand" x="118" y="154">A.</text>
        <text class="tb-small" x="14" y="196">SCALE</text>
        <text class="tb-hand" x="14" y="218">¼ in : 1 ft</text>
        <text class="tb-small" x="124" y="196">SHEET</text>
        <text class="tb-hand" x="124" y="218">1 of 1</text>
      </g>`;
    const scale = `
      <g class="scale-bar" transform="translate(70 812)">
        <path d="M0 0 L200 0 M0 -6 L0 6 M50 -4 L50 4 M100 -6 L100 6 M150 -4 L150 4 M200 -6 L200 6"/>
        <text x="0" y="24">0</text><text x="96" y="24">10</text><text x="190" y="24">20 ft</text>
      </g>`;
    const legend = `
      <g class="legend" transform="translate(1272 502)">
        <text class="tb-small" x="0" y="0">INK — OPEN TO YOU</text>
        <text class="tb-small pencil-text" x="0" y="22">PENCIL — NOT YET</text>
      </g>`;
    const heading = `<text class="sheet-kicker" x="70" y="54">THE HOUSE · PLAN OF ROOMS</text>`;
    // Brass tacks hold the sheet to the table, one in each corner.
    const tacks = [[22, 22], [SHEET.w - 22, 24], [24, SHEET.h - 22], [SHEET.w - 24, SHEET.h - 24]]
      .map(([x, y]) => `<ellipse cx="${x + 3}" cy="${y + 4}" rx="11" ry="9" fill="rgba(30,18,10,0.35)"/><circle class="tack" cx="${x}" cy="${y}" r="10" fill="url(#plan-tack)"/>`)
      .join('');
    return heading + compass + block + scale + legend + tacks;
  }

  // ── Building the sheet for the current progress ──────────────────────

  /*
   * statusOf(id) → 'cleared' | 'open' | 'locked' | 'coming-soon' | 'secret'
   * Returns { svg, rooms: [{ id, number, name, status, box, record }] }.
   */
  function buildPlan(statusOf, recordOf) {
    const known = (id) => S.rooms.HOUSE.find((h) => h.id === id);
    const items = PLAN.rooms
      .map((r) => {
        if (!r.id) return { ...r, style: r.ink ? 'ink' : 'pencil' };
        const house = known(r.id);
        const status = statusOf(r.id);
        if (status === 'secret') return null;
        const style = status === 'cleared' || status === 'open' ? 'ink' : 'pencil';
        return { ...r, house, status, style, record: recordOf(r.id) };
      })
      .filter(Boolean);

    // Doors and windows take the ink of an inked room they touch.
    const touches = (r, x, y) => x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2;
    const styleAt = (x, y) => (items.some((r) => r.style === 'ink' && touches(r, x, y)) ? 'ink' : 'pencil');

    let svg = `<svg class="plan" viewBox="0 0 ${SHEET.w} ${SHEET.h}" aria-hidden="true">`;
    // Light pencil hatching for rooms not drawn yet; brass for the tacks.
    svg += '<defs>'
      + '<pattern id="plan-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><path d="M0 0 L0 9" stroke="#7a746c" stroke-width="1" opacity="0.16"/></pattern>'
      + '<radialGradient id="plan-tack" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#F6E2AD"/><stop offset="0.5" stop-color="#C49A55"/><stop offset="1" stop-color="#5E4320"/></radialGradient>'
      + '<radialGradient id="plan-glow" cx="50%" cy="46%" r="62%"><stop offset="0" stop-color="#F2A54A" stop-opacity="0.55"/><stop offset="0.6" stop-color="#F2A54A" stop-opacity="0.18"/><stop offset="1" stop-color="#F2A54A" stop-opacity="0"/></radialGradient>'
      + '</defs>';
    // Someone set a cup down on the plan, once.
    svg += '<g class="paper-wear"><ellipse cx="150" cy="770" rx="52" ry="49" transform="rotate(14 150 770)"/><ellipse class="faint" cx="154" cy="773" rx="45" ry="42"/></g>';
    svg += chromeSvg();
    for (const f of PLAN.floors) svg += `<text class="floor-label" x="${f.x}" y="${f.y - 4}">${esc(f.label.toUpperCase())}</text>`;

    // Room washes first (under the walls): the open room glows, cleared rooms are warm.
    for (const r of items) {
      if (r.status === 'open') svg += `<rect class="wash wash--open" x="${r.x + 4}" y="${r.y + 4}" width="${r.w - 8}" height="${r.h - 8}" rx="3"/>`;
      if (r.status === 'cleared') svg += `<rect class="wash wash--cleared" x="${r.x + 4}" y="${r.y + 4}" width="${r.w - 8}" height="${r.h - 8}" rx="3"/>`;
      if (r.style === 'pencil' && r.id) svg += `<rect class="hatch" x="${r.x + 6}" y="${r.y + 6}" width="${r.w - 12}" height="${r.h - 12}"/>`;
    }
    for (const [x, y, w, h] of OUTLINES) {
      const seed = hashSeed(x, y, w, h);
      svg += `<path class="outline" d="${wobbleD(x - 4, y - 4, x + w + 4, y - 4, seed, 0.7)} ${wobbleD(x + w + 4, y - 4, x + w + 4, y + h + 4, seed + 1, 0.7)} ${wobbleD(x + w + 4, y + h + 4, x - 4, y + h + 4, seed + 2, 0.7)} ${wobbleD(x - 4, y + h + 4, x - 4, y - 4, seed + 3, 0.7)}"/>`;
    }
    // Furniture, then walls: pencil rooms first so shared walls end up inked.
    for (const r of items) {
      const draw = FURNITURE[r.furniture];
      if (draw) svg += `<g class="${r.style}-furniture">${draw(r).join('')}</g>`;
    }
    for (const r of items.filter((i) => i.style === 'pencil')) svg += wallsSvg(r, 'pencil');
    for (const r of items.filter((i) => i.style === 'ink')) svg += wallsSvg(r, 'ink');
    svg += openingsSvg(styleAt);

    // Porch posts and steps, so the porch reads as outside.
    const porch = items.find((r) => r.id === 'front-porch');
    if (porch) {
      const s = porch.style;
      svg += `<g class="${s}-furniture">${[0, 1, 2].map((i) => rect(474 - i * 8, 726 + i * 12, 60 + i * 16, 12, 1)).join('')}</g>`;
    }

    // Labels: number, name, and what has happened in the room.
    for (const r of items) {
      if (!r.id) {
        svg += `<text class="space-label ${r.style}-text" x="${r.x + r.w / 2}" y="${r.y + r.h - 14}" text-anchor="middle">${esc(r.space)}</text>`;
        continue;
      }
      svg += labelSvg(r);
    }
    svg += notesSvg(items);
    svg += '</svg>';
    return { svg, rooms: items.filter((r) => r.id) };
  }

  // Rough text widths, enough to decide where a name has to wrap.
  const textWidth = (text, ink) => text.length * (ink ? 13.6 : 11.4);

  // Split "Downstairs Bathroom" over two lines when the room is too narrow.
  function fitName(name, room, ink) {
    const room4text = room.w - 74; // walls, padding and the number circle
    if (textWidth(name, ink) <= room4text || !name.includes(' ')) return [name];
    const words = name.split(' ');
    let best = [name];
    let bestWidth = Infinity;
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
      const widest = Math.max(...lines.map((l) => textWidth(l, ink)));
      if (widest < bestWidth) {
        best = lines;
        bestWidth = widest;
      }
    }
    return best;
  }

  // Pick the emptiest corner of room `r` for the CLEAN stamp so its box never
  // overlaps `labelBox` (number circle + room name + best-score line).
  // The CLEAN stamp goes in the emptiest corner of the room. Small rooms
  // (the Downstairs Bathroom: 250 × 140 with a four-line label) have no
  // corner big enough, so the stamp is tried smaller until it fits clear.
  function placeStamp(r, labelBox) {
    let fallback = null;
    for (const scale of [1, 0.84, 0.7, 0.58, 0.5]) {
      // Half-size of the stamp's box once it is rotated -12° (112 × 44 upright).
      const hw = 62 * scale;
      const hh = 34 * scale;
      const padX = Math.min(72, Math.max(hw + 10, r.w * 0.26));
      // Small stamps tuck into the strip along the room's edge.
      const padY = r.h <= 110 ? r.h / 2 : Math.max(hh + 6, 38 * scale);
      const candidates = [
        { x: r.x + r.w - padX, y: r.y + r.h - padY, bias: 4 }, // bottom-right (default for tall rooms)
        { x: r.x + padX, y: r.y + r.h - padY, bias: 2 }, // bottom-left
        { x: r.x + r.w - padX, y: r.y + padY, bias: 1 }, // top-right
        { x: r.x + padX, y: r.y + padY, bias: 0 }, // top-left
      ];
      let best = null;
      let bestScore = -Infinity;
      for (const c of candidates) {
        const dx = Math.max(labelBox.x0 - (c.x + hw), c.x - hw - labelBox.x1);
        const dy = Math.max(labelBox.y0 - (c.y + hh), c.y - hh - labelBox.y1);
        const clearance = Math.max(dx, dy);
        // Once clearance is comfortably positive (>= 14 px), prefer bottom-right.
        const score = Math.min(clearance, 24) * 10 + c.bias + clearance * 0.1;
        if (score > bestScore) {
          bestScore = score;
          best = { ...c, scale, clearance };
        }
      }
      if (best.clearance >= 6) return best;
      if (!fallback || best.clearance > fallback.clearance) fallback = best;
    }
    return fallback;
  }

  /*
   * A room's label as one centred block: the number in a circle (the way a
   * plan keys its rooms), the name on one or two lines, and under it what
   * has happened there. Cleared rooms get the stamp in a corner, the next
   * room a red-pencil ring.
   */
  function labelSvg(r) {
    const ink = r.style === 'ink';
    const lines = fitName(r.house.name, r, ink);
    const lineH = ink ? 28 : 27;
    const note = { cleared: 'best', 'coming-soon': 'coming soon', locked: 'not yet' }[r.status];
    const nameW = Math.max(...lines.map((l) => textWidth(l, ink)));
    const corridor = r.h <= 70;
    const tall = r.h > 100;

    let subLines = [];
    if (r.status === 'cleared') {
      const hasBest = r.record && r.record.best > 0;
      const bestLabel = hasBest ? `best ${r.record.best.toLocaleString('en-US')}` : 'cleared';
      const untouched = Boolean(r.record && r.record.untouched);
      const single = untouched ? `${bestLabel} · untouched` : bestLabel;
      // A short room whose name already takes two lines has no space left
      // for a fourth line and the stamp (the Downstairs Bathroom). There the
      // map keeps only the score; the hint below and the button's label
      // still say "untouched".
      const crowded = r.h <= 140 && lines.length > 1;
      if (corridor) {
        subLines = [bestLabel]; // drawn beside the name, see below; no room for "untouched"
      } else if (untouched && crowded) {
        subLines = [bestLabel];
      } else if (untouched && 34 + single.length * 10.5 > r.w - 32) {
        subLines = [bestLabel, 'untouched'];
      } else {
        subLines = [single];
      }
    }
    const subW = r.status === 'cleared'
      ? Math.max(...subLines.map((s) => s.length * 10.2))
      : (!corridor && note ? note.length * 10.2 : 0);

    const blockW = corridor && note
      ? 34 + nameW + 18 + (r.status === 'cleared' ? subW : note.length * 10.2)
      : 34 + Math.max(nameW, subW);
    const subH = r.status === 'cleared' ? subLines.length * 24 : (!corridor && note ? 26 : 0);
    const blockH = lines.length * lineH + subH;

    let left = r.x + r.w / 2 - blockW / 2;
    if (!tall && r.status === 'cleared' && r.w >= 380) {
      // Short, wide rooms (like the Front Porch): shift the centred label a
      // touch right so the left corner has generous room for the CLEAN stamp.
      left = Math.max(left, r.x + 136);
    }
    left = S.clamp(left, r.x + 12, Math.max(r.x + 12, r.x + r.w - blockW - 12));
    const top = corridor
      ? r.y + r.h / 2 + 7
      : !tall
        ? r.y + r.h / 2 - blockH / 2 + 18
        : r.y + r.h * 0.44 - blockH / 2 + 6;
    const tx = left + 34;

    let out = `<g class="room-label room-label--${r.status}" data-room="${r.id}">`;
    out += `<circle class="${ink ? 'ink' : 'pencil'}-key" cx="${left + 13}" cy="${top - 8}" r="13"/>`;
    out += `<text class="key-number ${ink ? '' : 'pencil-text'}" x="${left + 13}" y="${top - 3}" text-anchor="middle">${r.house.number}</text>`;
    lines.forEach((line, i) => {
      out += `<text class="${ink ? 'room-name' : 'room-name-pencil'}" x="${tx}" y="${top + i * lineH}">${esc(line)}</text>`;
    });
    const below = top + (lines.length - 1) * lineH + 26;

    if (r.status === 'cleared') {
      subLines.forEach((line, i) => {
        // In a corridor the line under the name would sit on the wall, so it
        // runs on after the name instead.
        const x = corridor ? tx + nameW + 18 : tx;
        const y = corridor ? top : below + i * 24;
        out += `<text class="best" x="${x}" y="${y}">${line}</text>`;
      });
      const labelBox = {
        x0: left - 2,
        y0: top - 22,
        x1: left + blockW + 2,
        y1: corridor ? top + 12 : below + (subLines.length - 1) * 24 + 12, // Caveat's descenders reach ~8 px below the line
      };
      const stampPos = placeStamp(r, labelBox);
      out += `<g class="stamp" transform="translate(${Math.round(stampPos.x)} ${Math.round(stampPos.y)}) rotate(-12) scale(${stampPos.scale})"><rect x="-56" y="-22" width="112" height="44" rx="6"/><text x="0" y="12" text-anchor="middle">CLEAN</text></g>`;
    } else if (r.status === 'open') {
      const openW = 34 + nameW;
      // A ring in red pencil around the room to do next, and a word for it.
      const ccx = left + openW / 2;
      const ccy = top - 8 + (lines.length - 1) * lineH / 2;
      const rx = Math.min(r.w / 2 - 12, openW / 2 + 30);
      const ry = Math.min(r.h / 2 - 12, lines.length * 16 + 24);
      out += `<ellipse class="ring" cx="${ccx}" cy="${ccy}" rx="${rx}" ry="${ry}" transform="rotate(-3 ${ccx} ${ccy})"/>`;
      // Tall rooms: on the ring's shoulder. Short ones (the porch): beside it,
      // where the note does not sit on the wall above.
      const nx = Math.min(r.x + r.w - 64, tall ? ccx + rx - 16 : ccx + rx + 10);
      const ny = tall ? ccy - ry + 4 : ccy + 9;
      out += `<text class="next-note" x="${nx}" y="${ny}" transform="rotate(-10 ${nx} ${ny})">next!</text>`;
    } else if (note) {
      const tilt = ((r.house.number * 37) % 7) - 3;
      const nx = corridor ? tx + nameW + 18 : tx + 4;
      const ny = corridor ? top + 1 : below - 2;
      out += `<text class="soon" x="${nx}" y="${ny}" transform="rotate(${tilt} ${nx} ${ny})">${note}</text>`;
    }
    out += '</g>';
    return out;
  }

  // A. left notes on the plan in pencil.
  function notesSvg(items) {
    const attic = items.find((r) => r.id === 'attic');
    let out = '';
    out += `<text class="margin-note" x="300" y="790" transform="rotate(-3 300 790)">front door — the key is the brass one</text>`;
    if (attic) out += `<text class="margin-note" x="1000" y="826" transform="rotate(2 1000 826)">don't go up there alone</text>`;
    return out;
  }

  // ── The desk (canvas) ────────────────────────────────────────────────

  const DESK_LAMP = { x: 230, y: -80 };

  function paintDesk() {
    const W = S.STAGE.width;
    const H = S.STAGE.height;
    const canvas = S.makeCanvas(W, H);
    const g = canvas.getContext('2d');
    const lightDir = { x: -0.55, y: -0.83 }; // toward the lamp, top-left

    // Walnut boards, grain running along them.
    const boards = [0, 262, 548, 812, H];
    for (let i = 0; i < boards.length - 1; i++) {
      const y0 = boards[i];
      const h = boards[i + 1] - y0;
      const tone = S.mixHex(P.walnut, P.oak, [0.25, 0.4, 0.3, 0.38][i]);
      paintShape(g, rectPoints(-10, y0, W + 20, h + 2), {
        color: tone,
        lightDir,
        light: 0.14,
        shadow: 0.42,
        strokes: 12,
        strokeAngle: 0,
        strokeJitter: 0.04,
        strokeSize: 2.2,
        variance: 0.14,
        rim: 0.18,
        innerShadow: 0.32,
        wobble: 1,
        seed: 61 + i,
      });
      woodGrain(g, y0, h, 90 + i * 7, tone);
      // The seam: a dark gap with a lit lower lip.
      g.fillStyle = S.rgba(P.soot, 0.7);
      g.fillRect(0, y0 - 2, W, 4);
      g.fillStyle = S.rgba(P.linen, 0.07);
      g.fillRect(0, y0 + 2, W, 2);
    }

    // A tea ring and old water marks: the table has been used, then left.
    stain(g, 96, 250, 54, '#1E140E', 12, 0.3);
    stain(g, 1830, 900, 70, '#1E140E', 14, 0.18);
    teaRing(g, 104, 560, 58);

    paintLetter(g); // A.'s letter, half under the plan
    paintKey(g); // the front-door key on its tag
    paintPencil(g);
    paintDeadSpider(g);
    return canvas;
  }

  function woodGrain(g, y0, h, seed, tone) {
    const noise = S.createNoise(seed);
    const rng = S.createRng(seed);
    g.save();
    g.beginPath();
    g.rect(0, y0, 1920, h);
    g.clip();
    for (let i = 0; i < 26; i++) {
      const baseY = y0 + rng.range(8, h - 8);
      const amp = rng.range(2, 9);
      g.strokeStyle = S.shade(tone, rng.range(-0.45, -0.15), rng.range(0.1, 0.24));
      g.lineWidth = rng.range(0.8, 2.4);
      g.beginPath();
      for (let x = -10; x <= 1930; x += 24) {
        const y = baseY + S.fbm(noise, x * 0.004 + i * 3.1, 3) * amp * 3;
        if (x === -10) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    // A knot or two: rings pulled around a dark eye.
    for (let k = 0; k < 2; k++) {
      const kx = rng.range(120, 1800);
      const ky = y0 + rng.range(30, h - 30);
      for (let r = 1; r <= 5; r++) {
        g.strokeStyle = S.shade(tone, -0.4, 0.2);
        g.lineWidth = 1.2;
        g.beginPath();
        g.ellipse(kx, ky, 8 + r * 9, 3 + r * 3.4, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = S.shade(tone, -0.6, 0.6);
      g.beginPath();
      g.ellipse(kx, ky, 7, 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function teaRing(g, x, y, r) {
    g.save();
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(30,18,10,0.28)';
    g.beginPath();
    g.ellipse(x, y, r, r * 0.92, 0.2, 0.3, Math.PI * 1.85);
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(30,18,10,0.2)';
    g.beginPath();
    g.ellipse(x + 3, y + 2, r - 6, r * 0.9 - 6, 0.2, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  function paintLetter(g) {
    g.save();
    g.translate(150, 960);
    g.rotate(-0.14);
    softShadow(g, 30, 30, 330, 150, 0.5);
    const paper = [
      [-200, -120],
      [260, -136],
      [276, 210],
      [-188, 226],
    ];
    paintShape(g, paper, {
      color: S.mixHex(P.linen, P.bone, 0.4),
      lightDir: { x: -0.5, y: -0.8 },
      light: 0.1,
      shadow: 0.2,
      strokes: 8,
      strokeAngle: 0.1,
      variance: 0.06,
      rim: 0.2,
      innerShadow: 0.25,
      wobble: 2.2,
      seed: 77,
    });
    // Foxing: the brown age spots old paper gets.
    stain(g, 170, 140, 46, '#8A6A3A', 21, 0.16);
    g.fillStyle = 'rgba(59,42,106,0.82)';
    g.font = '700 40px Caveat, "Segoe Print", cursive';
    g.fillText('…then you will', -150, 60);
    g.fillText('understand.', -110, 108);
    g.font = '700 32px Caveat, "Segoe Print", cursive';
    g.fillText('— A.', 40, 160);
    g.restore();
  }

  function paintKey(g) {
    g.save();
    g.translate(1818, 176);
    g.rotate(1.05);
    softShadow(g, 10, 14, 90, 30, 0.45);
    // The string from the bow to the tag.
    g.strokeStyle = S.rgba(P.linen, 0.75);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-58, 0);
    g.bezierCurveTo(-90, 30, -110, 60, -96, 96);
    g.stroke();
    // Bow, shank and bit, in brass.
    const brass = g.createLinearGradient(-60, -20, 60, 20);
    brass.addColorStop(0, '#F0D79A');
    brass.addColorStop(0.5, P.brass);
    brass.addColorStop(1, '#6B4C22');
    g.fillStyle = brass;
    g.beginPath();
    g.arc(-48, 0, 22, 0, Math.PI * 2);
    g.arc(-48, 0, 11, 0, Math.PI * 2, true);
    g.fill();
    g.fillRect(-28, -5, 86, 10);
    g.fillRect(36, 4, 10, 20);
    g.fillRect(50, 4, 8, 14);
    g.restore();

    // The paper tag: "front door".
    g.save();
    g.translate(1806, 352);
    g.rotate(-0.42);
    softShadow(g, 6, 10, 70, 22, 0.4);
    paintShape(g, [[-60, -26], [50, -26], [70, 0], [50, 26], [-60, 26]], {
      color: '#D9C49A',
      light: 0.1,
      shadow: 0.25,
      strokes: 10,
      rim: 0.2,
      innerShadow: 0.2,
      wobble: 1,
      seed: 31,
    });
    g.fillStyle = '#1A1410';
    g.beginPath();
    g.arc(52, 0, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(42,31,23,0.85)';
    g.font = '700 28px Caveat, "Segoe Print", cursive';
    g.fillText('front door', -52, 9);
    g.restore();
  }

  function paintPencil(g) {
    g.save();
    g.translate(1822, 650);
    g.rotate(1.47);
    softShadow(g, 14, 18, 150, 14, 0.45);
    // Hexagonal body: three faces catch the light differently.
    const faces = ['#C9A562', '#A9853F', '#7E6230'];
    faces.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(-120, -9 + i * 6, 190, 6);
    });
    // Ferrule and the worn eraser.
    g.fillStyle = '#9A9488';
    g.fillRect(-142, -9, 22, 18);
    g.fillStyle = 'rgba(40,30,20,0.35)';
    for (let i = 0; i < 3; i++) g.fillRect(-138 + i * 7, -9, 2, 18);
    g.fillStyle = '#B7766A';
    g.fillRect(-160, -8, 18, 16);
    // Sharpened end: bare wood, then graphite.
    g.fillStyle = '#E2C9A0';
    g.beginPath();
    g.moveTo(70, -9);
    g.lineTo(108, 0);
    g.lineTo(70, 9);
    g.closePath();
    g.fill();
    g.fillStyle = '#3A3634';
    g.beginPath();
    g.moveTo(96, -3);
    g.lineTo(110, 0);
    g.lineTo(96, 3);
    g.closePath();
    g.fill();
    g.restore();
  }

  // On its back, legs curled: the previous cleaner got this one.
  function paintDeadSpider(g) {
    const rig = new S.SpiderRig({ x: 1790, y: 1010, heading: 2.4, scale: 0.85, seed: 404 });
    rig.mode = 'hang';
    rig.curl = 1;
    rig.glint = 0;
    rig.update(0.016, 3);
    softShadow(g, 1790, 1022, 60, 18, 0.5);
    rig.draw(g);
  }

  // ── The scene: desk + light + dust + grade, every frame ─────────────

  S.createHouseMap = function createHouseMap({ canvas, sheetEl, hintEl, settings, onEnter }) {
    const ctx = canvas.getContext('2d');
    const light = new S.LightMap();
    const grain = S.paint.grainTile(256, 13);
    const noise = S.createNoise(8);
    let desk = null;
    let dust = null;
    let web = null;
    let time = 0;
    let buttons = [];

    // The desk needs the handwriting fonts before it is painted once.
    function ready() {
      if (desk) return Promise.resolve();
      const fonts = document.fonts ? document.fonts.load('700 40px Caveat') : Promise.resolve();
      return fonts.catch(() => {}).then(() => {
        desk = paintDesk();
        dust = new S.DustField(settings.particles === 'reduced' ? 60 : 120, { x: 0, y: 0, w: 1920, h: 1080 }, 33);
        // Silk in the corner where the table meets the wall.
        web = new S.Web({ hub: [1890, 26], anchors: [[1780, -6], [1830, -6], [1925, 20], [1925, 120], [1925, 180]], rings: 6, sheet: 0.35, seed: 91 });
      });
    }

    function frame(dt) {
      if (!desk) return;
      time += dt;
      dust.update(dt, time, 0);
      web.update(dt);
      render();
    }

    function render() {
      const W = S.STAGE.width;
      const H = S.STAGE.height;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(desk, 0, 0);
      web.draw(ctx, time);

      // The lamp is off-frame, top left; the house's wiring is no better here.
      const flick = S.light.flicker(noise, time, 0.6);
      light.begin(S.moods.dirty.ambient);
      light.point(DESK_LAMP.x, DESK_LAMP.y, 1500, P.amber, 0.78 * flick);
      light.cone(DESK_LAMP.x, DESK_LAMP.y, 0.85, 1.4, 1500, P.amber, 0.5 * flick);
      light.point(1980, 120, 820, P.moon, 0.3);
      light.apply(ctx);

      S.light.glow(ctx, DESK_LAMP.x - 40, DESK_LAMP.y + 20, 560, P.amber, 0.3 * flick);
      web.drawGlints(ctx, time, light);
      dust.draw(ctx, light, P.bone, 0);
      grade(ctx, W, H);
      ctx.restore();
    }

    function grade(g, W, H) {
      const mood = S.moods.dirty;
      g.save();
      g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = mood.gradeAlpha * 2;
      g.fillStyle = mood.grade;
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'saturation';
      g.globalAlpha = 1 - mood.saturation;
      g.fillStyle = '#808080';
      g.fillRect(0, 0, W, H);
      g.restore();
      const v = g.createRadialGradient(W * 0.42, H * 0.42, H * 0.4, W / 2, H / 2, H * 1.05);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(8,5,4,0.66)');
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
      if (settings.grain) {
        g.save();
        g.globalCompositeOperation = 'overlay';
        g.globalAlpha = 0.07;
        g.translate(-Math.floor(Math.random() * 256), -Math.floor(Math.random() * 256));
        g.fillStyle = g.createPattern(grain, 'repeat');
        g.fillRect(0, 0, W + 256, H + 256);
        g.restore();
      }
    }

    // Draw the plan for the current progress and wire up its rooms.
    function build(progress) {
      const statusOf = (id) => S.rooms.statusOf(id, progress);
      const plan = buildPlan(statusOf, (id) => progress.record(id));
      sheetEl.innerHTML = plan.svg;
      buttons = plan.rooms.map((r) => {
        const b = document.createElement('button');
        b.className = `map-room map-room--${r.status}`;
        b.style.left = `${r.x}px`;
        b.style.top = `${r.y}px`;
        b.style.width = `${r.w}px`;
        b.style.height = `${r.h}px`;
        b.dataset.room = r.id;
        b.setAttribute('aria-label', describe(r));
        b.addEventListener('click', () => choose(r));
        b.addEventListener('focus', () => hint(r));
        b.addEventListener('mouseenter', () => hint(r));
        sheetEl.appendChild(b);
        return b;
      });
      hint(null);
    }

    function describe(r) {
      const n = `Room ${r.house.number}, ${r.house.name}`;
      if (r.status === 'cleared') {
        const bestPart = r.record && r.record.best > 0 ? `, best score ${r.record.best}` : '';
        const untouched = r.record && r.record.untouched ? ', untouched' : '';
        return `${n}: clean${bestPart}${untouched}. Play again.`;
      }
      if (r.status === 'open') return `${n}: the next room to clean. Enter.`;
      if (r.status === 'locked') return `${n}: not yet — clean the rooms before it first.`;
      return `${n}: coming soon.`;
    }

    function hint(r) {
      if (!r) {
        const next = buttons.find((b) => b.classList.contains('map-room--open'));
        const name = next ? S.rooms.HOUSE.find((h) => h.id === next.dataset.room).name : null;
        hintEl.textContent = name ? `Next on the list: the ${name}.` : 'Every room that exists is clean. More are on the way.';
        return;
      }
      const name = cap(`the ${r.house.name}`);
      const say = {
        cleared: () => {
          const bestPart = r.record && r.record.best > 0 ? ` Best ${r.record.best.toLocaleString('en-US')}.` : '';
          const untouched = r.record && r.record.untouched ? ' Not a scratch.' : '';
          return `${name} — clean.${bestPart}${untouched} Go in again?`;
        },
        open: () => `${name} — still full of spiders. Go in.`,
        locked: () => `${name} — clean the rooms before it first.`,
        'coming-soon': () => `${name} — not ready yet.`,
      };
      hintEl.textContent = say[r.status]();
    }

    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    function choose(r) {
      if (r.status === 'cleared' || r.status === 'open') {
        onEnter(r.id);
        return;
      }
      hint(r);
      const b = buttons.find((x) => x.dataset.room === r.id);
      b.classList.remove('is-refused');
      void b.offsetWidth;
      b.classList.add('is-refused');
    }

    // Arrow keys hop to the nearest room in that direction.
    /*
     * Arrow keys hop to the neighbouring room in that direction. Rooms are
     * compared edge to edge, not centre to centre: the porch is wide and the
     * Living Room above it is wide, and "up from the porch" should land in
     * the room that touches it, not the one whose middle happens to line up.
     */
    function moveFocus(dx, dy) {
      const current = document.activeElement;
      const from = buttons.includes(current) ? current : null;
      if (!from) {
        focusDefault();
        return;
      }
      const a = box(from);
      let best = null;
      let bestScore = Infinity;
      for (const b of buttons) {
        if (b === from) continue;
        const o = box(b);
        // Must lie beyond us in that direction (centres), however close the edges are.
        const ahead = (o.cx - a.cx) * dx + (o.cy - a.cy) * dy;
        if (ahead <= 4) continue;
        // Gap between the facing edges, and how far off to the side it is.
        const gap = dx > 0 ? o.x0 - a.x1 : dx < 0 ? a.x0 - o.x1 : dy > 0 ? o.y0 - a.y1 : a.y0 - o.y1;
        const side = dx !== 0 ? rangeGap(a.y0, a.y1, o.y0, o.y1) : rangeGap(a.x0, a.x1, o.x0, o.x1);
        // Left/right stays on the same floor: the floors sit side by side on the sheet.
        const otherFloor = dx !== 0 && floorOf(b) !== floorOf(from) ? 600 : 0;
        const score = Math.max(0, gap) + side * 2 + otherFloor;
        if (score < bestScore) {
          bestScore = score;
          best = b;
        }
      }
      if (best) best.focus();
    }

    const floorOf = (b) => S.rooms.HOUSE.find((h) => h.id === b.dataset.room)?.floor;
    const rangeGap = (a0, a1, b0, b1) => Math.max(0, b0 - a1, a0 - b1);

    function box(b) {
      const x0 = b.offsetLeft;
      const y0 = b.offsetTop;
      const x1 = x0 + b.offsetWidth;
      const y1 = y0 + b.offsetHeight;
      return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    }

    function focusDefault() {
      const target = buttons.find((b) => b.classList.contains('map-room--open')) || buttons.find((b) => b.classList.contains('map-room--cleared')) || buttons[0];
      if (target) target.focus({ preventScroll: true });
    }

    return { ready, frame, render: () => desk && render(), build, moveFocus, focusDefault };
  };

  S.houseMap = { PLAN, SHEET, buildPlan };
})();
