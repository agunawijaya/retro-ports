/**
 * @file Settings storage (`ARCHITECTURE.md` §8, `hening.settings.v1`).
 * Defaults from `GAME-DESIGN.md` §7.10.
 */

const KEY = 'hening.settings.v1';

/** @returns {{theme:string, mode:'dupa'|'bebas', dupaMinutes:10|20|30, volume:{master:number,ambience:number,notes:number}, reducedMotion:'system'|'on'|'off', hints:boolean}} */
export function defaultSettings() {
  return {
    theme: 'lentera',
    mode: 'bebas',
    dupaMinutes: 20,
    volume: { master: 0.8, ambience: 0.6, notes: 0.8 },
    reducedMotion: 'system',
    hints: true,
  };
}

/**
 * Loads settings from storage, falling back to defaults if storage is
 * unavailable, throws, or holds something that doesn't parse.
 */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw);
    const defaults = defaultSettings();
    return { ...defaults, ...parsed, volume: { ...defaults.volume, ...(parsed.volume || {}) } };
  } catch {
    return defaultSettings();
  }
}

/** Saves settings to storage. Silently no-ops if storage throws or is unavailable. */
export function save(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage disabled or full — the game keeps running from memory only.
  }
}

// --- in-memory singleton + change notifications (prompt 02-tower-glue §3) --

let cached = null;
const listeners = new Set();

/** Loads settings once, then returns that same object on every later call. */
export function getSettings() {
  if (!cached) cached = load();
  return cached;
}

/**
 * Shallow-merges `patch` into the settings, merging `volume` field by field
 * (so patching just `volume.master` leaves `ambience`/`notes` alone), saves,
 * and notifies every subscriber.
 * @param {object} patch
 */
export function updateSettings(patch) {
  const current = getSettings();
  const next = { ...current, ...patch };
  if (patch.volume) next.volume = { ...current.volume, ...patch.volume };
  cached = next;
  save(cached);
  for (const fn of listeners) fn(cached);
  return cached;
}

/**
 * Subscribes to every `updateSettings()` call.
 * @param {(settings: object) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Whether motion should be reduced right now: `'on'`/`'off'` answer
 * directly, `'system'` asks the OS — guarded so it also runs under Node,
 * where there is no `window.matchMedia`.
 */
export function reducedMotion() {
  const mode = getSettings().reducedMotion;
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
