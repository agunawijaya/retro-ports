/**
 * @file Effects: ripples, motes, petals, steam puffs (reference §13,
 * ART-DIRECTION §10.4–10.7). One set per room scene.
 */

import * as THREE from 'three';
import { textures } from '../render/textures.js';
import { clamp } from '../render/math.js';
import { reducedMotion } from '../state/settings.js';

const MOTES = 140;
const PETALS = 160;

/** @param {THREE.Scene} scene */
export function createFx(scene) {
  const TEX = textures();
  const group = new THREE.Group();
  scene.add(group);
  const items = [];

  function ripple(x, z, color = '#ffffff', size = 1.4, life = 0.8, y = 0.02, base = 1) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.47, 48), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(base);
    group.add(mesh);
    items.push({ mesh, life, age: 0, kind: 'ripple', size, base });
  }

  // Motes of light rising from lit objects: one shared pool.
  const motePos = new Float32Array(MOTES * 3);
  const moteData = Array.from({ length: MOTES }, () => ({ alive: false }));
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({
    size: 7, sizeAttenuation: false, map: TEX.glow, color: '#ffd9a0', transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  group.add(motes);

  function mote(x, y, z) {
    if (reducedMotion()) return;
    const m = moteData.find((d) => !d.alive);
    if (!m) return;
    Object.assign(m, {
      alive: true, x, y, z,
      vx: (Math.random() - 0.5) * 0.12, vy: 0.18 + Math.random() * 0.22, vz: (Math.random() - 0.5) * 0.12,
      age: 0, life: 2 + Math.random() * 1.6, phase: Math.random() * 6,
    });
  }

  // Petals for the finale.
  const petalMat = new THREE.MeshBasicMaterial({ color: '#f6b8c4', side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
  const petalGeo = new THREE.CircleGeometry(0.075, 6);
  petalGeo.scale(1, 0.62, 1);
  const petals = new THREE.InstancedMesh(petalGeo, petalMat, PETALS);
  petals.frustumCulled = false;
  petals.count = 0;
  group.add(petals);
  const petalData = [];
  const dummy = new THREE.Object3D();

  function petalShower(spread) {
    if (reducedMotion()) return;
    petalData.length = 0;
    for (let i = 0; i < PETALS; i++) {
      petalData.push({
        x: (Math.random() - 0.5) * spread, y: 4 + Math.random() * 6, z: (Math.random() - 0.5) * spread,
        rx: Math.random() * 6, ry: Math.random() * 6, spin: 1 + Math.random() * 3,
        drift: Math.random() * 6, fall: 0.5 + Math.random() * 0.45,
      });
    }
    petals.count = PETALS;
  }

  function puff(pos) {
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.SpriteMaterial({ map: TEX.glow, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(mat);
      s.position.set(pos.x + (i - 1) * 0.12, pos.y, pos.z);
      group.add(s);
      items.push({ mesh: s, age: -i * 0.09, life: 0.8, kind: 'puff', vy: 0.5 + i * 0.1, vx: (i - 1) * 0.15 });
    }
  }

  function update(dt, glow) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.age += dt;
      const k = clamp(it.age / it.life, 0, 1);
      if (it.kind === 'ripple') {
        it.mesh.scale.setScalar(it.base * (1 + k * it.size));
        it.mesh.material.opacity = 0.55 * (1 - k);
      } else if (it.kind === 'puff' && it.age > 0) {
        it.mesh.position.y += it.vy * dt;
        it.mesh.position.x += it.vx * dt;
        it.mesh.scale.setScalar(0.12 + k * 0.28);
        it.mesh.material.opacity = Math.sin(k * Math.PI) * 0.9;
      }
      if (it.age >= it.life) {
        group.remove(it.mesh);
        it.mesh.geometry?.dispose?.();
        it.mesh.material.dispose();
        items.splice(i, 1);
      }
    }

    moteMat.color.copy(glow);
    if (reducedMotion()) {
      moteMat.opacity = 0;
      petals.count = 0;
    } else {
      moteMat.opacity = 0.85;
    }
    moteData.forEach((m, i) => {
      if (m.alive) {
        m.age += dt;
        m.x += (m.vx + Math.sin(m.age * 2 + m.phase) * 0.05) * dt;
        m.y += m.vy * dt;
        m.z += m.vz * dt;
        if (m.age > m.life) m.alive = false;
      }
      motePos[i * 3] = m.alive ? m.x : 0;
      motePos[i * 3 + 1] = m.alive ? m.y : -999;
      motePos[i * 3 + 2] = m.alive ? m.z : 0;
    });
    moteGeo.attributes.position.needsUpdate = true;

    if (petals.count) {
      petalData.forEach((p, i) => {
        p.y -= p.fall * dt;
        p.x += Math.sin(p.y * 1.3 + p.drift) * 0.35 * dt;
        p.z += Math.cos(p.y * 1.1 + p.drift) * 0.25 * dt;
        p.rx += p.spin * dt;
        p.ry += p.spin * 0.7 * dt;
        if (p.y < -1.5) p.y += 9;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.rx, p.ry, 0);
        dummy.updateMatrix();
        petals.setMatrixAt(i, dummy.matrix);
      });
      petals.instanceMatrix.needsUpdate = true;
    }
  }

  function dispose() {
    for (const it of items) {
      it.mesh.geometry?.dispose?.();
      it.mesh.material.dispose();
    }
    items.length = 0;
    moteGeo.dispose();
    moteMat.dispose();
    petalGeo.dispose();
    petalMat.dispose();
    petals.dispose();
    scene.remove(group);
  }

  return { ripple, mote, petalShower, puff, clearPetals: () => { petals.count = 0; }, update, dispose };
}
