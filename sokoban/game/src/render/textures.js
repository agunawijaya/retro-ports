/**
 * @file Procedural textures, generated on a canvas at load (reference §5).
 * Zero raster: there is not a single image file in the game.
 */

import * as THREE from 'three';

/** Radial gradient white → 45 % at 0.45 → transparent: glows, shadows, motes. */
export function softDisc(size = 128, inner = 0, outer = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, (size / 2) * inner, size / 2, size / 2, (size / 2) * outer);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Nine overlapping soft blobs: one cloud. Its own little generator keeps each cloud's shape fixed. */
export function cloudTexture(seed) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size / 2;
  const g = c.getContext('2d');
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9; i++) {
    const x = size * (0.2 + rand() * 0.6);
    const y = (size / 2) * (0.45 + rand() * 0.25);
    const r = size * (0.08 + rand() * 0.12);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Made once and shared: every halo, pool, mote and contact shadow uses these.
let shared = null;
export function textures() {
  if (!shared) shared = { glow: softDisc(128), shadow: softDisc(128, 0, 1) };
  return shared;
}
