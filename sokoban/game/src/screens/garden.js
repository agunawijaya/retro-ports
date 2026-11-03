/**
 * @file Taman Sendiri — slot list (GAME-DESIGN §7.8, ART-DIRECTION §13.10).
 * Fifty personal garden slots, with plaque statuses and records.
 */

import { getGarden, clearSlot, copySlot } from '../state/garden.js';
import { parseLevel, validateLevel } from '../core/level.js';
import { el, createCard, createChoices } from '../ui/veil.js';
import { two } from '../world/tower-views.js';

let ctx = null;
let card = null;
let selected = 0;
let plaqueElements = [];
let menuActive = false;
let menuElement = null;
let menuChoices = null;

/** A slot's shown state: kosong, belum lengkap, siap or teruji (§7.8). */
function slotStatus(slotData) {
  if (!slotData || !slotData.rows || slotData.rows.length === 0) {
    return { status: 'kosong', ready: false };
  }
  try {
    const lvl = parseLevel(slotData.rows);
    const valid = validateLevel(lvl);
    if (!valid.ok) {
      return { status: 'belum lengkap', ready: false };
    }
    if (slotData.tested) {
      return { status: 'teruji', ready: true };
    }
    return { status: 'siap', ready: true };
  } catch {
    return { status: 'belum lengkap', ready: false };
  }
}

/** One stone plaque: its number, its status, and its best record if any. */
function createPlaque(index, slotData) {
  const root = el('div', 'garden-plaque');
  const num = el('div', 'plaque-num', `taman ${two(index + 1)}`);
  const info = slotStatus(slotData);
  const statusEl = el('div', `plaque-status status-${info.status.replace(/\s+/g, '-')}`, info.status);
  root.append(num, statusEl);

  if (slotData && slotData.record) {
    const recEl = el('div', 'plaque-record', `${slotData.record.steps} langkah · ${slotData.record.pushes} dorongan`);
    root.appendChild(recEl);
  }

  root.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (selected === index) {
      openPlaqueMenu();
    } else {
      selectPlaque(index);
    }
  });

  return { root, index, ready: info.ready };
}

export function enter(c, params = {}) {
  ctx = c;
  selected = params.selectedSlot ?? 0;
  menuActive = false;

  card = createCard('garden-list-card');
  const title = el('div', 'headline', 'Taman Sendiri');
  const scrollArea = el('div', 'garden-scroll-area');
  const grid = el('div', 'garden-grid');

  const g = getGarden();
  plaqueElements = g.slots.map((slotData, i) => {
    const p = createPlaque(i, slotData);
    grid.appendChild(p.root);
    return p;
  });

  scrollArea.appendChild(grid);
  const hint = el('div', 'card-hint', '↑ ↓ ← → pilih · enter menu · esc kembali');
  card.inner.append(title, scrollArea, hint);

  card.root.addEventListener('pointerdown', (e) => {
    if (e.target === card.root) {
      if (menuActive) closeMenu();
      else ctx.router.goto('courtyard', { at: 'paviliun' });
    }
  });

  selectPlaque(selected);
}

function selectPlaque(index) {
  selected = Math.max(0, Math.min(49, index));
  plaqueElements.forEach((p, i) => {
    p.root.classList.toggle('selected', i === selected);
  });
  plaqueElements[selected]?.root.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/** The plaque's own little veil menu: ubah, main, salin ke…, kosongkan. */
function openPlaqueMenu() {
  if (menuActive) closeMenu();
  menuActive = true;
  const p = plaqueElements[selected];
  const g = getGarden();
  const slotData = g.slots[selected];
  const info = slotStatus(slotData);

  menuElement = el('div', 'plaque-menu');
  const menuTitle = el('div', 'menu-title', `taman ${two(selected + 1)}`);
  menuElement.appendChild(menuTitle);

  const items = [
    { label: 'ubah', run: () => ctx.router.goto('garden-editor', { slot: selected }) },
  ];
  if (info.ready) {
    items.push({
      label: 'main',
      run: () => ctx.router.goto('room', { garden: true, main: true, slot: selected, rows: slotData.rows }),
    });
  }
  items.push({ label: 'salin ke…', run: copyToFirstEmpty });
  if (slotData && slotData.rows && slotData.rows.length > 0) {
    items.push({ label: 'kosongkan', run: askClear });
  }

  menuChoices = createChoices(items, { vertical: true });
  menuElement.appendChild(menuChoices.root);
  p.root.appendChild(menuElement);
}

function closeMenu() {
  menuElement?.remove();
  menuElement = null;
  menuChoices = null;
  menuActive = false;
}

function askClear() {
  menuElement.innerHTML = '';
  const confirmText = el('div', 'menu-confirm-text', `kosongkan taman ${two(selected + 1)}?`);
  menuElement.appendChild(confirmText);
  const items = [
    { label: 'ya', run: () => { clearSlot(selected); refresh(); } },
    { label: 'tidak', run: closeMenu },
  ];
  menuChoices = createChoices(items);
  menuElement.appendChild(menuChoices.root);
}

function copyToFirstEmpty() {
  const g = getGarden();
  const emptyIndex = g.slots.findIndex((s, idx) => idx !== selected && (!s || !s.rows || s.rows.length === 0));
  if (emptyIndex !== -1) {
    copySlot(selected, emptyIndex);
    refresh();
    selectPlaque(emptyIndex);
  }
}

function refresh() {
  closeMenu();
  const g = getGarden();
  plaqueElements.forEach((p, i) => {
    const updated = createPlaque(i, g.slots[i]);
    p.root.replaceWith(updated.root);
    plaqueElements[i] = updated;
  });
  selectPlaque(selected);
}

export function exit() {
  card?.dispose();
  card = null;
  plaqueElements = [];
  menuElement = null;
  ctx = null;
}

export function update() {}

export function inspect() {
  const g = getGarden();
  return {
    selected,
    menuActive,
    status: slotStatus(g.slots[selected]).status,
  };
}

export const input = {
  onDirection(d) {
    if (menuActive && menuChoices) {
      if (d === 0) menuChoices.move(-1);
      else if (d === 2) menuChoices.move(1);
      else if (d === 1) menuChoices.move(1);
      else if (d === 3) menuChoices.move(-1);
      return;
    }
    // 0: up, 1: right, 2: down, 3: left
    if (d === 0) selectPlaque(selected - 5);
    else if (d === 2) selectPlaque(selected + 5);
    else if (d === 1) selectPlaque(selected + 1);
    else if (d === 3) selectPlaque(selected - 1);
  },
  onConfirm() {
    if (menuActive && menuChoices) menuChoices.pick();
    else openPlaqueMenu();
  },
  onBack() {
    if (menuActive) closeMenu();
    else ctx.router.goto('courtyard', { at: 'paviliun' });
  },
};
