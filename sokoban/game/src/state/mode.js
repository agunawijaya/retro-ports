/**
 * @file Session mode ('dupa' | 'bebas').
 * Holds until the player returns to the courtyard.
 */

import { getSettings } from './settings.js';

let sessionMode = null;

export function getSessionMode() {
  if (sessionMode == null) {
    sessionMode = getSettings().mode ?? 'bebas';
  }
  return sessionMode;
}

export function setSessionMode(m) {
  sessionMode = m === 'dupa' ? 'dupa' : 'bebas';
  return sessionMode;
}

export function resetSessionMode() {
  sessionMode = null;
}
