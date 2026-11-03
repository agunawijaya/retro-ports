/**
 * @file Selesai — the results card after a room's departure (GAME-DESIGN
 * §7.6, ART-DIRECTION §13.11). The theme's solved line, the counters,
 * `rekor baru` when a record falls, and three choices; after the tenth room
 * of a floor, "ruang berikutnya" rides the elevator up first; after room 50
 * there is only "naik".
 */

import * as room from './room.js';
import { el, createCard, createChoices } from '../ui/veil.js';

let ctx = null;
let card = null;
let choices = null;
let currentParams = null;

function formatTime(ms) {
  if (ms == null) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * @param {{ room: number, steps: number, pushes: number, timeMs?: number, mode?: string,
 *   isRecord?: boolean, newlyLitFloor?: number|null, solvedLine: string,
 *   garden?: boolean, coba?: boolean, slot?: number }} params
 */
export function enter(c, params) {
  ctx = c;
  currentParams = params;
  const n = params.room;
  const floor = Math.ceil(n / 10);

  card = createCard();
  const statsLine = params.mode === 'dupa' && params.timeMs != null
    ? `${params.steps} langkah · ${params.pushes} dorongan · ${formatTime(params.timeMs)}`
    : `${params.steps} langkah · ${params.pushes} dorongan`;

  card.inner.append(
    el('div', 'headline', params.solvedLine),
    el('div', 'stats', statsLine),
  );
  if (params.isRecord) card.inner.append(el('div', 'record', 'rekor baru'));

  let items = [];

  if (params.garden) {
    if (params.coba) {
      items = [
        { label: 'kembali', run: () => ctx.router.goto('garden-editor', { slot: params.slot, resume: true }) },
        { label: 'ulangi', run: () => { ctx.router.close(); room.replay(); } },
      ];
    } else {
      items = [
        { label: 'ulangi', run: () => { ctx.router.close(); room.replay(); } },
        { label: 'kembali ke taman', run: () => ctx.router.goto('garden') },
      ];
    }
  } else {
    const next = () => {
      if (n % 10 === 0) {
        ctx.router.goto(
          'elevator',
          { from: floor, to: floor + 1, then: 'floor', room: n + 1, litFloor: params.newlyLitFloor ?? null },
          { crossfade: 0.8 },
        );
      } else {
        ctx.router.goto('room', { room: n + 1 }, { crossfade: 0.8 });
      }
    };
    const again = () => {
      ctx.router.close();
      room.replay();
    };
    const tower = () => ctx.router.goto('floor', { floor, room: n });
    const up = () => ctx.router.goto('elevator', { from: 5, to: 6, then: 'ending', litFloor: params.newlyLitFloor ?? 5 }, { crossfade: 0.8 });

    items = n >= 50
      ? [{ label: 'naik', run: up }]
      : [
        { label: 'ruang berikutnya', run: next },
        { label: 'ulangi', run: again },
        { label: 'menara', run: tower },
      ];
  }

  choices = createChoices(items);
  card.inner.append(choices.root);
}

export function exit() {
  card?.dispose();
  card = null;
  choices = null;
  ctx = null;
  currentParams = null;
}

export function update() {}

export const input = {
  onDirection(d) {
    if (d === 1) choices.move(1);
    else if (d === 3) choices.move(-1);
  },
  onConfirm: () => choices.pick(),
  onSkip: () => choices.pick(),
  onBack() {
    if (currentParams?.garden) {
      if (currentParams.coba) ctx.router.goto('garden-editor', { slot: currentParams.slot, resume: true });
      else ctx.router.goto('garden');
    } else {
      ctx.router.goto('floor', { floor: Math.ceil((currentParams?.room ?? 1) / 10), room: currentParams?.room ?? 1 });
    }
  },
};
