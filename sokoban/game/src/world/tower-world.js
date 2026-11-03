/**
 * @file The tower world: the courtyard, its places and Menara Hening in one
 * scene, shared by the title, courtyard, elevator, floor and ending screens
 * so the camera can travel between them without a cut. A room builds its own
 * world; while it plays, this one is disposed (disposeTowerWorld).
 *
 * Space: the root group holds everything in courtyard coordinates (board
 * 9 × 9 centred on the origin, the tower's shaft at z = −9). The root moves
 * so the screen's "anchor" — the place it is about — sits at the world
 * origin: the pastel shader's mist is measured from there, downward from the
 * anchor's floor and outward from its centre, so whatever level the screen
 * shows floats in the clouds like a room does.
 */

import * as THREE from 'three';
import { initRenderer } from '../render/renderer.js';
import { placeView, screenAxes, ELEVATION } from '../render/camera.js';
import { applyMood, moodState } from '../render/moods.js';
import { light } from '../render/pastel.js';
import { board, cellAt } from '../render/board.js';
import { waterUniforms } from '../render/water.js';
import { cloudTexture } from '../render/textures.js';
import { damp, lerp, easeInOutSine, mulberry32, wrapAngle, clamp } from '../render/math.js';
import { createTower, FLOOR_H } from '../render/tower.js';
import { sound } from '../audio/sound.js';
import { getTheme } from '../themes/index.js';
import { getProgress } from '../state/progress.js';
import { getSettings, onSettingsChange, reducedMotion } from '../state/settings.js';
import { Wanderer, MEDITATE_AFTER } from './wanderer.js';
import { createFx } from './fx.js';
import { createAtmosphere } from './atmosphere.js';
import { shadows } from './shadow.js';
import { env } from './decor/env.js';
import { Stranger } from './decor/stranger.js';
import { Crow } from './decor/crows.js';
import { buildCourtyard, COURTYARD_START, TOWER_Z } from './places.js';
import { capstone, AXIS_STEP } from './stone-layout.js';

const FOG_DEPTH = 4.2;

let shared = null;

/** The one tower world, created on first use. */
export function getTowerWorld(canvas) {
  if (!shared) shared = createTowerWorld(canvas);
  return shared;
}

/** Frees the tower scene; a room is about to play. */
export function disposeTowerWorld() {
  shared?.dispose();
  shared = null;
}

/** A tower-local point (shaft on the axis, level heights) in courtyard coordinates. */
export const towerPoint = (p, level = 0) => {
  if (!p) return new THREE.Vector3(0, level * FLOOR_H, 0);
  return new THREE.Vector3(p.x ?? 0, (p.y ?? 0) + level * FLOOR_H, p.z ?? 0);
};

function createTowerWorld(canvas) {
  const { renderer, camera } = initRenderer(canvas);
  board.rows = 9;
  board.cols = 9;
  const rand = mulberry32(1984);
  env.rand = rand;

  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const fx = createFx(root);
  env.fx = fx;

  // Clouds: the room's ring below the island, plus a thinner layer drifting
  // around the tower's middle so it stands "lost in cloud".
  const lowClouds = new THREE.Group();
  lowClouds.position.z = 0;
  root.add(lowClouds);
  const atmosphere = createAtmosphere(lowClouds, rand);
  const highClouds = [];
  for (let i = 0; i < 7; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTexture(4000 + i * 131), transparent: true, depthWrite: false, opacity: 0.5 });
    const s = new THREE.Sprite(mat);
    const w = 7 + rand() * 6;
    s.scale.set(w, w * 0.42, 1);
    s.userData = { angle: (i / 7) * Math.PI * 2 + rand(), r: 10 + rand() * 7, y: 4.5 + rand() * 6.5, speed: 0.05 + rand() * 0.05 };
    root.add(s);
    highClouds.push(s);
  }

  // The courtyard, its places and its people.
  const courtyardGroup = new THREE.Group();
  root.add(courtyardGroup);
  const courtyard = buildCourtyard(courtyardGroup);

  let progress = getProgress();
  const theme = getTheme(getSettings().theme);
  sound.setTheme(theme);
  const tower = createTower({ theme, progress });
  tower.group.position.set(0, 0, 0);
  root.add(tower.group);
  courtyard.setEngravings((progress.floorsLit ?? []).length);

  // The Kolam's theme row applies live here too: the alcoves on the floors
  // and the tower rebuild with the chosen theme's objects (fix 1, prompt 04).
  const unlistenSettings = onSettingsChange((s) => {
    const next = getTheme(s.theme);
    tower.setTheme(next);
    sound.setTheme(next);
  });

  const wanderer = new Wanderer();
  root.add(wanderer.root);
  wanderer.root.position.set(COURTYARD_START.c - 4, 0, COURTYARD_START.r - 4);

  // The stranger is on the capstone far above (§13.1, §13.3)
  const cap = capstone();
  const strangerYaw = Math.PI / 4;
  const strangerPos = new THREE.Vector3(
    cap.centre.x + Math.sin(strangerYaw) * (cap.R - 0.05),
    cap.topY + 0.05,
    cap.centre.z + Math.cos(strangerYaw) * (cap.R - 0.05),
  );
  const stranger = new Stranger({ pos: strangerPos, yaw: strangerYaw }, root);
  const crows = [];
  for (let i = 0; i < 1 + (rand() < 0.5 ? 1 : 0); i++) {
    const crow = new Crow(courtyardGroup, courtyard.perches);
    crow.timer = 2 + i * 3.5 + rand() * 2;
    crows.push(crow);
  }
  let roofStranger = stranger;

  // The glowing tile in front of the alcove in focus (ART-DIRECTION §10.9).
  const hover = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.92),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
  );
  hover.rotation.x = -Math.PI / 2;
  hover.visible = false;
  root.add(hover);

  // --- the view: where the camera looks, from where, how wide; and the anchor ----

  const view = { target: new THREE.Vector3(), azimuth: Math.PI / 4, halfHeight: 8, anchor: new THREE.Vector3(), fogDepth: FOG_DEPTH, elevation: ELEVATION };
  const goal = { target: new THREE.Vector3(), azimuth: Math.PI / 4, halfHeight: 8, anchor: new THREE.Vector3(), fogDepth: FOG_DEPTH, elevation: ELEVATION };
  let tween = null;
  let rate = 5.5;

  /** Jump straight to a view. */
  function setView(v) {
    copyView(goal, v);
    copyView(view, goal);
    tween = null;
  }

  let cutVeil = null;
  function triggerCutVeil(duration = 0.3) {
    if (typeof document === 'undefined') return;
    if (!cutVeil) {
      cutVeil = document.createElement('div');
      cutVeil.className = 'quick-veil';
      Object.assign(cutVeil.style, {
        position: 'fixed', inset: '0', zIndex: '9998', pointerEvents: 'none',
        background: 'var(--veil)', opacity: '0', transition: `opacity ${duration / 2}s ease`,
      });
      document.body.appendChild(cutVeil);
    }
    cutVeil.style.opacity = '0.9';
    setTimeout(() => {
      if (cutVeil) cutVeil.style.opacity = '0';
    }, (duration / 2) * 1000);
  }

  /** Ease to a view over `seconds` (easeInOutSine), or damp there at `rate` when no time is given. */
  function moveView(v, seconds = null, dampRate = 5.5) {
    copyView(goal, v);
    if (reducedMotion()) {
      setView(v);
      if (seconds && seconds > 0) triggerCutVeil(0.3);
      return;
    }
    rate = dampRate;
    if (seconds && seconds > 0) {
      tween = { from: copyView(blankView(), view), t: 0, seconds };
    } else {
      tween = null;
    }
  }

  function blankView() {
    return { target: new THREE.Vector3(), azimuth: 0, halfHeight: 1, anchor: new THREE.Vector3(), fogDepth: FOG_DEPTH, elevation: ELEVATION };
  }

  function copyView(dst, src) {
    if (src.target) dst.target.copy(src.target);
    if (src.azimuth != null) dst.azimuth = src.azimuth;
    if (src.halfHeight != null) dst.halfHeight = src.halfHeight;
    if (src.anchor) dst.anchor.copy(src.anchor);
    if (src.fogDepth != null) dst.fogDepth = src.fogDepth;
    // Views that do not say otherwise are the room's isometric camera.
    dst.elevation = src.elevation ?? ELEVATION;
    return dst;
  }

  function stepView(dt) {
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / tween.seconds);
      const e = easeInOutSine(tween.t);
      const f = tween.from;
      view.target.lerpVectors(f.target, goal.target, e);
      view.anchor.lerpVectors(f.anchor, goal.anchor, e);
      view.azimuth = f.azimuth + wrapAngle(goal.azimuth - f.azimuth) * e;
      view.halfHeight = lerp(f.halfHeight, goal.halfHeight, e);
      view.fogDepth = lerp(f.fogDepth, goal.fogDepth, e);
      view.elevation = lerp(f.elevation, goal.elevation, e);
      if (tween.t >= 1) tween = null;
    } else {
      const k = 1 - Math.exp(-rate * dt);
      view.target.lerp(goal.target, k);
      view.anchor.lerp(goal.anchor, k);
      view.azimuth = damp(view.azimuth, goal.azimuth, rate, dt);
      view.halfHeight = damp(view.halfHeight, goal.halfHeight, rate, dt);
      view.fogDepth = damp(view.fogDepth, goal.fogDepth, rate, dt);
      view.elevation = damp(view.elevation, goal.elevation, rate, dt);
    }
  }

  const worldTarget = new THREE.Vector3();
  function applyView() {
    root.position.copy(view.anchor).negate();
    worldTarget.copy(view.target).sub(view.anchor);
    placeView(worldTarget, view.azimuth, view.halfHeight, view.elevation);
    light.uFogDepth.value = view.fogDepth;
  }

  // --- walking: grid steps in the courtyard, free paths in the tower -------------------

  /**
   * The wanderer's current walk: a polyline in courtyard coordinates, at
   * `pace` seconds per unit, with the room's gait (walk or run).
   */
  let walk = null;

  function walkPath(points, { pace = 0.36, kind = 'walk', onDone = null } = {}) {
    const from = wanderer.root.position.clone();
    const pts = [from, ...points.map((p) => p.clone())];
    const lengths = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i].distanceTo(pts[i - 1]);
      lengths.push(d);
      total += d;
    }
    walk = { pts, lengths, total, dist: 0, pace, kind, onDone, step: Math.floor(Math.random() * 2) };
    if (total < 1e-4) finishWalk();
  }

  function finishWalk() {
    const w = walk;
    walk = null;
    wanderer.move = null;
    if (w) wanderer.root.position.copy(w.pts[w.pts.length - 1]);
    w?.onDone?.();
  }

  /** Ends the current walk at once (any key skips a cut-scene). */
  function snapWalk() {
    if (walk) finishWalk();
  }

  function stepWalk(dt) {
    if (!walk) return;
    walk.dist = Math.min(walk.total, walk.dist + dt / walk.pace);
    let d = walk.dist;
    let i = 0;
    while (i < walk.lengths.length - 1 && d > walk.lengths[i]) {
      d -= walk.lengths[i];
      i++;
    }
    const a = walk.pts[i];
    const b = walk.pts[i + 1];
    const k = walk.lengths[i] > 0 ? clamp(d / walk.lengths[i], 0, 1) : 1;
    wanderer.root.position.lerpVectors(a, b, k);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (Math.hypot(dx, dz) > 1e-4) wanderer.yaw = Math.atan2(dx, dz);
    wanderer.move = { kind: walk.kind, p: walk.dist % 1, stepIndex: walk.step + Math.floor(walk.dist), demo: true };
    if (walk.dist >= walk.total) finishWalk();
  }

  /** Turns the wanderer toward a point (courtyard coordinates). */
  function faceToward(p) {
    const w = wanderer.root.position;
    wanderer.yaw = Math.atan2(p.x - w.x, p.z - w.z);
  }

  /** Faces the camera, as when the wanderer stops to look at the player. */
  function faceCamera() {
    wanderer.yaw = view.azimuth;
  }

  // --- the mood, the effects and the clock -------------------------------------------------

  let moteTimer = 0;
  const glowHex = () => '#' + (moodState.live ?? applyMood(0)).glow.getHexString();

  function pxPerUnit() {
    return window.innerHeight / (2 * view.halfHeight);
  }

  function update(dt, t) {
    stepView(dt);
    applyView();
    const live = applyMood(dt);
    const glow = live.glow;

    stepWalk(dt);
    wanderer.update(dt, { cameraYaw: view.azimuth });
    if (Math.abs(wanderer.opacity - wanderer.fadeTo) > 0.003) {
      wanderer.setOpacity(damp(wanderer.opacity, wanderer.fadeTo, 3.2, dt));
    }

    waterUniforms.uTime.value = reducedMotion() ? 0 : t;
    courtyard.update(dt, t);
    stranger.update(dt, t, wanderer.root.position);
    if (roofStranger && roofStranger !== stranger) roofStranger.update(dt, t, wanderer.root.position);
    for (const c of crows) c.update(dt, t, wanderer.root.position);
    // Whatever lies wholly below the mist's full depth is not drawn: on the
    // upper floors that is the whole courtyard and the floors far beneath.
    // (The gate's lintel and the pavilion's roof are the last of the courtyard
    // to go: by Lantai II they are at 7–14 % against the mist.)
    const mistY = view.anchor.y - view.fogDepth - 0.2;
    courtyardGroup.visible = mistY < 1.2;
    // In the iso views a floor at rest shows its own stone alone in the sky;
    // while the platform rides (the anchor between floors) the stone above
    // fades in, so the stones arrive and pass around it like rings. Higher
    // stones dissolve instead of crowding the top of the screen.
    const level = view.anchor.y / AXIS_STEP;
    const between = Math.abs(level - Math.round(level)) > 0.02;
    const ceilY = view.elevation > ELEVATION - 0.05 ? view.anchor.y + (between ? AXIS_STEP : 0) + 0.3 : Infinity;
    tower.update(dt, t, glow, pxPerUnit(), mistY, ceilY);
    // The figure in black sits on the capstone: when the capstone is not drawn
    // (a floor view, the mist), neither is he.
    const capLevel = tower.levels[tower.levels.length - 1];
    stranger.root.visible = !!capLevel && capLevel.group.visible && (capLevel.above ?? 1) > 0.5;
    for (const s of shadows) s.color.copy(live.shadow);

    for (const s of highClouds) {
      const u = s.userData;
      if (!reducedMotion()) {
        u.angle += u.speed * dt * 0.05;
      }
      s.position.set(Math.cos(u.angle) * u.r, u.y, TOWER_Z + Math.sin(u.angle) * u.r);
      s.material.color.copy(live.cloud);
    }

    // Motes rise from the lit alcoves in focus, and around a meditating wanderer.
    if (!reducedMotion()) {
      moteTimer += dt;
      if (moteTimer > 0.22) {
        moteTimer = 0;
        const focus = tower.focus;
        if (focus) {
          const lit = focus.items.filter((it) => it.object?.isLit);
          if (lit.length) {
            const it = lit[Math.floor(Math.random() * lit.length)];
            const pos = it.alcove?.niche ?? it.alcove?.object ?? it.alcove?.target;
            const p = towerPoint(pos, focus.floor);
            fx.mote(p.x + (Math.random() - 0.5) * 0.3, p.y + 0.6, p.z + (Math.random() - 0.5) * 0.3);
          }
        }
        if (wanderer.idle > MEDITATE_AFTER + 1 && !wanderer.move) {
          const p = wanderer.root.position;
          fx.mote(p.x + (Math.random() - 0.5) * 0.9, p.y + 0.2, p.z + (Math.random() - 0.5) * 0.9);
        }
      }
    }

    hover.material.color.copy(glow);
    hover.material.opacity = hover.visible ? (reducedMotion() ? 0.25 : 0.22 + Math.sin(t * 3) * 0.05) : 0;

    fx.update(dt, glow);
    atmosphere.update(dt, t);
  }

  function render() {
    renderer.render(scene, camera);
  }

  // --- screen space -------------------------------------------------------------------------

  const probe = new THREE.Vector3();
  /** Screen pixels of a courtyard-space point (for captions). */
  function toScreen(p) {
    probe.copy(p).sub(view.anchor).project(camera);
    return { x: ((probe.x + 1) / 2) * window.innerWidth, y: ((1 - probe.y) / 2) * window.innerHeight };
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  /** The point on the horizontal plane at height `y` (courtyard space) under a screen point. */
  function pointerOnPlane(clientX, clientY, y = 0) {
    ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    plane.constant = -(y - view.anchor.y);
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return hit.clone().add(view.anchor);
  }

  /** The courtyard cell under a screen point. */
  function cellUnderPointer(clientX, clientY) {
    const p = pointerOnPlane(clientX, clientY, 0);
    return p ? cellAt(p.x, p.z) : null;
  }

  // --- progress and the cast --------------------------------------------------------------

  function setProgress(p) {
    progress = p;
    tower.setProgress(p);
    courtyard.setEngravings((p.floorsLit ?? []).length);
  }

  /** The stranger already sitting on the capstone's edge, for the ending (§8, §13.12). */
  function seatRoofStranger(seat) {
    if (seat) {
      stranger.root.position.copy(seat.pos);
      stranger.root.rotation.y = seat.yaw;
    }
    return stranger;
  }

  function dispose() {
    unlistenSettings();
    fx.dispose();
    atmosphere.dispose();
    tower.dispose();
    wanderer.dispose();
    root.traverse((o) => {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material?.dispose?.();
    });
    for (const s of highClouds) s.material.map.dispose();
    shadows.clear();
    scene.clear();
    light.uFogDepth.value = FOG_DEPTH;
  }

  return {
    scene,
    root,
    courtyard,
    tower,
    wanderer,
    stranger,
    crows,
    hover,
    fx,
    view,
    goal,
    get progress() {
      return progress;
    },
    get walking() {
      return !!walk;
    },
    setView,
    moveView,
    walkPath,
    snapWalk,
    faceToward,
    faceCamera,
    setProgress,
    seatRoofStranger,
    toScreen,
    pointerOnPlane,
    cellUnderPointer,
    pxPerUnit,
    glowHex,
    screenAxes: () => screenAxes(view.azimuth),
    update,
    render,
    dispose,
  };
}
