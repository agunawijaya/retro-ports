/**
 * @file Importer for 1984 Sokoban binary room files into rooms.generated.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLevel, validateLevel, trimRows } from '../src/core/level.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The authoritative list of room files in order
const ROOM_FILES = [
  'TABL012', 'TABL034', 'TABLE56', 'TABLE78', 'TABL910',
  'TAB1112', 'TAB1314', 'TAB1516', 'TAB1718', 'TAB1920',
  'TAB2122', 'TAB2324', 'TAB2526', 'TAB2728', 'TAB2930',
  'TAB3132', 'TAB3334', 'TAB3536', 'TAB3738', 'TAB3940',
  'TAB4142', 'TAB4344', 'TAB4546', 'TAB4748', 'TAB4950',
];

// Original Sokoban level 42, as shipped on DOS through 1987-Nov-16 (file
// TAB4142, which is what original/sokoban/ holds) and on C64, is unsolvable:
// one box sits one cell off from its correct starting square. Several
// secondary sources describe this as "the box in D9 should be in C9"
// (sokoban-jd.blogspot.com's "The Original collection", a sokoban@groups.io
// thread) — that description turned out to use a coordinate convention that
// does not match a one-column shift here, and cost a wasted round of
// solver attempts (2026-10-30) before being caught. The correction actually
// used is verified directly against the primary source instead: XSokoban's
// own level file, `screens/screen.42` in Andrew Myers' xsokoban repository
// (github.com/andrewcmyers/xsokoban, the game's original author) — diffed
// column-by-column against our as-shipped room 42, it differs in exactly one
// cell: the box one row up from where TAB4142 puts it, same column. Fixed in
// DOS releases from 1987-Dec-22 and in XSokoban 3.0 (1993-Dec-18), which also
// touches levels 12, 20, 25, 37, 50 the same way — only 42 is corrected here,
// by the owner's decision (2026-10-30), after it was the one room our solver
// and three outside models (Codex, Gemini, DeepSeek) all failed on while the
// other 49 solved.
const KNOWN_FIXES = {
  42: {
    fromRow: 8,
    toRow: 7,
    col: 3,
    note: 'box moved up one row (col 3), matching XSokoban screens/screen.42 exactly',
  },
};

const EDITOR_FILES = [
  'EDT5152', 'EDT5354', 'EDT5556', 'EDT5758', 'EDT5960',
  'EDT6162', 'EDT6364', 'EDT6566', 'EDT6768', 'EDT6970',
  'EDT7172', 'EDT7374', 'EDT7576', 'EDT7778', 'EDT7980',
  'EDT8182', 'EDT8384', 'EDT8586', 'EDT8788', 'EDT8990',
  'EDT9192', 'EDT9394', 'EDT9596', 'EDT9798', 'ED99100',
];

/**
 * Parses arguments and runs the import process.
 */
export async function runImport(args = process.argv.slice(2)) {
  let sourceDir = null;
  let ifMissing = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) {
      sourceDir = args[i + 1];
      i++;
    } else if (args[i] === '--if-missing') {
      ifMissing = true;
    }
  }

  const outputPath = path.resolve(__dirname, '../src/data/rooms.generated.json');

  if (ifMissing && fs.existsSync(outputPath)) {
    console.log('rooms.generated.json already exists. Skipping import (--if-missing).');
    return { skipped: true };
  }

  if (!sourceDir) {
    // Look for original/sokoban in repo root (two levels up from tools/)
    const candidate = path.resolve(__dirname, '../../original/sokoban');
    if (fs.existsSync(candidate)) {
      sourceDir = candidate;
    } else {
      console.warn(`Original rooms directory not found at ${candidate}.`);
      console.warn('To provide it, pass --source <dir>. Falling back to practice room.');
      return { ok: false, missingSource: true };
    }
  }

  console.log(`Importing original rooms from: ${sourceDir}`);

  function decodeRecord(buf, offset, fileName, recIdx) {
    const startPos = buf.readUInt16LE(offset);
    const startR = Math.floor(startPos / 19);
    const startC = startPos % 19;

    const rows = [];
    let hasWalls = false;
    let objectCount = 0;

    for (let r = 0; r < 16; r++) {
      let rowChars = [];
      for (let c = 0; c < 19; c++) {
        const byteOffset = offset + 2 + r * 19 + c;
        const b = buf[byteOffset];
        let ch = ' ';

        if (b === 0x00) {
          ch = ' ';
        } else if (b === 0x01) {
          ch = '#';
          hasWalls = true;
        } else if (b === 0x02 || b === 0x14) {
          ch = '$';
          objectCount++;
        } else if (b === 0x03) {
          ch = '.';
        } else if (b === 0x04 || b === 0x17 || b === 0x23) {
          ch = '*';
          objectCount++;
        } else {
          throw new Error(
            `Invalid byte 0x${b.toString(16).padStart(2, '0')} in file ${fileName} at offset ${byteOffset}`
          );
        }

        if (r === startR && c === startC) {
          ch = ch === '.' || ch === '*' ? '+' : '@';
        }
        rowChars.push(ch);
      }
      rows.push(rowChars.join(''));
    }

    return {
      rows,
      hasWalls,
      objectCount,
      startR,
      startC,
    };
  }

  // 1. Process 50 tower rooms
  const rooms = [];
  let roomNumber = 1;

  for (const fileName of ROOM_FILES) {
    const filePath = path.join(sourceDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required room file missing: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size !== 612) {
      throw new Error(`Room file ${fileName} must be exactly 612 bytes, found ${stat.size}`);
    }

    const buf = fs.readFileSync(filePath);

    for (let recIdx = 0; recIdx < 2; recIdx++) {
      const offset = recIdx * 306;
      const decoded = decodeRecord(buf, offset, fileName, recIdx);
      let trimmedRows = trimRows(decoded.rows);

      const fix = KNOWN_FIXES[roomNumber];
      let fixApplied = null;
      if (fix) {
        const grid = trimmedRows.map((r) => r.split(''));
        const from = grid[fix.fromRow]?.[fix.col];
        const to = grid[fix.toRow]?.[fix.col];
        if (from !== '$' || to !== ' ') {
          throw new Error(
            `Room ${roomNumber}: known fix expected a box at row ${fix.fromRow} col ${fix.col} and floor at row ${fix.toRow} col ${fix.col}, found '${from}' / '${to}'. The source no longer matches the fix — check before applying it blindly.`
          );
        }
        grid[fix.fromRow][fix.col] = ' ';
        grid[fix.toRow][fix.col] = '$';
        trimmedRows = grid.map((r) => r.join(''));
        fixApplied = fix.note;
        console.log(`Room ${roomNumber}: applied known fix (${fix.note}).`);
      }

      const level = parseLevel(trimmedRows);
      const validation = validateLevel(level);

      if (!validation.ok) {
        throw new Error(
          `Validation failed for room ${roomNumber} (${fileName} record ${recIdx}): ${validation.problems.join(', ')}`
        );
      }

      const floor = Math.floor((roomNumber - 1) / 10) + 1;
      rooms.push({
        number: roomNumber,
        floor,
        file: fileName,
        record: recIdx,
        rows: trimmedRows,
        objects: decoded.objectCount,
        ...(fixApplied ? { fixApplied } : {}),
      });

      roomNumber++;
    }
  }

  // 2. Process editor slots (51..100)
  const garden = [];
  let emptyGardenCount = 0;

  for (const fileName of EDITOR_FILES) {
    const filePath = path.join(sourceDir, fileName);
    if (!fs.existsSync(filePath)) {
      emptyGardenCount += 2;
      continue;
    }
    const stat = fs.statSync(filePath);
    if (stat.size !== 612) {
      emptyGardenCount += 2;
      continue;
    }
    const buf = fs.readFileSync(filePath);
    for (let recIdx = 0; recIdx < 2; recIdx++) {
      const offset = recIdx * 306;
      const decoded = decodeRecord(buf, offset, fileName, recIdx);
      if (!decoded.hasWalls && decoded.objectCount === 0) {
        emptyGardenCount++;
      } else {
        const trimmed = trimRows(decoded.rows);
        const level = parseLevel(trimmed);
        const valid = validateLevel(level);
        if (valid.ok) {
          garden.push({
            file: fileName,
            record: recIdx,
            rows: trimmed,
            tested: false,
          });
        } else {
          emptyGardenCount++;
        }
      }
    }
  }

  const outputData = {
    source: 'original/sokoban (1984)',
    generated: new Date().toISOString(),
    rooms,
    garden,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');

  console.log(`Successfully imported ${rooms.length} rooms.`);
  console.log(`Editor garden slots: ${garden.length} populated, ${emptyGardenCount} empty.`);

  return {
    ok: true,
    roomCount: rooms.length,
    gardenCount: garden.length,
    emptyGardenCount,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runImport().catch((err) => {
    console.error('Import error:', err);
    process.exit(1);
  });
}
