/**
 * @file The isometric camera (reference §7, §15; ART-DIRECTION §3).
 * True isometric elevation; the azimuth steps by 90° when the player turns
 * the view, and the pastel shader's left/right directions follow it so
 * lighting stays consistent after a rotation.
 */

import * as THREE from 'three';
import { light } from './pastel.js';
// core/level.js orders its DIRS differently; the screen mapping needs the circle.
import { board, CLOCKWISE } from './board.js';
import { getRenderer } from './renderer.js';

export const ELEVATION = Math.atan(1 / Math.SQRT2); // 35.264°


export const view = {
  zoom: 1,
  step: 0,
  azimuth: Math.PI / 4,
  targetAzimuth: Math.PI / 4,
  halfHeight: 6,
  target: new THREE.Vector3(),
};

const toCam = new THREE.Vector3();
const right = new THREE.Vector3();

function placeCamera(camera, target = view.target, a = view.azimuth, elevation = ELEVATION) {
  const d = 60;
  camera.position.set(
    target.x + Math.sin(a) * Math.cos(elevation) * d,
    target.y + Math.sin(elevation) * d,
    target.z + Math.cos(a) * Math.cos(elevation) * d,
  );
  camera.lookAt(target);

  // Which world directions currently face screen-left and screen-right.
  toCam.set(Math.sin(a), 0, Math.cos(a));
  right.set(Math.cos(a), 0, -Math.sin(a));
  light.uDirL.value.copy(toCam).sub(right).normalize();
  light.uDirR.value.copy(toCam).add(right).normalize();
}

const corner = new THREE.Vector3();

/** Project the room's box into view space and frame it with breathing room. */
export function fitCamera() {
  const pair = getRenderer();
  if (!pair) return;
  const { renderer, camera } = pair;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  placeCamera(camera);
  camera.updateMatrixWorld();
  const inv = camera.matrixWorldInverse;
  let maxX = 0;
  let maxY = 0;
  const hw = board.cols / 2 + 0.6;
  const hd = board.rows / 2 + 0.6;
  for (const x of [-hw, hw]) {
    for (const z of [-hd, hd]) {
      for (const y of [0, 1]) {
        corner.set(x, y, z).applyMatrix4(inv);
        maxX = Math.max(maxX, Math.abs(corner.x));
        maxY = Math.max(maxY, Math.abs(corner.y));
      }
    }
  }
  const margin = w < 720 ? 1.12 : 1.3;
  view.halfHeight = (Math.max(maxY, maxX / aspect) * margin) / view.zoom;
  camera.left = -view.halfHeight * aspect;
  camera.right = view.halfHeight * aspect;
  camera.top = view.halfHeight;
  camera.bottom = -view.halfHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

/**
 * Places the shared camera from an explicit framing, without touching the
 * room's `view`: the tower screens orbit and zoom on their own, and a room
 * entered afterwards must still open on its default view.
 * @param {THREE.Vector3} target world point at the centre of the screen
 * @param {number} azimuth radians, 0 = camera on +z
 * @param {number} halfHeight half the visible height in world units
 */
export function placeView(target, azimuth, halfHeight, elevation = ELEVATION) {
  const pair = getRenderer();
  if (!pair) return;
  const { renderer, camera } = pair;
  const w = window.innerWidth;
  const h = window.innerHeight;
  placeCamera(camera, target, azimuth, elevation);
  camera.left = -halfHeight * (w / h);
  camera.right = halfHeight * (w / h);
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  // Resizing a canvas reallocates its buffer even at the same size: only on change.
  renderer.getSize(size);
  if (size.x !== w || size.y !== h) renderer.setSize(w, h, false);
}

const size = new THREE.Vector2();

/** Screen-right and screen-up, in world space, for a camera at `azimuth`. */
export function screenAxes(azimuth, elevation = ELEVATION) {
  const s = Math.sin(elevation);
  return {
    right: new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth)),
    up: new THREE.Vector3(-Math.sin(azimuth) * s, Math.cos(elevation), -Math.cos(azimuth) * s),
  };
}

/**
 * Frames `points` the way a room frames its box (§3): centred on screen,
 * half-height = the larger extent × `margin`. `shift` and `lift` move the
 * picture across and up the screen, as fractions of the half-width and
 * half-height, for compositions that leave sky for text.
 * @param {THREE.Vector3[]} points
 * @returns {{ target: THREE.Vector3, halfHeight: number }}
 */
export function frameView(points, azimuth, margin, { shift = 0, lift = 0, aspect = window.innerWidth / window.innerHeight, elevation = ELEVATION } = {}) {
  const { right, up } = screenAxes(azimuth, elevation);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    const x = p.dot(right);
    const y = p.dot(up);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const halfHeight = Math.max((y1 - y0) / 2, (x1 - x0) / 2 / aspect) * margin;
  const cx = (x0 + x1) / 2 - shift * halfHeight * aspect;
  const cy = (y0 + y1) / 2 - lift * halfHeight;
  return { target: right.multiplyScalar(cx).add(up.multiplyScalar(cy)), halfHeight };
}

/** The half-height that keeps `points` on screen around a fixed `target`. */
export function fitAround(points, target, azimuth, margin, aspect = window.innerWidth / window.innerHeight) {
  const { right, up } = screenAxes(azimuth);
  const tx = target.dot(right);
  const ty = target.dot(up);
  let h = 0;
  for (const p of points) {
    h = Math.max(h, Math.abs(p.dot(up) - ty), Math.abs(p.dot(right) - tx) / aspect);
  }
  return h * margin;
}

/** Turn the view by ±90°; the camera eases there (world.update damps the azimuth). */
export function rotateView(delta) {
  view.step = (view.step + delta + 4) % 4;
  view.targetAzimuth += (delta * Math.PI) / 2;
}

/** Screen direction (0 up, 1 right, 2 down, 3 left) → grid step, whatever the rotation. */
export const screenToGrid = (screenDir) => CLOCKWISE[(screenDir - view.step + 8) % 4];

/** Back to the default framing of a fresh room. */
export function resetView() {
  view.zoom = 1;
  view.step = 0;
  view.azimuth = view.targetAzimuth = Math.PI / 4;
  view.target.set(0, 0, 0);
}
