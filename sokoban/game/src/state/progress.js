/**
 * @file Progress storage (`ARCHITECTURE.md` §8, `hening.progress.v1`).
 *
 * Plain JSON-serializable state plus a handful of functions that read and
 * update it. Every function that mutates takes the progress object as its
 * first argument and returns it (mutate-and-return), so callers can chain
 * `recordSolve(openRoom(progress, ...), ...)` or just ignore the return
 * value and keep using their own reference.
 *
 * `GAME-DESIGN.md` §4.1: room 1 is open at the start; solving room *n* opens
 * room *n + 1*; solving room 10/20/30/40/50 lights floor I/II/III/IV/V.
 */

const KEY = 'hening.progress.v1';

/** @returns {{open:number, solved:object, assisted:number[], floorsLit:number[], ending:boolean, lastRoom:number}} */
export function defaultProgress() {
  return { open: 1, solved: {}, assisted: [], floorsLit: [], ending: false, lastRoom: 1 };
}

/**
 * Migrates 02-era progress data (where solved records were direct {steps, pushes} without mode keys)
 * to { bebas: { steps, pushes } }, saving the original to .bak.
 */
export function migrate02(parsed, rawString) {
  let needsMigration = false;
  if (parsed && parsed.solved && typeof parsed.solved === 'object') {
    for (const key of Object.keys(parsed.solved)) {
      const rec = parsed.solved[key];
      if (rec && (rec.steps != null || rec.pushes != null) && !rec.bebas && !rec.dupa) {
        needsMigration = true;
        break;
      }
    }
  }

  if (needsMigration) {
    if (rawString != null) {
      try {
        localStorage.setItem(KEY + '.bak', rawString);
      } catch {}
    }
    const migratedSolved = {};
    for (const key of Object.keys(parsed.solved)) {
      const rec = parsed.solved[key];
      if (rec && (rec.steps != null || rec.pushes != null) && !rec.bebas && !rec.dupa) {
        migratedSolved[key] = { bebas: { steps: rec.steps, pushes: rec.pushes } };
      } else {
        migratedSolved[key] = rec;
      }
    }
    parsed.solved = migratedSolved;
  }
  return { migrated: needsMigration, data: parsed };
}

/**
 * Loads progress from storage, falling back to defaults if storage is
 * unavailable, throws, or holds something that doesn't parse.
 */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    const { migrated, data } = migrate02(parsed, raw);
    if (migrated) {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {}
    }
    return { ...defaultProgress(), ...data };
  } catch {
    return defaultProgress();
  }
}

/** Saves progress to storage. Silently no-ops if storage throws or is unavailable. */
export function save(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage disabled or full — the game keeps running from memory only.
  }
}

/**
 * Opens room `n + 1` if it isn't already open (never closes a room).
 * @param {object} progress
 * @param {number} n The room just solved.
 */
export function openRoom(progress, n) {
  if (n + 1 > progress.open) progress.open = n + 1;
  return progress;
}

/**
 * Records a solve for `room` in `mode`, keeping the best (lowest) value for
 * each of `stats`' fields independently — a new run never overwrites a
 * better existing steps, pushes or timeMs with a worse one.
 * @param {object} progress
 * @param {number} room
 * @param {'dupa'|'bebas'} mode
 * @param {{steps?:number, pushes?:number, timeMs?:number}} stats
 */
export function recordSolve(progress, room, mode, stats) {
  const key = String(room);
  if (!progress.solved[key]) progress.solved[key] = {};
  const existing = progress.solved[key][mode];
  if (!existing) {
    progress.solved[key][mode] = { ...stats };
  } else {
    const merged = { ...existing };
    for (const field of Object.keys(stats)) {
      const value = stats[field];
      if (merged[field] == null || value < merged[field]) merged[field] = value;
    }
    progress.solved[key][mode] = merged;
  }
  return progress;
}

/** Whether all 10 rooms (1-indexed within the floor) of `floor` are solved. */
export function isFloorLit(progress, floor) {
  const first = (floor - 1) * 10 + 1;
  for (let room = first; room < first + 10; room++) {
    const s = progress.solved[String(room)];
    if (!s || (!s.bebas && !s.dupa && s.steps == null)) return false;
  }
  return true;
}

/** Marks `floor` as lit (idempotent). */
export function markFloorLit(progress, floor) {
  if (!progress.floorsLit.includes(floor)) progress.floorsLit.push(floor);
  return progress;
}

// --- in-memory singleton (prompt 02-tower-glue §3) -------------------------
//
// A session has to remember progress even with storage disabled
// (`ARCHITECTURE.md` §8: "on failure the game keeps state in memory"), so
// `getProgress()` loads once and every caller shares that one object instead
// of re-reading storage each time.

let cached = null;

/** Loads progress once, then returns that same object on every later call. */
export function getProgress() {
  if (!cached) cached = load();
  return cached;
}

/** Replaces the in-memory progress object and saves it. */
export function setProgress(p) {
  cached = p;
  save(cached);
  return cached;
}

/** Saves the current in-memory progress object (a no-op if none was ever loaded). */
export function saveProgress() {
  save(getProgress());
}

/**
 * The lowest room that is open but not yet solved, or 50 once every open
 * room is solved.
 * @param {object} p
 */
export function nextRoom(p) {
  const openUpTo = Math.min(p.open, 50);
  for (let n = 1; n <= openUpTo; n++) {
    const s = p.solved[String(n)];
    if (!s || (!s.bebas && !s.dupa && s.steps == null)) return n;
  }
  return 50;
}

/** The 1-indexed floor (I..V) a room belongs to. */
export function floorOf(room) {
  return Math.ceil(room / 10);
}

/** The highest floor whose first room is open. */
export function openFloors(p) {
  return Math.ceil(Math.min(p.open, 50) / 10);
}
