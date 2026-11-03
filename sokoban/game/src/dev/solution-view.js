/**
 * Hidden helper: replays room solution for owner verification.
 */

import * as THREE from 'three';
import { getSolution } from '../data/solutions.js';
import { cellX, cellZ } from '../render/board.js';
import { el } from '../ui/veil.js';
import SolverWorker from '../core/solver/worker.js?worker&inline';

let active = false;
let roomContext = null;
let savedAttempt = null;
let currentStep = 0;
let solutionLurd = '';
let playing = false;
let playTimer = 0;
let worker = null;
let searchTimer = 0;
let searchInterval = null;
let playPos = { r: 0, c: 0 }; // the playback's own grid position; world coords are centred, never round-tripped

let stripEl = null;

const DIRS = {
  u: [-1, 0], U: [-1, 0],
  d: [1, 0],  D: [1, 0],
  l: [0, -1], L: [0, -1],
  r: [0, 1],  R: [0, 1],
};

// The playback walks the same dream ghost as Mimpi: half-lit toward dream
// lavender, transparent, no depth writes (ART-DIRECTION §13.9). The pastel
// material reads uniforms, not material.opacity — the original values are
// stashed so closing the helper brings the real wanderer back untouched.
let dreamStash = null;

function applyDreamLook(wanderer) {
  const tint = new THREE.Color('#d8d4ff');
  dreamStash = [];
  wanderer.root.traverse((obj) => {
    if (!obj.material) return;
    const mat = obj.material;
    const u = mat.uniforms;
    if (u?.uOpacity) {
      dreamStash.push({
        u,
        opacity: u.uOpacity.value,
        color: u.uColor?.value?.clone(),
        glow: u.uGlow?.value?.clone(),
        transparent: mat.transparent,
        depthWrite: mat.depthWrite,
        mat,
      });
      u.uOpacity.value = 0.45;
      if (u.uColor?.value?.lerp) u.uColor.value.lerp(tint, 0.5);
      if (u.uGlow?.value?.lerp) u.uGlow.value.lerp(tint, 0.5);
    } else {
      dreamStash.push({
        u: null,
        opacity: mat.opacity,
        color: mat.color?.clone(),
        transparent: mat.transparent,
        depthWrite: mat.depthWrite,
        mat,
      });
      if (mat.color?.lerp) mat.color.lerp(tint, 0.5);
      mat.opacity = Math.min(mat.opacity ?? 1, 0.45);
    }
    mat.transparent = true;
    mat.depthWrite = false;
    mat.needsUpdate = true;
  });
  if (wanderer.shadow?.material) {
    wanderer.shadow.material.opacity = 0.14;
    wanderer.shadow.material.needsUpdate = true;
  }
}

function restoreDreamLook() {
  if (!dreamStash) return;
  for (const saved of dreamStash) {
    if (saved.u) {
      saved.u.uOpacity.value = saved.opacity;
      if (saved.color && saved.u.uColor) saved.u.uColor.value.copy(saved.color);
      if (saved.glow && saved.u.uGlow) saved.u.uGlow.value.copy(saved.glow);
    } else {
      saved.mat.opacity = saved.opacity;
      if (saved.color && saved.mat.color) saved.mat.color.copy(saved.color);
    }
    saved.mat.transparent = saved.transparent;
    saved.mat.depthWrite = saved.depthWrite;
    saved.mat.needsUpdate = true;
  }
  if (roomContext?.wanderer?.shadow?.material) {
    roomContext.wanderer.shadow.material.opacity = 0.32;
    roomContext.wanderer.shadow.material.needsUpdate = true;
  }
  dreamStash = null;
}

// The veiled strip is the only visible part of the helper: a glass pill
// holding ink chevrons, the step count, a play/pause toggle and a hairline
// that fills as the solution advances.
/** A strip button holding one of the constant glyphs below (markup, not text). */
function iconButton(svg, extra = '') {
  const btn = el('button', `strip-btn icon-btn${extra ? ` ${extra}` : ''}`);
  btn.innerHTML = svg;
  return btn;
}

const STRIP_ICONS = {
  prev: '<svg viewBox="0 0 24 24"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M9 6.2v11.6L18.4 12z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M9 6v12M15 6v12" stroke-width="2.4"/></svg>',
};

function createHelperStrip(totalSteps) {
  const root = el('div', 'helper-strip');
  const inner = el('div', 'helper-strip-inner');

  const prevBtn = iconButton(STRIP_ICONS.prev);
  prevBtn.title = 'Langkah sebelumnya (←)';
  prevBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    stepBack();
  });

  const stepLabel = el('span', 'strip-label', `langkah ${currentStep} / ${totalSteps}`);

  const nextBtn = iconButton(STRIP_ICONS.next);
  nextBtn.title = 'Langkah berikutnya (→)';
  nextBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    stepForward();
  });

  const playBtn = iconButton(playing ? STRIP_ICONS.pause : STRIP_ICONS.play, 'play-btn');
  playBtn.title = 'Putar / Jeda (Spasi)';
  playBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    togglePlay();
  });

  const progress = el('div', 'strip-progress');
  const progressFill = el('div', 'strip-progress-fill');
  progress.appendChild(progressFill);

  const closeBtn = el('button', 'strip-btn close-btn', 'esc');
  closeBtn.title = 'Tutup (Esc)';
  closeBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    closeHelper();
  });

  inner.append(prevBtn, stepLabel, nextBtn, playBtn, progress, closeBtn);
  root.appendChild(inner);
  document.body.appendChild(root);

  return { root, stepLabel, playBtn, progressFill };
}

export function isHelperActive() {
  return active;
}

export function openHelper(ctx) {
  if (active) {
    closeHelper();
    return;
  }

  roomContext = ctx;
  active = true;
  playing = false;
  currentStep = 0;
  playTimer = 0;

  // 1. Freeze attempt and dim HUD
  savedAttempt = ctx.saveAttempt();
  ctx.dimHud(true);
  ctx.markAssisted();

  // 2. Fetch stored solution or start Web Worker
  const sol = getSolution(ctx.roomNumber);
  if (sol && sol.lurd) {
    solutionLurd = sol.lurd;
    startPlayback();
  } else {
    startSearch();
  }
}

function startSearch() {
  stripEl = {
    root: el('div', 'helper-strip searching'),
    stepLabel: el('span', 'strip-label breathing', 'mencari jalan…'),
  };
  stripEl.root.appendChild(stripEl.stepLabel);
  document.body.appendChild(stripEl.root);

  searchTimer = 0;
  try {
    worker = new SolverWorker();
  } catch (err) {
    stripEl.stepLabel.textContent = 'solver tidak tersedia';
    return;
  }

  worker.onmessage = (event) => {
    const data = event.data || {};
    if (data.lurd) {
      solutionLurd = data.lurd;
      clearInterval(searchInterval);
      worker?.terminate();
      worker = null;
      if (roomContext.onSolutionFound) {
        roomContext.onSolutionFound(solutionLurd);
      }
      stripEl.root.remove();
      startPlayback();
    } else if (data.failed) {
      clearInterval(searchInterval);
      stripEl.stepLabel.textContent = 'jalan tidak ditemukan';
    }
  };

  const rows = roomContext.level.raw.map((r) => r.join(''));
  worker.postMessage({ rows, budget: 20000 });

  searchInterval = setInterval(() => {
    searchTimer += 1;
    if (searchTimer >= 20) {
      clearInterval(searchInterval);
      showSearchTimeout();
    }
  }, 1000);
}

function showSearchTimeout() {
  if (!stripEl?.root) return;
  stripEl.root.innerHTML = '';
  const msg = el('span', 'strip-label', 'belum ditemukan dalam 20 detik');
  const keepSearching = el('button', 'strip-btn', 'cari lagi (60 s)');
  keepSearching.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    searchTimer = 0;
    worker?.postMessage({ rows: roomContext.level.raw.map((r) => r.join('')), budget: 60000 });
    stripEl.root.innerHTML = '';
    stripEl.stepLabel = el('span', 'strip-label breathing', 'mencari jalan…');
    stripEl.root.appendChild(stripEl.stepLabel);
  });
  stripEl.root.append(msg, keepSearching);
}

function startPlayback() {
  roomContext.resetToStart();
  applyDreamLook(roomContext.wanderer);
  stripEl = createHelperStrip(solutionLurd.length);
}

function updateStrip() {
  if (stripEl?.stepLabel) {
    stripEl.stepLabel.textContent = `langkah ${currentStep} / ${solutionLurd.length}`;
  }
  if (stripEl?.playBtn) {
    stripEl.playBtn.innerHTML = playing ? STRIP_ICONS.pause : STRIP_ICONS.play;
  }
  if (stripEl?.progressFill) {
    const frac = solutionLurd.length ? currentStep / solutionLurd.length : 0;
    stripEl.progressFill.style.width = `${(frac * 100).toFixed(1)}%`;
  }
}

export function stepForward() {
  if (!active || !solutionLurd || currentStep >= solutionLurd.length) {
    playing = false;
    updateStrip();
    return;
  }

  const char = solutionLurd[currentStep++];
  applyLurdStep(char, 1);
  updateStrip();
}

export function stepBack() {
  if (!active || !solutionLurd || currentStep <= 0) return;
  currentStep--;
  const char = solutionLurd[currentStep];
  applyLurdStep(char, -1);
  updateStrip();
}

function applyLurdStep(char, direction) {
  const dir = DIRS[char];
  if (!dir) return;

  const [dr, dc] = dir;
  const isPush = char === char.toUpperCase();
  const w = roomContext.wanderer;

  if (direction === 1) {
    // Forward step
    const curR = Math.round(w.root.position.z);
    const curC = Math.round(w.root.position.x);
    const nextR = curR + dr;
    const nextC = curC + dc;

    w.faceDir(dr, dc);
    w.root.position.set(cellX(nextC), 0, cellZ(nextR));

    if (isPush) {
      const boxFromR = nextR;
      const boxFromC = nextC;
      const boxToR = boxFromR + dr;
      const boxToC = boxFromC + dc;

      const objIdx = roomContext.objects.findIndex((o) => o.r === boxFromR && o.c === boxFromC);
      if (objIdx !== -1) {
        roomContext.objects[objIdx].r = boxToR;
        roomContext.objects[objIdx].c = boxToC;
        const meshObj = roomContext.worldObjects[objIdx];
        meshObj.group.position.set(cellX(boxToC), 0, cellZ(boxToR));
        const isLit = roomContext.isTargetAt(boxToR, boxToC);
        meshObj.setLit(isLit);
      }
    }
  } else {
    // Rewind step
    const curR = Math.round(w.root.position.z);
    const curC = Math.round(w.root.position.x);
    const prevR = curR - dr;
    const prevC = curC - dc;

    w.faceDir(-dr, -dc);
    w.root.position.set(cellX(prevC), 0, cellZ(prevR));

    if (isPush) {
      const boxCurR = curR + dr;
      const boxCurC = curC + dc;
      const boxPrevR = curR;
      const boxPrevC = curC;

      const objIdx = roomContext.objects.findIndex((o) => o.r === boxCurR && o.c === boxCurC);
      if (objIdx !== -1) {
        roomContext.objects[objIdx].r = boxPrevR;
        roomContext.objects[objIdx].c = boxPrevC;
        const meshObj = roomContext.worldObjects[objIdx];
        meshObj.group.position.set(cellX(boxPrevC), 0, cellZ(boxPrevR));
        const isLit = roomContext.isTargetAt(boxPrevR, boxPrevC);
        meshObj.setLit(isLit);
      }
    }
  }
}

function togglePlay() {
  playing = !playing;
  updateStrip();
}

function rewindToHome() {
  while (currentStep > 0) {
    stepBack();
  }
  playing = false;
  updateStrip();
}

export function closeHelper() {
  if (!active) return;
  active = false;
  playing = false;
  clearInterval(searchInterval);
  worker?.terminate();
  worker = null;

  stripEl?.root?.remove();
  stripEl = null;
  restoreDreamLook();

  if (roomContext && savedAttempt) {
    roomContext.restoreAttempt(savedAttempt);
    roomContext.dimHud(false);
  }
  roomContext = null;
  savedAttempt = null;
}

export function update(dt) {
  if (!active || !playing) return;
  playTimer += dt;
  if (playTimer >= 0.25) {
    playTimer -= 0.25;
    stepForward();
  }
}

// Global key handler
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC' && e.ctrlKey && e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      if (active) closeHelper();
      else if (window.hening?.helper) window.hening.helper();
      return;
    }

    if (!active) return;

    if (e.code === 'ArrowRight') {
      e.preventDefault();
      stepForward();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      stepBack();
    } else if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'Home') {
      e.preventDefault();
      rewindToHome();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      closeHelper();
    }
  });
}
