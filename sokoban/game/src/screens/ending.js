/**
 * @file Akhir — the ending (ART-DIRECTION §13.12, GAME-DESIGN §8): the platform
 * rises past Lantai V to stop beside the capstone; the wanderer steps across;
 * the lone theme object lights as he passes; he sits beside the figure in black,
 * who turns his head; the 6 s pull-back to the whole stack with five lit rims;
 * fade to Fajar and "Hening"; back to the courtyard. Skippable at any point.
 */

import * as THREE from 'three';
import { setMoodPosition } from '../render/moods.js';
import { ROOF } from '../render/tower.js';
import { getProgress } from '../state/progress.js';
import { getTowerWorld } from '../world/tower-world.js';
import { endingView, titleView } from '../world/tower-views.js';
import { capstone, AXIS_STEP, niche } from '../world/stone-layout.js';
import { MEDITATE_AFTER } from '../world/wanderer.js';
import { el } from '../ui/veil.js';

const HOLD = 6;
const DAWN = 3.6;

let ctx = null;
let world = null;
let phase = 'walking';
let clock = 0;
let sitAt = 0;
let dawnAt = 0;
let dawn = null;
let moteTimer = 0;
let capObjectLit = false;

export function enter(c) {
  ctx = c;
  clock = 0;
  phase = 'walking';
  capObjectLit = false;
  world = getTowerWorld(ctx.canvas);
  const p = getProgress();
  if (world.progress !== p) world.setProgress(p);

  const t = world.tower;
  t.setFocusFloor(null);
  for (let k = 0; k <= ROOF; k++) t.setLevelPresence(k, 1);
  for (let k = 1; k <= 5; k++) t.setBandLit(k, true);
  t.setPlatformLevel(ROOF);
  world.hover.visible = false;
  setMoodPosition(3, false); // Malam

  world.setView(endingView());

  const cap = capstone();
  // Stranger sits on the capstone rim facing the view
  const strangerYaw = Math.PI / 4;
  const strangerSeat = new THREE.Vector3(
    cap.centre.x + Math.sin(strangerYaw) * (cap.R - 0.05),
    cap.topY + 0.05,
    cap.centre.z + Math.cos(strangerYaw) * (cap.R - 0.05),
  );
  const stranger = world.seatRoofStranger({ pos: strangerSeat, yaw: strangerYaw });
  stranger.look.follow = 0;

  // The wanderer sits beside the stranger on the capstone edge
  const wandererYaw = strangerYaw - 0.28;
  const wandererSeat = new THREE.Vector3(
    cap.centre.x + Math.sin(wandererYaw) * (cap.R - 0.05),
    cap.topY,
    cap.centre.z + Math.cos(wandererYaw) * (cap.R - 0.05),
  );

  // From the platform at (0, 14.4, 0), across to capstone center, then to edge
  world.snapWalk();
  const w = world.wanderer;
  w.setOpacity(1);
  w.fadeTo = 1;
  w.cancelAction();
  w.root.position.set(0, cap.topY, 0);

  world.walkPath(
    [
      new THREE.Vector3(cap.centre.x * 0.35, cap.topY, cap.centre.z * 0.35),
      new THREE.Vector3(cap.centre.x, cap.topY, cap.centre.z),
      wandererSeat,
    ],
    {
      pace: 0.42,
      onDone: () => sitDown(wandererSeat, wandererYaw),
    },
  );

  ctx.hud.setVisible({ title: false, tools: false, counters: false, hint: false });
}

function sitDown(seat, yaw) {
  const w = world.wanderer;
  w.root.position.copy(seat);
  w.yaw = yaw;
  w.idle = MEDITATE_AFTER;
  phase = 'sitting';
  sitAt = clock;

  // The figure in black turns its head toward the wanderer
  const s = world.seatRoofStranger();
  s.look.follow = 999;
  s.lookIn = 999;

  // 6 s pull-back of camera to the whole stack with 5 lit rims (§13.12)
  world.moveView(titleView(), 6.0);
}

let dawnHold = DAWN + 2.4;

function toDawn(fast = false) {
  if (phase === 'dawn' || phase === 'done') return;
  phase = 'dawn';
  dawnAt = clock;
  dawnHold = fast ? 2.2 : DAWN + 2.4;
  dawn = el('div', 'dawn');
  const word = el('div', 'big', 'Hening');
  dawn.appendChild(word);
  if (fast) {
    dawn.style.transitionDuration = '0.8s';
    word.style.transition = 'opacity 0.8s ease 0.4s';
  }
  document.body.appendChild(dawn);
  requestAnimationFrame(() => requestAnimationFrame(() => dawn.classList.add('on')));
}

/** Under the dawn: back to the courtyard, then let the dawn go. */
function home() {
  phase = 'done';
  const veil = dawn;
  ctx.router.goto('courtyard', {}, { instant: true });
  if (veil) {
    setTimeout(() => {
      veil.style.transitionDuration = '1.6s';
      veil.classList.remove('on');
      setTimeout(() => veil.remove(), 1700);
    }, 60);
  }
}

export function exit() {
  ctx = null;
  world = null;
  dawn = null;
}

export function update(dt, t) {
  clock += dt;

  // Check if wanderer passed the capstone center: lights the lone theme object (§13.12)
  if (!capObjectLit && world) {
    const cap = capstone();
    const wp = world.wanderer.root.position;
    const dToCenter = Math.hypot(wp.x - cap.centre.x, wp.z - cap.centre.z);
    if (dToCenter < 0.6) {
      capObjectLit = true;
      world.tower.capstoneObject?.setLit(true);
      ctx?.sound?.bell(73.42, 0.12);
    }
  }

  // 6 s pull-back + 6 s hold = 12 s before dawn transition
  if (phase === 'sitting' && clock - sitAt > 6 + HOLD) toDawn();
  if (phase === 'dawn' && clock - dawnAt > dawnHold) home();
  if (!world) return;

  // Motes rising from every floor of the tower
  moteTimer += dt;
  if (moteTimer > 0.12) {
    moteTimer = 0;
    const floor = 1 + Math.floor(Math.random() * 5);
    const n = niche(floor, Math.floor(Math.random() * 10));
    world.fx.mote(n.object.x, floor * AXIS_STEP + 0.6, n.object.z);
  }

  world.update(dt, t);
  world.render();
}

export const input = {
  onAnyKey() {
    if (phase === 'dawn') home();
    else if (phase !== 'done') toDawn(true);
  },
  onPointerDown() {
    if (phase === 'dawn') home();
    else if (phase !== 'done') toDawn(true);
  },
};
