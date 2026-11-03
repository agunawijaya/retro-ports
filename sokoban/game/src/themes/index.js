/**
 * @file The theme registry (ARCHITECTURE §7.2). A theme changes only the
 * object, the target, the lit effect, the instrument and the push sound;
 * adding one = one new file + one register line here.
 */

import { lentera } from './lentera.js';
import { bintang } from './bintang.js';
import { batu } from './batu.js';
import { candi } from './candi.js';
import { mataAir } from './mata-air.js';
import { PENTATONIC } from './scales.js';

export { PENTATONIC, SLENDRO, SLENDRO_RATIOS, D4 } from './scales.js';

const registry = new Map();

export function registerTheme(def) {
  registry.set(def.id, def);
}

/** @param {string} [id] unknown ids fall back to Lentera */
export function getTheme(id = 'lentera') {
  return registry.get(id) ?? registry.get('lentera');
}

export const themeIds = () => [...registry.keys()];

/** The notes handed to targets in reading order; they wrap after the last. */
export const notesFor = (theme) => theme?.scale ?? PENTATONIC;

registerTheme(lentera);
registerTheme(bintang);
registerTheme(batu);
registerTheme(candi);
registerTheme(mataAir);

