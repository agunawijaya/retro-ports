/**
 * @file The pastel material (reference §4, ART-DIRECTION §4).
 *
 * No real-time lights. Each surface picks a tint by which way it faces
 * relative to the camera, so a box reads as three flat tones, then fades into
 * mist downward and toward the horizon. One ShaderMaterial for every solid.
 */

import * as THREE from 'three';

/** Light uniforms shared by every pastel material; a mood change writes them once. */
export const light = {
  uTop: { value: new THREE.Color() },
  uLeft: { value: new THREE.Color() },
  uRight: { value: new THREE.Color() },
  uUnder: { value: new THREE.Color() },
  uFog: { value: new THREE.Color() },
  uDirL: { value: new THREE.Vector3(0, 0, 1) },
  uDirR: { value: new THREE.Vector3(1, 0, 0) },
  uFogDepth: { value: 4.2 },
  uFogNear: { value: 10 },
  uFogFar: { value: 30 },
};

/** Architecture colours are shared uniforms too: one write per role per frame. */
export const roles = {};
for (const key of ['floorA', 'floorB', 'stone', 'wall', 'cap', 'goal']) {
  roles[key] = { value: new THREE.Color() };
}

export const VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorld;
  #ifdef USE_ROLES
    // One mesh carries several architecture roles: each vertex names its role,
    // so a whole tower level is one draw call and still follows the mood.
    attribute float role;
    uniform vec3 uRoleColors[6];
    varying vec3 vRoleColor;
  #endif
  #ifdef USE_INSTANCE_GLOW
    attribute float aGlowAmt;
    varying float vGlowAmt;
  #endif
  #ifdef USE_INSTANCING_COLOR
    varying vec3 vInstanceColor;
  #endif
  #ifdef USE_INSTANCE_COLOR
    attribute vec3 aColor;
    varying vec3 vInstanceColor;
  #endif
  #ifdef USE_FOG_MIX
    // How far this vertex has already gone into the cloud, independent of its
    // height: a stone floating high in the sky still fades underneath.
    attribute float aFogMix;
    varying float vFogMix;
  #endif
  void main() {
    #ifdef USE_INSTANCING
      mat4 m = modelMatrix * instanceMatrix;
    #else
      mat4 m = modelMatrix;
    #endif
    vec4 world = m * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(m) * normal);
    #ifdef USE_ROLES
      vRoleColor = uRoleColors[int(role + 0.5)];
    #endif
    #ifdef USE_INSTANCE_GLOW
      vGlowAmt = aGlowAmt;
    #endif
    #ifdef USE_INSTANCING_COLOR
      vInstanceColor = instanceColor;
    #endif
    #ifdef USE_INSTANCE_COLOR
      vInstanceColor = aColor;
    #endif
    #ifdef USE_FOG_MIX
      vFogMix = aFogMix;
    #endif
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  #ifdef USE_ROLES
    varying vec3 vRoleColor;
  #endif
  #ifdef USE_INSTANCE_GLOW
    varying float vGlowAmt;
  #endif
  #ifdef USE_INSTANCING_COLOR
    varying vec3 vInstanceColor;
  #endif
  #ifdef USE_INSTANCE_COLOR
    varying vec3 vInstanceColor;
  #endif
  #ifdef USE_FOG_MIX
    varying float vFogMix;
  #endif
  uniform vec3 uColor, uGlow;
  uniform float uGlowAmt, uOpacity;
  uniform vec3 uTop, uLeft, uRight, uUnder, uFog, uDirL, uDirR;
  uniform float uFogDepth, uFogNear, uFogFar;
  varying vec3 vNormal;
  varying vec3 vWorld;

  void main() {
    vec3 n = normalize(vNormal);

    // How much each face direction contributes. Flat faces land on a single
    // tint; curved surfaces (robe, hat, domes) blend smoothly between them.
    float wTop = max(n.y, 0.0);
    float wUnder = max(-n.y, 0.0);
    float wL = max(dot(n, uDirL), 0.0);
    float wR = max(dot(n, uDirR), 0.0);
    float wBackL = max(-dot(n, uDirL), 0.0);
    float wBackR = max(-dot(n, uDirR), 0.0);
    vec3 tint = (wTop * uTop + wL * uLeft + wR * uRight + wUnder * uUnder + wBackL * uRight + wBackR * uLeft)
              / (wTop + wL + wR + wUnder + wBackL + wBackR + 1e-4);

    #ifdef USE_ROLES
      vec3 base = vRoleColor;
    #elif defined(USE_INSTANCING_COLOR)
      vec3 base = vInstanceColor;
    #elif defined(USE_INSTANCE_COLOR)
      vec3 base = vInstanceColor;
    #else
      vec3 base = uColor;
    #endif
    vec3 col = base * tint;

    // A cheap contact darkening where vertical faces meet the floor.
    float side = 1.0 - abs(n.y);
    float ao = mix(0.84, 1.0, smoothstep(0.0, 0.26, vWorld.y));
    col *= mix(1.0, ao, side * step(-0.02, vWorld.y));

    // Glow: lit objects, target rings.
    #ifdef USE_INSTANCE_GLOW
      float glowAmt = vGlowAmt;
    #else
      float glowAmt = uGlowAmt;
    #endif
    col = mix(col, uGlow, glowAmt * 0.82) + uGlow * glowAmt * 0.22;

    // Everything dissolves into mist below the island and towards the horizon.
    float down = smoothstep(-0.05, -uFogDepth, vWorld.y);
    float far = smoothstep(uFogNear, uFogFar, length(vWorld.xz));
    float fog = clamp(max(down, far * 0.92), 0.0, 1.0);
    #ifdef USE_FOG_MIX
      fog = max(fog, vFogMix);
    #endif
    col = mix(col, uFog, fog);

    #ifdef USE_ROLES
      // Architecture never turns to glass: a fading level dissolves, pixel by
      // pixel, and every pixel it keeps stays solid.
      if (uOpacity < 0.999) {
        float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (n > uOpacity) discard;
      }
      gl_FragColor = vec4(col, 1.0);
    #else
      gl_FragColor = vec4(col, uOpacity);
    #endif
    #include <colorspace_fragment>
  }
`;

/**
 * @param {string|null} color base colour, or null with `roleColor`
 * @param {{ glow?: string, opacity?: number, roleColor?: { value: THREE.Color }, instancedGlow?: boolean, instancedColor?: boolean }} [options]
 */
export function pastel(color, { glow = null, opacity = 1, roleColor = null, instancedGlow = false, instancedColor = false } = {}) {
  const defines = {};
  if (instancedGlow) defines.USE_INSTANCE_GLOW = '';
  if (instancedColor) defines.USE_INSTANCE_COLOR = '';
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines,
    uniforms: {
      ...light,
      uColor: roleColor ?? { value: new THREE.Color(color ?? '#ffffff') },
      uGlow: { value: new THREE.Color(glow ?? '#ffffff') },
      uGlowAmt: { value: 0 },
      uOpacity: { value: opacity },
    },
    transparent: opacity < 1,
  });
}

/** Role order for `pastelRoles` geometry: the `role` attribute indexes this list. */
export const ROLE_INDEX = { floorA: 0, floorB: 1, stone: 2, wall: 3, cap: 4, goal: 5 };

/**
 * The pastel material for merged geometry that mixes architecture roles. The
 * geometry needs a per-vertex `role` attribute (see ROLE_INDEX); the colours
 * are the same shared role uniforms every room uses, so the mood still writes
 * them once.
 * @param {{ opacity?: number }} [options]
 */
export function pastelRoles({ opacity = 1, fogMix = false } = {}) {
  const colors = Object.keys(ROLE_INDEX).map((k) => roles[k].value);
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: fogMix ? { USE_ROLES: '', USE_FOG_MIX: '' } : { USE_ROLES: '' },
    uniforms: {
      ...light,
      uRoleColors: { value: colors },
      uColor: { value: new THREE.Color('#ffffff') },
      uGlow: { value: new THREE.Color('#ffffff') },
      uGlowAmt: { value: 0 },
      uOpacity: { value: opacity },
    },
    transparent: opacity < 1,
  });
}
