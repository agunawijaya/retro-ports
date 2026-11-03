/**
 * @file Unit tests for the floating stones' layout (ART-DIRECTION §13.2–§13.5,
 * §13.12): the stone table, the ride's clearances, the courtyard grid, the
 * niches, and the two small motions that keep the stones alive.
 */

import { describe, it, expect } from 'vitest';
import {
  AXIS_STEP,
  STONES,
  floorStone,
  breathe,
  settle,
  NICHE_COUNT,
  nicheAngle,
  nicheAzimuth,
  niche,
  finials,
  COURTYARD,
  courtyardCell,
  isWalkable,
  capstone,
  platformY,
  rideSeconds,
  clearance,
} from '../src/world/stone-layout.js';

const DEG = Math.PI / 180;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

describe('the seven stones', () => {
  const table = [
    { name: 'Halaman', R: 5.0, opening: 0, topY: 0, offset: 0, offsetAngleDeg: 0 },
    { name: 'Lantai I', R: 4.4, opening: 1.45, topY: 2.4, offset: 0.42, offsetAngleDeg: 0 },
    { name: 'Lantai II', R: 4.0, opening: 1.45, topY: 4.8, offset: 0.42, offsetAngleDeg: 36 },
    { name: 'Lantai III', R: 3.6, opening: 1.45, topY: 7.2, offset: 0.42, offsetAngleDeg: 72 },
    { name: 'Lantai IV', R: 3.2, opening: 1.45, topY: 9.6, offset: 0.42, offsetAngleDeg: 108 },
    { name: 'Lantai V', R: 2.8, opening: 1.3, topY: 12.0, offset: 0.3, offsetAngleDeg: 144 },
    { name: 'Capstone', R: 1.4, opening: 0, topY: 14.4, offset: 2.3, offsetAngleDeg: 180 },
  ];

  it('has seven stones matching the §13.2 table', () => {
    expect(STONES).toHaveLength(7);
    table.forEach((expected, i) => {
      expect(STONES[i]).toMatchObject(expected);
      expect(STONES[i].index).toBe(i);
    });
  });

  it('puts every top on the 2.4 floor pitch', () => {
    expect(AXIS_STEP).toBe(2.4);
    STONES.forEach((stone, i) => expect(stone.topY).toBeCloseTo(i * AXIS_STEP, 10));
  });

  it('has a recess only on the courtyard and an opening only on Lantai I–V', () => {
    expect(STONES[0].recess).toEqual({ r: 1.2, depth: 0.15 });
    for (let i = 1; i < STONES.length; i++) expect(STONES[i].recess).toBeNull();
    for (let i = 1; i <= 4; i++) expect(STONES[i].opening).toBe(1.45);
    expect(STONES[5].opening).toBe(1.3);
    expect(STONES[0].opening).toBe(0);
    expect(STONES[6].opening).toBe(0);
  });

  it('uses the profile thickness, with the capstone at 0.7', () => {
    for (let i = 0; i <= 5; i++) expect(STONES[i].thickness).toBe(1.0);
    expect(STONES[6].thickness).toBe(0.7);
  });

  it('places each centre 0.42 (Lantai V 0.3, capstone 2.3) from the axis at its own angle', () => {
    for (const stone of STONES) {
      const d = Math.hypot(stone.centre.x, stone.centre.z);
      expect(d).toBeCloseTo(stone.offset, 10);
      const a = Math.PI / 4 + stone.offsetAngleDeg * DEG;
      expect(stone.centre.x).toBeCloseTo(Math.sin(a) * stone.offset, 10);
      expect(stone.centre.z).toBeCloseTo(Math.cos(a) * stone.offset, 10);
    }
  });

  it('breathes at full scale except the capstone, which is half', () => {
    for (let i = 0; i <= 5; i++) expect(STONES[i].breathScale).toBe(1);
    expect(STONES[6].breathScale).toBe(0.5);
  });

  it('is frozen all the way down', () => {
    expect(Object.isFrozen(STONES)).toBe(true);
    for (const stone of STONES) {
      expect(Object.isFrozen(stone)).toBe(true);
      expect(Object.isFrozen(stone.centre)).toBe(true);
    }
    expect(Object.isFrozen(STONES[0].recess)).toBe(true);
  });

  it('looks a stone up by floor and rejects a floor that does not exist', () => {
    expect(floorStone(1)).toBe(STONES[1]);
    expect(floorStone(5)).toBe(STONES[5]);
    expect(() => floorStone(7)).toThrow(RangeError);
    expect(() => floorStone(-1)).toThrow(RangeError);
  });
});

describe('openings clear the platform', () => {
  it('keeps a positive gap on every floor over breathing and settling', () => {
    // Two 8 s breath periods, and the whole 1.6 s settle plus a margin.
    for (let floor = 1; floor <= 5; floor++) {
      let worst = Infinity;
      for (let t = 0; t <= 16; t += 0.01) {
        for (let s = -0.2; s <= 1.8; s += 0.02) {
          worst = Math.min(worst, clearance(floor, t, s));
        }
      }
      expect(worst, `Lantai ${floor}`).toBeGreaterThan(0.05);
    }
  });

  it('leaves 1.45 − 0.42 − lean − 0.8, i.e. about 22.6 cm at rest', () => {
    const lean = Math.sin(0.4 * DEG) * (1.0 / 2);
    expect(clearance(1, 0, 0)).toBeCloseTo(1.45 - 0.42 - lean - 0.8, 12);
  });

  it('reports no opening as no constraint', () => {
    expect(clearance(0, 0, 0)).toBe(Infinity);
    expect(clearance(6, 0, 0)).toBe(Infinity);
  });
});

describe('the courtyard grid', () => {
  it('is a 9 × 9 board centred on the axis', () => {
    expect(COURTYARD.size).toBe(9);
    expect(courtyardCell(0, 0)).toEqual({ x: -4, z: -4 });
    expect(courtyardCell(4, 4)).toEqual({ x: 0, z: 0 });
    expect(courtyardCell(8, 8)).toEqual({ x: 4, z: 4 });
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        expect(courtyardCell(r, c)).toEqual({ x: c - 4, z: r - 4 });
      }
    }
  });

  it('removes the opening: the centre cell and its four neighbours', () => {
    for (const [r, c] of [[4, 4], [3, 4], [5, 4], [4, 3], [4, 5]]) {
      expect(isWalkable(r, c), `opening cell ${r},${c}`).toBe(false);
    }
    // The diagonal corners of the 3 × 3 centre are not part of the opening.
    expect(isWalkable(3, 3)).toBe(true);
    expect(isWalkable(5, 5)).toBe(true);
  });

  it('keeps every place activation cell walkable', () => {
    for (const place of COURTYARD.places) {
      const { r, c } = place.activation;
      expect(isWalkable(r, c), `${place.id} activation ${r},${c}`).toBe(true);
    }
  });

  it('counts 52 walkable cells: 57 within 4.2, minus the opening', () => {
    let count = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) if (isWalkable(r, c)) count++;
    }
    expect(count).toBe(52);
  });

  it('rejects cells outside the grid and beyond the 4.2 rim', () => {
    expect(isWalkable(-1, 4)).toBe(false);
    expect(isWalkable(9, 4)).toBe(false);
    expect(isWalkable(4, -1)).toBe(false);
    expect(isWalkable(0, 0)).toBe(false); // radius 5.657
    expect(isWalkable(0, 2)).toBe(false); // radius 4.472
    expect(isWalkable(0, 3)).toBe(true); // radius 4.123
  });

  it('holds the five places at §13.3 cells', () => {
    const byId = Object.fromEntries(COURTYARD.places.map((p) => [p.id, p]));
    expect(COURTYARD.places).toHaveLength(5);
    expect(byId.gerbang.cells).toEqual([[5, 4]]);
    expect(byId.gerbang.activation).toEqual({ r: 6, c: 4 });
    expect(byId.paviliun.cells).toEqual([[1, 6], [1, 7], [2, 6], [2, 7]]);
    expect(byId.batu.cells).toEqual([[2, 1]]);
    expect(byId.kolam.cells).toEqual([[6, 6], [6, 7], [7, 6], [7, 7]]);
    expect(byId.jalan.cells).toEqual([[5, 0]]);
  });

  it('leaves by five free-floating stones off the west rim, smaller as they go', () => {
    const steps = COURTYARD.steppingStones;
    expect(steps).toHaveLength(5);
    for (let i = 0; i < steps.length; i++) {
      // West is −x; every stone is beyond the courtyard's r 5 edge.
      expect(steps[i].x).toBeLessThan(-5);
      if (i > 0) {
        expect(steps[i].x).toBeLessThan(steps[i - 1].x);
        expect(steps[i].topY).toBeLessThan(steps[i - 1].topY);
        expect(steps[i].size).toBeLessThan(steps[i - 1].size);
        const gap = Math.hypot(steps[i].x - steps[i - 1].x, steps[i].z - steps[i - 1].z)
          - (steps[i].size + steps[i - 1].size) / 2;
        expect(gap, `gap after stone ${i}`).toBeGreaterThan(0);
      }
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(COURTYARD)).toBe(true);
    expect(Object.isFrozen(COURTYARD.places)).toBe(true);
    expect(Object.isFrozen(COURTYARD.places[0].cells)).toBe(true);
    expect(Object.isFrozen(COURTYARD.steppingStones)).toBe(true);
  });
});

describe('niches', () => {
  it('spaces ten niches 36° apart, niche 0 at the front', () => {
    expect(NICHE_COUNT).toBe(10);
    expect(nicheAngle(0)).toBe(0);
    expect(nicheAngle(3)).toBe(108);
    expect(nicheAzimuth(0)).toBeCloseTo(Math.PI / 4, 12);
    expect(nicheAzimuth(9)).toBeCloseTo(Math.PI / 4 + 9 * 36 * DEG, 12);

    for (let floor = 1; floor <= 5; floor++) {
      const stone = floorStone(floor);
      const first = niche(floor, 0);
      const dx = first.target.x - stone.centre.x;
      const dz = first.target.z - stone.centre.z;
      // The default camera sits toward +x +z, so niche 0's target is too.
      expect(dx).toBeGreaterThan(0);
      expect(dz).toBeGreaterThan(0);
      expect(dx).toBeCloseTo(dz, 10);

      const angles = [];
      for (let i = 0; i < NICHE_COUNT; i++) {
        const n = niche(floor, i);
        angles.push(n.angle);
        const expected = nicheAngle(i);
        expect(n.angle).toBe(expected);
        expect(n.azimuth).toBeCloseTo(Math.PI / 4 + expected * DEG, 12);
        expect(dist(n.target, stone.centre)).toBeCloseTo(stone.R - 0.45, 10);
        expect(dist(n.object, stone.centre)).toBeCloseTo(stone.R - 0.9, 10);
        expect(dist(n.back, stone.centre)).toBeCloseTo(stone.R - 1.3, 10);
      }
      expect(new Set(angles).size).toBe(10);
      for (let i = 1; i < angles.length; i++) expect(angles[i] - angles[i - 1]).toBeCloseTo(36, 12);
    }
  });

  it('keeps Lantai V back stones outside opening + 0.15', () => {
    const stone = floorStone(5);
    const limit = stone.opening + 0.15; // 1.45 from the stone's centre; the back stone is at 1.5
    for (let i = 0; i < NICHE_COUNT; i++) {
      expect(dist(niche(5, i).back, stone.centre)).toBeGreaterThan(limit);
    }
  });

  it('puts the ten finials 18° from the niches, on the rim caps', () => {
    for (let floor = 1; floor <= 5; floor++) {
      const stone = floorStone(floor);
      const posts = finials(floor);
      expect(posts).toHaveLength(10);
      posts.forEach((post, i) => {
        expect(post.angle).toBeCloseTo(18 + 36 * i, 12);
        const d = dist(post, stone.centre);
        expect(d).toBeCloseTo(stone.R - 0.125, 10);
        expect(d).toBeLessThan(stone.R);
      });
    }
  });

  it('has no niches or finials on the courtyard or the capstone', () => {
    expect(() => niche(0, 0)).toThrow(RangeError);
    expect(() => niche(6, 0)).toThrow(RangeError);
    expect(() => finials(0)).toThrow(RangeError);
    expect(() => finials(6)).toThrow(RangeError);
  });
});

describe('settling', () => {
  it('is zero before the pass, at 0 s, and from 1.6 s on', () => {
    expect(settle(-1)).toEqual({ turnDeg: 0, dip: 0 });
    expect(settle(-0.001)).toEqual({ turnDeg: 0, dip: 0 });
    expect(settle(0)).toEqual({ turnDeg: 0, dip: 0 });
    expect(settle(1.6)).toEqual({ turnDeg: 0, dip: 0 });
    expect(settle(1.601)).toEqual({ turnDeg: 0, dip: 0 });
    expect(settle(10)).toEqual({ turnDeg: 0, dip: 0 });
  });

  it('peaks at 4° and 0.03, with one soft overshoot, all in 1.6 s', () => {
    let maxTurn = 0;
    let maxDip = 0;
    let minTurn = 0;
    let negativeRuns = 0;
    let inNegativeRun = false;

    for (let t = 0; t <= 1.6; t += 0.001) {
      const s = settle(t);
      expect(s.dip).toBeCloseTo(s.turnDeg * (0.03 / 4), 12);
      maxTurn = Math.max(maxTurn, s.turnDeg);
      maxDip = Math.max(maxDip, s.dip);
      minTurn = Math.min(minTurn, s.turnDeg);
      if (s.turnDeg < 0 && !inNegativeRun) {
        negativeRuns++;
        inNegativeRun = true;
      }
      if (s.turnDeg >= 0) inNegativeRun = false;
    }

    expect(maxTurn).toBeCloseTo(4, 2);
    expect(maxDip).toBeCloseTo(0.03, 3);
    expect(minTurn).toBeLessThan(0); // it comes back past rest once …
    expect(negativeRuns).toBe(1); // … and only once
    expect(Math.abs(minTurn)).toBeLessThan(1); // a soft overshoot, not a bounce
  });
});

describe('breathing', () => {
  const amplitude = (index) => {
    let dy = 0;
    let tilt = 0;
    for (let t = 0; t < 8; t += 0.001) {
      const b = breathe(index, t, false);
      dy = Math.max(dy, Math.abs(b.dy));
      tilt = Math.max(tilt, Math.abs(b.tiltX), Math.abs(b.tiltZ));
    }
    return { dy, tilt };
  };

  it('is exactly still with reduced motion', () => {
    for (let i = 0; i <= 6; i++) {
      expect(breathe(i, 1.23, true)).toEqual({ dy: 0, tiltX: 0, tiltZ: 0 });
    }
  });

  it('rejects a stone that does not exist', () => {
    expect(() => breathe(7, 0, false)).toThrow(RangeError);
    expect(() => breathe(-1, 0, true)).toThrow(RangeError);
  });

  it('bobs ±0.025 and tilts ±0.4° over 8 s', () => {
    const a = amplitude(1);
    expect(a.dy).toBeCloseTo(0.025, 3);
    expect(a.tilt).toBeCloseTo(0.4 * DEG, 3);
  });

  it('gives the capstone half of a floor stone', () => {
    const floor = amplitude(1);
    const cap = amplitude(6);
    expect(cap.dy).toBeCloseTo(floor.dy / 2, 6);
    expect(cap.tilt).toBeCloseTo(floor.tilt / 2, 6);
  });

  it('delays each floor by 0.7 s × index', () => {
    for (let index = 1; index <= 5; index++) {
      for (const t of [0, 0.37, 1.9, 4.2, 7.7]) {
        const now = breathe(index, t, false);
        const shifted = breathe(0, t + 0.7 * index, false);
        expect(now.dy).toBeCloseTo(shifted.dy, 12);
        expect(now.tiltX).toBeCloseTo(shifted.tiltX, 12);
        expect(now.tiltZ).toBeCloseTo(shifted.tiltZ, 12);
      }
    }
  });

  it('repeats every 8 s', () => {
    const a = breathe(2, 1.234, false);
    const b = breathe(2, 9.234, false);
    expect(a.dy).toBeCloseTo(b.dy, 12);
    expect(a.tiltX).toBeCloseTo(b.tiltX, 12);
    expect(a.tiltZ).toBeCloseTo(b.tiltZ, 12);
  });
});

describe('the capstone and the ride', () => {
  it('puts the capstone 2.3 toward 180°, level with Lantai V + 2.4', () => {
    const cap = capstone();
    expect(cap.R).toBe(1.4);
    expect(cap.topY).toBe(14.4);
    expect(Math.hypot(cap.centre.x, cap.centre.z)).toBeCloseTo(2.3, 10);
    expect(cap.centre.x).toBeLessThan(0);
    expect(cap.centre.z).toBeLessThan(0);
    expect(cap.centre.x).toBeCloseTo(-2.3 * Math.SQRT1_2, 10);
    expect(cap.centre.z).toBeCloseTo(-2.3 * Math.SQRT1_2, 10);
    // The platform (r 0.8) stops with a 0.1 gap beside it.
    expect(Math.hypot(cap.centre.x, cap.centre.z) - cap.R - 0.8).toBeCloseTo(0.1, 10);
  });

  it('rides from top to top with easeInOutSine, clamped to the ride', () => {
    expect(platformY(0, 6, 0)).toBe(0);
    expect(platformY(0, 6, 1)).toBe(14.4);
    expect(platformY(5, 0, 0)).toBe(12);
    expect(platformY(5, 0, 1)).toBe(0);
    expect(platformY(0, 6, 0.5)).toBeCloseTo(7.2, 10);
    expect(platformY(0, 1, -1)).toBe(0);
    expect(platformY(0, 1, 2)).toBe(2.4);
    // Eased, not linear: a quarter of the time covers much less than a quarter.
    expect(platformY(0, 1, 0.25)).toBeLessThan(0.6);
    // And monotonic on the way up.
    let last = -Infinity;
    for (let p = 0; p <= 1; p += 0.01) {
      const y = platformY(1, 5, p);
      expect(y).toBeGreaterThanOrEqual(last);
      last = y;
    }
  });

  it('takes 3.2 s per floor, either direction', () => {
    expect(rideSeconds(1, 5)).toBeCloseTo(12.8, 10);
    expect(rideSeconds(5, 1)).toBeCloseTo(12.8, 10);
    expect(rideSeconds(0, 6)).toBeCloseTo(19.2, 10);
    expect(rideSeconds(3, 3)).toBe(0);
  });
});
