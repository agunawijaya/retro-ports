/**
 * @file The phone matrix (prompts/05-polish-fix-1.md, for prompt 05 §3):
 * every screen at 390 × 844, 844 × 390 and 768 × 1024 (DPR 2, touch
 * contexts), plus the room at 390 × 844 DPR 3. Each cell is checked in the
 * page: (1) the canvas fills the screen, (2) every visible text element sits
 * inside the viewport, (3) no two of them overlap, (4) the smallest Jost
 * line is ≥ 13 px (the tablet is reported, not failed), (5) on the portrait
 * phone the room's tools sit in the lower 30 %, (6) no browser gestures
 * (touch-action, user-select, overscroll-behavior). Then the touch round,
 * once per size: tap-to-walk in room 6, the Batu Catatan tap, a niche tap
 * on floor I, a records tab tap, a Kolam slider drag, and an editor paint
 * drag. Console errors are collected per page and fail the cell.
 *
 * The tool reports; it does not fix. Writes
 * `review/prompts/05-polish/phone-matrix.md` and exits 1 if anything fails.
 *
 * Usage:
 *   node tools/phone-check.mjs [--url <game url>]
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  resolveTarget,
  launchBrowser,
  collectConsoleErrors,
  waitForHening,
  withParams,
  parseFlags,
  GAME_DIR,
} from './lib/harness.mjs';

const REPORT_PATH = path.resolve(GAME_DIR, '..', 'review', 'prompts', '05-polish', 'phone-matrix.md');

const SIZES = [
  { id: 'phone-portrait', label: '390 × 844 @2', width: 390, height: 844, dpr: 2, phone: true, portraitRoom: true },
  { id: 'phone-landscape', label: '844 × 390 @2', width: 844, height: 390, dpr: 2, phone: true },
  { id: 'tablet', label: '768 × 1024 @2', width: 768, height: 1024, dpr: 2, tablet: true },
  { id: 'phone-portrait-dpr3', label: '390 × 844 @3', width: 390, height: 844, dpr: 3, phone: true, portraitRoom: true, roomOnly: true, skipTouch: true },
];

// The garden shoot-modes.mjs shares between the slot list, the editor and
// the play frame: slot 1 tested, slot 2 half-built, slot 3 ready.
const GARDEN_ROOM = ['#########', '#       #', '# .$ $. #', '#   @   #', '#       #', '#########'];
const GARDEN = {
  slots: Array.from({ length: 50 }, (_, i) => {
    if (i === 0) return { rows: GARDEN_ROOM, tested: true, solution: 'uLrR', record: { steps: 4, pushes: 2 } };
    if (i === 1) return { rows: ['#######', '# .$  #', '#  $. #', '#######'], tested: false };
    if (i === 2) return { rows: ['######', '#@$ .#', '######'], tested: false };
    return null;
  }),
};

const room6 = [`h.progress({ solvedUpTo: 5 })`, `h.screen('room', { room: 6 })`, `h.skipIntro()`];

/** Each screen: storage/state first, then the QA navigation, then the settle wait. */
const SCREENS = [
  { id: 'title', steps: [`h.progress({ solvedUpTo: 0 })`, `h.screen('title')`], wait: 1800 },
  { id: 'courtyard', steps: [`h.progress({ solvedUpTo: 0 })`, `h.screen('courtyard')`], wait: 1800, touch: 'courtyard' },
  { id: 'courtyard-caption', steps: [`h.progress({ solvedUpTo: 0 })`, `h.screen('courtyard', { at: 'batu' })`], wait: 1800 },
  { id: 'elevator', steps: [`h.progress({ solvedUpTo: 12 })`, `h.screen('elevator', { from: 0, to: 2, then: 'floor' })`], wait: 2500 },
  { id: 'floor1', steps: [`h.progress({ solvedUpTo: 4 })`, `h.screen('floor', { floor: 1 })`], wait: 1800, touch: 'floor' },
  { id: 'floor5', steps: [`h.progress({ solvedUpTo: 46 })`, `h.screen('floor', { floor: 5 })`], wait: 1800 },
  { id: 'room6', steps: room6, wait: 1800, touch: 'room' },
  { id: 'room6-results', steps: [...room6, `h.screen('results', { room: 6 })`], wait: 1800 },
  { id: 'pause', steps: [...room6, `h.screen('pause', { room: 6 })`], wait: 1800 },
  { id: 'records', steps: [`h.progress({ solvedUpTo: 23 })`, `h.screen('records')`], wait: 1800, touch: 'records' },
  { id: 'kolam', steps: [`h.progress({ solvedUpTo: 23 })`, `h.screen('settings')`], wait: 1800, touch: 'kolam' },
  { id: 'gate-choice', steps: [`h.progress({ solvedUpTo: 5 })`, `h.screen('courtyard', { at: 'gerbang' })`, `h.screen('gate-choice')`], wait: 1800 },
  { id: 'mimpi', steps: [`h.progress({ solvedUpTo: 8 })`, `h.screen('dream', { room: 10 })`], wait: 4000 },
  { id: 'editor', steps: [`h.garden(${JSON.stringify(GARDEN)})`, `h.screen('garden-editor', { slot: 0 })`], wait: 2200, touch: 'editor' },
  { id: 'ending', steps: [`h.progress({ solvedUpTo: 50 })`, `h.screen('ending')`], wait: 3500 },
];

// --- the in-page checks (1-6) -------------------------------------------------

/**
 * Runs checks 1-6 in the page and returns plain data; the Node side decides
 * what fails (the tablet's legibility is reported, not failed, and check 5
 * only applies to the portrait-phone room).
 */
function runChecksInPage() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sel = (el) => (el.id
    ? `#${el.id}`
    : `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).join('.')
      : ''}`);

  // 1. The canvas fills the screen (1 px tolerance).
  const canvas = document.querySelector('canvas');
  const cr = canvas ? canvas.getBoundingClientRect() : null;
  const canvasInfo = cr
    ? {
        rect: { x: cr.x, y: cr.y, w: cr.width, h: cr.height },
        ok: Math.abs(cr.x) <= 1 && Math.abs(cr.y) <= 1 && Math.abs(cr.width - vw) <= 1 && Math.abs(cr.height - vh) <= 1,
      }
    : null;

  // The visible text set, exactly as the prompt defines it: non-empty
  // innerText, offsetParent !== null (null for `position: fixed` wrappers —
  // their children are still checked on their own), and effectively opaque:
  // the computed opacity of the element AND its ancestors, so text inside a
  // faded-out veil (.veil.hidden, .hud.off) is not counted as on screen.
  const effectiveOpacity = (el) => {
    let o = 1;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      o *= Number(getComputedStyle(n).opacity);
      if (o <= 0.05) break;
    }
    return o;
  };
  const visible = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!(el instanceof HTMLElement)) continue;
    const text = (el.innerText || '').trim();
    if (!text) continue;
    if (el.offsetParent === null) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.visibility === 'collapse') continue;
    if (effectiveOpacity(el) <= 0.05) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    visible.push({
      el,
      sel: sel(el),
      text: text.slice(0, 60),
      rect: { l: r.left, t: r.top, r: r.right, b: r.bottom },
      fontFamily: cs.fontFamily,
      fontSize: parseFloat(cs.fontSize),
    });
  }

  // 2. Inside the screen (1 px tolerance).
  // 05 review (Opus): text inside a card that scrolls vertically is reachable, not off the screen,
  // as long as the card itself is inside the screen and the text does not run off its sides.
  const inScrollingCard = (v) => {
    for (let a = v.el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (!/(auto|scroll)/.test(cs.overflowY) || a.scrollHeight <= a.clientHeight + 1) continue;
      const r = a.getBoundingClientRect();
      const cardInside = r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1;
      return cardInside && v.rect.l >= r.left - 1 && v.rect.r <= r.right + 1;
    }
    return false;
  };
  const offscreen = visible
    .filter((v) => v.rect.l < -1 || v.rect.t < -1 || v.rect.r > vw + 1 || v.rect.b > vh + 1)
    .filter((v) => !inScrollingCard(v))
    .map((v) => ({ sel: v.sel, text: v.text, rect: v.rect }));

  // 3. Nothing overlaps (more than 2 px in both axes; ancestor/descendant excluded).
  const overlaps = [];
  outer: for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i];
      const b = visible[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.rect.r, b.rect.r) - Math.max(a.rect.l, b.rect.l);
      const oy = Math.min(a.rect.b, b.rect.b) - Math.max(a.rect.t, b.rect.t);
      if (ox > 2 && oy > 2) {
        overlaps.push({ a: a.sel, atext: a.text, b: b.sel, btext: b.text, ox: +ox.toFixed(1), oy: +oy.toFixed(1) });
        if (overlaps.length >= 10) break outer;
      }
    }
  }

  // 4. The smallest visible Jost line.
  const jost = visible.filter((v) => /jost/i.test(v.fontFamily));
  const jostMin = jost.length ? jost.reduce((m, v) => Math.min(m, v.fontSize), Infinity) : null;
  const jostMinSel = jost.length ? jost.find((v) => v.fontSize === jostMin).sel : null;

  // 5. The bottom edge of the HUD controls / hint block (the room only).
  const hudBottoms = ['#tools', '#hint']
    .map((s) => document.querySelector(s))
    .filter((el) => el && effectiveOpacity(el) > 0.05)
    .map((el) => el.getBoundingClientRect().bottom);
  const hudBottom = hudBottoms.length ? Math.max(...hudBottoms) : null;

  // 6. No browser gestures.
  const gestures = [];
  for (const [name, el] of [['html', document.documentElement], ['body', document.body], ['canvas', canvas]]) {
    if (!el) continue;
    const cs = getComputedStyle(el);
    gestures.push({ el: name, touchAction: cs.touchAction, userSelect: cs.userSelect, overscroll: cs.overscrollBehavior });
  }

  return { vw, vh, canvas: canvasInfo, offscreen, overlaps, jostMin, jostMinSel, hudBottom, gestures };
}

/** Turns the in-page data into this cell's failures. */
function evaluateChecks(data, size, screenId) {
  const failures = [];
  if (!data.canvas) {
    failures.push({ check: 1, reason: 'no canvas found' });
  } else if (!data.canvas.ok) {
    const r = data.canvas.rect;
    failures.push({ check: 1, reason: `canvas rect ${r.w}×${r.h} at (${r.x}, ${r.y}) ≠ viewport ${data.vw}×${data.vh}` });
  }
  for (const o of data.offscreen) {
    const r = o.rect;
    failures.push({
      check: 2,
      reason: `${o.sel} "${o.text}" sticks out (l ${r.l.toFixed(1)}, t ${r.t.toFixed(1)}, r ${r.r.toFixed(1)}, b ${r.b.toFixed(1)} of ${data.vw}×${data.vh})`,
    });
  }
  for (const o of data.overlaps) {
    failures.push({ check: 3, reason: `${o.a} "${o.atext}" × ${o.b} "${o.btext}" overlap ${o.ox}×${o.oy} px` });
  }
  if (size.phone && data.jostMin !== null && data.jostMin < 13) {
    failures.push({ check: 4, reason: `smallest Jost line ${data.jostMin}px (${data.jostMinSel}) < 13 px` });
  }
  if (size.portraitRoom && screenId === 'room6') {
    if (data.hudBottom === null) {
      failures.push({ check: 5, reason: 'no visible HUD controls/hint block found' });
    } else if (data.hudBottom < data.vh * 0.7) {
      failures.push({ check: 5, reason: `HUD controls bottom ${Math.round(data.hudBottom)} px is above the lower 30 % (needs ≥ ${Math.round(data.vh * 0.7)} of ${data.vh})` });
    }
  }
  for (const g of data.gestures) {
    if (!['none', 'manipulation'].includes(g.touchAction)) {
      failures.push({ check: 6, reason: `${g.el} touch-action is "${g.touchAction}" (needs none or manipulation)` });
    }
    if (g.userSelect !== 'none') {
      failures.push({ check: 6, reason: `${g.el} user-select is "${g.userSelect}" (needs none)` });
    }
    const tokens = g.overscroll.split(/\s+/).filter(Boolean);
    if (!tokens.length || !tokens.every((t) => t === 'none' || t === 'contain')) {
      failures.push({ check: 6, reason: `${g.el} overscroll-behavior is "${g.overscroll}" (needs none or contain)` });
    }
  }
  return failures;
}

// --- helpers for the touch round ------------------------------------------------

/** Polls `fnBody` (truthy = done) in the page; resolves the last value. */
async function poll(page, fnBody, timeout = 5000, interval = 120) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeout) {
    last = await page.evaluate(`(() => { const h = window.hening; return (${fnBody}); })()`);
    if (last) return last;
    await page.waitForTimeout(interval);
  }
  return last;
}

/**
 * Screen pixels of a board cell, from the room/editor camera's live state
 * (the same module instance the game uses, read back through a dynamic
 * import). Ortho projection replicates render/camera.js's placeCamera.
 */
async function cellPoint(page, r, c) {
  return page.evaluate(async ({ r, c }) => {
    const { view } = await import('/src/render/camera.js');
    const { board } = await import('/src/render/board.js');
    const E = Math.atan(1 / Math.SQRT2);
    const a = view.azimuth;
    const right = [Math.cos(a), 0, -Math.sin(a)];
    const up = [-Math.sin(a) * Math.sin(E), Math.cos(E), -Math.cos(a) * Math.sin(E)];
    const dx = c - board.cols / 2 + 0.5 - view.target.x;
    const dy = 0 - view.target.y;
    const dz = r - board.rows / 2 + 0.5 - view.target.z;
    const vx = dx * right[0] + dy * right[1] + dz * right[2];
    const vy = dx * up[0] + dy * up[1] + dz * up[2];
    const aspect = window.innerWidth / window.innerHeight;
    const ndcX = vx / (view.halfHeight * aspect);
    const ndcY = vy / view.halfHeight;
    return { x: ((ndcX + 1) / 2) * window.innerWidth, y: ((1 - ndcY) / 2) * window.innerHeight };
  }, { r, c });
}

/** A real touch drag (start, moves, end) through CDP, so pointer capture works. */
async function touchDrag(page, points) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: points[0].x, y: points[0].y, id: 1 }] });
  for (const p of points.slice(1)) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
    await page.waitForTimeout(40);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

// --- the touch round ------------------------------------------------------------

/** Parses room rows into a walkability grid (objects and walls block). */
function parseRoomRows(rows) {
  const open = (ch) => ch !== '#' && ch !== '$' && ch !== '*';
  const at = (r, c) => (r >= 0 && r < rows.length && c >= 0 && c < rows[r].length ? rows[r][c] : '#');
  return {
    isOpen: (r, c) => open(at(r, c)),
    neighbours: ({ r, c }) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
      .filter(([rr, cc]) => open(at(rr, cc)))
      .map(([rr, cc]) => ({ r: rr, c: cc })),
    /** BFS distances from `start` over open cells. */
    distances(start) {
      const dist = new Map([[`${start.r},${start.c}`, 0]]);
      const queue = [start];
      while (queue.length) {
        const cur = queue.shift();
        for (const n of this.neighbours(cur)) {
          const key = `${n.r},${n.c}`;
          if (dist.has(key)) continue;
          dist.set(key, dist.get(`${cur.r},${cur.c}`) + 1);
          queue.push(n);
        }
      }
      return dist;
    },
  };
}

/** Room 6: tap the tile next to the wanderer, then a tile three away along an open path. */
async function touchRoom(page, grid) {
  const state0 = await page.evaluate(() => ({ player: { ...window.hening.state.player }, steps: window.hening.state.steps }));

  // Calibration: the computed projection must land on hening.where() (y 0.5 up).
  const where = await page.evaluate(() => window.hening.where());
  const proj = await page.evaluate(async ({ r, c }) => {
    const { view } = await import('/src/render/camera.js');
    const { board } = await import('/src/render/board.js');
    const E = Math.atan(1 / Math.SQRT2);
    const a = view.azimuth;
    const right = [Math.cos(a), 0, -Math.sin(a)];
    const up = [-Math.sin(a) * Math.sin(E), Math.cos(E), -Math.cos(a) * Math.sin(E)];
    const dx = c - board.cols / 2 + 0.5 - view.target.x;
    const dy = 0.5 - view.target.y;
    const dz = r - board.rows / 2 + 0.5 - view.target.z;
    const vx = dx * right[0] + dy * right[1] + dz * right[2];
    const vy = dx * up[0] + dy * up[1] + dz * up[2];
    const aspect = window.innerWidth / window.innerHeight;
    return {
      x: ((vx / (view.halfHeight * aspect) + 1) / 2) * window.innerWidth,
      y: ((1 - vy / view.halfHeight) / 2) * window.innerHeight,
    };
  }, state0.player);
  const off = Math.hypot(proj.x - where.x, proj.y - where.y);
  if (off > 8) return { ok: false, detail: `tool projection is ${off.toFixed(1)} px off hening.where() — cannot aim taps` };

  // 1) An open neighbour: one tap, one step.
  const next = grid.neighbours(state0.player)[0];
  if (!next) return { ok: false, detail: 'no open tile next to the wanderer' };
  const p1 = await cellPoint(page, next.r, next.c);
  await page.touchscreen.tap(p1.x, p1.y);
  const stepped = await poll(
    page,
    `h.state.steps > ${state0.steps} && h.state.player.r === ${next.r} && h.state.player.c === ${next.c}`,
    4000,
  );
  if (!stepped) {
    const now = await page.evaluate(() => ({ player: { ...window.hening.state.player }, steps: window.hening.state.steps }));
    return { ok: false, detail: `tap on the neighbour (${next.r}, ${next.c}) at (${Math.round(p1.x)}, ${Math.round(p1.y)}) did not move the wanderer (still ${JSON.stringify(now)})` };
  }

  // 2) A tile three away along an open path: the wanderer walks there.
  const dist = grid.distances(next);
  const far = [...dist.entries()].filter(([, d]) => d === 3).map(([key]) => {
    const [r, c] = key.split(',').map(Number);
    return { r, c };
  })[0];
  if (!far) return { ok: false, detail: 'no tile exactly three steps away along an open path' };
  const p2 = await cellPoint(page, far.r, far.c);
  await page.touchscreen.tap(p2.x, p2.y);
  const arrived = await poll(page, `h.state.player.r === ${far.r} && h.state.player.c === ${far.c}`, 6000);
  if (!arrived) {
    const now = await page.evaluate(() => ({ ...window.hening.state.player }));
    return { ok: false, detail: `tap on (${far.r}, ${far.c}), three away, left the wanderer at ${JSON.stringify(now)}` };
  }
  return {
    ok: true,
    detail: `neighbour tap → steps ${state0.steps} → ${state0.steps + 1} at (${next.r}, ${next.c}); tap three away → walked to (${far.r}, ${far.c})`,
  };
}

/** Courtyard: tap the Batu Catatan place — a caption appears (or records opens). */
async function touchCourtyard(page) {
  const p = await page.evaluate(async () => {
    const { PLACES } = await import('/src/world/places.js');
    const { getTowerWorld } = await import('/src/world/tower-world.js');
    const world = getTowerWorld(document.querySelector('canvas'));
    const place = PLACES.find((pl) => pl.id === 'batu');
    const [pr, pc] = place.cells[0];
    return world.toScreen({ x: pc - 4, y: 0, z: pr - 4 });
  });
  await page.touchscreen.tap(p.x, p.y);
  const seen = await poll(
    page,
    `h.current()?.top === 'records' || !!h.screenInfo()?.caption`,
    12000,
    250,
  );
  if (!seen) return { ok: false, detail: `tapped Batu Catatan at (${Math.round(p.x)}, ${Math.round(p.y)}) — no caption, no records` };
  const opened = await page.evaluate(() => window.hening.current()?.top === 'records');
  return { ok: true, detail: opened ? 'tap on Batu Catatan → the records screen opened' : 'tap on Batu Catatan → its caption appeared' };
}

/** Floor I: tap a lit (solved) niche that is not the current one. */
async function touchFloor(page) {
  const aim = await page.evaluate(async () => {
    const { niche, floorStone } = await import('/src/world/stone-layout.js');
    const { getTowerWorld } = await import('/src/world/tower-world.js');
    const world = getTowerWorld(document.querySelector('canvas'));
    const info = window.hening.screenInfo();
    const lit = info.alcoves.map((a, i) => ({ ...a, i })).filter((a) => a.state === 'solved' && a.i !== info.index);
    if (!lit.length) return { error: 'no lit niche besides the current one' };
    const pick = lit[0];
    const n = niche(info.floor, pick.i);
    const p = world.toScreen({ x: n.object.x, y: floorStone(info.floor).topY + 0.5, z: n.object.z });
    return { x: p.x, y: p.y, i: pick.i, room: pick.room, index: info.index };
  });
  if (aim.error) return { ok: false, detail: aim.error };
  await page.touchscreen.tap(aim.x, aim.y);
  const moved = await poll(
    page,
    `h.current()?.base === 'room' || (h.screenInfo()?.index ?? ${aim.index}) !== ${aim.index}`,
    4000,
  );
  if (!moved) return { ok: false, detail: `tap on lit niche ${aim.i} (ruang ${aim.room}) at (${Math.round(aim.x)}, ${Math.round(aim.y)}) selected nothing` };
  const now = await page.evaluate(() => ({ base: window.hening.current()?.base, index: window.hening.screenInfo()?.index }));
  return { ok: true, detail: `tap on lit niche (ruang ${aim.room}) → ${now.base === 'room' ? 'the room opened' : `niche ${aim.index} → ${now.index}, its caption shows`}` };
}

/** Records: tap the floor III tab — the shown floor changes. */
async function touchRecords(page) {
  const before = await page.evaluate(() => [...document.querySelectorAll('.card-hint')].map((e) => e.textContent).find((t) => t.includes('lantai')) ?? '');
  const target = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.tabs .tab')];
    const t = tabs[2];
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!target) return { ok: false, detail: 'no third floor tab found' };
  await page.touchscreen.tap(target.x, target.y);
  const changed = await poll(
    page,
    `([...document.querySelectorAll('.card-hint')].map((e) => e.textContent).find((t) => t.includes('lantai')) || '').includes('lantai III')`,
    3000,
  );
  if (!changed) return { ok: false, detail: `tab tap did not switch the floor (was "${before}")` };
  return { ok: true, detail: `tab tap → "${before}" → "lantai III"` };
}

/** Kolam: drag the master slider's pebble — its value changes. */
async function touchKolam(page) {
  const before = await page.evaluate(() => window.hening.settings().volume.master);
  const bar = await page.evaluate(() => {
    const el = document.querySelector('.stone-bar');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  if (!bar) return { ok: false, detail: 'no .stone-bar found' };
  const targetFrac = before > 0.5 ? 0.2 : 0.8;
  const y = bar.y + bar.h / 2;
  const x0 = bar.x + before * bar.w;
  const x1 = bar.x + targetFrac * bar.w;
  const points = Array.from({ length: 7 }, (_, i) => ({ x: x0 + ((x1 - x0) * (i + 1)) / 7, y }));
  await touchDrag(page, [{ x: x0, y }, ...points]);
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => window.hening.settings().volume.master);
  if (after === before) return { ok: false, detail: `drag on the master slider changed nothing (still ${before})` };
  return { ok: true, detail: `pebble drag → master volume ${before} → ${after}` };
}

/** Editor: drag across three cells on an empty slot — three cells change. */
async function touchEditor(page) {
  await page.evaluate(() => {
    const h = window.hening;
    h.garden({ slots: Array.from({ length: 50 }, () => null) });
    return h.screen('garden-editor', { slot: 0 });
  });
  await page.waitForTimeout(1400);
  const cells = [];
  for (const c of [6, 7, 8]) cells.push(await cellPoint(page, 9, c));
  const vw = cells[0] ? await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight })) : null;
  if (cells.some((p) => p.x < 0 || p.y < 0 || p.x > vw.w || p.y > vw.h)) {
    return { ok: false, detail: `cells (9, 6-8) project off screen: ${JSON.stringify(cells)}` };
  }
  const points = [];
  for (let i = 0; i <= 8; i++) {
    points.push({ x: cells[0].x + ((cells[2].x - cells[0].x) * i) / 8, y: cells[0].y + ((cells[2].y - cells[0].y) * i) / 8 });
  }
  await touchDrag(page, points);
  await page.waitForTimeout(400);
  const rows = await page.evaluate(() => window.hening.screenInfo()?.rows ?? []);
  const painted = rows.join('\n').split('').filter((ch) => ch === '#').length;
  if (painted < 3) return { ok: false, detail: `drag across three cells painted ${painted} (rows: ${JSON.stringify(rows)})` };
  return { ok: true, detail: `drag across (9, 6-8) → ${painted} cells painted` };
}

const TOUCH = {
  room: touchRoom,
  courtyard: touchCourtyard,
  floor: touchFloor,
  records: touchRecords,
  kolam: touchKolam,
  editor: touchEditor,
};

// --- one screen visit -------------------------------------------------------------

async function visit(context, targetUrl, size, screen, room6Grid) {
  const page = await context.newPage();
  const errors = collectConsoleErrors(page);
  const cell = { failures: [], jostMin: null, touch: null };
  try {
    await page.goto(withParams(targetUrl, { qa: 1, seed: 7 }), { waitUntil: 'load', timeout: 30000 });
    if (!(await waitForHening(page))) {
      cell.failures.push({ check: 'boot', reason: 'window.hening never appeared' });
      return cell;
    }
    for (const body of screen.steps) {
      await page.evaluate(`(async () => { const h = window.hening; await (${body}); })()`).catch((e) => {
        cell.failures.push({ check: 'nav', reason: `${body.slice(0, 60)} → ${e.message}` });
      });
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(screen.wait);
    const data = await page.evaluate(runChecksInPage);
    // `--shots`: keep each cell's frame in .scratch/phone/ (the matrix's evidence, looked at by eye).
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, `${size.label.replace(/[^0-9a-z@]+/gi, '')}-${screen.id}.jpg`), type: 'jpeg', quality: 80 });
    }
    cell.jostMin = data.jostMin;
    cell.failures.push(...evaluateChecks(data, size, screen.id));
    if (screen.touch && !size.skipTouch) {
      try {
        cell.touch = screen.touch === 'room'
          ? await touchRoom(page, room6Grid)
          : await TOUCH[screen.touch](page);
      } catch (err) {
        cell.touch = { ok: false, detail: `touch test crashed: ${err && err.message ? err.message : err}` };
      }
    }
    if (errors.length) {
      cell.failures.push({ check: 'console', reason: errors.slice(0, 3).join(' | ') });
    }
  } catch (err) {
    cell.failures.push({ check: 'crash', reason: String(err && err.message ? err.message : err) });
  } finally {
    await page.close();
  }
  return cell;
}

// --- main ---------------------------------------------------------------------------

const flags = parseFlags(process.argv.slice(2));
const SHOTS = flags.shots ? path.join(GAME_DIR, '..', '.scratch', 'phone') : null;
const target = await resolveTarget(typeof flags.url === 'string' ? flags.url : undefined);
console.log(`phone-check: target = ${target.url}`);

// Room 6's layout, for the tap targets (the same JSON the game loads).
const roomsJson = JSON.parse(fs.readFileSync(path.join(GAME_DIR, 'src', 'data', 'rooms.generated.json'), 'utf8'));
const room6Def = roomsJson.rooms.find((r) => r.number === 6) ?? roomsJson.rooms[5];
const room6Grid = parseRoomRows(room6Def.rows);

const browser = await launchBrowser();
/** results[screenId][sizeId] = cell */
const results = {};

for (const size of SIZES) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.dpr,
    hasTouch: true,
    isMobile: true,
  });
  for (const screen of SCREENS) {
    if (size.roomOnly && screen.id !== 'room6') continue;
    const cell = await visit(context, target.url, size, screen, room6Grid);
    (results[screen.id] ??= {})[size.id] = cell;
    const mark = cell.failures.length ? `FAIL (${cell.failures.length})` : 'pass';
    const touch = cell.touch ? ` · touch ${cell.touch.ok ? 'ok' : 'FAIL'}` : '';
    console.log(`${size.label} · ${screen.id}: ${mark}${touch}`);
  }
  await context.close();
}

await browser.close();
await target.close();

// --- report ---------------------------------------------------------------------------

let anyFail = false;
const tabletNotes = [];
const lines = [];
lines.push('# Phone matrix — prompt 05 §3');
lines.push('');
lines.push(`Run: ${new Date().toISOString()} · target \`${target.url}\` · \`?qa=1&seed=7\` · contexts \`hasTouch\` + \`isMobile\` · tool: \`tools/phone-check.mjs\``);
lines.push('');
lines.push('Checks per cell: (1) the canvas fills the screen, (2) every visible text element is inside the screen, (3) nothing overlaps, (4) the smallest Jost line is ≥ 13 px (tablet: reported, not failed), (5) portrait room: HUD controls/hint bottom edge in the lower 30 %, (6) no browser gestures (touch-action, user-select, overscroll-behavior).');
lines.push('');
const header = ['Screen', ...SIZES.map((s) => s.label)];
lines.push(`| ${header.join(' | ')} |`);
lines.push(`|${header.map(() => '---').join('|')}|`);
for (const screen of SCREENS) {
  const cells = SIZES.map((size) => {
    const cell = results[screen.id]?.[size.id];
    if (!cell) return '—';
    if (size.tablet && cell.jostMin !== null) tabletNotes.push(`${screen.id}: ${cell.jostMin}px`);
    if (!cell.failures.length && (!cell.touch || cell.touch.ok)) return 'pass';
    const first = cell.failures[0];
    if (first) {
      const extra = cell.failures.length > 1 ? ` (+${cell.failures.length - 1})` : '';
      return `fail: ${first.check} ${first.reason.slice(0, 80)}${extra}`;
    }
    return `fail: touch — ${cell.touch.detail.slice(0, 80)}`;
  });
  lines.push(`| ${screen.id} | ${cells.join(' | ')} |`);
}
lines.push('');
lines.push('## Touch');
lines.push('');
for (const size of SIZES) {
  if (size.skipTouch) {
    lines.push(`- ${size.label}: skipped (same CSS size as 390 × 844 @2; DPR 3 run is the room render only)`);
    continue;
  }
  for (const screen of SCREENS) {
    const cell = results[screen.id]?.[size.id];
    if (!cell || !cell.touch) continue;
    const name = { room: 'room 6 tap-to-walk', courtyard: 'courtyard · Batu Catatan tap', floor: 'floor I · lit niche tap', records: 'records · floor tab tap', kolam: 'Kolam · slider drag', editor: 'editor · paint drag' }[screen.touch];
    lines.push(`- ${size.label} · ${name}: ${cell.touch.ok ? 'ok' : 'FAIL'} — ${cell.touch.detail}`);
    if (!cell.touch.ok) anyFail = true;
  }
}
lines.push('');
if (tabletNotes.length) {
  lines.push(`Tablet note (check 4 is reported, not failed, at 768 × 1024): smallest Jost line per screen — ${tabletNotes.join(', ')}.`);
  lines.push('');
}
lines.push('## Failures in full');
lines.push('');
let anyFailure = anyFail;
for (const screen of SCREENS) {
  for (const size of SIZES) {
    const cell = results[screen.id]?.[size.id];
    if (!cell || !cell.failures.length) continue;
    anyFailure = true;
    lines.push(`### ${screen.id} @ ${size.label}`);
    for (const f of cell.failures) lines.push(`- check ${f.check}: ${f.reason}`);
    lines.push('');
  }
}
if (!anyFailure) {
  lines.push('None — every cell and every touch test passed.');
  lines.push('');
}

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
console.log(`\nWritten to ${REPORT_PATH}`);
if (anyFailure) process.exitCode = 1;
