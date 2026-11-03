/**
 * @file Moods, the four times of day, and their 2.4 s cross-fade
 * (reference §1, §8; ART-DIRECTION §5). All pastel; night is lavender, never black.
 */

import * as THREE from 'three';
import { light, roles } from './pastel.js';
import { waterUniforms, pondDeep } from './water.js';
import { smooth, lerp } from './math.js';
import { reducedMotion } from '../state/settings.js';

export const MOODS = [
  {
    id: 'fajar', name: 'Fajar',
    skyTop: '#b9c7e6', skyBottom: '#f7d9c4', sun: '#fff1dc', sunX: 0.78, sunY: 0.56, sunSize: 34, stars: 0,
    fog: '#f1d9cc', cloud: '#fdf1ea',
    top: '#fff7ef', left: '#efcfc6', right: '#b5aecb', under: '#9c95b8',
    floorA: '#ebd3c0', floorB: '#e4cab6', stone: '#e6d3c3', wall: '#dcc2b6', cap: '#f7ebe0',
    goal: '#f3e6d8', glow: '#ffb470', shadow: '#7d6f96', water: '#a9cdd6',
    ink: '#4a4258', inkSoft: 'rgba(74,66,88,.62)', veil: 'rgba(253,242,233,.78)',
  },
  {
    id: 'siang', name: 'Siang',
    skyTop: '#9fd0e3', skyBottom: '#f3efe0', sun: '#ffffff', sunX: 0.72, sunY: 0.16, sunSize: 26, stars: 0,
    fog: '#e3efe9', cloud: '#ffffff',
    top: '#fffffa', left: '#dcebe5', right: '#a9c3cf', under: '#90aab8',
    floorA: '#e9e0cc', floorB: '#e2d8c3', stone: '#e8e2d4', wall: '#bcd8cf', cap: '#eef6f1',
    goal: '#f5f0e6', glow: '#ffc35e', shadow: '#5f7f8f', water: '#93d1cf',
    ink: '#3b4a52', inkSoft: 'rgba(59,74,82,.6)', veil: 'rgba(250,250,244,.8)',
  },
  {
    id: 'senja', name: 'Senja',
    skyTop: '#8f80b9', skyBottom: '#f4ab90', sun: '#ffd7b0', sunX: 0.24, sunY: 0.66, sunSize: 46, stars: 0.15,
    fog: '#e8ac9d', cloud: '#fbd2c2',
    top: '#ffe5d4', left: '#efb4a2', right: '#8c83b2', under: '#71699a',
    floorA: '#eabda9', floorB: '#e2b29f', stone: '#e3b7a8', wall: '#cc9eaa', cap: '#f6dbcf',
    goal: '#f6d9c9', glow: '#ff9d55', shadow: '#5d4f80', water: '#c3a3bf',
    ink: '#463a5c', inkSoft: 'rgba(70,58,92,.62)', veil: 'rgba(252,224,210,.78)',
  },
  {
    id: 'malam', name: 'Malam',
    skyTop: '#33396c', skyBottom: '#8a7db3', sun: '#e8e6ff', sunX: 0.8, sunY: 0.18, sunSize: 18, stars: 1,
    fog: '#7b70a6', cloud: '#8d86b8',
    top: '#e2e0f4', left: '#b1abd3', right: '#706a9f', under: '#5a5487',
    floorA: '#a4a0c6', floorB: '#9c98be', stone: '#a29dc4', wall: '#8f8ab8', cap: '#c9c6e3',
    goal: '#bab6d8', glow: '#ffbb52', shadow: '#2e2a55', water: '#7873b0',
    ink: '#eeeaff', inkSoft: 'rgba(238,234,255,.66)', veil: 'rgba(52,50,100,.66)',
  },
];

const COLOR_KEYS = ['skyTop', 'skyBottom', 'sun', 'fog', 'cloud', 'top', 'left', 'right', 'under',
  'floorA', 'floorB', 'stone', 'wall', 'cap', 'goal', 'glow', 'shadow', 'water'];
const NUM_KEYS = ['sunX', 'sunY', 'sunSize', 'stars'];

export const moodState = { index: 0, position: 0, from: null, to: null, t: 1, duration: 2.4, live: null };

function snapshotMood(m) {
  const s = {};
  for (const k of COLOR_KEYS) s[k] = new THREE.Color(m[k]);
  for (const k of NUM_KEYS) s[k] = m[k];
  return s;
}

function blendMood(a, b, t) {
  const out = {};
  for (const k of COLOR_KEYS) out[k] = a[k].clone().lerp(b[k], t);
  for (const k of NUM_KEYS) out[k] = lerp(a[k], b[k], t);
  return out;
}

/**
 * The mood at a fractional position 0..3: 1.33 = 67 % Siang + 33 % Senja
 * (ART-DIRECTION §5.3).
 */
function moodAt(position) {
  const p = Math.max(0, Math.min(MOODS.length - 1, position));
  const lo = Math.floor(p);
  const hi = Math.min(MOODS.length - 1, lo + 1);
  return blendMood(snapshotMood(MOODS[lo]), snapshotMood(MOODS[hi]), p - lo);
}

/**
 * Cross-fade (2.4 s, smoothstep) to a fractional mood position.
 * @param {number} position 0 = Fajar … 3 = Malam
 * @param {boolean} [instant]
 */
export function setMoodPosition(position, instant = false) {
  const isInstant = instant || reducedMotion();
  const next = moodAt(position);
  moodState.from = moodState.to ? blendMood(moodState.from, moodState.to, smooth(moodState.t)) : next;
  moodState.to = next;
  moodState.t = isInstant ? 1 : 0;
  moodState.position = position;
  // Text cannot blend sensibly between dark ink (day) and pale ink (night),
  // so the HUD takes the ink of the nearest whole mood.
  moodState.index = Math.round(Math.max(0, Math.min(3, position)));
  const css = MOODS[moodState.index];
  const root = document.documentElement.style;
  root.setProperty('--ink', css.ink);
  root.setProperty('--ink-soft', css.inkSoft);
  root.setProperty('--veil', css.veil);
  if (isInstant) applyMood(0);
}

/** Reference-compatible: snap or fade to a whole mood 0..3 (wraps). */
export function setMood(i, instant = false) {
  setMoodPosition(((i % MOODS.length) + MOODS.length) % MOODS.length, instant);
}

const listeners = new Set();
/** Called with the live mood after every applyMood (the atmosphere tints itself here). */
export function onMoodApplied(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Advance the fade and write every shared uniform and CSS variable once. */
export function applyMood(dt) {
  if (!moodState.to) setMoodPosition(0, false);
  moodState.t = Math.min(1, moodState.t + dt / moodState.duration);
  const m = blendMood(moodState.from, moodState.to, smooth(moodState.t));
  moodState.live = m;

  light.uTop.value.copy(m.top);
  light.uLeft.value.copy(m.left);
  light.uRight.value.copy(m.right);
  light.uUnder.value.copy(m.under);
  light.uFog.value.copy(m.fog);
  for (const k in roles) roles[k].value.copy(m[k]);
  waterUniforms.uWater.value.copy(m.water);
  pondDeep.value.copy(m.water).multiplyScalar(0.72);

  const root = document.documentElement.style;
  root.setProperty('--sky-top', '#' + m.skyTop.getHexString());
  root.setProperty('--sky-bottom', '#' + m.skyBottom.getHexString());
  root.setProperty('--sun', '#' + m.sun.getHexString());
  const sunEl = document.getElementById('sun');
  if (sunEl) {
    sunEl.style.left = `calc(${m.sunX * 100}vw - ${m.sunSize / 2}vmin)`;
    sunEl.style.top = `calc(${m.sunY * 100}vh - ${m.sunSize / 2}vmin)`;
    sunEl.style.width = sunEl.style.height = m.sunSize + 'vmin';
  }
  for (const fn of listeners) fn(m);
  return m;
}
