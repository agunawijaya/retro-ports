/**
 * @file Candi theme (ART-DIRECTION §7.4, GAME-DESIGN §6).
 * Stupa stone on a temple terrace with slendro tuning.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SLENDRO } from './scales.js';
import { pastel, roles } from '../render/pastel.js';
import { reducedMotion } from '../state/settings.js';

function createStupaGeometry() {
  const geos = [];
  // Stepped square base (0.5 x 0.12 x 0.5)
  const baseLower = new THREE.BoxGeometry(0.50, 0.06, 0.50).translate(0, 0.03, 0);
  const baseUpper = new THREE.BoxGeometry(0.44, 0.06, 0.44).translate(0, 0.09, 0);
  geos.push(baseLower, baseUpper);

  // Octagonal ring (r 0.24, h 0.08)
  const octRing = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 8).translate(0, 0.16, 0);
  geos.push(octRing);

  // Bell dome via LatheGeometry (r 0.24, h 0.34 from y 0.20 to 0.54)
  // Recreates authentic Borobudur bell curvature with lotus neck
  const points = [];
  const bellSteps = [
    [0.24, 0.20],
    [0.24, 0.24],
    [0.235, 0.29],
    [0.22, 0.35],
    [0.19, 0.41],
    [0.145, 0.46],
    [0.095, 0.51],
    [0.065, 0.54],
  ];
  for (const [r, y] of bellSteps) {
    points.push(new THREE.Vector2(r, y));
  }
  const bell = new THREE.LatheGeometry(points, 24);
  geos.push(bell);

  // Harmika (box shelf at dome apex)
  const harmika = new THREE.CylinderGeometry(0.065, 0.065, 0.03, 8).translate(0, 0.555, 0);
  geos.push(harmika);

  // Spire cone (r 0.05, h 0.18) with tiered chhatra rings
  const spireCone = new THREE.ConeGeometry(0.048, 0.18, 16).translate(0, 0.66, 0);
  const ring1 = new THREE.CylinderGeometry(0.075, 0.075, 0.012, 16).translate(0, 0.585, 0);
  const ring2 = new THREE.CylinderGeometry(0.062, 0.062, 0.010, 16).translate(0, 0.625, 0);
  const ring3 = new THREE.CylinderGeometry(0.048, 0.048, 0.008, 16).translate(0, 0.665, 0);
  const finialBall = new THREE.SphereGeometry(0.022, 12, 8).translate(0, 0.755, 0);
  geos.push(spireCone, ring1, ring2, ring3, finialBall);

  return mergeGeometries(geos);
}

function createWindowsGeometry() {
  const geos = [];
  // 8 small diamond windows (emissive boxes 0.04 tilted 45 deg) along the bell curve
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const r = 0.218; // radius at y 0.36 on the bell dome
    const w = new THREE.BoxGeometry(0.04, 0.04, 0.04);
    w.rotateZ(Math.PI / 4); // diamond orientation
    w.rotateY(angle);
    w.translate(Math.cos(angle) * r, 0.36, Math.sin(angle) * r);
    geos.push(w);
  }
  return mergeGeometries(geos);
}

function createSocketGeometry() {
  const geos = [];
  // Stepped temple terrace socket (0.66 x 0.04 x 0.66)
  const baseSlab = new THREE.BoxGeometry(0.66, 0.024, 0.66).translate(0, 0.012, 0);
  const terraceBorder = new THREE.BoxGeometry(0.60, 0.018, 0.60).translate(0, 0.031, 0);
  geos.push(baseSlab, terraceBorder);
  return mergeGeometries(geos);
}

function createLotusGeometry() {
  const geos = [];
  // 8-petal sculpted padma (torus arcs) inset in socket
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const petal = new THREE.TorusGeometry(0.075, 0.014, 8, 20, Math.PI);
    petal.rotateX(-Math.PI / 2);
    petal.rotateY(angle);
    petal.translate(Math.cos(angle) * 0.13, 0.044, Math.sin(angle) * 0.13);
    geos.push(petal);
  }
  // Central lotus bud
  const centerBud = new THREE.SphereGeometry(0.035, 12, 8);
  centerBud.scale(1, 0.5, 1);
  centerBud.translate(0, 0.042, 0);
  geos.push(centerBud);
  return mergeGeometries(geos);
}

const stupaGeo = createStupaGeometry();
const windowsGeo = createWindowsGeometry();
const socketGeo = createSocketGeometry();
const lotusGeo = createLotusGeometry();

export const candiParts = [
  { geometry: stupaGeo, color: '#cfc8c6', transform: null, glows: false },
  { geometry: windowsGeo, color: '#cfc8c6', transform: null, glows: true, candiDelay: true },
];

export const candiTargetParts = [
  { geometry: socketGeo, role: 'goal', transform: null, glows: false },
  { geometry: lotusGeo, color: '#ffffff', transform: null, glows: true },
];

// Standalone object for tower alcoves
function createCandiObject() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const stoneMat = pastel('#cfc8c6');
  const winMat = pastel('#cfc8c6', { glow: '#ffd08a' });
  const stupa = new THREE.Mesh(stupaGeo, stoneMat);
  const windows = new THREE.Mesh(windowsGeo, winMat);
  body.add(stupa, windows);

  return {
    group,
    body,
    isLit: false,
    lit: 0,
    delayLit: 0,
    flash: 0,
    setLit(on) {
      this.isLit = on;
      if (on) this.flash = 1;
    },
    nudge() {},
    update(dt, t, glow) {
      this.lit = Math.min(1, Math.max(0, this.lit + (this.isLit ? dt * 3.2 : -dt * 6)));
      // Dome windows light 0.3 s later (ART-DIRECTION §7.4)
      if (this.isLit && this.lit > 0.4) {
        this.delayLit = Math.min(1, this.delayLit + dt * 3.2);
      } else if (!this.isLit) {
        this.delayLit = Math.max(0, this.delayLit - dt * 6);
      }
      winMat.uniforms.uGlow.value.copy(glow);
      winMat.uniforms.uGlowAmt.value = this.delayLit * 0.95;
    },
  };
}

// Standalone target for tower alcoves
function createCandiTarget() {
  const group = new THREE.Group();
  const socket = new THREE.Mesh(socketGeo, pastel(null, { roleColor: roles.goal }));
  const lotusMat = pastel('#ffffff', { glow: '#ffd08a' });
  const lotus = new THREE.Mesh(lotusGeo, lotusMat);
  group.add(socket, lotus);

  return {
    group,
    update(dt, t, glow, covered) {
      lotusMat.uniforms.uGlow.value.copy(glow);
      const c = group.userData.col ?? 0;
      lotusMat.uniforms.uGlowAmt.value = covered ? 0 : (reducedMotion() ? 0.35 : 0.35 + Math.sin(t * 1.6 + c) * 0.15);
    },
  };
}

const bonang = {
  play(sound, freq, when = 0, level = 0.16) {
    const ctx = sound.ctx;
    const t = ctx.currentTime + when;
    // Bonang: partials 1 : 2.3 : 3.6, two copies detuned +-3 Hz for gamelan shimmer, decay 2.4 s (ART-DIRECTION §7.4)
    const partials = [[1, 1], [2.3, 0.4], [3.6, 0.15]];
    for (const detune of [-3, 3]) {
      for (const [ratio, amp] of partials) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq * ratio + detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime((level / 2) * amp, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4 / Math.sqrt(ratio));
        o.connect(g).connect(sound.dry);
        o.start(t);
        o.stop(t + 2.5);
      }
    }
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

function stoneOnStonePush(sound) {
  const ctx = sound.ctx;
  if (!ctx) return;
  const t = ctx.currentTime;
  try {
    // 55 Hz sub-bass thump (ART-DIRECTION §7.4)
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(55, t);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.18, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(og).connect(sound.dry);
    o.start(t);
    o.stop(t + 0.35);

    // Stone bandpass 280 Hz, Q 2, 0.4 s
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.08;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 280;
    bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    src.connect(bp).connect(g).connect(sound.dry);
    src.start(t);
  } catch (_) {}
}

export const candi = {
  id: 'candi',
  name: 'Candi',
  counterLabel: 'stupa',
  solvedLine: 'Semua stupa bersinar',
  accent: '#ffd08a',
  scale: SLENDRO,
  objectScale: 1.0,
  haloY: 0.45,
  parts: candiParts,
  targetParts: candiTargetParts,
  updateObject(obj, dt) {
    if (obj.isLit && obj.lit > 0.4) {
      obj.delayLit = Math.min(1, (obj.delayLit || 0) + dt * 3.2);
    } else if (!obj.isLit) {
      obj.delayLit = Math.max(0, (obj.delayLit || 0) - dt * 6);
    }
  },
  createObject: createCandiObject,
  createTarget: createCandiTarget,
  instrument: bonang,
  pushSound: stoneOnStonePush,
};
