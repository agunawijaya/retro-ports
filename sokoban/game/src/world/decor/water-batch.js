/**
 * @file One batch for all of a room's water decor (prompt 04, fix 1).
 * A pond or a basin used to draw its own handful of meshes each; a big room
 * holds a dozen basins and half a dozen ponds, and the total ran past the
 * ≤ 150 draw-call budget (ARCHITECTURE §14) even with the theme objects
 * instanced. The batch collects the still geometry while the ponds and
 * basins are built, merges it once per material, and draws the pads,
 * blooms, koi and basin drops as shared instanced meshes — so a room's
 * water decor costs about as much as one pond did, however much there is.
 * Only `decor/index.js` batches; the courtyard's Kolam builds its own pond
 * as before.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pastel, roles } from '../../render/pastel.js';
import { waterMaterial, pondDeep } from '../../render/water.js';
import { textures } from '../../render/textures.js';
import { writeInstanceColor } from './ponds.js';
import { reducedMotion } from '../../state/settings.js';

const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));

/** Basin drops: small billboard glow quads, one instance per basin. */
const DROP_VERT = /* glsl */ `
  attribute float aOpacity;
  varying float vOpacity;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vOpacity = aOpacity;
    vec4 worldCenter = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 mvPosition = viewMatrix * worldCenter;
    mvPosition.xy += position.xy * 0.06;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const DROP_FRAG = /* glsl */ `
  uniform sampler2D map;
  varying float vOpacity;
  varying vec2 vUv;
  void main() {
    if (vOpacity < 0.002) discard;
    vec4 tex = texture2D(map, vUv);
    gl_FragColor = vec4(tex.rgb, vOpacity * tex.a);
    #include <colorspace_fragment>
  }
`;

export class WaterBatch {
  constructor() {
    // Pond shells and basin still parts: geometry lists, merged once at build.
    this.bottomGeos = [];
    this.rimGeos = [];
    this.surfaceGeos = [];
    this.mossGeos = [];
    this.stoneGeos = [];
    this.bambooGeos = [];
    this.basinWaterGeos = [];
    // Instanced parts.
    this.pads = []; // { x, y, z, r, rot }
    this.bloomPads = []; // pad indices that carry a bloom
    this.koiPalettes = []; // [body, spot] per slot
    this.dropCount = 0;
  }

  /** The koi slot count claimed so far; a pond's slots start here. */
  get koiSlots() {
    return this.koiPalettes.length;
  }

  /** A pond's still shell: its merged lists join the room-wide ones. */
  addPondShell({ bottom, rim, surface }) {
    this.bottomGeos.push(...bottom);
    this.rimGeos.push(...rim);
    this.surfaceGeos.push(...surface);
  }

  /** A lily pad; returns its instance index (blooms anchor to it). */
  addPad(x, y, z, r, rot) {
    this.pads.push({ x, y, z, r, rot });
    return this.pads.length - 1;
  }

  addBloom(padIndex) {
    this.bloomPads.push(padIndex);
  }

  /** Claims one koi slot; returns its index. */
  addKoi(body, spot) {
    this.koiPalettes.push([body, spot]);
    return this.koiPalettes.length - 1;
  }

  /** A basin's still parts, already in island space. */
  addBasinParts({ moss, stone, bamboo, water }) {
    this.mossGeos.push(...moss);
    this.stoneGeos.push(...stone);
    this.bambooGeos.push(...bamboo);
    this.basinWaterGeos.push(...water);
  }

  /** Claims one drop slot; returns its index. */
  addDrop() {
    return this.dropCount++;
  }

  /**
   * Creates the merged and instanced meshes under `group`. Call once, after
   * every pond and basin has registered its parts.
   */
  build(group) {
    const addMerged = (geos, material, renderOrder) => {
      if (!geos.length) return;
      const mesh = new THREE.Mesh(merge(geos), material);
      if (renderOrder) mesh.renderOrder = renderOrder;
      group.add(mesh);
      geos.forEach((g) => g.dispose());
      geos.length = 0;
    };
    addMerged(this.bottomGeos, pastel(null, { roleColor: pondDeep }));
    addMerged(this.rimGeos, pastel(null, { roleColor: roles.cap }));
    addMerged(this.surfaceGeos, waterMaterial(), 2);
    addMerged(this.mossGeos, pastel('#c7cfb6'));
    addMerged(this.stoneGeos, pastel('#ddd3c7'));
    addMerged(this.bambooGeos, pastel('#b9c98f'));
    addMerged(this.basinWaterGeos, waterMaterial(0.9), 2);

    // Lily pads: one instanced mesh; the slow spin is per instance.
    this.padMesh = null;
    if (this.pads.length) {
      const padGeo = new THREE.CircleGeometry(1, 18, 0.4, Math.PI * 2 - 0.4).rotateX(-Math.PI / 2);
      this.padMesh = new THREE.InstancedMesh(padGeo, pastel('#a9c99b'), this.pads.length);
      this.padMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(this.padMesh);
    }

    // One bloom per first pad, riding its pad's spin like the child it replaces.
    this.bloomMesh = null;
    if (this.bloomPads.length) {
      const bloomGeo = new THREE.SphereGeometry(0.035, 10, 8);
      bloomGeo.scale(1, 0.7, 1);
      bloomGeo.translate(0.02, 0.02, 0);
      this.bloomMesh = new THREE.InstancedMesh(bloomGeo, pastel('#f5c2cf'), this.bloomPads.length);
      this.bloomMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(this.bloomMesh);
    }
    this.updatePads(0);

    // Koi: three shared instanced meshes for the whole room (04 instanced
    // them per pond; the batch takes the last per-pond multiplier away).
    // Colour rides a merged-geometry `aColor` attribute (`pastel`'s
    // `instancedColor` option), not `InstancedMesh.setColorAt`: three only
    // gives the built-in `USE_INSTANCING_COLOR` define to the vertex stage,
    // so pastel's fragment shader never saw it and every koi came out
    // white (the room's water-decor koi, fix 2 of prompt 04).
    this.koiBody = this.koiSpot = this.koiFin = null;
    if (this.koiPalettes.length) {
      const bodyGeo = new THREE.SphereGeometry(1, 14, 10);
      bodyGeo.scale(0.045, 0.026, 0.12);
      const spotGeo = new THREE.SphereGeometry(1, 10, 8);
      spotGeo.scale(0.036, 0.02, 0.05);
      spotGeo.translate(0, 0.009, 0.025);
      const finGeo = new THREE.ConeGeometry(0.05, 0.09, 4);
      finGeo.rotateX(-Math.PI / 2);
      finGeo.scale(1, 1, 0.22);
      finGeo.translate(0, 0, -0.035);
      const n = this.koiPalettes.length;
      const bodyColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      const spotColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      const finColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      bodyGeo.setAttribute('aColor', bodyColor);
      spotGeo.setAttribute('aColor', spotColor);
      finGeo.setAttribute('aColor', finColor);
      this.koiBody = new THREE.InstancedMesh(bodyGeo, pastel('#ffffff', { instancedColor: true }), n);
      this.koiSpot = new THREE.InstancedMesh(spotGeo, pastel('#ffffff', { instancedColor: true }), n);
      this.koiFin = new THREE.InstancedMesh(finGeo, pastel('#ffffff', { instancedColor: true }), n);
      for (const mesh of [this.koiBody, this.koiSpot, this.koiFin]) {
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        group.add(mesh);
      }
      this.koiPalettes.forEach(([body, spot], i) => {
        writeInstanceColor(bodyColor, i, body);
        writeInstanceColor(spotColor, i, spot);
        writeInstanceColor(finColor, i, body);
      });
      bodyColor.needsUpdate = true;
      spotColor.needsUpdate = true;
      finColor.needsUpdate = true;
    }

    // Basin drops: one instanced billboard for every basin in the room.
    this.dropMesh = null;
    this.dropOpacity = null;
    if (this.dropCount) {
      const dropGeo = new THREE.PlaneGeometry(1, 1);
      this.dropOpacity = new THREE.InstancedBufferAttribute(new Float32Array(this.dropCount), 1);
      dropGeo.setAttribute('aOpacity', this.dropOpacity);
      const dropMat = new THREE.ShaderMaterial({
        vertexShader: DROP_VERT,
        fragmentShader: DROP_FRAG,
        uniforms: { map: { value: textures().glow } },
        transparent: true,
        depthWrite: false,
      });
      this.dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, this.dropCount);
      this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.dropMesh.frustumCulled = false;
      group.add(this.dropMesh);
      this.dropMatrix = new THREE.Matrix4();
    }
  }

  /** Pads and blooms drift; koi matrices are written by the ponds. */
  update(dt) {
    if (!reducedMotion()) {
      this.updatePads(dt);
    }
    if (this.koiBody) {
      this.koiBody.instanceMatrix.needsUpdate = true;
      this.koiSpot.instanceMatrix.needsUpdate = true;
      this.koiFin.instanceMatrix.needsUpdate = true;
    }
  }

  updatePads(dt) {
    if (!this.padMesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    this.pads.forEach((p, i) => {
      p.rot += dt * 0.03;
      q.setFromAxisAngle(up, p.rot);
      pos.set(p.x, p.y, p.z);
      scale.set(p.r, 1, p.r);
      m.compose(pos, q, scale);
      this.padMesh.setMatrixAt(i, m);
      if (this.bloomMesh) {
        const b = this.bloomPads.indexOf(i);
        if (b !== -1) this.bloomMesh.setMatrixAt(b, m);
      }
    });
    this.padMesh.instanceMatrix.needsUpdate = true;
    if (this.bloomMesh) this.bloomMesh.instanceMatrix.needsUpdate = true;
  }

  /** A basin's falling drop: position and opacity for its instance. */
  setDrop(slot, x, y, z, opacity) {
    if (!this.dropMesh) return;
    this.dropMatrix.makeTranslation(x, y, z);
    this.dropMesh.setMatrixAt(slot, this.dropMatrix);
    this.dropOpacity.setX(slot, opacity);
    this.dropMesh.instanceMatrix.needsUpdate = true;
    this.dropOpacity.needsUpdate = true;
  }

  dispose() {
    for (const mesh of [this.padMesh, this.bloomMesh, this.koiBody, this.koiSpot, this.koiFin, this.dropMesh]) {
      if (mesh) {
        mesh.geometry?.dispose();
        mesh.material?.dispose();
        mesh.dispose?.();
      }
    }
  }
}
