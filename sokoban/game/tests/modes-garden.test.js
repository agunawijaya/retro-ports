/**
 * @file Unit tests for prompt 03: Modes, Dupa clock, progress migration,
 * assisted play, garden editor validation rules, and garden store.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as progress from '../src/state/progress.js';
import * as garden from '../src/state/garden.js';
import { validateGardenLevel } from '../src/screens/garden-editor.js';

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
    removeItem() { throw new Error('storage disabled'); },
  };
}

afterEach(() => {
  delete globalThis.localStorage;
});

describe('Prompt 03: Modes & Progress', () => {
  describe('Mode records best-of per field (steps, pushes, timeMs)', () => {
    it('keeps best steps, pushes, and timeMs independently in dupa mode', () => {
      const p = progress.defaultProgress();
      // Solve 1: 50 steps, 20 pushes, 60000ms
      progress.recordSolve(p, 1, 'dupa', { steps: 50, pushes: 20, timeMs: 60000 });
      expect(p.solved['1'].dupa).toEqual({ steps: 50, pushes: 20, timeMs: 60000 });

      // Solve 2: worse steps (60), better pushes (15), worse time (70000)
      progress.recordSolve(p, 1, 'dupa', { steps: 60, pushes: 15, timeMs: 70000 });
      expect(p.solved['1'].dupa).toEqual({ steps: 50, pushes: 15, timeMs: 60000 });

      // Solve 3: better steps (40), worse pushes (25), better time (50000)
      progress.recordSolve(p, 1, 'dupa', { steps: 40, pushes: 25, timeMs: 50000 });
      expect(p.solved['1'].dupa).toEqual({ steps: 40, pushes: 15, timeMs: 50000 });
    });

    it('keeps bebas and dupa records completely separated', () => {
      const p = progress.defaultProgress();
      progress.recordSolve(p, 1, 'bebas', { steps: 30, pushes: 10 });
      progress.recordSolve(p, 1, 'dupa', { steps: 25, pushes: 12, timeMs: 45000 });

      expect(p.solved['1'].bebas).toEqual({ steps: 30, pushes: 10 });
      expect(p.solved['1'].dupa).toEqual({ steps: 25, pushes: 12, timeMs: 45000 });
    });
  });

  describe('Migration of a 02 progress object (preserving .bak)', () => {
    it('migrates unkeyed 02 records to bebas mode and stores backup in .bak', () => {
      const store = installFakeStorage();
      const old02 = {
        open: 3,
        solved: {
          '1': { steps: 12, pushes: 4 },
          '2': { steps: 45, pushes: 19 },
        },
        assisted: [],
        floorsLit: [],
        ending: false,
        lastRoom: 2,
      };
      const rawOld = JSON.stringify(old02);
      store.set('hening.progress.v1', rawOld);

      const loaded = progress.load();
      // Should have migrated records to { bebas: { ... } }
      expect(loaded.solved['1']).toEqual({ bebas: { steps: 12, pushes: 4 } });
      expect(loaded.solved['2']).toEqual({ bebas: { steps: 45, pushes: 19 } });

      // Backup .bak must contain the original raw json string
      expect(store.get('hening.progress.v1.bak')).toBe(rawOld);
    });

    it('does not touch already-migrated progress or overwrite .bak', () => {
      const store = installFakeStorage();
      const current = {
        open: 2,
        solved: {
          '1': { bebas: { steps: 10, pushes: 3 } },
        },
        assisted: [],
        floorsLit: [],
        ending: false,
        lastRoom: 1,
      };
      store.set('hening.progress.v1', JSON.stringify(current));
      store.set('hening.progress.v1.bak', 'sentinel-backup');

      const loaded = progress.load();
      expect(loaded.solved['1']).toEqual({ bebas: { steps: 10, pushes: 3 } });
      expect(store.get('hening.progress.v1.bak')).toBe('sentinel-backup');
    });
  });

  describe('Assisted play', () => {
    it('assisted sets no record in solved but opens next room', () => {
      const p = progress.defaultProgress();
      const roomNum = 5;

      // When assisted is used:
      if (!p.assisted) p.assisted = [];
      p.assisted.push(roomNum);
      progress.openRoom(p, roomNum);

      expect(p.assisted).toContain(roomNum);
      expect(p.solved[String(roomNum)]).toBeUndefined();
      expect(p.open).toBe(roomNum + 1);
    });
  });
});

describe('Prompt 03: Garden Store (state/garden.js)', () => {
  it('defaultGarden() has 50 null slots', () => {
    const g = garden.defaultGarden();
    expect(g.slots).toHaveLength(50);
    expect(g.slots.every((s) => s === null)).toBe(true);
  });

  it('round-trips through localStorage', () => {
    installFakeStorage();
    const g = garden.defaultGarden();
    g.slots[0] = { rows: ['#####', '#@$.#', '#####'], tested: true, record: { steps: 5, pushes: 2 } };
    garden.save(g);

    const loaded = garden.load();
    expect(loaded.slots[0]).toEqual(g.slots[0]);
    expect(loaded.slots[1]).toBeNull();
  });

  it('survives throwing storage / storage disabled without error', () => {
    installThrowingStorage();
    const g = garden.defaultGarden();
    g.slots[2] = { rows: ['###', '#@#', '###'], tested: false };
    expect(() => garden.save(g)).not.toThrow();

    const loaded = garden.load();
    expect(loaded.slots).toHaveLength(50);
  });
});

describe('Prompt 03: Garden Editor Validation Order', () => {
  it('1. belum ada titik awal when empty or no start position', () => {
    expect(validateGardenLevel([])).toBe('belum ada titik awal');
    expect(validateGardenLevel(['#####', '#   #', '#####'])).toBe('belum ada titik awal');
  });

  it('2. titik awal belum dikelilingi dinding when start has leak to exterior', () => {
    // Has start (@), but no wall enclosing it
    expect(validateGardenLevel([' @ '])).toBe('titik awal belum dikelilingi dinding');
    expect(validateGardenLevel(['###', '#@ ', '###'])).toBe('titik awal belum dikelilingi dinding');
  });

  it('3. jumlah objek dan target belum sama with counts when mismatched', () => {
    // 1 object ($), 2 targets (.)
    const board = [
      '######',
      '#@ $.#',
      '#   .#',
      '######',
    ];
    expect(validateGardenLevel(board)).toBe('jumlah objek dan target belum sama · 1 objek · 2 target');

    // 2 objects, 1 target
    const board2 = [
      '######',
      '#@$$.#',
      '######',
    ];
    expect(validateGardenLevel(board2)).toBe('jumlah objek dan target belum sama · 2 objek · 1 target');
  });

  it('4. belum ada objek when start is enclosed and targets == objects == 0', () => {
    const board = [
      '#####',
      '# @ #',
      '#####',
    ];
    expect(validateGardenLevel(board)).toBe('belum ada objek');
  });

  it('None -> siap dicoba when valid and solvable shape', () => {
    const board = [
      '#####',
      '#@$.#',
      '#####',
    ];
    expect(validateGardenLevel(board)).toBe('siap dicoba');
  });
});
