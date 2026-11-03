/**
 * @file Jeda — pause (ART-DIRECTION §13.8): the canvas loses a little colour
 * over 0.6 s, the wanderer sits down, and a veiled list waits.
 */

import * as room from './room.js';
import { el, createCard, createChoices } from '../ui/veil.js';

let ctx = null;
let card = null;
let choices = null;

export function enter(c) {
  ctx = c;
  ctx.canvas.classList.add('paused');
  room.setPaused(true);
  const n = room.currentRoom();
  const resume = () => ctx.router.close();
  card = createCard();
  choices = createChoices(
    [
      { label: 'lanjutkan', run: resume },
      { label: 'ulangi ruang', run: () => { ctx.router.close(); room.restart(); } },
      { label: 'kembali ke menara', run: () => ctx.router.goto('floor', { floor: Math.ceil(n / 10), room: n }) },
      { label: 'suara', run: () => ctx.router.open('settings', { from: 'pause' }) },
    ],
    { vertical: true },
  );
  card.inner.append(el('div', 'headline', 'jeda'), choices.root);
}

export function exit() {
  ctx?.canvas.classList.remove('paused');
  room.setPaused(false);
  card?.dispose();
  card = null;
  choices = null;
  ctx = null;
}

export function update() {}

export const input = {
  onDirection(d) {
    if (d === 0) choices.move(-1);
    else if (d === 2) choices.move(1);
  },
  onConfirm: () => choices.pick(),
  onSkip: () => choices.pick(),
  onBack: () => ctx.router.close(),
  onPause: () => ctx.router.close(),
};
