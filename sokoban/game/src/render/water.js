/**
 * @file The water shader (reference §13b, ART-DIRECTION §10b.1): two slow
 * interfering wave sets; where they peak, the sky glints.
 */

import * as THREE from 'three';
import { VERT, light } from './pastel.js';

export const waterUniforms = { uTime: { value: 0 }, uWater: { value: new THREE.Color() } };
/** Pond bottoms: the mood's water × 0.72, written with the mood. */
export const pondDeep = { value: new THREE.Color() };

export const WATER_Y = 0.1; // pond surface
export const RIM_H = 0.22; // pond rim: low, but clearly a boundary

const WATER_FRAG = /* glsl */ `
  uniform vec3 uWater, uTop;
  uniform float uTime, uOpacity;
  varying vec3 vWorld;
  void main() {
    vec2 p = vWorld.xz;
    float a = sin(p.x * 11.0 + uTime * 0.9) * sin(p.y * 9.0 - uTime * 0.7);
    float b = sin((p.x - p.y) * 17.0 + uTime * 1.5) * 0.45;
    float glint = smoothstep(1.02, 1.3, a + b);
    float depth = 0.5 + 0.5 * sin(p.x * 2.1 + p.y * 1.7 + uTime * 0.2);
    vec3 col = mix(uWater * (0.94 + depth * 0.08), uTop, 0.1 + glint * 0.5);
    gl_FragColor = vec4(col, uOpacity);
    #include <colorspace_fragment>
  }
`;

export function waterMaterial(opacity = 0.58) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: WATER_FRAG,
    uniforms: { ...waterUniforms, uTop: light.uTop, uOpacity: { value: opacity } },
    transparent: true,
    depthWrite: false,
  });
}
