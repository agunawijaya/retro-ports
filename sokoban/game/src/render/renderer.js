/**
 * @file One WebGL renderer and one orthographic camera for the whole game
 * (reference §7, ART-DIRECTION §2). Screens bring their own scenes.
 */

import * as THREE from 'three';

let shared = null;

/**
 * Creates the renderer on first call; later calls return the same pair.
 * @param {HTMLCanvasElement} canvas
 */
export function initRenderer(canvas) {
  if (shared) return shared;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  shared = { renderer, camera };
  return shared;
}

/** The pair, once initRenderer has run. */
export const getRenderer = () => shared;
