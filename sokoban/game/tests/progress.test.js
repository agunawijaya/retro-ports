/**
 * @file Tests for `src/state/progress.js` (`ARCHITECTURE.md` §8).
 *
 * No jsdom is configured for this project, so plain Node has no global
 * `localStorage` — exactly the "storage unavailable" case the module must
 * survive. Tests that need storage to be *available* stub a minimal
 * in-memory `localStorage` on `globalThis` and remove it afterward.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as progress from '../src/state/progress.js';

function installFakeStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  return store;
}

function installThrowingStorage() {
  globalThis.localStorage = {
    getItem() { throw new Error('storage disabled'); },
    setItem() { throw new Error('storage disabled'); },
  };
}

afterEach(() => {
  delete globalThis.localStorage;
});

describe('state/progress.js', () => {
  it('defaultProgress() matches the documented shape', () => {
    expect(progress.defaultProgress()).toEqual({
      open: 1, solved: {}, assisted: [], floorsLit: [], ending: false, lastRoom: 1,
    });
  });

  it('load() returns the default when localStorage is unavailable (no global at all)', () => {
    expect(typeof localStorage).toBe('undefined');
    expect(progress.load()).toEqual(progress.defaultProgress());
  });

  it('save() silently no-ops when localStorage is unavailable', () => {
    expect(() => progress.save(progress.defaultProgress())).not.toThrow();
  });

  it('load() returns the default when localStorage throws', () => {
    installThrowingStorage();
    expect(progress.load()).toEqual(progress.defaultProgress());
  });

  it('save() silently no-ops when localStorage throws', () => {
    installThrowingStorage();
    expect(() => progress.save({ open: 2 })).not.toThrow();
  });

  it('round-trips through a working localStorage', () => {
    installFakeStorage();
    const p = progress.defaultProgress();
    progress.openRoom(p, 1);
    progress.save(p);
    expect(progress.load()).toEqual(p);
  });

  it('load() falls back to defaults for corrupt JSON', () => {
    const store = installFakeStorage();
    store.set('hening.progress.v1', '{not json');
    expect(progress.load()).toEqual(progress.defaultProgress());
  });

  describe('openRoom', () => {
    it('opens n + 1 when it is past the current open room', () => {
      const p = progress.defaultProgress();
      progress.openRoom(p, 1);
      expect(p.open).toBe(2);
    });

    it('never closes a room already open', () => {
      const p = progress.defaultProgress();
      p.open = 10;
      progress.openRoom(p, 2); // solving room 2 again should not drop open back to 3
      expect(p.open).toBe(10);
    });
  });

  describe('recordSolve', () => {
    it('stores a first solve as-is', () => {
      const p = progress.defaultProgress();
      progress.recordSolve(p, 5, 'bebas', { steps: 20, pushes: 10 });
      expect(p.solved['5'].bebas).toEqual({ steps: 20, pushes: 10 });
    });

    it('keeps the better value per field independently, never overwriting with worse', () => {
      const p = progress.defaultProgress();
      progress.recordSolve(p, 5, 'bebas', { steps: 20, pushes: 10 });
      // Worse steps (30 > 20), better pushes (5 < 10): each field keeps its own best.
      progress.recordSolve(p, 5, 'bebas', { steps: 30, pushes: 5 });
      expect(p.solved['5'].bebas).toEqual({ steps: 20, pushes: 5 });
    });

    it('keeps dupa and bebas records independent for the same room', () => {
      const p = progress.defaultProgress();
      progress.recordSolve(p, 5, 'bebas', { steps: 20, pushes: 10 });
      progress.recordSolve(p, 5, 'dupa', { steps: 15, pushes: 8, timeMs: 12000 });
      expect(p.solved['5'].bebas).toEqual({ steps: 20, pushes: 10 });
      expect(p.solved['5'].dupa).toEqual({ steps: 15, pushes: 8, timeMs: 12000 });
    });

    it('tracks timeMs the same way, independently of steps/pushes', () => {
      const p = progress.defaultProgress();
      progress.recordSolve(p, 1, 'dupa', { steps: 10, pushes: 4, timeMs: 9000 });
      progress.recordSolve(p, 1, 'dupa', { steps: 8, pushes: 6, timeMs: 15000 });
      expect(p.solved['1'].dupa).toEqual({ steps: 8, pushes: 4, timeMs: 9000 });
    });
  });

  describe('isFloorLit / markFloorLit', () => {
    it('is false until all 10 rooms of the floor are solved', () => {
      const p = progress.defaultProgress();
      for (let n = 1; n <= 9; n++) progress.recordSolve(p, n, 'bebas', { steps: 1, pushes: 1 });
      expect(progress.isFloorLit(p, 1)).toBe(false);
      progress.recordSolve(p, 10, 'bebas', { steps: 1, pushes: 1 });
      expect(progress.isFloorLit(p, 1)).toBe(true);
    });

    it('checks the right 10-room range for a later floor', () => {
      const p = progress.defaultProgress();
      for (let n = 11; n <= 20; n++) progress.recordSolve(p, n, 'bebas', { steps: 1, pushes: 1 });
      expect(progress.isFloorLit(p, 2)).toBe(true);
      expect(progress.isFloorLit(p, 1)).toBe(false);
      expect(progress.isFloorLit(p, 3)).toBe(false);
    });

    it('markFloorLit is idempotent', () => {
      const p = progress.defaultProgress();
      progress.markFloorLit(p, 1);
      progress.markFloorLit(p, 1);
      expect(p.floorsLit).toEqual([1]);
    });
  });

  describe('getProgress / setProgress / saveProgress (prompt 02-tower-glue §3)', () => {
    it('getProgress() loads once and returns that same object on every later call', () => {
      const a = progress.getProgress();
      const b = progress.getProgress();
      expect(a).toBe(b);
    });

    it('setProgress() replaces the in-memory object and saves it', () => {
      installFakeStorage();
      const p = { ...progress.defaultProgress(), open: 9 };
      progress.setProgress(p);
      expect(progress.getProgress()).toBe(p);
      expect(progress.load()).toEqual(p);
    });

    it('saveProgress() saves whatever the in-memory object currently holds', () => {
      const store = installFakeStorage();
      const p = progress.getProgress();
      p.open = 7;
      progress.saveProgress();
      expect(JSON.parse(store.get('hening.progress.v1')).open).toBe(7);
    });
  });

  describe('nextRoom', () => {
    it('is the lowest open-but-unsolved room', () => {
      const p = progress.defaultProgress();
      p.open = 5;
      progress.recordSolve(p, 1, 'bebas', { steps: 1, pushes: 1 });
      progress.recordSolve(p, 2, 'bebas', { steps: 1, pushes: 1 });
      expect(progress.nextRoom(p)).toBe(3);
    });

    it('is 50 once every open room up to `open` is solved', () => {
      const p = progress.defaultProgress(); // open: 1
      progress.recordSolve(p, 1, 'bebas', { steps: 1, pushes: 1 }); // the only open room, now solved
      expect(progress.nextRoom(p)).toBe(50);
    });

    it('never looks past room 50', () => {
      const p = progress.defaultProgress();
      p.open = 999;
      expect(progress.nextRoom(p)).toBe(1); // room 1 is open and unsolved regardless of how high `open` climbed
    });
  });

  describe('floorOf / openFloors', () => {
    it('floorOf maps a room to its 1-indexed floor', () => {
      expect(progress.floorOf(1)).toBe(1);
      expect(progress.floorOf(10)).toBe(1);
      expect(progress.floorOf(11)).toBe(2);
      expect(progress.floorOf(50)).toBe(5);
    });

    it('openFloors is the highest floor whose first room is open', () => {
      const p = progress.defaultProgress();
      p.open = 23;
      expect(progress.openFloors(p)).toBe(3);
    });

    it('openFloors caps at room 50', () => {
      const p = progress.defaultProgress();
      p.open = 999;
      expect(progress.openFloors(p)).toBe(5);
    });
  });
});
