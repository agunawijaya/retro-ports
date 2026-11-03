/**
 * @file The room screen: arrival, play, departure, results.
 *
 * Ported from `reference/index.html` sections 14 (game state and rules),
 * 15 (input actions — the key/pointer *effects*, not the DOM wiring, which
 * lives in `ui/input.js`), 17 (the parts of the main loop that are not
 * drawing) and 18 (the parts of `window.hening` that belong to a running
 * room). `core/game.js` already owns move/undo/restart/solved, so this file
 * is thinner than the reference: it turns `MoveResult`s into animation,
 * sound and effects, and runs the scripted arrival/departure walks.
 *
 * Module-level state plays the role of the reference's single global
 * `game` object — there is exactly one room on screen at a time.
 */

import * as THREE from 'three';
import { parseLevel, DIR_NAMES } from '../core/level.js';
import { createGame } from '../core/game.js';
import { findPath } from '../core/path.js';
import { rooms, solutions } from '../data/rooms.js';
import { mulberry32, lerp, smooth, easeInOutSine, clamp } from '../render/math.js';
import { cellX, cellZ } from '../render/board.js';
import { view, screenToGrid, rotateView as rotateCamera, fitCamera } from '../render/camera.js';
import { setMoodPosition, setMood as snapMoodIndex } from '../render/moods.js';
import { sound } from '../audio/sound.js';
import { getTheme, notesFor } from '../themes/index.js';
import { createRoomWorld } from '../world/room-world.js';
import { disposeTowerWorld } from '../world/tower-world.js';
import { LOOK_AFTER, MEDITATE_AFTER } from '../world/wanderer.js';
import { getSettings } from '../state/settings.js';
import { getProgress, recordSolve, openRoom, isFloorLit, markFloorLit, saveProgress } from '../state/progress.js';
import { getSessionMode, setSessionMode } from '../state/mode.js';
import { getGarden, updateSlot, recordGardenSolve } from '../state/garden.js';
import { openHelper, isHelperActive, update as updateHelper } from '../dev/solution-view.js';
import { el, createCard, createChoices } from '../ui/veil.js';
import { two } from '../world/tower-views.js';

// Tile travel times, in seconds (reference §14).
const DURATION = { walk: 0.24, run: 0.15, push: 0.42, rewind: 0.2 };

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

// --- module state (one room on screen at a time) --------------------------

let canvas = null;
let hud = null;
let router = null;

/** Set by `setPaused(true)` from the pause overlay; every input handler below ignores input while it's on. */
let paused = false;

let roomNumber = 1;
let themeId = 'lentera';
let level = null;
let game = null;
let roomMode = 'bebas';
let dupaTotalMs = 20 * 60 * 1000;
let dupaRemainingMs = 20 * 60 * 1000;
let dupaRunning = false;
let timeoutCard = null;
let timeoutChoices = null;
let isAssistedAttempt = false;
let gardenParams = null;
let world = null;
let wanderer = null;
let theme = null;
let notes = [];

/** One buffered input: a direction step, or `{ undo: true }`. */
let queue = [];

/** Scripted walk queue for arrival/departure (reference `game.script`). */
let script = [];
let scriptWait = 0;

/** 'arriving' | 'playing' | 'departing' | 'results' — for `inspect()` and the HUD. */
let phase = 'playing';
let arrival = { reachedStart: true, teleported: false };

/** The wanderer's visual cell during a script, when it differs from the logical player. */
let actor = { r: 0, c: 0 };

let lastBlocked = -10;
let stepCounter = 0;
let clockTime = 0;
let introPending = false;

/** Treadmill demo state for `play()` (reference §16/17 `demoState`). */
let demoState = { kind: null, p: 0, step: 0 };

let freezeOn = false;
let freezeT = 0;

/** Bumped on every room load/exit so stale `setTimeout` callbacks no-op. */
let generation = 0;

// --- small helpers ----------------------------------------------------------

function findObjectIndexAt(r, c) {
  return game.state.objects.findIndex((o) => o.r === r && o.c === c);
}

function isTargetAt(r, c) {
  return level.targets.some((t) => t.r === r && t.c === c);
}

function coveredFlags() {
  return level.targets.map((t) => findObjectIndexAt(t.r, t.c) !== -1);
}

function noteFor(targetIndex) {
  return notes[targetIndex % notes.length];
}

function cellsFromDirs(start, dirNames) {
  let cur = { ...start };
  return dirNames.map((name) => {
    const [dr, dc] = DIR_NAMES[name];
    cur = { r: cur.r + dr, c: cur.c + dc };
    return { ...cur };
  });
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function toRoman(n) {
  if (n >= 1 && n <= ROMAN.length) return ROMAN[n - 1];
  return String(n); // fallback past the numerals the tower is expected to need
}

function countLit() {
  return coveredFlags().filter(Boolean).length;
}

function recomputeSolved() {
  const objs = game.state.objects;
  if (objs.length === 0 || objs.length !== level.targets.length) return false;
  return objs.every((o) => isTargetAt(o.r, o.c));
}

function updateHud() {
  if (!hud) return;
  if (gardenParams) {
    hud.setPlace(`TAMAN ${two(gardenParams.slot + 1)}`);
  } else {
    const place = ((roomNumber - 1) % 10) + 1;
    const floor = Math.ceil(roomNumber / 10);
    hud.setPlace(`Lantai ${toRoman(floor)} · Ruang ${String(roomNumber).padStart(2, '0')}`);
  }
  hud.setCounters({
    steps: game.state.steps,
    pushes: game.state.pushes,
    lit: countLit(),
    total: level.targets.length,
    label: theme.counterLabel,
  });
}

function findRoomData(number) {
  return rooms.find((r) => r.number === number) ?? rooms[0];
}

// --- loading a room ---------------------------------------------------------

/**
 * Loads a room's data, world and game state. Used by `enter()` and by the
 * QA hooks (`room(n)`, `level(i)`, `setTheme`) to switch rooms in place.
 * @param {number} number Room number (1-based)
 * @param {{ seed?: number, mood?: number, intro?: boolean }} [opts]
 */
function loadRoom(number, { seed, mood, intro = true, rows } = {}) {
  generation += 1;
  if (world) world.dispose();

  roomNumber = number;
  if (gardenParams) {
    level = parseLevel(rows ?? gardenParams.rows);
  } else {
    const data = findRoomData(number);
    level = parseLevel(data.rows);
  }
  game = createGame(level);
  theme = getTheme(themeId);
  notes = notesFor(theme);

  const seedValue = seed ?? number;
  world = createRoomWorld({ canvas, level, theme, rand: mulberry32(seedValue) });
  wanderer = world.wanderer;

  queue = [];
  script = [];
  scriptWait = 0;
  introPending = false;
  lastBlocked = -10;
  stepCounter = 0;
  demoState = { kind: null, p: 0, step: 0 };
  arrival = { reachedStart: true, teleported: false };
  paused = false;

  const place = ((number - 1) % 10) + 1;
  const moodPosition = mood != null ? mood : (place - 1) / 3;
  setMoodPosition(moodPosition, true);

  const gate = gardenParams ? null : world.decor?.gate;
  if (intro && gate) {
    stageIntro(gate);
    if (sound.ctx) beginIntro(gate);
    else introPending = true;
  } else {
    phase = 'playing';
    actor = { ...game.state.player };
    if (roomMode === 'dupa') dupaRunning = true;
  }

  updateHud();
  wireHudTools();
}

function wireHudTools() {
  if (!hud) return;
  hud.onTool('undo', () => undo());
  hud.onTool('restart', () => restart());
  hud.onTool('rotate', () => rotateCamera(1));
  hud.onTool('sound', () => {
    const on = sound.toggle();
    hud.setSoundOn(on);
  });
}

// --- moves --------------------------------------------------------------

/**
 * Attempts one grid step. Mirrors the reference's `tryStep` + `startMove`,
 * but the rule outcome comes from `core/game.js#move` instead of being
 * recomputed here.
 * @param {number[]} dir [dr, dc]
 * @param {'walk'|'run'} [kind]
 * @returns {boolean} whether a step started
 */
function tryStep(dir, kind = 'walk') {
  if (game.state.solved || wanderer.move) return false;
  const [dr, dc] = dir;
  wanderer.faceDir(dr, dc);
  wanderer.cancelAction();

  const result = game.move(dir);

  if (result.kind === 'blocked-wall') {
    wanderer.perform('bump');
    sound.thump(110, 0.05);
    return false;
  }

  if (result.kind === 'blocked-object') {
    const recent = clockTime - lastBlocked < 3.5;
    lastBlocked = clockTime;
    if (recent) {
      wanderer.perform('shrug');
    } else {
      wanderer.perform('protest');
      world.decor?.stranger?.notice('protest');
      sound.thump(70, 0.08, 0.15);
      sound.thump(70, 0.08, 0.5);
      sound.hmph(1.32);
      const token = generation;
      setTimeout(() => {
        if (token !== generation) return;
        if (wanderer.action === 'protest') {
          world.fx.puff(wanderer.root.position.clone().add(new THREE.Vector3(0, 1.05, 0)));
        }
      }, 1350);
    }
    return false;
  }

  startStep(result, kind);
  return true;
}

function startStep(result, kind) {
  const [dr, dc] = DIR_NAMES[result.dir];
  const move = {
    kind: result.kind === 'push' ? 'push' : kind,
    p: 0,
    from: result.from,
    to: result.to,
    dirDelta: [dr, dc],
    stepIndex: stepCounter++,
  };
  if (result.kind === 'push') {
    move.objectIndex = result.objectIndex;
    move.objectFrom = result.objectFrom;
    move.objectTo = result.objectTo;
    move.lit = result.lit;
    move.unlit = result.unlit;
    theme.pushSound(sound);
  } else {
    sound.step();
  }
  wanderer.move = move;
  updateHud();
}

function finishMove(m) {
  wanderer.move = null;
  if (m.objectIndex == null) return;
  const obj = world.objects[m.objectIndex];
  const [dr, dc] = m.dirDelta;
  obj.nudge(dc, dr, -2.2);
  if (m.unlit != null) {
    obj.setLit(false);
    sound.unchime(noteFor(m.unlit));
  }
  if (m.lit != null) {
    obj.setLit(true);
    sound.chime(noteFor(m.lit));
    world.fx.ripple(cellX(m.objectTo.c), cellZ(m.objectTo.r), world.glowHex(), 2.2, 1.1);
    for (let i = 0; i < 10; i++) {
      world.fx.mote(
        cellX(m.objectTo.c) + (Math.random() - 0.5) * 0.4,
        0.5,
        cellZ(m.objectTo.r) + (Math.random() - 0.5) * 0.4,
      );
    }
  }
  updateHud();
  if (game.state.solved) win();
}

// --- undo / restart -----------------------------------------------------

export function undo() {
  if (paused) return;
  if (phase === 'arriving' || phase === 'departing') return;
  if (wanderer.move && !wanderer.move.demo) {
    queue = [{ undo: true }];
    return;
  }
  const result = game.undo();
  if (!result) return;

  if (result.kind === 'undo-restart') {
    // Snap back: the restart itself was an instant snap, so undoing it is too.
    wanderer.move = null;
    wanderer.root.position.set(cellX(game.state.player.c), 0, cellZ(game.state.player.r));
    game.level.objects.forEach(() => {}); // no-op: keeps intent explicit that objects come from state, not level
    game.state.objects.forEach((o, i) => {
      const themeObj = world.objects[i];
      themeObj.group.position.set(cellX(o.c), 0, cellZ(o.r));
      themeObj.setLit(isTargetAt(o.r, o.c));
    });
    actor = { ...game.state.player };
    sound.rewind();
    world.fx.ripple(wanderer.root.position.x, wanderer.root.position.z, '#ffffff', 1.2, 0.5);
    updateHud();
    return;
  }

  const last = result.move;
  const from = { ...last.to };
  const rewound = [];
  if (last.kind === 'push') {
    rewound.push({ objIndex: last.objectIndex, from: last.objectTo, to: last.objectFrom });
    if (last.lit != null) sound.unchime(noteFor(last.lit));
    if (last.unlit != null) sound.chime(noteFor(last.unlit), 0, 0.08);
  }

  wanderer.cancelAction();
  wanderer.move = { kind: 'rewind', p: 0, from, to: { ...last.from }, rewound, stepIndex: 0 };
  actor = { ...game.state.player };
  queue = [];
  sound.rewind();
  world.fx.ripple(cellX(from.c), cellZ(from.r), '#ffffff', 1.2, 0.5);
  updateHud();
}

export function restart() {
  if (paused) return;
  if (phase === 'arriving' || phase === 'departing') return;
  if (timeoutCard) {
    timeoutCard.dispose();
    timeoutCard = null;
    timeoutChoices = null;
  }
  queue = [];
  if (hud) hud.hideResults();
  game.restart();
  wanderer.move = null;
  wanderer.cancelAction();
  wanderer.root.position.set(cellX(game.state.player.c), 0, cellZ(game.state.player.r));
  game.state.objects.forEach((o, i) => {
    const themeObj = world.objects[i];
    themeObj.group.position.set(cellX(o.c), 0, cellZ(o.r));
    themeObj.setLit(isTargetAt(o.r, o.c));
  });
  actor = { ...game.state.player };
  phase = 'playing';
  world.fx.ripple(wanderer.root.position.x, wanderer.root.position.z, '#ffffff', 3, 0.9);
  updateHud();

  if (roomMode === 'dupa') {
    dupaRemainingMs = dupaTotalMs;
    dupaRunning = true;
    hud?.setDupaTime?.(dupaRemainingMs, dupaTotalMs);
  }
}

/**
 * Called from the results overlay: restarts the room without the arrival
 * (same shape as `restart()`), and brings the wanderer back to full
 * opacity — the departure may have faded it out walking through the gate.
 */
export function replay() {
  if (timeoutCard) {
    timeoutCard.dispose();
    timeoutCard = null;
    timeoutChoices = null;
  }
  queue = [];
  script = [];
  scriptWait = 0;
  game.restart();
  wanderer.move = null;
  wanderer.cancelAction();
  wanderer.setOpacity(1);
  wanderer.fadeTo = 1;
  wanderer.root.position.set(cellX(game.state.player.c), 0, cellZ(game.state.player.r));
  game.state.objects.forEach((o, i) => {
    const themeObj = world.objects[i];
    themeObj.group.position.set(cellX(o.c), 0, cellZ(o.r));
    themeObj.setLit(isTargetAt(o.r, o.c));
  });
  actor = { ...game.state.player };
  phase = 'playing';
  world.fx.ripple(wanderer.root.position.x, wanderer.root.position.z, '#ffffff', 3, 0.9);
  updateHud();

  if (roomMode === 'dupa') {
    dupaRemainingMs = dupaTotalMs;
    dupaRunning = true;
    hud?.setDupaTime?.(dupaRemainingMs, dupaTotalMs);
  }
}

/**
 * While `on`, every input handler above ignores input and the wanderer
 * settles into its meditation pose (`idle = MEDITATE_AFTER + 1.2`, past the
 * 1.2 s blend the pose takes to fully settle); turning it off resets `idle`
 * so the wanderer doesn't appear to have been standing still the whole time.
 */
export function setPaused(on) {
  paused = !!on;
  if (!wanderer) return;
  wanderer.idle = paused ? MEDITATE_AFTER + 1.2 : 0;
}

export function currentRoom() {
  return roomNumber;
}

// --- win / departure -----------------------------------------------------

function win() {
  dupaRunning = false;
  const elapsedMs = Math.max(0, dupaTotalMs - dupaRemainingMs);

  let isRecord = false;
  let newlyLitFloor = null;

  if (gardenParams) {
    if (gardenParams.coba) {
      const g = getGarden();
      if (g.slots[gardenParams.slot]) {
        g.slots[gardenParams.slot].tested = true;
        updateSlot(gardenParams.slot, g.slots[gardenParams.slot]);
      }
    } else if (gardenParams.main) {
      recordGardenSolve(gardenParams.slot, { steps: game.state.steps, pushes: game.state.pushes });
    }
  } else {
    const floorNumber = Math.ceil(roomNumber / 10);
    const p = getProgress();
    const steps = game.state.steps;
    const pushes = game.state.pushes;

    if (isAssistedAttempt) {
      if (!p.assisted) p.assisted = [];
      if (!p.assisted.includes(roomNumber)) p.assisted.push(roomNumber);
      openRoom(p, roomNumber);
      saveProgress();
      isRecord = false;
    } else {
      if (roomMode === 'dupa') {
        const prevDupa = p.solved[String(roomNumber)]?.dupa;
        const prev = prevDupa ? { ...prevDupa } : undefined;
        recordSolve(p, roomNumber, 'dupa', { steps, pushes, timeMs: elapsedMs });
        isRecord = !!prev && (steps < prev.steps || pushes < prev.pushes || elapsedMs < prev.timeMs);
      } else {
        const prevBebas = p.solved[String(roomNumber)]?.bebas;
        const prev = prevBebas ? { ...prevBebas } : undefined;
        recordSolve(p, roomNumber, 'bebas', { steps, pushes });
        isRecord = !!prev && (steps < prev.steps || pushes < prev.pushes);
      }
      openRoom(p, roomNumber);
      if (isFloorLit(p, floorNumber) && !p.floorsLit.includes(floorNumber)) {
        markFloorLit(p, floorNumber);
        newlyLitFloor = floorNumber;
      }
      p.lastRoom = roomNumber;
      if (roomNumber === 50) p.ending = true;
      saveProgress();
    }
  }

  phase = 'departing';
  queue = [];
  const token = generation;
  setTimeout(() => {
    if (token !== generation) return;
    wanderer.perform('bow');
    world.decor?.stranger?.notice('won');
    sound.finale(level.targets.map((_, i) => noteFor(i)));
    world.fx.petalShower(Math.max(level.rows, level.cols) + 4);
    for (const obj of world.objects) {
      for (let i = 0; i < 6; i++) {
        world.fx.mote(obj.group.position.x, 0.5, obj.group.position.z);
      }
    }
  }, 650);

  const resultsInfo = { isRecord, newlyLitFloor, elapsedMs };
  const exit = gardenParams ? null : buildExitScript();
  if (exit) {
    script = [{ wait: 2.95 }, ...exit, { fn: () => showResults(resultsInfo) }];
  } else {
    setTimeout(() => {
      if (token !== generation) return;
      showResults(resultsInfo);
    }, 2300);
  }
}

function showResults({ isRecord, newlyLitFloor, elapsedMs }) {
  phase = 'results';
  const payload = {
    room: roomNumber,
    steps: game.state.steps,
    pushes: game.state.pushes,
    isRecord,
    newlyLitFloor,
    solvedLine: theme.solvedLine,
  };
  if (roomMode === 'dupa') {
    payload.mode = 'dupa';
    payload.timeMs = elapsedMs;
  }
  if (gardenParams) {
    payload.garden = true;
    if (gardenParams.coba != null) payload.coba = gardenParams.coba;
    if (gardenParams.slot != null) payload.slot = gardenParams.slot;
  }
  router?.open('results', payload);
}

function buildExitScript() {
  const gate = world.decor?.gate;
  if (!gate) return null;
  const inner = gate.inner;
  const atInner = game.state.player.r === inner.r && game.state.player.c === inner.c;
  const toInnerDirs = atInner ? [] : findPath(game, inner);
  if (!atInner && !toInnerDirs) return null;
  const toInnerCells = cellsFromDirs(game.state.player, toInnerDirs ?? []);

  const out = [];
  for (let k = 2; k <= gate.stones; k++) {
    if (k === gate.stones) out.push({ fn: () => { wanderer.fadeTo = 0; } });
    out.push({ cell: gate.cell(k) });
  }
  return [
    { fn: () => gate.open() },
    { wait: 0.55 },
    ...toInnerCells.map((cell) => ({ cell })),
    { cell: gate.cell(0) },
    { cell: gate.cell(1) },
    { fn: () => gate.close() },
    ...out,
    { wait: 0.7 },
  ];
}

// --- arrival ---------------------------------------------------------------

function stageIntro(gate) {
  const far = gate.cell(gate.stones);
  phase = 'arriving';
  actor = far;
  gate.snap(false);
  wanderer.root.position.set(cellX(far.c), 0, cellZ(far.r));
  wanderer.faceDir(-gate.dir[0], -gate.dir[1]);
  wanderer.shownYaw = wanderer.yaw;
  wanderer.setOpacity(0);
  wanderer.fadeTo = 0;
}

function beginIntro(gate) {
  introPending = false;
  const stones = [];
  for (let k = gate.stones - 1; k >= 1; k--) stones.push({ cell: gate.cell(k) });

  const inner = gate.inner;
  const atInner = inner.r === game.state.player.r && inner.c === game.state.player.c;
  let insideCells = [];
  let reachedStart = true;
  let teleported = false;
  if (!atInner) {
    // findPath always starts from the current player; the player is already
    // at the room's start, so this gives the path *from* the start *to* the
    // gate's inner cell. Reversed, it is the walk-in path we need.
    const dirsFromStart = findPath(game, inner);
    if (dirsFromStart) {
      const reversedDirs = [...dirsFromStart].reverse().map((d) => OPPOSITE[d]);
      insideCells = cellsFromDirs(inner, reversedDirs);
    } else {
      reachedStart = false;
      teleported = true;
    }
  }

  script = [
    { fn: () => { wanderer.fadeTo = 1; } },
    { wait: 0.8 },
    ...stones,
    { fn: () => gate.open() },
    { wait: 0.6 },
    { cell: gate.cell(0) },
    { cell: inner },
    ...insideCells.map((cell) => ({ cell })),
    { fn: () => { gate.close(); endScript(); } },
  ];
  arrival = { reachedStart, teleported };
}

export function skipIntro() {
  if (phase !== 'arriving') return;
  script = [];
  scriptWait = 0;
  wanderer.move = null;
  wanderer.setOpacity(1);
  wanderer.fadeTo = 1;
  world.decor?.gate?.snap(false);
  endScript();
}

function endScript() {
  phase = 'playing';
  actor = { ...game.state.player };
  wanderer.root.position.set(cellX(game.state.player.c), 0, cellZ(game.state.player.r));
  if (roomMode === 'dupa') {
    dupaRunning = true;
  }
}

function runScript() {
  while (script.length) {
    const item = script.shift();
    if (item.fn) {
      item.fn();
      continue;
    }
    if (item.wait) {
      scriptWait = item.wait;
      return;
    }
    if (item.cell) {
      stroll(item.cell);
      return;
    }
  }
}

function stroll(cell) {
  const from = { ...actor };
  wanderer.faceDir(cell.r - from.r, cell.c - from.c);
  wanderer.cancelAction();
  wanderer.move = { kind: 'walk', p: 0, from, to: { ...cell }, scripted: true, dur: 0.36, stepIndex: stepCounter++ };
  actor = { ...cell };
  sound.step();
}

// --- tap to walk -------------------------------------------------------

function pathCellsToward(cell) {
  const dirs = findPath(game, cell);
  if (!dirs || !dirs.length) return null;
  return dirs;
}

// --- public: screen lifecycle (ARCHITECTURE §7.3) --------------------------

/**
 * @param {{ canvas: HTMLCanvasElement, hud: object, router: object, sound: object }} ctx
 * @param {{ room?: number, seed?: number, mood?: number }} params
 */
export function enter(ctx, params = {}) {
  canvas = ctx.canvas;
  hud = ctx.hud;
  router = ctx.router;
  disposeTowerWorld(); // the tower scene behind the title/courtyard/elevator/floor/ending screens is about to be hidden
  themeId = getSettings().theme;

  gardenParams = params.garden ? params : null;
  roomMode = gardenParams ? 'bebas' : (params.mode ?? getSessionMode());
  dupaTotalMs = (getSettings().dupaMinutes ?? 20) * 60 * 1000;
  dupaRemainingMs = dupaTotalMs;
  dupaRunning = false;
  isAssistedAttempt = false;

  if (roomMode === 'dupa') {
    hud?.setDupaVisible?.(true);
    hud?.setDupaTime?.(dupaRemainingMs, dupaTotalMs);
  } else {
    hud?.setDupaVisible?.(false);
  }

  hud.setVisible({ title: true, tools: true, counters: true, hint: getSettings().hints });
  loadRoom(params.room ?? 1, { seed: params.seed, mood: params.mood, intro: !gardenParams });
}

export function exit() {
  generation += 1;
  timeoutCard?.dispose();
  timeoutCard = null;
  timeoutChoices = null;
  dupaRunning = false;
  world?.dispose();
  world = null;
  wanderer = null;
}

export function resize() {
  world?.resize();
}

/** Per-frame update: scripts, tile travel, the queue, then the world (reference §17). */
export function update(dt, t) {
  if (!world) return;
  clockTime = t;

  if (roomMode === 'dupa' && dupaRunning && !paused && phase === 'playing' && !isHelperActive()) {
    dupaRemainingMs -= dt * 1000;
    if (dupaRemainingMs <= 0) {
      dupaRemainingMs = 0;
      onDupaTimeout();
    }
    hud?.setDupaTime?.(dupaRemainingMs, dupaTotalMs);
  }
  if (isHelperActive()) {
    updateHelper(dt);
  }

  if (scriptWait > 0) scriptWait -= dt;
  else if (!wanderer.move && script.length) runScript();

  const m = wanderer.move;
  if (m && !m.demo) {
    m.p = Math.min(1, m.p + dt / (m.dur ?? DURATION[m.kind]));
    const e = m.kind === 'push' ? smooth(m.p) : easeInOutSine(m.p);
    wanderer.root.position.x = lerp(cellX(m.from.c), cellX(m.to.c), e);
    wanderer.root.position.z = lerp(cellZ(m.from.r), cellZ(m.to.r), e);
    if (m.objectIndex != null) {
      const obj = world.objects[m.objectIndex];
      const le = smooth(clamp((m.p - 0.12) / 0.8, 0, 1));
      obj.group.position.x = lerp(cellX(m.objectFrom.c), cellX(m.objectTo.c), le);
      obj.group.position.z = lerp(cellZ(m.objectFrom.r), cellZ(m.objectTo.r), le);
    }
    if (m.rewound) {
      for (const { objIndex, from, to } of m.rewound) {
        const obj = world.objects[objIndex];
        obj.group.position.x = lerp(cellX(from.c), cellX(to.c), e);
        obj.group.position.z = lerp(cellZ(from.r), cellZ(to.r), e);
      }
    }
    if (m.p >= 1) {
      if (m.kind === 'rewind' || m.scripted) wanderer.move = null;
      else finishMove(m);
      const next = queue.shift();
      if (next?.undo) undo();
      else if (next) tryStep(next.dir, next.kind);
    }
  } else if (demoState.kind && !wanderer.frozen) {
    demoState.p += dt / DURATION[demoState.kind];
    if (demoState.p >= 1) {
      demoState.p -= 1;
      demoState.step += 1;
    }
    wanderer.move = { kind: demoState.kind, p: demoState.p, stepIndex: demoState.step, demo: true };
  }

  world.update(freezeOn ? 0 : dt, freezeOn ? freezeT : t, { covered: coveredFlags() });
  world.render();
}

// --- public: input actions (dispatched to the top-most screen by main.js) --

export function screenMove(screenDir) {
  if (paused) return;
  if (phase === 'timeout' && timeoutChoices) {
    if (screenDir === 1) timeoutChoices.move(1);
    else if (screenDir === 3) timeoutChoices.move(-1);
    return;
  }
  if (phase === 'arriving') {
    skipIntro();
    return;
  }
  if (phase !== 'playing') return;
  const dir = screenToGrid(screenDir);
  queue = wanderer.move ? [{ dir, kind: 'walk' }] : [];
  if (!wanderer.move) tryStep(dir);
}

export function skip() {
  if (paused) return;
  if (phase === 'timeout' && timeoutChoices) {
    timeoutChoices.pick();
    return;
  }
  skipIntro();
}

/**
 * Confirms dialogue or timeout card, or no-op during play.
 */
export function confirm() {
  if (phase === 'timeout' && timeoutChoices) {
    timeoutChoices.pick();
  }
}

export function rotate(delta) {
  if (paused) return;
  rotateCamera(delta);
}

export function pointerMove(clientX, clientY) {
  if (paused) return;
  if (phase !== 'playing') {
    world.setHover(null);
    return;
  }
  const cell = world.cellUnderPointer(clientX, clientY);
  const ok = cell && level.inside[cell.r]?.[cell.c];
  world.setHover(ok ? cell : null);
}

export function pointerDown(clientX, clientY) {
  if (paused) return;
  if (phase === 'arriving') {
    skipIntro();
    return;
  }
  if (phase !== 'playing') return;

  const cell = world.cellUnderPointer(clientX, clientY);
  if (!cell || !level.inside[cell.r]?.[cell.c]) return;

  const dr = cell.r - game.state.player.r;
  const dc = cell.c - game.state.player.c;
  const objIndex = findObjectIndexAt(cell.r, cell.c);
  if (objIndex !== -1 && Math.abs(dr) + Math.abs(dc) === 1) {
    queue = [];
    if (!wanderer.move) tryStep([dr, dc]);
    else queue = [{ dir: [dr, dc], kind: 'walk' }];
    return;
  }

  const dirs = pathCellsToward(cell);
  if (!dirs) return;
  const kind = dirs.length > 2 ? 'run' : 'walk';
  queue = dirs.map((name) => ({ dir: DIR_NAMES[name], kind }));
  world.fx.ripple(cellX(cell.c), cellZ(cell.r), '#ffffff', 0.8, 0.5);
  if (!wanderer.move) {
    const next = queue.shift();
    tryStep(next.dir, next.kind);
  }
}

/** `onBack`/`onPause`: opens the pause overlay, unless results are already showing. */
function openPause() {
  if (paused || phase === 'results') return;
  router?.open('pause', { room: roomNumber });
}

/**
 * The handlers `main.js` dispatches to when this screen is top-most
 * (`ARCHITECTURE.md` §7.3). The first eight are today's own functions;
 * `onBack`/`onPause` both open the pause overlay.
 */
export const input = {
  onDirection: screenMove,
  onSkip: skip,
  onUndo: undo,
  onRestart: restart,
  onRotate: rotate,
  onConfirm: confirm,
  onPointerMove: pointerMove,
  onPointerDown: pointerDown,
  onBack: openPause,
  onPause: openPause,
};

// --- public: QA / reference-parity hooks (dev/qa.js re-exports these) ------

/** First gesture: starts audio and, if the arrival was waiting on it, begins it. */
export function start() {
  sound.start();
  if (introPending && world?.decor?.gate) beginIntro(world.decor.gate);
}

export function setMood(i, instant = true) {
  snapMoodIndex(i, instant);
}

export function closeUp(z = 4) {
  view.zoom = z;
  view.target.copy(z > 1 ? wanderer.root.position : new THREE.Vector3());
  view.target.y = z > 1 ? 0.45 : 0;
  fitCamera();
}

export function focus(x, z, zoom = 4) {
  if (x === undefined) {
    view.zoom = 1;
    view.target.set(0, 0, 0);
  } else {
    view.zoom = zoom;
    view.target.set(x, 0.3, z);
  }
  fitCamera();
}

export function face(screenDir) {
  const [dr, dc] = screenToGrid(screenDir);
  wanderer.faceDir(dr, dc);
}

export function scrub(name, t = 0, step = 0) {
  demoState = { kind: null, p: 0, step: 0 };
  wanderer.frozen = !!name;
  wanderer.move = null;
  wanderer.action = null;
  if (!name) return;
  if (['walk', 'run', 'push'].includes(name)) {
    wanderer.move = { kind: name, p: t, stepIndex: step, demo: true, scrub: true };
  } else if (name === 'look') {
    wanderer.idle = LOOK_AFTER + t;
  } else if (name === 'meditate') {
    wanderer.idle = MEDITATE_AFTER + t;
  } else if (name === 'idle') {
    wanderer.idle = t;
  } else {
    wanderer.action = name;
    wanderer.actionTime = t;
    wanderer.idle = 0;
  }
}

/** Treadmill mode: plays a gait in place so it can be inspected (reference §16/17). */
export function play(name) {
  const gait = { walk: 'walk', run: 'run', push: 'push' }[name];
  wanderer.cancelAction();
  wanderer.idle = 0;
  if (gait) {
    demoState = { kind: gait, p: 0, step: 0 };
    return;
  }
  demoState = { kind: null, p: 0, step: 0 };
  if (name === 'look') wanderer.idle = LOOK_AFTER;
  else if (name === 'meditate') wanderer.idle = MEDITATE_AFTER + 2;
  else wanderer.perform(name);
}

/** Teleports the first n free objects onto free targets (QA-only; bypasses core's own rules). */
export function arrange(n = Infinity) {
  const freeTargets = level.targets.filter((t) => findObjectIndexAt(t.r, t.c) === -1);
  const freeObjects = game.state.objects.filter((o) => !isTargetAt(o.r, o.c));
  freeObjects.slice(0, n).forEach((obj, i) => {
    const target = freeTargets[i];
    if (!target) return;
    const idx = game.state.objects.indexOf(obj);
    obj.r = target.r;
    obj.c = target.c;
    const themeObj = world.objects[idx];
    themeObj.group.position.set(cellX(target.c), 0, cellZ(target.r));
    themeObj.setLit(true);
  });
  game.state.solved = recomputeSolved();
  updateHud();
  if (game.state.solved) win();
}

export function where() {
  return world.where();
}

export function setTheme(id) {
  themeId = id;
  loadRoom(roomNumber, { intro: false });
}

export function freezeTime(on) {
  freezeOn = !!on;
  if (freezeOn) freezeT = clockTime;
}

/** Plays the stored solution at full speed (never fails; falls back to `arrange`). */
export function solve() {
  const sol = solutions[String(roomNumber)];
  if (!sol || !sol.lurd) {
    arrange(Infinity);
    return;
  }
  const dirFor = { u: 'up', d: 'down', l: 'left', r: 'right' };
  for (const ch of sol.lurd) {
    const dir = dirFor[ch.toLowerCase()];
    if (dir) game.move(dir);
  }
  // Full speed: resolve the logic instantly, then sync the visuals once.
  wanderer.move = null;
  wanderer.root.position.set(cellX(game.state.player.c), 0, cellZ(game.state.player.r));
  game.state.objects.forEach((o, i) => {
    const themeObj = world.objects[i];
    themeObj.group.position.set(cellX(o.c), 0, cellZ(o.r));
    themeObj.setLit(isTargetAt(o.r, o.c));
  });
  actor = { ...game.state.player };
  updateHud();
  if (game.state.solved) win();
}

export function getDecor() {
  return world?.decor;
}

export function getState() {
  return {
    player: game.state.player,
    lit: countLit(),
    goals: level.targets.length,
    steps: game.state.steps,
    action: wanderer.action,
  };
}

/** Opens room `n` (1-50) directly, or reloads the current room with a new seed/mood. */
export function room(n, opts = {}) {
  loadRoom(n, { ...opts, intro: opts.intro ?? false });
}

export function inspect() {
  return {
    room: roomNumber,
    phase,
    arrival,
    mode: roomMode,
    dupaLeft: dupaRemainingMs,
    ...world.inspect(),
  };
}

// The stick goes out: the ember darkens, the smoke rises and thins over 2 s,
// a soft low bell, then the veil with the two choices (ART-DIRECTION §13.7).
function onDupaTimeout() {
  dupaRunning = false;
  phase = 'timeout';
  queue = [];
  wanderer.move = null;
  wanderer.cancelAction();
  wanderer.idle = MEDITATE_AFTER + 1.2;
  hud?.setDupaTime?.(0, dupaTotalMs);
  sound.bell(73.4, 0.08); // Floor bell an octave down, quieter

  timeoutCard = createCard('timeout-card');
  timeoutCard.inner.append(
    el('div', 'headline', 'dupa telah padam'),
  );
  const items = [
    { label: 'ulangi', run: () => { timeoutCard?.dispose(); timeoutCard = null; timeoutChoices = null; restart(); } },
    { label: 'kembali ke menara', run: () => { timeoutCard?.dispose(); timeoutCard = null; timeoutChoices = null; router.goto('floor', { floor: Math.ceil(roomNumber / 10), room: roomNumber }); } },
  ];
  const choices = createChoices(items);
  timeoutChoices = choices;
  timeoutCard.inner.append(choices.root);
}

export function triggerHelper() {
  if (phase !== 'playing') return;
  openHelper({
    roomNumber,
    level,
    game,
    wanderer,
    objects: game.state.objects,
    worldObjects: world.objects,
    isTargetAt,
    saveAttempt: () => {
      dupaRunning = false;
      return {
        state: JSON.parse(JSON.stringify(game.state)),
        history: [...game.history],
        dupaRemainingMs,
        actor: { ...actor },
        phase,
      };
    },
    restoreAttempt: (saved) => {
      game.state.player = { ...saved.state.player };
      game.state.steps = saved.state.steps;
      game.state.pushes = saved.state.pushes;
      game.state.solved = saved.state.solved;
      game.state.objects = saved.state.objects.map((o) => ({ ...o }));
      if (game.history) {
        game.history.length = 0;
        game.history.push(...saved.history);
      }
      dupaRemainingMs = saved.dupaRemainingMs;
      actor = { ...saved.actor };
      phase = saved.phase;
      wanderer.root.position.set(cellX(game.state.player.c), 0, cellZ(game.state.player.r));
      game.state.objects.forEach((o, i) => {
        const themeObj = world.objects[i];
        themeObj.group.position.set(cellX(o.c), 0, cellZ(o.r));
        themeObj.setLit(isTargetAt(o.r, o.c));
      });
      wanderer.root.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          obj.material.opacity = 1;
          obj.material.depthWrite = true;
        }
      });
      if (roomMode === 'dupa') {
        dupaRunning = true;
        hud?.setDupaTime?.(dupaRemainingMs, dupaTotalMs);
      }
      updateHud();
    },
    dimHud: (dim) => {
      document.querySelectorAll('.hud').forEach((el) => {
        el.classList.toggle('hud-dimmed', dim);
      });
    },
    markAssisted: () => {
      isAssistedAttempt = true;
    },
    resetToStart: () => {
      wanderer.root.position.set(cellX(level.start.c), 0, cellZ(level.start.r));
      level.objects.forEach((o, i) => {
        const themeObj = world.objects[i];
        themeObj.group.position.set(cellX(o.c), 0, cellZ(o.r));
        themeObj.setLit(isTargetAt(o.r, o.c));
      });
    },
    onSolutionFound: (lurd) => {
      if (gardenParams) {
        const g = getGarden();
        if (g.slots[gardenParams.slot]) {
          g.slots[gardenParams.slot].solution = lurd;
          updateSlot(gardenParams.slot, g.slots[gardenParams.slot]);
        }
      }
    },
  });
}

export function setDupaLeft(ms) {
  dupaRemainingMs = ms;
  hud?.setDupaTime?.(dupaRemainingMs, dupaTotalMs);
}

export function setRoomMode(m) {
  roomMode = m;
  setSessionMode(m);
  hud?.setDupaVisible?.(m === 'dupa');
}

export function getDupaRemainingMs() {
  return dupaRemainingMs;
}
