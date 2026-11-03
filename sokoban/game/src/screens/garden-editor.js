/**
 * @file Taman Sendiri — room editor (GAME-DESIGN §7.8, ART-DIRECTION §13.10).
 * Board up to 19 × 16, live validation, debounced plinth regeneration,
 * pop-in animations, undo, inner water features, and Coba hand-off.
 */

import * as THREE from 'three';
import { getSlot, updateSlot } from '../state/garden.js';
import { parseLevel, validateLevel } from '../core/level.js';
import { initRenderer } from '../render/renderer.js';
import { board, cellX, cellZ } from '../render/board.js';
import { view, fitCamera, rotateView as rotateCamera, screenToGrid } from '../render/camera.js';
import { applyMood, setMoodPosition } from '../render/moods.js';
import { buildIsland } from '../render/island.js';
import { createFx } from '../world/fx.js';
import { buildDecor, updateDecor } from '../world/decor/index.js';
import { sound } from '../audio/sound.js';
import { getTheme } from '../themes/index.js';
import { pastel, roles } from '../render/pastel.js';
import { Wanderer } from '../world/wanderer.js';
import { two } from '../world/tower-views.js';
import { el } from '../ui/veil.js';

const MAX_ROWS = 19;
const MAX_COLS = 16;

const TOOLS = [
  { id: 1, name: 'lantai', key: '1' },
  { id: 2, name: 'dinding', key: '2' },
  { id: 3, name: 'objek', key: '3' },
  { id: 4, name: 'target', key: '4' },
  { id: 5, name: 'awal', key: '5' },
  { id: 6, name: 'hapus', key: '6' },
];

// Ink glyphs for the palette, drawn in the same 1.4 px stroke as the HUD tools.
const TOOL_ICONS = {
  1: '<svg viewBox="0 0 24 24"><path d="M12 4.5 21 10 12 15.5 3 10 Z"/><path d="M5.5 13.5 12 17.5l6.5-4"/></svg>',
  2: '<svg viewBox="0 0 24 24"><path d="M12 3.5 20 8 12 12.5 4 8 Z"/><path d="M4 8v7l8 4.5v-7"/><path d="M20 8v7l-8 4.5"/></svg>',
  3: '<svg viewBox="0 0 24 24"><path d="M12 3.5 16 7H8 Z"/><path d="M9 7h6v6.5H9z"/><path d="M11 13.5h2V17h-2z"/><path d="M8.5 19.5h7"/></svg>',
  4: '<svg viewBox="0 0 24 24"><circle cx="12" cy="11" r="5.5"/><circle cx="12" cy="11" r="1.4" fill="currentColor" stroke="none"/><path d="M7 18.5h10"/></svg>',
  5: '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="2.4"/><path d="M12 9.5c-2.6 1.6-3.2 4.6-3.6 9.5h7.2c-.4-4.9-1-7.9-3.6-9.5z"/></svg>',
  6: '<svg viewBox="0 0 24 24"><path d="M5 15.5 13.5 7l5 5-8.5 8.5H5z"/><path d="M5 20.5h14"/></svg>',
};

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let ctx = null;
let currentSlot = 0;
let scene = null;
let fx = null;
let decor = null;
let gridMesh = null;
let hoverMesh = null;
let islandGroup = null;
let theme = null;

// Grid representation: 19 rows x 16 cols
// Values: null (empty), ' ' (floor), '#' (wall), '$' (object), '.' (target), '*' (object on target), '@' (start), '+' (start on target)
let grid = [];
let popMeshes = new Map(); // key "r,c" -> { root, dur, p, dir }

let cursor = { r: 9, c: 8 };
let currentTool = 2; // default: dinding
let history = []; // array of change sets
let currentDragChanges = null;
let isDragging = false;
let hoverTime = 0;

let saveTimeout = null;
let plinthTimeout = null;

let uiRoot = null;
let paletteButtons = [];
let rulesLineEl = null;

const easeOutBack = (x, c = 1.6) => 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);

function createEditorUi() {
  const root = el('div', 'garden-editor-ui');

  // Palette of glass buttons, ink glyphs, the selected one filled white
  const palette = el('div', 'editor-palette');
  paletteButtons = TOOLS.map((t) => {
    const btn = el('button', 'round editor-tool-btn');
    btn.innerHTML = TOOL_ICONS[t.id]; // our own constant glyphs, never user text
    btn.title = `${t.name} (${t.key})`;
    btn.setAttribute('aria-label', t.name);
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      setTool(t.id);
    });
    const lbl = el('span', 'tool-name', t.name);
    btn.appendChild(lbl);
    palette.appendChild(btn);
    return { id: t.id, btn };
  });

  // Rules line under the board
  rulesLineEl = el('div', 'editor-rules-line', 'siap dicoba');

  // Top info & actions
  const topBar = el('div', 'editor-top-bar');
  const slotTitle = el('div', 'editor-slot-title', `TAMAN ${two(currentSlot + 1)}`);
  const actions = el('div', 'editor-actions');
  const cobaBtn = el('button', 'glass-btn', 'coba');
  cobaBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    tryRunCoba();
  });
  const backBtn = el('button', 'glass-btn', 'selesai');
  backBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    exitToGarden();
  });
  actions.append(cobaBtn, backBtn);
  topBar.append(slotTitle, actions);

  root.append(palette, rulesLineEl, topBar);
  document.body.appendChild(root);
  uiRoot = root;

  updateToolSelection();
}

function setTool(toolId) {
  currentTool = toolId;
  updateToolSelection();
}

function updateToolSelection() {
  paletteButtons.forEach(({ id, btn }) => {
    btn.classList.toggle('selected', id === currentTool);
  });
}

// A 1 px grid on the floor plane, the editor's Siang ink at 12 % (§13.10).
function createGridLines() {
  const lineMat = new THREE.LineBasicMaterial({ color: '#3b4a52', transparent: true, opacity: 0.12 });
  const points = [];

  const minX = cellX(0) - 0.5;
  const maxX = cellX(MAX_COLS - 1) + 0.5;
  const minZ = cellZ(0) - 0.5;
  const maxZ = cellZ(MAX_ROWS - 1) + 0.5;

  for (let r = 0; r <= MAX_ROWS; r++) {
    const z = cellZ(r) - 0.5;
    points.push(new THREE.Vector3(minX, 0.002, z), new THREE.Vector3(maxX, 0.002, z));
  }
  for (let c = 0; c <= MAX_COLS; c++) {
    const x = cellX(c) - 0.5;
    points.push(new THREE.Vector3(x, 0.002, minZ), new THREE.Vector3(x, 0.002, maxZ));
  }

  const geom = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineSegments(geom, lineMat);
}

// The cursor: the lit hover tile of the rooms — the mood's glow, pulsing
// softly (ART-DIRECTION §10.9), never a flat white square.
function createHoverTile() {
  const hover = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.92),
    new THREE.MeshBasicMaterial({ color: '#ffc35e', transparent: true, opacity: 0.22, depthWrite: false }),
  );
  hover.rotation.x = -Math.PI / 2;
  hover.position.y = 0.008;
  return hover;
}

export function enter(c, params = {}) {
  ctx = c;
  currentSlot = params.slot ?? 0;
  theme = getTheme('lentera');

  const { renderer, camera } = initRenderer(ctx.canvas);
  board.rows = MAX_ROWS;
  board.cols = MAX_COLS;
  setMoodPosition(0.25, true); // Mood Siang

  scene = new THREE.Scene();
  fx = createFx(scene);

  gridMesh = createGridLines();
  scene.add(gridMesh);

  hoverMesh = createHoverTile();
  scene.add(hoverMesh);

  // Initialize empty grid
  grid = Array.from({ length: MAX_ROWS }, () => new Array(MAX_COLS).fill(null));
  popMeshes.clear();
  history = params.returnState?.history ?? [];

  // Load existing slot data
  const slotData = getSlot(currentSlot);
  if (slotData && slotData.rows && slotData.rows.length > 0) {
    loadRowsIntoGrid(slotData.rows);
  }

  if (params.returnState) {
    cursor = { ...params.returnState.cursor };
    currentTool = params.returnState.tool ?? 2;
    view.azimuth = params.returnState.cameraYaw ?? view.azimuth;
    view.targetAzimuth = view.azimuth;
  } else {
    cursor = paintedCentre() ?? { r: Math.floor(MAX_ROWS / 2), c: Math.floor(MAX_COLS / 2) };
  }

  framed = null;
  updateHoverPosition();

  createEditorUi();
  rebuildIsland();
  updateRulesLine();

  ctx.hud.setVisible({ title: false, tools: false, counters: false, hint: false });
  ctx.hud.setDupaVisible?.(false);
}

function loadRowsIntoGrid(rows) {
  const rOff = Math.max(0, Math.floor((MAX_ROWS - rows.length) / 2));
  const maxRowLen = Math.max(...rows.map((r) => r.length));
  const cOff = Math.max(0, Math.floor((MAX_COLS - maxRowLen) / 2));

  for (let r = 0; r < rows.length; r++) {
    const line = rows[r];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch && ch !== ' ') {
        const gr = r + rOff;
        const gc = c + cOff;
        if (gr < MAX_ROWS && gc < MAX_COLS) {
          grid[gr][gc] = ch;
        }
      }
    }
  }
}

/** The start tile stands the wanderer there, at rest, facing the camera. */
function createStartMarker() {
  const w = new Wanderer();
  w.shownYaw = w.yaw = view.azimuth ?? 0;
  w.root.rotation.y = w.yaw;
  return w.root;
}

// Temporary pop-in animation on placement (scale 0 → 1, easeOutBack 0.25 s)
// with a soft wooden tick; removing shrinks (0.15 s).
function spawnPopAnim(r, c, type, dir = 1) {
  const key = `${r},${c}`;
  const existing = popMeshes.get(key);
  if (existing) {
    scene.remove(existing.root);
    popMeshes.delete(key);
  }

  const group = new THREE.Group();
  group.position.set(cellX(c), 0, cellZ(r));

  if (type === '#') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.46, 1), pastel(null, { roleColor: roles.wall }));
    body.position.y = 0.17;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.08, 1.04), pastel(null, { roleColor: roles.cap }));
    cap.position.y = 0.44;
    group.add(body, cap);
  } else if (type === '$' || type === '*') {
    const obj = theme.createObject();
    obj.setLit(type === '*');
    group.add(obj.group);
  } else if (type === '.' || type === '+') {
    const tgt = theme.createTarget();
    group.add(tgt.group);
    if (type === '+') group.add(createStartMarker());
  } else if (type === '@') {
    group.add(createStartMarker());
  } else if (type === ' ') {
    const role = (r + c) % 2 === 0 ? roles.floorA : roles.floorB;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.96), pastel(null, { roleColor: role }));
    floor.position.y = -0.03;
    group.add(floor);
  }

  if (dir === 1) group.scale.set(0, 0, 0);
  scene.add(group);

  popMeshes.set(key, {
    root: group,
    dur: dir === 1 ? 0.25 : 0.15,
    p: 0,
    dir,
  });

  if (dir === 1) {
    sound.thump(180, 0.05);
  }
}

function applyToolToTile(r, c) {
  if (r < 0 || r >= MAX_ROWS || c < 0 || c >= MAX_COLS) return;
  const prev = grid[r][c];
  let next = prev;

  if (currentTool === 1) next = ' ';
  else if (currentTool === 2) next = '#';
  else if (currentTool === 3) next = (prev === '.' || prev === '+') ? '*' : '$';
  else if (currentTool === 4) next = prev === '$' ? '*' : (prev === '@' ? '+' : '.');
  else if (currentTool === 5) {
    clearExistingStart();
    next = (prev === '.' || prev === '*') ? '+' : '@';
  } else if (currentTool === 6) next = null;

  if (prev === next) return;

  grid[r][c] = next;
  if (currentDragChanges) {
    currentDragChanges.push({ r, c, prev, next });
  } else {
    history.push([{ r, c, prev, next }]);
  }

  if (next) {
    spawnPopAnim(r, c, next, 1);
  } else if (prev) {
    spawnPopAnim(r, c, prev, -1);
  }

  schedulePlinthRebuild();
  scheduleSave();
  updateRulesLine();
}

function clearExistingStart() {
  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < MAX_COLS; c++) {
      const val = grid[r][c];
      if (val === '@') {
        grid[r][c] = ' ';
        spawnPopAnim(r, c, ' ', 1);
        if (currentDragChanges) currentDragChanges.push({ r, c, prev: '@', next: ' ' });
      } else if (val === '+') {
        grid[r][c] = '.';
        spawnPopAnim(r, c, '.', 1);
        if (currentDragChanges) currentDragChanges.push({ r, c, prev: '+', next: '.' });
      }
    }
  }
}

function undoEdit() {
  if (!history.length) return;
  const changes = history.pop();
  for (const { r, c, prev } of changes) {
    grid[r][c] = prev;
    if (prev) {
      spawnPopAnim(r, c, prev, 1);
    } else {
      const entry = popMeshes.get(`${r},${c}`);
      if (entry) {
        scene.remove(entry.root);
        popMeshes.delete(`${r},${c}`);
      }
    }
  }
  schedulePlinthRebuild();
  scheduleSave();
  updateRulesLine();
}

function getTrimmedRows() {
  let minR = MAX_ROWS, maxR = -1, minC = MAX_COLS, maxC = -1;
  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < MAX_COLS; c++) {
      if (grid[r][c] != null) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  if (maxR === -1) return [];

  const rows = [];
  for (let r = minR; r <= maxR; r++) {
    let line = '';
    for (let c = minC; c <= maxC; c++) {
      line += grid[r][c] ?? ' ';
    }
    rows.push(line.trimEnd());
  }
  return rows;
}

// Rules line under the board, one at a time, in this order:
// 1. belum ada titik awal
// 2. titik awal belum dikelilingi dinding
// 3. jumlah objek dan target belum sama (with counts · 4 objek · 5 target)
// 4. belum ada objek
// None -> siap dicoba
export function validateGardenLevel(rows) {
  if (!rows || !rows.length) {
    return 'belum ada titik awal';
  }
  const level = parseLevel(rows);
  if (!level.start) {
    return 'belum ada titik awal';
  }
  if (!level.isEnclosed) {
    return 'titik awal belum dikelilingi dinding';
  }
  if (level.objects.length !== level.targets.length) {
    return `jumlah objek dan target belum sama · ${level.objects.length} objek · ${level.targets.length} target`;
  }
  if (level.objects.length === 0) {
    return 'belum ada objek';
  }
  return 'siap dicoba';
}

function updateRulesLine() {
  if (!rulesLineEl) return;
  const rows = getTrimmedRows();
  rulesLineEl.textContent = validateGardenLevel(rows);
}

function schedulePlinthRebuild() {
  if (plinthTimeout) clearTimeout(plinthTimeout);
  plinthTimeout = setTimeout(rebuildIsland, 200);
}

/**
 * Rebuilds the unified merged island: plinth tiers, outer walls, finials,
 * floor slabs, and inner wall water decor (ponds & basins by room rules).
 */
function rebuildIsland() {
  plinthTimeout = null;
  if (!scene) return;

  if (islandGroup) {
    scene.remove(islandGroup);
    islandGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
    });
    islandGroup = null;
    decor = null;
  }

  let minR = MAX_ROWS, maxR = -1, minC = MAX_COLS, maxC = -1;
  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < MAX_COLS; c++) {
      if (grid[r][c] != null) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  if (maxR === -1) return;

  const rows = [];
  for (let r = minR; r <= maxR; r++) {
    let line = '';
    for (let c = minC; c <= maxC; c++) {
      line += grid[r][c] ?? ' ';
    }
    rows.push(line.trimEnd());
  }

  try {
    const level = parseLevel(rows);

    // Any cell explicitly painted inside gets floor tiles
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        const val = grid[minR + r]?.[minC + c];
        if (val === ' ' || val === '.' || val === '$' || val === '*' || val === '@' || val === '+') {
          level.inside[r][c] = true;
        }
      }
    }

    const { group, plan } = buildIsland(level, { openings: [] });

    // Inner walls become ponds and basins by room rules (seeded by slot number)
    const rand = mulberry32(currentSlot + 1);
    decor = buildDecor(level, plan, group, { fx, rand });

    // Add theme targets and objects
    level.targets.forEach((t) => {
      const tgt = theme.createTarget();
      tgt.group.position.set(cellX(t.c), 0, cellZ(t.r));
      group.add(tgt.group);
    });

    level.objects.forEach((o) => {
      const isLit = level.targets.some((t) => t.r === o.r && t.c === o.c);
      const obj = theme.createObject();
      obj.group.position.set(cellX(o.c), 0, cellZ(o.r));
      obj.setLit(isLit);
      group.add(obj.group);
    });

    // Start wanderer marker
    if (level.start) {
      const startW = createStartMarker();
      startW.position.set(cellX(level.start.c), 0, cellZ(level.start.r));
      group.add(startW);
    }

    islandGroup = group;
    islandGroup.position.set(minC, 0, minR);
    scene.add(islandGroup);
  } catch (err) {
    console.warn('rebuildIsland error', err);
  }
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveSlotNow, 500);
}

function saveSlotNow() {
  saveTimeout = null;
  const rows = getTrimmedRows();
  const existing = getSlot(currentSlot);
  updateSlot(currentSlot, {
    rows,
    tested: existing?.tested ?? false,
    record: existing?.record ?? null,
  });
}

function tryRunCoba() {
  saveSlotNow();
  const rows = getTrimmedRows();
  if (!rows.length) return;
  const level = parseLevel(rows);
  if (!level.start || !level.isEnclosed || level.objects.length === 0 || level.objects.length !== level.targets.length) {
    return;
  }
  ctx.router.goto('room', {
    garden: true,
    coba: true,
    slot: currentSlot,
    rows,
    returnState: {
      cursor: { ...cursor },
      tool: currentTool,
      cameraYaw: view.azimuth,
      history,
    },
  });
}

function exitToGarden() {
  saveSlotNow();
  ctx.router.goto('garden', { selectedSlot: currentSlot });
}

function updateHoverPosition() {
  if (hoverMesh) {
    hoverMesh.position.x = cellX(cursor.c);
    hoverMesh.position.z = cellZ(cursor.r);
  }
  frameWork();
}

/** The middle of the painted cells, or null on an empty slot. */
function paintedCentre() {
  let r0 = Infinity, r1 = -1, c0 = Infinity, c1 = -1;
  for (let r = 0; r < MAX_ROWS; r += 1) {
    for (let c = 0; c < MAX_COLS; c += 1) {
      if (grid[r]?.[c] == null) continue;
      r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
    }
  }
  return r1 < 0 ? null : { r: Math.round((r0 + r1) / 2), c: Math.round((c0 + c1) / 2) };
}

// The camera frames the work, not the whole 19 x 16 ground: the painted
// cells and the cursor with two cells of room around them (at least
// 10 x 8), so a small garden reads as large as a room does. The frame only
// grows during a visit — it never jumps inward while the player paints.
let framed = null;

function frameWork() {
  let r0 = cursor.r, r1 = cursor.r, c0 = cursor.c, c1 = cursor.c;
  for (let r = 0; r < MAX_ROWS; r += 1) {
    for (let c = 0; c < MAX_COLS; c += 1) {
      if (grid[r]?.[c] == null) continue;
      r0 = Math.min(r0, r); r1 = Math.max(r1, r);
      c0 = Math.min(c0, c); c1 = Math.max(c1, c);
    }
  }
  const narrow = window.innerWidth < 720; // a phone held upright has no width to spare
  const pad = narrow ? 1 : 2;
  r0 -= pad; r1 += pad; c0 -= pad; c1 += pad;
  if (framed) {
    r0 = Math.min(r0, framed.r0); r1 = Math.max(r1, framed.r1);
    c0 = Math.min(c0, framed.c0); c1 = Math.max(c1, framed.c1);
  }
  const grow = (lo, hi, min, max) => {
    while (hi - lo + 1 < min) { lo -= 0.5; hi += 0.5; }
    return [Math.max(lo, 0), Math.min(hi, max - 1)];
  };
  [r0, r1] = grow(r0, r1, narrow ? 6 : 8, MAX_ROWS);
  [c0, c1] = grow(c0, c1, narrow ? 7 : 10, MAX_COLS);
  if (framed && framed.r0 === r0 && framed.r1 === r1 && framed.c0 === c0 && framed.c1 === c1) return;
  framed = { r0, r1, c0, c1 };
  // Seen at 45 degrees a w x d patch is about (w + d) wide on screen, so the
  // zoom is the ratio of those sums: the whole ground over the framed part.
  view.zoom = Math.max(1, (MAX_ROWS + MAX_COLS) / (r1 - r0 + 1 + c1 - c0 + 1));
  view.target.set(cellX((c0 + c1) / 2), 0, cellZ((r0 + r1) / 2));
  fitCamera();
}

export function exit() {
  framed = null;
  view.zoom = 1;
  view.target.set(0, 0, 0);
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveSlotNow();
  }
  if (plinthTimeout) clearTimeout(plinthTimeout);
  uiRoot?.remove();
  uiRoot = null;
  scene = null;
  fx = null;
  decor = null;
  gridMesh = null;
  hoverMesh = null;
  islandGroup = null;
  popMeshes.clear();
  ctx = null;
}

export function inspect() {
  return {
    slot: currentSlot,
    cursor: { ...cursor },
    tool: currentTool,
    rulesLine: rulesLineEl?.textContent ?? '',
    rows: getTrimmedRows(),
  };
}

export function resize() {
  fitCamera();
}

export function update(dt, t = 0) {
  if (!scene) return;
  applyMood(dt);

  // The cursor tile breathes like the hover tile in the rooms (§10.9).
  hoverTime += dt;
  if (hoverMesh) {
    hoverMesh.material.opacity = 0.22 + 0.05 * Math.sin(3 * hoverTime);
  }

  // Animate pop-in / shrink
  for (const [key, entry] of popMeshes.entries()) {
    entry.p += dt / entry.dur;
    if (entry.p >= 1) {
      scene.remove(entry.root);
      popMeshes.delete(key);
    } else {
      const s = entry.dir === 1 ? easeOutBack(entry.p, 1.6) : (1 - entry.p);
      entry.root.scale.set(s, s, s);
    }
  }

  // Update decor (pond ripples, koi swimming, basin drips)
  if (decor) {
    updateDecor(decor, dt, t, hoverMesh ? hoverMesh.position : new THREE.Vector3());
  }

  const { renderer, camera } = initRenderer(ctx.canvas);
  renderer.render(scene, camera);
}

export const input = {
  onDirection(screenDir) {
    const [dr, dc] = screenToGrid(screenDir);
    cursor.r = Math.max(0, Math.min(MAX_ROWS - 1, cursor.r + dr));
    cursor.c = Math.max(0, Math.min(MAX_COLS - 1, cursor.c + dc));
    updateHoverPosition();
  },
  onConfirm() {
    tryRunCoba();
  },
  onBack() {
    exitToGarden();
  },
  onDigit(n) {
    if (n >= 1 && n <= 6) setTool(n);
  },
  onUndo() {
    undoEdit();
  },
  onRotate(delta) {
    rotateCamera(delta);
  },
  onAnyKey(code) {
    if (code === 'Space') {
      applyToolToTile(cursor.r, cursor.c);
    }
  },
  onPointerDown(x, y) {
    const cell = cellUnderPointer(x, y);
    if (cell) {
      cursor.r = cell.r;
      cursor.c = cell.c;
      updateHoverPosition();
      isDragging = true;
      currentDragChanges = [];
      applyToolToTile(cell.r, cell.c);
    }
  },
  onPointerMove(x, y) {
    if (!isDragging) return;
    const cell = cellUnderPointer(x, y);
    if (cell && (cell.r !== cursor.r || cell.c !== cursor.c)) {
      cursor.r = cell.r;
      cursor.c = cell.c;
      updateHoverPosition();
      if (currentTool === 1 || currentTool === 2 || currentTool === 6) {
        applyToolToTile(cell.r, cell.c);
      }
    }
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('pointerup', () => {
    if (isDragging) {
      isDragging = false;
      if (currentDragChanges && currentDragChanges.length) {
        history.push(currentDragChanges);
      }
      currentDragChanges = null;
    }
  });
}

function cellUnderPointer(screenX, screenY) {
  const { camera } = initRenderer(ctx.canvas);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(
    (screenX / window.innerWidth) * 2 - 1,
    -(screenY / window.innerHeight) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(plane, target)) {
    const c = Math.round(target.x + board.cols / 2 - 0.5);
    const r = Math.round(target.z + board.rows / 2 - 0.5);
    if (r >= 0 && r < MAX_ROWS && c >= 0 && c < MAX_COLS) {
      return { r, c };
    }
  }
  return null;
}
