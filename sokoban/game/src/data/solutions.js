/**
 * @file Loads precomputed and manual room solutions.
 * Reads solutions.generated.json first, then solutions.manual.json.
 */

let generatedData = null;
let manualData = null;

try {
  const genMods = import.meta.glob('./solutions.generated.json', { eager: true });
  if (genMods['./solutions.generated.json']) {
    generatedData = genMods['./solutions.generated.json'].default || genMods['./solutions.generated.json'];
  }
} catch {
  // Not in Vite
}

try {
  const manMods = import.meta.glob('./solutions.manual.json', { eager: true });
  if (manMods['./solutions.manual.json']) {
    manualData = manMods['./solutions.manual.json'].default || manMods['./solutions.manual.json'];
  }
} catch {
  // Not in Vite
}

// Fallback for Node.js / Vitest environment
if ((!generatedData || !manualData) && typeof process !== 'undefined' && process.versions?.node) {
  try {
    const fs = await import(/* @vite-ignore */ 'node:fs');
    const path = await import(/* @vite-ignore */ 'node:path');
    const { fileURLToPath } = await import(/* @vite-ignore */ 'node:url');
    const dir = path.dirname(fileURLToPath(import.meta.url));

    if (!generatedData) {
      const genFile = path.join(dir, 'solutions.generated.json');
      if (fs.existsSync(genFile)) {
        generatedData = JSON.parse(fs.readFileSync(genFile, 'utf8'));
      }
    }
    if (!manualData) {
      const manFile = path.join(dir, 'solutions.manual.json');
      if (fs.existsSync(manFile)) {
        manualData = JSON.parse(fs.readFileSync(manFile, 'utf8'));
      }
    }
  } catch {
    // Files unavailable
  }
}

/**
 * Returns the solution for a room, checking generated solutions then manual ones.
 * @param {number|string} room
 * @returns {{ lurd: string, steps: number, pushes: number, weight?: number|string, ms?: number, source?: string } | null}
 */
export function getSolution(room) {
  const key = String(room);
  const gen = generatedData?.solutions?.[key];
  if (gen && gen.lurd) return gen;

  const man = manualData?.solutions?.[key];
  if (man && man.lurd) return man;

  return null;
}
