/**
 * @file Where the camera stands for each screen around the tower, and which
 * mood each place wears. Views are in world coordinates (centred on the
 * vertical axis at 0, 0); the anchor is the point the mist is measured from.
 */

import * as THREE from 'three';
import { frameView, fitAround } from '../render/camera.js';
import { FLOOR_H, ROOF } from '../render/tower.js';
import { capstone, AXIS_STEP } from './stone-layout.js';

const ISO = Math.PI / 4;

// The stack is read from below: at the room's isometric 35° the floating
// stones overlap on screen (sky can only show between stones narrower than
// 1.4 / tan 35° ≈ 2.0), so the views that show the whole Menara look up at it.
const LOOK_UP = 8 * (Math.PI / 180); // 05: from 13°, the deeper lens-shaped stones need it
const COURTYARD_ELEVATION = 20 * (Math.PI / 180);
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const portrait = () => window.innerWidth / window.innerHeight < 0.9;

function box(x0, x1, y0, y1, z0, z1) {
  const pts = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) pts.push(v(x, y, z));
  return pts;
}

const COURTYARD = box(-5.2, 5.2, -0.5, 0.5, -5.2, 5.2);

/** Title (§13.1): the whole tower from the courtyard to the capstone, sky left for the word. */
export function titleView() {
  const cap = capstone();
  const pts = [
    ...COURTYARD,
    ...box(-4.6, 4.6, 2.0, 12.5, -4.6, 4.6),
    ...box(cap.centre.x - cap.R, cap.centre.x + cap.R, cap.topY, cap.topY + 1.2, cap.centre.z - cap.R, cap.centre.z + cap.R),
    v(-9.2, -2.0, 1),
  ];
  const framed = portrait()
    ? frameView(pts, ISO, 1.04, { lift: -0.12, elevation: LOOK_UP })
    : frameView(pts, ISO, 1.1, { shift: 0.28, elevation: LOOK_UP });
  return { ...framed, azimuth: ISO, anchor: v(0, 0, 0), fogDepth: 4.2, elevation: LOOK_UP };
}

/** Courtyard (§13.3): the island to walk on, the lower floating stones rising above. */
export function courtyardView() {
  const pts = portrait()
    ? [...COURTYARD, v(4.9, 1, 1), v(-5.6, -0.5, 2)]
    : [...COURTYARD, v(4.9, 1, 1), v(-6.4, -0.9, 2), ...box(-4.6, 4.6, 2.0, 6.0, -4.6, 4.6)];
  const framed = portrait()
    ? frameView(pts, ISO, 1.06, { lift: -0.32, elevation: COURTYARD_ELEVATION })
    : frameView(pts, ISO, 1.03, { elevation: COURTYARD_ELEVATION });
  return { ...framed, azimuth: ISO, anchor: v(0, 0, 0), fogDepth: 4.2, elevation: COURTYARD_ELEVATION };
}

/** The shaft at a (possibly fractional) level: the elevator and the floor stones. */
export function levelView(level, azimuth = ISO) {
  const y = level * AXIS_STEP;
  const anchor = v(0, y, 0);
  const target = anchor.clone().add(v(0, 0.45, 0));
  const terrace = box(-4.8, 4.8, 0, 1.2, -4.8, 4.8).map((p) => p.add(anchor));
  const margin = portrait() ? 0.98 : 1.16;
  const halfHeight = Math.max(fitAround(terrace, target, ISO, margin), fitAround(terrace, target, 0, margin));
  return { target, azimuth, halfHeight, anchor, fogDepth: 3.2 };
}

/** The ending (§8, §13.12): the capstone, platform and the stranger on the edge. */
export function endingView() {
  const cap = capstone();
  const anchor = v(0, cap.topY, 0);
  const pts = [
    ...box(-1.0, 1.0, cap.topY - 0.2, cap.topY + 0.6, -1.0, 1.0),
    ...box(cap.centre.x - cap.R - 0.2, cap.centre.x + cap.R + 0.2, cap.topY - 0.2, cap.topY + 0.8, cap.centre.z - cap.R - 0.2, cap.centre.z + cap.R + 0.2),
  ];
  const framed = frameView(pts, ISO, portrait() ? 1.04 : 1.02, { shift: portrait() ? 0.15 : 0.1 });
  return { ...framed, azimuth: ISO, anchor, fogDepth: 16 };
}

/**
 * A floor's mood is the mood of its next unsolved room (ART-DIRECTION
 * §13.5, §5.3); a floor with every room solved is night, every alcove lit.
 */
export function floorMood(progress, floor) {
  for (let i = 1; i <= 10; i++) {
    if (!progress.solved?.[(floor - 1) * 10 + i]) return (i - 1) / 3;
  }
  return 3;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
export const roman = (n) => ROMAN[n - 1] ?? String(n);
export const two = (n) => String(n).padStart(2, '0');
