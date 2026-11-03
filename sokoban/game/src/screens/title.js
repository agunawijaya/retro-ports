/**
 * @file Judul — the title (ART-DIRECTION §13.1, GAME-DESIGN §7.1): the whole
 * tower in morning cloud, the wanderer meditating at its foot, "Hening" and
 * "ketuk untuk mulai" exactly as the room's start veil. The first gesture
 * starts the audio and the camera descends into the courtyard — the same
 * scene, no cut.
 */

import { setMoodPosition } from '../render/moods.js';
import { getProgress } from '../state/progress.js';
import { getTowerWorld } from '../world/tower-world.js';
import { titleView } from '../world/tower-views.js';
import { COURTYARD_START } from '../world/places.js';
import { MEDITATE_AFTER } from '../world/wanderer.js';

let ctx = null;
let world = null;
let started = false;
let classTimer = 0;

const startVeil = () => document.getElementById('start');

/** The tower as it stands outside: every level in place, nothing in focus. */
export function showWholeTower(w) {
  w.tower.setFocusFloor(null);
  for (let k = 0; k <= 6; k++) w.tower.setLevelPresence(k, 1);
  for (let k = 0; k < 6; k++) for (let s = 0; s < 4; s++) w.tower.setBandFold(k, s, 0);
  w.tower.setPlatformLevel(0);
  w.hover.visible = false;
}

export function enter(c) {
  ctx = c;
  started = false;
  world = getTowerWorld(ctx.canvas);
  world.setProgress(getProgress());
  showWholeTower(world);
  setMoodPosition(0, true);
  world.setView(titleView());

  // Finish any walk first: its end may fade the wanderer, and this screen shows them.
  world.snapWalk();
  const w = world.wanderer;
  w.root.position.set(COURTYARD_START.c - 4, 0, COURTYARD_START.r - 4);
  w.setOpacity(1);
  w.fadeTo = 1;
  w.cancelAction();
  w.idle = MEDITATE_AFTER + 2;
  world.faceCamera();
  w.shownYaw = w.yaw;

  ctx.hud.setVisible({ title: false, tools: false, counters: false, hint: false });
  clearTimeout(classTimer);
  startVeil()?.classList.add('title-screen');
  ctx.hud.showStart(begin);
}

/** First gesture: sound, the veil lifts, the wanderer stands, the camera comes down. */
function begin() {
  if (started) return;
  started = true;
  ctx.sound.start();
  ctx.hud.hideStart();
  ctx.router.goto('courtyard', { descend: true }, { instant: true });
}

export const input = {
  onAnyKey: begin,
  onPointerDown: begin,
};

export function update(dt, t) {
  world.update(dt, t);
  world.render();
}

export function resize() {
  world?.setView(titleView());
}

export function exit() {
  // Left without the first gesture (the path back, a test): the words go too.
  if (!started) ctx.hud.hideStart();
  // The words keep their place while the veil fades (1.4 s), then step back.
  classTimer = setTimeout(() => startVeil()?.classList.remove('title-screen'), 1500);
  ctx = null;
  world = null;
}
