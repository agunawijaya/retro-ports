/**
 * @file Halaman — the courtyard lobby (ART-DIRECTION §13.3, GAME-DESIGN
 * §7.2). There is no menu: the wanderer walks, exactly as in a room, and
 * each of the five places is used by standing in front of it.
 */

import * as THREE from 'three';
import { createGame } from '../core/game.js';
import { findPath } from '../core/path.js';
import { DIR_NAMES } from '../core/level.js';
import { screenToGrid } from '../render/camera.js';
import { cellX, cellZ } from '../render/board.js';
import { setMoodPosition } from '../render/moods.js';
import { getProgress, nextRoom, floorOf } from '../state/progress.js';
import { getTowerWorld } from '../world/tower-world.js';
import { courtyardView } from '../world/tower-views.js';
import { courtyardLevel, PLACES, COURTYARD_START, TOWER_Z } from '../world/places.js';
import { createCaption } from '../ui/veil.js';
import { showWholeTower } from './title.js';
import { getSolution } from '../data/solutions.js';
import { resetSessionMode, setSessionMode } from '../state/mode.js';
import { reducedMotion } from '../state/settings.js';

const STEP = { walk: 0.24, run: 0.15 };

let ctx = null;
let world = null;
let game = null;
let caption = null;
/** Buffered steps: one key press, or a tapped path. */
let queue = [];
let stepping = false;
/** The place used last: the wanderer comes back to it (§13.3). */
let lastPlace = null;
let leaving = false;
let idleTimer = 0;

const cellPoint = ({ r, c }) => new THREE.Vector3(cellX(c), 0, cellZ(r));
const placeAt = (r, c) => PLACES.find((p) => p.cells.some(([pr, pc]) => pr === r && pc === c));
const placeOnTile = ({ r, c }) => PLACES.find((p) => p.tile.r === r && p.tile.c === c);
const placeCentre = (p) => {
  const n = p.cells.length;
  const r = p.cells.reduce((s, [a]) => s + a, 0) / n;
  const c = p.cells.reduce((s, [, b]) => s + b, 0) / n;
  return cellPoint({ r, c });
};

/**
 * @param {{ descend?: boolean, at?: string, fromElevator?: boolean }} params
 *   `descend`: from the title, the camera comes down and the wanderer stands
 *   up; `at`: a place id to stand in front of (coming back from it);
 *   `fromElevator`: the mood is already fading back to dawn.
 */
export function enter(c, params = {}) {
  ctx = c;
  leaving = false;
  queue = [];
  stepping = false;
  idleTimer = 0;
  resetSessionMode();
  world = getTowerWorld(ctx.canvas);
  world.setProgress(getProgress());
  showWholeTower(world);
  setMoodPosition(0, (!params.descend && !params.fromElevator) || reducedMotion());

  const level = courtyardLevel();
  const placeId = params.at ?? lastPlace;
  const place = PLACES.find((p) => p.id === placeId);
  const start = params.atPlayer ? params.atPlayer : (params.descend || !place ? COURTYARD_START : place.tile);
  level.start = { ...start };
  game = createGame(level);

  // Finish any walk first: its end may fade the wanderer, and this screen shows them.
  world.snapWalk();
  const w = world.wanderer;
  w.cancelAction();
  w.setOpacity(1);
  w.fadeTo = 1;
  if (!params.descend || reducedMotion()) {
    w.root.position.copy(cellPoint(start));
    if (params.yaw != null) {
      w.yaw = w.shownYaw = params.yaw;
    } else if (place) {
      world.faceToward(params.at === 'gerbang' ? cellPoint({ r: 5, c: 4 }) : placeCentre(place));
    } else {
      world.faceCamera();
    }
    w.shownYaw = w.yaw;
  }
  w.idle = 0;

  if (params.descend && !reducedMotion()) world.moveView(courtyardView(), 2.4);
  else world.setView(courtyardView());

  caption = createCaption();
  ctx.hud.setPlace('Halaman');
  ctx.hud.setVisible({ title: true, tools: false, counters: false, hint: false });
}

export function exit() {
  caption?.dispose();
  caption = null;
  ctx = null;
  world = null;
}

/** For QA: where the wanderer stands, and the place whose name is showing. */
export function inspect() {
  if (!world) return null;
  const place = standingAt();
  return {
    cell: { ...game.state.player },
    walking: stepping || world.walking,
    place: place?.id ?? null,
    caption: caption?.visible ? place?.name ?? null : null,
    engravings: (world.progress.floorsLit ?? []).length,
    idle: idleTimer,
  };
}

export function resize() {
  world?.setView(courtyardView());
}

// --- walking --------------------------------------------------------------------------

function tryStep(dir, kind = 'walk') {
  const result = game.move(dir);
  const w = world.wanderer;
  if (result.kind === 'blocked-wall') {
    const [dr, dc] = dir;
    w.faceDir(dr, dc);
    w.perform('bump');
    ctx.sound.thump(110, 0.05);
    queue = [];
    return false;
  }
  w.cancelAction();
  stepping = true;
  ctx.sound.step();
  world.walkPath([cellPoint(result.to)], {
    pace: STEP[kind],
    kind,
    onDone: () => {
      stepping = false;
      const next = queue.shift();
      if (next) tryStep(next.dir, next.kind);
      else arrived();
    },
  });
  return true;
}

/** Walk to a cell along the shortest free path (runs when it is more than two tiles). */
function walkTo(cell) {
  const dirs = findPath(game, cell);
  if (!dirs) return false;
  if (!dirs.length) {
    arrived();
    return true;
  }
  const kind = dirs.length > 2 ? 'run' : 'walk';
  queue = dirs.map((name) => ({ dir: DIR_NAMES[name], kind }));
  if (!stepping) {
    const next = queue.shift();
    tryStep(next.dir, next.kind);
  }
  return true;
}

/** Standing still on an activation tile: turn toward the place. */
function arrived() {
  const place = placeOnTile(game.state.player);
  if (place) world.faceToward(placeCentre(place));
}

const standingAt = () => (stepping ? null : placeOnTile(game.state.player));

// --- using a place ----------------------------------------------------------------------

function use(place) {
  if (leaving) return;
  idleTimer = 0;
  lastPlace = place.id;
  world.faceToward(placeCentre(place));
  if (place.id === 'gerbang') {
    ctx.onGateChoice = (chosenMode) => {
      setSessionMode(chosenMode);
      leaving = true;
      const w = world.wanderer;
      world.walkPath(
        [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0)],
        { pace: 0.36, onDone: () => { if (ctx) w.fadeTo = 0; } },
      );
      setTimeout(() => { if (ctx) w.fadeTo = 0; }, 450);
      const floor = floorOf(nextRoom(getProgress()));
      ctx.router.goto('elevator', { from: 0, to: floor, then: 'floor' });
    };
    ctx.router.open('gate-choice');
  } else if (place.id === 'batu') {
    ctx.router.open('records');
  } else if (place.id === 'kolam') {
    ctx.router.open('settings');
  } else if (place.id === 'paviliun') {
    ctx.router.goto('garden');
  } else if (place.id === 'jalan') {
    // Down the stones into the cloud, and back to the title.
    leaving = true;
    const w = world.wanderer;
    world.walkPath([new THREE.Vector3(-4, 0, 1), new THREE.Vector3(-4.85, -0.14, 1), new THREE.Vector3(-5.65, -0.28, 1)], {
      pace: 0.36,
      onDone: () => { if (ctx) w.fadeTo = 0; },
    });
    lastPlace = null;
    ctx.router.goto('title');
  }
}

export function startDream() {
  if (leaving || !ctx) return;
  const p = getProgress();
  let chosen = p.lastRoom;
  if (!chosen || !getSolution(chosen)) {
    const solved = Object.keys(p.solved ?? {})
      .map(Number)
      .filter((n) => getSolution(n))
      .sort((a, b) => b - a);
    chosen = solved[0] ?? 1;
  }
  ctx.router.goto('dream', {
    room: chosen,
    courtyardState: { player: { ...game.state.player }, yaw: world.wanderer.yaw },
  }, { crossfade: 1.2 });
}

// --- input ------------------------------------------------------------------------------

export const input = {
  onDirection(screenDir) {
    if (leaving) return;
    idleTimer = 0;
    const dir = screenToGrid(screenDir);
    if (stepping) queue = [{ dir, kind: 'walk' }];
    else tryStep(dir);
  },
  onConfirm() {
    idleTimer = 0;
    const place = standingAt();
    if (place) use(place);
  },
  onSkip() {
    idleTimer = 0;
    const place = standingAt();
    if (place) use(place);
  },
  onDigit(n) {
    idleTimer = 0;
    const place = PLACES[n - 1];
    if (!place || leaving) return;
    walkTo(place.tile);
  },
  onPointerDown(x, y) {
    if (leaving) return;
    idleTimer = 0;
    const cell = world.cellUnderPointer(x, y);
    if (!cell) return;
    const here = standingAt();
    const place = placeAt(cell.r, cell.c) ?? placeOnTile(cell);
    if (place && here === place) {
      use(place);
      return;
    }
    const goal = place ? place.tile : cell;
    if (walkTo(goal)) world.fx.ripple(cellX(goal.c), cellZ(goal.r), '#ffffff', 0.8, 0.5);
  },
};

// --- frame ------------------------------------------------------------------------------

export function update(dt, t) {
  world.update(dt, t);

  if (!leaving && !stepping && queue.length === 0 && ctx?.router?.top() === 'courtyard') {
    idleTimer += dt;
    if (idleTimer >= 20) {
      idleTimer = 0;
      startDream();
    }
  } else {
    idleTimer = 0;
  }

  const place = leaving ? null : standingAt();
  if (place) {
    const p = world.toScreen(new THREE.Vector3(...place.top));
    caption.place(p.x, p.y);
    caption.show(place.name);
  } else {
    caption.hide();
  }
  world.render();
}
