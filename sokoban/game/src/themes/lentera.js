/**
 * @file Lentera: the stone lantern on its pedestal, the default theme
 * (reference §11, ART-DIRECTION §7.1, §7.6, §11). Nothing outside themes/
 * knows that the object is a lantern.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pastel, roles } from '../render/pastel.js';
import { mergeStatic } from '../render/merge.js';
import { textures } from '../render/textures.js';
import { damp } from '../render/math.js';
import { contactShadow } from '../world/shadow.js';
import { reducedMotion } from '../state/settings.js';

const LANTERN_SCALE = 1.15;

const hexMat = (y) => new THREE.Matrix4().makeTranslation(0, y, 0).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 6));

// Merged static geometry per material role for the lantern body.
// 1) Stone parts: foot, platform, 4 pillars, roof, jewel
const stoneGeos = [];
const footGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.08, 6).applyMatrix4(hexMat(0.04));
const platformGeo = new THREE.CylinderGeometry(0.25, 0.2, 0.06, 6).applyMatrix4(hexMat(0.31));
stoneGeos.push(footGeo, platformGeo);

for (let i = 0; i < 4; i++) {
  const a = Math.PI / 4 + (i * Math.PI) / 2;
  const g = new THREE.BoxGeometry(0.05, 0.2, 0.05);
  g.translate(Math.cos(a) * 0.14, 0.44, Math.sin(a) * 0.14);
  stoneGeos.push(g);
}

const roofGeo = new THREE.CylinderGeometry(0.05, 0.34, 0.16, 6).applyMatrix4(hexMat(0.62));
const jewelGeo = new THREE.SphereGeometry(0.055, 16, 12).translate(0, 0.74, 0);
stoneGeos.push(roofGeo, jewelGeo);
const stoneMergedGeo = mergeGeometries(stoneGeos);

// 2) Dark parts: post, roof band
const postGeo = new THREE.CylinderGeometry(0.085, 0.11, 0.2, 6).applyMatrix4(hexMat(0.18));
const roofBandGeo = new THREE.CylinderGeometry(0.31, 0.33, 0.03, 6).applyMatrix4(hexMat(0.545));
const darkMergedGeo = mergeGeometries([postGeo, roofBandGeo]);

// 3) Fire core (glows)
const coreGeo = new THREE.BoxGeometry(0.17, 0.16, 0.17).translate(0, 0.44, 0);

export const lenteraParts = [
  { geometry: stoneMergedGeo, color: '#ece2d6', transform: null, glows: false },
  { geometry: darkMergedGeo, color: '#cdbfb3', transform: null, glows: false },
  { geometry: coreGeo, color: '#a99d94', transform: null, glows: true },
];

const ringGeo = new THREE.TorusGeometry(0.22, 0.022, 8, 36);
ringGeo.rotateX(-Math.PI / 2);
ringGeo.translate(0, 0.055, 0);
const dotGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16);
dotGeo.translate(0, 0.06, 0);
const ringDotGeo = mergeGeometries([ringGeo, dotGeo]);

export const lenteraTargetParts = [
  { geometry: new THREE.CylinderGeometry(0.36, 0.38, 0.05, 6), role: 'goal', transform: hexMat(0.025), glows: false },
  { geometry: ringDotGeo, color: '#ffffff', transform: null, glows: true },
];

/** The object: a stone lantern whose fire-box glows when it stands on a pedestal. */
class Lantern {
  constructor() {
    const TEX = textures();
    const stone = '#ece2d6';
    const g = (this.group = new THREE.Group());
    this.body = new THREE.Group();
    g.add(this.body);

    const mat = pastel(stone);
    const dark = pastel('#cdbfb3');
    this.coreMat = pastel('#a99d94');

    const hex = (rt, rb, h, y, m = mat) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 6), m);
      mesh.position.y = y;
      mesh.rotation.y = Math.PI / 6;
      this.body.add(mesh);
      return mesh;
    };
    hex(0.24, 0.28, 0.08, 0.04); // foot
    hex(0.085, 0.11, 0.2, 0.18, dark); // post
    hex(0.25, 0.2, 0.06, 0.31); // fire-box platform
    // Fire-box: four slim pillars around a glowing core.
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), mat);
      p.position.set(Math.cos(a) * 0.14, 0.44, Math.sin(a) * 0.14);
      this.body.add(p);
    }
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.16, 0.17), this.coreMat);
    core.position.y = 0.44;
    this.body.add(core);
    // Roof: a wide flared hexagonal cap with a jewel on top.
    hex(0.05, 0.34, 0.16, 0.62);
    hex(0.31, 0.33, 0.03, 0.545, dark);
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), mat);
    jewel.position.y = 0.74;
    this.body.add(jewel);
    mergeStatic(this.body); // eleven parts, three draw calls

    // Light: halo sprite, pool of light on the floor, both additive.
    this.haloMat = new THREE.SpriteMaterial({
      map: TEX.glow, color: '#ffd9a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.halo = new THREE.Sprite(this.haloMat);
    this.halo.position.y = 0.45;
    this.halo.scale.setScalar(1.3);
    g.add(this.halo);

    this.poolMat = new THREE.MeshBasicMaterial({
      map: TEX.glow, color: '#ffd9a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), this.poolMat);
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.y = 0.012;
    g.add(this.pool);

    this.shadow = contactShadow(0.9);
    g.add(this.shadow);

    this.lit = 0; // 0..1, animated
    this.isLit = false;
    this.flash = 0;
    this.tilt = 0;
    this.tiltVel = 0;
    this.pushDir = new THREE.Vector3();
    this.flicker = Math.random() * 10;
    this.body.scale.setScalar(LANTERN_SCALE);
    this.halo.position.y *= LANTERN_SCALE;
  }

  setLit(on) {
    this.isLit = on;
    if (on) this.flash = 1;
  }

  update(dt, time, glow) {
    this.lit = damp(this.lit, this.isLit ? 1 : 0, this.isLit ? 3.2 : 6, dt);
    const flicker = reducedMotion() ? 1 : 1 + Math.sin(time * 7.3 + this.flicker) * 0.03 + Math.sin(time * 13.1 + this.flicker * 2) * 0.02;
    this.coreMat.uniforms.uGlow.value.copy(glow);
    this.coreMat.uniforms.uGlowAmt.value = this.lit * 0.95;
    this.haloMat.color.copy(glow);
    this.haloMat.opacity = this.lit * 0.48 * flicker;
    this.halo.scale.setScalar((1.25 + this.flash * 0.9) * flicker);
    this.poolMat.color.copy(glow);
    this.poolMat.opacity = this.lit * 0.28;
    // A dark lantern has no light to draw: skip the two additive layers.
    this.halo.visible = this.pool.visible = this.lit > 0.002;
    this.flash = Math.max(0, this.flash - dt * 1.4);

    // A small spring wobble after being pushed, so the stone feels heavy.
    this.tiltVel += (-this.tilt * 90 - this.tiltVel * 9) * dt;
    this.tilt += this.tiltVel * dt;
    this.body.rotation.x = this.pushDir.z * this.tilt;
    this.body.rotation.z = -this.pushDir.x * this.tilt;
  }

  nudge(dx, dz, amount) {
    this.pushDir.set(dx, 0, dz);
    this.tiltVel += amount;
  }
}

/** The target: a hex pedestal whose ring and centre dot pulse softly while empty. */
function createPedestal() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.05, 6), pastel(null, { roleColor: roles.goal }));
  base.position.y = 0.025;
  base.rotation.y = Math.PI / 6;
  const ringMat = pastel('#ffffff');
  ringMat.uniforms.uGlow.value = new THREE.Color('#ffd9a0');
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 8, 36), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.055;
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16), ringMat);
  dot.position.y = 0.06;
  group.add(base, ring, dot);
  mergeStatic(group, [ring, dot]); // they share one material: one draw call
  return {
    group,
    update(dt, t, glow, covered) {
      ringMat.uniforms.uGlow.value.copy(glow);
      // The pulse keys on the column so neighbouring pedestals breathe out of step.
      const c = group.userData.col ?? 0;
      ringMat.uniforms.uGlowAmt.value = covered ? 0 : (reducedMotion() ? 0.35 : 0.35 + Math.sin(t * 1.6 + c) * 0.15);
    },
  };
}

/** Wind-chime bell: slightly inharmonic partials (ART-DIRECTION §11, lighting). */
const windChime = {
  play(sound, freq, when = 0, level = 0.16) {
    const ctx = sound.ctx;
    const t = ctx.currentTime + when;
    const partials = [[1, 1], [2.0, 0.32], [2.76, 0.22], [4.07, 0.1], [5.4, 0.05]];
    for (const [ratio, amp] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * ratio * (1 + (Math.random() - 0.5) * 0.002);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level * amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2 / Math.sqrt(ratio));
      o.connect(g).connect(sound.dry);
      o.start(t);
      o.stop(t + 3.4);
    }
  },
  // Same note, muffled and short: a lantern leaving its pedestal.
  mute(sound, freq) {
    const ctx = sound.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(lp).connect(g).connect(sound.dry);
    o.start(t);
    o.stop(t + 0.6);
  },
};

import { PENTATONIC } from './scales.js';

export const lentera = {
  id: 'lentera',
  name: 'Lentera',
  counterLabel: 'lentera',
  solvedLine: 'Semua lentera menyala',
  accent: null, // the mood glow as is
  scale: PENTATONIC, // the pentatonic table
  objectScale: LANTERN_SCALE,
  haloY: 0.45,
  parts: lenteraParts,
  targetParts: lenteraTargetParts,
  createObject: () => new Lantern(),
  createTarget: createPedestal,
  instrument: windChime,
  pushSound: (sound) => sound.scrape(),
};
