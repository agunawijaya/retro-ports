/*
 * Spyder — progress and settings, kept in localStorage.
 *
 * Saved under one key, `spyder.progress.v1`:
 *
 *   {
 *     cleared:  { [roomId]: { best, bestCombo, untouched, time } },
 *     found:    [roomId, …]          secret rooms discovered
 *     settings: { character, difficulty, volume, shake, particles, grain },
 *     lastRoom: roomId | null
 *   }
 *
 * Storage can be missing or refuse to work (private windows, blocked site
 * data, file:// in some browsers, a full quota). Every read and write is
 * wrapped, and when storage is not available the game keeps playing with
 * an in-memory copy — it simply forgets when the page closes.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const KEY = 'spyder.progress.v1';

  const DEFAULT_SETTINGS = {
    character: 'exterminator',
    difficulty: 'normal', // 'easy' | 'normal' | 'hard'
    volume: { master: 0.8, music: 0.55, sfx: 0.9 },
    shake: true,
    particles: 'normal', // 'normal' | 'reduced'
    grain: true,
  };

  function blank() {
    return { cleared: {}, found: [], unlocked: ['vacuum'], coins: 0, settings: clone(DEFAULT_SETTINGS), lastRoom: null };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // Keep what is valid in a saved object, fill the rest with defaults, so a
  // save from an older build (or a hand-edited one) never breaks the game.
  function sanitise(raw) {
    const data = blank();
    if (!raw || typeof raw !== 'object') return data;
    if (raw.cleared && typeof raw.cleared === 'object') {
      for (const [id, rec] of Object.entries(raw.cleared)) {
        if (!rec || typeof rec !== 'object') continue;
        data.cleared[id] = {
          best: Number(rec.best) || 0,
          bestCombo: Number(rec.bestCombo) || 1,
          untouched: Boolean(rec.untouched),
          time: Number(rec.time) || 0,
        };
      }
    }
    if (Array.isArray(raw.found)) data.found = raw.found.filter((id) => typeof id === 'string');
    data.unlocked = Array.isArray(raw.unlocked) ? raw.unlocked.filter((id) => typeof id === 'string') : ['vacuum'];
    if (!data.unlocked.includes('vacuum')) data.unlocked.unshift('vacuum');
    data.coins = Math.max(0, Number(raw.coins) || 0);

    // Save migration (prompt 12, L2): already cleared rooms grant unlocks on load.
    if (data.cleared['living-room'] && !data.unlocked.includes('web-cutter')) data.unlocked.push('web-cutter');
    if (data.cleared['dining-room'] && !data.unlocked.includes('foam-spray')) data.unlocked.push('foam-spray');

    if (typeof raw.lastRoom === 'string') data.lastRoom = raw.lastRoom;
    const s = raw.settings || {};
    const d = data.settings;
    if (['exterminator'].includes(s.character)) d.character = s.character;
    if (['easy', 'normal', 'hard'].includes(s.difficulty)) d.difficulty = s.difficulty;
    if (s.volume && typeof s.volume === 'object') {
      for (const k of ['master', 'music', 'sfx']) {
        const v = Number(s.volume[k]);
        if (Number.isFinite(v)) d.volume[k] = S.clamp(v, 0, 1);
      }
    }
    if (typeof s.shake === 'boolean') d.shake = s.shake;
    if (['normal', 'reduced'].includes(s.particles)) d.particles = s.particles;
    if (typeof s.grain === 'boolean') d.grain = s.grain;
    return data;
  }

  // Probe once: can we actually write? (Reading can work while writing throws.)
  function probeStorage() {
    try {
      const store = window.localStorage;
      const probe = `${KEY}.probe`;
      store.setItem(probe, '1');
      store.removeItem(probe);
      return store;
    } catch {
      return null;
    }
  }

  const store = probeStorage();
  let data = blank();

  const progress = {
    // False when the browser will not let us keep anything.
    storageAvailable: Boolean(store),

    load() {
      data = blank();
      if (!store) return data;
      try {
        const text = store.getItem(KEY);
        if (text) data = sanitise(JSON.parse(text));
      } catch {
        data = blank(); // unreadable save: start fresh rather than crash
      }
      return data;
    },

    save() {
      if (!store) return false;
      try {
        store.setItem(KEY, JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    },

    get data() {
      return data;
    },

    get settings() {
      return data.settings;
    },

    // Volumes merge (one slider at a time); everything else replaces.
    updateSettings(patch) {
      const { volume, ...rest } = patch;
      Object.assign(data.settings, rest);
      if (volume) data.settings.volume = { ...data.settings.volume, ...volume };
      this.save();
    },

    // A save is worth "Continue" once the player has entered or cleared anything.
    hasSave() {
      return Boolean(data.lastRoom) || Object.keys(data.cleared).length > 0;
    },

    isCleared(id) {
      return Boolean(data.cleared[id]);
    },

    isFound(id) {
      return data.found.includes(id);
    },

    record(id) {
      return data.cleared[id] || null;
    },

    // Keep the best of each figure across replays.
    recordClear(id, { score, bestCombo, untouched, time }) {
      const old = data.cleared[id];
      data.cleared[id] = {
        best: Math.max(old?.best ?? 0, score),
        bestCombo: Math.max(old?.bestCombo ?? 1, bestCombo),
        untouched: Boolean(old?.untouched || untouched),
        time: old?.time ? Math.min(old.time, time) : time,
      };

      // Unlocks (prompts/12-weapons.md, L2)
      let unlockedWeapon = null;
      if (id === 'living-room' && !data.unlocked.includes('web-cutter')) {
        data.unlocked.push('web-cutter');
        unlockedWeapon = 'web-cutter';
      } else if (id === 'dining-room' && !data.unlocked.includes('foam-spray')) {
        data.unlocked.push('foam-spray');
        unlockedWeapon = 'foam-spray';
      }

      this.save();
      return { isNewBest: !old || score > old.best, record: data.cleared[id], unlockedWeapon };
    },

    unlock(weaponId) {
      if (!data.unlocked.includes(weaponId)) {
        data.unlocked.push(weaponId);
        this.save();
      }
    },

    addCoins(amount) {
      data.coins = (data.coins || 0) + amount;
      this.save();
      return data.coins;
    },

    setLastRoom(id) {
      data.lastRoom = id;
      this.save();
    },

    // New game: tear up the work orders, keep the settings.
    reset() {
      const settings = data.settings;
      data = blank();
      data.settings = settings;
      this.save();
    },
  };

  S.progress = progress;
})();
