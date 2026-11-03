/**
 * @file The elevator — platform batu (ART-DIRECTION §13.4, GAME-DESIGN
 * §7.3). A round stone platform rises along the axis of the floating stones,
 * through their openings, 3.2 s per floor (easeInOutSine); the camera rides
 * with it. As the platform passes each stone, that stone settles (4° turn, 3 cm
 * dip, back over 1.6 s with a soft overshoot) with a quiet stone knock.
 * Arrival settles with a 2 cm spring and a quiet D3 bell. Any key skips to arrival.
 */

import * as THREE from 'three';
import { setMoodPosition } from '../render/moods.js';
import { clamp } from '../render/math.js';
import { ROOF, shaftExit } from '../render/tower.js';
import { getProgress } from '../state/progress.js';
import { getTowerWorld, towerPoint } from '../world/tower-world.js';
import { levelView, floorMood, roman } from '../world/tower-views.js';
import { platformY, rideSeconds, floorStone, AXIS_STEP } from '../world/stone-layout.js';
import { reducedMotion } from '../state/settings.js';

const SETTLE = 0.5;

let ctx = null;
let world = null;
let ride = null;

/** World-space position of the platform's top at level L. */
const platformTop = (L) => new THREE.Vector3(0, L * AXIS_STEP, 0);

/**
 * @param {{ from: number, to: number, then?: 'floor'|'courtyard'|'ending',
 *   room?: number, litFloor?: number, azimuth?: number, walkToPlatform?: boolean }} params
 */
export function enter(c, params) {
  ctx = c;
  world = getTowerWorld(ctx.canvas);
  const progress = getProgress();
  if (world.progress !== progress) world.setProgress(progress);
  world.hover.visible = false;
  world.tower.setFocusFloor(null);

  const from = params.from ?? 0;
  const to = params.to ?? 1;
  const azimuth = params.azimuth ?? Math.PI / 4;
  const totalSeconds = Math.max(0.1, rideSeconds(from, to));

  ride = {
    from,
    to,
    then: params.then ?? (to === 0 ? 'courtyard' : 'floor'),
    room: params.room ?? null,
    litFloor: params.litFloor ?? null,
    azimuth,
    t: 0,
    seconds: totalSeconds,
    phase: params.walkToPlatform ? 'boarding' : 'riding',
    settle: 0,
    settled: new Set(),
    lit: false,
  };

  const t = world.tower;
  for (let k = 0; k <= ROOF; k++) t.setLevelPresence(k, 1);
  t.setPlatformLevel(from);

  const target = to === 0 ? 0 : to >= ROOF ? 3 : floorMood(progress, to);
  setMoodPosition(target, false);

  const view = levelView(from, azimuth);
  if (params.walkToPlatform) world.moveView(view);
  else world.setView(view);

  // Finish any walk first: its end may fade the wanderer, and the ride shows them.
  world.snapWalk();
  const w = world.wanderer;
  w.setOpacity(1);
  w.fadeTo = 1;
  w.cancelAction();
  w.idle = 0;

  if (params.walkToPlatform) {
    world.walkPath([platformTop(from)], {
      pace: 0.3,
      onDone: () => {
        world.faceCamera();
        ride.phase = 'riding';
      },
    });
  } else {
    w.root.position.copy(platformTop(from));
    world.faceCamera();
    w.shownYaw = w.yaw;
  }

  ctx.hud.setPlace(to === 0 ? 'Halaman' : to >= ROOF ? '' : `Lantai ${roman(to)}`);
  ctx.hud.setVisible({ title: to < ROOF, tools: false, counters: false, hint: false });
}

export function exit() {
  ctx = null;
  world = null;
  ride = null;
}

/** For QA: the ride in progress. */
export function inspect() {
  if (!ride) return null;
  return {
    from: ride.from,
    to: ride.to,
    then: ride.then,
    phase: ride.phase,
    level: ride.phase === 'boarding' ? ride.from : levelNow(),
  };
}

export function resize() {
  if (world && ride) world.setView(levelView(levelNow(), ride.azimuth));
}

function yNow() {
  const p = clamp(ride.t / ride.seconds, 0, 1);
  return platformY(ride.from, ride.to, p);
}

function levelNow() {
  return yNow() / AXIS_STEP;
}

function lightRing() {
  if (ride.lit || !ride.litFloor) return;
  ride.lit = true;
  world.tower.setBandLit(ride.litFloor, true);
  ctx.sound.bell(73.42, 0.09);
}

function arrive() {
  ride.phase = 'settling';
  ride.t = ride.seconds;
  ride.settle = 0;
  lightRing();
  // Temple bell on D3 (146.83 Hz), quiet
  ctx.sound.bell(146.83, 0.07);
  if (reducedMotion()) {
    depart();
  }
}

/** Every piece in its final place at once (a skip). */
function finishNow() {
  if (ride.phase === 'boarding') world.snapWalk();
  ride.t = ride.seconds;
  if (ride.litFloor) {
    world.tower.setBandLit(ride.litFloor, true, true);
    if (!ride.lit) {
      ride.lit = true;
      ctx.sound.bell(73.42, 0.09);
    }
  }
  depart();
}

function depart() {
  const { then, to, room, azimuth } = ride;
  ride.phase = 'done';
  world.tower.setPlatformLevel(to);
  world.wanderer.root.position.copy(platformTop(to));
  if (then === 'floor') ctx.router.goto('floor', { floor: to, room, fromElevator: true, azimuth }, { instant: true });
  else if (then === 'ending') ctx.router.goto('ending', {}, { instant: true });
  else ctx.router.goto('courtyard', { at: 'gerbang', fromElevator: true });
}

export function update(dt, t) {
  if (ride.phase === 'riding') {
    ride.t = Math.min(ride.seconds, ride.t + dt);
    const curY = yNow();
    const curLevel = curY / AXIS_STEP;

    // Check stones passed to trigger settling and quiet knock
    if (ride.to > ride.from) {
      for (let k = 1; k <= Math.min(5, ride.to); k++) {
        if (!ride.settled.has(k) && curY >= floorStone(k).topY - 0.2) {
          ride.settled.add(k);
          if (!reducedMotion()) {
            world.tower.triggerSettle(k);
            ctx.sound.stoneKnock?.();
          }
        }
      }
    } else {
      for (let k = 5; k >= Math.max(1, ride.to); k--) {
        if (!ride.settled.has(k) && curY <= floorStone(k).topY + 0.2) {
          ride.settled.add(k);
          if (!reducedMotion()) {
            world.tower.triggerSettle(k);
            ctx.sound.stoneKnock?.();
          }
        }
      }
    }

    if (ride.litFloor && curY >= floorStone(ride.litFloor).topY + 0.5) lightRing();

    world.tower.setPlatformY(curY);
    world.wanderer.root.position.set(0, curY, 0);
    world.setView(levelView(curLevel, ride.azimuth));

    if (ride.t >= ride.seconds) arrive();
  } else if (ride.phase === 'settling') {
    if (reducedMotion()) {
      depart();
      return;
    }
    ride.settle += dt;
    // 2 cm overshoot, then rest: damped spring
    const s = ride.settle;
    const bump = 0.02 * Math.exp(-6 * s) * Math.sin(10 * s);
    const targetY = floorStone(ride.to).topY;
    world.tower.setPlatformY(targetY, bump);
    world.wanderer.root.position.set(0, targetY + bump, 0);
    if (ride.settle >= SETTLE) depart();
  }

  if (world) {
    world.update(dt, t);
    world.render();
  }
}

export const input = {
  onAnyKey() {
    if (ride && ride.phase !== 'done') finishNow();
  },
  onPointerDown() {
    if (ride && ride.phase !== 'done') finishNow();
  },
};
