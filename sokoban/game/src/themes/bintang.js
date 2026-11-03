/**
 * @file Cahaya Bintang theme (ART-DIRECTION §7.2, GAME-DESIGN §6).
 * Fallen star crystal on an altar.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PENTATONIC } from './scales.js';
import { pastel, roles } from '../render/pastel.js';
import { reducedMotion } from '../state/settings.js';

function createCrystalGeometry() {
  const geo = new THREE.OctahedronGeometry(0.2, 0).toNonIndexed();
  geo.computeVertexNormals();
  geo.scale(1, 1.9, 1);
  geo.translate(0, 0.56, 0); // floats 0.12 above foot (top 0.06 + 0.12 = 0.18 bottom tip)
  return geo;
}

function createFootGeometry() {
  const geos = [];
  // Base hex tier
  const base = new THREE.CylinderGeometry(0.19, 0.20, 0.04, 6);
  base.rotateY(Math.PI / 6);
  base.translate(0, 0.02, 0);
  // Stepped hex collar
  const collar = new THREE.CylinderGeometry(0.13, 0.16, 0.02, 6);
  collar.rotateY(Math.PI / 6);
  collar.translate(0, 0.05, 0);
  geos.push(base, collar);
  return mergeGeometries(geos);
}

function createBeamGeometry() {
  // Thin vertical beam cylinder r 0.03, h 3, rising from crystal and fading upward
  const geo = new THREE.CylinderGeometry(0.015, 0.03, 3.0, 16);
  geo.translate(0, 2.06, 0); // centered from crystal y 0.56 up to 3.56
  return geo;
}

function createAltarGeometry() {
  const geos = [];
  // Low altar terrace base in goal stone
  const base = new THREE.CylinderGeometry(0.36, 0.38, 0.03, 6);
  base.rotateY(Math.PI / 6);
  base.translate(0, 0.015, 0);
  geos.push(base);

  // 0.7-wide U of three short pillars (h 0.32)
  const pillarOffsets = [
    [-0.32, 0],
    [0, -0.32],
    [0.32, 0],
  ];

  for (const [ox, oz] of pillarOffsets) {
    const pBase = new THREE.CylinderGeometry(0.06, 0.065, 0.04, 12).translate(ox, 0.05, oz);
    const pShaft = new THREE.CylinderGeometry(0.048, 0.048, 0.24, 12).translate(ox, 0.19, oz);
    const pCap = new THREE.CylinderGeometry(0.06, 0.052, 0.04, 12).translate(ox, 0.33, oz);
    geos.push(pBase, pShaft, pCap);
  }

  return mergeGeometries(geos);
}

function createStarGeometry() {
  // True 5-pointed recessed star inlay (flat, r 0.24)
  const starShape = new THREE.Shape();
  const rOuter = 0.24;
  const rInner = 0.095;
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (i === 0) starShape.moveTo(x, z);
    else starShape.lineTo(x, z);
  }
  starShape.closePath();

  const geo = new THREE.ShapeGeometry(starShape);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.032, 0); // rests on the low altar terrace
  return geo;
}

const crystalGeo = createCrystalGeometry();
const footGeo = createFootGeometry();
const beamGeo = createBeamGeometry();
const altarPillarsGeo = createAltarGeometry();
const starGeo = createStarGeometry();

export const bintangParts = [
  { geometry: footGeo, color: '#d9d4ea', transform: null, glows: false },
  { geometry: crystalGeo, color: '#d9d4ea', transform: null, glows: true, spins: true },
  { geometry: beamGeo, color: '#bfe3ff', transform: null, glows: true, beam: true },
];

export const bintangTargetParts = [
  { geometry: altarPillarsGeo, role: 'goal', transform: null, glows: false },
  { geometry: starGeo, color: '#ffffff', transform: null, glows: true },
];

// Standalone object for tower alcoves
function createBintangObject() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const mat = pastel('#d9d4ea');
  const foot = new THREE.Mesh(footGeo, mat);
  body.add(foot);

  const crystalMat = pastel('#d9d4ea', { glow: '#bfe3ff' });
  const crystal = new THREE.Mesh(crystalGeo, crystalMat);
  body.add(crystal);

  const beamMat = pastel('#bfe3ff');
  beamMat.transparent = true;
  beamMat.opacity = 0.25;
  beamMat.blending = THREE.AdditiveBlending;
  beamMat.depthWrite = false;
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.visible = false;
  body.add(beam);

  return {
    group,
    body,
    isLit: false,
    lit: 0,
    flash: 0,
    spin: 0,
    setLit(on) {
      this.isLit = on;
      if (on) this.flash = 1;
    },
    nudge() {},
    update(dt, t, glow) {
      if (!reducedMotion()) {
        this.spin += 0.3 * dt;
        crystal.rotation.y = this.spin;
      }
      this.lit = Math.min(1, Math.max(0, this.lit + (this.isLit ? dt * 3.2 : -dt * 6)));
      crystalMat.uniforms.uGlow.value.copy(glow);
      crystalMat.uniforms.uGlowAmt.value = this.lit * 0.95;
      beam.visible = this.lit > 0.02;
      if (beam.visible) {
        beamMat.opacity = this.lit * 0.25;
      }
    },
  };
}

function createBintangTarget() {
  const group = new THREE.Group();
  const pillars = new THREE.Mesh(altarPillarsGeo, pastel(null, { roleColor: roles.goal }));
  const starMat = pastel('#ffffff', { glow: '#bfe3ff' });
  const star = new THREE.Mesh(starGeo, starMat);
  group.add(pillars, star);

  return {
    group,
    update(dt, t, glow, covered) {
      starMat.uniforms.uGlow.value.copy(glow);
      const c = group.userData.col ?? 0;
      starMat.uniforms.uGlowAmt.value = covered ? 0 : (reducedMotion() ? 0.35 : 0.35 + Math.sin(t * 1.6 + c) * 0.15);
    },
  };
}

const marimba = {
  play(sound, freq, when = 0, level = 0.16) {
    const ctx = sound.ctx;
    const t = ctx.currentTime + when;
    // Marimba partials (ART-DIRECTION §7.2): 1 : 3.93 : 9.2, amplitudes 1 : 0.25 : 0.06, decay 1.3 s
    const partials = [[1, 1], [3.93, 0.25], [9.2, 0.06]];
    for (const [ratio, amp] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level * amp, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3 / Math.sqrt(ratio));
      o.connect(g).connect(sound.dry);
      o.start(t);
      o.stop(t + 1.4);
    }
    // Mallet click: 6 ms noise burst at 3 kHz
    try {
      const len = Math.floor(ctx.sampleRate * 0.006);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.12;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 3000;
      filter.Q.value = 4;
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(level * 0.4, t);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.006);
      src.connect(filter).connect(clickGain).connect(sound.dry);
      src.start(t);
    } catch (_) {}
  },
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

function glassyPush(sound) {
  const ctx = sound.ctx;
  if (!ctx) return;
  const t = ctx.currentTime;
  try {
    // Glassy ring: bandpass noise 2.4 kHz, Q 6, 0.25 s, very quiet
    const len = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.06;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2400;
    filter.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    src.connect(filter).connect(g).connect(sound.dry);
    src.start(t);
  } catch (_) {}
}

export const bintang = {
  id: 'bintang',
  name: 'Cahaya Bintang',
  counterLabel: 'kristal',
  solvedLine: 'Semua kristal bercahaya',
  accent: '#bfe3ff',
  scale: PENTATONIC,
  objectScale: 1.0,
  haloY: 0.45,
  parts: bintangParts,
  targetParts: bintangTargetParts,
  updateObject(obj, dt) {
    obj.spin = (obj.spin || 0) + 0.3 * dt;
  },
  createObject: createBintangObject,
  createTarget: createBintangTarget,
  instrument: marimba,
  pushSound: glassyPush,
};
