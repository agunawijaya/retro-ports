/**
 * @file The room's HUD and veils (reference HUD and overlays,
 * ART-DIRECTION §12): wordmark and place line, tool buttons, counters, hint,
 * the "ketuk untuk mulai" veil and the results veil. The mood keeps the ink.
 */

import './hud.css';
import { ICONS } from './icons.js';
import { onMoodApplied } from '../render/moods.js';
import cormorant300 from '../assets/fonts/cormorant-garamond-300.woff2';
import cormorant300italic from '../assets/fonts/cormorant-garamond-300italic.woff2';
import cormorant400 from '../assets/fonts/cormorant-garamond-400.woff2';
import cormorant400italic from '../assets/fonts/cormorant-garamond-400italic.woff2';
import cormorant500 from '../assets/fonts/cormorant-garamond-500.woff2';
import jost300 from '../assets/fonts/jost-300.woff2';
import jost400 from '../assets/fonts/jost-400.woff2';
import jost500 from '../assets/fonts/jost-500.woff2';

// Fonts ship with the game (src/assets/fonts), imported as modules so Vite
// inlines them (as data URIs in the built single file, as dev-server URLs
// otherwise) instead of fetching a separate file at runtime.
const FONT_FACES = [
  ['Cormorant Garamond', 300, 'normal', cormorant300],
  ['Cormorant Garamond', 300, 'italic', cormorant300italic],
  ['Cormorant Garamond', 400, 'normal', cormorant400],
  ['Cormorant Garamond', 400, 'italic', cormorant400italic],
  ['Cormorant Garamond', 500, 'normal', cormorant500],
  ['Jost', 300, 'normal', jost300],
  ['Jost', 400, 'normal', jost400],
  ['Jost', 500, 'normal', jost500],
];

function installFonts() {
  if (document.getElementById('hening-fonts')) return;
  const css = FONT_FACES.map(([family, weight, style, url]) => {
    return `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};font-display:swap;src:url("${url}") format("woff2");}`;
  }).join('\n');
  const style = document.createElement('style');
  style.id = 'hening-fonts';
  style.textContent = css;
  document.head.appendChild(style);
}

const TOOL_TITLES = {
  undo: 'Mundur (Z)',
  restart: 'Ulangi (R)',
  rotate: 'Putar pandangan (E)',
  sound: 'Suara (M)',
};

const HINT = '← ↑ → ↓ atau ketuk ubin · Z mundur · R ulang · Q / E putar · esc jeda';

function el(tag, attrs = {}, html = '') {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (html) node.innerHTML = html;
  return node;
}

export function createHud() {
  installFonts();
  const nodes = [];
  const mount = (node) => {
    document.body.appendChild(node);
    nodes.push(node);
    return node;
  };

  const title = mount(el('div', { id: 'title-block', class: 'hud' }));
  title.append(el('div', { class: 'word' }, 'Hening'));
  const place = el('div', { class: 'place', id: 'place' });
  title.append(place);

  const tools = mount(el('div', { id: 'tools', class: 'hud' }));
  const toolButtons = {};
  // One handler per tool; a room that loads again replaces it instead of stacking a second.
  const toolHandlers = {};
  for (const name of ['undo', 'restart', 'rotate', 'sound']) {
    const b = el('button', { class: 'round', id: `btn-${name}`, title: TOOL_TITLES[name], 'aria-label': TOOL_TITLES[name] }, ICONS[name]);
    b.addEventListener('click', () => toolHandlers[name]?.());
    tools.append(b);
    toolButtons[name] = b;
  }

  const hint = mount(el('div', { id: 'hint', class: 'hud' }));
  hint.textContent = HINT;

  const counters = mount(el('div', { id: 'counters', class: 'hud' }));
  const steps = el('b', { id: 'c-steps' }, '0');
  const pushes = el('b', { id: 'c-pushes' }, '0');
  const lit = el('b', { id: 'c-lit' }, '0/0');
  const litLabel = document.createTextNode('lentera');
  const span = (b, label) => {
    const s = el('span');
    s.append(b, typeof label === 'string' ? document.createTextNode(label) : label);
    return s;
  };
  counters.append(span(steps, 'langkah'), span(pushes, 'dorongan'), span(lit, litLabel));

  // The incense stick (ART-DIRECTION §13.7): a 2 px line in the mood's ink,
  // a glowing ember with a halo at its tip, a slow smoke curl above it, and
  // ash flakes that drop as the burn passes each quarter mark.
  const dupaStick = mount(el('div', { id: 'dupa-stick', class: 'hud off' }));
  dupaStick.innerHTML = `
    <div class="dupa-track">
      <div class="dupa-line"></div>
      <div class="dupa-flake k90"></div>
      <div class="dupa-flake k60"></div>
      <div class="dupa-flake k30"></div>
      <div class="dupa-ember"></div>
      <svg class="dupa-smoke" width="28" height="60" viewBox="0 0 28 60" aria-hidden="true">
        <path d="M14 58 C19 49 8 44 13 34 C17 26 9 22 14 12 C16 8 15 5 13 2" pathLength="60" />
      </svg>
    </div>
    <div class="dupa-time">20:00</div>
  `;
  const dupaLine = dupaStick.querySelector('.dupa-line');
  const dupaEmber = dupaStick.querySelector('.dupa-ember');
  const dupaSmoke = dupaStick.querySelector('.dupa-smoke');
  const dupaTime = dupaStick.querySelector('.dupa-time');
  const dupaFlakes = [...dupaStick.querySelectorAll('.dupa-flake')];
  const FLAKE_MARKS = [90, 60, 30];

  // The ember and its halo burn in the mood's glow, like every other light.
  const offMood = onMoodApplied((m) => {
    const root = document.documentElement.style;
    root.setProperty('--glow', `#${m.glow.getHexString()}`);
    const c = m.glow;
    root.setProperty(
      '--glow-soft',
      `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, .55)`,
    );
  });

  const start = mount(el('div', { id: 'start', class: 'veil hidden' }));
  start.innerHTML = '<div><div class="big">Hening</div><div class="sub">ketuk untuk mulai</div></div>';

  const win = mount(el('div', { id: 'win', class: 'veil hidden' }));
  win.innerHTML = '<div><div class="line"></div><div class="stats" id="win-stats"></div><div class="sub"></div></div>';
  const [winLine, winStats, winNext] = win.firstChild.children;

  let onStart = null;
  start.addEventListener('pointerdown', () => onStart?.());

  return {
    setPlace(text) {
      place.textContent = text;
    },
    setCounters({ steps: s, pushes: p, lit: l, total, label }) {
      steps.textContent = s;
      pushes.textContent = p;
      lit.textContent = `${l}/${total}`;
      if (label) litLabel.textContent = label;
    },
    showStart(fn) {
      onStart = fn;
      start.classList.remove('hidden');
    },
    hideStart() {
      start.classList.add('hidden');
    },
    showResults({ line, stats, next }) {
      winLine.textContent = line;
      winStats.textContent = stats;
      winNext.textContent = next;
      win.classList.remove('hidden');
    },
    hideResults() {
      win.classList.add('hidden');
    },
    onTool(name, fn) {
      toolHandlers[name] = fn;
    },
    /**
     * Toggles `#title-block`/`#tools`/`#counters`/`#hint` on or off via a
     * `.off` class (opacity: 0 + pointer-events: none), so it eases with the
     * `.hud` rule's own opacity transition instead of snapping. A missing
     * key leaves that element's visibility unchanged.
     * @param {{ title?: boolean, tools?: boolean, counters?: boolean, hint?: boolean }} vis
     */
    setVisible(vis = {}) {
      const apply = (el, on) => {
        if (on === undefined) return;
        el.classList.toggle('off', !on);
      };
      apply(title, vis.title);
      apply(tools, vis.tools);
      apply(counters, vis.counters);
      apply(hint, vis.hint);
    },
    setSoundOn(on) {
      toolButtons.sound.style.opacity = on ? 1 : 0.45;
    },
    /**
     * The burning state of the stick: `timeMs` left of `totalMs`. The line
     * shortens linearly, the ember and smoke ride its tip, a flake drops as
     * the burn passes each quarter, and the last minute breathes at 1 Hz.
     */
    setDupaTime(timeMs, totalMs) {
      const remaining = Math.max(0, timeMs);
      const frac = totalMs > 0 ? Math.min(1, remaining / totalMs) : 0;
      const height = Math.round(frac * 120);
      dupaLine.style.height = `${height}px`;
      dupaEmber.style.bottom = `${height}px`;
      dupaSmoke.style.bottom = `${Math.max(0, height - 4)}px`;

      dupaFlakes.forEach((flake, i) => {
        flake.classList.toggle('fallen', height < FLAKE_MARKS[i]);
      });

      dupaEmber.classList.toggle('pulse', remaining <= 60000 && remaining > 0);
      dupaStick.classList.toggle('out', remaining <= 0 && totalMs > 0);

      const sec = Math.ceil(remaining / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      dupaTime.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },
    setDupaVisible(visible) {
      dupaStick.classList.toggle('off', !visible);
    },
    dispose() {
      offMood();
      for (const n of nodes) n.remove();
      nodes.length = 0;
    },
  };
}
