// hunting.js -- keypad input plus a field generator ported from
// tools/render-hunting.py.
//
// The prior port used mouse aim; the DOS game does not. Input is
//     keypad digit  -- aim in one of 8 directions
//     Enter         -- start / stop walking
//     Space         -- fire the rifle
//     Escape        -- stop hunting
// and even the joystick is converted to those keys before anything
// else sees them (docs/03 "the instructions screen can describe
// itself entirely in keystrokes").
//
// The field is a generator, not a picture. render-hunting.py already
// implements it in Python; this is the same logic, without the sprite
// tables (we cannot read the binary here). Scenery is chosen from a
// per-region set; animals enter from an edge; overlap is rejected via
// axis-aligned bounding boxes.

import { rng } from './rng.js';
import { ANIMALS, HUNTER_SPRITES } from './assets.js';
import {
    HUNT_FIELD_W,
    HUNT_FIELD_H,
    HUNT_SCENERY_MIN,
    HUNT_SCENERY_MAX,
    HUNT_SPAWN_RATE_PER_SLOT_PER_TURN,
    HUNT_MAX_SPAWNS_PER_SLOT,
    HUNT_SPECIES_GATES,
    HUNT_MAX_CARRY_LBS,
} from './constants.js';


// The eight keypad directions, cw from up:
//   8 = up,  9 = up-right,  6 = right,  3 = down-right,
//   2 = down, 1 = down-left, 4 = left,  7 = up-left
// The two-digit values that follow are dx, dy in pixels per movement
// tick, plus the sprite bank index the hunter faces.
export const DIRECTIONS = {
    '8': { dx:  0, dy: -2, bank: 0 },
    '9': { dx:  2, dy: -2, bank: 1 },
    '6': { dx:  2, dy:  0, bank: 2 },
    '3': { dx:  2, dy:  2, bank: 3 },
    '2': { dx:  0, dy:  2, bank: 4 },
    '1': { dx: -2, dy:  2, bank: 5 },
    '4': { dx: -2, dy:  0, bank: 6 },
    '7': { dx: -2, dy: -2, bank: 7 },
};


// Axis-aligned bounding-box overlap, same test as hunt:0x5ED0.
function overlaps(a, b) {
    return !(
        a.x + a.w <= b.x || b.x + b.w <= a.x ||
        a.y + a.h <= b.y || b.y + b.h <= a.y
    );
}


// Placement -- rejection sampling per hunt:0x6310.
// Returns an {x, y} or null if the field is full.
function placeAt(w, h, placed, maxTries = 500) {
    for (let tries = 0; tries < maxTries; tries++) {
        // hunt:0x6381: x = Random(318 - w), then even-nudge and byte-align.
        let x = rng.nextInt(318 - w);
        x += x & 1;                                   // 0x63A9
        x += x % 4;                                   // 0x63C3 -- toward a CGA byte
        const y = rng.nextInt(199 - h);
        const rect = { x, y, w, h };
        if (!placed.some((p) => overlaps(rect, p))) {
            return { x, y };
        }
    }
    return null;
}


// TERRAIN sprite table from DS:0x013A in unpacked.exe -- 16 kinds x
// (srcX, srcY, w, h) as words, stride 8. Coordinates are into
// vga_TERRAIN.png (i.e. terrain.pcc in the DOS container).
export const TERRAIN_KINDS = [
    /* 0*/ { sx:   0, sy:  0, w: 36, h: 41 },
    /* 1*/ { sx:   0, sy: 48, w: 36, h: 39 },
    /* 2*/ { sx:  92, sy: 47, w: 36, h: 40 },
    /* 3*/ { sx:  48, sy: 48, w: 32, h: 40 },
    /* 4*/ { sx:  44, sy:  1, w: 36, h: 42 },
    /* 5*/ { sx:  96, sy:  8, w: 40, h: 34 },
    /* 6*/ { sx: 208, sy:  4, w: 48, h: 13 },
    /* 7*/ { sx: 268, sy:  9, w: 44, h:  9 },
    /* 8*/ { sx: 272, sy: 54, w: 46, h: 13 },
    /* 9*/ { sx: 252, sy: 26, w: 28, h: 25 },
    /*10*/ { sx: 296, sy: 27, w: 24, h: 21 },
    /*11*/ { sx: 212, sy: 28, w: 24, h: 19 },
    /*12*/ { sx: 192, sy: 56, w: 36, h: 15 },
    /*13*/ { sx: 236, sy: 56, w: 32, h: 14 },
    /*14*/ { sx: 236, sy: 56, w: 32, h: 14 },
    /*15*/ { sx: 144, sy:  1, w: 56, h: 48 },
];

// REGION table from DS:0x0364 -- 5 regions x 6 permitted kinds each,
// as byte indices into TERRAIN_KINDS.
export const REGIONS = [
    { kinds: [0, 1, 2, 6, 7, 8].map(k => TERRAIN_KINDS[k]) },    // 0 plains/valley
    { kinds: [6, 7, 8, 6, 7, 8].map(k => TERRAIN_KINDS[k]) },    // 1 open grassland (bushes only)
    { kinds: [3, 4, 5, 12, 13, 14].map(k => TERRAIN_KINDS[k]) }, // 2 mountains
    { kinds: [9, 10, 11, 12, 13, 14].map(k => TERRAIN_KINDS[k]) },// 3 high desert (rocks)
    { kinds: [3, 4, 5, 3, 4, 5].map(k => TERRAIN_KINDS[k]) },    // 4 forest (trees only)
];


// Region for a given landmark index. Rough: plains until Chimney Rock,
// then mountains around South Pass, high desert through Snake River,
// forested to the end. This is our own mapping -- the DOS game's
// [0x1885] region byte is not directly recovered.
export function regionForLandmark(lmIndex) {
    if (lmIndex <= 4) return 0;
    if (lmIndex <= 6) return 1;
    if (lmIndex <= 9) return 2;
    if (lmIndex <= 12) return 3;
    return 4;
}


// Animal species come straight from assets.js -- each ANIMALS[i] carries
// frames[0..5] with sx/sy/sw/sh measured programmatically from
// vga_ANIMALS.png (see the audit report and assets.js comments). We
// keep the shape ANIMALS gives us: `id`, `label`, `band`, `meatLbs`,
// `speedPxPerFrame`, `frames[]`, `hitSprite`. `w`/`h` here reference
// frames[0] for placement -- animation cycles through all frames.
export const SPECIES = ANIMALS.map((a, i) => ({
    id: i,
    name: a.label.toLowerCase(),
    band: a.band,
    meatLbs: a.meatLbs,
    speed: a.speedPxPerFrame,
    frameCount: a.frames.length,
    frames: a.frames,
    animFrameInterval: a.animFrameInterval || 120,
    hitSprite: a.hitSprite,
    w: a.frames[0].sw,
    h: a.frames[0].sh,
}));


// Build the initial field. Returns { hunter, scenery, animals }.
export function buildField(landmarkIndex, direction = '8') {
    const placed = [];
    const region = REGIONS[regionForLandmark(landmarkIndex)];

    // Slot 0: the hunter. Size a rough 24x26.
    const hunterW = 24, hunterH = 26;
    const hunterSpot = placeAt(hunterW, hunterH, placed);
    const hunter = {
        x: hunterSpot ? hunterSpot.x : (HUNT_FIELD_W / 2) | 0,
        y: hunterSpot ? hunterSpot.y : (HUNT_FIELD_H / 2) | 0,
        w: hunterW, h: hunterH,
        direction: DIRECTIONS[direction] || DIRECTIONS['8'],
        walking: false,
    };
    placed.push({ x: hunter.x, y: hunter.y, w: hunterW, h: hunterH });

    // Slots 3..10: scenery, Random(4) + 5 objects (hunt:0x6470).
    const count = rng.nextInt(4) + HUNT_SCENERY_MIN;
    const scenery = [];
    for (let i = 0; i < count; i++) {
        const kind = region.kinds[rng.nextInt(region.kinds.length)];
        const spot = placeAt(kind.w, kind.h, placed);
        if (!spot) continue;
        scenery.push({
            x: spot.x, y: spot.y, w: kind.w, h: kind.h,
            sx: kind.sx, sy: kind.sy,
        });
        placed.push({ x: spot.x, y: spot.y, w: kind.w, h: kind.h });
    }

    return { hunter, scenery, animals: [], placed };
}


// One tick of the wave/animal-spawn logic, per hunt:0x7052.
// 7% per-slot chance, up to HUNT_MAX_SPAWNS_PER_SLOT total. Species
// gated by landmark.
export function tickSpawns(field, landmarkIndex) {
    if (field.animals.length >= HUNT_MAX_SPAWNS_PER_SLOT * 2) return;
    if (!rng.chance(HUNT_SPAWN_RATE_PER_SLOT_PER_TURN)) return;

    // Pick a species. The game redraws if the species is gated out;
    // we do the same, up to a small cap.
    let species = null;
    for (let tries = 0; tries < 10 && species === null; tries++) {
        const idx = rng.nextInt(SPECIES.length);
        if (HUNT_SPECIES_GATES[idx] && HUNT_SPECIES_GATES[idx](landmarkIndex)) {
            species = SPECIES[idx];
        }
    }
    if (species === null) return;

    // Enter from left or right edge -- alternating per animal count.
    const fromLeft = (field.animals.length % 2 === 0);
    const w = species.w, h = species.h;
    const x = fromLeft ? 0 : (316 - w);
    // Reject if the y overlaps something else.
    for (let tries = 0; tries < 20; tries++) {
        const y = rng.nextInt(199 - h);
        const rect = { x, y, w, h };
        if (!field.placed.some((p) => overlaps(rect, p))) {
            field.animals.push({
                x, y, w, h,
                species,
                dx: fromLeft ? 2 : -2,
                dy: rng.nextInt(5) - 2,   // hunt:0x7229
                alive: true,
            });
            field.placed.push(rect);
            return;
        }
    }
}


// ---------------------------------------------------------------------------
// The mini-game
// ---------------------------------------------------------------------------

export class HuntingGame {
    constructor(canvas, renderer, gameState) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.gameState = gameState;
        this.field = null;
        this.result = { hits: 0, shotsFired: 0, meat: 0 };
        this.startedAt = 0;
        this.durationMs = 30_000;   // hunt is 30 s
        this._keyHandler = null;
        this._resolve = null;
    }

    async start() {
        return new Promise((resolve) => {
            this._resolve = resolve;
            this.field = buildField(this.gameState.currentLandmarkIndex);
            this.startedAt = performance.now();
            this._keyHandler = (e) => this._onKey(e);
            document.addEventListener('keydown', this._keyHandler);
            requestAnimationFrame((t) => this._tick(t));
            this._draw();
        });
    }

    _onKey(e) {
        if (e.key === 'Escape') {
            this._end('stopped');
            return;
        }
        if (e.key === 'Enter') {
            this.field.hunter.walking = !this.field.hunter.walking;
            return;
        }
        if (e.key === ' ') {
            e.preventDefault();
            this._fire();
            return;
        }
        if (DIRECTIONS[e.key]) {
            this.field.hunter.direction = DIRECTIONS[e.key];
            return;
        }
    }

    _fire() {
        if (this.gameState.supplies.ammunition <= 0) return;
        this.result.shotsFired += 1;
        this.gameState.supplies.ammunition -= 1;

        // Aim: a rectangle in front of the hunter in the current
        // direction, one tile deep. A hit is any animal whose bounding
        // box overlaps that rectangle.
        const h = this.field.hunter;
        const aim = {
            x: h.x + h.direction.dx * 12,
            y: h.y + h.direction.dy * 12,
            w: h.w, h: h.h,
        };
        for (const a of this.field.animals) {
            if (!a.alive) continue;
            if (overlaps(aim, a)) {
                a.alive = false;
                this.result.hits += 1;
                this.result.meat += a.species.meatLbs;
                break;   // one bullet, one animal at most
            }
        }
    }

    _tick(now) {
        if (!this._resolve) return;
        const elapsed = now - this.startedAt;
        if (elapsed >= this.durationMs || this.gameState.supplies.ammunition <= 0) {
            this._end('time');
            return;
        }

        // Walk if the hunter is walking.
        const h = this.field.hunter;
        if (h.walking) {
            const nx = h.x + h.direction.dx;
            const ny = h.y + h.direction.dy;
            if (nx < 0 || nx > 318 - h.w || ny < 1 || ny > 199 - h.h) {
                h.walking = false;
            } else {
                h.x = nx; h.y = ny;
            }
        }

        // Move animals.
        for (const a of this.field.animals) {
            if (!a.alive) continue;
            a.x += a.dx;
            a.y = Math.max(0, Math.min(199 - a.h, a.y + a.dy));
            if (a.x < -a.w || a.x > 320) a.alive = false;
        }
        this.field.animals = this.field.animals.filter((a) => a.alive || a.x > -a.w);

        // Spawn.
        tickSpawns(this.field, this.gameState.currentLandmarkIndex);

        this._draw();
        requestAnimationFrame((t) => this._tick(t));
    }

    _end(reason) {
        document.removeEventListener('keydown', this._keyHandler);
        this._keyHandler = null;
        const resolve = this._resolve;
        this._resolve = null;

        // Cap the take at HUNT_MAX_CARRY_LBS -- the game's famous
        // "you can only carry 100 pounds back to the wagon".
        const carried = Math.min(this.result.meat, HUNT_MAX_CARRY_LBS);
        this.gameState.supplies.food += carried;

        resolve({ ...this.result, carried, reason });
    }

    _draw() {
        if (this.renderer && typeof this.renderer.drawHuntingField === 'function') {
            this.renderer.drawHuntingField(this.field, this.result);
        }
    }
}
