// trail.js -- landmarks, and the daily travel formula, from the binary.
//
// Landmark list -- 17 destinations, plus Independence as index 0 to keep
// arrival logic uniform. The seventeen match the leg table at file
// 0x23D32 (docs/03), starting with "the Kansas River crossing" -- which
// the prior port omitted because it read the table's address as 0x23D86
// (that offset lands inside Fort Kearney, the third entry).
//
// Mile figures are approximate historical distances -- the binary carries
// per-leg rates rather than absolute mileposts, so this table is INFERRED
// for the miles column and CONFIRMED for the name and order.

import { rng } from './rng.js';
import {
    LEG_RATE_PLAINS,
    LEG_RATE_MOUNTAIN,
    LEG_RATE_TRANSITION_INDEX,
} from './constants.js';


// Every field read from the 37-byte leg records at DS:0x896 in
// the unpacked binary:
//   +0..+0x1B   Pascal string[N] name
//   +0x1C       byte  rate (20 plains, 12 mountains)
//   +0x1D       byte  nextIdx  -- default next landmark index
//   +0x1E       byte  altIdx   -- 0 = no fork, else the alternate destination
//   +0x1F       byte  miles to nextIdx landmark
//   +0x20       byte  fork marker (0x7D at legs 7,14 -- present but not read
//                     by any code; the fork detector uses +0x1E instead)
//   +0x21..+0x22 word  map X (against vga_MAP.png 640x400)
//   +0x23..+0x24 word  map Y
//
// Ford-type from DS:0x38 + leg*10, first word: Kansas=1 (mud),
// Big Blue=2 (overturn), Green=8 default, Snake=26 default.
//
// Fork logic (proc_02FD4 in oregon.asm):
//   if [+0x1E] != 0 -> menu "The trail divides here. 1. head for {leg[+0x1D].name}
//                                                    2. head for {leg[+0x1E].name}"
// Leg 7 (South Pass): next=9 (Green River shortcut), alt=8 (Fort Bridger detour)
// Leg 14 (Blue Mountains): next=15 (Fort Walla Walla), alt=16 (The Dalles direct)
// Both paths converge at Soda Springs (leg 8 and 9 both have next=10).
// A THIRD fork exists at leg 16 (The Dalles) in code but not in +0x1E:
// "float down the Columbia River / take the Barlow Toll Road" (proc at 0x03203).

export const LANDMARKS = [
    { id:  0, name: 'Independence',              miles:    0, image: 'vga_P0',  isFort: false, isRiver: false, isStart: true, fordType: 0, next:  1, alt: 0, mapX: 579, mapY: 149 },
    { id:  1, name: 'the Kansas River crossing', miles:  102, image: 'vga_P1',  isFort: false, isRiver: true,  fordType: 1, next:  2, alt: 0, mapX: 551, mapY: 145 },
    { id:  2, name: 'the Big Blue River crossing',miles: 185, image: 'vga_P2',  isFort: false, isRiver: true,  fordType: 2, next:  3, alt: 0, mapX: 535, mapY: 136 },
    { id:  3, name: 'Fort Kearney',              miles:  304, image: 'vga_P3',  isFort: true,  isRiver: false, fordType: 0, next:  4, alt: 0, mapX: 503, mapY: 134 },
    { id:  4, name: 'Chimney Rock',              miles:  554, image: 'vga_P4',  isFort: false, isRiver: false, fordType: 0, next:  5, alt: 0, mapX: 461, mapY: 130 },
    { id:  5, name: 'Fort Laramie',              miles:  640, image: 'vga_P5',  isFort: true,  isRiver: false, fordType: 0, next:  6, alt: 0, mapX: 414, mapY: 123 },
    { id:  6, name: 'Independence Rock',         miles:  830, image: 'vga_P6',  isFort: false, isRiver: false, fordType: 0, next:  7, alt: 0, mapX: 371, mapY: 111 },
    { id:  7, name: 'South Pass',                miles:  932, image: 'vga_P7',  isFort: false, isRiver: false, fordType: 0, next:  9, alt: 8, mapX: 338, mapY: 117 },
    { id:  8, name: 'Fort Bridger',              miles:  989, image: 'vga_P8',  isFort: true,  isRiver: false, fordType: 0, next: 10, alt: 0, mapX: 305, mapY: 136 },
    { id:  9, name: 'Green River crossing',      miles: 1151, image: 'vga_P9',  isFort: false, isRiver: true,  fordType: 8, next: 10, alt: 0, mapX: 306, mapY: 121 },
    { id: 10, name: 'Soda Springs',              miles: 1295, image: 'vga_P10', isFort: false, isRiver: false, fordType: 0, next: 11, alt: 0, mapX: 292, mapY: 116 },
    { id: 11, name: 'Fort Hall',                 miles: 1352, image: 'vga_P11', isFort: true,  isRiver: false, fordType: 0, next: 12, alt: 0, mapX: 257, mapY: 107 },
    { id: 12, name: 'the Snake River crossing',  miles: 1534, image: 'vga_P12', isFort: false, isRiver: true,  fordType: 26,next: 13, alt: 0, mapX: 212, mapY: 100 },
    { id: 13, name: 'Fort Boise',                miles: 1648, image: 'vga_P13', isFort: true,  isRiver: false, fordType: 0, next: 14, alt: 0, mapX: 194, mapY:  85 },
    { id: 14, name: 'the Blue Mountains',        miles: 1808, image: 'vga_P14', isFort: false, isRiver: false, fordType: 0, next: 15, alt:16, mapX: 165, mapY:  71 },
    { id: 15, name: 'Fort Walla Walla',          miles: 1863, image: 'vga_P15', isFort: true,  isRiver: false, fordType: 0, next: 16, alt: 0, mapX: 160, mapY:  57 },
    { id: 16, name: 'The Dalles',                miles: 1983, image: 'vga_P16', isFort: false, isRiver: false, fordType: 0, next: 17, alt: 0, mapX: 139, mapY:  62 },
    { id: 17, name: 'the Willamette Valley',     miles: 2083, image: 'vga_P17', isFort: false, isRiver: false, fordType: 0, next: 99, alt: 0, mapX: 109, mapY:  62 },
];


// Which leg the party is currently on. Leg N is the segment from
// LANDMARKS[N] to LANDMARKS[N+1]. Index 0 is Independence -> Kansas
// River crossing, so most-recently-reached landmark index == leg index.
export function currentLegIndex(gameState) {
    return gameState.currentLandmarkIndex;
}


// CONFIRMED at 0x003C5:
//     miles/day = rate x (pace + 2) / 2
// where pace is 0, 1, 2 for steady/strenuous/grueling, and rate comes
// from the current leg. Rest gives zero miles.
export function calculateMilesPerDay(gameState) {
    if (gameState.pace.id === 3 /* REST */) return 0;

    const leg = currentLegIndex(gameState);
    const rate = leg < LEG_RATE_TRANSITION_INDEX
        ? LEG_RATE_PLAINS
        : LEG_RATE_MOUNTAIN;

    const miles = (rate * (gameState.pace.id + 2)) / 2;

    // The formula is integer arithmetic in the binary. We use it as-is;
    // there is no jitter and no oxen coefficient at this stage of the
    // simulation. Oxen affect the party through the strain formula
    // (state.js), not through mileage.
    return Math.floor(miles);
}


// Next landmark, honouring any prior fork choice held on gameState.
// gameState.nextIndexOverride (optional) takes precedence over the
// default `next` field on the current landmark.
export function nextLandmark(gameState) {
    const here = LANDMARKS[gameState.currentLandmarkIndex];
    if (!here) return null;
    let idx = (gameState.nextIndexOverride != null)
        ? gameState.nextIndexOverride
        : here.next;
    if (idx == null || idx >= LANDMARKS.length) return null;
    return LANDMARKS[idx];
}

// True when the CURRENT landmark has a `.alt` fork available.
export function hasFork(gameState) {
    const here = LANDMARKS[gameState.currentLandmarkIndex];
    return !!(here && here.alt);
}

export function hasArrivedAtNextLandmark(gameState) {
    const next = nextLandmark(gameState);
    if (!next) return false;
    return gameState.totalMiles >= next.miles;
}
