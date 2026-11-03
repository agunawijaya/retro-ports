/**
 * @file Instanced theme objects and targets (ARCHITECTURE §7.2, prompt 04).
 *
 * Keeps room draw calls under the <= 150 budget by drawing all instances of
 * each theme part (foot, post, roof, core...) and target part as single
 * InstancedMeshes per room. Per-instance attributes (aGlowAmt, aOpacity, aScale)
 * allow lit, unlit, pulsing, and wobbling objects to share a single draw call.
 */

import * as THREE from 'three';
import { pastel, roles } from './pastel.js';
import { textures } from './textures.js';
import { damp } from './math.js';
import { shadows } from '../world/shadow.js';

const _objMat = new THREE.Matrix4();
const _partMat = new THREE.Matrix4();
const _haloMat = new THREE.Matrix4();
const _poolMat = new THREE.Matrix4();
const _shadowMat = new THREE.Matrix4();

const HIT_GEO = new THREE.BoxGeometry(0.62, 0.85, 0.62);
const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });

/** Shared billboard vertex shader for additive halo sprites. */
const HALO_VERT = /* glsl */ `
  attribute float aOpacity;
  attribute float aScale;
  varying float vOpacity;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vOpacity = aOpacity;
    #ifdef USE_INSTANCING
      vec4 worldCenter = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    #else
      vec4 worldCenter = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    #endif
    vec4 mvPosition = viewMatrix * worldCenter;
    mvPosition.xy += position.xy * aScale;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const HALO_FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uGlow;
  varying float vOpacity;
  varying vec2 vUv;

  void main() {
    if (vOpacity < 0.002) discard;
    vec4 tex = texture2D(map, vUv);
    gl_FragColor = vec4(uGlow * tex.rgb, vOpacity * tex.a);
    #include <colorspace_fragment>
  }
`;

/** Shared horizontal plane vertex & frag for floor light pools. */
const POOL_VERT = /* glsl */ `
  attribute float aOpacity;
  varying float vOpacity;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vOpacity = aOpacity;
    #ifdef USE_INSTANCING
      vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    #else
      vec4 world = modelMatrix * vec4(position, 1.0);
    #endif
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const POOL_FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uGlow;
  varying float vOpacity;
  varying vec2 vUv;

  void main() {
    if (vOpacity < 0.002) discard;
    vec4 tex = texture2D(map, vUv);
    gl_FragColor = vec4(uGlow * tex.rgb, vOpacity * tex.a);
    #include <colorspace_fragment>
  }
`;

/**
 * Builds instanced theme meshes for a room.
 *
 * @param {{
 *   theme: object,
 *   level: object,
 *   group: THREE.Group,
 *   isTarget: (r: number, c: number) => boolean,
 * }} options
 */
export function createThemeInstances({ theme, level, group, isTarget }) {
  const TEX = textures();
  const objectCount = level.objects.length;
  const targetCount = level.targets.length;

  // --- Object handles --------------------------------------------------------
  const objects = [];
  const themeScale = typeof theme.objectScale === 'number' ? theme.objectScale : (typeof theme.scale === 'number' ? theme.scale : 1.15);

  for (let i = 0; i < objectCount; i++) {
    const o = level.objects[i];
    const g = new THREE.Object3D();
    const body = new THREE.Object3D();
    body.scale.setScalar(themeScale);
    g.add(body);

    // Invisible hit box so pointer/raycasting finds the object without drawing.
    const hitMesh = new THREE.Mesh(HIT_GEO, HIT_MAT);
    hitMesh.position.y = 0.425;
    body.add(hitMesh);
    group.add(g);

    const handle = {
      group: g,
      body,
      isLit: false,
      lit: 0,
      flash: 0,
      tilt: 0,
      tiltVel: 0,
      pushDir: new THREE.Vector3(),
      flicker: Math.random() * 10,
      spin: 0,
      userData: {},
      setLit(on) {
        this.isLit = on;
        if (on) this.flash = 1;
      },
      nudge(dx, dz, amount) {
        this.pushDir.set(dx, 0, dz);
        this.tiltVel += amount;
      },
      update(dt, time) {
        this.lit = damp(this.lit, this.isLit ? 1 : 0, this.isLit ? 3.2 : 6, dt);
        this.flash = Math.max(0, this.flash - dt * 1.4);

        // Wobble spring
        this.tiltVel += (-this.tilt * 90 - this.tiltVel * 9) * dt;
        this.tilt += this.tiltVel * dt;
        this.body.rotation.x = this.pushDir.z * this.tilt;
        this.body.rotation.z = -this.pushDir.x * this.tilt;

        // Custom update hook (e.g. crystal rotation in Cahaya Bintang)
        if (theme.updateObject) {
          theme.updateObject(this, dt, time);
        }
      },
    };
    handle.setLit(isTarget(o.r, o.c));
    objects.push(handle);
  }

  // --- Target handles --------------------------------------------------------
  const targets = [];
  for (let j = 0; j < targetCount; j++) {
    const t = level.targets[j];
    const tg = new THREE.Object3D();
    tg.userData.col = t.c;
    group.add(tg);

    const handle = {
      group: tg,
      glowAmt: 0,
      update(dt, time, glow, covered) {
        const c = this.group.userData.col ?? 0;
        this.glowAmt = covered ? 0 : 0.35 + Math.sin(time * 1.6 + c) * 0.15;
      },
    };
    targets.push(handle);
  }

  // --- Instanced Meshes ------------------------------------------------------
  const partMeshes = [];
  const partGlowAttrs = [];
  const disposables = [];

  if (objectCount > 0 && theme.parts) {
    for (const part of theme.parts) {
      const mat = pastel(part.color ?? null, {
        roleColor: part.role ? roles[part.role] : null,
        instancedGlow: !!part.glows,
      });
      disposables.push(mat);

      const geo = part.geometry.clone();
      disposables.push(geo);

      let glowAttr = null;
      if (part.glows) {
        const glowArray = new Float32Array(objectCount);
        glowAttr = new THREE.InstancedBufferAttribute(glowArray, 1);
        geo.setAttribute('aGlowAmt', glowAttr);
        partGlowAttrs.push(glowAttr);
      } else {
        partGlowAttrs.push(null);
      }

      const imesh = new THREE.InstancedMesh(geo, mat, objectCount);
      imesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(imesh);
      partMeshes.push(imesh);
      disposables.push(imesh);
    }
  }

  // Halos (Instanced additive billboard quads)
  let haloMesh = null;
  let haloOpacityAttr = null;
  let haloScaleAttr = null;
  let haloMat = null;

  if (objectCount > 0) {
    const haloGeo = new THREE.PlaneGeometry(1, 1);
    disposables.push(haloGeo);
    const haloOpacityArr = new Float32Array(objectCount);
    const haloScaleArr = new Float32Array(objectCount);
    haloOpacityAttr = new THREE.InstancedBufferAttribute(haloOpacityArr, 1);
    haloScaleAttr = new THREE.InstancedBufferAttribute(haloScaleArr, 1);
    haloGeo.setAttribute('aOpacity', haloOpacityAttr);
    haloGeo.setAttribute('aScale', haloScaleAttr);

    haloMat = new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: {
        map: { value: TEX.glow },
        uGlow: { value: new THREE.Color('#ffd9a0') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    disposables.push(haloMat);

    haloMesh = new THREE.InstancedMesh(haloGeo, haloMat, objectCount);
    haloMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(haloMesh);
    disposables.push(haloMesh);
  }

  // Pools (Instanced floor discs at y = 0.012)
  let poolMesh = null;
  let poolOpacityAttr = null;
  let poolMat = null;

  if (objectCount > 0) {
    const poolGeo = new THREE.PlaneGeometry(2.4, 2.4);
    poolGeo.rotateX(-Math.PI / 2);
    disposables.push(poolGeo);

    const poolOpacityArr = new Float32Array(objectCount);
    poolOpacityAttr = new THREE.InstancedBufferAttribute(poolOpacityArr, 1);
    poolGeo.setAttribute('aOpacity', poolOpacityAttr);

    poolMat = new THREE.ShaderMaterial({
      vertexShader: POOL_VERT,
      fragmentShader: POOL_FRAG,
      uniforms: {
        map: { value: TEX.glow },
        uGlow: { value: new THREE.Color('#ffd9a0') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    disposables.push(poolMat);

    poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, objectCount);
    poolMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(poolMesh);
    disposables.push(poolMesh);
  }

  // Shadows (Instanced floor contact shadow discs at y = 0.006)
  let shadowMesh = null;
  let shadowMat = null;

  if (objectCount > 0) {
    const shadowGeo = new THREE.PlaneGeometry(0.9, 0.9);
    shadowGeo.rotateX(-Math.PI / 2);
    disposables.push(shadowGeo);

    shadowMat = new THREE.MeshBasicMaterial({
      map: TEX.shadow,
      color: '#7d6f96',
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    shadows.add(shadowMat);
    disposables.push(shadowMat);

    shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, objectCount);
    shadowMesh.renderOrder = 1;
    shadowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(shadowMesh);
    disposables.push(shadowMesh);
  }

  // Target instanced parts
  const targetMeshes = [];
  const targetGlowAttrs = [];

  if (targetCount > 0 && theme.targetParts) {
    for (const part of theme.targetParts) {
      const mat = pastel(part.color ?? null, {
        roleColor: part.role ? roles[part.role] : null,
        instancedGlow: !!part.glows,
      });
      disposables.push(mat);

      const geo = part.geometry.clone();
      disposables.push(geo);

      let glowAttr = null;
      if (part.glows) {
        const glowArray = new Float32Array(targetCount);
        glowAttr = new THREE.InstancedBufferAttribute(glowArray, 1);
        geo.setAttribute('aGlowAmt', glowAttr);
        targetGlowAttrs.push(glowAttr);
      } else {
        targetGlowAttrs.push(null);
      }

      const imesh = new THREE.InstancedMesh(geo, mat, targetCount);
      imesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(imesh);
      targetMeshes.push(imesh);
      disposables.push(imesh);
    }
  }

  // Room extras (e.g. Mata Air water channels, Taman Batu raked sand)
  const roomExtras = theme.roomExtras ? theme.roomExtras(level, group) : null;

  // --- Per-frame update ------------------------------------------------------
  const effectiveGlow = new THREE.Color();

  function sync(dt, time, glow) {
    if (theme.accent) {
      effectiveGlow.copy(glow).lerp(new THREE.Color(theme.accent), 0.5);
    } else {
      effectiveGlow.copy(glow);
    }

    // Update glow uniforms on halo & pool
    if (haloMat) haloMat.uniforms.uGlow.value.copy(effectiveGlow);
    if (poolMat) poolMat.uniforms.uGlow.value.copy(effectiveGlow);
    for (let p = 0; p < partMeshes.length; p++) {
      if (theme.parts[p].glows) {
        partMeshes[p].material.uniforms.uGlow.value.copy(effectiveGlow);
      }
    }
    for (let tp = 0; tp < targetMeshes.length; tp++) {
      if (theme.targetParts[tp].glows) {
        targetMeshes[tp].material.uniforms.uGlow.value.copy(effectiveGlow);
      }
    }

    // Sync object instances
    const haloY = (theme.haloY ?? 0.45) * themeScale;
    for (let i = 0; i < objectCount; i++) {
      const obj = objects[i];
      obj.group.updateMatrix();
      obj.body.updateMatrix();
      _objMat.multiplyMatrices(obj.group.matrix, obj.body.matrix);

      for (let p = 0; p < partMeshes.length; p++) {
        const part = theme.parts[p];
        if (part.beam) {
          if (obj.lit > 0.02) {
            _partMat.copy(_objMat);
            partGlowAttrs[p]?.setX(i, obj.lit * 0.25);
          } else {
            _partMat.makeScale(0, 0, 0);
            partGlowAttrs[p]?.setX(i, 0);
          }
        } else if (part.spins) {
          const spinMat = new THREE.Matrix4().makeRotationY(obj.spin || 0);
          _partMat.multiplyMatrices(_objMat, spinMat);
          if (part.transform) _partMat.multiply(part.transform);
          if (part.glows && partGlowAttrs[p]) {
            partGlowAttrs[p].setX(i, obj.lit * 0.95);
          }
        } else {
          if (part.transform) {
            _partMat.multiplyMatrices(_objMat, part.transform);
          } else {
            _partMat.copy(_objMat);
          }
          if (part.glows && partGlowAttrs[p]) {
            if (part.candiDelay) {
              partGlowAttrs[p].setX(i, (obj.delayLit || 0) * 0.95);
            } else {
              partGlowAttrs[p].setX(i, obj.lit * 0.95);
            }
          }
        }
        partMeshes[p].setMatrixAt(i, _partMat);
      }

      const flicker = 1 + Math.sin(time * 7.3 + obj.flicker) * 0.03 + Math.sin(time * 13.1 + obj.flicker * 2) * 0.02;
      if (haloMesh) {
        _haloMat.makeTranslation(obj.group.position.x, haloY, obj.group.position.z);
        haloMesh.setMatrixAt(i, _haloMat);
        const haloOpacity = obj.lit * 0.48 * flicker;
        const haloScale = (1.25 + obj.flash * 0.9) * flicker;
        haloOpacityAttr.setX(i, haloOpacity);
        haloScaleAttr.setX(i, obj.lit > 0.002 ? haloScale : 0);
      }

      if (poolMesh) {
        _poolMat.makeTranslation(obj.group.position.x, 0.012, obj.group.position.z);
        poolMesh.setMatrixAt(i, _poolMat);
        poolOpacityAttr.setX(i, obj.lit > 0.002 ? obj.lit * 0.28 : 0);
      }

      if (shadowMesh) {
        _shadowMat.makeTranslation(obj.group.position.x, 0.006, obj.group.position.z);
        shadowMesh.setMatrixAt(i, _shadowMat);
      }
    }

    // Mark updated buffers
    for (let p = 0; p < partMeshes.length; p++) {
      partMeshes[p].instanceMatrix.needsUpdate = true;
      if (partGlowAttrs[p]) partGlowAttrs[p].needsUpdate = true;
    }
    if (haloMesh) {
      haloMesh.instanceMatrix.needsUpdate = true;
      haloOpacityAttr.needsUpdate = true;
      haloScaleAttr.needsUpdate = true;
    }
    if (poolMesh) {
      poolMesh.instanceMatrix.needsUpdate = true;
      poolOpacityAttr.needsUpdate = true;
    }
    if (shadowMesh) {
      shadowMesh.instanceMatrix.needsUpdate = true;
    }

    // Sync target instances
    for (let j = 0; j < targetCount; j++) {
      const target = targets[j];
      target.group.updateMatrix();

      for (let tp = 0; tp < targetMeshes.length; tp++) {
        const part = theme.targetParts[tp];
        if (part.transform) {
          _partMat.multiplyMatrices(target.group.matrix, part.transform);
        } else {
          _partMat.copy(target.group.matrix);
        }
        targetMeshes[tp].setMatrixAt(j, _partMat);
        if (part.glows && targetGlowAttrs[tp]) {
          targetGlowAttrs[tp].setX(j, target.glowAmt ?? 0);
        }
      }
    }

    for (let tp = 0; tp < targetMeshes.length; tp++) {
      targetMeshes[tp].instanceMatrix.needsUpdate = true;
      if (targetGlowAttrs[tp]) targetGlowAttrs[tp].needsUpdate = true;
    }
  }

  function dispose() {
    if (shadowMat) shadows.delete(shadowMat);
    for (const d of disposables) {
      if (d.geometry) d.geometry.dispose();
      if (d.material) {
        if (Array.isArray(d.material)) d.material.forEach((m) => m.dispose());
        else d.material.dispose();
      }
      if (d.dispose) d.dispose();
      if (d.parent) d.parent.remove(d);
    }
    for (const o of objects) {
      o.group.removeFromParent();
    }
    for (const t of targets) {
      t.group.removeFromParent();
    }
    if (roomExtras?.dispose) roomExtras.dispose();
  }

  return {
    objects,
    targets,
    sync,
    roomExtras,
    dispose,
  };
}