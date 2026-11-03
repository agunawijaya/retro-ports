/**
 * @file Mata Air theme (ART-DIRECTION §7.5, GAME-DESIGN §6).
 * Channel plug and the sacred spring with progressive rising water.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PENTATONIC } from './scales.js';
import { pastel, roles } from '../render/pastel.js';
import { waterMaterial } from '../render/water.js';
import { cellX, cellZ } from '../render/board.js';
import { damp, easeInOutSine } from '../render/math.js';
import { reducedMotion } from '../state/settings.js';

function createPlugGeometry() {
  const geos = [];
  // Basalt plug: cylinder r 0.27, h 0.3, a rounded top and a small grip
  const baseChamfer = new THREE.CylinderGeometry(0.25, 0.27, 0.04, 24).translate(0, 0.02, 0);
  const cyl = new THREE.CylinderGeometry(0.27, 0.27, 0.26, 24).translate(0, 0.17, 0);
  const cap = new THREE.SphereGeometry(0.27, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.62, 1).translate(0, 0.3, 0);
  const stem = new THREE.CylinderGeometry(0.06, 0.07, 0.04, 16).translate(0, 0.468, 0);
  const knob = new THREE.SphereGeometry(0.055, 16, 12).translate(0, 0.51, 0);
  geos.push(baseChamfer, cyl, cap, stem, knob);
  return mergeGeometries(geos);
}

// The carved band around the plug's waist: the part that glows when the
// plug seals a spring (the common lit rule of ART-DIRECTION §7).
function createBandGeometry() {
  return new THREE.TorusGeometry(0.276, 0.024, 8, 32).rotateX(Math.PI / 2).translate(0, 0.17, 0);
}

function createLeakRingGeometry() {
  // Ring stone (torus r 0.24, tube 0.06) on a thin lip; open in the middle
  // so the dark water inside it is seen.
  const ring = new THREE.TorusGeometry(0.24, 0.06, 12, 32).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
  const lip = new THREE.RingGeometry(0.26, 0.36, 32).rotateX(-Math.PI / 2).translate(0, 0.006, 0);
  return mergeGeometries([ring, lip]);
}

function createDarkWaterDiscGeometry() {
  // The spring's dark water (#7fa6b6), just above the floor inside the ring:
  // a hole in the floor reads as one at play distance without cutting tiles.
  return new THREE.CircleGeometry(0.205, 32).rotateX(-Math.PI / 2).translate(0, 0.014, 0);
}

const plugGeo = createPlugGeometry();
const bandGeo = createBandGeometry();
const leakRingGeo = createLeakRingGeometry();
const darkWaterDiscGeo = createDarkWaterDiscGeometry();

export const mataAirParts = [
  { geometry: plugGeo, color: '#d6d9d2', transform: null, glows: false },
  { geometry: bandGeo, color: '#bcc6c2', transform: null, glows: true },
];

export const mataAirTargetParts = [
  { geometry: leakRingGeo, role: 'goal', transform: null, glows: false },
  { geometry: darkWaterDiscGeo, color: '#7fa6b6', transform: null, glows: true },
];

/**
 * Calculates the water level y for a given sealed count (ART-DIRECTION §7.5).
 * Starts at -0.25, each sealed hole adds 0.2 / goalCount, reaching -0.05 when all sealed.
 * @param {number} sealedCount
 * @param {number} goalCount
 * @returns {number}
 */
export function waterLevelFor(sealedCount, goalCount) {
  if (!goalCount || goalCount <= 0) return -0.05;
  const count = Math.min(goalCount, Math.max(0, sealedCount));
  if (count === goalCount) return -0.05;
  if (count === 0) return -0.25;
  return -0.25 + count * (0.2 / goalCount);
}

// Standalone object for tower alcoves
function createMataAirObject() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const stoneMat = pastel('#d6d9d2');
  const bandMat = pastel('#bcc6c2', { glow: '#9fe3e0' });
  body.add(new THREE.Mesh(plugGeo, stoneMat), new THREE.Mesh(bandGeo, bandMat));

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
      this.lit = damp(this.lit, this.isLit ? 1 : 0, this.isLit ? 3.2 : 6, dt);
      if (glow) bandMat.uniforms.uGlow.value.copy(glow);
      bandMat.uniforms.uGlowAmt.value = this.lit * 0.95;
    },
  };
}

// Standalone target for tower alcoves
function createMataAirTarget() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(leakRingGeo, pastel(null, { roleColor: roles.goal }));
  const waterMat = pastel('#7fa6b6', { glow: '#9fe3e0' });
  const waterDisc = new THREE.Mesh(darkWaterDiscGeo, waterMat);
  group.add(ring, waterDisc);

  return {
    group,
    update(dt, t, glow, covered) {
      waterMat.uniforms.uGlow.value.copy(glow);
      const c = group.userData.col ?? 0;
      waterMat.uniforms.uGlowAmt.value = covered ? 0 : (reducedMotion() ? 0.35 : 0.35 + Math.sin(t * 1.6 + c) * 0.15);
    },
  };
}

// Helper: 8-petal blooming padma geometry for void water channels
function createVoidLotusGeometry() {
  const geos = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const petal = new THREE.CircleGeometry(0.045, 12);
    petal.scale(0.7, 1.4, 1);
    petal.rotateX(-Math.PI / 2);
    petal.rotateY(angle);
    petal.translate(Math.cos(angle) * 0.055, 0.002, Math.sin(angle) * 0.055);
    geos.push(petal);
  }
  const center = new THREE.CircleGeometry(0.035, 16);
  center.rotateX(-Math.PI / 2);
  center.translate(0, 0.004, 0);
  geos.push(center);
  return mergeGeometries(geos);
}

function easeOutBack(p, c1 = 1.6) {
  const c3 = c1 + 1;
  const x = Math.max(0, Math.min(1, p));
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

// The spring runs in a stone channel that wraps the room on the outside of
// its wall ring: the void cells next to the room (diagonals included, so the
// channel turns its corners). Each sealed hole raises the water by
// 0.2 / goalCount and opens one lotus on it; all sealed, the water stands at
// y -0.05, just under the lip, and spills off the front edge of the plinth.
// Four draw calls whatever the room: troughs, water, lotuses, waterfall.
function createWaterChannelExtras(level, islandGroup) {
  const waterGroup = new THREE.Group();
  islandGroup.add(waterGroup);

  const isRoom = (r, c) => !!(level.inside[r]?.[c] || level.wall[r]?.[c]);
  const isChannel = new Set();
  const cells = [];
  for (let r = -1; r <= level.rows; r++) {
    for (let c = -1; c <= level.cols; c++) {
      if (isRoom(r, c)) continue;
      let touches = false;
      for (let dr = -1; dr <= 1 && !touches; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if ((dr || dc) && level.wall[r + dr]?.[c + dc]) { touches = true; break; }
        }
      }
      if (!touches) continue;
      isChannel.add(`${r},${c}`);
      cells.push({ r, c, x: cellX(c), z: cellZ(r) });
    }
  }

  const BED = -0.3; // top of the channel bed
  const LIP = -0.02; // top of the outer lip
  const troughGeos = [];
  const waterGeos = [];
  const SIDES = [[-1, 0, 0, -0.5], [1, 0, 0, 0.5], [0, -1, -0.5, 0], [0, 1, 0.5, 0]];
  for (const cell of cells) {
    troughGeos.push(new THREE.BoxGeometry(1, 0.12, 1).translate(cell.x, BED - 0.06, cell.z));
    waterGeos.push(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(cell.x, 0, cell.z));
    // A lip wherever the channel meets open air; the room's plinth is the
    // inner wall and a neighbouring channel cell carries the water on.
    for (const [dr, dc, ox, oz] of SIDES) {
      const nr = cell.r + dr;
      const nc = cell.c + dc;
      if (isChannel.has(`${nr},${nc}`) || isRoom(nr, nc)) continue;
      const along = dr === 0;
      const lip = new THREE.BoxGeometry(along ? 0.08 : 1.08, LIP - BED + 0.12, along ? 1.08 : 0.08);
      lip.translate(cell.x + ox * 0.92, (LIP + BED - 0.12) / 2, cell.z + oz * 0.92);
      troughGeos.push(lip);
    }
  }

  let trough = null;
  let water = null;
  if (cells.length) {
    trough = new THREE.Mesh(mergeGeometries(troughGeos), pastel(null, { roleColor: roles.stone }));
    waterGroup.add(trough);
    water = new THREE.Mesh(mergeGeometries(waterGeos), waterMaterial(0.8));
    water.position.y = -0.25;
    water.renderOrder = 2;
    waterGroup.add(water);
  }
  troughGeos.forEach((g) => g.dispose());
  waterGeos.forEach((g) => g.dispose());

  // Lotuses: one per hole, spread evenly along the channel.
  const goalCount = level.targets?.length ?? 1;
  const lotusGeo = createVoidLotusGeometry();
  const lotusMat = pastel('#f5c2cf');
  const lotuses = new THREE.InstancedMesh(lotusGeo, lotusMat, Math.max(1, goalCount));
  lotuses.renderOrder = 3;
  const lotusAt = Array.from({ length: goalCount }, (_, i) =>
    cells.length ? cells[Math.floor(((i + 0.5) * cells.length) / goalCount) % cells.length] : { x: 0, z: 0 });
  const bloomTimes = new Array(goalCount).fill(0);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  waterGroup.add(lotuses);

  // The waterfall leaves from the channel cell nearest the camera's side of
  // the room (largest x + z at the default view) over its open edge.
  const front = cells.reduce((best, cell) => (!best || cell.x + cell.z > best.x + best.z ? cell : best), null);
  const fallTex = waterfallTexture();
  const fallMat = new THREE.MeshBasicMaterial({
    map: fallTex, color: '#eafbf8', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 2.8), fallMat);
  if (front) {
    const outward = SIDES.find(([dr, dc]) => !isChannel.has(`${front.r + dr},${front.c + dc}`) && !isRoom(front.r + dr, front.c + dc) && (dr > 0 || dc > 0))
      ?? SIDES.find(([dr, dc]) => !isChannel.has(`${front.r + dr},${front.c + dc}`) && !isRoom(front.r + dr, front.c + dc));
    const [, , ox, oz] = outward ?? [0, 1, 0, 0.5];
    fall.position.set(front.x + ox * 1.02, LIP - 1.4, front.z + oz * 1.02);
    fall.rotation.y = Math.atan2(ox, oz);
  }
  fall.visible = false;
  waterGroup.add(fall);

  let level01 = -0.25;

  return {
    update(dt, t, progress) {
      const lit = progress?.litCount ?? 0;
      const goals = progress?.goalCount ?? goalCount;
      level01 = damp(level01, waterLevelFor(lit, goals), 2.5, dt);
      if (water) water.position.y = level01;

      for (let i = 0; i < goalCount; i++) {
        bloomTimes[i] = lit > i ? Math.min(0.6, bloomTimes[i] + dt) : Math.max(0, bloomTimes[i] - dt);
        const k = bloomTimes[i] <= 0 ? 0 : easeOutBack(bloomTimes[i] / 0.6, 1.4);
        const at = lotusAt[i];
        q.setFromAxisAngle(up, i * 1.7);
        m4.compose(pos.set(at.x + Math.sin(i * 2.3) * 0.18, level01 + 0.012, at.z + Math.cos(i * 1.9) * 0.18), q, scl.setScalar(k * 2.6 + 1e-4));
        lotuses.setMatrixAt(i, m4);
      }
      lotuses.instanceMatrix.needsUpdate = true;

      const allSealed = goals > 0 && lit >= goals;
      fallMat.opacity = damp(fallMat.opacity, allSealed ? 0.85 : 0, 2.0, dt);
      fall.visible = fallMat.opacity > 0.01;
      if (fall.visible) fallTex.offset.y = (t * 0.8) % 1;
    },
    dispose() {
      trough?.geometry.dispose();
      trough?.material.dispose();
      water?.geometry.dispose();
      water?.material.dispose();
      lotuses.dispose();
      lotusGeo.dispose();
      lotusMat.dispose();
      fall.geometry.dispose();
      fallMat.dispose();
      fallTex.dispose();
      islandGroup.remove(waterGroup);
    },
  };
}

/** A falling-water strip drawn in code: soft edges, a few streaks, scrolling down. */
function waterfallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  for (let x = 0; x < 32; x++) {
    const edge = Math.sin((x / 31) * Math.PI);
    for (let y = 0; y < 128; y++) {
      const streak = 0.55 + 0.45 * Math.sin(x * 1.7 + Math.sin(y * 0.09 + x) * 2);
      const fade = y < 12 ? y / 12 : y > 96 ? (128 - y) / 32 : 1;
      g.fillStyle = `rgba(255,255,255,${(edge * streak * fade).toFixed(3)})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const handpan = {
  play(sound, freq, when = 0, level = 0.16) {
    const ctx = sound.ctx;
    const t = ctx.currentTime + when;
    // Handpan partials (ART-DIRECTION §7.5): 1 : 2 : 3, amplitudes 1 : 0.35 : 0.12, 15 ms attack, decay 3.5 s
    const partials = [[1, 1], [2, 0.35], [3, 0.12]];
    for (const [ratio, amp] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level * amp, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5 / Math.sqrt(ratio));
      o.connect(g).connect(sound.dry);
      o.start(t);
      o.stop(t + 3.6);
    }
    // Water drip: sine 1.2 kHz -> 600 Hz in 60 ms (ART-DIRECTION §7.5)
    try {
      const dripOsc = ctx.createOscillator();
      dripOsc.type = 'sine';
      dripOsc.frequency.setValueAtTime(1200, t);
      dripOsc.frequency.exponentialRampToValueAtTime(600, t + 0.06);
      const dripGain = ctx.createGain();
      dripGain.gain.setValueAtTime(0.08, t);
      dripGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      dripOsc.connect(dripGain).connect(sound.dry);
      dripOsc.start(t);
      dripOsc.stop(t + 0.09);
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

function wetStonePush(sound) {
  const ctx = sound.ctx;
  if (!ctx) return;
  const t = ctx.currentTime;
  try {
    // Wet stone bandpass 450 Hz, Q 1.2, 0.35 s (ART-DIRECTION §7.5)
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.35), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 450;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    src.connect(bp).connect(g).connect(sound.dry);
    src.start(t);

    // Small splash: noise highpass 3 kHz, 0.12 s
    const sBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
    const sData = sBuf.getChannelData(0);
    for (let i = 0; i < sData.length; i++) sData[i] = (Math.random() * 2 - 1) * 0.05;
    const sSrc = ctx.createBufferSource();
    sSrc.buffer = sBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.08, t);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    sSrc.connect(hp).connect(sg).connect(sound.dry);
    sSrc.start(t);
  } catch (_) {}
}

export const mataAir = {
  id: 'mata-air',
  name: 'Mata Air',
  counterLabel: 'mata air',
  solvedLine: 'Mata air telah pulih',
  accent: '#9fe3e0',
  scale: PENTATONIC,
  objectScale: 1.0,
  haloY: 0.35,
  parts: mataAirParts,
  targetParts: mataAirTargetParts,
  roomExtras: createWaterChannelExtras,
  createObject: createMataAirObject,
  createTarget: createMataAirTarget,
  instrument: handpan,
  pushSound: wetStonePush,
};
