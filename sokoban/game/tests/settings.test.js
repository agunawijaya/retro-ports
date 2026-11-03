/**
 * @file Tests for `src/state/settings.js` (`ARCHITECTURE.md` §8).
 * See `tests/progress.test.js` for why storage is faked the way it is.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import * as settings from '../src/state/settings.js';

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

describe('state/settings.js', () => {
  it('defaultSettings() matches GAME-DESIGN.md §7.10', () => {
    expect(settings.defaultSettings()).toEqual({
      theme: 'lentera',
      mode: 'bebas',
      dupaMinutes: 20,
      volume: { master: 0.8, ambience: 0.6, notes: 0.8 },
      reducedMotion: 'system',
      hints: true,
    });
  });

  it('load() returns the default when localStorage is unavailable', () => {
    expect(typeof localStorage).toBe('undefined');
    expect(settings.load()).toEqual(settings.defaultSettings());
  });

  it('save() silently no-ops when localStorage is unavailable', () => {
    expect(() => settings.save(settings.defaultSettings())).not.toThrow();
  });

  it('load() returns the default when localStorage throws', () => {
    installThrowingStorage();
    expect(settings.load()).toEqual(settings.defaultSettings());
  });

  it('save() silently no-ops when localStorage throws', () => {
    installThrowingStorage();
    expect(() => settings.save({ mode: 'dupa' })).not.toThrow();
  });

  it('round-trips through a working localStorage', () => {
    installFakeStorage();
    const s = settings.defaultSettings();
    s.mode = 'dupa';
    s.volume.master = 0.5;
    settings.save(s);
    expect(settings.load()).toEqual(s);
  });

  it('load() falls back to defaults for corrupt JSON', () => {
    const store = installFakeStorage();
    store.set('hening.settings.v1', 'not json at all');
    expect(settings.load()).toEqual(settings.defaultSettings());
  });

  it('load() fills in a missing volume sub-field from defaults', () => {
    const store = installFakeStorage();
    store.set('hening.settings.v1', JSON.stringify({ mode: 'dupa', volume: { master: 0.3 } }));
    const loaded = settings.load();
    expect(loaded.mode).toBe('dupa');
    expect(loaded.volume).toEqual({ master: 0.3, ambience: 0.6, notes: 0.8 });
    expect(loaded.theme).toBe('lentera'); // untouched fields still come from defaults
  });

  describe('getSettings / updateSettings / onSettingsChange (prompt 02-tower-glue §3)', () => {
    it('getSettings() loads once and returns that same object on every later call', () => {
      const a = settings.getSettings();
      const b = settings.getSettings();
      expect(a).toBe(b);
    });

    it('updateSettings() shallow-merges top-level fields and merges volume field by field', () => {
      installFakeStorage();
      settings.updateSettings({ mode: 'dupa', volume: { master: 0.3 } });
      const after = settings.getSettings();
      expect(after.mode).toBe('dupa');
      expect(after.volume).toEqual({ master: 0.3, ambience: 0.6, notes: 0.8 }); // ambience/notes untouched
    });

    it('updateSettings() saves to storage and notifies every subscriber', () => {
      const store = installFakeStorage();
      const fn = vi.fn();
      const unsubscribe = settings.onSettingsChange(fn);

      settings.updateSettings({ hints: false });
      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ hints: false }));
      expect(JSON.parse(store.get('hening.settings.v1')).hints).toBe(false);

      unsubscribe();
      settings.updateSettings({ hints: true });
      expect(fn).toHaveBeenCalledTimes(1); // unsubscribed: no second notification
    });
  });

  describe('reducedMotion()', () => {
    it("is true when reducedMotion is 'on'", () => {
      installFakeStorage();
      settings.updateSettings({ reducedMotion: 'on' });
      expect(settings.reducedMotion()).toBe(true);
    });

    it("is false when reducedMotion is 'off'", () => {
      installFakeStorage();
      settings.updateSettings({ reducedMotion: 'off' });
      expect(settings.reducedMotion()).toBe(false);
    });

    it("'system' is guarded: it does not throw where there is no window.matchMedia (Node)", () => {
      installFakeStorage();
      settings.updateSettings({ reducedMotion: 'system' });
      expect(() => settings.reducedMotion()).not.toThrow();
      expect(typeof settings.reducedMotion()).toBe('boolean');
    });
  });
});
