/**
 * @file Merging parts that never move relative to each other into one mesh per
 * material. The shapes stay exactly the same; only the draw calls drop
 * (ARCHITECTURE §14: at most 150 in a room). The reference builds each part as
 * its own mesh, which is why a ported room started near 300.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const inverse = new THREE.Matrix4();
const relative = new THREE.Matrix4();

/**
 * Replace `meshes` (anywhere below `group`, at rest) with one mesh per
 * material, added to `group` in the same place.
 * @param {THREE.Object3D} group the parent the merged meshes join
 * @param {THREE.Mesh[]} [meshes] the parts to merge; default: group's direct mesh children
 * @returns {THREE.Mesh[]} the merged meshes, in first-seen material order
 */
export function mergeStatic(group, meshes = group.children.filter((o) => o.isMesh)) {
  group.updateMatrixWorld(true);
  inverse.copy(group.matrixWorld).invert();
  const byMaterial = new Map();
  for (const mesh of meshes) {
    relative.multiplyMatrices(inverse, mesh.matrixWorld);
    const g = mesh.geometry.clone().applyMatrix4(relative);
    if (!byMaterial.has(mesh.material)) byMaterial.set(mesh.material, []);
    byMaterial.get(mesh.material).push(g.index ? g.toNonIndexed() : g);
    mesh.parent?.remove(mesh);
    mesh.geometry.dispose();
  }
  const merged = [];
  for (const [material, geos] of byMaterial) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), material);
    group.add(mesh);
    merged.push(mesh);
    geos.forEach((g) => g.dispose());
  }
  return merged;
}
