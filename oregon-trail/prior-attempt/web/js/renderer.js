// =============================================================================
// renderer.js - All canvas drawing primitives
// =============================================================================
//
// The renderer is intentionally a thin layer over the Canvas 2D API.
//
// FIX (image-mapping pass): when first written, this file assumed asset
// filenames matched their content. They do not - see assets.js for the
// full mapping. The result was that the hunting "background" was actually
// a wagon scene, the supplies "icons" were weather glyphs, etc. The
// public method list is unchanged; the implementations now point at the
// files whose content actually fits each role.
// =============================================================================

import {
    ASSET_KEYS,
    TRAIL_LENGTH_MILES,
    MONTH_NAMES,
} from './constants.js';
import {
    SUPPLY_ICONS,
    WAGON_FRAMES,
    HUNT_TARGETS,
    HUNTER_SPRITE,
    FLOAT_SCENE,
    // legacy aliases - still imported by hunting.js
    TRAVELOX_FRAMES,
    ANIMAL_SPRITES,
} from './assets.js';


export class Renderer {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {AssetLoader} assets
     */
    constructor(canvas, assets) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.assets = assets;

        // Disable image smoothing so 320x200 pixel art stays crisp when
        // scaled by CSS.
        this.ctx.imageSmoothingEnabled = false;

        this.width = canvas.width;     // 320
        this.height = canvas.height;   // 200
    }

    // ---------------------------------------------------------------------
    // Primitives
    // ---------------------------------------------------------------------

    /**
     * Clear the canvas to a solid colour (default: black).
     */
    clearScreen(color = '#000000') {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Draw an asset by key, scaled to fill the entire canvas. Used for
     * landmark scenes which were authored at ~320x160 and look natural
     * when stretched the last 40 px to fit our 320x200 viewport.
     */
    drawScene(assetKey) {
        const img = this.assets.getImage(assetKey);
        this.clearScreen();
        if (!img) {
            this._drawMissingAsset(assetKey);
            return;
        }
        this.ctx.drawImage(img, 0, 0, this.width, this.height);
    }

    /**
     * FIX: many of our "scene" images are shorter than 200 px (eg MAP is
     * 320x134, FAMILY is 320x98). drawScene stretches them vertically
     * which distorts the art. drawSceneLetterbox preserves aspect ratio,
     * fitting the image inside the canvas with black bars top/bottom (or
     * left/right) as needed.
     *
     * Returns the rectangle the image was drawn into - {x, y, w, h} -
     * so callers can overlay markers in image-local coordinates.
     */
    drawSceneLetterbox(assetKey, bgColor = '#000000') {
        const img = this.assets.getImage(assetKey);
        this.clearScreen(bgColor);
        if (!img) {
            this._drawMissingAsset(assetKey);
            return { x: 0, y: 0, w: this.width, h: this.height };
        }

        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const scale = Math.min(this.width / iw, this.height / ih);
        const w = Math.floor(iw * scale);
        const h = Math.floor(ih * scale);
        const x = Math.floor((this.width - w) / 2);
        const y = Math.floor((this.height - h) / 2);

        this.ctx.drawImage(img, x, y, w, h);
        return { x, y, w, h };
    }

    /**
     * Pixel-art friendly text overlay - draws a black box with a green
     * border and yellow text inside it.
     */
    drawTextPanel(lines, x, y, w, h) {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x, y, w, h);

        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = '10px monospace';
        const lineHeight = 12;
        for (let i = 0; i < lines.length; i++) {
            this.ctx.fillText(lines[i], x + 6, y + 14 + i * lineHeight);
        }
    }

    // ---------------------------------------------------------------------
    // Title / main menu
    // ---------------------------------------------------------------------

    /**
     * Title-screen background.
     *
     * FIX 1 (BANNER restored): vga_BANNER.png contains the decorative
     * "The Oregon Trail" title and is the correct centrepiece for the
     * title screen (NOT the MECC publisher logo, which is mostly
     * white-on-white and dominates the canvas if used full width).
     *
     * Layout (top to bottom):
     *   y=0   vga_BANNER scaled to 60% canvas height (aspect-preserved)
     *         displayed width comes out to ~194 px, centred horizontally
     *   below: wagon at scale 2 (156x62 px), centred, +8 px gap
     *   bottom of canvas: black (DOM menu lives below the canvas)
     *
     * @param {number} [frameIndex=0]  picks WAGON_FRAMES.frames[idx]
     */
    drawMainMenu(frameIndex = 0) {
        this.clearScreen('#000000');

        // FIX 1 (BANNER restored): vga_BANNER.png is actually 320x63
        // (a horizontal title strip), not the 266x165 tall format the
        // spec assumed. We display it at full canvas width with
        // aspect-preserved height (63 px) flush at y=0. Returns the
        // banner's bottom Y so the wagon can sit just beneath it.
        let bannerBottom = 0;
        const banner = this.assets.getImage(ASSET_KEYS.BANNER);
        if (banner) {
            const bannerW = this.width;
            const bannerH = Math.floor(
                banner.naturalHeight * (bannerW / banner.naturalWidth),
            );
            this.ctx.drawImage(banner, 0, 0, bannerW, bannerH);
            bannerBottom = bannerH;
        }

        // FIX 1 (wagon scale 2): the wagon now sits at scale 2 (was 3)
        // so the banner + wagon stack fits the canvas without crowding
        // the bottom. 8 px margin between banner and wagon.
        const frame = WAGON_FRAMES.frames[frameIndex % WAGON_FRAMES.frames.length];
        const scale = 2;
        const dw = frame.sw * scale;
        const dh = frame.sh * scale;
        const dx = Math.floor((this.width - dw) / 2);
        const dy = bannerBottom + 8;
        this.assets.drawSprite(
            this.ctx, WAGON_FRAMES.sourceKey, frame,
            dx, dy, dw, dh,
        );
    }

    // ---------------------------------------------------------------------
    // Welcome / setup intro
    // ---------------------------------------------------------------------

    /**
     * Single backdrop method for every "family-themed" canvas screen:
     * welcome, occupation choice, difficulty choice, party names, and
     * departure month. The image keeps its native aspect ratio at full
     * canvas width and is centred vertically inside the canvas, with
     * black padding above and below.
     *
     * FIX 2 (FAMILY positioning): the previous pass drew vga_FAMILY at
     * y=0 which clipped the wagon canopy at the top of the canvas. The
     * new layout adds equal padding above and below so the scene
     * matches the user's reference screenshot.
     *
     * FIX 3 (no overlay): no fillRect is drawn on top of the image -
     * all menu text lives in the DOM input panel below the canvas.
     */
    drawFamilyScreen() {
        this.clearScreen('#000000');
        const img = this.assets.getImage(ASSET_KEYS.FAMILY);
        if (!img) return;
        const scaledW = this.width;
        const scaledH = Math.floor(img.naturalHeight * (scaledW / img.naturalWidth));
        const offsetY = Math.floor((this.height - scaledH) / 2);
        this.ctx.drawImage(img, 0, offsetY, scaledW, scaledH);
    }

    // Aliases kept for backwards compatibility with existing callers.
    drawWelcomeScreen()    { this.drawFamilyScreen(); }
    drawPartySetupScreen() { this.drawFamilyScreen(); }

    // ---------------------------------------------------------------------
    // Travel animation - "Continue on trail" sequence
    // ---------------------------------------------------------------------

    /**
     * Play the wagon-crossing animation that runs when the player picks
     * "Continue on trail" from the daily menu.
     *
     * FIX 7: the previous flow advanced the day silently in code; the
     * player got no sense of travel. This method paints a terrain
     * backdrop, walks the wagon from the right edge to the left at
     * scale 3 with the 3-frame walk cycle, and returns a Promise that
     * resolves when the wagon exits the left edge.
     *
     * Caller is responsible for setting canvasLocked=true before
     * calling and false after the promise resolves.
     *
     * @param {GameState} gameState
     * @returns {Promise<void>}
     */
    animateTravel(gameState) {
        return new Promise((resolve) => {
            const scale = 3;
            const frame0 = WAGON_FRAMES.frames[0];
            const wagonH = frame0.sh * scale;
            const wagonY = this.height - wagonH - 28;

            // FIX: Durasi 60 detik. Wagon bergerak dari kanan ke kiri
            // dalam 60 detik, kecepatan = (width + wagon_width) / (60 * 60fps)
            const DURATION_MS = 60000;                        // 60 detik
            const totalDistance = this.width + frame0.sw * scale + 30;
            const WAGON_SPEED  = totalDistance / (DURATION_MS / (1000 / 60)); // px per frame
            const FRAME_MS     = 220;

            let wagonX = this.width + 30;
            let frameIdx = 0;
            let lastFrameTime = 0;
            const startTime = performance.now();

            const tick = (timestamp) => {
                this._paintSkyAndGround();

                if (timestamp - lastFrameTime > FRAME_MS) {
                    frameIdx = (frameIdx + 1) % WAGON_FRAMES.frames.length;
                    lastFrameTime = timestamp;
                }

                wagonX -= WAGON_SPEED;
                const frame = WAGON_FRAMES.frames[frameIdx];
                const dw = frame.sw * scale;
                const dh = frame.sh * scale;
                this.assets.drawSprite(
                    this.ctx, WAGON_FRAMES.sourceKey, frame,
                    Math.floor(wagonX), wagonY, dw, dh,
                );

                this.drawTextPanel([
                    `Travelling...`,
                    `${gameState.totalMiles} miles`,
                    `Pace: ${gameState.pace.name}`,
                ], 4, 4, 110, 50);

                // Selesai saat wagon keluar kiri ATAU 60 detik habis
                const elapsed = timestamp - startTime;
                if (wagonX + frame.sw * scale < 0 || elapsed >= DURATION_MS) {
                    resolve();
                    return;
                }

                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    }

    // ---------------------------------------------------------------------
    // Daily-menu backdrop
    // ---------------------------------------------------------------------

    /**
     * Background painted behind the "What now?" daily-menu screen.
     *
     * FIX 3 (no overlay): the dark fillRect band over the bottom of
     * the landmark image is removed. All menu text lives in the DOM
     * panel BELOW the canvas, not on the canvas itself, so the band
     * was redundant and only obscured the artwork.
     *
     * FIX 4 (landmark-vs-scenery): only paint the landmark image
     * (vga_Pn) when the player has just arrived at it. While in
     * between landmarks paint the generic vga_SCENERY-style backdrop
     * (a procedural sky+ground - vga_SCENERY itself is a decoration
     * sprite sheet, not a landscape backdrop).
     *
     * @param {GameState} gameState
     */
    drawDailyMenu(gameState) {
        if (gameState.justArrivedAtLandmark) {
            const idx = Math.max(0, Math.min(
                gameState.currentLandmarkIndex,
                17,
            ));
            const img = this.assets.getLandmarkImage(idx);
            if (img) {
                this.ctx.drawImage(img, 0, 0, this.width, this.height);
                return;
            }
        }
        // FIX: Di antara landmark, tampilkan vga_SCENERY sebagai background.
        // Jika tidak tersedia, fallback ke procedural sky+ground.
        const scenery = this.assets.getImage(ASSET_KEYS.SCENERY);
        if (scenery) {
            this.ctx.drawImage(scenery, 0, 0, this.width, this.height);
        } else {
            this._paintSkyAndGround();
        }
    }

    // ---------------------------------------------------------------------
    // Travel screen
    // ---------------------------------------------------------------------

    /**
     * Daily travel screen.
     *
     * FIX (asset-keys pass): the spec asks for SCENERY as background and
     * TRAVELOX as wagon overlay. TRAVELOX is correct (wagon walk frames).
     * vga_SCENERY however is a sheet of decoration sprites (trees, number
     * tiles, bushes, rocks) - not a landscape backdrop. Stretching that
     * fullscreen would look strange, so we keep the programmatic sky+
     * mountains+ground from the previous pass and sprinkle a couple of
     * SCENERY sprites (a tree) near the horizon as decoration. Wagon is
     * composited on top from TRAVELOX (the correct source).
     *
     * @param {GameState} gameState
     * @param {number} frameIndex  0..WAGON_FRAMES.frames.length - 1
     */
    drawTravelScreen(gameState, frameIndex) {
        // Programmatic sky / mountains / ground.
        this._paintSkyAndGround();

        // FIX (asset-keys): one decoration tree from vga_SCENERY near the
        // horizon for visual interest. Coords pick the leftmost tree
        // sprite (rough rect from visual inspection of the 320x98 sheet).
        const tree = { sx: 4, sy: 4, sw: 30, sh: 44 };
        this.assets.drawSprite(
            this.ctx, ASSET_KEYS.SCENERY, tree,
            10, 100, 30, 44,
        );
        this.assets.drawSprite(
            this.ctx, ASSET_KEYS.SCENERY, tree,
            this.width - 40, 102, 30, 44,
        );

        // FIX 6: composite the wagon at 2x source size for visibility on
        // the 320x200 canvas. Bottom-centre with a one-pixel bob each
        // frame to suggest motion. Coords come from WAGON_FRAMES, which
        // were derived precisely in Fix 4 and crop tightly to the wagon
        // silhouette (no surrounding black gutter).
        const frame = WAGON_FRAMES.frames[frameIndex % WAGON_FRAMES.frames.length];
        const destW = frame.sw * 2;
        const destH = frame.sh * 2;
        const destX = Math.floor((this.width - destW) / 2);
        const destY = this.height - destH - 30 + (frameIndex % 2);
        this.assets.drawSprite(
            this.ctx, WAGON_FRAMES.sourceKey, frame,
            destX, destY, destW, destH,
        );

        // Status overlay in the top-left.
        const lines = [
            `Date: ${this._formatDate(gameState)}`,
            `Weather: ${gameState.weather || 'cool'}`,
            `Health: ${gameState.partyHealthLabel()}`,
            `Pace:   ${gameState.pace.name}`,
            `Rations: ${gameState.ration.name}`,
            `Miles travelled: ${gameState.totalMiles}`,
            `Miles to next landmark: ${gameState.milesToNextLandmark()}`,
        ];
        this.drawTextPanel(lines, 4, 4, 200, 96);
    }

    /**
     * Paint a sky and ground in code, no image required. Used as the
     * travel-screen background. Three horizontal bands: pale blue sky,
     * distant purple mountains, green ground.
     */
    _paintSkyAndGround() {
        // Sky
        this.ctx.fillStyle = '#8ec8ff';
        this.ctx.fillRect(0, 0, this.width, 120);

        // Distant mountain silhouette - a few triangles for shape.
        this.ctx.fillStyle = '#7e63a8';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 120);
        this.ctx.lineTo(40, 80);
        this.ctx.lineTo(80, 110);
        this.ctx.lineTo(140, 70);
        this.ctx.lineTo(200, 105);
        this.ctx.lineTo(260, 75);
        this.ctx.lineTo(320, 115);
        this.ctx.lineTo(320, 120);
        this.ctx.lineTo(0, 120);
        this.ctx.closePath();
        this.ctx.fill();

        // Ground - bright meadow green.
        this.ctx.fillStyle = '#3b8c2e';
        this.ctx.fillRect(0, 120, this.width, this.height - 120);

        // Trail line snaking through the ground.
        this.ctx.strokeStyle = '#a08055';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 200);
        this.ctx.quadraticCurveTo(80, 170, 160, 165);
        this.ctx.quadraticCurveTo(240, 160, 320, 130);
        this.ctx.stroke();
    }

    // ---------------------------------------------------------------------
    // Map screen
    // ---------------------------------------------------------------------

    /**
     * Trail map.
     *
     * FIX 5 (map crisp): vga_MAP.png is 640x399. Let drawImage do the
     * aspect-preserving scale to canvas size with imageSmoothingEnabled
     * temporarily set to false. No manual resize/letterbox helper - the
     * spec calls out specifically that wrapping drawImage in any extra
     * preprocessing produces blurred pixel edges.
     */
    drawMap(gameState) {
        this.clearScreen('#000000');
        const img = this.assets.getImage(ASSET_KEYS.MAP);

        if (img) {
            const scale = Math.min(
                this.width  / img.naturalWidth,
                this.height / img.naturalHeight,
            );
            const dw = Math.floor(img.naturalWidth  * scale);
            const dh = Math.floor(img.naturalHeight * scale);
            const ox = Math.floor((this.width  - dw) / 2);
            const oy = Math.floor((this.height - dh) / 2);

            // FIX: Map adalah monochrome 1-bit yang di-scale dari 640x399
            // ke 320x200. imageSmoothingEnabled = true (LANCZOS-style) agar
            // text nama kota tetap terbaca — pixel-perfect NEAREST justru
            // membuang pixel tipis pada font monochrome sehingga pecah.
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
            this.ctx.drawImage(img, ox, oy, dw, dh);
            this.ctx.imageSmoothingEnabled = false;

            this._drawMapMarker(gameState, { x: ox, y: oy, w: dw, h: dh });

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, this.height - 12, this.width, 12);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '7px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Press any key to return',
                              this.width / 2, this.height - 3);
            this.ctx.textAlign = 'left';
            return;
        }

        this._drawProceduralMap(gameState);
    }

    /**
     * Position marker for the real map image (if present).
     *
     * FIX 5 (centered map): the polyline is expressed as PERCENTAGES of
     * the map image (px in 0..1 horizontally, py in 0..1 vertically) and
     * then projected onto the letterboxed rect. That way the marker
     * still lands on the right geographical spot even when the image is
     * scaled or letterboxed.
     */
    _drawMapMarker(gameState, rect) {
        const t = Math.min(1, gameState.totalMiles / TRAIL_LENGTH_MILES);

        // Percentage-based polyline from Independence (lower right) to
        // Willamette (upper left). Tuned against the spec's coordinates.
        const polyline = [
            { t: 0.00, px: 0.78, py: 0.80 },   // Independence
            { t: 0.15, px: 0.68, py: 0.73 },
            { t: 0.30, px: 0.56, py: 0.68 },
            { t: 0.45, px: 0.44, py: 0.62 },
            { t: 0.60, px: 0.34, py: 0.57 },
            { t: 0.75, px: 0.25, py: 0.50 },
            { t: 0.90, px: 0.17, py: 0.43 },
            { t: 1.00, px: 0.09, py: 0.38 },   // Willamette Valley
        ];

        let px = polyline[0].px, py = polyline[0].py;
        for (let i = 0; i < polyline.length - 1; i++) {
            const a = polyline[i], b = polyline[i + 1];
            if (t >= a.t && t <= b.t) {
                const local = (t - a.t) / (b.t - a.t);
                px = a.px + (b.px - a.px) * local;
                py = a.py + (b.py - a.py) * local;
                break;
            }
        }

        // Project percentages into the letterboxed rectangle.
        const x = Math.floor(rect.x + px * rect.w);
        const y = Math.floor(rect.y + py * rect.h);

        // Marker with a dark halo so it reads on any background.
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x - 3, y - 3, 7, 7);
        this.ctx.fillStyle = '#ffff00';
        this.ctx.fillRect(x - 2, y - 2, 5, 5);

        // Mileage strap at the bottom of the canvas.
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '9px monospace';
        this.ctx.fillText(
            `${gameState.totalMiles} / ${TRAIL_LENGTH_MILES} mi`,
            8, this.height - 6,
        );
    }

    /**
     * Procedural map drawn in code when vga_MAP.png is unavailable.
     */
    _drawProceduralMap(gameState) {
        // Background - parchment-ish brown for the "map" feel.
        this.clearScreen('#3a2a18');
        this.ctx.fillStyle = '#a87f50';
        this.ctx.fillRect(8, 8, this.width - 16, this.height - 16);

        // Title strip.
        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 10px monospace';
        this.ctx.fillText('THE OREGON TRAIL', 10, 22);

        // Polyline through the trail. Same shape as before, recentred
        // for the parchment border.
        const polyline = [
            { t: 0.00, x: 285, y: 170 },
            { t: 0.15, x: 245, y: 158 },
            { t: 0.30, x: 200, y: 148 },
            { t: 0.45, x: 155, y: 138 },
            { t: 0.60, x: 115, y: 124 },
            { t: 0.75, x:  85, y: 105 },
            { t: 0.90, x:  60, y:  85 },
            { t: 1.00, x:  30, y:  60 },
        ];

        // Trail line - dashed brown.
        this.ctx.strokeStyle = '#4a2a08';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(polyline[0].x, polyline[0].y);
        for (let i = 1; i < polyline.length; i++) {
            this.ctx.lineTo(polyline[i].x, polyline[i].y);
        }
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Dots at the endpoints with labels.
        this.ctx.fillStyle = '#000000';
        this.ctx.font = '8px monospace';
        this.ctx.fillText('Independence', 220, 188);
        this.ctx.fillText('Willamette',     6, 56);

        // Position marker.
        const t = Math.min(1, gameState.totalMiles / TRAIL_LENGTH_MILES);
        let mx = polyline[0].x, my = polyline[0].y;
        for (let i = 0; i < polyline.length - 1; i++) {
            const a = polyline[i], b = polyline[i + 1];
            if (t >= a.t && t <= b.t) {
                const local = (t - a.t) / (b.t - a.t);
                mx = a.x + (b.x - a.x) * local;
                my = a.y + (b.y - a.y) * local;
                break;
            }
        }

        // Marker with halo
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(Math.floor(mx) - 3, Math.floor(my) - 3, 7, 7);
        this.ctx.fillStyle = '#ffff00';
        this.ctx.fillRect(Math.floor(mx) - 2, Math.floor(my) - 2, 5, 5);

        // Foot summary.
        this.ctx.fillStyle = '#000000';
        this.ctx.font = '9px monospace';
        this.ctx.fillText(
            `${gameState.totalMiles} of ${TRAIL_LENGTH_MILES} miles`,
            10, this.height - 14,
        );
    }

    // ---------------------------------------------------------------------
    // Hunting screen
    // ---------------------------------------------------------------------

    /**
     * Hunting screen.
     *
     * FIX (asset-keys pass): after the rename, the spec asks for
     * vga_HUNTER as background and vga_ANIMALS as target sprites.
     * vga_ANIMALS is correct (the animal grid). vga_HUNTER however is a
     * sprite sheet of shooter-character poses, not a fullscreen forest
     * backdrop, so painting it fullscreen would tile shooter sprites
     * across the canvas. We keep the painted forest backdrop and pick a
     * single hunter pose from vga_HUNTER (via HUNTER_SPRITE) as a
     * standing character at the bottom of the frame. Targets come from
     * HUNT_TARGETS (-> vga_ANIMALS) as the spec intends.
     */
    drawHuntingScreen(targets, crosshair) {
        // Forest backdrop.
        this.ctx.fillStyle = '#284d28';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#1a3a1a';
        for (let i = 0; i < 20; i++) {
            const x = (i * 17 + 5) % this.width;
            const y = 30 + (i * 11) % 80;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 6, 0, Math.PI * 2);
            this.ctx.fill();
        }
        // Ground strip
        this.ctx.fillStyle = '#3a5e30';
        this.ctx.fillRect(0, 150, this.width, 50);

        // Hunter character bottom-centre.
        const hunter = HUNTER_SPRITE.idle;
        const hx = Math.floor((this.width - hunter.sw) / 2);
        const hy = this.height - hunter.sh - 4;
        this.assets.drawSprite(
            this.ctx, HUNTER_SPRITE.sourceKey, hunter,
            hx, hy, hunter.sw, hunter.sh,
        );

        // Targets.
        for (const t of targets) {
            if (!t.alive) continue;
            const sprite = HUNT_TARGETS.sprites[t.spriteIndex];
            // FIX (asset-keys): HUNT_TARGETS.sourceKey is now ASSET_KEYS.ANIMALS
            // (the renamed file) - hunting targets live in vga_ANIMALS.png.
            this.assets.drawSprite(
                this.ctx, HUNT_TARGETS.sourceKey, sprite,
                Math.floor(t.x), Math.floor(t.y),
                sprite.sw, sprite.sh,
            );
        }

        // Crosshair.
        if (crosshair) {
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(crosshair.x - 5, crosshair.y);
            this.ctx.lineTo(crosshair.x + 5, crosshair.y);
            this.ctx.moveTo(crosshair.x, crosshair.y - 5);
            this.ctx.lineTo(crosshair.x, crosshair.y + 5);
            this.ctx.stroke();
        }
    }

    // ---------------------------------------------------------------------
    // Store screen
    // ---------------------------------------------------------------------

    /**
     * Matt's General Store layout.
     *
     * FIX 2b (store layout v2): left column is now the STORE_MANAGER
     * sprite from vga_SUPPLIES (the full-figure standing settler at
     * sx=201, sh=119) instead of the family scene from vga_FAMILY -
     * the user identified that figure as Matt, the shopkeeper. The
     * right column is a 3x3 grid of item cells; each cell shows the
     * SKU icon, a number (1..7) for keyboard shortcut, the item
     * label, the unit price, and a small "Recommended: N" hint based
     * on party condition.
     *
     * @param {Record<string, number>} prices
     * @param {number} cash
     * @param {Record<string, number>} [recommendations]  optional
     *        per-item quantity-to-buy hints from getStoreRecommendations().
     */
    drawStoreScreen(prices, cash, recommendations = {}) {
        this.clearScreen('#1a0a00');

        const leftW = Math.floor(this.width * 0.38);

        // -- Left: shopkeeper portrait pulled directly from vga_SUPPLIES. --
        const mgrSprite = SUPPLY_ICONS.sprites.STORE_MANAGER;
        const mgrImg = this.assets.getImage(SUPPLY_ICONS.sourceKey);
        if (mgrImg) {
            // Fit the manager inside the left column with aspect
            // preservation. Leave a small margin so the head does not
            // touch the caption banner.
            const targetH = this.height - 32;
            const scale = Math.min(
                leftW / mgrSprite.sw,
                targetH / mgrSprite.sh,
            );
            const dw = Math.floor(mgrSprite.sw * scale);
            const dh = Math.floor(mgrSprite.sh * scale);
            const dx = Math.floor((leftW - dw) / 2);
            const dy = 22;
            this.assets.drawSprite(
                this.ctx, SUPPLY_ICONS.sourceKey, mgrSprite,
                dx, dy, dw, dh,
            );
        }

        // Caption banner.
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(0, 0, leftW, 18);
        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = 'bold 8px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("Matt's Store", leftW / 2, 12);

        // Cash callout at the bottom of the left column.
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(0, this.height - 14, leftW, 14);
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = '7px monospace';
        this.ctx.fillText(`Cash: $${cash.toFixed(2)}`,
                          leftW / 2, this.height - 4);

        // -- Right: 3x3 grid of seven items. --
        const rightX = leftW + 3;
        const rightW = this.width - rightX;
        const cols = 3;
        const rows = 3;
        const cellW = Math.floor(rightW / cols);
        const cellH = Math.floor(this.height / rows);

        const items = [
            { key: 'FOOD',     label: 'Food',     unit: 'lb'  },
            { key: 'OXEN',     label: 'Oxen',     unit: 'ea'  },
            { key: 'AMMO',     label: 'Ammo',     unit: 'box' },
            { key: 'CLOTHING', label: 'Clothing', unit: 'set' },
            { key: 'WHEEL',    label: 'Wheel',    unit: 'ea'  },
            { key: 'AXLE',     label: 'Axle',     unit: 'ea'  },
            { key: 'TONGUE',   label: 'Tongue',   unit: 'ea'  },
        ];

        for (let idx = 0; idx < items.length; idx++) {
            const it = items[idx];
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const cx = rightX + col * cellW;
            const cy = row * cellH;

            // Cell background + frame.
            this.ctx.fillStyle = '#001500';
            this.ctx.fillRect(cx + 1, cy + 1, cellW - 2, cellH - 2);
            this.ctx.strokeStyle = '#003300';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(cx + 1, cy + 1, cellW - 2, cellH - 2);

            // Number shortcut label.
            this.ctx.fillStyle = '#888888';
            this.ctx.font = '7px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`${idx + 1}.`, cx + 3, cy + 9);

            // Icon scaled to fit cell.
            const sp = SUPPLY_ICONS.sprites[it.key];
            const iconScale = Math.min(
                (cellW - 8) / sp.sw,
                (cellH - 30) / sp.sh,
            );
            const iconW = Math.floor(sp.sw * iconScale);
            const iconH = Math.floor(sp.sh * iconScale);
            const iconX = cx + Math.floor((cellW - iconW) / 2);
            const iconY = cy + 10;
            this.assets.drawSprite(
                this.ctx, SUPPLY_ICONS.sourceKey, sp,
                iconX, iconY, iconW, iconH,
            );

            // Label
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = '7px monospace';
            this.ctx.textAlign = 'center';
            const labelY = iconY + iconH + 6;
            this.ctx.fillText(it.label, cx + cellW / 2, labelY);

            // Price line
            this.ctx.fillStyle = '#ffff00';
            const price = prices[it.key];
            const priceStr = (price < 1)
                ? `$${price.toFixed(2)}/${it.unit}`
                : `$${price}/${it.unit}`;
            this.ctx.fillText(priceStr, cx + cellW / 2, labelY + 7);

            // FIX 2b: recommendation hint (if any) below the price.
            const recQty = recommendations[it.key];
            if (recQty != null && recQty > 0) {
                this.ctx.fillStyle = '#88ddff';
                this.ctx.fillText(`Need ${recQty}`,
                                  cx + cellW / 2, labelY + 14);
            }
        }

        // Instruction strip.
        this.ctx.fillStyle = '#555555';
        this.ctx.font = '7px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('1-7: select item  |  Leave: last menu entry',
                          this.width / 2, this.height - 3);
        this.ctx.textAlign = 'left';
    }

    // ---------------------------------------------------------------------
    // Supplies grid
    // ---------------------------------------------------------------------

    /**
     * Supplies / store inventory grid.
     *
     * FIX (asset-keys pass): after the rename the store-item icons (wheel,
     * ox, settler, boots, rifle) live in vga_SUPPLIES, exactly where the
     * spec wants them. SUPPLY_ICONS.sourceKey is now ASSET_KEYS.SUPPLIES.
     * Background stays a dark green so the icons read clearly; no
     * fullscreen image is shown here, per spec.
     */
    drawSuppliesGrid(supplies, prices) {
        this.clearScreen('#001100');

        const items = [
            { key: 'OXEN',     value: supplies.oxen,                 price: prices.OXEN     },
            { key: 'FOOD',     value: `${supplies.food} lb`,         price: prices.FOOD     },
            { key: 'AMMO',     value: supplies.ammunition,           price: prices.AMMO     },
            { key: 'CLOTHING', value: supplies.clothingSets,         price: prices.CLOTHING },
            { key: 'WHEEL',    value: supplies.spareWheels,          price: prices.WHEEL    },
            { key: 'AXLE',     value: supplies.spareAxles,           price: prices.AXLE     },
            { key: 'TONGUE',   value: supplies.spareTongues,         price: prices.TONGUE   },
        ];

        const cellW = Math.floor(this.width / items.length);
        const iconW = cellW - 4;
        const iconH = 28;
        const topY = 18;

        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = '10px monospace';
        this.ctx.fillText('SUPPLIES', 4, 12);

        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const dx = i * cellW + 2;
            this.assets.drawSprite(
                this.ctx, SUPPLY_ICONS.sourceKey,
                SUPPLY_ICONS.sprites[it.key],
                dx, topY, iconW, iconH,
            );

            // Label under the icon
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '8px monospace';
            const label = String(it.value);
            const labelX = i * cellW + Math.floor((cellW - this.ctx.measureText(label).width) / 2);
            this.ctx.fillText(label, labelX, topY + iconH + 10);

            // Item name (one short word) above the icon
            const shortName = it.key.toLowerCase().slice(0, 4);
            this.ctx.fillStyle = '#aaffaa';
            const nameX = i * cellW + Math.floor((cellW - this.ctx.measureText(shortName).width) / 2);
            this.ctx.fillText(shortName, nameX, topY - 2);
        }

        // Cash display at the bottom.
        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = '10px monospace';
        this.ctx.fillText(
            `Cash on hand: $${supplies.cash.toFixed(2)}`,
            4, this.height - 8,
        );
    }

    // ---------------------------------------------------------------------
    // River crossing
    // ---------------------------------------------------------------------

    /**
     * Backdrop for the river-crossing menu.
     *
     * FIX (asset-keys pass): vga_FLOAT.png is new - a 229x111 strip with
     * river-crossing vignettes (wagon on ferry, wagon being pulled
     * across, half-sunken wagon). We do not yet know precise sprite
     * coordinates for picking the specific vignette per crossing method,
     * so the entire PNG is shown letterboxed as the spec's "placeholder"
     * directive instructs:
     *
     *   "Jika belum tahu koordinat pasti, tampilkan vga_FLOAT fullscreen
     *    sebagai placeholder sampai koordinat diverifikasi."
     *
     * Water-blue background fills the letterbox bars.
     *
     * @param {{name:string, depth?:number, widthFt?:number}} [info]
     */
    drawRiverCrossing(info) {
        // Water-blue background.
        this.clearScreen('#4a7fb4');

        // FLOAT vignettes letterboxed at native size.
        this.drawSceneLetterbox(FLOAT_SCENE.sourceKey, '#4a7fb4');

        // Optional info banner so the player knows which river they are
        // looking at. Drawn as a small text panel near the top.
        if (info && info.name) {
            const lines = [info.name];
            if (info.widthFt != null) lines.push(`Width: ${info.widthFt} ft`);
            if (info.depth   != null) lines.push(`Depth: ${info.depth} ft`);
            this.drawTextPanel(lines, 4, 4, 120, 14 + lines.length * 12);
        }
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    _drawMissingAsset(key) {
        this.clearScreen('#220022');
        this.ctx.fillStyle = '#ff00ff';
        this.ctx.font = '10px monospace';
        this.ctx.fillText('missing asset:', 8, 100);
        this.ctx.fillText(`  ${key}.png`, 8, 114);
        this.ctx.fillText('(check images/ folder)', 8, 134);
    }

    _formatDate(gameState) {
        const month = gameState.currentMonth + 1;
        const day = gameState.currentDay;
        const year = gameState.currentYear;
        return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
    }
}
