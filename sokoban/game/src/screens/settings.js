/**
 * @file Kolam — preferences (GAME-DESIGN §7.10): theme, three sound levels,
 * gentle motion and the key hints. Changes apply at once and are kept.
 * Mode awal and Panjang dupa arrive with the modes (prompt 03).
 */

import { getSettings, updateSettings } from '../state/settings.js';
import { getTheme, themeIds } from '../themes/index.js';
import { el, createCard } from '../ui/veil.js';

let ctx = null;
let card = null;
let rows = [];
let sel = 0;

const STEP = 0.1;
const round = (v) => Math.round(Math.min(1, Math.max(0, v)) * 10) / 10;

/** A row of named options, the current one in full ink. */
function optionRow(label, options, get, set) {
  const root = el('div', 'pref');
  const opts = el('div', 'opts');
  const buttons = options.map(([value, text]) => {
    const b = el('button', 'opt', text);
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      set(value);
      refresh();
    });
    opts.appendChild(b);
    return { b, value };
  });
  root.append(el('span', 'label', label), opts);
  const refresh = () => buttons.forEach(({ b, value }) => b.classList.toggle('on', value === get()));
  const step = (d) => {
    const i = options.findIndex(([value]) => value === get());
    set(options[(i + d + options.length) % options.length][0]);
    refresh();
  };
  refresh();
  return { root, step, refresh };
}

/** A thin stone bar with a pebble: drag it, tap it, or ← / →. */
function sliderRow(label, key, sub = false) {
  const root = el('div', sub ? 'pref sub' : 'pref');
  const bar = el('div', 'stone-bar');
  const fill = el('div', 'fill');
  const pebble = el('div', 'pebble');
  bar.append(fill, pebble);
  root.append(el('span', 'label', label), bar);
  const get = () => getSettings().volume[key];
  const set = (v) => {
    updateSettings({ volume: { [key]: round(v) } });
    refresh();
  };
  const refresh = () => {
    const v = get();
    fill.style.width = `${v * 100}%`;
    pebble.style.left = `${v * 100}%`;
  };
  const fromPointer = (e) => {
    const r = bar.getBoundingClientRect();
    set((e.clientX - r.left) / r.width);
  };
  bar.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    bar.setPointerCapture(e.pointerId);
    fromPointer(e);
  });
  bar.addEventListener('pointermove', (e) => {
    if (bar.hasPointerCapture(e.pointerId)) fromPointer(e);
  });
  refresh();
  return { root, step: (d) => set(get() + d * STEP), refresh };
}

export function enter(c) {
  ctx = c;
  sel = 0;
  card = createCard('pond-card');
  const themes = themeIds().map((id) => [id, getTheme(id).name]);
  rows = [
    optionRow('tema', themes, () => getSettings().theme, (v) => updateSettings({ theme: v })),
    sliderRow('suara · utama', 'master'),
    sliderRow('suasana', 'ambience', true),
    sliderRow('nada', 'notes', true),
    optionRow('gerak halus', [['on', 'nyala'], ['off', 'mati'], ['system', 'ikut sistem']],
      () => getSettings().reducedMotion, (v) => updateSettings({ reducedMotion: v })),
    optionRow('petunjuk tombol', [[true, 'nyala'], [false, 'mati']],
      () => getSettings().hints, (v) => updateSettings({ hints: v })),
    optionRow('mode awal', [['bebas', 'tanpa batas'], ['dupa', 'dupa']],
      () => getSettings().mode, (v) => updateSettings({ mode: v })),
    optionRow('panjang dupa', [[10, '10 menit'], [20, '20 menit'], [30, '30 menit']],
      () => getSettings().dupaMinutes, (v) => updateSettings({ dupaMinutes: Number(v) })),
  ];
  const list = el('div', 'prefs');
  rows.forEach((r, i) => {
    r.root.addEventListener('pointerenter', () => select(i));
    list.appendChild(r.root);
  });
  card.inner.append(el('div', 'headline', 'Kolam'), list, el('div', 'card-hint', 'esc · kembali'));
  card.root.addEventListener('pointerdown', (e) => {
    if (e.target === card.root) ctx.router.close();
  });
  select(0);
}

function select(i) {
  sel = (i + rows.length) % rows.length;
  rows.forEach((r, j) => r.root.classList.toggle('sel', j === sel));
}

export function exit() {
  card?.dispose();
  card = null;
  rows = [];
  ctx = null;
}

export function update() {}

export const input = {
  onDirection(d) {
    if (d === 0) select(sel - 1);
    else if (d === 2) select(sel + 1);
    else if (d === 1) rows[sel].step(1);
    else if (d === 3) rows[sel].step(-1);
  },
  onBack: () => ctx.router.close(),
  onConfirm: () => rows[sel].step(1),
};
