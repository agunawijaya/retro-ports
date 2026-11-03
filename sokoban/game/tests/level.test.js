import { describe, it, expect } from 'vitest';
import { parseLevel, validateLevel, trimRows } from '../src/core/level.js';

describe('level.js', () => {
  it('trims leading/trailing empty rows and common indentation', () => {
    const raw = [
      '              ',
      '    #####     ',
      '    #@ .#     ',
      '    # $ #     ',
      '    #####     ',
      '              ',
    ];
    const trimmed = trimRows(raw);
    expect(trimmed).toEqual([
      '#####',
      '#@ .#',
      '# $ #',
      '#####',
    ]);
  });

  it('parses valid XSB rows and establishes stable target indices and flood fill', () => {
    const rows = [
      '######',
      '#@  .#',
      '# $ .#',
      '######',
    ];
    const level = parseLevel(rows);

    expect(level.rows).toBe(4);
    expect(level.cols).toBe(6);
    expect(level.start).toEqual({ r: 1, c: 1 });
    expect(level.objects).toEqual([{ r: 2, c: 2 }]);
    expect(level.targets).toHaveLength(2);
    // Target 0: (1, 4), Target 1: (2, 4) in reading order
    expect(level.targets[0]).toMatchObject({ r: 1, c: 4, index: 0 });
    expect(level.targets[1]).toMatchObject({ r: 2, c: 4, index: 1 });

    // Inside flood fill
    expect(level.inside[1][1]).toBe(true);
    expect(level.inside[1][2]).toBe(true);
    expect(level.inside[0][0]).toBe(false); // Wall is not marked inside
    expect(level.isEnclosed).toBe(true);
  });

  it('validates enclosed valid room with matching objects and targets', () => {
    const rows = [
      '######',
      '#@ $.#',
      '#  $.#',
      '######',
    ];
    const level = parseLevel(rows);
    const valid = validateLevel(level);
    expect(valid.ok).toBe(true);
    expect(valid.problems).toHaveLength(0);
  });

  it('reports error when objects != targets', () => {
    const rows = [
      '######',
      '#@ $.#',
      '#   .#',
      '######',
    ];
    // 1 object, 2 targets
    const level = parseLevel(rows);
    const valid = validateLevel(level);
    expect(valid.ok).toBe(false);
    expect(valid.problems).toContain('jumlah objek dan target belum sama');
  });

  it('reports error when no start position exists', () => {
    const rows = [
      '######',
      '#  $.#',
      '#   .#',
      '######',
    ];
    const level = parseLevel(rows);
    const valid = validateLevel(level);
    expect(valid.ok).toBe(false);
    expect(valid.problems).toContain('posisi awal belum ditentukan');
  });

  it('reports error when start is not enclosed by walls', () => {
    const rows = [
      '#  $.#',
      ' @ $.#',
      '######',
    ];
    const level = parseLevel(rows);
    const valid = validateLevel(level);
    expect(valid.ok).toBe(false);
    expect(valid.problems).toContain('posisi awal tidak tertutup dinding');
  });
});
