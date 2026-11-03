/**
 * @file Unit tests for theme registry, musical scales, and theme logic (ARCHITECTURE §7.2, prompt 04).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getTheme,
  themeIds,
  notesFor,
  PENTATONIC,
  SLENDRO,
  SLENDRO_RATIOS,
  D4,
} from '../src/themes/index.js';
import { waterLevelFor } from '../src/themes/mata-air.js';

let hadDocument = false;

beforeAll(() => {
  if (typeof globalThis.document === 'undefined') {
    hadDocument = false;
    globalThis.document = {
      createElement: () => ({
        width: 128,
        height: 128,
        getContext: () => ({
          createRadialGradient: () => ({ addColorStop: () => {} }),
          fillRect: () => {},
          beginPath: () => {},
          arc: () => {},
          fill: () => {},
        }),
      }),
    };
  } else {
    hadDocument = true;
  }
});

afterAll(() => {
  if (!hadDocument) {
    delete globalThis.document;
  }
});

describe('theme registry', () => {
  it('registers all five canonical themes', () => {
    const ids = themeIds();
    expect(ids).toEqual(['lentera', 'bintang', 'batu', 'candi', 'mata-air']);
  });

  it('falls back to Lentera for undefined or unknown theme IDs', () => {
    const fallbackDefault = getTheme();
    expect(fallbackDefault.id).toBe('lentera');

    const fallbackUnknown = getTheme('unknown-theme');
    expect(fallbackUnknown.id).toBe('lentera');
  });

  it('provides every required interface field on every registered theme', () => {
    for (const id of themeIds()) {
      const theme = getTheme(id);
      expect(theme, `Theme ${id} should exist`).toBeDefined();

      // String identifiers and UI labels (GAME-DESIGN §6)
      expect(typeof theme.id, `${id}.id`).toBe('string');
      expect(typeof theme.name, `${id}.name`).toBe('string');
      expect(typeof theme.counterLabel, `${id}.counterLabel`).toBe('string');
      expect(typeof theme.solvedLine, `${id}.solvedLine`).toBe('string');

      // Musical scale
      expect(Array.isArray(theme.scale), `${id}.scale should be an array`).toBe(true);
      expect(theme.scale.length, `${id}.scale length should be >= 5`).toBeGreaterThanOrEqual(5);
      for (const freq of theme.scale) {
        expect(typeof freq).toBe('number');
        expect(freq).toBeGreaterThan(0);
      }

      // Instancing parts & target parts
      expect(Array.isArray(theme.parts), `${id}.parts should be an array`).toBe(true);
      expect(theme.parts.length, `${id}.parts should not be empty`).toBeGreaterThan(0);
      for (const part of theme.parts) {
        expect(part.geometry, `${id} part geometry`).toBeDefined();
      }

      expect(Array.isArray(theme.targetParts), `${id}.targetParts should be an array`).toBe(true);
      expect(theme.targetParts.length, `${id}.targetParts should not be empty`).toBeGreaterThan(0);
      for (const part of theme.targetParts) {
        expect(part.geometry, `${id} targetPart geometry`).toBeDefined();
      }

      // Factory methods for standalone alcove / preview objects
      expect(typeof theme.createObject, `${id}.createObject`).toBe('function');
      const obj = theme.createObject();
      expect(obj.group, `${id} object.group`).toBeDefined();
      expect(typeof obj.setLit, `${id} object.setLit`).toBe('function');
      expect(typeof obj.update, `${id} object.update`).toBe('function');

      expect(typeof theme.createTarget, `${id}.createTarget`).toBe('function');
      const tgt = theme.createTarget();
      expect(tgt.group, `${id} target.group`).toBeDefined();
      expect(typeof tgt.update, `${id} target.update`).toBe('function');

      // Audio synthesizer methods
      expect(theme.instrument, `${id}.instrument`).toBeDefined();
      expect(typeof theme.instrument.play, `${id}.instrument.play`).toBe('function');
      expect(typeof theme.instrument.mute, `${id}.instrument.mute`).toBe('function');
      expect(typeof theme.pushSound, `${id}.pushSound`).toBe('function');
    }
  });

  it('notesFor() returns theme scale or falls back to PENTATONIC', () => {
    const candiTheme = getTheme('candi');
    expect(notesFor(candiTheme)).toBe(SLENDRO);

    const lenteraTheme = getTheme('lentera');
    expect(notesFor(lenteraTheme)).toBe(PENTATONIC);

    expect(notesFor(null)).toBe(PENTATONIC);
    expect(notesFor(undefined)).toBe(PENTATONIC);
  });
});

describe('slendro and pentatonic scales', () => {
  it('defines D4 base frequency as 293.66 Hz', () => {
    expect(D4).toBe(293.66);
  });

  it('matches Javanese slendro ratios from ART-DIRECTION §7.4 over two octaves', () => {
    expect(SLENDRO_RATIOS).toEqual([1, 1.149, 1.320, 1.516, 1.741]);
    expect(SLENDRO.length).toBe(10);

    // Octave 1
    for (let i = 0; i < 5; i++) {
      const expected = Number((D4 * SLENDRO_RATIOS[i]).toFixed(2));
      expect(SLENDRO[i]).toBeCloseTo(expected, 2);
    }

    // Octave 2
    for (let i = 0; i < 5; i++) {
      const expected = Number((D4 * 2 * SLENDRO_RATIOS[i]).toFixed(2));
      expect(SLENDRO[i + 5]).toBeCloseTo(expected, 2);
    }
  });

  it('defines PENTATONIC scale with at least 5 frequencies', () => {
    expect(PENTATONIC.length).toBeGreaterThanOrEqual(5);
    expect(PENTATONIC[0]).toBe(D4);
  });
});

describe('Mata Air waterLevelFor calculation', () => {
  it('returns -0.25 at 0 sealed and -0.05 when all goals sealed', () => {
    expect(waterLevelFor(0, 4)).toBeCloseTo(-0.25, 4);
    expect(waterLevelFor(4, 4)).toBeCloseTo(-0.05, 4);
  });

  it('scales linearly per sealed hole (0.2 / goalCount)', () => {
    const goalCount = 4;
    expect(waterLevelFor(1, goalCount)).toBeCloseTo(-0.20, 4);
    expect(waterLevelFor(2, goalCount)).toBeCloseTo(-0.15, 4);
    expect(waterLevelFor(3, goalCount)).toBeCloseTo(-0.10, 4);
  });

  it('clamps sealed count between 0 and goalCount', () => {
    expect(waterLevelFor(-1, 5)).toBeCloseTo(-0.25, 4);
    expect(waterLevelFor(10, 5)).toBeCloseTo(-0.05, 4);
  });

  it('handles zero or invalid goalCount safely', () => {
    expect(waterLevelFor(0, 0)).toBeCloseTo(-0.05, 4);
  });
});
