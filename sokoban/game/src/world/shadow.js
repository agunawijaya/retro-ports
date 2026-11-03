/**
 * @file Contact shadows (ART-DIRECTION §10.1): a soft disc on the floor,
 * tinted with the mood's shadow colour, never black.
 */

import * as THREE from 'three';
import { textures } from '../render/textures.js';

/** Every live contact-shadow material; the room re-tints them each frame. */
export const shadows = new Set();

export function contactShadow(size) {
  const m = new THREE.MeshBasicMaterial({
    map: textures().shadow, color: '#7d6f96', transparent: true, opacity: 0.32, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.006;
  mesh.renderOrder = 1;
  shadows.add(m);
  return mesh;
}
