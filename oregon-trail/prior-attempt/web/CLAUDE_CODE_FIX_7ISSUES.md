# Oregon Trail JS — Fix 7 Issues + Hunting Logic (Comprehensive)
# Paste seluruh file ini ke Claude Code.
#
# Semua koordinat dan logika di dokumen ini sudah TERVERIFIKASI VISUAL.

# =============================================================================
# CONTEXT
# =============================================================================
# - vga_MAP.png: 320x200, tersedia dan sudah benar
# - vga_ANIMALS.png: 320x134, 6 hewan × 8 kolom sprites
# - Semua image lain: tersedia dan sudah benar
# Working directory: E:\Projects\BASIC Programs\Collections\Oregon Trail\oregon-trail-js\

# =============================================================================
# ANIMAL SPRITE STRUCTURE — CONFIRMED VISUAL VERIFICATION
# =============================================================================
#
# vga_ANIMALS.png berisi 6 hewan, masing-masing satu band (row):
#
# Band 0 (sh=19): BISON JANTAN  — bergerak LAMBAT
# Band 1 (sh=15): BISON BETINA  — bergerak LAMBAT
# Band 2 (sh=22): RUSA JANTAN   — bergerak SEDANG
# Band 3 (sh=21): RUSA BETINA   — bergerak SEDANG
# Band 4 (sh=9):  KELINCI        — bergerak CEPAT
# Band 5 (sh=9):  BAJING/MUSANG — bergerak CEPAT
#
# Setiap band punya 8 kolom:
#   Kolom 0         : sprite KENA TEMBAK (posisi terbalik, diam di tempat)
#   Kolom 1..6      : 6 animation frames bergerak (cycle loop)
#   Kolom 7         : sprite KENA TEMBAK versi lain (terbalik, diam)
#
# Ketika hewan kena tembak:
#   - Stop bergerak
#   - Ganti ke sprite kolom 0 atau 7 (pilih salah satu, stay di tempat)
#   - Tidak hilang dari screen — tetap tampil sampai hunting selesai
#
# Meat value per hewan (berdasarkan ukuran):
#   Bison jantan/betina : 100 lbs
#   Rusa jantan/betina  : 50 lbs
#   Kelinci             : 10 lbs
#   Bajing/musang       : 5 lbs

# =============================================================================
# UPDATE assets.js — ANIMAL_SPRITES dengan definisi lengkap per hewan
# =============================================================================
#
# Ganti ANIMAL_SPRITES yang lama dengan struktur baru ini:
#
# // FIX 6: Struktur animal sprites diorganisasi per hewan
# // Setiap hewan punya: frames bergerak (col 1-6) dan sprite kena tembak (col 0)
# // Koordinat TERVERIFIKASI dari analyze_animals.py
#
# export const ANIMALS = [
#   {
#     id: 'bison_male',
#     label: 'Bison',
#     band: 0,
#     meatLbs: 100,
#     speedPxPerFrame: 0.4,      // lambat: 0.4 pixel per frame
#     animFrameInterval: 120,    // ms per frame animasi (lebih lambat)
#     // 6 animation frames (kolom 1-6)
#     frames: [
#       { sx:  40, sy:  2, sw: 26, sh: 19 },  // col 1
#       { sx:  79, sy:  2, sw: 27, sh: 19 },  // col 2
#       { sx: 120, sy:  2, sw: 26, sh: 19 },  // col 3
#       { sx: 155, sy:  2, sw: 26, sh: 19 },  // col 4
#       { sx: 195, sy:  2, sw: 27, sh: 19 },  // col 5
#       { sx: 235, sy:  2, sw: 26, sh: 19 },  // col 6
#     ],
#     // Sprite kena tembak (terbalik, diam)
#     hitSprite: { sx: 4, sy: 2, sw: 28, sh: 19 },   // col 0
#   },
#   {
#     id: 'bison_female',
#     label: 'Bison',
#     band: 1,
#     meatLbs: 100,
#     speedPxPerFrame: 0.5,
#     animFrameInterval: 120,
#     frames: [
#       { sx:  39, sy: 24, sw: 28, sh: 15 },
#       { sx:  82, sy: 24, sw: 25, sh: 15 },
#       { sx: 117, sy: 24, sw: 25, sh: 15 },
#       { sx: 159, sy: 24, sw: 25, sh: 15 },
#       { sx: 194, sy: 24, sw: 25, sh: 15 },
#       { sx: 234, sy: 24, sw: 28, sh: 15 },
#     ],
#     hitSprite: { sx: 6, sy: 24, sw: 26, sh: 15 },
#   },
#   {
#     id: 'deer_male',
#     label: 'Deer',
#     band: 2,
#     meatLbs: 50,
#     speedPxPerFrame: 0.9,      // sedang
#     animFrameInterval: 90,
#     frames: [
#       { sx:  39, sy: 45, sw: 23, sh: 22 },
#       { sx:  82, sy: 45, sw: 21, sh: 22 },
#       { sx: 122, sy: 45, sw: 21, sh: 22 },
#       { sx: 158, sy: 45, sw: 21, sh: 22 },
#       { sx: 198, sy: 45, sw: 21, sh: 22 },
#       { sx: 239, sy: 45, sw: 23, sh: 22 },
#     ],
#     hitSprite: { sx: 6, sy: 45, sw: 23, sh: 22 },
#   },
#   {
#     id: 'deer_female',
#     label: 'Deer',
#     band: 3,
#     meatLbs: 50,
#     speedPxPerFrame: 1.0,
#     animFrameInterval: 90,
#     frames: [
#       { sx:  43, sy: 71, sw: 27, sh: 21 },
#       { sx:  78, sy: 71, sw: 29, sh: 21 },
#       { sx: 116, sy: 71, sw: 27, sh: 21 },
#       { sx: 158, sy: 71, sw: 27, sh: 21 },
#       { sx: 194, sy: 71, sw: 29, sh: 21 },
#       { sx: 231, sy: 71, sw: 27, sh: 21 },
#     ],
#     hitSprite: { sx: 5, sy: 71, sw: 29, sh: 21 },
#   },
#   {
#     id: 'rabbit',
#     label: 'Rabbit',
#     band: 4,
#     meatLbs: 10,
#     speedPxPerFrame: 1.8,      // cepat
#     animFrameInterval: 60,
#     frames: [
#       { sx:  34, sy: 100, sw: 14, sh: 9 },
#       { sx:  64, sy: 100, sw: 13, sh: 9 },
#       { sx:  92, sy: 100, sw: 13, sh: 9 },
#       { sx: 118, sy: 100, sw: 13, sh: 9 },
#       { sx: 146, sy: 100, sw: 13, sh: 9 },
#       { sx: 175, sy: 100, sw: 14, sh: 9 },
#     ],
#     hitSprite: { sx: 6, sy: 100, sw: 13, sh: 9 },
#   },
#   {
#     id: 'squirrel',
#     label: 'Squirrel',
#     band: 5,
#     meatLbs: 5,
#     speedPxPerFrame: 2.2,      // paling cepat
#     animFrameInterval: 50,
#     // FIX: kolom 0 dan kolom 7 bajing/musang terdiri dari 2 bagian terpisah
#     // yang digabung menjadi satu sprite utuh
#     // Kolom 0: sx=5 sampai sx=27 (5_0 sw=9 + gap + 5_1 sw=13 = lebar 23)
#     // Kolom 7: sx=219 sampai sx=241 (5_7 sw=13 + gap + 5_8 sw=9 = lebar 23)
#     frames: [
#       { sx:  35, sy: 116, sw: 25, sh: 9 },  // col 1 (5_2)
#       { sx:  73, sy: 116, sw: 25, sh: 9 },  // col 2 (5_3)
#       { sx: 113, sy: 116, sw: 23, sh: 9 },  // col 3 (5_4)
#       { sx: 149, sy: 116, sw: 25, sh: 9 },  // col 4 (5_5)
#       { sx: 187, sy: 116, sw: 25, sh: 9 },  // col 5 (5_6)
#       { sx: 271, sy: 116, sw: 23, sh: 9 },  // col 6 (5_9)
#     ],
#     // hitSprite: gabungan 5_0 + 5_1 → sx=5, lebar mencakup sampai sx=27
#     hitSprite: { sx: 5, sy: 116, sw: 23, sh: 9 },
#   },
# ];

# =============================================================================
# UPDATE hunting.js — Logika lengkap hunting mini-game
# =============================================================================
#
# Ganti atau update seluruh hunting.js dengan implementasi berikut:
#
# // hunting.js — Oregon Trail hunting mini-game
# // Dikonfirmasi dari game asli:
# //   - SPACE = tembak (kita pakai mouse click)
# //   - Hewan bergerak horizontal, bounce di tepi canvas
# //   - Kena tembak: sprite ganti ke hitSprite, DIAM di tempat (tidak hilang)
# //   - Timer 30 detik atau sampai amunisi habis
# //   - Max carry: 100 lbs (CONFIRMED dari EXE string)
#
# export class HuntingGame {
#   constructor(canvas, assets, gameState, onComplete) {
#     this.canvas      = canvas;
#     this.ctx         = canvas.getContext('2d');
#     this.assets      = assets;
#     this.gameState   = gameState;
#     this.onComplete  = onComplete;  // callback(meatGained, ammoUsed)
#
#     this.targets     = [];       // array of active animal instances
#     this.ammoUsed    = 0;
#     this.meatGained  = 0;
#     this.timeLeft    = 30;       // seconds
#     this.running     = false;
#     this.crosshair   = { x: 160, y: 100 };
#
#     // Bind event handlers
#     this._onMouseMove = this._onMouseMove.bind(this);
#     this._onClick     = this._onClick.bind(this);
#     this._onKeyDown   = this._onKeyDown.bind(this);
#   }
#
#   start() {
#     if (this.gameState.supplies.ammunition <= 0) {
#       this.onComplete(0, 0);
#       return;
#     }
#
#     this._spawnAnimals();
#     this._startTimer();
#
#     // Event listeners
#     this.canvas.addEventListener('mousemove', this._onMouseMove);
#     this.canvas.addEventListener('click',     this._onClick);
#     window.addEventListener('keydown',        this._onKeyDown);
#
#     this.running = true;
#     this._gameLoop();
#   }
#
#   _spawnAnimals() {
#     // Spawn 1-2 of each animal type, staggered vertically
#     // Canvas height = 200px. HUNTER backdrop takes full height.
#     // Animals spread across vertical space, not all on same row.
#     const SCALE = 3;  // render sprites at 3x original size
#
#     // Y positions untuk 6 hewan — spread dari atas ke bawah
#     // Hindari area terlalu atas (langit) dan terlalu bawah (tanah)
#     const yPositions = [30, 55, 80, 105, 130, 155];
#
#     ANIMALS.forEach((animalDef, idx) => {
#       // Spawn dari sisi kanan atau kiri secara random
#       const startRight = Math.random() > 0.5;
#       const spriteW    = animalDef.frames[0].sw * SCALE;
#       const startX     = startRight
#         ? this.canvas.width + spriteW    // mulai dari kanan (akan masuk ke kiri)
#         : -spriteW;                      // mulai dari kiri (akan masuk ke kanan)
#
#       this.targets.push({
#         def:          animalDef,
#         x:            startX,
#         y:            yPositions[idx],
#         direction:    startRight ? -1 : 1,   // -1 = bergerak ke kiri
#         frameIdx:     0,
#         lastFrameTime: 0,
#         isHit:        false,
#         scale:        SCALE,
#       });
#     });
#   }
#
#   _gameLoop(timestamp = 0) {
#     if (!this.running) return;
#
#     this._update(timestamp);
#     this._render();
#
#     requestAnimationFrame((ts) => this._gameLoop(ts));
#   }
#
#   _update(timestamp) {
#     this.targets.forEach(target => {
#       if (target.isHit) return;  // kena tembak — diam di tempat
#
#       // Gerak horizontal
#       target.x += target.def.speedPxPerFrame * target.direction;
#
#       const spriteW = target.def.frames[target.frameIdx].sw * target.scale;
#
#       // Bounce di tepi canvas
#       if (target.direction > 0 && target.x > this.canvas.width) {
#         target.x = this.canvas.width;
#         target.direction = -1;
#       } else if (target.direction < 0 && target.x + spriteW < 0) {
#         target.x = -spriteW;
#         target.direction = 1;
#       }
#
#       // Advance animation frame
#       if (timestamp - target.lastFrameTime > target.def.animFrameInterval) {
#         target.frameIdx = (target.frameIdx + 1) % target.def.frames.length;
#         target.lastFrameTime = timestamp;
#       }
#     });
#   }
#
#   _render() {
#     // 1. Background: vga_HUNTER
#     const bg = this.assets.getImage(ASSET_KEYS.HUNTER);
#     if (bg) {
#       this.ctx.drawImage(bg, 0, 0, this.canvas.width, this.canvas.height);
#     } else {
#       this.ctx.fillStyle = '#1a4a1a';
#       this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
#     }
#
#     // 2. Render tiap hewan
#     this.targets.forEach(target => {
#       const sprite = target.isHit
#         ? target.def.hitSprite                  // sprite terbalik, diam
#         : target.def.frames[target.frameIdx];  // frame animasi normal
#
#       const dw = sprite.sw * target.scale;
#       const dh = sprite.sh * target.scale;
#
#       // Kalau bergerak ke kiri, flip horizontal supaya hewan menghadap arah gerak
#       // Kalau kena tembak, sprite sudah terbalik — tidak perlu flip lagi
#       if (!target.isHit && target.direction < 0) {
#         // Flip horizontal: gambar dari kanan ke kiri
#         this.ctx.save();
#         this.ctx.translate(target.x + dw, target.y);
#         this.ctx.scale(-1, 1);
#         this.assets.drawSprite(
#           this.ctx, ASSET_KEYS.ANIMALS, sprite,
#           0, 0, dw, dh
#         );
#         this.ctx.restore();
#       } else {
#         this.assets.drawSprite(
#           this.ctx, ASSET_KEYS.ANIMALS, sprite,
#           target.x, target.y, dw, dh
#         );
#       }
#     });
#
#     // 3. Crosshair
#     this._renderCrosshair();
#
#     // 4. HUD overlay (ammo, time, meat)
#     this._renderHUD();
#   }
#
#   _renderCrosshair() {
#     const cx = this.crosshair.x;
#     const cy = this.crosshair.y;
#     const r  = 8;
#     this.ctx.strokeStyle = '#ffffff';
#     this.ctx.lineWidth   = 1;
#     // Lingkaran
#     this.ctx.beginPath();
#     this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
#     this.ctx.stroke();
#     // Crosshair lines
#     this.ctx.beginPath();
#     this.ctx.moveTo(cx - r - 3, cy); this.ctx.lineTo(cx - 2, cy);
#     this.ctx.moveTo(cx + 2,    cy); this.ctx.lineTo(cx + r + 3, cy);
#     this.ctx.moveTo(cx, cy - r - 3); this.ctx.lineTo(cx, cy - 2);
#     this.ctx.moveTo(cx, cy + 2);    this.ctx.lineTo(cx, cy + r + 3);
#     this.ctx.stroke();
#   }
#
#   _renderHUD() {
#     // Semi-transparent bar di bagian bawah
#     this.ctx.fillStyle = 'rgba(0,0,0,0.65)';
#     this.ctx.fillRect(0, this.canvas.height - 16, this.canvas.width, 16);
#     this.ctx.fillStyle = '#ffffff';
#     this.ctx.font      = '8px monospace';
#     this.ctx.textAlign = 'left';
#     const ammoLeft = this.gameState.supplies.ammunition - this.ammoUsed;
#     this.ctx.fillText(`Ammo: ${ammoLeft}`, 4, this.canvas.height - 5);
#     this.ctx.textAlign = 'center';
#     this.ctx.fillText(`Time: ${this.timeLeft}s`, this.canvas.width / 2, this.canvas.height - 5);
#     this.ctx.textAlign = 'right';
#     this.ctx.fillText(`Meat: ${this.meatGained} lb`, this.canvas.width - 4, this.canvas.height - 5);
#   }
#
#   _startTimer() {
#     this._timerInterval = setInterval(() => {
#       this.timeLeft--;
#       if (this.timeLeft <= 0) this._endHunt();
#     }, 1000);
#   }
#
#   _onMouseMove(e) {
#     // Convert mouse position ke canvas coordinates (karena canvas di-scale 2x di CSS)
#     const rect  = this.canvas.getBoundingClientRect();
#     const scaleX = this.canvas.width  / rect.width;
#     const scaleY = this.canvas.height / rect.height;
#     this.crosshair.x = Math.floor((e.clientX - rect.left) * scaleX);
#     this.crosshair.y = Math.floor((e.clientY - rect.top)  * scaleY);
#   }
#
#   _onClick(e) {
#     if (!this.running) return;
#     const ammoLeft = this.gameState.supplies.ammunition - this.ammoUsed;
#     if (ammoLeft <= 0) { this._endHunt(); return; }
#
#     this.ammoUsed++;
#
#     // Hit detection — cek setiap target
#     const cx = this.crosshair.x;
#     const cy = this.crosshair.y;
#
#     for (const target of this.targets) {
#       if (target.isHit) continue;
#
#       const sp = target.def.frames[target.frameIdx];
#       const dw = sp.sw * target.scale;
#       const dh = sp.sh * target.scale;
#       const tx = target.x;
#       const ty = target.y;
#
#       // Simple AABB (Axis-Aligned Bounding Box) hit detection
#       if (cx >= tx && cx <= tx + dw && cy >= ty && cy <= ty + dh) {
#         target.isHit     = true;
#         this.meatGained += target.def.meatLbs;
#         // Cap meat di HUNT_MAX_CARRY_LBS (100 lbs dari EXE confirmed)
#         if (this.meatGained > HUNT_MAX_CARRY_LBS) {
#           this.meatGained = HUNT_MAX_CARRY_LBS;
#         }
#         break;  // satu tembakan = satu hewan
#       }
#     }
#
#     // Kalau semua ammo habis, end hunt
#     if (this.gameState.supplies.ammunition - this.ammoUsed <= 0) {
#       this._endHunt();
#     }
#   }
#
#   _onKeyDown(e) {
#     // SPACE juga bisa dipakai sebagai alternatif click
#     if (e.code === 'Space') {
#       e.preventDefault();
#       this.canvas.dispatchEvent(new MouseEvent('click', {
#         clientX: this.canvas.getBoundingClientRect().left + this.crosshair.x,
#         clientY: this.canvas.getBoundingClientRect().top  + this.crosshair.y,
#       }));
#     }
#   }
#
#   _endHunt() {
#     this.running = false;
#     clearInterval(this._timerInterval);
#
#     // Cleanup event listeners
#     this.canvas.removeEventListener('mousemove', this._onMouseMove);
#     this.canvas.removeEventListener('click',     this._onClick);
#     window.removeEventListener('keydown',        this._onKeyDown);
#
#     // Callback ke game dengan hasil hunt
#     this.onComplete(this.meatGained, this.ammoUsed);
#   }
# }

# =============================================================================
# FIX 1: Wagon di main screen — geser ke bawah
# =============================================================================
# Di renderer.js fungsi drawMainMenu():
#   // FIX 1: was 0.55, now 0.72 — geser wagon lebih ke bawah
#   const destY = Math.floor(this.height * 0.72);

# =============================================================================
# FIX 2: Store screen — layout ulang (owner kiri + grid 3x3 kanan)
# =============================================================================
# Di renderer.js, update drawStoreScreen():
#
#   drawStoreScreen(storeItems, playerCash) {
#     this.clearScreen('#1a0a00');
#
#     // KIRI (38%): store owner portrait dari vga_FAMILY
#     const leftW = Math.floor(this.width * 0.38);
#     const familyImg = this.assets.getImage(ASSET_KEYS.FAMILY);
#     if (familyImg) {
#       this.ctx.drawImage(familyImg, 0, 0, familyImg.naturalWidth, familyImg.naturalHeight,
#                          0, 0, leftW, this.height);
#     }
#     this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
#     this.ctx.fillRect(0, 0, leftW, 25);
#     this.ctx.fillStyle = '#ffff00';
#     this.ctx.font = 'bold 8px monospace';
#     this.ctx.textAlign = 'center';
#     this.ctx.fillText("Matt's Store", leftW / 2, 10);
#     this.ctx.fillStyle = '#ffffff';
#     this.ctx.font = '7px monospace';
#     this.ctx.fillText('"Hello, I\'m Matt."', leftW / 2, 20);
#     this.ctx.fillStyle = '#00ff00';
#     this.ctx.fillText(`Cash: $${playerCash}`, leftW / 2, this.height - 6);
#
#     // KANAN (62%): grid 3x3 item icons
#     const rightX = leftW + 3;
#     const rightW = this.width - rightX;
#     const cols   = 3;
#     const rows   = 3;
#     const cellW  = Math.floor(rightW / cols);
#     const cellH  = Math.floor(this.height / rows);
#
#     const items = [
#       { key: 'OXEN',     label: 'Oxen',     price: `$${STORE_PRICES.OXEN}/ea`    },
#       { key: 'FOOD',     label: 'Food',     price: `$${STORE_PRICES.FOOD}/lb`    },
#       { key: 'AMMO',     label: 'Ammo',     price: `$${STORE_PRICES.AMMO}/box`   },
#       { key: 'CLOTHING', label: 'Clothing', price: `$${STORE_PRICES.CLOTHING}/set` },
#       { key: 'WHEEL',    label: 'Wheel',    price: `$${STORE_PRICES.WHEEL}/ea`   },
#       { key: 'AXLE',     label: 'Axle',     price: `$${STORE_PRICES.AXLE}/ea`    },
#       { key: 'TONGUE',   label: 'Tongue',   price: `$${STORE_PRICES.TONGUE}/ea`  },
#     ];
#
#     items.forEach((item, idx) => {
#       const col = idx % cols;
#       const row = Math.floor(idx / cols);
#       const cx  = rightX + col * cellW;
#       const cy  = row * cellH;
#
#       // Cell background
#       this.ctx.fillStyle = '#001500';
#       this.ctx.fillRect(cx + 1, cy + 1, cellW - 2, cellH - 2);
#       this.ctx.strokeStyle = '#003300';
#       this.ctx.lineWidth = 1;
#       this.ctx.strokeRect(cx + 1, cy + 1, cellW - 2, cellH - 2);
#
#       // Number label (untuk keyboard shortcut)
#       this.ctx.fillStyle = '#888888';
#       this.ctx.font = '7px monospace';
#       this.ctx.textAlign = 'left';
#       this.ctx.fillText(`${idx + 1}.`, cx + 3, cy + 9);
#
#       // Icon — scale 3x dari sprite asli
#       const sp   = SUPPLY_SPRITES[item.key];
#       const iconW = sp.sw * 3;
#       const iconH = sp.sh * 3;
#       const iconX = cx + Math.floor((cellW - iconW) / 2);
#       const iconY = cy + 12;
#       this.assets.drawSprite(this.ctx, ASSET_KEYS.SUPPLIES, sp,
#                              iconX, iconY, iconW, iconH);
#
#       // Label
#       this.ctx.fillStyle = '#00ff00';
#       this.ctx.font = '7px monospace';
#       this.ctx.textAlign = 'center';
#       this.ctx.fillText(item.label, cx + cellW / 2, iconY + iconH + 8);
#
#       // Harga
#       this.ctx.fillStyle = '#ffff00';
#       this.ctx.fillText(item.price, cx + cellW / 2, iconY + iconH + 16);
#     });
#
#     // Instruksi
#     this.ctx.fillStyle = '#555555';
#     this.ctx.font = '7px monospace';
#     this.ctx.textAlign = 'center';
#     this.ctx.fillText('1-7: buy item  |  ESC: leave store', this.width / 2, this.height - 3);
#   }

# =============================================================================
# FIX 3: Party member input — background vga_FAMILY
# =============================================================================
# Di renderer.js, drawPartySetupScreen():
#   // FIX 3: was vga_BANNER, now vga_FAMILY
#   this.drawScene(ASSET_KEYS.FAMILY);
#   // Semi-transparent overlay untuk text readability
#   this.ctx.fillStyle = 'rgba(0,0,0,0.70)';
#   this.ctx.fillRect(0, this.height - 85, this.width, 85);

# =============================================================================
# FIX 4: Map screen — fix bug langsung kembali ke menu
# =============================================================================
# LANGKAH 1: Di assets.js loadAll(), tambahkan ASSET_KEYS.MAP ke load list
# LANGKAH 2: Di renderer.js drawMap(), pastikan ada null check yang tidak exit:
#
#   drawMap(gameState) {
#     this.clearScreen('#000011');
#     const img = this.assets.getImage(ASSET_KEYS.MAP);
#     if (img) {
#       // vga_MAP.png sudah 320x200, fit persis di canvas
#       const scale = Math.min(this.width/img.naturalWidth, this.height/img.naturalHeight);
#       const dw = Math.floor(img.naturalWidth  * scale);
#       const dh = Math.floor(img.naturalHeight * scale);
#       const ox = Math.floor((this.width  - dw) / 2);
#       const oy = Math.floor((this.height - dh) / 2);
#       this.ctx.drawImage(img, ox, oy, dw, dh);
#       this._drawTrailMarker(gameState, ox, oy, dw, dh);
#     }
#     // "Press any key" bar
#     this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
#     this.ctx.fillRect(0, this.height - 14, this.width, 14);
#     this.ctx.fillStyle = '#ffffff';
#     this.ctx.font = '8px monospace';
#     this.ctx.textAlign = 'center';
#     this.ctx.fillText('Press any key to return', this.width/2, this.height - 4);
#   }
#
# LANGKAH 3: Di ui.js showMap(), WAJIB tunggu keypress sebelum return:
#   async showMap() {
#     renderer.drawMap(this.gameState);
#     await this.waitForAnyKey();  // PENTING: jangan return tanpa ini
#   }

# =============================================================================
# FIX 5: CSS — frame center horizontal + margin atas browser
# =============================================================================
# Di css/style.css, ganti seluruh styling body dan game-container:
#
#   * { box-sizing: border-box; margin: 0; padding: 0; }
#
#   body {
#     background-color: #000;
#     display: flex;
#     flex-direction: column;
#     align-items: center;      /* horizontal center */
#     justify-content: flex-start;
#     min-height: 100vh;
#     padding-top: 40px;        /* margin dari atas browser */
#   }
#
#   #game-container {
#     display: flex;
#     flex-direction: column;
#     align-items: center;
#   }
#
#   #game-canvas {
#     width: 640px;
#     height: 400px;
#     image-rendering: pixelated;
#     image-rendering: crisp-edges;
#     border: 2px solid #00ff00;
#     display: block;
#   }
#
#   #ui-panel {
#     width: 640px;
#   }

# =============================================================================
# URUTAN PENGERJAAN
# =============================================================================
# 1. Fix 5 — CSS (tidak ada dependency, paling mudah)
# 2. Fix 6 — Update ANIMALS dan ANIMAL_SPRITES di assets.js
# 3. Fix hunting.js — ganti dengan implementasi lengkap di atas
# 4. Fix 4 — Map: tambah ke load list + fix waitForKey
# 5. Fix 3 — Party screen background
# 6. Fix 1 — Wagon y position
# 7. Fix 2 — Store layout (paling kompleks)
#
# Test setelah semua selesai:
#   python -m http.server 8080  (dari folder oregon-trail-js)
#   http://localhost:8080/
#   Test: landing → setup (cek vga_FAMILY) → store (cek layout) →
#         travel → map (cek tidak langsung balik) → hunt (cek sprites + kena tembak)

# =============================================================================
# NOTES
# =============================================================================
# - Pertahankan SEMUA comments yang ada, tambah // FIX N: di tiap perubahan
# - ANIMAL_SPRITES lama bisa dihapus — diganti dengan ANIMALS array baru
# - Black-as-transparent tetap berlaku: R<16 && G<16 && B<16 → alpha=0
# - Canvas native 320x200, display 640x400 via CSS
# - HUNT_MAX_CARRY_LBS = 100 (CONFIRMED dari EXE string)
