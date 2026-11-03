/**
 * @file Clouds and stars (reference §9, ART-DIRECTION §5.2, §10.8).
 * No far structures: in an isometric view they would land cropped at the top
 * edge. Depth comes from clouds and mist only.
 */

import * as THREE from 'three';
import { cloudTexture, textures } from '../render/textures.js';
import { onMoodApplied } from '../render/moods.js';
import { reducedMotion } from '../state/settings.js';

/**
 * @param {THREE.Scene} scene
 * @param {() => number} rand the room's seeded generator (cloud placement)
 */
export function createAtmosphere(scene, rand) {
  const group = new THREE.Group();
  scene.add(group);

  // Clouds: a ring of soft sprites drifting slowly below and around the island.
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTexture(1000 + i * 77), transparent: true, depthWrite: false, opacity: 0.85 });
    const s = new THREE.Sprite(mat);
    const angle = (i / 16) * Math.PI * 2 + rand() * 0.3;
    const r = 7 + rand() * 10;
    const below = i % 3 !== 0;
    s.position.set(Math.cos(angle) * r, below ? -2.4 - rand() * 3 : -0.8 - rand() * 1.2, Math.sin(angle) * r);
    const w = 6 + rand() * 7;
    s.scale.set(w, w * 0.42, 1);
    s.userData = { speed: 0.08 + rand() * 0.1, angle, r, baseOpacity: below ? 0.9 : 0.55 };
    clouds.push(s);
    group.add(s);
  }

  // Stars, only at dusk and night.
  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 260; i++) {
    const a = rand() * Math.PI * 2;
    const r = 30 + rand() * 30;
    pts.push(Math.cos(a) * r, 4 + rand() * 30, Math.sin(a) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const starMat = new THREE.PointsMaterial({
    size: 2.2, sizeAttenuation: false, color: '#ffffff', transparent: true, opacity: 0,
    map: textures().glow, depthWrite: false,
  });
  group.add(new THREE.Points(starGeo, starMat));

  function tint(m) {
    for (const c of clouds) c.material.color.copy(m.cloud);
    starMat.opacity = m.stars * 0.9;
  }
  const unlisten = onMoodApplied(tint);

  return {
    tint,
    update(dt, time) {
      if (reducedMotion()) {
        starMat.size = 2.2;
        return;
      }
      for (const c of clouds) {
        c.userData.angle += c.userData.speed * dt * 0.05;
        c.position.x = Math.cos(c.userData.angle) * c.userData.r;
        c.position.z = Math.sin(c.userData.angle) * c.userData.r;
        c.material.opacity = c.userData.baseOpacity;
      }
      starMat.size = 2.2 + Math.sin(time * 1.3) * 0.25;
    },
    dispose() {
      unlisten();
      for (const c of clouds) {
        c.material.map.dispose();
        c.material.dispose();
      }
      starGeo.dispose();
      starMat.dispose();
      scene.remove(group);
    },
  };
}
