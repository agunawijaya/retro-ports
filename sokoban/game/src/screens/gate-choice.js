/**
 * @file Pilihan jalan di Gerbang Menara (GAME-DESIGN §5, ART-DIRECTION §13.3).
 * Choice between Dupa and Tanpa Batas before the elevator ride.
 */

import { getSettings } from '../state/settings.js';
import { el, createCard } from '../ui/veil.js';

let ctx = null;
let card = null;
let currentSelection = 0; // 0: dupa, 1: bebas
let lastChoice = null;

// The two little ink drawings above the labels: a standing incense stick
// with a curl of smoke for dupa, an open ensō circle for tanpa batas
// (ART-DIRECTION §13.3). Drawn as filled brush strokes, tapering like ink.

/** A ring sector filled path: a brush stroke from `a0` to `a1` degrees, its
 *  width tapering from `w0` to `w1`, with a slight hand-drawn wobble. */
function brushArc(cx, cy, r, a0, a1, w0, w1) {
  const steps = 56;
  const outer = [];
  const inner = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const deg = a0 + (a1 - a0) * t;
    const a = (deg * Math.PI) / 180;
    // the brush wobbles a little, like a hand drawing a circle
    const wobble = 0.5 * Math.sin(t * Math.PI * 3.2) + 0.3 * Math.sin(t * Math.PI * 7.1 + 1.3);
    const w = w0 + (w1 - w0) * t;
    const rr = r + wobble;
    outer.push([cx + (rr + w / 2) * Math.cos(a), cy + (rr + w / 2) * Math.sin(a)]);
    inner.push([cx + (rr - w / 2) * Math.cos(a), cy + (rr - w / 2) * Math.sin(a)]);
  }
  const f = ([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`;
  return `M ${outer.map(f).join(' L ')} L ${inner.reverse().map(f).join(' L ')} Z`;
}

function dupaIcon() {
  return `
  <svg width="44" height="64" viewBox="0 0 44 64" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="gc-ember" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="var(--glow)" stop-opacity="0.95" />
        <stop offset="45%" stop-color="var(--glow)" stop-opacity="0.38" />
        <stop offset="100%" stop-color="var(--glow)" stop-opacity="0" />
      </radialGradient>
    </defs>
    <path d="M30 59 Q22 61.5 14 59" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity="0.45" />
    <path d="M22 58 L21.6 23" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" opacity="0.75" />
    <circle cx="21.6" cy="20.6" r="7.5" fill="url(#gc-ember)" />
    <circle cx="21.6" cy="20.6" r="2.3" fill="var(--glow)" />
    <path d="M21.8 17.5 C25.5 13.5 18.6 11 22.2 5.6" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.5" />
  </svg>`;
}

function ensoIcon() {
  // one breath of a brush: thick at the head, thinning to an open tail
  const d = brushArc(22, 30, 15.5, -108, 196, 4.6, 0.9);
  return `
  <svg width="44" height="64" viewBox="0 0 44 64" fill="none" aria-hidden="true">
    <path d="${d}" fill="currentColor" opacity="0.82" />
  </svg>`;
}

function createChoiceItem(id, title, subline, iconType) {
  const root = el('div', `gate-choice-item choice-${id}`);
  const icon = el('div', 'gate-choice-icon');
  icon.innerHTML = iconType === 'dupa' ? dupaIcon() : ensoIcon();

  const label = el('div', 'choice-label', title);
  const sub = el('div', 'choice-subline', subline);
  root.append(icon, label, sub);
  return { root, id };
}

let items = [];

export function enter(c, params = {}) {
  ctx = c;
  const s = getSettings();
  const initialMode = lastChoice ?? s.mode ?? 'bebas';
  currentSelection = initialMode === 'dupa' ? 0 : 1;

  card = createCard('gate-choice-card');
  card.inner.style.transition = 'opacity 0.3s ease-in-out';

  const title = el('div', 'headline', 'jalan ke atas');
  const choicesContainer = el('div', 'gate-choices-row');

  items = [
    createChoiceItem('dupa', 'dupa', `${s.dupaMinutes} menit`, 'dupa'),
    createChoiceItem('bebas', 'tanpa batas', 'tanpa waktu', 'enso'),
  ];

  items.forEach((item, index) => {
    item.root.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (currentSelection === index) {
        confirmChoice();
      } else {
        currentSelection = index;
        updateSelection();
      }
    });
    choicesContainer.appendChild(item.root);
  });

  const hint = el('div', 'card-hint', '← → pilih · enter jalan · esc batal');
  card.inner.append(title, choicesContainer, hint);

  card.root.addEventListener('pointerdown', (e) => {
    if (e.target === card.root) ctx.router.close();
  });

  updateSelection();
}

function updateSelection() {
  items.forEach((item, idx) => {
    item.root.classList.toggle('selected', idx === currentSelection);
  });
}

function confirmChoice() {
  const chosenMode = currentSelection === 0 ? 'dupa' : 'bebas';
  lastChoice = chosenMode;
  if (ctx) {
    const cb = ctx.onGateChoice;
    ctx.router.close();
    if (cb) cb(chosenMode);
  }
}

export function exit() {
  card?.dispose();
  card = null;
  items = [];
  ctx = null;
}

export function update() {}

export const input = {
  onDirection(d) {
    if (d === 1) {
      currentSelection = 1;
      updateSelection();
    } else if (d === 3) {
      currentSelection = 0;
      updateSelection();
    }
  },
  onConfirm: () => confirmChoice(),
  onSkip: () => confirmChoice(),
  onBack: () => ctx?.router?.close(),
};
