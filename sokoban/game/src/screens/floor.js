/**
 * @file Lantai — a floor of the tower, where the player picks a room
 * (ART-DIRECTION §13.5, GAME-DESIGN §7.4). Ten niches stand on the rim
 * at 36° intervals; the camera orbits the axis in 36° steps so one faces
 * the player at a time, and the wanderer walks along the rim to stand on
 * the current niche's target.
 */

import * as THREE from 'three';
import { setMoodPosition } from '../render/moods.js';
import { easeInOutSine } from '../render/math.js';
import { ROOF, roomState } from '../render/tower.js';
import { getProgress, openFloors } from '../state/progress.js';
import { reducedMotion } from '../state/settings.js';
import { getSessionMode } from '../state/mode.js';
import { getTowerWorld } from '../world/tower-world.js';
import { levelView, floorMood, roman, two } from '../world/tower-views.js';
import { createCaption } from '../ui/veil.js';
import { niche, nicheAzimuth, floorStone, NICHE_COUNT } from '../world/stone-layout.js';

let ctx = null;
let world = null;
let floor = 1;
let index = 0;
/** The camera's azimuth goal, kept continuous so it never spins the long way round. */
let azimuth = 0;
let caption = null;
let entering = null;

const roomOf = (i) => (floor - 1) * 10 + i + 1;

/** The wanderer waits on the current niche's target on the rim (§13.5). */
const standPoint = (i) => {
  const n = niche(floor, i);
  return new THREE.Vector3(n.target.x, floorStone(floor).topY, n.target.z);
};

/** Platform center at this floor's top surface. */
const platformPoint = () => new THREE.Vector3(0, floorStone(floor).topY, 0);

/** The azimuth equivalent to `a` that is nearest to `near`. */
function nearest(a, near) {
  return a + Math.round((near - a) / (Math.PI * 2)) * Math.PI * 2;
}

/**
 * @param {{ floor: number, room?: number, fromElevator?: boolean, azimuth?: number }} params
 */
export function enter(c, params) {
  ctx = c;
  entering = null;
  floor = params.floor ?? 1;
  world = getTowerWorld(ctx.canvas);
  const progress = getProgress();
  if (world.progress !== progress) world.setProgress(progress);

  const t = world.tower;
  for (let k = 0; k <= ROOF; k++) t.setLevelPresence(k, 1);
  t.setPlatformLevel(floor);
  t.setFocusFloor(floor);

  // The niche in focus: the room asked for, else this floor's next unsolved one.
  const asked = params.room && Math.ceil(params.room / 10) === floor ? (params.room - 1) % 10 : null;
  let firstOpen = -1;
  for (let i = 0; i < NICHE_COUNT; i++) {
    if (roomState(progress, roomOf(i)) === 'open') {
      firstOpen = i;
      break;
    }
  }
  index = asked ?? (firstOpen >= 0 ? firstOpen : 0);

  setMoodPosition(floorMood(progress, floor), !params.fromElevator);
  const from = params.azimuth ?? world.view.azimuth;
  azimuth = nearest(nicheAzimuth(index), from);
  const view = levelView(floor, azimuth);
  if (params.fromElevator) world.moveView(view, null, reducedMotion() ? 60 : 3);
  else world.setView(view);

  world.snapWalk();
  const w = world.wanderer;
  w.setOpacity(1);
  w.fadeTo = 1;
  w.cancelAction();
  w.idle = 0;

  if (params.fromElevator && !reducedMotion()) {
    // Off the platform, across the stone surface onto the target on the rim.
    w.root.position.copy(platformPoint());
    const goal = standPoint(index);
    world.walkPath([goal], {
      pace: 0.3,
      onDone: faceAlcove,
    });
  } else {
    w.root.position.copy(standPoint(index));
    faceAlcove();
    w.shownYaw = w.yaw;
  }

  caption = createCaption({ below: true });
  ctx.hud.setVisible({ title: true, tools: false, counters: false, hint: false });
  showCurrent();
}

export function exit() {
  world?.tower?.setFocusFloor(null);
  if (world?.hover) world.hover.visible = false;
  caption?.dispose();
  caption = null;
  ctx = null;
  world = null;
}

/** For QA: the floor in view, the niche in focus, and every niche's state. */
export function inspect() {
  if (!world) return null;
  const items = world.tower.focus?.items ?? [];
  return {
    floor,
    index,
    room: roomOf(index),
    alcoves: items.map((it) => ({ room: it.room, state: it.state, lit: !!it.object?.isLit })),
    ringsLit: world.tower.bands.map((b, k) => (k >= 1 && b.litTarget > 0 ? k : null)).filter(Boolean),
    walking: world.walking,
  };
}

export function resize() {
  world?.setView(levelView(floor, azimuth));
}

function faceAlcove() {
  const n = niche(floor, index);
  world.faceToward(new THREE.Vector3(n.object.x, floorStone(floor).topY, n.object.z));
}

function showCurrent() {
  const n = niche(floor, index);
  ctx.hud.setPlace(`Lantai ${roman(floor)} · Ruang ${two(roomOf(index))}`);
  const hover = world.hover;
  hover.visible = true;
  hover.position.set(n.target.x, floorStone(floor).topY + 0.008, n.target.z);
}

/** The caption under the niche: its number, and its records once solved. */
function captionText() {
  const room = roomOf(index);
  const mode = getSessionMode();
  const rec = getProgress().solved?.[room]?.[mode];
  return { name: `ruang ${two(room)}`, detail: rec ? `${rec.steps} langkah · ${rec.pushes} dorongan` : '' };
}

// --- moving around the rim ------------------------------------------------------

/** Steps `delta` niches round the rim (→ is +1). */
function select(delta) {
  if (entering || !delta) return;
  const path = [];
  let i = index;
  for (let k = 0; k < Math.abs(delta); k++) {
    i = (i + Math.sign(delta) + NICHE_COUNT) % NICHE_COUNT;
    path.push(standPoint(i));
  }
  index = i;
  azimuth = nearest(nicheAzimuth(index), world.view.azimuth);
  world.moveView({ azimuth }, null, reducedMotion() ? 60 : 5.5);
  world.wanderer.cancelAction();
  world.walkPath(path, { pace: 0.3, onDone: faceAlcove });
  showCurrent();
}

function ride(to) {
  if (entering) return;
  world.walkPath([platformPoint()], {
    pace: 0.3,
    onDone: () => {
      ctx.router.goto(
        'elevator',
        { from: floor, to, then: to === 0 ? 'courtyard' : 'floor', azimuth },
        { instant: true },
      );
    },
  });
}

/** Enter the niche's room: its object rises, then the room fades in. */
function enterRoom() {
  if (entering) return;
  const room = roomOf(index);
  const state = roomState(getProgress(), room);
  if (state === 'locked') {
    world.wanderer.perform('shrug');
    return;
  }
  world.snapWalk();
  faceAlcove();
  const item = world.tower.focus?.items[index];
  entering = { item, t: 0, room };
  if (reducedMotion()) go();
}

function go() {
  const { room } = entering;
  entering.t = Infinity;
  ctx.router.goto('room', { room }, { crossfade: 0.8 });
}

export const input = {
  onDirection(d) {
    if (d === 1) select(1);
    else if (d === 3) select(-1);
    else if (d === 0 && floor < Math.min(5, openFloors(getProgress()))) ride(floor + 1);
    else if (d === 2 && floor > 1) ride(floor - 1);
  },
  onConfirm: enterRoom,
  onSkip() {
    if (world.walking) world.snapWalk();
    else enterRoom();
  },
  onBack() {
    ride(0);
  },
  onPointerDown(x, y) {
    if (entering) return;
    let best = -1;
    let bestD = 90;
    for (let i = 0; i < NICHE_COUNT; i++) {
      const n = niche(floor, i);
      const p = world.toScreen(new THREE.Vector3(n.object.x, floorStone(floor).topY + 0.5, n.object.z));
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return;
    if (best === index) {
      enterRoom();
      return;
    }
    let delta = (best - index + NICHE_COUNT) % NICHE_COUNT;
    if (delta > 5) delta -= NICHE_COUNT;
    select(delta);
  },
};

// --- frame ------------------------------------------------------------------------------

export function update(dt, t) {
  if (entering && entering.t !== Infinity) {
    entering.t += dt;
    if (entering.item) entering.item.rise = easeInOutSine(Math.min(1, entering.t / 0.6)) * 0.45;
    if (entering.t >= 0.6) go();
  }
  world.update(dt, t);
  const p = world.toScreen(standPoint(index));
  const { name, detail } = captionText();
  caption.place(p.x, p.y + 14);
  if (world.walking || entering) caption.hide();
  else caption.show(name, detail);
  world.render();
}
