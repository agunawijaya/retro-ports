/**
 * @file Batu Catatan — the records stele (GAME-DESIGN §7.9): one tab per
 * floor, ten rows of best moves and pushes; in Dupa mode also shows best time.
 * Tab / ↑ ↓ switches mode, ← → floors.
 */

import { getProgress } from '../state/progress.js';
import { el, createCard } from '../ui/veil.js';
import { roman, two } from '../world/tower-views.js';

let ctx = null;
let card = null;
let tab = 1;
let mode = 'bebas';
let tabs = [];
let modeBtn = null;
let rows = null;
let subhead = null;

function formatTime(ms) {
  if (ms == null) return '--:--';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function enter(c, params = {}) {
  ctx = c;
  const p = getProgress();
  tab = Math.min(5, Math.max(1, Math.ceil((p.lastRoom || 1) / 10)));
  mode = params.mode ?? 'bebas';
  card = createCard('stele');
  const strip = el('div', 'tabs');
  tabs = [1, 2, 3, 4, 5].map((f) => {
    const b = el('button', 'tab', roman(f));
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      show(f, mode);
    });
    strip.appendChild(b);
    return b;
  });

  modeBtn = el('button', 'tab gap', mode === 'dupa' ? 'tanpa batas' : 'dupa');
  modeBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    toggleMode();
  });
  strip.appendChild(modeBtn);

  subhead = el('div', 'card-hint');
  rows = el('div', 'rows');
  card.inner.append(el('div', 'headline', 'Batu Catatan'), strip, subhead, rows);
  card.root.addEventListener('pointerdown', (e) => {
    if (e.target === card.root) ctx.router.close();
  });
  show(tab, mode);
}

function toggleMode() {
  mode = mode === 'bebas' ? 'dupa' : 'bebas';
  show(tab, mode);
}

export function setMode(newMode) {
  mode = newMode;
  show(tab, mode);
}

function show(f, m = mode) {
  tab = f;
  mode = m;
  tabs.forEach((b, i) => b.classList.toggle('sel', i + 1 === f));
  if (modeBtn) {
    modeBtn.classList.toggle('sel', mode === 'dupa');
    modeBtn.textContent = mode === 'dupa' ? 'tanpa batas' : 'dupa';
  }
  subhead.textContent = `lantai ${roman(f)} · ${mode === 'dupa' ? 'dupa' : 'tanpa batas'}`;
  const solved = getProgress().solved ?? {};
  rows.replaceChildren(
    ...Array.from({ length: 10 }, (_, i) => {
      const n = (f - 1) * 10 + i + 1;
      const rec = solved[n]?.[mode];
      const row = el('div', 'row');
      row.appendChild(el('span', 'room', `ruang ${two(n)}`));
      const right = el('span');
      if (rec) {
        if (mode === 'dupa') {
          right.append(
            el('b', '', String(rec.steps)),
            document.createTextNode(' langkah · '),
            el('b', '', String(rec.pushes)),
            document.createTextNode(' dorongan · '),
            el('b', '', formatTime(rec.timeMs)),
          );
        } else {
          right.append(
            el('b', '', String(rec.steps)),
            document.createTextNode(' langkah · '),
            el('b', '', String(rec.pushes)),
            document.createTextNode(' dorongan'),
          );
        }
      } else {
        right.textContent = '—';
      }
      row.appendChild(right);
      return row;
    }),
  );
}

export function exit() {
  card?.dispose();
  card = null;
  ctx = null;
}

export function update() {}

export const input = {
  onDirection(d) {
    if (d === 1) show(tab === 5 ? 1 : tab + 1); // Right
    else if (d === 3) show(tab === 1 ? 5 : tab - 1); // Left
    else if (d === 0 || d === 2) toggleMode(); // Up / Down
  },
  onAnyKey(code) {
    if (code === 'Tab') toggleMode();
  },
  onBack: () => ctx.router.close(),
  onConfirm: () => ctx.router.close(),
};
