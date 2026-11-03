/**
 * @file Taman Sendiri storage (`ARCHITECTURE.md` §8, `hening.garden.v1`).
 *
 * 50 user garden slots: each slot is either null or
 * { rows: string[], name?: string, tested: boolean, record?: { steps: number, pushes: number } }
 * Works with storage disabled: keeps state in memory so a session remembers
 * and a reload forgets.
 */

const KEY = 'hening.garden.v1';
const TOTAL_SLOTS = 50;

/** @returns {{ slots: (object|null)[] }} */
export function defaultGarden() {
  const slots = new Array(TOTAL_SLOTS).fill(null);
  return { slots };
}

/**
 * Loads garden data from localStorage.
 */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultGarden();
    const parsed = JSON.parse(raw);
    const slots = new Array(TOTAL_SLOTS).fill(null);
    if (parsed && Array.isArray(parsed.slots)) {
      for (let i = 0; i < TOTAL_SLOTS; i++) {
        slots[i] = parsed.slots[i] ?? null;
      }
    }
    return { slots };
  } catch {
    return defaultGarden();
  }
}

/**
 * Saves garden data to localStorage. Silently no-ops if storage throws.
 */
export function save(garden) {
  try {
    localStorage.setItem(KEY, JSON.stringify(garden));
  } catch {
    // Storage disabled or quota exceeded
  }
}

// In-memory singleton
let cached = null;

export function getGarden() {
  if (!cached) cached = load();
  return cached;
}

export function setGarden(g) {
  cached = g;
  save(cached);
  return cached;
}

export function saveGarden() {
  save(getGarden());
}

/**
 * Gets a slot (0..49).
 */
export function getSlot(slotIndex) {
  const g = getGarden();
  return g.slots[slotIndex] ?? null;
}

/**
 * Updates a slot (0..49).
 */
export function updateSlot(slotIndex, data) {
  const g = getGarden();
  g.slots[slotIndex] = data ? { ...data } : null;
  saveGarden();
  return g.slots[slotIndex];
}

/**
 * Clears a slot (0..49).
 */
export function clearSlot(slotIndex) {
  const g = getGarden();
  g.slots[slotIndex] = null;
  saveGarden();
}

/**
 * Copies a slot from one index to another.
 */
export function copySlot(fromIndex, toIndex) {
  const g = getGarden();
  const source = g.slots[fromIndex];
  if (!source) return null;
  const copy = JSON.parse(JSON.stringify(source));
  g.slots[toIndex] = copy;
  saveGarden();
  return copy;
}

/**
 * Records a solve for a garden slot, marking it tested and updating best record.
 */
export function recordGardenSolve(slotIndex, stats) {
  const g = getGarden();
  const slot = g.slots[slotIndex];
  if (!slot) return null;
  slot.tested = true;
  if (!slot.record) {
    slot.record = { steps: stats.steps, pushes: stats.pushes };
  } else {
    slot.record = {
      steps: Math.min(slot.record.steps, stats.steps),
      pushes: Math.min(slot.record.pushes, stats.pushes),
    };
  }
  saveGarden();
  return slot;
}
