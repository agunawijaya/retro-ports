/**
 * @file Mimpi — demo tour (GAME-DESIGN §7.7, ART-DIRECTION §13.9).
 * Cross-fade from courtyard, dream wanderer performs solution at 4 steps/s,
 * CSS vignette, caption 'mimpi', wake on any input.
 */

import * as THREE from 'three';
import { rooms } from '../data/rooms.js';
import { parseLevel } from '../core/level.js';
import { getSolution } from '../data/solutions.js';
import { createRoomWorld } from '../world/room-world.js';
import { cellX, cellZ } from '../render/board.js';
import { setMoodPosition } from '../render/moods.js';
import { getTheme, notesFor } from '../themes/index.js';
import { getSettings, reducedMotion } from '../state/settings.js';
import { el } from '../ui/veil.js';

let ctx = null;
let world = null;
let level = null;
let solution = null;
let theme = null;
let notes = [];
let courtyardState = null;

let lurdIndex = 0;
let isEnding = false;
let endTimer = 0;
let waking = false;
let pos = { r: 0, c: 0 }; // the dream's own grid position; world coords are centred, never round-tripped

let vignetteEl = null;

// Tile travel time for dream: 4 steps per second = 0.25s
const DREAM_STEP_SEC = 0.25;

const DIRS = {
  u: [-1, 0], U: [-1, 0],
  d: [1, 0],  D: [1, 0],
  l: [0, -1], L: [0, -1],
  r: [0, 1],  R: [0, 1],
};

const lerp = (a, b, t) => a + (b - a) * t;
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const smooth = (t) => t * t * (3 - 2 * t);

let currentMove = null;
let stepCounter = 0;

// The dream wanderer is a ghost of the real one: every surface half-lit
// toward dream lavender, transparent, writing no depth (ART-DIRECTION §13.9).
// The pastel material reads uniforms, not material.opacity, so both are set.
function applyDreamLook(wanderer) {
  const tint = new THREE.Color('#d8d4ff');
  wanderer.root.traverse((obj) => {
    if (!obj.material) return;
    const mat = obj.material;
    const u = mat.uniforms;
    if (u?.uOpacity) {
      u.uOpacity.value = 0.45;
      if (u.uColor?.value?.lerp) u.uColor.value.lerp(tint, 0.5);
      if (u.uGlow?.value?.lerp) u.uGlow.value.lerp(tint, 0.5);
    } else {
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

// The dream's frame: a soft vignette toward the mood veil at the edges and
// the quiet caption, both fading in with the cross-fade.
function createDreamUi() {
  const root = el('div', 'dream-ui-overlay');
  const vignette = el('div', 'dream-vignette');
  const caption = el('div', 'dream-caption', 'mimpi');
  root.append(vignette, caption);
  document.body.appendChild(root);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('on')));
  return root;
}

export function enter(c, params = {}) {
  ctx = c;
  courtyardState = params.courtyardState ?? null;
  waking = false;
  isEnding = false;
  endTimer = 0;
  lurdIndex = 0;
  currentMove = null;
  stepCounter = 0;

  const roomNum = params.room ?? 1;
  const roomDef = rooms.find((r) => r.number === roomNum) ?? rooms[0];
  level = parseLevel(roomDef.rows);
  pos = { r: level.start.r, c: level.start.c };

  // Room mood follows chapter progress (§5.3: 0 = Fajar … 3 = Malam)
  const moodPosition = ((roomNum - 1) % 10) / 3;
  setMoodPosition(moodPosition, true);

  theme = getTheme(getSettings().theme ?? 'lentera');
  notes = notesFor(theme, level.targets.length);

  world = createRoomWorld({
    canvas: ctx.canvas,
    level,
    theme,
    rand: () => 0.5,
  });

  applyDreamLook(world.wanderer);

  const solData = getSolution(roomNum);
  solution = solData?.lurd ?? '';

  vignetteEl = createDreamUi();
  ctx.hud.setVisible({ title: false, tools: false, counters: false, hint: false });
}

function wake() {
  if (waking) return;
  waking = true;
  ctx.router.goto('courtyard', { fromDream: true, atPlayer: courtyardState?.player, yaw: courtyardState?.yaw }, { crossfade: 0.8 });
}

function startNextStep() {
  if (lurdIndex >= solution.length) {
    if (!isEnding) {
      isEnding = true;
      world.wanderer.move = null;
      world.wanderer.perform('bow');
    }
    return;
  }

  const char = solution[lurdIndex++];
  const dir = DIRS[char];
  if (!dir) return;

  const [dr, dc] = dir;
  const isPush = char === char.toUpperCase();

  const fromR = pos.r;
  const fromC = pos.c;
  const toR = fromR + dr;
  const toC = fromC + dc;
  pos = { r: toR, c: toC };

  world.wanderer.faceDir(dr, dc);

  let objIndex = -1;
  let boxFromR = 0;
  let boxFromC = 0;
  let boxToR = 0;
  let boxToC = 0;

  if (isPush) {
    boxFromR = toR;
    boxFromC = toC;
    boxToR = boxFromR + dr;
    boxToC = boxFromC + dc;

    objIndex = level.objects.findIndex((o) => o.r === boxFromR && o.c === boxFromC);
    if (objIndex !== -1) {
      level.objects[objIndex].r = boxToR;
      level.objects[objIndex].c = boxToC;
    }
  }

  currentMove = {
    kind: isPush ? 'push' : 'walk',
    p: 0,
    from: { r: fromR, c: fromC },
    to: { r: toR, c: toC },
    dr, dc,
    isPush,
    objIndex,
    boxFrom: isPush ? { r: boxFromR, c: boxFromC } : null,
    boxTo: isPush ? { r: boxToR, c: boxToC } : null,
    stepIndex: stepCounter++,
  };
}

export function exit() {
  vignetteEl?.remove();
  vignetteEl = null;
  world?.dispose();
  world = null;
  ctx = null;
  currentMove = null;
}

export function resize() {
  world?.resize();
}

export function update(dt, t) {
  if (!world || waking) return;

  if (isEnding) {
    endTimer += dt;
    if (endTimer >= 3.0) {
      wake();
    }
  } else if (currentMove) {
    currentMove.p = Math.min(1, currentMove.p + dt / DREAM_STEP_SEC);
    const p = currentMove.p;
    const e = currentMove.isPush ? smooth(p) : easeInOutSine(p);

    const w = world.wanderer;
    w.root.position.x = lerp(cellX(currentMove.from.c), cellX(currentMove.to.c), e);
    w.root.position.z = lerp(cellZ(currentMove.from.r), cellZ(currentMove.to.r), e);
    w.move = {
      kind: currentMove.kind,
      p,
      stepIndex: currentMove.stepIndex,
      demo: true,
    };

    if (currentMove.isPush && currentMove.objIndex !== -1) {
      const themeObj = world.objects[currentMove.objIndex];
      const boxX = lerp(cellX(currentMove.boxFrom.c), cellX(currentMove.boxTo.c), e);
      const boxZ = lerp(cellZ(currentMove.boxFrom.r), cellZ(currentMove.boxTo.r), e);
      themeObj.group.position.set(boxX, 0, boxZ);
    }

    if (p >= 1) {
      w.root.position.x = cellX(currentMove.to.c);
      w.root.position.z = cellZ(currentMove.to.r);
      w.move = null;

      if (currentMove.isPush && currentMove.objIndex !== -1) {
        const themeObj = world.objects[currentMove.objIndex];
        themeObj.group.position.set(cellX(currentMove.boxTo.c), 0, cellZ(currentMove.boxTo.r));
        const targetIndex = level.targets.findIndex((tgt) => tgt.r === currentMove.boxTo.r && tgt.c === currentMove.boxTo.c);
        const isLit = targetIndex !== -1;
        themeObj.setLit(isLit);
        if (isLit) {
          const note = notes[targetIndex % notes.length];
          // 05: was `playNote`, which the engine never had — the throw stopped the frame loop at the first lit lantern.
          ctx.sound.chime(note, 0, 0.1);
        }
      }

      // One mote left behind per step
      if (!reducedMotion()) world.fx.mote(cellX(currentMove.from.c), 0.2, cellZ(currentMove.from.r));
      currentMove = null;
      startNextStep();
    }
  } else {
    startNextStep();
  }

  world.update(dt, t);
  world.render();
}

export const input = {
  onDirection: () => wake(),
  onConfirm: () => wake(),
  onSkip: () => wake(),
  onBack: () => wake(),
  onUndo: () => wake(),
  onRestart: () => wake(),
  onRotate: () => wake(),
  onAnyKey: () => wake(),
  onPointerDown: () => wake(),
};
