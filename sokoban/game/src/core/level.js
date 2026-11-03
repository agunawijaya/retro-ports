/**
 * @file Core level parser, board helpers, and level validation for Hening.
 */

// Grid delta for [dr, dc]
export const DIRS = [
  [-1, 0], // up
  [1, 0],  // down
  [0, -1], // left
  [0, 1],  // right
];

export const DIR_NAMES = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

export const DIR_TO_NAME = {
  '-1,0': 'up',
  '1,0': 'down',
  '0,-1': 'left',
  '0,1': 'right',
};

/**
 * Trims blank rows and columns around the room rows and trims trailing spaces.
 * @param {string[]} lines
 * @returns {string[]}
 */
export function trimRows(lines) {
  if (!lines || lines.length === 0) return [];

  // Remove empty lines at start and end
  let firstRow = 0;
  while (firstRow < lines.length && lines[firstRow].trim().length === 0) {
    firstRow++;
  }
  let lastRow = lines.length - 1;
  while (lastRow >= firstRow && lines[lastRow].trim().length === 0) {
    lastRow--;
  }
  if (firstRow > lastRow) return [];

  const slice = lines.slice(firstRow, lastRow + 1);

  // Find min leading column with non-space character
  let minCol = Infinity;
  for (const row of slice) {
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== ' ') {
        if (c < minCol) minCol = c;
        break;
      }
    }
  }
  if (!isFinite(minCol)) minCol = 0;

  return slice.map((row) => {
    const s = row.slice(minCol);
    return s.trimEnd();
  });
}

/**
 * Parses raw room lines into a Level object.
 * @param {string[]} rows
 * @returns {object} Level
 */
export function parseLevel(rows) {
  const trimmed = trimRows(rows);
  const rowCount = trimmed.length;
  const colCount = rowCount > 0 ? Math.max(...trimmed.map((l) => l.length)) : 0;
  const raw = trimmed.map((l) => l.padEnd(colCount, ' ').split(''));

  const wall = raw.map((row) => row.map((ch) => ch === '#'));
  let start = null;
  const targets = [];
  const objects = [];

  raw.forEach((row, r) => {
    row.forEach((ch, c) => {
      if (ch === '@' || ch === '+') {
        start = { r, c };
      }
      if (ch === '.' || ch === '*' || ch === '+') {
        targets.push({ r, c, index: targets.length });
      }
      if (ch === '$' || ch === '*') {
        objects.push({ r, c });
      }
    });
  });

  // Sort targets in stable reading order (row by row, left to right) and assign stable index
  targets.sort((a, b) => (a.r === b.r ? a.c - b.c : a.r - b.r));
  targets.forEach((t, i) => {
    t.index = i;
  });

  // Inside flood fill from the start through non-wall cells
  const inside = raw.map((row) => row.map(() => false));
  let isEnclosed = true;

  if (start) {
    const stack = [{ r: start.r, c: start.c }];
    while (stack.length > 0) {
      const { r, c } = stack.pop();
      if (r < 0 || c < 0 || r >= rowCount || c >= colCount) {
        // Leaked out of bounds
        isEnclosed = false;
        continue;
      }
      if (inside[r][c] || wall[r][c]) continue;

      // If cell is on the perimeter of the bounding box and not a wall, it leaked
      if (r === 0 || c === 0 || r === rowCount - 1 || c === colCount - 1) {
        isEnclosed = false;
      }

      inside[r][c] = true;
      for (const [dr, dc] of DIRS) {
        stack.push({ r: r + dr, c: c + dc });
      }
    }
  } else {
    isEnclosed = false;
  }

  return {
    rows: rowCount,
    cols: colCount,
    raw,
    wall,
    inside,
    targets,
    objects,
    start,
    isEnclosed,
  };
}

/**
 * Validates a level according to Sokoban and Hening rules.
 * Indonesian messages for editor feedback.
 * @param {object} level
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function validateLevel(level) {
  const problems = [];

  if (!level.start) {
    problems.push('posisi awal belum ditentukan');
  }

  if (level.start && !level.isEnclosed) {
    problems.push('posisi awal tidak tertutup dinding');
  }

  if (level.objects.length === 0 && level.targets.length === 0) {
    problems.push('belum ada objek dan target');
  } else if (level.objects.length !== level.targets.length) {
    problems.push('jumlah objek dan target belum sama');
  }

  // Check that all objects and targets are inside the playable area
  for (const obj of level.objects) {
    if (!level.inside[obj.r]?.[obj.c]) {
      problems.push(`objek di (${obj.r}, ${obj.c}) berada di luar ruangan`);
      break;
    }
  }
  for (const tgt of level.targets) {
    if (!level.inside[tgt.r]?.[tgt.c]) {
      problems.push(`target di (${tgt.r}, ${tgt.c}) berada di luar ruangan`);
      break;
    }
  }

  return {
    ok: problems.length === 0,
    problems,
  };
}
