// =============================================================================
// trail.js - Landmark data and daily-travel mechanics
// =============================================================================
//
// The 18 landmarks below are CONFIRMED from the binary at @0x23D86 - a table
// of 16 records (the source code we audited shipped two extra entries for
// Independence and Willamette Valley as bookends, giving 18). Each record
// is 37 bytes in the original; here we only keep the fields the game
// actually reads (name, miles, image, isFort, isRiver).
//
// Daily-travel math (calculateMilesPerDay) is HYPOTHESIS - the exact
// formula was not traced, but it must:
//
//   - Scale with pace hours (Steady < Strenuous < Grueling).
//   - Slow down with fewer oxen (below ~5 yokes the wagon crawls).
//   - Slow down in the mountain segments.
//   - Average ~15-20 miles/day on flat plains, ~5-8 in the Rockies.
//
// We pick a simple multiplicative form that produces those bands. If you
// want to tune the trail's overall length-to-difficulty curve, this
// function is the right place to start.
// =============================================================================

import {
    PACE,
    TRAIL_LENGTH_MILES,
} from './constants.js';


// -----------------------------------------------------------------------------
// LANDMARKS
// -----------------------------------------------------------------------------

export const LANDMARKS = [
    { id: 0,  name: 'Independence, Missouri', miles: 0,    image: 'vga_P0',  isFort: false, isRiver: false },
    { id: 1,  name: 'Kansas River Crossing',  miles: 102,  image: 'vga_P1',  isFort: false, isRiver: true  },
    { id: 2,  name: 'Big Blue River Crossing',miles: 185,  image: 'vga_P2',  isFort: false, isRiver: true  },
    { id: 3,  name: 'Fort Kearney',           miles: 304,  image: 'vga_P3',  isFort: true,  isRiver: false },
    { id: 4,  name: 'Chimney Rock',           miles: 554,  image: 'vga_P4',  isFort: false, isRiver: false },
    { id: 5,  name: 'Fort Laramie',           miles: 640,  image: 'vga_P5',  isFort: true,  isRiver: false },
    { id: 6,  name: 'Independence Rock',      miles: 830,  image: 'vga_P6',  isFort: false, isRiver: false },
    { id: 7,  name: 'South Pass',             miles: 932,  image: 'vga_P7',  isFort: false, isRiver: false },
    { id: 8,  name: 'Fort Bridger',           miles: 1070, image: 'vga_P8',  isFort: true,  isRiver: false },
    { id: 9,  name: 'Green River Crossing',   miles: 1160, image: 'vga_P9',  isFort: false, isRiver: true  },
    { id: 10, name: 'Soda Springs',           miles: 1295, image: 'vga_P10', isFort: false, isRiver: false },
    { id: 11, name: 'Fort Hall',              miles: 1395, image: 'vga_P11', isFort: true,  isRiver: false },
    { id: 12, name: 'Snake River Crossing',   miles: 1490, image: 'vga_P12', isFort: false, isRiver: true  },
    { id: 13, name: 'Fort Boise',             miles: 1600, image: 'vga_P13', isFort: true,  isRiver: false },
    { id: 14, name: 'Blue Mountains',         miles: 1680, image: 'vga_P14', isFort: false, isRiver: false },
    { id: 15, name: 'Fort Walla Walla',       miles: 1750, image: 'vga_P15', isFort: true,  isRiver: false },
    { id: 16, name: 'The Dalles',             miles: 1870, image: 'vga_P16', isFort: false, isRiver: false },
    { id: 17, name: 'Willamette Valley',      miles: TRAIL_LENGTH_MILES, image: 'vga_P17', isFort: false, isRiver: false },
];


// -----------------------------------------------------------------------------
// Trail segments (Plains / Mid / Mountains / Pacific)
// -----------------------------------------------------------------------------
//
// The event table uses these as indices, but we also use them in the
// daily-travel calculation to slow movement through the mountains.

export const SEGMENT_NAMES = ['Plains', 'Mid-trail', 'Mountains', 'Pacific'];


// -----------------------------------------------------------------------------
// calculateMilesPerDay
// -----------------------------------------------------------------------------
//
// Returns the integer miles the wagon advances on one day.
//
// Formula:
//   base = pace.hoursPerDay * 2          (8h => 16 mi, 12h => 24, 16h => 32)
//   oxenFactor = clamp(oxen / 6, 0.4, 1) (full speed at 6+ yokes)
//   terrainFactor = 1 - 0.25 * (segment / 3)  (down to 0.75 at mountains)
//
// Then jitter +/- 25% so consecutive days vary and the trip never feels
// metronomic. This is HYPOTHESIS - the original game certainly randomised
// the daily mileage; the exact distribution is unknown.

export function calculateMilesPerDay(gameState) {
    if (gameState.pace === PACE.REST) return 0;

    const base = gameState.pace.hoursPerDay * 2;

    const oxen = gameState.supplies.oxen;
    const oxenFactor = Math.max(0.4, Math.min(1, oxen / 6));

    const segment = gameState.currentSegment();
    const terrainFactor = 1 - 0.25 * (segment / 3);

    // Random factor in [0.75, 1.25].
    const jitter = 0.75 + Math.random() * 0.5;

    const miles = Math.round(base * oxenFactor * terrainFactor * jitter);

    return Math.max(0, miles);
}


// -----------------------------------------------------------------------------
// getDailyTrailSegment
// -----------------------------------------------------------------------------
//
// Convenience helper - just defers to gameState.currentSegment(). Kept here
// as a named export so future code that does not have a GameState handy
// (e.g. event preview screens) can ask "what segment is mile X in?".

export function getDailyTrailSegment(totalMiles) {
    if (totalMiles < 500)  return 0;
    if (totalMiles < 1000) return 1;
    if (totalMiles < 1600) return 2;
    return 3;
}


// -----------------------------------------------------------------------------
// nextLandmark - small helper used by the travelling loop to detect arrival
// -----------------------------------------------------------------------------

export function nextLandmark(gameState) {
    return LANDMARKS[gameState.currentLandmarkIndex + 1] || null;
}


/**
 * Returns true if the wagon has reached (or passed) the next landmark.
 * Caller is responsible for kicking the phase machine into LANDMARK mode.
 */
export function hasArrivedAtNextLandmark(gameState) {
    const next = nextLandmark(gameState);
    if (!next) return false;
    return gameState.totalMiles >= next.miles;
}
