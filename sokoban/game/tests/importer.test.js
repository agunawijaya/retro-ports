import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLevel, trimRows } from '../src/core/level.js';
import { runImport } from '../tools/import-rooms.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('importer.js', () => {
  it('decodes a synthetic 612-byte buffer with both object codes and start on target', () => {
    const buf = Buffer.alloc(612, 0);

    // --- Record 0 (offset 0..305) ---
    // Start at row 1, col 1: index = 1 * 19 + 1 = 20
    buf.writeUInt16LE(20, 0);

    // Build a tiny room:
    // Row 0: #####
    // Row 1: #+ $.# (start at (1,1) on target 0x03 -> '+', object code 0x02 at (1,3))
    // Row 2: #####
    for (let c = 0; c < 5; c++) {
      buf[2 + 0 * 19 + c] = 0x01; // wall
      buf[2 + 2 * 19 + c] = 0x01; // wall
    }
    buf[2 + 1 * 19 + 0] = 0x01; // wall
    buf[2 + 1 * 19 + 1] = 0x03; // target (start position -> '+')
    buf[2 + 1 * 19 + 2] = 0x00; // floor
    buf[2 + 1 * 19 + 3] = 0x02; // object code 0x02
    buf[2 + 1 * 19 + 4] = 0x01; // wall

    // --- Record 1 (offset 306..611) ---
    // Start at row 1, col 1: index = 1 * 19 + 1 = 20
    buf.writeUInt16LE(20, 306);
    // Build tiny room with object code 0x14:
    // Row 0: #####
    // Row 1: #@ $.# (start at (1,1) on floor 0x00 -> '@', object code 0x14 at (1,2), target at (1,3))
    // Row 2: #####
    for (let c = 0; c < 5; c++) {
      buf[306 + 2 + 0 * 19 + c] = 0x01; // wall
      buf[306 + 2 + 2 * 19 + c] = 0x01; // wall
    }
    buf[306 + 2 + 1 * 19 + 0] = 0x01; // wall
    buf[306 + 2 + 1 * 19 + 1] = 0x00; // floor (start -> '@')
    buf[306 + 2 + 1 * 19 + 2] = 0x14; // object code 0x14
    buf[306 + 2 + 1 * 19 + 3] = 0x03; // target '.'
    buf[306 + 2 + 1 * 19 + 4] = 0x01; // wall

    // Decode record 0
    function decodeTestRecord(buffer, offset) {
      const startPos = buffer.readUInt16LE(offset);
      const startR = Math.floor(startPos / 19);
      const startC = startPos % 19;
      const rows = [];
      for (let r = 0; r < 16; r++) {
        let line = '';
        for (let c = 0; c < 19; c++) {
          const b = buffer[offset + 2 + r * 19 + c];
          let ch = ' ';
          if (b === 0x01) ch = '#';
          else if (b === 0x02 || b === 0x14) ch = '$';
          else if (b === 0x03) ch = '.';
          else if (b === 0x04 || b === 0x17 || b === 0x23) ch = '*';

          if (r === startR && c === startC) {
            ch = (ch === '.' || ch === '*') ? '+' : '@';
          }
          line += ch;
        }
        rows.push(line);
      }
      return trimRows(rows);
    }

    const rec0Rows = decodeTestRecord(buf, 0);
    expect(rec0Rows).toEqual([
      '#####',
      '#+ $#',
      '#####',
    ]);
    const level0 = parseLevel(rec0Rows);
    expect(level0.start).toEqual({ r: 1, c: 1 });
    expect(level0.targets[0]).toMatchObject({ r: 1, c: 1 });

    const rec1Rows = decodeTestRecord(buf, 306);
    expect(rec1Rows).toEqual([
      '#####',
      '#@$.#',
      '#####',
    ]);
    const level1 = parseLevel(rec1Rows);
    expect(level1.start).toEqual({ r: 1, c: 1 });
    expect(level1.objects).toEqual([{ r: 1, c: 2 }]);
    expect(level1.targets[0]).toMatchObject({ r: 1, c: 3 });
  });

  it('imports the real original files and verifies 50 rooms with objects = targets', async () => {
    const originalDir = path.resolve(__dirname, '../../original/sokoban');
    if (!fs.existsSync(originalDir)) {
      console.log('original/ absent, skipping real file test.');
      return;
    }

    const res = await runImport(['--source', originalDir]);
    expect(res.ok).toBe(true);
    expect(res.roomCount).toBe(50);

    const generatedPath = path.resolve(__dirname, '../src/data/rooms.generated.json');
    const data = JSON.parse(fs.readFileSync(generatedPath, 'utf8'));
    expect(data.rooms).toHaveLength(50);

    for (const room of data.rooms) {
      const level = parseLevel(room.rows);
      expect(level.objects.length).toBeGreaterThan(0);
      expect(level.objects.length).toBe(level.targets.length);
      expect(room.objects).toBe(level.objects.length);
    }
  });
});
