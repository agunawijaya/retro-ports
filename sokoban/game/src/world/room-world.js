/**
 * @file One room's world: the island, its decor, the theme's objects and
 * targets, the wanderer, the effects and the sky around them
 * (briefs/01-room-contract.md). The glue owns the rules, the scripts and the
 * tile travel; this owns everything that is drawn, and draws it in the
 * reference's order (reference §17).
 */

import * as THREE from 'three';
import { initRenderer } from '../render/renderer.js';
import { board, cellX, cellZ, cellAt } from '../render/board.js';
import { view, fitCamera } from '../render/camera.js';
import { applyMood, moodState } from '../render/moods.js';
import { buildIsland } from '../render/island.js';
import { damp } from '../render/math.js';
import { sound } from '../audio/sound.js';
import { Wanderer, MEDITATE_AFTER } from './wanderer.js';
import { createFx } from './fx.js';
import { createAtmosphere } from './atmosphere.js';
import { shadows } from './shadow.js';
import { buildDecor, updateDecor, decorCounts } from './decor/index.js';
import { createThemeInstances } from '../render/instances.js';
import { reducedMotion } from '../state/settings.js';

/**
 * @param {{ canvas: HTMLCanvasElement, level: object, theme: object, rand: () => number }} options
 */
export function createRoomWorld({ canvas, level, theme, rand }) {
  const { renderer, camera } = initRenderer(canvas);
  board.rows = level.rows;
  board.cols = level.cols;
  sound.setTheme(theme);

  const scene = new THREE.Scene();
  const fx = createFx(scene);
  const atmosphere = createAtmosphere(scene, rand);
  const { group, plan } = buildIsland(level);
  scene.add(group);
  const decor = buildDecor(level, plan, group, { fx, rand });

  const isTarget = (r, c) => level.targets.some((t) => t.r === r && t.c === c);

  let instances = null;
  let targets = [];
  let objects = [];

  if (theme.parts) {
    instances = createThemeInstances({ theme, level, group, isTarget });
    targets = instances.targets;
    objects = instances.objects;
    for (let i = 0; i < level.objects.length; i++) {
      const o = level.objects[i];
      objects[i].group.position.set(cellX(o.c), 0, cellZ(o.r));
    }
    for (let j = 0; j < level.targets.length; j++) {
      const t = level.targets[j];
      targets[j].group.position.set(cellX(t.c), 0, cellZ(t.r));
    }
    instances.sync(0, 0, applyMood(0).glow);
  } else {
    targets = level.targets.map((t) => {
      const target = theme.createTarget();
      target.group.position.set(cellX(t.c), 0, cellZ(t.r));
      target.group.userData.col = t.c;
      group.add(target.group);
      return target;
    });

    objects = level.objects.map((o) => {
      const object = theme.createObject();
      object.group.position.set(cellX(o.c), 0, cellZ(o.r));
      group.add(object.group);
      object.setLit(isTarget(o.r, o.c));
      return object;
    });
  }

  const wanderer = new Wanderer();
  scene.add(wanderer.root);
  wanderer.root.position.set(cellX(level.start.c), 0, cellZ(level.start.r));
  wanderer.yaw = wanderer.shownYaw = view.azimuth; // a new room starts facing the player

  const hover = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.92),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
  );
  hover.rotation.x = -Math.PI / 2;
  hover.position.y = 0.008;
  hover.visible = false;
  scene.add(hover);

  fitCamera();

  let moteTimer = 0;

  function update(dt, t, { covered } = {}) {
    // Camera turn (Q / E): eases about 0.6 s and re-frames as it goes.
    if (reducedMotion()) {
      view.azimuth = view.targetAzimuth;
      fitCamera();
    } else if (Math.abs(view.targetAzimuth - view.azimuth) > 1e-4) {
      view.azimuth = damp(view.azimuth, view.targetAzimuth, 5.5, dt);
      fitCamera();
    }

    const live = applyMood(dt);
    const glow = live.glow;

    wanderer.update(dt, { cameraYaw: view.azimuth });
    if (Math.abs(wanderer.opacity - wanderer.fadeTo) > 0.003) {
      wanderer.setOpacity(damp(wanderer.opacity, wanderer.fadeTo, 3.2, dt));
    }
    updateDecor(decor, dt, t, wanderer.root.position);

    for (const o of objects) o.update(dt, t, glow);
    targets.forEach((target, i) => target.update(dt, t, glow, covered?.[i] ?? false));
    if (instances) {
      instances.sync(dt, t, glow);
      if (instances.roomExtras) {
        instances.roomExtras.update(dt, t, {
          covered,
          litCount: objects.filter((o) => o.isLit).length,
          goalCount: targets.length,
        });
      }
    }
    for (const s of shadows) s.color.copy(live.shadow);

    // Gentle motes from lit objects, and around a meditating wanderer.
    if (!reducedMotion()) {
      moteTimer += dt;
      if (moteTimer > 0.22) {
        moteTimer = 0;
        const lit = objects.filter((o) => o.isLit);
        if (lit.length) {
          const o = lit[Math.floor(Math.random() * lit.length)];
          fx.mote(o.group.position.x + (Math.random() - 0.5) * 0.3, 0.6, o.group.position.z + (Math.random() - 0.5) * 0.3);
        }
        if (wanderer.idle > MEDITATE_AFTER + 1 && !wanderer.move) {
          const p = wanderer.root.position;
          fx.mote(p.x + (Math.random() - 0.5) * 0.9, 0.2, p.z + (Math.random() - 0.5) * 0.9);
        }
      }
    }

    hover.material.color.copy(glow);
    hover.material.opacity = hover.visible ? (reducedMotion() ? 0.25 : 0.22 + Math.sin(t * 3) * 0.05) : 0;

    fx.update(dt, glow);
    atmosphere.update(dt, t);
  }

  function setHover(cell) {
    const ok = !!cell && level.inside[cell.r]?.[cell.c] === true;
    hover.visible = ok;
    if (ok) hover.position.set(cellX(cell.c), 0.008, cellZ(cell.r));
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  /** The cell under a screen point; objects first, they stand above the floor. */
  function cellUnderPointer(clientX, clientY) {
    pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(objects.map((o) => o.body), true);
    if (hits.length) {
      const o = objects.find((x) => x.body === hits[0].object.parent || x.body === hits[0].object);
      if (o) return cellAt(o.group.position.x, o.group.position.z);
    }
    if (!raycaster.ray.intersectPlane(ground, hit)) return null;
    return cellAt(hit.x, hit.z);
  }

  const probe = new THREE.Vector3();
  const toScreen = (v) => {
    probe.copy(v).project(camera);
    return { x: ((probe.x + 1) / 2) * window.innerWidth, y: ((1 - probe.y) / 2) * window.innerHeight, ndc: probe.clone() };
  };

  function where() {
    const { x, y } = toScreen(wanderer.root.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
    return { x, y };
  }

  /** Does the room's box land inside the viewport at the current size and view? */
  function framingFits() {
    const hw = board.cols / 2;
    const hd = board.rows / 2;
    camera.updateMatrixWorld();
    for (const x of [-hw, hw]) {
      for (const z of [-hd, hd]) {
        for (const y of [0, 1]) {
          const { ndc } = toScreen(new THREE.Vector3(x, y, z));
          if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) return false;
        }
      }
    }
    return true;
  }

  function inspect() {
    const strangerPos = decor.stranger ? toScreen(decor.stranger.root.position).ndc : null;
    return {
      gate: { found: !!decor.gate, stones: decor.gate?.stones ?? 0 },
      stranger: {
        seated: !!decor.stranger,
        onScreen: !!strangerPos && Math.abs(strangerPos.x) <= 1 && Math.abs(strangerPos.y) <= 1,
      },
      water: decorCounts(decor),
      framing: { fits: framingFits() },
      render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles },
    };
  }

  function dispose() {
    decor?.dispose?.();
    if (instances) instances.dispose();
    fx.dispose();
    atmosphere.dispose();
    // Shared textures (glow, shadow) stay: materials are freed, maps are not.
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material?.dispose?.();
    });
    shadows.clear();
    scene.clear();
  }

  return {
    scene,
    board,
    wanderer,
    objects,
    targets,
    decor,
    fx,
    glowHex: () => '#' + (moodState.live ?? applyMood(0)).glow.getHexString(),
    setHover,
    cellUnderPointer,
    update,
    render: () => renderer.render(scene, camera),
    resize: () => fitCamera(),
    where,
    inspect,
    dispose,
  };
}
