// =============================================================================
// hunting.js - Hunting mini-game
// =============================================================================
//
// The only real-time gameplay element in Oregon Trail. The original
// game used SPACE to fire and joystick/keyboard to aim; this rebuild
// uses the mouse (hover to aim, click to fire) with SPACE as an
// alternative trigger.
//
// FIX 6 + hunting-rewrite: the mini-game now uses the ANIMALS data
// structure defined in assets.js. Each animal has six walk-cycle frames
// and a dedicated "hit" sprite that shows the animal lying on its side
// motionless. When a target is hit:
//   - movement stops
//   - sprite swaps from walk-cycle to hitSprite
//   - the carcass stays on screen until the hunt ends (does NOT disappear)
//
// Other rules CONFIRMED from the original:
//   - timer is 30 seconds, or until ammo runs out
//   - max meat carried = 100 lb (HUNT_MAX_CARRY_LBS)
//   - meat values per species defined alongside each ANIMALS entry
// =============================================================================

import {
    HUNT_DURATION_SECONDS,
    HUNT_MAX_CARRY_LBS,
    ASSET_KEYS,
} from './constants.js';
import { ANIMALS, HUNTER_SPRITES } from './assets.js';


export class HuntingGame {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Renderer|AssetLoader} rendererOrAssets - either the Renderer
     *   (which exposes .assets) or an AssetLoader directly. Older callers
     *   pass the renderer, so we accept both for compatibility.
     * @param {GameState} gameState
     */
    constructor(canvas, rendererOrAssets, gameState) {
        this.canvas    = canvas;
        this.ctx       = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        // Accept renderer or asset loader.
        this.assets    = rendererOrAssets.assets || rendererOrAssets;
        this.gameState = gameState;

        this.targets   = [];
        this.ammoUsed  = 0;
        this.meatGained = 0;
        this.timeLeft  = HUNT_DURATION_SECONDS;
        this.running   = false;
        this.crosshair = { x: 160, y: 100 };

        // Bind handlers so add/removeEventListener pair correctly.
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onClick     = this._onClick.bind(this);
        this._onKeyDown   = this._onKeyDown.bind(this);
    }

    /**
     * Begin the hunt. Returns a Promise that resolves with a result
     * summary once the hunt finishes (timer expired, ammo out, or all
     * animals downed).
     */
    start() {
        return new Promise((resolve) => {
            this._resolve = resolve;

            if (this.gameState.supplies.ammunition <= 0) {
                this._resolveResult('no-ammo');
                return;
            }

            this._spawnAnimals();
            this._startTimer();

            this.canvas.addEventListener('mousemove', this._onMouseMove);
            this.canvas.addEventListener('click',     this._onClick);
            window.addEventListener('keydown',        this._onKeyDown);

            this.running = true;
            requestAnimationFrame((ts) => this._gameLoop(ts));
        });
    }

    // -----------------------------------------------------------------
    // Spawning + loop
    // -----------------------------------------------------------------

    _spawnAnimals() {
        // FIX 6 (smaller animals): one of each species, vertically
        // spread across the canvas. Scale dropped from 3 -> 1.5 so the
        // targets are smaller and harder to pick off. Y positions are
        // shifted slightly to keep the smaller sprites on the action
        // band rather than the top of the canvas.
        const SCALE = 1.5;
        const yPositions = [40, 65, 90, 110, 130, 150];

        ANIMALS.forEach((def, idx) => {
            const startRight = Math.random() > 0.5;
            const spriteW = def.frames[0].sw * SCALE;
            const startX = startRight
                ? this.canvas.width            // enters from the right
                : -spriteW;                    // enters from the left
            this.targets.push({
                def,
                x: startX,
                y: yPositions[idx],
                direction: startRight ? -1 : 1,
                frameIdx: 0,
                lastFrameTime: 0,
                isHit: false,
                scale: SCALE,
            });
        });
    }

    _gameLoop(timestamp) {
        if (!this.running) return;

        this._update(timestamp);
        this._render();

        requestAnimationFrame((ts) => this._gameLoop(ts));
    }

    _update(timestamp) {
        for (const target of this.targets) {
            if (target.isHit) continue;

            target.x += target.def.speedPxPerFrame * target.direction;

            const spriteW = target.def.frames[target.frameIdx].sw * target.scale;
            // Bounce at the edges.
            if (target.direction > 0 && target.x > this.canvas.width) {
                target.x = this.canvas.width;
                target.direction = -1;
            } else if (target.direction < 0 && target.x + spriteW < 0) {
                target.x = -spriteW;
                target.direction = 1;
            }

            // Advance walk-cycle frame.
            if (timestamp - target.lastFrameTime > target.def.animFrameInterval) {
                target.frameIdx = (target.frameIdx + 1) % target.def.frames.length;
                target.lastFrameTime = timestamp;
            }
        }
    }

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------

    _render() {
        // FIX 6: paint a forest backdrop in code instead of using
        // vga_HUNTER as a fullscreen scene - that file is a sprite
        // sheet of the shooter character, not a backdrop. Two-band
        // green fill with a few darker tree blobs reads as forest.
        this.ctx.fillStyle = '#284d28';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#1a3a1a';
        for (let i = 0; i < 24; i++) {
            const x = (i * 17 + 5) % this.canvas.width;
            const y = 20 + (i * 11) % 100;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 6, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.fillStyle = '#3a5e30';
        this.ctx.fillRect(0, 150, this.canvas.width, 50);

        // 2. Animals.
        for (const target of this.targets) {
            const sprite = target.isHit
                ? target.def.hitSprite
                : target.def.frames[target.frameIdx];
            const dw = sprite.sw * target.scale;
            const dh = sprite.sh * target.scale;

            // If moving left (and not hit), flip horizontally so the
            // animal faces its travel direction.
            if (!target.isHit && target.direction < 0) {
                this.ctx.save();
                this.ctx.translate(target.x + dw, target.y);
                this.ctx.scale(-1, 1);
                this.assets.drawSprite(
                    this.ctx, ASSET_KEYS.ANIMALS, sprite,
                    0, 0, dw, dh,
                );
                this.ctx.restore();
            } else {
                this.assets.drawSprite(
                    this.ctx, ASSET_KEYS.ANIMALS, sprite,
                    target.x, target.y, dw, dh,
                );
            }
        }

        // 3. Hunter character (fixed position, sprite swaps based on
        //    the angle from hunter to crosshair).
        this._renderHunter();

        // 4. Crosshair.
        this._renderCrosshair();

        // 5. HUD overlay.
        this._renderHUD();
    }

    /**
     * FIX 6: render the hunter character at a fixed position (centre,
     * three-quarters down the canvas) with a sprite chosen by the
     * vector from the hunter to the crosshair. The character himself
     * does not move - only his pose changes - so it reads as him
     * tracking the target with his rifle.
     */
    _renderHunter() {
        const hunterX = Math.floor(this.canvas.width  * 0.5);
        const hunterY = Math.floor(this.canvas.height * 0.78);
        const sprite = HUNTER_SPRITES.getSprite(
            this.crosshair.x, this.crosshair.y,
            hunterX, hunterY,
        );
        const scale = 1.6;
        const dw = Math.floor(sprite.sw * scale);
        const dh = Math.floor(sprite.sh * scale);
        this.assets.drawSprite(
            this.ctx, HUNTER_SPRITES.sourceKey, sprite,
            hunterX - Math.floor(dw / 2),
            hunterY - dh,
            dw, dh,
        );
    }

    _renderCrosshair() {
        const { x: cx, y: cy } = this.crosshair;
        const r = 8;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(cx - r - 3, cy); this.ctx.lineTo(cx - 2, cy);
        this.ctx.moveTo(cx + 2,    cy); this.ctx.lineTo(cx + r + 3, cy);
        this.ctx.moveTo(cx, cy - r - 3); this.ctx.lineTo(cx, cy - 2);
        this.ctx.moveTo(cx, cy + 2);    this.ctx.lineTo(cx, cy + r + 3);
        this.ctx.stroke();
    }

    _renderHUD() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        this.ctx.fillRect(0, this.canvas.height - 16, this.canvas.width, 16);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '8px monospace';

        const ammoLeft = this.gameState.supplies.ammunition - this.ammoUsed;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Ammo: ${ammoLeft}`, 4, this.canvas.height - 5);

        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Time: ${this.timeLeft}s`,
                          this.canvas.width / 2, this.canvas.height - 5);

        this.ctx.textAlign = 'right';
        this.ctx.fillText(`Meat: ${this.meatGained} lb`,
                          this.canvas.width - 4, this.canvas.height - 5);
    }

    // -----------------------------------------------------------------
    // Timer + input
    // -----------------------------------------------------------------

    _startTimer() {
        this._timerInterval = setInterval(() => {
            this.timeLeft -= 1;
            if (this.timeLeft <= 0) this._resolveResult('time');
        }, 1000);
    }

    _onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width  / rect.width;
        const sy = this.canvas.height / rect.height;
        this.crosshair.x = Math.floor((e.clientX - rect.left) * sx);
        this.crosshair.y = Math.floor((e.clientY - rect.top)  * sy);
    }

    _onClick(e) {
        if (!this.running) return;
        const ammoLeft = this.gameState.supplies.ammunition - this.ammoUsed;
        if (ammoLeft <= 0) { this._resolveResult('no-ammo'); return; }

        this.ammoUsed += 1;

        // AABB hit detection against every live target.
        const cx = this.crosshair.x;
        const cy = this.crosshair.y;
        for (const target of this.targets) {
            if (target.isHit) continue;
            const sp = target.def.frames[target.frameIdx];
            const dw = sp.sw * target.scale;
            const dh = sp.sh * target.scale;
            if (cx >= target.x && cx <= target.x + dw &&
                cy >= target.y && cy <= target.y + dh) {
                target.isHit = true;
                this.meatGained += target.def.meatLbs;
                if (this.meatGained > HUNT_MAX_CARRY_LBS) {
                    this.meatGained = HUNT_MAX_CARRY_LBS;
                }
                break;
            }
        }

        if (this.gameState.supplies.ammunition - this.ammoUsed <= 0) {
            this._resolveResult('no-ammo');
        } else if (this.targets.every((t) => t.isHit)) {
            this._resolveResult('cap');
        }
    }

    _onKeyDown(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            // Trigger a click at the crosshair.
            this._onClick({ clientX: 0, clientY: 0 });
        }
    }

    // -----------------------------------------------------------------
    // Tear-down
    // -----------------------------------------------------------------

    _resolveResult(reason) {
        if (!this.running) return;
        this.running = false;
        clearInterval(this._timerInterval);
        this.canvas.removeEventListener('mousemove', this._onMouseMove);
        this.canvas.removeEventListener('click',     this._onClick);
        window.removeEventListener('keydown',        this._onKeyDown);

        // Apply ammo + meat to supplies.
        this.gameState.supplies.ammunition -= this.ammoUsed;
        if (this.gameState.supplies.ammunition < 0) {
            this.gameState.supplies.ammunition = 0;
        }
        this.gameState.supplies.food += this.meatGained;

        const result = {
            meat: this.meatGained,
            shotsFired: this.ammoUsed,
            hits: this.targets.filter((t) => t.isHit).length,
            durationMs: (HUNT_DURATION_SECONDS - this.timeLeft) * 1000,
            reason,
        };
        this._resolve(result);
    }
}
