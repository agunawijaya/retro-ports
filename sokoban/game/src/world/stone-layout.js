/**
 * @file The numbers and the pure math of Menara Hening, the cairn of floating
 * stones (ART-DIRECTION §13.2–§13.5, §13.12). Rendering and screens import
 * this module so the stone profile, the niches, the courtyard and the ride
 * cannot drift apart.
 *
 * Angles. Spec angles are degrees measured from the default camera's front,
 * turning the way `view.azimuth` increases. A spec angle φ is the world
 * direction (sin α, cos α) with α = π/4 + φ·π/180. So the camera at azimuth α
 * faces whatever stands at spec angle φ on a rim: φ = 0 is the near edge at
 * the default camera, φ = 180 the far edge, and nicheAzimuth(i) is the orbit
 * step that brings niche i to the front.
 *
 * Units. World distances are the game's tiles. `breathe` returns radians for
 * its two rotations; `settle` returns degrees for its turn and world units for
 * its dip. A niche's `angle` follows nicheAngle (degrees); everything called
 * `azimuth` is radians.
 */

import { clamp, easeInOutSine } from '../render/math.js';

const DEG = Math.PI / 180;
const DEFAULT_AZIMUTH = Math.PI / 4;

/** Vertical distance between one stone's top and the next (ART-DIRECTION §13.2). */
export const AXIS_STEP = 2.4;

/** The courtyard stone's shallow seat for the platform (r, depth). */
const RECESS = { r: 1.2, depth: 0.15 };

/** Profile of every non-capstone: flat top down to the rounded underside. */
const PROFILE_THICKNESS = 1.0;
/** The capstone is the same profile without an opening, and slimmer. */
const CAPSTONE_THICKNESS = 0.7;

/** One stone: its place in the stack, its numbers, and where its centre lies. */
function makeStone(spec) {
  const dir = specDirection(spec.offsetAngleDeg);
  return {
    ...spec,
    recess: spec.recess ?? null,
    centre: { x: dir.x * spec.offset, z: dir.z * spec.offset },
  };
}

/**
 * Seven stones, bottom to top: index 0 the courtyard, 1–5 Lantai I–V, 6 the
 * capstone. Radii, openings, tops and offsets are copied from §13.2; the
 * offsets are measured from the axis, never accumulated. (Openings 1.2 and
 * offsets 0.22 in 04b; raised to 1.45 / 0.42, Lantai V 1.3 / 0.3, in 05 so the
 * lean shows.)
 */
export const STONES = deepFreeze([
  makeStone({
    index: 0, name: 'Halaman', R: 5.0, opening: 0, recess: RECESS,
    topY: 0, thickness: PROFILE_THICKNESS, offset: 0, offsetAngleDeg: 0, breathScale: 1,
  }),
  makeStone({
    index: 1, name: 'Lantai I', R: 4.4, opening: 1.45,
    topY: 2.4, thickness: PROFILE_THICKNESS, offset: 0.42, offsetAngleDeg: 0, breathScale: 1,
  }),
  makeStone({
    index: 2, name: 'Lantai II', R: 4.0, opening: 1.45,
    topY: 4.8, thickness: PROFILE_THICKNESS, offset: 0.42, offsetAngleDeg: 36, breathScale: 1,
  }),
  makeStone({
    index: 3, name: 'Lantai III', R: 3.6, opening: 1.45,
    topY: 7.2, thickness: PROFILE_THICKNESS, offset: 0.42, offsetAngleDeg: 72, breathScale: 1,
  }),
  makeStone({
    index: 4, name: 'Lantai IV', R: 3.2, opening: 1.45,
    topY: 9.6, thickness: PROFILE_THICKNESS, offset: 0.42, offsetAngleDeg: 108, breathScale: 1,
  }),
  makeStone({
    index: 5, name: 'Lantai V', R: 2.8, opening: 1.3,
    topY: 12.0, thickness: PROFILE_THICKNESS, offset: 0.3, offsetAngleDeg: 144, breathScale: 1,
  }),
  makeStone({
    index: 6, name: 'Capstone', R: 1.4, opening: 0,
    topY: 14.4, thickness: CAPSTONE_THICKNESS, offset: 2.3, offsetAngleDeg: 180, breathScale: 0.5,
  }),
]);

/** One floor stone by its number: 1 → Lantai I … 5 → Lantai V. */
export function floorStone(floor) {
  const stone = STONES[floor];
  if (!stone) throw new RangeError(`No tower stone at index ${floor}`);
  return stone;
}

// --- breathing -----------------------------------------------------------------

const BREATH_PERIOD = 8; // seconds for one full bob
const BREATH_BOB = 0.025; // ± world units
const BREATH_TILT = 0.4 * DEG; // ± radians in each axis
const BREATH_PHASE = 0.7; // seconds of delay per stone

/**
 * The stone's float at time `t`: a vertical bob and a slow conical lean.
 * The two tilt components are a quarter-cycle apart, so the lean has a steady
 * ±0.4° magnitude and simply turns — a floating stone, not a wobbling plate.
 * The capstone does half as much (breathScale), and reduced motion parks it.
 * @returns {{ dy: number, tiltX: number, tiltZ: number }} rotations in radians
 */
export function breathe(index, t, reducedMotion = false) {
  const scale = floorStone(index).breathScale;
  if (reducedMotion) return { dy: 0, tiltX: 0, tiltZ: 0 };
  const omega = (Math.PI * 2) / BREATH_PERIOD;
  const wave = omega * (t + BREATH_PHASE * index);
  return {
    dy: BREATH_BOB * scale * Math.sin(wave),
    tiltX: BREATH_TILT * scale * Math.sin(wave),
    tiltZ: BREATH_TILT * scale * Math.cos(wave),
  };
}

// --- settling ------------------------------------------------------------------

const SETTLE_SECONDS = 1.6;
const SETTLE_TURN = 4; // degrees about the axis
const SETTLE_DIP = 0.03; // world units
/**
 * The largest value of sin(2πu)(1 − u)² over u ∈ [0, 1]. Dividing by it makes
 * the settle's peak exactly the spec's 4° and 3 cm instead of a shy 3.9°.
 */
const SETTLE_PEAK = 0.6100285088526917;

/**
 * How a stone reacts to the platform passing it `sinceS` seconds ago: it turns
 * and dips, then comes back with one soft overshoot, all in 1.6 s. The shape
 * starts at zero, peaks at about 0.3 s, crosses zero at 0.8 s, dips just past
 * zero, and settles with zero velocity.
 * @returns {{ turnDeg: number, dip: number }}
 */
export function settle(sinceS) {
  if (!(sinceS > 0 && sinceS < SETTLE_SECONDS)) return { turnDeg: 0, dip: 0 };
  const u = sinceS / SETTLE_SECONDS;
  const pulse = (Math.sin(Math.PI * 2 * u) * (1 - u) * (1 - u)) / SETTLE_PEAK;
  return { turnDeg: SETTLE_TURN * pulse, dip: SETTLE_DIP * pulse };
}

// --- niches --------------------------------------------------------------------

/** Ten niches per floor stone, evenly spaced around the rim. */
export const NICHE_COUNT = 10;
const NICHE_STEP = 360 / NICHE_COUNT;

/** Spec angle of niche i in degrees: 36° × i, niche 0 at the front. */
export function nicheAngle(i) {
  return NICHE_STEP * i;
}

/** The camera azimuth (radians) that faces niche i. */
export function nicheAzimuth(i) {
  return DEFAULT_AZIMUTH + nicheAngle(i) * DEG;
}

/** How far inside the stone's rim each part of a niche sits. */
const TARGET_INSET = 0.45;
const OBJECT_INSET = 0.9; // 05: from 0.95, the back stone moved out and lowered
const BACK_INSET = 1.3; // 05: from 1.35

/**
 * One niche on floor `floor`: the theme target, the theme object and the
 * curved back stone, all measured from the stone's own centre (the stone may
 * lean off the axis). `angle` is the spec angle in degrees; `azimuth` is the
 * camera orbit in radians.
 * @returns {{ target: {x:number,z:number}, object: {x:number,z:number}, back: {x:number,z:number}, angle: number, azimuth: number }}
 */
export function niche(floor, i) {
  const stone = floorStone(floor);
  if (!stone.opening) throw new RangeError(`Lantai ${floor} has no niches`);
  const angle = nicheAngle(i);
  return {
    target: atSpec(stone.centre, stone.R - TARGET_INSET, angle),
    object: atSpec(stone.centre, stone.R - OBJECT_INSET, angle),
    back: atSpec(stone.centre, stone.R - BACK_INSET, angle),
    angle,
    azimuth: nicheAzimuth(i),
  };
}

/** The centreline of the low rim caps: half of the 0.25-wide flat top ledge. */
const RIM_CAP_INSET = 0.125;

/** The ten finial positions on floor `floor`, 18° from each niche. */
export function finials(floor) {
  const stone = floorStone(floor);
  if (!stone.opening) throw new RangeError(`Lantai ${floor} has no finials`);
  return Array.from({ length: NICHE_COUNT }, (_, i) => {
    const angle = NICHE_STEP / 2 + NICHE_STEP * i;
    return { ...atSpec(stone.centre, stone.R - RIM_CAP_INSET, angle), angle };
  });
}

// --- the courtyard -------------------------------------------------------------

/**
 * The courtyard's five places (ART-DIRECTION §13.3) and the stepping stones
 * that leave it. `cells` are the occupied grid cells; `activation` is the
 * walkable cell in front of the place. The array is in the key order 1–5 used
 * by the courtyard screen (gerbang, paviliun, batu, kolam, jalan).
 *
 * The activation cells are the approved courtyard's (places.js), shifted with
 * the places' new coordinates; only Gerbang's is given explicitly in §13.3.
 */
export const COURTYARD = deepFreeze({
  size: 9,
  places: [
    {
      id: 'gerbang', name: 'Gerbang Menara',
      cells: [[5, 4]], activation: { r: 6, c: 4 },
    },
    {
      id: 'paviliun', name: 'Paviliun Taman',
      cells: [[1, 6], [1, 7], [2, 6], [2, 7]], activation: { r: 3, c: 6 },
    },
    {
      id: 'batu', name: 'Batu Catatan',
      cells: [[2, 1]], activation: { r: 3, c: 1 },
    },
    {
      id: 'kolam', name: 'Kolam',
      cells: [[6, 6], [6, 7], [7, 6], [7, 7]], activation: { r: 5, c: 6 },
    },
    {
      id: 'jalan', name: 'Jalan Setapak',
      cells: [[5, 0]], activation: { r: 5, c: 1 },
    },
  ],
  // Five free-floating stones stepping down and away from the west rim at
  // (5, 0); the first is 0.65 beyond the stone's r 5 edge, and each is smaller.
  steppingStones: Array.from({ length: 5 }, (_, i) => ({
    x: -5.65 - i * 0.82,
    z: 1 + (i % 2 === 0 ? -0.04 : 0.04),
    topY: -0.28 - i * 0.34,
    size: 0.64 - i * 0.08,
  })),
});

const HALF = (COURTYARD.size - 1) / 2; // a 9 × 9 board centred on the axis
const WALK_RADIUS = 4.2;

/** A courtyard cell in world space: the board convention for a 9 × 9 board. */
export function courtyardCell(r, c) {
  return { x: c - HALF, z: r - HALF };
}

/** The platform's seat: the centre cell and its four neighbours, in grid steps. */
const OPENING_CELLS = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];

/**
 * Whether the wanderer may stand on cell (r, c): inside the 9 × 9 grid, its
 * centre within 4.2 of the axis, and not one of the opening's five cells.
 */
export function isWalkable(r, c) {
  if (r < 0 || r >= COURTYARD.size || c < 0 || c >= COURTYARD.size) return false;
  if (OPENING_CELLS.some(([dr, dc]) => r - HALF === dr && c - HALF === dc)) return false;
  const { x, z } = courtyardCell(r, c);
  return x * x + z * z <= WALK_RADIUS * WALK_RADIUS;
}

// --- capstone and the ride -----------------------------------------------------

/** The capstone's seat at the top: 2.3 off the axis toward spec angle 180°. */
export function capstone() {
  const stone = STONES[6];
  return {
    centre: { x: stone.centre.x, z: stone.centre.z },
    topY: stone.topY,
    R: stone.R,
  };
}

/** The platform's height partway through a ride, from floor 0 to floor 6. */
export function platformY(fromFloor, toFloor, p) {
  const from = floorStone(fromFloor).topY;
  const to = floorStone(toFloor).topY;
  return from + (to - from) * easeInOutSine(clamp(p, 0, 1));
}

const SECONDS_PER_FLOOR = 3.2;

/** How long a ride takes: 3.2 s for every floor travelled, either way. */
export function rideSeconds(fromFloor, toFloor) {
  return SECONDS_PER_FLOOR * Math.abs(toFloor - fromFloor);
}

const PLATFORM_RADIUS = 0.8;

/**
 * The worst radial gap between the platform (r 0.8, on the axis) and floor
 * `floor`'s opening, given the stone's breathing at `t` and a settle that
 * began `sinceSettle` seconds ago.
 *
 * A settle turns the stone about the axis (which keeps the opening's distance
 * from the axis) and dips it vertically, so it cannot close the gap; only the
 * breathing's lean moves the opening sideways. The lean is taken at the top
 * surface, half a thickness above the stone's centre. `sinceSettle` is still
 * accepted so callers can sample breathing and settling together.
 */
export function clearance(floor, t, sinceSettle) {
  const stone = floorStone(floor);
  if (!stone.opening) return Infinity;
  const { tiltX, tiltZ } = breathe(floor, t, false);
  const lateral = Math.sin(Math.hypot(tiltX, tiltZ)) * (stone.thickness / 2);
  return stone.opening - stone.offset - lateral - PLATFORM_RADIUS;
}

// --- helpers -------------------------------------------------------------------

/** The world direction (sin α, cos α) of a spec angle in degrees. */
function specDirection(angleDeg) {
  const a = DEFAULT_AZIMUTH + angleDeg * DEG;
  return { x: Math.sin(a), z: Math.cos(a) };
}

/** A point `radius` from `centre` toward a spec angle. */
function atSpec(centre, radius, angleDeg) {
  const dir = specDirection(angleDeg);
  return { x: centre.x + dir.x * radius, z: centre.z + dir.z * radius };
}

/** Freezes a tree of plain objects and arrays; the tables here never change. */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
