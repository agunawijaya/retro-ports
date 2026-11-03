/**
 * @file Taman Batu theme (ART-DIRECTION §7.3, GAME-DESIGN §6).
 * Runic monolith in a sand garden.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PENTATONIC } from './scales.js';
import { pastel, roles } from '../render/pastel.js';
import { cellX, cellZ } from '../render/board.js';
import { reducedMotion } from '../state/settings.js';

function createMonolithGeometry() {
  // Rough monolith: box 0.42 x 0.72 x 0.32, top edges bevelled
  const geo = new THREE.BoxGeometry(0.42, 0.72, 0.32, 4, 6, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // Taper & chamfer top edges (y > 0.15)
    if (y > 0.15) {
      const t = (y - 0.15) / 0.21;
      const factor = 1.0 - t * 0.24;
      pos.setX(i, pos.getX(i) * factor);
      pos.setZ(i, pos.getZ(i) * factor);
    } else if (y < -0.30) {
      // Subtle widened base footing
      pos.setX(i, pos.getX(i) * 1.04);
      pos.setZ(i, pos.getZ(i) * 1.04);
    }
  }
  geo.computeVertexNormals();
  geo.translate(0, 0.36, 0); // rests on ground at y = 0
  return geo;
}

function createRuneGeometry() {
  const geos = [];
  // Sacred runic inscription: 3 thin inset boxes on front face (z = 0.16)
  const stem = new THREE.BoxGeometry(0.036, 0.24, 0.02).translate(0, 0.44, 0.161);
  const branchTop = new THREE.BoxGeometry(0.12, 0.032, 0.02);
  branchTop.rotateZ(0.38);
  branchTop.translate(0.03, 0.48, 0.161);
  const branchBot = new THREE.BoxGeometry(0.11, 0.032, 0.02);
  branchBot.rotateZ(-0.38);
  branchBot.translate(-0.02, 0.39, 0.161);
  geos.push(stem, branchTop, branchBot);
  return mergeGeometries(geos);
}

function createMossDiscGeometry() {
  // Balance point moss disc: cylinder r 0.26, h 0.02, #b9cfa6
  const geo = new THREE.CylinderGeometry(0.25, 0.265, 0.02, 24);
  geo.translate(0, 0.01, 0);
  return geo;
}

function createPebblesGeometry() {
  // Flat ring of 8 naturally varied river pebbles around moss disc
  const geos = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8 + 0.15;
    const r = 0.315;
    const radius = 0.038 + (i % 3) * 0.003;
    const p = new THREE.SphereGeometry(radius, 10, 8);
    p.scale(1.0, 0.72, 1.18);
    p.rotateY(i * 1.4);
    p.translate(Math.cos(angle) * r, 0.022, Math.sin(angle) * r);
    geos.push(p);
  }
  return mergeGeometries(geos);
}

const monolithGeo = createMonolithGeometry();
const runeGeo = createRuneGeometry();
const mossDiscGeo = createMossDiscGeometry();
const pebblesGeo = createPebblesGeometry();

export const batuParts = [
  { geometry: monolithGeo, color: '#d8d0c6', transform: null, glows: false },
  { geometry: runeGeo, color: '#d8d0c6', transform: null, glows: true },
];

export const batuTargetParts = [
  { geometry: pebblesGeo, color: '#cfc8c6', transform: null, glows: false },
  { geometry: mossDiscGeo, color: '#b9cfa6', transform: null, glows: true },
];

// Standalone object for tower alcoves
function createBatuObject() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const stoneMat = pastel('#d8d0c6');
  const runeMat = pastel('#d8d0c6', { glow: '#b8f0c8' });
  const monolith = new THREE.Mesh(monolithGeo, stoneMat);
  const rune = new THREE.Mesh(runeGeo, runeMat);
  body.add(monolith, rune);

  return {
    group,
    body,
    isLit: false,
    lit: 0,
    flash: 0,
    setLit(on) {
      this.isLit = on;
      if (on) this.flash = 1;
    },
    nudge() {},
    update(dt, t, glow) {
      this.lit = Math.min(1, Math.max(0, this.lit + (this.isLit ? dt * 3.2 : -dt * 6)));
      runeMat.uniforms.uGlow.value.copy(glow);
      runeMat.uniforms.uGlowAmt.value = this.lit * 0.95;
    },
  };
}

function createBatuTarget() {
  const group = new THREE.Group();
  const pebbles = new THREE.Mesh(pebblesGeo, pastel('#cfc8c6'));
  const mossMat = pastel('#b9cfa6', { glow: '#b8f0c8' });
  const moss = new THREE.Mesh(mossDiscGeo, mossMat);
  group.add(pebbles, moss);

  return {
    group,
    update(dt, t, glow, covered) {
      mossMat.uniforms.uGlow.value.copy(glow);
      const c = group.userData.col ?? 0;
      mossMat.uniforms.uGlowAmt.value = covered ? 0 : (reducedMotion() ? 0.35 : 0.35 + Math.sin(t * 1.6 + c) * 0.15);
    },
  };
}

function createRakedSandExtras(level, islandGroup) {
  const sandGroup = new THREE.Group();
  islandGroup.add(sandGroup);

  // 5 parallel strips per inside floor tile, 0.008 tall, colour floorB,
  // direction alternating per room (ART-DIRECTION §7.3). Around a lit stone
  // the strips within one tile bend into rings over 1.2 s — rings outside the
  // stone's footprint (0.46 … 1.18), so they are seen, and only around the
  // stones that are lit.
  const stripGeos = [];
  const isHorizontal = ((level.number ?? 1) % 2) === 0;
  const centres = (level.targets ?? []).map((t) => ({ x: cellX(t.c), z: cellZ(t.r) }));

  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (!level.inside[r]?.[c] || level.wall[r]?.[c]) continue;
      const cx = cellX(c);
      const cz = cellZ(r);
      const near = centres.some((t) => Math.hypot(cx - t.x, cz - t.z) < 1.5);
      const segs = near ? 16 : 1;
      for (let k = -2; k <= 2; k++) {
        const offset = k * 0.18;
        const g = isHorizontal
          ? new THREE.BoxGeometry(0.9, 0.008, 0.026, segs, 1, 1).translate(cx, 0.004, cz + offset)
          : new THREE.BoxGeometry(0.026, 0.008, 0.9, 1, 1, segs).translate(cx + offset, 0.004, cz);
        stripGeos.push(g);
      }
    }
  }

  let mesh = null;
  let posAttr = null;
  let straight = null;
  let curved = null;
  let owner = null; // the target a vertex bends around, or -1
  const RINGS = [0.46, 0.64, 0.82, 1.0, 1.18];

  if (stripGeos.length) {
    const merged = mergeGeometries(stripGeos);
    stripGeos.forEach((g) => g.dispose());
    posAttr = merged.attributes.position;
    const n = posAttr.count;
    straight = new Float32Array(posAttr.array);
    curved = new Float32Array(posAttr.array);
    owner = new Int16Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      const vx = straight[i * 3];
      const vz = straight[i * 3 + 2];
      let best = -1;
      let bestD = Infinity;
      centres.forEach((t, j) => {
        const d = Math.hypot(vx - t.x, vz - t.z);
        if (d < bestD) { bestD = d; best = j; }
      });
      if (best < 0 || bestD > 1.34 || bestD < 0.3) continue;
      const t = centres[best];
      let ring = RINGS[0];
      for (const R of RINGS) if (Math.abs(bestD - R) < Math.abs(bestD - ring)) ring = R;
      const a = Math.atan2(vz - t.z, vx - t.x);
      const w = 1 - Math.min(1, Math.max(0, (bestD - 1.12) / 0.22)); // feather the outer edge
      curved[i * 3] = vx + (t.x + ring * Math.cos(a) - vx) * w;
      curved[i * 3 + 2] = vz + (t.z + ring * Math.sin(a) - vz) * w;
      owner[i] = best;
    }
    mesh = new THREE.Mesh(merged, pastel(null, { roleColor: roles.floorB }));
    sandGroup.add(mesh);
  }

  const times = new Float32Array(centres.length);
  const shown = new Float32Array(centres.length).fill(-1);

  return {
    update(dt, t, progress) {
      if (!posAttr) return;
      let changed = false;
      const ease = new Float32Array(centres.length);
      for (let j = 0; j < centres.length; j++) {
        const lit = !!progress?.covered?.[j];
        times[j] = lit ? Math.min(1.2, times[j] + dt) : Math.max(0, times[j] - dt);
        const x = times[j] / 1.2;
        ease[j] = x * x * (3 - 2 * x);
        if (Math.abs(ease[j] - shown[j]) > 0.002) { shown[j] = ease[j]; changed = true; }
      }
      if (!changed) return;
      for (let i = 0; i < posAttr.count; i++) {
        const j = owner[i];
        if (j < 0) continue;
        const k = ease[j];
        posAttr.setX(i, straight[i * 3] + (curved[i * 3] - straight[i * 3]) * k);
        posAttr.setZ(i, straight[i * 3 + 2] + (curved[i * 3 + 2] - straight[i * 3 + 2]) * k);
      }
      posAttr.needsUpdate = true;
    },
    dispose() {
      if (mesh) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      islandGroup.remove(sandGroup);
    },
  };
}

const koto = {
  play(sound, freq, when = 0, level = 0.16) {
    const ctx = sound.ctx;
    const t = ctx.currentTime + when;
    // Koto pluck: sawtooth through 2.2 kHz lowpass falling to 600 Hz over 0.4 s, decay 2 s, 15-cent downward bend
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    // Downward 15-cent bend at start
    const startFreq = freq * Math.pow(2, 15 / 1200);
    o.frequency.setValueAtTime(startFreq, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.12);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.frequency.exponentialRampToValueAtTime(600, t + 0.4);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);

    // Warm body harmonic (Paulownia wood resonance)
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(startFreq * 2, t);
    o2.frequency.exponentialRampToValueAtTime(freq * 2, t + 0.12);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(level * 0.18, t + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);

    o.connect(filter).connect(g).connect(sound.dry);
    o2.connect(g2).connect(sound.dry);
    o.start(t);
    o.stop(t + 2.1);
    o2.start(t);
    o2.stop(t + 1.3);
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

function heavyStonePush(sound) {
  const ctx = sound.ctx;
  if (!ctx) return;
  const t = ctx.currentTime;
  try {
    // Brown noise low-pass 500 Hz, 0.45 s (heavy stone drag)
    const lenBrown = Math.floor(ctx.sampleRate * 0.45);
    const bufBrown = ctx.createBuffer(1, lenBrown, ctx.sampleRate);
    const dataBrown = bufBrown.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < lenBrown; i++) {
      const white = Math.random() * 2 - 1;
      dataBrown[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = dataBrown[i];
    }
    const srcBrown = ctx.createBufferSource();
    srcBrown.buffer = bufBrown;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const gBrown = ctx.createGain();
    gBrown.gain.setValueAtTime(0.2, t);
    gBrown.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    srcBrown.connect(lp).connect(gBrown).connect(sound.dry);
    srcBrown.start(t);

    // Sand hiss: high-pass 4 kHz, very quiet (ART-DIRECTION §7.3)
    const lenHiss = Math.floor(ctx.sampleRate * 0.35);
    const bufHiss = ctx.createBuffer(1, lenHiss, ctx.sampleRate);
    const dataHiss = bufHiss.getChannelData(0);
    for (let i = 0; i < lenHiss; i++) dataHiss[i] = (Math.random() * 2 - 1) * 0.03;
    const srcHiss = ctx.createBufferSource();
    srcHiss.buffer = bufHiss;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;
    const gHiss = ctx.createGain();
    gHiss.gain.setValueAtTime(0.04, t);
    gHiss.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    srcHiss.connect(hp).connect(gHiss).connect(sound.dry);
    srcHiss.start(t);
  } catch (_) {}
}

export const batu = {
  id: 'batu',
  name: 'Taman Batu',
  counterLabel: 'batu',
  solvedLine: 'Taman telah seimbang',
  accent: '#b8f0c8',
  scale: PENTATONIC,
  objectScale: 1.0,
  haloY: 0.4,
  parts: batuParts,
  targetParts: batuTargetParts,
  roomExtras: createRakedSandExtras,
  createObject: createBatuObject,
  createTarget: createBatuTarget,
  instrument: koto,
  pushSound: heavyStonePush,
};
