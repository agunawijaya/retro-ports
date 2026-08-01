// =============================================================================
// assets.js - Image loading and sprite definitions
// =============================================================================
//
// Responsibilities:
//   1. Load every PNG asset into HTMLImageElements ahead of game start.
//   2. Provide sprite-strip coordinates for the spritesheet PNGs.
//   3. Offer a small `drawSprite` helper to crop and draw a region.
//
// FIX (asset-keys pass): the PNGs were renamed so filename now matches
// content. The sprite COORDINATES in this file are unchanged from the
// previous round (same pixels in the same arrangement) - we only switch
// each sprite group's sourceKey to point at the new filename:
//
//      Old sourceKey         New sourceKey         Content
//      ---------------       --------------        -------------------
//      ASSET_KEYS.ANIMALS    ASSET_KEYS.TRAVELOX   wagon walk frames
//      ASSET_KEYS.MAP        ASSET_KEYS.ANIMALS    hunting target grid
//      ASSET_KEYS.EVENTS     ASSET_KEYS.SUPPLIES   store item icons
//      ASSET_KEYS.BANNER     ASSET_KEYS.HUNTER     shooter character sprites
//
// vga_FLOAT.png is new (river-crossing scenes); FLOAT_SCENE handles it.
// =============================================================================

import { IMG_BASE, ASSET_KEYS, LANDMARK_IMG_COUNT } from './constants.js';


// -----------------------------------------------------------------------------
// WAGON_FRAMES - travel-screen wagon animation
// -----------------------------------------------------------------------------
//
// FIX 1+6 (precise coords): vga_TRAVELOX.png (320x83) bounding boxes
// were derived programmatically via a column/row scan. The file actually
// contains FIVE wagon frames - three on the top row and two on the
// bottom. The spec asks for the three top frames as the canonical walk
// cycle:
//
//      Top row (y=1..31, h=31):
//          frame 0  x=  1.. 78   wagon mid-stride A
//          frame 1  x= 89..166   wagon mid-stride B
//          frame 2  x=177..254   wagon mid-stride C
//      Bottom row (y=36..69, h=34): unused (3/4-turn pose + hunter)
//
// Coords are tight on the wagon - no surrounding black gutter - so
// FIX 3 transparency keeps the silhouette clean against any backdrop.

export const WAGON_FRAMES = {
    sourceKey: ASSET_KEYS.TRAVELOX,
    frames: [
        { sx:   1, sy: 1, sw: 78, sh: 31 },   // frame 0
        { sx:  89, sy: 1, sw: 78, sh: 31 },   // frame 1
        { sx: 177, sy: 1, sw: 78, sh: 31 },   // frame 2
    ],
};

// FIX 1: spec asks for 300 ms per frame on the title and travel screens.
export const WAGON_FRAME_MS = 300;


// -----------------------------------------------------------------------------
// HUNT_TARGETS - animals that appear in the hunting mini-game
// -----------------------------------------------------------------------------
//
// FIX 6 (animals): vga_ANIMALS.png (320x134) is actually structured as
// six horizontal bands - one species each - of eight columns. The user
// confirmed the layout from analyze_animals.py:
//
//   Band 0 (sh=19) Bison male       slow      meat 100 lb
//   Band 1 (sh=15) Bison female     slow      meat 100 lb
//   Band 2 (sh=22) Deer male        medium    meat  50 lb
//   Band 3 (sh=21) Deer female      medium    meat  50 lb
//   Band 4 (sh= 9) Rabbit           fast      meat  10 lb
//   Band 5 (sh= 9) Squirrel         very fast meat   5 lb
//
// Columns:
//   0          hit-sprite (animal lies on its side, motionless)
//   1..6       six walk-cycle frames
//   7          alternative hit-sprite (unused - we use col 0)
//
// The squirrel row's col 0 is split into two adjacent sub-sprites that
// together form the silhouette; we capture both as one wide rect.

export const ANIMALS = [
    {
        id: 'bison_male',
        label: 'Bison',
        band: 0,
        meatLbs: 100,
        speedPxPerFrame: 0.4,
        animFrameInterval: 120,
        frames: [
            { sx:  40, sy:  2, sw: 26, sh: 19 },
            { sx:  79, sy:  2, sw: 27, sh: 19 },
            { sx: 120, sy:  2, sw: 26, sh: 19 },
            { sx: 155, sy:  2, sw: 26, sh: 19 },
            { sx: 195, sy:  2, sw: 27, sh: 19 },
            { sx: 235, sy:  2, sw: 26, sh: 19 },
        ],
        hitSprite: { sx: 4, sy: 2, sw: 28, sh: 19 },
    },
    {
        id: 'bison_female',
        label: 'Bison',
        band: 1,
        meatLbs: 100,
        speedPxPerFrame: 0.5,
        animFrameInterval: 120,
        frames: [
            { sx:  39, sy: 24, sw: 28, sh: 15 },
            { sx:  82, sy: 24, sw: 25, sh: 15 },
            { sx: 117, sy: 24, sw: 25, sh: 15 },
            { sx: 159, sy: 24, sw: 25, sh: 15 },
            { sx: 194, sy: 24, sw: 25, sh: 15 },
            { sx: 234, sy: 24, sw: 28, sh: 15 },
        ],
        hitSprite: { sx: 6, sy: 24, sw: 26, sh: 15 },
    },
    {
        id: 'deer_male',
        label: 'Deer',
        band: 2,
        meatLbs: 50,
        speedPxPerFrame: 0.9,
        animFrameInterval: 90,
        frames: [
            { sx:  39, sy: 45, sw: 23, sh: 22 },
            { sx:  82, sy: 45, sw: 21, sh: 22 },
            { sx: 122, sy: 45, sw: 21, sh: 22 },
            { sx: 158, sy: 45, sw: 21, sh: 22 },
            { sx: 198, sy: 45, sw: 21, sh: 22 },
            { sx: 239, sy: 45, sw: 23, sh: 22 },
        ],
        hitSprite: { sx: 6, sy: 45, sw: 23, sh: 22 },
    },
    {
        id: 'deer_female',
        label: 'Deer',
        band: 3,
        meatLbs: 50,
        speedPxPerFrame: 1.0,
        animFrameInterval: 90,
        frames: [
            { sx:  43, sy: 71, sw: 27, sh: 21 },
            { sx:  78, sy: 71, sw: 29, sh: 21 },
            { sx: 116, sy: 71, sw: 27, sh: 21 },
            { sx: 158, sy: 71, sw: 27, sh: 21 },
            { sx: 194, sy: 71, sw: 29, sh: 21 },
            { sx: 231, sy: 71, sw: 27, sh: 21 },
        ],
        hitSprite: { sx: 5, sy: 71, sw: 29, sh: 21 },
    },
    {
        id: 'rabbit',
        label: 'Rabbit',
        band: 4,
        meatLbs: 10,
        speedPxPerFrame: 1.8,
        animFrameInterval: 60,
        frames: [
            { sx:  34, sy: 100, sw: 14, sh: 9 },
            { sx:  64, sy: 100, sw: 13, sh: 9 },
            { sx:  92, sy: 100, sw: 13, sh: 9 },
            { sx: 118, sy: 100, sw: 13, sh: 9 },
            { sx: 146, sy: 100, sw: 13, sh: 9 },
            { sx: 175, sy: 100, sw: 14, sh: 9 },
        ],
        hitSprite: { sx: 6, sy: 100, sw: 13, sh: 9 },
    },
    {
        id: 'squirrel',
        label: 'Squirrel',
        band: 5,
        meatLbs: 5,
        speedPxPerFrame: 2.2,
        animFrameInterval: 50,
        frames: [
            { sx:  35, sy: 116, sw: 25, sh: 9 },
            { sx:  73, sy: 116, sw: 25, sh: 9 },
            { sx: 113, sy: 116, sw: 23, sh: 9 },
            { sx: 149, sy: 116, sw: 25, sh: 9 },
            { sx: 187, sy: 116, sw: 25, sh: 9 },
            { sx: 271, sy: 116, sw: 23, sh: 9 },
        ],
        // Squirrel hit-sprite spans two adjacent sub-sprites; capture as
        // one wide rect.
        hitSprite: { sx: 5, sy: 116, sw: 23, sh: 9 },
    },
];

// Legacy compatibility - HUNT_TARGETS still expected by older imports.
// We expose the first frame of each animal as a representative sprite.
export const HUNT_TARGETS = {
    sourceKey: ASSET_KEYS.ANIMALS,
    sprites: ANIMALS.map((a) => ({
        name: a.id.replace(/_(male|female)$/, ''),
        ...a.frames[0],
    })),
};


// -----------------------------------------------------------------------------
// SUPPLY_ICONS - store / supply-screen item icons
// -----------------------------------------------------------------------------
//
// FIX 2a (verified store coords): the user supplied final per-icon
// bounding boxes for vga_SUPPLIES.png (281x119) and identified the
// full-height standing figure at sx=201 as the STORE MANAGER (Matt) -
// not "food" as the previous pass guessed. The leftmost cluster at
// sx=2 is the FOOD icon (a flour bag / sack with reaching hand).
//
//      Layout (verified):
//        FOOD          sx=  2  sy=  0  sw=52  sh=49
//        WHEEL/AXLE/TONGUE  sx= 59  sy=  0  sw=46  sh=49
//        OXEN          sx=111  sy=  0  sw=66  sh=49
//        CLOTHING      sx=  3  sy= 51  sw=57  sh=41
//        AMMO          sx= 70  sy= 51  sw=76  sh=41
//        STORE_MANAGER sx=201  sy=  0  sw=47  sh=119  (full figure)

export const SUPPLY_ICONS = {
    sourceKey: ASSET_KEYS.SUPPLIES,

    sprites: {
        FOOD:          { sx:   2, sy:  0, sw: 52, sh:  49 },
        WHEEL:         { sx:  59, sy:  0, sw: 46, sh:  49 },
        AXLE:          { sx:  59, sy:  0, sw: 46, sh:  49 },
        TONGUE:        { sx:  59, sy:  0, sw: 46, sh:  49 },
        OXEN:          { sx: 111, sy:  0, sw: 66, sh:  49 },
        CLOTHING:      { sx:   3, sy: 51, sw: 57, sh:  41 },
        AMMO:          { sx:  70, sy: 51, sw: 76, sh:  41 },
        STORE_MANAGER: { sx: 201, sy:  0, sw: 47, sh: 119 },
    },
};


// -----------------------------------------------------------------------------
// HUNTER_SPRITE - the player character in the hunting mini-game
// -----------------------------------------------------------------------------
//
// FIX (asset-keys): source image is now vga_HUNTER.png (266x165) after
// the rename. Content is unchanged: a sprite sheet of a shooter character
// in many poses (4 rows of 6 frames). We use one idle pose as a static
// silhouette in the lower-centre of the hunting screen.

export const HUNTER_SPRITE = {
    sourceKey: ASSET_KEYS.HUNTER,
    // Row 0, column 0 = roughly the "standing, rifle down" pose.
    idle: { sx: 2, sy: 2, sw: 38, sh: 38 },
};


// -----------------------------------------------------------------------------
// HUNTER_SPRITES - facing-direction selector for the hunting mini-game
// -----------------------------------------------------------------------------
//
// FIX 6: vga_HUNTER.png is a 6x4 grid (~44x41 per cell) of shooter poses:
//
//      Row 0  facing RIGHT, rifle pointing along various elevation angles
//      Row 1  facing LEFT, mirror of row 0
//      Row 2  alternative right-facing poses
//      Row 3  alternative left-facing poses
//
// getSprite() picks a (row, col) based on the vector from the hunter to
// the crosshair. The hunter himself stays fixed; only the sprite that
// renders changes so it looks like he's swinging his rifle to follow
// the mouse.

export const HUNTER_SPRITES = {
    sourceKey: ASSET_KEYS.HUNTER,
    spriteW: 44,
    spriteH: 38,
    cols: 6,
    rows: 4,

    /**
     * Pick the cell that best matches the angle from the hunter to the
     * crosshair. The returned object is a sprite rect (sx/sy/sw/sh)
     * compatible with AssetLoader.drawSprite.
     *
     * Heuristic:
     *   - dx >= 0  -> row 0 (facing right);  dx < 0 -> row 1 (facing left)
     *   - column is chosen from the elevation angle: tighter cones map
     *     to specific poses. We cap the column index at 5.
     */
    getSprite(mouseX, mouseY, hunterX, hunterY) {
        const dx = mouseX - hunterX;
        const dy = mouseY - hunterY;
        const row = dx >= 0 ? 0 : 1;

        // Convert dy/dx ratio into a column choice. Pure horizontal is
        // col 0; steep upward is col 3-4; pure downward is col 2.
        const angle = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
        let col;
        if (angle < -50)      col = 4;       // very high upward
        else if (angle < -20) col = 3;       // moderate upward
        else if (angle < 15)  col = 0;       // roughly level
        else if (angle < 45)  col = 1;       // moderate downward
        else                  col = 2;       // steep downward

        return {
            sx: col * 44 + 2,
            sy: row * 41 + 2,
            sw: 44,
            sh: 38,
        };
    },
};


// -----------------------------------------------------------------------------
// FLOAT_SCENE - river crossing artwork
// -----------------------------------------------------------------------------
//
// FIX (asset-keys): vga_FLOAT.png (229x111) is new. It contains several
// vignettes: a wagon on a ferry/raft, a wagon being pulled across by
// oxen, a half-sunken wagon, plus two small icons (a road-sign and a
// dirt-road symbol). Exact sprite coords are not yet derived - until we
// inspect them, we treat the whole PNG as a single fullscreen scene
// painted during the river-crossing menu.

export const FLOAT_SCENE = {
    sourceKey: ASSET_KEYS.FLOAT,
};


// -----------------------------------------------------------------------------
// Backwards-compatible aliases
// -----------------------------------------------------------------------------
//
// renderer.js and hunting.js originally imported `TRAVELOX_FRAMES`,
// `TRAVELOX_FRAME_MS`, `SUPPLY_SPRITES`, and `ANIMAL_SPRITES`. To keep
// those imports compiling without touching every caller, we re-export
// the new constants under the old names. New code should prefer
// WAGON_FRAMES, SUPPLY_ICONS, HUNT_TARGETS, HUNTER_SPRITE.

export const TRAVELOX_FRAMES   = WAGON_FRAMES.frames;
export const TRAVELOX_FRAME_MS = WAGON_FRAME_MS;
export const SUPPLY_SPRITES    = SUPPLY_ICONS.sprites;
export const ANIMAL_SPRITES    = HUNT_TARGETS.sprites;


// -----------------------------------------------------------------------------
// AssetLoader - load all images, then expose getters
// -----------------------------------------------------------------------------

export class AssetLoader {
    constructor() {
        // images: { key -> HTMLImageElement }. Populated by loadAll().
        this.images = {};

        // FIX 3 (transparency): cache of pre-processed sprite tiles. Each
        // entry is an HTMLCanvasElement with the source rect already
        // copied and "near-black" pixels punched to alpha=0. Keyed by
        // imageKey + source rect so we only do the per-pixel pass once
        // per unique sprite region. See _getTransparentTile() below.
        this._spriteCache = {};

        // Names of every PNG we expect to load. The list is built once
        // because we add landmark P0..P17 programmatically.
        this.assetList = AssetLoader.buildAssetList();
    }

    /**
     * Build the full list of asset keys we need to load.
     * Includes static keys from ASSET_KEYS plus every landmark image vga_P0
     * through vga_P{LANDMARK_IMG_COUNT-1}.
     */
    static buildAssetList() {
        const list = Object.values(ASSET_KEYS);
        for (let i = 0; i < LANDMARK_IMG_COUNT; i++) {
            list.push(`vga_P${i}`);
        }
        return list;
    }

    /**
     * Load every PNG in parallel. Returns a promise that resolves once
     * every image has either successfully loaded or failed.
     *
     * On failure we DO NOT reject - the game should still start. The
     * renderer falls back to drawing a labelled colored rectangle in place
     * of the missing image. This makes path issues easy to diagnose.
     */
    async loadAll(onProgress) {
        const total = this.assetList.length;
        let done = 0;

        const tasks = this.assetList.map((key) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images[key] = img;
                    done++;
                    if (onProgress) onProgress(done, total, key);
                    resolve();
                };
                img.onerror = () => {
                    // Mark as failed so getImage() can return null.
                    this.images[key] = null;
                    done++;
                    console.warn(`Failed to load asset: ${key}`);
                    if (onProgress) onProgress(done, total, key);
                    resolve();
                };
                img.src = `${IMG_BASE}${key}.png`;
            });
        });

        await Promise.all(tasks);
    }

    /**
     * Returns the HTMLImageElement for the given key, or null if it
     * failed to load. Callers should null-check and use the renderer's
     * fallback rectangle for missing assets.
     */
    getImage(key) {
        return this.images[key] || null;
    }

    /**
     * Convenience accessor for landmark images.
     */
    getLandmarkImage(landmarkId) {
        return this.getImage(`vga_P${landmarkId}`);
    }

    /**
     * Crop and draw a sprite region from a loaded image. This is the
     * single primitive used by every renderer call that touches a
     * spritesheet (SUPPLY_ICONS, WAGON_FRAMES, HUNT_TARGETS).
     *
     * FIX 3 (transparency): the original DOS art treats black (R=G=B=0)
     * as a transparency mask, not a real colour. When a sprite is
     * composited over a scene (eg wagon over sky+ground), pure black
     * pixels must NOT appear - they would draw as solid black blocks
     * around the wagon. We accomplish that by rendering the sprite
     * through an offscreen canvas, walking the pixel data, and setting
     * alpha=0 for any pixel where every RGB channel is below a small
     * threshold. The threshold (16) is slightly above 0 to absorb any
     * compression noise from the original PCX -> PNG conversion.
     *
     * Per-pixel work is expensive, so the result is cached per unique
     * (imageKey, sx, sy, sw, sh) - subsequent draws are zero-overhead
     * drawImage calls.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} imageKey  asset key, eg ASSET_KEYS.SUPPLIES
     * @param {{sx:number, sy:number, sw:number, sh:number}} sprite
     * @param {number} dx, dy   destination top-left on the canvas
     * @param {number} dw, dh   destination size (may scale the sprite)
     */
    drawSprite(ctx, imageKey, sprite, dx, dy, dw, dh) {
        const tile = this._getTransparentTile(imageKey, sprite);
        if (!tile) {
            // Fallback: magenta rectangle with the key in white text.
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(dx, dy, dw, dh);
            ctx.fillStyle = '#ffffff';
            ctx.font = '8px monospace';
            ctx.fillText(imageKey, dx + 2, dy + 10);
            return;
        }
        // FIX 3: blit the pre-keyed tile (black pixels already alpha=0).
        ctx.drawImage(
            tile,
            0, 0, sprite.sw, sprite.sh,    // source = full tile
            dx, dy, dw, dh,                // dest may scale
        );
    }

    /**
     * FIX 3 (transparency): build or fetch a cached offscreen canvas
     * containing one sprite region with near-black pixels punched to
     * alpha=0. Returns the canvas, or null if the source image is
     * missing.
     */
    _getTransparentTile(imageKey, sprite) {
        const img = this.getImage(imageKey);
        if (!img) return null;

        const cacheKey =
            `${imageKey}_${sprite.sx}_${sprite.sy}_${sprite.sw}_${sprite.sh}`;
        const hit = this._spriteCache[cacheKey];
        if (hit) return hit;

        const offscreen = document.createElement('canvas');
        offscreen.width  = sprite.sw;
        offscreen.height = sprite.sh;
        const offCtx = offscreen.getContext('2d');
        offCtx.imageSmoothingEnabled = false;

        // 1. Copy the sprite region 1:1 into the offscreen canvas.
        offCtx.drawImage(
            img,
            sprite.sx, sprite.sy, sprite.sw, sprite.sh,
            0, 0, sprite.sw, sprite.sh,
        );

        // 2. Walk pixel data and clear near-black pixels.
        try {
            const imageData = offCtx.getImageData(0, 0, sprite.sw, sprite.sh);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] < 16 && data[i + 1] < 16 && data[i + 2] < 16) {
                    data[i + 3] = 0;       // alpha = 0
                }
            }
            offCtx.putImageData(imageData, 0, 0);
        } catch (err) {
            // getImageData may throw on file:// when the canvas is
            // tainted by a cross-origin image. We swallow and fall back
            // to the un-keyed tile - black squares are ugly but not fatal.
            console.warn('drawSprite: black-as-transparent skipped:', err.message);
        }

        this._spriteCache[cacheKey] = offscreen;
        return offscreen;
    }
}
