/**
 * @file The wanderer's poses (reference §12, ART-DIRECTION §8.2–8.3).
 *
 * Every behaviour writes a target pose of 15 numbers; the rig eases towards
 * it. That is why states blend without keyframes: keep it that way.
 */

import { clamp, lerp, smooth, wrapAngle } from '../render/math.js';
import { reducedMotion } from '../state/settings.js';

export const POSE_KEYS = ['lean', 'bob', 'yawOffset', 'headYaw', 'headPitch', 'headRoll',
  'armLPitch', 'armRPitch', 'armLRoll', 'armRRoll', 'stepL', 'stepR', 'sit', 'squash', 'hop'];

export const REST = Object.fromEntries(POSE_KEYS.map((k) => [k, 0]));

/* ---- gait: walk, run, push. p is progress 0..1 across one tile ---- */
export function gaitPose(o, kind, p, stepIndex) {
  const swing = Math.sin(p * Math.PI); // 0 → 1 → 0 across the tile
  const side = stepIndex % 2 ? 1 : -1;
  if (kind === 'walk') {
    o.lean = 0.07;
    o.bob = swing * 0.028;
    o.stepL = side > 0 ? swing : -swing * 0.3;
    o.stepR = side > 0 ? -swing * 0.3 : swing;
    o.armLPitch = -side * swing * 0.42;
    o.armRPitch = side * swing * 0.42;
    o.armLRoll = o.armRRoll = 0.08;
    o.headPitch = 0.05;
  } else if (kind === 'run') {
    o.lean = 0.2;
    o.bob = swing * 0.05;
    o.stepL = side > 0 ? swing * 1.2 : -swing * 0.5;
    o.stepR = side > 0 ? -swing * 0.5 : swing * 1.2;
    o.armLPitch = -side * swing * 0.9 - 0.2;
    o.armRPitch = side * swing * 0.9 - 0.2;
    o.armLRoll = o.armRRoll = 0.14;
    o.headPitch = 0.08;
  } else if (kind === 'push') {
    // Two short, heavy steps per tile, arms locked forward against the stone.
    const heave = Math.sin(p * Math.PI * 2);
    o.lean = 0.3 + Math.abs(heave) * 0.04;
    o.bob = Math.abs(heave) * 0.012;
    o.squash = -0.03;
    o.stepL = heave > 0 ? heave * 0.7 : heave * 0.2;
    o.stepR = heave < 0 ? -heave * 0.7 : -heave * 0.2;
    o.armLPitch = o.armRPitch = -1.38 + Math.abs(heave) * 0.06;
    o.armLRoll = o.armRRoll = -0.12;
    o.headPitch = -0.06;
  } else if (kind === 'rewind') {
    o.lean = -0.08;
    o.armLRoll = o.armRRoll = 0.25;
    o.headPitch = -0.1;
  }
  if (reducedMotion()) {
    o.bob = 0;
  }
}

/* ---- idle: breathe, then look around, then sit and meditate ---- */
export const LOOK_AFTER = 6; // seconds of stillness before glancing around
export const MEDITATE_AFTER = 24; // seconds before sitting down

export function idlePose(o, t, idle) {
  if (reducedMotion()) {
    o.squash = 0;
    o.armLRoll = o.armRRoll = 0.06;
    o.headYaw = o.headPitch = o.headRoll = o.yawOffset = 0;
    return;
  }
  const deep = idle > MEDITATE_AFTER;
  const breath = Math.sin(t * (deep ? 1.0 : 1.7));
  o.squash = breath * (deep ? 0.022 : 0.013);
  o.armLRoll = o.armRRoll = 0.06 + breath * 0.02;

  if (deep) {
    const settle = smooth(clamp((idle - MEDITATE_AFTER) / 1.2, 0, 1));
    o.sit = settle;
    o.armLPitch = o.armRPitch = -0.62 * settle;
    o.armLRoll = o.armRRoll = -0.32 * settle;
    o.headPitch = 0.22 * settle;
    o.yawOffset = 0;
    return;
  }

  if (idle > LOOK_AFTER) {
    // A slow 6-second glance cycle: left, hold, right, hold, centre.
    const c = (idle - LOOK_AFTER) % 6.4;
    let look = 0;
    if (c < 0.7) look = smooth(c / 0.7);
    else if (c < 1.8) look = 1;
    else if (c < 2.8) look = lerp(1, -1, smooth((c - 1.8) / 1.0));
    else if (c < 3.9) look = -1;
    else if (c < 4.6) look = lerp(-1, 0, smooth((c - 3.9) / 0.7));
    o.headYaw = look * 1.05;
    o.yawOffset = look * 0.32;
    o.headPitch = -0.05 + Math.abs(look) * -0.04;
    o.headRoll = look * 0.05;
  }
}

/* ---- one-shot performances ---- */
export const ACTION_LENGTH = { protest: 2.7, shrug: 1.1, bump: 0.45, bow: 2.2 };

export const ACTIONS = {
  // Strain against the stone, give up, turn to the player, throw both hands up.
  protest(o, t, w, ctx) {
    const faceCam = wrapAngle(ctx.cameraYaw - w.yaw);
    if (t < 0.9) {
      const heave = Math.sin(t * 7.2) * 0.5 + 0.5;
      o.lean = 0.24 + heave * 0.12 + Math.sin(t * 46) * 0.01;
      o.armLPitch = o.armRPitch = -1.42;
      o.armLRoll = o.armRRoll = -0.12;
      o.stepL = heave * 0.35;
      o.stepR = -heave * 0.2;
      o.squash = -0.03 * heave;
      o.headPitch = -0.08;
    } else if (t < 1.3) {
      o.yawOffset = faceCam * smooth((t - 0.9) / 0.4);
      o.lean = -0.02;
      o.armLRoll = o.armRRoll = 0.1;
    } else if (t < 2.15) {
      const k = t - 1.3;
      o.yawOffset = faceCam;
      o.armLPitch = o.armRPitch = -2.85;
      o.armLRoll = o.armRRoll = 0.12;
      o.headPitch = -0.18;
      o.headRoll = k > 0.2 ? Math.sin(k * 13) * 0.16 : 0;
      o.hop = Math.max(0, Math.sin(clamp(k / 0.32, 0, 1) * Math.PI)) * 0.07;
      o.lean = -0.08;
    } else {
      const k = smooth((t - 2.15) / 0.55);
      o.yawOffset = faceCam * (1 - k);
      o.lean = 0.05 * (1 - k);
      o.headPitch = 0.16 * (1 - k); // a little sigh
      o.armLRoll = o.armRRoll = 0.12;
      o.squash = -0.04 * (1 - k);
    }
  },

  // The short version, for when they've already complained once.
  shrug(o, t) {
    if (t < 0.3) {
      o.lean = 0.26;
      o.armLPitch = o.armRPitch = -1.35;
    } else {
      const k = Math.sin(clamp((t - 0.3) / 0.8, 0, 1) * Math.PI);
      o.armLPitch = o.armRPitch = -0.3 * k;
      o.armLRoll = o.armRRoll = 0.62 * k;
      o.headRoll = 0.22 * k;
      o.headPitch = 0.06 * k;
      o.squash = -0.02 * k;
    }
  },

  // Walking into a wall: a tiny nudge forward and back.
  bump(o, t) {
    const k = Math.sin(clamp(t / 0.45, 0, 1) * Math.PI);
    o.lean = 0.12 * k;
    o.headPitch = 0.1 * k;
    o.headRoll = Math.sin(t * 30) * 0.05 * k;
    o.squash = -0.03 * k;
  },

  // Gassho bow at the end of a room.
  bow(o, t, w, ctx) {
    const faceCam = wrapAngle(ctx.cameraYaw - w.yaw);
    const turn = smooth(clamp(t / 0.45, 0, 1));
    o.yawOffset = faceCam * turn;
    const hands = smooth(clamp((t - 0.3) / 0.35, 0, 1));
    o.armLPitch = o.armRPitch = -1.15 * hands;
    o.armLRoll = o.armRRoll = -0.42 * hands;
    const bow = t < 0.75 ? 0 : t < 1.5 ? smooth((t - 0.75) / 0.5) : 1 - smooth((t - 1.5) / 0.6);
    o.lean = 0.48 * bow;
    o.headPitch = 0.3 * bow;
  },
};
