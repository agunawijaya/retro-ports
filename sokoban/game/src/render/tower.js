/**
 * @file Menara Hening — seven floating stones on one vertical axis (ART-DIRECTION
 * §13.2–§13.5, §13.12, GAME-DESIGN §4.2, §7.3, §7.4, §8): the courtyard stone,
 * five ring-stones (one per floor, each with an opening the platform rises through),
 * and a capstone where the journey ends.
 *
 * All numbers and pure math come from `src/world/stone-layout.js`.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pastel, pastelRoles, ROLE_INDEX } from './pastel.js';
import { textures } from './textures.js';
import { clamp, damp } from './math.js';
import { reducedMotion } from '../state/settings.js';
import {
  AXIS_STEP,
  STONES,
  floorStone,
  breathe,
  settle,
  NICHE_COUNT,
  nicheAngle,
  nicheAzimuth,
  niche,
  finials,
  capstone,
} from '../world/stone-layout.js';

export const FLOOR_H = AXIS_STEP;
export const ROOF = 6;
export const SHAFT = 1.2;
export const STAND_Z = 2.15;

const DEG = Math.PI / 180;

/** Niche angle in radians, for compatibility. */
export const alcoveAngle = (i) => nicheAngle(i) * DEG;

/** Niche metadata for slot i, for backwards compatibility. */
export function alcove(i) {
  const angle = nicheAngle(i);
  return {
    index: i,
    angle: angle * DEG,
    azimuth: nicheAzimuth(i),
    phi: (angle + 45) * DEG,
    stand: { x: 0, z: 0 },
    front: { x: 0, z: 0 },
    niche: { x: 0, z: 0 },
  };
}

export const ALCOVES = Array.from({ length: NICHE_COUNT }, (_, i) => alcove(i));
export { niche } from '../world/stone-layout.js';

/** 'locked' | 'open' | 'solved' for a room, from the progress object. */
export function roomState(progress, room) {
  if (progress.solved?.[room]) return 'solved';
  return room <= progress.open ? 'open' : 'locked';
}

/** Legacy stub for stair exit calculation. */
export function shaftExit() {
  return { side: 0, x: 0 };
}

// --- the kit: role-tagged parts merged into one mesh ----------------------------

const m4 = new THREE.Matrix4();
const rot = new THREE.Matrix4();

/**
 * Collects role-tagged geometry for one stone and merges it into one mesh.
 * Every part also carries `aFogMix` (0 unless the part asks for a fade), so
 * a stone's underside can dissolve into cloud however high it floats.
 */
class Kit {
  constructor() {
    this.parts = [];
  }

  /**
   * @param {THREE.BufferGeometry} geo
   * @param {string} role
   * @param {THREE.Matrix4} [matrix]
   * @param {{ flat?: boolean, fog?: (x: number, y: number, z: number) => number }} [opts]
   */
  add(geo, role, matrix, { flat = false, fog = null } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (matrix) g.applyMatrix4(matrix);
    if (flat) g.computeVertexNormals(); // non-indexed: one normal per facet
    g.deleteAttribute('uv');
    const pos = g.attributes.position;
    const n = pos.count;
    g.setAttribute('role', new THREE.Float32BufferAttribute(new Float32Array(n).fill(ROLE_INDEX[role]), 1));
    const mix = new Float32Array(n);
    if (fog) for (let i = 0; i < n; i++) mix[i] = fog(pos.getX(i), pos.getY(i), pos.getZ(i));
    g.setAttribute('aFogMix', new THREE.Float32BufferAttribute(mix, 1));
    this.parts.push(g);
  }

  cylinder(rt, rb, h, segs, x, y, z, role, phi = 0) {
    this.add(new THREE.CylinderGeometry(rt, rb, h, segs), role, rot.makeRotationY(phi).multiply(m4.makeTranslation(x, y, z)).clone());
  }

  sphere(r, ws, hs, x, y, z, role) {
    this.add(new THREE.SphereGeometry(r, ws, hs), role, m4.makeTranslation(x, y, z).clone());
  }

  at(geo, x, y, z, role, phi = 0, opts) {
    this.add(geo, role, rot.makeRotationY(phi).multiply(m4.makeTranslation(x, y, z)).clone(), opts);
  }

  build(material) {
    if (!this.parts.length) return null;
    const merged = mergeGeometries(this.parts);
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    return new THREE.Mesh(merged, material);
  }
}

// --- the stones (ART-DIRECTION §13.2) --------------------------------------------
//
// One river-stone profile for every stone, turned on a lathe (40 facets, flat
// shaded so the three pastel tones fall across them like the lantern's hex
// faces): a flat walkable top with four faint raked rings, a worn rounded rim
// (a quarter ellipse 0.45 out and 0.5 down: a lens from the side, not a disc),
// and a soft dome underneath that
// fades into the cloud toward its middle, the way a room's plinth does.

const SEGS = 40;
const RIM_OUT = 0.45; // 05: from 0.25
const RIM_DOWN = 0.5; // 05: from 0.35
const DEEP = -1.15; // the underside's lowest point, at R − 0.4 (05: 0.15 deeper)
const LIP = 0.06;
const lathe = (points) => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), SEGS);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** The rim's quarter ellipse, from the widest point up to the edge of the top. */
function rimPoints(R) {
  const pts = [];
  for (let k = 8; k >= 0; k--) {
    const th = (k / 8) * (Math.PI / 2);
    pts.push([R - RIM_OUT + RIM_OUT * Math.sin(th), -RIM_DOWN + RIM_DOWN * Math.cos(th)]);
  }
  return pts;
}

/**
 * The underside, from the rim's widest point round to the stone's bottom
 * (y `deep` at R − 0.4) and up as a soft dome to `inner` at height `high`.
 */
function undersidePoints(R, inner, deep, high) {
  const pts = [];
  for (let k = 0; k <= 6; k++) {
    const ph = (k / 6) * (Math.PI / 2);
    pts.push([R - 0.4 * (1 - Math.cos(ph)), -RIM_DOWN + (deep + RIM_DOWN) * Math.sin(ph)]);
  }
  const span = R - 0.4 - inner;
  for (let k = 1; k <= 8; k++) {
    const t = k / 8;
    const d = Math.sin((t * Math.PI) / 2); // a dome: steep near the bottom, flat toward the middle
    pts.push([R - 0.4 - span * t, deep + (high - deep) * d]);
  }
  return pts;
}

/** Fog along the underside: none at the rim, most of the way into cloud by its middle. */
function undersideFog(R, inner, keep = 0.82) {
  const mid = R - 0.4 - (R - 0.4 - inner) * 0.45;
  return (x, y, z) => keep * smooth(R - 0.3, mid, Math.hypot(x, z)) * smooth(-0.3, -0.7, y);
}

/** Four faint raked rings between `inner` and `outer`: the zen-garden version of tiles. */
function rakedRings(kit, inner, outer) {
  for (let k = 1; k <= 4; k++) {
    const r = inner + ((outer - inner) * k) / 5;
    const ring = new THREE.RingGeometry(r - 0.012, r + 0.012, SEGS * 2, 1).rotateX(-Math.PI / 2);
    kit.at(ring, 0, 0.003, 0, 'floorB');
  }
}

/** The rounded lip where a top meets an opening or a recess, running down to `bottom`. */
function lipPoints(r, bottom) {
  const pts = [[r, bottom], [r, -LIP]];
  for (let k = 1; k <= 4; k++) {
    const th = (k / 4) * (Math.PI / 2);
    pts.push([r + LIP - LIP * Math.cos(th), -LIP + LIP * Math.sin(th)]);
  }
  return pts;
}

/** A floor stone: the profile with an opening, its wall and its rounded lip. */
function buildRingStone(kit, stone) {
  const { R, opening } = stone;
  kit.add(new THREE.RingGeometry(opening + LIP, R - RIM_OUT, SEGS, 2).rotateX(-Math.PI / 2), 'floorA', null, { flat: true });
  kit.add(lathe(rimPoints(R)), 'cap', null, { flat: true });
  kit.add(lathe(undersidePoints(R, opening, DEEP, -0.6).reverse()), 'stone', null, { flat: true, fog: undersideFog(R, opening) });
  kit.add(lathe(lipPoints(opening, -0.6).reverse()), 'cap', null, { flat: true });
  rakedRings(kit, opening + LIP, R - RIM_OUT);
}

/** The courtyard stone: the same profile with a shallow recess for the platform. */
function buildCourtyardStone(kit, stone) {
  const { R } = stone;
  const { r, depth } = stone.recess;
  kit.add(new THREE.RingGeometry(r + LIP, R - RIM_OUT, SEGS, 2).rotateX(-Math.PI / 2), 'floorA', null, { flat: true });
  kit.add(lathe(rimPoints(R)), 'cap', null, { flat: true });
  kit.add(lathe(undersidePoints(R, 0.001, DEEP, -0.6).reverse()), 'stone', null, { flat: true, fog: undersideFog(R, 0) });
  kit.add(lathe(lipPoints(r, -depth).reverse()), 'cap', null, { flat: true });
  kit.add(new THREE.CircleGeometry(r, SEGS).rotateX(-Math.PI / 2).translate(0, -depth, 0), 'floorB', null, { flat: true });
  rakedRings(kit, r + LIP + 0.4, R - RIM_OUT);
  buildCourtyardPlinth(kit, R);
}

/** Below the courtyard, the room's three plinth tiers, round here, into cloud. */
function buildCourtyardPlinth(kit, R) {
  const tiers = [[R - 0.9, -0.95, 0.9], [R - 1.7, -1.85, 1.1], [R - 2.6, -2.95, 1.6]];
  tiers.forEach(([r, top, h], i) => {
    const profile = [[r - 0.12, top - h], [r, top - 0.08], [r + 0.08, top]];
    const fog = (x, y) => clamp(0.25 + i * 0.25 + smooth(top, top - h, y) * 0.25, 0, 0.95);
    kit.add(lathe(profile), 'stone', null, { flat: true, fog });
  });
}

/** The capstone: the same profile, no opening, 0.7 thick. */
function buildCapstone(kit, stone) {
  const { R } = stone;
  kit.add(new THREE.CircleGeometry(R - RIM_OUT, SEGS).rotateX(-Math.PI / 2), 'floorA', null, { flat: true });
  kit.add(lathe(rimPoints(R)), 'cap', null, { flat: true });
  kit.add(lathe(undersidePoints(R, 0.001, -0.75, -0.5).reverse()), 'stone', null, { flat: true, fog: undersideFog(R, 0, 0.7) });
  rakedRings(kit, 0.32, R - RIM_OUT);
}

// --- niches (ART-DIRECTION §13.5) --------------------------------------------------

/**
 * An arc of stone standing on the top, centred on spec angle `angleDeg`:
 * `arcDeg` wide, at radius `r` from the stone's centre, `thick` deep and `h`
 * tall, its top edges rounded. The shape is an annular sector, extruded up.
 */
function arcStone(r, angleDeg, arcDeg, thick, h, round) {
  const a0 = Math.PI / 4 + (angleDeg - arcDeg / 2) * DEG;
  const a1 = Math.PI / 4 + (angleDeg + arcDeg / 2) * DEG;
  const shape = new THREE.Shape();
  const steps = Math.max(4, Math.round(arcDeg / 3));
  const pt = (rad, ang) => [rad * Math.sin(ang), -rad * Math.cos(ang)]; // shape y becomes world −z
  shape.moveTo(...pt(r - thick / 2, a0));
  for (let k = 0; k <= steps; k++) shape.lineTo(...pt(r + thick / 2, a0 + ((a1 - a0) * k) / steps));
  for (let k = steps; k >= 0; k--) shape.lineTo(...pt(r - thick / 2, a0 + ((a1 - a0) * k) / steps));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h - 2 * round,
    bevelEnabled: true,
    bevelThickness: round,
    bevelSize: Math.min(round, thick / 2 - 0.01),
    bevelSegments: 3,
    curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, round, 0);
  return geo;
}

/**
 * The niche's back stone: a curved slab, 14° of arc, 0.16 thick, 0.3 tall,
 * rounded on top, just behind the object's foot (05: lower and narrower, so the
 * rim reads open and sky shows between the niches).
 */
function buildBackStone(kit, floor, i) {
  const n = niche(floor, i);
  const stone = floorStone(floor);
  const r = Math.hypot(n.back.x - stone.centre.x, n.back.z - stone.centre.z);
  kit.add(arcStone(r, nicheAngle(i), 14, 0.16, 0.3, 0.06), 'cap', null, { flat: true });
}

/**
 * Between the niches: low cap stones along the rim, with a finial on each,
 * 18° from the niches, like a room's wall caps. The 12° around each niche stays
 * open, so a niche reads as a place on the rim.
 */
function buildFinials(kit, floor) {
  const stone = floorStone(floor);
  const capR = stone.R - RIM_OUT - 0.08;
  for (let i = 0; i < NICHE_COUNT; i++) {
    kit.add(arcStone(capR, nicheAngle(i) + 18, 24, 0.16, 0.1, 0.035), 'cap', null, { flat: true });
  }
  for (const post of finials(floor)) {
    const lx = post.x - stone.centre.x;
    const lz = post.z - stone.centre.z;
    const d = Math.hypot(lx, lz) || 1;
    const fx = (lx / d) * capR;
    const fz = (lz / d) * capR;
    kit.cylinder(0.045, 0.06, 0.12, 6, fx, 0.16, fz, 'cap');
    kit.sphere(0.055, 10, 8, fx, 0.27, fz, 'cap');
  }
}

/** A locked niche: a low upright slab where the object would stand, rounded on top. */
function buildLockedSlab(kit, floor, i) {
  const n = niche(floor, i);
  const stone = floorStone(floor);
  const r = Math.hypot(n.object.x - stone.centre.x, n.object.z - stone.centre.z);
  kit.add(arcStone(r, nicheAngle(i), 16, 0.12, 0.5, 0.06), 'wall', null, { flat: true });
}

/** The platform batu: a round stone, its rim softened, one inset ring on top. */
function buildPlatform() {
  const pKit = new Kit();
  const profile = [[0.001, -0.15], [0.76, -0.15], [0.8, -0.11], [0.8, -0.04], [0.74, 0], [0.001, 0]];
  pKit.add(lathe(profile), 'cap', null, { flat: true });
  pKit.add(new THREE.RingGeometry(0.58, 0.62, SEGS).rotateX(-Math.PI / 2).translate(0, 0.002, 0), 'goal');
  return pKit.build(pastelRoles());
}

/** A fully solved floor's rim of light: a thin ring just under the rim's widest point. */
function createRimOfLight(stone) {
  const geo = new THREE.TorusGeometry(stone.R + 0.006, 0.03, 8, 64);
  geo.rotateX(Math.PI / 2);
  const mat = pastel('#ffe2b8', { glow: '#ffd9a0' });
  mat.uniforms.uGlowAmt.value = 0;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -RIM_DOWN - 0.03;
  mesh.visible = false;
  return { mesh, material: mat };
}

/**
 * Creates Menara Hening scene graph and animation controllers.
 * @param {{ theme: object, progress: object }} options
 */
export function createTower({ theme: initialTheme, progress }) {
  const group = new THREE.Group();
  const levels = [];
  const bands = [];
  const settleTimes = new Array(7).fill(null);

  let current = progress;
  let theme = initialTheme;
  let focus = null;
  let clockTime = 0;
  let platformYPos = 0;

  // Platform batu
  const platform = buildPlatform();
  group.add(platform);

  // Template objects for far views
  let litTemplate = null;
  let darkTemplate = null;

  function makeTemplates() {
    litTemplate = theme.createObject();
    darkTemplate = theme.createObject();
    litTemplate.setLit(true);
    litTemplate.update(10, 0, new THREE.Color('#ffb470'));
    darkTemplate.update(10, 0, new THREE.Color('#ffb470'));
  }

  function disposeTemplates() {
    for (const t of [litTemplate, darkTemplate]) {
      t?.group?.traverse((o) => {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose?.();
      });
    }
  }

  makeTemplates();

  const haloTexture = textures().glow;

  function farObjects(levelGroup, floor) {
    const lit = [];
    const dark = [];
    const stone = floorStone(floor);
    for (let i = 0; i < NICHE_COUNT; i++) {
      const room = (floor - 1) * 10 + i + 1;
      const state = roomState(current, room);
      if (state === 'locked') continue;
      const n = niche(floor, i);
      const angleRad = (n.angle + 45) * DEG;
      const phi = -angleRad + Math.PI / 2;
      const place = new THREE.Matrix4().makeRotationY(phi).premultiply(
        new THREE.Matrix4().makeTranslation(n.object.x - stone.centre.x, 0, n.object.z - stone.centre.z),
      );
      (state === 'solved' ? lit : dark).push(place);
    }

    const meshes = [];
    for (const [template, places] of [[litTemplate, lit], [darkTemplate, dark]]) {
      if (!places.length) continue;
      template.group.updateMatrixWorld(true);
      template.body.traverse((o) => {
        if (!o.isMesh) return;
        const geos = places.map((p) => {
          const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          return g.applyMatrix4(p.clone().multiply(o.matrixWorld));
        });
        const mesh = new THREE.Mesh(mergeGeometries(geos), o.material);
        geos.forEach((g) => g.dispose());
        levelGroup.add(mesh);
        meshes.push(mesh);
      });
    }

    let halos = null;
    if (lit.length) {
      const pts = [];
      const v = new THREE.Vector3();
      for (const p of lit) {
        v.set(0, 0.52, 0).applyMatrix4(p);
        pts.push(v.x, v.y, v.z);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const mat = new THREE.PointsMaterial({
        size: 30,
        sizeAttenuation: false,
        map: haloTexture,
        color: '#ffd9a0',
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      halos = new THREE.Points(geo, mat);
      halos.frustumCulled = false;
      levelGroup.add(halos);
    }
    return { meshes, halos };
  }

  let capstoneObject = null;

  function buildLevels() {
    for (const l of levels) {
      group.remove(l.group);
      l.group.traverse((o) => {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      });
    }
    levels.length = 0;
    bands.length = 0;

    for (let k = 0; k <= ROOF; k++) {
      const stone = STONES[k];
      const kit = new Kit();
      const levelGroup = new THREE.Group();
      levelGroup.position.set(stone.centre.x, stone.topY, stone.centre.z);

      let rim = null;
      let far = null;

      if (k === 0) {
        buildCourtyardStone(kit, stone);
      } else if (k <= 5) {
        buildRingStone(kit, stone);
        buildFinials(kit, k);
        for (let i = 0; i < NICHE_COUNT; i++) {
          buildBackStone(kit, k, i);
          const room = (k - 1) * 10 + i + 1;
          if (roomState(current, room) === 'locked') {
            buildLockedSlab(kit, k, i);
          }
        }
        far = farObjects(levelGroup, k);
        rim = createRimOfLight(stone);
        levelGroup.add(rim.mesh);
      } else if (k === 6) {
        buildCapstone(kit, stone);
        // Lone theme object at capstone center
        capstoneObject = theme.createObject();
        capstoneObject.group.position.set(0, 0, 0);
        capstoneObject.setLit(false);
        levelGroup.add(capstoneObject.group);
      }

      const mesh = kit.build(pastelRoles({ fogMix: true }));
      if (mesh) levelGroup.add(mesh);

      group.add(levelGroup);
      levels.push({ group: levelGroup, mesh, far, stone, presence: 1 });

      const isLit = k >= 1 && k <= 5 && (current.floorsLit ?? []).includes(k);
      bands.push({
        litTarget: isLit ? 1 : 0,
        lit: isLit ? 1 : 0,
        mesh: rim?.mesh ?? null,
        material: rim?.material ?? null,
        sides: [],
      });
    }
  }

  // Focus floor management
  function clearFocus() {
    if (!focus) return;
    for (const item of focus.items) {
      if (item.object) {
        item.object.group.traverse((o) => {
          o.geometry?.dispose();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material?.dispose();
        });
        item.object.group.removeFromParent();
      }
      if (item.target) {
        item.target.group.traverse((o) => {
          o.geometry?.dispose();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material?.dispose();
        });
        item.target.group.removeFromParent();
      }
    }
    levels[focus.floor]?.far?.meshes?.forEach((m) => { m.visible = true; });
    if (levels[focus.floor]?.far?.halos) levels[focus.floor].far.halos.visible = true;
    focus = null;
  }

  function setFocusFloor(n) {
    clearFocus();
    if (!n || n < 1 || n > 5) return null;
    const level = levels[n];
    level.far?.meshes?.forEach((m) => { m.visible = false; });
    if (level.far?.halos) level.far.halos.visible = false;

    const stone = floorStone(n);
    const items = Array.from({ length: NICHE_COUNT }, (_, i) => {
      const room = (n - 1) * 10 + i + 1;
      const state = roomState(current, room);
      const a = niche(n, i);
      const nicheWithCompat = { ...a, niche: a.object, front: a.target, stand: a.target };
      const item = { alcove: nicheWithCompat, room, state, object: null, target: null, rise: 0 };
      const lx = a.object.x - stone.centre.x;
      const lz = a.object.z - stone.centre.z;
      const tx = a.target.x - stone.centre.x;
      const tz = a.target.z - stone.centre.z;
      const angleRad = (a.angle + 45) * DEG;
      const phi = -angleRad + Math.PI / 2;

      if (state !== 'locked') {
        item.object = theme.createObject();
        item.object.group.position.set(lx, 0, lz);
        item.object.group.rotation.y = phi;
        item.object.setLit(state === 'solved');
        item.object.lit = state === 'solved' ? 1 : 0;
        item.object.flash = 0;
        level.group.add(item.object.group);
      }
      if (state === 'open') {
        item.target = theme.createTarget();
        item.target.group.position.set(tx, 0, tz);
        item.target.group.userData.col = i;
        level.group.add(item.target.group);
      }
      return item;
    });

    focus = { floor: n, items };
    return focus;
  }

  function setProgress(p) {
    const focusFloor = focus?.floor ?? null;
    clearFocus();
    current = p;
    buildLevels();
    for (let k = 1; k <= 5; k++) {
      const lit = (p.floorsLit ?? []).includes(k) ? 1 : 0;
      bands[k].litTarget = lit;
      bands[k].lit = lit;
    }
    if (focusFloor) setFocusFloor(focusFloor);
  }

  function setTheme(next) {
    if (!next || next.id === theme.id) return;
    theme = next;
    const focusFloor = focus?.floor ?? null;
    clearFocus();
    disposeTemplates();
    makeTemplates();
    buildLevels();
    if (focusFloor) setFocusFloor(focusFloor);
  }

  function setPlatformLevel(level, bump = 0) {
    platformYPos = level * AXIS_STEP + bump;
    platform.position.set(0, platformYPos, 0);
  }

  function setPlatformY(y, bump = 0) {
    platformYPos = y + bump;
    platform.position.set(0, platformYPos, 0);
  }

  function setLevelPresence(k, p) {
    const l = levels[k];
    if (!l) return;
    l.presence = p;
    if (l.mesh?.material?.uniforms?.uOpacity) {
      l.mesh.material.uniforms.uOpacity.value = p;
    }
    for (const mesh of l.far?.meshes ?? []) {
      mesh.visible = p > 0.85 && !(focus && focus.floor === k);
    }
  }

  function setBandLit(k, on, instant = false) {
    const b = bands[k];
    if (!b) return;
    b.litTarget = on ? 1 : 0;
    if (instant) b.lit = b.litTarget;
  }

  function setBandFold() {}

  function setStair() {}

  function triggerSettle(k) {
    if (k >= 0 && k <= 6) {
      settleTimes[k] = clockTime;
    }
  }

  setProgress(progress);

  // Per-frame animation update
  function update(dt, t, glow, pxPerUnit, mistY = -Infinity, ceilY = Infinity) {
    clockTime = t;
    const isReduced = reducedMotion();

    levels.forEach((l, k) => {
      const stone = l.stone;
      const targetAbove = stone.topY - 0.1 > ceilY ? 0 : 1;
      l.above = isReduced ? targetAbove : damp(l.above ?? 1, targetAbove, 3, dt);
      const shown = Math.min(l.presence, l.above);
      if (l.mesh?.material?.uniforms?.uOpacity) l.mesh.material.uniforms.uOpacity.value = shown;
      for (const m of l.far?.meshes ?? []) m.visible = shown > 0.85 && !(focus && focus.floor === k);
      if (l.far?.halos) l.far.halos.visible = shown > 0.85 && !(focus && focus.floor === k);
      if (bands[k]?.mesh) bands[k].mesh.visible = bands[k].lit > 0.01 && shown > 0.5;
      l.group.visible = shown > 0.01 && stone.topY + 1.6 > mistY;

      // Breathing bob & conical lean
      const { dy, tiltX, tiltZ } = breathe(k, t, isReduced);

      // Settling reaction
      let turnDeg = 0;
      let dip = 0;
      if (settleTimes[k] != null && isReduced) settleTimes[k] = null; // no settling with reduced motion (§9)
      if (settleTimes[k] != null) {
        const since = t - settleTimes[k];
        if (since > 0 && since < 1.6) {
          const s = settle(since);
          turnDeg = s.turnDeg;
          dip = s.dip;
        } else if (since >= 1.6) {
          settleTimes[k] = null;
        }
      }

      l.group.position.set(stone.centre.x, stone.topY + dy - dip, stone.centre.z);
      l.group.rotation.set(tiltX, turnDeg * DEG, tiltZ);
    });

    litTemplate.update(dt, t, glow);
    darkTemplate.update(dt, t, glow);

    const flicker = isReduced ? 1 : 1 + Math.sin(t * 7.3) * 0.03 + Math.sin(t * 13.1) * 0.02;
    for (const l of levels) {
      const h = l.far?.halos;
      if (!h) continue;
      h.material.color.copy(glow);
      h.material.size = 1.5 * pxPerUnit * flicker;
      h.material.opacity = 0.55 * clamp((l.presence - 0.85) / 0.15, 0, 1);
    }

    for (let k = 1; k <= 5; k++) {
      const b = bands[k];
      if (!b || !b.material) continue;
      b.lit = isReduced ? b.litTarget : damp(b.lit, b.litTarget, 1.4, dt);
      b.material.uniforms.uGlow.value.copy(glow);
      b.material.uniforms.uGlowAmt.value = b.lit * 0.6;
      if (b.mesh) b.mesh.visible = b.lit > 0.01 && Math.min(levels[k].presence, levels[k].above ?? 1) > 0.5;
    }

    if (focus) {
      for (const item of focus.items) {
        item.object?.update(dt, t, glow);
        item.target?.update(dt, t, glow, false);
        if (item.object) item.object.group.position.y = item.rise;
      }
    }

    if (capstoneObject) {
      capstoneObject.update(dt, t, glow);
    }
  }

  function dispose() {
    clearFocus();
    disposeTemplates();
    group.traverse((o) => {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material?.dispose?.();
    });
  }

  return {
    group,
    levels,
    bands,
    platform,
    get focus() {
      return focus;
    },
    get progress() {
      return current;
    },
    get capstoneObject() {
      return capstoneObject;
    },
    setProgress,
    setTheme,
    setFocusFloor,
    setLevelPresence,
    setBandFold,
    setBandLit,
    setPlatformLevel,
    setPlatformY,
    setStair,
    triggerSettle,
    update,
    dispose,
  };
}
