/**
 * @file A single veiled line for a place that is not ready yet — the
 * Paviliun Taman until the garden arrives (prompt 03). Any key closes it.
 */

import { el, createCard, createChoices } from '../ui/veil.js';

let ctx = null;
let card = null;

/** @param {{ text: string }} params */
export function enter(c, params = {}) {
  ctx = c;
  card = createCard();
  const back = createChoices([{ label: 'kembali', run: () => ctx.router.close() }]);
  card.inner.append(el('div', 'headline small', params.text ?? ''), back.root);
  card.root.addEventListener('pointerdown', () => ctx.router.close());
}

export function exit() {
  card?.dispose();
  card = null;
  ctx = null;
}

export function update() {}

export const input = {
  onConfirm: () => ctx.router.close(),
  onSkip: () => ctx.router.close(),
  onBack: () => ctx.router.close(),
};
