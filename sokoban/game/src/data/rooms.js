/**
 * @file Loads generated rooms and solutions, falling back to a built-in practice room.
 */

// Built-in practice room: small, 2 objects, solvable
const PRACTICE_ROOM = {
  number: 1,
  floor: 1,
  file: 'PRACTICE',
  record: 0,
  rows: [
    '######',
    '#@ $.#',
    '#  $.#',
    '######',
  ],
  objects: 2,
};

let generatedRoomsData = null;
let generatedSolutionsData = null;

// Vite / Vitest static import glob
try {
  const roomMods = import.meta.glob('./rooms.generated.json', { eager: true });
  if (roomMods['./rooms.generated.json']) {
    generatedRoomsData = roomMods['./rooms.generated.json'].default || roomMods['./rooms.generated.json'];
  }
} catch {
  // Missing or not in Vite
}

try {
  const solMods = import.meta.glob('./solutions.generated.json', { eager: true });
  if (solMods['./solutions.generated.json']) {
    generatedSolutionsData = solMods['./solutions.generated.json'].default || solMods['./solutions.generated.json'];
  }
} catch {
  // Missing or not in Vite
}

// Fallback for Node.js environment
if (!generatedRoomsData && typeof process !== 'undefined' && process.versions?.node) {
  try {
    const fs = await import(/* @vite-ignore */ 'node:fs');
    const path = await import(/* @vite-ignore */ 'node:path');
    const { fileURLToPath } = await import(/* @vite-ignore */ 'node:url');
    const dir = path.dirname(fileURLToPath(import.meta.url));

    const roomsFile = path.join(dir, 'rooms.generated.json');
    if (fs.existsSync(roomsFile)) {
      generatedRoomsData = JSON.parse(fs.readFileSync(roomsFile, 'utf8'));
    }

    const solFile = path.join(dir, 'solutions.generated.json');
    if (fs.existsSync(solFile)) {
      generatedSolutionsData = JSON.parse(fs.readFileSync(solFile, 'utf8'));
    }
  } catch {
    // Keep practice room
  }
}

export const isPractice = !generatedRoomsData || !generatedRoomsData.rooms || generatedRoomsData.rooms.length === 0;

export const rooms = isPractice
  ? [PRACTICE_ROOM]
  : generatedRoomsData.rooms;

rooms.isPractice = isPractice;

export const garden = (!isPractice && generatedRoomsData.garden) ? generatedRoomsData.garden : [];

export const solutions = (generatedSolutionsData && generatedSolutionsData.solutions)
  ? generatedSolutionsData.solutions
  : {};

export default {
  rooms,
  garden,
  solutions,
  isPractice,
};
